/**
 * Cryptid Fates - Login Screen UI & Game Flow Controller
 * 
 * Flow: Auth Check → Login → Username Entry → Tutorial → Welcome → Main Menu
 */

// ==================== GAME FLOW CONTROLLER ====================

const GameFlow = {
    currentStep: null,
    
    /**
     * Start the game flow - called after DOM is ready
     */
    async start() {
        console.log('[GameFlow] Starting...');
        
        // Show loading screen
        this.showLoadingScreen();
        
        // Check authentication
        const isAuthenticated = await Auth.init();
        
        console.log('[GameFlow] Auth result:', isAuthenticated);
        
        if (isAuthenticated) {
            // User is logged in - continue flow
            await this.onAuthenticated();
        } else if (window.isOfflineMode) {
            // User chose offline mode
            await this.onOfflineMode();
        } else {
            // Show login screen and wait
            this.hideLoadingScreen();
            LoginScreen.show();
        }
    },
    
    /**
     * Called when user successfully authenticates
     */
    async onAuthenticated() {
        console.log('[GameFlow] User authenticated:', Auth.user?.displayName);
        
        this.hideLoadingScreen();
        LoginScreen.hide();
        
        // Check if this is a new user (no custom name set yet)
        const isNewUser = this.checkIfNewUser();
        
        if (isNewUser) {
            await this.showUsernameEntry();
        }
        
        // Check if user has completed tutorial
        const hasCompletedTutorial = (typeof TutorialManager !== 'undefined' && TutorialManager.isCompleted()) ||
                                     (typeof PlayerData !== 'undefined' && PlayerData.tutorialCompleted) ||
                                     localStorage.getItem('cryptid_tutorial_complete');
        
        if (!hasCompletedTutorial) {
            await this.showTutorial();
        }
        
        // Continue to welcome/deck select
        this.showWelcomeScreen();
    },
    
    /**
     * Called when user chooses offline mode
     */
    async onOfflineMode() {
        console.log('[GameFlow] Offline mode');
        
        // Clean up any active tutorial battle screen first
        if (typeof TutorialManager !== 'undefined' && TutorialManager.isActive) {
            console.log('[GameFlow] Cleaning up active tutorial');
            TutorialManager.cleanupBattleScreen();
            TutorialManager.isActive = false;
            if (typeof TutorialOverlay !== 'undefined') {
                TutorialOverlay.destroy();
            }
        }
        
        this.hideLoadingScreen();
        LoginScreen.hide();
        
        // Check if user has completed tutorial
        const hasCompletedTutorial = (typeof TutorialManager !== 'undefined' && TutorialManager.isCompleted()) ||
                                     (typeof PlayerData !== 'undefined' && PlayerData.tutorialCompleted) ||
                                     localStorage.getItem('cryptid_tutorial_complete');
        
        if (!hasCompletedTutorial) {
            await this.showTutorial();
        }
        
        // Continue to welcome/deck select
        this.showWelcomeScreen();
    },
    
    /**
     * Check if user needs to set a username
     */
    checkIfNewUser() {
        // If user has a generic name from OAuth, prompt them to customize
        const name = Auth.user?.displayName || '';
        // Check if they've customized before
        const hasSetName = localStorage.getItem('cryptid_name_set');
        return !hasSetName;
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
                               value="${Auth.user?.displayName || ''}"
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
                
                try {
                    // Save to server if authenticated
                    if (Auth.isAuthenticated) {
                        await Auth.updateDisplayName(name);
                    }
                    
                    // Mark that user has set their name
                    localStorage.setItem('cryptid_name_set', 'true');
                    
                    // Also store locally for offline
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
                    
                } catch (err) {
                    console.error('Failed to save name:', err);
                    confirmBtn.disabled = false;
                    confirmBtn.textContent = 'Confirm';
                }
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
            // Start the actual tutorial battle
            TutorialManager.start();
            
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
        
        // Initialize and show HomeScreen (deck select / welcome)
        if (typeof HomeScreen !== 'undefined') {
            HomeScreen.init();
        } else {
            // Fallback - go straight to main menu
            this.showMainMenu();
        }
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

// ==================== LOGIN SCREEN COMPONENT ====================

const LoginScreen = {
    isVisible: false,
    
    /**
     * Create and show the login screen
     */
    show() {
        if (this.isVisible) return;
        this.isVisible = true;
        
        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'login-screen';
        overlay.innerHTML = `
            <div class="login-container">
                <div class="login-logo">
                    <img src="sprites/New Logo.png" alt="Cryptid Fates" class="login-logo-img">
                </div>
                
                <div class="login-box">
                    <h2>Welcome, Summoner</h2>
                    <p class="login-prompt">Sign in to begin your journey</p>
                    
                    <div class="login-buttons">
                        <button class="login-btn google-btn" onclick="Auth.loginWithGoogle()">
                            <svg class="login-icon" viewBox="0 0 24 24">
                                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                            Google
                        </button>
                        
                        <button class="login-btn discord-btn" onclick="Auth.loginWithDiscord()">
                            <svg class="login-icon" viewBox="0 0 24 24">
                                <path fill="currentColor" d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                            </svg>
                            Discord
                        </button>
                    </div>
                </div>
                
                <div class="login-features">
                    <div class="feature">
                        <span class="feature-icon">⚔️</span>
                        <span>Battle other players online</span>
                    </div>
                    <div class="feature">
                        <span class="feature-icon">🏆</span>
                        <span>Climb the ranked ladder</span>
                    </div>
                    <div class="feature">
                        <span class="feature-icon">📊</span>
                        <span>Track your wins and progress</span>
                    </div>
                </div>
                
                <div class="login-bottom-btns">
                    <button class="skip-login-btn" onclick="LoginScreen.playOffline()">
                        ⚡ Play Offline vs AI
                    </button>
                    
                    <button class="skip-login-btn dev-tutorial-btn" onclick="LoginScreen.startTutorial()">
                        📖 Dev: Start Tutorial
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        // Animate in
        requestAnimationFrame(() => {
            overlay.classList.add('visible');
        });
    },
    
    /**
     * Start tutorial directly (dev bypass)
     */
    async startTutorial() {
        console.log('[LoginScreen] Starting tutorial bypass...');
        this.hide();
        
        // Hide other screens
        ['main-menu', 'home-screen', 'loading-screen', 'fullscreen-prompt'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.style.display = 'none';
                el.classList.add('hidden');
            }
        });
        
        // Start tutorial
        if (typeof TutorialManager !== 'undefined') {
            await TutorialManager.start();
        } else {
            console.error('[LoginScreen] TutorialManager not found');
        }
    },
    
    /**
     * Hide the login screen
     */
    hide() {
        const overlay = document.getElementById('login-screen');
        if (!overlay) return;
        
        overlay.classList.remove('visible');
        
        setTimeout(() => {
            overlay.remove();
            this.isVisible = false;
        }, 300);
    },
    
    /**
     * Play offline without logging in
     */
    playOffline() {
        window.isOfflineMode = true;
        this.hide();
        GameFlow.onOfflineMode();
    }
};

// ==================== CSS STYLES ====================

const loginStyles = `
/* Loading Screen */
#loading-screen {
    position: fixed;
    inset: 0;
    background: 
        radial-gradient(ellipse at 50% 20%, rgba(232, 169, 62, 0.15) 0%, transparent 50%),
        radial-gradient(ellipse at 20% 80%, rgba(107, 28, 28, 0.2) 0%, transparent 40%),
        radial-gradient(ellipse at 80% 80%, rgba(107, 28, 28, 0.2) 0%, transparent 40%),
        linear-gradient(180deg, #0a0d12 0%, #151a1f 40%, #1a1510 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10001;
}

#loading-screen::before {
    content: '';
    position: absolute;
    inset: 0;
    background: url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.06'/%3E%3C/svg%3E");
    pointer-events: none;
    mix-blend-mode: overlay;
}

.loading-content {
    text-align: center;
    color: #a09080;
    position: relative;
    z-index: 1;
}

.loading-spinner {
    width: clamp(35px, 8vw, 50px);
    height: clamp(35px, 8vw, 50px);
    border: 3px solid rgba(232, 169, 62, 0.2);
    border-top-color: #e8a93e;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto clamp(10px, 2vh, 15px);
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

/* Login Screen */
#login-screen {
    position: fixed;
    inset: 0;
    background: 
        radial-gradient(ellipse at 50% 20%, rgba(232, 169, 62, 0.15) 0%, transparent 50%),
        radial-gradient(ellipse at 20% 80%, rgba(107, 28, 28, 0.2) 0%, transparent 40%),
        radial-gradient(ellipse at 80% 80%, rgba(107, 28, 28, 0.2) 0%, transparent 40%),
        linear-gradient(180deg, #0a0d12 0%, #151a1f 40%, #1a1510 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    opacity: 0;
    transition: opacity 0.6s ease;
    padding: clamp(16px, 4vmin, 32px);
    overflow-y: auto;
    overflow-x: hidden;
}

#login-screen.visible {
    opacity: 1;
}

#login-screen::before {
    content: '';
    position: absolute;
    inset: 0;
    background: url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.06'/%3E%3C/svg%3E");
    pointer-events: none;
    mix-blend-mode: overlay;
}

/* Default: Vertical column layout (portrait & desktop) */
.login-container {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(16px, 4vmin, 28px);
    max-width: 400px;
    width: 100%;
    z-index: 1;
}

.login-logo {
    text-align: center;
    flex-shrink: 0;
}

/* The main logo image - HERO element */
.login-logo-img {
    width: clamp(280px, 60vmin, 500px);
    height: auto;
    filter: drop-shadow(0 0 40px rgba(232, 169, 62, 0.3));
    animation: logoGlow 4s ease-in-out infinite;
}

@keyframes logoGlow {
    0%, 100% { 
        filter: drop-shadow(0 0 30px rgba(232, 169, 62, 0.3));
    }
    50% { 
        filter: drop-shadow(0 0 50px rgba(232, 169, 62, 0.5));
    }
}

.login-box {
    width: 100%;
    max-width: clamp(260px, 45vmin, 340px);
}

.login-box h2 {
    font-family: 'Cinzel', serif;
    margin: 0 0 clamp(4px, 1vmin, 6px);
    font-size: clamp(14px, 3vmin, 20px);
    color: #d4c4a0;
    text-align: center;
    letter-spacing: 2px;
}

.login-prompt {
    margin: 0 0 clamp(10px, 2vmin, 16px);
    color: #706050;
    text-align: center;
    font-size: clamp(10px, 2vmin, 13px);
    letter-spacing: 1px;
}

.login-buttons {
    display: flex;
    flex-direction: column;
    gap: clamp(8px, 1.5vmin, 12px);
}

.login-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(8px, 1.5vmin, 10px);
    padding: clamp(10px, 2vmin, 14px) clamp(16px, 3vmin, 24px);
    font-family: 'Cinzel', serif;
    font-size: clamp(11px, 2.2vmin, 14px);
    font-weight: 700;
    border: 2px solid;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s ease;
    text-transform: uppercase;
    letter-spacing: clamp(1px, 0.3vmin, 2px);
    position: relative;
    overflow: hidden;
    width: 100%;
}

.login-btn::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 50%;
    background: linear-gradient(180deg, rgba(255,255,255,0.15), transparent);
    pointer-events: none;
}

