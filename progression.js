/**
 * Cryptid Fates - Progression System
 * Handles player data, leveling, currency, and collection management
 */

// ==================== PLAYER DATA SYSTEM ====================
window.PlayerData = {
    // Core data
    level: 1,
    xp: 0,
    embers: 1000000, // Starting currency (free currency)
    souls: 1000000, // Premium currency
    
    // Collection: { cardKey: { owned: number, skins: { skinId: { owned: number, holoOwned: number } } } }
    collection: {},
    
    // Decks: array of deck objects
    decks: [],
    maxDeckSlots: 5,
    
    // Stats
    stats: {
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        aiWins: 0,
        aiLosses: 0,
        humanWins: 0,
        humanLosses: 0,
        totalDamageDealt: 0,
        totalKills: 0,
        favoriteCard: null,
        longestWinStreak: 0,
        currentWinStreak: 0
    },
    
    // Unlocks
    unlockedFeatures: {
        rankedMode: false,
        customBoards: false,
        tournaments: false
    },
    
    // Settings
    settings: {
        musicVolume: 0.7,
        sfxVolume: 0.8,
        animations: true,
        autoEndTurn: false
    },
    
    // Tutorial completion status
    tutorialCompleted: false,
    
    // Boosters inventory
    boosters: {
        standard: 0,
        premium: 0,
        legendary: 0
    },
    
    // Cosmetics - backgrounds, card backs, etc.
    cosmetics: {
        backgrounds: {
            owned: ['default'], // IDs of owned backgrounds
            equipped: 'default' // Currently equipped background ID
        }
    },
    
    // Available backgrounds registry
    backgroundRegistry: {
        'none': {
            id: 'none',
            name: 'No Background',
            description: 'Let your opponent\'s background take the stage, or show the void.',
            image: null, // No image - uses transparent/none
            price: 0,
            currency: 'embers'
        },
        'default': {
            id: 'default',
            name: 'Classic Battlefield',
            description: 'The original battlefield, shrouded in darkness.',
            image: 'sprites/test-battlefield-bg.jpg',
            price: 0, // Free (default)
            currency: 'embers'
        },
        'frozen-tundra': {
            id: 'frozen-tundra',
            name: 'Frozen Tundra',
            description: 'An icy wasteland where ancient horrors lie frozen.',
            image: 'sprites/test-battlefield-snow.jpg',
            price: 500,
            currency: 'embers'
        }
    },
    
    // ==================== XP & LEVELING ====================
    
    /**
     * XP required for a given level
     * Scales smoothly: Level 1→2 = 100xp, Level 50→51 = ~500xp
     */
    getXPForLevel(level) {
        return Math.floor(100 + (level - 1) * 8 + Math.pow(level - 1, 1.5) * 2);
    },
    
    /**
     * Total XP required to reach a level from 0
     */
    getTotalXPForLevel(level) {
        let total = 0;
        for (let i = 1; i < level; i++) {
            total += this.getXPForLevel(i);
        }
        return total;
    },
    
    /**
     * Add XP and handle level ups
     * Returns { levelsGained, rewards }
     */
    addXP(amount) {
        const startLevel = this.level;
        this.xp += amount;
        
        const rewards = [];
        let levelsGained = 0;
        
        // Check for level ups
        while (this.xp >= this.getXPForLevel(this.level)) {
            this.xp -= this.getXPForLevel(this.level);
            this.level++;
            levelsGained++;
            
            // Level rewards
            const levelReward = this.getLevelReward(this.level);
            rewards.push(levelReward);
            
            // Apply rewards
            this.embers += levelReward.currency;
            if (levelReward.boosterPack) {
                this.pendingBoosters = (this.pendingBoosters || 0) + 1;
            }
            if (levelReward.deckSlot && this.maxDeckSlots < 25) {
                this.maxDeckSlots++;
            }
        }
        
        this.save();
        
        return {
            levelsGained,
            newLevel: this.level,
            rewards,
            currentXP: this.xp,
            xpToNext: this.getXPForLevel(this.level)
        };
    },
    
    /**
     * Get reward for reaching a specific level
     */
    getLevelReward(level) {
        const reward = {
            level,
            currency: 25 + Math.floor(level / 5) * 10, // Base 25, +10 every 5 levels
            boosterPack: level % 10 === 0, // Every 10 levels
            deckSlot: level % 10 === 0 && this.maxDeckSlots < 25, // Every 10 levels until cap
            special: null
        };
        
        // Milestone rewards
        if (level === 10) reward.special = { type: 'title', value: 'Apprentice Summoner' };
        if (level === 25) reward.special = { type: 'cardBack', value: 'flames_rising' };
        if (level === 50) reward.special = { type: 'title', value: 'Cryptid Master' };
        if (level === 100) reward.special = { type: 'board', value: 'obsidian_altar' };
        
        return reward;
    },
    
    /**
     * Get current level progress as percentage
     */
    getLevelProgress() {
        const required = this.getXPForLevel(this.level);
        return Math.min(100, (this.xp / required) * 100);
    },
    
    // ==================== CURRENCY ====================
    
    /**
     * Add currency (Embers)
     */
    addCurrency(amount, source = 'unknown') {
        this.embers += amount;
        console.log(`+${amount} Embers (${source}). Total: ${this.embers}`);
        this.save();
        return this.embers;
    },
    
    /**
     * Spend currency if possible
     */
    spendCurrency(amount) {
        if (this.embers >= amount) {
            this.embers -= amount;
            this.save();
            return true;
        }
        return false;
    },
    
    /**
     * Calculate match rewards
     */
    calculateMatchRewards(isWin, isHuman, matchStats = {}) {
        // Base XP
        let baseXP = isWin ? 50 : 20;
        
        // Multipliers for match type
        const xpMultiplier = isHuman ? 1.5 : 1.0;
        
        // Currency rates as specified
        let currencyMultiplier;
        if (isHuman) {
            currencyMultiplier = isWin ? 2.5 : 0.5;
        } else {
            currencyMultiplier = isWin ? 0.2 : 0.1;
        }
        
        // Base currency per match
        const baseCurrency = 100;
        
        // Bonus XP for performance
        let bonusXP = 0;
        if (matchStats.kills) bonusXP += matchStats.kills * 2;
        if (matchStats.damageDealt) bonusXP += Math.floor(matchStats.damageDealt / 10);
        if (matchStats.perfectWin) bonusXP += 25; // No deaths
        if (matchStats.comeback) bonusXP += 15; // Won from behind
        
        // Win streak bonus
        if (isWin) {
            this.stats.currentWinStreak++;
            if (this.stats.currentWinStreak > this.stats.longestWinStreak) {
                this.stats.longestWinStreak = this.stats.currentWinStreak;
            }
            // +5% per win streak, max 50%
            const streakBonus = Math.min(0.5, this.stats.currentWinStreak * 0.05);
            baseXP = Math.floor(baseXP * (1 + streakBonus));
        } else {
            this.stats.currentWinStreak = 0;
        }
        
        const totalXP = Math.floor((baseXP + bonusXP) * xpMultiplier);
        const totalCurrency = Math.floor(baseCurrency * currencyMultiplier);
        
        return {
            xp: totalXP,
            currency: totalCurrency,
            breakdown: {
                baseXP,
                bonusXP,
                xpMultiplier,
                baseCurrency,
                currencyMultiplier,
                winStreak: this.stats.currentWinStreak
            }
        };
    },
    
    // ==================== COLLECTION ====================
    
    /**
     * Initialize collection with starter cards
     */
    initializeStarterCollection() {
        // Give 3 copies of each common cryptid (so user can customize after starter deck)
        const commonCryptids = ['emberFox', 'shadowCat', 'voidWraith', 'frostSpider', 'mossTurtle', 
                                'sewerAlligator', 'libraryGargoyle', 'fireImp'];
        commonCryptids.forEach(key => this.addToCollection(key, 3));
        
        // Give 2 copies of each rare
        const rareCryptids = ['stoneGolem', 'thunderBird', 'lightningWolf', 'vampireInitiate', 
                             'thunderSerpent', 'shadowLeech'];
        rareCryptids.forEach(key => this.addToCollection(key, 2));
        
        // Give starter spells (3 of common, 2 of rare)
        ['pyreBolt', 'heal', 'protect'].forEach(key => this.addToCollection(key, 3));
        ['empower', 'shatter'].forEach(key => this.addToCollection(key, 2));
        
        // Give starter traps
        ['voidSnare', 'soulMirror', 'spiritWard'].forEach(key => this.addToCollection(key, 3));
        
        // Give starter auras
        ['adrenaline'].forEach(key => this.addToCollection(key, 3));
        
        // Give pyre cards
        ['basicPyre'].forEach(key => this.addToCollection(key, 6));
        ['forgottenGraveyard'].forEach(key => this.addToCollection(key, 2));
        
        // All kindling are always owned (free summons)
        if (typeof CardRegistry !== 'undefined' && CardRegistry.getAllKindlingKeys) {
            CardRegistry.getAllKindlingKeys().forEach(key => {
                this.addToCollection(key, 4);
            });
        }
        
        this.save();
    },
    
    /**
     * Create a pre-built starter deck from the selected starter deck type
     */
    createStarterDeck(starterDeckId = 'city-of-flesh') {
        const starterDecks = {
            'city-of-flesh': {
                name: 'City of Flesh',
                cryptids: ['rooftopGargoyle', 'libraryGargoyle', 'vampireInitiate', 'vampireLord', 
                           'sewerAlligator', 'kuchisakeOnna', 'hellhound', 'mothman', 'bogeyman', 
                           'theFlayer', 'decayRat'],
                kindling: ['hellpup', 'myling', 'vampireBat', 'gremlin', 'boggart'],
                pyres: ['pyre', 'freshKill', 'ratKing', 'nightfall'],
                traps: ['crossroads', 'bloodCovenant', 'turnToStone'],
                bursts: ['wakingNightmare', 'faceOff'],
                auras: ['antiVampiricBlade']
            },
            'forests-of-fear': {
                name: 'Forests of Fear',
                cryptids: ['matureWendigo', 'primalWendigo', 'thunderbird', 'adultBigfoot',
                           'werewolf', 'lycanthrope', 'snipe', 'rogueRazorback', 'notDeer', 
                           'jerseyDevil', 'babaYaga', 'skinwalker'],
                kindling: ['newbornWendigo', 'stormhawk', 'adolescentBigfoot', 'cursedHybrid', 'deerWoman'],
                pyres: ['burialGround', 'cursedWoods', 'animalPelts'],
                traps: ['terrify', 'hunt'],
                bursts: ['fullMoon'],
                auras: ['dauntingPresence', 'sproutWings', 'weaponizedTree', 'insatiableHunger']
            }
        };
        
        const starterDeck = starterDecks[starterDeckId] || starterDecks['city-of-flesh'];
        
        const deck = {
            id: Date.now(),
            name: starterDeck.name + ' Starter',
            cards: [],
            created: Date.now(),
            modified: Date.now(),
            wins: 0,
            losses: 0,
            favorite: true
        };
        
        // Helper to add cards to both deck and collection
        const addCards = (keys, countPerCard) => {
            keys.forEach(key => {
                // Add to collection (grant enough copies)
                this.grantCardToCollection(key, countPerCard);
                // Add to deck
                for (let i = 0; i < countPerCard; i++) {
                    deck.cards.push({ cardKey: key });
                }
            });
        };
        
        // Add cryptids (2x each)
        addCards(starterDeck.cryptids, 2);
        
        // Add kindling (3x each)
        addCards(starterDeck.kindling, 3);
        
        // Add pyre cards (4x each)
        addCards(starterDeck.pyres, 4);
        
        // Add traps (2x each)
        addCards(starterDeck.traps, 2);
        
        // Add bursts (2x each)
        addCards(starterDeck.bursts, 2);
        
        // Add auras (2x each)
        addCards(starterDeck.auras, 2);
        
        // If under 55 cards, add more kindling
        while (deck.cards.length < 55 && starterDeck.kindling.length > 0) {
            const key = starterDeck.kindling[deck.cards.length % starterDeck.kindling.length];
            // Make sure we own enough
            const currentOwned = this.getOwnedCount(key);
            const currentInDeck = deck.cards.filter(c => c.cardKey === key).length;
            if (currentInDeck >= currentOwned) {
                this.grantCardToCollection(key, 1);
            }
            deck.cards.push({ cardKey: key });
        }
        
        console.log('[PlayerData] Created starter deck with', deck.cards.length, 'cards');
        
        this.decks.push(deck);
        this.save();
        
        return deck;
    },
    
    /**
     * Grant cards to collection without triggering full save (used for starter deck creation)
     */
    grantCardToCollection(cardKey, count = 1) {
        if (!this.collection[cardKey]) {
            this.collection[cardKey] = { owned: 0, skins: {} };
        }
        this.collection[cardKey].owned += count;
    },
    
    /**
     * Add card(s) to collection
     */
    addToCollection(cardKey, count = 1, skinId = null, isHolo = false) {
        if (!this.collection[cardKey]) {
            this.collection[cardKey] = { owned: 0, skins: {} };
        }
        
        if (skinId) {
            if (!this.collection[cardKey].skins[skinId]) {
                this.collection[cardKey].skins[skinId] = { owned: 0, holoOwned: 0 };
            }
            if (isHolo) {
                this.collection[cardKey].skins[skinId].holoOwned += count;
            } else {
                this.collection[cardKey].skins[skinId].owned += count;
            }
        } else {
            if (isHolo) {
                this.collection[cardKey].holoOwned = (this.collection[cardKey].holoOwned || 0) + count;
            } else {
                this.collection[cardKey].owned += count;
            }
        }
        
        this.save();
        return this.collection[cardKey];
    },
    
    /**
     * Get owned count for a card
     */
    getOwnedCount(cardKey, skinId = null, holoOnly = false) {
        const card = this.collection[cardKey];
        if (!card) return 0;
        
        if (skinId) {
            const skin = card.skins[skinId];
            if (!skin) return 0;
            return holoOnly ? skin.holoOwned : skin.owned + skin.holoOwned;
        }
        
        if (holoOnly) return card.holoOwned || 0;
        return card.owned + (card.holoOwned || 0);
    },
    
    /**
     * Check if player owns at least one copy of a card
     */
    ownsCard(cardKey) {
        return this.getOwnedCount(cardKey) > 0;
    },
    
    /**
     * Get all owned cards with counts
     */
    getOwnedCards() {
        const owned = [];
        for (const [key, data] of Object.entries(this.collection)) {
            if (data.owned > 0 || (data.holoOwned && data.holoOwned > 0)) {
                owned.push({ key, ...data });
            }
        }
        return owned;
    },
    
    // ==================== DECKS ====================
    
    /**
     * Create a new deck
     */
    createDeck(name = 'New Deck') {
        if (this.decks.length >= this.maxDeckSlots) {
            return { success: false, error: 'Maximum deck slots reached' };
        }
        
        const deck = {
            id: Date.now(),
            name: name.substring(0, 24),
            cards: [], // Array of { cardKey, skinId?, isHolo? }
            created: Date.now(),
            modified: Date.now(),
            wins: 0,
            losses: 0,
            favorite: false
        };
        
        this.decks.push(deck);
        this.save();
        
        return { success: true, deck };
    },
    
    /**
     * Delete a deck
     */
    deleteDeck(deckId) {
        const index = this.decks.findIndex(d => d.id === deckId);
        if (index > -1) {
            this.decks.splice(index, 1);
            this.save();
            return true;
        }
        return false;
    },
    
    /**
     * Update deck
     */
    updateDeck(deckId, updates) {
        const deck = this.decks.find(d => d.id === deckId);
        if (!deck) return false;
        
        if (updates.name) deck.name = updates.name.substring(0, 24);
        if (updates.cards) deck.cards = updates.cards;
        if (updates.favorite !== undefined) deck.favorite = updates.favorite;
        deck.modified = Date.now();
        
        this.save();
        return true;
    },
    
    /**
     * Validate a deck
     */
    validateDeck(deck) {
        const errors = [];
        const cardCounts = {};
        
        // Count cards in deck
        for (const entry of deck.cards) {
            cardCounts[entry.cardKey] = (cardCounts[entry.cardKey] || 0) + 1;
        }
        
        // Check total count
        if (deck.cards.length < 55) {
            errors.push(`Deck has ${deck.cards.length} cards (minimum 55)`);
        }
        if (deck.cards.length > 100) {
            errors.push(`Deck has ${deck.cards.length} cards (maximum 100)`);
        }
        
        // Check ownership
        for (const [cardKey, count] of Object.entries(cardCounts)) {
            const owned = this.getOwnedCount(cardKey);
            if (count > owned) {
                const card = CardRegistry.getCryptid(cardKey) || 
                            CardRegistry.getBurst(cardKey) || 
                            CardRegistry.getTrap(cardKey) ||
                            CardRegistry.getAura(cardKey) ||
                            CardRegistry.getPyre(cardKey) ||
                            CardRegistry.getKindling(cardKey);
                const name = card?.name || cardKey;
                errors.push(`Not enough copies of ${name} (need ${count}, own ${owned})`);
            }
        }
        
        return {
            valid: errors.length === 0,
            errors,
            cardCount: deck.cards.length
        };
    },
    
    /**
     * Get deck for gameplay (converts to card objects)
     */
    getDeckForPlay(deckId) {
        const deck = this.decks.find(d => d.id === deckId);
        if (!deck) return null;
        
        const cards = [];
        const kindling = [];
        let id = 1;
        let kindlingId = 1000;
        
        for (const entry of deck.cards) {
            // Check if it's a kindling card first
            let kindlingCard = CardRegistry.getKindling(entry.cardKey);
            if (kindlingCard) {
                kindling.push({
                    ...kindlingCard,
                    id: kindlingId++,
                    skinId: entry.skinId,
                    isHolo: entry.isHolo
                });
                continue; // Don't add to main deck
            }
            
            // Check other card types for main deck
            let card = CardRegistry.getCryptid(entry.cardKey) ||
                      CardRegistry.getBurst(entry.cardKey) ||
                      CardRegistry.getTrap(entry.cardKey) ||
                      CardRegistry.getAura(entry.cardKey) ||
                      CardRegistry.getPyre(entry.cardKey);
            
            if (card) {
                cards.push({
                    ...card,
                    id: id++,
                    skinId: entry.skinId,
                    isHolo: entry.isHolo
                });
            }
        }
        
        // Shuffle main deck
        for (let i = cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [cards[i], cards[j]] = [cards[j], cards[i]];
        }
        
        // Return both deck and kindling
        return { cards, kindling };
    },
    
    // ==================== COSMETICS ====================
    
    /**
     * Get the currently equipped background
     */
    getEquippedBackground() {
        return this.cosmetics?.backgrounds?.equipped || 'default';
    },
    
    /**
     * Get background data by ID
     */
    getBackground(bgId) {
        return this.backgroundRegistry[bgId] || this.backgroundRegistry['default'];
    },
    
    /**
     * Get all available backgrounds
     */
    getAllBackgrounds() {
        return Object.values(this.backgroundRegistry);
    },
    
    /**
     * Check if player owns a background
     */
    ownsBackground(bgId) {
        return this.cosmetics?.backgrounds?.owned?.includes(bgId) || bgId === 'default' || bgId === 'none';
    },
    
    /**
     * Purchase a background
     */
    purchaseBackground(bgId) {
        const bg = this.backgroundRegistry[bgId];
        if (!bg) return { success: false, error: 'Background not found' };
        if (this.ownsBackground(bgId)) return { success: false, error: 'Already owned' };
        
        const currency = bg.currency || 'embers';
        const price = bg.price || 0;
        
        if (this[currency] < price) {
            return { success: false, error: 'Insufficient ' + currency };
        }
        
        this[currency] -= price;
        this.cosmetics.backgrounds.owned.push(bgId);
        this.save();
        
        return { success: true };
    },
    
    /**
     * Equip a background
     */
    equipBackground(bgId) {
        if (!this.ownsBackground(bgId)) return false;
        this.cosmetics.backgrounds.equipped = bgId;
        this.save();
        return true;
    },
    
    // ==================== PERSISTENCE ====================
    
    /**
     * Save to localStorage
     */
    save() {
        const data = {
            level: this.level,
            xp: this.xp,
            embers: this.embers,
            souls: this.souls,
            collection: this.collection,
            decks: this.decks,
            maxDeckSlots: this.maxDeckSlots,
            stats: this.stats,
            unlockedFeatures: this.unlockedFeatures,
            settings: this.settings,
            tutorialCompleted: this.tutorialCompleted,
            boosters: this.boosters,
            pendingBoosters: this.pendingBoosters || 0,
            starterDeck: this.starterDeck,
            cosmetics: this.cosmetics,
            lastSave: Date.now()
        };
        
        try {
            localStorage.setItem('cryptidFates_playerData', JSON.stringify(data));
        } catch (e) {
            console.error('Failed to save player data:', e);
        }
    },
    
    /**
     * Load from localStorage
     */
    load() {
        try {
            const saved = localStorage.getItem('cryptidFates_playerData');
            if (saved) {
                const data = JSON.parse(saved);
                // Handle backwards compatibility with old field names
                if (data.currency !== undefined) {
                    data.embers = data.currency;
                    delete data.currency;
                }
                if (data.premiumCurrency !== undefined) {
                    data.souls = data.premiumCurrency;
                    delete data.premiumCurrency;
                }
                // Ensure boosters object exists
                if (!data.boosters) {
                    data.boosters = { standard: 0, premium: 0, legendary: 0 };
                }
                // Ensure cosmetics object exists (backwards compatibility)
                if (!data.cosmetics) {
                    data.cosmetics = {
                        backgrounds: {
                            owned: ['default'],
                            equipped: 'default'
                        }
                    };
                }
                Object.assign(this, data);
                console.log('Player data loaded. Level:', this.level);
                return true;
            }
        } catch (e) {
            console.error('Failed to load player data:', e);
        }
        return false;
    },
    
    /**
     * Reset all data (for testing)
     */
    reset() {
        localStorage.removeItem('cryptidFates_playerData');
        location.reload();
    },
    
    /**
     * Initialize player data
     */
    init() {
        const loaded = this.load();
        
        // Check if collection is empty (new player or old data)
        const hasCards = Object.keys(this.collection).length > 0;
        
        if (!loaded || !hasCards) {
            // New player or needs starter collection
            this.initializeStarterCollection();
            // Don't create starter deck here - wait for player to select their starter deck
            // The deck will be created in grantStarterDeck() in home-screen.js
            this.save();
            console.log('Starter collection initialized');
            
            // Flag for welcome screen
            this.showWelcome = true;
        } else {
            // Existing player - check if their starter deck needs fixing
            this.migrateStarterDeck();
        }
        
        // Ensure kindling are always available
        if (typeof CardRegistry !== 'undefined' && CardRegistry.getAllKindlingKeys) {
            CardRegistry.getAllKindlingKeys().forEach(key => {
                if (!this.collection[key] || this.collection[key].owned < 2) {
                    this.addToCollection(key, 2);
                }
            });
        }
    },
    
    /**
     * Fix broken starter decks that have invalid card keys
     */
    migrateStarterDeck() {
        // Check if any deck has broken card keys (cards that don't exist)
        const invalidKeys = ['emberFox', 'shadowCat', 'voidWraith', 'frostSpider', 'mossTurtle', 
                            'fireImp', 'stoneGolem', 'thunderBird', 'lightningWolf', 'thunderSerpent',
                            'shadowLeech', 'pyreBolt', 'heal', 'protect', 'empower', 'shatter',
                            'voidSnare', 'soulMirror', 'spiritWard', 'adrenaline', 'basicPyre', 
                            'forgottenGraveyard'];
        
        let needsRebuild = false;
        
        for (const deck of this.decks) {
            for (const entry of deck.cards) {
                if (invalidKeys.includes(entry.cardKey)) {
                    needsRebuild = true;
                    break;
                }
            }
            if (needsRebuild) break;
        }
        
        if (needsRebuild) {
            console.log('[PlayerData] Found broken starter deck, rebuilding...');
            // Remove the broken deck
            this.decks = this.decks.filter(d => {
                const hasBroken = d.cards.some(c => invalidKeys.includes(c.cardKey));
                return !hasBroken;
            });
            
            // Create a new valid starter deck based on their selected starter or default
            const starterDeckId = this.starterDeck || 'city-of-flesh';
            this.createStarterDeck(starterDeckId);
            this.save();
            console.log('[PlayerData] Rebuilt starter deck with', starterDeckId);
        }
        
        // Ensure all cards in existing decks are owned in collection
        this.ensureDeckCardsOwned();
    },
    
    /**
     * Ensure all cards in decks are owned in collection (migration for old saves)
     */
    ensureDeckCardsOwned() {
        let cardsAdded = 0;
        
        for (const deck of this.decks) {
            // Count cards needed per key
            const needed = {};
            for (const entry of deck.cards) {
                needed[entry.cardKey] = (needed[entry.cardKey] || 0) + 1;
            }
            
            // Grant any missing cards
            for (const [cardKey, count] of Object.entries(needed)) {
                const owned = this.getOwnedCount(cardKey);
                if (owned < count) {
                    const toGrant = count - owned;
                    this.grantCardToCollection(cardKey, toGrant);
                    cardsAdded += toGrant;
                }
            }
        }
        
        if (cardsAdded > 0) {
            console.log('[PlayerData] Granted', cardsAdded, 'missing cards to collection');
            this.save();
        }
    }
};

