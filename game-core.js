/**
 * Cryptid Fates - Game Core v2
 * 
 * CLEAN ARCHITECTURE:
 * - Game class is a thin UI wrapper
 * - All game logic delegated to SharedGameEngine
 * - Uses data-driven ability system
 * 
 * This replaces the 8000-line legacy version.
 * Legacy backup: game-core-legacy-backup.txt
 */

// ==================== EVENT SYSTEM ====================
const GameEvents = {
    listeners: {},
    
    on(event, callback, context = null) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        const listener = { callback, context };
        this.listeners[event].push(listener);
        return () => {
            if (!this.listeners[event]) return;
            const idx = this.listeners[event].indexOf(listener);
            if (idx > -1) this.listeners[event].splice(idx, 1);
        };
    },
    
    once(event, callback) {
        const unsubscribe = this.on(event, (...args) => {
            unsubscribe();
            callback(...args);
        });
    },
    
    emit(event, data = {}) {
        if (!this.listeners[event]) return;
        const eventData = { ...data, eventName: event, timestamp: Date.now() };
        for (const listener of this.listeners[event]) {
            try {
                if (listener.context) {
                    listener.callback.call(listener.context, eventData);
                } else {
                    listener.callback(eventData);
                }
            } catch (error) {
                console.error(`Error in event listener for ${event}:`, error);
            }
        }
    },
    
    off(event = null) {
        if (event) {
            delete this.listeners[event];
        } else {
            this.listeners = {};
        }
    },
    
    listenerCount(event) {
        return this.listeners[event]?.length || 0;
    }
};

window.GameEvents = GameEvents;

// ==================== ANIMATION SEQUENCE SYSTEM ====================
const AnimationSequence = {
    currentSequence: [],
    isBuilding: false,
    
    PRIMITIVES: {
        ATTACK_MOVE: 'attackMove',
        DAMAGE: 'damage',
        HEAL: 'heal',
        DEATH: 'death',
        STATUS_APPLY: 'statusApply',
        STATUS_TICK: 'statusTick',
        STATUS_REMOVE: 'statusRemove',
        SUMMON: 'summon',
        PROMOTION: 'promotion',
        EVOLUTION: 'evolution',
        SPELL_CAST: 'spellCast',
        AURA_APPLY: 'auraApply',
        AURA_REMOVE: 'auraRemove',
        TRAP_TRIGGER: 'trapTrigger',
        TRAP_SET: 'trapSet',
        PYRE_CHANGE: 'pyreChange',
        CARD_DRAW: 'cardDraw',
        MESSAGE: 'message',
        DELAY: 'delay',
        PARALLEL: 'parallel',
    },
    
    start() {
        this.currentSequence = [];
        this.isBuilding = true;
    },
    
    finish() {
        this.isBuilding = false;
        const seq = this.currentSequence;
        this.currentSequence = [];
        return seq;
    },
    
    cancel() {
        this.isBuilding = false;
        this.currentSequence = [];
    },
    
    add(type, data) {
        if (!this.isBuilding) return;
        this.currentSequence.push({ type, ...data, _timestamp: performance.now() });
    },
    
    summon(cryptid) {
        this.add(this.PRIMITIVES.SUMMON, {
            owner: cryptid.owner,
            col: cryptid.col,
            row: cryptid.row,
            key: cryptid.key,
            name: cryptid.name,
            element: cryptid.element,
            rarity: cryptid.rarity
        });
    },
    
    damage(target, amount, options = {}) {
        this.add(this.PRIMITIVES.DAMAGE, {
            targetOwner: target.owner,
            targetCol: target.col,
            targetRow: target.row,
            amount,
            isCrit: options.isCrit || amount >= 5,
            source: options.source || null
        });
    },
    
    death(cryptid, killedBy = null) {
        this.add(this.PRIMITIVES.DEATH, {
            owner: cryptid.owner,
            col: cryptid.col,
            row: cryptid.row,
            name: cryptid.name,
            killedBy
        });
    },
    
    statusApply(target, status, stacks = 1) {
        this.add(this.PRIMITIVES.STATUS_APPLY, {
            targetOwner: target.owner,
            targetCol: target.col,
            targetRow: target.row,
            status,
            stacks
        });
    }
};

