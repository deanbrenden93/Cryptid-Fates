/**
 * Cryptid Fates - Game Flow Controller (Offline Roguelite Version)
 * 
 * Flow: Asset Loading → Name Entry (if new) → Welcome → Home Screen
 * No login required - all data stored locally
 */

// ==================== OFFLINE PLAYER IDENTITY ====================

const OfflinePlayer = {
    /**
     * Get or create a local player identity
     */
    getPlayerName() {
        return localStorage.getItem('cryptid_player_name') || 'Summoner';
    },
    
    setPlayerName(name) {
        localStorage.setItem('cryptid_player_name', name);
        if (typeof PlayerData !== 'undefined') {
            PlayerData.playerName = name;
            PlayerData.save();
        }
    },
    
    hasSetName() {
        return localStorage.getItem('cryptid_name_set') === 'true';
    },
    
    markNameSet() {
        localStorage.setItem('cryptid_name_set', 'true');
    }
};

window.OfflinePlayer = OfflinePlayer;

// ==================== GAME FLOW CONTROLLER ====================

const GameFlow = {
    currentStep: null,
    
    /**
     * Start the game flow - called after DOM is ready
     */
    async start() {
        console.log('[GameFlow] Starting offline game...');
        
        // Set offline mode flag
        window.isOfflineMode = true;
        
        // Preload all game assets with smart caching
        if (typeof AssetPreloader !== 'undefined') {
            await AssetPreloader.preload();
        } else {
            this.showLoadingScreen();
        }
        
        // Continue to game flow
        await this.onGameReady();
    },
    
    /**
     * Called when assets are loaded and game is ready
     */
    async onGameReady() {
        console.log('[GameFlow] Game ready');
        
        // Hide preloader
        if (typeof AssetPreloader !== 'undefined') {
            await AssetPreloader.hideLoadingScreen();
        } else {
            this.hideLoadingScreen();
        }
        
        // Check if this is a new player who needs to set username
        const isNewPlayer = !OfflinePlayer.hasSetName();
        
        if (isNewPlayer) {
            await this.showUsernameEntry();
        }
        
        // Go directly to welcome/deck select screen (tutorial can be accessed from Help menu)
        this.showWelcomeScreen();
    },
    
    /**
     * Show loading screen
     */
    showLoadingScreen() {
        if (document.getElementById('loading-screen')) return;
        
        const loading = document.createElement('div');
        loading.id = 'loading-screen';
        loading.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <p>Loading...</p>
            </div>
        `;
        document.body.appendChild(loading);
    },
    
    /**
     * Hide loading screen
     */
    hideLoadingScreen() {
        const loading = document.getElementById('loading-screen');
        if (loading) loading.remove();
    },
    
    /**
     * Show username entry screen
     */
    showUsernameEntry() {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.id = 'username-entry-screen';
            overlay.innerHTML = `
                <div class="username-container">
                    <h2>Name Thyself</h2>
                    <p>How shall you be known, Summoner?</p>
                    
                    <div class="username-input-wrapper">
                        <input type="text" 
                               id="username-input" 
                               maxlength="24" 
                               placeholder="Enter your name..."
                               value="${OfflinePlayer.getPlayerName()}"
                        >
                        <span class="char-count"><span id="char-current">0</span>/24</span>
                    </div>
                    
                    <button id="username-confirm-btn" class="confirm-btn">
                        Confirm
                    </button>
                </div>
            `;
            
            document.body.appendChild(overlay);
            
            const input = document.getElementById('username-input');
            const charCount = document.getElementById('char-current');
            const confirmBtn = document.getElementById('username-confirm-btn');
            
            // Update character count
            charCount.textContent = input.value.length;
            input.addEventListener('input', () => {
                charCount.textContent = input.value.length;
            });
            
            // Focus input
            setTimeout(() => input.focus(), 100);
            
            // Handle confirm
            const confirm = async () => {
                const name = input.value.trim();
                if (name.length < 2) {
                    input.classList.add('error');
                    setTimeout(() => input.classList.remove('error'), 500);
                    return;
                }
                
                confirmBtn.disabled = true;
                confirmBtn.textContent = 'Saving...';
                
                // Save locally
                OfflinePlayer.setPlayerName(name);
                OfflinePlayer.markNameSet();
                
                // Also store in PlayerData if available
                if (typeof PlayerData !== 'undefined') {
                    PlayerData.playerName = name;
                    PlayerData.save();
                }
                
                // Remove overlay
                overlay.classList.add('fade-out');
                setTimeout(() => {
                    overlay.remove();
                    resolve();
                }, 300);
            };
            
            confirmBtn.addEventListener('click', confirm);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') confirm();
            });
            
            // Animate in
            requestAnimationFrame(() => overlay.classList.add('visible'));
        });
    },
    
    /**
     * Show tutorial (real tutorial battle)
     */
    showTutorial() {
        return new Promise((resolve) => {
            // Slide transition into tutorial battle
            TransitionEngine.slide(() => {
                // Hide other screens and show game container while covered
                ['main-menu', 'home-screen', 'loading-screen', 'fullscreen-prompt'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) {
                        el.style.transition = 'none';
                        el.style.display = 'none';
                        el.classList.add('hidden');
                    }
                });
                const gameContainer = document.getElementById('game-container');
                if (gameContainer) {
                    gameContainer.classList.remove('hidden');
                    gameContainer.style.cssText = 'display: flex !important; visibility: visible !important; opacity: 1 !important;';
                }
                // Apply battlefield backgrounds while covered
                if (typeof applyBattlefieldBackgrounds === 'function') {
                    applyBattlefieldBackgrounds();
                }
            }).then(() => {
                TutorialManager.start();
            });
            
            // Listen for tutorial completion
            const checkComplete = setInterval(() => {
                if (!TutorialManager.isActive) {
                    clearInterval(checkComplete);
                    resolve();
                }
            }, 500);
        });
    },
    
    /**
     * Show welcome/deck select screen
     */
    showWelcomeScreen() {
        console.log('[GameFlow] Showing welcome screen');
        
        TransitionEngine.fade(() => {
            if (typeof HomeScreen !== 'undefined') {
                HomeScreen.init();
            } else {
                this.showMainMenu();
            }
        });
    },
    
    /**
     * Show main menu
     */
    showMainMenu() {
        console.log('[GameFlow] Showing main menu');
        
        if (typeof MainMenu !== 'undefined') {
            MainMenu.init();
            MainMenu.show();
        }
        
        // Show user profile bar
        UserProfileBar.update();
    }
};

// ==================== CSS STYLES ====================

const loginStyles = `
/* Loading Screen */
#loading-screen {
    position: fixed;
    inset: 0;
    background: #030201;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10001;
}

.loading-content {
    text-align: center;
    color: #ff9050;
    position: relative;
    z-index: 1;
    font-family: 'Cinzel', serif;
}

.loading-spinner {
    width: 60px;
    height: 60px;
    border: 3px solid rgba(255, 100, 30, 0.1);
    border-top-color: #ff6020;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto 20px;
    box-shadow: 
        0 0 30px rgba(255, 80, 20, 0.4),
        inset 0 0 20px rgba(255, 100, 30, 0.1);
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

/* ==================== USERNAME ENTRY SCREEN ==================== */
#username-entry-screen {
    position: fixed;
    inset: 0;
    background: #030201;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    opacity: 0;
    transition: opacity 0.5s ease;
    padding: clamp(12px, 3vw, 24px);
    overflow: hidden;
}

#username-entry-screen.visible {
    opacity: 1;
}

