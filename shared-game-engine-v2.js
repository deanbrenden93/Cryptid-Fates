/**
 * Cryptid Fates - Shared Game Engine v2 (Browser Version)
 * 
 * This engine runs identically on client and server.
 * It uses the data-driven ability system to execute all game logic.
 * 
 * ARCHITECTURE:
 * - All game state mutations happen through this engine
 * - AbilityExecutor interprets card abilities
 * - Events are emitted for animations (client) and validation (server)
 */

// Get ability system from browser global (loaded via ability-system.js script tag)
const { AbilityExecutor, Triggers, EffectTypes, TargetTypes, ConditionTypes, CalcTypes, Flags } = window.AbilitySystem;

class SharedGameEngine {
    constructor(initialState = null) {
        // Initialize game state
        this.state = initialState || this.createInitialState();
        
        // Create ability executor
        this.executor = new AbilityExecutor(this.state);
        
        // Override executor methods to use our game methods
        this.bindExecutorMethods();
        
        // Event listeners (for animations on client, logging on server)
        this.eventListeners = {};
        
        // Pending effects queue (for complex ability chains)
        this.pendingEffects = [];
        
        // Death queue (process after ability resolves)
        this.deathQueue = [];
        
        // Promotion queue
        this.promotionQueue = [];
    }
    
    /**
     * Create initial empty game state
     */
    createInitialState() {
        return {
            // Fields: 2D arrays [col][row], col 0 = support, col 1 = combat for player
            playerField: [[null, null, null], [null, null, null]],
            enemyField: [[null, null, null], [null, null, null]],
            
            // Hands
            playerHand: [],
            enemyHand: [],
            
            // Decks
            playerDeck: [],
            enemyDeck: [],
            
            // Resources
            playerPyre: 0,
            enemyPyre: 0,
            
            // Death counters
            playerDeaths: 0,
            enemyDeaths: 0,
            
            // Traps: [row0, row1, row2] for each player (null or trap object)
            playerTraps: [null, null, null],
            enemyTraps: [null, null, null],
            
            // Toxic tiles (set of "owner-col-row" strings)
            toxicTiles: new Set(),
            
            // Turn state
            currentTurn: 'player',
            turnNumber: 1,
            phase: 'main', // 'draw', 'main', 'combat', 'end'
            
            // Tracking
            deathsThisTurn: { player: 0, enemy: 0 },
            deathsLastEnemyTurn: { player: 0, enemy: 0 },
            
            // Kindling pools
            playerKindling: [],
            enemyKindling: [],
            
            // Game status
            gameOver: false,
            winner: null
        };
    }
    
    /**
     * Bind executor methods to use our game methods
     */
    bindExecutorMethods() {
        const self = this;
        
        // Override executor's game state accessors
        this.executor.getCombatCol = (owner) => self.getCombatCol(owner);
        this.executor.getSupportCol = (owner) => self.getSupportCol(owner);
        this.executor.getField = (owner) => self.getField(owner);
        this.executor.getCryptidAt = (owner, col, row) => self.getCryptidAt(owner, col, row);
        this.executor.getCombatant = (support) => self.getCombatant(support);
        this.executor.getSupport = (combatant) => self.getSupport(combatant);
        this.executor.getEnemiesAcross = (cryptid) => self.getEnemiesAcross(cryptid);
        this.executor.getAllCryptids = (owner) => self.getAllCryptids(owner);
        this.executor.getAdjacentCryptids = (cryptid) => self.getAdjacentCryptids(cryptid);
        
        // Override executor's game actions
        this.executor.drawCards = (owner, count) => self.drawCards(owner, count);
        this.executor.killCryptid = (target, killedBy) => self.queueDeath(target, killedBy);
        this.executor.applyToxic = (owner, col, row) => self.applyToxic(owner, col, row);
        this.executor.emitEvent = (type, data) => self.emit(type, data);
    }
    
    // ==================== POSITION HELPERS ====================
    
    getCombatCol(owner) {
        return owner === 'player' ? 1 : 0;
    }
    
    getSupportCol(owner) {
        return owner === 'player' ? 0 : 1;
    }
    
    getField(owner) {
        return owner === 'player' ? this.state.playerField : this.state.enemyField;
    }
    
    getCryptidAt(owner, col, row) {
        const field = this.getField(owner);
        return field?.[col]?.[row] || null;
    }
    
    getCombatant(support) {
        if (!support) return null;
        const combatCol = this.getCombatCol(support.owner);
        return this.getCryptidAt(support.owner, combatCol, support.row);
    }
    
    getSupport(combatant) {
        if (!combatant) return null;
        const supportCol = this.getSupportCol(combatant.owner);
        return this.getCryptidAt(combatant.owner, supportCol, combatant.row);
    }
    