window.AnimationSequence = AnimationSequence;

// ==================== GAME CLASS ====================
// Thin wrapper around SharedGameEngine for UI integration

class Game {
    constructor() {
        // Create the shared game engine
        this.engine = new window.SharedGameEngine();
        
        // UI-specific state (not game logic)
        this.isMultiplayer = false;
        this.multiplayerData = null;
        
        // Per-turn tracking (UI cares about these)
        this.playerKindlingPlayedThisTurn = false;
        this.enemyKindlingPlayedThisTurn = false;
        this.playerPyreCardPlayedThisTurn = false;
        this.enemyPyreCardPlayedThisTurn = false;
        this.playerPyreBurnUsed = false;
        this.enemyPyreBurnUsed = false;
        this.evolvedThisTurn = {};
        
        // Match stats for win screen
        this.matchStats = {
            startTime: Date.now(),
            damageDealt: 0,
            damageTaken: 0,
            spellsCast: 0,
            evolutions: 0,
            trapsTriggered: 0,
            kindlingSummoned: 0
        };
        
        // Initialize decks
        this.initializeDecks();
        
        // Bridge engine events to GameEvents
        this.setupEventBridge();
        
        // Setup trap listeners
        this.setupTrapListeners();
    }
    
    // ==================== STATE GETTERS ====================
    // These expose engine state to UI code
    
    get playerField() { return this.engine.state.playerField; }
    set playerField(val) { this.engine.state.playerField = val; }
    
    get enemyField() { return this.engine.state.enemyField; }
    set enemyField(val) { this.engine.state.enemyField = val; }
    
    get playerHand() { return this.engine.state.playerHand; }
    set playerHand(val) { this.engine.state.playerHand = val; }
    
    get enemyHand() { return this.engine.state.enemyHand; }
    set enemyHand(val) { this.engine.state.enemyHand = val; }
    
    get playerKindling() { return this.engine.state.playerKindling; }
    set playerKindling(val) { this.engine.state.playerKindling = val; }
    
    get enemyKindling() { return this.engine.state.enemyKindling; }
    set enemyKindling(val) { this.engine.state.enemyKindling = val; }
    
    get playerPyre() { return this.engine.state.playerPyre; }
    set playerPyre(val) { this.engine.state.playerPyre = val; }
    
    get enemyPyre() { return this.engine.state.enemyPyre; }
    set enemyPyre(val) { this.engine.state.enemyPyre = val; }
    
    get playerDeaths() { return this.engine.state.playerDeaths; }
    set playerDeaths(val) { this.engine.state.playerDeaths = val; }
    
    get enemyDeaths() { return this.engine.state.enemyDeaths; }
    set enemyDeaths(val) { this.engine.state.enemyDeaths = val; }
    
    get playerTraps() { return this.engine.state.playerTraps; }
    set playerTraps(val) { this.engine.state.playerTraps = val; }
    
    get enemyTraps() { return this.engine.state.enemyTraps; }
    set enemyTraps(val) { this.engine.state.enemyTraps = val; }
    
    get currentTurn() { return this.engine.state.currentTurn; }
    set currentTurn(val) { this.engine.state.currentTurn = val; }
    
    get phase() { return this.engine.state.phase || 'conjure1'; }
    set phase(val) { this.engine.state.phase = val; }
    
    get turnNumber() { return this.engine.state.turnNumber; }
    set turnNumber(val) { this.engine.state.turnNumber = val; }
    
    get gameOver() { return this.engine.state.gameOver; }
    set gameOver(val) { this.engine.state.gameOver = val; }
    
    get deck() { return this.engine.state.playerDeck; }
    set deck(val) { this.engine.state.playerDeck = val; }
    
    get enemyDeck() { return this.engine.state.enemyDeck; }
    set enemyDeck(val) { this.engine.state.enemyDeck = val; }
    
    // Pile tracking (UI feature)
    get playerBurnPile() { return this._playerBurnPile || []; }
    set playerBurnPile(val) { this._playerBurnPile = val; }
    
    get playerDiscardPile() { return this._playerDiscardPile || []; }
    set playerDiscardPile(val) { this._playerDiscardPile = val; }
    
