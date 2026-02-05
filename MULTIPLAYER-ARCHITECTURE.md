# Cryptid Fates - Multiplayer Architecture

## Overview

This document outlines a robust multiplayer architecture for Cryptid Fates that:
- Maintains server authority for anti-cheat protection
- Keeps both players' game states synchronized
- Preserves full animations for all game events
- Handles network latency gracefully
- Supports reconnection

---

## Architecture Summary

```
┌─────────────────┐                    ┌─────────────────┐
│   Player A      │◄────WebSocket────► │   Game Server   │ ◄────WebSocket────►│   Player B      │
│   (Client)      │                    │   (Authority)   │                    │   (Client)      │
└─────────────────┘                    └─────────────────┘                    └─────────────────┘
        │                                      │                                      │
        ▼                                      ▼                                      ▼
┌─────────────────┐                    ┌─────────────────┐                    ┌─────────────────┐
│ Local Game      │                    │ Authoritative   │                    │ Local Game      │
│ State (Shadow)  │                    │ Game State      │                    │ State (Shadow)  │
└─────────────────┘                    └─────────────────┘                    └─────────────────┘
```

**Key Principle**: Server is the single source of truth. Clients send **intents**, server validates and broadcasts **results**.

---

## 1. Core Components

### 1.1 Message Protocol

All communication uses a standardized message format:

```javascript
// Client → Server: Action Intent
{
  type: 'ACTION',
  actionId: 'uuid-12345',        // Unique ID for tracking
  actionType: 'SUMMON_CRYPTID',  // Action type enum
  timestamp: 1704067200000,      // Client timestamp
  payload: {
    cardId: 'hellhound_pup_3',
    targetSlot: { col: 1, row: 0 }
  }
}

// Server → Clients: Action Result
{
  type: 'ACTION_RESULT',
  actionId: 'uuid-12345',        // Matches the intent
  success: true,
  sequence: 42,                  // Global sequence number for ordering
  timestamp: 1704067200050,      // Server timestamp
  actor: 'player',               // Who performed the action
  events: [                      // Ordered list of game events
    {
      eventType: 'CRYPTID_SUMMONED',
      data: { cryptid: {...}, slot: {col: 1, row: 0} },
      animations: ['summon_effect', 'card_to_field']
    },
    {
      eventType: 'EFFECT_TRIGGERED',
      data: { effectName: 'Guard Activation', source: 'hellhound_pup_3' },
      animations: ['ability_glow']
    }
  ],
  stateChecksum: 'abc123'        // For verification
}

// Server → Clients: State Snapshot (periodic sync)
{
  type: 'STATE_SYNC',
  sequence: 42,
  fullState: { /* Complete game state */ },
  checksum: 'abc123'
}
```

### 1.2 Action Types

```javascript
const ActionTypes = {
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
  REQUEST_REMATCH: 'REQUEST_REMATCH'
};
```

### 1.3 Event Types (Server → Client)

```javascript
const EventTypes = {
  // Card Events
  CRYPTID_SUMMONED: 'CRYPTID_SUMMONED',
  KINDLING_SUMMONED: 'KINDLING_SUMMONED',
  CRYPTID_MOVED: 'CRYPTID_MOVED',
  CRYPTID_EVOLVED: 'CRYPTID_EVOLVED',
  CRYPTID_DIED: 'CRYPTID_DIED',
  CARD_DRAWN: 'CARD_DRAWN',
  
  // Combat Events
  ATTACK_DECLARED: 'ATTACK_DECLARED',
  DAMAGE_DEALT: 'DAMAGE_DEALT',
  DAMAGE_BLOCKED: 'DAMAGE_BLOCKED',
  
  // Effect Events
  EFFECT_TRIGGERED: 'EFFECT_TRIGGERED',
  AILMENT_APPLIED: 'AILMENT_APPLIED',
  AILMENT_REMOVED: 'AILMENT_REMOVED',
  BUFF_APPLIED: 'BUFF_APPLIED',
  HEAL_APPLIED: 'HEAL_APPLIED',
  
  // Trap Events
  TRAP_SET: 'TRAP_SET',
  TRAP_TRIGGERED: 'TRAP_TRIGGERED',
  TRAP_DESTROYED: 'TRAP_DESTROYED',
  
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
  
  // Game State
  GAME_STARTED: 'GAME_STARTED',
  GAME_ENDED: 'GAME_ENDED'
};
```

---

## 2. Server-Side Architecture

### 2.1 Authoritative Game Server

The server runs a headless version of the Game class and validates all actions:

```javascript
class MultiplayerGameServer {
  constructor(matchId, player1Socket, player2Socket) {
    this.matchId = matchId;
    this.game = new Game(); // Authoritative game state
    this.sequence = 0;
    this.players = {
      player: { socket: player1Socket, deck: null, connected: true },
      enemy: { socket: player2Socket, deck: null, connected: true }
    };
    this.actionHistory = []; // For replay/dispute resolution
    this.pendingActions = new Map(); // For timeout handling
  }
  
  // Validate and execute an action
  processAction(playerRole, action) {
    // 1. Validate it's this player's turn (or action is always-valid)
    if (!this.isValidTurn(playerRole, action)) {
      return this.rejectAction(action, 'NOT_YOUR_TURN');
    }
    
    // 2. Validate the action is legal
    const validation = this.validateAction(playerRole, action);
    if (!validation.valid) {
      return this.rejectAction(action, validation.reason);
    }
    
    // 3. Execute on authoritative state
    const events = this.executeAction(playerRole, action);
    
    // 4. Record in history
    this.actionHistory.push({
      sequence: this.sequence,
      playerRole,
      action,
      events,
      timestamp: Date.now()
    });
    
    // 5. Broadcast results to both clients
    this.broadcastResult(action.actionId, events);
    
    // 6. Check for game end conditions
    this.checkGameOver();
  }
  
  validateAction(playerRole, action) {
    switch (action.actionType) {
      case 'SUMMON_CRYPTID':
        return this.validateSummon(playerRole, action.payload);
      case 'ATTACK':
        return this.validateAttack(playerRole, action.payload);
      case 'EVOLVE_CRYPTID':
        return this.validateEvolution(playerRole, action.payload);
      // ... other action types
    }
  }
  
  validateSummon(playerRole, payload) {
    const hand = playerRole === 'player' ? this.game.playerHand : this.game.enemyHand;
    const pyre = playerRole === 'player' ? this.game.playerPyre : this.game.enemyPyre;
    
    // Find card in hand
    const card = hand.find(c => c.id === payload.cardId);
    if (!card) {
      return { valid: false, reason: 'CARD_NOT_IN_HAND' };
    }
    
    // Check pyre cost
    const cost = this.game.getModifiedCost(card, playerRole);
    if (cost > pyre) {
      return { valid: false, reason: 'INSUFFICIENT_PYRE' };
    }
    
    // Check target slot is valid
    const validSlots = this.game.getValidSummonSlots(playerRole);
    const isValidSlot = validSlots.some(
      s => s.col === payload.targetSlot.col && s.row === payload.targetSlot.row
    );
    if (!isValidSlot) {
      return { valid: false, reason: 'INVALID_SLOT' };
    }
    
    return { valid: true };
  }
  
  validateAttack(playerRole, payload) {
    // Must be in combat phase
    if (this.game.phase !== 'combat') {
      return { valid: false, reason: 'WRONG_PHASE' };
    }
    
    // Get attacker
    const field = playerRole === 'player' ? this.game.playerField : this.game.enemyField;
    const attacker = field[payload.attackerCol]?.[payload.attackerRow];
    
    if (!attacker) {
      return { valid: false, reason: 'NO_ATTACKER' };
    }
    
    // Check attacker can attack
    if (attacker.tapped || !attacker.canAttack) {
      return { valid: false, reason: 'CANNOT_ATTACK' };
    }
    
    // Check target is valid
    const validTargets = this.game.getValidAttackTargets(attacker);
    const isValidTarget = validTargets.some(
      t => t.col === payload.targetCol && t.row === payload.targetRow
    );
    if (!isValidTarget) {
      return { valid: false, reason: 'INVALID_TARGET' };
    }
    
    return { valid: true };
  }
  
  executeAction(playerRole, action) {
    const events = [];
    
    // Create event collector
    const collectEvent = (eventType, data, animations = []) => {
      events.push({ eventType, data, animations, sequence: this.sequence++ });
    };
    
    // Temporarily hook into GameEvents to collect all triggered events
    const originalEmit = GameEvents.emit;
    GameEvents.emit = (event, data) => {
      collectEvent(this.mapGameEventToEventType(event), data, this.getAnimationsFor(event, data));
      originalEmit.call(GameEvents, event, data);
    };
    
    try {
      switch (action.actionType) {
        case 'SUMMON_CRYPTID':
          this.executeSummon(playerRole, action.payload, collectEvent);
          break;
        case 'ATTACK':
          this.executeAttack(playerRole, action.payload, collectEvent);
          break;
        // ... other actions
      }
    } finally {
      // Restore original emit
      GameEvents.emit = originalEmit;
    }
    
    return events;
  }
}
```

### 2.2 Action Execution with Event Collection