    getEnemiesAcross(cryptid) {
        if (!cryptid) return [];
        const enemyOwner = cryptid.owner === 'player' ? 'enemy' : 'player';
        const result = [];
        
        // Both combat and support in that row
        for (let col = 0; col < 2; col++) {
            const enemy = this.getCryptidAt(enemyOwner, col, cryptid.row);
            if (enemy) result.push(enemy);
        }
        
        return result;
    }
    
    getAllCryptids(owner) {
        const field = this.getField(owner);
        const result = [];
        for (let col = 0; col < 2; col++) {
            for (let row = 0; row < 3; row++) {
                const cryptid = field?.[col]?.[row];
                if (cryptid) result.push(cryptid);
            }
        }
        return result;
    }
    
    getAllCombatants(owner) {
        const field = this.getField(owner);
        const combatCol = this.getCombatCol(owner);
        const result = [];
        for (let row = 0; row < 3; row++) {
            const cryptid = field?.[combatCol]?.[row];
            if (cryptid) result.push(cryptid);
        }
        return result;
    }
    
    getAdjacentCryptids(cryptid) {
        if (!cryptid) return [];
        const result = [];
        const field = this.getField(cryptid.owner);
        const { col, row } = cryptid;
        
        // Same column, adjacent rows
        if (row > 0 && field[col][row - 1]) result.push(field[col][row - 1]);
        if (row < 2 && field[col][row + 1]) result.push(field[col][row + 1]);
        
        // Other column, same row
        const otherCol = col === 0 ? 1 : 0;
        if (field[otherCol][row]) result.push(field[otherCol][row]);
        
        return result;
    }
    
    getDiagonalEnemies(cryptid) {
        if (!cryptid) return [];
        const enemyOwner = cryptid.owner === 'player' ? 'enemy' : 'player';
        const result = [];
        const { row } = cryptid;
        
        // Diagonal = adjacent rows in enemy field
        for (let col = 0; col < 2; col++) {
            if (row > 0) {
                const enemy = this.getCryptidAt(enemyOwner, col, row - 1);
                if (enemy) result.push(enemy);
            }
            if (row < 2) {
                const enemy = this.getCryptidAt(enemyOwner, col, row + 1);
                if (enemy) result.push(enemy);
            }
        }
        
        return result;
    }
    
    // ==================== STATUS HELPERS ====================
    
    hasStatusAilment(cryptid) {
        if (!cryptid) return false;
        return (cryptid.burnTurns || 0) > 0 ||
               (cryptid.bleedTurns || 0) > 0 ||
               !!cryptid.paralyzed ||
               (cryptid.paralyzeTurns || 0) > 0 ||
               (cryptid.calamityCounters || 0) > 0 ||
               (cryptid.curseTokens || 0) > 0;
    }
    
    countAilmentStacks(cryptid) {
        if (!cryptid) return 0;
        let stacks = 0;
        if (cryptid.burnTurns > 0) stacks += cryptid.burnTurns;
        if (cryptid.bleedTurns > 0) stacks += cryptid.bleedTurns;
        if (cryptid.paralyzed || cryptid.paralyzeTurns > 0) stacks += 1;
        if (cryptid.calamityCounters > 0) stacks += cryptid.calamityCounters;
        if (cryptid.curseTokens > 0) stacks += cryptid.curseTokens;
        return stacks;
    }
    
    isInToxicTile(cryptid) {
        if (!cryptid) return false;
        const key = `${cryptid.owner}-${cryptid.col}-${cryptid.row}`;
        return this.state.toxicTiles.has(key);
    }
    
    // ==================== CORE GAME ACTIONS ====================
    
    /**
     * Summon a cryptid to the field
     */
    summon(owner, cardData, targetCol, targetRow) {
        const field = this.getField(owner);
        
        // Validate slot is empty
        if (field[targetCol][targetRow] !== null) {
            return { success: false, error: 'Slot occupied' };
        }
        
        // Create cryptid instance from card data
        const cryptid = this.createCryptidInstance(cardData, owner, targetCol, targetRow);
        
        // Place on field
        field[targetCol][targetRow] = cryptid;
        
        // Deduct pyre cost
        if (owner === 'player') {
            this.state.playerPyre -= cryptid.cost;
        } else {
            this.state.enemyPyre -= cryptid.cost;
        }
        
        // Initialize flags from card data
        if (cardData.initialFlags) {
            Object.assign(cryptid, cardData.initialFlags);
        }
        
        // Emit summon event
        this.emit('onSummon', { cryptid, owner, col: targetCol, row: targetRow });
        
        // Execute onSummon abilities
        this.executeTrigger(cryptid, Triggers.ON_SUMMON);
        
        // Check position-specific triggers
        const combatCol = this.getCombatCol(owner);
        if (targetCol === combatCol) {
            this.executeTrigger(cryptid, Triggers.ON_ENTER_COMBAT);
        } else {
            this.executeTrigger(cryptid, Triggers.ON_ENTER_SUPPORT);
        }
        
        // Process any deaths that occurred
        this.processDeathQueue();
        
        return { success: true, cryptid };
    }
    
