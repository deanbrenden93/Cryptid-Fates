# Shared Game Logic Integration Guide

## Overview

The `shared/` folder contains isomorphic game logic that runs identically on both client (browser) and server (Cloudflare Worker).

## Files

| File | Purpose | Lines |
|------|---------|-------|
| `events.js` | Pub/sub event system for game events | ~260 |
| `schema.js` | Effect vocabulary (triggers, actions, targets) | ~520 |
| `card-registry.js` | Card registration and lookup | ~420 |
| `effect-resolver.js` | Effect resolution without DOM | ~750 |
| `game-state.js` | Pure game state management | ~900 |
| `combat-engine.js` | Attack/damage resolution | ~450 |
| `trap-system.js` | Trap spell management | ~330 |
| `turn-processor.js` | Turn/phase flow | ~400 |
| `index.js` | Combined exports and context factory | ~200 |

## Usage

### Browser (Client)

The modules auto-register on `window` when loaded:

```html
<script src="multiplayer/shared/events.js"></script>
<script src="multiplayer/shared/schema.js"></script>
<script src="multiplayer/shared/card-registry.js"></script>
<script src="multiplayer/shared/effect-resolver.js"></script>
<script src="multiplayer/shared/index.js"></script>

<script>
  // Access via window.CryptidShared
  const { createGameContext } = window.CryptidShared;
  const { events, registry, resolver } = createGameContext({ debug: true });
</script>
```

### Cloudflare Worker (Server)

For Cloudflare Workers, you need to bundle the shared modules. Options:

1. **Wrangler with bundling** (recommended):
   ```toml
   # wrangler.toml
   main = "worker.js"
   compatibility_date = "2024-01-01"
   
   [build]
   command = "npm run build"
   ```

2. **Inline in worker.js** (simple, for development):
   Copy the contents of each shared module into the worker file.

3. **Dynamic require** (if using Node.js compatibility):
   ```javascript
   const shared = require('../shared/index.js');
   ```

## Integration Example

### Server-Side Game State

```javascript
// In your Cloudflare Worker

// Create game context
const { events, registry, resolver } = CryptidShared.createGameContext({
  debug: false
});

// Register card effects when summoned
function handleSummon(playerRole, card, col, row, gameState) {
  // Add card to field
  const field = playerRole === 'player' ? gameState.playerField : gameState.enemyField;
  field[col][row] = card;
  
  // Register effects with resolver
  resolver.registerCryptid(card, playerRole, gameState);
  
  // Emit summon event
  events.emit('onSummon', {
    cryptid: card,
    owner: playerRole,
    col,
    row
  });
  
  // Check if entered combat or support
  const combatCol = resolver.getCombatCol(playerRole);
  if (col === combatCol) {
    events.emit('onEnterCombat', { cryptid: card, owner: playerRole, col, row });
  } else {
    events.emit('onEnterSupport', { cryptid: card, owner: playerRole, col, row });
  }
}

// Listen for resolved effects
events.on('effectResolved', ({ cryptid, owner, effect, result }) => {
  // Apply the state changes from result
  applyEffectResult(gameState, result);
  
  // Broadcast to clients
  broadcastGameEvent({
    type: 'EFFECT_TRIGGERED',
    source: { id: cryptid.id, name: cryptid.name },
    action: effect.action,
    targets: result.targets
  });
});

// Apply resolved effects to game state
function applyEffectResult(gameState, result) {
  if (!result.shouldExecute) return;
  
  switch (result.action) {
    case 'dealDamage':
      result.targets.forEach((target, i) => {
        const damage = Array.isArray(result.amount) ? result.amount[i] : result.amount;
        const cryptid = findCryptidById(gameState, target.id);
        if (cryptid) {
          cryptid.currentHp -= damage;
        }
      });
      break;
      
    case 'applyBurn':
    case 'applyAilment':
      result.targets.forEach(target => {
        const cryptid = findCryptidById(gameState, target.id);
        if (cryptid && !cryptid.ailmentImmune) {
          const ailment = result.ailmentType || 'burn';
          if (ailment === 'burn') cryptid.burnTurns = (cryptid.burnTurns || 0) + 1;
          if (ailment === 'bleed') cryptid.bleedTurns = (cryptid.bleedTurns || 0) + 1;
          if (ailment === 'paralyze') cryptid.paralyzed = true;
        }
      });
      break;
      
    case 'buffStats':
      result.targets.forEach(target => {
        const cryptid = findCryptidById(gameState, target.id);
        if (cryptid) {
          if (result.statChanges.atk) {
            cryptid.currentAtk = (cryptid.currentAtk || cryptid.atk) + result.statChanges.atk;
          }
          if (result.statChanges.hp) {
            cryptid.currentHp = (cryptid.currentHp || cryptid.hp) + result.statChanges.hp;
            cryptid.maxHp = (cryptid.maxHp || cryptid.hp) + result.statChanges.hp;
          }
        }
      });
      break;
      
    case 'gainPyre':
      const pyreOwner = result.pyreOwner;
      if (pyreOwner === 'player') {
        gameState.playerPyre += result.amount;
      } else {
        gameState.enemyPyre += result.amount;
      }
      break;
      
    // ... handle other actions
  }
}
```