.login-icon {
    width: clamp(16px, 4vmin, 20px);
    height: clamp(16px, 4vmin, 20px);
    flex-shrink: 0;
}

.google-btn {
    background: linear-gradient(180deg, 
        rgba(220, 220, 230, 0.95) 0%, 
        rgba(180, 180, 195, 0.9) 20%,
        rgba(140, 140, 155, 0.85) 50%,
        rgba(100, 100, 115, 0.9) 80%,
        rgba(70, 70, 85, 0.95) 100%);
    border-color: rgba(255, 255, 255, 0.4);
    color: #151518;
    box-shadow: 
        0 0 60px rgba(200, 200, 220, 0.25),
        0 0 30px rgba(255, 255, 255, 0.1),
        0 4px 20px rgba(0, 0, 0, 0.5),
        inset 0 1px 0 rgba(255, 255, 255, 0.6),
        inset 0 -1px 0 rgba(0, 0, 0, 0.3);
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.4);
}

.google-btn:hover {
    transform: translateY(-3px) scale(1.02);
    box-shadow: 
        0 0 100px rgba(200, 200, 220, 0.4),
        0 0 50px rgba(255, 255, 255, 0.2),
        0 8px 30px rgba(0, 0, 0, 0.5),
        inset 0 1px 0 rgba(255, 255, 255, 0.7),
        inset 0 -1px 0 rgba(0, 0, 0, 0.3);
}