    get enemyBurnPile() { return this._enemyBurnPile || []; }
    set enemyBurnPile(val) { this._enemyBurnPile = val; }
    
    get enemyDiscardPile() { return this._enemyDiscardPile || []; }
    set enemyDiscardPile(val) { this._enemyDiscardPile = val; }
    
    // ==================== INITIALIZATION ====================
    
    initializeDecks() {
        // Check if a specific deck was selected
        const selectedDeck = window.selectedPlayerDeck;
        if (selectedDeck && selectedDeck.cards) {
            const deckResult = this.buildDeckFromSelection(selectedDeck);
            this.engine.state.playerDeck = deckResult.mainDeck;
            this.engine.state.playerKindling = deckResult.kindling;
            console.log('[Game] Using selected deck:', selectedDeck.name);
        } else {
            // Fallback to random deck
            this.engine.state.playerDeck = window.DeckBuilder?.buildRandomDeck() || [];
            this.engine.state.playerKindling = window.DeckBuilder?.buildKindlingPool() || [];
        }
        
        // Enemy always gets random deck
        this.engine.state.enemyDeck = window.DeckBuilder?.buildRandomDeck() || [];
        this.engine.state.enemyKindling = window.DeckBuilder?.buildKindlingPool() || [];
        
        // Initialize empty piles
        this._playerBurnPile = [];
        this._playerDiscardPile = [];
        this._enemyBurnPile = [];
        this._enemyDiscardPile = [];
    }
    
    buildDeckFromSelection(selectedDeck) {
        const mainDeck = [];
        const kindling = [];
        let mainId = 1;
        let kindlingId = 1000;
        
        for (const entry of selectedDeck.cards) {
            const cardKey = entry.cardKey;
            
            // Check if it's kindling first
            const kindlingCard = CardRegistry.getKindling(cardKey);
            if (kindlingCard) {
                kindling.push({
                    ...kindlingCard,
                    id: kindlingId++,
                    isKindling: true,
                    skinId: entry.skinId,
                    isHolo: entry.isHolo
                });
                continue;
            }
            
            // Check other card types
            const card = CardRegistry.getCryptid(cardKey) ||
                        CardRegistry.getBurst(cardKey) ||
                        CardRegistry.getTrap(cardKey) ||
                        CardRegistry.getAura(cardKey) ||
                        CardRegistry.getPyre(cardKey);
            
            if (card) {
                mainDeck.push({
                    ...card,
                    id: mainId++,
                    skinId: entry.skinId,
                    isHolo: entry.isHolo
                });
            }
        }
        
        // Shuffle main deck
        for (let i = mainDeck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [mainDeck[i], mainDeck[j]] = [mainDeck[j], mainDeck[i]];
        }
        
        return { mainDeck, kindling };
    }
    
    setupEventBridge() {
        // Bridge SharedGameEngine events to GameEvents for UI animations
        this.engine.on('onSummon', (data) => {
            GameEvents.emit('onSummon', data);
        });
        
        this.engine.on('onDamageTaken', (data) => {
            GameEvents.emit('onDamageTaken', data);
            if (data.target?.owner === 'enemy') {
                this.matchStats.damageDealt += data.damage || 0;
            } else {
                this.matchStats.damageTaken += data.damage || 0;
            }
        });
        
        this.engine.on('onDeath', (data) => {
            GameEvents.emit('onDeath', data);
        });
        
        this.engine.on('onHeal', (data) => {
            GameEvents.emit('onHeal', data);
        });
        
        this.engine.on('onStatusApplied', (data) => {
            GameEvents.emit('onStatusApplied', data);
        });
        
        this.engine.on('onPyreGained', (data) => {
            GameEvents.emit('onPyreGained', data);
        });
        
        this.engine.on('onPromotion', (data) => {
            GameEvents.emit('onPromotion', data);
        });
        
        this.engine.on('onTurnStart', (data) => {
            GameEvents.emit('onTurnStart', data);
        });
        
        this.engine.on('onTurnEnd', (data) => {
            GameEvents.emit('onTurnEnd', data);
        });
        
        this.engine.on('onGameOver', (data) => {
            GameEvents.emit('onGameOver', data);
        });
    }
    
