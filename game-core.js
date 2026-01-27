/**
 * Cryptid Fates - Game Core
 * Event systems, effect stack, logging, animations, and Game class
 * Part 1 of 2 - Load before game-ui.js
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
            if (!this.listeners[event]) return; // Guard against cleared listeners
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
        console.log('[GameEvents.emit] Called with event:', event);
        if (event === 'onDeath') {
            console.log('[GameEvents] Emitting onDeath, listener count:', this.listeners[event]?.length || 0);
        }
        if (!this.listeners[event]) return;
        const eventData = { ...data, eventName: event, timestamp: Date.now() };
        for (const listener of this.listeners[event]) {
            try {
                if (event === 'onDeath') {
                    console.log('[GameEvents] Calling onDeath listener');
                }
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

// ==================== EFFECT STACK SYSTEM ====================
// Unified queue for all game effects with proper resolution order
// Inspired by MTG's stack but adapted for Cryptid Fates' mechanics

const EffectStack = {
    // Priority levels - higher numbers resolve first
    PRIORITY: {
        IMMEDIATE: 10,      // Replacement effects (damage prevention, redirection)
        STATE_CHECK: 8,     // State-based actions (death checks)
        HIGH: 7,            // High priority triggers (protection, counters)
        NORMAL: 5,          // Standard triggered abilities
        LOW: 3,             // Delayed/end-of-resolution effects
        ANIMATION: 2,       // Visual effects (don't change game state)
        CLEANUP: 1          // Cleanup effects
    },
    
    // Effect types for categorization
    TYPE: {
        REPLACEMENT: 'replacement',     // Modifies/prevents another effect
        TRIGGERED: 'triggered',         // Ability triggered by event
        STATE_BASED: 'state_based',     // State checks (death, promotion)
        GAME_ACTION: 'game_action',     // Core game actions (damage, heal)
        ANIMATION: 'animation',         // Visual effect only
        CALLBACK: 'callback'            // Card ability callback
    },
    
    // The stack itself
    stack: [],
    
    // Currently resolving - prevents re-entry
    resolving: false,
    
    // Resolution history for debugging
    history: [],
    maxHistorySize: 100,
    
    // Pending triggered abilities waiting to be added
    pendingTriggers: [],
    
    // Flag to pause resolution (for animations)
    paused: false,
    
    // Resolution callbacks
    onResolutionComplete: null,
    
    // Debug mode
    debug: false,
    
    /**
     * Push an effect onto the stack
     * @param {Object} effect - The effect to queue
     * @param {string} effect.type - Effect type (from TYPE enum)
     * @param {number} effect.priority - Priority level (from PRIORITY enum)
     * @param {string} effect.name - Human-readable name for debugging
     * @param {Function} effect.execute - Function to execute the effect
     * @param {Object} effect.data - Associated data
     * @param {Object} effect.source - Source card/ability
     * @param {string} effect.owner - 'player' or 'enemy'
     * @param {boolean} effect.canBeResponded - Whether other effects can respond
     */
    push(effect) {
        // Validate effect
        if (!effect.execute || typeof effect.execute !== 'function') {
            console.error('[EffectStack] Effect must have an execute function:', effect);
            return;
        }
        
        // Set defaults
        effect.priority = effect.priority ?? this.PRIORITY.NORMAL;
        effect.type = effect.type ?? this.TYPE.GAME_ACTION;
        effect.name = effect.name ?? 'Unknown Effect';
        effect.timestamp = Date.now();
        effect.id = `effect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        effect.canBeResponded = effect.canBeResponded ?? true;
        
        // Add to stack
        this.stack.push(effect);
        
        // Sort by priority (higher first), then by timestamp (FIFO within same priority)
        this.stack.sort((a, b) => {
            if (b.priority !== a.priority) return b.priority - a.priority;
            return a.timestamp - b.timestamp;
        });
        
        if (this.debug) {
            console.log(`[EffectStack] Pushed: ${effect.name} (priority: ${effect.priority}, type: ${effect.type})`);
        }
        
        // Start resolution if not already resolving
        if (!this.resolving && !this.paused) {
            this.resolve();
        }
    },
    
    /**
     * Queue multiple effects at once
     */
    pushMultiple(effects) {
        effects.forEach(e => {
            e.priority = e.priority ?? this.PRIORITY.NORMAL;
            e.type = e.type ?? this.TYPE.GAME_ACTION;
            e.name = e.name ?? 'Unknown Effect';
            e.timestamp = Date.now();
            e.id = `effect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            this.stack.push(e);
        });
        
        this.stack.sort((a, b) => {
            if (b.priority !== a.priority) return b.priority - a.priority;
            return a.timestamp - b.timestamp;
        });
        
        if (!this.resolving && !this.paused) {
            this.resolve();
        }
    },
    
    /**
     * Main resolution loop
     */
    async resolve() {
        if (this.resolving || this.paused) return;
        this.resolving = true;
        
        try {
            while (this.stack.length > 0) {
                // Get the highest priority effect
                const effect = this.stack.shift();
                
                if (this.debug) {
                    console.log(`[EffectStack] Resolving: ${effect.name}`);
                }
                
                // Execute the effect
                try {
                    const result = await this.executeEffect(effect);
                    
                    // Log to history
                    this.addToHistory(effect, result);
                    
                    // Check for state-based actions after each resolution
                    await this.checkStateBasedActions();
                    
                    // Process any pending triggers that were added during execution
                    this.processPendingTriggers();
                    
                } catch (error) {
                    console.error(`[EffectStack] Error executing ${effect.name}:`, error);
                    this.addToHistory(effect, { error: error.message });
                }
                
                // Brief yield to allow UI updates
                if (effect.type === this.TYPE.ANIMATION) {
                    await new Promise(r => setTimeout(r, 0));
                }
            }
        } finally {
            this.resolving = false;
            
            // Call completion callback if set
            if (this.onResolutionComplete) {
                const callback = this.onResolutionComplete;
                this.onResolutionComplete = null;
                callback();
            }
        }
    },
    
    /**
     * Execute a single effect
     */
    async executeEffect(effect) {
        // Emit pre-resolution event for potential responses
        if (effect.canBeResponded) {
            GameEvents.emit('onEffectAboutToResolve', { effect });
        }
        
        // Check if effect was cancelled during response window
        if (effect.cancelled) {
            if (this.debug) {
                console.log(`[EffectStack] Effect cancelled: ${effect.name}`);
            }
            return { cancelled: true };
        }
        
        // Execute the effect
        const result = await effect.execute(effect.data, effect);
        
        // Emit post-resolution event
        GameEvents.emit('onEffectResolved', { effect, result });
        
        return result;
    },
    
    /**
     * Check for state-based actions (deaths, etc.)
     * These are checked between each effect resolution
     */
    async checkStateBasedActions() {
        if (!window.game) return;
        
        const deaths = [];
        
        // Check all cryptids for death (HP <= 0)
        for (const owner of ['player', 'enemy']) {
            const field = owner === 'player' ? game.playerField : game.enemyField;
            for (let col = 0; col < 2; col++) {
                for (let row = 0; row < 3; row++) {
                    const cryptid = field[col]?.[row];
                    if (cryptid && game.getEffectiveHp(cryptid) <= 0 && !cryptid._deathPending) {
                        cryptid._deathPending = true;
                        deaths.push({ cryptid, owner, col, row });
                    }
                }
            }
        }
        
        // Queue death effects
        for (const { cryptid, owner, col, row } of deaths) {
            this.queueTrigger({
                type: this.TYPE.STATE_BASED,
                priority: this.PRIORITY.STATE_CHECK,
                name: `Death: ${cryptid.name}`,
                source: cryptid,
                owner,
                data: { cryptid, owner, col, row },
                execute: async (data) => {
                    // The actual death handling is done by killCryptid
                    // This just ensures it's properly queued
                    if (data.cryptid._deathPending) {
                        delete data.cryptid._deathPending;
                        // Death will be handled by existing death check system
                        // We just mark it for processing
                        data.cryptid._markedForDeath = true;
                    }
                }
            });
        }
    },
    
    /**
     * Queue a triggered ability (will be processed after current effect resolves)
     */
    queueTrigger(trigger) {
        this.pendingTriggers.push(trigger);
    },
    
    /**
     * Process pending triggers - add them to the main stack
     */
    processPendingTriggers() {
        if (this.pendingTriggers.length === 0) return;
        
        const triggers = [...this.pendingTriggers];
        this.pendingTriggers = [];
        
        for (const trigger of triggers) {
            this.push(trigger);
        }
    },
    
    /**
     * Add effect to history for debugging
     */
    addToHistory(effect, result) {
        this.history.push({
            id: effect.id,
            name: effect.name,
            type: effect.type,
            priority: effect.priority,
            owner: effect.owner,
            timestamp: effect.timestamp,
            resolvedAt: Date.now(),
            result
        });
        
        // Trim history if too large
        if (this.history.length > this.maxHistorySize) {
            this.history = this.history.slice(-this.maxHistorySize);
        }
    },
    
    /**
     * Pause resolution (for animations or user input)
     */
    pause() {
        this.paused = true;
    },
    
    /**
     * Resume resolution
     */
    resume() {
        this.paused = false;
        if (this.stack.length > 0 && !this.resolving) {
            this.resolve();
        }
    },
    
    /**
     * Wait for current resolution to complete
     */
    waitForResolution() {
        return new Promise(resolve => {
            if (!this.resolving && this.stack.length === 0) {
                resolve();
            } else {
                this.onResolutionComplete = resolve;
            }
        });
    },
    
    /**
     * Clear the stack (emergency use only)
     */
    clear() {
        this.stack = [];
        this.pendingTriggers = [];
        this.resolving = false;
        this.paused = false;
    },
    
    /**
     * Get current stack state for debugging
     */
    getState() {
        return {
            stackSize: this.stack.length,
            resolving: this.resolving,
            paused: this.paused,
            pendingTriggers: this.pendingTriggers.length,
            stack: this.stack.map(e => ({ name: e.name, priority: e.priority, type: e.type })),
            recentHistory: this.history.slice(-10)
        };
    },
    
    /**
     * Enable/disable debug mode
     */
    setDebug(enabled) {
        this.debug = enabled;
        console.log(`[EffectStack] Debug mode: ${enabled ? 'ON' : 'OFF'}`);
    }
};

// ==================== EFFECT STACK HELPERS ====================
// Convenience functions for common effect patterns

const EffectHelpers = {
    /**
     * Queue a damage effect
     */
    queueDamage(source, target, damage, options = {}) {
        EffectStack.push({
            type: EffectStack.TYPE.GAME_ACTION,
            priority: options.priority ?? EffectStack.PRIORITY.NORMAL,
            name: `Damage: ${source?.name || 'Unknown'} → ${target?.name || 'Unknown'} (${damage})`,
            source,
            owner: source?.owner,
            data: { source, target, damage, ...options },
            execute: async (data) => {
                if (!data.target || data.target.currentHp === undefined) return { skipped: true };
                
                const hpBefore = data.target.currentHp;
                data.target.currentHp -= data.damage;
                
                GameEvents.emit('onDamageTaken', {
                    target: data.target,
                    damage: data.damage,
                    source: data.source,
                    sourceType: data.sourceType || 'effect',
                    hpBefore,
                    hpAfter: data.target.currentHp
                });
                
                return { damage: data.damage, hpBefore, hpAfter: data.target.currentHp };
            }
        });
    },
    
    /**
     * Queue a heal effect
     */
    queueHeal(target, amount, source, options = {}) {
        EffectStack.push({
            type: EffectStack.TYPE.GAME_ACTION,
            priority: options.priority ?? EffectStack.PRIORITY.NORMAL,
            name: `Heal: ${target?.name || 'Unknown'} (+${amount})`,
            source,
            owner: target?.owner,
            data: { target, amount, source, ...options },
            execute: async (data) => {
                if (!data.target) return { skipped: true };
                
                const hpBefore = data.target.currentHp;
                data.target.currentHp = Math.min(data.target.maxHp, data.target.currentHp + data.amount);
                const actualHeal = data.target.currentHp - hpBefore;
                
                if (actualHeal > 0) {
                    GameEvents.emit('onHeal', {
                        cryptid: data.target,
                        amount: actualHeal,
                        source: data.healSource || 'effect'
                    });
                }
                
                return { healed: actualHeal, hpBefore, hpAfter: data.target.currentHp };
            }
        });
    },
    
    /**
     * Queue a status effect application
     */
    queueStatus(target, status, options = {}) {
        EffectStack.push({
            type: EffectStack.TYPE.GAME_ACTION,
            priority: options.priority ?? EffectStack.PRIORITY.NORMAL,
            name: `Status: ${status} → ${target?.name || 'Unknown'}`,
            owner: target?.owner,
            data: { target, status, ...options },
            execute: async (data) => {
                if (!data.target || !window.game) return { skipped: true };
                
                switch (data.status) {
                    case 'burn':
                        game.applyBurn(data.target);
                        break;
                    case 'bleed':
                        game.applyBleed(data.target);
                        break;
                    case 'paralyze':
                        game.applyParalyze(data.target);
                        break;
                    case 'calamity':
                        game.applyCalamity(data.target, data.count || 1);
                        break;
                    case 'curse':
                        game.applyCurse(data.target, data.tokens || 1);
                        break;
                    case 'protection':
                        game.grantProtection(data.target, data.charges || 1);
                        break;
                }
                
                return { applied: data.status };
            }
        });
    },
    
    /**
     * Queue an animation effect (doesn't change game state)
     */
    queueAnimation(name, animFn, options = {}) {
        EffectStack.push({
            type: EffectStack.TYPE.ANIMATION,
            priority: options.priority ?? EffectStack.PRIORITY.ANIMATION,
            name: `Animation: ${name}`,
            canBeResponded: false,
            data: { animFn, ...options },
            execute: async (data) => {
                if (data.animFn) {
                    await data.animFn();
                }
                return { animated: true };
            }
        });
    },
    
    /**
     * Queue a card ability callback
     */
    queueCallback(card, callbackType, args, options = {}) {
        const callback = card[callbackType];
        if (!callback || typeof callback !== 'function') return;
        
        EffectStack.push({
            type: EffectStack.TYPE.CALLBACK,
            priority: options.priority ?? EffectStack.PRIORITY.NORMAL,
            name: `Callback: ${card.name}.${callbackType}`,
            source: card,
            owner: card.owner,
            data: { card, callbackType, args, ...options },
            execute: async (data) => {
                try {
                    GameEvents.emit('onCardCallback', {
                        type: data.callbackType,
                        card: data.card,
                        owner: data.card.owner,
                        ...data.args
                    });
                    
                    const result = data.card[data.callbackType](...Object.values(data.args));
                    return { result };
                } catch (error) {
                    console.error(`[EffectStack] Callback error ${data.card.name}.${data.callbackType}:`, error);
                    return { error: error.message };
                }
            }
        });
    },
    
    /**
     * Queue pyre gain
     */
    queuePyreGain(owner, amount, source, options = {}) {
        EffectStack.push({
            type: EffectStack.TYPE.GAME_ACTION,
            priority: options.priority ?? EffectStack.PRIORITY.NORMAL,
            name: `Pyre Gain: ${owner} +${amount}`,
            owner,
            data: { owner, amount, source, ...options },
            execute: async (data) => {
                if (!window.game) return { skipped: true };
                
                const oldPyre = data.owner === 'player' ? game.playerPyre : game.enemyPyre;
                if (data.owner === 'player') {
                    game.playerPyre += data.amount;
                } else {
                    game.enemyPyre += data.amount;
                }
                const newPyre = data.owner === 'player' ? game.playerPyre : game.enemyPyre;
                
                GameEvents.emit('onPyreGained', {
                    owner: data.owner,
                    amount: data.amount,
                    source: data.source,
                    oldValue: oldPyre,
                    newValue: newPyre
                });
                
                return { gained: data.amount, oldPyre, newPyre };
            }
        });
    },
    
    /**
     * Queue a triggered ability from a card
     * This is the proper way to queue ability effects that result from triggers
     */
    queueTriggeredAbility(card, triggerType, context, options = {}) {
        const callback = card[triggerType];
        if (!callback || typeof callback !== 'function') return;
        
        EffectStack.push({
            type: EffectStack.TYPE.TRIGGERED,
            priority: options.priority ?? EffectStack.PRIORITY.NORMAL,
            name: `Trigger: ${card.name}.${triggerType}`,
            source: card,
            owner: card.owner,
            data: { card, triggerType, context, ...options },
            execute: async (data) => {
                try {
                    // Emit the callback event
                    GameEvents.emit('onCardCallback', {
                        type: data.triggerType,
                        card: data.card,
                        owner: data.card.owner,
                        ...data.context
                    });
                    
                    // Execute the ability
                    const result = data.card[data.triggerType](data.card, ...Object.values(data.context));
                    return { result, triggered: true };
                } catch (error) {
                    console.error(`[EffectStack] Triggered ability error ${data.card.name}.${data.triggerType}:`, error);
                    return { error: error.message };
                }
            }
        });
    },
    
    /**
     * Queue a death trigger
     */
    queueDeathTrigger(cryptid, owner, killerOwner, options = {}) {
        if (!cryptid.onDeath) return;
        
        EffectStack.push({
            type: EffectStack.TYPE.TRIGGERED,
            priority: EffectStack.PRIORITY.NORMAL,
            name: `Death Trigger: ${cryptid.name}`,
            source: cryptid,
            owner,
            data: { cryptid, owner, killerOwner, ...options },
            execute: async (data) => {
                try {
                    if (data.cryptid.onDeath && window.game) {
                        GameEvents.emit('onCardCallback', { 
                            type: 'onDeath', 
                            card: data.cryptid, 
                            owner: data.owner 
                        });
                        data.cryptid.onDeath(data.cryptid, game);
                    }
                    return { triggered: true };
                } catch (error) {
                    console.error(`[EffectStack] Death trigger error ${data.cryptid.name}:`, error);
                    return { error: error.message };
                }
            }
        });
    },
    
    /**
     * Queue a kill trigger
     */
    queueKillTrigger(killer, victim, options = {}) {
        if (!killer.onKill) return;
        
        EffectStack.push({
            type: EffectStack.TYPE.TRIGGERED,
            priority: EffectStack.PRIORITY.NORMAL,
            name: `Kill Trigger: ${killer.name} killed ${victim.name}`,
            source: killer,
            owner: killer.owner,
            data: { killer, victim, ...options },
            execute: async (data) => {
                try {
                    if (data.killer.onKill && window.game) {
                        GameEvents.emit('onCardCallback', { 
                            type: 'onKill', 
                            card: data.killer, 
                            owner: data.killer.owner,
                            victim: data.victim
                        });
                        data.killer.onKill(data.killer, data.victim, game);
                    }
                    return { triggered: true };
                } catch (error) {
                    console.error(`[EffectStack] Kill trigger error ${data.killer.name}:`, error);
                    return { error: error.message };
                }
            }
        });
    }
};

