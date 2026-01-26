/**
 * Server-Side Game Engine
 * Pure game logic - fully authoritative
 * Handles all ability triggers, status effects, and game state
 */

import { ServerCardRegistry, getAilmentStacks } from './server-card-registry.js';

// ==================== SEEDED RNG ====================

class SeededRNG {
    constructor(seed) {
        this.seed = seed % 2147483647;
        if (this.seed <= 0) this.seed += 2147483646;
    }
    
    next() {
        this.seed = (this.seed * 16807) % 2147483647;
        return this.seed;
    }
    
    float() {
        return (this.next() - 1) / 2147483646;
    }
    
    int(min, max) {
        return Math.floor(this.float() * (max - min + 1)) + min;
    }
    
    shuffle(array) {
        const result = [...array];
        for (let i = result.length - 1; i > 0; i--) {
            const j = this.int(0, i);
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }
}

// ==================== GAME ENGINE ====================

class ServerGameEngine {
    constructor(seed) {
        this.rng = new SeededRNG(seed || Date.now());
        this.seed = seed;
        
        // Game state
        this.state = {
            playerField: [[null, null, null], [null, null, null]],
            enemyField: [[null, null, null], [null, null, null]],
            playerHand: [],
            enemyHand: [],
            playerKindling: [],
            enemyKindling: [],
            playerDeck: [],
            enemyDeck: [],
            playerPyre: 0,
            enemyPyre: 0,
            playerTraps: [null, null, null],
            enemyTraps: [null, null, null],
            playerToxicTiles: [[false, false, false], [false, false, false]],
            enemyToxicTiles: [[false, false, false], [false, false, false]],
            currentTurn: 'player',
            phase: 'conjure1',
            turnNumber: 1,
            playerKindlingPlayed: false,
            enemyKindlingPlayed: false,
            playerPyreCardPlayed: false,
            enemyPyreCardPlayed: false,
            playerPyreBurnUsed: false,
            enemyPyreBurnUsed: false,
            playerDeaths: 0,
            enemyDeaths: 0,
            gameOver: false,
            winner: null,
            nextCryptidId: 1,
            nextCardId: 1
        };
        
        // Event log for this action
        this.events = [];
        
        // Animation sequence
        this.animationSequence = [];
        
        // Pending promotions
        this.pendingPromotions = [];
        
        // Death listeners
        this.deathListeners = [];
        
        // Damage listeners
        this.damageListeners = [];
    }
    
    // ==================== INITIALIZATION ====================
    
    initializeDecks(playerDeck, enemyDeck, playerKindling, enemyKindling) {
        // Assign IDs and shuffle
        this.state.playerDeck = this.rng.shuffle(playerDeck.map(card => ({
            ...card,
            id: this.state.nextCardId++
        })));
        
        this.state.enemyDeck = this.rng.shuffle(enemyDeck.map(card => ({
            ...card,
            id: this.state.nextCardId++
        })));
        
        this.state.playerKindling = playerKindling.map(card => ({
            ...card,
            id: this.state.nextCardId++
        }));
        
        this.state.enemyKindling = enemyKindling.map(card => ({
            ...card,
            id: this.state.nextCardId++
        }));
        
        // Draw initial hands
        for (let i = 0; i < 5 && this.state.playerDeck.length > 0; i++) {
            this.state.playerHand.push(this.state.playerDeck.shift());
        }
        
        for (let i = 0; i < 5 && this.state.enemyDeck.length > 0; i++) {
            this.state.enemyHand.push(this.state.enemyDeck.shift());
        }
    }
    
    // ==================== ACTION PROCESSING ====================
    
    processAction(owner, action) {
        this.events = [];
        this.animationSequence = [];
        this.pendingPromotions = [];
        
        if (!action || !action.type) {
            return { valid: false, error: 'Invalid action' };
        }
        
        let result;
        
        switch (action.type) {
            case 'endPhase':
                result = this.handleEndPhase(owner);
                break;
                
            case 'summon':
                result = this.handleSummon(owner, action);
                break;
                
            case 'summonKindling':
                result = this.handleSummonKindling(owner, action);
                break;
                
            case 'attack':
                result = this.handleAttack(owner, action);
                break;
                
            case 'playBurst':
                result = this.handlePlayBurst(owner, action);
                break;
                
            case 'playTrap':
                result = this.handlePlayTrap(owner, action);
                break;
                
            case 'playAura':
                result = this.handlePlayAura(owner, action);
                break;
                
            case 'playPyre':
                result = this.handlePlayPyre(owner, action);
                break;
                
            case 'evolve':
                result = this.handleEvolve(owner, action);
                break;
                
            case 'burnForPyre':
                result = this.handleBurnForPyre(owner, action);
                break;
                
            case 'activateAbility':
                result = this.handleActivateAbility(owner, action);
                break;
                
            default:
                result = { valid: false, error: 'Unknown action type: ' + action.type };
        }
        
        // Process pending promotions after main action
        this.processPendingPromotions();
        
        return {
            ...result,
            events: this.events,
            animationSequence: this.animationSequence
        };
    }
    
    // ==================== ACTION HANDLERS ====================
    
    handleEndPhase(owner) {
        const phases = ['conjure1', 'combat', 'conjure2'];
        const currentIndex = phases.indexOf(this.state.phase);
        
        if (currentIndex === phases.length - 1) {
            this.endTurn(owner);
        } else {
            this.state.phase = phases[currentIndex + 1];
            this.emit('phaseChange', { owner, phase: this.state.phase });
            this.addAnimation('phaseChange', { phase: this.state.phase });
        }
        
        return { valid: true };
    }
    
