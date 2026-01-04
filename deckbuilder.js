/**
 * Cryptid Fates - Deck Builder UI (v2)
 * Battle-style cards, full preview, proper filters, working mana curve
 * 
 * NOTE: This extends the DeckBuilder from test-deck.js, preserving buildRandomDeck/buildKindlingPool
 */

// Preserve existing DeckBuilder methods (from test-deck.js)
const existingDeckBuilder = window.DeckBuilder || {};

window.DeckBuilder = {
    // Preserve build functions from test-deck.js
    defaultDeckConfig: existingDeckBuilder.defaultDeckConfig,
    buildRandomDeck: existingDeckBuilder.buildRandomDeck,
    buildKindlingPool: existingDeckBuilder.buildKindlingPool,
    
    // UI state
    isOpen: false,
    currentDeck: null,
    currentDeckId: null,
    mode: 'select',
    filters: {
        category: 'all', // all, cryptid, spell
        subtype: 'all',  // all, kindling, mythical, basic, burst, trap, aura, pyre
        element: 'all',  // all, blood, void, nature, water, steel
        series: 'all',   // all, city-of-flesh, forests-of-fear, putrid-swamp, etc.
        search: ''
    },
    deckPanelMinimized: false,
    
    init() {
        this.createHTML();
        this.bindEvents();
    },
    
    // Helper to render sprite as image or emoji (no scale in card contexts)
    renderSprite(sprite) {
        if (!sprite) return '?';
        if (sprite.startsWith('http') || sprite.startsWith('sprites/')) {
            return `<img src="${sprite}" class="sprite-img" alt="" draggable="false">`;
        }
        return sprite;
    },
    
    createHTML() {
        const overlay = document.createElement('div');
        overlay.id = 'deckbuilder-overlay';
        overlay.innerHTML = `
            <!-- DECK SELECTION SCREEN -->
            <div class="db-screen" id="db-select-screen">
                <div class="db-topbar">
                    <button class="db-back-btn" id="db-back-home">← Back</button>
                    <h1 class="db-title">Your Decks</h1>
                    <div class="db-spacer"></div>
                </div>
                <div class="db-slots-area" id="db-slots"></div>
                <div class="db-footer">
                    <span class="db-hint" id="db-slots-info"></span>
                </div>
            </div>
            
            <!-- DECK EDITOR SCREEN -->
            <div class="db-screen" id="db-edit-screen">
                <div class="db-editor-layout">
                    <!-- Left: Collection Browser -->
                    <div class="db-browser">
                        <div class="db-browser-header">
                            <div class="db-browser-top">
                                <button class="db-back-btn" id="db-back-select">← Decks</button>
                                <input type="text" class="db-search" id="db-search" placeholder="🔍 Search cards...">
                            </div>
                            <div class="db-filters-row">
                                <div class="db-filter-group">
                                    <button class="db-filter-btn active" data-category="all">All</button>
                                    <button class="db-filter-btn" data-category="cryptid">Cryptids</button>
                                    <button class="db-filter-btn" data-category="spell">Spells</button>
                                </div>
                            </div>
                            <div class="db-filters-row" id="db-subtype-row">
                                <select class="db-select" id="db-subtype">
                                    <option value="all">All Types</option>
                                </select>
                                <select class="db-select" id="db-element">
                                    <option value="all">All Elements</option>
                                    <option value="blood">🔴 Blood</option>
                                    <option value="void">🟣 Void</option>
                                    <option value="nature">🟢 Nature</option>
                                    <option value="water">🔵 Water</option>
                                    <option value="steel">⚪ Steel</option>
                                </select>
                                <select class="db-select" id="db-series">
                                    <option value="all">All Series</option>
                                    <option value="city-of-flesh">🏚️ City of Flesh</option>
                                    <option value="forests-of-fear">🌲 Forests of Fear</option>
                                    <option value="putrid-swamp">🐊 Putrid Swamp</option>
                                </select>
                            </div>
                            <div class="db-hint-bar">
                                <span>💡 Click card to add • Right-click for details</span>
                            </div>
                        </div>
                        <div class="db-cards-scroll" id="db-cards-scroll"></div>
                    </div>
                    
                    <!-- Right: Deck Panel -->
                    <div class="db-deck" id="db-deck-panel">
                        <div class="db-deck-toggle" id="db-deck-toggle">
                            <span class="toggle-icon">▼</span>
                            <span class="toggle-label">Deck</span>
                            <span class="db-deck-count-mini" id="db-count-mini">0</span>
                        </div>
                        <div class="db-deck-top">
                            <input type="text" class="db-deck-name" id="db-deck-name" placeholder="Deck Name" maxlength="20">
                            <div class="db-deck-count-wrap">
                                <span class="db-deck-count" id="db-count">0</span>
                                <span class="db-deck-range">/55-100</span>
                            </div>
                        </div>
                        <div class="db-curve-section">
                            <div class="db-curve-label">Mana Curve</div>
                            <div class="db-curve" id="db-curve"></div>
                        </div>
                        <div class="db-deck-hint">💡 Tap to remove · Hold for details</div>
                        <div class="db-deck-scroll" id="db-deck-scroll"></div>
                        <div class="db-deck-btns">
                            <button class="db-action-btn secondary" id="db-clear">Clear</button>
                            <button class="db-action-btn primary" id="db-save">Save Deck</button>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- CARD PREVIEW MODAL -->
            <div class="db-preview-modal" id="db-preview-modal">
                <div class="db-preview-backdrop"></div>
                <div class="db-preview-content" id="db-preview-content"></div>
            </div>
            
            <!-- INCINERATE CONFIRMATION POPUP -->
            <div class="db-incinerate-modal" id="db-incinerate-modal">
                <div class="db-incinerate-backdrop"></div>
                <div class="db-incinerate-content">
                    <div class="incinerate-header"><img src="https://f.playcode.io/p-2633929/v-1/019b6baf-a00d-779e-b5ae-a10bb55ef3b9/embers-icon.png" class="embers-img" alt=""> Incinerate Cards</div>
                    <div class="incinerate-card-info" id="incinerate-card-info"></div>
                    <div class="incinerate-controls">
                        <button class="incinerate-qty-btn" id="incinerate-minus">−</button>
                        <span class="incinerate-qty" id="incinerate-qty">1</span>
                        <button class="incinerate-qty-btn" id="incinerate-plus">+</button>
                    </div>
                    <div class="incinerate-reward" id="incinerate-reward">
                        <span class="reward-label">You'll receive:</span>
                        <span class="reward-amount"><img src="https://f.playcode.io/p-2633929/v-1/019b6baf-a00d-779e-b5ae-a10bb55ef3b9/embers-icon.png" class="embers-img ember-icon" alt=""><span id="incinerate-embers">0</span></span>
                    </div>
                    <div class="incinerate-warning">⚠️ This cannot be undone!</div>
                    <div class="incinerate-btns">
                        <button class="incinerate-btn cancel" id="incinerate-cancel">Cancel</button>
                        <button class="incinerate-btn confirm" id="incinerate-confirm">Incinerate</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    },
    
    bindEvents() {
        // Navigation
        document.getElementById('db-back-home').onclick = () => this.close();
        document.getElementById('db-back-select').onclick = () => this.showSelectScreen();
        
        // Search
        document.getElementById('db-search').oninput = (e) => {
            this.filters.search = e.target.value.toLowerCase();
            this.renderCards();
        };
        
        // Category filters
        document.querySelectorAll('.db-filter-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.db-filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.filters.category = btn.dataset.category;
                this.updateSubtypeOptions();
                this.renderCards();
            };
        });
        
        // Subtype filter
        document.getElementById('db-subtype').onchange = (e) => {
            this.filters.subtype = e.target.value;
            this.renderCards();
        };
        
        // Element filter
        document.getElementById('db-element').onchange = (e) => {
            this.filters.element = e.target.value;
            this.renderCards();
        };
        
        // Series filter
        document.getElementById('db-series').onchange = (e) => {
            this.filters.series = e.target.value;
            this.renderCards();
        };
        
        // Mobile deck panel toggle
        document.getElementById('db-deck-toggle').onclick = () => {
            this.toggleDeckPanel();
        };
        
        // Incinerate modal events
        document.querySelector('.db-incinerate-backdrop').onclick = () => this.closeIncinerateModal();
        document.getElementById('incinerate-cancel').onclick = () => this.closeIncinerateModal();
        document.getElementById('incinerate-confirm').onclick = () => this.confirmIncinerate();
        document.getElementById('incinerate-minus').onclick = () => this.adjustIncinerateQty(-1);
        document.getElementById('incinerate-plus').onclick = () => this.adjustIncinerateQty(1);
        
        // Deck actions
        document.getElementById('db-deck-name').oninput = (e) => {
            if (this.currentDeck) this.currentDeck.name = e.target.value;
        };
        
        document.getElementById('db-clear').onclick = () => {
            if (this.currentDeck && confirm('Clear all cards?')) {
                this.currentDeck.cards = [];
                this.renderDeck();
                this.renderCards();
            }
        };
        
        document.getElementById('db-save').onclick = () => this.saveDeck();
        
        // Preview modal close
        document.querySelector('.db-preview-backdrop').onclick = () => this.closePreview();
        document.getElementById('db-preview-modal').onclick = (e) => {
            if (e.target.id === 'db-preview-modal') this.closePreview();
        };
        
        // Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                if (document.getElementById('db-preview-modal').classList.contains('open')) {
                    this.closePreview();
                } else if (this.mode === 'edit') {
                    this.showSelectScreen();
                } else {
                    this.close();
                }
            }
        });
    },
    
    updateSubtypeOptions() {
        const select = document.getElementById('db-subtype');
        const elementSelect = document.getElementById('db-element');
        const cat = this.filters.category;
        
        let options = '<option value="all">All Types</option>';
        
        if (cat === 'all') {
            options += `
                <option value="kindling">Kindling</option>
                <option value="basic">Basic Cryptids</option>
                <option value="mythical">Mythical</option>
                <option value="burst">Bursts</option>
                <option value="trap">Traps</option>
                <option value="aura">Auras</option>
                <option value="pyre">Pyres</option>
            `;
            elementSelect.style.display = 'block';
        } else if (cat === 'cryptid') {
            options += `
                <option value="kindling">Kindling</option>
                <option value="basic">Basic</option>
                <option value="mythical">Mythical</option>
            `;
            elementSelect.style.display = 'block';
        } else if (cat === 'spell') {
            options += `
                <option value="burst">Bursts</option>
                <option value="trap">Traps</option>
                <option value="aura">Auras</option>
                <option value="pyre">Pyres</option>
            `;
            elementSelect.style.display = 'none';
        }
        
        select.innerHTML = options;
        this.filters.subtype = 'all';
    },
    
    // ==================== NAVIGATION ====================
    
    open() {
        this.isOpen = true;
        document.getElementById('deckbuilder-overlay').classList.add('open');
        this.showSelectScreen();
    },
    
    close() {
        this.isOpen = false;
        document.getElementById('deckbuilder-overlay').classList.remove('open');
        if (typeof HomeScreen !== 'undefined') HomeScreen.open();
    },
    
    showSelectScreen() {
        this.mode = 'select';
        this.currentDeck = null;
        this.currentDeckId = null;
        document.getElementById('db-select-screen').classList.add('active');
        document.getElementById('db-edit-screen').classList.remove('active');
        this.renderSlots();
    },
    
    showEditScreen(deckId) {
        const deck = PlayerData.decks.find(d => d.id === deckId);
        if (!deck) return;
        
        this.mode = 'edit';
        this.currentDeckId = deckId;
        this.currentDeck = JSON.parse(JSON.stringify(deck));
        
        document.getElementById('db-select-screen').classList.remove('active');
        document.getElementById('db-edit-screen').classList.add('active');
        document.getElementById('db-deck-name').value = this.currentDeck.name;
        
        // Reset filters
        this.filters = { category: 'all', subtype: 'all', element: 'all', series: 'all', search: '' };
        document.querySelectorAll('.db-filter-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.db-filter-btn[data-category="all"]').classList.add('active');
        document.getElementById('db-search').value = '';
        document.getElementById('db-element').value = 'all';
        document.getElementById('db-series').value = 'all';
        this.updateSubtypeOptions();
        
        // Reset deck panel state - start minimized on mobile
        const panel = document.getElementById('db-deck-panel');
        const toggle = document.getElementById('db-deck-toggle');
        const isMobile = window.matchMedia('(max-width: 800px) and (orientation: portrait)').matches;
        
        if (isMobile) {
            panel.classList.add('minimized');
            panel.classList.remove('maximized');
            if (toggle) {
                toggle.querySelector('.toggle-icon').textContent = '▲';
                toggle.querySelector('.toggle-label').textContent = 'Deck';
            }
        } else {
            panel.classList.remove('minimized');
            panel.classList.remove('maximized');
            if (toggle) toggle.querySelector('.toggle-icon').textContent = '▼';
        }
        
        this.renderCards();
        this.renderDeck();
    },
    
    // ==================== DECK SLOTS ====================
    
    renderSlots() {
        const container = document.getElementById('db-slots');
        const maxSlots = PlayerData.maxDeckSlots;
        let html = '';
        
        // Existing decks
        PlayerData.decks.forEach(deck => {
            const valid = PlayerData.validateDeck(deck).valid;
            html += `
                <div class="db-slot ${valid ? 'valid' : 'invalid'}" onclick="DeckBuilder.showEditScreen(${deck.id})">
                    <div class="db-slot-icon">📜</div>
                    <div class="db-slot-name">${this.escapeHtml(deck.name)}</div>
                    <div class="db-slot-cards">${deck.cards.length} cards</div>
                    <div class="db-slot-status">${valid ? '✓ Ready' : '⚠ ' + (deck.cards.length < 55 ? 'Need ' + (55 - deck.cards.length) + ' more' : 'Too many')}</div>
                    <button class="db-slot-del" onclick="event.stopPropagation(); DeckBuilder.deleteDeck(${deck.id})">×</button>
                </div>
            `;
        });
        
        // Empty slots
        const emptyCount = maxSlots - PlayerData.decks.length;
        for (let i = 0; i < emptyCount; i++) {
            html += `
                <div class="db-slot empty" onclick="DeckBuilder.createNewDeck()">
                    <div class="db-slot-icon">+</div>
                    <div class="db-slot-name">New Deck</div>
                    <div class="db-slot-cards">Click to create</div>
                </div>
            `;
        }
        
        // ONE locked teaser
        if (maxSlots < 25) {
            html += `
                <div class="db-slot locked">
                    <div class="db-slot-icon">🔒</div>
                    <div class="db-slot-name">Locked</div>
                    <div class="db-slot-cards">Level ${(maxSlots + 1) * 10}</div>
                </div>
            `;
        }
        
        container.innerHTML = html;
        document.getElementById('db-slots-info').textContent = 
            `${PlayerData.decks.length}/${maxSlots} deck slots used`;
    },
    
    createNewDeck() {
        const result = PlayerData.createDeck('New Deck');
        if (result.success) {
            this.showEditScreen(result.deck.id);
        }
    },
    
    deleteDeck(deckId) {
        if (confirm('Delete this deck?')) {
            PlayerData.deleteDeck(deckId);
            this.renderSlots();
        }
    },
    
    // ==================== CARD RENDERING ====================
    
    renderCards() {
        const container = document.getElementById('db-cards-scroll');
        const allCards = this.getAllCards();
        const filtered = this.filterCards(allCards);
        
        if (filtered.length === 0) {
            const hasAnyFilters = this.filters.category !== 'all' || this.filters.subtype !== 'all' || 
                                  this.filters.element !== 'all' || this.filters.series !== 'all' || 
                                  this.filters.search !== '';
            const message = hasAnyFilters 
                ? 'No owned cards match filters' 
                : 'You don\'t own any cards yet!<br><span style="font-size:12px;color:#707080;">Visit the Shop to get boosters</span>';
            container.innerHTML = `<div class="db-no-cards">${message}</div>`;
            return;
        }
        
        let html = '';
        filtered.forEach(card => {
            // For each card variant (normal or foil), calculate owned and deck counts
            const isFoil = card.foil || false;
            const isInfinite = card.infinite || false;
            const variantOwned = isInfinite ? Infinity : (isFoil ? (card.holoOwned || 0) : (card.normalOwned || 0));
            const variantInDeck = this.getVariantCountInDeck(card.key, isFoil);
            const baseInDeck = this.getBaseCardCountInDeck(card.key);
            const maxCopies = this.getMaxCopies(card.key);
            
            // Available considers: variant owned, variant in deck, AND total max copies limit
            // Infinite cards are always available (unlimited copies)
            const variantAvailable = isInfinite ? Infinity : (variantOwned - variantInDeck);
            const totalAvailable = maxCopies - baseInDeck;
            const canAdd = variantAvailable > 0 && totalAvailable > 0;
            
            html += this.renderCardHTML(card, variantOwned, variantInDeck, canAdd ? 1 : 0, isFoil, maxCopies, baseInDeck);
        });
        
        container.innerHTML = html;
        
        // Add event handlers for click, right-click, and long-press
        container.querySelectorAll('.db-card').forEach(cardEl => {
            let longPressTimer = null;
            let isLongPress = false;
            const cardKey = cardEl.dataset.cardKey;
            const isFoil = cardEl.dataset.foil === 'true';
            
            // Click to add card
            cardEl.addEventListener('click', (e) => {
                if (isLongPress) {
                    isLongPress = false;
                    return;
                }
                DeckBuilder.addCard(cardKey, isFoil);
            });
            
            // Right-click for preview
            cardEl.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.showPreview(cardKey);
            });
            
            // Long press for preview on mobile
            cardEl.addEventListener('touchstart', (e) => {
                isLongPress = false;
                if (cardKey) {
                    longPressTimer = setTimeout(() => {
                        isLongPress = true;
                        this.showPreview(cardKey);
                    }, 500);
                }
            }, { passive: true });
            
            cardEl.addEventListener('touchend', () => {
                clearTimeout(longPressTimer);
            });
            
            cardEl.addEventListener('touchmove', () => {
                clearTimeout(longPressTimer);
            });
            
            cardEl.addEventListener('touchcancel', () => {
                clearTimeout(longPressTimer);
            });
        });
    },
    
    renderCardHTML(card, owned, inDeck, available, isFoil = false, maxCopies = 3, baseInDeck = 0) {
        const isCryptid = card.type === 'cryptid';
        const cardTypeClass = isCryptid ? 'cryptid-card' : 'spell-card';
        const elementClass = card.element ? `element-${card.element}` : '';
        const typeClass = this.getTypeClass(card);
        const unownedClass = owned === 0 ? 'unowned' : '';
        const inDeckClass = inDeck > 0 ? 'in-deck' : '';
        const atMaxCopies = baseInDeck >= maxCopies;
        const unavailClass = (available <= 0 && owned > 0) || atMaxCopies ? 'unavailable' : '';
        const mythicalClass = card.mythical ? 'mythical' : '';
        const foilClass = isFoil ? 'foil' : '';
        const rarityClass = card.rarity || 'common';
        
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
        
        // Foil indicator
        const foilBadge = isFoil ? `<span class="gc-foil">✨</span>` : '';
        
        // Owned count - show variant owned and in-deck counts
        let ownedDisplay;
        if (card.infinite) {
            ownedDisplay = inDeck > 0 ? `${inDeck}/∞` : '∞';
        } else {
            ownedDisplay = inDeck > 0 ? `${inDeck}/${owned}` : `×${owned}`;
        }
        
        // Max copies indicator (only show if at limit and not infinite)
        const maxCopyBadge = (atMaxCopies && !card.infinite) ? `<span class="gc-max-copies">${baseInDeck}/${maxCopies}</span>` : '';

        return `
            <div class="game-card db-card ${cardTypeClass} ${elementClass} ${typeClass} ${rarityClass} ${unownedClass} ${inDeckClass} ${unavailClass} ${mythicalClass} ${foilClass}"
                 data-card-key="${card.key}"
                 data-foil="${isFoil}">
                <span class="gc-cost">${card.cost}</span>
                <div class="gc-header"><span class="gc-name">${card.name}</span></div>
                <div class="gc-art">${DeckBuilder.renderSprite(card.sprite)}</div>
                <div class="gc-stats">${statsHTML}</div>
                ${rarityGems}
                ${foilBadge}
                <span class="gc-owned">${ownedDisplay}</span>
                ${maxCopyBadge}
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
    
    getAllCards() {
        const cards = [];
        if (typeof CardRegistry === 'undefined') return cards;
        
        // Helper to add card with optional foil variant
        const addCardWithVariants = (cardData, key, type, subtype, extra = {}) => {
            const baseCard = { ...cardData, key, type, subtype, ...extra };
            
            // Infinite cards (like basic pyre) are always available
            if (cardData.infinite) {
                cards.push({ ...baseCard, foil: false, normalOwned: Infinity, holoOwned: 0, displayKey: key, infinite: true });
                return;
            }
            
            // Get normal and holo owned counts
            const normalOwned = PlayerData.collection[key]?.owned || 0;
            const holoOwned = PlayerData.collection[key]?.holoOwned || 0;
            
            // Add normal version if owned
            if (normalOwned > 0) {
                cards.push({ ...baseCard, foil: false, normalOwned, holoOwned, displayKey: key });
            }
            
            // Add foil version if owned
            if (holoOwned > 0) {
                cards.push({ ...baseCard, foil: true, normalOwned, holoOwned, displayKey: key + '_foil' });
            }
            
            // Don't show unowned cards - only show cards the player owns
        };
        
        // Cryptids
        CardRegistry.getAllCryptidKeys().forEach(key => {
            const c = CardRegistry.getCryptid(key);
            if (c) addCardWithVariants(c, key, 'cryptid', c.mythical ? 'mythical' : 'basic');
        });
        
        // Kindling
        CardRegistry.getAllKindlingKeys().forEach(key => {
            const k = CardRegistry.getKindling(key);
            if (k) addCardWithVariants(k, key, 'cryptid', 'kindling', { isKindling: true });
        });
        
        // Bursts
        CardRegistry.getAllBurstKeys().forEach(key => {
            const b = CardRegistry.getBurst(key);
            if (b) addCardWithVariants(b, key, 'burst', 'burst');
        });
        
        // Traps
        CardRegistry.getAllTrapKeys().forEach(key => {
            const t = CardRegistry.getTrap(key);
            if (t) addCardWithVariants(t, key, 'trap', 'trap');
        });
        
        // Auras
        CardRegistry.getAllAuraKeys().forEach(key => {
            const a = CardRegistry.getAura(key);
            if (a) addCardWithVariants(a, key, 'aura', 'aura');
        });
        
        // Pyres
        CardRegistry.getAllPyreKeys().forEach(key => {
            const p = CardRegistry.getPyre(key);
            if (p) addCardWithVariants(p, key, 'pyre', 'pyre', { cost: 0 });
        });
        
        return cards.sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
    },
    
    filterCards(cards) {
        return cards.filter(card => {
            const { category, subtype, element, series, search } = this.filters;
            
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
            
            // Series
            if (series !== 'all') {
                const cardSeries = this.getCardSeries(card.key);
                if (cardSeries !== series) return false;
            }
            
            // Search
            if (search && !card.name.toLowerCase().includes(search)) return false;
            
            return true;
        });
    },
    
    // Get which series a card belongs to
    getCardSeries(cardKey) {
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
            'feuFollet', 'swampRat', 'bayouSprite', 'voodooDoll', 'platEyePup',
            'zombie', 'crawfishHorror', 'letiche', 'haint',
            'ignisFatuus', 'plagueRat', 'swampHag', 'effigy', 'platEye',
            'spiritFire', 'booHag', 'revenant', 'rougarou', 'swampStalker',
            'mamaBrigitte', 'loupGarou', 'draugrLord',
            'baronSamedi', 'honeyIslandMonster',
            'grisGrisBag', 'swampGas', 'curseVessel', 'hungryGround', 'hexCurse'
        ];
        
        if (forestsOfFearKeys.includes(cardKey)) return 'forests-of-fear';
        if (putridSwampKeys.includes(cardKey)) return 'putrid-swamp';
        return 'city-of-flesh';
    },
    
    // ==================== DECK PANEL ====================
    
    renderDeck() {
        if (!this.currentDeck) return;
        
        // Update count
        const count = this.currentDeck.cards.length;
        const countEl = document.getElementById('db-count');
        const countMiniEl = document.getElementById('db-count-mini');
        countEl.textContent = count;
        if (countMiniEl) countMiniEl.textContent = count;
        countEl.className = 'db-deck-count';
        if (count >= 55 && count <= 100) countEl.classList.add('valid');
        else if (count > 0) countEl.classList.add('invalid');
        
        // Update mana curve
        this.renderCurve();
        
        // Group cards by cardKey AND foil status
        const grouped = {};
        this.currentDeck.cards.forEach(entry => {
            const key = entry.cardKey + (entry.foil ? '_foil' : '');
            if (!grouped[key]) grouped[key] = { cardKey: entry.cardKey, foil: entry.foil || false, count: 0 };
            grouped[key].count++;
        });
        
        // Render deck list
        const container = document.getElementById('db-deck-scroll');
        
        if (Object.keys(grouped).length === 0) {
            container.innerHTML = '<div class="db-deck-empty">Your deck is empty<br><span>Add cards from the left panel</span></div>';
            return;
        }
        
        let html = '';
        const sortedKeys = Object.keys(grouped).sort((a, b) => {
            const cardA = this.getCard(grouped[a].cardKey);
            const cardB = this.getCard(grouped[b].cardKey);
            return (cardA?.cost || 0) - (cardB?.cost || 0);
        });
        
        sortedKeys.forEach(groupKey => {
            const group = grouped[groupKey];
            const card = this.getCard(group.cardKey);
            if (!card) return;
            const qty = group.count;
            const typeClass = this.getTypeClass(card);
            const foilClass = group.foil ? 'foil' : '';
            const foilIcon = group.foil ? '✨' : '';
            
            html += `
                <div class="db-deck-item ${typeClass} ${foilClass}" 
                     data-card-key="${group.cardKey}" 
                     data-foil="${group.foil}">
                    <span class="db-item-cost">${card.cost}</span>
                    <span class="db-item-sprite">${DeckBuilder.renderSprite(card.sprite)}</span>
                    <span class="db-item-name">${card.name}${foilIcon}</span>
                    <span class="db-item-qty">×${qty}</span>
                </div>
            `;
        });
        
        container.innerHTML = html;
        
        // Attach event handlers for each deck item
        container.querySelectorAll('.db-deck-item').forEach(item => {
            const cardKey = item.dataset.cardKey;
            const foil = item.dataset.foil === 'true';
            
            // Track long press
            let longPressTimer = null;
            let isLongPress = false;
            
            // Regular click - remove card (only if not long press)
            item.addEventListener('click', (e) => {
                if (isLongPress) {
                    isLongPress = false;
                    return;
                }
                this.removeCard(cardKey, foil);
            });
            
            // Right-click - show detail view
            item.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.showCardDetail(cardKey);
            });
            
            // Long press start (touch)
            item.addEventListener('touchstart', (e) => {
                isLongPress = false;
                longPressTimer = setTimeout(() => {
                    isLongPress = true;
                    this.showCardDetail(cardKey);
                }, 500);
            }, { passive: true });
            
            // Long press cancel
            item.addEventListener('touchend', () => {
                clearTimeout(longPressTimer);
            });
            
            item.addEventListener('touchmove', () => {
                clearTimeout(longPressTimer);
            });
            
            item.addEventListener('touchcancel', () => {
                clearTimeout(longPressTimer);
            });
        });
    },
    
    showCardDetail(cardKey) {
        // Use deckbuilder's own preview
        this.showPreview(cardKey);
    },
    
    renderCurve() {
        const costs = [0, 0, 0, 0, 0, 0, 0]; // 0, 1, 2, 3, 4, 5, 6+
        
        if (this.currentDeck) {
            this.currentDeck.cards.forEach(entry => {
                const card = this.getCard(entry.cardKey);
                if (card) {
                    const idx = Math.min(card.cost, 6);
                    costs[idx]++;
                }
            });
        }
        
        const max = Math.max(...costs, 1);
        const maxHeight = 36; // pixels
        const container = document.getElementById('db-curve');
        
        container.innerHTML = costs.map((count, idx) => {
            const height = Math.max((count / max) * maxHeight, count > 0 ? 4 : 2);
            return `
                <div class="db-curve-col">
                    <div class="db-curve-bar" style="height: ${height}px;">
                        ${count > 0 ? `<span class="db-curve-num">${count}</span>` : ''}
                    </div>
                    <span class="db-curve-cost">${idx === 6 ? '6+' : idx}</span>
                </div>
            `;
        }).join('');
    },
    
    // ==================== CARD ACTIONS ====================
    
    // Get max copies allowed for a card in a deck
    getMaxCopies(cardKey) {
        const card = this.getCard(cardKey);
        if (!card) return 3;
        // Infinite cards: no copy limit
        if (card.infinite) return Infinity;
        // Mythical cards: 1 copy max
        if (card.mythical) return 1;
        // All other cards: 3 copies max
        return 3;
    },
    
    // Count total copies of a base card in deck (normal + foil combined)
    getBaseCardCountInDeck(cardKey) {
        if (!this.currentDeck) return 0;
        // Count all entries with this base key, regardless of foil status
        return this.currentDeck.cards.filter(c => c.cardKey === cardKey).length;
    },
    
    // Count specific variant (foil or normal) in deck
    getVariantCountInDeck(cardKey, foil) {
        if (!this.currentDeck) return 0;
        return this.currentDeck.cards.filter(c => c.cardKey === cardKey && c.foil === foil).length;
    },
    
    addCard(cardKey, foil = false) {
        if (!this.currentDeck) return;
        
        // Check if this is an infinite card (like basic pyre)
        const card = this.getCard(cardKey);
        const isInfinite = card?.infinite || false;
        
        // Get owned counts
        const normalOwned = isInfinite ? Infinity : (PlayerData.collection[cardKey]?.owned || 0);
        const holoOwned = PlayerData.collection[cardKey]?.holoOwned || 0;
        const totalOwned = normalOwned + holoOwned;
        
        // If not owned at all (and not infinite), show preview
        if (totalOwned === 0 && !isInfinite) {
            this.showPreview(cardKey);
            return;
        }
        
        // Check deck size limit
        if (this.currentDeck.cards.length >= 100) return;
        
        // Check max copies limit (3 for normal, 1 for mythical, Infinity for infinite)
        const maxCopies = this.getMaxCopies(cardKey);
        const currentCopies = this.getBaseCardCountInDeck(cardKey);
        if (currentCopies >= maxCopies) return;
        
        // Determine which variant to add (prefer the requested one if available)
        // Infinite cards are never foil
        if (isInfinite) foil = false;
        
        let addFoil = foil;
        const foilInDeck = this.getVariantCountInDeck(cardKey, true);
        const normalInDeck = this.getVariantCountInDeck(cardKey, false);
        
        if (addFoil) {
            // Want to add foil - check if we have any available
            if (foilInDeck >= holoOwned) {
                // No more foils available, try normal
                if (normalInDeck < normalOwned) {
                    addFoil = false;
                } else {
                    return; // No copies available
                }
            }
        } else {
            // Want to add normal - check if we have any available
            if (normalInDeck >= normalOwned && !isInfinite) {
                // No more normals available, try foil
                if (foilInDeck < holoOwned) {
                    addFoil = true;
                } else {
                    return; // No copies available
                }
            }
        }
        
        this.currentDeck.cards.push({ cardKey, foil: addFoil });
        this.renderDeck();
        this.renderCards();
    },
    
    removeCard(cardKey, foil = false) {
        if (!this.currentDeck) return;
        
        // Find and remove specific variant
        const idx = this.currentDeck.cards.findIndex(c => c.cardKey === cardKey && c.foil === foil);
        if (idx > -1) {
            this.currentDeck.cards.splice(idx, 1);
            this.renderDeck();
            this.renderCards();
        }
    },
    
    getCardCountInDeck(cardKey) {
        // For backwards compatibility, return total count
        return this.getBaseCardCountInDeck(cardKey);
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
    
    saveDeck() {
        if (!this.currentDeck) return;
        
        const count = this.currentDeck.cards.length;
        if (count < 55) {
            alert(`Deck needs ${55 - count} more cards (minimum 55)`);
            return;
        }
        if (count > 100) {
            alert(`Deck has ${count - 100} too many cards (maximum 100)`);
            return;
        }
        
        PlayerData.updateDeck(this.currentDeckId, {
            name: this.currentDeck.name || 'Unnamed Deck',
            cards: this.currentDeck.cards
        });
        
        this.showSelectScreen();
    },
    
    // ==================== CARD PREVIEW ====================
    
    showPreview(cardKey, isHolo = false) {
        const card = this.getCard(cardKey);
        if (!card) return;
        
        const isInfinite = card.infinite || false;
        const normalOwned = isInfinite ? Infinity : (PlayerData.collection[cardKey]?.owned || 0);
        const holoOwned = PlayerData.collection[cardKey]?.holoOwned || 0;
        const totalOwned = isInfinite ? Infinity : (normalOwned + holoOwned);
        const inDeck = this.getCardCountInDeck(cardKey);
        const available = isInfinite ? Infinity : (totalOwned - inDeck);
        const isCryptid = card.type === 'cryptid';
        const elementClass = card.element ? `element-${card.element}` : '';
        const typeClass = this.getTypeClass(card);
        
        const elementNames = { void: 'Void', blood: 'Blood', water: 'Water', steel: 'Steel', nature: 'Nature' };
        const elementIcons = { void: '◈', blood: '◉', water: '◎', steel: '⬡', nature: '❖' };
        const typeNames = { burst: 'Burst Spell', trap: 'Trap', aura: 'Aura', pyre: 'Pyre', cryptid: 'Cryptid' };
        
        let typeLabel = typeNames[card.type] || 'Card';
        if (card.isKindling) typeLabel = 'Kindling';
        if (card.mythical) typeLabel = 'Mythical Cryptid';
        if (card.element && isCryptid) typeLabel = `${elementNames[card.element]} ${typeLabel}`;
        
        // Rarity gems
        const rarityClass = card.rarity || 'common';
        const gemCount = rarityClass === 'common' ? 1 : rarityClass === 'uncommon' ? 2 : rarityClass === 'rare' ? 3 : 4;
        const rarityGems = isCryptid ? `<span class="preview-rarity ${rarityClass}">${'<span class="rarity-gem"></span>'.repeat(gemCount)}</span>` : '';
        
        // Element badge
        const elementBadge = card.element ? `<span class="preview-element-badge ${card.element}">${elementIcons[card.element]} ${elementNames[card.element]}</span>` : '';
        
        // Mythical badge
        const mythicalBadge = card.mythical ? `<div class="preview-mythical-badge"><div class="preview-mythical-eye"></div></div>` : '';
        
        // Abilities section
        let abilitiesHTML = '';
        if (card.combatAbility) abilitiesHTML += `<div class="preview-ability"><strong>Combat:</strong> ${card.combatAbility}</div>`;
        if (card.supportAbility) abilitiesHTML += `<div class="preview-ability"><strong>Support:</strong> ${card.supportAbility}</div>`;
        if (card.description) abilitiesHTML += `<div class="preview-ability">${card.description}</div>`;
        if (card.pyreEffect) abilitiesHTML += `<div class="preview-ability"><strong>Pyre:</strong> ${card.pyreEffect}</div>`;
        
        // Calculate ember values for display
        const normalValue = this.calculateIncinerateValue(cardKey, false);
        const holoValue = this.calculateIncinerateValue(cardKey, true);
        
        const content = document.getElementById('db-preview-content');
        content.innerHTML = `
            <div class="db-preview-card ${elementClass} ${typeClass}">
                <div class="db-preview-card-inner">
                    <div class="preview-header">
                        <span class="preview-name">${card.name}</span>
                        <span class="preview-cost">${card.cost}</span>
                    </div>
                    
                    <div class="preview-art-container">
                        <div class="preview-sprite">${DeckBuilder.renderSprite(card.sprite)}</div>
                        ${elementBadge}
                        ${mythicalBadge}
                    </div>
                    
                    <div class="preview-text-box">
                        <div class="preview-type">${typeLabel}</div>
                        ${isCryptid ? `
                            <div class="preview-stats-row">
                                <span class="preview-stat atk">⚔ ${card.atk}</span>
                                <span class="preview-stat hp">♥ ${card.hp}</span>
                            </div>
                        ` : ''}
                        ${abilitiesHTML ? `<div class="preview-abilities">${abilitiesHTML}</div>` : ''}
                        <div class="preview-availability">
                            ${isInfinite ? `
                                <div class="preview-owned-row have infinite">
                                    <span class="avail-label">Available:</span>
                                    <span class="avail-value">∞ Unlimited</span>
                                </div>
                            ` : `
                                <div class="preview-owned-row ${normalOwned > 0 ? 'have' : 'none'}">
                                    <span class="avail-label">Normal:</span>
                                    <span class="avail-value">${normalOwned}</span>
                                    ${normalOwned > 0 ? `<span class="ember-value">(<img src="https://f.playcode.io/p-2633929/v-1/019b6baf-a00d-779e-b5ae-a10bb55ef3b9/embers-icon.png" class="embers-img-sm" alt="">${normalValue})</span>` : ''}
                                </div>
                                <div class="preview-owned-row ${holoOwned > 0 ? 'have holo' : 'none'}">
                                    <span class="avail-label">✨ Holo:</span>
                                    <span class="avail-value">${holoOwned}</span>
                                    ${holoOwned > 0 ? `<span class="ember-value">(<img src="https://f.playcode.io/p-2633929/v-1/019b6baf-a00d-779e-b5ae-a10bb55ef3b9/embers-icon.png" class="embers-img-sm" alt="">${holoValue})</span>` : ''}
                                </div>
                            `}
                            ${this.currentDeck ? `
                                <div class="preview-deck-row">
                                    <span class="avail-label">In Deck:</span>
                                    <span class="avail-value">${inDeck}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div class="preview-footer">
                        ${rarityGems}
                        <span class="preview-set">${this.getCardSeries(cardKey).split('-').map(w => w.charAt(0).toUpperCase()).join('')}</span>
                    </div>
                </div>
            </div>
            <div class="preview-actions">
                ${(totalOwned > 0 || isInfinite) && this.currentDeck && available > 0 ? `<button class="preview-btn add" onclick="DeckBuilder.addCard('${cardKey}'); DeckBuilder.closePreview();">Add to Deck</button>` : ''}
                ${normalOwned > 0 && !isInfinite ? `<button class="preview-btn incinerate" onclick="DeckBuilder.showIncinerateModal('${cardKey}', false);"><img src='https://f.playcode.io/p-2633929/v-1/019b6baf-a00d-779e-b5ae-a10bb55ef3b9/embers-icon.png' class='embers-img-sm' alt=''> Incinerate</button>` : ''}
                ${holoOwned > 0 ? `<button class="preview-btn incinerate holo" onclick="DeckBuilder.showIncinerateModal('${cardKey}', true);">✨ Incinerate Holo</button>` : ''}
                <button class="preview-btn close" onclick="DeckBuilder.closePreview()">Close</button>
            </div>
        `;
        
        document.getElementById('db-preview-modal').classList.add('open');
    },
    
    closePreview() {
        document.getElementById('db-preview-modal').classList.remove('open');
    },
    
    // ==================== MOBILE DECK PANEL ====================
    
    toggleDeckPanel() {
        const panel = document.getElementById('db-deck-panel');
        const toggle = document.getElementById('db-deck-toggle');
        
        if (panel.classList.contains('minimized')) {
            // Expand to full screen
            panel.classList.remove('minimized');
            panel.classList.add('maximized');
            toggle.querySelector('.toggle-icon').textContent = '✕';
            toggle.querySelector('.toggle-label').textContent = 'Close';
        } else {
            // Minimize back to bar
            panel.classList.remove('maximized');
            panel.classList.add('minimized');
            toggle.querySelector('.toggle-icon').textContent = '▲';
            toggle.querySelector('.toggle-label').textContent = 'Deck';
        }
    },
    
    // ==================== INCINERATION ====================
    
    // Collection protection limits
    INCINERATE_LIMITS: {
        kindlingMinEach: 2,      // Must keep 2 of each kindling
        cryptidsMinTotal: 5,     // Must keep 5 total non-kindling cryptids
        spellsMinTotal: 5        // Must keep 5 total spells (bursts, traps, auras, non-infinite pyres)
    },
    
    incinerateState: {
        cardKey: null,
        isHolo: false,
        maxQty: 0,
        qty: 1,
        embersPerCard: 0
    },
    
    // Count total owned cards by category (for limit checking)
    getCollectionCounts() {
        let kindlingCounts = {}; // key -> count
        let nonKindlingCryptids = 0;
        let spells = 0;
        
        // Count all owned cards
        Object.keys(PlayerData.collection || {}).forEach(key => {
            const entry = PlayerData.collection[key];
            const total = (entry.owned || 0) + (entry.holoOwned || 0);
            if (total <= 0) return;
            
            const card = this.getCard(key);
            if (!card) return;
            
            if (card.isKindling) {
                kindlingCounts[key] = total;
            } else if (card.type === 'cryptid') {
                nonKindlingCryptids += total;
            } else if (['burst', 'trap', 'aura', 'pyre'].includes(card.type)) {
                // Don't count infinite pyres toward spell total
                if (!card.infinite) {
                    spells += total;
                }
            }
        });
        
        return { kindlingCounts, nonKindlingCryptids, spells };
    },
    
    // Calculate max incinerable for a specific card considering limits
    getMaxIncinerable(cardKey, isHolo = false) {
        const card = this.getCard(cardKey);
        if (!card) return 0;
        
        // Infinite cards cannot be incinerated
        if (card.infinite) return 0;
        
        // Get owned count for this variant
        const owned = isHolo 
            ? (PlayerData.collection[cardKey]?.holoOwned || 0)
            : (PlayerData.collection[cardKey]?.owned || 0);
        
        // Calculate how many are in decks
        let inDecks = 0;
        PlayerData.decks.forEach(deck => {
            deck.cards.forEach(entry => {
                if (entry.cardKey === cardKey && (entry.foil || false) === isHolo) {
                    inDecks++;
                }
            });
        });
        
        let available = owned - inDecks;
        if (available <= 0) return 0;
        
        // Apply category-specific limits
        const counts = this.getCollectionCounts();
        const totalOwned = (PlayerData.collection[cardKey]?.owned || 0) + 
                          (PlayerData.collection[cardKey]?.holoOwned || 0);
        
        if (card.isKindling) {
            // Must keep 2 of each kindling
            const mustKeep = this.INCINERATE_LIMITS.kindlingMinEach;
            const canSellTotal = Math.max(0, totalOwned - mustKeep);
            available = Math.min(available, canSellTotal);
        } else if (card.type === 'cryptid') {
            // Must keep 5 total non-kindling cryptids
            const mustKeep = this.INCINERATE_LIMITS.cryptidsMinTotal;
            const canSellTotal = Math.max(0, counts.nonKindlingCryptids - mustKeep);
            available = Math.min(available, canSellTotal);
        } else if (['burst', 'trap', 'aura', 'pyre'].includes(card.type)) {
            // Must keep 5 total spells
            const mustKeep = this.INCINERATE_LIMITS.spellsMinTotal;
            const canSellTotal = Math.max(0, counts.spells - mustKeep);
            available = Math.min(available, canSellTotal);
        }
        
        return Math.max(0, available);
    },
    
    // Get limit info for display
    getLimitInfo(cardKey) {
        const card = this.getCard(cardKey);
        if (!card) return null;
        
        if (card.infinite) {
            return { type: 'infinite', message: 'Cannot be incinerated', atLimit: true };
        }
        
        const counts = this.getCollectionCounts();
        const totalOwned = (PlayerData.collection[cardKey]?.owned || 0) + 
                          (PlayerData.collection[cardKey]?.holoOwned || 0);
        
        if (card.isKindling) {
            const limit = this.INCINERATE_LIMITS.kindlingMinEach;
            const atLimit = totalOwned <= limit;
            return { 
                type: 'kindling', 
                message: `Min ${limit} per kindling`,
                current: totalOwned,
                limit,
                atLimit
            };
        } else if (card.type === 'cryptid') {
            const limit = this.INCINERATE_LIMITS.cryptidsMinTotal;
            const atLimit = counts.nonKindlingCryptids <= limit;
            return { 
                type: 'cryptid', 
                message: `Min ${limit} cryptids total (have ${counts.nonKindlingCryptids})`,
                current: counts.nonKindlingCryptids,
                limit,
                atLimit
            };
        } else if (['burst', 'trap', 'aura', 'pyre'].includes(card.type)) {
            const limit = this.INCINERATE_LIMITS.spellsMinTotal;
            const atLimit = counts.spells <= limit;
            return { 
                type: 'spell', 
                message: `Min ${limit} spells total (have ${counts.spells})`,
                current: counts.spells,
                limit,
                atLimit
            };
        }
        
        return null;
    },
    
    // Calculate ember value for a card
    calculateIncinerateValue(cardKey, isHolo = false) {
        const card = this.getCard(cardKey);
        if (!card) return 0;
        
        // Infinite cards have no value
        if (card.infinite) return 0;
        
        // Base rarity values
        const rarityValues = {
            'common': 3,
            'uncommon': 5,
            'rare': 10,
            'ultimate': 20
        };
        
        let value = rarityValues[card.rarity] || 3;
        
        // Holo bonus
        if (isHolo) value += 10;
        
        // Mythical bonus
        if (card.mythical) value += 10;
        
        return value;
    },
    
    showIncinerateModal(cardKey, isHolo = false) {
        const card = this.getCard(cardKey);
        if (!card) return;
        
        // Check if card can be incinerated at all
        if (card.infinite) {
            showMessage('Basic Pyre cannot be incinerated');
            return;
        }
        
        const available = this.getMaxIncinerable(cardKey, isHolo);
        if (available <= 0) {
            const limitInfo = this.getLimitInfo(cardKey);
            if (limitInfo?.atLimit) {
                showMessage(`🔒 ${limitInfo.message}`);
            } else {
                showMessage('No available copies to incinerate');
            }
            return;
        }
        
        const embersPerCard = this.calculateIncinerateValue(cardKey, isHolo);
        const limitInfo = this.getLimitInfo(cardKey);
        
        this.incinerateState = {
            cardKey,
            isHolo,
            maxQty: available,
            qty: 1,
            embersPerCard
        };
        
        // Update modal content
        const holoLabel = isHolo ? ' ✨ (Holo)' : '';
        const limitHtml = limitInfo ? `<div class="incinerate-limit-info">🔒 ${limitInfo.message}</div>` : '';
        document.getElementById('incinerate-card-info').innerHTML = `
            <div class="incinerate-card-name">${card.name}${holoLabel}</div>
            <div class="incinerate-card-available">Can incinerate: ${available}</div>
            ${limitHtml}
        `;
        
        this.updateIncinerateQty();
        document.getElementById('db-incinerate-modal').classList.add('open');
    },
    
    closeIncinerateModal() {
        document.getElementById('db-incinerate-modal').classList.remove('open');
    },
    
    adjustIncinerateQty(delta) {
        const newQty = this.incinerateState.qty + delta;
        if (newQty >= 1 && newQty <= this.incinerateState.maxQty) {
            this.incinerateState.qty = newQty;
            this.updateIncinerateQty();
        }
    },
    
    updateIncinerateQty() {
        const { qty, embersPerCard, maxQty } = this.incinerateState;
        document.getElementById('incinerate-qty').textContent = qty;
        document.getElementById('incinerate-embers').textContent = (qty * embersPerCard).toLocaleString();
        
        // Disable buttons at limits
        document.getElementById('incinerate-minus').disabled = qty <= 1;
        document.getElementById('incinerate-plus').disabled = qty >= maxQty;
    },
    
    confirmIncinerate() {
        const { cardKey, isHolo, qty, embersPerCard } = this.incinerateState;
        const totalEmbers = qty * embersPerCard;
        
        // Remove cards from collection
        for (let i = 0; i < qty; i++) {
            if (isHolo) {
                if (PlayerData.collection[cardKey]?.holoOwned > 0) {
                    PlayerData.collection[cardKey].holoOwned--;
                }
            } else {
                if (PlayerData.collection[cardKey]?.owned > 0) {
                    PlayerData.collection[cardKey].owned--;
                }
            }
        }
        
        // Add embers
        PlayerData.embers = (PlayerData.embers || 0) + totalEmbers;
        PlayerData.save();
        
        // Close modals and refresh
        this.closeIncinerateModal();
        this.closePreview();
        this.renderCards();
        
        // Show confirmation
        showMessage(`Incinerated ${qty} card${qty > 1 ? 's' : ''} for ${totalEmbers} embers!`);
    },
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => DeckBuilder.init());
} else {
    DeckBuilder.init();
}