// Make EffectStack globally available
window.EffectStack = EffectStack;
window.EffectHelpers = EffectHelpers;

/**
 * Wait for all effects to resolve (EffectStack + legacy queues)
 * Use this to ensure all triggered abilities and animations complete
 */
async function waitForAllEffects() {
    // Wait for EffectStack
    await EffectStack.waitForResolution();
    
    // Wait for legacy animation queue
    if (window.processingAbilityAnimations || (window.abilityAnimationQueue && window.abilityAnimationQueue.length > 0)) {
        await new Promise(resolve => {
            const check = () => {
                if (window.processingAbilityAnimations || (window.abilityAnimationQueue && window.abilityAnimationQueue.length > 0)) {
                    setTimeout(check, 50);
                } else {
                    resolve();
                }
            };
            check();
        });
    }
    
    // Wait for trap queue
    if (window.processingTraps || (window.pendingTraps && window.pendingTraps.length > 0)) {
        await new Promise(resolve => {
            const check = () => {
                if (window.processingTraps || (window.pendingTraps && window.pendingTraps.length > 0)) {
                    setTimeout(check, 50);
                } else {
                    resolve();
                }
            };
            check();
        });
    }
}

window.waitForAllEffects = waitForAllEffects;

// ==================== EVENT FEEDBACK SYSTEM ====================
// Provides clear, queued visual feedback for ALL game events
// Ensures players always know what's happening and why

const EventFeedback = {
    // Message queue for sequential display
    messageQueue: [],
    isProcessing: false,
    
    // Timing constants (ms)
    TIMING: {
        MESSAGE_DISPLAY: 1200,      // How long each message shows
        MESSAGE_GAP: 200,           // Gap between messages
        FLOATING_DURATION: 1500,    // Floating indicator duration
        FLOATING_RISE: 40           // How far floating text rises
    },
    
    // Message types with icons
    ICONS: {
        damage: '💥',
        heal: '💚',
        burn: '🔥',
        bleed: '🩸',
        paralyze: '⚡',
        calamity: '💀',
        curse: '🔮',
        protection: '🛡️',
        toxic: '☠️',
        pyre: '🔥',
        ability: '✨',
        summon: '⬆️',
        death: '☠️',
        evolve: '🔄',
        cleanse: '✨',
        buff: '⬆️',
        debuff: '⬇️',
        trap: '⚡',
        draw: '🃏'
    },
    
    /**
     * Queue a message for display
     * @param {string} text - The message text
     * @param {string} type - Message type for icon selection
     * @param {number} duration - Optional custom duration
     */
    queue(text, type = 'ability', duration = null) {
        const icon = this.ICONS[type] || '•';
        this.messageQueue.push({
            text: `${icon} ${text}`,
            duration: duration || this.TIMING.MESSAGE_DISPLAY,
            type
        });
        
        if (!this.isProcessing) {
            this.processQueue();
        }
    },
    
    /**
     * Process the message queue sequentially
     */
    async processQueue() {
        if (this.isProcessing || this.messageQueue.length === 0) return;
        this.isProcessing = true;
        
        while (this.messageQueue.length > 0) {
            const msg = this.messageQueue.shift();
            this.showCenterMessage(msg.text, msg.duration);
            await new Promise(r => setTimeout(r, msg.duration + this.TIMING.MESSAGE_GAP));
        }
        
        this.isProcessing = false;
    },
    
    /**
     * Show a centered message (uses existing message overlay)
     */
    showCenterMessage(text, duration) {
        const overlay = document.getElementById('message-overlay');
        const textEl = document.getElementById('message-text');
        if (!overlay || !textEl) return;
        
        textEl.textContent = text;
        overlay.classList.add('show');
        setTimeout(() => overlay.classList.remove('show'), duration);
    },
    
    /**
     * Show a floating indicator on a specific cryptid
     * @param {Object} cryptid - The cryptid to show indicator on
     * @param {string} text - The indicator text
     * @param {string} color - CSS color for the text
     */
    showFloatingIndicator(cryptid, text, color = '#ffffff') {
        if (!cryptid) return;
        
        const sprite = document.querySelector(
            `.cryptid-sprite[data-owner="${cryptid.owner}"][data-col="${cryptid.col}"][data-row="${cryptid.row}"]`
        );
        if (!sprite) return;
        
        const battlefield = document.getElementById('battlefield-area');
        if (!battlefield) return;
        
        const rect = sprite.getBoundingClientRect();
        const bfRect = battlefield.getBoundingClientRect();
        
        const indicator = document.createElement('div');
        indicator.className = 'floating-event-indicator';
        indicator.textContent = text;
        indicator.style.cssText = `
            position: absolute;
            left: ${rect.left - bfRect.left + rect.width/2}px;
            top: ${rect.top - bfRect.top}px;
            color: ${color};
            font-size: 16px;
            font-weight: bold;
            text-shadow: 0 0 4px black, 0 0 8px black;
            pointer-events: none;
            z-index: 1000;
            transform: translateX(-50%);
            animation: floatUp ${this.TIMING.FLOATING_DURATION}ms ease-out forwards;
        `;
        
        battlefield.appendChild(indicator);
        setTimeout(() => indicator.remove(), this.TIMING.FLOATING_DURATION);
    },
    
    /**
     * Show floating indicator on a tile position
     */
    showFloatingAtTile(owner, col, row, text, color = '#ffffff') {
        const key = `${owner}-${col}-${row}`;
        const pos = window.tilePositions?.[key];
        if (!pos) return;
        
        const battlefield = document.getElementById('battlefield-area');
        if (!battlefield) return;
        
        const indicator = document.createElement('div');
        indicator.className = 'floating-event-indicator';
        indicator.textContent = text;
        indicator.style.cssText = `
            position: absolute;
            left: ${pos.x}px;
            top: ${pos.y - 20}px;
            color: ${color};
            font-size: 16px;
            font-weight: bold;
            text-shadow: 0 0 4px black, 0 0 8px black;
            pointer-events: none;
            z-index: 1000;
            transform: translateX(-50%);
            animation: floatUp ${this.TIMING.FLOATING_DURATION}ms ease-out forwards;
        `;
        
        battlefield.appendChild(indicator);
        setTimeout(() => indicator.remove(), this.TIMING.FLOATING_DURATION);
    },
    
    /**
     * Clear all pending messages
     */
    clear() {
        this.messageQueue = [];
    },
    
    /**
     * Subscribe to game events and provide automatic feedback
     */
    subscribeToEvents() {
        // === DAMAGE MODIFIERS ===
        GameEvents.on('onDamageReduced', (data) => {
            const source = data.source || 'effect';
            const amount = data.reduction || data.originalDamage - data.finalDamage || 0;
            if (data.target) {
                this.showFloatingIndicator(data.target, `BLOCKED -${amount}`, '#4488ff');
            }
        });
        
        // Toxic tile damage reduction (attacker penalty)
        GameEvents.on('onAttackDeclared', (data) => {
            if (data.attacker && window.game) {
                const { owner, col, row } = data.attacker;
                if (game.isTileToxic(owner, col, row)) {
                    this.queue(`${data.attacker.name} weakened by toxic! (-1 damage)`, 'toxic');
                    this.showFloatingIndicator(data.attacker, '☠️ -1 DMG', '#88ff88');
                }
            }
        });
        
        // === STATUS EFFECTS ===
        GameEvents.on('onStatusApplied', (data) => {
            const name = data.cryptid?.name || 'Cryptid';
            const status = data.status;
            
            switch(status) {
                case 'burn':
                    this.queue(`${name} is burning!`, 'burn');
                    if (data.cryptid) this.showFloatingIndicator(data.cryptid, '🔥 BURN', '#ff6600');
                    break;
                case 'bleed':
                    this.queue(`${name} is bleeding!`, 'bleed');
                    if (data.cryptid) this.showFloatingIndicator(data.cryptid, '🩸 BLEED', '#cc0000');
                    break;
                case 'paralyze':
                    this.queue(`${name} is paralyzed!`, 'paralyze');
                    if (data.cryptid) this.showFloatingIndicator(data.cryptid, '⚡ PARALYZED', '#ffff00');
                    break;
                case 'calamity':
                    this.queue(`${name} afflicted with Calamity (${data.count || 1})!`, 'calamity');
                    if (data.cryptid) this.showFloatingIndicator(data.cryptid, `💀 CALAMITY ${data.count || 1}`, '#8800ff');
                    break;
                case 'curse':
                    this.queue(`${name} cursed! (-${data.tokens || 1} ATK)`, 'curse');
                    if (data.cryptid) this.showFloatingIndicator(data.cryptid, `🔮 -${data.tokens || 1} ATK`, '#aa00ff');
                    break;
                case 'protection':
                    this.queue(`${name} protected!`, 'protection');
                    if (data.cryptid) this.showFloatingIndicator(data.cryptid, '🛡️ PROTECTED', '#4488ff');
                    break;
            }
        });
        
        // Burn damage
        GameEvents.on('onBurnDamage', (data) => {
            const name = data.cryptid?.name || 'Cryptid';
            this.queue(`${name} takes burn damage!`, 'burn');
        });
        
        // Bleed damage (if we have this event)
        GameEvents.on('onBleedDamage', (data) => {
            const name = data.target?.name || 'Cryptid';
            this.queue(`${name} bleeds from wounds!`, 'bleed');
        });
        
        // Toxic damage
        GameEvents.on('onToxicDamage', (data) => {
            const name = data.target?.name || 'Cryptid';
            this.queue(`${name} takes toxic damage! (+1)`, 'toxic');
            if (data.target) this.showFloatingIndicator(data.target, '☠️ +1 DMG', '#88ff88');
        });
        
        // Toxic tile created
        GameEvents.on('onToxicApplied', (data) => {
            this.queue(`Toxic swamp spreads!`, 'toxic');
            this.showFloatingAtTile(data.owner, data.col, data.row, '☠️ TOXIC', '#88ff88');
        });
        
        // Calamity tick
        GameEvents.on('onCalamityTick', (data) => {
            const name = data.cryptid?.name || 'Cryptid';
            this.queue(`${name} Calamity: ${data.countersRemaining} turns remain`, 'calamity');
        });
        
        // Status wear off
        GameEvents.on('onStatusWearOff', (data) => {
            const name = data.cryptid?.name || 'Cryptid';
            const statusNames = { burn: 'burning', bleed: 'bleeding', curse: 'curse' };
            this.queue(`${name} is no longer ${statusNames[data.status] || data.status}!`, 'cleanse');
        });
        
        // === HEALING ===
        GameEvents.on('onHeal', (data) => {
            const name = data.cryptid?.name || 'Cryptid';
            const amount = data.amount || 0;
            if (amount > 0) {
                this.showFloatingIndicator(data.cryptid, `+${amount} HP`, '#44ff44');
            }
        });
        
        // === CLEANSE ===
        GameEvents.on('onCleanse', (data) => {
            const name = data.cryptid?.name || 'Cryptid';
            const count = data.count || data.ailmentsCleared || 0;
            if (count > 0) {
                this.queue(`${name} cleansed of ${count} ailment${count > 1 ? 's' : ''}!`, 'cleanse');
                if (data.cryptid) this.showFloatingIndicator(data.cryptid, '✨ CLEANSED', '#ffffff');
            }
        });
        
        // === ABILITY TRIGGERS ===
        GameEvents.on('onCardCallback', (data) => {
            const card = data.card;
            const type = data.type;
            if (!card) return;
            
            // Only show feedback for significant ability triggers
            switch(type) {
                case 'onCombat':
                    if (card.combatAbility) {
                        this.queue(`${card.name}: ${card.combatAbility.split(':')[0]}!`, 'ability');
                    }
                    break;
                case 'onEnterCombat':
                    // Don't double-announce if onCombat already fired
                    break;
                case 'onDeath':
                    if (card.supportAbility?.includes('On death') || card.combatAbility?.includes('On death')) {
                        this.queue(`${card.name} death trigger!`, 'death');
                    }
                    break;
                case 'onKill':
                    const victimName = data.victim?.name || 'enemy';
                    // Don't spam for basic kills, only special kill effects
                    break;
            }
        });
        
        // === PROTECTION ===
        GameEvents.on('onProtectionBlock', (data) => {
            const name = data.target?.name || 'Cryptid';
            this.queue(`${name}'s protection absorbs the hit!`, 'protection');
            if (data.target) this.showFloatingIndicator(data.target, '🛡️ BLOCKED', '#4488ff');
        });
        
        // Guard ability (Hellpup)
        GameEvents.on('onGuardUsed', (data) => {
            const name = data.cryptid?.name || 'Cryptid';
            this.queue(`${name} guards and burns the attacker!`, 'guard');
            if (data.cryptid) this.showFloatingIndicator(data.cryptid, '🛡️ GUARD', '#ff8800');
        });
        
        // === PYRE CHANGES ===
        GameEvents.on('onPyreGained', (data) => {
            const isPlayer = data.owner === 'player';
            const amount = data.amount || 0;
            if (amount > 0 && data.source) {
                // Only show message for significant pyre gains (not normal turn gain)
                if (data.source !== 'turnStart') {
                    this.queue(`${isPlayer ? 'You' : 'Enemy'} gained ${amount} Pyre!`, 'pyre');
                }
            }
        });
        
        // === EVOLUTION ===
        GameEvents.on('onEvolution', (data) => {
            const from = data.from?.name || 'Cryptid';
            const to = data.to?.name || 'evolved form';
            this.queue(`${from} evolves into ${to}!`, 'evolve');
        });
        
        // === DEATH ===
        GameEvents.on('onDeath', (data) => {
            const name = data.cryptid?.name || 'Cryptid';
            const isPlayer = data.owner === 'player';
            // Death counter increase is important info
            this.queue(`${name} was slain! (${isPlayer ? 'Your' : 'Enemy'} deaths: ${data.deathCount || '?'})`, 'death');
        });
        
        // === KILL ===
        GameEvents.on('onKill', (data) => {
            const killerName = data.killer?.name || 'Attacker';
            const victimName = data.victim?.name || 'target';
            // Only show if killer has onKill ability
            if (data.killer?.onKill) {
                this.queue(`${killerName} slays ${victimName}!`, 'death');
            }
        });
        
        // === LATCH ===
        GameEvents.on('onLatch', (data) => {
            const attackerName = data.attacker?.name || 'Cryptid';
            const targetName = data.target?.name || 'target';
            this.queue(`${attackerName} latched onto ${targetName}!`, 'ability');
        });
        
        // === DESTROYER ===
        GameEvents.on('onDestroyerDamage', (data) => {
            const attackerName = data.attacker?.name || 'Attacker';
            const supportName = data.target?.name || 'support';
            this.queue(`${attackerName} destroys ${supportName}!`, 'damage');
        });
        
        // === SPECIAL ABILITIES ===
        GameEvents.on('onActivatedAbility', (data) => {
            const cardName = data.card?.name || 'Cryptid';
            const abilityNames = {
                'bloodPact': 'Blood Pact',
                'sacrifice': 'Sacrifice',
                'thermal': 'Thermal Swap',
                'decayRatDebuff': 'Decay'
            };
            const abilityName = abilityNames[data.ability] || data.ability;
            this.queue(`${cardName} activates ${abilityName}!`, 'ability');
        });
        
        // === SNIPE ===
        GameEvents.on('onSnipeReveal', (data) => {
            const name = data.cryptid?.name || 'Snipe';
            this.queue(`${name} reveals itself!`, 'ability');
        });
        
        GameEvents.on('onSnipeDamage', (data) => {
            const sourceName = data.source?.name || 'Snipe';
            const targetName = data.target?.name || 'target';
            this.queue(`${sourceName} deals snipe damage to ${targetName}!`, 'damage');
        });
        
        // === MULTI-ATTACK / CLEAVE ===
        GameEvents.on('onCleaveDamage', (data) => {
            const attackerName = data.attacker?.name || 'Attacker';
            const targetName = data.target?.name || 'target';
            this.queue(`${attackerName} cleaves ${targetName}!`, 'damage');
        });
        
        GameEvents.on('onMultiAttackDamage', (data) => {
            const attackerName = data.attacker?.name || 'Attacker';
            const targetName = data.target?.name || 'target';
            this.queue(`${attackerName} strikes ${targetName}!`, 'damage');
        });
        
        console.log('[EventFeedback] Subscribed to game events');
    },
    
    /**
     * Initialize the EventFeedback system
     */
    init() {
        this.subscribeToEvents();
        console.log('[EventFeedback] System initialized');
    }
};

