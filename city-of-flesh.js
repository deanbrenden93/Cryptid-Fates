/**
 * Cryptid Fates - City of Flesh Series
 * DECLARATIVE Card Definitions
 * 
 * Cards use an effects[] array that the EffectEngine processes.
 * All game logic flows through universal triggers and actions.
 */

// ==================== CARD REGISTRY ====================
window.CardRegistry = window.CardRegistry || {
    cryptids: {},
    bursts: {},
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
        this.pyres[key] = { ...data, key, type: 'pyre', cost: 0 };
    },
    
    getCryptid(key) {
        return this.cryptids[key] ? { ...this.cryptids[key] } : null;
    },
    
    getBurst(key) {
        return this.bursts[key] ? { ...this.bursts[key] } : null;
    },
    
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
    
    // Flags for game-core handling
    hasGuard: true,
    
    effects: [
        // COMBAT: Reset guard at turn start
        {
            trigger: "onTurnStart",
            condition: { check: "isCombatant" },
            action: "setFlag",
            flag: "guardAvailable",
            value: true
        },
        // COMBAT: Guard triggers on being attacked (handled via onBeforeDefend in game-core)
        {
            trigger: "onBeforeDefend",
            condition: { check: "hasFlag", flag: "guardAvailable" },
            actions: [
                { action: "applyAilment", target: "attacker", ailmentType: "burn" },
                { action: "setFlag", target: "self", flag: "negateIncomingAttack", value: true },
                { action: "setFlag", target: "self", flag: "guardAvailable", value: false }
            ]
        },
        // SUPPORT: Grant burn-on-attack to combatant
        {
            trigger: "onEnterSupport",
            action: "grantFlag",
            target: "myCombatant",
            flag: "attacksApplyBurn"
        },
        // OTHER: If killed by burn, evolve into Hellhound
        {
            trigger: "onDeath",
            condition: { check: "killedBy", value: "burn" },
            action: "evolveFromDeathTrigger",
            evolutionKey: "hellhound"
        }
    ]
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
    
    // Combat bonus flag
    bonusVsBurning: 1,
    
    effects: [
        // SUPPORT: Grant burn-on-damaged to combatant
        {
            trigger: "onEnterSupport",
            action: "grantFlag",
            target: "myCombatant",
            flag: "burnAttackersOnDamage"
        },
        // OTHER: On death, burn enemy row across
        {
            trigger: "onDeath",
            action: "applyAilment",
            target: "enemyRowAcross",
            ailmentType: "burn"
        }
    ]
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
    
    // Lifesteal flag
    hasLifesteal: true,
    
    effects: [
        // SUPPORT: Grant pyre-on-damage to combatant
        {
            trigger: "onEnterSupport",
            action: "grantFlag",
            target: "myCombatant",
            flag: "grantPyreOnDamage"
        }
    ]
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
    combatAbility: "Enemy combatant across has -1 ATK per ailment token.",
    supportAbility: "Ailmented enemies deal half damage when attacking combatant. Otherwise, combatant receives one fewer damage from attacks.",
    
    effects: [
        // COMBAT: Apply ATK debuff based on ailment stacks (aura)
        {
            trigger: "whileInCombat",
            action: "applyAilmentAtkDebuff",
            target: "enemyCombatantAcross"
        },
        // SUPPORT: Grant damage reduction aura to combatant
        {
            trigger: "onEnterSupport",
            action: "grantFlag",
            target: "myCombatant",
            flag: "hasGremlinSupport"
        },
        {
            trigger: "onLeavingSupport",
            action: "removeFlag",
            target: "myCombatant",
            flag: "hasGremlinSupport"
        }
    ]
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
    
    // Ailment immunity flag
    ailmentImmune: true,
    
    effects: [
        // COMBAT: Convert ailment to temp ATK (handled via ailmentImmune + onAilmentAttempt)
        {
            trigger: "onAilmentAttempt",
            action: "convertAilmentToTempAtk",
            amount: 1
        },
        // SUPPORT: On enter, cleanse combatant and grant HP per unique ailment
        {
            trigger: "onEnterSupport",
            action: "cleanseAndBuffHp",
            target: "myCombatant",
            hpPerUniqueAilment: 1
        }
    ]
});

// ==================== CITY OF FLESH - CRYPTIDS ====================

