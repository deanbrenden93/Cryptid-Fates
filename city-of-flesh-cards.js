/**
 * Cryptid Fates - Data-Driven Card Registry
 * 
 * Combines all card data and provides the CardRegistry interface.
 * Cards are pure data - no JavaScript functions.
 * 
 * This file should be loaded AFTER ability-system.js
 */

// ==================== CARD REGISTRY ====================

const CardRegistry = {
    cryptids: {},
    bursts: {},
    kindling: {},
    traps: {},
    auras: {},
    pyres: {},
    
    register(type, key, data) {
        const collection = this[type + 's'] || this[type];
        if (collection) {
            collection[key] = { ...data, key, type: type === 'kindling' ? 'cryptid' : type };
        }
    },
    
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
    
    getCard(key) {
        return this.getCryptid(key) ||
               this.getKindling(key) ||
               this.getBurst(key) ||
               this.getTrap(key) ||
               this.getAura(key) ||
               this.getPyre(key);
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

CardRegistry.registerKindling('hellpup', {
    name: "Hellpup",
    sprite: "sprites/hellhound_pup.png",
    element: "blood",
    cost: 0,
    hp: 1,
    atk: 1,
    rarity: "common",
    evolvesInto: 'hellhound',
    combatAbility: "Guard: Negate the first attack against Hellpup each turn. Burn the attacker.",
    supportAbility: "Combatant's attacks apply burn.",
    otherAbility: "If Hellpup would die from burn, evolve into Hellhound instead.",
    initialFlags: { guardAvailable: true },
    abilities: [
        { trigger: 'onMyTurnStart', condition: { type: 'inCombat' }, effects: [{ type: 'setFlag', flag: 'guardAvailable', value: true }] },
        { trigger: 'onBeforeDefend', condition: { type: 'hasFlag', flag: 'guardAvailable' }, effects: [
            { type: 'setFlag', flag: 'guardAvailable', value: false },
            { type: 'applyBurn', target: 'attacker' },
            { type: 'negateDamage' }
        ]},
        { trigger: 'onEnterSupport', effects: [{ type: 'grantFlag', flag: 'attacksApplyBurn', to: 'myCombatant' }] },
        { trigger: 'onLeavingSupport', effects: [{ type: 'revokeFlag', flag: 'attacksApplyBurn', from: 'myCombatant' }] },
        { trigger: 'onDeath', condition: { type: 'killedByBurn' }, effects: [{ type: 'preventDeath' }, { type: 'evolve', into: 'hellhound' }] }
    ]
});

CardRegistry.registerKindling('myling', {
    name: "Myling",
    sprite: "sprites/myling.png",
    element: "blood",
    cost: 0,
    hp: 3,
    atk: 0,
    rarity: "common",
    combatAbility: "+1 damage to burning enemies.",
    supportAbility: "When combatant takes damage from an enemy attack, burn the attacker.",
    otherAbility: "When Myling dies, burn all cryptids in the enemy row across from it.",
    bonusVsBurning: 1,
    abilities: [
        { trigger: 'onEnterSupport', effects: [{ type: 'grantFlag', flag: 'burnAttackersOnDamage', to: 'myCombatant' }] },
        { trigger: 'onLeavingSupport', effects: [{ type: 'revokeFlag', flag: 'burnAttackersOnDamage', from: 'myCombatant' }] },
        { trigger: 'onDeath', effects: [{ type: 'applyBurn', target: 'enemiesAcross' }] }
    ]
});

CardRegistry.registerKindling('vampireBat', {
    name: "Vampire Bat",
    sprite: "🦇",
    element: "blood",
    cost: 0,
    hp: 2,
    atk: 1,
    rarity: "common",
    evolvesInto: 'vampireInitiate',
    combatAbility: "Lifesteal: When Vampire Bat deals damage, heal that much HP.",
    supportAbility: "When combatant deals damage, gain 1 pyre.",
    hasLifesteal: true,
    abilities: [
        { trigger: 'onEnterSupport', effects: [{ type: 'grantFlag', flag: 'grantPyreOnDamage', to: 'myCombatant' }] },
        { trigger: 'onLeavingSupport', effects: [{ type: 'revokeFlag', flag: 'grantPyreOnDamage', from: 'myCombatant' }] }
    ]
});

CardRegistry.registerKindling('gremlin', {
    name: "Gremlin",
    sprite: "👺",
    element: "steel",
    cost: 0,
    hp: 2,
    atk: 1,
    rarity: "common",
    combatAbility: "Enemy combatant across has -1 ATK per ailment token.",
    supportAbility: "Ailmented enemies deal half damage when attacking combatant. Otherwise, combatant receives one fewer damage.",
    appliesAilmentAtkDebuff: true,
    abilities: [
        { trigger: 'onEnterSupport', effects: [{ type: 'grantFlag', flag: 'hasGremlinSupport', to: 'myCombatant' }] },
        { trigger: 'onLeavingSupport', effects: [{ type: 'revokeFlag', flag: 'hasGremlinSupport', from: 'myCombatant' }] }
    ]
});

CardRegistry.registerKindling('boggart', {
    name: "Boggart",
    sprite: "sprites/boggart.png",
    element: "steel",
    cost: 0,
    hp: 1,
    atk: 2,
    rarity: "common",
    evolvesInto: 'redcap',
    combatAbility: "Immune to ailments. When Boggart would gain an ailment, instead gain +1 ATK until end of your next turn.",
    supportAbility: "On enter: Cleanse all ailments from combatant and grant +1 HP per unique ailment cleansed.",
    ailmentImmune: true,
    abilities: [
        { trigger: 'onAilmentAttempt', effects: [{ type: 'buffAtk', amount: 1, temporary: true }] },
        { trigger: 'onEnterSupport', target: 'myCombatant', effects: [
            { type: 'buffHp', amount: { calc: 'uniqueAilments', of: 'myCombatant' }, permanent: true },
            { type: 'cleanse', target: 'myCombatant' }
        ]}
    ]
});

// ==================== CITY OF FLESH - CRYPTIDS ====================

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
    supportAbility: "Guardian's Sacrifice: When combatant would take lethal damage, survive with 1 HP. If attacker ailmented, full HP instead. One use.",
    abilities: [
        { trigger: 'onDefend', condition: { type: 'hasAnyAilment', target: 'attacker' }, effects: [{ type: 'reduceDamage', amount: 2 }] },
        { trigger: 'onEnterSupport', condition: { type: 'notFlag', flag: 'gargoyleSaveUsed' }, effects: [{ type: 'grantFlag', flag: 'hasRooftopGargoyleSupport', to: 'myCombatant' }] },
        { trigger: 'onLeavingSupport', effects: [{ type: 'revokeFlag', flag: 'hasRooftopGargoyleSupport', from: 'myCombatant' }] }
    ]
});