    setupTrapListeners() {
        // Traps are handled by the engine, but we need to emit UI events
        this.engine.on('onTrapTriggered', (data) => {
            GameEvents.emit('onTrapTriggered', data);
            this.matchStats.trapsTriggered++;
        });
    }
    
    // ==================== POSITION HELPERS ====================
    
    getCombatCol(owner) {
        return owner === 'player' ? 1 : 0;
    }
    
    getSupportCol(owner) {
        return owner === 'player' ? 0 : 1;
    }
    
    getFieldCryptid(owner, col, row) {
        return this.engine.getCryptidAt(owner, col, row);
    }
    
    getAllCryptids(owner) {
        return this.engine.getAllCryptids(owner);
    }
    
    isTileToxic(owner, col, row) {
        return this.engine.isInToxicTile({ owner, col, row });
    }
    
    // ==================== VALID SLOT/TARGET HELPERS ====================
    
    getValidSummonSlots(owner) {
        const field = owner === 'player' ? this.playerField : this.enemyField;
        const combatCol = this.getCombatCol(owner);
        const supportCol = this.getSupportCol(owner);
        const slots = [];
        
        for (let r = 0; r < 3; r++) {
            // Combat slots first (preferred)
            if (field[combatCol][r] === null) {
                slots.push({ col: combatCol, row: r });
            } else if (field[supportCol][r] === null) {
                // Support only if combat is occupied
                slots.push({ col: supportCol, row: r });
            }
        }
        return slots;
    }
    
    getValidAttackTargets(attacker) {
        if (!attacker || attacker.tapped || !attacker.canAttack) return [];
        
        const enemyOwner = attacker.owner === 'player' ? 'enemy' : 'player';
        const targets = [];
        
        // Flight: can target anyone
        if (attacker.canTargetAny) {
            const allEnemies = this.getAllCryptids(enemyOwner);
            return allEnemies.map(c => ({ owner: enemyOwner, col: c.col, row: c.row, cryptid: c }));
        }
        
        // Default: combatant in same row
        const enemyCombatCol = this.getCombatCol(enemyOwner);
        const enemyField = enemyOwner === 'player' ? this.playerField : this.enemyField;
        
        const target = enemyField[enemyCombatCol][attacker.row];
        if (target) {
            targets.push({ owner: enemyOwner, col: enemyCombatCol, row: attacker.row, cryptid: target });
        }
        
        return targets;
    }
    
    getValidBurstTargets(burstCard, owner) {
        const targets = [];
        const targetType = burstCard.targetType || 'any';
        
        // Check all cryptids on field
        for (const fieldOwner of ['player', 'enemy']) {
            const cryptids = this.getAllCryptids(fieldOwner);
            for (const c of cryptids) {
                if (targetType === 'any' ||
                    (targetType === 'enemy' && fieldOwner !== owner) ||
                    (targetType === 'ally' && fieldOwner === owner) ||
                    (targetType === 'enemyCombatant' && fieldOwner !== owner && c.col === this.getCombatCol(fieldOwner))) {
                    targets.push({ owner: fieldOwner, col: c.col, row: c.row, cryptid: c });
                }
            }
        }
        
        return targets;
    }
    
    getValidAuraTargets(owner) {
        const combatCol = this.getCombatCol(owner);
        const field = owner === 'player' ? this.playerField : this.enemyField;
        const targets = [];
        
        for (let r = 0; r < 3; r++) {
            const cryptid = field[combatCol][r];
            if (cryptid) {
                targets.push({ col: combatCol, row: r, cryptid });
            }
        }
        
        return targets;
    }
    
    getValidEvolutionTargets(evoCard, owner) {
        if (!evoCard.evolvesFrom) return [];
        
        const field = owner === 'player' ? this.playerField : this.enemyField;
        const targets = [];
        
        for (let col = 0; col < 2; col++) {
            for (let row = 0; row < 3; row++) {
                const cryptid = field[col][row];
                if (cryptid && cryptid.key === evoCard.evolvesFrom) {
                    targets.push({ col, row, cryptid });
                }
            }
        }
        
        return targets;
    }
    
