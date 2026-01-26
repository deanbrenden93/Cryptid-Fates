/**
 * Cryptid Fates - City of Flesh Series
 * Card and Monster Definitions
 * 
 * This file defines all cryptids, instants, and kindling for the City of Flesh set.
 * Cards are registered to the global CardRegistry for use by the main game.
 */

// ==================== CARD REGISTRY ====================
window.CardRegistry = window.CardRegistry || {
    cryptids: {},
    bursts: {},      // Immediate effect spells
    kindling: {},
    traps: {},
    auras: {},
    pyres: {},
    
    registerCryptid(key, data) {
        this.cryptids[key] = { ...data, key, type: 'cryptid' };
    },
    
    registerBurst(key, data) {
        this.bursts[key] = { ...data, key, type: 'burst' };
    },
    
    // Alias for backward compatibility
    registerInstant(key, data) {
        this.registerBurst(key, data);
    },
    
    registerKindling(key, data) {
        this.kindling[key] = { ...data, key, type: 'cryptid', isKindling: true };
    },
    
    registerTrap(key, data) {
        this.traps[key] = { ...data, key, type: 'trap' };
    },
    
    registerAura(key, data) {
        this.auras[key] = { ...data, key, type: 'aura' };
    },
    
    registerPyre(key, data) {
        this.pyres[key] = { ...data, key, type: 'pyre', cost: 0 }; // Pyres are always free
    },
    
    getCryptid(key) {
        return this.cryptids[key] ? { ...this.cryptids[key] } : null;
    },
    
    getBurst(key) {
        return this.bursts[key] ? { ...this.bursts[key] } : null;
    },
    
    // Alias for backward compatibility
    getInstant(key) {
        return this.getBurst(key);
    },
    
    getKindling(key) {
        return this.kindling[key] ? { ...this.kindling[key] } : null;
    },
    
    getTrap(key) {
        return this.traps[key] ? { ...this.traps[key] } : null;
    },
    
    getAura(key) {
        return this.auras[key] ? { ...this.auras[key] } : null;
    },
    
    getPyre(key) {
        return this.pyres[key] ? { ...this.pyres[key] } : null;
    },
    
    getAllCryptidKeys() {
        return Object.keys(this.cryptids);
    },
    
    getAllBurstKeys() {
        return Object.keys(this.bursts);
    },
    
    // Alias for backward compatibility
    getAllInstantKeys() {
        return this.getAllBurstKeys();
    },
    
    getAllKindlingKeys() {
        return Object.keys(this.kindling);
    },
    
    getAllTrapKeys() {
        return Object.keys(this.traps);
    },
    
    getAllAuraKeys() {
        return Object.keys(this.auras);
    },
    
    getAllPyreKeys() {
        return Object.keys(this.pyres);
    }
};

// ==================== CITY OF FLESH - KINDLING ====================

// Hellpup - Kindling - Common - 1 ATK / 1HP - Blood - Evolves into Hellhound
CardRegistry.registerKindling('hellpup', {
    name: "Hellpup",
    sprite: "sprites/hellhound_pup.png",
    spriteScale: 1.0,
    element: "blood",
    cost: 0,
    hp: 1,
    atk: 1,
    rarity: "common",
    evolvesInto: 'hellhound',
    combatAbility: "Guard: Negate the first attack against Hellpup each turn. Burn the attacker.",
    supportAbility: "Combatant's attacks apply burn.",
    otherAbility: "If Hellpup would die from burn, evolve into Hellhound instead.",
    
    // COMBAT: Guard - negate first attack each turn, burn attacker
    onCombat: (cryptid, owner, game) => {
        cryptid.guardAvailable = true;
    },
    onTurnStart: (cryptid, owner, game) => {
        // Reset guard each turn if in combat
        const combatCol = game.getCombatCol(owner);
        if (cryptid.col === combatCol) {
            cryptid.guardAvailable = true;
        }
    },
    onBeforeDefend: (cryptid, attacker, game) => {
        if (cryptid.guardAvailable) {
            cryptid.guardAvailable = false;
            console.log('[Hellpup Guard] Triggered! Burning attacker and negating damage');
            // Burn the attacker
            game.applyBurn(attacker);
            // Negate the damage - this triggers the existing protection-block animation in game-ui.js
            cryptid.negateIncomingAttack = true;
            GameEvents.emit('onGuardUsed', { cryptid, attacker, owner: cryptid.owner });
        }
    },
    
    // SUPPORT: Combatant's attacks apply burn
    onSupport: (cryptid, owner, game) => {
        const combatant = game.getCombatant(cryptid);
        if (combatant) {
            combatant.attacksApplyBurn = true;
            combatant.hellpupSupport = cryptid;
        }
    },
    
    // OTHER: If dies from burn, evolve into Hellhound instead
    // IMPORTANT: Only triggers if killedBy === 'burn', NOT just from having burn while dying
    onDeath: (cryptid, game) => {
        if (cryptid.killedBy === 'burn') {
            const owner = cryptid.owner;
            // Look for Hellhound in hand or deck
            const hellhoundInHand = game.findCardInHand ? game.findCardInHand(owner, 'hellhound') : null;
            const hellhoundInDeck = game.findCardInDeck ? game.findCardInDeck(owner, 'hellhound') : null;
            
            if (hellhoundInHand || hellhoundInDeck) {
                cryptid.preventDeath = true;
                const hellhoundCard = hellhoundInHand || hellhoundInDeck;
                if (game.evolveInPlace) {
                game.evolveInPlace(cryptid, hellhoundCard, owner);
                }
                
                if (hellhoundInHand && game.removeFromHand) {
                    game.removeFromHand(owner, hellhoundInHand);
                } else if (hellhoundInDeck && game.removeFromDeck) {
                    game.removeFromDeck(owner, hellhoundInDeck);
                }
                
                GameEvents.emit('onBurnEvolution', { cryptid, evolvedInto: 'hellhound', owner });
            }
        }
    }
});

// Myling - Kindling - Common - 0 ATK / 3HP - Blood
CardRegistry.registerKindling('myling', {
    name: "Myling",
    sprite: "sprites/myling.png",
    spriteScale: 1.0,
    element: "blood",
    cost: 0,
    hp: 3,
    atk: 0,
    rarity: "common",
    combatAbility: "+1 damage to burning enemies.",
    supportAbility: "When combatant takes damage from an enemy attack, burn the attacker.",
    otherAbility: "When Myling dies, burn all cryptids in the enemy row across from it.",
    
    // COMBAT: +1 damage to burning enemies
    bonusVsBurning: 1,
    onCombatAttack: (attacker, target, game) => {
        if (target.burnTurns > 0) {
            return 1; // +1 bonus damage
        }
        return 0;
    },
    
    // SUPPORT: When combatant takes damage, burn the attacker (handled by game-core)
    onSupport: (cryptid, owner, game) => {
        const combatant = game.getCombatant(cryptid);
        if (combatant) {
            combatant.mylingSupport = cryptid;
            combatant.burnAttackersOnDamage = true;
        }
    },
    
    // OTHER: When Myling dies, burn all cryptids in enemy row across
    onDeath: (cryptid, game) => {
        const owner = cryptid.owner;
        const enemyOwner = owner === 'player' ? 'enemy' : 'player';
        const enemyField = enemyOwner === 'player' ? game.playerField : game.enemyField;
        const row = cryptid.row;
        
        // Burn both combat and support in that row
        for (let col = 0; col < 2; col++) {
            const enemy = enemyField[col][row];
            if (enemy) {
                game.applyBurn(enemy);
            }
        }
        
        GameEvents.emit('onMylingDeathBurn', { cryptid, row, owner });
    }
});

// Vampire Bat - Kindling - Common - 1 ATK / 2HP - Blood - Evolves into Vampire Initiate
CardRegistry.registerKindling('vampireBat', {
    name: "Vampire Bat",
    sprite: "🦇",
    spriteScale: 1.0,
    element: "blood",
    cost: 0,
    hp: 2,
    atk: 1,
    rarity: "common",
    evolvesInto: 'vampireInitiate',
    combatAbility: "Lifesteal: When Vampire Bat deals damage, heal that much HP.",
    supportAbility: "When combatant deals damage, gain 1 pyre.",
    
    // COMBAT: Lifesteal - heals for damage dealt (handled by game-core via hasLifesteal flag)
    hasLifesteal: true,
    
    // SUPPORT: When combatant deals damage, gain 1 pyre (handled by game-core)
    onSupport: (cryptid, owner, game) => {
        const combatant = game.getCombatant(cryptid);
        if (combatant) {
            combatant.vampireBatSupport = cryptid;
            combatant.grantPyreOnDamage = true;
        }
    }
});

// Gremlin - Kindling - Common - 1 ATK / 2HP - Steel
CardRegistry.registerKindling('gremlin', {
    name: "Gremlin",
    sprite: "👺",
    spriteScale: 1.0,
    element: "steel",
    cost: 0,
    hp: 2,
    atk: 1,
    rarity: "common",
    combatAbility: "Enemy combatant across has -1 ATK per ailment token. (Burn grants 3 tokens, paralysis grants 1, etc.)",
    supportAbility: "Ailmented enemies deal half damage when attacking combatant. Otherwise, combatant receives one fewer damage from attacks.",
    
    // COMBAT: Enemy combatant across has -1 ATK per ailment token (visible debuff)
    onCombat: (cryptid, owner, game) => {
        cryptid.appliesAilmentAtkDebuff = true;
        // Apply initial debuff to enemy across
        game.updateGremlinDebuff(cryptid);
    },
    
    // SUPPORT: Gremlin protection - half damage from ailmented, or -1 damage from non-ailmented
    onSupport: (cryptid, owner, game) => {
        cryptid.isGremlinSupport = true;
        const combatant = game.getCombatant(cryptid);
        if (combatant) {
            combatant.gremlinSupport = cryptid;
        }
    }
});

// Boggart - Kindling - Common - 2 ATK / 1HP - Steel - Evolves into Redcap
CardRegistry.registerKindling('boggart', {
    name: "Boggart",
    sprite: "sprites/boggart.png",
    spriteScale: 1.0,
    element: "steel",
    cost: 0,
    hp: 1,
    atk: 2,
    rarity: "common",
    evolvesInto: 'redcap',
    combatAbility: "Immune to ailments. When Boggart would gain an ailment, instead gain +1 ATK until end of your current or next turn.",
    supportAbility: "On enter: Cleanse all ailments from combatant and grant combatant +1 HP per unique ailment cleansed.",
    
    // COMBAT: Immune to ailments, gain ATK instead
    ailmentImmune: true,
    onAilmentAttempt: (cryptid, ailmentType, game) => {
        // Instead of gaining ailment, gain +1 ATK temporarily
        cryptid.currentAtk = (cryptid.currentAtk || cryptid.atk) + 1;
        cryptid.tempAtkBonus = (cryptid.tempAtkBonus || 0) + 1;
        cryptid.tempAtkExpiresTurn = (game.turnNumber || 0) + 1;
        
        GameEvents.emit('onAilmentImmunity', { 
            cryptid, 
            ailmentType, 
            atkGained: 1, 
            owner: cryptid.owner 
        });
        
        return false; // Prevent ailment application
    },
    
    // Clear temp ATK at appropriate turn
    onTurnStart: (cryptid, owner, game) => {
        if (cryptid.tempAtkBonus && game.turnNumber > cryptid.tempAtkExpiresTurn) {
            cryptid.currentAtk = (cryptid.currentAtk || cryptid.atk) - cryptid.tempAtkBonus;
            cryptid.tempAtkBonus = 0;
        }
    },
    
    // SUPPORT: On enter, cleanse combatant and grant +1 HP per unique ailment
    onSupport: (cryptid, owner, game) => {
        const combatant = game.getCombatant(cryptid);
        if (combatant) {
            let uniqueAilments = 0;
            
            // Check and clear each ailment type
            if (combatant.paralyzed || combatant.paralyzeTurns > 0) {
                combatant.paralyzed = false;
                combatant.paralyzeTurns = 0;
                uniqueAilments++;
            }
            if (combatant.burnTurns > 0) {
                combatant.burnTurns = 0;
                uniqueAilments++;
            }
            if (combatant.bleedTurns > 0) {
                combatant.bleedTurns = 0;
                uniqueAilments++;
            }
            if (combatant.calamityCounters > 0) {
                combatant.calamityCounters = 0;
                uniqueAilments++;
            }
            
            // Grant +1 HP per unique ailment cleansed
            if (uniqueAilments > 0) {
                combatant.currentHp = (combatant.currentHp || combatant.hp) + uniqueAilments;
                combatant.maxHp = (combatant.maxHp || combatant.hp) + uniqueAilments;
                
                GameEvents.emit('onBoggartCleanse', { 
                    boggart: cryptid, 
                    combatant, 
                    ailmentsCleansed: uniqueAilments, 
                    hpGranted: uniqueAilments,
                    owner 
                });
            }
        }
    }
});