CardRegistry.registerCryptid('libraryGargoyle', {
    name: "Gargoyle of the Grand Library",
    sprite: "sprites/library-gargoylealt2.png",
    spriteScale: 1.3,
    spriteFlip: true,
    element: "steel",
    cost: 5,
    hp: 6,
    atk: 3,
    rarity: "uncommon",
    evolvesFrom: 'rooftopGargoyle',
    combatAbility: "Stone Bastion: Take half damage from ailmented enemies. When attacked by ailmented enemy, draw a card.",
    supportAbility: "On enter, if any enemy ailmented, grant +3 HP to combatant. Combatant draws 2 on ailmented kill.",
    otherAbility: "At turn start, if 2+ enemies ailmented, gain 1 pyre.",
    stoneBastion: true,
    abilities: [
        { trigger: 'onDamaged', condition: { type: 'hasAnyAilment', target: 'attacker' }, effects: [{ type: 'drawCard', amount: 1 }] },
        { trigger: 'onEnterSupport', condition: { type: 'ailmentedEnemyCountGte', value: 1 }, effects: [{ type: 'buffHp', target: 'myCombatant', amount: 3, permanent: true }] },
        { trigger: 'onEnterSupport', effects: [{ type: 'grantFlag', flag: 'hasLibraryGargoyleSupport', to: 'myCombatant' }] },
        { trigger: 'onLeavingSupport', effects: [{ type: 'revokeFlag', flag: 'hasLibraryGargoyleSupport', from: 'myCombatant' }] },
        { trigger: 'onMyTurnStart', condition: { type: 'ailmentedEnemyCountGte', value: 2 }, effects: [{ type: 'gainPyre', amount: 1 }] }
    ]
});

