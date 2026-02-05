/**
 * Cryptid Fates - Multiplayer UI Hooks
 * 
 * This script intercepts UI interactions and routes them through
 * the MultiplayerGameBridge when in multiplayer mode.
 * 
 * It works by wrapping or intercepting existing game functions.
 */

window.MultiplayerUIHooks = {
    initialized: false,
    originalFunctions: {},
    
    init() {
        if (this.initialized) return;
        if (!window.isMultiplayer) {
            console.log('[MPHooks] Not in multiplayer mode, skipping');
            return;
        }
        
        console.log('[MPHooks] Initializing UI hooks for multiplayer');
        
        // Wait for game to be ready
        if (!window.game) {
            console.log('[MPHooks] Waiting for game to initialize...');
            setTimeout(() => this.init(), 500);
            return;
        }
        
        this.hookGameFunctions();
        this.hookUIButtons();
        this.addTurnIndicator();
        this.initialized = true;
        
        console.log('[MPHooks] UI hooks initialized');
    },
    
    hookGameFunctions() {
        const game = window.game;
        if (!game) return;
        
        // Store original functions
        this.originalFunctions.summonCryptid = game.summonCryptid?.bind(game);
        this.originalFunctions.summonKindling = game.summonKindling?.bind(game);
        this.originalFunctions.attack = game.attack?.bind(game);
        this.originalFunctions.endTurn = game.endTurn?.bind(game);
        this.originalFunctions.pyreBurn = game.pyreBurn?.bind(game);
        this.originalFunctions.playPyreCard = game.playPyreCard?.bind(game);
        
        // Override with multiplayer versions
        // IMPORTANT: Match the original function signatures!
        // game.summonCryptid(owner, col, row, cardData)
        // game.summonKindling(owner, col, row, kindlingCard)
        
        if (game.summonCryptid) {
            game.summonCryptid = (owner, col, row, cardData) => {
                // Only intercept player actions
                if (owner === 'player' && window.isMultiplayer && MultiplayerGameBridge.enabled) {
                    const cardId = cardData?.id;
                    console.log('[MPHooks] Intercepting summonCryptid:', cardId, col, row);
                    return MultiplayerGameBridge.summonCryptid(cardId, col, row, cardData);
                }
                return this.originalFunctions.summonCryptid(owner, col, row, cardData);
            };
        }
        
        if (game.summonKindling) {
            game.summonKindling = (owner, col, row, kindlingCard) => {
                // Only intercept player actions
                if (owner === 'player' && window.isMultiplayer && MultiplayerGameBridge.enabled) {
                    const cardId = kindlingCard?.id;
                    console.log('[MPHooks] Intercepting summonKindling:', cardId, col, row);
                    return MultiplayerGameBridge.summonKindling(cardId, col, row);
                }
                return this.originalFunctions.summonKindling(owner, col, row, kindlingCard);
            };
        }
        
        if (game.attack) {
            game.attack = (attackerCol, attackerRow, targetCol, targetRow) => {
                if (window.isMultiplayer && MultiplayerGameBridge.enabled) {
                    console.log('[MPHooks] Intercepting attack:', attackerCol, attackerRow, '->', targetCol, targetRow);
                    return MultiplayerGameBridge.attack(attackerCol, attackerRow, targetCol, targetRow);
                }
                return this.originalFunctions.attack(attackerCol, attackerRow, targetCol, targetRow);
            };
        }
        
        if (game.endTurn) {
            game.endTurn = () => {
                if (window.isMultiplayer && MultiplayerGameBridge.enabled) {
                    console.log('[MPHooks] Intercepting endTurn');
                    return MultiplayerGameBridge.endTurn();
                }
                return this.originalFunctions.endTurn();
            };
        }
        
        if (game.pyreBurn) {
            game.pyreBurn = (cardIndex) => {
                if (window.isMultiplayer && MultiplayerGameBridge.enabled) {
                    console.log('[MPHooks] Intercepting pyreBurn:', cardIndex);
                    return MultiplayerGameBridge.pyreBurn(cardIndex);
                }
                return this.originalFunctions.pyreBurn(cardIndex);
            };
        }
        
        // Hook playPyreCard for pyre spell cards
        if (game.playPyreCard) {
            game.playPyreCard = (owner, card) => {
                // Only intercept player actions
                if (owner === 'player' && window.isMultiplayer && MultiplayerGameBridge.enabled) {
                    console.log('[MPHooks] Intercepting playPyreCard:', card?.id, card?.name);
                    return MultiplayerGameBridge.playPyreCard(card?.id, card);
                }
                return this.originalFunctions.playPyreCard(owner, card);
            };
        }
        
        console.log('[MPHooks] Game functions hooked');
    },
    
    hookUIButtons() {
        // Hook the advance phase button
        const advanceBtn = document.querySelector('.advance-phase-btn, #advance-phase-btn');
        if (advanceBtn) {
            advanceBtn.addEventListener('click', (e) => {
                if (window.isMultiplayer && MultiplayerGameBridge.enabled) {
                    if (!MultiplayerGameBridge.isMyTurn) {
                        e.preventDefault();
                        e.stopPropagation();
                        MultiplayerGameBridge.showNotYourTurnMessage();
                        return false;
                    }
                    // Let it through but route through bridge
                    MultiplayerGameBridge.endPhase();
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                }
            }, true);
        }
        
        // Hook end turn button
        const endTurnBtn = document.querySelector('.end-turn-btn, #end-turn-btn');
        if (endTurnBtn) {
            endTurnBtn.addEventListener('click', (e) => {
                if (window.isMultiplayer && MultiplayerGameBridge.enabled) {
                    if (!MultiplayerGameBridge.isMyTurn) {
                        e.preventDefault();
                        e.stopPropagation();
                        MultiplayerGameBridge.showNotYourTurnMessage();
                        return false;
                    }
                }
            }, true);
        }
        
        console.log('[MPHooks] UI buttons hooked');
    },
    
    addTurnIndicator() {
        // Remove existing if present
        document.getElementById('mp-turn-indicator')?.remove();
        
        const indicator = document.createElement('div');
        indicator.id = 'mp-turn-indicator';
        indicator.className = 'mp-turn-indicator';
        
        const isMyTurn = MultiplayerGameBridge?.isMyTurn ?? true;
        indicator.innerHTML = `
            <div class="turn-text">${isMyTurn ? 'YOUR TURN' : "OPPONENT'S TURN"}</div>
            <div class="role-text">You are: ${window.multiplayerRole === 'player' ? 'Player 1' : 'Player 2'}</div>
        `;
        indicator.classList.add(isMyTurn ? 'your-turn' : 'opponent-turn');
        
        document.body.appendChild(indicator);
        
        // Update the bridge's UI update function to also update our indicator
        const originalUpdateTurnUI = MultiplayerGameBridge.updateTurnUI;
        MultiplayerGameBridge.updateTurnUI = function() {
            originalUpdateTurnUI.call(this);
            
            const ind = document.getElementById('mp-turn-indicator');
            if (ind) {
                ind.querySelector('.turn-text').textContent = this.isMyTurn ? 'YOUR TURN' : "OPPONENT'S TURN";
                ind.classList.remove('your-turn', 'opponent-turn');
                ind.classList.add(this.isMyTurn ? 'your-turn' : 'opponent-turn');
            }
        };
    },
    
    // Call this to restore original functions (for leaving multiplayer)
    unhook() {
        if (!this.initialized) return;
        
        const game = window.game;
        if (game) {
            if (this.originalFunctions.summonCryptid) game.summonCryptid = this.originalFunctions.summonCryptid;
            if (this.originalFunctions.summonKindling) game.summonKindling = this.originalFunctions.summonKindling;
            if (this.originalFunctions.attack) game.attack = this.originalFunctions.attack;
            if (this.originalFunctions.endTurn) game.endTurn = this.originalFunctions.endTurn;
            if (this.originalFunctions.pyreBurn) game.pyreBurn = this.originalFunctions.pyreBurn;
        }
        
        document.getElementById('mp-turn-indicator')?.remove();
        
        this.initialized = false;
        console.log('[MPHooks] UI hooks removed');
    }
};