// ==================== CITY OF FLESH - CRYPTIDS ====================

// Rooftop Gargoyle - Steel, Common, Cost 1 (evolves into Library Gargoyle)
CardRegistry.registerCryptid('rooftopGargoyle', {
    name: "Rooftop Gargoyle",
    sprite: "sprites/rooftop-gargoyle.png",
    spriteScale: 1.4,
    element: "steel",
    cost: 1,
    hp: 3,
    atk: 1,
    rarity: "common",
    evolvesInto: 'libraryGargoyle',
    combatAbility: "Stone Skin: Take 2 less damage from ailmented enemies.",
    supportAbility: "Guardian's Sacrifice: When combatant would take lethal damage from an enemy, survive with 1 HP. If enemy has ailment, regain full HP instead. One use only.",
    
    // Dynamic support ability text based on whether it's been used
    getSupportAbility: function(cryptid) {
        if (cryptid?.gargoyleSaveUsed) {
            return "Guardian's Sacrifice: [SPENT] - Ability has been used.";
        }
        return "Guardian's Sacrifice: When combatant would take lethal damage from an enemy, survive with 1 HP. If enemy has ailment, regain full HP instead. One use only.";
    },
    
    // COMBAT: Stone Skin - Take 2 less damage from ailmented enemies
    onDefend: (defender, attacker, game) => {
        if (game.hasStatusAilment(attacker)) {
            return 2; // Reduce damage by 2
        }
        return 0;
    },
    
    // SUPPORT: Lethal damage prevention for combatant
    onSupport: (cryptid, owner, game) => {
        const combatant = game.getCombatant(cryptid);
        if (combatant && !cryptid.gargoyleSaveUsed) {
            combatant.hasRooftopGargoyleSupport = true;
            combatant.rooftopGargoyleSupport = cryptid;
        }
    },
    
    // Clean up when leaving support (death or promotion)
    onDeath: (cryptid, game) => {
        // Clean up combatant reference if we were supporting
            const combatant = game.getCombatant(cryptid);
        if (combatant && combatant.rooftopGargoyleSupport === cryptid) {
            combatant.hasRooftopGargoyleSupport = false;
            combatant.rooftopGargoyleSupport = null;
        }
    },
    
    // When promoted to combat, clean up the support ability
    onCombat: (cryptid, owner, game) => {
        // If we were a support, find our old combatant (which is now dead/gone)
        // The flag should already be cleaned up by killCryptid flow
        cryptid.gargoyleSaveUsed = cryptid.gargoyleSaveUsed || false;
    }
});

// Gargoyle of the Grand Library - Uncommon - 3 ATK / 6HP - Steel - 5 Pyres - Evolves from Rooftop Gargoyle
CardRegistry.registerCryptid('libraryGargoyle', {
    name: "Gargoyle of the Grand Library",
    sprite: "sprites/library-gargoylealt2.png",
    spriteScale: 1.3,
    cardSpriteScale: 1.0,
    spriteFlip: true,
    element: "steel",
    cost: 5,
    hp: 6,
    atk: 3,
    rarity: "uncommon",
    evolvesFrom: 'rooftopGargoyle',
    combatAbility: "Stone Bastion: Take half damage from ailmented enemies (rounded down). When attacked by an ailmented enemy, draw a card.",
    supportAbility: "On becoming support, if any enemy has an ailment, grant +3 HP to combatant. When combatant kills an ailmented enemy, draw 2 cards.",
    otherAbility: "At turn start, if 2+ enemies are ailmented, gain 1 pyre.",
    
    // COMBAT: Stone Bastion - Take half damage from ailmented enemies
    // Note: This returns a multiplier for damage reduction, not a flat value
    // For "half damage rounded down", we need special handling
    onDefend: (defender, attacker, game) => {
        if (game.hasStatusAilment(attacker)) {
            // Mark for half damage processing (handled in attack function)
            defender.stoneBastion = true;
            return 0; // Actual reduction handled via stoneBastion flag
        }
        return 0;
    },
    
    // COMBAT: When attacked by ailmented enemy, draw a card (triggers after taking damage)
    onDamaged: (cryptid, attacker, damage, game) => {
        if (attacker && game.hasStatusAilment(attacker)) {
            // Draw a card for the gargoyle's owner
            const owner = cryptid.owner;
            if (owner === 'player') {
                game.drawCard('player');
                if (typeof queueAbilityAnimation !== 'undefined') {
                    queueAbilityAnimation({
                        type: 'draw',
                        target: cryptid,
                        message: `📚 ${cryptid.name} draws from ailmented attack!`
                    });
                }
            } else {
                game.drawCard('enemy');
            }
            GameEvents.emit('onGargoyleDrawFromDefense', { cryptid, attacker, owner });
        }
    },
    
    // SUPPORT: On becoming support, if any enemy has ailment, grant +3 HP to combatant.
    // When combatant kills an ailmented enemy, draw 2 cards.
    onSupport: (cryptid, owner, game) => {
        const combatant = game.getCombatant(cryptid);
        if (!combatant) return;
        
        // Mark support relationship
        combatant.hasLibraryGargoyleSupport = true;
        combatant.libraryGargoyleSupport = cryptid;
        
        // On becoming support: Check if any enemy has an ailment, grant +3 HP (one-time)
        if (!combatant.libraryGargoyleHpBuff) {
            const enemyField = owner === 'player' ? game.enemyField : game.playerField;
            let anyEnemyAilmented = false;
            for (let col = 0; col < 2; col++) {
                for (let row = 0; row < 3; row++) {
                    const enemy = enemyField[col]?.[row];
                    if (enemy && game.hasStatusAilment(enemy)) {
                        anyEnemyAilmented = true;
                        break;
                    }
                }
                if (anyEnemyAilmented) break;
            }
            
            if (anyEnemyAilmented) {
                combatant.currentHp = (combatant.currentHp || combatant.hp) + 3;
                combatant.maxHp = (combatant.maxHp || combatant.hp) + 3;
                combatant.libraryGargoyleHpBuff = true;
                
                if (typeof queueAbilityAnimation !== 'undefined') {
                    queueAbilityAnimation({
                        type: 'buff',
                        target: combatant,
                        message: `📚 ${cryptid.name} grants +3 HP!`
                    });
                }
            }
        }
        
        // Set up kill listener for drawing 2 cards (only once)
        if (!cryptid.libraryGargoyleKillListenerSet) {
            cryptid.libraryGargoyleKillListenerSet = true;
            
            const killListener = (data) => {
                // Check if this gargoyle is still in support position
                const myCombatant = game.getCombatant(cryptid);
                if (!myCombatant) return;
                
                const currentSupport = game.getSupport(myCombatant);
                if (currentSupport !== cryptid) return;
                
                // Check if the combatant (this gargoyle's combatant) made the kill
                // Compare by position since object references can be unreliable
                // Note: onKill uses "killer" and "victim", not "attacker" and "target"
                const killerMatches = data.killer && 
                    data.killer.owner === myCombatant.owner && 
                    data.killer.col === myCombatant.col && 
                    data.killer.row === myCombatant.row;
                
                if (!killerMatches) return;
                
                // Check if victim was ailmented
                const victimWasAilmented = data.victim && (
                    data.victim.burnTurns > 0 ||
                    data.victim.paralyzed ||
                    data.victim.bleedTurns > 0 ||
                    data.victim.calamityCounters > 0 ||
                    data.victim.curseTokens > 0
                );
                
                if (victimWasAilmented) {
                    // Draw 2 cards
                    const gargoyleOwner = cryptid.owner;
                    if (gargoyleOwner === 'player') {
                        game.drawCard('player');
                        game.drawCard('player');
                        if (typeof queueAbilityAnimation !== 'undefined') {
                            queueAbilityAnimation({
                                type: 'draw',
                                target: cryptid,
                                message: `📚 ${cryptid.name} grants 2 cards for ailmented kill!`
                            });
                        }
                    } else {
                        game.drawCard('enemy');
                        game.drawCard('enemy');
                    }
                    GameEvents.emit('onLibraryGargoyleSupportDraw', { support: cryptid, combatant: myCombatant, target: data.victim, owner: gargoyleOwner });
                }
            };
            
            GameEvents.on('onKill', killListener);
            cryptid.libraryGargoyleKillListener = killListener;
        }
    },
    
    // Clean up when leaving support
    onDeath: (cryptid, game) => {
        // Clean up kill listener
        if (cryptid.libraryGargoyleKillListener) {
            GameEvents.off('onKill', cryptid.libraryGargoyleKillListener);
            cryptid.libraryGargoyleKillListener = null;
            cryptid.libraryGargoyleKillListenerSet = false;
        }
        
        // Clean up combatant reference
        const combatant = game.getCombatant(cryptid);
        if (combatant && combatant.libraryGargoyleSupport === cryptid) {
            combatant.hasLibraryGargoyleSupport = false;
            combatant.libraryGargoyleSupport = null;
            // Note: HP buff stays even if support dies (it was granted while condition was met)
        }
    },
    
    // OTHER: At turn start, if 2+ enemies are ailmented, gain 1 pyre
    onTurnStart: (cryptid, owner, game) => {
        // Only trigger on the gargoyle owner's turn
        if (game.currentTurn !== owner) return;
        
        const enemyField = owner === 'player' ? game.enemyField : game.playerField;
        let ailmentedCount = 0;
        for (let col = 0; col < 2; col++) {
            for (let row = 0; row < 3; row++) {
                const enemy = enemyField[col]?.[row];
                if (enemy && game.hasStatusAilment(enemy)) {
                    ailmentedCount++;
                }
            }
        }
        
        if (ailmentedCount >= 2) {
            if (owner === 'player') {
                game.playerPyre = (game.playerPyre || 0) + 1;
            } else {
                game.enemyPyre = (game.enemyPyre || 0) + 1;
            }
            
            GameEvents.emit('onPyreGained', { 
                owner, 
                amount: 1, 
                source: `${cryptid.name}'s ailment mastery`,
                cryptid 
            });
            
            if (typeof queueAbilityAnimation !== 'undefined') {
                queueAbilityAnimation({
                    type: 'pyre',
                    target: cryptid,
                    message: `🔥 ${cryptid.name} gains pyre from ${ailmentedCount} ailmented enemies!`
                });
            }
        }
    },
    
    // When promoted to combat, clean up support mechanics
    onCombat: (cryptid, owner, game) => {
        // Clean up kill listener from support role
        if (cryptid.libraryGargoyleKillListener) {
            GameEvents.off('onKill', cryptid.libraryGargoyleKillListener);
            cryptid.libraryGargoyleKillListener = null;
            cryptid.libraryGargoyleKillListenerSet = false;
        }
    }
});