#username-entry-screen.fade-out {
    opacity: 0;
}

.username-container {
    position: relative;
    text-align: center;
    max-width: 420px;
    width: 100%;
    z-index: 10;
}

.username-container h2 {
    font-family: 'Cinzel', serif;
    color: #fff;
    font-size: clamp(20px, 5vmin, 36px);
    letter-spacing: 4px;
    margin: 0 0 12px;
    text-shadow: 
        0 0 10px rgba(255, 150, 80, 0.8),
        0 0 30px rgba(255, 100, 40, 0.5),
        0 4px 8px rgba(0, 0, 0, 0.9);
    text-transform: uppercase;
}

.username-container p {
    color: #8a6a4a;
    margin: 0 0 clamp(20px, 4vh, 36px);
    font-size: clamp(12px, 2.5vmin, 15px);
    letter-spacing: 1px;
}

.username-input-wrapper {
    position: relative;
    margin-bottom: clamp(20px, 4vh, 32px);
}

#username-input {
    width: 100%;
    padding: clamp(14px, 3vh, 20px) clamp(50px, 12vw, 80px) clamp(14px, 3vh, 20px) clamp(20px, 4vw, 30px);
    font-family: 'Cinzel', serif;
    font-size: clamp(15px, 3.5vmin, 20px);
    letter-spacing: 3px;
    background: rgba(20, 10, 5, 0.9);
    border: 2px solid rgba(255, 120, 40, 0.25);
    color: #ffd0a0;
    text-align: center;
    outline: none;
    transition: all 0.3s;
    box-sizing: border-box;
    clip-path: polygon(
        8px 0%, calc(100% - 8px) 0%, 100% 8px, 100% calc(100% - 8px),
        calc(100% - 8px) 100%, 8px 100%, 0% calc(100% - 8px), 0% 8px
    );
    box-shadow: 
        inset 0 4px 16px rgba(0, 0, 0, 0.6),
        0 0 30px rgba(255, 80, 20, 0.1);
}

