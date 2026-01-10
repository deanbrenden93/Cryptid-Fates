/**
 * Cryptid Fates - Win Screen / Match Results
 * Post-match display showing stats, rewards, and navigation
 * Overhauled with image-based UI elements
 */

window.WinScreen = {
    isOpen: false,
    lastMatchData: null,
    rematchPending: false,
    rematchTimer: null,
    opponentAvailable: true,
    
    // Asset URLs
    assets: {
        background: 'results-screen/match-results-background.png',
        victoryBanner: 'results-screen/victory-banner.png',
        defeatBanner: 'results-screen/defeat-banner.png',
        mainMenuBtn: 'results-screen/main-menu-results-button.png',
        rematchBtn: 'results-screen/rematch-button.png'
    },
    
    // ==================== INITIALIZATION ====================
    
    init() {
        this.preloadAssets();
        this.injectStyles();
        this.createHTML();
        this.bindEvents();
    },
    
    preloadAssets() {
        // Preload all images to prevent stutter on show
        this.assetsLoaded = false;
        const urls = Object.values(this.assets);
        let loaded = 0;
        
        urls.forEach(url => {
            const img = new Image();
            img.onload = img.onerror = () => {
                loaded++;
                if (loaded >= urls.length) {
                    this.assetsLoaded = true;
                    console.log('[WinScreen] All assets preloaded');
                }
            };
            img.src = url;
        });
    },
    
    injectStyles() {
        if (document.getElementById('winscreen-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'winscreen-styles';
        style.textContent = `
            /* ==================== WIN SCREEN OVERLAY ==================== */
            #winscreen-overlay {
                position: fixed;
                inset: 0;
                z-index: 28000;
                display: none;
                justify-content: center;
                align-items: center;
                opacity: 0;
                transition: opacity 0.5s ease;
                background-image: url('${this.assets.background}');
                background-size: cover;
                background-position: center;
                background-repeat: no-repeat;
            }
            
            #winscreen-overlay::before {
                content: '';
                position: absolute;
                inset: 0;
                background: rgba(0, 0, 0, 0.4);
                pointer-events: none;
            }
            
            #winscreen-overlay.open {
                display: flex;
                opacity: 1;
            }
            
            .winscreen-container {
                position: relative;
                z-index: 1;
                max-width: 700px;
                width: 95%;
                max-height: 100vh;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: 20px;
                box-sizing: border-box;
                animation: winscreenSlideIn 0.6s ease-out;
            }
            
            @keyframes winscreenSlideIn {
                from { 
                    opacity: 0; 
                    transform: translateY(30px) scale(0.95); 
                }
                to { 
                    opacity: 1; 
                    transform: translateY(0) scale(1); 
                }
            }
            
            /* ==================== RESULT BANNER (IMAGE) ==================== */
            .result-banner {
                width: 100%;
                max-width: 500px;
                margin-bottom: 15px;
                animation: bannerPulse 3s ease-in-out infinite;
            }
            
            .result-banner img {
                width: 100%;
                height: auto;
                filter: drop-shadow(0 0 30px rgba(232, 169, 62, 0.5));
            }
            
            #winscreen-overlay.defeat .result-banner img {
                filter: drop-shadow(0 0 30px rgba(100, 150, 255, 0.5));
            }
            
            @keyframes bannerPulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.02); }
            }
            
            .result-subtitle {
                font-family: 'Cinzel', serif;
                font-size: 16px;
                color: var(--bone, #e8e0d5);
                letter-spacing: 3px;
                text-align: center;
                margin-bottom: 15px;
                text-shadow: 0 2px 4px rgba(0,0,0,0.8);
            }
            
            /* ==================== STATS PANEL ==================== */
            .stats-panel {
                background: rgba(0, 0, 0, 0.6);
                border: 1px solid rgba(232, 169, 62, 0.3);
                border-radius: 12px;
                padding: 15px 20px;
                margin-bottom: 15px;
                width: 100%;
                max-width: 450px;
                backdrop-filter: blur(5px);
            }
            
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 10px;
                margin-bottom: 10px;
            }
            
            .stat-item {
                text-align: center;
            }
            
            .stat-value {
                font-size: 26px;
                font-weight: bold;
                color: var(--parchment, #d4c4a8);
                line-height: 1;
                text-shadow: 0 2px 4px rgba(0,0,0,0.5);
            }
            
            .stat-label {
                font-size: 10px;
                color: var(--bone, #e8e0d5);
                text-transform: uppercase;
                letter-spacing: 1px;
                margin-top: 3px;
            }
            
            .stat-item.highlight .stat-value { color: var(--candlelight, #e8a93e); }
            .stat-item.negative .stat-value { color: #e57373; }
            .stat-item.positive .stat-value { color: var(--rune-glow, #7eb89e); }
            
            .match-details {
                display: flex;
                justify-content: center;
                gap: 20px;
                padding-top: 10px;
                border-top: 1px solid rgba(232, 169, 62, 0.15);
                font-size: 12px;
                color: var(--bone, #e8e0d5);
            }
            
            .match-detail {
                display: flex;
                align-items: center;
                gap: 5px;
            }
            
            /* ==================== REWARDS PANEL ==================== */
            .rewards-panel {
                background: linear-gradient(180deg, rgba(232, 169, 62, 0.15), rgba(0, 0, 0, 0.5));
                border: 1px solid rgba(232, 169, 62, 0.35);
                border-radius: 12px;
                padding: 15px 20px;
                margin-bottom: 15px;
                width: 100%;
                max-width: 450px;
                backdrop-filter: blur(5px);
            }
            
            .rewards-title {
                font-family: 'Cinzel', serif;
                font-size: 16px;
                color: var(--candlelight, #e8a93e);
                margin-bottom: 12px;
                text-align: center;
                text-shadow: 0 2px 4px rgba(0,0,0,0.5);
            }
            
            .rewards-grid {
                display: flex;
                justify-content: center;
                gap: 30px;
                margin-bottom: 10px;
            }
            
            .reward-item {
                text-align: center;
                animation: rewardPop 0.5s ease-out backwards;
            }
            
            .reward-item:nth-child(1) { animation-delay: 0.3s; }
            .reward-item:nth-child(2) { animation-delay: 0.5s; }
            
            @keyframes rewardPop {
                from { opacity: 0; transform: scale(0.5) translateY(10px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
            }
            
            .reward-icon { font-size: 28px; margin-bottom: 5px; }
            .reward-amount {
                font-size: 20px;
                font-weight: bold;
                color: var(--parchment, #d4c4a8);
            }
            .reward-amount.xp { color: #81c784; }
            .reward-amount.currency { color: #e8a93e; }
            .reward-label {
                font-size: 10px;
                color: var(--bone, #e8e0d5);
                text-transform: uppercase;
            }
            
            /* XP Bar */
            .xp-bar-container {
                width: 100%;
                max-width: 350px;
                margin-bottom: 15px;
            }
            
            .xp-bar-header {
                display: flex;
                justify-content: space-between;
                font-size: 11px;
                color: var(--bone, #e8e0d5);
                margin-bottom: 4px;
            }
            
            .xp-level {
                font-family: 'Cinzel', serif;
                font-weight: bold;
                color: var(--candlelight, #e8a93e);
            }
            
            .xp-bar {
                height: 10px;
                background: rgba(0, 0, 0, 0.5);
                border-radius: 5px;
                border: 1px solid rgba(232, 169, 62, 0.3);
                overflow: hidden;
            }
            
            .xp-fill {
                height: 100%;
                background: linear-gradient(90deg, #7eb89e, #a8d8c8);
                border-radius: 5px;
                transition: width 1s ease-out;
            }
            
            /* ==================== IMAGE BUTTONS ==================== */
            .winscreen-actions {
                display: flex;
                justify-content: center;
                gap: 20px;
                flex-wrap: wrap;
            }
            
            .winscreen-img-btn {
                background: none;
                border: none;
                padding: 0;
                cursor: pointer;
                transition: all 0.2s ease;
                position: relative;
            }
            
            .winscreen-img-btn img {
                height: 60px;
                width: auto;
                filter: drop-shadow(0 4px 8px rgba(0,0,0,0.5));
                transition: all 0.2s ease;
            }
            
            .winscreen-img-btn:hover img {
                transform: translateY(-3px) scale(1.05);
                filter: drop-shadow(0 8px 16px rgba(0,0,0,0.6));
            }
            
            .winscreen-img-btn:active img {
                transform: translateY(0) scale(0.98);
            }
            
            .winscreen-img-btn.disabled {
                pointer-events: none;
            }
            
            .winscreen-img-btn.disabled img {
                filter: grayscale(100%) brightness(0.5) drop-shadow(0 4px 8px rgba(0,0,0,0.5));
            }
            
            .winscreen-img-btn.pending img {
                animation: pendingPulse 1.5s ease-in-out infinite;
            }
            
            @keyframes pendingPulse {
                0%, 100% { filter: drop-shadow(0 4px 8px rgba(0,0,0,0.5)) brightness(1); }
                50% { filter: drop-shadow(0 4px 15px rgba(100, 200, 255, 0.6)) brightness(1.1); }
            }
            
            /* Rematch status text */
            .rematch-status {
                position: absolute;
                bottom: -18px;
                left: 50%;
                transform: translateX(-50%);
                font-size: 11px;
                color: var(--bone, #e8e0d5);
                white-space: nowrap;
                text-shadow: 0 1px 3px rgba(0,0,0,0.8);
            }
            
            .rematch-status.waiting {
                color: #64b5f6;
            }
            
            .rematch-status.unavailable {
                color: #e57373;
            }
            
            /* Level up banner */
            .level-up-banner {
                display: none;
                background: linear-gradient(90deg, transparent, rgba(232, 169, 62, 0.3), transparent);
                padding: 10px 20px;
                margin-bottom: 10px;
                text-align: center;
                border-radius: 8px;
            }
            
            .level-up-banner.show { display: block; animation: levelUpFlash 0.5s ease-out; }
            
            @keyframes levelUpFlash {
                0% { opacity: 0; transform: scale(0.8); }
                50% { transform: scale(1.05); }
                100% { opacity: 1; transform: scale(1); }
            }
            
            .level-up-text {
                font-family: 'Cinzel', serif;
                font-size: 20px;
                color: var(--candlelight, #e8a93e);
                font-weight: bold;
            }
            
            /* ==================== MATCH LOG PANEL ==================== */
            .matchlog-panel {
                background: rgba(0, 0, 0, 0.7);
                border: 1px solid rgba(232, 169, 62, 0.3);
                border-radius: 12px;
                margin-bottom: 15px;
                width: 100%;
                max-width: 550px;
                backdrop-filter: blur(5px);
                overflow: hidden;
            }
            
            .matchlog-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 15px;
                cursor: pointer;
                transition: background 0.2s ease;
            }
            
            .matchlog-header:hover {
                background: rgba(232, 169, 62, 0.1);
            }
            
            .matchlog-title {
                font-family: 'Cinzel', serif;
                font-size: 14px;
                color: var(--candlelight, #e8a93e);
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .matchlog-toggle {
                color: var(--bone, #e8e0d5);
                font-size: 12px;
                transition: transform 0.3s ease;
            }
            
            .matchlog-panel.open .matchlog-toggle {
                transform: rotate(180deg);
            }
            
            .matchlog-content {
                max-height: 0;
                overflow: hidden;
                transition: max-height 0.4s ease;
            }
            
            .matchlog-panel.open .matchlog-content {
                max-height: 400px;
            }
            
            .matchlog-entries {
                max-height: 300px;
                overflow-y: auto;
                padding: 10px 15px;
                font-family: 'Consolas', 'Monaco', monospace;
                font-size: 11px;
                line-height: 1.5;
                color: var(--bone, #e8e0d5);
                border-top: 1px solid rgba(232, 169, 62, 0.15);
            }
            
            .matchlog-entries::-webkit-scrollbar {
                width: 6px;
            }
            
            .matchlog-entries::-webkit-scrollbar-track {
                background: rgba(0, 0, 0, 0.3);
            }
            
            .matchlog-entries::-webkit-scrollbar-thumb {
                background: rgba(232, 169, 62, 0.4);
                border-radius: 3px;
            }
            
            .matchlog-entry {
                padding: 2px 0;
                border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            }
            
            .matchlog-entry.turn-header {
                color: var(--candlelight, #e8a93e);
                font-weight: bold;
                margin-top: 8px;
                padding-top: 8px;
                border-top: 1px solid rgba(232, 169, 62, 0.2);
            }
            
            .matchlog-entry .timestamp {
                color: #888;
                margin-right: 5px;
            }
            
            .matchlog-entry .owner-player {
                color: #7eb89e;
            }
            
            .matchlog-entry .owner-enemy {
                color: #e57373;
            }
            
            .matchlog-actions {
                display: flex;
                justify-content: center;
                gap: 10px;
                padding: 10px 15px;
                border-top: 1px solid rgba(232, 169, 62, 0.15);
            }
            
            .matchlog-btn {
                background: rgba(232, 169, 62, 0.2);
                border: 1px solid rgba(232, 169, 62, 0.4);
                color: var(--bone, #e8e0d5);
                padding: 8px 16px;
                border-radius: 6px;
                font-size: 12px;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .matchlog-btn:hover {
                background: rgba(232, 169, 62, 0.3);
                border-color: rgba(232, 169, 62, 0.6);
            }
            
            .matchlog-btn.primary {
                background: rgba(232, 169, 62, 0.4);
            }
            
            .matchlog-stats {
                font-size: 11px;
                color: #888;
                text-align: center;
                padding-bottom: 5px;
            }
            
            /* ==================== RESPONSIVE ==================== */
            @media (max-width: 500px) {
                .winscreen-container {
                    padding: 15px 10px;
                }
                
                .result-banner {
                    max-width: 320px;
                }
                
                .stats-grid {
                    grid-template-columns: repeat(2, 1fr);
                }
                
                .stat-value { font-size: 22px; }
                
                .rewards-grid { gap: 20px; }
                
                .winscreen-img-btn img {
                    height: 50px;
                }
                
                .winscreen-actions {
                    gap: 15px;
                }
            }
            
            @media (max-height: 700px) {
                .winscreen-container {
                    padding: 10px;
                }
                
                .result-banner {
                    max-width: 350px;
                    margin-bottom: 10px;
                }
                
                .stats-panel, .rewards-panel {
                    padding: 10px 15px;
                    margin-bottom: 10px;
                }
                
                .stat-value { font-size: 20px; }
                .reward-icon { font-size: 22px; }
                .reward-amount { font-size: 16px; }
            }
        `;
        document.head.appendChild(style);
    },
    
    createHTML() {
        const overlay = document.createElement('div');
        overlay.id = 'winscreen-overlay';
        overlay.innerHTML = `
            <div class="winscreen-container">
                <!-- Result Banner (Image) -->
                <div class="result-banner">
                    <img id="result-banner-img" src="${this.assets.victoryBanner}" alt="Result">
                </div>
                
                <div class="result-subtitle" id="result-subtitle">The spirits favor you</div>
                
                <!-- Level Up Banner -->
                <div class="level-up-banner" id="level-up-banner">
                    <div class="level-up-text">🎉 Level Up!</div>
                    <div class="level-up-rewards" id="level-up-rewards"></div>
                </div>
                
                <!-- Stats Panel -->
                <div class="stats-panel">
                    <div class="stats-grid" id="stats-grid"></div>
                    <div class="match-details" id="match-details"></div>
                </div>
                
                <!-- XP Bar -->
                <div class="xp-bar-container">
                    <div class="xp-bar-header">
                        <span class="xp-level">Level <span id="xp-level">1</span></span>
                        <span class="xp-numbers"><span id="xp-current">0</span> / <span id="xp-needed">100</span> XP</span>
                    </div>
                    <div class="xp-bar">
                        <div class="xp-fill" id="xp-fill" style="width: 0%;"></div>
                    </div>
                </div>
                
                <!-- Rewards Panel -->
                <div class="rewards-panel">
                    <div class="rewards-title">✧ Rewards Earned ✧</div>
                    <div class="rewards-grid" id="rewards-grid"></div>
                </div>
                
                <!-- Match Log Panel (Collapsible) -->
                <div class="matchlog-panel" id="matchlog-panel">
                    <div class="matchlog-header" onclick="WinScreen.toggleMatchLog()">
                        <div class="matchlog-title">
                            <span>📜</span>
                            <span>Match Log</span>
                        </div>
                        <div class="matchlog-toggle">▼</div>
                    </div>
                    <div class="matchlog-content">
                        <div class="matchlog-stats" id="matchlog-stats"></div>
                        <div class="matchlog-entries" id="matchlog-entries"></div>
                        <div class="matchlog-actions">
                            <button class="matchlog-btn primary" onclick="WinScreen.copyMatchLog()">📋 Copy Full Log</button>
                            <button class="matchlog-btn" onclick="WinScreen.toggleMatchLog()">Close</button>
                        </div>
                    </div>
                </div>
                
                <!-- Actions (Image Buttons) -->
                <div class="winscreen-actions">
                    <button class="winscreen-img-btn" id="btn-home">
                        <img src="${this.assets.mainMenuBtn}" alt="Main Menu">
                    </button>
                    <button class="winscreen-img-btn" id="btn-rematch">
                        <img src="${this.assets.rematchBtn}" alt="Rematch">
                        <span class="rematch-status" id="rematch-status"></span>
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    },
    
    bindEvents() {
        document.getElementById('btn-home').onclick = () => this.goHome();
        document.getElementById('btn-rematch').onclick = () => this.requestRematch();
    },
    
    // ==================== MAIN METHODS ====================
    
    show(data) {
        this.isOpen = true;
        this.lastMatchData = data;
        this.rematchPending = false;
        this.opponentAvailable = true;
        
        const overlay = document.getElementById('winscreen-overlay');
        const isWin = data.isWin;
        const isHuman = data.isHuman || false;
        const isMultiplayer = data.isMultiplayer || false;
        
        // Set victory/defeat theme
        overlay.classList.remove('victory', 'defeat', 'open');
        overlay.classList.add(isWin ? 'victory' : 'defeat');
        
        // Update result banner image
        const bannerImg = document.getElementById('result-banner-img');
        bannerImg.src = isWin ? this.assets.victoryBanner : this.assets.defeatBanner;
        
        // Update subtitle
        document.getElementById('result-subtitle').textContent = isWin 
            ? this.getVictoryQuote() 
            : this.getDefeatQuote();
        
        // Reset rematch button state
        this.updateRematchButton(isMultiplayer);
        
        // Calculate rewards
        const rewards = typeof PlayerData !== 'undefined' && PlayerData.calculateMatchRewards
            ? PlayerData.calculateMatchRewards(isWin, isHuman, data.stats || {})
            : { xp: isWin ? 25 : 10, currency: isWin ? 15 : 5, breakdown: {} };
        
        // Update player stats
        if (typeof PlayerData !== 'undefined') {
            PlayerData.stats = PlayerData.stats || { gamesPlayed: 0, wins: 0, losses: 0 };
            PlayerData.stats.gamesPlayed++;
            if (isWin) PlayerData.stats.wins++;
            else PlayerData.stats.losses++;
        }
        
        // Render stats
        this.renderStats(data.stats || {});
        this.renderMatchDetails(data);
        this.renderRewards(rewards);
        
        // Populate match log
        this.populateMatchLog();
        document.getElementById('matchlog-panel').classList.remove('open'); // Start collapsed
        
        // XP Animation
        if (typeof PlayerData !== 'undefined' && PlayerData.level !== undefined) {
            const startXP = PlayerData.xp || 0;
            const startLevel = PlayerData.level || 1;
            const xpResult = PlayerData.addXP ? PlayerData.addXP(rewards.xp) : { newLevel: startLevel, currentXP: startXP + rewards.xp, xpToNext: 100, levelsGained: 0, rewards: [] };
            
            this.animateXPBar(startXP, startLevel, xpResult);
            
            if (xpResult.levelsGained > 0) {
                this.showLevelUp(xpResult);
            }
            
            // Add currency
            if (PlayerData.embers !== undefined) {
                PlayerData.embers += rewards.currency;
            }
            
            if (typeof PlayerData.save === 'function') PlayerData.save();
        }
        
        // Show overlay with smooth transition
        // First, set display but keep opacity 0
        overlay.style.display = 'flex';
        overlay.style.opacity = '0';
        
        // Force reflow to ensure the display change is processed
        overlay.offsetHeight;
        
        // Now animate opacity
        requestAnimationFrame(() => {
            overlay.classList.add('open');
            overlay.style.opacity = '';  // Let CSS handle it
        });
        
        // Listen for multiplayer rematch events
        if (isMultiplayer && typeof MultiplayerClient !== 'undefined') {
            this.setupMultiplayerRematchListeners();
        }
    },
    
    hide() {
        this.isOpen = false;
        this.clearRematchTimer();
        const overlay = document.getElementById('winscreen-overlay');
        overlay.classList.remove('open');
        // Reset inline styles after transition
        setTimeout(() => {
            if (!this.isOpen) {
                overlay.style.display = '';
                overlay.style.opacity = '';
            }
        }, 500);
        document.getElementById('level-up-banner').classList.remove('show');
    },
    
    // ==================== REMATCH LOGIC ====================
    
    updateRematchButton(isMultiplayer) {
        const btn = document.getElementById('btn-rematch');
        const status = document.getElementById('rematch-status');
        
        btn.classList.remove('disabled', 'pending');
        status.textContent = '';
        status.className = 'rematch-status';
        
        if (isMultiplayer) {
            status.textContent = 'Request Rematch';
        }
    },
    
    requestRematch() {
        const data = this.lastMatchData;
        const isMultiplayer = data?.isMultiplayer || false;
        
        if (isMultiplayer) {
            this.requestMultiplayerRematch();
        } else {
            // VS AI - immediately start new match
            this.startRematch();
        }
    },
    
    requestMultiplayerRematch() {
        console.log('[WinScreen] requestMultiplayerRematch called');
        console.log('[WinScreen] rematchPending:', this.rematchPending);
        console.log('[WinScreen] opponentAvailable:', this.opponentAvailable);
        
        if (this.rematchPending) {
            console.log('[WinScreen] Already pending, returning');
            return;
        }
        
        const btn = document.getElementById('btn-rematch');
        const status = document.getElementById('rematch-status');
        
        if (!this.opponentAvailable) {
            console.log('[WinScreen] Opponent not available');
            status.textContent = 'Opponent left';
            status.className = 'rematch-status unavailable';
            return;
        }
        
        this.rematchPending = true;
        btn.classList.add('pending');
        status.textContent = 'Waiting... 30s';
        status.className = 'rematch-status waiting';
        
        // Send rematch request to server
        console.log('[WinScreen] Checking MultiplayerClient:', typeof MultiplayerClient);
        if (typeof MultiplayerClient !== 'undefined' && MultiplayerClient.sendRematchRequest) {
            console.log('[WinScreen] Calling MultiplayerClient.sendRematchRequest()');
            MultiplayerClient.sendRematchRequest();
        } else {
            console.error('[WinScreen] MultiplayerClient not available!');
        }
        
        // Start countdown timer
        let timeLeft = 30;
        this.rematchTimer = setInterval(() => {
            timeLeft--;
            status.textContent = `Waiting... ${timeLeft}s`;
            
            if (timeLeft <= 0) {
                this.cancelRematchRequest('Timed out');
            }
        }, 1000);
    },
    
    cancelRematchRequest(reason = '') {
        this.clearRematchTimer();
        this.rematchPending = false;
        
        const btn = document.getElementById('btn-rematch');
        const status = document.getElementById('rematch-status');
        
        btn.classList.remove('pending');
        status.textContent = reason || 'Request Rematch';
        status.className = reason ? 'rematch-status unavailable' : 'rematch-status';
    },
    
    clearRematchTimer() {
        if (this.rematchTimer) {
            clearInterval(this.rematchTimer);
            this.rematchTimer = null;
        }
    },
    
    onOpponentRematchRequest() {
        // Opponent requested rematch
        const status = document.getElementById('rematch-status');
        
        if (this.rematchPending) {
            // We already requested too - server will handle starting the match
            // Just update UI to show both are ready
            status.textContent = 'Starting...';
            status.className = 'rematch-status waiting';
        } else {
            // Show that opponent wants rematch (encourages user to click)
            status.textContent = 'Opponent ready!';
            status.className = 'rematch-status waiting';
        }
    },
    
    onOpponentLeft() {
        this.opponentAvailable = false;
        this.cancelRematchRequest('Opponent left');
        
        const btn = document.getElementById('btn-rematch');
        btn.classList.add('disabled');
    },
    
    setupMultiplayerRematchListeners() {
        console.log('[WinScreen] Setting up multiplayer rematch listeners');
        if (typeof MultiplayerClient !== 'undefined') {
            console.log('[WinScreen] MultiplayerClient found, hooking callbacks');
            
            // Store original handlers to restore later
            const origRematch = MultiplayerClient.onRematchRequest;
            const origLeft = MultiplayerClient.onOpponentLeftResults;
            const origAccepted = MultiplayerClient.onRematchAccepted;
            
            MultiplayerClient.onRematchRequest = () => {
                console.log('[WinScreen] onRematchRequest callback triggered');
                this.onOpponentRematchRequest();
                if (origRematch) origRematch.call(MultiplayerClient);
            };
            
            MultiplayerClient.onOpponentLeftResults = () => {
                console.log('[WinScreen] onOpponentLeftResults callback triggered');
                this.onOpponentLeft();
                if (origLeft) origLeft.call(MultiplayerClient);
            };
            
            MultiplayerClient.onRematchAccepted = () => {
                console.log('[WinScreen] onRematchAccepted callback triggered');
                this.startRematch();
                if (origAccepted) origAccepted.call(MultiplayerClient);
            };
            
            console.log('[WinScreen] Rematch listeners set up successfully');
        } else {
            console.error('[WinScreen] MultiplayerClient not defined!');
        }
    },
    
    startRematch() {
        this.clearRematchTimer();
        this.hide();
        
        const data = this.lastMatchData;
        const isMultiplayer = data?.isMultiplayer || false;
        
        if (isMultiplayer) {
            // Server will send matchFound - MultiplayerClient.onMatchFound will handle it
            // Just make sure the game container is ready
            document.getElementById('game-container').style.display = 'flex';
        } else {
            // VS AI - start new game
            if (typeof HomeScreen !== 'undefined' && HomeScreen.startGame) {
                HomeScreen.startGame();
            } else if (typeof initGame === 'function') {
                document.getElementById('game-container').style.display = 'flex';
                initGame();
            }
        }
    },
    
    // ==================== NAVIGATION ====================
    
    goHome() {
        this.clearRematchTimer();
        this.hide();
        
        // Notify server we're leaving results screen (for multiplayer)
        if (this.lastMatchData?.isMultiplayer && typeof MultiplayerClient !== 'undefined') {
            if (MultiplayerClient.leaveResultsScreen) {
                MultiplayerClient.leaveResultsScreen();
            }
        }
        
        // Return to home screen
        if (typeof HomeScreen !== 'undefined' && HomeScreen.open) {
            HomeScreen.open();
        } else if (typeof MainMenu !== 'undefined') {
            MainMenu.show();
        }
    },
    
    // ==================== RENDERING ====================
    
    renderStats(stats) {
        const grid = document.getElementById('stats-grid');
        const kills = stats.kills || 0;
        const deaths = stats.playerDeaths || 0;
        const damage = stats.damageDealt || 0;
        const turns = stats.turns || 0;
        
        grid.innerHTML = `
            <div class="stat-item highlight">
                <div class="stat-value">${kills}</div>
                <div class="stat-label">Kills</div>
            </div>
            <div class="stat-item ${deaths > 0 ? 'negative' : ''}">
                <div class="stat-value">${deaths}</div>
                <div class="stat-label">Deaths</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${damage}</div>
                <div class="stat-label">Damage</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${turns}</div>
                <div class="stat-label">Turns</div>
            </div>
            <div class="stat-item ${(stats.spellsCast || 0) > 0 ? 'positive' : ''}">
                <div class="stat-value">${stats.spellsCast || 0}</div>
                <div class="stat-label">Spells</div>
            </div>
            <div class="stat-item ${(stats.evolutions || 0) > 0 ? 'positive' : ''}">
                <div class="stat-value">${stats.evolutions || 0}</div>
                <div class="stat-label">Evolves</div>
            </div>
        `;
    },
    
    renderMatchDetails(data) {
        const details = document.getElementById('match-details');
        const duration = data.duration || 0;
        const mins = Math.floor(duration / 60);
        const secs = duration % 60;
        const mode = data.isMultiplayer ? (data.opponentName || 'PvP') : 'vs AI';
        
        details.innerHTML = `
            <div class="match-detail">
                <span>⏱</span>
                <span>${mins}:${secs.toString().padStart(2, '0')}</span>
            </div>
            <div class="match-detail">
                <span>⚔</span>
                <span>${mode}</span>
            </div>
        `;
    },
    
    renderRewards(rewards) {
        const grid = document.getElementById('rewards-grid');
        
        grid.innerHTML = `
            <div class="reward-item">
                <div class="reward-icon">⭐</div>
                <div class="reward-amount xp">+${rewards.xp || 0}</div>
                <div class="reward-label">Experience</div>
            </div>
            <div class="reward-item">
                <div class="reward-icon">🔥</div>
                <div class="reward-amount currency">+${rewards.currency || 0}</div>
                <div class="reward-label">Embers</div>
            </div>
        `;
    },
    
    animateXPBar(startXP, startLevel, xpResult) {
        const levelEl = document.getElementById('xp-level');
        const currentEl = document.getElementById('xp-current');
        const neededEl = document.getElementById('xp-needed');
        const fillEl = document.getElementById('xp-fill');
        
        levelEl.textContent = startLevel;
        const startNeeded = typeof PlayerData !== 'undefined' && PlayerData.getXPForLevel 
            ? PlayerData.getXPForLevel(startLevel) 
            : 100;
        currentEl.textContent = startXP;
        neededEl.textContent = startNeeded;
        fillEl.style.width = `${(startXP / startNeeded) * 100}%`;
        
        setTimeout(() => {
            if (xpResult.levelsGained > 0) {
                fillEl.style.width = '100%';
                
                setTimeout(() => {
                    levelEl.textContent = xpResult.newLevel;
                    currentEl.textContent = xpResult.currentXP;
                    neededEl.textContent = xpResult.xpToNext;
                    fillEl.style.transition = 'none';
                    fillEl.style.width = '0%';
                    
                    setTimeout(() => {
                        fillEl.style.transition = 'width 1s ease-out';
                        fillEl.style.width = `${(xpResult.currentXP / xpResult.xpToNext) * 100}%`;
                    }, 50);
                }, 1000);
            } else {
                currentEl.textContent = xpResult.currentXP;
                fillEl.style.width = `${(xpResult.currentXP / xpResult.xpToNext) * 100}%`;
            }
        }, 500);
    },
    
    showLevelUp(xpResult) {
        const banner = document.getElementById('level-up-banner');
        const rewardsEl = document.getElementById('level-up-rewards');
        
        let rewardText = [];
        for (const reward of (xpResult.rewards || [])) {
            if (reward.currency) rewardText.push(`<span>+${reward.currency} Embers</span>`);
            if (reward.boosterPack) rewardText.push(`<span>📦 Booster Pack!</span>`);
        }
        
        rewardsEl.innerHTML = rewardText.join(' ');
        banner.classList.add('show');
    },
    
    // ==================== MATCH LOG ====================
    
    toggleMatchLog() {
        const panel = document.getElementById('matchlog-panel');
        panel.classList.toggle('open');
    },
    
    populateMatchLog() {
        const entriesEl = document.getElementById('matchlog-entries');
        const statsEl = document.getElementById('matchlog-stats');
        
        if (typeof MatchLog === 'undefined' || !MatchLog.entries) {
            entriesEl.innerHTML = '<div class="matchlog-entry">No log data available</div>';
            statsEl.textContent = '';
            return;
        }
        
        const entries = MatchLog.entries;
        statsEl.textContent = `${entries.length} events recorded over ${MatchLog.turnNumber} turns`;
        
        let html = '';
        let lastTurn = -1;
        
        for (const entry of entries) {
            // Add turn header
            if (entry.category === 'TURN' && entry.turn !== lastTurn) {
                lastTurn = entry.turn;
                html += `<div class="matchlog-entry turn-header">${entry.formatted}</div>`;
                continue;
            }
            
            const time = `<span class="timestamp">[${(entry.timestamp / 1000).toFixed(1)}s]</span>`;
            const ownerClass = entry.owner ? `owner-${entry.owner}` : '';
            const ownerTag = entry.owner ? `<span class="${ownerClass}">[${entry.owner.toUpperCase()}]</span> ` : '';
            
            html += `<div class="matchlog-entry">${time} ${ownerTag}${entry.formatted}</div>`;
        }
        
        entriesEl.innerHTML = html || '<div class="matchlog-entry">No events recorded</div>';
        
        // Scroll to bottom
        entriesEl.scrollTop = entriesEl.scrollHeight;
    },
    
    copyMatchLog() {
        if (typeof MatchLog !== 'undefined' && MatchLog.copyToClipboard) {
            MatchLog.copyToClipboard();
        } else {
            console.error('MatchLog not available');
        }
    },
    
    // ==================== QUOTES ====================
    
    getVictoryQuote() {
        const quotes = [
            "The spirits favor you",
            "A glorious triumph",
            "Your legend grows",
            "The cryptids bow to you",
            "Fate smiles upon thee",
            "A masterful display",
            "The darkness retreats"
        ];
        return quotes[Math.floor(Math.random() * quotes.length)];
    },
    
    getDefeatQuote() {
        const quotes = [
            "The shadows claim victory",
            "Rise again, challenger",
            "A valiant effort",
            "The cryptids hunger still",
            "Fate is fickle",
            "Learn from this loss",
            "The darkness grows stronger"
        ];
        return quotes[Math.floor(Math.random() * quotes.length)];
    }
};

// Auto-init
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => WinScreen.init());
} else {
    WinScreen.init();
}