    handleSummon(owner, action) {
        const { cardId, col, row } = action;
        
        if (this.state.phase !== 'conjure1' && this.state.phase !== 'conjure2') {
            return { valid: false, error: 'Can only summon during conjure phase' };
        }
        
        const hand = this.getHand(owner);
        const cardIndex = hand.findIndex(c => c.id === cardId);
        
        if (cardIndex === -1) {
            return { valid: false, error: 'Card not in hand' };
        }
        
        const card = hand[cardIndex];
        const pyre = this.getPyre(owner);
        
        if (pyre < card.cost) {
            return { valid: false, error: 'Not enough pyre' };
        }
        
        const field = this.getField(owner);
        if (field[col][row]) {
            return { valid: false, error: 'Slot is occupied' };
        }
        
        // Check for traps in target row
        const trapResult = this.checkTrapsOnSummon(owner, col, row);
        
        // Execute summon
        hand.splice(cardIndex, 1);
        this.modifyPyre(owner, -card.cost);
        
        const cryptid = this.createCryptid(card, owner, col, row);
        field[col][row] = cryptid;
        
        this.emit('cryptidSummoned', {
            owner,
            col,
            row,
            cryptid: this.serializeCryptid(cryptid),
            fromKindling: false
        });
        
        this.addAnimation('summon', {
            owner,
            col,
            row,
            cryptidKey: cryptid.key,
            cryptidName: cryptid.name
        });
        
        // Trigger abilities
        this.triggerAbility(cryptid, 'onSummon');
        
        if (col === this.getCombatCol(owner)) {
            this.triggerAbility(cryptid, 'onEnterCombat');
        } else {
            this.triggerAbility(cryptid, 'onSupport');
        }
        
        // Apply trap effects
        if (trapResult?.triggered) {
            this.addAnimation('trapTriggered', trapResult);
        }
        
        return { valid: true };
    }
    
    handleSummonKindling(owner, action) {
        const { kindlingId, col, row } = action;
        
        if (this.state.phase !== 'conjure1' && this.state.phase !== 'conjure2') {
            return { valid: false, error: 'Can only summon during conjure phase' };
        }
        
        const playedFlag = owner === 'player' ? 
            this.state.playerKindlingPlayed : 
            this.state.enemyKindlingPlayed;
        
        if (playedFlag) {
            return { valid: false, error: 'Already played kindling this turn' };
        }
        
        const pool = this.getKindlingPool(owner);
        const kindlingIndex = pool.findIndex(k => k.id === kindlingId);
        
        if (kindlingIndex === -1) {
            return { valid: false, error: 'Kindling not found' };
        }
        
        const field = this.getField(owner);
        if (field[col][row]) {
            return { valid: false, error: 'Slot is occupied' };
        }
        
        // Execute
        const kindling = pool.splice(kindlingIndex, 1)[0];
        
        if (owner === 'player') {
            this.state.playerKindlingPlayed = true;
        } else {
            this.state.enemyKindlingPlayed = true;
        }
        
        const cryptid = this.createCryptid({ ...kindling, isKindling: true }, owner, col, row);
        field[col][row] = cryptid;
        
        this.emit('cryptidSummoned', {
            owner,
            col,
            row,
            cryptid: this.serializeCryptid(cryptid),
            fromKindling: true
        });
        
        this.addAnimation('summon', {
            owner,
            col,
            row,
            cryptidKey: cryptid.key,
            cryptidName: cryptid.name,
            isKindling: true
        });
        
        // Trigger abilities
        this.triggerAbility(cryptid, 'onSummon');
        
        if (col === this.getCombatCol(owner)) {
            this.triggerAbility(cryptid, 'onEnterCombat');
        } else {
            this.triggerAbility(cryptid, 'onSupport');
        }
        
        return { valid: true };
    }
    
    handleAttack(owner, action) {
        const { attackerCol, attackerRow, targetRow } = action;
        const opponentOwner = owner === 'player' ? 'enemy' : 'player';
        
        if (this.state.phase !== 'combat') {
            return { valid: false, error: 'Can only attack during combat phase' };
        }
        
        const attackerField = this.getField(owner);
        const attacker = attackerField[attackerCol]?.[attackerRow];
        
        if (!attacker) {
            return { valid: false, error: 'No attacker at position' };
        }
        
        if (attacker.tapped || attacker.attackedThisTurn) {
            return { valid: false, error: 'Attacker cannot attack' };
        }
        
        if (attacker.paralyzed) {
            return { valid: false, error: 'Attacker is paralyzed' };
        }
        
        if (attackerCol !== this.getCombatCol(owner)) {
            return { valid: false, error: 'Attacker must be in combat position' };
        }
        
        // Get target
        const targetField = this.getField(opponentOwner);
        const targetCombatCol = this.getCombatCol(opponentOwner);
        const target = targetField[targetCombatCol]?.[targetRow];
        
        // Validate target (flight check)
        if (!attacker.canTargetAny && targetRow !== attackerRow && target) {
            return { valid: false, error: 'Cannot attack that target' };
        }
        
        // Mark attacker as having attacked
        attacker.attackedThisTurn = true;
        attacker.tapped = true;
        
        // Calculate damage
        let damage = this.calculateAttackDamage(attacker, owner);
        
        // Check for bonus damage vs burning
        if (target && target.burnStacks > 0 && attacker.bonusVsBurning) {
            damage += attacker.bonusVsBurning;
        }
        
        this.emit('attackDeclared', {
            attackerOwner: owner,
            attackerCol,
            attackerRow,
            attackerKey: attacker.key,
            targetOwner: opponentOwner,
            targetRow,
            target: target ? this.serializeCryptid(target) : null,
            damage
        });
        
        // Animation: Attack move
        this.addAnimation('attackMove', {
            attackerOwner: owner,
            attackerRow,
            targetOwner: opponentOwner,
            targetRow,
            attackerKey: attacker.key
        });
        
        // Trigger onAttack
        this.triggerAbility(attacker, 'onCombatAttack', { target });
        
        // Check for traps
        const trapResult = this.checkTrapsOnAttack(owner, targetRow);
        if (trapResult?.triggered) {
            this.addAnimation('trapTriggered', trapResult);
        }
        
        if (target) {
            // Check for guard/block abilities
            const defenseResult = this.triggerAbility(target, 'onBeforeDefend', { attacker });
            
            if (defenseResult?.blocked) {
                this.addAnimation('attackBlocked', {
                    targetOwner: opponentOwner,
                    targetRow,
                    blockerKey: target.key
                });
            } else {
                // Deal damage
                this.dealDamage(target, damage, attacker, 'attack');
                
                // Apply burn if attacker has attacksApplyBurn
                if (attacker.attacksApplyBurn) {
                    this.applyBurn(target, 1);
                }
                
                // Apply curse if attacker has attacksApplyCurse
                if (attacker.attacksApplyCurse) {
                    this.applyCurse(target, attacker.attacksApplyCurse);
                }
                
                // Trigger onHit
                this.triggerAbility(attacker, 'onCombatHit', { target });
            }
        }
        
        return { valid: true };
    }
    