.discord-btn {
    background: linear-gradient(180deg, 
        rgba(88, 101, 242, 0.95) 0%, 
        rgba(71, 82, 196, 0.9) 50%,
        rgba(57, 66, 157, 0.95) 100%);
    border-color: rgba(130, 145, 255, 0.4);
    color: #fff;
    box-shadow: 
        0 0 40px rgba(88, 101, 242, 0.2),
        0 4px 20px rgba(0, 0, 0, 0.5),
        inset 0 1px 0 rgba(255, 255, 255, 0.2),
        inset 0 -1px 0 rgba(0, 0, 0, 0.3);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.discord-btn:hover {
    transform: translateY(-3px) scale(1.02);
    box-shadow: 
        0 0 60px rgba(88, 101, 242, 0.4),
        0 8px 30px rgba(0, 0, 0, 0.5),
        inset 0 1px 0 rgba(255, 255, 255, 0.3),
        inset 0 -1px 0 rgba(0, 0, 0, 0.3);
}

.login-divider {
    display: flex;
    align-items: center;
    gap: clamp(10px, 2vmin, 16px);
    margin: clamp(4px, 1vmin, 8px) 0;
    color: #504030;
    font-size: clamp(10px, 2vmin, 12px);
    letter-spacing: 2px;
}

.login-divider::before,
.login-divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(160, 144, 128, 0.3), transparent);
}

