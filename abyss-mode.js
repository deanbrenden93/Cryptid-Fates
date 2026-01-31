/**
 * Cryptid Fates - ABYSS Mode
 * Top-down roguelite exploration with lantern-based fog of war
 */

// ==================== CONFIGURATION ====================

window.AbyssConfig = {
    MAP_WIDTH: 4800,
    MAP_HEIGHT: 4800,
    TILE_SIZE: 48,
    PLAYER_SIZE: 40,
    PLAYER_SPEED: 220,
    INITIAL_TIME: 120,
    MIN_LANTERN_RADIUS: 80,
    MAX_LANTERN_RADIUS: 350,
    TIMER_REFRESH_RATES: [0.7, 0.5, 0],
    POI_COUNT_MIN: 15,
    POI_COUNT_MAX: 22,
    POI_MIN_DISTANCE: 300,
    POI_GLOW_RADIUS: 40,
    SHROUD_RESOLUTION: 8,
    SHROUD_ERASE_MULTIPLIER: 1.0,
    CAMERA_SMOOTHING: 0.12,
    DARKNESS_COLOR: 'rgba(5, 5, 15, 0.98)',
    BATTLES_PER_FLOOR: 3,
    FLOORS_TOTAL: 3
};

// ==================== STATE ====================

window.AbyssState = {
    isActive: false,
    isPaused: false,
    currentFloor: 1,
    battlesCompleted: 0,
    timeRemaining: 0,
    maxTime: 0,
    timerPaused: false,
    playerX: 0,
    playerY: 0,
    savedPlayerX: 0,
    savedPlayerY: 0,
    shroudMap: null,
    mapSeed: null,
    pois: [],
    collectedPOIs: [],
    selectedDeck: null,
    deckArchetype: null,
    starterCards: [],
    discoveredCards: [],
    relics: [],
    embers: 0,
    totalPOIsCollected: 0,
    deadCryptidCount: 0,
    maxDeadCryptids: 10,
    
    reset() {
        this.isActive = false;
        this.isPaused = false;
        this.currentFloor = 1;
        this.battlesCompleted = 0;
        this.timeRemaining = AbyssConfig.INITIAL_TIME;
        this.maxTime = AbyssConfig.INITIAL_TIME;
        this.timerPaused = false;
        this.playerX = AbyssConfig.MAP_WIDTH / 2;
        this.playerY = AbyssConfig.MAP_HEIGHT / 2;
        this.shroudMap = null;
        this.pois = [];
        this.collectedPOIs = [];
        this.relics = [];
        this.embers = 0;
        this.totalPOIsCollected = 0;
        this.deadCryptidCount = 0;
    },
    
    getLanternRadius() {
        const pct = this.timeRemaining / this.maxTime;
        const range = AbyssConfig.MAX_LANTERN_RADIUS - AbyssConfig.MIN_LANTERN_RADIUS;
        return AbyssConfig.MIN_LANTERN_RADIUS + (range * pct);
    },
    
    getTimerRefresh() {
        const i = Math.min(this.battlesCompleted, AbyssConfig.TIMER_REFRESH_RATES.length - 1);
        return AbyssConfig.TIMER_REFRESH_RATES[i];
    },
    
    isBossFight() {
        return this.battlesCompleted >= AbyssConfig.BATTLES_PER_FLOOR - 1;
    },
    
    getBattleDeck() {
        return [...this.starterCards, ...this.discoveredCards];
    },
    
    getMaxDeaths() {
        let max = this.maxDeadCryptids;
        for (const relic of this.relics) {
            if (relic.effect?.maxDeathBonus) max += relic.effect.maxDeathBonus;
        }
        return max;
    },
    
    isDefeated() {
        return this.deadCryptidCount >= this.getMaxDeaths();
    }
};

// ==================== SHROUD SYSTEM ====================

