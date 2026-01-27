/**
 * Cryptid Fates - Effect Animations System
 * 
 * Maps declarative effects to visual animations.
 * When the EffectEngine executes an action, this system plays the corresponding animation.
 * 
 * This creates a clean separation:
 *   - effect-schema.js: What effects exist (data)
 *   - effect-engine.js: How effects are processed (logic)  
 *   - effect-animations.js: How effects look (visuals)
 */

window.EffectAnimations = {
    
    // ==================== ANIMATION QUEUE ====================
    // Ensures animations play in sequence, not all at once
    
    queue: [],
    isPlaying: false,
    
    /**
     * Add an animation to the queue
     */
    enqueue(animationFn, duration = 500) {
        this.queue.push({ fn: animationFn, duration });
        if (!this.isPlaying) {
            this.playNext();
        }
    },
    
    /**
     * Play the next animation in queue
     */
    playNext() {
        if (this.queue.length === 0) {
            this.isPlaying = false;
            return;
        }
        
        this.isPlaying = true;
        const { fn, duration } = this.queue.shift();
        
        try {
            fn();
        } catch (e) {
            console.error('[EffectAnimations] Animation error:', e);
        }
        
        setTimeout(() => this.playNext(), duration);
    },
    
    /**
     * Clear all pending animations
     */
    clearQueue() {
        this.queue = [];
        this.isPlaying = false;
    },
    
    // ==================== SPRITE HELPERS ====================
    
    /**
     * Get the sprite element for a cryptid
     */
    getSprite(cryptid) {
        if (!cryptid) return null;
        return document.querySelector(
            `.cryptid-sprite[data-owner="${cryptid.owner}"][data-col="${cryptid.col}"][data-row="${cryptid.row}"]`
        );
    },
    
    /**
     * Get sprites for multiple cryptids
     */
    getSprites(cryptids) {
        return cryptids.map(c => this.getSprite(c)).filter(s => s !== null);
    },
    
    // ==================== ACTION ANIMATIONS ====================
    // Each action type has a corresponding animation
    
    /**
     * Play animation for dealing damage
     */
    dealDamage(source, targets, amounts) {
        // amounts can be a single number or array matching targets
        const amountArray = Array.isArray(amounts) ? amounts : targets.map(() => amounts);
        
        this.enqueue(() => {
            targets.forEach((target, i) => {
                const sprite = this.getSprite(target);
                const amount = amountArray[i] || amountArray[0];
                
                if (sprite) {
                    // Hit recoil animation (use new smooth effect)
                    if (window.playHitEffectOnSprite) {
                        window.playHitEffectOnSprite(sprite, target, { intensity: 'normal' });
                    }
                    
                    // Floating damage number
                    if (window.CombatEffects?.showDamageNumber) {
                        CombatEffects.showDamageNumber(target, amount, false);
                    }
                }
            });
        }, 400);
    },
    
    /**
     * Play animation for healing
     */
    heal(source, targets, amounts) {
        const amountArray = Array.isArray(amounts) ? amounts : targets.map(() => amounts);
        
        this.enqueue(() => {
            targets.forEach((target, i) => {
                const sprite = this.getSprite(target);
                const amount = amountArray[i] || amountArray[0];
                
                if (sprite) {
                    sprite.classList.add('healing');
                    setTimeout(() => sprite.classList.remove('healing'), 500);
                    
                    if (window.CombatEffects?.showHealNumber) {
                        CombatEffects.showHealNumber(target, amount);
                    }
                }
            });
        }, 500);
    },
    
    /**
     * Play animation for buffing stats
     */
    buffStats(source, targets, stats) {
        this.enqueue(() => {
            targets.forEach(target => {
                const sprite = this.getSprite(target);
                
                if (sprite) {
                    sprite.classList.add('buffed');
                    setTimeout(() => sprite.classList.remove('buffed'), 600);
                    
                    // Show floating buff text
                    const buffText = [];
                    if (stats.atk) buffText.push(`+${stats.atk} ATK`);
                    if (stats.hp) buffText.push(`+${stats.hp} HP`);
                    
                    if (window.CombatEffects?.showBuffText) {
                        CombatEffects.showBuffText(target, buffText.join(' '));
                    }
                }
            });
        }, 500);
    },
    
    /**
     * Play animation for debuffing stats
     */
    debuffStats(source, targets, stats) {
        this.enqueue(() => {
            targets.forEach(target => {
                const sprite = this.getSprite(target);
                
                if (sprite) {
                    sprite.classList.add('debuffed');
                    setTimeout(() => sprite.classList.remove('debuffed'), 600);
                    
                    const debuffText = [];
                    if (stats.atk) debuffText.push(`-${stats.atk} ATK`);
                    if (stats.hp) debuffText.push(`-${stats.hp} HP`);
                    
                    if (window.CombatEffects?.showDebuffText) {
                        CombatEffects.showDebuffText(target, debuffText.join(' '));
                    }
                }
            });
        }, 500);
    },
    
    /**
     * Play animation for applying burn
     */
    applyBurn(source, targets, stacks) {
        this.enqueue(() => {
            targets.forEach(target => {
                const sprite = this.getSprite(target);
                
                if (sprite) {
                    sprite.classList.add('burning');
                    
                    if (window.CombatEffects?.playBurnEffect) {
                        CombatEffects.playBurnEffect(sprite);
                    }
                }
            });
            
            if (typeof showMessage === 'function') {
                showMessage(`🔥 Burn applied! (${stacks} stacks)`, 800);
            }
        }, 400);
    },
    
    /**
     * Play animation for applying bleed
     */
    applyBleed(source, targets, stacks) {
        this.enqueue(() => {
            targets.forEach(target => {
                const sprite = this.getSprite(target);
                
                if (sprite) {
                    sprite.classList.add('bleeding');
                    
                    if (window.CombatEffects?.playBleedEffect) {
                        CombatEffects.playBleedEffect(sprite);
                    }
                }
            });
            
            if (typeof showMessage === 'function') {
                showMessage(`🩸 Bleed applied! (${stacks} stacks)`, 800);
            }
        }, 400);
    },
    
    /**
     * Play animation for applying paralyze
     */
    applyParalyze(source, targets) {
        this.enqueue(() => {
            targets.forEach(target => {
                const sprite = this.getSprite(target);
                
                if (sprite) {
                    sprite.classList.add('paralyzed');
                    
                    if (window.CombatEffects?.playParalyzeEffect) {
                        CombatEffects.playParalyzeEffect(sprite);
                    }
                }
            });
            
            if (typeof showMessage === 'function') {
                showMessage(`⚡ Paralyzed!`, 800);
            }
        }, 400);
    },
    
    /**
     * Play animation for cleansing ailments
     */
    cleanse(source, targets, stacksCleansed) {
        this.enqueue(() => {
            targets.forEach(target => {
                const sprite = this.getSprite(target);
                
                if (sprite) {
                    sprite.classList.add('cleansed');
                    setTimeout(() => sprite.classList.remove('cleansed'), 600);
                    
                    if (window.CombatEffects?.playCleanseEffect) {
                        CombatEffects.playCleanseEffect(sprite);
                    }
                }
            });
            
            if (stacksCleansed > 0 && typeof showMessage === 'function') {
                showMessage(`✨ Cleansed ${stacksCleansed} ailment stacks!`, 800);
            }
        }, 500);
    },
    
    /**
     * Play animation for death
     */
    death(cryptid, killer) {
        const sprite = this.getSprite(cryptid);
        
        if (sprite && window.CombatEffects?.playDramaticDeath) {
            this.enqueue(() => {
                CombatEffects.playDramaticDeath(sprite, cryptid.owner, cryptid.rarity);
            }, 800);
        } else if (sprite) {
            this.enqueue(() => {
                sprite.classList.add('dying');
                setTimeout(() => sprite.remove(), 500);
            }, 600);
        }
    },
    
    /**
     * Play animation for summoning
     */
    summon(cryptid) {
        this.enqueue(() => {
            const sprite = this.getSprite(cryptid);
            
            if (sprite) {
                sprite.classList.add('summoning');
                setTimeout(() => sprite.classList.remove('summoning'), 500);
            }
            
            if (window.CombatEffects?.playSummonEffect) {
                CombatEffects.playSummonEffect(cryptid);
            }
        }, 500);
    },
    
    /**
     * Play animation for promotion (support -> combat)
     */
    promotion(cryptid, fromCol, toCol) {
        this.enqueue(() => {
            if (typeof animateSupportPromotion === 'function') {
                animateSupportPromotion(cryptid.owner, cryptid.row);
            }
        }, 600);
    },
    
    /**
     * Play animation for gaining pyre
     */
    gainPyre(owner, amount) {
        this.enqueue(() => {
            if (window.CombatEffects?.playPyreBurn) {
                CombatEffects.playPyreBurn(null, amount);
            }
            
            if (typeof showMessage === 'function') {
                showMessage(`🔥 +${amount} Pyre!`, 600);
            }
        }, 400);
    },
    
    /**
     * Play animation for ability activation
     */
    abilityActivation(cryptid, abilityName, message) {
        this.enqueue(() => {
            const sprite = this.getSprite(cryptid);
            
            if (sprite) {
                sprite.classList.add('ability-activate');
                setTimeout(() => sprite.classList.remove('ability-activate'), 500);
            }
            
            if (message && typeof showMessage === 'function') {
                showMessage(message, 1000);
            }
        }, 600);
    },
    
    /**
     * Play animation for aura application
     */
    auraApplied(source, targets, auraType) {
        this.enqueue(() => {
            targets.forEach(target => {
                const sprite = this.getSprite(target);
                
                if (sprite) {
                    sprite.classList.add('aura-applied', `aura-${auraType}`);
                }
            });
        }, 300);
    },
    
    /**
     * Play animation for keyword granted
     */
    keywordGranted(target, keyword) {
        this.enqueue(() => {
            const sprite = this.getSprite(target);
            
            if (sprite) {
                sprite.classList.add('keyword-granted');
                setTimeout(() => sprite.classList.remove('keyword-granted'), 500);
            }
            
            if (typeof showMessage === 'function') {
                const keywordNames = {
                    flight: '🦅 Flight',
                    destroyer: '💀 Destroyer',
                    guardian: '🛡️ Guardian',
                    vampiric: '🧛 Vampiric',
                    regeneration: '💚 Regeneration',
                };
                showMessage(`${keywordNames[keyword] || keyword} granted!`, 800);
            }
        }, 400);
    },
    
    // ==================== COMPOSITE ANIMATIONS ====================
    // For complex effects that involve multiple animations
    
    /**
     * Play Mothman's Harbinger effect (damage all enemies based on ailments)
     */
    harbingerEffect(mothman, targets) {
        // Show Mothman activation
        this.abilityActivation(mothman, 'Harbinger', '🦋 Harbinger awakens!');
        
        // Then damage each target in sequence
        targets.forEach((targetInfo, index) => {
            setTimeout(() => {
                this.dealDamage(mothman, [targetInfo.cryptid], targetInfo.damage);
            }, index * 200);
        });
    },
    
    /**
     * Play cleanse and buff effect (like Mothman's Extinction)
     */
    cleanseAndBuffEffect(source, targets, totalStacksCleansed) {
        this.cleanse(source, targets, totalStacksCleansed);
        
        setTimeout(() => {
            this.buffStats(source, targets, { atk: totalStacksCleansed, hp: totalStacksCleansed });
        }, 500);
    },
    
    // ==================== UTILITY ====================
    
    /**
     * Play a generic effect animation based on action type
     */
    playForAction(action, source, targets, params = {}) {
        switch (action) {
            case 'dealDamage':
            case 'dealDamagePerStack':
                this.dealDamage(source, targets, params.amount || 1);
                break;
                
            case 'heal':
                this.heal(source, targets, params.amount || 1);
                break;
                
            case 'buffStats':
                this.buffStats(source, targets, params);
                break;
                
            case 'debuffStats':
                this.debuffStats(source, targets, params);
                break;
                
            case 'applyBurn':
                this.applyBurn(source, targets, params.stacks || 1);
                break;
                
            case 'applyBleed':
                this.applyBleed(source, targets, params.stacks || 1);
                break;
                
            case 'applyParalyze':
                this.applyParalyze(source, targets);
                break;
                
            case 'cleanse':
                this.cleanse(source, targets, params.stacksCleansed || 0);
                break;
                
            case 'cleanseAndBuff':
                this.cleanseAndBuffEffect(source, targets, params.stacksCleansed || 0);
                break;
                
            case 'grantKeyword':
                targets.forEach(t => this.keywordGranted(t, params.keyword));
                break;
                
            case 'grantAura':
                this.auraApplied(source, targets, params.aura);
                break;
                
            case 'gainPyre':
                this.gainPyre(params.owner || 'player', params.amount || 1);
                break;
                
            case 'destroy':
                targets.forEach(t => this.death(t, source));
                break;
                
            case 'summon':
                targets.forEach(t => this.summon(t));
                break;
                
            default:
                console.log(`[EffectAnimations] No animation defined for action: ${action}`);
        }
    }
};

console.log('[EffectAnimations] Effect animation system loaded');