    /**
     * Create a cryptid instance from card data
     */
    createCryptidInstance(cardData, owner, col, row) {
        const cryptid = {
            // Copy base stats
            ...cardData,
            
            // Instance-specific
            id: Date.now() + Math.random(),
            owner,
            col,
            row,
            
            // Current stats (mutable)
            currentHp: cardData.hp,
            currentAtk: cardData.atk,
            maxHp: cardData.hp,
            baseAtk: cardData.atk,
            
            // Combat state
            tapped: false,
            canAttack: true,
            
            // Ailment state
            burnTurns: 0,
            bleedTurns: 0,
            bleedStacks: 0,
            paralyzed: false,
            paralyzeTurns: 0,
            calamityCounters: 0,
            curseTokens: 0
        };
        
        // Copy intrinsic flags
        const intrinsicFlags = [
            'hasLifesteal', 'canTargetAny', 'ailmentImmune', 'hasDestroyer',
            'hasBurrowTargeting', 'bonusVsBurning', 'bonusVsParalyzed', 
            'bonusVsAilment', 'bonusVsToxic', 'stoneBastion', 'mythical',
            'hasKuchisakeExplosion', 'appliesAilmentAtkDebuff', 'negatesEnemySupport'
        ];
        
        for (const flag of intrinsicFlags) {
            if (cardData[flag] !== undefined) {
                cryptid[flag] = cardData[flag];
            }
        }
        
        return cryptid;
    }
    
    /**
     * Execute an attack
     */
    attack(attacker, targetOwner, targetCol, targetRow) {
        const target = this.getCryptidAt(targetOwner, targetCol, targetRow);
        if (!target) {
            return { success: false, error: 'No target' };
        }
        
        // Check if attack is valid
        if (attacker.tapped || !attacker.canAttack) {
            return { success: false, error: 'Cannot attack' };
        }
        
        // Emit attack declared (for traps)
        const attackEvent = {
            attacker,
            target,
            attackerOwner: attacker.owner,
            targetOwner,
            cancelled: false
        };
        
        this.emit('onAttackDeclared', attackEvent);
        
        // Check for trap triggers
        this.checkTraps('onAttackDeclared', attackEvent);
        
        if (attackEvent.cancelled) {
            return { success: true, cancelled: true };
        }
        
        // Execute onBeforeAttack abilities
        this.executeTrigger(attacker, Triggers.ON_BEFORE_ATTACK, { target });
        
        // Execute onBeforeDefend abilities
        this.executeTrigger(target, Triggers.ON_BEFORE_DEFEND, { attacker });
        
        // Check for damage negation
        if (target.negateIncomingAttack) {
            target.negateIncomingAttack = false;
            attacker.tapped = true;
            attacker.canAttack = false;
            this.emit('onAttackNegated', { attacker, target });
            return { success: true, negated: true };
        }
        
        // Calculate damage
        let damage = this.calculateAttackDamage(attacker, target);
        
        // Apply damage reduction from defender abilities
        const damageReduction = this.executor.context?.damageReduction || 0;
        damage = Math.max(0, damage - damageReduction);
        this.executor.context = {}; // Clear context
        
        // Stone Bastion: half damage
        if (target.stoneBastion && this.hasStatusAilment(attacker)) {
            damage = Math.floor(damage / 2);
            target.stoneBastion = false;
        }
        
        // Gremlin support protection
        const targetSupport = this.getSupport(target);
        if (target.hasGremlinSupport) {
            if (this.hasStatusAilment(attacker)) {
                damage = Math.floor(damage / 2);
            } else {
                damage = Math.max(0, damage - 1);
            }
        }
        
        // Deal damage
        const hpBefore = target.currentHp;
        target.currentHp -= damage;
        
        // Emit damage event
        this.emit('onDamageTaken', {
            target,
            damage,
            source: attacker,
            sourceType: 'attack',
            hpBefore,
            hpAfter: target.currentHp
        });
        
        // Execute onHit ability (attacker)
        this.executeTrigger(attacker, Triggers.ON_HIT, { target, damage });
        
        // Execute onDamaged ability (target)
        this.executeTrigger(target, Triggers.ON_DAMAGED, { attacker, damage });
        
        // Apply attack effects (burn, paralyze, etc.)
        this.applyAttackEffects(attacker, target);
        
        // Lifesteal
        if (attacker.hasLifesteal && damage > 0) {
            const maxHp = attacker.maxHp || attacker.hp;
            const healed = Math.min(damage, maxHp - attacker.currentHp);
            attacker.currentHp += healed;
            if (healed > 0) {
                this.emit('onHeal', { cryptid: attacker, amount: healed, source: 'lifesteal' });
            }
        }
        
        // Pyre on damage (Vampire Bat support)
        if (attacker.grantPyreOnDamage && damage > 0) {
            this.gainPyre(attacker.owner, 1, 'Vampire Bat');
        }
        
        // Check for death
        let killed = false;
        if (target.currentHp <= 0) {
            // Check for lethal save (Rooftop Gargoyle)
            if (target.hasRooftopGargoyleSupport && target.rooftopGargoyleSupport) {
                const gargoyle = target.rooftopGargoyleSupport;
                if (!gargoyle.gargoyleSaveUsed) {
                    gargoyle.gargoyleSaveUsed = true;
                    
                    if (this.hasStatusAilment(attacker)) {
                        target.currentHp = target.maxHp || target.hp;
                    } else {
                        target.currentHp = 1;
                    }
                    
                    this.emit('onGargoyleSave', { target, gargoyle, fullHeal: this.hasStatusAilment(attacker) });
                    killed = false;
                } else {
                    killed = true;
                }
            } else {
                killed = true;
            }
        }
        
        if (killed) {
            target.killedBy = 'attack';
            target.killedBySource = attacker;
            
            // Execute onKill ability
            this.executeTrigger(attacker, Triggers.ON_KILL, { victim: target });
            
            // Queue death
            this.queueDeath(target, 'attack', attacker);
        }
        
        // Tap attacker
        attacker.tapped = true;
        attacker.canAttack = false;
        
        // Process death queue
        this.processDeathQueue();
        
        return { success: true, damage, killed };
    }
    
