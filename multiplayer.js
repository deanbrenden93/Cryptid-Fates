/**
 * Cryptid Fates - Multiplayer System
 * 
 * ARCHITECTURE:
 * Active player executes all game logic locally.
 * After action completes, serialize full state.
 * Send action details (for animation) + state (authoritative).
 * Opponent plays animation, applies state, renders.
 * Opponent NEVER re-executes game logic.
 */

window.Multiplayer = {
    // Connection state
    ws: null,
    isConnected: false,
    isSearching: false,
    isInMatch: false,
    
    // Match state
    matchId: null,
    playerId: null,
    opponentId: null,
    opponentName: 'Opponent',
    opponentBackground: null, // Opponent's equipped battlefield background
    mode: null,
    deckId: null,
    
    // BO3 tracking
    playerWins: 0,
    opponentWins: 0,
    currentGame: 1,
    
    // Timer state
    turnTimer: null,
    turnTimeRemaining: 150,
    timerWarningShown: false,
    playerTimeouts: 0,
    opponentTimeouts: 0,
    
    // Turn state
    isMyTurn: false,
    turnTransitionLock: false,
    processingOpponentAction: false,
    
    // Animation queue for smooth opponent actions
    animationQueue: [],
    isPlayingAnimation: false,
    
    // Constants
    TURN_TIME: 150,
    WARNING_TIME: 30,
    DISCONNECT_GRACE: 60000,
    TIMEOUT_FORFEIT: 3,
    
    // Server
    serverUrl: 'wss://cryptid-fates.brenden-6ce.workers.dev',
    
    // Reconnection
    reconnectAttempts: 0,
    maxReconnectAttempts: 5,
    reconnectDelay: 1000,
    
    // Time synchronization (for coordinated animations)
    serverTimeOffset: 0,        // Server time - local time (in ms)
    pingHistory: [],            // Recent ping measurements for smoothing
    lastPingTime: 0,            // When we last sent a ping
    pingInterval: null,         // Interval for periodic pings
    SYNC_BUFFER_MS: 200,        // Buffer time before scheduled animations start
    MAX_LATE_MS: 500,           // Max lateness before we skip/fast-forward animations
    
    // Pending action (for the new broadcast architecture)
    pendingLocalAction: null,   // Action we sent, waiting for server relay
    deferAnimations: false,     // When true, animations are captured but not played locally
    deferredAnimationSequence: null, // Stored for playback when server relay arrives
    awaitingServerResponse: false,   // Waiting for server to process our action
    deckDataSent: false,        // Whether we've sent deck data to server

    // ==================== CONNECTION ====================
    
    connect() {
        if (this.ws?.readyState === WebSocket.OPEN) {
            return Promise.resolve();
        }
        
        return new Promise((resolve, reject) => {
            try {
                // Build WebSocket URL with auth token for server-side session validation
                let wsUrl = this.serverUrl;
                const token = window.Auth?.getToken?.();
                if (token) {
                    wsUrl += `?token=${encodeURIComponent(token)}`;
                }
                
                this.ws = new WebSocket(wsUrl);
                
                this.ws.onopen = () => {
                    console.log('[MP] Connected');
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    
                    this.send({
                        type: 'auth',
                        playerId: this.getPlayerId(),
                        playerName: this.getPlayerName()
                    });
                    
                    resolve();
                };
                
                this.ws.onclose = () => {
                    this.isConnected = false;
                    this.handleDisconnect();
                };
                
                this.ws.onerror = (e) => reject(e);
                
                this.ws.onmessage = (e) => {
                    this.handleMessage(JSON.parse(e.data));
                };
                
            } catch (err) {
                reject(err);
            }
        });
    },
    
    send(data) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            console.log('[MP] Sending:', data.type || data);
            this.ws.send(JSON.stringify(data));
        } else {
            console.error('[MP] Cannot send - WebSocket not open. readyState:', this.ws?.readyState);
        }
    },
    
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
    },
    
    getPlayerId() {
        // Use authenticated user ID if available
        if (window.Auth?.isAuthenticated && window.Auth.user?.id) {
            return window.Auth.user.id;
        }
        
        // Fallback for offline mode
        let id = localStorage.getItem('cryptid_player_id');
        if (!id) {
            id = 'offline_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('cryptid_player_id', id);
        }
        return id;
    },
    
    getPlayerName() {
        // Use authenticated user name if available
        if (window.Auth?.isAuthenticated && window.Auth.user?.displayName) {
            return window.Auth.user.displayName;
        }
        
        // Fallback for offline mode
        return PlayerData?.playerName || 'Summoner';
    },
    
    handleDisconnect() {
        if (this.isInMatch) {
            showMessage('Connection lost! Reconnecting...');
            this.attemptReconnect();
        }
    },
    
    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            showMessage('Could not reconnect.');
            this.resetMatchState();
            return;
        }
        this.reconnectAttempts++;
        setTimeout(() => {
            this.connect().catch(() => this.attemptReconnect());
        }, this.reconnectDelay * this.reconnectAttempts);
    },

    // ==================== TIME SYNCHRONIZATION ====================
    
    /**
     * Start periodic time sync pings
     * Called when entering a match
     */
    startTimeSync() {
        // Initial sync
        this.sendPing();
        
        // Periodic sync every 10 seconds
        this.pingInterval = setInterval(() => {
            this.sendPing();
        }, 10000);
    },
    
    /**
     * Stop time sync pings
     * Called when leaving a match
     */
    stopTimeSync() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    },
    
    /**
     * Send a ping to measure round-trip time and sync clocks
     */
    sendPing() {
        this.lastPingTime = Date.now();
        this.send({
            type: 'ping',
            clientTime: this.lastPingTime
        });
    },
    
    /**
     * Handle pong response from server
     */
    handlePong(msg) {
        const now = Date.now();
        const rtt = now - this.lastPingTime;
        const serverTime = msg.serverTime;
        
        // Estimate server time offset: serverTime was captured at roughly (lastPingTime + rtt/2)
        const estimatedOffset = serverTime - (this.lastPingTime + rtt / 2);
        
        // Keep history for smoothing
        this.pingHistory.push(estimatedOffset);
        if (this.pingHistory.length > 5) {
            this.pingHistory.shift();
        }
        
        // Use median for stability
        const sorted = [...this.pingHistory].sort((a, b) => a - b);
        this.serverTimeOffset = sorted[Math.floor(sorted.length / 2)];
        
        console.log(`[MP] Time sync: RTT=${rtt}ms, offset=${this.serverTimeOffset}ms`);
    },
    
    /**
     * Convert server timestamp to local time
     */
    serverTimeToLocal(serverMs) {
        return serverMs - this.serverTimeOffset;
    },
    
    /**
     * Get current server time (estimated)
     */
    getServerTime() {
        return Date.now() + this.serverTimeOffset;
    },
    
    /**
     * Calculate how many ms until a server timestamp occurs locally
     * Negative means it's already passed
     */
    msUntilServerTime(serverMs) {
        const localTarget = this.serverTimeToLocal(serverMs);
        return localTarget - Date.now();
    },

    // ==================== SERIALIZATION ====================
    
    serializeCryptid(cryptid) {
        if (!cryptid) return null;
        
        return {
            key: cryptid.key,
            name: cryptid.name,
            isKindling: cryptid.isKindling || false,
            col: cryptid.col,
            row: cryptid.row,
            atk: cryptid.atk,
            hp: cryptid.hp,
            cost: cryptid.cost,
            currentAtk: cryptid.currentAtk ?? cryptid.atk,
            currentHp: cryptid.currentHp ?? cryptid.hp,
            maxHp: cryptid.maxHp ?? cryptid.hp,
            baseAtk: cryptid.baseAtk ?? cryptid.atk,
            baseHp: cryptid.baseHp ?? cryptid.hp,
            tapped: cryptid.tapped || false,
            canAttack: cryptid.canAttack !== false,
            attackedThisTurn: cryptid.attackedThisTurn || false,
            justSummoned: cryptid.justSummoned || false,
            evolvedThisTurn: cryptid.evolvedThisTurn || false,
            
            // Status effects
            terrified: cryptid.terrified || false,
            savedAtk: cryptid.savedAtk,
            burnTurns: cryptid.burnTurns || 0,
            bleedTurns: cryptid.bleedTurns || 0,
            bleedStacks: cryptid.bleedStacks || 0,
            paralyzed: cryptid.paralyzed || false,
            paralyzeTurns: cryptid.paralyzeTurns || 0,
            calamityCounters: cryptid.calamityCounters || 0,
            curseTokens: cryptid.curseTokens || 0,
            hadCalamity: cryptid.hadCalamity || false,
            
            // Protection and damage modification
            protectionCharges: cryptid.protectionCharges || 0,
            damageReduction: cryptid.damageReduction || 0,
            blockFirstHit: cryptid.blockFirstHit || false,
            bonusDamage: cryptid.bonusDamage || 0,
            protectedFromAttack: cryptid.protectedFromAttack || false,
            negateIncomingAttack: cryptid.negateIncomingAttack || false,
            preventDeath: cryptid.preventDeath || false,
            
            // Healing and regeneration
            regeneration: cryptid.regeneration || 0,
            healOnKill: cryptid.healOnKill || 0,
            
            // Debuffs
            atkDebuff: cryptid.atkDebuff || 0,
            
            // Core combat flags
            noTapOnAttack: cryptid.noTapOnAttack || false,
            hasFocus: cryptid.hasFocus || false,
            grantsFocus: cryptid.grantsFocus || false,
            hasLatch: cryptid.hasLatch || false,
            hasCleave: cryptid.hasCleave || false,
            hasDestroyer: cryptid.hasDestroyer || false,
            hasMultiAttack: cryptid.hasMultiAttack || false,
            canTargetAny: cryptid.canTargetAny || false,
            hasFlight: cryptid.hasFlight || false,
            canAttackAgain: cryptid.canAttackAgain || false,
            
            // Immunity flags
            immuneToTraps: cryptid.immuneToTraps || false,
            immuneToBursts: cryptid.immuneToBursts || false,
            trapImmune: cryptid.trapImmune || false,
            burstImmune: cryptid.burstImmune || false,
            curseImmune: cryptid.curseImmune || false,
            instantDeathImmune: cryptid.instantDeathImmune || false,
            
            // Attack effect application
            curseHealing: cryptid.curseHealing || false,
            attacksApplyCalamity: cryptid.attacksApplyCalamity || 0,
            attacksApplyParalyze: cryptid.attacksApplyParalyze || false,
            attacksApplyBleed: cryptid.attacksApplyBleed || false,
            attacksApplyBurn: cryptid.attacksApplyBurn || false,
            attacksApplyCurse: cryptid.attacksApplyCurse || 0,
            
            // Conditional damage bonuses
            bonusVsParalyzed: cryptid.bonusVsParalyzed || 0,
            bonusVsAilment: cryptid.bonusVsAilment || 0,
            doubleDamageVsTapped: cryptid.doubleDamageVsTapped || false,
            
            // ==================== FORESTS OF FEAR ====================
            // Stormhawk/Thunderbird
            hasThermalAbility: cryptid.hasThermalAbility || false,
            thermalAvailable: cryptid.thermalAvailable || false,
            hasStormCall: cryptid.hasStormCall || false,
            
            // Adolescent Bigfoot
            hasRageHealAbility: cryptid.hasRageHealAbility || false,
            rageHealAvailable: cryptid.rageHealAvailable || false,
            
            // Adult Bigfoot
            hasBulwark: cryptid.hasBulwark || false,
            
            // Cursed Hybrid
            curseType: cryptid.curseType || null,
            
            // Deer Woman
            hasOfferingAbility: cryptid.hasOfferingAbility || false,
            
            // Mature Wendigo
            hasGuardianAbility: cryptid.hasGuardianAbility || false,
            guardianAvailable: cryptid.guardianAvailable || false,
            
            // Primal Wendigo
            hasCannibalize: cryptid.hasCannibalize || false,
            
            // Werewolf
            hasBloodFrenzyAbility: cryptid.hasBloodFrenzyAbility || false,
            bloodFrenzyAvailable: cryptid.bloodFrenzyAvailable || false,
            cursedToDie: cryptid.cursedToDie || false,
            
            // Lycanthrope
            hasPackGrowth: cryptid.hasPackGrowth || false,
            hasPackLeader: cryptid.hasPackLeader || false,
            
            // Not-Deer
            hasDeathWatch: cryptid.hasDeathWatch || false,
            
            // Jersey Devil
            stealsOnAttack: cryptid.stealsOnAttack || false,
            
            // Baba Yaga
            hasCronesBlessing: cryptid.hasCronesBlessing || false,
            
            // Snipe
            isHidden: cryptid.isHidden || false,
            
            // Skinwalker
            hasInherit: cryptid.hasInherit || false,
            
            // Auras (Forests of Fear)
            hasInsatiableHunger: cryptid.hasInsatiableHunger || false,
            
            // ==================== CITY OF FLESH ====================
            // Hellhound Pup
            hasHellhoundPupSupport: cryptid.hasHellhoundPupSupport || false,
            
            // El Duende
            hasElDuendeSupport: cryptid.hasElDuendeSupport || false,
            protectsTraps: cryptid.protectsTraps || false,
            protectedTrapSlot: cryptid.protectedTrapSlot,
            trapCostModifier: cryptid.trapCostModifier || 0,
            enemyTrapCostModifier: cryptid.enemyTrapCostModifier || 0,
            
            // Library Gargoyle
            libraryGargoyleBuff: cryptid.libraryGargoyleBuff || false,
            
            // Sewer Alligator
            hasSewerAlligatorSupport: cryptid.hasSewerAlligatorSupport || false,
            
            // Fire Imp
            hasSacrificeAbility: cryptid.hasSacrificeAbility || false,
            sacrificeAbilityAvailable: cryptid.sacrificeAbilityAvailable || false,
            sacrificeActivated: cryptid.sacrificeActivated || false,
            
            // Vampire Lord (kill reward tracking)
            rewardOnKill: cryptid.rewardOnKill || false,
            
            // Vampire Initiate
            hasBloodPactAbility: cryptid.hasBloodPactAbility || false,
            bloodPactAvailable: cryptid.bloodPactAvailable || false,
            
            // Other City of Flesh
            radianceActive: cryptid.radianceActive || false,
            regenActive: cryptid.regenActive || false,
            
            // ==================== PUTRID SWAMP ====================
            // Swamp Rat
            hasSwampRatSupport: cryptid.hasSwampRatSupport || false,
            
            // Bayou Sprite
            hasBayouSpriteSupport: cryptid.hasBayouSpriteSupport || false,
            
            // Voodoo Doll
            hasVoodooDollSupport: cryptid.hasVoodooDollSupport || false,
            voodooDollRedirectAvailable: cryptid.voodooDollRedirectAvailable || false,
            mirrorDamageTarget: cryptid.mirrorDamageTarget ? { col: cryptid.mirrorDamageTarget.col, row: cryptid.mirrorDamageTarget.row } : null,
            
            // Swamp Haint
            hasHaintSupport: cryptid.hasHaintSupport || false,
            undyingUsed: cryptid.undyingUsed || false,
            
            // Letiche
            hasLeticheSupport: cryptid.hasLeticheSupport || false,
            
            // Ignis Fatuus
            hasIgnisFatuusSupport: cryptid.hasIgnisFatuusSupport || false,
            
            // Plague Rat
            hasPlagueRatSupport: cryptid.hasPlagueRatSupport || false,
            
            // Swamp Hag
            hasSwampHagSupport: cryptid.hasSwampHagSupport || false,
            
            // Effigy
            hasEffigySupport: cryptid.hasEffigySupport || false,
            soulLinkedTo: cryptid.soulLinkedTo ? { col: cryptid.soulLinkedTo.col, row: cryptid.soulLinkedTo.row } : null,
            splitDamageActive: cryptid.splitDamageActive || false,
            
            // Rooftop Gargoyle
            hasRooftopGargoyleSupport: cryptid.hasRooftopGargoyleSupport || false,
            gargoyleSaveUsed: cryptid.gargoyleSaveUsed || false,
            
            // Gargoyle of the Grand Library
            hasLibraryGargoyleSupport: cryptid.hasLibraryGargoyleSupport || false,
            libraryGargoyleHpBuff: cryptid.libraryGargoyleHpBuff || false,
            stoneBastion: cryptid.stoneBastion || false,
            
            // Decay Rat
            hasDecayRatAbility: cryptid.hasDecayRatAbility || false,
            decayRatDebuffAvailable: cryptid.decayRatDebuffAvailable || false,
            decayRatAtkDebuff: cryptid.decayRatAtkDebuff || 0,
            decayRatHpDebuff: cryptid.decayRatHpDebuff || 0,
            hasDecayRatDebuff: cryptid.hasDecayRatDebuff || false,
            
            // Graveyard Guardian
            negatesEnemySupport: cryptid.negatesEnemySupport || false,
            
            // Spirit Fire
            hasSpiritFireSupport: cryptid.hasSpiritFireSupport || false,
            explodeOnDeath: cryptid.explodeOnDeath || false,
            
            // Boo Hag (ability copying)
            hasBooHagSupport: cryptid.hasBooHagSupport || false,
            booHagRedirectAvailable: cryptid.booHagRedirectAvailable || false,
            copiedAbilityName: cryptid.copiedAbilityName || null,
            copiedAbilityTurns: cryptid.copiedAbilityTurns || 0,
            
            // Revenant
            hasRevenantSupport: cryptid.hasRevenantSupport || false,
            grudgeUsed: cryptid.grudgeUsed || false,
            deathCount: cryptid.deathCount || 0,
            
            // Loup Garou
            moonFrenzyActive: cryptid.moonFrenzyActive || false,
            
            // Swamp Stalker
            hasSwampStalkerSupport: cryptid.hasSwampStalkerSupport || false,
            ambushReady: cryptid.ambushReady || false,
            firstAttack: cryptid.firstAttack || false,
            
            // Mama Brigitte
            hasMamaBrigitteSupport: cryptid.hasMamaBrigitteSupport || false,
            
            // Draugr Lord
            hasDraugrLordSupport: cryptid.hasDraugrLordSupport || false,
            undeathUsed: cryptid.undeathUsed || false,
            cannotDie: cryptid.cannotDie || false,
            
            // Baron Samedi
            hasBaronSamediSupport: cryptid.hasBaronSamediSupport || false,
            
            // Curse Vessel aura
            hasCurseVessel: cryptid.hasCurseVessel || false,
            
            // ==================== TRACKING ====================
            // Support relationship tracking
            bigfootBulkApplied: cryptid.bigfootBulkApplied || false,
            wendigoBondApplied: cryptid.wendigoBondApplied || false,
            _lastBuffedCombatant: cryptid._lastBuffedCombatant || null,
            
            // Visual
            foil: cryptid.foil || false,
            skinId: cryptid.skinId,
            
            // Auras
            auras: (cryptid.auras || []).map(a => ({ key: a.key, name: a.name }))
        };
    },
    
    serializeTrap(trap) {
        if (!trap) return null;
        return { key: trap.key, row: trap.row };
    },
    
    serializeGameState() {
        const g = window.game;
        if (!g) return null;
        
        return {
            playerPyre: g.playerPyre,
            enemyPyre: g.enemyPyre,
            playerDeaths: g.playerDeaths,
            enemyDeaths: g.enemyDeaths,
            playerField: [
                [this.serializeCryptid(g.playerField[0]?.[0]), this.serializeCryptid(g.playerField[0]?.[1]), this.serializeCryptid(g.playerField[0]?.[2])],
                [this.serializeCryptid(g.playerField[1]?.[0]), this.serializeCryptid(g.playerField[1]?.[1]), this.serializeCryptid(g.playerField[1]?.[2])]
            ],
            enemyField: [
                [this.serializeCryptid(g.enemyField[0]?.[0]), this.serializeCryptid(g.enemyField[0]?.[1]), this.serializeCryptid(g.enemyField[0]?.[2])],
                [this.serializeCryptid(g.enemyField[1]?.[0]), this.serializeCryptid(g.enemyField[1]?.[1]), this.serializeCryptid(g.enemyField[1]?.[2])]
            ],
            playerTraps: [this.serializeTrap(g.playerTraps[0]), this.serializeTrap(g.playerTraps[1])],
            enemyTraps: [this.serializeTrap(g.enemyTraps[0]), this.serializeTrap(g.enemyTraps[1])],
            playerHandCount: g.playerHand?.length || 0,
            enemyHandCount: g.enemyHand?.length || 0,
            playerKindlingPlayedThisTurn: g.playerKindlingPlayedThisTurn || false,
            playerPyreCardPlayedThisTurn: g.playerPyreCardPlayedThisTurn || false,
            playerPyreBurnUsed: g.playerPyreBurnUsed || false
        };
    },
    
    deserializeCryptid(data, owner) {
        if (!data) return null;
        const template = CardRegistry.getCryptid(data.key) || CardRegistry.getKindling(data.key);
        if (!template) {
            console.warn('[MP] Card template not found:', data.key);
            return null;
        }
        return { ...template, ...data, owner };
    },
    
    deserializeTrap(data) {
        if (!data) return null;
        const template = CardRegistry.getTrap(data.key);
        if (!template) return null;
        return { ...template, ...data };
    },
    
    /**
     * Apply ONLY the summoned cryptid from state (for staged animation)
     * This allows the summon animation to play before other effects
     * without removing dead cryptids that need death animations
     */
    applySummonedCryptidOnly(state, action) {
        if (!state || !action) return;
        const g = window.game;
        if (!g) return;
        
        // Get the summon position from action data
        const summonCol = action.col;
        const summonRow = action.row;
        if (summonCol === undefined || summonRow === undefined) return;
        
        console.log('[MP] Applying summoned cryptid only at col:', summonCol, 'row:', summonRow);
        
        // Their "player" = our "enemy" (perspective flip)
        // Their col 0 (combat) -> our col 1, their col 1 (support) -> our col 0
        const ourCol = 1 - summonCol;
        
        // Find the cryptid data in their playerField at the summon position
        const data = state.playerField[summonCol]?.[summonRow];
        if (data) {
            const cryptid = this.deserializeCryptid(data, 'enemy');
            if (cryptid) {
                cryptid.col = ourCol;
                cryptid.row = summonRow;
                g.enemyField[ourCol][summonRow] = cryptid;
                console.log('[MP] Summoned cryptid added:', cryptid.name);
            }
        }
    },
    
    applyReceivedState(state) {
        if (!state) return;
        const g = window.game;
        if (!g) return;
        
        console.log('[MP] Applying received state');
        
        // Their "player" = our "enemy" (perspective flip)
        g.enemyPyre = state.playerPyre;
        g.enemyDeaths = state.playerDeaths;
        
        // Their playerField -> our enemyField (with column flip for visual mirroring)
        // Their col 0 (combat) -> our col 1, their col 1 (support) -> our col 0
        for (let c = 0; c < 2; c++) {
            const ourCol = 1 - c; // Column flip for proper visual mirroring
            for (let r = 0; r < 3; r++) {
                const data = state.playerField[c]?.[r];
                if (data) {
                    const cryptid = this.deserializeCryptid(data, 'enemy');
                    if (cryptid) {
                        cryptid.col = ourCol;
                        cryptid.row = r;
                    }
                    g.enemyField[ourCol][r] = cryptid;
                } else {
                    g.enemyField[ourCol][r] = null;
                }
            }
        }
        
        // Their enemyField -> our playerField (CREATE or UPDATE)
        // This handles: forced summons, resurrections, or any effect that puts creatures on our field
        // Column flip: their view of col 0 -> our col 1, their col 1 -> our col 0
        for (let c = 0; c < 2; c++) {
            const ourCol = 1 - c; // Column flip for proper visual mirroring
            for (let r = 0; r < 3; r++) {
                const theirView = state.enemyField[c]?.[r];
                const ourCryptid = g.playerField[ourCol]?.[r];
                
                if (theirView && ourCryptid && theirView.key === ourCryptid.key) {
                    // UPDATE existing cryptid stats
                    // PRESERVE local tracking values that opponent doesn't know about
                    const localLastBuffed = ourCryptid._lastBuffedCombatant;
                    
                    // Core stats
                    ourCryptid.currentAtk = theirView.currentAtk;
                    ourCryptid.currentHp = theirView.currentHp;
                    ourCryptid.maxHp = theirView.maxHp;
                    ourCryptid.baseAtk = theirView.baseAtk;
                    ourCryptid.baseHp = theirView.baseHp;
                    ourCryptid.tapped = theirView.tapped;
                    ourCryptid.canAttack = theirView.canAttack;
                    ourCryptid.attackedThisTurn = theirView.attackedThisTurn;
                    
                    // Status effects
                    ourCryptid.terrified = theirView.terrified;
                    ourCryptid.savedAtk = theirView.savedAtk;
                    ourCryptid.burnTurns = theirView.burnTurns;
                    ourCryptid.bleedTurns = theirView.bleedTurns;
                    ourCryptid.bleedStacks = theirView.bleedStacks;
                    ourCryptid.paralyzed = theirView.paralyzed;
                    ourCryptid.paralyzeTurns = theirView.paralyzeTurns;
                    ourCryptid.calamityCounters = theirView.calamityCounters;
                    ourCryptid.curseTokens = theirView.curseTokens;
                    ourCryptid.hadCalamity = theirView.hadCalamity;
                    
                    // Protection and damage modification
                    ourCryptid.protectionCharges = theirView.protectionCharges;
                    ourCryptid.damageReduction = theirView.damageReduction;
                    ourCryptid.blockFirstHit = theirView.blockFirstHit;
                    ourCryptid.bonusDamage = theirView.bonusDamage;
                    ourCryptid.protectedFromAttack = theirView.protectedFromAttack;
                    ourCryptid.negateIncomingAttack = theirView.negateIncomingAttack;
                    ourCryptid.preventDeath = theirView.preventDeath;
                    
                    // Healing and regeneration
                    ourCryptid.regeneration = theirView.regeneration;
                    ourCryptid.healOnKill = theirView.healOnKill;
                    ourCryptid.atkDebuff = theirView.atkDebuff;
                    
                    // Core combat flags
                    ourCryptid.hasFlight = theirView.hasFlight;
                    ourCryptid.hasCleave = theirView.hasCleave;
                    ourCryptid.hasDestroyer = theirView.hasDestroyer;
                    ourCryptid.hasMultiAttack = theirView.hasMultiAttack;
                    ourCryptid.canAttackAgain = theirView.canAttackAgain;
                    ourCryptid.noTapOnAttack = theirView.noTapOnAttack;
                    ourCryptid.hasFocus = theirView.hasFocus;
                    ourCryptid.doubleDamageVsTapped = theirView.doubleDamageVsTapped;
                    
                    // Immunity flags
                    ourCryptid.immuneToTraps = theirView.immuneToTraps;
                    ourCryptid.immuneToBursts = theirView.immuneToBursts;
                    ourCryptid.trapImmune = theirView.trapImmune;
                    ourCryptid.burstImmune = theirView.burstImmune;
                    ourCryptid.curseImmune = theirView.curseImmune;
                    ourCryptid.instantDeathImmune = theirView.instantDeathImmune;
                    
                    // Attack effect application
                    ourCryptid.attacksApplyCurse = theirView.attacksApplyCurse;
                    ourCryptid.attacksApplyParalyze = theirView.attacksApplyParalyze;
                    ourCryptid.attacksApplyBleed = theirView.attacksApplyBleed;
                    ourCryptid.attacksApplyBurn = theirView.attacksApplyBurn;
                    ourCryptid.attacksApplyCalamity = theirView.attacksApplyCalamity;
                    
                    // Conditional damage bonuses
                    ourCryptid.bonusVsParalyzed = theirView.bonusVsParalyzed;
                    ourCryptid.bonusVsAilment = theirView.bonusVsAilment;
                    
                    // Forests of Fear abilities
                    ourCryptid.hasThermalAbility = theirView.hasThermalAbility;
                    ourCryptid.thermalAvailable = theirView.thermalAvailable;
                    ourCryptid.hasStormCall = theirView.hasStormCall;
                    ourCryptid.hasRageHealAbility = theirView.hasRageHealAbility;
                    ourCryptid.rageHealAvailable = theirView.rageHealAvailable;
                    ourCryptid.hasBulwark = theirView.hasBulwark;
                    ourCryptid.curseType = theirView.curseType;
                    ourCryptid.hasOfferingAbility = theirView.hasOfferingAbility;
                    ourCryptid.hasGuardianAbility = theirView.hasGuardianAbility;
                    ourCryptid.guardianAvailable = theirView.guardianAvailable;
                    ourCryptid.hasCannibalize = theirView.hasCannibalize;
                    ourCryptid.hasBloodFrenzyAbility = theirView.hasBloodFrenzyAbility;
                    ourCryptid.bloodFrenzyAvailable = theirView.bloodFrenzyAvailable;
                    ourCryptid.cursedToDie = theirView.cursedToDie;
                    ourCryptid.hasPackGrowth = theirView.hasPackGrowth;
                    ourCryptid.hasPackLeader = theirView.hasPackLeader;
                    ourCryptid.hasDeathWatch = theirView.hasDeathWatch;
                    ourCryptid.stealsOnAttack = theirView.stealsOnAttack;
                    ourCryptid.hasCronesBlessing = theirView.hasCronesBlessing;
                    ourCryptid.isHidden = theirView.isHidden;
                    ourCryptid.hasInherit = theirView.hasInherit;
                    ourCryptid.hasInsatiableHunger = theirView.hasInsatiableHunger;
                    
                    // City of Flesh abilities
                    ourCryptid.hasHellhoundPupSupport = theirView.hasHellhoundPupSupport;
                    ourCryptid.hasElDuendeSupport = theirView.hasElDuendeSupport;
                    ourCryptid.protectsTraps = theirView.protectsTraps;
                    ourCryptid.protectedTrapSlot = theirView.protectedTrapSlot;
                    ourCryptid.trapCostModifier = theirView.trapCostModifier;
                    ourCryptid.enemyTrapCostModifier = theirView.enemyTrapCostModifier;
                    ourCryptid.libraryGargoyleBuff = theirView.libraryGargoyleBuff;
                    ourCryptid.hasSewerAlligatorSupport = theirView.hasSewerAlligatorSupport;
                    ourCryptid.hasSacrificeAbility = theirView.hasSacrificeAbility;
                    ourCryptid.sacrificeAbilityAvailable = theirView.sacrificeAbilityAvailable;
                    ourCryptid.sacrificeActivated = theirView.sacrificeActivated;
                    ourCryptid.rewardOnKill = theirView.rewardOnKill;
                    ourCryptid.hasBloodPactAbility = theirView.hasBloodPactAbility;
                    ourCryptid.bloodPactAvailable = theirView.bloodPactAvailable;
                    ourCryptid.radianceActive = theirView.radianceActive;
                    ourCryptid.regenActive = theirView.regenActive;
                    ourCryptid.curseHealing = theirView.curseHealing;
                    
                    // Putrid Swamp abilities
                    ourCryptid.hasSwampRatSupport = theirView.hasSwampRatSupport;
                    ourCryptid.hasBayouSpriteSupport = theirView.hasBayouSpriteSupport;
                    ourCryptid.hasVoodooDollSupport = theirView.hasVoodooDollSupport;
                    ourCryptid.voodooDollRedirectAvailable = theirView.voodooDollRedirectAvailable;
                    ourCryptid.hasHaintSupport = theirView.hasHaintSupport;
                    ourCryptid.undyingUsed = theirView.undyingUsed;
                    ourCryptid.hasLeticheSupport = theirView.hasLeticheSupport;
                    ourCryptid.hasIgnisFatuusSupport = theirView.hasIgnisFatuusSupport;
                    ourCryptid.hasPlagueRatSupport = theirView.hasPlagueRatSupport;
                    ourCryptid.hasSwampHagSupport = theirView.hasSwampHagSupport;
                    ourCryptid.hasEffigySupport = theirView.hasEffigySupport;
                    ourCryptid.splitDamageActive = theirView.splitDamageActive;
                    ourCryptid.hasRooftopGargoyleSupport = theirView.hasRooftopGargoyleSupport;
                    ourCryptid.gargoyleSaveUsed = theirView.gargoyleSaveUsed;
                    ourCryptid.hasLibraryGargoyleSupport = theirView.hasLibraryGargoyleSupport;
                    ourCryptid.libraryGargoyleHpBuff = theirView.libraryGargoyleHpBuff;
                    ourCryptid.stoneBastion = theirView.stoneBastion;
                    ourCryptid.hasDecayRatAbility = theirView.hasDecayRatAbility;
                    ourCryptid.decayRatDebuffAvailable = theirView.decayRatDebuffAvailable;
                    ourCryptid.decayRatAtkDebuff = theirView.decayRatAtkDebuff;
                    ourCryptid.decayRatHpDebuff = theirView.decayRatHpDebuff;
                    ourCryptid.hasDecayRatDebuff = theirView.hasDecayRatDebuff;
                    ourCryptid.negatesEnemySupport = theirView.negatesEnemySupport;
                    ourCryptid.hasSpiritFireSupport = theirView.hasSpiritFireSupport;
                    ourCryptid.explodeOnDeath = theirView.explodeOnDeath;
                    ourCryptid.hasBooHagSupport = theirView.hasBooHagSupport;
                    ourCryptid.booHagRedirectAvailable = theirView.booHagRedirectAvailable;
                    ourCryptid.copiedAbilityName = theirView.copiedAbilityName;
                    ourCryptid.copiedAbilityTurns = theirView.copiedAbilityTurns;
                    ourCryptid.hasRevenantSupport = theirView.hasRevenantSupport;
                    ourCryptid.grudgeUsed = theirView.grudgeUsed;
                    ourCryptid.deathCount = theirView.deathCount;
                    ourCryptid.moonFrenzyActive = theirView.moonFrenzyActive;
                    ourCryptid.hasSwampStalkerSupport = theirView.hasSwampStalkerSupport;
                    ourCryptid.ambushReady = theirView.ambushReady;
                    ourCryptid.firstAttack = theirView.firstAttack;
                    ourCryptid.hasMamaBrigitteSupport = theirView.hasMamaBrigitteSupport;
                    ourCryptid.hasDraugrLordSupport = theirView.hasDraugrLordSupport;
                    ourCryptid.undeathUsed = theirView.undeathUsed;
                    ourCryptid.cannotDie = theirView.cannotDie;
                    ourCryptid.hasBaronSamediSupport = theirView.hasBaronSamediSupport;
                    ourCryptid.hasCurseVessel = theirView.hasCurseVessel;
                    
                    // RESTORE local tracking values
                    ourCryptid._lastBuffedCombatant = localLastBuffed;
                } else if (theirView && !ourCryptid) {
                    // CREATE new cryptid (forced summon, resurrection, etc.)
                    console.log('[MP] Creating cryptid on our field:', theirView.key, 'at col', ourCol, 'row', r);
                    const cryptid = this.deserializeCryptid(theirView, 'player');
                    if (cryptid) {
                        cryptid.col = ourCol;
                        cryptid.row = r;
                        g.playerField[ourCol][r] = cryptid;
                        
                        // If this was a kindling, remove it from our kindling pool
                        if (cryptid.isKindling && g.playerKindling) {
                            const kindlingIdx = g.playerKindling.findIndex(k => k.key === cryptid.key);
                            if (kindlingIdx !== -1) {
                                g.playerKindling.splice(kindlingIdx, 1);
                                console.log('[MP] Removed', cryptid.key, 'from playerKindling (forced summon). Remaining:', g.playerKindling.length);
                            }
                        }
                    }
                } else if (!theirView && ourCryptid) {
                    // Creature died on opponent's side
                    g.playerField[ourCol][r] = null;
                }
            }
        }
        
        // Update our pyre from their view of it
        if (state.enemyPyre !== undefined) {
            g.playerPyre = state.enemyPyre;
        }
        // Their enemyDeaths = our playerDeaths (deaths on our side from their perspective)
        if (state.enemyDeaths !== undefined) {
            g.playerDeaths = state.enemyDeaths;
        }
        // Their playerDeaths = our enemyDeaths (deaths on their side from their perspective)
        if (state.playerDeaths !== undefined) {
            g.enemyDeaths = state.playerDeaths;
        }
        
        // Check for game over after applying death counts
        if (g.playerDeaths >= 10 || g.enemyDeaths >= 10) {
            // Delay slightly to allow render to complete first
            setTimeout(() => {
                if (!g.gameOver) {
                    g.checkGameOver();
                }
            }, 100);
        }
        
        // Traps - also need column flip (index 0 <-> 1)
        g.enemyTraps[1] = this.deserializeTrap(state.playerTraps[0]);
        g.enemyTraps[0] = this.deserializeTrap(state.playerTraps[1]);
        // Our traps from their view
        if (!state.enemyTraps[1]) g.playerTraps[0] = null;
        if (!state.enemyTraps[0]) g.playerTraps[1] = null;
        
        // Hand count
        const targetCount = state.playerHandCount;
        while (g.enemyHand.length < targetCount) g.enemyHand.push({});
        while (g.enemyHand.length > targetCount) g.enemyHand.pop();
        
        // Turn flags
        g.enemyKindlingPlayedThisTurn = state.playerKindlingPlayedThisTurn;
        g.enemyPyreCardPlayedThisTurn = state.playerPyreCardPlayedThisTurn;
        g.enemyPyreBurnUsed = state.playerPyreBurnUsed;
    },

    // ==================== ACTION SENDING ====================
    
    /**
     * Send a game action with animation sequence
     * AnimationSequence is built during game logic execution
     */
    /**
     * NEW ARCHITECTURE: Send intent to server
     * Server validates, executes, and broadcasts result to both players
     * Client does NOT execute game logic locally anymore
     */
    sendGameAction(actionType, details = {}) {
        // Special case: cheatSync can be sent anytime (for debugging)
        const bypassTurnCheck = actionType === 'cheatSync';
        
        if (!this.isInMatch || (!this.isMyTurn && !bypassTurnCheck)) {
            console.warn('[MP] Cannot send - not in match or not our turn');
            return;
        }
        
        // Build intent message - NO state, NO animation capture
        // Server will process and send back authoritative result
        const msg = {
            type: 'action',
            matchId: this.matchId,
            playerId: this.playerId,
            action: { 
                type: actionType, 
                ...details
            }
            // NOTE: No state sent - server is authoritative
        };
        
        // For first action, include deck data so server can initialize
        if (!this.deckDataSent && window.game) {
            msg.deckData = this.buildDeckData();
            this.deckDataSent = true;
        }
        
        console.log('[MP] Sending intent:', actionType);
        this.send(msg);
        
        // Mark that we're waiting for server response
        this.awaitingServerResponse = true;
    },
    
    /**
     * Build deck data to send to server for initialization
     * Includes current hand so server uses exact same cards with same IDs
     */
    buildDeckData() {
        const g = window.game;
        if (!g) return null;
        
        // DEBUG: Log kindling data being sent
        console.log('[MP] Building deck data. playerKindling:', 
            g.playerKindling?.map(k => ({ id: k.id, key: k.key, name: k.name })) || 'none');
        
        // Send deck, kindling, AND current hand
        // Server will use our hand directly (same IDs) instead of drawing its own
        const deckData = {
            mainDeck: g.deck?.map(c => this.serializeCardForServer(c)) || [],
            kindling: g.playerKindling?.map(k => this.serializeCardForServer(k)) || [],
            hand: g.playerHand?.map(c => this.serializeCardForServer(c)) || []
        };
        
        console.log('[MP] Deck data kindling keys:', deckData.kindling.map(k => k.key));
        return deckData;
    },
    
    /**
     * Serialize a card for server (minimal data needed)
     */
    serializeCardForServer(card) {
        return {
            id: card.id,
            key: card.key,
            name: card.name,
            type: card.type || 'cryptid',
            cost: card.cost || 0,
            atk: card.atk,
            hp: card.hp,
            element: card.element,
            rarity: card.rarity,
            evolvesFrom: card.evolvesFrom,
            isKindling: card.isKindling
        };
    },
    
    /**
     * Start building animation sequence before an action
     * Call this at the START of action execution
     */
    startActionCapture() {
        if (window.game?.isMultiplayer && this.isMyTurn) {
            window.AnimationCapture?.startCapture?.();
        }
    },
    
    /**
     * Cancel capture without sending (for error cases)
     */
    cancelActionCapture() {
        window.AnimationCapture?.cancelCapture?.();
    },

    // ==================== ACTION RECEIVING ====================
    
    handleOpponentAction(msg) {
        const { action, state } = msg;
        if (!action) return;
        
        console.log('[MP] Received:', action.type);
        this.processingOpponentAction = true;
        
        // Queue the action for processing
        this.animationQueue.push({ action, state });
        this.processAnimationQueue();
    },
    
    processAnimationQueue() {
        if (this.isPlayingAnimation || this.animationQueue.length === 0) return;
        
        this.isPlayingAnimation = true;
        const { action, state } = this.animationQueue.shift();
        const self = this;
        
        // Check for animation data (prefer sequence over events over legacy)
        const hasSequence = action.animationSequence && action.animationSequence.length > 0;
        const hasManifest = action.animationEvents && action.animationEvents.length > 0;
        
        // Completion handler - called after animations finish
        const onAnimationComplete = () => {
            requestAnimationFrame(() => {
                if (typeof renderAll === 'function') renderAll();
                requestAnimationFrame(() => {
                    if (typeof updateButtons === 'function') updateButtons();
                });
                
                if (action.type === 'endPhase') {
                    self.handleOpponentEndTurn();
                }
                
                self.isPlayingAnimation = false;
                self.processingOpponentAction = self.animationQueue.length > 0;
                setTimeout(() => self.processAnimationQueue(), 50);
            });
        };
        
        // Determine if we should animate before applying state
        // This is needed when sprites will be removed/changed by state application
        const hasDeaths = action.targetDied || action.supportDied || 
                         action.animationSequence?.some(c => c.type === 'death') ||
                         action.animationEvents?.some(e => e.type === 'onDeath' || e.type === 'onKill');
        
        // Also check for damage - we want to animate BEFORE state so HP changes happen at the right time
        const hasDamage = action.animationSequence?.some(c => c.type === 'damage' || c.type === 'attackMove') ||
                         action.animationEvents?.some(e => e.type === 'onDamageTaken' || e.type === 'onHit');
        
        const shouldAnimateBeforeState = hasDeaths || hasDamage;
        
        if (hasSequence) {
            // NEW: Use animation sequence playback (preferred)
            console.log('[MP] Playing animation sequence:', action.animationSequence.length, 'commands');
            
            // Special handling for summons with deaths - need staged state application
            // 1. Apply summoned cryptid first (so sprite exists for animation)
            // 2. Play all animations (summon, damage, deaths on existing sprites)
            // 3. Apply full state (removes dead cryptids)
            const isSummonWithEffects = action.type === 'summon' && shouldAnimateBeforeState;
            
            if (isSummonWithEffects && state) {
                // STAGED APPLICATION: Add summoned cryptid first
                this.applySummonedCryptidOnly(state, action);
                
                requestAnimationFrame(() => {
                    if (typeof renderAll === 'function') renderAll();
                    
                    setTimeout(() => {
                        // Play full animation sequence
                        this.playAnimationSequence(action.animationSequence, () => {
                            // Now apply full state (removes dead cryptids)
                            this.applyReceivedState(state);
                            onAnimationComplete();
                        });
                    }, 50);
                });
            } else if (shouldAnimateBeforeState) {
                // Play sequence FIRST, then apply state (attacks, etc.)
                this.playAnimationSequence(action.animationSequence, () => {
                    if (state) {
                        this.applyReceivedState(state);
                    }
                    onAnimationComplete();
                });
            } else {
                // Apply state first, then play sequence
                if (state) {
                    this.applyReceivedState(state);
                }
                
                requestAnimationFrame(() => {
                    if (typeof renderAll === 'function') renderAll();
                    
                    setTimeout(() => {
                        this.playAnimationSequence(action.animationSequence, onAnimationComplete);
                    }, 50);
                });
            }
        } else if (hasManifest) {
            // COMPAT: Use old event-based manifest playback
            console.log('[MP] Playing animation manifest:', action.animationEvents.length, 'events');
            
            if (shouldAnimateBeforeState) {
                this.playAnimationManifest(action.animationEvents, () => {
                    if (state) {
                        this.applyReceivedState(state);
                    }
                    onAnimationComplete();
                });
            } else {
                if (state) {
                    this.applyReceivedState(state);
                }
                
                requestAnimationFrame(() => {
                    if (typeof renderAll === 'function') renderAll();
                    
                    setTimeout(() => {
                        this.playAnimationManifest(action.animationEvents, onAnimationComplete);
                    }, 50);
                });
            }
        } else {
            // LEGACY: Use old playAnimation for backwards compatibility
            console.log('[MP] Using legacy animation for:', action.type);
            
            if (shouldAnimateBeforeState) {
                this.playAnimation(action, () => {
                    if (state) {
                        this.applyReceivedState(state);
                    }
                    onAnimationComplete();
                }, state);
            } else {
                if (state) {
                    this.applyReceivedState(state);
                }
                
                requestAnimationFrame(() => {
                    if (typeof renderAll === 'function') renderAll();
                    
                    setTimeout(() => {
                        this.playAnimation(action, onAnimationComplete, state);
                    }, 50);
                });
            }
        }
    },
    
    // ==================== ANIMATION MANIFEST PLAYBACK ====================
    // Plays back captured GameEvents on the opponent's screen
    // This is the core of visual synchronization - both players see the same "movie"
    
    /**
     * Play through a manifest of captured events
     * @param {Array} events - Array of captured events from AnimationCapture
     * @param {Function} onComplete - Called when all events have played
     */
    playAnimationManifest(events, onComplete) {
        const self = this;
        
        if (!events || events.length === 0) {
            console.log('[MP Playback] No events to play');
            onComplete?.();
            return;
        }
        
        console.log('[MP Playback] Playing', events.length, 'events');
        
        let currentIndex = 0;
        let batchStartTime = 0;
        const BATCH_WINDOW = 50; // Events within 50ms are batched together
        
        const playNext = () => {
            if (currentIndex >= events.length) {
                console.log('[MP Playback] Complete');
                onComplete?.();
                return;
            }
            
            // Batch events that happened nearly simultaneously
            const batch = [events[currentIndex]];
            batchStartTime = events[currentIndex].timestamp || 0;
            currentIndex++;
            
            while (currentIndex < events.length) {
                const nextEvent = events[currentIndex];
                const timeDiff = (nextEvent.timestamp || 0) - batchStartTime;
                if (timeDiff <= BATCH_WINDOW) {
                    batch.push(nextEvent);
                    currentIndex++;
                } else {
                    break;
                }
            }
            
            // Play all events in this batch simultaneously
            let maxDuration = 0;
            for (const event of batch) {
                const duration = self.playEventAnimation(event);
                maxDuration = Math.max(maxDuration, duration);
            }
            
            // Wait for batch to complete, then play next
            setTimeout(playNext, maxDuration + 50);
        };
        
        // Start playback
        playNext();
    },
    
    // ==================== ANIMATION SEQUENCE PLAYBACK ====================
    // Plays back ordered animation commands (the new system)
    // Each command is a universal primitive with all data needed to execute
    
    /**
     * Play an animation sequence - ordered commands that choreograph the action
     * @param {Array} sequence - Array of animation commands
     * @param {Function} onComplete - Called when sequence finishes
     */
    playAnimationSequence(sequence, onComplete) {
        const self = this;
        
        if (!sequence || sequence.length === 0) {
            console.log('[MP Seq] No commands to play');
            onComplete?.();
            return;
        }
        
        console.log('[MP Seq] Playing', sequence.length, 'commands');
        
        let currentIndex = 0;
        
        const playNextCommand = () => {
            if (currentIndex >= sequence.length) {
                console.log('[MP Seq] Complete');
                onComplete?.();
                return;
            }
            
            const command = sequence[currentIndex];
            currentIndex++;
            
            // Handle parallel commands (play all simultaneously)
            if (command.type === 'parallel' && command.commands) {
                let maxDuration = 0;
                for (const subCmd of command.commands) {
                    const duration = self.playSequenceCommand(subCmd);
                    maxDuration = Math.max(maxDuration, duration);
                }
                setTimeout(playNextCommand, maxDuration + 20);
            } else {
                const duration = self.playSequenceCommand(command);
                setTimeout(playNextCommand, duration + 20);
            }
        };
        
        // Start playback
        playNextCommand();
    },
    
    /**
     * Execute a single animation command
     * Returns duration in ms
     */
    playSequenceCommand(cmd) {
        const type = cmd.type;
        const g = window.game;
        
        // Helper to flip perspective (their player = our enemy)
        const flipOwner = (owner) => owner === 'player' ? 'enemy' : 'player';
        const flipCol = (col) => col !== undefined ? 1 - col : undefined;
        
        // Helper to find sprite by position
        const findSprite = (owner, col, row) => {
            const flippedOwner = flipOwner(owner);
            const flippedCol = flipCol(col);
            return document.querySelector(
                `.cryptid-sprite[data-owner="${flippedOwner}"][data-col="${flippedCol}"][data-row="${row}"]`
            );
        };
        
        // Helper to find cryptid by position
        const findCryptid = (owner, col, row) => {
            const flippedOwner = flipOwner(owner);
            const flippedCol = flipCol(col);
            const field = flippedOwner === 'player' ? g?.playerField : g?.enemyField;
            return field?.[flippedCol]?.[row];
        };
        
        let duration = 100;
        
        switch (type) {
            // ==================== ATTACK MOVE ====================
            case 'attackMove': {
                const atkSprite = findSprite(cmd.attackerOwner, cmd.attackerCol, cmd.attackerRow);
                const tgtSprite = findSprite(cmd.targetOwner, cmd.targetCol, cmd.targetRow);
                
                if (atkSprite && window.CombatEffects?.playEnhancedAttack) {
                    // Use the enhanced attack which includes lunge animation
                    window.CombatEffects.playEnhancedAttack(
                        atkSprite, 
                        flipOwner(cmd.attackerOwner), 
                        tgtSprite, 
                        0, // damage shown by separate damage command
                        null, // onImpact handled by damage command
                        null  // onComplete
                    );
                    duration = 500; // Attack animation time
                } else if (atkSprite) {
                    // Fallback: just add attacking class
                    const direction = flipOwner(cmd.attackerOwner) === 'player' ? 'right' : 'left';
                    atkSprite.classList.add(`attacking-${direction}`);
                    setTimeout(() => atkSprite.classList.remove(`attacking-${direction}`), 400);
                    duration = 400;
                }
                break;
            }
            
            // ==================== DAMAGE ====================
            case 'damage': {
                const sprite = findSprite(cmd.targetOwner, cmd.targetCol, cmd.targetRow);
                const cryptid = findCryptid(cmd.targetOwner, cmd.targetCol, cmd.targetRow);
                const amount = cmd.amount || 0;
                
                if (sprite && window.CombatEffects) {
                    const battlefield = document.getElementById('battlefield-area');
                    if (battlefield) {
                        const rect = sprite.getBoundingClientRect();
                        const bfRect = battlefield.getBoundingClientRect();
                        const x = rect.left + rect.width/2 - bfRect.left;
                        const y = rect.top + rect.height/2 - bfRect.top;
                        
                        // Impact effects
                        window.CombatEffects.createImpactFlash?.(x, y, 60 + amount * 8);
                        window.CombatEffects.createSparks?.(x, y, 6 + amount);
                        window.CombatEffects.heavyImpact?.(Math.min(amount, 5));
                        
                        // Damage number
                        if (cryptid && amount > 0) {
                            window.CombatEffects.showDamageNumber(cryptid, amount, cmd.isCrit || amount >= 5);
                        }
                    }
                    
                    // Hit recoil
                    sprite.classList.add('hit-recoil');
                    setTimeout(() => sprite.classList.remove('hit-recoil'), 250);
                }
                
                duration = 300;
                break;
            }
            
            // ==================== HEAL ====================
            case 'heal': {
                const sprite = findSprite(cmd.targetOwner, cmd.targetCol, cmd.targetRow);
                const cryptid = findCryptid(cmd.targetOwner, cmd.targetCol, cmd.targetRow);
                const amount = cmd.amount || 0;
                
                if (cryptid && amount > 0 && window.CombatEffects?.showHealNumber) {
                    window.CombatEffects.showHealNumber(cryptid, amount);
                }
                
                if (sprite) {
                    sprite.classList.add('healing');
                    setTimeout(() => sprite.classList.remove('healing'), 500);
                }
                
                duration = 400;
                break;
            }
            
            // ==================== DEATH ====================
            case 'death': {
                const sprite = findSprite(cmd.owner, cmd.col, cmd.row);
                
                if (sprite && window.CombatEffects?.playDramaticDeath) {
                    const flippedOwner = flipOwner(cmd.owner);
                    const rarity = cmd.rarity || sprite.className.match(/rarity-(\w+)/)?.[1] || 'common';
                    window.CombatEffects.playDramaticDeath(sprite, flippedOwner, rarity);
                } else if (sprite) {
                    const direction = flipOwner(cmd.owner) === 'player' ? 'left' : 'right';
                    sprite.classList.add(`dying-${direction}`);
                }
                
                // Show death message
                if (cmd.name) {
                    showMessage?.(`💀 ${cmd.name} was destroyed!`, 600);
                }
                
                duration = 800;
                break;
            }
            
            // ==================== STATUS APPLY ====================
            case 'statusApply': {
                const sprite = findSprite(cmd.targetOwner, cmd.targetCol, cmd.targetRow);
                const status = cmd.status || 'burn';
                
                if (sprite) {
                    // Visual feedback based on status type
                    if (status === 'burn') {
                        sprite.classList.add('burn-applied');
                        setTimeout(() => sprite.classList.remove('burn-applied'), 500);
                    } else if (status === 'paralyze' || status === 'paralysis') {
                        sprite.classList.add('paralyzed-applied');
                        setTimeout(() => sprite.classList.remove('paralyzed-applied'), 500);
                        if (window.CombatEffects?.playDebuffEffect) {
                            window.CombatEffects.playDebuffEffect(sprite);
                        }
                    } else if (status === 'bleed') {
                        sprite.classList.add('bleed-applied');
                        setTimeout(() => sprite.classList.remove('bleed-applied'), 500);
                    } else if (status === 'protection') {
                        sprite.classList.add('protection-applied');
                        setTimeout(() => sprite.classList.remove('protection-applied'), 500);
                    } else {
                        // Generic debuff animation (purple)
                        sprite.classList.add('debuff-applied');
                        setTimeout(() => sprite.classList.remove('debuff-applied'), 500);
                    }
                }
                
                // Show message
                const stacks = cmd.stacks || 1;
                const emoji = status === 'burn' ? '🔥' : status === 'bleed' ? '🩸' : status === 'paralyze' ? '⚡' : '💫';
                showMessage?.(`${emoji} ${status} ${stacks > 1 ? `x${stacks}` : ''} applied!`, 400);
                
                duration = 350;
                break;
            }
            
            // ==================== STATUS TICK ====================
            case 'statusTick': {
                const sprite = findSprite(cmd.targetOwner, cmd.targetCol, cmd.targetRow);
                const cryptid = findCryptid(cmd.targetOwner, cmd.targetCol, cmd.targetRow);
                const damage = cmd.damage || 0;
                const status = cmd.status || 'burn';
                
                if (sprite && damage > 0 && window.CombatEffects) {
                    // Show damage number for tick
                    if (cryptid) {
                        window.CombatEffects.showDamageNumber(cryptid, damage, false);
                    }
                    
                    // Visual feedback
                    sprite.classList.add(`${status}-tick`);
                    setTimeout(() => sprite.classList.remove(`${status}-tick`), 400);
                }
                
                duration = 300;
                break;
            }
            
            // ==================== STATUS REMOVE ====================
            case 'statusRemove': {
                const sprite = findSprite(cmd.targetOwner, cmd.targetCol, cmd.targetRow);
                
                if (sprite) {
                    sprite.classList.add('status-removed');
                    setTimeout(() => sprite.classList.remove('status-removed'), 400);
                }
                
                showMessage?.(`✨ ${cmd.status || 'Status'} removed`, 300);
                duration = 250;
                break;
            }
            
            // ==================== SUMMON ====================
            case 'summon': {
                const flippedCol = flipCol(cmd.col);
                const flippedOwner = flipOwner(cmd.owner);
                
                // Find sprite (may need to wait for DOM update)
                let attempts = 0;
                const findAndAnimate = () => {
                    const sprite = document.querySelector(
                        `.cryptid-sprite[data-owner="${flippedOwner}"][data-col="${flippedCol}"][data-row="${cmd.row}"]`
                    );
                    
                    if (sprite) {
                        if (window.CombatEffects?.playSummonAnimation) {
                            const element = cmd.element || sprite.className.match(/element-(\w+)/)?.[1] || 'steel';
                            const rarity = cmd.rarity || sprite.className.match(/rarity-(\w+)/)?.[1] || 'common';
                            window.CombatEffects.playSummonAnimation(sprite, element, rarity);
                        } else {
                            sprite.classList.add('summoning');
                            setTimeout(() => sprite.classList.remove('summoning'), 800);
                        }
                    } else if (attempts < 3) {
                        attempts++;
                        setTimeout(findAndAnimate, 50);
                    }
                };
                findAndAnimate();
                
                showMessage?.(`${flippedOwner === 'enemy' ? 'Opponent' : 'You'} summoned ${cmd.name || cmd.key}!`);
                duration = 850;
                break;
            }
            
            // ==================== PROMOTION ====================
            case 'promotion': {
                const flippedOwner = flipOwner(cmd.owner);
                
                // Just show message - don't renderAll() here!
                // Rendering mid-sequence would re-render dead cryptids before state is applied
                // The promotion slide will show when state is applied and final render happens
                showMessage?.(`⬆ Support promoted to combat!`, 400);
                
                duration = 400;
                break;
            }
            
            // ==================== EVOLUTION ====================
            case 'evolution': {
                const sprite = findSprite(cmd.owner, cmd.col, cmd.row);
                
                if (sprite && window.CombatEffects?.playEvolutionAnimation) {
                    const element = sprite.className.match(/element-(\w+)/)?.[1] || 'steel';
                    const rarity = sprite.className.match(/rarity-(\w+)/)?.[1] || 'uncommon';
                    window.CombatEffects.playEvolutionAnimation(sprite, element, rarity);
                } else if (sprite) {
                    sprite.classList.add('evolving');
                    setTimeout(() => sprite.classList.remove('evolving'), 1000);
                }
                
                showMessage?.(`🌟 Evolved into ${cmd.toName || cmd.toKey}!`);
                duration = 1100;
                break;
            }
            
            // ==================== SPELL CAST ====================
            case 'spellCast': {
                showMessage?.(`✨ ${cmd.cardName || 'Spell'} cast!`, 600);
                
                if (cmd.targetCol !== undefined && cmd.targetRow !== undefined) {
                    const sprite = findSprite(cmd.targetOwner, cmd.targetCol, cmd.targetRow);
                    if (sprite) {
                        if (window.CombatEffects?.playSpellEffect) {
                            window.CombatEffects.playSpellEffect(sprite, cmd.cardKey);
                        } else {
                            sprite.classList.add('spell-target');
                            setTimeout(() => sprite.classList.remove('spell-target'), 800);
                        }
                    }
                }
                
                duration = 700;
                break;
            }
            
            // ==================== AURA APPLY ====================
            case 'auraApply': {
                const sprite = findSprite(cmd.targetOwner, cmd.targetCol, cmd.targetRow);
                const battlefield = document.getElementById('battlefield-area');
                
                if (sprite && battlefield && window.CombatEffects?.playAuraEffect) {
                    const targetRect = sprite.getBoundingClientRect();
                    const battlefieldRect = battlefield.getBoundingClientRect();
                    const startX = targetRect.left + targetRect.width/2 - battlefieldRect.left;
                    const startY = 0;
                    const targetX = startX;
                    const targetY = targetRect.top + targetRect.height/2 - battlefieldRect.top;
                    
                    window.CombatEffects.playAuraEffect(startX, startY, targetX, targetY, sprite);
                } else if (sprite) {
                    sprite.classList.add('aura-target');
                    setTimeout(() => sprite.classList.remove('aura-target'), 1000);
                }
                
                showMessage?.(`💛 ${cmd.cardName || 'Aura'} applied!`, 600);
                duration = 1100;
                break;
            }
            
            // ==================== TRAP TRIGGER ====================
            case 'trapTrigger': {
                const row = cmd.row;
                const flippedOwner = flipOwner(cmd.owner);
                const trapSprite = document.querySelector(`.trap-sprite[data-owner="${flippedOwner}"][data-row="${row}"]`);
                
                if (trapSprite) {
                    trapSprite.classList.add('triggering');
                    setTimeout(() => trapSprite.classList.remove('triggering'), 500);
                }
                
                showMessage?.(`⚠ ${cmd.trapName || 'Trap'} triggered!`, 500);
                duration = 500;
                break;
            }
            
            // ==================== TRAP SET ====================
            case 'trapSet': {
                const flippedOwner = flipOwner(cmd.owner);
                const trapSprite = document.querySelector(`.trap-sprite[data-owner="${flippedOwner}"][data-row="${cmd.row}"]`);
                
                if (trapSprite) {
                    trapSprite.classList.add('spawning');
                    setTimeout(() => trapSprite.classList.remove('spawning'), 500);
                }
                
                showMessage?.(`${flippedOwner === 'enemy' ? 'Opponent' : 'You'} set a trap!`);
                duration = 600;
                break;
            }
            
            // ==================== PYRE CARD PLAYED ====================
            case 'pyreCard': {
                const flippedOwner = flipOwner(cmd.owner);
                const pyreGained = cmd.pyreGained || 1;
                const cardName = cmd.cardName || 'Pyre card';
                
                // Show message
                showMessage?.(`🔥 ${cardName}: +${pyreGained} Pyre`, 1200);
                
                // Play pyre burn animation if available
                if (window.CombatEffects?.playPyreBurn) {
                    window.CombatEffects.playPyreBurn(null, pyreGained);
                }
                
                // Flash pyre display
                const pyreDisplay = document.querySelector(`.player-info.${flippedOwner} .pyre-display`);
                if (pyreDisplay) {
                    pyreDisplay.classList.add('pyre-gained');
                    setTimeout(() => pyreDisplay.classList.remove('pyre-gained'), 600);
                }
                
                duration = 800;
                break;
            }
            
            // ==================== PYRE CHANGE ====================
            case 'pyreChange': {
                const flippedOwner = flipOwner(cmd.owner);
                const pyreDisplay = document.querySelector(`.player-info.${flippedOwner} .pyre-display`);
                
                if (pyreDisplay) {
                    if (cmd.amount > 0) {
                        pyreDisplay.classList.add('pyre-gained');
                        setTimeout(() => pyreDisplay.classList.remove('pyre-gained'), 400);
                    } else {
                        pyreDisplay.classList.add('pyre-spent');
                        setTimeout(() => pyreDisplay.classList.remove('pyre-spent'), 400);
                    }
                }
                
                duration = 200;
                break;
            }
            
            // ==================== MESSAGE ====================
            case 'message': {
                showMessage?.(cmd.text, cmd.duration || 1000);
                duration = Math.min(cmd.duration || 1000, 500); // Don't wait full message time
                break;
            }
            
            // ==================== DELAY ====================
            case 'delay': {
                duration = cmd.duration || 100;
                break;
            }
            
            default: {
                console.log('[MP Seq] Unknown command type:', type, cmd);
                duration = 50;
            }
        }
        
        return duration;
    },
    
    /**
     * Play animation for a single event
     * Returns the duration of the animation in ms
     */
    playEventAnimation(event) {
        const self = this;
        const type = event.type;
        const data = event.data || {};
        const g = window.game;
        
        // Helper to flip perspective (their player = our enemy, their enemy = our player)
        const flipOwner = (owner) => owner === 'player' ? 'enemy' : 'player';
        const flipCol = (col) => col !== undefined ? 1 - col : undefined;
        
        // Helper to find sprite by position
        const findSprite = (owner, col, row) => {
            const flippedOwner = flipOwner(owner);
            const flippedCol = flipCol(col);
            return document.querySelector(
                `.cryptid-sprite[data-owner="${flippedOwner}"][data-col="${flippedCol}"][data-row="${row}"]`
            );
        };
        
        // Helper to find cryptid by position
        const findCryptid = (owner, col, row) => {
            const flippedOwner = flipOwner(owner);
            const flippedCol = flipCol(col);
            const field = flippedOwner === 'player' ? g?.playerField : g?.enemyField;
            return field?.[flippedCol]?.[row];
        };
        
        // Default duration for unknown events
        let duration = 100;
        
        switch (type) {
            // === DAMAGE & COMBAT ===
            
            case 'onDamageTaken': {
                const target = data.target;
                if (!target) break;
                
                const sprite = findSprite(target.owner, target.col, target.row);
                const cryptid = findCryptid(target.owner, target.col, target.row);
                const damage = data.damage || 0;
                
                if (sprite && window.CombatEffects) {
                    // Show damage number
                    if (cryptid && damage > 0) {
                        window.CombatEffects.showDamageNumber(cryptid, damage, damage >= 5);
                    }
                    
                    // Impact effects
                    const battlefield = document.getElementById('battlefield-area');
                    if (battlefield) {
                        const rect = sprite.getBoundingClientRect();
                        const bfRect = battlefield.getBoundingClientRect();
                        const x = rect.left + rect.width/2 - bfRect.left;
                        const y = rect.top + rect.height/2 - bfRect.top;
                        
                        window.CombatEffects.createImpactFlash?.(x, y, 60 + damage * 8);
                        window.CombatEffects.createSparks?.(x, y, 6 + damage);
                        window.CombatEffects.heavyImpact?.(Math.min(damage, 5));
                    }
                    
                    // Hit recoil
                    sprite.classList.add('hit-recoil');
                    setTimeout(() => sprite.classList.remove('hit-recoil'), 250);
                }
                duration = 300;
                break;
            }
            
            case 'onHit': {
                // Impact moment - damage number shown by onDamageTaken
                duration = 50; // Part of damage sequence
                break;
            }
            
            case 'onCleaveDamage':
            case 'onKuchisakeExplosion':
            case 'onMolemanSplash':
            case 'onMultiAttackDamage':
            case 'onSnipeDamage': {
                const target = data.target || data.cleaveTarget || data.splashTarget || data.explosionTarget;
                if (!target) break;
                
                const sprite = findSprite(target.owner, target.col, target.row);
                const cryptid = findCryptid(target.owner, target.col, target.row);
                const damage = data.damage || data.splashDamage || data.explosionDamage || 0;
                
                if (sprite && window.CombatEffects && cryptid && damage > 0) {
                    window.CombatEffects.showDamageNumber(cryptid, damage, false);
                    
                    sprite.classList.add('hit-recoil');
                    setTimeout(() => sprite.classList.remove('hit-recoil'), 250);
                }
                
                // Show message for special damage types
                if (type === 'onKuchisakeExplosion') {
                    showMessage(`💥 Explosion: ${damage} damage!`, 500);
                } else if (type === 'onMolemanSplash') {
                    showMessage(`🌊 Splash: ${damage} damage!`, 500);
                }
                
                duration = 350;
                break;
            }
            
            case 'onDestroyerDamage': {
                const target = data.target;
                const damage = data.damage || 0;
                
                if (target) {
                    const sprite = findSprite(target.owner, target.col, target.row);
                    const cryptid = findCryptid(target.owner, target.col, target.row);
                    
                    showMessage(`💥 Destroyer: ${damage} piercing damage!`, 600);
                    
                    if (sprite && cryptid && window.CombatEffects) {
                        window.CombatEffects.showDamageNumber(cryptid, damage, true);
                        window.CombatEffects.heavyImpact?.(damage);
                        
                        sprite.classList.add('destroyer-hit');
                        setTimeout(() => sprite.classList.remove('destroyer-hit'), 400);
                    }
                }
                duration = 500;
                break;
            }
            
            case 'onDestroyerResidue': {
                const targetRow = data.targetRow;
                const damage = data.overkillDamage || 0;
                
                // Create the danger zone visual
                if (window.CombatEffects?.createDestroyerResidue) {
                    const flippedOwner = flipOwner(data.targetOwner || 'enemy');
                    const combatCol = g?.getCombatCol(flippedOwner);
                    window.CombatEffects.createDestroyerResidue(flippedOwner, combatCol, targetRow, damage);
                }
                duration = 300;
                break;
            }
            
            case 'onBleedDamage':
            case 'onToxicDamage': {
                const target = data.target;
                const damage = data.bonusDamage || 1;
                
                if (target) {
                    const sprite = findSprite(target.owner, target.col, target.row);
                    const cryptid = findCryptid(target.owner, target.col, target.row);
                    
                    const emoji = type === 'onBleedDamage' ? '🩸' : '☠';
                    showMessage(`${emoji} +${damage} bonus damage!`, 400);
                    
                    if (sprite && cryptid && window.CombatEffects) {
                        window.CombatEffects.showDamageNumber(cryptid, damage, false);
                    }
                }
                duration = 250;
                break;
            }
            
            // === HEALING ===
            
            case 'onHeal': {
                const cryptid = data.cryptid;
                const amount = data.amount || 0;
                
                if (cryptid && amount > 0) {
                    const sprite = findSprite(cryptid.owner, cryptid.col, cryptid.row);
                    const cryptidObj = findCryptid(cryptid.owner, cryptid.col, cryptid.row);
                    
                    if (sprite && cryptidObj && window.CombatEffects?.showHealNumber) {
                        window.CombatEffects.showHealNumber(cryptidObj, amount);
                    }
                    
                    if (sprite) {
                        sprite.classList.add('healing');
                        setTimeout(() => sprite.classList.remove('healing'), 400);
                    }
                }
                duration = 350;
                break;
            }
            
            case 'onLifesteal': {
                const attacker = data.attacker;
                const amount = data.healAmount || data.amount || 0;
                
                showMessage(`🧛 Lifesteal: +${amount} HP!`, 500);
                
                if (attacker && amount > 0) {
                    const sprite = findSprite(attacker.owner, attacker.col, attacker.row);
                    const cryptidObj = findCryptid(attacker.owner, attacker.col, attacker.row);
                    
                    if (sprite && cryptidObj && window.CombatEffects?.showHealNumber) {
                        window.CombatEffects.showHealNumber(cryptidObj, amount);
                    }
                }
                duration = 400;
                break;
            }
            
            // === DEATH ===
            
            case 'onDeath':
            case 'onKill': {
                const victim = data.cryptid || data.victim;
                if (!victim) break;
                
                // Skip if marked as pending (will be handled elsewhere)
                if (data.pendingAnimation) break;
                
                const sprite = findSprite(victim.owner, victim.col, victim.row);
                
                if (sprite && window.CombatEffects?.playDramaticDeath) {
                    const rarity = sprite.className.match(/rarity-(\w+)/)?.[1] || 'common';
                    const flippedOwner = flipOwner(victim.owner);
                    window.CombatEffects.playDramaticDeath(sprite, flippedOwner, rarity);
                    duration = 900;
                } else if (sprite) {
                    const dir = flipOwner(victim.owner) === 'player' ? 'left' : 'right';
                    sprite.classList.add(`dying-${dir}`);
                    duration = 800;
                }
                break;
            }
            
            case 'onGargoyleSave': {
                const gargoyle = data.gargoyle || data.card;
                const saved = data.saved || data.combatant;
                
                if (gargoyle) {
                    showMessage(`🗿 ${gargoyle.name || 'Gargoyle'} sacrificed itself!`, 600);
                    
                    const sprite = findSprite(gargoyle.owner, gargoyle.col, gargoyle.row);
                    if (sprite && window.CombatEffects?.playDramaticDeath) {
                        const rarity = sprite.className.match(/rarity-(\w+)/)?.[1] || 'common';
                        window.CombatEffects.playDramaticDeath(sprite, flipOwner(gargoyle.owner), rarity);
                    }
                }
                duration = 800;
                break;
            }
            
            case 'onCalamityDeath': {
                const cryptid = data.cryptid;
                
                if (cryptid) {
                    showMessage(`💀 ${cryptid.name || 'Cryptid'} succumbs to Calamity!`, 700);
                    
                    const sprite = findSprite(cryptid.owner, cryptid.col, cryptid.row);
                    if (sprite && window.CombatEffects?.playDramaticDeath) {
                        const rarity = sprite.className.match(/rarity-(\w+)/)?.[1] || 'common';
                        window.CombatEffects.playDramaticDeath(sprite, flipOwner(cryptid.owner), rarity);
                    }
                }
                duration = 900;
                break;
            }
            
            // === STATUS EFFECTS ===
            
            case 'onStatusApplied': {
                const cryptid = data.cryptid;
                const status = data.status;
                
                if (!cryptid || !status) break;
                
                const sprite = findSprite(cryptid.owner, cryptid.col, cryptid.row);
                
                const statusEmojis = {
                    burn: '🔥', paralyze: '⚡', bleed: '🩸', 
                    calamity: '💀', curse: '☠', protection: '🛡'
                };
                const emoji = statusEmojis[status] || '✨';
                const msg = data.refreshed ? `${emoji} ${status} refreshed!` : `${emoji} ${status} applied!`;
                showMessage(msg, 500);
                
                if (sprite) {
                    sprite.classList.add(`${status}-applied`);
                    setTimeout(() => sprite.classList.remove(`${status}-applied`), 600);
                    
                    if (window.CombatEffects?.playDebuffEffect && status !== 'protection') {
                        window.CombatEffects.playDebuffEffect(sprite);
                    }
                }
                duration = 400;
                break;
            }
            
            case 'onStatusWearOff': {
                const cryptid = data.cryptid;
                const status = data.status;
                
                if (cryptid && status) {
                    showMessage(`✨ ${status} wore off!`, 400);
                }
                duration = 200;
                break;
            }
            
            case 'onBurnDamage': {
                const cryptid = data.cryptid;
                const damage = data.damage || 1;
                
                if (cryptid) {
                    const sprite = findSprite(cryptid.owner, cryptid.col, cryptid.row);
                    const cryptidObj = findCryptid(cryptid.owner, cryptid.col, cryptid.row);
                    
                    showMessage(`🔥 Burn: ${damage} damage!`, 500);
                    
                    if (sprite) {
                        sprite.classList.add('burning-tick');
                        setTimeout(() => sprite.classList.remove('burning-tick'), 500);
                    }
                    
                    if (cryptidObj && window.CombatEffects) {
                        window.CombatEffects.showDamageNumber(cryptidObj, damage, false);
                    }
                }
                duration = 450;
                break;
            }
            
            case 'onCalamityTick': {
                const cryptid = data.cryptid;
                const remaining = data.countersRemaining || 0;
                
                if (cryptid) {
                    showMessage(`💀 Calamity: ${remaining} turns remaining!`, 500);
                    
                    const sprite = findSprite(cryptid.owner, cryptid.col, cryptid.row);
                    if (sprite) {
                        sprite.classList.add('calamity-tick');
                        setTimeout(() => sprite.classList.remove('calamity-tick'), 500);
                    }
                }
                duration = 400;
                break;
            }
            
            case 'onCleanse': {
                const cryptid = data.cryptid;
                const count = data.count || 1;
                
                if (cryptid) {
                    showMessage(`✨ Cleansed ${count} status effect(s)!`, 500);
                    
                    const sprite = findSprite(cryptid.owner, cryptid.col, cryptid.row);
                    if (sprite) {
                        sprite.classList.add('cleansed');
                        setTimeout(() => sprite.classList.remove('cleansed'), 600);
                    }
                }
                duration = 400;
                break;
            }
            
            case 'onAilmentBlocked': {
                const cryptid = data.cryptid;
                const ailment = data.ailment;
                const source = data.source;
                
                if (cryptid && ailment) {
                    showMessage(`🦋 ${source || 'Immunity'} blocked ${ailment}!`, 500);
                }
                duration = 300;
                break;
            }
            
            case 'onProtectionBlock': {
                const target = data.target;
                
                if (target) {
                    showMessage(`🛡 Protection absorbed the hit!`, 500);
                    
                    const sprite = findSprite(target.owner, target.col, target.row);
                    if (sprite) {
                        sprite.classList.add('protection-block');
                        setTimeout(() => sprite.classList.remove('protection-block'), 600);
                    }
                }
                duration = 400;
                break;
            }
            
            // === TRAPS ===
            
            case 'onTrapTriggered': {
                const trap = data.trap;
                const owner = data.owner;
                const row = data.row;
                
                if (trap) {
                    showMessage(`⚡ ${trap.name || 'Trap'} triggered!`, 700);
                    
                    const flippedOwner = flipOwner(owner);
                    const trapSprite = document.querySelector(`.trap-sprite[data-owner="${flippedOwner}"][data-row="${row}"]`);
                    
                    if (trapSprite) {
                        trapSprite.classList.add('trap-triggering');
                        setTimeout(() => trapSprite.classList.remove('trap-triggering'), 800);
                    }
                    
                    // Flash the battlefield
                    const battlefield = document.getElementById('battlefield-area');
                    if (battlefield) {
                        battlefield.classList.add('trap-flash');
                        setTimeout(() => battlefield.classList.remove('trap-flash'), 400);
                    }
                }
                duration = 700;
                break;
            }
            
            case 'onTrapSet': {
                showMessage(`Opponent set a trap!`, 500);
                duration = 300;
                break;
            }
            
            case 'onTerrify': {
                const attacker = data.attacker;
                
                if (attacker) {
                    showMessage(`😱 Terrify! ${attacker.name || 'Attacker'}'s ATK reduced to 0!`, 700);
                    
                    const sprite = findSprite(attacker.owner, attacker.col, attacker.row);
                    if (sprite) {
                        sprite.classList.add('terrified');
                        setTimeout(() => sprite.classList.remove('terrified'), 600);
                    }
                }
                duration = 600;
                break;
            }
            
            // === SUMMONING & FIELD ===
            
            case 'onSummon': {
                const cryptid = data.cryptid;
                const owner = data.owner;
                const col = data.col;
                const row = data.row;
                
                // Only show animation for opponent's summons (we see our own already)
                if (owner !== 'player') break;
                
                const sprite = findSprite(owner, col, row);
                
                if (sprite && window.CombatEffects?.playSummonAnimation) {
                    const element = sprite.className.match(/element-(\w+)/)?.[1] || 'steel';
                    const rarity = sprite.className.match(/rarity-(\w+)/)?.[1] || 'common';
                    window.CombatEffects.playSummonAnimation(sprite, element, rarity);
                    duration = 850;
                } else if (sprite) {
                    sprite.classList.add('summoning');
                    setTimeout(() => sprite.classList.remove('summoning'), 850);
                    duration = 850;
                }
                break;
            }
            
            case 'onEnterCombat': {
                const cryptid = data.cryptid;
                const source = data.source;
                
                // Only animate if it's a promotion or special entry
                if (source === 'promotion') {
                    showMessage(`⬆ ${cryptid?.name || 'Support'} promoted to combat!`, 500);
                }
                duration = 200;
                break;
            }
            
            case 'onPromotion': {
                const cryptid = data.cryptid;
                
                if (cryptid) {
                    // The render will handle the visual slide
                    showMessage(`⬆ ${cryptid.name || 'Support'} promoted!`, 400);
                }
                duration = 350;
                break;
            }
            
            case 'onEvolution': {
                const evolved = data.evolved;
                const owner = data.owner;
                const col = data.col;
                const row = data.row;
                
                if (owner !== 'player') break;
                
                const sprite = findSprite(owner, col, row);
                
                if (sprite && window.CombatEffects?.playEvolutionAnimation) {
                    const element = sprite.className.match(/element-(\w+)/)?.[1] || 'steel';
                    const rarity = sprite.className.match(/rarity-(\w+)/)?.[1] || 'uncommon';
                    window.CombatEffects.playEvolutionAnimation(sprite, element, rarity);
                    duration = 1000;
                } else if (sprite) {
                    sprite.classList.add('evolving');
                    setTimeout(() => sprite.classList.remove('evolving'), 1000);
                    duration = 1000;
                }
                
                showMessage(`✨ Evolved into ${evolved?.name || 'new form'}!`, 600);
                break;
            }
            
            // === AURAS & BUFFS ===
            
            case 'onAuraApplied': {
                const cryptid = data.cryptid;
                const aura = data.aura;
                
                if (cryptid && aura) {
                    showMessage(`✨ ${aura.name || 'Aura'} applied to ${cryptid.name}!`, 500);
                    
                    const sprite = findSprite(cryptid.owner, cryptid.col, cryptid.row);
                    if (sprite) {
                        sprite.classList.add('aura-target');
                        setTimeout(() => sprite.classList.remove('aura-target'), 800);
                    }
                }
                duration = 500;
                break;
            }
            
            case 'onLatch': {
                const attacker = data.attacker;
                const target = data.target;
                
                if (attacker && target) {
                    showMessage(`🔗 ${attacker.name || 'Cryptid'} latched onto ${target.name}!`, 600);
                }
                duration = 400;
                break;
            }
            
            case 'onGremlinAtkDebuff':
            case 'onGremlinHalfDamage':
            case 'onGremlinDamageReduction':
            case 'onStoneBastionHalfDamage':
            case 'onDamageReduced': {
                const reduced = data.reducedDamage ?? data.damage;
                const original = data.originalDamage ?? reduced;
                
                if (reduced !== undefined && reduced < original) {
                    showMessage(`🛡 Damage reduced: ${original} → ${reduced}`, 400);
                }
                duration = 250;
                break;
            }
            
            // === PYRE ===
            
            case 'onPyreGained': {
                const owner = data.owner;
                const amount = data.amount || 0;
                const source = data.source;
                
                if (owner === 'player' && amount > 0) {
                    // Opponent gained pyre
                    const sourceText = source ? ` from ${source}` : '';
                    showMessage(`🔥 Opponent +${amount} Pyre${sourceText}`, 400);
                }
                duration = 200;
                break;
            }
            
            case 'onPyreSpent': {
                // Usually silent - the card play message covers this
                duration = 50;
                break;
            }
            
            // === CARD ABILITIES ===
            
            case 'onCardCallback': {
                const cbType = data.type;
                const card = data.card;
                const owner = data.owner;
                
                // Only show ability activations for opponent's cards
                if (owner !== 'player') break;
                
                // Different messages based on callback type
                if (cbType === 'onKill') {
                    showMessage(`⚔ ${card?.name || 'Cryptid'}'s kill trigger!`, 400);
                } else if (cbType === 'onDeath') {
                    showMessage(`💀 ${card?.name || 'Cryptid'}'s death trigger!`, 400);
                } else if (cbType === 'onCombat' || cbType === 'onEnterCombat') {
                    showMessage(`⚔ ${card?.name || 'Cryptid'} enters combat!`, 400);
                }
                // Other callback types are usually implicit
                duration = 300;
                break;
            }
            
            case 'onActivatedAbility': {
                const ability = data.ability;
                const card = data.card;
                
                if (card && ability) {
                    const abilityNames = {
                        sacrifice: 'Am I Pretty?',
                        bloodPact: 'Blood Pact',
                        thermalSwap: 'Thermal Swap',
                        rageHeal: 'Rage Heal'
                    };
                    showMessage(`✨ ${card.name} used ${abilityNames[ability] || ability}!`, 600);
                }
                duration = 400;
                break;
            }
            
            case 'onMylingBurn': {
                showMessage(`🔥 Myling triggered burn!`, 400);
                duration = 300;
                break;
            }
            
            case 'onPackGrowth':
            case 'onPackLeaderBuff': {
                showMessage(`🐺 Pack synergy activated!`, 400);
                duration = 250;
                break;
            }
            
            case 'onDeathWatchDraw': {
                showMessage(`👁 Death Watch: Card drawn!`, 400);
                duration = 300;
                break;
            }
            
            case 'onSkinwalkerInherit': {
                const source = data.source;
                showMessage(`🔄 Skinwalker inherited abilities from ${source?.name || 'fallen'}!`, 500);
                duration = 400;
                break;
            }
            
            case 'onInsatiableHunger': {
                const attacker = data.attacker;
                showMessage(`🍖 Insatiable Hunger: ATK → ${attacker?.newAtk || attacker?.currentAtk}!`, 500);
                duration = 350;
                break;
            }
            
            // === ATTACK EVENTS ===
            
            case 'onAttackDeclared': {
                const attacker = data.attacker;
                const target = data.target;
                
                // This marks the start of an attack - main animation handles visuals
                // Just log for debugging
                console.log('[MP Playback] Attack declared:', attacker?.name, '->', target?.name);
                duration = 50;
                break;
            }
            
            case 'onAttackNegated': {
                showMessage(`❌ Attack negated!`, 500);
                duration = 400;
                break;
            }
            
            case 'onAttackComplete': {
                // Attack finished - usually implicit
                duration = 50;
                break;
            }
            
            // === SPELLS ===
            
            case 'onSpellCast':
            case 'onBurstPlayed': {
                const card = data.card;
                
                if (card) {
                    showMessage(`✧ ${card.name} ✧`, 600);
                }
                duration = 200;
                break;
            }
            
            case 'onPyreCardPlayed': {
                const card = data.card;
                const pyreGained = data.pyreGained || 0;
                
                if (card) {
                    showMessage(`🔥 ${card.name}: +${pyreGained} Pyre`, 500);
                }
                duration = 300;
                break;
            }
            
            // === MISC ===
            
            case 'onCardDrawn': {
                const owner = data.owner;
                
                if (owner === 'player') {
                    // Opponent drew a card
                    showMessage(`📜 Opponent drew a card`, 300);
                }
                duration = 150;
                break;
            }
            
            case 'onSnipeReveal': {
                const cryptid = data.cryptid;
                
                if (cryptid) {
                    showMessage(`👁 Snipe revealed ${cryptid.name}!`, 500);
                }
                duration = 350;
                break;
            }
            
            case 'onHuntSteal': {
                const amount = data.stolenPyre || 0;
                
                showMessage(`🏹 Hunt Trap stole ${amount} Pyre!`, 600);
                duration = 450;
                break;
            }
            
            // === MISSING HANDLERS - Added for complete multiplayer sync ===
            
            case 'onBonusVsBurning': {
                const bonus = data.bonus || 0;
                const targetName = data.target?.name || 'target';
                showMessage(`🔥 +${bonus} bonus damage vs burning ${targetName}!`, 400);
                duration = 250;
                break;
            }
            
            case 'onCombatantDeath': {
                // Combatant died - support may trigger abilities
                // The actual death animation is handled by onDeath/onKill
                const cryptid = data.cryptid;
                if (cryptid) {
                    console.log('[MP Playback] Combatant death:', cryptid.name);
                }
                duration = 50; // Minimal - death visuals handled elsewhere
                break;
            }
            
            case 'onCurseCleanse': {
                const cryptid = data.cryptid;
                const remaining = data.tokensRemaining || 0;
                if (cryptid) {
                    if (remaining > 0) {
                        showMessage(`☠ Curse cleansed: ${remaining} tokens remain`, 400);
                    } else {
                        showMessage(`✨ Curse fully cleansed!`, 400);
                    }
                    const sprite = findSprite(cryptid.owner, cryptid.col, cryptid.row);
                    if (sprite) {
                        sprite.classList.add('cleansed');
                        setTimeout(() => sprite.classList.remove('cleansed'), 500);
                    }
                }
                duration = 300;
                break;
            }
            
            case 'onProtectionRemoved': {
                const cryptid = data.cryptid;
                const remaining = data.remaining || 0;
                if (cryptid) {
                    const sprite = findSprite(cryptid.owner, cryptid.col, cryptid.row);
                    if (sprite) {
                        sprite.classList.add('protection-consumed');
                        setTimeout(() => sprite.classList.remove('protection-consumed'), 400);
                    }
                    if (remaining > 0) {
                        showMessage(`🛡 Protection: ${remaining} charges left`, 350);
                    } else {
                        showMessage(`🛡 Protection depleted!`, 350);
                    }
                }
                duration = 250;
                break;
            }
            
            case 'onToxicApplied': {
                const owner = data.owner;
                const col = data.col;
                const row = data.row;
                const flippedOwner = flipOwner(owner);
                const flippedCol = flipCol(col);
                showMessage(`☠ Toxic applied to tile!`, 400);
                // Visual handled by render - just acknowledge
                duration = 250;
                break;
            }
            
            case 'onToxicFade': {
                showMessage(`✨ Toxic faded`, 300);
                duration = 200;
                break;
            }
            
            case 'onTrapDestroyed': {
                const trap = data.trap;
                const trapName = trap?.name || 'Trap';
                showMessage(`💥 ${trapName} destroyed!`, 500);
                duration = 350;
                break;
            }
            
            case 'onTrapProtected': {
                const trap = data.trap;
                const trapName = trap?.name || 'Trap';
                showMessage(`🛡 ${trapName} protected from destruction!`, 500);
                duration = 350;
                break;
            }
            
            case 'onAuraRemoved': {
                const cryptid = data.cryptid;
                const aura = data.aura;
                const auraName = aura?.name || 'Aura';
                if (cryptid) {
                    showMessage(`✨ ${auraName} expired from ${cryptid.name}`, 400);
                    const sprite = findSprite(cryptid.owner, cryptid.col, cryptid.row);
                    if (sprite) {
                        sprite.classList.add('aura-removed');
                        setTimeout(() => sprite.classList.remove('aura-removed'), 400);
                    }
                }
                duration = 300;
                break;
            }
            
            case 'onTargeted': {
                // Something was targeted - brief visual indicator
                const target = data.target;
                if (target) {
                    const sprite = findSprite(target.owner, target.col, target.row);
                    if (sprite) {
                        sprite.classList.add('being-targeted');
                        setTimeout(() => sprite.classList.remove('being-targeted'), 300);
                    }
                }
                duration = 100; // Quick indicator
                break;
            }
            
            default: {
                // Unknown event - log it for debugging
                console.log('[MP Playback] Unknown event type:', type, data);
                duration = 50;
            }
        }
        
        return duration;
    },
    
    // Legacy playAnimation kept for backwards compatibility with old messages
    playAnimation(action, onComplete, state = null) {
        // Capture 'this' for use in nested functions
        const self = this;
        
        // Timing constants - increased to match game-core.js TIMING + network buffer
        const TIMING = {
            summon: 950,      // summonAnim is ~850ms + network buffer
            attack: 1000,     // attackAnim is ~700ms + damage effects + buffer
            spell: 1100,      // spellTargetPulse is 0.9s + buffer
            death: 1000,      // dying animation is ~900ms + buffer
            evolve: 1100,     // evolveAnim is 1s + buffer
            trap: 700,        // trapSpawn is 0.5s + buffer
            aura: 1100,       // auraTargetShimmer + buffer
            message: 900      // Message display time
        };
        
        // Safety wrapper for onComplete
        const safeComplete = () => {
            try {
                onComplete();
            } catch (e) {
                console.error('[MP] Animation complete error:', e);
            }
        };
        
        switch (action.type) {
            case 'summon': {
                showMessage('Opponent summoned ' + (action.cardName || action.cardKey) + '!');
                
                // Find the newly summoned sprite and add summon animation
                const col = 1 - action.col; // Column flip for opponent view
                // Try multiple times to find element (DOM may still be updating)
                let attempts = 0;
                const findAndAnimate = () => {
                    const sprite = document.querySelector(`.cryptid-sprite[data-owner="enemy"][data-col="${col}"][data-row="${action.row}"]`);
                    if (sprite) {
                        // Use enhanced summon animation if available
                        if (window.CombatEffects?.playSummonAnimation) {
                            const element = sprite.className.match(/element-(\w+)/)?.[1] || 'steel';
                            const rarity = sprite.className.match(/rarity-(\w+)/)?.[1] || 'common';
                            window.CombatEffects.playSummonAnimation(sprite, element, rarity);
                        } else {
                            sprite.classList.add('summoning');
                            setTimeout(() => sprite.classList.remove('summoning'), TIMING.summon);
                        }
                        
                        // Play on-enter-combat effects after summon animation settles
                        if (action.onEnterCombatEffect) {
                            setTimeout(() => {
                                self.playOnEnterCombatEffect(action.onEnterCombatEffect, action.row);
                            }, TIMING.summon - 200);
                        }
                    } else if (attempts < 3) {
                        attempts++;
                        setTimeout(findAndAnimate, 50);
                    }
                };
                findAndAnimate();
                
                // Calculate total delay based on effects
                let summonDelay = TIMING.summon;
                if (action.onEnterCombatEffect) summonDelay += 600;
                
                setTimeout(safeComplete, summonDelay);
                break;
            }
            
            case 'attack': {
                const atkCol = 1 - action.attackerCol;
                const tgtCol = 1 - action.targetCol;
                const g = window.game;
                
                const atkSprite = document.querySelector(`.cryptid-sprite[data-owner="enemy"][data-col="${atkCol}"][data-row="${action.attackerRow}"]`);
                const tgtSprite = document.querySelector(`.cryptid-sprite[data-owner="player"][data-col="${tgtCol}"][data-row="${action.targetRow}"]`);
                
                // Get target cryptid for damage number display
                const targetCryptid = g?.playerField[tgtCol]?.[action.targetRow];
                const damage = action.damage || 0;
                
                // Calculate total delay based on effects
                let totalDelay = TIMING.attack;
                if (action.targetDied) totalDelay += 800;
                if (action.explosionInfo) totalDelay += action.explosionInfo.targets.length * 600;
                if (action.destroyerInfo) totalDelay += 500;
                if (action.supportDied && !action.destroyerInfo) totalDelay += 400;
                if (action.statusEffects?.length > 0) totalDelay += action.statusEffects.length * 400;
                
                // Helper to play impact effects (damage number, particles, shake)
                const playImpactEffects = () => {
                    if (window.CombatEffects && tgtSprite) {
                        const battlefield = document.getElementById('battlefield-area');
                        if (battlefield) {
                            const targetRect = tgtSprite.getBoundingClientRect();
                            const battlefieldRect = battlefield.getBoundingClientRect();
                            const impactX = targetRect.left + targetRect.width/2 - battlefieldRect.left;
                            const impactY = targetRect.top + targetRect.height/2 - battlefieldRect.top;
                            
                            // Screen shake and particles
                            window.CombatEffects.heavyImpact(Math.max(damage, 1));
                            window.CombatEffects.createImpactFlash(impactX, impactY, 80 + damage * 10);
                            window.CombatEffects.createSparks(impactX, impactY, 10 + damage * 2);
                            window.CombatEffects.createImpactParticles(impactX, impactY, action.targetDied ? '#ff2222' : '#ff6666', 8 + damage);
                            
                            // Show damage number on our cryptid
                            if (targetCryptid && damage > 0) {
                                const isCrit = damage >= 5;
                                window.CombatEffects.showDamageNumber(targetCryptid, damage, isCrit);
                            }
                        }
                    }
                    
                    // Hit recoil if not killed
                    if (tgtSprite && !action.targetDied) {
                        tgtSprite.classList.add('hit-recoil');
                        setTimeout(() => tgtSprite.classList.remove('hit-recoil'), 250);
                    }
                    
                    // Play status effect animations if any were applied
                    if (action.statusEffects && action.statusEffects.length > 0 && tgtSprite) {
                        setTimeout(() => {
                            self.playStatusEffectAnimations(tgtSprite, action.statusEffects);
                        }, 200);
                    }
                };
                
                // Use enhanced attack animation if available
                if (window.CombatEffects?.playEnhancedAttack && atkSprite) {
                    window.CombatEffects.playEnhancedAttack(atkSprite, 'enemy', tgtSprite, damage, 
                        // onImpact - damage effects
                        () => {
                            playImpactEffects();
                            
                            // Show death animation if target died
                            if (action.targetDied && tgtSprite && window.CombatEffects?.playDramaticDeath) {
                                const rarity = tgtSprite.className.match(/rarity-(\w+)/)?.[1] || 'common';
                                window.CombatEffects.playDramaticDeath(tgtSprite, 'player', rarity);
                            }
                            
                            // Process explosion chain if present (Kuchisake ability)
                            if (action.explosionInfo && action.explosionInfo.targets?.length > 0) {
                                self.playExplosionChain(action.explosionInfo, action.targetRow, () => {
                                    // After explosions, process destroyer if present
                                    if (action.destroyerInfo) {
                                        self.playDestroyerDamage(action.destroyerInfo);
                                    }
                                });
                            } 
                            // Handle standalone destroyer (no explosion)
                            else if (action.destroyerInfo) {
                                setTimeout(() => {
                                    self.playDestroyerDamage(action.destroyerInfo);
                                }, action.targetDied ? 600 : 200);
                            }
                            // Handle support death from cleave (no destroyer)
                            else if (action.supportDied) {
                                const supportCol = tgtCol === 1 ? 0 : 1;
                                const supportSprite = document.querySelector(`.cryptid-sprite[data-owner="player"][data-col="${supportCol}"][data-row="${action.targetRow}"]`);
                                if (supportSprite && window.CombatEffects?.playDramaticDeath) {
                                    setTimeout(() => {
                                        const supportRarity = supportSprite.className.match(/rarity-(\w+)/)?.[1] || 'common';
                                        window.CombatEffects.playDramaticDeath(supportSprite, 'player', supportRarity);
                                    }, 200);
                                }
                            }
                        },
                        // onComplete
                        null
                    );
                } else {
                    // Fallback to basic animation
                    if (atkSprite) {
                        atkSprite.classList.add('attacking-left');
                        setTimeout(() => atkSprite.classList.remove('attacking-left'), TIMING.attack);
                    }
                    
                    setTimeout(() => {
                        playImpactEffects();
                        
                        if (action.targetDied && tgtSprite) {
                            setTimeout(() => tgtSprite.classList.add('dying-left'), 300);
                        }
                        
                        // Process explosion chain if present
                        if (action.explosionInfo && action.explosionInfo.targets?.length > 0) {
                            self.playExplosionChain(action.explosionInfo, action.targetRow, () => {
                                if (action.destroyerInfo) {
                                    self.playDestroyerDamage(action.destroyerInfo);
                                }
                            });
                        } else if (action.destroyerInfo) {
                            setTimeout(() => self.playDestroyerDamage(action.destroyerInfo), 400);
                        } else if (action.supportDied) {
                            const supportCol = tgtCol === 1 ? 0 : 1;
                            const supportSprite = document.querySelector(`.cryptid-sprite[data-owner="player"][data-col="${supportCol}"][data-row="${action.targetRow}"]`);
                            if (supportSprite) {
                                setTimeout(() => supportSprite.classList.add('dying-left'), 400);
                            }
                        }
                        
                        // Status effects in fallback path too
                        if (action.statusEffects && action.statusEffects.length > 0 && tgtSprite) {
                            setTimeout(() => {
                                self.playStatusEffectAnimations(tgtSprite, action.statusEffects);
                            }, 200);
                        }
                    }, 250);
                }
                
                setTimeout(safeComplete, totalDelay);
                break;
            }
            
            case 'burst': {
                showMessage('Opponent cast ' + (action.cardName || action.cardKey) + '!');
                
                // Add spell effect to target if specified
                if (action.targetCol !== undefined && action.targetRow !== undefined) {
                    const tgtCol = 1 - action.targetCol;
                    const targetOwner = action.targetOwner === 'player' ? 'enemy' : 'player';
                    const tgtSprite = document.querySelector(`.cryptid-sprite[data-owner="${targetOwner}"][data-col="${tgtCol}"][data-row="${action.targetRow}"]`);
                    
                    if (tgtSprite) {
                        // Play enhanced spell effect if available
                        if (window.CombatEffects?.playSpellEffect) {
                            window.CombatEffects.playSpellEffect(tgtSprite, action.cardKey);
                        } else {
                            tgtSprite.classList.add('spell-target');
                            setTimeout(() => tgtSprite.classList.remove('spell-target'), TIMING.spell);
                        }
                        
                        // Show damage/heal effects from burst data
                        const g = window.game;
                        const field = targetOwner === 'player' ? g?.playerField : g?.enemyField;
                        const targetCryptid = field?.[tgtCol]?.[action.targetRow];
                        
                        if (action.damage && action.damage > 0 && targetCryptid && window.CombatEffects) {
                            // Damage effect
                            window.CombatEffects.showDamageNumber(targetCryptid, action.damage, action.damage >= 5);
                            window.CombatEffects.heavyImpact(action.damage * 0.5);
                        } else if (action.healing && action.healing > 0 && targetCryptid && window.CombatEffects?.showHealNumber) {
                            // Heal effect
                            window.CombatEffects.showHealNumber(targetCryptid, action.healing);
                        }
                        
                        // Show death if target died
                        if (action.targetDied && window.CombatEffects?.playDramaticDeath) {
                            const rarity = tgtSprite.className.match(/rarity-(\w+)/)?.[1] || 'common';
                            setTimeout(() => {
                                window.CombatEffects.playDramaticDeath(tgtSprite, targetOwner, rarity);
                            }, 400);
                        }
                    }
                }
                
                setTimeout(safeComplete, TIMING.spell + (action.targetDied ? 800 : 0));
                break;
            }
            
            case 'trap': {
                showMessage('Opponent set a trap!');
                
                // Find trap sprite and animate
                const trapSprite = document.querySelector(`.trap-sprite[data-owner="enemy"][data-row="${action.row}"]`);
                if (trapSprite) {
                    trapSprite.classList.add('spawning');
                    setTimeout(() => trapSprite.classList.remove('spawning'), TIMING.trap);
                }
                
                setTimeout(safeComplete, TIMING.trap);
                break;
            }
            
            case 'aura': {
                showMessage('Opponent cast ' + (action.cardName || action.cardKey) + '!');
                
                // Add enhanced aura effect to target
                const auraCol = 1 - action.col;
                const auraTargetSprite = document.querySelector(`.cryptid-sprite[data-owner="enemy"][data-col="${auraCol}"][data-row="${action.row}"]`);
                const auraBattlefield = document.getElementById('battlefield-area');
                
                if (auraTargetSprite && auraBattlefield && window.CombatEffects?.playAuraEffect) {
                    const battlefieldRect = auraBattlefield.getBoundingClientRect();
                    const targetRect = auraTargetSprite.getBoundingClientRect();
                    
                    // Start from top of screen (opponent's side)
                    const startX = targetRect.left + targetRect.width/2 - battlefieldRect.left;
                    const startY = 0;
                    const targetX = startX;
                    const targetY = targetRect.top + targetRect.height/2 - battlefieldRect.top;
                    
                    window.CombatEffects.playAuraEffect(startX, startY, targetX, targetY, auraTargetSprite);
                } else if (auraTargetSprite) {
                    // Fallback to basic animation
                    auraTargetSprite.classList.add('aura-target');
                    setTimeout(() => auraTargetSprite.classList.remove('aura-target'), TIMING.aura);
                }
                
                setTimeout(safeComplete, TIMING.aura + 300); // Extended for enhanced animation
                break;
            }
            
            case 'pyre':
                showMessage('Opponent played ' + (action.cardName || action.cardKey) + '!');
                setTimeout(safeComplete, TIMING.spell);
                break;
            
            case 'evolve': {
                showMessage('Opponent evolved into ' + (action.cardName || action.cardKey) + '!');
                
                // Add evolution effect - server sends 'col' and 'row', not 'targetCol'/'targetRow'
                const evolveCol = action.col !== undefined ? action.col : action.targetCol;
                const evolveRow = action.row !== undefined ? action.row : action.targetRow;
                const col = 1 - evolveCol;
                const sprite = document.querySelector(`.cryptid-sprite[data-owner="enemy"][data-col="${col}"][data-row="${evolveRow}"]`);
                if (sprite) {
                    // Use enhanced evolution animation if available
                    if (window.CombatEffects?.playEvolutionAnimation) {
                        const element = sprite.className.match(/element-(\w+)/)?.[1] || 'steel';
                        const rarity = sprite.className.match(/rarity-(\w+)/)?.[1] || 'uncommon';
                        window.CombatEffects.playEvolutionAnimation(
                            sprite, 
                            element, 
                            rarity,
                            // onSpriteChange - render to show new evolved form
                            () => {
                                if (window.renderAll) window.renderAll();
                            },
                            // onComplete
                            () => {
                                safeComplete();
                            }
                        );
                    } else {
                        sprite.classList.add('evolving');
                        setTimeout(() => sprite.classList.remove('evolving'), TIMING.evolve);
                        setTimeout(safeComplete, TIMING.evolve + 400);
                    }
                } else {
                    setTimeout(safeComplete, TIMING.evolve + 400);
                }
                break;
            }
            
            case 'pyreBurn': {
                showMessage('Opponent used Pyre Burn!');
                
                // Play pyre burn visual effect
                const g = window.game;
                const enemyPyre = document.querySelector('.player-info.enemy .pyre-display');
                
                if (window.CombatEffects?.playPyreBurn && enemyPyre) {
                    // Animate pyre flames from enemy pyre display
                    const pyreGain = action.deathCount || 1;
                    window.CombatEffects.playPyreBurn(enemyPyre, pyreGain);
                }
                
                // Show flame effect on enemy pyre counter
                if (enemyPyre) {
                    enemyPyre.classList.add('pyre-burning');
                    setTimeout(() => enemyPyre.classList.remove('pyre-burning'), 800);
                }
                
                setTimeout(safeComplete, TIMING.spell);
                break;
            }
            
            case 'ability': {
                const abilityName = action.abilityName || 'ability';
                showMessage('Opponent activated ' + abilityName + '!');
                
                // Handle sacrifice ability (Kuchisake-Onna "Am I Pretty?")
                if (abilityName === 'sacrifice') {
                    const supportCol = 1 - action.col; // Column flip for opponent view
                    const combatCol = supportCol === 0 ? 1 : 0; // Combat is opposite of support
                    const combatantRow = action.combatantRow;
                    
                    // Find the combatant sprite to show death animation
                    const combatantSprite = document.querySelector(
                        `.cryptid-sprite[data-owner="enemy"][data-col="${combatCol}"][data-row="${combatantRow}"]`
                    );
                    
                    if (combatantSprite) {
                        const rarity = combatantSprite.className.match(/rarity-(\w+)/)?.[1] || 'common';
                        
                        // Play death animation for the sacrificed combatant
                        if (window.CombatEffects?.playDramaticDeath) {
                            window.CombatEffects.playDramaticDeath(combatantSprite, 'enemy', rarity, () => {
                                // Show buff message for the newly empowered cryptid
                                showMessage(`👩 ${action.cardName || 'Kuchisake'} becomes ${action.newAtk}/${action.newHp} with Destroyer!`);
                                setTimeout(() => {
                                    if (window.renderAll) window.renderAll();
                                }, 200);
                            });
                        } else {
                            combatantSprite.classList.add('dying-right');
                            setTimeout(() => {
                                showMessage(`👩 ${action.cardName || 'Kuchisake'} becomes ${action.newAtk}/${action.newHp} with Destroyer!`);
                                if (window.renderAll) window.renderAll();
                            }, 700);
                        }
                    }
                    
                    setTimeout(safeComplete, TIMING.death + 500);
                    break;
                }
                
                // Execute specific abilities that need to be processed on receiving side
                if (abilityName === 'decayRatDebuff' && action.targetCol !== undefined && action.targetRow !== undefined) {
                    // Invert columns for multiplayer (combat/support columns are mirrored)
                    const ratCol = 1 - action.col;
                    const tgtCol = 1 - action.targetCol;
                    
                    // Find the Decay Rat (opponent's cryptid, so in our view it's on enemy side)
                    const decayRat = window.game?.enemyField[ratCol]?.[action.row];
                    // Find our cryptid that's being targeted
                    const targetCryptid = window.game?.playerField[tgtCol]?.[action.targetRow];
                    
                    if (decayRat && decayRat.activateDecayDebuff && targetCryptid) {
                        // Get sprites
                        const targetSprite = document.querySelector(
                            `.cryptid-sprite[data-owner="player"][data-col="${tgtCol}"][data-row="${action.targetRow}"]`
                        );
                        const ratSprite = document.querySelector(
                            `.cryptid-sprite[data-owner="enemy"][data-col="${ratCol}"][data-row="${action.row}"]`
                        );
                        
                        // Visual feedback on Decay Rat
                        if (ratSprite) {
                            ratSprite.classList.add('ability-activate');
                            setTimeout(() => ratSprite.classList.remove('ability-activate'), 500);
                        }
                        
                        // Play debuff animation then execute
                        if (window.CombatEffects?.playDebuffEffect && targetSprite) {
                            window.CombatEffects.playDebuffEffect(targetSprite, () => {
                                // Execute the ability
                                decayRat.activateDecayDebuff(decayRat, window.game, tgtCol, action.targetRow);
                                
                                // Check if our cryptid died
                                if (targetCryptid.currentHp <= 0 && targetSprite) {
                                    const rarity = targetSprite.className.match(/rarity-(\w+)/)?.[1] || 'common';
                                    if (window.CombatEffects?.playDramaticDeath) {
                                        window.CombatEffects.playDramaticDeath(targetSprite, 'player', rarity, () => {
                                            if (window.renderAll) window.renderAll();
                                        });
                                    } else {
                                        targetSprite.classList.add('dying-left');
                                        setTimeout(() => {
                                            if (window.renderAll) window.renderAll();
                                        }, 700);
                                    }
                                } else {
                                    setTimeout(() => {
                                        if (window.renderAll) window.renderAll();
                                    }, 200);
                                }
                            });
                        } else {
                            // Fallback without debuff animation
                            if (targetSprite) {
                                targetSprite.classList.add('debuff-applied');
                                setTimeout(() => targetSprite.classList.remove('debuff-applied'), 500);
                            }
                            
                            decayRat.activateDecayDebuff(decayRat, window.game, tgtCol, action.targetRow);
                            
                            if (targetCryptid.currentHp <= 0 && targetSprite) {
                                const rarity = targetSprite.className.match(/rarity-(\w+)/)?.[1] || 'common';
                                if (window.CombatEffects?.playDramaticDeath) {
                                    window.CombatEffects.playDramaticDeath(targetSprite, 'player', rarity, () => {
                                        if (window.renderAll) window.renderAll();
                                    });
                                } else {
                                    targetSprite.classList.add('dying-left');
                                    setTimeout(() => {
                                        if (window.renderAll) window.renderAll();
                                    }, 700);
                                }
                            } else {
                                setTimeout(() => {
                                    if (window.renderAll) window.renderAll();
                                }, 400);
                            }
                        }
                    }
                }
                
                setTimeout(safeComplete, TIMING.spell);
                break;
            }
            
            case 'turnStartSync': {
                // Animate turn-start effects (burn damage, regen, etc.) on enemy cryptids
                const g = window.game;
                if (g && state) {
                    // Compare current enemy HP to incoming state to detect burn/bleed/regen
                    const effectsToAnimate = [];
                    
                    for (let c = 0; c < 2; c++) {
                        const ourCol = 1 - c; // Column flip
                        for (let r = 0; r < 3; r++) {
                            const currentCryptid = g.enemyField[ourCol]?.[r];
                            const newData = state.playerField[c]?.[r]; // Their player = our enemy
                            
                            if (currentCryptid && newData && currentCryptid.key === newData.key) {
                                const hpChange = newData.currentHp - currentCryptid.currentHp;
                                
                                if (hpChange < 0) {
                                    // HP decreased - burn/bleed damage
                                    effectsToAnimate.push({
                                        type: 'damage',
                                        col: ourCol,
                                        row: r,
                                        amount: Math.abs(hpChange),
                                        cryptidName: currentCryptid.name,
                                        source: currentCryptid.burnTurns > 0 ? 'burn' : (currentCryptid.bleedTurns > 0 ? 'bleed' : 'tick')
                                    });
                                } else if (hpChange > 0) {
                                    // HP increased - regeneration
                                    effectsToAnimate.push({
                                        type: 'heal',
                                        col: ourCol,
                                        row: r,
                                        amount: hpChange,
                                        cryptidName: currentCryptid.name
                                    });
                                }
                                
                                // Check for death
                                if (currentCryptid.currentHp > 0 && newData.currentHp <= 0) {
                                    effectsToAnimate.push({
                                        type: 'death',
                                        col: ourCol,
                                        row: r,
                                        cryptidName: currentCryptid.name,
                                        source: currentCryptid.calamityCounters > 0 ? 'calamity' : 'turnStart'
                                    });
                                }
                            }
                        }
                    }
                    
                    // Play animations for turn-start effects
                    if (effectsToAnimate.length > 0) {
                        self.playTurnStartEffects(effectsToAnimate, safeComplete);
                        break;
                    }
                }
                
                safeComplete();
                break;
            }
            
            case 'endPhase':
                safeComplete();
                break;
            
            case 'gameOver': {
                // Opponent won the game - trigger match end
                this.onMatchEnd({ winner: action.winner });
                safeComplete();
                break;
            }
            
            case 'cheatSync': {
                // Cheat mode forced state sync - just show message and complete
                showMessage('Opponent synced state', 1000);
                console.log('[MP] Cheat sync received');
                safeComplete();
                break;
            }
            
            default:
                console.warn('[MP] Unknown action:', action.type);
                safeComplete();
        }
    },
    
    // Play Kuchisake explosion chain animation on receiving side
    playExplosionChain(explosionInfo, targetRow, onComplete) {
        if (!explosionInfo || !explosionInfo.targets || explosionInfo.targets.length === 0) {
            onComplete?.();
            return;
        }
        
        const victimName = explosionInfo.victimName || 'enemy';
        const damage = explosionInfo.damage || 0;
        let currentIndex = 0;
        
        const processNext = () => {
            if (currentIndex >= explosionInfo.targets.length) {
                onComplete?.();
                return;
            }
            
            const targetInfo = explosionInfo.targets[currentIndex];
            const tgtCol = 1 - targetInfo.col; // Column flip for perspective
            const tgtRow = targetInfo.row;
            currentIndex++;
            
            // Find the sprite to animate
            const sprite = document.querySelector(`.cryptid-sprite[data-owner="player"][data-col="${tgtCol}"][data-row="${tgtRow}"]`);
            
            // Show explosion message
            if (typeof showMessage === 'function') {
                showMessage(`💥 ${victimName} explodes: ${damage} damage!`, 800);
            }
            
            // Play explosion effects
            if (sprite && window.CombatEffects) {
                const battlefield = document.getElementById('battlefield-area');
                if (battlefield) {
                    const targetRect = sprite.getBoundingClientRect();
                    const battlefieldRect = battlefield.getBoundingClientRect();
                    const impactX = targetRect.left + targetRect.width/2 - battlefieldRect.left;
                    const impactY = targetRect.top + targetRect.height/2 - battlefieldRect.top;
                    
                    // Explosion visual effects
                    window.CombatEffects.heavyImpact(damage * 0.7);
                    window.CombatEffects.createImpactFlash(impactX, impactY, 80 + damage * 10);
                    window.CombatEffects.createSparks(impactX, impactY, 10 + damage * 2);
                    window.CombatEffects.createImpactParticles(impactX, impactY, targetInfo.died ? '#ff2222' : '#ff6622', 10 + damage);
                    
                    // Show damage number
                    const g = window.game;
                    const target = g?.playerField[tgtCol]?.[tgtRow];
                    if (target) {
                        window.CombatEffects.showDamageNumber(target, damage, damage >= 5);
                    }
                }
                
                // Hit recoil if not dead
                if (!targetInfo.died) {
                    sprite.classList.add('hit-recoil');
                    setTimeout(() => sprite.classList.remove('hit-recoil'), 250);
                }
            }
            
            // Play death animation if target died
            if (targetInfo.died && sprite && window.CombatEffects?.playDramaticDeath) {
                const rarity = sprite.className.match(/rarity-(\w+)/)?.[1] || 'common';
                setTimeout(() => {
                    window.CombatEffects.playDramaticDeath(sprite, 'player', rarity, () => {
                        setTimeout(processNext, 300);
                    });
                }, 200);
            } else {
                setTimeout(processNext, 400);
            }
        };
        
        // Start explosion sequence after brief delay
        setTimeout(processNext, 300);
    },
    
    // Play on-enter-combat effects (Mothman calamity, Bogeyman paralyze, etc.)
    playOnEnterCombatEffect(effect, sourceRow) {
        if (!effect) return;
        
        const g = window.game;
        if (!g) return;
        
        switch (effect.type) {
            case 'calamityAll': {
                // Mothman: 3 calamity to all our combatants
                showMessage(`🦋 Harbinger: ${effect.stacks} Calamity to ${effect.targetDescription}!`);
                
                const playerCombatCol = g.getCombatCol('player');
                
                for (let r = 0; r < 3; r++) {
                    const target = g.playerField[playerCombatCol]?.[r];
                    if (target) {
                        const sprite = document.querySelector(`.cryptid-sprite[data-owner="player"][data-col="${playerCombatCol}"][data-row="${r}"]`);
                        if (sprite) {
                            // Add calamity visual effect
                            sprite.classList.add('calamity-applied');
                            setTimeout(() => sprite.classList.remove('calamity-applied'), 600);
                            
                            // Play debuff effect if available
                            if (window.CombatEffects?.playDebuffEffect) {
                                window.CombatEffects.playDebuffEffect(sprite);
                            }
                        }
                    }
                }
                break;
            }
            
            case 'paralyzeEnemies': {
                // Bogeyman/Flayer: Paralyze enemies across
                showMessage(`⚡ Terror: ${effect.targetDescription} paralyzed!`);
                
                const playerCombatCol = g.getCombatCol('player');
                
                // Find our cryptids that would be "across" from the summoned enemy
                // For a summon at sourceRow, the "across" cryptids are at the same row
                const target = g.playerField[playerCombatCol]?.[sourceRow];
                if (target) {
                    const sprite = document.querySelector(`.cryptid-sprite[data-owner="player"][data-col="${playerCombatCol}"][data-row="${sourceRow}"]`);
                    if (sprite) {
                        sprite.classList.add('paralyzed-applied');
                        setTimeout(() => sprite.classList.remove('paralyzed-applied'), 600);
                        
                        if (window.CombatEffects?.playDebuffEffect) {
                            window.CombatEffects.playDebuffEffect(sprite);
                        }
                    }
                }
                break;
            }
            
            // Add more effect types as needed
            default:
                console.log('[MP] Unknown on-enter-combat effect:', effect.type);
        }
    },
    
    // Play Destroyer damage animation on receiving side
    // This shows: 1) Residue in combat slot, 2) Support promotion into it, 3) Strike animation
    playDestroyerDamage(destroyerInfo, onComplete) {
        const self = this; // Capture for nested callbacks
        
        if (!destroyerInfo) {
            onComplete?.();
            return;
        }
        
        const tgtRow = destroyerInfo.row;
        const damage = destroyerInfo.damage || 0;
        const g = window.game;
        
        // Player's combat col from our perspective (where the residue should appear)
        const playerCombatCol = g?.getCombatCol('player') ?? 1;
        
        // Step 1: Create Destroyer residue visual in the (now empty) combat slot
        if (destroyerInfo.hasResidue && window.CombatEffects?.createDestroyerResidue) {
            window.CombatEffects.createDestroyerResidue('player', playerCombatCol, tgtRow, damage);
        }
        
        // Step 2: Wait for promotion animation (state already applied, support is in combat col)
        // The render will show the support sliding into position
        setTimeout(() => {
            // Find the support sprite (now in combat position after state was applied)
            let sprite = document.querySelector(`.cryptid-sprite[data-owner="player"][data-col="${playerCombatCol}"][data-row="${tgtRow}"]`);
            
            // Show destroyer message
            if (typeof showMessage === 'function') {
                showMessage(`💥 Destroyer: ${damage} damage pierces through!`, 800);
            }
            
            // Step 3: Trigger residue strike animation
            if (destroyerInfo.hasResidue && window.CombatEffects?.strikeDestroyerResidue) {
                window.CombatEffects.strikeDestroyerResidue('player', tgtRow, () => {
                    // After strike, play damage effects
                    self.playDestroyerImpact(sprite, tgtRow, damage, destroyerInfo.supportDied, onComplete);
                });
            } else {
                // No residue effect, just play impact
                self.playDestroyerImpact(sprite, tgtRow, damage, destroyerInfo.supportDied, onComplete);
            }
        }, 400); // Wait for promotion to visually complete
    },
    
    // Helper: Play the actual Destroyer impact effects (static - no 'this' needed)
    playDestroyerImpact: function(sprite, tgtRow, damage, supportDied, onComplete) {
        const g = window.game;
        const playerCombatCol = g?.getCombatCol('player') ?? 1;
        
        if (sprite && window.CombatEffects) {
            const battlefield = document.getElementById('battlefield-area');
            if (battlefield) {
                const targetRect = sprite.getBoundingClientRect();
                const battlefieldRect = battlefield.getBoundingClientRect();
                const impactX = targetRect.left + targetRect.width/2 - battlefieldRect.left;
                const impactY = targetRect.top + targetRect.height/2 - battlefieldRect.top;
                
                // Destroyer visual effects (intense, red/orange)
                window.CombatEffects.heavyImpact(damage);
                window.CombatEffects.createImpactFlash(impactX, impactY, 100 + damage * 15);
                window.CombatEffects.createSparks(impactX, impactY, 12 + damage * 2);
                window.CombatEffects.createImpactParticles(impactX, impactY, '#ff4400', 12 + damage);
                
                // Show damage number
                const target = g?.playerField[playerCombatCol]?.[tgtRow];
                if (target) {
                    window.CombatEffects.showDamageNumber(target, damage, true);
                }
            }
            
            // Hit recoil if not dead
            if (!supportDied) {
                sprite.classList.add('hit-recoil');
                setTimeout(() => sprite.classList.remove('hit-recoil'), 250);
            }
        }
        
        // Play death animation if support died
        if (supportDied && sprite && window.CombatEffects?.playDramaticDeath) {
            const rarity = sprite.className.match(/rarity-(\w+)/)?.[1] || 'common';
            setTimeout(() => {
                window.CombatEffects.playDramaticDeath(sprite, 'player', rarity, onComplete);
            }, 200);
        } else {
            setTimeout(() => onComplete?.(), 300);
        }
    },
    
    // Play status effect application animations (burn, paralyze, bleed, etc.)
    playStatusEffectAnimations(sprite, statusEffects) {
        if (!sprite || !statusEffects || statusEffects.length === 0) return;
        
        let delay = 0;
        for (const effect of statusEffects) {
            setTimeout(() => {
                switch (effect.type) {
                    case 'burn':
                        showMessage('🔥 Burn applied!', 500);
                        sprite.classList.add('burn-applied');
                        setTimeout(() => sprite.classList.remove('burn-applied'), 600);
                        if (window.CombatEffects?.playBurnEffect) {
                            window.CombatEffects.playBurnEffect(sprite);
                        }
                        break;
                        
                    case 'paralyze':
                        showMessage('⚡ Paralyzed!', 500);
                        sprite.classList.add('paralyze-applied');
                        setTimeout(() => sprite.classList.remove('paralyze-applied'), 600);
                        if (window.CombatEffects?.playParalyzeEffect) {
                            window.CombatEffects.playParalyzeEffect(sprite);
                        }
                        break;
                        
                    case 'bleed':
                        showMessage('🩸 Bleeding!', 500);
                        sprite.classList.add('bleed-applied');
                        setTimeout(() => sprite.classList.remove('bleed-applied'), 600);
                        if (window.CombatEffects?.playBleedEffect) {
                            window.CombatEffects.playBleedEffect(sprite);
                        }
                        break;
                        
                    case 'calamity':
                        showMessage('💀 Calamity! (' + effect.stacks + ')', 500);
                        sprite.classList.add('calamity-applied');
                        setTimeout(() => sprite.classList.remove('calamity-applied'), 600);
                        if (window.CombatEffects?.playCalamityEffect) {
                            window.CombatEffects.playCalamityEffect(sprite, effect.stacks);
                        }
                        break;
                        
                    case 'curse':
                        showMessage('☠ Cursed! (+' + effect.tokens + ')', 500);
                        sprite.classList.add('curse-applied');
                        setTimeout(() => sprite.classList.remove('curse-applied'), 600);
                        break;
                }
            }, delay);
            delay += 400; // Stagger multiple effects
        }
    },
    
    // Play turn-start effects (burn damage, regeneration, calamity death, etc.)
    playTurnStartEffects(effects, onComplete) {
        if (!effects || effects.length === 0) {
            onComplete?.();
            return;
        }
        
        let currentIndex = 0;
        const processNextEffect = () => {
            if (currentIndex >= effects.length) {
                onComplete?.();
                return;
            }
            
            const effect = effects[currentIndex];
            currentIndex++;
            
            const sprite = document.querySelector(`.cryptid-sprite[data-owner="enemy"][data-col="${effect.col}"][data-row="${effect.row}"]`);
            const g = window.game;
            const cryptid = g?.enemyField[effect.col]?.[effect.row];
            
            switch (effect.type) {
                case 'damage': {
                    // Show burn/bleed tick damage
                    const sourceEmoji = effect.source === 'burn' ? '🔥' : (effect.source === 'bleed' ? '🩸' : '💀');
                    showMessage(`${sourceEmoji} ${effect.cryptidName} takes ${effect.amount} damage!`, 600);
                    
                    if (sprite && window.CombatEffects) {
                        // Show damage number
                        if (cryptid) {
                            window.CombatEffects.showDamageNumber(cryptid, effect.amount, false);
                        }
                        
                        // Add burn/bleed visual effect
                        sprite.classList.add(effect.source === 'burn' ? 'burning-tick' : 'bleed-tick');
                        setTimeout(() => sprite.classList.remove('burning-tick', 'bleed-tick'), 500);
                        
                        // Light screen shake
                        window.CombatEffects.heavyImpact(effect.amount * 0.3);
                    }
                    
                    setTimeout(processNextEffect, 500);
                    break;
                }
                
                case 'heal': {
                    showMessage(`✨ ${effect.cryptidName} regenerates ${effect.amount} HP!`, 600);
                    
                    if (sprite && window.CombatEffects?.showHealNumber && cryptid) {
                        window.CombatEffects.showHealNumber(cryptid, effect.amount);
                    }
                    
                    if (sprite) {
                        sprite.classList.add('healing-tick');
                        setTimeout(() => sprite.classList.remove('healing-tick'), 500);
                    }
                    
                    setTimeout(processNextEffect, 500);
                    break;
                }
                
                case 'death': {
                    const deathEmoji = effect.source === 'calamity' ? '💀' : '☠';
                    showMessage(`${deathEmoji} ${effect.cryptidName} succumbs!`, 800);
                    
                    if (sprite && window.CombatEffects?.playDramaticDeath) {
                        const rarity = sprite.className.match(/rarity-(\w+)/)?.[1] || 'common';
                        window.CombatEffects.playDramaticDeath(sprite, 'enemy', rarity, () => {
                            setTimeout(processNextEffect, 200);
                        });
                    } else {
                        if (sprite) sprite.classList.add('dying-right');
                        setTimeout(processNextEffect, 800);
                    }
                    break;
                }
                
                default:
                    setTimeout(processNextEffect, 100);
            }
        };
        
        // Start processing effects
        processNextEffect();
    },
    
    handleOpponentEndTurn() {
        console.log('[MP] Opponent ended turn');
        
        this.turnTransitionLock = true;
        this.stopTurnTimer();
        
        const g = window.game;
        GameEvents.emit('onTurnEnd', { owner: 'enemy', turnNumber: g.turnNumber });
        
        // Process turn start WITH status effects (burn/bleed damage, paralyze clear, regeneration, card draw, etc.)
        // Status effects MUST be processed so paralyze clears properly
        g.startTurn('player', false);
        this.isMyTurn = true;
        
        showMessage("Your turn!");
        this.turnTimeRemaining = this.TURN_TIME;
        this.timerWarningShown = false;
        this.startTurnTimer(true);
        this.updateTimerDisplay();
        
        // CRITICAL: Reset animation state so player can interact with their hand
        if (typeof window.setAnimating === 'function') {
            window.setAnimating(false);
        }
        
        // CRITICAL: Force browser repaint with requestAnimationFrame
        // This ensures UI updates even when browser deprioritizes background tasks
        requestAnimationFrame(() => {
            if (typeof renderAll === 'function') renderAll();
            if (typeof updateButtons === 'function') updateButtons();
        });
        
        // CRITICAL: Sync state back to opponent after turn-start effects complete
        // This ensures burn damage, regeneration, card draw, etc. are visible
        setTimeout(() => {
            this.sendTurnStartSync();
            this.turnTransitionLock = false;
        }, 100);
    },
    
    // Send state sync after turn-start effects complete
    sendTurnStartSync() {
        if (!this.isInMatch || !this.isMyTurn) return;
        
        const msg = {
            type: 'action',
            matchId: this.matchId,
            playerId: this.playerId,
            action: { type: 'turnStartSync' },
            state: this.serializeGameState()
        };
        
        console.log('[MP] Sending turn start sync');
        this.send(msg);
    },
    
    // Send our kindling pool to opponent at match start
    sendKindlingSync(kindlingPool) {
        if (!this.isInMatch) return;
        
        // Serialize kindling - just need key for each card
        const kindlingKeys = kindlingPool.map(k => ({ key: k.key, foil: k.foil || false }));
        
        const msg = {
            type: 'kindlingSync',
            matchId: this.matchId,
            playerId: this.playerId,
            kindling: kindlingKeys
        };
        
        console.log('[MP] Sending kindling sync:', kindlingKeys.length, 'cards');
        this.send(msg);
    },
    
    // Receive opponent's kindling pool
    handleKindlingSync(msg) {
        const g = window.game;
        
        // If game isn't ready yet, store for later
        if (!g) {
            console.log('[MP] Storing pending kindling sync (game not ready)');
            this.pendingKindlingSync = msg;
            return;
        }
        
        const kindlingKeys = msg.kindling || [];
        console.log('[MP] Received opponent kindling:', kindlingKeys.length, 'cards');
        
        // Reconstruct opponent's kindling pool from keys
        g.enemyKindling = kindlingKeys.map(entry => {
            const template = CardRegistry.getKindling(entry.key);
            if (!template) {
                console.warn('[MP] Unknown kindling:', entry.key);
                return null;
            }
            return Object.assign({}, template, {
                foil: entry.foil,
                instanceId: Math.random().toString(36).substr(2, 9)
            });
        }).filter(k => k !== null);
        
        console.log('[MP] Enemy kindling pool set:', g.enemyKindling.length, 'cards');
    },
    
    // Called after game init to apply any pending kindling sync
    applyPendingKindlingSync() {
        if (this.pendingKindlingSync) {
            console.log('[MP] Applying pending kindling sync');
            this.handleKindlingSync(this.pendingKindlingSync);
            this.pendingKindlingSync = null;
        }
    },

    // ==================== MESSAGE HANDLING ====================
    
    handleMessage(msg) {
        console.log('[MP] Received:', msg.type);
        
        switch (msg.type) {
            case 'authenticated':
                this.playerId = msg.playerId;
                break;
            case 'matchFound':
                this.onMatchFound(msg);
                break;
            
            // NEW ARCHITECTURE: Server broadcasts to BOTH players
            case 'resolvedAction':
                this.handleResolvedAction(msg);
                break;
            
            // Time sync
            case 'pong':
                this.handlePong(msg);
                break;
            
            // LEGACY: Keep for backwards compatibility during transition
            case 'opponentAction':
                this.handleOpponentAction(msg);
                break;
            
            case 'opponentDisconnected':
                this.onOpponentDisconnected();
                break;
            case 'opponentReconnected':
                showMessage('Opponent reconnected!');
                this.hideDisconnectOverlay();
                break;
            case 'gameEnd':
                this.onGameEnd(msg);
                break;
            case 'matchEnd':
                this.onMatchEnd(msg);
                break;
            case 'kindlingSync':
                this.handleKindlingSync(msg);
                break;
            case 'error':
                console.error('[MP] Error:', msg.message);
                break;
            
            // Server rejected our action
            case 'actionError':
                console.error('[MP] Action rejected:', msg.error);
                this.awaitingServerResponse = false;
                if (typeof showMessage === 'function') {
                    showMessage(`Action failed: ${msg.error}`, 2000);
                }
                break;
            
            // Rematch system
            case 'rematch_requested':
            case 'opponent_left_results':
            case 'rematch_accepted':
                this.handleRematchMessage(msg);
                break;
        }
    },
    
    /**
     * NEW ARCHITECTURE: Handle resolved action from server
     * Server sends authoritative events + animationSequence + state to both players
     * Both players play animations, then apply state
     */
    handleResolvedAction(msg) {
        const { action, events, animationSequence, state, isMyAction, startAtServerMs, serverTime } = msg;
        
        console.log(`[MP] Resolved action: ${action?.type} from ${isMyAction ? 'self' : 'opponent'}, ${animationSequence?.length || 0} animations, ${events?.length || 0} events`);
        
        // Clear awaiting flag
        this.awaitingServerResponse = false;
        
        // Calculate when to start the animation for sync
        const msUntilStart = this.msUntilServerTime(startAtServerMs);
        
        // Queue entry for processing
        const queueEntry = {
            action,
            events: events || [],
            animationSequence: animationSequence || [],
            state,
            isMyAction,
            scheduledStartTime: startAtServerMs
        };
        
        if (msUntilStart > 50) {
            // We have time - schedule it for sync
            console.log(`[MP] Scheduling action in ${msUntilStart}ms`);
            setTimeout(() => {
                this.executeResolvedAction(queueEntry);
            }, msUntilStart);
        } else if (msUntilStart > -this.MAX_LATE_MS) {
            // We're a bit late but within tolerance - execute immediately
            console.log(`[MP] Action ${-msUntilStart}ms late - executing now`);
            this.executeResolvedAction(queueEntry);
        } else {
            // We're very late - skip animation, just apply state
            console.log(`[MP] Action ${-msUntilStart}ms late - skipping animation, applying state`);
            this.applyServerState(state);
            if (typeof renderAll === 'function') renderAll();
            this.handleTurnChanges(action, state);
        }
    },
    
    /**
     * Execute a resolved action (play animations, then apply state)
     * Same code path for BOTH players!
     */
    executeResolvedAction(entry) {
        const { action, events, animationSequence, state, isMyAction } = entry;
        
        this.processingOpponentAction = !isMyAction;
        
        // Determine if we need to animate before or after state application
        const hasDeaths = events.some(e => e.type === 'cryptidDied') || 
                          animationSequence.some(a => a.type === 'death');
        const hasDamage = events.some(e => e.type === 'damageDealt') ||
                          animationSequence.some(a => a.type === 'damage');
        const hasAttack = events.some(e => e.type === 'attackDeclared') ||
                          animationSequence.some(a => a.type === 'attackMove');
        const hasSummon = events.some(e => e.type === 'cryptidSummoned') ||
                          animationSequence.some(a => a.type === 'summon');
        
        // For summons with effects (like Mothman), apply state FIRST so sprite exists
        // Then play animations against existing sprites
        const shouldApplyStateFirst = hasSummon && (hasDeaths || hasDamage);
        const shouldAnimateFirst = (hasDeaths || hasDamage || hasAttack) && !shouldApplyStateFirst;
        
        const hasAnimations = (animationSequence && animationSequence.length > 0) || 
                             (events && events.length > 0);
        
        const onComplete = () => {
            // Apply authoritative state from server (if not already applied)
            if (!shouldApplyStateFirst) {
                this.applyServerState(state);
            }
            if (typeof renderAll === 'function') renderAll();
            if (typeof updateButtons === 'function') updateButtons();
            
            this.processingOpponentAction = false;
            
            // Handle turn changes
            this.handleTurnChanges(action, state);
        };
        
        if (shouldApplyStateFirst && hasAnimations) {
            // Apply state first to create sprites, then animate
            this.applyServerState(state);
            if (typeof renderAll === 'function') renderAll();
            
            this.playServerAnimations(animationSequence, events, () => {
                if (typeof updateButtons === 'function') updateButtons();
                this.processingOpponentAction = false;
                this.handleTurnChanges(action, state);
            });
        } else if (hasAnimations && shouldAnimateFirst) {
            // Play animations first (for attacks, damage, deaths)
            this.playServerAnimations(animationSequence, events, onComplete);
        } else if (hasAnimations) {
            // Default: apply state first, then animate
            this.applyServerState(state);
            if (typeof renderAll === 'function') renderAll();
            this.playServerAnimations(animationSequence, events, () => {
                if (typeof updateButtons === 'function') updateButtons();
                this.processingOpponentAction = false;
                this.handleTurnChanges(action, state);
            });
        } else {
            // No animations - just apply state
            onComplete();
        }
    },
    
    /**
     * Play server-provided animation sequence
     * Uses animationSequence if available, falls back to events
     */
    playServerAnimations(animationSequence, events, onComplete) {
        // Prefer animation sequence over events
        if (animationSequence && animationSequence.length > 0) {
            this.playAnimationSequence(animationSequence, onComplete);
        } else if (events && events.length > 0) {
            this.playEventAnimations(events, onComplete);
        } else {
            onComplete?.();
        }
    },
    
    /**
     * Play animations from server-provided sequence
     */
    playAnimationSequence(sequence, onComplete) {
        if (!sequence || sequence.length === 0) {
            onComplete?.();
            return;
        }
        
        console.log('[MP] Playing', sequence.length, 'server animations');
        
        let index = 0;
        const self = this;
        
        const playNext = () => {
            if (index >= sequence.length) {
                onComplete?.();
                return;
            }
            
            const cmd = sequence[index++];
            const duration = self.playSequenceAnimation(cmd);
            
            // Move to next after animation
            setTimeout(playNext, duration + 50);
        };
        
        playNext();
    },
    
    /**
     * Play a single animation from server sequence
     */
    playSequenceAnimation(cmd) {
        const type = cmd.type;
        let duration = 100;
        
        // Server already flips owner in filterAnimationsForPlayer, so we just use it directly
        // 'player' = my action, 'enemy' = opponent's action
        const flipOwner = (owner) => owner;
        
        // Helper to convert server col to client col (server: combat=0, client: combat=1)
        const serverToClientCol = (col) => col !== undefined ? 1 - col : undefined;
        
        const findSprite = (owner, col, row) => {
            // Convert server col to client col for sprite lookup
            const clientCol = serverToClientCol(col);
            return document.querySelector(
                `.cryptid-sprite[data-owner="${owner}"][data-col="${clientCol}"][data-row="${row}"]`
            );
        };
        
        switch (type) {
            case 'summon': {
                const sprite = findSprite(cmd.owner, cmd.col, cmd.row);
                if (sprite && window.CombatEffects?.playSummonAnimation) {
                    window.CombatEffects.playSummonAnimation(sprite);
                }
                if (typeof showMessage === 'function') {
                    const cardName = cmd.name || cmd.cryptidName || cmd.key || 'Cryptid';
                    showMessage(`${cardName} summoned!`, 1000);
                }
                duration = 500;
                break;
            }
            
            case 'attackMove': {
                // Use server-provided cols with conversion, or fallback to combat col (0 on server)
                const atkCol = cmd.attackerCol !== undefined ? cmd.attackerCol : 0;
                const tgtCol = cmd.targetCol !== undefined ? cmd.targetCol : 0;
                const atkSprite = findSprite(cmd.attackerOwner, atkCol, cmd.attackerRow);
                const tgtSprite = findSprite(cmd.targetOwner, tgtCol, cmd.targetRow);
                
                if (atkSprite && window.CombatEffects?.playEnhancedAttack) {
                    window.CombatEffects.playEnhancedAttack(atkSprite, cmd.attackerOwner, tgtSprite, cmd.damage || 0);
                }
                duration = 500;
                break;
            }
            
            case 'damage': {
                const sprite = findSprite(cmd.targetOwner, cmd.targetCol, cmd.targetRow);
                
                if (sprite && window.CombatEffects) {
                    const cryptid = { col: cmd.targetCol, row: cmd.targetRow, owner: cmd.targetOwner };
                    window.CombatEffects.showDamageNumber(cryptid, cmd.amount, cmd.amount >= 5);
                    
                    const battlefield = document.getElementById('battlefield-area');
                    if (battlefield) {
                        const rect = sprite.getBoundingClientRect();
                        const bfRect = battlefield.getBoundingClientRect();
                        const x = rect.left + rect.width/2 - bfRect.left;
                        const y = rect.top + rect.height/2 - bfRect.top;
                        
                        window.CombatEffects.createImpactFlash?.(x, y, 50 + cmd.amount * 8);
                        window.CombatEffects.createSparks?.(x, y, 5 + cmd.amount);
                    }
                    
                    sprite.classList.add('hit-recoil');
                    setTimeout(() => sprite.classList.remove('hit-recoil'), 250);
                }
                duration = 300;
                break;
            }
            
            case 'death': {
                const sprite = findSprite(cmd.owner, cmd.col, cmd.row);
                
                if (sprite && window.CombatEffects?.playDramaticDeath) {
                    window.CombatEffects.playDramaticDeath(sprite, cmd.owner, cmd.rarity || 'common');
                }
                if (typeof showMessage === 'function') {
                    const cardName = cmd.name || cmd.cryptidKey || cmd.key || 'Cryptid';
                    showMessage(`💀 ${cardName} falls!`, 1200);
                }
                duration = 800;
                break;
            }
            
            case 'promotion': {
                const combatCol = cmd.owner === 'player' ? 0 : 1;
                const sprite = findSprite(cmd.owner, combatCol, cmd.row);
                if (sprite) {
                    sprite.classList.add('promoting');
                    setTimeout(() => sprite.classList.remove('promoting'), 400);
                }
                if (typeof showMessage === 'function') {
                    const cardName = cmd.name || cmd.cryptidKey || cmd.key || 'Support';
                    showMessage(`${cardName} promoted!`, 800);
                }
                duration = 500;
                break;
            }
            
            case 'statusApply': {
                const sprite = findSprite(cmd.targetOwner, cmd.targetCol, cmd.targetRow);
                if (sprite) {
                    // Different colors for different statuses
                    const statusClass = cmd.status === 'burn' ? 'status-burn' :
                                       cmd.status === 'curse' ? 'status-curse' :
                                       cmd.status === 'bleed' ? 'status-bleed' : 'status-applied';
                    sprite.classList.add(statusClass);
                    setTimeout(() => sprite.classList.remove(statusClass), 400);
                }
                duration = 300;
                break;
            }
            
            case 'evolve': {
                const sprite = findSprite(cmd.owner, cmd.col, cmd.row);
                if (sprite && window.CombatEffects?.playEvolveAnimation) {
                    window.CombatEffects.playEvolveAnimation(sprite);
                }
                if (typeof showMessage === 'function') {
                    showMessage(`⚡ Evolved into ${cmd.toKey}!`, 1000);
                }
                duration = 600;
                break;
            }
            
            case 'protectionBlock': {
                const sprite = findSprite(cmd.targetOwner, cmd.targetCol, cmd.targetRow);
                if (sprite) {
                    sprite.classList.add('protection-block');
                    setTimeout(() => sprite.classList.remove('protection-block'), 400);
                }
                if (typeof showMessage === 'function') {
                    showMessage('🛡️ Protected!', 800);
                }
                duration = 400;
                break;
            }
            
            case 'attackBlocked': {
                // Use server-provided col with conversion, or fallback to combat col (0 on server)
                const tgtCol = cmd.targetCol !== undefined ? cmd.targetCol : 0;
                const sprite = findSprite(cmd.targetOwner, tgtCol, cmd.targetRow);
                if (sprite) {
                    sprite.classList.add('attack-blocked');
                    setTimeout(() => sprite.classList.remove('attack-blocked'), 400);
                }
                if (typeof showMessage === 'function') {
                    showMessage('🛡️ Attack blocked!', 800);
                }
                duration = 400;
                break;
            }
            
            case 'pyreGain': {
                const flippedOwner = flipOwner(cmd.owner);
                const amount = cmd.amount || 1;
                
                // Play pyre burn effect
                if (window.CombatEffects?.playPyreBurn) {
                    window.CombatEffects.playPyreBurn(null, amount);
                }
                
                // Flash pyre display
                const pyreDisplay = document.querySelector(`.player-info.${flippedOwner} .pyre-display`);
                if (pyreDisplay) {
                    pyreDisplay.classList.add('pyre-gained');
                    setTimeout(() => pyreDisplay.classList.remove('pyre-gained'), 600);
                }
                
                if (cmd.source === 'turnStart') {
                    showMessage?.(`🔥 +${amount} Pyre (turn start)`, 800);
                } else {
                    showMessage?.(`🔥 +${amount} Pyre`, 800);
                }
                
                duration = 400;
                break;
            }
            
            case 'pyreCard': {
                const flippedOwner = flipOwner(cmd.owner);
                const pyreGained = cmd.pyreGained || 1;
                const cardName = cmd.cardName || 'Pyre card';
                
                // Show message
                showMessage?.(`🔥 ${cardName}: +${pyreGained} Pyre`, 1200);
                
                // Play pyre burn animation
                if (window.CombatEffects?.playPyreBurn) {
                    window.CombatEffects.playPyreBurn(null, pyreGained);
                }
                
                // Flash pyre display
                const pyreDisplay = document.querySelector(`.player-info.${flippedOwner} .pyre-display`);
                if (pyreDisplay) {
                    pyreDisplay.classList.add('pyre-gained');
                    setTimeout(() => pyreDisplay.classList.remove('pyre-gained'), 600);
                }
                
                duration = 800;
                break;
            }
            
            case 'burnForPyre':
            case 'pyreBurn': {
                const flippedOwner = flipOwner(cmd.owner);
                const amount = cmd.amount || 1;
                
                // Play pyre burn visual effect
                if (window.CombatEffects?.playPyreBurn) {
                    window.CombatEffects.playPyreBurn(null, amount);
                }
                
                // Flash pyre display
                const pyreDisplay = document.querySelector(`.player-info.${flippedOwner} .pyre-display`);
                if (pyreDisplay) {
                    pyreDisplay.classList.add('pyre-gained');
                    setTimeout(() => pyreDisplay.classList.remove('pyre-gained'), 600);
                }
                
                showMessage?.(`🜂 PYRE BURN +${amount} 🜂`, 1200);
                duration = 800;
                break;
            }
            
            case 'burstCast': {
                if (typeof showMessage === 'function') {
                    showMessage(`✨ ${cmd.cardName || 'Burst'} cast!`, 1000);
                }
                duration = 400;
                break;
            }
            
            case 'trapSet': {
                if (typeof showMessage === 'function') {
                    showMessage('🪤 Trap set!', 800);
                }
                duration = 300;
                break;
            }
            
            case 'trapTriggered': {
                if (typeof showMessage === 'function') {
                    showMessage(`🪤 Trap triggered: ${cmd.trapKey}!`, 1000);
                }
                duration = 400;
                break;
            }
            
            case 'auraAttach': {
                const sprite = findSprite(cmd.targetOwner, cmd.targetCol, cmd.targetRow);
                if (sprite) {
                    sprite.classList.add('aura-attached');
                    setTimeout(() => sprite.classList.remove('aura-attached'), 500);
                }
                if (typeof showMessage === 'function') {
                    showMessage(`✨ ${cmd.auraName || 'Aura'} attached!`, 1000);
                }
                duration = 500;
                break;
            }
            
            case 'turnStart': {
                if (typeof showMessage === 'function') {
                    showMessage(`Turn ${cmd.turnNumber}: ${cmd.owner === 'player' ? 'Your' : 'Enemy'} turn`, 1000);
                }
                duration = 200;
                break;
            }
            
            case 'turnEnd': {
                duration = 100;
                break;
            }
            
            case 'message': {
                if (typeof showMessage === 'function') {
                    showMessage(cmd.text || cmd.message, cmd.duration || 1000);
                }
                duration = cmd.duration || 300;
                break;
            }
            
            case 'cardDraw': {
                if (typeof showMessage === 'function' && cmd.owner === 'enemy') {
                    showMessage('Enemy drew a card', 600);
                }
                duration = 200;
                break;
            }
            
            default:
                console.log('[MP] Unknown animation type:', type, cmd);
                duration = 100;
        }
        
        return duration;
    },
    
    /**
     * Play animations based on server events
     */
    playEventAnimations(events, onComplete) {
        if (!events || events.length === 0) {
            onComplete?.();
            return;
        }
        
        console.log('[MP] Playing', events.length, 'event animations');
        
        let index = 0;
        const self = this;
        
        const playNext = () => {
            if (index >= events.length) {
                onComplete?.();
                return;
            }
            
            const event = events[index++];
            const duration = self.playEventAnimation(event);
            
            // Move to next event after animation completes
            setTimeout(playNext, duration + 50);
        };
        
        playNext();
    },
    
    /**
     * Play animation for a single event
     * Returns duration in ms
     */
    playEventAnimation(event) {
        const type = event.type;
        let duration = 100;
        
        // Helper to find sprite
        const findSprite = (owner, col, row) => {
            return document.querySelector(
                `.cryptid-sprite[data-owner="${owner}"][data-col="${col}"][data-row="${row}"]`
            );
        };
        
        switch (type) {
            case 'cryptidSummoned': {
                const sprite = findSprite(event.owner, event.col, event.row);
                if (sprite && window.CombatEffects?.playSummonAnimation) {
                    window.CombatEffects.playSummonAnimation(sprite);
                }
                if (typeof showMessage === 'function') {
                    showMessage(`${event.cryptid?.name || 'Cryptid'} summoned!`, 1000);
                }
                duration = 500;
                break;
            }
            
            case 'attackDeclared': {
                const atkSprite = findSprite(event.attackerOwner, event.attackerCol, event.attackerRow);
                const tgtSprite = event.target ? findSprite(event.target.owner, event.target.col, event.target.row) : null;
                
                if (atkSprite && window.CombatEffects?.playEnhancedAttack) {
                    window.CombatEffects.playEnhancedAttack(atkSprite, event.attackerOwner, tgtSprite, event.damage);
                }
                duration = 500;
                break;
            }
            
            case 'damageDealt': {
                const sprite = findSprite(event.targetOwner, event.targetCol, event.targetRow);
                
                if (sprite && window.CombatEffects) {
                    // Show damage number
                    const cryptid = { col: event.targetCol, row: event.targetRow, owner: event.targetOwner };
                    window.CombatEffects.showDamageNumber(cryptid, event.amount, event.amount >= 5);
                    
                    // Impact effects
                    const battlefield = document.getElementById('battlefield-area');
                    if (battlefield) {
                        const rect = sprite.getBoundingClientRect();
                        const bfRect = battlefield.getBoundingClientRect();
                        const x = rect.left + rect.width/2 - bfRect.left;
                        const y = rect.top + rect.height/2 - bfRect.top;
                        
                        window.CombatEffects.createImpactFlash?.(x, y, 50 + event.amount * 8);
                        window.CombatEffects.createSparks?.(x, y, 5 + event.amount);
                    }
                    
                    sprite.classList.add('hit-recoil');
                    setTimeout(() => sprite.classList.remove('hit-recoil'), 250);
                }
                duration = 300;
                break;
            }
            
            case 'cryptidDied': {
                const sprite = findSprite(event.owner, event.col, event.row);
                
                if (sprite && window.CombatEffects?.playDramaticDeath) {
                    const rarity = event.cryptid?.rarity || 'common';
                    window.CombatEffects.playDramaticDeath(sprite, event.owner, rarity);
                }
                if (typeof showMessage === 'function') {
                    showMessage(`💀 ${event.cryptid?.name || 'Cryptid'} falls!`, 1200);
                }
                duration = 800;
                break;
            }
            
            case 'cryptidPromoted': {
                const sprite = findSprite(event.owner, event.toCol, event.row);
                if (sprite) {
                    sprite.classList.add('promoting');
                    setTimeout(() => sprite.classList.remove('promoting'), 400);
                }
                if (typeof showMessage === 'function') {
                    showMessage(`${event.cryptid?.name || 'Support'} promoted!`, 800);
                }
                duration = 500;
                break;
            }
            
            case 'statusApplied': {
                const sprite = findSprite(event.target?.owner, event.target?.col, event.target?.row);
                if (sprite) {
                    sprite.classList.add('status-applied');
                    setTimeout(() => sprite.classList.remove('status-applied'), 400);
                }
                duration = 300;
                break;
            }
            
            case 'pyreChanged': {
                if (typeof showMessage === 'function' && event.amount !== 0) {
                    const sign = event.amount > 0 ? '+' : '';
                    showMessage(`🔥 ${sign}${event.amount} Pyre`, 800);
                }
                duration = 200;
                break;
            }
            
            case 'phaseChange': {
                if (typeof showMessage === 'function') {
                    showMessage(`Phase: ${event.phase}`, 600);
                }
                duration = 200;
                break;
            }
            
            case 'turnStart': {
                if (typeof showMessage === 'function') {
                    showMessage(`Turn ${event.turnNumber}`, 800);
                }
                duration = 300;
                break;
            }
            
            case 'message': {
                if (typeof showMessage === 'function') {
                    showMessage(event.text, 1000);
                }
                duration = 200;
                break;
            }
            
            case 'abilityTriggered': {
                if (typeof showMessage === 'function') {
                    showMessage(`${event.cryptidKey}: ${event.abilityName}`, 800);
                }
                duration = 200;
                break;
            }
            
            default:
                console.log('[MP] Unknown event type:', type);
                duration = 100;
        }
        
        return duration;
    },
    
    /**
     * Apply authoritative state from server
     * This replaces local game state with server state
     */
    applyServerState(state) {
        if (!state) return;
        
        const g = window.game;
        if (!g) return;
        
        console.log('[MP] Applying server state');
        
        // Update fields
        g.playerField = this.deserializeField(state.playerField);
        g.enemyField = this.deserializeField(state.enemyField);
        
        // Update hand
        if (state.hand) {
            g.playerHand = state.hand.map(c => this.deserializeCard(c));
        }
        
        // Update kindling
        if (state.kindling) {
            g.playerKindling = state.kindling.map(k => this.deserializeCard(k));
        }
        
        // Update resources
        g.playerPyre = state.playerPyre ?? g.playerPyre;
        g.enemyPyre = state.enemyPyre ?? g.enemyPyre;
        
        // Update turn state
        g.currentTurn = state.isMyTurn ? 'player' : 'enemy';
        g.phase = state.phase || g.phase;
        g.turnNumber = state.turnNumber || g.turnNumber;
        
        // Update flags
        g.playerKindlingPlayedThisTurn = state.kindlingPlayed || false;
        g.playerPyreCardPlayedThisTurn = state.pyreCardPlayed || false;
        g.playerPyreBurnUsed = state.pyreBurnUsed || false;
        
        // Update game end state
        if (state.gameOver) {
            g.gameOver = true;
            // Handle win/loss
        }
    },
    
    /**
     * Deserialize field from server format
     * Server uses: col 0 = combat, col 1 = support
     * Client uses: col 0 = support, col 1 = combat
     * So we swap columns when converting
     */
    deserializeField(fieldData) {
        if (!fieldData) return [[null, null, null], [null, null, null]];
        
        // Swap columns: server col 0 -> client col 1, server col 1 -> client col 0
        const clientCol0 = fieldData[1]?.map(cryptidData => {
            const c = cryptidData ? this.deserializeCryptid(cryptidData) : null;
            if (c) c.col = 0; // Update cryptid's col to client convention
            return c;
        }) || [null, null, null];
        
        const clientCol1 = fieldData[0]?.map(cryptidData => {
            const c = cryptidData ? this.deserializeCryptid(cryptidData) : null;
            if (c) c.col = 1; // Update cryptid's col to client convention
            return c;
        }) || [null, null, null];
        
        return [clientCol0, clientCol1];
    },
    
    /**
     * Deserialize cryptid from server format
     */
    deserializeCryptid(data) {
        if (!data) return null;
        
        // Look up full card data from registry - check both cryptid and kindling
        const cardDef = window.CardRegistry?.getCryptid?.(data.key) || 
                       window.CardRegistry?.getKindling?.(data.key) ||
                       {};
        
        // Determine if cryptid can attack (not paralyzed, not tapped, not already attacked)
        // NOTE: No summoning sickness - cryptids can attack immediately
        const canAttack = !data.paralyzed && !data.tapped && !data.attackedThisTurn;
        
        return {
            ...cardDef,
            ...data,
            // Ensure required fields exist
            currentAtk: data.currentAtk ?? data.baseAtk ?? data.atk ?? cardDef.atk ?? 1,
            currentHp: data.currentHp ?? data.baseHp ?? data.hp ?? cardDef.hp ?? 1,
            maxHp: data.maxHp ?? data.hp ?? cardDef.hp ?? 1,
            name: data.name || cardDef.name || data.key,
            sprite: data.sprite || cardDef.sprite,
            canAttack: data.canAttack ?? canAttack,
            tapped: data.tapped ?? false,
            paralyzed: data.paralyzed ?? false,
            justSummoned: data.justSummoned ?? false
        };
    },
    
    /**
     * Deserialize card from server format  
     */
    deserializeCard(data) {
        if (!data) return null;
        
        // Look up full card data from registry if available
        const cardDef = window.CardRegistry?.getCryptid?.(data.key) || 
                       window.CardRegistry?.getBurst?.(data.key) ||
                       window.CardRegistry?.getTrap?.(data.key) ||
                       window.CardRegistry?.getAura?.(data.key) ||
                       window.CardRegistry?.getPyre?.(data.key) ||
                       window.CardRegistry?.getKindling?.(data.key) ||
                       {};
        
        return {
            ...cardDef,
            ...data
        };
    },
    
    /**
     * Handle turn changes after action resolves
     */
    handleTurnChanges(action, state) {
        if (!state) return;
        
        const wasMyTurn = this.isMyTurn;
        this.isMyTurn = state.isMyTurn;
        
        // Update game turn state
        const g = window.game;
        if (g) {
            g.currentTurn = state.isMyTurn ? 'player' : 'enemy';
            g.phase = state.phase;
        }
        
        // If turn changed to us, notify player
        if (!wasMyTurn && this.isMyTurn) {
            this.turnTimeRemaining = this.TURN_TIME;
            this.timerWarningShown = false;
            this.startTurnTimer(true);
            if (typeof showMessage === 'function') {
                showMessage("Your turn!", 1000);
            }
        } else if (wasMyTurn && !this.isMyTurn) {
            // Turn ended
            this.startTurnTimer(false);
        }
    },
    
    /**
     * Called when opponent ends their phase (legacy support)
     */
    onOpponentEndPhase() {
        this.isMyTurn = true;
        const g = window.game;
        if (g) {
            g.currentTurn = 'player';
            g.advancePhase?.();
            this.turnTimeRemaining = this.TURN_TIME;
            this.timerWarningShown = false;
            this.startTurnTimer(true);
            if (typeof showMessage === 'function') {
                showMessage("Your turn!", 1000);
            }
        }
    },

    // ==================== MATCHMAKING ====================
    
    async startMatchmaking(mode, deckId) {
        // Check if user is authenticated for multiplayer (skip in offline/dev mode)
        if (!window.Auth?.isAuthenticated && !window.isOfflineMode) {
            showMessage('Please sign in to play multiplayer!', 2000);
            LoginScreen.show();
            return;
        }
        
        this.mode = mode;
        this.deckId = deckId;
        
        try {
            await this.connect();
            this.isSearching = true;
            this.send({
                type: 'findMatch',
                mode,
                deckId,
                playerName: this.getPlayerName(),
                equippedBackground: PlayerData?.getEquippedBackground?.() || 'default'
            });
            
            const statusEl = document.getElementById('qp-status');
            if (statusEl) statusEl.textContent = 'Searching for opponent...';
        } catch (err) {
            console.error('[MP] Matchmaking failed:', err);
            const statusEl = document.getElementById('qp-status');
            if (statusEl) statusEl.innerHTML = '<span class="error">Failed to connect</span>';
        }
    },
    
    // Alias for backwards compatibility
    findMatch(mode, deckId) {
        return this.startMatchmaking(mode, deckId);
    },
    
    // Send forced summon (e.g., from Summon Storm card effect)
    sendForcedSummon(cardKey, col, row) {
        if (!this.isInMatch || !this.isMyTurn) return;
        // Convert client column to server convention
        const serverCol = 1 - col;
        this.sendGameAction('summonKindling', {
            kindlingId: cardKey, // For forced summons, we use key as ID
            cardKey: cardKey,
            cardName: cardKey,
            col: serverCol,
            row: row,
            isKindling: true,
            forced: true
        });
    },
    
    // Action methods for backwards compatibility with ability buttons
    actionActivateAbility(abilityName, col, row, extraData) {
        if (!this.isInMatch || !this.isMyTurn || this.processingOpponentAction) return;
        // Convert client column to server convention
        const serverCol = 1 - col;
        this.sendGameAction('activateAbility', Object.assign({ 
            abilityName: abilityName, 
            col: serverCol, 
            row: row 
        }, extraData || {}));
    },
    
    cancelMatchmaking() {
        this.isSearching = false;
        this.send({ type: 'cancelMatch' });
        const statusEl = document.getElementById('qp-status');
        if (statusEl) statusEl.textContent = '';
    },
    
    onMatchFound(msg) {
        console.log('[MP] Match found!', msg);
        console.log('[MP] isRematch:', msg.isRematch);
        
        this.isSearching = false;
        this.isInMatch = true;
        this.matchId = msg.matchId;
        this.opponentId = msg.opponentId;
        this.opponentName = msg.opponentName || 'Opponent';
        this.opponentBackground = msg.opponentBackground || null; // Store opponent's equipped background
        window.opponentBackground = this.opponentBackground; // Expose for background system
        this.playerWins = 0;
        this.opponentWins = 0;
        this.currentGame = 1;
        this.playerTimeouts = 0;
        this.opponentTimeouts = 0;
        this.turnTimeRemaining = this.TURN_TIME;
        
        // Start time synchronization for coordinated animations
        this.startTimeSync();
        
        // Reset deck data flag for new match
        this.deckDataSent = false;
        this.awaitingServerResponse = false;
        
        const statusEl = document.getElementById('qp-status');
        if (statusEl) statusEl.innerHTML = '<span style="color:#80e080;">Match found!</span>';
        
        // Close WinScreen if it's open (for rematch)
        if (msg.isRematch && typeof WinScreen !== 'undefined' && WinScreen.isOpen) {
            console.log('[MP] Closing WinScreen for rematch');
            WinScreen.hide();
        }
        
        if (typeof HomeScreen !== 'undefined') {
            HomeScreen.onMatchFound({
                matchId: msg.matchId,
                opponentName: this.opponentName,
                mode: this.mode,
                goesFirst: msg.goesFirst,
                isRematch: msg.isRematch
            });
        }
    },

    // ==================== TIMER ====================
    
    startTurnTimer(isPlayerTurn) {
        this.stopTurnTimer();
        
        if (!isPlayerTurn) {
            // Not our turn - just update display to show waiting state
            this.updateTimerDisplay();
            return; // Don't start countdown timer for opponent's turn
        }
        
        // Our turn - start countdown
        this.turnTimer = setInterval(() => {
            if (!this.isMyTurn) {
                // Turn ended, stop timer
                this.stopTurnTimer();
                return;
            }
            
            this.turnTimeRemaining--;
            this.updateTimerDisplay();
            
            if (this.turnTimeRemaining <= this.WARNING_TIME && !this.timerWarningShown) {
                this.timerWarningShown = true;
                showMessage('30 seconds remaining!');
            }
            
            if (this.turnTimeRemaining <= 0) {
                this.stopTurnTimer();
                this.handleTimeout();
            }
        }, 1000);
    },
    
    stopTurnTimer() {
        if (this.turnTimer) {
            clearInterval(this.turnTimer);
            this.turnTimer = null;
        }
    },
    
    updateTimerDisplay() {
        const el = document.getElementById('mp-turn-timer');
        if (el) {
            if (this.isMyTurn) {
                const m = Math.floor(this.turnTimeRemaining / 60);
                const s = this.turnTimeRemaining % 60;
                el.textContent = m + ':' + s.toString().padStart(2, '0');
                el.classList.toggle('warning', this.turnTimeRemaining <= this.WARNING_TIME);
                el.classList.remove('waiting');
            } else {
                el.textContent = "Opponent's Turn";
                el.classList.remove('warning');
                el.classList.add('waiting');
            }
        }
    },
    
    handleTimeout() {
        this.playerTimeouts++;
        showMessage("Time's up! (" + this.playerTimeouts + '/' + this.TIMEOUT_FORFEIT + ')');
        
        if (this.playerTimeouts >= this.TIMEOUT_FORFEIT) {
            this.forfeitMatch('timeout');
        } else {
            this.sendGameAction('endPhase');
            this.isMyTurn = false;
            window.game.currentTurn = 'enemy';
            window.game.phase = 'waiting';
            this.turnTimeRemaining = this.TURN_TIME;
            this.timerWarningShown = false;
            this.startTurnTimer(false);
        }
    },

    // ==================== GAME END ====================
    
    onGameEnd(msg) {
        const won = msg.winner === this.playerId;
        if (this.mode === 'bo3') {
            if (won) this.playerWins++; else this.opponentWins++;
            if (this.playerWins >= 2 || this.opponentWins >= 2) {
                this.onMatchEnd({ winner: won ? this.playerId : this.opponentId });
            } else {
                this.currentGame++;
                showMessage('Game over! Score: ' + this.playerWins + '-' + this.opponentWins);
            }
        } else {
            this.onMatchEnd(msg);
        }
    },
    
    onMatchEnd(msg) {
        const won = msg.winner === this.playerId;
        this.stopTurnTimer();
        this.stopTimeSync();  // Stop time sync pings
        this.isInMatch = false;
        this.isMyTurn = false;
        
        const g = window.game;
        if (g && !g.gameOver) {
            g.gameOver = true;
            
            // Calculate match duration
            const duration = Math.floor((Date.now() - (g.matchStats?.startTime || Date.now())) / 1000);
            
            // Prepare match data for win screen
            const matchData = {
                isWin: won,
                isHuman: true, // Multiplayer match against human
                isMultiplayer: true,
                stats: {
                    kills: g.enemyDeaths || 0,
                    playerDeaths: g.playerDeaths || 0,
                    damageDealt: g.matchStats?.damageDealt || 0,
                    turns: g.turnNumber || 0,
                    spellsCast: g.matchStats?.spellsCast || 0,
                    evolutions: g.matchStats?.evolutions || 0,
                    perfectWin: (g.playerDeaths === 0) && won
                },
                duration,
                deckName: 'Battle Deck',
                opponentName: this.opponentName
            };
            
            // Deal Slide transition to results screen
            TransitionEngine.slide(() => {
                if (typeof WinScreen !== 'undefined' && WinScreen.show) {
                    WinScreen.show(matchData);
                } else {
                    g.endGame(won ? 'player' : 'enemy');
                }
            });
        }
        
        // Award embers and XP
        const base = this.mode === 'bo3' 
            ? { win: 30, lose: 12, winXP: 50, loseXP: 25 }
            : { win: 15, lose: 5, winXP: 20, loseXP: 10 };
        
        if (typeof PlayerData !== 'undefined') {
            PlayerData.embers = (PlayerData.embers || 0) + (won ? base.win : base.lose);
            PlayerData.xp = (PlayerData.xp || 0) + (won ? base.winXP : base.loseXP);
            if (typeof PlayerData.save === 'function') PlayerData.save();
        }
    },
    
    onOpponentDisconnected() {
        showMessage('Opponent disconnected...');
        this.showDisconnectOverlay(60);
    },
    
    // ==================== REMATCH SYSTEM ====================
    
    sendRematchRequest() {
        console.log('[MP] sendRematchRequest called, matchId:', this.matchId);
        if (!this.matchId) {
            console.error('[MP] Cannot send rematch request - no matchId!');
            return;
        }
        const msg = { 
            type: 'rematch_request', 
            matchId: this.matchId 
        };
        console.log('[MP] Sending rematch request:', msg);
        this.send(msg);
    },
    
    leaveResultsScreen() {
        const matchId = this.matchId;  // Save before reset
        if (!matchId) return;
        this.send({ 
            type: 'leave_results', 
            matchId: matchId 
        });
        this.resetMatchState();
    },
    
    onRematchRequest() {
        // Called when opponent requests rematch
        // WinScreen will hook into this
    },
    
    onOpponentLeftResults() {
        // Called when opponent leaves the results screen
        // WinScreen will hook into this
    },
    
    onRematchAccepted() {
        // Called when both players agree to rematch
        // WinScreen will hook into this
    },
    
    // startRematch is handled by server when both players click rematch
    // Server sends matchFound to both players automatically
    
    handleRematchMessage(msg) {
        console.log('[MP] handleRematchMessage:', msg.type);
        switch (msg.type) {
            case 'rematch_requested':
                // Opponent wants a rematch
                console.log('[MP] Opponent requested rematch');
                if (typeof this.onRematchRequest === 'function') {
                    this.onRematchRequest();
                }
                break;
                
            case 'opponent_left_results':
                // Opponent left the results screen
                console.log('[MP] Opponent left results screen');
                if (typeof this.onOpponentLeftResults === 'function') {
                    this.onOpponentLeftResults();
                }
                break;
                
            case 'rematch_accepted':
                // Both players agreed - start new match
                console.log('[MP] Rematch accepted! Server will send matchFound');
                if (typeof this.onRematchAccepted === 'function') {
                    this.onRematchAccepted();
                }
                // The server will send a new matchFound message
                break;
        }
    },
    
    forfeitMatch(reason) {
        if (!this.isInMatch) return;
        this.send({ type: 'forfeit', matchId: this.matchId, reason: reason || 'manual' });
        showMessage('Match forfeited');
        this.resetMatchState();
    },
    
    resetMatchState() {
        this.isInMatch = false;
        this.isSearching = false;
        this.isMyTurn = false;
        this.matchId = null;
        this.opponentId = null;
        this.stopTurnTimer();
        this.hideMultiplayerUI();
        if (window.game) window.game.isMultiplayer = false;
        
        // Clear animation queue
        this.animationQueue = [];
        this.isPlayingAnimation = false;
        this.processingOpponentAction = false;
    },

    // ==================== UI ====================
    
    showMultiplayerUI() {
        const hud = document.getElementById('hud');
        if (!hud) return;
        
        if (!document.getElementById('mp-hud-center')) {
            const center = document.createElement('div');
            center.id = 'mp-hud-center';
            center.className = 'mp-hud-center';
            center.innerHTML = '<div class="mp-timer-compact"><span class="mp-turn-timer" id="mp-turn-timer">2:30</span></div><div class="mp-vs-info"><span class="mp-vs-label">VS</span><span class="mp-opponent-name" id="mp-opponent-name">' + this.opponentName + '</span></div><div class="mp-score" id="mp-score"></div><button class="mp-menu-btn" id="mp-options-btn">☰</button>';
            const playerInfo = hud.querySelector('.player-info.player');
            if (playerInfo) playerInfo.after(center);
            else hud.appendChild(center);
        }
        
        if (!document.getElementById('mp-hybrid-menu')) {
            const menu = document.createElement('div');
            menu.id = 'mp-hybrid-menu';
            menu.className = 'mp-hybrid-menu';
            menu.innerHTML = '<div class="mp-hybrid-header"><span class="mp-hybrid-title">📜 Chronicle</span><button class="mp-hybrid-close" id="mp-hybrid-close">✕</button></div><div class="mp-hybrid-chronicle" id="mp-hybrid-chronicle"></div><div class="mp-hybrid-divider"></div><div class="mp-hybrid-actions"><button class="mp-hybrid-action forfeit" id="mp-forfeit-btn">🏳️ Forfeit</button></div>';
            document.body.appendChild(menu);
            
            const backdrop = document.createElement('div');
            backdrop.id = 'mp-menu-backdrop';
            backdrop.className = 'mp-menu-backdrop';
            document.body.appendChild(backdrop);
        }
        
        if (!document.getElementById('mp-disconnect-overlay')) {
            const overlay = document.createElement('div');
            overlay.id = 'mp-disconnect-overlay';
            overlay.className = 'mp-disconnect-overlay';
            overlay.innerHTML = '<div class="mp-disconnect-content"><div class="mp-disconnect-icon">📡</div><div class="mp-disconnect-title">Opponent Disconnected</div><div class="mp-disconnect-timer" id="mp-disconnect-timer">60</div></div>';
            document.body.appendChild(overlay);
        }
        
        document.getElementById('mp-options-btn')?.addEventListener('click', () => this.toggleMenu());
        document.getElementById('mp-hybrid-close')?.addEventListener('click', () => this.hideMenu());
        document.getElementById('mp-forfeit-btn')?.addEventListener('click', () => {
            if (confirm('Forfeit match?')) this.forfeitMatch('manual');
        });
        document.getElementById('mp-menu-backdrop')?.addEventListener('click', () => this.hideMenu());
        
        document.getElementById('mp-hud-center')?.classList.add('visible');
        document.body.classList.add('multiplayer-active');
        
        if (this.mode === 'bo3') {
            const score = document.getElementById('mp-score');
            if (score) score.textContent = this.playerWins + ' - ' + this.opponentWins;
        }
    },
    
    hideMultiplayerUI() {
        document.getElementById('mp-hud-center')?.classList.remove('visible');
        document.getElementById('mp-hybrid-menu')?.classList.remove('visible');
        document.getElementById('mp-menu-backdrop')?.classList.remove('visible');
        document.getElementById('mp-disconnect-overlay')?.classList.remove('visible');
        document.body.classList.remove('multiplayer-active');
    },
    
    toggleMenu() {
        const menu = document.getElementById('mp-hybrid-menu');
        const backdrop = document.getElementById('mp-menu-backdrop');
        if (menu?.classList.contains('visible')) {
            this.hideMenu();
        } else {
            const src = document.getElementById('event-log-entries');
            const tgt = document.getElementById('mp-hybrid-chronicle');
            if (src && tgt) {
                tgt.innerHTML = src.innerHTML;
                tgt.scrollTop = tgt.scrollHeight;
            }
            menu?.classList.add('visible');
            backdrop?.classList.add('visible');
        }
    },
    
    hideMenu() {
        document.getElementById('mp-hybrid-menu')?.classList.remove('visible');
        document.getElementById('mp-menu-backdrop')?.classList.remove('visible');
    },
    
    showDisconnectOverlay(seconds) {
        const overlay = document.getElementById('mp-disconnect-overlay');
        if (overlay) {
            overlay.classList.add('visible');
            const timer = document.getElementById('mp-disconnect-timer');
            if (timer) timer.textContent = seconds;
        }
    },
    
    hideDisconnectOverlay() {
        document.getElementById('mp-disconnect-overlay')?.classList.remove('visible');
    }
};

