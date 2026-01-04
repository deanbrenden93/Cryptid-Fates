/**
 * Holographic Card Effect System
 * Uses PixiJS with custom shaders for realistic holographic effects
 * Falls back to CSS for unsupported devices
 */

const HoloEffect = {
    // Configuration
    config: {
        enabled: true,
        quality: 'high', // 'high', 'low', 'off'
        maxCards: 50,    // Max simultaneous holo effects
    },
    
    // State
    app: null,
    container: null,
    holoSprites: new Map(), // cardElement -> holoSprite
    isInitialized: false,
    useWebGL: false,
    mouseX: 0.5,
    mouseY: 0.5,
    time: 0,
    
    // Fragment shader for holographic effect
    fragmentShader: `
        precision mediump float;
        
        varying vec2 vTextureCoord;
        uniform sampler2D uSampler;
        uniform float uTime;
        uniform vec2 uMouse;
        uniform float uIntensity;
        
        // HSV to RGB conversion
        vec3 hsv2rgb(vec3 c) {
            vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
            vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
            return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
        }
        
        void main(void) {
            vec2 uv = vTextureCoord;
            
            // Base angle influenced by mouse position (simulates viewing angle)
            float angleOffset = (uMouse.x - 0.5) * 2.0 + (uMouse.y - 0.5) * 1.5;
            
            // Create diagonal gradient based on position
            float diagonal = (uv.x + uv.y) * 0.5;
            
            // Add some wave distortion for organic feel
            float wave = sin(uv.x * 12.0 + uTime * 0.5) * 0.02;
            wave += sin(uv.y * 8.0 - uTime * 0.3) * 0.02;
            
            // Calculate hue based on position, time, and mouse
            float hue = diagonal + angleOffset * 0.3 + wave + uTime * 0.05;
            hue = fract(hue); // Keep in 0-1 range
            
            // Fresnel-like effect - stronger at edges relative to "viewing angle"
            vec2 center = vec2(0.5 + (uMouse.x - 0.5) * 0.3, 0.5 + (uMouse.y - 0.5) * 0.3);
            float dist = distance(uv, center);
            float fresnel = smoothstep(0.0, 0.7, dist);
            
            // Create the holographic color
            float saturation = 0.7 + fresnel * 0.3;
            float brightness = 0.85 + sin(diagonal * 20.0 + uTime) * 0.1;
            vec3 holoColor = hsv2rgb(vec3(hue, saturation, brightness));
            
            // Fine line pattern (like real holo cards)
            float lines = sin(uv.x * 100.0 + uv.y * 100.0) * 0.5 + 0.5;
            lines = smoothstep(0.4, 0.6, lines);
            float lineEffect = mix(0.9, 1.1, lines);
            
            // Specular highlight that follows mouse
            vec2 specPos = uMouse;
            float spec = 1.0 - smoothstep(0.0, 0.4, distance(uv, specPos));
            spec = pow(spec, 3.0) * 0.5;
            
            // Combine everything
            vec3 finalColor = holoColor * lineEffect;
            finalColor += vec3(spec); // Add specular
            
            // Output with controlled opacity
            float alpha = uIntensity * (0.35 + fresnel * 0.15 + spec * 0.3);
            
            gl_FragColor = vec4(finalColor, alpha);
        }
    `,
    
    // Vertex shader (standard)
    vertexShader: `
        attribute vec2 aVertexPosition;
        attribute vec2 aTextureCoord;
        
        uniform mat3 projectionMatrix;
        
        varying vec2 vTextureCoord;
        
        void main(void) {
            gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
            vTextureCoord = aTextureCoord;
        }
    `,
    
    /**
     * Initialize the holographic effect system
     */
    init() {
        if (this.isInitialized) return;
        
        // Check WebGL support
        this.useWebGL = this.checkWebGLSupport();
        
        if (!this.useWebGL) {
            console.log('HoloEffect: WebGL not available, using CSS fallback');
            document.body.classList.add('holo-css-fallback');
            this.isInitialized = true;
            return;
        }
        
        // Check performance tier
        this.detectPerformanceTier();
        
        if (this.config.quality === 'off') {
            console.log('HoloEffect: Disabled due to low performance device');
            document.body.classList.add('holo-css-fallback');
            this.isInitialized = true;
            return;
        }
        
        try {
            // Create PixiJS application
            this.app = new PIXI.Application({
                width: window.innerWidth,
                height: window.innerHeight,
                transparent: true,
                antialias: this.config.quality === 'high',
                resolution: this.config.quality === 'high' ? window.devicePixelRatio : 1,
                autoDensity: true,
            });
            
            // Style the canvas to overlay the page
            this.app.view.style.position = 'fixed';
            this.app.view.style.top = '0';
            this.app.view.style.left = '0';
            this.app.view.style.width = '100%';
            this.app.view.style.height = '100%';
            this.app.view.style.pointerEvents = 'none';
            this.app.view.style.zIndex = '9999';
            this.app.view.id = 'holo-canvas';
            
            // Create container for holo sprites
            this.container = new PIXI.Container();
            this.app.stage.addChild(this.container);
            
            // Add canvas to document
            document.body.appendChild(this.app.view);
            
            // Track mouse position
            document.addEventListener('mousemove', (e) => {
                this.mouseX = e.clientX / window.innerWidth;
                this.mouseY = e.clientY / window.innerHeight;
            });
            
            // Touch support
            document.addEventListener('touchmove', (e) => {
                if (e.touches.length > 0) {
                    this.mouseX = e.touches[0].clientX / window.innerWidth;
                    this.mouseY = e.touches[0].clientY / window.innerHeight;
                }
            });
            
            // Handle resize
            window.addEventListener('resize', () => this.handleResize());
            
            // Start render loop
            this.app.ticker.add(() => this.update());
            
            this.isInitialized = true;
            console.log('HoloEffect: Initialized with WebGL, quality:', this.config.quality);
            
        } catch (e) {
            console.error('HoloEffect: Failed to initialize WebGL', e);
            document.body.classList.add('holo-css-fallback');
            this.useWebGL = false;
            this.isInitialized = true;
        }
    },
    
    /**
     * Check if WebGL is supported
     */
    checkWebGLSupport() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            return !!gl;
        } catch (e) {
            return false;
        }
    },
    
    /**
     * Detect device performance tier
     */
    detectPerformanceTier() {
        // Check for low-end device indicators
        const isLowEnd = (
            navigator.hardwareConcurrency <= 2 ||
            navigator.deviceMemory < 4 ||
            /Android [4-5]\./i.test(navigator.userAgent) ||
            window.matchMedia('(prefers-reduced-motion: reduce)').matches
        );
        
        if (isLowEnd) {
            this.config.quality = 'low';
        }
        
        // Check user preference from localStorage
        const savedQuality = localStorage.getItem('holoQuality');
        if (savedQuality) {
            this.config.quality = savedQuality;
        }
    },
    
    /**
     * Handle window resize
     */
    handleResize() {
        if (this.app) {
            this.app.renderer.resize(window.innerWidth, window.innerHeight);
            // Update all sprite positions
            this.holoSprites.forEach((sprite, element) => {
                this.updateSpritePosition(sprite, element);
            });
        }
    },
    
    /**
     * Create holographic filter
     */
    createHoloFilter() {
        const filter = new PIXI.Filter(this.vertexShader, this.fragmentShader, {
            uTime: 0,
            uMouse: [0.5, 0.5],
            uIntensity: 1.0,
        });
        return filter;
    },
    
    /**
     * Register a foil card element for holographic effect
     */
    registerCard(cardElement) {
        if (!this.useWebGL || !this.app) return;
        if (this.holoSprites.has(cardElement)) return;
        if (this.holoSprites.size >= this.config.maxCards) return;
        
        // Find the art area within the card
        const artArea = cardElement.querySelector('.gc-art');
        if (!artArea) return;
        
        // Create a sprite with holo filter
        const sprite = new PIXI.Sprite(PIXI.Texture.WHITE);
        const filter = this.createHoloFilter();
        sprite.filters = [filter];
        sprite.holoFilter = filter;
        sprite.targetElement = artArea;
        sprite.blendMode = PIXI.BLEND_MODES.ADD;
        
        // Position the sprite
        this.updateSpritePosition(sprite, artArea);
        
        // Add to container and map
        this.container.addChild(sprite);
        this.holoSprites.set(cardElement, sprite);
    },
    
    /**
     * Unregister a foil card element
     */
    unregisterCard(cardElement) {
        const sprite = this.holoSprites.get(cardElement);
        if (sprite) {
            this.container.removeChild(sprite);
            sprite.destroy();
            this.holoSprites.delete(cardElement);
        }
    },
    
    /**
     * Update sprite position to match DOM element
     */
    updateSpritePosition(sprite, element) {
        const rect = element.getBoundingClientRect();
        sprite.x = rect.left;
        sprite.y = rect.top;
        sprite.width = rect.width;
        sprite.height = rect.height;
        sprite.visible = rect.width > 0 && rect.height > 0;
    },
    
    /**
     * Update loop - called every frame
     */
    update() {
        this.time += 0.016; // Approximate delta time
        
        this.holoSprites.forEach((sprite, element) => {
            // Check if element still exists in DOM
            if (!document.body.contains(element)) {
                this.unregisterCard(element);
                return;
            }
            
            // Update position
            this.updateSpritePosition(sprite, sprite.targetElement);
            
            // Update shader uniforms
            if (sprite.holoFilter) {
                sprite.holoFilter.uniforms.uTime = this.time;
                sprite.holoFilter.uniforms.uMouse = [this.mouseX, this.mouseY];
                
                // Intensity based on whether card is hovered
                const isHovered = element.matches(':hover') || element.closest(':hover');
                sprite.holoFilter.uniforms.uIntensity = isHovered ? 1.3 : 1.0;
            }
        });
    },
    
    /**
     * Scan for new foil cards and register them
     */
    scanForFoilCards(container = document) {
        if (!this.isInitialized) this.init();
        if (!this.useWebGL) return;
        
        const foilCards = container.querySelectorAll('.game-card.foil');
        foilCards.forEach(card => this.registerCard(card));
    },
    
    /**
     * Clear all registered cards
     */
    clear() {
        this.holoSprites.forEach((sprite, element) => {
            this.container.removeChild(sprite);
            sprite.destroy();
        });
        this.holoSprites.clear();
    },
    
    /**
     * Set quality level
     */
    setQuality(quality) {
        this.config.quality = quality;
        localStorage.setItem('holoQuality', quality);
        
        if (quality === 'off') {
            this.clear();
            if (this.app) {
                this.app.view.style.display = 'none';
            }
            document.body.classList.add('holo-css-fallback');
        } else {
            if (this.app) {
                this.app.view.style.display = 'block';
            }
            document.body.classList.remove('holo-css-fallback');
        }
    },
    
    /**
     * Destroy the system
     */
    destroy() {
        this.clear();
        if (this.app) {
            this.app.destroy(true);
            this.app = null;
        }
        this.isInitialized = false;
    }
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => HoloEffect.init());
} else {
    // Small delay to ensure page is ready
    setTimeout(() => HoloEffect.init(), 100);
}