CardRegistry.registerCryptid('sewerAlligator', {
    name: "Sewer Alligator",
    sprite: "🐊",
    element: "water",
    cost: 3,
    hp: 4,
    atk: 2,
    rarity: "uncommon",
    combatAbility: "+2 damage to burned/toxic enemies. On bonus damage: regen 4HP, +1 ATK permanent",
    supportAbility: "Combatant regen 2HP on rest. On combatant death, enemy slot becomes toxic",
    bonusVsBurning: 2,
    bonusVsToxic: 2,
    abilities: [
        { trigger: 'onHit', condition: { type: 'or', conditions: [{ type: 'hasBurn', target: 'target' }, { type: 'hasFlag', flag: 'isInToxic', target: 'target' }] }, effects: [{ type: 'heal', amount: 4 }, { type: 'buffAtk', amount: 1, permanent: true }] },
        { trigger: 'onEnterSupport', effects: [{ type: 'grantFlag', flag: 'hasSewerAlligatorSupport', to: 'myCombatant' }] },
        { trigger: 'onLeavingSupport', effects: [{ type: 'revokeFlag', flag: 'hasSewerAlligatorSupport', from: 'myCombatant' }] },
        { trigger: 'onCombatantDeath', condition: { type: 'inSupport' }, effects: [{ type: 'applyToxic', target: 'enemyAcrossSlot' }] }
    ]
});

CardRegistry.registerCryptid('kuchisakeOnna', {
    name: "Kuchisake-Onna",
    sprite: "👩",
    element: "blood",
    cost: 4,
    hp: 7,
    atk: 5,
    rarity: "rare",
    mythical: true,
    combatAbility: "Slit: Burn target before attacking. If kill burning enemy, explosion deals half base HP to adjacent.",
    supportAbility: "Am I Pretty?: May sacrifice combatant to become 9/7 with Destroyer.",
    otherAbility: "At turn end, if no enemies across, gain Bleed.",
    hasKuchisakeExplosion: true,
    abilities: [
        { trigger: 'onBeforeAttack', effects: [{ type: 'applyBurn', target: 'target' }] },
        { trigger: 'onEnterSupport', effects: [{ type: 'setFlag', flag: 'hasSacrificeAbility', value: true }, { type: 'setFlag', flag: 'sacrificeAbilityAvailable', value: true }] },
        { trigger: 'activatable', id: 'kuchisakeSacrifice', condition: { type: 'and', conditions: [{ type: 'hasFlag', flag: 'sacrificeAbilityAvailable' }, { type: 'hasCombatant' }] }, effects: [
            { type: 'kill', target: 'myCombatant', killedBy: 'sacrifice' },
            { type: 'setAtk', amount: 9 }, { type: 'setHp', amount: 7 },
            { type: 'setFlag', flag: 'hasDestroyer', value: true },
            { type: 'setFlag', flag: 'sacrificeAbilityAvailable', value: false }
        ]},
        { trigger: 'onMyTurnEnd', condition: { type: 'and', conditions: [{ type: 'inCombat' }, { type: 'not', condition: { type: 'hasEnemyAcross' } }] }, effects: [{ type: 'applyBleed', target: 'self' }] }
    ]
});

