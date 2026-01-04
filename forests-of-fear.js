/**
 * Cryptid Fates - Forests of Fear Series
 * Card and Monster Definitions
 * 
 * THEME: Nature/forest creatures with defensive growth mechanics, 
 * conditional evolutions, and positional synergy. Rewards patience,
 * smart positioning, and transformation.
 * 
 * SYNERGIES:
 * - Growth through adversity (gain stats when attacked)
 * - Conditional/branching evolutions
 * - Position manipulation (swapping, column bonuses)
 * - Multi-element synergy (different bonuses per element)
 * - Sacrifice for power (Bigfoot, Wendigo death chain)
 * - Defensive pyre generation
 */

// ==================== FORESTS OF FEAR - KINDLING ====================

// Newborn Wendigo - Nature, Uncommon, Cost 1 (Kindling, evolves into Mature Wendigo)
CardRegistry.registerKindling('newbornWendigo', {
    name: "Newborn Wendigo",
    sprite: "🦌",
    spriteScale: 1.0,
    element: "nature",
    cost: 1,
    hp: 2,
    atk: 1,
    rarity: "uncommon",
    evolvesInto: 'matureWendigo',
    combatAbility: "Intimidate: Enemy combatants have -1 ATK (min 1)",
    supportAbility: "Nurture: Combatant gains +1/+1",
    
    // COMBAT: Reduce enemy combatant ATK by 1 (minimum 1)
    onCombat: (cryptid, owner, game) => {
        const enemyCombatant = game.getEnemyCombatantAcross(cryptid);
        if (enemyCombatant && !enemyCombatant.wendigoIntimidateApplied) {
            enemyCombatant.atkDebuff = (enemyCombatant.atkDebuff || 0) + 1;
            enemyCombatant.wendigoIntimidateApplied = true;
            // Ensure ATK doesn't drop below 1
            if (enemyCombatant.currentAtk - enemyCombatant.atkDebuff < 1) {
                enemyCombatant.atkDebuff = Math.max(0, enemyCombatant.currentAtk - 1);
            }
        }
    },
    
    // SUPPORT: Grant combatant +1/+1 (one-time, doesn't stack)
    onSupport: (cryptid, owner, game) => {
        const combatant = game.getCombatant(cryptid);
        if (combatant) {
            // Track which combatant we've buffed to prevent stacking
            const combatantId = combatant.id || `${combatant.key}-${combatant.col}-${combatant.row}`;
            if (cryptid._lastBuffedCombatant === combatantId) return; // Already buffed this one
            
            combatant.currentAtk = (combatant.currentAtk || combatant.atk) + 1;
            combatant.currentHp = (combatant.currentHp || combatant.hp) + 1;
            combatant.maxHp = (combatant.maxHp || combatant.hp) + 1;
            cryptid._lastBuffedCombatant = combatantId;
        }
    },
    
    // SPECIAL: If dies as 10th dead cryptid, evolve to Primal Wendigo and kill all enemy supports
    onDeath: (cryptid, game) => {
        const owner = cryptid.owner;
        const deathCount = owner === 'player' ? game.playerDeathCount : game.enemyDeathCount;
        
        // Check if this would be the 10th death
        if (deathCount === 9) { // About to become 10th
            // Look for Primal Wendigo in hand or deck
            const primalInHand = game.findCardInHand(owner, 'primalWendigo');
            const primalInDeck = game.findCardInDeck(owner, 'primalWendigo');
            
            if (primalInHand || primalInDeck) {
                // Prevent normal death, evolve instead
                cryptid.preventDeath = true;
                
                // Evolve directly into Primal Wendigo
                const primalCard = primalInHand || primalInDeck;
                game.evolveInPlace(cryptid, primalCard, owner);
                
                // Remove from hand/deck
                if (primalInHand) {
                    game.removeFromHand(owner, primalInHand);
                } else {
                    game.removeFromDeck(owner, primalInDeck);
                }
                
                // Kill all enemy supports
                const enemyField = owner === 'player' ? game.enemyField : game.playerField;
                const supportCol = 1; // Support column
                
                // Queue ascension animation
                if (typeof queueAbilityAnimation !== 'undefined') {
                    queueAbilityAnimation({
                        type: 'buff',
                        target: cryptid,
                        message: `💀 10th death! Primal Wendigo ascends!`
                    });
                }
                
                for (let row = 0; row < 3; row++) {
                    const support = enemyField[supportCol][row];
                    if (support) {
                        // Queue support death animation
                        if (typeof queueAbilityAnimation !== 'undefined') {
                            queueAbilityAnimation({
                                type: 'abilityDamage',
                                target: support,
                                message: `☠ ${support.name} perishes!`
                            });
                        }
                        
                        support.killedBy = 'primalWendigoAscension';
                        game.killCryptid(support, owner === 'player' ? 'enemy' : 'player');
                    }
                }
                
                GameEvents.emit('onPrimalWendigoAscension', { 
                    cryptid, 
                    owner,
                    supportsKilled: 3 
                });
            }
        }
    }
});

// Stormhawk - Nature, Common, Cost 1 (Kindling, evolves into Thunderbird)
CardRegistry.registerKindling('stormhawk', {
    name: "Stormhawk",
    sprite: "🦅",
    spriteScale: 1.0,
    element: "nature",
    cost: 1,
    hp: 2,
    atk: 1,
    rarity: "common",
    evolvesInto: 'thunderbird',
    hasFlight: true,
    combatAbility: "Lone Hunter: Flight. +1 ATK if only combatant on summon",
    supportAbility: "Thermal: Once/turn, swap with adjacent support & heal both 2 HP",
    
    // COMBAT: Flight is handled by hasFlight. Check if only combatant on summon
    onSummon: (cryptid, owner, game) => {
        const combatCol = game.getCombatCol(owner);
        if (cryptid.col === combatCol) { // Combat column
            const field = owner === 'player' ? game.playerField : game.enemyField;
            let combatantCount = 0;
            for (let row = 0; row < 3; row++) {
                if (field[combatCol][row]) combatantCount++;
            }
            // If this is the only combatant (just summoned)
            if (combatantCount === 1) {
                cryptid.currentAtk = (cryptid.currentAtk || cryptid.atk) + 1;
                GameEvents.emit('onLoneHunterBonus', { cryptid, owner });
            }
        }
    },
    
    // SUPPORT: Position swap ability (activated via button)
    onSupport: (cryptid, owner, game) => {
        cryptid.hasThermalAbility = true;
        cryptid.thermalAvailable = true;
    },
    
    // Called when player activates the thermal ability
    activateThermal: (cryptid, game, targetRow) => {
        if (!cryptid.thermalAvailable) return false;
        
        const owner = cryptid.owner;
        const field = owner === 'player' ? game.playerField : game.enemyField;
        const supportCol = 1;
        const currentRow = cryptid.row;
        
        // Validate target is adjacent (above or below)
        if (Math.abs(targetRow - currentRow) !== 1) return false;
        if (targetRow < 0 || targetRow > 2) return false;
        
        const targetSupport = field[supportCol][targetRow];
        if (!targetSupport) return false;
        
        // Swap positions
        field[supportCol][currentRow] = targetSupport;
        field[supportCol][targetRow] = cryptid;
        targetSupport.row = currentRow;
        cryptid.row = targetRow;
        
        // Heal both by 2 HP
        cryptid.currentHp = Math.min(cryptid.maxHp || cryptid.hp, (cryptid.currentHp || cryptid.hp) + 2);
        targetSupport.currentHp = Math.min(targetSupport.maxHp || targetSupport.hp, (targetSupport.currentHp || targetSupport.hp) + 2);
        
        cryptid.thermalAvailable = false;
        
        GameEvents.emit('onThermalSwap', { 
            cryptid, 
            target: targetSupport, 
            owner 
        });
        
        return true;
    },
    
    // Reset thermal at turn start
    onTurnStart: (cryptid, owner, game) => {
        if (cryptid.hasThermalAbility) {
            cryptid.thermalAvailable = true;
        }
    }
});