// Rooftop Gargoyle - Steel, Common, Cost 1
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
    
    getSupportAbility: function(cryptid) {
        if (cryptid?.gargoyleSaveUsed) {
            return "Guardian's Sacrifice: [SPENT] - Ability has been used.";
        }
        return "Guardian's Sacrifice: When combatant would take lethal damage from an enemy, survive with 1 HP. If enemy has ailment, regain full HP instead. One use only.";
    },
    
    effects: [
        // COMBAT: Take 2 less damage from ailmented enemies
        {
            trigger: "onDefend",
            condition: { check: "attackerHasAilment" },
            action: "reduceDamage",
            amount: 2
        },
        // SUPPORT: Grant lethal protection to combatant
        {
            trigger: "onEnterSupport",
            action: "grantFlag",
            target: "myCombatant",
            flag: "hasRooftopGargoyleSupport",
            linkSource: true
        }
    ]
});

// Library Gargoyle - Uncommon - 3 ATK / 6HP - Steel - 5 Pyres
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
    
    // Flag for half damage
    hasStoneBastion: true,
    
    effects: [
        // COMBAT: When attacked by ailmented, draw card
        {
            trigger: "onDamagedByAttack",
            condition: { check: "attackerHasAilment" },
            action: "drawCard",
            amount: 1,
            owner: "self"
        },
        // SUPPORT: If any enemy ailmented, grant +3 HP to combatant
        {
            trigger: "onEnterSupport",
            condition: { check: "anyEnemyAilmented" },
            action: "buffStats",
            target: "myCombatant",
            hp: 3,
            permanent: true,
            once: true
        },
        // SUPPORT: When combatant kills ailmented enemy, draw 2 cards
        {
            trigger: "onCombatantKill",
            condition: { check: "victimHadAilment" },
            action: "drawCard",
            amount: 2,
            owner: "self"
        },
        // OTHER: At turn start, if 2+ ailmented enemies, gain 1 pyre
        {
            trigger: "onTurnStart",
            condition: { check: "ailmentedEnemyCount", min: 2 },
            action: "gainPyre",
            amount: 1,
            owner: "self"
        }
    ]
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
    
    effects: [
        // COMBAT: +2 damage to burned/toxic, with bonus effects
        {
            trigger: "onCombatAttack",
            condition: { check: "targetBurnedOrToxic" },
            action: "bonusDamageWithReward",
            bonusDamage: 2,
            healSelf: 4,
            permanentAtk: 1
        },
        // SUPPORT: Combatant regen on rest
        {
            trigger: "onEnterSupport",
            action: "grantFlag",
            target: "myCombatant",
            flag: "hasSewerAlligatorSupport"
        },
        // SUPPORT: On combatant death, make enemy slot toxic
        {
            trigger: "onCombatantDeath",
            action: "applyToxicSlot",
            target: "enemyCombatSlotAcross"
        }
    ]
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
    
    // Explosion flag (still needed for combat mechanic)
    hasKuchisakeExplosion: true,
    
    // Data-driven activated abilities
    activatedAbilities: [
        {
            id: "sacrifice",
            name: "Am I Pretty?",
            position: "support",
            requiresCombatant: true,
            oncePerGame: true,
            effects: [
                { action: "killCombatant", killedBy: "sacrifice" },
                { action: "setStats", atk: 9, hp: 7 },
                { action: "grantKeyword", keyword: "destroyer" }
            ]
        }
    ],
    
    effects: [
        // COMBAT: Apply burn before attacking
        {
            trigger: "onBeforeAttack",
            action: "applyAilment",
            target: "attackTarget",
            ailmentType: "burn"
        },
        // OTHER: At turn end, if no enemy across, gain bleed
        {
            trigger: "onTurnEnd",
            condition: { check: "noEnemyAcross", position: "combat" },
            action: "applyAilment",
            target: "self",
            ailmentType: "bleed"
        }
    ]
});