    handlePlayBurst(owner, action) {
        const { cardId, targetOwner, targetCol, targetRow } = action;
        
        const hand = this.getHand(owner);
        const cardIndex = hand.findIndex(c => c.id === cardId);
        
        if (cardIndex === -1) {
            return { valid: false, error: 'Card not in hand' };
        }
        
        const card = hand[cardIndex];
        const pyre = this.getPyre(owner);
        
        if (pyre < card.cost) {
            return { valid: false, error: 'Not enough pyre' };
        }
        
        // Get burst definition
        const burstDef = ServerCardRegistry.get(card.key);
        if (!burstDef || !burstDef.effect) {
            return { valid: false, error: 'Invalid burst card' };
        }
        
        // Execute
        hand.splice(cardIndex, 1);
        this.modifyPyre(owner, -card.cost);
        
        this.addAnimation('burstCast', {
            owner,
            cardKey: card.key,
            cardName: card.name
        });
        
        // Execute burst effect
        const effectResult = burstDef.effect(this, targetOwner, targetCol, targetRow, owner);
        
        this.emit('burstCast', {
            owner,
            card: card.key,
            targetOwner,
            targetCol,
            targetRow,
            result: effectResult
        });
        
        return { valid: true, effectResult };
    }
    
    handlePlayTrap(owner, action) {
        const { cardId, row } = action;
        
        const hand = this.getHand(owner);
        const cardIndex = hand.findIndex(c => c.id === cardId);
        
        if (cardIndex === -1) {
            return { valid: false, error: 'Card not in hand' };
        }
        
        const card = hand[cardIndex];
        const traps = this.getTraps(owner);
        
        if (traps[row]) {
            return { valid: false, error: 'Trap slot occupied' };
        }
        
        const pyre = this.getPyre(owner);
        if (pyre < card.cost) {
            return { valid: false, error: 'Not enough pyre' };
        }
        
        // Execute
        hand.splice(cardIndex, 1);
        this.modifyPyre(owner, -card.cost);
        
        if (owner === 'player') {
            this.state.playerTraps[row] = { ...card, faceDown: true, row };
        } else {
            this.state.enemyTraps[row] = { ...card, faceDown: true, row };
        }
        
        this.emit('trapSet', { owner, row });
        this.addAnimation('trapSet', { owner, row });
        
        return { valid: true };
    }
    
    handlePlayAura(owner, action) {
        const { cardId, targetOwner, targetCol, targetRow } = action;
        
        const hand = this.getHand(owner);
        const cardIndex = hand.findIndex(c => c.id === cardId);
        
        if (cardIndex === -1) {
            return { valid: false, error: 'Card not in hand' };
        }
        
        const card = hand[cardIndex];
        const target = this.getFieldCryptid(targetOwner, targetCol, targetRow);
        
        if (!target) {
            return { valid: false, error: 'No target at position' };
        }
        
        const pyre = this.getPyre(owner);
        if (pyre < card.cost) {
            return { valid: false, error: 'Not enough pyre' };
        }
        
        // Get aura definition
        const auraDef = ServerCardRegistry.get(card.key);
        if (!auraDef || !auraDef.onAttach) {
            return { valid: false, error: 'Invalid aura card' };
        }
        
        // Execute
        hand.splice(cardIndex, 1);
        this.modifyPyre(owner, -card.cost);
        
        // Attach aura
        if (!target.auras) target.auras = [];
        target.auras.push({ ...card, attachedAt: Date.now() });
        
        // Apply effect
        auraDef.onAttach(card, target, this);
        
        this.emit('auraAttached', {
            owner,
            card: card.key,
            targetOwner,
            targetCol,
            targetRow
        });
        
        this.addAnimation('auraAttach', {
            targetOwner,
            targetCol,
            targetRow,
            auraKey: card.key,
            auraName: card.name
        });
        
        return { valid: true };
    }
    
    handlePlayPyre(owner, action) {
        const { cardId } = action;
        
        const playedFlag = owner === 'player' ? 
            this.state.playerPyreCardPlayed : 
            this.state.enemyPyreCardPlayed;
        
        if (playedFlag) {
            return { valid: false, error: 'Already played pyre card this turn' };
        }
        
        const hand = this.getHand(owner);
        const cardIndex = hand.findIndex(c => c.id === cardId);
        
        if (cardIndex === -1) {
            return { valid: false, error: 'Card not in hand' };
        }
        
        const card = hand.splice(cardIndex, 1)[0];
        
        // Get pyre definition
        const pyreDef = ServerCardRegistry.get(card.key);
        const pyreValue = pyreDef?.pyreValue || 1;
        
        if (owner === 'player') {
            this.state.playerPyreCardPlayed = true;
        } else {
            this.state.enemyPyreCardPlayed = true;
        }
        
        this.modifyPyre(owner, pyreValue);
        
        // Execute any onPlay effect
        if (pyreDef?.onPlay) {
            pyreDef.onPlay(card, owner, this);
        }
        
        this.emit('pyreCardPlayed', { owner, card: card.key, pyreGained: pyreValue });
        this.addAnimation('pyreGain', { owner, amount: pyreValue });
        
        return { valid: true };
    }
    
