/**
 * Cryptid Fates - Effect Engine
 * 
 * The execution engine for the declarative effect system.
 * Processes card effects defined in the schema format and executes them.
 * 
 * Flow:
 *   1. Card is summoned/enters combat/etc. → Trigger fires
 *   2. Engine finds all effects listening for that trigger
 *   3. For each effect: check conditions → resolve targets → calculate amounts → execute action
 *   4. Animation system plays visuals
 */

window.EffectEngine = {
    
    // Track active auras for cleanup
    activeAuras: new Map(), // cryptid.id -> [aura effects]
    
    // Track event subscriptions for cleanup
    subscriptions: new Map(), // cryptid.id -> [unsubscribe functions]
    
    // ==================== INITIALIZATION ====================
    
    /**
     * Initialize the effect engine
     */
    init() {
        console.log('[EffectEngine] Initializing...');
        this.activeAuras.clear();
        this.subscriptions.clear();
    },
    
    /**
     * Register a cryptid's effects when it enters the field
     */
    registerCryptid(cryptid, owner, game) {
        console.log(`[EffectEngine] registerCryptid called for ${cryptid?.name}, effects:`, cryptid?.effects?.length || 0);
        
        if (!cryptid.effects || !Array.isArray(cryptid.effects)) {
            console.log(`[EffectEngine] ${cryptid?.name} has no declarative effects, skipping registration`);
            return; // Card has no declarative effects
        }
        
        const subscriptions = [];
        
        cryptid.effects.forEach((effect, index) => {
            const sub = this.registerEffect(cryptid, owner, game, effect, index);
            if (sub) subscriptions.push(sub);
        });
        
        this.subscriptions.set(cryptid.id, subscriptions);
        console.log(`[EffectEngine] Registered ${subscriptions.length} effects for ${cryptid.name}`);
    },
    
    /**
     * Unregister a cryptid's effects when it leaves the field
     */
    unregisterCryptid(cryptid) {
        // Clean up event subscriptions
        const subs = this.subscriptions.get(cryptid.id);
        if (subs) {
            subs.forEach(unsub => {
                if (typeof unsub === 'function') unsub();
            });
            this.subscriptions.delete(cryptid.id);
        }
        
        // Clean up auras
        this.removeAurasFrom(cryptid);
        
        console.log(`[EffectEngine] Unregistered effects for ${cryptid.name}`);
    },
    
    /**
     * Register a single effect
     */
    registerEffect(cryptid, owner, game, effect, effectIndex) {
        const trigger = effect.trigger;
        
        // Map trigger names to GameEvents
        const eventMap = {
            onSummon: 'onSummon',
            onEnterCombat: 'onEnterCombat',
            onEnterSupport: 'onSupport',
            onLeaveSupport: 'onLeavingSupport',
            onLeavingSupport: 'onLeavingSupport',
            onDeath: 'onDeath',
            onAllyDeath: 'onDeath',
            onEnemyDeath: 'onDeath',
            onAnyDeath: 'onDeath',
            onTurnStart: 'onTurnStart',
            onTurnEnd: 'onTurnEnd',
            onDamageDealt: 'onDamageDealt',
            onDamageTaken: 'onDamageTaken',
            onAttack: 'onAttack',
            onCombatAttack: 'onCombatAttack',
            onBeforeAttack: 'onBeforeAttack',
            onKill: 'onKill',
        };
        
        const eventName = eventMap[trigger];
        
        if (!eventName) {
            // Aura effects don't need event subscriptions
            if (trigger === 'whileInCombat' || trigger === 'whileInSupport' || trigger === 'whileAlive') {
                return null;
            }
            console.warn(`[EffectEngine] Unknown trigger: ${trigger} for effect ${effect.action}`);
            return null;
        }
        
        // Subscribe to the event
        const handler = (data) => {
            console.log(`[EffectEngine] Event '${eventName}' fired, checking effect '${effect.action}' for ${cryptid.name}`);
            this.handleTrigger(cryptid, owner, game, effect, trigger, data);
        };
        
        console.log(`[EffectEngine] Subscribing ${cryptid.name} to '${eventName}' for action '${effect.action}'`);
        return GameEvents.on(eventName, handler);
    },
    
    // ==================== TRIGGER HANDLING ====================
    
    /**
     * Handle a trigger event
     */
    handleTrigger(cryptid, owner, game, effect, trigger, eventData) {
        // Check if this trigger applies to this cryptid
        if (!this.shouldTrigger(cryptid, owner, game, effect, trigger, eventData)) {
            console.log(`[EffectEngine] shouldTrigger returned false for ${cryptid.name}'s ${effect.action}`);
            return;
        }
        
        // Check conditions
        if (effect.condition && !this.checkCondition(cryptid, owner, game, effect.condition, eventData)) {
            console.log(`[EffectEngine] Condition check failed for ${cryptid.name}'s ${effect.action}`);
            return;
        }
        
        console.log(`[EffectEngine] ✅ Triggering ${effect.action} for ${cryptid.name}`);
        
        // Execute the effect
        this.executeEffect(cryptid, owner, game, effect, eventData);
    },
    
    /**
     * Check if a trigger should activate for this cryptid
     */
    shouldTrigger(cryptid, owner, game, effect, trigger, eventData) {
        // For death triggers, check ownership
        if (trigger === 'onAllyDeath') {
            return eventData.owner === owner && eventData.cryptid.id !== cryptid.id;
        }
        if (trigger === 'onEnemyDeath') {
            return eventData.owner !== owner;
        }
        if (trigger === 'onAnyDeath') {
            return true;
        }
        if (trigger === 'onDeath') {
            return eventData.cryptid?.id === cryptid.id;
        }
        
        // For summon/position triggers, check if it's this cryptid
        if (trigger === 'onSummon' || trigger === 'onEnterCombat' || trigger === 'onEnterSupport') {
            const match = eventData.cryptid?.id === cryptid.id || eventData.card?.id === cryptid.id;
            console.log(`[EffectEngine] shouldTrigger for ${trigger}: eventData.cryptid.id=${eventData.cryptid?.id}, cryptid.id=${cryptid.id}, match=${match}`);
            return match;
        }
        
        // For turn triggers, check ownership
        if (trigger === 'onTurnStart' || trigger === 'onTurnEnd') {
            return eventData.owner === owner;
        }
        
        // For damage/attack triggers, check if this cryptid was involved
        if (trigger === 'onDamageDealt' || trigger === 'onCombatAttack' || trigger === 'onBeforeAttack') {
            return eventData.attacker?.id === cryptid.id;
        }
        if (trigger === 'onDamageTaken') {
            return eventData.target?.id === cryptid.id;
        }
        
        return true;
    },
    
    // ==================== CONDITION CHECKING ====================
    
    /**
     * Check if a condition is met
     */
    checkCondition(cryptid, owner, game, condition, eventData) {
        const { check, value, comparator = 'eq' } = condition;
        
        let result = false;
        
        switch (check) {
            // HP Conditions
            case 'selfHpBelow':
                result = (cryptid.currentHp || cryptid.hp) < value;
                break;
            case 'selfHpAbove':
                result = (cryptid.currentHp || cryptid.hp) > value;
                break;
            case 'selfHpFull':
                result = (cryptid.currentHp || cryptid.hp) >= (cryptid.maxHp || cryptid.hp);
                break;
            case 'selfDamaged':
                result = (cryptid.currentHp || cryptid.hp) < (cryptid.maxHp || cryptid.hp);
                break;
                
            // Ailment Conditions
            case 'selfHasAilment':
                result = this.hasAilments(cryptid);
                break;
            case 'selfNoAilment':
                result = !this.hasAilments(cryptid);
                break;
            case 'targetHasAilment':
                result = eventData.target && this.hasAilments(eventData.target);
                break;
            case 'targetHadAilments':
                result = eventData.cryptid && (
                    this.getAilmentStacks(eventData.cryptid) > 0 ||
                    eventData.cryptid.killedBy === 'burn' ||
                    eventData.cryptid.killedBy === 'bleed' ||
                    eventData.cryptid.killedBy === 'calamity'
                );
                break;
                
            // Position Conditions
            case 'selfInCombat':
                result = cryptid.col === game.getCombatCol(owner);
                break;
            case 'selfInSupport':
                result = cryptid.col === game.getSupportCol(owner);
                break;
            case 'hasSupport':
                const supportCol = game.getSupportCol(owner);
                const field = owner === 'player' ? game.playerField : game.enemyField;
                result = field[supportCol]?.[cryptid.row] != null;
                break;
                
            // Count Conditions
            case 'allyCount':
                result = this.compareValue(this.countAllies(owner, game), value, comparator);
                break;
            case 'enemyCount':
                result = this.compareValue(this.countEnemies(owner, game), value, comparator);
                break;
                
            // Resource Conditions
            case 'pyreAtLeast':
                const pyre = owner === 'player' ? game.playerPyre : game.enemyPyre;
                result = pyre >= value;
                break;
                
            // Combat Conditions
            case 'wasLethal':
                result = eventData.killed === true;
                break;
            case 'killerWasAilment':
                result = ['burn', 'bleed', 'calamity', 'curse'].includes(eventData.cryptid?.killedBy);
                break;
                
            default:
                console.warn(`[EffectEngine] Unknown condition: ${check}`);
                result = true;
        }
        
        return result;
    },
    
    /**
     * Compare a value with various comparators
     */
    compareValue(actual, expected, comparator) {
        switch (comparator) {
            case 'eq': return actual === expected;
            case 'ne': return actual !== expected;
            case 'gt': return actual > expected;
            case 'gte': return actual >= expected;
            case 'lt': return actual < expected;
            case 'lte': return actual <= expected;
            default: return actual === expected;
        }
    },
    
    // ==================== TARGET RESOLUTION ====================
    
    /**
     * Resolve targets for an effect
     */
    resolveTargets(cryptid, owner, game, targetType, eventData) {
        const enemyOwner = owner === 'player' ? 'enemy' : 'player';
        const playerField = game.playerField;
        const enemyField = game.enemyField;
        const myField = owner === 'player' ? playerField : enemyField;
        const theirField = owner === 'player' ? enemyField : playerField;
        const combatCol = game.getCombatCol(owner);
        const supportCol = game.getSupportCol(owner);
        const enemyCombatCol = game.getCombatCol(enemyOwner);
        const enemySupportCol = game.getSupportCol(enemyOwner);
        
        let targets = [];
        
        switch (targetType) {
            // Self
            case 'self':
                targets = [cryptid];
                break;
                
            // Allies
            case 'allAllies':
                targets = this.getAllCryptids(myField);
                break;
            case 'allyCombatants':
                targets = this.getColumnCryptids(myField, combatCol);
                break;
            case 'allySupports':
                targets = this.getColumnCryptids(myField, supportCol);
                break;
            case 'allyInSameRow':
                const allyInRow = myField[supportCol]?.[cryptid.row] || myField[combatCol]?.[cryptid.row];
                if (allyInRow && allyInRow.id !== cryptid.id) targets = [allyInRow];
                break;
            case 'randomAlly':
                const allies = this.getAllCryptids(myField).filter(c => c.id !== cryptid.id);
                if (allies.length > 0) targets = [allies[Math.floor(Math.random() * allies.length)]];
                break;
            case 'weakestAlly':
                const weakAllies = this.getAllCryptids(myField).filter(c => c.id !== cryptid.id);
                if (weakAllies.length > 0) {
                    weakAllies.sort((a, b) => (a.currentHp || a.hp) - (b.currentHp || b.hp));
                    targets = [weakAllies[0]];
                }
                break;
                
            // Enemies
            case 'allEnemies':
                targets = this.getAllCryptids(theirField);
                console.log(`[EffectEngine] resolveTargets 'allEnemies': found ${targets.length} enemies`, targets.map(t => t.name));
                break;
            case 'enemyCombatants':
                targets = this.getColumnCryptids(theirField, enemyCombatCol);
                break;
            case 'enemySupports':
                targets = this.getColumnCryptids(theirField, enemySupportCol);
                break;
            case 'enemyOpposite':
                const opposite = theirField[enemyCombatCol]?.[cryptid.row];
                if (opposite) targets = [opposite];
                break;
            case 'enemyOppositeSupport':
                const oppSupport = theirField[enemySupportCol]?.[cryptid.row];
                if (oppSupport) targets = [oppSupport];
                break;
            case 'enemiesAcross':
                // Both enemy combatant and support in same row
                const acrossCombat = theirField[enemyCombatCol]?.[cryptid.row];
                const acrossSupport = theirField[enemySupportCol]?.[cryptid.row];
                if (acrossCombat) targets.push(acrossCombat);
                if (acrossSupport) targets.push(acrossSupport);
                break;
            case 'attackTarget':
                // The target of the current attack (from event data)
                if (eventData.target) targets = [eventData.target];
                else if (eventData.defender) targets = [eventData.defender];
                break;
            case 'myCombatant':
                // The combatant in the same row as this support
                const myCombatant = myField[combatCol]?.[cryptid.row];
                if (myCombatant && myCombatant.id !== cryptid.id) targets = [myCombatant];
                break;
            case 'enemyCombatantAcross':
            case 'enemyCombatSlotAcross':
                // The enemy combatant directly across
                const enemyAcross = theirField[enemyCombatCol]?.[cryptid.row];
                if (enemyAcross) targets = [enemyAcross];
                break;
            case 'enemyRowAcross':
                // All enemies in the same row (both columns)
                const rowCombat = theirField[enemyCombatCol]?.[cryptid.row];
                const rowSupport = theirField[enemySupportCol]?.[cryptid.row];
                if (rowCombat) targets.push(rowCombat);
                if (rowSupport) targets.push(rowSupport);
                break;
            case 'attacker':
                // The attacker in a damage/combat event
                if (eventData.attacker) targets = [eventData.attacker];
                break;
            case 'randomAdjacentToVictim':
                // Random enemy adjacent to the killed target (for on-kill effects)
                if (eventData.cryptid || eventData.target) {
                    const victim = eventData.cryptid || eventData.target;
                    const victimRow = victim.row;
                    const adjacentRows = [victimRow - 1, victimRow + 1].filter(r => r >= 0 && r < 3);
                    const adjacent = [];
                    adjacentRows.forEach(r => {
                        const c1 = theirField[enemyCombatCol]?.[r];
                        const c2 = theirField[enemySupportCol]?.[r];
                        if (c1) adjacent.push(c1);
                        if (c2) adjacent.push(c2);
                    });
                    if (adjacent.length > 0) {
                        targets = [adjacent[Math.floor(Math.random() * adjacent.length)]];
                    }
                }
                break;
            case 'spellTarget':
            case 'auraTarget':
                // For spells/auras, the target comes from event data
                if (eventData.target) targets = [eventData.target];
                else if (eventData.targets) targets = eventData.targets;
                break;
            case 'randomEnemy':
                const enemies = this.getAllCryptids(theirField);
                if (enemies.length > 0) targets = [enemies[Math.floor(Math.random() * enemies.length)]];
                break;
            case 'weakestEnemy':
                const weakEnemies = this.getAllCryptids(theirField);
                if (weakEnemies.length > 0) {
                    weakEnemies.sort((a, b) => (a.currentHp || a.hp) - (b.currentHp || b.hp));
                    targets = [weakEnemies[0]];
                }
                break;
            case 'strongestEnemy':
                const strongEnemies = this.getAllCryptids(theirField);
                if (strongEnemies.length > 0) {
                    strongEnemies.sort((a, b) => (b.currentAtk || b.atk) - (a.currentAtk || a.atk));
                    targets = [strongEnemies[0]];
                }
                break;
            case 'ailmentedEnemies':
                targets = this.getAllCryptids(theirField).filter(c => this.hasAilments(c));
                break;
                
            // Row-based
            case 'sameRow':
                for (let col = 0; col < 2; col++) {
                    const c1 = playerField[col]?.[cryptid.row];
                    const c2 = enemyField[col]?.[cryptid.row];
                    if (c1) targets.push(c1);
                    if (c2) targets.push(c2);
                }
                break;
                
            // All
            case 'allCards':
                targets = [...this.getAllCryptids(playerField), ...this.getAllCryptids(enemyField)];
                break;
                
            // Special (from event data)
            case 'attacker':
                if (eventData.attacker) targets = [eventData.attacker];
                break;
            case 'defender':
                if (eventData.target) targets = [eventData.target];
                break;
            case 'killer':
                if (eventData.killer) targets = [eventData.killer];
                break;
            case 'triggerSource':
                if (eventData.cryptid) targets = [eventData.cryptid];
                break;
                
            default:
                console.warn(`[EffectEngine] Unknown target type: ${targetType}`);
        }
        
        // Filter out dead/null targets
        return targets.filter(t => t && (t.currentHp || t.hp) > 0);
    },
    
    // ==================== AMOUNT CALCULATION ====================
    
    /**
     * Calculate the amount for an effect
     */
    calculateAmount(cryptid, owner, game, amountDef, targets, eventData) {
        // Simple flat value
        if (typeof amountDef === 'number') {
            return amountDef;
        }
        
        // Object with calculation
        if (typeof amountDef === 'object') {
            const { calc, value = 1, multiplier = 1 } = amountDef;
            
            switch (calc) {
                case 'flat':
                    return value;
                    
                // Stack-based (returns array for per-target amounts)
                case 'perAilmentStack':
                case 'targetAilmentStacks':
                    return targets.map(t => this.getAilmentStacks(t) * multiplier);
                    
                case 'perBurnStack':
                    return targets.map(t => (t.burnTurns || 0) * multiplier);
                    
                case 'perBleedStack':
                    return targets.map(t => (t.bleedTurns || 0) * multiplier);
                    
                case 'stacksCleansed':
                    // This is calculated during cleanse action
                    return eventData.stacksCleansed || 0;
                    
                // Stat-based
                case 'percentMaxHp':
                    return Math.floor((cryptid.maxHp || cryptid.hp) * (value / 100));
                    
                case 'percentMissingHp':
                    const missing = (cryptid.maxHp || cryptid.hp) - (cryptid.currentHp || cryptid.hp);
                    return Math.floor(missing * (value / 100));
                    
                case 'selfAtk':
                    return (cryptid.currentAtk || cryptid.atk) * multiplier;
                    
                // Count-based
                case 'perAllyOnField':
                    return this.countAllies(owner, game) * multiplier;
                    
                case 'perEnemyOnField':
                    return this.countEnemies(owner, game) * multiplier;
                    
                case 'perDeathThisGame':
                    return (game.playerDeaths + game.enemyDeaths) * multiplier;
                    
                // Resource-based
                case 'perPyre':
                    const pyre = owner === 'player' ? game.playerPyre : game.enemyPyre;
                    return pyre * multiplier;
                    
                // Damage-based
                case 'damageDealt':
                    return (eventData.damage || 0) * multiplier;
                    
                case 'damageTaken':
                    return (eventData.damage || 0) * multiplier;
                    
                case 'overkillDamage':
                    return (eventData.overkill || 0) * multiplier;
                    
                default:
                    console.warn(`[EffectEngine] Unknown calculation: ${calc}`);
                    return value;
            }
        }
        
        return 1; // Default
    },
    
    // ==================== ACTION EXECUTION ====================
    
    /**
     * Execute an effect action
     */
    executeEffect(cryptid, owner, game, effect, eventData) {
        const targets = this.resolveTargets(cryptid, owner, game, effect.target || 'self', eventData);
        
        if (targets.length === 0 && effect.target !== 'self') {
            console.log(`[EffectEngine] No valid targets for ${effect.action}`);
            return;
        }
        
        const amount = this.calculateAmount(cryptid, owner, game, effect.amount, targets, eventData);
        
        // Execute based on action type
        switch (effect.action) {
            case 'dealDamage':
            case 'dealDamagePerStack':
                this.actionDealDamage(cryptid, owner, game, targets, amount, effect);
                break;
            
            case 'dealDamagePerAilmentStack':
                this.actionDealDamagePerAilmentStack(cryptid, owner, game, targets, effect);
                break;
                
            case 'heal':
                this.actionHeal(cryptid, owner, game, targets, amount, effect);
                break;
                
            case 'buffStats':
                this.actionBuffStats(cryptid, owner, game, targets, effect.amount, effect);
                break;
                
            case 'debuffStats':
                this.actionDebuffStats(cryptid, owner, game, targets, effect.amount, effect);
                break;
                
            case 'applyBurn':
                this.actionApplyAilment(cryptid, owner, game, targets, 'burn', amount, effect);
                break;
                
            case 'applyBleed':
                this.actionApplyAilment(cryptid, owner, game, targets, 'bleed', amount, effect);
                break;
                
            case 'applyParalyze':
                this.actionApplyAilment(cryptid, owner, game, targets, 'paralyze', 1, effect);
                break;
                
            case 'cleanse':
                this.actionCleanse(cryptid, owner, game, targets, effect);
                break;
                
            case 'cleanseAndBuff':
                this.actionCleanseAndBuff(cryptid, owner, game, targets, effect);
                break;
                
            case 'grantKeyword':
                this.actionGrantKeyword(cryptid, owner, game, targets, effect.keyword, effect);
                break;
                
            case 'grantAura':
                this.actionGrantAura(cryptid, owner, game, targets, effect.aura, effect);
                break;
                
            case 'buffSelf':
                this.actionBuffStats(cryptid, owner, game, [cryptid], effect.amount, effect);
                break;
                
            case 'gainPyre':
                this.actionGainPyre(cryptid, owner, game, amount, effect);
                break;
                
            case 'destroy':
                this.actionDestroy(cryptid, owner, game, targets, effect);
                break;
            
            case 'gainPermanentStat':
                this.actionGainPermanentStat(cryptid, owner, game, effect);
                break;
            
            case 'applyAilment':
                this.actionApplyAilment(cryptid, owner, game, targets, effect.ailmentType, amount || 1, effect);
                break;
            
            case 'extendAilments':
                this.actionExtendAilments(cryptid, owner, game, targets, effect.amount || 1, effect);
                break;
            
            case 'setFlag':
            case 'grantFlag':
                this.actionSetFlag(cryptid, owner, game, targets, effect.flag, effect.value !== false, effect);
                break;
            
            case 'removeFlag':
                this.actionSetFlag(cryptid, owner, game, targets, effect.flag, false, effect);
                break;
            
            case 'grantCombatBonus':
                this.actionGrantCombatBonus(cryptid, owner, game, targets, effect.bonusType, effect.amount, effect);
                break;
            
            case 'removeCombatBonus':
                this.actionRemoveCombatBonus(cryptid, owner, game, targets, effect.bonusType, effect.amount, effect);
                break;
            
            case 'grantRegeneration':
                this.actionGrantRegeneration(cryptid, owner, game, targets, effect.amount || 1, effect);
                break;
                
            default:
                console.warn(`[EffectEngine] Unknown action: ${effect.action}`);
        }
        
        // Handle bonus effects
        if (effect.bonus) {
            this.executeEffect(cryptid, owner, game, {
                ...effect.bonus,
                _parentAmount: amount
            }, { ...eventData, stacksCleansed: eventData.stacksCleansed });
        }
    },
    
    // ==================== ACTION IMPLEMENTATIONS ====================
    
    actionDealDamage(source, owner, game, targets, amounts, effect) {
        const amountArray = Array.isArray(amounts) ? amounts : targets.map(() => amounts);
        const deaths = [];
        
        // Phase 1: Apply damage to all targets, show damage numbers simultaneously
        targets.forEach((target, i) => {
            const damage = amountArray[i] || amountArray[0] || 1;
            if (damage <= 0) return;
            
            target.currentHp = (target.currentHp || target.hp) - damage;
            
            console.log(`[EffectEngine] ${source.name} deals ${damage} damage to ${target.name}`);
            
            // Show damage number animation (all at once)
            if (typeof CombatEffects !== 'undefined' && CombatEffects.showDamageNumber) {
                CombatEffects.showDamageNumber(target, damage, damage >= 5);
            }
            
            // Show clean hit effect
            this.playHitEffect(target);
            
            // Collect deaths
            if (target.currentHp <= 0) {
                target.killedBy = effect.killedBy || 'effect';
                target.killedBySource = source;
                deaths.push({ target, col: target.col, row: target.row, owner: target.owner });
            }
        });
        
        // Phase 2: Re-render to show damage
        if (typeof renderSprites === 'function') {
            setTimeout(() => renderSprites(), 50);
        }
        
        // Phase 3: Process deaths sequentially (row-first, combat before support)
        if (deaths.length > 0) {
            const sortedDeaths = this.sortDeathsForAnimation(deaths);
            this.processDeathsSequentially(sortedDeaths, game, owner, 0);
        }
    },
    
    actionHeal(source, owner, game, targets, amount, effect) {
        targets.forEach(target => {
            const maxHp = target.maxHp || target.hp;
            const before = target.currentHp || target.hp;
            target.currentHp = Math.min(maxHp, before + amount);
            const healed = target.currentHp - before;
            
            console.log(`[EffectEngine] ${source.name} heals ${target.name} for ${healed}`);
        });
        
        EffectAnimations.playForAction('heal', source, targets, { amount });
        
        if (typeof renderSprites === 'function') {
            setTimeout(() => renderSprites(), 100);
        }
    },
    
    actionBuffStats(source, owner, game, targets, stats, effect) {
        const atkBuff = stats.atk || 0;
        const hpBuff = stats.hp || 0;
        const permanent = effect.permanent || false;
        
        targets.forEach(target => {
            if (atkBuff) {
                target.currentAtk = (target.currentAtk || target.atk) + atkBuff;
                if (permanent) target.baseAtk = (target.baseAtk || target.atk) + atkBuff;
            }
            if (hpBuff) {
                target.currentHp = (target.currentHp || target.hp) + hpBuff;
                target.maxHp = (target.maxHp || target.hp) + hpBuff;
            }
            
            console.log(`[EffectEngine] ${target.name} gains +${atkBuff}/+${hpBuff}`);
        });
        
        EffectAnimations.playForAction('buffStats', source, targets, { atk: atkBuff, hp: hpBuff });
        
        if (typeof renderSprites === 'function') {
            setTimeout(() => renderSprites(), 100);
        }
    },
    
    actionDebuffStats(source, owner, game, targets, stats, effect) {
        const atkDebuff = stats.atk || 0;
        const hpDebuff = stats.hp || 0;
        
        targets.forEach(target => {
            if (atkDebuff) {
                target.currentAtk = Math.max(0, (target.currentAtk || target.atk) - atkDebuff);
            }
            if (hpDebuff) {
                target.currentHp = (target.currentHp || target.hp) - hpDebuff;
                if (target.currentHp <= 0) {
                    GameEvents.emit('onDeath', { cryptid: target, owner: target.owner, killer: source });
                }
            }
        });
        
        EffectAnimations.playForAction('debuffStats', source, targets, { atk: atkDebuff, hp: hpDebuff });
        
        if (typeof renderSprites === 'function') {
            setTimeout(() => renderSprites(), 100);
        }
    },
    
    actionApplyAilment(source, owner, game, targets, ailment, stacks, effect) {
        targets.forEach(target => {
            // Check for immunity
            if (target.hasMothmanAilmentImmunity || target.ailmentImmune) {
                console.log(`[EffectEngine] ${target.name} is immune to ailments`);
                return;
            }
            
            switch (ailment) {
                case 'burn':
                    target.burnTurns = (target.burnTurns || 0) + stacks;
                    break;
                case 'bleed':
                    target.bleedTurns = (target.bleedTurns || 0) + stacks;
                    break;
                case 'paralyze':
                    target.paralyzed = true;
                    break;
                case 'calamity':
                    target.calamityCounters = (target.calamityCounters || 0) + stacks;
                    break;
                case 'curse':
                    target.curseTokens = (target.curseTokens || 0) + stacks;
                    break;
            }
            
            console.log(`[EffectEngine] ${target.name} receives ${ailment} (${stacks} stacks)`);
        });
        
        EffectAnimations.playForAction(`apply${ailment.charAt(0).toUpperCase() + ailment.slice(1)}`, source, targets, { stacks });
        
        if (typeof renderSprites === 'function') {
            setTimeout(() => renderSprites(), 100);
        }
    },
    
    actionCleanse(source, owner, game, targets, effect) {
        let totalCleansed = 0;
        
        targets.forEach(target => {
            const stacks = this.getAilmentStacks(target);
            totalCleansed += stacks;
            
            target.paralyzed = false;
            target.burnTurns = 0;
            target.bleedTurns = 0;
            target.calamityCounters = 0;
            target.curseTokens = 0;
            
            console.log(`[EffectEngine] Cleansed ${stacks} stacks from ${target.name}`);
        });
        
        EffectAnimations.playForAction('cleanse', source, targets, { stacksCleansed: totalCleansed });
        
        if (typeof renderSprites === 'function') {
            setTimeout(() => renderSprites(), 100);
        }
        
        return totalCleansed;
    },
    
    actionCleanseAndBuff(source, owner, game, targets, effect) {
        let totalCleansed = 0;
        
        targets.forEach(target => {
            const stacks = this.getAilmentStacks(target);
            totalCleansed += stacks;
            
            // Cleanse
            target.paralyzed = false;
            target.burnTurns = 0;
            target.bleedTurns = 0;
            target.calamityCounters = 0;
            target.curseTokens = 0;
            
            // Buff per stack
            if (stacks > 0) {
                target.currentAtk = (target.currentAtk || target.atk) + stacks;
                target.baseAtk = (target.baseAtk || target.atk) + stacks;
                target.currentHp = (target.currentHp || target.hp) + stacks;
                target.maxHp = (target.maxHp || target.hp) + stacks;
            }
        });
        
        EffectAnimations.playForAction('cleanseAndBuff', source, targets, { stacksCleansed: totalCleansed });
        
        if (typeof renderSprites === 'function') {
            setTimeout(() => renderSprites(), 100);
        }
    },
    
    actionGrantKeyword(source, owner, game, targets, keyword, effect) {
        targets.forEach(target => {
            switch (keyword) {
                case 'flight':
                    target.canTargetAny = true;
                    break;
                case 'destroyer':
                    target.hasDestroyer = true;
                    break;
                case 'vampiric':
                    target.hasVampiric = true;
                    break;
                case 'regeneration':
                    target.hasRegeneration = true;
                    break;
                // Add more as needed
            }
            console.log(`[EffectEngine] ${target.name} gains ${keyword}`);
        });
        
        EffectAnimations.playForAction('grantKeyword', source, targets, { keyword });
    },
    
    actionGrantAura(source, owner, game, targets, aura, effect) {
        targets.forEach(target => {
            switch (aura) {
                case 'ailmentImmunity':
                    target.hasMothmanAilmentImmunity = true;
                    break;
                case 'damageImmunity':
                    target.damageImmune = true;
                    break;
                // Add more as needed
            }
        });
        
        // Track aura for cleanup
        if (!this.activeAuras.has(source.id)) {
            this.activeAuras.set(source.id, []);
        }
        this.activeAuras.get(source.id).push({ aura, targets: targets.map(t => t.id) });
        
        EffectAnimations.playForAction('grantAura', source, targets, { aura });
    },
    
    actionGainPyre(source, owner, game, amount, effect) {
        if (owner === 'player') {
            game.playerPyre += amount;
        } else {
            game.enemyPyre += amount;
        }
        
        EffectAnimations.playForAction('gainPyre', source, [], { owner, amount });
        
        if (typeof renderAll === 'function') {
            setTimeout(() => renderAll(), 100);
        }
    },
    
    actionDestroy(source, owner, game, targets, effect) {
        targets.forEach(target => {
            target.currentHp = 0;
            target.killedBy = 'destroy';
            GameEvents.emit('onDeath', { cryptid: target, owner: target.owner, killer: source });
        });
        
        EffectAnimations.playForAction('destroy', source, targets, {});
    },
    
    /**
     * Deal damage to each target based on their ailment stacks
     * Used by Mothman's Harbinger ability
     * 
     * Animation strategy:
     * 1. Show damage numbers on ALL targets simultaneously
     * 2. Collect deaths
     * 3. Animate deaths in sequence (left-to-right, top-to-bottom)
     */
    actionDealDamagePerAilmentStack(source, owner, game, targets, effect) {
        const damagePerStack = effect.damagePerStack || 1;
        let totalDamage = 0;
        const deaths = [];
        
        console.log(`[EffectEngine] actionDealDamagePerAilmentStack: ${targets.length} targets, damagePerStack=${damagePerStack}`);
        
        // Phase 1: Apply damage to all targets simultaneously, show damage numbers
        targets.forEach(target => {
            const stacks = this.getAilmentStacks(target);
            const damage = stacks * damagePerStack;
            
            console.log(`[EffectEngine] Target ${target.name}: ${stacks} ailment stacks, dealing ${damage} damage`);
            
            if (damage <= 0) {
                console.log(`[EffectEngine] ${target.name} has no ailment stacks, no damage dealt`);
                return;
            }
            
            totalDamage += damage;
            target.currentHp = (target.currentHp || target.hp) - damage;
            
            console.log(`[EffectEngine] ${source.name} deals ${damage} damage to ${target.name}`);
            
            // Show damage number animation (all at once)
            if (typeof CombatEffects !== 'undefined' && CombatEffects.showDamageNumber) {
                CombatEffects.showDamageNumber(target, damage, damage >= 5);
            }
            
            // Show clean hit effect
            this.playHitEffect(target);
            
            // Collect deaths for sequenced animation
            if (target.currentHp <= 0) {
                target.killedBy = effect.damageType || 'harbinger';
                target.killedBySource = source;
                deaths.push({ target, col: target.col, row: target.row, owner: target.owner });
            }
        });
        
        // Phase 2: Render to show damage numbers
        if (typeof renderSprites === 'function') {
            setTimeout(() => renderSprites(), 50);
        }
        
        // Phase 3: Process deaths in sequence (row-first, combat before support)
        if (deaths.length > 0) {
            const sortedDeaths = this.sortDeathsForAnimation(deaths);
            this.processDeathsSequentially(sortedDeaths, game, owner, 0);
        }
        
        return totalDamage;
    },
    
    /**
     * Process deaths one at a time with animations
     * Order: row-first (top to bottom), then column (combat before support)
     * 
     * @param {Array} deaths - Array of { target, col, row, owner }
     * @param {Object} game - Game instance
     * @param {string} killerOwner - Owner of the source that caused deaths
     * @param {number} index - Current index in deaths array
     */
    processDeathsSequentially(deaths, game, killerOwner, index) {
        if (index >= deaths.length) {
            // All deaths processed - now handle promotions
            this.processPromotionsAfterDeaths(deaths, game, () => {
                if (typeof renderAll === 'function') {
                    setTimeout(() => renderAll(), 100);
                }
            });
            return;
        }
        
        const { target, col, row, owner } = deaths[index];
        const DEATH_DELAY = 500; // ms between death animations
        
        // Find the sprite for death animation
        const sprite = document.querySelector(
            `.cryptid-sprite[data-owner="${owner}"][data-col="${col}"][data-row="${row}"]`
        );
        
        // Play death animation
        if (sprite && typeof CombatEffects !== 'undefined' && CombatEffects.playDramaticDeath) {
            const rarity = target.rarity || 'common';
            CombatEffects.playDramaticDeath(sprite, owner, rarity, () => {
                // Actually kill the cryptid after animation
                game.killCryptid(target, killerOwner);
                
                // Process next death
                setTimeout(() => {
                    this.processDeathsSequentially(deaths, game, killerOwner, index + 1);
                }, 50);
            });
        } else {
            // Fallback: no animation available
            game.killCryptid(target, killerOwner);
            
            // Process next death after delay
            setTimeout(() => {
                this.processDeathsSequentially(deaths, game, killerOwner, index + 1);
            }, DEATH_DELAY);
        }
    },
    
    /**
     * Sort deaths in the correct order: row-first (top to bottom), then column (combat before support)
     * This gives: top combat, top support, middle combat, middle support, bottom combat, bottom support
     */
    sortDeathsForAnimation(deaths) {
        return deaths.sort((a, b) => {
            // Row first (top to bottom)
            if (a.row !== b.row) return a.row - b.row;
            
            // Then by column - combat cols vary by owner, but typically:
            // For enemy: col 0 is combat, col 1 is support
            // For player: col 1 is combat, col 0 is support
            // We want combat before support
            const aIsCombat = (a.owner === 'enemy' && a.col === 0) || (a.owner === 'player' && a.col === 1);
            const bIsCombat = (b.owner === 'enemy' && b.col === 0) || (b.owner === 'player' && b.col === 1);
            
            if (aIsCombat && !bIsCombat) return -1;
            if (!aIsCombat && bIsCombat) return 1;
            return 0;
        });
    },
    
    /**
     * Process promotions after all deaths have been animated
     * Supports that survived should promote to combat if their combatant died
     */
    processPromotionsAfterDeaths(deaths, game, onComplete) {
        // Find rows where combatants died but supports survived
        const promotionRows = new Map(); // owner -> Set of rows needing promotion
        
        deaths.forEach(death => {
            const owner = death.owner;
            const row = death.row;
            
            // Check if this was a combatant death
            const combatCol = owner === 'enemy' ? 0 : 1;
            if (death.col === combatCol) {
                // Combatant died - check if support exists and survived
                const supportCol = owner === 'enemy' ? 1 : 0;
                const field = owner === 'player' ? game.playerField : game.enemyField;
                const support = field[supportCol]?.[row];
                
                if (support && (support.currentHp > 0 || support.hp > 0)) {
                    if (!promotionRows.has(owner)) {
                        promotionRows.set(owner, new Set());
                    }
                    promotionRows.get(owner).add(row);
                }
            }
        });
        
        // If no promotions needed, complete immediately
        if (promotionRows.size === 0) {
            onComplete?.();
            return;
        }
        
        // Collect all promotions and sort by row
        const promotions = [];
        promotionRows.forEach((rows, owner) => {
            rows.forEach(row => {
                promotions.push({ owner, row });
            });
        });
        promotions.sort((a, b) => a.row - b.row);
        
        // Process promotions sequentially
        this.processPromotionsSequentially(promotions, game, 0, onComplete);
    },
    
    /**
     * Animate promotions one at a time
     */
    processPromotionsSequentially(promotions, game, index, onComplete) {
        if (index >= promotions.length) {
            onComplete?.();
            return;
        }
        
        const { owner, row } = promotions[index];
        const PROMOTION_DELAY = 400;
        
        // Use game's built-in promotion if available
        if (typeof game.promoteSupport === 'function') {
            game.promoteSupport(owner, row);
        }
        
        // Render to show promotion
        if (typeof renderAll === 'function') {
            renderAll();
        }
        
        // Process next promotion after delay
        setTimeout(() => {
            this.processPromotionsSequentially(promotions, game, index + 1, onComplete);
        }, PROMOTION_DELAY);
    },
    
    /**
     * Gain permanent stat buffs (used by Mothman's on enemy death effect)
     */
    actionGainPermanentStat(source, owner, game, effect) {
        const atkGain = effect.atk || 0;
        const hpGain = effect.hp || 0;
        
        if (atkGain) {
            source.currentAtk = (source.currentAtk || source.atk) + atkGain;
            source.baseAtk = (source.baseAtk || source.atk) + atkGain;
        }
        if (hpGain) {
            source.currentHp = (source.currentHp || source.hp) + hpGain;
            source.maxHp = (source.maxHp || source.hp) + hpGain;
        }
        
        console.log(`[EffectEngine] ${source.name} permanently gains +${atkGain}/+${hpGain}`);
        
        EffectAnimations.playForAction('buffStats', source, [source], { atk: atkGain, hp: hpGain });
        
        if (typeof renderSprites === 'function') {
            setTimeout(() => renderSprites(), 100);
        }
    },
    
    /**
     * Extend existing ailments on targets (used by Decay Rat)
     */
    actionExtendAilments(source, owner, game, targets, amount, effect) {
        targets.forEach(target => {
            if (target.burnTurns > 0) {
                target.burnTurns += amount;
            }
            if (target.bleedTurns > 0) {
                target.bleedTurns += amount;
            }
            if (target.paralyzeTurns > 0) {
                target.paralyzeTurns += amount;
            }
            if (target.calamityCounters > 0) {
                target.calamityCounters += amount;
            }
            if (target.curseTokens > 0) {
                target.curseTokens += amount;
            }
            
            console.log(`[EffectEngine] Extended ailments on ${target.name} by ${amount} turns`);
        });
        
        if (typeof renderSprites === 'function') {
            setTimeout(() => renderSprites(), 100);
        }
    },
    
    /**
     * Set a flag on targets
     */
    actionSetFlag(source, owner, game, targets, flag, value, effect) {
        targets.forEach(target => {
            target[flag] = value;
            console.log(`[EffectEngine] Set ${flag}=${value} on ${target.name}`);
        });
        
        if (typeof renderSprites === 'function') {
            setTimeout(() => renderSprites(), 100);
        }
    },
    
    /**
     * Grant a combat bonus to targets
     */
    actionGrantCombatBonus(source, owner, game, targets, bonusType, amount, effect) {
        targets.forEach(target => {
            target[bonusType] = (target[bonusType] || 0) + amount;
            console.log(`[EffectEngine] Granted ${bonusType}+${amount} to ${target.name}`);
        });
    },
    
    /**
     * Remove a combat bonus from targets
     */
    actionRemoveCombatBonus(source, owner, game, targets, bonusType, amount, effect) {
        targets.forEach(target => {
            target[bonusType] = Math.max(0, (target[bonusType] || 0) - amount);
            console.log(`[EffectEngine] Removed ${bonusType}-${amount} from ${target.name}`);
        });
    },
    
    /**
     * Grant regeneration to targets
     */
    actionGrantRegeneration(source, owner, game, targets, amount, effect) {
        targets.forEach(target => {
            target.hasRegeneration = true;
            target.regenerationAmount = (target.regenerationAmount || 0) + amount;
            console.log(`[EffectEngine] Granted regeneration(${amount}) to ${target.name}`);
        });
    },
    
    // ==================== AURA MANAGEMENT ====================
    
    removeAurasFrom(source) {
        const auras = this.activeAuras.get(source.id);
        if (!auras) return;
        
        auras.forEach(auraInfo => {
            // Find targets and remove the aura effect
            // This would need access to game state to find cryptids by ID
            console.log(`[EffectEngine] Removing aura ${auraInfo.aura} from source ${source.name}`);
        });
        
        this.activeAuras.delete(source.id);
    },
    
    // ==================== HELPER FUNCTIONS ====================
    
    hasAilments(cryptid) {
        return this.getAilmentStacks(cryptid) > 0;
    },
    
    getAilmentStacks(cryptid) {
        if (!cryptid) return 0;
        let stacks = 0;
        if (cryptid.paralyzed) stacks += 1;
        if (cryptid.burnTurns > 0) stacks += cryptid.burnTurns;
        if (cryptid.bleedTurns > 0) stacks += cryptid.bleedTurns;
        if (cryptid.calamityCounters > 0) stacks += cryptid.calamityCounters;
        if (cryptid.curseTokens > 0) stacks += cryptid.curseTokens;
        return stacks;
    },
    
    getAllCryptids(field) {
        const cryptids = [];
        for (let col = 0; col < 2; col++) {
            for (let row = 0; row < 3; row++) {
                if (field[col]?.[row]) {
                    cryptids.push(field[col][row]);
                }
            }
        }
        return cryptids;
    },
    
    getColumnCryptids(field, col) {
        const cryptids = [];
        for (let row = 0; row < 3; row++) {
            if (field[col]?.[row]) {
                cryptids.push(field[col][row]);
            }
        }
        return cryptids;
    },
    
    countAllies(owner, game) {
        const field = owner === 'player' ? game.playerField : game.enemyField;
        return this.getAllCryptids(field).length;
    },
    
    countEnemies(owner, game) {
        const field = owner === 'player' ? game.enemyField : game.playerField;
        return this.getAllCryptids(field).length;
    },
    
    /**
     * Play a clean hit effect on a target
     * Uses a smooth flash + shake instead of the spastic CSS animation
     * @param {Object} target - Target cryptid with owner, col, row properties
     * @param {Object} options - Optional settings { intensity: 'light'|'normal'|'heavy', direction: 'left'|'right'|'auto' }
     */
    playHitEffect(target, options = {}) {
        if (!target) return;
        
        const sprite = document.querySelector(
            `.cryptid-sprite[data-owner="${target.owner}"][data-col="${target.col}"][data-row="${target.row}"]`
        );
        
        if (!sprite) return;
        
        this.playHitEffectOnSprite(sprite, target, options);
    },
    
    /**
     * Play hit effect directly on a sprite element
     * Can be called from anywhere (game-core, etc.)
     * IMPORTANT: Sprite has CSS base transform of translate(-50%, -50%), must preserve it!
     */
    playHitEffectOnSprite(sprite, target, options = {}) {
        if (!sprite) return;
        
        const intensity = options.intensity || 'normal';
        const direction = options.direction || (target?.owner === 'enemy' ? 'left' : 'right');
        
        // Intensity settings
        const intensityConfig = {
            light:  { flash: 1.6, recoil: 5,  scale: 0.97, duration: 200 },
            normal: { flash: 1.8, recoil: 8,  scale: 0.95, duration: 280 },
            heavy:  { flash: 2.2, recoil: 12, scale: 0.92, duration: 350 }
        };
        const config = intensityConfig[intensity] || intensityConfig.normal;
        
        // Direction for recoil
        const recoilX = direction === 'left' ? -config.recoil : config.recoil;
        
        // Base transform that must ALWAYS be preserved (sprite centering)
        const baseTransform = 'translate(-50%, -50%)';
        
        // Prevent overlapping animations
        if (sprite.dataset.hitAnimating === 'true') return;
        sprite.dataset.hitAnimating = 'true';
        
        // Phase 1: Instant white flash + initial recoil
        sprite.style.transition = 'none';
        sprite.style.transform = `${baseTransform} translateX(${recoilX}px) scale(${config.scale})`;
        sprite.style.filter = `brightness(${config.flash}) saturate(0.3)`;
        
        // Phase 2: Hold the flash briefly (20% of duration)
        setTimeout(() => {
            sprite.style.transition = `filter ${config.duration * 0.3}ms ease-out`;
            sprite.style.filter = `brightness(0.8)`;
        }, config.duration * 0.2);
        
        // Phase 3: Return to normal position (50% of duration)
        setTimeout(() => {
            sprite.style.transition = `transform ${config.duration * 0.5}ms cubic-bezier(0.25, 1, 0.5, 1), filter ${config.duration * 0.3}ms ease-out`;
            sprite.style.transform = baseTransform;
            sprite.style.filter = '';
        }, config.duration * 0.5);
        
        // Phase 4: Clean up
        setTimeout(() => {
            sprite.style.transition = '';
            sprite.style.transform = '';
            sprite.style.filter = '';
            sprite.dataset.hitAnimating = 'false';
        }, config.duration + 50);
        
        // Also show impact flash if CombatEffects is available
        if (typeof CombatEffects !== 'undefined' && CombatEffects.createImpactFlash) {
            const battlefield = document.getElementById('battlefield-area');
            if (battlefield) {
                const rect = sprite.getBoundingClientRect();
                const bRect = battlefield.getBoundingClientRect();
                const impactX = rect.left + rect.width / 2 - bRect.left;
                const impactY = rect.top + rect.height / 2 - bRect.top;
                CombatEffects.createImpactFlash(impactX, impactY, 30 + (intensity === 'heavy' ? 25 : intensity === 'normal' ? 12 : 0));
            }
        }
    },
};

// Expose globally for use by game-core.js and other files
window.playHitEffect = function(target, options) {
    EffectEngine.playHitEffect(target, options);
};

window.playHitEffectOnSprite = function(sprite, target, options) {
    EffectEngine.playHitEffectOnSprite(sprite, target, options);
};

console.log('[EffectEngine] Effect execution engine loaded v6 - improved hit animations');


