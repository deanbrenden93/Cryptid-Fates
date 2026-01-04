/**
 * Cryptid Fates - Shop & Booster System (v3)
 * Ethical monetization: Embers (free/earned) for randomized content, Souls (premium) for cosmetics/prebuilts
 * 
 * MONETIZATION PHILOSOPHY:
 * - Embers: Earned by playing. CANNOT be purchased. Used for boosters (randomized content).
 * - Souls: Premium currency. CAN be purchased. Used for cosmetics and prebuilt decks (non-random).
 * - Battle Pass: Paid access to EARN rewards through gameplay, not direct purchase of random items.
 */

window.Shop = {
    isOpen: false,
    openingPack: false,
    currentTab: 'boosters',
    packsToOpen: [],
    currentCards: [],
    quantities: {},
    
    // ==================== BOOSTERS (EMBERS ONLY) ====================
    boosters: {
        standard: {
            id: 'standard',
            name: 'Standard Pack',
            description: '5 cards with guaranteed rare or better',
            price: 100, // Embers only
            cardCount: 5,
            guaranteed: { rarity: 'rare', count: 1 },
            icon: '📦',
            glowColor: 'rgba(200, 200, 210, 0.3)'
        },
        premium: {
            id: 'premium',
            name: 'Premium Pack',
            description: '5 cards with guaranteed ultimate',
            price: 300,
            cardCount: 5,
            guaranteed: { rarity: 'ultimate', count: 1 },
            icon: '🎁',
            glowColor: 'rgba(155, 89, 182, 0.3)'
        },
        elemental: {
            id: 'elemental',
            name: 'Elemental Pack',
            description: '5 element-focused cards',
            price: 150,
            cardCount: 5,
            guaranteed: { rarity: 'rare', count: 1 },
            icon: '🌈',
            glowColor: 'rgba(100, 180, 130, 0.3)'
        },
        mega: {
            id: 'mega',
            name: 'Mega Pack',
            description: '10 cards, 2 ultimates + holo chance',
            price: 750,
            cardCount: 10,
            guaranteed: { rarity: 'ultimate', count: 2 },
            holoChance: 0.15,
            icon: '💎',
            glowColor: 'rgba(231, 76, 60, 0.3)'
        }
    },
    
    // ==================== PREBUILT DECKS (EMBERS OR SOULS) ====================
    prebuiltDecks: {
        voidDominion: {
            id: 'voidDominion',
            name: 'Void Dominion',
            description: 'Control the battlefield with Void creatures and debuffs',
            emberPrice: 500,
            soulPrice: 75,
            icon: '🟣',
            element: 'void',
            cardCount: 55,
            featured: ['voidWraith', 'shadowCat', 'shadowLeech']
        },
        bloodFury: {
            id: 'bloodFury',
            name: 'Blood Fury',
            description: 'Aggressive Blood deck focused on fast damage',
            emberPrice: 500,
            soulPrice: 75,
            icon: '🔴',
            element: 'blood',
            cardCount: 55,
            featured: ['vampireInitiate', 'fireImp', 'emberFox']
        },
        naturesResilience: {
            id: 'naturesResilience',
            name: 'Nature\'s Resilience',
            description: 'Outlast opponents with healing and tough creatures',
            emberPrice: 500,
            soulPrice: 75,
            icon: '🟢',
            element: 'nature',
            cardCount: 55,
            featured: ['mossTurtle', 'stoneGolem', 'libraryGargoyle']
        }
    },
    
    // ==================== COSMETICS (SOULS, SOME EMBERS) ====================
    cosmetics: {
        // Consumables
        holoConverter: {
            id: 'holoConverter',
            name: 'Holographic Converter',
            description: 'Convert any owned card to holographic',
            soulPrice: 25,
            icon: '✨',
            type: 'consumable'
        },
        
        // Card Backs
        cardBackSilver: {
            id: 'cardBackSilver',
            name: 'Silver Mist',
            description: 'Elegant silver card back design',
            soulPrice: 50,
            emberPrice: 300, // Also available for Embers
            icon: '🃏',
            type: 'cardback'
        },
        cardBackVoid: {
            id: 'cardBackVoid',
            name: 'Void Essence',
            description: 'Swirling purple void energy',
            soulPrice: 75,
            icon: '🃏',
            type: 'cardback'
        },
        cardBackFlame: {
            id: 'cardBackFlame',
            name: 'Eternal Flame',
            description: 'Burning crimson flames',
            soulPrice: 75,
            icon: '🃏',
            type: 'cardback'
        },
        
        // Battle Fields
        fieldVolcano: {
            id: 'fieldVolcano',
            name: 'Volcanic Arena',
            description: 'Battle on molten rock and fire',
            soulPrice: 100,
            icon: '🌋',
            type: 'field'
        },
        fieldForest: {
            id: 'fieldForest',
            name: 'Ancient Forest',
            description: 'Mystical woodland battleground',
            soulPrice: 100,
            emberPrice: 600, // Also available for Embers
            icon: '🌲',
            type: 'field'
        },
        fieldCrystal: {
            id: 'fieldCrystal',
            name: 'Crystal Cavern',
            description: 'Shimmering underground crystals',
            soulPrice: 100,
            icon: '💎',
            type: 'field'
        },
        
        // Slot Frames
        slotGold: {
            id: 'slotGold',
            name: 'Golden Frame',
            description: 'Gilded frame for your card slots',
            soulPrice: 40,
            icon: '🖼️',
            type: 'slot'
        },
        slotShadow: {
            id: 'slotShadow',
            name: 'Shadow Frame',
            description: 'Dark ethereal slot borders',
            soulPrice: 40,
            emberPrice: 250, // Also available for Embers
            icon: '🖼️',
            type: 'slot'
        },
        
        // Emotes
        emoteVictory: {
            id: 'emoteVictory',
            name: 'Victory Dance',
            description: 'Celebrate your wins in style',
            soulPrice: 30,
            emberPrice: 200, // Also available for Embers
            icon: '💃',
            type: 'emote'
        },
        emoteTaunt: {
            id: 'emoteTaunt',
            name: 'Confident Smirk',
            description: 'Show your confidence',
            soulPrice: 30,
            icon: '😏',
            type: 'emote'
        }
    },
    
    // Rarity weights for pack generation
    rarityWeights: {
        common: 60,
        rare: 30,
        ultimate: 10
    },
    
    // ==================== INITIALIZATION ====================
    
    init() {
        this.createHTML();
        this.bindEvents();
        Object.keys(this.boosters).forEach(id => this.quantities[id] = 1);
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
        overlay.id = 'shop-overlay';
        overlay.innerHTML = `
            <div class="shop-screen">
                <!-- Header -->
                <div class="shop-topbar">
                    <button class="shop-back-btn" id="shop-back">← Back</button>
                    <h1 class="shop-title">Shop</h1>
                    <div class="shop-currency">
                        <div class="shop-currency-item embers" title="Earned by playing">
                            <img src='https://f.playcode.io/p-2633929/v-1/019b6baf-a00d-779e-b5ae-a10bb55ef3b9/embers-icon.png' class='embers-img currency-icon' alt=''>
                            <span class="currency-amount" id="shop-embers">0</span>
                        </div>
                        <div class="shop-currency-item souls" title="Premium currency">
                            <span class="currency-icon">💜</span>
                            <span class="currency-amount" id="shop-souls">0</span>
                        </div>
                    </div>
                </div>
                
                <!-- Tabs -->
                <div class="shop-tabs">
                    <button class="shop-tab active" data-tab="boosters">
                        <span class="tab-icon">📦</span>
                        <span class="tab-text">Boosters</span>
                    </button>
                    <button class="shop-tab" data-tab="decks">
                        <span class="tab-icon">📚</span>
                        <span class="tab-text">Decks</span>
                    </button>
                    <button class="shop-tab" data-tab="cosmetics">
                        <span class="tab-icon">✨</span>
                        <span class="tab-text">Cosmetics</span>
                    </button>
                    <button class="shop-tab" data-tab="battlepass">
                        <span class="tab-icon">🎖️</span>
                        <span class="tab-text">Pass</span>
                    </button>
                </div>
                
                <!-- Pending Packs Banner -->
                <div class="shop-pending" id="shop-pending">
                    <div class="pending-glow"></div>
                    <span class="pending-icon">🎁</span>
                    <span class="pending-text"><strong id="pending-count">0</strong> Pack<span id="pending-plural">s</span> Ready!</span>
                    <div class="pending-buttons">
                        <button class="pending-btn open-one" onclick="Shop.openPendingPacks()">
                            <span class="btn-icon">📦</span>
                            <span class="btn-text">Open 1</span>
                        </button>
                        <button class="pending-btn open-all" onclick="Shop.openAllPendingPacks()">
                            <span class="btn-icon">✨</span>
                            <span class="btn-text" id="open-all-text">Open All</span>
                        </button>
                    </div>
                </div>
                
                <!-- Content Area -->
                <div class="shop-content" id="shop-content"></div>
            </div>
            
            <!-- Pack Opening Overlay -->
            <div class="pack-overlay" id="pack-overlay">
                <div class="pack-stage" id="pack-stage"></div>
                <div class="pack-summary" id="pack-summary">
                    <div class="summary-title">Pack Complete!</div>
                    <div class="summary-stats" id="summary-stats"></div>
                    <div class="summary-actions">
                        <button class="summary-btn secondary" onclick="Shop.closePackOpening()">Done</button>
                        <button class="summary-btn primary" id="open-another-btn" onclick="Shop.openAnotherPack()">Open Another</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    },
    
    bindEvents() {
        document.getElementById('shop-back').onclick = () => this.close();
        
        document.querySelectorAll('.shop-tab').forEach(tab => {
            tab.onclick = () => {
                document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.currentTab = tab.dataset.tab;
                this.renderContent();
            };
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                if (this.openingPack) {
                    this.closePackOpening();
                } else {
                    this.close();
                }
            }
        });
    },
    
    // ==================== NAVIGATION ====================
    
    open() {
        this.isOpen = true;
        document.getElementById('shop-overlay').classList.add('open');
        this.updateCurrency();
        this.updatePendingBanner();
        this.renderContent();
    },
    
    close() {
        this.isOpen = false;
        document.getElementById('shop-overlay').classList.remove('open');
        if (typeof HomeScreen !== 'undefined') HomeScreen.open();
    },
    
    getEmbers() {
        return (typeof PlayerData !== 'undefined' && PlayerData.embers) || 0;
    },
    
    getSouls() {
        return (typeof PlayerData !== 'undefined' && PlayerData.souls) || 0;
    },
    
    updateCurrency() {
        const embersEl = document.getElementById('shop-embers');
        const soulsEl = document.getElementById('shop-souls');
        if (embersEl) embersEl.textContent = this.getEmbers().toLocaleString();
        if (soulsEl) soulsEl.textContent = this.getSouls().toLocaleString();
    },
    
    updatePendingBanner() {
        const banner = document.getElementById('shop-pending');
        const countEl = document.getElementById('pending-count');
        const pluralEl = document.getElementById('pending-plural');
        const openAllText = document.getElementById('open-all-text');
        const openAllBtn = banner?.querySelector('.open-all');
        const openOneBtn = banner?.querySelector('.open-one');
        
        if (!banner || !countEl) return;
        
        const count = (typeof PlayerData !== 'undefined' && PlayerData.pendingPacks) 
            ? PlayerData.pendingPacks.length : 0;
        
        if (count > 0) {
            banner.classList.add('show');
            countEl.textContent = count;
            
            // Update plural
            if (pluralEl) pluralEl.textContent = count === 1 ? '' : 's';
            
            // Update buttons
            if (openOneBtn) {
                openOneBtn.style.display = 'flex';
            }
            
            if (openAllBtn && openAllText) {
                if (count === 1) {
                    // Hide "Open All" when only 1 pack
                    openAllBtn.style.display = 'none';
                } else {
                    openAllBtn.style.display = 'flex';
                    if (count <= 10) {
                        openAllText.textContent = `Open All (${count})`;
                    } else {
                        openAllText.textContent = `Open 10`;
                    }
                }
            }
        } else {
            banner.classList.remove('show');
        }
    },
    
    // ==================== CONTENT RENDERING ====================
    
    renderContent() {
        const container = document.getElementById('shop-content');
        if (!container) return;
        
        switch (this.currentTab) {
            case 'boosters': this.renderBoosters(container); break;
            case 'decks': this.renderDecks(container); break;
            case 'cosmetics': this.renderCosmetics(container); break;
            case 'battlepass': this.renderBattlePass(container); break;
        }
    },
    
    // ==================== BOOSTERS TAB ====================
    
    renderBoosters(container) {
        const embers = this.getEmbers();
        
        let html = `
            <div class="shop-section-header">
                <h2 class="section-title">Card Packs</h2>
                <p class="section-note">🔥 <strong>Embers only</strong> — earned by playing, never purchased!</p>
            </div>
            <div class="booster-grid">
        `;
        
        Object.values(this.boosters).forEach(booster => {
            const qty = this.quantities[booster.id] || 1;
            const total = booster.price * qty;
            const canAfford = embers >= total;
            
            html += `
                <div class="booster-card ${!canAfford ? 'unaffordable' : ''}" style="--glow-color: ${booster.glowColor}">
                    <div class="booster-icon">${booster.icon}</div>
                    <div class="booster-name">${booster.name}</div>
                    <div class="booster-desc">${booster.description}</div>
                    <div class="booster-cards">${booster.cardCount} cards</div>
                    
                    <div class="booster-qty">
                        <button class="qty-btn" onclick="Shop.adjustQty('${booster.id}', -1)">−</button>
                        <span class="qty-value">${qty}</span>
                        <button class="qty-btn" onclick="Shop.adjustQty('${booster.id}', 1)">+</button>
                    </div>
                    
                    <button class="price-btn embers full-width ${canAfford ? 'affordable' : ''}" 
                            onclick="Shop.buyPack('${booster.id}')" ${!canAfford ? 'disabled' : ''}>
                        <img src='https://f.playcode.io/p-2633929/v-1/019b6baf-a00d-779e-b5ae-a10bb55ef3b9/embers-icon.png' class='embers-img price-icon' alt=''>
                        <span class="price-amount">${total.toLocaleString()}</span>
                    </button>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
    },
    
    // ==================== DECKS TAB ====================
    
    renderDecks(container) {
        const embers = this.getEmbers();
        const souls = this.getSouls();
        
        let html = `
            <div class="shop-section-header">
                <h2 class="section-title">Prebuilt Decks</h2>
                <p class="section-note">Ready-to-play 55-card decks — <strong>no randomness!</strong></p>
            </div>
            <div class="decks-grid">
        `;
        
        Object.values(this.prebuiltDecks).forEach(deck => {
            const owned = this.ownsDeck(deck.id);
            const canEmbers = embers >= deck.emberPrice;
            const canSouls = souls >= deck.soulPrice;
            
            html += `
                <div class="deck-card ${owned ? 'owned' : ''}">
                    <div class="deck-header">
                        <span class="deck-icon">${deck.icon}</span>
                        <span class="deck-name">${deck.name}</span>
                    </div>
                    <div class="deck-desc">${deck.description}</div>
                    <div class="deck-meta">
                        <span>${deck.cardCount} cards</span>
                        <span class="deck-element">${deck.element}</span>
                    </div>
                    <div class="deck-preview">
                        ${deck.featured.map(key => {
                            const card = this.getCardByKey(key);
                            return `<span class="preview-sprite" title="${card?.name || key}">${Shop.renderSprite(card?.sprite)}</span>`;
                        }).join('')}
                    </div>
                    ${owned ? `
                        <div class="owned-badge">✓ Owned</div>
                    ` : `
                        <div class="deck-prices">
                            <button class="price-btn embers ${canEmbers ? 'affordable' : ''}"
                                    onclick="Shop.buyDeck('${deck.id}', 'embers')" ${!canEmbers ? 'disabled' : ''}>
                                <img src='https://f.playcode.io/p-2633929/v-1/019b6baf-a00d-779e-b5ae-a10bb55ef3b9/embers-icon.png' class='embers-img price-icon' alt=''>
                                <span class="price-amount">${deck.emberPrice}</span>
                            </button>
                            <button class="price-btn souls ${canSouls ? 'affordable' : ''}"
                                    onclick="Shop.buyDeck('${deck.id}', 'souls')" ${!canSouls ? 'disabled' : ''}>
                                <span class="price-icon">💜</span>
                                <span class="price-amount">${deck.soulPrice}</span>
                            </button>
                        </div>
                    `}
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
    },
    
    // ==================== COSMETICS TAB ====================
    
    renderCosmetics(container) {
        const embers = this.getEmbers();
        const souls = this.getSouls();
        
        // Group by type
        const groups = {};
        Object.values(this.cosmetics).forEach(item => {
            if (!groups[item.type]) groups[item.type] = [];
            groups[item.type].push(item);
        });
        
        const typeLabels = {
            consumable: '🧪 Consumables',
            cardback: '🃏 Card Backs',
            field: '🏟️ Battle Fields',
            slot: '🖼️ Slot Frames',
            emote: '💬 Emotes'
        };
        
        let html = `
            <div class="shop-section-header">
                <h2 class="section-title">Cosmetics</h2>
                <p class="section-note">💜 Souls primary • Some available for 🔥 Embers</p>
            </div>
        `;
        
        Object.entries(groups).forEach(([type, items]) => {
            html += `
                <div class="cosmetic-section">
                    <h3 class="cosmetic-type-title">${typeLabels[type] || type}</h3>
                    <div class="cosmetics-grid">
            `;
            
            items.forEach(item => {
                const owned = this.ownsCosmetic(item.id);
                const canSouls = item.soulPrice && souls >= item.soulPrice;
                const canEmbers = item.emberPrice && embers >= item.emberPrice;
                
                html += `
                    <div class="cosmetic-card ${owned ? 'owned' : ''}">
                        <div class="cosmetic-icon">${item.icon}</div>
                        <div class="cosmetic-name">${item.name}</div>
                        <div class="cosmetic-desc">${item.description}</div>
                        ${owned ? `
                            <div class="owned-badge small">✓ Owned</div>
                        ` : `
                            <div class="cosmetic-prices">
                                ${item.soulPrice ? `
                                    <button class="price-btn souls small ${canSouls ? 'affordable' : ''}"
                                            onclick="Shop.buyCosmetic('${item.id}', 'souls')" ${!canSouls ? 'disabled' : ''}>
                                        <span class="price-icon">💜</span>
                                        <span class="price-amount">${item.soulPrice}</span>
                                    </button>
                                ` : ''}
                                ${item.emberPrice ? `
                                    <button class="price-btn embers small ${canEmbers ? 'affordable' : ''}"
                                            onclick="Shop.buyCosmetic('${item.id}', 'embers')" ${!canEmbers ? 'disabled' : ''}>
                                        <img src='https://f.playcode.io/p-2633929/v-1/019b6baf-a00d-779e-b5ae-a10bb55ef3b9/embers-icon.png' class='embers-img price-icon' alt=''>
                                        <span class="price-amount">${item.emberPrice}</span>
                                    </button>
                                ` : ''}
                            </div>
                        `}
                    </div>
                `;
            });
            
            html += '</div></div>';
        });
        
        container.innerHTML = html;
    },
    
    // ==================== BATTLE PASS TAB ====================
    
    renderBattlePass(container) {
        const hasPremium = (typeof PlayerData !== 'undefined' && PlayerData.hasPremiumPass) || false;
        const currentTier = (typeof PlayerData !== 'undefined' && PlayerData.battlePassTier) || 0;
        const xp = (typeof PlayerData !== 'undefined' && PlayerData.battlePassXP) || 0;
        const xpPerTier = 1000;
        const maxTier = 50;
        
        // Tier rewards (selection shown)
        const rewards = [
            { tier: 1, free: '50 🔥', premium: 'Card Back: Starter' },
            { tier: 5, free: 'Standard Pack', premium: '100 🔥' },
            { tier: 10, free: '100 🔥', premium: 'Premium Pack' },
            { tier: 15, free: 'Standard Pack', premium: 'Emote: Wave' },
            { tier: 20, free: '150 🔥', premium: 'Field: Crystal Cave' },
            { tier: 25, free: 'Standard Pack', premium: '300 🔥' },
            { tier: 30, free: '200 🔥', premium: 'Premium Pack' },
            { tier: 35, free: 'Elemental Pack', premium: 'Card Back: Flame' },
            { tier: 40, free: '250 🔥', premium: 'Mega Pack' },
            { tier: 50, free: '500 🔥', premium: '✧ Exclusive Holo Card' }
        ];
        
        let html = `
            <div class="bp-header">
                <div class="bp-season">
                    <span class="bp-icon">🎖️</span>
                    <div class="bp-season-info">
                        <span class="bp-season-name">Season 1: Origins</span>
                        <span class="bp-season-ends">Ends in 45 days</span>
                    </div>
                </div>
                <div class="bp-progress-section">
                    <div class="bp-tier-display">Tier ${currentTier}/${maxTier}</div>
                    <div class="bp-xp-bar">
                        <div class="bp-xp-fill" style="width: ${(xp % xpPerTier) / xpPerTier * 100}%"></div>
                    </div>
                    <div class="bp-xp-text">${xp % xpPerTier}/${xpPerTier} XP to next tier</div>
                </div>
                ${!hasPremium ? `
                    <button class="bp-upgrade-btn" onclick="Shop.upgradeBattlePass()">
                        Upgrade to Premium
                        <span class="bp-price">💜 500</span>
                    </button>
                ` : `
                    <div class="bp-premium-active">✧ Premium Active</div>
                `}
            </div>
            
            <div class="bp-explainer">
                <div class="bp-explainer-title">How It Works</div>
                <div class="bp-explainer-points">
                    <p>🎮 <strong>Play matches</strong> and complete challenges to earn XP</p>
                    <p>🔓 <strong>Unlock rewards</strong> at each tier — free track for everyone!</p>
                    <p>✨ <strong>Premium track</strong> adds exclusive cosmetics + bonus Embers</p>
                </div>
                <div class="bp-ethics-note">
                    💡 All card packs are <strong>earned through gameplay</strong> — never purchased directly with real money.
                </div>
            </div>
            
            <div class="bp-rewards">
                <div class="bp-track-header">
                    <span class="bp-track-label">Tier</span>
                    <span class="bp-track-label free">Free Track</span>
                    <span class="bp-track-label premium">Premium Track</span>
                </div>
                <div class="bp-track-list">
        `;
        
        rewards.forEach(r => {
            const unlocked = currentTier >= r.tier;
            const premUnlocked = unlocked && hasPremium;
            
            html += `
                <div class="bp-tier-row ${unlocked ? 'unlocked' : ''}">
                    <div class="bp-tier-num">${r.tier}</div>
                    <div class="bp-reward free ${unlocked ? 'claimed' : ''}">${r.free}</div>
                    <div class="bp-reward premium ${premUnlocked ? 'claimed' : ''} ${!hasPremium && !unlocked ? 'locked' : ''}">${r.premium}</div>
                </div>
            `;
        });
        
        html += '</div></div>';
        container.innerHTML = html;
    },
    
    // ==================== PURCHASING ====================
    
    adjustQty(id, delta) {
        const cur = this.quantities[id] || 1;
        this.quantities[id] = Math.max(1, Math.min(10, cur + delta));
        this.renderContent();
    },
    
    buyPack(id) {
        if (typeof PlayerData === 'undefined') return;
        
        const booster = this.boosters[id];
        if (!booster) return;
        
        const qty = this.quantities[id] || 1;
        const total = booster.price * qty;
        
        if (this.getEmbers() < total) return;
        
        PlayerData.embers -= total;
        
        // Add to pending packs
        if (!PlayerData.pendingPacks) PlayerData.pendingPacks = [];
        for (let i = 0; i < qty; i++) {
            PlayerData.pendingPacks.push(id);
        }
        PlayerData.save();
        
        // Show purchase confirmation
        this.showPurchaseConfirmation(booster, qty, total);
        
        this.updateCurrency();
        this.updatePendingBanner();
        this.renderContent();
    },
    
    showPurchaseConfirmation(booster, qty, total) {
        // Create confirmation overlay
        const overlay = document.createElement('div');
        overlay.className = 'purchase-confirmation';
        overlay.innerHTML = `
            <div class="purchase-content">
                <div class="purchase-icon">${booster.icon}</div>
                <div class="purchase-burst"></div>
                <div class="purchase-title">Pack${qty > 1 ? 's' : ''} Acquired!</div>
                <div class="purchase-details">
                    <span class="purchase-qty">×${qty}</span>
                    <span class="purchase-name">${booster.name}</span>
                </div>
                <div class="purchase-cost">
                    <img src='https://f.playcode.io/p-2633929/v-1/019b6baf-a00d-779e-b5ae-a10bb55ef3b9/embers-icon.png' class='embers-img cost-icon' alt=''>
                    <span class="cost-amount">-${total}</span>
                </div>
                <div class="purchase-hint">Ready to open in your inventory!</div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        // Animate in
        requestAnimationFrame(() => {
            overlay.classList.add('show');
        });
        
        // Auto-dismiss after 2 seconds
        setTimeout(() => {
            overlay.classList.add('hiding');
            setTimeout(() => overlay.remove(), 400);
        }, 2000);
        
        // Click to dismiss
        overlay.onclick = () => {
            overlay.classList.add('hiding');
            setTimeout(() => overlay.remove(), 400);
        };
    },
    
    buyDeck(id, currency) {
        if (typeof PlayerData === 'undefined') return;
        
        const deck = this.prebuiltDecks[id];
        if (!deck || this.ownsDeck(id)) return;
        
        const price = currency === 'souls' ? deck.soulPrice : deck.emberPrice;
        const balance = currency === 'souls' ? this.getSouls() : this.getEmbers();
        
        if (balance < price) return;
        
        if (currency === 'souls') {
            PlayerData.souls -= price;
        } else {
            PlayerData.embers -= price;
        }
        
        if (!PlayerData.ownedDecks) PlayerData.ownedDecks = [];
        PlayerData.ownedDecks.push(id);
        
        // TODO: Grant actual deck cards
        PlayerData.save();
        this.updateCurrency();
        this.renderContent();
    },
    
    buyCosmetic(id, currency) {
        if (typeof PlayerData === 'undefined') return;
        
        const item = this.cosmetics[id];
        if (!item || this.ownsCosmetic(id)) return;
        
        const price = currency === 'souls' ? item.soulPrice : item.emberPrice;
        if (!price) return;
        
        const balance = currency === 'souls' ? this.getSouls() : this.getEmbers();
        if (balance < price) return;
        
        if (currency === 'souls') {
            PlayerData.souls -= price;
        } else {
            PlayerData.embers -= price;
        }
        
        if (!PlayerData.ownedCosmetics) PlayerData.ownedCosmetics = [];
        PlayerData.ownedCosmetics.push(id);
        
        PlayerData.save();
        this.updateCurrency();
        this.renderContent();
    },
    
    upgradeBattlePass() {
        if (typeof PlayerData === 'undefined') return;
        
        const price = 500;
        if (this.getSouls() < price) {
            alert('Not enough Souls!');
            return;
        }
        
        PlayerData.souls -= price;
        PlayerData.hasPremiumPass = true;
        PlayerData.save();
        
        this.updateCurrency();
        this.renderContent();
    },
    
    // ==================== OWNERSHIP ====================
    
    ownsDeck(id) {
        return (typeof PlayerData !== 'undefined' && PlayerData.ownedDecks || []).includes(id);
    },
    
    ownsCosmetic(id) {
        return (typeof PlayerData !== 'undefined' && PlayerData.ownedCosmetics || []).includes(id);
    },
    
    getCardByKey(key) {
        if (typeof CardRegistry === 'undefined') return null;
        return CardRegistry.getCryptid(key) || CardRegistry.getKindling(key) ||
               CardRegistry.getBurst(key) || CardRegistry.getTrap(key) ||
               CardRegistry.getAura(key) || CardRegistry.getPyre(key);
    },
    
    // Get card series for a card key
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
    
    // Standalone card detail modal for shop context
    showCardDetail(cardKey) {
        // Get card data
        let card = null;
        let cardType = null;
        
        if (typeof CardRegistry !== 'undefined') {
            const c = CardRegistry.getCryptid(cardKey);
            if (c) { card = { ...c, key: cardKey }; cardType = 'cryptid'; }
            
            if (!card) {
                const k = CardRegistry.getKindling(cardKey);
                if (k) { card = { ...k, key: cardKey, isKindling: true }; cardType = 'cryptid'; }
            }
            
            if (!card) {
                const b = CardRegistry.getBurst(cardKey);
                if (b) { card = { ...b, key: cardKey }; cardType = 'burst'; }
            }
            
            if (!card) {
                const t = CardRegistry.getTrap(cardKey);
                if (t) { card = { ...t, key: cardKey }; cardType = 'trap'; }
            }
            
            if (!card) {
                const a = CardRegistry.getAura(cardKey);
                if (a) { card = { ...a, key: cardKey }; cardType = 'aura'; }
            }
            
            if (!card) {
                const p = CardRegistry.getPyre(cardKey);
                if (p) { card = { ...p, key: cardKey, cost: 0 }; cardType = 'pyre'; }
            }
        }
        
        if (!card) return;
        
        card.type = cardType;
        
        const isCryptid = cardType === 'cryptid';
        const elementClass = card.element ? `element-${card.element}` : '';
        const typeClass = card.isKindling ? 'kindling-card' : 
                         cardType === 'trap' ? 'trap-card' :
                         cardType === 'aura' ? 'aura-card' :
                         cardType === 'pyre' ? 'pyre-card' :
                         cardType === 'burst' ? 'burst-card' : '';
        const rarityClass = card.rarity || 'common';
        const mythicalClass = card.mythical ? 'mythical' : '';
        const cardTypeClass = isCryptid ? 'cryptid-card' : 'spell-card';
        
        // Card type label
        let cardTypeLabel;
        if (isCryptid) {
            cardTypeLabel = card.isKindling ? 'Kindling' : 'Cryptid';
        } else {
            const spellTypeLabels = { trap: 'Trap', aura: 'Aura', pyre: 'Pyre', burst: 'Burst' };
            cardTypeLabel = spellTypeLabels[cardType] || 'Spell';
        }
        
        // Stats HTML
        let statsHTML = '';
        if (isCryptid) {
            statsHTML = `<span class="gc-stat atk">${card.atk}</span><span class="gc-stat hp">${card.hp}</span>`;
        } else {
            const typeLabels = { trap: 'Trap', aura: 'Aura', pyre: 'Pyre', burst: 'Burst' };
            statsHTML = `<span class="gc-stat-type">${typeLabels[cardType] || 'Spell'}</span>`;
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
        
        // Owned count
        const normalOwned = typeof PlayerData !== 'undefined' ? (PlayerData.collection[cardKey]?.owned || 0) : 0;
        const holoOwned = typeof PlayerData !== 'undefined' ? (PlayerData.collection[cardKey]?.holoOwned || 0) : 0;
        
        // Sprite HTML with scale
        const spriteHTML = card.sprite ? 
            (card.sprite.startsWith('http') || card.sprite.startsWith('sprites/') ? 
                `<img src="${card.sprite}" class="sprite-img"${card.cardSpriteScale && card.cardSpriteScale !== 1 ? ` style="transform: scale(${card.cardSpriteScale})"` : ''} alt="" draggable="false">` : card.sprite) 
            : '?';
        
        // Remove existing modal if any
        const existing = document.getElementById('shop-card-detail-modal');
        if (existing) existing.remove();
        
        // Create modal
        const modal = document.createElement('div');
        modal.id = 'shop-card-detail-modal';
        modal.className = 'shop-card-detail-modal db-preview-modal';
        modal.innerHTML = `
            <div class="db-preview-backdrop"></div>
            <div class="db-preview-content">
                <div class="detail-view-layout">
                    <!-- Scaled up game card using actual template -->
                    <div class="detail-card-wrapper">
                        <div class="game-card detail-card ${cardTypeClass} ${elementClass} ${typeClass} ${rarityClass} ${mythicalClass}">
                            <span class="gc-cost">${card.cost}</span>
                            <div class="gc-header"><span class="gc-name">${card.name}</span></div>
                            <div class="gc-art">${spriteHTML}</div>
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
                    <button class="detail-btn close" onclick="Shop.closeCardDetail()">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Animate in
        requestAnimationFrame(() => {
            modal.classList.add('open');
        });
        
        // Click backdrop to close
        modal.querySelector('.db-preview-backdrop').onclick = () => this.closeCardDetail();
        
        // Add click handlers for variant toggle
        modal.querySelectorAll('.detail-collection-item.clickable').forEach(item => {
            item.addEventListener('click', () => {
                const variant = item.dataset.variant;
                const card = modal.querySelector('.game-card.detail-card');
                const allItems = modal.querySelectorAll('.detail-collection-item.clickable');
                
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
    
    closeCardDetail() {
        const modal = document.getElementById('shop-card-detail-modal');
        if (modal) {
            modal.classList.remove('open');
            setTimeout(() => modal.remove(), 300);
        }
    },
    
    // ==================== PACK OPENING ====================
    
    skipAnimations: false,
    flipTimeouts: [],
    allRevealedCards: [],
    
    startPackOpening() {
        if (!this.packsToOpen.length) return;
        
        this.openingPack = true;
        this.skipAnimations = false;
        this.allRevealedCards = [];
        
        // Determine how many packs to open at once
        const batchSize = Math.min(this.packsToOpen.length, 10);
        const packsForThisBatch = this.packsToOpen.splice(0, batchSize);
        
        // Generate cards for all packs
        packsForThisBatch.forEach(id => {
            const booster = this.boosters[id];
            if (booster) {
                const cards = this.generatePackCards(booster);
                cards.forEach(c => c.boosterId = id);
                this.allRevealedCards.push(...cards);
            }
        });
        
        const stage = document.getElementById('pack-stage');
        const mainBooster = this.boosters[packsForThisBatch[0]];
        
        // Epic pack opening intro - only show ONE pack icon to prevent stuttering
        stage.innerHTML = `
            <div class="pack-epic-intro">
                <div class="pack-burst"></div>
                <div class="pack-glow-ring"></div>
                <div class="packs-stack">
                    <div class="pack-unopened" style="--glow-color: ${mainBooster.glowColor}">
                        <span class="pack-emoji">${mainBooster.icon}</span>
                    </div>
                </div>
                ${batchSize > 1 ? `<div class="pack-count-badge">×${batchSize}</div>` : ''}
                <div class="pack-hint">Tap anywhere to open</div>
            </div>
        `;
        
        document.getElementById('pack-summary').classList.remove('show');
        document.getElementById('pack-overlay').classList.add('active');
        document.getElementById('open-another-btn').style.display = 'none';
        
        // Add click handler to open
        stage.onclick = () => this.openPackBurst();
    },
    
    openPackBurst() {
        const stage = document.getElementById('pack-stage');
        const intro = stage.querySelector('.pack-epic-intro');
        if (!intro || intro.classList.contains('opening')) return;
        
        intro.classList.add('opening');
        stage.onclick = null;
        
        // Epic burst animation
        setTimeout(() => this.revealCards(), 1200);
    },
    
    revealCards() {
        const stage = document.getElementById('pack-stage');
        this.revealComplete = false;
        this.skipAnimations = false;
        this.flipTimeouts = [];
        
        // Element icons matching battle cards
        const elementIcons = { void: '◈', blood: '◉', water: '◎', steel: '⬡', nature: '❖' };
        
        let html = `
            <div class="cards-reveal-epic" id="cards-reveal-container">
                <div class="reveal-header-epic">
                    <span class="reveal-count">${this.allRevealedCards.length} Cards</span>
                    <span class="reveal-skip-hint" id="reveal-skip-hint">Tap anywhere to skip</span>
                </div>
                <div class="cards-grid-reveal" id="cards-grid-reveal">
        `;
        
        this.allRevealedCards.forEach((card, i) => {
            const isNew = typeof PlayerData !== 'undefined' && !PlayerData.ownsCard(card.key);
            const isCryptid = card.type === 'cryptid' || card.atk !== undefined;
            const cardTypeClass = isCryptid ? 'cryptid-card' : 'spell-card';
            const elementClass = card.element ? `element-${card.element}` : '';
            const typeClass = this.getCardTypeClass(card);
            const cost = card.cost !== undefined ? card.cost : 0;
            const rarityClass = card.rarity || 'common';
            const foilClass = card.isHolo ? 'foil' : '';
            const mythicalClass = card.mythical ? 'mythical' : '';
            
            // Stats display
            let statsHTML = '';
            if (isCryptid) {
                statsHTML = `
                    <span class="gc-stat atk">${card.atk}</span>
                    <span class="gc-stat hp">${card.hp}</span>
                `;
            } else {
                const typeNames = { burst: 'Burst', trap: 'Trap', aura: 'Aura', pyre: 'Pyre', kindling: 'Kindling' };
                statsHTML = `<span class="gc-stat-type">${typeNames[card.type] || 'Spell'}</span>`;
            }
            
            // Rarity gems (sprite-based)
            const rarityGems = `<span class="gc-rarity ${rarityClass}"></span>`;
            
            // NEW badge
            const newBadge = isNew ? '<span class="gc-new">NEW</span>' : '';
            
            // Sprite
            const spriteHTML = typeof Collection !== 'undefined' && Collection.renderSprite 
                ? Collection.renderSprite(card.sprite)
                : this.renderSprite(card.sprite);
            
            // Game card with reveal-card animation class
            html += `
                <div class="game-card reveal-card ${cardTypeClass} ${rarityClass} ${elementClass} ${typeClass} ${mythicalClass} ${foilClass}" 
                     data-index="${i}" data-key="${card.key}" data-holo="${card.isHolo ? '1' : '0'}"
                     style="--delay: ${i * 0.08}s">
                    <span class="gc-cost">${cost}</span>
                    <div class="gc-header"><span class="gc-name">${card.name}</span></div>
                    <div class="gc-art">${spriteHTML}</div>
                    <div class="gc-stats">${statsHTML}</div>
                    ${rarityGems}
                    ${newBadge}
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
        stage.innerHTML = html;
        
        // Setup click handlers for each card (for detail view)
        document.querySelectorAll('.game-card.reveal-card').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                if (el.classList.contains('revealed')) {
                    Shop.showCardDetail(el.dataset.key);
                }
            });
            
            el.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                if (el.classList.contains('revealed')) {
                    Shop.showCardDetail(el.dataset.key);
                }
            });
        });
        
        // Skip handler - click anywhere except on cards
        const skipArea = document.getElementById('cards-reveal-container');
        skipArea.addEventListener('click', (e) => {
            if (e.target.closest('.game-card')) return;
            if (!this.revealComplete && !this.skipAnimations) {
                this.skipAnimations = true;
                this.finishAllReveals();
            }
        });
        
        // Staggered reveal animation
        this.allRevealedCards.forEach((card, i) => {
            const timeout = setTimeout(() => {
                if (this.skipAnimations) return;
                const el = document.querySelector(`.reveal-card[data-index="${i}"]`);
                if (el) {
                    el.classList.add('revealed');
                    if (typeof PlayerData !== 'undefined') {
                        PlayerData.addToCollection(card.key, 1, null, card.isHolo);
                    }
                }
            }, 300 + i * 100);
            this.flipTimeouts.push(timeout);
        });
        
        // Show summary after all cards revealed
        const totalTime = 300 + this.allRevealedCards.length * 100 + 500;
        const summaryTimeout = setTimeout(() => {
            if (!this.skipAnimations) {
                this.showPackSummary();
            }
        }, totalTime);
        this.flipTimeouts.push(summaryTimeout);
    },
    
    finishAllReveals() {
        this.revealComplete = true;
        
        if (this.flipTimeouts) {
            this.flipTimeouts.forEach(t => clearTimeout(t));
            this.flipTimeouts = [];
        }
        
        const skipHint = document.getElementById('reveal-skip-hint');
        if (skipHint) skipHint.style.display = 'none';
        
        // Instantly reveal all cards
        this.allRevealedCards.forEach((card, i) => {
            const el = document.querySelector(`.reveal-card[data-index="${i}"]`);
            if (el && !el.classList.contains('revealed')) {
                el.style.setProperty('--delay', '0s');
                el.classList.add('revealed');
                if (typeof PlayerData !== 'undefined') {
                    PlayerData.addToCollection(card.key, 1, null, card.isHolo);
                }
            }
        });
        
        setTimeout(() => this.showPackSummary(), 150);
    },
    
    getCardTypeClass(card) {
        if (card.type === 'kindling') return 'kindling-card';
        if (card.type === 'trap') return 'trap-card';
        if (card.type === 'aura') return 'aura-card';
        if (card.type === 'pyre') return 'pyre-card';
        if (card.type === 'burst') return 'burst-card';
        return '';
    },
    
    showPackSummary() {
        this.revealComplete = true;
        
        // Hide skip hint
        const skipHint = document.getElementById('reveal-skip-hint');
        if (skipHint) skipHint.style.display = 'none';
        
        const stats = document.getElementById('summary-stats');
        
        const newCount = this.allRevealedCards.filter(c => {
            if (typeof PlayerData === 'undefined') return true;
            const o = PlayerData.collection[c.key];
            return !o || o.owned <= 1;
        }).length;
        
        const commons = this.allRevealedCards.filter(c => c.rarity === 'common').length;
        const rares = this.allRevealedCards.filter(c => c.rarity === 'rare').length;
        const ultimates = this.allRevealedCards.filter(c => c.rarity === 'ultimate').length;
        const holos = this.allRevealedCards.filter(c => c.isHolo).length;
        
        stats.innerHTML = `
            <div class="stat-item"><span class="stat-value">${this.allRevealedCards.length}</span><span class="stat-label">Cards</span></div>
            <div class="stat-item new"><span class="stat-value">${newCount}</span><span class="stat-label">New</span></div>
            ${commons ? `<div class="stat-item common"><span class="stat-value">${commons}</span><span class="stat-label">Common</span></div>` : ''}
            ${rares ? `<div class="stat-item rare"><span class="stat-value">${rares}</span><span class="stat-label">Rare</span></div>` : ''}
            ${ultimates ? `<div class="stat-item ultimate"><span class="stat-value">${ultimates}</span><span class="stat-label">Ultimate</span></div>` : ''}
            ${holos ? `<div class="stat-item holo"><span class="stat-value">✧${holos}</span><span class="stat-label">Holo</span></div>` : ''}
        `;
        
        // Show "Open More" button if there are remaining packs
        const openMoreBtn = document.getElementById('open-another-btn');
        if (this.packsToOpen.length > 0) {
            const nextBatch = Math.min(this.packsToOpen.length, 10);
            openMoreBtn.textContent = nextBatch === this.packsToOpen.length 
                ? `Open All (${nextBatch})` 
                : `Open ${nextBatch} More`;
            openMoreBtn.style.display = 'block';
        } else {
            openMoreBtn.style.display = 'none';
        }
        
        document.getElementById('pack-summary').classList.add('show');
        
        // Remove skip handler
        document.getElementById('pack-stage').onclick = null;
    },
    
    closePackOpening() {
        // Save any remaining packs to pending
        if (this.packsToOpen.length > 0 && typeof PlayerData !== 'undefined') {
            if (!PlayerData.pendingPacks) PlayerData.pendingPacks = [];
            PlayerData.pendingPacks.push(...this.packsToOpen);
            PlayerData.save();
            this.packsToOpen = [];
        }
        
        this.openingPack = false;
        document.getElementById('pack-overlay').classList.remove('active');
        this.updateCurrency();
        this.updatePendingBanner();
        this.renderContent();
    },
    
    openAnotherPack() {
        this.packsToOpen.length ? this.startPackOpening() : this.closePackOpening();
    },
    
    openPendingPacks() {
        if (typeof PlayerData === 'undefined') return;
        if (!PlayerData.pendingPacks || PlayerData.pendingPacks.length === 0) return;
        
        // Open just 1 pack
        this.packsToOpen = [PlayerData.pendingPacks.shift()];
        PlayerData.save();
        this.updatePendingBanner();
        this.startPackOpening();
    },
    
    openAllPendingPacks() {
        if (typeof PlayerData === 'undefined') return;
        if (!PlayerData.pendingPacks || PlayerData.pendingPacks.length === 0) return;
        
        // Take up to 10 packs
        const batchSize = Math.min(PlayerData.pendingPacks.length, 10);
        this.packsToOpen = PlayerData.pendingPacks.splice(0, batchSize);
        PlayerData.save();
        this.updatePendingBanner();
        this.startPackOpening();
    },
    
    // ==================== PACK GENERATION ====================
    
    generatePackCards(booster) {
        const cards = [];
        const pool = this.getPackableCards();
        
        // Guaranteed
        if (booster.guaranteed) {
            for (let i = 0; i < booster.guaranteed.count; i++) {
                const rarityPool = pool.filter(c => c.rarity === booster.guaranteed.rarity);
                if (rarityPool.length) {
                    const card = { ...rarityPool[Math.floor(Math.random() * rarityPool.length)] };
                    card.isHolo = booster.holoChance && Math.random() < booster.holoChance;
                    cards.push(card);
                }
            }
        }
        
        // Fill
        while (cards.length < booster.cardCount) {
            const rarity = this.rollRarity();
            const rarityPool = pool.filter(c => c.rarity === rarity);
            if (rarityPool.length) {
                const card = { ...rarityPool[Math.floor(Math.random() * rarityPool.length)] };
                card.isHolo = booster.holoChance && Math.random() < booster.holoChance;
                cards.push(card);
            }
        }
        
        return cards;
    },
    
    getPackableCards() {
        const cards = [];
        if (typeof CardRegistry === 'undefined') return cards;
        
        CardRegistry.getAllCryptidKeys().forEach(key => {
            const c = CardRegistry.getCryptid(key);
            if (c && !c.evolvesFrom) cards.push({ ...c, key, rarity: c.rarity || 'common' });
        });
        
        CardRegistry.getAllBurstKeys().forEach(key => {
            const c = CardRegistry.getBurst(key);
            if (c) cards.push({ ...c, key, rarity: 'common' });
        });
        
        CardRegistry.getAllTrapKeys().forEach(key => {
            const c = CardRegistry.getTrap(key);
            if (c) cards.push({ ...c, key, rarity: 'rare' });
        });
        
        CardRegistry.getAllAuraKeys().forEach(key => {
            const c = CardRegistry.getAura(key);
            if (c) cards.push({ ...c, key, rarity: c.rarity || 'common' });
        });
        
        return cards;
    },
    
    rollRarity() {
        const total = Object.values(this.rarityWeights).reduce((a, b) => a + b, 0);
        let roll = Math.random() * total;
        
        for (const [rarity, weight] of Object.entries(this.rarityWeights)) {
            roll -= weight;
            if (roll <= 0) return rarity;
        }
        return 'common';
    }
};

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Shop.init());
} else {
    Shop.init();
}