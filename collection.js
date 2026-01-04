/**
 * Cryptid Fates - Collection Browser
 * Browse card sets, view collection progress, admire your cards
 */

window.Collection = {
    isOpen: false,
    currentSet: null,
    mode: 'sets', // 'sets' or 'cards'
    
    // Card Sets Registry
    sets: {
        'city-of-flesh': {
            id: 'city-of-flesh',
            name: 'City of Flesh',
            type: 'deck', // 'deck' or 'expansion'
            released: 1, // First set (lower = older)
            description: 'Dark creatures of the night lurk in the City of Flesh. Vampires, gargoyles, and nightmares await.',
            icon: '🏚️',
            cards: [] // Will be populated from CardRegistry
        },
        'forests-of-fear': {
            id: 'forests-of-fear',
            name: 'Forests of Fear',
            type: 'deck',
            released: 2,
            description: 'Ancient terrors stalk the primeval woods. Wendigos, werewolves, and forest spirits hunger for prey.',
            icon: '🌲',
            cards: []
        },
        'putrid-swamp': {
            id: 'putrid-swamp',
            name: 'Putrid Swamp',
            type: 'deck',
            released: 3,
            description: 'Cajun folklore comes alive in the bayou. Voodoo curses, swamp monsters, and the restless dead rise from murky waters.',
            icon: '🐊',
            cards: []
        },
        'diabolical-desert': {
            id: 'diabolical-desert',
            name: 'Diabolical Desert',
            type: 'deck',
            released: 4,
            description: 'Scorching sands hide ancient horrors. Djinn, mummies, and sandworms rise from forgotten tombs.',
            icon: '🏜️',
            cards: []
        },
        'abhorrent-armory': {
            id: 'abhorrent-armory',
            name: 'Abhorrent Armory',
            type: 'expansion',
            released: 5,
            description: 'Cursed weapons and haunted artifacts empower your cryptids with dark magic.',
            icon: '⚔️',
            cards: []
        },
        'paranormal-promo': {
            id: 'paranormal-promo',
            name: 'Paranormal Promo',
            type: 'expansion',
            released: 6,
            description: 'Limited edition promotional cards featuring rare and unique cryptids.',
            icon: '✨',
            cards: []
        }
    },
    
    filters: {
        setType: 'all', // all, deck, expansion
        sort: 'newest', // alpha, alphaReverse, newest, oldest
        search: '',
        // Card filters
        category: 'all',
        subtype: 'all',
        element: 'all',
        owned: 'all' // all, owned, unowned
    },
    
    init() {
        this.buildSetCards();
        this.createHTML();
        this.bindEvents();
    },
    
    // Helper to render sprite as image or emoji with optional card scale
    renderSprite(sprite, cardSpriteScale = null) {
        if (!sprite) return '?';
        if (sprite.startsWith('http') || sprite.startsWith('sprites/')) {
            const scaleStyle = (cardSpriteScale && cardSpriteScale !== 1) ? ` style="transform: scale(${cardSpriteScale})"` : '';
            return `<img src="${sprite}" class="sprite-img"${scaleStyle} alt="" draggable="false">`;
        }
        return sprite;
    },
    
    // Build card lists for each set from CardRegistry
    buildSetCards() {
        if (typeof CardRegistry === 'undefined') return;
        
        // Forests of Fear card keys
        const forestsOfFearKeys = [
            'newbornWendigo', 'matureWendigo', 'primalWendigo',
            'stormhawk', 'thunderbird',
            'adolescentBigfoot', 'adultBigfoot',
            'cursedHybrid', 'werewolf', 'lycanthrope',
            'deerWoman', 'snipe',
            'rogueRazorback', 'notDeer', 'jerseyDevil', 'babaYaga', 'skinwalker',
            // Pyre cards
            'burialGround', 'cursedWoods', 'animalPelts',
            // Auras
            'dauntingPresence', 'sproutWings', 'weaponizedTree', 'insatiableHunger',
            // Traps
            'terrify', 'hunt',
            // Bursts
            'fullMoon'
        ];
        
        // Putrid Swamp card keys
        const putridSwampKeys = [
            // Kindling
            'feuFollet', 'swampRat', 'bayouSprite', 'voodooDoll', 'platEyePup',
            // Cryptids
            'zombie', 'crawfishHorror', 'letiche', 'haint',
            'ignisFatuus', 'plagueRat', 'swampHag', 'effigy', 'platEye',
            'spiritFire', 'booHag', 'revenant', 'rougarou', 'swampStalker',
            'mamaBrigitte', 'loupGarou', 'draugrLord',
            'baronSamedi', 'honeyIslandMonster',
            // Pyre cards
            'grisGrisBag', 'swampGas',
            // Auras
            'curseVessel',
            // Traps
            'hungryGround',
            // Bursts
            'hexCurse'
        ];
        
        const cityOfFleshCards = [];
        const forestsOfFearCards = [];
        const putridSwampCards = [];
        
        // Helper to categorize a card
        const categorizeCard = (key, type) => {
            if (forestsOfFearKeys.includes(key)) {
                forestsOfFearCards.push({ key, type });
            } else if (putridSwampKeys.includes(key)) {
                putridSwampCards.push({ key, type });
            } else {
                cityOfFleshCards.push({ key, type });
            }
        };
        
        // Add all cryptids
        CardRegistry.getAllCryptidKeys().forEach(key => {
            categorizeCard(key, 'cryptid');
        });
        
        // Add all kindling
        CardRegistry.getAllKindlingKeys().forEach(key => {
            categorizeCard(key, 'kindling');
        });
        
        // Add all bursts
        CardRegistry.getAllBurstKeys().forEach(key => {
            categorizeCard(key, 'burst');
        });
        
        // Add all traps
        CardRegistry.getAllTrapKeys().forEach(key => {
            categorizeCard(key, 'trap');
        });
        
        // Add all auras
        CardRegistry.getAllAuraKeys().forEach(key => {
            categorizeCard(key, 'aura');
        });
        
        // Add all pyres
        CardRegistry.getAllPyreKeys().forEach(key => {
            categorizeCard(key, 'pyre');
        });
        
        this.sets['city-of-flesh'].cards = cityOfFleshCards;
        this.sets['forests-of-fear'].cards = forestsOfFearCards;
        this.sets['putrid-swamp'].cards = putridSwampCards;
    },
    
    createHTML() {
        const overlay = document.createElement('div');
        overlay.id = 'collection-overlay';
        overlay.innerHTML = `
            <!-- SETS LIST SCREEN -->
            <div class="coll-screen" id="coll-sets-screen">
                <div class="coll-topbar">
                    <button class="coll-back-btn" id="coll-back-home">← Back</button>
                    <h1 class="coll-title">Collection</h1>
                    <div class="coll-spacer"></div>
                </div>
                
                <div class="coll-stats-bar">
                    <div class="coll-stat">
                        <span class="coll-stat-value" id="coll-total-cards">0</span>
                        <span class="coll-stat-label">Cards Owned</span>
                    </div>
                    <div class="coll-stat">
                        <span class="coll-stat-value" id="coll-unique-cards">0</span>
                        <span class="coll-stat-label">Unique Cards</span>
                    </div>
                    <div class="coll-stat">
                        <span class="coll-stat-value" id="coll-completion">0%</span>
                        <span class="coll-stat-label">Complete</span>
                    </div>
                </div>
                
                <div class="coll-filters-bar">
                    <input type="text" class="coll-search" id="coll-set-search" placeholder="🔍 Search sets...">
                    <select class="coll-select" id="coll-set-type">
                        <option value="all">All Sets</option>
                        <option value="deck">Decks</option>
                        <option value="expansion">Expansions</option>
                    </select>
                    <select class="coll-select" id="coll-set-sort">
                        <option value="newest">Newest</option>
                        <option value="oldest">Oldest</option>
                        <option value="alpha">A-Z</option>
                        <option value="alphaReverse">Z-A</option>
                    </select>
                </div>
                
                <div class="coll-sets-grid" id="coll-sets-grid"></div>
            </div>
            
            <!-- CARDS IN SET SCREEN -->
            <div class="coll-screen" id="coll-cards-screen">
                <div class="coll-topbar">
                    <button class="coll-back-btn" id="coll-back-sets">← Sets</button>
                    <h1 class="coll-title" id="coll-set-title">Set Name</h1>
                    <div class="coll-set-progress" id="coll-set-progress">0/0</div>
                </div>
                
                <div class="coll-filters-bar">
                    <input type="text" class="coll-search" id="coll-card-search" placeholder="🔍 Search cards...">
                    <div class="coll-filter-group">
                        <button class="coll-filter-btn active" data-category="all">All</button>
                        <button class="coll-filter-btn" data-category="cryptid">Cryptids</button>
                        <button class="coll-filter-btn" data-category="spell">Spells</button>
                    </div>
                </div>
                
                <div class="coll-filters-bar coll-filters-secondary">
                    <select class="coll-select" id="coll-card-subtype">
                        <option value="all">All Types</option>
                        <option value="kindling">Kindling</option>
                        <option value="basic">Basic</option>
                        <option value="mythical">Mythical</option>
                        <option value="burst">Bursts</option>
                        <option value="trap">Traps</option>
                        <option value="aura">Auras</option>
                        <option value="pyre">Pyres</option>
                    </select>
                    <select class="coll-select" id="coll-card-element">
                        <option value="all">All Elements</option>
                        <option value="blood">🔴 Blood</option>
                        <option value="void">🟣 Void</option>
                        <option value="nature">🟢 Nature</option>
                        <option value="water">🔵 Water</option>
                        <option value="steel">⚪ Steel</option>
                    </select>
                    <select class="coll-select" id="coll-card-owned">
                        <option value="all">All Cards</option>
                        <option value="owned">Owned</option>
                        <option value="unowned">Missing</option>
                    </select>
                </div>
                
                <div class="coll-cards-grid" id="coll-cards-grid"></div>
            </div>
            
            <!-- CARD DETAIL MODAL is now created separately -->
        `;
        document.body.appendChild(overlay);
        
        // Create detail modal separately so it can appear above any overlay
        const detailModal = document.createElement('div');
        detailModal.className = 'coll-detail-modal';
        detailModal.id = 'coll-detail-modal';
        detailModal.innerHTML = `
            <div class="coll-detail-backdrop"></div>
            <div class="coll-detail-content" id="coll-detail-content"></div>
        `;
        document.body.appendChild(detailModal);
    },
    
    bindEvents() {
        // Navigation
        document.getElementById('coll-back-home').onclick = () => this.close();
        document.getElementById('coll-back-sets').onclick = () => this.showSetsScreen();
        
        // Set filters
        document.getElementById('coll-set-search').oninput = (e) => {
            this.filters.search = e.target.value.toLowerCase();
            this.renderSets();
        };
        
        document.getElementById('coll-set-type').onchange = (e) => {
            this.filters.setType = e.target.value;
            this.renderSets();
        };
        
        document.getElementById('coll-set-sort').onchange = (e) => {
            this.filters.sort = e.target.value;
            this.renderSets();
        };
        
        // Card filters
        document.getElementById('coll-card-search').oninput = (e) => {
            this.filters.search = e.target.value.toLowerCase();
            this.renderCards();
        };
        
        document.querySelectorAll('#coll-cards-screen .coll-filter-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('#coll-cards-screen .coll-filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.filters.category = btn.dataset.category;
                this.renderCards();
            };
        });
        
        document.getElementById('coll-card-subtype').onchange = (e) => {
            this.filters.subtype = e.target.value;
            this.renderCards();
        };
        
        document.getElementById('coll-card-element').onchange = (e) => {
            this.filters.element = e.target.value;
            this.renderCards();
        };
        
        document.getElementById('coll-card-owned').onchange = (e) => {
            this.filters.owned = e.target.value;
            this.renderCards();
        };
        
        // Detail modal click handlers
        document.querySelector('.coll-detail-backdrop').onclick = () => this.closeDetail();
        document.getElementById('coll-detail-modal').onclick = (e) => {
            if (e.target.id === 'coll-detail-modal') this.closeDetail();
        };
        
        // Escape key - handle detail modal even when collection isn't open
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // Always close detail modal first if it's open
                if (document.getElementById('coll-detail-modal').classList.contains('open')) {
                    this.closeDetail();
                    return;
                }
                // Then handle collection navigation
                if (this.isOpen) {
                    if (this.mode === 'cards') {
                        this.showSetsScreen();
                    } else {
                        this.close();
                    }
                }
            }
        });
    },
    
    // ==================== NAVIGATION ====================
    
    open() {
        this.isOpen = true;
        document.getElementById('collection-overlay').classList.add('open');
        this.showSetsScreen();
    },
    
    close() {
        this.isOpen = false;
        document.getElementById('collection-overlay').classList.remove('open');
        if (typeof HomeScreen !== 'undefined') HomeScreen.open();
    },
    
    showSetsScreen() {
        this.mode = 'sets';
        this.currentSet = null;
        this.filters.search = '';
        document.getElementById('coll-set-search').value = '';
        document.getElementById('coll-sets-screen').classList.add('active');
        document.getElementById('coll-cards-screen').classList.remove('active');
        this.updateGlobalStats();
        this.renderSets();
    },
    
    showCardsScreen(setId) {
        const set = this.sets[setId];
        if (!set) return;
        
        this.mode = 'cards';
        this.currentSet = set;
        this.filters.search = '';
        this.filters.category = 'all';
        this.filters.subtype = 'all';
        this.filters.element = 'all';
        this.filters.owned = 'all';
        
        document.getElementById('coll-card-search').value = '';
        document.querySelectorAll('#coll-cards-screen .coll-filter-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('#coll-cards-screen .coll-filter-btn[data-category="all"]').classList.add('active');
        document.getElementById('coll-card-subtype').value = 'all';
        document.getElementById('coll-card-element').value = 'all';
        document.getElementById('coll-card-owned').value = 'all';
        
        document.getElementById('coll-set-title').textContent = set.name;
        
        document.getElementById('coll-sets-screen').classList.remove('active');
        document.getElementById('coll-cards-screen').classList.add('active');
        
        this.updateSetProgress();
        this.renderCards();
    },
    
    // ==================== STATS ====================
    
    updateGlobalStats() {
        let totalCards = 0;
        let uniqueOwned = 0;
        let totalUnique = 0;
        
        Object.values(this.sets).forEach(set => {
            set.cards.forEach(entry => {
                totalUnique++;
                const owned = PlayerData.getOwnedCount(entry.key);
                if (owned > 0) {
                    uniqueOwned++;
                    totalCards += owned;
                }
            });
        });
        
        document.getElementById('coll-total-cards').textContent = totalCards;
        document.getElementById('coll-unique-cards').textContent = `${uniqueOwned}/${totalUnique}`;
        document.getElementById('coll-completion').textContent = 
            totalUnique > 0 ? Math.round((uniqueOwned / totalUnique) * 100) + '%' : '0%';
    },
    
    updateSetProgress() {
        if (!this.currentSet) return;
        
        let owned = 0;
        const total = this.currentSet.cards.length;
        
        this.currentSet.cards.forEach(entry => {
            if (PlayerData.getOwnedCount(entry.key) > 0) owned++;
        });
        
        document.getElementById('coll-set-progress').textContent = `${owned}/${total}`;
    },
    
    // ==================== SETS RENDERING ====================
    
    renderSets() {
        const container = document.getElementById('coll-sets-grid');
        let setsArray = Object.values(this.sets);
        
        // Filter by type
        if (this.filters.setType !== 'all') {
            setsArray = setsArray.filter(s => s.type === this.filters.setType);
        }
        
        // Filter by search
        if (this.filters.search) {
            setsArray = setsArray.filter(s => 
                s.name.toLowerCase().includes(this.filters.search)
            );
        }
        
        // Sort
        if (this.filters.sort === 'alpha') {
            setsArray.sort((a, b) => a.name.localeCompare(b.name));
        } else if (this.filters.sort === 'alphaReverse') {
            setsArray.sort((a, b) => b.name.localeCompare(a.name));
        } else if (this.filters.sort === 'newest') {
            setsArray.sort((a, b) => b.released - a.released);
        } else if (this.filters.sort === 'oldest') {
            setsArray.sort((a, b) => a.released - b.released);
        }
        
        if (setsArray.length === 0) {
            container.innerHTML = '<div class="coll-empty">No sets found</div>';
            return;
        }
        
        let html = '';
        setsArray.forEach(set => {
            const { owned, total } = this.getSetProgress(set);
            const percent = total > 0 ? Math.round((owned / total) * 100) : 0;
            const complete = owned === total;
            
            html += `
                <div class="coll-set-card ${complete ? 'complete' : ''}" onclick="Collection.showCardsScreen('${set.id}')">
                    <div class="coll-set-icon">${set.icon}</div>
                    <div class="coll-set-info">
                        <div class="coll-set-name">${set.name}</div>
                        <div class="coll-set-type">${set.type === 'deck' ? '📚 Full Deck' : '📦 Expansion'}</div>
                        <div class="coll-set-desc">${set.description || ''}</div>
                    </div>
                    <div class="coll-set-progress-wrap">
                        <div class="coll-set-progress-bar">
                            <div class="coll-set-progress-fill" style="width: ${percent}%"></div>
                        </div>
                        <div class="coll-set-progress-text">
                            ${complete ? '<span class="coll-set-complete-badge">✓ Complete</span>' : `${owned}/${total} cards`}
                        </div>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    },
    
    getSetProgress(set) {
        let owned = 0;
        set.cards.forEach(entry => {
            if (PlayerData.getOwnedCount(entry.key) > 0) owned++;
        });
        return { owned, total: set.cards.length };
    },
    
    // ==================== CARDS RENDERING ====================
    
    renderCards() {
        if (!this.currentSet) return;
        
        const container = document.getElementById('coll-cards-grid');
        let cards = this.currentSet.cards.map(entry => this.getCard(entry.key)).filter(Boolean);
        
        // Apply filters
        cards = this.filterCards(cards);
        
        // Sort by cost then name
        cards.sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
        
        if (cards.length === 0) {
            container.innerHTML = '<div class="coll-empty">No cards match filters</div>';
            return;
        }
        
        let html = '';
        cards.forEach(card => {
            const owned = PlayerData.getOwnedCount(card.key);
            html += this.renderCardHTML(card, owned);
        });
        
        container.innerHTML = html;
        
        // Detect card name overflow for scroll animation and setup holo effects
        requestAnimationFrame(() => {
            detectCardNameOverflow(container);
            if (typeof setupHoloEffect === 'function') setupHoloEffect(container);
        });
    },
    
    filterCards(cards) {
        return cards.filter(card => {
            const { category, subtype, element, owned, search } = this.filters;
            
            // Category
            if (category === 'cryptid' && card.type !== 'cryptid') return false;
            if (category === 'spell' && card.type === 'cryptid') return false;
            
            // Subtype
            if (subtype !== 'all') {
                if (subtype === 'kindling' && !card.isKindling) return false;
                if (subtype === 'basic' && (card.isKindling || card.mythical || card.type !== 'cryptid')) return false;
                if (subtype === 'mythical' && !card.mythical) return false;
                if (['burst', 'trap', 'aura', 'pyre'].includes(subtype) && card.type !== subtype) return false;
            }
            
            // Element
            if (element !== 'all' && card.element !== element) return false;
            
            // Owned
            const ownedCount = PlayerData.getOwnedCount(card.key);
            if (owned === 'owned' && ownedCount === 0) return false;
            if (owned === 'unowned' && ownedCount > 0) return false;
            
            // Search
            if (search && !card.name.toLowerCase().includes(search)) return false;
            
            return true;
        });
    },
    
    renderCardHTML(card, owned) {
        const isCryptid = card.type === 'cryptid';
        const cardTypeClass = isCryptid ? 'cryptid-card' : 'spell-card';
        const elementClass = card.element ? `element-${card.element}` : '';
        const typeClass = this.getTypeClass(card);
        const unownedClass = owned === 0 ? 'unowned' : '';
        const mythicalClass = card.mythical ? 'mythical' : '';
        const foilClass = card.foil ? 'foil' : '';
        const rarityClass = card.rarity || 'common';
        
        // Card type label (Cryptid/Kindling for cryptids, spell type for spells)
        let cardTypeLabel;
        if (isCryptid) {
            cardTypeLabel = card.isKindling ? 'Kindling' : 'Cryptid';
        } else {
            const spellTypeLabels = { trap: 'Trap', aura: 'Aura', pyre: 'Pyre', burst: 'Burst' };
            cardTypeLabel = spellTypeLabels[card.type] || 'Spell';
        }
        
        // Stats display
        let statsHTML = '';
        if (isCryptid) {
            statsHTML = `
                <span class="gc-stat atk">${card.atk}</span>
                <span class="gc-stat hp">${card.hp}</span>
            `;
        } else {
            const typeNames = { burst: 'Burst', trap: 'Trap', aura: 'Aura', pyre: 'Pyre' };
            statsHTML = `<span class="gc-stat-type">${typeNames[card.type] || 'Spell'}</span>`;
        }
        
        // Rarity gems (sprite-based)
        const rarityGems = `<span class="gc-rarity ${rarityClass}"></span>`;
        
        // Owned badge
        const ownedBadge = `<span class="gc-owned ${owned > 0 ? 'have' : 'none'}">${owned > 0 ? `×${owned}` : '✗'}</span>`;

        return `
            <div class="game-card coll-card ${cardTypeClass} ${elementClass} ${typeClass} ${rarityClass} ${unownedClass} ${mythicalClass} ${foilClass}"
                 onclick="Collection.showDetail('${card.key}')">
                <span class="gc-cost">${card.cost}</span>
                <div class="gc-header"><span class="gc-name">${card.name}</span></div>
                <div class="gc-art">${Collection.renderSprite(card.sprite, card.cardSpriteScale)}</div>
                <div class="gc-stats">${statsHTML}</div>
                <div class="gc-card-type">${cardTypeLabel}</div>
                ${rarityGems}
                ${ownedBadge}
            </div>
        `;
    },
    
    getTypeClass(card) {
        if (card.isKindling) return 'kindling-card';
        if (card.type === 'trap') return 'trap-card';
        if (card.type === 'aura') return 'aura-card';
        if (card.type === 'pyre') return 'pyre-card';
        if (card.type === 'burst') return 'burst-card';
        return '';
    },
    
    getCard(key) {
        if (typeof CardRegistry === 'undefined') return null;
        
        const c = CardRegistry.getCryptid(key);
        if (c) return { ...c, key, type: 'cryptid' };
        
        const k = CardRegistry.getKindling(key);
        if (k) return { ...k, key, type: 'cryptid', isKindling: true };
        
        const b = CardRegistry.getBurst(key);
        if (b) return { ...b, key, type: 'burst' };
        
        const t = CardRegistry.getTrap(key);
        if (t) return { ...t, key, type: 'trap' };
        
        const a = CardRegistry.getAura(key);
        if (a) return { ...a, key, type: 'aura' };
        
        const p = CardRegistry.getPyre(key);
        if (p) return { ...p, key, type: 'pyre', cost: 0 };
        
        return null;
    },
    
    // ==================== CARD DETAIL ====================
    
    getCardSeries(cardKey) {
        // Match card keys to their series
        const forestsOfFearKeys = [
            'newbornWendigo', 'matureWendigo', 'primalWendigo',
            'stormhawk', 'thunderbird',
            'adolescentBigfoot', 'adultBigfoot',
            'cursedHybrid', 'werewolf', 'lycanthrope',
            'deerWoman', 'snipe',
            'rogueRazorback', 'notDeer', 'jerseyDevil', 'babaYaga', 'skinwalker',
            'burialGround', 'cursedWoods', 'animalPelts',
            'dauntingPresence', 'sproutWings', 'weaponizedTree', 'insatiableHunger',
            'terrify', 'hunt', 'fullMoon'
        ];
        
        const putridSwampKeys = [
            'tadpole', 'bullfrog', 'lovelandFrog',
            'hatchling', 'crocodilian', 'mokele',
            'maggot', 'carrionBeetle', 'mongolianDeathWorm',
            'bloatedCorpse', 'swampZombie', 'bogBeast',
            'willOWisp', 'mothman',
            'lizardMan', 'chupacabra', 'flatwoodsMonster', 'hopkinsville',
            'rotTrap', 'miasma', 'swampGas',
            'infection', 'devour', 'swampRenewal', 'toxicSpores',
            'decay', 'miasmaCloud', 'dredge'
        ];
        
        if (forestsOfFearKeys.includes(cardKey)) return 'forests-of-fear';
        if (putridSwampKeys.includes(cardKey)) return 'putrid-swamp';
        return 'city-of-flesh';
    },
    
    showDetail(cardKey) {
        const card = this.getCard(cardKey);
        if (!card) return;
        
        const normalOwned = PlayerData.collection[cardKey]?.owned || 0;
        const holoOwned = PlayerData.collection[cardKey]?.holoOwned || 0;
        const totalOwned = normalOwned + holoOwned;
        const isCryptid = card.type === 'cryptid';
        const elementClass = card.element ? `element-${card.element}` : '';
        const typeClass = this.getTypeClass(card);
        const rarityClass = card.rarity || 'common';
        const mythicalClass = card.mythical ? 'mythical' : '';
        const cardTypeClass = isCryptid ? 'cryptid-card' : 'spell-card';
        
        // Card type label
        let cardTypeLabel;
        if (isCryptid) {
            cardTypeLabel = card.isKindling ? 'Kindling' : 'Cryptid';
        } else {
            const spellTypeLabels = { trap: 'Trap', aura: 'Aura', pyre: 'Pyre', burst: 'Burst' };
            cardTypeLabel = spellTypeLabels[card.type] || 'Spell';
        }
        
        // Stats HTML
        let statsHTML = '';
        if (isCryptid) {
            statsHTML = `<span class="gc-stat atk">${card.atk}</span><span class="gc-stat hp">${card.hp}</span>`;
        } else {
            const typeLabels = { trap: 'Trap', aura: 'Aura', pyre: 'Pyre', burst: 'Burst' };
            statsHTML = `<span class="gc-stat-type">${typeLabels[card.type] || 'Spell'}</span>`;
        }
        
        // Rarity gems
        const rarityGems = `<span class="gc-rarity ${rarityClass}"></span>`;
        
        // Series code
        const seriesCode = this.getCardSeries(cardKey).split('-').map(w => w.charAt(0).toUpperCase()).join('');
        const seriesNames = { 'COF': 'City of Flesh', 'FOF': 'Forests of Fear', 'PS': 'Putrid Swamp' };
        const seriesFullName = seriesNames[seriesCode] || seriesCode;
        
        // Element info
        const elementNames = { void: 'Void', blood: 'Blood', water: 'Water', steel: 'Steel', nature: 'Nature' };
        
        // Build abilities section
        let abilitiesHTML = '';
        if (card.combatAbility) {
            const [abilityName, ...descParts] = card.combatAbility.split(':');
            abilitiesHTML += `
                <div class="detail-ability">
                    <div class="detail-ability-header">
                        <span class="detail-ability-icon">⚔</span>
                        <span class="detail-ability-type">Combat</span>
                    </div>
                    <div class="detail-ability-name">${abilityName.trim()}</div>
                    ${descParts.length ? `<div class="detail-ability-desc">${descParts.join(':').trim()}</div>` : ''}
                </div>`;
        }
        if (card.supportAbility) {
            const [abilityName, ...descParts] = card.supportAbility.split(':');
            abilitiesHTML += `
                <div class="detail-ability">
                    <div class="detail-ability-header">
                        <span class="detail-ability-icon">✦</span>
                        <span class="detail-ability-type">Support</span>
                    </div>
                    <div class="detail-ability-name">${abilityName.trim()}</div>
                    ${descParts.length ? `<div class="detail-ability-desc">${descParts.join(':').trim()}</div>` : ''}
                </div>`;
        }
        if (card.evolvesFrom) {
            abilitiesHTML += `
                <div class="detail-ability evolution">
                    <div class="detail-ability-header">
                        <span class="detail-ability-icon">◈</span>
                        <span class="detail-ability-type">Evolution</span>
                    </div>
                    <div class="detail-ability-desc">Evolves from <strong>${card.evolvesFrom}</strong></div>
                </div>`;
        }
        if (card.description) {
            abilitiesHTML += `
                <div class="detail-ability effect">
                    <div class="detail-ability-header">
                        <span class="detail-ability-icon">✧</span>
                        <span class="detail-ability-type">Effect</span>
                    </div>
                    <div class="detail-ability-desc">${card.description}</div>
                </div>`;
        }
        if (card.pyreEffect) {
            abilitiesHTML += `
                <div class="detail-ability pyre-effect">
                    <div class="detail-ability-header">
                        <span class="detail-ability-icon">🔥</span>
                        <span class="detail-ability-type">Pyre Effect</span>
                    </div>
                    <div class="detail-ability-desc">${card.pyreEffect}</div>
                </div>`;
        }
        
        const content = document.getElementById('coll-detail-content');
        content.innerHTML = `
            <div class="detail-view-layout">
                <!-- Scaled up game card using actual template -->
                <div class="detail-card-wrapper">
                    <div class="game-card detail-card ${cardTypeClass} ${elementClass} ${typeClass} ${rarityClass} ${mythicalClass}">
                        <span class="gc-cost">${card.cost}</span>
                        <div class="gc-header"><span class="gc-name">${card.name}</span></div>
                        <div class="gc-art">${Collection.renderSprite(card.sprite, card.cardSpriteScale)}</div>
                        <div class="gc-stats">${statsHTML}</div>
                        <div class="gc-card-type">${cardTypeLabel}</div>
                        ${rarityGems}
                    </div>
                    <div class="detail-card-series">${seriesCode}</div>
                </div>
                
                <!-- Info panel -->
                <div class="detail-info-panel">
                    <!-- Card title & type for mobile -->
                    <div class="detail-title-bar">
                        <h2 class="detail-card-name">${card.name}</h2>
                        <span class="detail-card-meta">
                            ${card.element ? `<span class="detail-element ${card.element}">${elementNames[card.element]}</span>` : ''}
                            <span class="detail-type-label">${cardTypeLabel}</span>
                        </span>
                    </div>
                    
                    <!-- Abilities section -->
                    ${abilitiesHTML ? `
                        <div class="detail-section abilities-section">
                            <div class="detail-section-title">Abilities</div>
                            <div class="detail-abilities-list">${abilitiesHTML}</div>
                        </div>
                    ` : ''}
                    
                    <!-- Collection info -->
                    <div class="detail-section collection-section">
                        <div class="detail-section-title">Collection</div>
                        <div class="detail-collection-grid">
                            <div class="detail-collection-item clickable active ${normalOwned > 0 ? 'owned' : 'empty'}" data-variant="normal">
                                <span class="collection-label">Normal</span>
                                <span class="collection-value">${normalOwned}</span>
                            </div>
                            <div class="detail-collection-item clickable holo ${holoOwned > 0 ? 'owned' : 'empty'}" data-variant="holo">
                                <span class="collection-label">✨ Holo</span>
                                <span class="collection-value">${holoOwned}</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Series info -->
                    <div class="detail-series-badge">
                        <span class="series-code">${seriesCode}</span>
                        <span class="series-name">${seriesFullName}</span>
                    </div>
                </div>
            </div>
            
            <!-- Action buttons -->
            <div class="detail-actions">
                <button class="detail-btn close" onclick="Collection.closeDetail()">Close</button>
            </div>
        `;
        
        document.getElementById('coll-detail-modal').classList.add('open');
        
        // Add click handlers for variant toggle
        content.querySelectorAll('.detail-collection-item.clickable').forEach(item => {
            item.addEventListener('click', () => {
                const variant = item.dataset.variant;
                const card = content.querySelector('.game-card.detail-card');
                const allItems = content.querySelectorAll('.detail-collection-item.clickable');
                
                // Update active state
                allItems.forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                
                // Toggle foil class on card
                if (variant === 'holo') {
                    card.classList.add('foil');
                } else {
                    card.classList.remove('foil');
                }
            });
        });
    },
    
    closeDetail() {
        document.getElementById('coll-detail-modal').classList.remove('open');
    }
};

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Collection.init());
} else {
    Collection.init();
}