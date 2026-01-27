/**
 * Cryptid Fates - Universal Ability System
 * 
 * Data-driven ability execution. Cards are pure data.
 * This file defines the schema and the executor that interprets it.
 * 
 * ARCHITECTURE: 
 * - Abilities are arrays of { trigger, condition?, effects[], target? }
 * - Effects are { type, ...params }
 * - The executor walks through abilities, checks triggers/conditions, executes effects
 * - Same code runs on client AND server
 */

// ==================== SCHEMA DEFINITIONS ====================

const Triggers = {
    // Summon/Position
    ON_SUMMON: 'onSummon',
    ON_ENTER_COMBAT: 'onEnterCombat',
    ON_ENTER_SUPPORT: 'onEnterSupport',
    ON_LEAVING_SUPPORT: 'onLeavingSupport',
    ON_PROMOTED: 'onPromoted',
    
    // Combat
    ON_BEFORE_ATTACK: 'onBeforeAttack',
    ON_ATTACK: 'onAttack',
    ON_HIT: 'onHit',
    ON_BEFORE_DEFEND: 'onBeforeDefend',
    ON_DEFEND: 'onDefend',
    ON_DAMAGED: 'onDamaged',
    ON_KILL: 'onKill',
    
    // Death
    ON_DEATH: 'onDeath',
    ON_ALLY_DEATH: 'onAllyDeath',
    ON_ENEMY_DEATH: 'onEnemyDeath',
    ON_COMBATANT_DEATH: 'onCombatantDeath',
    
    // Turn
    ON_TURN_START: 'onTurnStart',
    ON_TURN_END: 'onTurnEnd',
    ON_MY_TURN_START: 'onMyTurnStart',
    ON_MY_TURN_END: 'onMyTurnEnd',
    
    // Special
    ON_AILMENT_ATTEMPT: 'onAilmentAttempt',
    ON_PYRE_GAINED: 'onPyreGained',
    
    // Passive/Continuous (checked when relevant)
    WHILE_IN_COMBAT: 'whileInCombat',
    WHILE_IN_SUPPORT: 'whileInSupport',
    WHILE_ALIVE: 'whileAlive',
    
    // Activatable (player choice)
    ACTIVATABLE: 'activatable'
};

const EffectTypes = {
    // Damage/Healing
    DEAL_DAMAGE: 'dealDamage',
    HEAL: 'heal',
    SET_HP: 'setHp',
    
    // Stats
    BUFF_ATK: 'buffAtk',
    BUFF_HP: 'buffHp',
    BUFF_BOTH: 'buffBoth',
    DEBUFF_ATK: 'debuffAtk',
    DEBUFF_HP: 'debuffHp',
    DEBUFF_BOTH: 'debuffBoth',
    SET_ATK: 'setAtk',
    
    // Status Effects
    APPLY_BURN: 'applyBurn',
    APPLY_BLEED: 'applyBleed',
    APPLY_PARALYZE: 'applyParalyze',
    APPLY_CALAMITY: 'applyCalamity',
    APPLY_CURSE: 'applyCurse',
    CLEANSE: 'cleanse',
    EXTEND_AILMENTS: 'extendAilments',
    
    // Resources
    GAIN_PYRE: 'gainPyre',
    STEAL_PYRE: 'stealPyre',
    DRAW_CARD: 'drawCard',
    
    // Combat State
    TAP: 'tap',
    UNTAP: 'untap',
    CANCEL_ATTACK: 'cancelAttack',
    NEGATE_DAMAGE: 'negateDamage',
    REDUCE_DAMAGE: 'reduceDamage',
    
    // Field
    KILL: 'kill',
    PREVENT_DEATH: 'preventDeath',
    APPLY_TOXIC: 'applyToxic',
    PROMOTE: 'promote',
    EVOLVE: 'evolve',
    FORCE_ATTACK: 'forceAttack',
    
    // Flags (for tracking state)
    SET_FLAG: 'setFlag',
    CLEAR_FLAG: 'clearFlag',
    GRANT_FLAG: 'grantFlag',
    REVOKE_FLAG: 'revokeFlag',
    
    // Special
    EMIT_EVENT: 'emitEvent',
    CONDITIONAL: 'conditional',
    FOR_EACH: 'forEach'
};

