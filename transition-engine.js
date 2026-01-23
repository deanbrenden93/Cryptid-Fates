/**
 * Cryptid Fates - Transition Engine
 * Elegant screen transitions for a polished game feel
 * 
 * Usage:
 *   await TransitionEngine.transition('dealSlide', () => { swapScreens(); });
 *   await TransitionEngine.toBattle(() => { showBattle(); });
 *   await TransitionEngine.toMenu(() => { showMenu(); });
 */

window.TransitionEngine = {
    // ==================== CONFIGURATION ====================
    
    // Set to true to see console logs
    debug: true,
    
    // Transition types with their settings
    transitions: {
        voidFade: {
            duration: 800,      // Total duration in ms
            swapPoint: 0.5      // Swap screens at 50%
        },
        dealSlide: {
            duration: 700,
            swapPoint: 0.5
        },
        shadowWipe: {
            duration: 700,
            swapPoint: 0.5
        }
    },
    
    // Screen transition mappings
    screenMappings: {
        // Toward action (Deal Slide)
        'home-to-battle': 'dealSlide',
        'menu-to-battle': 'dealSlide',
        'battle-to-results': 'dealSlide',
        'matchfound-to-battle': 'dealSlide',
        'tutorial-to-battle': 'dealSlide',
        
        // Away from action / browsing (Void Fade)
        'login-to-home': 'voidFade',
        'home-to-collection': 'voidFade',
        'collection-to-home': 'voidFade',
        'home-to-deckbuilder': 'voidFade',
        'deckbuilder-to-home': 'voidFade',
        'home-to-shop': 'voidFade',
        'shop-to-home': 'voidFade',
        'results-to-home': 'voidFade',
        'home-to-settings': 'voidFade',
        'settings-to-home': 'voidFade',
        
        // Default fallback
        'default': 'voidFade'
    },
    
    // State
    isTransitioning: false,
    overlay: null,
    
    // ==================== INITIALIZATION ====================
    
    init() {
        if (this.overlay && document.body.contains(this.overlay)) {
            if (this.debug) console.log('[TransitionEngine] Already initialized');
            return;
        }
        
        // Inject styles first
        this.injectStyles();
        
        // Create overlay element
        this.overlay = document.createElement('div');
        this.overlay.id = 'transition-overlay';
        this.overlay.innerHTML = `<div class="transition-layer"></div>`;
        
        // Append to body
        if (document.body) {
            document.body.appendChild(this.overlay);
            console.log('[TransitionEngine] Initialized - overlay added to DOM');
        } else {
            console.error('[TransitionEngine] document.body not available!');
        }
    },
    
    injectStyles() {
        if (document.getElementById('transition-engine-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'transition-engine-styles';
        style.textContent = `
            /* ==================== TRANSITION OVERLAY ==================== */
            #transition-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 999999;
                pointer-events: none;
                display: none;
            }
            
            #transition-overlay.active {
                display: block;
                pointer-events: all;
            }
            
            .transition-layer {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                will-change: transform, opacity;
            }
            
            /* ==================== VOID FADE ==================== */
            .transition-layer.void-fade {
                background: #000000;
                opacity: 0;
            }
            
            .transition-layer.void-fade.animating {
                animation: voidFadeAnim var(--duration) ease-in-out forwards;
            }
            
            @keyframes voidFadeAnim {
                0% { opacity: 0; }
                40%, 60% { opacity: 1; }
                100% { opacity: 0; }
            }
            
            /* ==================== SHADOW WIPE ==================== */
            .transition-layer.shadow-wipe {
                background: linear-gradient(90deg, 
                    #000 0%,
                    #000 40%,
                    rgba(10, 5, 15, 0.98) 60%,
                    rgba(15, 10, 20, 0.9) 75%,
                    rgba(20, 15, 30, 0.6) 85%,
                    rgba(25, 20, 35, 0.3) 92%,
                    transparent 100%
                );
                transform: translateX(-100%);
            }
            
            .transition-layer.shadow-wipe.animating {
                animation: shadowWipeAnim var(--duration) ease-in-out forwards;
            }
            
            @keyframes shadowWipeAnim {
                0% { transform: translateX(-100%); }
                40%, 60% { transform: translateX(0%); }
                100% { transform: translateX(100%); }
            }
            
            /* ==================== DEAL SLIDE ==================== */
            .transition-layer.deal-slide {
                background: linear-gradient(135deg, #0a0812 0%, #12101a 50%, #0a0812 100%);
                transform: translateX(105%);
                opacity: 1;
            }
            
            .transition-layer.deal-slide.animating {
                animation: dealSlideAnim var(--duration) cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
            }
            
            @keyframes dealSlideAnim {
                0% { 
                    transform: translateX(105%) rotate(2deg);
                    box-shadow: -20px 0 60px rgba(0, 0, 0, 0.8);
                }
                40%, 60% {
                    transform: translateX(0%) rotate(0deg);
                    box-shadow: 0 4px 60px rgba(0, 0, 0, 0.6);
                }
                92% {
                    opacity: 1;
                    transform: translateX(-100%) rotate(-1.5deg);
                    box-shadow: 20px 0 50px rgba(0, 0, 0, 0.7);
                }
                100% { 
                    opacity: 0;
                    transform: translateX(-120%) rotate(-2deg);
                    box-shadow: none;
                }
            }
        `;
        document.head.appendChild(style);
        
        if (this.debug) console.log('[TransitionEngine] Styles injected');
    },
    
    // ==================== CORE TRANSITION METHOD ====================
    
    /**
     * Perform a transition with a callback at the swap point
     * @param {string} type - 'voidFade', 'dealSlide', or 'shadowWipe'
     * @param {Function} onSwap - Callback to execute at screen swap point
     * @param {Object} options - Optional overrides { duration }
     * @returns {Promise} Resolves when transition completes
     */
    async transition(type, onSwap, options = {}) {
        // Initialize if needed
        if (!this.overlay) {
            this.init();
        }
        
        if (this.debug) console.log('[TransitionEngine] Starting transition:', type);
        
        // Prevent overlapping transitions
        if (this.isTransitioning) {
            console.warn('[TransitionEngine] Transition already in progress, executing swap immediately');
            if (onSwap) {
                try { onSwap(); } catch (e) { console.error('[TransitionEngine] Swap error:', e); }
            }
            return Promise.resolve();
        }
        
        this.isTransitioning = true;
        
        // Get transition config
        const config = this.transitions[type] || this.transitions.voidFade;
        const duration = options.duration || config.duration;
        const swapTime = duration * config.swapPoint;
        
        // Get CSS class name
        const cssClass = this.getCssClass(type);
        
        if (this.debug) console.log('[TransitionEngine] Duration:', duration, 'Swap at:', swapTime, 'CSS class:', cssClass);
        
        // Setup overlay
        const layer = this.overlay.querySelector('.transition-layer');
        if (!layer) {
            console.error('[TransitionEngine] Transition layer not found!');
            if (onSwap) onSwap();
            this.isTransitioning = false;
            return Promise.resolve();
        }
        
        layer.className = 'transition-layer ' + cssClass;
        layer.style.setProperty('--duration', `${duration}ms`);
        this.overlay.classList.add('active');
        
        if (this.debug) console.log('[TransitionEngine] Overlay activated');
        
        return new Promise((resolve) => {
            // Start animation on next frame
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    layer.classList.add('animating');
                    if (this.debug) console.log('[TransitionEngine] Animation started');
                    
                    // Execute swap at midpoint
                    setTimeout(() => {
                        if (this.debug) console.log('[TransitionEngine] Executing swap callback');
                        if (onSwap) {
                            try {
                                onSwap();
                            } catch (e) {
                                console.error('[TransitionEngine] Swap callback error:', e);
                            }
                        }
                    }, swapTime);
                    
                    // Cleanup after animation
                    setTimeout(() => {
                        layer.classList.remove('animating');
                        this.overlay.classList.remove('active');
                        this.isTransitioning = false;
                        if (this.debug) console.log('[TransitionEngine] Transition complete');
                        resolve();
                    }, duration + 100);
                });
            });
        });
    },
    
    /**
     * Convert camelCase to kebab-case for CSS class
     */
    getCssClass(type) {
        return type.replace(/([A-Z])/g, '-$1').toLowerCase();
    },
    
    // ==================== CONVENIENCE METHODS ====================
    
    /**
     * Transition using the screen mapping
     * @param {string} from - Source screen name
     * @param {string} to - Destination screen name
     * @param {Function} onSwap - Callback at swap point
     */
    async navigate(from, to, onSwap) {
        const key = `${from}-to-${to}`;
        const type = this.screenMappings[key] || this.screenMappings.default;
        return this.transition(type, onSwap);
    },
    
    /**
     * Quick method: Transition TO battle (action-oriented)
     */
    async toBattle(onSwap) {
        return this.transition('dealSlide', onSwap);
    },
    
    /**
     * Quick method: Transition FROM battle to results
     */
    async toResults(onSwap) {
        return this.transition('dealSlide', onSwap);
    },
    
    /**
     * Quick method: Transition to menu/home (calm)
     */
    async toMenu(onSwap) {
        return this.transition('voidFade', onSwap);
    },
    
    /**
     * Quick method: Browse screens (collection, deckbuilder, shop)
     */
    async toBrowse(onSwap) {
        return this.transition('voidFade', onSwap);
    },
    
    /**
     * Quick method: Shadow wipe (alternative for variety)
     */
    async wipe(onSwap) {
        return this.transition('shadowWipe', onSwap);
    },
    
    // ==================== UTILITY ====================
    
    /**
     * Check if currently transitioning
     */
    isBusy() {
        return this.isTransitioning;
    },
    
    /**
     * Force stop any transition (emergency use)
     */
    forceStop() {
        if (this.overlay) {
            const layer = this.overlay.querySelector('.transition-layer');
            layer.classList.remove('animating');
            this.overlay.classList.remove('active');
        }
        this.isTransitioning = false;
    }
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => TransitionEngine.init());
} else {
    TransitionEngine.init();
}

console.log('[TransitionEngine] Module loaded');