    /**
     * Calculate attack damage including bonuses
     */
    calculateAttackDamage(attacker, target) {
        let damage = attacker.currentAtk || attacker.atk;
        
        // Bonus vs burning
        if ((target.burnTurns || 0) > 0) {
            damage += attacker.bonusVsBurning || 0;
            
            // Hellhound support bonus
            if (attacker.hellhoundSupport) {
                damage += 2;
            }
            
            // Vampire Lord support bonus
            if (attacker.vampireLordSupport) {
                damage += 2;
            }
        }
        
        // Bonus vs paralyzed
        if (target.paralyzed) {
            damage += attacker.bonusVsParalyzed || 0;
        }
        
        // Bonus vs any ailment
        if (this.hasStatusAilment(target)) {
            damage += attacker.bonusVsAilment || 0;
        }
        
        // Bonus vs toxic
        if (this.isInToxicTile(target)) {
            damage += attacker.bonusVsToxic || 0;
        }
        
        // Dynamic bonus (Redcap bloodlust)
        if (attacker.dynamicBonusDamage) {
            const bonus = this.calculateDynamicValue(attacker.dynamicBonusDamage, attacker);
            damage += bonus;
        }
        
        // Gremlin combat debuff to attacker
        if (attacker.gremlinAtkDebuff) {
            damage = Math.max(0, damage - attacker.gremlinAtkDebuff);
        }
        
        return damage;
    }
    
    /**
     * Apply effects that trigger on attack
     */
    applyAttackEffects(attacker, target) {
        // Attacks apply burn
        if (attacker.attacksApplyBurn) {
            this.applyBurn(target);
        }
        
        // Attacks apply paralyze
        if (attacker.attacksApplyParalyze) {
            this.applyParalyze(target);
        }
        
        // Attacks apply bleed
        if (attacker.attacksApplyBleed) {
            this.applyBleed(target);
        }
        
        // Burn attackers when damaged (Myling support)
        if (target.burnAttackersOnDamage) {
            this.applyBurn(attacker);
        }
    }
    
    /**
     * Rest a cryptid (tap without attacking)
     */
    rest(cryptid) {
        cryptid.tapped = true;
        cryptid.canAttack = false;
        
        // Sewer Alligator support: regen on rest
        const support = this.getSupport(cryptid);
        if (support?.hasSewerAlligatorSupport) {
            const maxHp = cryptid.maxHp || cryptid.hp;
            const healed = Math.min(2, maxHp - cryptid.currentHp);
            cryptid.currentHp += healed;
            if (healed > 0) {
                this.emit('onHeal', { cryptid, amount: healed, source: 'Sewer Alligator' });
            }
        }
        
        // Regeneration
        if (cryptid.regeneration > 0) {
            const maxHp = cryptid.maxHp || cryptid.hp;
            const healed = Math.min(cryptid.regeneration, maxHp - cryptid.currentHp);
            cryptid.currentHp += healed;
            if (healed > 0) {
                this.emit('onHeal', { cryptid, amount: healed, source: 'regeneration' });
            }
        }
        
        this.emit('onRest', { cryptid, owner: cryptid.owner });
    }
    
    // ==================== STATUS EFFECTS ====================
    
    applyBurn(target, stacks = 3) {
        if (!target) return false;
        
        // Check immunity
        if (target.ailmentImmune || target.hasMothmanAilmentImmunity) {
            this.emit('onAilmentBlocked', { target, ailment: 'burn' });
            
            // Boggart: gain ATK instead
            if (target.ailmentImmune && target.key === 'boggart') {
                target.currentAtk = (target.currentAtk || target.atk) + 1;
                target.tempAtkBonus = (target.tempAtkBonus || 0) + 1;
            }
            
            return false;
        }
        
        target.burnTurns = Math.max(target.burnTurns || 0, stacks);
        this.emit('onStatusApplied', { cryptid: target, status: 'burn', stacks, owner: target.owner });
        return true;
    }
    
