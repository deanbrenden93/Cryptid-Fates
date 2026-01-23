/**
 * Cryptid Fates - Main Menu
 * Menu system with VS AI / VS Human modes
 * Includes fullscreen handling and turn order animation
 */

// ==================== MAIN MENU SYSTEM ====================
window.MainMenu = {
    isFullscreen: false,
    selectedMode: null,
    
    init() {
        this.injectStyles();
        this.createMenuHTML();
        this.bindEvents();
        
        // If HomeScreen exists, let it initialize itself - don't show main menu
        // HomeScreen.init() will be called by its own auto-init and will handle showing itself
        if (typeof HomeScreen !== 'undefined') {
            // Just hide main menu - HomeScreen will take over when it initializes
            document.getElementById('main-menu')?.classList.add('hidden');
        } else {
            this.show();
        }
    },
    
    injectStyles() {
        const style = document.createElement('style');
        style.id = 'main-menu-styles';
        style.textContent = `
            /* ==================== MAIN MENU ==================== */
            #main-menu {
                position: fixed;
                inset: 0;
                background: 
                    radial-gradient(ellipse at 50% 20%, rgba(232, 169, 62, 0.15) 0%, transparent 50%),
                    radial-gradient(ellipse at 20% 80%, rgba(107, 28, 28, 0.2) 0%, transparent 40%),
                    radial-gradient(ellipse at 80% 80%, rgba(107, 28, 28, 0.2) 0%, transparent 40%),
                    linear-gradient(180deg, #0a0d12 0%, #151a1f 40%, #1a1510 100%);
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                z-index: 20000;
                padding: 24px;
                opacity: 1;
                transition: opacity 0.6s ease;
            }
            
            #main-menu.hidden {
                opacity: 0;
                pointer-events: none;
            }
            
            #main-menu::before {
                content: '';
                position: absolute;
                inset: 0;
                background: url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.06'/%3E%3C/svg%3E");
                pointer-events: none;
                mix-blend-mode: overlay;
            }
            
            .menu-content {
                position: relative;
                display: flex;
                flex-direction: column;
                align-items: center;
                max-width: 400px;
                width: 100%;
            }
            
            .menu-icon {
                font-size: clamp(60px, 18vw, 100px);
                margin-bottom: 16px;
                animation: menuFlameFlicker 3s infinite ease-in-out;
                filter: drop-shadow(0 0 30px rgba(232, 169, 62, 0.5));
            }
            
            @keyframes menuFlameFlicker {
                0%, 100% { 
                    opacity: 1; 
                    transform: scale(1) translateY(0); 
                    filter: drop-shadow(0 0 30px rgba(232, 169, 62, 0.5));
                }
                25% { 
                    opacity: 0.9; 
                    transform: scale(1.02) translateY(-2px); 
                }
                50% { 
                    opacity: 0.85; 
                    transform: scale(0.98) translateY(1px);
                    filter: drop-shadow(0 0 40px rgba(196, 92, 38, 0.6));
                }
                75% { 
                    opacity: 0.95; 
                    transform: scale(1.01) translateY(-1px); 
                }
            }
            
            .menu-title {
                font-family: 'Cinzel', serif;
                font-size: clamp(32px, 9vw, 56px);
                font-weight: 700;
                color: var(--parchment);
                text-align: center;
                letter-spacing: 6px;
                text-shadow: 
                    0 0 40px rgba(232, 169, 62, 0.4),
                    0 4px 8px rgba(0, 0, 0, 0.8);
                margin-bottom: 8px;
            }
            
            .menu-subtitle {
                font-family: 'Cinzel', serif;
                font-size: clamp(12px, 3vw, 16px);
                color: var(--bone);
                opacity: 0.6;
                letter-spacing: 4px;
                text-transform: uppercase;
                margin-bottom: 48px;
            }
            
            .menu-buttons {
                display: flex;
                flex-direction: column;
                gap: 16px;
                width: 100%;
                max-width: 280px;
            }
            
            .menu-btn {
                padding: 18px 32px;
                font-family: 'Cinzel', serif;
                font-size: clamp(14px, 4vw, 18px);
                font-weight: 700;
                border: 2px solid;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.3s ease;
                text-transform: uppercase;
                letter-spacing: 3px;
                position: relative;
                overflow: hidden;
            }
            
            .menu-btn::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 50%;
                background: linear-gradient(180deg, rgba(255,255,255,0.15), transparent);
                pointer-events: none;
            }
            
            .menu-btn.primary {
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
            
            .menu-btn.primary:hover {
                transform: translateY(-3px) scale(1.02);
                box-shadow: 
                    0 0 100px rgba(200, 200, 220, 0.4),
                    0 0 50px rgba(255, 255, 255, 0.2),
                    0 8px 30px rgba(0, 0, 0, 0.5),
                    inset 0 1px 0 rgba(255, 255, 255, 0.7),
                    inset 0 -1px 0 rgba(0, 0, 0, 0.3);
            }
            
            .menu-btn.secondary {
                background: linear-gradient(180deg, 
                    rgba(50, 48, 55, 0.9) 0%, 
                    rgba(35, 33, 40, 0.95) 50%,
                    rgba(25, 23, 28, 0.98) 100%);
                border-color: rgba(200, 200, 210, 0.15);
                color: #a0a0a8;
                box-shadow: 
                    0 4px 15px rgba(0, 0, 0, 0.4),
                    inset 0 1px 0 rgba(255, 255, 255, 0.05);
            }
            
            .menu-btn.secondary:hover {
                transform: translateY(-2px);
                border-color: rgba(200, 200, 210, 0.3);
                color: #d0d0d8;
                box-shadow: 
                    0 0 30px rgba(200, 200, 220, 0.1),
                    0 6px 20px rgba(0, 0, 0, 0.5);
            }
            
            .menu-btn.tertiary {
                background: transparent;
                border-color: rgba(160, 144, 128, 0.3);
                color: #908070;
                box-shadow: none;
            }
            
            .menu-btn.tertiary:hover {
                transform: translateY(-2px);
                border-color: rgba(160, 144, 128, 0.5);
                color: #d4c4a0;
                background: rgba(160, 144, 128, 0.05);
            }
            
            .menu-btn.dev {
                background: linear-gradient(180deg, 
                    rgba(80, 50, 90, 0.9) 0%, 
                    rgba(50, 30, 60, 0.95) 50%,
                    rgba(40, 25, 50, 0.95) 100%);
                border-color: rgba(180, 100, 200, 0.4);
                color: #c090d0;
                box-shadow: 
                    0 4px 15px rgba(0, 0, 0, 0.4),
                    inset 0 1px 0 rgba(255, 255, 255, 0.05);
                margin-top: 20px;
                font-size: clamp(12px, 3vw, 14px);
                padding: 12px 24px;
            }
            
            .menu-btn.dev:hover {
                transform: translateY(-2px);
                border-color: rgba(200, 120, 230, 0.6);
                color: #e0b0f0;
                box-shadow: 
                    0 0 30px rgba(180, 100, 200, 0.2),
                    0 6px 20px rgba(0, 0, 0, 0.5);
            }
            
            .menu-btn.disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            .menu-btn.disabled:hover {
                transform: none;
            }
            
            .menu-btn .btn-subtitle {
                display: block;
                font-size: 10px;
                font-weight: 400;
                letter-spacing: 1px;
                opacity: 0.7;
                margin-top: 4px;
            }
            
            /* Tutorial Popup */
            .menu-popup {
                position: fixed;
                inset: 0;
                background: rgba(5, 5, 10, 0.9);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 25000;
                opacity: 1;
                transition: opacity 0.3s ease;
            }
            
            .menu-popup.hidden {
                opacity: 0;
                pointer-events: none;
            }
            
            .popup-content {
                background: linear-gradient(180deg, rgba(25, 23, 30, 0.98) 0%, rgba(15, 13, 18, 0.98) 100%);
                border: 2px solid rgba(232, 169, 62, 0.4);
                border-radius: 16px;
                padding: 32px 40px;
                max-width: 360px;
                width: 90%;
                text-align: center;
                box-shadow: 0 0 60px rgba(232, 169, 62, 0.2);
            }
            
            .popup-content h3 {
                font-family: 'Cinzel', serif;
                font-size: 24px;
                color: #d4c4a0;
                margin: 0 0 12px;
                letter-spacing: 2px;
            }
            
            .popup-content p {
                color: #908070;
                font-size: 15px;
                margin: 0 0 8px;
            }
            
            .popup-subtext {
                font-size: 12px !important;
                color: #605040 !important;
                font-style: italic;
                margin-bottom: 20px !important;
            }
            
            .popup-buttons {
                display: flex;
                gap: 12px;
                justify-content: center;
                margin-top: 24px;
            }
            
            .popup-btn {
                padding: 12px 24px;
                font-family: 'Cinzel', serif;
                font-size: 13px;
                font-weight: 600;
                letter-spacing: 2px;
                text-transform: uppercase;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.3s;
            }
            
            .popup-btn.confirm {
                background: linear-gradient(180deg, 
                    rgba(220, 220, 230, 0.95) 0%, 
                    rgba(140, 140, 155, 0.85) 50%,
                    rgba(70, 70, 85, 0.95) 100%);
                border: 2px solid rgba(255, 255, 255, 0.4);
                color: #151518;
            }
            
            .popup-btn.confirm:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 20px rgba(200, 200, 220, 0.3);
            }
            
            .popup-btn.cancel {
                background: transparent;
                border: 1px solid rgba(160, 144, 128, 0.3);
                color: #706050;
            }
            
            .popup-btn.cancel:hover {
                border-color: rgba(160, 144, 128, 0.5);
                color: #908070;
            }
            
            .menu-footer {
                margin-top: 48px;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 12px;
            }
            
            .fullscreen-toggle {
                padding: 10px 20px;
                font-family: var(--ui-font);
                font-size: 12px;
                font-weight: 600;
                background: rgba(0, 0, 0, 0.4);
                border: 1px solid rgba(126, 184, 158, 0.3);
                border-radius: 4px;
                color: var(--rune-glow);
                cursor: pointer;
                transition: all 0.25s ease;
                text-transform: uppercase;
                letter-spacing: 1px;
            }
            
            .fullscreen-toggle:hover {
                background: rgba(126, 184, 158, 0.1);
                border-color: var(--rune-glow);
            }
            
            .menu-hint {
                font-size: 11px;
                color: var(--bone);
                opacity: 0.4;
            }
            
            /* ==================== TURN ORDER OVERLAY ==================== */
            #turn-order-overlay {
                position: fixed;
                inset: 0;
                background: rgba(10, 13, 18, 0.98);
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                z-index: 15000;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.4s ease;
            }
            
            #turn-order-overlay.active {
                opacity: 1;
                pointer-events: auto;
            }
            
            .turn-order-content {
                display: flex;
                flex-direction: column;
                align-items: center;
                /* Fixed height container to prevent any layout shift */
                height: 320px;
                justify-content: space-between;
            }
            
            .turn-order-title {
                font-family: 'Cinzel', serif;
                font-size: clamp(16px, 4vw, 24px);
                color: var(--parchment);
                letter-spacing: 4px;
                text-transform: uppercase;
                opacity: 0;
                transform: translateY(-20px);
                transition: all 0.5s ease;
            }
            
            #turn-order-overlay.active .turn-order-title {
                opacity: 0.7;
                transform: translateY(0);
            }
            
            .turn-order-contestants {
                display: flex;
                align-items: center;
                gap: clamp(40px, 10vw, 80px);
            }
            
            .contestant {
                display: flex;
                flex-direction: column;
                align-items: center;
                opacity: 0;
                transform: scale(0.8);
                transition: all 0.5s ease;
            }
            
            .contestant.reveal {
                opacity: 1;
                transform: scale(1);
            }
            
            .contestant.winner {
                transform: scale(1.15);
            }
            
            .contestant.loser {
                opacity: 0.4;
                transform: scale(0.9);
            }
            
            .contestant-icon {
                font-size: clamp(48px, 12vw, 72px);
                margin-bottom: 12px;
                filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.8));
            }
            
            .contestant.player .contestant-icon {
                filter: drop-shadow(0 0 15px rgba(126, 184, 158, 0.5));
            }
            
            .contestant.enemy .contestant-icon {
                filter: drop-shadow(0 0 15px rgba(107, 28, 28, 0.5));
            }
            
            .contestant-name {
                font-family: 'Cinzel', serif;
                font-size: clamp(14px, 4vw, 20px);
                font-weight: 700;
                letter-spacing: 2px;
                text-transform: uppercase;
            }
            
            .contestant.player .contestant-name {
                color: var(--rune-glow);
                text-shadow: 0 0 10px rgba(126, 184, 158, 0.5);
            }
            
            .contestant.enemy .contestant-name {
                color: var(--dried-blood);
                text-shadow: 0 0 10px rgba(107, 28, 28, 0.5);
            }
            
            .turn-order-vs {
                font-family: 'Cinzel', serif;
                font-size: clamp(20px, 5vw, 32px);
                color: #c0c0c8;
                text-shadow: 0 0 20px rgba(200, 200, 220, 0.6);
                opacity: 0;
                transition: opacity 0.4s ease;
            }
            
            #turn-order-overlay.active .turn-order-vs {
                opacity: 1;
                transition-delay: 0.3s;
            }
            
            .turn-order-result {
                font-family: 'Cinzel', serif;
                font-size: clamp(18px, 5vw, 28px);
                color: #d0d0d8;
                letter-spacing: 3px;
                opacity: 0;
                transition: opacity 0.5s ease;
                text-align: center;
                /* Reserve fixed space to prevent layout shift */
                min-height: 60px;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
            }
            
            .turn-order-result.show {
                opacity: 1;
            }
            
            .turn-order-result .goes-first {
                display: block;
                font-size: clamp(12px, 3vw, 16px);
                color: var(--bone);
                opacity: 0.7;
                margin-top: 8px;
                letter-spacing: 2px;
            }
            
            /* Coin flip animation */
            .fate-decider {
                width: 80px;
                height: 80px;
                aspect-ratio: 1;
                margin: 30px 0;
                perspective: 200px;
                opacity: 0;
                transition: opacity 0.3s ease;
                flex-shrink: 0;
            }
            
            .fate-decider.active {
                opacity: 1;
            }
            
            .fate-coin {
                width: 100%;
                height: 100%;
                aspect-ratio: 1;
                position: relative;
                transform-style: preserve-3d;
                animation: coinSpin 0.15s linear infinite;
                border-radius: 50%;
            }
            
            .fate-coin.stopped {
                animation: none;
            }
            
            @keyframes coinSpin {
                0% { transform: rotateY(0deg); }
                100% { transform: rotateY(360deg); }
            }
            
            .coin-face {
                position: absolute;
                width: 100%;
                height: 100%;
                aspect-ratio: 1;
                border-radius: 50%;
                display: flex;
                justify-content: center;
                align-items: center;
                font-size: 40px;
                backface-visibility: hidden;
                border: 3px solid;
            }
            
            .coin-face.player-side {
                background: linear-gradient(145deg, #5a9a7a, #3d7a5a);
                border-color: var(--rune-glow);
                box-shadow: inset 0 0 20px rgba(126, 184, 158, 0.4);
            }
            
            .coin-face.enemy-side {
                background: linear-gradient(145deg, #8a4a4a, #5a2a2a);
                border-color: var(--dried-blood);
                box-shadow: inset 0 0 20px rgba(107, 28, 28, 0.4);
                transform: rotateY(180deg);
            }
            
            /* ==================== LANDSCAPE MOBILE FIXES ==================== */
            @media (orientation: landscape) and (max-height: 500px) {
                #main-menu {
                    padding: 12px;
                    overflow-y: auto;
                }
                
                .menu-content {
                    flex-direction: row;
                    flex-wrap: wrap;
                    justify-content: center;
                    max-width: 90vw;
                    gap: 20px;
                }
                
                .menu-icon {
                    font-size: 48px;
                    margin-bottom: 0;
                }
                
                .menu-title {
                    font-size: clamp(24px, 6vw, 36px);
                    margin-bottom: 4px;
                }
                
                .menu-subtitle {
                    font-size: 11px;
                    margin-bottom: 16px;
                }
                
                .menu-buttons {
                    flex-direction: row;
                    gap: 12px;
                    max-width: none;
                    justify-content: center;
                }
                
                .menu-btn {
                    padding: 12px 20px;
                    font-size: 12px;
                }
                
                .menu-btn .btn-subtitle {
                    font-size: 9px;
                }
                
                .menu-footer {
                    margin-top: 16px;
                    flex-direction: row;
                    gap: 16px;
                }
                
                .fullscreen-toggle {
                    padding: 8px 16px;
                    font-size: 11px;
                }
                
                .menu-hint {
                    font-size: 10px;
                }
                
                /* Turn order overlay landscape */
                #turn-order-overlay {
                    padding: 12px;
                    overflow-y: auto;
                }
                
                .turn-order-title {
                    font-size: 14px;
                    margin-bottom: 16px;
                }
                
                .turn-order-contestants {
                    gap: 30px;
                    margin-bottom: 16px;
                }
                
                .contestant-icon {
                    font-size: 40px;
                    margin-bottom: 6px;
                }
                
                .contestant-name {
                    font-size: 12px;
                }
                
                .turn-order-vs {
                    font-size: 20px;
                }
                
                .fate-decider {
                    width: 60px;
                    height: 60px;
                    aspect-ratio: 1;
                    margin: 16px 0;
                }
                
                .coin-face {
                    font-size: 28px;
                    aspect-ratio: 1;
                }
                
                .turn-order-result {
                    font-size: 16px;
                }
                
                .turn-order-result .goes-first {
                    font-size: 11px;
                }
            }
        `;
        document.head.appendChild(style);
    },
    
    createMenuHTML() {
        // Main Menu
        const menu = document.createElement('div');
        menu.id = 'main-menu';
        menu.innerHTML = `
            <div class="menu-content">
                <div class="menu-icon"><img src='sprites/embers-icon.png' class='embers-img' alt=''></div>
                <h1 class="menu-title">CRYPTID FATES</h1>
                <p class="menu-subtitle">A Game of Dark Summons</p>
                
                <div class="menu-buttons">
                    <button class="menu-btn primary" id="vs-ai-btn">
                        ⚔ VS AI
                        <span class="btn-subtitle">Battle the Warden</span>
                    </button>
                    <button class="menu-btn secondary" id="vs-human-btn">
                        👥 Quick Play
                        <span class="btn-subtitle">Play Online</span>
                    </button>
                    <button class="menu-btn tertiary" id="how-to-play-btn">
                        📖 How to Play
                        <span class="btn-subtitle">Learn the Basics</span>
                    </button>
                    <button class="menu-btn dev" id="cheat-battle-btn">
                        🔧 Cheat Battle
                        <span class="btn-subtitle">Dev Testing Mode</span>
                    </button>
                </div>
                
                <div class="menu-footer">
                    <button class="fullscreen-toggle" id="menu-fullscreen-btn">
                        ⛶ Toggle Fullscreen
                    </button>
                    <p class="menu-hint">Fullscreen recommended for mobile</p>
                </div>
            </div>
        `;
        document.body.appendChild(menu);
        
        // Tutorial Replay Popup
        const tutorialPopup = document.createElement('div');
        tutorialPopup.id = 'tutorial-replay-popup';
        tutorialPopup.className = 'menu-popup hidden';
        tutorialPopup.innerHTML = `
            <div class="popup-content">
                <h3>Tutorial Battle</h3>
                <p>Want to replay the tutorial?</p>
                <p class="popup-subtext">(Completion rewards already claimed)</p>
                <div class="popup-buttons">
                    <button class="popup-btn confirm" id="tutorial-yes-btn">Yes, teach me!</button>
                    <button class="popup-btn cancel" id="tutorial-no-btn">No thanks</button>
                </div>
            </div>
        `;
        document.body.appendChild(tutorialPopup);
        
        // Turn Order Overlay
        const turnOrder = document.createElement('div');
        turnOrder.id = 'turn-order-overlay';
        turnOrder.innerHTML = `
            <div class="turn-order-content">
                <div class="turn-order-title">Fate Decides...</div>
                
                <div class="turn-order-contestants">
                    <div class="contestant player">
                        <div class="contestant-icon">🌿</div>
                        <div class="contestant-name">Seeker</div>
                    </div>
                    
                    <div class="turn-order-vs">⚡</div>
                    
                    <div class="contestant enemy">
                        <div class="contestant-icon">💀</div>
                        <div class="contestant-name">Warden</div>
                    </div>
                </div>
                
                <div class="fate-decider">
                    <div class="fate-coin">
                        <div class="coin-face player-side">🌿</div>
                        <div class="coin-face enemy-side">💀</div>
                    </div>
                </div>
                
                <div class="turn-order-result">
                    <span class="winner-name"></span>
                    <span class="goes-first">Goes First</span>
                </div>
            </div>
        `;
        document.body.appendChild(turnOrder);
    },
    
    /**
     * Create just the turn order overlay (for cases where MainMenu.init() wasn't called)
     */
    createTurnOrderOverlay() {
        if (document.getElementById('turn-order-overlay')) return; // Already exists
        
        // Inject required styles if not already present
        if (!document.getElementById('main-menu-styles')) {
            this.injectStyles();
        }
        
        const turnOrder = document.createElement('div');
        turnOrder.id = 'turn-order-overlay';
        turnOrder.innerHTML = `
            <div class="turn-order-content">
                <div class="turn-order-title">Fate Decides...</div>
                
                <div class="turn-order-contestants">
                    <div class="contestant player">
                        <div class="contestant-icon">🌿</div>
                        <div class="contestant-label contestant-name">Seeker</div>
                    </div>
                    
                    <div class="turn-order-vs">⚡</div>
                    
                    <div class="contestant enemy">
                        <div class="contestant-icon">💀</div>
                        <div class="contestant-label contestant-name">Warden</div>
                    </div>
                </div>
                
                <div class="fate-decider">
                    <div class="fate-coin">
                        <div class="coin-face player-side">🌿</div>
                        <div class="coin-face enemy-side">💀</div>
                    </div>
                </div>
                
                <div class="turn-order-result">
                    <span class="winner-name"></span>
                    <span class="goes-first">Goes First</span>
                </div>
            </div>
        `;
        document.body.appendChild(turnOrder);
    },
    
    bindEvents() {
        // VS AI Button
        document.getElementById('vs-ai-btn').addEventListener('click', () => {
            this.startVsAI();
        });
        
        // Cheat Battle Button
        document.getElementById('cheat-battle-btn')?.addEventListener('click', () => {
            this.startCheatBattle();
        });
        
        // VS Human Button - Open Quick Play
        document.getElementById('vs-human-btn').addEventListener('click', () => {
            if (typeof HomeScreen !== 'undefined') {
                TransitionEngine.fade(() => {
                    this.hide();
                    HomeScreen.open();
                }).then(() => HomeScreen.openQuickPlay());
            }
        });
        
        // Fullscreen Toggle
        document.getElementById('menu-fullscreen-btn').addEventListener('click', () => {
            this.toggleFullscreen();
        });
        
        // How to Play Button
        document.getElementById('how-to-play-btn').addEventListener('click', () => {
            this.showTutorialPopup();
        });
        
        // Tutorial popup buttons
        document.getElementById('tutorial-yes-btn').addEventListener('click', () => {
            this.hideTutorialPopup();
            TransitionEngine.slide(() => {
                this.hide();
            }).then(() => {
                if (typeof TutorialManager !== 'undefined') {
                    TutorialManager.start();
                }
            });
        });
        
        document.getElementById('tutorial-no-btn').addEventListener('click', () => {
            this.hideTutorialPopup();
        });
        
        // Update fullscreen button text on change
        document.addEventListener('fullscreenchange', () => this.updateFullscreenButton());
        document.addEventListener('webkitfullscreenchange', () => this.updateFullscreenButton());
    },
    
    showTutorialPopup() {
        const popup = document.getElementById('tutorial-replay-popup');
        const subtext = popup.querySelector('.popup-subtext');
        
        // Show/hide subtext based on whether rewards were already claimed
        if (typeof PlayerData !== 'undefined' && PlayerData.tutorialCompleted) {
            subtext.style.display = 'block';
        } else {
            subtext.style.display = 'none';
        }
        
        popup.classList.remove('hidden');
    },
    
    hideTutorialPopup() {
        const popup = document.getElementById('tutorial-replay-popup');
        popup.classList.add('hidden');
    },
    
    show() {
        // If HomeScreen is available, use it instead
        if (typeof HomeScreen !== 'undefined' && HomeScreen.open) {
            HomeScreen.open();
            return;
        }
        
        const menu = document.getElementById('main-menu');
        menu.classList.remove('hidden');
        
        // Hide the old fullscreen prompt if it exists
        const oldPrompt = document.getElementById('fullscreen-prompt');
        if (oldPrompt) {
            oldPrompt.classList.add('hidden');
        }
        
        // Hide game container initially
        const gameContainer = document.getElementById('game-container');
        if (gameContainer) {
            gameContainer.style.display = 'none';
        }
    },
    
    hide() {
        const menu = document.getElementById('main-menu');
        menu.classList.add('hidden');
    },
    
    toggleFullscreen() {
        try {
            if (!document.fullscreenElement && !document.webkitFullscreenElement) {
                const elem = document.documentElement;
                if (elem.requestFullscreen) {
                    elem.requestFullscreen().catch(e => console.log('Fullscreen not available:', e.message));
                } else if (elem.webkitRequestFullscreen) {
                    elem.webkitRequestFullscreen();
                }
                this.isFullscreen = true;
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen().catch(e => console.log('Exit fullscreen error:', e.message));
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                }
                this.isFullscreen = false;
            }
        } catch (e) {
            console.log('Fullscreen not supported in this context:', e.message);
        }
    },
    
    updateFullscreenButton() {
        const btn = document.getElementById('menu-fullscreen-btn');
        if (document.fullscreenElement || document.webkitFullscreenElement) {
            btn.textContent = '⛶ Exit Fullscreen';
            this.isFullscreen = true;
        } else {
            btn.textContent = '⛶ Toggle Fullscreen';
            this.isFullscreen = false;
        }
    },
    
    startVsAI() {
        this.selectedMode = 'ai';
        window.testMode = true;
        
        TransitionEngine.slide(() => {
            this.hide();
        }).then(() => {
            this.showTurnOrderAnimation(() => {
                this.startGame();
            });
        });
    },
    
    startCheatBattle() {
        this.selectedMode = 'cheat';
        window.testMode = true;
        window.cheatMode = true;
        
        TransitionEngine.slide(() => {
            this.hide();
        }).then(() => {
            this.startGame();
            setTimeout(() => {
                if (typeof CheatMode !== 'undefined') {
                    CheatMode.start();
                }
            }, 100);
        });
    },
    
    showTurnOrderAnimation(onComplete) {
        // Ensure the turn order overlay exists (may not exist if MainMenu.init() was never called)
        let overlay = document.getElementById('turn-order-overlay');
        if (!overlay) {
            this.createTurnOrderOverlay();
            overlay = document.getElementById('turn-order-overlay');
        }
        
        // If still no overlay (shouldn't happen), skip animation
        if (!overlay) {
            console.warn('[MainMenu] Could not create turn order overlay, skipping animation');
            onComplete?.();
            return;
        }
        
        const contestants = overlay.querySelectorAll('.contestant');
        const fateDecider = overlay.querySelector('.fate-decider');
        const fateCoin = overlay.querySelector('.fate-coin');
        const result = overlay.querySelector('.turn-order-result');
        const winnerName = result.querySelector('.winner-name');
        
        // Determine who goes first (random)
        const playerGoesFirst = Math.random() < 0.5;
        window.playerGoesFirst = playerGoesFirst;
        
        // Show overlay
        overlay.classList.add('active');
        
        // Animation sequence
        const timeline = [
            // Reveal contestants
            { delay: 400, action: () => contestants[0].classList.add('reveal') },
            { delay: 600, action: () => contestants[1].classList.add('reveal') },
            
            // Show coin flip
            { delay: 1000, action: () => fateDecider.classList.add('active') },
            
            // Stop coin and show result
            { delay: 2200, action: () => {
                fateCoin.classList.add('stopped');
                // Set final rotation based on winner
                fateCoin.style.transform = playerGoesFirst ? 'rotateY(0deg)' : 'rotateY(180deg)';
            }},
            
            // Highlight winner/loser
            { delay: 2600, action: () => {
                if (playerGoesFirst) {
                    contestants[0].classList.add('winner');
                    contestants[1].classList.add('loser');
                    winnerName.textContent = 'Seeker';
                    winnerName.style.color = 'var(--rune-glow)';
                } else {
                    contestants[1].classList.add('winner');
                    contestants[0].classList.add('loser');
                    winnerName.textContent = 'Warden';
                    winnerName.style.color = 'var(--dried-blood)';
                }
                result.classList.add('show');
            }},
            
            // Fade out and start game
            { delay: 4200, action: () => {
                overlay.classList.remove('active');
                setTimeout(() => {
                    // Reset for next time
                    contestants.forEach(c => {
                        c.classList.remove('reveal', 'winner', 'loser');
                    });
                    fateDecider.classList.remove('active');
                    fateCoin.classList.remove('stopped');
                    fateCoin.style.transform = '';
                    result.classList.remove('show');
                    
                    onComplete?.();
                }, 500);
            }}
        ];
        
        // Execute timeline
        timeline.forEach(({ delay, action }) => {
            setTimeout(action, delay);
        });
    },
    
    startGame() {
        // Show game container
        const gameContainer = document.getElementById('game-container');
        if (gameContainer) {
            gameContainer.style.display = 'flex';
        }
        
        // Initialize the game
        if (typeof window.initGame === 'function') {
            window.initGame();
        }
    }
};

// Don't auto-initialize - let auth flow control this
// MainMenu.init() will be called by GameFlow after auth completes

console.log('Main Menu module loaded');