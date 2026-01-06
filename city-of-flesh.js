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

// Myling - Kindling - Uncommon - 2 ATK / 2HP - Blood
CardRegistry.registerKindling('myling', {
    name: "Myling",
    sprite: "https://f.playcode.io/p-2633929/v-1/019b3c82-70d5-75fb-90eb-17ab504ae4b4/myling.png",
    spriteScale: 1.0,
    element: "blood",
    cost: 1,
    hp: 2,
    atk: 2,
    rarity: "uncommon",
    combatAbility: "Paralyze enemy cryptid upon damage",
    supportAbility: "Cleanse combatant ailments on summon, +1/+1 per ailment cleansed",
    // COMBAT: Paralyze enemy on damage - uses existing flag that's inside damage > 0 check
    attacksApplyParalyze: true,
    // SUPPORT: On summon, cleanse all status ailments from combatant, gain +1/+1 per ailment
    onSupport: (cryptid, owner, game) => {
        const combatant = game.getCombatant(cryptid);
        if (combatant) {
            let ailmentsCleared = 0;
            
            // Check and clear each ailment type
            if (combatant.paralyzed) {
                combatant.paralyzed = false;
                combatant.paralyzeTurns = 0;
                ailmentsCleared++;
            }
            if (combatant.burnTurns > 0) {
                combatant.burnTurns = 0;
                ailmentsCleared++;
            }
            if (combatant.bleedStacks > 0) {
                combatant.bleedStacks = 0;
                ailmentsCleared++;
            }
            if (combatant.calamityCounters > 0) {
                combatant.calamityCounters = 0;
                ailmentsCleared++;
            }
            
            // Grant Myling +1/+1 for each ailment cleared
            if (ailmentsCleared > 0) {
                cryptid.currentAtk = (cryptid.currentAtk || cryptid.atk) + ailmentsCleared;
                cryptid.currentHp = (cryptid.currentHp || cryptid.hp) + ailmentsCleared;
                cryptid.maxHp = (cryptid.maxHp || cryptid.hp) + ailmentsCleared;
                GameEvents.emit('onCleanse', { cryptid: combatant, cleansedBy: cryptid, ailmentsCleared, owner });
            }
        }
    }
});

// Shadow Person - Kindling - Common - 0 ATK / 3HP - Void
CardRegistry.registerKindling('shadowPerson', {
    name: "Shadow Person",
    sprite: "https://f.playcode.io/p-2633929/v-1/019b3c82-70d4-752c-8536-d27121bee17f/shadow-person.png",
    spriteScale: 1.0,
    element: "void",
    cost: 1,
    hp: 3,
    atk: 0,
    rarity: "common",
    evolvesInto: 'bogeyman',
    combatAbility: "Enemies who damage Shadow Person become paralyzed. +2 damage vs paralyzed",
    supportAbility: "Combatant doesn't tap after attacking. +1 damage to paralyzed",
    // COMBAT: Paralyze attackers when they deal damage, bonus vs paralyzed
    bonusVsParalyzed: 2,
    onTakeDamage: (cryptid, attacker, damage, game) => {
        // Only paralyze if actually took damage
        if (damage > 0 && attacker) {
            game.applyParalyze(attacker);
        }
    },
    // SUPPORT: Combatant doesn't tap, bonus vs paralyzed
    onSupport: (cryptid, owner, game) => {
        const combatant = game.getCombatant(cryptid);
        console.log('[Shadow Person] onSupport called, cryptid:', cryptid.name, 'row:', cryptid.row, 'combatant:', combatant?.name);
        if (combatant) {
            combatant.noTapOnAttack = true;
            combatant.bonusVsParalyzed = (combatant.bonusVsParalyzed || 0) + 1;
            console.log('[Shadow Person] Set noTapOnAttack=true on', combatant.name);
        }
    }
});

