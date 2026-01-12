/**
 * Cryptid Fates - AI Module
 * Enemy AI logic for the Warden
 * 
 * Dependencies (from system.js via window):
 * - window.game
 * - window.TIMING
 * - window.renderAll
 * - window.renderSprites
 * - window.showMessage
 * - window.updateButtons
 * - window.animateSupportPromotion
 * - window.checkCascadingDeaths
 * - window.GameEvents
 */

// ==================== ENEMY AI ====================
window.runEnemyAI = function() {
    const game = window.game;
    const TIMING = window.TIMING;
    
    if (game.gameOver) return;
    
    aiPlayCards(() => {
        setTimeout(() => {
            if (game.gameOver) return;
            game.phase = 'combat';
            window.renderAll();
            
            setTimeout(() => {
                aiCombat(() => {
                    if (game.gameOver) return;
                    
                    setTimeout(() => {
                        if (game.gameOver) return;
                        game.phase = 'conjure2';
                        window.renderAll();
                        
                        aiPlayCards(() => {
                            setTimeout(() => {
                                if (game.gameOver) return;
                                
                                // Animate turn-end effects for enemy
                                if (window.animateTurnEndEffects) {
                                    window.animateTurnEndEffects(() => {
                                        game.endTurn();
                                        if (game.gameOver) return;
                                        
                                        // Animate turn-start effects for player
                                        if (window.animateTurnStartEffects) {
                                            window.animateTurnStartEffects('player', () => {
                                                // CRITICAL: Reset isAnimating so player can interact with their hand
                                                if (typeof window.setAnimating === 'function') {
                                                    window.setAnimating(false);
                                                }
                                                window.showMessage("Your turn begins...", TIMING.messageDisplay);
                                                window.renderAll();
                                                window.updateButtons();
                                            });
                                        } else {
                                            // CRITICAL: Reset isAnimating so player can interact with their hand
                                            if (typeof window.setAnimating === 'function') {
                                                window.setAnimating(false);
                                            }
                                            window.showMessage("Your turn begins...", TIMING.messageDisplay);
                                            window.renderAll();
                                            window.updateButtons();
                                        }
                                    });
                                } else {
                                    game.endTurn();
                                    // CRITICAL: Reset isAnimating so player can interact with their hand
                                    if (typeof window.setAnimating === 'function') {
                                        window.setAnimating(false);
                                    }
                                    if (!game.gameOver) window.showMessage("Your turn begins...", TIMING.messageDisplay);
                                    window.renderAll();
                                    window.updateButtons();
                                }
                            }, TIMING.aiPhaseDelay);
                        });
                    }, TIMING.aiPhaseDelay);
                });
            }, 300);
        }, TIMING.aiPhaseDelay);
    });
};

