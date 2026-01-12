/**
 * Cryptid Fates - Putrid Swamp Series
 * Card and Monster Definitions
 * 
 * THEME: Cajun/Louisiana swamp folklore with curse mechanics,
 * death cycling, resurrection, and attrition-based gameplay.
 * 
 * NEW MECHANIC - CURSE:
 * - Curse tokens stack on cryptids
 * - Each token reduces ATK by 1 (minimum 0)
 * - Cleanses 1 token per turn naturally
 * - Several cards synergize with cursed enemies
 * 
 * SYNERGIES:
 * - Curse stacking for ATK debuff and instant kills
 * - Death cycling and resurrection engine
 * - Toxic tile synergy for swamp creatures
 * - Mirror/redirect damage effects (Voodoo theme)
 * - Pyre generation from enemy suffering
 */

// ==================== PUTRID SWAMP - KINDLING ====================

// Feu Follet - Cajun Will-o'-Wisp - Nature, Common
CardRegistry.registerKindling('feuFollet', {
    name: "Feu Follet",
    sprite: "🔆",
    spriteScale: 1.0,
    element: "nature",
    cost: 1,
    hp: 2,
    atk: 0,
    rarity: "common",
    evolvesInto: 'ignisFatuus',
    combatAbility: "Enemies who damage Feu Follet gain 2 curse tokens",
    supportAbility: "Combatant's attacks apply 1 curse token",
    
    // COMBAT: Enemies who damage this gain 2 curse
    onBeforeDefend: (cryptid, attacker, game) => {
        game.applyCurse(attacker, 2);
        GameEvents.emit('onCurseApplied', { source: cryptid, target: attacker, tokens: 2 });
        
        if (typeof queueAbilityAnimation !== 'undefined') {
            queueAbilityAnimation({
                type: 'debuff',
                target: attacker,
                message: `🔮 ${attacker.name} is cursed! (-2 ATK)`
            });
        }
    },
    
    // SUPPORT: Combatant attacks apply curse
    onSupport: (cryptid, owner, game) => {
        const combatant = game.getCombatant(cryptid);
        if (combatant) {
            combatant.attacksApplyCurse = 1;
        }
    }
});

// Swamp Rat - Nature, Common
CardRegistry.registerKindling('swampRat', {
    name: "Swamp Rat",
    sprite: "🐀",
    spriteScale: 0.9,
    element: "nature",
    cost: 1,
    hp: 1,
    atk: 1,
    rarity: "common",
    evolvesInto: 'plagueRat',
    combatAbility: "On hit, steal 1 pyre from enemy",
    supportAbility: "+1 pyre at turn start if combatant is cursed",
    
    // COMBAT: Steal pyre on hit
    onCombatAttack: (attacker, target, game) => {
        const enemyOwner = target.owner;
        const myOwner = attacker.owner;
        
        if (enemyOwner === 'player' && game.playerPyre > 0) {
            game.playerPyre--;
            game.enemyPyre++;
            GameEvents.emit('onPyreStolen', { from: 'player', to: 'enemy', amount: 1, source: attacker });
        } else if (enemyOwner === 'enemy' && game.enemyPyre > 0) {
            game.enemyPyre--;
            game.playerPyre++;
            GameEvents.emit('onPyreStolen', { from: 'enemy', to: 'player', amount: 1, source: attacker });
        }
        
        if (typeof queueAbilityAnimation !== 'undefined') {
            queueAbilityAnimation({
                type: 'buff',
                target: attacker,
                message: `🔥 ${attacker.name} steals 1 pyre!`
            });
        }
        return 0;
    },
    
    // SUPPORT: +1 pyre if combatant is cursed (defensive synergy)
    onSupport: (cryptid, owner, game) => {
        cryptid.hasSwampRatSupport = true;
    },
    
    onTurnStartSupport: (cryptid, owner, game) => {
        const combatant = game.getCombatant(cryptid);
        if (combatant && combatant.curseTokens > 0) {
            if (owner === 'player') game.playerPyre++;
            else game.enemyPyre++;
            GameEvents.emit('onPyreGained', { owner, amount: 1, source: 'Swamp Rat support' });
        }
    }
});

// Bayou Sprite - Nature, Common
CardRegistry.registerKindling('bayouSprite', {
    name: "Bayou Sprite",
    sprite: "🧚",
    spriteScale: 0.85,
    element: "nature",
    cost: 1,
    hp: 2,
    atk: 0,
    rarity: "common",
    evolvesInto: 'swampHag',
    combatAbility: "Create toxic tile on enemy side when summoned",
    supportAbility: "Combatant heals 1 HP when any enemy takes toxic damage",
    
    // COMBAT: Create toxic tile on summon
    onCombat: (cryptid, owner, game) => {
        const enemyOwner = owner === 'player' ? 'enemy' : 'player';
        const combatCol = game.getCombatCol(enemyOwner);
        // Create toxic on random row in enemy combat column
        const row = Math.floor(Math.random() * 3);
        game.applyToxic(enemyOwner, combatCol, row);
        
        if (typeof queueAbilityAnimation !== 'undefined') {
            queueAbilityAnimation({
                type: 'debuff',
                target: { owner: enemyOwner, col: combatCol, row },
                message: `☠️ Toxic swamp spreads!`
            });
        }
    },
    
    // SUPPORT: Heal combatant when enemy takes toxic damage
    onSupport: (cryptid, owner, game) => {
        cryptid.hasBayouSpriteSupport = true;
        // Register listener for toxic damage
        if (!cryptid._toxicHealListener) {
            cryptid._toxicHealListener = (data) => {
                if (data.owner !== owner) { // Enemy took toxic damage
                    const combatant = game.getCombatant(cryptid);
                    if (combatant) {
                        const maxHp = combatant.maxHp || combatant.hp;
                        if (combatant.currentHp < maxHp) {
                            combatant.currentHp = Math.min(maxHp, combatant.currentHp + 1);
                            GameEvents.emit('onHeal', { cryptid: combatant, amount: 1, source: 'Bayou Sprite' });
                        }
                    }
                }
            };
            GameEvents.on('onToxicDamage', cryptid._toxicHealListener);
        }
    },
    
    onDeath: (cryptid, game) => {
        if (cryptid._toxicHealListener) {
            const idx = GameEvents.listeners['onToxicDamage']?.indexOf(cryptid._toxicHealListener);
            if (idx > -1) GameEvents.listeners['onToxicDamage'].splice(idx, 1);
        }
    }
});