    handleEvolve(owner, action) {
        const { cardId, targetCol, targetRow } = action;
        
        const hand = this.getHand(owner);
        const cardIndex = hand.findIndex(c => c.id === cardId);
        
        if (cardIndex === -1) {
            return { valid: false, error: 'Card not in hand' };
        }
        
        const card = hand[cardIndex];
        
        // Get card definition
        const cardDef = ServerCardRegistry.get(card.key);
        if (!cardDef?.evolvesFrom) {
            return { valid: false, error: 'Card is not an evolution' };
        }
        
        const field = this.getField(owner);
        const target = field[targetCol]?.[targetRow];
        
        if (!target) {
            return { valid: false, error: 'No target at position' };
        }
        
        if (target.key !== cardDef.evolvesFrom) {
            return { valid: false, error: 'Target does not match evolution base' };
        }
        
        const pyre = this.getPyre(owner);
        if (pyre < card.cost) {
            return { valid: false, error: 'Not enough pyre' };
        }
        
        // Execute evolution
        hand.splice(cardIndex, 1);
        this.modifyPyre(owner, -card.cost);
        
        const oldKey = target.key;
        this.evolveInPlace(target, card);
        
        this.emit('cryptidEvolved', {
            owner,
            col: targetCol,
            row: targetRow,
            fromKey: oldKey,
            toKey: card.key,
            cryptid: this.serializeCryptid(target)
        });
        
        this.addAnimation('evolve', {
            owner,
            col: targetCol,
            row: targetRow,
            fromKey: oldKey,
            toKey: card.key
        });
        
        // Trigger onEvolve
        this.triggerAbility(target, 'onEvolve');
        
        return { valid: true };
    }
    
    handleBurnForPyre(owner, action) {
        const { cardId } = action;
        
        const usedFlag = owner === 'player' ? 
            this.state.playerPyreBurnUsed : 
            this.state.enemyPyreBurnUsed;
        
        if (usedFlag) {
            return { valid: false, error: 'Already burned this turn' };
        }
        
        const hand = this.getHand(owner);
        const cardIndex = hand.findIndex(c => c.id === cardId);
        
        if (cardIndex === -1) {
            return { valid: false, error: 'Card not in hand' };
        }
        
        hand.splice(cardIndex, 1);
        
        if (owner === 'player') {
            this.state.playerPyreBurnUsed = true;
        } else {
            this.state.enemyPyreBurnUsed = true;
        }
        
        this.modifyPyre(owner, 1);
        
        this.emit('cardBurned', { owner, pyreGained: 1 });
        this.addAnimation('burnForPyre', { owner });
        
        return { valid: true };
    }
    
    handleActivateAbility(owner, action) {
        const { cryptidId, abilityKey, targetRow } = action;
        
        // Find the cryptid
        const cryptid = this.findCryptidById(owner, cryptidId);
        if (!cryptid) {
            return { valid: false, error: 'Cryptid not found' };
        }
        
        // Get card definition
        const cardDef = ServerCardRegistry.get(cryptid.key);
        if (!cardDef) {
            return { valid: false, error: 'Unknown card' };
        }
        
        // Execute the ability
        const abilityFn = cardDef[abilityKey];
        if (!abilityFn || typeof abilityFn !== 'function') {
            return { valid: false, error: 'Invalid ability' };
        }
        
        const result = abilityFn(cryptid, targetRow, this);
        
        if (result === false) {
            return { valid: false, error: 'Ability cannot be used' };
        }
        
        return { valid: true, result };
    }
    
    // ==================== GAME LOGIC HELPERS ====================
    
    createCryptid(card, owner, col, row) {
        const id = this.state.nextCryptidId++;
        const cardDef = ServerCardRegistry.get(card.key) || card;
        
        return {
            id,
            key: card.key,
            name: card.name || cardDef.name,
            baseAtk: card.atk || cardDef.atk,
            baseHp: card.hp || cardDef.hp,
            currentAtk: card.atk || cardDef.atk,
            currentHp: card.hp || cardDef.hp,
            maxHp: card.hp || cardDef.hp,
            cost: card.cost || cardDef.cost || 0,
            owner,
            col,
            row,
            tapped: false,
            attackedThisTurn: false,
            justSummoned: true,
            isKindling: card.isKindling || cardDef.isKindling || false,
            burnStacks: 0,
            bleedStacks: 0,
            curseTokens: 0,
            calamityCounters: 0,
            paralyzed: false,
            paralyzedTurns: 0,
            hasProtection: false,
            evolutionChain: [card.key],
            element: card.element || cardDef.element,
            rarity: card.rarity || cardDef.rarity || 'common',
            canTargetAny: cardDef.canTargetAny || false,
            bonusVsBurning: cardDef.bonusVsBurning || 0,
            attacksAllCombatants: cardDef.attacksAllCombatants || false,
            auras: []
        };
    }
    
    createToken(tokenKey, owner, col, row) {
        const tokenDef = ServerCardRegistry.get(tokenKey);
        if (!tokenDef) {
            throw new Error(`Unknown token: ${tokenKey}`);
        }
        
        return this.createCryptid(tokenDef, owner, col, row);
    }
    
    calculateAttackDamage(attacker, owner) {
        let damage = (attacker.currentAtk || attacker.atk) - (attacker.atkDebuff || 0);
        
        // Add support bonus
        const supportCol = this.getSupportCol(owner);
        const field = this.getField(owner);
        const support = field[supportCol]?.[attacker.row];
        
        if (support) {
            damage += (support.currentAtk || support.atk) - (support.atkDebuff || 0);
        }
        
        // Apply curse reduction
        if (attacker.curseTokens > 0) {
            damage -= attacker.curseTokens;
        }
        
        return Math.max(0, damage);
    }
    