## Key Concepts

### Effect Resolution Flow

1. **Event fires** (e.g., `onSummon`)
2. **Resolver checks** if effect should trigger
3. **Resolver evaluates** conditions
4. **Resolver resolves** targets
5. **Resolver calculates** amounts
6. **Resolver emits** `effectResolved` event
7. **Game state** applies changes
8. **Broadcast** to clients

### State vs Events

- **Game state** is the canonical source of truth (server-authoritative)
- **Events** are transient - used for triggering effects
- **Effect results** are pure data structures that describe state changes

### Why This Architecture?

1. **Single source of truth**: Game logic lives in shared modules
2. **Server authoritative**: Server resolves effects and applies changes
3. **Client synced**: Clients receive state updates and replay animations
4. **Deterministic**: Same inputs produce same outputs on client and server
5. **Testable**: Pure functions can be unit tested

---

## Phase 5: Complete Game Engine

Phase 5 introduces the complete game engine with game state, combat, traps, and turn management.

### Quick Start

```javascript
// Create a fully-wired game context
const ctx = CryptidShared.createGameContext({ debug: true });

// Access all systems
const { 
  events,        // Event pub/sub
  registry,      // Card registry
  resolver,      // Effect resolver
  gameState,     // Game state management
  combatEngine,  // Combat resolution
  trapSystem,    // Trap handling
  turnProcessor  // Turn/phase flow
} = ctx;
```

### Game State Module (`game-state.js`)

Manages pure game state without any DOM dependencies.

```javascript
const { createGameState } = CryptidShared;
const gameState = createGameState({ events, debug: true });

// Initialize game
gameState.state.playerPyre = 5;
gameState.state.enemyPyre = 5;

// Summon a cryptid
const cryptid = { id: 'c1', name: 'Hellhound', hp: 4, atk: 3, owner: 'player' };
gameState.summonCryptid(cryptid, 'player', 0, 0);

// Query field
const combatant = gameState.getCombatant('player', 0);
const support = gameState.getSupport('player', 0);
const allCryptids = gameState.getAllCryptids('player');

// Apply ailments
gameState.applyAilment(cryptid, 'burn', 3);
gameState.applyAilment(cryptid, 'paralyze', 1);

// Check status
const ailments = gameState.getStatusAilments(cryptid);
console.log(ailments); // [{ type: 'burn', stacks: 3 }, { type: 'paralyze', stacks: 1 }]

// Damage and death
gameState.applyDamage(cryptid, 5, 'enemy');
if (cryptid.currentHp <= 0) {
  gameState.killCryptid(cryptid, 'enemy');
}

// Serialize/deserialize
const snapshot = gameState.exportState();
gameState.importState(snapshot);
```

### Combat Engine (`combat-engine.js`)

Resolves attacks with all modifiers (support, ailments, keywords).

```javascript
const { createCombatEngine } = CryptidShared;
const combatEngine = createCombatEngine({ gameState, debug: true });

// Validate attack
const validation = combatEngine.validateAttack(attacker, target);
if (!validation.valid) {
  console.log('Invalid attack:', validation.reason);
}

// Calculate damage preview
const damageCalc = combatEngine.calculateDamage(attacker, target);
console.log('Final damage:', damageCalc.finalDamage);
console.log('Modifiers:', damageCalc.modifiers);

// Resolve full attack (returns intent, doesn't modify state)
const result = combatEngine.resolveAttack(
  attacker,
  target.owner,
  target.col,
  target.row
);

// Result contains:
// - damage: final damage dealt
// - effects: ailments applied, lifesteal, cleave, etc.
// - deaths: cryptids that died
// - stateChanges: modifications to apply

// Apply the result to game state
const applied = combatEngine.applyCombatResult(result);
```

### Trap System (`trap-system.js`)

Manages trap spell setup, triggering, and destruction.

