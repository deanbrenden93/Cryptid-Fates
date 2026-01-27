console.log('[Adventure Mode] ISOMETRIC ENGINE - Script starting...');
/**
 * Cryptid Fates - Adventure Mode (Isometric Room-Based Exploration)
 * A survival horror themed exploration between card battles
 * 
 * Features:
 * - Isometric free-roaming room exploration
 * - Atmospheric lighting with generous visibility
 * - Themed dialogue system
 * - Procedural floor map generation
 * - Persistent death counter across battles
 * - Relic system with passive effects
 */

try {

// ==================== ADVENTURE STATE ====================

window.AdventureState = {
    // Run state
    isActive: false,
    currentFloor: 1,
    currentRoom: 0,
    totalRoomsCleared: 0,
    phase: 'inactive', // inactive, awakening, deck_select, relic_select, exploring, battle, event
    
    // Player state
    deadCryptidCount: 0,
    maxDeadCryptids: 10,
    selectedDeck: null,
    deckArchetype: null,
    starterCards: [],
    discoveredCards: [],
    
    // Relics
    relics: [],
    
    // Resources
    embers: 0,
    xpEarned: 0,
    
    // Floor map (procedural generation)
    floorMap: null,
    currentRoomId: 'start',
    visitedRooms: new Set(),
    revealedRooms: new Set(),
    
    // Stats
    battlesWon: 0,
    battlesLost: 0,
    itemsFound: 0,
    floorsCompleted: 0,
    
    // Reset for new run
    reset() {
        this.isActive = false;
        this.currentFloor = 1;
        this.currentRoom = 0;
        this.totalRoomsCleared = 0;
        this.phase = 'inactive';
        this.deadCryptidCount = 0;
        this.selectedDeck = null;
        this.deckArchetype = null;
        this.starterCards = [];
        this.discoveredCards = [];
        this.relics = [];
        this.embers = 0;
        this.xpEarned = 0;
        this.floorMap = null;
        this.currentRoomId = 'start';
        this.visitedRooms = new Set();
        this.revealedRooms = new Set();
        this.battlesWon = 0;
        this.battlesLost = 0;
        this.itemsFound = 0;
        this.floorsCompleted = 0;
    },
    
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
    },
    
    addDeaths(count) {
        this.deadCryptidCount += count;
        console.log(`[Adventure] Deaths: ${this.deadCryptidCount}/${this.getMaxDeaths()}`);
        return this.isDefeated();
    },
    
    healDeaths(count) {
        this.deadCryptidCount = Math.max(0, this.deadCryptidCount - count);
    },
    
    getBattleDeck() {
        return [...this.starterCards, ...this.discoveredCards];
    }
};

// ==================== RELIC SYSTEM ====================

window.RelicRegistry = {
    relics: {
        'iron_shovel': {
            id: 'iron_shovel',
            name: 'Iron Shovel',
            description: 'Dig up hidden treasures. 3 uses per floor.',
            sprite: '⛏️',
            rarity: 'starter',
            uses: 3,
            maxUses: 3,
            effect: { canDig: true }
        },
        'bone_charm': {
            id: 'bone_charm',
            name: 'Bone Charm',
            description: '+2 max deaths allowed before defeat.',
            sprite: '💀',
            rarity: 'starter',
            effect: { maxDeathBonus: 2 }
        },
        'ember_pouch': {
            id: 'ember_pouch',
            name: 'Ember Pouch',
            description: '+25% embers from all sources.',
            sprite: '👝',
            rarity: 'starter',
            effect: { emberBonus: 0.25 }
        },
        'crystal_lens': {
            id: 'crystal_lens',
            name: 'Crystal Lens',
            description: 'See room contents before entering.',
            sprite: '🔮',
            rarity: 'starter',
            effect: { roomVision: true }
        },
        'lucky_coin': {
            id: 'lucky_coin',
            name: 'Lucky Coin',
            description: 'Start each battle with +1 Pyre.',
            sprite: '🪙',
            rarity: 'starter',
            effect: { startingPyre: 1 }
        },
        'healers_kit': {
            id: 'healers_kit',
            name: "Healer's Kit",
            description: 'Rest sites heal 2 extra deaths.',
            sprite: '🩹',
            rarity: 'starter',
            effect: { restBonus: 2 }
        },
        'scouts_map': {
            id: 'scouts_map',
            name: "Scout's Map",
            description: 'Reveal all rooms on current floor.',
            sprite: '🗺️',
            rarity: 'starter',
            effect: { revealMap: true }
        },
        'bloodstone': {
            id: 'bloodstone',
            name: 'Bloodstone',
            description: 'First cryptid death each battle is negated.',
            sprite: '💎',
            rarity: 'starter',
            effect: { deathShield: 1 }
        },
        'travelers_boots': {
            id: 'travelers_boots',
            name: "Traveler's Boots",
            description: 'Move 50% faster in rooms.',
            sprite: '👢',
            rarity: 'starter',
            effect: { speedBonus: 0.5 }
        },
        'grimoire_page': {
            id: 'grimoire_page',
            name: 'Grimoire Page',
            description: 'Draw 1 extra card at battle start.',
            sprite: '📜',
            rarity: 'starter',
            effect: { extraDraw: 1 }
        }
    },
    
    getStarterRelics() {
        return Object.values(this.relics).filter(r => r.rarity === 'starter');
    },
    
    getRandomStarterRelics(count = 3) {
        const starters = this.getStarterRelics();
        const shuffled = [...starters].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, count);
    },
    
    getRelic(id) {
        return this.relics[id] ? { ...this.relics[id] } : null;
    }
};

// ==================== STARTER DECK DEFINITIONS ====================

window.StarterDecks = {
    'city-of-flesh': {
        id: 'city-of-flesh',
        name: 'City of Flesh',
        description: 'Vampires, gargoyles, and nightmares from the urban shadows.',
        icon: '🏚️',
        theme: 'Blood & Steel • Status Effects',
        starterCards: [
            'rooftopGargoyle', 'vampireInitiate', 'sewerAlligator',
            'hellpup', 'hellpup', 'myling', 'myling', 'vampireBat',
            'pyre', 'pyre', 'pyre', 'freshKill',
            'crossroads', 'wakingNightmare', 'antiVampiricBlade'
        ],
        discoveryPool: {
            cryptids: ['libraryGargoyle', 'vampireLord', 'kuchisakeOnna', 'hellhound', 
                      'mothman', 'bogeyman', 'theFlayer', 'decayRat'],
            kindling: ['gremlin', 'boggart'],
            spells: ['bloodCovenant', 'turnToStone', 'faceOff', 'rockSlide'],
            pyres: ['ratKing', 'nightfall']
        }
    },
    'forests-of-fear': {
        id: 'forests-of-fear',
        name: 'Forests of Fear',
        description: 'Wendigos, werewolves, and primal horrors of the wild.',
        icon: '🌲',
        theme: 'Nature & Blood • Evolution',
        starterCards: [
            'newbornWendigo', 'adolescentBigfoot', 'cursedHybrid',
            'stormhawk', 'stormhawk', 'deerWoman', 'deerWoman', 'newbornWendigo',
            'burialGround', 'burialGround', 'cursedWoods', 'animalPelts',
            'terrify', 'fullMoon', 'dauntingPresence'
        ],
        discoveryPool: {
            cryptids: ['matureWendigo', 'primalWendigo', 'thunderbird', 'adultBigfoot',
                      'werewolf', 'lycanthrope', 'snipe', 'rogueRazorback', 'notDeer',
                      'jerseyDevil', 'babaYaga', 'skinwalker'],
            kindling: [],
            spells: ['hunt', 'rockSlide', 'sproutWings', 'weaponizedTree', 'insatiableHunger'],
            pyres: []
        }
    },
    'diabolical-desert': {
        id: 'diabolical-desert',
        name: 'Diabolical Desert',
        description: 'Ancient horrors from scorching sands. (Coming Soon)',
        icon: '🏜️',
        theme: 'Coming Soon',
        starterCards: [],
        discoveryPool: { cryptids: [], kindling: [], spells: [], pyres: [] },
        locked: true
    }
};

// ==================== FLOOR MAP GENERATOR ====================

