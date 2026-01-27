/**
 * Cryptid Fates - Adventure Mode (Roguelite Sidescroller)
 * A survival horror themed exploration between card battles
 * 
 * Features:
 * - 2D sidescroller room-based exploration
 * - Persistent death counter across battles
 * - Relic system with passive effects
 * - 3 floors × 10 rooms + boss per floor
 * - Card discovery during runs
 */

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
        
        return {
            ...template,
            id: `floor${floor}_room${index}`,
            index,
            floor,
            cleared: false,
            visited: false,
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
        width: 40,
        height: 60,
        grounded: true,
        facing: 1, // 1 = right, -1 = left
        state: 'idle', // idle, walking, interacting
        interactTarget: null
    },
    
    // Room dimensions
    room: {
        width: 700,
        height: 400,
        groundY: 320
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
        moveSpeed: 4,
        gravity: 0.8,
        jumpForce: -12,
        friction: 0.85
    },
    
    // Visual settings
    visuals: {
        fogOpacity: 0.7,
        ambientParticles: [],
        screenShake: 0
    },
    
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
        this.canvas.width = this.room.width;
        this.canvas.height = this.room.height;
        this.ctx = this.canvas.getContext('2d');
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
                background: #0a0806;
                display: none;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                font-family: 'Cinzel', serif;
            }
            
            #adventure-screen.open {
                display: flex;
            }
            
            /* Canvas Container */
            .adventure-viewport {
                position: relative;
                border: 3px solid rgba(232, 169, 62, 0.4);
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 
                    0 0 40px rgba(0, 0, 0, 0.8),
                    inset 0 0 60px rgba(0, 0, 0, 0.5);
            }
            
            #adventure-canvas {
                display: block;
                image-rendering: pixelated;
            }
            
            /* HUD Overlay */
            .adventure-hud {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                padding: 10px 15px;
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                pointer-events: none;
                background: linear-gradient(180deg, rgba(0,0,0,0.7) 0%, transparent 100%);
            }
            
            .adventure-hud > * {
                pointer-events: auto;
            }
            
            .hud-left, .hud-right {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .hud-stat {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 14px;
                color: #e8e0d5;
                text-shadow: 0 2px 4px rgba(0,0,0,0.8);
            }
            
            .hud-stat .icon {
                font-size: 16px;
            }
            
            .hud-stat.deaths .value {
                color: #e57373;
            }
            
            .hud-stat.embers .value {
                color: #e8a93e;
            }
            
            .floor-indicator {
                font-size: 12px;
                color: #a89070;
                letter-spacing: 2px;
            }
            
            /* Room info bar */
            .room-info-bar {
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                padding: 10px 15px;
                background: linear-gradient(0deg, rgba(0,0,0,0.8) 0%, transparent 100%);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .room-name {
                font-size: 16px;
                color: #e8a93e;
                text-shadow: 0 2px 4px rgba(0,0,0,0.8);
            }
            
            .room-hint {
                font-size: 12px;
                color: #a89070;
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
        `;
        document.head.appendChild(style);
    },
    
    // ==================== GAME LOOP ====================
    
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastTime = performance.now();
        this.player.x = 100;
        this.player.y = this.room.groundY - this.player.height;
        this.player.vx = 0;
        this.player.vy = 0;
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
                this.player.state = 'idle';
            }
        }
        
        // Apply velocity
        this.player.x += this.player.vx * dt;
        
        // Boundary checks / room transitions
        if (this.player.x < -20) {
            // Exit left - go back (if allowed)
            this.tryExitLeft();
        } else if (this.player.x > this.room.width - this.player.width + 20) {
            // Exit right - advance
            this.tryExitRight();
        }
        
        // Clamp position
        this.player.x = Math.max(0, Math.min(this.room.width - this.player.width, this.player.x));
        
        // Ground collision
        this.player.y = this.room.groundY - this.player.height;
        
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
        // Can't go back in adventure mode
        this.player.x = 0;
        AdventureUI.showMessage("The path behind has collapsed...");
    },
    
    tryExitRight() {
        const room = AdventureState.currentRoomData;
        if (!room) return;
        
        // If room has an encounter that hasn't been cleared
        if (room.encounter && !room.cleared) {
            this.enterEncounter(room);
            return;
        }
        
        // Advance to next room
        this.advanceRoom();
    },
    
    enterEncounter(room) {
        const encounterType = room.encounter;
        
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
        this.stop();
        
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
        
        // If room is cleared, advance player to right side ready to exit
        if (AdventureState.currentRoomData?.cleared) {
            this.player.x = this.room.width - 150;
        }
        
        // Show adventure screen
        document.getElementById('adventure-screen').classList.add('open');
        AdventureUI.updateHUD();
        
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
            
            // Reset player position
            this.player.x = 50;
            
            // Update UI
            AdventureUI.updateRoomInfo();
            AdventureUI.updateHUD();
            
            // Check for special room types
            this.handleRoomEntry();
            
            setTimeout(() => {
                if (transition) {
                    transition.classList.remove('active');
                }
            }, 300);
        }, 300);
    },
    
    handleRoomEntry() {
        const room = AdventureState.currentRoomData;
        if (!room) return;
        
        switch (room.type) {
            case 'shop':
                // Open shop modal
                setTimeout(() => AdventureUI.openShop(), 500);
                break;
            case 'rest':
                // Auto-heal at rest sites
                setTimeout(() => this.handleRestSite(), 500);
                break;
            case 'event':
                // Random event
                setTimeout(() => AdventureUI.showEvent(), 500);
                break;
            case 'treasure':
                // Already handled by interactables
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
        
        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(p.x + p.width / 2, this.room.groundY + 5, p.width / 2, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Body (simple shape for now)
        ctx.fillStyle = '#2a2520';
        ctx.fillRect(p.x + 5, p.y + 15, p.width - 10, p.height - 15);
        
        // Cloak
        ctx.fillStyle = '#1a1510';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y + 20);
        ctx.lineTo(p.x + p.width / 2, p.y + 10);
        ctx.lineTo(p.x + p.width, p.y + 20);
        ctx.lineTo(p.x + p.width - 5, p.y + p.height);
        ctx.lineTo(p.x + 5, p.y + p.height);
        ctx.closePath();
        ctx.fill();
        
        // Head
        ctx.fillStyle = '#3a3530';
        ctx.beginPath();
        ctx.arc(p.x + p.width / 2, p.y + 15, 12, 0, Math.PI * 2);
        ctx.fill();
        
        // Eyes (ember glow)
        ctx.fillStyle = '#e8a93e';
        const eyeOffset = p.facing > 0 ? 3 : -3;
        ctx.beginPath();
        ctx.arc(p.x + p.width / 2 + eyeOffset - 4, p.y + 13, 2, 0, Math.PI * 2);
        ctx.arc(p.x + p.width / 2 + eyeOffset + 4, p.y + 13, 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Walking animation - bob
        if (p.state === 'walking') {
            const bob = Math.sin(Date.now() / 100) * 2;
            ctx.translate(0, bob);
        }
        
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
        
        // Right exit (forward)
        ctx.fillStyle = room?.cleared ? 'rgba(100, 200, 100, 0.5)' : 'rgba(232, 169, 62, 0.3)';
        ctx.beginPath();
        ctx.moveTo(this.room.width - 20, this.room.groundY - 60);
        ctx.lineTo(this.room.width, this.room.groundY - 40);
        ctx.lineTo(this.room.width - 20, this.room.groundY - 20);
        ctx.closePath();
        ctx.fill();
        
        // Left exit indicator (blocked)
        ctx.fillStyle = 'rgba(100, 50, 50, 0.3)';
        ctx.font = '20px serif';
        ctx.fillText('✕', 5, this.room.groundY - 35);
    }
};

// ==================== ADVENTURE UI ====================

window.AdventureUI = {
    init() {
        this.createScreens();
        this.bindEvents();
    },
    
    createScreens() {
        // Main adventure screen
        if (!document.getElementById('adventure-screen')) {
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
            
            // Insert canvas
            const viewport = screen.querySelector('.adventure-viewport');
            viewport.insertBefore(AdventureEngine.canvas, viewport.firstChild);
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
    
    openSetup() {
        this.setupStep = 'deck';
        this.selectedDeck = null;
        this.selectedRelic = null;
        this.relicChoices = RelicRegistry.getRandomStarterRelics(3);
        
        this.renderDeckOptions();
        document.getElementById('deck-selection-step').style.display = 'block';
        document.getElementById('relic-selection-step').style.display = 'none';
        document.getElementById('adv-continue-btn').disabled = true;
        document.getElementById('adv-continue-btn').textContent = 'Select a Deck';
        
        document.getElementById('adventure-setup').classList.add('open');
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
    
    openShop() {
        // Simple shop for now
        const items = [
            { name: 'Heal 2 Deaths', cost: 30, effect: () => AdventureState.healDeaths(2) },
            { name: 'Random Card', cost: 50, effect: () => AdventureEngine.grantRandomCard('common') },
            { name: 'Reveal Traps', cost: 20, effect: () => this.revealTraps() }
        ];
        
        const choice = Math.floor(Math.random() * items.length);
        const item = items[choice];
        
        if (AdventureState.embers >= item.cost) {
            if (confirm(`Buy ${item.name} for ${item.cost} embers?`)) {
                AdventureState.embers -= item.cost;
                item.effect();
                this.showMessage(`Purchased: ${item.name}`);
                this.updateHUD();
            }
        } else {
            this.showMessage('Not enough embers...');
        }
        
        AdventureState.currentRoomData.cleared = true;
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
    
    showEvent() {
        const events = [
            {
                title: 'Mysterious Altar',
                text: 'A dark altar pulses with energy. Sacrifice 1 death to gain a card?',
                choices: [
                    { text: 'Sacrifice', action: () => {
                        if (AdventureState.deadCryptidCount > 0) {
                            AdventureState.healDeaths(1);
                            AdventureEngine.grantRandomCard('rare');
                        } else {
                            this.showMessage('Nothing to sacrifice...');
                        }
                    }},
                    { text: 'Leave', action: () => {} }
                ]
            },
            {
                title: 'Wandering Spirit',
                text: 'A lost soul offers guidance. Gain 20 embers.',
                choices: [
                    { text: 'Accept', action: () => {
                        AdventureState.embers += 20;
                        this.showMessage('+20 Embers');
                    }}
                ]
            },
            {
                title: 'Cursed Treasure',
                text: 'A chest radiates dark energy. Risk 1 death for potential riches?',
                choices: [
                    { text: 'Open', action: () => {
                        if (Math.random() < 0.6) {
                            AdventureState.embers += 50;
                            this.showMessage('+50 Embers!');
                        } else {
                            AdventureState.addDeaths(1);
                            this.showMessage('Cursed! +1 Death');
                        }
                    }},
                    { text: 'Leave', action: () => {} }
                ]
            }
        ];
        
        const event = events[Math.floor(Math.random() * events.length)];
        
        // Simple confirm dialog for now
        const choice = event.choices.length > 1 
            ? confirm(`${event.title}\n\n${event.text}\n\nClick OK to ${event.choices[0].text}, Cancel to ${event.choices[1]?.text || 'Leave'}`)
            : (alert(`${event.title}\n\n${event.text}`), true);
        
        if (choice) {
            event.choices[0].action();
        } else if (event.choices[1]) {
            event.choices[1].action();
        }
        
        this.updateHUD();
        AdventureState.currentRoomData.cleared = true;
    }
};

// ==================== BATTLE INTEGRATION ====================

// Override win screen to handle adventure mode
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

// ==================== INITIALIZATION ====================

// Initialize on load
function initAdventureMode() {
    try {
        console.log('[Adventure Mode] Initializing...');
        AdventureEngine.init();
        AdventureUI.init();
        console.log('[Adventure Mode] Initialized successfully');
    } catch (e) {
        console.error('[Adventure Mode] Init error:', e);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdventureMode);
} else {
    initAdventureMode();
}

console.log('[Adventure Mode] Script loaded');