// Voodoo Doll - Void, Common
CardRegistry.registerKindling('voodooDoll', {
    name: "Voodoo Doll",
    sprite: "🪆",
    spriteScale: 0.9,
    element: "void",
    cost: 1,
    hp: 3,
    atk: 0,
    rarity: "common",
    evolvesInto: 'effigy',
    combatAbility: "Mirror: Damage to Voodoo Doll also hits enemy combatant across",
    supportAbility: "Once per turn, redirect 1 damage from combatant to enemy support",
    
    // COMBAT: Mirror damage to enemy across
    onBeforeDefend: (cryptid, attacker, game) => {
        const enemyAcross = game.getEnemyCombatantAcross(cryptid);
        if (enemyAcross && attacker !== enemyAcross) {
            // Will deal mirror damage after taking hit
            cryptid.mirrorDamageTarget = enemyAcross;
        }
    },
    
    onAfterDefend: (cryptid, attacker, damage, game) => {
        if (cryptid.mirrorDamageTarget && damage > 0) {
            cryptid.mirrorDamageTarget.currentHp -= damage;
            GameEvents.emit('onMirrorDamage', { source: cryptid, target: cryptid.mirrorDamageTarget, damage });
            
            if (typeof queueAbilityAnimation !== 'undefined') {
                queueAbilityAnimation({
                    type: 'damage',
                    target: cryptid.mirrorDamageTarget,
                    message: `🪆 Mirror! ${cryptid.mirrorDamageTarget.name} takes ${damage}!`
                });
            }
            
            if (cryptid.mirrorDamageTarget.currentHp <= 0) {
                cryptid.mirrorDamageTarget.killedBy = 'mirrorDamage';
                game.killCryptid(cryptid.mirrorDamageTarget, cryptid.owner);
            }
            cryptid.mirrorDamageTarget = null;
        }
    },
    
    // SUPPORT: Redirect damage to enemy support (once per turn)
    onSupport: (cryptid, owner, game) => {
        cryptid.hasVoodooDollSupport = true;
        cryptid.voodooDollRedirectAvailable = true;
    }
});

// Plat-Eye Pup - Evil spirit dog - Void, Common
CardRegistry.registerKindling('platEyePup', {
    name: "Plat-Eye Pup",
    sprite: "🐕‍🦺",
    spriteScale: 0.9,
    element: "void",
    cost: 1,
    hp: 2,
    atk: 1,
    rarity: "common",
    evolvesInto: 'platEye',
    combatAbility: "Reveals hidden enemies across",
    supportAbility: "Combatant gains +2 ATK vs enemies with any status ailment",
    
    // COMBAT: Reveal hidden enemies
    onCombat: (cryptid, owner, game) => {
        const enemies = game.getCryptidsAcross(cryptid);
        for (const enemy of enemies) {
            if (enemy.isHidden) {
                enemy.isHidden = false;
                GameEvents.emit('onReveal', { cryptid: enemy, revealedBy: cryptid });
                
                if (typeof queueAbilityAnimation !== 'undefined') {
                    queueAbilityAnimation({
                        type: 'debuff',
                        target: enemy,
                        message: `👁️ ${enemy.name} revealed!`
                    });
                }
            }
        }
    },
    
    // SUPPORT: Bonus damage vs ailments (one-time, doesn't stack)
    onSupport: (cryptid, owner, game) => {
        const combatant = game.getCombatant(cryptid);
        if (combatant) {
            // Track which combatant we've buffed to prevent stacking
            const combatantId = combatant.id || `${combatant.key}-${combatant.col}-${combatant.row}`;
            if (cryptid._lastBuffedCombatant === combatantId) return;
            
            combatant.bonusVsAilment = (combatant.bonusVsAilment || 0) + 2;
            cryptid._lastBuffedCombatant = combatantId;
        }
    }
});

// ==================== PUTRID SWAMP - COMMON CRYPTIDS ====================

// Zombie - Blood, Common, Cost 2
CardRegistry.registerCryptid('zombie', {
    name: "Zombie",
    sprite: "🧟",
    spriteScale: 1.0,
    element: "blood",
    cost: 2,
    hp: 2,
    atk: 2,
    rarity: "common",
    evolvesInto: 'revenant',
    combatAbility: "Undying: On first death, return to hand at end of turn",
    supportAbility: "Combatant heals 1 HP on kill",
    
    // Track if already used undying
    onSummon: (cryptid, owner, game) => {
        cryptid.undyingUsed = false;
    },
    
    // COMBAT: Return to hand on first death
    onDeath: (cryptid, game) => {
        if (!cryptid.undyingUsed) {
            cryptid.undyingUsed = true;
            cryptid.preventDeath = true;
            
            // Queue return to hand at end of turn
            const owner = cryptid.owner;
            const hand = owner === 'player' ? game.playerHand : game.enemyHand;
            
            // Create a copy for the hand
            const zombieCard = CardRegistry.getCryptid('zombie');
            if (zombieCard && hand.length < 20) {
                zombieCard.id = Math.random().toString(36).substr(2, 9);
                zombieCard.undyingUsed = true; // Can't use undying again
                hand.push(zombieCard);
                
                GameEvents.emit('onUndying', { cryptid, owner });
                
                if (typeof queueAbilityAnimation !== 'undefined') {
                    queueAbilityAnimation({
                        type: 'buff',
                        target: cryptid,
                        message: `🧟 ${cryptid.name} will return!`
                    });
                }
            }
        }
    },
    
    // SUPPORT: Combatant heals on kill (one-time, doesn't stack)
    onSupport: (cryptid, owner, game) => {
        const combatant = game.getCombatant(cryptid);
        if (combatant) {
            // Track which combatant we've buffed to prevent stacking
            const combatantId = combatant.id || `${combatant.key}-${combatant.col}-${combatant.row}`;
            if (cryptid._lastBuffedCombatant === combatantId) return;
            
            combatant.healOnKill = (combatant.healOnKill || 0) + 1;
            cryptid._lastBuffedCombatant = combatantId;
        }
    }
});

// Crawfish Horror - Nature, Common, Cost 2
CardRegistry.registerCryptid('crawfishHorror', {
    name: "Crawfish Horror",
    sprite: "🦞",
    spriteScale: 1.0,
    element: "nature",
    cost: 2,
    hp: 3,
    atk: 2,
    rarity: "common",
    combatAbility: "Hard Shell: When damaged, apply 1 curse to attacker",
    supportAbility: "Combatant gains Protection 1",
    
    // COMBAT: Curse attackers
    onBeforeDefend: (cryptid, attacker, game) => {
        game.applyCurse(attacker, 1);
        GameEvents.emit('onCurseApplied', { source: cryptid, target: attacker, tokens: 1 });
    },
    
    // SUPPORT: Grant protection (one-time, doesn't stack)
    onSupport: (cryptid, owner, game) => {
        const combatant = game.getCombatant(cryptid);
        if (combatant) {
            // Track which combatant we've buffed to prevent stacking
            const combatantId = combatant.id || `${combatant.key}-${combatant.col}-${combatant.row}`;
            if (cryptid._lastBuffedCombatant === combatantId) return;
            
            game.applyProtection(combatant, 1);
            cryptid._lastBuffedCombatant = combatantId;
        }
    }
});