const TargetTypes = {
    // Self reference
    SELF: 'self',
    OWNER: 'owner',
    
    // Position-based (relative to self)
    MY_COMBATANT: 'myCombatant',
    MY_SUPPORT: 'mySupport',
    MY_ROW: 'myRow',
    
    // Enemy position-based
    ENEMY_ACROSS: 'enemyAcross',
    ENEMIES_ACROSS: 'enemiesAcross',
    ENEMY_COMBAT_COL: 'enemyCombatCol',
    ENEMY_SUPPORT_COL: 'enemySupportCol',
    
    // All targets
    ALL_ALLIES: 'allAllies',
    ALL_ENEMIES: 'allEnemies',
    ALL_MY_COMBATANTS: 'allMyCombatants',
    ALL_ENEMY_COMBATANTS: 'allEnemyCombatants',
    ALL: 'all',
    
    // Context-based (from event data)
    ATTACKER: 'attacker',
    DEFENDER: 'defender',
    TARGET: 'target',
    VICTIM: 'victim',
    KILLER: 'killer',
    SOURCE: 'source',
    
    // Special
    ADJACENT: 'adjacent',
    DIAGONAL: 'diagonal',
    RANDOM_ADJACENT: 'randomAdjacent',
    RANDOM_ENEMY: 'randomEnemy',
    
    // For iteration
    EACH_ENEMY: 'eachEnemy',
    EACH_ALLY: 'eachAlly'
};

const ConditionTypes = {
    // Ailment checks
    HAS_BURN: 'hasBurn',
    HAS_BLEED: 'hasBleed',
    HAS_PARALYZE: 'hasParalyze',
    HAS_CALAMITY: 'hasCalamity',
    HAS_CURSE: 'hasCurse',
    HAS_ANY_AILMENT: 'hasAnyAilment',
    IS_AILMENT_FREE: 'isAilmentFree',
    
    // Position checks
    IN_COMBAT: 'inCombat',
    IN_SUPPORT: 'inSupport',
    HAS_COMBATANT: 'hasCombatant',
    HAS_SUPPORT: 'hasSupport',
    HAS_ENEMY_ACROSS: 'hasEnemyAcross',
    
    // State checks
    IS_TAPPED: 'isTapped',
    IS_MY_TURN: 'isMyTurn',
    HP_BELOW: 'hpBelow',
    HP_ABOVE: 'hpAbove',
    ATK_ABOVE: 'atkAbove',
    
    // Kill context
    KILLED_BY_BURN: 'killedByBurn',
    KILLED_BY_ATTACK: 'killedByAttack',
    KILLED_BY_ABILITY: 'killedByAbility',
    VICTIM_HAD_AILMENT: 'victimHadAilment',
    VICTIM_HAD_BURN: 'victimHadBurn',
    
    // Flag checks
    HAS_FLAG: 'hasFlag',
    NOT_FLAG: 'notFlag',
    
    // Count checks
    AILMENTED_ENEMY_COUNT_GTE: 'ailmentedEnemyCountGte',
    FIELD_COUNT_GTE: 'fieldCountGte',
    
    // Compound
    AND: 'and',
    OR: 'or',
    NOT: 'not'
};

const CalcTypes = {
    // Dynamic values
    AILMENT_STACKS: 'ailmentStacks',
    BURN_TURNS: 'burnTurns',
    BLEED_TURNS: 'bleedTurns',
    CALAMITY_COUNTERS: 'calamityCounters',
    CURSE_TOKENS: 'curseTokens',
    
    // Counts
    AILMENTED_ENEMY_COUNT: 'ailmentedEnemyCount',
    VAMPIRE_COUNT: 'vampireCount',
    GARGOYLE_COUNT: 'gargoyleCount',
    ALLY_DEATHS_LAST_TURN: 'allyDeathsLastTurn',
    UNIQUE_AILMENTS: 'uniqueAilments',
    
    // References
    TARGET_COST: 'targetCost',
    TARGET_BASE_HP: 'targetBaseHp',
    DAMAGE_DEALT: 'damageDealt',
    
    // Math
    HALF_ROUNDED_DOWN: 'halfRoundedDown',
    MIN: 'min',
    MAX: 'max'
};

// ==================== FLAGS ====================

