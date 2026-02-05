/**
 * Cryptid Fates - Shared Event System
 * 
 * Isomorphic pub/sub event emitter that works identically on
 * both client (browser) and server (Cloudflare Worker).
 * 
 * This is the foundation for all game event communication:
 * - Card triggers (onSummon, onDeath, onAttack, etc.)
 * - State changes (onTurnStart, onPhaseChange)
 * - Effect resolution (onEffectAboutToResolve, onEffectResolved)
 */

/**
 * Create a new GameEvents instance
 * @param {Object} options - Configuration options
 * @param {boolean} options.debug - Enable debug logging (default: false)
 * @param {Function} options.logger - Custom logging function (default: console.log)
 * @returns {Object} GameEvents instance
 */
function createGameEvents(options = {}) {
    const debug = options.debug || false;
    const logger = options.logger || console.log;
    
    const instance = {
        listeners: {},
        
        /**
         * Subscribe to an event
         * @param {string} event - Event name
         * @param {Function} callback - Handler function
         * @param {Object} context - Optional 'this' context for callback
         * @returns {Function} Unsubscribe function
         */
        on(event, callback, context = null) {
            if (!this.listeners[event]) {
                this.listeners[event] = [];
            }
            const listener = { callback, context };
            this.listeners[event].push(listener);
            
            if (debug) {
                logger(`[GameEvents] Subscribed to '${event}', total listeners: ${this.listeners[event].length}`);
            }
            
            // Return unsubscribe function
            return () => {
                if (!this.listeners[event]) return;
                const idx = this.listeners[event].indexOf(listener);
                if (idx > -1) {
                    this.listeners[event].splice(idx, 1);
                    if (debug) {
                        logger(`[GameEvents] Unsubscribed from '${event}', remaining: ${this.listeners[event].length}`);
                    }
                }
            };
        },
        
        /**
         * Subscribe to an event, but only fire once
         * @param {string} event - Event name
         * @param {Function} callback - Handler function
         * @returns {Function} Unsubscribe function (in case you need to cancel before it fires)
         */
        once(event, callback) {
            const unsubscribe = this.on(event, (...args) => {
                unsubscribe();
                callback(...args);
            });
            return unsubscribe;
        },
        
        /**
         * Emit an event to all subscribers
         * @param {string} event - Event name
         * @param {Object} data - Event data payload
         * @returns {Array} Array of listener results (for chaining/inspection)
         */
        emit(event, data = {}) {
            if (debug) {
                logger(`[GameEvents] Emitting '${event}'`, data);
            }
            
            if (!this.listeners[event]) {
                return [];
            }
            
            // Enrich event data with metadata
            const eventData = {
                ...data,
                eventName: event,
                timestamp: Date.now()
            };
            
            const results = [];
            
            // Create a copy of listeners array to avoid issues if
            // a listener unsubscribes during iteration
            const listenersCopy = [...this.listeners[event]];
            
            for (const listener of listenersCopy) {
                try {
                    let result;
                    if (listener.context) {
                        result = listener.callback.call(listener.context, eventData);
                    } else {
                        result = listener.callback(eventData);
                    }
                    results.push(result);
                } catch (error) {
                    logger(`[GameEvents] Error in listener for '${event}':`, error);
                    results.push({ error });
                }
            }
            
            return results;
        },
        
        /**
         * Emit an event and wait for all async listeners to complete
         * @param {string} event - Event name
         * @param {Object} data - Event data payload
         * @returns {Promise<Array>} Promise resolving to array of listener results
         */
        async emitAsync(event, data = {}) {
            if (debug) {
                logger(`[GameEvents] Emitting async '${event}'`, data);
            }
            
            if (!this.listeners[event]) {
                return [];
            }
            
            const eventData = {
                ...data,
                eventName: event,
                timestamp: Date.now()
            };
            
            const listenersCopy = [...this.listeners[event]];
            const promises = [];
            
            for (const listener of listenersCopy) {
                try {
                    let result;
                    if (listener.context) {
                        result = listener.callback.call(listener.context, eventData);
                    } else {
                        result = listener.callback(eventData);
                    }
                    // Wrap in Promise.resolve to handle both sync and async
                    promises.push(Promise.resolve(result));
                } catch (error) {
                    logger(`[GameEvents] Error in async listener for '${event}':`, error);
                    promises.push(Promise.resolve({ error }));
                }
            }
            
            return Promise.all(promises);
        },
        
        /**
         * Remove listeners
         * @param {string|null} event - Event name, or null to clear all
         */
        off(event = null) {
            if (event) {
                if (debug && this.listeners[event]) {
                    logger(`[GameEvents] Removed all listeners for '${event}'`);
                }
                delete this.listeners[event];
            } else {
                if (debug) {
                    logger('[GameEvents] Cleared all listeners');
                }
                this.listeners = {};
            }
        },
        
        /**
         * Get the number of listeners for an event
         * @param {string} event - Event name
         * @returns {number} Number of listeners
         */
        listenerCount(event) {
            return this.listeners[event]?.length || 0;
        },
        
        /**
         * Check if an event has any listeners
         * @param {string} event - Event name
         * @returns {boolean} True if event has listeners
         */
        hasListeners(event) {
            return this.listenerCount(event) > 0;
        },
        
        /**
         * Get all registered event names
         * @returns {string[]} Array of event names
         */
        eventNames() {
            return Object.keys(this.listeners);
        },
        
        /**
         * Create a namespaced event emitter (for component isolation)
         * @param {string} namespace - Prefix for all events
         * @returns {Object} Namespaced event emitter
         */
        namespace(namespace) {
            const parent = this;
            return {
                on: (event, callback, context) => parent.on(`${namespace}:${event}`, callback, context),
                once: (event, callback) => parent.once(`${namespace}:${event}`, callback),
                emit: (event, data) => parent.emit(`${namespace}:${event}`, data),
                emitAsync: (event, data) => parent.emitAsync(`${namespace}:${event}`, data),
                off: (event) => parent.off(event ? `${namespace}:${event}` : null),
                listenerCount: (event) => parent.listenerCount(`${namespace}:${event}`)
            };
        },
        
        /**
         * Enable or disable debug mode
         * @param {boolean} enabled - Whether to enable debug logging
         */
        setDebug(enabled) {
            // Note: This modifies the closure, so it persists
            options.debug = enabled;
        }
    };
    
    return instance;
}

