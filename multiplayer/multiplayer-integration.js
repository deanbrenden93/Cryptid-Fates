/**
 * Cryptid Fates - Multiplayer Integration
 * 
 * This file shows how to integrate multiplayer into your existing game.
 * Include this AFTER your existing game scripts and AFTER MultiplayerClient.js
 * 
 * Usage:
 *   <script src="multiplayer/client/MultiplayerClient.js"></script>
 *   <script src="multiplayer/multiplayer-integration.js"></script>
 */

// ==================== CONFIGURATION ====================

// Your Cloudflare Worker URL
window.MULTIPLAYER_SERVER_URL = 'wss://cryptid-new.brenden-6ce.workers.dev';

// ==================== MULTIPLAYER MANAGER ====================

window.MultiplayerManager = {
  client: null,
  isMultiplayer: false,
  matchId: null,
  isSearching: false,
  searchAborted: false,
  
  /**
   * Initialize multiplayer mode
   */
  init() {
    this.client = new MultiplayerClient();
    
    // Set up callbacks
    this.client.onGameStart = (data) => this.handleGameStart(data);
    this.client.onGameEnd = (data) => this.handleGameEnd(data);
    this.client.onTurnChange = (isMyTurn) => this.handleTurnChange(isMyTurn);
    this.client.onActionRejected = (data) => this.handleActionRejected(data);
    this.client.onConnectionChange = (connected) => this.handleConnectionChange(connected);
    this.client.onOpponentDisconnect = (disconnected, window) => this.handleOpponentDisconnect(disconnected, window);
  },
  
  /**
   * Find a match via quick matchmaking
   * Returns a promise that resolves when a match is found
   */
  async findMatch() {
    if (!this.client) this.init();
    
    this.isSearching = true;
    this.searchAborted = false;
    
    try {
      // IMPORTANT: All players must connect to the SAME lobby to be matched
      // Using a fixed 'QUEUE_LOBBY' ID so all players join the same Durable Object
      const queueId = 'QUEUE_LOBBY';
      
      // Connect to the matchmaking queue
      await this.client.connect(queueId, 'player-token');
      
      this.isMultiplayer = true;
      window.isMultiplayer = true;
      
      // Wait for match to be found (handled by server)
      // The server will pair players and send GAME_START event
      return new Promise((resolve, reject) => {
        let abortCheckInterval = null;
        
        // Set up match found handler
        const originalGameStart = this.client.onGameStart;
        this.client.onGameStart = (data) => {
          console.log('[Matchmaking] Game start received:', data);
          this.isSearching = false;
          this.matchId = data.matchId;
          
          // Clear abort checker
          if (abortCheckInterval) clearInterval(abortCheckInterval);
          
          // Restore original handler
          this.client.onGameStart = originalGameStart;
          
          resolve({
            success: true,
            matchId: data.matchId,
            role: data.yourRole || data.role,
            yourRole: data.yourRole || data.role
          });
          
          // Also call original handler
          if (originalGameStart) originalGameStart(data);
        };
        
        // Set up error/abort handling
        this.client.onError = (error) => {
          console.error('[Matchmaking] Error:', error);
          if (!this.searchAborted) {
            this.isSearching = false;
            if (abortCheckInterval) clearInterval(abortCheckInterval);
            reject(new Error(error.message || 'Connection error'));
          }
        };
        
        // Check for abort periodically
        abortCheckInterval = setInterval(() => {
          if (this.searchAborted) {
            clearInterval(abortCheckInterval);
            this.isSearching = false;
            reject(new Error('Search cancelled'));
          }
        }, 100);
        
        // Timeout after 5 minutes
        setTimeout(() => {
          if (this.isSearching && !this.searchAborted) {
            if (abortCheckInterval) clearInterval(abortCheckInterval);
            this.isSearching = false;
            this.client.disconnect();
            reject(new Error('Matchmaking timed out. Please try again.'));
          }
        }, 5 * 60 * 1000);
      });
      
    } catch (error) {
      this.isSearching = false;
      console.error('Failed to find match:', error);
      throw error;
    }
  },
  
  /**
   * Cancel matchmaking search
   */
  cancelSearch() {
    console.log('[MP] Cancelling search...');
    this.searchAborted = true;
    this.isSearching = false;
    
    if (this.client) {
      this.client.disconnect();
    }
    
    this.isMultiplayer = false;
    window.isMultiplayer = false;
  },
  
  /**
   * Connect to the actual game room after matchmaking
   */
  async connectToGameRoom(matchId) {
    console.log('[MP] Connecting to game room:', matchId);
    
    if (!this.client) this.init();
    
    // Disconnect from lobby if still connected
    this.client.disconnect();
    
    // Small delay to ensure clean disconnect
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Connect to the game room
    await this.client.connect(matchId, 'player-token');
    
    this.matchId = matchId;
    this.isMultiplayer = true;
    window.isMultiplayer = true;
    
    console.log('[MP] Connected to game room:', matchId);
  },
  
  /**
   * Send deck selection to server
   */
  sendDeckSelected(deckData) {
    console.log('[MP] Sending deck selection:', deckData);
    
    if (this.client && this.client.socket) {
      this.client.socket.send(JSON.stringify({
        type: 'DECK_SELECTED',
        deck: deckData
      }));
    }
  },
  
  /**
   * Create a new match (host)
   */
  async createMatch() {
    if (!this.client) this.init();
    
    try {
      // Generate a random match ID
      this.matchId = this.generateMatchId();
      
      // Connect to the match room
      await this.client.connect(this.matchId, 'player-token');
      
      this.isMultiplayer = true;
      window.isMultiplayer = true;
      
      return {
        success: true,
        matchId: this.matchId,
        matchCode: this.matchId
      };
    } catch (error) {
      console.error('Failed to create match:', error);
      throw error;
    }
  },
  
  /**
   * Join an existing match
   */
  async joinMatch(matchId) {
    if (!this.client) this.init();
    
    try {
      this.matchId = matchId.toUpperCase();
      
      // Connect to the match room
      await this.client.connect(this.matchId, 'player-token');
      
      this.isMultiplayer = true;
      window.isMultiplayer = true;
      
      // Wait for game to start (server pairs players)
      return new Promise((resolve, reject) => {
        // Set up match found handler
        const originalGameStart = this.client.onGameStart;
        this.client.onGameStart = (data) => {
          // Restore original handler
          this.client.onGameStart = originalGameStart;
          
          resolve({
            success: true,
            matchId: this.matchId,
            role: data.yourRole
          });
          
          // Also call original handler
          if (originalGameStart) originalGameStart(data);
        };
        
        // Set up error handling
        this.client.onError = (error) => {
          reject(new Error(error.message || 'Failed to join match'));
        };
        
        // Timeout after 30 seconds
        setTimeout(() => {
          reject(new Error('Connection timed out. Room may not exist.'));
        }, 30000);
      });
      
    } catch (error) {
      console.error('Failed to join match:', error);
      throw error;
    }
  },
  
  /**
   * Generate a 6-character match ID
   */
  generateMatchId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars (I, O, 0, 1)
    let id = '';
    for (let i = 0; i < 6; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  },
  
  // ==================== EVENT HANDLERS ====================
  
  handleGameStart(data) {
    console.log('[MP] Game started!', data);
    
    // Hide waiting UI
    this.hideWaitingUI();
    
    // Initialize the game with server state
    if (typeof initMultiplayerGame === 'function') {
      initMultiplayerGame(data.yourRole, data.initialState);
    }
    
    // Show who goes first
    const firstMessage = data.firstPlayer === 'you' ? "You go first!" : "Opponent goes first!";
    showMessage(firstMessage, 2000);
  },
  
  handleGameEnd(data) {
    console.log('[MP] Game ended!', data);
    
    this.isMultiplayer = false;
    
    // Show results screen
    if (typeof showResultsScreen === 'function') {
      showResultsScreen({
        isWin: data.isWin,
        reason: data.reason,
        stats: data.stats,
        isMultiplayer: true
      });
    } else {
      showMessage(data.isWin ? "Victory!" : "Defeat!", 5000);
    }
  },
  
  handleTurnChange(isMyTurn) {
    console.log('[MP] Turn changed, my turn:', isMyTurn);
    
    // Update UI to show whose turn
    if (typeof updateTurnIndicator === 'function') {
      updateTurnIndicator(isMyTurn);
    }
    
    // Enable/disable controls
    this.setControlsEnabled(isMyTurn);
  },
  
  handleActionRejected(data) {
    console.warn('[MP] Action rejected:', data.reason);
    // Message is already shown by MultiplayerClient
  },
  
  handleConnectionChange(connected) {
    console.log('[MP] Connection:', connected ? 'connected' : 'disconnected');
    
    if (!connected && this.isMultiplayer) {
      // Show reconnecting UI (handled by MultiplayerClient)
    }
  },
  
  handleOpponentDisconnect(disconnected, reconnectWindow) {
    if (disconnected) {
      showMessage(`Opponent disconnected. Waiting ${reconnectWindow/1000}s for reconnection...`, 5000);
    } else {
      showMessage('Opponent reconnected!', 2000);
    }
  },
  
  // ==================== ACTION WRAPPERS ====================
  // These replace direct game.xxx() calls in multiplayer mode
  
  summonCryptid(cardId, col, row) {
    if (!this.isMultiplayer) {
      // Single player - use existing logic
      return;
    }
    this.client.summonCryptid(cardId, col, row);
  },
  
  summonKindling(cardId, col, row) {
    if (!this.isMultiplayer) return;
    this.client.summonKindling(cardId, col, row);
  },
  
  attack(attackerCol, attackerRow, targetCol, targetRow) {
    if (!this.isMultiplayer) return;
    this.client.attack(attackerCol, attackerRow, targetCol, targetRow);
  },
  
  playBurst(cardId, targets) {
    if (!this.isMultiplayer) return;
    this.client.playBurst(cardId, targets);
  },
  
  playTrap(cardId, slotRow) {
    if (!this.isMultiplayer) return;
    this.client.playTrap(cardId, slotRow);
  },
  
  evolveCryptid(evolutionCardId, baseCol, baseRow) {
    if (!this.isMultiplayer) return;
    this.client.evolveCryptid(evolutionCardId, baseCol, baseRow);
  },
  
  useAbility(col, row, abilityId, targets) {
    if (!this.isMultiplayer) return;
    this.client.useAbility(col, row, abilityId, targets);
  },
  
  pyreBurn() {
    if (!this.isMultiplayer) return;
    this.client.pyreBurn();
  },
  
  endConjure1() {
    if (!this.isMultiplayer) return;
    this.client.endConjure1();
  },
  
  endCombat() {
    if (!this.isMultiplayer) return;
    this.client.endCombat();
  },
  
  endTurn() {
    if (!this.isMultiplayer) return;
    this.client.endTurn();
  },
  
  concede() {
    if (!this.isMultiplayer) return;
    if (confirm('Are you sure you want to concede?')) {
      this.client.concede();
    }
  },
  
  // ==================== UI HELPERS ====================
  
  setControlsEnabled(enabled) {
    const controls = document.querySelectorAll('.player-control, .end-turn-btn, .pyre-burn-btn');
    controls.forEach(el => {
      el.classList.toggle('disabled', !enabled);
      el.style.pointerEvents = enabled ? 'auto' : 'none';
    });
    
    // Also disable hand cards when not your turn
    const handCards = document.querySelectorAll('.hand-card');
    handCards.forEach(card => {
      card.classList.toggle('not-your-turn', !enabled);
    });
  },
  
  showMatchIdUI(matchId) {
    // Create a simple UI to show the match code
    let overlay = document.getElementById('mp-match-id-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'mp-match-id-overlay';
      overlay.innerHTML = `
        <div class="mp-match-id-content">
          <h2>Match Created!</h2>
          <p>Share this code with your opponent:</p>
          <div class="mp-match-code">${matchId}</div>
          <button onclick="navigator.clipboard.writeText('${matchId}'); this.textContent='Copied!';">
            Copy Code
          </button>
          <p class="mp-waiting">Waiting for opponent to join...</p>
        </div>
      `;
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
      `;
      document.body.appendChild(overlay);
    }
    overlay.querySelector('.mp-match-code').textContent = matchId;
    overlay.style.display = 'flex';
    
    // Add styles if not already added
    if (!document.getElementById('mp-styles')) {
      const style = document.createElement('style');
      style.id = 'mp-styles';
      style.textContent = `
        .mp-match-id-content {
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          padding: 40px;
          border-radius: 15px;
          text-align: center;
          color: white;
          font-family: 'Segoe UI', sans-serif;
          box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        }
        .mp-match-id-content h2 {
          margin: 0 0 20px 0;
          color: #f39c12;
        }
        .mp-match-code {
          font-size: 48px;
          font-weight: bold;
          letter-spacing: 8px;
          background: #2c3e50;
          padding: 20px 40px;
          border-radius: 10px;
          margin: 20px 0;
          font-family: monospace;
          color: #3498db;
        }
        .mp-match-id-content button {
          background: #3498db;
          border: none;
          color: white;
          padding: 12px 30px;
          font-size: 16px;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.3s;
        }
        .mp-match-id-content button:hover {
          background: #2980b9;
        }
        .mp-waiting {
          margin-top: 20px;
          color: #95a5a6;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .mp-join-content {
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          padding: 40px;
          border-radius: 15px;
          text-align: center;
          color: white;
          font-family: 'Segoe UI', sans-serif;
        }
        .mp-join-content input {
          font-size: 32px;
          letter-spacing: 6px;
          text-transform: uppercase;
          text-align: center;
          padding: 15px;
          width: 200px;
          border: 2px solid #3498db;
          border-radius: 8px;
          background: #2c3e50;
          color: white;
          margin: 20px 0;
        }
        .mp-join-content input:focus {
          outline: none;
          border-color: #f39c12;
        }
        .not-your-turn {
          filter: grayscale(50%);
          opacity: 0.7;
        }
      `;
      document.head.appendChild(style);
    }
  },
  
  hideWaitingUI() {
    const overlay = document.getElementById('mp-match-id-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
  },
  
  showJoinMatchUI() {
    let overlay = document.getElementById('mp-join-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'mp-join-overlay';
      overlay.innerHTML = `
        <div class="mp-join-content">
          <h2>Join Match</h2>
          <p>Enter the match code:</p>
          <input type="text" id="mp-join-code" maxlength="6" placeholder="ABC123">
          <br>
          <button onclick="MultiplayerManager.submitJoinCode()">Join</button>
          <button onclick="document.getElementById('mp-join-overlay').style.display='none'" style="background:#7f8c8d;margin-left:10px;">Cancel</button>
        </div>
      `;
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
      `;
      document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';
    document.getElementById('mp-join-code').value = '';
    document.getElementById('mp-join-code').focus();
  },
  
  submitJoinCode() {
    const code = document.getElementById('mp-join-code').value.trim().toUpperCase();
    if (code.length !== 6) {
      showMessage('Please enter a 6-character code', 2000);
      return;
    }
    
    document.getElementById('mp-join-overlay').style.display = 'none';
    this.joinMatch(code);
  }
};

// ==================== HELPER FUNCTION ====================
// Override for multiplayer when active

window.mpAction = function(actionType, ...args) {
  if (window.isMultiplayer && MultiplayerManager.client) {
    switch (actionType) {
      case 'summon':
        MultiplayerManager.summonCryptid(...args);
        break;
      case 'kindling':
        MultiplayerManager.summonKindling(...args);
        break;
      case 'attack':
        MultiplayerManager.attack(...args);
        break;
      case 'endConjure1':
        MultiplayerManager.endConjure1();
        break;
      case 'endCombat':
        MultiplayerManager.endCombat();
        break;
      case 'endTurn':
        MultiplayerManager.endTurn();
        break;
      case 'pyreBurn':
        MultiplayerManager.pyreBurn();
        break;
    }
    return true; // Handled by multiplayer
  }
  return false; // Use single-player logic
};

console.log('[Multiplayer Integration] Loaded. Use MultiplayerManager.createMatch() or MultiplayerManager.joinMatch(code)');
