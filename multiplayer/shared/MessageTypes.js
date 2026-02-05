/**
 * Cryptid Fates - Multiplayer Message Types
 * Shared constants between client and server
 */

// ==================== ACTION TYPES ====================
// Actions sent from Client → Server (player intents)

export const ActionTypes = {
    // Conjure Phase Actions
    SUMMON_CRYPTID: 'SUMMON_CRYPTID',
    SUMMON_KINDLING: 'SUMMON_KINDLING',
    PLAY_BURST: 'PLAY_BURST',
    PLAY_TRAP: 'PLAY_TRAP',
    PLAY_AURA: 'PLAY_AURA',
    PLAY_PYRE_CARD: 'PLAY_PYRE_CARD',
    EVOLVE_CRYPTID: 'EVOLVE_CRYPTID',
    
    // Combat Phase Actions
    ATTACK: 'ATTACK',
    USE_ABILITY: 'USE_ABILITY',
    PYRE_BURN: 'PYRE_BURN',
    
    // Phase Transitions
    END_CONJURE1: 'END_CONJURE1',
    END_COMBAT: 'END_COMBAT',
    END_TURN: 'END_TURN',
    
    // Meta Actions
    CONCEDE: 'CONCEDE',
    REQUEST_REMATCH: 'REQUEST_REMATCH',
    SEND_EMOTE: 'SEND_EMOTE'
};

// ==================== EVENT TYPES ====================
// Events sent from Server → Clients (results)

export const EventTypes = {
    // Card Events
    CRYPTID_SUMMONED: 'CRYPTID_SUMMONED',
    KINDLING_SUMMONED: 'KINDLING_SUMMONED',
    CRYPTID_MOVED: 'CRYPTID_MOVED',
    CRYPTID_EVOLVED: 'CRYPTID_EVOLVED',
    CRYPTID_DIED: 'CRYPTID_DIED',
    CRYPTID_PROMOTED: 'CRYPTID_PROMOTED',
    CARD_DRAWN: 'CARD_DRAWN',
    CARD_DISCARDED: 'CARD_DISCARDED',
    
    // Combat Events
    ATTACK_DECLARED: 'ATTACK_DECLARED',
    ATTACK_NEGATED: 'ATTACK_NEGATED',
    DAMAGE_DEALT: 'DAMAGE_DEALT',
    DAMAGE_BLOCKED: 'DAMAGE_BLOCKED',
    CLEAVE_DAMAGE: 'CLEAVE_DAMAGE',
    
    // Effect Events
    EFFECT_TRIGGERED: 'EFFECT_TRIGGERED',
    ABILITY_ACTIVATED: 'ABILITY_ACTIVATED',
    AILMENT_APPLIED: 'AILMENT_APPLIED',
    AILMENT_REMOVED: 'AILMENT_REMOVED',
    AILMENT_TICK: 'AILMENT_TICK',
    BUFF_APPLIED: 'BUFF_APPLIED',
    DEBUFF_APPLIED: 'DEBUFF_APPLIED',
    HEAL_APPLIED: 'HEAL_APPLIED',
    KEYWORD_GRANTED: 'KEYWORD_GRANTED',
    
    // Trap Events
    TRAP_SET: 'TRAP_SET',
    TRAP_TRIGGERED: 'TRAP_TRIGGERED',
    TRAP_DESTROYED: 'TRAP_DESTROYED',
    
    // Aura Events
    AURA_ATTACHED: 'AURA_ATTACHED',
    AURA_REMOVED: 'AURA_REMOVED',
    
    // Resource Events
    PYRE_CHANGED: 'PYRE_CHANGED',
    PYRE_BURN_USED: 'PYRE_BURN_USED',
    
    // Turn Events
    PHASE_CHANGED: 'PHASE_CHANGED',
    TURN_STARTED: 'TURN_STARTED',
    TURN_ENDED: 'TURN_ENDED',
    
    // Status Effect Processing (Turn Start)
    BURN_DAMAGE: 'BURN_DAMAGE',
    BLEED_TICK: 'BLEED_TICK',
    CALAMITY_TICK: 'CALAMITY_TICK',
    PARALYZE_EXPIRED: 'PARALYZE_EXPIRED',
    CURSE_TICK: 'CURSE_TICK',
    TOXIC_DAMAGE: 'TOXIC_DAMAGE',
    REGENERATION_HEAL: 'REGENERATION_HEAL',
    
    // Game State Events
    GAME_STARTED: 'GAME_STARTED',
    GAME_ENDED: 'GAME_ENDED',
    
    // Connection Events
    OPPONENT_DISCONNECTED: 'OPPONENT_DISCONNECTED',
    OPPONENT_RECONNECTED: 'OPPONENT_RECONNECTED',
    
    // Timer Events
    TURN_TIMER_START: 'TURN_TIMER_START',
    BONUS_TIME_STARTED: 'BONUS_TIME_STARTED',
    TURN_TIMEOUT: 'TURN_TIMEOUT'
};