// ==================== CARD SKIN REGISTRY ====================
window.CardSkins = {
    skins: {},
    
    registerSkin(cardKey, skinId, data) {
        if (!this.skins[cardKey]) this.skins[cardKey] = {};
        this.skins[cardKey][skinId] = {
            id: skinId,
            name: data.name,
            sprite: data.sprite,
            rarity: data.rarity || 'rare', // rare, epic, legendary
            obtainedFrom: data.obtainedFrom || 'booster', // booster, shop, event, achievement
            ...data
        };
    },
    
    getSkinsForCard(cardKey) {
        return this.skins[cardKey] || {};
    },
    
    getSkin(cardKey, skinId) {
        return this.skins[cardKey]?.[skinId];
    }
};

// Register some example skins
CardSkins.registerSkin('emberFox', 'arctic', {
    name: 'Arctic Fox',
    sprite: '🦊',
    rarity: 'epic',
    description: 'A frost-touched variant from the northern wastes'
});

CardSkins.registerSkin('vampireInitiate', 'bloodmoon', {
    name: 'Blood Moon Initiate',
    sprite: 'https://example.com/bloodmoon-vampire.png',
    rarity: 'legendary',
    description: 'Awakened under the crimson moon'
});

CardSkins.registerSkin('mothman', 'neon', {
    name: 'Neon Mothman',
    sprite: 'https://example.com/neon-mothman.png',
    rarity: 'legendary',
    description: 'City lights beckon the prophet of doom'
});

console.log('Progression system loaded');