// Adolescent Bigfoot - Nature, Common, Cost 1 (Kindling, evolves into Bigfoot via sacrifice)
CardRegistry.registerKindling('adolescentBigfoot', {
    name: "Adolescent Bigfoot",
    sprite: "🦶",
    spriteScale: 1.0,
    element: "nature",
    cost: 1,
    hp: 3,
    atk: 0,
    rarity: "common",
    evolvesInto: 'adultBigfoot',
    requiresSacrificeToEvolve: true,
    combatAbility: "Rage: +1 ATK when attacked. May sacrifice 1 ATK to heal 2 HP",
    supportAbility: "Bulk: Combatant gains +2 HP",
    
    // COMBAT: Gain +1 ATK when taking damage
    onTakeDamage: (cryptid, attacker, damage, game) => {
        cryptid.currentAtk = (cryptid.currentAtk || cryptid.atk) + 1;
        GameEvents.emit('onRageStack', { cryptid, newAtk: cryptid.currentAtk });
    },
    
    // Setup sacrifice-for-heal ability
    onCombat: (cryptid, owner, game) => {
        cryptid.hasRageHealAbility = true;
        cryptid.rageHealAvailable = true;
    },
    
    // Activated ability: sacrifice 1 ATK to heal 2 HP
    activateRageHeal: (cryptid, game) => {
        if (!cryptid.rageHealAvailable) return false;
        if ((cryptid.currentAtk || cryptid.atk) < 1) return false;
        
        cryptid.currentAtk = (cryptid.currentAtk || cryptid.atk) - 1;
        cryptid.currentHp = Math.min(cryptid.maxHp || cryptid.hp, (cryptid.currentHp || cryptid.hp) + 2);
        cryptid.rageHealAvailable = false;
        
        GameEvents.emit('onRageHeal', { cryptid, owner: cryptid.owner });
        return true;
    },
    
    // Reset at turn start
    onTurnStart: (cryptid, owner, game) => {
        if (cryptid.hasRageHealAbility) {
            cryptid.rageHealAvailable = true;
        }
    },
    
    // SUPPORT: Grant combatant +2 HP (one-time, doesn't stack)
    onSupport: (cryptid, owner, game) => {
        const combatant = game.getCombatant(cryptid);
        if (combatant) {
            // Track which combatant we've buffed to prevent stacking
            const combatantId = combatant.id || `${combatant.key}-${combatant.col}-${combatant.row}`;
            if (cryptid._lastBuffedCombatant === combatantId) return; // Already buffed this one
            
            combatant.currentHp = (combatant.currentHp || combatant.hp) + 2;
            combatant.maxHp = (combatant.maxHp || combatant.hp) + 2;
            cryptid._lastBuffedCombatant = combatantId;
        }
    },
    
    // Custom evolution check - requires sacrificing a combatant
    canEvolve: (cryptid, game) => {
        // Check if player has another combatant to sacrifice
        const owner = cryptid.owner;
        const combatCol = game.getCombatCol(owner);
        const field = owner === 'player' ? game.playerField : game.enemyField;
        for (let row = 0; row < 3; row++) {
            const combatant = field[combatCol][row];
            if (combatant && combatant !== cryptid) {
                return true;
            }
        }
        return false;
    }
});

// Cursed Hybrid - Void, Common, Cost 1 (Kindling, conditional evolution)
CardRegistry.registerKindling('cursedHybrid', {
    name: "Cursed Hybrid",
    sprite: "🐺",
    spriteScale: 0.9,
    element: "void",
    cost: 1,
    hp: 1,
    atk: 1,
    rarity: "common",
    // Evolution is conditional - handled by custom logic
    combatAbility: "Adaptation: +2 ATK if support is blood/void, +2 HP if nature/water",
    supportAbility: "Curse: +1 damage if combatant is void/blood, heal 1/turn if nature/water",
    
    // Determine which evolution is available
    getEvolution: (cryptid) => {
        const atk = cryptid.currentAtk || cryptid.atk;
        const hp = cryptid.currentHp || cryptid.hp;
        if (atk > hp) return 'werewolf';
        if (hp > atk) return 'lycanthrope';
        return null; // Equal = cannot evolve
    },
    
    // COMBAT: On summon, check support element for buff
    onSummon: (cryptid, owner, game) => {
        const combatCol = game.getCombatCol(owner);
        const supportCol = game.getSupportCol(owner);
        if (cryptid.col === combatCol) { // Combat column
            const field = owner === 'player' ? game.playerField : game.enemyField;
            const support = field[supportCol][cryptid.row]; // Support behind this combatant
            
            if (support) {
                const element = support.element;
                if (element === 'blood' || element === 'void') {
                    cryptid.currentAtk = (cryptid.currentAtk || cryptid.atk) + 2;
                    GameEvents.emit('onHybridAdaptation', { cryptid, type: 'atk', element });
                } else if (element === 'nature' || element === 'water') {
                    cryptid.currentHp = (cryptid.currentHp || cryptid.hp) + 2;
                    cryptid.maxHp = (cryptid.maxHp || cryptid.hp) + 2;
                    GameEvents.emit('onHybridAdaptation', { cryptid, type: 'hp', element });
                }
            }
        }
    },
    
    // SUPPORT: Buff combatant based on combatant's element (one-time, doesn't stack)
    onSupport: (cryptid, owner, game) => {
        const combatant = game.getCombatant(cryptid);
        if (combatant) {
            // Track which combatant we've buffed to prevent stacking
            const combatantId = combatant.id || `${combatant.key}-${combatant.col}-${combatant.row}`;
            if (cryptid._lastBuffedCombatant === combatantId) return; // Already buffed this one
            
            const element = combatant.element;
            if (element === 'blood' || element === 'void') {
                combatant.bonusDamage = (combatant.bonusDamage || 0) + 1;
                cryptid.curseType = 'damage';
            } else if (element === 'nature' || element === 'water') {
                combatant.curseHealing = true;
                cryptid.curseType = 'healing';
            }
            cryptid._lastBuffedCombatant = combatantId;
        }
    },
    
    // Handle healing at turn start for nature/water curse
    onTurnStart: (cryptid, owner, game) => {
        const supportCol = game.getSupportCol(owner);
        if (cryptid.col === supportCol && cryptid.curseType === 'healing') {
            const combatant = game.getCombatant(cryptid);
            if (combatant && combatant.curseHealing) {
                combatant.currentHp = Math.min(
                    combatant.maxHp || combatant.hp,
                    (combatant.currentHp || combatant.hp) + 1
                );
                GameEvents.emit('onCurseHeal', { combatant, owner });
            }
        }
    }
});