const Flags = {
    // Combat modifiers
    FLIGHT: 'canTargetAny',
    LIFESTEAL: 'hasLifesteal',
    DESTROYER: 'hasDestroyer',
    FOCUS: 'hasFocus',
    BURROW: 'hasBurrowTargeting',
    
    // Status immunity
    AILMENT_IMMUNE: 'ailmentImmune',
    BURN_IMMUNE: 'burnImmune',
    
    // Attack modifiers
    ATTACKS_APPLY_BURN: 'attacksApplyBurn',
    ATTACKS_APPLY_PARALYZE: 'attacksApplyParalyze',
    ATTACKS_APPLY_BLEED: 'attacksApplyBleed',
    
    // Damage modifiers
    BONUS_VS_BURNING: 'bonusVsBurning',
    BONUS_VS_PARALYZED: 'bonusVsParalyzed',
    BONUS_VS_AILMENT: 'bonusVsAilment',
    
    // Support relationships
    GRANTS_LIFESTEAL: 'grantsLifesteal',
    GRANTS_FOCUS: 'grantsFocus',
    GRANTS_AILMENT_IMMUNITY: 'grantsMothmanImmunity',
    NEGATES_ENEMY_SUPPORT: 'negatesEnemySupport',
    
    // Ability tracking
    GUARD_AVAILABLE: 'guardAvailable',
    ABILITY_USED: 'abilityUsed',
    GOT_KILL_THIS_TURN: 'gotKillThisTurn',
    
    // Special
    STONE_BASTION: 'stoneBastion',
    NEGATE_INCOMING_ATTACK: 'negateIncomingAttack'
};

// ==================== ABILITY EXECUTOR ====================

class AbilityExecutor {
    constructor(gameState) {
        this.state = gameState;
        this.eventQueue = [];
        this.context = {};
    }
    
    executeTrigger(cryptid, trigger, eventData = {}) {
        if (!cryptid || !cryptid.abilities) return [];
        
        const results = [];
        
        for (const ability of cryptid.abilities) {
            if (ability.trigger !== trigger) continue;
            
            this.context = {
                self: cryptid,
                owner: cryptid.owner,
                eventData,
                ...eventData
            };
            
            if (ability.condition && !this.checkCondition(ability.condition)) {
                continue;
            }
            
            const effectResults = this.executeEffects(ability.effects || [], ability.target);
            results.push(...effectResults);
        }
        
        return results;
    }
    
    checkCondition(condition) {
        if (!condition) return true;
        
        const target = condition.target 
            ? this.resolveTarget(condition.target)[0] 
            : this.context.self;
        
        switch (condition.type) {
            case ConditionTypes.HAS_BURN:
                return (target?.burnTurns || 0) > 0;
            case ConditionTypes.HAS_BLEED:
                return (target?.bleedTurns || 0) > 0;
            case ConditionTypes.HAS_PARALYZE:
                return !!target?.paralyzed || (target?.paralyzeTurns || 0) > 0;
            case ConditionTypes.HAS_CALAMITY:
                return (target?.calamityCounters || 0) > 0;
            case ConditionTypes.HAS_CURSE:
                return (target?.curseTokens || 0) > 0;
            case ConditionTypes.HAS_ANY_AILMENT:
                return this.hasAnyAilment(target);
            case ConditionTypes.IS_AILMENT_FREE:
                return !this.hasAnyAilment(target);
            case ConditionTypes.IN_COMBAT:
                return target?.col === this.getCombatCol(target?.owner);
            case ConditionTypes.IN_SUPPORT:
                return target?.col === this.getSupportCol(target?.owner);
            case ConditionTypes.HAS_COMBATANT:
                return !!this.getCombatant(target);
            case ConditionTypes.HAS_SUPPORT:
                return !!this.getSupport(target);
            case ConditionTypes.HAS_ENEMY_ACROSS:
                return this.getEnemiesAcross(target).length > 0;
            case ConditionTypes.IS_TAPPED:
                return !!target?.tapped;
            case ConditionTypes.IS_MY_TURN:
                return this.state.currentTurn === this.context.owner;
            case ConditionTypes.HP_BELOW:
                return (target?.currentHp || target?.hp || 0) < condition.value;
            case ConditionTypes.HP_ABOVE:
                return (target?.currentHp || target?.hp || 0) > condition.value;
            case ConditionTypes.ATK_ABOVE:
                return (target?.currentAtk || target?.atk || 0) > condition.value;
            case ConditionTypes.KILLED_BY_BURN:
                return this.context.eventData?.killedBy === 'burn';
            case ConditionTypes.KILLED_BY_ATTACK:
                return !!this.context.eventData?.killedBySource;
            case ConditionTypes.VICTIM_HAD_AILMENT:
                return this.hasAnyAilment(this.context.victim);
            case ConditionTypes.VICTIM_HAD_BURN:
                return (this.context.victim?.burnTurns || 0) > 0;
            case ConditionTypes.HAS_FLAG:
                return !!target?.[condition.flag];
            case ConditionTypes.NOT_FLAG:
                return !target?.[condition.flag];
            case ConditionTypes.AILMENTED_ENEMY_COUNT_GTE:
                return this.countAilmentedEnemies(this.context.owner) >= condition.value;
            case ConditionTypes.AND:
                return condition.conditions.every(c => this.checkCondition(c));
            case ConditionTypes.OR:
                return condition.conditions.some(c => this.checkCondition(c));
            case ConditionTypes.NOT:
                return !this.checkCondition(condition.condition);
            default:
                return true;
        }
    }
    