```javascript
executeSummon(playerRole, payload, collectEvent) {
  const hand = playerRole === 'player' ? this.game.playerHand : this.game.enemyHand;
  const cardIndex = hand.findIndex(c => c.id === payload.cardId);
  const card = hand[cardIndex];
  
  // Remove from hand
  hand.splice(cardIndex, 1);
  
  // Deduct pyre
  const cost = this.game.getModifiedCost(card, playerRole);
  if (playerRole === 'player') {
    this.game.playerPyre -= cost;
  } else {
    this.game.enemyPyre -= cost;
  }
  
  collectEvent('PYRE_CHANGED', {
    owner: playerRole,
    amount: -cost,
    newTotal: playerRole === 'player' ? this.game.playerPyre : this.game.enemyPyre
  }, ['pyre_decrease']);
  
  // Summon to field (uses existing game logic)
  const summoned = this.game.summonCryptid(card, playerRole, payload.targetSlot.col, payload.targetSlot.row);
  
  collectEvent('CRYPTID_SUMMONED', {
    cryptid: this.serializeCryptid(summoned),
    slot: payload.targetSlot,
    owner: playerRole
  }, ['summon_effect', 'card_to_field']);
  
  // Note: Any triggered effects (onSummon, etc.) are captured via the GameEvents hook
}

executeAttack(playerRole, payload, collectEvent) {
  const { attackerCol, attackerRow, targetCol, targetRow } = payload;
  const attacker = this.getFieldCryptid(playerRole, attackerCol, attackerRow);
  const targetOwner = playerRole === 'player' ? 'enemy' : 'player';
  
  collectEvent('ATTACK_DECLARED', {
    attacker: this.serializeCryptid(attacker),
    attackerSlot: { col: attackerCol, row: attackerRow },
    targetSlot: { col: targetCol, row: targetRow }
  }, ['attack_wind_up']);
  
  // Execute attack using existing game logic
  const result = this.game.attack(attacker, targetOwner, targetCol, targetRow);
  
  // Result includes all the events (damage, death, promotion, etc.)
  // These are captured via the GameEvents hook
}
```

### 2.3 State Checksum for Verification

```javascript
calculateStateChecksum() {
  // Create deterministic hash of critical game state
  const stateSnapshot = {
    playerField: this.serializeField(this.game.playerField),
    enemyField: this.serializeField(this.game.enemyField),
    playerHand: this.game.playerHand.map(c => c.id).sort(),
    enemyHand: this.game.enemyHand.map(c => c.id).sort(),
    playerPyre: this.game.playerPyre,
    enemyPyre: this.game.enemyPyre,
    playerDeaths: this.game.playerDeaths,
    enemyDeaths: this.game.enemyDeaths,
    currentTurn: this.game.currentTurn,
    phase: this.game.phase,
    turnNumber: this.game.turnNumber
  };
  
  // Use a simple hash (in production, use crypto)
  return this.simpleHash(JSON.stringify(stateSnapshot));
}

serializeField(field) {
  const result = [];
  for (let col = 0; col < 2; col++) {
    for (let row = 0; row < 3; row++) {
      const cryptid = field[col]?.[row];
      if (cryptid) {
        result.push({
          id: cryptid.id,
          key: cryptid.key,
          currentHp: cryptid.currentHp,
          currentAtk: cryptid.currentAtk,
          burnTurns: cryptid.burnTurns || 0,
          bleedTurns: cryptid.bleedTurns || 0,
          paralyzed: !!cryptid.paralyzed,
          tapped: !!cryptid.tapped,
          col,
          row
        });
      }
    }
  }
  return result.sort((a, b) => `${a.col}${a.row}`.localeCompare(`${b.col}${b.row}`));
}
```

---

## 3. Client-Side Architecture

### 3.1 Multiplayer Client Manager

```javascript
class MultiplayerClient {
  constructor() {
    this.socket = null;
    this.localGame = null;  // Shadow state for prediction (optional)
    this.playerRole = null; // 'player' or 'enemy' (relative to server)
    this.pendingActions = new Map();
    this.eventQueue = [];
    this.processingEvents = false;
    this.lastSequence = -1;
  }
  
  connect(matchId, authToken) {
    this.socket = new WebSocket(`wss://game-server.com/match/${matchId}`);
    
    this.socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };
    
    this.socket.onclose = () => this.handleDisconnect();
  }
  
  handleMessage(message) {
    switch (message.type) {
      case 'MATCH_JOINED':
        this.handleMatchJoined(message);
        break;
      case 'ACTION_RESULT':
        this.handleActionResult(message);
        break;
      case 'STATE_SYNC':
        this.handleStateSync(message);
        break;
      case 'OPPONENT_ACTION':
        this.handleOpponentAction(message);
        break;
      case 'GAME_ENDED':
        this.handleGameEnded(message);
        break;
    }
  }
  
  handleMatchJoined(message) {
    this.playerRole = message.yourRole;  // 'player' or 'enemy'
    this.opponentInfo = message.opponent;
    
    // Initialize local game state
    this.localGame = new Game();
    this.applyInitialState(message.initialState);
    
    // Start game UI
    initMultiplayerGame(this.playerRole, message.initialState);
  }
  
  handleActionResult(message) {
    // Remove from pending
    this.pendingActions.delete(message.actionId);
    
    // Queue events for processing
    message.events.forEach(event => {
      this.eventQueue.push(event);
    });
    
    // Verify checksum
    if (message.stateChecksum !== this.calculateLocalChecksum()) {
      console.warn('State desync detected, requesting full sync');
      this.requestStateSync();
    }
    
    // Process event queue
    this.processEventQueue();
  }
  
  // Send an action to the server
  sendAction(actionType, payload) {
    const actionId = generateUUID();
    const action = {
      type: 'ACTION',
      actionId,
      actionType,
      timestamp: Date.now(),
      payload
    };
    
    // Track pending action
    this.pendingActions.set(actionId, {
      action,
      sentAt: Date.now()
    });
    
    // Set timeout for response
    setTimeout(() => {
      if (this.pendingActions.has(actionId)) {
        console.warn('Action timed out:', actionType);
        this.handleActionTimeout(actionId);
      }
    }, 10000); // 10 second timeout
    
    this.socket.send(JSON.stringify(action));
    
    return actionId;
  }
}
```

### 3.2 Event Queue Processing with Animations

This is the key to ensuring animations play properly for both players:

```javascript
class MultiplayerClient {
  // ... previous code ...
  