// Letiche - Feral swamp child - Nature, Common, Cost 2
CardRegistry.registerCryptid('letiche', {
    name: "Letiche",
    sprite: "👹",
    spriteScale: 1.0,
    element: "nature",
    cost: 2,
    hp: 2,
    atk: 3,
    rarity: "common",
    evolvesInto: 'swampStalker',
    combatAbility: "Feral: +2 ATK when attacking enemies on toxic tiles",
    supportAbility: "Create toxic tile in enemy combat column at turn start",
    
    // COMBAT: Bonus ATK vs enemies on toxic
    onCombatAttack: (attacker, target, game) => {
        if (game.isTileToxic(target.owner, target.col, target.row)) {
            return 2; // +2 bonus damage
        }
        return 0;
    },
    
    // SUPPORT: Create toxic at turn start
    onSupport: (cryptid, owner, game) => {
        cryptid.hasLeticheSupport = true;
    },
    
    onTurnStartSupport: (cryptid, owner, game) => {
        if (cryptid.hasLeticheSupport) {
            const enemyOwner = owner === 'player' ? 'enemy' : 'player';
            const combatCol = game.getCombatCol(enemyOwner);
            const row = Math.floor(Math.random() * 3);
            game.applyToxic(enemyOwner, combatCol, row);
        }
    }
});

// Haint - Restless spirit - Void, Common, Cost 2
CardRegistry.registerCryptid('haint', {
    name: "Haint",
    sprite: "👻",
    spriteScale: 1.0,
    element: "void",
    cost: 2,
    hp: 4,
    atk: 1,
    rarity: "common",
    evolvesInto: 'booHag',
    combatAbility: "Spirit Form: Immune to curse tokens",
    supportAbility: "Remove 1 curse token from combatant at turn start",
    
    // COMBAT: Immune to curse
    onSummon: (cryptid, owner, game) => {
        cryptid.curseImmune = true;
    },
    
    // SUPPORT: Cleanse curse from combatant
    onSupport: (cryptid, owner, game) => {
        cryptid.hasHaintSupport = true;
    },
    
    onTurnStartSupport: (cryptid, owner, game) => {
        if (cryptid.hasHaintSupport) {
            const combatant = game.getCombatant(cryptid);
            if (combatant && combatant.curseTokens > 0) {
                combatant.curseTokens--;
                GameEvents.emit('onCurseCleanse', { cryptid: combatant, owner, tokensRemaining: combatant.curseTokens });
            }
        }
    }
});

// ==================== PUTRID SWAMP - UNCOMMON CRYPTIDS ====================

// Ignis Fatuus - Evolved Feu Follet - Nature, Uncommon, Cost 3
CardRegistry.registerCryptid('ignisFatuus', {
    name: "Ignis Fatuus",
    sprite: "💫",
    spriteScale: 1.0,
    element: "nature",
    cost: 3,
    hp: 3,
    atk: 2,
    rarity: "uncommon",
    evolvesFrom: 'feuFollet',
    evolvesInto: 'spiritFire',
    combatAbility: "Death Light: Attacks apply 2 curse. Enemies with 4+ curse die instantly",
    supportAbility: "All enemies gain 1 curse token at your turn start",
    
    // COMBAT: Apply curse on attack, instant kill at 4+ curse
    onCombatAttack: (attacker, target, game) => {
        game.applyCurse(target, 2);
        
        if (target.curseTokens >= 4) {
            target.killedBy = 'curseOverload';
            game.killCryptid(target, attacker.owner);
            
            if (typeof queueAbilityAnimation !== 'undefined') {
                queueAbilityAnimation({
                    type: 'damage',
                    target: target,
                    message: `💀 ${target.name} consumed by curse!`
                });
            }
        }
        return 0;
    },
    
    // SUPPORT: All enemies gain curse at turn start
    onSupport: (cryptid, owner, game) => {
        cryptid.hasIgnisFatuusSupport = true;
    },
    
    onTurnStartSupport: (cryptid, owner, game) => {
        if (cryptid.hasIgnisFatuusSupport) {
            const enemyOwner = owner === 'player' ? 'enemy' : 'player';
            const enemyField = enemyOwner === 'player' ? game.playerField : game.enemyField;
            
            for (let c = 0; c < 2; c++) {
                for (let r = 0; r < 3; r++) {
                    const enemy = enemyField[c][r];
                    if (enemy && !enemy.curseImmune) {
                        game.applyCurse(enemy, 1);
                    }
                }
            }
        }
    }
});

// Plague Rat - Evolved Swamp Rat - Nature, Uncommon, Cost 3
CardRegistry.registerCryptid('plagueRat', {
    name: "Plague Rat",
    sprite: "🐀",
    spriteScale: 1.1,
    element: "nature",
    cost: 3,
    hp: 3,
    atk: 2,
    rarity: "uncommon",
    evolvesFrom: 'swampRat',
    combatAbility: "Pestilence: Attacks apply bleed. Steal 1 pyre per bleed stack on target",
    supportAbility: "+1 pyre per enemy with status ailment at turn start (max 3)",
    
    attacksApplyBleed: true,
    
    // COMBAT: Steal pyre based on bleed
    onCombatAttack: (attacker, target, game) => {
        const bleedStacks = target.bleedTurns || 0;
        if (bleedStacks > 0) {
            const myOwner = attacker.owner;
            const enemyOwner = target.owner;
            const stealAmount = Math.min(bleedStacks, enemyOwner === 'player' ? game.playerPyre : game.enemyPyre);
            
            if (stealAmount > 0) {
                if (enemyOwner === 'player') {
                    game.playerPyre -= stealAmount;
                    game.enemyPyre += stealAmount;
                } else {
                    game.enemyPyre -= stealAmount;
                    game.playerPyre += stealAmount;
                }
                GameEvents.emit('onPyreStolen', { from: enemyOwner, to: myOwner, amount: stealAmount, source: attacker });
            }
        }
        return 0;
    },
    
    // SUPPORT: Gain pyre for enemies with ailments
    onSupport: (cryptid, owner, game) => {
        cryptid.hasPlagueRatSupport = true;
    },
    
    onTurnStartSupport: (cryptid, owner, game) => {
        if (cryptid.hasPlagueRatSupport) {
            const enemyOwner = owner === 'player' ? 'enemy' : 'player';
            const enemyField = enemyOwner === 'player' ? game.playerField : game.enemyField;
            
            let ailmentCount = 0;
            for (let c = 0; c < 2; c++) {
                for (let r = 0; r < 3; r++) {
                    const enemy = enemyField[c][r];
                    if (enemy && game.hasStatusAilment(enemy)) {
                        ailmentCount++;
                    }
                }
            }
            
            const pyreGain = Math.min(ailmentCount, 3);
            if (pyreGain > 0) {
                if (owner === 'player') game.playerPyre += pyreGain;
                else game.enemyPyre += pyreGain;
                GameEvents.emit('onPyreGained', { owner, amount: pyreGain, source: 'Plague Rat support' });
            }
        }
    }
});