// Deer Woman - Nature, Common, Cost 1 (Kindling, no evolution)
CardRegistry.registerKindling('deerWoman', {
    name: "Deer Woman",
    sprite: "🦌",
    spriteScale: 1.0,
    element: "nature",
    cost: 1,
    hp: 3,
    atk: 0,
    rarity: "common",
    combatAbility: "Grace: On summon, adjacent combatants gain +1 ATK. +1 ATK if both buffed",
    supportAbility: "Offering: Gain 1 pyre when Deer Woman or combatant is attacked",
    
    // COMBAT: On summon, buff adjacent combatants in column
    onSummon: (cryptid, owner, game) => {
        const combatCol = game.getCombatCol(owner);
        if (cryptid.col === combatCol) { // Combat column
            const field = owner === 'player' ? game.playerField : game.enemyField;
            const row = cryptid.row;
            let buffCount = 0;
            
            // Check above
            if (row > 0 && field[combatCol][row - 1]) {
                const above = field[combatCol][row - 1];
                above.currentAtk = (above.currentAtk || above.atk) + 1;
                buffCount++;
                GameEvents.emit('onGraceBuff', { target: above, owner });
            }
            
            // Check below
            if (row < 2 && field[combatCol][row + 1]) {
                const below = field[combatCol][row + 1];
                below.currentAtk = (below.currentAtk || below.atk) + 1;
                buffCount++;
                GameEvents.emit('onGraceBuff', { target: below, owner });
            }
            
            // If buffed 2 cryptids, Deer Woman gets +1 ATK
            if (buffCount >= 2) {
                cryptid.currentAtk = (cryptid.currentAtk || cryptid.atk) + 1;
                GameEvents.emit('onGraceSelfBuff', { cryptid, owner });
            }
        }
    },
    
    // SUPPORT: Track for pyre generation on attack
    onSupport: (cryptid, owner, game) => {
        cryptid.hasOfferingAbility = true;
    },
    
    // Called when this cryptid is attacked (Deer Woman in any position)
    onBeforeDefend: (cryptid, attacker, game) => {
        // Deer Woman generates pyre when attacked
        const owner = cryptid.owner;
        if (owner === 'player') game.playerPyre++;
        else game.enemyPyre++;
        GameEvents.emit('onOfferingPyre', { cryptid, owner, source: 'Deer Woman attacked' });
        
        // Queue offering animation
        if (typeof queueAbilityAnimation !== 'undefined') {
            queueAbilityAnimation({
                type: 'pyreDrain',
                target: cryptid,
                message: `🦌 Deer Woman's Offering: +1 pyre!`
            });
        }
    },
    
    // Also trigger when combatant in front is attacked
    onCombatantAttacked: (support, combatant, attacker, game) => {
        if (support.hasOfferingAbility) {
            const owner = support.owner;
            if (owner === 'player') game.playerPyre++;
            else game.enemyPyre++;
            GameEvents.emit('onOfferingPyre', { cryptid: support, owner, source: 'Combatant attacked' });
            
            // Queue offering animation
            if (typeof queueAbilityAnimation !== 'undefined') {
                queueAbilityAnimation({
                    type: 'pyreDrain',
                    target: support,
                    message: `🦌 Deer Woman's Offering: +1 pyre!`
                });
            }
        }
    }
});

// ==================== EVOLVED CRYPTIDS ====================

// Mature Wendigo - Blood, Uncommon, Cost 3 (Evolves from Newborn Wendigo)
CardRegistry.registerCryptid('matureWendigo', {
    name: "Mature Wendigo",
    sprite: "🦌",
    spriteScale: 1.2,
    element: "blood",
    cost: 3,
    hp: 4,
    atk: 3,
    rarity: "uncommon",
    evolvesFrom: 'newbornWendigo',
    evolvesInto: 'primalWendigo',
    combatAbility: "Hunger: If doesn't attack, lose 1 HP & all enemies -1 ATK (min 1)",
    supportAbility: "Guardian: First attack on combatant each turn: -2 damage, +1 ATK",
    
    // Special evolution: At 1 HP (not on summon turn), can evolve to Primal from deck if not in hand
    canSpecialEvolve: (cryptid, game) => {
        if (cryptid.justSummoned) return false;
        if ((cryptid.currentHp || cryptid.hp) !== 1) return false;
        const owner = cryptid.owner;
        const hasPrimalInHand = game.findCardInHand(owner, 'primalWendigo');
        if (hasPrimalInHand) return false;
        const hasPrimalInDeck = game.findCardInDeck(owner, 'primalWendigo');
        return !!hasPrimalInDeck;
    },
    
    // Track if attacked this turn
    onCombatAttack: (attacker, target, game) => {
        attacker.attackedThisTurn = true;
        return 0;
    },
    
    // COMBAT end of turn: If didn't attack, lose 1 HP and debuff all enemies
    onTurnEnd: (cryptid, owner, game) => {
        const combatCol = game.getCombatCol(owner);
        if (cryptid.col !== combatCol) return;
        if (cryptid.attackedThisTurn) return;
        
        // Lose 1 HP
        cryptid.currentHp = (cryptid.currentHp || cryptid.hp) - 1;
        GameEvents.emit('onHungerDamage', { cryptid, owner });
        
        // Queue self-damage animation
        if (typeof queueAbilityAnimation !== 'undefined') {
            queueAbilityAnimation({
                type: 'abilityDamage',
                target: cryptid,
                damage: 1,
                message: `😰 ${cryptid.name}'s hunger deals 1 self-damage!`
            });
        }
        
        // Debuff all enemy cryptids ATK by 1 (min 1)
        const enemyField = owner === 'player' ? game.enemyField : game.playerField;
        for (let c = 0; c < 2; c++) {
            for (let r = 0; r < 3; r++) {
                const enemy = enemyField[c][r];
                if (enemy) {
                    enemy.atkDebuff = (enemy.atkDebuff || 0) + 1;
                    // Ensure ATK doesn't drop below 1
                    const effectiveAtk = (enemy.currentAtk || enemy.atk) - enemy.atkDebuff;
                    if (effectiveAtk < 1) {
                        enemy.atkDebuff = Math.max(0, (enemy.currentAtk || enemy.atk) - 1);
                    }
                }
            }
        }
        GameEvents.emit('onWendigoHunger', { cryptid, owner });
        
        // Queue debuff message
        if (typeof queueAbilityAnimation !== 'undefined') {
            queueAbilityAnimation({
                type: 'buff',
                message: `⬇ All enemies lose 1 ATK!`
            });
        }
        
        // Check if Wendigo died from hunger
        if (cryptid.currentHp <= 0) {
            game.killCryptid(cryptid, owner);
        }
    },
    
    // SUPPORT: First attack each turn on combatant: -2 damage, +1 ATK to combatant
    onSupport: (cryptid, owner, game) => {
        cryptid.hasGuardianAbility = true;
        cryptid.guardianAvailable = true;
    },
    
    onCombatantAttacked: (support, combatant, attacker, game) => {
        if (!support.guardianAvailable) return;
        
        // Reduce damage by 2
        combatant.damageReduction = (combatant.damageReduction || 0) + 2;
        
        // Grant +1 ATK
        combatant.currentAtk = (combatant.currentAtk || combatant.atk) + 1;
        
        support.guardianAvailable = false;
        GameEvents.emit('onGuardianProtect', { support, combatant, owner: support.owner });
        
        // Queue guardian animation
        if (typeof queueAbilityAnimation !== 'undefined') {
            queueAbilityAnimation({
                type: 'buff',
                target: combatant,
                message: `🛡️ Guardian: -2 damage, +1 ATK!`
            });
        }
    },
    
    // Reset guardian at turn start
    onTurnStart: (cryptid, owner, game) => {
        if (cryptid.hasGuardianAbility) {
            cryptid.guardianAvailable = true;
        }
    }
});

