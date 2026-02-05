/**
 * Cryptid Fates - Shared Game Logic Bundle
 * 
 * This is a bundled version of all shared modules for use in environments
 * that don't support ES modules (like Cloudflare Workers without bundler).
 * 
 * Copy this entire file into your worker or include it inline.
 * 
 * Generated from: events.js, schema.js, card-registry.js, effect-resolver.js,
 *                 game-state.js, combat-engine.js, trap-system.js, turn-processor.js
 */

const CryptidSharedBundle = (function() {
    'use strict';

    // ==================== EVENTS MODULE ====================
    
    function createGameEvents(options = {}) {
        const debug = options.debug || false;
        const logger = options.logger || console.log;
        const listeners = new Map();
        const onceListeners = new Map();

        function log(...args) {
            if (debug) logger('[GameEvents]', ...args);
        }

        function on(eventType, callback) {
            if (!listeners.has(eventType)) {
                listeners.set(eventType, new Set());
            }
            listeners.get(eventType).add(callback);
            log('Listener added for:', eventType);
            return () => off(eventType, callback);
        }

        function once(eventType, callback) {
            if (!onceListeners.has(eventType)) {
                onceListeners.set(eventType, new Set());
            }
            onceListeners.get(eventType).add(callback);
            return () => {
                const set = onceListeners.get(eventType);
                if (set) set.delete(callback);
            };
        }

        function off(eventType, callback) {
            const typeListeners = listeners.get(eventType);
            if (typeListeners) {
                typeListeners.delete(callback);
            }
        }

        function emit(eventType, data = {}) {
            log('Emit:', eventType, data);
            const typeListeners = listeners.get(eventType);
            if (typeListeners) {
                for (const callback of typeListeners) {
                    try { callback(data); } catch (e) { console.error('Event handler error:', e); }
                }
            }
            const typeOnceListeners = onceListeners.get(eventType);
            if (typeOnceListeners) {
                for (const callback of typeOnceListeners) {
                    try { callback(data); } catch (e) { console.error('Event handler error:', e); }
                }
                onceListeners.delete(eventType);
            }
        }

        function clear() {
            listeners.clear();
            onceListeners.clear();
        }

        return { on, once, off, emit, clear };
    }

    const GameEventTypes = {
        TURN_START: 'onTurnStart',
        TURN_END: 'onTurnEnd',
        PHASE_CHANGE: 'onPhaseChange',
        SUMMON: 'onSummon',
        DEATH: 'onDeath',
        DAMAGE: 'onDamage',
        ATTACK: 'onAttack',
        HEAL: 'onHeal',
        PYRE_CHANGE: 'onPyreChange',
        CARD_DRAWN: 'onCardDrawn',
        EFFECT_TRIGGERED: 'onEffectTriggered',
        AILMENT_APPLIED: 'onAilmentApplied',
        TRAP_TRIGGERED: 'onTrapTriggered',
        GAME_END: 'onGameEnd'
    };

    // ==================== SCHEMA MODULE ====================
    
    const EffectTriggers = {
        ON_SUMMON: 'onSummon',
        ON_DEATH: 'onDeath',
        ON_ENTER_COMBAT: 'onEnterCombat',
        ON_ENTER_SUPPORT: 'onEnterSupport',
        ON_ATTACK: 'onAttack',
        ON_DAMAGE: 'onDamage',
        ON_TURN_START: 'onTurnStart',
        ON_TURN_END: 'onTurnEnd',
        ON_ALLY_SUMMON: 'onAllySummon',
        ON_ENEMY_SUMMON: 'onEnemySummon',
        ON_ALLY_DEATH: 'onAllyDeath',
        ON_ENEMY_DEATH: 'onEnemyDeath',
        ON_EVOLVE: 'onEvolve',
        ON_CAST: 'onCast',
        PASSIVE: 'passive'
    };

    const EffectActions = {
        DEAL_DAMAGE: 'dealDamage',
        HEAL: 'heal',
        BUFF_STATS: 'buffStats',
        DEBUFF_STATS: 'debuffStats',
        APPLY_BURN: 'applyBurn',
        APPLY_BLEED: 'applyBleed',
        APPLY_PARALYZE: 'applyParalyze',
        APPLY_CURSE: 'applyCurse',
        APPLY_CALAMITY: 'applyCalamity',
        APPLY_PROTECTION: 'applyProtection',
        CLEANSE: 'cleanse',
        DRAW_CARD: 'drawCard',
        GAIN_PYRE: 'gainPyre',
        LOSE_PYRE: 'losePyre',
        SUMMON_CRYPTID: 'summonCryptid',
        DESTROY_CRYPTID: 'destroyCryptid',
        MOVE_CRYPTID: 'moveCryptid',
        GRANT_KEYWORD: 'grantKeyword',
        TRANSFORM: 'transform',
        COPY: 'copy',
        STEAL_STATS: 'stealStats'
    };

    const EffectTargets = {
        SELF: 'self',
        ALL_ALLIES: 'allAllies',
        ALL_ENEMIES: 'allEnemies',
        ALL_CRYPTIDS: 'allCryptids',
        RANDOM_ALLY: 'randomAlly',
        RANDOM_ENEMY: 'randomEnemy',
        ADJACENT_ALLIES: 'adjacentAllies',
        ADJACENT_ENEMIES: 'adjacentEnemies',
        SUPPORT: 'support',
        COMBATANT: 'combatant',
        ROW: 'row',
        COLUMN: 'column',
        CHOOSE_ONE: 'chooseOne',
        TRIGGERING_CRYPTID: 'triggeringCryptid',
        ATTACKER: 'attacker',
        DEFENDER: 'defender'
    };

    const GamePhases = {
        CONJURE_1: 'conjure1',
        DEPLOY: 'deploy',
        CONJURE_2: 'conjure2',
        COMBAT: 'combat',
        END_PHASE: 'endPhase'
    };

    const Ailments = {
        BURN: 'burn',
        BLEED: 'bleed',
        PARALYZE: 'paralyze',
        CURSE: 'curse',
        CALAMITY: 'calamity',
        TOXIC: 'toxic'
    };

    const Keywords = {
        FOCUS: 'focus',
        CLEAVE: 'cleave',
        DESTROYER: 'destroyer',
        LIFESTEAL: 'lifesteal',
        ETHEREAL: 'ethereal',
        GUARDIAN: 'guardian',
        HASTE: 'haste',
        RADIANCE: 'radiance',
        DEATHTOUCH: 'deathtouch'
    };

    const CardTypes = {
        CRYPTID: 'cryptid',
        SPELL: 'spell',
        TRAP: 'trap',
        AURA: 'aura',
        PYRE: 'pyre',
        KINDLING: 'kindling'
    };

    const EffectSchema = {
        Triggers: EffectTriggers,
        Actions: EffectActions,
        Targets: EffectTargets,
        Phases: GamePhases,
        Ailments,
        Keywords,
        CardTypes
    };

    // ==================== GAME STATE MODULE ====================
    
    function createGameState(options = {}) {
        const debug = options.debug || false;
        const logger = options.logger || console.log;
        let events = options.events;

        function log(...args) {
            if (debug) logger('[GameState]', ...args);
        }

        const state = {
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
            playerDeaths: 0,
            enemyDeaths: 0,
            playerTraps: [null, null],
            enemyTraps: [null, null],
            traps: { player: [], enemy: [] },
            currentTurn: 'player',
            phase: GamePhases.CONJURE_1,
            turnNumber: 0,
            gameOver: false,
            winner: null,
            playerKindlingPlayedThisTurn: false,
            enemyKindlingPlayedThisTurn: false,
            playerPyreCardPlayedThisTurn: false,
            enemyPyreCardPlayedThisTurn: false,
            playerPyreBurnUsed: false,
            enemyPyreBurnUsed: false,
            attackersThisTurn: { player: [], enemy: [] },
            matchStats: { damageDealt: 0, damageTaken: 0 }
        };

        function getCombatCol(owner) { return owner === 'player' ? 1 : 0; }
        function getSupportCol(owner) { return owner === 'player' ? 0 : 1; }
        function getField(owner) { return owner === 'player' ? state.playerField : state.enemyField; }
        
        function getFieldCryptid(owner, col, row) {
            const field = getField(owner);
            return field[col]?.[row] || null;
        }
        
        function setFieldCryptid(owner, col, row, cryptid) {
            const field = getField(owner);
            if (field[col]) {
                field[col][row] = cryptid;
                if (cryptid) {
                    cryptid.owner = owner;
                    cryptid.col = col;
                    cryptid.row = row;
                }
            }
        }

        function getCombatantAtRow(owner, row) {
            return getFieldCryptid(owner, getCombatCol(owner), row);
        }

        function getSupportAtRow(owner, row) {
            return getFieldCryptid(owner, getSupportCol(owner), row);
        }

        function getSupport(cryptid) {
            if (!cryptid) return null;
            const { owner, row } = cryptid;
            const combatCol = getCombatCol(owner);
            if (cryptid.col === combatCol) {
                return getFieldCryptid(owner, getSupportCol(owner), row);
            }
            return null;
        }

        function isInCombat(cryptid) {
            if (!cryptid) return false;
            return cryptid.col === getCombatCol(cryptid.owner);
        }

        function isInSupport(cryptid) {
            if (!cryptid) return false;
            return cryptid.col === getSupportCol(cryptid.owner);
        }

        function getAllCryptids(owner) {
            const field = getField(owner);
            const cryptids = [];
            for (let col = 0; col < 2; col++) {
                for (let row = 0; row < 3; row++) {
                    if (field[col][row]) cryptids.push(field[col][row]);
                }
            }
            return cryptids;
        }

        function isFieldEmpty(owner) {
            return getAllCryptids(owner).length === 0;
        }

        function hasAilments(cryptid) {
            if (!cryptid) return false;
            return (cryptid.burnTurns > 0 || cryptid.bleedTurns > 0 || 
                    cryptid.paralyzed || cryptid.calamityCounters > 0 || 
                    cryptid.curseTokens > 0);
        }

        function getEffectiveHp(cryptid) {
            return cryptid?.currentHp ?? cryptid?.hp ?? 0;
        }

        function getEffectiveAtk(cryptid) {
            let atk = cryptid?.currentAtk ?? cryptid?.atk ?? 0;
            if (cryptid?.curseTokens > 0) {
                atk = Math.max(0, atk - cryptid.curseTokens);
            }
            return atk;
        }

        function isSupportNegated(support) {
            return support?.paralyzed || support?.negated;
        }

        function getPyre(owner) {
            return owner === 'player' ? state.playerPyre : state.enemyPyre;
        }

        function modifyPyre(owner, amount) {
            if (owner === 'player') {
                state.playerPyre = Math.max(0, state.playerPyre + amount);
            } else {
                state.enemyPyre = Math.max(0, state.enemyPyre + amount);
            }
            if (events) events.emit('onPyreChange', { owner, amount, newPyre: getPyre(owner) });
        }

        function getHand(owner) {
            return owner === 'player' ? state.playerHand : state.enemyHand;
        }

        function getDeck(owner) {
            return owner === 'player' ? state.playerDeck : state.enemyDeck;
        }

        function getKindling(owner) {
            return owner === 'player' ? state.playerKindling : state.enemyKindling;
        }

        function drawCard(owner, source = 'normal') {
            const deck = getDeck(owner);
            const hand = getHand(owner);
            if (deck.length === 0) return null;
            const card = deck.shift();
            hand.push(card);
            if (events) events.emit('onCardDrawn', { card, owner, source, handSize: hand.length });
            return card;
        }

        function removeFromHand(owner, cardIdOrIndex) {
            const hand = getHand(owner);
            let index = typeof cardIdOrIndex === 'number' ? cardIdOrIndex : 
                        hand.findIndex(c => c.id === cardIdOrIndex);
            if (index >= 0 && index < hand.length) {
                return hand.splice(index, 1)[0];
            }
            return null;
        }

        function summonCryptid(owner, col, row, cardData) {
            const field = getField(owner);
            if (col < 0 || col > 1 || row < 0 || row > 2) {
                return { success: false, error: 'INVALID_SLOT' };
            }
            if (field[col][row] !== null) {
                return { success: false, error: 'SLOT_OCCUPIED' };
            }
            
            const cryptid = {
                ...cardData,
                owner,
                col,
                row,
                currentHp: cardData.currentHp ?? cardData.hp,
                maxHp: cardData.maxHp ?? cardData.hp,
                currentAtk: cardData.currentAtk ?? cardData.atk,
                baseAtk: cardData.baseAtk ?? cardData.atk,
                tapped: false,
                canAttack: false,
                justSummoned: true,
                burnTurns: 0,
                bleedTurns: 0,
                paralyzed: false,
                calamityCounters: 0,
                curseTokens: 0,
                protectionCharges: 0
            };
            
            field[col][row] = cryptid;
            
            if (events) {
                events.emit('onSummon', { cryptid, owner, col, row });
                if (col === getCombatCol(owner)) {
                    events.emit('onEnterCombat', { cryptid, owner, col, row });
                } else {
                    events.emit('onEnterSupport', { cryptid, owner, col, row });
                }
            }
            
            log('Cryptid summoned:', cryptid.name, 'at', col, row);
            return { success: true, cryptid };
        }

        function applyAilment(cryptid, ailmentType, stacks = 1) {
            if (!cryptid || cryptid.ailmentImmune) return false;
            
            switch (ailmentType) {
                case 'burn':
                    cryptid.burnTurns = (cryptid.burnTurns || 0) + stacks;
                    break;
                case 'bleed':
                    cryptid.bleedTurns = (cryptid.bleedTurns || 0) + stacks;
                    break;
                case 'paralyze':
                    cryptid.paralyzed = true;
                    cryptid.paralyzeTurns = stacks;
                    break;
                case 'calamity':
                    cryptid.calamityCounters = (cryptid.calamityCounters || 0) + stacks;
                    break;
                case 'curse':
                    cryptid.curseTokens = (cryptid.curseTokens || 0) + stacks;
                    break;
            }
            
            if (events) events.emit('onAilmentApplied', { cryptid, ailmentType, stacks });
            return true;
        }

        function cleanse(cryptid, ailmentType = null) {
            if (!cryptid) return false;
            if (ailmentType) {
                switch (ailmentType) {
                    case 'burn': cryptid.burnTurns = 0; break;
                    case 'bleed': cryptid.bleedTurns = 0; break;
                    case 'paralyze': cryptid.paralyzed = false; cryptid.paralyzeTurns = 0; break;
                    case 'calamity': cryptid.calamityCounters = 0; break;
                    case 'curse': cryptid.curseTokens = 0; break;
                }
            } else {
                cryptid.burnTurns = 0;
                cryptid.bleedTurns = 0;
                cryptid.paralyzed = false;
                cryptid.paralyzeTurns = 0;
                cryptid.calamityCounters = 0;
                cryptid.curseTokens = 0;
            }
            return true;
        }

        function applyDamage(cryptid, amount, source = null) {
            if (!cryptid || amount <= 0) return { dealt: 0, died: false };
            const actualDamage = Math.min(amount, cryptid.currentHp);
            cryptid.currentHp -= actualDamage;
            if (events) events.emit('onDamage', { cryptid, damage: actualDamage, source });
            return { dealt: actualDamage, died: cryptid.currentHp <= 0 };
        }

        function heal(cryptid, amount) {
            if (!cryptid || amount <= 0) return 0;
            const maxHp = cryptid.maxHp || cryptid.hp;
            const actualHeal = Math.min(amount, maxHp - cryptid.currentHp);
            cryptid.currentHp += actualHeal;
            if (events) events.emit('onHeal', { cryptid, amount: actualHeal });
            return actualHeal;
        }

        function killCryptid(cryptid, killerOwner = null, options = {}) {
            if (!cryptid) return null;
            const { owner, col, row } = cryptid;
            const field = getField(owner);
            field[col][row] = null;
            
            if (owner === 'player') state.playerDeaths++;
            else state.enemyDeaths++;
            
            if (events) events.emit('onDeath', { cryptid, owner, col, row, killerOwner, ...options });
            
            log('Cryptid killed:', cryptid.name);
            return { cryptid, owner, col, row };
        }

        function promoteSupport(owner, row) {
            const combatCol = getCombatCol(owner);
            const supportCol = getSupportCol(owner);
            const field = getField(owner);
            
            if (field[combatCol][row]) return null;
            const support = field[supportCol][row];
            if (!support) return null;
            
            field[supportCol][row] = null;
            field[combatCol][row] = support;
            support.col = combatCol;
            support.canAttack = true;
            support.tapped = false;
            
            log('Support promoted:', support.name);
            return support;
        }

        function exportState() {
            return {
                playerField: state.playerField.map(col => col.map(c => c ? { ...c } : null)),
                enemyField: state.enemyField.map(col => col.map(c => c ? { ...c } : null)),
                playerHand: state.playerHand.map(c => ({ ...c })),
                enemyHand: state.enemyHand.map(c => ({ ...c })),
                playerKindling: state.playerKindling.map(c => ({ ...c })),
                enemyKindling: state.enemyKindling.map(c => ({ ...c })),
                playerPyre: state.playerPyre,
                enemyPyre: state.enemyPyre,
                playerDeaths: state.playerDeaths,
                enemyDeaths: state.enemyDeaths,
                currentTurn: state.currentTurn,
                phase: state.phase,
                turnNumber: state.turnNumber,
                gameOver: state.gameOver,
                winner: state.winner,
                playerTraps: state.playerTraps.map(t => t ? { ...t } : null),
                enemyTraps: state.enemyTraps.map(t => t ? { ...t } : null),
                playerKindlingPlayedThisTurn: state.playerKindlingPlayedThisTurn,
                enemyKindlingPlayedThisTurn: state.enemyKindlingPlayedThisTurn,
                playerPyreCardPlayedThisTurn: state.playerPyreCardPlayedThisTurn,
                enemyPyreCardPlayedThisTurn: state.enemyPyreCardPlayedThisTurn,
                playerPyreBurnUsed: state.playerPyreBurnUsed,
                enemyPyreBurnUsed: state.enemyPyreBurnUsed
            };
        }

        function importState(data) {
            Object.assign(state, data);
            for (const owner of ['player', 'enemy']) {
                const field = getField(owner);
                for (let col = 0; col < 2; col++) {
                    for (let row = 0; row < 3; row++) {
                        const cryptid = field[col]?.[row];
                        if (cryptid) {
                            cryptid.owner = owner;
                            cryptid.col = col;
                            cryptid.row = row;
                        }
                    }
                }
            }
        }

        return {
            state,
            getCombatCol, getSupportCol, getField, getFieldCryptid, setFieldCryptid,
            getCombatantAtRow, getSupportAtRow, getSupport, isInCombat, isInSupport,
            getAllCryptids, isFieldEmpty, hasAilments, getEffectiveHp, getEffectiveAtk,
            isSupportNegated, getPyre, modifyPyre, getHand, getDeck, getKindling,
            drawCard, removeFromHand, summonCryptid, applyAilment, cleanse,
            applyDamage, heal, killCryptid, promoteSupport, exportState, importState,
            events
        };
    }

    // ==================== COMBAT ENGINE MODULE ====================
    
    function createCombatEngine(options = {}) {
        const debug = options.debug || false;
        const logger = options.logger || console.log;
        let gameState = options.gameState;

        function log(...args) {
            if (debug) logger('[CombatEngine]', ...args);
        }

        function setGameState(gs) { gameState = gs; }

        function validateAttack(attacker, target) {
            if (!attacker) return { valid: false, reason: 'NO_ATTACKER' };
            if (!target) return { valid: false, reason: 'NO_TARGET' };
            if (!gameState) return { valid: false, reason: 'NO_GAME_STATE' };
            if (!gameState.isInCombat(attacker)) return { valid: false, reason: 'ATTACKER_NOT_IN_COMBAT' };
            if (attacker.owner === target.owner) return { valid: false, reason: 'SAME_TEAM' };
            if (attacker.tapped) return { valid: false, reason: 'ATTACKER_TAPPED' };
            if (attacker.canAttack === false && !attacker.canAttackAgain) return { valid: false, reason: 'CANNOT_ATTACK' };
            if (attacker.paralyzed) return { valid: false, reason: 'ATTACKER_PARALYZED' };
            return { valid: true };
        }

        function calculateDamage(attacker, target) {
            if (!gameState) return { baseDamage: 0, finalDamage: 0, modifiers: [] };
            
            const modifiers = [];
            let damage = gameState.getEffectiveAtk(attacker);
            modifiers.push({ type: 'baseAtk', value: damage });
            
            const support = gameState.getSupport(attacker);
            if (support && !gameState.isSupportNegated(support)) {
                const supportAtk = support.currentAtk ?? support.atk ?? 0;
                if (supportAtk > 0) {
                    damage += supportAtk;
                    modifiers.push({ type: 'supportAtk', value: supportAtk });
                }
            }
            
            const hasFocus = attacker.hasFocus || (support?.grantsFocus && !gameState.isSupportNegated(support));
            
            let multiplier = 1;
            if (target.bleedTurns > 0) {
                multiplier *= 2;
                modifiers.push({ type: 'bleed', multiplier: 2 });
            }
            damage *= multiplier;
            
            let protectionBlocked = false;
            if (!hasFocus && target.blockFirstHit && (target.damageReduction || 0) >= 999) {
                protectionBlocked = true;
                modifiers.push({ type: 'protection', blocked: true });
            }
            
            const finalDamage = protectionBlocked ? 0 : Math.max(0, damage);
            return { baseDamage: gameState.getEffectiveAtk(attacker), finalDamage, protectionBlocked, hasFocus, modifiers };
        }

        function resolveAttack(attacker, targetOwner, targetCol, targetRow) {
            if (!gameState) return { success: false, error: 'NO_GAME_STATE' };
            
            const target = gameState.getFieldCryptid(targetOwner, targetCol, targetRow);
            const validation = validateAttack(attacker, target);
            if (!validation.valid) return { success: false, error: validation.reason };
            
            const damageCalc = calculateDamage(attacker, target);
            
            const result = {
                success: true,
                attacker: { id: attacker.id, name: attacker.name, owner: attacker.owner, col: attacker.col, row: attacker.row },
                target: { id: target.id, name: target.name, owner: target.owner, col: target.col, row: target.row },
                damage: damageCalc.finalDamage,
                damageCalculation: damageCalc,
                effects: [],
                deaths: [],
                stateChanges: []
            };
            
            if (damageCalc.protectionBlocked) {
                result.effects.push({ type: 'protectionBlock', target: result.target });
            }
            
            if (result.damage > 0) {
                result.stateChanges.push({
                    type: 'modifyCryptid',
                    target: result.target,
                    changes: { currentHp: target.currentHp - result.damage }
                });
                
                if (target.currentHp - result.damage <= 0) {
                    result.deaths.push({
                        cryptid: result.target,
                        killedBy: 'attack',
                        killerOwner: attacker.owner
                    });
                }
            }
            
            // Tap attacker
            result.stateChanges.push({
                type: 'modifyCryptid',
                target: result.attacker,
                changes: { tapped: true, canAttack: false, attackedThisTurn: true }
            });
            
            log('Attack resolved:', result);
            return result;
        }

        function applyCombatResult(combatResult) {
            if (!gameState || !combatResult.success) return combatResult;
            
            for (const change of combatResult.stateChanges) {
                if (change.type === 'modifyCryptid') {
                    const cryptid = gameState.getFieldCryptid(change.target.owner, change.target.col, change.target.row);
                    if (cryptid) Object.assign(cryptid, change.changes);
                }
            }
            
            for (const death of combatResult.deaths) {
                const cryptid = gameState.getFieldCryptid(death.cryptid.owner, death.cryptid.col, death.cryptid.row);
                if (cryptid && !cryptid._alreadyKilled) {
                    gameState.killCryptid(cryptid, death.killerOwner, { killedBy: death.killedBy });
                }
            }
            
            return combatResult;
        }

        return { setGameState, validateAttack, calculateDamage, resolveAttack, applyCombatResult };
    }

    // ==================== TURN PROCESSOR MODULE ====================
    
    function createTurnProcessor(options = {}) {
        const debug = options.debug || false;
        const logger = options.logger || console.log;
        let gameState = options.gameState;
        let events = options.events;

        function log(...args) {
            if (debug) logger('[TurnProcessor]', ...args);
        }

        function setGameState(gs) { gameState = gs; }
        function setEvents(ev) { events = ev; }

        function processStartTurn(turnOwner) {
            if (!gameState) return { success: false, error: 'NO_GAME_STATE' };
            
            const result = { success: true, turnOwner, effects: [], stateChanges: [] };
            
            gameState.state.turnNumber++;
            gameState.state.currentTurn = turnOwner;
            gameState.state.phase = GamePhases.CONJURE_1;
            
            // Reset flags
            gameState.state.attackersThisTurn = { player: [], enemy: [] };
            if (turnOwner === 'player') {
                gameState.state.playerKindlingPlayedThisTurn = false;
                gameState.state.playerPyreCardPlayedThisTurn = false;
                gameState.state.playerPyreBurnUsed = false;
            } else {
                gameState.state.enemyKindlingPlayedThisTurn = false;
                gameState.state.enemyPyreCardPlayedThisTurn = false;
                gameState.state.enemyPyreBurnUsed = false;
            }
            
            // Untap and reset cryptids
            const cryptids = gameState.getAllCryptids(turnOwner);
            for (const cryptid of cryptids) {
                if (cryptid.tapped) cryptid.tapped = false;
                cryptid.canAttack = true;
                cryptid.justSummoned = false;
                if (cryptid.paralyzed) {
                    cryptid.paralyzed = false;
                    result.effects.push({ type: 'paralyzeRecovered', cryptid: { name: cryptid.name } });
                }
            }
            
            // Draw card
            const cardDrawn = gameState.drawCard(turnOwner);
            if (cardDrawn) {
                result.effects.push({ type: 'drawCard', owner: turnOwner, card: cardDrawn });
            }
            
            // Gain pyre
            gameState.modifyPyre(turnOwner, 1);
            result.effects.push({ type: 'gainPyre', owner: turnOwner, amount: 1 });
            
            if (events) events.emit('onTurnStart', { turn: gameState.state.turnNumber, owner: turnOwner });
            
            log('Turn started:', turnOwner, 'turn', gameState.state.turnNumber);
            return result;
        }

        function processEndTurn(turnOwner) {
            if (!gameState) return { success: false, error: 'NO_GAME_STATE' };
            
            const result = { success: true, turnOwner, effects: [], deaths: [], phaseEffects: { burn: [], bleed: [] } };
            
            gameState.state.phase = GamePhases.END_PHASE;
            
            // Process burn/bleed
            const cryptids = gameState.getAllCryptids(turnOwner);
            for (const cryptid of cryptids) {
                if (cryptid.burnTurns > 0) {
                    cryptid.currentHp -= 2;
                    cryptid.burnTurns--;
                    result.phaseEffects.burn.push({ cryptid: { name: cryptid.name }, damage: 2 });
                    if (cryptid.currentHp <= 0) {
                        result.deaths.push({ cryptid: { id: cryptid.id, name: cryptid.name, owner: cryptid.owner, col: cryptid.col, row: cryptid.row }, killedBy: 'burn' });
                    }
                }
                if (cryptid.bleedTurns > 0) {
                    cryptid.currentHp -= 1;
                    cryptid.bleedTurns--;
                    result.phaseEffects.bleed.push({ cryptid: { name: cryptid.name }, damage: 1 });
                    if (cryptid.currentHp <= 0 && !result.deaths.find(d => d.cryptid.id === cryptid.id)) {
                        result.deaths.push({ cryptid: { id: cryptid.id, name: cryptid.name, owner: cryptid.owner, col: cryptid.col, row: cryptid.row }, killedBy: 'bleed' });
                    }
                }
                if (cryptid.calamityCounters > 0) {
                    cryptid.calamityCounters--;
                    if (cryptid.calamityCounters <= 0) {
                        cryptid.currentHp = 0;
                        result.deaths.push({ cryptid: { id: cryptid.id, name: cryptid.name, owner: cryptid.owner, col: cryptid.col, row: cryptid.row }, killedBy: 'calamity' });
                    }
                }
            }
            
            if (events) events.emit('onTurnEnd', { turn: gameState.state.turnNumber, owner: turnOwner });
            
            log('Turn ended:', turnOwner);
            return result;
        }

        function advancePhase() {
            if (!gameState) return { success: false, error: 'NO_GAME_STATE' };
            
            const currentPhase = gameState.state.phase;
            let nextPhase;
            
            switch (currentPhase) {
                case GamePhases.CONJURE_1: nextPhase = GamePhases.COMBAT; break;
                case GamePhases.COMBAT: nextPhase = GamePhases.CONJURE_2; break;
                case GamePhases.CONJURE_2: nextPhase = GamePhases.END_PHASE; break;
                default: nextPhase = GamePhases.CONJURE_1;
            }
            
            gameState.state.phase = nextPhase;
            if (events) events.emit('onPhaseChange', { from: currentPhase, to: nextPhase });
            
            log('Phase advanced:', currentPhase, '->', nextPhase);
            return { success: true, previousPhase: currentPhase, currentPhase: nextPhase };
        }

        function checkGameOver() {
            if (!gameState) return { gameOver: false };
            
            if (gameState.state.playerDeaths >= 10) {
                return { gameOver: true, winner: 'enemy', reason: 'DEATHS' };
            }
            if (gameState.state.enemyDeaths >= 10) {
                return { gameOver: true, winner: 'player', reason: 'DEATHS' };
            }
            return { gameOver: false };
        }

        function getValidActionsForPhase(player) {
            if (!gameState) return [];
            const phase = gameState.state.phase;
            const isCurrentTurn = gameState.state.currentTurn === player;
            if (!isCurrentTurn) return [];
            
            switch (phase) {
                case GamePhases.CONJURE_1:
                case GamePhases.CONJURE_2:
                    return ['SUMMON_CRYPTID', 'SUMMON_KINDLING', 'PLAY_SPELL', 'PLAY_PYRE_CARD', 'PYRE_BURN', 'EVOLVE_CRYPTID', 'END_PHASE'];
                case GamePhases.COMBAT:
                    return ['ATTACK', 'END_COMBAT', 'END_TURN'];
                case GamePhases.END_PHASE:
                    return ['END_TURN'];
                default:
                    return [];
            }
        }

        return { setGameState, setEvents, processStartTurn, processEndTurn, advancePhase, checkGameOver, getValidActionsForPhase };
    }

    // ==================== TRAP SYSTEM MODULE ====================
    
    function createTrapSystem(options = {}) {
        const debug = options.debug || false;
        const logger = options.logger || console.log;
        let gameState = options.gameState;
        let events = options.events;

        function log(...args) {
            if (debug) logger('[TrapSystem]', ...args);
        }

        function setGameState(gs) { gameState = gs; }
        function setEvents(ev) { events = ev; }

        function setupTrap(card, owner) {
            if (!card || !card.effects) return { success: false, reason: 'INVALID_TRAP' };
            
            const triggerEffect = card.effects.find(e => e.trigger && e.trigger !== 'onCast');
            if (!triggerEffect) return { success: false, reason: 'NO_TRIGGER' };
            
            const trapData = {
                id: card.id || `trap-${Date.now()}`,
                cardId: card.id,
                name: card.name,
                owner,
                trigger: triggerEffect.trigger,
                effects: card.effects.filter(e => e.trigger !== 'onCast'),
                destroyed: false,
                chargesRemaining: triggerEffect.charges || 1
            };
            
            if (gameState?.state?.traps) {
                gameState.state.traps[owner].push(trapData);
            }
            
            log('Trap setup:', trapData.name);
            return { success: true, trap: trapData };
        }

        function checkTraps(triggerType, context) {
            if (!gameState?.state?.traps) return [];
            
            const results = [];
            const allTraps = [...gameState.state.traps.player, ...gameState.state.traps.enemy];
            
            for (const trap of allTraps) {
                if (trap.destroyed || trap.trigger !== triggerType) continue;
                results.push({ trap, context, effects: trap.effects });
                trap.chargesRemaining--;
                if (trap.chargesRemaining <= 0) trap.destroyed = true;
            }
            
            return results;
        }

        function clearTraps(owner) {
            if (!gameState?.state?.traps) return;
            if (owner) {
                gameState.state.traps[owner] = [];
            } else {
                gameState.state.traps = { player: [], enemy: [] };
            }
        }

        function exportTraps() {
            if (!gameState?.state?.traps) return { player: [], enemy: [] };
            return { player: [...gameState.state.traps.player], enemy: [...gameState.state.traps.enemy] };
        }

        function importTraps(trapData) {
            if (!gameState?.state) return;
            gameState.state.traps = { player: trapData?.player || [], enemy: trapData?.enemy || [] };
        }

        return { setGameState, setEvents, setupTrap, checkTraps, clearTraps, exportTraps, importTraps };
    }

    // ==================== CREATE GAME CONTEXT ====================
    
    function createGameContext(options = {}) {
        const debug = options.debug || false;
        const logger = options.logger || console.log;
        
        const events = createGameEvents({ debug, logger });
        const gameState = createGameState({ events, debug, logger });
        const combatEngine = createCombatEngine({ gameState, debug, logger });
        const trapSystem = createTrapSystem({ gameState, events, debug, logger });
        const turnProcessor = createTurnProcessor({ gameState, events, debug, logger });
        
        return {
            events,
            gameState,
            combatEngine,
            trapSystem,
            turnProcessor,
            
            reset() {
                gameState.state.playerField = [[null, null, null], [null, null, null]];
                gameState.state.enemyField = [[null, null, null], [null, null, null]];
                gameState.state.playerHand = [];
                gameState.state.enemyHand = [];
                gameState.state.playerDeck = [];
                gameState.state.enemyDeck = [];
                gameState.state.playerKindling = [];
                gameState.state.enemyKindling = [];
                gameState.state.playerPyre = 0;
                gameState.state.enemyPyre = 0;
                gameState.state.playerDeaths = 0;
                gameState.state.enemyDeaths = 0;
                gameState.state.turnNumber = 0;
                gameState.state.gameOver = false;
                gameState.state.winner = null;
                trapSystem.clearTraps();
            },
            
            exportState() {
                return {
                    gameState: gameState.exportState(),
                    traps: trapSystem.exportTraps()
                };
            },
            
            importState(data) {
                if (data.gameState) gameState.importState(data.gameState);
                if (data.traps) trapSystem.importTraps(data.traps);
            }
        };
    }

    // ==================== PUBLIC API ====================
    
    return {
        createGameEvents,
        GameEventTypes,
        EffectSchema,
        EffectTriggers,
        EffectActions,
        EffectTargets,
        GamePhases,
        Ailments,
        Keywords,
        CardTypes,
        createGameState,
        createCombatEngine,
        createTurnProcessor,
        createTrapSystem,
        createGameContext,
        version: '2.0.0'
    };
})();

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CryptidSharedBundle;
}
if (typeof window !== 'undefined') {
    window.CryptidShared = CryptidSharedBundle;
}