    applyBleed(target, stacks = 2) {
        if (!target) return false;
        
        if (target.ailmentImmune || target.hasMothmanAilmentImmunity) {
            this.emit('onAilmentBlocked', { target, ailment: 'bleed' });
            return false;
        }
        
        target.bleedTurns = (target.bleedTurns || 0) + stacks;
        target.bleedStacks = (target.bleedStacks || 0) + 1;
        this.emit('onStatusApplied', { cryptid: target, status: 'bleed', stacks, owner: target.owner });
        return true;
    }
    
    applyParalyze(target) {
        if (!target) return false;
        
        if (target.ailmentImmune || target.hasMothmanAilmentImmunity) {
            this.emit('onAilmentBlocked', { target, ailment: 'paralyze' });
            return false;
        }
        
        target.paralyzed = true;
        target.paralyzeTurns = 1;
        this.emit('onStatusApplied', { cryptid: target, status: 'paralyze', owner: target.owner });
        return true;
    }
    
    applyCalamity(target, stacks = 1) {
        if (!target) return false;
        
        if (target.ailmentImmune || target.hasMothmanAilmentImmunity) {
            this.emit('onAilmentBlocked', { target, ailment: 'calamity' });
            return false;
        }
        
        target.calamityCounters = (target.calamityCounters || 0) + stacks;
        this.emit('onStatusApplied', { cryptid: target, status: 'calamity', stacks, owner: target.owner });
        return true;
    }
    
    applyCurse(target, stacks = 1) {
        if (!target) return false;
        
        if (target.ailmentImmune || target.hasMothmanAilmentImmunity) {
            this.emit('onAilmentBlocked', { target, ailment: 'curse' });
            return false;
        }
        
        target.curseTokens = (target.curseTokens || 0) + stacks;
        this.emit('onStatusApplied', { cryptid: target, status: 'curse', stacks, owner: target.owner });
        return true;
    }
    
    cleanse(target) {
        if (!target) return 0;
        
        let cleansed = 0;
        if (target.burnTurns > 0) { target.burnTurns = 0; cleansed++; }
        if (target.bleedTurns > 0) { target.bleedTurns = 0; target.bleedStacks = 0; cleansed++; }
        if (target.paralyzed || target.paralyzeTurns > 0) { 
            target.paralyzed = false; 
            target.paralyzeTurns = 0; 
            cleansed++; 
        }
        if (target.calamityCounters > 0) { target.calamityCounters = 0; cleansed++; }
        if (target.curseTokens > 0) { target.curseTokens = 0; cleansed++; }
        
        if (cleansed > 0) {
            this.emit('onCleanse', { cryptid: target, count: cleansed, owner: target.owner });
        }
        
        return cleansed;
    }
    
    applyToxic(owner, col, row) {
        const key = `${owner}-${col}-${row}`;
        this.state.toxicTiles.add(key);
        this.emit('onToxicApplied', { owner, col, row });
    }
    
    // ==================== RESOURCES ====================
    
    gainPyre(owner, amount, source = 'ability') {
        if (amount <= 0) return;
        
        if (owner === 'player') {
            this.state.playerPyre += amount;
        } else {
            this.state.enemyPyre += amount;
        }
        
        this.emit('onPyreGained', { owner, amount, source });
    }
    
    drawCards(owner, count = 1) {
        const deck = owner === 'player' ? this.state.playerDeck : this.state.enemyDeck;
        const hand = owner === 'player' ? this.state.playerHand : this.state.enemyHand;
        
        let drawn = 0;
        for (let i = 0; i < count; i++) {
            if (deck.length === 0) break;
            if (hand.length >= 10) break; // Max hand size
            
            const card = deck.shift();
            hand.push(card);
            drawn++;
            
            this.emit('onCardDrawn', { owner, card });
        }
        
        return drawn;
    }
    
    // ==================== DEATH HANDLING ====================
    
    queueDeath(cryptid, killedBy, killedBySource = null) {
        if (!cryptid) return;
        
        cryptid.killedBy = killedBy;
        cryptid.killedBySource = killedBySource;
        
        this.deathQueue.push({
            cryptid,
            owner: cryptid.owner,
            col: cryptid.col,
            row: cryptid.row,
            killedBy,
            killedBySource
        });
    }
    
    processDeathQueue() {
        while (this.deathQueue.length > 0) {
            const death = this.deathQueue.shift();
            this.processDeath(death);
        }
        
        // Process promotions after all deaths
        this.processPromotionQueue();
    }
    