    dealDamage(target, amount, source, damageType) {
        if (amount <= 0) return;
        
        // Apply damage reduction
        if (target.damageReduction && damageType === 'attack') {
            amount = Math.max(1, amount - target.damageReduction);
        }
        
        // Check protection
        if (target.hasProtection) {
            target.hasProtection = false;
            this.emit('protectionRemoved', {
                owner: target.owner,
                col: target.col,
                row: target.row
            });
            this.addAnimation('protectionBlock', {
                targetOwner: target.owner,
                targetRow: target.row
            });
            return;
        }
        
        const hpBefore = target.currentHp;
        target.currentHp -= amount;
        
        this.emit('damageDealt', {
            targetOwner: target.owner,
            targetCol: target.col,
            targetRow: target.row,
            amount,
            damageType,
            sourceOwner: source?.owner,
            newHp: target.currentHp,
            hpBefore
        });
        
        this.addAnimation('damage', {
            targetOwner: target.owner,
            targetCol: target.col,
            targetRow: target.row,
            amount,
            damageType
        });
        
        // Trigger onDamageTaken
        this.triggerAbility(target, 'onDamageTaken', { damage: amount, source });
        
        // Notify damage listeners
        for (const listener of this.damageListeners) {
            listener(target, amount, source);
        }
        
        // Check death
        if (target.currentHp <= 0) {
            target.killedBy = damageType;
            target.killedBySource = source;
            this.killCryptid(target);
        }
    }
    
    killCryptid(cryptid, options = {}) {
        // Trigger onDeath (may prevent death)
        const deathResult = this.triggerAbility(cryptid, 'onDeath');
        
        if (cryptid.preventDeath) {
            cryptid.preventDeath = false;
            return;
        }
        
        const { owner, col, row } = cryptid;
        const field = this.getField(owner);
        
        // Remove from field
        field[col][row] = null;
        
        // Increment death count
        if (owner === 'player') {
            this.state.playerDeaths++;
        } else {
            this.state.enemyDeaths++;
        }
        
        this.emit('cryptidDied', {
            owner,
            col,
            row,
            cryptid: this.serializeCryptid(cryptid),
            killedBy: cryptid.killedBy
        });
        
        this.addAnimation('death', {
            owner,
            col,
            row,
            cryptidKey: cryptid.key
        });
        
        // Notify death listeners (for Mothman etc)
        for (const listener of this.deathListeners) {
            listener(cryptid);
        }
        
        // Trigger onKill for the killer
        if (cryptid.killedBySource) {
            this.triggerAbility(cryptid.killedBySource, 'onKill', { target: cryptid });
        }
        
        // Queue promotion if in combat position
        if (!options.skipPromotion && col === this.getCombatCol(owner)) {
            this.queuePromotion(owner, row);
        }
        
        // Check game end
        this.checkGameEnd();
    }
    
    queuePromotion(owner, row) {
        this.pendingPromotions.push({ owner, row });
    }
    
    processPendingPromotions() {
        for (const { owner, row } of this.pendingPromotions) {
            this.checkPromotion(owner, row);
        }
        this.pendingPromotions = [];
    }
    
    checkPromotion(owner, row) {
        const combatCol = this.getCombatCol(owner);
        const supportCol = this.getSupportCol(owner);
        const field = this.getField(owner);
        
        if (!field[combatCol][row] && field[supportCol][row]) {
            const support = field[supportCol][row];
            field[supportCol][row] = null;
            field[combatCol][row] = support;
            support.col = combatCol;
            
            this.emit('cryptidPromoted', {
                owner,
                fromCol: supportCol,
                toCol: combatCol,
                row,
                cryptid: this.serializeCryptid(support)
            });
            
            this.addAnimation('promotion', {
                owner,
                row,
                cryptidKey: support.key
            });
            
            // Trigger onEnterCombat for promoted cryptid
            this.triggerAbility(support, 'onEnterCombat', { promoted: true });
        }
    }
    
    evolveInPlace(cryptid, evolutionCard) {
        const cardDef = ServerCardRegistry.get(evolutionCard.key) || evolutionCard;
        
        const oldKey = cryptid.key;
        cryptid.key = evolutionCard.key;
        cryptid.name = cardDef.name;
        
        // Calculate stat changes
        const atkDiff = (cardDef.atk || 0) - (cryptid.baseAtk || 0);
        const hpDiff = (cardDef.hp || 0) - (cryptid.baseHp || 0);
        
        cryptid.currentAtk = (cryptid.currentAtk || cryptid.baseAtk) + atkDiff;
        cryptid.currentHp = (cryptid.currentHp || cryptid.baseHp) + hpDiff;
        cryptid.maxHp = (cryptid.maxHp || cryptid.baseHp) + hpDiff;
        cryptid.baseAtk = cardDef.atk || 0;
        cryptid.baseHp = cardDef.hp || 0;
        
        // Update abilities
        cryptid.canTargetAny = cardDef.canTargetAny || false;
        cryptid.bonusVsBurning = cardDef.bonusVsBurning || 0;
        cryptid.attacksAllCombatants = cardDef.attacksAllCombatants || false;
        
        cryptid.evolutionChain = cryptid.evolutionChain || [];
        cryptid.evolutionChain.push(evolutionCard.key);
        
        cryptid.isKindling = false;
    }
    
    // ==================== STATUS EFFECTS ====================
    
    applyBurn(target, stacks = 1) {
        if (target.hasMothmanImmunity) return;
        
        target.burnStacks = (target.burnStacks || 0) + stacks;
        
        this.emit('burnApplied', {
            owner: target.owner,
            col: target.col,
            row: target.row,
            stacks,
            totalStacks: target.burnStacks
        });
        
        this.addAnimation('statusApply', {
            targetOwner: target.owner,
            targetRow: target.row,
            targetCol: target.col,
            status: 'burn',
            stacks
        });
    }
    