window.AbyssShroud = {
    width: 0,
    height: 0,
    data: null,
    canvas: null,
    ctx: null,
    dirty: true, // Only re-render when changed
    
    init() {
        const cfg = AbyssConfig;
        this.width = Math.ceil(cfg.MAP_WIDTH / cfg.SHROUD_RESOLUTION);
        this.height = Math.ceil(cfg.MAP_HEIGHT / cfg.SHROUD_RESOLUTION);
        this.data = [];
        for (let y = 0; y < this.height; y++) {
            this.data[y] = new Array(this.width).fill(false);
        }
        this.canvas = document.createElement('canvas');
        this.canvas.width = cfg.MAP_WIDTH;
        this.canvas.height = cfg.MAP_HEIGHT;
        this.ctx = this.canvas.getContext('2d');
        this.dirty = true;
        
        // Pre-fill with darkness
        this.ctx.fillStyle = cfg.DARKNESS_COLOR;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    },
    
    eraseAt(worldX, worldY, radius) {
        const res = AbyssConfig.SHROUD_RESOLUTION;
        const centerX = Math.floor(worldX / res);
        const centerY = Math.floor(worldY / res);
        const cellRadius = Math.ceil(radius / res);
        
        // Directly erase from canvas - much faster than re-rendering
        this.ctx.globalCompositeOperation = 'destination-out';
        
        // Soft circular erase
        const grad = this.ctx.createRadialGradient(worldX, worldY, 0, worldX, worldY, radius);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(0.7, 'rgba(255,255,255,0.8)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        this.ctx.fillStyle = grad;
        this.ctx.beginPath();
        this.ctx.arc(worldX, worldY, radius, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.globalCompositeOperation = 'source-over';
        
        // Update data for collision/visibility checks
        for (let dy = -cellRadius; dy <= cellRadius; dy++) {
            for (let dx = -cellRadius; dx <= cellRadius; dx++) {
                const sx = centerX + dx;
                const sy = centerY + dy;
                if (sx < 0 || sx >= this.width || sy < 0 || sy >= this.height) continue;
                const dist = Math.sqrt(dx * dx + dy * dy) * res;
                if (dist <= radius * 0.7) this.data[sy][sx] = true;
            }
        }
    },
    
    getCanvas() {
        return this.canvas;
    }
};

// ==================== MAP ====================

window.AbyssMap = {
    terrain: null,
    spawnPoint: null,
    TERRAIN: { FLOOR: 0, WALL: 1 },
    
    init(seed) {
        AbyssState.mapSeed = seed || Math.floor(Math.random() * 1000000);
        this.generateTerrain();
        this.spawnPoint = { x: AbyssConfig.MAP_WIDTH / 2, y: AbyssConfig.MAP_HEIGHT / 2 };
    },
    
    seededRandom(seed) {
        return (Math.sin(seed) * 10000) % 1;
    },
    
    generateTerrain() {
        const cfg = AbyssConfig;
        const tilesX = Math.ceil(cfg.MAP_WIDTH / cfg.TILE_SIZE);
        const tilesY = Math.ceil(cfg.MAP_HEIGHT / cfg.TILE_SIZE);
        let seed = AbyssState.mapSeed;
        
        this.terrain = [];
        for (let y = 0; y < tilesY; y++) {
            this.terrain[y] = [];
            for (let x = 0; x < tilesX; x++) {
                if (x === 0 || x === tilesX - 1 || y === 0 || y === tilesY - 1) {
                    this.terrain[y][x] = this.TERRAIN.WALL;
                } else {
                    seed++;
                    this.terrain[y][x] = Math.abs(this.seededRandom(seed)) < 0.1 ? this.TERRAIN.WALL : this.TERRAIN.FLOOR;
                }
            }
        }
        
        // Carve paths from center
        const cx = Math.floor(tilesX / 2);
        const cy = Math.floor(tilesY / 2);
        for (let x = 2; x < tilesX - 2; x++) {
            this.terrain[cy][x] = this.TERRAIN.FLOOR;
        }
        for (let y = 2; y < tilesY - 2; y++) {
            this.terrain[y][cx] = this.TERRAIN.FLOOR;
        }
    },
    
    isWalkable(worldX, worldY) {
        const cfg = AbyssConfig;
        const tx = Math.floor(worldX / cfg.TILE_SIZE);
        const ty = Math.floor(worldY / cfg.TILE_SIZE);
        if (ty < 0 || ty >= this.terrain.length || tx < 0 || tx >= this.terrain[0].length) return false;
        return this.terrain[ty][tx] === this.TERRAIN.FLOOR;
    },
    
    getTerrainColor(type, x, y) {
        if (type === this.TERRAIN.WALL) {
            // Walls with slight variation
            const v = ((x * 7 + y * 13) % 20) / 100;
            return `rgb(${10 + v * 10}, ${10 + v * 8}, ${20 + v * 10})`;
        } else {
            // Floor with more noticeable variation for texture
            const v = ((x * 11 + y * 17) % 30) / 100;
            const r = Math.floor(26 + v * 15);
            const g = Math.floor(26 + v * 12);
            const b = Math.floor(46 + v * 15);
            return `rgb(${r}, ${g}, ${b})`;
        }
    }
};

// ==================== POI SYSTEM ====================

window.AbyssPOI = {
    TYPES: {
        EMBER_CACHE: { name: 'Ember Cache', sprite: '🔥', instant: true },
        TIME_CRYSTAL: { name: 'Time Crystal', sprite: '💎', instant: true },
        CARD_SHRINE: { name: 'Card Shrine', sprite: '🃏', instant: false },
        REST_SITE: { name: 'Rest Site', sprite: '🏕️', instant: false }
    },
    
    generate() {
        const cfg = AbyssConfig;
        const state = AbyssState;
        state.pois = [];
        let seed = state.mapSeed + 20000;
        const count = cfg.POI_COUNT_MIN + Math.floor(Math.random() * (cfg.POI_COUNT_MAX - cfg.POI_COUNT_MIN + 1));
        const typeKeys = Object.keys(this.TYPES);
        
        for (let i = 0; i < count; i++) {
            let x, y, valid = false, attempts = 0;
            while (!valid && attempts < 50) {
                seed++;
                x = 150 + Math.random() * (cfg.MAP_WIDTH - 300);
                y = 150 + Math.random() * (cfg.MAP_HEIGHT - 300);
                valid = true;
                
                // Check distance from other POIs
                for (const poi of state.pois) {
                    if (Math.hypot(poi.x - x, poi.y - y) < cfg.POI_MIN_DISTANCE) {
                        valid = false;
                        break;
                    }
                }
                
                // Check distance from spawn
                if (Math.hypot(x - cfg.MAP_WIDTH / 2, y - cfg.MAP_HEIGHT / 2) < 200) valid = false;
                if (!AbyssMap.isWalkable(x, y)) valid = false;
                attempts++;
            }
            
            if (valid) {
                const typeKey = typeKeys[i % typeKeys.length];
                const type = this.TYPES[typeKey];
                state.pois.push({
                    id: 'poi_' + i,
                    x, y,
                    typeKey,
                    name: type.name,
                    sprite: type.sprite,
                    instant: type.instant,
                    collected: false,
                    visible: false,
                    inRange: false,
                    revealProgress: 0 // 0 to 1 for smooth fade-in animation
                });
            }
        }
    },
    
    updateVisibility(px, py, radius, dt = 0.016) {
        for (const poi of AbyssState.pois) {
            if (poi.collected) continue;
            const dist = Math.hypot(poi.x - px, poi.y - py);
            poi.visible = dist < radius + AbyssConfig.POI_GLOW_RADIUS;
            poi.inRange = dist < radius;
            
            // Animate reveal progress
            const targetReveal = poi.inRange ? 1 : (poi.visible ? 0.3 : 0);
            const revealSpeed = 3.0; // Speed of fade animation
            if (poi.revealProgress < targetReveal) {
                poi.revealProgress = Math.min(targetReveal, poi.revealProgress + revealSpeed * dt);
            } else if (poi.revealProgress > targetReveal) {
                poi.revealProgress = Math.max(targetReveal, poi.revealProgress - revealSpeed * dt);
            }
        }
    },
    
    checkInteraction(px, py) {
        for (const poi of AbyssState.pois) {
            if (poi.collected) continue;
            if (Math.hypot(poi.x - px, poi.y - py) < 50) return poi;
        }
        return null;
    },
    
    collect(poi) {
        if (poi.collected) return null;
        poi.collected = true;
        AbyssState.totalPOIsCollected++;
        
        // Apply effect based on type
        let msg = 'Collected!';
        if (poi.typeKey === 'EMBER_CACHE') {
            const amt = 15 + Math.floor(Math.random() * 20);
            AbyssState.embers += amt;
            msg = '+' + amt + ' Embers!';
        } else if (poi.typeKey === 'TIME_CRYSTAL') {
            const time = 8 + Math.floor(Math.random() * 7);
            AbyssState.timeRemaining = Math.min(AbyssState.timeRemaining + time, AbyssState.maxTime);
            msg = '+' + time + ' seconds!';
        } else if (poi.typeKey === 'REST_SITE') {
            AbyssState.deadCryptidCount = Math.max(0, AbyssState.deadCryptidCount - 3);
            msg = 'Healed 3 deaths!';
            if (!poi.instant) AbyssState.timerPaused = true;
        } else if (poi.typeKey === 'CARD_SHRINE') {
            msg = 'Card selection coming soon!';
            if (!poi.instant) AbyssState.timerPaused = true;
        }
        
        return { message: msg };
    },
    
    resumeTimer() {
        AbyssState.timerPaused = false;
    }
};

// ==================== PLAYER ====================

window.AbyssPlayer = {
    keys: { up: false, down: false, left: false, right: false },
    touchActive: false,
    touchStartX: 0,
    touchStartY: 0,
    joystickX: 0,
    joystickY: 0,
    
    init() {
        this.handleKeyDown = (e) => {
            if (!AbyssState.isActive || AbyssState.isPaused) return;
            const key = e.key.toLowerCase();
            if (key === 'w' || key === 'arrowup') this.keys.up = true;
            if (key === 's' || key === 'arrowdown') this.keys.down = true;
            if (key === 'a' || key === 'arrowleft') this.keys.left = true;
            if (key === 'd' || key === 'arrowright') this.keys.right = true;
            if (key === 'e' || key === ' ') this.tryInteract();
            if (key === 'escape') AbyssUI.togglePause();
        };
        
        this.handleKeyUp = (e) => {
            const key = e.key.toLowerCase();
            if (key === 'w' || key === 'arrowup') this.keys.up = false;
            if (key === 's' || key === 'arrowdown') this.keys.down = false;
            if (key === 'a' || key === 'arrowleft') this.keys.left = false;
            if (key === 'd' || key === 'arrowright') this.keys.right = false;
        };
        
        document.addEventListener('keydown', this.handleKeyDown);
        document.addEventListener('keyup', this.handleKeyUp);
        
        // Mobile touch controls
        this.initTouchControls();
    },
    
    initTouchControls() {
        // Only show on touch devices
        if (!('ontouchstart' in window)) return;
        
        // Create joystick
        this.joystickContainer = document.createElement('div');
        this.joystickContainer.id = 'abyss-joystick';
        this.joystickContainer.innerHTML = `
            <div class="joystick-base">
                <div class="joystick-thumb"></div>
            </div>
        `;
        
        // Create interact button
        this.interactBtn = document.createElement('div');
        this.interactBtn.id = 'abyss-interact-btn';
        this.interactBtn.innerHTML = '✋';
        
        // Create pause button
        this.pauseBtn = document.createElement('div');
        this.pauseBtn.id = 'abyss-pause-btn';
        this.pauseBtn.innerHTML = '⏸️';
        
        // Add styles
        const style = document.createElement('style');
        style.id = 'abyss-touch-styles';
        style.textContent = `
            #abyss-joystick {
                position: fixed;
                bottom: 30px;
                left: 30px;
                z-index: 16000;
                touch-action: none;
            }
            .joystick-base {
                width: 120px;
                height: 120px;
                background: rgba(232,169,62,0.2);
                border: 3px solid rgba(232,169,62,0.5);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .joystick-thumb {
                width: 50px;
                height: 50px;
                background: radial-gradient(circle, rgba(232,169,62,0.8), rgba(196,92,38,0.6));
                border-radius: 50%;
                transition: transform 0.05s;
                box-shadow: 0 0 15px rgba(232,169,62,0.5);
            }
            #abyss-interact-btn {
                position: fixed;
                bottom: 50px;
                right: 30px;
                width: 80px;
                height: 80px;
                background: rgba(232,169,62,0.3);
                border: 3px solid rgba(232,169,62,0.6);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 32px;
                z-index: 16000;
                touch-action: none;
                user-select: none;
            }
            #abyss-interact-btn:active {
                background: rgba(232,169,62,0.6);
                transform: scale(0.95);
            }
            #abyss-pause-btn {
                position: fixed;
                top: 20px;
                right: 20px;
                width: 50px;
                height: 50px;
                background: rgba(10,10,20,0.8);
                border: 2px solid rgba(232,169,62,0.5);
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
                z-index: 16000;
                touch-action: none;
            }
        `;
        document.head.appendChild(style);
        
        AbyssUI.container.appendChild(this.joystickContainer);
        AbyssUI.container.appendChild(this.interactBtn);
        AbyssUI.container.appendChild(this.pauseBtn);
        
        // Joystick touch handlers
        const joystickBase = this.joystickContainer.querySelector('.joystick-base');
        const joystickThumb = this.joystickContainer.querySelector('.joystick-thumb');
        
        joystickBase.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.touchActive = true;
            const touch = e.touches[0];
            const rect = joystickBase.getBoundingClientRect();
            this.touchStartX = rect.left + rect.width / 2;
            this.touchStartY = rect.top + rect.height / 2;
        });
        
        joystickBase.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (!this.touchActive) return;
            const touch = e.touches[0];
            const dx = touch.clientX - this.touchStartX;
            const dy = touch.clientY - this.touchStartY;
            const maxDist = 35;
            const dist = Math.min(Math.sqrt(dx*dx + dy*dy), maxDist);
            const angle = Math.atan2(dy, dx);
            
            this.joystickX = (dist / maxDist) * Math.cos(angle);
            this.joystickY = (dist / maxDist) * Math.sin(angle);
            
            joystickThumb.style.transform = `translate(${this.joystickX * maxDist}px, ${this.joystickY * maxDist}px)`;
        });
        
        const endTouch = () => {
            this.touchActive = false;
            this.joystickX = 0;
            this.joystickY = 0;
            joystickThumb.style.transform = 'translate(0, 0)';
        };
        
        joystickBase.addEventListener('touchend', endTouch);
        joystickBase.addEventListener('touchcancel', endTouch);
        
        // Interact button
        this.interactBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.tryInteract();
        });
        
        // Pause button
        this.pauseBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            AbyssUI.togglePause();
        });
    },
    
    update(dt) {
        if (!AbyssState.isActive || AbyssState.isPaused) return;
        
        let dx = 0, dy = 0;
        
        // Keyboard input
        if (this.keys.up) dy -= 1;
        if (this.keys.down) dy += 1;
        if (this.keys.left) dx -= 1;
        if (this.keys.right) dx += 1;
        
        // Touch joystick input (overrides keyboard if active)
        if (this.touchActive) {
            dx = this.joystickX;
            dy = this.joystickY;
        }
        
        if (dx !== 0 && dy !== 0 && !this.touchActive) {
            const len = Math.sqrt(2);
            dx /= len;
            dy /= len;
        }
        
        const speed = AbyssConfig.PLAYER_SPEED * dt;
        const newX = AbyssState.playerX + dx * speed;
        const newY = AbyssState.playerY + dy * speed;
        const half = AbyssConfig.PLAYER_SIZE / 2;
        
        // Check all four corners for X movement
        const canMoveX = AbyssMap.isWalkable(newX - half, AbyssState.playerY - half) &&
                         AbyssMap.isWalkable(newX + half, AbyssState.playerY - half) &&
                         AbyssMap.isWalkable(newX - half, AbyssState.playerY + half) &&
                         AbyssMap.isWalkable(newX + half, AbyssState.playerY + half);
        if (canMoveX) {
            AbyssState.playerX = newX;
        }
        
        // Check all four corners for Y movement (using updated X if it changed)
        const canMoveY = AbyssMap.isWalkable(AbyssState.playerX - half, newY - half) &&
                         AbyssMap.isWalkable(AbyssState.playerX + half, newY - half) &&
                         AbyssMap.isWalkable(AbyssState.playerX - half, newY + half) &&
                         AbyssMap.isWalkable(AbyssState.playerX + half, newY + half);
        if (canMoveY) {
            AbyssState.playerY = newY;
        }
        
        AbyssShroud.eraseAt(AbyssState.playerX, AbyssState.playerY, AbyssState.getLanternRadius());
        AbyssPOI.updateVisibility(AbyssState.playerX, AbyssState.playerY, AbyssState.getLanternRadius(), dt);
    },
    
    tryInteract() {
        const poi = AbyssPOI.checkInteraction(AbyssState.playerX, AbyssState.playerY);
        if (poi) {
            const result = AbyssPOI.collect(poi);
            if (result) AbyssUI.showMessage(poi.sprite + ' ' + poi.name, result.message);
        }
    },
    
    cleanup() {
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);
        this.keys = { up: false, down: false, left: false, right: false };
        this.touchActive = false;
        this.joystickX = 0;
        this.joystickY = 0;
        
        // Remove touch controls
        if (this.joystickContainer) this.joystickContainer.remove();
        if (this.interactBtn) this.interactBtn.remove();
        if (this.pauseBtn) this.pauseBtn.remove();
    }
};