// Primal Wendigo - Blood, Ultimate, Cost 6 (Evolves from Mature Wendigo)
CardRegistry.registerCryptid('primalWendigo', {
    name: "Primal Wendigo",
    sprite: "🦌",
    spriteScale: 1.5,
    element: "blood",
    cost: 6,
    hp: 7,
    atk: 4,
    rarity: "ultimate",
    mythical: true,
    evolvesFrom: 'matureWendigo',
    combatAbility: "Apex: +2/+2 on kill. Counter-attacks before damage; if kills attacker, negates attack",
    supportAbility: "Cannibalize: Deals ATK to own support each turn. Kill = +2/+2, 2 pyre, draw 2",
    
    // COMBAT: Counter-attack before taking damage
    onBeforeDefend: (cryptid, attacker, game) => {
        // Deal Primal Wendigo's ATK as damage to attacker
        const counterDamage = cryptid.currentAtk || cryptid.atk;
        attacker.currentHp -= counterDamage;
        GameEvents.emit('onPrimalCounter', { cryptid, attacker, damage: counterDamage, owner: cryptid.owner });
        
        // Queue counter-attack animation
        if (typeof queueAbilityAnimation !== 'undefined') {
            queueAbilityAnimation({
                type: 'counterAttack',
                source: cryptid,
                target: attacker,
                damage: counterDamage,
                message: `⚡ ${cryptid.name} counter-attacks for ${counterDamage}!`
            });
        }
        
        // Check if attacker died
        if (attacker.currentHp <= 0) {
            // Kill attacker
            attacker.killedBy = 'primalCounter';
            game.killCryptid(attacker, cryptid.owner);
            
            // Grant +2/+2 for the kill
            cryptid.currentAtk = (cryptid.currentAtk || cryptid.atk) + 2;
            cryptid.currentHp = (cryptid.currentHp || cryptid.hp) + 2;
            cryptid.maxHp = (cryptid.maxHp || cryptid.hp) + 2;
            GameEvents.emit('onApexKill', { cryptid, victim: attacker, owner: cryptid.owner });
            
            // Negate the attack
            cryptid.negateIncomingAttack = true;
        }
    },
    
    // Track kills for +2/+2 bonus
    onKill: (cryptid, victim, game) => {
        cryptid.currentAtk = (cryptid.currentAtk || cryptid.atk) + 2;
        cryptid.currentHp = (cryptid.currentHp || cryptid.hp) + 2;
        cryptid.maxHp = (cryptid.maxHp || cryptid.hp) + 2;
        GameEvents.emit('onApexKill', { cryptid, victim, owner: cryptid.owner });
    },
    
    // SUPPORT: Cannibalize - deal ATK damage to own support each turn
    onTurnStart: (cryptid, owner, game) => {
        const supportCol = game.getSupportCol(owner);
        if (cryptid.col !== supportCol) return; // Only when Primal is support
        
        const combatant = game.getCombatant(cryptid);
        if (!combatant) return;
        
        // Deal Primal's ATK as damage to combatant (which is in front, so Primal is support here)
        // Wait, re-reading: "deal its ATK as damage to its support" - but Primal IS the support
        // So this means when Primal is in COMBAT, it damages its own support
    },
    
    // Actually, re-implement: When Primal is COMBATANT, damages its support
    onCombat: (cryptid, owner, game) => {
        cryptid.hasCannibalize = true;
    },
    
    onSupport: (cryptid, owner, game) => {
        // When Primal is support, no cannibalize - it's the other way
    }
});

// Override Primal Wendigo's turn start for cannibalize when in combat
CardRegistry.cryptids['primalWendigo'].onTurnStart = function(cryptid, owner, game) {
    const combatCol = game.getCombatCol(owner);
    if (cryptid.col !== combatCol) return; // Only when Primal is combatant
    
    const support = game.getSupport(cryptid);
    if (!support) return;
    
    // Deal Primal's ATK as damage to support
    const damage = cryptid.currentAtk || cryptid.atk;
    support.currentHp -= damage;
    GameEvents.emit('onCannibalizeDamage', { cryptid, support, damage, owner });
    
    // Queue Cannibalize animation
    if (typeof queueAbilityAnimation !== 'undefined') {
        queueAbilityAnimation({
            type: 'abilityDamage',
            source: cryptid,
            target: support,
            damage: damage,
            message: `💀 ${cryptid.name} cannibalizes for ${damage}!`
        });
    }
    
    // Check if support died
    if (support.currentHp <= 0) {
        support.killedBy = 'cannibalize';
        game.killCryptid(support, owner);
        
        // Grant +2/+2
        cryptid.currentAtk = (cryptid.currentAtk || cryptid.atk) + 2;
        cryptid.currentHp = (cryptid.currentHp || cryptid.hp) + 2;
        cryptid.maxHp = (cryptid.maxHp || cryptid.hp) + 2;
        
        // Gain 2 pyre
        if (owner === 'player') game.playerPyre += 2;
        else game.enemyPyre += 2;
        
        // Draw 2 cards
        game.drawCards(owner, 2);
        
        GameEvents.emit('onCannibalizeKill', { cryptid, support, owner });
        
        // Queue kill bonus animation
        if (typeof queueAbilityAnimation !== 'undefined') {
            queueAbilityAnimation({
                type: 'buff',
                target: cryptid,
                message: `⬆ ${cryptid.name} gains +2/+2, 2 pyre, draws 2!`
            });
        }
    }
};

// Thunderbird - Water, Common, Cost 4 (Evolves from Stormhawk)
CardRegistry.registerCryptid('thunderbird', {
    name: "Thunderbird",
    sprite: "🦅",
    spriteScale: 1.3,
    element: "water",
    cost: 4,
    hp: 4,
    atk: 4,
    rarity: "common",
    hasFlight: true,
    evolvesFrom: 'stormhawk',
    combatAbility: "Storm Call: Flight. Enemies summoned across take 2 damage",
    supportAbility: "Tailwind: Combatant gains Flight and +1/+1",
    
    // COMBAT: Deal 2 damage to enemies summoned across
    onCombat: (cryptid, owner, game) => {
        cryptid.hasStormCall = true;
    },
    
    // This will be called by a system hook when enemy summons across
    onEnemySummonedAcross: (cryptid, enemyCryptid, game) => {
        if (!cryptid.hasStormCall) return;
        enemyCryptid.currentHp -= 2;
        GameEvents.emit('onStormCallDamage', { source: cryptid, target: enemyCryptid, damage: 2 });
        
        // Queue Storm Call animation
        if (typeof queueAbilityAnimation !== 'undefined') {
            queueAbilityAnimation({
                type: 'abilityDamage',
                source: cryptid,
                target: enemyCryptid,
                damage: 2,
                message: `⚡ ${cryptid.name}'s Storm Call hits for 2!`
            });
        }
        
        if (enemyCryptid.currentHp <= 0) {
            game.killCryptid(enemyCryptid, cryptid.owner);
        }
    },
    
    // SUPPORT: Grant combatant flight and +1/+1 (one-time, doesn't stack)
    onSupport: (cryptid, owner, game) => {
        const combatant = game.getCombatant(cryptid);
        if (combatant) {
            // Track which combatant we've buffed to prevent stacking
            const combatantId = combatant.id || `${combatant.key}-${combatant.col}-${combatant.row}`;
            if (cryptid._lastBuffedCombatant === combatantId) return;
            
            combatant.hasFlight = true;
            combatant.currentAtk = (combatant.currentAtk || combatant.atk) + 1;
            combatant.currentHp = (combatant.currentHp || combatant.hp) + 1;
            combatant.maxHp = (combatant.maxHp || combatant.hp) + 1;
            cryptid._lastBuffedCombatant = combatantId;
            GameEvents.emit('onTailwindBuff', { support: cryptid, combatant, owner });
        }
    }
});