    applyCurse(target, tokens = 1) {
        if (target.hasMothmanImmunity) return;
        
        target.curseTokens = (target.curseTokens || 0) + tokens;
        
        this.emit('curseApplied', {
            owner: target.owner,
            col: target.col,
            row: target.row,
            tokens,
            totalTokens: target.curseTokens
        });
        
        this.addAnimation('statusApply', {
            targetOwner: target.owner,
            targetRow: target.row,
            targetCol: target.col,
            status: 'curse',
            stacks: tokens
        });
    }
    
    applyBleed(target, stacks = 1) {
        if (target.hasMothmanImmunity) return;
        
        target.bleedStacks = (target.bleedStacks || 0) + stacks;
        
        this.emit('bleedApplied', {
            owner: target.owner,
            col: target.col,
            row: target.row,
            stacks,
            totalStacks: target.bleedStacks
        });
        
        this.addAnimation('statusApply', {
            targetOwner: target.owner,
            targetRow: target.row,
            targetCol: target.col,
            status: 'bleed',
            stacks
        });
    }
    
    applyParalyze(target, turns = 1) {
        if (target.hasMothmanImmunity) return;
        
        target.paralyzed = true;
        target.paralyzedTurns = (target.paralyzedTurns || 0) + turns;
        
        this.emit('paralyzed', {
            owner: target.owner,
            col: target.col,
            row: target.row,
            turns
        });
        
        this.addAnimation('statusApply', {
            targetOwner: target.owner,
            targetRow: target.row,
            targetCol: target.col,
            status: 'paralyzed',
            stacks: turns
        });
    }
    
    processTurnStartEffects(owner) {
        const field = this.getField(owner);
        
        for (let col = 0; col < 2; col++) {
            for (let row = 0; row < 3; row++) {
                const cryptid = field[col][row];
                if (!cryptid) continue;
                
                // Process burn damage
                if (cryptid.burnStacks > 0) {
                    const burnDamage = cryptid.burnStacks;
                    this.dealDamage(cryptid, burnDamage, null, 'burn');
                    
                    if (cryptid.currentHp > 0) {
                        cryptid.burnStacks = Math.max(0, cryptid.burnStacks - 1);
                    }
                }
                
                // Process bleed damage
                if (cryptid.bleedStacks > 0 && cryptid.attackedThisTurn) {
                    const bleedDamage = cryptid.bleedStacks;
                    this.dealDamage(cryptid, bleedDamage, null, 'bleed');
                }
                
                // Process curse decay
                if (cryptid.curseTokens > 0) {
                    cryptid.curseTokens = Math.max(0, cryptid.curseTokens - 1);
                }
                
                // Process paralysis
                if (cryptid.paralyzed) {
                    cryptid.paralyzedTurns = Math.max(0, (cryptid.paralyzedTurns || 0) - 1);
                    if (cryptid.paralyzedTurns <= 0) {
                        cryptid.paralyzed = false;
                    }
                }
                
                // Trigger onTurnStart ability
                this.triggerAbility(cryptid, 'onTurnStart');
                
                // Trigger support turn start if in support position
                if (col === this.getSupportCol(owner)) {
                    this.triggerAbility(cryptid, 'onTurnStartSupport');
                }
            }
        }
    }
    
    // ==================== TRAP HANDLING ====================
    
    checkTrapsOnSummon(summoner, col, row) {
        const opponentOwner = summoner === 'player' ? 'enemy' : 'player';
        const traps = this.getTraps(opponentOwner);
        const trap = traps[row];
        
        if (!trap) return null;
        
        const trapDef = ServerCardRegistry.get(trap.key);
        if (!trapDef?.onEnemySummonInRow) return null;
        
        const summoned = this.getFieldCryptid(summoner, col, row);
        if (!summoned) return null;
        
        // Trigger trap
        const result = trapDef.onEnemySummonInRow(trap, summoned, this);
        
        // Remove trap
        traps[row] = null;
        
        return { triggered: true, trapKey: trap.key, result };
    }
    
    checkTrapsOnAttack(attackerOwner, targetRow) {
        const opponentOwner = attackerOwner === 'player' ? 'enemy' : 'player';
        const traps = this.getTraps(opponentOwner);
        const trap = traps[targetRow];
        
        if (!trap) return null;
        
        const trapDef = ServerCardRegistry.get(trap.key);
        if (!trapDef?.onEnemyAttackInRow) return null;
        
        const attacker = this.getFieldCryptid(attackerOwner, this.getCombatCol(attackerOwner), targetRow);
        if (!attacker) return null;
        
        // Trigger trap
        const result = trapDef.onEnemyAttackInRow(trap, attacker, this);
        
        // Remove trap
        traps[targetRow] = null;
        
        return { triggered: true, trapKey: trap.key, result };
    }
    
    // ==================== ABILITY TRIGGER SYSTEM ====================
    
    triggerAbility(cryptid, abilityName, context = {}) {
        const cardDef = ServerCardRegistry.get(cryptid.key);
        if (!cardDef) return null;
        
        const abilityFn = cardDef[abilityName];
        if (!abilityFn || typeof abilityFn !== 'function') return null;
        
        try {
            const result = abilityFn(cryptid, this, context);
            
            if (result) {
                this.emit('abilityTriggered', {
                    owner: cryptid.owner,
                    col: cryptid.col,
                    row: cryptid.row,
                    cryptidKey: cryptid.key,
                    abilityName,
                    result
                });
            }
            
            return result;
        } catch (err) {
            console.error(`Error triggering ability ${abilityName} on ${cryptid.key}:`, err);
            return null;
        }
    }
    
    // ==================== TURN MANAGEMENT ====================
    