// ==================== RENDERER ====================

window.AbyssRenderer = {
    canvas: null,
    ctx: null,
    camera: { x: 0, y: 0 },
    zoom: 1,
    spriteContainer: null,
    playerSprite: null,
    poiSprites: {},
    
    init(container) {
        // Calculate responsive zoom based on screen size
        this.updateZoom();
        
        // Create wrapper for perspective transform
        this.wrapper = document.createElement('div');
        this.wrapper.id = 'abyss-wrapper';
        this.updateWrapperStyle();
        
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'abyss-canvas';
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.ctx = this.canvas.getContext('2d');
        
        this.wrapper.appendChild(this.canvas);
        
        // Create sprite container inside wrapper (shares perspective transform)
        this.spriteContainer = document.createElement('div');
        this.spriteContainer.id = 'abyss-sprites';
        this.spriteContainer.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            transform-style: preserve-3d;
        `;
        this.wrapper.appendChild(this.spriteContainer);
        
        // Create player sprite element
        this.createPlayerSprite();
        
        container.appendChild(this.wrapper);
        
        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.updateZoom();
            this.updateWrapperStyle();
        });
    },
    
    createPlayerSprite() {
        this.playerSprite = document.createElement('div');
        this.playerSprite.id = 'abyss-player-sprite';
        this.playerSprite.style.cssText = `
            position: absolute;
            width: 40px;
            height: 40px;
            transform: rotateX(25deg);
            transform-origin: center center;
            pointer-events: none;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        this.playerSprite.innerHTML = `
            <div style="
                width: 100%;
                height: 100%;
                background: radial-gradient(circle at 30% 30%, #e8c878, #9a7840);
                border-radius: 50%;
                border: 2px solid #5a4020;
                box-shadow: 0 4px 8px rgba(0,0,0,0.4);
                position: relative;
            ">
                <div style="
                    position: absolute;
                    top: 4px;
                    right: 4px;
                    width: 10px;
                    height: 10px;
                    background: radial-gradient(circle at 40% 40%, #fff8e0, #ffdd88);
                    border-radius: 50%;
                    box-shadow: 0 0 8px #ffdd88;
                "></div>
            </div>
        `;
        this.spriteContainer.appendChild(this.playerSprite);
    },
    
    createPOISprite(poi) {
        const sprite = document.createElement('div');
        sprite.className = 'abyss-poi-sprite';
        sprite.dataset.poiId = poi.id;
        sprite.style.cssText = `
            position: absolute;
            transform: rotateX(25deg);
            transform-origin: center center;
            pointer-events: none;
            text-align: center;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        sprite.innerHTML = `
            <div style="font-size: 28px; line-height: 1;">${poi.sprite}</div>
            <div style="
                font-family: Cinzel, serif;
                font-size: 12px;
                color: #e8a93e;
                margin-top: 4px;
                text-shadow: 0 1px 2px rgba(0,0,0,0.8);
                white-space: nowrap;
            ">${poi.name}</div>
        `;
        this.spriteContainer.appendChild(sprite);
        this.poiSprites[poi.id] = sprite;
        return sprite;
    },
    
    updateZoom() {
        // Closer zoom on larger screens, comfortable on mobile
        const screenWidth = window.innerWidth;
        if (screenWidth > 1400) {
            this.zoom = 2.0; // Desktop - much closer
        } else if (screenWidth > 1000) {
            this.zoom = 1.7;
        } else if (screenWidth > 700) {
            this.zoom = 1.4; // Tablet
        } else {
            this.zoom = 1.2; // Mobile - already close
        }
    },
    
    updateWrapperStyle() {
        const baseScale = 1.15 * this.zoom;
        this.wrapper.style.cssText = `
            position: absolute;
            inset: 0;
            transform: perspective(1200px) rotateX(25deg) scale(${baseScale});
            transform-origin: center 60%;
            transform-style: preserve-3d;
            overflow: hidden;
        `;
    },
    
    render() {
        if (!AbyssState.isActive) return;
        
        const ctx = this.ctx;
        const cfg = AbyssConfig;
        const state = AbyssState;
        
        // Update camera
        const targetX = state.playerX - this.canvas.width / 2;
        const targetY = state.playerY - this.canvas.height / 2;
        this.camera.x += (targetX - this.camera.x) * cfg.CAMERA_SMOOTHING;
        this.camera.y += (targetY - this.camera.y) * cfg.CAMERA_SMOOTHING;
        this.camera.x = Math.max(0, Math.min(cfg.MAP_WIDTH - this.canvas.width, this.camera.x));
        this.camera.y = Math.max(0, Math.min(cfg.MAP_HEIGHT - this.canvas.height, this.camera.y));
        
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.save();
        ctx.translate(-this.camera.x, -this.camera.y);
        
        // Draw terrain
        const ts = cfg.TILE_SIZE;
        const startX = Math.max(0, Math.floor(this.camera.x / ts));
        const startY = Math.max(0, Math.floor(this.camera.y / ts));
        const endX = Math.min(AbyssMap.terrain[0].length, Math.ceil((this.camera.x + this.canvas.width) / ts) + 1);
        const endY = Math.min(AbyssMap.terrain.length, Math.ceil((this.camera.y + this.canvas.height) / ts) + 1);
        
        // Batch render floors first, then walls
        ctx.fillStyle = '#1a1a2e';
        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                if (AbyssMap.terrain[y][x] === AbyssMap.TERRAIN.FLOOR) {
                    ctx.fillRect(x * ts, y * ts, ts, ts);
                }
            }
        }
        
        // Walls with slight 3D effect
        ctx.fillStyle = '#0a0a14';
        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                if (AbyssMap.terrain[y][x] === AbyssMap.TERRAIN.WALL) {
                    ctx.fillRect(x * ts, y * ts, ts, ts);
                    // Wall "height" shadow
                    ctx.fillStyle = '#050508';
                    ctx.fillRect(x * ts, y * ts + ts - 4, ts, 4);
                    ctx.fillStyle = '#0a0a14';
                }
            }
        }
        
        // Draw POI glows on canvas (glows can be tilted, sprites will be DOM elements)
        for (const poi of state.pois) {
            if (poi.collected || poi.revealProgress <= 0) continue;
            
            ctx.save();
            ctx.globalAlpha = poi.revealProgress;
            
            // Glow effect on canvas
            const glowAlpha = 0.3 * poi.revealProgress;
            const grad = ctx.createRadialGradient(poi.x, poi.y, 0, poi.x, poi.y, 35);
            grad.addColorStop(0, `rgba(232,169,62,${glowAlpha})`);
            grad.addColorStop(1, 'rgba(232,169,62,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(poi.x, poi.y, 35, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.restore();
        }
        
        // Draw lantern glow (under player)
        const radius = state.getLanternRadius();
        
        // Outer ambient glow
        const outerGlow = ctx.createRadialGradient(state.playerX, state.playerY, 0, state.playerX, state.playerY, radius);
        outerGlow.addColorStop(0, 'rgba(255,180,80,0.25)');
        outerGlow.addColorStop(0.3, 'rgba(255,150,50,0.12)');
        outerGlow.addColorStop(0.7, 'rgba(255,100,30,0.05)');
        outerGlow.addColorStop(1, 'rgba(255,80,20,0)');
        ctx.fillStyle = outerGlow;
        ctx.beginPath();
        ctx.arc(state.playerX, state.playerY, radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner bright glow
        const innerGlow = ctx.createRadialGradient(state.playerX, state.playerY, 0, state.playerX, state.playerY, 60);
        innerGlow.addColorStop(0, 'rgba(255,230,180,0.3)');
        innerGlow.addColorStop(1, 'rgba(255,200,100,0)');
        ctx.fillStyle = innerGlow;
        ctx.beginPath();
        ctx.arc(state.playerX, state.playerY, 60, 0, Math.PI * 2);
        ctx.fill();
        
        // Player shadow on canvas
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.ellipse(state.playerX + 4, state.playerY + cfg.PLAYER_SIZE / 2 + 4, cfg.PLAYER_SIZE / 2, cfg.PLAYER_SIZE / 4, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw shroud on top
        ctx.drawImage(AbyssShroud.getCanvas(), 0, 0);
        
        ctx.restore();
        
        // === POST-PROCESSING EFFECTS (screen space) ===
        
        // Vignette effect for depth
        const vignette = ctx.createRadialGradient(
            this.canvas.width / 2, this.canvas.height / 2, this.canvas.height * 0.3,
            this.canvas.width / 2, this.canvas.height / 2, this.canvas.height * 0.8
        );
        vignette.addColorStop(0, 'rgba(0,0,0,0)');
        vignette.addColorStop(1, 'rgba(0,0,0,0.6)');
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Warm lantern glow overlay in center of screen
        const warmGlow = ctx.createRadialGradient(
            this.canvas.width / 2, this.canvas.height / 2, 0,
            this.canvas.width / 2, this.canvas.height / 2, 200
        );
        warmGlow.addColorStop(0, 'rgba(255,200,100,0.08)');
        warmGlow.addColorStop(1, 'rgba(255,150,50,0)');
        ctx.fillStyle = warmGlow;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Update DOM sprite positions (these are counter-rotated to appear flat)
        this.updateSprites();
    },
    
    updateSprites() {
        const state = AbyssState;
        const cfg = AbyssConfig;
        
        // Update player sprite position
        if (this.playerSprite) {
            const playerScreenX = state.playerX - this.camera.x;
            const playerScreenY = state.playerY - this.camera.y;
            this.playerSprite.style.left = (playerScreenX - 20) + 'px';
            this.playerSprite.style.top = (playerScreenY - 20) + 'px';
        }
        
        // Update POI sprites
        for (const poi of state.pois) {
            // Create sprite if it doesn't exist
            if (!this.poiSprites[poi.id]) {
                this.createPOISprite(poi);
            }
            
            const sprite = this.poiSprites[poi.id];
            if (!sprite) continue;
            
            if (poi.collected) {
                sprite.style.display = 'none';
                continue;
            }
            
            sprite.style.display = 'block';
            
            // Position
            const screenX = poi.x - this.camera.x;
            const screenY = poi.y - this.camera.y;
            sprite.style.left = screenX + 'px';
            sprite.style.top = screenY + 'px';
            sprite.style.transform = `translate(-50%, -50%) rotateX(25deg)`;
            
            // Fade based on revealProgress
            sprite.style.opacity = poi.revealProgress;
        }
    },
    
    cleanup() {
        if (this.wrapper && this.wrapper.parentNode) {
            this.wrapper.parentNode.removeChild(this.wrapper);
        }
        this.poiSprites = {};
        this.playerSprite = null;
        this.spriteContainer = null;
    }
};

// ==================== UI ====================

window.AbyssUI = {
    container: null,
    messageTimeout: null,
    
    init() {
        // Inject styles
        if (!document.getElementById('abyss-styles')) {
            const style = document.createElement('style');
            style.id = 'abyss-styles';
            style.textContent = `
                #abyss-container { position:fixed; inset:0; z-index:15000; background:#000; }
                .abyss-hud { position:absolute; top:20px; left:20px; right:20px; display:flex; justify-content:space-between; pointer-events:none; z-index:100; }
                .abyss-timer-box { display:flex; align-items:center; gap:12px; background:rgba(10,10,20,0.9); padding:12px 20px; border-radius:8px; border:1px solid rgba(232,169,62,0.3); }
                .abyss-timer { font-family:Cinzel,serif; font-size:28px; font-weight:700; color:#e8a93e; }
                .abyss-timer.low { color:#e85a5a; animation:pulse 0.5s infinite; }
                @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
                .abyss-stats { display:flex; flex-direction:column; gap:6px; background:rgba(10,10,20,0.9); padding:12px 16px; border-radius:8px; border:1px solid rgba(232,169,62,0.3); }
                .abyss-stat { font-family:Cinzel,serif; font-size:14px; color:#c4a35a; }
                .abyss-floor { position:absolute; top:20px; left:50%; transform:translateX(-50%); font-family:Cinzel,serif; font-size:16px; color:#e8a93e; background:rgba(10,10,20,0.9); padding:8px 20px; border-radius:8px; border:1px solid rgba(232,169,62,0.3); z-index:100; }
                .abyss-controls { position:absolute; bottom:20px; left:50%; transform:translateX(-50%); font-family:Cinzel,serif; font-size:12px; color:rgba(196,163,90,0.6); background:rgba(10,10,20,0.7); padding:8px 16px; border-radius:4px; z-index:100; }
                .abyss-message { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); background:rgba(15,15,25,0.95); padding:24px 40px; border-radius:12px; border:2px solid #e8a93e; text-align:center; z-index:200; opacity:0; transition:opacity 0.3s; pointer-events:none; }
                .abyss-message.show { opacity:1; }
                .abyss-message-title { font-family:Cinzel,serif; font-size:20px; color:#e8a93e; margin-bottom:8px; }
                .abyss-message-text { font-family:Cinzel,serif; font-size:16px; color:#c4a35a; }
                .abyss-pause { position:absolute; inset:0; background:rgba(0,0,0,0.9); display:flex; flex-direction:column; justify-content:center; align-items:center; z-index:300; opacity:0; pointer-events:none; transition:opacity 0.3s; }
                .abyss-pause.show { opacity:1; pointer-events:auto; }
                .abyss-pause-title { font-family:Cinzel,serif; font-size:48px; color:#e8a93e; margin-bottom:40px; }
                .abyss-btn { font-family:Cinzel,serif; font-size:18px; padding:14px 40px; background:rgba(232,169,62,0.2); border:2px solid #e8a93e; border-radius:8px; color:#e8a93e; cursor:pointer; margin:8px; }
                .abyss-btn:hover { background:rgba(232,169,62,0.4); }
                .abyss-btn.danger { border-color:#e85a5a; color:#e85a5a; }
                .abyss-setup { position:fixed; inset:0; background:linear-gradient(180deg,#050510,#0a0a18); display:flex; flex-direction:column; justify-content:center; align-items:center; z-index:25000; }
                .abyss-setup-title { font-family:Cinzel,serif; font-size:56px; color:#e8a93e; letter-spacing:12px; margin-bottom:8px; }
                .abyss-setup-sub { font-family:Cinzel,serif; font-size:14px; color:#8b7355; letter-spacing:4px; margin-bottom:40px; }
                .abyss-decks { display:grid; grid-template-columns:repeat(2,1fr); gap:16px; margin-bottom:32px; max-width:500px; }
                .abyss-deck { background:rgba(20,20,35,0.8); border:2px solid rgba(232,169,62,0.3); border-radius:12px; padding:20px; cursor:pointer; transition:all 0.3s; }
                .abyss-deck:hover { border-color:rgba(232,169,62,0.6); transform:translateY(-4px); }
                .abyss-deck.selected { border-color:#e8a93e; background:rgba(232,169,62,0.15); }
                .abyss-deck-name { font-family:Cinzel,serif; font-size:16px; color:#e8a93e; margin-bottom:4px; }
                .abyss-deck-desc { font-size:12px; color:#8b7355; }
                .abyss-start { font-family:Cinzel,serif; font-size:20px; padding:16px 60px; background:linear-gradient(135deg,#e8a93e,#c45c26); border:none; border-radius:8px; color:#0a0a14; cursor:pointer; }
                .abyss-start:disabled { opacity:0.5; cursor:not-allowed; }
                .abyss-back { position:absolute; top:24px; left:24px; font-family:Cinzel,serif; font-size:14px; padding:10px 20px; background:transparent; border:1px solid rgba(232,169,62,0.5); border-radius:6px; color:#c4a35a; cursor:pointer; }
            `;
            document.head.appendChild(style);
        }
        
        // Create container
        this.container = document.createElement('div');
        this.container.id = 'abyss-container';
        this.container.style.display = 'none';
        this.container.innerHTML = `
            <div class="abyss-hud">
                <div class="abyss-timer-box">
                    <span style="font-size:28px">🏮</span>
                    <span class="abyss-timer" id="abyss-timer">90</span>
                </div>
                <div class="abyss-stats">
                    <div class="abyss-stat">🔥 <span id="abyss-embers">0</span> Embers</div>
                    <div class="abyss-stat">💀 <span id="abyss-deaths">0</span>/<span id="abyss-maxdeaths">10</span></div>
                    <div class="abyss-stat">📦 <span id="abyss-pois">0</span> POIs</div>
                </div>
            </div>
            <div class="abyss-floor" id="abyss-floor">Floor 1 - Battle 0/3</div>
            <div class="abyss-controls">WASD to move • E to interact • ESC to pause</div>
            <div class="abyss-message" id="abyss-message">
                <div class="abyss-message-title" id="abyss-msg-title"></div>
                <div class="abyss-message-text" id="abyss-msg-text"></div>
            </div>
            <div class="abyss-pause" id="abyss-pause">
                <div class="abyss-pause-title">PAUSED</div>
                <button class="abyss-btn" id="abyss-resume">Resume</button>
                <button class="abyss-btn danger" id="abyss-abandon">Abandon Run</button>
            </div>
        `;
        document.body.appendChild(this.container);
        
        document.getElementById('abyss-resume').onclick = () => this.togglePause();
        document.getElementById('abyss-abandon').onclick = () => AbyssEngine.abandonRun();
    },
    
    show() { this.container.style.display = 'block'; },
    hide() { this.container.style.display = 'none'; },
    
    update() {
        const s = AbyssState;
        const timer = document.getElementById('abyss-timer');
        timer.textContent = Math.ceil(s.timeRemaining);
        timer.className = 'abyss-timer' + (s.timeRemaining <= 15 ? ' low' : '');
        document.getElementById('abyss-embers').textContent = s.embers;
        document.getElementById('abyss-deaths').textContent = s.deadCryptidCount;
        document.getElementById('abyss-maxdeaths').textContent = s.getMaxDeaths();
        document.getElementById('abyss-pois').textContent = s.totalPOIsCollected;
        document.getElementById('abyss-floor').textContent = 'Floor ' + s.currentFloor + ' - Battle ' + s.battlesCompleted + '/' + AbyssConfig.BATTLES_PER_FLOOR;
    },
    
    togglePause() {
        const pause = document.getElementById('abyss-pause');
        const showing = pause.classList.toggle('show');
        AbyssState.isPaused = showing;
    },
    
    showMessage(title, text) {
        const msg = document.getElementById('abyss-message');
        document.getElementById('abyss-msg-title').textContent = title;
        document.getElementById('abyss-msg-text').textContent = text;
        msg.classList.add('show');
        clearTimeout(this.messageTimeout);
        this.messageTimeout = setTimeout(() => {
            msg.classList.remove('show');
            AbyssPOI.resumeTimer();
        }, 2000);
    },
    
    openSetup() {
        const setup = document.createElement('div');
        setup.className = 'abyss-setup';
        setup.id = 'abyss-setup';
        
        const decks = [
            { id: 'city-of-flesh', name: 'City of Flesh', desc: 'Blood magic and sacrifice' },
            { id: 'forests-of-fear', name: 'Forests of Fear', desc: 'Nature and growth' },
            { id: 'abhorrent-armory', name: 'Abhorrent Armory', desc: 'Steel and machinery' },
            { id: 'putrid-swamp', name: 'Putrid Swamp', desc: 'Poison and decay' }
        ];
        
        setup.innerHTML = `
            <button class="abyss-back" id="abyss-back">← Back</button>
            <div class="abyss-setup-title">ABYSS</div>
            <div class="abyss-setup-sub">DESCEND INTO DARKNESS</div>
            <div class="abyss-decks" id="abyss-decks">
                ${decks.map(d => `<div class="abyss-deck" data-deck="${d.id}"><div class="abyss-deck-name">${d.name}</div><div class="abyss-deck-desc">${d.desc}</div></div>`).join('')}
            </div>
            <button class="abyss-start" id="abyss-go" disabled>Begin Descent</button>
        `;
        document.body.appendChild(setup);
        
        let selected = null;
        document.getElementById('abyss-back').onclick = () => {
            setup.remove();
            if (typeof HomeScreen !== 'undefined') HomeScreen.show();
        };
        
        setup.querySelectorAll('.abyss-deck').forEach(el => {
            el.onclick = () => {
                setup.querySelectorAll('.abyss-deck').forEach(e => e.classList.remove('selected'));
                el.classList.add('selected');
                selected = el.dataset.deck;
                document.getElementById('abyss-go').disabled = false;
            };
        });
        
        document.getElementById('abyss-go').onclick = () => {
            if (selected) {
                setup.remove();
                AbyssEngine.startRun(selected);
            }
        };
    },
    
    cleanup() {
        if (this.container) this.container.remove();
    }
};

// ==================== ENGINE ====================

window.AbyssEngine = {
    animFrame: null,
    lastTime: 0,
    
    startRun(deck) {
        console.log('[ABYSS] Starting run with deck:', deck);
        
        AbyssState.reset();
        AbyssState.isActive = true;
        AbyssState.deckArchetype = deck;
        
        AbyssMap.init();
        AbyssShroud.init();
        AbyssPOI.generate();
        
        AbyssState.playerX = AbyssMap.spawnPoint.x;
        AbyssState.playerY = AbyssMap.spawnPoint.y;
        
        AbyssPlayer.init();
        AbyssRenderer.init(AbyssUI.container);
        AbyssUI.show();
        
        this.lastTime = performance.now();
        this.gameLoop();
    },
    
    gameLoop() {
        if (!AbyssState.isActive) return;
        
        const now = performance.now();
        const dt = (now - this.lastTime) / 1000;
        this.lastTime = now;
        
        if (!AbyssState.isPaused && !AbyssState.timerPaused) {
            AbyssState.timeRemaining -= dt;
            if (AbyssState.timeRemaining <= 0) {
                AbyssState.timeRemaining = 0;
                this.triggerBattle();
                return;
            }
        }
        
        AbyssPlayer.update(dt);
        AbyssUI.update();
        AbyssRenderer.render();
        
        this.animFrame = requestAnimationFrame(() => this.gameLoop());
    },
    
    triggerBattle() {
        console.log('[ABYSS] Battle triggered!');
        AbyssState.savedPlayerX = AbyssState.playerX;
        AbyssState.savedPlayerY = AbyssState.playerY;
        AbyssState.isPaused = true;
        cancelAnimationFrame(this.animFrame);
        AbyssUI.hide();
        
        // For now, simulate battle win after 2 seconds
        setTimeout(() => this.onBattleWin(), 2000);
    },
    
    onBattleWin() {
        console.log('[ABYSS] Battle won!');
        AbyssState.battlesCompleted++;
        
        if (AbyssState.battlesCompleted >= AbyssConfig.BATTLES_PER_FLOOR) {
            this.completeFloor();
            return;
        }
        
        const refresh = AbyssState.getTimerRefresh();
        AbyssState.timeRemaining = AbyssState.maxTime * refresh;
        console.log('[ABYSS] Timer refreshed to', Math.round(refresh * 100) + '%');
        
        this.returnToMap();
    },
    
    completeFloor() {
        console.log('[ABYSS] Floor complete!');
        if (AbyssState.currentFloor >= AbyssConfig.FLOORS_TOTAL) {
            this.endRun(true);
            return;
        }
        
        AbyssState.currentFloor++;
        AbyssState.battlesCompleted = 0;
        AbyssState.timeRemaining = AbyssConfig.INITIAL_TIME;
        AbyssState.maxTime = AbyssConfig.INITIAL_TIME;
        
        AbyssMap.init();
        AbyssShroud.init();
        AbyssPOI.generate();
        AbyssState.playerX = AbyssMap.spawnPoint.x;
        AbyssState.playerY = AbyssMap.spawnPoint.y;
        
        this.returnToMap();
    },
    
    returnToMap() {
        AbyssState.playerX = AbyssState.savedPlayerX;
        AbyssState.playerY = AbyssState.savedPlayerY;
        AbyssState.isPaused = false;
        AbyssState.isActive = true;
        AbyssUI.show();
        this.lastTime = performance.now();
        this.gameLoop();
    },
    
    endRun(victory) {
        console.log('[ABYSS] Run ended -', victory ? 'VICTORY' : 'DEFEAT');
        AbyssState.isActive = false;
        cancelAnimationFrame(this.animFrame);
        AbyssPlayer.cleanup();
        AbyssRenderer.cleanup();
        AbyssUI.hide();
        
        alert(victory ? 
            'VICTORY! Floors: ' + AbyssState.currentFloor + ', POIs: ' + AbyssState.totalPOIsCollected :
            'DEFEAT! Floors: ' + (AbyssState.currentFloor - 1) + ', POIs: ' + AbyssState.totalPOIsCollected
        );
        
        if (typeof HomeScreen !== 'undefined') HomeScreen.show();
    },
    
    abandonRun() {
        if (confirm('Abandon run?')) this.endRun(false);
    }
};

// ==================== INIT ====================

AbyssUI.init();
console.log('[ABYSS] Module loaded');