// Swamp Hag - Evolved Bayou Sprite - Nature/Void, Uncommon, Cost 3
CardRegistry.registerCryptid('swampHag', {
    name: "Swamp Hag",
    sprite: "🧙‍♀️",
    spriteScale: 1.0,
    element: "nature",
    cost: 3,
    hp: 4,
    atk: 2,
    rarity: "uncommon",
    evolvesFrom: 'bayouSprite',
    evolvesInto: 'mamaBrigitte',
    combatAbility: "Hex: Attacks disable enemy support abilities for 1 turn",
    supportAbility: "Enemy combatant across takes 1 damage at your turn start",
    
    // COMBAT: Disable enemy support on hit
    onCombatAttack: (attacker, target, game) => {
        const enemySupport = game.getSupport(target);
        if (enemySupport) {
            enemySupport.hexed = true;
            enemySupport.hexTurns = 1;
            GameEvents.emit('onHex', { source: attacker, target: enemySupport });
            
            if (typeof queueAbilityAnimation !== 'undefined') {
                queueAbilityAnimation({
                    type: 'debuff',
                    target: enemySupport,
                    message: `🔮 ${enemySupport.name} hexed!`
                });
            }
        }
        return 0;
    },
    
    // SUPPORT: Damage enemy combatant across at turn start
    onSupport: (cryptid, owner, game) => {
        cryptid.hasSwampHagSupport = true;
    },
    
    onTurnStartSupport: (cryptid, owner, game) => {
        if (cryptid.hasSwampHagSupport) {
            const combatant = game.getCombatant(cryptid);
            if (combatant) {
                const enemyAcross = game.getEnemyCombatantAcross(combatant);
                if (enemyAcross) {
                    enemyAcross.currentHp -= 1;
                    GameEvents.emit('onSwampHagDamage', { source: cryptid, target: enemyAcross, damage: 1 });
                    
                    if (enemyAcross.currentHp <= 0) {
                        enemyAcross.killedBy = 'swampHagCurse';
                        game.killCryptid(enemyAcross, owner);
                    }
                }
            }
        }
    }
});

// Effigy - Evolved Voodoo Doll - Void, Uncommon, Cost 3
CardRegistry.registerCryptid('effigy', {
    name: "Effigy",
    sprite: "🗿",
    spriteScale: 1.0,
    element: "void",
    cost: 3,
    hp: 4,
    atk: 2,
    rarity: "uncommon",
    evolvesFrom: 'voodooDoll',
    combatAbility: "Soul Link: Choose enemy on summon. All damage to Effigy splits with linked enemy",
    supportAbility: "When combatant takes lethal damage, may destroy Effigy to survive at 1 HP",
    
    // COMBAT: Link to enemy on summon
    onCombat: (cryptid, owner, game) => {
        // Link to enemy combatant across
        const enemyAcross = game.getEnemyCombatantAcross(cryptid);
        if (enemyAcross) {
            cryptid.soulLinkedTo = enemyAcross;
            GameEvents.emit('onSoulLink', { source: cryptid, target: enemyAcross });
            
            if (typeof queueAbilityAnimation !== 'undefined') {
                queueAbilityAnimation({
                    type: 'debuff',
                    target: enemyAcross,
                    message: `🔗 Soul linked to ${enemyAcross.name}!`
                });
            }
        }
    },
    
    // Split damage with linked enemy
    onBeforeDefend: (cryptid, attacker, game) => {
        if (cryptid.soulLinkedTo && cryptid.soulLinkedTo.currentHp > 0) {
            cryptid.splitDamageActive = true;
        }
    },
    
    onAfterDefend: (cryptid, attacker, damage, game) => {
        if (cryptid.splitDamageActive && cryptid.soulLinkedTo && damage > 0) {
            const splitDamage = Math.floor(damage / 2);
            if (splitDamage > 0) {
                cryptid.soulLinkedTo.currentHp -= splitDamage;
                GameEvents.emit('onSoulLinkDamage', { source: cryptid, target: cryptid.soulLinkedTo, damage: splitDamage });
                
                if (cryptid.soulLinkedTo.currentHp <= 0) {
                    cryptid.soulLinkedTo.killedBy = 'soulLink';
                    game.killCryptid(cryptid.soulLinkedTo, cryptid.owner);
                }
            }
            cryptid.splitDamageActive = false;
        }
    },
    
    // SUPPORT: Sacrifice to save combatant
    onSupport: (cryptid, owner, game) => {
        cryptid.hasEffigySupport = true;
    }
});

// Plat-Eye - Evolved Plat-Eye Pup - Void, Uncommon, Cost 4
CardRegistry.registerCryptid('platEye', {
    name: "Plat-Eye",
    sprite: "👁️",
    spriteScale: 1.1,
    element: "void",
    cost: 4,
    hp: 4,
    atk: 3,
    rarity: "uncommon",
    evolvesFrom: 'platEyePup',
    combatAbility: "Evil Eye: Attacks bypass protection. Reveals all hidden enemies",
    supportAbility: "Enemy support across has abilities disabled",
    
    hasFocus: true, // Bypass protection
    
    // COMBAT: Reveal hidden enemies on enter
    onCombat: (cryptid, owner, game) => {
        const enemyOwner = owner === 'player' ? 'enemy' : 'player';
        const enemyField = enemyOwner === 'player' ? game.playerField : game.enemyField;
        
        for (let c = 0; c < 2; c++) {
            for (let r = 0; r < 3; r++) {
                const enemy = enemyField[c][r];
                if (enemy && enemy.isHidden) {
                    enemy.isHidden = false;
                    GameEvents.emit('onReveal', { cryptid: enemy, revealedBy: cryptid });
                }
            }
        }
    },
    
    // SUPPORT: Negate enemy support abilities
    onSupport: (cryptid, owner, game) => {
        cryptid.negatesEnemySupport = true;
    }
});

// ==================== PUTRID SWAMP - RARE CRYPTIDS ====================