// Hellhound Pup - Kindling - Common - 1 ATK / 1HP - Blood - Evolves into Hellhound
CardRegistry.registerKindling('hellhoundPup', {
    name: "Hellhound Pup",
    sprite: "https://f.playcode.io/p-2633929/v-1/019b3c8a-ca9a-754c-948c-d92e7702a51e/hellhound_pup.png",
    spriteScale: 1.0,
    element: "blood",
    cost: 1,
    hp: 1,
    atk: 1,
    rarity: "common",
    evolvesInto: 'hellhound',
    combatAbility: "Protect from 1 attack/turn, burn attacker",
    supportAbility: "Regen combatant 2HP/turn if enemy has ailment",
    otherAbility: "If dies from burn, evolve into Hellhound",
    // COMBAT: Each turn, protect from 1 attack and burn the attacker
    onCombat: (cryptid, owner, game) => {
        cryptid.protectedFromAttack = true;
    },
    onTurnStart: (cryptid, owner, game) => {
        // Reset protection each turn
        const combatCol = game.getCombatCol(owner);
        if (cryptid.col === combatCol) {
            cryptid.protectedFromAttack = true;
        }
    },
    onBeforeDefend: (cryptid, attacker, game) => {
        if (cryptid.protectedFromAttack) {
            cryptid.protectedFromAttack = false;
            // Burn the attacker
            game.applyBurn(attacker);
            // Negate the damage
            cryptid.negateIncomingAttack = true;
            GameEvents.emit('onProtectionUsed', { cryptid, attacker, owner: cryptid.owner });
        }
    },
    // SUPPORT: Regen combatant 2HP if enemy across has ailment
    onSupport: (cryptid, owner, game) => {
        cryptid.hasHellhoundPupSupport = true;
    },
    // Check for regen at turn start (when support)
    onTurnStartSupport: (cryptid, owner, game) => {
        const combatant = game.getCombatant(cryptid);
        if (!combatant) return;
        
        // Check if any enemy across has ailment
        const enemiesAcross = game.getCryptidsAcross(cryptid);
        const hasAilmentedEnemy = enemiesAcross.some(e => game.hasStatusAilment(e));
        
        if (hasAilmentedEnemy) {
            const maxHp = combatant.maxHp || combatant.hp;
            combatant.currentHp = Math.min(maxHp, combatant.currentHp + 2);
            GameEvents.emit('onHeal', { cryptid: combatant, amount: 2, source: 'Hellhound Pup', owner });
        }
    },
    // BOTH: If dies from burn, evolve into Hellhound
    onDeath: (cryptid, game) => {
        if (cryptid.killedBy === 'burn' || cryptid.burnTurns > 0) {
            const owner = cryptid.owner;
            // Look for Hellhound in hand or deck
            const hellhoundInHand = game.findCardInHand(owner, 'hellhound');
            const hellhoundInDeck = game.findCardInDeck(owner, 'hellhound');
            
            if (hellhoundInHand || hellhoundInDeck) {
                cryptid.preventDeath = true;
                const hellhoundCard = hellhoundInHand || hellhoundInDeck;
                game.evolveInPlace(cryptid, hellhoundCard, owner);
                
                if (hellhoundInHand) {
                    game.removeFromHand(owner, hellhoundInHand);
                } else {
                    game.removeFromDeck(owner, hellhoundInDeck);
                }
                
                GameEvents.emit('onBurnEvolution', { cryptid, evolvedInto: 'hellhound', owner });
            }
        }
    }
});