    executeEffects(effects, defaultTarget = TargetTypes.SELF) {
        const results = [];
        
        for (const effect of effects) {
            const targets = this.resolveTarget(effect.target || defaultTarget);
            
            for (const target of targets) {
                if (!target) continue;
                
                const result = this.executeEffect(effect, target);
                if (result) results.push(result);
            }
        }
        
        return results;
    }
    
    executeEffect(effect, target) {
        const amount = this.resolveValue(effect.amount, target);
        
        switch (effect.type) {
            case EffectTypes.DEAL_DAMAGE:
                return this.dealDamage(target, amount, effect.source || 'ability');
            case EffectTypes.HEAL:
                return this.heal(target, amount);
            case EffectTypes.SET_HP:
                target.currentHp = amount;
                return { type: 'setHp', target, value: amount };
            case EffectTypes.BUFF_ATK:
                target.currentAtk = (target.currentAtk || target.atk) + amount;
                if (effect.permanent) target.baseAtk = (target.baseAtk || target.atk) + amount;
                return { type: 'buffAtk', target, amount };
            case EffectTypes.BUFF_HP:
                target.currentHp = (target.currentHp || target.hp) + amount;
                if (effect.permanent) target.maxHp = (target.maxHp || target.hp) + amount;
                return { type: 'buffHp', target, amount };
            case EffectTypes.BUFF_BOTH:
                target.currentAtk = (target.currentAtk || target.atk) + amount;
                target.currentHp = (target.currentHp || target.hp) + amount;
                if (effect.permanent) {
                    target.baseAtk = (target.baseAtk || target.atk) + amount;
                    target.maxHp = (target.maxHp || target.hp) + amount;
                }
                return { type: 'buffBoth', target, amount };
            case EffectTypes.DEBUFF_ATK:
                target.currentAtk = Math.max(0, (target.currentAtk || target.atk) - amount);
                return { type: 'debuffAtk', target, amount };
            case EffectTypes.DEBUFF_HP:
                target.currentHp = (target.currentHp || target.hp) - amount;
                return { type: 'debuffHp', target, amount };
            case EffectTypes.SET_ATK:
                target.currentAtk = amount;
                target.baseAtk = amount;
                return { type: 'setAtk', target, value: amount };
            case EffectTypes.APPLY_BURN:
                return this.applyBurn(target, effect.stacks || 3);
            case EffectTypes.APPLY_BLEED:
                return this.applyBleed(target, effect.stacks || 2);
            case EffectTypes.APPLY_PARALYZE:
                return this.applyParalyze(target);
            case EffectTypes.APPLY_CALAMITY:
                return this.applyCalamity(target, effect.stacks || 1);
            case EffectTypes.APPLY_CURSE:
                return this.applyCurse(target, effect.stacks || 1);
            case EffectTypes.CLEANSE:
                return this.cleanse(target);
            case EffectTypes.EXTEND_AILMENTS:
                return this.extendAilments(target, effect.turns || 1);
            case EffectTypes.GAIN_PYRE:
                return this.gainPyre(this.context.owner, amount);
            case EffectTypes.STEAL_PYRE:
                return this.stealPyre(this.context.owner, amount);
            case EffectTypes.DRAW_CARD:
                return this.drawCards(this.context.owner, amount || 1);
            case EffectTypes.TAP:
                target.tapped = true;
                target.canAttack = false;
                return { type: 'tap', target };
            case EffectTypes.UNTAP:
                target.tapped = false;
                target.canAttack = true;
                return { type: 'untap', target };
            case EffectTypes.CANCEL_ATTACK:
                if (this.context.eventData) this.context.eventData.cancelled = true;
                return { type: 'cancelAttack' };
            case EffectTypes.NEGATE_DAMAGE:
                target.negateIncomingAttack = true;
                return { type: 'negateDamage', target };
            case EffectTypes.REDUCE_DAMAGE:
                this.context.damageReduction = (this.context.damageReduction || 0) + amount;
                return { type: 'reduceDamage', amount };
            case EffectTypes.KILL:
                return this.killCryptid(target, effect.killedBy || 'ability');
            case EffectTypes.PREVENT_DEATH:
                target.preventDeath = true;
                return { type: 'preventDeath', target };
            case EffectTypes.APPLY_TOXIC:
                return this.applyToxic(target.owner, target.col, target.row);
            case EffectTypes.FORCE_ATTACK:
                return { type: 'forceAttack', attacker: target, target: effect.forceTarget };
            case EffectTypes.SET_FLAG:
                target[effect.flag] = effect.value !== undefined ? effect.value : true;
                return { type: 'setFlag', target, flag: effect.flag, value: target[effect.flag] };
            case EffectTypes.CLEAR_FLAG:
                target[effect.flag] = false;
                return { type: 'clearFlag', target, flag: effect.flag };
            case EffectTypes.GRANT_FLAG:
                const grantTarget = this.resolveTarget(effect.to)[0];
                if (grantTarget) grantTarget[effect.flag] = true;
                return { type: 'grantFlag', target: grantTarget, flag: effect.flag };
            case EffectTypes.REVOKE_FLAG:
                const revokeTarget = this.resolveTarget(effect.from)[0];
                if (revokeTarget) revokeTarget[effect.flag] = false;
                return { type: 'revokeFlag', target: revokeTarget, flag: effect.flag };
            case EffectTypes.EMIT_EVENT:
                this.emitEvent(effect.event, { ...this.context, ...effect.data });
                return { type: 'emitEvent', event: effect.event };
            case EffectTypes.CONDITIONAL:
                if (this.checkCondition(effect.condition)) {
                    return this.executeEffects(effect.then, effect.target);
                } else if (effect.else) {
                    return this.executeEffects(effect.else, effect.target);
                }
                return null;
            case EffectTypes.FOR_EACH:
                const iterTargets = this.resolveTarget(effect.in);
                const forEachResults = [];
                for (const iterTarget of iterTargets) {
                    this.context.current = iterTarget;
                    forEachResults.push(...this.executeEffects(effect.do, iterTarget));
                }
                return forEachResults;
            default:
                return null;
        }
    }
    
