/**
 * Cryptid Fates - Effect Schema System
 * 
 * This file defines the declarative effect system that allows cards to specify
 * what effects they have without implementing the logic themselves.
 * 
 * Cards declare effects like:
 *   { trigger: "onSummon", action: "dealDamage", target: "allEnemies", amount: 2 }
 * 
 * This system then:
 *   1. Listens for the trigger
 *   2. Resolves the target(s)
 *   3. Executes the action
 *   4. Plays the corresponding animation
 */

// ==================== EFFECT TRIGGERS ====================
// These define WHEN an effect activates

const EffectTriggers = {
    // Summon/Position Triggers
    onSummon: 'onSummon',                    // When card enters the field (any position)
    onEnterCombat: 'onEnterCombat',          // When card enters combat column
    onEnterSupport: 'onEnterSupport',        // When card enters support column
    onLeaveCombat: 'onLeaveCombat',          // When card leaves combat column
    onLeaveSupport: 'onLeaveSupport',        // When card leaves support column
    onPromotion: 'onPromotion',              // When support promotes to combat
    
    // Combat Triggers
    onAttack: 'onAttack',                    // When this card attacks
    onAttackDeclared: 'onAttackDeclared',    // When attack is declared (before resolution)
    onDamageDealt: 'onDamageDealt',          // When this card deals damage
    onDamageTaken: 'onDamageTaken',          // When this card takes damage
    onKill: 'onKill',                        // When this card kills an enemy
    
    // Death Triggers
    onDeath: 'onDeath',                      // When this card dies
    onAllyDeath: 'onAllyDeath',              // When a friendly card dies
    onEnemyDeath: 'onEnemyDeath',            // When an enemy card dies
    onAnyDeath: 'onAnyDeath',                // When any card dies
    
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
};

// ==================== EFFECT ACTIONS ====================
// These define WHAT happens when an effect triggers

const EffectActions = {
    // Damage Actions
    dealDamage: 'dealDamage',                // Deal damage to target(s)
    dealDamagePerStack: 'dealDamagePerStack',// Deal damage based on ailment stacks
    
    // Healing Actions
    heal: 'heal',                            // Restore HP to target(s)
    healToFull: 'healToFull',                // Restore to max HP
    
    // Stat Modification Actions
    buffStats: 'buffStats',                  // Increase ATK/HP
    debuffStats: 'debuffStats',              // Decrease ATK/HP
    setStats: 'setStats',                    // Set ATK/HP to specific values
    copyStats: 'copyStats',                  // Copy stats from another card
    swapStats: 'swapStats',                  // Swap ATK and HP
    
    // Ailment Actions
    applyBurn: 'applyBurn',                  // Apply burn ailment
    applyBleed: 'applyBleed',                // Apply bleed ailment
    applyParalyze: 'applyParalyze',          // Apply paralyze ailment
    applyCalamity: 'applyCalamity',          // Apply calamity counters
    applyCurse: 'applyCurse',                // Apply curse tokens
    cleanse: 'cleanse',                      // Remove ailments
    cleanseAndBuff: 'cleanseAndBuff',        // Remove ailments and buff per stack
    
    // Keyword Actions
    grantKeyword: 'grantKeyword',            // Grant a keyword (flight, destroyer, etc.)
    removeKeyword: 'removeKeyword',          // Remove a keyword
    
    // Aura Actions
    grantAura: 'grantAura',                  // Apply continuous effect to targets
    removeAura: 'removeAura',                // Remove continuous effect
    
    // Position Actions
    move: 'move',                            // Move card to new position
    swap: 'swap',                            // Swap positions with another card
    destroy: 'destroy',                      // Destroy/kill target(s)
    summon: 'summon',                        // Summon a new card
    returnToHand: 'returnToHand',            // Return card to hand
    
    // Resource Actions
    gainPyre: 'gainPyre',                    // Gain pyre for owner
    drainPyre: 'drainPyre',                  // Steal pyre from enemy
    drawCard: 'drawCard',                    // Draw card(s)
    discardCard: 'discardCard',              // Discard card(s)
    
    // Special Actions
    transform: 'transform',                  // Transform into another card
    silence: 'silence',                      // Remove all abilities
    protect: 'protect',                      // Grant damage immunity
    counter: 'counter',                      // Counter/negate an effect
    repeat: 'repeat',                        // Repeat another effect
};

// ==================== EFFECT TARGETS ====================
// These define WHO/WHAT is affected by an effect