  async processEventQueue() {
    if (this.processingEvents || this.eventQueue.length === 0) return;
    this.processingEvents = true;
    
    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift();
      
      // Skip if we've already processed this sequence (reconnection case)
      if (event.sequence <= this.lastSequence) continue;
      this.lastSequence = event.sequence;
      
      // Process the event with animations
      await this.processEvent(event);
    }
    
    this.processingEvents = false;
  }
  
  async processEvent(event) {
    return new Promise((resolve) => {
      switch (event.eventType) {
        case 'CRYPTID_SUMMONED':
          this.processSummonEvent(event.data, event.animations, resolve);
          break;
        case 'ATTACK_DECLARED':
          this.processAttackDeclaredEvent(event.data, event.animations, resolve);
          break;
        case 'DAMAGE_DEALT':
          this.processDamageEvent(event.data, event.animations, resolve);
          break;
        case 'CRYPTID_DIED':
          this.processDeathEvent(event.data, event.animations, resolve);
          break;
        case 'EFFECT_TRIGGERED':
          this.processEffectEvent(event.data, event.animations, resolve);
          break;
        case 'AILMENT_APPLIED':
          this.processAilmentEvent(event.data, event.animations, resolve);
          break;
        case 'PYRE_CHANGED':
          this.processPyreEvent(event.data, event.animations, resolve);
          break;
        case 'PHASE_CHANGED':
          this.processPhaseEvent(event.data, event.animations, resolve);
          break;
        case 'TURN_STARTED':
          this.processTurnStartEvent(event.data, event.animations, resolve);
          break;
        default:
          // Unknown event, just apply state change and continue
          this.applyEventToLocalState(event);
          resolve();
      }
    });
  }
  
  processSummonEvent(data, animations, onComplete) {
    const { cryptid, slot, owner } = data;
    
    // Map owner to local perspective
    const localOwner = this.mapOwner(owner);
    
    // Update local game state
    const field = localOwner === 'player' ? game.playerField : game.enemyField;
    field[slot.col][slot.row] = this.deserializeCryptid(cryptid);
    
    // Play summon animation
    // The animation timing is derived from existing EffectAnimations
    const animationDuration = 500; // Match existing summon animation
    
    renderSprites(); // Re-render to show new cryptid
    
    // Get the sprite element
    const sprite = document.querySelector(
      `.cryptid-sprite[data-owner="${localOwner}"][data-col="${slot.col}"][data-row="${slot.row}"]`
    );
    
    if (sprite) {
      sprite.classList.add('summoning');
      setTimeout(() => {
        sprite.classList.remove('summoning');
        
        // Show ability message if applicable
        if (cryptid.combatAbility || cryptid.supportAbility) {
          const message = slot.col === game.getCombatCol(localOwner) 
            ? cryptid.combatAbility 
            : cryptid.supportAbility;
          if (message) showMessage(message, 800);
        }
        
        onComplete();
      }, animationDuration);
    } else {
      onComplete();
    }
  }
  
  processAttackDeclaredEvent(data, animations, onComplete) {
    const { attacker, attackerSlot, targetSlot } = data;
    const localAttackerOwner = this.mapOwner(attacker.owner);
    
    // Show attack line/arrow animation
    const attackerSprite = document.querySelector(
      `.cryptid-sprite[data-owner="${localAttackerOwner}"][data-col="${attackerSlot.col}"][data-row="${attackerSlot.row}"]`
    );
    
    const targetOwner = localAttackerOwner === 'player' ? 'enemy' : 'player';
    const targetSprite = document.querySelector(
      `.cryptid-sprite[data-owner="${targetOwner}"][data-col="${targetSlot.col}"][data-row="${targetSlot.row}"]`
    );
    
    if (attackerSprite && targetSprite) {
      // Play attack wind-up animation
      CombatEffects.playAttackAnimation(attackerSprite, targetSprite, () => {
        onComplete();
      });
    } else {
      onComplete();
    }
  }
  
  processDamageEvent(data, animations, onComplete) {
    const { target, damage, isCritical, source } = data;
    const localTargetOwner = this.mapOwner(target.owner);
    
    // Update local state
    const field = localTargetOwner === 'player' ? game.playerField : game.enemyField;
    const localTarget = field[target.col]?.[target.row];
    if (localTarget) {
      localTarget.currentHp = target.currentHp;
    }
    
    // Play damage animation
    const sprite = document.querySelector(
      `.cryptid-sprite[data-owner="${localTargetOwner}"][data-col="${target.col}"][data-row="${target.row}"]`
    );
    
    if (sprite) {
      // Use existing hit effect system
      if (window.playHitEffectOnSprite) {
        playHitEffectOnSprite(sprite, { owner: localTargetOwner }, { 
          intensity: isCritical ? 'heavy' : 'normal' 
        });
      }
      
      // Show damage number
      if (CombatEffects?.showDamageNumber) {
        CombatEffects.showDamageNumber(localTarget || target, damage, isCritical);
      }
    }
    
    // Update HP display
    setTimeout(() => {
      renderSprites();
      onComplete();
    }, 300);
  }
  
  processDeathEvent(data, animations, onComplete) {
    const { cryptid, killedBy, slot, owner } = data;
    const localOwner = this.mapOwner(owner);
    
    const sprite = document.querySelector(
      `.cryptid-sprite[data-owner="${localOwner}"][data-col="${slot.col}"][data-row="${slot.row}"]`
    );
    
    // Update local state first
    const field = localOwner === 'player' ? game.playerField : game.enemyField;
    
    // Play death animation
    if (sprite && CombatEffects?.playDramaticDeath) {
      CombatEffects.playDramaticDeath(sprite, localOwner, cryptid.rarity || 'common', () => {
        // Remove from field after animation
        field[slot.col][slot.row] = null;
        
        // Update death counter
        if (localOwner === 'player') {
          game.playerDeaths++;
        } else {
          game.enemyDeaths++;
        }
        
        renderAll();
        onComplete();
      });
    } else {
      field[slot.col][slot.row] = null;
      renderAll();
      onComplete();
    }
  }
  
  processEffectEvent(data, animations, onComplete) {
    const { effectName, source, targets, amount } = data;
    
    // Show effect message
    if (typeof showMessage === 'function') {
      showMessage(`✨ ${effectName}`, 1000);
    }
    
    // Play appropriate animation based on effect type
    if (animations.includes('damage')) {
      // Damage effect animation handled by separate DAMAGE_DEALT event
      onComplete();
    } else if (animations.includes('heal')) {
      targets.forEach(target => {
        const sprite = this.getSpriteForTarget(target);
        if (sprite) {
          sprite.classList.add('healing');
          setTimeout(() => sprite.classList.remove('healing'), 500);
        }
      });
      setTimeout(onComplete, 500);
    } else if (animations.includes('buff')) {
      targets.forEach(target => {
        const sprite = this.getSpriteForTarget(target);
        if (sprite) {
          sprite.classList.add('buffed');
          setTimeout(() => sprite.classList.remove('buffed'), 600);
        }
      });
      setTimeout(onComplete, 600);
    } else {
      onComplete();
    }
  }
  
  processTurnStartEvent(data, animations, onComplete) {
    const { owner, turnNumber } = data;
    const isMyTurn = this.mapOwner(owner) === 'player';
    
    // Update local game state
    game.currentTurn = this.mapOwner(owner);
    game.turnNumber = turnNumber;
    game.phase = 'conjure1';
    
    // Show turn indicator
    showMessage(isMyTurn ? "Your Turn!" : "Opponent's Turn", 1500);
    
    // Update UI controls
    updateTurnIndicator(isMyTurn);
    
    // Enable/disable player controls
    setControlsEnabled(isMyTurn);
    
    setTimeout(onComplete, 1500);
  }
  
  // Map server owner to local perspective
  // If we're 'enemy' role, we see our cards as 'player' locally
  mapOwner(serverOwner) {
    if (this.playerRole === 'player') {
      return serverOwner;
    } else {
      // We're the 'enemy' - flip the perspective
      return serverOwner === 'player' ? 'enemy' : 'player';
    }
  }
}
```

---

## 4. Animation Coordination

### 4.1 Animation Timing Constants

```javascript
const AnimationTiming = {
  // Card animations
  SUMMON: 500,
  EVOLVE: 800,
  CARD_DRAW: 300,
  CARD_TO_HAND: 400,
  
  // Combat animations
  ATTACK_WINDUP: 200,
  ATTACK_IMPACT: 150,
  DAMAGE_NUMBER: 400,
  HIT_RECOIL: 280,
  DEATH: 800,
  
  // Effect animations
  BUFF_GLOW: 600,
  DEBUFF_FLASH: 500,
  HEAL_PULSE: 500,
  AILMENT_APPLY: 400,
  
  // Ability animations
  ABILITY_TRIGGER: 600,
  TRAP_REVEAL: 700,
  
  // Turn animations
  PHASE_TRANSITION: 300,
  TURN_START: 1500,
  
  // Status effect processing
  BURN_TICK: 400,
  CALAMITY_TICK: 500,
  BLEED_TICK: 350
};
```

### 4.2 Animation Queue Integration

The server includes animation hints with each event, and clients use their existing animation system:

```javascript
class AnimationCoordinator {
  constructor() {
    this.queue = [];
    this.isPlaying = false;
  }
  
