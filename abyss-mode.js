/**
 * Cryptid Fates - ABYSS Mode
 * A top-down roguelite exploration mode with lantern-based fog of war
 * 
 * Core Mechanics:
 * - Free-roam exploration on a shrouded map
 * - Lantern radius tied to timer (less time = less light = less shroud erasure)
 * - POIs scattered across the map to enhance runs
 * - Forced battles when timer expires
 * - Progressive timer refresh: 70% → 50% → Boss
 */

console.log('[ABYSS] Script loading...');

try {

// ==================== CONFIGURATION ====================

window.AbyssConfig = {
    // Map settings
    MAP_WIDTH: 2400,
    MAP_HEIGHT: 2400,
    TILE_SIZE: 48,
    
    // Player settings
    PLAYER_SIZE: 32,
    PLAYER_SPEED: 180, // pixels per second
    
    // Lantern/Timer settings
    INITIAL_TIME: 90, // seconds
    MIN_LANTERN_RADIUS: 60, // minimum visibility even at 0 time
    MAX_LANTERN_RADIUS: 280, // full visibility at max time
    TIMER_REFRESH_RATES: [0.7, 0.5, 0], // After battles 1, 2, 3
    
    // POI settings
    POI_COUNT_MIN: 8,
    POI_COUNT_MAX: 12,
    POI_MIN_DISTANCE: 200, // minimum distance between POIs
    POI_GLOW_RADIUS: 40, // visible glow when in darkness
    
    // Shroud settings
    SHROUD_RESOLUTION: 8, // pixels per shroud cell (lower = more detail, higher = better performance)
    SHROUD_ERASE_MULTIPLIER: 1.0, // how much of lantern radius erases shroud
    
    // Visual settings
    CAMERA_SMOOTHING: 0.12,
    DARKNESS_COLOR: 'rgba(5, 5, 15, 0.98)',
    AMBIENT_LIGHT: 0.02, // slight visibility even in shroud
    
    // Battle settings
    BATTLES_PER_FLOOR: 3,
    FLOORS_TOTAL: 3
};

// ==================== ABYSS STATE ====================

window.AbyssState = {
    // Run state
    isActive: false,
    isPaused: false,
    currentFloor: 1,
    battlesCompleted: 0,
    
    // Timer
    timeRemaining: 0,
    maxTime: 0,
    timerPaused: false,
    
    // Player position (saved for return after battle)
    playerX: 0,
    playerY: 0,
    savedPlayerX: 0,
    savedPlayerY: 0,
    
    // Map state
    shroudMap: null, // 2D array of revealed tiles
    mapSeed: null,
    
    // POIs
    pois: [],
    collectedPOIs: [],
    
    // Deck/cards
    selectedDeck: null,
    deckArchetype: null,
    starterCards: [],
    discoveredCards: [],
    
    // Relics
    relics: [],
    
    // Resources
    embers: 0,
    
    // Stats
    totalPOIsCollected: 0,
    totalDistanceTraveled: 0,
    floorsCompleted: 0,
    
    // Death tracking (from adventure mode compatibility)
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
        this.savedPlayerX = this.playerX;
        this.savedPlayerY = this.playerY;
        this.shroudMap = null;
        this.mapSeed = null;
        this.pois = [];
        this.collectedPOIs = [];
        this.selectedDeck = null;
        this.deckArchetype = null;
        this.starterCards = [];
        this.discoveredCards = [];
        this.relics = [];
        this.embers = 0;
        this.totalPOIsCollected = 0;
        this.totalDistanceTraveled = 0;
        this.floorsCompleted = 0;
        this.deadCryptidCount = 0;
    },
    
    // Get current lantern radius based on time
    getLanternRadius() {
        const timePercent = this.timeRemaining / this.maxTime;
        const range = AbyssConfig.MAX_LANTERN_RADIUS - AbyssConfig.MIN_LANTERN_RADIUS;
        return AbyssConfig.MIN_LANTERN_RADIUS + (range * timePercent);
    },
    
    // Get timer refresh rate for current battle
    getTimerRefresh() {
        const index = Math.min(this.battlesCompleted, AbyssConfig.TIMER_REFRESH_RATES.length - 1);
        return AbyssConfig.TIMER_REFRESH_RATES[index];
    },
    
    // Check if it's time for boss fight
    isBossFight() {
        return this.battlesCompleted >= AbyssConfig.BATTLES_PER_FLOOR - 1;
    },
    
    // Get battle deck
    getBattleDeck() {
        return [...this.starterCards, ...this.discoveredCards];
    },
    
    // Add deaths from battle
    addDeaths(count) {
        this.deadCryptidCount += count;
        return this.deadCryptidCount >= this.maxDeadCryptids;
    },
    
    // Get max deaths (with relic bonuses)
    getMaxDeaths() {
        let max = this.maxDeadCryptids;
        for (const relic of this.relics) {
            if (relic.effect?.maxDeathBonus) {
                max += relic.effect.maxDeathBonus;
            }
        }
        return max;
    },
    
    isDefeated() {
        return this.deadCryptidCount >= this.getMaxDeaths();
    }
};

// ==================== SHROUD/FOG SYSTEM ====================

window.AbyssShroud = {
    width: 0,
    height: 0,
    data: null,
    canvas: null,
    ctx: null,
    
    init() {
        const cfg = AbyssConfig;
        this.width = Math.ceil(cfg.MAP_WIDTH / cfg.SHROUD_RESOLUTION);
        this.height = Math.ceil(cfg.MAP_HEIGHT / cfg.SHROUD_RESOLUTION);
        
        // Initialize shroud as fully dark (false = not revealed)
        this.data = new Array(this.height);
        for (let y = 0; y < this.height; y++) {
            this.data[y] = new Array(this.width).fill(false);
        }
        
        // Create offscreen canvas for shroud rendering
        this.canvas = document.createElement('canvas');
        this.canvas.width = cfg.MAP_WIDTH;
        this.canvas.height = cfg.MAP_HEIGHT;
        this.ctx = this.canvas.getContext('2d');
        
        console.log(`[ABYSS Shroud] Initialized ${this.width}x${this.height} shroud map`);
    },
    
    // Erase shroud in a radius around a point
    eraseAt(worldX, worldY, radius) {
        const cfg = AbyssConfig;
        const res = cfg.SHROUD_RESOLUTION;
        const eraseRadius = radius * cfg.SHROUD_ERASE_MULTIPLIER;
        
        // Convert to shroud coordinates
        const centerX = Math.floor(worldX / res);
        const centerY = Math.floor(worldY / res);
        const cellRadius = Math.ceil(eraseRadius / res);
        
        // Erase in a circle
        for (let dy = -cellRadius; dy <= cellRadius; dy++) {
            for (let dx = -cellRadius; dx <= cellRadius; dx++) {
                const sx = centerX + dx;
                const sy = centerY + dy;
                
                // Bounds check
                if (sx < 0 || sx >= this.width || sy < 0 || sy >= this.height) continue;
                
                // Distance check (circular reveal)
                const dist = Math.sqrt(dx * dx + dy * dy) * res;
                if (dist <= eraseRadius) {
                    this.data[sy][sx] = true;
                }
            }
        }
    },
    
    // Check if a point is revealed
    isRevealed(worldX, worldY) {
        const res = AbyssConfig.SHROUD_RESOLUTION;
        const sx = Math.floor(worldX / res);
        const sy = Math.floor(worldY / res);
        
        if (sx < 0 || sx >= this.width || sy < 0 || sy >= this.height) return false;
        return this.data[sy][sx];
    },
    
    // Render shroud to offscreen canvas (for compositing)
    render() {
        const cfg = AbyssConfig;
        const res = cfg.SHROUD_RESOLUTION;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = cfg.DARKNESS_COLOR;
        
        // Fill entire canvas with darkness
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Cut out revealed areas
        this.ctx.globalCompositeOperation = 'destination-out';
        
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.data[y][x]) {
                    // This cell is revealed - cut it out
                    this.ctx.fillStyle = 'rgba(255, 255, 255, 1)';
                    this.ctx.fillRect(x * res, y * res, res, res);
                }
            }
        }
        
        this.ctx.globalCompositeOperation = 'source-over';
        
        return this.canvas;
    },
    
    // Save state for persistence
    serialize() {
        // Compress shroud data to string
        let bits = '';
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                bits += this.data[y][x] ? '1' : '0';
            }
        }
        return { width: this.width, height: this.height, bits };
    },
    
    // Load state
    deserialize(saved) {
        if (!saved || saved.width !== this.width || saved.height !== this.height) return false;
        
        let i = 0;
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                this.data[y][x] = saved.bits[i++] === '1';
            }
        }
        return true;
    }
};