window.FloorMapGenerator = {
    // Room types and their properties
    roomTypes: {
        start: { name: 'Awakening Chamber', color: '#4a3a6a', icon: '🌀' },
        battle: { name: 'Combat', color: '#6b1c1c', icon: '⚔️' },
        elite: { name: 'Elite Battle', color: '#8b2c2c', icon: '💀' },
        treasure: { name: 'Treasure', color: '#8b7d3a', icon: '✨' },
        shop: { name: 'Merchant', color: '#3a5a4a', icon: '🛒' },
        rest: { name: 'Sanctuary', color: '#2a4a5a', icon: '🕯️' },
        event: { name: 'Mystery', color: '#5a3a5a', icon: '❓' },
        boss: { name: 'Floor Guardian', color: '#4a1a1a', icon: '👁️' }
    },
    
    // Rooms needed before boss appears
    roomsUntilBoss: 8,
    
    // Initialize a new floor with just the start room
    generateFloor(floorNum) {
        const rooms = {};
        
        // Create start room at origin
        rooms['0,0'] = {
            id: '0,0',
            type: 'start',
            x: 0,
            y: 0,
            cleared: true, // Start is always cleared
            exits: {},
            exitsGenerated: false
        };
        
        return { 
            rooms, 
            startRoom: '0,0', 
            floorNum,
            roomsCleared: 0,
            bossAvailable: false
        };
    },
    
    // Generate exits for a room when player enters it
    generateExitsForRoom(roomId) {
        const room = AdventureState.floorMap.rooms[roomId];
        if (!room || room.exitsGenerated) return;
        
        room.exitsGenerated = true;
        room.exits = {};
        
        const [x, y] = roomId.split(',').map(Number);
        const roomsCleared = AdventureState.floorMap.roomsCleared;
        const isBossTime = roomsCleared >= this.roomsUntilBoss;
        
        // Boss room has no exits
        if (room.type === 'boss') {
            return;
        }
        
        // If boss time, only offer one path to boss
        if (isBossTime && !AdventureState.floorMap.bossAvailable) {
            AdventureState.floorMap.bossAvailable = true;
            const bossDir = this.pickRandomDirections(1)[0];
            const bossCoords = this.getAdjacentCoords(x, y, bossDir);
            const bossId = `${bossCoords.x},${bossCoords.y}`;
            
            // Create boss room
            AdventureState.floorMap.rooms[bossId] = {
                id: bossId,
                type: 'boss',
                x: bossCoords.x,
                y: bossCoords.y,
                cleared: false,
                exits: {},
                exitsGenerated: true
            };
            
            room.exits[bossDir] = bossId;
            return;
        }
        
        // Pick 2-3 random directions (north, east, west - not south/back)
        const numExits = Math.random() < 0.4 ? 2 : 3;
        const directions = this.pickRandomDirections(numExits);
        
        for (const dir of directions) {
            const coords = this.getAdjacentCoords(x, y, dir);
            const targetId = `${coords.x},${coords.y}`;
            
            // Check if room already exists at those coordinates
            if (!AdventureState.floorMap.rooms[targetId]) {
                // Generate a new room
                const type = this.pickRoomType(roomsCleared, this.roomsUntilBoss, AdventureState.currentFloor);
                AdventureState.floorMap.rooms[targetId] = {
                    id: targetId,
                    type: type,
                    x: coords.x,
                    y: coords.y,
                    cleared: false,
                    exits: {},
                    exitsGenerated: false
                };
            }
            
            room.exits[dir] = targetId;
        }
    },
    
    // Pick random directions excluding south (backward)
    pickRandomDirections(count) {
        const available = ['north', 'east', 'west'];
        const shuffled = [...available].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, Math.min(count, available.length));
    },
    
    // Get coordinates for adjacent room
    getAdjacentCoords(x, y, direction) {
        switch(direction) {
            case 'north': return { x: x, y: y - 1 };
            case 'south': return { x: x, y: y + 1 };
            case 'east': return { x: x + 1, y: y };
            case 'west': return { x: x - 1, y: y };
            default: return { x, y };
        }
    },
    
    // Get opposite direction
    getOppositeDirection(dir) {
        const opposites = { north: 'south', south: 'north', east: 'west', west: 'east' };
        return opposites[dir];
    },
    
    pickRoomType(roomsCleared, roomsUntilBoss, floorNum) {
        // Closer to boss = higher elite chance
        const progress = roomsCleared / roomsUntilBoss;
        
        if (progress > 0.7) {
            const roll = Math.random();
            if (roll < 0.3) return 'elite';
            if (roll < 0.5) return 'battle';
            if (roll < 0.7) return 'rest';
            return 'treasure';
        }
        
        // Normal distribution
        const roll = Math.random();
        if (roll < 0.30) return 'battle';
        if (roll < 0.45) return 'event';
        if (roll < 0.60) return 'treasure';
        if (roll < 0.75) return 'shop';
        if (roll < 0.88) return 'rest';
        if (roll < 0.95) return 'elite';
        return 'battle';
    },
    
    getRoomInfo(type) {
        return this.roomTypes[type] || this.roomTypes.battle;
    }
};

// ==================== ISOMETRIC ENGINE ====================