  // Called by event processor to play animations
  playEventAnimations(animations, data, onComplete) {
    if (!animations || animations.length === 0) {
      onComplete();
      return;
    }
    
    // Chain animations sequentially
    this.playAnimationChain(animations, data, 0, onComplete);
  }
  
  playAnimationChain(animations, data, index, onComplete) {
    if (index >= animations.length) {
      onComplete();
      return;
    }
    
    const animation = animations[index];
    const duration = this.playAnimation(animation, data);
    
    setTimeout(() => {
      this.playAnimationChain(animations, data, index + 1, onComplete);
    }, duration);
  }
  
  playAnimation(animationType, data) {
    switch (animationType) {
      case 'summon_effect':
        return this.playSummonEffect(data);
      case 'attack_wind_up':
        return this.playAttackWindup(data);
      case 'hit_impact':
        return this.playHitImpact(data);
      case 'death_dramatic':
        return this.playDramaticDeath(data);
      case 'ability_glow':
        return this.playAbilityGlow(data);
      case 'burn_damage':
        return this.playBurnDamage(data);
      // ... map to existing EffectAnimations/CombatEffects
      default:
        return 0;
    }
  }
  
  playSummonEffect(data) {
    const sprite = this.getSprite(data.slot, data.owner);
    if (sprite) {
      sprite.classList.add('summoning');
      setTimeout(() => sprite.classList.remove('summoning'), AnimationTiming.SUMMON);
      if (CombatEffects?.playSummonEffect) {
        CombatEffects.playSummonEffect(data.cryptid);
      }
    }
    return AnimationTiming.SUMMON;
  }
  