// Spirit Fire - Evolved Ignis Fatuus - Nature/Void, Rare, Cost 5
CardRegistry.registerCryptid('spiritFire', {
    name: "Spirit Fire",
    sprite: "🔥",
    spriteScale: 1.1,
    element: "void",
    cost: 5,
    hp: 4,
    atk: 3,
    rarity: "rare",
    evolvesFrom: 'ignisFatuus',
    combatAbility: "Attacks apply burn AND 2 curse. Enemies with 5+ curse explode on death",
    supportAbility: "Cursed enemies take 1 extra damage from all sources",
    
    attacksApplyBurn: true,
    
    // COMBAT: Apply burn and curse, explosion on death at 5+ curse
    onCombatAttack: (attacker, target, game) => {
        game.applyCurse(target, 2);
        
        // Mark for explosion if dies with 5+ curse
        if (target.curseTokens >= 5) {
            target.explodeOnDeath = true;
        }
        return 0;
    },
    
    // SUPPORT: Cursed enemies take extra damage
    onSupport: (cryptid, owner, game) => {
        cryptid.hasSpiritFireSupport = true;
    }
});

// Boo Hag - Evolved Haint - Void, Rare, Cost 5
CardRegistry.registerCryptid('booHag', {
    name: "Boo Hag",
    sprite: "👺",
    spriteScale: 1.0,
    element: "void",
    cost: 5,
    hp: 3,
    atk: 4,
    rarity: "rare",
    evolvesFrom: 'haint',
    combatAbility: "Skin Ride: On kill, copy killed enemy's combat ability until end of next turn",
    supportAbility: "Once per turn, redirect attack targeting combatant to Boo Hag instead",
    
    curseImmune: true,
    
    // COMBAT: Copy ability on kill
    onKill: (cryptid, victim, game) => {
        if (victim.onCombatAttack) {
            cryptid.copiedAbility = victim.onCombatAttack;
            cryptid.copiedAbilityName = victim.name;
            cryptid.copiedAbilityTurns = 2;
            
            if (typeof queueAbilityAnimation !== 'undefined') {
                queueAbilityAnimation({
                    type: 'buff',
                    target: cryptid,
                    message: `🎭 ${cryptid.name} copies ${victim.name}'s power!`
                });
            }
        }
    },
    
    // Use copied ability
    onCombatAttack: (attacker, target, game) => {
        if (attacker.copiedAbility && attacker.copiedAbilityTurns > 0) {
            return attacker.copiedAbility(attacker, target, game) || 0;
        }
        return 0;
    },
    
    // SUPPORT: Redirect attack
    onSupport: (cryptid, owner, game) => {
        cryptid.hasBooHagSupport = true;
        cryptid.booHagRedirectAvailable = true;
    }
});

// Revenant - Evolved Zombie - Blood, Rare, Cost 4
CardRegistry.registerCryptid('revenant', {
    name: "Revenant",
    sprite: "💀",
    spriteScale: 1.0,
    element: "blood",
    cost: 4,
    hp: 4,
    atk: 4,
    rarity: "rare",
    evolvesFrom: 'zombie',
    evolvesInto: 'draugrLord',
    combatAbility: "Grudge: Returns at 1 HP on first death. Gains +1/+1 permanently each death",
    supportAbility: "When combatant dies, may sacrifice Revenant to revive combatant at 2 HP",
    
    onSummon: (cryptid, owner, game) => {
        cryptid.grudgeUsed = false;
        cryptid.deathCount = 0;
    },
    
    // COMBAT: Return on first death with buff
    onDeath: (cryptid, game) => {
        if (!cryptid.grudgeUsed) {
            cryptid.grudgeUsed = true;
            cryptid.preventDeath = true;
            cryptid.deathCount = (cryptid.deathCount || 0) + 1;
            
            // Revive at 1 HP with permanent buff
            cryptid.currentHp = 1;
            cryptid.currentAtk += 1;
            cryptid.maxHp += 1;
            cryptid.baseAtk += 1;
            cryptid.baseHp += 1;
            
            GameEvents.emit('onGrudge', { cryptid, deathCount: cryptid.deathCount });
            
            if (typeof queueAbilityAnimation !== 'undefined') {
                queueAbilityAnimation({
                    type: 'buff',
                    target: cryptid,
                    message: `💀 ${cryptid.name} rises stronger! (+1/+1)`
                });
            }
        }
    },
    
    // SUPPORT: Sacrifice to revive combatant
    onSupport: (cryptid, owner, game) => {
        cryptid.hasRevenantSupport = true;
    }
});

// Rougarou - Cajun werewolf - Blood, Rare, Cost 5 (FLAGSHIP)
CardRegistry.registerCryptid('rougarou', {
    name: "Rougarou",
    sprite: "🐺",
    spriteScale: 1.1,
    element: "blood",
    cost: 5,
    hp: 4,
    atk: 5,
    rarity: "rare",
    evolvesInto: 'loupGarou',
    combatAbility: "Moon Frenzy: +2 ATK on odd turns. On kill while below half HP, fully heal",
    supportAbility: "Combatant gains +2 ATK and attacks apply bleed",
    
    // COMBAT: Odd turn bonus, heal on kill when low
    onTurnStart: (cryptid, owner, game) => {
        const combatCol = game.getCombatCol(owner);
        if (cryptid.col === combatCol) {
            if (game.turnNumber % 2 === 1) {
                cryptid.moonFrenzyActive = true;
                cryptid.bonusDamage = (cryptid.bonusDamage || 0) + 2;
            } else {
                cryptid.moonFrenzyActive = false;
                cryptid.bonusDamage = Math.max(0, (cryptid.bonusDamage || 0) - 2);
            }
        }
    },
    
    onKill: (cryptid, victim, game) => {
        const maxHp = cryptid.maxHp || cryptid.hp;
        if (cryptid.currentHp < maxHp / 2) {
            cryptid.currentHp = maxHp;
            GameEvents.emit('onHeal', { cryptid, amount: maxHp, source: 'Rougarou Moon Frenzy' });
            
            if (typeof queueAbilityAnimation !== 'undefined') {
                queueAbilityAnimation({
                    type: 'buff',
                    target: cryptid,
                    message: `🐺 ${cryptid.name} fully heals from the kill!`
                });
            }
        }
    },
    
    // SUPPORT: Grant ATK and bleed
    onSupport: (cryptid, owner, game) => {
        const combatant = game.getCombatant(cryptid);
        if (combatant) {
            combatant.currentAtk += 2;
            combatant.attacksApplyBleed = true;
        }
    }
});