CardRegistry.registerCryptid('hellhound', {
    name: "Hellhound",
    sprite: "sprites/hellhound.png",
    element: "blood",
    cost: 3,
    hp: 4,
    atk: 2,
    rarity: "common",
    evolvesFrom: 'hellpup',
    combatAbility: "Burn target before attack. If already burning, also burn random adjacent enemy.",
    supportAbility: "Combatant +2 damage to burning. On kill burning enemy, spread burn to adjacent.",
    abilities: [
        { trigger: 'onBeforeAttack', effects: [
            { type: 'conditional', condition: { type: 'hasBurn', target: 'target' },
              then: [{ type: 'applyBurn', target: 'target' }, { type: 'applyBurn', target: 'randomAdjacent' }],
              else: [{ type: 'applyBurn', target: 'target' }] }
        ]},
        { trigger: 'onEnterSupport', effects: [{ type: 'grantFlag', flag: 'hellhoundSupport', to: 'myCombatant' }] },
        { trigger: 'onLeavingSupport', effects: [{ type: 'revokeFlag', flag: 'hellhoundSupport', from: 'myCombatant' }] }
    ],
    supportGrants: { bonusVsBurning: 2 }
});

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
    supportAbility: "Extinction: Cleanse all combatants and grant +1/+1 per stack. While here, combatants immune to ailments.",
    otherAbility: "When ailmented enemy dies, Mothman gains +1/+1 permanently.",
    canTargetAny: true,
    abilities: [
        { trigger: 'onEnterCombat', effects: [{ type: 'forEach', in: 'allEnemies', do: [{ type: 'dealDamage', amount: { calc: 'ailmentStacks', of: 'current' }, source: 'harbinger' }] }] },
        { trigger: 'onEnterSupport', effects: [
            { type: 'forEach', in: 'allMyCombatants', do: [
                { type: 'buffBoth', amount: { calc: 'ailmentStacks', of: 'current' }, permanent: true },
                { type: 'cleanse' },
                { type: 'setFlag', flag: 'hasMothmanAilmentImmunity', value: true }
            ]},
            { type: 'setFlag', flag: 'grantsMothmanImmunity', value: true }
        ]},
        { trigger: 'onLeavingSupport', effects: [
            { type: 'forEach', in: 'allMyCombatants', do: [{ type: 'clearFlag', flag: 'hasMothmanAilmentImmunity' }] },
            { type: 'clearFlag', flag: 'grantsMothmanImmunity' }
        ]},
        { trigger: 'onEnemyDeath', condition: { type: 'victimHadAilment' }, effects: [{ type: 'buffBoth', amount: 1, permanent: true }] }
    ]
});

CardRegistry.registerCryptid('bogeyman', {
    name: "Bogeyman",
    sprite: "👤",
    element: "void",
    cost: 2,
    hp: 3,
    atk: 1,
    rarity: "common",
    evolvesFrom: 'shadowPerson',
    evolvesInto: 'theFlayer',
    combatAbility: "Terror: Paralyze enemies across on entering combat. +3 vs paralyzed",
    supportAbility: "Nightmare: Negate enemy support abilities across",
    bonusVsParalyzed: 3,
    abilities: [
        { trigger: 'onEnterCombat', effects: [{ type: 'applyParalyze', target: 'enemiesAcross' }] },
        { trigger: 'onEnterSupport', effects: [{ type: 'setFlag', flag: 'negatesEnemySupport', value: true }] },
        { trigger: 'onLeavingSupport', effects: [{ type: 'clearFlag', flag: 'negatesEnemySupport' }] }
    ]
});

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
    abilities: [
        { trigger: 'onEnterCombat', effects: [{ type: 'applyParalyze', target: 'allEnemyCombatants' }] },
        { trigger: 'onKill', condition: { type: 'hasParalyze', target: 'victim' }, effects: [{ type: 'gainPyre', amount: 1 }, { type: 'drawCard', amount: 1 }] },
        { trigger: 'onEnterSupport', effects: [{ type: 'grantFlag', flag: 'hasFocus', to: 'myCombatant' }, { type: 'grantFlag', flag: 'attacksApplyParalyze', to: 'myCombatant' }] },
        { trigger: 'onLeavingSupport', effects: [{ type: 'revokeFlag', flag: 'hasFocus', from: 'myCombatant' }, { type: 'revokeFlag', flag: 'attacksApplyParalyze', from: 'myCombatant' }] }
    ]
});

