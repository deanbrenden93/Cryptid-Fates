/**
 * Cryptid Fates - Shared Effect Schema System
 * 
 * Isomorphic effect vocabulary that defines:
 * - WHEN effects trigger (Triggers)
 * - WHAT effects do (Actions)
 * - WHO effects target (Targets)
 * - IF effects should activate (Conditions)
 * - HOW amounts are calculated (Calculations)
 * 
 * Cards declare effects like:
 *   { trigger: "onSummon", action: "dealDamage", target: "allEnemies", amount: 2 }
 * 
 * This module is used identically on client and server.
 */

(function() {
'use strict';

// ==================== EFFECT TRIGGERS ====================
// These define WHEN an effect activates

const SharedEffectTriggers = {
    // Summon/Position Triggers
    onSummon: 'onSummon',                    // When card enters the field (any position)
    onEnterCombat: 'onEnterCombat',          // When card enters combat column
    onEnterSupport: 'onEnterSupport',        // When card enters support column
    onLeaveCombat: 'onLeaveCombat',          // When card leaves combat column
    onLeaveSupport: 'onLeaveSupport',        // When card leaves support column
    onLeavingSupport: 'onLeavingSupport',    // Alias for consistency
    onPromotion: 'onPromotion',              // When support promotes to combat
    
    // Combat Triggers
    onAttack: 'onAttack',                    // When this card attacks
    onCombatAttack: 'onCombatAttack',        // When this card attacks in combat
    onAttackDeclared: 'onAttackDeclared',    // When attack is declared (before resolution)
    onBeforeAttack: 'onBeforeAttack',        // Right before attack resolves
    onBeforeDefend: 'onBeforeDefend',        // Right before being attacked
    onDamageDealt: 'onDamageDealt',          // When this card deals damage
    onDamageTaken: 'onDamageTaken',          // When this card takes damage
    onDamagedByAttack: 'onDamagedByAttack',  // When damaged specifically by attack
    onKill: 'onKill',                        // When this card kills an enemy
    
    // Death Triggers
    onDeath: 'onDeath',                      // When this card dies
    onAllyDeath: 'onAllyDeath',              // When a friendly card dies
    onEnemyDeath: 'onEnemyDeath',            // When an enemy card dies
    onAnyDeath: 'onAnyDeath',                // When any card dies
    onCombatantDeath: 'onCombatantDeath',    // When combatant in same row dies
    onCombatantKill: 'onCombatantKill',      // When combatant kills something
    
    // Turn Triggers
    onTurnStart: 'onTurnStart',              // At start of owner's turn
    onTurnEnd: 'onTurnEnd',                  // At end of owner's turn
    onEnemyTurnStart: 'onEnemyTurnStart',    // At start of enemy's turn
    onEnemyTurnEnd: 'onEnemyTurnEnd',        // At end of enemy's turn
    
    // Aura Triggers (continuous effects)
    whileInCombat: 'whileInCombat',          // Continuous effect while in combat
    whileInSupport: 'whileInSupport',        // Continuous effect while in support
    whileAlive: 'whileAlive',                // Continuous effect while on field
    
    // Resource Triggers
    onPyreGain: 'onPyreGain',                // When owner gains pyre
    onPyreSpend: 'onPyreSpend',              // When owner spends pyre
    onDraw: 'onDraw',                        // When owner draws a card
    
    // Ailment Triggers
    onAilmentApplied: 'onAilmentApplied',    // When an ailment is applied to this
    onAilmentCleansed: 'onAilmentCleansed',  // When an ailment is removed from this
    onAilmentAttempt: 'onAilmentAttempt',    // When ailment is attempted (for immunity)
    
    // Aura/Equipment Triggers
    onApply: 'onApply',                      // When aura/equipment is applied
    onRemove: 'onRemove',                    // When aura/equipment is removed
};

// ==================== EFFECT ACTIONS ====================
// These define WHAT happens when an effect triggers

const SharedEffectActions = {
    // Damage Actions
    dealDamage: 'dealDamage',                // Deal damage to target(s)
    dealDamagePerStack: 'dealDamagePerStack',// Deal damage based on ailment stacks
    dealDamagePerAilmentStack: 'dealDamagePerAilmentStack', // Per ailment stack damage
    
    // Healing Actions
    heal: 'heal',                            // Restore HP to target(s)
    healToFull: 'healToFull',                // Restore to max HP
    
    // Stat Modification Actions
    buffStats: 'buffStats',                  // Increase ATK/HP
    buffSelf: 'buffSelf',                    // Buff self shorthand
    debuffStats: 'debuffStats',              // Decrease ATK/HP
    setStats: 'setStats',                    // Set ATK/HP to specific values
    setHp: 'setHp',                          // Set HP to specific value
    copyStats: 'copyStats',                  // Copy stats from another card
    swapStats: 'swapStats',                  // Swap ATK and HP
    gainPermanentStat: 'gainPermanentStat',  // Permanent stat gain
    
    // Ailment Actions
    applyAilment: 'applyAilment',            // Generic ailment application
    applyBurn: 'applyBurn',                  // Apply burn ailment
    applyBleed: 'applyBleed',                // Apply bleed ailment
    applyParalyze: 'applyParalyze',          // Apply paralyze ailment
    applyCalamity: 'applyCalamity',          // Apply calamity counters
    applyCurse: 'applyCurse',                // Apply curse tokens
    cleanse: 'cleanse',                      // Remove ailments
    cleanseAndBuff: 'cleanseAndBuff',        // Remove ailments and buff per stack
    cleanseAndBuffHp: 'cleanseAndBuffHp',    // Cleanse and buff HP
    extendAilments: 'extendAilments',        // Add turns to existing ailments
    
    // Keyword Actions
    grantKeyword: 'grantKeyword',            // Grant a keyword (flight, destroyer, etc.)
    removeKeyword: 'removeKeyword',          // Remove a keyword
    
    // Flag Actions
    grantFlag: 'grantFlag',                  // Grant a game flag
    setFlag: 'setFlag',                      // Set a flag value
    removeFlag: 'removeFlag',                // Remove a flag
    
    // Combat Bonus Actions
    grantCombatBonus: 'grantCombatBonus',    // Grant combat damage bonus
    removeCombatBonus: 'removeCombatBonus',  // Remove combat damage bonus
    
    // Aura Actions
    grantAura: 'grantAura',                  // Apply continuous effect to targets
    removeAura: 'removeAura',                // Remove continuous effect
    grantRegeneration: 'grantRegeneration',  // Grant regeneration
    
    // Position Actions
    move: 'move',                            // Move card to new position
    swap: 'swap',                            // Swap positions with another card
    destroy: 'destroy',                      // Destroy/kill target(s)
    summon: 'summon',                        // Summon a new card
    returnToHand: 'returnToHand',            // Return card to hand
    forceRest: 'forceRest',                  // Force a cryptid to rest
    untap: 'untap',                          // Untap/refresh a cryptid
    
    // Resource Actions
    gainPyre: 'gainPyre',                    // Gain pyre for owner
    drainPyre: 'drainPyre',                  // Steal pyre from enemy
    drawCard: 'drawCard',                    // Draw card(s)
    discardCard: 'discardCard',              // Discard card(s)
    gainPyrePerNameMatch: 'gainPyrePerNameMatch',  // Pyre per card name
    gainPyrePerDeathLastTurn: 'gainPyrePerDeathLastTurn',
    drawCardPerDeathLastTurn: 'drawCardPerDeathLastTurn',
    drawCardIfEvolution: 'drawCardIfEvolution',
    
    // Combat Actions
    forceAttackAcross: 'forceAttackAcross',  // Force attack on enemy across
    cancelAttack: 'cancelAttack',            // Cancel current attack
    reduceDamage: 'reduceDamage',            // Reduce incoming damage
    bonusDamageWithReward: 'bonusDamageWithReward',
    bonusDamagePerAilmentedEnemy: 'bonusDamagePerAilmentedEnemy',
    burnWithSpread: 'burnWithSpread',        // Burn with spread mechanics
    
    // Special Actions
    transform: 'transform',                  // Transform into another card
    silence: 'silence',                      // Remove all abilities
    protect: 'protect',                      // Grant damage immunity
    counter: 'counter',                      // Counter/negate an effect
    repeat: 'repeat',                        // Repeat another effect
    
    // Evolution Actions
    evolveFromDeathTrigger: 'evolveFromDeathTrigger',
    convertAilmentToTempAtk: 'convertAilmentToTempAtk',
    applyAilmentAtkDebuff: 'applyAilmentAtkDebuff',
    applyToxicSlot: 'applyToxicSlot',
    
    // Trap Actions
    killKiller: 'killKiller',                // Kill the attacker that killed
    
    // Activated Ability Actions
    killCombatant: 'killCombatant',
    damageCombatant: 'damageCombatant',
    debuffTarget: 'debuffTarget',
    damageTarget: 'damageTarget',
};

// ==================== EFFECT TARGETS ====================
// These define WHO/WHAT is affected by an effect

const SharedEffectTargets = {
    // Self
    self: 'self',                            // The card with this effect
    
    // Allies (same owner)
    allAllies: 'allAllies',                  // All friendly cards on field
    allyCombatants: 'allyCombatants',        // All friendly cards in combat column
    allySupports: 'allySupports',            // All friendly cards in support column
    allyInSameRow: 'allyInSameRow',          // Friendly card in same row (combat/support pair)
    randomAlly: 'randomAlly',                // Random friendly card
    weakestAlly: 'weakestAlly',              // Ally with lowest HP
    strongestAlly: 'strongestAlly',          // Ally with highest ATK
    myCombatant: 'myCombatant',              // Combatant in same row as this support
    
    // Enemies (opposite owner)
    allEnemies: 'allEnemies',                // All enemy cards on field
    enemyCombatants: 'enemyCombatants',      // All enemy cards in combat column
    enemySupports: 'enemySupports',          // All enemy cards in support column
    enemyOpposite: 'enemyOpposite',          // Enemy in same row (direct opponent)
    enemyOppositeSupport: 'enemyOppositeSupport', // Enemy support in same row
    enemiesAcross: 'enemiesAcross',          // Both enemies in same row
    enemyCombatantAcross: 'enemyCombatantAcross', // Enemy combatant across
    enemyCombatSlotAcross: 'enemyCombatSlotAcross',
    enemyRowAcross: 'enemyRowAcross',        // All enemies in row across
    randomEnemy: 'randomEnemy',              // Random enemy card
    weakestEnemy: 'weakestEnemy',            // Enemy with lowest HP
    strongestEnemy: 'strongestEnemy',        // Enemy with highest ATK
    ailmentedEnemies: 'ailmentedEnemies',    // All enemies with ailments
    randomAdjacentToVictim: 'randomAdjacentToVictim',
    
    // Row-based
    sameRow: 'sameRow',                      // All cards in same row (both sides)
    adjacentRows: 'adjacentRows',            // Cards in rows above/below
    
    // All
    allCards: 'allCards',                    // Every card on the field
    
    // Special
    attacker: 'attacker',                    // The card that attacked (for onDamageTaken)
    attackTarget: 'attackTarget',            // Target of current attack
    defender: 'defender',                    // The card being attacked
    killer: 'killer',                        // The card that caused death (for onDeath)
    triggerSource: 'triggerSource',          // Whatever triggered this effect
    spellTarget: 'spellTarget',              // Target selected for spell
    auraTarget: 'auraTarget',                // Target of aura effect
    trapOwner: 'trapOwner',                  // Owner of trap
    cardOwner: 'cardOwner',                  // Owner of the card
};

// ==================== EFFECT CONDITIONS ====================
// These define IF an effect should activate (beyond just the trigger)

const SharedEffectConditions = {
    // HP Conditions
    selfHpBelow: 'selfHpBelow',              // Self HP is below X or X%
    selfHpAbove: 'selfHpAbove',              // Self HP is above X or X%
    selfHpFull: 'selfHpFull',                // Self is at full HP
    selfDamaged: 'selfDamaged',              // Self has taken damage
    targetHpBelow: 'targetHpBelow',          // Target HP is below X
    targetHpAbove: 'targetHpAbove',          // Target HP is above X
    
    // Ailment Conditions
    selfHasAilment: 'selfHasAilment',        // Self has any/specific ailment
    selfNoAilment: 'selfNoAilment',          // Self has no ailments
    targetHasAilment: 'targetHasAilment',    // Target has ailment(s)
    targetHadAilments: 'targetHadAilments',  // Target had ailments (for death triggers)
    attackerHasAilment: 'attackerHasAilment',// Attacker has ailment
    victimHadAilment: 'victimHadAilment',    // Killed target had ailment
    victimWasBurning: 'victimWasBurning',    // Killed target was burning
    victimWasParalyzed: 'victimWasParalyzed',// Killed target was paralyzed
    targetBurnedOrToxic: 'targetBurnedOrToxic',
    anyEnemyAilmented: 'anyEnemyAilmented',  // Any enemy has ailment
    nearbyEnemyHasAilment: 'nearbyEnemyHasAilment',
    ailmentedEnemyCount: 'ailmentedEnemyCount',
    
    // Position Conditions
    selfInCombat: 'selfInCombat',            // Self is in combat column
    selfInSupport: 'selfInSupport',          // Self is in support column
    isCombatant: 'isCombatant',              // Is in combat position
    isSupport: 'isSupport',                  // Is in support position
    hasSupport: 'hasSupport',                // Self has a support behind it
    noSupport: 'noSupport',                  // Self has no support
    noEnemyAcross: 'noEnemyAcross',          // No enemy in combat across
    isCombatantAndNoKill: 'isCombatantAndNoKill',
    
    // Count Conditions
    allyCount: 'allyCount',                  // Number of allies meets condition
    enemyCount: 'enemyCount',                // Number of enemies meets condition
    deathCount: 'deathCount',                // Deaths this game meets condition
    
    // Resource Conditions
    pyreAtLeast: 'pyreAtLeast',              // Owner has at least X pyre
    pyreBelow: 'pyreBelow',                  // Owner has less than X pyre
    
    // Turn Conditions
    firstTurn: 'firstTurn',                  // It's turn 1
    turnNumber: 'turnNumber',                // Turn number meets condition
    
    // Combat Conditions
    wasLethal: 'wasLethal',                  // The damage/attack was lethal
    wasOverkill: 'wasOverkill',              // Damage exceeded target's HP
    didKill: 'didKill',                      // This card killed something this turn
    
    // Card Type Conditions
    targetIsRarity: 'targetIsRarity',        // Target is specific rarity
    targetIsElement: 'targetIsElement',      // Target is specific element
    targetHasKeyword: 'targetHasKeyword',    // Target has specific keyword
    killerWasAilment: 'killerWasAilment',    // Death was caused by ailment damage
    killedBy: 'killedBy',                    // Killed by specific source
    
    // Flag Conditions
    hasFlag: 'hasFlag',                      // Has a specific flag
    notHasFlag: 'notHasFlag',                // Does not have flag
    
    // Target Conditions (for spells)
    targetIsAlly: 'targetIsAlly',
    targetIsEnemy: 'targetIsEnemy',
};

// ==================== EFFECT CALCULATIONS ====================
// These define HOW amounts are calculated dynamically

const SharedEffectCalculations = {
    flat: 'flat',                            // Fixed number: { calc: 'flat', value: 3 }
    
    // Stack-based
    perAilmentStack: 'perAilmentStack',      // Per ailment stack on target
    targetAilmentStacks: 'targetAilmentStacks',
    perBurnStack: 'perBurnStack',            // Per burn stack
    perBleedStack: 'perBleedStack',          // Per bleed stack
    stacksCleansed: 'stacksCleansed',        // Number of stacks that were cleansed
    
    // Stat-based
    percentMaxHp: 'percentMaxHp',            // Percentage of max HP
    percentCurrentHp: 'percentCurrentHp',    // Percentage of current HP
    percentMissingHp: 'percentMissingHp',    // Percentage of missing HP
    selfAtk: 'selfAtk',                      // Based on self's ATK
    targetAtk: 'targetAtk',                  // Based on target's ATK
    victimCost: 'victimCost',                // Based on killed card's cost
    
    // Count-based
    perAllyOnField: 'perAllyOnField',        // Per friendly card on field
    perEnemyOnField: 'perEnemyOnField',      // Per enemy card on field
    perDeathThisGame: 'perDeathThisGame',    // Per death this game
    perAllyDeath: 'perAllyDeath',            // Per ally that died
    perEnemyKilled: 'perEnemyKilled',        // Per enemy this card killed
    
    // Resource-based
    perPyre: 'perPyre',                      // Per pyre owner has
    perPyreSpent: 'perPyreSpent',            // Per pyre spent this turn
    
    // Damage-based
    damageDealt: 'damageDealt',              // Amount of damage dealt
    damageTaken: 'damageTaken',              // Amount of damage taken
    overkillDamage: 'overkillDamage',        // Damage beyond lethal
};

// ==================== KEYWORDS ====================
// Standard keywords that can be granted/checked

const SharedKeywords = {
    flight: 'flight',                        // Can attack any enemy
    destroyer: 'destroyer',                  // Overkill damage hits support
    guardian: 'guardian',                    // Takes hits for adjacent allies
    vampiric: 'vampiric',                    // Heals when dealing damage
    lifesteal: 'lifesteal',                  // Alias for vampiric
    regeneration: 'regeneration',            // Heals at turn start
    radiance: 'radiance',                    // Grants regen to allies
    thornmail: 'thornmail',                  // Reflects damage to attackers
    deathtouch: 'deathtouch',                // Kills on any damage
    elusive: 'elusive',                      // Can't be targeted by spells
    taunt: 'taunt',                          // Must be attacked first
    stealth: 'stealth',                      // Can't be attacked until it attacks
    focus: 'focus',                          // Can attack supports directly
};

// ==================== AURAS ====================
// Continuous effects that persist while conditions are met

const SharedAuras = {
    ailmentImmunity: 'ailmentImmunity',      // Immune to ailments
    damageImmunity: 'damageImmunity',        // Immune to damage
    attackBoost: 'attackBoost',              // +X ATK to affected
    healthBoost: 'healthBoost',              // +X HP to affected
    costReduction: 'costReduction',          // Reduce card costs
    burnOnHit: 'burnOnHit',                  // Apply burn when hitting
    lifelink: 'lifelink',                    // Heal owner when dealing damage
};

// ==================== AILMENTS ====================
// Status effects that can be applied

const SharedAilments = {
    burn: 'burn',                            // Damage at turn end
    bleed: 'bleed',                          // Damage when attacking
    paralyze: 'paralyze',                    // Skip next attack
    calamity: 'calamity',                    // Counters that trigger effects
    curse: 'curse',                          // Tokens that cause effects
    terrify: 'terrify',                      // Can't attack
    silence: 'silence',                      // Abilities disabled
    toxic: 'toxic',                          // Poison effect
};

// ==================== ACTIVATED ABILITIES ====================
// These define player-clickable abilities that appear as buttons in tooltips

const SharedActivatedAbilityTypes = {
    // Ability availability positions
    positions: {
        support: 'support',      // Only available in support column
        combat: 'combat',        // Only available in combat column
        any: 'any',              // Available in any position
    },
    
    // Target selection types for abilities that need player to pick
    targetTypes: {
        none: 'none',                    // No target needed
        combatant: 'combatant',          // The combatant in same row
        anyAlly: 'anyAlly',              // Any friendly cryptid
        anyEnemy: 'anyEnemy',            // Any enemy cryptid
        ailmentedEnemy: 'ailmentedEnemy',// Any enemy with ailments
        emptySlot: 'emptySlot',          // An empty tile
    },
};

// Common activated ability effects that the engine handles
const SharedActivatedAbilityEffects = {
    // Combat-related
    killCombatant: 'killCombatant',      // Kill the combatant in same row
    damageCombatant: 'damageCombatant',  // Deal damage to combatant
    
    // Stat modifications
    setStats: 'setStats',                // Set ATK/HP to specific values
    buffStats: 'buffStats',              // Add ATK/HP
    debuffStats: 'debuffStats',          // Reduce ATK/HP
    
    // Keyword/flag granting
    grantKeyword: 'grantKeyword',        // Grant a keyword
    grantFlag: 'grantFlag',              // Grant a game flag
    
    // Resource effects
    gainPyre: 'gainPyre',                // Gain pyre
    
    // Target-based effects
    debuffTarget: 'debuffTarget',        // Debuff selected target
    damageTarget: 'damageTarget',        // Damage selected target
};

// ==================== GAME PHASES ====================
// Turn structure phases

const SharedGamePhases = {
    CONJURE1: 'conjure1',     // First conjure phase (summon/play cards)
    COMBAT: 'combat',         // Combat phase (attacks)
    CONJURE2: 'conjure2',     // Second conjure phase
    END: 'end',               // End of turn
};

// ==================== CARD TYPES ====================
// Types of cards in the game

const SharedCardTypes = {
    CRYPTID: 'cryptid',
    KINDLING: 'kindling',
    PYRE: 'pyre',
    BURST: 'burst',
    TRAP: 'trap',
    AURA: 'aura',
    INSTANT: 'instant',
};

// ==================== RARITIES ====================

const SharedRarities = {
    COMMON: 'common',
    UNCOMMON: 'uncommon',
    RARE: 'rare',
    ULTIMATE: 'ultimate',
};

// ==================== ELEMENTS ====================

const SharedElements = {
    BLOOD: 'blood',
    STEEL: 'steel',
    VOID: 'void',
    NATURE: 'nature',
    WATER: 'water',
    BLAZE: 'blaze',
};

// ==================== VALIDATION HELPERS ====================

/**
 * Validate an effect definition
 * @param {Object} effect - Effect to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateEffect(effect) {
    const errors = [];
    
    if (!effect.trigger || !SharedEffectTriggers[effect.trigger]) {
        errors.push(`Invalid trigger: ${effect.trigger}`);
    }
    if (!effect.action || !SharedEffectActions[effect.action]) {
        // Allow arrays of actions
        if (!effect.actions || !Array.isArray(effect.actions)) {
            errors.push(`Invalid action: ${effect.action}`);
        }
    }
    if (effect.target && !SharedEffectTargets[effect.target]) {
        errors.push(`Invalid target: ${effect.target}`);
    }
    if (effect.condition?.check && !SharedEffectConditions[effect.condition.check]) {
        errors.push(`Invalid condition: ${effect.condition.check}`);
    }
    
    return { valid: errors.length === 0, errors };
}

/**
 * Validate an activated ability definition
 * @param {Object} ability - Ability to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateActivatedAbility(ability) {
    const errors = [];
    
    if (!ability.id) {
        errors.push('Activated ability must have an id');
    }
    if (!ability.name) {
        errors.push('Activated ability must have a name');
    }
    if (!ability.effects || !Array.isArray(ability.effects) || ability.effects.length === 0) {
        errors.push('Activated ability must have at least one effect');
    }
    
    return { valid: errors.length === 0, errors };
}

// ==================== COMBINED EXPORT ====================

const SharedEffectSchema = {
    Triggers: SharedEffectTriggers,
    Actions: SharedEffectActions,
    Targets: SharedEffectTargets,
    Conditions: SharedEffectConditions,
    Calculations: SharedEffectCalculations,
    Keywords: SharedKeywords,
    Auras: SharedAuras,
    Ailments: SharedAilments,
    ActivatedAbility: SharedActivatedAbilityTypes,
    ActivatedEffects: SharedActivatedAbilityEffects,
    Phases: SharedGamePhases,
    CardTypes: SharedCardTypes,
    Rarities: SharedRarities,
    Elements: SharedElements,
    validateEffect,
    validateActivatedAbility,
};

// ==================== EXPORTS ====================

// CommonJS export (for Node.js / Cloudflare Worker)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        EffectSchema: SharedEffectSchema,
        EffectTriggers: SharedEffectTriggers,
        EffectActions: SharedEffectActions,
        EffectTargets: SharedEffectTargets,
        EffectConditions: SharedEffectConditions,
        EffectCalculations: SharedEffectCalculations,
        Keywords: SharedKeywords,
        Auras: SharedAuras,
        Ailments: SharedAilments,
        ActivatedAbilityTypes: SharedActivatedAbilityTypes,
        ActivatedAbilityEffects: SharedActivatedAbilityEffects,
        GamePhases: SharedGamePhases,
        CardTypes: SharedCardTypes,
        Rarities: SharedRarities,
        Elements: SharedElements,
        validateEffect,
        validateActivatedAbility,
    };
}

// Browser global export
if (typeof window !== 'undefined') {
    window.SharedEffectSchema = SharedEffectSchema;
}

})(); // End IIFE