// Make globally available
window.EventFeedback = EventFeedback;

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
    // Setup horizontal wheel scrolling for the scroll wrapper
    const scrollWrapper = document.querySelector('.hand-scroll-wrapper');
    if (scrollWrapper) {
        // Convert vertical wheel to horizontal scroll
        scrollWrapper.addEventListener('wheel', (e) => {
            // Only handle if there's horizontal overflow
            if (scrollWrapper.scrollWidth > scrollWrapper.clientWidth) {
                e.preventDefault();
                // Use deltaY for vertical scroll wheel, deltaX for horizontal (trackpad)
                let delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
                
                // deltaMode: 0 = pixels (touchpad), 1 = lines (mouse wheel), 2 = pages
                // Touchpad pixel deltas are tiny (1-5px), mouse wheel line deltas are large (100+)
                // Apply multiplier for touchpad to make scrolling feel responsive
                if (e.deltaMode === 0) {
                    // Pixel mode (touchpad) - amplify the scroll amount
                    delta *= 2.5;
                } else if (e.deltaMode === 1) {
                    // Line mode (mouse wheel) - convert to reasonable pixel amount
                    delta *= 30;
                }
                
                scrollWrapper.scrollLeft += delta;
            }
        }, { passive: false });
        
        // Optional: drag to scroll on desktop (click and drag on empty space)
        let isScrollDragging = false;
        let scrollStartX = 0;
        let scrollLeft = 0;
        
        scrollWrapper.addEventListener('mousedown', (e) => {
            // Only start scroll drag if clicking on the wrapper or container, not on cards
            if (e.target === scrollWrapper || e.target.id === 'hand-container') {
                isScrollDragging = true;
                scrollWrapper.style.cursor = 'grabbing';
                scrollStartX = e.pageX - scrollWrapper.offsetLeft;
                scrollLeft = scrollWrapper.scrollLeft;
            }
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isScrollDragging) return;
            e.preventDefault();
            const x = e.pageX - scrollWrapper.offsetLeft;
            const walk = (x - scrollStartX) * 1.5; // Scroll speed multiplier
            scrollWrapper.scrollLeft = scrollLeft - walk;
        });
        
        document.addEventListener('mouseup', () => {
            if (isScrollDragging) {
                isScrollDragging = false;
                scrollWrapper.style.cursor = '';
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
// Store the handler reference so we can remove it before adding a new one
let advancePhaseHandler = null;

function setupAdvancePhaseButton() {
    const btn = document.getElementById('advance-phase-btn');
    if (!btn) return;
    
    // Remove any existing handler to prevent duplicate listeners
    if (advancePhaseHandler) {
        btn.removeEventListener('click', advancePhaseHandler);
    }
    
    // Create and store the new handler
    advancePhaseHandler = () => {
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
    };
    
    btn.addEventListener('click', advancePhaseHandler);
    
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
        
        // Guard (Hellpup)
        GameEvents.on('onGuardUsed', (data) => {
            this.log('ABILITY', 'Guard Used', {
                cardName: data.cryptid?.name,
                abilityName: 'Guard',
                col: data.cryptid?.col,
                row: data.cryptid?.row,
                effect: `Blocked attack from ${data.attacker?.name || 'attacker'} and burned them`,
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
                case 'decayRatDebuff':
                    description = 'Decay Activated';
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
        
        // Rooftop Gargoyle Stone Skin Save
        GameEvents.on('onGargoyleSave', (data) => {
            this.log('ABILITY', 'Stone Skin Save', {
                cardName: data.support?.name,
                abilityName: 'Stone Skin',
                target: data.combatant?.name,
                effect: data.fullHeal ? 'Saved at FULL HP (ailmented attacker)' : 'Saved at 1 HP',
                owner: data.owner
            });
        });
        
        // Gargoyle of the Grand Library - Stone Bastion half damage
        GameEvents.on('onStoneBastionHalfDamage', (data) => {
            this.log('ABILITY', 'Stone Bastion', {
                cardName: data.target?.name,
                abilityName: 'Stone Bastion',
                effect: `Half damage from ailmented attacker (${data.originalDamage} → ${data.reducedDamage})`,
                owner: data.owner
            });
        });
        
        // Gargoyle of the Grand Library - Draw on ailmented attack
        GameEvents.on('onGargoyleDrawFromDefense', (data) => {
            this.log('ABILITY', 'Stone Bastion Draw', {
                cardName: data.cryptid?.name,
                abilityName: 'Stone Bastion',
                effect: 'Drew a card after being attacked by ailmented enemy',
                owner: data.owner
            });
        });
        
        // Gargoyle of the Grand Library - Support draw on ailmented kill
        GameEvents.on('onLibraryGargoyleSupportDraw', (data) => {
            this.log('ABILITY', 'Library Gargoyle Support', {
                cardName: data.support?.name,
                abilityName: 'Support',
                target: data.target?.name,
                effect: 'Drew 2 cards after combatant killed ailmented enemy',
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
        
        // Rooftop Gargoyle Stone Skin Save
        GameEvents.on('onGargoyleSave', (data) => {
            const supportName = data.support?.name || 'Rooftop Gargoyle';
            const combatantName = data.combatant?.name || 'combatant';
            const isPlayer = data.owner === 'player';
            const effect = data.fullHeal ? 'restored to full HP' : 'saved at 1 HP';
            this.addEntry({
                type: 'ability', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '🗿',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${supportName}</span> ${effect} ${combatantName}!`
            });
        });
        
        // Gargoyle of the Grand Library - Stone Bastion half damage
        GameEvents.on('onStoneBastionHalfDamage', (data) => {
            const name = data.target?.name || 'Gargoyle';
            const isPlayer = data.owner === 'player';
            this.addEntry({
                type: 'ability', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '🗿',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${name}</span> Stone Bastion: halved damage (${data.originalDamage} → ${data.reducedDamage})!`
            });
        });
        
        // Gargoyle of the Grand Library - Draw on ailmented attack
        GameEvents.on('onGargoyleDrawFromDefense', (data) => {
            const name = data.cryptid?.name || 'Gargoyle';
            const isPlayer = data.owner === 'player';
            this.addEntry({
                type: 'ability', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '📚',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${name}</span> Stone Bastion: drew a card from ailmented attacker!`
            });
        });
        
        // Gargoyle of the Grand Library - Support draw on ailmented kill
        GameEvents.on('onLibraryGargoyleSupportDraw', (data) => {
            const supportName = data.support?.name || 'Gargoyle';
            const isPlayer = data.owner === 'player';
            this.addEntry({
                type: 'ability', ownerClass: isPlayer ? 'player-action' : 'enemy-action', icon: '📚',
                text: `<span class="name-${isPlayer ? 'player' : 'enemy'}">${supportName}</span> support: drew 2 cards from ailmented kill!`
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
    // Core animations (increased to prevent cut-off)
    attackAnim: 700,        // Attack lunge animation (140 anticipation + 160 lunge + 100 hitstop + 220 recovery + buffer)
    damageAnim: 750,        // Damage shake/flash
    deathAnim: 900,         // Death spiral animation  
    summonAnim: 850,        // Summon appearance (common 500ms, ultimate 1000ms - use middle ground + buffer)
    promoteAnim: 650,       // Promote slide animation
    evolveAnim: 1000,       // Evolution transformation
    protectionAnim: 850,    // Protection block glow (shield bubble is ~800ms)
    
    // Traps
    trapTriggerAnim: 1000,  // Trap activation flash
    trapMessageDelay: 500,  // Delay before trap message
    
    // Combat pacing (increased for smoother feel)
    attackDelay: 450,       // Delay between attack declaration and hit
    postAttackDelay: 700,   // Pause after attack resolves (was 500, increased to let animations complete)
    betweenAttacksDelay: 400, // Gap between sequential attacks
    
    // AI pacing
    aiPhaseDelay: 1000,     // AI thinking pause at phase start
    aiActionDelay: 900,     // Delay between AI actions
    aiAttackDelay: 700,     // AI attack timing (was 600)
    
    // UI feedback
    messageDisplay: 1400,   // How long messages show
    pyreBurnEffect: 1400,   // Pyre burn visual duration
    spellEffect: 900,       // Spell cast visual
    
    // Death/promotion cascade
    cascadeDelay: 450,      // Delay between death checks
    promotionPause: 350     // Pause after promotion
};

// ==================== TRAP QUEUE ====================
window.pendingTraps = [];
window.processingTraps = false;
window.deferTrapProcessing = false; // Set to true during multi-target damage chains
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
            // DON'T renderAll here - it causes promotion sprites to appear before animation
            // The renderAll inside checkAllCreaturesForDeath callback handles this after promotions
            
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
    if (trapSprite) {
        trapSprite.classList.add('trap-triggering');
        // After animation completes, mark as "animation-done" to prevent re-animation
        // if renderAll() is called. This is a safety net - the main fix is in renderSprites()
        // which no longer removes/re-appends animating sprites (which restarts animations)
        setTimeout(() => {
            if (trapSprite.isConnected) { // Only if still in DOM
                trapSprite.classList.add('trap-animation-done');
            }
        }, TIMING.trapTriggerAnim);
    }
    
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
// Kept as legacy system - EffectStack integration is optional for animations
window.abilityAnimationQueue = [];
window.processingAbilityAnimations = false;

// Queue an ability animation effect
// Automatically captures sprite references and HP at queue time so they're available
// even if the cryptid is killed before the animation plays
function queueAbilityAnimation(effect) {
    // Auto-capture target sprite if not already provided
    if (effect.target && !effect.targetSprite) {
        effect.targetSprite = document.querySelector(
            `.cryptid-sprite[data-owner="${effect.target.owner}"][data-col="${effect.target.col}"][data-row="${effect.target.row}"]`
        );
    }
    
    // Auto-capture source sprite if not already provided
    if (effect.source && !effect.sourceSprite) {
        effect.sourceSprite = document.querySelector(
            `.cryptid-sprite[data-owner="${effect.source.owner}"][data-col="${effect.source.col}"][data-row="${effect.source.row}"]`
        );
    }
    
    // Auto-capture target's current HP for accurate damage display (Option B: cap to HP lost)
    // This captures HP AFTER damage was applied, so we need to add back the damage to get "before"
    if (effect.target && effect.damage && effect.targetHpBefore === undefined) {
        // HP after damage + damage dealt = HP before damage
        effect.targetHpBefore = (effect.target.currentHp || 0) + (effect.damage || 0);
    }
    
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
    const { type, source, target, damage, message, owner, targetHpBefore } = effect;
    
    // Calculate displayed damage: cap to HP lost if target died (Option B)
    const targetDied = target && target.currentHp <= 0;
    const displayDamage = (targetDied && targetHpBefore !== undefined && damage)
        ? Math.min(damage, Math.max(0, targetHpBefore))
        : damage;
    
    // Use pre-captured sprites if provided (important for abilities that kill before animation)
    // Otherwise fall back to lookup by position
    let targetSprite = effect.targetSprite || null;
    if (!targetSprite && target) {
        targetSprite = document.querySelector(
            `.cryptid-sprite[data-owner="${target.owner}"][data-col="${target.col}"][data-row="${target.row}"]`
        );
    }
    
    let sourceSprite = effect.sourceSprite || null;
    if (!sourceSprite && source) {
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
                // Use new smooth JS-based hit effect
                if (window.playHitEffectOnSprite) {
                    window.playHitEffectOnSprite(targetSprite, target, { intensity: 'normal' });
                }
                
                // Add combat effects (particles, screen shake, damage number)
                if (window.CombatEffects && target) {
                    const battlefield = document.getElementById('battlefield-area');
                    if (battlefield) {
                        const rect = targetSprite.getBoundingClientRect();
                        const bRect = battlefield.getBoundingClientRect();
                        const impactX = rect.left + rect.width/2 - bRect.left;
                        const impactY = rect.top + rect.height/2 - bRect.top;
                        CombatEffects.createImpactParticles(impactX, impactY, '#aa66ff', 8);
                        CombatEffects.lightImpact();
                        CombatEffects.showDamageNumber(target, displayDamage);
                    }
                } else {
                    showFloatingDamage(target, displayDamage);
                }
                await new Promise(r => setTimeout(r, 300));
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
                // Use new smooth JS-based hit effect (heavy for counter)
                if (window.playHitEffectOnSprite) {
                    window.playHitEffectOnSprite(targetSprite, target, { intensity: 'heavy' });
                }
                
                // Add combat effects for counter damage
                if (window.CombatEffects && target) {
                    const battlefield = document.getElementById('battlefield-area');
                    if (battlefield) {
                        const rect = targetSprite.getBoundingClientRect();
                        const bRect = battlefield.getBoundingClientRect();
                        const impactX = rect.left + rect.width/2 - bRect.left;
                        const impactY = rect.top + rect.height/2 - bRect.top;
                        CombatEffects.createSparks(impactX, impactY, 10);
                        CombatEffects.heavyImpact(damage || 2);
                        CombatEffects.showDamageNumber(target, displayDamage, displayDamage >= 5);
                    }
                } else {
                    showFloatingDamage(target, displayDamage);
                }
                await new Promise(r => setTimeout(r, 350));
            }
            
            if (sourceSprite) sourceSprite.classList.remove('counter-attacking');
            await new Promise(r => setTimeout(r, 200));
            break;
            
        case 'cleave':
            // Show cleave hit on secondary target with effects
            if (message) showMessage(message, 600);
            if (targetSprite) {
                // Use new smooth JS-based hit effect
                if (window.playHitEffectOnSprite) {
                    window.playHitEffectOnSprite(targetSprite, target, { intensity: 'normal' });
                }
                
                // Add combat effects for cleave
                if (window.CombatEffects && target) {
                    const battlefield = document.getElementById('battlefield-area');
                    if (battlefield) {
                        const rect = targetSprite.getBoundingClientRect();
                        const bRect = battlefield.getBoundingClientRect();
                        const impactX = rect.left + rect.width/2 - bRect.left;
                        const impactY = rect.top + rect.height/2 - bRect.top;
                        CombatEffects.createSparks(impactX, impactY, 8);
                        CombatEffects.lightImpact();
                        CombatEffects.showDamageNumber(target, displayDamage);
                    }
                } else {
                    showFloatingDamage(target, displayDamage);
                }
                await new Promise(r => setTimeout(r, 300));
            }
            break;
            
        case 'multiAttack':
            // Show multi-attack hit with effects
            if (targetSprite) {
                // Use new smooth JS-based hit effect (light for rapid hits)
                if (window.playHitEffectOnSprite) {
                    window.playHitEffectOnSprite(targetSprite, target, { intensity: 'light' });
                }
                
                // Add combat effects for multi-attack
                if (window.CombatEffects && target) {
                    const battlefield = document.getElementById('battlefield-area');
                    if (battlefield) {
                        const rect = targetSprite.getBoundingClientRect();
                        const bRect = battlefield.getBoundingClientRect();
                        const impactX = rect.left + rect.width/2 - bRect.left;
                        const impactY = rect.top + rect.height/2 - bRect.top;
                        CombatEffects.createSparks(impactX, impactY, 6);
                        CombatEffects.lightImpact();
                        CombatEffects.showDamageNumber(target, displayDamage);
                    }
                } else {
                    showFloatingDamage(target, displayDamage);
                }
                await new Promise(r => setTimeout(r, 250));
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
            
            // Use enhanced attack animation if available
            if (window.CombatEffects?.playEnhancedAttack && sourceSprite) {
                const attackOwner = source?.owner || 'player';
                const attackDamage = damage || 2;
                const wasKilled = effect.killed || false;
                const targetRarity = effect.targetRarity || 'common';
                
                await new Promise(resolve => {
                    window.CombatEffects.playEnhancedAttack(
                        sourceSprite,
                        attackOwner,
                        targetSprite,
                        attackDamage,
                        // onImpact - start death animation if killed
                        () => {
                            if (wasKilled && targetSprite && window.CombatEffects?.playDramaticDeath) {
                                const targetOwner = target?.owner || (attackOwner === 'player' ? 'enemy' : 'player');
                                window.CombatEffects.playDramaticDeath(targetSprite, targetOwner, targetRarity);
                            }
                        },
                        // onComplete
                        resolve
                    );
                });
                
                // Wait for death animation to complete if target was killed
                if (wasKilled) {
                    await new Promise(r => setTimeout(r, TIMING.deathAnim || 700));
                }
            } else {
                // Fallback to basic animation
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
                    if (target && displayDamage) {
                        CombatEffects.showDamageNumber(target, displayDamage, displayDamage >= 5);
                    }
                }
                
                // Target takes damage
                if (targetSprite) {
                    if (window.playHitEffectOnSprite) {
                        window.playHitEffectOnSprite(targetSprite, target, { intensity: 'normal' });
                    }
                    await new Promise(r => setTimeout(r, 300));
                }
                
                if (sourceSprite) {
                    sourceSprite.classList.remove('attack-lunge');
                    sourceSprite.classList.add('attack-return');
                    await new Promise(r => setTimeout(r, 200));
                    sourceSprite.classList.remove('attack-return');
                }
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
// Exposed globally so other modules (collection, deckbuilder, shop) can use it
window.detectCardNameOverflow = function detectCardNameOverflow(container = document) {
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
        console.log('[Trap Setup] Setting up trap listeners');
        
        // Create named listener functions so we can remove only trap listeners
        this._trapListeners = this._trapListeners || {};
        this._trapUnsubscribers = this._trapUnsubscribers || {};
        
        // Remove old listeners using stored unsubscribe functions
        const events = ['onDamageTaken', 'onDeath', 'onSummon', 'onAttackDeclared', 'onHit', 'onSpellCast', 'onTurnStart', 'onPyreSpent'];
        events.forEach(event => {
            if (this._trapUnsubscribers[event]) {
                this._trapUnsubscribers[event]();
            }
        });
        
        // Create and register new trap listeners
        this._trapListeners.onDamageTaken = (data) => this.checkTraps('onDamageTaken', data);
        this._trapListeners.onDeath = (data) => {
            console.log('[Trap Listener] onDeath listener invoked');
            this.checkTraps('onDeath', data);
        };
        this._trapListeners.onSummon = (data) => this.checkTraps('onSummon', data);
        this._trapListeners.onAttackDeclared = (data) => this.checkTraps('onAttackDeclared', data);
        this._trapListeners.onHit = (data) => this.checkTraps('onHit', data);
        this._trapListeners.onSpellCast = (data) => this.checkTraps('onSpellCast', data);
        this._trapListeners.onTurnStart = (data) => this.checkTraps('onTurnStart', data);
        this._trapListeners.onPyreSpent = (data) => this.checkTraps('onPyreSpent', data);
        
        this._trapUnsubscribers.onDamageTaken = GameEvents.on('onDamageTaken', this._trapListeners.onDamageTaken);
        this._trapUnsubscribers.onDeath = GameEvents.on('onDeath', this._trapListeners.onDeath);
        this._trapUnsubscribers.onSummon = GameEvents.on('onSummon', this._trapListeners.onSummon);
        this._trapUnsubscribers.onAttackDeclared = GameEvents.on('onAttackDeclared', this._trapListeners.onAttackDeclared);
        this._trapUnsubscribers.onHit = GameEvents.on('onHit', this._trapListeners.onHit);
        this._trapUnsubscribers.onSpellCast = GameEvents.on('onSpellCast', this._trapListeners.onSpellCast);
        this._trapUnsubscribers.onTurnStart = GameEvents.on('onTurnStart', this._trapListeners.onTurnStart);
        this._trapUnsubscribers.onPyreSpent = GameEvents.on('onPyreSpent', this._trapListeners.onPyreSpent);
        
        console.log('[Trap Setup] Registered listeners. onDeath listener count:', GameEvents.listenerCount('onDeath'));
    }
    
    checkTraps(eventType, eventData) {
        console.log(`[Trap Check] Event: ${eventType}`, eventData);
        
        // Track which trap keys have already been queued for THIS event
        // If two copies of the SAME trap are in both slots, only the TOP slot (row 0) triggers
        // Different traps can both trigger for the same event
        const playerTriggeredKeys = new Set();
        const enemyTriggeredKeys = new Set();
        
        for (let row = 0; row < 2; row++) {
            const trap = this.playerTraps[row];
            if (trap && trap.triggerEvent === eventType) {
                // Skip if this trap key already triggered for this event
                if (playerTriggeredKeys.has(trap.key)) {
                    console.log(`[Trap Check] Player trap ${trap.name} at row ${row} skipped - same trap already triggered at earlier row`);
                    continue;
                }
                
                console.log(`[Trap Check] Player trap ${trap.name} matches event type ${eventType}`);
                const shouldTrigger = this.shouldTriggerTrap(trap, 'player', eventData);
                console.log(`[Trap Check] Player trap ${trap.name} shouldTrigger: ${shouldTrigger}`);
                if (shouldTrigger) {
                    playerTriggeredKeys.add(trap.key);
                    this.queueTrapTrigger('player', row, eventData);
                }
            }
        }
        for (let row = 0; row < 2; row++) {
            const trap = this.enemyTraps[row];
            if (trap && trap.triggerEvent === eventType) {
                // Skip if this trap key already triggered for this event
                if (enemyTriggeredKeys.has(trap.key)) {
                    console.log(`[Trap Check] Enemy trap ${trap.name} at row ${row} skipped - same trap already triggered at earlier row`);
                    continue;
                }
                
                console.log(`[Trap Check] Enemy trap ${trap.name} matches event type ${eventType}`);
                const shouldTrigger = this.shouldTriggerTrap(trap, 'enemy', eventData);
                console.log(`[Trap Check] Enemy trap ${trap.name} shouldTrigger: ${shouldTrigger}`);
                if (shouldTrigger) {
                    enemyTriggeredKeys.add(trap.key);
                    this.queueTrapTrigger('enemy', row, eventData);
                }
            }
        }
    }
    
    shouldTriggerTrap(trap, trapOwner, eventData) {
        if (!trap.triggerCondition) return true;
        const result = trap.triggerCondition(trap, trapOwner, eventData, this);
        if (!result) {
            console.log(`[Trap Condition] ${trap.name} condition failed. trapOwner: ${trapOwner}, eventData:`, {
                owner: eventData.owner,
                cryptidName: eventData.cryptid?.name,
                killedBySource: eventData.cryptid?.killedBySource?.name || 'none',
                killedBy: eventData.cryptid?.killedBy
            });
        }
        return result;
    }
    
    queueTrapTrigger(owner, row, eventData) {
        const trap = (owner === 'player' ? this.playerTraps : this.enemyTraps)[row];
        console.log(`[Trap Queue] Attempting to queue trap at ${owner} row ${row}:`, trap?.name);
        if (!trap) {
            console.log(`[Trap Queue] No trap found at ${owner} row ${row}`);
            return;
        }
        if (!window.pendingTraps) window.pendingTraps = [];
        
        // Prevent duplicate trap triggers
        const trapKey = `${owner}-trap-${row}`;
        const alreadyQueued = window.pendingTraps.some(p => p.owner === owner && p.row === row);
        const alreadyAnimating = window.animatingTraps?.has(trapKey);
        console.log(`[Trap Queue] ${trap.name}: alreadyQueued=${alreadyQueued}, alreadyAnimating=${alreadyAnimating}`);
        if (alreadyQueued || alreadyAnimating) {
            console.log(`[Trap Queue] Skipping duplicate trap`);
            return;
        }
        
        console.log(`[Trap Queue] Queueing ${trap.name}, processingTraps=${window.processingTraps}, deferTrapProcessing=${window.deferTrapProcessing}`);
        window.pendingTraps.push({ owner, row, trap, eventData });
        
        // If trap processing is deferred (during multi-target damage chains), just queue it
        // The caller will call startTrapProcessing() when the chain is complete
        if (window.deferTrapProcessing) {
            console.log(`[Trap Queue] Trap deferred - will process after current chain completes`);
            return;
        }
        
        if (!window.processingTraps) {
            window.processingTraps = true;
            console.log(`[Trap Queue] Starting trap queue processing`);
            setTimeout(() => processTrapQueue(), 50);
        } else {
            console.log(`[Trap Queue] Already processing, trap will be picked up on next iteration`);
        }
    }
    
    // Call this to start processing any deferred traps
    startTrapProcessing() {
        if (window.deferTrapProcessing) {
            console.log('[Trap Queue] Cannot start - still deferring');
            return;
        }
        if (window.pendingTraps && window.pendingTraps.length > 0 && !window.processingTraps) {
            window.processingTraps = true;
            console.log(`[Trap Queue] Starting deferred trap processing (${window.pendingTraps.length} traps queued)`);
            setTimeout(() => processTrapQueue(), 50);
        }
    }
    
    triggerTrap(owner, row, eventData) {
        const traps = owner === 'player' ? this.playerTraps : this.enemyTraps;
        const trap = traps[row];
        if (!trap) return;
        
        // Remove trap from slot BEFORE executing effect to prevent re-triggering
        // if the effect causes another death/event
        traps[row] = null;
        
        GameEvents.emit('onTrapTriggered', { trap, owner, row, triggerEvent: eventData });
        if (trap.effect) trap.effect(this, owner, row, eventData);
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
    
    // Map field row (0,1,2) to trap slot (0,1). Row 1 (center) has no corresponding trap slot.
    fieldRowToTrapSlot(fieldRow) {
        if (fieldRow === 0) return 0;  // Top row → trap slot 0
        if (fieldRow === 2) return 1;  // Bottom row → trap slot 1
        return null;  // Center row (1) has no trap slot
    }
    
    // Destroy a trap, checking for protection (Boggart ability)
    // Returns true if destroyed, false if protected or no trap
    destroyTrap(owner, trapSlot, destroyer = null) {
        const traps = owner === 'player' ? this.playerTraps : this.enemyTraps;
        const trap = traps[trapSlot];
        if (!trap) return false;
        
        // Check if trap is protected (Boggart support ability)
        if (trap.protected) {
            GameEvents.emit('onTrapProtected', { trap, owner, trapSlot, destroyer });
            console.log(`[Trap] Protected trap at ${owner} slot ${trapSlot} cannot be destroyed`);
            return false;
        }
        
        traps[trapSlot] = null;
        GameEvents.emit('onTrapDestroyed', { trap, owner, trapSlot, destroyer });
        return true;
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
        const enemyField = owner === 'player' ? this.enemyField : this.playerField;
        const supportCol = this.getSupportCol(owner);
        const enemySupportCol = this.getSupportCol(owner === 'player' ? 'enemy' : 'player');
        
        // Check all friendly supports for cost modifiers (reductions)
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
        
        // Check enemy supports for cost increases (e.g., El Duende's enemyTrapCostModifier)
        for (let r = 0; r < 3; r++) {
            const enemySupport = enemyField[enemySupportCol][r];
            if (enemySupport?.enemyTrapCostModifier && card.type === 'trap') {
                cost += enemySupport.enemyTrapCostModifier;
            }
            if (enemySupport?.enemyAuraCostModifier && card.type === 'aura') {
                cost += enemySupport.enemyAuraCostModifier;
            }
            if (enemySupport?.enemyBurstCostModifier && card.type === 'burst') {
                cost += enemySupport.enemyBurstCostModifier;
            }
            if (enemySupport?.enemyCryptidCostModifier && card.type === 'cryptid') {
                cost += enemySupport.enemyCryptidCostModifier;
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
            
            // Queue destroyer animation (sprites auto-captured at queue time)
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
    applyBurn(cryptid, turns = 3) {
        if (!cryptid) return false;
        
        // Check for ailment immunity (Boggart)
        if (cryptid.ailmentImmune && cryptid.onAilmentAttempt) {
            return cryptid.onAilmentAttempt(cryptid, 'burn', this);
        }
        
        // Check for Mothman support immunity (combatants protected while Mothman is support)
        if (cryptid.hasMothmanAilmentImmunity) {
            console.log(`[Mothman Immunity] ${cryptid.name} is immune to burn`);
            GameEvents.emit('onAilmentBlocked', { cryptid, ailment: 'burn', source: 'Mothman' });
            return false;
        }
        
        const wasAlreadyBurning = cryptid.burnTurns > 0;
        cryptid.burnTurns = turns;
        GameEvents.emit('onStatusApplied', { status: 'burn', cryptid, owner: cryptid.owner, refreshed: wasAlreadyBurning, turns });
        this.updateAllGremlinDebuffs(); // Update Gremlin ATK debuffs
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
        
        // Check for ailment immunity (Boggart)
        if (cryptid.ailmentImmune && cryptid.onAilmentAttempt) {
            return cryptid.onAilmentAttempt(cryptid, 'calamity', this);
        }
        
        // Check for Mothman support immunity (combatants protected while Mothman is support)
        if (cryptid.hasMothmanAilmentImmunity) {
            console.log(`[Mothman Immunity] ${cryptid.name} is immune to calamity`);
            GameEvents.emit('onAilmentBlocked', { cryptid, ailment: 'calamity', source: 'Mothman' });
            return false;
        }
        
        cryptid.calamityCounters = count;
        cryptid.hadCalamity = true;
        GameEvents.emit('onStatusApplied', { status: 'calamity', cryptid, owner: cryptid.owner, count });
        this.updateAllGremlinDebuffs(); // Update Gremlin ATK debuffs
        return true;
    }
    
    // Paralyze - prevents untap on owner's next turn, then clears
    applyParalyze(cryptid) {
        if (!cryptid || cryptid.paralyzed) return false;
        
        // Check for ailment immunity (Boggart)
        if (cryptid.ailmentImmune && cryptid.onAilmentAttempt) {
            return cryptid.onAilmentAttempt(cryptid, 'paralyze', this);
        }
        
        // Check for Mothman support immunity (combatants protected while Mothman is support)
        if (cryptid.hasMothmanAilmentImmunity) {
            console.log(`[Mothman Immunity] ${cryptid.name} is immune to paralyze`);
            GameEvents.emit('onAilmentBlocked', { cryptid, ailment: 'paralyze', source: 'Mothman' });
            return false;
        }
        
        cryptid.paralyzed = true;
        cryptid.paralyzeTurns = 1; // Skip exactly 1 untap phase
        cryptid.tapped = true;
        cryptid.canAttack = false;
        console.log(`[Paralyze] Applied to ${cryptid.name} (${cryptid.owner}): will skip 1 untap`);
        GameEvents.emit('onStatusApplied', { status: 'paralyze', cryptid, owner: cryptid.owner });
        this.updateAllGremlinDebuffs(); // Update Gremlin ATK debuffs
        return true;
    }
    
    // Bleed - 2x damage from attacks, lasts 3 turns
    applyBleed(cryptid) {
        if (!cryptid) return false;
        
        // Check for ailment immunity (Boggart)
        if (cryptid.ailmentImmune && cryptid.onAilmentAttempt) {
            return cryptid.onAilmentAttempt(cryptid, 'bleed', this);
        }
        
        // Check for Mothman support immunity (combatants protected while Mothman is support)
        if (cryptid.hasMothmanAilmentImmunity) {
            console.log(`[Mothman Immunity] ${cryptid.name} is immune to bleed`);
            GameEvents.emit('onAilmentBlocked', { cryptid, ailment: 'bleed', source: 'Mothman' });
            return false;
        }
        
        const wasAlreadyBleeding = cryptid.bleedTurns > 0;
        cryptid.bleedTurns = 3;
        GameEvents.emit('onStatusApplied', { status: 'bleed', cryptid, owner: cryptid.owner, refreshed: wasAlreadyBleeding });
        this.updateAllGremlinDebuffs(); // Update Gremlin ATK debuffs
        return true;
    }
    
    // Curse - each token reduces ATK by 1 (min 0), cleanses 1 per turn
    applyCurse(cryptid, tokens = 1) {
        if (!cryptid || cryptid.curseImmune) return false;
        
        // Check for Mothman support immunity (combatants protected while Mothman is support)
        if (cryptid.hasMothmanAilmentImmunity) {
            console.log(`[Mothman Immunity] ${cryptid.name} is immune to curse`);
            GameEvents.emit('onAilmentBlocked', { cryptid, ailment: 'curse', source: 'Mothman' });
            return false;
        }
        
        cryptid.curseTokens = (cryptid.curseTokens || 0) + tokens;
        GameEvents.emit('onStatusApplied', { status: 'curse', cryptid, owner: cryptid.owner, tokens, totalTokens: cryptid.curseTokens });
        this.updateAllGremlinDebuffs(); // Update Gremlin ATK debuffs
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
    
    // Clean up Decay Rat debuffs at end of turn
    cleanupDecayRatDebuffs(owner) {
        const cleanupField = (field) => {
            for (let col = 0; col < 2; col++) {
                for (let row = 0; row < 3; row++) {
                    const c = field[col]?.[row];
                    if (c && c.hasDecayRatDebuff && c.decayRatDebuffOwner === owner) {
                        // Restore HP (but don't exceed max)
                        const hpToRestore = c.decayRatHpDebuff || 0;
                        c.currentHp = Math.min(
                            (c.maxHp || c.hp),
                            (c.currentHp || c.hp) + hpToRestore
                        );
                        
                        // Clear debuff tracking
                        c.decayRatAtkDebuff = 0;
                        c.decayRatHpDebuff = 0;
                        c.hasDecayRatDebuff = false;
                        c.decayRatDebuffOwner = null;
                    }
                }
            }
        };
        
        cleanupField(this.playerField);
        cleanupField(this.enemyField);
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
    
    // Get all adjacent cryptids on the SAME side (above, below, and to the side/behind)
    // Used for spreading effects like Hellhound's burn spread
    getAdjacentCryptids(cryptid) {
        if (!cryptid) return [];
        const { owner, col, row } = cryptid;
        const field = owner === 'player' ? this.playerField : this.enemyField;
        const adjacent = [];
        
        // Above (same column, row - 1)
        if (row > 0) {
            const above = field[col][row - 1];
            if (above) adjacent.push(above);
        }
        
        // Below (same column, row + 1)
        if (row < 2) {
            const below = field[col][row + 1];
            if (below) adjacent.push(below);
        }
        
        // To the side (other column, same row - combat/support partner)
        const otherCol = col === 0 ? 1 : 0;
        const side = field[otherCol][row];
        if (side) adjacent.push(side);
        
        return adjacent;
    }
    
    // Calculate Gremlin ailment tokens for an enemy
    countAilmentTokens(cryptid) {
        if (!cryptid) return 0;
        let tokens = 0;
        if (cryptid.burnTurns > 0) tokens += cryptid.burnTurns;
        if (cryptid.paralyzed || cryptid.paralyzeTurns > 0) tokens += 1;
        if (cryptid.bleedTurns > 0) tokens += cryptid.bleedTurns;
        if (cryptid.calamityCounters > 0) tokens += cryptid.calamityCounters;
        if (cryptid.curseTokens > 0) tokens += cryptid.curseTokens;
        return tokens;
    }
    
    // Update Gremlin's ATK debuff on enemy across (called when Gremlin enters combat or ailments change)
    updateGremlinDebuff(gremlin) {
        if (!gremlin?.appliesAilmentAtkDebuff) return;
        
        const enemyAcross = this.getEnemyCombatantAcross(gremlin);
        if (enemyAcross) {
            const tokens = this.countAilmentTokens(enemyAcross);
            enemyAcross.gremlinAtkDebuff = tokens;
            enemyAcross.gremlinDebuffSource = gremlin;
            
            if (tokens > 0) {
                GameEvents.emit('onGremlinAtkDebuff', { gremlin, target: enemyAcross, debuff: tokens });
            }
        }
    }
    
    // Update all Gremlin debuffs (called when ailments change on any cryptid)
    updateAllGremlinDebuffs() {
        // Check both player and enemy fields for Gremlins in combat
        for (const owner of ['player', 'enemy']) {
            const field = owner === 'player' ? this.playerField : this.enemyField;
            const combatCol = this.getCombatCol(owner);
            
            for (let row = 0; row < 3; row++) {
                const cryptid = field[combatCol]?.[row];
                if (cryptid?.appliesAilmentAtkDebuff) {
                    this.updateGremlinDebuff(cryptid);
                }
            }
        }
    }
    
    // Remove Gremlin debuff from an enemy (called when Gremlin dies or leaves combat)
    removeGremlinDebuff(gremlin) {
        // Find and clear debuff from any enemy that was debuffed by this Gremlin
        for (const owner of ['player', 'enemy']) {
            const field = owner === 'player' ? this.playerField : this.enemyField;
            for (let col = 0; col < 2; col++) {
                for (let row = 0; row < 3; row++) {
                    const cryptid = field[col]?.[row];
                    if (cryptid?.gremlinDebuffSource === gremlin) {
                        cryptid.gremlinAtkDebuff = 0;
                        cryptid.gremlinDebuffSource = null;
                    }
                }
            }
        }
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
        let burnChanged = false;
        for (let c = 0; c < 2; c++) {
            for (let r = 0; r < 3; r++) {
                const cryptid = field[c][r];
                if (cryptid && cryptid.burnTurns > 0) {
                    cryptid.currentHp -= 1;
                    cryptid.burnTurns--;
                    burnChanged = true;
                    GameEvents.emit('onBurnDamage', { cryptid, owner, damage: 1, turnsRemaining: cryptid.burnTurns });
                    // Use getEffectiveHp to consider support HP pooling for combatants
                    if (this.getEffectiveHp(cryptid) <= 0) deaths.push({ cryptid, col: c, row: r });
                }
            }
        }
        // Update Gremlin debuffs if any burn changed
        if (burnChanged) this.updateAllGremlinDebuffs();
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
        // Ailments (negative effects)
        if (cryptid.burnTurns > 0) {
            const turns = cryptid.burnTurns;
            icons.push({ 
                icon: '🔥', 
                category: 'ailment-burn', 
                count: turns > 1 ? turns : null, 
                tooltip: `Burn: ${turns} turn${turns > 1 ? 's' : ''} remaining. Takes 1 damage at turn start.`
            });
        }
        if (cryptid.paralyzed) {
            const turns = cryptid.paralyzeTurns || 1;
            icons.push({ 
                icon: '⚡', 
                category: 'ailment-paralyze', 
                count: turns > 1 ? turns : null, 
                tooltip: `Paralyzed: ${turns} turn${turns > 1 ? 's' : ''} remaining. Cannot untap or attack.`
            });
        }
        if (cryptid.bleedTurns > 0) {
            const turns = cryptid.bleedTurns;
            icons.push({ 
                icon: '🩸', 
                category: 'ailment-bleed', 
                count: turns > 1 ? turns : null, 
                tooltip: `Bleed: ${turns} turn${turns > 1 ? 's' : ''} remaining. Takes double damage when attacked.`
            });
        }
        if (cryptid.curseTokens > 0) {
            const stacks = cryptid.curseTokens;
            icons.push({ 
                icon: '🔮', 
                category: 'ailment-curse', 
                count: stacks, 
                tooltip: `Curse: ${stacks} stack${stacks > 1 ? 's' : ''}. -${stacks} ATK. Dies instantly at 3 stacks.`
            });
        }
        if (cryptid.calamityCounters > 0) {
            const stacks = cryptid.calamityCounters;
            icons.push({ 
                icon: '💀', 
                category: 'ailment-calamity', 
                count: stacks, 
                tooltip: `Calamity: ${stacks}/3 counters. Dies instantly when reaching 3 counters.`
            });
        }
        // Buffs/abilities (positive effects)
        if (cryptid.protectionCharges > 0) {
            const charges = cryptid.protectionCharges;
            icons.push({ 
                icon: '🛡️', 
                category: 'buff-protection', 
                count: charges > 1 ? charges : null, 
                tooltip: `Protected: ${charges} charge${charges > 1 ? 's' : ''}. Blocks the next ${charges} instance${charges > 1 ? 's' : ''} of damage.`
            });
        }
        if (cryptid.hasFocus) {
            icons.push({ 
                icon: '🎯', 
                category: 'buff-focus', 
                count: null, 
                tooltip: 'Focus: Can attack without resting afterward.'
            });
        }
        if (cryptid.hasFlying) {
            icons.push({ 
                icon: '🪽', 
                category: 'buff-flying', 
                count: null, 
                tooltip: 'Flying: Can only be blocked by other Flying cryptids.'
            });
        }
        if (cryptid.isHidden) {
            icons.push({ 
                icon: '👁', 
                category: 'buff-hidden', 
                count: null, 
                tooltip: 'Hidden: Identity and stats unknown to enemy. Revealed when attacking or taking damage.'
            });
        }
        if (cryptid.latchedTo || cryptid.latchedBy) {
            icons.push({ 
                icon: '🔗', 
                category: 'status-latch', 
                count: null, 
                tooltip: 'Latched: Bound to another cryptid. Cannot move independently.'
            });
        }
        if (cryptid.auras?.length > 0) {
            const count = cryptid.auras.length;
            const auraNames = cryptid.auras.map(a => a.name).join(', ');
            icons.push({ 
                icon: '✨', 
                category: 'buff-aura', 
                count: count > 1 ? count : null, 
                tooltip: `Enchanted: ${auraNames}`
            });
        }
        if (cryptid.hasDestroyer) {
            icons.push({ 
                icon: '💥', 
                category: 'buff-destroyer', 
                count: null, 
                tooltip: 'Destroyer: Deals double damage to enemy cryptids.'
            });
        }
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
        
        let result = { pyreGained: 0 };
        
        // Handle legacy function-based effect
        if (typeof pyreCard.effect === 'function') {
            result = pyreCard.effect(this, owner);
        } 
        // Handle new declarative effects array
        else if (pyreCard.effects && Array.isArray(pyreCard.effects)) {
            result = this.executePyreEffects(owner, pyreCard);
        }
        // Fallback: just grant base pyreGain if defined
        else if (pyreCard.pyreGain) {
            const pyre = pyreCard.pyreGain;
            if (owner === 'player') this.playerPyre += pyre;
            else this.enemyPyre += pyre;
            result = { pyreGained: pyre };
        }
        
        GameEvents.emit('onPyreCardPlayed', { owner, card: pyreCard, pyreGained: result?.pyreGained || 0, details: result });
        return result;
    }
    
    /**
     * Execute declarative pyre card effects
     */
    executePyreEffects(owner, pyreCard) {
        let totalPyreGained = 0;
        const field = owner === 'player' ? this.playerField : this.enemyField;
        
        for (const effect of pyreCard.effects) {
            switch (effect.action) {
                case 'gainPyre':
                    const amount = effect.amount || 1;
                    if (owner === 'player') this.playerPyre += amount;
                    else this.enemyPyre += amount;
                    totalPyreGained += amount;
                    break;
                    
                case 'gainPyrePerNameMatch':
                    // Count cryptids matching name on field
                    let count = 0;
                    for (let c = 0; c < 2; c++) {
                        for (let r = 0; r < 3; r++) {
                            const cryptid = field[c][r];
                            if (cryptid && cryptid.name && cryptid.name.toLowerCase().includes(effect.match)) {
                                count++;
                            }
                        }
                    }
                    const bonus = Math.min(count, effect.max || 999) * (effect.amountPer || 1);
                    if (owner === 'player') this.playerPyre += bonus;
                    else this.enemyPyre += bonus;
                    totalPyreGained += bonus;
                    break;
                    
                case 'gainPyrePerDeathLastTurn':
                    const deaths = Math.min(this.deathsLastEnemyTurn?.[owner] || 0, effect.max || 999);
                    const deathPyre = deaths * (effect.amountPer || 1);
                    if (owner === 'player') this.playerPyre += deathPyre;
                    else this.enemyPyre += deathPyre;
                    totalPyreGained += deathPyre;
                    break;
                    
                case 'drawCardPerDeathLastTurn':
                    const deathCount = Math.min(this.deathsLastEnemyTurn?.[owner] || 0, effect.max || 999);
                    for (let i = 0; i < deathCount; i++) {
                        this.drawCard(owner, pyreCard.name);
                    }
                    break;
            }
        }
        
        return { pyreGained: totalPyreGained };
    }
    
    // ==================== ACTIVATED ABILITIES (Data-Driven) ====================
    
    /**
     * Get an activated ability definition from a cryptid
     * @param {Object} cryptid - The cryptid with the ability
     * @param {string} abilityId - The ability ID to find
     * @returns {Object|null} The ability definition or null
     */
    getActivatedAbility(cryptid, abilityId) {
        if (!cryptid.activatedAbilities || !Array.isArray(cryptid.activatedAbilities)) {
            return null;
        }
        return cryptid.activatedAbilities.find(a => a.id === abilityId) || null;
    }
    
    /**
     * Check if an activated ability can be used
     * @param {Object} cryptid - The cryptid with the ability
     * @param {string} abilityId - The ability ID to check
     * @returns {boolean} Whether the ability can be activated
     */
    canActivateAbility(cryptid, abilityId) {
        const ability = this.getActivatedAbility(cryptid, abilityId);
        if (!ability) return false;
        
        const owner = cryptid.owner;
        const supportCol = this.getSupportCol(owner);
        const combatCol = this.getCombatCol(owner);
        
        // Check if ability has been used (availability flag)
        const availableFlag = `${abilityId}Available`;
        if (cryptid[availableFlag] === false) return false;
        
        // Check position requirement
        if (ability.position === 'support' && cryptid.col !== supportCol) return false;
        if (ability.position === 'combat' && cryptid.col !== combatCol) return false;
        
        // Check if requires combatant
        if (ability.requiresCombatant) {
            const combatant = this.getCombatant(cryptid);
            if (!combatant) return false;
        }
        
        // Check custom conditions
        if (ability.condition) {
            // Use EffectEngine's condition checker if available
            if (typeof EffectEngine !== 'undefined' && EffectEngine.checkCondition) {
                if (!EffectEngine.checkCondition(cryptid, owner, this, ability.condition, {})) {
                    return false;
                }
            }
        }
        
        return true;
    }
    
    /**
     * Activate an ability on a cryptid (data-driven execution)
     * @param {Object} cryptid - The cryptid activating the ability
     * @param {string} abilityId - The ability ID to activate
     * @param {Object} targetInfo - Optional target information { col, row } for targeted abilities
     * @returns {Object|boolean} Result object or false if failed
     */
    activateAbility(cryptid, abilityId, targetInfo = null) {
        const ability = this.getActivatedAbility(cryptid, abilityId);
        if (!ability) {
            console.warn(`[activateAbility] Ability '${abilityId}' not found on ${cryptid.name}`);
            return false;
        }
        
        if (!this.canActivateAbility(cryptid, abilityId)) {
            console.warn(`[activateAbility] Cannot activate '${abilityId}' on ${cryptid.name}`);
            return false;
        }
        
        const owner = cryptid.owner;
        const result = { success: true, abilityId, effects: [] };
        
        // Mark ability as used
        const availableFlag = `${abilityId}Available`;
        if (ability.oncePerTurn || ability.oncePerGame) {
            cryptid[availableFlag] = false;
        }
        
        // Track if ability was activated (for permanent abilities)
        if (ability.oncePerGame) {
            cryptid[`${abilityId}Activated`] = true;
        }
        
        // Execute each effect in the ability
        for (const effect of ability.effects) {
            const effectResult = this.executeActivatedEffect(cryptid, owner, effect, targetInfo);
            result.effects.push(effectResult);
        }
        
        // Emit activation event
        GameEvents.emit('onActivatedAbility', { 
            ability: abilityId, 
            card: cryptid, 
            owner, 
            col: cryptid.col, 
            row: cryptid.row,
            targetInfo,
            result
        });
        
        return result;
    }
    
    /**
     * Execute a single effect from an activated ability
     */
    executeActivatedEffect(cryptid, owner, effect, targetInfo) {
        const result = { action: effect.action, success: true };
        
        switch (effect.action) {
            case 'killCombatant': {
                const combatant = this.getCombatant(cryptid);
                if (combatant) {
                    combatant.killedBy = effect.killedBy || 'sacrifice';
                    combatant.killedBySource = cryptid;
                    this.killCryptid(combatant, owner);
                    result.killed = combatant;
                }
                break;
            }
            
            case 'damageCombatant': {
                const combatant = this.getCombatant(cryptid);
                if (combatant) {
                    const damage = effect.amount || 1;
                    combatant.currentHp -= damage;
                    result.damage = damage;
                    result.target = combatant;
                    
                    if (combatant.currentHp <= 0) {
                        combatant.killedBy = effect.killedBy || 'ability';
                        combatant.killedBySource = cryptid;
                        this.killCryptid(combatant, owner);
                        result.killed = combatant;
                    }
                }
                break;
            }
            
            case 'setStats': {
                if (effect.atk !== undefined) {
                    cryptid.currentAtk = effect.atk;
                    cryptid.baseAtk = effect.atk;
                }
                if (effect.hp !== undefined) {
                    cryptid.currentHp = effect.hp;
                    cryptid.maxHp = effect.hp;
                }
                result.newStats = { atk: cryptid.currentAtk, hp: cryptid.currentHp };
                break;
            }
            
            case 'buffStats': {
                if (effect.atk) {
                    cryptid.currentAtk = (cryptid.currentAtk || cryptid.atk) + effect.atk;
                    if (effect.permanent) cryptid.baseAtk = (cryptid.baseAtk || cryptid.atk) + effect.atk;
                }
                if (effect.hp) {
                    cryptid.currentHp = (cryptid.currentHp || cryptid.hp) + effect.hp;
                    cryptid.maxHp = (cryptid.maxHp || cryptid.hp) + effect.hp;
                }
                break;
            }
            
            case 'grantKeyword': {
                const keyword = effect.keyword;
                switch (keyword) {
                    case 'destroyer': cryptid.hasDestroyer = true; break;
                    case 'flight': cryptid.canTargetAny = true; break;
                    case 'vampiric': 
                    case 'lifesteal': cryptid.hasLifesteal = true; break;
                    case 'regeneration': cryptid.hasRegeneration = true; break;
                    default:
                        cryptid[`has${keyword.charAt(0).toUpperCase() + keyword.slice(1)}`] = true;
                }
                result.keyword = keyword;
                break;
            }
            
            case 'gainPyre': {
                const amount = effect.amount || 1;
                if (owner === 'player') this.playerPyre += amount;
                else this.enemyPyre += amount;
                result.pyreGained = amount;
                break;
            }
            
            case 'debuffTarget': {
                // For targeted abilities like Decay Rat
                if (!targetInfo) {
                    result.success = false;
                    result.error = 'No target specified';
                    break;
                }
                
                const enemyOwner = owner === 'player' ? 'enemy' : 'player';
                const enemyField = enemyOwner === 'player' ? this.playerField : this.enemyField;
                const target = enemyField[targetInfo.col]?.[targetInfo.row];
                
                if (!target) {
                    result.success = false;
                    result.error = 'Target not found';
                    break;
                }
                
                // Calculate debuff amount based on effect definition
                let debuffAmount = effect.amount || 1;
                
                if (effect.perAilmentStack) {
                    let stacks = 0;
                    if (target.burnTurns > 0) stacks += target.burnTurns;
                    if (target.bleedTurns > 0) stacks += target.bleedTurns;
                    if (target.paralyzeTurns > 0) stacks += target.paralyzeTurns;
                    if (target.calamityCounters > 0) stacks += target.calamityCounters;
                    if (target.curseTokens > 0) stacks += target.curseTokens;
                    debuffAmount = stacks * (effect.multiplier || 1);
                }
                
                if (debuffAmount <= 0) {
                    result.success = false;
                    result.error = 'No ailments to calculate debuff';
                    break;
                }
                
                // Apply temporary debuff
                if (effect.debuffAtk) {
                    target.decayRatAtkDebuff = (target.decayRatAtkDebuff || 0) + debuffAmount;
                }
                if (effect.debuffHp) {
                    target.decayRatHpDebuff = (target.decayRatHpDebuff || 0) + debuffAmount;
                    target.currentHp = (target.currentHp || target.hp) - debuffAmount;
                }
                
                // Track for end-of-turn cleanup
                if (effect.temporary) {
                    target.hasDecayRatDebuff = true;
                    target.decayRatDebuffOwner = owner;
                }
                
                result.target = target;
                result.debuffAmount = debuffAmount;
                
                // Check for death
                if (target.currentHp <= 0) {
                    target.killedBy = 'decayRat';
                    target.killedBySource = cryptid;
                    this.killCryptid(target, owner);
                    result.killed = target;
                }
                
                GameEvents.emit('onDecayRatDebuff', { 
                    source: cryptid,
                    target,
                    ailmentStacks: debuffAmount,
                    atkDebuff: effect.debuffAtk ? debuffAmount : 0,
                    hpDebuff: effect.debuffHp ? debuffAmount : 0
                });
                break;
            }
            
            default:
                console.warn(`[executeActivatedEffect] Unknown action: ${effect.action}`);
                result.success = false;
                result.error = `Unknown action: ${effect.action}`;
        }
        
        return result;
    }
    
    /**
     * Initialize ability availability flags when a cryptid enters support
     * Called by summonCryptid
     */
    initializeActivatedAbilities(cryptid) {
        if (!cryptid.activatedAbilities) return;
        
        for (const ability of cryptid.activatedAbilities) {
            // Only initialize if ability is for support position or any position
            if (ability.position === 'support' || ability.position === 'any') {
                // Check if position matches
                const supportCol = this.getSupportCol(cryptid.owner);
                if (cryptid.col === supportCol || ability.position === 'any') {
                    // Set availability flag unless already used (once per game)
                    if (!cryptid[`${ability.id}Activated`]) {
                        cryptid[`${ability.id}Available`] = true;
                    }
                }
            }
        }
    }
    
    /**
     * Reset once-per-turn abilities at turn start
     * Called during turn processing
     */
    resetActivatedAbilities(cryptid) {
        if (!cryptid.activatedAbilities) return;
        
        for (const ability of cryptid.activatedAbilities) {
            if (ability.oncePerTurn && !ability.oncePerGame) {
                // Check position requirement
                const supportCol = this.getSupportCol(cryptid.owner);
                const inCorrectPosition = 
                    ability.position === 'any' ||
                    (ability.position === 'support' && cryptid.col === supportCol) ||
                    (ability.position === 'combat' && cryptid.col !== supportCol);
                
                if (inCorrectPosition && !cryptid[`${ability.id}Activated`]) {
                    cryptid[`${ability.id}Available`] = true;
                }
            }
        }
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
            
            // Queue damage animation (sprites auto-captured at queue time)
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
        // Defensive check for invalid col/row
        if (col === undefined || row === undefined || col < 0 || col > 1 || row < 0 || row > 2) {
            console.error('[setFieldCryptid] Invalid position:', { owner, col, row, cryptid: cryptid?.name });
            return;
        }
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
        
        // Register with EffectEngine if card has declarative effects
        if (cryptid.effects && typeof EffectEngine !== 'undefined') {
            EffectEngine.registerCryptid(cryptid, owner, this);
        }
        
        // Legacy imperative callbacks (for backwards compatibility)
        if (cryptid.onSummon) {
            GameEvents.emit('onCardCallback', { type: 'onSummon', card: cryptid, owner, col, row });
            cryptid.onSummon(cryptid, owner, this);
        }
        if (col === supportCol && cryptid.onSupport) {
            GameEvents.emit('onCardCallback', { type: 'onSupport', card: cryptid, owner, col, row });
            cryptid.onSupport(cryptid, owner, this);
        }
        
        // Initialize activated abilities (data-driven)
        this.initializeActivatedAbilities(cryptid);
        
        // Legacy: Auto-initialize activated ability availability for old-style cards
        if (col === supportCol) {
            if (cryptid.hasSacrificeAbility && !cryptid.activatedAbilities) {
                cryptid.sacrificeAbilityAvailable = true;
            }
            if (cryptid.hasBloodPactAbility && !cryptid.activatedAbilities) {
                cryptid.bloodPactAvailable = true;
            }
            if (cryptid.hasDecayRatAbility && !cryptid.activatedAbilities) {
                cryptid.decayRatDebuffAvailable = true;
            }
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
            
            // Check if enemy has Gremlin across - apply ailment debuff to newly summoned cryptid
            if (enemyAcross?.appliesAilmentAtkDebuff) {
                this.updateGremlinDebuff(enemyAcross);
            }
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
        // ATK reduction from debuffs, curse tokens, Gremlin ailment debuff, and Decay Rat debuff
        let damage = attacker.currentAtk - (attacker.atkDebuff || 0) - (attacker.curseTokens || 0) - (attacker.gremlinAtkDebuff || 0) - (attacker.decayRatAtkDebuff || 0);
        if (col === combatCol) {
            const support = this.getFieldCryptid(owner, supportCol, row);
            if (support) damage += support.currentAtk - (support.atkDebuff || 0) - (support.curseTokens || 0) - (support.decayRatAtkDebuff || 0);
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
            return { negated: true, attackerKilled, target };
        }
        
        // Check if target's support has onCombatantAttacked callback
        const targetSupport = this.getSupport(target);
        if (targetSupport?.onCombatantAttacked && !this.isSupportNegated(targetSupport)) {
            GameEvents.emit('onCardCallback', { type: 'onCombatantAttacked', card: targetSupport, owner: target.owner, combatant: target, attacker, col: targetSupport.col, row: targetSupport.row });
            targetSupport.onCombatantAttacked(targetSupport, target, attacker, this);
        }
        
        // Insatiable Hunger buff is now applied in executeAttack() before attack animation
        // This prevents double-buffing while keeping the effect timing correct
        
        // Gremlin combat ability ATK debuff is applied via gremlinAtkDebuff in calculateAttackDamage
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
        
        // Bonus damage vs burning enemies (Hellhound support, Myling combat, etc.)
        if (target.burnTurns > 0 && attacker.bonusVsBurning) {
            damage += attacker.bonusVsBurning;
            GameEvents.emit('onBonusVsBurning', { attacker, target, bonus: attacker.bonusVsBurning });
        }
        
        // Double damage vs tapped/resting
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
        
        // Gremlin Support Ability - Ailmented enemies deal half damage, otherwise -1 damage
        const gremlinSupport = target.gremlinSupport;
        const actualSupport = this.getSupport(target);
        const gremlinIsSupport = gremlinSupport && actualSupport === gremlinSupport && !this.isSupportNegated(gremlinSupport);
        if (gremlinIsSupport) {
            const originalAmount = damage;
            if (this.hasStatusAilment(attacker)) {
                // Ailmented attacker deals half damage
                damage = Math.floor(damage / 2);
                GameEvents.emit('onGremlinHalfDamage', { gremlin: gremlinSupport, attacker, target, originalDamage: originalAmount, reducedDamage: damage });
            } else {
                // Non-ailmented attacker deals 1 less damage
                damage = Math.max(0, damage - 1);
                GameEvents.emit('onGremlinDamageReduction', { gremlin: gremlinSupport, attacker, target, originalDamage: originalAmount, reducedDamage: damage });
            }
        }
        
        // Gargoyle of the Grand Library Combat Ability - Stone Bastion: Half damage from ailmented enemies
        if (target.stoneBastion && this.hasStatusAilment(attacker)) {
            const originalAmount = damage;
            damage = Math.floor(damage / 2);
            target.stoneBastion = false; // Reset flag
            GameEvents.emit('onStoneBastionHalfDamage', { target, attacker, originalDamage: originalAmount, reducedDamage: damage, owner: target.owner });
        }
        target.stoneBastion = false; // Always reset flag after check
        
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
        
        // Capture effective HP before damage for accurate overkill calculation (HP pooling)
        const effectiveHpBefore = this.getEffectiveHp(target);
        const hpBefore = target.currentHp;
        target.currentHp -= damage;
        
        if (damage > 0) {
            GameEvents.emit('onDamageTaken', { target, damage, source: attacker, sourceType: 'attack', hpBefore, hpAfter: target.currentHp });
            GameEvents.emit('onHit', { attacker, target, damage, hpBefore, hpAfter: target.currentHp });
            
            // onTakeDamage callback on target
            if (target.onTakeDamage) {
                GameEvents.emit('onCardCallback', { type: 'onTakeDamage', card: target, owner: target.owner, attacker, damage, col: target.col, row: target.row });
                target.onTakeDamage(target, attacker, damage, this);
            }
            
            // onDamaged callback - triggers after taking damage (e.g., Gargoyle of the Grand Library)
            if (target.onDamaged) {
                GameEvents.emit('onCardCallback', { type: 'onDamaged', card: target, owner: target.owner, attacker, damage, col: target.col, row: target.row });
                target.onDamaged(target, attacker, damage, this);
            }
            
            // Myling Support Ability - When combatant takes damage, burn the attacker
            const mylingSupport = target.mylingSupport;
            if (target.burnAttackersOnDamage && mylingSupport && this.getSupport(target) === mylingSupport) {
                this.applyBurn(attacker);
                GameEvents.emit('onMylingBurn', { myling: mylingSupport, combatant: target, attacker, owner: target.owner });
            }
            
            // Vampire Bat Support Ability - When combatant deals damage, gain 1 pyre
            const batSupport = attacker.vampireBatSupport;
            if (attacker.grantPyreOnDamage && batSupport && this.getSupport(attacker) === batSupport) {
                const attackerOwner = attacker.owner;
                if (attackerOwner === 'player') this.playerPyre++;
                else this.enemyPyre++;
                
                GameEvents.emit('onPyreGained', { owner: attackerOwner, amount: 1, source: 'Vampire Bat', sourceCryptid: batSupport });
            }
            
            // Lifesteal - Attacker heals for damage dealt (Vampire Bat combat ability)
            if (attacker.hasLifesteal) {
                const maxHp = attacker.maxHp || attacker.hp;
                const healAmount = Math.min(damage, maxHp - (attacker.currentHp || attacker.hp));
                if (healAmount > 0) {
                    attacker.currentHp = (attacker.currentHp || attacker.hp) + healAmount;
                    GameEvents.emit('onLifesteal', { 
                        cryptid: attacker, 
                        target: target, 
                        amount: healAmount, 
                        damageDealt: damage, 
                        owner: attacker.owner 
                    });
                }
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
        // IMPORTANT: We apply damage now but defer death processing until after main target death
        // This ensures proper death ordering: main target dies first, then cleave targets
        let cleaveTarget = null;
        let cleaveTargetWasCombatant = false;
        if (attacker.hasCleave && damage > 0) {
            const supportCol = this.getSupportCol(targetOwner);
            const combatCol = this.getCombatCol(targetOwner);
            // If we attacked combatant, also hit support
            if (targetCol === combatCol) {
                cleaveTarget = this.getFieldCryptid(targetOwner, supportCol, targetRow);
                cleaveTargetWasCombatant = false;
            }
            // If we attacked support, also hit combatant
            else if (targetCol === supportCol) {
                cleaveTarget = this.getFieldCryptid(targetOwner, combatCol, targetRow);
                cleaveTargetWasCombatant = true;
            }
            
            if (cleaveTarget) {
                cleaveTarget.currentHp -= damage;
                GameEvents.emit('onCleaveDamage', { attacker, target: cleaveTarget, damage });
                
                // Queue cleave animation
                queueAbilityAnimation({
                    type: 'cleave',
                    source: attacker,
                    target: cleaveTarget,
                    damage: damage,
                    message: `⚔ ${attacker.name} cleaves!`
                });
            }
        }
        
        // Moleman Support Ability - Splash damage to adjacent supports when attacking a support
        // We DON'T apply damage here - instead we return the info for sequenced processing by UI
        // Deal half damage (rounded down) to supports above and below the target
        let molemanSplashInfo = null;
        const molemanSupport = attacker.molemanSupport;
        if (attacker.hasMolemanSplash && molemanSupport && this.getSupport(attacker) === molemanSupport && !this.isSupportNegated(molemanSupport) && damage > 0) {
            const supportCol = this.getSupportCol(targetOwner);
            // Only triggers when attacking a support (not a combatant)
            if (targetCol === supportCol) {
                const splashDamage = Math.floor(damage / 2);
                if (splashDamage > 0) {
                    const enemyField = targetOwner === 'player' ? this.playerField : this.enemyField;
                    molemanSplashInfo = {
                        attacker,
                        molemanSupport,
                        splashDamage,
                        targetOwner,
                        supportCol,
                        targets: []
                    };
                    
                    // Check support above (row - 1)
                    if (targetRow > 0) {
                        const supportAbove = enemyField[supportCol][targetRow - 1];
                        if (supportAbove) {
                            molemanSplashInfo.targets.push({ 
                                cryptid: supportAbove, 
                                row: targetRow - 1, 
                                col: supportCol,
                                direction: 'above' 
                            });
                        }
                    }
                    
                    // Check support below (row + 1)
                    if (targetRow < 2) {
                        const supportBelow = enemyField[supportCol][targetRow + 1];
                        if (supportBelow) {
                            molemanSplashInfo.targets.push({ 
                                cryptid: supportBelow, 
                                row: targetRow + 1, 
                                col: supportCol,
                                direction: 'below' 
                            });
                        }
                    }
                    
                    // If no actual targets, clear the info
                    if (molemanSplashInfo.targets.length === 0) {
                        molemanSplashInfo = null;
                    }
                }
            }
        }
        
        // Rooftop Gargoyle Support Ability - Lethal damage prevention
        // Check BEFORE death processing, AFTER damage is applied
        if (target.currentHp <= 0 && target.hasRooftopGargoyleSupport) {
            const gargoyleSupport = target.rooftopGargoyleSupport;
            // Only triggers if support still exists and ability not used
            if (gargoyleSupport && !gargoyleSupport.gargoyleSaveUsed && this.getSupport(target) === gargoyleSupport) {
                // Mark ability as used (one-time only)
                gargoyleSupport.gargoyleSaveUsed = true;
                
                // Remove the support ability from combatant
                target.hasRooftopGargoyleSupport = false;
                target.rooftopGargoyleSupport = null;
                
                // Check if attacker has an ailment for full HP restore
                const attackerHasAilment = this.hasStatusAilment(attacker);
                
                if (attackerHasAilment) {
                    // Full HP restore if attacker has ailment
                    target.currentHp = target.maxHp || target.hp;
                    GameEvents.emit('onGargoyleSave', { 
                        support: gargoyleSupport, 
                        combatant: target, 
                        attacker, 
                        fullHeal: true,
                        owner: target.owner 
                    });
                    
                    if (typeof queueAbilityAnimation !== 'undefined') {
                        queueAbilityAnimation({
                            type: 'heal',
                            target: target,
                            message: `🗿 ${gargoyleSupport.name} saves ${target.name} at FULL HP!`
                        });
                    }
                } else {
                    // Survive at 1 HP
                    target.currentHp = 1;
                    GameEvents.emit('onGargoyleSave', { 
                        support: gargoyleSupport, 
                        combatant: target, 
                        attacker, 
                        fullHeal: false,
                        owner: target.owner 
                    });
                    
                    if (typeof queueAbilityAnimation !== 'undefined') {
                        queueAbilityAnimation({
                            type: 'buff',
                            target: target,
                            message: `🗿 ${gargoyleSupport.name} saves ${target.name} at 1 HP!`
                        });
                    }
                }
            }
        }
        
        const effectiveHp = this.getEffectiveHp(target);
        let killed = false;
        let supportKilled = false;
        let kuchisakeExplosionInfo = null;
        
        if (effectiveHp <= 0) {
            killed = true;
            target.killedBy = 'attack';
            target.killedBySource = attacker;
            
            // Kuchisake-Onna Explosion: If attacker has explosion ability and victim was burning
            // Deal half of victim's base HP (rounded down) to adjacent enemies
            // Order: Top (lowest row) first, then others by position
            if (attacker.hasKuchisakeExplosion && target.burnTurns > 0) {
                const explosionDamage = Math.floor((target.baseHp || target.hp) / 2);
                if (explosionDamage > 0) {
                    // Get adjacent cryptids (same side as victim = enemies to attacker)
                    const adjacentTargets = this.getAdjacentCryptids(target);
                    if (adjacentTargets.length > 0) {
                        // Sort: top to bottom, combat col before support col
                        // Row 0 = top, Row 2 = bottom
                        const sortedTargets = adjacentTargets
                            .map(adj => ({
                                cryptid: adj,
                                col: adj.col,
                                row: adj.row
                            }))
                            .sort((a, b) => {
                                // First by row (top to bottom)
                                if (a.row !== b.row) return a.row - b.row;
                                // Then combat before support
                                const combatCol = this.getCombatCol(targetOwner);
                                if (a.col === combatCol && b.col !== combatCol) return -1;
                                if (b.col === combatCol && a.col !== combatCol) return 1;
                                return 0;
                            });
                        
                        kuchisakeExplosionInfo = {
                            attacker,
                            victim: target,
                            explosionDamage,
                            targetOwner,
                            targets: sortedTargets
                        };
                    }
                }
            }
            
            // Calculate overkill damage for destroyer
            // Uses effective HP (with HP pooling) for accurate overflow calculation
            const overkillDamage = Math.max(0, damage - effectiveHpBefore);
            
            // IMPORTANT: Capture support reference BEFORE killing combatant
            // killCryptid promotes support to combat, so we'd lose the reference otherwise
            const targetSupport = attacker.hasDestroyer && overkillDamage > 0 
                ? this.getFieldCryptid(targetOwner, this.getSupportCol(targetOwner), targetRow)
                : null;
            
            // Create Destroyer residue effect if there's a support about to be hit
            // This creates a visual "danger zone" in the combat slot before the support promotes into it
            if (targetSupport && overkillDamage > 0) {
                GameEvents.emit('onDestroyerResidue', { 
                    owner: targetOwner, 
                    col: this.getCombatCol(targetOwner), 
                    row: targetRow, 
                    damage: overkillDamage,
                    support: targetSupport
                });
            }
            
            // Death 1: Kill the combatant
            // If Kuchisake explosion is pending, SKIP auto-promotion so support stays in support position
            // This allows explosion to damage support before it gets promoted
            // Order: Death → Explosion (support takes damage while in support slot) → Promotion → Destroyer
            const shouldDeferPromotion = kuchisakeExplosionInfo && targetSupport;
            this.killCryptid(target, attacker.owner, { skipPromotion: shouldDeferPromotion });
            
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
            
            // Destroyer - overkill damage floods to (former) support
            // Note: targetSupport was captured BEFORE killCryptid, when it was still in support position
            // IMPORTANT: If Kuchisake explosion is pending, we defer BOTH promotion AND Destroyer
            // This ensures correct order: Death → Explosion → Promotion → Destroyer
            if (targetSupport) {
                if (kuchisakeExplosionInfo) {
                    // Defer Destroyer - don't apply damage now, let UI handle it after explosion AND promotion
                    // Store support reference and Destroyer info for later processing
                    kuchisakeExplosionInfo.pendingDeferredPromotion = targetSupport;
                    kuchisakeExplosionInfo.pendingDestroyerInfo = {
                        support: targetSupport,
                        overkillDamage,
                        attacker,
                        targetOwner,
                        targetRow
                    };
                } else {
                    // No explosion - apply Destroyer damage immediately (original behavior)
                    const supportHpBefore = targetSupport.currentHp;
                    targetSupport.currentHp -= overkillDamage;
                    GameEvents.emit('onDestroyerDamage', { 
                        attacker, target, support: targetSupport, damage: overkillDamage,
                        hpBefore: supportHpBefore, hpAfter: targetSupport.currentHp 
                    });
                    
                    // Calculate display damage (cap to HP if killed - Option B)
                    const displayOverkill = targetSupport.currentHp <= 0 
                        ? Math.min(overkillDamage, supportHpBefore) 
                        : overkillDamage;
                    
                    // Mark for pending damage animation - UI will play this AFTER promotion completes
                    targetSupport._pendingDestroyerDamage = {
                        damage: displayOverkill,
                        actualDamage: overkillDamage,
                        source: attacker,
                        message: `💥 Destroyer: ${displayOverkill} damage pierces to ${targetSupport.name}!`
                    };
                    
                    // Mark for death if killed
                    if (targetSupport.currentHp <= 0) {
                        supportKilled = true;
                        targetSupport.killedBy = 'destroyer';
                        targetSupport.killedBySource = attacker;
                        targetSupport._pendingDeathFromAttack = true;
                        GameEvents.emit('onKill', { killer: attacker, victim: targetSupport, killerOwner: attacker.owner, victimOwner: targetOwner, pendingAnimation: true });
                    }
                }
            }
        }
        
        // Deferred cleave death check - mark for death, don't kill yet
        // UI's checkAllCreaturesForDeath will handle animation and actual removal
        // Skip if already killed or already pending death from another source (e.g., Destroyer)
        if (cleaveTarget && cleaveTarget.currentHp <= 0 && !cleaveTarget._alreadyKilled && !cleaveTarget._pendingDeathFromAttack) {
            cleaveTarget.killedBy = 'cleave';
            cleaveTarget.killedBySource = attacker;
            cleaveTarget._pendingDeathFromAttack = true; // Flag for UI to detect
            if (attacker.onKill) {
                GameEvents.emit('onCardCallback', { type: 'onKill', card: attacker, owner: attacker.owner, victim: cleaveTarget, col: attacker.col, row: attacker.row });
                attacker.onKill(attacker, cleaveTarget, this);
            }
            GameEvents.emit('onKill', { killer: attacker, victim: cleaveTarget, killerOwner: attacker.owner, victimOwner: targetOwner, pendingAnimation: true });
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
                        otherTarget.killedBySource = attacker;
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
        
        return { damage, killed, protectionBlocked, target, effectiveHpBefore, hpBefore, molemanSplashInfo, kuchisakeExplosionInfo };
    }
    
    // Apply Kuchisake explosion damage to a single target (called by UI for sequenced processing)
    // Finds cryptid by REFERENCE, not position (cryptid may have been promoted)
    applyKuchisakeExplosion(explosionInfo, targetIndex) {
        if (!explosionInfo || !explosionInfo.targets || targetIndex >= explosionInfo.targets.length) {
            return null;
        }
        
        const targetEntry = explosionInfo.targets[targetIndex];
        const { cryptid: explosionTarget } = targetEntry;
        const { attacker, explosionDamage, targetOwner, victim } = explosionInfo;
        
        // Find cryptid's CURRENT position (may have moved due to promotion)
        const field = targetOwner === 'player' ? this.playerField : this.enemyField;
        let currentCol = null, currentRow = null;
        
        for (let c = 0; c < 2; c++) {
            for (let r = 0; r < 3; r++) {
                if (field[c][r] === explosionTarget) {
                    currentCol = c;
                    currentRow = r;
                    break;
                }
            }
            if (currentCol !== null) break;
        }
        
        // If cryptid no longer on field, skip
        if (currentCol === null) {
            return { skipped: true, reason: 'target_gone' };
        }
        
        // Apply damage
        const hpBefore = explosionTarget.currentHp;
        explosionTarget.currentHp -= explosionDamage;
        
        GameEvents.emit('onKuchisakeExplosion', { attacker, victim, target: explosionTarget, damage: explosionDamage });
        GameEvents.emit('onDamageTaken', { target: explosionTarget, damage: explosionDamage, source: attacker, sourceType: 'kuchisakeExplosion', hpBefore, hpAfter: explosionTarget.currentHp });
        
        // Check for death
        const killed = this.getEffectiveHp(explosionTarget) <= 0;
        if (killed) {
            explosionTarget.killedBy = 'kuchisakeExplosion';
            explosionTarget.killedBySource = attacker;
        }
        
        return { 
            target: explosionTarget, 
            damage: explosionDamage, 
            killed,
            row: currentRow,
            col: currentCol,
            targetOwner
        };
    }
    
    // Apply deferred Destroyer damage (called by UI after Kuchisake explosion completes)
    applyDeferredDestroyer(destroyerInfo) {
        if (!destroyerInfo) return null;
        
        const { support, overkillDamage, attacker, targetOwner, targetRow } = destroyerInfo;
        
        // Verify support still exists and is alive
        if (!support || support._alreadyKilled || support.currentHp <= 0) {
            return { skipped: true, reason: 'support_gone' };
        }
        
        // Find support's current position
        const field = targetOwner === 'player' ? this.playerField : this.enemyField;
        let currentCol = null, currentRow = null;
        
        for (let c = 0; c < 2; c++) {
            for (let r = 0; r < 3; r++) {
                if (field[c][r] === support) {
                    currentCol = c;
                    currentRow = r;
                    break;
                }
            }
            if (currentCol !== null) break;
        }
        
        if (currentCol === null) {
            return { skipped: true, reason: 'support_not_found' };
        }
        
        // Apply Destroyer damage
        const supportHpBefore = support.currentHp;
        support.currentHp -= overkillDamage;
        
        GameEvents.emit('onDestroyerDamage', { 
            attacker, support, damage: overkillDamage,
            hpBefore: supportHpBefore, hpAfter: support.currentHp 
        });
        
        // Calculate display damage
        const displayOverkill = support.currentHp <= 0 
            ? Math.min(overkillDamage, supportHpBefore) 
            : overkillDamage;
        
        // Check for death
        const killed = this.getEffectiveHp(support) <= 0;
        if (killed) {
            support.killedBy = 'destroyer';
            support.killedBySource = attacker;
        }
        
        return {
            target: support,
            damage: displayOverkill,
            actualDamage: overkillDamage,
            killed,
            row: currentRow,
            col: currentCol,
            targetOwner
        };
    }
    
    // Apply Moleman splash damage to a single target (called by UI for sequenced processing)
    applyMolemanSplash(splashInfo, targetIndex) {
        if (!splashInfo || !splashInfo.targets || targetIndex >= splashInfo.targets.length) {
            return null;
        }
        
        const targetEntry = splashInfo.targets[targetIndex];
        const { cryptid: splashTarget, row, col, direction } = targetEntry;
        const { attacker, molemanSupport, splashDamage, targetOwner } = splashInfo;
        
        // Re-verify target still exists at position (may have been killed/moved)
        const field = targetOwner === 'player' ? this.playerField : this.enemyField;
        const currentCryptid = field[col]?.[row];
        if (!currentCryptid || currentCryptid !== splashTarget) {
            return { skipped: true, reason: 'target_moved' };
        }
        
        // Apply damage
        const hpBefore = splashTarget.currentHp;
        splashTarget.currentHp -= splashDamage;
        
        GameEvents.emit('onMolemanSplash', { attacker, molemanSupport, target: splashTarget, damage: splashDamage, direction });
        GameEvents.emit('onDamageTaken', { target: splashTarget, damage: splashDamage, source: molemanSupport, sourceType: 'molemanSplash', hpBefore, hpAfter: splashTarget.currentHp });
        
        // Check for death
        const killed = this.getEffectiveHp(splashTarget) <= 0;
        if (killed) {
            splashTarget.killedBy = 'molemanSplash';
            splashTarget.killedBySource = attacker;
        }
        
        return { 
            target: splashTarget, 
            damage: splashDamage, 
            killed,
            row,
            col,
            direction,
            targetOwner
        };
    }

    killCryptid(cryptid, killerOwner = null, options = {}) {
        // Guard against double-kill (can happen when abilities call killCryptid directly,
        // then post-effect death check tries to process the same death)
        if (cryptid._alreadyKilled) {
            console.log('[killCryptid] Already killed, skipping:', cryptid.name);
            return null;
        }
        cryptid._alreadyKilled = true;
        
        // Unregister from EffectEngine if it has declarative effects
        if (cryptid.effects && typeof EffectEngine !== 'undefined') {
            EffectEngine.unregisterCryptid(cryptid);
        }
        
        // Options:
        // - skipPromotion: If true, don't auto-promote support (caller handles it manually)
        const { skipPromotion = false } = options;
        
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
        
        // If the dying cryptid was a Gremlin, remove its debuff from enemies
        if (cryptid.appliesAilmentAtkDebuff) {
            this.removeGremlinDebuff(cryptid);
        }
        // If the dying cryptid had a Gremlin debuff, clear the reference
        if (cryptid.gremlinDebuffSource) {
            cryptid.gremlinAtkDebuff = 0;
            cryptid.gremlinDebuffSource = null;
        }
        
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
        
        console.log('[Death] Emitting onDeath for', cryptid.name, 'killedBy:', cryptid.killedBy, 'killedBySource:', cryptid.killedBySource?.name || 'none');
        const deathEventData = { cryptid, owner, col, row, killerOwner, deathCount, killedBySource: cryptid.killedBySource };
        
        // Emit event for listeners - trap listener handles checkTraps
        GameEvents.emit('onDeath', deathEventData);
        
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
        // UNLESS skipPromotion is set (for deferred promotion after effects like Kuchisake explosion)
        if (col === combatCol) {
            const support = this.getFieldCryptid(owner, supportCol, row);
            if (support) {
                // Call onCombatantDeath hook on support BEFORE promotion (for Sewer Alligator, etc.)
                if (support.onCombatantDeath) {
                    GameEvents.emit('onCardCallback', { type: 'onCombatantDeath', card: support, owner, combatant: cryptid, col: support.col, row });
                    support.onCombatantDeath(support, cryptid, this);
                }
                GameEvents.emit('onCombatantDeath', { combatant: cryptid, support, owner, row });
                
                if (skipPromotion) {
                    // Don't promote now - caller will handle it manually after other effects resolve
                    // Store info for manual promotion later
                    support._pendingManualPromotion = { owner, row, supportCol, combatCol };
                    console.log('[killCryptid] Skipping auto-promotion for', support.name, '- deferred for manual trigger');
                } else {
                    // Normal auto-promotion
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
            
            // Check if enemy has Gremlin across - apply ailment debuff to promoted cryptid
            const enemyOwner = owner === 'player' ? 'enemy' : 'player';
            const enemyCombatCol = this.getCombatCol(enemyOwner);
            const enemyField = enemyOwner === 'player' ? this.playerField : this.enemyField;
            const enemyAcross = enemyField[enemyCombatCol]?.[row];
            if (enemyAcross?.appliesAilmentAtkDebuff) {
                this.updateGremlinDebuff(enemyAcross);
            }
            
            return support;
        }
        return null;
    }
    
    // Manually trigger a deferred promotion (used after Kuchisake explosion completes)
    // Returns the promoted cryptid, or null if promotion couldn't happen (support died, etc.)
    triggerDeferredPromotion(support) {
        if (!support || !support._pendingManualPromotion) {
            return null;
        }
        
        const { owner, row, supportCol, combatCol } = support._pendingManualPromotion;
        delete support._pendingManualPromotion;
        
        // Verify support is still alive and in support position
        if (support._alreadyKilled || support.currentHp <= 0) {
            console.log('[triggerDeferredPromotion] Support already dead:', support.name);
            return null;
        }
        
        const currentSupport = this.getFieldCryptid(owner, supportCol, row);
        if (currentSupport !== support) {
            console.log('[triggerDeferredPromotion] Support no longer at expected position:', support.name);
            return null;
        }
        
        // Verify combat slot is empty
        const combatant = this.getFieldCryptid(owner, combatCol, row);
        if (combatant) {
            console.log('[triggerDeferredPromotion] Combat slot not empty:', combatant.name);
            return null;
        }
        
        // Perform the promotion
        this.setFieldCryptid(owner, supportCol, row, null);
        support.col = combatCol;
        this.setFieldCryptid(owner, combatCol, row, support);
        GameEvents.emit('onPromotion', { cryptid: support, owner, row, fromCol: supportCol, toCol: combatCol });
        
        // Trigger onCombat and onEnterCombat callbacks
        if (support.onCombat) {
            GameEvents.emit('onCardCallback', { type: 'onCombat', card: support, owner, col: combatCol, row, reason: 'deferredPromotion' });
            support.onCombat(support, owner, this);
        }
        if (support.onEnterCombat) {
            GameEvents.emit('onCardCallback', { type: 'onEnterCombat', card: support, owner, col: combatCol, row, reason: 'deferredPromotion' });
            support.onEnterCombat(support, owner, this);
        }
        GameEvents.emit('onEnterCombat', { cryptid: support, owner, row, source: 'deferredPromotion' });
        
        // Check if enemy has Gremlin across - apply ailment debuff to promoted cryptid
        const enemyOwner = owner === 'player' ? 'enemy' : 'player';
        const enemyCombatCol = this.getCombatCol(enemyOwner);
        const enemyField = enemyOwner === 'player' ? this.playerField : this.enemyField;
        const enemyAcross = enemyField[enemyCombatCol]?.[row];
        if (enemyAcross?.appliesAilmentAtkDebuff) {
            this.updateGremlinDebuff(enemyAcross);
        }
        
        // Queue animation for UI layer
        if (!window.pendingPromotions) window.pendingPromotions = [];
        window.pendingPromotions.push({ owner, row });
        
        console.log('[triggerDeferredPromotion] Promoted', support.name, 'to combat');
        return support;
    }

    popRandomKindling(owner) {
        let kindling = owner === 'player' ? this.playerKindling : this.enemyKindling;
        
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
            
            // Check if enemy has Gremlin across - apply ailment debuff to newly summoned kindling
            const enemyOwner = owner === 'player' ? 'enemy' : 'player';
            const enemyCombatCol = this.getCombatCol(enemyOwner);
            const enemyField = enemyOwner === 'player' ? this.playerField : this.enemyField;
            const enemyAcross = enemyField[enemyCombatCol]?.[row];
            if (enemyAcross?.appliesAilmentAtkDebuff) {
                this.updateGremlinDebuff(enemyAcross);
            }
        }
        GameEvents.emit('onSummon', { owner, cryptid, col, row, isSupport: col === supportCol, isKindling: true });
        
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
        
        // Moleman's Burrow: Can only attack combatant in same row, or ANY enemy support (ignoring combatant status)
        if (attacker.hasBurrowTargeting) {
            // Target 1: Enemy combatant in the same row only
            const sameRowCombatant = enemyField[enemyCombatCol][attacker.row];
            if (sameRowCombatant) {
                targets.push({ col: enemyCombatCol, row: attacker.row, cryptid: sameRowCombatant });
            }
            
            // Target 2: ANY enemy support (all rows) - Burrow ignores combatant blocking entirely
            for (let r = 0; r < 3; r++) {
                const support = enemyField[enemySupportCol][r];
                if (support) {
                    // Moleman can ALWAYS target supports regardless of combatant status
                    targets.push({ col: enemySupportCol, row: r, cryptid: support });
                }
            }
            
            // If field is empty and enemy has kindling, can target empty slots in same row
            if (fieldEmpty && enemyKindling.length > 0 && !sameRowCombatant) {
                targets.push({ owner: enemyOwner, col: enemyCombatCol, row: attacker.row, cryptid: null, isEmptyTarget: true });
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
                    
                    // Reset once-per-turn abilities (data-driven)
                    this.resetActivatedAbilities(cryptid);
                    
                    // Legacy: Reset old-style ability flags
                    if (cryptid.hasBloodPactAbility && !cryptid.activatedAbilities) {
                        cryptid.bloodPactAvailable = true;
                    }
                    if (cryptid.hasDecayRatAbility && !cryptid.activatedAbilities) {
                        cryptid.decayRatDebuffAvailable = true;
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
        
        // Clean up Decay Rat debuffs (backup in case Decay Rat died)
        this.cleanupDecayRatDebuffs(currentPlayer);
        
        GameEvents.emit('onTurnEnd', { owner: this.currentTurn, turnNumber: this.turnNumber });
        
        // Skip status effects here - they're processed with animation by the UI layer
        this.startTurn(this.currentTurn === 'player' ? 'enemy' : 'player', true);
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
        // Determine kill threshold based on adventure mode battle type
        let killsToWin = 10; // Default for regular battles
        
        if (window.adventureBattleType) {
            if (window.adventureBattleType === 'battle') {
                killsToWin = 3; // Normal adventure battles
            } else if (window.adventureBattleType === 'elite') {
                killsToWin = 5; // Elite adventure battles
            } else if (window.adventureBattleType === 'boss') {
                killsToWin = 7; // Boss battles
            }
        }
        
        if (this.playerDeaths >= killsToWin) this.endGame('enemy');
        else if (this.enemyDeaths >= killsToWin) this.endGame('player');
    }

    endGame(winner) {
        if (this.gameOver) return; // Prevent double-triggering
        this.gameOver = true;
        
        // Calculate match duration
        const duration = Math.floor((Date.now() - this.matchStats.startTime) / 1000);
        
        // Prepare match data for win screen
        const isWin = winner === 'player';
        const matchData = {
            isWin,
            isHuman: false, // AI battle (offline mode)
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
            opponentName: 'AI'
        };
        
        // Deal Slide transition to results screen
        TransitionEngine.slide(() => {
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
        });
    }
}