CardRegistry.registerCryptid('decayRat', {
    name: "Decay Rat",
    sprite: "🐀",
    element: "steel",
    cost: 3,
    hp: 4,
    atk: 3,
    rarity: "uncommon",
    combatAbility: "Pestilence: When dealing damage to ailmented enemy, add 1 turn to each ailment.",
    supportAbility: "Once per turn, choose ailmented enemy. It gets -1/-1 per ailment stack until end of turn.",
    abilities: [
        { trigger: 'onHit', condition: { type: 'hasAnyAilment', target: 'target' }, effects: [{ type: 'extendAilments', target: 'target', turns: 1 }] },
        { trigger: 'onEnterSupport', effects: [{ type: 'setFlag', flag: 'hasDecayRatAbility', value: true }, { type: 'setFlag', flag: 'decayRatDebuffAvailable', value: true }] },
        { trigger: 'onMyTurnStart', condition: { type: 'inSupport' }, effects: [{ type: 'setFlag', flag: 'decayRatDebuffAvailable', value: true }] },
        { trigger: 'activatable', id: 'decayDebuff', requiresTarget: true, targetCondition: { type: 'hasAnyAilment' }, condition: { type: 'hasFlag', flag: 'decayRatDebuffAvailable' }, effects: [
            { type: 'setFlag', flag: 'decayRatDebuffAvailable', value: false },
            { type: 'debuffBoth', target: 'selectedTarget', amount: { calc: 'ailmentStacks', of: 'selectedTarget' }, temporary: true }
        ]}
    ]
});

CardRegistry.registerCryptid('moleman', {
    name: "Moleman",
    sprite: "🦡",
    element: "steel",
    cost: 2,
    hp: 2,
    atk: 3,
    rarity: "common",
    combatAbility: "Burrow: May only attack combatant in row or any support. +2 damage to ailmented.",
    supportAbility: "Combatant's attacks vs supports also deal half damage to adjacent supports.",
    hasBurrowTargeting: true,
    bonusVsAilment: 2,
    abilities: [
        { trigger: 'onEnterSupport', effects: [{ type: 'grantFlag', flag: 'hasMolemanSplash', to: 'myCombatant' }] },
        { trigger: 'onLeavingSupport', effects: [{ type: 'revokeFlag', flag: 'hasMolemanSplash', from: 'myCombatant' }] }
    ]
});

CardRegistry.registerCryptid('vampireInitiate', {
    name: "Vampire Initiate",
    sprite: "sprites/vampire-initiate.png",
    spriteScale: 1.2,
    element: "blood",
    cost: 2,
    hp: 3,
    atk: 2,
    rarity: "common",
    evolvesFrom: 'vampireBat',
    evolvesInto: 'vampireLord',
    combatAbility: "Siphon: Lifesteal. On attack, gain 1 pyre.",
    supportAbility: "Blood Pact: Once per turn, deal 1 damage to combatant to gain 1 pyre.",
    hasLifesteal: true,
    abilities: [
        { trigger: 'onAttack', effects: [{ type: 'gainPyre', amount: 1 }] },
        { trigger: 'onEnterSupport', effects: [{ type: 'setFlag', flag: 'hasBloodPactAbility', value: true }, { type: 'setFlag', flag: 'bloodPactAvailable', value: true }] },
        { trigger: 'onMyTurnStart', condition: { type: 'inSupport' }, effects: [{ type: 'setFlag', flag: 'bloodPactAvailable', value: true }] },
        { trigger: 'activatable', id: 'bloodPact', condition: { type: 'and', conditions: [{ type: 'hasFlag', flag: 'bloodPactAvailable' }, { type: 'hasCombatant' }] }, effects: [
            { type: 'setFlag', flag: 'bloodPactAvailable', value: false },
            { type: 'dealDamage', target: 'myCombatant', amount: 1, source: 'bloodPact' },
            { type: 'gainPyre', amount: 1 }
        ]}
    ]
});