// Snipe - Void, Common, Cost 2 (New card with Hidden mechanic)
CardRegistry.registerCryptid('snipe', {
    name: "Snipe",
    sprite: "🦆",
    spriteScale: 1.0,
    element: "void",
    cost: 2,
    hp: 4,
    atk: 2,
    rarity: "common",
    combatAbility: "Ambush: Hidden on summon. Unhide: paralyze & 2 damage to enemy across. Re-hides each turn",
    supportAbility: "Mend: On summon, fully heal combatant to base max HP",
    
    // COMBAT: Hidden on summon to combat
    onSummon: (cryptid, owner, game) => {
        const combatCol = game.getCombatCol(owner);
        if (cryptid.col === combatCol) {
            cryptid.isHidden = true;
            GameEvents.emit('onHide', { cryptid, owner });
        }
    },
    
    // Called when Snipe attacks (unhides before attack)
    onCombatAttack: (attacker, target, game) => {
        if (attacker.isHidden) {
            attacker.isHidden = false;
            game.triggerSnipeReveal(attacker);
        }
        return 0;
    },
    
    // Called when Snipe is attacked (unhides before damage)
    onBeforeDefend: (cryptid, attacker, game) => {
        if (cryptid.isHidden) {
            cryptid.isHidden = false;
            game.triggerSnipeReveal(cryptid);
        }
    },
    
    // Re-hide at turn start if not already hidden
    onTurnStart: (cryptid, owner, game) => {
        const combatCol = game.getCombatCol(owner);
        if (cryptid.col === combatCol && !cryptid.isHidden) {
            cryptid.isHidden = true;
            GameEvents.emit('onReHide', { cryptid, owner });
        }
    },
    
    // SUPPORT: Fully heal combatant on summon
    onSupport: (cryptid, owner, game) => {
        const combatant = game.getCombatant(cryptid);
        if (combatant) {
            // Base max HP = written HP (not including buffs from card effects)
            const baseMaxHp = combatant.baseHp || combatant.hp;
            combatant.currentHp = baseMaxHp;
            GameEvents.emit('onMendHeal', { support: cryptid, combatant, healedTo: baseMaxHp, owner });
        }
    }
});

// Adult Bigfoot - Nature, Rare, Cost 7 (Evolves from Adolescent Bigfoot)
CardRegistry.registerCryptid('adultBigfoot', {
    name: "Adult Bigfoot",
    sprite: "🦶",
    spriteScale: 1.5,
    element: "nature",
    cost: 7,
    hp: 10,
    atk: 2,
    rarity: "rare",
    evolvesFrom: 'adolescentBigfoot',
    combatAbility: "Rampage: Attacks hit combatant AND support. Auras cost -1 pyre",
    supportAbility: "Bulwark: When Adult Bigfoot or combatant targeted, both gain +1 HP",
    
    // Aura cost reduction
    modifyAuraCost: -1,
    
    // Cleave attack flag
    hasCleave: true,
    
    // If evolved (not summoned), gain +2 ATK
    onSummon: (cryptid, owner, game) => {
        if (cryptid.evolutionChain && cryptid.evolutionChain.length > 1) {
            // Was evolved into
            cryptid.currentAtk = (cryptid.currentAtk || cryptid.atk) + 2;
            GameEvents.emit('onEvolutionBonus', { cryptid, bonus: 2, owner });
        }
    },
    
    // SUPPORT: When targeted for attack, grant +1 HP to both
    onSupport: (cryptid, owner, game) => {
        cryptid.hasBulwark = true;
    },
    
    onBeforeDefend: (cryptid, attacker, game) => {
        // Adult Bigfoot is being attacked (either as combatant or support)
        const combatCol = game.getCombatCol(cryptid.owner);
        const supportCol = game.getSupportCol(cryptid.owner);
        
        // Grant +1 HP to self
        cryptid.currentHp = (cryptid.currentHp || cryptid.hp) + 1;
        cryptid.maxHp = (cryptid.maxHp || cryptid.hp) + 1;
        
        // Grant +1 HP to partner
        if (cryptid.col === combatCol) {
            const support = game.getSupport(cryptid);
            if (support) {
                support.currentHp = (support.currentHp || support.hp) + 1;
                support.maxHp = (support.maxHp || support.hp) + 1;
            }
        } else {
            const combatant = game.getCombatant(cryptid);
            if (combatant) {
                combatant.currentHp = (combatant.currentHp || combatant.hp) + 1;
                combatant.maxHp = (combatant.maxHp || combatant.hp) + 1;
            }
        }
        
        GameEvents.emit('onBulwarkTrigger', { cryptid, owner: cryptid.owner });
        
        // Queue bulwark animation
        if (typeof queueAbilityAnimation !== 'undefined') {
            queueAbilityAnimation({
                type: 'buff',
                target: cryptid,
                message: `🦶 Bulwark: Both gain +1 HP!`
            });
        }
    },
    
    // Also trigger when combatant is attacked (if Bigfoot is support)
    onCombatantAttacked: (support, combatant, attacker, game) => {
        if (!support.hasBulwark) return;
        
        // Grant +1 HP to both
        support.currentHp = (support.currentHp || support.hp) + 1;
        support.maxHp = (support.maxHp || support.hp) + 1;
        combatant.currentHp = (combatant.currentHp || combatant.hp) + 1;
        combatant.maxHp = (combatant.maxHp || combatant.hp) + 1;
        
        GameEvents.emit('onBulwarkTrigger', { cryptid: support, owner: support.owner });
        
        // Queue bulwark animation
        if (typeof queueAbilityAnimation !== 'undefined') {
            queueAbilityAnimation({
                type: 'buff',
                target: combatant,
                message: `🦶 Bulwark: Both gain +1 HP!`
            });
        }
    }
});

// Werewolf - Blood, Common, Cost 3 (Evolves from Cursed Hybrid when ATK > HP)
CardRegistry.registerCryptid('werewolf', {
    name: "Werewolf",
    sprite: "🐺",
    spriteScale: 1.2,
    element: "blood",
    cost: 3,
    hp: 2,
    atk: 4,
    rarity: "common",
    evolvesFrom: 'cursedHybrid',
    combatAbility: "Blood Frenzy: Curse self to die end of turn → +4 ATK & Destroyer",
    supportAbility: "Savage: Combatant gains +2 ATK",
    
    // COMBAT: Has curse button
    onCombat: (cryptid, owner, game) => {
        cryptid.hasBloodFrenzyAbility = true;
        cryptid.bloodFrenzyAvailable = true;
    },
    
    activateBloodFrenzy: (cryptid, game) => {
        if (!cryptid.bloodFrenzyAvailable) return;
        cryptid.bloodFrenzyAvailable = false;
        cryptid.cursedToDie = true;
        cryptid.currentAtk = (cryptid.currentAtk || cryptid.atk) + 4;
        cryptid.hasDestroyer = true;
        GameEvents.emit('onBloodFrenzy', { cryptid, owner: cryptid.owner });
        
        // Queue Blood Frenzy animation
        if (typeof queueAbilityAnimation !== 'undefined') {
            queueAbilityAnimation({
                type: 'buff',
                target: cryptid,
                message: `🩸 Blood Frenzy: +4 ATK, Destroyer!`
            });
        }
    },
    
    // Die at end of turn if cursed
    onTurnEnd: (cryptid, owner, game) => {
        if (cryptid.cursedToDie) {
            // Queue curse death animation
            if (typeof queueAbilityAnimation !== 'undefined') {
                queueAbilityAnimation({
                    type: 'abilityDamage',
                    target: cryptid,
                    message: `☠ Blood Frenzy claims ${cryptid.name}!`
                });
            }
            
            cryptid.killedBy = 'bloodFrenzyCurse';
            game.killCryptid(cryptid, owner);
        }
    },
    
    // SUPPORT: Grant +2 ATK to combatant (one-time, doesn't stack)
    onSupport: (cryptid, owner, game) => {
        const combatant = game.getCombatant(cryptid);
        if (combatant) {
            // Track which combatant we've buffed to prevent stacking
            const combatantId = combatant.id || `${combatant.key}-${combatant.col}-${combatant.row}`;
            if (cryptid._lastBuffedCombatant === combatantId) return;
            
            combatant.currentAtk = (combatant.currentAtk || combatant.atk) + 2;
            cryptid._lastBuffedCombatant = combatantId;
            GameEvents.emit('onSavageBuff', { support: cryptid, combatant, owner });
        }
    }
});