// Swamp Stalker - Evolved Letiche - Nature, Rare, Cost 4
CardRegistry.registerCryptid('swampStalker', {
    name: "Swamp Stalker",
    sprite: "🦎",
    spriteScale: 1.1,
    element: "nature",
    cost: 4,
    hp: 3,
    atk: 4,
    rarity: "rare",
    evolvesFrom: 'letiche',
    combatAbility: "Ambush: +3 ATK on first attack. Creates toxic tiles in both enemy columns",
    supportAbility: "All toxic tiles deal +1 damage",
    
    onSummon: (cryptid, owner, game) => {
        cryptid.ambushReady = true;
    },
    
    // COMBAT: First attack bonus, create toxic
    onCombat: (cryptid, owner, game) => {
        const enemyOwner = owner === 'player' ? 'enemy' : 'player';
        // Create toxic in both columns
        for (let c = 0; c < 2; c++) {
            const row = Math.floor(Math.random() * 3);
            game.applyToxic(enemyOwner, c, row);
        }
    },
    
    onCombatAttack: (attacker, target, game) => {
        if (attacker.ambushReady) {
            attacker.ambushReady = false;
            return 3; // +3 damage on first attack
        }
        // Bonus vs toxic tiles
        if (game.isTileToxic(target.owner, target.col, target.row)) {
            return 2;
        }
        return 0;
    },
    
    // SUPPORT: Toxic deals extra damage
    onSupport: (cryptid, owner, game) => {
        cryptid.hasSwampStalkerSupport = true;
        // This would need to be integrated into toxic damage processing
    }
});

// ==================== PUTRID SWAMP - ULTIMATE CRYPTIDS ====================

// Mama Brigitte - Evolved Swamp Hag - Void/Nature, Ultimate, Cost 6
CardRegistry.registerCryptid('mamaBrigitte', {
    name: "Mama Brigitte",
    sprite: "👸",
    spriteScale: 1.1,
    element: "void",
    cost: 6,
    hp: 5,
    atk: 4,
    rarity: "ultimate",
    evolvesFrom: 'swampHag',
    combatAbility: "Death's Bride: Immune to instant death. On kill, choose: heal 4 HP OR draw 2",
    supportAbility: "All ally deaths generate +2 pyre. Enemy kills heal your cryptids 1 HP each",
    
    onSummon: (cryptid, owner, game) => {
        cryptid.instantDeathImmune = true;
    },
    
    // COMBAT: On kill benefit
    onKill: (cryptid, victim, game) => {
        // For now, default to heal (could add UI choice later)
        const maxHp = cryptid.maxHp || cryptid.hp;
        cryptid.currentHp = Math.min(maxHp, cryptid.currentHp + 4);
        GameEvents.emit('onHeal', { cryptid, amount: 4, source: 'Mama Brigitte' });
        
        if (typeof queueAbilityAnimation !== 'undefined') {
            queueAbilityAnimation({
                type: 'buff',
                target: cryptid,
                message: `👸 ${cryptid.name} draws power from death! (+4 HP)`
            });
        }
    },
    
    // SUPPORT: Pyre on ally death, heal on enemy kills
    onSupport: (cryptid, owner, game) => {
        cryptid.hasMamaBrigitteSupport = true;
        
        // Register death listener
        if (!cryptid._deathListener) {
            cryptid._deathListener = (data) => {
                if (data.owner === owner) {
                    // Ally died - gain pyre
                    if (owner === 'player') game.playerPyre += 2;
                    else game.enemyPyre += 2;
                    GameEvents.emit('onPyreGained', { owner, amount: 2, source: 'Mama Brigitte' });
                }
            };
            GameEvents.on('onDeath', cryptid._deathListener);
        }
    },
    
    onDeath: (cryptid, game) => {
        if (cryptid._deathListener) {
            const idx = GameEvents.listeners['onDeath']?.indexOf(cryptid._deathListener);
            if (idx > -1) GameEvents.listeners['onDeath'].splice(idx, 1);
        }
    }
});

// Loup-Garou - Evolved Rougarou - Blood, Ultimate, Cost 7
CardRegistry.registerCryptid('loupGarou', {
    name: "Loup-Garou",
    sprite: "🐺",
    spriteScale: 1.2,
    element: "blood",
    cost: 7,
    hp: 5,
    atk: 7,
    rarity: "ultimate",
    evolvesFrom: 'rougarou',
    combatAbility: "Alpha Predator: Double ATK on odd turns. On kill, may immediately attack again",
    supportAbility: "Combatant has +3 ATK and heals 3 HP after any kill",
    
    // COMBAT: Double ATK on odd turns, extra attack on kill
    onTurnStart: (cryptid, owner, game) => {
        const combatCol = game.getCombatCol(owner);
        if (cryptid.col === combatCol) {
            if (game.turnNumber % 2 === 1) {
                cryptid.moonFrenzyActive = true;
                // Double ATK effect
                cryptid.bonusDamage = cryptid.currentAtk;
            } else {
                cryptid.moonFrenzyActive = false;
                cryptid.bonusDamage = 0;
            }
        }
    },
    
    onKill: (cryptid, victim, game) => {
        cryptid.canAttackAgain = true;
        GameEvents.emit('onAlphaKill', { cryptid, victim });
        
        if (typeof queueAbilityAnimation !== 'undefined') {
            queueAbilityAnimation({
                type: 'buff',
                target: cryptid,
                message: `🐺 ${cryptid.name} hunts again!`
            });
        }
    },
    
    // SUPPORT: Grant ATK and heal on kill (one-time, doesn't stack)
    onSupport: (cryptid, owner, game) => {
        const combatant = game.getCombatant(cryptid);
        if (combatant) {
            // Track which combatant we've buffed to prevent stacking
            const combatantId = combatant.id || `${combatant.key}-${combatant.col}-${combatant.row}`;
            if (cryptid._lastBuffedCombatant === combatantId) return;
            
            combatant.currentAtk = (combatant.currentAtk || combatant.atk) + 3;
            combatant.healOnKill = (combatant.healOnKill || 0) + 3;
            cryptid._lastBuffedCombatant = combatantId;
        }
    }
});

// Draugr Lord - Evolved Revenant - Blood/Void, Ultimate, Cost 7
CardRegistry.registerCryptid('draugrLord', {
    name: "Draugr Lord",
    sprite: "🧛",
    spriteScale: 1.1,
    element: "blood",
    cost: 7,
    hp: 6,
    atk: 6,
    rarity: "ultimate",
    evolvesFrom: 'revenant',
    combatAbility: "Undeath Eternal: Returns at full HP on first death. Each kill grants +1/+1. Destroyer",
    supportAbility: "All ally cryptids return at 1 HP on first death (once each)",
    
    hasDestroyer: true,
    
    onSummon: (cryptid, owner, game) => {
        cryptid.undeathUsed = false;
    },
    
    // COMBAT: Return on first death at full HP
    onDeath: (cryptid, game) => {
        if (!cryptid.undeathUsed) {
            cryptid.undeathUsed = true;
            cryptid.preventDeath = true;
            cryptid.currentHp = cryptid.maxHp;
            
            GameEvents.emit('onUndeathEternal', { cryptid });
            
            if (typeof queueAbilityAnimation !== 'undefined') {
                queueAbilityAnimation({
                    type: 'buff',
                    target: cryptid,
                    message: `👑 ${cryptid.name} defies death!`
                });
            }
        }
    },
    
    onKill: (cryptid, victim, game) => {
        cryptid.currentAtk += 1;
        cryptid.currentHp += 1;
        cryptid.maxHp += 1;
        GameEvents.emit('onDraugrKill', { cryptid, victim });
    },
    
    // SUPPORT: Grant undying to all allies
    onSupport: (cryptid, owner, game) => {
        cryptid.hasDraugrLordSupport = true;
        
        // Grant undying flag to all allies
        const field = owner === 'player' ? game.playerField : game.enemyField;
        for (let c = 0; c < 2; c++) {
            for (let r = 0; r < 3; r++) {
                const ally = field[c][r];
                if (ally && ally !== cryptid && !ally.draugrUndying) {
                    ally.draugrUndying = true;
                }
            }
        }
    }
});