CardRegistry.registerCryptid('redcap', {
    name: "Redcap",
    sprite: "🧢",
    element: "blood",
    cost: 3,
    hp: 2,
    atk: 5,
    rarity: "uncommon",
    evolvesFrom: 'boggart',
    combatAbility: "Lifesteal. Bloodlust: +1 damage per ailmented enemy on field.",
    supportAbility: "When combatant kills, +1 ATK to both. If ailmented kill, also +1 HP to both.",
    otherAbility: "If no kill by turn end, HP becomes 1.",
    hasLifesteal: true,
    dynamicBonusDamage: { calc: 'ailmentedEnemyCount' },
    abilities: [
        { trigger: 'onSummon', effects: [{ type: 'setFlag', flag: 'gotKillThisTurn', value: false }] },
        { trigger: 'onMyTurnStart', effects: [{ type: 'setFlag', flag: 'gotKillThisTurn', value: false }] },
        { trigger: 'onKill', effects: [{ type: 'setFlag', flag: 'gotKillThisTurn', value: true }] },
        { trigger: 'onEnterSupport', effects: [{ type: 'grantFlag', flag: 'redcapSupport', to: 'myCombatant' }] },
        { trigger: 'onLeavingSupport', effects: [{ type: 'revokeFlag', flag: 'redcapSupport', from: 'myCombatant' }] },
        { trigger: 'onMyTurnEnd', condition: { type: 'and', conditions: [{ type: 'inCombat' }, { type: 'notFlag', flag: 'gotKillThisTurn' }] }, effects: [{ type: 'setHp', amount: 1 }] }
    ]
});

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
    combatAbility: "Lifesteal. +3 vs burning. On burning kill, gain pyre equal to victim's cost.",
    supportAbility: "Combatant has Lifesteal and +2 vs burning. On burning kill, draw a card.",
    hasLifesteal: true,
    bonusVsBurning: 3,
    abilities: [
        { trigger: 'onKill', condition: { type: 'hasBurn', target: 'victim' }, effects: [{ type: 'gainPyre', amount: { calc: 'targetCost', of: 'victim' } }] },
        { trigger: 'onEnterSupport', effects: [{ type: 'grantFlag', flag: 'hasLifesteal', to: 'myCombatant' }, { type: 'grantFlag', flag: 'vampireLordSupport', to: 'myCombatant' }] },
        { trigger: 'onLeavingSupport', effects: [{ type: 'revokeFlag', flag: 'hasLifesteal', from: 'myCombatant' }, { type: 'revokeFlag', flag: 'vampireLordSupport', from: 'myCombatant' }] }
    ],
    supportGrants: { bonusVsBurning: 2 }
});

// ==================== TRAPS ====================

CardRegistry.registerTrap('crossroads', {
    name: "Crossroads",
    sprite: "✝️",
    cost: 3,
    rarity: "common",
    description: "Stop lethal attack, rest attacker, draw 2 cards (+1 if evolution)",
    triggerDescription: "Triggers: When enemy attack would kill your cryptid",
    triggerEvent: 'onAttackDeclared',
    triggerCondition: { type: 'lethalAttack', defenderOwner: 'self' },
    effects: [
        { type: 'tap', target: 'attacker' },
        { type: 'cancelAttack' },
        { type: 'drawCard', amount: 2 },
        { type: 'conditional', condition: { type: 'drewEvolution' }, then: [{ type: 'drawCard', amount: 1 }] }
    ]
});

CardRegistry.registerTrap('bloodCovenant', {
    name: "Blood Covenant",
    sprite: "🩸",
    cost: 2,
    rarity: "rare",
    description: "Kill the attacker that killed your cryptid",
    triggerDescription: "Triggers: When your cryptid dies from enemy attack",
    triggerEvent: 'onDeath',
    triggerCondition: { type: 'deathByEnemyAttack', victimOwner: 'self' },
    effects: [{ type: 'kill', target: 'killerCryptid', killedBy: 'bloodCovenant' }]
});

CardRegistry.registerTrap('turnToStone', {
    name: "Turn to Stone",
    sprite: "🪨",
    cost: 1,
    rarity: "common",
    description: "Stop attack, rest and paralyze attacker",
    triggerDescription: "Triggers: When your cryptid is targeted for attack",
    triggerEvent: 'onAttackDeclared',
    triggerCondition: { type: 'targetedForAttack', defenderOwner: 'self' },
    effects: [
        { type: 'tap', target: 'attacker' },
        { type: 'applyParalyze', target: 'attacker' },
        { type: 'cancelAttack' }
    ]
});