// Hellhound - Blood, Common, Cost 3
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
    
    effects: [
        // COMBAT: Burn target before attack, spread if already burning
        {
            trigger: "onBeforeAttack",
            action: "burnWithSpread",
            spreadCondition: "alreadyBurning"
        },
        // SUPPORT: Grant +2 vs burning to combatant
        {
            trigger: "onEnterSupport",
            action: "grantCombatBonus",
            target: "myCombatant",
            bonusType: "bonusVsBurning",
            amount: 2
        },
        // SUPPORT: Spread burn on combatant's burning kills
        {
            trigger: "onCombatantKill",
            condition: { check: "victimWasBurning" },
            action: "applyAilment",
            target: "randomAdjacentToVictim",
            ailmentType: "burn"
        },
        // Cleanup on death/leaving support
        {
            trigger: "onLeavingSupport",
            action: "removeCombatBonus",
            target: "myCombatant",
            bonusType: "bonusVsBurning",
            amount: 2
        }
    ]
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
    
    // Flight targeting
    canTargetAny: true,
    
    effects: [
        // COMBAT: Harbinger - deal damage per ailment stack to all enemies
        {
            trigger: "onEnterCombat",
            action: "dealDamagePerAilmentStack",
            target: "allEnemies",
            damagePerStack: 1,
            damageType: "harbinger"
        },
        // SUPPORT: Cleanse all combatants, grant +1/+1 per stack cleansed
        {
            trigger: "onEnterSupport",
            action: "cleanseAndBuff",
            target: "allyCombatants",
            atkPerStack: 1,
            hpPerStack: 1,
            permanent: true
        },
        // SUPPORT: While in support, combatants immune to ailments
        {
            trigger: "whileInSupport",
            action: "grantAura",
            target: "allyCombatants",
            aura: "ailmentImmunity"
        },
        {
            trigger: "onLeavingSupport",
            action: "removeAura",
            target: "allyCombatants",
            aura: "ailmentImmunity"
        },
        // OTHER: When ailmented enemy dies, gain +1/+1 permanently
        {
            trigger: "onEnemyDeath",
            condition: { check: "targetHadAilments" },
            action: "gainPermanentStat",
            target: "self",
            atk: 1,
            hp: 1
        }
    ]
});

// Bogeyman - Void, Common, Cost 2
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
    
    // Combat bonus
    bonusVsParalyzed: 3,
    
    // Support flag
    negatesEnemySupport: true,
    
    effects: [
        // COMBAT: Paralyze enemies across on enter
        {
            trigger: "onEnterCombat",
            action: "applyAilment",
            target: "enemiesAcross",
            ailmentType: "paralyze"
        }
    ]
});

// The Flayer - Void, Rare, Mythical, Cost 5
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
    
    // Support flag
    grantsFocus: true,
    
    effects: [
        // COMBAT: Paralyze all enemy combatants on enter
        {
            trigger: "onEnterCombat",
            action: "applyAilment",
            target: "enemyCombatants",
            ailmentType: "paralyze"
        },
        // COMBAT: On killing paralyzed target, gain pyre + draw
        {
            trigger: "onKill",
            condition: { check: "victimWasParalyzed" },
            actions: [
                { action: "gainPyre", amount: 1, owner: "self" },
                { action: "drawCard", amount: 1, owner: "self" }
            ]
        },
        // SUPPORT: Grant focus and paralyze-on-attack to combatant
        {
            trigger: "onEnterSupport",
            actions: [
                { action: "grantFlag", target: "myCombatant", flag: "hasFocus" },
                { action: "grantFlag", target: "myCombatant", flag: "attacksApplyParalyze" }
            ]
        },
        {
            trigger: "onLeavingSupport",
            actions: [
                { action: "removeFlag", target: "myCombatant", flag: "hasFocus" },
                { action: "removeFlag", target: "myCombatant", flag: "attacksApplyParalyze" }
            ]
        }
    ]
});

// Decay Rat - Steel, Uncommon, Cost 3
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
    
    // Data-driven activated abilities
    activatedAbilities: [
        {
            id: "decayDebuff",
            name: "Decay",
            position: "support",
            requiresCombatant: false,
            requiresTarget: "ailmentedEnemy",
            oncePerTurn: true,
            effects: [
                { 
                    action: "debuffTarget", 
                    perAilmentStack: true,
                    multiplier: 1,
                    debuffAtk: true,
                    debuffHp: true,
                    temporary: true,
                    killedBy: "decayRat"
                }
            ]
        }
    ],
    
    effects: [
        // COMBAT: Extend ailments on damage to ailmented targets
        {
            trigger: "onCombatAttack",
            condition: { check: "targetHasAilment" },
            action: "extendAilments",
            target: "attackTarget",
            amount: 1
        }
    ]
});