    resolveTarget(targetType) {
        if (!targetType) return [this.context.self];
        if (typeof targetType === 'object' && targetType.key) return [targetType];
        
        const owner = this.context.owner;
        const self = this.context.self;
        
        switch (targetType) {
            case TargetTypes.SELF: return [self];
            case TargetTypes.OWNER: return [{ isPlayer: owner === 'player', owner }];
            case TargetTypes.MY_COMBATANT: return [this.getCombatant(self)].filter(Boolean);
            case TargetTypes.MY_SUPPORT: return [this.getSupport(self)].filter(Boolean);
            case TargetTypes.ENEMY_ACROSS: return this.getEnemiesAcross(self).slice(0, 1);
            case TargetTypes.ENEMIES_ACROSS: return this.getEnemiesAcross(self);
            case TargetTypes.ALL_ALLIES: return this.getAllCryptids(owner);
            case TargetTypes.ALL_ENEMIES: return this.getAllCryptids(owner === 'player' ? 'enemy' : 'player');
            case TargetTypes.ALL_MY_COMBATANTS: return this.getAllCombatants(owner);
            case TargetTypes.ALL_ENEMY_COMBATANTS: return this.getAllCombatants(owner === 'player' ? 'enemy' : 'player');
            case TargetTypes.ENEMY_COMBAT_COL:
                const enemyOwner = owner === 'player' ? 'enemy' : 'player';
                return this.getColumn(enemyOwner, this.getCombatCol(enemyOwner));
            case TargetTypes.ATTACKER: return [this.context.attacker || this.context.eventData?.attacker].filter(Boolean);
            case TargetTypes.DEFENDER: return [this.context.defender || this.context.eventData?.defender].filter(Boolean);
            case TargetTypes.TARGET: return [this.context.target || this.context.eventData?.target].filter(Boolean);
            case TargetTypes.VICTIM: return [this.context.victim || this.context.eventData?.victim].filter(Boolean);
            case TargetTypes.KILLER: return [this.context.killer || this.context.eventData?.killer].filter(Boolean);
            case TargetTypes.ADJACENT: return this.getAdjacentCryptids(self);
            case TargetTypes.RANDOM_ADJACENT:
                const adjacent = this.getAdjacentCryptids(self);
                return adjacent.length > 0 ? [adjacent[Math.floor(Math.random() * adjacent.length)]] : [];
            case TargetTypes.RANDOM_ENEMY:
                const enemies = this.getAllCryptids(owner === 'player' ? 'enemy' : 'player');
                return enemies.length > 0 ? [enemies[Math.floor(Math.random() * enemies.length)]] : [];
            case TargetTypes.EACH_ENEMY: return this.getAllCryptids(owner === 'player' ? 'enemy' : 'player');
            case TargetTypes.EACH_ALLY: return this.getAllCryptids(owner);
            default: return [self];
        }
    }
    
