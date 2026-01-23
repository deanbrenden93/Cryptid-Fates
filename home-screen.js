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
                    <div class="qp-section-title">🤖 Solo</div>
                    <div class="qp-mode" id="qp-ai">
                        <div class="qp-mode-main">
                            <div class="qp-mode-icon">🧠</div>
                            <div class="qp-mode-info">
                                <div class="qp-mode-name">Play vs AI</div>
                                <div class="qp-mode-desc">Practice against the Warden</div>
                            </div>
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
                    <div class="qp-mode" id="qp-bo1">
                        <div class="qp-mode-main">
                            <div class="qp-mode-icon">⚔️</div>
                            <div class="qp-mode-info">
                                <div class="qp-mode-name">Quick Match</div>
                                <div class="qp-mode-desc">Best of 1 • ~8 minutes</div>
                            </div>
                        </div>
                        <div class="qp-mode-rewards">
                            <span class="reward-item"><img src="sprites/embers-icon.png" class="embers-img" alt=""> 15</span>
                            <span class="reward-item">⭐ 20 XP</span>
                        </div>
                    </div>
                    <div class="qp-mode" id="qp-bo3">
                        <div class="qp-mode-main">
                            <div class="qp-mode-icon">🏆</div>
                            <div class="qp-mode-info">
                                <div class="qp-mode-name">Ranked Match</div>
                                <div class="qp-mode-desc">Best of 3 • ~20 minutes</div>
                            </div>
                        </div>
                        <div class="qp-mode-rewards">
                            <span class="reward-item"><img src="sprites/embers-icon.png" class="embers-img" alt=""> 30</span>
                            <span class="reward-item">⭐ 50 XP</span>
                        </div>
                    </div>
                </div>
                
                <div class="qp-queue" id="qp-queue">
                    <div class="qp-queue-spinner"></div>
                    <div class="qp-queue-text">
                        <span id="qp-status">Searching for opponent...</span>
                        <span class="qp-queue-timer" id="qp-timer">0:00</span>
                    </div>
                    <button class="qp-btn cancel" id="qp-cancel">Cancel</button>
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
        
        document.getElementById('qp-ai')?.addEventListener('click', () => this.startAIGame());
        document.getElementById('qp-cheat')?.addEventListener('click', () => this.startCheatBattle());
        document.getElementById('qp-bo1')?.addEventListener('click', () => this.startQuickPlay('bo1'));
        document.getElementById('qp-bo3')?.addEventListener('click', () => this.startQuickPlay('bo3'));
        
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
    
    queueTimer: null,
    queueStartTime: null,
    
    openQuickPlay() {
        console.log('[QuickPlay] Opening modal...');
        
        // Reset queue UI
        document.getElementById('qp-queue').classList.remove('active');
        document.getElementById('qp-timer').textContent = '0:00';
        
        // Always show the modal first
        document.getElementById('quickplay-modal').classList.add('open');
        
        // Check if player has a valid deck for multiplayer modes
        const validDeck = PlayerData.decks.find(d => PlayerData.validateDeck(d).valid);
        
        // AI mode always available, multiplayer requires valid deck
        document.getElementById('qp-ai').classList.remove('disabled');
        
        if (!validDeck) {
            document.getElementById('qp-bo1').classList.add('disabled');
            document.getElementById('qp-bo3').classList.add('disabled');
        } else {
            document.getElementById('qp-bo1').classList.remove('disabled');
            document.getElementById('qp-bo3').classList.remove('disabled');
        }
    },
    
    closeQuickPlay() {
        document.getElementById('quickplay-modal').classList.remove('open');
        this.stopQueueTimer();
        
        // Cancel matchmaking if in progress
        if (typeof window.Multiplayer !== 'undefined' && window.Multiplayer.isSearching) {
            window.Multiplayer.cancelMatchmaking();
        }
    },
    
    cancelQueue() {
        this.stopQueueTimer();
        document.getElementById('qp-queue').classList.remove('active');
        
        // Cancel matchmaking
        if (typeof window.Multiplayer !== 'undefined' && window.Multiplayer.isSearching) {
            window.Multiplayer.cancelMatchmaking();
        }
    },
    
    startQueueTimer() {
        this.queueStartTime = Date.now();
        this.updateQueueTimer();
        this.queueTimer = setInterval(() => this.updateQueueTimer(), 1000);
    },
    
    stopQueueTimer() {
        if (this.queueTimer) {
            clearInterval(this.queueTimer);
            this.queueTimer = null;
        }
        this.queueStartTime = null;
    },
    
    updateQueueTimer() {
        if (!this.queueStartTime) return;
        const elapsed = Math.floor((Date.now() - this.queueStartTime) / 1000);
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        document.getElementById('qp-timer').textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
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
    
    startQuickPlay(mode) {
        console.log('[QuickPlay] Starting matchmaking, mode:', mode);
        
        // Get first valid deck
        const validDeck = PlayerData.decks.find(d => PlayerData.validateDeck(d).valid);
        if (!validDeck) {
            showMessage('No valid deck found!');
            return;
        }
        
        // Show queue UI
        document.getElementById('qp-queue').classList.add('active');
        document.getElementById('qp-status').textContent = 'Searching for opponent...';
        this.startQueueTimer();
        
        // Start matchmaking
        if (typeof window.Multiplayer !== 'undefined' && window.Multiplayer) {
            window.Multiplayer.findMatch(mode, validDeck.id);
        } else {
            console.error('[QuickPlay] Multiplayer object not found!');
            document.getElementById('qp-status').textContent = 'Multiplayer not available';
            setTimeout(() => {
                this.cancelQueue();
            }, 2000);
        }
    },
    
    onMatchFound(matchData) {
        // Called by Multiplayer when match is found
        this.stopQueueTimer();
        this.closeQuickPlay();
        
        TransitionEngine.slide(() => {
            this.close();
        }).then(() => {
            if (typeof startMultiplayerGame === 'function') {
                startMultiplayerGame(matchData);
            }
        });
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
        document.getElementById('deck-selection-screen')?.classList.remove('open');
        this.open();
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
        
        // Deal Slide transition to battle
        TransitionEngine.slide(() => {
            document.getElementById('deck-selection-screen')?.classList.remove('open');
            this.close();
            document.getElementById('game-container').style.display = 'flex';
        }).then(() => {
            if (typeof MainMenu !== 'undefined') {
                MainMenu.showTurnOrderAnimation(() => {
                    if (typeof initGame === 'function') initGame();
                });
            } else {
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