// Sewer Alligator - Uncommon - 2 ATK / 4HP - Water - 3 Pyres
CardRegistry.registerCryptid('sewerAlligator', {
    name: "Sewer Alligator",
    sprite: "🐊",
    spriteScale: 1.0,
    element: "water",
    cost: 3,
    hp: 4,
    atk: 2,
    rarity: "uncommon",
    combatAbility: "+2 damage to burned/toxic enemies. On bonus damage: regen 4HP, +1 ATK permanent",
    supportAbility: "Combatant regen 2HP on rest. On combatant death, enemy slot becomes toxic",
    // COMBAT: Extra damage to burned/toxic, regen and buff when dealing extra damage
    onCombatAttack: (attacker, target, game) => {
        const isBurned = target.burnTurns > 0;
        const isInToxic = game.isInToxicTile(target);
        
        if (isBurned || isInToxic) {
            // Regenerate 4HP
            const maxHp = attacker.maxHp || attacker.hp;
            attacker.currentHp = Math.min(maxHp, attacker.currentHp + 4);
            
            // Permanent +1 ATK
            attacker.currentAtk = (attacker.currentAtk || attacker.atk) + 1;
            attacker.baseAtk = (attacker.baseAtk || attacker.atk) + 1;
            
            GameEvents.emit('onSewerAlligatorBonus', { attacker, target, owner: attacker.owner });
            
            return 2; // +2 damage
        }
        return 0;
    },
    // SUPPORT: Combatant regen on rest, toxic slot on death
    onSupport: (cryptid, owner, game) => {
        cryptid.hasSewerAlligatorSupport = true;
    },
    // Hook into combatant resting
    onCombatantRest: (support, combatant, game) => {
        if (!support.hasSewerAlligatorSupport) return;
        const maxHp = combatant.maxHp || combatant.hp;
        combatant.currentHp = Math.min(maxHp, combatant.currentHp + 2);
        GameEvents.emit('onHeal', { cryptid: combatant, amount: 2, source: 'Sewer Alligator', owner: support.owner });
    },
    // Hook into combatant death
    onCombatantDeath: (support, combatant, game) => {
        if (!support.hasSewerAlligatorSupport) return;
        const owner = support.owner;
        const enemyOwner = owner === 'player' ? 'enemy' : 'player';
        const enemyCombatCol = game.getCombatCol(enemyOwner);
        
        // Make enemy slot across toxic (method is applyToxic, not applyToxicToTile)
        game.applyToxic(enemyOwner, enemyCombatCol, support.row);
    }
});

// Kuchisake-Onna - Blood, Rare, Mythical, Cost 4
CardRegistry.registerCryptid('kuchisakeOnna', {
    name: "Kuchisake-Onna",
    sprite: "👩",
    spriteScale: 1.0,
    element: "blood",
    cost: 4,
    hp: 7,
    atk: 5,
    rarity: "rare",
    mythical: true,
    combatAbility: "Slit: When targeting an enemy, applies Burn before attacking. If Kuchisake kills a burning enemy, it explodes dealing half its base HP (rounded down) to adjacent enemies.",
    supportAbility: "Am I Pretty?: May sacrifice combatant. If you do, Kuchisake becomes 9/7 and gains Destroyer.",
    otherAbility: "At the end of each turn, if Kuchisake has no enemy cryptids across from her, she gains Bleed.",
    
    // COMBAT: Applies Burn when targeting (before attack)
    onBeforeAttack: (attacker, target, game) => {
        // Apply Burn (3 stacks - standard burn)
        game.applyBurn(target);
        
        if (typeof queueAbilityAnimation !== 'undefined') {
            queueAbilityAnimation({
                type: 'debuff',
                target: target,
                message: `🔥 Slit: ${target.name} burns!`
            });
        }
    },
    
    // Flag for explosion on killing burning enemies - handled by attack() in game-core.js
    hasKuchisakeExplosion: true,
    
    // SUPPORT: Player may sacrifice combatant to become 9/7 with Destroyer
    onSupport: (cryptid, owner, game) => {
        cryptid.hasSacrificeAbility = true;
        cryptid.sacrificeAbilityAvailable = true;
    },
    
    // Called when player activates the sacrifice ability
    activateSacrifice: (cryptid, game) => {
        const combatant = game.getCombatant(cryptid);
        if (!combatant || !cryptid.sacrificeAbilityAvailable) return false;
        
        const owner = cryptid.owner;
        
        // Kill the combatant - this automatically promotes Kuchisake-Onna to combat
        combatant.killedBy = 'sacrifice';
        combatant.killedBySource = cryptid;
        game.killCryptid(combatant, cryptid.owner);
        
        // Buff Kuchisake-Onna to 9/7 with Destroyer
        cryptid.currentAtk = 9;
        cryptid.baseAtk = 9;
        cryptid.currentHp = 7;
        cryptid.maxHp = 7;
        cryptid.hasDestroyer = true;
        cryptid.sacrificeAbilityAvailable = false;
        cryptid.sacrificeActivated = true;
        
        GameEvents.emit('onSacrificeActivated', { 
            cryptid, 
            victim: combatant, 
            owner: cryptid.owner,
            atkGain: 9 - (cryptid.atk || 5),
            hpGain: 7 - (cryptid.hp || 7)
        });
        
        if (typeof queueAbilityAnimation !== 'undefined') {
            queueAbilityAnimation({
                type: 'buff',
                target: cryptid,
                message: `👩 Am I Pretty?: Kuchisake becomes 9/7 with Destroyer!`
            });
        }
        
        return true;
    },
    
    // OTHER: At end of turn, if no enemy across, gain Bleed
    onTurnEnd: (cryptid, owner, game) => {
        // Only check on owner's turn end
        if (game.currentTurn !== owner) return;
        
        // Check if in combat position
        const combatCol = game.getCombatCol(owner);
        if (cryptid.col !== combatCol) return;
        
        // Check for enemies across
        const enemiesAcross = game.getCryptidsAcross(cryptid);
        
        if (enemiesAcross.length === 0) {
            // No enemies across - Kuchisake bleeds herself
            game.applyBleed(cryptid);
            
            GameEvents.emit('onKuchisakeLonely', { cryptid, owner });
            
            if (typeof queueAbilityAnimation !== 'undefined') {
                queueAbilityAnimation({
                    type: 'debuff',
                    target: cryptid,
                    message: `👩 Kuchisake bleeds from loneliness...`
                });
            }
        }
    }
});

// Hellhound - Blood, Common, Cost 3 (evolves from Hellpup)
CardRegistry.registerCryptid('hellhound', {
    name: "Hellhound",
    sprite: "sprites/hellhound.png",
    spriteScale: 1.0,
    element: "blood",
    cost: 3,
    hp: 4,
    atk: 2,
    rarity: "common",
    evolvesFrom: 'hellpup',
    combatAbility: "When targeting an enemy to attack, burn the target. If already burning, also burn one random adjacent enemy.",
    supportAbility: "Combatant deals +2 damage to burning enemies. When combatant kills a burning enemy, spread burn to one adjacent enemy.",
    
    // COMBAT: Before attack, burn target. If already burned, burn random adjacent enemy
    onBeforeAttack: (attacker, target, game) => {
        const wasAlreadyBurned = target.burnTurns > 0;
        game.applyBurn(target);
        
        if (wasAlreadyBurned) {
            // Burn random adjacent enemy (above, below, or to side/behind)
            const adjacentTargets = game.getAdjacentCryptids(target);
            
            if (adjacentTargets.length > 0) {
                const randomTarget = adjacentTargets[Math.floor(Math.random() * adjacentTargets.length)];
                game.applyBurn(randomTarget);
                
                GameEvents.emit('onHellhoundSpreadBurn', { 
                    hellhound: attacker, 
                    originalTarget: target, 
                    burnedTarget: randomTarget,
                    source: 'combat',
                    owner: attacker.owner 
                });
            }
        }
    },
    
    // SUPPORT: Combatant deals +2 damage to burning enemies and spreads burn on kill
    onSupport: (cryptid, owner, game) => {
        const combatant = game.getCombatant(cryptid);
        if (combatant) {
            combatant.hellhoundSupport = cryptid;
            combatant.bonusVsBurning = (combatant.bonusVsBurning || 0) + 2;
        }
    },
    
    // Set up kill listener for burn spread (persistent while on field)
    onSummon: (cryptid, owner, game) => {
        // Listen for kills - spread burn when combatant kills burning enemy
        cryptid._unsubscribeKillBurnSpread = GameEvents.on('onKill', (data) => {
            // Check if our combatant killed a burning target
            const combatant = game.getCombatant(cryptid);
            if (!combatant) return;
            
            if (data.killer === combatant && data.victim?.burnTurns > 0) {
                console.log('[Hellhound Support] Combatant killed burning enemy - spreading burn');
                
                // Get adjacent enemies to the victim
                const adjacentTargets = game.getAdjacentCryptids(data.victim);
            
            if (adjacentTargets.length > 0) {
                const randomTarget = adjacentTargets[Math.floor(Math.random() * adjacentTargets.length)];
                game.applyBurn(randomTarget);
                    
                    // Visual feedback
                    if (typeof queueAbilityAnimation !== 'undefined') {
                        queueAbilityAnimation({
                            type: 'debuff',
                            target: randomTarget,
                            message: `🔥 Hellhound: Burn spreads to ${randomTarget.name}!`
                        });
                    }
                    
                    GameEvents.emit('onHellhoundSpreadBurn', { 
                        hellhound: cryptid, 
                        killer: combatant,
                        originalTarget: data.victim, 
                        burnedTarget: randomTarget,
                        source: 'support',
                        owner 
                    });
                }
            }
        });
    },
    
    // Clean up listener on death
    onDeath: (cryptid, game) => {
        if (cryptid._unsubscribeKillBurnSpread) {
            cryptid._unsubscribeKillBurnSpread();
            cryptid._unsubscribeKillBurnSpread = null;
        }
        
        // Clear support buff from combatant if we were supporting
        const combatant = game.getCombatant(cryptid);
        if (combatant && combatant.hellhoundSupport === cryptid) {
            combatant.bonusVsBurning = Math.max(0, (combatant.bonusVsBurning || 0) - 2);
            combatant.hellhoundSupport = null;
        }
    }
});