// ==================== BURSTS ====================

CardRegistry.registerBurst('wakingNightmare', {
    name: "Waking Nightmare",
    sprite: "😱",
    cost: 1,
    rarity: "common",
    description: "Untap ally OR tap enemy",
    targetType: 'any',
    effects: [
        { type: 'conditional', condition: { type: 'targetIsAlly' },
          then: [{ type: 'untap', target: 'target' }],
          else: [{ type: 'tap', target: 'target' }] }
    ]
});

CardRegistry.registerBurst('faceOff', {
    name: "Face-Off",
    sprite: "⚔️",
    cost: 1,
    rarity: "common",
    description: "Force target cryptid to attack the enemy combatant across from it",
    targetType: 'any',
    requiresEnemyAcross: true,
    effects: [
        { type: 'untap', target: 'target' },
        { type: 'forceAttack', attacker: 'target', forceTarget: 'enemyCombatantAcross' }
    ]
});

// ==================== AURAS ====================

CardRegistry.registerAura('antiVampiricBlade', {
    name: "Anti-Vampiric Blade",
    sprite: "🗡️",
    cost: 3,
    rarity: "common",
    description: "+2 ATK, regen 2HP/turn, focus. +2 ATK if enemy diagonal/across has ailment",
    targetType: 'allyCombatant',
    atkBonus: 2,
    grantsFlags: ['hasFocus'],
    grantsRegeneration: 2,
    onApplyEffects: [
        { type: 'grantFlag', flag: 'hasFocus', to: 'target' },
        { type: 'conditional', condition: { type: 'hasAilmentedEnemyNearby' }, then: [{ type: 'buffAtk', target: 'target', amount: 2 }] }
    ]
});

// ==================== PYRES ====================

CardRegistry.registerPyre('pyre', {
    name: "Basic",
    sprite: "🔥",
    rarity: "common",
    description: "Gain 1 pyre",
    infinite: true,
    effects: [{ type: 'gainPyre', amount: 1 }]
});

CardRegistry.registerPyre('freshKill', {
    name: "Fresh Kill",
    sprite: "🦇",
    rarity: "uncommon",
    description: "+1 pyre, +1 per Vampire on field (max +3 extra)",
    effects: [{ type: 'gainPyre', amount: { calc: 'sum', values: [1, { calc: 'min', a: { calc: 'vampireCount' }, max: 3 }] } }]
});

CardRegistry.registerPyre('ratKing', {
    name: "Rat King",
    sprite: "👑",
    rarity: "ultimate",
    description: "+1 pyre and draw 1 for each ally death last enemy turn (max 3)",
    effects: [
        { type: 'gainPyre', amount: { calc: 'sum', values: [1, { calc: 'min', a: { calc: 'allyDeathsLastTurn' }, max: 3 }] } },
        { type: 'drawCard', amount: { calc: 'min', a: { calc: 'allyDeathsLastTurn' }, max: 3 } }
    ]
});

CardRegistry.registerPyre('nightfall', {
    name: "Nightfall",
    sprite: "🌙",
    rarity: "uncommon",
    description: "+1 pyre, +1 per Gargoyle on field (max +3 extra)",
    effects: [{ type: 'gainPyre', amount: { calc: 'sum', values: [1, { calc: 'min', a: { calc: 'gargoyleCount' }, max: 3 }] } }]
});

// ==================== DECK BUILDER ====================
// Provides deck building utilities for the game