#username-input::placeholder {
    color: #5a4030;
}

#username-input:focus {
    border-color: rgba(255, 120, 40, 0.5);
    box-shadow: 
        inset 0 4px 16px rgba(0, 0, 0, 0.6),
        0 0 40px rgba(255, 100, 30, 0.25),
        0 0 80px rgba(255, 80, 20, 0.15);
}

#username-input.error {
    border-color: rgba(255, 60, 60, 0.6);
    animation: shake 0.3s ease;
}

@keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-8px); }
    75% { transform: translateX(8px); }
}

.char-count {
    position: absolute;
    right: clamp(14px, 3vw, 22px);
    top: 50%;
    transform: translateY(-50%);
    color: #5a4030;
    font-size: clamp(10px, 2vmin, 13px);
    letter-spacing: 1px;
    font-family: 'Source Sans Pro', sans-serif;
}

/* Confirm button - Ember Blaze style */
.confirm-btn {
    position: relative;
    background: linear-gradient(
        180deg,
        #b85020 0%,
        #943818 30%,
        #702810 70%,
        #501808 100%
    );
    border: none;
    color: #ffeedd;
    padding: clamp(14px, 3vh, 20px) clamp(40px, 8vw, 60px);
    font-family: 'Cinzel', serif;
    font-size: clamp(13px, 2.8vmin, 17px);
    font-weight: 700;
    letter-spacing: 3px;
    text-transform: uppercase;
    cursor: pointer;
    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    clip-path: polygon(
        8px 0%, calc(100% - 8px) 0%, 100% 8px, 100% calc(100% - 8px),
        calc(100% - 8px) 100%, 8px 100%, 0% calc(100% - 8px), 0% 8px
    );
    box-shadow: 
        0 8px 32px rgba(0, 0, 0, 0.8),
        0 0 60px rgba(255, 80, 20, 0.3),
        inset 0 1px 0 rgba(255, 200, 150, 0.3);
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8), 0 0 20px rgba(255, 150, 80, 0.5);
}