// ==================== MAP GENERATION ====================

window.AbyssMap = {
    terrain: null,
    obstacles: [],
    spawnPoint: null,
    
    // Terrain types
    TERRAIN: {
        FLOOR: 0,
        WALL: 1,
        WATER: 2,
        PIT: 3
    },
    
    init(seed = null) {
        AbyssState.mapSeed = seed || Math.floor(Math.random() * 1000000);
        this.generateTerrain();
        this.generateObstacles();
        this.setSpawnPoint();
        
        console.log(`[ABYSS Map] Generated floor ${AbyssState.currentFloor} with seed ${AbyssState.mapSeed}`);
    },
    
    // Seeded random number generator
    seededRandom(seed) {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    },
    
    generateTerrain() {
        const cfg = AbyssConfig;
        const tilesX = Math.ceil(cfg.MAP_WIDTH / cfg.TILE_SIZE);
        const tilesY = Math.ceil(cfg.MAP_HEIGHT / cfg.TILE_SIZE);
        
        this.terrain = new Array(tilesY);
        let seed = AbyssState.mapSeed;
        
        for (let y = 0; y < tilesY; y++) {
            this.terrain[y] = new Array(tilesX);
            for (let x = 0; x < tilesX; x++) {
                // Border walls
                if (x === 0 || x === tilesX - 1 || y === 0 || y === tilesY - 1) {
                    this.terrain[y][x] = this.TERRAIN.WALL;
                    continue;
                }
                
                // Use noise-like generation for natural caves
                seed++;
                const noise = this.seededRandom(seed + x * 100 + y);
                
                // Floor themes vary by floor number
                const wallChance = 0.08 + (AbyssState.currentFloor * 0.02);
                const pitChance = 0.02 * AbyssState.currentFloor;
                
                if (noise < wallChance) {
                    this.terrain[y][x] = this.TERRAIN.WALL;
                } else if (noise < wallChance + pitChance) {
                    this.terrain[y][x] = this.TERRAIN.PIT;
                } else {
                    this.terrain[y][x] = this.TERRAIN.FLOOR;
                }
            }
        }
        
        // Ensure paths exist - carve corridors
        this.carveCorridors();
    },
    
    carveCorridors() {
        const cfg = AbyssConfig;
        const tilesX = Math.ceil(cfg.MAP_WIDTH / cfg.TILE_SIZE);
        const tilesY = Math.ceil(cfg.MAP_HEIGHT / cfg.TILE_SIZE);
        const centerX = Math.floor(tilesX / 2);
        const centerY = Math.floor(tilesY / 2);
        
        // Carve cross-shaped corridors from center
        for (let x = 2; x < tilesX - 2; x++) {
            this.terrain[centerY][x] = this.TERRAIN.FLOOR;
            this.terrain[centerY - 1][x] = this.TERRAIN.FLOOR;
            this.terrain[centerY + 1][x] = this.TERRAIN.FLOOR;
        }
        
        for (let y = 2; y < tilesY - 2; y++) {
            this.terrain[y][centerX] = this.TERRAIN.FLOOR;
            this.terrain[y][centerX - 1] = this.TERRAIN.FLOOR;
            this.terrain[y][centerX + 1] = this.TERRAIN.FLOOR;
        }
        
        // Carve some random corridors
        let seed = AbyssState.mapSeed + 5000;
        for (let i = 0; i < 8; i++) {
            seed++;
            const startX = Math.floor(this.seededRandom(seed) * (tilesX - 4)) + 2;
            seed++;
            const startY = Math.floor(this.seededRandom(seed) * (tilesY - 4)) + 2;
            seed++;
            const length = Math.floor(this.seededRandom(seed) * 15) + 5;
            seed++;
            const horizontal = this.seededRandom(seed) > 0.5;
            
            for (let j = 0; j < length; j++) {
                const tx = horizontal ? Math.min(startX + j, tilesX - 2) : startX;
                const ty = horizontal ? startY : Math.min(startY + j, tilesY - 2);
                if (tx > 0 && tx < tilesX - 1 && ty > 0 && ty < tilesY - 1) {
                    this.terrain[ty][tx] = this.TERRAIN.FLOOR;
                }
            }
        }
    },
    
    generateObstacles() {
        // Obstacles are additional interactive elements (rocks, debris, etc.)
        this.obstacles = [];
        
        let seed = AbyssState.mapSeed + 10000;
        const count = 15 + AbyssState.currentFloor * 5;
        
        for (let i = 0; i < count; i++) {
            seed++;
            const x = this.seededRandom(seed) * (AbyssConfig.MAP_WIDTH - 200) + 100;
            seed++;
            const y = this.seededRandom(seed) * (AbyssConfig.MAP_HEIGHT - 200) + 100;
            seed++;
            const type = this.seededRandom(seed) > 0.7 ? 'rock' : 'debris';
            
            this.obstacles.push({
                x, y,
                width: 32 + Math.floor(this.seededRandom(seed + 1) * 24),
                height: 32 + Math.floor(this.seededRandom(seed + 2) * 24),
                type
            });
        }
    },
    
    setSpawnPoint() {
        // Player spawns in center
        this.spawnPoint = {
            x: AbyssConfig.MAP_WIDTH / 2,
            y: AbyssConfig.MAP_HEIGHT / 2
        };
    },
    
    // Check if a world position is walkable
    isWalkable(worldX, worldY) {
        const cfg = AbyssConfig;
        const tileX = Math.floor(worldX / cfg.TILE_SIZE);
        const tileY = Math.floor(worldY / cfg.TILE_SIZE);
        
        if (tileX < 0 || tileX >= this.terrain[0].length || 
            tileY < 0 || tileY >= this.terrain.length) {
            return false;
        }
        
        const tile = this.terrain[tileY][tileX];
        return tile === this.TERRAIN.FLOOR;
    },
    
    // Get terrain color for rendering
    getTerrainColor(type) {
        switch (type) {
            case this.TERRAIN.FLOOR:
                // Vary floor color by floor number
                const floorColors = ['#1a1a2e', '#1e1e28', '#22181c'];
                return floorColors[AbyssState.currentFloor - 1] || '#1a1a2e';
            case this.TERRAIN.WALL:
                return '#0a0a14';
            case this.TERRAIN.WATER:
                return '#0a1628';
            case this.TERRAIN.PIT:
                return '#000005';
            default:
                return '#1a1a2e';
        }
    }
};

