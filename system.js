/**
 * Cryptid Fates - Game System
 * Core game logic, event system, and UI handling
 */

// ==================== EVENT SYSTEM ====================
const GameEvents = {
    listeners: {},
    
    on(event, callback, context = null) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        const listener = { callback, context };
        this.listeners[event].push(listener);
        return () => {
            const idx = this.listeners[event].indexOf(listener);
            if (idx > -1) this.listeners[event].splice(idx, 1);
        };
    },
    
    once(event, callback) {
        const unsubscribe = this.on(event, (...args) => {
            unsubscribe();
            callback(...args);
        });
    },
    
    emit(event, data = {}) {
        if (!this.listeners[event]) return;
        const eventData = { ...data, eventName: event, timestamp: Date.now() };
        for (const listener of this.listeners[event]) {
            try {
                if (listener.context) {
                    listener.callback.call(listener.context, eventData);
                } else {
                    listener.callback(eventData);
                }
            } catch (error) {
                console.error(`Error in event listener for ${event}:`, error);
            }
        }
    },
    
    off(event = null) {
        if (event) {
            delete this.listeners[event];
        } else {
            this.listeners = {};
        }
    },
    
    listenerCount(event) {
        return this.listeners[event]?.length || 0;
    }
};

window.GameEvents = GameEvents;

// ==================== AUTO-SCALE TEXT UTILITY ====================
// Shrinks text to fit within its container
function autoScaleAbilityText(container) {
    if (!container) return;
    
    const boxes = container.querySelectorAll('.gc-ability-box');
    const card = container.closest('.game-card');
    if (!card) return;
    
    const cardWidth = card.offsetWidth || 100;
    
    boxes.forEach(box => {
        const text = box.textContent.trim();
        if (!text) return;
        
        // Reset font size first
        box.style.fontSize = '';
        
        // Get the container width (account for padding)
        const containerWidth = box.offsetWidth - 4;
        if (containerWidth <= 0) return;
        
        // Start with the default font size (5.5% of card width)
        const maxFontSize = cardWidth * 0.055;
        const minFontSize = cardWidth * 0.028; // Minimum readable size
        
        let fontSize = maxFontSize;
        box.style.fontSize = fontSize + 'px';
        
        // Measure and shrink until it fits
        let iterations = 0;
        while (box.scrollWidth > box.offsetWidth && fontSize > minFontSize && iterations < 20) {
            fontSize -= 0.5;
            box.style.fontSize = fontSize + 'px';
            iterations++;
        }
    });
}

// Call after DOM updates to scale ability text on all visible cards
function scaleAllAbilityText() {
    requestAnimationFrame(() => {
        document.querySelectorAll('.game-card .gc-abilities').forEach(abilities => {
            autoScaleAbilityText(abilities);
        });
    });
}

// ==================== CARD FAN ARC LAYOUT ====================
// Creates Slay the Spire style card fan

function applyCardFanLayout() {
    // With horizontal scroll layout, cards are flex items
    // Just need to update the card count display
    updateHandIndicators();
}

function setupFanHoverEffects() {
    // Setup horizontal wheel scrolling for the hand container
    const handContainer = document.getElementById('hand-container');
    if (handContainer) {
        // Convert vertical wheel to horizontal scroll
        handContainer.addEventListener('wheel', (e) => {
            // Only handle if there's horizontal overflow
            if (handContainer.scrollWidth > handContainer.clientWidth) {
                e.preventDefault();
                // Use deltaY for vertical scroll wheel, deltaX for horizontal (trackpad)
                const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
                handContainer.scrollLeft += delta;
            }
        }, { passive: false });
        
        // Optional: drag to scroll on desktop (click and drag on empty space)
        let isScrollDragging = false;
        let scrollStartX = 0;
        let scrollLeft = 0;
        
        handContainer.addEventListener('mousedown', (e) => {
            // Only start scroll drag if clicking on the container itself, not on cards
            if (e.target === handContainer || e.target.classList.contains('hand-scroll-wrapper')) {
                isScrollDragging = true;
                handContainer.style.cursor = 'grabbing';
                scrollStartX = e.pageX - handContainer.offsetLeft;
                scrollLeft = handContainer.scrollLeft;
            }
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isScrollDragging) return;
            e.preventDefault();
            const x = e.pageX - handContainer.offsetLeft;
            const walk = (x - scrollStartX) * 1.5; // Scroll speed multiplier
            handContainer.scrollLeft = scrollLeft - walk;
        });
        
        document.addEventListener('mouseup', () => {
            if (isScrollDragging) {
                isScrollDragging = false;
                handContainer.style.cursor = '';
            }
        });
    }
}

let fanHoverInitialized = false;
function ensureFanHoverEffects() {
    if (!fanHoverInitialized) {
        setupFanHoverEffects();
        fanHoverInitialized = true;
    }
}

// ==================== PHASE TIMELINE ====================
function updatePhaseTimeline(currentPhase) {
    const phases = ['draw', 'conjure1', 'combat', 'conjure2', 'end'];
    const nodes = document.querySelectorAll('.phase-timeline .phase-node');
    const connectors = document.querySelectorAll('.phase-timeline .phase-connector');
    
    const currentIndex = phases.indexOf(currentPhase);
    
    nodes.forEach((node, i) => {
        node.classList.remove('active', 'completed');
        if (i < currentIndex) {
            node.classList.add('completed');
        } else if (i === currentIndex) {
            node.classList.add('active');
        }
    });
    
    connectors.forEach((conn, i) => {
        conn.classList.remove('completed');
        if (i < currentIndex) {
            conn.classList.add('completed');
        }
    });
}

// ==================== ADVANCE PHASE BUTTON ====================
function setupAdvancePhaseButton() {
    const btn = document.getElementById('advance-phase-btn');
    if (!btn) return;
    
    btn.addEventListener('click', () => {
        // Determine what action to take based on current phase
        const conjure1Btn = document.getElementById('end-conjure1-btn');
        const combatBtn = document.getElementById('end-combat-btn');
        const endTurnBtn = document.getElementById('end-turn-btn');
        
        // Try phase transitions in order
        if (conjure1Btn && !conjure1Btn.disabled) {
            conjure1Btn.click();
        } else if (combatBtn && !combatBtn.disabled) {
            combatBtn.click();
        } else if (endTurnBtn && !endTurnBtn.disabled) {
            endTurnBtn.click();
        }
    });
    
    // Recalculate fan on resize
    window.addEventListener('resize', debounce(() => {
        applyCardFanLayout();
    }, 100));
}

// Simple debounce helper
function debounce(fn, delay) {
    let timer;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

// ==================== DETAILED MATCH LOG SYSTEM ====================
// For debugging and verifying card mechanics work correctly
const MatchLog = {
    entries: [],
    turnNumber: 0,
    currentOwner: null,
    gameStartTime: null,
    isEnabled: true, // Set to false to disable logging
    
    init() {
        this.entries = [];
        this.turnNumber = 0;
        this.currentOwner = null;
        this.gameStartTime = Date.now();
        this.log('SYSTEM', 'Match started');
    },
    
    /**
     * Add a detailed log entry
     */
    log(category, action, details = {}) {
        if (!this.isEnabled) return;
        
        const timestamp = Date.now() - (this.gameStartTime || Date.now());
        const entry = {
            timestamp,
            turn: this.turnNumber,
            owner: this.currentOwner,
            category,
            action,
            details,
            formatted: this.formatEntry(category, action, details)
        };
        
        this.entries.push(entry);
        
        // Also log to console in debug mode
        if (window.DEBUG_MATCH_LOG) {
            console.log(`[MatchLog T${this.turnNumber}] ${entry.formatted}`);
        }
    },
    
    /**
     * Format entry for display
     */
    formatEntry(category, action, details) {
        const d = details;
        let text = '';
        
        // Helper to safely get values with fallback
        const safe = (val, fallback = '?') => (val !== undefined && val !== null) ? val : fallback;
        
        switch (category) {
            case 'TURN':
                text = `═══ TURN ${this.turnNumber} - ${action.toUpperCase()} ═══`;
                break;
                
            case 'SUMMON':
                text = `SUMMON: ${safe(d.cardName)} → ${d.position || 'field'}`;
                if (d.col !== undefined) text += ` [col=${d.col}, row=${d.row}]`;
                if (d.cost !== undefined) text += ` | Cost: ${d.cost} Pyre`;
                if (d.stats) text += ` | Stats: ${safe(d.stats.atk, 0)}/${safe(d.stats.hp, 0)}`;
                if (d.isKindling) text += ' (Kindling)';
                if (d.isSupport) text += ' [SUPPORT]';
                if (d.isCombat) text += ' [COMBAT]';
                break;
                
            case 'ATTACK':
                text = `ATTACK: ${safe(d.attackerName)} → ${safe(d.defenderName || d.targetName)}`;
                if (d.attackerStats) {
                    text += ` | Attacker: ${safe(d.attackerStats.atk, 0)}/${safe(d.attackerStats.hp, 0)}`;
                }
                if (d.attackerCol !== undefined) text += ` [col=${d.attackerCol}, row=${d.attackerRow}]`;
                if (d.defenderStats || d.targetStats) {
                    const stats = d.defenderStats || d.targetStats;
                    text += ` | Defender: ${safe(stats.hp, '?')} HP`;
                }
                if (d.defenderCol !== undefined) text += ` [col=${d.defenderCol}, row=${d.defenderRow}]`;
                if (d.damageDealt !== undefined) text += ` | Damage: ${d.damageDealt}`;
                if (d.overkill) text += ` (${d.overkill} overkill)`;
                if (d.defenderDied) text += ' → KILLED';
                if (d.attackerTapped) text += ' | Attacker tapped';
                break;
                
            case 'DAMAGE':
                const dmgAmount = d.amount !== undefined ? d.amount : d.damage;
                text = `DAMAGE: ${safe(d.targetName)} takes ${safe(dmgAmount)} damage`;
                if (d.col !== undefined) text += ` [col=${d.col}, row=${d.row}]`;
                if (d.hpBefore !== undefined || d.hpAfter !== undefined) {
                    text += ` | HP: ${safe(d.hpBefore)} → ${safe(d.hpAfter)}`;
                }
                if (d.source) text += ` | Source: ${d.source}`;
                if (d.died) text += ' → DIED';
                break;
                
            case 'HEAL':
                text = `HEAL: ${safe(d.targetName)} healed for ${safe(d.amount)}`;
                if (d.hpBefore !== undefined || d.hpAfter !== undefined) {
                    text += ` | HP: ${safe(d.hpBefore)} → ${safe(d.hpAfter)}`;
                }
                if (d.source) text += ` | Source: ${d.source}`;
                break;
                
            case 'DEATH':
                text = `DEATH: ${safe(d.cardName || d.victimName)} died`;
                if (d.col !== undefined) text += ` [col=${d.col}, row=${d.row}]`;
                else if (d.victimCol !== undefined) text += ` [col=${d.victimCol}, row=${d.victimRow}]`;
                if (d.killedBy || d.killerName) text += ` | Killed by: ${d.killedBy || d.killerName}`;
                if (d.evolved) text += ' → Evolved instead';
                break;
                
            case 'EVOLVE':
                text = `EVOLVE: ${safe(d.baseName)} → ${safe(d.evolvedName)}`;
                if (d.col !== undefined) text += ` [col=${d.col}, row=${d.row}]`;
                if (d.oldStats || d.newStats) {
                    const oldAtk = d.oldStats?.atk ?? '?';
                    const oldHp = d.oldStats?.hp ?? '?';
                    const newAtk = d.newStats?.atk ?? '?';
                    const newHp = d.newStats?.hp ?? '?';
                    text += ` | Stats: ${oldAtk}/${oldHp} → ${newAtk}/${newHp}`;
                }
                break;
                
            case 'ABILITY':
                text = `ABILITY: ${safe(d.cardName)}`;
                if (d.abilityName) text += ` - ${d.abilityName}`;
                if (d.col !== undefined) text += ` [col=${d.col}, row=${d.row}]`;
                if (d.target) text += ` | Target: ${d.target}`;
                if (d.effect) text += ` | Effect: ${d.effect}`;
                break;
                
            case 'CALLBACK':
                // For card callbacks (onSupport, onCombat, etc.)
                text = `CALLBACK: ${safe(d.callbackType || action)}`;
                if (d.cardName) text += ` | ${d.cardName}`;
                if (d.col !== undefined) text += ` [col=${d.col}, row=${d.row}]`;
                if (d.reason) text += ` | Reason: ${d.reason}`;
                if (d.combatant) text += ` | Combatant: ${d.combatant}`;
                if (d.target) text += ` | Target: ${d.target}`;
                if (d.victim) text += ` | Victim: ${d.victim}`;
                if (d.attacker) text += ` | Attacker: ${d.attacker}`;
                if (d.damage !== undefined) text += ` | Damage: ${d.damage}`;
                if (d.isKindling) text += ' (Kindling)';
                break;
                
            case 'ACTIVATED':
                // For player-activated abilities
                text = `ACTIVATED: ${safe(action)}`;
                if (d.cardName) text += ` | ${d.cardName}`;
                if (d.col !== undefined) text += ` [col=${d.col}, row=${d.row}]`;
                if (d.target) text += ` | Target: ${d.target}`;
                if (d.targetRow !== undefined) text += ` | TargetRow: ${d.targetRow}`;
                if (d.swapTarget) text += ` | SwapTarget: ${d.swapTarget}`;
                if (d.willKill) text += ' (Will Kill)';
                break;
                
            case 'BUFF':
                text = `BUFF: ${safe(d.targetName)} received ${safe(d.buffType)}`;
                if (d.amount) text += ` +${d.amount}`;
                if (d.source) text += ` | From: ${d.source}`;
                if (d.newStats) text += ` | New stats: ${d.newStats.atk}/${d.newStats.hp}`;
                break;
                
            case 'DEBUFF':
                text = `DEBUFF: ${safe(d.targetName)} received ${safe(d.debuffType)}`;
                if (d.amount) text += ` -${d.amount}`;
                if (d.source) text += ` | From: ${d.source}`;
                break;
                
            case 'STATUS':
                text = `STATUS: ${safe(d.targetName)} - ${safe(d.status)}`;
                if (d.duration) text += ` (${d.duration} turns)`;
                if (d.stacks) text += ` (${d.stacks} stacks)`;
                if (d.removed) text += ' REMOVED';
                break;
                
            case 'SPELL':
                text = `SPELL: ${safe(d.cardName)} cast`;
                if (d.cost !== undefined) text += ` | Cost: ${d.cost} Pyre`;
                if (d.target || d.targetName) text += ` | Target: ${d.target || d.targetName}`;
                if (d.effect) text += ` | Effect: ${d.effect}`;
                break;
                
            case 'TRAP':
                text = `TRAP: ${safe(d.trapName)}`;
                if (action === 'Trap Set') text += ` placed [row=${d.row}]`;
                if (action === 'Trap Triggered') text += ` TRIGGERED`;
                if (d.effect) text += ` | Effect: ${d.effect}`;
                break;
                
            case 'AURA':
                text = `AURA: ${safe(d.auraName)}`;
                if (action === 'Aura Applied') text += ` attached to ${safe(d.targetName)}`;
                else if (action === 'Aura Removed') text += ` removed from ${safe(d.targetName)}`;
                if (d.targetCol !== undefined) text += ` [col=${d.targetCol}, row=${d.targetRow}]`;
                if (d.effect) text += ` | Effect: ${d.effect}`;
                break;
                
            case 'PYRE':
                // Handle different pyre actions
                text = `PYRE: ${safe(d.owner, 'player')}`;
                if (d.cardName) text += ` - ${d.cardName}`;
                if (action === 'Gained' && d.amount !== undefined) text += ` | +${d.amount} Pyre`;
                else if (action === 'Spent' && d.amount !== undefined) text += ` | -${d.amount} Pyre`;
                else if (d.amount !== undefined) text += ` | ${d.amount > 0 ? '+' : ''}${d.amount} Pyre`;
                if (d.newValue !== undefined) text += ` (Total: ${d.newValue})`;
                if (d.source) text += ` | Source: ${d.source}`;
                break;
                
            case 'DRAW':
                text = `DRAW: ${safe(d.owner, 'player')} drew ${d.count || 1} card(s)`;
                if (d.handSize !== undefined) text += ` | Hand: ${d.handSize}`;
                break;
                
            case 'PROMOTE':
                text = `PROMOTE: ${safe(d.cardName)} moved to Combat`;
                if (d.row !== undefined) text += ` [row=${d.row}]`;
                if (d.fromSupport) text += ' (from Support)';
                break;
                
            case 'SUPPORT':
                text = `SUPPORT EFFECT: ${safe(d.supportName)} → ${safe(d.targetName)}`;
                if (d.effect) text += ` | ${d.effect}`;
                if (d.supportCol !== undefined) text += ` [Support col=${d.supportCol}, row=${d.row}]`;
                break;
                
            case 'GAME_STATE':
                text = `STATE: ${action}`;
                if (d.playerPyre !== undefined) text += ` | Player Pyre: ${d.playerPyre}`;
                if (d.enemyPyre !== undefined) text += ` | Enemy Pyre: ${d.enemyPyre}`;
                if (d.playerField) text += ` | Player Field: ${d.playerField}`;
                if (d.enemyField) text += ` | Enemy Field: ${d.enemyField}`;
                break;
                
            default:
                text = `${category}: ${action}`;
                if (Object.keys(details).length > 0) {
                    text += ' | ' + JSON.stringify(details);
                }
        }
        
        return text;
    },
    
    /**
     * Log turn start
     */
    logTurnStart(owner) {
        this.turnNumber++;
        this.currentOwner = owner;
        this.log('TURN', owner === 'player' ? 'Player Turn' : 'Enemy Turn', { owner });
    },
    
    /**
     * Log turn end
     */
    logTurnEnd(owner) {
        this.log('TURN', 'End', { owner });
    },
    
    /**
     * Get full log as formatted text
     */
    getFullLog() {
        let output = '════════════════════════════════════════════════════════════\n';
        output += '                    CRYPTID FATES - MATCH LOG\n';
        output += `                    ${new Date(this.gameStartTime).toLocaleString()}\n`;
        output += '════════════════════════════════════════════════════════════\n\n';
        
        let lastTurn = -1;
        for (const entry of this.entries) {
            if (entry.turn !== lastTurn && entry.category === 'TURN') {
                output += '\n';
                lastTurn = entry.turn;
            }
            
            const time = `[${(entry.timestamp / 1000).toFixed(1)}s]`;
            const owner = entry.owner ? `[${entry.owner.toUpperCase()}]` : '';
            output += `${time} ${owner} ${entry.formatted}\n`;
        }
        
        output += '\n════════════════════════════════════════════════════════════\n';
        output += `                    END OF LOG - ${this.entries.length} entries\n`;
        output += '════════════════════════════════════════════════════════════\n';
        
        return output;
    },
    
    /**
     * Get log entries for display
     */
    getEntries() {
        return this.entries;
    },
    
    /**
     * Copy log to clipboard
     */
    async copyToClipboard() {
        const log = this.getFullLog();
        try {
            await navigator.clipboard.writeText(log);
            showMessage('Match log copied to clipboard!', 2000);
            return true;
        } catch (err) {
            console.error('Failed to copy log:', err);
            // Fallback - create textarea and copy
            const ta = document.createElement('textarea');
            ta.value = log;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            showMessage('Match log copied to clipboard!', 2000);
            return true;
        }
    },
    
    /**
     * Subscribe to all game events for logging
     */
    subscribeToEvents() {
        // Turn events
        GameEvents.on('onTurnStart', (data) => {
            this.logTurnStart(data.owner);
            this.log('GAME_STATE', 'Turn Start State', {
                playerPyre: window.game?.playerPyre,
                enemyPyre: window.game?.enemyPyre
            });
        });
        
        GameEvents.on('onTurnEnd', (data) => {
            this.logTurnEnd(data.owner);
        });
        
        // Summon events
        GameEvents.on('onSummon', (data) => {
            const cryptid = data.cryptid;
            this.log('SUMMON', cryptid?.name || 'Unknown', {
                cardName: cryptid?.name,
                col: data.col,
                row: data.row,
                stats: { atk: cryptid?.currentAtk || cryptid?.atk, hp: cryptid?.currentHp || cryptid?.hp },
                isKindling: data.isKindling,
                isSupport: data.isSupport
            });
        });
        
        // Attack events (use onAttackDeclared for when attack starts)
        GameEvents.on('onAttackDeclared', (data) => {
            this.log('ATTACK', 'Attack Declared', {
                attackerName: data.attacker?.name,
                attackerCol: data.attacker?.col,
                attackerRow: data.attacker?.row,
                attackerStats: { atk: data.attacker?.currentAtk, hp: data.attacker?.currentHp },
                defenderName: data.target?.name,
                defenderCol: data.target?.col,
                defenderRow: data.target?.row,
                defenderStats: { hp: data.target?.currentHp }
            });
        });
        
        // Hit/Damage events
        GameEvents.on('onHit', (data) => {
            this.log('DAMAGE', 'Hit Connected', {
                attackerName: data.attacker?.name,
                targetName: data.target?.name,
                damage: data.damage,
                hpBefore: data.hpBefore,
                hpAfter: data.hpAfter
            });
        });
        
        GameEvents.on('onDamageTaken', (data) => {
            this.log('DAMAGE', 'Damage Taken', {
                targetName: data.target?.name,
                col: data.target?.col,
                row: data.target?.row,
                damage: data.damage,
                hpBefore: data.hpBefore,
                hpAfter: data.hpAfter,
                source: data.source?.name || data.sourceType
            });
        });
        
        // Kill events
        GameEvents.on('onKill', (data) => {
            this.log('DEATH', 'Kill', {
                killerName: data.killer?.name,
                victimName: data.victim?.name,
                victimCol: data.victim?.col,
                victimRow: data.victim?.row,
                killerOwner: data.killerOwner,
                victimOwner: data.victimOwner
            });
        });
        
        // Heal events
        GameEvents.on('onHeal', (data) => {
            const target = data.cryptid || data.target;
            this.log('HEAL', 'Healed', {
                targetName: target?.name,
                amount: data.amount,
                source: data.source?.name || data.sourceType || data.source
            });
        });
        
        // Death events
        GameEvents.on('onDeath', (data) => {
            this.log('DEATH', 'Death', {
                cardName: data.cryptid?.name,
                col: data.col,
                row: data.row,
                owner: data.owner,
                killerOwner: data.killerOwner
            });
        });
        
        // Evolution events (correct event name is onEvolution)
        GameEvents.on('onEvolution', (data) => {
            // Handle both event formats: {cryptid, previous} and {baseCryptid, evolved}
            const evolved = data.evolved || data.cryptid;
            const base = data.baseCryptid || data.previous;
            this.log('EVOLVE', 'Evolution', {
                baseName: base?.name,
                evolvedName: evolved?.name,
                col: data.col,
                row: data.row,
                owner: data.owner,
                oldStats: base ? { atk: base.currentAtk || base.atk, hp: base.currentHp || base.hp } : undefined,
                newStats: evolved ? { atk: evolved.currentAtk || evolved.atk, hp: evolved.currentHp || evolved.hp } : undefined
            });
        });
        
        // Spell/Burst events
        GameEvents.on('onSpellCast', (data) => {
            this.log('SPELL', 'Spell Cast', {
                cardName: data.card?.name,
                caster: data.caster,
                targetName: data.target?.name,
                targetOwner: data.targetOwner
            });
        });
        
        GameEvents.on('onBurstPlayed', (data) => {
            this.log('SPELL', 'Burst Played', {
                cardName: data.card?.name,
                owner: data.owner,
                targetName: data.target?.name,
                targetOwner: data.targetOwner,
                targetCol: data.targetCol,
                targetRow: data.targetRow
            });
        });
        
        // Trap events (correct event name is onTrapSet)
        GameEvents.on('onTrapSet', (data) => {
            this.log('TRAP', 'Trap Set', {
                trapName: data.trap?.name || data.trap?.key,
                owner: data.owner,
                row: data.row
            });
        });
        
        GameEvents.on('onTrapTriggered', (data) => {
            this.log('TRAP', 'Trap Triggered', {
                trapName: data.trap?.name || data.trap?.key,
                owner: data.owner,
                row: data.row
            });
        });
        
        // Aura events (correct event name is onAuraApplied)
        GameEvents.on('onAuraApplied', (data) => {
            this.log('AURA', 'Aura Applied', {
                auraName: data.aura?.name,
                targetName: data.cryptid?.name,
                targetCol: data.cryptid?.col,
                targetRow: data.cryptid?.row,
                owner: data.owner
            });
        });
        
        GameEvents.on('onAuraRemoved', (data) => {
            this.log('AURA', 'Aura Removed', {
                auraName: data.aura?.name,
                targetName: data.cryptid?.name,
                owner: data.owner
            });
        });
        
        // Pyre events
        GameEvents.on('onPyreGained', (data) => {
            this.log('PYRE', 'Gained', {
                amount: data.amount,
                oldValue: data.oldValue,
                newValue: data.newValue,
                source: data.source,
                owner: data.owner
            });
        });
        
        GameEvents.on('onPyreSpent', (data) => {
            this.log('PYRE', 'Spent', {
                amount: data.amount,
                oldValue: data.oldValue,
                newValue: data.newValue,
                source: data.source,
                cardName: data.card?.name,
                owner: data.owner
            });
        });
        
        GameEvents.on('onPyreCardPlayed', (data) => {
            this.log('PYRE', 'Pyre Card Played', {
                cardName: data.card?.name,
                pyreGained: data.pyreGained,
                owner: data.owner
            });
        });
        
        // Draw events
        GameEvents.on('onCardDrawn', (data) => {
            this.log('DRAW', 'Card Drawn', {
                owner: data.owner,
                handSize: data.handSize,
                deckSize: data.deckSize,
                source: data.source
            });
        });
        
        // Promotion events (correct event name is onPromotion)
        GameEvents.on('onPromotion', (data) => {
            this.log('PROMOTE', 'Promoted to Combat', {
                cardName: data.cryptid?.name,
                owner: data.owner,
                row: data.row,
                fromCol: data.fromCol,
                toCol: data.toCol
            });
        });
        
        GameEvents.on('onEnterCombat', (data) => {
            // Only log if explicitly entering (not during summon which is already logged)
            if (data.source === 'promotion') {
                this.log('PROMOTE', 'Promoted to Combat', {
                    cardName: data.cryptid?.name,
                    owner: data.owner,
                    row: data.row
                });
            }
        });
        
        // Status effects
        GameEvents.on('onStatusApplied', (data) => {
            let statusInfo = data.status;
            // Add extra info for specific statuses
            if (data.count) statusInfo += ` (${data.count} counters)`;
            if (data.tokens) statusInfo += ` (${data.tokens} tokens)`;
            if (data.charges) statusInfo += ` (${data.charges} charges)`;
            if (data.refreshed) statusInfo += ' [refreshed]';
            
            this.log('STATUS', 'Status Applied', {
                targetName: data.cryptid?.name,
                status: statusInfo,
                col: data.cryptid?.col,
                row: data.cryptid?.row,
                owner: data.owner
            });
        });
        
        GameEvents.on('onStatusWearOff', (data) => {
            this.log('STATUS', 'Status Removed', {
                targetName: data.cryptid?.name,
                status: data.status
            });
        });
        
        // Burn damage
        GameEvents.on('onBurnDamage', (data) => {
            this.log('DAMAGE', 'Burn Damage', {
                targetName: data.cryptid?.name,
                amount: data.damage,
                col: data.cryptid?.col,
                row: data.cryptid?.row,
                source: `Burn (${data.turnsRemaining} turns left)`,
                owner: data.owner
            });
        });
        
        // Bleed damage
        GameEvents.on('onBleedDamage', (data) => {
            this.log('DAMAGE', 'Bleed Damage', {
                targetName: data.target?.name,
                amount: data.damage || 1,
                col: data.target?.col,
                row: data.target?.row,
                source: `Bleed from ${data.attacker?.name || 'unknown'}`,
                owner: data.owner
            });
        });
        
        // Calamity
        GameEvents.on('onCalamityTick', (data) => {
            this.log('STATUS', 'Calamity Tick', {
                targetName: data.cryptid?.name,
                countersRemaining: data.countersRemaining,
                owner: data.owner
            });
        });
        
        GameEvents.on('onCalamityDeath', (data) => {
            this.log('DEATH', 'Calamity Death', {
                cardName: data.cryptid?.name,
                col: data.cryptid?.col,
                row: data.cryptid?.row,
                killedBy: 'Calamity (doom timer)',
                owner: data.owner
            });
        });
        
        // Protection
        GameEvents.on('onProtectionBlock', (data) => {
            this.log('ABILITY', 'Protection Blocked', {
                cardName: data.target?.name,
                abilityName: 'Protection',
                col: data.target?.col,
                row: data.target?.row,
                effect: `Blocked attack from ${data.attacker?.name || 'attacker'}`,
                owner: data.owner
            });
        });
        
        // Damage reduction
        GameEvents.on('onDamageReduced', (data) => {
            this.log('ABILITY', 'Damage Reduced', {
                cardName: data.target?.name,
                abilityName: data.source || 'Damage Reduction',
                col: data.target?.col,
                row: data.target?.row,
                effect: `${data.originalDamage} → ${data.reducedTo} damage`,
                owner: data.target?.owner
            });
        });
        
        // Terrify (from trap)
        GameEvents.on('onTerrify', (data) => {
            this.log('TRAP', 'Terrify Triggered', {
                trapName: data.trap?.name,
                targetName: data.attacker?.name,
                effect: 'ATK reduced to 0',
                owner: data.owner
            });
        });
        
        // Latch
        GameEvents.on('onLatch', (data) => {
            this.log('ABILITY', 'Latch Applied', {
                attackerName: data.attacker?.name,
                targetName: data.target?.name,
                attackerOwner: data.attackerOwner,
                targetOwner: data.targetOwner
            });
        });
        
        // Cleave damage
        GameEvents.on('onCleaveDamage', (data) => {
            this.log('ABILITY', 'Cleave Damage', {
                attackerName: data.attacker?.name,
                targetName: data.target?.name,
                damage: data.damage
            });
        });
        
        // Destroyer damage
        GameEvents.on('onDestroyerDamage', (data) => {
            this.log('ABILITY', 'Destroyer Damage', {
                sourceName: data.source?.name,
                targetName: data.target?.name,
                damage: data.damage,
                sourceOwner: data.sourceOwner,
                targetOwner: data.targetOwner
            });
        });
        
        // Multi-attack
        GameEvents.on('onMultiAttackDamage', (data) => {
            this.log('ABILITY', 'Multi-Attack Damage', {
                attackerName: data.attacker?.name,
                targetName: data.target?.name,
                damage: data.damage
            });
        });
        
        // Cleanse
        GameEvents.on('onCleanse', (data) => {
            this.log('ABILITY', 'Cleanse', {
                targetName: data.cryptid?.name,
                statusesRemoved: data.count,
                owner: data.owner
            });
        });
        
        // Snipe
        GameEvents.on('onSnipeReveal', (data) => {
            this.log('ABILITY', 'Snipe Revealed', {
                cardName: data.cryptid?.name,
                abilityName: 'Snipe',
                col: data.cryptid?.col,
                row: data.cryptid?.row,
                owner: data.owner
            });
        });
        
        GameEvents.on('onSnipeDamage', (data) => {
            this.log('DAMAGE', 'Snipe Damage', {
                targetName: data.target?.name,
                amount: data.damage,
                col: data.target?.col,
                row: data.target?.row,
                source: `Snipe from ${data.source?.name || 'unknown'}`
            });
        });
        
        // Pyre Burn
        GameEvents.on('onPyreBurn', (data) => {
            this.log('ABILITY', 'Pyre Burn', {
                cardName: 'Pyre Burn',
                abilityName: 'Pyre Burn',
                effect: `Gained ${data.pyreGained} Pyre, drew ${data.cardsDrawn} cards`,
                owner: data.owner
            });
        });
        
        // Tap/Untap events
        GameEvents.on('onTap', (data) => {
            this.log('STATUS', 'Tapped', {
                targetName: data.cryptid?.name,
                status: data.reason ? `Tapped (${data.reason})` : 'Tapped',
                col: data.cryptid?.col,
                row: data.cryptid?.row,
                owner: data.owner
            });
        });
        
        GameEvents.on('onUntap', (data) => {
            this.log('STATUS', 'Untapped', {
                targetName: data.cryptid?.name,
                status: data.reason ? `Untapped (${data.reason})` : 'Untapped',
                col: data.cryptid?.col,
                row: data.cryptid?.row,
                owner: data.owner,
                removed: true
            });
        });
        
        // Targeted (for spells/attacks) - usually logged through other events, so skip to avoid duplication
        // GameEvents.on('onTargeted', (data) => { ... });
        
        // Card callbacks (ability triggers)
        GameEvents.on('onCardCallback', (data) => {
            const card = data.card;
            const owner = data.owner;
            const type = data.type;
            const col = data.col;
            const row = data.row;
            const reason = data.reason || '';
            const combatant = data.combatant;
            
            let details = {
                cardName: card?.name,
                owner: owner,
                col: col,
                row: row,
                callbackType: type
            };
            
            if (reason) details.reason = reason;
            if (combatant) details.combatant = combatant?.name;
            if (data.target) details.target = data.target?.name;
            if (data.isKindling) details.isKindling = true;
            
            // Create descriptive text based on callback type
            let description = '';
            switch(type) {
                case 'onSummon':
                    description = `Summon Callback`;
                    break;
                case 'onSupport':
                    description = reason ? `Support Ability (${reason})` : 'Support Ability Activated';
                    break;
                case 'onCombat':
                    description = reason ? `Combat Ability (${reason})` : 'Combat Ability Activated';
                    break;
                case 'onEnterCombat':
                    description = reason ? `Enter Combat Ability (${reason})` : 'Enter Combat Ability';
                    break;
                case 'onCombatAttack':
                    description = 'Combat Attack Ability';
                    break;
                case 'onCombatantBeforeAttack':
                    description = `Before Attack Ability`;
                    break;
                case 'onCombatantAttacked':
                    description = `Combatant Attacked Ability`;
                    break;
                case 'onCombatantDeath':
                    description = `Combatant Death Ability`;
                    break;
                case 'onCombatantRest':
                    description = `Combatant Rest Ability`;
                    break;
                case 'onTurnStart':
                    description = 'Turn Start Ability';
                    break;
                case 'onTurnStartSupport':
                    description = 'Support Turn Start Ability';
                    break;
                case 'onTurnEnd':
                    description = 'Turn End Ability';
                    break;
                case 'onDeath':
                    description = 'Death Ability';
                    break;
                case 'onKill':
                    description = 'Kill Ability';
                    if (data.victim) details.victim = data.victim?.name;
                    if (data.isMultiAttack) details.isMultiAttack = true;
                    break;
                case 'onEnemySummonedAcross':
                    description = 'Enemy Summoned Across Ability';
                    if (data.triggerCryptid) details.triggerCryptid = data.triggerCryptid?.name;
                    break;
                case 'onBeforeAttack':
                    description = 'Before Attack Ability';
                    if (data.target) details.target = data.target?.name;
                    break;
                case 'onBeforeDefend':
                    description = 'Before Defend Ability';
                    if (data.attacker) details.attacker = data.attacker?.name;
                    break;
                case 'onTakeDamage':
                    description = 'Take Damage Ability';
                    if (data.attacker) details.attacker = data.attacker?.name;
                    if (data.damage !== undefined) details.damage = data.damage;
                    break;
                case 'onApply':
                    description = 'Aura Apply Callback';
                    if (data.target) details.target = data.target?.name;
                    break;
                default:
                    description = type;
            }
            
            this.log('CALLBACK', description, details);
        });
        
        // Activated abilities (player-triggered)
        GameEvents.on('onActivatedAbility', (data) => {
            const card = data.card;
            const ability = data.ability;
            const owner = data.owner;
            
            let details = {
                cardName: card?.name,
                owner: owner,
                ability: ability,
                col: data.col,
                row: data.row
            };
            
            if (data.target) details.target = data.target?.name;
            if (data.targetRow !== undefined) details.targetRow = data.targetRow;
            if (data.swapTarget) details.swapTarget = data.swapTarget?.name;
            if (data.willKill) details.willKill = true;
            
            let description = '';
            switch(ability) {
                case 'bloodPact':
                    description = 'Blood Pact Activated';
                    break;
                case 'sacrifice':
                    description = 'Sacrifice Activated';
                    break;
                case 'thermalSwap':
                    description = 'Thermal Swap Activated';
                    break;
                case 'rageHeal':
                    description = 'Rage Heal Activated';
                    break;
                default:
                    description = `${ability} Activated`;
            }
            
            this.log('ACTIVATED', description, details);
        });
        
        // ==================== CARD-SPECIFIC ABILITY EVENTS ====================
        
        // Skinwalker Mimic
        GameEvents.on('onMimic', (data) => {
            this.log('ABILITY', 'Mimic', {
                cardName: data.cryptid?.name,
                abilityName: 'Mimic',
                col: data.cryptid?.col,
                row: data.cryptid?.row,
                effect: `Copied ${data.copied?.name}'s ATK (now ${data.newAtk})`,
                owner: data.owner
            });
        });
        
        // Stormhawk Lone Hunter
        GameEvents.on('onLoneHunterBonus', (data) => {
            this.log('ABILITY', 'Lone Hunter', {
                cardName: data.cryptid?.name,
                abilityName: 'Lone Hunter',
                col: data.cryptid?.col,
                row: data.cryptid?.row,
                effect: '+1 ATK (only combatant)',
                owner: data.owner
            });
        });
        
        // Stormhawk/Thunderbird Thermal Swap
        GameEvents.on('onThermalSwap', (data) => {
            this.log('ABILITY', 'Thermal Swap', {
                cardName: data.cryptid?.name,
                abilityName: 'Thermal',
                effect: `Swapped with row ${data.targetRow}, both healed 2 HP`,
                owner: data.owner
            });
        });
        
        // Adolescent Bigfoot Rage
        GameEvents.on('onRageStack', (data) => {
            this.log('ABILITY', 'Rage Stack', {
                cardName: data.cryptid?.name,
                abilityName: 'Rage',
                effect: `ATK now ${data.newAtk}`,
                owner: data.cryptid?.owner
            });
        });
        
        GameEvents.on('onRageHeal', (data) => {
            this.log('ABILITY', 'Rage Heal', {
                cardName: data.cryptid?.name,
                abilityName: 'Rage Heal',
                effect: 'Converted ATK stacks to healing',
                owner: data.owner
            });
        });
        
        // Cursed Hybrid Adaptation
        GameEvents.on('onHybridAdaptation', (data) => {
            this.log('ABILITY', 'Hybrid Adaptation', {
                cardName: data.cryptid?.name,
                abilityName: 'Adaptation',
                effect: data.type === 'atk' ? '+1 ATK from fire/death' : '+1 HP from nature/water',
                owner: data.cryptid?.owner
            });
        });
        
        // Deer Woman Grace & Offering
        GameEvents.on('onGraceBuff', (data) => {
            this.log('ABILITY', 'Grace', {
                cardName: 'Deer Woman',
                abilityName: 'Grace',
                target: data.target?.name,
                effect: '+1/+1 to adjacent',
                owner: data.owner
            });
        });
        
        GameEvents.on('onOfferingPyre', (data) => {
            this.log('ABILITY', 'Offering', {
                cardName: data.cryptid?.name,
                abilityName: 'Offering',
                effect: '+1 Pyre when attacked',
                owner: data.owner
            });
        });
        
        // Wendigo abilities
        GameEvents.on('onHungerDamage', (data) => {
            this.log('ABILITY', 'Hunger', {
                cardName: data.cryptid?.name,
                abilityName: 'Hunger',
                effect: 'Dealt 1 damage to self',
                owner: data.owner
            });
        });
        
        GameEvents.on('onWendigoHunger', (data) => {
            this.log('ABILITY', 'Wendigo Hunger', {
                cardName: data.cryptid?.name,
                abilityName: 'Hunger',
                effect: 'Gains +1/+1 each turn',
                owner: data.owner
            });
        });
        
        GameEvents.on('onPrimalWendigoAscension', (data) => {
            this.log('ABILITY', 'Ascension', {
                cardName: data.cryptid?.name,
                abilityName: 'Ascension',
                effect: 'Death prevented, became 1/1',
                owner: data.owner
            });
        });
        
        // Guardian/Bulwark protection
        GameEvents.on('onGuardianProtect', (data) => {
            this.log('ABILITY', 'Guardian', {
                cardName: data.support?.name,
                abilityName: 'Guardian',
                target: data.combatant?.name,
                effect: 'Granted protection to combatant',
                owner: data.owner
            });
        });
        
        GameEvents.on('onBulwarkTrigger', (data) => {
            this.log('ABILITY', 'Bulwark', {
                cardName: data.cryptid?.name,
                abilityName: 'Bulwark',
                effect: 'Damage reduced to 1',
                owner: data.owner
            });
        });
        
        // Primal Wendigo Counter
        GameEvents.on('onPrimalCounter', (data) => {
            this.log('ABILITY', 'Counter', {
                cardName: data.cryptid?.name,
                abilityName: 'Counter',
                target: data.attacker?.name,
                effect: `Counter-killed attacker for ${data.damage} damage`,
                owner: data.owner
            });
        });
        
        // Apex Kill (Primal Wendigo/Lycanthrope)
        GameEvents.on('onApexKill', (data) => {
            this.log('ABILITY', 'Apex Kill', {
                cardName: data.cryptid?.name,
                abilityName: 'Apex',
                target: data.victim?.name,
                effect: 'Kill trigger activated',
                owner: data.owner
            });
        });
        
        // Cannibalize (support sacrifice)
        GameEvents.on('onCannibalizeDamage', (data) => {
            this.log('ABILITY', 'Cannibalize', {
                cardName: data.cryptid?.name,
                abilityName: 'Cannibalize',
                target: data.support?.name,
                effect: `Dealt ${data.damage} damage to support`,
                owner: data.owner
            });
        });
        
        GameEvents.on('onCannibalizeKill', (data) => {
            this.log('ABILITY', 'Cannibalize Kill', {
                cardName: data.cryptid?.name,
                abilityName: 'Cannibalize',
                target: data.support?.name,
                effect: 'Killed and consumed support',
                owner: data.owner
            });
        });
        
        // Thunderbird Storm Call
        GameEvents.on('onStormCallDamage', (data) => {
            this.log('DAMAGE', 'Storm Call', {
                targetName: data.target?.name,
                amount: data.damage,
                col: data.target?.col,
                row: data.target?.row,
                source: `Storm Call from ${data.source?.name}`
            });
        });
        
        // Thunderbird Tailwind
        GameEvents.on('onTailwindBuff', (data) => {
            this.log('ABILITY', 'Tailwind', {
                cardName: data.support?.name,
                abilityName: 'Tailwind',
                target: data.combatant?.name,
                effect: 'Granted Flight and +1/+1',
                owner: data.owner
            });
        });
        
        // Snipe Hide
        GameEvents.on('onHide', (data) => {
            this.log('ABILITY', 'Hide', {
                cardName: data.cryptid?.name,
                abilityName: 'Hide',
                effect: 'Entered hiding (untargetable)',
                owner: data.owner
            });
        });
        
        GameEvents.on('onReHide', (data) => {
            this.log('ABILITY', 'Re-Hide', {
                cardName: data.cryptid?.name,
                abilityName: 'Hide',
                effect: 'Re-entered hiding after kill',
                owner: data.owner
            });
        });
        
        // Snipe Mend
        GameEvents.on('onMendHeal', (data) => {
            this.log('ABILITY', 'Mend', {
                cardName: data.support?.name,
                abilityName: 'Mend',
                target: data.combatant?.name,
                effect: `Healed to ${data.healedTo} HP`,
                owner: data.owner
            });
        });
        
        // Evolution Bonus
        GameEvents.on('onEvolutionBonus', (data) => {
            this.log('ABILITY', 'Evolution Bonus', {
                cardName: data.cryptid?.name,
                abilityName: 'Evolution Bonus',
                effect: `+${data.bonus} ATK from evolutions`,
                owner: data.owner
            });
        });
        
        // Werewolf Blood Frenzy
        GameEvents.on('onBloodFrenzy', (data) => {
            this.log('ABILITY', 'Blood Frenzy', {
                cardName: data.cryptid?.name,
                abilityName: 'Blood Frenzy',
                effect: '+1 ATK (damaged enemy)',
                owner: data.owner
            });
        });
        
        // Razorback Savage/Gore
        GameEvents.on('onSavageBuff', (data) => {
            this.log('ABILITY', 'Savage', {
                cardName: data.support?.name,
                abilityName: 'Savage',
                target: data.combatant?.name,
                effect: '+2 ATK buff',
                owner: data.owner
            });
        });
        
        GameEvents.on('onGoreDamage', (data) => {
            this.log('DAMAGE', 'Gore', {
                targetName: data.target?.name,
                amount: data.damage,
                col: data.target?.col,
                row: data.target?.row,
                source: `Gore from ${data.source?.name}`
            });
        });
        
        // Iron Hide
        GameEvents.on('onIronHide', (data) => {
            this.log('ABILITY', 'Iron Hide', {
                cardName: data.support?.name,
                abilityName: 'Iron Hide',
                target: data.combatant?.name,
                effect: 'Granted damage reduction',
                owner: data.owner
            });
        });
        
        // Not Deer Herd Blessing
        GameEvents.on('onHerdBlessing', (data) => {
            this.log('ABILITY', 'Herd Blessing', {
                cardName: data.cryptid?.name,
                abilityName: 'Herd Blessing',
                effect: `+${data.pyresGained} Pyre from nature cards`,
                owner: data.owner
            });
        });
        
        // Jersey Devil Swoop
        GameEvents.on('onSwoopDamage', (data) => {
            this.log('DAMAGE', 'Swoop', {
                targetName: data.target?.name,
                amount: data.damage,
                col: data.target?.col,
                row: data.target?.row,
                source: `Swoop from ${data.source?.name}`
            });
        });
        
        // Jersey Devil Pyre Steal
        GameEvents.on('onPyreSteal', (data) => {
            this.log('ABILITY', 'Pyre Steal', {
                cardName: data.source?.name,
                abilityName: 'Pyre Steal',
                effect: `Stole 1 Pyre from ${data.stolenFrom}`,
                owner: data.owner
            });
        });
        
        // Baba Yaga Infernal Ward
        GameEvents.on('onInfernalWard', (data) => {
            this.log('ABILITY', 'Infernal Ward', {
                cardName: data.support?.name,
                abilityName: 'Infernal Ward',
                target: data.combatant?.name,
                effect: 'Granted spell immunity',
                owner: data.owner
            });
        });
        
        // Baba Yaga Hex Kill
        GameEvents.on('onHexKill', (data) => {
            this.log('ABILITY', 'Hex', {
                cardName: data.source?.name,
                abilityName: 'Hex',
                target: data.victim?.name,
                effect: 'Killed by curse tokens',
                owner: data.owner
            });
        });
        
        // Crone's Blessing
        GameEvents.on('onCronesBlessing', (data) => {
            this.log('ABILITY', "Crone's Blessing", {
                cardName: data.support?.name,
                abilityName: "Crone's Blessing",
                target: data.combatant?.name,
                effect: '+1 Pyre and heal when targeted',
                owner: data.owner
            });
        });
        
        // Hunt trap steal
        GameEvents.on('onHuntSteal', (data) => {
            this.log('TRAP', 'Hunt Triggered', {
                trapName: 'Hunt',
                effect: `Stole ${data.stolenPyre} Pyre from ${data.from}`,
                owner: data.to
            });
        });
        
        // Full Moon burst
        GameEvents.on('onFullMoonEvolve', (data) => {
            this.log('SPELL', 'Full Moon', {
                cardName: 'Full Moon',
                target: data.target?.name,
                effect: `Forced evolution into ${data.evolution?.name}`,
                owner: data.owner
            });
        });
        
        GameEvents.on('onFullMoonFail', (data) => {
            this.log('SPELL', 'Full Moon Failed', {
                cardName: 'Full Moon',
                target: data.target?.name,
                effect: `Failed: ${data.reason}`,
                owner: data.target?.owner
            });
        });
        
        // Curse Heal
        GameEvents.on('onCurseHeal', (data) => {
            this.log('ABILITY', 'Curse Heal', {
                cardName: data.combatant?.name,
                abilityName: 'Curse Heal',
                effect: 'Healed from curse tokens',
                owner: data.owner
            });
        });
        
        console.log('[MatchLog] Subscribed to game events');
    }
};

window.MatchLog = MatchLog;

// ==================== EVENT LOG SYSTEM ====================
const EventLog = {
    entries: [],
    maxEntries: 50,
    currentTurn: 0,
    lastTurnLogged: -1,
    subscribed: false,
    
    init() {
        this.entries = [];
        this.currentTurn = 0;
        this.lastTurnLogged = -1;
        this.render();
        this.setupToggle();
        // Only subscribe once
        if (!this.subscribed) {
            this.subscribeToEvents();
            this.subscribed = true;
        }
    },
    
    setupToggle() {
        const header = document.getElementById('event-log-header');
        const log = document.getElementById('event-log');
        if (header && !header._hasToggleHandler) {
            header.onclick = () => log.classList.toggle('collapsed');
            header._hasToggleHandler = true;
        }
    },
    
    subscribeToEvents() {
        GameEvents.on('onAttackDeclared', (data) => {
            const attackerName = data.attacker?.name || 'Unknown';
            const isPlayer = data.attackerOwner === 'player';
            this.addEntry({
                type: 'combat',
                ownerClass: isPlayer ? 'player-action' : 'enemy-action',
                icon: '⚔',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${attackerName}</span> attacks`
            });
        });
        
        GameEvents.on('onHit', (data) => {
            const targetName = data.target?.name || 'Unknown';
            const damage = data.damage || 0;
            const isTargetPlayer = data.target?.owner === 'player';
            if (damage > 0) {
                this.addEntry({
                    type: 'combat', ownerClass: 'combat', icon: '💥',
                    text: `<span class="name-${isTargetPlayer ? 'player' : 'enemy'}">${targetName}</span> takes <span class="damage">${damage}</span> damage`
                });
            }
        });
        
        GameEvents.on('onDamageReduced', (data) => {
            const targetName = data.target?.name || 'Unknown';
            const isTargetPlayer = data.targetOwner === 'player';
            const reduction = data.reduction || 0;
            const wasFullyBlocked = data.reducedDamage === 0;
            
            if (wasFullyBlocked) {
                this.addEntry({
                    type: 'protection', ownerClass: 'buff', icon: '🛡️',
                    text: `<span class="name-${isTargetPlayer ? 'player' : 'enemy'}">${targetName}</span>'s protection blocked all damage!`
                });
            } else {
                this.addEntry({
                    type: 'protection', ownerClass: 'buff', icon: '🛡️',
                    text: `<span class="name-${isTargetPlayer ? 'player' : 'enemy'}">${targetName}</span>'s protection reduced damage by ${reduction}`
                });
            }
        });
        
        GameEvents.on('onSummon', (data) => {
            const name = data.cryptid?.name || 'Unknown';
            const isPlayer = data.owner === 'player';
            const posType = data.isSupport ? 'ward' : 'rite';
            const icon = data.isKindling ? '🕯' : '✦';
            this.addEntry({
                type: 'summon', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon,
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${name}</span> summoned to ${posType}`
            });
        });
        
        GameEvents.on('onDeath', (data) => {
            const name = data.cryptid?.name || 'Unknown';
            const wasPlayer = data.owner === 'player';
            const souls = data.deathCount > 1 ? ` (${data.deathCount} souls)` : '';
            this.addEntry({
                type: 'death', ownerClass: 'death', icon: '☠',
                text: `<span class="name-${wasPlayer ? 'player' : 'enemy'}">${name}</span> perished${souls}`
            });
        });
        
        GameEvents.on('onSpellCast', (data) => {
            const spellName = data.card?.name || 'Spell';
            const isPlayer = data.caster === 'player';
            const targetName = data.target?.name;
            const targetText = targetName ? ` on <span class="name-${data.target?.owner === 'player' ? 'player' : 'enemy'}">${targetName}</span>` : '';
            this.addEntry({
                type: 'spell', ownerClass: 'spell', icon: '✧',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${isPlayer ? 'Seeker' : 'Warden'}</span> cast ${spellName}${targetText}`
            });
        });
        
        GameEvents.on('onTrapSet', (data) => {
            const isPlayer = data.owner === 'player';
            this.addEntry({
                type: 'trap', ownerClass: 'trap', icon: '⚡',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${isPlayer ? 'Seeker' : 'Warden'}</span> set a trap`
            });
        });
        
        GameEvents.on('onTrapTriggered', (data) => {
            const trapName = data.trap?.name || 'Trap';
            const isPlayer = data.owner === 'player';
            const triggerEvent = data.triggerEvent;
            
            // Build more descriptive text based on trigger event
            let contextText = '';
            if (triggerEvent?.attacker?.name) {
                contextText = ` (${triggerEvent.attacker.name} attacked)`;
            } else if (triggerEvent?.cryptid?.name) {
                contextText = ` (${triggerEvent.cryptid.name})`;
            } else if (triggerEvent?.target?.name) {
                contextText = ` (${triggerEvent.target.name} targeted)`;
            }
            
            this.addEntry({
                type: 'trap', ownerClass: 'trap', icon: '⚡',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${trapName}</span> activated!${contextText}`
            });
        });
        
        GameEvents.on('onEvolution', (data) => {
            const fromName = data.from?.name || 'Creature';
            const toName = data.to?.name || 'Unknown';
            const isPlayer = data.owner === 'player';
            this.addEntry({
                type: 'evolution', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '◈',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${fromName}</span> evolved into ${toName}`
            });
        });
        
        GameEvents.on('onPromotion', (data) => {
            const name = data.cryptid?.name || 'Support';
            const isPlayer = data.owner === 'player';
            this.addEntry({
                type: 'promotion', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '→',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${name}</span> advanced to rite`
            });
        });
        
        GameEvents.on('onPyreBurn', (data) => {
            const isPlayer = data.owner === 'player';
            const amount = data.pyreGained || 0;
            const cardsDrawn = data.cardsDrawn || 0;
            this.addEntry({
                type: 'pyre', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '🜂',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${isPlayer ? 'Seeker' : 'Warden'}</span> burned pyre: <span class="pyre">+${amount}</span> pyre, drew ${cardsDrawn} card${cardsDrawn !== 1 ? 's' : ''}`
            });
        });
        
        GameEvents.on('onHeal', (data) => {
            const name = data.target?.name || 'Creature';
            const amount = data.amount || 0;
            const isPlayer = data.target?.owner === 'player';
            if (amount > 0) {
                this.addEntry({
                    type: 'heal', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '❤',
                    text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${name}</span> healed <span class="heal">${amount}</span>`
                });
            }
        });
        
        GameEvents.on('onTurnStart', (data) => {
            this.currentTurn = data.turnNumber || this.currentTurn + 1;
            const isPlayer = data.owner === 'player';
            this.addTurnSeparator(isPlayer);
        });
        
        GameEvents.on('onStatusApplied', (data) => {
            const name = data.cryptid?.name || 'Creature';
            const isPlayer = data.owner === 'player';
            const statusName = data.status.charAt(0).toUpperCase() + data.status.slice(1);
            const iconMap = {
                'burn': '🔥', 'paralyze': '⚡', 
                'bleed': '🩸', 'calamity': '💀', 'protection': '🛡️'
            };
            const icon = iconMap[data.status] || '⚠';
            this.addEntry({
                type: 'status', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon,
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${name}</span> ${data.refreshed ? 're-' : ''}afflicted with ${statusName}`
            });
        });
        
        GameEvents.on('onBleedDamage', (data) => {
            const name = data.target?.name || 'Creature';
            const isPlayer = data.owner === 'player';
            this.addEntry({
                type: 'status', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '🩸',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${name}</span> takes <span class="damage">2x</span> damage from bleed!`
            });
        });
        
        GameEvents.on('onCleanse', (data) => {
            const name = data.cryptid?.name || 'Creature';
            const isPlayer = data.owner === 'player';
            this.addEntry({
                type: 'heal', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '✨',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${name}</span> cleansed of ${data.count} ailment${data.count > 1 ? 's' : ''}`
            });
        });
        
        GameEvents.on('onSacrificeActivated', (data) => {
            const name = data.cryptid?.name || 'Creature';
            const victimName = data.victim?.name || 'Combatant';
            const isPlayer = data.owner === 'player';
            this.addEntry({
                type: 'death', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '⚰',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${name}</span> sacrificed ${victimName} - gains Destroyer!`
            });
        });
        
        GameEvents.on('onDestroyerDamage', (data) => {
            const attackerName = data.attacker?.name || 'Attacker';
            const supportName = data.support?.name || 'Support';
            const isPlayer = data.attacker?.owner === 'player';
            this.addEntry({
                type: 'combat', ownerClass: 'combat', icon: '💥',
                text: `Destroyer! ${attackerName} deals <span class="damage">${data.damage}</span> overflow to ${supportName}`
            });
        });
        
        GameEvents.on('onBloodPactActivated', (data) => {
            const name = data.cryptid?.name || 'Creature';
            const victimName = data.victim?.name || 'Combatant';
            const isPlayer = data.owner === 'player';
            this.addEntry({
                type: 'special', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '🩸',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${name}</span> drained ${victimName} for <span class="pyre">+1</span> pyre`
            });
        });
        
        GameEvents.on('onForceRest', (data) => {
            const name = data.cryptid?.name || 'Creature';
            const isPlayer = data.owner === 'player';
            this.addEntry({
                type: 'status', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '💤',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${name}</span> forced to rest`
            });
        });
        
        GameEvents.on('onBuffApplied', (data) => {
            const name = data.cryptid?.name || 'Creature';
            const isPlayer = data.owner === 'player';
            const source = data.source || 'ability';
            let buffText = '';
            if (data.atkBonus) buffText += `+${data.atkBonus} ATK`;
            if (data.hpBonus) buffText += (buffText ? ', ' : '') + `+${data.hpBonus} HP`;
            this.addEntry({
                type: 'buff', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '⬆️',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${name}</span> gained ${buffText} (${source})`
            });
        });
        
        GameEvents.on('onBurnDamage', (data) => {
            const name = data.cryptid?.name || 'Creature';
            const isPlayer = data.owner === 'player';
            this.addEntry({
                type: 'status', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '🔥',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${name}</span> burned for <span class="damage">1</span>`
            });
        });
        
        GameEvents.on('onAuraApplied', (data) => {
            const cryptidName = data.cryptid?.name || 'Creature';
            const auraName = data.aura?.name || 'Aura';
            const isPlayer = data.owner === 'player';
            this.addEntry({
                type: 'aura', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '✨',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${cryptidName}</span> enchanted with ${auraName}`
            });
        });
        
        GameEvents.on('onPyreCardPlayed', (data) => {
            console.log('[EventLog] onPyreCardPlayed received, owner:', data.owner);
            const cardName = data.card?.name || 'Pyre';
            const isPlayer = data.owner === 'player';
            const pyreGained = data.pyreGained || 0;
            this.addEntry({
                type: 'pyre', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '🔥',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${isPlayer ? 'Seeker' : 'Warden'}</span> played ${cardName}: <span class="pyre">+${pyreGained}</span> pyre`
            });
        });
        
        GameEvents.on('onCardDrawn', (data) => {
            // Skip logging if draw was from pyre burn (already logged in onPyreBurn)
            if (data.source === 'pyreBurn') return;
            const isPlayer = data.owner === 'player';
            this.addEntry({
                type: 'draw', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '📜',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${isPlayer ? 'Seeker' : 'Warden'}</span> drew a card`
            });
        });
        
        GameEvents.on('onKill', (data) => {
            const killerName = data.killer?.name || 'Unknown';
            const victimName = data.victim?.name || 'Unknown';
            const isKillerPlayer = data.killerOwner === 'player';
            this.addEntry({
                type: 'combat', ownerClass: 'death', icon: '💀',
                text: `<span class="name-${isKillerPlayer ? 'player' : 'enemy'}">${killerName}</span> slew <span class="name-${data.victimOwner === 'player' ? 'player' : 'enemy'}">${victimName}</span>`
            });
        });
        
        GameEvents.on('onPhaseChange', (data) => {
            const isPlayer = data.owner === 'player';
            const phaseName = data.newPhase === 'conjure1' ? 'First Conjuring' : 
                             data.newPhase === 'combat' ? 'Combat' : 
                             data.newPhase === 'conjure2' ? 'Second Conjuring' : data.newPhase;
            this.addEntry({
                type: 'system', ownerClass: 'system', icon: '◆',
                text: `${phaseName} phase begins`
            });
        });
        
        GameEvents.on('onLatch', (data) => {
            const attackerName = data.attacker?.name || 'Creature';
            const targetName = data.target?.name || 'Creature';
            const isPlayer = data.attackerOwner === 'player';
            this.addEntry({
                type: 'combat', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '🔗',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${attackerName}</span> latched onto <span class="name-${data.targetOwner === 'player' ? 'player' : 'enemy'}">${targetName}</span>`
            });
        });
        
        GameEvents.on('onToxicApplied', (data) => {
            const isPlayer = data.owner === 'player';
            const rowName = data.row === 0 ? 'top' : data.row === 1 ? 'middle' : 'bottom';
            this.addEntry({
                type: 'trap', ownerClass: 'trap', icon: '☠',
                text: `Toxic mist spreads to <span class="name-${isPlayer ? 'enemy' : 'player'}">${rowName} tile</span>`
            });
        });
        
        GameEvents.on('onToxicDamage', (data) => {
            const targetName = data.target?.name || 'Creature';
            const isTargetPlayer = data.owner === 'player';
            this.addEntry({
                type: 'status', ownerClass: 'combat', icon: '☠',
                text: `<span class="name-${isTargetPlayer ? 'player' : 'enemy'}">${targetName}</span> takes <span class="damage">+1</span> toxic damage`
            });
        });
        
        GameEvents.on('onCalamityTick', (data) => {
            const name = data.cryptid?.name || 'Creature';
            const isPlayer = data.owner === 'player';
            this.addEntry({
                type: 'status', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '⚠',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${name}</span> calamity: ${data.countersRemaining} turns remain`
            });
        });
        
        GameEvents.on('onCalamityDeath', (data) => {
            const name = data.cryptid?.name || 'Creature';
            const isPlayer = data.owner === 'player';
            this.addEntry({
                type: 'death', ownerClass: 'death', icon: '💥',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${name}</span> destroyed by Calamity!`
            });
        });
        
        GameEvents.on('onPyreGained', (data) => {
            // Log special pyre gains like pyre fuel (not turn start or pyre burn which are logged separately)
            if (data.source === 'pyreFuel') {
                const cryptidName = data.sourceCryptid?.name || 'Support';
                const isPlayer = data.owner === 'player';
                this.addEntry({
                    type: 'pyre', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '🔥',
                    text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${cryptidName}</span> fueled pyre: <span class="pyre">+1</span>`
                });
            }
        });
        
        GameEvents.on('onTurnEnd', (data) => {
            const isPlayer = data.owner === 'player';
            this.addEntry({
                type: 'system', ownerClass: 'system', icon: '⟳',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${isPlayer ? 'Seeker' : 'Warden'}'s</span> turn ends`
            });
        });
        
        GameEvents.on('onFieldEmpty', (data) => {
            const isPlayer = data.owner === 'player';
            this.addEntry({
                type: 'system', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '⚠',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${isPlayer ? 'Seeker' : 'Warden'}'s</span> field is empty!`
            });
        });
        
        GameEvents.on('onToxicFade', (data) => {
            const isPlayer = data.owner === 'player';
            const rowName = data.row === 0 ? 'top' : data.row === 1 ? 'middle' : 'bottom';
            this.addEntry({
                type: 'status', ownerClass: 'system', icon: '☠',
                text: `Toxic mist fades from <span class="name-${isPlayer ? 'enemy' : 'player'}">${rowName} tile</span>`
            });
        });
        
        // ==================== CARD-SPECIFIC ABILITIES (Player-Friendly) ====================
        
        // Skinwalker Mimic
        GameEvents.on('onMimic', (data) => {
            const name = data.cryptid?.name || 'Skinwalker';
            const copiedName = data.copied?.name || 'enemy';
            const isPlayer = data.owner === 'player';
            this.addEntry({
                type: 'ability', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '🎭',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${name}</span> mimicked ${copiedName}'s attack!`
            });
        });
        
        // Stormhawk Lone Hunter
        GameEvents.on('onLoneHunterBonus', (data) => {
            const name = data.cryptid?.name || 'Stormhawk';
            const isPlayer = data.owner === 'player';
            this.addEntry({
                type: 'ability', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '🦅',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${name}</span> hunts alone: <span class="buff">+1 ATK</span>`
            });
        });
        
        // Thermal Swap
        GameEvents.on('onThermalSwap', (data) => {
            const name = data.cryptid?.name || 'Creature';
            const isPlayer = data.owner === 'player';
            this.addEntry({
                type: 'ability', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '🌀',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${name}</span> thermal swapped & both healed!`
            });
        });
        
        // Rage abilities
        GameEvents.on('onRageStack', (data) => {
            const name = data.cryptid?.name || 'Bigfoot';
            const newAtk = data.newAtk || '?';
            const isPlayer = data.cryptid?.owner === 'player';
            this.addEntry({
                type: 'ability', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '😤',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${name}</span> rages! ATK is now <span class="buff">${newAtk}</span>`
            });
        });
        
        GameEvents.on('onRageHeal', (data) => {
            const name = data.cryptid?.name || 'Bigfoot';
            const isPlayer = data.owner === 'player';
            this.addEntry({
                type: 'ability', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '💚',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${name}</span> calmed - rage converted to healing!`
            });
        });
        
        // Cursed Hybrid Adaptation
        GameEvents.on('onHybridAdaptation', (data) => {
            const name = data.cryptid?.name || 'Hybrid';
            const bonus = data.type === 'atk' ? '+1 ATK' : '+1 HP';
            const isPlayer = data.cryptid?.owner === 'player';
            this.addEntry({
                type: 'ability', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '🧬',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${name}</span> adapted: <span class="buff">${bonus}</span>`
            });
        });
        
        // Deer Woman Grace & Offering
        GameEvents.on('onGraceBuff', (data) => {
            const targetName = data.target?.name || 'ally';
            const isPlayer = data.owner === 'player';
            this.addEntry({
                type: 'ability', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '🦌',
                text: `Grace blessed <span class="name-${isPlayer ? 'player' : 'enemy'}">${targetName}</span>: <span class="buff">+1/+1</span>`
            });
        });
        
        GameEvents.on('onOfferingPyre', (data) => {
            const name = data.cryptid?.name || 'Deer Woman';
            const isPlayer = data.owner === 'player';
            this.addEntry({
                type: 'ability', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '🔥',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${name}</span>'s offering: <span class="pyre">+1 Pyre</span>`
            });
        });
        
        // Wendigo abilities
        GameEvents.on('onWendigoHunger', (data) => {
            const name = data.cryptid?.name || 'Wendigo';
            const isPlayer = data.owner === 'player';
            this.addEntry({
                type: 'ability', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '🍖',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${name}</span>'s hunger grows: <span class="buff">+1/+1</span>`
            });
        });
        
        GameEvents.on('onPrimalWendigoAscension', (data) => {
            const name = data.cryptid?.name || 'Primal Wendigo';
            const isPlayer = data.owner === 'player';
            this.addEntry({
                type: 'ability', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '👁',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${name}</span> ASCENDED - death denied!`
            });
        });
        
        // Guardian & Protection
        GameEvents.on('onGuardianProtect', (data) => {
            const supportName = data.support?.name || 'Guardian';
            const combatantName = data.combatant?.name || 'combatant';
            const isPlayer = data.owner === 'player';
            this.addEntry({
                type: 'ability', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '🛡️',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${supportName}</span> granted protection to ${combatantName}`
            });
        });
        
        GameEvents.on('onBulwarkTrigger', (data) => {
            const name = data.cryptid?.name || 'Creature';
            const isPlayer = data.owner === 'player';
            this.addEntry({
                type: 'ability', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '🛡️',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${name}</span>'s Bulwark: damage reduced to 1!`
            });
        });
        
        // Primal Wendigo Counter
        GameEvents.on('onPrimalCounter', (data) => {
            const name = data.cryptid?.name || 'Primal Wendigo';
            const attackerName = data.attacker?.name || 'attacker';
            const isPlayer = data.owner === 'player';
            this.addEntry({
                type: 'ability', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '⚡',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${name}</span> counter-killed ${attackerName}!`
            });
        });
        
        // Apex Kill
        GameEvents.on('onApexKill', (data) => {
            const name = data.cryptid?.name || 'Apex';
            const victimName = data.victim?.name || 'prey';
            const isPlayer = data.owner === 'player';
            this.addEntry({
                type: 'ability', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '🐺',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${name}</span> devoured ${victimName}!`
            });
        });
        
        // Cannibalize
        GameEvents.on('onCannibalizeKill', (data) => {
            const name = data.cryptid?.name || 'Creature';
            const supportName = data.support?.name || 'support';
            const isPlayer = data.owner === 'player';
            this.addEntry({
                type: 'ability', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '💀',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${name}</span> cannibalized ${supportName}!`
            });
        });
        
        // Thunderbird Storm Call
        GameEvents.on('onStormCallDamage', (data) => {
            const sourceName = data.source?.name || 'Thunderbird';
            const targetName = data.target?.name || 'enemy';
            const isSourcePlayer = data.source?.owner === 'player';
            this.addEntry({
                type: 'ability', ownerClass: isSourcePlayer ? 'player-action' : 'enemy-action', icon: '⚡',
                text: `<span class="name-${isSourcePlayer ? 'player' : 'enemy'}">${sourceName}</span> called lightning on ${targetName}!`
            });
        });
        
        // Thunderbird Tailwind
        GameEvents.on('onTailwindBuff', (data) => {
            const supportName = data.support?.name || 'Thunderbird';
            const combatantName = data.combatant?.name || 'ally';
            const isPlayer = data.owner === 'player';
            this.addEntry({
                type: 'ability', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '🌬️',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${supportName}</span> gave ${combatantName} Tailwind: <span class="buff">Flight +1/+1</span>`
            });
        });
        
        // Snipe Hide
        GameEvents.on('onHide', (data) => {
            const name = data.cryptid?.name || 'Snipe';
            const isPlayer = data.owner === 'player';
            this.addEntry({
                type: 'ability', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '👁',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${name}</span> vanished into hiding!`
            });
        });
        
        GameEvents.on('onReHide', (data) => {
            const name = data.cryptid?.name || 'Snipe';
            const isPlayer = data.owner === 'player';
            this.addEntry({
                type: 'ability', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '👁',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${name}</span> re-hid after the kill!`
            });
        });
        
        // Snipe Mend
        GameEvents.on('onMendHeal', (data) => {
            const supportName = data.support?.name || 'Snipe';
            const combatantName = data.combatant?.name || 'ally';
            const isPlayer = data.owner === 'player';
            this.addEntry({
                type: 'ability', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '💚',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${supportName}</span> mended ${combatantName} to full HP!`
            });
        });
        
        // Werewolf Blood Frenzy
        GameEvents.on('onBloodFrenzy', (data) => {
            const name = data.cryptid?.name || 'Werewolf';
            const isPlayer = data.owner === 'player';
            this.addEntry({
                type: 'ability', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '🩸',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${name}</span> entered blood frenzy: <span class="buff">+1 ATK</span>`
            });
        });
        
        // Razorback abilities
        GameEvents.on('onSavageBuff', (data) => {
            const supportName = data.support?.name || 'Razorback';
            const combatantName = data.combatant?.name || 'ally';
            const isPlayer = data.owner === 'player';
            this.addEntry({
                type: 'ability', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '🐗',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${supportName}</span> made ${combatantName} savage: <span class="buff">+2 ATK</span>`
            });
        });
        
        GameEvents.on('onGoreDamage', (data) => {
            const sourceName = data.source?.name || 'Razorback';
            const targetName = data.target?.name || 'enemy';
            const damage = data.damage || 2;
            const isPlayer = data.owner === 'player';
            this.addEntry({
                type: 'ability', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '🐗',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${sourceName}</span> gored ${targetName} for <span class="damage">${damage}</span>!`
            });
        });
        
        // Iron Hide
        GameEvents.on('onIronHide', (data) => {
            const supportName = data.support?.name || 'Support';
            const combatantName = data.combatant?.name || 'ally';
            const isPlayer = data.owner === 'player';
            this.addEntry({
                type: 'ability', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '🛡️',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${supportName}</span> gave ${combatantName} Iron Hide!`
            });
        });
        
        // Not Deer Herd Blessing
        GameEvents.on('onHerdBlessing', (data) => {
            const name = data.cryptid?.name || 'Not Deer';
            const pyres = data.pyresGained || 0;
            const isPlayer = data.owner === 'player';
            this.addEntry({
                type: 'ability', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '🦌',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${name}</span>'s Herd Blessing: <span class="pyre">+${pyres} Pyre</span>`
            });
        });
        
        // Jersey Devil abilities
        GameEvents.on('onSwoopDamage', (data) => {
            const sourceName = data.source?.name || 'Jersey Devil';
            const targetName = data.target?.name || 'enemy';
            const damage = data.damage || 2;
            const isPlayer = data.owner === 'player';
            this.addEntry({
                type: 'ability', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '🦇',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${sourceName}</span> swooped on ${targetName} for <span class="damage">${damage}</span>!`
            });
        });
        
        GameEvents.on('onPyreSteal', (data) => {
            const sourceName = data.source?.name || 'Jersey Devil';
            const isPlayer = data.owner === 'player';
            this.addEntry({
                type: 'ability', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '🔥',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${sourceName}</span> stole <span class="pyre">1 Pyre</span>!`
            });
        });
        
        // Baba Yaga abilities
        GameEvents.on('onInfernalWard', (data) => {
            const supportName = data.support?.name || 'Baba Yaga';
            const combatantName = data.combatant?.name || 'ally';
            const isPlayer = data.owner === 'player';
            this.addEntry({
                type: 'ability', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '🏚️',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${supportName}</span> warded ${combatantName} from spells!`
            });
        });
        
        GameEvents.on('onHexKill', (data) => {
            const sourceName = data.source?.name || 'Baba Yaga';
            const victimName = data.victim?.name || 'victim';
            const isPlayer = data.owner === 'player';
            this.addEntry({
                type: 'ability', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '💀',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${sourceName}</span>'s hex killed ${victimName}!`
            });
        });
        
        // Crone's Blessing
        GameEvents.on('onCronesBlessing', (data) => {
            const supportName = data.support?.name || 'Crone';
            const combatantName = data.combatant?.name || 'ally';
            const isPlayer = data.owner === 'player';
            this.addEntry({
                type: 'ability', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '🧙',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${supportName}</span> blessed ${combatantName}: <span class="pyre">+1 Pyre</span> & healed!`
            });
        });
        
        // Hunt trap
        GameEvents.on('onHuntSteal', (data) => {
            const stolenPyre = data.stolenPyre || 0;
            const isPlayer = data.to === 'player';
            this.addEntry({
                type: 'trap', ownerClass: 'trap', icon: '🎯',
                text: `Hunt triggered! Stole <span class="pyre">${stolenPyre} Pyre</span>!`
            });
        });
        
        // Full Moon burst
        GameEvents.on('onFullMoonEvolve', (data) => {
            const targetName = data.target?.name || 'creature';
            const evolutionName = data.evolution?.name || 'new form';
            const isPlayer = data.owner === 'player';
            this.addEntry({
                type: 'spell', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '🌕',
                text: `Full Moon forced <span class="name-${isPlayer ? 'player' : 'enemy'}">${targetName}</span> to evolve into ${evolutionName}!`
            });
        });
        
        // Skinwalker Inherit
        GameEvents.on('onSkinwalkerInherit', (data) => {
            const supportName = data.support?.name || 'Skinwalker';
            const deadName = data.deadCombatant?.name || 'fallen';
            const isPlayer = data.owner === 'player';
            this.addEntry({
                type: 'ability', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '🎭',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${supportName}</span> inherited ${deadName}'s power!`
            });
        });
        
        // Evolution stat bonus
        GameEvents.on('onEvolutionBonus', (data) => {
            const name = data.cryptid?.name || 'Creature';
            const bonus = data.bonus || 2;
            const isPlayer = data.owner === 'player';
            this.addEntry({
                type: 'ability', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '⬆️',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${name}</span> evolution bonus: <span class="buff">+${bonus} ATK</span>`
            });
        });
        
        // Curse Heal
        GameEvents.on('onCurseHeal', (data) => {
            const name = data.combatant?.name || 'Creature';
            const isPlayer = data.owner === 'player';
            this.addEntry({
                type: 'ability', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '💚',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${name}</span> healed from curse tokens!`
            });
        });
    },
    
    addTurnSeparator(isPlayerTurn) {
        if (this.lastTurnLogged === this.currentTurn) return;
        this.lastTurnLogged = this.currentTurn;
        this.entries.push({ isSeparator: true, turn: this.currentTurn, isPlayerTurn });
        this.trimEntries();
        this.render();
    },
    
    addEntry(entry) {
        entry.turn = this.currentTurn;
        entry.timestamp = Date.now();
        this.entries.push(entry);
        this.trimEntries();
        this.render();
    },
    
    trimEntries() {
        while (this.entries.length > this.maxEntries) this.entries.shift();
    },
    
    clear() {
        this.entries = [];
        this.currentTurn = 0;
        this.lastTurnLogged = -1;
        this.render();
    },
    
    render() {
        const container = document.getElementById('event-log-entries');
        if (!container) return;
        container.innerHTML = '';
        for (const entry of this.entries) {
            if (entry.isSeparator) {
                const sep = document.createElement('div');
                sep.className = 'log-turn-separator';
                sep.textContent = entry.isPlayerTurn ? `— Turn ${entry.turn}: Seeker —` : `— Turn ${entry.turn}: Warden —`;
                container.appendChild(sep);
            } else {
                const el = document.createElement('div');
                el.className = `log-entry ${entry.ownerClass || ''} ${entry.type || ''}`;
                el.innerHTML = `<span class="log-icon">${entry.icon || '•'}</span><span class="log-text">${entry.text}</span>`;
                container.appendChild(el);
            }
        }
        container.scrollTop = container.scrollHeight;
    }
};

window.EventLog = EventLog;

// ==================== ANIMATION TIMING ====================
const TIMING = {
    // Core animations
    attackAnim: 650,        // Attack lunge animation
    damageAnim: 700,        // Damage shake/flash
    deathAnim: 800,         // Death spiral animation
    summonAnim: 700,        // Summon appearance
    promoteAnim: 600,       // Promote slide animation
    evolveAnim: 900,        // Evolution transformation
    protectionAnim: 750,    // Protection block glow
    
    // Traps
    trapTriggerAnim: 900,   // Trap activation flash
    trapMessageDelay: 500,  // Delay before trap message
    
    // Combat pacing
    attackDelay: 400,       // Delay between attack declaration and hit
    postAttackDelay: 500,   // Pause after attack resolves
    betweenAttacksDelay: 300, // Gap between sequential attacks
    
    // AI pacing
    aiPhaseDelay: 1000,     // AI thinking pause at phase start
    aiActionDelay: 800,     // Delay between AI actions
    aiAttackDelay: 600,     // AI attack timing
    
    // UI feedback
    messageDisplay: 1400,   // How long messages show
    pyreBurnEffect: 1400,   // Pyre burn visual duration
    spellEffect: 800,       // Spell cast visual
    
    // Death/promotion cascade
    cascadeDelay: 400,      // Delay between death checks
    promotionPause: 300     // Pause after promotion
};

// ==================== TRAP QUEUE ====================
window.pendingTraps = [];
window.processingTraps = false;
window.animatingTraps = new Set();

async function processTrapQueue() {
    try {
        while (window.pendingTraps && window.pendingTraps.length > 0) {
            const { owner, row, trap, eventData } = window.pendingTraps.shift();
            const traps = owner === 'player' ? game.playerTraps : game.enemyTraps;
            if (!traps || !traps[row]) continue;
            
            const trapKey = `${owner}-trap-${row}`;
            window.animatingTraps.add(trapKey);
            
            // Play the trap activation animation
            await playTrapTriggerAnimation(owner, row, trap);
            
            // Brief pause before effect executes
            await new Promise(r => setTimeout(r, 200));
            
            // Execute the trap effect
            game.triggerTrap(owner, row, eventData);
            
            // Pause after effect to show results
            await new Promise(r => setTimeout(r, TIMING.postAttackDelay));
            
            window.animatingTraps.delete(trapKey);
            renderAll();
            
            // Check for any deaths caused by trap with timeout safety
            await new Promise(resolve => {
                const timeout = setTimeout(() => {
                    console.warn('Trap death check timed out, continuing...');
                    resolve();
                }, 5000);
                
                checkAllCreaturesForDeath(() => {
                    clearTimeout(timeout);
                    renderAll();
                    resolve();
                });
            });
            
            if (window.pendingTraps && window.pendingTraps.length > 0) {
                await new Promise(r => setTimeout(r, 300));
            }
        }
    } catch (error) {
        console.error('Error in trap processing:', error);
    } finally {
        // Always reset processing flag
        window.processingTraps = false;
    }
}

async function playTrapTriggerAnimation(owner, row, trap) {
    // Show trap name prominently
    showMessage(`⚡ ${trap.name}! ⚡`, TIMING.trapTriggerAnim);
    
    const trapSprite = document.querySelector(`.trap-sprite[data-owner="${owner}"][data-row="${row}"]`);
    if (trapSprite) trapSprite.classList.add('trap-triggering');
    
    const trapTile = document.querySelector(`.tile.trap[data-owner="${owner}"][data-row="${row}"]`);
    if (trapTile) {
        trapTile.classList.add('trap-activating');
        setTimeout(() => trapTile.classList.remove('trap-activating'), TIMING.trapTriggerAnim);
    }
    
    // Flash the battlefield briefly
    const battlefield = document.getElementById('battlefield-area');
    if (battlefield) {
        battlefield.classList.add('trap-flash');
        setTimeout(() => battlefield.classList.remove('trap-flash'), 400);
    }
    
    await new Promise(r => setTimeout(r, TIMING.trapTriggerAnim));
}

// ==================== ABILITY ANIMATION QUEUE ====================
window.abilityAnimationQueue = [];
window.processingAbilityAnimations = false;

// Queue an ability animation effect
function queueAbilityAnimation(effect) {
    window.abilityAnimationQueue.push(effect);
    if (!window.processingAbilityAnimations) {
        processAbilityAnimationQueue();
    }
}

async function processAbilityAnimationQueue() {
    if (window.processingAbilityAnimations || window.abilityAnimationQueue.length === 0) return;
    window.processingAbilityAnimations = true;
    
    while (window.abilityAnimationQueue.length > 0) {
        const effect = window.abilityAnimationQueue.shift();
        await playAbilityAnimation(effect);
    }
    
    window.processingAbilityAnimations = false;
}

async function playAbilityAnimation(effect) {
    const { type, source, target, damage, message, owner } = effect;
    
    // Find target sprite
    let targetSprite = null;
    if (target) {
        targetSprite = document.querySelector(
            `.cryptid-sprite[data-owner="${target.owner}"][data-col="${target.col}"][data-row="${target.row}"]`
        );
    }
    
    // Find source sprite
    let sourceSprite = null;
    if (source) {
        sourceSprite = document.querySelector(
            `.cryptid-sprite[data-owner="${source.owner}"][data-col="${source.col}"][data-row="${source.row}"]`
        );
    }
    
    switch (type) {
        case 'abilityDamage':
            // Show message
            if (message) {
                showMessage(message, 800);
                await new Promise(r => setTimeout(r, 200));
            }
            
            // Flash target and show damage with combat effects
            if (targetSprite) {
                targetSprite.classList.add('hit-recoil');
                
                // Add combat effects
                if (window.CombatEffects && target) {
                    const battlefield = document.getElementById('battlefield-area');
                    if (battlefield) {
                        const rect = targetSprite.getBoundingClientRect();
                        const bRect = battlefield.getBoundingClientRect();
                        const impactX = rect.left + rect.width/2 - bRect.left;
                        const impactY = rect.top + rect.height/2 - bRect.top;
                        CombatEffects.createImpactFlash(impactX, impactY, 60);
                        CombatEffects.createImpactParticles(impactX, impactY, '#aa66ff', 8);
                        CombatEffects.lightImpact();
                        CombatEffects.showDamageNumber(target, damage);
                    }
                } else {
                    showFloatingDamage(target, damage);
                }
                await new Promise(r => setTimeout(r, 300));
                targetSprite.classList.remove('hit-recoil');
            }
            break;
            
        case 'counterAttack':
            // Show counter-attack message
            if (message) showMessage(message, 900);
            
            // Flash source (counter-attacker)
            if (sourceSprite) {
                sourceSprite.classList.add('counter-attacking');
                await new Promise(r => setTimeout(r, 200));
            }
            
            // Flash target (attacker receiving counter damage) with combat effects
            if (targetSprite) {
                targetSprite.classList.add('hit-recoil');
                
                // Add combat effects for counter damage
                if (window.CombatEffects && target) {
                    const battlefield = document.getElementById('battlefield-area');
                    if (battlefield) {
                        const rect = targetSprite.getBoundingClientRect();
                        const bRect = battlefield.getBoundingClientRect();
                        const impactX = rect.left + rect.width/2 - bRect.left;
                        const impactY = rect.top + rect.height/2 - bRect.top;
                        CombatEffects.createImpactFlash(impactX, impactY, 70);
                        CombatEffects.createSparks(impactX, impactY, 10);
                        CombatEffects.heavyImpact(damage || 2);
                        CombatEffects.showDamageNumber(target, damage, damage >= 5);
                    }
                } else {
                    showFloatingDamage(target, damage);
                }
                await new Promise(r => setTimeout(r, 250));
                targetSprite.classList.remove('hit-recoil');
            }
            
            if (sourceSprite) sourceSprite.classList.remove('counter-attacking');
            await new Promise(r => setTimeout(r, 200));
            break;
            
        case 'cleave':
            // Show cleave hit on secondary target with effects
            if (message) showMessage(message, 600);
            if (targetSprite) {
                targetSprite.classList.add('hit-recoil');
                
                // Add combat effects for cleave
                if (window.CombatEffects && target) {
                    const battlefield = document.getElementById('battlefield-area');
                    if (battlefield) {
                        const rect = targetSprite.getBoundingClientRect();
                        const bRect = battlefield.getBoundingClientRect();
                        const impactX = rect.left + rect.width/2 - bRect.left;
                        const impactY = rect.top + rect.height/2 - bRect.top;
                        CombatEffects.createImpactFlash(impactX, impactY, 60);
                        CombatEffects.createSparks(impactX, impactY, 8);
                        CombatEffects.lightImpact();
                        CombatEffects.showDamageNumber(target, damage);
                    }
                } else {
                    showFloatingDamage(target, damage);
                }
                await new Promise(r => setTimeout(r, 250));
                targetSprite.classList.remove('hit-recoil');
            }
            break;
            
        case 'multiAttack':
            // Show multi-attack hit with effects
            if (targetSprite) {
                targetSprite.classList.add('hit-recoil');
                
                // Add combat effects for multi-attack
                if (window.CombatEffects && target) {
                    const battlefield = document.getElementById('battlefield-area');
                    if (battlefield) {
                        const rect = targetSprite.getBoundingClientRect();
                        const bRect = battlefield.getBoundingClientRect();
                        const impactX = rect.left + rect.width/2 - bRect.left;
                        const impactY = rect.top + rect.height/2 - bRect.top;
                        CombatEffects.createImpactFlash(impactX, impactY, 50);
                        CombatEffects.createSparks(impactX, impactY, 6);
                        CombatEffects.lightImpact();
                        CombatEffects.showDamageNumber(target, damage);
                    }
                } else {
                    showFloatingDamage(target, damage);
                }
                await new Promise(r => setTimeout(r, 250));
                targetSprite.classList.remove('hit-recoil');
            }
            break;
            
        case 'buff':
            // Show buff animation
            if (message) showMessage(message, 800);
            if (targetSprite) {
                targetSprite.classList.add('buff-applied');
                await new Promise(r => setTimeout(r, 500));
                targetSprite.classList.remove('buff-applied');
            }
            break;
            
        case 'heal':
            // Show heal animation
            if (targetSprite) {
                targetSprite.classList.add('healing');
                showFloatingHeal(target, damage);
                await new Promise(r => setTimeout(r, 400));
                targetSprite.classList.remove('healing');
            }
            break;
            
        case 'pyreDrain':
            // Show pyre drain effect
            if (message) showMessage(message, 800);
            await new Promise(r => setTimeout(r, 600));
            break;
            
        case 'attack':
            // Show forced attack animation (for Face-Off, etc.)
            if (message) showMessage(message, 900);
            
            // Attacker lunges with new animation
            if (sourceSprite) {
                sourceSprite.classList.add('attack-windup');
                await new Promise(r => setTimeout(r, 150));
                sourceSprite.classList.remove('attack-windup');
                sourceSprite.classList.add('attack-lunge');
                await new Promise(r => setTimeout(r, 180));
            }
            
            // Impact effects
            if (window.CombatEffects && targetSprite) {
                const battlefield = document.getElementById('battlefield-area');
                if (battlefield) {
                    const targetRect = targetSprite.getBoundingClientRect();
                    const battlefieldRect = battlefield.getBoundingClientRect();
                    const impactX = targetRect.left + targetRect.width/2 - battlefieldRect.left;
                    const impactY = targetRect.top + targetRect.height/2 - battlefieldRect.top;
                    CombatEffects.createImpactFlash(impactX, impactY);
                    CombatEffects.createSparks(impactX, impactY, 12);
                    CombatEffects.heavyImpact(damage || 2);
                }
                if (target && damage) {
                    CombatEffects.showDamageNumber(target, damage, damage >= 5);
                }
            }
            
            // Target takes damage
            if (targetSprite) {
                targetSprite.classList.add('hit-recoil');
                await new Promise(r => setTimeout(r, 250));
                targetSprite.classList.remove('hit-recoil');
            }
            
            if (sourceSprite) {
                sourceSprite.classList.remove('attack-lunge');
                sourceSprite.classList.add('attack-return');
                await new Promise(r => setTimeout(r, 200));
                sourceSprite.classList.remove('attack-return');
            }
            break;
            
        case 'debuff':
            // Show debuff animation
            if (message) showMessage(message, 800);
            if (targetSprite) {
                targetSprite.classList.add('debuff-applied');
                await new Promise(r => setTimeout(r, 500));
                targetSprite.classList.remove('debuff-applied');
            }
            break;
            
        default:
            // Generic ability effect
            if (message) {
                showMessage(message, 900);
                await new Promise(r => setTimeout(r, 700));
            }
            break;
    }
    
    // Small delay between consecutive effects
    await new Promise(r => setTimeout(r, 150));
}

// Show floating damage number
function showFloatingDamage(target, damage) {
    if (!target || damage === undefined || damage === null) return;
    
    const key = `${target.owner}-${target.col}-${target.row}`;
    const pos = window.tilePositions?.[key];
    if (!pos) return;
    
    const battlefield = document.getElementById('battlefield-area');
    if (!battlefield) return;
    
    const floater = document.createElement('div');
    floater.className = 'floating-damage';
    floater.textContent = `-${damage}`;
    floater.style.left = `${pos.x + 30}px`;
    floater.style.top = `${pos.y - 10}px`;
    battlefield.appendChild(floater);
    
    setTimeout(() => floater.remove(), 1000);
}

// Show floating heal number
function showFloatingHeal(target, amount) {
    if (!target || !amount) return;
    
    const key = `${target.owner}-${target.col}-${target.row}`;
    const pos = window.tilePositions?.[key];
    if (!pos) return;
    
    const battlefield = document.getElementById('battlefield-area');
    if (!battlefield) return;
    
    const floater = document.createElement('div');
    floater.className = 'floating-heal';
    floater.textContent = `+${amount}`;
    floater.style.left = `${pos.x + 30}px`;
    floater.style.top = `${pos.y - 10}px`;
    battlefield.appendChild(floater);
    
    setTimeout(() => floater.remove(), 1000);
}

// Expose for external use
window.queueAbilityAnimation = queueAbilityAnimation;
window.showFloatingDamage = showFloatingDamage;
window.showFloatingHeal = showFloatingHeal;

// ==================== HELPER FUNCTIONS ====================
function getCardDisplayName(key) {
    if (typeof CardRegistry !== 'undefined') {
        const card = CardRegistry.getCryptid(key) || CardRegistry.getInstant(key);
        if (card?.name) return card.name;
    }
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
}

function getElementIcon(element) {
    const icons = { void: '🔮', blood: '🩸', water: '💧', steel: '⚙️', nature: '🌿' };
    return icons[element] || '';
}

function renderSprite(sprite, isFieldSprite = false, spriteScale = null, cardSpriteScale = null, spriteFlip = false) {
    if (sprite && (sprite.startsWith('sprites/') || sprite.startsWith('http'))) {
        const sizeClass = isFieldSprite ? 'sprite-img field-sprite-img' : 'sprite-img';
        // Use spriteScale for field, cardSpriteScale for card art (both default to 1.0)
        // spriteFlip applies horizontal flip via scaleX(-1)
        const transforms = [];
        if (isFieldSprite && spriteScale && spriteScale !== 1) {
            transforms.push(`scale(${spriteScale})`);
        } else if (!isFieldSprite && cardSpriteScale && cardSpriteScale !== 1) {
            transforms.push(`scale(${cardSpriteScale})`);
        }
        if (spriteFlip) {
            transforms.push('scaleX(-1)');
        }
        const styleAttr = transforms.length > 0 ? ` style="transform: ${transforms.join(' ')}"` : '';
        return `<img src="${sprite}" class="${sizeClass}"${styleAttr} alt="" draggable="false">`;
    }
    return sprite || '?';
}

// Detect card name overflow and add scroll animation class
function detectCardNameOverflow(container = document) {
    const headers = container.querySelectorAll('.game-card .gc-header');
    headers.forEach(header => {
        const name = header.querySelector('.gc-name');
        if (!name) return;
        
        // Remove class first to get accurate measurement
        header.classList.remove('name-overflows');
        
        // Check if text overflows container
        requestAnimationFrame(() => {
            const headerWidth = header.clientWidth;
            const nameWidth = name.scrollWidth;
            
            if (nameWidth > headerWidth) {
                header.classList.add('name-overflows');
                // Calculate scroll amount needed (negative percentage)
                const overflow = nameWidth - headerWidth;
                const scrollPercent = Math.min((overflow / nameWidth) * 100 + 15, 50);
                header.style.setProperty('--scroll-amount', `-${scrollPercent}%`);
            }
        });
    });
}

// ==================== GAME STATE CLASS ====================
class Game {
    constructor() {
        this.playerField = [[null, null, null], [null, null, null]];
        this.enemyField = [[null, null, null], [null, null, null]];
        this.playerHand = [];
        this.enemyHand = [];
        this.playerKindling = [];
        this.enemyKindling = [];
        this.playerKindlingPlayedThisTurn = false;
        this.enemyKindlingPlayedThisTurn = false;
        this.playerPyreCardPlayedThisTurn = false;
        this.enemyPyreCardPlayedThisTurn = false;
        this.playerPyre = 0;
        this.enemyPyre = 0;
        this.playerDeaths = 0;
        this.enemyDeaths = 0;
        this.playerPyreBurnUsed = false;
        this.enemyPyreBurnUsed = false;
        this.currentTurn = 'player';
        this.phase = 'conjure1';
        this.turnNumber = 0;
        this.gameOver = false;
        this.isMultiplayer = false;
        this.multiplayerData = null;
        this.evolvedThisTurn = {};
        this.playerTraps = [null, null];
        this.enemyTraps = [null, null];
        this.playerToxicTiles = [[0, 0, 0], [0, 0, 0]];
        this.enemyToxicTiles = [[0, 0, 0], [0, 0, 0]];
        
        // Death tracking for Rat King pyre card
        this.deathsThisTurn = { player: 0, enemy: 0 };
        this.deathsLastEnemyTurn = { player: 0, enemy: 0 };
        
        // Attacker tracking for Burial Ground pyre card
        this.attackersThisTurn = { player: [], enemy: [] };
        this.lastTurnAttackers = { player: [], enemy: [] };
        
        // Pile tracking
        this.playerBurnPile = []; // Cryptids burned for pyre
        this.playerDiscardPile = []; // Used spells/instances
        this.enemyBurnPile = [];
        this.enemyDiscardPile = [];
        
        // Match stats tracking for win screen
        this.matchStats = {
            startTime: Date.now(),
            damageDealt: 0,
            damageTaken: 0,
            spellsCast: 0,
            evolutions: 0,
            trapsTriggered: 0,
            kindlingSummoned: 0
        };
        
        // Check if a specific deck was selected
        const selectedDeck = window.selectedPlayerDeck;
        if (selectedDeck && selectedDeck.cards) {
            // Build deck and kindling from selected deck
            const deckResult = this.buildDeckFromSelection(selectedDeck);
            this.deck = deckResult.mainDeck;
            this.playerKindling = deckResult.kindling;
            console.log('[Game] Using selected deck:', selectedDeck.name, 'with', this.deck.length, 'cards and', this.playerKindling.length, 'kindling');
        } else {
            // Fallback to random deck
            this.deck = DeckBuilder.buildRandomDeck();
            this.playerKindling = DeckBuilder.buildKindlingPool();
        }
        
        this.enemyDeck = DeckBuilder.buildRandomDeck();
        this.enemyKindling = DeckBuilder.buildKindlingPool();
        
        this.setupTrapListeners();
    }
    
    buildDeckFromSelection(selectedDeck) {
        const mainDeck = [];
        const kindling = [];
        let mainId = 1;
        let kindlingId = 1000;
        
        for (const entry of selectedDeck.cards) {
            const cardKey = entry.cardKey;
            
            // Check if it's kindling first
            const kindlingCard = CardRegistry.getKindling(cardKey);
            if (kindlingCard) {
                kindling.push({
                    ...kindlingCard,
                    id: kindlingId++,
                    isKindling: true,
                    skinId: entry.skinId,
                    isHolo: entry.isHolo
                });
                continue;
            }
            
            // Check other card types
            const card = CardRegistry.getCryptid(cardKey) ||
                        CardRegistry.getBurst(cardKey) ||
                        CardRegistry.getTrap(cardKey) ||
                        CardRegistry.getAura(cardKey) ||
                        CardRegistry.getPyre(cardKey);
            
            if (card) {
                mainDeck.push({
                    ...card,
                    id: mainId++,
                    skinId: entry.skinId,
                    isHolo: entry.isHolo
                });
            }
        }
        
        // Shuffle main deck
        for (let i = mainDeck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [mainDeck[i], mainDeck[j]] = [mainDeck[j], mainDeck[i]];
        }
        
        return { mainDeck, kindling };
    }
    
    setupTrapListeners() {
        // Create named listener functions so we can remove only trap listeners
        this._trapListeners = this._trapListeners || {};
        
        // Remove only our trap listeners, not all listeners for these events
        const events = ['onDamageTaken', 'onDeath', 'onSummon', 'onAttackDeclared', 'onHit', 'onSpellCast', 'onTurnStart', 'onPyreSpent'];
        events.forEach(event => {
            if (this._trapListeners[event]) {
                const idx = GameEvents.listeners[event]?.indexOf(this._trapListeners[event]);
                if (idx > -1) GameEvents.listeners[event].splice(idx, 1);
            }
        });
        
        // Create and register new trap listeners
        this._trapListeners.onDamageTaken = (data) => this.checkTraps('onDamageTaken', data);
        this._trapListeners.onDeath = (data) => this.checkTraps('onDeath', data);
        this._trapListeners.onSummon = (data) => this.checkTraps('onSummon', data);
        this._trapListeners.onAttackDeclared = (data) => this.checkTraps('onAttackDeclared', data);
        this._trapListeners.onHit = (data) => this.checkTraps('onHit', data);
        this._trapListeners.onSpellCast = (data) => this.checkTraps('onSpellCast', data);
        this._trapListeners.onTurnStart = (data) => this.checkTraps('onTurnStart', data);
        this._trapListeners.onPyreSpent = (data) => this.checkTraps('onPyreSpent', data);
        
        GameEvents.on('onDamageTaken', this._trapListeners.onDamageTaken);
        GameEvents.on('onDeath', this._trapListeners.onDeath);
        GameEvents.on('onSummon', this._trapListeners.onSummon);
        GameEvents.on('onAttackDeclared', this._trapListeners.onAttackDeclared);
        GameEvents.on('onHit', this._trapListeners.onHit);
        GameEvents.on('onSpellCast', this._trapListeners.onSpellCast);
        GameEvents.on('onTurnStart', this._trapListeners.onTurnStart);
        GameEvents.on('onPyreSpent', this._trapListeners.onPyreSpent);
    }
    
    checkTraps(eventType, eventData) {
        for (let row = 0; row < 2; row++) {
            const trap = this.playerTraps[row];
            if (trap && trap.triggerEvent === eventType) {
                if (this.shouldTriggerTrap(trap, 'player', eventData)) {
                    this.queueTrapTrigger('player', row, eventData);
                }
            }
        }
        for (let row = 0; row < 2; row++) {
            const trap = this.enemyTraps[row];
            if (trap && trap.triggerEvent === eventType) {
                if (this.shouldTriggerTrap(trap, 'enemy', eventData)) {
                    this.queueTrapTrigger('enemy', row, eventData);
                }
            }
        }
    }
    
    shouldTriggerTrap(trap, trapOwner, eventData) {
        if (!trap.triggerCondition) return true;
        return trap.triggerCondition(trap, trapOwner, eventData, this);
    }
    
    queueTrapTrigger(owner, row, eventData) {
        const trap = (owner === 'player' ? this.playerTraps : this.enemyTraps)[row];
        if (!trap) return;
        if (!window.pendingTraps) window.pendingTraps = [];
        
        // Prevent duplicate trap triggers
        const trapKey = `${owner}-trap-${row}`;
        const alreadyQueued = window.pendingTraps.some(p => p.owner === owner && p.row === row);
        const alreadyAnimating = window.animatingTraps?.has(trapKey);
        if (alreadyQueued || alreadyAnimating) return;
        
        window.pendingTraps.push({ owner, row, trap, eventData });
        if (!window.processingTraps) {
            window.processingTraps = true;
            setTimeout(() => processTrapQueue(), 50);
        }
    }
    
    triggerTrap(owner, row, eventData) {
        const traps = owner === 'player' ? this.playerTraps : this.enemyTraps;
        const trap = traps[row];
        if (!trap) return;
        GameEvents.emit('onTrapTriggered', { trap, owner, row, triggerEvent: eventData });
        if (trap.effect) trap.effect(this, owner, row, eventData);
        traps[row] = null;
    }
    
    setTrap(owner, row, trapCard) {
        const traps = owner === 'player' ? this.playerTraps : this.enemyTraps;
        if (row >= 2 || traps[row] !== null) return false;
        traps[row] = { ...trapCard, owner, row, faceDown: true };
        console.log('[Trap] Set trap:', traps[row].key, 'triggerType:', traps[row].triggerType, 'owner:', owner, 'row:', row);
        console.log('[Trap] Full trap object:', JSON.stringify(traps[row], null, 2));
        GameEvents.emit('onTrapSet', { trap: traps[row], owner, row });
        return true;
    }
    
    getTrap(owner, row) {
        return (owner === 'player' ? this.playerTraps : this.enemyTraps)[row];
    }
    
    getValidTrapSlots(owner) {
        const traps = owner === 'player' ? this.playerTraps : this.enemyTraps;
        const slots = [];
        for (let r = 0; r < 2; r++) {
            if (traps[r] === null) slots.push({ row: r });
        }
        return slots;
    }
    
    // Cost modifier system - checks supports for cost modifiers
    getModifiedCost(card, owner) {
        let cost = card.cost || 0;
        const field = owner === 'player' ? this.playerField : this.enemyField;
        const supportCol = this.getSupportCol(owner);
        
        // Check all supports for cost modifiers
        for (let r = 0; r < 3; r++) {
            const support = field[supportCol][r];
            if (support?.trapCostModifier && card.type === 'trap') {
                cost += support.trapCostModifier;
            }
            if (support?.auraCostModifier && card.type === 'aura') {
                cost += support.auraCostModifier;
            }
            if (support?.burstCostModifier && card.type === 'burst') {
                cost += support.burstCostModifier;
            }
            if (support?.cryptidCostModifier && card.type === 'cryptid') {
                cost += support.cryptidCostModifier;
            }
        }
        
        return Math.max(0, cost);
    }
    
    // Get enemy's modified cost (for cards that affect opponent)
    getEnemyModifiedCost(card, owner) {
        let cost = card.cost || 0;
        const enemyOwner = owner === 'player' ? 'enemy' : 'player';
        const field = enemyOwner === 'player' ? this.playerField : this.enemyField;
        const supportCol = this.getSupportCol(enemyOwner);
        
        // Check all enemy supports for cost modifiers that affect us
        for (let r = 0; r < 3; r++) {
            const support = field[supportCol][r];
            if (support?.enemyTrapCostModifier && card.type === 'trap') {
                cost += support.enemyTrapCostModifier;
            }
        }
        
        return Math.max(0, cost);
    }
    
    // Check if a trap is immune to destruction (based on support abilities)
    isTrapImmune(owner, row) {
        const field = owner === 'player' ? this.playerField : this.enemyField;
        const supportCol = this.getSupportCol(owner);
        
        // Check if any support protects traps on their side
        for (let r = 0; r < 3; r++) {
            const support = field[supportCol][r];
            if (support?.protectsTraps) {
                // If support protects traps on same row or all rows
                if (support.protectsTrapsRow === 'all' || support.protectsTrapsRow === row || support.row === row) {
                    return true;
                }
            }
        }
        return false;
    }
    
    // Evolution from hand or deck
    evolveFromSource(owner, targetKey, source = 'field') {
        const deck = owner === 'player' ? this.deck : this.enemyDeck;
        const hand = owner === 'player' ? this.playerHand : this.enemyHand;
        const kindling = owner === 'player' ? this.playerKindling : this.enemyKindling;
        
        let evolvedCard = null;
        let sourceLocation = null;
        
        // Look for card that evolves from targetKey
        // Check hand first
        const handIndex = hand.findIndex(c => c.evolvesFrom === targetKey);
        if (handIndex !== -1) {
            evolvedCard = hand.splice(handIndex, 1)[0];
            sourceLocation = 'hand';
        }
        
        // Check deck if not found in hand
        if (!evolvedCard) {
            const deckIndex = deck.findIndex(c => c.evolvesFrom === targetKey);
            if (deckIndex !== -1) {
                evolvedCard = deck.splice(deckIndex, 1)[0];
                sourceLocation = 'deck';
            }
        }
        
        // Check kindling pool
        if (!evolvedCard) {
            const kindlingIndex = kindling.findIndex(c => c.evolvesFrom === targetKey);
            if (kindlingIndex !== -1) {
                evolvedCard = kindling.splice(kindlingIndex, 1)[0];
                sourceLocation = 'kindling';
            }
        }
        
        return { card: evolvedCard, source: sourceLocation };
    }
    
    // Apply destroyer damage (overflow to support)
    applyDestroyerDamage(attacker, target, overkillDamage) {
        if (!attacker.hasDestroyer || overkillDamage <= 0) return;
        
        const support = this.getSupport(target);
        if (support) {
            const hpBefore = support.currentHp;
            support.currentHp -= overkillDamage;
            GameEvents.emit('onDestroyerDamage', { 
                attacker, target, support, damage: overkillDamage,
                hpBefore, hpAfter: support.currentHp 
            });
            
            // Queue destroyer animation
            if (typeof queueAbilityAnimation !== 'undefined') {
                queueAbilityAnimation({
                    type: 'abilityDamage',
                    source: attacker,
                    target: support,
                    damage: overkillDamage,
                    message: `💥 Destroyer: ${overkillDamage} damage pierces to ${support.name}!`
                });
            }
            
            if (support.currentHp <= 0) {
                support.killedBy = 'destroyer';
                support.killedBySource = attacker;
                this.killCryptid(support, attacker.owner);
            }
        }
    }
    
    isFieldEmpty(owner) {
        const field = owner === 'player' ? this.playerField : this.enemyField;
        for (let col = 0; col < 2; col++) {
            for (let row = 0; row < 3; row++) {
                if (field[col][row]) return false;
            }
        }
        return true;
    }

    // Status Effects
    applyBurn(cryptid) {
        if (!cryptid) return false;
        const wasAlreadyBurning = cryptid.burnTurns > 0;
        cryptid.burnTurns = 3;
        GameEvents.emit('onStatusApplied', { status: 'burn', cryptid, owner: cryptid.owner, refreshed: wasAlreadyBurning });
        return true;
    }
    
    // Legacy: applyStun now redirects to applyParalyze
    applyStun(cryptid) {
        return this.applyParalyze(cryptid);
    }
    
    applyToxic(owner, col, row) {
        const toxicTiles = owner === 'player' ? this.playerToxicTiles : this.enemyToxicTiles;
        const wasAlreadyToxic = toxicTiles[col][row] > 0;
        toxicTiles[col][row] = 3;
        GameEvents.emit('onToxicApplied', { owner, col, row, refreshed: wasAlreadyToxic });
        return true;
    }
    
    isTileToxic(owner, col, row) {
        const toxicTiles = owner === 'player' ? this.playerToxicTiles : this.enemyToxicTiles;
        return toxicTiles[col][row] > 0;
    }
    
    // Helper method for cards - checks if a cryptid is standing on a toxic tile
    isInToxicTile(cryptid) {
        if (!cryptid || cryptid.col === undefined || cryptid.row === undefined) return false;
        return this.isTileToxic(cryptid.owner, cryptid.col, cryptid.row);
    }
    
    applyCalamity(cryptid, count = 3) {
        if (!cryptid || cryptid.calamityCounters > 0) return false;
        cryptid.calamityCounters = count;
        cryptid.hadCalamity = true;
        GameEvents.emit('onStatusApplied', { status: 'calamity', cryptid, owner: cryptid.owner, count });
        return true;
    }
    
    // Paralyze - prevents untap on owner's next turn, then clears
    applyParalyze(cryptid) {
        if (!cryptid || cryptid.paralyzed) return false;
        cryptid.paralyzed = true;
        cryptid.paralyzeTurns = 1; // Skip exactly 1 untap phase
        cryptid.tapped = true;
        cryptid.canAttack = false;
        console.log(`[Paralyze] Applied to ${cryptid.name} (${cryptid.owner}): will skip 1 untap`);
        GameEvents.emit('onStatusApplied', { status: 'paralyze', cryptid, owner: cryptid.owner });
        return true;
    }
    
    // Bleed - 2x damage from attacks, lasts 3 turns
    applyBleed(cryptid) {
        if (!cryptid) return false;
        const wasAlreadyBleeding = cryptid.bleedTurns > 0;
        cryptid.bleedTurns = 3;
        GameEvents.emit('onStatusApplied', { status: 'bleed', cryptid, owner: cryptid.owner, refreshed: wasAlreadyBleeding });
        return true;
    }
    
    // Curse - each token reduces ATK by 1 (min 0), cleanses 1 per turn
    applyCurse(cryptid, tokens = 1) {
        if (!cryptid || cryptid.curseImmune) return false;
        cryptid.curseTokens = (cryptid.curseTokens || 0) + tokens;
        GameEvents.emit('onStatusApplied', { status: 'curse', cryptid, owner: cryptid.owner, tokens, totalTokens: cryptid.curseTokens });
        return true;
    }
    
    // Get effective ATK reduction from curse tokens
    getCurseAtkReduction(cryptid) {
        if (!cryptid || !cryptid.curseTokens) return 0;
        return cryptid.curseTokens;
    }
    
    // Process curse at turn start - cleanse 1 token
    processCurse(owner) {
        const field = owner === 'player' ? this.playerField : this.enemyField;
        for (let c = 0; c < 2; c++) {
            for (let r = 0; r < 3; r++) {
                const cryptid = field[c][r];
                if (cryptid && cryptid.curseTokens > 0) {
                    cryptid.curseTokens--;
                    GameEvents.emit('onCurseCleanse', { cryptid, owner, tokensRemaining: cryptid.curseTokens });
                    if (cryptid.curseTokens <= 0) {
                        GameEvents.emit('onStatusWearOff', { status: 'curse', cryptid, owner });
                    }
                }
            }
        }
    }
    
    // Protection - blocks next hit completely
    applyProtection(cryptid, charges = 1) {
        if (!cryptid) return false;
        cryptid.protectionCharges = (cryptid.protectionCharges || 0) + charges;
        cryptid.damageReduction = 999;
        cryptid.blockFirstHit = true;
        GameEvents.emit('onStatusApplied', { status: 'protection', cryptid, owner: cryptid.owner, charges });
        return true;
    }
    
    // Remove one protection charge
    removeProtection(cryptid, amount = 1) {
        if (!cryptid || !cryptid.protectionCharges) return false;
        cryptid.protectionCharges = Math.max(0, cryptid.protectionCharges - amount);
        if (cryptid.protectionCharges === 0) {
            cryptid.damageReduction = 0;
            cryptid.blockFirstHit = false;
        }
        GameEvents.emit('onProtectionRemoved', { cryptid, owner: cryptid.owner, remaining: cryptid.protectionCharges });
        return true;
    }
    
    // Cleanse - remove all negative status effects
    cleanse(cryptid) {
        if (!cryptid) return { cleansed: false, count: 0 };
        let count = 0;
        
        if (cryptid.burnTurns > 0) { cryptid.burnTurns = 0; count++; }
        if (cryptid.paralyzed) { cryptid.paralyzed = false; cryptid.paralyzeTurns = 0; count++; }
        if (cryptid.bleedTurns > 0) { cryptid.bleedTurns = 0; count++; }
        if (cryptid.calamityCounters > 0) { cryptid.calamityCounters = 0; count++; }
        
        if (count > 0) {
            GameEvents.emit('onCleanse', { cryptid, owner: cryptid.owner, count });
        }
        return { cleansed: count > 0, count };
    }
    
    // Check if cryptid has any status ailment
    hasStatusAilment(cryptid) {
        if (!cryptid) return false;
        return cryptid.burnTurns > 0 || cryptid.paralyzed || 
               cryptid.bleedTurns > 0 || cryptid.calamityCounters > 0 ||
               cryptid.curseTokens > 0;
    }
    
    // Get all status ailments on a cryptid
    getStatusAilments(cryptid) {
        if (!cryptid) return [];
        const ailments = [];
        if (cryptid.burnTurns > 0) ailments.push('burn');
        if (cryptid.paralyzed) ailments.push('paralyze');
        if (cryptid.bleedTurns > 0) ailments.push('bleed');
        if (cryptid.calamityCounters > 0) ailments.push('calamity');
        if (cryptid.curseTokens > 0) ailments.push('curse');
        return ailments;
    }
    
    // Copy a random status ailment from source to target
    copyRandomAilment(source, target) {
        if (!source || !target) return false;
        const ailments = this.getStatusAilments(source);
        if (ailments.length === 0) return false;
        
        const ailment = ailments[Math.floor(Math.random() * ailments.length)];
        switch (ailment) {
            case 'burn': return this.applyBurn(target);
            case 'paralyze': return this.applyParalyze(target);
            case 'bleed': return this.applyBleed(target);
            case 'calamity': return this.applyCalamity(target, source.calamityCounters);
            case 'curse': return this.applyCurse(target, source.curseTokens);
        }
        return false;
    }
    
    // ==================== POSITION HELPERS ====================
    
    // Get combatant for a support cryptid
    getCombatant(cryptid) {
        if (!cryptid) return null;
        const { owner, row } = cryptid;
        const combatCol = this.getCombatCol(owner);
        const supportCol = this.getSupportCol(owner);
        
        // If cryptid is in support, return the combat cryptid in same row
        if (cryptid.col === supportCol) {
            const combatant = this.getFieldCryptid(owner, combatCol, row);
            console.log('[getCombatant] cryptid:', cryptid.name, 'col:', cryptid.col, 'supportCol:', supportCol, 'combatCol:', combatCol, 'row:', row, 'found:', combatant?.name);
            return combatant;
        }
        console.log('[getCombatant] cryptid:', cryptid.name, 'col:', cryptid.col, 'is NOT in supportCol:', supportCol);
        return null;
    }
    
    // Get support for a combat cryptid
    getSupport(cryptid) {
        if (!cryptid) return null;
        const { owner, row } = cryptid;
        const combatCol = this.getCombatCol(owner);
        const supportCol = this.getSupportCol(owner);
        
        // If cryptid is in combat, return the support cryptid in same row
        if (cryptid.col === combatCol) {
            const support = this.getFieldCryptid(owner, supportCol, row);
            console.log('[getSupport] cryptid:', cryptid.name, 'col:', cryptid.col, 'combatCol:', combatCol, 'supportCol:', supportCol, 'row:', row, 'found:', support?.name);
            return support;
        }
        console.log('[getSupport] cryptid:', cryptid.name, 'col:', cryptid.col, 'is NOT in combatCol:', combatCol);
        return null;
    }
    
    // Check if cryptid is in combat position
    isInCombat(cryptid) {
        if (!cryptid) return false;
        return cryptid.col === this.getCombatCol(cryptid.owner);
    }
    
    // Check if cryptid is in support position
    isInSupport(cryptid) {
        if (!cryptid) return false;
        return cryptid.col === this.getSupportCol(cryptid.owner);
    }
    
    // Get diagonal enemies (across the field)
    getDiagonalEnemies(cryptid) {
        if (!cryptid) return [];
        const enemyOwner = cryptid.owner === 'player' ? 'enemy' : 'player';
        const enemyField = enemyOwner === 'player' ? this.playerField : this.enemyField;
        const diagonals = [];
        
        const diagRows = [cryptid.row - 1, cryptid.row + 1].filter(r => r >= 0 && r < 3);
        for (const r of diagRows) {
            for (let c = 0; c < 2; c++) {
                const enemy = enemyField[c][r];
                if (enemy) diagonals.push(enemy);
            }
        }
        return diagonals;
    }
    
    // Get cryptid directly across (enemy combatant in same row) - single target
    getEnemyCombatantAcross(cryptid) {
        if (!cryptid) return null;
        const enemyOwner = cryptid.owner === 'player' ? 'enemy' : 'player';
        const enemyCombatCol = this.getCombatCol(enemyOwner);
        return this.getFieldCryptid(enemyOwner, enemyCombatCol, cryptid.row);
    }
    
    // Get ALL cryptids across (both enemy combatant AND support in same row)
    getCryptidsAcross(cryptid) {
        if (!cryptid) return [];
        const enemyOwner = cryptid.owner === 'player' ? 'enemy' : 'player';
        const enemyCombatCol = this.getCombatCol(enemyOwner);
        const enemySupportCol = this.getSupportCol(enemyOwner);
        const across = [];
        
        const combatant = this.getFieldCryptid(enemyOwner, enemyCombatCol, cryptid.row);
        if (combatant) across.push(combatant);
        
        const support = this.getFieldCryptid(enemyOwner, enemySupportCol, cryptid.row);
        if (support) across.push(support);
        
        return across;
    }
    
    // Legacy alias - returns single combatant for backward compatibility
    getCryptidAcross(cryptid) {
        return this.getEnemyCombatantAcross(cryptid);
    }
    
    // Get adjacent cryptids (same owner, above/below)
    getAdjacentAllies(cryptid) {
        if (!cryptid) return [];
        const { owner, col, row } = cryptid;
        const adjacent = [];
        
        if (row > 0) {
            const above = this.getFieldCryptid(owner, col, row - 1);
            if (above) adjacent.push(above);
        }
        if (row < 2) {
            const below = this.getFieldCryptid(owner, col, row + 1);
            if (below) adjacent.push(below);
        }
        return adjacent;
    }
    
    // Get adjacent enemies (above/below in enemy combat column)
    getAdjacentEnemies(target) {
        if (!target) return [];
        const { owner, row } = target;
        const enemyOwner = owner === 'player' ? 'enemy' : 'player';
        const adjacent = [];
        
        // Check both columns
        for (let c = 0; c < 2; c++) {
            if (row > 0) {
                const above = this.getFieldCryptid(enemyOwner, c, row - 1);
                if (above) adjacent.push(above);
            }
            if (row < 2) {
                const below = this.getFieldCryptid(enemyOwner, c, row + 1);
                if (below) adjacent.push(below);
            }
        }
        return adjacent;
    }
    
    // Get behind enemy (support position)
    getEnemyBehind(target) {
        if (!target) return null;
        const enemySupportCol = this.getSupportCol(target.owner);
        return this.getFieldCryptid(target.owner, enemySupportCol, target.row);
    }
    
    // Check if two cryptids are on the same side (left or right) of the field
    areOnSameSide(cryptid1, cryptid2) {
        if (!cryptid1 || !cryptid2) return false;
        // Same owner and same column
        return cryptid1.owner === cryptid2.owner && cryptid1.col === cryptid2.col;
    }
    
    // Check if cryptid is on left side of its field
    isOnLeftSide(cryptid) {
        if (!cryptid) return false;
        // For player: col 0 is support (left), col 1 is combat (right)
        // For enemy: col 1 is support (left from their perspective), col 0 is combat (right)
        // We'll define "left side" as rows 0-1 (top two rows)
        return cryptid.row <= 1;
    }
    
    // Remove one random aura from cryptid
    removeRandomAura(cryptid) {
        if (!cryptid || !cryptid.auras || cryptid.auras.length === 0) return null;
        const index = Math.floor(Math.random() * cryptid.auras.length);
        const removed = cryptid.auras.splice(index, 1)[0];
        
        if (removed.atkBonus) cryptid.currentAtk -= removed.atkBonus;
        if (removed.hpBonus) {
            cryptid.maxHp -= removed.hpBonus;
            cryptid.currentHp = Math.min(cryptid.currentHp, cryptid.maxHp);
        }
        
        GameEvents.emit('onAuraRemoved', { cryptid, aura: removed, owner: cryptid.owner });
        return removed;
    }

    applyLatch(attacker, target) {
        if (!attacker || !target || attacker.latchedTo) return false;
        attacker.latchedTo = { owner: target.owner, col: target.col, row: target.row };
        target.latchedBy = { owner: attacker.owner, col: attacker.col, row: attacker.row };
        GameEvents.emit('onLatch', { attacker, target, attackerOwner: attacker.owner, targetOwner: target.owner });
        return true;
    }
    
    removeLatch(cryptid) {
        if (!cryptid) return;
        if (cryptid.latchedTo) {
            const target = this.getFieldCryptid(cryptid.latchedTo.owner, cryptid.latchedTo.col, cryptid.latchedTo.row);
            if (target && target.latchedBy) delete target.latchedBy;
            delete cryptid.latchedTo;
        }
        if (cryptid.latchedBy) {
            const attacker = this.getFieldCryptid(cryptid.latchedBy.owner, cryptid.latchedBy.col, cryptid.latchedBy.row);
            if (attacker && attacker.latchedTo) delete attacker.latchedTo;
            delete cryptid.latchedBy;
        }
    }
    
    getLatchTarget(cryptid) {
        if (!cryptid?.latchedTo) return null;
        return this.getFieldCryptid(cryptid.latchedTo.owner, cryptid.latchedTo.col, cryptid.latchedTo.row);
    }
    
    processBurnDamage(owner) {
        const field = owner === 'player' ? this.playerField : this.enemyField;
        const deaths = [];
        for (let c = 0; c < 2; c++) {
            for (let r = 0; r < 3; r++) {
                const cryptid = field[c][r];
                if (cryptid && cryptid.burnTurns > 0) {
                    cryptid.currentHp -= 1;
                    cryptid.burnTurns--;
                    GameEvents.emit('onBurnDamage', { cryptid, owner, damage: 1, turnsRemaining: cryptid.burnTurns });
                    // Use getEffectiveHp to consider support HP pooling for combatants
                    if (this.getEffectiveHp(cryptid) <= 0) deaths.push({ cryptid, col: c, row: r });
                }
            }
        }
        return deaths;
    }
    
    // Legacy: processStun now does nothing (stun consolidated into paralyze)
    processStun(cryptid) {
        return false;
    }
    
    processToxicTiles(owner) {
        const toxicTiles = owner === 'player' ? this.playerToxicTiles : this.enemyToxicTiles;
        for (let c = 0; c < 2; c++) {
            for (let r = 0; r < 3; r++) {
                if (toxicTiles[c][r] > 0) {
                    toxicTiles[c][r]--;
                    if (toxicTiles[c][r] === 0) {
                        GameEvents.emit('onToxicFade', { owner, col: c, row: r });
                    }
                }
            }
        }
    }
    
    processCalamity(owner) {
        const field = owner === 'player' ? this.playerField : this.enemyField;
        const deaths = [];
        for (let c = 0; c < 2; c++) {
            for (let r = 0; r < 3; r++) {
                const cryptid = field[c][r];
                if (cryptid && cryptid.calamityCounters > 0) {
                    cryptid.calamityCounters--;
                    GameEvents.emit('onCalamityTick', { cryptid, owner, countersRemaining: cryptid.calamityCounters });
                    if (cryptid.calamityCounters === 0 && cryptid.hadCalamity) {
                        deaths.push({ cryptid, col: c, row: r });
                        GameEvents.emit('onCalamityDeath', { cryptid, owner });
                    }
                }
            }
        }
        return deaths;
    }
    
    processBleed(owner) {
        const field = owner === 'player' ? this.playerField : this.enemyField;
        for (let c = 0; c < 2; c++) {
            for (let r = 0; r < 3; r++) {
                const cryptid = field[c][r];
                if (cryptid && cryptid.bleedTurns > 0) {
                    cryptid.bleedTurns--;
                    if (cryptid.bleedTurns === 0) {
                        GameEvents.emit('onStatusWearOff', { status: 'bleed', cryptid, owner });
                    }
                }
            }
        }
    }
    
    processParalyze(owner) {
        // Paralyze is now handled inline with the untap logic in startTurn
        // This function is kept for backwards compatibility but does nothing
        // The untap logic decrements paralyzeTurns and clears the flag at the right time
    }
    
    getStatusIcons(cryptid) {
        const icons = [];
        if (cryptid.burnTurns > 0) icons.push('🔥');
        if (cryptid.paralyzed) icons.push('⚡');
        if (cryptid.bleedTurns > 0) icons.push('🩸');
        if (cryptid.curseTokens > 0) icons.push(`🔮${cryptid.curseTokens}`);
        if (cryptid.calamityCounters > 0) icons.push(`💀${cryptid.calamityCounters}`);
        if (cryptid.protectionCharges > 0) icons.push(`🛡️${cryptid.protectionCharges > 1 ? cryptid.protectionCharges : ''}`);
        if (cryptid.hasFocus) icons.push('🎯');
        if (cryptid.latchedTo || cryptid.latchedBy) icons.push('🔗');
        if (cryptid.auras?.length > 0) icons.push('✨');
        if (cryptid.hasDestroyer) icons.push('💥');
        return icons;
    }
    
    // Aura System
    applyAura(cryptid, auraCard) {
        if (!cryptid || !auraCard) return false;
        if (!cryptid.auras) cryptid.auras = [];
        cryptid.auras.push({
            key: auraCard.key, name: auraCard.name, sprite: auraCard.sprite,
            atkBonus: auraCard.atkBonus || 0, hpBonus: auraCard.hpBonus || 0,
            onAttackBonus: auraCard.onAttackBonus || null
        });
        if (auraCard.atkBonus) cryptid.currentAtk += auraCard.atkBonus;
        if (auraCard.hpBonus) {
            cryptid.currentHp += auraCard.hpBonus;
            cryptid.maxHp += auraCard.hpBonus;
        }
        // Call onApply callback if it exists
        if (auraCard.onApply) {
            GameEvents.emit('onCardCallback', { type: 'onApply', card: auraCard, owner: cryptid.owner, target: cryptid, col: cryptid.col, row: cryptid.row });
            auraCard.onApply(auraCard, cryptid, this);
        }
        GameEvents.emit('onAuraApplied', { cryptid, aura: auraCard, owner: cryptid.owner });
        return true;
    }
    
    getAuraAttackBonus(attacker, target) {
        if (!attacker?.auras) return 0;
        let bonus = 0;
        for (const aura of attacker.auras) {
            if (aura.onAttackBonus) bonus += aura.onAttackBonus(aura, attacker, target, this);
        }
        return bonus;
    }
    
    getValidAuraTargets(owner) {
        const targets = [];
        const field = owner === 'player' ? this.playerField : this.enemyField;
        for (let c = 0; c < 2; c++) {
            for (let r = 0; r < 3; r++) {
                const cryptid = field[c][r];
                if (cryptid) targets.push({ owner, col: c, row: r, cryptid });
            }
        }
        return targets;
    }
    
    // Pyre Card System
    canPlayPyreCard(owner) {
        const played = owner === 'player' ? this.playerPyreCardPlayedThisTurn : this.enemyPyreCardPlayedThisTurn;
        return !played && (this.phase === 'conjure1' || this.phase === 'conjure2');
    }
    
    playPyreCard(owner, pyreCard) {
        if (!this.canPlayPyreCard(owner)) return false;
        if (owner === 'player') this.playerPyreCardPlayedThisTurn = true;
        else this.enemyPyreCardPlayedThisTurn = true;
        const result = pyreCard.effect(this, owner);
        GameEvents.emit('onPyreCardPlayed', { owner, card: pyreCard, pyreGained: result?.pyreGained || 0, details: result });
        return result;
    }

    drawCard(owner, source = 'normal') {
        const deck = owner === 'player' ? this.deck : this.enemyDeck;
        const hand = owner === 'player' ? this.playerHand : this.enemyHand;
        if (deck.length > 0 && hand.length < 20) {
            const card = deck.pop();
            card.id = Math.random().toString(36).substr(2, 9);
            hand.push(card);
            GameEvents.emit('onCardDrawn', { owner, card, handSize: hand.length, deckSize: deck.length, source });
            return card;
        }
        return null;
    }
    
    drawCards(owner, count) {
        const drawn = [];
        for (let i = 0; i < count; i++) {
            const card = this.drawCard(owner, 'effect');
            if (card) drawn.push(card);
        }
        return drawn;
    }
    
    // Trigger Snipe reveal effect - paralyze and damage enemy across
    triggerSnipeReveal(cryptid) {
        const owner = cryptid.owner;
        const enemyOwner = owner === 'player' ? 'enemy' : 'player';
        const enemyCombatant = this.getEnemyCombatantAcross(cryptid);
        
        GameEvents.emit('onSnipeReveal', { cryptid, owner });
        
        // Queue reveal animation
        if (typeof queueAbilityAnimation !== 'undefined') {
            queueAbilityAnimation({
                type: 'buff',
                target: cryptid,
                message: `👁️ ${cryptid.name} reveals itself!`
            });
        }
        
        if (enemyCombatant) {
            // Paralyze enemy combatant
            this.applyParalyze(enemyCombatant);
            
            // Deal 2 damage
            enemyCombatant.currentHp -= 2;
            GameEvents.emit('onSnipeDamage', { source: cryptid, target: enemyCombatant, damage: 2 });
            
            // Queue damage animation
            if (typeof queueAbilityAnimation !== 'undefined') {
                queueAbilityAnimation({
                    type: 'abilityDamage',
                    source: cryptid,
                    target: enemyCombatant,
                    damage: 2,
                    message: `⚡ ${enemyCombatant.name} paralyzed & takes 2 damage!`
                });
            }
            
            // Use getEffectiveHp to properly consider support HP pooling
            if (this.getEffectiveHp(enemyCombatant) <= 0) {
                enemyCombatant.killedBy = 'snipe';
                enemyCombatant.killedBySource = cryptid;
                this.killCryptid(enemyCombatant, owner);
            }
        }
    }

    getFieldCryptid(owner, col, row) {
        const field = owner === 'player' ? this.playerField : this.enemyField;
        return field[col]?.[row] || null;
    }

    setFieldCryptid(owner, col, row, cryptid) {
        const field = owner === 'player' ? this.playerField : this.enemyField;
        field[col][row] = cryptid;
    }

    getSupportCol(owner) { return owner === 'player' ? 0 : 1; }
    getCombatCol(owner) { return owner === 'player' ? 1 : 0; }

    getEffectiveStats(cryptid) {
        if (!cryptid) return null;
        const { owner, col, row } = cryptid;
        const combatCol = this.getCombatCol(owner);
        const supportCol = this.getSupportCol(owner);
        let effectiveAtk = cryptid.currentAtk - (cryptid.atkDebuff || 0) - (cryptid.curseTokens || 0);
        if (col === combatCol) {
            const support = this.getFieldCryptid(owner, supportCol, row);
            if (support) {
                effectiveAtk += support.currentAtk - (support.curseTokens || 0);
                cryptid.supportHpBonus = support.currentHp;
            }
        }
        return { atk: Math.max(0, effectiveAtk), hp: cryptid.currentHp, maxHp: cryptid.maxHp };
    }

    summonCryptid(owner, col, row, cardData) {
        const field = owner === 'player' ? this.playerField : this.enemyField;
        if (field[col][row] !== null) return false;
        const supportCol = this.getSupportCol(owner);
        const combatCol = this.getCombatCol(owner);
        
        const cryptid = {
            ...cardData, owner, col, row,
            currentHp: cardData.hp, maxHp: cardData.hp,
            currentAtk: cardData.atk, baseAtk: cardData.atk, baseHp: cardData.hp,
            tapped: false, canAttack: true, extraTapTurns: 0,
            evolutionChain: cardData.evolutionChain || [cardData.key],
            evolvedThisTurn: false, justSummoned: true,
            burnTurns: 0, stunned: false, paralyzed: false, paralyzeTurns: 0,
            bleedTurns: 0, protectionCharges: 0, curseTokens: 0,
            latchedTo: null, latchedBy: null, auras: [],
            attackedThisTurn: false, restedThisTurn: false
        };
        field[col][row] = cryptid;
        
        if (cryptid.onSummon) {
            GameEvents.emit('onCardCallback', { type: 'onSummon', card: cryptid, owner, col, row });
            cryptid.onSummon(cryptid, owner, this);
        }
        if (col === supportCol && cryptid.onSupport) {
            GameEvents.emit('onCardCallback', { type: 'onSupport', card: cryptid, owner, col, row });
            cryptid.onSupport(cryptid, owner, this);
        }
        GameEvents.emit('onSummon', { owner, cryptid, col, row, isSupport: col === supportCol, isKindling: cardData.isKindling || false });
        
        // Trigger onEnterCombat if summoned to combat position
        if (col === combatCol) {
            if (cryptid.onCombat) {
                GameEvents.emit('onCardCallback', { type: 'onCombat', card: cryptid, owner, col, row });
                cryptid.onCombat(cryptid, owner, this);
            }
            if (cryptid.onEnterCombat) {
                GameEvents.emit('onCardCallback', { type: 'onEnterCombat', card: cryptid, owner, col, row });
                cryptid.onEnterCombat(cryptid, owner, this);
            }
            GameEvents.emit('onEnterCombat', { cryptid, owner, row, source: 'summon' });
            
            // Re-apply support abilities from support in same row (e.g., Shadow Person's noTapOnAttack)
            const existingSupport = this.getFieldCryptid(owner, supportCol, row);
            if (existingSupport?.onSupport && !this.isSupportNegated(existingSupport)) {
                GameEvents.emit('onCardCallback', { type: 'onSupport', card: existingSupport, owner, col: supportCol, row, reason: 'combatantSummoned', combatant: cryptid });
                existingSupport.onSupport(existingSupport, owner, this);
            }
            
            // Check if enemy has cryptid across with onEnemySummonedAcross (e.g., Thunderbird)
            const enemyOwner = owner === 'player' ? 'enemy' : 'player';
            const enemyCombatCol = this.getCombatCol(enemyOwner);
            const enemyField = enemyOwner === 'player' ? this.playerField : this.enemyField;
            const enemyAcross = enemyField[enemyCombatCol][row];
            if (enemyAcross?.onEnemySummonedAcross) {
                GameEvents.emit('onCardCallback', { type: 'onEnemySummonedAcross', card: enemyAcross, owner: enemy, col: enemyCombatCol, row, triggerCryptid: cryptid });
                enemyAcross.onEnemySummonedAcross(enemyAcross, cryptid, this);
            }
        }
        
        // Multiplayer hook - AFTER all callbacks complete so state is final
        if (this.isMultiplayer && owner === 'player' && typeof window.multiplayerHook !== 'undefined') {
            window.multiplayerHook.onSummon(cardData, owner, col, row, cardData.foil || false);
        }
        
        return cryptid;
    }

    getValidSummonSlots(owner) {
        const field = owner === 'player' ? this.playerField : this.enemyField;
        const combatCol = this.getCombatCol(owner);
        const supportCol = this.getSupportCol(owner);
        const slots = [];
        for (let r = 0; r < 3; r++) {
            if (field[combatCol][r] === null) slots.push({ col: combatCol, row: r });
            else if (field[supportCol][r] === null) slots.push({ col: supportCol, row: r });
        }
        return slots;
    }

    calculateAttackDamage(attacker, applyToxic = true) {
        const { owner, col, row } = attacker;
        const combatCol = this.getCombatCol(owner);
        const supportCol = this.getSupportCol(owner);
        // ATK reduction from debuffs and curse tokens
        let damage = attacker.currentAtk - (attacker.atkDebuff || 0) - (attacker.curseTokens || 0);
        if (col === combatCol) {
            const support = this.getFieldCryptid(owner, supportCol, row);
            if (support) damage += support.currentAtk - (support.atkDebuff || 0) - (support.curseTokens || 0);
        }
        if (attacker.bonusDamage) damage += attacker.bonusDamage;
        if (applyToxic && this.isTileToxic(owner, col, row)) damage -= 1;
        return Math.max(0, damage);
    }

    attack(attacker, targetOwner, targetCol, targetRow) {
        const target = this.getFieldCryptid(targetOwner, targetCol, targetRow);
        if (!target) return false;
        
        // onBeforeAttack hook - can modify attacker or remove target's protection/auras
        if (attacker.onBeforeAttack) {
            GameEvents.emit('onCardCallback', { type: 'onBeforeAttack', card: attacker, owner: attacker.owner, target, col: attacker.col, row: attacker.row });
            attacker.onBeforeAttack(attacker, target, this);
        }
        
        // Check if support has onCombatantBeforeAttack (for effects like Mothman's calamity)
        const support = this.getSupport(attacker);
        if (support?.onCombatantBeforeAttack && !this.isSupportNegated(support)) {
            GameEvents.emit('onCardCallback', { type: 'onCombatantBeforeAttack', card: support, owner: attacker.owner, combatant: attacker, target, col: support.col, row: support.row });
            support.onCombatantBeforeAttack(support, attacker, target, this);
        }
        
        GameEvents.emit('onAttackDeclared', { attacker, target, attackerOwner: attacker.owner, targetOwner });
        GameEvents.emit('onTargeted', { target, targetOwner, source: attacker, sourceType: 'attack' });
        
        // Check for Terrify trap (reduces attacker ATK to 0)
        const defenderTraps = targetOwner === 'player' ? this.playerTraps : this.enemyTraps;
        for (let i = 0; i < defenderTraps.length; i++) {
            const trap = defenderTraps[i];
            if (trap?.key === 'terrify' && trap.triggerType === 'onEnemyAttack') {
                // Set ATK to 0 until end of turn
                attacker.savedAtk = attacker.currentAtk || attacker.atk;
                attacker.currentAtk = 0;
                attacker.terrified = true;
                GameEvents.emit('onTerrify', { trap, attacker, owner: targetOwner });
                GameEvents.emit('onTrapTriggered', { trap, owner: targetOwner, row: i });
                defenderTraps[i] = null; // Consume trap
                break;
            }
        }
        
        // onBeforeDefend callback - triggers before damage (e.g., Deer Woman pyre generation)
        if (target.onBeforeDefend) {
            GameEvents.emit('onCardCallback', { type: 'onBeforeDefend', card: target, owner: target.owner, attacker, col: target.col, row: target.row });
            target.onBeforeDefend(target, attacker, this);
        }
        
        // Check if attack was negated (e.g., Primal Wendigo counter-kill, Hellhound Pup protection)
        if (target.negateIncomingAttack) {
            target.negateIncomingAttack = false;
            // Check if attacker was killed during the counter (e.g., by Primal Wendigo)
            const attackerKilled = attacker.currentHp <= 0;
            
            // Still tap the attacker even if attack was negated (they still made the attack attempt)
            if (!attackerKilled) {
                const support = this.getSupport(attacker);
                const hasFocus = attacker.hasFocus || (support?.grantsFocus && !this.isSupportNegated(support));
                const preventTap = support?.preventCombatantTap || attacker.noTapOnAttack;
                
                if (attacker.canAttackAgain) {
                    attacker.canAttackAgain = false;
                } else if (hasFocus || preventTap) {
                    attacker.canAttack = false;
                } else {
                    attacker.tapped = true;
                    attacker.canAttack = false;
                }
                attacker.attackedThisTurn = true;
            }
            
            GameEvents.emit('onAttackNegated', { attacker, target, targetOwner, attackerKilled });
            return { negated: true, attackerKilled };
        }
        
        // Check if target's support has onCombatantAttacked callback
        const targetSupport = this.getSupport(target);
        if (targetSupport?.onCombatantAttacked && !this.isSupportNegated(targetSupport)) {
            GameEvents.emit('onCardCallback', { type: 'onCombatantAttacked', card: targetSupport, owner: target.owner, combatant: target, attacker, col: targetSupport.col, row: targetSupport.row });
            targetSupport.onCombatantAttacked(targetSupport, target, attacker, this);
        }
        
        // Insatiable Hunger buff is now applied in executeAttack() before attack animation
        // This prevents double-buffing while keeping the effect timing correct
        
        let damage = this.calculateAttackDamage(attacker);
        if (attacker.onCombatAttack) {
            GameEvents.emit('onCardCallback', { type: 'onCombatAttack', card: attacker, owner: attacker.owner, target, col: attacker.col, row: attacker.row });
            damage += attacker.onCombatAttack(attacker, target, this) || 0;
        }
        
        // Check if target was killed during onCombatAttack (e.g., Snipe reveal damage)
        // If so, abort the rest of the attack - target is already dead
        // Use getEffectiveHp to properly consider support HP pooling
        if (this.getEffectiveHp(target) <= 0 && target.killedBy) {
            // Still tap the attacker
            const preventTap = support?.preventCombatantTap || attacker.noTapOnAttack;
            const hasFocus = attacker.hasFocus || (support?.grantsFocus && !this.isSupportNegated(support));
            
            if (attacker.canAttackAgain) {
                attacker.canAttackAgain = false;
            } else if (hasFocus || preventTap) {
                attacker.canAttack = false;
            } else {
                attacker.tapped = true;
                attacker.canAttack = false;
            }
            attacker.attackedThisTurn = true;
            
            return { killed: true, damage: 0, protectionBlocked: false, target, killedDuringCallback: true };
        }
        damage += this.getAuraAttackBonus(attacker, target);
        if (target.paralyzed && attacker.bonusVsParalyzed) damage += attacker.bonusVsParalyzed;
        if (attacker.bonusVsAilment && this.hasStatusAilment(target)) damage += attacker.bonusVsAilment;
        
        // Double damage vs tapped/resting (Elder Vampire support)
        if (target.tapped && attacker.doubleDamageVsTapped) {
            damage *= 2;
        }
        
        // Bleed doubles attack damage
        if (target.bleedTurns > 0) {
            damage *= 2;
            GameEvents.emit('onBleedDamage', { target, attacker, owner: targetOwner });
        }
        
        // Focus ignores protection
        const hasFocus = attacker.hasFocus || (support?.grantsFocus && !this.isSupportNegated(support));
        
        let reduction = target.damageReduction || 0;
        if (target.onDefend) reduction += target.onDefend(target, attacker, this) || 0;
        
        // Focus ignores all damage reduction
        if (hasFocus) reduction = 0;
        
        const originalDamage = damage;
        damage = Math.max(0, damage - reduction);
        
        // Emit protection event if damage was reduced
        if (reduction > 0 && originalDamage > 0) {
            GameEvents.emit('onDamageReduced', { 
                target, 
                attacker, 
                originalDamage, 
                reducedDamage: damage, 
                reduction: Math.min(reduction, originalDamage),
                targetOwner,
                attackerOwner: attacker.owner
            });
        }
        
        // Focus also ignores blockFirstHit
        let protectionBlocked = false;
        if (!hasFocus && target.blockFirstHit && (target.damageReduction || 0) >= 999) {
            target.damageReduction = 0;
            target.blockFirstHit = false;
            target.protectionCharges = Math.max(0, (target.protectionCharges || 1) - 1);
            damage = 0;
            protectionBlocked = true;
            GameEvents.emit('onProtectionBlock', { target, attacker, owner: targetOwner });
        } else if ((target.damageReduction || 0) > 0 && (target.damageReduction || 0) < 999) {
            target.damageReduction = 0;
        }
        
        if (damage > 0 && this.isTileToxic(targetOwner, targetCol, targetRow)) {
            damage += 1;
            GameEvents.emit('onToxicDamage', { target, bonusDamage: 1, owner: targetOwner });
        }
        
        const hpBefore = target.currentHp;
        target.currentHp -= damage;
        
        // Mutated Rat support - triggers on ANY attack, not just damage
        // Moved outside damage > 0 check so it triggers even if attack is blocked
        if (target.mutatedRatSupport) {
            this.applyCalamity(attacker, 3);
            GameEvents.emit('onMutatedRatRetaliation', { target, attacker, calamity: 3 });
        }
        
        if (damage > 0) {
            GameEvents.emit('onDamageTaken', { target, damage, source: attacker, sourceType: 'attack', hpBefore, hpAfter: target.currentHp });
            GameEvents.emit('onHit', { attacker, target, damage, hpBefore, hpAfter: target.currentHp });
            
            // onTakeDamage callback on target
            if (target.onTakeDamage) {
                GameEvents.emit('onCardCallback', { type: 'onTakeDamage', card: target, owner: target.owner, attacker, damage, col: target.col, row: target.row });
                target.onTakeDamage(target, attacker, damage, this);
            }
            
            if (attacker.attacksApplyCalamity) this.applyCalamity(target, attacker.attacksApplyCalamity);
            if (attacker.attacksApplyParalyze) this.applyParalyze(target);
            if (attacker.attacksApplyBleed) this.applyBleed(target);
            if (attacker.attacksApplyBurn) this.applyBurn(target);
            if (attacker.attacksApplyCurse) this.applyCurse(target, attacker.attacksApplyCurse);
            
            // Track damage stats for win screen
            if (attacker.owner === 'player') {
                this.matchStats.damageDealt += damage;
            } else {
                this.matchStats.damageTaken += damage;
            }
        }
        
        // Cleave - also hit support in same row (Adult Bigfoot)
        if (attacker.hasCleave && damage > 0) {
            const supportCol = this.getSupportCol(targetOwner);
            const combatCol = this.getCombatCol(targetOwner);
            // If we attacked combatant, also hit support
            if (targetCol === combatCol) {
                const supportTarget = this.getFieldCryptid(targetOwner, supportCol, targetRow);
                if (supportTarget) {
                    supportTarget.currentHp -= damage;
                    GameEvents.emit('onCleaveDamage', { attacker, target: supportTarget, damage });
                    
                    // Queue cleave animation
                    queueAbilityAnimation({
                        type: 'cleave',
                        source: attacker,
                        target: supportTarget,
                        damage: damage,
                        message: `⚔ ${attacker.name} cleaves!`
                    });
                    
                    if (supportTarget.currentHp <= 0) {
                        supportTarget.killedBy = 'cleave';
                        supportTarget.killedBySource = attacker;
                        this.killCryptid(supportTarget, attacker.owner);
                        if (attacker.onKill) {
                            GameEvents.emit('onCardCallback', { type: 'onKill', card: attacker, owner: attacker.owner, victim: supportTarget, col: attacker.col, row: attacker.row });
                            attacker.onKill(attacker, supportTarget, this);
                        }
                        GameEvents.emit('onKill', { killer: attacker, victim: supportTarget, killerOwner: attacker.owner, victimOwner: targetOwner });
                    }
                }
            }
            // If we attacked support, also hit combatant
            else if (targetCol === supportCol) {
                const combatTarget = this.getFieldCryptid(targetOwner, combatCol, targetRow);
                if (combatTarget) {
                    combatTarget.currentHp -= damage;
                    GameEvents.emit('onCleaveDamage', { attacker, target: combatTarget, damage });
                    
                    // Queue cleave animation
                    queueAbilityAnimation({
                        type: 'cleave',
                        source: attacker,
                        target: combatTarget,
                        damage: damage,
                        message: `⚔ ${attacker.name} cleaves!`
                    });
                    
                    // Use getEffectiveHp to consider combatant's support HP pooling
                    if (this.getEffectiveHp(combatTarget) <= 0) {
                        combatTarget.killedBy = 'cleave';
                        combatTarget.killedBySource = attacker;
                        this.killCryptid(combatTarget, attacker.owner);
                        if (attacker.onKill) {
                            GameEvents.emit('onCardCallback', { type: 'onKill', card: attacker, owner: attacker.owner, victim: combatTarget, col: attacker.col, row: attacker.row });
                            attacker.onKill(combatTarget, this);
                        }
                        GameEvents.emit('onKill', { killer: attacker, victim: combatTarget, killerOwner: attacker.owner, victimOwner: targetOwner });
                    }
                }
            }
        }
        
        const effectiveHp = this.getEffectiveHp(target);
        let killed = false;
        let supportKilled = false;
        
        if (effectiveHp <= 0) {
            killed = true;
            target.killedBy = 'attack';
            target.killedBySource = attacker;
            
            // Calculate overkill damage for destroyer
            const overkillDamage = Math.abs(target.currentHp);
            
            this.killCryptid(target, attacker.owner);
            if (attacker.onKill) {
                GameEvents.emit('onCardCallback', { type: 'onKill', card: attacker, owner: attacker.owner, victim: target, col: attacker.col, row: attacker.row });
                attacker.onKill(attacker, target, this);
            }
            GameEvents.emit('onKill', { killer: attacker, victim: target, killerOwner: attacker.owner, victimOwner: targetOwner });
            
            // Heal on kill (Zombie support, etc.)
            if (attacker.healOnKill > 0) {
                const maxHp = attacker.maxHp || attacker.hp;
                const healAmount = Math.min(attacker.healOnKill, maxHp - attacker.currentHp);
                if (healAmount > 0) {
                    attacker.currentHp += healAmount;
                    GameEvents.emit('onHeal', { cryptid: attacker, amount: healAmount, source: 'healOnKill' });
                }
            }
            
            // Destroyer - overkill damage floods to support
            if (attacker.hasDestroyer && overkillDamage > 0) {
                const support = this.getFieldCryptid(targetOwner, this.getSupportCol(targetOwner), targetRow);
                if (support) {
                    const supportHpBefore = support.currentHp;
                    support.currentHp -= overkillDamage;
                    GameEvents.emit('onDestroyerDamage', { 
                        attacker, target, support, damage: overkillDamage,
                        hpBefore: supportHpBefore, hpAfter: support.currentHp 
                    });
                    
                    if (support.currentHp <= 0) {
                        supportKilled = true;
                        support.killedBy = 'destroyer';
                        support.killedBySource = attacker;
                        this.killCryptid(support, attacker.owner);
                        GameEvents.emit('onKill', { killer: attacker, victim: support, killerOwner: attacker.owner, victimOwner: targetOwner });
                    }
                }
            }
        }
        
        if (!killed && attacker.hasLatch && !attacker.latchedTo && damage > 0) {
            this.applyLatch(attacker, target);
        }
        
        GameEvents.emit('onTap', { cryptid: attacker, owner: attacker.owner, reason: 'attack' });
        
        // Check if support ability prevents tap OR if attacker has noTapOnAttack (e.g., from Shadow Person support)
        const preventTap = support?.preventCombatantTap || attacker.noTapOnAttack;
        console.log('[Attack] Tap check:', attacker.name, 'support:', support?.name, 'preventCombatantTap:', support?.preventCombatantTap, 'noTapOnAttack:', attacker.noTapOnAttack, 'hasFocus:', hasFocus, 'preventTap:', preventTap);
        
        if (attacker.canAttackAgain) {
            // Can attack again - don't tap, keep canAttack true
            attacker.canAttackAgain = false;
        } else if (hasFocus) {
            // Focus: Don't tap but can't attack again this turn
            attacker.canAttack = false;
        } else if (preventTap) {
            // No tap but can't attack again this turn (similar to focus behavior)
            attacker.canAttack = false;
        } else {
            attacker.tapped = true;
            attacker.canAttack = false;
        }
        
        // Track if combatant attacked this turn (for rest detection)
        attacker.attackedThisTurn = true;
        
        // Track unique attackers for Burial Ground pyre card
        if (!this.attackersThisTurn[attacker.owner].find(a => a.key === attacker.key)) {
            this.attackersThisTurn[attacker.owner].push({ key: attacker.key, name: attacker.name });
        }
        
        // Elder Vampire support - heal 2HP after attack
        if (attacker.elderVampireSupport) {
            const hpBefore = attacker.currentHp;
            attacker.currentHp = Math.min(attacker.maxHp, attacker.currentHp + 2);
            if (attacker.currentHp > hpBefore) {
                GameEvents.emit('onHeal', { 
                    target: attacker, 
                    amount: 2, 
                    source: attacker.elderVampireSupport, 
                    sourceType: 'elderVampireDarkGift' 
                });
            }
        }
        
        // Multi-attack - hit other enemy combatants (Weaponized Tree)
        if (attacker.hasMultiAttack && !attacker.multiAttackProcessed) {
            attacker.multiAttackProcessed = true; // Prevent recursion
            const enemyField = targetOwner === 'player' ? this.playerField : this.enemyField;
            const enemyCombatCol = this.getCombatCol(targetOwner);
            
            for (let r = 0; r < 3; r++) {
                if (r === targetRow) continue; // Skip primary target
                const otherTarget = enemyField[enemyCombatCol][r];
                if (otherTarget) {
                    // Apply same damage to other combatants
                    otherTarget.currentHp -= damage;
                    GameEvents.emit('onMultiAttackDamage', { attacker, target: otherTarget, damage });
                    
                    // Queue multi-attack animation
                    queueAbilityAnimation({
                        type: 'multiAttack',
                        source: attacker,
                        target: otherTarget,
                        damage: damage
                    });
                    
                    // Use getEffectiveHp to consider support HP pooling
                    if (this.getEffectiveHp(otherTarget) <= 0) {
                        otherTarget.killedBy = 'multiAttack';
                        this.killCryptid(otherTarget, attacker.owner);
                        if (attacker.onKill) {
                            GameEvents.emit('onCardCallback', { type: 'onKill', card: attacker, owner: attacker.owner, victim: otherTarget, col: attacker.col, row: attacker.row, isMultiAttack: true });
                            attacker.onKill(attacker, otherTarget, this);
                        }
                    }
                }
            }
            attacker.multiAttackProcessed = false;
        }
        
        return { damage, killed, protectionBlocked };
    }

    killCryptid(cryptid, killerOwner = null) {
        // Track death count BEFORE onDeath (for Wendigo 10th death check)
        const owner = cryptid.owner;
        const { col, row } = cryptid; // Extract col/row early for callbacks
        
        if (owner === 'player') this.playerDeathCount = (this.playerDeathCount || 0);
        else this.enemyDeathCount = (this.enemyDeathCount || 0);
        
        if (cryptid.onDeath) {
            GameEvents.emit('onCardCallback', { type: 'onDeath', card: cryptid, owner, col, row });
            cryptid.onDeath(cryptid, this);
        }
        
        // Check if death was prevented (e.g., Wendigo ascension)
        if (cryptid.preventDeath) {
            cryptid.preventDeath = false;
            return null;
        }
        const combatCol = this.getCombatCol(owner);
        const supportCol = this.getSupportCol(owner);
        const deathCount = cryptid.evolutionChain?.length || 1;
        
        this.removeLatch(cryptid);
        this.setFieldCryptid(owner, col, row, null);
        
        const oldDeaths = owner === 'player' ? this.playerDeaths : this.enemyDeaths;
        if (owner === 'player') {
            this.playerDeaths += deathCount;
            this.playerDeathCount += 1;
        } else {
            this.enemyDeaths += deathCount;
            this.enemyDeathCount += 1;
        }
        
        // Track deaths this turn for Rat King pyre card
        this.deathsThisTurn[owner] += deathCount;
        
        console.log('[Death] Emitting onDeath for', cryptid.name, 'killedBy:', cryptid.killedBy);
        GameEvents.emit('onDeath', { cryptid, owner, col, row, killerOwner, deathCount });
        
        // Skinwalker inherit - if combatant dies, check if support has hasInherit
        if (col === combatCol) {
            const support = this.getFieldCryptid(owner, supportCol, row);
            if (support?.hasInherit) {
                // Inherit ATK if higher than base
                const deadAtk = cryptid.currentAtk || cryptid.atk;
                let inheritedStats = false;
                if (deadAtk > (support.baseAtk || support.atk)) {
                    support.currentAtk = deadAtk;
                    inheritedStats = true;
                }
                // Inherit HP if higher than base (current HP, not max)
                const deadHp = cryptid.currentHp > 0 ? cryptid.currentHp : (cryptid.maxHp || cryptid.hp);
                if (deadHp > (support.baseHp || support.hp)) {
                    support.currentHp = deadHp;
                    support.maxHp = deadHp;
                    inheritedStats = true;
                }
                GameEvents.emit('onSkinwalkerInherit', { 
                    support, 
                    deadCombatant: cryptid, 
                    inheritedAtk: support.currentAtk, 
                    inheritedHp: support.currentHp,
                    owner 
                });
                
                // Queue inherit animation
                if (inheritedStats && typeof queueAbilityAnimation !== 'undefined') {
                    queueAbilityAnimation({
                        type: 'buff',
                        target: support,
                        message: `🎭 ${support.name} inherits ${cryptid.name}'s power!`
                    });
                }
            }
        }
        
        if (killerOwner) {
            if (owner === killerOwner) GameEvents.emit('onAllyDeath', { cryptid, owner, killerOwner });
            else GameEvents.emit('onEnemyDeath', { cryptid, owner, killerOwner });
        }
        
        GameEvents.emit('onDeathCounterChanged', {
            owner, oldValue: oldDeaths,
            newValue: owner === 'player' ? this.playerDeaths : this.enemyDeaths,
            change: deathCount
        });
        
        if (this.isFieldEmpty(owner)) GameEvents.emit('onFieldEmpty', { owner });
        
        // If a combatant dies, automatically promote the support and queue animation
        if (col === combatCol) {
            const support = this.getFieldCryptid(owner, supportCol, row);
            if (support) {
                // Call onCombatantDeath hook on support BEFORE promotion (for Sewer Alligator, etc.)
                if (support.onCombatantDeath) {
                    GameEvents.emit('onCardCallback', { type: 'onCombatantDeath', card: support, owner, combatant: cryptid, col: support.col, row });
                    support.onCombatantDeath(support, cryptid, this);
                }
                GameEvents.emit('onCombatantDeath', { combatant: cryptid, support, owner, row });
                
                // Promote the support to combat position
                this.setFieldCryptid(owner, supportCol, row, null);
                support.col = combatCol;
                this.setFieldCryptid(owner, combatCol, row, support);
                GameEvents.emit('onPromotion', { cryptid: support, owner, row, fromCol: supportCol, toCol: combatCol });
                
                // Trigger onCombat and onEnterCombat callbacks
                if (support.onCombat) {
                    GameEvents.emit('onCardCallback', { type: 'onCombat', card: support, owner, col: combatCol, row, reason: 'promotion' });
                    support.onCombat(support, owner, this);
                }
                if (support.onEnterCombat) {
                    GameEvents.emit('onCardCallback', { type: 'onEnterCombat', card: support, owner, col: combatCol, row, reason: 'promotion' });
                    support.onEnterCombat(support, owner, this);
                }
                GameEvents.emit('onEnterCombat', { cryptid: support, owner, row, source: 'promotion' });
                
                // Queue animation for UI layer
                if (!window.pendingPromotions) window.pendingPromotions = [];
                window.pendingPromotions.push({ owner, row });
            }
        } else if (col === supportCol) {
            const combatant = this.getFieldCryptid(owner, combatCol, row);
            if (combatant) combatant.checkDeathAfterSupportLoss = true;
        }
        
        this.checkGameOver();
        return { owner, col, row, deathCount };
    }
    
    // Find a card by key in hand
    findCardInHand(owner, cardKey) {
        const hand = owner === 'player' ? this.playerHand : this.enemyHand;
        return hand.find(c => c.key === cardKey) || null;
    }
    
    // Find a card by key in deck
    findCardInDeck(owner, cardKey) {
        const deck = owner === 'player' ? this.deck : this.enemyDeck;
        return deck.find(c => c.key === cardKey) || null;
    }
    
    // Remove a card from hand
    removeFromHand(owner, card) {
        const hand = owner === 'player' ? this.playerHand : this.enemyHand;
        const idx = hand.indexOf(card);
        if (idx >= 0) {
            hand.splice(idx, 1);
            return true;
        }
        return false;
    }
    
    // Remove a card from deck
    removeFromDeck(owner, card) {
        const deck = owner === 'player' ? this.deck : this.enemyDeck;
        const idx = deck.indexOf(card);
        if (idx >= 0) {
            deck.splice(idx, 1);
            return true;
        }
        return false;
    }
    
    // Evolve a cryptid in place without normal evolution requirements
    evolveInPlace(cryptid, evolutionCard, owner) {
        const { col, row } = cryptid;
        const oldChain = cryptid.evolutionChain || [cryptid.key];
        
        // Create new cryptid with evolution stats
        const evolved = {
            ...evolutionCard,
            owner, col, row,
            currentHp: evolutionCard.hp,
            maxHp: evolutionCard.hp,
            currentAtk: evolutionCard.atk,
            baseAtk: evolutionCard.atk,
            baseHp: evolutionCard.hp,
            tapped: cryptid.tapped,
            canAttack: cryptid.canAttack,
            extraTapTurns: cryptid.extraTapTurns || 0,
            evolutionChain: [...oldChain, evolutionCard.key],
            evolvedThisTurn: true,
            justSummoned: false,
            burnTurns: 0, stunned: false, paralyzed: false, paralyzeTurns: 0,
            bleedTurns: 0, protectionCharges: 0, curseTokens: 0,
            latchedTo: null, latchedBy: null, auras: [],
            attackedThisTurn: cryptid.attackedThisTurn || false,
            restedThisTurn: cryptid.restedThisTurn || false
        };
        
        this.setFieldCryptid(owner, col, row, evolved);
        
        // Call onSummon and position callbacks
        if (evolved.onSummon) {
            GameEvents.emit('onCardCallback', { type: 'onSummon', card: evolved, owner, col, row, reason: 'evolution' });
            evolved.onSummon(evolved, owner, this);
        }
        const combatCol = this.getCombatCol(owner);
        const supportCol = this.getSupportCol(owner);
        if (col === combatCol) {
            if (evolved.onCombat) {
                GameEvents.emit('onCardCallback', { type: 'onCombat', card: evolved, owner, col, row, reason: 'evolution' });
                evolved.onCombat(evolved, owner, this);
            }
            
            // Re-apply support abilities from support in same row (e.g., Shadow Person's noTapOnAttack)
            const existingSupport = this.getFieldCryptid(owner, supportCol, row);
            if (existingSupport?.onSupport && !this.isSupportNegated(existingSupport)) {
                GameEvents.emit('onCardCallback', { type: 'onSupport', card: existingSupport, owner, col: supportCol, row, reason: 'combatantEvolved', combatant: evolved });
                existingSupport.onSupport(existingSupport, owner, this);
            }
        }
        if (col === supportCol && evolved.onSupport) {
            GameEvents.emit('onCardCallback', { type: 'onSupport', card: evolved, owner, col, row, reason: 'evolution' });
            evolved.onSupport(evolved, owner, this);
        }
        
        GameEvents.emit('onEvolution', { 
            cryptid: evolved, 
            previous: cryptid, 
            owner, 
            col, 
            row,
            source: 'special'
        });
        
        return evolved;
    }

    getEffectiveHp(cryptid) {
        if (!cryptid) return 0;
        let hp = cryptid.currentHp;
        const combatCol = this.getCombatCol(cryptid.owner);
        const supportCol = this.getSupportCol(cryptid.owner);
        if (cryptid.col === combatCol) {
            const support = this.getFieldCryptid(cryptid.owner, supportCol, cryptid.row);
            if (support) hp += support.currentHp;
        }
        return hp;
    }

    checkDeath(cryptid) {
        // Use getEffectiveHp to consider support HP pooling for combatants
        if (cryptid && this.getEffectiveHp(cryptid) <= 0) return this.killCryptid(cryptid);
        return null;
    }

    promoteSupport(owner, row) {
        const combatCol = this.getCombatCol(owner);
        const supportCol = this.getSupportCol(owner);
        const combatant = this.getFieldCryptid(owner, combatCol, row);
        const support = this.getFieldCryptid(owner, supportCol, row);
        if (!combatant && support) {
            this.setFieldCryptid(owner, supportCol, row, null);
            support.col = combatCol;
            this.setFieldCryptid(owner, combatCol, row, support);
            GameEvents.emit('onPromotion', { cryptid: support, owner, row, fromCol: supportCol, toCol: combatCol });
            
            // Trigger onCombat and onEnterCombat callbacks
            if (support.onCombat) {
                support.onCombat(support, owner, this);
            }
            if (support.onEnterCombat) {
                support.onEnterCombat(support, owner, this);
            }
            GameEvents.emit('onEnterCombat', { cryptid: support, owner, row, source: 'promotion' });
            
            return support;
        }
        return null;
    }

    popRandomKindling(owner) {
        let kindling = owner === 'player' ? this.playerKindling : this.enemyKindling;
        
        // In multiplayer, if enemy kindling is empty (sync not received yet), use generic fallback
        if (this.isMultiplayer && owner === 'enemy' && kindling.length === 0) {
            console.log('[Game] Warning: Enemy kindling not synced, using fallback pool');
            // Build a fallback pool from common kindling
            if (typeof DeckBuilder !== 'undefined' && DeckBuilder.buildKindlingPool) {
                this.enemyKindling = DeckBuilder.buildKindlingPool();
                kindling = this.enemyKindling;
            }
        }
        
        if (kindling.length === 0) return null;
        const idx = Math.floor(Math.random() * kindling.length);
        return kindling.splice(idx, 1)[0];
    }

    summonKindling(owner, col, row, kindlingCard) {
        if (!kindlingCard) return null;
        const supportCol = this.getSupportCol(owner);
        const combatCol = this.getCombatCol(owner);
        const cryptid = {
            ...kindlingCard, owner, col, row,
            currentHp: kindlingCard.hp, maxHp: kindlingCard.hp,
            currentAtk: kindlingCard.atk, baseAtk: kindlingCard.atk, baseHp: kindlingCard.hp,
            tapped: false, canAttack: true, extraTapTurns: 0,
            isKindling: true, evolutionChain: [kindlingCard.key], justSummoned: true,
            burnTurns: 0, stunned: false, paralyzed: false, paralyzeTurns: 0,
            bleedTurns: 0, protectionCharges: 0, curseTokens: 0,
            latchedTo: null, latchedBy: null, auras: [],
            attackedThisTurn: false, restedThisTurn: false
        };
        this.setFieldCryptid(owner, col, row, cryptid);
        
        if (cryptid.onSummon) {
            GameEvents.emit('onCardCallback', { type: 'onSummon', card: cryptid, owner, col, row, isKindling: true });
            cryptid.onSummon(cryptid, owner, this);
        }
        if (col === supportCol && cryptid.onSupport) {
            GameEvents.emit('onCardCallback', { type: 'onSupport', card: cryptid, owner, col, row, isKindling: true });
            cryptid.onSupport(cryptid, owner, this);
        }
        // Trigger onCombat when entering combat position
        if (col === combatCol) {
            if (cryptid.onCombat) {
                GameEvents.emit('onCardCallback', { type: 'onCombat', card: cryptid, owner, col, row, isKindling: true });
                cryptid.onCombat(cryptid, owner, this);
            }
            GameEvents.emit('onEnterCombat', { cryptid, owner, row, source: 'summon' });
            
            // Re-apply support abilities from support in same row (e.g., Shadow Person's noTapOnAttack)
            const existingSupport = this.getFieldCryptid(owner, supportCol, row);
            if (existingSupport?.onSupport && !this.isSupportNegated(existingSupport)) {
                GameEvents.emit('onCardCallback', { type: 'onSupport', card: existingSupport, owner, col: supportCol, row, reason: 'kindlingSummoned', combatant: cryptid });
                existingSupport.onSupport(existingSupport, owner, this);
            }
        }
        GameEvents.emit('onSummon', { owner, cryptid, col, row, isSupport: col === supportCol, isKindling: true });
        
        // Multiplayer hook - AFTER all callbacks complete so state is final
        if (this.isMultiplayer && owner === 'player' && typeof window.multiplayerHook !== 'undefined') {
            window.multiplayerHook.onSummon(kindlingCard, owner, col, row, kindlingCard.foil || false);
        }
        
        return cryptid;
    }

    canPlayKindling(owner) {
        const kindling = owner === 'player' ? this.playerKindling : this.enemyKindling;
        const played = owner === 'player' ? this.playerKindlingPlayedThisTurn : this.enemyKindlingPlayedThisTurn;
        return kindling.length > 0 && !played && (this.phase === 'conjure1' || this.phase === 'conjure2');
    }

    getValidAttackTargets(attacker) {
        const enemyOwner = attacker.owner === 'player' ? 'enemy' : 'player';
        const enemyField = enemyOwner === 'player' ? this.playerField : this.enemyField;
        const enemyCombatCol = this.getCombatCol(enemyOwner);
        const enemySupportCol = this.getSupportCol(enemyOwner);
        const enemyKindling = enemyOwner === 'player' ? this.playerKindling : this.enemyKindling;
        const targets = [];
        const fieldEmpty = this.isFieldEmpty(enemyOwner);
        
        if (attacker.canTargetAny) {
            for (let c = 0; c < 2; c++) {
                for (let r = 0; r < 3; r++) {
                    const cryptid = enemyField[c][r];
                    if (cryptid) targets.push({ col: c, row: r, cryptid });
                }
            }
            if (fieldEmpty && enemyKindling.length > 0) {
                for (let r = 0; r < 3; r++) {
                    if (!enemyField[enemyCombatCol][r]) {
                        targets.push({ owner: enemyOwner, col: enemyCombatCol, row: r, cryptid: null, isEmptyTarget: true });
                    }
                }
            }
            return targets;
        }
        
        for (let r = 0; r < 3; r++) {
            const combatant = enemyField[enemyCombatCol][r];
            const support = enemyField[enemySupportCol][r];
            if (combatant) targets.push({ col: enemyCombatCol, row: r, cryptid: combatant });
            if (support) {
                // Flight allows targeting supports even when combatant is up
                if (attacker.canTargetSupport || attacker.hasFlight || !combatant || combatant.tapped) {
                    targets.push({ col: enemySupportCol, row: r, cryptid: support });
                }
            }
            if (fieldEmpty && enemyKindling.length > 0 && !combatant) {
                targets.push({ owner: enemyOwner, col: enemyCombatCol, row: r, cryptid: null, isEmptyTarget: true });
            }
        }
        return targets;
    }

    getValidBurstTargets(card, owner) {
        const targets = [];
        const targetType = card.targetType || 'any';
        
        // Get the original card from registry if needed (functions may not be copied properly)
        let validateFn = card.validateTarget;
        if (!validateFn && card.key) {
            const originalCard = CardRegistry.getBurst(card.key);
            validateFn = originalCard?.validateTarget;
        }
        
        for (let c = 0; c < 2; c++) {
            for (let r = 0; r < 3; r++) {
                const pc = this.playerField[c][r];
                const ec = this.enemyField[c][r];
                if (targetType === 'tile' || targetType === 'enemyTile' || targetType === 'allyTile') {
                    if (targetType === 'tile') {
                        targets.push({ owner: 'player', col: c, row: r, cryptid: pc, isTile: true });
                        targets.push({ owner: 'enemy', col: c, row: r, cryptid: ec, isTile: true });
                    } else if (targetType === 'enemyTile') {
                        if (owner === 'player') targets.push({ owner: 'enemy', col: c, row: r, cryptid: ec, isTile: true });
                        if (owner === 'enemy') targets.push({ owner: 'player', col: c, row: r, cryptid: pc, isTile: true });
                    } else if (targetType === 'allyTile') {
                        if (owner === 'player') targets.push({ owner: 'player', col: c, row: r, cryptid: pc, isTile: true });
                        if (owner === 'enemy') targets.push({ owner: 'enemy', col: c, row: r, cryptid: ec, isTile: true });
                    }
                } else if (targetType === 'any' || targetType === 'ally' || targetType === 'allyCryptid') {
                    if (owner === 'player' && pc) targets.push({ owner: 'player', col: c, row: r, cryptid: pc });
                    if (owner === 'enemy' && ec) targets.push({ owner: 'enemy', col: c, row: r, cryptid: ec });
                }
                if (targetType === 'any' || targetType === 'enemy' || targetType === 'enemyCryptid') {
                    if (owner === 'player' && ec) targets.push({ owner: 'enemy', col: c, row: r, cryptid: ec });
                    if (owner === 'enemy' && pc) targets.push({ owner: 'player', col: c, row: r, cryptid: pc });
                }
            }
        }
        
        // Apply custom filters
        let filteredTargets = targets;
        
        // Filter for combat position requirement
        if (card.requiresCombatPosition) {
            filteredTargets = filteredTargets.filter(t => {
                if (!t.cryptid) return false;
                const combatCol = this.getCombatCol(t.owner);
                return t.col === combatCol;
            });
        }
        
        // Filter for requiresEnemyAcross (Face-Off style)
        if (card.requiresEnemyAcross) {
            filteredTargets = filteredTargets.filter(t => {
                if (!t.cryptid) return false;
                const enemyOwner = t.owner === 'player' ? 'enemy' : 'player';
                const enemyCombatCol = this.getCombatCol(enemyOwner);
                const enemyField = enemyOwner === 'player' ? this.playerField : this.enemyField;
                const enemyAcross = enemyField[enemyCombatCol][t.row];
                return !!enemyAcross;
            });
        }
        
        // Apply custom validateTarget function
        if (validateFn) {
            filteredTargets = filteredTargets.filter(t => validateFn(t.cryptid, owner, this));
        }
        
        return filteredTargets;
    }

    getValidEvolutionTargets(card, owner) {
        if (!card.evolvesFrom) return [];
        const targets = [];
        const field = owner === 'player' ? this.playerField : this.enemyField;
        for (let c = 0; c < 2; c++) {
            for (let r = 0; r < 3; r++) {
                const cryptid = field[c][r];
                if (cryptid && cryptid.key === card.evolvesFrom && !cryptid.evolvedThisTurn && !this.evolvedThisTurn[`${owner}-${c}-${r}`]) {
                    targets.push({ owner, col: c, row: r, cryptid });
                }
            }
        }
        return targets;
    }

    evolveCryptid(baseCryptid, evolutionCard) {
        const { owner, col, row } = baseCryptid;
        const evolved = {
            ...evolutionCard, owner, col, row,
            currentHp: evolutionCard.hp, maxHp: evolutionCard.hp,
            currentAtk: evolutionCard.atk, baseAtk: evolutionCard.atk, baseHp: evolutionCard.hp,
            tapped: baseCryptid.tapped, canAttack: baseCryptid.canAttack, extraTapTurns: 0,
            evolutionChain: [...(baseCryptid.evolutionChain || [baseCryptid.key]), evolutionCard.key],
            evolvedThisTurn: true
        };
        this.setFieldCryptid(owner, col, row, evolved);
        this.evolvedThisTurn[`${owner}-${col}-${row}`] = true;
        const supportCol = this.getSupportCol(owner);
        const combatCol = this.getCombatCol(owner);
        
        if (col === supportCol && evolved.onSupport) {
            GameEvents.emit('onCardCallback', { type: 'onSupport', card: evolved, owner, col, row, reason: 'kindlingEvolution' });
            evolved.onSupport(evolved, owner, this);
        }
        
        // Re-apply support abilities if evolved cryptid is in combat
        if (col === combatCol) {
            const existingSupport = this.getFieldCryptid(owner, supportCol, row);
            if (existingSupport?.onSupport && !this.isSupportNegated(existingSupport)) {
                GameEvents.emit('onCardCallback', { type: 'onSupport', card: existingSupport, owner, col: supportCol, row, reason: 'kindlingEvolved', combatant: evolved });
                existingSupport.onSupport(existingSupport, owner, this);
            }
        }
        
        // Track evolution stats for win screen
        if (owner === 'player') {
            this.matchStats.evolutions++;
        }
        
        GameEvents.emit('onEvolution', { baseCryptid, evolved, owner, col, row, evolutionStage: evolved.evolutionChain.length });
        return evolved;
    }

    // Basic turn setup - does NOT process status effects (those are animated separately)
    startTurn(owner, skipStatusEffects = false) {
        this.currentTurn = owner;
        this.phase = 'conjure1';
        this.turnNumber++;
        this.evolvedThisTurn = {};
        
        // Reset death tracking for this turn
        this.deathsThisTurn = { player: 0, enemy: 0 };
        
        // Save last turn's attackers for Burial Ground
        const opponent = owner === 'player' ? 'enemy' : 'player';
        this.lastTurnAttackers[opponent] = [...this.attackersThisTurn[opponent]];
        this.attackersThisTurn = { player: [], enemy: [] };
        
        // Reset Terrify on the ACTIVE player's cryptids (their turn is starting)
        // Terrify sets attacker's ATK to 0 "for the rest of their turn" so it resets when their next turn starts
        const activeField = owner === 'player' ? this.playerField : this.enemyField;
        for (let c = 0; c < 2; c++) {
            for (let r = 0; r < 3; r++) {
                const cryptid = activeField[c][r];
                if (cryptid?.terrified) {
                    cryptid.currentAtk = cryptid.savedAtk || cryptid.atk;
                    cryptid.terrified = false;
                    delete cryptid.savedAtk;
                }
            }
        }
        
        // Reset pyre drain immunity each turn
        this.playerPyreDrainImmune = false;
        this.enemyPyreDrainImmune = false;
        // Re-check if Jersey Devil is still in support
        const ownerField = owner === 'player' ? this.playerField : this.enemyField;
        const ownerSupportCol = this.getSupportCol(owner);
        for (let r = 0; r < 3; r++) {
            const support = ownerField[ownerSupportCol][r];
            if (support?.key === 'jerseyDevil') {
                if (owner === 'player') this.playerPyreDrainImmune = true;
                else this.enemyPyreDrainImmune = true;
            }
        }
        
        const oldPyre = owner === 'player' ? this.playerPyre : this.enemyPyre;
        if (owner === 'player') {
            this.playerPyre++;
            this.playerKindlingPlayedThisTurn = false;
            this.playerPyreCardPlayedThisTurn = false;
        } else {
            this.enemyPyre++;
            this.enemyKindlingPlayedThisTurn = false;
            this.enemyPyreCardPlayedThisTurn = false;
        }
        
        GameEvents.emit('onPyreGained', { owner, amount: 1, oldValue: oldPyre, newValue: oldPyre + 1, source: 'turnStart' });
        
        // Status effects are processed separately with animation unless skipped
        if (!skipStatusEffects) {
            this.processToxicTiles(owner);
            const burnDeaths = this.processBurnDamage(owner);
            for (const death of burnDeaths) {
                death.cryptid.killedBy = 'burn';
                this.killCryptid(death.cryptid, null);
            }
            const calamityDeaths = this.processCalamity(owner);
            for (const death of calamityDeaths) {
                console.log('[Calamity] Killing', death.cryptid.name, 'due to calamity');
                death.cryptid.killedBy = 'calamity';
                this.killCryptid(death.cryptid, null);
            }
            this.processBleed(owner);
            // Note: Paralyze is now handled inline with untap logic below
            this.processCurse(owner);
        }
        
        const field = owner === 'player' ? this.playerField : this.enemyField;
        const supportCol = this.getSupportCol(owner);
        const combatCol = this.getCombatCol(owner);
        
        for (let c = 0; c < 2; c++) {
            for (let r = 0; r < 3; r++) {
                const cryptid = field[c][r];
                if (cryptid) {
                    cryptid.evolvedThisTurn = false;
                    
                    // Check if combatant rested (didn't attack last turn)
                    if (c === combatCol && !cryptid.attackedThisTurn) {
                        cryptid.rested = true;
                        const support = field[supportCol][r];
                        if (support?.onCombatantRest) {
                            GameEvents.emit('onCardCallback', { type: 'onCombatantRest', card: support, owner, combatant: cryptid, col: supportCol, row: r });
                            support.onCombatantRest(support, cryptid, this);
                        }
                    } else {
                        cryptid.rested = false;
                    }
                    cryptid.attackedThisTurn = false;
                    
                    // Reset per-turn protection for cards like Hellhound Pup
                    if (cryptid.protectionPerTurn) {
                        this.applyProtection(cryptid, cryptid.protectionPerTurn);
                    }
                    
                    if (cryptid.extraTapTurns > 0) {
                        cryptid.extraTapTurns--;
                    } else if (cryptid.paralyzed) {
                        // Paralyzed - skip this untap phase
                        // Then clear paralyze so they untap NEXT turn
                        cryptid.paralyzeTurns--;
                        if (cryptid.paralyzeTurns <= 0) {
                            cryptid.paralyzed = false;
                            cryptid.paralyzeTurns = 0;
                            console.log(`[Paralyze] ${cryptid.name} recovered - will untap next turn`);
                            GameEvents.emit('onStatusWearOff', { status: 'paralyze', cryptid, owner });
                        }
                        // Stay tapped this turn
                    } else {
                        const wasTapped = cryptid.tapped;
                        cryptid.tapped = false;
                        cryptid.canAttack = true;
                        if (wasTapped) GameEvents.emit('onUntap', { cryptid, owner, reason: 'turnStart' });
                    }
                    
                    if (cryptid.pyreFuel && cryptid.col === supportCol) {
                        const pyreBefore = owner === 'player' ? this.playerPyre : this.enemyPyre;
                        if (owner === 'player') this.playerPyre++;
                        else this.enemyPyre++;
                        GameEvents.emit('onPyreGained', { owner, amount: 1, oldValue: pyreBefore, newValue: pyreBefore + 1, source: 'pyreFuel', sourceCryptid: cryptid });
                    }
                    
                    // Reset once-per-turn abilities
                    if (cryptid.hasBloodPactAbility) {
                        cryptid.bloodPactAvailable = true;
                    }
                    
                    if (cryptid.tempAtkDebuff) {
                        cryptid.atkDebuff = Math.max(0, (cryptid.atkDebuff || 0) - 1);
                        cryptid.tempAtkDebuff = false;
                    }
                    
                    // Apply regeneration (from El Duende support, Anti-Vampiric Blade, etc.)
                    if (cryptid.regeneration > 0) {
                        const maxHp = cryptid.maxHp || cryptid.hp;
                        cryptid.currentHp = Math.min(maxHp, cryptid.currentHp + cryptid.regeneration);
                    }
                    
                    // Call cryptid's onTurnStart callback (Elder Vampire Undying, etc.)
                    if (cryptid.onTurnStart) {
                        GameEvents.emit('onCardCallback', { type: 'onTurnStart', card: cryptid, owner, col: c, row: r });
                        cryptid.onTurnStart(cryptid, owner, this);
                    }
                    
                    // Call onTurnStartSupport for supports (Hellhound Pup regen, etc.)
                    // Note: supportCol is already defined in outer scope (line 3109)
                    if (c === supportCol && cryptid.onTurnStartSupport) {
                        GameEvents.emit('onCardCallback', { type: 'onTurnStartSupport', card: cryptid, owner, col: c, row: r });
                        cryptid.onTurnStartSupport(cryptid, owner, this);
                    }
                }
            }
        }
        
        // NOTE: Support abilities are NOT re-applied every turn.
        // They are applied once when:
        // 1. Support enters support position (summonCryptid/summonKindling)
        // 2. Combatant enters combat position (to apply buff to new combatant)
        // Per-turn effects should use onTurnStart instead.
        
        this.drawCard(owner);
        GameEvents.emit('onTurnStart', { owner, turnNumber: this.turnNumber, phase: this.phase });
    }
    
    // Get pending status effects WITHOUT applying them (for animation preview)
    getPendingStatusEffects(owner) {
        const field = owner === 'player' ? this.playerField : this.enemyField;
        const effects = [];
        
        // Burn effects
        for (let c = 0; c < 2; c++) {
            for (let r = 0; r < 3; r++) {
                const cryptid = field[c][r];
                if (cryptid && cryptid.burnTurns > 0) {
                    const willDie = cryptid.currentHp <= 1;
                    effects.push({ type: 'burn', owner, col: c, row: r, name: cryptid.name, cryptid, willDie });
                }
                if (cryptid && cryptid.calamityCounters > 0) {
                    const willDie = cryptid.calamityCounters <= 1;
                    effects.push({ type: 'calamity', owner, col: c, row: r, name: cryptid.name, cryptid, willDie, counters: cryptid.calamityCounters });
                }
            }
        }
        
        // Toxic tile effects
        const toxicTiles = owner === 'player' ? this.playerToxicTiles : this.enemyToxicTiles;
        const combatCol = this.getCombatCol(owner);
        for (let r = 0; r < 3; r++) {
            if (toxicTiles[combatCol][r] > 0) {
                const cryptid = field[combatCol][r];
                if (cryptid) {
                    effects.push({ type: 'toxic', owner, col: combatCol, row: r, name: cryptid.name, cryptid });
                }
            }
        }
        
        return effects;
    }
    
    // Process a single status effect (called during animation)
    processSingleStatusEffect(effect) {
        if (effect.type === 'burn') {
            const cryptid = effect.cryptid;
            if (cryptid && cryptid.burnTurns > 0) {
                cryptid.currentHp -= 1;
                cryptid.burnTurns--;
                GameEvents.emit('onBurnDamage', { cryptid, owner: effect.owner, damage: 1, turnsRemaining: cryptid.burnTurns });
                // Use getEffectiveHp to consider support HP pooling for combatants
                if (this.getEffectiveHp(cryptid) <= 0) {
                    cryptid.killedBy = 'burn';
                    const killResult = this.killCryptid(cryptid, null);
                    // If killResult is null, death was prevented (e.g., evolution occurred)
                    if (killResult !== null) {
                        return { died: true, cryptid };
                    } else {
                        return { died: false, evolved: true, cryptid };
                    }
                }
            }
        } else if (effect.type === 'toxic') {
            // Toxic is processed at tile level, handled by processToxicTiles
        } else if (effect.type === 'calamity') {
            const cryptid = effect.cryptid;
            if (cryptid && cryptid.calamityCounters > 0) {
                cryptid.calamityCounters--;
                GameEvents.emit('onCalamityTick', { cryptid, owner: effect.owner, countersRemaining: cryptid.calamityCounters });
                if (cryptid.calamityCounters <= 0) {
                    GameEvents.emit('onCalamityDeath', { cryptid, owner: effect.owner });
                    // Set killedBy BEFORE calling killCryptid so Mothman's Harbinger can detect it
                    cryptid.killedBy = 'calamity';
                    const killResult = this.killCryptid(cryptid, null);
                    if (killResult !== null) {
                        return { died: true, cryptid };
                    } else {
                        return { died: false, evolved: true, cryptid };
                    }
                }
            }
        }
        return { died: false };
    }

    applyAllSupportAbilities(owner) {
        const field = owner === 'player' ? this.playerField : this.enemyField;
        const supportCol = this.getSupportCol(owner);
        console.log('[applyAllSupportAbilities] owner:', owner, 'supportCol:', supportCol);
        for (let r = 0; r < 3; r++) {
            const support = field[supportCol][r];
            if (support?.onSupport && !this.isSupportNegated(support)) {
                console.log('[applyAllSupportAbilities] Calling onSupport for', support.name, 'row:', r);
                GameEvents.emit('onCardCallback', { type: 'onSupport', card: support, owner, col: supportCol, row: r, reason: 'applyAllSupportAbilities' });
                support.onSupport(support, owner, this);
            }
        }
    }
    
    // Check if a support cryptid's abilities are negated by an enemy
    isSupportNegated(support) {
        if (!support) return false;
        const enemyOwner = support.owner === 'player' ? 'enemy' : 'player';
        const enemyField = enemyOwner === 'player' ? this.playerField : this.enemyField;
        const enemySupportCol = this.getSupportCol(enemyOwner);
        
        // Check if enemy support across from this support has negatesEnemySupport
        const enemySupport = enemyField[enemySupportCol][support.row];
        if (enemySupport?.negatesEnemySupport) {
            return true;
        }
        return false;
    }

    endTurn() {
        const field = this.currentTurn === 'player' ? this.playerField : this.enemyField;
        const supportCol = this.getSupportCol(this.currentTurn);
        const combatCol = this.getCombatCol(this.currentTurn);
        
        for (let r = 0; r < 3; r++) {
            const support = field[supportCol][r];
            if (support) {
                if (support.radianceActive) {
                    for (let c = 0; c < 2; c++) {
                        for (let row = 0; row < 3; row++) {
                            const ally = field[c][row];
                            if (ally) {
                                const hpBefore = ally.currentHp;
                                ally.currentHp = Math.min(ally.maxHp, ally.currentHp + 1);
                                if (ally.currentHp > hpBefore) {
                                    GameEvents.emit('onHeal', { target: ally, amount: ally.currentHp - hpBefore, source: support, sourceType: 'radiance' });
                                }
                            }
                        }
                    }
                }
                if (support.regenActive) {
                    const combatant = field[combatCol][r];
                    if (combatant) {
                        const hpBefore = combatant.currentHp;
                        combatant.currentHp = Math.min(combatant.maxHp, combatant.currentHp + 1);
                        if (combatant.currentHp > hpBefore) {
                            GameEvents.emit('onHeal', { target: combatant, amount: combatant.currentHp - hpBefore, source: support, sourceType: 'regen' });
                        }
                    }
                }
            }
        }
        
        // Update death tracking for Rat King - store this turn's deaths for opponent's next turn
        const currentPlayer = this.currentTurn;
        const opponent = currentPlayer === 'player' ? 'enemy' : 'player';
        // The opponent's deaths during our turn becomes "deathsLastEnemyTurn" for the opponent
        this.deathsLastEnemyTurn[opponent] = this.deathsThisTurn[opponent];
        
        // Call onTurnEnd on all cryptids belonging to current player
        const currentPlayerField = currentPlayer === 'player' ? this.playerField : this.enemyField;
        for (let c = 0; c < 2; c++) {
            for (let r = 0; r < 3; r++) {
                const cryptid = currentPlayerField[c][r];
                if (cryptid?.onTurnEnd) {
                    GameEvents.emit('onCardCallback', { type: 'onTurnEnd', card: cryptid, owner: currentPlayer, col: c, row: r });
                    cryptid.onTurnEnd(cryptid, currentPlayer, this);
                }
            }
        }
        
        GameEvents.emit('onTurnEnd', { owner: this.currentTurn, turnNumber: this.turnNumber });
        
        // In multiplayer, when player ends their turn, don't fully start enemy's turn locally
        // The enemy client will handle their own turn logic
        // But we DO need to process visual state changes (untap, Terrify reset) on enemy field
        if (this.isMultiplayer && this.currentTurn === 'player') {
            // Process enemy turn-start effects locally (visual consistency)
            this.processEnemyTurnStartEffects();
            
            // Switch turn indicator
            this.currentTurn = 'enemy';
            this.phase = 'waiting'; // Indicate we're waiting for opponent
            return;
        }
        
        // Skip status effects here - they're processed with animation by the UI layer
        this.startTurn(this.currentTurn === 'player' ? 'enemy' : 'player', true);
    }
    
    // Process enemy turn-start effects locally in multiplayer (for visual consistency)
    processEnemyTurnStartEffects() {
        const enemyField = this.enemyField;
        const enemyCombatCol = this.getCombatCol('enemy');
        const enemySupportCol = this.getSupportCol('enemy');
        
        // Reset Terrify on enemy cryptids (their turn is starting)
        for (let c = 0; c < 2; c++) {
            for (let r = 0; r < 3; r++) {
                const cryptid = enemyField[c][r];
                if (cryptid?.terrified) {
                    cryptid.currentAtk = cryptid.savedAtk || cryptid.atk;
                    cryptid.terrified = false;
                    delete cryptid.savedAtk;
                }
            }
        }
        
        // Untap enemy cryptids and reset canAttack
        for (let c = 0; c < 2; c++) {
            for (let r = 0; r < 3; r++) {
                const cryptid = enemyField[c][r];
                if (cryptid) {
                    // Untap combatants
                    if (c === enemyCombatCol) {
                        cryptid.tapped = false;
                        cryptid.canAttack = true;
                    }
                }
            }
        }
    }

    pyreBurn(owner) {
        const deaths = owner === 'player' ? this.playerDeaths : this.enemyDeaths;
        const used = owner === 'player' ? this.playerPyreBurnUsed : this.enemyPyreBurnUsed;
        if (!used && deaths > 0) {
            const oldPyre = owner === 'player' ? this.playerPyre : this.enemyPyre;
            if (owner === 'player') {
                this.playerPyre += deaths;
                this.playerPyreBurnUsed = true;
            } else {
                this.enemyPyre += deaths;
                this.enemyPyreBurnUsed = true;
            }
            GameEvents.emit('onPyreBurn', { owner, pyreGained: deaths, cardsDrawn: deaths });
            GameEvents.emit('onPyreGained', { owner, amount: deaths, oldValue: oldPyre, newValue: oldPyre + deaths, source: 'pyreBurn' });
            for (let i = 0; i < deaths; i++) this.drawCard(owner, 'pyreBurn');
            return deaths;
        }
        return 0;
    }

    checkGameOver() {
        if (this.playerDeaths >= 10) this.endGame('enemy');
        else if (this.enemyDeaths >= 10) this.endGame('player');
    }

    endGame(winner) {
        if (this.gameOver) return; // Prevent double-triggering
        this.gameOver = true;
        
        // In multiplayer, send game over message to opponent
        if (this.isMultiplayer && typeof window.Multiplayer !== 'undefined' && window.Multiplayer.isInMatch) {
            // Send a gameOver action so opponent sees defeat screen
            const msg = {
                type: 'action',
                matchId: window.Multiplayer.matchId,
                playerId: window.Multiplayer.playerId,
                action: { 
                    type: 'gameOver',
                    winner: winner === 'player' ? window.Multiplayer.playerId : window.Multiplayer.opponentId
                },
                state: window.Multiplayer.serializeGameState()
            };
            window.Multiplayer.send(msg);
        }
        
        // Calculate match duration
        const duration = Math.floor((Date.now() - this.matchStats.startTime) / 1000);
        
        // Prepare match data for win screen
        const isWin = winner === 'player';
        const matchData = {
            isWin,
            isHuman: this.isMultiplayer, // True for multiplayer
            isMultiplayer: this.isMultiplayer,
            stats: {
                kills: this.enemyDeaths,
                playerDeaths: this.playerDeaths,
                damageDealt: this.matchStats.damageDealt,
                turns: this.turnNumber,
                spellsCast: this.matchStats.spellsCast,
                evolutions: this.matchStats.evolutions,
                perfectWin: this.playerDeaths === 0 && isWin
            },
            duration,
            deckName: 'Battle Deck',
            opponentName: this.isMultiplayer ? window.Multiplayer?.opponentName : 'AI'
        };
        
        // Use new WinScreen if available, fallback to old overlay
        if (typeof WinScreen !== 'undefined' && WinScreen.show) {
            WinScreen.show(matchData);
        } else {
            // Fallback to old game-over overlay
            const overlay = document.getElementById('game-over');
            const text = document.getElementById('game-over-text');
            const sub = document.getElementById('game-over-sub');
            overlay.classList.remove('victory', 'defeat');
            if (winner === 'player') {
                text.textContent = 'VICTORY';
                sub.textContent = `The ritual is complete. ${this.enemyDeaths} spirits vanquished.`;
                overlay.classList.add('victory');
            } else {
                text.textContent = 'DEFEAT';
                sub.textContent = `The darkness claims you. ${this.playerDeaths} spirits lost...`;
                overlay.classList.add('defeat');
            }
            overlay.classList.add('show');
        }
    }
}

// ==================== UI STATE ====================
let game;
let ui = {
    selectedCard: null, attackingCryptid: null, targetingBurst: null,
    targetingEvolution: null, targetingTrap: null, targetingAura: null,
    draggedCard: null, dragGhost: null, showingKindling: false,
    cardTooltipTimer: null, cardTooltipVisible: false, handCollapsed: false
};
window.ui = ui; // Expose for tutorial access
let tilePositions = {};
let isAnimating = false;
let animationStartTime = 0;
const MAX_ANIMATION_TIME = 5000; // 5 second failsafe

// Animation failsafe - resets isAnimating if stuck
function checkAnimationTimeout() {
    if (isAnimating && animationStartTime > 0 && Date.now() - animationStartTime > MAX_ANIMATION_TIME) {
        console.warn('[Animation] Failsafe: resetting stuck animation state');
        isAnimating = false;
        animationStartTime = 0;
        renderAll();
        updateButtons();
    }
}
setInterval(checkAnimationTimeout, 1000);

function setAnimating(value) {
    isAnimating = value;
    if (value) {
        animationStartTime = Date.now();
    } else {
        animationStartTime = 0;
    }
}
let lastBattlefieldHeight = 0;

// ==================== GAME INITIALIZATION ====================
function initGame() {
    game = new Game();
    window.pendingTraps = [];
    window.processingTraps = false;
    window.animatingTraps = new Set();
    EventLog.init();
    MatchLog.init(); // Initialize detailed match logging
    
    ui = {
        selectedCard: null, attackingCryptid: null, targetingBurst: null,
        targetingEvolution: null, targetingTrap: null, targetingAura: null,
        draggedCard: null, dragGhost: null, showingKindling: false,
        cardTooltipTimer: null, cardTooltipVisible: false, handCollapsed: false
    };
    window.ui = ui; // Keep window reference updated
    isAnimating = false;
    
    // Reset hand toggle visual state
    const handArea = document.getElementById('hand-area');
    const handContainer = document.getElementById('hand-container');
    if (handArea) handArea.classList.remove('collapsed');
    if (handContainer) handContainer.classList.remove('not-turn');
    
    // Set up shared game event listeners
    setupGameEventListeners();
    
    // TEST MODE: Grant all cards and 10 pyre for testing
    if (window.testMode) {
        console.log('TEST MODE ENABLED - Granting all cards and 10 pyre');
        game.playerPyre = 10;
        
        // Helper to generate unique card ID
        const generateCardId = () => Math.random().toString(36).substr(2, 9);
        
        // Add one of each cryptid to hand
        for (const key of CardRegistry.getAllCryptidKeys()) {
            const card = CardRegistry.getCryptid(key);
            if (card) game.playerHand.push({...card, id: generateCardId()});
        }
        
        // Add one of each instant (bursts, traps, auras)
        for (const key of CardRegistry.getAllInstantKeys()) {
            const card = CardRegistry.getInstant(key);
            if (card) game.playerHand.push({...card, id: generateCardId()});
        }
        
        // Add some pyres
        for (const key of CardRegistry.getAllPyreKeys()) {
            const card = CardRegistry.getPyre(key);
            if (card) game.playerHand.push({...card, id: generateCardId()});
        }
        
        // Give enemy normal hand
        for (let i = 0; i < 7; i++) {
            game.drawCard('enemy');
        }
    } else {
        // Normal mode: Draw 6 cards initially (first turn draws 1 more = 7 total)
        for (let i = 0; i < 6; i++) {
            game.drawCard('player');
            game.drawCard('enemy');
        }
    }
    
    // Determine who goes first based on main menu coin flip
    const firstPlayer = window.playerGoesFirst !== false ? 'player' : 'enemy';
    game.startTurn(firstPlayer);
    
    setTimeout(() => {
        calculateTilePositions();
        renderAll();
        lastBattlefieldHeight = document.getElementById('battlefield-area').offsetHeight;
    }, 50);
    
    updateButtons();
    
    if (firstPlayer === 'player') {
        showMessage("The ritual begins... Your move, Seeker.", TIMING.messageDisplay);
    } else {
        // Check if tutorial - don't run AI during tutorial
        if (window.TutorialManager?.isActive && !window.TutorialManager?.freePlayMode) {
            showMessage("The ritual begins...", TIMING.messageDisplay);
        } else {
            showMessage("The Warden moves first...", TIMING.messageDisplay);
            setTimeout(() => {
                if (!game.gameOver) window.runEnemyAI();
            }, TIMING.messageDisplay + 400);
        }
    }
    
    window.game = game;
}

// ==================== TILE POSITIONS ====================
function calculateTilePositions() {
    const container = document.getElementById('battlefield-area');
    const containerRect = container.getBoundingClientRect();
    document.querySelectorAll('.tile').forEach(tile => {
        const owner = tile.dataset.owner;
        const col = tile.dataset.col;
        const row = parseInt(tile.dataset.row);
        const rect = tile.getBoundingClientRect();
        const key = `${owner}-${col}-${row}`;
        tilePositions[key] = {
            x: rect.left + rect.width / 2 - containerRect.left,
            y: rect.top + rect.height / 2 - containerRect.top
        };
    });
}

function updateSpritePositions() {
    calculateTilePositions();
    document.querySelectorAll('.cryptid-sprite, .trap-sprite').forEach(sprite => {
        const key = `${sprite.dataset.owner}-${sprite.dataset.col}-${sprite.dataset.row}`;
        const pos = tilePositions[key];
        if (pos) {
            sprite.style.left = pos.x + 'px';
            sprite.style.top = pos.y + 'px';
        }
    });
}

function onLayoutChange() {
    const newHeight = document.getElementById('battlefield-area').offsetHeight;
    if (newHeight !== lastBattlefieldHeight) {
        lastBattlefieldHeight = newHeight;
        updateSpritePositions();
    }
}

// ==================== RENDERING ====================
function renderAll() {
    renderHUD();
    renderField();
    renderSprites();
    renderHand();
    updateHint();
}

function renderHUD() {
    if (!game) return; // Guard against uninitialized game
    
    document.getElementById('player-pyre').textContent = game.playerPyre;
    document.getElementById('enemy-pyre').textContent = game.enemyPyre;
    document.getElementById('player-deaths').textContent = game.playerDeaths;
    document.getElementById('enemy-deaths').textContent = game.enemyDeaths;
    
    // Update player counters
    const deckCountEl = document.getElementById('deck-count');
    const burnCountEl = document.getElementById('burn-count');
    const discardCountEl = document.getElementById('discard-count');
    
    if (deckCountEl) deckCountEl.textContent = game.deck?.length || 0;
    if (burnCountEl) burnCountEl.textContent = game.playerBurnPile?.length || 0;
    if (discardCountEl) discardCountEl.textContent = game.playerDiscardPile?.length || 0;
    
    // Update enemy counters
    const enemyDeckCountEl = document.getElementById('enemy-deck-count');
    const enemyBurnCountEl = document.getElementById('enemy-burn-count');
    const enemyDiscardCountEl = document.getElementById('enemy-discard-count');
    
    if (enemyDeckCountEl) enemyDeckCountEl.textContent = game.enemyDeck?.length || 0;
    if (enemyBurnCountEl) enemyBurnCountEl.textContent = game.enemyBurnPile?.length || 0;
    if (enemyDiscardCountEl) enemyDiscardCountEl.textContent = game.enemyDiscardPile?.length || 0;
    
    const phaseText = game.currentTurn === 'enemy' ? 
        (game.isMultiplayer ? "Opponent's Turn" : "Warden's Turn") :
        game.phase === 'conjure1' ? "First Conjuring" :
        game.phase === 'combat' ? "Battle Phase" : 
        game.phase === 'waiting' ? "Waiting..." : "Second Conjuring";
    document.getElementById('phase-text').textContent = phaseText;
}

function updateHint() {
    const hint = document.getElementById('hint');
    if (game.currentTurn !== 'player') {
        hint.textContent = game.isMultiplayer ? "Opponent is thinking..." : "The Warden acts...";
    }
    else if (ui.targetingTrap) hint.textContent = `Choose trap slot for ${ui.targetingTrap.name}`;
    else if (ui.targetingBurst) hint.textContent = `Choose target for ${ui.targetingBurst.name}`;
    else if (ui.targetingAura) hint.textContent = `Choose ally to enchant with ${ui.targetingAura.name}`;
    else if (ui.targetingEvolution) hint.textContent = `Choose ${getCardDisplayName(ui.targetingEvolution.evolvesFrom)} to transform`;
    else if (ui.attackingCryptid) hint.textContent = "Choose your prey";
    else if (ui.selectedCard) hint.textContent = ui.selectedCard.type === 'cryptid' ? "Choose a sacred space" : ui.selectedCard.type === 'trap' ? "Choose a trap slot" : "Choose target";
    else if (game.phase === 'combat') hint.textContent = "Command your spirits to strike";
    else hint.textContent = "Draw from your grimoire";
}

function renderField() {
    const battlefieldArea = document.getElementById('battlefield-area');
    let hasInteractiveElements = false;
    
    document.querySelectorAll('.tile').forEach(tile => {
        const owner = tile.dataset.owner;
        const col = tile.dataset.col;
        const row = parseInt(tile.dataset.row);
        
        tile.classList.remove('valid-target', 'attack-target', 'instant-target', 'evolution-target', 'trap-target', 'aura-target', 'drag-over', 'can-attack', 'toxic-active');
        
        if (col === 'trap') {
            const traps = owner === 'player' ? game.playerTraps : game.enemyTraps;
            if (game.currentTurn === 'player' && (game.phase === 'conjure1' || game.phase === 'conjure2')) {
                const trapCard = ui.targetingTrap || (ui.draggedCard?.type === 'trap' ? ui.draggedCard : null);
                if (owner === 'player' && trapCard && !traps[row]) {
                    tile.classList.add('trap-target');
                    hasInteractiveElements = true;
                }
            }
            return;
        }
        
        const colNum = parseInt(col);
        const field = owner === 'player' ? game.playerField : game.enemyField;
        const cryptid = field[colNum]?.[row];
        
        if (game.isTileToxic(owner, colNum, row)) tile.classList.add('toxic-active');
        
        if (game.currentTurn === 'player' && (game.phase === 'conjure1' || game.phase === 'conjure2')) {
            const burstCard = ui.targetingBurst || (ui.draggedCard?.type === 'burst' ? ui.draggedCard : null);
            if (burstCard && burstCard.type === 'burst') {
                const targets = game.getValidBurstTargets(burstCard, 'player');
                if (targets.some(t => t.owner === owner && t.col === colNum && t.row === row)) {
                    tile.classList.add('instant-target');
                    hasInteractiveElements = true;
                }
            }
        }
        
        if (cryptid) {
            const combatCol = game.getCombatCol(owner);
            if (owner === 'player' && colNum === combatCol && game.phase === 'combat' && game.currentTurn === 'player' && !cryptid.tapped && cryptid.canAttack) {
                tile.classList.add('can-attack');
                hasInteractiveElements = true;
            }
            if (ui.attackingCryptid && owner === 'enemy') {
                const targets = game.getValidAttackTargets(ui.attackingCryptid);
                if (targets.some(t => t.col === colNum && t.row === row)) {
                    tile.classList.add('attack-target');
                    hasInteractiveElements = true;
                }
            }
            if (game.currentTurn === 'player' && (game.phase === 'conjure1' || game.phase === 'conjure2')) {
                const auraCard = ui.targetingAura || (ui.draggedCard?.type === 'aura' ? ui.draggedCard : null);
                if (auraCard && owner === 'player') {
                    const targets = game.getValidAuraTargets('player');
                    if (targets.some(t => t.col === colNum && t.row === row)) {
                        tile.classList.add('aura-target');
                        hasInteractiveElements = true;
                    }
                }
                const evoCard = ui.targetingEvolution || (ui.draggedCard?.evolvesFrom ? ui.draggedCard : null);
                if (evoCard) {
                    const targets = game.getValidEvolutionTargets(evoCard, 'player');
                    if (targets.some(t => t.owner === owner && t.col === colNum && t.row === row)) {
                        tile.classList.add('evolution-target');
                        hasInteractiveElements = true;
                    }
                }
            }
        } else {
            if (owner === 'player' && (ui.selectedCard || ui.draggedCard)) {
                const card = ui.selectedCard || ui.draggedCard;
                // Kindling cards are free to play, regular cryptids require pyre
                const canAfford = card.isKindling || game.playerPyre >= card.cost;
                if (card.type === 'cryptid' && canAfford && (game.phase === 'conjure1' || game.phase === 'conjure2')) {
                    const validSlots = game.getValidSummonSlots('player');
                    if (validSlots.some(s => s.col === colNum && s.row === row)) {
                        tile.classList.add('valid-target');
                        hasInteractiveElements = true;
                    }
                }
            }
            if (owner === 'enemy' && ui.attackingCryptid) {
                const targets = game.getValidAttackTargets(ui.attackingCryptid);
                if (targets.some(t => t.col === colNum && t.row === row && t.isEmptyTarget)) {
                    tile.classList.add('attack-target');
                    hasInteractiveElements = true;
                }
            }
        }
    });
    
    battlefieldArea.classList.toggle('has-targets', hasInteractiveElements);
}

function renderSprites() {
    calculateTilePositions();
    const spriteLayer = document.getElementById('sprite-layer');
    
    const animatingSprites = [];
    if (window.animatingTraps?.size > 0) {
        document.querySelectorAll('.trap-sprite.trap-triggering').forEach(sprite => {
            const key = `${sprite.dataset.owner}-trap-${sprite.dataset.row}`;
            if (window.animatingTraps.has(key)) animatingSprites.push(sprite.cloneNode(true));
        });
    }
    
    spriteLayer.innerHTML = '';
    animatingSprites.forEach(sprite => spriteLayer.appendChild(sprite));
    
    for (const owner of ['player', 'enemy']) {
        const field = owner === 'player' ? game.playerField : game.enemyField;
        const combatCol = game.getCombatCol(owner);
        const supportCol = game.getSupportCol(owner);
        
        for (let col = 0; col < 2; col++) {
            for (let row = 0; row < 3; row++) {
                const cryptid = field[col][row];
                if (cryptid) {
                    const key = `${owner}-${col}-${row}`;
                    const pos = tilePositions[key];
                    if (!pos) continue;
                    
                    let classes = 'cryptid-sprite';
                    if (cryptid.tapped) classes += ' tapped';
                    if (owner === 'enemy') classes += ' enemy';
                    if (cryptid.evolutionChain?.length > 1) classes += ' evolved';
                    if (cryptid.element) classes += ` element-${cryptid.element}`;
                    if (cryptid.rarity) classes += ` rarity-${cryptid.rarity}`;
                    if (cryptid.isHidden) classes += ' hidden-cryptid';
                    if (cryptid.justSummoned) {
                        classes += ' summoning';
                        setTimeout(() => { cryptid.justSummoned = false; }, 50);
                    }
                    
                    const sprite = document.createElement('div');
                    sprite.className = classes;
                    sprite.dataset.owner = owner;
                    sprite.dataset.col = col;
                    sprite.dataset.row = row;
                    
                    // Hidden enemy cryptids show "?" to opponent
                    if (cryptid.isHidden && owner === 'enemy') {
                        sprite.innerHTML = `
                            <span class="sprite hidden-sprite">❓</span>
                            <div class="combat-stats">
                                <div class="crescent-bg"></div>
                                <div class="hp-arc" style="clip-path: inset(5% 0 5% 50%)"></div>
                                <div class="stat-badge atk-badge">
                                    <span class="stat-icon">⚔</span>
                                    <span class="stat-value">?</span>
                                </div>
                                <div class="stat-badge hp-badge">
                                    <span class="stat-icon">♥</span>
                                    <span class="stat-value">?</span>
                                </div>
                            </div>
                        `;
                        sprite.style.left = pos.x + 'px';
                        sprite.style.top = pos.y + 'px';
                        sprite.style.transform = 'translate(-50%, -50%)';
                        spriteLayer.appendChild(sprite);
                        continue;
                    }
                    
                    let displayAtk = cryptid.currentAtk - (cryptid.atkDebuff || 0) - (cryptid.curseTokens || 0);
                    let displayHp = cryptid.currentHp;
                    if (col === combatCol) {
                        const support = game.getFieldCryptid(owner, supportCol, row);
                        if (support) {
                            displayAtk += support.currentAtk - (support.atkDebuff || 0) - (support.curseTokens || 0);
                            displayHp += support.currentHp;
                        }
                    }
                    
                    let html = `<span class="sprite">${renderSprite(cryptid.sprite, true, cryptid.spriteScale, null, cryptid.spriteFlip)}</span>`;
                    // Show hidden indicator for own hidden cryptids
                    if (cryptid.isHidden && owner === 'player') {
                        html = `<span class="sprite hidden-own">${renderSprite(cryptid.sprite, true, cryptid.spriteScale, null, cryptid.spriteFlip)}<span class="hidden-badge">👁️</span></span>`;
                    }
                    
                    // Calculate HP percentage for the arc
                    const maxHp = cryptid.maxHp || cryptid.hp;
                    const currentHp = cryptid.currentHp;
                    const hpPercent = Math.max(0, Math.min(100, (currentHp / maxHp) * 100));
                    
                    // Determine HP arc class based on percentage
                    let hpArcClass = 'hp-arc';
                    if (hpPercent <= 25) {
                        hpArcClass += ' hp-low';
                    } else if (hpPercent <= 50) {
                        hpArcClass += ' hp-medium';
                    }
                    
                    // Calculate clip-path to shrink arc toward center based on HP
                    // At 100% HP: inset 5% from top/bottom (full arc)
                    // At 0% HP: inset 50% from top/bottom (no arc, converges to center)
                    const arcInset = 5 + (45 * (1 - hpPercent / 100));
                    const arcClipPath = owner === 'player' 
                        ? `inset(${arcInset}% 50% ${arcInset}% 0)`
                        : `inset(${arcInset}% 0 ${arcInset}% 50%)`;
                    
                    // Build evolution pips
                    let evoPipsHtml = '';
                    if (cryptid.evolutionChain?.length > 1) {
                        evoPipsHtml = '<div class="evo-pips">';
                        for (let i = 1; i < cryptid.evolutionChain.length; i++) {
                            evoPipsHtml += '<span class="evo-pip"></span>';
                        }
                        evoPipsHtml += '</div>';
                    }
                    
                    // Crescent Moon combat stats design
                    html += `
                        <div class="combat-stats">
                            <div class="crescent-bg"></div>
                            <div class="${hpArcClass}" style="clip-path: ${arcClipPath}"></div>
                            <div class="stat-badge atk-badge">
                                <span class="stat-icon">⚔</span>
                                <span class="stat-value">${Math.max(0, displayAtk)}</span>
                            </div>
                            <div class="stat-badge hp-badge">
                                <span class="stat-icon">♥</span>
                                <span class="stat-value">${displayHp}</span>
                            </div>
                            ${evoPipsHtml}
                        </div>
                    `;
                    
                    const statusIcons = game.getStatusIcons(cryptid);
                    if (statusIcons.length > 0) html += `<div class="status-icons">${statusIcons.join('')}</div>`;
                    
                    sprite.innerHTML = html;
                    sprite.style.left = pos.x + 'px';
                    sprite.style.top = pos.y + 'px';
                    sprite.style.transform = 'translate(-50%, -50%)';
                    spriteLayer.appendChild(sprite);
                }
            }
        }
        
        const traps = owner === 'player' ? game.playerTraps : game.enemyTraps;
        for (let row = 0; row < 2; row++) {
            const trap = traps[row];
            const trapKey = `${owner}-trap-${row}`;
            if (window.animatingTraps?.has(trapKey)) continue;
            if (trap) {
                const key = `${owner}-trap-${row}`;
                const pos = tilePositions[key];
                if (!pos) continue;
                
                let classes = 'trap-sprite';
                // In multiplayer, enemy traps are always face-down (hidden) until triggered
                const isHidden = (owner === 'enemy' && game.isMultiplayer) || (trap.faceDown && owner === 'enemy');
                if (isHidden) classes += ' face-down';
                
                // Add spawning animation for newly placed traps
                if (window.newlySpawnedTrap && 
                    window.newlySpawnedTrap.owner === owner && 
                    window.newlySpawnedTrap.row === row) {
                    classes += ' spawning';
                }
                
                const sprite = document.createElement('div');
                sprite.className = classes;
                sprite.dataset.owner = owner;
                sprite.dataset.col = 'trap';
                sprite.dataset.row = row;
                
                let html;
                // In multiplayer, enemy traps are always hidden until triggered
                if ((owner === 'enemy' && game.isMultiplayer) || (trap.faceDown && owner === 'enemy')) {
                    html = `<span class="sprite">🎴</span><span class="trap-indicator">?</span>`;
                } else {
                    html = `<span class="sprite">${trap.sprite}</span><span class="trap-indicator">⚡</span>`;
                }
                
                sprite.innerHTML = html;
                sprite.style.left = pos.x + 'px';
                sprite.style.top = pos.y + 'px';
                sprite.style.transform = 'translate(-50%, -50%)';
                spriteLayer.appendChild(sprite);
                
                const tile = document.querySelector(`.tile[data-owner="${owner}"][data-col="trap"][data-row="${row}"]`);
                if (tile) tile.classList.add('has-trap');
            }
        }
    }
    
    document.querySelectorAll('.tile.trap').forEach(tile => {
        const owner = tile.dataset.owner;
        const row = parseInt(tile.dataset.row);
        const traps = owner === 'player' ? game.playerTraps : game.enemyTraps;
        if (!traps[row]) tile.classList.remove('has-trap');
    });
}

// Track which cards are currently in the hand to avoid unnecessary rebuilds
let currentHandCardIds = [];
let currentHandIsKindling = false;

// Update card states WITHOUT rebuilding - prevents wiggle
function updateHandCardStates() {
    const container = document.getElementById('hand-container');
    if (!container || !game) return;
    
    const cards = ui.showingKindling ? game.playerKindling : game.playerHand;
    const isKindling = ui.showingKindling;
    
    console.log('[updateHandCardStates] Called - turn:', game.currentTurn, 'phase:', game.phase, 'isKindling:', isKindling);
    
    // Handle turn-based interactivity
    if (game.currentTurn !== 'player') {
        container.classList.add('not-turn');
        console.log('[updateHandCardStates] Added not-turn class');
    } else {
        container.classList.remove('not-turn');
        console.log('[updateHandCardStates] Removed not-turn class, container classes:', container.className);
    }
    
    // Just update classes on existing cards - DON'T touch positions
    const wrappers = container.querySelectorAll('.card-wrapper');
    wrappers.forEach(wrapper => {
        const cardId = wrapper.dataset.cardId;
        const card = cards.find(c => c.id === cardId);
        if (!card) return;
        
        const cardEl = wrapper.querySelector('.battle-card');
        if (!cardEl) return;
        
        // Recalculate playability
        let canPlay = false;
        if (isKindling) {
            canPlay = !game.playerKindlingPlayedThisTurn && (game.phase === 'conjure1' || game.phase === 'conjure2');
        } else if (card.type === 'trap') {
            const validSlots = game.getValidTrapSlots('player');
            canPlay = validSlots.length > 0 && game.playerPyre >= card.cost && (game.phase === 'conjure1' || game.phase === 'conjure2');
        } else if (card.type === 'aura') {
            const targets = game.getValidAuraTargets('player');
            canPlay = targets.length > 0 && game.playerPyre >= card.cost && (game.phase === 'conjure1' || game.phase === 'conjure2');
        } else if (card.type === 'pyre') {
            canPlay = game.canPlayPyreCard('player') && (game.phase === 'conjure1' || game.phase === 'conjure2');
        } else if (card.evolvesFrom) {
            const hasEvolutionTargets = game.getValidEvolutionTargets(card, 'player').length > 0;
            const canAfford = game.playerPyre >= card.cost;
            canPlay = (hasEvolutionTargets || canAfford) && (game.phase === 'conjure1' || game.phase === 'conjure2');
        } else {
            canPlay = game.playerPyre >= card.cost && (game.phase === 'conjure1' || game.phase === 'conjure2');
        }
        
        // Update classes only
        const wasUnplayable = cardEl.classList.contains('unplayable');
        cardEl.classList.toggle('unplayable', !canPlay);
        cardEl.classList.toggle('selected', ui.selectedCard?.id === card.id);
        
        if (wasUnplayable !== !canPlay) {
            console.log('[updateHandCardStates] Card', card.name, 'canPlay changed:', wasUnplayable, '->', !canPlay ? 'unplayable' : 'playable');
        }
    });
    
    updateKindlingButton();
}

function renderHand() {
    const container = document.getElementById('hand-container');
    
    // Guard against uninitialized game
    if (!game) return;
    
    // During animation, don't clear/rebuild
    if (isAnimating) {
        console.log('[renderHand] Skipping - isAnimating is true');
        return;
    }
    
    // Handle turn-based interactivity
    if (game.currentTurn !== 'player') {
        container.classList.add('not-turn');
    } else {
        container.classList.remove('not-turn');
    }
    
    const cards = ui.showingKindling ? game.playerKindling : game.playerHand;
    const isKindling = ui.showingKindling;
    
    // Check if we can do a lightweight update instead of full rebuild
    const newCardIds = cards.map(c => c.id);
    const sameCards = newCardIds.join(',') === currentHandCardIds.join(',');
    const sameView = isKindling === currentHandIsKindling;
    
    console.log('[renderHand] Check:', { 
        isKindling, 
        currentIsKindling: currentHandIsKindling,
        sameCards, 
        sameView, 
        childCount: container.children.length,
        turn: game.currentTurn,
        phase: game.phase
    });
    
    if (sameCards && sameView && container.children.length > 0) {
        // Same cards, same view - just update states, don't touch layout
        console.log('[renderHand] Calling updateHandCardStates() - lightweight update');
        updateHandCardStates();
        return;
    }
    
    console.log('[renderHand] Doing full rebuild');
    
    // Track new state
    currentHandCardIds = newCardIds;
    currentHandIsKindling = isKindling;
    
    // Clear and rebuild the hand
    container.innerHTML = '';
    
    cards.forEach(card => {
        const wrapper = document.createElement('div');
        wrapper.className = 'card-wrapper';
        wrapper.dataset.cardId = card.id;
        
        const cardEl = document.createElement('div');
        const rarityClass = card.rarity || 'common';
        // NO card-entering class - this is a non-animated render
        cardEl.className = 'game-card battle-card';
        
        // Card type class for template selection
        if (card.type === 'cryptid') {
            cardEl.classList.add('cryptid-card');
        } else {
            cardEl.classList.add('spell-card');
        }
        
        if (isKindling) cardEl.classList.add('kindling-card');
        if (card.type === 'trap') cardEl.classList.add('trap-card');
        if (card.type === 'aura') cardEl.classList.add('aura-card');
        if (card.type === 'pyre') cardEl.classList.add('pyre-card');
        if (card.type === 'burst') cardEl.classList.add('burst-card');
        if (card.element) cardEl.classList.add(`element-${card.element}`);
        if (card.mythical) cardEl.classList.add('mythical');
        cardEl.classList.add(rarityClass);
        
        let canPlay = false;
        if (isKindling) {
            canPlay = !game.playerKindlingPlayedThisTurn && (game.phase === 'conjure1' || game.phase === 'conjure2');
        } else if (card.type === 'trap') {
            const validSlots = game.getValidTrapSlots('player');
            canPlay = validSlots.length > 0 && game.playerPyre >= card.cost && (game.phase === 'conjure1' || game.phase === 'conjure2');
        } else if (card.type === 'aura') {
            const targets = game.getValidAuraTargets('player');
            canPlay = targets.length > 0 && game.playerPyre >= card.cost && (game.phase === 'conjure1' || game.phase === 'conjure2');
        } else if (card.type === 'pyre') {
            canPlay = game.canPlayPyreCard('player') && (game.phase === 'conjure1' || game.phase === 'conjure2');
        } else if (card.evolvesFrom) {
            const hasEvolutionTargets = game.getValidEvolutionTargets(card, 'player').length > 0;
            const canAfford = game.playerPyre >= card.cost;
            canPlay = (hasEvolutionTargets || canAfford) && (game.phase === 'conjure1' || game.phase === 'conjure2');
            if (hasEvolutionTargets) cardEl.classList.add('evolution-card');
        } else {
            canPlay = game.playerPyre >= card.cost && (game.phase === 'conjure1' || game.phase === 'conjure2');
        }
        
        if (!canPlay) cardEl.classList.add('unplayable');
        if (ui.selectedCard?.id === card.id) cardEl.classList.add('selected');
        
        // Stats display
        
        // Card type label (Cryptid/Kindling for cryptids, spell type for spells)
        let cardTypeLabel;
        if (card.type === 'cryptid') {
            cardTypeLabel = isKindling ? 'Kindling' : 'Cryptid';
        } else {
            const spellTypeLabels = { trap: 'Trap', aura: 'Aura', pyre: 'Pyre', burst: 'Burst' };
            cardTypeLabel = spellTypeLabels[card.type] || 'Spell';
        }

        let statsHTML;
        if (card.type === 'cryptid') {
            statsHTML = `<span class="gc-stat atk">${card.atk}</span><span class="gc-stat hp">${card.hp}</span>`;
        } else {
            const typeLabels = { trap: 'Trap', aura: 'Aura', pyre: 'Pyre', burst: 'Burst' };
            statsHTML = `<span class="gc-stat-type">${typeLabels[card.type] || 'Spell'}</span>`;
        }
        
        // Rarity gems (sprite-based)
        const rarityGems = `<span class="gc-rarity ${rarityClass}"></span>`;
        
        // Extract ability names (text before the colon)
        const combatName = card.combatAbility ? card.combatAbility.split(':')[0].trim() : '';
        const supportName = card.supportAbility ? card.supportAbility.split(':')[0].trim() : '';
        const abilityBoxes = card.type === 'cryptid' ? `
            <div class="gc-abilities">
                <span class="gc-ability-box left">${combatName}</span>
                <span class="gc-ability-box right">${supportName}</span>
            </div>
        ` : '';
        
        cardEl.innerHTML = `
            <span class="gc-cost">${card.cost}</span>
            <div class="gc-header"><span class="gc-name">${card.name}</span></div>
            <div class="gc-art">${renderSprite(card.sprite, false, null, card.cardSpriteScale, card.spriteFlip)}</div>
            <div class="gc-stats">${statsHTML}</div>
            <div class="gc-card-type">${cardTypeLabel}</div>
            ${abilityBoxes}
            ${rarityGems}
        `;
        
        setupCardInteractions(wrapper, cardEl, card, canPlay);
        wrapper.appendChild(cardEl);
        container.appendChild(wrapper);
    });
    
    requestAnimationFrame(() => {
        // Add or remove centered class based on whether scrolling is needed
        if (container.scrollWidth <= container.clientWidth) {
            container.classList.add('centered');
        } else {
            container.classList.remove('centered');
        }
        onLayoutChange();
        scaleAllAbilityText();
        applyCardFanLayout();
        ensureFanHoverEffects();
        detectCardNameOverflow(container);
    });
    
    updateKindlingButton();
}

function renderHandAnimated() {
    const container = document.getElementById('hand-container');
    
    // Guard against uninitialized game
    if (!game) return;
    
    console.log('[renderHandAnimated] Called - showingKindling:', ui.showingKindling, 'turn:', game.currentTurn);
    
    // Clear the container
    container.innerHTML = '';
    
    container.classList.remove('centered');
    
    // Handle turn-based interactivity (but keep cards visible)
    if (game.currentTurn !== 'player') {
        container.classList.add('not-turn');
    } else {
        container.classList.remove('not-turn');
    }
    
    const cards = ui.showingKindling ? game.playerKindling : game.playerHand;
    const isKindling = ui.showingKindling;
    
    // Update tracking variables so renderHand() knows the current state
    currentHandCardIds = cards.map(c => c.id);
    currentHandIsKindling = isKindling;
    console.log('[renderHandAnimated] Updated tracking - cardIds:', currentHandCardIds.length, 'isKindling:', currentHandIsKindling);
    
    let delayIndex = 0;
    cards.forEach((card) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'card-wrapper';
        wrapper.dataset.cardId = card.id;
        
        const rarityClass = card.rarity || 'common';
        const cardEl = document.createElement('div');
        cardEl.className = 'game-card battle-card card-entering';
        cardEl.style.animationDelay = `${delayIndex * 0.05}s`;
        delayIndex++;
        
        // Card type class for template selection
        if (card.type === 'cryptid') {
            cardEl.classList.add('cryptid-card');
        } else {
            cardEl.classList.add('spell-card');
        }
        
        if (isKindling) cardEl.classList.add('kindling-card');
        if (card.type === 'trap') cardEl.classList.add('trap-card');
        if (card.type === 'aura') cardEl.classList.add('aura-card');
        if (card.type === 'pyre') cardEl.classList.add('pyre-card');
        if (card.type === 'burst') cardEl.classList.add('burst-card');
        if (card.element) cardEl.classList.add(`element-${card.element}`);
        if (card.mythical) cardEl.classList.add('mythical');
        cardEl.classList.add(rarityClass);
        
        let canPlay = false;
        
        if (isKindling) {
            canPlay = !game.playerKindlingPlayedThisTurn && (game.phase === 'conjure1' || game.phase === 'conjure2');
        } else if (card.type === 'trap') {
            const validSlots = game.getValidTrapSlots('player');
            canPlay = validSlots.length > 0 && game.playerPyre >= card.cost && (game.phase === 'conjure1' || game.phase === 'conjure2');
        } else if (card.type === 'aura') {
            const targets = game.getValidAuraTargets('player');
            canPlay = targets.length > 0 && game.playerPyre >= card.cost && (game.phase === 'conjure1' || game.phase === 'conjure2');
        } else if (card.type === 'pyre') {
            canPlay = game.canPlayPyreCard('player') && (game.phase === 'conjure1' || game.phase === 'conjure2');
        } else if (card.evolvesFrom) {
            const hasEvolutionTargets = game.getValidEvolutionTargets(card, 'player').length > 0;
            const canAfford = game.playerPyre >= card.cost;
            canPlay = (hasEvolutionTargets || canAfford) && (game.phase === 'conjure1' || game.phase === 'conjure2');
            if (hasEvolutionTargets) cardEl.classList.add('evolution-card');
        } else {
            canPlay = game.playerPyre >= card.cost && (game.phase === 'conjure1' || game.phase === 'conjure2');
        }
        
        if (!canPlay) cardEl.classList.add('unplayable');
        if (ui.selectedCard?.id === card.id) cardEl.classList.add('selected');
        
        // Stats display
        
        // Card type label (Cryptid/Kindling for cryptids, spell type for spells)
        let cardTypeLabel;
        if (card.type === 'cryptid') {
            cardTypeLabel = isKindling ? 'Kindling' : 'Cryptid';
        } else {
            const spellTypeLabels = { trap: 'Trap', aura: 'Aura', pyre: 'Pyre', burst: 'Burst' };
            cardTypeLabel = spellTypeLabels[card.type] || 'Spell';
        }

        let statsHTML;
        if (card.type === 'cryptid') {
            statsHTML = `<span class="gc-stat atk">${card.atk}</span><span class="gc-stat hp">${card.hp}</span>`;
        } else {
            const typeLabels = { trap: 'Trap', aura: 'Aura', pyre: 'Pyre', burst: 'Burst' };
            statsHTML = `<span class="gc-stat-type">${typeLabels[card.type] || 'Spell'}</span>`;
        }
        
        // Rarity gems (sprite-based)
        const rarityGems = `<span class="gc-rarity ${rarityClass}"></span>`;
        
        // Extract ability names (text before the colon)
        const combatName = card.combatAbility ? card.combatAbility.split(':')[0].trim() : '';
        const supportName = card.supportAbility ? card.supportAbility.split(':')[0].trim() : '';
        const abilityBoxes = card.type === 'cryptid' ? `
            <div class="gc-abilities">
                <span class="gc-ability-box left">${combatName}</span>
                <span class="gc-ability-box right">${supportName}</span>
            </div>
        ` : '';
        
        cardEl.innerHTML = `
            <span class="gc-cost">${card.cost}</span>
            <div class="gc-header"><span class="gc-name">${card.name}</span></div>
            <div class="gc-art">${renderSprite(card.sprite, false, null, card.cardSpriteScale, card.spriteFlip)}</div>
            <div class="gc-stats">${statsHTML}</div>
            <div class="gc-card-type">${cardTypeLabel}</div>
            ${abilityBoxes}
            ${rarityGems}
        `;
        
        setupCardInteractions(wrapper, cardEl, card, canPlay);
        wrapper.appendChild(cardEl);
        container.appendChild(wrapper);
    });
    
    requestAnimationFrame(() => {
        // Add or remove centered class based on whether scrolling is needed
        if (container.scrollWidth <= container.clientWidth) {
            container.classList.add('centered');
        } else {
            container.classList.remove('centered');
        }
        onLayoutChange();
        scaleAllAbilityText();
        applyCardFanLayout();
        ensureFanHoverEffects();
        detectCardNameOverflow(container);
    });
    
    updateKindlingButton();
}

function setupCardInteractions(wrapper, cardEl, card, canPlay) {
    // Helper to check if card is currently playable (dynamic check)
    function isCurrentlyPlayable() {
        if (game.currentTurn !== 'player') return false;
        if (cardEl.classList.contains('unplayable')) return false;
        return true;
    }
    
    // Right-click / long-press inspect - brings card forward, shows tooltip
    function inspectCard(e, clientX, clientY) {
        e.preventDefault();
        e.stopPropagation();
        
        // Clear any previous inspect
        document.querySelectorAll('.card-wrapper.inspecting').forEach(w => w.classList.remove('inspecting'));
        
        // Add inspecting class to this card (CSS handles the visual effect)
        wrapper.classList.add('inspecting');
        
        // Show tooltip positioned smartly
        showCardTooltipSmart(card, wrapper, clientX, clientY);
        ui.cardTooltipVisible = true;
    }
    
    function endInspect() {
        wrapper.classList.remove('inspecting');
        hideTooltip();
        ui.cardTooltipVisible = false;
    }
    
    // Right-click handler for desktop
    wrapper.oncontextmenu = (e) => {
        inspectCard(e, e.clientX, e.clientY);
        
        // End inspect when clicking elsewhere or after delay
        const endHandler = () => {
            endInspect();
            document.removeEventListener('click', endHandler);
            document.removeEventListener('contextmenu', endHandler);
        };
        setTimeout(() => {
            document.addEventListener('click', endHandler);
            document.addEventListener('contextmenu', endHandler);
        }, 100);
    };
    
    // ALWAYS set up interaction handlers - they check playability dynamically
    let touchStartPos = null, touchMoved = false, dragStarted = false, scrollDetected = false;
    let longPressTriggered = false, touchStartTime = 0;
    
    // Desktop: click to select, hover for tooltip
    wrapper.onclick = (e) => { 
        console.log('[CardClick] Clicked card:', card.name, 'turn:', game.currentTurn, 'hasUnplayable:', cardEl.classList.contains('unplayable'), 'isPlayable:', isCurrentlyPlayable());
        e.stopPropagation();
        // Don't select if we just showed tooltip via long press or inspecting
        if (longPressTriggered || wrapper.classList.contains('inspecting')) {
            longPressTriggered = false;
            endInspect();
            return;
        }
        if (ui.cardTooltipVisible) { hideTooltip(); ui.cardTooltipVisible = false; }
        // Check playability dynamically
        if (!isCurrentlyPlayable()) {
            console.log('[CardClick] Blocked - not playable');
            return;
        }
        selectCard(card); 
    };
    wrapper.onmousedown = (e) => {
        if (e.button === 0 && isCurrentlyPlayable()) startDrag(e, card, cardEl); // Only left-click starts drag
    };
    
    // Touch handlers - always set up, check playability dynamically
    wrapper.ontouchstart = (e) => {
        const touch = e.touches[0];
        touchStartPos = { x: touch.clientX, y: touch.clientY };
        touchStartTime = Date.now();
        touchMoved = false; dragStarted = false; scrollDetected = false; longPressTriggered = false;
        
        // DON'T prevent default here - allow scroll to work naturally
        
        if (ui.cardTooltipTimer) clearTimeout(ui.cardTooltipTimer);
        // Long press (400ms) inspects card (brings forward, straightens, shows tooltip)
        ui.cardTooltipTimer = setTimeout(() => {
            if (!touchMoved && !scrollDetected && !dragStarted) {
                longPressTriggered = true;
                inspectCard(e, touch.clientX, touch.clientY);
                if (navigator.vibrate) navigator.vibrate(30);
            }
        }, 400);
    };
    
    wrapper.ontouchmove = (e) => {
        if (touchStartPos && e.touches[0]) {
            const touch = e.touches[0];
            const dx = touch.clientX - touchStartPos.x;
            const dy = touch.clientY - touchStartPos.y;
            const absDx = Math.abs(dx), absDy = Math.abs(dy);
            
            if (absDx > 8 || absDy > 8) {
                touchMoved = true;
                if (ui.cardTooltipTimer) { clearTimeout(ui.cardTooltipTimer); ui.cardTooltipTimer = null; }
                if (ui.cardTooltipVisible && !wrapper.classList.contains('inspecting')) { 
                    hideTooltip(); ui.cardTooltipVisible = false; 
                }
                
                // Determine intent: horizontal = scroll, vertical up = drag
                // Only allow drag if card is currently playable
                if (!dragStarted && !scrollDetected && isCurrentlyPlayable()) {
                    if (absDx > absDy * 1.5) {
                        // Clearly horizontal - let scroll happen
                        scrollDetected = true;
                    } else if (absDy > absDx * 1.5 && dy < -15) {
                        // Clearly vertical upward drag - initiate drag
                        e.preventDefault();
                        dragStarted = true;
                        startDrag(touch, card, cardEl);
                    }
                    // If movement is diagonal, keep waiting for clearer direction
                } else if (!isCurrentlyPlayable()) {
                    // If not playable, just treat any movement as scroll intent
                    scrollDetected = true;
                }
                
                // If we're dragging, keep preventing default
                if (dragStarted) {
                    e.preventDefault();
                }
            }
        }
    };
    
    wrapper.ontouchend = (e) => {
        if (ui.cardTooltipTimer) { clearTimeout(ui.cardTooltipTimer); ui.cardTooltipTimer = null; }
        const touchDuration = Date.now() - touchStartTime;
        
        // If long press showed inspect, end it after a delay
        if (longPressTriggered) {
            setTimeout(endInspect, 2500);
            touchStartPos = null; dragStarted = false; scrollDetected = false;
            return;
        }
        
        // Quick tap on stationary finger = select card (if playable)
        if (!touchMoved && touchStartPos && !scrollDetected && !dragStarted && touchDuration < 350) {
            hideTooltip(); ui.cardTooltipVisible = false;
            if (isCurrentlyPlayable()) {
                selectCard(card);
            }
        }
        
        touchStartPos = null; dragStarted = false; scrollDetected = false;
    };
    wrapper.onmouseenter = (e) => showCardTooltip(card, e);
    wrapper.onmouseleave = () => {
        if (!wrapper.classList.contains('inspecting')) hideTooltip();
    };
}

// Smart tooltip positioning - positions to side of card, never overlapping
function showCardTooltipSmart(card, cardWrapper, clientX, clientY) {
    const tooltip = document.getElementById('tooltip');
    if (!tooltip) return;
    
    // Build tooltip content using the existing elements
    document.getElementById('tooltip-name').textContent = card.name;
    
    if (card.type === 'cryptid') {
        const elementName = card.element ? card.element.charAt(0).toUpperCase() + card.element.slice(1) : '';
        const elementDisplay = elementName ? ` | ${getElementIcon(card.element)} ${elementName}` : '';
        document.getElementById('tooltip-desc').textContent = `Cost: ${card.cost} | ATK: ${card.atk} | HP: ${card.hp}${elementDisplay}`;
        document.getElementById('tooltip-combat').textContent = `⚔ ${card.combatAbility || 'None'}`;
        document.getElementById('tooltip-support').textContent = `✧ ${card.supportAbility || 'None'}`;
        const otherEl = document.getElementById('tooltip-other');
        if (otherEl) otherEl.style.display = card.otherAbility ? 'block' : 'none';
        if (otherEl && card.otherAbility) otherEl.textContent = `◈ ${card.otherAbility}`;
        document.getElementById('tooltip-evolution').textContent = card.evolvesInto ? `◈ Transforms into: ${getCardDisplayName(card.evolvesInto)}` : 
            (card.evolvesFrom ? `◈ Transforms from: ${getCardDisplayName(card.evolvesFrom)}` : '');
    } else {
        document.getElementById('tooltip-desc').textContent = `Cost: ${card.cost} | ${card.type ? card.type.charAt(0).toUpperCase() + card.type.slice(1) : 'Spell'}`;
        document.getElementById('tooltip-combat').textContent = card.description || card.effect || '';
        document.getElementById('tooltip-support').textContent = '';
        document.getElementById('tooltip-evolution').textContent = '';
        const otherEl = document.getElementById('tooltip-other');
        if (otherEl) otherEl.style.display = 'none';
    }
    
    // Get card position for smart placement
    const cardRect = cardWrapper.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const gap = 25;
    const padding = 10;
    const tooltipWidth = 180; // Fixed width from CSS
    const tooltipHeight = 150; // Approximate height
    
    let x, y;
    
    // Position to the SIDE of the card
    const cardCenterX = cardRect.left + cardRect.width / 2;
    
    if (cardCenterX > viewportWidth / 2) {
        // Card is on right half - tooltip goes LEFT
        x = cardRect.left - tooltipWidth - gap;
    } else {
        // Card is on left half - tooltip goes RIGHT  
        x = cardRect.right + gap;
    }
    
    // Vertically align with card center
    y = cardRect.top + (cardRect.height / 2) - (tooltipHeight / 2);
    
    // Clamp to viewport
    if (x < padding) x = padding;
    if (x + tooltipWidth > viewportWidth - padding) {
        x = viewportWidth - tooltipWidth - padding;
    }
    if (y < padding) y = padding;
    if (y + tooltipHeight > viewportHeight - padding) {
        y = viewportHeight - tooltipHeight - padding;
    }
    
    // Show tooltip immediately at calculated position
    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
    tooltip.classList.add('show');
}

// Update deck/discard/card count indicators
function updateHandIndicators() {
    if (!game) return;
    
    const cards = ui.showingKindling ? game.playerKindling : game.playerHand;
    const deckCount = game.playerDeck ? game.playerDeck.length : 0;
    const discardCount = game.playerDiscard ? game.playerDiscard.length : 0;
    
    // Update card count
    const cardCountEl = document.getElementById('hand-card-count');
    if (cardCountEl) {
        const label = ui.showingKindling ? 'Kindling' : 'Cards';
        cardCountEl.textContent = `${cards.length} ${label}`;
    }
    
    // Update deck count
    const deckEl = document.getElementById('deck-count');
    if (deckEl) {
        deckEl.textContent = deckCount;
    }
    
    // Update discard count
    const discardEl = document.getElementById('discard-count');
    if (discardEl) {
        discardEl.textContent = discardCount;
    }
    
    // Update hand centering based on scroll need
    updateHandCentering();
}

// Toggle centered class based on whether hand needs scrolling
function updateHandCentering() {
    const container = document.getElementById('hand-container');
    if (!container) return;
    
    // Use requestAnimationFrame to ensure layout is calculated
    requestAnimationFrame(() => {
        const needsScroll = container.scrollWidth > container.clientWidth;
        container.classList.toggle('centered', !needsScroll);
    });
}

function updateKindlingButton() {
    const kindlingBtn = document.getElementById('kindling-toggle-btn');
    if (!kindlingBtn || !game) return;
    
    const kindlingCount = game.playerKindling.length;
    if (ui.showingKindling) {
        kindlingBtn.classList.add('active');
    } else {
        kindlingBtn.classList.remove('active');
    }
    kindlingBtn.disabled = (kindlingCount === 0 && !ui.showingKindling);
    
    // Also update hand indicators
    updateHandIndicators();
}

// ==================== DRAG AND DROP ====================
let dragStartEl = null;

function startDrag(e, card, cardEl) {
    if (isAnimating) return;
    // Prevent dragging if card is blocked by tutorial
    if (cardEl && cardEl.classList.contains('tutorial-card-blocked')) return;
    if (card.isKindling && game.playerKindlingPlayedThisTurn) return;
    if (card.type === 'pyre' && !game.canPlayPyreCard('player')) return;
    if (card.type === 'aura' && (card.cost > game.playerPyre || game.getValidAuraTargets('player').length === 0)) return;
    if (card.evolvesFrom) {
        const hasEvolutionTargets = game.getValidEvolutionTargets(card, 'player').length > 0;
        const canAfford = game.playerPyre >= card.cost;
        if (!hasEvolutionTargets && !canAfford) return;
    } else if (!card.isKindling && card.cost > game.playerPyre && card.type !== 'pyre') return;
    
    ui.draggedCard = card;
    ui.selectedCard = null; ui.attackingCryptid = null; ui.targetingBurst = null; ui.targetingEvolution = null; ui.targetingAura = null;
    dragStartEl = cardEl;
    
    const ghost = document.createElement('div');
    ghost.id = 'drag-ghost';
    ghost.className = 'game-card'; // Don't use battle-card to avoid variable conflicts
    
    // Card type class for template selection
    if (card.type === 'cryptid') {
        ghost.classList.add('cryptid-card');
    } else {
        ghost.classList.add('spell-card');
    }
    
    if (card.isKindling) ghost.classList.add('kindling-card');
    if (card.type === 'trap') ghost.classList.add('trap-card');
    if (card.type === 'aura') ghost.classList.add('aura-card');
    if (card.type === 'pyre') ghost.classList.add('pyre-card');
    if (card.type === 'burst') ghost.classList.add('burst-card');
    if (card.element) ghost.classList.add(`element-${card.element}`);
    if (card.mythical) ghost.classList.add('mythical');
    if (card.rarity) ghost.classList.add(card.rarity);
    ghost.innerHTML = cardEl.innerHTML;
    
    // Set dimensions explicitly for proper positioning of inner elements
    const cardWidth = cardEl.offsetWidth;
    const cardHeight = cardEl.offsetHeight;
    ghost.style.setProperty('--gc-width', cardWidth + 'px');
    ghost.style.setProperty('--gc-height', cardHeight + 'px');
    ghost.style.width = cardWidth + 'px';
    ghost.style.height = cardHeight + 'px';
    
    document.body.appendChild(ghost);
    ui.dragGhost = ghost;
    
    ghost.style.left = (e.clientX - ghost.offsetWidth / 2) + 'px';
    ghost.style.top = (e.clientY - ghost.offsetHeight / 2) + 'px';
    cardEl.style.opacity = '0.3';
    
    document.addEventListener('mousemove', moveDrag);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('touchend', endDrag);
    
    renderField();
}

function moveDrag(e) {
    if (!ui.dragGhost) return;
    ui.dragGhost.style.left = (e.clientX - ui.dragGhost.offsetWidth / 2) + 'px';
    ui.dragGhost.style.top = (e.clientY - ui.dragGhost.offsetHeight / 2) + 'px';
    
    if (ui.draggedCard?.type === 'pyre') {
        const battlefield = document.getElementById('battlefield-area');
        const rect = battlefield.getBoundingClientRect();
        battlefield.classList.toggle('pyre-drop-zone', e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom);
    }
    
    document.querySelectorAll('.tile').forEach(tile => {
        tile.classList.remove('drag-over');
        const rect = tile.getBoundingClientRect();
        if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
            if (tile.classList.contains('valid-target') || tile.classList.contains('instant-target') || tile.classList.contains('evolution-target') || tile.classList.contains('trap-target') || tile.classList.contains('aura-target')) {
                tile.classList.add('drag-over');
            }
        }
    });
}

function handleTouchMove(e) {
    e.preventDefault();
    if (e.touches[0]) moveDrag({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
}

function endDrag(e) {
    document.removeEventListener('mousemove', moveDrag);
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('mouseup', endDrag);
    document.removeEventListener('touchend', endDrag);
    
    if (!ui.dragGhost) return;
    
    const x = e.clientX || e.changedTouches?.[0]?.clientX || 0;
    const y = e.clientY || e.changedTouches?.[0]?.clientY || 0;
    let dropped = false;
    
    try {
        if (!isAnimating && ui.draggedCard?.type === 'pyre') {
            const battlefield = document.getElementById('battlefield-area');
            const bfRect = battlefield.getBoundingClientRect();
            if (x >= bfRect.left && x <= bfRect.right && y >= bfRect.top && y <= bfRect.bottom && game.canPlayPyreCard('player')) {
                executePyreCardWithAnimation(ui.draggedCard, x, y);
                dropped = true;
            }
        }
        
        if (!isAnimating && !dropped) {
            document.querySelectorAll('.tile').forEach(tile => {
                if (dropped) return; // Early exit if already dropped
                
                const rect = tile.getBoundingClientRect();
                if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                    const owner = tile.dataset.owner;
                    const col = tile.dataset.col;
                    const row = parseInt(tile.dataset.row);
                    
                    // Handle trap placement (trap column is special)
                    if (col === 'trap' && ui.draggedCard?.type === 'trap' && tile.classList.contains('trap-target')) {
                        executeTrapPlacementDirect(ui.draggedCard, row);
                        dropped = true;
                        return;
                    }
                    
                    // Skip non-numeric columns for regular tile logic
                    const colNum = parseInt(col);
                    if (isNaN(colNum)) return;
                    
                    // Kindling cards are free to play, regular cryptids require pyre
                    const canAffordDrop = ui.draggedCard.isKindling || game.playerPyre >= ui.draggedCard.cost;
                    if (tile.classList.contains('valid-target') && ui.draggedCard.type === 'cryptid' && canAffordDrop) {
                        summonToSlot(colNum, row);
                        dropped = true;
                    } else if (tile.classList.contains('evolution-target') && ui.draggedCard.evolvesFrom) {
                        executeEvolution(owner, colNum, row);
                        dropped = true;
                    } else if (ui.draggedCard.type === 'burst') {
                        const targets = game.getValidBurstTargets(ui.draggedCard, 'player');
                        if (targets.some(t => t.owner === owner && t.col === colNum && t.row === row)) {
                            executeBurstDirect(ui.draggedCard, owner, colNum, row);
                            dropped = true;
                        }
                    } else if (ui.draggedCard.type === 'aura' && owner === 'player' && game.playerField[colNum]?.[row]) {
                        const targets = game.getValidAuraTargets('player');
                        if (targets.some(t => t.col === colNum && t.row === row)) {
                            executeAuraDirect(ui.draggedCard, colNum, row);
                            dropped = true;
                        }
                    }
                }
            });
        }
    } catch (err) {
        console.error('[endDrag] Error during drop handling:', err);
    } finally {
        // ALWAYS clean up drag state, even if an error occurred
        if (ui.dragGhost) { ui.dragGhost.remove(); ui.dragGhost = null; }
        ui.draggedCard = null;
        if (dragStartEl && !dropped) dragStartEl.style.opacity = '';
        dragStartEl = null;
        document.querySelectorAll('.tile').forEach(t => t.classList.remove('drag-over'));
        document.getElementById('battlefield-area')?.classList.remove('pyre-drop-zone');
        if (!dropped) renderAll();
    }
}

// ==================== CARD ACTIONS ====================
function selectCard(card) {
    if (isAnimating) return;
    
    // Prevent selecting if detail view was just triggered by long-press
    if (window.CardDetail?.wasJustTriggered?.()) return;
    
    // Prevent selecting if card is blocked by tutorial
    const cardWrapper = document.querySelector(`#hand-container .card-wrapper[data-card-id="${card.id}"]`);
    if (cardWrapper && cardWrapper.classList.contains('tutorial-card-blocked')) return;
    
    hideTooltip();
    document.getElementById('cancel-target').classList.remove('show');
    
    // Pyre cards now require drag or selecting then tapping battlefield (no instant play)
    // They behave like other cards - tap to select, then take action
    
    if (ui.selectedCard?.id === card.id) {
        ui.selectedCard = null; ui.targetingBurst = null; ui.targetingEvolution = null; ui.targetingTrap = null; ui.targetingAura = null;
    } else {
        ui.selectedCard = card;
        ui.attackingCryptid = null;
        ui.targetingBurst = card.type === 'burst' ? card : null;
        ui.targetingEvolution = card.evolvesFrom ? card : null;
        ui.targetingTrap = card.type === 'trap' ? card : null;
        ui.targetingAura = card.type === 'aura' ? card : null;
        if (ui.targetingBurst || ui.targetingEvolution || ui.targetingTrap || ui.targetingAura) {
            document.getElementById('cancel-target').classList.add('show');
        }
    }
    renderAll();
    updateButtons();
}

function summonToSlot(col, row) {
    if (isAnimating) return;
    const card = ui.selectedCard || ui.draggedCard;
    if (!card || card.type !== 'cryptid') return;
    
    if (card.isKindling) {
        if (game.playerKindlingPlayedThisTurn) return;
        const cryptid = game.summonKindling('player', col, row, card);
        if (cryptid) {
            console.log('[SummonKindling] Starting summon, showingKindling:', ui.showingKindling);
            game.playerKindlingPlayedThisTurn = true;
            
            // Remove card from kindling array immediately
            const idx = game.playerKindling.findIndex(c => c.id === card.id);
            if (idx > -1) game.playerKindling.splice(idx, 1);
            
            // Switch back to grimoire immediately
            ui.showingKindling = false;
            ui.selectedCard = null;
            console.log('[SummonKindling] Set showingKindling to false');
            
            // Animate card removal from kindling hand
            animateCardRemoval(card.id, 'playing');
            
            // Add transition effect to hand container
            const container = document.getElementById('hand-container');
            container.classList.add('transitioning');
            
            // Force clear hand tracking to ensure full rebuild when switching views
            currentHandCardIds = [];
            currentHandIsKindling = !ui.showingKindling; // Force mismatch to trigger rebuild
            
            // Render immediately with new state (BEFORE setting isAnimating)
            renderAll();
            updateButtons();
            // Explicitly update menu button to ensure kindling/grimoire button state is correct
            if (typeof updateMenuButtons === 'function') updateMenuButtons();
            console.log('[SummonKindling] After first render, showingKindling:', ui.showingKindling);
            
            // NOW set isAnimating to prevent other interactions
            isAnimating = true;
            
            // Clean up after animation
            setTimeout(() => {
                console.log('[SummonKindling] Animation complete, showingKindling before cleanup:', ui.showingKindling);
                container.classList.remove('transitioning');
                isAnimating = false;
                
                // Force clear tracking again to ensure clean state
                currentHandCardIds = [];
                currentHandIsKindling = !ui.showingKindling;
                
                renderAll(); // Render again to ensure everything is in sync
                updateButtons();
                if (typeof updateMenuButtons === 'function') updateMenuButtons();
                console.log('[SummonKindling] After final render, showingKindling:', ui.showingKindling);
            }, 400);
        }
    } else {
        if (game.playerPyre < card.cost) return;
        const cryptid = game.summonCryptid('player', col, row, card);
        if (cryptid) {
            isAnimating = true;
            const oldPyre = game.playerPyre;
            game.playerPyre -= card.cost;
            GameEvents.emit('onPyreSpent', { owner: 'player', amount: card.cost, oldValue: oldPyre, newValue: game.playerPyre, source: 'summon', card });
            
            // Animate card removal from hand
            animateCardRemoval(card.id, 'playing');
            
            ui.selectedCard = null;
            
            setTimeout(() => {
                const idx = game.playerHand.findIndex(c => c.id === card.id);
                if (idx > -1) game.playerHand.splice(idx, 1);
                isAnimating = false;
                renderAll();
                updateButtons();
            }, 400);
        }
    }
}

function executeEvolution(targetOwner, targetCol, targetRow) {
    const card = ui.selectedCard || ui.draggedCard || ui.targetingEvolution;
    if (!card?.evolvesFrom || isAnimating) return;
    isAnimating = true;
    
    const baseCryptid = game.getFieldCryptid(targetOwner, targetCol, targetRow);
    if (!baseCryptid || baseCryptid.key !== card.evolvesFrom) { isAnimating = false; return; }
    
    // Animate card removal from hand
    animateCardRemoval(card.id, 'playing');
    
    game.evolveCryptid(baseCryptid, card);
    
    ui.selectedCard = null;
    ui.targetingEvolution = null;
    document.getElementById('cancel-target').classList.remove('show');
    showMessage(`${baseCryptid.name} transforms into ${card.name}!`, TIMING.messageDisplay);
    
    // Remove from array after animation
    setTimeout(() => {
        const idx = game.playerHand.findIndex(c => c.id === card.id);
        if (idx > -1) game.playerHand.splice(idx, 1);
        renderAll();
    }, 300);
    
    setTimeout(() => {
        const sprite = document.querySelector(`.cryptid-sprite[data-owner="${targetOwner}"][data-col="${targetCol}"][data-row="${targetRow}"]`);
        if (sprite) sprite.classList.add('evolving');
    }, 400);
    
    setTimeout(() => { 
        // Multiplayer hook - AFTER evolution animation completes
        if (game.isMultiplayer && targetOwner === 'player' && typeof window.multiplayerHook !== 'undefined') {
            window.multiplayerHook.onEvolve(card, targetCol, targetRow);
        }
        isAnimating = false; 
        renderAll(); 
        updateButtons(); 
    }, TIMING.evolveAnim);
}

function executeBurst(targetOwner, targetCol, targetRow) {
    if (!ui.targetingBurst || isAnimating) return;
    isAnimating = true;
    const card = ui.targetingBurst;
    const targetCryptid = game.getFieldCryptid(targetOwner, targetCol, targetRow);
    const isTileTarget = card.targetType === 'tile' || card.targetType === 'enemyTile' || card.targetType === 'allyTile';
    
    // Helper to send multiplayer hook after everything completes
    function sendMultiplayerHook() {
        if (game.isMultiplayer && typeof window.multiplayerHook !== 'undefined') {
            window.multiplayerHook.onBurst(card, targetOwner, targetCol, targetRow);
        }
    }
    
    if (targetCryptid || isTileTarget) {
        // 1. Animate card removal from hand immediately
        animateCardRemoval(card.id, 'playing');
        
        // 2. Show spell name message
        showMessage(`✧ ${card.name} ✧`, TIMING.messageDisplay);
        
        // 3. Play visual effect on target
        const targetSprite = targetCryptid ? document.querySelector(
            `.cryptid-sprite[data-owner="${targetOwner}"][data-col="${targetCol}"][data-row="${targetRow}"]`
        ) : null;
        
        if (targetSprite) {
            targetSprite.classList.add('spell-target');
            setTimeout(() => targetSprite.classList.remove('spell-target'), TIMING.spellEffect);
        }
        
        // Play tile effect for tile-targeted spells
        const targetTile = document.querySelector(
            `.tile[data-owner="${targetOwner}"][data-col="${targetCol}"][data-row="${targetRow}"]`
        );
        if (targetTile) {
            targetTile.classList.add('spell-target-tile');
            setTimeout(() => targetTile.classList.remove('spell-target-tile'), TIMING.spellEffect);
        }
        
        // 4. Remove card from array and add to discard pile
        setTimeout(() => {
            const idx = game.playerHand.findIndex(c => c.id === card.id);
            if (idx > -1) {
                game.playerHand.splice(idx, 1);
                game.playerDiscardPile.push(card);
            }
            ui.selectedCard = null; ui.targetingBurst = null;
            document.getElementById('cancel-target').classList.remove('show');
        }, 300);
        
        // 5. Execute effect after visual delay
        setTimeout(() => {
            const oldPyre = game.playerPyre;
            game.playerPyre -= card.cost;
            GameEvents.emit('onPyreSpent', { owner: 'player', amount: card.cost, oldValue: oldPyre, newValue: game.playerPyre, source: 'spell', card });
            if (targetCryptid) GameEvents.emit('onTargeted', { target: targetCryptid, targetOwner, source: card, sourceType: 'spell' });
            card.effect(game, 'player', targetCryptid);
            GameEvents.emit('onSpellCast', { card, caster: 'player', target: targetCryptid, targetOwner });
            
            // Emit burst played event for tutorial and other listeners
            GameEvents.emit('onBurstPlayed', { card, target: targetCryptid, owner: 'player', targetOwner, targetCol, targetRow });
            
            // Track spell casts for win screen
            game.matchStats.spellsCast++;
            
            // 6. Check for deaths after effect resolves
            setTimeout(() => {
                if (targetCryptid) {
                    const effectiveHpAfter = game.getEffectiveHp(targetCryptid);
                    if (effectiveHpAfter <= 0) handleDeathAndPromotion(targetOwner, targetCol, targetRow, targetCryptid, 'player', sendMultiplayerHook);
                    else checkAllCreaturesForDeath(() => { sendMultiplayerHook(); isAnimating = false; renderAll(); updateButtons(); });
                } else { 
                    checkAllCreaturesForDeath(() => { sendMultiplayerHook(); isAnimating = false; renderAll(); updateButtons(); });
                }
            }, 300);
        }, TIMING.spellEffect);
    } else { isAnimating = false; }
}

function executeBurstDirect(card, targetOwner, targetCol, targetRow) {
    if (isAnimating) return;
    isAnimating = true;
    
    const targetCryptid = game.getFieldCryptid(targetOwner, targetCol, targetRow);
    const isTileTarget = card.targetType === 'tile' || card.targetType === 'enemyTile' || card.targetType === 'allyTile';
    
    // Helper to send multiplayer hook after everything completes
    function sendMultiplayerHook() {
        if (game.isMultiplayer && typeof window.multiplayerHook !== 'undefined') {
            window.multiplayerHook.onBurst(card, targetOwner, targetCol, targetRow);
        }
    }
    
    if (targetCryptid || isTileTarget) {
        // 1. Animate card removal (drag ghost already hidden by drag end)
        animateCardRemoval(card.id, 'playing');
        
        // 2. Show spell name message
        showMessage(`✧ ${card.name} ✧`, TIMING.messageDisplay);
        
        // 3. Play visual effect on target
        const targetSprite = targetCryptid ? document.querySelector(
            `.cryptid-sprite[data-owner="${targetOwner}"][data-col="${targetCol}"][data-row="${targetRow}"]`
        ) : null;
        
        if (targetSprite) {
            targetSprite.classList.add('spell-target');
            setTimeout(() => targetSprite.classList.remove('spell-target'), TIMING.spellEffect);
        }
        
        // 4. Remove from array after animation and add to discard
        setTimeout(() => {
            const idx = game.playerHand.findIndex(c => c.id === card.id);
            if (idx > -1) {
                game.playerHand.splice(idx, 1);
                game.playerDiscardPile.push(card);
            }
        }, 300);
        
        // 5. Execute effect after visual delay
        setTimeout(() => {
            const oldPyre = game.playerPyre;
            game.playerPyre -= card.cost;
            GameEvents.emit('onPyreSpent', { owner: 'player', amount: card.cost, oldValue: oldPyre, newValue: game.playerPyre, source: 'burst', card });
            card.effect(game, 'player', targetCryptid);
            
            // Emit burst played event for tutorial and other listeners
            GameEvents.emit('onBurstPlayed', { card, target: targetCryptid, owner: 'player', targetOwner, targetCol, targetRow });
            
            // Track spell casts for win screen
            game.matchStats.spellsCast++;
            
            // Process any queued ability animations, then check for deaths
            function waitForAbilityAnimations(callback) {
                function check() {
                    if (window.processingAbilityAnimations || (window.abilityAnimationQueue && window.abilityAnimationQueue.length > 0)) {
                        setTimeout(check, 100);
                    } else {
                        callback();
                    }
                }
                // Kick off animation processing
                if (typeof processAbilityAnimationQueue === 'function') {
                    processAbilityAnimationQueue();
                }
                check();
            }
            
            // 6. Wait for ability animations, then check for deaths after effect resolves
            waitForAbilityAnimations(() => {
                setTimeout(() => {
                    if (targetCryptid) {
                        const effectiveHpAfter = game.getEffectiveHp(targetCryptid);
                        if (effectiveHpAfter <= 0) handleDeathAndPromotion(targetOwner, targetCol, targetRow, targetCryptid, 'player', sendMultiplayerHook);
                        else checkAllCreaturesForDeath(() => { sendMultiplayerHook(); isAnimating = false; renderAll(); updateButtons(); });
                    } else { 
                        checkAllCreaturesForDeath(() => { sendMultiplayerHook(); isAnimating = false; renderAll(); updateButtons(); });
                    }
                }, 300);
            });
        }, TIMING.spellEffect);
    } else { isAnimating = false; }
}

function executeTrapPlacement(row) {
    const card = ui.targetingTrap;
    if (!card || isAnimating || game.playerPyre < card.cost) return;
    
    const success = game.setTrap('player', row, card);
    if (success) {
        isAnimating = true;
        
        // Mark this trap as newly spawned for animation
        window.newlySpawnedTrap = { owner: 'player', row };
        
        // Animate card removal
        animateCardRemoval(card.id, 'playing');
        
        const oldPyre = game.playerPyre;
        game.playerPyre -= card.cost;
        GameEvents.emit('onPyreSpent', { owner: 'player', amount: card.cost, oldValue: oldPyre, newValue: game.playerPyre, source: 'trap', card });
        
        ui.targetingTrap = null; ui.selectedCard = null;
        document.getElementById('cancel-target').classList.remove('show');
        showMessage(`Trap set!`, 800);
        
        // Remove from array and render after animation
        setTimeout(() => {
            const idx = game.playerHand.findIndex(c => c.id === card.id);
            if (idx > -1) game.playerHand.splice(idx, 1);
            
            // Add to discard pile
            game.playerDiscardPile.push(card);
            
            // Multiplayer hook - AFTER pyre spent and card removed
            if (game.isMultiplayer && typeof window.multiplayerHook !== 'undefined') {
                window.multiplayerHook.onTrap(card, row);
            }
            
            isAnimating = false;
            renderAll(); updateButtons();
            
            // Clear spawn marker after render
            setTimeout(() => { window.newlySpawnedTrap = null; }, 500);
        }, 400);
    }
}

function executeTrapPlacementDirect(card, row) {
    if (!card || isAnimating || game.playerPyre < card.cost) return;
    const success = game.setTrap('player', row, card);
    if (success) {
        isAnimating = true;
        
        // Mark this trap as newly spawned for animation
        window.newlySpawnedTrap = { owner: 'player', row };
        
        // Animate card removal (drag ghost hidden by drag end)
        animateCardRemoval(card.id, 'playing');
        
        const oldPyre = game.playerPyre;
        game.playerPyre -= card.cost;
        GameEvents.emit('onPyreSpent', { owner: 'player', amount: card.cost, oldValue: oldPyre, newValue: game.playerPyre, source: 'trap', card });
        showMessage(`Trap set!`, 800);
        
        setTimeout(() => {
            const idx = game.playerHand.findIndex(c => c.id === card.id);
            if (idx > -1) game.playerHand.splice(idx, 1);
            
            // Add to discard pile
            game.playerDiscardPile.push(card);
            
            // Multiplayer hook - AFTER pyre spent and card removed
            if (game.isMultiplayer && typeof window.multiplayerHook !== 'undefined') {
                window.multiplayerHook.onTrap(card, row);
            }
            
            isAnimating = false;
            renderAll(); updateButtons();
            
            // Clear spawn marker after render
            setTimeout(() => { window.newlySpawnedTrap = null; }, 500);
        }, 400);
    }
}

function executeAura(col, row) {
    const card = ui.targetingAura;
    if (!card || isAnimating || game.playerPyre < card.cost) return;
    const targetCryptid = game.getFieldCryptid('player', col, row);
    if (!targetCryptid) return;
    
    isAnimating = true;
    
    // 1. Animate card removal immediately
    animateCardRemoval(card.id, 'playing');
    
    // 2. Show enchantment message
    showMessage(`✨ ${card.name} ✨`, TIMING.messageDisplay);
    
    // 3. Play visual effect on target
    const targetSprite = document.querySelector(
        `.cryptid-sprite[data-owner="player"][data-col="${col}"][data-row="${row}"]`
    );
    if (targetSprite) {
        targetSprite.classList.add('aura-target');
        setTimeout(() => targetSprite.classList.remove('aura-target'), TIMING.spellEffect);
    }
    
    // 4. Remove from array, add to discard, and clear state
    setTimeout(() => {
        const idx = game.playerHand.findIndex(c => c.id === card.id);
        if (idx > -1) {
            game.playerHand.splice(idx, 1);
            game.playerDiscardPile.push(card);
        }
        ui.targetingAura = null; ui.selectedCard = null;
        document.getElementById('cancel-target').classList.remove('show');
    }, 300);
    
    // 5. Apply aura after visual delay
    setTimeout(() => {
        const oldPyre = game.playerPyre;
        game.playerPyre -= card.cost;
        GameEvents.emit('onPyreSpent', { owner: 'player', amount: card.cost, oldValue: oldPyre, newValue: game.playerPyre, source: 'aura', card });
        game.applyAura(targetCryptid, card);
        
        setTimeout(() => { 
            // Multiplayer hook - AFTER aura applied
            if (game.isMultiplayer && typeof window.multiplayerHook !== 'undefined') {
                window.multiplayerHook.onAura(card, col, row);
            }
            isAnimating = false; 
            renderAll(); 
            updateButtons(); 
        }, 300);
    }, TIMING.spellEffect);
}

function executeAuraDirect(card, col, row) {
    if (!card || isAnimating || game.playerPyre < card.cost) return;
    const targetCryptid = game.getFieldCryptid('player', col, row);
    if (!targetCryptid) return;
    
    isAnimating = true;
    
    // 1. Animate card removal
    animateCardRemoval(card.id, 'playing');
    
    // 2. Show enchantment message
    showMessage(`✨ ${card.name} ✨`, TIMING.messageDisplay);
    
    // 3. Play visual effect on target
    const targetSprite = document.querySelector(
        `.cryptid-sprite[data-owner="player"][data-col="${col}"][data-row="${row}"]`
    );
    if (targetSprite) {
        targetSprite.classList.add('aura-target');
        setTimeout(() => targetSprite.classList.remove('aura-target'), TIMING.spellEffect);
    }
    
    // 4. Remove from array after animation and add to discard
    setTimeout(() => {
        const idx = game.playerHand.findIndex(c => c.id === card.id);
        if (idx > -1) {
            game.playerHand.splice(idx, 1);
            game.playerDiscardPile.push(card);
        }
    }, 300);
    
    // 5. Apply aura after visual delay
    setTimeout(() => {
        const oldPyre = game.playerPyre;
        game.playerPyre -= card.cost;
        GameEvents.emit('onPyreSpent', { owner: 'player', amount: card.cost, oldValue: oldPyre, newValue: game.playerPyre, source: 'aura', card });
        game.applyAura(targetCryptid, card);
        
        setTimeout(() => { 
            // Multiplayer hook - AFTER aura applied
            if (game.isMultiplayer && typeof window.multiplayerHook !== 'undefined') {
                window.multiplayerHook.onAura(card, col, row);
            }
            isAnimating = false; 
            renderAll(); 
            updateButtons(); 
        }, 300);
    }, TIMING.spellEffect);
}

function executePyreCard(card) {
    if (!game.canPlayPyreCard('player') || isAnimating) return;
    isAnimating = true;
    
    // Get card position for visual effect
    const cardWrapper = document.querySelector(`.card-wrapper[data-card-id="${card.id}"]`);
    let effectX = window.innerWidth / 2;
    let effectY = window.innerHeight / 2;
    if (cardWrapper) {
        const rect = cardWrapper.getBoundingClientRect();
        effectX = rect.left + rect.width / 2;
        effectY = rect.top;
    }
    
    // Animate card removal
    animateCardRemoval(card.id, 'playing');
    
    // Create visual pyre burst effect
    const pyreEffect = document.createElement('div');
    pyreEffect.className = 'pyre-burst-effect';
    pyreEffect.innerHTML = `<span class="pyre-icon">${card.sprite}</span><span class="pyre-glow">🔥</span>`;
    pyreEffect.style.left = effectX + 'px';
    pyreEffect.style.top = effectY + 'px';
    document.body.appendChild(pyreEffect);
    requestAnimationFrame(() => pyreEffect.classList.add('active'));
    
    const result = game.playPyreCard('player', card);
    
    // Multiplayer hook - AFTER effect so we know the resulting pyre
    if (game.isMultiplayer && typeof window.multiplayerHook !== 'undefined') {
        window.multiplayerHook.onPyre(card);
    }
    
    // Always clean up, even if result is falsy
    ui.selectedCard = null;
    
    // Remove card from hand immediately (don't wait)
    const idx = game.playerHand.findIndex(c => c.id === card.id);
    if (idx > -1) {
        game.playerHand.splice(idx, 1);
        game.playerDiscardPile.push(card);
    }
    
    if (result) {
        const pyreGained = result.pyreGained || 1;
        let msg = `${card.name}: +${pyreGained} Pyre`;
        if (result.vampireCount !== undefined && result.vampireCount > 0) msg += ` (${result.vampireCount} vampires)`;
        if (result.deathCount !== undefined && result.deathCount > 0) msg += ` (${result.deathCount} deaths)`;
        showMessage(msg, 1200);
    }
    
    setTimeout(() => {
        pyreEffect.remove();
        isAnimating = false;
        renderAll(); 
        updateButtons();
    }, 600);
}

function executePyreCardWithAnimation(card, dropX, dropY) {
    if (!game.canPlayPyreCard('player')) return;
    isAnimating = true;
    
    // Clean up drag state
    ui.selectedCard = null; 
    ui.draggedCard = null;
    if (ui.dragGhost) { ui.dragGhost.remove(); ui.dragGhost = null; }
    
    // Animate card out of hand
    animateCardRemoval(card.id, 'playing');
    
    const pyreEffect = document.createElement('div');
    pyreEffect.className = 'pyre-burst-effect';
    pyreEffect.innerHTML = `<span class="pyre-icon">${card.sprite}</span><span class="pyre-glow">🔥</span>`;
    pyreEffect.style.left = dropX + 'px';
    pyreEffect.style.top = dropY + 'px';
    document.body.appendChild(pyreEffect);
    requestAnimationFrame(() => pyreEffect.classList.add('active'));
    
    const result = game.playPyreCard('player', card);
    
    // Multiplayer hook - AFTER effect so we know the resulting pyre
    if (game.isMultiplayer && typeof window.multiplayerHook !== 'undefined') {
        window.multiplayerHook.onPyre(card);
    }
    
    // Remove from hand immediately
    const idx = game.playerHand.findIndex(c => c.id === card.id);
    if (idx > -1) {
        game.playerHand.splice(idx, 1);
        game.playerDiscardPile.push(card);
    }
    
    if (result) {
        const pyreGained = result.pyreGained || 1;
        let msg = `${card.name}: +${pyreGained} Pyre`;
        if (result.vampireCount !== undefined && result.vampireCount > 0) msg += ` (${result.vampireCount} vampires)`;
        if (result.deathCount !== undefined && result.deathCount > 0) msg += ` (${result.deathCount} deaths)`;
        setTimeout(() => showMessage(msg, 1200), 200);
    }
    
    setTimeout(() => { 
        pyreEffect.remove(); 
        isAnimating = false; 
        renderAll(); 
        updateButtons(); 
    }, 800);
}

function handleDeathAndPromotion(targetOwner, targetCol, targetRow, deadCryptid, killerOwner, onComplete) {
    const targetSprite = document.querySelector(`.cryptid-sprite[data-owner="${targetOwner}"][data-col="${targetCol}"][data-row="${targetRow}"]`);
    if (targetSprite) targetSprite.classList.add(targetOwner === 'enemy' ? 'dying-right' : 'dying-left');
    setTimeout(() => game.killCryptid(deadCryptid, killerOwner), 100);
    setTimeout(() => {
        renderAll();
        processPendingPromotions(() => {
            checkCascadingDeaths(() => { 
                onComplete?.(); // Call optional callback
                isAnimating = false; 
                renderAll(); 
                updateButtons(); 
            });
        });
    }, TIMING.deathAnim);
}

function checkCascadingDeaths(onComplete) {
    const deathsToProcess = [];
    for (const owner of ['player', 'enemy']) {
        const field = owner === 'player' ? game.playerField : game.enemyField;
        const combatCol = game.getCombatCol(owner);
        for (let row = 0; row < 3; row++) {
            const combatant = field[combatCol][row];
            if (combatant && combatant.checkDeathAfterSupportLoss) {
                delete combatant.checkDeathAfterSupportLoss;
                if (combatant.currentHp <= 0) deathsToProcess.push({ owner, col: combatCol, row, cryptid: combatant });
            }
        }
    }
    if (deathsToProcess.length === 0) { onComplete?.(); return; }
    
    function processNextDeath(index) {
        if (index >= deathsToProcess.length) { onComplete?.(); return; }
        const { owner, col, row, cryptid } = deathsToProcess[index];
        const sprite = document.querySelector(`.cryptid-sprite[data-owner="${owner}"][data-col="${col}"][data-row="${row}"]`);
        if (sprite) sprite.classList.add(owner === 'enemy' ? 'dying-right' : 'dying-left');
        setTimeout(() => { game.killCryptid(cryptid); renderAll(); setTimeout(() => processNextDeath(index + 1), 200); }, TIMING.deathAnim);
    }
    showMessage("Soul bond severed!", TIMING.messageDisplay);
    processNextDeath(0);
}

function checkAllCreaturesForDeath(onComplete) {
    const deathsToProcess = [];
    for (const owner of ['player', 'enemy']) {
        const field = owner === 'player' ? game.playerField : game.enemyField;
        for (let col = 0; col < 2; col++) {
            for (let row = 0; row < 3; row++) {
                const cryptid = field[col][row];
                if (cryptid && game.getEffectiveHp(cryptid) <= 0) deathsToProcess.push({ owner, col, row, cryptid });
            }
        }
    }
    if (deathsToProcess.length === 0) { 
        processPendingPromotions(() => onComplete?.()); 
        return; 
    }
    
    function processNextDeath(index) {
        if (index >= deathsToProcess.length) { 
            processPendingPromotions(() => onComplete?.()); 
            return; 
        }
        const { owner, col, row, cryptid } = deathsToProcess[index];
        if (!game.getFieldCryptid(owner, col, row)) { processNextDeath(index + 1); return; }
        const sprite = document.querySelector(`.cryptid-sprite[data-owner="${owner}"][data-col="${col}"][data-row="${row}"]`);
        if (sprite) sprite.classList.add(owner === 'enemy' ? 'dying-right' : 'dying-left');
        setTimeout(() => {
            game.killCryptid(cryptid);
            // Note: killCryptid now handles promotion internally
            renderAll();
            setTimeout(() => processNextDeath(index + 1), 200);
        }, TIMING.deathAnim);
    }
    processNextDeath(0);
}

function selectAttacker(cryptid) {
    if (isAnimating) return;
    document.getElementById('cancel-target').classList.remove('show');
    if (ui.attackingCryptid === cryptid) { ui.attackingCryptid = null; hideTooltip(); }
    else {
        ui.attackingCryptid = cryptid;
        ui.selectedCard = null; ui.targetingBurst = null; ui.targetingEvolution = null;
        document.getElementById('cancel-target').classList.add('show');
    }
    renderAll();
}

function executeAttack(targetCol, targetRow) {
    if (!ui.attackingCryptid || isAnimating) return;
    isAnimating = true;
    
    const attacker = ui.attackingCryptid;
    const targetOwner = 'enemy';
    
    // Apply Insatiable Hunger buff BEFORE attack (with animation)
    const applyPreAttackBuffs = (callback) => {
        if (attacker.hasInsatiableHunger) {
            attacker.currentAtk = (attacker.currentAtk || attacker.atk) + 1;
            GameEvents.emit('onInsatiableHunger', { attacker, newAtk: attacker.currentAtk });
            
            // Show buff message and update display
            showMessage(`${attacker.name}: +1 ATK!`, 600);
            renderAll(); // Update ATK display immediately
            setTimeout(callback, 500); // Wait for buff animation
        } else {
            callback();
        }
    };
    
    applyPreAttackBuffs(() => {
        const needsAutoSummon = game.isFieldEmpty(targetOwner) && game.enemyKindling.length > 0;
        
        if (needsAutoSummon) {
            const combatCol = game.getCombatCol(targetOwner);
            const kindlingCard = game.popRandomKindling(targetOwner);
            game.summonKindling(targetOwner, combatCol, targetRow, kindlingCard);
            
            // In multiplayer, tell opponent about the forced summon so they can render it
            if (game.isMultiplayer && typeof window.Multiplayer !== 'undefined') {
                window.Multiplayer.sendForcedSummon(kindlingCard.key, combatCol, targetRow);
            }
            
            showMessage(`Forced Summoning!`, TIMING.messageDisplay);
            renderSprites();
            setTimeout(() => {
                renderSprites();
                setTimeout(() => {
                    const attackerSprite = document.querySelector(`.cryptid-sprite[data-owner="player"][data-col="${attacker.col}"][data-row="${attacker.row}"]`);
                    playAttackAnimation(attackerSprite, 'player', () => {
                        performAttackOnTarget(attacker, targetOwner, combatCol, targetRow);
                    });
                }, 50);
            }, TIMING.summonAnim + 100);
        } else {
            const attackerSprite = document.querySelector(`.cryptid-sprite[data-owner="player"][data-col="${attacker.col}"][data-row="${attacker.row}"]`);
            playAttackAnimation(attackerSprite, 'player', () => {
                performAttackOnTarget(attacker, targetOwner, targetCol, targetRow);
            });
        }
    });
}

// New attack animation with windup, lunge, and return
function playAttackAnimation(attackerSprite, owner, onComplete) {
    if (!attackerSprite) {
        if (onComplete) onComplete();
        return;
    }
    
    // Phase 1: Wind-up (anticipation)
    attackerSprite.classList.add('attack-windup');
    
    setTimeout(() => {
        // Phase 2: Lunge forward
        attackerSprite.classList.remove('attack-windup');
        attackerSprite.classList.add('attack-lunge');
        
        setTimeout(() => {
            // Phase 3: Impact - call the attack handler
            attackerSprite.classList.remove('attack-lunge');
            attackerSprite.classList.add('attack-return');
            
            if (onComplete) onComplete();
            
            setTimeout(() => {
                // Phase 4: Return to rest - only remove animation classes, NOT 'enemy'
                attackerSprite.classList.remove('attack-return');
            }, 200);
        }, 180);
    }, 150);
}

function performAttackOnTarget(attacker, targetOwner, targetCol, targetRow) {
    // Capture target info BEFORE attack for multiplayer death tracking
    const targetBeforeAttack = game.getFieldCryptid(targetOwner, targetCol, targetRow);
    const targetKey = targetBeforeAttack?.key || null;
    const supportCol = game.getSupportCol(targetOwner);
    const supportBeforeAttack = game.getFieldCryptid(targetOwner, supportCol, targetRow);
    
    const result = game.attack(attacker, targetOwner, targetCol, targetRow);
    
    // Track deaths for multiplayer
    const targetDied = result.killed || false;
    const supportDied = supportBeforeAttack && !game.getFieldCryptid(targetOwner, supportCol, targetRow);
    
    const targetSprite = document.querySelector(`.cryptid-sprite[data-owner="${targetOwner}"][data-col="${targetCol}"][data-row="${targetRow}"]`);
    const attackerSprite = document.querySelector(`.cryptid-sprite[data-owner="${attacker.owner}"][data-col="${attacker.col}"][data-row="${attacker.row}"]`);
    
    // Get impact position for effects
    const battlefield = document.getElementById('battlefield-area');
    let impactX = 0, impactY = 0;
    if (targetSprite && battlefield) {
        const targetRect = targetSprite.getBoundingClientRect();
        const battlefieldRect = battlefield.getBoundingClientRect();
        impactX = targetRect.left + targetRect.width/2 - battlefieldRect.left;
        impactY = targetRect.top + targetRect.height/2 - battlefieldRect.top;
    }
    
    // Helper to wait for ability animations
    function waitForAbilityAnimations(callback) {
        function check() {
            if (window.processingAbilityAnimations || (window.abilityAnimationQueue && window.abilityAnimationQueue.length > 0)) {
                setTimeout(check, 100);
            } else {
                callback();
            }
        }
        check();
    }
    
    // Helper to send multiplayer hook after everything completes
    function sendMultiplayerHook() {
        if (game.isMultiplayer && attacker.owner === 'player' && typeof window.multiplayerHook !== 'undefined') {
            window.multiplayerHook.onAttack(attacker, targetOwner, targetCol, targetRow, targetKey, targetDied, supportDied);
        }
    }
    
    // Handle negated attacks (e.g., Hellhound Pup protection, Primal Wendigo counter-kill)
    if (result.negated) {
        // Show protection animation on defender with combat effects
        if (targetSprite && !result.attackerKilled) {
            console.log('[Protection] Negated attack, adding animation to target:', targetSprite);
            targetSprite.classList.add('protection-block');
            setTimeout(() => targetSprite.classList.remove('protection-block'), TIMING.protectionAnim);
            
            // Show blocked damage number
            if (window.CombatEffects && result.target) {
                CombatEffects.showDamageNumber(result.target, 0, false, true);
                CombatEffects.lightImpact();
            }
        }
        
        // Show message about blocked attack
        if (!result.attackerKilled) {
            showMessage('🛡️ Attack blocked!', 800);
        }
        
        // Only show death animation if attacker was actually killed by a counter-attack
        if (result.attackerKilled) {
            if (attackerSprite) {
                attackerSprite.classList.add(attacker.owner === 'player' ? 'dying-left' : 'dying-right');
            }
            // Screen shake for counter-kill
            if (window.CombatEffects) {
                CombatEffects.heavyImpact(5);
                CombatEffects.createImpactParticles(impactX, impactY, '#ff4444', 12);
            }
        }
        ui.attackingCryptid = null;
        document.getElementById('cancel-target').classList.remove('show');
        
        // Wait for ability animations, then proceed
        waitForAbilityAnimations(() => {
            setTimeout(() => {
                renderAll();
                if (result.attackerKilled) {
                    processPendingPromotions(() => {
                        checkCascadingDeaths(() => { 
                            sendMultiplayerHook(); // AFTER all cascades complete
                            
                            // Emit attack complete event (negated but attacker killed)
                            GameEvents.emit('onAttackComplete', { 
                                attacker, 
                                negated: true, 
                                attackerKilled: true,
                                attackerOwner: attacker.owner,
                                targetOwner 
                            });
                            
                            isAnimating = false; 
                            renderAll(); 
                            updateButtons(); 
                        });
                    });
                } else {
                    sendMultiplayerHook(); // AFTER animations complete
                    
                    // Emit attack complete event (negated)
                    GameEvents.emit('onAttackComplete', { 
                        attacker, 
                        negated: true,
                        attackerOwner: attacker.owner,
                        targetOwner 
                    });
                    
                    isAnimating = false;
                    renderAll();
                    updateButtons();
                }
            }, result.attackerKilled ? TIMING.deathAnim : TIMING.protectionAnim);
        });
        return;
    }
    
    // Combat effects for successful hit
    if (window.CombatEffects) {
        const damage = result.damage || 0;
        const isCrit = damage >= 5;
        
        // Screen shake scales with damage (still some feedback even for 0 damage)
        CombatEffects.heavyImpact(Math.max(damage, 1));
        
        // Impact flash and particles
        CombatEffects.createImpactFlash(impactX, impactY, 80 + damage * 10);
        CombatEffects.createSparks(impactX, impactY, 10 + damage * 2);
        CombatEffects.createImpactParticles(impactX, impactY, result.killed ? '#ff2222' : '#ff6666', 8 + damage);
        
        // Show damage number (show 0 for 0-damage attacks too)
        if (result.target) {
            CombatEffects.showDamageNumber(result.target, damage, isCrit);
        }
    }
    
    if (targetSprite) {
        if (result.killed) {
            targetSprite.classList.add(targetOwner === 'enemy' ? 'dying-right' : 'dying-left');
            // killCryptid now handles promotion internally
        } else if (result.protectionBlocked) {
            // Protection blocked the attack - show shield animation
            console.log('[Protection] Block detected, adding animation to sprite:', targetSprite);
            targetSprite.classList.add('protection-block');
            showMessage('🛡️ Protected!', 800);
            setTimeout(() => targetSprite.classList.remove('protection-block'), TIMING.protectionAnim);
            
            // Show blocked message with combat effects
            if (window.CombatEffects && result.target) {
                CombatEffects.showDamageNumber(result.target, 0, false, true);
            }
        } else { 
            targetSprite.classList.add('hit-recoil'); 
            setTimeout(() => targetSprite.classList.remove('hit-recoil'), 250); 
        }
    }
    
    ui.attackingCryptid = null;
    document.getElementById('cancel-target').classList.remove('show');
    // Use longer wait time for protection block animation
    const waitTime = result.killed ? TIMING.deathAnim + 100 : (result.protectionBlocked ? TIMING.protectionAnim : TIMING.postAttackDelay);
    
    // Wait for ability animations first, then proceed
    waitForAbilityAnimations(() => {
        setTimeout(() => {
            renderAll();
            processPendingPromotions(() => {
                checkCascadingDeaths(() => { 
                    sendMultiplayerHook(); // AFTER all cascades complete
                    
                    // Emit attack complete event for tutorial and other listeners
                    GameEvents.emit('onAttackComplete', { 
                        attacker, 
                        target: result.target, 
                        killed: result.killed, 
                        damage: result.damage,
                        attackerOwner: attacker.owner,
                        targetOwner 
                    });
                    
                    isAnimating = false; 
                    renderAll(); 
                    updateButtons(); 
                });
            });
        }, waitTime);
    });
}

function animateSupportPromotion(owner, row) {
    const supportCol = game.getSupportCol(owner);
    const combatCol = game.getCombatCol(owner);
    const supportKey = `${owner}-${supportCol}-${row}`;
    const combatKey = `${owner}-${combatCol}-${row}`;
    const supportPos = tilePositions[supportKey];
    const combatPos = tilePositions[combatKey];
    
    if (!supportPos || !combatPos) { renderSprites(); return; }
    const distance = Math.abs(combatPos.x - supportPos.x);
    renderSprites();
    
    const sprite = document.querySelector(`.cryptid-sprite[data-owner="${owner}"][data-col="${combatCol}"][data-row="${row}"]`);
    if (sprite) {
        sprite.style.setProperty('--promote-distance', `${distance}px`);
        sprite.style.left = supportPos.x + 'px';
        sprite.classList.add(owner === 'player' ? 'promoting-right' : 'promoting-left');
        setTimeout(() => { sprite.classList.remove('promoting-right', 'promoting-left'); sprite.style.left = combatPos.x + 'px'; renderSprites(); }, TIMING.promoteAnim);
    }
}

// Process any pending promotions that happened during ability effects
function processPendingPromotions(onComplete) {
    if (!window.pendingPromotions || window.pendingPromotions.length === 0) {
        if (onComplete) onComplete();
        return;
    }
    
    const promotions = [...window.pendingPromotions];
    window.pendingPromotions = [];
    
    let index = 0;
    function processNext() {
        if (index >= promotions.length) {
            if (onComplete) onComplete();
            return;
        }
        
        const { owner, row } = promotions[index];
        animateSupportPromotion(owner, row);
        index++;
        
        setTimeout(processNext, TIMING.promoteAnim + 50);
    }
    
    processNext();
}

// ==================== BUTTON HANDLERS ====================
function updateButtons() {
    if (!game) return; // Guard against uninitialized game
    
    const isPlayer = game.currentTurn === 'player';
    const isConjure = game.phase === 'conjure1' || game.phase === 'conjure2';
    document.getElementById('pyre-burn-btn').disabled = !isPlayer || !isConjure || game.playerPyreBurnUsed || game.playerDeaths === 0;
    document.getElementById('end-conjure1-btn').disabled = !isPlayer || game.phase !== 'conjure1';
    document.getElementById('end-combat-btn').disabled = !isPlayer || game.phase !== 'combat';
    document.getElementById('end-turn-btn').disabled = !isPlayer;
    
    // Update menu buttons too
    if (typeof updateMenuButtons === 'function') {
        updateMenuButtons();
    }
}

document.getElementById('cancel-target').onclick = () => {
    if (isAnimating) return;
    hideTooltip();
    ui.selectedCard = null; ui.attackingCryptid = null; ui.targetingBurst = null; ui.targetingEvolution = null; ui.targetingTrap = null;
    document.getElementById('cancel-target').classList.remove('show');
    renderAll();
};

document.getElementById('pyre-burn-btn').onclick = () => {
    if (isAnimating) return;
    const deaths = game.playerDeaths;
    if (game.playerPyreBurnUsed || deaths === 0) return;
    isAnimating = true;
    hideTooltip();
    
    const overlay = document.getElementById('pyre-burn-overlay');
    const text = document.getElementById('pyre-burn-text');
    const container = document.getElementById('game-container');
    text.textContent = `🜂 PYRE BURN +${deaths} 🜂`;
    overlay.classList.add('active');
    text.classList.add('active');
    container.classList.add('shaking');
    
    setTimeout(() => { 
        game.pyreBurn('player'); 
        
        // Multiplayer hook - AFTER pyre burn applied
        if (game.isMultiplayer && typeof window.multiplayerHook !== 'undefined') {
            window.multiplayerHook.onPyreBurn(deaths);
        }
        
        renderAll(); 
        updateButtons(); 
    }, 300);
    setTimeout(() => { overlay.classList.remove('active'); text.classList.remove('active'); container.classList.remove('shaking'); isAnimating = false; }, TIMING.pyreBurnEffect);
};

document.getElementById('end-conjure1-btn').onclick = () => {
    if (isAnimating) return;
    hideTooltip();
    checkAllCreaturesForDeath(() => {
        const oldPhase = game.phase;
        game.phase = 'combat';
        GameEvents.emit('onPhaseChange', { owner: game.currentTurn, oldPhase, newPhase: 'combat' });
        ui.selectedCard = null; ui.targetingBurst = null; ui.targetingEvolution = null;
        document.getElementById('cancel-target').classList.remove('show');
        renderAll(); updateButtons();
    });
};

document.getElementById('end-combat-btn').onclick = () => {
    if (isAnimating) return;
    hideTooltip();
    checkAllCreaturesForDeath(() => {
        const oldPhase = game.phase;
        game.phase = 'conjure2';
        GameEvents.emit('onPhaseChange', { owner: game.currentTurn, oldPhase, newPhase: 'conjure2' });
        ui.attackingCryptid = null;
        document.getElementById('cancel-target').classList.remove('show');
        renderAll(); updateButtons();
    });
};

document.getElementById('kindling-toggle-btn').onclick = () => {
    if (isAnimating) return;
    hideTooltip();
    ui.selectedCard = null; ui.targetingBurst = null; ui.targetingEvolution = null;
    document.getElementById('cancel-target').classList.remove('show');
    
    // Toggle the state immediately
    ui.showingKindling = !ui.showingKindling;
    
    // Animate the transition
    const container = document.getElementById('hand-container');
    container.classList.add('transitioning');
    setTimeout(() => {
        container.classList.remove('transitioning');
    }, 300);
    
    // Render immediately with new state
    renderHandAnimated();
    updateButtons();
    requestAnimationFrame(onLayoutChange);
    renderField();
};

// Hand menu toggle
document.getElementById('hand-menu-btn').onclick = () => {
    const panel = document.getElementById('hand-menu-panel');
    const btn = document.getElementById('hand-menu-btn');
    
    // During tutorial, only allow opening (not closing) unless in free play
    if (window.TutorialManager?.isActive && !window.TutorialManager?.freePlayMode) {
        if (!panel.classList.contains('open')) {
            panel.classList.add('open');
            btn.classList.add('menu-open');
        }
        // Don't toggle closed during guided tutorial
        return;
    }
    
    panel.classList.toggle('open');
    btn.classList.toggle('menu-open');
};

// Close menu when clicking outside
document.addEventListener('click', (e) => {
    const panel = document.getElementById('hand-menu-panel');
    const btn = document.getElementById('hand-menu-btn');
    
    // Don't auto-close during tutorial - let tutorial control the flow
    if (window.TutorialManager?.isActive && !window.TutorialManager?.freePlayMode) {
        return;
    }
    
    if (panel && btn && !panel.contains(e.target) && !btn.contains(e.target)) {
        panel.classList.remove('open');
        btn.classList.remove('menu-open');
    }
});

// Prevent clicks inside menu panel from doing anything unexpected during tutorial
document.getElementById('hand-menu-panel')?.addEventListener('click', (e) => {
    if (window.TutorialManager?.isActive && !window.TutorialManager?.freePlayMode) {
        // Only allow clicks on actual buttons, stop everything else
        if (!e.target.closest('button')) {
            e.stopPropagation();
        }
    }
});

// Wire up menu buttons to same handlers
document.getElementById('menu-kindling-btn').onclick = () => {
    document.getElementById('kindling-toggle-btn').click();
    // Close menu after action (unless in tutorial guided mode)
    if (!window.TutorialManager?.isActive || window.TutorialManager?.freePlayMode) {
        document.getElementById('hand-menu-panel').classList.remove('open');
        document.getElementById('hand-menu-btn').classList.remove('menu-open');
    }
};

document.getElementById('menu-burn-btn').onclick = () => {
    // Don't allow during guided tutorial unless it's the expected action
    if (window.TutorialManager?.isActive && !window.TutorialManager?.freePlayMode) {
        return;
    }
    document.getElementById('pyre-burn-btn').click();
    document.getElementById('hand-menu-panel').classList.remove('open');
    document.getElementById('hand-menu-btn').classList.remove('menu-open');
};

document.getElementById('menu-end-btn').onclick = () => {
    // Don't allow during guided tutorial unless it's the expected action
    if (window.TutorialManager?.isActive && !window.TutorialManager?.freePlayMode) {
        return;
    }
    document.getElementById('end-turn-btn').click();
    document.getElementById('hand-menu-panel').classList.remove('open');
    document.getElementById('hand-menu-btn').classList.remove('menu-open');
};

// Update menu kindling button state
function updateMenuButtons() {
    const menuKindlingBtn = document.getElementById('menu-kindling-btn');
    const menuBurnBtn = document.getElementById('menu-burn-btn');
    const menuEndBtn = document.getElementById('menu-end-btn');
    
    if (!game) return;
    
    const isPlayer = game.currentTurn === 'player';
    const isConjure = game.phase === 'conjure1' || game.phase === 'conjure2';
    
    // Kindling button state
    if (menuKindlingBtn) {
        if (ui.showingKindling) {
            menuKindlingBtn.classList.add('active');
        } else {
            menuKindlingBtn.classList.remove('active');
        }
        menuKindlingBtn.disabled = (game.playerKindling.length === 0 && !ui.showingKindling);
    }
    
    // Burn button state - match main button logic
    if (menuBurnBtn) {
        menuBurnBtn.disabled = !isPlayer || !isConjure || game.playerPyreBurnUsed || game.playerDeaths === 0;
    }
    
    // End button state  
    if (menuEndBtn) {
        menuEndBtn.disabled = !isPlayer;
    }
}

document.getElementById('end-turn-btn').onclick = () => {
    // Basic checks
    if (game.currentTurn !== 'player' || isAnimating) return;
    
    // Multiplayer safeguard - prevent double-clicking during transition
    if (game.isMultiplayer && typeof window.Multiplayer !== 'undefined') {
        if (window.Multiplayer.turnTransitionLock) {
            console.log('[System] End turn blocked - turn transition in progress');
            return;
        }
    }
    
    isAnimating = true;
    hideTooltip();
    ui.selectedCard = null; ui.attackingCryptid = null; ui.targetingBurst = null; ui.targetingEvolution = null; ui.showingKindling = false;
    document.getElementById('cancel-target').classList.remove('show');
    
    checkAllCreaturesForDeath(() => {
        // Animate turn-end effects (healing from radiance/regen)
        animateTurnEndEffects(() => {
            game.endTurn();
            
            if (game.isMultiplayer) {
                // Multiplayer: send hook AFTER turn-end effects complete
                // The onEndPhase hook handles timer, isMyTurn, and sending the action
                if (typeof window.multiplayerHook !== 'undefined') {
                    window.multiplayerHook.onEndPhase();
                }
                
                // Just set the transition lock here
                if (typeof window.Multiplayer !== 'undefined') {
                    window.Multiplayer.turnTransitionLock = true;
                }
                
                isAnimating = false;
                renderAll(); updateButtons();
                
                setTimeout(() => {
                    if (typeof window.Multiplayer !== 'undefined') {
                        window.Multiplayer.turnTransitionLock = false;
                    }
                }, 300);
            } else if (game.currentTurn === 'enemy' && !game.gameOver) {
                // Check if tutorial is controlling the enemy
                if (window.TutorialManager?.isActive && !window.TutorialManager?.freePlayMode) {
                    // Tutorial mode: don't run AI, let tutorial script control enemy
                    console.log('[Game] Tutorial mode - skipping AI, tutorial will control enemy');
                    isAnimating = false;
                    renderAll(); updateButtons();
                    // The tutorial will advance and call TutorialBattle.executeEnemyTurn
                    return;
                }
                
                // Single player: enemy AI turn
                animateTurnStartEffects('enemy', () => {
                    showMessage("The Warden stirs...", TIMING.messageDisplay);
                    renderAll(); updateButtons();
                    setTimeout(() => {
                        isAnimating = false;
                        window.runEnemyAI();
                    }, TIMING.messageDisplay + 200);
                });
            } else {
                isAnimating = false;
                renderAll(); updateButtons();
            }
        });
    });
};

// Animate turn-end healing effects
function animateTurnEndEffects(onComplete) {
    const field = game.currentTurn === 'player' ? game.playerField : game.enemyField;
    const supportCol = game.getSupportCol(game.currentTurn);
    const combatCol = game.getCombatCol(game.currentTurn);
    const healTargets = [];
    
    // Find creatures that will be healed
    for (let r = 0; r < 3; r++) {
        const support = field[supportCol][r];
        if (support) {
            if (support.radianceActive) {
                for (let c = 0; c < 2; c++) {
                    for (let row = 0; row < 3; row++) {
                        const ally = field[c][row];
                        if (ally && ally.currentHp < ally.maxHp) {
                            healTargets.push({ owner: game.currentTurn, col: c, row });
                        }
                    }
                }
            }
            if (support.regenActive) {
                const combatant = field[combatCol][r];
                if (combatant && combatant.currentHp < combatant.maxHp) {
                    healTargets.push({ owner: game.currentTurn, col: combatCol, row: r });
                }
            }
        }
    }
    
    if (healTargets.length > 0) {
        // Show heal animations
        healTargets.forEach(target => {
            const sprite = document.querySelector(
                `.cryptid-sprite[data-owner="${target.owner}"][data-col="${target.col}"][data-row="${target.row}"]`
            );
            if (sprite) {
                sprite.classList.add('healing');
                setTimeout(() => sprite.classList.remove('healing'), 600);
            }
        });
        setTimeout(onComplete, 700);
    } else {
        onComplete();
    }
}

// Animate AND process turn-start status effects (burn, toxic, calamity)
function animateTurnStartEffects(owner, onComplete) {
    // Process bleed and curse here (paralyze is handled inline with untap logic)
    game.processBleed(owner);
    game.processCurse(owner);
    
    // Get pending effects BEFORE they're processed
    const effects = game.getPendingStatusEffects(owner);
    
    if (effects.length === 0) {
        onComplete();
        return;
    }
    
    // Process toxic tiles first (they affect damage calculations)
    game.processToxicTiles(owner);
    
    let currentIndex = 0;
    
    function processNextEffect() {
        if (currentIndex >= effects.length) {
            // Check for any deaths that need promotion
            checkAllCreaturesForDeath(() => {
                renderAll();
                onComplete();
            });
            return;
        }
        
        const effect = effects[currentIndex];
        const sprite = document.querySelector(
            `.cryptid-sprite[data-owner="${effect.owner}"][data-col="${effect.col}"][data-row="${effect.row}"]`
        );
        
        if (effect.type === 'burn') {
            showMessage(`🔥 ${effect.name} burns!`, 900);
            if (sprite) {
                sprite.classList.add('burn-damage');
                setTimeout(() => sprite.classList.remove('burn-damage'), 700);
            }
            
            // Process the actual burn damage after visual starts
            setTimeout(() => {
                const result = game.processSingleStatusEffect(effect);
                if (result.died) {
                    if (sprite) {
                        sprite.classList.add('dying-left');
                    }
                    setTimeout(() => {
                        renderAll();
                        processPendingPromotions(() => {
                            setTimeout(() => { currentIndex++; processNextEffect(); }, 100);
                        });
                    }, TIMING.deathAnim);
                } else if (result.evolved) {
                    // Cryptid evolved instead of dying (e.g., Hellhound Pup -> Hellhound)
                    showMessage(`✨ Evolved from the flames!`, 1000);
                    renderAll();
                    // Re-find sprite since it changed
                    const newSprite = document.querySelector(
                        `.cryptid-sprite[data-owner="${effect.owner}"][data-col="${effect.col}"][data-row="${effect.row}"]`
                    );
                    if (newSprite) {
                        newSprite.classList.add('evolving');
                        setTimeout(() => newSprite.classList.remove('evolving'), 800);
                    }
                    setTimeout(() => { currentIndex++; processNextEffect(); }, 900);
                } else {
                    renderAll();
                    setTimeout(() => { currentIndex++; processNextEffect(); }, 400);
                }
            }, 300);
            
        } else if (effect.type === 'toxic') {
            showMessage(`☠ ${effect.name} takes toxic damage!`, 900);
            if (sprite) {
                sprite.classList.add('toxic-damage');
                setTimeout(() => sprite.classList.remove('toxic-damage'), 600);
            }
            renderAll();
            setTimeout(() => { currentIndex++; processNextEffect(); }, 750);
            
        } else if (effect.type === 'calamity') {
            const countersLeft = effect.counters - 1;
            if (countersLeft <= 0) {
                showMessage(`💥 ${effect.name}: CALAMITY!`, 1000);
            } else {
                showMessage(`⚠ ${effect.name}: Calamity (${countersLeft} left)`, 900);
            }
            if (sprite) {
                sprite.classList.add('calamity-tick');
                setTimeout(() => sprite.classList.remove('calamity-tick'), 800);
            }
            
            // Process the actual calamity tick after visual starts
            setTimeout(() => {
                const result = game.processSingleStatusEffect(effect);
                if (result.died) {
                    if (sprite) {
                        sprite.classList.add('dying-left');
                    }
                    setTimeout(() => {
                        renderAll();
                        processPendingPromotions(() => {
                            setTimeout(() => { currentIndex++; processNextEffect(); }, 100);
                        });
                    }, TIMING.deathAnim);
                } else if (result.evolved) {
                    // Cryptid evolved instead of dying
                    showMessage(`✨ Transformed from calamity!`, 1000);
                    renderAll();
                    const newSprite = document.querySelector(
                        `.cryptid-sprite[data-owner="${effect.owner}"][data-col="${effect.col}"][data-row="${effect.row}"]`
                    );
                    if (newSprite) {
                        newSprite.classList.add('evolving');
                        setTimeout(() => newSprite.classList.remove('evolving'), 800);
                    }
                    setTimeout(() => { currentIndex++; processNextEffect(); }, 900);
                } else {
                    renderAll();
                    setTimeout(() => { currentIndex++; processNextEffect(); }, 400);
                }
            }, 400);
            
        } else {
            currentIndex++;
            processNextEffect();
        }
    }
    
    processNextEffect();
}

// ==================== UTILITIES ====================

// Animate a card being played/removed from hand
function animateCardRemoval(cardId, animationType = 'playing', onComplete) {
    const container = document.getElementById('hand-container');
    
    // Find the card wrapper by data-card-id attribute (convert to string for comparison)
    const targetWrapper = container.querySelector(`.card-wrapper[data-card-id="${cardId}"]`);
    
    if (!targetWrapper) {
        console.log('Card wrapper not found for id:', cardId);
        onComplete?.();
        return;
    }
    
    // Mark as animating so renderAll doesn't remove it
    targetWrapper.dataset.animating = 'true';
    
    // Get the card element inside
    const cardEl = targetWrapper.querySelector('.card');
    
    // Store original dimensions and position
    const originalWidth = targetWrapper.offsetWidth;
    
    // Lock the wrapper's width and prevent flex from moving it
    targetWrapper.style.width = originalWidth + 'px';
    targetWrapper.style.minWidth = originalWidth + 'px';
    targetWrapper.style.flexShrink = '0';
    targetWrapper.style.overflow = 'visible'; // Keep visible so card can animate out
    
    // Force reflow to ensure styles are applied
    targetWrapper.offsetHeight;
    
    // Animate the card flying up and fading
    if (cardEl) {
        // First, reset opacity to full in case it was dimmed during drag
        cardEl.style.opacity = '1';
        cardEl.style.transform = 'none';
        
        // Force reflow
        cardEl.offsetHeight;
        
        // Now apply the exit animation
        cardEl.style.transition = 'opacity 0.2s ease-out, transform 0.25s ease-out';
        cardEl.style.opacity = '0';
        cardEl.style.transform = 'scale(1.1) translateY(-30px)';
        cardEl.style.pointerEvents = 'none';
    }
    
    // After card starts fading, collapse the wrapper width smoothly
    setTimeout(() => {
        targetWrapper.style.overflow = 'hidden';
        targetWrapper.style.transition = 'width 0.25s ease-out, min-width 0.25s ease-out, margin 0.25s ease-out, padding 0.25s ease-out';
        targetWrapper.style.width = '0px';
        targetWrapper.style.minWidth = '0px';
        targetWrapper.style.marginLeft = '0px';
        targetWrapper.style.marginRight = '0px';
        targetWrapper.style.paddingLeft = '0px';
        targetWrapper.style.paddingRight = '0px';
    }, 150);
    
    // Complete and clean up after animation
    setTimeout(() => {
        // Remove the wrapper from DOM
        if (targetWrapper.parentNode) {
            targetWrapper.remove();
        }
        onComplete?.();
    }, 400);
}

// Remove card from hand with animation
function removeCardFromHandAnimated(card, animationType = 'playing', onComplete) {
    animateCardRemoval(card.id, animationType, () => {
        const idx = game.playerHand.findIndex(c => c.id === card.id);
        if (idx > -1) game.playerHand.splice(idx, 1);
        onComplete?.();
    });
}

// Remove kindling from hand with animation
function removeKindlingFromHandAnimated(card, onComplete) {
    animateCardRemoval(card.id, 'playing', () => {
        const idx = game.playerKindling.findIndex(c => c.id === card.id);
        if (idx > -1) game.playerKindling.splice(idx, 1);
        onComplete?.();
    });
}

function showMessage(text, duration = 2000) {
    const overlay = document.getElementById('message-overlay');
    document.getElementById('message-text').textContent = text;
    overlay.classList.add('show');
    setTimeout(() => overlay.classList.remove('show'), duration);
}

function showCardTooltip(card, e) {
    // Get the card wrapper element that's being hovered
    const cardWrapper = e.target.closest('.card-wrapper');
    if (cardWrapper) {
        // Use smart positioning
        showCardTooltipSmart(card, cardWrapper, e.clientX, e.clientY);
        return;
    }
    // Fallback to simple positioning
    showCardTooltipAtPosition(card, e.clientX + 15, e.clientY - 100);
}

function showCardTooltipAtPosition(card, x, y) {
    const tooltip = document.getElementById('tooltip');
    document.getElementById('tooltip-name').textContent = card.name;
    
    if (card.type === 'cryptid') {
        const elementName = card.element ? card.element.charAt(0).toUpperCase() + card.element.slice(1) : '';
        const elementDisplay = elementName ? ` | ${getElementIcon(card.element)} ${elementName}` : '';
        const rarityName = (card.rarity || 'common').charAt(0).toUpperCase() + (card.rarity || 'common').slice(1);
        const mythicalTag = card.mythical ? ' ✦' : '';
        document.getElementById('tooltip-desc').textContent = `Cost: ${card.cost} | ATK: ${card.atk} | HP: ${card.hp}${elementDisplay}`;
        document.getElementById('tooltip-combat').textContent = `⚔ ${card.combatAbility || 'None'}`;
        document.getElementById('tooltip-support').textContent = `✧ ${card.supportAbility || 'None'}`;
        
        // Display other ability if present
        const otherAbilityEl = document.getElementById('tooltip-other');
        if (otherAbilityEl) {
            if (card.otherAbility) {
                otherAbilityEl.textContent = `◈ ${card.otherAbility}`;
                otherAbilityEl.style.display = 'block';
            } else {
                otherAbilityEl.style.display = 'none';
            }
        }
        
        let evolutionText = '';
        if (card.evolvesInto) evolutionText = `◈ Transforms into: ${getCardDisplayName(card.evolvesInto)}`;
        else if (card.evolvesFrom) evolutionText = `◈ Transforms from: ${getCardDisplayName(card.evolvesFrom)}`;
        const rarityText = `💀 ${rarityName}${mythicalTag}`;
        document.getElementById('tooltip-evolution').textContent = evolutionText ? `${evolutionText} | ${rarityText}` : rarityText;
    } else if (card.type === 'trap') {
        document.getElementById('tooltip-desc').textContent = `Cost: ${card.cost} | Trap`;
        document.getElementById('tooltip-combat').textContent = `⚡ ${card.description || 'Triggered automatically'}`;
        document.getElementById('tooltip-support').textContent = card.triggerDescription || '';
        document.getElementById('tooltip-evolution').textContent = '';
        const otherEl = document.getElementById('tooltip-other');
        if (otherEl) otherEl.style.display = 'none';
    } else if (card.type === 'aura') {
        document.getElementById('tooltip-desc').textContent = `Cost: ${card.cost} | Aura (Enchant Ally)`;
        document.getElementById('tooltip-combat').textContent = `✨ ${card.description}`;
        let bonusText = '';
        if (card.atkBonus) bonusText += `+${card.atkBonus} ATK `;
        if (card.hpBonus) bonusText += `+${card.hpBonus} HP`;
        document.getElementById('tooltip-support').textContent = bonusText.trim() || '';
        document.getElementById('tooltip-evolution').textContent = '';
        const otherEl = document.getElementById('tooltip-other');
        if (otherEl) otherEl.style.display = 'none';
    } else if (card.type === 'pyre') {
        document.getElementById('tooltip-desc').textContent = `Free | Pyre Card (1/turn)`;
        document.getElementById('tooltip-combat').textContent = `🔥 ${card.description}`;
        document.getElementById('tooltip-support').textContent = '';
        document.getElementById('tooltip-evolution').textContent = '';
        const otherEl = document.getElementById('tooltip-other');
        if (otherEl) otherEl.style.display = 'none';
    } else {
        document.getElementById('tooltip-desc').textContent = `Cost: ${card.cost}`;
        document.getElementById('tooltip-combat').textContent = card.description;
        document.getElementById('tooltip-support').textContent = '';
        document.getElementById('tooltip-evolution').textContent = '';
        const otherEl = document.getElementById('tooltip-other');
        if (otherEl) otherEl.style.display = 'none';
    }
    
    tooltip.style.left = Math.min(x, window.innerWidth - 190) + 'px';
    tooltip.style.top = Math.max(y, 10) + 'px';
    tooltip.classList.add('show');
}

function hideTooltip() {
    const tooltip = document.getElementById('tooltip');
    if (tooltip) tooltip.classList.remove('show', 'has-sacrifice');
    const sacrificeBtn = document.getElementById('tooltip-sacrifice-btn');
    const bloodPactBtn = document.getElementById('tooltip-bloodpact-btn');
    const thermalBtn = document.getElementById('tooltip-thermal-btn');
    const rageHealBtn = document.getElementById('tooltip-rageheal-btn');
    const bloodFrenzyBtn = document.getElementById('tooltip-bloodfrenzy-btn');
    if (sacrificeBtn) sacrificeBtn.style.display = 'none';
    if (bloodPactBtn) bloodPactBtn.style.display = 'none';
    if (thermalBtn) thermalBtn.style.display = 'none';
    if (rageHealBtn) rageHealBtn.style.display = 'none';
    if (bloodFrenzyBtn) bloodFrenzyBtn.style.display = 'none';
    ui.cardTooltipVisible = false;
}

// ==================== EVENT HANDLERS ====================
document.getElementById('battlefield-area').onclick = (e) => {
    const battlefieldArea = document.getElementById('battlefield-area');
    const rect = battlefieldArea.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    let clickedTile = null;
    let minDist = Infinity;
    const tileSize = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tile-size')) || 80;
    const hitRadius = tileSize * 0.7;
    
    for (const [key, pos] of Object.entries(tilePositions)) {
        const dist = Math.sqrt(Math.pow(clickX - pos.x, 2) + Math.pow(clickY - pos.y, 2));
        if (dist < hitRadius && dist < minDist) { minDist = dist; clickedTile = key; }
    }
    
    if (clickedTile) {
        const [owner, col, row] = clickedTile.split('-');
        handleTileClick(owner, col, parseInt(row));
    } else {
        // Clicking empty battlefield area - check if pyre card is selected
        if (ui.selectedCard?.type === 'pyre') {
            if (game.canPlayPyreCard('player')) {
                executePyreCard(ui.selectedCard);
                return;
            } else {
                showMessage("Already played a Pyre card this turn", 1500);
            }
        }
        hideTooltip();
        ui.selectedCard = null; ui.attackingCryptid = null; ui.targetingBurst = null; ui.targetingEvolution = null; ui.targetingTrap = null; ui.targetingAura = null;
        document.getElementById('cancel-target').classList.remove('show');
        renderAll();
    }
};

function handleTileClick(owner, col, row) {
    if (isAnimating) return;
    // Prevent tile click if detail view was just triggered by long-press
    if (window.CardDetail?.wasJustTriggered?.()) return;
    hideTooltip();
    
    // Pyre cards activate when clicking anywhere on battlefield
    if (ui.selectedCard?.type === 'pyre') {
        if (game.canPlayPyreCard('player')) {
            executePyreCard(ui.selectedCard);
            return;
        } else {
            showMessage("Already played a Pyre card this turn", 1500);
            ui.selectedCard = null;
            renderAll();
            return;
        }
    }
    
    if (col === 'trap') {
        const traps = owner === 'player' ? game.playerTraps : game.enemyTraps;
        const trap = traps[row];
        if (owner === 'player' && ui.targetingTrap) {
            const validSlots = game.getValidTrapSlots('player');
            if (validSlots.some(s => s.row === row)) { executeTrapPlacement(row); return; }
        }
        if (owner === 'player' && trap) { showTrapTooltip(trap, row, owner); return; }
        return;
    }
    
    const colNum = parseInt(col);
    const field = owner === 'player' ? game.playerField : game.enemyField;
    const cryptid = field[colNum]?.[row];
    
    if (cryptid && owner === 'player' && ui.targetingEvolution) {
        const targets = game.getValidEvolutionTargets(ui.targetingEvolution, 'player');
        if (targets.some(t => t.col === colNum && t.row === row)) { executeEvolution(owner, colNum, row); return; }
    }
    
    if (!cryptid && owner === 'player' && (ui.selectedCard || ui.draggedCard)) {
        const card = ui.selectedCard || ui.draggedCard;
        // Kindling cards are free to play, regular cryptids require pyre
        const canAffordClick = card.isKindling || game.playerPyre >= card.cost;
        if (card.type === 'cryptid' && canAffordClick && (game.phase === 'conjure1' || game.phase === 'conjure2')) {
            const validSlots = game.getValidSummonSlots('player');
            if (validSlots.some(s => s.col === colNum && s.row === row)) { summonToSlot(colNum, row); return; }
        }
    }
    
    if (cryptid && owner === 'player') {
        const combatCol = game.getCombatCol('player');
        if (colNum === combatCol && game.phase === 'combat' && game.currentTurn === 'player' && !cryptid.tapped && cryptid.canAttack) {
            const wasSelected = ui.attackingCryptid === cryptid;
            selectAttacker(cryptid);
            if (!wasSelected) showCryptidTooltip(cryptid, colNum, row, owner);
            return;
        }
    }
    
    if (owner === 'enemy' && ui.attackingCryptid) {
        const targets = game.getValidAttackTargets(ui.attackingCryptid);
        if (targets.find(t => t.col === colNum && t.row === row)) { executeAttack(colNum, row); return; }
    }
    
    if (cryptid && ui.targetingBurst) {
        const targets = game.getValidBurstTargets(ui.targetingBurst, 'player');
        if (targets.some(t => t.owner === owner && t.col === colNum && t.row === row)) { executeBurst(owner, col, row); return; }
    }
    
    if (!cryptid && ui.targetingBurst) {
        const isTileTarget = ui.targetingBurst.targetType === 'tile' || ui.targetingBurst.targetType === 'enemyTile' || ui.targetingBurst.targetType === 'allyTile';
        if (isTileTarget) {
            const targets = game.getValidBurstTargets(ui.targetingBurst, 'player');
            if (targets.some(t => t.owner === owner && t.col === colNum && t.row === row)) { executeBurst(owner, col, row); return; }
        }
    }
    
    if (cryptid && owner === 'player' && ui.targetingAura) {
        const targets = game.getValidAuraTargets('player');
        if (targets.some(t => t.col === colNum && t.row === row)) { executeAura(colNum, row); return; }
    }
    
    if (cryptid) showCryptidTooltip(cryptid, col, row, owner);
}

function showCryptidTooltip(cryptid, col, row, owner) {
    const key = `${owner}-${col}-${row}`;
    const pos = tilePositions[key];
    if (!pos) return;
    
    const battlefieldArea = document.getElementById('battlefield-area');
    const rect = battlefieldArea.getBoundingClientRect();
    const tooltip = document.getElementById('tooltip');
    
    const combatCol = game.getCombatCol(owner);
    const supportCol = game.getSupportCol(owner);
    let displayAtk = cryptid.currentAtk - (cryptid.atkDebuff || 0) - (cryptid.curseTokens || 0);
    let displayHp = cryptid.currentHp;
    let displayMaxHp = cryptid.maxHp;
    
    if (col == combatCol) {
        const support = game.getFieldCryptid(owner, supportCol, row);
        if (support) {
            displayAtk += support.currentAtk - (support.atkDebuff || 0) - (support.curseTokens || 0);
            displayHp += support.currentHp;
            displayMaxHp += support.maxHp;
        }
    }
    
    let statusInfo = [];
    if (cryptid.burnTurns > 0) statusInfo.push(`🔥 Burning (${cryptid.burnTurns} turns)`);
    if (cryptid.paralyzed) statusInfo.push(`⚡ Paralyzed (${cryptid.paralyzeTurns || 1} turn${cryptid.paralyzeTurns !== 1 ? 's' : ''})`);
    if (cryptid.bleedTurns > 0) statusInfo.push(`🩸 Bleeding (${cryptid.bleedTurns} turns)`);
    if (cryptid.curseTokens > 0) statusInfo.push(`🔮 Cursed (-${cryptid.curseTokens} ATK)`);
    if (cryptid.calamityCounters > 0) statusInfo.push(`💀 Calamity (${cryptid.calamityCounters} turns)`);
    if (cryptid.protectionCharges > 0) statusInfo.push(`🛡️ Protected (${cryptid.protectionCharges})`);
    if (cryptid.hasFocus) statusInfo.push(`🎯 Focus`);
    if (cryptid.latchedTo) statusInfo.push(`🔗 Latched to enemy`);
    if (cryptid.latchedBy) statusInfo.push(`🔗 Latched by enemy`);
    if (cryptid.hasDestroyer) statusInfo.push(`💥 Destroyer`);
    if (game.isTileToxic(owner, col, row)) statusInfo.push(`☠ On Toxic Tile`);
    if (cryptid.auras?.length > 0) statusInfo.push(`✨ ${cryptid.auras.map(a => a.name).join(', ')}`);
    
    document.getElementById('tooltip-name').textContent = cryptid.name;
    const elementName = cryptid.element ? cryptid.element.charAt(0).toUpperCase() + cryptid.element.slice(1) : '';
    const elementDisplay = elementName ? ` | ${getElementIcon(cryptid.element)} ${elementName}` : '';
    document.getElementById('tooltip-desc').textContent = `HP: ${displayHp}/${displayMaxHp} | ATK: ${displayAtk}${elementDisplay}`;
    document.getElementById('tooltip-combat').textContent = `⚔ ${cryptid.combatAbility || 'None'}`;
    document.getElementById('tooltip-support').textContent = `✧ ${cryptid.supportAbility || 'None'}`;
    
    // Display other ability if present
    const otherAbilityEl = document.getElementById('tooltip-other');
    if (otherAbilityEl) {
        if (cryptid.otherAbility) {
            otherAbilityEl.textContent = `◈ ${cryptid.otherAbility}`;
            otherAbilityEl.style.display = 'block';
        } else {
            otherAbilityEl.style.display = 'none';
        }
    }
    
    // Handle sacrifice button
    const sacrificeBtn = document.getElementById('tooltip-sacrifice-btn');
    const canSacrifice = cryptid.hasSacrificeAbility && 
                         cryptid.sacrificeAbilityAvailable && 
                         cryptid.col === supportCol &&
                         owner === 'player' && 
                         game.currentTurn === 'player' &&
                         game.getCombatant(cryptid);
    
    if (canSacrifice) {
        sacrificeBtn.style.display = 'block';
        sacrificeBtn.onclick = (e) => {
            e.stopPropagation();
            if (cryptid.activateSacrifice) {
                const combatant = game.getCombatant(cryptid);
                GameEvents.emit('onActivatedAbility', { ability: 'sacrifice', card: cryptid, owner, col: cryptid.col, row: cryptid.row, target: combatant });
                cryptid.activateSacrifice(cryptid, game);
                hideTooltip();
                // Delay renderAll for death animation + promotion animation + buffer
                setTimeout(() => renderAll(), TIMING.deathAnim + TIMING.promoteAnim + 200);
            }
        };
        tooltip.classList.add('has-sacrifice');
    } else {
        sacrificeBtn.style.display = 'none';
        tooltip.classList.remove('has-sacrifice');
    }
    
    // Handle Blood Pact button (Vampire Neophyte)
    const bloodPactBtn = document.getElementById('tooltip-bloodpact-btn');
    const canBloodPact = cryptid.hasBloodPactAbility && 
                         cryptid.bloodPactAvailable && 
                         cryptid.col === supportCol &&
                         owner === 'player' && 
                         game.currentTurn === 'player' &&
                         game.getCombatant(cryptid);
    
    if (canBloodPact) {
        bloodPactBtn.style.display = 'block';
        bloodPactBtn.onclick = (e) => {
            e.stopPropagation();
            if (cryptid.activateBloodPact) {
                const combatant = game.getCombatant(cryptid);
                // Use effective HP (combatant + support) to determine if this will kill
                const effectiveHp = combatant ? game.getEffectiveHp(combatant) : 0;
                const willKill = effectiveHp <= 1;
                
                // Multiplayer hook - send ability activation BEFORE executing
                // Only send if not processing opponent action (to avoid echo)
                if (game.isMultiplayer && typeof window.Multiplayer !== 'undefined' && !window.Multiplayer.processingOpponentAction) {
                    window.Multiplayer.actionActivateAbility('bloodPact', cryptid.col, cryptid.row);
                }
                
                GameEvents.emit('onActivatedAbility', { ability: 'bloodPact', card: cryptid, owner, col: cryptid.col, row: cryptid.row, target: combatant, willKill });
                cryptid.activateBloodPact(cryptid, game);
                hideTooltip();
                
                if (willKill) {
                    // Combatant will die - delay for death + promotion
                    setTimeout(() => renderAll(), TIMING.deathAnim + TIMING.promoteAnim + 200);
                } else {
                    renderAll();
                }
            }
        };
        tooltip.classList.add('has-sacrifice');
    } else {
        bloodPactBtn.style.display = 'none';
    }
    
    // Handle Thermal Swap button (Stormhawk)
    const thermalBtn = document.getElementById('tooltip-thermal-btn');
    if (thermalBtn) {
        const canThermal = cryptid.hasThermalAbility && 
                           cryptid.thermalAvailable && 
                           cryptid.col === supportCol &&
                           owner === 'player' && 
                           game.currentTurn === 'player' &&
                           (game.phase === 'conjure1' || game.phase === 'conjure2');
        
        // Check if there's an adjacent support to swap with
        let hasAdjacentSupport = false;
        if (canThermal) {
            const field = game.playerField;
            const row = cryptid.row;
            if ((row > 0 && field[supportCol][row - 1]) || (row < 2 && field[supportCol][row + 1])) {
                hasAdjacentSupport = true;
            }
        }
        
        if (canThermal && hasAdjacentSupport) {
            thermalBtn.style.display = 'block';
            thermalBtn.onclick = (e) => {
                e.stopPropagation();
                // Find adjacent support to swap with (prefer above, then below)
                const field = game.playerField;
                const row = cryptid.row;
                let targetRow = null;
                if (row > 0 && field[supportCol][row - 1]) targetRow = row - 1;
                else if (row < 2 && field[supportCol][row + 1]) targetRow = row + 1;
                
                if (targetRow !== null && cryptid.activateThermal) {
                    // Multiplayer hook
                    if (game.isMultiplayer && typeof window.Multiplayer !== 'undefined' && !window.Multiplayer.processingOpponentAction) {
                        window.Multiplayer.actionActivateAbility('thermalSwap', cryptid.col, cryptid.row, { targetRow });
                    }
                    const swapTarget = field[supportCol][targetRow];
                    GameEvents.emit('onActivatedAbility', { ability: 'thermalSwap', card: cryptid, owner, col: cryptid.col, row: cryptid.row, targetRow, swapTarget });
                    cryptid.activateThermal(cryptid, game, targetRow);
                    hideTooltip();
                    renderAll();
                }
            };
            tooltip.classList.add('has-sacrifice');
        } else {
            thermalBtn.style.display = 'none';
        }
    }
    
    // Handle Rage Heal button (Adolescent Bigfoot)
    const rageHealBtn = document.getElementById('tooltip-rageheal-btn');
    if (rageHealBtn) {
        const canRageHeal = cryptid.hasRageHealAbility && 
                            cryptid.rageHealAvailable && 
                            cryptid.col === combatCol &&
                            owner === 'player' && 
                            game.currentTurn === 'player' &&
                            (cryptid.currentAtk || cryptid.atk) >= 1 &&
                            (game.phase === 'conjure1' || game.phase === 'conjure2');
        
        if (canRageHeal) {
            rageHealBtn.style.display = 'block';
            rageHealBtn.onclick = (e) => {
                e.stopPropagation();
                if (cryptid.activateRageHeal) {
                    // Multiplayer hook
                    if (game.isMultiplayer && typeof window.Multiplayer !== 'undefined' && !window.Multiplayer.processingOpponentAction) {
                        window.Multiplayer.actionActivateAbility('rageHeal', cryptid.col, cryptid.row);
                    }
                    GameEvents.emit('onActivatedAbility', { ability: 'rageHeal', card: cryptid, owner, col: cryptid.col, row: cryptid.row });
                    cryptid.activateRageHeal(cryptid, game);
                    hideTooltip();
                    renderAll();
                }
            };
            tooltip.classList.add('has-sacrifice');
        } else {
            rageHealBtn.style.display = 'none';
        }
    }
    
    // Handle Blood Frenzy button (Werewolf)
    const bloodFrenzyBtn = document.getElementById('tooltip-bloodfrenzy-btn');
    if (bloodFrenzyBtn) {
        const canBloodFrenzy = cryptid.hasBloodFrenzyAbility && 
                              cryptid.bloodFrenzyAvailable && 
                              cryptid.col === combatCol &&
                              owner === 'player' && 
                              game.currentTurn === 'player' &&
                              !cryptid.cursedToDie &&
                              (game.phase === 'conjure1' || game.phase === 'conjure2' || game.phase === 'combat');
        
        if (canBloodFrenzy) {
            bloodFrenzyBtn.style.display = 'block';
            bloodFrenzyBtn.onclick = (e) => {
                e.stopPropagation();
                if (cryptid.activateBloodFrenzy) {
                    cryptid.activateBloodFrenzy(cryptid, game);
                    hideTooltip();
                    renderAll();
                }
            };
            tooltip.classList.add('has-sacrifice');
        } else {
            bloodFrenzyBtn.style.display = 'none';
        }
    }
    
    if (cryptid.evolutionChain?.length > 1) {
        let evoText = `◈ Stage ${cryptid.evolutionChain.length} (${cryptid.evolutionChain.length} souls bound)`;
        if (statusInfo.length > 0) evoText += ` | ${statusInfo.join(' | ')}`;
        document.getElementById('tooltip-evolution').textContent = evoText;
    } else if (cryptid.getEvolution) {
        // Conditional evolution (e.g., Cursed Hybrid)
        const targetEvo = cryptid.getEvolution(cryptid);
        if (targetEvo) {
            let evoText = `◈ Will transform into: ${getCardDisplayName(targetEvo)}`;
            if (statusInfo.length > 0) evoText += ` | ${statusInfo.join(' | ')}`;
            document.getElementById('tooltip-evolution').textContent = evoText;
        } else {
            let evoText = `◈ Cannot evolve (stats equal)`;
            if (statusInfo.length > 0) evoText += ` | ${statusInfo.join(' | ')}`;
            document.getElementById('tooltip-evolution').textContent = evoText;
        }
    } else if (cryptid.evolvesInto) {
        let evoText = `◈ May transform into: ${getCardDisplayName(cryptid.evolvesInto)}`;
        if (cryptid.requiresSacrificeToEvolve) {
            evoText += ' (requires sacrifice)';
        }
        if (statusInfo.length > 0) evoText += ` | ${statusInfo.join(' | ')}`;
        document.getElementById('tooltip-evolution').textContent = evoText;
    } else {
        document.getElementById('tooltip-evolution').textContent = statusInfo.length > 0 ? statusInfo.join(' | ') : '';
    }
    
    const screenX = rect.left + pos.x;
    const screenY = rect.top + pos.y;
    tooltip.style.visibility = 'hidden';
    tooltip.classList.add('show');
    const tooltipWidth = tooltip.offsetWidth;
    tooltip.style.visibility = '';
    tooltip.style.left = (owner === 'player' ? Math.max(10, screenX - tooltipWidth - 20) : Math.min(screenX + 20, window.innerWidth - tooltipWidth - 10)) + 'px';
    tooltip.style.top = Math.max(screenY - 60, 10) + 'px';
}

function showTrapTooltip(trap, row, owner) {
    const key = `${owner}-trap-${row}`;
    const pos = tilePositions[key];
    if (!pos) return;
    
    const battlefieldArea = document.getElementById('battlefield-area');
    const rect = battlefieldArea.getBoundingClientRect();
    const tooltip = document.getElementById('tooltip');
    
    document.getElementById('tooltip-name').textContent = trap.name;
    document.getElementById('tooltip-desc').textContent = `Cost: ${trap.cost} | Trap`;
    document.getElementById('tooltip-combat').textContent = `⚡ ${trap.description || 'Triggered automatically'}`;
    document.getElementById('tooltip-support').textContent = trap.triggerDescription || '';
    document.getElementById('tooltip-evolution').textContent = '';
    
    const screenX = rect.left + pos.x;
    const screenY = rect.top + pos.y;
    tooltip.style.visibility = 'hidden';
    tooltip.classList.add('show');
    const tooltipWidth = tooltip.offsetWidth;
    tooltip.style.visibility = '';
    tooltip.style.left = (owner === 'player' ? Math.max(10, screenX - tooltipWidth - 20) : Math.min(screenX + 20, window.innerWidth - tooltipWidth - 10)) + 'px';
    tooltip.style.top = Math.max(screenY - 60, 10) + 'px';
}

document.getElementById('game-container').onclick = (e) => {
    if (e.target.id === 'game-container') {
        hideTooltip();
        ui.selectedCard = null; ui.attackingCryptid = null; ui.targetingBurst = null; ui.targetingEvolution = null;
        document.getElementById('cancel-target').classList.remove('show');
        renderAll();
    }
};

document.getElementById('hand-area').onclick = (e) => {
    if (['hand-area', 'hand-container', 'action-bar'].includes(e.target.id)) hideTooltip();
};

document.getElementById('hud').onclick = hideTooltip;
document.getElementById('phase-header').onclick = hideTooltip;

window.addEventListener('resize', debounce(() => {
    calculateTilePositions();
    updateSpritePositions();
    lastBattlefieldHeight = document.getElementById('battlefield-area').offsetHeight;
    // Re-apply card fan layout for responsive scaling
    applyCardFanLayout();
}, 50));

// Also handle orientation change explicitly
window.addEventListener('orientationchange', () => {
    // Delay to allow browser to complete orientation change
    setTimeout(() => {
        calculateTilePositions();
        updateSpritePositions();
        lastBattlefieldHeight = document.getElementById('battlefield-area').offsetHeight;
        applyCardFanLayout();
        renderAll();
    }, 150);
});

// Modern screen orientation API
if (screen.orientation) {
    screen.orientation.addEventListener('change', () => {
        setTimeout(() => {
            calculateTilePositions();
            updateSpritePositions();
            lastBattlefieldHeight = document.getElementById('battlefield-area').offsetHeight;
            applyCardFanLayout();
            renderAll();
        }, 150);
    });
}

// ==================== EXPOSE FOR AI MODULE ====================
window.TIMING = TIMING;
window.renderAll = renderAll;
window.renderSprites = renderSprites;
window.showMessage = showMessage;
window.updateButtons = updateButtons;
window.animateSupportPromotion = animateSupportPromotion;
window.checkCascadingDeaths = checkCascadingDeaths;
window.processPendingPromotions = processPendingPromotions;
window.animateTurnStartEffects = animateTurnStartEffects;
window.animateTurnEndEffects = animateTurnEndEffects;
window.initGame = initGame;

// Minimal game init for multiplayer (no coin flip, no AI, no auto-draw)
window.initMultiplayerGame = function() {
    game = new Game();
    window.pendingTraps = [];
    window.processingTraps = false;
    window.animatingTraps = new Set();
    EventLog.init();
    MatchLog.init(); // Initialize detailed match logging
    
    ui = {
        selectedCard: null, attackingCryptid: null, targetingBurst: null,
        targetingEvolution: null, targetingTrap: null, targetingAura: null,
        draggedCard: null, dragGhost: null, showingKindling: false,
        cardTooltipTimer: null, cardTooltipVisible: false, handCollapsed: false
    };
    window.ui = ui; // Keep window reference updated
    isAnimating = false;
    
    // Reset hand toggle visual state
    const handArea = document.getElementById('hand-area');
    const handContainer = document.getElementById('hand-container');
    if (handArea) handArea.classList.remove('collapsed');
    if (handContainer) handContainer.classList.remove('not-turn');
    
    // Set up shared game event listeners (same as single-player)
    setupGameEventListeners();
    
    window.game = game;
    console.log('[System] Multiplayer game initialized');
    return game;
};

// Shared event listeners for special card abilities - used by both single-player and multiplayer
function setupGameEventListeners() {
    console.log('[Setup] setupGameEventListeners called, clearing old listeners first');
    
    // Setup new hand area controls
    setupAdvancePhaseButton();
    ensureFanHoverEffects();
    
    // Clear ALL previous game event listeners to avoid duplicates
    // This is important when starting a new game after a previous one
    GameEvents.off();
    
    // Reset EventLog subscribed flag so it will re-subscribe
    EventLog.subscribed = false;
    EventLog.subscribeToEvents();
    EventLog.subscribed = true;
    
    // Subscribe MatchLog to all game events for detailed logging
    MatchLog.subscribeToEvents();
    
    console.log('[Setup] Listeners cleared and EventLog re-subscribed, setting up game listeners');
    
    // Phase timeline updates
    GameEvents.on('onPhaseChange', (data) => {
        updatePhaseTimeline(data.newPhase);
    });
    
    GameEvents.on('onTurnStart', (data) => {
        // Reset timeline to conjure1 at turn start
        updatePhaseTimeline('conjure1');
    });
    
    // Turn start UI reset
    GameEvents.on('onTurnStart', (data) => {
        if (data.owner === 'player') {
            ui.selectedCard = null;
            ui.attackingCryptid = null;
            ui.targetingBurst = null;
            ui.targetingEvolution = null;
            ui.targetingTrap = null;
            ui.targetingAura = null;
            ui.draggedCard = null;
            document.getElementById('cancel-target').classList.remove('show');
        }
    });
    
    // Lycanthrope Pack Growth - when support summoned, buff Lycanthrope/combatant
    GameEvents.on('onSummon', (data) => {
        if (!data.isSupport) return;
        const owner = data.owner;
        const field = owner === 'player' ? game.playerField : game.enemyField;
        
        for (let c = 0; c < 2; c++) {
            for (let r = 0; r < 3; r++) {
                const cryptid = field[c][r];
                if (!cryptid) continue;
                
                // Lycanthrope combat - gains +1/+1 when support summoned
                if (cryptid.hasPackGrowth && cryptid !== data.cryptid) {
                    cryptid.currentAtk = (cryptid.currentAtk || cryptid.atk) + 1;
                    cryptid.currentHp = (cryptid.currentHp || cryptid.hp) + 1;
                    cryptid.maxHp = (cryptid.maxHp || cryptid.hp) + 1;
                    GameEvents.emit('onPackGrowth', { cryptid, owner });
                }
                
                // Lycanthrope support - combatant gains +1/+1 when support summoned
                if (cryptid.hasPackLeader && cryptid !== data.cryptid) {
                    const combatant = game.getCombatant(cryptid);
                    if (combatant) {
                        combatant.currentAtk = (combatant.currentAtk || combatant.atk) + 1;
                        combatant.currentHp = (combatant.currentHp || combatant.hp) + 1;
                        combatant.maxHp = (combatant.maxHp || combatant.hp) + 1;
                        GameEvents.emit('onPackLeaderBuff', { support: cryptid, combatant, owner });
                    }
                }
            }
        }
    });
    
    // Not-Deer Death Watch - draw card when ally dies
    GameEvents.on('onDeath', (data) => {
        const owner = data.owner;
        const field = owner === 'player' ? game.playerField : game.enemyField;
        
        for (let c = 0; c < 2; c++) {
            for (let r = 0; r < 3; r++) {
                const cryptid = field[c][r];
                // Not-Deer support draws when ally dies
                if (cryptid?.hasDeathWatch && cryptid !== data.cryptid) {
                    game.drawCard(owner, 'deathWatch');
                    GameEvents.emit('onDeathWatchDraw', { watcher: cryptid, victim: data.cryptid, owner });
                }
            }
        }
    });
    
    // Hunt trap - trigger when enemy plays pyre card
    GameEvents.on('onPyreCardPlayed', (data) => {
        console.log('[Hunt Listener] Callback invoked! data.owner:', data.owner);
        const pyreOwner = data.owner;
        const trapOwner = pyreOwner === 'player' ? 'enemy' : 'player';
        const traps = trapOwner === 'player' ? game.playerTraps : game.enemyTraps;
        
        console.log('[Hunt] onPyreCardPlayed fired, pyreOwner:', pyreOwner, 'checking traps for:', trapOwner, 'traps:', traps);
        
        for (let i = 0; i < traps.length; i++) {
            const trap = traps[i];
            console.log('[Hunt] Checking trap slot', i, ':', trap?.key, trap?.triggerType);
            if (trap?.key === 'hunt' && trap.triggerType === 'onEnemyPyreCard') {
                // Get the pyre amount that was just gained
                const pyreGained = data.pyreGained || 1;
                
                console.log('[Hunt] TRIGGERED! Stealing', pyreGained, 'pyre');
                
                // Show trap trigger message
                showMessage(`🏹 Hunt! Stole ${pyreGained} pyre!`, 1500);
                
                // Animate the trap tile
                const trapTile = document.querySelector(`.tile.trap[data-owner="${trapOwner}"][data-row="${i}"]`);
                const trapSprite = document.querySelector(`.trap-sprite[data-owner="${trapOwner}"][data-row="${i}"]`);
                if (trapTile) {
                    trapTile.classList.add('trap-activating');
                    setTimeout(() => trapTile.classList.remove('trap-activating'), 600);
                }
                if (trapSprite) {
                    trapSprite.classList.add('trap-triggering');
                    setTimeout(() => trapSprite.classList.remove('trap-triggering'), 600);
                }
                
                // Steal the pyre
                const oldPlayerPyre = game.playerPyre;
                const oldEnemyPyre = game.enemyPyre;
                
                if (pyreOwner === 'player') game.playerPyre -= pyreGained;
                else game.enemyPyre -= pyreGained;
                
                if (trapOwner === 'player') game.playerPyre += pyreGained;
                else game.enemyPyre += pyreGained;
                
                // Emit pyre events so multiplayer sync triggers
                if (pyreOwner === 'player') {
                    GameEvents.emit('onPyreSpent', { owner: 'player', amount: pyreGained, oldValue: oldPlayerPyre, newValue: game.playerPyre, source: 'huntTrap' });
                }
                if (trapOwner === 'player') {
                    GameEvents.emit('onPyreGained', { owner: 'player', amount: pyreGained, oldValue: oldPlayerPyre, newValue: game.playerPyre, source: 'huntTrap' });
                }
                
                GameEvents.emit('onHuntSteal', { trap, stolenPyre: pyreGained, from: pyreOwner, to: trapOwner });
                GameEvents.emit('onTrapTriggered', { trap, owner: trapOwner, row: i });
                
                // Consume trap
                traps[i] = null;
                
                // Re-render to show pyre changes and trap removal
                setTimeout(() => {
                    if (typeof renderAll === 'function') renderAll();
                }, 100);
                
                break; // Only trigger one trap
            }
        }
    });
    
    console.log('[Setup] Hunt trap listener registered, total onPyreCardPlayed listeners:', GameEvents.listenerCount('onPyreCardPlayed'));
    
    // Immediate pyre display updates
    GameEvents.on('onPyreGained', (data) => {
        // Update HUD immediately when pyre is gained
        const pyreEl = document.getElementById('player-pyre');
        const enemyPyreEl = document.getElementById('enemy-pyre');
        if (pyreEl && game) pyreEl.textContent = game.playerPyre;
        if (enemyPyreEl && game) enemyPyreEl.textContent = game.enemyPyre;
        
        // Flash effect on pyre gained
        const targetEl = data.owner === 'player' ? pyreEl : enemyPyreEl;
        if (targetEl) {
            targetEl.classList.add('pyre-flash-gain');
            setTimeout(() => targetEl.classList.remove('pyre-flash-gain'), 400);
        }
    });
    
    GameEvents.on('onPyreSpent', (data) => {
        // Update HUD immediately when pyre is spent
        const pyreEl = document.getElementById('player-pyre');
        const enemyPyreEl = document.getElementById('enemy-pyre');
        if (pyreEl && game) pyreEl.textContent = game.playerPyre;
        if (enemyPyreEl && game) enemyPyreEl.textContent = game.enemyPyre;
        
        // Flash effect on pyre spent
        const targetEl = data.owner === 'player' ? pyreEl : enemyPyreEl;
        if (targetEl) {
            targetEl.classList.add('pyre-flash-spend');
            setTimeout(() => targetEl.classList.remove('pyre-flash-spend'), 400);
        }
    });
    
    // Also listen for Hunt trap steal (updates both pyres)
    GameEvents.on('onHuntSteal', (data) => {
        const pyreEl = document.getElementById('player-pyre');
        const enemyPyreEl = document.getElementById('enemy-pyre');
        if (pyreEl && game) pyreEl.textContent = game.playerPyre;
        if (enemyPyreEl && game) enemyPyreEl.textContent = game.enemyPyre;
    });
    
    // Hide overlays
    document.getElementById('game-over')?.classList.remove('show');
    document.getElementById('cancel-target')?.classList.remove('show');
}

window.calculateTilePositions = calculateTilePositions;
window.performAttackOnTarget = performAttackOnTarget;
window.playAttackAnimation = playAttackAnimation;

// Game initialization is handled by HomeScreen or MainMenu - no auto-init here

console.log('Game System loaded');