```javascript
const { createTrapSystem } = CryptidShared;
const trapSystem = createTrapSystem({ gameState, events, debug: true });

// Setup a trap from a spell card
const trapCard = {
  id: 'trap1',
  name: 'Flame Trap',
  effects: [{
    trigger: 'onSummon',
    condition: { targetFilter: { enemy: true } },
    action: 'dealDamage',
    amount: 2
  }]
};
trapSystem.setupTrap(trapCard, 'player');

// Check traps when events occur
const triggered = trapSystem.checkTraps('onSummon', { 
  cryptid: enemyCryptid 
});

// Process triggered traps (with effect resolver)
const intents = trapSystem.processTrapEffects(triggered, resolver);

// Get active traps
const playerTraps = trapSystem.getActiveTraps('player');
const allTraps = trapSystem.getAllActiveTraps();

// Manually destroy a trap
trapSystem.destroyTrap(trap, 'cleanse');

// Serialize/deserialize
const trapData = trapSystem.exportTraps();
trapSystem.importTraps(trapData);
```

### Turn Processor (`turn-processor.js`)

Handles turn flow, phases, and end-of-turn effects.

```javascript
const { createTurnProcessor } = CryptidShared;
const turnProcessor = createTurnProcessor({ 
  gameState, 
  events, 
  combatEngine,
  trapSystem,
  debug: true 
});

// Start a turn
const startResult = turnProcessor.processStartTurn('player');
// - Untaps all cryptids
// - Draws kindling and card
// - Resets per-turn flags
// - Processes paralyze recovery

// Advance phase
turnProcessor.advancePhase(); // conjure1 -> deploy -> conjure2 -> combat -> endPhase

// Get valid actions for current phase
const validActions = turnProcessor.getValidActionsForPhase('player');
// Returns: ['PLAY_SPELL', 'PLAY_PYRE_CARD', 'END_PHASE'] for conjure phases

// End turn (processes burn, bleed, calamity)
const endResult = turnProcessor.processEndTurn('player');
// endResult.phaseEffects.burn - burn damage applied
// endResult.phaseEffects.bleed - bleed damage applied
// endResult.deaths - cryptids that died

// Process complete turn switch
const switchResult = turnProcessor.processTurnSwitch('player');
// Ends player turn, checks game over, starts enemy turn

// Check win condition
const gameOver = turnProcessor.checkGameOver();
if (gameOver.gameOver) {
  console.log('Winner:', gameOver.winner, 'Reason:', gameOver.reason);
}

// Handle support promotion
const promoted = turnProcessor.processPromotion('player', 0);
```

### Complete Multiplayer Flow

```javascript
// Server-side (Cloudflare Worker)
const ctx = CryptidShared.createGameContext({ debug: false });

// Handle player action
function handleAction(playerRole, action) {
  const { gameState, combatEngine, turnProcessor } = ctx;
  
  // Validate it's their turn
  if (gameState.state.currentTurn !== playerRole) {
    return { error: 'NOT_YOUR_TURN' };
  }
  
  // Check valid action for phase
  const validActions = turnProcessor.getValidActionsForPhase(playerRole);
  if (!validActions.includes(action.type)) {
    return { error: 'INVALID_ACTION_FOR_PHASE' };
  }
  
  let result;
  
  switch (action.type) {
    case 'ATTACK':
      result = combatEngine.resolveAttack(
        gameState.getFieldCryptid(playerRole, action.attackerCol, action.attackerRow),
        action.targetOwner,
        action.targetCol,
        action.targetRow
      );
      if (result.success) {
        combatEngine.applyCombatResult(result);
      }
      break;
      
    case 'END_TURN':
      result = turnProcessor.processTurnSwitch(playerRole);
      break;
      
    // ... other actions
  }
  
  // Broadcast state to all clients
  broadcastState(ctx.exportState());
  
  return result;
}

// Client-side - receive and apply state
function onStateUpdate(serializedState) {
  ctx.importState(serializedState);
  renderGame(ctx.gameState.state);
}
```

### Design Principles

1. **Intent-based**: Combat and effects return "intents" describing what should happen, allowing for animation sequencing and validation before state changes.

2. **Dependency Injection**: All modules accept dependencies (events, gameState) rather than importing globals, making them testable and flexible.

3. **Serializable State**: All state can be exported/imported as JSON for network transfer and persistence.

4. **Event-Driven**: Major state changes emit events that can be listened to for side effects (animations, sound, logging).

5. **No DOM**: All modules are pure JavaScript with no browser-specific code, enabling server-side execution.