.login-features {
    display: flex;
    flex-direction: column;
    gap: clamp(8px, 1.5vmin, 12px);
    padding: clamp(14px, 3vmin, 20px);
    background: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
    border: 1px solid rgba(160, 144, 128, 0.1);
    width: 100%;
    max-width: 320px;
}

.feature {
    display: flex;
    align-items: center;
    gap: clamp(10px, 2vmin, 14px);
    font-size: clamp(12px, 2.8vmin, 14px);
    color: #908070;
    letter-spacing: 0.5px;
}

.feature-icon {
    font-size: clamp(16px, 3.5vmin, 20px);
    filter: grayscale(0.3);
    flex-shrink: 0;
}

/* Bottom buttons wrapper */
.login-bottom-btns {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(8px, 1.5vmin, 12px);
}

.skip-login-btn {
    background: transparent;
    border: 1px solid rgba(160, 144, 128, 0.2);
    color: #605040;
    padding: clamp(10px, 2vmin, 14px) clamp(20px, 4vmin, 28px);
    border-radius: 6px;
    font-family: 'Cinzel', serif;
    font-size: clamp(10px, 2.2vmin, 12px);
    letter-spacing: clamp(1px, 0.4vmin, 2px);
    text-transform: uppercase;
    cursor: pointer;
    transition: all 0.3s;
}

.skip-login-btn:hover {
    background: rgba(160, 144, 128, 0.05);
    color: #908070;
    border-color: rgba(160, 144, 128, 0.3);
}