// ==================== POI SYSTEM ====================

window.AbyssPOI = {
    // POI definitions
    TYPES: {
        // Instant pickups (don't pause timer)
        EMBER_CACHE: {
            id: 'ember_cache',
            name: 'Ember Cache',
            description: 'A small pile of glowing embers',
            sprite: '🔥',
            instant: true,
            effect: (state) => {
                const amount = 15 + Math.floor(Math.random() * 20);
                state.embers += amount;
                return { message: `Found ${amount} Embers!`, type: 'resource' };
            }
        },
        HEALTH_VIAL: {
            id: 'health_vial',
            name: 'Health Vial',
            description: 'Restores some vitality',
            sprite: '🧪',
            instant: true,
            effect: (state) => {
                const heal = Math.min(2, state.deadCryptidCount);
                state.deadCryptidCount -= heal;
                return { message: heal > 0 ? `Healed ${heal} deaths!` : 'Already at full health', type: 'heal' };
            }
        },
        TIME_CRYSTAL: {
            id: 'time_crystal',
            name: 'Time Crystal',
            description: 'A shard of crystallized time',
            sprite: '💎',
            instant: true,
            effect: (state) => {
                const bonus = 8 + Math.floor(Math.random() * 7);
                state.timeRemaining = Math.min(state.timeRemaining + bonus, state.maxTime);
                return { message: `+${bonus} seconds!`, type: 'time' };
            }
        },
        
        // Interactive POIs (pause timer while interacting)
        CARD_SHRINE: {
            id: 'card_shrine',
            name: 'Card Shrine',
            description: 'Choose a new card for your deck',
            sprite: '🃏',
            instant: false,
            interactive: true,
            effect: (state, choice) => {
                // Will open card selection UI
                return { action: 'card_choice', type: 'card' };
            }
        },
        RELIC_ALTAR: {
            id: 'relic_altar',
            name: 'Relic Altar',
            description: 'A powerful artifact awaits',
            sprite: '⚱️',
            instant: false,
            interactive: true,
            effect: (state, choice) => {
                return { action: 'relic_choice', type: 'relic' };
            }
        },
        REST_SITE: {
            id: 'rest_site',
            name: 'Rest Site',
            description: 'A moment of respite',
            sprite: '🏕️',
            instant: false,
            interactive: true,
            effect: (state) => {
                const heal = 3;
                state.deadCryptidCount = Math.max(0, state.deadCryptidCount - heal);
                return { message: `Rested and healed ${heal} deaths`, type: 'heal', action: 'rest' };
            }
        },
        MERCHANT: {
            id: 'merchant',
            name: 'Wandering Merchant',
            description: 'Trade embers for goods',
            sprite: '🧙',
            instant: false,
            interactive: true,
            effect: (state) => {
                return { action: 'shop', type: 'shop' };
            }
        },
        MYSTERY_CHEST: {
            id: 'mystery_chest',
            name: 'Mystery Chest',
            description: 'Unknown contents...',
            sprite: '📦',
            instant: false,
            interactive: true,
            effect: (state) => {
                // Random reward
                const roll = Math.random();
                if (roll < 0.4) {
                    const embers = 25 + Math.floor(Math.random() * 35);
                    state.embers += embers;
                    return { message: `Found ${embers} Embers!`, type: 'resource' };
                } else if (roll < 0.7) {
                    return { action: 'card_choice', type: 'card', message: 'A card emerges!' };
                } else {
                    const time = 12 + Math.floor(Math.random() * 8);
                    state.timeRemaining = Math.min(state.timeRemaining + time, state.maxTime);
                    return { message: `+${time} seconds!`, type: 'time' };
                }
            }
        }
    },
    
    // Generate POIs for current floor
    generate() {
        const cfg = AbyssConfig;
        const state = AbyssState;
        state.pois = [];
        
        let seed = state.mapSeed + 20000;
        const count = cfg.POI_COUNT_MIN + Math.floor(
            this.seededRandom(seed++) * (cfg.POI_COUNT_MAX - cfg.POI_COUNT_MIN + 1)
        );
        
        // Get all POI types
        const poiTypes = Object.values(this.TYPES);
        
        // Ensure at least one card shrine and one rest site per floor
        const guaranteed = ['CARD_SHRINE', 'REST_SITE'];
        
        for (let i = 0; i < count; i++) {
            let attempts = 0;
            let validPosition = false;
            let x, y;
            
            while (!validPosition && attempts < 50) {
                seed++;
                x = this.seededRandom(seed) * (cfg.MAP_WIDTH - 300) + 150;
                seed++;
                y = this.seededRandom(seed) * (cfg.MAP_HEIGHT - 300) + 150;
                
                // Check minimum distance from other POIs
                validPosition = true;
                for (const poi of state.pois) {
                    const dist = Math.sqrt(Math.pow(poi.x - x, 2) + Math.pow(poi.y - y, 2));
                    if (dist < cfg.POI_MIN_DISTANCE) {
                        validPosition = false;
                        break;
                    }
                }
                
                // Check if position is walkable
                if (validPosition && !AbyssMap.isWalkable(x, y)) {
                    validPosition = false;
                }
                
                // Check distance from spawn
                const spawnDist = Math.sqrt(
                    Math.pow(x - cfg.MAP_WIDTH / 2, 2) + 
                    Math.pow(y - cfg.MAP_HEIGHT / 2, 2)
                );
                if (spawnDist < 200) {
                    validPosition = false;
                }
                
                attempts++;
            }
            
            if (validPosition) {
                // Pick POI type
                let typeKey;
                if (i < guaranteed.length) {
                    typeKey = guaranteed[i];
                } else {
                    seed++;
                    const typeIndex = Math.floor(this.seededRandom(seed) * poiTypes.length);
                    typeKey = Object.keys(this.TYPES)[typeIndex];
                }
                
                const type = this.TYPES[typeKey];
                
                state.pois.push({
                    id: `poi_${i}_${Date.now()}`,
                    x,
                    y,
                    type: typeKey,
                    ...type,
                    collected: false,
                    visible: false // Becomes true when in lantern range
                });
            }
        }
        
        console.log(`[ABYSS POI] Generated ${state.pois.length} POIs`);
    },
    
    seededRandom(seed) {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    },
    
    // Check if player is near a POI
    checkInteraction(playerX, playerY) {
        const interactRadius = 50;
        
        for (const poi of AbyssState.pois) {
            if (poi.collected) continue;
            
            const dist = Math.sqrt(
                Math.pow(poi.x - playerX, 2) + 
                Math.pow(poi.y - playerY, 2)
            );
            
            if (dist < interactRadius) {
                return poi;
            }
        }
        
        return null;
    },
    
    // Collect/interact with a POI
    interact(poi) {
        if (poi.collected) return null;
        
        poi.collected = true;
        AbyssState.totalPOIsCollected++;
        AbyssState.collectedPOIs.push(poi.id);
        
        // Pause timer for non-instant POIs
        if (!poi.instant) {
            AbyssState.timerPaused = true;
        }
        
        // Execute effect
        const result = poi.effect(AbyssState);
        
        console.log(`[ABYSS POI] Collected ${poi.name}:`, result);
        
        return result;
    },
    
    // Resume timer after interactive POI
    resumeTimer() {
        AbyssState.timerPaused = false;
    },
    
    // Update POI visibility based on lantern
    updateVisibility(playerX, playerY, lanternRadius) {
        for (const poi of AbyssState.pois) {
            if (poi.collected) continue;
            
            const dist = Math.sqrt(
                Math.pow(poi.x - playerX, 2) + 
                Math.pow(poi.y - playerY, 2)
            );
            
            // POIs become visible when in lantern range
            // Or show a faint glow at the edge of darkness
            poi.visible = dist < lanternRadius + AbyssConfig.POI_GLOW_RADIUS;
            poi.inRange = dist < lanternRadius;
        }
    }
};