    processDeath(death) {
        const { cryptid, owner, col, row, killedBy, killedBySource } = death;
        
        // Execute onDeath abilities (may prevent death)
        this.executeTrigger(cryptid, Triggers.ON_DEATH, { killedBy, killedBySource });
        
        // Check if death was prevented
        if (cryptid.preventDeath) {
            cryptid.preventDeath = false;
            return;
        }
        
        // Remove from field
        const field = this.getField(owner);
        if (field[col][row] === cryptid) {
            field[col][row] = null;
        }
        
        // Update death counter
        if (owner === 'player') {
            this.state.playerDeaths++;
            this.state.deathsThisTurn.player++;
        } else {
            this.state.enemyDeaths++;
            this.state.deathsThisTurn.enemy++;
        }
        
        // Emit death event
        this.emit('onDeath', {
            cryptid,
            owner,
            col,
            row,
            killedBy,
            killedBySource
        });
        
        // Trigger onAllyDeath for allies
        const allies = this.getAllCryptids(owner);
        for (const ally of allies) {
            if (ally !== cryptid) {
                this.executeTrigger(ally, Triggers.ON_ALLY_DEATH, { victim: cryptid });
            }
        }
        
        // Trigger onEnemyDeath for enemies
        const enemyOwner = owner === 'player' ? 'enemy' : 'player';
        const enemies = this.getAllCryptids(enemyOwner);
        for (const enemy of enemies) {
            this.executeTrigger(enemy, Triggers.ON_ENEMY_DEATH, { victim: cryptid });
        }
        
        // Check for trap triggers
        this.checkTraps('onDeath', {
            cryptid,
            owner,
            killedBy,
            killedBySource
        });
        
        // Queue promotion if combatant died
        const combatCol = this.getCombatCol(owner);
        if (col === combatCol) {
            const supportCol = this.getSupportCol(owner);
            const support = this.getCryptidAt(owner, supportCol, row);
            if (support) {
                this.promotionQueue.push({ owner, row, support });
            }
        }
        
        // Check win condition
        this.checkWinCondition();
    }
    
    processPromotionQueue() {
        while (this.promotionQueue.length > 0) {
            const { owner, row, support } = this.promotionQueue.shift();
            this.promoteSupport(owner, row, support);
        }
    }
    
    promoteSupport(owner, row, support) {
        if (!support) return false;
        
        const field = this.getField(owner);
        const supportCol = this.getSupportCol(owner);
        const combatCol = this.getCombatCol(owner);
        
        // Verify support is still there
        if (field[supportCol][row] !== support) return false;
        
        // Execute onLeavingSupport
        this.executeTrigger(support, Triggers.ON_LEAVING_SUPPORT);
        
        // Move to combat
        field[supportCol][row] = null;
        field[combatCol][row] = support;
        support.col = combatCol;
        
        // Emit promotion event
        this.emit('onPromotion', { cryptid: support, owner, row });
        
        // Execute onPromoted / onEnterCombat
        this.executeTrigger(support, Triggers.ON_PROMOTED);
        this.executeTrigger(support, Triggers.ON_ENTER_COMBAT);
        
        return true;
    }
    
    // ==================== TURN HANDLING ====================
    
    startTurn(owner) {
        this.state.currentTurn = owner;
        
        // Reset death tracking
        const enemyOwner = owner === 'player' ? 'enemy' : 'player';
        this.state.deathsLastEnemyTurn[owner] = this.state.deathsThisTurn[enemyOwner];
        this.state.deathsThisTurn = { player: 0, enemy: 0 };
        
        // Untap all cryptids
        const cryptids = this.getAllCryptids(owner);
        for (const cryptid of cryptids) {
            cryptid.tapped = false;
            cryptid.canAttack = true;
            
            // Clear paralysis
            if (cryptid.paralyzed) {
                cryptid.paralyzeTurns = Math.max(0, (cryptid.paralyzeTurns || 1) - 1);
                if (cryptid.paralyzeTurns <= 0) {
                    cryptid.paralyzed = false;
                }
            }
        }
        
        // Execute turn start triggers
        for (const cryptid of cryptids) {
            this.executeTrigger(cryptid, Triggers.ON_TURN_START);
            this.executeTrigger(cryptid, Triggers.ON_MY_TURN_START);
        }
        
        // Also trigger for enemy cryptids (onTurnStart, not onMyTurnStart)
        const enemyCryptids = this.getAllCryptids(enemyOwner);
        for (const cryptid of enemyCryptids) {
            this.executeTrigger(cryptid, Triggers.ON_TURN_START);
        }
        
        this.emit('onTurnStart', { owner });
        
        // Process any deaths
        this.processDeathQueue();
    }
    
