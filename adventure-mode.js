console.log('[Adventure Mode] SCRIPT FILE REACHED - Line 1');
/**
 * Cryptid Fates - Adventure Mode (Roguelite Sidescroller)
 * A survival horror themed exploration between card battles
 * 
 * Features:
 * - 2D sidescroller room-based exploration
 * - Persistent death counter across battles
 * - Relic system with passive effects
 * - 3 floors x 10 rooms + boss per floor
 * - Card discovery during runs
 */

// Early debug to confirm script is executing
console.log('[Adventure Mode] Script execution starting...');

// Wrap everything in a try-catch to catch any parsing/execution errors
try {

// ==================== ADVENTURE STATE ====================

window.AdventureState = {
    // Run state
    isActive: false,
    currentFloor: 1,
    currentRoom: 0,
    totalRoomsCleared: 0,
    
    // Player state
    deadCryptidCount: 0,      // Persistent deaths - lose if this hits threshold
    maxDeadCryptids: 10,      // Lose condition threshold
    selectedDeck: null,
    deckArchetype: null,      // 'city-of-flesh', 'forests-of-fear', etc.
    starterCards: [],         // The 15 starting cards
    discoveredCards: [],      // Cards found during the run
    
    // Relics
    relics: [],
    
    // Resources  
    embers: 0,                // Currency earned this run
    xpEarned: 0,
    
    // Floor map
    rooms: [],
    currentRoomData: null,
    
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
        this.deadCryptidCount = 0;
        this.selectedDeck = null;
        this.deckArchetype = null;
        this.starterCards = [];
        this.discoveredCards = [];
        this.relics = [];
        this.embers = 0;
        this.xpEarned = 0;
        this.rooms = [];
        this.currentRoomData = null;
        this.battlesWon = 0;
        this.battlesLost = 0;
        this.itemsFound = 0;
        this.floorsCompleted = 0;
    },
    
    // Calculate total allowed deaths (base + relic bonuses)
    getMaxDeaths() {
        let max = this.maxDeadCryptids;
        for (const relic of this.relics) {
            if (relic.effect?.maxDeathBonus) {
                max += relic.effect.maxDeathBonus;
            }
        }
        return max;
    },
    
    // Check if run is over (too many deaths)
    isDefeated() {
        return this.deadCryptidCount >= this.getMaxDeaths();
    },
    
    // Add deaths from a battle
    addDeaths(count) {
        this.deadCryptidCount += count;
        console.log(`[Adventure] Deaths: ${this.deadCryptidCount}/${this.getMaxDeaths()}`);
        return this.isDefeated();
    },
    
    // Heal deaths (from rest sites, relics, etc.)
    healDeaths(count) {
        this.deadCryptidCount = Math.max(0, this.deadCryptidCount - count);
        console.log(`[Adventure] Healed ${count} deaths. Now: ${this.deadCryptidCount}/${this.getMaxDeaths()}`);
    },
    
    // Get current deck for battle (starter + discovered)
    getBattleDeck() {
        return [...this.starterCards, ...this.discoveredCards];
    }
};

// ==================== RELIC SYSTEM ====================

