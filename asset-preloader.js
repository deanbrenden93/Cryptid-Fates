/**
 * Cryptid Fates - Asset Preloader
 * Preloads all game images with smart caching and a sleek loading screen
 */

const AssetPreloader = {
    // Cache configuration
    CACHE_NAME: 'cryptid-fates-assets-v1',
    CACHE_VERSION: '1.0.0',
    
    // All assets to preload
    assets: [
        // Sprites folder
        'sprites/Battle Combat Screen Button.png',
        'sprites/battle-burger.png',
        'sprites/battle-button.png',
        'sprites/boggart.png',
        'sprites/burn-button.png',
        'sprites/card-back.png',
        'sprites/Cast Button.png',
        'sprites/collection-button.png',
        'sprites/Cryptid Blood Mythical.png',
        'sprites/Cryptid Blood Normal.png',
        'sprites/Cryptid Nature Mythical.png',
        'sprites/Cryptid Steel Mythical.png',
        'sprites/decks-button.png',
        'sprites/embers-icon.png',
        'sprites/end-button.png',
        'sprites/grimoire-button.png',
        'sprites/hellhound_pup.png',
        'sprites/hellhound.png',
        'sprites/kindling-button.png',
        'sprites/library-gargoylealt2.png',
        'sprites/loginbg.webp',
        'sprites/logo.png',
        'sprites/monster-hand-cursor.png',
        'sprites/mothman.png',
        'sprites/myling.png',
        'sprites/new-logo.png',
        'sprites/rooftop-gargoyle.png',
        'sprites/shadow-person.png',
        'sprites/shop-button.png',
        'sprites/Spell Mythical.png',
        'sprites/Spell Normal.png',
        'sprites/test-battlefield-bg.jpg',
        'sprites/test-battlefield-snow.jpg',
        'sprites/Testbackground.png',
        'sprites/turn-button.png',
        'sprites/vampire-initiate.png',
        'sprites/vampire-lord-bg.png',
        'sprites/vampire-lord.png',
        
        // Card templates folder
        'card-templates/blaze-element.png',
        'card-templates/common-gem.png',
        'card-templates/nature-element.png',
        'card-templates/new-spell.png',
        'card-templates/new-water.png',
        'card-templates/rare-gems.png',
        'card-templates/steel-element.png',
        'card-templates/ultimate-gems.png',
        'card-templates/uncommon-gems.png',
        'card-templates/void-element.png',
        
        // Results screen folder
        'results-screen/defeat-banner.png',
        'results-screen/main-menu-results-button.png',
        'results-screen/match-results-background.png',
        'results-screen/rematch-button.png',
        'results-screen/victory-banner.png'
    ],
    
    // State
    loaded: 0,
    total: 0,
    errors: [],
    isComplete: false,
    
    // Keep decoded images in memory so browser doesn't garbage collect them
    imageCache: new Map(),
    
    /**
     * Initialize and start preloading
     * @returns {Promise<void>}
     */
    async preload() {
        this.total = this.assets.length;
        this.loaded = 0;
        this.errors = [];
        this.isComplete = false;
        this.imageCache.clear();
        
        this.showLoadingScreen();
        
        console.log(`[AssetPreloader] Starting preload of ${this.total} assets...`);
        console.log('[AssetPreloader] Using Image.decode() for GPU-accelerated decoding');
        
        // Preload with concurrency limit (6 parallel loads)
        const concurrency = 6;
        const chunks = this.chunkArray(this.assets, concurrency);
        
        for (const chunk of chunks) {
            await Promise.all(chunk.map(url => this.loadAsset(url)));
        }
        
        this.isComplete = true;
        console.log(`[AssetPreloader] Complete! Loaded ${this.loaded}/${this.total} assets`);
        console.log(`[AssetPreloader] ${this.imageCache.size} images decoded and cached in memory`);
        
        if (this.errors.length > 0) {
            console.warn('[AssetPreloader] Failed to load:', this.errors);
        }
        
        // Brief delay to show 100% before transitioning
        await this.delay(300);
        
        return {
            loaded: this.loaded,
            total: this.total,
            errors: this.errors
        };
    },
    
    /**
     * Load a single asset with cache checking
     * Uses direct Image loading for better browser decoding
     */
    async loadAsset(url, cache) {
        try {
            // Always load via Image element for proper decoding into memory
            // The browser's HTTP cache will handle file caching
            const img = await this.loadAndDecodeImage(url);
            
            // Store in our memory cache to prevent garbage collection
            this.imageCache.set(url, img);
            
            this.loaded++;
            this.updateProgress();
            
        } catch (error) {
            console.warn(`[AssetPreloader] Failed to load ${url}:`, error.message);
            this.errors.push(url);
            this.loaded++;
            this.updateProgress();
        }
    },
    
    /**
     * Load and fully decode an image into memory
     * Adds to hidden container in DOM so browser can reuse decoded bitmap
     */
    loadAndDecodeImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            
            img.onload = async () => {
                try {
                    // Use decode() to fully decode the image into GPU/memory
                    if (img.decode) {
                        await img.decode();
                    }
                    
                    // Add to hidden DOM container so browser keeps the decoded bitmap
                    // This allows other <img> tags with same src to reuse it instantly
                    this.addToHiddenContainer(img);
                    
                    resolve(img);
                } catch (e) {
                    // decode() can fail on some images, but onload means it's usable
                    this.addToHiddenContainer(img);
                    resolve(img);
                }
            };
            
            img.onerror = () => {
                reject(new Error(`Failed to load: ${url}`));
            };
            
            img.src = url;
        });
    },
    
    /**
     * Add decoded image to hidden DOM container
     * This keeps the decoded bitmap in browser memory for instant reuse
     */
    addToHiddenContainer(img) {
        let container = document.getElementById('preloader-image-cache');
        if (!container) {
            container = document.createElement('div');
            container.id = 'preloader-image-cache';
            container.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none;';
            document.body.appendChild(container);
        }
        container.appendChild(img);
    },
    
    /**
     * Show the loading screen
     */
    showLoadingScreen() {
        if (document.getElementById('asset-loading-screen')) return;
        
        const screen = document.createElement('div');
        screen.id = 'asset-loading-screen';
        screen.innerHTML = `
            <div class="preloader-content">
                <img class="preloader-flame" src="sprites/embers-icon.png" alt="">
                <h1 class="preloader-title">CRYPTID FATES</h1>
                <div class="preloader-bar-container">
                    <div class="preloader-bar">
                        <div class="preloader-bar-fill" id="preloader-fill"></div>
                        <div class="preloader-bar-glow"></div>
                    </div>
                    <div class="preloader-text">
                        <span id="preloader-status">Summoning assets...</span>
                        <span id="preloader-percent">0%</span>
                    </div>
                </div>
                <div class="preloader-hint">Preparing the ritual</div>
            </div>
        `;
        
        document.body.appendChild(screen);
        
        // Trigger animation
        requestAnimationFrame(() => {
            screen.classList.add('visible');
        });
    },
    
    /**
     * Update the loading progress UI
     */
    updateProgress() {
        const percent = Math.round((this.loaded / this.total) * 100);
        const fill = document.getElementById('preloader-fill');
        const percentText = document.getElementById('preloader-percent');
        const status = document.getElementById('preloader-status');
        
        if (fill) fill.style.width = `${percent}%`;
        if (percentText) percentText.textContent = `${percent}%`;
        
        if (status) {
            if (percent < 25) {
                status.textContent = 'Summoning assets...';
            } else if (percent < 50) {
                status.textContent = 'Channeling power...';
            } else if (percent < 75) {
                status.textContent = 'Binding spirits...';
            } else if (percent < 100) {
                status.textContent = 'Finalizing ritual...';
            } else {
                status.textContent = 'Ready!';
            }
        }
    },
    
    /**
     * Hide the loading screen with fade
     */
    async hideLoadingScreen() {
        const screen = document.getElementById('asset-loading-screen');
        if (!screen) return;
        
        screen.classList.add('fade-out');
        await this.delay(500);
        screen.remove();
    },
    
    /**
     * Clear the in-memory image cache and DOM container
     */
    clearCache() {
        this.imageCache.clear();
        const container = document.getElementById('preloader-image-cache');
        if (container) container.remove();
        console.log('[AssetPreloader] Memory cache cleared');
    },
    
    /**
     * Get a preloaded image from cache
     */
    getImage(url) {
        return this.imageCache.get(url);
    },
    
    /**
     * Helper: Split array into chunks
     */
    chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    },
    
    /**
     * Helper: Delay promise
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};

// ==================== LOADING SCREEN STYLES ====================

const preloaderStyles = `
#asset-loading-screen {
    position: fixed;
    inset: 0;
    background: #030201;
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.5s ease;
}

#asset-loading-screen.visible {
    opacity: 1;
}

#asset-loading-screen.fade-out {
    opacity: 0;
    pointer-events: none;
}

.preloader-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
    padding: 40px;
}

.preloader-flame {
    width: 48px;
    height: 48px;
    object-fit: contain;
    filter: drop-shadow(0 0 12px rgba(255, 80, 20, 0.8))
            drop-shadow(0 0 24px rgba(255, 60, 10, 0.5));
    animation: flameFloat 2s ease-in-out infinite;
}

@keyframes flameFloat {
    0%, 100% { 
        transform: translateY(0) scale(1);
        filter: brightness(1);
    }
    50% { 
        transform: translateY(-8px) scale(1.05);
        filter: brightness(1.2);
    }
}

.preloader-title {
    font-family: 'Cinzel', serif;
    font-size: clamp(24px, 6vw, 40px);
    font-weight: 700;
    color: #fff;
    letter-spacing: 8px;
    margin: 0;
    text-shadow: 
        0 0 10px rgba(255, 150, 80, 0.6),
        0 0 30px rgba(255, 100, 40, 0.4),
        0 4px 8px rgba(0, 0, 0, 0.9);
    text-transform: uppercase;
}

.preloader-bar-container {
    width: clamp(250px, 60vw, 400px);
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.preloader-bar {
    position: relative;
    height: 6px;
    background: rgba(255, 80, 20, 0.15);
    border-radius: 3px;
    overflow: hidden;
    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.5);
}

.preloader-bar-fill {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    width: 0%;
    background: linear-gradient(90deg, 
        #ff4010 0%, 
        #ff6020 50%, 
        #ff8040 100%
    );
    border-radius: 3px;
    transition: width 0.15s ease-out;
    box-shadow: 
        0 0 10px rgba(255, 80, 20, 0.6),
        0 0 20px rgba(255, 60, 10, 0.4);
}

.preloader-bar-glow {
    position: absolute;
    top: -2px;
    left: 0;
    right: 0;
    height: 10px;
    background: linear-gradient(90deg, 
        transparent 0%, 
        rgba(255, 120, 60, 0.3) 50%, 
        transparent 100%
    );
    animation: glowPulse 1.5s ease-in-out infinite;
    pointer-events: none;
}

@keyframes glowPulse {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
}

.preloader-text {
    display: flex;
    justify-content: space-between;
    font-family: 'Source Sans Pro', sans-serif;
    font-size: 13px;
    color: #8a6a4a;
    letter-spacing: 1px;
}

#preloader-percent {
    font-family: 'Cinzel', serif;
    font-weight: 600;
    color: #ff8050;
    text-shadow: 0 0 10px rgba(255, 100, 40, 0.5);
}

.preloader-hint {
    font-family: 'Source Sans Pro', sans-serif;
    font-size: 12px;
    color: #5a4030;
    letter-spacing: 2px;
    text-transform: uppercase;
    animation: hintPulse 2s ease-in-out infinite;
}

@keyframes hintPulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.8; }
}

/* Ember particles behind the loader */
#asset-loading-screen::before {
    content: '';
    position: absolute;
    inset: 0;
    background: 
        radial-gradient(ellipse at 50% 80%, rgba(255, 60, 10, 0.08) 0%, transparent 50%),
        radial-gradient(ellipse at 30% 70%, rgba(255, 40, 0, 0.05) 0%, transparent 40%),
        radial-gradient(ellipse at 70% 70%, rgba(255, 40, 0, 0.05) 0%, transparent 40%);
    animation: emberglow 4s ease-in-out infinite;
    pointer-events: none;
}

@keyframes emberglow {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 1; }
}
`;

// Inject preloader styles immediately
const preloaderStyleSheet = document.createElement('style');
preloaderStyleSheet.id = 'preloader-styles';
preloaderStyleSheet.textContent = preloaderStyles;
document.head.appendChild(preloaderStyleSheet);

// Export
window.AssetPreloader = AssetPreloader;

console.log('[AssetPreloader] Module loaded');