// Mothman - Steel, Ultimate, Mythical, Cost 5 (FLAGSHIP)
CardRegistry.registerCryptid('mothman', {
    name: "Mothman",
    sprite: "sprites/mothman.png",
    spriteScale: 1.5,
    element: "steel",
    cost: 5,
    hp: 9,
    atk: 6,
    rarity: "ultimate",
    mythical: true,
    combatAbility: "Flight. Harbinger: On enter, deal 1 damage to each enemy per ailment stack they have.",
    supportAbility: "Extinction of the Rotted: On enter, cleanse all your combatants and grant +1/+1 per stack cleansed. While here, your combatants are immune to ailments.",
    otherAbility: "When any ailmented enemy dies, Mothman gains +1/+1 permanently.",
    canTargetAny: true, // Flight
    
    // Helper: Calculate total ailment stacks on a cryptid
    // Each ailment type contributes its turn count/stack count (not just 1 if present)
    // e.g., paralyzed + 2 burn = 3 stacks; paralyzed + 3 bleed + 1 burn = 5 stacks
    getAilmentStacks: (target) => {
        if (!target) return 0;
        let stacks = 0;
        if (target.paralyzed) stacks += 1;
        if (target.burnTurns > 0) stacks += target.burnTurns;
        if (target.bleedTurns > 0) stacks += target.bleedTurns;
        if (target.calamityCounters > 0) stacks += target.calamityCounters;
        if (target.curseTokens > 0) stacks += target.curseTokens;
        return stacks;
    },
    
    // COMBAT: Harbinger - On entering combat, deal 1 damage per ailment stack to each enemy
    // ARCHITECTURE: Game logic executes SYNCHRONOUSLY, animations are handled separately by UI
    // This ensures multiplayer captures all events before sending the action
    onEnterCombat: (cryptid, owner, game) => {
        const enemyOwner = owner === 'player' ? 'enemy' : 'player';
        const enemyField = enemyOwner === 'player' ? game.playerField : game.enemyField;
        const enemyCombatCol = game.getCombatCol(enemyOwner);
        const enemySupportCol = game.getSupportCol(enemyOwner);
        
        const template = CardRegistry.getCryptid('mothman');
        const targets = [];
        const deaths = [];
        
        // Calculate and collect all targets (top to bottom, combat then support per row)
        for (let row = 0; row < 3; row++) {
            // Combat column first
            const combatant = enemyField[enemyCombatCol]?.[row];
            if (combatant) {
                const stacks = template.getAilmentStacks(combatant);
                if (stacks > 0) {
                    targets.push({ 
                        cryptid: combatant, 
                        damage: stacks, 
                        col: enemyCombatCol, 
                        row, 
                        owner: enemyOwner,
                        isCombatant: true
                    });
                }
            }
            
            // Support column second
            const support = enemyField[enemySupportCol]?.[row];
            if (support) {
                const stacks = template.getAilmentStacks(support);
                if (stacks > 0) {
                    targets.push({ 
                        cryptid: support, 
                        damage: stacks, 
                        col: enemySupportCol, 
                        row, 
                        owner: enemyOwner,
                        isCombatant: false
                    });
                }
            }
        }
        
        if (targets.length === 0) return;
        
        console.log('[Mothman] Harbinger: applying damage to', targets.length, 'targets');
        
        // PHASE 1: Apply ALL damage synchronously and emit events
        for (const target of targets) {
            const hpBefore = target.cryptid.currentHp || target.cryptid.hp;
            target.cryptid.currentHp = (target.cryptid.currentHp || target.cryptid.hp) - target.damage;
            
            // Emit damage event (captured for multiplayer)
            GameEvents.emit('onDamageTaken', {
                target: target.cryptid,
                damage: target.damage,
                source: cryptid,
                sourceType: 'harbinger',
                hpBefore,
                hpAfter: target.cryptid.currentHp
            });
            
            // Track deaths
            if (target.cryptid.currentHp <= 0) {
                target.cryptid.killedBy = 'harbinger';
                target.cryptid.killedBySource = cryptid;
                deaths.push(target);
            }
        }
        
        // PHASE 2: Process deaths synchronously (emit events, update state)
        for (const death of deaths) {
            // killCryptid handles: onDeath event, state removal, death counter, promotions queue
            game.killCryptid(death.cryptid, owner, { skipPromotion: true });
        }
        
        // PHASE 3: Queue promotions for any combatant deaths
        for (const death of deaths) {
            if (death.isCombatant) {
                const supportCol = game.getSupportCol(death.owner);
                const support = enemyField[supportCol]?.[death.row];
                if (support) {
                    if (!window.pendingPromotions) window.pendingPromotions = [];
                    window.pendingPromotions.push({ owner: death.owner, row: death.row });
                }
            }
        }
        
        // BUILD ANIMATION SEQUENCE for multiplayer sync
        if (window.AnimationSequence?.isBuilding && game.isMultiplayer) {
            const seq = window.AnimationSequence;
            
            // Message announcing harbinger
            seq.message(`🦋 Harbinger: Mothman deals damage based on ailment stacks!`, 800);
            seq.delay(200);
            
            // Simultaneous damage to all targets
            seq.damageMultiple(targets, { source: 'harbinger' });
            
            // Deaths one at a time with pauses
            if (deaths.length > 0) {
                seq.delay(300);
                seq.deathSequence(deaths, 'harbinger');
            }
            
            // Promotions
            for (const death of deaths) {
                if (death.isCombatant) {
                    seq.delay(200);
                    seq.promotion(death.owner, death.row);
                }
            }
        }
        
        // Store animation data for UI (visuals only - game state already changed)
        if (targets.length > 0) {
            window.pendingHarbingerAnimation = {
                mothman: cryptid,
                mothmanOwner: owner,
                targets: targets,
                deaths: deaths,
                enemyOwner: enemyOwner
            };
            console.log('[Mothman] Harbinger complete:', targets.length, 'damaged,', deaths.length, 'killed');
        }
    },
    
    // SUPPORT: Extinction of the Rotted
    // On entering support: cleanse all your combatants, grant +1/+1 per stack cleansed
    // While in support: your combatants are immune to ailments
    onSupport: (cryptid, owner, game) => {
        cryptid.grantsMothmanImmunity = true;
        
        const field = owner === 'player' ? game.playerField : game.enemyField;
        const combatCol = game.getCombatCol(owner);
        const template = CardRegistry.getCryptid('mothman');
        
        let totalStacksCleansed = 0;
        
        // Cleanse all friendly combatants and grant buffs
        for (let row = 0; row < 3; row++) {
            const combatant = field[combatCol]?.[row];
            if (combatant) {
                const stacks = template.getAilmentStacks(combatant);
                
                if (stacks > 0) {
                    // Cleanse all ailments
                    combatant.paralyzed = false;
                    combatant.burnTurns = 0;
                    combatant.bleedTurns = 0;
                    combatant.calamityCounters = 0;
                    combatant.curseTokens = 0;
                    
                    // Grant +1/+1 per stack
                    combatant.currentAtk = (combatant.currentAtk || combatant.atk) + stacks;
                    combatant.baseAtk = (combatant.baseAtk || combatant.atk) + stacks;
                    combatant.currentHp = (combatant.currentHp || combatant.hp) + stacks;
                    combatant.maxHp = (combatant.maxHp || combatant.hp) + stacks;
                    
                    totalStacksCleansed += stacks;
                    
                    GameEvents.emit('onExtinctionCleanse', { 
                        mothman: cryptid, 
                        target: combatant, 
                        stacksCleansed: stacks,
                        owner 
                    });
                }
                
                // Mark combatant as having Mothman immunity
                combatant.hasMothmanAilmentImmunity = true;
            }
        }
        
        if (totalStacksCleansed > 0) {
            if (typeof queueAbilityAnimation !== 'undefined') {
                queueAbilityAnimation({
                    type: 'buff',
                    target: cryptid,
                    message: `🦋 Extinction: Cleansed ${totalStacksCleansed} stacks!`
                });
            }
        }
    },
    
    // When Mothman leaves support (death or promotion), remove immunity from combatants
    onLeavingSupport: (cryptid, owner, game) => {
        const field = owner === 'player' ? game.playerField : game.enemyField;
        const combatCol = game.getCombatCol(owner);
        
        for (let row = 0; row < 3; row++) {
            const combatant = field[combatCol]?.[row];
            if (combatant) {
                combatant.hasMothmanAilmentImmunity = false;
            }
        }
    },
    
    // Set up death listener for Other ability on summon
    onSummon: (cryptid, owner, game) => {
        console.log('[Mothman] Setting up ailmented enemy death listener for', cryptid.name, 'owned by', owner);
        const template = CardRegistry.getCryptid('mothman');
        const enemyOwner = owner === 'player' ? 'enemy' : 'player';
        
        // Listen for any enemy death where the enemy had ailments
        cryptid._unsubscribeAilmentedDeath = GameEvents.on('onDeath', (data) => {
            // Check if the dead cryptid belonged to the enemy and had ailments
            if (data.owner === enemyOwner) {
                const deadCryptid = data.cryptid;
                const hadAilments = template.getAilmentStacks(deadCryptid) > 0 ||
                    deadCryptid.killedBy === 'burn' ||
                    deadCryptid.killedBy === 'calamity' ||
                    deadCryptid.killedBy === 'bleed' ||
                    deadCryptid.killedBy === 'harbinger';
                
                if (hadAilments) {
                    console.log('[Mothman] Ailmented enemy died! +1/+1');
                    
                    // Mothman gains +1/+1 permanently
                    cryptid.currentAtk = (cryptid.currentAtk || cryptid.atk) + 1;
                    cryptid.baseAtk = (cryptid.baseAtk || cryptid.atk) + 1;
                    cryptid.currentHp = (cryptid.currentHp || cryptid.hp) + 1;
                    cryptid.maxHp = (cryptid.maxHp || cryptid.hp) + 1;
                    
                    // Show visual feedback
                    if (typeof queueAbilityAnimation !== 'undefined') {
                        queueAbilityAnimation({
                            type: 'buff',
                            target: cryptid,
                            message: `🦋 Mothman: +1/+1 from ailmented death!`
                        });
                    }
                    
                    // Force render to show updated stats
                    if (typeof renderSprites === 'function') {
                        renderSprites();
                    }
                    
                    GameEvents.emit('onBuffApplied', { 
                        cryptid, 
                        owner: cryptid.owner, 
                        atkBonus: 1,
                        hpBonus: 1,
                        source: 'Mothman Ailmented Death'
                    });
                }
            }
        });
    },
    
    // Clean up listener on death
    onDeath: (cryptid, game) => {
        if (cryptid._unsubscribeAilmentedDeath) {
            cryptid._unsubscribeAilmentedDeath();
            cryptid._unsubscribeAilmentedDeath = null;
        }
        
        // Also clean up immunity if we were in support
        if (cryptid.grantsMothmanImmunity) {
            const owner = cryptid.owner;
            const field = owner === 'player' ? game.playerField : game.enemyField;
            const combatCol = game.getCombatCol(owner);
            
            for (let row = 0; row < 3; row++) {
                const combatant = field[combatCol]?.[row];
                if (combatant) {
                    combatant.hasMothmanAilmentImmunity = false;
                }
            }
        }
    },
    
    // When promoted to combat, clean up support mechanics
    onCombat: (cryptid, owner, game) => {
        // Remove immunity from combatants when Mothman leaves support
        if (cryptid.grantsMothmanImmunity) {
            cryptid.grantsMothmanImmunity = false;
            
            const field = owner === 'player' ? game.playerField : game.enemyField;
            const combatCol = game.getCombatCol(owner);
            
            for (let row = 0; row < 3; row++) {
                const combatant = field[combatCol]?.[row];
                if (combatant) {
                    combatant.hasMothmanAilmentImmunity = false;
                }
            }
        }
    }
});

// Bogeyman - Void, Common, Cost 2 (evolves from Shadow Person, may evolve into The Flayer)
CardRegistry.registerCryptid('bogeyman', {
    name: "Bogeyman",
    sprite: "👤",
    spriteScale: 1.0,
    element: "void",
    cost: 2,
    hp: 3,
    atk: 1,
    rarity: "common",
    evolvesFrom: 'shadowPerson',
    evolvesInto: 'theFlayer',
    combatAbility: "Terror: Paralyze enemies across on entering combat. +3 vs paralyzed",
    supportAbility: "Nightmare: Negate enemy support abilities across",
    // COMBAT: On entering combat, paralyze enemies across
    bonusVsParalyzed: 3,
    onEnterCombat: (cryptid, owner, game) => {
        const enemiesAcross = game.getCryptidsAcross(cryptid);
        for (const enemy of enemiesAcross) {
            game.applyParalyze(enemy);
        }
    },
    // SUPPORT: Negate enemy support abilities
    negatesEnemySupport: true
});