// ==================== MESSAGE TYPES ====================
// Top-level message envelope types

export const MessageTypes = {
    // Client → Server
    ACTION: 'ACTION',
    PING: 'PING',
    REQUEST_SYNC: 'REQUEST_SYNC',
    
    // Server → Client  
    ACTION_RESULT: 'ACTION_RESULT',
    ACTION_REJECTED: 'ACTION_REJECTED',
    STATE_SYNC: 'STATE_SYNC',
    OPPONENT_ACTION: 'OPPONENT_ACTION',
    PONG: 'PONG',
    
    // Matchmaking
    FIND_MATCH: 'FIND_MATCH',
    CANCEL_MATCH: 'CANCEL_MATCH',
    MATCH_FOUND: 'MATCH_FOUND',
    MATCH_JOINED: 'MATCH_JOINED',
    
    // Reconnection
    RECONNECT: 'RECONNECT',
    RECONNECTED: 'RECONNECTED'
};

// ==================== ANIMATION HINTS ====================
// Animation identifiers included with events

export const AnimationHints = {
    // Summon animations
    SUMMON_EFFECT: 'summon_effect',
    CARD_TO_FIELD: 'card_to_field',
    EVOLUTION_TRANSFORM: 'evolution_transform',
    
    // Combat animations
    ATTACK_WINDUP: 'attack_windup',
    ATTACK_LUNGE: 'attack_lunge',
    HIT_IMPACT: 'hit_impact',
    HIT_RECOIL: 'hit_recoil',
    BLOCK_SHIELD: 'block_shield',
    
    // Death animations
    DEATH_FADE: 'death_fade',
    DEATH_DRAMATIC: 'death_dramatic',
    DEATH_EXPLOSION: 'death_explosion',
    
    // Effect animations
    ABILITY_GLOW: 'ability_glow',
    BUFF_SPARKLE: 'buff_sparkle',
    DEBUFF_DARK: 'debuff_dark',
    HEAL_PULSE: 'heal_pulse',
    
    // Ailment animations
    BURN_APPLY: 'burn_apply',
    BURN_TICK: 'burn_tick',
    BLEED_APPLY: 'bleed_apply',
    BLEED_TICK: 'bleed_tick',
    PARALYZE_SHOCK: 'paralyze_shock',
    CALAMITY_COUNTDOWN: 'calamity_countdown',
    CURSE_APPLY: 'curse_apply',
    CLEANSE_PURIFY: 'cleanse_purify',
    
    // Trap animations
    TRAP_REVEAL: 'trap_reveal',
    TRAP_ACTIVATE: 'trap_activate',
    
    // Resource animations  
    PYRE_GAIN: 'pyre_gain',
    PYRE_SPEND: 'pyre_spend',
    PYRE_BURN_FLAMES: 'pyre_burn_flames',
    
    // UI animations
    CARD_DRAW: 'card_draw',
    TURN_INDICATOR: 'turn_indicator',
    PHASE_TRANSITION: 'phase_transition'
};

// ==================== ANIMATION TIMING ====================
// Duration in milliseconds for animation synchronization

export const AnimationTiming = {
    // Card animations
    SUMMON: 500,
    EVOLVE: 800,
    CARD_DRAW: 300,
    CARD_TO_HAND: 400,
    CARD_DISCARD: 300,
    
    // Combat animations
    ATTACK_WINDUP: 200,
    ATTACK_LUNGE: 250,
    ATTACK_IMPACT: 150,
    DAMAGE_NUMBER: 400,
    HIT_RECOIL: 280,
    BLOCK_EFFECT: 300,
    
    // Death animations
    DEATH_FADE: 500,
    DEATH_DRAMATIC: 800,
    DEATH_MYTHICAL: 1200,
    PROMOTION: 400,
    
    // Effect animations
    BUFF_GLOW: 600,
    DEBUFF_FLASH: 500,
    HEAL_PULSE: 500,
    ABILITY_TRIGGER: 600,
    
    // Ailment animations
    AILMENT_APPLY: 400,
    BURN_TICK: 400,
    CALAMITY_TICK: 500,
    BLEED_TICK: 350,
    CLEANSE: 500,
    
    // Trap animations
    TRAP_SET: 300,
    TRAP_REVEAL: 700,
    TRAP_ACTIVATE: 600,
    
    // Resource animations
    PYRE_CHANGE: 300,
    PYRE_BURN: 800,
    
    // Turn animations
    PHASE_TRANSITION: 300,
    TURN_START: 1500,
    TURN_END: 500,
    
    // Spacing
    EVENT_GAP: 100,          // Gap between sequential events
    SIMULTANEOUS_GAP: 50     // Gap between simultaneous effects
};