// El Duende - Kindling - Common - 2 ATK / 1HP - Nature
CardRegistry.registerKindling('elDuende', {
    name: "El Duende",
    sprite: "🧝",
    spriteScale: 1.0,
    element: "nature",
    cost: 2,
    hp: 1,
    atk: 2,
    rarity: "common",
    combatAbility: "Remove 1 aura or protection from target before attack",
    supportAbility: "Trap cards cost -1 pyre for you, +1 for opponent",
    // COMBAT: Remove aura or protection before attack
    onBeforeAttack: (attacker, target, game) => {
        // Try to remove protection first
        if (target.protection > 0) {
            target.protection--;
            GameEvents.emit('onProtectionRemoved', { target, removedBy: attacker, owner: attacker.owner });
            return;
        }
        
        // Otherwise try to remove a random aura
        if (target.auras && target.auras.length > 0) {
            const randomIndex = Math.floor(Math.random() * target.auras.length);
            const removedAura = target.auras.splice(randomIndex, 1)[0];
            GameEvents.emit('onAuraRemoved', { target, aura: removedAura, removedBy: attacker, owner: attacker.owner });
        }
    },
    // SUPPORT: Modify trap costs
    onSupport: (cryptid, owner, game) => {
        // Mark owner as having trap cost reduction
        if (owner === 'player') {
            game.playerTrapCostReduction = (game.playerTrapCostReduction || 0) + 1;
            game.enemyTrapCostIncrease = (game.enemyTrapCostIncrease || 0) + 1;
        } else {
            game.enemyTrapCostReduction = (game.enemyTrapCostReduction || 0) + 1;
            game.playerTrapCostIncrease = (game.playerTrapCostIncrease || 0) + 1;
        }
        cryptid.hasElDuendeSupport = true;
    },
    onDeath: (cryptid, game) => {
        // Remove trap cost modification when El Duende dies
        if (cryptid.hasElDuendeSupport) {
            const owner = cryptid.owner;
            if (owner === 'player') {
                game.playerTrapCostReduction = Math.max(0, (game.playerTrapCostReduction || 0) - 1);
                game.enemyTrapCostIncrease = Math.max(0, (game.enemyTrapCostIncrease || 0) - 1);
            } else {
                game.enemyTrapCostReduction = Math.max(0, (game.enemyTrapCostReduction || 0) - 1);
                game.playerTrapCostIncrease = Math.max(0, (game.playerTrapCostIncrease || 0) - 1);
            }
        }
    }
});

// Boggart - Kindling - Common - 1 ATK / 2HP - Nature
CardRegistry.registerKindling('boggart', {
    name: "Boggart",
    sprite: "https://f.playcode.io/p-2633929/v-1/019b3c82-70d6-7466-97c0-72c148e812e2/boggart.png",
    spriteScale: 1.0,
    element: "nature",
    cost: 3,
    hp: 2,
    atk: 1,
    rarity: "common",
    combatAbility: "When damaging ailmented enemy, copy ailment to adjacent enemy",
    supportAbility: "Traps on same side of field can't be destroyed/negated",
    // COMBAT: Copy ailment to adjacent enemy when damaging ailmented target
    onCombatAttack: (attacker, target, game) => {
        // Check if target has any ailment
        const hasAilment = game.hasStatusAilment(target);
        if (!hasAilment) return 0;
        
        // Find adjacent enemies (above, below, behind)
        const adjacentTargets = [];
        const { owner: targetOwner, row: targetRow, col: targetCol } = target;
        const enemySupportCol = game.getSupportCol(targetOwner);
        
        // Above
        if (targetRow > 0) {
            const above = game.getFieldCryptid(targetOwner, targetCol, targetRow - 1);
            if (above) adjacentTargets.push(above);
        }
        // Below
        if (targetRow < 2) {
            const below = game.getFieldCryptid(targetOwner, targetCol, targetRow + 1);
            if (below) adjacentTargets.push(below);
        }
        // Behind (support)
        const behind = game.getFieldCryptid(targetOwner, enemySupportCol, targetRow);
        if (behind && behind !== target) adjacentTargets.push(behind);
        
        if (adjacentTargets.length > 0) {
            const randomTarget = adjacentTargets[Math.floor(Math.random() * adjacentTargets.length)];
            
            // Copy ailments
            if (target.paralyzed) game.applyParalyze(randomTarget);
            if (target.burnTurns > 0) game.applyBurn(randomTarget);
            if (target.bleedStacks > 0) game.applyBleed(randomTarget);
            if (target.calamityCounters > 0) game.applyCalamity(randomTarget, target.calamityCounters);
            
            GameEvents.emit('onAilmentSpread', { source: attacker, from: target, to: randomTarget, owner: attacker.owner });
        }
        return 0;
    },
    // SUPPORT: Protect traps on same side (top/bottom row)
    onSupport: (cryptid, owner, game) => {
        // Only works if Boggart is in top or bottom row, not center
        if (cryptid.row === 1) return; // Center row - no effect
        
        cryptid.protectsTraps = true;
        cryptid.protectedTrapSide = cryptid.row === 0 ? 'top' : 'bottom';
        
        // Mark traps on this side as protected
        const traps = owner === 'player' ? game.playerTraps : game.enemyTraps;
        if (cryptid.row === 0 && traps[0]) {
            traps[0].protected = true;
        } else if (cryptid.row === 2 && traps[2]) {
            traps[2].protected = true;
        }
    },
    onDeath: (cryptid, game) => {
        // Remove trap protection when Boggart dies
        if (cryptid.protectsTraps) {
            const owner = cryptid.owner;
            const traps = owner === 'player' ? game.playerTraps : game.enemyTraps;
            if (cryptid.row === 0 && traps[0]) {
                traps[0].protected = false;
            } else if (cryptid.row === 2 && traps[2]) {
                traps[2].protected = false;
            }
        }
    }
});