// The Flayer - Void, Rare, Mythical, Cost 5 (evolves from Bogeyman)
CardRegistry.registerCryptid('theFlayer', {
    name: "The Flayer",
    sprite: "👁️",
    spriteScale: 1.4,
    element: "void",
    cost: 5,
    hp: 6,
    atk: 4,
    rarity: "rare",
    mythical: true,
    evolvesFrom: 'bogeyman',
    combatAbility: "Mind Rend: Paralyze all enemy combatants on enter. Gain pyre + draw on paralyzed kill",
    supportAbility: "Psionic: Combatant gains focus, attacks cause paralysis",
    // COMBAT: On entering combat, paralyze all enemy combatants
    onEnterCombat: (cryptid, owner, game) => {
        const enemyOwner = owner === 'player' ? 'enemy' : 'player';
        const enemyField = enemyOwner === 'player' ? game.playerField : game.enemyField;
        const enemyCombatCol = game.getCombatCol(enemyOwner);
        
        for (let r = 0; r < 3; r++) {
            const enemy = enemyField[enemyCombatCol][r];
            if (enemy) {
                game.applyParalyze(enemy);
            }
        }
    },
    // COMBAT: Mark paralyzed targets before attacking so we can track at death time
    onBeforeAttack: (attacker, target, game) => {
        // Mark that this target was paralyzed when The Flayer attacked it
        if (target.paralyzed) {
            target._wasParalyzedByFlayerAttack = attacker;
        }
    },
    // Hook into death to grant rewards - check if target was paralyzed at death, not via prediction
    onSummon: (cryptid, owner, game) => {
        // Use the unsubscribe function returned by GameEvents.on() for clean cleanup
        cryptid._unsubscribeKillReward = GameEvents.on('onDeath', (data) => {
            // Check if The Flayer killed this cryptid AND it was paralyzed when attacked
            const victim = data.cryptid;
            if (victim?.killedBySource === cryptid && 
                (victim.paralyzed || victim._wasParalyzedByFlayerAttack === cryptid)) {
                console.log('[The Flayer] Killed paralyzed target! Granting pyre + draw');
                
                // Gain 1 pyre
                if (owner === 'player') game.playerPyre++;
                else game.enemyPyre++;
                
                // Play pyre gain animation from the VICTIM's position (where pyre is extracted from)
                // The victim sprite still exists during the death animation
                // Use skipBurningEffect to avoid interfering with death animation
                const victimSprite = document.querySelector(
                    `.cryptid-sprite[data-owner="${data.owner}"][data-col="${data.col}"][data-row="${data.row}"]`
                );
                if (window.CombatEffects?.playPyreBurn) {
                    window.CombatEffects.playPyreBurn(victimSprite, 1, { skipBurningEffect: true });
                }
                
                // Draw a card (will fail silently if hand is full, but pyre still granted)
                // The onCardDrawn event will trigger the card reveal animation automatically
                game.drawCard(owner, 'flayerKill');
                
                // Emit the event for logging/tracking
                GameEvents.emit('onPyreGained', { owner, amount: 1, source: 'The Flayer', sourceCryptid: victim });
                
                // Queue ability text notification
                if (typeof queueAbilityAnimation !== 'undefined') {
                    queueAbilityAnimation({
                        type: 'buff',
                        target: cryptid,
                        message: `👁️ The Flayer: +1 Pyre, Draw!`
                    });
                }
            }
        });
        
        // If summoned as support, immediately apply focus to combatant
        const supportCol = game.getSupportCol(owner);
        if (cryptid.col === supportCol) {
            const combatant = game.getCombatant(cryptid);
            if (combatant) {
                combatant.hasFocus = true;
                combatant.attacksApplyParalyze = true;
            }
        }
    },
    onDeath: (cryptid, game) => {
        if (cryptid._unsubscribeKillReward) {
            cryptid._unsubscribeKillReward();
            cryptid._unsubscribeKillReward = null;
        }
        // Clear focus from combatant when Flayer dies
        const combatant = game.getCombatant(cryptid);
        if (combatant) {
            combatant.hasFocus = false;
            combatant.attacksApplyParalyze = false;
        }
    },
    // SUPPORT: Combatant gains focus and attacks cause paralysis (refreshed each turn)
    onSupport: (cryptid, owner, game) => {
        const combatant = game.getCombatant(cryptid);
        if (combatant) {
            combatant.hasFocus = true;
            combatant.attacksApplyParalyze = true;
        }
    },
    grantsFocus: true
});

// Decay Rat - Steel, Uncommon, Cost 3 (Replaced Mutated Rat)
CardRegistry.registerCryptid('decayRat', {
    name: "Decay Rat",
    sprite: "🐀",
    spriteScale: 1.0,
    element: "steel",
    cost: 3,
    hp: 4,
    atk: 3,
    rarity: "uncommon",
    combatAbility: "Pestilence: When Decay Rat deals damage to an ailmented enemy, add 1 turn to each of their ailments.",
    supportAbility: "Once per turn, choose an ailmented enemy. It gets -1/-1 per ailment stack until end of turn.",
    
    // COMBAT: Pestilence - extend ailment durations when dealing damage to ailmented enemies
    onCombatAttack: (attacker, target, game) => {
        // Only trigger if target has at least one ailment
        if (!game.hasStatusAilment(target)) return 0;
        
        let ailmentsExtended = 0;
        
        // Extend burn duration
        if (target.burnTurns > 0) {
            target.burnTurns += 1;
            ailmentsExtended++;
        }
        
        // Extend bleed duration
        if (target.bleedTurns > 0) {
            target.bleedTurns += 1;
            ailmentsExtended++;
        }
        
        // Extend paralyze duration
        if (target.paralyzeTurns > 0) {
            target.paralyzeTurns += 1;
            ailmentsExtended++;
        }
        
        // Calamity doesn't have turns - add 1 counter instead
        if (target.calamityCounters > 0) {
            target.calamityCounters += 1;
            ailmentsExtended++;
        }
        
        // Curse tokens - add 1
        if (target.curseTokens > 0) {
            target.curseTokens += 1;
            ailmentsExtended++;
        }
        
        if (ailmentsExtended > 0) {
            GameEvents.emit('onPestilenceExtend', { 
                source: attacker, 
                target, 
                ailmentsExtended,
                owner: attacker.owner 
            });
            
            if (typeof queueAbilityAnimation !== 'undefined') {
                queueAbilityAnimation({
                    type: 'debuff',
                    target: target,
                    message: `🦠 Pestilence: +1 to ${ailmentsExtended} ailment(s)!`
                });
            }
        }
        
        return 0;
    },
    
    // SUPPORT: Setup for activatable ability
    onSupport: (cryptid, owner, game) => {
        cryptid.hasDecayRatAbility = true;
        cryptid.decayRatDebuffAvailable = true;
    },
    
    // Reset ability availability each turn
    onTurnStart: (cryptid, owner, game) => {
        const supportCol = game.getSupportCol(owner);
        if (cryptid.col === supportCol && cryptid.hasDecayRatAbility) {
            cryptid.decayRatDebuffAvailable = true;
        }
        
        // Clean up expired debuffs from previous turn
        // (the actual cleanup happens in endTurn, but this is a safety check)
    },
    
    // Called when player activates the decay ability
    // targetCol and targetRow specify which enemy to target (can be any ailmented enemy)
    activateDecayDebuff: (cryptid, game, targetCol, targetRow) => {
        if (!cryptid.decayRatDebuffAvailable) return false;
        
        const owner = cryptid.owner;
        
        // Find enemy cryptid at target position
        const enemyOwner = owner === 'player' ? 'enemy' : 'player';
        const enemyField = enemyOwner === 'player' ? game.playerField : game.enemyField;
        const targetEnemy = enemyField[targetCol]?.[targetRow];
        
        if (!targetEnemy) return false;
        
        // Check if target has any ailments
        if (!game.hasStatusAilment(targetEnemy)) return false;
        
        // Count ailment stacks
        let ailmentStacks = 0;
        if (targetEnemy.burnTurns > 0) ailmentStacks += targetEnemy.burnTurns;
        if (targetEnemy.bleedTurns > 0) ailmentStacks += targetEnemy.bleedTurns;
        if (targetEnemy.paralyzeTurns > 0) ailmentStacks += targetEnemy.paralyzeTurns;
        if (targetEnemy.calamityCounters > 0) ailmentStacks += targetEnemy.calamityCounters;
        if (targetEnemy.curseTokens > 0) ailmentStacks += targetEnemy.curseTokens;
        
        if (ailmentStacks <= 0) return false;
        
        // Mark ability as used
        cryptid.decayRatDebuffAvailable = false;
        
        // Apply -1/-1 per ailment stack (temporary until end of turn)
        targetEnemy.decayRatAtkDebuff = (targetEnemy.decayRatAtkDebuff || 0) + ailmentStacks;
        targetEnemy.decayRatHpDebuff = (targetEnemy.decayRatHpDebuff || 0) + ailmentStacks;
        
        const hpBefore = targetEnemy.currentHp || targetEnemy.hp;
        targetEnemy.currentHp = hpBefore - ailmentStacks;
        
        // Track that this is a temporary debuff (for end of turn cleanup)
        targetEnemy.hasDecayRatDebuff = true;
        targetEnemy.decayRatDebuffOwner = owner;
        
        GameEvents.emit('onDecayRatDebuff', { 
            source: cryptid, 
            target: targetEnemy, 
            debuffAmount: ailmentStacks,
            owner 
        });
        
        if (typeof queueAbilityAnimation !== 'undefined') {
            queueAbilityAnimation({
                type: 'debuff',
                target: targetEnemy,
                message: `🦠 Decay: -${ailmentStacks}/-${ailmentStacks}!`
            });
        }
        
        // Check if target dies from the HP reduction
        if (targetEnemy.currentHp <= 0) {
            GameEvents.emit('onKill', { 
                killer: cryptid, 
                victim: targetEnemy, 
                killerOwner: owner,
                victimOwner: enemyOwner,
                source: 'decayRatAbility'
            });
            
            GameEvents.emit('onDeath', { 
                cryptid: targetEnemy, 
                owner: enemyOwner, 
                killer: cryptid,
                killerOwner: owner,
                source: 'decayRatAbility'
            });
            
            // Remove from field
            enemyField[targetCol][targetRow] = null;
            
            if (typeof queueAbilityAnimation !== 'undefined') {
                queueAbilityAnimation({
                    type: 'death',
                    target: targetEnemy,
                    message: `💀 ${targetEnemy.name} decayed to death!`
                });
            }
        }
        
        return true;
    },
    
    // Clean up debuffs at end of turn
    onTurnEnd: (cryptid, owner, game) => {
        // Find all cryptids with decay rat debuffs and clean them up
        const cleanupDebuffs = (field) => {
            for (let col = 0; col < 2; col++) {
                for (let row = 0; row < 3; row++) {
                    const c = field[col]?.[row];
                    if (c && c.hasDecayRatDebuff && c.decayRatDebuffOwner === owner) {
                        // Restore HP (but don't exceed max)
                        const hpToRestore = c.decayRatHpDebuff || 0;
                        c.currentHp = Math.min(
                            (c.maxHp || c.hp),
                            (c.currentHp || c.hp) + hpToRestore
                        );
                        
                        // Clear debuff tracking
                        c.decayRatAtkDebuff = 0;
                        c.decayRatHpDebuff = 0;
                        c.hasDecayRatDebuff = false;
                        c.decayRatDebuffOwner = null;
                    }
                }
            }
        };
        
        cleanupDebuffs(game.playerField);
        cleanupDebuffs(game.enemyField);
    }
});

// Moleman - Steel, Common, Cost 2 (Cryptid #14)
CardRegistry.registerCryptid('moleman', {
    name: "Moleman",
    sprite: "🦡",
    spriteScale: 1.0,
    element: "steel",
    cost: 2,
    hp: 2,
    atk: 3,
    rarity: "common",
    combatAbility: "Burrow: May only attack combatant in Moleman's row, or any enemy support. +2 damage to ailmented targets.",
    supportAbility: "Combatant's attacks against enemy supports also deal half damage rounded down to the supports above and below the target.",
    
    // COMBAT: Custom targeting - Burrow restricts targets to same-row combatant OR any support
    // This is handled via the hasBurrowTargeting flag checked in getValidAttackTargets
    hasBurrowTargeting: true,
    
    // COMBAT: +2 damage to ailmented targets
    bonusVsAilment: 2,
    
    // SUPPORT: Combatant's attacks vs supports splash damage to adjacent supports
    onSupport: (cryptid, owner, game) => {
        const combatant = game.getCombatant(cryptid);
        if (combatant) {
            combatant.molemanSupport = cryptid;
            combatant.hasMolemanSplash = true;
        }
    },
    
    // Clean up support reference on death
    onDeath: (cryptid, game) => {
        const combatant = game.getCombatant(cryptid);
        if (combatant && combatant.molemanSupport === cryptid) {
            combatant.molemanSupport = null;
            combatant.hasMolemanSplash = false;
        }
    },
    
    // When promoted to combat, clean up support ability
    onCombat: (cryptid, owner, game) => {
        // No special combat enter effect needed beyond targeting
    }
});