// Lycanthrope - Steel, Common, Cost 3 (Evolves from Cursed Hybrid when HP > ATK)
CardRegistry.registerCryptid('lycanthrope', {
    name: "Lycanthrope",
    sprite: "🐺",
    spriteScale: 1.2,
    element: "steel",
    cost: 3,
    hp: 4,
    atk: 2,
    rarity: "common",
    evolvesFrom: 'cursedHybrid',
    combatAbility: "Pack Growth: +1/+1 when you summon a support",
    supportAbility: "Pack Leader: Combatant gets +1/+1 when you summon a support",
    
    // Track for pack growth
    onCombat: (cryptid, owner, game) => {
        cryptid.hasPackGrowth = true;
    },
    
    onSupport: (cryptid, owner, game) => {
        cryptid.hasPackLeader = true;
    }
});

// Rogue Razorback - Steel, Common, Cost 4
CardRegistry.registerCryptid('rogueRazorback', {
    name: "Rogue Razorback",
    sprite: "🐗",
    spriteScale: 1.1,
    element: "steel",
    cost: 4,
    hp: 3,
    atk: 3,
    rarity: "common",
    combatAbility: "Gore: On enter combat, deal ATK damage to enemy combatant across",
    supportAbility: "Iron Hide: Combatant is immune to traps and bursts",
    
    // COMBAT: Deal ATK damage to enemy across on enter
    onCombat: (cryptid, owner, game) => {
        const enemyCombatant = game.getEnemyCombatantAcross(cryptid);
        if (enemyCombatant) {
            const damage = cryptid.currentAtk || cryptid.atk;
            enemyCombatant.currentHp -= damage;
            GameEvents.emit('onGoreDamage', { source: cryptid, target: enemyCombatant, damage, owner });
            
            // Queue Gore animation
            if (typeof queueAbilityAnimation !== 'undefined') {
                queueAbilityAnimation({
                    type: 'abilityDamage',
                    source: cryptid,
                    target: enemyCombatant,
                    damage: damage,
                    message: `🐗 ${cryptid.name} gores for ${damage}!`
                });
            }
            
            if (enemyCombatant.currentHp <= 0) {
                game.killCryptid(enemyCombatant, owner);
            }
        }
    },
    
    // SUPPORT: Grant trap/burst immunity
    onSupport: (cryptid, owner, game) => {
        const combatant = game.getCombatant(cryptid);
        if (combatant) {
            combatant.immuneToTraps = true;
            combatant.immuneToBursts = true;
            GameEvents.emit('onIronHide', { support: cryptid, combatant, owner });
        }
    }
});

// Not-Deer - Nature, Common, Cost 1
CardRegistry.registerCryptid('notDeer', {
    name: "Not-Deer",
    sprite: "🦌",
    spriteScale: 0.9,
    element: "nature",
    cost: 1,
    hp: 3,
    atk: 1,
    rarity: "common",
    combatAbility: "Herd Blessing: Gain 1 pyre per adjacent nature cryptid at turn start",
    supportAbility: "Death Watch: Draw a card when one of your cryptids dies",
    
    // COMBAT: Pyre per adjacent nature cryptid at turn start
    onTurnStart: (cryptid, owner, game) => {
        const combatCol = game.getCombatCol(owner);
        if (cryptid.col !== combatCol) return;
        
        const field = owner === 'player' ? game.playerField : game.enemyField;
        let naturePyres = 0;
        
        // Check above
        if (cryptid.row > 0) {
            const above = field[combatCol][cryptid.row - 1];
            if (above?.element === 'nature') naturePyres++;
        }
        // Check below
        if (cryptid.row < 2) {
            const below = field[combatCol][cryptid.row + 1];
            if (below?.element === 'nature') naturePyres++;
        }
        
        if (naturePyres > 0) {
            if (owner === 'player') game.playerPyre += naturePyres;
            else game.enemyPyre += naturePyres;
            GameEvents.emit('onHerdBlessing', { cryptid, owner, pyresGained: naturePyres });
            
            // Queue Herd Blessing animation
            if (typeof queueAbilityAnimation !== 'undefined') {
                queueAbilityAnimation({
                    type: 'pyreDrain',
                    target: cryptid,
                    message: `🦌 Herd Blessing: +${naturePyres} pyre!`
                });
            }
        }
    },
    
    // SUPPORT: Draw on ally death
    onSupport: (cryptid, owner, game) => {
        cryptid.hasDeathWatch = true;
    }
});

// Jersey Devil - Void, Rare, Mythical, Cost 5
CardRegistry.registerCryptid('jerseyDevil', {
    name: "Jersey Devil",
    sprite: "😈",
    spriteScale: 1.3,
    element: "void",
    cost: 5,
    hp: 6,
    atk: 2,
    rarity: "rare",
    mythical: true,
    hasFlight: true,
    combatAbility: "Flight. Swoop: Deal ATK to enemy across on enter. Steal 1 pyre on attack",
    supportAbility: "Infernal Ward: Immune to pyre drain. Combatant gains Flight",
    
    // COMBAT: Deal ATK to enemy on enter, steal pyre on attack
    onCombat: (cryptid, owner, game) => {
        const enemyCombatant = game.getEnemyCombatantAcross(cryptid);
        if (enemyCombatant) {
            const damage = cryptid.currentAtk || cryptid.atk;
            enemyCombatant.currentHp -= damage;
            GameEvents.emit('onSwoopDamage', { source: cryptid, target: enemyCombatant, damage, owner });
            
            // Queue Swoop animation
            if (typeof queueAbilityAnimation !== 'undefined') {
                queueAbilityAnimation({
                    type: 'abilityDamage',
                    source: cryptid,
                    target: enemyCombatant,
                    damage: damage,
                    message: `🦇 ${cryptid.name} swoops for ${damage}!`
                });
            }
            
            // Show message as visual feedback
            if (typeof showMessage === 'function') {
                showMessage(`🦇 ${cryptid.name} swoops for ${damage}!`);
            }
            
            if (enemyCombatant.currentHp <= 0) {
                game.killCryptid(enemyCombatant, owner);
            }
        }
        cryptid.stealsOnAttack = true;
    },
    
    // After attack, steal 1 pyre
    onCombatAttack: (attacker, target, game) => {
        if (attacker.stealsOnAttack) {
            const owner = attacker.owner;
            const enemyOwner = owner === 'player' ? 'enemy' : 'player';
            const enemyPyre = enemyOwner === 'player' ? game.playerPyre : game.enemyPyre;
            
            if (enemyPyre > 0) {
                if (enemyOwner === 'player') game.playerPyre--;
                else game.enemyPyre--;
                if (owner === 'player') game.playerPyre++;
                else game.enemyPyre++;
                GameEvents.emit('onPyreSteal', { source: attacker, owner, stolenFrom: enemyOwner });
                
                // Queue pyre steal animation
                if (typeof queueAbilityAnimation !== 'undefined') {
                    queueAbilityAnimation({
                        type: 'pyreDrain',
                        source: attacker,
                        message: `🔥 ${attacker.name} steals 1 pyre!`
                    });
                }
            }
        }
        return 0;
    },
    
    // SUPPORT: Grant pyre drain immunity and flight
    onSupport: (cryptid, owner, game) => {
        // Mark owner as immune to pyre drain
        if (owner === 'player') game.playerPyreDrainImmune = true;
        else game.enemyPyreDrainImmune = true;
        
        const combatant = game.getCombatant(cryptid);
        if (combatant) {
            combatant.hasFlight = true;
            GameEvents.emit('onInfernalWard', { support: cryptid, combatant, owner });
        }
    }
});

