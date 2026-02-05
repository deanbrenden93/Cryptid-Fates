/**
 * Cryptid Fates - Shared Combat Engine
 * 
 * Isomorphic combat resolution that runs identically on
 * both client (browser) and server (Cloudflare Worker).
 * 
 * This module contains:
 * - Attack validation
 * - Damage calculation with all modifiers
 * - Combat resolution (attack flow)
 * - Protection/blocking handling
 * - Cleave and special attack types
 * 
 * Returns "combat intents" - declarative descriptions of what happened,
 * so the client can play animations and the server can validate/broadcast.
 */

(function() {
'use strict';

// Import dependencies if in Node.js environment
let _gameStateModule;
if (typeof require !== 'undefined') {
    try {
        _gameStateModule = require('./game-state.js');
    } catch (e) {
        // Running in browser, modules will be on window
    }
}

/**
 * Create a combat engine instance
 * @param {Object} options - Configuration options
 * @param {Object} options.gameState - GameState instance
 * @param {boolean} options.debug - Enable debug logging
 * @param {Function} options.logger - Custom logging function
 * @returns {Object} CombatEngine instance
 */
function createCombatEngine(options = {}) {
    const debug = options.debug || false;
    const logger = options.logger || console.log;
    
    let gameState = options.gameState;
    
    function log(...args) {
        if (debug) logger('[CombatEngine]', ...args);
    }
    
    /**
     * Set the game state instance
     * @param {Object} gs - GameState instance
     */
    function setGameState(gs) {
        gameState = gs;
    }
    
    /**
     * Validate if an attack is legal
     * @param {Object} attacker - Attacking cryptid
     * @param {Object} target - Target cryptid
     * @returns {Object} { valid, reason? }
     */
    function validateAttack(attacker, target) {
        if (!attacker) {
            return { valid: false, reason: 'NO_ATTACKER' };
        }
        
        if (!target) {
            return { valid: false, reason: 'NO_TARGET' };
        }
        
        if (!gameState) {
            return { valid: false, reason: 'NO_GAME_STATE' };
        }
        
        // Must be in combat position
        if (!gameState.isInCombat(attacker)) {
            return { valid: false, reason: 'ATTACKER_NOT_IN_COMBAT' };
        }
        
        // Can't attack same side
        if (attacker.owner === target.owner) {
            return { valid: false, reason: 'SAME_TEAM' };
        }
        
        // Check if can attack
        if (attacker.tapped) {
            return { valid: false, reason: 'ATTACKER_TAPPED' };
        }
        
        if (attacker.canAttack === false && !attacker.canAttackAgain) {
            return { valid: false, reason: 'CANNOT_ATTACK' };
        }
        
        if (attacker.paralyzed) {
            return { valid: false, reason: 'ATTACKER_PARALYZED' };
        }
        
        // Latched units can only attack their latch target
        if (attacker.latchedTo) {
            const latchTarget = gameState.getFieldCryptid(
                attacker.latchedTo.owner,
                attacker.latchedTo.col,
                attacker.latchedTo.row
            );
            if (latchTarget !== target) {
                return { valid: false, reason: 'MUST_ATTACK_LATCH_TARGET' };
            }
        }
        
        return { valid: true };
    }
    
    /**
     * Calculate damage for an attack with all modifiers
     * @param {Object} attacker - Attacking cryptid
     * @param {Object} target - Target cryptid
     * @returns {Object} Damage calculation breakdown
     */
    function calculateDamage(attacker, target) {
        if (!gameState) {
            return { baseDamage: 0, finalDamage: 0, modifiers: [] };
        }
        
        const modifiers = [];
        let damage = gameState.getEffectiveAtk(attacker);
        modifiers.push({ type: 'baseAtk', value: damage });
        
        // Support ATK bonus
        const support = gameState.getSupport(attacker);
        if (support && !gameState.isSupportNegated(support)) {
            const supportAtk = support.currentAtk ?? support.atk ?? 0;
            if (supportAtk > 0) {
                damage += supportAtk;
                modifiers.push({ type: 'supportAtk', value: supportAtk, source: support.name });
            }
        }
        
        // Focus - ignore protection (calculated separately)
        const hasFocus = attacker.hasFocus || (support?.grantsFocus && !gameState.isSupportNegated(support));
        
        // Conditional bonuses
        if (target.paralyzed && attacker.bonusVsParalyzed) {
            damage += attacker.bonusVsParalyzed;
            modifiers.push({ type: 'bonusVsParalyzed', value: attacker.bonusVsParalyzed });
        }
        
        if (gameState.hasAilments(target) && attacker.bonusVsAilment) {
            damage += attacker.bonusVsAilment;
            modifiers.push({ type: 'bonusVsAilment', value: attacker.bonusVsAilment });
        }
        
        if (target.burnTurns > 0 && attacker.bonusVsBurning) {
            damage += attacker.bonusVsBurning;
            modifiers.push({ type: 'bonusVsBurning', value: attacker.bonusVsBurning });
        }
        
        // Double damage vs tapped
        let multiplier = 1;
        if (target.tapped && attacker.doubleDamageVsTapped) {
            multiplier *= 2;
            modifiers.push({ type: 'doubleDamageVsTapped', multiplier: 2 });
        }
        
        // Bleed doubles damage received
        if (target.bleedTurns > 0) {
            multiplier *= 2;
            modifiers.push({ type: 'bleed', multiplier: 2 });
        }
        
        damage *= multiplier;
        
        // Damage reduction (unless Focus)
        let reduction = target.damageReduction || 0;
        let protectionBlocked = false;
        
        if (!hasFocus) {
            // Protection blocks completely
            if (target.blockFirstHit && (target.damageReduction || 0) >= 999) {
                protectionBlocked = true;
                modifiers.push({ type: 'protection', blocked: true });
            } else if (reduction > 0) {
                modifiers.push({ type: 'damageReduction', value: reduction });
            }
        } else if (reduction > 0) {
            modifiers.push({ type: 'focusIgnoresReduction', ignoredValue: reduction });
            reduction = 0;
        }
        
        // Gremlin support damage reduction
        const targetSupport = gameState.getSupport(target);
        if (targetSupport?.key === 'gremlin' && !gameState.isSupportNegated(targetSupport)) {
            if (gameState.hasAilments(attacker)) {
                // Ailmented attacker deals half damage
                const halfDamage = Math.floor(damage / 2);
                modifiers.push({ type: 'gremlinHalf', originalDamage: damage, reducedDamage: halfDamage });
                damage = halfDamage;
            } else {
                // Non-ailmented attacker deals 1 less damage
                modifiers.push({ type: 'gremlinMinus1', originalDamage: damage });
                damage = Math.max(0, damage - 1);
            }
        }
        
        const finalDamage = protectionBlocked ? 0 : Math.max(0, damage - (hasFocus ? 0 : reduction));
        
        return {
            baseDamage: gameState.getEffectiveAtk(attacker),
            finalDamage,
            protectionBlocked,
            hasFocus,
            modifiers
        };
    }
    
    /**
     * Resolve an attack - the main combat function
     * Returns a combat result without modifying state directly (intent-based)
     * @param {Object} attacker - Attacking cryptid
     * @param {string} targetOwner - Target's owner
     * @param {number} targetCol - Target column
     * @param {number} targetRow - Target row
     * @returns {Object} Combat result with all effects
     */
    function resolveAttack(attacker, targetOwner, targetCol, targetRow) {
        if (!gameState) {
            return { success: false, error: 'NO_GAME_STATE' };
        }
        
        const target = gameState.getFieldCryptid(targetOwner, targetCol, targetRow);
        
        // Validate
        const validation = validateAttack(attacker, target);
        if (!validation.valid) {
            return { success: false, error: validation.reason };
        }
        
        const result = {
            success: true,
            attacker: {
                id: attacker.id,
                name: attacker.name,
                owner: attacker.owner,
                col: attacker.col,
                row: attacker.row
            },
            target: {
                id: target.id,
                name: target.name,
                owner: target.owner,
                col: target.col,
                row: target.row
            },
            damage: 0,
            effects: [],
            deaths: [],
            stateChanges: []
        };
        
        // Calculate damage
        const damageCalc = calculateDamage(attacker, target);
        result.damage = damageCalc.finalDamage;
        result.damageCalculation = damageCalc;
        
        // Protection blocked
        if (damageCalc.protectionBlocked) {
            result.effects.push({
                type: 'protectionBlock',
                target: result.target
            });
            
            // Consume protection charge
            result.stateChanges.push({
                type: 'modifyCryptid',
                target: result.target,
                changes: {
                    protectionCharges: Math.max(0, (target.protectionCharges || 1) - 1),
                    damageReduction: target.protectionCharges <= 1 ? 0 : target.damageReduction,
                    blockFirstHit: target.protectionCharges <= 1 ? false : target.blockFirstHit
                }
            });
        }
        
        // Apply damage
        if (result.damage > 0) {
            const hpBefore = target.currentHp;
            const hpAfter = hpBefore - result.damage;
            
            result.stateChanges.push({
                type: 'modifyCryptid',
                target: result.target,
                changes: { currentHp: hpAfter }
            });
            
            result.effects.push({
                type: 'damage',
                target: result.target,
                amount: result.damage,
                hpBefore,
                hpAfter
            });
            
            // Track damage stats
            if (attacker.owner === 'player') {
                result.stateChanges.push({
                    type: 'incrementStat',
                    stat: 'damageDealt',
                    amount: result.damage
                });
            } else {
                result.stateChanges.push({
                    type: 'incrementStat',
                    stat: 'damageTaken',
                    amount: result.damage
                });
            }
            
            // Ailment application from attacker abilities
            if (attacker.attacksApplyBurn) {
                result.effects.push({ type: 'applyAilment', target: result.target, ailment: 'burn', stacks: 3 });
            }
            if (attacker.attacksApplyBleed) {
                result.effects.push({ type: 'applyAilment', target: result.target, ailment: 'bleed', stacks: 3 });
            }
            if (attacker.attacksApplyParalyze) {
                result.effects.push({ type: 'applyAilment', target: result.target, ailment: 'paralyze', stacks: 1 });
            }
            if (attacker.attacksApplyCalamity) {
                result.effects.push({ type: 'applyAilment', target: result.target, ailment: 'calamity', stacks: attacker.attacksApplyCalamity });
            }
            if (attacker.attacksApplyCurse) {
                result.effects.push({ type: 'applyAilment', target: result.target, ailment: 'curse', stacks: attacker.attacksApplyCurse });
            }
            
            // Lifesteal
            if (attacker.hasLifesteal) {
                const maxHp = attacker.maxHp || attacker.hp;
                const healAmount = Math.min(result.damage, maxHp - attacker.currentHp);
                if (healAmount > 0) {
                    result.effects.push({
                        type: 'lifesteal',
                        attacker: result.attacker,
                        amount: healAmount
                    });
                    result.stateChanges.push({
                        type: 'modifyCryptid',
                        target: result.attacker,
                        changes: { currentHp: attacker.currentHp + healAmount }
                    });
                }
            }
            
            // Check target death
            if (gameState.getEffectiveHp(target) - result.damage <= 0) {
                result.deaths.push({
                    cryptid: result.target,
                    killedBy: 'attack',
                    killerOwner: attacker.owner
                });
                
                // Overkill damage for Destroyer
                if (attacker.hasDestroyer) {
                    const overkill = result.damage - (target.currentHp ?? target.hp);
                    if (overkill > 0) {
                        const supportBehind = gameState.getSupport(target);
                        if (supportBehind) {
                            result.effects.push({
                                type: 'destroyerDamage',
                                attacker: result.attacker,
                                target: {
                                    id: supportBehind.id,
                                    name: supportBehind.name,
                                    owner: supportBehind.owner,
                                    col: supportBehind.col,
                                    row: supportBehind.row
                                },
                                damage: overkill
                            });
                        }
                    }
                }
            }
        }
        
        // Cleave damage
        if (attacker.hasCleave && result.damage > 0) {
            const combatCol = gameState.getCombatCol(targetOwner);
            const supportCol = gameState.getSupportCol(targetOwner);
            let cleaveTarget = null;
            
            if (targetCol === combatCol) {
                cleaveTarget = gameState.getFieldCryptid(targetOwner, supportCol, targetRow);
            } else if (targetCol === supportCol) {
                cleaveTarget = gameState.getFieldCryptid(targetOwner, combatCol, targetRow);
            }
            
            if (cleaveTarget) {
                result.effects.push({
                    type: 'cleave',
                    attacker: result.attacker,
                    target: {
                        id: cleaveTarget.id,
                        name: cleaveTarget.name,
                        owner: cleaveTarget.owner,
                        col: cleaveTarget.col,
                        row: cleaveTarget.row
                    },
                    damage: result.damage
                });
                
                // Check cleave death
                if (cleaveTarget.currentHp - result.damage <= 0) {
                    result.deaths.push({
                        cryptid: {
                            id: cleaveTarget.id,
                            name: cleaveTarget.name,
                            owner: cleaveTarget.owner,
                            col: cleaveTarget.col,
                            row: cleaveTarget.row
                        },
                        killedBy: 'cleave',
                        killerOwner: attacker.owner
                    });
                }
            }
        }
        
        // Attacker state changes (tap/exhaustion)
        const support = gameState.getSupport(attacker);
        const hasFocus = attacker.hasFocus || (support?.grantsFocus && !gameState.isSupportNegated(support));
        const preventTap = support?.preventCombatantTap || attacker.noTapOnAttack;
        
        if (attacker.canAttackAgain) {
            result.stateChanges.push({
                type: 'modifyCryptid',
                target: result.attacker,
                changes: { canAttackAgain: false }
            });
        } else if (hasFocus || preventTap) {
            result.stateChanges.push({
                type: 'modifyCryptid',
                target: result.attacker,
                changes: { canAttack: false, attackedThisTurn: true }
            });
        } else {
            result.stateChanges.push({
                type: 'modifyCryptid',
                target: result.attacker,
                changes: { tapped: true, canAttack: false, attackedThisTurn: true }
            });
        }
        
        // Track attacker for pyre cards
        result.stateChanges.push({
            type: 'trackAttacker',
            owner: attacker.owner,
            attackerId: attacker.id
        });
        
        log('Attack resolved:', result);
        return result;
    }
    
    /**
     * Apply a combat result to the game state
     * @param {Object} combatResult - Result from resolveAttack
     * @returns {Object} Applied result with actual deaths processed
     */
    function applyCombatResult(combatResult) {
        if (!gameState || !combatResult.success) {
            return combatResult;
        }
        
        const appliedResult = { ...combatResult, appliedDeaths: [] };
        
        // Apply state changes
        for (const change of combatResult.stateChanges) {
            switch (change.type) {
                case 'modifyCryptid':
                    const cryptid = gameState.getFieldCryptid(
                        change.target.owner,
                        change.target.col,
                        change.target.row
                    );
                    if (cryptid) {
                        Object.assign(cryptid, change.changes);
                    }
                    break;
                    
                case 'incrementStat':
                    if (gameState.state.matchStats) {
                        gameState.state.matchStats[change.stat] = 
                            (gameState.state.matchStats[change.stat] || 0) + change.amount;
                    }
                    break;
                    
                case 'trackAttacker':
                    if (gameState.state.attackersThisTurn?.[change.owner]) {
                        gameState.state.attackersThisTurn[change.owner].push(change.attackerId);
                    }
                    break;
            }
        }
        
        // Apply effects
        for (const effect of combatResult.effects) {
            switch (effect.type) {
                case 'applyAilment':
                    const ailmentTarget = gameState.getFieldCryptid(
                        effect.target.owner,
                        effect.target.col,
                        effect.target.row
                    );
                    if (ailmentTarget) {
                        gameState.applyAilment(ailmentTarget, effect.ailment, effect.stacks);
                    }
                    break;
                    
                case 'cleave':
                    const cleaveTarget = gameState.getFieldCryptid(
                        effect.target.owner,
                        effect.target.col,
                        effect.target.row
                    );
                    if (cleaveTarget) {
                        cleaveTarget.currentHp -= effect.damage;
                    }
                    break;
                    
                case 'destroyerDamage':
                    const destroyerTarget = gameState.getFieldCryptid(
                        effect.target.owner,
                        effect.target.col,
                        effect.target.row
                    );
                    if (destroyerTarget) {
                        destroyerTarget.currentHp -= effect.damage;
                        // Check destroyer kill
                        if (destroyerTarget.currentHp <= 0) {
                            combatResult.deaths.push({
                                cryptid: effect.target,
                                killedBy: 'destroyer',
                                killerOwner: combatResult.attacker.owner
                            });
                        }
                    }
                    break;
            }
        }
        
        // Process deaths
        for (const death of combatResult.deaths) {
            const cryptid = gameState.getFieldCryptid(
                death.cryptid.owner,
                death.cryptid.col,
                death.cryptid.row
            );
            if (cryptid && !cryptid._alreadyKilled) {
                const deathResult = gameState.killCryptid(cryptid, death.killerOwner, {
                    killedBy: death.killedBy
                });
                if (deathResult) {
                    appliedResult.appliedDeaths.push(deathResult);
                }
            }
        }
        
        return appliedResult;
    }
    
    // ==================== PUBLIC API ====================
    
    return {
        setGameState,
        validateAttack,
        calculateDamage,
        resolveAttack,
        applyCombatResult
    };
}

// ==================== EXPORTS ====================

// CommonJS export (for Node.js / Cloudflare Worker)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        createCombatEngine
    };
}

// Browser global export
if (typeof window !== 'undefined') {
    window.SharedCombatEngine = {
        createCombatEngine
    };
}

})(); // End IIFE