// ==================== MULTIPLAYER HOOK ====================

window.multiplayerHook = {
    shouldSend() {
        return window.game?.isMultiplayer && 
               Multiplayer.isInMatch && 
               Multiplayer.isMyTurn &&
               !Multiplayer.processingOpponentAction;
    },
    
    onSummon(card, owner, col, row) {
        if (!this.shouldSend() || owner !== 'player') return;
        
        const g = window.game;
        const combatCol = g?.getCombatCol(owner);
        const isCombatPosition = col === combatCol;
        
        // Convert client column to server column convention
        // Client: player combat=1, support=0 | Server: player combat=0, support=1
        const serverCol = 1 - col;
        
        // Determine action type based on whether this is a kindling summon
        if (card.isKindling) {
            // Kindling summons use different action and ID field
            const summonData = {
                kindlingId: card.id,   // Server expects kindlingId for kindling
                cardKey: card.key,
                cardName: card.name,
                col: serverCol,
                row: row
            };
            console.log('[MP] Sending kindling summon:', { id: card.id, key: card.key, name: card.name, summonData });
            Multiplayer.sendGameAction('summonKindling', summonData);
        } else {
            // Regular cryptid summons from hand
            const summonData = {
                cardId: card.id,       // Server expects cardId (unique instance ID)
                cardKey: card.key,     // Also send key for fallback/debugging
                cardName: card.name,
                col: serverCol,        // Use server's column convention
                row: row
            };
            
            // Include on-enter-combat effect info for opponent to animate
            if (isCombatPosition && card.onEnterCombat) {
                // Check for specific effect types
                if (card.key === 'mothman') {
                    summonData.onEnterCombatEffect = {
                        type: 'calamityAll',
                        stacks: 3,
                        targetDescription: 'all enemy combatants'
                    };
                } else if (card.key === 'theFlayer' || card.key === 'bogeyman') {
                    summonData.onEnterCombatEffect = {
                        type: 'paralyzeEnemies',
                        targetDescription: 'enemies across'
                    };
                }
            }
            
            Multiplayer.sendGameAction('summon', summonData);
        }
    },
    
    onAttack(attacker, targetOwner, targetCol, targetRow, targetKey, attackData) {
        if (!this.shouldSend() || attacker.owner !== 'player') return;
        
        // Convert client columns to server convention (flip: server uses opposite col assignments)
        const serverAttackerCol = 1 - attacker.col;
        const serverTargetCol = 1 - targetCol;
        
        // Support both old format (targetDied, supportDied as booleans) and new format (attackData object)
        let data;
        if (typeof attackData === 'object' && attackData !== null) {
            // New enhanced format
            data = {
                attackerCol: serverAttackerCol,
                attackerRow: attacker.row,
                attackerKey: attacker.key,
                hasDestroyer: attacker.hasDestroyer || false,
                targetOwner: targetOwner,
                targetCol: serverTargetCol,
                targetRow: targetRow,
                targetKey: targetKey || null,
                damage: attackData.damage || 0,
                targetDied: attackData.targetDied || false,
                supportDied: attackData.supportDied || false,
                protectionBlocked: attackData.protectionBlocked || false,
                explosionInfo: attackData.explosionInfo || null,
                destroyerInfo: attackData.destroyerInfo || null
            };
        } else {
            // Old format for backwards compatibility
            data = {
                attackerCol: serverAttackerCol,
                attackerRow: attacker.row,
                attackerKey: attacker.key,
                hasDestroyer: attacker.hasDestroyer || false,
                targetOwner: targetOwner,
                targetCol: serverTargetCol,
                targetRow: targetRow,
                targetKey: targetKey || null,
                damage: 0,
                targetDied: attackData || false, // attackData was targetDied in old format
                supportDied: targetKey || false  // targetKey position was used for supportDied
            };
        }
        
        Multiplayer.sendGameAction('attack', data);
    },
    
    onBurst(card, targetOwner, targetCol, targetRow, effectData) {
        if (!this.shouldSend()) return;
        // Convert client column to server convention
        const serverTargetCol = 1 - targetCol;
        Multiplayer.sendGameAction('playBurst', {
            cardId: card.id,
            cardKey: card.key,
            cardName: card.name,
            targetOwner: targetOwner,
            targetCol: serverTargetCol,
            targetRow: targetRow,
            damage: effectData?.damage || 0,
            healing: effectData?.healing || 0,
            targetDied: effectData?.targetDied || false
        });
    },
    
    onTrap(card, row) {
        if (!this.shouldSend()) return;
        Multiplayer.sendGameAction('playTrap', {
            cardId: card.id,
            cardKey: card.key,
            cardName: card.name,
            row: row
        });
    },
    
    onAura(card, col, row) {
        if (!this.shouldSend()) return;
        // Convert client column to server convention
        const serverCol = 1 - col;
        Multiplayer.sendGameAction('playAura', {
            cardId: card.id,
            cardKey: card.key,
            cardName: card.name,
            col: serverCol,
            row: row
        });
    },
    
    onPyre(card) {
        if (!this.shouldSend()) return;
        Multiplayer.sendGameAction('playPyre', {
            cardId: card.id,
            cardKey: card.key,
            cardName: card.name
        });
    },
    
    onEvolve(card, col, row) {
        if (!this.shouldSend()) return;
        // Convert client column to server convention
        const serverTargetCol = 1 - col;
        Multiplayer.sendGameAction('evolve', {
            cardId: card.id,
            cardKey: card.key,
            cardName: card.name,
            targetCol: serverTargetCol,
            targetRow: row
        });
    },
    
    onPyreBurn(deathCount) {
        if (!this.shouldSend()) return;
        Multiplayer.sendGameAction('burnForPyre', { deathCount: deathCount });
    },
    
    onActivateAbility(abilityName, col, row, extra) {
        if (!this.shouldSend()) return;
        // Convert client column to server convention
        const serverCol = 1 - col;
        Multiplayer.sendGameAction('activateAbility', Object.assign({ abilityName: abilityName, col: serverCol, row: row }, extra || {}));
    },
    
    onEndPhase() {
        if (!this.shouldSend()) return;
        Multiplayer.sendGameAction('endPhase');
        Multiplayer.isMyTurn = false;
        Multiplayer.stopTurnTimer();
        window.game.currentTurn = 'enemy';
        window.game.phase = 'waiting';
        Multiplayer.turnTimeRemaining = Multiplayer.TURN_TIME;
        Multiplayer.timerWarningShown = false;
        Multiplayer.startTurnTimer(false);
    }
};