.dev-tutorial-btn {
    border-color: rgba(100, 180, 100, 0.3);
    color: #4a7a4a;
}

.dev-tutorial-btn:hover {
    background: rgba(100, 180, 100, 0.1);
    color: #6a9a6a;
    border-color: rgba(100, 180, 100, 0.5);
}

/* Username Entry Screen */
#username-entry-screen {
    position: fixed;
    inset: 0;
    background: 
        radial-gradient(ellipse at 50% 20%, rgba(232, 169, 62, 0.15) 0%, transparent 50%),
        radial-gradient(ellipse at 20% 80%, rgba(107, 28, 28, 0.2) 0%, transparent 40%),
        radial-gradient(ellipse at 80% 80%, rgba(107, 28, 28, 0.2) 0%, transparent 40%),
        linear-gradient(180deg, #0a0d12 0%, #151a1f 40%, #1a1510 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    opacity: 0;
    transition: opacity 0.5s ease;
    padding: clamp(12px, 3vw, 24px);
    overflow-y: auto;
}

#username-entry-screen::before {
    content: '';
    position: absolute;
    inset: 0;
    background: url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.06'/%3E%3C/svg%3E");
    pointer-events: none;
    mix-blend-mode: overlay;
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
    max-width: 400px;
    width: 100%;
    z-index: 1;
}

.username-container h2 {
    font-family: 'Cinzel', serif;
    color: #d4c4a0;
    font-size: clamp(18px, 5vmin, 32px);
    letter-spacing: clamp(2px, 0.5vw, 4px);
    margin: 0 0 clamp(8px, 1.5vh, 12px);
    text-shadow: 0 0 30px rgba(232, 169, 62, 0.3);
}

.username-container p {
    color: #706050;
    margin: 0 0 clamp(16px, 4vh, 32px);
    font-size: clamp(12px, 2.5vmin, 14px);
    letter-spacing: 1px;
}

.username-input-wrapper {
    position: relative;
    margin-bottom: clamp(16px, 3vh, 24px);
}

#username-input {
    width: 100%;
    padding: clamp(12px, 2.5vh, 18px) clamp(50px, 10vw, 70px) clamp(12px, 2.5vh, 18px) clamp(16px, 3vw, 24px);
    font-family: 'Cinzel', serif;
    font-size: clamp(14px, 3vmin, 18px);
    letter-spacing: 2px;
    background: rgba(10, 13, 18, 0.8);
    border: 2px solid rgba(160, 144, 128, 0.3);
    border-radius: 8px;
    color: #d4c4a0;
    text-align: center;
    outline: none;
    transition: all 0.3s;
    box-sizing: border-box;
}

#username-input::placeholder {
    color: #504030;
}

#username-input:focus {
    border-color: rgba(232, 169, 62, 0.5);
    box-shadow: 0 0 30px rgba(232, 169, 62, 0.15);
}

#username-input.error {
    border-color: rgba(180, 80, 80, 0.6);
    animation: shake 0.3s ease;
}

@keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-5px); }
    75% { transform: translateX(5px); }
}

.char-count {
    position: absolute;
    right: clamp(12px, 2.5vw, 18px);
    top: 50%;
    transform: translateY(-50%);
    color: #504030;
    font-size: clamp(10px, 2vmin, 12px);
    letter-spacing: 1px;
}

.confirm-btn {
    background: linear-gradient(180deg, 
        rgba(220, 220, 230, 0.95) 0%, 
        rgba(180, 180, 195, 0.9) 20%,
        rgba(140, 140, 155, 0.85) 50%,
        rgba(100, 100, 115, 0.9) 80%,
        rgba(70, 70, 85, 0.95) 100%);
    border: 2px solid rgba(255, 255, 255, 0.4);
    color: #151518;
    padding: clamp(12px, 2vh, 16px) clamp(32px, 6vw, 48px);
    font-family: 'Cinzel', serif;
    font-size: clamp(12px, 2.5vmin, 15px);
    font-weight: 700;
    letter-spacing: clamp(2px, 0.4vw, 3px);
    text-transform: uppercase;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s;
    box-shadow: 
        0 0 60px rgba(200, 200, 220, 0.25),
        0 4px 20px rgba(0, 0, 0, 0.5),
        inset 0 1px 0 rgba(255, 255, 255, 0.6);
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.4);
}

