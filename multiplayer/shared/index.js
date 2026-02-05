/**
 * Cryptid Fates - Shared Game Logic
 * 
 * Isomorphic game logic module that runs identically on
 * both client (browser) and server (Cloudflare Worker).
 * 
 * This is the main entry point for the shared module.
 * 
 * Usage (CommonJS / Cloudflare Worker):
 *   const { createGameEvents, createCardRegistry, EffectSchema } = require('./shared');
 * 
 * Usage (Browser):
 *   const { createGameEvents, createCardRegistry, EffectSchema } = window.CryptidShared;
 */

// ==================== IMPORTS ====================

// Detect environment
const isNode = typeof module !== 'undefined' && module.exports;
const isBrowser = typeof window !== 'undefined';

// Import modules based on environment
let eventsModule, schemaModule, cardRegistryModule, effectResolverModule;
let gameStateModule, combatEngineModule, trapSystemModule, turnProcessorModule;

if (isNode) {
    eventsModule = require('./events.js');
    schemaModule = require('./schema.js');
    cardRegistryModule = require('./card-registry.js');
    effectResolverModule = require('./effect-resolver.js');
    gameStateModule = require('./game-state.js');
    combatEngineModule = require('./combat-engine.js');
    trapSystemModule = require('./trap-system.js');
    turnProcessorModule = require('./turn-processor.js');
}

// ==================== RE-EXPORTS ====================

// Events
const createGameEvents = isNode 
    ? eventsModule.createGameEvents 
    : (isBrowser && window.SharedGameEvents?.createGameEvents);

const GameEventTypes = isNode 
    ? eventsModule.GameEventTypes 
    : (isBrowser && window.SharedGameEvents?.GameEventTypes);

// Schema
const EffectSchema = isNode 
    ? schemaModule.EffectSchema 
    : (isBrowser && window.SharedEffectSchema);

const EffectTriggers = isNode ? schemaModule.EffectTriggers : EffectSchema?.Triggers;
const EffectActions = isNode ? schemaModule.EffectActions : EffectSchema?.Actions;
const EffectTargets = isNode ? schemaModule.EffectTargets : EffectSchema?.Targets;
const EffectConditions = isNode ? schemaModule.EffectConditions : EffectSchema?.Conditions;
const EffectCalculations = isNode ? schemaModule.EffectCalculations : EffectSchema?.Calculations;
const Keywords = isNode ? schemaModule.Keywords : EffectSchema?.Keywords;
const Auras = isNode ? schemaModule.Auras : EffectSchema?.Auras;
const Ailments = isNode ? schemaModule.Ailments : EffectSchema?.Ailments;
const GamePhases = isNode ? schemaModule.GamePhases : EffectSchema?.Phases;
const CardTypes = isNode ? schemaModule.CardTypes : EffectSchema?.CardTypes;
const Rarities = isNode ? schemaModule.Rarities : EffectSchema?.Rarities;
const Elements = isNode ? schemaModule.Elements : EffectSchema?.Elements;

// Card Registry
const createCardRegistry = isNode 
    ? cardRegistryModule.createCardRegistry 
    : (isBrowser && window.SharedCardRegistry?.createCardRegistry);

// Effect Resolver
const createEffectResolver = isNode 
    ? effectResolverModule.createEffectResolver 
    : (isBrowser && window.SharedEffectResolver?.createEffectResolver);

// Game State
const createGameState = isNode 
    ? gameStateModule.createGameState 
    : (isBrowser && window.SharedGameState?.createGameState);

// Combat Engine
const createCombatEngine = isNode 
    ? combatEngineModule.createCombatEngine 
    : (isBrowser && window.SharedCombatEngine?.createCombatEngine);

// Trap System
const createTrapSystem = isNode 
    ? trapSystemModule.createTrapSystem 
    : (isBrowser && window.SharedTrapSystem?.createTrapSystem);

// Turn Processor
const createTurnProcessor = isNode 
    ? turnProcessorModule.createTurnProcessor 
    : (isBrowser && window.SharedTurnProcessor?.createTurnProcessor);

// ==================== COMBINED EXPORT ====================

const CryptidShared = {
    // Events
    createGameEvents,
    GameEventTypes,
    
    // Schema
    EffectSchema,
    EffectTriggers,
    EffectActions,
    EffectTargets,
    EffectConditions,
    EffectCalculations,
    Keywords,
    Auras,
    Ailments,
    GamePhases,
    CardTypes,
    Rarities,
    Elements,
    
    // Card Registry
    createCardRegistry,
    
    // Effect Resolver
    createEffectResolver,
    
    // Game State
    createGameState,
    
    // Combat Engine
    createCombatEngine,
    
    // Trap System
    createTrapSystem,
    
    // Turn Processor
    createTurnProcessor,
    
    // Version info
    version: '2.0.0', // Updated for Phase 5
    
    /**
     * Initialize a complete game context with all systems
     * This is the recommended way to set up the shared game logic.
     * 
     * @param {Object} options - Configuration options
     * @param {boolean} options.debug - Enable debug logging
     * @param {Function} options.logger - Custom logging function
     * @param {Object} options.initialState - Initial game state overrides
     * @returns {Object} Complete game context with all systems wired together
     */
    createGameContext(options = {}) {
        const debug = options.debug || false;
        const logger = options.logger || console.log;
        
        // Create core systems
        const events = createGameEvents({ debug, logger });
        const registry = createCardRegistry({ debug, logger });
        const resolver = createEffectResolver({ events, debug, logger });
        
        // Create game state with events integration
        const gameState = createGameState({ 
            events, 
            debug, 
            logger,
            ...options.initialState 
        });
        
        // Create combat engine
        const combatEngine = createCombatEngine({ 
            gameState, 
            debug, 
            logger 
        });
        
        // Create trap system
        const trapSystem = createTrapSystem({ 
            gameState, 
            events, 
            debug, 
            logger 
        });
        
        // Create turn processor with all dependencies
        const turnProcessor = createTurnProcessor({ 
            gameState, 
            events, 
            combatEngine,
            trapSystem,
            debug, 
            logger 
        });
        
        // Wire up effect resolver to use game state
        resolver.setGameState?.(gameState);
        
        return { 
            events, 
            registry, 
            resolver,
            gameState,
            combatEngine,
            trapSystem,
            turnProcessor,
            
            /**
             * Reset all systems for a new game
             */
            reset() {
                if (gameState.reset) gameState.reset();
                if (trapSystem.clearTraps) trapSystem.clearTraps();
            },
            
            /**
             * Export complete game state for serialization
             */
            exportState() {
                return {
                    gameState: gameState.exportState(),
                    traps: trapSystem.exportTraps()
                };
            },
            
            /**
             * Import complete game state from serialized data
             */
            importState(data) {
                if (data.gameState) gameState.importState(data.gameState);
                if (data.traps) trapSystem.importTraps(data.traps);
            }
        };
    }
};

// ==================== EXPORTS ====================

// CommonJS export (for Node.js / Cloudflare Worker)
if (isNode) {
    module.exports = CryptidShared;
}

// Browser global export
if (isBrowser) {
    window.CryptidShared = CryptidShared;
}