// ==================== STANDARD GAME EVENTS ====================
// These are the canonical event names used throughout the game.
// Define them here for consistency between client and server.

const GameEventTypes = {
    // Summon/Position Events
    ON_SUMMON: 'onSummon',
    ON_ENTER_COMBAT: 'onEnterCombat',
    ON_ENTER_SUPPORT: 'onEnterSupport',
    ON_LEAVE_COMBAT: 'onLeaveCombat',
    ON_LEAVE_SUPPORT: 'onLeaveSupport',
    ON_LEAVING_SUPPORT: 'onLeavingSupport',  // Alias for consistency
    ON_PROMOTION: 'onPromotion',
    
    // Combat Events
    ON_ATTACK: 'onAttack',
    ON_COMBAT_ATTACK: 'onCombatAttack',
    ON_BEFORE_ATTACK: 'onBeforeAttack',
    ON_BEFORE_DEFEND: 'onBeforeDefend',
    ON_ATTACK_DECLARED: 'onAttackDeclared',
    ON_DAMAGE_DEALT: 'onDamageDealt',
    ON_DAMAGE_TAKEN: 'onDamageTaken',
    ON_KILL: 'onKill',
    
    // Death Events
    ON_DEATH: 'onDeath',
    ON_ALLY_DEATH: 'onAllyDeath',
    ON_ENEMY_DEATH: 'onEnemyDeath',
    ON_ANY_DEATH: 'onAnyDeath',
    
    // Turn Events
    ON_TURN_START: 'onTurnStart',
    ON_TURN_END: 'onTurnEnd',
    ON_PHASE_CHANGE: 'onPhaseChange',
    
    // Resource Events
    ON_PYRE_GAINED: 'onPyreGained',
    ON_PYRE_SPENT: 'onPyreSpent',
    ON_CARD_DRAWN: 'onCardDrawn',
    ON_PYRE_CARD_PLAYED: 'onPyreCardPlayed',
    
    // Ailment Events
    ON_AILMENT_APPLIED: 'onAilmentApplied',
    ON_AILMENT_CLEANSED: 'onAilmentCleansed',
    
    // Healing Events
    ON_HEAL: 'onHeal',
    
    // Effect Stack Events
    ON_EFFECT_ABOUT_TO_RESOLVE: 'onEffectAboutToResolve',
    ON_EFFECT_RESOLVED: 'onEffectResolved',
    
    // Game State Events
    ON_GAME_START: 'onGameStart',
    ON_GAME_END: 'onGameEnd',
    ON_STATE_CHANGED: 'onStateChanged'
};

// ==================== EXPORTS ====================

// CommonJS export (for Node.js / Cloudflare Worker)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        createGameEvents,
        GameEventTypes
    };
}

// Browser global export
if (typeof window !== 'undefined') {
    window.SharedGameEvents = {
        createGameEvents,
        GameEventTypes
    };
}