.confirm-btn:hover {
    transform: translateY(-3px) scale(1.02);
    box-shadow: 
        0 0 100px rgba(200, 200, 220, 0.4),
        0 8px 30px rgba(0, 0, 0, 0.5),
        inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

.confirm-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
}

/* Tutorial Screen */
#tutorial-screen {
    position: fixed;
    inset: 0;
    background: 
        radial-gradient(ellipse at 50% 20%, rgba(232, 169, 62, 0.15) 0%, transparent 50%),
        radial-gradient(ellipse at 20% 80%, rgba(107, 28, 28, 0.2) 0%, transparent 40%),
        radial-gradient(ellipse at 80% 80%, rgba(107, 28, 28, 0.2) 0%, transparent 40%),
        linear-gradient(180deg, #0a0d12 0%, #151a1f 40%, #1a1510 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    opacity: 0;
    transition: opacity 0.5s ease;
    padding: clamp(12px, 3vw, 24px);
    overflow-y: auto;
}

#tutorial-screen::before {
    content: '';
    position: absolute;
    inset: 0;
    background: url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.06'/%3E%3C/svg%3E");
    pointer-events: none;
    mix-blend-mode: overlay;
}

#tutorial-screen.visible {
    opacity: 1;
}

#tutorial-screen.fade-out {
    opacity: 0;
}

.tutorial-container {
    position: relative;
    text-align: center;
    max-width: 480px;
    width: 100%;
    z-index: 1;
}

.tutorial-container h2 {
    font-family: 'Cinzel', serif;
    color: #d4c4a0;
    font-size: clamp(18px, 5vmin, 32px);
    letter-spacing: clamp(2px, 0.5vw, 4px);
    margin: 0 0 clamp(16px, 3vh, 32px);
    text-shadow: 0 0 30px rgba(232, 169, 62, 0.3);
}

.tutorial-content {
    display: flex;
    flex-direction: column;
    gap: clamp(10px, 2vh, 16px);
    margin-bottom: clamp(16px, 3vh, 32px);
}

.tutorial-step {
    display: flex;
    align-items: center;
    gap: clamp(10px, 2vw, 16px);
    background: rgba(10, 13, 18, 0.6);
    padding: clamp(10px, 2vh, 16px) clamp(12px, 2.5vw, 20px);
    border-radius: 8px;
    border: 1px solid rgba(160, 144, 128, 0.15);
    text-align: left;
}

.tutorial-step .step-icon {
    font-size: clamp(20px, 4.5vmin, 28px);
    flex-shrink: 0;
    filter: drop-shadow(0 0 8px rgba(232, 169, 62, 0.3));
}

.tutorial-step p {
    color: #a09080;
    margin: 0;
    font-size: clamp(11px, 2.5vmin, 14px);
    line-height: 1.5;
    letter-spacing: 0.5px;
}

.tutorial-step strong {
    color: #d4c4a0;
}

.skip-future {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(6px, 1.5vw, 10px);
    margin-top: clamp(12px, 2.5vh, 20px);
    color: #504030;
    font-size: clamp(10px, 2vmin, 12px);
    cursor: pointer;
    letter-spacing: 1px;
}

.skip-future input {
    cursor: pointer;
    accent-color: #e8a93e;
}