    resolveValue(value, target) {
        if (value === undefined || value === null) return 0;
        if (typeof value === 'number') return value;
        if (typeof value === 'object' && value.calc) {
            const calcTarget = value.of ? this.resolveTarget(value.of)[0] : target || this.context.self;
            return this.calculate(value.calc, calcTarget, value);
        }
        return 0;
    }
    
    calculate(calcType, target, params = {}) {
        switch (calcType) {
            case CalcTypes.AILMENT_STACKS: return this.countAilmentStacks(target);
            case CalcTypes.BURN_TURNS: return target?.burnTurns || 0;
            case CalcTypes.BLEED_TURNS: return target?.bleedTurns || 0;
            case CalcTypes.CALAMITY_COUNTERS: return target?.calamityCounters || 0;
            case CalcTypes.CURSE_TOKENS: return target?.curseTokens || 0;
            case CalcTypes.AILMENTED_ENEMY_COUNT: return this.countAilmentedEnemies(this.context.owner);
            case CalcTypes.VAMPIRE_COUNT: return this.countByName(this.context.owner, 'vampire');
            case CalcTypes.GARGOYLE_COUNT: return this.countByName(this.context.owner, 'gargoyle');
            case CalcTypes.ALLY_DEATHS_LAST_TURN: return this.state.deathsLastEnemyTurn?.[this.context.owner] || 0;
            case CalcTypes.UNIQUE_AILMENTS: return this.countUniqueAilments(target);
            case CalcTypes.TARGET_COST: return target?.cost || 0;
            case CalcTypes.TARGET_BASE_HP: return target?.hp || 0;
            case CalcTypes.HALF_ROUNDED_DOWN: return Math.floor(this.resolveValue(params.of, target) / 2);
            case CalcTypes.MIN: return Math.min(this.resolveValue(params.a, target), params.max || Infinity);
            case CalcTypes.MAX: return Math.max(this.resolveValue(params.a, target), params.min || 0);
            default: return 0;
        }
    }
    
    // Helper methods
    hasAnyAilment(target) {
        if (!target) return false;
        return (target.burnTurns || 0) > 0 || (target.bleedTurns || 0) > 0 ||
               !!target.paralyzed || (target.paralyzeTurns || 0) > 0 ||
               (target.calamityCounters || 0) > 0 || (target.curseTokens || 0) > 0;
    }
    
    countAilmentStacks(target) {
        if (!target) return 0;
        let stacks = 0;
        if (target.burnTurns > 0) stacks += target.burnTurns;
        if (target.bleedTurns > 0) stacks += target.bleedTurns;
        if (target.paralyzed || target.paralyzeTurns > 0) stacks += 1;
        if (target.calamityCounters > 0) stacks += target.calamityCounters;
        if (target.curseTokens > 0) stacks += target.curseTokens;
        return stacks;
    }
    
    countUniqueAilments(target) {
        if (!target) return 0;
        let count = 0;
        if ((target.burnTurns || 0) > 0) count++;
        if ((target.bleedTurns || 0) > 0) count++;
        if (target.paralyzed || (target.paralyzeTurns || 0) > 0) count++;
        if ((target.calamityCounters || 0) > 0) count++;
        if ((target.curseTokens || 0) > 0) count++;
        return count;
    }
    
    countAilmentedEnemies(owner) {
        const enemyOwner = owner === 'player' ? 'enemy' : 'player';
        return this.getAllCryptids(enemyOwner).filter(e => this.hasAnyAilment(e)).length;
    }
    
    countByName(owner, nameFragment) {
        return this.getAllCryptids(owner).filter(c => 
            c.name && c.name.toLowerCase().includes(nameFragment.toLowerCase())
        ).length;
    }
    
    // Game state accessors
    getCombatCol(owner) { return owner === 'player' ? 1 : 0; }
    getSupportCol(owner) { return owner === 'player' ? 0 : 1; }
    getField(owner) { return owner === 'player' ? this.state.playerField : this.state.enemyField; }
    getCryptidAt(owner, col, row) { return this.getField(owner)?.[col]?.[row] || null; }
    