.confirm-btn::before {
    content: '';
    position: absolute;
    inset: 0;
    padding: 2px;
    background: linear-gradient(
        180deg,
        rgba(255, 180, 100, 0.6),
        rgba(200, 100, 50, 0.3),
        rgba(150, 60, 30, 0.4),
        rgba(255, 180, 100, 0.6)
    );
    clip-path: polygon(
        8px 0%, calc(100% - 8px) 0%, 100% 8px, 100% calc(100% - 8px),
        calc(100% - 8px) 100%, 8px 100%, 0% calc(100% - 8px), 0% 8px
    );
    -webkit-mask: 
        linear-gradient(#fff 0 0) content-box, 
        linear-gradient(#fff 0 0);
    mask: 
        linear-gradient(#fff 0 0) content-box, 
        linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    pointer-events: none;
}

.confirm-btn:hover {
    transform: translateY(-4px) scale(1.03);
    box-shadow: 
        0 12px 48px rgba(0, 0, 0, 0.9),
        0 0 80px rgba(255, 80, 20, 0.5),
        0 0 120px rgba(255, 60, 10, 0.3),
        inset 0 1px 0 rgba(255, 200, 150, 0.4);
}

.confirm-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
}

/* ==================== USER PROFILE BAR ==================== */
.user-profile-bar {
    display: flex;
    align-items: center;
    gap: clamp(10px, 2vw, 14px);
    padding: clamp(8px, 1.5vh, 12px) clamp(14px, 2.5vw, 20px);
    background: linear-gradient(180deg, rgba(30, 15, 8, 0.95) 0%, rgba(15, 8, 4, 0.98) 100%);
    border: 1px solid rgba(255, 120, 40, 0.2);
    position: absolute;
    top: clamp(10px, 2vh, 18px);
    right: clamp(10px, 2vw, 18px);
    z-index: 100;
    clip-path: polygon(
        10px 0%, calc(100% - 10px) 0%, 100% 10px, 100% calc(100% - 10px),
        calc(100% - 10px) 100%, 10px 100%, 0% calc(100% - 10px), 0% 10px
    );
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.7);
}

.user-avatar {
    width: clamp(28px, 5.5vmin, 40px);
    height: clamp(28px, 5.5vmin, 40px);
    border-radius: 50%;
    border: 2px solid rgba(255, 120, 40, 0.4);
    object-fit: cover;
    box-shadow: 0 0 15px rgba(255, 80, 20, 0.3);
}

.user-avatar.placeholder {
    background: linear-gradient(135deg, rgba(255, 100, 30, 0.4), rgba(180, 50, 20, 0.4));
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Cinzel', serif;
    font-size: clamp(11px, 2.5vmin, 15px);
    color: #ffd0a0;
    font-weight: bold;
}

.user-name {
    font-family: 'Cinzel', serif;
    font-size: clamp(11px, 2.5vmin, 15px);
    font-weight: 600;
    color: #ffd0a0;
    letter-spacing: 1px;
}

.user-stats {
    font-size: clamp(9px, 2vmin, 12px);
    color: #8a6a4a;
    letter-spacing: 0.5px;
}
`;

// Inject styles
const styleSheet = document.createElement('style');
styleSheet.textContent = loginStyles;
document.head.appendChild(styleSheet);

// ==================== USER PROFILE BAR ====================

const UserProfileBar = {
    element: null,
    
    create() {
        if (this.element) return;
        
        this.element = document.createElement('div');
        this.element.className = 'user-profile-bar';
        
        const playerName = OfflinePlayer.getPlayerName();
        this.element.innerHTML = `
            <div class="user-avatar placeholder">${playerName.charAt(0).toUpperCase()}</div>
            <div>
                <div class="user-name">${playerName}</div>
                <div class="user-stats">Offline Mode</div>
            </div>
        `;
        
        document.body.appendChild(this.element);
    },
    
    remove() {
        if (this.element) {
            this.element.remove();
            this.element = null;
        }
    },
    
    update() {
        this.remove();
        this.create();
    }
};

// ==================== INITIALIZATION ====================

// Make available globally
window.GameFlow = GameFlow;
window.UserProfileBar = UserProfileBar;

// Legacy compatibility - create stub Auth object for any code that still references it
window.Auth = {
    isAuthenticated: false,
    isLoading: false,
    user: null,
    async init() { return false; },
    getToken() { return null; },
    getUserId() { return 'local_player'; },
    getDisplayName() { return OfflinePlayer.getPlayerName(); },
    getAvatarUrl() { return null; },
    getStatsString() { 
        if (typeof PlayerData !== 'undefined') {
            const wins = PlayerData.stats?.wins || 0;
            const losses = PlayerData.stats?.losses || 0;
            return `${wins}W - ${losses}L`;
        }
        return '0W - 0L';
    }
};