  playHitImpact(data) {
    const sprite = this.getSprite(data.targetSlot, data.targetOwner);
    if (sprite && window.playHitEffectOnSprite) {
      playHitEffectOnSprite(sprite, { owner: data.targetOwner }, { 
        intensity: data.damage >= 5 ? 'heavy' : 'normal' 
      });
    }
    if (CombatEffects?.showDamageNumber) {
      CombatEffects.showDamageNumber(data.target, data.damage, data.damage >= 5);
    }
    return AnimationTiming.HIT_RECOIL;
  }
  
  playDramaticDeath(data) {
    const sprite = this.getSprite(data.slot, data.owner);
    if (sprite && CombatEffects?.playDramaticDeath) {
      CombatEffects.playDramaticDeath(sprite, data.owner, data.rarity || 'common');
    }
    return AnimationTiming.DEATH;
  }
}
```

---

## 5. Anti-Cheat Measures

### 5.1 Server-Side Validation

All game logic is validated on the server:

```javascript
// Server validates every action before execution
validateAction(playerRole, action) {
  // 1. Turn validation
  if (this.game.currentTurn !== playerRole && !this.isAlwaysValidAction(action)) {
    return { valid: false, reason: 'NOT_YOUR_TURN' };
  }
  
  // 2. Phase validation
  if (!this.isValidForPhase(action.actionType, this.game.phase)) {
    return { valid: false, reason: 'WRONG_PHASE' };
  }
  
  // 3. Resource validation (pyre, cards in hand, etc.)
  // 4. Target validation (valid slots, valid targets)
  // 5. Timing validation (cooldowns, one-per-turn abilities)
  // 6. State validation (card not already played, creature exists, etc.)
}
```

### 5.2 State Checksums

Periodic state verification detects desync/tampering:

```javascript
// Server sends checksum with every action result
broadcastResult(actionId, events) {
  const checksum = this.calculateStateChecksum();
  
  this.broadcast({
    type: 'ACTION_RESULT',
    actionId,
    events,
    stateChecksum: checksum
  });
}

// Client verifies checksum
handleActionResult(message) {
  const localChecksum = this.calculateLocalChecksum();
  
  if (message.stateChecksum !== localChecksum) {
    console.warn('State desync detected!');
    
    // Request full state sync from server
    this.requestStateSync();
    
    // Log for anti-cheat analysis
    this.logDesync(message.stateChecksum, localChecksum);
  }
}
```

### 5.3 Hidden Information Protection

```javascript
// Server never sends opponent's hidden information
serializeForPlayer(playerRole) {
  const opponentRole = playerRole === 'player' ? 'enemy' : 'player';
  
  return {
    // Full info for own hand
    yourHand: this.serializeHand(playerRole),
    
    // Only card count for opponent
    opponentHandCount: (opponentRole === 'player' ? 
      this.game.playerHand : this.game.enemyHand).length,
    
    // Full info for both fields (public)
    playerField: this.serializeField(this.game.playerField),
    enemyField: this.serializeField(this.game.enemyField),
    
    // Face-down traps show existence but not identity
    yourTraps: this.game[`${playerRole}Traps`].map(t => t ? this.serializeTrap(t) : null),
    opponentTraps: this.game[`${opponentRole}Traps`].map(t => t ? { faceDown: true } : null),
    
    // Deck counts only
    yourDeckCount: (playerRole === 'player' ? this.game.deck : this.game.enemyDeck).length,
    opponentDeckCount: (opponentRole === 'player' ? this.game.deck : this.game.enemyDeck).length
  };
}
```

### 5.4 Rate Limiting

```javascript
class RateLimiter {
  constructor() {
    this.actionCounts = new Map();
    this.limits = {
      SUMMON_CRYPTID: { max: 6, window: 60000 },  // Max 6 summons per minute
      ATTACK: { max: 10, window: 60000 },
      default: { max: 30, window: 60000 }
    };
  }
  