    getCombatant(support) {
        if (!support) return null;
        return this.getCryptidAt(support.owner, this.getCombatCol(support.owner), support.row);
    }
    
    getSupport(combatant) {
        if (!combatant) return null;
        return this.getCryptidAt(combatant.owner, this.getSupportCol(combatant.owner), combatant.row);
    }
    
    getEnemiesAcross(cryptid) {
        if (!cryptid) return [];
        const enemyOwner = cryptid.owner === 'player' ? 'enemy' : 'player';
        const result = [];
        const combatant = this.getCryptidAt(enemyOwner, this.getCombatCol(enemyOwner), cryptid.row);
        if (combatant) result.push(combatant);
        const support = this.getCryptidAt(enemyOwner, this.getSupportCol(enemyOwner), cryptid.row);
        if (support) result.push(support);
        return result;
    }
    
    getAllCryptids(owner) {
        const field = this.getField(owner);
        const result = [];
        for (let col = 0; col < 2; col++) {
            for (let row = 0; row < 3; row++) {
                if (field?.[col]?.[row]) result.push(field[col][row]);
            }
        }
        return result;
    }
    
    getAllCombatants(owner) {
        const field = this.getField(owner);
        const combatCol = this.getCombatCol(owner);
        const result = [];
        for (let row = 0; row < 3; row++) {
            if (field?.[combatCol]?.[row]) result.push(field[combatCol][row]);
        }
        return result;
    }
    
    getColumn(owner, col) {
        const field = this.getField(owner);
        const result = [];
        for (let row = 0; row < 3; row++) {
            if (field?.[col]?.[row]) result.push(field[col][row]);
        }
        return result;
    }
    
    getAdjacentCryptids(cryptid) {
        if (!cryptid) return [];
        const result = [];
        const field = this.getField(cryptid.owner);
        const { col, row } = cryptid;
        if (row > 0 && field[col][row - 1]) result.push(field[col][row - 1]);
        if (row < 2 && field[col][row + 1]) result.push(field[col][row + 1]);
        const otherCol = col === 0 ? 1 : 0;
        if (field[otherCol][row]) result.push(field[otherCol][row]);
        return result;
    }
    
    // Game actions
    dealDamage(target, amount, source = 'ability') {
        if (!target || amount <= 0) return null;
        const hpBefore = target.currentHp || target.hp;
        target.currentHp = hpBefore - amount;
        this.emitEvent('onDamageTaken', { target, damage: amount, source: this.context.self, sourceType: source, hpBefore, hpAfter: target.currentHp });
        if (target.currentHp <= 0 && !target.preventDeath) {
            target.killedBy = source;
            target.killedBySource = this.context.self;
            return { type: 'damage', target, amount, killed: true };
        }
        return { type: 'damage', target, amount, killed: false };
    }
    
    heal(target, amount) {
        if (!target || amount <= 0) return null;
        const hpBefore = target.currentHp || target.hp;
        const maxHp = target.maxHp || target.hp;
        target.currentHp = Math.min(maxHp, hpBefore + amount);
        const healed = target.currentHp - hpBefore;
        if (healed > 0) this.emitEvent('onHeal', { target, amount: healed, source: this.context.self });
        return { type: 'heal', target, amount: healed };
    }
    
    applyBurn(target, stacks = 3) {
        if (!target) return null;
        if (target.ailmentImmune || target.burnImmune) {
            this.emitEvent('onAilmentBlocked', { target, ailment: 'burn' });
            return { type: 'burnBlocked', target };
        }
        target.burnTurns = Math.max(target.burnTurns || 0, stacks);
        this.emitEvent('onStatusApplied', { cryptid: target, status: 'burn', owner: target.owner });
        return { type: 'applyBurn', target, stacks };
    }
    
    applyBleed(target, stacks = 2) {
        if (!target) return null;
        if (target.ailmentImmune) {
            this.emitEvent('onAilmentBlocked', { target, ailment: 'bleed' });
            return { type: 'bleedBlocked', target };
        }
        target.bleedTurns = (target.bleedTurns || 0) + stacks;
        target.bleedStacks = (target.bleedStacks || 0) + 1;
        this.emitEvent('onStatusApplied', { cryptid: target, status: 'bleed', owner: target.owner });
        return { type: 'applyBleed', target, stacks };
    }
    
    applyParalyze(target) {
        if (!target) return null;
        if (target.ailmentImmune) {
            this.emitEvent('onAilmentBlocked', { target, ailment: 'paralyze' });
            return { type: 'paralyzeBlocked', target };
        }
        target.paralyzed = true;
        target.paralyzeTurns = 1;
        this.emitEvent('onStatusApplied', { cryptid: target, status: 'paralyze', owner: target.owner });
        return { type: 'applyParalyze', target };
    }
    