function aiPlayCards(onComplete) {
    const game = window.game;
    const TIMING = window.TIMING;
    
    // Build list of actions to take
    const actions = [];
    const playable = game.enemyHand.filter(c => c.cost <= game.enemyPyre).sort((a, b) => b.cost - a.cost);
    
    // Simulate pyre to avoid overspending
    let simulatedPyre = game.enemyPyre;
    // Track slots we've planned to use
    const plannedSlots = new Set();
    
    for (const card of playable) {
        if (simulatedPyre < card.cost) continue;
        
        if (card.type === 'cryptid') {
            if (card.evolvesFrom) {
                const targets = game.getValidEvolutionTargets(card, 'enemy');
                if (targets.length > 0) {
                    actions.push({ type: 'evolve', card, target: targets[0] });
                    continue;
                }
            }
            
            const slots = game.getValidSummonSlots('enemy').filter(s => !plannedSlots.has(`${s.col}-${s.row}`));
            if (slots.length > 0) {
                const slot = slots[Math.floor(Math.random() * slots.length)];
                plannedSlots.add(`${slot.col}-${slot.row}`);
                actions.push({ type: 'summon', card, slot });
                simulatedPyre -= card.cost;
            }
        } else if (card.type === 'burst') {
            const targets = game.getValidBurstTargets(card, 'enemy');
            let target;
            
            if (card.key === 'pyreBolt' || card.key === 'shatter') {
                target = targets.filter(t => t.owner === 'player')
                               .sort((a, b) => game.getEffectiveHp(a.cryptid) - game.getEffectiveHp(b.cryptid))[0];
            } else if (card.key === 'heal') {
                target = targets.filter(t => t.owner === 'enemy' && t.cryptid.currentHp < t.cryptid.maxHp)
                               .sort((a, b) => a.cryptid.currentHp - b.cryptid.currentHp)[0];
            } else if (card.key === 'empower' || card.key === 'protect') {
                target = targets.filter(t => t.owner === 'enemy')[0];
            }
            
            if (target) {
                actions.push({ type: 'burst', card, target });
                simulatedPyre -= card.cost;
            }
        }
    }
    
    // Add kindling if appropriate - check slots excluding planned ones
    if (!game.enemyKindlingPlayedThisTurn && game.enemyKindling.length > 0) {
        const slots = game.getValidSummonSlots('enemy').filter(s => !plannedSlots.has(`${s.col}-${s.row}`));
        const shouldPlayKindling = slots.length > 0 && (
            game.isFieldEmpty('enemy') ||
            (actions.length === 0 && game.enemyPyre < 2) ||
            slots.length >= 4
        );
        
        if (shouldPlayKindling) {
            const slot = slots[Math.floor(Math.random() * slots.length)];
            actions.push({ type: 'kindling', slot });
        }
    }
    
    // Add pyre burn if appropriate
    if (!game.enemyPyreBurnUsed && game.enemyDeaths >= 3 && game.enemyPyre <= 2) {
        actions.push({ type: 'pyreBurn' });
    }
    
    // Process actions sequentially with pacing
    function processNextAction(index) {
        if (index >= actions.length) {
            window.renderAll();
            onComplete?.();
            return;
        }
        
        const action = actions[index];
        
        if (action.type === 'summon') {
            const { card } = action;
            // Re-check for valid slots since previous actions may have filled them
            const currentSlots = game.getValidSummonSlots('enemy');
            if (currentSlots.length === 0) {
                // No valid slot available anymore, skip
                setTimeout(() => processNextAction(index + 1), 100);
                return;
            }
            const slot = currentSlots[Math.floor(Math.random() * currentSlots.length)];
            
            if (game.summonCryptid('enemy', slot.col, slot.row, card)) {
                game.enemyPyre -= card.cost;
                const idx = game.enemyHand.findIndex(c => c.id === card.id);
                if (idx > -1) game.enemyHand.splice(idx, 1);
                window.renderAll();
            }
            setTimeout(() => processNextAction(index + 1), TIMING.summonAnim + 200);
            
        } else if (action.type === 'evolve') {
            const { card, target } = action;
            game.evolveCryptid(target.cryptid, card);
            const idx = game.enemyHand.findIndex(c => c.id === card.id);
            if (idx > -1) game.enemyHand.splice(idx, 1);
            window.renderAll();
            setTimeout(() => processNextAction(index + 1), TIMING.evolveAnim + 200);
            
        } else if (action.type === 'burst') {
            const { card, target } = action;
            
            // 1. Show spell message
            window.showMessage(`✧ ${card.name} ✧`, TIMING.messageDisplay);
            
            // 2. Apply spell target visual effect
            const targetSprite = document.querySelector(
                `.cryptid-sprite[data-owner="${target.owner}"][data-col="${target.col}"][data-row="${target.row}"]`
            );
            if (targetSprite) {
                targetSprite.classList.add('spell-target');
                setTimeout(() => targetSprite.classList.remove('spell-target'), TIMING.spellEffect);
            }
            
            // 3. Execute effect after visual delay
            setTimeout(() => {
                card.effect(game, 'enemy', target.cryptid);
                game.enemyPyre -= card.cost;
                const idx = game.enemyHand.findIndex(c => c.id === card.id);
                if (idx > -1) game.enemyHand.splice(idx, 1);
                
                window.GameEvents.emit('onSpellCast', {
                    card,
                    caster: 'enemy',
                    target: target.cryptid,
                    targetOwner: target.owner
                });
                
                // Check for death
                const effectiveHpAfter = game.getEffectiveHp(target.cryptid);
                if (effectiveHpAfter <= 0) {
                    if (targetSprite) targetSprite.classList.add('dying-left');
                    
                    setTimeout(() => game.killCryptid(target.cryptid, 'enemy'), 100);
                    
                    setTimeout(() => {
                        const promoted = game.promoteSupport(target.owner, target.row);
                        if (promoted) window.animateSupportPromotion(target.owner, target.row);
                        setTimeout(() => {
                            window.checkCascadingDeaths(() => {
                                window.renderAll();
                                processNextAction(index + 1);
                            });
                        }, TIMING.promoteAnim + 100);
                    }, TIMING.deathAnim);
                } else {
                    window.renderAll();
                    setTimeout(() => processNextAction(index + 1), 400);
                }
            }, TIMING.spellEffect);
            return; // Don't continue - handled in setTimeout
            
        } else if (action.type === 'kindling') {
            // Re-check for valid slots since previous actions may have filled them
            const currentSlots = game.getValidSummonSlots('enemy');
            if (currentSlots.length === 0 || game.enemyKindling.length === 0) {
                // No valid slot available anymore, skip
                setTimeout(() => processNextAction(index + 1), 100);
                return;
            }
            
            const slot = currentSlots[Math.floor(Math.random() * currentSlots.length)];
            const kindlingIdx = Math.floor(Math.random() * game.enemyKindling.length);
            const kindlingCard = game.enemyKindling.splice(kindlingIdx, 1)[0];
            
            if (kindlingCard) {
                game.summonKindling('enemy', slot.col, slot.row, kindlingCard);
                game.enemyKindlingPlayedThisTurn = true;
                window.renderAll();
            }
            setTimeout(() => processNextAction(index + 1), TIMING.summonAnim + 200);
            
        } else if (action.type === 'pyreBurn') {
            window.showMessage(`🜂 Warden burns pyre! 🜂`, TIMING.messageDisplay);
            setTimeout(() => {
                game.pyreBurn('enemy');
                window.renderAll();
                setTimeout(() => processNextAction(index + 1), 600);
            }, 400);
            return;
        }
    }
    
    // Start processing if there are actions
    if (actions.length > 0) {
        processNextAction(0);
    } else {
        window.renderAll();
        onComplete?.();
    }
}


