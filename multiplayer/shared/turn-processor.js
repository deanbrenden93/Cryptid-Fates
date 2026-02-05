/**
 * Cryptid Fates - Shared Turn Processor
 * 
 * Isomorphic turn management that runs identically on
 * both client (browser) and server (Cloudflare Worker).
 * 
 * This module contains:
 * - Turn start/end processing
 * - Phase transitions
 * - End of turn effect processing (burn, toxic, etc.)
 * - Support promotion
 * - Win condition checking
 * 
 * Returns "turn intents" - declarative descriptions of turn events,
 * so the client can play animations and the server can validate/broadcast.
 */

// Schema import for phases
let GamePhases;
if (typeof require !== 'undefined') {
    try {
        const schema = require('./schema.js');
        GamePhases = schema.GamePhases;
    } catch (e) {
        // Running in browser
    }
}

/**
 * Create a turn processor instance
 * @param {Object} options - Configuration options
 * @param {Object} options.gameState - GameState instance
 * @param {Object} options.events - Event system instance
 * @param {Object} options.combatEngine - Combat engine instance (for processing effects)
 * @param {Object} options.trapSystem - Trap system instance
 * @param {boolean} options.debug - Enable debug logging
 * @param {Function} options.logger - Custom logging function
 * @returns {Object} TurnProcessor instance
 */
