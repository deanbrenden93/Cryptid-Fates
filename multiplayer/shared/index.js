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

(function() {
'use strict';

// ==================== IMPORTS ====================

// Detect environment
const _isNode = typeof module !== 'undefined' && module.exports;
const _isBrowser = typeof window !== 'undefined';

// Import modules based on environment
let _eventsModule, _schemaModule, _cardRegistryModule, _effectResolverModule;
let _gameStateModule, _combatEngineModule, _trapSystemModule, _turnProcessorModule;

if (_isNode) {
    _eventsModule = require('./events.js');
    _schemaModule = require('./schema.js');
    _cardRegistryModule = require('./card-registry.js');
    _effectResolverModule = require('./effect-resolver.js');
    _gameStateModule = require('./game-state.js');
    _combatEngineModule = require('./combat-engine.js');
    _trapSystemModule = require('./trap-system.js');
    _turnProcessorModule = require('./turn-processor.js');
}

// ==================== RE-EXPORTS ====================

// Events
const _createGameEvents = _isNode 
    ? _eventsModule.createGameEvents 
    : (_isBrowser && window.SharedGameEvents?.createGameEvents);

const _GameEventTypes = _isNode 
    ? _eventsModule.GameEventTypes 
    : (_isBrowser && window.SharedGameEvents?.GameEventTypes);

// Schema
const _EffectSchema = _isNode 
    ? _schemaModule.EffectSchema 
    : (_isBrowser && window.SharedEffectSchema);

const _EffectTriggers = _isNode ? _schemaModule.EffectTriggers : _EffectSchema?.Triggers;
const _EffectActions = _isNode ? _schemaModule.EffectActions : _EffectSchema?.Actions;
const _EffectTargets = _isNode ? _schemaModule.EffectTargets : _EffectSchema?.Targets;
const _EffectConditions = _isNode ? _schemaModule.EffectConditions : _EffectSchema?.Conditions;
const _EffectCalculations = _isNode ? _schemaModule.EffectCalculations : _EffectSchema?.Calculations;
const _Keywords = _isNode ? _schemaModule.Keywords : _EffectSchema?.Keywords;
const _Auras = _isNode ? _schemaModule.Auras : _EffectSchema?.Auras;
const _Ailments = _isNode ? _schemaModule.Ailments : _EffectSchema?.Ailments;
const _GamePhases = _isNode ? _schemaModule.GamePhases : _EffectSchema?.Phases;
const _CardTypes = _isNode ? _schemaModule.CardTypes : _EffectSchema?.CardTypes;
const _Rarities = _isNode ? _schemaModule.Rarities : _EffectSchema?.Rarities;
const _Elements = _isNode ? _schemaModule.Elements : _EffectSchema?.Elements;

// Card Registry
const _createCardRegistry = _isNode 
    ? _cardRegistryModule.createCardRegistry 
    : (_isBrowser && window.SharedCardRegistry?.createCardRegistry);

// Effect Resolver
const _createEffectResolver = _isNode 
    ? _effectResolverModule.createEffectResolver 
    : (_isBrowser && window.SharedEffectResolver?.createEffectResolver);

// Game State
const _createGameState = _isNode 
    ? _gameStateModule.createGameState 
    : (_isBrowser && window.SharedGameState?.createGameState);

// Combat Engine
const _createCombatEngine = _isNode 
    ? _combatEngineModule.createCombatEngine 
    : (_isBrowser && window.SharedCombatEngine?.createCombatEngine);

// Trap System
const _createTrapSystem = _isNode 
    ? _trapSystemModule.createTrapSystem 
    : (_isBrowser && window.SharedTrapSystem?.createTrapSystem);

// Turn Processor
const _createTurnProcessor = _isNode 
    ? _turnProcessorModule.createTurnProcessor 
    : (_isBrowser && window.SharedTurnProcessor?.createTurnProcessor);

// ==================== COMBINED EXPORT ====================

const CryptidShared = {
    // Events
    createGameEvents: _createGameEvents,
    GameEventTypes: _GameEventTypes,
    
    // Schema
    EffectSchema: _EffectSchema,
    EffectTriggers: _EffectTriggers,
    EffectActions: _EffectActions,
    EffectTargets: _EffectTargets,
    EffectConditions: _EffectConditions,
    EffectCalculations: _EffectCalculations,
    Keywords: _Keywords,
    Auras: _Auras,
    Ailments: _Ailments,
    GamePhases: _GamePhases,
    CardTypes: _CardTypes,
    Rarities: _Rarities,
    Elements: _Elements,
    
    // Card Registry
    createCardRegistry: _createCardRegistry,
    
    // Effect Resolver
    createEffectResolver: _createEffectResolver,
    
    // Game State
    createGameState: _createGameState,
    
    // Combat Engine
    createCombatEngine: _createCombatEngine,
    
    // Trap System
    createTrapSystem: _createTrapSystem,
    
    // Turn Processor
    createTurnProcessor: _createTurnProcessor,
    
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
        const events = _createGameEvents({ debug, logger });
        const registry = _createCardRegistry({ debug, logger });
        const resolver = _createEffectResolver({ events, debug, logger });
        
        // Create game state with events integration
        const gameState = _createGameState({ 
            events, 
            debug, 
            logger,
            ...options.initialState 
        });
        
        // Create combat engine
        const combatEngine = _createCombatEngine({ 
            gameState, 
            debug, 
            logger 
        });
        
        // Create trap system
        const trapSystem = _createTrapSystem({ 
            gameState, 
            events, 
            debug, 
            logger 
        });
        
        // Create turn processor with all dependencies
        const turnProcessor = _createTurnProcessor({ 
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
if (_isNode) {
    module.exports = CryptidShared;
}

// Browser global export
if (_isBrowser) {
    window.CryptidShared = CryptidShared;
}

})(); // End IIFE