// ==================== MATCH INITIALIZATION ====================

window.showMultiplayerCoinFlip = function(goesFirst, opponentName, onComplete) {
    var overlay = document.getElementById('turn-order-overlay');
    if (!overlay) {
        console.warn('[MP] Turn order overlay not found');
        if (onComplete) onComplete();
        return;
    }
    
    var contestants = overlay.querySelectorAll('.contestant');
    var fateDecider = overlay.querySelector('.fate-decider');
    var fateCoin = overlay.querySelector('.fate-coin');
    var result = overlay.querySelector('.turn-order-result');
    var winnerName = result ? result.querySelector('.winner-name') : null;
    
    var playerLabel = contestants[0] ? contestants[0].querySelector('.contestant-label') : null;
    var opponentLabel = contestants[1] ? contestants[1].querySelector('.contestant-label') : null;
    if (playerLabel) playerLabel.textContent = 'You';
    if (opponentLabel) opponentLabel.textContent = opponentName || 'Opponent';
    
    overlay.classList.add('active');
    
    setTimeout(function() { if (contestants[0]) contestants[0].classList.add('reveal'); }, 400);
    setTimeout(function() { if (contestants[1]) contestants[1].classList.add('reveal'); }, 600);
    setTimeout(function() { if (fateDecider) fateDecider.classList.add('active'); }, 1000);
    setTimeout(function() {
        if (fateCoin) {
            fateCoin.classList.add('stopped');
            fateCoin.style.transform = goesFirst ? 'rotateY(0deg)' : 'rotateY(180deg)';
        }
    }, 2200);
    setTimeout(function() {
        if (goesFirst) {
            if (contestants[0]) contestants[0].classList.add('winner');
            if (contestants[1]) contestants[1].classList.add('loser');
            if (winnerName) winnerName.textContent = 'You';
        } else {
            if (contestants[1]) contestants[1].classList.add('winner');
            if (contestants[0]) contestants[0].classList.add('loser');
            if (winnerName) winnerName.textContent = opponentName || 'Opponent';
        }
        if (result) result.classList.add('show');
    }, 2600);
    setTimeout(function() {
        overlay.classList.remove('active');
        setTimeout(function() {
            contestants.forEach(function(c) { if (c) c.classList.remove('reveal', 'winner', 'loser'); });
            if (fateDecider) fateDecider.classList.remove('active');
            if (fateCoin) { fateCoin.classList.remove('stopped'); fateCoin.style.transform = ''; }
            if (result) result.classList.remove('show');
            if (playerLabel) playerLabel.textContent = 'Seeker';
            if (opponentLabel) opponentLabel.textContent = 'Warden';
            if (onComplete) onComplete();
        }, 500);
    }, 4200);
};