    getValidTrapSlots(owner) {
        const traps = owner === 'player' ? this.playerTraps : this.enemyTraps;
        const slots = [];
        
        for (let r = 0; r < 3; r++) {
            if (traps[r] === null) {
                slots.push({ row: r });
            }
        }
        
        return slots;
    }
    
    // ==================== COST HELPERS ====================
    
    getModifiedCost(card, owner) {
        // For now, return base cost. Cost modifiers can be added later.
        return card.cost || 0;
    }
    
    canPlayPyreCard(owner) {
        const played = owner === 'player' ? this.playerPyreCardPlayedThisTurn : this.enemyPyreCardPlayedThisTurn;
        return !played && (this.phase === 'conjure1' || this.phase === 'conjure2');
    }
    
    // ==================== STATUS ICONS ====================
    
    getStatusIcons(cryptid) {
        if (!cryptid) return [];
        const icons = [];
        
        if (cryptid.burnTurns > 0) icons.push({ type: 'burn', value: cryptid.burnTurns });
        if (cryptid.bleedTurns > 0) icons.push({ type: 'bleed', value: cryptid.bleedStacks || 1 });
        if (cryptid.paralyzed) icons.push({ type: 'paralyze', value: 1 });
        if (cryptid.calamityCounters > 0) icons.push({ type: 'calamity', value: cryptid.calamityCounters });
        if (cryptid.curseTokens > 0) icons.push({ type: 'curse', value: cryptid.curseTokens });
        
        return icons;
    }
    
    // ==================== GAME ACTIONS ====================
    
    summonCryptid(owner, col, row, cardData) {
        // Remove from hand
        const hand = owner === 'player' ? this.playerHand : this.enemyHand;
        const pyre = owner === 'player' ? this.playerPyre : this.enemyPyre;
        
        const idx = hand.findIndex(c => c.id === cardData.id);
        if (idx === -1) {
            console.error('[Game] Card not in hand:', cardData.id);
            return null;
        }
        
        const cost = cardData.cost || 0;
        if (pyre < cost) {
            console.error('[Game] Not enough pyre');
            return null;
        }
        
        // Remove card from hand
        hand.splice(idx, 1);
        
        // Use engine to summon
        const result = this.engine.summon(owner, cardData, col, row);
        
        if (!result.success) {
            // Put card back
            hand.push(cardData);
            console.error('[Game] Summon failed:', result.error);
            return null;
        }
        
        GameEvents.emit('onSummon', { owner, cryptid: result.cryptid, col, row, isKindling: false });
        
        return result.cryptid;
    }
    
    summonKindling(owner, col, row, cardData) {
        // Remove from kindling pool
        const kindling = owner === 'player' ? this.playerKindling : this.enemyKindling;
        
        const idx = kindling.findIndex(k => k.id === cardData.id);
        if (idx === -1) {
            console.error('[Game] Kindling not in pool:', cardData.id);
            return null;
        }
        
        // Remove from pool
        kindling.splice(idx, 1);
        
        // Mark kindling played
        if (owner === 'player') this.playerKindlingPlayedThisTurn = true;
        else this.enemyKindlingPlayedThisTurn = true;
        
        // Use engine to summon
        const result = this.engine.summon(owner, { ...cardData, cost: 0 }, col, row);
        
        if (!result.success) {
            // Put back
            kindling.push(cardData);
            console.error('[Game] Kindling summon failed:', result.error);
            return null;
        }
        
        this.matchStats.kindlingSummoned++;
        GameEvents.emit('onSummon', { owner, cryptid: result.cryptid, col, row, isKindling: true });
        
        return result.cryptid;
    }
    
    popRandomKindling(owner) {
        const kindling = owner === 'player' ? this.playerKindling : this.enemyKindling;
        if (kindling.length === 0) return null;
        
        const idx = Math.floor(Math.random() * kindling.length);
        return kindling.splice(idx, 1)[0];
    }
    