// Vampire Initiate - Blood, Common, Cost 2 (evolves from Vampire Bat, into Vampire Lord)
CardRegistry.registerCryptid('vampireInitiate', {
    name: "Vampire Initiate",
    sprite: "sprites/vampire-initiate.png",
    spriteScale: 1.2,
    spriteFlip: false,
    element: "blood",
    cost: 2,
    hp: 3,
    atk: 2,
    rarity: "common",
    evolvesFrom: 'vampireBat',
    evolvesInto: 'vampireLord',
    combatAbility: "Siphon: Lifesteal. On attack, gain 1 pyre.",
    supportAbility: "Blood Pact: Once per turn, you may deal 1 damage to combatant to gain 1 pyre.",
    
    // COMBAT: Lifesteal + gain 1 pyre on attack
    hasLifesteal: true,
    onCombatAttack: (attacker, target, game) => {
        // Gain 1 pyre on attack
        if (attacker.owner === 'player') game.playerPyre++;
        else game.enemyPyre++;
        
        // Play pyre gain animation from attacker sprite (skipBurningEffect prevents sprite from fading)
        const vampSprite = document.querySelector(
            `.cryptid-sprite[data-owner="${attacker.owner}"][data-col="${attacker.col}"][data-row="${attacker.row}"]`
        );
        if (window.CombatEffects?.playPyreBurn) {
            window.CombatEffects.playPyreBurn(vampSprite, 1, { skipBurningEffect: true });
        }
        
        GameEvents.emit('onPyreGained', { owner: attacker.owner, amount: 1, source: 'Vampire Initiate', sourceCryptid: attacker });
        return 0; // No bonus damage
    },
    
    // SUPPORT: Activatable ability - deal 1 damage to combatant for 2 pyre
    onSupport: (cryptid, owner, game) => {
        cryptid.hasBloodPactAbility = true;
        cryptid.bloodPactAvailable = true;
    },
    
    // Reset Blood Pact availability each turn
    onTurnStart: (cryptid, owner, game) => {
        // Only reset if in support position
        const supportCol = game.getSupportCol(owner);
        if (cryptid.col === supportCol && cryptid.hasBloodPactAbility) {
            cryptid.bloodPactAvailable = true;
        }
    },
    
    // Called when player activates the blood pact ability
    activateBloodPact: (cryptid, game) => {
        const combatant = game.getCombatant(cryptid);
        if (!combatant || !cryptid.bloodPactAvailable) return false;
        
        const owner = cryptid.owner;
        const row = cryptid.row;
        const combatCol = game.getCombatCol(owner);
        
        // Mark ability as used immediately
        cryptid.bloodPactAvailable = false;
        
        // Deal 1 damage to combatant
        combatant.currentHp -= 1;
        
        // Gain 1 pyre
        if (owner === 'player') game.playerPyre += 1;
        else game.enemyPyre += 1;
        
        // Play pyre gain animation from Vampire Initiate sprite (skipBurningEffect prevents sprite from fading)
        const vampSprite = document.querySelector(
            `.cryptid-sprite[data-owner="${cryptid.owner}"][data-col="${cryptid.col}"][data-row="${cryptid.row}"]`
        );
        if (window.CombatEffects?.playPyreBurn) {
            window.CombatEffects.playPyreBurn(vampSprite, 1, { skipBurningEffect: true });
        }
        
        GameEvents.emit('onPyreGained', { owner, amount: 1, source: 'Blood Pact', sourceCryptid: cryptid });
        GameEvents.emit('onBloodPactActivated', { 
            cryptid, 
            victim: combatant, 
            pyreGained: 1,
            owner
        });
        
        // Check if combatant died using EFFECTIVE HP (includes support HP)
        const effectiveHp = game.getEffectiveHp(combatant);
        if (effectiveHp <= 0) {
            // Get the combatant sprite and add death animation
            const combatantSprite = document.querySelector(`.cryptid-sprite[data-owner="${owner}"][data-col="${combatCol}"][data-row="${row}"]`);
            if (combatantSprite) {
                combatantSprite.classList.add('dying-left');
            }
            
            // After death animation, kill combatant, promote, and animate promotion
            const TIMING = window.TIMING || { deathAnim: 400, promoteAnim: 600 };
            setTimeout(() => {
                combatant.killedBy = 'bloodPact';
                combatant.killedBySource = cryptid;
                game.killCryptid(combatant, owner);
                
                // Promote Vampire Initiate to combat position
                const promoted = game.promoteSupport(owner, row);
                
                // Trigger promotion animation
                if (promoted && typeof window.animateSupportPromotion === 'function') {
                    window.animateSupportPromotion(owner, row);
                }
            }, TIMING.deathAnim);
            
            return 'killed'; // Signal that death occurred
        }
        
        return true;
    }
});

// Redcap - Blood, Uncommon, Cost 3 (Cryptid #15, evolves from Boggart)
CardRegistry.registerCryptid('redcap', {
    name: "Redcap",
    sprite: "🧢",
    spriteScale: 1.0,
    element: "blood",
    cost: 3,
    hp: 2,
    atk: 5,
    rarity: "uncommon",
    evolvesFrom: 'boggart',
    combatAbility: "Lifesteal. Bloodlust: On attack, +1 damage for each ailmented cryptid on enemy's field.",
    supportAbility: "When combatant kills an enemy, grant combatant and Redcap +1 ATK. If the enemy was ailmented, also grant both +1 HP.",
    otherAbility: "If Redcap does not kill an enemy cryptid by the end of your turn, it has 1HP.",
    
    // COMBAT: Lifesteal
    hasLifesteal: true,
    
    // COMBAT: Bloodlust - +1 ATK per ailmented enemy on field (calculated dynamically)
    getBloodlustBonus: function(game, owner) {
        const enemyOwner = owner === 'player' ? 'enemy' : 'player';
        const enemyField = enemyOwner === 'player' ? game.playerField : game.enemyField;
        
        let ailmentedCount = 0;
        for (let col = 0; col < 2; col++) {
            for (let row = 0; row < 3; row++) {
                const enemy = enemyField[col]?.[row];
                if (enemy && game.hasStatusAilment(enemy)) {
                    ailmentedCount++;
                }
            }
        }
        return ailmentedCount;
    },
    
    // Bonus damage based on ailmented enemies
    onCombatAttack: (attacker, target, game) => {
        const template = CardRegistry.getCryptid('redcap');
        const bonus = template.getBloodlustBonus(game, attacker.owner);
        
        if (bonus > 0) {
            if (typeof queueAbilityAnimation !== 'undefined') {
                queueAbilityAnimation({
                    type: 'buff',
                    target: attacker,
                    message: `🧢 Bloodlust: +${bonus} ATK!`
                });
            }
        }
        
        return bonus;
    },
    
    // SUPPORT: When combatant kills, grant buffs
    onSupport: (cryptid, owner, game) => {
        const combatant = game.getCombatant(cryptid);
        if (combatant) {
            combatant.redcapSupport = cryptid;
        }
    },
    
    // Set up kill listener for support buff
    onSummon: (cryptid, owner, game) => {
        // Track if Redcap got a kill this turn (for OTHER ability)
        cryptid.gotKillThisTurn = false;
        
        // Listen for kills
        cryptid._unsubscribeRedcapKill = GameEvents.on('onKill', (data) => {
            // Check if Redcap made the kill (for OTHER ability tracking)
            if (data.killer === cryptid) {
                cryptid.gotKillThisTurn = true;
            }
            
            // Check if we're in support position and our combatant made the kill
            const supportCol = game.getSupportCol(owner);
            if (cryptid.col !== supportCol) return;
            
            const combatant = game.getCombatant(cryptid);
            if (!combatant) return;
            
            if (data.killer === combatant) {
                console.log('[Redcap Support] Combatant killed enemy - granting buffs');
                
                // Grant +1 ATK to both
                combatant.currentAtk = (combatant.currentAtk || combatant.atk) + 1;
                combatant.baseAtk = (combatant.baseAtk || combatant.atk) + 1;
                
                cryptid.currentAtk = (cryptid.currentAtk || cryptid.atk) + 1;
                cryptid.baseAtk = (cryptid.baseAtk || cryptid.atk) + 1;
                
                // Check if enemy was ailmented
                const victimWasAilmented = data.victim && (
                    data.victim.burnTurns > 0 ||
                    data.victim.paralyzed ||
                    data.victim.bleedTurns > 0 ||
                    data.victim.calamityCounters > 0 ||
                    data.victim.curseTokens > 0
                );
                
                if (victimWasAilmented) {
                    // Also grant +1 HP to both
                    combatant.currentHp = (combatant.currentHp || combatant.hp) + 1;
                    combatant.maxHp = (combatant.maxHp || combatant.hp) + 1;
                    
                    cryptid.currentHp = (cryptid.currentHp || cryptid.hp) + 1;
                    cryptid.maxHp = (cryptid.maxHp || cryptid.hp) + 1;
                    
                    if (typeof queueAbilityAnimation !== 'undefined') {
                        queueAbilityAnimation({
                            type: 'buff',
                            target: cryptid,
                            message: `🧢 Redcap: +1/+1 to both!`
                        });
                    }
                } else {
                    if (typeof queueAbilityAnimation !== 'undefined') {
                        queueAbilityAnimation({
                            type: 'buff',
                            target: cryptid,
                            message: `🧢 Redcap: +1 ATK to both!`
                        });
                    }
                }
                
                GameEvents.emit('onRedcapSupportBuff', { 
                    redcap: cryptid, 
                    combatant, 
                    victim: data.victim,
                    ailmented: victimWasAilmented,
                    owner 
                });
                
                // Force render to show updated stats
                if (typeof renderSprites === 'function') {
                    renderSprites();
                }
            }
        });
    },
    
    // Reset kill tracking at turn start
    onTurnStart: (cryptid, owner, game) => {
        if (game.currentTurn === owner) {
            cryptid.gotKillThisTurn = false;
        }
    },
    
    // OTHER: If Redcap didn't kill by end of turn, set HP to 1
    onTurnEnd: (cryptid, owner, game) => {
        // Only trigger on owner's turn end
        if (game.currentTurn !== owner) return;
        
        // Check if in combat position
        const combatCol = game.getCombatCol(owner);
        if (cryptid.col !== combatCol) return;
        
        // If Redcap didn't get a kill this turn, set HP to 1
        if (!cryptid.gotKillThisTurn) {
            const hpBefore = cryptid.currentHp || cryptid.hp;
            
            if (hpBefore > 1) {
                cryptid.currentHp = 1;
                
                GameEvents.emit('onRedcapHunger', { cryptid, hpLost: hpBefore - 1, owner });
                
                if (typeof queueAbilityAnimation !== 'undefined') {
                    queueAbilityAnimation({
                        type: 'debuff',
                        target: cryptid,
                        message: `🧢 Redcap's hunger: HP reduced to 1!`
                    });
                }
                
                // Force render
                if (typeof renderSprites === 'function') {
                    renderSprites();
                }
            }
        }
    },
    
    // Clean up listener on death
    onDeath: (cryptid, game) => {
        if (cryptid._unsubscribeRedcapKill) {
            cryptid._unsubscribeRedcapKill();
            cryptid._unsubscribeRedcapKill = null;
        }
        
        // Clear support reference from combatant if we were supporting
        const combatant = game.getCombatant(cryptid);
        if (combatant && combatant.redcapSupport === cryptid) {
            combatant.redcapSupport = null;
        }
    }
});