window.RelicRegistry = {
    relics: {
        // === STARTER RELICS (pick 1 of 3) ===
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

// ==================== ROOM GENERATION ====================

window.RoomGenerator = {
    // Room type weights by floor progression
    weights: {
        battle: 35,
        battle_hard: 15,
        event: 15,
        treasure: 10,
        shop: 8,
        rest: 7,
        curse: 5,
        mystery: 5
    },
    
    // Room type definitions
    roomTypes: {
        'entrance': {
            type: 'entrance',
            name: 'Entrance',
            description: 'The journey begins...',
            background: 'entrance',
            canGoBack: false,
            encounter: null
        },
        'battle': {
            type: 'battle',
            name: 'Battle',
            description: 'Enemies await.',
            background: 'battle',
            encounter: 'normal'
        },
        'battle_hard': {
            type: 'battle_hard', 
            name: 'Elite Battle',
            description: 'A powerful foe blocks the path.',
            background: 'battle_elite',
            encounter: 'elite'
        },
        'boss': {
            type: 'boss',
            name: 'Boss',
            description: 'The floor guardian awaits.',
            background: 'boss',
            encounter: 'boss'
        },
        'event': {
            type: 'event',
            name: 'Strange Encounter',
            description: 'Something unusual...',
            background: 'event'
        },
        'treasure': {
            type: 'treasure',
            name: 'Treasure Room',
            description: 'Riches await the brave.',
            background: 'treasure'
        },
        'shop': {
            type: 'shop',
            name: 'Wandering Merchant',
            description: 'Trade your embers for power.',
            background: 'shop'
        },
        'rest': {
            type: 'rest',
            name: 'Safe Haven',
            description: 'A moment of respite.',
            background: 'rest'
        },
        'curse': {
            type: 'curse',
            name: 'Cursed Ground',
            description: 'Dark energy permeates...',
            background: 'curse'
        },
        'mystery': {
            type: 'mystery',
            name: '???',
            description: 'Unknown awaits.',
            background: 'mystery'
        }
    },
    
    // Generate a floor's worth of rooms
    generateFloor(floorNumber) {
        const rooms = [];
        const roomCount = 10;
        
        // First room is always entrance (except floor 1 which starts at entrance)
        rooms.push(this.createRoom('entrance', 0, floorNumber));
        
        // Track recent rooms to avoid repetition
        let recentTypes = [];
        let battleCount = 0;
        let shopPlaced = false;
        let restPlaced = false;
        
        // Generate middle rooms (1-8)
        for (let i = 1; i < roomCount - 1; i++) {
            let roomType = this.selectRoomType(recentTypes, i, floorNumber, {
                battleCount,
                shopPlaced,
                restPlaced
            });
            
            // Track for rules
            if (roomType === 'battle' || roomType === 'battle_hard') battleCount++;
            if (roomType === 'shop') shopPlaced = true;
            if (roomType === 'rest') restPlaced = true;
            
            recentTypes.push(roomType);
            if (recentTypes.length > 3) recentTypes.shift();
            
            rooms.push(this.createRoom(roomType, i, floorNumber));
        }
        
        // Last room before boss is always rest (to prepare)
        rooms.push(this.createRoom('rest', roomCount - 1, floorNumber));
        
        // Boss room
        rooms.push(this.createRoom('boss', roomCount, floorNumber));
        
        return rooms;
    },
    
    selectRoomType(recentTypes, roomIndex, floor, stats) {
        const weights = { ...this.weights };
        
        // Adjust weights based on rules
        
        // No more than 2 battles in a row
        const recentBattles = recentTypes.filter(t => t === 'battle' || t === 'battle_hard').length;
        if (recentBattles >= 2) {
            weights.battle = 0;
            weights.battle_hard = 0;
        }
        
        // Guarantee at least one shop per floor (rooms 3-7)
        if (!stats.shopPlaced && roomIndex >= 5 && roomIndex <= 7) {
            weights.shop += 30;
        }
        
        // Guarantee at least one rest per floor (rooms 4-8)
        if (!stats.restPlaced && roomIndex >= 6) {
            weights.rest += 25;
        }
        
        // More battles early, more events/treasure late
        if (roomIndex <= 3) {
            weights.battle += 15;
            weights.treasure -= 5;
        } else if (roomIndex >= 6) {
            weights.event += 10;
            weights.treasure += 5;
        }
        
        // Higher floors = harder battles
        if (floor >= 2) {
            weights.battle_hard += 10 * (floor - 1);
        }
        
        // No repeats of same type in a row
        if (recentTypes.length > 0) {
            const lastType = recentTypes[recentTypes.length - 1];
            weights[lastType] = Math.max(0, (weights[lastType] || 0) - 20);
        }
        
        // Calculate total and pick
        const total = Object.values(weights).reduce((a, b) => Math.max(0, a) + Math.max(0, b), 0);
        let roll = Math.random() * total;
        
        for (const [type, weight] of Object.entries(weights)) {
            if (weight <= 0) continue;
            roll -= weight;
            if (roll <= 0) return type;
        }
        
        return 'battle'; // Fallback
    },
    
    createRoom(type, index, floor) {
        const template = this.roomTypes[type] || this.roomTypes['battle'];
        
        // Entrance rooms start cleared (no encounter needed to proceed)
        const startsCleared = (type === 'entrance');
        
        return {
            ...template,
            id: `floor${floor}_room${index}`,
            index,
            floor,
            cleared: startsCleared,
            visited: startsCleared,
            interactables: this.generateInteractables(type, floor),
            rewards: this.generateRewards(type, floor)
        };
    },
    
    generateInteractables(type, floor) {
        const interactables = [];
        
        // Dig spots (random chance based on room type)
        const digChance = type === 'treasure' ? 0.8 : type === 'battle' ? 0.3 : 0.15;
        if (Math.random() < digChance) {
            interactables.push({
                type: 'dig_spot',
                x: 150 + Math.random() * 400,
                collected: false,
                reward: this.getDigReward(floor)
            });
        }
        
        // Chests in treasure rooms
        if (type === 'treasure') {
            interactables.push({
                type: 'chest',
                x: 350,
                collected: false,
                locked: Math.random() < 0.3,
                reward: { type: 'card', rarity: Math.random() < 0.3 ? 'rare' : 'common' }
            });
        }
        
        // Hidden traps in curse rooms
        if (type === 'curse') {
            interactables.push({
                type: 'trap',
                x: 200 + Math.random() * 300,
                triggered: false,
                damage: 1 + floor
            });
        }
        
        return interactables;
    },
    
    generateRewards(type, floor) {
        const baseEmbers = 10 + floor * 5;
        
        switch (type) {
            case 'battle':
                return { embers: baseEmbers + Math.floor(Math.random() * 10), xp: 15 };
            case 'battle_hard':
                return { embers: baseEmbers * 2, xp: 30, card: true };
            case 'boss':
                return { embers: baseEmbers * 5, xp: 100, relic: true };
            case 'treasure':
                return { embers: baseEmbers * 2, card: true };
            default:
                return { embers: Math.floor(baseEmbers / 2) };
        }
    },
    
    getDigReward(floor) {
        const roll = Math.random();
        if (roll < 0.4) return { type: 'embers', amount: 15 + floor * 10 };
        if (roll < 0.7) return { type: 'heal', amount: 1 };
        if (roll < 0.9) return { type: 'card', rarity: 'common' };
        return { type: 'curse', damage: 1 }; // Bad luck!
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
        // 15 starter cards
        starterCards: [
            'rooftopGargoyle', 'vampireInitiate', 'sewerAlligator',
            'hellpup', 'hellpup', 'myling', 'myling', 'vampireBat',
            'pyre', 'pyre', 'pyre', 'freshKill',
            'crossroads', 'wakingNightmare', 'antiVampiricBlade'
        ],
        // Full discovery pool
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

// ==================== SIDESCROLLER ENGINE ====================

window.AdventureEngine = {
    canvas: null,
    ctx: null,
    isRunning: false,
    lastTime: 0,
    
    // Player state
    player: {
        x: 100,
        y: 0,
        vx: 0,
        vy: 0,
        width: 50,
        height: 80,
        grounded: true,
        facing: 1, // 1 = right, -1 = left
        state: 'idle', // idle, walking, jumping, interacting
        interactTarget: null
    },
    
    // Room dimensions - will be set dynamically based on viewport
    room: {
        width: 1200,
        height: 600,
        groundY: 520
    },
    
    // Controls
    keys: {
        left: false,
        right: false,
        up: false,
        action: false
    },
    
    // Movement settings
    physics: {
        moveSpeed: 6,
        gravity: 0.6,
        jumpForce: -14,
        friction: 0.88
    },
    
    // Visual settings
    visuals: {
        fogOpacity: 0.7,
        ambientParticles: [],
        screenShake: 0
    },
    
    // Transition/encounter lock to prevent multiple triggers
    transitionLock: false,
    
    // ==================== INITIALIZATION ====================
    
    init() {
        this.createCanvas();
        this.bindControls();
        this.injectStyles();
    },
    
    createCanvas() {
        if (this.canvas) return;
        
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'adventure-canvas';
        this.ctx = this.canvas.getContext('2d');
        
        // Size canvas to fit viewport
        this.resizeCanvas();
        
        // Listen for resize
        window.addEventListener('resize', () => this.resizeCanvas());
    },
    
    resizeCanvas() {
        // Get available space (leave room for HUD)
        const maxWidth = Math.min(window.innerWidth - 40, 1400);
        const maxHeight = Math.min(window.innerHeight - 100, 800);
        
        // Maintain aspect ratio (roughly 2:1)
        const aspectRatio = 2;
        let width = maxWidth;
        let height = width / aspectRatio;
        
        if (height > maxHeight) {
            height = maxHeight;
            width = height * aspectRatio;
        }
        
        // Update canvas size
        this.canvas.width = width;
        this.canvas.height = height;
        
        // Update room dimensions to match
        this.room.width = width;
        this.room.height = height;
        this.room.groundY = height - 80; // Ground near bottom
        
        console.log('[Adventure] Canvas resized to', width, 'x', height);
    },
    
    bindControls() {
        // Keyboard
        window.addEventListener('keydown', (e) => {
            if (!AdventureState.isActive) return;
            switch (e.key.toLowerCase()) {
                case 'a':
                case 'arrowleft':
                    this.keys.left = true;
                    break;
                case 'd':
                case 'arrowright':
                    this.keys.right = true;
                    break;
                case 'w':
                case 'arrowup':
                case ' ':
                    this.keys.up = true;
                    break;
                case 'e':
                case 'enter':
                    this.keys.action = true;
                    this.handleInteraction();
                    break;
            }
        });
        
        window.addEventListener('keyup', (e) => {
            switch (e.key.toLowerCase()) {
                case 'a':
                case 'arrowleft':
                    this.keys.left = false;
                    break;
                case 'd':
                case 'arrowright':
                    this.keys.right = false;
                    break;
                case 'w':
                case 'arrowup':
                case ' ':
                    this.keys.up = false;
                    break;
                case 'e':
                case 'enter':
                    this.keys.action = false;
                    break;
            }
        });
    },
    
    injectStyles() {
        if (document.getElementById('adventure-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'adventure-styles';
        style.textContent = `
            /* Adventure Screen Container */
            #adventure-screen {
                position: fixed;
                inset: 0;
                z-index: 15000;
                background: linear-gradient(180deg, #0d0a08 0%, #0a0806 50%, #080604 100%);
                display: none;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                font-family: 'Cinzel', serif;
                padding: 20px;
                box-sizing: border-box;
            }
            
            #adventure-screen.open {
                display: flex;
            }
            
            /* Canvas Container */
            .adventure-viewport {
                position: relative;
                border: 3px solid rgba(232, 169, 62, 0.5);
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 
                    0 0 60px rgba(0, 0, 0, 0.9),
                    0 0 120px rgba(232, 169, 62, 0.1),
                    inset 0 0 80px rgba(0, 0, 0, 0.6);
                max-width: 100%;
                max-height: calc(100vh - 40px);
            }
            
            #adventure-canvas {
                display: block;
                image-rendering: auto;
                max-width: 100%;
                height: auto;
            }
            
            /* HUD Overlay */
            .adventure-hud {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                padding: 16px 24px;
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                pointer-events: none;
                background: linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, transparent 100%);
            }
            
            .adventure-hud > * {
                pointer-events: auto;
            }
            
            .hud-left, .hud-right {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            
            .hud-stat {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 18px;
                color: #e8e0d5;
                text-shadow: 0 2px 6px rgba(0,0,0,0.9);
                background: rgba(0,0,0,0.4);
                padding: 6px 14px;
                border-radius: 20px;
                border: 1px solid rgba(232, 169, 62, 0.3);
            }
            
            .hud-stat .icon {
                font-size: 20px;
            }
            
            .hud-stat.deaths .value {
                color: #ff6b6b;
                font-weight: bold;
            }
            
            .hud-stat.embers .value {
                color: #ffc107;
                font-weight: bold;
            }
            
            .floor-indicator {
                font-size: 14px;
                color: #c9b896;
                letter-spacing: 2px;
                text-transform: uppercase;
                padding: 4px 12px;
                background: rgba(0,0,0,0.3);
                border-radius: 4px;
            }
            
            /* Room info bar */
            .room-info-bar {
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                padding: 16px 24px;
                background: linear-gradient(0deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.5) 60%, transparent 100%);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .room-name {
                font-size: 22px;
                color: #e8a93e;
                text-shadow: 0 2px 8px rgba(0,0,0,0.9), 0 0 20px rgba(232, 169, 62, 0.3);
                text-transform: uppercase;
                letter-spacing: 3px;
                font-weight: bold;
            }
            
            .room-hint {
                font-size: 14px;
                color: #b8a888;
                background: rgba(0,0,0,0.4);
                padding: 8px 16px;
                border-radius: 20px;
                border: 1px solid rgba(232, 169, 62, 0.2);
            }
            
            /* Relics display */
            .relics-bar {
                position: absolute;
                top: 50px;
                left: 10px;
                display: flex;
                gap: 5px;
            }
            
            .relic-icon {
                width: 32px;
                height: 32px;
                background: rgba(0,0,0,0.6);
                border: 1px solid rgba(232, 169, 62, 0.4);
                border-radius: 6px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .relic-icon:hover {
                transform: scale(1.1);
                border-color: #e8a93e;
            }
            
            .relic-icon .uses {
                position: absolute;
                bottom: -2px;
                right: -2px;
                background: #e8a93e;
                color: #0a0806;
                font-size: 10px;
                padding: 0 4px;
                border-radius: 3px;
            }
            
            /* Touch controls */
            .touch-controls {
                position: absolute;
                bottom: 60px;
                left: 10px;
                right: 10px;
                display: none;
                justify-content: space-between;
                pointer-events: none;
            }
            
            .touch-controls > * {
                pointer-events: auto;
            }
            
            @media (hover: none) and (pointer: coarse) {
                .touch-controls {
                    display: flex;
                }
            }
            
            .touch-btn {
                width: 50px;
                height: 50px;
                background: rgba(232, 169, 62, 0.3);
                border: 2px solid rgba(232, 169, 62, 0.5);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
                color: #e8e0d5;
                user-select: none;
                -webkit-user-select: none;
            }
            
            .touch-btn:active {
                background: rgba(232, 169, 62, 0.5);
            }
            
            .touch-dpad {
                display: flex;
                gap: 5px;
            }
            
            /* Interaction prompt */
            .interact-prompt {
                position: absolute;
                padding: 8px 16px;
                background: rgba(0,0,0,0.8);
                border: 1px solid #e8a93e;
                border-radius: 6px;
                color: #e8e0d5;
                font-size: 12px;
                transform: translateX(-50%);
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.2s;
            }
            
            .interact-prompt.show {
                opacity: 1;
            }
            
            /* Room transition overlay */
            .room-transition {
                position: absolute;
                inset: 0;
                background: #0a0806;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.3s;
            }
            
            .room-transition.active {
                opacity: 1;
                pointer-events: auto;
            }
            
            /* ==================== SELECTION SCREENS ==================== */
            
            #adventure-setup {
                position: fixed;
                inset: 0;
                z-index: 15001;
                background: #0a0806;
                display: none;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 20px;
                overflow-y: auto;
            }
            
            #adventure-setup.open {
                display: flex;
            }
            
            .setup-container {
                max-width: 800px;
                width: 100%;
                text-align: center;
            }
            
            .setup-title {
                font-size: 28px;
                color: #e8a93e;
                margin-bottom: 10px;
                text-shadow: 0 0 20px rgba(232, 169, 62, 0.5);
            }
            
            .setup-subtitle {
                font-size: 14px;
                color: #a89070;
                margin-bottom: 30px;
            }
            
            /* Deck Selection */
            .deck-options {
                display: flex;
                gap: 20px;
                justify-content: center;
                flex-wrap: wrap;
                margin-bottom: 30px;
            }
            
            .deck-option {
                width: 200px;
                padding: 20px;
                background: rgba(20, 15, 10, 0.9);
                border: 2px solid rgba(232, 169, 62, 0.3);
                border-radius: 12px;
                cursor: pointer;
                transition: all 0.3s;
                text-align: center;
            }
            
            .deck-option:hover {
                border-color: rgba(232, 169, 62, 0.6);
                transform: translateY(-5px);
            }
            
            .deck-option.selected {
                border-color: #e8a93e;
                background: rgba(232, 169, 62, 0.1);
                box-shadow: 0 0 30px rgba(232, 169, 62, 0.3);
            }
            
            .deck-option.locked {
                opacity: 0.5;
                pointer-events: none;
            }
            
            .deck-option .icon {
                font-size: 48px;
                margin-bottom: 10px;
            }
            
            .deck-option .name {
                font-size: 16px;
                color: #e8e0d5;
                margin-bottom: 5px;
            }
            
            .deck-option .theme {
                font-size: 11px;
                color: #8a7a6a;
            }
            
            /* Relic Selection */
            .relic-options {
                display: flex;
                gap: 20px;
                justify-content: center;
                flex-wrap: wrap;
                margin-bottom: 30px;
            }
            
            .relic-option {
                width: 180px;
                padding: 20px;
                background: rgba(20, 15, 10, 0.9);
                border: 2px solid rgba(150, 100, 200, 0.3);
                border-radius: 12px;
                cursor: pointer;
                transition: all 0.3s;
                text-align: center;
            }
            
            .relic-option:hover {
                border-color: rgba(150, 100, 200, 0.6);
                transform: translateY(-5px);
            }
            
            .relic-option.selected {
                border-color: #a080d0;
                background: rgba(150, 100, 200, 0.1);
                box-shadow: 0 0 30px rgba(150, 100, 200, 0.3);
            }
            
            .relic-option .icon {
                font-size: 36px;
                margin-bottom: 10px;
            }
            
            .relic-option .name {
                font-size: 14px;
                color: #e8e0d5;
                margin-bottom: 5px;
            }
            
            .relic-option .desc {
                font-size: 11px;
                color: #a89070;
                line-height: 1.4;
            }
            
            /* Setup buttons */
            .setup-btn {
                padding: 15px 40px;
                font-family: 'Cinzel', serif;
                font-size: 16px;
                background: linear-gradient(180deg, #b85020 0%, #702810 100%);
                border: none;
                color: #ffeedd;
                cursor: pointer;
                border-radius: 8px;
                transition: all 0.3s;
                margin: 10px;
            }
            
            .setup-btn:hover {
                transform: translateY(-3px);
                box-shadow: 0 8px 30px rgba(255, 80, 20, 0.4);
            }
            
            .setup-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
                transform: none;
            }
            
            .setup-btn.secondary {
                background: rgba(100, 80, 60, 0.5);
                border: 1px solid rgba(232, 169, 62, 0.3);
            }
            
            /* ==================== DEFEAT/VICTORY SCREEN ==================== */
            
            #adventure-results {
                position: fixed;
                inset: 0;
                z-index: 15002;
                background: rgba(10, 8, 6, 0.95);
                display: none;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }
            
            #adventure-results.open {
                display: flex;
            }
            
            .results-container {
                max-width: 500px;
                width: 100%;
                text-align: center;
            }
            
            .results-banner {
                font-size: 36px;
                margin-bottom: 10px;
                text-shadow: 0 0 30px currentColor;
            }
            
            .results-banner.victory {
                color: #e8a93e;
            }
            
            .results-banner.defeat {
                color: #e57373;
            }
            
            .results-subtitle {
                font-size: 14px;
                color: #a89070;
                margin-bottom: 30px;
            }
            
            .results-stats {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 15px;
                margin-bottom: 30px;
                text-align: left;
            }
            
            .result-stat {
                display: flex;
                justify-content: space-between;
                padding: 10px 15px;
                background: rgba(0,0,0,0.4);
                border-radius: 6px;
            }
            
            .result-stat .label {
                color: #a89070;
            }
            
            .result-stat .value {
                color: #e8e0d5;
                font-weight: bold;
            }
            
            .results-rewards {
                background: rgba(232, 169, 62, 0.1);
                border: 1px solid rgba(232, 169, 62, 0.3);
                border-radius: 8px;
                padding: 20px;
                margin-bottom: 30px;
            }
            
            .rewards-title {
                font-size: 14px;
                color: #e8a93e;
                margin-bottom: 15px;
            }
            
            .reward-row {
                display: flex;
                justify-content: center;
                gap: 30px;
            }
            
            .reward-item {
                text-align: center;
            }
            
            .reward-item .icon {
                font-size: 24px;
                margin-bottom: 5px;
            }
            
            .reward-item .amount {
                font-size: 18px;
                color: #e8e0d5;
                font-weight: bold;
            }
            
            .reward-item .label {
                font-size: 11px;
                color: #a89070;
            }
            
            /* ==================== EVENT MODAL ==================== */
            
            .adventure-event-modal {
                position: fixed;
                inset: 0;
                z-index: 16000;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.3s ease;
            }
            
            .adventure-event-modal.open {
                opacity: 1;
                pointer-events: auto;
            }
            
            .event-backdrop {
                position: absolute;
                inset: 0;
                background: rgba(0, 0, 0, 0.85);
                backdrop-filter: blur(8px);
            }
            
            .event-content {
                position: relative;
                max-width: 500px;
                width: 90%;
                background: linear-gradient(180deg, #1a1510 0%, #0d0a08 100%);
                border: 2px solid rgba(232, 169, 62, 0.5);
                border-radius: 16px;
                padding: 32px;
                text-align: center;
                box-shadow: 
                    0 0 60px rgba(0, 0, 0, 0.8),
                    0 0 100px rgba(232, 169, 62, 0.15),
                    inset 0 1px 0 rgba(255, 255, 255, 0.05);
                transform: scale(0.9) translateY(20px);
                transition: transform 0.3s ease;
            }
            
            .adventure-event-modal.open .event-content {
                transform: scale(1) translateY(0);
            }
            
            .event-icon {
                font-size: 64px;
                margin-bottom: 16px;
                filter: drop-shadow(0 4px 20px rgba(232, 169, 62, 0.4));
                animation: eventIconFloat 3s ease-in-out infinite;
            }
            
            @keyframes eventIconFloat {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-8px); }
            }
            
            .event-title {
                font-family: 'Cinzel', serif;
                font-size: 28px;
                color: #e8a93e;
                margin: 0 0 16px 0;
                text-shadow: 0 2px 10px rgba(232, 169, 62, 0.5);
            }
            
            .event-text {
                font-size: 16px;
                color: #c9b896;
                line-height: 1.6;
                margin: 0 0 28px 0;
            }
            
            .event-choices {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }
            
            .event-choice {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 4px;
                padding: 16px 24px;
                background: linear-gradient(180deg, rgba(232, 169, 62, 0.15) 0%, rgba(232, 169, 62, 0.05) 100%);
                border: 1px solid rgba(232, 169, 62, 0.3);
                border-radius: 10px;
                cursor: pointer;
                transition: all 0.2s ease;
                font-family: 'Cinzel', serif;
            }
            
            .event-choice:hover:not(:disabled) {
                background: linear-gradient(180deg, rgba(232, 169, 62, 0.25) 0%, rgba(232, 169, 62, 0.1) 100%);
                border-color: rgba(232, 169, 62, 0.6);
                transform: translateY(-2px);
                box-shadow: 0 4px 20px rgba(232, 169, 62, 0.2);
            }
            
            .event-choice:active:not(:disabled) {
                transform: translateY(0);
            }
            
            .event-choice:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            .event-choice.selected {
                background: linear-gradient(180deg, rgba(232, 169, 62, 0.35) 0%, rgba(232, 169, 62, 0.15) 100%);
                border-color: #e8a93e;
                box-shadow: 0 0 20px rgba(232, 169, 62, 0.3);
            }
            
            .choice-text {
                font-size: 16px;
                color: #e8e0d5;
            }
            
            .choice-subtext {
                font-size: 12px;
                color: #8a7a6a;
                font-family: 'Source Sans Pro', sans-serif;
            }
            
            .event-result {
                margin-top: 20px;
                padding: 16px 20px;
                border-radius: 8px;
                font-size: 15px;
                opacity: 0;
                transform: translateY(10px);
                transition: all 0.3s ease;
            }
            
            .event-result.show {
                opacity: 1;
                transform: translateY(0);
            }
            
            .event-result.success {
                background: rgba(74, 222, 128, 0.15);
                border: 1px solid rgba(74, 222, 128, 0.4);
                color: #4ade80;
            }
            
            .event-result.failure {
                background: rgba(239, 68, 68, 0.15);
                border: 1px solid rgba(239, 68, 68, 0.4);
                color: #ef4444;
            }
            
            /* ==================== SHOP MODAL ==================== */
            
            .adventure-shop-modal {
                position: fixed;
                inset: 0;
                z-index: 16000;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.3s ease;
            }
            
            .adventure-shop-modal.open {
                opacity: 1;
                pointer-events: auto;
            }
            
            .shop-backdrop {
                position: absolute;
                inset: 0;
                background: rgba(0, 0, 0, 0.9);
                backdrop-filter: blur(8px);
            }
            
            .shop-content {
                position: relative;
                max-width: 550px;
                width: 92%;
                background: linear-gradient(180deg, #1c1815 0%, #0f0c0a 100%);
                border: 2px solid rgba(139, 90, 43, 0.6);
                border-radius: 16px;
                padding: 28px;
                box-shadow: 
                    0 0 80px rgba(0, 0, 0, 0.9),
                    0 0 40px rgba(139, 90, 43, 0.2),
                    inset 0 1px 0 rgba(255, 255, 255, 0.05);
                transform: scale(0.9) translateY(20px);
                transition: transform 0.3s ease;
            }
            
            .adventure-shop-modal.open .shop-content {
                transform: scale(1) translateY(0);
            }
            
            .shop-header {
                text-align: center;
                margin-bottom: 20px;
            }
            
            .shop-icon {
                font-size: 48px;
                display: block;
                margin-bottom: 8px;
            }
            
            .shop-title {
                font-family: 'Cinzel', serif;
                font-size: 26px;
                color: #d4a857;
                margin: 0;
                text-shadow: 0 2px 10px rgba(212, 168, 87, 0.4);
            }
            
            .shop-subtitle {
                font-size: 14px;
                color: #8a7a6a;
                font-style: italic;
                margin: 8px 0 0 0;
            }
            
            .shop-balance {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                padding: 12px 20px;
                background: rgba(0, 0, 0, 0.4);
                border-radius: 30px;
                margin-bottom: 20px;
                border: 1px solid rgba(232, 169, 62, 0.3);
            }
            
            .balance-icon {
                font-size: 20px;
            }
            
            .balance-amount {
                font-size: 24px;
                font-weight: bold;
                color: #ffc107;
            }
            
            .balance-label {
                font-size: 14px;
                color: #8a7a6a;
            }
            
            .shop-items {
                display: flex;
                flex-direction: column;
                gap: 12px;
                margin-bottom: 16px;
            }
            
            .shop-item {
                display: flex;
                align-items: center;
                gap: 16px;
                padding: 16px;
                background: linear-gradient(90deg, rgba(139, 90, 43, 0.1) 0%, rgba(139, 90, 43, 0.05) 100%);
                border: 1px solid rgba(139, 90, 43, 0.3);
                border-radius: 10px;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .shop-item:hover:not(.unaffordable):not(.purchased) {
                background: linear-gradient(90deg, rgba(139, 90, 43, 0.2) 0%, rgba(139, 90, 43, 0.1) 100%);
                border-color: rgba(212, 168, 87, 0.5);
                transform: translateX(4px);
            }
            
            .shop-item.unaffordable {
                opacity: 0.4;
                cursor: not-allowed;
            }
            
            .shop-item.purchased {
                background: rgba(74, 222, 128, 0.1);
                border-color: rgba(74, 222, 128, 0.3);
                justify-content: center;
            }
            
            .purchased-text {
                color: #4ade80;
                font-size: 16px;
            }
            
            .item-icon {
                font-size: 36px;
                flex-shrink: 0;
            }
            
            .item-info {
                flex: 1;
                text-align: left;
            }
            
            .item-name {
                font-family: 'Cinzel', serif;
                font-size: 16px;
                color: #e8e0d5;
                margin-bottom: 4px;
            }
            
            .item-desc {
                font-size: 12px;
                color: #8a7a6a;
                margin-bottom: 4px;
            }
            
            .item-effect {
                font-size: 13px;
                color: #4ade80;
            }
            
            .item-price {
                display: flex;
                align-items: center;
                gap: 4px;
                padding: 8px 14px;
                background: rgba(0, 0, 0, 0.4);
                border-radius: 20px;
                flex-shrink: 0;
            }
            
            .price-amount {
                font-size: 18px;
                font-weight: bold;
                color: #ffc107;
            }
            
            .price-icon {
                font-size: 14px;
            }
            
            .shop-result {
                text-align: center;
                padding: 12px;
                color: #4ade80;
                font-size: 14px;
                opacity: 0;
                transition: opacity 0.3s;
            }
            
            .shop-result.show {
                opacity: 1;
            }
            
            .shop-leave {
                width: 100%;
                padding: 14px;
                background: linear-gradient(180deg, #3a3530 0%, #2a2520 100%);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                color: #a89070;
                font-family: 'Cinzel', serif;
                font-size: 15px;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .shop-leave:hover {
                background: linear-gradient(180deg, #4a4540 0%, #3a3530 100%);
                color: #e8e0d5;
            }
        `;
        document.head.appendChild(style);
    },
    
    // ==================== GAME LOOP ====================
    
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastTime = performance.now();
        
        // Make sure canvas is sized
        this.resizeCanvas();
        
        // Position player on ground
        this.player.x = 100;
        this.player.y = this.room.groundY - this.player.height;
        this.player.vx = 0;
        this.player.vy = 0;
        this.player.grounded = true;
        this.player.state = 'idle';
        
        // Reset transition lock
        this.transitionLock = false;
        
        console.log('[Adventure] Starting game loop. Ground at', this.room.groundY, 'Player at', this.player.y);
        this.gameLoop();
    },
    
    stop() {
        this.isRunning = false;
    },
    
    gameLoop(currentTime = performance.now()) {
        if (!this.isRunning) return;
        
        const deltaTime = (currentTime - this.lastTime) / 16.67; // Normalize to ~60fps
        this.lastTime = currentTime;
        
        this.update(deltaTime);
        this.render();
        
        requestAnimationFrame((t) => this.gameLoop(t));
    },
    
    update(dt) {
        // Apply speed bonus from relics
        let speedMultiplier = 1;
        for (const relic of AdventureState.relics) {
            if (relic.effect?.speedBonus) {
                speedMultiplier += relic.effect.speedBonus;
            }
        }
        
        const moveSpeed = this.physics.moveSpeed * speedMultiplier;
        
        // Horizontal movement
        if (this.keys.left) {
            this.player.vx = -moveSpeed;
            this.player.facing = -1;
            this.player.state = 'walking';
        } else if (this.keys.right) {
            this.player.vx = moveSpeed;
            this.player.facing = 1;
            this.player.state = 'walking';
        } else {
            this.player.vx *= this.physics.friction;
            if (Math.abs(this.player.vx) < 0.1) {
                this.player.vx = 0;
                if (this.player.grounded) {
                    this.player.state = 'idle';
                }
            }
        }
        
        // Jumping - only when grounded and up key pressed
        if (this.keys.up && this.player.grounded) {
            this.player.vy = this.physics.jumpForce;
            this.player.grounded = false;
            this.player.state = 'jumping';
            console.log('[Adventure] Jump!');
        }
        
        // Apply gravity
        if (!this.player.grounded) {
            this.player.vy += this.physics.gravity * dt;
        }
        
        // Apply velocity
        this.player.x += this.player.vx * dt;
        this.player.y += this.player.vy * dt;
        
        // Ground collision
        const groundLevel = this.room.groundY - this.player.height;
        if (this.player.y >= groundLevel) {
            this.player.y = groundLevel;
            this.player.vy = 0;
            this.player.grounded = true;
            if (this.player.state === 'jumping') {
                this.player.state = 'idle';
            }
        } else {
            this.player.grounded = false;
        }
        
        // Boundary checks / room transitions
        if (this.player.x < -30) {
            // Exit left - go back (if allowed)
            this.tryExitLeft();
        } else if (this.player.x > this.room.width - this.player.width - 30) {
            // Exit right - advance to next room
            this.tryExitRight();
        }
        
        // Clamp position (but allow slight overshoot for transition feel)
        this.player.x = Math.max(-10, Math.min(this.room.width - this.player.width + 10, this.player.x));
        
        // Check for nearby interactables
        this.updateInteractables();
        
        // Update ambient particles
        this.updateParticles(dt);
    },
    
    updateInteractables() {
        if (!AdventureState.currentRoomData) return;
        
        this.player.interactTarget = null;
        const interactables = AdventureState.currentRoomData.interactables || [];
        
        for (const item of interactables) {
            if (item.collected || item.triggered) continue;
            
            const dx = Math.abs((this.player.x + this.player.width / 2) - item.x);
            if (dx < 50) {
                this.player.interactTarget = item;
                break;
            }
        }
        
        // Update prompt visibility
        this.updateInteractPrompt();
    },
    
    updateInteractPrompt() {
        const prompt = document.querySelector('.interact-prompt');
        if (!prompt) return;
        
        if (this.player.interactTarget) {
            const item = this.player.interactTarget;
            let text = '[E] ';
            
            switch (item.type) {
                case 'dig_spot':
                    const hasShovel = AdventureState.relics.some(r => r.effect?.canDig && r.uses > 0);
                    text += hasShovel ? 'Dig' : 'Need Shovel';
                    break;
                case 'chest':
                    text += item.locked ? 'Locked Chest' : 'Open Chest';
                    break;
                case 'door':
                    text += 'Enter';
                    break;
                default:
                    text += 'Interact';
            }
            
            prompt.textContent = text;
            prompt.style.left = `${item.x}px`;
            prompt.style.bottom = '100px';
            prompt.classList.add('show');
        } else {
            prompt.classList.remove('show');
        }
    },
    
    handleInteraction() {
        const target = this.player.interactTarget;
        if (!target) return;
        
        switch (target.type) {
            case 'dig_spot':
                this.handleDig(target);
                break;
            case 'chest':
                this.handleChest(target);
                break;
            case 'door':
                this.handleDoor(target);
                break;
            case 'trap':
                this.handleTrap(target);
                break;
        }
    },
    
    handleDig(spot) {
        // Check for shovel relic with uses
        const shovel = AdventureState.relics.find(r => r.effect?.canDig && r.uses > 0);
        if (!shovel) {
            AdventureUI.showMessage('You need a shovel to dig here.');
            return;
        }
        
        shovel.uses--;
        spot.collected = true;
        AdventureState.itemsFound++;
        
        // Apply reward
        const reward = spot.reward;
        if (reward.type === 'embers') {
            AdventureState.embers += reward.amount;
            AdventureUI.showMessage(`Found ${reward.amount} embers!`);
        } else if (reward.type === 'heal') {
            AdventureState.healDeaths(reward.amount);
            AdventureUI.showMessage(`Healed ${reward.amount} death(s)!`);
        } else if (reward.type === 'card') {
            this.grantRandomCard(reward.rarity);
        } else if (reward.type === 'curse') {
            AdventureState.addDeaths(reward.damage);
            AdventureUI.showMessage('Cursed! You take damage.');
        }
        
        AdventureUI.updateHUD();
    },
    
    handleChest(chest) {
        if (chest.locked) {
            AdventureUI.showMessage('This chest is locked...');
            return;
        }
        
        chest.collected = true;
        AdventureState.itemsFound++;
        
        if (chest.reward.type === 'card') {
            this.grantRandomCard(chest.reward.rarity);
        }
        
        AdventureUI.updateHUD();
    },
    
    handleTrap(trap) {
        if (trap.triggered) return;
        trap.triggered = true;
        
        AdventureState.addDeaths(trap.damage);
        AdventureUI.showMessage(`Trap! ${trap.damage} death(s) added.`);
        AdventureUI.updateHUD();
        
        if (AdventureState.isDefeated()) {
            this.endRun(false);
        }
    },
    
    handleDoor(door) {
        // Door to specific encounter/room type
        if (door.destination) {
            this.enterEncounter(door.destination);
        }
    },
    
    grantRandomCard(rarity) {
        const pool = AdventureState.deckArchetype ? 
            StarterDecks[AdventureState.deckArchetype]?.discoveryPool : null;
        
        if (!pool) return;
        
        // Combine all discoverable cards
        const allCards = [
            ...pool.cryptids,
            ...pool.kindling,
            ...pool.spells,
            ...pool.pyres
        ].filter(c => c); // Remove empty
        
        if (allCards.length === 0) return;
        
        const cardKey = allCards[Math.floor(Math.random() * allCards.length)];
        AdventureState.discoveredCards.push(cardKey);
        
        // Get card name for display
        const card = CardRegistry?.getCryptid(cardKey) || 
                    CardRegistry?.getBurst(cardKey) ||
                    CardRegistry?.getTrap(cardKey) ||
                    CardRegistry?.getAura(cardKey) ||
                    CardRegistry?.getPyre(cardKey) ||
                    CardRegistry?.getKindling(cardKey);
        
        const name = card?.name || cardKey;
        AdventureUI.showMessage(`Discovered: ${name}!`);
    },
    
    tryExitLeft() {
        // Can't go back in adventure mode - just block movement
        this.player.x = 10;
        // Only show message once
        if (!this._leftBlockedMessageShown) {
            AdventureUI.showMessage("The path behind has collapsed...");
            this._leftBlockedMessageShown = true;
            setTimeout(() => { this._leftBlockedMessageShown = false; }, 3000);
        }
    },
    
    tryExitRight() {
        // Prevent multiple triggers
        if (this.transitionLock) {
            return;
        }
        
        const room = AdventureState.currentRoomData;
        if (!room) {
            console.log('[Adventure] No room data, advancing anyway');
            this.transitionLock = true;
            this.advanceRoom();
            return;
        }
        
        console.log('[Adventure] Trying to exit right. Room:', room.name, 'Encounter:', room.encounter, 'Cleared:', room.cleared);
        
        // If room has an encounter that hasn't been cleared, trigger it
        if (room.encounter && !room.cleared) {
            console.log('[Adventure] Entering encounter...');
            this.transitionLock = true;
            this.enterEncounter(room);
            return;
        }
        
        // For non-combat rooms without encounters, mark as cleared
        if (!room.encounter && !room.cleared) {
            room.cleared = true;
        }
        
        // Advance to next room
        console.log('[Adventure] Advancing to next room...');
        this.transitionLock = true;
        this.advanceRoom();
    },
    
    enterEncounter(room) {
        // Check if already started this encounter
        if (room.encounterStarted) {
            console.log('[Adventure] Encounter already started, skipping');
            return;
        }
        
        const encounterType = room.encounter;
        
        // Mark as started immediately
        room.encounterStarted = true;
        
        if (encounterType === 'normal' || encounterType === 'elite') {
            // Start a battle
            AdventureUI.showMessage('Battle begins!');
            setTimeout(() => {
                this.startBattle(encounterType);
            }, 500);
        } else if (encounterType === 'boss') {
            AdventureUI.showMessage('Boss battle!');
            setTimeout(() => {
                this.startBattle('boss');
            }, 500);
        }
    },
    
    startBattle(type) {
        // Ensure lock is set
        this.transitionLock = true;
        
        this.stop();
        
        // Mark the room's encounter as in-progress to prevent re-triggers
        if (AdventureState.currentRoomData) {
            AdventureState.currentRoomData.encounterStarted = true;
        }
        
        // Prepare deck from adventure state
        const deckCards = AdventureState.getBattleDeck();
        
        // Build the deck object for the game
        window.selectedPlayerDeck = {
            name: 'Adventure Deck',
            cards: deckCards.map(cardKey => ({ cardKey }))
        };
        
        // Set adventure battle flags
        window.isAdventureBattle = true;
        window.adventureBattleType = type;
        
        // Apply relic effects
        window.adventureRelicEffects = {};
        for (const relic of AdventureState.relics) {
            if (relic.effect?.startingPyre) {
                window.adventureRelicEffects.startingPyre = (window.adventureRelicEffects.startingPyre || 0) + relic.effect.startingPyre;
            }
            if (relic.effect?.extraDraw) {
                window.adventureRelicEffects.extraDraw = (window.adventureRelicEffects.extraDraw || 0) + relic.effect.extraDraw;
            }
            if (relic.effect?.deathShield) {
                window.adventureRelicEffects.deathShield = (window.adventureRelicEffects.deathShield || 0) + relic.effect.deathShield;
            }
        }
        
        // Store current deaths to track new ones
        window.adventureDeathsBefore = AdventureState.deadCryptidCount;
        
        // Hide adventure screen
        document.getElementById('adventure-screen').classList.remove('open');
        
        // Show game container and start battle
        document.getElementById('game-container').style.display = 'flex';
        
        if (typeof applyBattlefieldBackgrounds === 'function') {
            applyBattlefieldBackgrounds();
        }
        
        // Short delay then init game
        setTimeout(() => {
            if (typeof initGame === 'function') {
                initGame();
            }
        }, 100);
    },
    
    // Called when battle ends
    onBattleEnd(isWin, playerDeaths) {
        // Add deaths from battle to adventure total
        const newDeaths = playerDeaths;
        
        // Apply death shield relic
        let shieldedDeaths = 0;
        const shield = window.adventureRelicEffects?.deathShield || 0;
        if (shield > 0 && newDeaths > 0) {
            shieldedDeaths = Math.min(shield, newDeaths);
        }
        
        const actualDeaths = newDeaths - shieldedDeaths;
        
        if (actualDeaths > 0) {
            AdventureState.addDeaths(actualDeaths);
        }
        
        if (shieldedDeaths > 0) {
            console.log(`[Adventure] Death shield blocked ${shieldedDeaths} death(s)`);
        }
        
        if (isWin) {
            AdventureState.battlesWon++;
            AdventureState.currentRoomData.cleared = true;
            
            // Grant rewards
            const rewards = AdventureState.currentRoomData.rewards || {};
            if (rewards.embers) {
                let emberAmount = rewards.embers;
                // Apply ember bonus relic
                for (const relic of AdventureState.relics) {
                    if (relic.effect?.emberBonus) {
                        emberAmount = Math.floor(emberAmount * (1 + relic.effect.emberBonus));
                    }
                }
                AdventureState.embers += emberAmount;
            }
            if (rewards.xp) {
                AdventureState.xpEarned += rewards.xp;
            }
            if (rewards.card) {
                this.grantRandomCard('common');
            }
        } else {
            AdventureState.battlesLost++;
        }
        
        // Clean up battle flags
        window.isAdventureBattle = false;
        window.adventureBattleType = null;
        window.adventureRelicEffects = null;
        window.adventureDeathsBefore = null;
        
        // Check for defeat
        if (AdventureState.isDefeated()) {
            this.endRun(false);
            return;
        }
        
        // Return to adventure
        this.returnToAdventure();
    },
    
    returnToAdventure() {
        // Hide battle, show adventure
        document.getElementById('game-container').style.display = 'none';
        
        // Position player - if room cleared, put near exit, otherwise back from edge
        if (AdventureState.currentRoomData?.cleared) {
            this.player.x = this.room.width - 200;
        } else {
            this.player.x = this.room.width / 2;
        }
        this.player.y = this.room.groundY - this.player.height;
        
        // Show adventure screen
        document.getElementById('adventure-screen').classList.add('open');
        AdventureUI.updateHUD();
        
        // Release the transition lock
        this.transitionLock = false;
        
        // Resume game loop
        this.start();
    },
    
    advanceRoom() {
        const nextRoomIndex = AdventureState.currentRoom + 1;
        
        if (nextRoomIndex >= AdventureState.rooms.length) {
            // Floor complete!
            this.completeFloor();
            return;
        }
        
        // Transition to next room
        this.transitionToRoom(nextRoomIndex);
    },
    
    transitionToRoom(roomIndex) {
        const transition = document.querySelector('.room-transition');
        if (transition) {
            transition.classList.add('active');
        }
        
        setTimeout(() => {
            AdventureState.currentRoom = roomIndex;
            AdventureState.currentRoomData = AdventureState.rooms[roomIndex];
            AdventureState.currentRoomData.visited = true;
            AdventureState.totalRoomsCleared++;
            
            // Reset player position to left side
            this.player.x = 100;
            this.player.y = this.room.groundY - this.player.height;
            
            // Update UI
            AdventureUI.updateRoomInfo();
            AdventureUI.updateHUD();
            
            // Check for special room types (may set its own lock)
            this.handleRoomEntry();
            
            setTimeout(() => {
                if (transition) {
                    transition.classList.remove('active');
                }
                // Release lock after transition animation completes
                // (unless an event/shop took over)
                if (!AdventureState.currentRoomData?.encounter || AdventureState.currentRoomData?.cleared) {
                    this.transitionLock = false;
                }
            }, 300);
        }, 300);
    },
    
    handleRoomEntry() {
        const room = AdventureState.currentRoomData;
        if (!room) {
            this.transitionLock = false;
            return;
        }
        
        switch (room.type) {
            case 'shop':
                // Open shop modal (lock stays until shop closes)
                setTimeout(() => AdventureUI.openShop(), 500);
                break;
            case 'rest':
                // Auto-heal at rest sites
                setTimeout(() => this.handleRestSite(), 500);
                break;
            case 'event':
                // Random event (lock stays until event closes)
                setTimeout(() => AdventureUI.showEvent(), 500);
                break;
            case 'treasure':
            case 'entrance':
            default:
                // No special handling, release lock
                this.transitionLock = false;
                break;
        }
    },
    
    handleRestSite() {
        let healAmount = 2;
        
        // Apply healer's kit relic
        for (const relic of AdventureState.relics) {
            if (relic.effect?.restBonus) {
                healAmount += relic.effect.restBonus;
            }
        }
        
        AdventureState.healDeaths(healAmount);
        AdventureUI.showMessage(`Rested and healed ${healAmount} death(s).`);
        AdventureUI.updateHUD();
        
        AdventureState.currentRoomData.cleared = true;
        
        // Release lock after rest
        this.transitionLock = false;
    },
    
    completeFloor() {
        AdventureState.floorsCompleted++;
        
        // Bonus rewards for floor completion
        const floorBonus = 100 * AdventureState.currentFloor;
        AdventureState.embers += floorBonus;
        AdventureState.xpEarned += 50 * AdventureState.currentFloor;
        
        // Refill shovel uses
        for (const relic of AdventureState.relics) {
            if (relic.maxUses) {
                relic.uses = relic.maxUses;
            }
        }
        
        if (AdventureState.currentFloor >= 3) {
            // Victory!
            this.endRun(true);
        } else {
            // Next floor
            AdventureState.currentFloor++;
            AdventureState.currentRoom = 0;
            AdventureState.rooms = RoomGenerator.generateFloor(AdventureState.currentFloor);
            AdventureState.currentRoomData = AdventureState.rooms[0];
            
            AdventureUI.showMessage(`Floor ${AdventureState.currentFloor} begins!`);
            this.player.x = 50;
            AdventureUI.updateHUD();
            AdventureUI.updateRoomInfo();
        }
    },
    
    endRun(isVictory) {
        this.stop();
        AdventureState.isActive = false;
        
        // Calculate final rewards
        const rewards = {
            embers: AdventureState.embers,
            xp: AdventureState.xpEarned,
            floorsCompleted: AdventureState.floorsCompleted,
            battlesWon: AdventureState.battlesWon
        };
        
        // Victory bonuses
        if (isVictory) {
            rewards.embers += 500;
            rewards.xp += 200;
        }
        
        // Apply to player data
        if (typeof PlayerData !== 'undefined') {
            PlayerData.embers += rewards.embers;
            PlayerData.addXP(rewards.xp);
            PlayerData.save();
        }
        
        // Show results
        AdventureUI.showResults(isVictory, rewards);
    },
    
    updateParticles(dt) {
        // Ambient fog/dust particles
        if (Math.random() < 0.05) {
            this.visuals.ambientParticles.push({
                x: Math.random() * this.room.width,
                y: Math.random() * this.room.height,
                vx: (Math.random() - 0.5) * 0.5,
                vy: -0.2 - Math.random() * 0.3,
                life: 1,
                size: 1 + Math.random() * 2
            });
        }
        
        // Update particles
        this.visuals.ambientParticles = this.visuals.ambientParticles.filter(p => {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= 0.01;
            return p.life > 0;
        });
    },
    
    // ==================== RENDERING ====================
    
    render() {
        const ctx = this.ctx;
        const room = AdventureState.currentRoomData;
        
        // Clear
        ctx.fillStyle = '#0a0806';
        ctx.fillRect(0, 0, this.room.width, this.room.height);
        
        // Draw background
        this.drawBackground(room?.background || 'entrance');
        
        // Draw interactables
        this.drawInteractables();
        
        // Draw player
        this.drawPlayer();
        
        // Draw particles
        this.drawParticles();
        
        // Draw fog/darkness
        this.drawFog();
        
        // Draw exit indicators
        this.drawExitIndicators();
    },
    
    drawBackground(type) {
        const ctx = this.ctx;
        const gradients = {
            'entrance': ['#1a1510', '#0a0806'],
            'battle': ['#201510', '#0a0806'],
            'battle_elite': ['#251015', '#0a0806'],
            'boss': ['#2a1010', '#0a0806'],
            'shop': ['#151a15', '#0a0806'],
            'rest': ['#101520', '#0a0806'],
            'treasure': ['#1a1a10', '#0a0806'],
            'event': ['#151520', '#0a0806'],
            'curse': ['#1a1015', '#0a0806'],
            'mystery': ['#151515', '#0a0806']
        };
        
        const colors = gradients[type] || gradients['entrance'];
        const gradient = ctx.createLinearGradient(0, 0, 0, this.room.height);
        gradient.addColorStop(0, colors[0]);
        gradient.addColorStop(1, colors[1]);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.room.width, this.room.height);
        
        // Ground
        ctx.fillStyle = '#0d0a07';
        ctx.fillRect(0, this.room.groundY, this.room.width, this.room.height - this.room.groundY);
        
        // Ground line
        ctx.strokeStyle = 'rgba(232, 169, 62, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, this.room.groundY);
        ctx.lineTo(this.room.width, this.room.groundY);
        ctx.stroke();
        
        // Draw some environmental details based on room type
        this.drawEnvironmentDetails(type);
    },
    
    drawEnvironmentDetails(type) {
        const ctx = this.ctx;
        
        // Draw some pillars/trees/etc based on room type
        ctx.fillStyle = 'rgba(30, 25, 20, 0.8)';
        
        if (type === 'battle' || type === 'battle_elite' || type === 'boss') {
            // Ominous pillars
            ctx.fillRect(50, 100, 20, 220);
            ctx.fillRect(630, 100, 20, 220);
        }
        
        if (type === 'shop') {
            // Market stall shape
            ctx.fillRect(300, 150, 100, 170);
            ctx.fillStyle = 'rgba(150, 100, 50, 0.3)';
            ctx.fillRect(290, 140, 120, 20);
        }
        
        if (type === 'rest') {
            // Campfire glow
            const glow = ctx.createRadialGradient(350, 280, 0, 350, 280, 80);
            glow.addColorStop(0, 'rgba(255, 150, 50, 0.3)');
            glow.addColorStop(1, 'transparent');
            ctx.fillStyle = glow;
            ctx.fillRect(270, 200, 160, 160);
        }
    },
    
    drawInteractables() {
        const ctx = this.ctx;
        const room = AdventureState.currentRoomData;
        if (!room?.interactables) return;
        
        for (const item of room.interactables) {
            if (item.collected || item.triggered) continue;
            
            ctx.save();
            
            const y = this.room.groundY - 30;
            const isNear = this.player.interactTarget === item;
            
            // Glow if near
            if (isNear) {
                ctx.shadowColor = '#e8a93e';
                ctx.shadowBlur = 20;
            }
            
            switch (item.type) {
                case 'dig_spot':
                    ctx.fillStyle = 'rgba(139, 90, 43, 0.6)';
                    ctx.beginPath();
                    ctx.ellipse(item.x, y + 15, 25, 10, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = '#8B5A2B';
                    ctx.font = '16px serif';
                    ctx.fillText('⛏', item.x - 8, y + 5);
                    break;
                    
                case 'chest':
                    ctx.fillStyle = item.locked ? '#8B4513' : '#CD853F';
                    ctx.fillRect(item.x - 20, y - 15, 40, 30);
                    ctx.fillStyle = '#e8a93e';
                    ctx.fillRect(item.x - 5, y - 5, 10, 10);
                    if (item.locked) {
                        ctx.fillStyle = '#444';
                        ctx.fillRect(item.x - 3, y - 3, 6, 6);
                    }
                    break;
                    
                case 'trap':
                    // Hidden until triggered
                    if (!item.revealed) break;
                    ctx.fillStyle = 'rgba(200, 50, 50, 0.5)';
                    ctx.beginPath();
                    ctx.moveTo(item.x, y - 20);
                    ctx.lineTo(item.x - 15, y + 10);
                    ctx.lineTo(item.x + 15, y + 10);
                    ctx.closePath();
                    ctx.fill();
                    break;
            }
            
            ctx.restore();
        }
    },
    
    drawPlayer() {
        const ctx = this.ctx;
        const p = this.player;
        
        ctx.save();
        
        // Calculate animation values
        const time = Date.now();
        const walkBob = p.state === 'walking' ? Math.sin(time / 80) * 3 : 0;
        const jumpSquash = p.state === 'jumping' ? (p.vy < 0 ? 0.9 : 1.1) : 1;
        
        // Shadow (smaller when jumping)
        const shadowScale = p.grounded ? 1 : 0.5;
        ctx.fillStyle = `rgba(0, 0, 0, ${p.grounded ? 0.4 : 0.2})`;
        ctx.beginPath();
        ctx.ellipse(p.x + p.width / 2, this.room.groundY + 5, (p.width / 2) * shadowScale, 10 * shadowScale, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Apply transformations
        ctx.translate(p.x + p.width / 2, p.y + p.height / 2);
        ctx.scale(p.facing, jumpSquash);
        ctx.translate(0, walkBob);
        
        // Body glow
        ctx.shadowColor = '#e8a93e';
        ctx.shadowBlur = 15;
        
        // Cloak (main body)
        const gradient = ctx.createLinearGradient(0, -p.height/2, 0, p.height/2);
        gradient.addColorStop(0, '#3a3530');
        gradient.addColorStop(0.3, '#2a2520');
        gradient.addColorStop(1, '#1a1510');
        ctx.fillStyle = gradient;
        
        ctx.beginPath();
        ctx.moveTo(0, -p.height/2 + 10); // Top of head
        ctx.lineTo(p.width/2 - 5, -p.height/2 + 25); // Right shoulder
        ctx.lineTo(p.width/2 - 8, p.height/2 - 5); // Right foot
        ctx.lineTo(-p.width/2 + 8, p.height/2 - 5); // Left foot
        ctx.lineTo(-p.width/2 + 5, -p.height/2 + 25); // Left shoulder
        ctx.closePath();
        ctx.fill();
        
        ctx.shadowBlur = 0;
        
        // Hood
        ctx.fillStyle = '#1a1510';
        ctx.beginPath();
        ctx.arc(0, -p.height/2 + 20, 18, 0, Math.PI * 2);
        ctx.fill();
        
        // Face area (darker)
        ctx.fillStyle = '#0a0806';
        ctx.beginPath();
        ctx.arc(3, -p.height/2 + 22, 12, 0, Math.PI * 2);
        ctx.fill();
        
        // Eyes (glowing embers)
        ctx.shadowColor = '#ff6b00';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#e8a93e';
        ctx.beginPath();
        ctx.arc(-2, -p.height/2 + 20, 3, 0, Math.PI * 2);
        ctx.arc(8, -p.height/2 + 20, 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Eye glow cores
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(-2, -p.height/2 + 20, 1.5, 0, Math.PI * 2);
        ctx.arc(8, -p.height/2 + 20, 1.5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    },
    
    drawParticles() {
        const ctx = this.ctx;
        
        for (const p of this.visuals.ambientParticles) {
            ctx.fillStyle = `rgba(200, 180, 150, ${p.life * 0.3})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
    },
    
    drawFog() {
        const ctx = this.ctx;
        
        // Top fog
        const topFog = ctx.createLinearGradient(0, 0, 0, 80);
        topFog.addColorStop(0, 'rgba(10, 8, 6, 0.8)');
        topFog.addColorStop(1, 'transparent');
        ctx.fillStyle = topFog;
        ctx.fillRect(0, 0, this.room.width, 80);
        
        // Side vignette
        const leftVig = ctx.createLinearGradient(0, 0, 80, 0);
        leftVig.addColorStop(0, 'rgba(10, 8, 6, 0.6)');
        leftVig.addColorStop(1, 'transparent');
        ctx.fillStyle = leftVig;
        ctx.fillRect(0, 0, 80, this.room.height);
        
        const rightVig = ctx.createLinearGradient(this.room.width, 0, this.room.width - 80, 0);
        rightVig.addColorStop(0, 'rgba(10, 8, 6, 0.6)');
        rightVig.addColorStop(1, 'transparent');
        ctx.fillStyle = rightVig;
        ctx.fillRect(this.room.width - 80, 0, 80, this.room.height);
    },
    
    drawExitIndicators() {
        const ctx = this.ctx;
        const room = AdventureState.currentRoomData;
        
        // Right exit (forward) - large glowing arrow
        const rightX = this.room.width - 60;
        const arrowY = this.room.groundY - 80;
        
        // Pulsing glow
        const pulse = (Math.sin(Date.now() / 300) + 1) / 2;
        const glowAlpha = 0.3 + pulse * 0.3;
        
        // Arrow glow
        ctx.shadowColor = room?.cleared ? '#4ade80' : '#e8a93e';
        ctx.shadowBlur = 20 + pulse * 10;
        
        ctx.fillStyle = room?.cleared 
            ? `rgba(74, 222, 128, ${glowAlpha})` 
            : `rgba(232, 169, 62, ${glowAlpha})`;
        
        // Draw arrow
        ctx.beginPath();
        ctx.moveTo(rightX, arrowY - 40);
        ctx.lineTo(rightX + 50, arrowY);
        ctx.lineTo(rightX, arrowY + 40);
        ctx.lineTo(rightX + 15, arrowY);
        ctx.closePath();
        ctx.fill();
        
        // Arrow outline
        ctx.strokeStyle = room?.cleared ? '#4ade80' : '#e8a93e';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.shadowBlur = 0;
        
        // "NEXT" text
        ctx.fillStyle = room?.cleared ? '#4ade80' : '#e8a93e';
        ctx.font = 'bold 12px "Cinzel", serif';
        ctx.textAlign = 'center';
        ctx.fillText(room?.cleared ? 'NEXT →' : 'GO →', rightX + 10, arrowY + 60);
        
        // Left exit indicator (blocked) - X mark
        ctx.fillStyle = 'rgba(150, 80, 80, 0.5)';
        ctx.font = 'bold 32px serif';
        ctx.textAlign = 'left';
        ctx.fillText('✕', 15, this.room.groundY - 50);
        
        ctx.textAlign = 'left'; // Reset
    }
};

// ==================== ADVENTURE UI ====================

window.AdventureUI = {
    init() {
        if (this.initialized) return; // Prevent double init
        
        this.createScreens();
        this.bindEvents();
        this.initialized = true;
        console.log('[AdventureUI] Initialized');
    },
    
    createScreens() {
        console.log('[AdventureUI] createScreens called');
        
        // Main adventure screen
        if (!document.getElementById('adventure-screen')) {
            try {
                const screen = document.createElement('div');
                screen.id = 'adventure-screen';
                screen.innerHTML = `
                    <div class="adventure-viewport">
                        <div class="adventure-hud">
                            <div class="hud-left">
                                <div class="hud-stat deaths">
                                    <span class="icon">☠</span>
                                    <span class="value" id="adv-deaths">0</span>/<span id="adv-max-deaths">10</span>
                                </div>
                                <div class="floor-indicator">
                                    Floor <span id="adv-floor">1</span> • Room <span id="adv-room">1</span>/10
                                </div>
                            </div>
                            <div class="hud-right">
                                <div class="hud-stat embers">
                                    <span class="icon">🔥</span>
                                    <span class="value" id="adv-embers">0</span>
                                </div>
                            </div>
                        </div>
                        <div class="relics-bar" id="adv-relics"></div>
                        <div class="interact-prompt"></div>
                        <div class="room-transition"></div>
                        <div class="room-info-bar">
                            <div class="room-name" id="adv-room-name">Entrance</div>
                            <div class="room-hint" id="adv-room-hint">→ Move right to continue</div>
                        </div>
                        <div class="touch-controls">
                            <div class="touch-dpad">
                                <button class="touch-btn" id="touch-left">←</button>
                            </div>
                            <button class="touch-btn" id="touch-interact">E</button>
                            <div class="touch-dpad">
                                <button class="touch-btn" id="touch-right">→</button>
                            </div>
                        </div>
                    </div>
                `;
                document.body.appendChild(screen);
                
                // Insert canvas (with null checks)
                const viewport = screen.querySelector('.adventure-viewport');
                if (viewport && AdventureEngine.canvas) {
                    viewport.insertBefore(AdventureEngine.canvas, viewport.firstChild);
                } else {
                    console.warn('[AdventureUI] Could not insert canvas - viewport:', !!viewport, 'canvas:', !!AdventureEngine.canvas);
                }
            } catch (e) {
                console.error('[AdventureUI] Error creating adventure screen:', e);
            }
        }
        
        // Setup screen
        if (!document.getElementById('adventure-setup')) {
            const setup = document.createElement('div');
            setup.id = 'adventure-setup';
            setup.innerHTML = `
                <div class="setup-container">
                    <div class="setup-title">⚔️ Begin Adventure</div>
                    <div class="setup-subtitle">Choose your path through the darkness</div>
                    
                    <div id="deck-selection-step">
                        <h3 style="color: #e8a93e; margin-bottom: 20px;">Select Your Deck</h3>
                        <div class="deck-options" id="adv-deck-options"></div>
                    </div>
                    
                    <div id="relic-selection-step" style="display: none;">
                        <h3 style="color: #a080d0; margin-bottom: 20px;">Choose a Starting Relic</h3>
                        <div class="relic-options" id="adv-relic-options"></div>
                    </div>
                    
                    <div style="margin-top: 20px;">
                        <button class="setup-btn" id="adv-continue-btn" disabled>Continue</button>
                        <button class="setup-btn secondary" id="adv-cancel-btn">Cancel</button>
                    </div>
                </div>
            `;
            document.body.appendChild(setup);
        }
        
        // Results screen
        if (!document.getElementById('adventure-results')) {
            const results = document.createElement('div');
            results.id = 'adventure-results';
            results.innerHTML = `
                <div class="results-container">
                    <div class="results-banner" id="results-banner">VICTORY</div>
                    <div class="results-subtitle" id="results-subtitle">The darkness retreats... for now.</div>
                    
                    <div class="results-stats" id="results-stats"></div>
                    
                    <div class="results-rewards">
                        <div class="rewards-title">✧ Rewards Earned ✧</div>
                        <div class="reward-row" id="results-rewards"></div>
                    </div>
                    
                    <button class="setup-btn" id="results-home-btn">Return Home</button>
                </div>
            `;
            document.body.appendChild(results);
        }
    },
    
    bindEvents() {
        // Setup screen events
        document.getElementById('adv-continue-btn')?.addEventListener('click', () => this.onSetupContinue());
        document.getElementById('adv-cancel-btn')?.addEventListener('click', () => this.closeSetup());
        document.getElementById('results-home-btn')?.addEventListener('click', () => this.returnHome());
        
        // Touch controls
        const touchLeft = document.getElementById('touch-left');
        const touchRight = document.getElementById('touch-right');
        const touchInteract = document.getElementById('touch-interact');
        
        if (touchLeft) {
            touchLeft.addEventListener('touchstart', () => AdventureEngine.keys.left = true);
            touchLeft.addEventListener('touchend', () => AdventureEngine.keys.left = false);
        }
        if (touchRight) {
            touchRight.addEventListener('touchstart', () => AdventureEngine.keys.right = true);
            touchRight.addEventListener('touchend', () => AdventureEngine.keys.right = false);
        }
        if (touchInteract) {
            touchInteract.addEventListener('click', () => AdventureEngine.handleInteraction());
        }
    },
    
    // ==================== SETUP FLOW ====================
    
    // Track if init has been called
    initialized: false,
    
    openSetup() {
        console.log('[AdventureUI] openSetup called, initialized:', this.initialized);
        
        try {
            // Ensure initialization has completed
            if (!this.initialized) {
                console.log('[AdventureUI] Late initialization triggered');
                this.init();
            }
            
            // Also ensure engine is initialized
            if (!AdventureEngine.canvas) {
                console.log('[AdventureUI] Late engine init triggered');
                AdventureEngine.init();
            }
            
            this.setupStep = 'deck';
            this.selectedDeck = null;
            this.selectedRelic = null;
            this.relicChoices = RelicRegistry.getRandomStarterRelics(3);
            
            this.renderDeckOptions();
            
            const deckStep = document.getElementById('deck-selection-step');
            const relicStep = document.getElementById('relic-selection-step');
            const continueBtn = document.getElementById('adv-continue-btn');
            const setupScreen = document.getElementById('adventure-setup');
            
            if (!deckStep || !relicStep || !continueBtn || !setupScreen) {
                console.error('[AdventureUI] Missing DOM elements, recreating screens...');
                this.createScreens();
                this.bindEvents();
            }
            
            document.getElementById('deck-selection-step').style.display = 'block';
            document.getElementById('relic-selection-step').style.display = 'none';
            document.getElementById('adv-continue-btn').disabled = true;
            document.getElementById('adv-continue-btn').textContent = 'Select a Deck';
            
            document.getElementById('adventure-setup').classList.add('open');
            console.log('[AdventureUI] Setup screen opened');
        } catch (e) {
            console.error('[AdventureUI] openSetup error:', e);
            console.error('[AdventureUI] Stack:', e.stack);
            
            // Show error to user
            const msg = document.createElement('div');
            msg.style.cssText = `
                position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                background: rgba(0,0,0,0.95); border: 2px solid #e57373; padding: 30px 50px;
                border-radius: 12px; color: #e8e0d5; font-family: 'Cinzel', serif;
                font-size: 16px; z-index: 99999; text-align: center; max-width: 400px;
            `;
            msg.innerHTML = `
                <div style="color: #e57373; font-size: 20px; margin-bottom: 15px;">⚠️ Adventure Mode Error</div>
                <div style="margin-bottom: 10px;">Failed to open Adventure Mode.</div>
                <div style="font-size: 12px; color: #888; margin-bottom: 15px;">${e.message}</div>
                <button onclick="localStorage.removeItem('cryptidFates_playerData'); location.reload();" style="
                    margin: 5px; padding: 10px 20px; background: #e57373; border: none;
                    color: white; cursor: pointer; border-radius: 6px; font-family: inherit;
                ">Reset Save Data</button>
                <button onclick="this.parentElement.remove(); HomeScreen.open();" style="
                    margin: 5px; padding: 10px 20px; background: #666; border: none;
                    color: white; cursor: pointer; border-radius: 6px; font-family: inherit;
                ">Cancel</button>
            `;
            document.body.appendChild(msg);
        }
    },
    
    closeSetup() {
        document.getElementById('adventure-setup').classList.remove('open');
        
        // Return to home
        if (typeof HomeScreen !== 'undefined') {
            HomeScreen.open();
        }
    },
    
    renderDeckOptions() {
        const container = document.getElementById('adv-deck-options');
        container.innerHTML = '';
        
        for (const [id, deck] of Object.entries(StarterDecks)) {
            const div = document.createElement('div');
            div.className = `deck-option${deck.locked ? ' locked' : ''}`;
            div.dataset.deckId = id;
            div.innerHTML = `
                <div class="icon">${deck.icon}</div>
                <div class="name">${deck.name}</div>
                <div class="theme">${deck.theme}</div>
            `;
            
            if (!deck.locked) {
                div.addEventListener('click', () => this.selectDeck(id));
            }
            
            container.appendChild(div);
        }
    },
    
    selectDeck(deckId) {
        this.selectedDeck = deckId;
        
        // Update UI
        document.querySelectorAll('.deck-option').forEach(el => {
            el.classList.toggle('selected', el.dataset.deckId === deckId);
        });
        
        document.getElementById('adv-continue-btn').disabled = false;
        document.getElementById('adv-continue-btn').textContent = 'Choose Relic →';
    },
    
    renderRelicOptions() {
        const container = document.getElementById('adv-relic-options');
        container.innerHTML = '';
        
        for (const relic of this.relicChoices) {
            const div = document.createElement('div');
            div.className = 'relic-option';
            div.dataset.relicId = relic.id;
            div.innerHTML = `
                <div class="icon">${relic.sprite}</div>
                <div class="name">${relic.name}</div>
                <div class="desc">${relic.description}</div>
            `;
            
            div.addEventListener('click', () => this.selectRelic(relic.id));
            container.appendChild(div);
        }
    },
    
    selectRelic(relicId) {
        this.selectedRelic = relicId;
        
        // Update UI
        document.querySelectorAll('.relic-option').forEach(el => {
            el.classList.toggle('selected', el.dataset.relicId === relicId);
        });
        
        document.getElementById('adv-continue-btn').disabled = false;
        document.getElementById('adv-continue-btn').textContent = 'Begin Adventure!';
    },
    
    onSetupContinue() {
        if (this.setupStep === 'deck') {
            if (!this.selectedDeck) return;
            
            // Move to relic selection
            this.setupStep = 'relic';
            document.getElementById('deck-selection-step').style.display = 'none';
            document.getElementById('relic-selection-step').style.display = 'block';
            document.getElementById('adv-continue-btn').disabled = true;
            document.getElementById('adv-continue-btn').textContent = 'Select a Relic';
            
            this.renderRelicOptions();
            
        } else if (this.setupStep === 'relic') {
            if (!this.selectedRelic) return;
            
            // Start the adventure!
            this.startAdventure();
        }
    },
    
    startAdventure() {
        // Close setup
        document.getElementById('adventure-setup').classList.remove('open');
        
        // Initialize adventure state
        AdventureState.reset();
        AdventureState.isActive = true;
        AdventureState.deckArchetype = this.selectedDeck;
        
        // Set up deck
        const deckData = StarterDecks[this.selectedDeck];
        AdventureState.starterCards = [...deckData.starterCards];
        
        // Set up relic
        const relic = RelicRegistry.getRelic(this.selectedRelic);
        if (relic) {
            AdventureState.relics.push(relic);
        }
        
        // Generate first floor
        AdventureState.rooms = RoomGenerator.generateFloor(1);
        AdventureState.currentRoomData = AdventureState.rooms[0];
        AdventureState.currentRoomData.visited = true;
        
        // Show adventure screen
        document.getElementById('adventure-screen').classList.add('open');
        this.updateHUD();
        this.updateRoomInfo();
        this.updateRelicsDisplay();
        
        // Start the engine
        AdventureEngine.init();
        AdventureEngine.start();
    },
    
    // ==================== HUD UPDATES ====================
    
    updateHUD() {
        document.getElementById('adv-deaths').textContent = AdventureState.deadCryptidCount;
        document.getElementById('adv-max-deaths').textContent = AdventureState.getMaxDeaths();
        document.getElementById('adv-floor').textContent = AdventureState.currentFloor;
        document.getElementById('adv-room').textContent = AdventureState.currentRoom + 1;
        document.getElementById('adv-embers').textContent = AdventureState.embers;
    },
    
    updateRoomInfo() {
        const room = AdventureState.currentRoomData;
        if (!room) return;
        
        document.getElementById('adv-room-name').textContent = room.name;
        
        let hint = '→ Move right to continue';
        if (room.encounter && !room.cleared) {
            hint = '⚔ Battle awaits...';
        } else if (room.type === 'shop') {
            hint = '💰 Browse the wares';
        } else if (room.type === 'rest') {
            hint = '🏕️ Rest and recover';
        } else if (room.type === 'treasure') {
            hint = '✨ Search for treasure';
        }
        
        document.getElementById('adv-room-hint').textContent = hint;
    },
    
    updateRelicsDisplay() {
        const container = document.getElementById('adv-relics');
        container.innerHTML = '';
        
        for (const relic of AdventureState.relics) {
            const div = document.createElement('div');
            div.className = 'relic-icon';
            div.title = `${relic.name}: ${relic.description}`;
            div.innerHTML = relic.sprite;
            
            if (relic.maxUses) {
                const uses = document.createElement('span');
                uses.className = 'uses';
                uses.textContent = relic.uses;
                div.appendChild(uses);
            }
            
            container.appendChild(div);
        }
    },
    
    showMessage(text, duration = 2000) {
        // Simple message display
        const existing = document.querySelector('.adventure-message');
        if (existing) existing.remove();
        
        const msg = document.createElement('div');
        msg.className = 'adventure-message';
        msg.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            border: 1px solid #e8a93e;
            padding: 15px 30px;
            border-radius: 8px;
            color: #e8e0d5;
            font-family: 'Cinzel', serif;
            font-size: 16px;
            z-index: 15010;
            animation: fadeInOut ${duration}ms ease;
        `;
        msg.textContent = text;
        document.body.appendChild(msg);
        
        setTimeout(() => msg.remove(), duration);
    },
    
    // ==================== RESULTS ====================
    
    showResults(isVictory, rewards) {
        document.getElementById('adventure-screen').classList.remove('open');
        
        const banner = document.getElementById('results-banner');
        banner.textContent = isVictory ? 'VICTORY!' : 'DEFEATED';
        banner.className = `results-banner ${isVictory ? 'victory' : 'defeat'}`;
        
        document.getElementById('results-subtitle').textContent = isVictory 
            ? 'The darkness retreats... for now.'
            : 'The shadows claim another soul.';
        
        // Stats
        document.getElementById('results-stats').innerHTML = `
            <div class="result-stat">
                <span class="label">Floors Completed</span>
                <span class="value">${rewards.floorsCompleted}/3</span>
            </div>
            <div class="result-stat">
                <span class="label">Battles Won</span>
                <span class="value">${rewards.battlesWon}</span>
            </div>
            <div class="result-stat">
                <span class="label">Items Found</span>
                <span class="value">${AdventureState.itemsFound}</span>
            </div>
            <div class="result-stat">
                <span class="label">Cards Discovered</span>
                <span class="value">${AdventureState.discoveredCards.length}</span>
            </div>
        `;
        
        // Rewards
        document.getElementById('results-rewards').innerHTML = `
            <div class="reward-item">
                <div class="icon">🔥</div>
                <div class="amount">+${rewards.embers}</div>
                <div class="label">Embers</div>
            </div>
            <div class="reward-item">
                <div class="icon">⭐</div>
                <div class="amount">+${rewards.xp}</div>
                <div class="label">XP</div>
            </div>
        `;
        
        document.getElementById('adventure-results').classList.add('open');
    },
    
    returnHome() {
        document.getElementById('adventure-results').classList.remove('open');
        
        if (typeof HomeScreen !== 'undefined') {
            HomeScreen.open();
        }
    },
    
    // ==================== SHOP ====================
    
    shopInventory: [
        { 
            id: 'heal2', 
            name: 'Soul Salve', 
            icon: '💚',
            description: 'Restore vitality to your cryptids',
            effect: 'Heal 2 Deaths',
            cost: 30,
            action: () => {
                AdventureState.healDeaths(2);
                return 'Your wounds mend... -2 Deaths';
            }
        },
        { 
            id: 'card', 
            name: 'Mystery Card', 
            icon: '🃏',
            description: 'A card wrapped in shadow',
            effect: 'Gain a random card',
            cost: 50,
            action: () => {
                AdventureEngine.grantRandomCard('common');
                return 'A new card joins your arsenal!';
            }
        },
        { 
            id: 'embers', 
            name: 'Ember Cache', 
            icon: '🔥',
            description: 'A stash of burning embers',
            effect: '+40 Embers',
            cost: 25,
            action: () => {
                AdventureState.embers += 40;
                return 'The cache bursts open! +40 Embers';
            }
        },
        { 
            id: 'rarecard', 
            name: 'Forbidden Tome', 
            icon: '📕',
            description: 'Contains powerful secrets',
            effect: 'Gain a rare card',
            cost: 100,
            action: () => {
                AdventureEngine.grantRandomCard('rare');
                return 'Ancient power flows into a new card!';
            }
        }
    ],
    
    openShop() {
        // Mark room as cleared FIRST
        if (AdventureState.currentRoomData) {
            AdventureState.currentRoomData.cleared = true;
        }
        
        // Remove any existing shop modal
        const existing = document.getElementById('adventure-shop-modal');
        if (existing) existing.remove();
        
        // Pick 3 random items to offer
        const shuffled = [...this.shopInventory].sort(() => Math.random() - 0.5);
        const offerings = shuffled.slice(0, 3);
        
        // Create modal
        const modal = document.createElement('div');
        modal.id = 'adventure-shop-modal';
        modal.className = 'adventure-shop-modal';
        modal.innerHTML = `
            <div class="shop-backdrop"></div>
            <div class="shop-content">
                <div class="shop-header">
                    <span class="shop-icon">🏪</span>
                    <h2 class="shop-title">Wandering Merchant</h2>
                    <p class="shop-subtitle">"See anything you like, traveler?"</p>
                </div>
                <div class="shop-balance">
                    <span class="balance-icon">🔥</span>
                    <span class="balance-amount" id="shop-balance">${AdventureState.embers}</span>
                    <span class="balance-label">Embers</span>
                </div>
                <div class="shop-items">
                    ${offerings.map(item => `
                        <div class="shop-item ${AdventureState.embers < item.cost ? 'unaffordable' : ''}" data-id="${item.id}" data-cost="${item.cost}">
                            <div class="item-icon">${item.icon}</div>
                            <div class="item-info">
                                <div class="item-name">${item.name}</div>
                                <div class="item-desc">${item.description}</div>
                                <div class="item-effect">${item.effect}</div>
                            </div>
                            <div class="item-price">
                                <span class="price-amount">${item.cost}</span>
                                <span class="price-icon">🔥</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="shop-result" id="shop-result"></div>
                <button class="shop-leave" id="shop-leave">Leave Shop</button>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Animate in
        requestAnimationFrame(() => modal.classList.add('open'));
        
        // Bind item clicks
        modal.querySelectorAll('.shop-item:not(.unaffordable)').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.dataset.id;
                const cost = parseInt(item.dataset.cost);
                const shopItem = this.shopInventory.find(i => i.id === id);
                
                if (shopItem && AdventureState.embers >= cost) {
                    AdventureState.embers -= cost;
                    const result = shopItem.action();
                    
                    // Update balance
                    document.getElementById('shop-balance').textContent = AdventureState.embers;
                    
                    // Mark as purchased
                    item.classList.add('purchased');
                    item.innerHTML = `<div class="purchased-text">✓ Purchased</div>`;
                    
                    // Show result
                    const resultEl = document.getElementById('shop-result');
                    resultEl.textContent = result;
                    resultEl.classList.add('show');
                    
                    // Update affordability
                    modal.querySelectorAll('.shop-item:not(.purchased)').forEach(otherItem => {
                        const otherCost = parseInt(otherItem.dataset.cost);
                        if (AdventureState.embers < otherCost) {
                            otherItem.classList.add('unaffordable');
                        }
                    });
                    
                    this.updateHUD();
                }
            });
        });
        
        // Leave button
        document.getElementById('shop-leave').addEventListener('click', () => {
            modal.classList.remove('open');
            setTimeout(() => {
                modal.remove();
                // Release the transition lock
                AdventureEngine.transitionLock = false;
            }, 300);
        });
    },
    
    revealTraps() {
        const room = AdventureState.currentRoomData;
        if (!room?.interactables) return;
        
        for (const item of room.interactables) {
            if (item.type === 'trap') {
                item.revealed = true;
            }
        }
    },
    
    // ==================== EVENTS ====================
    
    eventRegistry: [
        {
            id: 'altar',
            title: 'Mysterious Altar',
            icon: '🗿',
            text: 'A dark altar pulses with malevolent energy. Ancient whispers promise power... for a price.',
            choices: [
                { 
                    text: '🩸 Sacrifice Health', 
                    subtext: 'Heal 1 death → Gain a rare card',
                    action: () => {
                        if (AdventureState.deadCryptidCount > 0) {
                            AdventureState.healDeaths(1);
                            AdventureEngine.grantRandomCard('rare');
                            return { success: true, message: 'The altar accepts your offering. A card materializes!' };
                        } else {
                            return { success: false, message: 'You have nothing to sacrifice...' };
                        }
                    }
                },
                { 
                    text: '🚶 Walk Away', 
                    subtext: 'Leave the altar undisturbed',
                    action: () => ({ success: true, message: 'You leave the altar behind.' })
                }
            ]
        },
        {
            id: 'spirit',
            title: 'Wandering Spirit',
            icon: '👻',
            text: 'A translucent figure floats before you, its hollow eyes filled with ancient sorrow. It extends a spectral hand.',
            choices: [
                { 
                    text: '🤝 Accept Gift', 
                    subtext: '+25 Embers',
                    action: () => {
                        AdventureState.embers += 25;
                        return { success: true, message: 'The spirit fades, leaving behind glowing embers.' };
                    }
                },
                { 
                    text: '🙏 Offer Comfort', 
                    subtext: 'Heal 1 death',
                    action: () => {
                        AdventureState.healDeaths(1);
                        return { success: true, message: 'The spirit smiles peacefully and dissolves into light.' };
                    }
                }
            ]
        },
        {
            id: 'chest',
            title: 'Cursed Treasure',
            icon: '💀',
            text: 'An ornate chest sits alone, pulsing with dark energy. Riches or ruin await within.',
            choices: [
                { 
                    text: '📦 Open Chest', 
                    subtext: '60% chance: +50 Embers | 40% chance: +1 Death',
                    action: () => {
                        if (Math.random() < 0.6) {
                            AdventureState.embers += 50;
                            return { success: true, message: 'Gold and embers spill forth! +50 Embers!' };
                        } else {
                            AdventureState.addDeaths(1);
                            return { success: false, message: 'A curse lashes out! Your soul takes damage.' };
                        }
                    }
                },
                { 
                    text: '🚶 Leave It', 
                    subtext: 'Better safe than sorry',
                    action: () => ({ success: true, message: 'You resist the temptation and move on.' })
                }
            ]
        },
        {
            id: 'fountain',
            title: 'Corrupted Fountain',
            icon: '⛲',
            text: 'Dark waters bubble in an ancient fountain. Something glints beneath the surface.',
            choices: [
                { 
                    text: '💧 Drink Deep', 
                    subtext: 'Heal 2 deaths, but lose 20 embers',
                    action: () => {
                        if (AdventureState.embers >= 20) {
                            AdventureState.embers -= 20;
                            AdventureState.healDeaths(2);
                            return { success: true, message: 'The waters restore your vitality!' };
                        } else {
                            return { success: false, message: 'You cannot afford the fountain\'s price.' };
                        }
                    }
                },
                { 
                    text: '🪙 Fish for Coins', 
                    subtext: '50% chance: +30 Embers | 50% chance: Nothing',
                    action: () => {
                        if (Math.random() < 0.5) {
                            AdventureState.embers += 30;
                            return { success: true, message: 'You find coins at the bottom! +30 Embers!' };
                        } else {
                            return { success: false, message: 'The waters are empty...' };
                        }
                    }
                },
                { 
                    text: '🚶 Move On', 
                    subtext: 'Leave the fountain alone',
                    action: () => ({ success: true, message: 'You continue your journey.' })
                }
            ]
        },
        {
            id: 'merchant',
            title: 'Shadowy Merchant',
            icon: '🎭',
            text: 'A figure emerges from the darkness, their face hidden beneath a mask. "Trade?" they whisper.',
            choices: [
                { 
                    text: '💰 Buy Card', 
                    subtext: 'Pay 40 Embers for a random card',
                    action: () => {
                        if (AdventureState.embers >= 40) {
                            AdventureState.embers -= 40;
                            AdventureEngine.grantRandomCard('common');
                            return { success: true, message: 'The merchant hands you a card and vanishes.' };
                        } else {
                            return { success: false, message: '"Not enough..." the merchant fades away.' };
                        }
                    }
                },
                { 
                    text: '🎲 Gamble', 
                    subtext: 'Pay 25 Embers: Win = +60 | Lose = Nothing',
                    action: () => {
                        if (AdventureState.embers >= 25) {
                            AdventureState.embers -= 25;
                            if (Math.random() < 0.45) {
                                AdventureState.embers += 60;
                                return { success: true, message: 'You win! The merchant chuckles. +60 Embers!' };
                            } else {
                                return { success: false, message: 'You lose. The merchant vanishes with your embers.' };
                            }
                        } else {
                            return { success: false, message: '"Come back with more coin..."' };
                        }
                    }
                },
                { 
                    text: '👋 Decline', 
                    subtext: 'Walk away',
                    action: () => ({ success: true, message: 'The merchant melts back into shadow.' })
                }
            ]
        }
    ],
    
    showEvent() {
        // Mark room as cleared FIRST to prevent re-triggering
        if (AdventureState.currentRoomData) {
            AdventureState.currentRoomData.cleared = true;
        }
        
        // Pick a random event
        const event = this.eventRegistry[Math.floor(Math.random() * this.eventRegistry.length)];
        
        // Create and show the event modal
        this.showEventModal(event);
    },
    
    showEventModal(event) {
        // Remove any existing event modal
        const existing = document.getElementById('adventure-event-modal');
        if (existing) existing.remove();
        
        // Create modal
        const modal = document.createElement('div');
        modal.id = 'adventure-event-modal';
        modal.className = 'adventure-event-modal';
        modal.innerHTML = `
            <div class="event-backdrop"></div>
            <div class="event-content">
                <div class="event-icon">${event.icon}</div>
                <h2 class="event-title">${event.title}</h2>
                <p class="event-text">${event.text}</p>
                <div class="event-choices">
                    ${event.choices.map((choice, i) => `
                        <button class="event-choice" data-index="${i}">
                            <span class="choice-text">${choice.text}</span>
                            <span class="choice-subtext">${choice.subtext || ''}</span>
                        </button>
                    `).join('')}
                </div>
                <div class="event-result" id="event-result"></div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Animate in
        requestAnimationFrame(() => {
            modal.classList.add('open');
        });
        
        // Bind choice buttons
        modal.querySelectorAll('.event-choice').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                const choice = event.choices[index];
                
                // Disable all buttons
                modal.querySelectorAll('.event-choice').forEach(b => b.disabled = true);
                btn.classList.add('selected');
                
                // Execute action
                const result = choice.action();
                
                // Show result
                const resultEl = document.getElementById('event-result');
                resultEl.className = `event-result ${result.success ? 'success' : 'failure'}`;
                resultEl.textContent = result.message;
                resultEl.classList.add('show');
                
                // Update HUD
                this.updateHUD();
                
                // Close after delay
                setTimeout(() => {
                    modal.classList.remove('open');
                    setTimeout(() => {
                        modal.remove();
                        // Release the transition lock
                        AdventureEngine.transitionLock = false;
                    }, 300);
                }, 2000);
            });
        });
    }
};

// ==================== BATTLE INTEGRATION ====================

// Override win screen to handle adventure mode - wrapped in try-catch to prevent script failure
try {
    const originalWinScreenShow = window.WinScreen?.show;
    if (originalWinScreenShow) {
        window.WinScreen.show = function(data) {
            if (window.isAdventureBattle) {
                // Adventure battle ended
                const isWin = data.isWin;
                const playerDeaths = data.stats?.playerDeaths || 0;
                
                // Hide game container
                document.getElementById('game-container').style.display = 'none';
                
                // Return to adventure
                AdventureEngine.onBattleEnd(isWin, playerDeaths);
            } else {
                // Normal battle - use original
                originalWinScreenShow.call(this, data);
            }
        };
    }
} catch (e) {
    console.error('[Adventure Mode] Failed to override WinScreen:', e);
}

// ==================== INITIALIZATION ====================

// Initialize on load - with defensive setup
function initAdventureMode() {
    try {
        console.log('[Adventure Mode] Initializing...');
        
        // Make sure global objects exist
        if (typeof AdventureEngine === 'undefined') {
            console.error('[Adventure Mode] AdventureEngine not defined!');
            return;
        }
        if (typeof AdventureUI === 'undefined') {
            console.error('[Adventure Mode] AdventureUI not defined!');
            return;
        }
        
        AdventureEngine.init();
        AdventureUI.init();
        console.log('[Adventure Mode] Initialized successfully');
    } catch (e) {
        console.error('[Adventure Mode] Init error:', e);
        console.error('[Adventure Mode] Stack:', e.stack);
    }
}

// Ensure initialization happens - try multiple times if needed
function safeInitAdventureMode() {
    try {
        initAdventureMode();
    } catch (e) {
        console.error('[Adventure Mode] Safe init failed:', e);
    }
}

// Schedule initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', safeInitAdventureMode);
} else {
    // Document already loaded - init now, but also schedule a fallback
    safeInitAdventureMode();
}

// Fallback: also try to init after a short delay in case of race conditions
setTimeout(() => {
    if (typeof AdventureUI !== 'undefined' && !AdventureUI.initialized) {
        console.log('[Adventure Mode] Late initialization attempt...');
        safeInitAdventureMode();
    }
}, 500);

console.log('[Adventure Mode] Script loaded');

} catch (adventureModeError) {
    // Catch any errors during script execution
    console.error('[Adventure Mode] CRITICAL: Script failed to load!', adventureModeError);
    console.error('[Adventure Mode] Stack:', adventureModeError.stack);
    
    // Create minimal stub objects so the game doesn't crash when trying to access them
    if (typeof window.AdventureState === 'undefined') {
        window.AdventureState = { isActive: false, reset: function(){} };
    }
    if (typeof window.AdventureUI === 'undefined') {
        window.AdventureUI = {
            initialized: false,
            init: function() { console.error('[AdventureUI] Module failed to load'); },
            openSetup: function() { 
                console.error('[AdventureUI] Module failed to load');
                // Show error
                const msg = document.createElement('div');
                msg.style.cssText = `
                    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                    background: rgba(0,0,0,0.95); border: 2px solid #e57373; padding: 30px;
                    border-radius: 12px; color: #e8e0d5; font-family: 'Cinzel', serif;
                    z-index: 99999; text-align: center; max-width: 400px;
                `;
                msg.innerHTML = `
                    <div style="color: #e57373; font-size: 18px; margin-bottom: 15px;">⚠️ Adventure Mode Error</div>
                    <div style="font-size: 14px;">The Adventure Mode module failed to initialize.</div>
                    <div style="font-size: 12px; color: #888; margin: 10px 0;">This is usually caused by corrupted save data from an older version.</div>
                    <button onclick="localStorage.removeItem('cryptidFates_playerData'); location.reload();" style="
                        margin: 10px 5px; padding: 12px 20px; background: #c9302c; border: none;
                        color: white; cursor: pointer; border-radius: 6px; font-family: inherit; font-size: 14px;
                    ">Clear Save Data & Reload</button>
                    <button onclick="this.parentElement.remove(); if(HomeScreen)HomeScreen.open();" style="
                        margin: 10px 5px; padding: 12px 20px; background: #555; border: none;
                        color: white; cursor: pointer; border-radius: 6px; font-family: inherit; font-size: 14px;
                    ">Go Back</button>
                `;
                document.body.appendChild(msg);
            }
        };
    }
    if (typeof window.AdventureEngine === 'undefined') {
        window.AdventureEngine = { init: function(){}, start: function(){}, stop: function(){} };
    }
}