  checkLimit(playerId, actionType) {
    const key = `${playerId}:${actionType}`;
    const now = Date.now();
    const limit = this.limits[actionType] || this.limits.default;
    
    // Clean old entries
    if (!this.actionCounts.has(key)) {
      this.actionCounts.set(key, []);
    }
    
    const timestamps = this.actionCounts.get(key)
      .filter(t => now - t < limit.window);
    
    if (timestamps.length >= limit.max) {
      return false; // Rate limited
    }
    
    timestamps.push(now);
    this.actionCounts.set(key, timestamps);
    return true;
  }
}
```

---

## 6. Reconnection Handling

### 6.1 Server-Side State Preservation

```javascript
class MatchManager {
  constructor() {
    this.activeMatches = new Map();
    this.disconnectedPlayers = new Map(); // player -> { matchId, disconnectTime }
  }
  
  handleDisconnect(playerId, matchId) {
    const match = this.activeMatches.get(matchId);
    if (!match) return;
    
    // Mark player as disconnected
    match.setPlayerDisconnected(playerId);
    
    // Store reconnection info
    this.disconnectedPlayers.set(playerId, {
      matchId,
      disconnectTime: Date.now()
    });
    
    // Notify opponent
    match.broadcastToOpponent(playerId, {
      type: 'OPPONENT_DISCONNECTED',
      reconnectWindow: 60000 // 60 second window
    });
    
    // Start timeout
    setTimeout(() => {
      if (this.disconnectedPlayers.has(playerId)) {
        // Player didn't reconnect - forfeit
        match.forfeit(playerId);
      }
    }, 60000);
  }
  
  handleReconnect(playerId, socket) {
    const reconnectInfo = this.disconnectedPlayers.get(playerId);
    if (!reconnectInfo) return false;
    
    const match = this.activeMatches.get(reconnectInfo.matchId);
    if (!match) return false;
    
    // Restore player to match
    match.reconnectPlayer(playerId, socket);
    
    // Send full state sync
    const playerRole = match.getPlayerRole(playerId);
    socket.send(JSON.stringify({
      type: 'RECONNECTED',
      matchState: match.getFullState(playerRole),
      lastSequence: match.sequence
    }));
    
    // Notify opponent
    match.broadcastToOpponent(playerId, {
      type: 'OPPONENT_RECONNECTED'
    });
    
    this.disconnectedPlayers.delete(playerId);
    return true;
  }
}
```

### 6.2 Client-Side Reconnection

```javascript
class MultiplayerClient {
  handleDisconnect() {
    this.showReconnectingUI();
    
    // Attempt reconnection with exponential backoff
    this.reconnectAttempt = 0;
    this.attemptReconnect();
  }
  
  attemptReconnect() {
    if (this.reconnectAttempt >= 5) {
      this.showConnectionLostUI();
      return;
    }
    
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempt), 30000);
    this.reconnectAttempt++;
    
    setTimeout(() => {
      this.connect(this.matchId, this.authToken)
        .then(() => {
          // Connection restored
          this.hideReconnectingUI();
        })
        .catch(() => {
          this.attemptReconnect();
        });
    }, delay);
  }
  
  handleReconnected(message) {
    // Apply full state
    this.applyFullState(message.matchState);
    
    // Re-render everything
    renderAll();
    
    // Update sequence counter to skip already-processed events
    this.lastSequence = message.lastSequence;
    
    this.hideReconnectingUI();
    showMessage("Reconnected!", 2000);
  }
}
```

---

## 7. Turn Timer System

```javascript
class TurnTimer {
  constructor(match, timePerTurn = 90000, bonusTime = 30000) {
    this.match = match;
    this.timePerTurn = timePerTurn;
    this.bonusTime = bonusTime;
    this.playerBonusTime = {
      player: bonusTime,
      enemy: bonusTime
    };
    this.currentTimer = null;
  }
  
  startTurn(playerRole) {
    this.clearTimer();
    
    const startTime = Date.now();
    this.currentTurnStart = startTime;
    
    // Broadcast timer start to both clients
    this.match.broadcast({
      type: 'TURN_TIMER_START',
      player: playerRole,
      mainTime: this.timePerTurn,
      bonusTime: this.playerBonusTime[playerRole],
      startedAt: startTime
    });
    
    // Set server-side timeout
    this.currentTimer = setTimeout(() => {
      this.handleTimeout(playerRole);
    }, this.timePerTurn);
  }
  
  handleTimeout(playerRole) {
    const bonusRemaining = this.playerBonusTime[playerRole];
    
    if (bonusRemaining > 0) {
      // Start using bonus time
      this.match.broadcast({
        type: 'BONUS_TIME_STARTED',
        player: playerRole,
        bonusTime: bonusRemaining
      });
      
      this.currentTimer = setTimeout(() => {
        this.playerBonusTime[playerRole] = 0;
        this.forceEndTurn(playerRole);
      }, bonusRemaining);
    } else {
      this.forceEndTurn(playerRole);
    }
  }
  