    evolveCryptid(baseCryptid, evoCard) {
        if (!baseCryptid || !evoCard) return null;
        
        const owner = baseCryptid.owner;
        const pyre = owner === 'player' ? this.playerPyre : this.enemyPyre;
        const cost = evoCard.cost || 0;
        
        if (pyre < cost) {
            console.error('[Game] Not enough pyre for evolution');
            return null;
        }
        
        // Deduct pyre
        if (owner === 'player') this.playerPyre -= cost;
        else this.enemyPyre -= cost;
        
        // Remove from hand
        const hand = owner === 'player' ? this.playerHand : this.enemyHand;
        const idx = hand.findIndex(c => c.id === evoCard.id);
        if (idx !== -1) hand.splice(idx, 1);
        
        // Get field position
        const { col, row } = baseCryptid;
        const field = owner === 'player' ? this.playerField : this.enemyField;
        
        // Create evolved cryptid
        const evolved = this.engine.createCryptidInstance(evoCard, owner, col, row);
        
        // Preserve some state from base
        evolved.tapped = baseCryptid.tapped;
        evolved.canAttack = baseCryptid.canAttack;
        
        // Replace on field
        field[col][row] = evolved;
        
        this.matchStats.evolutions++;
        GameEvents.emit('onEvolution', { owner, baseCryptid, evolved, col, row });
        
        // Trigger onSummon/onEnterCombat for evolved
        this.engine.executeTrigger(evolved, 'onSummon');
        if (col === this.getCombatCol(owner)) {
            this.engine.executeTrigger(evolved, 'onEnterCombat');
        }
        
        return evolved;
    }
    
    attack(attacker, targetOwner, targetCol, targetRow) {
        const result = this.engine.attack(attacker, targetOwner, targetCol, targetRow);
        
        if (result.success) {
            GameEvents.emit('onAttackDeclared', { attacker, targetOwner, targetCol, targetRow });
            
            if (result.damage > 0) {
                GameEvents.emit('onHit', { 
                    attacker, 
                    target: this.getFieldCryptid(targetOwner, targetCol, targetRow),
                    damage: result.damage 
                });
            }
        }
        
        return result;
    }
    
    setTrap(owner, row, trapCard) {
        const traps = owner === 'player' ? this.playerTraps : this.enemyTraps;
        const pyre = owner === 'player' ? this.playerPyre : this.enemyPyre;
        
        if (row >= 3 || traps[row] !== null) return false;
        
        const cost = trapCard.cost || 0;
        if (pyre < cost) return false;
        
        // Deduct pyre
        if (owner === 'player') this.playerPyre -= cost;
        else this.enemyPyre -= cost;
        
        // Remove from hand
        const hand = owner === 'player' ? this.playerHand : this.enemyHand;
        const idx = hand.findIndex(c => c.id === trapCard.id);
        if (idx !== -1) hand.splice(idx, 1);
        
        // Set trap
        traps[row] = { ...trapCard, owner, row, faceDown: true };
        
        GameEvents.emit('onTrapSet', { trap: traps[row], owner, row });
        return true;
    }
    
    playPyreCard(owner, pyreCard) {
        if (!this.canPlayPyreCard(owner)) return false;
        
        if (owner === 'player') this.playerPyreCardPlayedThisTurn = true;
        else this.enemyPyreCardPlayedThisTurn = true;
        
        // Remove from hand
        const hand = owner === 'player' ? this.playerHand : this.enemyHand;
        const idx = hand.findIndex(c => c.id === pyreCard.id);
        if (idx !== -1) hand.splice(idx, 1);
        
        // Calculate pyre gain
        let pyreGained = 1;
        
        if (typeof pyreCard.effect === 'function') {
            // Old function-based format
            const result = pyreCard.effect(this, owner);
            pyreGained = result?.pyreGained || 1;
        } else if (pyreCard.effects && Array.isArray(pyreCard.effects)) {
            // New data-driven format
            pyreGained = 0;
            for (const effect of pyreCard.effects) {
                if (effect.type === 'gainPyre') {
                    const amount = this.calculateEffectAmount(effect.amount, owner);
                    this.gainPyre(owner, amount);
                    pyreGained += amount;
                } else if (effect.type === 'drawCard') {
                    const count = this.calculateEffectAmount(effect.amount, owner) || 1;
                    this.drawCards(owner, count);
                }
            }
        } else {
            // Simple pyre gain
            this.gainPyre(owner, 1);
        }
        
        GameEvents.emit('onPyreCardPlayed', { owner, card: pyreCard, pyreGained });
        return { pyreGained };
    }
    