// ==================== CITY OF FLESH - CRYPTIDS ====================

// Rooftop Gargoyle - Steel, Common, Cost 1 (evolves into Library Gargoyle)
CardRegistry.registerCryptid('rooftopGargoyle', {
    name: "Rooftop Gargoyle",
    sprite: "https://f.playcode.io/p-2633929/v-1/019b3c82-70d4-73ef-8929-822739914541/rooftop-gargoyle.png",
    spriteScale: 1.4,
    element: "steel",
    cost: 1,
    hp: 3,
    atk: 1,
    rarity: "common",
    evolvesInto: 'libraryGargoyle',
    combatAbility: "Stone Skin: Ailment-afflicted attackers deal -2 damage. Removes 1 calamity from target before attacking.",
    supportAbility: "Vengeance: If combatant dies by enemy attack, give attacker 3 calamity",
    // COMBAT: Reduce damage from enemies with ailments, remove calamity before attacking
    onDefend: (defender, attacker, game) => {
        if (game.hasStatusAilment(attacker)) {
            return 2; // Reduce damage by 2
        }
        return 0;
    },
    onBeforeAttack: (attacker, target, game) => {
        // Remove 1 calamity from target before damage
        if (target.calamityCounters > 0) {
            target.calamityCounters -= 1;
            if (target.calamityCounters <= 0) {
                target.calamityCounters = 0;
                target.hadCalamity = false;
            }
        }
    },
    // SUPPORT: On combatant death, give attacker calamity
    onSummon: (cryptid, owner, game) => {
        // Use the unsubscribe function returned by GameEvents.on() for clean cleanup
        cryptid._unsubscribeVengeance = GameEvents.on('onDeath', (data) => {
            // Check if the dead cryptid was our combatant
            const combatant = game.getCombatant(cryptid);
            if (data.cryptid === combatant && data.killerOwner && data.killerOwner !== owner) {
                // Find the killer
                const killerOwner = data.killerOwner;
                const killerField = killerOwner === 'player' ? game.playerField : game.enemyField;
                const killerCombatCol = game.getCombatCol(killerOwner);
                
                // Give calamity to the attacker in same row
                const attacker = killerField[killerCombatCol][data.row];
                if (attacker) {
                    game.applyCalamity(attacker, 3);
                }
            }
        });
    },
    onDeath: (cryptid, game) => {
        if (cryptid._unsubscribeVengeance) {
            cryptid._unsubscribeVengeance();
            cryptid._unsubscribeVengeance = null;
        }
    }
});