// ==================== PUTRID SWAMP - MYTHICAL CRYPTIDS ====================

// Baron Samedi - Void/Blood, Ultimate Mythical, Cost 8
CardRegistry.registerCryptid('baronSamedi', {
    name: "Baron Samedi",
    sprite: "🎩",
    spriteScale: 1.2,
    element: "void",
    cost: 8,
    hp: 7,
    atk: 5,
    rarity: "ultimate",
    mythical: true,
    maxCopies: 1,
    combatAbility: "Lord of the Dead: Cannot die while cryptids in discard. On attack, resurrect common to support",
    supportAbility: "At turn start, pay 3 pyre to resurrect any cryptid from discard to combat at 1 HP",
    
    // COMBAT: Cannot die if discard has cryptids
    onBeforeDefend: (cryptid, attacker, game) => {
        const discard = cryptid.owner === 'player' ? game.playerDiscardPile : game.enemyDiscardPile;
        const hasCryptidsInDiscard = discard.some(c => c.type === 'cryptid');
        if (hasCryptidsInDiscard) {
            cryptid.cannotDie = true;
        }
    },
    
    onAfterDefend: (cryptid, attacker, damage, game) => {
        if (cryptid.cannotDie && cryptid.currentHp <= 0) {
            cryptid.currentHp = 1;
            cryptid.preventDeath = true;
            
            // Consume a cryptid from discard
            const discard = cryptid.owner === 'player' ? game.playerDiscardPile : game.enemyDiscardPile;
            const cryptidIdx = discard.findIndex(c => c.type === 'cryptid');
            if (cryptidIdx > -1) {
                const consumed = discard.splice(cryptidIdx, 1)[0];
                GameEvents.emit('onBaronConsume', { baron: cryptid, consumed });
            }
        }
        cryptid.cannotDie = false;
    },
    
    // On attack, resurrect common cryptid to support
    onCombatAttack: (attacker, target, game) => {
        const owner = attacker.owner;
        const discard = owner === 'player' ? game.playerDiscardPile : game.enemyDiscardPile;
        const supportCol = game.getSupportCol(owner);
        const field = owner === 'player' ? game.playerField : game.enemyField;
        
        // Find empty support slot
        let emptyRow = -1;
        for (let r = 0; r < 3; r++) {
            if (!field[supportCol][r]) {
                emptyRow = r;
                break;
            }
        }
        
        if (emptyRow >= 0) {
            // Find common cryptid in discard
            const commonIdx = discard.findIndex(c => c.type === 'cryptid' && c.rarity === 'common');
            if (commonIdx > -1) {
                const resurrected = discard.splice(commonIdx, 1)[0];
                game.summonCryptid(owner, supportCol, emptyRow, resurrected);
                const newCryptid = field[supportCol][emptyRow];
                if (newCryptid) {
                    newCryptid.currentHp = 1;
                }
                
                GameEvents.emit('onResurrect', { source: attacker, resurrected, row: emptyRow });
            }
        }
        return 0;
    },
    
    // SUPPORT: Pay 3 pyre to resurrect
    onSupport: (cryptid, owner, game) => {
        cryptid.hasBaronSamediSupport = true;
    }
});

// Honey Island Swamp Monster - Nature, Rare Mythical, Cost 5
CardRegistry.registerCryptid('honeyIslandMonster', {
    name: "Honey Island Monster",
    sprite: "🦍",
    spriteScale: 1.2,
    element: "nature",
    cost: 5,
    hp: 6,
    atk: 5,
    rarity: "rare",
    mythical: true,
    maxCopies: 1,
    combatAbility: "Ambush Predator: +3 damage on first attack. Destroys enemy trap in same row on enter",
    supportAbility: "Combatant cannot be targeted by traps or bursts",
    
    onSummon: (cryptid, owner, game) => {
        cryptid.firstAttack = true;
    },
    
    // COMBAT: Destroy trap on enter, bonus first attack
    onCombat: (cryptid, owner, game) => {
        const enemyOwner = owner === 'player' ? 'enemy' : 'player';
        
        // Map field row to trap slot (row 0→slot 0, row 2→slot 1, row 1 has no trap)
        const trapSlot = game.fieldRowToTrapSlot(cryptid.row);
        if (trapSlot !== null) {
            const trap = game.getTrap(enemyOwner, trapSlot);
            if (trap) {
                const destroyed = game.destroyTrap(enemyOwner, trapSlot, cryptid);
                if (destroyed && typeof queueAbilityAnimation !== 'undefined') {
                    queueAbilityAnimation({
                        type: 'damage',
                        target: { owner: enemyOwner, row: cryptid.row },
                        message: `💥 ${cryptid.name} destroys enemy trap!`
                    });
                } else if (!destroyed && typeof queueAbilityAnimation !== 'undefined') {
                    queueAbilityAnimation({
                        type: 'effect',
                        target: { owner: enemyOwner, row: cryptid.row },
                        message: `🛡️ Trap is protected!`
                    });
                }
            }
        }
    },
    
    onCombatAttack: (attacker, target, game) => {
        if (attacker.firstAttack) {
            attacker.firstAttack = false;
            return 3; // +3 bonus damage
        }
        return 0;
    },
    
    // SUPPORT: Combatant immune to traps/bursts
    onSupport: (cryptid, owner, game) => {
        const combatant = game.getCombatant(cryptid);
        if (combatant) {
            combatant.trapImmune = true;
            combatant.burstImmune = true;
        }
    }
});

// ==================== PUTRID SWAMP - PYRE CARDS ====================

// Gris-Gris Bag - Common
CardRegistry.registerPyre('grisGrisBag', {
    name: "Gris-Gris Bag",
    sprite: "👝",
    rarity: "common",
    description: "+1 pyre. Remove all curse tokens from one of your cryptids",
    pyreGain: 1,
    
    effect: (game, owner) => {
        if (owner === 'player') game.playerPyre++;
        else game.enemyPyre++;
        
        // Remove curse from random ally
        const field = owner === 'player' ? game.playerField : game.enemyField;
        const cursedAllies = [];
        for (let c = 0; c < 2; c++) {
            for (let r = 0; r < 3; r++) {
                const cryptid = field[c][r];
                if (cryptid && cryptid.curseTokens > 0) {
                    cursedAllies.push(cryptid);
                }
            }
        }
        
        if (cursedAllies.length > 0) {
            const target = cursedAllies[Math.floor(Math.random() * cursedAllies.length)];
            target.curseTokens = 0;
            GameEvents.emit('onCurseCleanse', { cryptid: target, owner, tokensRemaining: 0 });
        }
        
        GameEvents.emit('onPyreGained', { owner, amount: 1, source: 'Gris-Gris Bag' });
        return { pyreGained: 1 };
    }
});