    calculateEffectAmount(amount, owner) {
        if (typeof amount === 'number') return amount;
        if (!amount || typeof amount !== 'object') return 1;
        
        switch (amount.calc) {
            case 'sum':
                return (amount.values || []).reduce((sum, v) => sum + this.calculateEffectAmount(v, owner), 0);
            case 'min':
                const a = this.calculateEffectAmount(amount.a, owner);
                return Math.min(a, amount.max || a);
            case 'vampireCount':
                return this.getAllCryptids(owner).filter(c => c.name?.toLowerCase().includes('vampire')).length;
            case 'gargoyleCount':
                return this.getAllCryptids(owner).filter(c => c.name?.toLowerCase().includes('gargoyle')).length;
            case 'allyDeathsLastTurn':
                return this.engine.state.deathsLastEnemyTurn?.[owner] || 0;
            default:
                return 1;
        }
    }
    
    gainPyre(owner, amount) {
        this.engine.gainPyre(owner, amount, 'card');
    }
    
    drawCard(owner, source = 'normal') {
        const drawn = this.engine.drawCards(owner, 1);
        if (drawn > 0) {
            const hand = owner === 'player' ? this.playerHand : this.enemyHand;
            GameEvents.emit('onCardDrawn', { owner, card: hand[hand.length - 1], source });
        }
        return drawn > 0 ? (owner === 'player' ? this.playerHand : this.enemyHand).slice(-1)[0] : null;
    }
    
    drawCards(owner, count) {
        const drawn = [];
        for (let i = 0; i < count; i++) {
            const card = this.drawCard(owner, 'effect');
            if (card) drawn.push(card);
        }
        return drawn;
    }
    
    // ==================== TURN MANAGEMENT ====================
    
    startTurn(owner) {
        this.engine.state.currentTurn = owner;
        this.engine.state.phase = 'conjure1';
        
        // Reset per-turn flags
        if (owner === 'player') {
            this.playerKindlingPlayedThisTurn = false;
            this.playerPyreCardPlayedThisTurn = false;
            this.playerPyreBurnUsed = false;
        } else {
            this.enemyKindlingPlayedThisTurn = false;
            this.enemyPyreCardPlayedThisTurn = false;
            this.enemyPyreBurnUsed = false;
        }
        this.evolvedThisTurn = {};
        
        // Give pyre
        this.engine.gainPyre(owner, 1, 'turnStart');
        
        // Untap and process turn start
        this.engine.startTurn(owner);
        
        GameEvents.emit('onTurnStart', { owner, turnNumber: this.turnNumber });
    }
    
    advancePhase() {
        const phases = ['conjure1', 'combat', 'conjure2'];
        const currentIdx = phases.indexOf(this.phase);
        
        if (currentIdx < phases.length - 1) {
            this.phase = phases[currentIdx + 1];
            GameEvents.emit('onPhaseChange', { phase: this.phase, owner: this.currentTurn });
            return true;
        }
        
        return false;
    }
    
    endTurn() {
        const owner = this.currentTurn;
        
        // Process end of turn effects
        this.engine.endTurn(owner);
        
        GameEvents.emit('onTurnEnd', { owner });
        
        // Check game over
        if (this.checkGameOver()) return;
        
        // Switch turns
        const nextOwner = owner === 'player' ? 'enemy' : 'player';
        this.engine.state.turnNumber++;
        this.startTurn(nextOwner);
    }
    
    checkGameOver() {
        if (this.playerDeaths >= 10) {
            this.gameOver = true;
            GameEvents.emit('onGameOver', { winner: 'enemy', reason: 'deaths' });
            return true;
        }
        if (this.enemyDeaths >= 10) {
            this.gameOver = true;
            GameEvents.emit('onGameOver', { winner: 'player', reason: 'deaths' });
            return true;
        }
        return false;
    }
    
    // ==================== HELPER METHODS FOR UI ====================
    