/* User profile bar */
.user-profile-bar {
    display: flex;
    align-items: center;
    gap: clamp(8px, 1.5vw, 12px);
    padding: clamp(6px, 1.2vh, 10px) clamp(12px, 2vw, 18px);
    background: rgba(10, 13, 18, 0.9);
    border: 1px solid rgba(160, 144, 128, 0.2);
    border-radius: 25px;
    position: absolute;
    top: clamp(8px, 1.5vh, 15px);
    right: clamp(8px, 1.5vw, 15px);
    z-index: 100;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
}

.user-avatar {
    width: clamp(26px, 5vmin, 36px);
    height: clamp(26px, 5vmin, 36px);
    border-radius: 50%;
    border: 2px solid rgba(232, 169, 62, 0.5);
    object-fit: cover;
}

.user-avatar.placeholder {
    background: linear-gradient(135deg, rgba(232, 169, 62, 0.3), rgba(180, 100, 50, 0.3));
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Cinzel', serif;
    font-size: clamp(10px, 2.5vmin, 14px);
    color: #d4c4a0;
    font-weight: bold;
}

.user-name {
    font-family: 'Cinzel', serif;
    font-size: clamp(10px, 2.5vmin, 14px);
    font-weight: 600;
    color: #d4c4a0;
    letter-spacing: 1px;
}

.user-stats {
    font-size: clamp(9px, 2vmin, 11px);
    color: #706050;
    letter-spacing: 0.5px;
}

.user-menu-btn {
    background: none;
    border: none;
    color: #706050;
    cursor: pointer;
    padding: clamp(2px, 0.5vh, 4px) clamp(4px, 1vw, 8px);
    font-size: clamp(12px, 3vmin, 16px);
    transition: color 0.3s;
}

.user-menu-btn:hover {
    color: #e8a93e;
}

/* ===== LANDSCAPE MODE (short height) ===== */
@media (max-height: 500px) and (orientation: landscape) {
    #login-screen {
        padding: clamp(8px, 2vh, 16px) clamp(16px, 3vw, 32px);
    }
    
    .login-container {
        gap: clamp(10px, 2.5vh, 18px);
    }
    
    /* Logo scales to height in landscape */
    .login-logo-img {
        width: auto;
        height: clamp(80px, 22vh, 140px);
        max-width: 90vw;
    }
    
    /* Login box proportionate to logo */
    .login-box {
        max-width: clamp(300px, 50vw, 420px);
    }
    
    /* Hide the welcome text in landscape - logo says it all */
    .login-box h2,
    .login-prompt {
        display: none;
    }
    
    /* Buttons side by side */
    .login-buttons {
        flex-direction: row;
        gap: clamp(10px, 2vw, 16px);
    }
    
    .login-btn {
        padding: clamp(10px, 2.5vh, 14px) clamp(20px, 3vw, 28px);
        font-size: clamp(11px, 2.8vh, 13px);
    }
    
    .login-icon {
        width: clamp(14px, 3.5vh, 18px);
        height: clamp(14px, 3.5vh, 18px);
    }
    
    /* Hide features in landscape */
    .login-features {
        display: none;
    }
    
    /* Bottom buttons inline */
    .login-bottom-btns {
        flex-direction: row;
        gap: clamp(10px, 2vw, 16px);
    }
    
    .skip-login-btn {
        padding: clamp(6px, 1.5vh, 10px) clamp(14px, 2.5vw, 20px);
        font-size: clamp(9px, 2.2vh, 11px);
    }
}

/* ===== VERY SHORT LANDSCAPE (iPhone SE, small phones) ===== */
@media (max-height: 380px) and (orientation: landscape) {
    #login-screen {
        padding: 6px 12px;
    }
    
    .login-container {
        gap: clamp(6px, 1.5vh, 10px);
    }
    
    .login-logo-img {
        height: clamp(60px, 18vh, 100px);
    }
    
    .login-box {
        max-width: clamp(280px, 45vw, 380px);
    }
    
    .login-btn {
        padding: clamp(8px, 2vh, 12px) clamp(16px, 2.5vw, 24px);
        font-size: clamp(10px, 2.5vh, 12px);
    }
    
    .skip-login-btn {
        padding: 5px 12px;
        font-size: 9px;
    }
}