window.startMultiplayerGame = function(matchData) {
    console.log('[MP] Starting game:', matchData);
    console.log('[MP] Multiplayer.deckId:', Multiplayer.deckId);
    console.log('[MP] Multiplayer.mode:', Multiplayer.mode);
    
    if (typeof HomeScreen !== 'undefined') HomeScreen.close();
    
    // Make sure WinScreen is closed
    if (typeof WinScreen !== 'undefined' && WinScreen.isOpen) {
        console.log('[MP] Closing WinScreen');
        WinScreen.hide();
    }
    
    document.getElementById('game-container').style.display = 'flex';
    var mainMenu = document.getElementById('main-menu');
    if (mainMenu) mainMenu.classList.add('hidden');
    
    window.showMultiplayerCoinFlip(matchData.goesFirst, matchData.opponentName, function() {
        initializeMultiplayerMatch(matchData);
    });
};

function initializeMultiplayerMatch(matchData) {
    var deck = PlayerData.decks.find(function(d) { return d.id === Multiplayer.deckId; });
    if (!deck) {
        console.error('[MP] Deck not found:', Multiplayer.deckId);
        showMessage('Deck not found!');
        return;
    }
    
    console.log('[MP] Using deck:', deck.name);
    
    document.getElementById('game-container').style.display = 'flex';
    var mainMenu = document.getElementById('main-menu');
    if (mainMenu) mainMenu.classList.add('hidden');
    
    if (typeof window.initMultiplayerGame === 'function') {
        window.initMultiplayerGame();
    } else {
        console.error('[MP] initMultiplayerGame not found!');
        return;
    }
    
    var g = window.game;
    if (!g) {
        console.error('[MP] Game not initialized');
        return;
    }
    
    var deckCards = [];
    var kindlingCards = [];
    
    deck.cards.forEach(function(entry) {
        var kindling = CardRegistry.getKindling(entry.cardKey);
        if (kindling) {
            kindlingCards.push(Object.assign({}, kindling, { 
                foil: entry.foil,
                instanceId: Math.random().toString(36).substr(2, 9)
            }));
            return;
        }
        
        var card = CardRegistry.getCryptid(entry.cardKey) || 
                   CardRegistry.getBurst(entry.cardKey) ||
                   CardRegistry.getTrap(entry.cardKey) ||
                   CardRegistry.getAura(entry.cardKey) ||
                   CardRegistry.getPyre(entry.cardKey);
        if (card) {
            deckCards.push(Object.assign({}, card, { 
                foil: entry.foil,
                instanceId: Math.random().toString(36).substr(2, 9)
            }));
        }
    });
    
    console.log('[MP] Deck:', deckCards.length, 'cards,', kindlingCards.length, 'kindling');
    
    g.isMultiplayer = true;
    g.multiplayerData = matchData;
    
    g.deck = deckCards.slice();
    for (var i = g.deck.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = g.deck[i];
        g.deck[i] = g.deck[j];
        g.deck[j] = temp;
    }
    
    g.playerHand = [];
    g.enemyHand = [];
    g.playerField = [[null, null, null], [null, null, null]];
    g.enemyField = [[null, null, null], [null, null, null]];
    g.playerPyre = 0;
    g.enemyPyre = 0;
    g.playerTraps = [null, null];
    g.enemyTraps = [null, null];
    g.playerBurnPile = [];
    g.playerDiscardPile = [];
    g.enemyDeck = [];
    g.enemyBurnPile = [];
    g.enemyDiscardPile = [];
    
    if (kindlingCards.length > 0) {
        g.playerKindling = kindlingCards;
        // In multiplayer, enemyKindling will be set when we receive opponent's kindling sync
        // For now, set to empty - will be populated by kindling exchange
        g.enemyKindling = [];
    } else if (typeof DeckBuilder !== 'undefined' && DeckBuilder.buildKindlingPool) {
        g.playerKindling = DeckBuilder.buildKindlingPool();
        g.enemyKindling = [];
    } else {
        g.playerKindling = [];
        g.enemyKindling = [];
    }
    
    // Send our kindling pool to opponent
    Multiplayer.sendKindlingSync(kindlingCards.length > 0 ? kindlingCards : g.playerKindling);
    
    g.playerDeaths = 0;
    g.enemyDeaths = 0;
    g.playerPyreBurnUsed = false;
    g.enemyPyreBurnUsed = false;
    
    g.currentTurn = matchData.goesFirst ? 'player' : 'enemy';
    g.phase = matchData.goesFirst ? 'conjure1' : 'waiting';
    g.turnNumber = 1;
    
    if (matchData.goesFirst) {
        g.playerPyre = 1;
        g.playerKindlingPlayedThisTurn = false;
        g.playerPyreCardPlayedThisTurn = false;
        GameEvents.emit('onTurnStart', { owner: 'player', turnNumber: 1 });
        GameEvents.emit('onPyreGained', { owner: 'player', amount: 1, source: 'turnStart' });
    } else {
        g.enemyPyre = 1;
        g.enemyKindlingPlayedThisTurn = false;
        g.enemyPyreCardPlayedThisTurn = false;
    }
    
    Multiplayer.isMyTurn = matchData.goesFirst;
    
    for (var i = 0; i < 7; i++) {
        g.drawCard('player');
    }
    
    var enemyHandSize = matchData.goesFirst ? 6 : 7;
    g.enemyHand = [];
    for (var i = 0; i < enemyHandSize; i++) {
        g.enemyHand.push({});
    }
    
    Multiplayer.showMultiplayerUI();
    Multiplayer.startTurnTimer(matchData.goesFirst);
    Multiplayer.updateTimerDisplay();
    
    // Apply any kindling sync that arrived before game was ready
    Multiplayer.applyPendingKindlingSync();
    
    // Block all input during match start sequence
    if (typeof window.setAnimating === 'function') {
        window.setAnimating(true);
    }
    
    // Hide hand BEFORE rendering if we're going to animate (class bypasses transition)
    var shouldAnimateHand = window.CombatEffects && typeof window.CombatEffects.playStartingHandAnimation === 'function';
    var handContainer = document.getElementById('hand-container');
    if (shouldAnimateHand && handContainer) {
        handContainer.classList.add('drawing-animation');
    }
    
    if (typeof renderAll === 'function') renderAll();
    if (typeof updateButtons === 'function') updateButtons();
    
    // Function to play the match start sequence after hand is revealed
    var playMatchStartSequence = function() {
        // Step 1: Show "BATTLE!" banner
        if (window.CombatEffects && window.CombatEffects.playBattleBanner) {
            window.CombatEffects.playBattleBanner(function() {
                // Step 2: After BATTLE banner, show turn banner
                setTimeout(function() {
                    var turnOwner = matchData.goesFirst ? 'player' : 'enemy';
                    if (window.CombatEffects && window.CombatEffects.playTurnTransition) {
                        window.CombatEffects.playTurnTransition(turnOwner, function() {
                            // Actions enabled by playTurnTransition callback
                        });
                    } else {
                        if (typeof window.setAnimating === 'function') {
                            window.setAnimating(false);
                        }
                    }
                }, 300);
            });
        } else {
            // Fallback to simple messages if CombatEffects not available
            showMessage("⚔ BATTLE! ⚔", 1200);
            setTimeout(function() {
                showMessage(matchData.goesFirst ? "Your Turn" : (matchData.opponentName || 'Opponent') + "'s Turn", 1500);
                setTimeout(function() {
                    if (typeof window.setAnimating === 'function') {
                        window.setAnimating(false);
                    }
                }, 1200);
            }, 1000);
        }
    };
    
    setTimeout(function() {
        if (typeof window.calculateTilePositions === 'function') {
            window.calculateTilePositions();
        }
        
        // Play starting hand animation after positions calculated
        if (shouldAnimateHand) {
            window.CombatEffects.playStartingHandAnimation(g.playerHand.length, function() {
                var hc = document.getElementById('hand-container');
                if (hc) {
                    hc.classList.remove('drawing-animation');
                }
                if (typeof renderHandAnimated === 'function') {
                    renderHandAnimated();
                }
                
                // Wait for hand reveal animation, then play match start sequence
                setTimeout(function() {
                    playMatchStartSequence();
                }, 600);
            });
        } else {
            // No animation - start sequence immediately
            playMatchStartSequence();
        }
    }, 100);
    
    // TEMPORARY: Enable cheat mode for multiplayer testing
    // Remove this block when done testing!
    if (typeof CheatMode !== 'undefined') {
        setTimeout(function() {
            CheatMode.start();
            console.log('[MP] Cheat mode enabled for testing');
        }, 200);
    }
    
    console.log('[MP] Game started');
}

console.log('[Multiplayer] System loaded');

// Alias for compatibility
window.MultiplayerClient = window.Multiplayer;