// Swamp Gas - Uncommon
CardRegistry.registerPyre('swampGas', {
    name: "Swamp Gas",
    sprite: "💨",
    rarity: "uncommon",
    description: "+1 pyre, +1 per toxic tile on field (max +3 bonus)",
    pyreGain: 1,
    
    effect: (game, owner) => {
        let toxicCount = 0;
        
        // Count all toxic tiles
        for (const tileOwner of ['player', 'enemy']) {
            const toxicTiles = tileOwner === 'player' ? game.playerToxicTiles : game.enemyToxicTiles;
            for (let c = 0; c < 2; c++) {
                for (let r = 0; r < 3; r++) {
                    if (toxicTiles[c][r] > 0) toxicCount++;
                }
            }
        }
        
        const bonus = Math.min(toxicCount, 3);
        const totalPyre = 1 + bonus;
        
        if (owner === 'player') game.playerPyre += totalPyre;
        else game.enemyPyre += totalPyre;
        
        GameEvents.emit('onPyreGained', { owner, amount: totalPyre, source: 'Swamp Gas', toxicCount });
        return { pyreGained: totalPyre, toxicCount };
    }
});

// ==================== PUTRID SWAMP - BURST CARD ====================

// Hex Curse - Burst, Common, 2 Cost
CardRegistry.registerBurst('hexCurse', {
    name: "Hex Curse",
    sprite: "🔮",
    cost: 2,
    rarity: "common",
    targetType: 'enemy',
    description: "Apply 3 curse tokens to target enemy cryptid",
    
    effect: (game, owner, row, eventData) => {
        const target = eventData?.target;
        if (!target) return false;
        
        game.applyCurse(target, 3);
        GameEvents.emit('onHexCurse', { target, tokens: 3 });
        
        if (typeof queueAbilityAnimation !== 'undefined') {
            queueAbilityAnimation({
                type: 'debuff',
                target: target,
                message: `🔮 ${target.name} is hexed! (-3 ATK)`
            });
        }
        
        return true;
    }
});

// ==================== PUTRID SWAMP - TRAP CARD ====================

// Hungry Ground - Trap, Rare, 4 Cost
CardRegistry.registerTrap('hungryGround', {
    name: "Hungry Ground",
    sprite: "🕳️",
    cost: 4,
    rarity: "rare",
    triggerType: 'onEnemyDeath',
    description: "When enemy cryptid dies: Remove from game (not to discard). Gain 2 pyre",
    
    effect: (game, owner, row, eventData) => {
        const deadCryptid = eventData?.cryptid;
        if (!deadCryptid) return false;
        
        // Remove from discard (it was just added there)
        const enemyOwner = owner === 'player' ? 'enemy' : 'player';
        const discard = enemyOwner === 'player' ? game.playerDiscardPile : game.enemyDiscardPile;
        const idx = discard.findIndex(c => c.id === deadCryptid.id);
        if (idx > -1) {
            discard.splice(idx, 1);
        }
        
        // Gain pyre
        if (owner === 'player') game.playerPyre += 2;
        else game.enemyPyre += 2;
        
        GameEvents.emit('onHungryGround', { consumed: deadCryptid, owner });
        
        if (typeof queueAbilityAnimation !== 'undefined') {
            queueAbilityAnimation({
                type: 'damage',
                target: deadCryptid,
                message: `🕳️ The swamp consumes ${deadCryptid.name}!`
            });
        }
        
        return true;
    }
});

// ==================== PUTRID SWAMP - AURA CARD ====================

// Curse Vessel - Aura, Common, 1 Cost
CardRegistry.registerAura('curseVessel', {
    name: "Curse Vessel",
    sprite: "⚱️",
    cost: 1,
    rarity: "common",
    description: "+1 ATK per curse token on ALL enemies (max +4). Attacks apply 1 curse",
    atkBonus: 0,
    hpBonus: 0,
    
    onApply: (aura, cryptid, game) => {
        cryptid.attacksApplyCurse = (cryptid.attacksApplyCurse || 0) + 1;
        cryptid.hasCurseVessel = true;
    },
    
    onAttackBonus: (aura, attacker, target, game) => {
        // Count all curse tokens on enemies
        const enemyOwner = attacker.owner === 'player' ? 'enemy' : 'player';
        const enemyField = enemyOwner === 'player' ? game.playerField : game.enemyField;
        
        let totalCurse = 0;
        for (let c = 0; c < 2; c++) {
            for (let r = 0; r < 3; r++) {
                const enemy = enemyField[c][r];
                if (enemy && enemy.curseTokens > 0) {
                    totalCurse += enemy.curseTokens;
                }
            }
        }
        
        return Math.min(totalCurse, 4);
    }
});

// ==================== ATTACK HOOKS FOR CURSE APPLICATION ====================

// Add curse application to attack function
// This needs to be integrated into the main attack flow in system.js
// For now, we'll use the existing attacksApplyCurse flag

console.log("Putrid Swamp cards loaded:", 
    Object.keys(CardRegistry.cryptids).filter(k => 
        ['zombie', 'crawfishHorror', 'letiche', 'haint', 'ignisFatuus', 'plagueRat', 
         'swampHag', 'effigy', 'platEye', 'spiritFire', 'booHag', 'revenant', 'rougarou',
         'swampStalker', 'mamaBrigitte', 'loupGarou', 'draugrLord', 'baronSamedi', 'honeyIslandMonster']
        .includes(k)
    ).length, "cryptids |",
    Object.keys(CardRegistry.kindling || {}).filter(k => 
        ['feuFollet', 'swampRat', 'bayouSprite', 'voodooDoll', 'platEyePup'].includes(k)
    ).length, "kindling |",
    Object.keys(CardRegistry.pyres || {}).filter(k => 
        ['grisGrisBag', 'swampGas'].includes(k)
    ).length, "pyres |",
    Object.keys(CardRegistry.auras || {}).filter(k => 
        ['curseVessel'].includes(k)
    ).length, "auras |",
    Object.keys(CardRegistry.traps || {}).filter(k => 
        ['hungryGround'].includes(k)
    ).length, "traps |",
    Object.keys(CardRegistry.bursts || {}).filter(k => 
        ['hexCurse'].includes(k)
    ).length, "bursts"
);