// Baba Yaga - Void, Uncommon, Mythical, Cost 2
CardRegistry.registerCryptid('babaYaga', {
    name: "Baba Yaga",
    sprite: "🧙",
    spriteScale: 1.0,
    element: "void",
    cost: 2,
    hp: 5,
    atk: 1,
    rarity: "uncommon",
    mythical: true,
    combatAbility: "Hex: Negate traps/bursts targeting Baba Yaga → kill random enemy",
    supportAbility: "Crone's Blessing: When combatant targeted, gain 1 pyre & heal combatant 1 HP",
    
    // Trap/burst immunity with redirect
    immuneToTraps: true,
    immuneToBursts: true,
    
    onTargetedByTrap: (cryptid, trap, game) => {
        // Kill random enemy
        const enemyOwner = cryptid.owner === 'player' ? 'enemy' : 'player';
        const enemyField = enemyOwner === 'player' ? game.playerField : game.enemyField;
        const enemies = [];
        for (let c = 0; c < 2; c++) {
            for (let r = 0; r < 3; r++) {
                if (enemyField[c][r]) enemies.push(enemyField[c][r]);
            }
        }
        if (enemies.length > 0) {
            const victim = enemies[Math.floor(Math.random() * enemies.length)];
            
            // Queue Hex animation before kill
            if (typeof queueAbilityAnimation !== 'undefined') {
                queueAbilityAnimation({
                    type: 'abilityDamage',
                    source: cryptid,
                    target: victim,
                    message: `🧙 Baba Yaga's Hex kills ${victim.name}!`
                });
            }
            
            victim.killedBy = 'babaYagaHex';
            game.killCryptid(victim, cryptid.owner);
            GameEvents.emit('onHexKill', { source: cryptid, victim, owner: cryptid.owner });
        }
        return true; // Negate the trap/burst
    },
    
    onTargetedByBurst: (cryptid, burst, game) => {
        return cryptid.onTargetedByTrap(cryptid, burst, game);
    },
    
    // SUPPORT: Pyre + heal when combatant targeted
    onSupport: (cryptid, owner, game) => {
        cryptid.hasCronesBlessing = true;
    },
    
    onCombatantAttacked: (support, combatant, attacker, game) => {
        if (!support.hasCronesBlessing) return;
        
        const owner = support.owner;
        // Gain 1 pyre
        if (owner === 'player') game.playerPyre++;
        else game.enemyPyre++;
        
        // Heal combatant 1 HP
        combatant.currentHp = Math.min(
            combatant.maxHp || combatant.hp,
            (combatant.currentHp || combatant.hp) + 1
        );
        
        GameEvents.emit('onCronesBlessing', { support, combatant, owner });
        
        // Queue Crone's Blessing animation
        if (typeof queueAbilityAnimation !== 'undefined') {
            queueAbilityAnimation({
                type: 'heal',
                target: combatant,
                damage: 1,
                message: `🧙 Crone's Blessing: +1 pyre & heal!`
            });
        }
    }
});

// ==================== PYRE CARDS ====================

// Burial Ground - Uncommon Mythical Pyre
CardRegistry.registerPyre('burialGround', {
    name: "Burial Ground",
    sprite: "⚰️",
    rarity: "uncommon",
    mythical: true,
    maxCopies: 1,
    description: "+1 pyre. +1 per different enemy attacker last turn (max +3)",
    pyreGain: 1,
    
    effect: (game, owner) => {
        let pyre = 1; // Base
        
        // Count different attackers from enemy's last turn
        const attackers = game.lastTurnAttackers?.[owner === 'player' ? 'enemy' : 'player'] || [];
        const uniqueAttackers = new Set(attackers.map(a => a.key || a.name)).size;
        const bonus = Math.min(3, uniqueAttackers);
        pyre += bonus;
        
        if (owner === 'player') game.playerPyre += pyre;
        else game.enemyPyre += pyre;
        
        GameEvents.emit('onPyreGained', { owner, amount: pyre, source: 'Burial Ground' });
        return { pyreGained: pyre };
    }
});

// Cursed Woods - Uncommon Mythical Pyre
CardRegistry.registerPyre('cursedWoods', {
    name: "Cursed Woods",
    sprite: "🌲",
    rarity: "uncommon",
    mythical: true,
    description: "+1 pyre. +1 per enemy support (max +3)",
    pyreGain: 1,
    
    effect: (game, owner) => {
        let pyre = 1; // Base
        
        // Count enemy supports
        const enemyOwner = owner === 'player' ? 'enemy' : 'player';
        const enemyField = enemyOwner === 'player' ? game.playerField : game.enemyField;
        const supportCol = game.getSupportCol(enemyOwner);
        
        let supportCount = 0;
        for (let r = 0; r < 3; r++) {
            if (enemyField[supportCol][r]) supportCount++;
        }
        
        const bonus = Math.min(3, supportCount);
        pyre += bonus;
        
        if (owner === 'player') game.playerPyre += pyre;
        else game.enemyPyre += pyre;
        
        GameEvents.emit('onPyreGained', { owner, amount: pyre, source: 'Cursed Woods' });
        return { pyreGained: pyre };
    }
});

// Animal Pelts - Ultimate Mythical Pyre
CardRegistry.registerPyre('animalPelts', {
    name: "Animal Pelts",
    sprite: "🦊",
    rarity: "ultimate",
    mythical: true,
    description: "+1 pyre & draw 1 per nature/water cryptid on your field",
    pyreGain: 1,
    
    effect: (game, owner) => {
        let pyre = 1; // Base
        
        // Count nature and water cryptids on field
        const field = owner === 'player' ? game.playerField : game.enemyField;
        let elementCount = 0;
        
        for (let c = 0; c < 2; c++) {
            for (let r = 0; r < 3; r++) {
                const cryptid = field[c][r];
                if (cryptid && (cryptid.element === 'nature' || cryptid.element === 'water')) {
                    elementCount++;
                }
            }
        }
        
        // +1 pyre and draw 1 for each
        pyre += elementCount;
        if (owner === 'player') game.playerPyre += pyre;
        else game.enemyPyre += pyre;
        
        // Draw cards
        for (let i = 0; i < elementCount; i++) {
            game.drawCard(owner, 'animalPelts');
        }
        
        GameEvents.emit('onPyreGained', { owner, amount: pyre, source: 'Animal Pelts' });
        return { pyreGained: pyre, cardsDrawn: elementCount };
    }
});

// ==================== AURA CARDS ====================

// Daunting Presence - Common Aura
CardRegistry.registerAura('dauntingPresence', {
    name: "Daunting Presence",
    sprite: "👁️",
    cost: 1,
    rarity: "common",
    description: "Grant equipped cryptid +1/+1",
    atkBonus: 1,
    hpBonus: 1
});

