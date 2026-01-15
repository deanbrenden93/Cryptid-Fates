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
            <!-- SVG filter for heat distortion -->
            <svg style="position:absolute;width:0;height:0;pointer-events:none;">
                <defs>
                    <filter id="heatDistortion" x="-20%" y="-20%" width="140%" height="140%">
                        <feTurbulence type="fractalNoise" baseFrequency="0.015 0.02" numOctaves="2" result="noise" seed="5">
                            <animate attributeName="baseFrequency" dur="7.5s" values="0.015 0.02;0.018 0.025;0.012 0.018;0.015 0.02" repeatCount="indefinite"/>
                        </feTurbulence>
                        <feDisplacementMap in="SourceGraphic" in2="noise" scale="6" xChannelSelector="R" yChannelSelector="G"/>
                    </filter>
                </defs>
            </svg>
            
            <!-- Background image with heat distortion -->
            <div class="login-bg">
                <img src="sprites/loginbg.jpg" alt="" class="login-bg-img">
            </div>
            
            <!-- Canvas for 3D ember tunnel effect -->
            <canvas id="login-ember-canvas"></canvas>
            
            <!-- Logo Wrapper - centers logo then shrinks -->
            <div class="login-logo-wrapper">
                <div class="login-logo">
                     <img src="sprites/new-logo.png" alt="Cryptid Fates" class="login-logo-img">
                </div>
            </div>
            
            <!-- Content Container - appears after logo animation -->
            <div class="login-content">
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
                            <span>Google</span>
                        </button>
                        
                        <button class="login-btn discord-btn" onclick="Auth.loginWithDiscord()">
                            <svg class="login-icon" viewBox="0 0 24 24">
                                <path fill="currentColor" d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                            </svg>
                            <span>Discord</span>
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
                    
                    <button class="skip-login-btn dev-rewards-btn" onclick="LoginScreen.testRewardsScreen()">
                        🎁 Dev: Test Rewards
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        // Start the 3D ember tunnel effect
        this.initEmberTunnel();
        
        // Animate in
        requestAnimationFrame(() => {
            overlay.classList.add('visible');
        });
    },
    
    /**
     * Hellfire Spark Effect - Streaking embers with tails flying in arcs
     */
    emberCanvas: null,
    emberCtx: null,
    sparks: [],
    emberAnimationId: null,
    lastTime: 0,
    
    initEmberTunnel() {
        this.emberCanvas = document.getElementById('login-ember-canvas');
        if (!this.emberCanvas) return;
        
        this.emberCtx = this.emberCanvas.getContext('2d');
        this.sparks = [];
        
        // Set canvas size
        this.resizeEmberCanvas();
        window.addEventListener('resize', () => this.resizeEmberCanvas());
        
        // Create initial embers
        for (let i = 0; i < 40; i++) {
            this.sparks.push(this.createEmber(true));
        }
        
        // Start animation
        this.lastTime = performance.now();
        this.animateEmbers();
    },
    
    resizeEmberCanvas() {
        if (!this.emberCanvas) return;
        this.emberCanvas.width = window.innerWidth;
        this.emberCanvas.height = window.innerHeight;
    },
    
    createEmber(randomProgress = false) {
        const canvas = this.emberCanvas;
        
        // Spawn from bottom half of screen, weighted toward center-bottom (near lava ring)
        const spawnX = canvas.width * (0.15 + Math.random() * 0.7);
        const spawnY = canvas.height * (0.5 + Math.random() * 0.5);
        
        // Determine ember type
        const type = Math.random();
        let color, size, speed;
        
        if (type < 0.15) {
            // White hot sparks - small, fast
            color = { r: 255, g: 250, b: 230 };
            size = 0.8 + Math.random() * 1.5;
            speed = 40 + Math.random() * 60;
        } else if (type < 0.45) {
            // Bright orange embers
            color = { r: 255, g: 140 + Math.random() * 80, b: 30 + Math.random() * 50 };
            size = 1 + Math.random() * 2.5;
            speed = 25 + Math.random() * 45;
        } else if (type < 0.75) {
            // Orange-red embers - medium
            color = { r: 255, g: 70 + Math.random() * 70, b: 15 + Math.random() * 35 };
            size = 1.5 + Math.random() * 3;
            speed = 20 + Math.random() * 35;
        } else {
            // Deep red embers - larger, slower
            color = { r: 200 + Math.random() * 55, g: 30 + Math.random() * 50, b: 5 + Math.random() * 25 };
            size = 2 + Math.random() * 3.5;
            speed = 12 + Math.random() * 28;
        }
        
        // Horizontal drift - slight side-to-side movement
        const driftSpeed = (Math.random() - 0.5) * 30;
        const driftPhase = Math.random() * Math.PI * 2;
        const driftAmplitude = 15 + Math.random() * 40;
        
        // Life progress
        const life = randomProgress ? Math.random() * 0.7 : 0;
        const maxLife = 0.9 + Math.random() * 0.3; // When ember fades out
        
        return {
            x: spawnX,
            y: spawnY,
            startX: spawnX,
            speed,
            color,
            size,
            life,
            maxLife,
            driftSpeed,
            driftPhase,
            driftAmplitude,
            flicker: Math.random() * Math.PI * 2,
            flickerSpeed: 8 + Math.random() * 12
        };
    },
    
    animateEmbers() {
        const canvas = this.emberCanvas;
        const ctx = this.emberCtx;
        
        if (!canvas || !ctx) return;
        
        const now = performance.now();
        const dt = Math.min((now - this.lastTime) / 1000, 0.05);
        this.lastTime = now;
        
        // Clear canvas (transparent to show background image)
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Update and draw embers
        for (let i = this.sparks.length - 1; i >= 0; i--) {
            const ember = this.sparks[i];
            
            // Update life
            ember.life += dt * (ember.speed / canvas.height);
            ember.flicker += dt * ember.flickerSpeed;
            ember.driftPhase += dt * ember.driftSpeed * 0.1;
            
            // Calculate current position
            const lifeProgress = ember.life / ember.maxLife;
            const y = ember.y - (ember.life * canvas.height * 0.9);
            const drift = Math.sin(ember.driftPhase) * ember.driftAmplitude * lifeProgress;
            const x = ember.startX + drift;
            
            // Fade in at start, fade out at end
            let alpha = 1;
            if (lifeProgress < 0.1) {
                alpha = lifeProgress / 0.1;
            } else if (lifeProgress > 0.7) {
                alpha = 1 - ((lifeProgress - 0.7) / 0.3);
            }
            
            // Check if dead or off screen
            if (ember.life >= ember.maxLife || y < -50) {
                this.sparks[i] = this.createEmber(false);
                continue;
            }
            
            // Flicker effect
            const flickerVal = 0.75 + 0.25 * Math.sin(ember.flicker);
            const finalAlpha = alpha * flickerVal;
            
            // Skip nearly invisible embers
            if (finalAlpha < 0.05) continue;
            
            // Size decreases slightly as ember rises and cools
            const currentSize = ember.size * (1 - lifeProgress * 0.3);
            
            // Color cools as it rises (shifts from bright to darker)
            const coolFactor = lifeProgress * 0.4;
            const r = Math.floor(ember.color.r * (1 - coolFactor * 0.2));
            const g = Math.floor(ember.color.g * (1 - coolFactor * 0.5));
            const b = Math.floor(ember.color.b * (1 - coolFactor * 0.3));
            
            // Outer glow
            const glowRadius = currentSize * 6;
            if (glowRadius > 2) {
                const emberGlow = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
                emberGlow.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.4 * finalAlpha})`);
                emberGlow.addColorStop(0.4, `rgba(${r}, ${Math.floor(g * 0.6)}, ${Math.floor(b * 0.4)}, ${0.15 * finalAlpha})`);
                emberGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = emberGlow;
                ctx.beginPath();
                ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // Ember core
            if (currentSize > 0.3) {
                ctx.beginPath();
                ctx.arc(x, y, currentSize, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${finalAlpha})`;
                ctx.fill();
                
                // Bright center for larger embers
                if (currentSize > 1.2 && finalAlpha > 0.5) {
                    ctx.beginPath();
                    ctx.arc(x, y, currentSize * 0.4, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(255, ${200 + Math.floor(g * 0.3)}, ${150 + Math.floor(b)}, ${finalAlpha * 0.8})`;
                    ctx.fill();
                }
            }
        }
        
        // Spawn new embers occasionally
        if (Math.random() < 0.12 && this.sparks.length < 50) {
            this.sparks.push(this.createEmber(false));
        }
        
        // Continue animation
        this.emberAnimationId = requestAnimationFrame(() => this.animateEmbers());
    },
    
    stopEmberTunnel() {
        if (this.emberAnimationId) {
            cancelAnimationFrame(this.emberAnimationId);
            this.emberAnimationId = null;
        }
        window.removeEventListener('resize', () => this.resizeEmberCanvas());
        this.emberCanvas = null;
        this.emberCtx = null;
        this.sparks = [];
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
     * Test rewards screen directly (dev bypass)
     */
    testRewardsScreen() {
        console.log('[LoginScreen] Testing rewards screen...');
        
        // IMPORTANT: Set offline mode so the game doesn't redirect back to login
        window.isOfflineMode = true;
        
        this.hide();
        
        // Hide other screens
        ['main-menu', 'home-screen', 'loading-screen', 'fullscreen-prompt', 'game-container'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.style.display = 'none';
                el.classList.add('hidden');
            }
        });
        
        // Show rewards screen directly
        if (typeof TutorialRewards !== 'undefined') {
            TutorialRewards.show();
        } else {
            console.error('[LoginScreen] TutorialRewards not found');
        }
    },
    
    /**
     * Hide the login screen
     */
    hide() {
        const overlay = document.getElementById('login-screen');
        if (!overlay) return;
        
        // Stop ember tunnel effect
        this.stopEmberTunnel();
        
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
/* ==================== CANVAS EMBER TUNNEL ==================== */
#login-ember-canvas {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 1;
    pointer-events: none;
}

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

/* ==================== LOGIN SCREEN ==================== */
#login-screen {
    position: fixed;
    inset: 0;
    background: transparent;
    display: flex;
    flex-direction: column;
    align-items: center;
    z-index: 10000;
    opacity: 0;
    transition: opacity 1s ease;
    overflow-y: auto;
    overflow-x: hidden;
}

#login-screen.visible {
    opacity: 1;
}

/* Background image layer with heat distortion */
.login-bg {
    position: fixed;
    inset: 0;
    z-index: 0;
    overflow: hidden;
    background: #030201;
}

.login-bg-img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
    filter: url(#heatDistortion);
}

/* Subtle pulsing glow overlay for the lava */
.login-bg::after {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at 50% 35%, rgba(255, 60, 10, 0.08) 0%, transparent 50%);
    animation: lavaPulse 4s ease-in-out infinite;
    pointer-events: none;
}

@keyframes lavaPulse {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
}

/* ==================== LOGO WRAPPER - Centered, then slides to top ==================== */
.login-logo-wrapper {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: center;
    /* Animate only top position - smooth slide up */
    animation: wrapperSlideToTop 1.5s ease 3.3s forwards;
}

@keyframes wrapperSlideToTop {
    0% {
        top: 50%;
        transform: translate(-50%, -50%);
    }
    100% {
        top: clamp(60px, 12vmin, 100px);
        transform: translate(-50%, 0);
    }
}

/* ==================== LOGO ==================== */
.login-logo {
    text-align: center;
    perspective: 1000px;
    /* Heat distortion on the container */
    filter: url(#heatDistortion);
}

/* ==================== CONTENT CONTAINER ==================== */
.login-content {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(12px, 2.5vmin, 20px);
    max-width: 440px;
    width: 100%;
    z-index: 10;
    /* Top padding accounts for fixed logo (position + size) + spacing */
    padding: clamp(320px, 55vmin, 520px) clamp(16px, 4vmin, 32px) clamp(20px, 4vmin, 40px);
    /* Hidden initially - appears as logo moves up */
    opacity: 0;
    transform: translateY(30px);
    pointer-events: none;
    animation: contentFadeIn 0.8s ease-out 3.8s forwards;
}

@keyframes contentFadeIn {
    0% {
        opacity: 0;
        transform: translateY(30px);
        pointer-events: none;
    }
    100% {
        opacity: 1;
        transform: translateY(0);
        pointer-events: auto;
    }
}

/* Items stagger animation */
.login-box,
.login-features,
.login-bottom-btns {
    width: 100%;
    box-sizing: border-box;
}

.login-logo-img {
    width: clamp(280px, 60vmin, 520px);
    height: auto;
    object-fit: contain;
    /* Cinematic 3D reveal - LOST style */
    opacity: 0;
    transform-style: preserve-3d;
    transform: 
        translateZ(-150px) 
        translateY(-20px)
        rotateX(10deg) 
        scale(0.8);
    /* Subtle feather effect - soft fade at edges without harsh glow */
    filter: 
        drop-shadow(0 8px 16px rgba(0, 0, 0, 0.5))
        blur(12px);
    animation: logoReveal3D 3s cubic-bezier(0.23, 1, 0.32, 1) 0.3s forwards;
}

/* 3D float-in with smooth blur */
@keyframes logoReveal3D {
    0% {
        opacity: 0;
        filter: 
            drop-shadow(0 8px 16px rgba(0, 0, 0, 0.5))
            blur(12px);
        transform: 
            translateZ(-150px) 
            translateY(-20px)
            rotateX(10deg) 
            scale(0.8);
    }
    100% {
        opacity: 1;
        filter: 
            drop-shadow(0 8px 16px rgba(0, 0, 0, 0.5))
            blur(0px);
        transform: 
            translateZ(0) 
            translateY(0)
            rotateX(0deg) 
            scale(1);
    }
}

/* ==================== LOGIN BOX ==================== */
.login-box {
    width: 100%;
    max-width: clamp(280px, 50vmin, 380px);
    text-align: center;
}

.login-box h2 {
    font-family: 'Cinzel', serif;
    margin: 0 0 8px;
    font-size: clamp(18px, 4vmin, 26px);
    color: #fff;
    letter-spacing: 4px;
    text-shadow: 
        0 0 10px rgba(255, 150, 80, 0.8),
        0 0 30px rgba(255, 100, 40, 0.5),
        0 4px 8px rgba(0, 0, 0, 0.9);
    text-transform: uppercase;
}

.login-prompt {
    margin: 0 0 clamp(16px, 3vmin, 24px);
    color: #8a6a4a;
    font-size: clamp(11px, 2.2vmin, 14px);
    letter-spacing: 2px;
    font-family: 'Source Sans Pro', sans-serif;
}

/* ==================== BUTTON CONTAINER ==================== */
.login-buttons {
    display: flex;
    flex-direction: column;
    gap: clamp(10px, 2vmin, 16px);
}

/* ==================== EPIC FANTASY BUTTONS ==================== */
.login-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: clamp(12px, 2.5vmin, 18px) clamp(24px, 5vmin, 36px);
    font-family: 'Cinzel', serif;
    font-size: clamp(12px, 2.4vmin, 16px);
    font-weight: 700;
    border: none;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 2px;
    overflow: hidden;
    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    clip-path: polygon(
        8px 0%, calc(100% - 8px) 0%, 100% 8px, 100% calc(100% - 8px),
        calc(100% - 8px) 100%, 8px 100%, 0% calc(100% - 8px), 0% 8px
    );
}

/* Button border frame */
.login-btn::before {
    content: '';
    position: absolute;
    inset: 0;
    padding: 2px;
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

/* Shine effect */
.login-btn::after {
    content: '';
    position: absolute;
    top: 0;
    left: -150%;
    width: 100%;
    height: 100%;
    background: linear-gradient(
        90deg,
        transparent,
        rgba(255, 255, 255, 0.3),
        transparent
    );
    transition: left 0.6s ease;
    pointer-events: none;
}

.login-btn:hover::after {
    left: 150%;
}

.login-icon {
    width: clamp(18px, 4vmin, 24px);
    height: clamp(18px, 4vmin, 24px);
    flex-shrink: 0;
    position: relative;
    z-index: 2;
}

.login-btn span:not(.btn-glow) {
    position: relative;
    z-index: 2;
}

/* Google Button - Molten Silver */
.google-btn {
    background: linear-gradient(
        180deg,
        #5a5a65 0%,
        #45454f 30%,
        #35353e 70%,
        #28282f 100%
    );
    color: #e8e8f0;
    box-shadow: 
        0 0 0 1px rgba(255, 255, 255, 0.1) inset,
        0 8px 32px rgba(0, 0, 0, 0.8),
        0 0 60px rgba(150, 150, 180, 0.15);
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
}

.google-btn::before {
    background: linear-gradient(
        180deg,
        rgba(200, 200, 220, 0.5),
        rgba(120, 120, 140, 0.3),
        rgba(80, 80, 100, 0.4),
        rgba(200, 200, 220, 0.5)
    );
}

.google-btn:hover {
    transform: translateY(-4px) scale(1.03);
    box-shadow: 
        0 0 0 1px rgba(255, 255, 255, 0.2) inset,
        0 12px 48px rgba(0, 0, 0, 0.9),
        0 0 80px rgba(180, 180, 220, 0.25),
        0 0 120px rgba(150, 150, 200, 0.15);
}

.google-btn:active {
    transform: translateY(0) scale(0.98);
}

/* Discord Button - Arcane Purple */
.discord-btn {
    background: linear-gradient(
        180deg,
        #6875f2 0%,
        #5560d8 30%,
        #444eb8 70%,
        #353d98 100%
    );
    color: #fff;
    box-shadow: 
        0 0 0 1px rgba(150, 160, 255, 0.2) inset,
        0 8px 32px rgba(0, 0, 0, 0.8),
        0 0 60px rgba(88, 101, 242, 0.3);
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.6);
}

.discord-btn::before {
    background: linear-gradient(
        180deg,
        rgba(150, 160, 255, 0.6),
        rgba(100, 110, 220, 0.3),
        rgba(70, 80, 180, 0.4),
        rgba(150, 160, 255, 0.6)
    );
}

.discord-btn:hover {
    transform: translateY(-4px) scale(1.03);
    box-shadow: 
        0 0 0 1px rgba(150, 160, 255, 0.3) inset,
        0 12px 48px rgba(0, 0, 0, 0.9),
        0 0 80px rgba(88, 101, 242, 0.5),
        0 0 120px rgba(100, 120, 255, 0.3);
}

.discord-btn:active {
    transform: translateY(0) scale(0.98);
}

/* ==================== FEATURES BOX ==================== */
.login-features {
    display: flex;
    flex-direction: column;
    gap: clamp(6px, 1.2vmin, 12px);
    padding: clamp(10px, 2vmin, 18px);
    background: linear-gradient(
        180deg,
        rgba(30, 15, 8, 0.85) 0%,
        rgba(15, 8, 4, 0.9) 100%
    );
    border: 1px solid rgba(255, 120, 40, 0.15);
    width: 100%;
    max-width: 320px;
    clip-path: polygon(
        12px 0%, calc(100% - 12px) 0%, 100% 12px, 100% calc(100% - 12px),
        calc(100% - 12px) 100%, 12px 100%, 0% calc(100% - 12px), 0% 12px
    );
    box-shadow: 
        0 8px 32px rgba(0, 0, 0, 0.6),
        inset 0 1px 0 rgba(255, 150, 80, 0.1);
}

.feature {
    display: flex;
    align-items: center;
    gap: clamp(12px, 2.5vmin, 18px);
    font-size: clamp(12px, 2.6vmin, 15px);
    color: #b89070;
    letter-spacing: 0.5px;
    font-family: 'Source Sans Pro', sans-serif;
}

.feature-icon {
    font-size: clamp(18px, 4vmin, 24px);
    filter: drop-shadow(0 0 8px rgba(255, 120, 40, 0.5));
    flex-shrink: 0;
}

/* ==================== BOTTOM BUTTONS ==================== */
.login-bottom-btns {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: clamp(8px, 1.5vmin, 12px);
    margin-top: clamp(8px, 2vmin, 16px);
}

.skip-login-btn {
    background: linear-gradient(180deg, rgba(20, 12, 8, 0.9) 0%, rgba(10, 6, 4, 0.95) 100%);
    border: 1px solid rgba(255, 120, 40, 0.35);
    color: #dd9966;
    padding: clamp(10px, 2vmin, 14px) clamp(20px, 4vmin, 32px);
    font-family: 'Cinzel', serif;
    font-size: clamp(10px, 1.8vmin, 12px);
    font-weight: 600;
    letter-spacing: 1px;
    text-transform: uppercase;
    cursor: pointer;
    transition: all 0.3s ease;
    position: relative;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
    box-shadow: 
        0 2px 8px rgba(0, 0, 0, 0.5),
        inset 0 1px 0 rgba(255, 150, 80, 0.1);
    clip-path: polygon(
        6px 0%, calc(100% - 6px) 0%, 100% 6px, 100% calc(100% - 6px),
        calc(100% - 6px) 100%, 6px 100%, 0% calc(100% - 6px), 0% 6px
    );
}

.skip-login-btn:hover {
    background: linear-gradient(180deg, rgba(40, 20, 10, 0.95) 0%, rgba(20, 10, 5, 0.98) 100%);
    border-color: rgba(255, 120, 40, 0.6);
    color: #ffbb88;
    box-shadow: 
        0 4px 20px rgba(255, 100, 40, 0.25),
        0 2px 8px rgba(0, 0, 0, 0.5),
        inset 0 1px 0 rgba(255, 150, 80, 0.2);
    text-shadow: 0 0 20px rgba(255, 150, 80, 0.6);
}

.dev-tutorial-btn {
    border-color: rgba(80, 200, 120, 0.35);
    color: #70b080;
}

.dev-tutorial-btn:hover {
    background: linear-gradient(180deg, rgba(15, 30, 20, 0.95) 0%, rgba(8, 15, 10, 0.98) 100%);
    border-color: rgba(80, 200, 120, 0.6);
    color: #90e0a0;
    box-shadow: 
        0 4px 20px rgba(80, 200, 120, 0.2),
        0 2px 8px rgba(0, 0, 0, 0.5);
    text-shadow: 0 0 20px rgba(100, 220, 140, 0.6);
}

.dev-rewards-btn {
    border-color: rgba(255, 200, 80, 0.35);
    color: #ccaa66;
}

.dev-rewards-btn:hover {
    background: linear-gradient(180deg, rgba(35, 28, 12, 0.95) 0%, rgba(18, 14, 6, 0.98) 100%);
    border-color: rgba(255, 200, 80, 0.6);
    color: #ffe088;
    box-shadow: 
        0 4px 20px rgba(255, 200, 80, 0.2),
        0 2px 8px rgba(0, 0, 0, 0.5);
    text-shadow: 0 0 20px rgba(255, 220, 100, 0.6);
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

/* ==================== TUTORIAL SCREEN ==================== */
#tutorial-screen {
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

#tutorial-screen.visible {
    opacity: 1;
}

#tutorial-screen.fade-out {
    opacity: 0;
}

.tutorial-container {
    position: relative;
    text-align: center;
    max-width: 500px;
    width: 100%;
    z-index: 10;
}

.tutorial-container h2 {
    font-family: 'Cinzel', serif;
    color: #fff;
    font-size: clamp(20px, 5vmin, 36px);
    letter-spacing: 4px;
    margin: 0 0 clamp(20px, 4vh, 36px);
    text-shadow: 
        0 0 10px rgba(255, 150, 80, 0.8),
        0 0 30px rgba(255, 100, 40, 0.5),
        0 4px 8px rgba(0, 0, 0, 0.9);
    text-transform: uppercase;
}

.tutorial-content {
    display: flex;
    flex-direction: column;
    gap: clamp(12px, 2.5vh, 20px);
    margin-bottom: clamp(20px, 4vh, 36px);
}

.tutorial-step {
    display: flex;
    align-items: center;
    gap: clamp(12px, 2.5vw, 20px);
    background: linear-gradient(180deg, rgba(30, 15, 8, 0.8) 0%, rgba(15, 8, 4, 0.85) 100%);
    padding: clamp(12px, 2.5vh, 20px) clamp(14px, 3vw, 24px);
    border: 1px solid rgba(255, 120, 40, 0.15);
    text-align: left;
    clip-path: polygon(
        8px 0%, calc(100% - 8px) 0%, 100% 8px, 100% calc(100% - 8px),
        calc(100% - 8px) 100%, 8px 100%, 0% calc(100% - 8px), 0% 8px
    );
}

.tutorial-step .step-icon {
    font-size: clamp(22px, 5vmin, 32px);
    flex-shrink: 0;
    filter: drop-shadow(0 0 12px rgba(255, 120, 40, 0.6));
}

.tutorial-step p {
    color: #b89070;
    margin: 0;
    font-size: clamp(12px, 2.6vmin, 15px);
    line-height: 1.6;
    letter-spacing: 0.5px;
}

.tutorial-step strong {
    color: #ffd0a0;
}

.skip-future {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(8px, 2vw, 12px);
    margin-top: clamp(14px, 3vh, 24px);
    color: #6a5040;
    font-size: clamp(11px, 2.2vmin, 13px);
    cursor: pointer;
    letter-spacing: 1px;
}

.skip-future input {
    cursor: pointer;
    accent-color: #ff6030;
    width: 18px;
    height: 18px;
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

.user-menu-btn {
    background: none;
    border: none;
    color: #8a6a4a;
    cursor: pointer;
    padding: 4px 8px;
    font-size: clamp(14px, 3.5vmin, 18px);
    transition: all 0.3s;
}

.user-menu-btn:hover {
    color: #ff8040;
    text-shadow: 0 0 15px rgba(255, 100, 40, 0.6);
}

/* ===== LANDSCAPE MODE ===== */
@media (max-height: 500px) and (orientation: landscape) {
    #login-screen {
        flex-direction: column;
        padding: 10px 20px;
    }
    
    /* Logo wrapper in landscape - slides to top-left area */
    .login-logo-wrapper {
        animation: wrapperSlideToTopLandscape 1.5s ease 3.3s forwards;
    }
    
    @keyframes wrapperSlideToTopLandscape {
        0% {
            top: 50%;
            transform: translate(-50%, -50%);
        }
        100% {
            top: clamp(20px, 5vmin, 40px);
            transform: translate(-50%, 0);
        }
    }
    
    .login-logo-img {
        width: auto;
        height: clamp(80px, 40vh, 180px);
        max-width: 55vw;
    }
    
    /* Content in landscape - accounts for smaller logo */
    .login-content {
        max-width: 100%;
        width: 100%;
        padding: clamp(140px, 50vh, 220px) 20px 10px;
        gap: 10px;
        flex-direction: column;
        align-items: center;
    }
    
    .login-box {
        max-width: 400px;
        width: 100%;
        text-align: center;
    }
    
    .login-box h2 {
        font-size: 16px;
        margin-bottom: 4px;
    }
    
    .login-prompt {
        font-size: 11px;
        margin-bottom: 10px;
    }
    
    .login-buttons {
        gap: 12px;
        flex-direction: row;
        justify-content: center;
    }
    
    .login-btn {
        padding: 10px 24px;
        font-size: 12px;
        gap: 10px;
    }
    
    .login-icon {
        width: 16px;
        height: 16px;
    }
    
    .login-features {
        display: none;
    }
    
    .login-bottom-btns {
        flex-direction: row;
        justify-content: center;
        gap: 10px;
        margin: 0;
    }
    
    .skip-login-btn {
        padding: 8px 18px;
        font-size: 9px;
    }
}

/* ===== VERY SHORT LANDSCAPE ===== */
@media (max-height: 380px) and (orientation: landscape) {
    #login-screen {
        gap: 8px;
        padding: 4px 12px;
    }
    
    .login-logo-wrapper {
        animation: wrapperSlideToTopVeryShort 1.5s ease 3.3s forwards;
    }
    
    @keyframes wrapperSlideToTopVeryShort {
        0% {
            top: 50%;
            transform: translate(-50%, -50%);
        }
        100% {
            top: 15px;
            transform: translate(-50%, 0);
        }
    }
    
    .login-logo-img {
        height: clamp(60px, 38vh, 120px);
        max-width: 35vw;
    }
    
    .login-content {
        gap: 6px;
        padding: clamp(100px, 45vh, 150px) 10px 4px;
    }
    
    .login-box {
        max-width: 300px;
    }
    
    .login-box h2 {
        font-size: 12px;
        margin-bottom: 2px;
    }
    
    .login-prompt {
        font-size: 9px;
        margin-bottom: 6px;
    }
    
    .login-btn {
        padding: 6px 12px;
        font-size: 9px;
    }
    
    .login-icon {
        width: 12px;
        height: 12px;
    }
    
    .skip-login-btn {
        padding: 4px 10px;
        font-size: 7px;
    }
}

/* ===== PORTRAIT MODE ===== */
@media (orientation: portrait) {
    /* Use vh-based sizing to fit everything in viewport */
    .login-logo-wrapper {
        animation: wrapperSlideToTopPortrait 1.5s ease 3.3s forwards;
    }
    
    @keyframes wrapperSlideToTopPortrait {
        0% {
            top: 50%;
            transform: translate(-50%, -50%);
        }
        100% {
            top: clamp(20px, 4vh, 60px);
            transform: translate(-50%, 0);
        }
    }
    
    .login-logo-img {
        /* Logo height based on viewport */
        width: auto;
        height: clamp(120px, 28vh, 320px);
        max-width: 90vw;
    }
    
    .login-content {
        /* Content starts below logo: logo_top + logo_height + gap */
        padding-top: clamp(180px, 36vh, 420px);
        gap: clamp(8px, 1.5vh, 16px);
    }
    
    .login-box {
        max-width: clamp(260px, 72vw, 360px);
    }
    
    .login-box h2 {
        font-size: clamp(16px, 2.5vh, 24px);
        margin-bottom: clamp(4px, 0.8vh, 10px);
    }
    
    .login-prompt {
        font-size: clamp(11px, 1.6vh, 15px);
        margin-bottom: clamp(8px, 1.5vh, 16px);
    }
    
    .login-buttons {
        gap: clamp(8px, 1.2vh, 14px);
    }
    
    .login-btn {
        padding: clamp(10px, 1.5vh, 16px) clamp(20px, 3vh, 32px);
        font-size: clamp(12px, 1.8vh, 16px);
    }
    
    .login-features {
        max-width: clamp(260px, 72vw, 340px);
        padding: clamp(8px, 1.2vh, 14px);
        gap: clamp(4px, 0.8vh, 10px);
    }
    
    .feature {
        font-size: clamp(10px, 1.5vh, 13px);
    }
    
    .login-bottom-btns {
        gap: clamp(8px, 1.2vh, 14px);
        margin-top: clamp(4px, 0.8vh, 10px);
    }
    
    .skip-login-btn {
        padding: clamp(6px, 1vh, 12px) clamp(12px, 2vh, 24px);
        font-size: clamp(9px, 1.3vh, 12px);
    }
}

/* ===== NARROW PORTRAIT ===== */
@media (max-width: 380px) and (orientation: portrait) {
    .login-content {
        gap: 10px;
    }
    
    .login-logo-img {
        width: clamp(180px, 70vw, 280px);
    }
    
    .login-btn {
        padding: 10px 18px;
        font-size: 11px;
    }
    
    .login-features {
        padding: 10px;
        gap: 8px;
    }
    
    .feature {
        font-size: 11px;
        gap: 8px;
    }
    
    .feature-icon {
        font-size: 14px;
    }
    
    .skip-login-btn {
        padding: 8px 14px;
        font-size: 9px;
    }
}

/* ===== SHORT PORTRAIT (less than 700px) ===== */
@media (max-height: 700px) and (orientation: portrait) {
    .login-features {
        display: none;
    }
}

/* ===== VERY SHORT PORTRAIT (less than 550px) ===== */
@media (max-height: 550px) and (orientation: portrait) {
    .login-logo-img {
        height: clamp(80px, 22vh, 140px);
    }
    
    .login-content {
        padding-top: clamp(120px, 30vh, 180px);
        gap: clamp(6px, 1vh, 10px);
    }
    
    .login-box h2 {
        font-size: clamp(13px, 2.2vh, 16px);
    }
    
    .login-prompt {
        font-size: clamp(10px, 1.5vh, 12px);
        margin-bottom: clamp(6px, 1vh, 10px);
    }
    
    .login-btn {
        padding: clamp(8px, 1.2vh, 12px) clamp(16px, 2.5vh, 24px);
        font-size: clamp(11px, 1.6vh, 13px);
    }
    
    .skip-login-btn {
        padding: clamp(5px, 0.8vh, 8px) clamp(10px, 1.5vh, 16px);
        font-size: clamp(8px, 1.2vh, 10px);
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