const EffectTargets = {
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
    
    // Enemies (opposite owner)
    allEnemies: 'allEnemies',                // All enemy cards on field
    enemyCombatants: 'enemyCombatants',      // All enemy cards in combat column
    enemySupports: 'enemySupports',          // All enemy cards in support column
    enemyOpposite: 'enemyOpposite',          // Enemy in same row (direct opponent)
    enemyOppositeSupport: 'enemyOppositeSupport', // Enemy support in same row
    randomEnemy: 'randomEnemy',              // Random enemy card
    weakestEnemy: 'weakestEnemy',            // Enemy with lowest HP
    strongestEnemy: 'strongestEnemy',        // Enemy with highest ATK
    ailmentedEnemies: 'ailmentedEnemies',    // All enemies with ailments
    
    // Row-based
    sameRow: 'sameRow',                      // All cards in same row (both sides)
    adjacentRows: 'adjacentRows',            // Cards in rows above/below
    
    // All
    allCards: 'allCards',                    // Every card on the field
    
    // Special
    attacker: 'attacker',                    // The card that attacked (for onDamageTaken)
    defender: 'defender',                    // The card being attacked
    killer: 'killer',                        // The card that caused death (for onDeath)
    triggerSource: 'triggerSource',          // Whatever triggered this effect
};

// ==================== EFFECT CONDITIONS ====================
// These define IF an effect should activate (beyond just the trigger)

const EffectConditions = {
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
    
    // Position Conditions
    selfInCombat: 'selfInCombat',            // Self is in combat column
    selfInSupport: 'selfInSupport',          // Self is in support column
    hasSupport: 'hasSupport',                // Self has a support behind it
    noSupport: 'noSupport',                  // Self has no support
    
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
};

// ==================== EFFECT CALCULATIONS ====================
// These define HOW amounts are calculated dynamically

const EffectCalculations = {
    flat: 'flat',                            // Fixed number: { calc: 'flat', value: 3 }
    
    // Stack-based
    perAilmentStack: 'perAilmentStack',      // Per ailment stack on target
    perBurnStack: 'perBurnStack',            // Per burn stack
    perBleedStack: 'perBleedStack',          // Per bleed stack
    stacksCleansed: 'stacksCleansed',        // Number of stacks that were cleansed
    
    // Stat-based
    percentMaxHp: 'percentMaxHp',            // Percentage of max HP
    percentCurrentHp: 'percentCurrentHp',    // Percentage of current HP
    percentMissingHp: 'percentMissingHp',    // Percentage of missing HP
    selfAtk: 'selfAtk',                      // Based on self's ATK
    targetAtk: 'targetAtk',                  // Based on target's ATK
    
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

const Keywords = {
    flight: 'flight',                        // Can attack any enemy
    destroyer: 'destroyer',                  // Overkill damage hits support
    guardian: 'guardian',                    // Takes hits for adjacent allies
    vampiric: 'vampiric',                    // Heals when dealing damage
    regeneration: 'regeneration',            // Heals at turn start
    radiance: 'radiance',                    // Grants regen to allies
    thornmail: 'thornmail',                  // Reflects damage to attackers
    deathtouch: 'deathtouch',                // Kills on any damage
    elusive: 'elusive',                      // Can't be targeted by spells
    taunt: 'taunt',                          // Must be attacked first
    stealth: 'stealth',                      // Can't be attacked until it attacks
};

// ==================== AURAS ====================
// Continuous effects that persist while conditions are met

const Auras = {
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

const Ailments = {
    burn: 'burn',                            // Damage at turn end
    bleed: 'bleed',                          // Damage when attacking
    paralyze: 'paralyze',                    // Skip next attack
    calamity: 'calamity',                    // Counters that trigger effects
    curse: 'curse',                          // Tokens that cause effects
    terrify: 'terrify',                      // Can't attack
    silence: 'silence',                      // Abilities disabled
};

// ==================== EXPORT ====================

window.EffectSchema = {
    Triggers: EffectTriggers,
    Actions: EffectActions,
    Targets: EffectTargets,
    Conditions: EffectConditions,
    Calculations: EffectCalculations,
    Keywords,
    Auras,
    Ailments,
    
    // Helper to validate an effect definition
    validateEffect(effect) {
        const errors = [];
        
        if (!effect.trigger || !EffectTriggers[effect.trigger]) {
            errors.push(`Invalid trigger: ${effect.trigger}`);
        }
        if (!effect.action || !EffectActions[effect.action]) {
            errors.push(`Invalid action: ${effect.action}`);
        }
        if (effect.target && !EffectTargets[effect.target]) {
            errors.push(`Invalid target: ${effect.target}`);
        }
        if (effect.condition?.check && !EffectConditions[effect.condition.check]) {
            errors.push(`Invalid condition: ${effect.condition.check}`);
        }
        
        return { valid: errors.length === 0, errors };
    }
};

console.log('[EffectSchema] Effect schema system loaded');