// Sprout Wings - Common Aura
CardRegistry.registerAura('sproutWings', {
    name: "Sprout Wings",
    sprite: "🪽",
    cost: 1,
    rarity: "common",
    description: "Grant equipped cryptid Flight",
    onApply: (aura, cryptid, game) => {
        cryptid.hasFlight = true;
    }
});

// Weaponized Tree - Common Aura
CardRegistry.registerAura('weaponizedTree', {
    name: "Weaponized Tree",
    sprite: "🌳",
    cost: 3,
    rarity: "common",
    description: "Equipped cryptid's attacks target all enemy combatants",
    onApply: (aura, cryptid, game) => {
        cryptid.hasMultiAttack = true;
    }
});

// Insatiable Hunger - Common Aura
CardRegistry.registerAura('insatiableHunger', {
    name: "Insatiable Hunger",
    sprite: "🍖",
    cost: 2,
    rarity: "common",
    description: "Before each attack, equipped cryptid gains +1 ATK",
    onApply: (aura, cryptid, game) => {
        cryptid.hasInsatiableHunger = true;
    }
});

// ==================== TRAP CARDS ====================

// Terrify - Common Trap
CardRegistry.registerTrap('terrify', {
    name: "Terrify",
    sprite: "😱",
    cost: 1,
    rarity: "common",
    description: "When enemy attacks: attacker's ATK becomes 0 until end of turn",
    triggerType: 'onEnemyAttack',
    
    onTrigger: (trap, data, game) => {
        const attacker = data.attacker;
        if (attacker) {
            attacker.savedAtk = attacker.currentAtk || attacker.atk;
            attacker.currentAtk = 0;
            attacker.terrified = true;
            GameEvents.emit('onTerrify', { trap, attacker, owner: trap.owner });
        }
        return true; // Trap consumed
    }
});

// Hunt - Rare Trap
CardRegistry.registerTrap('hunt', {
    name: "Hunt",
    sprite: "🏹",
    cost: 1,
    rarity: "rare",
    description: "When enemy plays pyre card: steal all pyres it would grant",
    triggerType: 'onEnemyPyreCard',
    
    onTrigger: (trap, data, game) => {
        // Intercept pyre - give to trap owner instead
        const stolenPyre = data.pyreAmount || 1;
        const trapOwner = trap.owner;
        const enemyOwner = trapOwner === 'player' ? 'enemy' : 'player';
        
        // Remove pyre from enemy (they already gained it)
        if (enemyOwner === 'player') game.playerPyre -= stolenPyre;
        else game.enemyPyre -= stolenPyre;
        
        // Give to trap owner
        if (trapOwner === 'player') game.playerPyre += stolenPyre;
        else game.enemyPyre += stolenPyre;
        
        GameEvents.emit('onHuntSteal', { trap, stolenPyre, from: enemyOwner, to: trapOwner });
        return true; // Trap consumed
    }
});

// ==================== BURST CARDS ====================

// Full Moon - Rare Burst
CardRegistry.registerBurst('fullMoon', {
    name: "Full Moon",
    sprite: "🌕",
    cost: 3,
    rarity: "rare",
    targetType: 'allyCryptid',
    description: "Target cryptid evolves into next form (ignoring conditions) if in hand/deck",
    
    // Only valid targets are cryptids that can evolve AND have evolution in hand/deck
    validateTarget: (cryptid, owner, game) => {
        if (!cryptid) return false;
        
        // Check if target has an evolution
        const evoKey = cryptid.evolvesInto || (cryptid.getEvolution ? cryptid.getEvolution(cryptid) : null);
        if (!evoKey) return false;
        
        // Check if evolution is in hand or deck
        const evoInHand = game.findCardInHand(owner, evoKey);
        const evoInDeck = game.findCardInDeck(owner, evoKey);
        
        return !!(evoInHand || evoInDeck);
    },
    
    effect: (game, owner, target) => {
        if (!target) return false;
        
        // Check if target has an evolution
        const evoKey = target.evolvesInto || (target.getEvolution ? target.getEvolution(target) : null);
        if (!evoKey) {
            GameEvents.emit('onFullMoonFail', { target, reason: 'no evolution' });
            return false;
        }
        
        // Find evolution in hand or deck
        const evoInHand = game.findCardInHand(owner, evoKey);
        const evoInDeck = game.findCardInDeck(owner, evoKey);
        
        if (!evoInHand && !evoInDeck) {
            GameEvents.emit('onFullMoonFail', { target, reason: 'evolution not in hand or deck' });
            return false;
        }
        
        const evoCard = evoInHand || evoInDeck;
        
        // Remove from hand/deck
        if (evoInHand) game.removeFromHand(owner, evoInHand);
        else game.removeFromDeck(owner, evoInDeck);
        
        // Evolve the target
        game.evolveInPlace(target, evoCard, owner);
        
        GameEvents.emit('onFullMoonEvolve', { target, evolution: evoCard, owner });
        return true;
    }
});

// ==================== CRYPTID CARDS ====================

// Skinwalker - Nature, Common, Cost 2
CardRegistry.registerCryptid('skinwalker', {
    name: "Skinwalker",
    sprite: "🎭",
    spriteScale: 1.0,
    element: "nature",
    cost: 2,
    hp: 4,
    atk: 1,
    rarity: "common",
    combatAbility: "Mimic: ATK becomes equal to enemy combatant across on enter combat",
    supportAbility: "Inherit: When combatant dies, gain its ATK/HP if higher than base",
    
    // COMBAT: Copy enemy combatant's ATK
    onCombat: (cryptid, owner, game) => {
        const enemyCombatant = game.getEnemyCombatantAcross(cryptid);
        if (enemyCombatant) {
            const enemyAtk = enemyCombatant.currentAtk || enemyCombatant.atk;
            cryptid.currentAtk = enemyAtk;
            GameEvents.emit('onMimic', { cryptid, copied: enemyCombatant, newAtk: enemyAtk, owner });
            
            // Queue Mimic animation
            if (typeof queueAbilityAnimation !== 'undefined') {
                queueAbilityAnimation({
                    type: 'buff',
                    target: cryptid,
                    message: `🎭 ${cryptid.name} mimics ${enemyCombatant.name}'s ATK (${enemyAtk})!`
                });
            }
        }
    },
    
    // SUPPORT: Inherit combatant stats on death
    onSupport: (cryptid, owner, game) => {
        cryptid.hasInherit = true;
    }
});

console.log("Forests of Fear cards loaded:", 
    Object.keys(CardRegistry.cryptids).filter(k => 
        ['matureWendigo', 'primalWendigo', 'thunderbird', 
         'adultBigfoot', 'werewolf', 'lycanthrope', 
         'snipe', 'rogueRazorback', 'notDeer', 'jerseyDevil', 'babaYaga', 'skinwalker']
        .includes(k)
    ).length, "cryptids |",
    Object.keys(CardRegistry.kindling || {}).filter(k =>
        ['newbornWendigo', 'stormhawk', 'adolescentBigfoot', 'cursedHybrid', 'deerWoman'].includes(k)
    ).length, "kindling |",
    Object.keys(CardRegistry.pyres || {}).filter(k => 
        ['burialGround', 'cursedWoods', 'animalPelts'].includes(k)
    ).length, "pyres |",
    Object.keys(CardRegistry.auras || {}).filter(k => 
        ['dauntingPresence', 'sproutWings', 'weaponizedTree', 'insatiableHunger'].includes(k)
    ).length, "auras |",
    Object.keys(CardRegistry.traps || {}).filter(k => 
        ['terrify', 'hunt'].includes(k)
    ).length, "traps |",
    Object.keys(CardRegistry.bursts || {}).filter(k => 
        ['fullMoon'].includes(k)
    ).length, "bursts"
);