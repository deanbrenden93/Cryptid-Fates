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
            
            // Mutated Rat support tracking
            mutatedRatSupport: cryptid.mutatedRatSupport ? { col: cryptid.mutatedRatSupport.col, row: cryptid.mutatedRatSupport.row } : null,
            
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
    
    sendGameAction(actionType, details = {}) {
        if (!this.isInMatch || !this.isMyTurn) {
            console.warn('[MP] Cannot send - not in match or not our turn');
            return;
        }
        
        const msg = {
            type: 'action',
            matchId: this.matchId,
            playerId: this.playerId,
            action: { type: actionType, ...details },
            state: this.serializeGameState()
        };
        
        console.log('[MP] Sending:', actionType);
        this.send(msg);
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
        
        // For attacks that killed something, we need to animate BEFORE state change
        // so the death animation shows the correct cryptid
        const shouldAnimateBeforeState = action.type === 'attack' && (action.targetDied || action.supportDied);
        
        if (shouldAnimateBeforeState) {
            // Play animation FIRST on current DOM state
            this.playAnimation(action, () => {
                // THEN apply state after animation shows the death
                if (state) {
                    this.applyReceivedState(state);
                }
                
                requestAnimationFrame(() => {
                    if (typeof renderAll === 'function') renderAll();
                    requestAnimationFrame(() => {
                        if (typeof updateButtons === 'function') updateButtons();
                    });
                    
                    this.isPlayingAnimation = false;
                    this.processingOpponentAction = this.animationQueue.length > 0;
                    setTimeout(() => this.processAnimationQueue(), 50);
                });
            });
        } else {
            // For non-death actions, apply state first (original behavior)
            if (state) {
                this.applyReceivedState(state);
            }
            
            // Force render with requestAnimationFrame for reliable browser repaint
            requestAnimationFrame(() => {
                if (typeof renderAll === 'function') renderAll();
                
                // Small delay to ensure DOM is fully updated before animation
                setTimeout(() => {
                    // THEN: Play animation on the now-stable DOM
                    this.playAnimation(action, () => {
                        // After animation, update buttons
                        requestAnimationFrame(() => {
                            if (typeof updateButtons === 'function') updateButtons();
                        });
                        
                        if (action.type === 'endPhase') {
                            this.handleOpponentEndTurn();
                        }
                        
                        // Mark animation complete and process next in queue
                        this.isPlayingAnimation = false;
                        this.processingOpponentAction = this.animationQueue.length > 0;
                        
                        // Process next queued action
                        setTimeout(() => this.processAnimationQueue(), 50);
                    });
                }, 50); // 50ms delay for DOM to settle
            });
        }
    },
    
    playAnimation(action, onComplete) {
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
                    } else if (attempts < 3) {
                        attempts++;
                        setTimeout(findAndAnimate, 50);
                    }
                };
                findAndAnimate();
                
                setTimeout(safeComplete, TIMING.summon);
                break;
            }
            
            case 'attack': {
                const atkCol = 1 - action.attackerCol;
                const tgtCol = 1 - action.targetCol;
                
                const atkSprite = document.querySelector(`.cryptid-sprite[data-owner="enemy"][data-col="${atkCol}"][data-row="${action.attackerRow}"]`);
                const tgtSprite = document.querySelector(`.cryptid-sprite[data-owner="player"][data-col="${tgtCol}"][data-row="${action.targetRow}"]`);
                
                // Use enhanced attack animation if available
                if (window.CombatEffects?.playEnhancedAttack && atkSprite) {
                    const damage = action.damage || 3;
                    window.CombatEffects.playEnhancedAttack(atkSprite, 'enemy', tgtSprite, damage, 
                        // onImpact - damage effects
                        () => {
                            // Show death animation if target died (dramatic death handles itself)
                            if (action.targetDied && tgtSprite && window.CombatEffects?.playDramaticDeath) {
                                const rarity = tgtSprite.className.match(/rarity-(\w+)/)?.[1] || 'common';
                                window.CombatEffects.playDramaticDeath(tgtSprite, 'player', rarity);
                            }
                            
                            // Handle support death from cleave/destroyer
                            if (action.supportDied) {
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
                        if (tgtSprite) {
                            tgtSprite.classList.add('taking-damage');
                            setTimeout(() => tgtSprite.classList.remove('taking-damage'), 400);
                            
                            if (action.targetDied) {
                                setTimeout(() => tgtSprite.classList.add('dying-left'), 300);
                            }
                        }
                        
                        if (action.supportDied) {
                            const supportCol = tgtCol === 1 ? 0 : 1;
                            const supportSprite = document.querySelector(`.cryptid-sprite[data-owner="player"][data-col="${supportCol}"][data-row="${action.targetRow}"]`);
                            if (supportSprite) {
                                setTimeout(() => supportSprite.classList.add('dying-left'), 400);
                            }
                        }
                    }, 250);
                }
                
                // Longer delay if deaths need to animate
                const deathDelay = (action.targetDied || action.supportDied) ? 800 : 0;
                setTimeout(safeComplete, TIMING.attack + deathDelay);
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
                        tgtSprite.classList.add('spell-target');
                        setTimeout(() => tgtSprite.classList.remove('spell-target'), TIMING.spell);
                    }
                }
                
                setTimeout(safeComplete, TIMING.spell);
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
                
                // Add evolution effect
                const col = 1 - action.targetCol;
                const sprite = document.querySelector(`.cryptid-sprite[data-owner="enemy"][data-col="${col}"][data-row="${action.targetRow}"]`);
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
            
            case 'pyreBurn':
                showMessage('Opponent used Pyre Burn!');
                setTimeout(safeComplete, TIMING.spell);
                break;
            
            case 'ability':
                showMessage('Opponent activated ' + (action.abilityName || 'ability') + '!');
                setTimeout(safeComplete, TIMING.spell);
                break;
            
            case 'turnStartSync':
                // Silent sync - no animation needed
                safeComplete();
                break;
            
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
            
            // Rematch system
            case 'rematch_requested':
            case 'opponent_left_results':
            case 'rematch_accepted':
                this.handleRematchMessage(msg);
                break;
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
                playerName: this.getPlayerName()
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
        this.sendGameAction('summon', {
            cardKey: cardKey,
            cardName: cardKey,
            col: col,
            row: row,
            isKindling: true,
            forced: true
        });
    },
    
    // Action methods for backwards compatibility with ability buttons
    actionActivateAbility(abilityName, col, row, extraData) {
        if (!this.isInMatch || !this.isMyTurn || this.processingOpponentAction) return;
        this.sendGameAction('ability', Object.assign({ 
            abilityName: abilityName, 
            col: col, 
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
        this.playerWins = 0;
        this.opponentWins = 0;
        this.currentGame = 1;
        this.playerTimeouts = 0;
        this.opponentTimeouts = 0;
        this.turnTimeRemaining = this.TURN_TIME;
        
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
            
            // Use WinScreen if available
            if (typeof WinScreen !== 'undefined' && WinScreen.show) {
                WinScreen.show(matchData);
            } else {
                // Fallback to game's endGame
                g.endGame(won ? 'player' : 'enemy');
            }
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
        Multiplayer.sendGameAction('summon', {
            cardKey: card.key,
            cardName: card.name,
            col: col,
            row: row,
            isKindling: card.isKindling || false
        });
    },
    
    onAttack(attacker, targetOwner, targetCol, targetRow, targetKey, targetDied, supportDied) {
        if (!this.shouldSend() || attacker.owner !== 'player') return;
        Multiplayer.sendGameAction('attack', {
            attackerCol: attacker.col,
            attackerRow: attacker.row,
            targetOwner: targetOwner,
            targetCol: targetCol,
            targetRow: targetRow,
            targetKey: targetKey || null,
            targetDied: targetDied || false,
            supportDied: supportDied || false
        });
    },
    
    onBurst(card, targetOwner, targetCol, targetRow) {
        if (!this.shouldSend()) return;
        Multiplayer.sendGameAction('burst', {
            cardKey: card.key,
            cardName: card.name,
            targetOwner: targetOwner,
            targetCol: targetCol,
            targetRow: targetRow
        });
    },
    
    onTrap(card, row) {
        if (!this.shouldSend()) return;
        Multiplayer.sendGameAction('trap', {
            cardKey: card.key,
            cardName: card.name,
            row: row
        });
    },
    
    onAura(card, col, row) {
        if (!this.shouldSend()) return;
        Multiplayer.sendGameAction('aura', {
            cardKey: card.key,
            cardName: card.name,
            col: col,
            row: row
        });
    },
    
    onPyre(card) {
        if (!this.shouldSend()) return;
        Multiplayer.sendGameAction('pyre', {
            cardKey: card.key,
            cardName: card.name
        });
    },
    
    onEvolve(card, col, row) {
        if (!this.shouldSend()) return;
        Multiplayer.sendGameAction('evolve', {
            cardKey: card.key,
            cardName: card.name,
            targetCol: col,
            targetRow: row
        });
    },
    
    onPyreBurn(deathCount) {
        if (!this.shouldSend()) return;
        Multiplayer.sendGameAction('pyreBurn', { deathCount: deathCount });
    },
    
    onActivateAbility(abilityName, col, row, extra) {
        if (!this.shouldSend()) return;
        Multiplayer.sendGameAction('ability', Object.assign({ abilityName: abilityName, col: col, row: row }, extra || {}));
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