// Library Gargoyle - Common - 2 ATK / 4HP - Steel - 3 Pyres - Evolves from Rooftop Gargoyle
CardRegistry.registerCryptid('libraryGargoyle', {
    name: "Library Gargoyle",
    sprite: "https://f.playcode.io/p-2633929/v-1/019b3d25-b581-7759-9bb3-53f15ec1cb37/library-gargoylealt2.png",
    spriteScale: 1.3,
    cardSpriteScale: 1.0,
    spriteFlip: true,
    element: "steel",
    cost: 3,
    hp: 4,
    atk: 2,
    rarity: "common",
    evolvesFrom: 'rooftopGargoyle',
    combatAbility: "When damaging calamity target: remove 1 counter, gain +1/+2",
    supportAbility: "If combatant diagonal from ailmented enemy: +2/+2",
    // COMBAT: Remove calamity, gain stats when damaging calamity target
    onCombatAttack: (attacker, target, game) => {
        if (target.calamityCounters > 0) {
            // Remove 1 calamity counter
            target.calamityCounters--;
            if (target.calamityCounters <= 0) {
                target.calamityCounters = 0;
                target.hadCalamity = false;
            }
            
            // Grant Library Gargoyle +1 ATK / +2 HP permanently
            attacker.currentAtk = (attacker.currentAtk || attacker.atk) + 1;
            attacker.baseAtk = (attacker.baseAtk || attacker.atk) + 1;
            attacker.currentHp = (attacker.currentHp || attacker.hp) + 2;
            attacker.maxHp = (attacker.maxHp || attacker.hp) + 2;
            
            GameEvents.emit('onCalamityConsume', { attacker, target, owner: attacker.owner });
        }
        return 0;
    },
    // SUPPORT: Check for diagonal enemies with ailments
    onSupport: (cryptid, owner, game) => {
        const combatant = game.getCombatant(cryptid);
        if (!combatant) return;
        
        // Get diagonal enemies
        const diagonals = game.getDiagonalEnemies(combatant);
        const hasAilmentedDiagonal = diagonals.some(e => game.hasStatusAilment(e));
        
        if (hasAilmentedDiagonal) {
            combatant.currentAtk = (combatant.currentAtk || combatant.atk) + 2;
            combatant.currentHp = (combatant.currentHp || combatant.hp) + 2;
            combatant.maxHp = (combatant.maxHp || combatant.hp) + 2;
            combatant.libraryGargoyleBuff = true;
            GameEvents.emit('onLibraryGargoyleBuff', { support: cryptid, combatant, owner });
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
    hp: 4,
    atk: 4,
    rarity: "rare",
    mythical: true,
    combatAbility: "Slit: Causes bleed. Extra attack if target has ailment",
    supportAbility: "Sacrifice: May kill combatant to become 7/7 with Destroyer",
    // COMBAT: Apply bleed on hit. If first target has status ailment, extra attack
    attacksApplyBleed: true,
    onCombatAttack: (attacker, target, game) => {
        // Check if this is the first attack this turn
        if (!attacker.attackedThisTurn && game.hasStatusAilment(target)) {
            attacker.canAttackAgain = true;
        }
        return 0;
    },
    // SUPPORT: Player may sacrifice combatant for +3/+3 and Destroyer
    // This is tracked via a special flag that the UI will check
    onSupport: (cryptid, owner, game) => {
        cryptid.hasSacrificeAbility = true;
        cryptid.sacrificeAbilityAvailable = true;
    },
    // Called when player activates the sacrifice ability
    activateSacrifice: (cryptid, game) => {
        const combatant = game.getCombatant(cryptid);
        if (!combatant || !cryptid.sacrificeAbilityAvailable) return false;
        
        const owner = cryptid.owner;
        const row = cryptid.row;
        
        // Kill the combatant
        combatant.killedBy = 'sacrifice';
        combatant.killedBySource = cryptid;
        game.killCryptid(combatant, cryptid.owner);
        
        // Promote Kuchisake-Onna to combat position
        const promoted = game.promoteSupport(owner, row);
        
        // Trigger promotion animation if available
        if (promoted && typeof window.animateSupportPromotion === 'function') {
            window.animateSupportPromotion(owner, row);
        }
        
        // Buff Kuchisake-Onna to 7/7 with Destroyer
        const atkGain = 7 - cryptid.currentAtk;
        const hpGain = 7 - cryptid.currentHp;
        
        cryptid.currentAtk = 7;
        cryptid.baseAtk = 7;
        cryptid.currentHp = 7;
        cryptid.maxHp = 7;
        cryptid.hasDestroyer = true;
        cryptid.sacrificeAbilityAvailable = false;
        cryptid.sacrificeActivated = true;
        
        GameEvents.emit('onSacrificeActivated', { 
            cryptid, 
            victim: combatant, 
            owner: cryptid.owner,
            atkGain, hpGain
        });
        
        return true;
    }
});

// Hellhound - Blood, Common, Cost 4 (evolves from Hellhound Pup)
CardRegistry.registerCryptid('hellhound', {
    name: "Hellhound",
    sprite: "https://f.playcode.io/p-2633929/v-1/019b56ab-36a2-73fd-91b6-e5445175ecdc/hellhound.png",
    spriteScale: 1.0,
    element: "blood",
    cost: 4,
    hp: 5,
    atk: 1,
    rarity: "common",
    evolvesFrom: 'hellhoundPup',
    combatAbility: "Inferno: Burns target before damage. If already burned, burn adjacent enemy",
    supportAbility: "Scorch: Combatant burns enemies across if they have no ailments",
    // COMBAT: Before damage, burn target. If already burned, burn random adjacent
    onBeforeAttack: (attacker, target, game) => {
        const wasAlreadyBurned = target.burnTurns > 0;
        game.applyBurn(target);
        
        if (wasAlreadyBurned) {
            // Burn random adjacent enemy (above, below, or behind)
            const adjacentTargets = [];
            const { owner: targetOwner, row: targetRow, col: targetCol } = target;
            const enemySupportCol = game.getSupportCol(targetOwner);
            
            // Above
            if (targetRow > 0) {
                const above = game.getFieldCryptid(targetOwner, targetCol, targetRow - 1);
                if (above) adjacentTargets.push(above);
            }
            // Below  
            if (targetRow < 2) {
                const below = game.getFieldCryptid(targetOwner, targetCol, targetRow + 1);
                if (below) adjacentTargets.push(below);
            }
            // Behind (support)
            const behind = game.getFieldCryptid(targetOwner, enemySupportCol, targetRow);
            if (behind && behind !== target) adjacentTargets.push(behind);
            
            if (adjacentTargets.length > 0) {
                const randomTarget = adjacentTargets[Math.floor(Math.random() * adjacentTargets.length)];
                game.applyBurn(randomTarget);
            }
        }
    },
    // SUPPORT: Before combatant attacks, if no enemy across has ailments, burn them
    onCombatantBeforeAttack: (support, combatant, target, game) => {
        const enemiesAcross = game.getCryptidsAcross(support);
        const anyHasAilment = enemiesAcross.some(e => game.hasStatusAilment(e));
        
        if (!anyHasAilment) {
            // Burn all enemies across
            for (const enemy of enemiesAcross) {
                game.applyBurn(enemy);
            }
        }
    }
});

// Mothman - Steel, Ultimate, Mythical, Cost 5 (FLAGSHIP)
CardRegistry.registerCryptid('mothman', {
    name: "Mothman",
    sprite: "https://f.playcode.io/p-2633929/v-1/019b56ab-247a-71ca-a81b-4d246f30d69d/mothman.png",
    spriteScale: 1.9,
    element: "steel",
    cost: 5,
    hp: 9,
    atk: 3,
    rarity: "ultimate",
    mythical: true,
    combatAbility: "Flight: Can attack any cryptid. On enter, 3 calamity to all enemy combatants",
    supportAbility: "Omen: Combatant attacks grant 3 calamity before damage",
    otherAbility: "Harbinger: +1 ATK whenever any cryptid dies by calamity",
    canTargetAny: true,
    // COMBAT: On entering combat, apply 3 calamity to all enemy combatants
    onEnterCombat: (cryptid, owner, game) => {
        const enemyOwner = owner === 'player' ? 'enemy' : 'player';
        const enemyField = enemyOwner === 'player' ? game.playerField : game.enemyField;
        const enemyCombatCol = game.getCombatCol(enemyOwner);
        
        // Apply 3 calamity to ALL enemy combatants
        for (let r = 0; r < 3; r++) {
            const enemy = enemyField[enemyCombatCol][r];
            if (enemy) {
                game.applyCalamity(enemy, 3);
            }
        }
    },
    // Set up calamity death listener on summon (regardless of position)
    onSummon: (cryptid, owner, game) => {
        console.log('[Mothman] Setting up Harbinger listener for', cryptid.name, 'owned by', owner);
        // Use the unsubscribe function returned by GameEvents.on() for clean cleanup
        cryptid._unsubscribeCalamityDeath = GameEvents.on('onDeath', (data) => {
            console.log('[Mothman] onDeath event received:', data.cryptid?.name, 'killedBy:', data.cryptid?.killedBy);
            // Check if the dead cryptid died from calamity
            if (data.cryptid?.killedBy === 'calamity') {
                console.log('[Mothman] Harbinger triggers! +1 ATK');
                // Mothman gains +1 ATK permanently
                cryptid.currentAtk = (cryptid.currentAtk || cryptid.atk) + 1;
                cryptid.baseAtk = (cryptid.baseAtk || cryptid.atk) + 1;
                
                // Show visual feedback
                if (typeof queueAbilityAnimation !== 'undefined') {
                    queueAbilityAnimation({
                        type: 'buff',
                        target: cryptid,
                        message: `🦋 Mothman Harbinger: +1 ATK!`
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
                    source: 'Mothman Harbinger'
                });
            }
        });
    },
    // SUPPORT: Combatant's attacks grant 3 calamity before damage
    onCombatantBeforeAttack: (support, combatant, target, game) => {
        game.applyCalamity(target, 3);
    },
    // Clean up listener on death
    onDeath: (cryptid, game) => {
        if (cryptid._unsubscribeCalamityDeath) {
            cryptid._unsubscribeCalamityDeath();
            cryptid._unsubscribeCalamityDeath = null;
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
    // COMBAT: Gain pyre and draw when killing paralyzed cryptid
    onCombatAttack: (attacker, target, game) => {
        if (target.paralyzed) {
            // Check if this attack will kill
            const damage = game.calculateAttackDamage(attacker);
            if (target.currentHp <= damage) {
                // Will kill - mark for reward
                attacker.rewardOnKill = true;
            }
        }
        return 0;
    },
    // Hook into death to grant rewards
    onSummon: (cryptid, owner, game) => {
        // Use the unsubscribe function returned by GameEvents.on() for clean cleanup
        cryptid._unsubscribeKillReward = GameEvents.on('onDeath', (data) => {
            if (data.cryptid?.killedBySource === cryptid && cryptid.rewardOnKill) {
                // Gain 1 pyre
                if (owner === 'player') game.playerPyre++;
                else game.enemyPyre++;
                // Draw a card
                game.drawCard(owner, 'flayerKill');
                cryptid.rewardOnKill = false;
                GameEvents.emit('onPyreGained', { owner, amount: 1, source: 'The Flayer' });
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

// Mutated Rat - Steel, Uncommon, Cost 4
CardRegistry.registerCryptid('mutatedRat', {
    name: "Mutated Rat",
    sprite: "🐀",
    spriteScale: 1.0,
    element: "steel",
    cost: 4,
    hp: 6,
    atk: 2,
    rarity: "uncommon",
    combatAbility: "Plague: On attack, apply 3 calamity. When attacked, attacker gets 3 calamity",
    supportAbility: "Infestation: When combatant or this card is attacked, attacker gets 3 calamity",
    // COMBAT: Apply calamity on attack and when attacked
    onCombatAttack: (attacker, target, game) => {
        game.applyCalamity(target, 3);
        return 0;
    },
    onTakeDamage: (defender, attacker, damage, game) => {
        if (attacker) {
            game.applyCalamity(attacker, 3);
        }
    },
    // SUPPORT: Set up retaliation for combatant and self
    onSupport: (cryptid, owner, game) => {
        const combatant = game.getCombatant(cryptid);
        if (combatant) {
            combatant.mutatedRatSupport = cryptid;
        }
        // Also set up self-retaliation
        cryptid.onTakeDamage = (defender, attacker, damage, game) => {
            if (attacker) {
                game.applyCalamity(attacker, 3);
            }
        };
    }
});

// Vampire Initiate - Blood, Common, Cost 1 (evolves into Elder Vampire)
CardRegistry.registerCryptid('vampireInitiate', {
    name: "Vampire Initiate",
    sprite: "https://f.playcode.io/p-2633929/v-1/019b56ab-b586-702d-96b4-fa0a1318f444/vampire-initiate.png",
    spriteScale: 1.45,
    element: "blood",
    cost: 1,
    hp: 3,
    atk: 1,
    rarity: "common",
    evolvesInto: 'elderVampire',
    combatAbility: "Siphon: On attack, regen 1HP and gain 1 pyre",
    supportAbility: "Blood Pact: Once per turn, deal 1 damage to combatant to gain 1 pyre",
    // COMBAT: After attack, heal 1HP and gain 1 pyre
    onCombatAttack: (attacker, target, game) => {
        // Heal 1 HP
        attacker.currentHp = Math.min(attacker.maxHp, attacker.currentHp + 1);
        // Gain 1 pyre
        if (attacker.owner === 'player') game.playerPyre++;
        else game.enemyPyre++;
        GameEvents.emit('onPyreGained', { owner: attacker.owner, amount: 1, source: 'Vampire Initiate Siphon' });
        return 0;
    },
    // SUPPORT: Activatable ability - deal 1 damage to combatant for 1 pyre
    onSupport: (cryptid, owner, game) => {
        cryptid.hasBloodPactAbility = true;
        cryptid.bloodPactAvailable = true;
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
        if (owner === 'player') game.playerPyre++;
        else game.enemyPyre++;
        
        GameEvents.emit('onBloodPactActivated', { 
            cryptid, 
            victim: combatant, 
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

// Elder Vampire - Blood, Rare, Cost 4 (evolves from Vampire Initiate) - REVISED
CardRegistry.registerCryptid('elderVampire', {
    name: "Elder Vampire",
    sprite: "https://f.playcode.io/p-2633929/v-1/019b3d39-5e70-731e-9b2e-5393265788c9/vampire-lord.png",
    spriteScale: 1.9,
    element: "blood",
    cost: 4,
    hp: 4,
    atk: 2,
    rarity: "rare",
    evolvesFrom: 'vampireInitiate',
    combatAbility: "Dominate: On enter, force all enemy combatants to tap. -1 ATK to tapped targets (min 1)",
    supportAbility: "Blood Frenzy: Combatant deals double damage to resting cryptids",
    otherAbility: "Undying: At turn start, regenerate 4HP and gain 1 pyre",
    // COMBAT: On entering combat, tap all enemy combatants. Reduce ATK of tapped targets
    onEnterCombat: (cryptid, owner, game) => {
        const enemyOwner = owner === 'player' ? 'enemy' : 'player';
        const enemyField = enemyOwner === 'player' ? game.playerField : game.enemyField;
        const enemyCombatCol = game.getCombatCol(enemyOwner);
        
        for (let r = 0; r < 3; r++) {
            const enemy = enemyField[enemyCombatCol][r];
            if (enemy) {
                enemy.tapped = true;
                enemy.canAttack = false;
                GameEvents.emit('onForceRest', { cryptid: enemy, owner: enemyOwner });
            }
        }
    },
    onCombatAttack: (attacker, target, game) => {
        // Reduce tapped target's ATK by 1 (minimum 1)
        if (target.tapped && target.currentAtk > 1) {
            target.currentAtk -= 1;
            target.baseAtk = Math.max(1, target.baseAtk - 1);
        }
        return 0;
    },
    // SUPPORT: Combatant deals double damage to resting (tapped) cryptids
    onSupport: (cryptid, owner, game) => {
        const combatant = game.getCombatant(cryptid);
        if (combatant) {
            combatant.doubleDamageVsTapped = true;
        }
    },
    // OTHER: At turn start, regenerate 4HP and gain 1 pyre
    onTurnStart: (cryptid, owner, game) => {
        // Regenerate 4HP
        const maxHp = cryptid.maxHp || cryptid.hp;
        cryptid.currentHp = Math.min(maxHp, cryptid.currentHp + 4);
        
        // Gain 1 pyre
        if (owner === 'player') game.playerPyre++;
        else game.enemyPyre++;
        
        GameEvents.emit('onPyreGained', { owner, amount: 1, source: 'Elder Vampire Undying' });
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
            killer.killedBy = 'bloodCovenant';
            game.killCryptid(killer, owner);
            
            // Visual feedback
            if (typeof EventFeedback !== 'undefined' && EventFeedback.showFloatingIndicator) {
                EventFeedback.showFloatingIndicator(killer, `🩸 Blood Covenant!`, '#dc143c');
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
            
            // Queue attack animation
            if (typeof queueAbilityAnimation !== 'undefined') {
                queueAbilityAnimation({
                    type: 'attack',
                    source: target,
                    target: enemyAcross,
                    message: `⚔️ ${target.name} faces off against ${enemyAcross.name}!`
                });
            }
            
            // Execute attack
            game.attack(target, enemyOwner, enemyCombatCol, target.row);
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