    applyCalamity(target, stacks = 1) {
        if (!target) return null;
        if (target.ailmentImmune) {
            this.emitEvent('onAilmentBlocked', { target, ailment: 'calamity' });
            return { type: 'calamityBlocked', target };
        }
        target.calamityCounters = (target.calamityCounters || 0) + stacks;
        this.emitEvent('onStatusApplied', { cryptid: target, status: 'calamity', owner: target.owner });
        return { type: 'applyCalamity', target, stacks };
    }
    
    applyCurse(target, stacks = 1) {
        if (!target) return null;
        if (target.ailmentImmune) {
            this.emitEvent('onAilmentBlocked', { target, ailment: 'curse' });
            return { type: 'curseBlocked', target };
        }
        target.curseTokens = (target.curseTokens || 0) + stacks;
        this.emitEvent('onStatusApplied', { cryptid: target, status: 'curse', owner: target.owner });
        return { type: 'applyCurse', target, stacks };
    }
    
    cleanse(target) {
        if (!target) return null;
        const hadAilments = this.countUniqueAilments(target);
        target.burnTurns = 0;
        target.bleedTurns = 0;
        target.bleedStacks = 0;
        target.paralyzed = false;
        target.paralyzeTurns = 0;
        target.calamityCounters = 0;
        target.curseTokens = 0;
        if (hadAilments > 0) this.emitEvent('onCleanse', { cryptid: target, count: hadAilments, owner: target.owner });
        return { type: 'cleanse', target, cleansed: hadAilments };
    }
    
    extendAilments(target, turns = 1) {
        if (!target) return null;
        let extended = 0;
        if (target.burnTurns > 0) { target.burnTurns += turns; extended++; }
        if (target.bleedTurns > 0) { target.bleedTurns += turns; extended++; }
        if (target.paralyzeTurns > 0) { target.paralyzeTurns += turns; extended++; }
        if (target.calamityCounters > 0) { target.calamityCounters += turns; extended++; }
        if (target.curseTokens > 0) { target.curseTokens += turns; extended++; }
        return { type: 'extendAilments', target, extended, turns };
    }
    
    gainPyre(owner, amount) {
        if (amount <= 0) return null;
        if (owner === 'player') this.state.playerPyre = (this.state.playerPyre || 0) + amount;
        else this.state.enemyPyre = (this.state.enemyPyre || 0) + amount;
        this.emitEvent('onPyreGained', { owner, amount, source: this.context.self });
        return { type: 'gainPyre', owner, amount };
    }
    
    stealPyre(owner, amount) {
        const enemyOwner = owner === 'player' ? 'enemy' : 'player';
        const enemyPyre = enemyOwner === 'player' ? this.state.playerPyre : this.state.enemyPyre;
        const stolen = Math.min(amount, enemyPyre || 0);
        if (stolen <= 0) return null;
        if (enemyOwner === 'player') this.state.playerPyre -= stolen;
        else this.state.enemyPyre -= stolen;
        this.gainPyre(owner, stolen);
        return { type: 'stealPyre', owner, amount: stolen };
    }
    
    drawCards(owner, count = 1) {
        this.emitEvent('onDrawCard', { owner, count });
        return { type: 'drawCards', owner, count };
    }
    
    killCryptid(target, killedBy = 'ability') {
        if (!target) return null;
        target.killedBy = killedBy;
        target.killedBySource = this.context.self;
        const field = this.getField(target.owner);
        if (field?.[target.col]?.[target.row] === target) field[target.col][target.row] = null;
        this.emitEvent('onDeath', { cryptid: target, owner: target.owner, col: target.col, row: target.row, killedBy, killedBySource: this.context.self });
        return { type: 'kill', target, killedBy };
    }
    
    applyToxic(owner, col, row) {
        this.emitEvent('onToxicApplied', { owner, col, row });
        return { type: 'applyToxic', owner, col, row };
    }
    
    emitEvent(type, data) {
        this.eventQueue.push({ type, data, timestamp: Date.now() });
    }
}

// ==================== EXPORTS ====================

// ES6 exports for Cloudflare Workers
export { Triggers, EffectTypes, TargetTypes, ConditionTypes, CalcTypes, Flags, AbilityExecutor };

// CommonJS for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Triggers, EffectTypes, TargetTypes, ConditionTypes, CalcTypes, Flags, AbilityExecutor };
}