    endTurn(owner) {
        this.emit('turnEnd', {
            owner,
            turnNumber: this.state.turnNumber
        });
        
        this.addAnimation('turnEnd', { owner });
        
        // Switch turn
        this.state.currentTurn = this.state.currentTurn === 'player' ? 'enemy' : 'player';
        this.state.phase = 'conjure1';
        
        if (this.state.currentTurn === 'player') {
            this.state.turnNumber++;
        }
        
        // Reset per-turn flags
        this.resetTurnFlags(this.state.currentTurn);
        
        // Process turn start effects (burn, bleed, etc)
        this.processTurnStartEffects(this.state.currentTurn);
        
        // Draw card
        this.drawCard(this.state.currentTurn);
        
        this.emit('turnStart', {
            owner: this.state.currentTurn,
            turnNumber: this.state.turnNumber
        });
        
        this.addAnimation('turnStart', { 
            owner: this.state.currentTurn,
            turnNumber: this.state.turnNumber
        });
    }
    
    resetTurnFlags(owner) {
        if (owner === 'player') {
            this.state.playerKindlingPlayed = false;
            this.state.playerPyreCardPlayed = false;
            this.state.playerPyreBurnUsed = false;
        } else {
            this.state.enemyKindlingPlayed = false;
            this.state.enemyPyreCardPlayed = false;
            this.state.enemyPyreBurnUsed = false;
        }
        
        // Untap cryptids
        const field = this.getField(owner);
        for (let col = 0; col < 2; col++) {
            for (let row = 0; row < 3; row++) {
                const cryptid = field[col][row];
                if (cryptid) {
                    cryptid.tapped = false;
                    cryptid.attackedThisTurn = false;
                    cryptid.justSummoned = false;
                }
            }
        }
    }
    
    drawCard(owner) {
        const deck = this.getDeck(owner);
        const hand = this.getHand(owner);
        
        if (deck.length > 0) {
            const card = deck.shift();
            hand.push(card);
            
            this.emit('cardDrawn', {
                owner,
                card: this.serializeCard(card)
            });
            
            this.addAnimation('cardDraw', { owner });
        }
    }
    
    // ==================== WIN CONDITION ====================
    
    checkGameEnd() {
        const playerCryptids = this.countCryptids('player');
        const enemyCryptids = this.countCryptids('enemy');
        
        if (enemyCryptids === 0 && this.state.enemyKindling.length === 0) {
            this.state.gameOver = true;
            this.state.winner = 'player';
            this.emit('matchEnd', { winner: 'player', reason: 'elimination' });
            this.addAnimation('matchEnd', { winner: 'player' });
        } else if (playerCryptids === 0 && this.state.playerKindling.length === 0) {
            this.state.gameOver = true;
            this.state.winner = 'enemy';
            this.emit('matchEnd', { winner: 'enemy', reason: 'elimination' });
            this.addAnimation('matchEnd', { winner: 'enemy' });
        }
    }
    
    countCryptids(owner) {
        const field = this.getField(owner);
        let count = 0;
        for (let col = 0; col < 2; col++) {
            for (let row = 0; row < 3; row++) {
                if (field[col][row]) count++;
            }
        }
        return count;
    }
    
    // ==================== GETTERS ====================
    
    getField(owner) {
        return owner === 'player' ? this.state.playerField : this.state.enemyField;
    }
    
    getHand(owner) {
        return owner === 'player' ? this.state.playerHand : this.state.enemyHand;
    }
    
    getDeck(owner) {
        return owner === 'player' ? this.state.playerDeck : this.state.enemyDeck;
    }
    
    getKindlingPool(owner) {
        return owner === 'player' ? this.state.playerKindling : this.state.enemyKindling;
    }
    
    getTraps(owner) {
        return owner === 'player' ? this.state.playerTraps : this.state.enemyTraps;
    }
    
    getPyre(owner) {
        return owner === 'player' ? this.state.playerPyre : this.state.enemyPyre;
    }
    
    getCombatCol(owner) {
        return owner === 'player' ? 0 : 1;
    }
    
    getSupportCol(owner) {
        return owner === 'player' ? 1 : 0;
    }
    
    getFieldCryptid(owner, col, row) {
        return this.getField(owner)[col]?.[row] || null;
    }
    
    getCombatant(support) {
        const combatCol = this.getCombatCol(support.owner);
        return this.getFieldCryptid(support.owner, combatCol, support.row);
    }
    
    getEnemyCombatantAcross(cryptid) {
        const enemyOwner = cryptid.owner === 'player' ? 'enemy' : 'player';
        const combatCol = this.getCombatCol(enemyOwner);
        return this.getFieldCryptid(enemyOwner, combatCol, cryptid.row);
    }
    
    getAllCryptids(owner) {
        const field = this.getField(owner);
        const cryptids = [];
        for (let col = 0; col < 2; col++) {
            for (let row = 0; row < 3; row++) {
                if (field[col][row]) {
                    cryptids.push(field[col][row]);
                }
            }
        }
        return cryptids;
    }
    
    findCryptidById(owner, id) {
        const field = this.getField(owner);
        for (let col = 0; col < 2; col++) {
            for (let row = 0; row < 3; row++) {
                if (field[col][row]?.id === id) {
                    return field[col][row];
                }
            }
        }
        return null;
    }
    
    findEvolutionCard(owner, key) {
        // Check hand first
        const hand = this.getHand(owner);
        const inHand = hand.find(c => c.key === key);
        if (inHand) return { card: inHand, location: 'hand' };
        
        // Check deck
        const deck = this.getDeck(owner);
        const inDeck = deck.find(c => c.key === key);
        if (inDeck) return { card: inDeck, location: 'deck' };
        
        return null;
    }
    
