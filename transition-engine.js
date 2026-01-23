/**
 * Cryptid Fates - Transition Engine
 * Clean screen transitions using CSS keyframe animations
 */

window.TransitionEngine = {
    overlay: null,
    isTransitioning: false,
    
    durations: {
        voidFade: 500,
        dealSlide: 420,
        shadowWipe: 450
    },
    
    init() {
        if (this.overlay && document.body.contains(this.overlay)) return;
        
        const style = document.createElement('style');
        style.id = 'transition-styles';
        style.textContent = `
            #transition-overlay {
                position: fixed;
                inset: 0;
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
                inset: 0;
            }
            
            /* ===== VOID FADE ===== */
            .transition-layer.void-fade {
                background: #000;
                opacity: 0;
            }
            .transition-layer.void-fade.phase-in {
                animation: fadeIn var(--duration) ease forwards;
            }
            .transition-layer.void-fade.phase-out {
                animation: fadeOut var(--duration) ease forwards;
            }
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
            
            /* ===== DEAL SLIDE ===== */
            .transition-layer.deal-slide {
                background: linear-gradient(135deg, #0a0812, #12101a, #0a0812);
                transform: translateX(105%);
            }
            .transition-layer.deal-slide.phase-in {
                animation: slideIn var(--duration) cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
            }
            .transition-layer.deal-slide.phase-out {
                animation: slideOut var(--duration) cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
            }
            @keyframes slideIn {
                from { transform: translateX(105%); }
                to { transform: translateX(0%); }
            }
            @keyframes slideOut {
                from { transform: translateX(0%); }
                to { transform: translateX(-105%); }
            }
            
            /* ===== SHADOW WIPE ===== */
            .transition-layer.shadow-wipe {
                background: linear-gradient(90deg, #000 0%, #000 60%, transparent 100%);
                transform: translateX(-105%);
            }
            .transition-layer.shadow-wipe.phase-in {
                animation: wipeIn var(--duration) ease-out forwards;
            }
            .transition-layer.shadow-wipe.phase-out {
                animation: wipeOut var(--duration) ease-in forwards;
            }
            @keyframes wipeIn {
                from { transform: translateX(-105%); }
                to { transform: translateX(0%); }
            }
            @keyframes wipeOut {
                from { transform: translateX(0%); }
                to { transform: translateX(105%); }
            }
        `;
        document.head.appendChild(style);
        
        this.overlay = document.createElement('div');
        this.overlay.id = 'transition-overlay';
        this.overlay.innerHTML = '<div class="transition-layer"></div>';
        document.body.appendChild(this.overlay);
        
        console.log('[TransitionEngine] Ready');
    },
    
    go(onHidden, type = 'voidFade') {
        if (!this.overlay) this.init();
        
        if (this.isTransitioning) {
            console.warn('[TransitionEngine] Already transitioning');
            if (onHidden) onHidden();
            return Promise.resolve();
        }
        
        this.isTransitioning = true;
        const duration = this.durations[type] || 500;
        const layer = this.overlay.querySelector('.transition-layer');
        const cssClass = type.replace(/([A-Z])/g, '-$1').toLowerCase();
        
        // Reset layer
        layer.className = 'transition-layer ' + cssClass;
        layer.style.setProperty('--duration', `${duration}ms`);
        
        // Show overlay
        this.overlay.classList.add('active');
        
        return new Promise(resolve => {
            // Phase 1: Animate IN (cover screen)
            layer.classList.add('phase-in');
            
            const onInEnd = () => {
                layer.removeEventListener('animationend', onInEnd);
                
                // Screen is fully covered - swap content
                if (onHidden) {
                    try { onHidden(); } 
                    catch (e) { console.error('[TransitionEngine] Callback error:', e); }
                }
                
                // Phase 2: Animate OUT (reveal new screen)
                layer.classList.remove('phase-in');
                layer.classList.add('phase-out');
                
                const onOutEnd = () => {
                    layer.removeEventListener('animationend', onOutEnd);
                    layer.classList.remove('phase-out');
                    this.overlay.classList.remove('active');
                    this.isTransitioning = false;
                    resolve();
                };
                layer.addEventListener('animationend', onOutEnd, { once: true });
            };
            layer.addEventListener('animationend', onInEnd, { once: true });
        });
    },
    
    fade(onHidden) { return this.go(onHidden, 'voidFade'); },
    slide(onHidden) { return this.go(onHidden, 'dealSlide'); },
    wipe(onHidden) { return this.go(onHidden, 'shadowWipe'); }
};

// Auto-init
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => TransitionEngine.init());
} else {
    TransitionEngine.init();
}
