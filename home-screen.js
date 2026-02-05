/**
 * Cryptid Fates - Home Screen
 * Main hub connecting all game systems
 * ALL STYLES IN progression-styles.css
 */

window.HomeScreen = {
    isOpen: false,
    
    init() {
        this.createHTML();
        this.bindEvents();
        
        // Initialize player data
        PlayerData.init();
        
        // Check if we should show welcome screen
        if (PlayerData.showWelcome) {
            this.showWelcomeScreen();
            PlayerData.showWelcome = false;
        } else {
            this.open();
        }
    },
    
    createHTML() {
        const screen = document.createElement('div');
        screen.id = 'home-screen';
        screen.innerHTML = `
            <!-- Background Image (preloaded for instant display) -->
            <div class="home-bg">
                <img src="sprites/Testbackground.png" alt="" class="home-bg-img">
            </div>
            
            <!-- Ember Particle Canvas -->
            <canvas id="ember-particles" class="ember-canvas"></canvas>
            
            <!-- Minimal Top Bar -->
            <div class="home-topbar">
                <div class="top-left">
                    <div class="profile-chip">
                        <img src="sprites/embers-icon.png" class="profile-avatar embers-img" alt="">
                        <span class="profile-name">Summoner</span>
                        <span class="profile-level" id="home-level">Lv.1</span>
                    </div>
                </div>
                <div class="top-right">
                    <div class="currency-chip embers" onclick="HomeScreen.openShop()">
                        <img src="sprites/embers-icon.png" class="c-icon embers-img" alt=""><span class="c-val" id="home-embers">0</span>
                    </div>
                    <div class="currency-chip souls" onclick="HomeScreen.openShop()">
                        <span class="c-icon">💜</span><span class="c-val" id="home-souls">0</span>
                    </div>
                    <div class="top-divider"></div>
                    <button class="icon-btn" id="btn-fullscreen" title="Fullscreen">⛶</button>
                    <button class="icon-btn" id="btn-settings" title="Settings">⚙</button>
                </div>
            </div>
            
            <!-- Center: Logo -->
            <div class="home-center">
                <div class="logo-container">
                    <div class="logo-glow"></div>
                    <img src="sprites/new-logo.png" alt="Cryptid Fates" class="logo-image">
                </div>
                
                <!-- Stats Row (subtle, under logo) -->
                <div class="stats-row">
                    <div class="stat"><span class="stat-val" id="home-wins">0</span><span class="stat-lbl">Wins</span></div>
                    <div class="stat-div"></div>
                    <div class="stat"><span class="stat-val" id="home-losses">0</span><span class="stat-lbl">Losses</span></div>
                    <div class="stat-div"></div>
                    <div class="stat"><span class="stat-val" id="home-winrate">0%</span><span class="stat-lbl">Rate</span></div>
                    <div class="streak-chip" id="streak-display"><img src="sprites/embers-icon.png" class="embers-img" alt=""><span id="home-streak">0</span></div>
                </div>
            </div>
            
            <!-- Bottom: Menu Bar -->
            <div class="home-menubar">
                <div class="menu-btn" id="tile-quickplay"></div>
                <div class="menu-btn" id="tile-decks"></div>
                <div class="menu-btn" id="tile-shop">
                    <span class="btn-badge" id="shop-badge"></span>
                </div>
                <div class="menu-btn" id="tile-collection"></div>
            </div>
            
            <!-- Footer -->
            <div class="home-footer">
                <span>v0.1 Beta</span>
                <span class="foot-link" id="btn-help">How to Play</span>
                <span class="foot-link" id="btn-credits">Credits</span>
            </div>
        `;
        document.body.appendChild(screen);
        
        // Create quick play modal
        this.createQuickPlayModal();
        
        // Create welcome screen
        this.createWelcomeScreen();
    },
    
    createQuickPlayModal() {
        const modal = document.createElement('div');
        modal.id = 'quickplay-modal';
        modal.className = 'qp-modal';
        modal.innerHTML = `
            <div class="qp-backdrop"></div>
            <div class="qp-content">
                <div class="qp-header">
                    <span class="qp-title">⚔️ Battle</span>
                    <button class="qp-close" id="qp-close">×</button>
                </div>
                
                <div class="qp-section">
                    <div class="qp-section-title">🗺️ Roguelite Mode</div>
                    <div class="qp-mode qp-mode-abyss" id="qp-abyss">
                        <div class="qp-mode-main">
                            <div class="qp-mode-icon">🏮</div>
                            <div class="qp-mode-info">
                                <div class="qp-mode-name">ABYSS</div>
                                <div class="qp-mode-desc">Descend into darkness, find POIs before time runs out</div>
                            </div>
                        </div>
                        <div class="qp-mode-rewards">
                            <span class="reward-item">🗝️ Relics</span>
                            <span class="reward-item">📜 Discover Cards</span>
                            <span class="reward-item"><img src="sprites/embers-icon.png" class="embers-img" alt=""> Rewards</span>
                        </div>
                    </div>
                </div>
                
                <div class="qp-section">
                    <div class="qp-section-title">🎮 Quick Battle</div>
                    <div class="qp-mode" id="qp-ai">
                        <div class="qp-mode-main">
                            <div class="qp-mode-icon">🧠</div>
                            <div class="qp-mode-info">
                                <div class="qp-mode-name">Play vs AI</div>
                                <div class="qp-mode-desc">Battle against the Warden</div>
                            </div>
                        </div>
                        <div class="qp-mode-rewards">
                            <span class="reward-item"><img src="sprites/embers-icon.png" class="embers-img" alt=""> Rewards</span>
                            <span class="reward-item">⭐ XP</span>
                        </div>
                    </div>
                    <div class="qp-mode qp-mode-dev" id="qp-cheat">
                        <div class="qp-mode-main">
                            <div class="qp-mode-icon">🔧</div>
                            <div class="qp-mode-info">
                                <div class="qp-mode-name">Cheat Battle</div>
                                <div class="qp-mode-desc">Dev testing mode</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="qp-section">
                    <div class="qp-section-title">👥 Multiplayer</div>
                    <div class="qp-mode qp-mode-multiplayer" id="qp-quickmatch">
                        <div class="qp-mode-main">
                            <div class="qp-mode-icon">⚔️</div>
                            <div class="qp-mode-info">
                                <div class="qp-mode-name">Quick Match</div>
                                <div class="qp-mode-desc">Find an opponent online</div>
                            </div>
                        </div>
                        <div class="qp-mode-rewards">
                            <span class="reward-item">🏆 Ranked</span>
                            <span class="reward-item"><img src="sprites/embers-icon.png" class="embers-img" alt=""> Bonus Rewards</span>
                        </div>
                    </div>
                    <div class="qp-mode qp-mode-private" id="qp-private">
                        <div class="qp-mode-main">
                            <div class="qp-mode-icon">🔗</div>
                            <div class="qp-mode-info">
                                <div class="qp-mode-name">Private Match</div>
                                <div class="qp-mode-desc">Create or join with a code</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },
    
    createWelcomeScreen() {
        const welcome = document.createElement('div');
        welcome.id = 'welcome-screen';
        welcome.innerHTML = `
            <div class="welcome-content">
                <div class="welcome-logo">
                    <img src="sprites/new-logo.png" alt="Cryptid Fates">
                </div>
                <h2 class="welcome-title">Welcome, Summoner</h2>
                <p class="welcome-text">Choose your starter deck to begin your journey.</p>
                
                <div class="starter-deck-selection" id="starter-decks">
                    <div class="starter-deck" data-deck="city-of-flesh">
                        <div class="starter-deck-icon">🏚️</div>
                        <div class="starter-deck-name">City of Flesh</div>
                        <div class="starter-deck-desc">Vampires, gargoyles, and nightmares lurk in the shadows.</div>
                        <div class="starter-deck-theme">Blood & Steel • Status Effects</div>
                    </div>
                    <div class="starter-deck" data-deck="diabolical-desert">
                        <div class="starter-deck-icon">🏜️</div>
                        <div class="starter-deck-name">Diabolical Desert</div>
                        <div class="starter-deck-desc">Ancient horrors rise from scorching sands and forgotten tombs.</div>
                        <div class="starter-deck-theme">Coming Soon</div>
                    </div>
                    <div class="starter-deck" data-deck="forests-of-fear">
                        <div class="starter-deck-icon">🌲</div>
                        <div class="starter-deck-name">Forests of Fear</div>
                        <div class="starter-deck-desc">Wendigos, werewolves, and forest spirits hunger for prey.</div>
                        <div class="starter-deck-theme">Nature & Blood • Evolution</div>
                    </div>
                </div>
                
                <button class="welcome-btn disabled" id="welcome-continue" disabled>Select a Deck</button>
            </div>
        `;
        document.body.appendChild(welcome);
    },
    
    selectedStarterDeck: null,
    
    showWelcomeScreen() {
        const welcomeScreen = document.getElementById('welcome-screen');
        
        welcomeScreen.classList.add('open');
        
        // Animate decks in
        setTimeout(() => {
            document.querySelectorAll('.starter-deck').forEach((deck, i) => {
                setTimeout(() => deck.classList.add('show'), i * 150);
            });
        }, 400);
        
        // Handle deck selection
        document.querySelectorAll('.starter-deck').forEach(deck => {
            deck.onclick = () => {
                // Remove previous selection
                document.querySelectorAll('.starter-deck').forEach(d => d.classList.remove('selected'));
                // Select this one
                deck.classList.add('selected');
                this.selectedStarterDeck = deck.dataset.deck;
                
                // Enable continue button
                const btn = document.getElementById('welcome-continue');
                btn.disabled = false;
                btn.classList.remove('disabled');
                btn.textContent = 'Begin with ' + deck.querySelector('.starter-deck-name').textContent;
            };
        });
        
        document.getElementById('welcome-continue').onclick = (e) => {
            if (!this.selectedStarterDeck) return;
            
            const btn = e.currentTarget;
            
            // Grant starter deck to player
            this.grantStarterDeck(this.selectedStarterDeck);
            
            // Button press effect
            btn.style.transform = 'scale(0.95)';
            btn.style.boxShadow = '0 0 60px rgba(200, 200, 220, 0.4)';
            btn.disabled = true;
            
            setTimeout(() => {
                btn.style.transition = 'all 0.4s ease-out';
                btn.style.opacity = '0';
                btn.style.transform = 'scale(1.05)';
                
                // Animate decks floating up and fading
                document.querySelectorAll('.starter-deck').forEach((deck, i) => {
                    deck.style.transition = 'all 0.5s ease-out';
                    deck.style.transitionDelay = `${i * 0.08}s`;
                    deck.style.opacity = '0';
                    deck.style.transform = 'translateY(-40px) scale(0.8)';
                });
                
                // Fade out other content
                // Start transitioning class which triggers CSS exit animations
                welcomeScreen.classList.add('transitioning');
            }, 100);
            
            // Open home screen beneath
            setTimeout(() => {
                document.getElementById('home-screen').classList.add('open');
                document.getElementById('home-screen').classList.add('entering');
            }, 400);
            
            // Remove welcome screen
            setTimeout(() => {
                welcomeScreen.classList.remove('open');
                welcomeScreen.classList.remove('transitioning');
                document.getElementById('home-screen').classList.remove('entering');
                this.isOpen = true;
                this.updateDisplay();
            }, 900);
        };
    },
    
    grantStarterDeck(deckId) {
        // Grant starter deck cards to player's collection
        const starterDecks = {
            'city-of-flesh': {
                cryptids: ['rooftopGargoyle', 'libraryGargoyle', 'vampireInitiate', 'vampireLord', 
                           'sewerAlligator', 'kuchisakeOnna', 'hellhound', 'mothman', 'bogeyman', 
                           'theFlayer', 'decayRat'],
                kindling: ['hellpup', 'myling', 'vampireBat', 'gremlin', 'boggart'],
                pyres: ['pyre', 'freshKill', 'ratKing', 'nightfall'],
                traps: ['crossroads', 'bloodCovenant', 'turnToStone'],
                bursts: ['wakingNightmare', 'faceOff', 'rockSlide'],
                auras: ['antiVampiricBlade']
            },
            'forests-of-fear': {
                cryptids: ['matureWendigo', 'primalWendigo', 'thunderbird', 'adultBigfoot',
                           'werewolf', 'lycanthrope', 'snipe', 'rogueRazorback', 'notDeer', 
                           'jerseyDevil', 'babaYaga', 'skinwalker'],
                kindling: ['newbornWendigo', 'stormhawk', 'adolescentBigfoot', 'cursedHybrid', 'deerWoman'],
                pyres: ['burialGround', 'cursedWoods', 'animalPelts'],
                traps: ['terrify', 'hunt'],
                bursts: ['fullMoon', 'rockSlide'],
                auras: ['dauntingPresence', 'sproutWings', 'weaponizedTree', 'insatiableHunger']
            },
            'diabolical-desert': {
                // Placeholder - coming soon
                cryptids: [],
                kindling: [],
                pyres: ['pyre'],
                traps: [],
                bursts: [],
                auras: []
            }
        };
        
        const deck = starterDecks[deckId];
        if (!deck) return;
        
        // Grant copies of each card using correct function: addToCollection(cardKey, count)
        const grantCards = (keys, copies = 2) => {
            keys.forEach(key => {
                PlayerData.addToCollection(key, copies);
            });
        };
        
        grantCards(deck.cryptids, 2);
        grantCards(deck.kindling, 3);
        grantCards(deck.pyres, 4);
        grantCards(deck.traps, 2);
        grantCards(deck.bursts, 2);
        grantCards(deck.auras, 2);
        
        // Create the actual playable deck with these cards
        if (PlayerData.decks.length === 0) {
            PlayerData.createStarterDeck(deckId);
        }
        
        // Save player data
        PlayerData.starterDeck = deckId;
        PlayerData.save();
    },
    
    bindEvents() {
        console.log('[HomeScreen] Binding events...');
        
        // Animated button presses with delayed navigation
        document.getElementById('tile-decks').onclick = (e) => this.animatedPress(e.currentTarget, () => this.openDeckBuilder());
        document.getElementById('tile-shop').onclick = (e) => this.animatedPress(e.currentTarget, () => this.openShop());
        document.getElementById('tile-collection').onclick = (e) => this.animatedPress(e.currentTarget, () => this.openCollection());
        
        const qpBtn = document.getElementById('tile-quickplay');
        console.log('[HomeScreen] Quick Play button:', qpBtn);
        if (qpBtn) {
            qpBtn.onclick = (e) => this.animatedPress(e.currentTarget, () => this.openQuickPlay());
        }
        
        // Quick Play modal events
        const qpClose = document.getElementById('qp-close');
        const qpCancel = document.getElementById('qp-cancel');
        const qpBackdrop = document.querySelector('.qp-backdrop');
        
        if (qpClose) qpClose.onclick = () => this.closeQuickPlay();
        if (qpCancel) qpCancel.onclick = () => this.cancelQueue();
        if (qpBackdrop) qpBackdrop.onclick = (e) => {
            // Only close if not in queue
            if (!this.queueTimer) this.closeQuickPlay();
        };
        
        document.getElementById('qp-abyss')?.addEventListener('click', () => this.startAbyss());
        document.getElementById('qp-ai')?.addEventListener('click', () => this.startAIGame());
        document.getElementById('qp-cheat')?.addEventListener('click', () => this.startCheatBattle());
        document.getElementById('qp-quickmatch')?.addEventListener('click', () => this.startQuickMatch());
        document.getElementById('qp-private')?.addEventListener('click', () => this.openPrivateMatch());
        
        document.getElementById('btn-settings').onclick = () => this.openSettings();
        document.getElementById('btn-help').onclick = () => this.openHelp();
        document.getElementById('btn-credits').onclick = () => this.openCredits();
        document.getElementById('btn-fullscreen').onclick = () => this.toggleFullscreen();
        
        console.log('[HomeScreen] Events bound successfully');
    },
    
    // Animated button press with callback
    animatedPress(btn, callback) {
        if (!btn || btn.classList.contains('pressing')) return;
        
        btn.classList.add('pressing');
        
        // Create burst effect
        const burst = document.createElement('div');
        burst.className = 'btn-burst';
        btn.appendChild(burst);
        
        // Remove burst after animation
        setTimeout(() => burst.remove(), 600);
        
        // Execute callback after press animation
        setTimeout(() => {
            btn.classList.remove('pressing');
            if (callback) callback();
        }, 250);
    },
    
    // ==================== NAVIGATION ====================
    
    open() {
        this.isOpen = true;
        this.updateDisplay();
        document.getElementById('home-screen').classList.add('open');
        
        // Start ember particles
        this.initEmberParticles();
        
        // Hide other screens
        if (typeof MainMenu !== 'undefined') {
            document.getElementById('main-menu')?.classList.add('hidden');
        }
        document.getElementById('game-container').style.display = 'none';
    },
    
    close() {
        this.isOpen = false;
        document.getElementById('home-screen').classList.remove('open');
        
        // Stop ember particles
        this.stopEmberParticles();
    },
    
    updateDisplay() {
        // Level
        document.getElementById('home-level').textContent = `Lv.${PlayerData.level}`;
        
        // Currency
        document.getElementById('home-embers').textContent = (PlayerData.embers || 0).toLocaleString();
        document.getElementById('home-souls').textContent = (PlayerData.souls || 0).toLocaleString();
        
        // Stats
        document.getElementById('home-wins').textContent = PlayerData.stats.wins;
        document.getElementById('home-losses').textContent = PlayerData.stats.losses;
        
        const winrate = PlayerData.stats.gamesPlayed > 0 
            ? Math.round((PlayerData.stats.wins / PlayerData.stats.gamesPlayed) * 100)
            : 0;
        document.getElementById('home-winrate').textContent = `${winrate}%`;
        
        // Win streak
        const streakDisplay = document.getElementById('streak-display');
        const streakEl = document.getElementById('home-streak');
        if (PlayerData.stats.winStreak > 0) {
            streakDisplay.classList.add('active');
            streakEl.textContent = PlayerData.stats.winStreak;
        } else {
            streakDisplay.classList.remove('active');
        }
        
        // Pending packs badge
        const shopBadge = document.getElementById('shop-badge');
        if (PlayerData.pendingBoosters > 0) {
            shopBadge.classList.add('show');
            shopBadge.textContent = PlayerData.pendingBoosters;
        } else {
            shopBadge.classList.remove('show');
        }
    },
    
    // ==================== QUICK PLAY ====================
    
    openQuickPlay() {
        console.log('[QuickPlay] Opening modal...');
        
        // Always show the modal
        document.getElementById('quickplay-modal').classList.add('open');
        
        // AI mode always available
        document.getElementById('qp-ai').classList.remove('disabled');
    },
    
    closeQuickPlay() {
        const modal = document.getElementById('quickplay-modal');
        if (!modal) return;
        
        // Add closing class for exit animation
        modal.classList.add('closing');
        
        // Wait for animation then hide
        setTimeout(() => {
            modal.classList.remove('open', 'closing');
        }, 250);
    },
    
    startAIGame() {
        console.log('[QuickPlay] Starting AI game...');
        this.closeQuickPlay();
        this.close();
        this.startGame();
    },
    
    startCheatBattle() {
        console.log('[QuickPlay] Starting Cheat Battle...');
        this.closeQuickPlay();
        this.close();
        
        // Enable cheat/test mode
        window.testMode = true;
        window.cheatMode = true;
        
        // Start the game
        this.startGame();
        
        // Initialize cheat mode panel after game starts
        setTimeout(() => {
            if (typeof CheatMode !== 'undefined') {
                CheatMode.start();
            }
        }, 200);
    },
    
    // ==================== MULTIPLAYER MATCHMAKING ====================
    
    matchmakingState: {
        isSearching: false,
        startTime: null,
        timerInterval: null,
        matchId: null
    },
    
    startQuickMatch() {
        console.log('[QuickPlay] Starting Quick Match...');
        
        // Check if multiplayer is available
        if (typeof MultiplayerManager === 'undefined') {
            this.showMatchmakingError('Multiplayer system not loaded. Please refresh the page.');
            return;
        }
        
        // Show matchmaking screen
        this.showMatchmakingScreen();
        
        // Start searching for a match
        this.beginMatchmaking();
    },
    
    openPrivateMatch() {
        console.log('[QuickPlay] Opening Private Match...');
        this.showPrivateMatchScreen();
    },
    
    showMatchmakingScreen() {
        // Remove existing if present
        document.getElementById('matchmaking-screen')?.remove();
        
        const screen = document.createElement('div');
        screen.id = 'matchmaking-screen';
        screen.className = 'matchmaking-screen';
        screen.innerHTML = `
            <div class="mm-backdrop"></div>
            <div class="mm-content">
                <div class="mm-header">
                    <div class="mm-title">⚔️ Quick Match</div>
                </div>
                
                <div class="mm-status">
                    <div class="mm-spinner"></div>
                    <div class="mm-status-text" id="mm-status-text">Searching for opponent...</div>
                    <div class="mm-timer" id="mm-timer">0:00</div>
                </div>
                
                <div class="mm-info">
                    <div class="mm-info-item">
                        <span class="mm-info-label">Players in Queue:</span>
                        <span class="mm-info-value" id="mm-queue-count">--</span>
                    </div>
                </div>
                
                <div class="mm-actions">
                    <button class="mm-cancel-btn" id="mm-cancel">Cancel</button>
                </div>
                
                <div class="mm-tips">
                    <div class="mm-tip">💡 Tip: Build a balanced deck with both cryptids and spells!</div>
                </div>
            </div>
        `;
        document.body.appendChild(screen);
        
        // Bind cancel button
        document.getElementById('mm-cancel').onclick = () => this.cancelMatchmaking();
        
        // Animate in
        requestAnimationFrame(() => {
            screen.classList.add('open');
        });
    },
    
    showPrivateMatchScreen() {
        // Remove existing if present
        document.getElementById('private-match-screen')?.remove();
        
        const screen = document.createElement('div');
        screen.id = 'private-match-screen';
        screen.className = 'matchmaking-screen';
        screen.innerHTML = `
            <div class="mm-backdrop"></div>
            <div class="mm-content mm-content-private">
                <div class="mm-header">
                    <div class="mm-title">🔗 Private Match</div>
                    <button class="mm-close-btn" id="pm-close">×</button>
                </div>
                
                <div class="pm-tabs">
                    <button class="pm-tab active" id="pm-tab-create">Create Match</button>
                    <button class="pm-tab" id="pm-tab-join">Join Match</button>
                </div>
                
                <div class="pm-panel" id="pm-panel-create">
                    <div class="pm-desc">Create a private room and share the code with a friend.</div>
                    <button class="pm-action-btn" id="pm-create-btn">Create Room</button>
                    <div class="pm-code-display hidden" id="pm-code-display">
                        <div class="pm-code-label">Room Code:</div>
                        <div class="pm-code" id="pm-room-code">----</div>
                        <button class="pm-copy-btn" id="pm-copy-code">📋 Copy</button>
                    </div>
                    <div class="pm-waiting hidden" id="pm-waiting">
                        <div class="mm-spinner"></div>
                        <div>Waiting for opponent...</div>
                        <div class="mm-timer" id="pm-timer">0:00</div>
                    </div>
                </div>
                
                <div class="pm-panel hidden" id="pm-panel-join">
                    <div class="pm-desc">Enter a room code to join your friend's game.</div>
                    <div class="pm-input-group">
                        <input type="text" id="pm-join-code" class="pm-code-input" placeholder="Enter code" maxlength="6">
                        <button class="pm-action-btn" id="pm-join-btn">Join</button>
                    </div>
                    <div class="pm-join-status hidden" id="pm-join-status">
                        <div class="mm-spinner"></div>
                        <div>Connecting...</div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(screen);
        
        // Bind events
        document.getElementById('pm-close').onclick = () => this.closePrivateMatch();
        document.getElementById('pm-tab-create').onclick = () => this.switchPrivateTab('create');
        document.getElementById('pm-tab-join').onclick = () => this.switchPrivateTab('join');
        document.getElementById('pm-create-btn').onclick = () => this.createPrivateRoom();
        document.getElementById('pm-join-btn').onclick = () => this.joinPrivateRoom();
        document.getElementById('pm-copy-code').onclick = () => this.copyRoomCode();
        
        // Auto-uppercase input
        document.getElementById('pm-join-code').addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        });
        
        // Animate in
        requestAnimationFrame(() => {
            screen.classList.add('open');
        });
    },
    
    switchPrivateTab(tab) {
        const createTab = document.getElementById('pm-tab-create');
        const joinTab = document.getElementById('pm-tab-join');
        const createPanel = document.getElementById('pm-panel-create');
        const joinPanel = document.getElementById('pm-panel-join');
        
        if (tab === 'create') {
            createTab.classList.add('active');
            joinTab.classList.remove('active');
            createPanel.classList.remove('hidden');
            joinPanel.classList.add('hidden');
        } else {
            joinTab.classList.add('active');
            createTab.classList.remove('active');
            joinPanel.classList.remove('hidden');
            createPanel.classList.add('hidden');
        }
    },
    
    async beginMatchmaking() {
        this.matchmakingState.isSearching = true;
        this.matchmakingState.startTime = Date.now();
        
        // Start timer
        this.matchmakingState.timerInterval = setInterval(() => {
            this.updateMatchmakingTimer();
        }, 1000);
        
        try {
            // Connect to matchmaking server
            const result = await MultiplayerManager.findMatch();
            
            if (result.success) {
                this.matchmakingState.matchId = result.matchId;
                this.onMatchFound(result);
            }
        } catch (error) {
            console.error('[Matchmaking] Error:', error);
            if (this.matchmakingState.isSearching) {
                this.showMatchmakingError(error.message || 'Failed to connect to server');
            }
        }
    },
    
    updateMatchmakingTimer() {
        if (!this.matchmakingState.startTime) return;
        
        const elapsed = Math.floor((Date.now() - this.matchmakingState.startTime) / 1000);
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        
        const timerEl = document.getElementById('mm-timer') || document.getElementById('pm-timer');
        if (timerEl) {
            timerEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
        }
    },
    
    onMatchFound(result) {
        console.log('[Matchmaking] Match found!', result);
        
        // Update UI to show match found
        const statusEl = document.getElementById('mm-status-text');
        if (statusEl) {
            statusEl.textContent = 'Match found! Starting game...';
            statusEl.classList.add('match-found');
        }
        
        // Stop timer
        if (this.matchmakingState.timerInterval) {
            clearInterval(this.matchmakingState.timerInterval);
        }
        
        // Delay to show "match found" then start game
        setTimeout(() => {
            this.closeMatchmaking();
            this.closeQuickPlay();
            this.close();
            this.startMultiplayerGame(result);
        }, 1500);
    },
    
    startMultiplayerGame(matchData) {
        console.log('[Multiplayer] Starting game with match data:', matchData);
        console.log('[Multiplayer] Your role:', matchData.role);
        console.log('[Multiplayer] Match ID:', matchData.matchId);
        
        // Start the game in multiplayer mode
        window.isMultiplayer = true;
        window.multiplayerMatchId = matchData.matchId;
        window.multiplayerRole = matchData.role || matchData.yourRole;
        
        // Store multiplayer manager reference
        window.multiplayerManager = MultiplayerManager;
        
        // Show which role the player has
        const roleText = window.multiplayerRole === 'player' ? 'Player 1 (goes first)' : 'Player 2';
        console.log(`[Multiplayer] You are: ${roleText}`);
        
        // Show "Connecting to game room..." while we establish the connection
        this.showMultiplayerConnecting(matchData);
    },
    
    showMultiplayerConnecting(matchData) {
        // Create connecting overlay
        let overlay = document.getElementById('mp-connecting-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'mp-connecting-overlay';
            overlay.className = 'mp-connecting-overlay';
            overlay.innerHTML = `
                <div class="mp-connecting-content">
                    <div class="mm-spinner"></div>
                    <div class="mp-connecting-text">Connecting to game room...</div>
                    <div class="mp-connecting-status" id="mp-connect-status"></div>
                </div>
            `;
            document.body.appendChild(overlay);
        }
        
        requestAnimationFrame(() => overlay.classList.add('show'));
        
        // Connect to the actual game room
        this.connectToGameRoom(matchData);
    },
    
    async connectToGameRoom(matchData) {
        const statusEl = document.getElementById('mp-connect-status');
        const self = this;
        
        try {
            // Ensure client is initialized
            if (!MultiplayerManager.client) {
                MultiplayerManager.init();
            }
            
            // Set up handlers BEFORE connecting to avoid race conditions
            MultiplayerManager.client.onBothPlayersConnected = () => {
                console.log('[Multiplayer] Both players connected!');
                self.hideMultiplayerConnecting();
                self.startMultiplayerDeckSelection(matchData);
            };
            
            MultiplayerManager.client.onOpponentReady = () => {
                console.log('[Multiplayer] Opponent has selected their deck');
                self.updateWaitingStatus('Opponent ready! Waiting for you...');
            };
            
            MultiplayerManager.client.onMultiplayerGameStart = (data) => {
                console.log('[Multiplayer] Both players ready, starting game!', data);
                self.startMultiplayerBattle(data);
            };
            
            // Now connect to the game room
            if (statusEl) statusEl.textContent = 'Joining game room...';
            
            await MultiplayerManager.connectToGameRoom(matchData.matchId);
            
            if (statusEl) statusEl.textContent = 'Connected! Waiting for opponent...';
            
        } catch (error) {
            console.error('[Multiplayer] Failed to connect to game room:', error);
            if (statusEl) statusEl.textContent = 'Connection failed: ' + error.message;
            
            setTimeout(() => {
                self.hideMultiplayerConnecting();
                self.showMatchmakingError('Failed to connect to game room. Please try again.');
            }, 2000);
        }
    },
    
    hideMultiplayerConnecting() {
        const overlay = document.getElementById('mp-connecting-overlay');
        if (overlay) {
            overlay.classList.remove('show');
            setTimeout(() => overlay.remove(), 300);
        }
    },
    
    startMultiplayerDeckSelection(matchData) {
        console.log('[Multiplayer] Opening deck selection for multiplayer');
        
        // Store match data for later
        this.pendingMultiplayerMatch = matchData;
        
        // Close home screen and show deck selection
        this.close();
        this.openMultiplayerDeckSelection();
    },
    
    openMultiplayerDeckSelection() {
        // Similar to regular deck selection, but with multiplayer waiting logic
        const validDecks = PlayerData.decks.filter(d => {
            const validation = PlayerData.validateDeck(d);
            return validation.valid;
        });
        
        // Remove existing screen if present
        document.getElementById('mp-deck-selection-screen')?.remove();
        
        const screen = document.createElement('div');
        screen.id = 'mp-deck-selection-screen';
        screen.className = 'deck-selection-screen mp-deck-selection';
        
        let decksHTML = '';
        validDecks.forEach((deck, index) => {
            decksHTML += `
                <div class="ds-deck-option" data-deck-index="${index}">
                    <div class="ds-deck-name">${deck.name}</div>
                    <div class="ds-deck-cards">${deck.cards.length} cards</div>
                </div>
            `;
        });
        
        screen.innerHTML = `
            <div class="ds-backdrop"></div>
            <div class="ds-content">
                <div class="ds-header">
                    <div class="ds-title">⚔️ Select Your Deck</div>
                    <div class="ds-subtitle">Multiplayer Match</div>
                </div>
                
                <div class="mp-opponent-status" id="mp-opponent-deck-status">
                    <span class="status-icon">⏳</span>
                    <span class="status-text">Waiting for opponent to select deck...</span>
                </div>
                
                <div class="ds-decks-container">
                    ${decksHTML || '<div class="ds-no-decks">No valid decks available!</div>'}
                </div>
                
                <div class="mp-your-status" id="mp-your-deck-status" style="display: none;">
                    <span class="status-icon">✓</span>
                    <span class="status-text">Deck selected! Waiting for opponent...</span>
                </div>
            </div>
        `;
        
        document.body.appendChild(screen);
        
        // Bind deck selection events
        screen.querySelectorAll('.ds-deck-option').forEach(option => {
            option.addEventListener('click', () => {
                const deckIndex = parseInt(option.dataset.deckIndex);
                this.selectMultiplayerDeck(deckIndex, validDecks[deckIndex]);
            });
        });
        
        requestAnimationFrame(() => screen.classList.add('open'));
    },
    
    selectMultiplayerDeck(deckIndex, deck) {
        console.log('[Multiplayer] Deck selected:', deck.name);
        
        // Store selected deck
        window.selectedPlayerDeck = deck;
        window.testMode = false;
        
        // Visual feedback
        document.querySelectorAll('.ds-deck-option').forEach(opt => {
            opt.classList.remove('selected');
            opt.style.pointerEvents = 'none';
            opt.style.opacity = '0.5';
        });
        document.querySelector(`[data-deck-index="${deckIndex}"]`)?.classList.add('selected');
        document.querySelector(`[data-deck-index="${deckIndex}"]`).style.opacity = '1';
        
        // Show waiting status
        const yourStatus = document.getElementById('mp-your-deck-status');
        if (yourStatus) yourStatus.style.display = 'flex';
        
        // Send deck selection to server - include full card data
        // The server needs the actual cards to build the game state
        // IMPORTANT: deck.cards contains { cardKey, foil } references, not full card data!
        // We need to look up the actual card data from the registry
        const resolvedCards = [];
        deck.cards.forEach(entry => {
            // Look up the actual card data using DeckBuilder or CardRegistry
            let cardData = null;
            if (typeof DeckBuilder !== 'undefined' && DeckBuilder.getCard) {
                cardData = DeckBuilder.getCard(entry.cardKey);
            } else if (typeof CardRegistry !== 'undefined') {
                // Fallback to CardRegistry directly
                cardData = CardRegistry.getCryptid(entry.cardKey) || 
                           CardRegistry.getKindling(entry.cardKey) ||
                           CardRegistry.getBurst(entry.cardKey) ||
                           CardRegistry.getTrap(entry.cardKey);
            }
            
            if (cardData) {
                resolvedCards.push({
                    id: `${entry.cardKey}_${Math.random().toString(36).substr(2, 9)}`,
                    key: entry.cardKey,
                    name: cardData.name,
                    type: cardData.type || 'cryptid',
                    cost: cardData.cost || 0,
                    hp: cardData.hp || 1,
                    atk: cardData.atk || cardData.attack || 0,
                    attack: cardData.atk || cardData.attack || 0,
                    element: cardData.element,
                    rarity: cardData.rarity,
                    abilities: cardData.abilities || [],
                    effects: cardData.effects || [],
                    art: cardData.art || cardData.sprite,
                    foil: entry.foil || false,
                    isKindling: cardData.isKindling || false
                });
            } else {
                console.warn('[Multiplayer] Could not find card data for:', entry.cardKey);
            }
        });
        
        // Filter out any kindling from main deck cards (just in case)
        const mainDeckCards = resolvedCards.filter(c => !c.isKindling && c.type !== 'kindling');
        
        const deckData = {
            deckName: deck.name,
            cardCount: mainDeckCards.length,
            cards: mainDeckCards,
            // Also send kindling - get from the deck's kindling or build default
            kindling: this.getDefaultKindling().map(k => ({
                id: `kindling_${k.key || k.name}_${Math.random().toString(36).substr(2, 9)}`,
                key: k.key,
                name: k.name || 'Kindling',
                type: 'cryptid', // Type is cryptid for gameplay, but marked as kindling
                hp: k.hp || 1,
                atk: k.atk || k.attack || 1,
                attack: k.atk || k.attack || 1,
                isKindling: true
            }))
        };
        
        console.log('[Multiplayer] Sending deck with', deckData.cards.length, 'cards and', deckData.kindling.length, 'kindling');
        console.log('[Multiplayer] First card:', deckData.cards[0]);
        MultiplayerManager.sendDeckSelected(deckData);
    },
    
    getDefaultKindling() {
        // Build a default kindling pool from CardRegistry
        const pool = [];
        
        if (typeof CardRegistry !== 'undefined' && CardRegistry.getAllKindlingKeys) {
            const kindlingKeys = CardRegistry.getAllKindlingKeys();
            console.log('[Multiplayer] Found kindling keys:', kindlingKeys);
            
            // Add 2 of each kindling type
            kindlingKeys.forEach(key => {
                const kindling = CardRegistry.getKindling(key);
                if (kindling) {
                    for (let i = 0; i < 2; i++) {
                        pool.push({
                            ...kindling,
                            key: key,
                            id: `kindling_${key}_${i}_${Date.now()}`,
                            type: 'cryptid', // Type is cryptid for gameplay purposes
                            isKindling: true  // But marked as kindling for resource handling
                        });
                    }
                }
            });
        }
        
        console.log('[Multiplayer] Built kindling pool with', pool.length, 'kindling');
        
        // Ensure all kindling cards are properly marked
        return pool.length > 0 ? pool.map(k => ({ ...k, isKindling: true })) : [
            { key: 'basicKindling', name: 'Basic Kindling', hp: 1, atk: 1, type: 'cryptid', isKindling: true }
        ];
    },
    
    updateWaitingStatus(text) {
        const statusEl = document.getElementById('mp-opponent-deck-status');
        if (statusEl) {
            statusEl.querySelector('.status-icon').textContent = '✓';
            statusEl.querySelector('.status-text').textContent = text;
            statusEl.classList.add('ready');
        }
    },
    
    startMultiplayerBattle(data) {
        console.log('[Multiplayer] Starting battle!', data);
        console.log('[Multiplayer] Server says first player is:', data.firstPlayer);
        console.log('[Multiplayer] Your role is:', window.multiplayerRole);
        
        // Close deck selection
        const deckScreen = document.getElementById('mp-deck-selection-screen');
        if (deckScreen) {
            deckScreen.classList.remove('open');
            setTimeout(() => deckScreen.remove(), 300);
        }
        
        // Store game data from server
        window.multiplayerGameData = data;
        window.multiplayerFirstPlayer = data.firstPlayer;
        
        // Determine if THIS player goes first
        // data.firstPlayer is 'player' or 'enemy' from server perspective
        // window.multiplayerRole is our role ('player' or 'enemy')
        const iGoFirst = (data.firstPlayer === window.multiplayerRole);
        window.playerGoesFirst = iGoFirst;
        
        console.log('[Multiplayer] Do I go first?', iGoFirst);
        
        // Ensure turn order overlay exists
        if (typeof MainMenu !== 'undefined' && !document.getElementById('turn-order-overlay')) {
            MainMenu.createTurnOrderOverlay();
        }
        const turnOrderOverlay = document.getElementById('turn-order-overlay');
        
        // Show coin flip / turn order animation
        TransitionEngine.slide(() => {
            // At hidden point: show turn order overlay
            if (turnOrderOverlay) {
                turnOrderOverlay.classList.add('active');
            }
        }).then(() => {
            // After transition reveals coin flip, start the animation
            if (typeof MainMenu !== 'undefined') {
                // Pass server's firstPlayer decision to the animation
                MainMenu.showTurnOrderAnimation(() => {
                    // Show game container
                    document.getElementById('game-container').style.display = 'flex';
                    if (typeof applyBattlefieldBackgrounds === 'function') {
                        applyBattlefieldBackgrounds();
                    }
                    
                    setTimeout(() => {
                        if (turnOrderOverlay) {
                            turnOrderOverlay.classList.remove('active');
                        }
                        
                        // Initialize multiplayer game
                        setTimeout(() => {
                            this.initMultiplayerGame(data);
                        }, 400);
                    }, 50);
                }, data.firstPlayer); // Pass server's firstPlayer ('player' or 'enemy')
            } else {
                document.getElementById('game-container').style.display = 'flex';
                this.initMultiplayerGame(data);
            }
        });
    },
    
    initMultiplayerGame(data) {
        console.log('[Multiplayer] Initializing game with server state');
        console.log('[Multiplayer] Initial state:', data.initialState);
        console.log('[Multiplayer] isYourTurn:', data.isYourTurn);
        
        // Call the regular initGame but in multiplayer mode
        if (typeof initGame === 'function') {
            initGame();
        }
        
        // Apply server's initial state to the game object
        setTimeout(() => {
            this.applyServerState(data.initialState);
        }, 50);
        
        // Initialize the multiplayer bridge and UI hooks AFTER the game is created
        setTimeout(() => {
            if (typeof MultiplayerGameBridge !== 'undefined') {
                MultiplayerGameBridge.init();
                
                // IMPORTANT: Explicitly set turn state from server data
                MultiplayerGameBridge.isMyTurn = data.isYourTurn === true;
                MultiplayerGameBridge.updateTurnUI();
                console.log('[Multiplayer] Game bridge initialized, isMyTurn:', MultiplayerGameBridge.isMyTurn);
                
                // Initialize UI hooks after bridge
                setTimeout(() => {
                    if (typeof MultiplayerUIHooks !== 'undefined') {
                        MultiplayerUIHooks.init();
                        console.log('[Multiplayer] UI hooks initialized');
                    }
                    
                    // Render with server state
                    if (typeof renderHand === 'function') renderHand();
                    if (typeof renderField === 'function') renderField();
                    if (typeof updatePyreDisplay === 'function') updatePyreDisplay();
                }, 100);
            } else {
                console.warn('[Multiplayer] MultiplayerGameBridge not found!');
            }
        }, 100);
        
        // The game is now running - actions will be sent through MultiplayerGameBridge
        console.log('[Multiplayer] Game initialized. You are:', window.multiplayerRole);
        console.log('[Multiplayer] First player:', data.firstPlayer);
    },
    
    applyServerState(serverState) {
        if (!serverState) {
            console.warn('[Multiplayer] No server state to apply');
            return;
        }
        
        const game = window.game;
        if (!game) {
            console.warn('[Multiplayer] Game object not ready');
            return;
        }
        
        console.log('[Multiplayer] Applying server state to game');
        
        // The server sends state from our perspective:
        // - yourHand: our hand
        // - opponentHandCount: number of cards opponent has
        // - playerField/enemyField: field state
        // - playerPyre/enemyPyre: pyre amounts
        
        // Apply hand - filter out any kindling that might have slipped in
        if (serverState.yourHand) {
            game.playerHand = serverState.yourHand.filter(c => !c.isKindling && c.type !== 'kindling');
            console.log('[Multiplayer] Set player hand:', game.playerHand.length, 'cards');
            
            // Log warning if any kindling was filtered
            const kindlingInHand = serverState.yourHand.filter(c => c.isKindling || c.type === 'kindling');
            if (kindlingInHand.length > 0) {
                console.warn('[Multiplayer] Filtered', kindlingInHand.length, 'kindling cards from hand');
            }
        }
        
        // Apply fields
        if (serverState.playerField) {
            game.playerField = serverState.playerField;
        }
        if (serverState.enemyField) {
            game.enemyField = serverState.enemyField;
        }
        
        // Apply pyre
        if (serverState.playerPyre !== undefined) {
            game.playerPyre = serverState.playerPyre;
        }
        if (serverState.enemyPyre !== undefined) {
            game.enemyPyre = serverState.enemyPyre;
        }
        
        // Apply deaths
        if (serverState.playerDeaths !== undefined) {
            game.playerDeaths = serverState.playerDeaths;
        }
        if (serverState.enemyDeaths !== undefined) {
            game.enemyDeaths = serverState.enemyDeaths;
        }
        
        // Apply turn info - use isYourTurn boolean if available (more reliable)
        // The server already handles perspective mapping
        if (serverState.currentTurn !== undefined) {
            // Server sends currentTurn already perspective-mapped:
            // 'player' means it's OUR turn, 'enemy' means it's opponent's turn
            game.currentTurn = serverState.currentTurn;
            console.log('[Multiplayer] Set currentTurn:', game.currentTurn);
        }
        if (serverState.phase) {
            game.phase = serverState.phase;
        }
        if (serverState.turnNumber !== undefined) {
            game.turnNumber = serverState.turnNumber;
        }
        
        // Apply kindling if available
        if (serverState.yourKindling) {
            game.playerKindling = serverState.yourKindling;
            console.log('[Multiplayer] Set kindling pool:', game.playerKindling.length, 'kindling');
            if (game.playerKindling.length > 0) {
                console.log('[Multiplayer] First kindling:', game.playerKindling[0]);
            }
        }
        
        console.log('[Multiplayer] State applied - Hand:', game.playerHand?.length, 'Pyre:', game.playerPyre, 'Kindling:', game.playerKindling?.length);
    },
    
    cancelMatchmaking() {
        console.log('[Matchmaking] Cancelled by user');
        
        this.matchmakingState.isSearching = false;
        
        if (this.matchmakingState.timerInterval) {
            clearInterval(this.matchmakingState.timerInterval);
            this.matchmakingState.timerInterval = null;
        }
        
        // Disconnect from matchmaking
        if (typeof MultiplayerManager !== 'undefined') {
            MultiplayerManager.cancelSearch();
        }
        
        this.closeMatchmaking();
    },
    
    closeMatchmaking() {
        const screen = document.getElementById('matchmaking-screen');
        if (screen) {
            screen.classList.add('closing');
            setTimeout(() => screen.remove(), 300);
        }
        
        this.matchmakingState = {
            isSearching: false,
            startTime: null,
            timerInterval: null,
            matchId: null
        };
    },
    
    closePrivateMatch() {
        // Cancel any pending operations
        this.cancelMatchmaking();
        
        const screen = document.getElementById('private-match-screen');
        if (screen) {
            screen.classList.add('closing');
            setTimeout(() => screen.remove(), 300);
        }
    },
    
    async createPrivateRoom() {
        console.log('[Private] Creating room...');
        
        const createBtn = document.getElementById('pm-create-btn');
        const codeDisplay = document.getElementById('pm-code-display');
        const waiting = document.getElementById('pm-waiting');
        
        createBtn.disabled = true;
        createBtn.textContent = 'Creating...';
        
        try {
            const result = await MultiplayerManager.createMatch();
            
            if (result.success) {
                // Show room code
                createBtn.classList.add('hidden');
                codeDisplay.classList.remove('hidden');
                document.getElementById('pm-room-code').textContent = result.matchCode;
                
                // Show waiting indicator
                waiting.classList.remove('hidden');
                
                // Start timer
                this.matchmakingState.startTime = Date.now();
                this.matchmakingState.isSearching = true;
                this.matchmakingState.matchId = result.matchId;
                this.matchmakingState.timerInterval = setInterval(() => {
                    this.updateMatchmakingTimer();
                }, 1000);
                
                // Wait for opponent
                this.waitForOpponent(result.matchId);
            }
        } catch (error) {
            console.error('[Private] Create error:', error);
            createBtn.disabled = false;
            createBtn.textContent = 'Create Room';
            this.showMatchmakingError(error.message || 'Failed to create room');
        }
    },
    
    async joinPrivateRoom() {
        const codeInput = document.getElementById('pm-join-code');
        const code = codeInput.value.trim().toUpperCase();
        
        if (code.length < 4) {
            codeInput.classList.add('error');
            setTimeout(() => codeInput.classList.remove('error'), 500);
            return;
        }
        
        console.log('[Private] Joining room:', code);
        
        const joinBtn = document.getElementById('pm-join-btn');
        const joinStatus = document.getElementById('pm-join-status');
        
        joinBtn.disabled = true;
        joinStatus.classList.remove('hidden');
        
        try {
            const result = await MultiplayerManager.joinMatch(code);
            
            if (result.success) {
                this.onMatchFound(result);
            }
        } catch (error) {
            console.error('[Private] Join error:', error);
            joinBtn.disabled = false;
            joinStatus.classList.add('hidden');
            this.showMatchmakingError(error.message || 'Failed to join room');
        }
    },
    
    async waitForOpponent(matchId) {
        // This would be handled by WebSocket events from MultiplayerClient
        // For now, set up a listener for match start
        if (typeof MultiplayerClient !== 'undefined' && window.multiplayerClient) {
            window.multiplayerClient.onMatchStart = (data) => {
                this.onMatchFound({ matchId, role: data.role, success: true });
            };
        }
    },
    
    copyRoomCode() {
        const code = document.getElementById('pm-room-code').textContent;
        navigator.clipboard.writeText(code).then(() => {
            const btn = document.getElementById('pm-copy-code');
            btn.textContent = '✓ Copied!';
            setTimeout(() => {
                btn.textContent = '📋 Copy';
            }, 2000);
        });
    },
    
    showMatchmakingError(message) {
        this.closeMatchmaking();
        
        const error = document.createElement('div');
        error.className = 'mm-error-popup';
        error.innerHTML = `
            <div class="mm-error-content">
                <div class="mm-error-icon">⚠️</div>
                <div class="mm-error-title">Connection Error</div>
                <div class="mm-error-msg">${message}</div>
                <button class="mm-error-btn" onclick="this.parentElement.parentElement.remove()">OK</button>
            </div>
        `;
        document.body.appendChild(error);
        
        requestAnimationFrame(() => error.classList.add('show'));
    },
    
    startAbyss() {
        console.log('[QuickPlay] Starting ABYSS Mode...');
        this.closeQuickPlay();
        this.close();
        
        // Check if AbyssUI is loaded
        if (typeof AbyssUI === 'undefined') {
            console.warn('[QuickPlay] AbyssUI not defined, checking globals...');
            console.log('[QuickPlay] window.AbyssUI:', typeof window.AbyssUI);
            console.log('[QuickPlay] window.AbyssEngine:', typeof window.AbyssEngine);
            console.log('[QuickPlay] window.AbyssState:', typeof window.AbyssState);
        }
        
        // Try to open ABYSS setup screen
        if (typeof AbyssUI !== 'undefined' && AbyssUI.openSetup) {
            try {
                AbyssUI.openSetup();
            } catch (e) {
                console.error('[QuickPlay] Error opening ABYSS Mode:', e);
                this.showAbyssError(e.message);
            }
        } else if (typeof window.AbyssUI !== 'undefined' && window.AbyssUI.openSetup) {
            // Try explicit window reference
            try {
                window.AbyssUI.openSetup();
            } catch (e) {
                console.error('[QuickPlay] Error opening ABYSS Mode (window):', e);
                this.showAbyssError(e.message);
            }
        } else {
            console.error('[QuickPlay] ABYSS Mode not loaded. AbyssUI:', typeof AbyssUI);
            this.showAbyssError('ABYSS Mode module failed to load. This may be caused by corrupted save data.');
        }
    },
    
    showAbyssError(details) {
        const msg = document.createElement('div');
        msg.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: rgba(0,0,0,0.95); border: 2px solid #e57373; padding: 30px 50px;
            border-radius: 12px; color: #e8e0d5; font-family: 'Cinzel', serif;
            font-size: 16px; z-index: 99999; text-align: center; max-width: 450px;
        `;
        msg.innerHTML = `
            <div style="color: #e57373; font-size: 20px; margin-bottom: 15px;">⚠️ ABYSS Mode Error</div>
            <div>ABYSS Mode failed to load.</div>
            <div style="font-size: 12px; color: #888; margin-top: 10px; margin-bottom: 15px;">${details || 'Unknown error'}</div>
            <div style="font-size: 11px; color: #666; margin-bottom: 15px;">
                If this persists, try clearing your save data below.
            </div>
            <button onclick="localStorage.removeItem('cryptidFates_playerData'); location.reload();" style="
                margin: 5px; padding: 10px 20px; background: #c9302c; border: none;
                color: white; cursor: pointer; border-radius: 6px; font-family: inherit;
            ">Reset Save & Reload</button>
            <button onclick="location.reload();" style="
                margin: 5px; padding: 10px 20px; background: #5cb85c; border: none;
                color: white; cursor: pointer; border-radius: 6px; font-family: inherit;
            ">Just Reload</button>
            <button onclick="this.parentElement.remove(); HomeScreen.open();" style="
                margin: 5px; padding: 10px 20px; background: #666; border: none;
                color: white; cursor: pointer; border-radius: 6px; font-family: inherit;
            ">Cancel</button>
        `;
        document.body.appendChild(msg);
    },
    
    toggleFullscreen() {
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
            const elem = document.documentElement;
            if (elem.requestFullscreen) {
                elem.requestFullscreen();
            } else if (elem.webkitRequestFullscreen) {
                elem.webkitRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            }
        }
    },
    
    openCredits() {
        alert('Cryptid Fates\n\nA card battler by the Summoner\'s Guild\n\nVersion 0.1 Beta');
    },
    
    createDeckSelectionScreen() {
        const screen = document.createElement('div');
        screen.id = 'deck-selection-screen';
        screen.innerHTML = `
            <div class="deck-select-content">
                <div class="deck-select-header">
                    <button class="deck-select-back" id="deck-select-back">← Back</button>
                    <h2 class="deck-select-title">Choose Your Deck</h2>
                    <div class="deck-select-spacer"></div>
                </div>
                <div class="deck-select-list" id="deck-select-list"></div>
                <div class="deck-select-footer">
                    <button class="deck-select-btn disabled" id="deck-select-play" disabled>Select a Deck to Play</button>
                </div>
            </div>
        `;
        document.body.appendChild(screen);
        
        // Bind events
        document.getElementById('deck-select-back').onclick = () => this.closeDeckSelection();
    },
    
    selectedBattleDeck: null,
    
    openDeckSelection() {
        // Create screen if not exists
        if (!document.getElementById('deck-selection-screen')) {
            this.createDeckSelectionScreen();
        }
        
        // Get valid decks
        const validDecks = PlayerData.decks.filter(d => {
            const validation = PlayerData.validateDeck(d);
            return validation.valid;
        });
        
        const container = document.getElementById('deck-select-list');
        
        if (validDecks.length === 0) {
            container.innerHTML = `
                <div class="deck-select-empty">
                    <div class="deck-select-empty-icon">📜</div>
                    <div class="deck-select-empty-text">No ready decks found</div>
                    <div class="deck-select-empty-hint">Build a deck with 55-100 cards to battle!</div>
                    <div class="deck-select-empty-buttons">
                        <button class="deck-select-builder-btn" onclick="TransitionEngine.fade(() => { HomeScreen.closeDeckSelection(); DeckBuilder.open(); });">Open Deck Builder</button>
                        <button class="deck-select-test-btn" onclick="HomeScreen.startGameWithDeck(null);">Use Random Deck (Test)</button>
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = validDecks.map((deck, i) => {
                const cardCount = deck.cards?.length || 0;
                const cryptidCount = deck.cards?.filter(c => {
                    const card = DeckBuilder?.getCard?.(c.cardKey);
                    return card?.type === 'cryptid';
                }).length || 0;
                
                return `
                    <div class="deck-select-deck" data-deck-index="${i}" onclick="HomeScreen.selectBattleDeck(${i})">
                        <div class="deck-select-deck-icon">📜</div>
                        <div class="deck-select-deck-info">
                            <div class="deck-select-deck-name">${deck.name || 'Unnamed Deck'}</div>
                            <div class="deck-select-deck-stats">${cardCount} cards • ${cryptidCount} cryptids</div>
                        </div>
                        <div class="deck-select-deck-check">✓</div>
                    </div>
                `;
            }).join('');
        }
        
        this.selectedBattleDeck = null;
        document.getElementById('deck-selection-screen').classList.add('open');
        
        // Bind play button
        document.getElementById('deck-select-play').onclick = () => {
            if (this.selectedBattleDeck !== null) {
                this.startGameWithDeck(this.selectedBattleDeck);
            }
        };
    },
    
    selectBattleDeck(index) {
        const decks = document.querySelectorAll('.deck-select-deck');
        decks.forEach(d => d.classList.remove('selected'));
        decks[index]?.classList.add('selected');
        
        this.selectedBattleDeck = index;
        
        const btn = document.getElementById('deck-select-play');
        btn.disabled = false;
        btn.classList.remove('disabled');
        btn.textContent = 'Battle!';
    },
    
    closeDeckSelection() {
        const screen = document.getElementById('deck-selection-screen');
        if (!screen) return;
        
        // Add closing class for exit animation
        screen.classList.add('closing');
        
        // Wait for animation then hide and open home
        setTimeout(() => {
            screen.classList.remove('open', 'closing');
            this.open();
        }, 300);
    },
    
    startGame() {
        this.close();
        
        // Always show deck selection screen
        this.openDeckSelection();
    },
    
    startGameWithDeck(deckIndex) {
        // Set the selected deck for the game
        if (deckIndex !== null) {
            const validDecks = PlayerData.decks.filter(d => {
                const validation = PlayerData.validateDeck(d);
                return validation.valid;
            });
            window.selectedPlayerDeck = validDecks[deckIndex];
            window.testMode = false;
        } else {
            window.testMode = true;
        }
        
        // Ensure turn order overlay exists
        if (typeof MainMenu !== 'undefined' && !document.getElementById('turn-order-overlay')) {
            MainMenu.createTurnOrderOverlay();
        }
        const turnOrderOverlay = document.getElementById('turn-order-overlay');
        
        // Deal Slide transition to coin flip screen (NOT battle screen yet)
        TransitionEngine.slide(() => {
            document.getElementById('deck-selection-screen')?.classList.remove('open');
            this.close();
            // At hidden point: show turn order overlay (NOT the game container yet)
            if (turnOrderOverlay) {
                turnOrderOverlay.classList.add('active');
            }
        }).then(() => {
            // After transition reveals coin flip, start the animation
            if (typeof MainMenu !== 'undefined') {
                MainMenu.showTurnOrderAnimation(() => {
                    // Show game container and apply backgrounds BEHIND the overlay
                    document.getElementById('game-container').style.display = 'flex';
                    if (typeof applyBattlefieldBackgrounds === 'function') {
                        applyBattlefieldBackgrounds();
                    }
                    
                    // Give the DOM a moment to render the battle screen
                    setTimeout(() => {
                        // Fade out the overlay to reveal battle screen
                        if (turnOrderOverlay) {
                            turnOrderOverlay.classList.remove('active');
                        }
                        
                        // After fade out, init the game
                        setTimeout(() => {
                            if (typeof initGame === 'function') initGame();
                        }, 400);
                    }, 50);
                });
            } else {
                // Fallback: no MainMenu, just show battle screen
                document.getElementById('game-container').style.display = 'flex';
                if (typeof applyBattlefieldBackgrounds === 'function') {
                    applyBattlefieldBackgrounds();
                }
                if (typeof initGame === 'function') initGame();
            }
        });
    },
    
    openDeckBuilder() {
        if (typeof DeckBuilder === 'undefined') return;
        TransitionEngine.fade(() => {
            this.close();
            DeckBuilder.open();
        });
    },
    
    openShop() {
        if (typeof Shop === 'undefined') return;
        TransitionEngine.fade(() => {
            this.close();
            Shop.open();
        });
    },
    
    openCollection() {
        if (typeof Collection === 'undefined') return;
        TransitionEngine.fade(() => {
            this.close();
            Collection.open();
        });
    },
    
    openSettings() {
        alert('Settings coming soon!');
    },
    
    openHelp() {
        alert('Tutorial coming soon!');
    },
    
    // ==================== EMBER PARTICLE SYSTEM ====================
    
    emberParticles: [],
    emberAnimationId: null,
    
    initEmberParticles() {
        const canvas = document.getElementById('ember-particles');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        // Set canvas size
        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resize();
        window.addEventListener('resize', resize);
        
        // Ember colors - warm oranges, reds, yellows
        const emberColors = [
            { r: 255, g: 100, b: 20 },   // Orange
            { r: 255, g: 60, b: 10 },    // Red-orange
            { r: 255, g: 180, b: 50 },   // Yellow-orange
            { r: 255, g: 140, b: 30 },   // Amber
            { r: 200, g: 50, b: 20 },    // Deep red
        ];
        
        // Create initial embers
        this.emberParticles = [];
        const particleCount = Math.min(40, Math.floor(window.innerWidth / 30));
        
        for (let i = 0; i < particleCount; i++) {
            this.emberParticles.push(this.createEmber(canvas, emberColors));
        }
        
        // Animation loop
        const animate = () => {
            if (!this.isOpen) {
                this.emberAnimationId = null;
                return;
            }
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            this.emberParticles.forEach((ember, index) => {
                // Update position
                ember.y -= ember.speed;
                ember.x += Math.sin(ember.wobble) * ember.wobbleSpeed;
                ember.wobble += ember.wobbleInc;
                ember.life -= ember.decay;
                ember.size *= 0.9995; // Slowly shrink
                
                // Respawn if off screen or dead
                if (ember.y < -20 || ember.life <= 0 || ember.size < 0.5) {
                    this.emberParticles[index] = this.createEmber(canvas, emberColors, true);
                    return;
                }
                
                // Draw ember with glow
                const alpha = ember.life * ember.baseAlpha;
                
                // Outer glow
                const gradient = ctx.createRadialGradient(
                    ember.x, ember.y, 0,
                    ember.x, ember.y, ember.size * 3
                );
                gradient.addColorStop(0, `rgba(${ember.color.r}, ${ember.color.g}, ${ember.color.b}, ${alpha * 0.8})`);
                gradient.addColorStop(0.4, `rgba(${ember.color.r}, ${ember.color.g}, ${ember.color.b}, ${alpha * 0.3})`);
                gradient.addColorStop(1, `rgba(${ember.color.r}, ${ember.color.g}, ${ember.color.b}, 0)`);
                
                ctx.beginPath();
                ctx.arc(ember.x, ember.y, ember.size * 3, 0, Math.PI * 2);
                ctx.fillStyle = gradient;
                ctx.fill();
                
                // Core
                ctx.beginPath();
                ctx.arc(ember.x, ember.y, ember.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 240, 200, ${alpha})`;
                ctx.fill();
            });
            
            this.emberAnimationId = requestAnimationFrame(animate);
        };
        
        animate();
    },
    
    createEmber(canvas, colors, fromBottom = false) {
        const color = colors[Math.floor(Math.random() * colors.length)];
        return {
            x: Math.random() * canvas.width,
            y: fromBottom ? canvas.height + 20 : Math.random() * canvas.height,
            size: Math.random() * 3 + 1.5,
            speed: Math.random() * 0.8 + 0.3,
            wobble: Math.random() * Math.PI * 2,
            wobbleSpeed: Math.random() * 0.5 - 0.25,
            wobbleInc: Math.random() * 0.02 + 0.01,
            life: 1,
            decay: Math.random() * 0.002 + 0.001,
            baseAlpha: Math.random() * 0.4 + 0.3,
            color: color
        };
    },
    
    stopEmberParticles() {
        if (this.emberAnimationId) {
            cancelAnimationFrame(this.emberAnimationId);
            this.emberAnimationId = null;
        }
        this.emberParticles = [];
    }
};

// ==================== GAME OVER INTEGRATION ====================

window.showGameOver = function(isWin, stats = {}) {
    const matchData = {
        isWin,
        isHuman: false,
        stats: {
            kills: stats.kills || window.game?.enemyDeaths || 0,
            playerDeaths: stats.playerDeaths || window.game?.playerDeaths || 0,
            damageDealt: stats.damageDealt || 0,
            turns: stats.turns || window.game?.turnNumber || 0,
            spellsCast: stats.spellsCast || 0,
            evolutions: stats.evolutions || 0,
            perfectWin: (window.game?.playerDeaths || 0) === 0 && isWin
        },
        duration: stats.duration || 0,
        deckName: stats.deckName || 'Test Deck'
    };
    
    if (typeof WinScreen !== 'undefined') {
        WinScreen.show(matchData);
    }
};

// Don't auto-initialize - let auth flow control this
// HomeScreen.init() will be called by GameFlow after auth completes

console.log('Home Screen loaded');