  forceEndTurn(playerRole) {
    this.match.broadcast({
      type: 'TURN_TIMEOUT',
      player: playerRole
    });
    
    // Auto-end turn
    this.match.processAction(playerRole, {
      actionType: 'END_TURN',
      actionId: 'timeout-auto',
      forced: true
    });
  }
  
  // Called when player takes an action
  refreshTimer(playerRole) {
    // Actions during bonus time deduct from bonus pool
    if (this.isInBonusTime) {
      const elapsed = Date.now() - this.bonusTimeStart;
      this.playerBonusTime[playerRole] = Math.max(0, 
        this.playerBonusTime[playerRole] - elapsed
      );
    }
  }
}
```

---

## 8. Matchmaking Integration

### 8.1 Match Request Flow

```javascript
// Client requests a match
{
  type: 'FIND_MATCH',
  playerId: 'uuid',
  deckId: 'deck-uuid',
  mode: 'ranked' // or 'casual', 'tournament'
}

// Server responds when match found
{
  type: 'MATCH_FOUND',
  matchId: 'match-uuid',
  opponent: {
    displayName: 'Player2',
    rating: 1500 // if ranked
  },
  yourRole: 'player', // or 'enemy' - first player is 'player'
  connectUrl: 'wss://game-server.com/match/match-uuid'
}
```

### 8.2 Deck Validation

```javascript
// Server validates deck before match starts
validateDeck(deckCards) {
  const errors = [];
  
  // Check card count
  if (deckCards.length < 20 || deckCards.length > 40) {
    errors.push('Deck must have 20-40 cards');
  }
  
  // Check card limits (max 3 of same non-legendary)
  const cardCounts = {};
  for (const card of deckCards) {
    cardCounts[card.key] = (cardCounts[card.key] || 0) + 1;
    
    const cardDef = CardRegistry.getCryptid(card.key) || 
                    CardRegistry.getBurst(card.key) ||
                    CardRegistry.getTrap(card.key);
    
    if (cardDef) {
      const maxCopies = cardDef.rarity === 'mythical' ? 1 : 3;
      if (cardCounts[card.key] > maxCopies) {
        errors.push(`Too many copies of ${cardDef.name}`);
      }
    } else {
      errors.push(`Unknown card: ${card.key}`);
    }
  }
  
  return { valid: errors.length === 0, errors };
}
```

---

## 9. Implementation Phases

### Phase 1: Core Protocol (Foundation)
- [ ] Define message protocol schema
- [ ] Implement basic WebSocket server
- [ ] Create action validation framework
- [ ] Build state serialization/deserialization

### Phase 2: Game Server (Authority)
- [ ] Port Game class to server (Node.js)
- [ ] Implement all action handlers
- [ ] Add event collection system
- [ ] Build state checksum verification

### Phase 3: Client Integration (Sync)
- [ ] Create MultiplayerClient class
- [ ] Implement event queue processor
- [ ] Integrate with existing animation system
- [ ] Add owner perspective mapping

### Phase 4: Reconnection & Polish
- [ ] Implement disconnect detection
- [ ] Build reconnection flow
- [ ] Add turn timer system
- [ ] Create matchmaking integration

### Phase 5: Testing & Anti-Cheat
- [ ] Unit tests for all validators
- [ ] Integration tests for full game flow
- [ ] Stress testing for edge cases
- [ ] Rate limiting and abuse prevention

---

## 10. File Structure

```
multiplayer/
├── server/
│   ├── GameServer.js         # Main server class
│   ├── ActionValidator.js    # All action validation logic
│   ├── StateSerializer.js    # State serialization
│   ├── EventCollector.js     # Event collection during execution
│   ├── TurnTimer.js          # Turn timing system
│   ├── MatchManager.js       # Match lifecycle management
│   └── RateLimiter.js        # Anti-abuse rate limiting
│
├── client/
│   ├── MultiplayerClient.js  # Main client class
│   ├── EventProcessor.js     # Event queue processing
│   ├── AnimationCoordinator.js # Animation timing
│   ├── ReconnectionHandler.js # Reconnect logic
│   └── UIIntegration.js      # Hooks into existing UI
│
├── shared/
│   ├── MessageTypes.js       # Action/Event type enums
│   ├── AnimationTiming.js    # Animation duration constants
│   └── ChecksumUtil.js       # State checksum calculation
│
└── tests/
    ├── validator.test.js
    ├── sync.test.js
    └── reconnection.test.js
```

---

## Summary

This architecture provides:

1. **Server Authority**: All game logic validated server-side, preventing cheating
2. **Full Animations**: Event-driven system with animation hints ensures both players see all effects
3. **State Sync**: Checksum verification catches desync, full state sync available for recovery
4. **Latency Tolerance**: Event queue processes at client speed, not network speed
5. **Reconnection**: Players can reconnect within time window without losing game
6. **Scalability**: Stateless action validation allows horizontal scaling

The key insight is that **animations are client-side interpretations of server events**. The server sends "what happened" (CRYPTID_DIED, DAMAGE_DEALT), and each client plays the appropriate animation locally. This keeps both clients in sync while preserving the full visual experience.