// ==================== REJECTION REASONS ====================
// Why an action was rejected

export const RejectionReasons = {
    NOT_YOUR_TURN: 'NOT_YOUR_TURN',
    WRONG_PHASE: 'WRONG_PHASE',
    INSUFFICIENT_PYRE: 'INSUFFICIENT_PYRE',
    CARD_NOT_IN_HAND: 'CARD_NOT_IN_HAND',
    INVALID_SLOT: 'INVALID_SLOT',
    INVALID_TARGET: 'INVALID_TARGET',
    CANNOT_ATTACK: 'CANNOT_ATTACK',
    NO_ATTACKER: 'NO_ATTACKER',
    ABILITY_ON_COOLDOWN: 'ABILITY_ON_COOLDOWN',
    ABILITY_ALREADY_USED: 'ABILITY_ALREADY_USED',
    EVOLUTION_NOT_AVAILABLE: 'EVOLUTION_NOT_AVAILABLE',
    PYRE_BURN_ALREADY_USED: 'PYRE_BURN_ALREADY_USED',
    KINDLING_ALREADY_PLAYED: 'KINDLING_ALREADY_PLAYED',
    RATE_LIMITED: 'RATE_LIMITED',
    GAME_OVER: 'GAME_OVER'
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Check if an action requires it to be the player's turn
 */
export function requiresTurn(actionType) {
    const alwaysValid = [
        ActionTypes.CONCEDE,
        ActionTypes.SEND_EMOTE
    ];
    return !alwaysValid.includes(actionType);
}

/**
 * Get valid action types for a given phase
 */
export function getValidActionsForPhase(phase) {
    switch (phase) {
        case 'conjure1':
        case 'conjure2':
            return [
                ActionTypes.SUMMON_CRYPTID,
                ActionTypes.SUMMON_KINDLING,
                ActionTypes.PLAY_BURST,
                ActionTypes.PLAY_TRAP,
                ActionTypes.PLAY_AURA,
                ActionTypes.PLAY_PYRE_CARD,
                ActionTypes.EVOLVE_CRYPTID,
                ActionTypes.PYRE_BURN,
                phase === 'conjure1' ? ActionTypes.END_CONJURE1 : ActionTypes.END_TURN
            ];
        case 'combat':
            return [
                ActionTypes.ATTACK,
                ActionTypes.USE_ABILITY,
                ActionTypes.PLAY_BURST,  // Some bursts can be played in combat
                ActionTypes.END_COMBAT
            ];
        default:
            return [];
    }
}

/**
 * Get animation duration for an event type
 */
export function getAnimationDuration(eventType, data = {}) {
    switch (eventType) {
        case EventTypes.CRYPTID_SUMMONED:
            return AnimationTiming.SUMMON;
        case EventTypes.CRYPTID_EVOLVED:
            return AnimationTiming.EVOLVE;
        case EventTypes.CRYPTID_DIED:
            return data.rarity === 'mythical' ? AnimationTiming.DEATH_MYTHICAL : AnimationTiming.DEATH_DRAMATIC;
        case EventTypes.DAMAGE_DEALT:
            return AnimationTiming.HIT_RECOIL + AnimationTiming.DAMAGE_NUMBER;
        case EventTypes.ATTACK_DECLARED:
            return AnimationTiming.ATTACK_WINDUP + AnimationTiming.ATTACK_LUNGE;
        case EventTypes.BUFF_APPLIED:
        case EventTypes.DEBUFF_APPLIED:
            return AnimationTiming.BUFF_GLOW;
        case EventTypes.HEAL_APPLIED:
            return AnimationTiming.HEAL_PULSE;
        case EventTypes.AILMENT_APPLIED:
            return AnimationTiming.AILMENT_APPLY;
        case EventTypes.BURN_DAMAGE:
            return AnimationTiming.BURN_TICK;
        case EventTypes.CALAMITY_TICK:
            return AnimationTiming.CALAMITY_TICK;
        case EventTypes.TRAP_TRIGGERED:
            return AnimationTiming.TRAP_REVEAL + AnimationTiming.TRAP_ACTIVATE;
        case EventTypes.TURN_STARTED:
            return AnimationTiming.TURN_START;
        case EventTypes.PHASE_CHANGED:
            return AnimationTiming.PHASE_TRANSITION;
        default:
            return AnimationTiming.EVENT_GAP;
    }
}

// Make available globally for browser
if (typeof window !== 'undefined') {
    window.MP_ActionTypes = ActionTypes;
    window.MP_EventTypes = EventTypes;
    window.MP_MessageTypes = MessageTypes;
    window.MP_AnimationHints = AnimationHints;
    window.MP_AnimationTiming = AnimationTiming;
    window.MP_RejectionReasons = RejectionReasons;
}

console.log('[MessageTypes] Multiplayer message types loaded');