function aiCombat(onComplete) {
    const game = window.game;
    const TIMING = window.TIMING;
    
    const attackers = [];
    const combatCol = game.getCombatCol('enemy');
    
    for (let r = 0; r < 3; r++) {
        const attacker = game.enemyField[combatCol][r];
        if (attacker && !attacker.tapped && attacker.canAttack) {
            const targets = game.getValidAttackTargets(attacker);
            if (targets.length > 0) {
                targets.sort((a, b) => {
                    if (a.isEmptyTarget && !b.isEmptyTarget) return 1;
                    if (!a.isEmptyTarget && b.isEmptyTarget) return -1;
                    if (a.cryptid && b.cryptid) {
                        const damage = game.calculateAttackDamage(attacker);
                        const aEffectiveHp = game.getEffectiveHp(a.cryptid);
                        const bEffectiveHp = game.getEffectiveHp(b.cryptid);
                        const aKill = aEffectiveHp <= damage;
                        const bKill = bEffectiveHp <= damage;
                        if (aKill && !bKill) return -1;
                        if (bKill && !aKill) return 1;
                        return aEffectiveHp - bEffectiveHp;
                    }
                    return 0;
                });
                attackers.push({ attacker, row: r, target: targets[0] });
            }
        }
    }
    
    function processNextAttack(index) {
        if (index >= attackers.length) {
            onComplete?.();
            return;
        }
        
        const { attacker, row, target } = attackers[index];
        
        if (!attacker || attacker.tapped || !attacker.canAttack) {
            processNextAttack(index + 1);
            return;
        }
        
        // ALWAYS check current state of target position - targets may have changed since planning
        const playerCombatCol = game.getCombatCol('player');
        const currentTarget = game.getFieldCryptid('player', playerCombatCol, target.row);
        
        // Update target info based on current state
        if (currentTarget) {
            // There's a cryptid here now - attack it normally
            target.cryptid = currentTarget;
            target.isEmptyTarget = false;
            target.col = playerCombatCol;
            target.owner = 'player';
        } else {
            // Position is empty - check if we should skip to another target or force summon
            // ONLY force kindling summon if the ENTIRE field is empty
            if (!game.isFieldEmpty('player')) {
                // Player still has cryptids elsewhere - skip this attack and find another target
                processNextAttack(index + 1);
                return;
            }
            target.cryptid = null;
            target.isEmptyTarget = true;
        }
        
        // Now determine if we need auto-summon based on CURRENT state
        // Only auto-summon if field is completely empty
        let needsAutoSummon = target.isEmptyTarget && game.isFieldEmpty('player') && game.playerKindling.length > 0;
        
        // Apply pre-attack buffs (like Insatiable Hunger) before attack animation
        const applyPreAttackBuffs = (callback) => {
            if (attacker.hasInsatiableHunger) {
                attacker.currentAtk = (attacker.currentAtk || attacker.atk) + 1;
                GameEvents.emit('onInsatiableHunger', { attacker, newAtk: attacker.currentAtk });
                window.showMessage(`${attacker.name}: +1 ATK!`, 600);
                window.renderAll();
                setTimeout(callback, 500);
            } else {
                callback();
            }
        };
        
        applyPreAttackBuffs(() => {
            if (needsAutoSummon) {
                // Auto-summon case: summon first, then animate attack
                const kindlingCard = game.popRandomKindling('player');
                game.summonKindling('player', playerCombatCol, target.row, kindlingCard);
                
                window.showMessage(`Forced Summoning!`, TIMING.messageDisplay);
                window.renderSprites();
                
                // After summon animation completes, render fresh sprites then play attack animation
                setTimeout(() => {
                    window.renderSprites(); // Ensure sprites are fresh before attack animation
                    
                    setTimeout(() => {
                        const attackerSprite = document.querySelector(
                            `.cryptid-sprite[data-owner="enemy"][data-col="${combatCol}"][data-row="${row}"]`
                        );
                        // Use new attack animation system - pass as onImpact (4th arg) for proper timing
                        // Pass target.row (6th arg) so the correct player cryptid animates the hit reaction
                        if (typeof window.playAttackAnimation === 'function') {
                            window.playAttackAnimation(attackerSprite, 'enemy', null, () => {
                                aiPerformAttackOnTarget(attacker, playerCombatCol, target.row, index, processNextAttack);
                            }, 3, target.row);
                        } else {
                            // Fallback to old animation
                            if (attackerSprite) {
                                attackerSprite.classList.add('attacking-left');
                                setTimeout(() => attackerSprite.classList.remove('attacking-left'), TIMING.attackAnim);
                            }
                            setTimeout(() => {
                                aiPerformAttackOnTarget(attacker, playerCombatCol, target.row, index, processNextAttack);
                            }, TIMING.attackDelay);
                        }
                    }, 50);
                }, TIMING.summonAnim + 100);
            } else {
                // Normal case: animate attack then perform
                const attackerSprite = document.querySelector(
                    `.cryptid-sprite[data-owner="enemy"][data-col="${combatCol}"][data-row="${row}"]`
                );
                // Use new attack animation system - pass as onImpact (4th arg) for proper timing
                // Pass target.row (6th arg) so the correct player cryptid animates the hit reaction
                if (typeof window.playAttackAnimation === 'function') {
                    window.playAttackAnimation(attackerSprite, 'enemy', null, () => {
                        aiPerformAttackOnTarget(attacker, target.col, target.row, index, processNextAttack);
                    }, 3, target.row);
                } else {
                    // Fallback to old animation
                    if (attackerSprite) {
                        attackerSprite.classList.add('attacking-left');
                        setTimeout(() => attackerSprite.classList.remove('attacking-left'), TIMING.attackAnim);
                    }
                    setTimeout(() => {
                        aiPerformAttackOnTarget(attacker, target.col, target.row, index, processNextAttack);
                    }, TIMING.attackDelay);
                }
            }
        });
    }
    
    function aiPerformAttackOnTarget(attacker, targetCol, targetRow, index, nextCallback) {
        const result = game.attack(attacker, 'player', targetCol, targetRow);
        
        const targetSprite = document.querySelector(
            `.cryptid-sprite[data-owner="player"][data-col="${targetCol}"][data-row="${targetRow}"]`
        );
        
        const attackerSprite = document.querySelector(
            `.cryptid-sprite[data-owner="enemy"][data-col="${attacker.col}"][data-row="${attacker.row}"]`
        );
        
        // Get impact position for combat effects
        const battlefield = document.getElementById('battlefield-area');
        let impactX = 0, impactY = 0;
        if (targetSprite && battlefield) {
            const targetRect = targetSprite.getBoundingClientRect();
            const battlefieldRect = battlefield.getBoundingClientRect();
            impactX = targetRect.left + targetRect.width/2 - battlefieldRect.left;
            impactY = targetRect.top + targetRect.height/2 - battlefieldRect.top;
        }
        
        // Track if using dramatic death
        let usingDramaticDeath = false;
        const targetRarity = result.target?.rarity || 'common';
        
        // IF KILLED: Start dramatic death IMMEDIATELY at moment of impact!
        // This MUST happen before health bar updates or any other visual changes
        if (result.killed && targetSprite && !result.negated && !result.protectionBlocked) {
            if (window.CombatEffects?.playDramaticDeath) {
                usingDramaticDeath = true;
                console.log('[AI Attack] Starting dramatic death zoom at impact moment');
                window.CombatEffects.playDramaticDeath(targetSprite, 'player', targetRarity);
            } else {
                targetSprite.classList.add('dying-left');
            }
        }
        
        // Update health bar AFTER death zoom starts (so zoom begins on impact, not after HP drops)
        // For kills, we skip the health bar update since the sprite is being replaced by death animation
        if (result.target && !result.killed && window.updateSpriteHealthBar) {
            window.updateSpriteHealthBar('player', targetCol, targetRow);
        }
        
        // Apply combat effects for successful hit (plays in parallel with death zoom)
        if (!result.negated && !result.protectionBlocked && window.CombatEffects) {
            const damage = result.damage || 0;
            const isCrit = damage >= 5;
            
            // Screen shake only if NOT using dramatic death
            if (!usingDramaticDeath) {
                CombatEffects.heavyImpact(Math.max(damage, 1));
            }
            
            // Impact flash and particles
            CombatEffects.createImpactFlash(impactX, impactY, 80 + damage * 10);
            CombatEffects.createSparks(impactX, impactY, 10 + damage * 2);
            CombatEffects.createImpactParticles(impactX, impactY, result.killed ? '#ff2222' : '#ff6666', 8 + damage);
            
            // Show damage number (skip for dramatic deaths - the zoom is more impactful)
            if (result.target && !usingDramaticDeath) {
                CombatEffects.showDamageNumber(result.target, damage, isCrit);
            }
        }
        
        // Add hit recoil animation (only if not killed)
        if (!result.negated && !result.protectionBlocked && !result.killed && targetSprite) {
            targetSprite.classList.add('hit-recoil');
            setTimeout(() => targetSprite.classList.remove('hit-recoil'), 250);
        }
        
        // Helper to wait for any pending trap processing with timeout safety
        function waitForTraps(callback, maxWait = 10000) {
            const startTime = Date.now();
            function check() {
                if (Date.now() - startTime > maxWait) {
                    console.warn('Trap wait timeout, forcing continue...');
                    window.processingTraps = false;
                    window.pendingTraps = [];
                    callback();
                    return;
                }
                if (window.processingTraps || (window.pendingTraps && window.pendingTraps.length > 0)) {
                    setTimeout(check, 100);
                } else {
                    callback();
                }
            }
            check();
        }
        
        // Helper to wait for ability animations
        function waitForAbilityAnimations(callback, maxWait = 10000) {
            const startTime = Date.now();
            function check() {
                if (Date.now() - startTime > maxWait) {
                    console.warn('Ability animation timeout, forcing continue...');
                    window.processingAbilityAnimations = false;
                    window.abilityAnimationQueue = [];
                    callback();
                    return;
                }
                if (window.processingAbilityAnimations || (window.abilityAnimationQueue && window.abilityAnimationQueue.length > 0)) {
                    setTimeout(check, 100);
                } else {
                    callback();
                }
            }
            check();
        }
        
        // Handle negated attacks (e.g., Hellhound Pup protection, Primal Wendigo counter-kill)
        if (result.negated) {
            // Get attacker rarity for death timing
            const attackerRarity = attacker?.rarity || 'common';
            
            // Only show death animation if attacker was actually killed by counter-attack
            if (result.attackerKilled && attackerSprite) {
                // Use dramatic death for counter-kills too
                if (window.CombatEffects?.playDramaticDeath) {
                    window.CombatEffects.playDramaticDeath(attackerSprite, 'enemy', attackerRarity);
                } else {
                    attackerSprite.classList.add('dying-right');
                }
            }
            
            // Use actual death duration based on rarity
            const attackerDeathDuration = result.attackerKilled 
                ? (window.CombatEffects?.getDramaticDeathDuration?.(attackerRarity) || TIMING.deathAnim)
                : 300;
            
            // Wait for ability animations first
            waitForAbilityAnimations(() => {
                setTimeout(() => {
                    // Pre-mark pending promotions in activePromotions BEFORE renderAll
                    if (window.pendingPromotions?.length > 0) {
                        if (!window.activePromotions) window.activePromotions = new Set();
                        window.pendingPromotions.forEach(p => {
                            window.activePromotions.add(`${p.owner}-${p.row}`);
                        });
                    }
                    window.renderAll();
                    if (result.attackerKilled) {
                        window.processPendingPromotions(() => {
                            waitForTraps(() => {
                                window.checkCascadingDeaths(() => {
                                    window.renderAll();
                                    waitForTraps(() => nextCallback(index + 1));
                                });
                            });
                        });
                    } else {
                        // Attack was just blocked, continue normally
                        waitForTraps(() => nextCallback(index + 1));
                    }
                }, attackerDeathDuration);
            });
            return;
        }
        
        if (result.killed) {
            // Death animation already started above (playDramaticDeath)
            // Use actual death duration based on rarity (dramatic deaths take longer for higher rarities)
            const deathDuration = window.CombatEffects?.getDramaticDeathDuration?.(targetRarity) || TIMING.deathAnim;
            
            // Wait for ability animations first
            waitForAbilityAnimations(() => {
                setTimeout(() => {
                    // Pre-mark pending promotions in activePromotions BEFORE renderAll
                    if (window.pendingPromotions?.length > 0) {
                        if (!window.activePromotions) window.activePromotions = new Set();
                        window.pendingPromotions.forEach(p => {
                            window.activePromotions.add(`${p.owner}-${p.row}`);
                        });
                    }
                    window.renderAll();
                    window.processPendingPromotions(() => {
                        waitForTraps(() => {
                            window.checkCascadingDeaths(() => {
                                window.renderAll();
                                waitForTraps(() => nextCallback(index + 1));
                            });
                        });
                    });
                }, deathDuration);
            });
        } else {
            if (targetSprite) {
                targetSprite.classList.add('taking-damage');
                setTimeout(() => targetSprite.classList.remove('taking-damage'), TIMING.damageAnim);
            }
            
            // Wait for ability animations and traps before continuing
            waitForAbilityAnimations(() => {
                waitForTraps(() => {
                    setTimeout(() => {
                        window.renderAll();
                        nextCallback(index + 1);
                    }, TIMING.damageAnim + 200);
                });
            });
        }
    }
    
    if (attackers.length > 0) {
        processNextAttack(0);
    } else {
        onComplete?.();
    }
}

console.log('AI module loaded');