// Vampire Lord - Blood, Rare, Cost 4 (evolves from Vampire Initiate)
CardRegistry.registerCryptid('vampireLord', {
    name: "Vampire Lord",
    sprite: "sprites/vampire-lord.png",
    cardBg: "sprites/vampire-lord-bg.png",
    spriteScale: 1.6,
    spriteFlip: true,
    element: "blood",
    cost: 4,
    hp: 6,
    atk: 4,
    rarity: "rare",
    evolvesFrom: 'vampireInitiate',
    combatAbility: "Lifesteal. +3 damage to burning enemies. When Vampire Lord kills a burning enemy, gain pyre equal to their base cost.",
    supportAbility: "Combatant has Lifesteal and +2 damage to burning enemies. When combatant kills a burning enemy, draw a card.",
    
    // COMBAT: Lifesteal + bonus vs burning + pyre on burning kill
    hasLifesteal: true,
    bonusVsBurning: 3,
    
    // Track kills of burning enemies for pyre gain
    onKill: (cryptid, victim, game) => {
        // Only trigger if victim was burning
        if (victim.burnTurns > 0) {
            const pyreGain = victim.cost || 0;
            if (pyreGain > 0) {
                const owner = cryptid.owner;
                if (owner === 'player') game.playerPyre += pyreGain;
                else game.enemyPyre += pyreGain;
                
                // Play pyre gain animation (skipBurningEffect prevents sprite from fading)
                const vampSprite = document.querySelector(
                    `.cryptid-sprite[data-owner="${cryptid.owner}"][data-col="${cryptid.col}"][data-row="${cryptid.row}"]`
                );
                if (window.CombatEffects?.playPyreBurn) {
                    window.CombatEffects.playPyreBurn(vampSprite, pyreGain, { skipBurningEffect: true });
                }
                
                // Visual feedback
                if (typeof queueAbilityAnimation !== 'undefined') {
                    queueAbilityAnimation({
                        type: 'buff',
                        target: cryptid,
                        message: `🧛 Vampire Lord drains ${pyreGain} pyre from ${victim.name}!`
                    });
                }
                
                GameEvents.emit('onPyreGained', { 
                    owner, 
                    amount: pyreGain, 
                    source: 'Vampire Lord', 
                    sourceCryptid: cryptid,
                    victim: victim
                });
            }
        }
    },
    
    // SUPPORT: Grant combatant lifesteal + bonus vs burning + draw on burning kill
    onSupport: (cryptid, owner, game) => {
        const combatant = game.getCombatant(cryptid);
        if (combatant) {
            combatant.vampireLordSupport = cryptid;
            combatant.hasLifesteal = true;
            combatant.bonusVsBurning = (combatant.bonusVsBurning || 0) + 2;
        }
    },
    
    // Set up kill listener for draw on burning kill (persistent while on field)
    onSummon: (cryptid, owner, game) => {
        cryptid._unsubscribeVampireLordKill = GameEvents.on('onKill', (data) => {
            // Check if we're in support position
            const supportCol = game.getSupportCol(owner);
            if (cryptid.col !== supportCol) return;
            
            // Check if our combatant killed a burning target
            const combatant = game.getCombatant(cryptid);
            if (!combatant) return;
            
            if (data.killer === combatant && data.victim?.burnTurns > 0) {
                console.log('[Vampire Lord Support] Combatant killed burning enemy - drawing card');
                
                // Draw a card
                game.drawCard(owner, 'Vampire Lord');
                
                // Visual feedback
                if (typeof queueAbilityAnimation !== 'undefined') {
                    queueAbilityAnimation({
                        type: 'buff',
                        target: cryptid,
                        message: `🧛 Vampire Lord: Draw a card!`
                    });
                }
                
                GameEvents.emit('onVampireLordDraw', { 
                    vampireLord: cryptid, 
                    killer: combatant,
                    victim: data.victim, 
                    owner 
                });
            }
        });
    },
    
    // Clean up listener on death
    onDeath: (cryptid, game) => {
        if (cryptid._unsubscribeVampireLordKill) {
            cryptid._unsubscribeVampireLordKill();
            cryptid._unsubscribeVampireLordKill = null;
        }
        
        // Clear support buffs from combatant if we were supporting
        const combatant = game.getCombatant(cryptid);
        if (combatant && combatant.vampireLordSupport === cryptid) {
            combatant.hasLifesteal = false;
            combatant.bonusVsBurning = Math.max(0, (combatant.bonusVsBurning || 0) - 2);
            combatant.vampireLordSupport = null;
        }
    }
});

// ==================== CITY OF FLESH - TRAPS ====================

// Crossroads - Common, 3 Pyre
CardRegistry.registerTrap('crossroads', {
    name: "Crossroads",
    sprite: "✝️",
    cost: 3,
    rarity: "common",
    description: "Stop lethal attack, rest attacker, draw 2 cards (+1 if evolution)",
    triggerDescription: "Triggers: When enemy attack would kill your cryptid",
    triggerEvent: 'onAttackDeclared',
    triggerCondition: (trap, owner, eventData, game) => {
        // Only trigger if we're the defender and attack would kill
        if (eventData.attackerOwner === owner) return false;
        const target = eventData.target;
        if (!target || target.owner !== owner) return false;
        
        // Check if attack would kill
        const damage = game.calculateAttackDamage(eventData.attacker);
        const effectiveHp = game.getEffectiveHp(target);
        return effectiveHp <= damage;
    },
    effect: (game, owner, row, eventData) => {
        const attacker = eventData.attacker;
        
        // Rest the attacker without its attack going off
        attacker.tapped = true;
        attacker.canAttack = false;
        GameEvents.emit('onForceRest', { cryptid: attacker, owner: attacker.owner });
        
        // Cancel the attack
        eventData.cancelled = true;
        
        // Draw 2 cards
        game.drawCard(owner, 'crossroads');
        game.drawCard(owner, 'crossroads');
        
        // Check if either drawn card is a cryptid with evolution
        const hand = owner === 'player' ? game.playerHand : game.enemyHand;
        const lastTwo = hand.slice(-2);
        const hasEvolution = lastTwo.some(card => 
            card && (card.evolvesFrom || card.evolvesInto)
        );
        
        if (hasEvolution) {
            game.drawCard(owner, 'crossroads bonus');
        }
    }
});

// Blood Covenant - Rare, 2 Pyre
CardRegistry.registerTrap('bloodCovenant', {
    name: "Blood Covenant",
    sprite: "🩸",
    cost: 2,
    rarity: "rare",
    description: "Kill the attacker that killed your cryptid",
    triggerDescription: "Triggers: When your cryptid dies from enemy attack",
    triggerEvent: 'onDeath',
    triggerCondition: (trap, owner, eventData, game) => {
        // Get killedBySource from either explicit event data or from cryptid object
        const killedBySource = eventData.killedBySource || eventData.cryptid?.killedBySource;
        
        console.log('[Blood Covenant] Checking condition:', {
            trapOwner: owner,
            eventOwner: eventData.owner,
            cryptidName: eventData.cryptid?.name,
            killedBy: eventData.cryptid?.killedBy,
            killedBySource: killedBySource?.name || 'none',
            killedBySourceOwner: killedBySource?.owner || 'none'
        });
        // Check if it's our cryptid that died (trap owner matches dead cryptid owner)
        if (eventData.owner !== owner) {
            console.log('[Blood Covenant] FAILED: Dead cryptid owner', eventData.owner, '!== trap owner', owner);
            return false;
        }
        // Check if it was killed by an attacker (not burn, calamity, etc.)
        if (!killedBySource) {
            console.log('[Blood Covenant] FAILED: No killedBySource - cryptid was killed by burn/calamity/other');
            return false;
        }
        // The killer must belong to the enemy (not self-inflicted)
        const result = killedBySource.owner !== owner;
        console.log('[Blood Covenant] Final check: killer.owner', killedBySource.owner, '!== owner', owner, '=', result);
        return result;
    },
    effect: (game, owner, row, eventData) => {
        // Get killedBySource from either explicit event data or from cryptid object
        const killer = eventData.killedBySource || eventData.cryptid?.killedBySource;
        if (killer && killer.currentHp > 0) {
            // Store killer info before it's removed from game state
            const killerOwner = killer.owner;
            const killerCol = killer.col;
            const killerRow = killer.row;
            
            // STEP 1: Prepare death animation BEFORE killing (captures sprite while still in DOM)
            const deathData = window.CombatEffects?.prepareInstantKillDeath?.(killerOwner, killerCol, killerRow);
            
            // Kill immediately (removes from game state) 
            killer.killedBy = 'bloodCovenant';
            game.killCryptid(killer, owner);
            
            // STEP 2: Play lightning strike effect, then the prepared death animation
            if (window.CombatEffects?.strikeCryptid) {
                const targetPos = { owner: killerOwner, col: killerCol, row: killerRow };
                window.CombatEffects.strikeCryptid(targetPos, () => {
                    // After lightning: play the prepared death animation
                    window.CombatEffects.playPreparedDeath(deathData);
                });
            } else {
                // Fallback - just play death animation
                window.CombatEffects?.playPreparedDeath?.(deathData);
            }
        } else if (killer) {
            console.log('[Blood Covenant] Killer already dead (HP:', killer.currentHp, ')');
        }
    }
});

// Turn to Stone - Common, 1 Pyre
CardRegistry.registerTrap('turnToStone', {
    name: "Turn to Stone",
    sprite: "🪨",
    cost: 1,
    rarity: "common",
    description: "Stop attack, rest and paralyze attacker",
    triggerDescription: "Triggers: When your cryptid is targeted for attack",
    triggerEvent: 'onAttackDeclared',
    triggerCondition: (trap, owner, eventData, game) => {
        // Only trigger if we're the defender
        return eventData.attackerOwner !== owner && 
               eventData.target?.owner === owner;
    },
    effect: (game, owner, row, eventData) => {
        const attacker = eventData.attacker;
        
        // Rest the attacker
        attacker.tapped = true;
        attacker.canAttack = false;
        GameEvents.emit('onForceRest', { cryptid: attacker, owner: attacker.owner });
        
        // Paralyze the attacker
        game.applyParalyze(attacker);
        
        // Cancel the attack
        eventData.cancelled = true;
    }
});

// ==================== CITY OF FLESH - BURSTS ====================

// Waking Nightmare - Common, 1 Pyre
CardRegistry.registerBurst('wakingNightmare', {
    name: "Waking Nightmare",
    sprite: "😱",
    cost: 1,
    rarity: "common",
    description: "Untap ally OR tap enemy",
    targetType: 'any',
    effect: (game, owner, target) => {
        if (target.owner === owner) {
            // Untap ally
            target.tapped = false;
            target.canAttack = true;
            GameEvents.emit('onUntap', { cryptid: target, owner: target.owner, reason: 'wakingNightmare' });
        } else {
            // Tap enemy
            target.tapped = true;
            target.canAttack = false;
            GameEvents.emit('onForceRest', { cryptid: target, owner: target.owner });
        }
    }
});

// Face-Off - Common, 1 Pyre
CardRegistry.registerBurst('faceOff', {
    name: "Face-Off",
    sprite: "⚔️",
    cost: 1,
    rarity: "common",
    description: "Force target cryptid to attack the enemy combatant across from it",
    targetType: 'any',
    requiresEnemyAcross: true, // Must have enemy combatant across to target
    effect: (game, owner, target) => {
        const targetOwner = target.owner;
        const enemyOwner = targetOwner === 'player' ? 'enemy' : 'player';
        const enemyCombatCol = game.getCombatCol(enemyOwner);
        const enemyField = enemyOwner === 'player' ? game.playerField : game.enemyField;
        
        // Find enemy combatant across (always attacks the combatant, not support)
        const enemyAcross = enemyField[enemyCombatCol][target.row];
        
        if (enemyAcross) {
            // Force attack regardless of tap state
            target.tapped = false;
            target.canAttack = true;
            
            const targetRarity = enemyAcross.rarity || 'common';
            
            // Queue attack animation BEFORE attack executes (sprites auto-captured at queue time)
            if (typeof queueAbilityAnimation !== 'undefined') {
                queueAbilityAnimation({
                    type: 'attack',
                    source: target,
                    target: enemyAcross,
                    targetRarity: targetRarity,
                    message: `⚔️ ${target.name} faces off against ${enemyAcross.name}!`,
                    // These will be filled in after attack executes
                    _pendingAttack: { attacker: target, enemyOwner, enemyCombatCol, row: target.row }
                });
            }
            
            // Execute attack - result updates the queued animation
            const result = game.attack(target, enemyOwner, enemyCombatCol, target.row);
            
            // Update the queued animation with attack results
            if (window.abilityAnimationQueue?.length > 0) {
                const lastEffect = window.abilityAnimationQueue[window.abilityAnimationQueue.length - 1];
                if (lastEffect._pendingAttack) {
                    lastEffect.damage = result.damage || 0;
                    lastEffect.killed = result.killed || false;
                    delete lastEffect._pendingAttack;
                }
            }
        }
    }
});