// Moleman - Steel, Common, Cost 2
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
    
    // Custom targeting
    hasBurrowTargeting: true,
    
    // Combat bonus
    bonusVsAilment: 2,
    
    effects: [
        // SUPPORT: Grant splash damage to combatant
        {
            trigger: "onEnterSupport",
            action: "grantFlag",
            target: "myCombatant",
            flag: "hasMolemanSplash"
        },
        {
            trigger: "onLeavingSupport",
            action: "removeFlag",
            target: "myCombatant",
            flag: "hasMolemanSplash"
        }
    ]
});

// Vampire Initiate - Blood, Common, Cost 2
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
    
    // Lifesteal flag
    hasLifesteal: true,
    
    // Data-driven activated abilities
    activatedAbilities: [
        {
            id: "bloodPact",
            name: "Blood Pact",
            position: "support",
            requiresCombatant: true,
            oncePerTurn: true,
            effects: [
                { action: "damageCombatant", amount: 1, killedBy: "bloodPact" },
                { action: "gainPyre", amount: 1 }
            ]
        }
    ],
    
    effects: [
        // COMBAT: Gain 1 pyre on attack
        {
            trigger: "onCombatAttack",
            action: "gainPyre",
            amount: 1,
            owner: "self"
        }
    ]
});

// Redcap - Blood, Uncommon, Cost 3
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
    
    // Lifesteal flag
    hasLifesteal: true,
    
    effects: [
        // COMBAT: Bloodlust - +1 damage per ailmented enemy
        {
            trigger: "onCombatAttack",
            action: "bonusDamagePerAilmentedEnemy",
            damagePerEnemy: 1
        },
        // SUPPORT: On combatant kill, grant +1 ATK (+ HP if ailmented)
        {
            trigger: "onCombatantKill",
            actions: [
                { action: "buffStats", target: "myCombatant", atk: 1, permanent: true },
                { action: "buffStats", target: "self", atk: 1, permanent: true }
            ]
        },
        {
            trigger: "onCombatantKill",
            condition: { check: "victimHadAilment" },
            actions: [
                { action: "buffStats", target: "myCombatant", hp: 1, permanent: true },
                { action: "buffStats", target: "self", hp: 1, permanent: true }
            ]
        },
        // Track kills for "hunger" ability
        {
            trigger: "onKill",
            action: "setFlag",
            target: "self",
            flag: "gotKillThisTurn",
            value: true
        },
        // Reset kill tracking at turn start
        {
            trigger: "onTurnStart",
            action: "setFlag",
            target: "self",
            flag: "gotKillThisTurn",
            value: false
        },
        // OTHER: If no kill by turn end (in combat), set HP to 1
        {
            trigger: "onTurnEnd",
            condition: { check: "isCombatantAndNoKill" },
            action: "setHp",
            target: "self",
            hp: 1
        }
    ]
});

// Vampire Lord - Blood, Rare, Cost 4
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
    
    // Flags
    hasLifesteal: true,
    bonusVsBurning: 3,
    
    effects: [
        // COMBAT: On killing burning enemy, gain pyre equal to cost
        {
            trigger: "onKill",
            condition: { check: "victimWasBurning" },
            action: "gainPyre",
            amount: { calc: "victimCost" },
            owner: "self"
        },
        // SUPPORT: Grant lifesteal and bonus vs burning to combatant
        {
            trigger: "onEnterSupport",
            actions: [
                { action: "grantFlag", target: "myCombatant", flag: "hasLifesteal" },
                { action: "grantCombatBonus", target: "myCombatant", bonusType: "bonusVsBurning", amount: 2 }
            ]
        },
        // SUPPORT: On combatant killing burning enemy, draw card
        {
            trigger: "onCombatantKill",
            condition: { check: "victimWasBurning" },
            action: "drawCard",
            amount: 1,
            owner: "self"
        },
        // Cleanup on leaving support
        {
            trigger: "onLeavingSupport",
            actions: [
                { action: "removeFlag", target: "myCombatant", flag: "hasLifesteal" },
                { action: "removeCombatBonus", target: "myCombatant", bonusType: "bonusVsBurning", amount: 2 }
            ]
        }
    ]
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
        if (eventData.attackerOwner === owner) return false;
        const target = eventData.target;
        if (!target || target.owner !== owner) return false;
        const damage = game.calculateAttackDamage(eventData.attacker);
        const effectiveHp = game.getEffectiveHp(target);
        return effectiveHp <= damage;
    },
    
    effects: [
        {
            action: "forceRest",
            target: "attacker"
        },
        {
            action: "cancelAttack"
        },
        {
            action: "drawCard",
            amount: 2,
            owner: "trapOwner"
        },
        {
            action: "drawCardIfEvolution",
            amount: 1,
            owner: "trapOwner"
        }
    ]
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
        const killedBySource = eventData.killedBySource || eventData.cryptid?.killedBySource;
        if (eventData.owner !== owner) return false;
        if (!killedBySource) return false;
        return killedBySource.owner !== owner;
    },
    
    effects: [
        {
            action: "killKiller",
            killedBy: "bloodCovenant",
            withAnimation: "lightning"
        }
    ]
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
        return eventData.attackerOwner !== owner && 
               eventData.target?.owner === owner;
    },
    
    effects: [
        {
            action: "forceRest",
            target: "attacker"
        },
        {
            action: "applyAilment",
            target: "attacker",
            ailmentType: "paralyze"
        },
        {
            action: "cancelAttack"
        }
    ]
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
    
    effects: [
        {
            condition: { check: "targetIsAlly" },
            action: "untap",
            target: "spellTarget"
        },
        {
            condition: { check: "targetIsEnemy" },
            action: "forceRest",
            target: "spellTarget"
        }
    ]
});