function createTurnProcessor(options = {}) {
    const debug = options.debug || false;
    const logger = options.logger || console.log;
    
    let gameState = options.gameState;
    let events = options.events;
    let combatEngine = options.combatEngine;
    let trapSystem = options.trapSystem;
    
    // Get phases from browser or server
    const Phases = GamePhases || (typeof window !== 'undefined' && window.SharedEffectSchema?.GamePhases) || {
        CONJURE_1: 'conjure1',
        CONJURE_2: 'conjure2',
        DEPLOY: 'deploy',
        COMBAT: 'combat',
        END_PHASE: 'endPhase'
    };
    
    function log(...args) {
        if (debug) logger('[TurnProcessor]', ...args);
    }
    
    /**
     * Set the game state instance
     */
    function setGameState(gs) {
        gameState = gs;
    }
    
    /**
     * Set the events instance
     */
    function setEvents(ev) {
        events = ev;
    }
    
    /**
     * Set the combat engine instance
     */
    function setCombatEngine(ce) {
        combatEngine = ce;
    }
    
    /**
     * Set the trap system instance
     */
    function setTrapSystem(ts) {
        trapSystem = ts;
    }
    
    /**
     * Process start of turn
     * @param {string} turnOwner - Who's turn is starting ('player' or 'enemy')
     * @returns {Object} Turn start result with intents
     */
    function processStartTurn(turnOwner) {
        if (!gameState) {
            return { success: false, error: 'NO_GAME_STATE' };
        }
        
        const result = {
            success: true,
            turnOwner,
            turnNumber: gameState.state.turn + 1,
            effects: [],
            stateChanges: []
        };
        
        // Update turn tracking
        gameState.state.turn++;
        gameState.state.currentTurn = turnOwner;
        gameState.state.phase = Phases.CONJURE_1;
        
        // Reset per-turn tracking
        gameState.state.attackersThisTurn = { player: [], enemy: [] };
        gameState.state.pyrePlayedThisPhase = { player: false, enemy: false };
        
        result.stateChanges.push({
            type: 'turnStart',
            turn: gameState.state.turn,
            currentTurn: turnOwner,
            phase: Phases.CONJURE_1
        });
        
        // Untap all cryptids for turn owner
        const cryptids = gameState.getAllCryptids(turnOwner);
        for (const cryptid of cryptids) {
            if (cryptid.tapped) {
                cryptid.tapped = false;
                result.effects.push({
                    type: 'untap',
                    cryptid: {
                        id: cryptid.id,
                        name: cryptid.name,
                        owner: cryptid.owner,
                        col: cryptid.col,
                        row: cryptid.row
                    }
                });
            }
            
            // Reset per-turn flags
            cryptid.canAttack = true;
            cryptid.canAttackAgain = false;
            cryptid.attackedThisTurn = false;
            cryptid.hasActedThisTurn = false;
            
            // Handle paralyze recovery
            if (cryptid.paralyzed) {
                cryptid.paralyzed = false;
                cryptid.paralyzeStartTurn = undefined;
                result.effects.push({
                    type: 'paralyzeRecovered',
                    cryptid: {
                        id: cryptid.id,
                        name: cryptid.name,
                        owner: cryptid.owner
                    }
                });
            }
        }
        
        // Reduce curse counters
        for (const cryptid of cryptids) {
            if (cryptid.curseTurns > 0) {
                cryptid.curseTurns--;
                if (cryptid.curseTurns <= 0) {
                    cryptid.cursed = false;
                    result.effects.push({
                        type: 'curseExpired',
                        cryptid: {
                            id: cryptid.id,
                            name: cryptid.name,
                            owner: cryptid.owner
                        }
                    });
                }
            }
        }
        
        // Draw kindling
        const kindlingDrawn = gameState.drawKindling(turnOwner);
        if (kindlingDrawn) {
            result.effects.push({
                type: 'drawKindling',
                owner: turnOwner,
                card: kindlingDrawn
            });
        }
        
        // Draw card
        const cardDrawn = gameState.drawCard(turnOwner);
        if (cardDrawn) {
            result.effects.push({
                type: 'drawCard',
                owner: turnOwner,
                card: cardDrawn
            });
        } else {
            // Deck empty damage
            gameState.modifyPyre(turnOwner, -1);
            result.effects.push({
                type: 'deckEmptyDamage',
                owner: turnOwner
            });
        }
        
        // Emit turn start event
        if (events) {
            events.emit('TURN_START', { 
                turn: gameState.state.turn,
                owner: turnOwner 
            });
        }
        
        log('Turn started:', turnOwner, 'turn', gameState.state.turn);
        return result;
    }
    
    /**
     * Process end of turn
     * @param {string} turnOwner - Who's turn is ending
     * @returns {Object} Turn end result with intents
     */
    function processEndTurn(turnOwner) {
        if (!gameState) {
            return { success: false, error: 'NO_GAME_STATE' };
        }
        
        const result = {
            success: true,
            turnOwner,
            effects: [],
            deaths: [],
            phaseEffects: {
                burn: [],
                toxic: [],
                calamity: [],
                bleed: []
            }
        };
        
        log('Processing end of turn for:', turnOwner);
        
        // Set phase to end phase
        gameState.state.phase = Phases.END_PHASE;
        
        // Process ailments for turn owner's cryptids
        const cryptids = gameState.getAllCryptids(turnOwner);
        
        for (const cryptid of cryptids) {
            // ===== BURN DAMAGE =====
            if (cryptid.burnTurns > 0) {
                const burnDamage = 2;
                cryptid.currentHp -= burnDamage;
                cryptid.burnTurns--;
                
                result.phaseEffects.burn.push({
                    cryptid: {
                        id: cryptid.id,
                        name: cryptid.name,
                        owner: cryptid.owner,
                        col: cryptid.col,
                        row: cryptid.row
                    },
                    damage: burnDamage,
                    turnsRemaining: cryptid.burnTurns
                });
                
                if (cryptid.currentHp <= 0) {
                    result.deaths.push({
                        cryptid: {
                            id: cryptid.id,
                            name: cryptid.name,
                            owner: cryptid.owner,
                            col: cryptid.col,
                            row: cryptid.row
                        },
                        killedBy: 'burn'
                    });
                }
            }
            
            // ===== TOXIC TILES (tiles apply toxic to cryptids on them) =====
            // This would require field tile data which we don't have in basic state
            
            // ===== BLEED DAMAGE =====
            if (cryptid.bleedTurns > 0) {
                const bleedDamage = 1;
                cryptid.currentHp -= bleedDamage;
                cryptid.bleedTurns--;
                
                result.phaseEffects.bleed.push({
                    cryptid: {
                        id: cryptid.id,
                        name: cryptid.name,
                        owner: cryptid.owner,
                        col: cryptid.col,
                        row: cryptid.row
                    },
                    damage: bleedDamage,
                    turnsRemaining: cryptid.bleedTurns
                });
                
                if (cryptid.currentHp <= 0 && !result.deaths.find(d => d.cryptid.id === cryptid.id)) {
                    result.deaths.push({
                        cryptid: {
                            id: cryptid.id,
                            name: cryptid.name,
                            owner: cryptid.owner,
                            col: cryptid.col,
                            row: cryptid.row
                        },
                        killedBy: 'bleed'
                    });
                }
            }
            
            // ===== CALAMITY COUNTDOWN =====
            if (cryptid.calamityCounters > 0) {
                cryptid.calamityCounters--;
                
                result.phaseEffects.calamity.push({
                    cryptid: {
                        id: cryptid.id,
                        name: cryptid.name,
                        owner: cryptid.owner
                    },
                    countersRemaining: cryptid.calamityCounters
                });
                
                // Calamity kills at 0
                if (cryptid.calamityCounters <= 0) {
                    cryptid.currentHp = 0;
                    if (!result.deaths.find(d => d.cryptid.id === cryptid.id)) {
                        result.deaths.push({
                            cryptid: {
                                id: cryptid.id,
                                name: cryptid.name,
                                owner: cryptid.owner,
                                col: cryptid.col,
                                row: cryptid.row
                            },
                            killedBy: 'calamity'
                        });
                    }
                }
            }
        }
        
        // Check trap triggers for end of turn
        if (trapSystem) {
            const endTurnTraps = trapSystem.checkTraps('onEndTurn', { turnOwner });
            if (endTurnTraps.length > 0) {
                result.effects.push({
                    type: 'trapsTriggered',
                    traps: endTurnTraps.map(t => ({
                        name: t.trap.name,
                        owner: t.trap.owner
                    }))
                });
            }
        }
        
        // Emit turn end event
        if (events) {
            events.emit('TURN_END', {
                turn: gameState.state.turn,
                owner: turnOwner,
                result
            });
        }
        
        log('Turn ended:', turnOwner);
        return result;
    }
    
    /**
     * Advance to next phase
     * @returns {Object} Phase change result
     */
    function advancePhase() {
        if (!gameState) {
            return { success: false, error: 'NO_GAME_STATE' };
        }
        
        const currentPhase = gameState.state.phase;
        let nextPhase;
        
        switch (currentPhase) {
            case Phases.CONJURE_1:
                nextPhase = Phases.DEPLOY;
                break;
            case Phases.DEPLOY:
                nextPhase = Phases.CONJURE_2;
                break;
            case Phases.CONJURE_2:
                nextPhase = Phases.COMBAT;
                break;
            case Phases.COMBAT:
                nextPhase = Phases.END_PHASE;
                break;
            default:
                nextPhase = Phases.CONJURE_1;
        }
        
        gameState.state.phase = nextPhase;
        gameState.state.pyrePlayedThisPhase = { player: false, enemy: false };
        
        if (events) {
            events.emit('PHASE_CHANGE', {
                from: currentPhase,
                to: nextPhase,
                turn: gameState.state.turn
            });
        }
        
        log('Phase advanced:', currentPhase, '->', nextPhase);
        
        return {
            success: true,
            previousPhase: currentPhase,
            currentPhase: nextPhase
        };
    }
    
    /**
     * Process support promotion when a combatant dies
     * @param {string} owner - Owner of the field
     * @param {number} row - Row where combatant died
     * @returns {Object} Promotion result
     */
    function processPromotion(owner, row) {
        if (!gameState) {
            return { success: false, error: 'NO_GAME_STATE' };
        }
        
        const combatCol = gameState.getCombatCol(owner);
        const supportCol = gameState.getSupportCol(owner);
        
        // Check if combat position is empty
        const combatant = gameState.getFieldCryptid(owner, combatCol, row);
        if (combatant) {
            return { success: false, reason: 'COMBAT_POSITION_OCCUPIED' };
        }
        
        // Check if there's a support to promote
        const support = gameState.getFieldCryptid(owner, supportCol, row);
        if (!support) {
            return { success: false, reason: 'NO_SUPPORT_TO_PROMOTE' };
        }
        
        // Move support to combat
        gameState.setFieldCryptid(owner, supportCol, row, null);
        gameState.setFieldCryptid(owner, combatCol, row, support);
        
        // Update position
        support.col = combatCol;
        support.zone = 'combat';
        
        // The promoted unit can attack this turn
        support.canAttack = true;
        support.tapped = false;
        
        const result = {
            success: true,
            promoted: {
                id: support.id,
                name: support.name,
                owner: support.owner,
                fromCol: supportCol,
                toCol: combatCol,
                row
            }
        };
        
        if (events) {
            events.emit('SUPPORT_PROMOTED', result.promoted);
        }
        
        log('Support promoted:', support.name, 'to combat');
        return result;
    }
    
    /**
     * Check for game over conditions
     * @returns {Object} Game over check result
     */
    function checkGameOver() {
        if (!gameState) {
            return { gameOver: false };
        }
        
        const playerPyre = gameState.getPyre('player');
        const enemyPyre = gameState.getPyre('enemy');
        const playerDeaths = gameState.state.playerDeaths;
        const enemyDeaths = gameState.state.enemyDeaths;
        
        // Check death count (10 deaths = game over)
        if (playerDeaths >= 10) {
            return {
                gameOver: true,
                winner: 'enemy',
                reason: 'DEATHS',
                finalState: {
                    playerPyre,
                    enemyPyre,
                    playerDeaths,
                    enemyDeaths
                }
            };
        }
        
        if (enemyDeaths >= 10) {
            return {
                gameOver: true,
                winner: 'player',
                reason: 'DEATHS',
                finalState: {
                    playerPyre,
                    enemyPyre,
                    playerDeaths,
                    enemyDeaths
                }
            };
        }
        
        return {
            gameOver: false,
            playerPyre,
            enemyPyre,
            playerDeaths,
            enemyDeaths
        };
    }
    
    /**
     * Process a complete turn switch (end current, start next)
     * @param {string} currentTurnOwner - Who's turn is ending
     * @returns {Object} Complete turn switch result
     */
    function processTurnSwitch(currentTurnOwner) {
        const nextTurnOwner = currentTurnOwner === 'player' ? 'enemy' : 'player';
        
        // Process end of current turn
        const endResult = processEndTurn(currentTurnOwner);
        
        // Check game over after end turn processing
        const gameOverCheck = checkGameOver();
        if (gameOverCheck.gameOver) {
            return {
                success: true,
                endTurnResult: endResult,
                gameOver: gameOverCheck,
                nextTurnResult: null
            };
        }
        
        // Process deaths from end turn
        if (endResult.deaths && endResult.deaths.length > 0) {
            for (const death of endResult.deaths) {
                const cryptid = gameState.getFieldCryptid(
                    death.cryptid.owner,
                    death.cryptid.col,
                    death.cryptid.row
                );
                if (cryptid) {
                    gameState.killCryptid(cryptid, death.killedBy === 'attack' ? currentTurnOwner : null, {
                        killedBy: death.killedBy
                    });
                    // Process promotion
                    processPromotion(death.cryptid.owner, death.cryptid.row);
                }
            }
            
            // Check game over after deaths
            const afterDeathsCheck = checkGameOver();
            if (afterDeathsCheck.gameOver) {
                return {
                    success: true,
                    endTurnResult: endResult,
                    gameOver: afterDeathsCheck,
                    nextTurnResult: null
                };
            }
        }
        
        // Start next turn
        const startResult = processStartTurn(nextTurnOwner);
        
        return {
            success: true,
            endTurnResult: endResult,
            gameOver: { gameOver: false },
            nextTurnResult: startResult
        };
    }
    
    /**
     * Get valid actions for current phase
     * @param {string} player - Player requesting valid actions
     * @returns {Array} List of valid action types
     */
    function getValidActionsForPhase(player) {
        if (!gameState) return [];
        
        const phase = gameState.state.phase;
        const isCurrentTurn = gameState.state.currentTurn === player;
        
        if (!isCurrentTurn) {
            return []; // Can only act on your turn
        }
        
        switch (phase) {
            case Phases.CONJURE_1:
            case Phases.CONJURE_2:
                return ['PLAY_SPELL', 'PLAY_PYRE_CARD', 'END_PHASE'];
                
            case Phases.DEPLOY:
                return ['SUMMON_CRYPTID', 'END_PHASE'];
                
            case Phases.COMBAT:
                return ['ATTACK', 'END_PHASE', 'END_TURN'];
                
            case Phases.END_PHASE:
                return ['END_TURN'];
                
            default:
                return [];
        }
    }
    
    // ==================== PUBLIC API ====================
    
    return {
        setGameState,
        setEvents,
        setCombatEngine,
        setTrapSystem,
        processStartTurn,
        processEndTurn,
        advancePhase,
        processPromotion,
        checkGameOver,
        processTurnSwitch,
        getValidActionsForPhase
    };
}

// ==================== EXPORTS ====================

// CommonJS export (for Node.js / Cloudflare Worker)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        createTurnProcessor
    };
}

// Browser global export
if (typeof window !== 'undefined') {
    window.SharedTurnProcessor = {
        createTurnProcessor
    };
}
