/**
 * Cryptid Fates - Shared Card Registry
 * 
 * Isomorphic card registration and lookup system.
 * Cards are registered with their declarative effect definitions.
 * Works identically on client (browser) and server (Cloudflare Worker).
 * 
 * Usage:
 *   const registry = createCardRegistry();
 *   registry.registerCryptid('hellpup', { name: 'Hellpup', ... });
 *   const card = registry.getCryptid('hellpup');
 */

/**
 * Create a new CardRegistry instance
 * @param {Object} options - Configuration options
 * @param {boolean} options.debug - Enable debug logging
 * @param {Function} options.logger - Custom logging function
 * @returns {Object} CardRegistry instance
 */
function createCardRegistry(options = {}) {
    const debug = options.debug || false;
    const logger = options.logger || console.log;
    
    // Card storage by type
    const cryptids = {};
    const bursts = {};
    const kindling = {};
    const traps = {};
    const auras = {};
    const pyres = {};
    
    // ID generation
    let nextId = 1;
    
    /**
     * Generate a unique ID for a card instance
     * @param {string} key - Card key
     * @returns {string} Unique ID
     */
    function generateId(key) {
        return `${key}_${nextId++}_${Date.now().toString(36)}`;
    }
    
    /**
     * Deep clone a card template to create an instance
     * @param {Object} template - Card template
     * @returns {Object} Cloned card instance
     */
    function cloneCard(template) {
        if (!template) return null;
        
        // Deep clone to avoid mutation issues
        const clone = JSON.parse(JSON.stringify(template));
        
        // Restore functions that were lost in JSON serialization
        // (effects[] callbacks are pure data, but some cards have function helpers)
        if (template.triggerCondition) {
            clone.triggerCondition = template.triggerCondition;
        }
        if (template.getSupportAbility) {
            clone.getSupportAbility = template.getSupportAbility;
        }
        if (template.getCombatAbility) {
            clone.getCombatAbility = template.getCombatAbility;
        }
        
        return clone;
    }
    
    const registry = {
        // ==================== REGISTRATION ====================
        
        /**
         * Register a cryptid card
         * @param {string} key - Unique identifier
         * @param {Object} data - Card data
         */
        registerCryptid(key, data) {
            cryptids[key] = { 
                ...data, 
                key, 
                type: 'cryptid',
                // Initialize runtime stats from base stats
                getInitialized() {
                    return {
                        ...this,
                        id: generateId(key),
                        currentHp: this.hp,
                        maxHp: this.hp,
                        currentAtk: this.atk,
                        baseAtk: this.atk,
                    };
                }
            };
            if (debug) {
                logger(`[CardRegistry] Registered cryptid: ${key}`);
            }
        },
        
        /**
         * Register a burst/instant spell
         * @param {string} key - Unique identifier
         * @param {Object} data - Card data
         */
        registerBurst(key, data) {
            bursts[key] = { ...data, key, type: 'burst' };
            if (debug) {
                logger(`[CardRegistry] Registered burst: ${key}`);
            }
        },
        
        /**
         * Alias for registerBurst
         */
        registerInstant(key, data) {
            this.registerBurst(key, data);
        },
        
        /**
         * Register a kindling card
         * @param {string} key - Unique identifier
         * @param {Object} data - Card data
         */
        registerKindling(key, data) {
            kindling[key] = { 
                ...data, 
                key, 
                type: 'cryptid', // Kindling are cryptids
                isKindling: true,
                getInitialized() {
                    return {
                        ...this,
                        id: generateId(key),
                        currentHp: this.hp,
                        maxHp: this.hp,
                        currentAtk: this.atk,
                        baseAtk: this.atk,
                        isKindling: true,
                    };
                }
            };
            if (debug) {
                logger(`[CardRegistry] Registered kindling: ${key}`);
            }
        },
        
        /**
         * Register a trap card
         * @param {string} key - Unique identifier
         * @param {Object} data - Card data
         */
        registerTrap(key, data) {
            traps[key] = { 
                ...data, 
                key, 
                type: 'trap',
                // Store the triggerCondition function separately
                _triggerCondition: data.triggerCondition
            };
            if (debug) {
                logger(`[CardRegistry] Registered trap: ${key}`);
            }
        },
        
        /**
         * Register an aura/equipment card
         * @param {string} key - Unique identifier
         * @param {Object} data - Card data
         */
        registerAura(key, data) {
            auras[key] = { ...data, key, type: 'aura' };
            if (debug) {
                logger(`[CardRegistry] Registered aura: ${key}`);
            }
        },
        
        /**
         * Register a pyre card
         * @param {string} key - Unique identifier
         * @param {Object} data - Card data
         */
        registerPyre(key, data) {
            pyres[key] = { ...data, key, type: 'pyre', cost: 0 };
            if (debug) {
                logger(`[CardRegistry] Registered pyre: ${key}`);
            }
        },
        
        // ==================== LOOKUP ====================
        
        /**
         * Get a cryptid by key (returns a clone)
         * @param {string} key - Card key
         * @returns {Object|null} Card clone or null
         */
        getCryptid(key) {
            const template = cryptids[key];
            if (!template) return null;
            const clone = cloneCard(template);
            clone.id = generateId(key);
            clone.currentHp = clone.hp;
            clone.maxHp = clone.hp;
            clone.currentAtk = clone.atk;
            clone.baseAtk = clone.atk;
            return clone;
        },
        
        /**
         * Get a burst by key (returns a clone)
         * @param {string} key - Card key
         * @returns {Object|null} Card clone or null
         */
        getBurst(key) {
            const template = bursts[key];
            if (!template) return null;
            const clone = cloneCard(template);
            clone.id = generateId(key);
            return clone;
        },
        
        /**
         * Alias for getBurst
         */
        getInstant(key) {
            return this.getBurst(key);
        },
        
        /**
         * Get a kindling by key (returns a clone)
         * @param {string} key - Card key
         * @returns {Object|null} Card clone or null
         */
        getKindling(key) {
            const template = kindling[key];
            if (!template) return null;
            const clone = cloneCard(template);
            clone.id = generateId(key);
            clone.currentHp = clone.hp;
            clone.maxHp = clone.hp;
            clone.currentAtk = clone.atk;
            clone.baseAtk = clone.atk;
            clone.isKindling = true;
            return clone;
        },
        
        /**
         * Get a trap by key (returns a clone)
         * @param {string} key - Card key
         * @returns {Object|null} Card clone or null
         */
        getTrap(key) {
            const template = traps[key];
            if (!template) return null;
            const clone = cloneCard(template);
            clone.id = generateId(key);
            // Restore the trigger condition function
            if (template._triggerCondition) {
                clone.triggerCondition = template._triggerCondition;
            }
            return clone;
        },
        
        /**
         * Get an aura by key (returns a clone)
         * @param {string} key - Card key
         * @returns {Object|null} Card clone or null
         */
        getAura(key) {
            const template = auras[key];
            if (!template) return null;
            const clone = cloneCard(template);
            clone.id = generateId(key);
            return clone;
        },
        
        /**
         * Get a pyre by key (returns a clone)
         * @param {string} key - Card key
         * @returns {Object|null} Card clone or null
         */
        getPyre(key) {
            const template = pyres[key];
            if (!template) return null;
            const clone = cloneCard(template);
            clone.id = generateId(key);
            return clone;
        },
        
        /**
         * Get any card by key (searches all types)
         * @param {string} key - Card key
         * @returns {Object|null} Card clone or null
         */
        getCard(key) {
            return this.getCryptid(key) 
                || this.getKindling(key)
                || this.getBurst(key) 
                || this.getTrap(key) 
                || this.getAura(key) 
                || this.getPyre(key);
        },
        
        // ==================== ENUMERATION ====================
        
        getAllCryptidKeys() {
            return Object.keys(cryptids);
        },
        
        getAllBurstKeys() {
            return Object.keys(bursts);
        },
        
        getAllInstantKeys() {
            return this.getAllBurstKeys();
        },
        
        getAllKindlingKeys() {
            return Object.keys(kindling);
        },
        
        getAllTrapKeys() {
            return Object.keys(traps);
        },
        
        getAllAuraKeys() {
            return Object.keys(auras);
        },
        
        getAllPyreKeys() {
            return Object.keys(pyres);
        },
        
        /**
         * Get all cards of a specific type
         * @param {string} type - Card type (cryptid, burst, kindling, trap, aura, pyre)
         * @returns {Object[]} Array of card clones
         */
        getAllOfType(type) {
            switch (type) {
                case 'cryptid':
                    return this.getAllCryptidKeys().map(k => this.getCryptid(k));
                case 'burst':
                case 'instant':
                    return this.getAllBurstKeys().map(k => this.getBurst(k));
                case 'kindling':
                    return this.getAllKindlingKeys().map(k => this.getKindling(k));
                case 'trap':
                    return this.getAllTrapKeys().map(k => this.getTrap(k));
                case 'aura':
                    return this.getAllAuraKeys().map(k => this.getAura(k));
                case 'pyre':
                    return this.getAllPyreKeys().map(k => this.getPyre(k));
                default:
                    return [];
            }
        },
        
        // ==================== STATISTICS ====================
        
        /**
         * Get registration statistics
         * @returns {Object} Counts by type
         */
        getStats() {
            return {
                cryptids: Object.keys(cryptids).length,
                bursts: Object.keys(bursts).length,
                kindling: Object.keys(kindling).length,
                traps: Object.keys(traps).length,
                auras: Object.keys(auras).length,
                pyres: Object.keys(pyres).length,
                total: Object.keys(cryptids).length +
                       Object.keys(bursts).length +
                       Object.keys(kindling).length +
                       Object.keys(traps).length +
                       Object.keys(auras).length +
                       Object.keys(pyres).length
            };
        },
        
        // ==================== DECK BUILDING ====================
        
        /**
         * Build a kindling pool from card keys
         * @param {string[]|Object[]} kindlingCards - Array of kindling keys or card objects
         * @returns {Object[]} Array of initialized kindling cards
         */
        buildKindlingPool(kindlingCards = null) {
            const pool = [];
            
            if (kindlingCards && Array.isArray(kindlingCards)) {
                for (const entry of kindlingCards) {
                    const cardKey = typeof entry === 'string' ? entry : (entry.cardKey || entry.key);
                    const card = this.getKindling(cardKey);
                    if (card) {
                        pool.push(card);
                    }
                }
                if (pool.length > 0) {
                    return pool;
                }
            }
            
            // Default: 2 of each kindling type
            const allKindlingKeys = this.getAllKindlingKeys();
            for (const key of allKindlingKeys) {
                pool.push(this.getKindling(key));
                pool.push(this.getKindling(key));
            }
            
            return pool;
        },
        
        /**
         * Build a deck from a list of card entries
         * @param {Object[]} deckEntries - Array of { key, type, count? }
         * @returns {Object[]} Array of initialized cards
         */
        buildDeck(deckEntries) {
            const deck = [];
            
            for (const entry of deckEntries) {
                const count = entry.count || 1;
                for (let i = 0; i < count; i++) {
                    let card = null;
                    
                    switch (entry.type) {
                        case 'cryptid':
                            card = this.getCryptid(entry.key);
                            break;
                        case 'kindling':
                            card = this.getKindling(entry.key);
                            break;
                        case 'burst':
                        case 'instant':
                            card = this.getBurst(entry.key);
                            break;
                        case 'trap':
                            card = this.getTrap(entry.key);
                            break;
                        case 'aura':
                            card = this.getAura(entry.key);
                            break;
                        case 'pyre':
                            card = this.getPyre(entry.key);
                            break;
                        default:
                            card = this.getCard(entry.key);
                    }
                    
                    if (card) {
                        deck.push(card);
                    }
                }
            }
            
            return deck;
        },
        
        /**
         * Shuffle an array (Fisher-Yates)
         * @param {Array} array - Array to shuffle
         * @returns {Array} Shuffled array (mutates original)
         */
        shuffle(array) {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
            return array;
        },
        
        // ==================== VALIDATION ====================
        
        /**
         * Validate a card definition has required fields
         * @param {Object} card - Card to validate
         * @returns {Object} { valid: boolean, errors: string[] }
         */
        validateCard(card) {
            const errors = [];
            
            if (!card.name) errors.push('Card must have a name');
            if (!card.type) errors.push('Card must have a type');
            
            if (card.type === 'cryptid' || card.isKindling) {
                if (typeof card.hp !== 'number') errors.push('Cryptid must have HP');
                if (typeof card.atk !== 'number') errors.push('Cryptid must have ATK');
            }
            
            if (card.effects && Array.isArray(card.effects)) {
                // Could validate each effect here using EffectSchema
            }
            
            return { valid: errors.length === 0, errors };
        },
        
        // ==================== UTILITIES ====================
        
        /**
         * Clear all registered cards (useful for testing)
         */
        clear() {
            for (const key of Object.keys(cryptids)) delete cryptids[key];
            for (const key of Object.keys(bursts)) delete bursts[key];
            for (const key of Object.keys(kindling)) delete kindling[key];
            for (const key of Object.keys(traps)) delete traps[key];
            for (const key of Object.keys(auras)) delete auras[key];
            for (const key of Object.keys(pyres)) delete pyres[key];
            nextId = 1;
        },
        
        /**
         * Reset ID counter (useful between games)
         */
        resetIds() {
            nextId = 1;
        },
        
        /**
         * Export all card data (for debugging/serialization)
         * @returns {Object} All registered cards
         */
        exportAll() {
            return {
                cryptids: { ...cryptids },
                bursts: { ...bursts },
                kindling: { ...kindling },
                traps: { ...traps },
                auras: { ...auras },
                pyres: { ...pyres },
            };
        },
        
        /**
         * Import card data (bulk registration)
         * @param {Object} data - Exported card data
         */
        importAll(data) {
            if (data.cryptids) {
                for (const [key, card] of Object.entries(data.cryptids)) {
                    this.registerCryptid(key, card);
                }
            }
            if (data.bursts) {
                for (const [key, card] of Object.entries(data.bursts)) {
                    this.registerBurst(key, card);
                }
            }
            if (data.kindling) {
                for (const [key, card] of Object.entries(data.kindling)) {
                    this.registerKindling(key, card);
                }
            }
            if (data.traps) {
                for (const [key, card] of Object.entries(data.traps)) {
                    this.registerTrap(key, card);
                }
            }
            if (data.auras) {
                for (const [key, card] of Object.entries(data.auras)) {
                    this.registerAura(key, card);
                }
            }
            if (data.pyres) {
                for (const [key, card] of Object.entries(data.pyres)) {
                    this.registerPyre(key, card);
                }
            }
        }
    };
    
    return registry;
}

// ==================== EXPORTS ====================

// CommonJS export (for Node.js / Cloudflare Worker)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        createCardRegistry
    };
}

// Browser global export
if (typeof window !== 'undefined') {
    window.SharedCardRegistry = {
        createCardRegistry
    };
}