// CSS for turn indicator
const mpHooksStyle = document.createElement('style');
mpHooksStyle.textContent = `
    .mp-turn-indicator {
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10000;
        padding: 12px 30px;
        border-radius: 25px;
        font-family: 'Cinzel', serif;
        text-align: center;
        transition: all 0.3s ease;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    }
    
    .mp-turn-indicator.your-turn {
        background: linear-gradient(180deg, rgba(40, 80, 40, 0.95) 0%, rgba(20, 50, 20, 0.98) 100%);
        border: 2px solid rgba(126, 205, 115, 0.6);
        color: #7ecd73;
    }
    
    .mp-turn-indicator.opponent-turn {
        background: linear-gradient(180deg, rgba(80, 40, 40, 0.95) 0%, rgba(50, 20, 20, 0.98) 100%);
        border: 2px solid rgba(229, 115, 115, 0.6);
        color: #e57373;
    }
    
    .mp-turn-indicator .turn-text {
        font-size: 18px;
        font-weight: bold;
        letter-spacing: 2px;
    }
    
    .mp-turn-indicator .role-text {
        font-size: 11px;
        opacity: 0.7;
        margin-top: 4px;
    }
    
    /* Disable cards when not your turn */
    .disabled-turn {
        opacity: 0.6 !important;
        pointer-events: none !important;
        filter: grayscale(30%);
    }
    
    .disabled-turn:hover {
        transform: none !important;
    }
`;
document.head.appendChild(mpHooksStyle);

console.log('[MultiplayerUIHooks] Module loaded');