    removeCard(cardInfo) {
        if (cardInfo.location === 'hand') {
            const hand = this.getHand(cardInfo.card.owner || 'player');
            const idx = hand.findIndex(c => c.id === cardInfo.card.id);
            if (idx !== -1) hand.splice(idx, 1);
        } else if (cardInfo.location === 'deck') {
            const deck = this.getDeck(cardInfo.card.owner || 'player');
            const idx = deck.findIndex(c => c.id === cardInfo.card.id);
            if (idx !== -1) deck.splice(idx, 1);
        }
    }
    
    // ==================== PYRE MODIFICATION ====================
    
    modifyPyre(owner, amount) {
        if (owner === 'player') {
            this.state.playerPyre = Math.max(0, this.state.playerPyre + amount);
        } else {
            this.state.enemyPyre = Math.max(0, this.state.enemyPyre + amount);
        }
        
        this.emit('pyreChanged', {
            owner,
            amount,
            newValue: this.getPyre(owner)
        });
    }
    
    // ==================== SERIALIZATION ====================
    
    emit(type, data) {
        this.events.push({ type, ...data, timestamp: Date.now() });
    }
    
    addAnimation(type, data) {
        this.animationSequence.push({ type, ...data });
    }
    
    serializeCryptid(cryptid) {
        return {
            id: cryptid.id,
            key: cryptid.key,
            name: cryptid.name,
            owner: cryptid.owner,
            col: cryptid.col,
            row: cryptid.row,
            currentAtk: cryptid.currentAtk,
            currentHp: cryptid.currentHp,
            maxHp: cryptid.maxHp,
            baseAtk: cryptid.baseAtk,
            baseHp: cryptid.baseHp,
            tapped: cryptid.tapped,
            burnStacks: cryptid.burnStacks || 0,
            bleedStacks: cryptid.bleedStacks || 0,
            curseTokens: cryptid.curseTokens || 0,
            paralyzed: cryptid.paralyzed || false,
            hasProtection: cryptid.hasProtection || false,
            isKindling: cryptid.isKindling || false,
            evolutionChain: cryptid.evolutionChain || [],
            element: cryptid.element,
            rarity: cryptid.rarity,
            canTargetAny: cryptid.canTargetAny || false,
            bonusVsBurning: cryptid.bonusVsBurning || 0
        };
    }
    
    serializeCard(card) {
        return {
            id: card.id,
            key: card.key,
            name: card.name,
            type: card.type,
            cost: card.cost,
            atk: card.atk,
            hp: card.hp,
            element: card.element,
            rarity: card.rarity,
            evolvesFrom: card.evolvesFrom
        };
    }
    
    getStateForPlayer(playerId, isPlayer1) {
        const myOwner = isPlayer1 ? 'player' : 'enemy';
        const oppOwner = isPlayer1 ? 'enemy' : 'player';
        
        const myField = this.getField(myOwner);
        const oppField = this.getField(oppOwner);
        const myHand = this.getHand(myOwner);
        const oppHand = this.getHand(oppOwner);
        const myKindling = this.getKindlingPool(myOwner);
        const oppKindling = this.getKindlingPool(oppOwner);
        const myPyre = this.getPyre(myOwner);
        const oppPyre = this.getPyre(oppOwner);
        const myTraps = this.getTraps(myOwner);
        const oppTraps = this.getTraps(oppOwner);
        
        const isMyTurn = this.state.currentTurn === myOwner;
        
        return {
            playerField: myField.map(col => col.map(c => c ? this.serializeCryptid(c) : null)),
            enemyField: oppField.map(col => col.map(c => c ? this.serializeCryptid(c) : null)),
            hand: myHand.map(c => this.serializeCard(c)),
            kindling: myKindling.map(c => this.serializeCard(c)),
            opponentHandCount: oppHand.length,
            opponentKindlingCount: oppKindling.length,
            playerPyre: myPyre,
            enemyPyre: oppPyre,
            playerTraps: myTraps,
            enemyTraps: oppTraps.map(t => t ? { type: 'trap', faceDown: true, row: t.row } : null),
            isMyTurn,
            phase: this.state.phase,
            turnNumber: this.state.turnNumber,
            kindlingPlayed: myOwner === 'player' ? this.state.playerKindlingPlayed : this.state.enemyKindlingPlayed,
            pyreCardPlayed: myOwner === 'player' ? this.state.playerPyreCardPlayed : this.state.enemyPyreCardPlayed,
            pyreBurnUsed: myOwner === 'player' ? this.state.playerPyreBurnUsed : this.state.enemyPyreBurnUsed,
            gameOver: this.state.gameOver,
            winner: this.state.winner ? 
                (this.state.winner === myOwner ? 'player' : 'enemy') : null
        };
    }
    
    filterEventsForPlayer(events, isPlayer1) {
        const myOwner = isPlayer1 ? 'player' : 'enemy';
        
        return events.map(event => {
            // Hide opponent's card draws
            if (event.type === 'cardDrawn' && event.owner !== myOwner) {
                return { type: event.type, owner: event.owner === myOwner ? 'player' : 'enemy', cardCount: 1 };
            }
            
            // Flip perspective for owner fields
            if (event.owner) {
                return {
                    ...event,
                    owner: event.owner === myOwner ? 'player' : 'enemy'
                };
            }
            
            // Flip targetOwner, attackerOwner, etc
            const flipped = { ...event };
            if (flipped.targetOwner) {
                flipped.targetOwner = flipped.targetOwner === myOwner ? 'player' : 'enemy';
            }
            if (flipped.attackerOwner) {
                flipped.attackerOwner = flipped.attackerOwner === myOwner ? 'player' : 'enemy';
            }
            if (flipped.sourceOwner) {
                flipped.sourceOwner = flipped.sourceOwner === myOwner ? 'player' : 'enemy';
            }
            
            return flipped;
        });
    }
    
    // Get the full game state for snapshot/debug
    getFullState() {
        return JSON.parse(JSON.stringify(this.state));
    }
}

export { ServerGameEngine, SeededRNG };