// ==================== CITY OF FLESH - AURAS ====================

// Anti-Vampiric Blade - Common, 3 Pyre
CardRegistry.registerAura('antiVampiricBlade', {
    name: "Anti-Vampiric Blade",
    sprite: "🗡️",
    cost: 3,
    rarity: "common",
    description: "+2 ATK, regen 2HP/turn, focus. +2 ATK if enemy diagonal/across has ailment",
    atkBonus: 2,
    hpBonus: 0,
    grantsFocus: true,
    grantsRegeneration: 2,
    onApply: (aura, cryptid, game) => {
        // Grant focus
        cryptid.hasFocus = true;
        
        // Grant regeneration
        cryptid.regeneration = (cryptid.regeneration || 0) + 2;
        
        // Check for diagonal/across enemies with ailments for bonus ATK
        const owner = cryptid.owner;
        const enemyOwner = owner === 'player' ? 'enemy' : 'player';
        
        // Get enemies diagonal and across
        const diagonals = game.getDiagonalEnemies(cryptid);
        const across = game.getCryptidsAcross(cryptid);
        const nearbyEnemies = [...diagonals, ...across];
        
        const hasAilmentedEnemy = nearbyEnemies.some(e => game.hasStatusAilment(e));
        
        if (hasAilmentedEnemy) {
            cryptid.currentAtk += 2;
            aura.bonusAtkApplied = 2;
        }
    }
});

// ==================== CITY OF FLESH - PYRES ====================

// Pyre - Common (basic pyre card)
CardRegistry.registerPyre('pyre', {
    name: "Basic",
    sprite: "🔥",
    rarity: "common",
    description: "Gain 1 pyre",
    pyreGain: 1,
    infinite: true, // Always available, can't be incinerated, no copy limit
    effect: (game, owner) => {
        if (owner === 'player') game.playerPyre++;
        else game.enemyPyre++;
        GameEvents.emit('onPyreGained', { owner, amount: 1, source: 'Pyre card' });
        return { pyreGained: 1 };
    }
});

// Fresh Kill - Uncommon
CardRegistry.registerPyre('freshKill', {
    name: "Fresh Kill",
    sprite: "🦇",
    rarity: "uncommon",
    description: "+1 pyre, +1 per Vampire on field (max +3 extra)",
    pyreGain: 1,
    effect: (game, owner) => {
        const field = owner === 'player' ? game.playerField : game.enemyField;
        let vampireCount = 0;
        
        // Count vampires on field
        for (let c = 0; c < 2; c++) {
            for (let r = 0; r < 3; r++) {
                const cryptid = field[c][r];
                if (cryptid && cryptid.name && cryptid.name.toLowerCase().includes('vampire')) {
                    vampireCount++;
                }
            }
        }
        
        // Cap at 3 extra
        const bonusPyre = Math.min(vampireCount, 3);
        const totalPyre = 1 + bonusPyre;
        
        if (owner === 'player') game.playerPyre += totalPyre;
        else game.enemyPyre += totalPyre;
        
        GameEvents.emit('onPyreGained', { owner, amount: totalPyre, source: 'Fresh Kill', vampireCount });
        return { pyreGained: totalPyre, vampireCount };
    }
});

// Rat King - Ultimate
CardRegistry.registerPyre('ratKing', {
    name: "Rat King",
    sprite: "👑",
    rarity: "ultimate",
    description: "+1 pyre and draw 1 for each ally death last enemy turn (max 3)",
    pyreGain: 1,
    effect: (game, owner) => {
        // Count deaths from last enemy turn
        const deathCount = Math.min(game.deathsLastEnemyTurn?.[owner] || 0, 3);
        const totalPyre = 1 + deathCount;
        
        if (owner === 'player') game.playerPyre += totalPyre;
        else game.enemyPyre += totalPyre;
        
        // Draw cards for each death
        for (let i = 0; i < deathCount; i++) {
            game.drawCard(owner, 'ratKing');
        }
        
        GameEvents.emit('onPyreGained', { owner, amount: totalPyre, source: 'Rat King', deathCount });
        return { pyreGained: totalPyre, deathCount };
    }
});

// Nightfall - Uncommon
CardRegistry.registerPyre('nightfall', {
    name: "Nightfall",
    sprite: "🌙",
    rarity: "uncommon",
    description: "+1 pyre, +1 per Gargoyle on field (max +3 extra)",
    pyreGain: 1,
    effect: (game, owner) => {
        const field = owner === 'player' ? game.playerField : game.enemyField;
        let gargoyleCount = 0;
        
        // Count gargoyles on field
        for (let c = 0; c < 2; c++) {
            for (let r = 0; r < 3; r++) {
                const cryptid = field[c][r];
                if (cryptid && cryptid.name && cryptid.name.toLowerCase().includes('gargoyle')) {
                    gargoyleCount++;
                }
            }
        }
        
        // Cap at 3 extra
        const bonusPyre = Math.min(gargoyleCount, 3);
        const totalPyre = 1 + bonusPyre;
        
        if (owner === 'player') game.playerPyre += totalPyre;
        else game.enemyPyre += totalPyre;
        
        GameEvents.emit('onPyreGained', { owner, amount: totalPyre, source: 'Nightfall', gargoyleCount });
        return { pyreGained: totalPyre, gargoyleCount };
    }
});

// ==================== DECK BUILDING HELPERS ====================

/**
 * Creates a shuffled deck from card keys
 * @param {Object} config - Deck configuration
 * @returns {Array} Shuffled deck of card objects
 */
window.DeckBuilder = {
    // Default deck composition - 45 cards in deck + 10 kindling in separate pool = 55 total
    defaultDeckConfig: {
        cryptidCount: 15,
        basicPyreCount: 15,
        rarePyreCount: 5,
        otherInstanceCount: 10, // Split among bursts, traps, auras
        // Weights for rarity (higher = more common in deck)
        rarityWeights: {
            common: 4,
            uncommon: 3,
            rare: 2,
            ultimate: 1
        }
    },
    
    /**
     * Build a random deck using registered cards
     * Test deck: 45 cards in main deck
     * - 15 cryptids
     * - 15 basic pyres
     * - 5 rare pyres
     * - 10 other instances (bursts, traps, auras)
     * (Kindling are in separate pool, not main deck)
     */
    buildRandomDeck(config = {}) {
        const settings = { ...this.defaultDeckConfig, ...config };
        const deck = [];
        
        // Get all cryptid keys by rarity
        const cryptidsByRarity = { common: [], uncommon: [], rare: [], ultimate: [] };
        for (const key of CardRegistry.getAllCryptidKeys()) {
            const card = CardRegistry.getCryptid(key);
            if (card.rarity && cryptidsByRarity[card.rarity]) {
                cryptidsByRarity[card.rarity].push(key);
            } else {
                cryptidsByRarity.common.push(key);
            }
        }
        
        // Build weighted pool for cryptids
        const weightedPool = [];
        for (const [rarity, keys] of Object.entries(cryptidsByRarity)) {
            const weight = settings.rarityWeights[rarity] || 1;
            for (const key of keys) {
                for (let i = 0; i < weight; i++) {
                    weightedPool.push(key);
                }
            }
        }
        
        // Add cryptids (15)
        for (let i = 0; i < settings.cryptidCount; i++) {
            const key = weightedPool[Math.floor(Math.random() * weightedPool.length)];
            deck.push(CardRegistry.getCryptid(key));
        }
        
        // Note: Kindling are NOT added to main deck - they go in the separate kindling pool
        
        // Add basic pyres (15)
        for (let i = 0; i < settings.basicPyreCount; i++) {
            deck.push(CardRegistry.getPyre('pyre'));
        }
        
        // Add rare pyres (5) - any pyre that isn't basic pyre
        const pyreKeys = CardRegistry.getAllPyreKeys();
        const rarePyreKeys = pyreKeys.filter(k => k !== 'pyre');
        if (rarePyreKeys.length > 0) {
            for (let i = 0; i < settings.rarePyreCount; i++) {
                const key = rarePyreKeys[Math.floor(Math.random() * rarePyreKeys.length)];
                deck.push(CardRegistry.getPyre(key));
            }
        } else {
            // Fallback to basic if no rare pyres exist
            for (let i = 0; i < settings.rarePyreCount; i++) {
                deck.push(CardRegistry.getPyre('pyre'));
            }
        }
        
        // Add other instances (10) - split among bursts, traps, auras
        const burstKeys = CardRegistry.getAllBurstKeys();
        const trapKeys = CardRegistry.getAllTrapKeys();
        const auraKeys = CardRegistry.getAllAuraKeys();
        
        // Distribute roughly evenly, with slight preference for bursts
        const burstCount = Math.ceil(settings.otherInstanceCount * 0.4); // 4
        const trapCount = Math.floor(settings.otherInstanceCount * 0.3); // 3
        const auraCount = settings.otherInstanceCount - burstCount - trapCount; // 3
        
        for (let i = 0; i < burstCount && burstKeys.length > 0; i++) {
            const key = burstKeys[Math.floor(Math.random() * burstKeys.length)];
            deck.push(CardRegistry.getBurst(key));
        }
        
        for (let i = 0; i < trapCount && trapKeys.length > 0; i++) {
            const key = trapKeys[Math.floor(Math.random() * trapKeys.length)];
            deck.push(CardRegistry.getTrap(key));
        }
        
        for (let i = 0; i < auraCount && auraKeys.length > 0; i++) {
            const key = auraKeys[Math.floor(Math.random() * auraKeys.length)];
            deck.push(CardRegistry.getAura(key));
        }
        
        // Shuffle
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        
        console.log('Deck built:', {
            total: deck.length,
            cryptids: deck.filter(c => c.type === 'cryptid' && !c.isKindling).length,
            kindling: deck.filter(c => c.isKindling).length,
            pyres: deck.filter(c => c.type === 'pyre').length,
            bursts: deck.filter(c => c.type === 'burst').length,
            traps: deck.filter(c => c.type === 'trap').length,
            auras: deck.filter(c => c.type === 'aura').length
        });
        
        return deck;
    },
    
    /**
     * Build the kindling pool for a player
     * @returns {Array} Array of kindling cards
     */
    buildKindlingPool(deckCards = null) {
        const pool = [];
        let id = 1000;
        
        // If deckCards provided, extract kindling from it
        if (deckCards && Array.isArray(deckCards)) {
            for (const entry of deckCards) {
                const cardKey = entry.cardKey || entry.key;
                const template = CardRegistry.getKindling(cardKey);
                if (template) {
                    pool.push({ ...template, id: id++, isKindling: true });
                }
            }
            if (pool.length > 0) {
                console.log('[DeckBuilder] Built kindling pool from deck:', pool.map(k => k.name));
                return pool;
            }
        }
        
        // Default: Include ALL registered kindling (2 copies each)
        const allKindlingKeys = CardRegistry.getAllKindlingKeys();
        for (const key of allKindlingKeys) {
            const template = CardRegistry.getKindling(key);
            if (template) {
                // 2 copies of each
                pool.push({ ...template, id: id++, isKindling: true });
                pool.push({ ...template, id: id++, isKindling: true });
            }
        }
        
        console.log('[DeckBuilder] Built default kindling pool with', pool.length, 'cards from', allKindlingKeys.length, 'types');
        return pool;
    }
};

console.log('City of Flesh Series loaded:', {
    cryptids: CardRegistry.getAllCryptidKeys().length,
    bursts: CardRegistry.getAllBurstKeys().length,
    traps: CardRegistry.getAllTrapKeys().length,
    auras: CardRegistry.getAllAuraKeys().length,
    pyres: CardRegistry.getAllPyreKeys().length,
    kindling: CardRegistry.getAllKindlingKeys().length
});

// Signal that cards are ready
if (typeof window.onCardsReady === 'function') {
    window.onCardsReady();
} else {
    window.cardsLoaded = true;
}