window.DeckBuilder = {
    // Default deck composition
    defaultDeckConfig: {
        cryptidCount: 15,
        basicPyreCount: 15,
        rarePyreCount: 5,
        burstCount: 5,
        trapCount: 3,
        auraCount: 2
    },
    
    /**
     * Build a random deck from all available cards
     * @param {Object} config - Optional deck composition config
     * @returns {Array} Shuffled deck of card objects
     */
    buildRandomDeck(config = null) {
        const cfg = config || this.defaultDeckConfig;
        const deck = [];
        let cardId = 1;
        
        // Get all available cards
        const cryptidKeys = CardRegistry.getAllCryptidKeys();
        const burstKeys = CardRegistry.getAllBurstKeys();
        const trapKeys = CardRegistry.getAllTrapKeys();
        const auraKeys = CardRegistry.getAllAuraKeys();
        const pyreKeys = CardRegistry.getAllPyreKeys();
        
        // Helper to pick random from array
        const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
        
        // Add cryptids
        for (let i = 0; i < cfg.cryptidCount && cryptidKeys.length > 0; i++) {
            const key = pickRandom(cryptidKeys);
            const card = CardRegistry.getCryptid(key);
            if (card) deck.push({ ...card, id: cardId++ });
        }
        
        // Add basic pyres (infinite copies allowed)
        const basicPyre = CardRegistry.getPyre('pyre');
        if (basicPyre) {
            for (let i = 0; i < cfg.basicPyreCount; i++) {
                deck.push({ ...basicPyre, id: cardId++ });
            }
        }
        
        // Add rare pyres
        const rarePyres = pyreKeys.filter(k => k !== 'pyre');
        for (let i = 0; i < cfg.rarePyreCount && rarePyres.length > 0; i++) {
            const key = pickRandom(rarePyres);
            const card = CardRegistry.getPyre(key);
            if (card) deck.push({ ...card, id: cardId++ });
        }
        
        // Add bursts
        for (let i = 0; i < cfg.burstCount && burstKeys.length > 0; i++) {
            const key = pickRandom(burstKeys);
            const card = CardRegistry.getBurst(key);
            if (card) deck.push({ ...card, id: cardId++ });
        }
        
        // Add traps
        for (let i = 0; i < cfg.trapCount && trapKeys.length > 0; i++) {
            const key = pickRandom(trapKeys);
            const card = CardRegistry.getTrap(key);
            if (card) deck.push({ ...card, id: cardId++ });
        }
        
        // Add auras
        for (let i = 0; i < cfg.auraCount && auraKeys.length > 0; i++) {
            const key = pickRandom(auraKeys);
            const card = CardRegistry.getAura(key);
            if (card) deck.push({ ...card, id: cardId++ });
        }
        
        // Shuffle
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        
        console.log('[DeckBuilder] Built random deck with', deck.length, 'cards');
        return deck;
    },
    
    /**
     * Build kindling pool (separate from main deck)
     * @param {Object} deckConfig - Optional deck to get kindling from
     * @returns {Array} Pool of kindling cards
     */
    buildKindlingPool(deckConfig = null) {
        const pool = [];
        let kindlingId = 1000;
        
        // If deck specifies kindling, use those
        if (deckConfig?.kindling) {
            for (const entry of deckConfig.kindling) {
                const card = CardRegistry.getKindling(entry.cardKey || entry.key);
                if (card) {
                    pool.push({ ...card, id: kindlingId++ });
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
            const card = CardRegistry.getKindling(key);
            if (card) {
                pool.push({ ...card, id: kindlingId++ });
                pool.push({ ...card, id: kindlingId++ }); // 2 copies
            }
        }
        
        console.log('[DeckBuilder] Built default kindling pool with', pool.length, 'cards from', allKindlingKeys.length, 'types');
        return pool;
    }
};

// ==================== EXPORTS ====================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CardRegistry, DeckBuilder: window.DeckBuilder };
}

if (typeof window !== 'undefined') {
    window.CardRegistry = CardRegistry;
}

console.log('City of Flesh Data-Driven Cards loaded:', {
    cryptids: CardRegistry.getAllCryptidKeys().length,
    kindling: CardRegistry.getAllKindlingKeys().length,
    bursts: CardRegistry.getAllBurstKeys().length,
    traps: CardRegistry.getAllTrapKeys().length,
    auras: CardRegistry.getAllAuraKeys().length,
    pyres: CardRegistry.getAllPyreKeys().length
});