// ==================== PLAYER CONTROLLER ====================

window.AbyssPlayer = {
    // Input state
    keys: {
        up: false,
        down: false,
        left: false,
        right: false,
        interact: false
    },
    
    // Movement
    velocityX: 0,
    velocityY: 0,
    
    init() {
        this.bindControls();
        console.log('[ABYSS Player] Controls initialized');
    },
    
    bindControls() {
        // Remove any existing listeners
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);
        
        this.handleKeyDown = (e) => {
            if (!AbyssState.isActive || AbyssState.isPaused) return;
            
            switch (e.key.toLowerCase()) {
                case 'w':
                case 'arrowup':
                    this.keys.up = true;
                    break;
                case 's':
                case 'arrowdown':
                    this.keys.down = true;
                    break;
                case 'a':
                case 'arrowleft':
                    this.keys.left = true;
                    break;
                case 'd':
                case 'arrowright':
                    this.keys.right = true;
                    break;
                case 'e':
                case ' ':
                    this.keys.interact = true;
                    this.tryInteract();
                    break;
                case 'escape':
                    AbyssUI.togglePauseMenu();
                    break;
            }
        };
        
        this.handleKeyUp = (e) => {
            switch (e.key.toLowerCase()) {
                case 'w':
                case 'arrowup':
                    this.keys.up = false;
                    break;
                case 's':
                case 'arrowdown':
                    this.keys.down = false;
                    break;
                case 'a':
                case 'arrowleft':
                    this.keys.left = false;
                    break;
                case 'd':
                case 'arrowright':
                    this.keys.right = false;
                    break;
                case 'e':
                case ' ':
                    this.keys.interact = false;
                    break;
            }
        };
        
        document.addEventListener('keydown', this.handleKeyDown);
        document.addEventListener('keyup', this.handleKeyUp);
    },
    
    update(deltaTime) {
        if (!AbyssState.isActive || AbyssState.isPaused) return;
        
        const cfg = AbyssConfig;
        const state = AbyssState;
        
        // Calculate movement direction
        let dx = 0;
        let dy = 0;
        
        if (this.keys.up) dy -= 1;
        if (this.keys.down) dy += 1;
        if (this.keys.left) dx -= 1;
        if (this.keys.right) dx += 1;
        
        // Normalize diagonal movement
        if (dx !== 0 && dy !== 0) {
            const len = Math.sqrt(dx * dx + dy * dy);
            dx /= len;
            dy /= len;
        }
        
        // Apply speed
        const speed = cfg.PLAYER_SPEED * deltaTime;
        const newX = state.playerX + dx * speed;
        const newY = state.playerY + dy * speed;
        
        // Collision detection with terrain
        const halfSize = cfg.PLAYER_SIZE / 2;
        
        // Check corners for collision
        const canMoveX = this.canMoveTo(newX, state.playerY, halfSize);
        const canMoveY = this.canMoveTo(state.playerX, newY, halfSize);
        
        if (canMoveX) {
            const oldX = state.playerX;
            state.playerX = newX;
            state.totalDistanceTraveled += Math.abs(newX - oldX);
        }
        if (canMoveY) {
            const oldY = state.playerY;
            state.playerY = newY;
            state.totalDistanceTraveled += Math.abs(newY - oldY);
        }
        
        // Erase shroud at current position
        const lanternRadius = state.getLanternRadius();
        AbyssShroud.eraseAt(state.playerX, state.playerY, lanternRadius);
        
        // Update POI visibility
        AbyssPOI.updateVisibility(state.playerX, state.playerY, lanternRadius);
    },
    
    canMoveTo(x, y, halfSize) {
        // Check all four corners
        return AbyssMap.isWalkable(x - halfSize, y - halfSize) &&
               AbyssMap.isWalkable(x + halfSize, y - halfSize) &&
               AbyssMap.isWalkable(x - halfSize, y + halfSize) &&
               AbyssMap.isWalkable(x + halfSize, y + halfSize);
    },
    
    tryInteract() {
        const state = AbyssState;
        const nearbyPOI = AbyssPOI.checkInteraction(state.playerX, state.playerY);
        
        if (nearbyPOI) {
            const result = AbyssPOI.interact(nearbyPOI);
            if (result) {
                AbyssUI.showPOIResult(nearbyPOI, result);
            }
        }
    },
    
    cleanup() {
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);
        this.keys = { up: false, down: false, left: false, right: false, interact: false };
    }
};

// ==================== RENDERER ====================

