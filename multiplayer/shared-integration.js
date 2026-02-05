/**
 * Cryptid Fates - Shared Module Browser Integration
 * 
 * This file integrates the shared game logic modules with the existing
 * browser-based game (game-core.js). It provides:
 * 
 * 1. A unified interface for both single-player and multiplayer modes
 * 2. State synchronization helpers for multiplayer
 * 3. Validation functions that match the server
 * 
 * Load this AFTER the shared modules and BEFORE game-core.js
 */

(function() {
    'use strict';
    
    // Wait for shared modules to be available
    if (!window.CryptidShared && !window.SharedGameState) {
        console.warn('[SharedIntegration] Shared modules not loaded yet');
    }
    
    /**
     * SharedGameIntegration - Bridge between shared modules and game-core.js
     */
    window.SharedGameIntegration = {
        
        // Game context (created when multiplayer starts)
        gameContext: null,
        
        // Is multiplayer mode active
        isMultiplayer: false,
        
        // Player role in multiplayer ('player' or 'enemy')
        myRole: null,
        
        /**
         * Initialize for multiplayer mode
         * @param {string} role - 'player' or 'enemy'
         * @param {Object} initialState - Initial game state from server
         */
        initMultiplayer(role, initialState = null) {
            console.log('[SharedIntegration] Initializing for multiplayer, role:', role);
            
            this.isMultiplayer = true;
            this.myRole = role;
            
            // Create game context using shared modules
            const CryptidShared = window.CryptidShared || this.getSharedFromGlobals();
            
            if (CryptidShared && CryptidShared.createGameContext) {
                this.gameContext = CryptidShared.createGameContext({ debug: false });
                
                if (initialState) {
                    this.importServerState(initialState);
                }
                
                console.log('[SharedIntegration] Game context created');
            } else {
                console.warn('[SharedIntegration] CryptidShared not available, using fallback');
            }
        },
        
        /**
         * Get shared modules from individual globals if bundled export not available
         */
        getSharedFromGlobals() {
            if (window.SharedGameState && window.SharedCombatEngine) {
                return {
                    createGameContext: (options) => {
                        const events = window.SharedGameEvents?.createGameEvents?.(options) || { emit: () => {}, on: () => {} };
                        const gameState = window.SharedGameState.createGameState({ ...options, events });
                        const combatEngine = window.SharedCombatEngine.createCombatEngine({ gameState, ...options });
                        const turnProcessor = window.SharedTurnProcessor?.createTurnProcessor?.({ gameState, events, ...options }) || null;
                        const trapSystem = window.SharedTrapSystem?.createTrapSystem?.({ gameState, events, ...options }) || null;
                        
                        return {
                            events,
                            gameState,
                            combatEngine,
                            turnProcessor,
                            trapSystem,
                            exportState: () => gameState.exportState(),
                            importState: (data) => gameState.importState(data)
                        };
                    }
                };
            }
            return null;
        },
        
        /**
         * Import state from server
         * @param {Object} serverState - State from server (already perspective-adjusted)
         */
        importServerState(serverState) {
            if (!this.gameContext) {
                console.warn('[SharedIntegration] No game context to import state');
                return;
            }
            
            // Server sends state already from our perspective
            // playerField = our field, enemyField = opponent's field
            const gs = this.gameContext.gameState.state;
            
            if (serverState.playerField) gs.playerField = serverState.playerField;
            if (serverState.enemyField) gs.enemyField = serverState.enemyField;
            if (serverState.yourHand) {
                if (this.myRole === 'player') {
                    gs.playerHand = serverState.yourHand;
                } else {
                    gs.enemyHand = serverState.yourHand;
                }
            }
            if (serverState.playerPyre !== undefined) gs.playerPyre = serverState.playerPyre;
            if (serverState.enemyPyre !== undefined) gs.enemyPyre = serverState.enemyPyre;
            if (serverState.playerDeaths !== undefined) gs.playerDeaths = serverState.playerDeaths;
            if (serverState.enemyDeaths !== undefined) gs.enemyDeaths = serverState.enemyDeaths;
            // Map server's raw currentTurn to local perspective
            if (serverState.currentTurn) {
                const isMyTurn = serverState.currentTurn === this.myRole;
                gs.currentTurn = isMyTurn ? 'player' : 'enemy';
            }
            if (serverState.phase) gs.phase = serverState.phase;
            if (serverState.turnNumber !== undefined) gs.turnNumber = serverState.turnNumber;
            if (serverState.yourKindling) {
                if (this.myRole === 'player') {
                    gs.playerKindling = serverState.yourKindling;
                } else {
                    gs.enemyKindling = serverState.yourKindling;
                }
            }
            
            console.log('[SharedIntegration] State imported from server');
        },
        
        /**
         * Validate if an action is valid (using same logic as server)
         * @param {string} actionType - Action type
         * @param {Object} payload - Action payload
         * @returns {Object} { valid: boolean, reason?: string }
         */
        validateAction(actionType, payload) {
            if (!this.gameContext) {
                return { valid: true }; // Can't validate without context
            }
            
            const gs = this.gameContext.gameState.state;
            
            // Check if it's our turn
            if (gs.currentTurn !== this.myRole) {
                return { valid: false, reason: 'NOT_YOUR_TURN' };
            }
            
            // Check phase validity
            const phaseActions = {
                conjure1: ['SUMMON_CRYPTID', 'SUMMON_KINDLING', 'PLAY_BURST', 'PLAY_TRAP', 'PLAY_PYRE_CARD', 'PYRE_BURN', 'EVOLVE_CRYPTID', 'END_CONJURE1'],
                combat: ['ATTACK', 'END_COMBAT'],
                conjure2: ['SUMMON_CRYPTID', 'SUMMON_KINDLING', 'PLAY_BURST', 'PLAY_TRAP', 'PLAY_PYRE_CARD', 'PYRE_BURN', 'EVOLVE_CRYPTID', 'END_TURN']
            };
            
            if (phaseActions[gs.phase] && !phaseActions[gs.phase].includes(actionType)) {
                return { valid: false, reason: 'WRONG_PHASE' };
            }
            
            // Action-specific validation
            switch (actionType) {
                case 'SUMMON_CRYPTID':
                    return this.validateSummon(payload);
                case 'SUMMON_KINDLING':
                    return this.validateKindlingSummon(payload);
                case 'ATTACK':
                    return this.validateAttack(payload);
                case 'PLAY_PYRE_CARD':
                    return this.validatePyreCard(payload);
                default:
                    return { valid: true };
            }
        },
        
        validateSummon(payload) {
            const gs = this.gameContext.gameState;
            const hand = gs.getHand(this.myRole);
            const pyre = gs.getPyre(this.myRole);
            
            const card = hand.find(c => c.id === payload.cardId);
            if (!card) {
                return { valid: false, reason: 'CARD_NOT_IN_HAND' };
            }
            
            if ((card.cost || 0) > pyre) {
                return { valid: false, reason: 'INSUFFICIENT_PYRE' };
            }
            
            return { valid: true };
        },
        
        validateKindlingSummon(payload) {
            const gs = this.gameContext.gameState.state;
            const playedFlag = this.myRole === 'player' ? 'playerKindlingPlayedThisTurn' : 'enemyKindlingPlayedThisTurn';
            
            if (gs[playedFlag]) {
                return { valid: false, reason: 'KINDLING_ALREADY_PLAYED' };
            }
            
            return { valid: true };
        },
        
        validateAttack(payload) {
            const gs = this.gameContext.gameState;
            const combat = this.gameContext.combatEngine;
            
            const attacker = gs.getFieldCryptid(this.myRole, payload.attackerCol, payload.attackerRow);
            if (!attacker) {
                return { valid: false, reason: 'NO_ATTACKER' };
            }
            
            const targetOwner = this.myRole === 'player' ? 'enemy' : 'player';
            const target = gs.getFieldCryptid(targetOwner, payload.targetCol, payload.targetRow);
            
            const result = combat.validateAttack(attacker, target);
            return { valid: result.valid, reason: result.reason };
        },
        
        validatePyreCard(payload) {
            const gs = this.gameContext.gameState.state;
            const usedFlag = this.myRole === 'player' ? 'playerPyreCardPlayedThisTurn' : 'enemyPyreCardPlayedThisTurn';
            
            if (gs[usedFlag]) {
                return { valid: false, reason: 'PYRE_CARD_ALREADY_PLAYED' };
            }
            
            return { valid: true };
        },
        
        /**
         * Apply a server event locally
         * @param {Object} event - Server event
         */
        applyServerEvent(event) {
            if (!this.gameContext) return;
            
            const gs = this.gameContext.gameState;
            
            switch (event.type) {
                case 'CRYPTID_SUMMONED':
                    if (event.cryptid) {
                        gs.setFieldCryptid(event.owner, event.col, event.row, event.cryptid);
                    }
                    break;
                    
                case 'KINDLING_SUMMONED':
                    if (event.cryptid) {
                        gs.setFieldCryptid(event.owner, event.col, event.row, { ...event.cryptid, isKindling: true });
                    }
                    break;
                    
                case 'DAMAGE_DEALT':
                    const target = gs.getFieldCryptid(event.targetOwner, event.targetCol, event.targetRow);
                    if (target) {
                        target.currentHp = event.hpAfter;
                    }
                    break;
                    
                case 'CRYPTID_DIED':
                    gs.setFieldCryptid(event.owner, event.slot.col, event.slot.row, null);
                    if (event.owner === 'player') {
                        gs.state.playerDeaths = event.newDeathCount;
                    } else {
                        gs.state.enemyDeaths = event.newDeathCount;
                    }
                    break;
                    
                case 'CRYPTID_PROMOTED':
                    // Already handled by server state
                    break;
                    
                case 'PYRE_CHANGED':
                    if (event.owner === 'player') {
                        gs.state.playerPyre = event.newPyre;
                    } else {
                        gs.state.enemyPyre = event.newPyre;
                    }
                    break;
                    
                case 'PHASE_CHANGED':
                    gs.state.phase = event.phase;
                    break;
                    
                case 'TURN_STARTED':
                    gs.state.currentTurn = event.owner;
                    gs.state.turnNumber = event.turnNumber;
                    gs.state.phase = 'conjure1';
                    // Reset turn flags
                    gs.state.playerKindlingPlayedThisTurn = false;
                    gs.state.enemyKindlingPlayedThisTurn = false;
                    gs.state.playerPyreCardPlayedThisTurn = false;
                    gs.state.enemyPyreCardPlayedThisTurn = false;
                    gs.state.playerPyreBurnUsed = false;
                    gs.state.enemyPyreBurnUsed = false;
                    break;
                    
                case 'TURN_ENDED':
                    // Server will follow with TURN_STARTED
                    break;
            }
        },
        
        /**
         * Get the shared game state (for debugging/display)
         */
        getState() {
            if (!this.gameContext) return null;
            return this.gameContext.gameState.state;
        },
        
        /**
         * Reset integration (for new game)
         */
        reset() {
            this.gameContext = null;
            this.isMultiplayer = false;
            this.myRole = null;
            console.log('[SharedIntegration] Reset');
        },
        
        /**
         * Calculate damage preview using shared combat engine
         * @param {Object} attacker - Attacker cryptid
         * @param {Object} target - Target cryptid
         * @returns {Object} Damage calculation
         */
        calculateDamagePreview(attacker, target) {
            if (!this.gameContext?.combatEngine) {
                // Fallback calculation
                let damage = attacker.currentAtk || attacker.atk || 0;
                if (target.bleedTurns > 0) damage *= 2;
                return { finalDamage: damage };
            }
            
            return this.gameContext.combatEngine.calculateDamage(attacker, target);
        }
    };
    
    console.log('[SharedIntegration] Module loaded');
    
})();