    endTurn(owner) {
        // Process burn damage
        const cryptids = this.getAllCryptids(owner);
        for (const cryptid of cryptids) {
            if (cryptid.burnTurns > 0) {
                const damage = cryptid.burnTurns;
                cryptid.currentHp -= damage;
                cryptid.burnTurns--;
                
                this.emit('onBurnDamage', { cryptid, damage, owner });
                
                if (cryptid.currentHp <= 0) {
                    this.queueDeath(cryptid, 'burn');
                }
            }
            
            if (cryptid.bleedTurns > 0) {
                const damage = cryptid.bleedStacks || 1;
                cryptid.currentHp -= damage;
                cryptid.bleedTurns--;
                
                this.emit('onBleedDamage', { cryptid, damage, owner });
                
                if (cryptid.currentHp <= 0) {
                    this.queueDeath(cryptid, 'bleed');
                }
            }
        }
        
        // Execute turn end triggers
        for (const cryptid of this.getAllCryptids(owner)) {
            this.executeTrigger(cryptid, Triggers.ON_TURN_END);
            this.executeTrigger(cryptid, Triggers.ON_MY_TURN_END);
        }
        
        // Process deaths
        this.processDeathQueue();
        
        this.emit('onTurnEnd', { owner });
        
        // Increment turn number
        if (owner === 'enemy') {
            this.state.turnNumber++;
        }
    }
    
    // ==================== TRAP HANDLING ====================
    
    checkTraps(event, eventData) {
        const trapOwner = eventData.owner || (eventData.target?.owner);
        if (!trapOwner) return;
        
        const traps = trapOwner === 'player' ? this.state.playerTraps : this.state.enemyTraps;
        
        for (let row = 0; row < 3; row++) {
            const trap = traps[row];
            if (!trap) continue;
            if (trap.triggerEvent !== event) continue;
            
            // Check condition
            if (this.checkTrapCondition(trap, trapOwner, eventData)) {
                this.triggerTrap(trap, trapOwner, row, eventData);
                traps[row] = null; // Remove used trap
            }
        }
    }
    
    checkTrapCondition(trap, owner, eventData) {
        const condition = trap.triggerCondition;
        if (!condition) return true;
        
        switch (condition.type) {
            case 'lethalAttack':
                if (eventData.attackerOwner === owner) return false;
                const target = eventData.target;
                if (!target || target.owner !== owner) return false;
                const damage = this.calculateAttackDamage(eventData.attacker, target);
                return target.currentHp <= damage;
                
            case 'deathByEnemyAttack':
                if (eventData.owner !== owner) return false;
                const killer = eventData.killedBySource;
                return killer && killer.owner !== owner;
                
            case 'targetedForAttack':
                return eventData.attackerOwner !== owner && 
                       eventData.target?.owner === owner;
                
            default:
                return true;
        }
    }
    
    triggerTrap(trap, owner, row, eventData) {
        this.emit('onTrapTriggered', { trap, owner, row, eventData });
        
        // Execute trap effects using ability executor
        this.executor.context = {
            self: trap,
            owner,
            eventData,
            attacker: eventData.attacker,
            target: eventData.target,
            killerCryptid: eventData.killedBySource
        };
        
        for (const effect of trap.effects || []) {
            this.executeEffect(effect);
        }
    }
    
    // ==================== ABILITY EXECUTION ====================
    
    executeTrigger(cryptid, trigger, eventData = {}) {
        if (!cryptid?.abilities) return [];
        
        return this.executor.executeTrigger(cryptid, trigger, eventData);
    }
    
    executeEffect(effect) {
        // Resolve target
        const targets = this.executor.resolveTarget(effect.target);
        
        for (const target of targets) {
            this.executor.executeEffect(effect, target);
        }
    }
    
    calculateDynamicValue(calc, context) {
        if (typeof calc === 'number') return calc;
        
        switch (calc.calc) {
            case 'ailmentedEnemyCount':
                const enemyOwner = context.owner === 'player' ? 'enemy' : 'player';
                return this.getAllCryptids(enemyOwner).filter(c => this.hasStatusAilment(c)).length;
                
            case 'vampireCount':
                return this.getAllCryptids(context.owner).filter(c => 
                    c.name?.toLowerCase().includes('vampire')
                ).length;
                
            case 'gargoyleCount':
                return this.getAllCryptids(context.owner).filter(c => 
                    c.name?.toLowerCase().includes('gargoyle')
                ).length;
                
            default:
                return 0;
        }
    }
    
    // ==================== WIN CONDITION ====================
    
    checkWinCondition() {
        // Win when opponent has 10 deaths
        if (this.state.playerDeaths >= 10) {
            this.state.gameOver = true;
            this.state.winner = 'enemy';
            this.emit('onGameOver', { winner: 'enemy', reason: 'deaths' });
        } else if (this.state.enemyDeaths >= 10) {
            this.state.gameOver = true;
            this.state.winner = 'player';
            this.emit('onGameOver', { winner: 'player', reason: 'deaths' });
        }
    }
    
    // ==================== EVENT SYSTEM ====================
    
    on(event, callback) {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }
        this.eventListeners[event].push(callback);
        