window.AbyssRenderer = {
    canvas: null,
    ctx: null,
    camera: { x: 0, y: 0 },
    targetCamera: { x: 0, y: 0 },
    
    init(container) {
        // Create canvas
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'abyss-canvas';
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.ctx = this.canvas.getContext('2d');
        
        container.appendChild(this.canvas);
        
        // Handle resize
        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
        });
        
        console.log('[ABYSS Renderer] Canvas initialized');
    },
    
    render() {
        if (!AbyssState.isActive) return;
        
        const ctx = this.ctx;
        const cfg = AbyssConfig;
        const state = AbyssState;
        
        // Update camera (smooth follow)
        this.targetCamera.x = state.playerX - this.canvas.width / 2;
        this.targetCamera.y = state.playerY - this.canvas.height / 2;
        
        this.camera.x += (this.targetCamera.x - this.camera.x) * cfg.CAMERA_SMOOTHING;
        this.camera.y += (this.targetCamera.y - this.camera.y) * cfg.CAMERA_SMOOTHING;
        
        // Clamp camera to map bounds
        this.camera.x = Math.max(0, Math.min(cfg.MAP_WIDTH - this.canvas.width, this.camera.x));
        this.camera.y = Math.max(0, Math.min(cfg.MAP_HEIGHT - this.canvas.height, this.camera.y));
        
        // Clear canvas
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Save context for camera transform
        ctx.save();
        ctx.translate(-this.camera.x, -this.camera.y);
        
        // Draw terrain
        this.drawTerrain();
        
        // Draw obstacles
        this.drawObstacles();
        
        // Draw POIs
        this.drawPOIs();
        
        // Draw player
        this.drawPlayer();
        
        // Draw lantern light effect
        this.drawLanternLight();
        
        // Draw shroud (fog of war)
        this.drawShroud();
        
        // Restore context
        ctx.restore();
    },
    
    drawTerrain() {
        const ctx = this.ctx;
        const cfg = AbyssConfig;
        const tileSize = cfg.TILE_SIZE;
        
        // Calculate visible tile range
        const startX = Math.max(0, Math.floor(this.camera.x / tileSize));
        const startY = Math.max(0, Math.floor(this.camera.y / tileSize));
        const endX = Math.min(AbyssMap.terrain[0].length, Math.ceil((this.camera.x + this.canvas.width) / tileSize) + 1);
        const endY = Math.min(AbyssMap.terrain.length, Math.ceil((this.camera.y + this.canvas.height) / tileSize) + 1);
        
        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                const tile = AbyssMap.terrain[y][x];
                ctx.fillStyle = AbyssMap.getTerrainColor(tile);
                ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
                
                // Add subtle grid lines
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
                ctx.strokeRect(x * tileSize, y * tileSize, tileSize, tileSize);
            }
        }
    },
    
    drawObstacles() {
        const ctx = this.ctx;
        
        for (const obs of AbyssMap.obstacles) {
            // Only draw if visible
            if (!this.isOnScreen(obs.x, obs.y, Math.max(obs.width, obs.height))) continue;
            
            ctx.fillStyle = obs.type === 'rock' ? '#2a2a3a' : '#1a1a28';
            ctx.fillRect(obs.x - obs.width / 2, obs.y - obs.height / 2, obs.width, obs.height);
        }
    },
    
    drawPOIs() {
        const ctx = this.ctx;
        const state = AbyssState;
        
        for (const poi of state.pois) {
            if (poi.collected) continue;
            if (!this.isOnScreen(poi.x, poi.y, 60)) continue;
            
            // Draw glow effect if visible but not in full lantern range
            if (poi.visible && !poi.inRange) {
                const gradient = ctx.createRadialGradient(poi.x, poi.y, 0, poi.x, poi.y, 40);
                gradient.addColorStop(0, 'rgba(232, 169, 62, 0.3)');
                gradient.addColorStop(1, 'rgba(232, 169, 62, 0)');
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(poi.x, poi.y, 40, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // Draw POI sprite if in lantern range
            if (poi.inRange) {
                // Background glow
                const gradient = ctx.createRadialGradient(poi.x, poi.y, 0, poi.x, poi.y, 35);
                gradient.addColorStop(0, 'rgba(232, 169, 62, 0.4)');
                gradient.addColorStop(0.5, 'rgba(232, 169, 62, 0.1)');
                gradient.addColorStop(1, 'rgba(232, 169, 62, 0)');
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(poi.x, poi.y, 35, 0, Math.PI * 2);
                ctx.fill();
                
                // POI icon
                ctx.font = '28px serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(poi.sprite, poi.x, poi.y);
                
                // Name label
                ctx.font = '12px "Cinzel", serif';
                ctx.fillStyle = '#e8a93e';
                ctx.fillText(poi.name, poi.x, poi.y + 28);
            }
        }
    },
    
    drawPlayer() {
        const ctx = this.ctx;
        const state = AbyssState;
        const cfg = AbyssConfig;
        
        const x = state.playerX;
        const y = state.playerY;
        const size = cfg.PLAYER_SIZE;
        
        // Player shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.beginPath();
        ctx.ellipse(x, y + size / 2, size / 2, size / 4, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Player body (simple for now - can add sprite later)
        ctx.fillStyle = '#c4a35a';
        ctx.beginPath();
        ctx.arc(x, y, size / 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Player outline
        ctx.strokeStyle = '#8b7355';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Lantern glow on player
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
        gradient.addColorStop(0, 'rgba(255, 200, 100, 0.3)');
        gradient.addColorStop(1, 'rgba(255, 200, 100, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    },
    
    drawLanternLight() {
        const ctx = this.ctx;
        const state = AbyssState;
        const radius = state.getLanternRadius();
        
        // Create lantern light gradient
        const gradient = ctx.createRadialGradient(
            state.playerX, state.playerY, radius * 0.1,
            state.playerX, state.playerY, radius
        );
        
        // Warm lantern color
        gradient.addColorStop(0, 'rgba(255, 220, 150, 0.15)');
        gradient.addColorStop(0.5, 'rgba(255, 180, 100, 0.08)');
        gradient.addColorStop(1, 'rgba(255, 150, 50, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(state.playerX, state.playerY, radius, 0, Math.PI * 2);
        ctx.fill();
    },
    
    drawShroud() {
        const ctx = this.ctx;
        const state = AbyssState;
        
        // Get the rendered shroud
        const shroudCanvas = AbyssShroud.render();
        
        // Draw shroud layer
        ctx.drawImage(shroudCanvas, 0, 0);
        
        // Add current lantern "cutting" effect
        // This shows the player's current visibility even if shroud isn't erased yet
        const radius = state.getLanternRadius();
        
        ctx.globalCompositeOperation = 'destination-out';
        const gradient = ctx.createRadialGradient(
            state.playerX, state.playerY, radius * 0.8,
            state.playerX, state.playerY, radius
        );
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(state.playerX, state.playerY, radius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.globalCompositeOperation = 'source-over';
    },
    
    isOnScreen(x, y, buffer = 0) {
        return x >= this.camera.x - buffer &&
               x <= this.camera.x + this.canvas.width + buffer &&
               y >= this.camera.y - buffer &&
               y <= this.camera.y + this.canvas.height + buffer;
    },
    
    cleanup() {
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
        this.canvas = null;
        this.ctx = null;
    }
};

// ==================== UI SYSTEM ====================

window.AbyssUI = {
    container: null,
    timerDisplay: null,
    pauseMenu: null,
    poiPopup: null,
    
    init() {
        this.createContainer();
        this.createHUD();
        this.createPauseMenu();
        this.createPOIPopup();
        this.injectStyles();
        
        console.log('[ABYSS UI] Initialized');
    },
    
    injectStyles() {
        if (document.getElementById('abyss-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'abyss-styles';
        style.textContent = `
            #abyss-container {
                position: fixed;
                inset: 0;
                z-index: 15000;
                background: #000;
                overflow: hidden;
            }
            
            #abyss-canvas {
                display: block;
            }
            
            .abyss-hud {
                position: absolute;
                top: 20px;
                left: 20px;
                right: 20px;
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                pointer-events: none;
                z-index: 100;
            }
            
            .abyss-timer-container {
                display: flex;
                align-items: center;
                gap: 15px;
                background: rgba(10, 10, 20, 0.85);
                padding: 12px 20px;
                border-radius: 8px;
                border: 1px solid rgba(232, 169, 62, 0.3);
            }
            
            .abyss-lantern-icon {
                font-size: 32px;
                animation: lanternFlicker 2s infinite ease-in-out;
            }
            
            @keyframes lanternFlicker {
                0%, 100% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.8; transform: scale(0.95); }
            }
            
            .abyss-timer {
                font-family: 'Cinzel', serif;
                font-size: 28px;
                font-weight: 700;
                color: #e8a93e;
                text-shadow: 0 0 10px rgba(232, 169, 62, 0.5);
                min-width: 80px;
            }
            
            .abyss-timer.low {
                color: #e85a5a;
                animation: timerPulse 0.5s infinite;
            }
            
            @keyframes timerPulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.6; }
            }
            
            .abyss-stats {
                display: flex;
                flex-direction: column;
                gap: 8px;
                background: rgba(10, 10, 20, 0.85);
                padding: 12px 16px;
                border-radius: 8px;
                border: 1px solid rgba(232, 169, 62, 0.3);
            }
            
            .abyss-stat {
                font-family: 'Cinzel', serif;
                font-size: 14px;
                color: #c4a35a;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .abyss-floor-indicator {
                position: absolute;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                font-family: 'Cinzel', serif;
                font-size: 18px;
                color: #e8a93e;
                background: rgba(10, 10, 20, 0.85);
                padding: 8px 24px;
                border-radius: 8px;
                border: 1px solid rgba(232, 169, 62, 0.3);
                z-index: 100;
            }
            
            .abyss-controls-hint {
                position: absolute;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                font-family: 'Cinzel', serif;
                font-size: 12px;
                color: rgba(196, 163, 90, 0.6);
                background: rgba(10, 10, 20, 0.7);
                padding: 8px 16px;
                border-radius: 4px;
                z-index: 100;
            }
            
            .abyss-pause-menu {
                position: absolute;
                inset: 0;
                background: rgba(0, 0, 0, 0.9);
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                z-index: 200;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.3s ease;
            }
            
            .abyss-pause-menu.active {
                opacity: 1;
                pointer-events: auto;
            }
            
            .abyss-pause-title {
                font-family: 'Cinzel', serif;
                font-size: 48px;
                color: #e8a93e;
                margin-bottom: 40px;
                text-shadow: 0 0 20px rgba(232, 169, 62, 0.5);
            }
            
            .abyss-pause-buttons {
                display: flex;
                flex-direction: column;
                gap: 16px;
            }
            
            .abyss-btn {
                font-family: 'Cinzel', serif;
                font-size: 18px;
                font-weight: 600;
                padding: 14px 40px;
                background: linear-gradient(135deg, rgba(232, 169, 62, 0.2), rgba(196, 92, 38, 0.2));
                border: 2px solid #e8a93e;
                border-radius: 8px;
                color: #e8a93e;
                cursor: pointer;
                transition: all 0.3s ease;
                min-width: 200px;
            }
            
            .abyss-btn:hover {
                background: linear-gradient(135deg, rgba(232, 169, 62, 0.4), rgba(196, 92, 38, 0.4));
                transform: translateY(-2px);
                box-shadow: 0 4px 20px rgba(232, 169, 62, 0.3);
            }
            
            .abyss-btn.danger {
                border-color: #e85a5a;
                color: #e85a5a;
            }
            
            .abyss-btn.danger:hover {
                background: rgba(232, 90, 90, 0.2);
            }
            
            .abyss-poi-popup {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(15, 15, 25, 0.95);
                padding: 30px 40px;
                border-radius: 12px;
                border: 2px solid #e8a93e;
                text-align: center;
                z-index: 150;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.3s ease, transform 0.3s ease;
            }
            
            .abyss-poi-popup.active {
                opacity: 1;
                pointer-events: auto;
            }
            
            .abyss-poi-icon {
                font-size: 48px;
                margin-bottom: 16px;
            }
            
            .abyss-poi-name {
                font-family: 'Cinzel', serif;
                font-size: 24px;
                color: #e8a93e;
                margin-bottom: 8px;
            }
            
            .abyss-poi-message {
                font-family: 'Cinzel', serif;
                font-size: 16px;
                color: #c4a35a;
                margin-bottom: 20px;
            }
            
            /* Setup screen styles */
            .abyss-setup {
                position: fixed;
                inset: 0;
                background: 
                    radial-gradient(ellipse at 50% 30%, rgba(232, 169, 62, 0.1) 0%, transparent 50%),
                    linear-gradient(180deg, #050510 0%, #0a0a18 50%, #0f0a15 100%);
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                z-index: 25000;
                padding: 24px;
            }
            
            .abyss-setup-content {
                max-width: 600px;
                width: 100%;
                text-align: center;
            }
            
            .abyss-setup-title {
                font-family: 'Cinzel', serif;
                font-size: 56px;
                font-weight: 700;
                color: #e8a93e;
                margin-bottom: 8px;
                text-shadow: 0 0 40px rgba(232, 169, 62, 0.5);
                letter-spacing: 12px;
            }
            
            .abyss-setup-subtitle {
                font-family: 'Cinzel', serif;
                font-size: 14px;
                color: #8b7355;
                letter-spacing: 4px;
                text-transform: uppercase;
                margin-bottom: 40px;
            }
            
            .abyss-deck-select {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 16px;
                margin-bottom: 32px;
            }
            
            .abyss-deck-option {
                background: rgba(20, 20, 35, 0.8);
                border: 2px solid rgba(232, 169, 62, 0.3);
                border-radius: 12px;
                padding: 20px;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            
            .abyss-deck-option:hover {
                border-color: rgba(232, 169, 62, 0.6);
                transform: translateY(-4px);
            }
            
            .abyss-deck-option.selected {
                border-color: #e8a93e;
                background: rgba(232, 169, 62, 0.15);
            }
            
            .abyss-deck-name {
                font-family: 'Cinzel', serif;
                font-size: 18px;
                color: #e8a93e;
                margin-bottom: 4px;
            }
            
            .abyss-deck-desc {
                font-size: 12px;
                color: #8b7355;
            }
            
            .abyss-start-btn {
                font-family: 'Cinzel', serif;
                font-size: 20px;
                font-weight: 700;
                padding: 16px 60px;
                background: linear-gradient(135deg, #e8a93e, #c45c26);
                border: none;
                border-radius: 8px;
                color: #0a0a14;
                cursor: pointer;
                transition: all 0.3s ease;
                text-transform: uppercase;
                letter-spacing: 4px;
            }
            
            .abyss-start-btn:hover:not(:disabled) {
                transform: translateY(-2px);
                box-shadow: 0 8px 30px rgba(232, 169, 62, 0.4);
            }
            
            .abyss-start-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            .abyss-back-btn {
                position: absolute;
                top: 24px;
                left: 24px;
                font-family: 'Cinzel', serif;
                font-size: 14px;
                padding: 10px 20px;
                background: transparent;
                border: 1px solid rgba(232, 169, 62, 0.5);
                border-radius: 6px;
                color: #c4a35a;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            
            .abyss-back-btn:hover {
                border-color: #e8a93e;
                color: #e8a93e;
            }
        `;
        document.head.appendChild(style);
    },
    
    createContainer() {
        this.container = document.createElement('div');
        this.container.id = 'abyss-container';
        this.container.classList.add('hidden');
        document.body.appendChild(this.container);
    },
    
    createHUD() {
        const hud = document.createElement('div');
        hud.className = 'abyss-hud';
        hud.innerHTML = `
            <div class="abyss-timer-container">
                <div class="abyss-lantern-icon">🏮</div>
                <div class="abyss-timer" id="abyss-timer">90</div>
            </div>
            <div class="abyss-stats">
                <div class="abyss-stat">🔥 <span id="abyss-embers">0</span> Embers</div>
                <div class="abyss-stat">💀 <span id="abyss-deaths">0</span>/<span id="abyss-max-deaths">10</span> Deaths</div>
                <div class="abyss-stat">📦 <span id="abyss-pois">0</span> POIs Found</div>
            </div>
        `;
        
        const floorIndicator = document.createElement('div');
        floorIndicator.className = 'abyss-floor-indicator';
        floorIndicator.id = 'abyss-floor-indicator';
        floorIndicator.textContent = 'Floor 1 - Battle 0/3';
        
        const controlsHint = document.createElement('div');
        controlsHint.className = 'abyss-controls-hint';
        controlsHint.textContent = 'WASD / Arrow Keys to move • E / Space to interact • ESC to pause';
        
        this.container.appendChild(hud);
        this.container.appendChild(floorIndicator);
        this.container.appendChild(controlsHint);
        
        this.timerDisplay = document.getElementById('abyss-timer');
    },
    
    createPauseMenu() {
        this.pauseMenu = document.createElement('div');
        this.pauseMenu.className = 'abyss-pause-menu';
        this.pauseMenu.innerHTML = `
            <div class="abyss-pause-title">PAUSED</div>
            <div class="abyss-pause-buttons">
                <button class="abyss-btn" id="abyss-resume">Resume</button>
                <button class="abyss-btn danger" id="abyss-abandon">Abandon Run</button>
            </div>
        `;
        this.container.appendChild(this.pauseMenu);
        
        document.getElementById('abyss-resume').addEventListener('click', () => this.togglePauseMenu());
        document.getElementById('abyss-abandon').addEventListener('click', () => AbyssEngine.abandonRun());
    },
    
    createPOIPopup() {
        this.poiPopup = document.createElement('div');
        this.poiPopup.className = 'abyss-poi-popup';
        this.poiPopup.innerHTML = `
            <div class="abyss-poi-icon" id="poi-popup-icon">🔥</div>
            <div class="abyss-poi-name" id="poi-popup-name">POI Name</div>
            <div class="abyss-poi-message" id="poi-popup-message">Result message</div>
            <button class="abyss-btn" id="poi-popup-close">Continue</button>
        `;
        this.container.appendChild(this.poiPopup);
        
        document.getElementById('poi-popup-close').addEventListener('click', () => this.closePOIPopup());
    },
    
    show() {
        this.container.classList.remove('hidden');
    },
    
    hide() {
        this.container.classList.add('hidden');
    },
    
    update() {
        const state = AbyssState;
        
        // Update timer
        const timeInt = Math.ceil(state.timeRemaining);
        this.timerDisplay.textContent = timeInt;
        this.timerDisplay.classList.toggle('low', timeInt <= 15);
        
        // Update stats
        document.getElementById('abyss-embers').textContent = state.embers;
        document.getElementById('abyss-deaths').textContent = state.deadCryptidCount;
        document.getElementById('abyss-max-deaths').textContent = state.getMaxDeaths();
        document.getElementById('abyss-pois').textContent = state.totalPOIsCollected;
        document.getElementById('abyss-floor-indicator').textContent = 
            `Floor ${state.currentFloor} - Battle ${state.battlesCompleted}/${AbyssConfig.BATTLES_PER_FLOOR}`;
    },
    
    togglePauseMenu() {
        const isPaused = this.pauseMenu.classList.toggle('active');
        AbyssState.isPaused = isPaused;
    },
    
    showPOIResult(poi, result) {
        document.getElementById('poi-popup-icon').textContent = poi.sprite;
        document.getElementById('poi-popup-name').textContent = poi.name;
        document.getElementById('poi-popup-message').textContent = result.message || 'Collected!';
        
        this.poiPopup.classList.add('active');
        AbyssState.isPaused = true;
        
        // Handle special actions
        if (result.action === 'card_choice') {
            // TODO: Open card selection UI
            document.getElementById('poi-popup-message').textContent = 'Card selection coming soon!';
        } else if (result.action === 'relic_choice') {
            // TODO: Open relic selection UI
            document.getElementById('poi-popup-message').textContent = 'Relic selection coming soon!';
        } else if (result.action === 'shop') {
            // TODO: Open shop UI
            document.getElementById('poi-popup-message').textContent = 'Shop coming soon!';
        }
    },
    
    closePOIPopup() {
        this.poiPopup.classList.remove('active');
        AbyssState.isPaused = false;
        AbyssPOI.resumeTimer();
    },
    
    // Setup screen
    openSetup() {
        const setup = document.createElement('div');
        setup.className = 'abyss-setup';
        setup.id = 'abyss-setup';
        
        // Get available decks
        const decks = this.getAvailableDecks();
        
        setup.innerHTML = `
            <button class="abyss-back-btn" id="abyss-back">← Back</button>
            <div class="abyss-setup-content">
                <div class="abyss-setup-title">ABYSS</div>
                <div class="abyss-setup-subtitle">Descend into darkness</div>
                
                <div class="abyss-deck-select" id="abyss-deck-select">
                    ${decks.map(deck => `
                        <div class="abyss-deck-option" data-deck="${deck.id}">
                            <div class="abyss-deck-name">${deck.name}</div>
                            <div class="abyss-deck-desc">${deck.description}</div>
                        </div>
                    `).join('')}
                </div>
                
                <button class="abyss-start-btn" id="abyss-start" disabled>Begin Descent</button>
            </div>
        `;
        
        document.body.appendChild(setup);
        
        // Bind events
        let selectedDeck = null;
        
        document.getElementById('abyss-back').addEventListener('click', () => {
            setup.remove();
            if (typeof HomeScreen !== 'undefined') {
                HomeScreen.show();
            }
        });
        
        document.querySelectorAll('.abyss-deck-option').forEach(option => {
            option.addEventListener('click', () => {
                document.querySelectorAll('.abyss-deck-option').forEach(o => o.classList.remove('selected'));
                option.classList.add('selected');
                selectedDeck = option.dataset.deck;
                document.getElementById('abyss-start').disabled = false;
            });
        });
        
        document.getElementById('abyss-start').addEventListener('click', () => {
            if (selectedDeck) {
                setup.remove();
                AbyssEngine.startRun(selectedDeck);
            }
        });
    },
    
    getAvailableDecks() {
        // Check for deck archetypes from the game
        const decks = [];
        
        if (typeof CityOfFlesh !== 'undefined') {
            decks.push({
                id: 'city-of-flesh',
                name: 'City of Flesh',
                description: 'Blood magic and sacrifice'
            });
        }
        
        if (typeof ForestsOfFear !== 'undefined') {
            decks.push({
                id: 'forests-of-fear',
                name: 'Forests of Fear',
                description: 'Nature and growth'
            });
        }
        
        if (typeof AbhorrentArmory !== 'undefined') {
            decks.push({
                id: 'abhorrent-armory',
                name: 'Abhorrent Armory',
                description: 'Steel and machinery'
            });
        }
        
        if (typeof PutridSwamp !== 'undefined') {
            decks.push({
                id: 'putrid-swamp',
                name: 'Putrid Swamp',
                description: 'Poison and decay'
            });
        }
        
        // Fallback if no decks found
        if (decks.length === 0) {
            decks.push(
                { id: 'starter', name: 'Starter Deck', description: 'A balanced beginning' }
            );
        }
        
        return decks;
    },
    
    cleanup() {
        if (this.container) {
            this.container.remove();
            this.container = null;
        }
    }
};

// ==================== MAIN ENGINE ====================

window.AbyssEngine = {
    animationFrame: null,
    lastTime: 0,
    
    init() {
        console.log('[ABYSS Engine] Initializing...');
        AbyssUI.init();
        AbyssPlayer.init();
    },
    
    startRun(deckArchetype) {
        console.log(`[ABYSS Engine] Starting run with deck: ${deckArchetype}`);
        
        // Reset state
        AbyssState.reset();
        AbyssState.isActive = true;
        AbyssState.deckArchetype = deckArchetype;
        AbyssState.timeRemaining = AbyssConfig.INITIAL_TIME;
        AbyssState.maxTime = AbyssConfig.INITIAL_TIME;
        
        // Load starter deck
        this.loadStarterDeck(deckArchetype);
        
        // Initialize map
        AbyssMap.init();
        
        // Initialize shroud
        AbyssShroud.init();
        
        // Generate POIs
        AbyssPOI.generate();
        
        // Set player position
        AbyssState.playerX = AbyssMap.spawnPoint.x;
        AbyssState.playerY = AbyssMap.spawnPoint.y;
        
        // Initialize renderer
        AbyssRenderer.init(AbyssUI.container);
        
        // Show UI
        AbyssUI.show();
        
        // Start game loop
        this.lastTime = performance.now();
        this.gameLoop();
        
        console.log('[ABYSS Engine] Run started!');
    },
    
    loadStarterDeck(archetype) {
        // Get starter cards based on archetype
        // This integrates with the existing card systems
        const state = AbyssState;
        
        // Try to get cards from the card registry
        if (typeof window.CardRegistry !== 'undefined') {
            const archetypeCards = window.CardRegistry.getByArchetype?.(archetype) || [];
            // Take first 15 cards as starter
            state.starterCards = archetypeCards.slice(0, 15).map(c => ({ ...c }));
        }
        
        // Fallback: create basic starter deck
        if (state.starterCards.length === 0) {
            console.warn('[ABYSS] No cards found for archetype, using placeholder deck');
            state.starterCards = [
                { id: 'starter_1', name: 'Basic Cryptid', type: 'cryptid', cost: 1 },
                { id: 'starter_2', name: 'Basic Cryptid', type: 'cryptid', cost: 1 },
                { id: 'starter_3', name: 'Basic Spell', type: 'spell', cost: 1 },
            ];
        }
        
        console.log(`[ABYSS] Loaded ${state.starterCards.length} starter cards`);
    },
    
    gameLoop() {
        if (!AbyssState.isActive) return;
        
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastTime) / 1000; // Convert to seconds
        this.lastTime = currentTime;
        
        // Update timer (if not paused)
        if (!AbyssState.isPaused && !AbyssState.timerPaused) {
            AbyssState.timeRemaining -= deltaTime;
            
            // Check for timer expiry
            if (AbyssState.timeRemaining <= 0) {
                AbyssState.timeRemaining = 0;
                this.triggerBattle();
                return;
            }
        }
        
        // Update player
        AbyssPlayer.update(deltaTime);
        
        // Update UI
        AbyssUI.update();
        
        // Render
        AbyssRenderer.render();
        
        // Continue loop
        this.animationFrame = requestAnimationFrame(() => this.gameLoop());
    },
    
    triggerBattle() {
        console.log('[ABYSS] Timer expired - triggering battle!');
        
        // Save current position
        AbyssState.savedPlayerX = AbyssState.playerX;
        AbyssState.savedPlayerY = AbyssState.playerY;
        AbyssState.isPaused = true;
        
        // Cancel animation frame
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        
        // Hide ABYSS UI
        AbyssUI.hide();
        
        // Trigger battle transition
        this.startBattle();
    },
    
    startBattle() {
        console.log(`[ABYSS] Starting battle ${AbyssState.battlesCompleted + 1}`);
        
        // Check if this is the boss fight
        if (AbyssState.isBossFight()) {
            console.log('[ABYSS] This is the BOSS FIGHT!');
            // TODO: Start boss battle with special enemy
        }
        
        // Create battle configuration
        const battleConfig = {
            isAbyssBattle: true,
            floor: AbyssState.currentFloor,
            battleNumber: AbyssState.battlesCompleted + 1,
            isBoss: AbyssState.isBossFight(),
            playerDeck: AbyssState.getBattleDeck(),
            onWin: () => this.onBattleWin(),
            onLose: () => this.onBattleLose()
        };
        
        // Try to start battle through game-core
        if (typeof GameCore !== 'undefined' && GameCore.startBattle) {
            GameCore.startBattle(battleConfig);
        } else if (typeof window.startBattle === 'function') {
            window.startBattle(battleConfig);
        } else {
            // Fallback: simulate battle win for testing
            console.warn('[ABYSS] No battle system found, simulating win...');
            setTimeout(() => this.onBattleWin(), 2000);
        }
    },
    
    onBattleWin() {
        console.log('[ABYSS] Battle won!');
        
        AbyssState.battlesCompleted++;
        
        // Check if we beat the boss
        if (AbyssState.battlesCompleted >= AbyssConfig.BATTLES_PER_FLOOR) {
            this.completeFloor();
            return;
        }
        
        // Calculate timer refresh
        const refreshRate = AbyssState.getTimerRefresh();
        AbyssState.timeRemaining = AbyssState.maxTime * refreshRate;
        
        console.log(`[ABYSS] Timer refreshed to ${refreshRate * 100}%: ${AbyssState.timeRemaining.toFixed(1)}s`);
        
        // Return to map
        this.returnToMap();
    },
    
    onBattleLose() {
        console.log('[ABYSS] Battle lost!');
        
        // Add deaths
        const deaths = 3; // Base deaths from losing
        const isDefeated = AbyssState.addDeaths(deaths);
        
        if (isDefeated) {
            this.endRun(false);
        } else {
            // Return to map with penalty
            AbyssState.timeRemaining = AbyssState.maxTime * 0.3; // Only 30% time after loss
            this.returnToMap();
        }
    },
    
    returnToMap() {
        console.log('[ABYSS] Returning to map...');
        
        // Restore player position
        AbyssState.playerX = AbyssState.savedPlayerX;
        AbyssState.playerY = AbyssState.savedPlayerY;
        AbyssState.isPaused = false;
        AbyssState.isActive = true;
        
        // Show UI
        AbyssUI.show();
        
        // Resume game loop
        this.lastTime = performance.now();
        this.gameLoop();
    },
    
    completeFloor() {
        console.log(`[ABYSS] Floor ${AbyssState.currentFloor} complete!`);
        
        AbyssState.floorsCompleted++;
        
        // Check if all floors complete
        if (AbyssState.currentFloor >= AbyssConfig.FLOORS_TOTAL) {
            this.endRun(true);
            return;
        }
        
        // Advance to next floor
        AbyssState.currentFloor++;
        AbyssState.battlesCompleted = 0;
        AbyssState.timeRemaining = AbyssConfig.INITIAL_TIME;
        AbyssState.maxTime = AbyssConfig.INITIAL_TIME;
        
        // Generate new floor
        AbyssMap.init();
        AbyssShroud.init();
        AbyssPOI.generate();
        
        // Reset player to spawn
        AbyssState.playerX = AbyssMap.spawnPoint.x;
        AbyssState.playerY = AbyssMap.spawnPoint.y;
        
        // Show transition message
        console.log(`[ABYSS] Now entering Floor ${AbyssState.currentFloor}`);
        
        // Return to map
        this.returnToMap();
    },
    
    endRun(victory) {
        console.log(`[ABYSS] Run ended - ${victory ? 'VICTORY!' : 'DEFEAT'}`);
        
        AbyssState.isActive = false;
        
        // Cancel animation frame
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        
        // Cleanup
        AbyssPlayer.cleanup();
        AbyssRenderer.cleanup();
        AbyssUI.hide();
        
        // Show results
        // TODO: Create proper results screen
        alert(victory ? 
            `VICTORY! You escaped the Abyss!\nFloors: ${AbyssState.floorsCompleted}\nPOIs: ${AbyssState.totalPOIsCollected}\nEmbers: ${AbyssState.embers}` :
            `DEFEAT! The darkness consumed you.\nFloors: ${AbyssState.floorsCompleted}\nPOIs: ${AbyssState.totalPOIsCollected}`
        );
        
        // Return to home screen
        if (typeof HomeScreen !== 'undefined') {
            HomeScreen.show();
        }
    },
    
    abandonRun() {
        if (confirm('Abandon this run? All progress will be lost.')) {
            this.endRun(false);
        }
    }
};

// ==================== AUTO-INITIALIZE ====================

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => AbyssEngine.init());
} else {
    AbyssEngine.init();
}

console.log('[ABYSS] Script loaded successfully');

} catch (error) {
    console.error('[ABYSS] Critical error during load:', error);
}