window.IsometricEngine = {
    canvas: null,
    ctx: null,
    isRunning: false,
    lastTime: 0,
    animationId: null,
    
    // Isometric settings
    tileWidth: 64,
    tileHeight: 32,
    tileDepth: 12,  // Height of tile sides for 3D effect
    roomWidth: 11,  // tiles (smaller for better visibility)
    roomHeight: 11, // tiles
    
    // Camera
    camera: {
        x: 0,
        y: 0,
        targetX: 0,
        targetY: 0,
        zoom: 1
    },
    
    // Player (grid-based movement like Pokemon)
    player: {
        tileX: 5,      // Current tile position (integer)
        tileY: 5,
        visualX: 5,    // Visual position for smooth animation
        visualY: 5,
        targetTileX: 5,
        targetTileY: 5,
        moveProgress: 1, // 0 to 1, 1 = arrived
        moveSpeed: 5,    // Tiles per second
        facing: 'south',
        isMoving: false,
        canMove: true,   // False while moving between tiles
        sprite: '🚶'
    },
    
    // Interactables in current room
    interactables: [],
    nearbyInteractable: null,
    
    // Lighting
    lights: [],
    ambientLight: 0.6,  // Very generous ambient light for visibility
    playerLightRadius: 350,
    
    // Room exits (directions player can leave)
    exits: [],
    
    // Input state
    keys: {
        up: false,
        down: false,
        left: false,
        right: false,
        action: false
    },
    touchStart: null,
    touchCurrent: null,
    
    // ==================== INITIALIZATION ====================
    
    init() {
        this.createCanvas();
        this.bindControls();
    },
    
    createCanvas() {
        if (this.canvas) return;
        
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'isometric-canvas';
        this.canvas.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 1;
        `;
        this.ctx = this.canvas.getContext('2d');
        
        // Don't resize yet - wait until canvas is attached and visible
        window.addEventListener('resize', () => this.resizeCanvas());
        
        console.log('[Isometric] Canvas element created');
    },
    
    resizeCanvas() {
        // Store dimensions without DPR for simpler rendering
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        // Center camera on room
        this.centerCamera();
        
        console.log('[Isometric] Canvas resized:', this.canvas.width, 'x', this.canvas.height);
    },
    
    centerCamera() {
        const centerTile = Math.floor(this.roomWidth / 2);
        const pos = this.tileToScreen(centerTile, centerTile);
        this.camera.x = pos.x - window.innerWidth / 2;
        this.camera.y = pos.y - window.innerHeight / 2 + 50;
        this.camera.targetX = this.camera.x;
        this.camera.targetY = this.camera.y;
    },
    
    // ==================== COORDINATE CONVERSION ====================
    
    tileToScreen(tileX, tileY) {
        const x = (tileX - tileY) * (this.tileWidth / 2);
        const y = (tileX + tileY) * (this.tileHeight / 2);
        return { x, y };
    },
    
    screenToTile(screenX, screenY) {
        const x = screenX + this.camera.x;
        const y = screenY + this.camera.y;
        
        const tileX = (x / (this.tileWidth / 2) + y / (this.tileHeight / 2)) / 2;
        const tileY = (y / (this.tileHeight / 2) - x / (this.tileWidth / 2)) / 2;
        
        return { x: Math.floor(tileX), y: Math.floor(tileY) };
    },
    
    // ==================== CONTROLS ====================
    
    bindControls() {
        // Keyboard
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
        
        // Mouse/Touch for click-to-move
        document.addEventListener('mousedown', (e) => this.handlePointerDown(e));
        document.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        document.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        document.addEventListener('touchend', (e) => this.handleTouchEnd(e));
    },
    
    handleKeyDown(e) {
        if (!this.isRunning) return;
        
        // Block all gameplay input during dialogue or non-interactive phases
        const blockedPhases = ['dialogue', 'awakening', 'inactive', 'battle'];
        if (blockedPhases.includes(AdventureState.phase)) return;
        
        switch(e.key.toLowerCase()) {
            case 'w': case 'arrowup': this.keys.up = true; break;
            case 's': case 'arrowdown': this.keys.down = true; break;
            case 'a': case 'arrowleft': this.keys.left = true; break;
            case 'd': case 'arrowright': this.keys.right = true; break;
            case 'e': case ' ': case 'enter': 
                this.keys.action = true;
                this.tryInteract();
                break;
        }
    },
    
    handleKeyUp(e) {
        switch(e.key.toLowerCase()) {
            case 'w': case 'arrowup': this.keys.up = false; break;
            case 's': case 'arrowdown': this.keys.down = false; break;
            case 'a': case 'arrowleft': this.keys.left = false; break;
            case 'd': case 'arrowright': this.keys.right = false; break;
            case 'e': case ' ': case 'enter': this.keys.action = false; break;
        }
    },
    
    handlePointerDown(e) {
        if (!this.isRunning) return;
        
        // Block during dialogue or non-interactive phases
        const blockedPhases = ['dialogue', 'awakening', 'inactive', 'battle'];
        if (blockedPhases.includes(AdventureState.phase)) return;
        if (e.target.closest('.adventure-ui')) return;
        
        const tile = this.screenToTile(e.clientX, e.clientY);
        if (this.isValidTile(tile.x, tile.y)) {
            this.player.targetX = tile.x;
            this.player.targetY = tile.y;
        }
    },
    
    handleTouchStart(e) {
        if (!this.isRunning) return;
        
        // Block during dialogue or non-interactive phases
        const blockedPhases = ['dialogue', 'awakening', 'inactive', 'battle'];
        if (blockedPhases.includes(AdventureState.phase)) return;
        if (e.target.closest('.adventure-ui')) return;
        
        const touch = e.touches[0];
        this.touchStart = { x: touch.clientX, y: touch.clientY };
        this.touchCurrent = { x: touch.clientX, y: touch.clientY };
    },
    
    handleTouchMove(e) {
        if (!this.touchStart) return;
        e.preventDefault();
        
        const touch = e.touches[0];
        this.touchCurrent = { x: touch.clientX, y: touch.clientY };
        
        // Virtual joystick behavior
        const dx = this.touchCurrent.x - this.touchStart.x;
        const dy = this.touchCurrent.y - this.touchStart.y;
        const threshold = 30;
        
        this.keys.up = dy < -threshold;
        this.keys.down = dy > threshold;
        this.keys.left = dx < -threshold;
        this.keys.right = dx > threshold;
    },
    
    handleTouchEnd(e) {
        this.touchStart = null;
        this.touchCurrent = null;
        this.keys.up = false;
        this.keys.down = false;
        this.keys.left = false;
        this.keys.right = false;
        
        // Tap to interact - only if in interactive phase
        const blockedPhases = ['dialogue', 'awakening', 'inactive', 'battle'];
        if (!blockedPhases.includes(AdventureState.phase) && e.changedTouches.length > 0 && this.nearbyInteractable) {
            this.tryInteract();
        }
    },
    
    isValidTile(x, y) {
        return x >= 0 && x < this.roomWidth && y >= 0 && y < this.roomHeight;
    },
    
    // ==================== INTERACTION ====================
    
    tryInteract() {
        // Block interaction during dialogue or non-interactive phases
        const blockedPhases = ['dialogue', 'awakening', 'inactive', 'battle'];
        if (blockedPhases.includes(AdventureState.phase)) return;
        
        if (this.nearbyInteractable) {
            const obj = this.nearbyInteractable;
            if (obj.onInteract) {
                obj.onInteract(obj);
            }
        }
    },
    
    checkNearbyInteractables() {
        const px = this.player.tileX;
        const py = this.player.tileY;
        
        let closest = null;
        let closestDist = 2.0; // Interaction range in tiles
        
        for (const obj of this.interactables) {
            const dx = obj.x - px;
            const dy = obj.y - py;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < closestDist) {
                closest = obj;
                closestDist = dist;
            }
        }
        
        // Check exits
        for (const exit of this.exits) {
            const dx = exit.x - px;
            const dy = exit.y - py;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < closestDist) {
                closest = exit;
                closestDist = dist;
            }
        }
        
        this.nearbyInteractable = closest;
    },
    
    // ==================== GAME LOOP ====================
    
    start() {
        if (this.isRunning) {
            console.log('[Isometric] Already running');
            return;
        }
        console.log('[Isometric] Starting engine...');
        console.log('[Isometric] Canvas:', this.canvas?.width, 'x', this.canvas?.height);
        console.log('[Isometric] Player at:', this.player.x, this.player.y);
        console.log('[Isometric] Interactables:', this.interactables.length);
        console.log('[Isometric] Camera:', this.camera.x, this.camera.y);
        
        this.isRunning = true;
        this.lastTime = performance.now();
        this.loop();
    },
    
    stop() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    },
    
    loop() {
        if (!this.isRunning) return;
        
        const now = performance.now();
        const dt = Math.min((now - this.lastTime) / 1000, 0.1);
        this.lastTime = now;
        
        // Debug frame counter (less verbose)
        this.frameCount = (this.frameCount || 0) + 1;
        
        this.update(dt);
        this.render();
        
        this.animationId = requestAnimationFrame(() => this.loop());
    },
    
    update(dt) {
        const p = this.player;
        
        // Block movement during dialogue or non-interactive phases
        const blockedPhases = ['dialogue', 'awakening', 'inactive', 'battle'];
        const canAcceptInput = !blockedPhases.includes(AdventureState.phase);
        
        // Grid-based movement (Pokemon style) - only accept input when not moving and in interactive phase
        if (canAcceptInput && p.canMove && (this.keys.up || this.keys.down || this.keys.left || this.keys.right)) {
            let dx = 0, dy = 0;
            
            // Isometric direction mapping (visual up = tile northwest, etc.)
            if (this.keys.up) { dx = -1; dy = -1; p.facing = 'north'; }
            else if (this.keys.down) { dx = 1; dy = 1; p.facing = 'south'; }
            else if (this.keys.left) { dx = -1; dy = 1; p.facing = 'west'; }
            else if (this.keys.right) { dx = 1; dy = -1; p.facing = 'east'; }
            
            // Only move one direction at a time (no diagonals in Pokemon style)
            if (dx !== 0 || dy !== 0) {
                const newX = p.tileX + dx;
                const newY = p.tileY + dy;
                
                // Check bounds
                if (this.isValidTile(newX, newY)) {
                    p.targetTileX = newX;
                    p.targetTileY = newY;
                    p.moveProgress = 0;
                    p.canMove = false;
                    p.isMoving = true;
                }
            }
        }
        
        // Animate movement between tiles
        if (p.isMoving) {
            const speed = p.moveSpeed * (1 + this.getSpeedBonus());
            p.moveProgress += speed * dt;
            
            if (p.moveProgress >= 1) {
                // Arrived at destination
                p.moveProgress = 1;
                p.tileX = p.targetTileX;
                p.tileY = p.targetTileY;
                p.visualX = p.tileX;
                p.visualY = p.tileY;
                p.isMoving = false;
                p.canMove = true;
            } else {
                // Lerp visual position
                p.visualX = p.tileX + (p.targetTileX - p.tileX) * p.moveProgress;
                p.visualY = p.tileY + (p.targetTileY - p.tileY) * p.moveProgress;
            }
        }
        
        // Update world position from visual tile position
        const worldPos = this.tileToScreen(p.visualX, p.visualY);
        p.worldX = worldPos.x;
        p.worldY = worldPos.y;
        
        // Camera follows player smoothly
        this.camera.targetX = p.worldX - window.innerWidth / 2;
        this.camera.targetY = p.worldY - window.innerHeight / 2 + 50;
        this.camera.x += (this.camera.targetX - this.camera.x) * 0.1;
        this.camera.y += (this.camera.targetY - this.camera.y) * 0.1;
        
        // Check for nearby interactables
        this.checkNearbyInteractables();
        
        // Update lights (subtle flicker)
        const now = performance.now();
        for (const light of this.lights) {
            light.flicker = 0.95 + Math.sin(now * 0.003 + light.phase) * 0.05;
        }
    },
    
    getSpeedBonus() {
        let bonus = 0;
        for (const relic of AdventureState.relics) {
            if (relic.effect?.speedBonus) {
                bonus += relic.effect.speedBonus;
            }
        }
        return bonus;
    },
    
    // ==================== RENDERING ====================
    
    render() {
        const ctx = this.ctx;
        if (!ctx) {
            console.error('[Isometric] No canvas context!');
            return;
        }
        
        const w = this.canvas.width;
        const h = this.canvas.height;
        
        // Clear entire canvas with dark background
        ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
        ctx.fillStyle = '#12121a';
        ctx.fillRect(0, 0, w, h);
        
        ctx.save();
        ctx.translate(-this.camera.x, -this.camera.y);
        
        // Draw floor tiles
        this.renderFloor();
        
        // Draw interactables (sorted by y for depth)
        const p = this.player;
        const sortedObjects = [...this.interactables, ...this.exits]
            .sort((a, b) => (a.y + a.x) - (b.y + b.x));
        
        for (const obj of sortedObjects) {
            if (obj.y < p.visualY || (obj.y === p.visualY && obj.x < p.visualX)) {
                this.renderObject(obj);
            }
        }
        
        // Draw player
        this.renderPlayer();
        
        // Draw objects in front of player
        for (const obj of sortedObjects) {
            if (obj.y >= p.visualY && (obj.y > p.visualY || obj.x >= p.visualX)) {
                this.renderObject(obj);
            }
        }
        
        ctx.restore();
        
        // Apply lighting overlay
        this.renderLighting();
        
        // Render interaction prompt
        if (this.nearbyInteractable) {
            this.renderInteractionPrompt();
        }
        
        // Debug: Draw frame indicator (p already defined above)
        ctx.fillStyle = 'rgba(255, 255, 0, 0.7)';
        ctx.font = '11px monospace';
        ctx.fillText(`Tile: ${p.tileX},${p.tileY} | Phase: ${AdventureState.phase}`, 10, h - 10);
    },
    
    renderFloor() {
        const ctx = this.ctx;
        const depth = this.tileDepth;
        
        // Draw tiles back to front for proper depth sorting
        for (let y = 0; y < this.roomHeight; y++) {
            for (let x = 0; x < this.roomWidth; x++) {
                const pos = this.tileToScreen(x, y);
                
                // Color variations for checkerboard
                const isLight = (x + y) % 2 === 0;
                const topColor = isLight ? '#3a3a4d' : '#2d2d3d';
                const leftColor = isLight ? '#252535' : '#1e1e2a';
                const rightColor = isLight ? '#2f2f42' : '#252532';
                const borderColor = '#4a4a5d';
                
                // Draw left side face (visible from our view angle)
                ctx.beginPath();
                ctx.moveTo(pos.x - this.tileWidth / 2, pos.y);
                ctx.lineTo(pos.x, pos.y + this.tileHeight / 2);
                ctx.lineTo(pos.x, pos.y + this.tileHeight / 2 + depth);
                ctx.lineTo(pos.x - this.tileWidth / 2, pos.y + depth);
                ctx.closePath();
                ctx.fillStyle = leftColor;
                ctx.fill();
                
                // Draw right side face
                ctx.beginPath();
                ctx.moveTo(pos.x + this.tileWidth / 2, pos.y);
                ctx.lineTo(pos.x, pos.y + this.tileHeight / 2);
                ctx.lineTo(pos.x, pos.y + this.tileHeight / 2 + depth);
                ctx.lineTo(pos.x + this.tileWidth / 2, pos.y + depth);
                ctx.closePath();
                ctx.fillStyle = rightColor;
                ctx.fill();
                
                // Draw top face (diamond)
                ctx.beginPath();
                ctx.moveTo(pos.x, pos.y - this.tileHeight / 2);
                ctx.lineTo(pos.x + this.tileWidth / 2, pos.y);
                ctx.lineTo(pos.x, pos.y + this.tileHeight / 2);
                ctx.lineTo(pos.x - this.tileWidth / 2, pos.y);
                ctx.closePath();
                ctx.fillStyle = topColor;
                ctx.fill();
                
                // Subtle edge highlight on top
                ctx.strokeStyle = borderColor;
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }
    },
    
    renderPlayer() {
        const ctx = this.ctx;
        const p = this.player;
        const pos = this.tileToScreen(p.visualX, p.visualY);
        
        // Shadow centered perfectly on tile center
        ctx.beginPath();
        ctx.ellipse(pos.x, pos.y + 2, 10, 5, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fill();
        
        // Player sprite - perfectly centered on tile
        const spriteSize = 32;
        ctx.font = `${spriteSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Bob when moving
        const bobOffset = p.isMoving ? Math.sin(performance.now() * 0.012) * 2 : 0;
        
        // Draw player exactly at tile center, raised slightly above the surface
        // pos is the center of the diamond top, sprite should be at that exact X
        // Y is raised by half sprite height to sit "on" the tile
        ctx.fillText(p.sprite, pos.x, pos.y - spriteSize/2 + 4 + bobOffset);
    },
    
    renderObject(obj) {
        const ctx = this.ctx;
        const pos = this.tileToScreen(obj.x, obj.y);
        
        // Glow effect for interactables
        if (obj.glow) {
            ctx.shadowColor = obj.glowColor || '#e8a93e';
            ctx.shadowBlur = 20 + Math.sin(performance.now() * 0.003) * 5;
        }
        
        // Shadow
        ctx.beginPath();
        ctx.ellipse(pos.x, pos.y + 5, 12, 6, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fill();
        
        // Floating animation
        const floatOffset = obj.float ? Math.sin(performance.now() * 0.002 + (obj.floatPhase || 0)) * 8 : 0;
        
        // Sprite
        ctx.font = `${obj.size || 32}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(obj.sprite, pos.x, pos.y - 25 - floatOffset);
        
        ctx.shadowBlur = 0;
        
        // Label if nearby
        if (obj === this.nearbyInteractable && obj.label) {
            ctx.font = '14px "Cinzel", serif';
            ctx.fillStyle = '#d4c4a8';
            ctx.fillText(obj.label, pos.x, pos.y - 60 - floatOffset);
        }
    },
    
    renderLighting() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        
        // Create lighting canvas
        const lightCanvas = document.createElement('canvas');
        lightCanvas.width = w;
        lightCanvas.height = h;
        const lctx = lightCanvas.getContext('2d');
        
        // Start with semi-transparent darkness (generous lighting)
        lctx.fillStyle = `rgba(5, 5, 15, ${1 - this.ambientLight})`;
        lctx.fillRect(0, 0, w, h);
        
        // Set composite for "punching out" light
        lctx.globalCompositeOperation = 'destination-out';
        
        // Player light
        const playerScreen = {
            x: this.player.worldX - this.camera.x,
            y: this.player.worldY - this.camera.y - 20
        };
        
        const playerGrad = lctx.createRadialGradient(
            playerScreen.x, playerScreen.y, 0,
            playerScreen.x, playerScreen.y, this.playerLightRadius
        );
        playerGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        playerGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.4)');
        playerGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        lctx.fillStyle = playerGrad;
        lctx.beginPath();
        lctx.arc(playerScreen.x, playerScreen.y, this.playerLightRadius, 0, Math.PI * 2);
        lctx.fill();
        
        // Additional light sources
        for (const light of this.lights) {
            const screenPos = {
                x: light.worldX - this.camera.x,
                y: light.worldY - this.camera.y
            };
            
            const radius = light.radius * (light.flicker || 1);
            const grad = lctx.createRadialGradient(
                screenPos.x, screenPos.y, 0,
                screenPos.x, screenPos.y, radius
            );
            grad.addColorStop(0, `rgba(255, 255, 255, ${light.intensity})`);
            grad.addColorStop(0.6, `rgba(255, 255, 255, ${light.intensity * 0.3})`);
            grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            
            lctx.fillStyle = grad;
            lctx.beginPath();
            lctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
            lctx.fill();
        }
        
        // Apply to main canvas
        ctx.drawImage(lightCanvas, 0, 0);
        
        // Subtle vignette
        const vignette = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, Math.max(w, h) * 0.7);
        vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
        vignette.addColorStop(0.7, 'rgba(0, 0, 0, 0)');
        vignette.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, w, h);
    },
    
    renderInteractionPrompt() {
        const ctx = this.ctx;
        const obj = this.nearbyInteractable;
        const pos = this.tileToScreen(obj.x, obj.y);
        const screenPos = {
            x: pos.x - this.camera.x,
            y: pos.y - this.camera.y - 80
        };
        
        // Prompt background
        ctx.fillStyle = 'rgba(20, 18, 25, 0.9)';
        ctx.strokeStyle = 'rgba(232, 169, 62, 0.6)';
        ctx.lineWidth = 2;
        
        const text = obj.promptText || '[E] Interact';
        ctx.font = '14px "Cinzel", serif';
        const metrics = ctx.measureText(text);
        const padding = 12;
        const boxWidth = metrics.width + padding * 2;
        const boxHeight = 28;
        
        ctx.beginPath();
        ctx.roundRect(screenPos.x - boxWidth/2, screenPos.y - boxHeight/2, boxWidth, boxHeight, 4);
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = '#d4c4a8';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, screenPos.x, screenPos.y);
    },
    
    // ==================== ROOM SETUP ====================
    
    setupRoom(roomData) {
        this.interactables = [];
        this.lights = [];
        this.exits = [];
        
        // Reset player position to center (grid-based)
        const p = this.player;
        p.tileX = 5;
        p.tileY = 5;
        p.visualX = 5;
        p.visualY = 5;
        p.targetTileX = 5;
        p.targetTileY = 5;
        p.moveProgress = 1;
        p.isMoving = false;
        p.canMove = true;
        
        // Initialize world position
        const worldPos = this.tileToScreen(p.tileX, p.tileY);
        p.worldX = worldPos.x;
        p.worldY = worldPos.y;
        
        // Add room-specific content
        if (roomData) {
            this.setupRoomContent(roomData);
        }
        
        this.centerCamera();
    },
    
    setupRoomContent(roomData) {
        const info = FloorMapGenerator.getRoomInfo(roomData.type);
        
        // Generate exits for this room if not already done
        FloorMapGenerator.generateExitsForRoom(roomData.id);
        
        // Add exit portals on different edges based on direction
        if (roomData.exits) {
            // Door positions for each edge of the room
            const doorPositions = {
                north: { x: 5, y: 1 },   // Top edge (center)
                east: { x: 9, y: 5 },    // Right edge (center)
                west: { x: 1, y: 5 },    // Left edge (center)
                south: { x: 5, y: 9 }    // Bottom edge (not used normally)
            };
            
            // Direction labels
            const dirLabels = {
                north: 'North',
                east: 'East',
                west: 'West',
                south: 'South'
            };
            
            for (const [direction, targetRoomId] of Object.entries(roomData.exits)) {
                const pos = doorPositions[direction];
                if (!pos) continue;
                
                const targetRoom = AdventureState.floorMap?.rooms?.[targetRoomId];
                const targetInfo = targetRoom ? FloorMapGenerator.getRoomInfo(targetRoom.type) : null;
                
                // Show room type if revealed
                const isRevealed = AdventureState.revealedRooms?.has(targetRoomId);
                const dirLabel = dirLabels[direction] || 'Unknown';
                const roomLabel = isRevealed && targetInfo 
                    ? `${dirLabel} (${targetInfo.name})` 
                    : `${dirLabel} Path`;
                
                this.exits.push({
                    x: pos.x, 
                    y: pos.y,
                    sprite: '🚪',
                    label: roomLabel,
                    promptText: '[E] Enter',
                    glow: true,
                    glowColor: isRevealed && targetInfo ? targetInfo.color : '#7eb89e',
                    targetRoomId: targetRoomId,
                    direction: direction,
                    onInteract: () => AdventureUI.moveToRoom(targetRoomId, direction)
                });
            }
        }
        
        // Add room-specific content
        switch(roomData.type) {
            case 'battle':
            case 'elite':
                this.addBattleContent(roomData);
                break;
            case 'treasure':
                this.addTreasureContent(roomData);
                break;
            case 'shop':
                this.addShopContent(roomData);
                break;
            case 'rest':
                this.addRestContent(roomData);
                break;
            case 'event':
                this.addEventContent(roomData);
                break;
            case 'boss':
                this.addBossContent(roomData);
                break;
        }
        
        // Add ambient lights
        this.addAmbientLights();
    },
    
    addBattleContent(roomData) {
        if (!roomData.cleared) {
            this.interactables.push({
                x: 5, y: 3,
                sprite: roomData.type === 'elite' ? '💀' : '⚔️',
                size: 48,
                label: roomData.type === 'elite' ? 'Elite Enemy' : 'Enemy',
                promptText: '[E] Fight',
                glow: true,
                glowColor: '#6b1c1c',
                float: true,
                floatPhase: 0,
                onInteract: () => AdventureUI.startBattle(roomData)
            });
        }
    },
    
    addTreasureContent(roomData) {
        if (!roomData.cleared) {
            this.interactables.push({
                x: 5, y: 3,
                sprite: '✨',
                size: 40,
                label: 'Treasure',
                promptText: '[E] Open',
                glow: true,
                glowColor: '#e8a93e',
                float: true,
                floatPhase: Math.random() * Math.PI * 2,
                onInteract: () => AdventureUI.openTreasure(roomData)
            });
        }
    },
    
    addShopContent(roomData) {
        this.interactables.push({
            x: 5, y: 3,
            sprite: '🛒',
            size: 40,
            label: 'Merchant',
            promptText: '[E] Browse',
            glow: true,
            glowColor: '#3a5a4a',
            onInteract: () => AdventureUI.openShop(roomData)
        });
    },
    
    addRestContent(roomData) {
        this.interactables.push({
            x: 5, y: 3,
            sprite: '🕯️',
            size: 40,
            label: 'Sanctuary',
            promptText: '[E] Rest',
            glow: true,
            glowColor: '#e8a93e',
            float: true,
            floatPhase: Math.random() * Math.PI * 2,
            onInteract: () => AdventureUI.useRestSite(roomData)
        });
        
        // Add extra lights for sanctuary
        const pos = this.tileToScreen(5, 3);
        this.lights.push({
            worldX: pos.x,
            worldY: pos.y - 20,
            radius: 200,
            intensity: 0.8,
            phase: Math.random() * Math.PI * 2
        });
    },
    
    addEventContent(roomData) {
        if (!roomData.cleared) {
            this.interactables.push({
                x: 5, y: 3,
                sprite: '❓',
                size: 40,
                label: 'Mystery',
                promptText: '[E] Investigate',
                glow: true,
                glowColor: '#5a3a5a',
                float: true,
                floatPhase: Math.random() * Math.PI * 2,
                onInteract: () => AdventureUI.triggerEvent(roomData)
            });
        }
    },
    
    addBossContent(roomData) {
        if (!roomData.cleared) {
            this.interactables.push({
                x: 5, y: 2,
                sprite: '👁️',
                size: 64,
                label: 'Floor Guardian',
                promptText: '[E] Challenge',
                glow: true,
                glowColor: '#4a1a1a',
                float: true,
                floatPhase: 0,
                onInteract: () => AdventureUI.startBossBattle(roomData)
            });
        }
    },
    
    addAmbientLights() {
        // Corner lights (adjusted for 11x11 room)
        const corners = [[1, 1], [9, 1], [1, 9], [9, 9]];
        for (const [x, y] of corners) {
            const pos = this.tileToScreen(x, y);
            this.lights.push({
                worldX: pos.x,
                worldY: pos.y,
                radius: 100,
                intensity: 0.5,
                phase: Math.random() * Math.PI * 2
            });
        }
        
        // Center light for better visibility
        const centerPos = this.tileToScreen(5, 5);
        this.lights.push({
            worldX: centerPos.x,
            worldY: centerPos.y,
            radius: 180,
            intensity: 0.6,
            phase: 0
        });
    },
    
    // Setup starting chamber with deck selection
    setupStartingChamber() {
        console.log('[Isometric] Setting up starting chamber...');
        
        this.interactables = [];
        this.lights = [];
        this.exits = [];
        
        // Reset player to bottom of room (grid-based)
        const p = this.player;
        p.tileX = 5;
        p.tileY = 8;
        p.visualX = 5;
        p.visualY = 8;
        p.targetTileX = 5;
        p.targetTileY = 8;
        p.moveProgress = 1;
        p.isMoving = false;
        p.canMove = true;
        
        // Initialize world position
        const worldPos = this.tileToScreen(p.tileX, p.tileY);
        p.worldX = worldPos.x;
        p.worldY = worldPos.y;
        
        // Floating deck orbs in center (adjusted for 11x11 room)
        const decks = Object.values(StarterDecks || {}).filter(d => !d.locked);
        console.log('[Isometric] Available decks:', decks.length, decks.map(d => d.name));
        const positions = [[3, 4], [5, 3], [7, 4]];
        
        decks.forEach((deck, i) => {
            if (i >= positions.length) return;
            const [x, y] = positions[i];
            
            this.interactables.push({
                x, y,
                sprite: deck.icon,
                size: 48,
                label: deck.name,
                promptText: '[E] Examine',
                glow: true,
                glowColor: '#a080d0',
                float: true,
                floatPhase: i * (Math.PI * 2 / 3),
                deckId: deck.id,
                onInteract: () => AdventureUI.showDeckPreview(deck)
            });
            
            // Light for each deck
            const pos = this.tileToScreen(x, y);
            this.lights.push({
                worldX: pos.x,
                worldY: pos.y - 20,
                radius: 150,
                intensity: 0.7,
                phase: i * (Math.PI * 2 / 3)
            });
        });
        
        // Central stronger light (adjusted for 11x11 room)
        const centerPos = this.tileToScreen(5, 4);
        this.lights.push({
            worldX: centerPos.x,
            worldY: centerPos.y,
            radius: 220,
            intensity: 0.9,
            phase: 0
        });
        
        this.centerCamera();
    },
    
    // Setup relic selection (after deck chosen)
    setupRelicSelection() {
        this.interactables = [];
        
        const relics = RelicRegistry.getRandomStarterRelics(3);
        const positions = [[3, 4], [5, 3], [7, 4]]; // Adjusted for 11x11 room
        
        relics.forEach((relic, i) => {
            if (i >= positions.length) return;
            const [x, y] = positions[i];
            
            this.interactables.push({
                x, y,
                sprite: relic.sprite,
                size: 48,
                label: relic.name,
                promptText: '[E] Examine',
                glow: true,
                glowColor: '#e8a93e',
                float: true,
                floatPhase: i * (Math.PI * 2 / 3),
                relicId: relic.id,
                relic: relic,
                onInteract: () => AdventureUI.showRelicPreview(relic)
            });
        });
        
        // Store choices for reference
        this.relicChoices = relics;
    }
};

// ==================== DIALOGUE SYSTEM ====================

window.DialogueSystem = {
    queue: [],
    isActive: false,
    currentCallback: null,
    typewriterSpeed: 30,
    typewriterTimeout: null,
    
    // Show a dialogue message
    show(text, options = {}) {
        return new Promise((resolve) => {
            this.queue.push({
                text,
                speaker: options.speaker || null,
                typewriter: options.typewriter !== false,
                autoClose: options.autoClose || 0,
                onComplete: resolve
            });
            
            if (!this.isActive) {
                this.processQueue();
            }
        });
    },
    
    // Show a sequence of messages
    async showSequence(messages) {
        for (const msg of messages) {
            if (typeof msg === 'string') {
                await this.show(msg);
            } else {
                await this.show(msg.text, msg);
            }
        }
    },
    
    processQueue() {
        if (this.queue.length === 0) {
            this.isActive = false;
            // Restore previous phase
            if (this.previousPhase) {
                AdventureState.phase = this.previousPhase;
                this.previousPhase = null;
            }
            return;
        }
        
        this.isActive = true;
        // Store phase before switching to dialogue
        if (AdventureState.phase !== 'dialogue' && !this.previousPhase) {
            this.previousPhase = AdventureState.phase;
        }
        AdventureState.phase = 'dialogue';
        
        const message = this.queue.shift();
        this.displayMessage(message);
    },
    
    displayMessage(message) {
        const overlay = document.getElementById('dialogue-overlay');
        const box = document.getElementById('dialogue-box');
        const textEl = document.getElementById('dialogue-text');
        const speakerEl = document.getElementById('dialogue-speaker');
        const continueEl = document.getElementById('dialogue-continue');
        
        // Show overlay
        overlay.classList.add('active');
        
        // Set speaker
        if (message.speaker) {
            speakerEl.textContent = message.speaker;
            speakerEl.style.display = 'block';
        } else {
            speakerEl.style.display = 'none';
        }
        
        // Clear previous text
        textEl.textContent = '';
        continueEl.style.opacity = '0';
        
        // Store callback
        this.currentCallback = message.onComplete;
        
        // Typewriter effect
        if (message.typewriter) {
            this.typewriterEffect(textEl, message.text, () => {
                continueEl.style.opacity = '1';
                if (message.autoClose > 0) {
                    setTimeout(() => this.advance(), message.autoClose);
                }
            });
        } else {
            // No typewriter - text is immediately complete
            this.typewriterTimeout = null;
            this.isTypingComplete = true;
            this.currentFullText = message.text;
            textEl.textContent = message.text;
            continueEl.style.opacity = '1';
            if (message.autoClose > 0) {
                setTimeout(() => this.advance(), message.autoClose);
            }
        }
    },
    
    typewriterEffect(element, text, onComplete) {
        // Store clean text and reset typing state
        this.currentFullText = text.replace(/\*/g, '');
        this.isTypingComplete = false;
        this.typewriterTimeout = null;
        
        let index = 0;
        let displayText = '';
        
        const type = () => {
            if (index < text.length) {
                let char = text[index];
                
                // Skip formatting markers
                if (char === '*') {
                    index++;
                    return type();
                }
                
                displayText += char;
                
                // Pre-wrap: Set full text with invisible remainder to maintain word wrap
                // This prevents words from jumping to new lines mid-typing
                const remaining = text.slice(index + 1).replace(/\*/g, '');
                element.innerHTML = displayText + '<span style="opacity:0">' + remaining + '</span>';
                
                index++;
                
                // Variable speed for punctuation
                let delay = this.typewriterSpeed;
                if (['.', '!', '?'].includes(char)) delay = 120;
                else if ([',', ';', ':'].includes(char)) delay = 60;
                
                this.typewriterTimeout = setTimeout(type, delay);
            } else {
                // Typing complete - clear timeout and mark as complete
                this.typewriterTimeout = null;
                this.isTypingComplete = true;
                element.textContent = this.currentFullText;
                onComplete?.();
            }
        };
        
        type();
    },
    
    advance() {
        // Stop any typing animation
        if (this.typewriterTimeout) {
            clearTimeout(this.typewriterTimeout);
            this.typewriterTimeout = null;
        }
        
        // Hide dialogue
        const overlay = document.getElementById('dialogue-overlay');
        overlay.classList.remove('active');
        
        // Resolve the Promise for this message
        if (this.currentCallback) {
            const cb = this.currentCallback;
            this.currentCallback = null;
            cb();
        }
        
        // Process next message in queue after brief delay
        setTimeout(() => this.processQueue(), 150);
    },
    
    // Handle click/tap - two stage: complete text first, then advance
    skip() {
        if (!this.isActive) return;
        
        // Stage 1: If still typing, complete the text immediately but don't advance yet
        if (this.typewriterTimeout) {
            clearTimeout(this.typewriterTimeout);
            this.typewriterTimeout = null;
            
            // Show full text immediately
            const textEl = document.getElementById('dialogue-text');
            if (this.currentFullText) {
                textEl.textContent = this.currentFullText;
            }
            this.isTypingComplete = true;
            document.getElementById('dialogue-continue').style.opacity = '1';
            return; // Don't advance yet - wait for another click
        }
        
        // Stage 2: Text is complete, advance to next message
        if (this.isTypingComplete) {
            this.advance();
        }
    }
};

// ==================== ADVENTURE UI ====================

window.AdventureUI = {
    container: null,
    selectedDeck: null,
    selectedRelic: null,
    
    init() {
        this.injectStyles();
        this.createUI();
        this.bindEvents();
    },
    
    injectStyles() {
        if (document.getElementById('adventure-ui-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'adventure-ui-styles';
        style.textContent = `
            /* ==================== ADVENTURE SCREEN ==================== */
            #adventure-screen {
                position: fixed;
                inset: 0;
                background: #0a0a0f;
                z-index: 5000;
                display: none;
            }
            
            #adventure-screen.active {
                display: block;
            }
            
            #isometric-canvas {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: #0d0d14;
            }
            
            /* ==================== DIALOGUE SYSTEM ==================== */
            #dialogue-overlay {
                position: fixed;
                inset: 0;
                background: linear-gradient(to bottom, transparent 50%, rgba(5, 5, 15, 0.95) 100%);
                z-index: 6000;
                display: flex;
                align-items: flex-end;
                justify-content: center;
                padding: 24px;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.4s ease;
            }
            
            #dialogue-overlay.active {
                opacity: 1;
                pointer-events: auto;
            }
            
            #dialogue-box {
                background: linear-gradient(180deg, 
                    rgba(25, 22, 35, 0.98) 0%, 
                    rgba(15, 12, 22, 0.98) 100%);
                border: 2px solid rgba(160, 128, 208, 0.4);
                border-radius: 8px;
                padding: 24px 32px;
                max-width: 700px;
                width: 100%;
                position: relative;
                box-shadow: 
                    0 0 60px rgba(160, 128, 208, 0.2),
                    inset 0 1px 0 rgba(255, 255, 255, 0.05);
            }
            
            #dialogue-box::before {
                content: '';
                position: absolute;
                top: 4px;
                left: 4px;
                right: 4px;
                bottom: 4px;
                border: 1px solid rgba(160, 128, 208, 0.15);
                border-radius: 4px;
                pointer-events: none;
            }
            
            #dialogue-speaker {
                font-family: 'Cinzel', serif;
                font-size: 14px;
                color: #a080d0;
                letter-spacing: 3px;
                text-transform: uppercase;
                margin-bottom: 12px;
                display: none;
            }
            
            #dialogue-text {
                font-family: 'Cinzel', serif;
                font-size: 18px;
                color: #d4c4a8;
                line-height: 1.6;
                min-height: 60px;
                word-wrap: break-word;
                overflow-wrap: break-word;
            }
            
            #dialogue-continue {
                position: absolute;
                bottom: 12px;
                right: 16px;
                font-family: 'Cinzel', serif;
                font-size: 12px;
                color: #706050;
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            
            /* ==================== HUD ==================== */
            .adventure-hud {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                padding: 16px 24px;
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                z-index: 5500;
                pointer-events: none;
            }
            
            .adventure-hud > * {
                pointer-events: auto;
            }
            
            .hud-left {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .hud-right {
                display: flex;
                flex-direction: column;
                align-items: flex-end;
                gap: 8px;
            }
            
            .hud-stat {
                background: rgba(15, 12, 20, 0.9);
                border: 1px solid rgba(160, 128, 208, 0.3);
                border-radius: 4px;
                padding: 8px 16px;
                font-family: 'Cinzel', serif;
                font-size: 14px;
                color: #d4c4a8;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .hud-stat .icon {
                font-size: 18px;
            }
            
            .hud-stat.danger {
                border-color: rgba(107, 28, 28, 0.5);
                color: #c45c26;
            }
            
            /* ==================== MINIMAP ==================== */
            .minimap-container {
                background: rgba(15, 12, 20, 0.95);
                border: 2px solid rgba(160, 128, 208, 0.3);
                border-radius: 8px;
                padding: 12px;
                min-width: 150px;
            }
            
            .minimap-title {
                font-family: 'Cinzel', serif;
                font-size: 11px;
                color: #706050;
                text-transform: uppercase;
                letter-spacing: 2px;
                margin-bottom: 8px;
                text-align: center;
            }
            
            .minimap-progress {
                font-family: 'Cinzel', serif;
                font-size: 9px;
                color: #605040;
                text-align: center;
                margin-top: 8px;
                letter-spacing: 1px;
            }
            
            .minimap-grid {
                display: flex;
                flex-direction: column;
                gap: 2px;
                align-items: center;
            }
            
            .minimap-row {
                display: flex;
                gap: 2px;
            }
            
            .minimap-room {
                width: 24px;
                height: 24px;
                border-radius: 3px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 10px;
                transition: all 0.3s ease;
            }
            
            .minimap-room.empty {
                background: transparent;
                border: 1px dashed rgba(100, 80, 120, 0.2);
            }
            
            .minimap-room.hidden {
                background: rgba(40, 35, 50, 0.5);
            }
            
            .minimap-room.revealed {
                background: rgba(60, 50, 70, 0.8);
                border: 1px solid rgba(160, 128, 208, 0.3);
            }
            
            .minimap-room.visited {
                background: rgba(80, 70, 100, 0.9);
                border: 1px solid rgba(160, 128, 208, 0.5);
            }
            
            .minimap-room.current {
                background: rgba(126, 184, 158, 0.8);
                border: 2px solid #7eb89e;
                box-shadow: 0 0 10px rgba(126, 184, 158, 0.5);
            }
            
            .minimap-connections {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
            }
            
            /* ==================== DECK/RELIC PREVIEW ==================== */
            .preview-overlay {
                position: fixed;
                inset: 0;
                background: rgba(5, 5, 15, 0.95);
                z-index: 7000;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 24px;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.3s ease;
            }
            
            .preview-overlay.active {
                opacity: 1;
                pointer-events: auto;
            }
            
            .preview-card {
                background: linear-gradient(180deg, 
                    rgba(30, 25, 40, 0.98) 0%, 
                    rgba(20, 15, 28, 0.98) 100%);
                border: 2px solid rgba(160, 128, 208, 0.5);
                border-radius: 12px;
                padding: 32px;
                max-width: 400px;
                width: 100%;
                text-align: center;
                box-shadow: 0 0 80px rgba(160, 128, 208, 0.3);
            }
            
            .preview-icon {
                font-size: 64px;
                margin-bottom: 16px;
                filter: drop-shadow(0 0 20px currentColor);
            }
            
            .preview-title {
                font-family: 'Cinzel', serif;
                font-size: 28px;
                color: #d4c4a8;
                margin-bottom: 8px;
                letter-spacing: 2px;
            }
            
            .preview-subtitle {
                font-family: 'Cinzel', serif;
                font-size: 14px;
                color: #a080d0;
                margin-bottom: 20px;
                letter-spacing: 1px;
            }
            
            .preview-description {
                font-size: 16px;
                color: #908070;
                line-height: 1.5;
                margin-bottom: 24px;
            }
            
            .preview-cards {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                justify-content: center;
                margin-bottom: 24px;
                max-height: 200px;
                overflow-y: auto;
            }
            
            .preview-card-item {
                background: rgba(60, 50, 70, 0.6);
                border: 1px solid rgba(160, 128, 208, 0.3);
                border-radius: 4px;
                padding: 6px 12px;
                font-size: 12px;
                color: #d4c4a8;
            }
            
            .preview-buttons {
                display: flex;
                gap: 16px;
                justify-content: center;
            }
            
            .preview-btn {
                padding: 14px 28px;
                font-family: 'Cinzel', serif;
                font-size: 14px;
                font-weight: 600;
                letter-spacing: 2px;
                text-transform: uppercase;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            
            .preview-btn.acquire {
                background: linear-gradient(180deg, 
                    rgba(126, 184, 158, 0.9) 0%, 
                    rgba(80, 130, 110, 0.9) 100%);
                border: 2px solid rgba(126, 184, 158, 0.6);
                color: #0a0d12;
            }
            
            .preview-btn.acquire:hover {
                transform: translateY(-2px);
                box-shadow: 0 0 30px rgba(126, 184, 158, 0.4);
            }
            
            .preview-btn.forsake {
                background: transparent;
                border: 1px solid rgba(160, 144, 128, 0.3);
                color: #706050;
            }
            
            .preview-btn.forsake:hover {
                border-color: rgba(160, 144, 128, 0.5);
                color: #908070;
            }
            
            /* ==================== EXIT CHOICE PANEL ==================== */
            .exit-choice-overlay {
                position: fixed;
                inset: 0;
                background: rgba(5, 5, 15, 0.9);
                z-index: 7000;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 24px;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.3s ease;
            }
            
            .exit-choice-overlay.active {
                opacity: 1;
                pointer-events: auto;
            }
            
            .exit-choice-panel {
                background: linear-gradient(180deg, 
                    rgba(25, 22, 35, 0.98) 0%, 
                    rgba(15, 12, 22, 0.98) 100%);
                border: 2px solid rgba(160, 128, 208, 0.4);
                border-radius: 12px;
                padding: 24px;
                max-width: 500px;
                width: 100%;
            }
            
            .exit-choice-title {
                font-family: 'Cinzel', serif;
                font-size: 20px;
                color: #d4c4a8;
                text-align: center;
                margin-bottom: 20px;
            }
            
            .exit-options {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }
            
            .exit-option {
                background: rgba(40, 35, 55, 0.6);
                border: 2px solid rgba(100, 80, 130, 0.3);
                border-radius: 8px;
                padding: 16px;
                cursor: pointer;
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                gap: 16px;
            }
            
            .exit-option:hover {
                background: rgba(60, 50, 80, 0.7);
                border-color: rgba(160, 128, 208, 0.5);
                transform: translateX(4px);
            }
            
            .exit-option .room-icon {
                font-size: 32px;
                width: 50px;
                text-align: center;
            }
            
            .exit-option .room-info {
                flex: 1;
            }
            
            .exit-option .room-name {
                font-family: 'Cinzel', serif;
                font-size: 16px;
                color: #d4c4a8;
                margin-bottom: 4px;
            }
            
            .exit-option .room-type {
                font-size: 12px;
                color: #706050;
            }
            
            .exit-cancel {
                margin-top: 16px;
                text-align: center;
            }
            
            .exit-cancel-btn {
                background: transparent;
                border: 1px solid rgba(100, 80, 90, 0.4);
                color: #605050;
                padding: 10px 24px;
                font-family: 'Cinzel', serif;
                font-size: 13px;
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            
            .exit-cancel-btn:hover {
                border-color: rgba(160, 128, 128, 0.5);
                color: #908080;
            }
            
            /* ==================== RELICS BAR ==================== */
            .relics-bar {
                display: flex;
                gap: 8px;
            }
            
            .relic-slot {
                width: 40px;
                height: 40px;
                background: rgba(30, 25, 40, 0.8);
                border: 1px solid rgba(160, 128, 208, 0.3);
                border-radius: 6px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
                position: relative;
                cursor: help;
            }
            
            .relic-slot .uses {
                position: absolute;
                bottom: -4px;
                right: -4px;
                background: rgba(107, 28, 28, 0.9);
                color: white;
                font-size: 10px;
                padding: 2px 4px;
                border-radius: 3px;
            }
            
            /* ==================== MOBILE CONTROLS ==================== */
            @media (max-width: 768px) {
                .adventure-hud {
                    padding: 12px 16px;
                }
                
                .hud-stat {
                    padding: 6px 12px;
                    font-size: 12px;
                }
                
                .minimap-container {
                    padding: 8px;
                }
                
                .minimap-room {
                    width: 20px;
                    height: 20px;
                }
                
                #dialogue-box {
                    padding: 16px 20px;
                }
                
                #dialogue-text {
                    font-size: 16px;
                }
                
                .preview-card {
                    padding: 20px;
                }
                
                .preview-title {
                    font-size: 22px;
                }
                
                .mobile-controls {
                    position: fixed;
                    bottom: 80px;
                    left: 20px;
                    z-index: 5600;
                    display: block;
                }
                
                .mobile-dpad {
                    width: 140px;
                    height: 140px;
                    position: relative;
                }
                
                .dpad-btn {
                    position: absolute;
                    width: 45px;
                    height: 45px;
                    background: rgba(40, 35, 55, 0.8);
                    border: 2px solid rgba(160, 128, 208, 0.4);
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 20px;
                    color: #a080d0;
                    cursor: pointer;
                    user-select: none;
                    -webkit-user-select: none;
                }
                
                .dpad-btn:active {
                    background: rgba(60, 50, 80, 0.9);
                    transform: scale(0.95);
                }
                
                .dpad-up { top: 0; left: 50%; transform: translateX(-50%); }
                .dpad-down { bottom: 0; left: 50%; transform: translateX(-50%); }
                .dpad-left { left: 0; top: 50%; transform: translateY(-50%); }
                .dpad-right { right: 0; top: 50%; transform: translateY(-50%); }
                
                .mobile-action {
                    position: fixed;
                    bottom: 100px;
                    right: 20px;
                    width: 70px;
                    height: 70px;
                    background: rgba(126, 184, 158, 0.8);
                    border: 3px solid rgba(126, 184, 158, 0.6);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-family: 'Cinzel', serif;
                    font-size: 14px;
                    font-weight: bold;
                    color: #0a0d12;
                    cursor: pointer;
                    z-index: 5600;
                    user-select: none;
                    -webkit-user-select: none;
                }
                
                .mobile-action:active {
                    transform: scale(0.95);
                    background: rgba(126, 184, 158, 1);
                }
            }
            
            @media (min-width: 769px) {
                .mobile-controls, .mobile-action {
                    display: none;
                }
            }
        `;
        document.head.appendChild(style);
    },
    
    createUI() {
        // Main adventure screen container
        const screen = document.createElement('div');
        screen.id = 'adventure-screen';
        screen.className = 'adventure-ui';
        screen.innerHTML = `
            <!-- Isometric canvas will be inserted here -->
            
            <!-- HUD -->
            <div class="adventure-hud">
                <div class="hud-left">
                    <div class="hud-stat">
                        <span class="icon">🏔️</span>
                        <span>Floor <span id="adv-floor">1</span></span>
                    </div>
                    <div class="hud-stat danger">
                        <span class="icon">☠️</span>
                        <span><span id="adv-deaths">0</span>/<span id="adv-max-deaths">10</span></span>
                    </div>
                    <div class="hud-stat">
                        <span class="icon">🔥</span>
                        <span id="adv-embers">0</span>
                    </div>
                    <div class="relics-bar" id="adv-relics"></div>
                </div>
                <div class="hud-right">
                    <div class="minimap-container" id="minimap-container">
                        <div class="minimap-title">Floor Map</div>
                        <div class="minimap-grid" id="minimap-grid"></div>
                        <div class="minimap-progress" id="minimap-progress">0/8 rooms</div>
                    </div>
                </div>
            </div>
            
            <!-- Dialogue System -->
            <div id="dialogue-overlay">
                <div id="dialogue-box">
                    <div id="dialogue-speaker"></div>
                    <div id="dialogue-text"></div>
                    <div id="dialogue-continue">Click or press any key to continue...</div>
                </div>
            </div>
            
            <!-- Deck/Relic Preview -->
            <div class="preview-overlay" id="preview-overlay">
                <div class="preview-card" id="preview-card">
                    <div class="preview-icon" id="preview-icon"></div>
                    <div class="preview-title" id="preview-title"></div>
                    <div class="preview-subtitle" id="preview-subtitle"></div>
                    <div class="preview-description" id="preview-description"></div>
                    <div class="preview-cards" id="preview-cards"></div>
                    <div class="preview-buttons">
                        <button class="preview-btn acquire" id="preview-acquire">Acquire</button>
                        <button class="preview-btn forsake" id="preview-forsake">Forsake</button>
                    </div>
                </div>
            </div>
            
            <!-- Exit Choice Panel -->
            <div class="exit-choice-overlay" id="exit-choice-overlay">
                <div class="exit-choice-panel">
                    <div class="exit-choice-title">Choose Your Path</div>
                    <div class="exit-options" id="exit-options"></div>
                    <div class="exit-cancel">
                        <button class="exit-cancel-btn" id="exit-cancel-btn">Stay Here</button>
                    </div>
                </div>
            </div>
            
            <!-- Mobile Controls -->
            <div class="mobile-controls">
                <div class="mobile-dpad">
                    <div class="dpad-btn dpad-up" data-dir="up">↑</div>
                    <div class="dpad-btn dpad-down" data-dir="down">↓</div>
                    <div class="dpad-btn dpad-left" data-dir="left">←</div>
                    <div class="dpad-btn dpad-right" data-dir="right">→</div>
                </div>
            </div>
            <div class="mobile-action" id="mobile-action-btn">ACT</div>
        `;
        
        document.body.appendChild(screen);
        this.container = screen;
        
        // Insert canvas
        IsometricEngine.init();
        screen.insertBefore(IsometricEngine.canvas, screen.firstChild);
    },
    
    bindEvents() {
        // Dialogue advancement - click anywhere on screen when dialogue is active
        document.addEventListener('click', (e) => {
            if (DialogueSystem.isActive) {
                // Don't trigger if clicking UI buttons
                if (e.target.closest('.preview-btn') || e.target.closest('.exit-option')) return;
                DialogueSystem.skip();
            }
        });
        
        document.addEventListener('keydown', (e) => {
            if (DialogueSystem.isActive && !e.repeat) {
                DialogueSystem.skip();
            }
        });
        
        // Preview buttons
        document.getElementById('preview-acquire').addEventListener('click', () => {
            this.acquireSelection();
        });
        
        document.getElementById('preview-forsake').addEventListener('click', () => {
            this.closePreview();
        });
        
        // Exit cancel
        document.getElementById('exit-cancel-btn').addEventListener('click', () => {
            document.getElementById('exit-choice-overlay').classList.remove('active');
        });
        
        // Mobile controls
        const dpadBtns = document.querySelectorAll('.dpad-btn');
        dpadBtns.forEach(btn => {
            const dir = btn.dataset.dir;
            
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                IsometricEngine.keys[dir] = true;
            });
            
            btn.addEventListener('touchend', (e) => {
                e.preventDefault();
                IsometricEngine.keys[dir] = false;
            });
            
            btn.addEventListener('mousedown', () => {
                IsometricEngine.keys[dir] = true;
            });
            
            btn.addEventListener('mouseup', () => {
                IsometricEngine.keys[dir] = false;
            });
        });
        
        document.getElementById('mobile-action-btn').addEventListener('click', () => {
            IsometricEngine.tryInteract();
        });
    },
    
    // ==================== GAME FLOW ====================
    
    async startAdventure() {
        console.log('[Adventure] Starting new adventure...');
        
        // Reset state
        AdventureState.reset();
        AdventureState.isActive = true;
        AdventureState.phase = 'awakening';
        
        // Show adventure screen first (makes it visible)
        this.show();
        
        // Now resize canvas (after it's visible and has dimensions)
        await new Promise(r => setTimeout(r, 50)); // Brief delay for DOM to update
        IsometricEngine.resizeCanvas();
        
        // Setup starting chamber
        IsometricEngine.setupStartingChamber();
        IsometricEngine.start();
        
        console.log('[Adventure] Engine started, canvas:', IsometricEngine.canvas.width, 'x', IsometricEngine.canvas.height);
        
        // Update HUD
        this.updateHUD();
        this.hideMinimapDuringSetup();
        
        // Opening dialogue sequence
        await DialogueSystem.show("You should not have come here...");
        
        await new Promise(r => setTimeout(r, 500));
        
        AdventureState.phase = 'deck_select';
        
        await DialogueSystem.showSequence([
            "Once trespassed, there is no departure. The darkness encroaches. You *will* die...",
            "However, you will be allowed some reprieve.",
            "Before you are the gatherings of souls of monsters. Choose which gathering you wish to defend you."
        ]);
    },
    
    hideMinimapDuringSetup() {
        document.getElementById('minimap-container').style.display = 'none';
    },
    
    showMinimap() {
        document.getElementById('minimap-container').style.display = 'block';
    },
    
    showDeckPreview(deck) {
        const overlay = document.getElementById('preview-overlay');
        
        document.getElementById('preview-icon').textContent = deck.icon;
        document.getElementById('preview-icon').style.color = '#a080d0';
        document.getElementById('preview-title').textContent = deck.name;
        document.getElementById('preview-subtitle').textContent = deck.theme;
        document.getElementById('preview-description').textContent = deck.description;
        
        // Show starter cards
        const cardsContainer = document.getElementById('preview-cards');
        cardsContainer.innerHTML = '';
        
        // Count cards
        const cardCounts = {};
        for (const cardId of deck.starterCards) {
            cardCounts[cardId] = (cardCounts[cardId] || 0) + 1;
        }
        
        for (const [cardId, count] of Object.entries(cardCounts)) {
            const cardEl = document.createElement('div');
            cardEl.className = 'preview-card-item';
            cardEl.textContent = count > 1 ? `${cardId} x${count}` : cardId;
            cardsContainer.appendChild(cardEl);
        }
        
        document.getElementById('preview-acquire').textContent = 'Acquire';
        
        this.selectedDeck = deck;
        this.previewType = 'deck';
        overlay.classList.add('active');
    },
    
    showRelicPreview(relic) {
        const overlay = document.getElementById('preview-overlay');
        
        document.getElementById('preview-icon').textContent = relic.sprite;
        document.getElementById('preview-icon').style.color = '#e8a93e';
        document.getElementById('preview-title').textContent = relic.name;
        document.getElementById('preview-subtitle').textContent = relic.rarity.charAt(0).toUpperCase() + relic.rarity.slice(1) + ' Relic';
        document.getElementById('preview-description').textContent = relic.description;
        document.getElementById('preview-cards').innerHTML = '';
        
        document.getElementById('preview-acquire').textContent = 'Acquire';
        
        this.selectedRelic = relic;
        this.previewType = 'relic';
        overlay.classList.add('active');
    },
    
    closePreview() {
        document.getElementById('preview-overlay').classList.remove('active');
    },
    
    async acquireSelection() {
        this.closePreview();
        
        if (this.previewType === 'deck' && AdventureState.phase === 'deck_select') {
            // Deck selected
            const deck = this.selectedDeck;
            AdventureState.selectedDeck = deck.id;
            AdventureState.deckArchetype = deck.id;
            AdventureState.starterCards = [...deck.starterCards];
            
            // Clear deck orbs and show relic selection
            AdventureState.phase = 'relic_select';
            
            await DialogueSystem.showSequence([
                "The souls of the harbingers have been assigned to you. They will do battle on your behalf, but only at your command.",
                "Now, select a reliquary with which you might be blessed or, perhaps, cursed."
            ]);
            
            IsometricEngine.setupRelicSelection();
            
        } else if (this.previewType === 'relic' && AdventureState.phase === 'relic_select') {
            // Relic selected
            const relic = RelicRegistry.getRelic(this.selectedRelic.id);
            if (relic) {
                AdventureState.relics.push(relic);
            }
            
            await DialogueSystem.show("A wise choice. Or not. The deed is done.");
            
            await DialogueSystem.showSequence([
                "Proceed into the darkness. Survive, combat it, or even conquer the void entirely. Be warned: If 10 of your acquired monsters die, you will *die*.",
                "If you perish, a sliver of your visage will be brought back when you are hungry for more."
            ]);
            
            // Generate floor and start exploring
            this.startFloor(1);
        } else {
            console.warn('[Acquire] No matching condition! previewType:', this.previewType, 'phase:', AdventureState.phase);
        }
    },
    
    startFloor(floorNum) {
        console.log(`[Adventure] Starting floor ${floorNum}`);
        
        // Generate floor map (starts with just the start room at 0,0)
        AdventureState.floorMap = FloorMapGenerator.generateFloor(floorNum);
        AdventureState.currentFloor = floorNum;
        
        const startRoomId = AdventureState.floorMap.startRoom; // '0,0'
        AdventureState.currentRoomId = startRoomId;
        AdventureState.visitedRooms = new Set([startRoomId]);
        AdventureState.revealedRooms = new Set([startRoomId]);
        
        // Setup start room (this will generate its exits)
        const startRoom = AdventureState.floorMap.rooms[startRoomId];
        IsometricEngine.setupRoom(startRoom);
        
        // Reveal adjacent rooms after exits are generated
        this.revealAdjacentRooms(startRoomId);
        
        // Update UI
        AdventureState.phase = 'exploring';
        this.showMinimap();
        this.updateHUD();
        this.updateMinimap();
    },
    
    revealAdjacentRooms(roomId) {
        const room = AdventureState.floorMap.rooms[roomId];
        if (!room || !room.exits) return;
        
        // New format: exits is an object { direction: targetRoomId }
        for (const [dir, targetId] of Object.entries(room.exits)) {
            if (targetId) {
                AdventureState.revealedRooms.add(targetId);
            }
        }
    },
    
    showExitChoice(exitObj) {
        const overlay = document.getElementById('exit-choice-overlay');
        const optionsContainer = document.getElementById('exit-options');
        optionsContainer.innerHTML = '';
        
        for (const targetId of exitObj.targetRooms) {
            const targetRoom = AdventureState.floorMap.rooms[targetId];
            if (!targetRoom) continue;
            
            const info = FloorMapGenerator.getRoomInfo(targetRoom.type);
            const isRevealed = AdventureState.revealedRooms.has(targetId);
            const hasVision = AdventureState.relics.some(r => r.effect?.roomVision);
            
            const option = document.createElement('div');
            option.className = 'exit-option';
            option.innerHTML = `
                <div class="room-icon">${isRevealed || hasVision ? info.icon : '❓'}</div>
                <div class="room-info">
                    <div class="room-name">${isRevealed || hasVision ? info.name : 'Unknown'}</div>
                    <div class="room-type">${targetRoom.cleared ? '(Cleared)' : ''}</div>
                </div>
            `;
            
            option.addEventListener('click', () => {
                this.moveToRoom(targetId);
                overlay.classList.remove('active');
            });
            
            optionsContainer.appendChild(option);
        }
        
        overlay.classList.add('active');
    },
    
    moveToRoom(roomId, fromDirection) {
        console.log(`[Adventure] Moving to room: ${roomId} from ${fromDirection || 'unknown'}`);
        
        const room = AdventureState.floorMap.rooms[roomId];
        if (!room) {
            console.error('[Adventure] Room not found:', roomId);
            return;
        }
        
        // Track if this is a new room (not visited before)
        const isNewRoom = !AdventureState.visitedRooms.has(roomId);
        
        AdventureState.currentRoomId = roomId;
        AdventureState.visitedRooms.add(roomId);
        
        // Increment rooms cleared if it's a new non-start room
        if (isNewRoom && room.type !== 'start') {
            AdventureState.floorMap.roomsCleared++;
            console.log(`[Adventure] Rooms cleared: ${AdventureState.floorMap.roomsCleared}/${FloorMapGenerator.roomsUntilBoss}`);
        }
        
        // Reveal adjacent rooms after entering
        this.revealAdjacentRooms(roomId);
        
        IsometricEngine.setupRoom(room);
        
        this.updateMinimap();
    },
    
    // ==================== ROOM INTERACTIONS ====================
    
    startBattle(roomData) {
        console.log('[Adventure] Starting battle...');
        // TODO: Integrate with existing battle system
        // For now, simulate victory
        setTimeout(() => {
            roomData.cleared = true;
            AdventureState.battlesWon++;
            AdventureState.embers += 50;
            this.updateHUD();
            IsometricEngine.setupRoom(roomData);
        }, 1000);
    },
    
    startBossBattle(roomData) {
        console.log('[Adventure] Starting boss battle...');
        // TODO: Integrate with existing battle system
        setTimeout(() => {
            roomData.cleared = true;
            AdventureState.floorsCompleted++;
            AdventureState.embers += 200;
            this.updateHUD();
            DialogueSystem.show("The guardian falls. The path to the next floor opens...");
            // TODO: Start next floor
        }, 1000);
    },
    
    openTreasure(roomData) {
        console.log('[Adventure] Opening treasure...');
        roomData.cleared = true;
        AdventureState.embers += 100;
        AdventureState.itemsFound++;
        this.updateHUD();
        IsometricEngine.setupRoom(roomData);
        DialogueSystem.show("You found 100 embers!");
    },
    
    openShop(roomData) {
        console.log('[Adventure] Opening shop...');
        DialogueSystem.show("The merchant's wares are not yet available...");
    },
    
    useRestSite(roomData) {
        console.log('[Adventure] Using rest site...');
        let healAmount = 2;
        
        // Apply healer's kit bonus
        for (const relic of AdventureState.relics) {
            if (relic.effect?.restBonus) {
                healAmount += relic.effect.restBonus;
            }
        }
        
        AdventureState.healDeaths(healAmount);
        this.updateHUD();
        DialogueSystem.show(`The sanctuary's light soothes your wounds. ${healAmount} deaths restored.`);
    },
    
    triggerEvent(roomData) {
        console.log('[Adventure] Triggering event...');
        roomData.cleared = true;
        
        // Random event outcome
        const roll = Math.random();
        if (roll < 0.5) {
            AdventureState.embers += 75;
            this.updateHUD();
            IsometricEngine.setupRoom(roomData);
            DialogueSystem.show("In the shadows, you find forgotten treasures. +75 embers.");
        } else if (roll < 0.8) {
            DialogueSystem.show("The mystery yields nothing of value. Continue on...");
            IsometricEngine.setupRoom(roomData);
        } else {
            AdventureState.addDeaths(1);
            this.updateHUD();
            IsometricEngine.setupRoom(roomData);
            DialogueSystem.show("A trap! One of your monsters perishes...");
        }
    },
    
    // ==================== UI UPDATES ====================
    
    updateHUD() {
        document.getElementById('adv-floor').textContent = AdventureState.currentFloor;
        document.getElementById('adv-deaths').textContent = AdventureState.deadCryptidCount;
        document.getElementById('adv-max-deaths').textContent = AdventureState.getMaxDeaths();
        document.getElementById('adv-embers').textContent = AdventureState.embers;
        
        // Update relics display
        const relicsContainer = document.getElementById('adv-relics');
        relicsContainer.innerHTML = '';
        
        for (const relic of AdventureState.relics) {
            const slot = document.createElement('div');
            slot.className = 'relic-slot';
            slot.title = `${relic.name}: ${relic.description}`;
            slot.textContent = relic.sprite;
            
            if (relic.maxUses !== undefined) {
                const uses = document.createElement('span');
                uses.className = 'uses';
                uses.textContent = relic.uses;
                slot.appendChild(uses);
            }
            
            relicsContainer.appendChild(slot);
        }
    },
    
    updateMinimap() {
        const grid = document.getElementById('minimap-grid');
        if (!AdventureState.floorMap) return;
        
        grid.innerHTML = '';
        
        const rooms = AdventureState.floorMap.rooms;
        const roomList = Object.values(rooms);
        
        // Find grid bounds (including negative coordinates)
        let minX = 0, maxX = 0, minY = 0, maxY = 0;
        for (const room of roomList) {
            if (room.x < minX) minX = room.x;
            if (room.x > maxX) maxX = room.x;
            if (room.y < minY) minY = room.y;
            if (room.y > maxY) maxY = room.y;
        }
        
        // Create a lookup map for quick room finding
        const roomMap = {};
        for (const room of roomList) {
            roomMap[`${room.x},${room.y}`] = room;
        }
        
        // Create rows (from minY to maxY, which may include negative y values)
        // Note: y decreases going "north", so we render from minY (top) to maxY (bottom)
        for (let y = minY; y <= maxY; y++) {
            const row = document.createElement('div');
            row.className = 'minimap-row';
            
            for (let x = minX; x <= maxX; x++) {
                const room = roomMap[`${x},${y}`];
                
                const cell = document.createElement('div');
                cell.className = 'minimap-room';
                
                if (room) {
                    const isVisited = AdventureState.visitedRooms.has(room.id);
                    const isRevealed = AdventureState.revealedRooms.has(room.id);
                    const isCurrent = room.id === AdventureState.currentRoomId;
                    
                    if (isCurrent) {
                        cell.classList.add('current');
                    } else if (isVisited) {
                        cell.classList.add('visited');
                    } else if (isRevealed) {
                        cell.classList.add('revealed');
                    } else {
                        cell.classList.add('hidden');
                    }
                    
                    if (isRevealed || isVisited) {
                        const info = FloorMapGenerator.getRoomInfo(room.type);
                        cell.textContent = info.icon;
                        cell.style.color = info.color;
                    }
                } else {
                    cell.classList.add('empty');
                }
                
                row.appendChild(cell);
            }
            
            grid.appendChild(row);
        }
        
        // Show progress toward boss
        const progress = AdventureState.floorMap.roomsCleared || 0;
        const needed = FloorMapGenerator.roomsUntilBoss;
        const progressText = document.getElementById('minimap-progress');
        if (progressText) {
            progressText.textContent = `${progress}/${needed} rooms`;
        }
    },
    
    show() {
        this.container.classList.add('active');
        
        // Hide other game elements
        const gameContainer = document.getElementById('game-container');
        if (gameContainer) gameContainer.style.display = 'none';
        
        const homeScreen = document.getElementById('home-screen');
        if (homeScreen) homeScreen.classList.add('hidden');
    },
    
    hide() {
        this.container.classList.remove('active');
        IsometricEngine.stop();
    }
};

// ==================== INITIALIZATION ====================

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Adventure Mode] DOM ready, initializing UI...');
    AdventureUI.init();
});

// Export for external access
window.startAdventure = () => AdventureUI.startAdventure();

console.log('[Adventure Mode] Isometric engine loaded successfully');

} catch (error) {
    console.error('[Adventure Mode] CRITICAL ERROR:', error);
}
