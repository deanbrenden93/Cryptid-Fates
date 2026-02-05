/**
 * Cryptid Fates - Shared Trap System
 * 
 * Isomorphic trap handling that runs identically on
 * both client (browser) and server (Cloudflare Worker).
 * 
 * This module contains:
 * - Trap setup and activation
 * - Trigger condition checking
 * - Trap effect application
 * 
 * Returns "trap intents" - declarative descriptions of triggered traps,
 * so the client can play animations and the server can validate/broadcast.
 */

/**
 * Create a trap system instance
 * @param {Object} options - Configuration options
 * @param {Object} options.gameState - GameState instance
 * @param {Object} options.events - Event system instance
 * @param {boolean} options.debug - Enable debug logging
 * @param {Function} options.logger - Custom logging function
 * @returns {Object} TrapSystem instance
 */
function createTrapSystem(options = {}) {
    const debug = options.debug || false;
    const logger = options.logger || console.log;
    
    let gameState = options.gameState;
    let events = options.events;
    
    function log(...args) {
        if (debug) logger('[TrapSystem]', ...args);
    }
    
    /**
     * Set the game state instance
     * @param {Object} gs - GameState instance
     */
    function setGameState(gs) {
        gameState = gs;
    }
    
    /**
     * Set the events instance
     * @param {Object} ev - Events instance
     */
    function setEvents(ev) {
        events = ev;
    }
    
    /**
     * Set up trap listeners for a spell card
     * @param {Object} card - Trap spell card
     * @param {string} owner - Owner of the trap ('player' or 'enemy')
     * @returns {Object} Trap setup result
     */
    function setupTrap(card, owner) {
        if (!card || !card.effects) {
            return { success: false, reason: 'INVALID_TRAP' };
        }
        
        // Find trigger effect
        const triggerEffect = card.effects.find(e => e.trigger && e.trigger !== 'onCast');
        if (!triggerEffect) {
            return { success: false, reason: 'NO_TRIGGER' };
        }
        
        const trapData = {
            id: card.id || `trap-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            cardId: card.id,
            name: card.name,
            owner,
            trigger: triggerEffect.trigger,
            condition: triggerEffect.condition,
            effects: card.effects.filter(e => e.trigger !== 'onCast'),
            destroyed: false,
            chargesRemaining: triggerEffect.charges || 1,
            maxCharges: triggerEffect.charges || 1
        };
        
        // Add to game state traps
        if (gameState && gameState.state) {
            if (!gameState.state.traps) {
                gameState.state.traps = { player: [], enemy: [] };
            }
            gameState.state.traps[owner].push(trapData);
        }
        
        log('Trap setup:', trapData.name, 'trigger:', trapData.trigger);
        
        return {
            success: true,
            trap: trapData
        };
    }
    
    /**
     * Check if a trap's condition is met
     * @param {Object} trap - Trap data
     * @param {Object} context - Trigger context
     * @returns {boolean} True if condition is met
     */
    function checkTrapCondition(trap, context) {
        if (!trap.condition) return true;
        
        const { condition } = trap;
        const { cryptid, source } = context;
        
        // Check target filter
        if (condition.targetFilter) {
            const filter = condition.targetFilter;
            
            // Enemy check
            if (filter.enemy !== undefined) {
                const isEnemy = cryptid?.owner !== trap.owner;
                if (filter.enemy !== isEnemy) return false;
            }
            
            // Ally check
            if (filter.ally !== undefined) {
                const isAlly = cryptid?.owner === trap.owner;
                if (filter.ally !== isAlly) return false;
            }
            
            // Type check
            if (filter.type && cryptid?.type !== filter.type) return false;
            
            // Element check
            if (filter.element && cryptid?.element !== filter.element) return false;
            
            // HP check
            if (filter.currentHpBelow && cryptid?.currentHp >= filter.currentHpBelow) return false;
            if (filter.currentHpAbove && cryptid?.currentHp <= filter.currentHpAbove) return false;
            
            // Position check
            if (filter.inCombat !== undefined) {
                const inCombat = gameState?.isInCombat(cryptid);
                if (filter.inCombat !== inCombat) return false;
            }
        }
        
        // Check minimum amount (for damage triggers)
        if (condition.minDamage && context.damage < condition.minDamage) return false;
        
        // Check source requirements
        if (condition.sourceFilter && source) {
            const filter = condition.sourceFilter;
            
            if (filter.enemy !== undefined) {
                const isEnemy = source.owner !== trap.owner;
                if (filter.enemy !== isEnemy) return false;
            }
            
            if (filter.type && source.type !== filter.type) return false;
        }
        
        return true;
    }
    
    /**
     * Check all traps for a specific trigger
     * @param {string} triggerType - Type of trigger (e.g., 'onSummon', 'onDeath', 'onDamage')
     * @param {Object} context - Trigger context
     * @returns {Array} Array of triggered trap results
     */
    function checkTraps(triggerType, context) {
        if (!gameState?.state?.traps) return [];
        
        const results = [];
        const allTraps = [
            ...gameState.state.traps.player,
            ...gameState.state.traps.enemy
        ];
        
        for (const trap of allTraps) {
            if (trap.destroyed) continue;
            if (trap.trigger !== triggerType) continue;
            
            if (checkTrapCondition(trap, context)) {
                results.push({
                    trap,
                    context,
                    effects: trap.effects
                });
                
                log('Trap triggered:', trap.name, 'by', triggerType);
                
                // Reduce charges
                trap.chargesRemaining--;
                if (trap.chargesRemaining <= 0) {
                    trap.destroyed = true;
                    log('Trap destroyed (charges depleted):', trap.name);
                }
            }
        }
        
        return results;
    }
    
    /**
     * Destroy a specific trap
     * @param {Object} trap - Trap to destroy
     * @param {string} reason - Reason for destruction
     * @returns {Object} Destruction result
     */
    function destroyTrap(trap, reason = 'effect') {
        if (!trap || trap.destroyed) {
            return { success: false, reason: 'TRAP_NOT_FOUND_OR_DESTROYED' };
        }
        
        trap.destroyed = true;
        
        // Remove from state
        if (gameState?.state?.traps?.[trap.owner]) {
            const index = gameState.state.traps[trap.owner].findIndex(t => t.id === trap.id);
            if (index !== -1) {
                gameState.state.traps[trap.owner].splice(index, 1);
            }
        }
        
        log('Trap destroyed:', trap.name, 'reason:', reason);
        
        if (events) {
            events.emit('TRAP_DESTROYED', { trap, reason });
        }
        
        return {
            success: true,
            trap,
            reason
        };
    }
    
    /**
     * Get all active traps for an owner
     * @param {string} owner - Owner ('player' or 'enemy')
     * @returns {Array} Active traps
     */
    function getActiveTraps(owner) {
        if (!gameState?.state?.traps?.[owner]) return [];
        return gameState.state.traps[owner].filter(t => !t.destroyed);
    }
    
    /**
     * Get all active traps
     * @returns {Object} All traps by owner
     */
    function getAllActiveTraps() {
        return {
            player: getActiveTraps('player'),
            enemy: getActiveTraps('enemy')
        };
    }
    
    /**
     * Clear all traps for a specific owner or all
     * @param {string} [owner] - Optional owner to clear (clears all if not specified)
     */
    function clearTraps(owner) {
        if (!gameState?.state?.traps) return;
        
        if (owner) {
            gameState.state.traps[owner] = [];
        } else {
            gameState.state.traps = { player: [], enemy: [] };
        }
        
        log('Traps cleared for:', owner || 'all');
    }
    
    /**
     * Process triggered traps - returns intent array
     * @param {Array} triggeredTraps - Array from checkTraps
     * @param {Object} effectResolver - Effect resolver instance for processing effects
     * @returns {Array} Array of effect intents to apply
     */
    function processTrapEffects(triggeredTraps, effectResolver) {
        const allIntents = [];
        
        for (const triggered of triggeredTraps) {
            const { trap, context, effects } = triggered;
            
            if (events) {
                events.emit('TRAP_TRIGGERED', { trap, context });
            }
            
            // Process each effect in the trap
            for (const effect of effects) {
                if (effectResolver) {
                    const intents = effectResolver.processEffect(effect, {
                        source: { type: 'trap', trap },
                        ...context
                    });
                    allIntents.push(...intents);
                }
            }
        }
        
        return allIntents;
    }
    
    /**
     * Export traps state for serialization
     * @returns {Object} Serializable trap state
     */
    function exportTraps() {
        if (!gameState?.state?.traps) return { player: [], enemy: [] };
        
        return {
            player: gameState.state.traps.player.map(t => ({
                ...t,
                effects: t.effects // Effects are already pure data
            })),
            enemy: gameState.state.traps.enemy.map(t => ({
                ...t,
                effects: t.effects
            }))
        };
    }
    
    /**
     * Import traps state from serialized data
     * @param {Object} trapData - Serialized trap data
     */
    function importTraps(trapData) {
        if (!gameState?.state) return;
        
        gameState.state.traps = {
            player: trapData?.player || [],
            enemy: trapData?.enemy || []
        };
        
        log('Traps imported:', {
            player: gameState.state.traps.player.length,
            enemy: gameState.state.traps.enemy.length
        });
    }
    
    // ==================== PUBLIC API ====================
    
    return {
        setGameState,
        setEvents,
        setupTrap,
        checkTrapCondition,
        checkTraps,
        destroyTrap,
        getActiveTraps,
        getAllActiveTraps,
        clearTraps,
        processTrapEffects,
        exportTraps,
        importTraps
    };
}

// ==================== EXPORTS ====================

// CommonJS export (for Node.js / Cloudflare Worker)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        createTrapSystem
    };
}

// Browser global export
if (typeof window !== 'undefined') {
    window.SharedTrapSystem = {
        createTrapSystem
    };
}
