/**
 * Cryptid Fates - Transition Engine
 * Simple screen transitions - call TransitionEngine.go() with your screen swap logic
 * 
 * Usage:
 *   TransitionEngine.go(() => { HomeScreen.close(); Shop.open(); });
 *   TransitionEngine.go(() => { Shop.close(); HomeScreen.open(); }, 'dealSlide');
 */

window.TransitionEngine = {
    // Configuration
    defaultTransition: 'voidFade',
    isTransitioning: false,
    overlay: null,
    
    // Transition durations (ms) - snappy but visible
    durations: {
        voidFade: 500,
        dealSlide: 420,
        shadowWipe: 450
    },
    
    /**
     * Initialize the overlay element
     */
    init() {
        if (this.overlay && document.body.contains(this.overlay)) return;
        
        // Inject styles
        if (!document.getElementById('transition-styles')) {
            const style = document.createElement('style');
            style.id = 'transition-styles';
            style.textContent = `
                #transition-overlay {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    z-index: 999999;
                    pointer-events: none;
                    visibility: hidden;
                }
                #transition-overlay.active {
                    visibility: visible;
                    pointer-events: all;
                }
                .transition-layer {
                    position: absolute;
                    top: 0; left: 0; right: 0; bottom: 0;
                    transition: transform var(--duration) cubic-bezier(0.22, 0.61, 0.36, 1),
                                opacity var(--duration) ease;
                }
                
                /* Void Fade - fade to black and back */
                .transition-layer.void-fade { background: #000; opacity: 0; }
                .transition-layer.void-fade.covering { opacity: 1; }
                .transition-layer.void-fade.exiting { opacity: 0; }
                
                /* Deal Slide - card-like sweep */
                .transition-layer.deal-slide {
                    background: linear-gradient(135deg, #0a0812, #12101a, #0a0812);
                    transform: translateX(105%);
                }
                .transition-layer.deal-slide.covering { transform: translateX(0%); }
                .transition-layer.deal-slide.covering.exiting { transform: translateX(-105%); }
                
                /* Shadow Wipe - dramatic wipe */
                .transition-layer.shadow-wipe {
                    background: linear-gradient(90deg, #000 0%, #000 60%, transparent 100%);
                    transform: translateX(-105%);
                }
                .transition-layer.shadow-wipe.covering { transform: translateX(0%); }
                .transition-layer.shadow-wipe.covering.exiting { transform: translateX(105%); }
            `;
            document.head.appendChild(style);
        }
        
        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.id = 'transition-overlay';
        this.overlay.innerHTML = '<div class="transition-layer"></div>';
        document.body.appendChild(this.overlay);
        
        console.log('[TransitionEngine] Ready');
    },
    
    /**
     * Perform a transition with a callback at the hidden point
     * @param {Function} onHidden - Called when screen is fully covered (do your screen swap here)
     * @param {string} type - 'voidFade', 'dealSlide', or 'shadowWipe'
     * @returns {Promise} Resolves when transition completes
     */
    go(onHidden, type = this.defaultTransition) {
        if (!this.overlay) this.init();
        
        // If already transitioning, just run the callback
        if (this.isTransitioning) {
            console.warn('[TransitionEngine] Already transitioning, running callback immediately');
            if (onHidden) onHidden();
            return Promise.resolve();
        }
        
        this.isTransitioning = true;
        const duration = this.durations[type] || 500;
        const layer = this.overlay.querySelector('.transition-layer');
        
        // Setup - start at initial position
        layer.className = 'transition-layer ' + this.getCssClass(type);
        layer.style.setProperty('--duration', `${duration}ms`);
        this.overlay.classList.add('active');
        
        return new Promise(resolve => {
            // Phase 1: Cover the screen
            requestAnimationFrame(() => {
                layer.classList.add('covering');
                
                // Wait for cover transition to complete
                setTimeout(() => {
                    // Screen is now fully covered - do the swap
                    if (onHidden) {
                        try {
                            onHidden();
                        } catch (e) {
                            console.error('[TransitionEngine] Callback error:', e);
                        }
                    }
                    
                    // Phase 2: Exit (reveal new screen)
                    // Keep 'covering' so .covering.exiting selector applies (prevents snap-back)
                    layer.classList.add('exiting');
                    
                    // Wait for exit transition to complete
                    setTimeout(() => {
                        layer.classList.remove('covering', 'exiting');
                        this.overlay.classList.remove('active');
                        this.isTransitioning = false;
                        resolve();
                    }, duration + 20);
                    
                }, duration + 20); // Small buffer for transition to fully complete
            });
        });
    },
    
    /**
     * Convert camelCase to kebab-case
     */
    getCssClass(type) {
        return type.replace(/([A-Z])/g, '-$1').toLowerCase();
    },
    
    /**
     * Quick presets
     */
    fade(onHidden) { return this.go(onHidden, 'voidFade'); },
    slide(onHidden) { return this.go(onHidden, 'dealSlide'); },
    wipe(onHidden) { return this.go(onHidden, 'shadowWipe'); }
};

// Auto-init when ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => TransitionEngine.init());
} else {
    TransitionEngine.init();
}

console.log('[TransitionEngine] Module loaded');