// Face-Off - Common, 1 Pyre
CardRegistry.registerBurst('faceOff', {
    name: "Face-Off",
    sprite: "⚔️",
    cost: 1,
    rarity: "common",
    description: "Force target cryptid to attack the enemy combatant across from it",
    targetType: 'any',
    requiresEnemyAcross: true,
    
    effects: [
        {
            action: "forceAttackAcross",
            target: "spellTarget"
        }
    ]
});

// ==================== CITY OF FLESH - AURAS ====================

// Anti-Vampiric Blade - Common, 3 Pyre
CardRegistry.registerAura('antiVampiricBlade', {
    name: "Anti-Vampiric Blade",
    sprite: "🗡️",
    cost: 3,
    rarity: "common",
    description: "+2 ATK, regen 2HP/turn, focus. +2 ATK if enemy diagonal/across has ailment",
    
    // Static bonuses
    atkBonus: 2,
    hpBonus: 0,
    grantsFocus: true,
    grantsRegeneration: 2,
    
    effects: [
        {
            trigger: "onApply",
            actions: [
                { action: "grantFlag", target: "auraTarget", flag: "hasFocus" },
                { action: "grantRegeneration", target: "auraTarget", amount: 2 }
            ]
        },
        {
            trigger: "onApply",
            condition: { check: "nearbyEnemyHasAilment" },
            action: "buffStats",
            target: "auraTarget",
            atk: 2
        }
    ]
});

// ==================== CITY OF FLESH - PYRES ====================

// Basic Pyre - Common
CardRegistry.registerPyre('pyre', {
    name: "Basic",
    sprite: "🔥",
    rarity: "common",
    description: "Gain 1 pyre",
    pyreGain: 1,
    infinite: true,
    
    effects: [
        {
            action: "gainPyre",
            amount: 1,
            owner: "cardOwner"
        }
    ]
});

// Fresh Kill - Uncommon
CardRegistry.registerPyre('freshKill', {
    name: "Fresh Kill",
    sprite: "🦇",
    rarity: "uncommon",
    description: "+1 pyre, +1 per Vampire on field (max +3 extra)",
    pyreGain: 1,
    
    effects: [
        {
            action: "gainPyre",
            amount: 1,
            owner: "cardOwner"
        },
        {
            action: "gainPyrePerNameMatch",
            match: "vampire",
            amountPer: 1,
            max: 3,
            owner: "cardOwner"
        }
    ]
});

// Rat King - Ultimate
CardRegistry.registerPyre('ratKing', {
    name: "Rat King",
    sprite: "👑",
    rarity: "ultimate",
    description: "+1 pyre and draw 1 for each ally death last enemy turn (max 3)",
    pyreGain: 1,
    
    effects: [
        {
            action: "gainPyre",
            amount: 1,
            owner: "cardOwner"
        },
        {
            action: "gainPyrePerDeathLastTurn",
            amountPer: 1,
            max: 3,
            owner: "cardOwner"
        },
        {
            action: "drawCardPerDeathLastTurn",
            amountPer: 1,
            max: 3,
            owner: "cardOwner"
        }
    ]
});