    applyAura(cryptid, auraCard) {
        if (!cryptid || !auraCard) return false;
        
        // Apply stat boosts
        if (auraCard.atkBonus) {
            cryptid.currentAtk = (cryptid.currentAtk || cryptid.atk) + auraCard.atkBonus;
        }
        if (auraCard.hpBonus) {
            const hpBefore = cryptid.currentHp;
            cryptid.currentHp = (cryptid.currentHp || cryptid.hp) + auraCard.hpBonus;
            cryptid.maxHp = (cryptid.maxHp || cryptid.hp) + auraCard.hpBonus;
            if (cryptid.currentHp > hpBefore) {
                GameEvents.emit('onHeal', { target: cryptid, amount: auraCard.hpBonus });
            }
        }
        
        // Apply special properties
        if (auraCard.grantsFlight) cryptid.canTargetAny = true;
        if (auraCard.grantsLifesteal) cryptid.hasLifesteal = true;
        if (auraCard.grantsRegeneration) cryptid.regenerates = true;
        if (auraCard.grantsShield) cryptid.shield = (cryptid.shield || 0) + 1;
        
        // Execute data-driven effects
        if (auraCard.effects && Array.isArray(auraCard.effects)) {
            for (const effect of auraCard.effects) {
                this.engine.executeEffect(effect, cryptid);
            }
        } else if (typeof auraCard.effect === 'function') {
            // Legacy function-based format
            auraCard.effect(this, cryptid.owner, cryptid);
        }
        
        GameEvents.emit('onAuraApplied', { target: cryptid, aura: auraCard });
        return true;
    }
    
    getEffectiveHp(cryptid) {
        if (!cryptid) return 0;
        let hp = cryptid.currentHp || 0;
        
        // Add shield
        if (cryptid.shield) hp += cryptid.shield;
        
        return hp;
    }
    
    processAllDeaths() {
        // Process all cryptids that should be dead
        const deathQueue = [];
        
        for (const owner of ['player', 'enemy']) {
            const field = owner === 'player' ? this.playerField : this.enemyField;
            for (let col = 0; col < 2; col++) {
                for (let row = 0; row < 3; row++) {
                    const cryptid = field[col][row];
                    if (cryptid && cryptid.currentHp <= 0) {
                        deathQueue.push({ owner, col, row, cryptid });
                    }
                }
            }
        }
        
        for (const death of deathQueue) {
            this.processDeath(death.owner, death.col, death.row, death.cryptid);
        }
        
        return deathQueue.length;
    }
    
    processDeath(owner, col, row, cryptid) {
        if (!cryptid) return;
        
        const field = owner === 'player' ? this.playerField : this.enemyField;
        
        // Remove from field
        field[col][row] = null;
        
        // Increment deaths
        if (owner === 'player') this.playerDeaths++;
        else this.enemyDeaths++;
        
        GameEvents.emit('onDeath', { cryptid, owner, col, row });
        
        // Check for promotion
        const supportCol = this.getSupportCol(owner);
        if (col === this.getCombatCol(owner) && field[supportCol][row]) {
            this.promoteSupport(owner, row);
        }
        
        return true;
    }
    
    promoteSupport(owner, row) {
        const field = owner === 'player' ? this.playerField : this.enemyField;
        const combatCol = this.getCombatCol(owner);
        const supportCol = this.getSupportCol(owner);
        
        const support = field[supportCol][row];
        if (!support) return;
        
        // Move to combat
        field[combatCol][row] = support;
        field[supportCol][row] = null;
        support.col = combatCol;
        
        GameEvents.emit('onPromotion', { cryptid: support, owner, row, fromCol: supportCol, toCol: combatCol });
        
        // Trigger onEnterCombat
        this.engine.executeTrigger?.(support, 'onEnterCombat');
    }
}

// ==================== GLOBAL INITIALIZATION ====================

window.Game = Game;

// Create global initGame function
function initGame() {
    console.log('[Game] Initializing new game...');
    window.game = new Game();
    console.log('[Game] Game created with', window.game.deck?.length || 0, 'cards in deck');
    return window.game;
}

window.initGame = initGame;

console.log('[game-core.js v2] Loaded - Clean architecture with SharedGameEngine');