/* ===== PORTRAIT MODE ===== */
@media (orientation: portrait) {
    .login-container {
        gap: clamp(16px, 4vmin, 28px);
    }
    
    .login-logo-img {
        width: clamp(240px, 70vw, 420px);
    }
    
    .login-box {
        max-width: clamp(240px, 70vw, 320px);
    }
    
    .login-features {
        max-width: clamp(240px, 70vw, 320px);
    }
}

/* ===== NARROW PORTRAIT (small phones) ===== */
@media (max-width: 380px) and (orientation: portrait) {
    .login-container {
        gap: clamp(12px, 3vmin, 20px);
    }
    
    .login-logo-img {
        width: clamp(200px, 85vw, 300px);
    }
    
    .login-btn {
        padding: 10px 16px;
    }
    
    .login-features {
        padding: 12px;
        gap: 8px;
    }
    
    .feature {
        font-size: 11px;
        gap: 8px;
    }
    
    .feature-icon {
        font-size: 14px;
    }
}

/* ===== TALL PORTRAIT (good height) ===== */
@media (min-height: 700px) and (orientation: portrait) {
    .login-container {
        gap: clamp(20px, 4vmin, 32px);
    }
    
    .login-logo-img {
        width: clamp(280px, 65vw, 450px);
    }
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
        
        const user = Auth.user;
        if (!user && !window.isOfflineMode) return;
        
        this.element = document.createElement('div');
        this.element.className = 'user-profile-bar';
        
        if (user) {
            this.element.innerHTML = `
                ${user.avatarUrl 
                    ? `<img src="${user.avatarUrl}" class="user-avatar" alt="Avatar">`
                    : `<div class="user-avatar placeholder">${user.displayName.charAt(0).toUpperCase()}</div>`
                }
                <div>
                    <div class="user-name">${user.displayName}</div>
                    <div class="user-stats">${Auth.getStatsString()}</div>
                </div>
                <button class="user-menu-btn" onclick="UserProfileBar.showMenu()" title="Account">⚙️</button>
            `;
        } else {
            // Offline mode
            const offlineName = (typeof PlayerData !== 'undefined' && PlayerData.playerName) || 'Summoner';
            this.element.innerHTML = `
                <div class="user-avatar placeholder">${offlineName.charAt(0).toUpperCase()}</div>
                <div>
                    <div class="user-name">${offlineName}</div>
                    <div class="user-stats">Offline Mode</div>
                </div>
            `;
        }
        
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
    },
    
    showMenu() {
        const choice = prompt(
            `Account Menu\n\n` +
            `1. Change Display Name\n` +
            `2. ${Auth.user?.hasGoogle ? '✓ Google Linked' : 'Link Google Account'}\n` +
            `3. ${Auth.user?.hasDiscord ? '✓ Discord Linked' : 'Link Discord Account'}\n` +
            `4. Logout\n\n` +
            `Enter option number:`
        );
        
        switch (choice) {
            case '1':
                const newName = prompt('Enter new display name (2-24 characters):', Auth.user?.displayName);
                if (newName && newName !== Auth.user?.displayName) {
                    Auth.updateDisplayName(newName)
                        .then(() => {
                            this.update();
                            if (typeof showMessage === 'function') {
                                showMessage('Name updated!', 1500);
                            }
                        })
                        .catch(err => alert(err.message));
                }
                break;
            case '2':
                if (!Auth.user?.hasGoogle) Auth.linkGoogle();
                break;
            case '3':
                if (!Auth.user?.hasDiscord) Auth.linkDiscord();
                break;
            case '4':
                if (confirm('Are you sure you want to logout?')) {
                    Auth.logout();
                }
                break;
        }
    }
};

// ==================== INITIALIZATION ====================

// Don't auto-start - let index.html control this
window.GameFlow = GameFlow;
window.LoginScreen = LoginScreen;
window.UserProfileBar = UserProfileBar;