// Nightfall - Uncommon
CardRegistry.registerPyre('nightfall', {
    name: "Nightfall",
    sprite: "🌙",
    rarity: "uncommon",
    description: "+1 pyre, +1 per Gargoyle on field (max +3 extra)",
    pyreGain: 1,
    
    effects: [
        {
            action: "gainPyre",
            amount: 1,
            owner: "cardOwner"
        },
        {
            action: "gainPyrePerNameMatch",
            match: "gargoyle",
            amountPer: 1,
            max: 3,
            owner: "cardOwner"
        }
    ]
});

// ==================== DECK BUILDING HELPERS ====================

window.DeckBuilder = {
    defaultDeckConfig: {
        cryptidCount: 15,
        basicPyreCount: 15,
        rarePyreCount: 5,
        otherInstanceCount: 10,
        rarityWeights: {
            common: 4,
            uncommon: 3,
            rare: 2,
            ultimate: 1
        }
    },
    
    buildRandomDeck(config = {}) {
        const settings = { ...this.defaultDeckConfig, ...config };
        const deck = [];
        
        const cryptidsByRarity = { common: [], uncommon: [], rare: [], ultimate: [] };
        for (const key of CardRegistry.getAllCryptidKeys()) {
            const card = CardRegistry.getCryptid(key);
            if (card.rarity && cryptidsByRarity[card.rarity]) {
                cryptidsByRarity[card.rarity].push(key);
            } else {
                cryptidsByRarity.common.push(key);
            }
        }
        
        const weightedPool = [];
        for (const [rarity, keys] of Object.entries(cryptidsByRarity)) {
            const weight = settings.rarityWeights[rarity] || 1;
            for (const key of keys) {
                for (let i = 0; i < weight; i++) {
                    weightedPool.push(key);
                }
            }
        }
        
        for (let i = 0; i < settings.cryptidCount; i++) {
            const key = weightedPool[Math.floor(Math.random() * weightedPool.length)];
            deck.push(CardRegistry.getCryptid(key));
        }
        
        for (let i = 0; i < settings.basicPyreCount; i++) {
            deck.push(CardRegistry.getPyre('pyre'));
        }
        
        const pyreKeys = CardRegistry.getAllPyreKeys();
        const rarePyreKeys = pyreKeys.filter(k => k !== 'pyre');
        if (rarePyreKeys.length > 0) {
            for (let i = 0; i < settings.rarePyreCount; i++) {
                const key = rarePyreKeys[Math.floor(Math.random() * rarePyreKeys.length)];
                deck.push(CardRegistry.getPyre(key));
            }
        } else {
            for (let i = 0; i < settings.rarePyreCount; i++) {
                deck.push(CardRegistry.getPyre('pyre'));
            }
        }
        
        const burstKeys = CardRegistry.getAllBurstKeys();
        const trapKeys = CardRegistry.getAllTrapKeys();
        const auraKeys = CardRegistry.getAllAuraKeys();
        
        const burstCount = Math.ceil(settings.otherInstanceCount * 0.4);
        const trapCount = Math.floor(settings.otherInstanceCount * 0.3);
        const auraCount = settings.otherInstanceCount - burstCount - trapCount;
        
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
    
    buildKindlingPool(deckCards = null) {
        const pool = [];
        let id = 1000;
        
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
        
        const allKindlingKeys = CardRegistry.getAllKindlingKeys();
        for (const key of allKindlingKeys) {
            const template = CardRegistry.getKindling(key);
            if (template) {
                pool.push({ ...template, id: id++, isKindling: true });
                pool.push({ ...template, id: id++, isKindling: true });
            }
        }
        
        console.log('[DeckBuilder] Built default kindling pool with', pool.length, 'cards from', allKindlingKeys.length, 'types');
        return pool;
    }
};

console.log('City of Flesh Series (DECLARATIVE) loaded:', {
    cryptids: CardRegistry.getAllCryptidKeys().length,
    bursts: CardRegistry.getAllBurstKeys().length,
    traps: CardRegistry.getAllTrapKeys().length,
    auras: CardRegistry.getAllAuraKeys().length,
    pyres: CardRegistry.getAllPyreKeys().length,
    kindling: CardRegistry.getAllKindlingKeys().length
});

if (typeof window.onCardsReady === 'function') {
    window.onCardsReady();
} else {
    window.cardsLoaded = true;
}