        return () => {
            this.eventListeners[event] = this.eventListeners[event].filter(cb => cb !== callback);
        };
    }
    
    emit(event, data) {
        const listeners = this.eventListeners[event] || [];
        for (const callback of listeners) {
            callback(data);
        }
        
        // Also store in executor event queue for replay
        this.executor.eventQueue.push({ type: event, data, timestamp: Date.now() });
    }
    
    // ==================== STATE SERIALIZATION ====================
    
    getState() {
        return JSON.parse(JSON.stringify(this.state, (key, value) => {
            // Handle Set serialization
            if (value instanceof Set) {
                return { _type: 'Set', values: [...value] };
            }
            // Skip function properties
            if (typeof value === 'function') {
                return undefined;
            }
            return value;
        }));
    }
    
    setState(state) {
        this.state = JSON.parse(JSON.stringify(state, (key, value) => {
            // Handle Set deserialization
            if (value && value._type === 'Set') {
                return new Set(value.values);
            }
            return value;
        }));
        this.executor.state = this.state;
    }
    
    // ==================== VALIDATION ====================
    
    validateAction(action, playerId) {
        const owner = playerId === 'player' ? 'player' : 'enemy';
        
        // Must be your turn
        if (this.state.currentTurn !== owner) {
            return { valid: false, error: 'Not your turn' };
        }
        
        switch (action.type) {
            case 'summon':
                return this.validateSummon(owner, action);
            case 'attack':
                return this.validateAttack(owner, action);
            case 'rest':
                return this.validateRest(owner, action);
            case 'playCard':
                return this.validatePlayCard(owner, action);
            case 'endTurn':
                return { valid: true };
            default:
                return { valid: false, error: 'Unknown action type' };
        }
    }
    
    validateSummon(owner, action) {
        const { cardIndex, col, row } = action;
        const hand = owner === 'player' ? this.state.playerHand : this.state.enemyHand;
        const pyre = owner === 'player' ? this.state.playerPyre : this.state.enemyPyre;
        
        if (cardIndex < 0 || cardIndex >= hand.length) {
            return { valid: false, error: 'Invalid card index' };
        }
        
        const card = hand[cardIndex];
        if (card.type !== 'cryptid') {
            return { valid: false, error: 'Card is not a cryptid' };
        }
        
        if (card.cost > pyre) {
            return { valid: false, error: 'Not enough pyre' };
        }
        
        const field = this.getField(owner);
        if (field[col][row] !== null) {
            return { valid: false, error: 'Slot occupied' };
        }
        
        return { valid: true };
    }
    
    validateAttack(owner, action) {
        const { attackerCol, attackerRow, targetCol, targetRow } = action;
        
        const attacker = this.getCryptidAt(owner, attackerCol, attackerRow);
        if (!attacker) {
            return { valid: false, error: 'No attacker at position' };
        }
        
        if (attacker.tapped || !attacker.canAttack) {
            return { valid: false, error: 'Attacker cannot attack' };
        }
        
        const targetOwner = owner === 'player' ? 'enemy' : 'player';
        const target = this.getCryptidAt(targetOwner, targetCol, targetRow);
        if (!target) {
            return { valid: false, error: 'No target at position' };
        }
        
        // Check targeting restrictions (burrow, flight, etc.)
        if (!this.canTarget(attacker, target)) {
            return { valid: false, error: 'Cannot target that cryptid' };
        }
        
        return { valid: true };
    }
    
    canTarget(attacker, target) {
        // Flight: can target anyone
        if (attacker.canTargetAny) return true;
        
        // Burrow: only same-row combatant or any support
        if (attacker.hasBurrowTargeting) {
            const targetCombatCol = this.getCombatCol(target.owner);
            if (target.col === targetCombatCol) {
                return target.row === attacker.row;
            }
            return true; // Can always target supports
        }
        
        // Default: can only target enemy combatant in same row
        const targetCombatCol = this.getCombatCol(target.owner);
        return target.col === targetCombatCol && target.row === attacker.row;
    }
    
    validateRest(owner, action) {
        const { col, row } = action;
        
        const cryptid = this.getCryptidAt(owner, col, row);
        if (!cryptid) {
            return { valid: false, error: 'No cryptid at position' };
        }
        
        if (cryptid.tapped) {
            return { valid: false, error: 'Already rested' };
        }
        
        return { valid: true };
    }
    
    validatePlayCard(owner, action) {
        const { cardIndex } = action;
        const hand = owner === 'player' ? this.state.playerHand : this.state.enemyHand;
        const pyre = owner === 'player' ? this.state.playerPyre : this.state.enemyPyre;
        
        if (cardIndex < 0 || cardIndex >= hand.length) {
            return { valid: false, error: 'Invalid card index' };
        }
        
        const card = hand[cardIndex];
        if (card.cost > pyre) {
            return { valid: false, error: 'Not enough pyre' };
        }
        
        return { valid: true };
    }
}

// ==================== BROWSER GLOBAL ====================
window.SharedGameEngine = SharedGameEngine;
window.Triggers = Triggers;
window.EffectTypes = EffectTypes;
window.TargetTypes = TargetTypes;
window.ConditionTypes = ConditionTypes;
window.CalcTypes = CalcTypes;
window.Flags = Flags;

console.log('[SharedGameEngine v2] Loaded successfully');

