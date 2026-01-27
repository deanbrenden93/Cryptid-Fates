/**
 * Cryptid Fates - Game UI
 * UI state, rendering, interactions, and event handlers
 * Part 2 of 2 - Requires game-core.js loaded first
 */

// ==================== UI STATE ====================
let game;
let ui = {
    selectedCard: null, attackingCryptid: null, targetingBurst: null,
    targetingEvolution: null, targetingTrap: null, targetingAura: null,
    targetingDecayRat: null, decayRatAilmentedEnemies: null,
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

// ==================== BATTLEFIELD BACKGROUNDS ====================
/**
 * Apply battlefield backgrounds based on player/enemy equipped backgrounds
 * Handles split/feathered display when both players have backgrounds
 */
function applyBattlefieldBackgrounds(enemyBackgroundId = null) {
    const defaultBgEl = document.getElementById('battlefield-bg-default');
    const playerBgEl = document.getElementById('battlefield-bg-player');
    const enemyBgEl = document.getElementById('battlefield-bg-enemy');
    
    if (!defaultBgEl || !playerBgEl || !enemyBgEl) return;
    
    // Get player's equipped background ('none' means no background)
    const playerBgId = PlayerData?.getEquippedBackground?.() || 'default';
    const playerBg = PlayerData?.getBackground?.(playerBgId);
    const playerHasBg = playerBgId !== 'none' && playerBg?.image;
    
    // Get enemy's background (AI uses frozen-tundra background by default)
    const enemyBgId = enemyBackgroundId || 'frozen-tundra';
    const enemyBg = PlayerData?.getBackground?.(enemyBgId);
    const enemyHasBg = enemyBgId !== 'none' && enemyBg?.image;
    
    // Reset all backgrounds
    defaultBgEl.style.display = 'none';
    playerBgEl.style.display = 'none';
    enemyBgEl.style.display = 'none';
    playerBgEl.classList.remove('solo-bg');
    enemyBgEl.classList.remove('solo-bg');
    
    // Handle 'none' cases
    if (!playerHasBg && !enemyHasBg) {
        // Both have 'none' - show default background
        defaultBgEl.style.display = 'block';
        console.log('[Backgrounds] Both none - showing default');
        return;
    }
    
    if (!playerHasBg && enemyHasBg) {
        // Player has 'none', enemy has background - show enemy's fully
        enemyBgEl.style.backgroundImage = `url('${enemyBg.image}')`;
        enemyBgEl.classList.add('solo-bg');
        enemyBgEl.style.display = 'block';
        console.log('[Backgrounds] Player none, enemy has bg:', enemyBgId);
        return;
    }
    
    if (playerHasBg && !enemyHasBg) {
        // Player has background, enemy has 'none' - show player's fully
        playerBgEl.style.backgroundImage = `url('${playerBg.image}')`;
        playerBgEl.classList.add('solo-bg');
        playerBgEl.style.display = 'block';
        console.log('[Backgrounds] Player has bg, enemy none:', playerBgId);
        return;
    }
    
    // Both have backgrounds
    const sameBg = playerBgId === enemyBgId;
    
    if (sameBg) {
        // Both have the same background - show it fully on player side (no split needed)
        playerBgEl.style.backgroundImage = `url('${playerBg.image}')`;
        playerBgEl.classList.add('solo-bg');
        playerBgEl.style.display = 'block';
    } else {
        // Different backgrounds - show split/feathered
        playerBgEl.style.backgroundImage = `url('${playerBg.image}')`;
        enemyBgEl.style.backgroundImage = `url('${enemyBg.image}')`;
        playerBgEl.style.display = 'block';
        enemyBgEl.style.display = 'block';
    }
    
    console.log('[Backgrounds] Applied:', { playerBgId, enemyBgId, sameBg });
}
window.applyBattlefieldBackgrounds = applyBattlefieldBackgrounds;

// ==================== GAME INITIALIZATION ====================
function initGame() {
    game = new Game();
    window.pendingTraps = [];
    window.processingTraps = false;
    window.animatingTraps = new Set();
    
    // Apply battlefield backgrounds
    applyBattlefieldBackgrounds();
    
    // Reset EffectStack for new game
    EffectStack.clear();
    EffectStack.history = [];
    
    // Initialize EventFeedback system (only once)
    if (!window._eventFeedbackInitialized) {
        EventFeedback.init();
        window._eventFeedbackInitialized = true;
    } else {
        // Clear any pending messages from previous game
        EventFeedback.clear();
    }
    
    EventLog.init();
    MatchLog.init(); // Initialize detailed match logging
    
    ui = {
        selectedCard: null, attackingCryptid: null, targetingBurst: null,
        targetingEvolution: null, targetingTrap: null, targetingAura: null,
        targetingDecayRat: null, decayRatAilmentedEnemies: null,
        draggedCard: null, dragGhost: null, showingKindling: false,
        cardTooltipTimer: null, cardTooltipVisible: false, handCollapsed: false
    };
    window.ui = ui; // Keep window reference updated
    isAnimating = false;
    window._opponentTurnMessageShown = false; // Reset opponent turn message flag
    
    // Reset hand toggle visual state
    const handArea = document.getElementById('hand-area');
    const handContainer = document.getElementById('hand-container');
    if (handArea) handArea.classList.remove('collapsed');
    
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
            game.drawCard('player', 'initial');
            game.drawCard('enemy', 'initial');
        }
    }
    
    // Determine who goes first based on main menu coin flip
    const firstPlayer = window.playerGoesFirst !== false ? 'player' : 'enemy';
    game.startTurn(firstPlayer);
    
    // Check if we should animate the starting hand (skip for test mode and tutorials)
    const shouldAnimateHand = window.CombatEffects?.playStartingHandAnimation && !window.testMode && !window.isTutorial;
    
    // Hide hand IMMEDIATELY before any rendering can occur (class bypasses transition)
    if (shouldAnimateHand) {
        const handContainer = document.getElementById('hand-container');
        if (handContainer) {
            handContainer.classList.add('drawing-animation');
        }
    }
    
    // Block all input during match start sequence
    if (typeof window.setAnimating === 'function') {
        window.setAnimating(true);
    }
    
    setTimeout(() => {
        calculateTilePositions();
        
        // Render everything (hand is already hidden if animating)
        renderAll();
        lastBattlefieldHeight = document.getElementById('battlefield-area').offsetHeight;
        updateButtons();
        
        // Function to play the match start sequence after hand is revealed
        const playMatchStartSequence = () => {
            // Step 1: Show "BATTLE!" banner
            if (window.CombatEffects?.playBattleBanner) {
                window.CombatEffects.playBattleBanner(() => {
                    // Step 2: After BATTLE banner, show turn banner
                    setTimeout(() => {
                        if (window.CombatEffects?.playTurnTransition) {
                            window.CombatEffects.playTurnTransition(firstPlayer, () => {
                                // Step 3: After turn banner, run AI if enemy goes first
                                if (firstPlayer === 'enemy') {
                                    if (!window.TutorialManager?.isActive || window.TutorialManager?.freePlayMode) {
                                        setTimeout(() => {
                                            if (!game.gameOver) window.runEnemyAI();
                                        }, 300);
                                    }
                                }
                            });
                        } else {
                            // Fallback if no turn transition
                            if (typeof window.setAnimating === 'function') {
                                window.setAnimating(false);
                            }
                        }
                    }, 300);
                });
            } else {
                // Fallback to simple messages if CombatEffects not available
                showMessage("⚔ BATTLE! ⚔", 1200);
                setTimeout(() => {
                    showMessage(firstPlayer === 'player' ? "Your Turn" : "Enemy Turn", 1500);
                    setTimeout(() => {
                        if (typeof window.setAnimating === 'function') {
                            window.setAnimating(false);
                        }
                        if (firstPlayer === 'enemy' && (!window.TutorialManager?.isActive || window.TutorialManager?.freePlayMode)) {
                            setTimeout(() => {
                                if (!game.gameOver) window.runEnemyAI();
                            }, 300);
                        }
                    }, 1200);
                }, 1000);
            }
        };
        
        // Now play the starting hand animation
        if (shouldAnimateHand && window.CombatEffects?.playStartingHandAnimation) {
            let animationCompleted = false;
            
            // Safety timeout - if animation doesn't complete in 5 seconds, force show hand
            const safetyTimeout = setTimeout(() => {
                if (!animationCompleted) {
                    console.warn('[initGame] Starting hand animation safety timeout triggered');
                    const hc = document.getElementById('hand-container');
                    if (hc) {
                        hc.classList.remove('drawing-animation');
                    }
                    playMatchStartSequence();
                }
            }, 5000);
            
            window.CombatEffects.playStartingHandAnimation(game.playerHand.length, () => {
                animationCompleted = true;
                clearTimeout(safetyTimeout);
                // Show actual cards with entering animation after draw animation completes
                const hc = document.getElementById('hand-container');
                if (hc) {
                    hc.classList.remove('drawing-animation');
                }
                renderHandAnimated();
                
                // Wait for hand reveal animation, then play match start sequence
                setTimeout(() => {
                    playMatchStartSequence();
                }, 600);
            });
        } else {
            // No animation - unhide hand if needed
            if (shouldAnimateHand) {
                const hc = document.getElementById('hand-container');
                if (hc) {
                    hc.classList.remove('drawing-animation');
                }
            }
            
            // Skip match start sequence for tutorials (they have their own flow)
            if (window.isTutorial) {
                if (typeof window.setAnimating === 'function') {
                    window.setAnimating(false);
                }
            } else {
                playMatchStartSequence();
            }
        }
    }, 50);
    
    window.game = game;
}

// ==================== TILE POSITIONS ====================
function calculateTilePositions() {
    // GUARD: Don't recalculate during dramatic death zoom - getBoundingClientRect returns
    // zoomed coordinates, but sprite left/top are in parent coordinate space (pre-transform).
    // This mismatch causes sprites to shift dramatically during zoom animations.
    // Use counter (not boolean) to support overlapping death animations
    if ((window.CombatEffects?._dramaticDeathZoomCount || 0) > 0) {
        return;
    }
    
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
        // Force refresh support links since positions changed
        if (typeof forceRefreshSupportLinks === 'function') {
            forceRefreshSupportLinks();
        }
    }
    // Update hand padding for new viewport size
    if (typeof updateHandPadding === 'function') {
        updateHandPadding();
    }
}

// ==================== SCROLL-CENTERED CARD SYSTEM ====================
// Cards lift/scale/brighten based on distance from center of viewport

let handAnimationRunning = false;

// Get card width from CSS variable or default
function getCardWidth() {
    const handArea = document.getElementById('hand-area');
    if (!handArea) return 88;
    const style = getComputedStyle(handArea);
    const cardW = style.getPropertyValue('--card-w');
    return parseInt(cardW) || 88;
}

// Update dynamic padding to allow centering single cards
function updateHandPadding() {
    const wrapper = document.querySelector('.hand-scroll-wrapper');
    if (!wrapper) return;
    
    const containerWidth = wrapper.clientWidth;
    const cardWidth = getCardWidth() + 8; // card + gap
    const centerOffset = Math.max(0, (containerWidth / 2) - (cardWidth / 2));
    
    wrapper.style.paddingLeft = `${centerOffset}px`;
    wrapper.style.paddingRight = `${centerOffset}px`;
}

// Update card positions based on scroll - runs every frame
function updateCardPositions() {
    const wrapper = document.querySelector('.hand-scroll-wrapper');
    const container = document.getElementById('hand-container');
    if (!wrapper || !container) return;
    
    const scrollPos = wrapper.scrollLeft;
    const containerWidth = wrapper.clientWidth;
    const cardWidth = getCardWidth() + 8; // card + gap
    const centerOffset = Math.max(0, (containerWidth / 2) - (cardWidth / 2));
    
    // Get mobile scale modifier from CSS (defaults to 1 on desktop)
    const firstCard = container.querySelector('.card-wrapper');
    const mobileScaleMod = firstCard 
        ? parseFloat(getComputedStyle(firstCard).getPropertyValue('--mobile-scale')) || 1
        : 1;
    
    const cards = container.querySelectorAll('.card-wrapper');
    cards.forEach((card, i) => {
        // Calculate card's center position relative to scroll
        const cardCenter = centerOffset + (i * cardWidth) + (cardWidth / 2);
        const viewCenter = scrollPos + (containerWidth / 2);
        const distance = Math.abs(cardCenter - viewCenter);
        
        // Calculate effects based on distance from center
        const lift = Math.max(0, 25 - distance * 0.12);
        const baseScale = Math.max(0.9, 1.08 - distance * 0.001);
        const scale = baseScale * mobileScaleMod; // Apply mobile scale modifier
        const brightness = Math.max(0.6, 1 - distance * 0.003);
        
        // Z-index: use precise distance-based calculation to avoid ties/stutter
        // Higher z-index for cards closer to center, with enough granularity to prevent fighting
        const zIndex = Math.max(1, 50 - Math.floor(distance / 3));
        
        // Check if card is unplayable - apply additional dimming
        const battleCard = card.querySelector('.battle-card');
        const isUnplayable = battleCard?.classList.contains('unplayable');
        const finalBrightness = isUnplayable ? brightness * 0.6 : brightness;
        
        // Apply transform and filter - shadow is handled by CSS drop-shadow on .battle-card
        card.style.transform = `translateY(${-lift}px) scale(${scale})`;
        card.style.filter = `brightness(${finalBrightness})`;
        card.style.zIndex = zIndex;
    });
}

// Start the animation loop for hand cards
function startHandAnimation(forceRestart = false) {
    // Force restart if requested (e.g., when entering a new battle)
    if (forceRestart && handAnimationRunning) {
        handAnimationRunning = false;
    }
    
    if (handAnimationRunning) return;
    handAnimationRunning = true;
    
    function animateHand() {
        if (!handAnimationRunning) return;
        updateCardPositions();
        requestAnimationFrame(animateHand);
    }
    requestAnimationFrame(animateHand);
}

// Stop the animation loop (e.g., when leaving battle screen)
function stopHandAnimation() {
    handAnimationRunning = false;
}

// Initialize hand system
document.addEventListener('DOMContentLoaded', () => {
    const wrapper = document.querySelector('.hand-scroll-wrapper');
    if (wrapper) {
        // Update padding on resize
        window.addEventListener('resize', updateHandPadding);
        updateHandPadding();
        
        // Start the animation loop
        startHandAnimation();
    }
});

// Expose functions for external use
window.updateHandPadding = updateHandPadding;
window.startHandAnimation = startHandAnimation;
window.stopHandAnimation = stopHandAnimation;

// ==================== RENDERING ====================
function renderAll() {
    // DEBUG: Uncomment to find mystery render calls during evolution
    // const pendingSprite = document.querySelector('[data-evolution-pending="true"]');
    // if (pendingSprite) {
    //     console.warn('[DEBUG] renderAll called during evolution!');
    //     console.trace();
    // }
    
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
        "Warden's Turn" :
        game.phase === 'conjure1' ? "First Conjuring" :
        game.phase === 'combat' ? "Battle Phase" : "Second Conjuring";
    document.getElementById('phase-text').textContent = phaseText;
    
    // Update phase-based visual effects
    updatePhaseVisualEffects();
    
    // Update danger vignette based on player deaths
    updateDangerVignette();
}

// Apply visual effects based on current game phase
function updatePhaseVisualEffects() {
    const gameContainer = document.getElementById('game-container');
    if (!gameContainer) return;
    
    // Remove all phase classes
    gameContainer.classList.remove('phase-combat', 'phase-conjure', 'enemy-turn');
    
    if (game.currentTurn === 'enemy') {
        gameContainer.classList.add('enemy-turn');
    } else if (game.phase === 'combat') {
        gameContainer.classList.add('phase-combat');
    } else if (game.phase === 'conjure1' || game.phase === 'conjure2') {
        gameContainer.classList.add('phase-conjure');
    }
    
    // Update active turn indicator on player names
    const playerName = document.querySelector('.player-info.player .player-name');
    const enemyName = document.querySelector('.player-info.enemy .player-name');
    
    if (playerName && enemyName) {
        if (game.currentTurn === 'player') {
            playerName.classList.add('active-turn');
            enemyName.classList.remove('active-turn');
        } else {
            playerName.classList.remove('active-turn');
            enemyName.classList.add('active-turn');
        }
    }
}

// Survival horror style danger vignette when near death (7+ deaths)
function updateDangerVignette() {
    const gameContainer = document.getElementById('game-container');
    if (!gameContainer) return;
    
    // Remove all danger classes first
    gameContainer.classList.remove('danger-warning', 'danger-critical', 'danger-imminent');
    
    const deaths = game.playerDeaths || 0;
    
    if (deaths >= 9) {
        // Critical - one more death = loss
        gameContainer.classList.add('danger-imminent');
    } else if (deaths >= 8) {
        // Very dangerous
        gameContainer.classList.add('danger-critical');
    } else if (deaths >= 7) {
        // Warning level
        gameContainer.classList.add('danger-warning');
    }
}

function updateHint() {
    const hint = document.getElementById('hint');
    if (game.currentTurn !== 'player') {
        hint.textContent = "The Warden acts...";
    }
    else if (ui.targetingTrap) hint.textContent = `Choose trap slot for ${ui.targetingTrap.name}`;
    else if (ui.targetingBurst) hint.textContent = `Choose target for ${ui.targetingBurst.name}`;
    else if (ui.targetingAura) hint.textContent = `Choose ally to enchant with ${ui.targetingAura.name}`;
    else if (ui.targetingEvolution) hint.textContent = `Choose ${getCardDisplayName(ui.targetingEvolution.evolvesFrom)} to transform`;
    else if (ui.targetingDecayRat) hint.textContent = `Choose an ailmented enemy to decay`;
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
    
    // Track which sprite keys we've rendered this pass (to remove stale sprites at the end)
    const renderedKeys = new Set();
    
    // For animating trap sprites, we need to skip them entirely
    const animatingTrapKeys = new Set();
    if (window.animatingTraps?.size > 0) {
        window.animatingTraps.forEach(key => animatingTrapKeys.add(key));
    }
    
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
                    
                    renderedKeys.add(key);
                    
                    let classes = 'cryptid-sprite';
                    if (cryptid.tapped) classes += ' tapped';
                    if (owner === 'enemy') classes += ' enemy';
                    if (cryptid.evolutionChain?.length > 1) classes += ' evolved';
                    if (cryptid.element) classes += ` element-${cryptid.element}`;
                    if (cryptid.rarity) classes += ` rarity-${cryptid.rarity}`;
                    if (cryptid.isHidden) classes += ' hidden-cryptid';
                    
                    // Add attacker-selected class for combat phase highlighting
                    if (ui.attackingCryptid === cryptid) classes += ' attacker-selected';
                    
                    // Add can-attack-cryptid class for clickable attackers during combat
                    if (owner === 'player' && col === combatCol && game.phase === 'combat' && 
                        game.currentTurn === 'player' && !cryptid.tapped && cryptid.canAttack) {
                        classes += ' can-attack-cryptid';
                    }
                    
                    // Track if this is a new summon for enhanced animation
                    const wasJustSummoned = cryptid.justSummoned;
                    if (wasJustSummoned) {
                        // DON'T add 'summoning' class - enhanced playSummonAnimation handles it
                        setTimeout(() => { cryptid.justSummoned = false; }, 50);
                    }
                    
                    // Try to find existing sprite to update in place (prevents flickering)
                    let sprite = spriteLayer.querySelector(`.cryptid-sprite[data-owner="${owner}"][data-col="${col}"][data-row="${row}"]`);
                    
                    // If we found a sprite that's part of a death animation, REMOVE it from DOM entirely
                    // playDramaticDeath uses a clone for the death animation, so the original is just hidden garbage
                    if (sprite?.dataset.dramaticDeathStarted) {
                        sprite.remove();
                        sprite = null;
                    }
                    
                    // For promotions: if no sprite found at combat col, look for one at support col to REUSE
                    // This prevents the "blink" caused by removing old sprite and creating new one
                    if (!sprite && col === combatCol) {
                        const oldSupportSprite = spriteLayer.querySelector(`.cryptid-sprite[data-owner="${owner}"][data-col="${supportCol}"][data-row="${row}"]`);
                        if (oldSupportSprite && !oldSupportSprite.dataset.dramaticDeathStarted) {
                            // Reuse the old support sprite - just update its data-col
                            oldSupportSprite.dataset.col = col;
                            sprite = oldSupportSprite;
                        }
                    }
                    
                    const isNewSprite = !sprite;
                    
                    // Track if this is a different cryptid than before (to avoid image reload flicker)
                    const cryptidKey = cryptid.key + (cryptid.evolutionChain?.length || 0);
                    const needsContentUpdate = isNewSprite || sprite.dataset.cryptidKey !== cryptidKey;
                    
                    if (isNewSprite) {
                        sprite = document.createElement('div');
                        sprite.dataset.owner = owner;
                        sprite.dataset.col = col;
                        sprite.dataset.row = row;
                    }
                    
                    // Preserve evolution animation classes during render
                    // These classes control the visual transition and must not be removed mid-animation
                    const evolutionClasses = [
                        'evolution-gathering-phase',
                        'evolution-cocoon-phase', 
                        'evolution-whiteout-phase',
                        'evolution-reveal-phase',
                        'evolution-settle-phase',
                        'evolution-fadeout-phase'
                    ];
                    const preservedClasses = evolutionClasses.filter(cls => sprite.classList?.contains(cls));
                    // Only use the pending flag to block updates - this is cleared when animation is ready for sprite change
                    const isEvolutionPending = sprite.dataset?.evolutionPending === 'true';
                    
                    // Don't update cryptidKey during pending evolution - this prevents premature image change
                    if (!isEvolutionPending) {
                        sprite.dataset.cryptidKey = cryptidKey;
                    }
                    sprite.className = classes + (preservedClasses.length ? ' ' + preservedClasses.join(' ') : '');
                    
                    // Clear any lingering inline opacity from death animations
                    // This is needed when a support is promoted to a combat slot
                    // where a dying cryptid's sprite had opacity:0 set
                    if (sprite.style.opacity === '0') {
                        sprite.style.opacity = '';
                    }
                    // Also clear the dramatic death flag if this is a different cryptid now
                    if (needsContentUpdate && sprite.dataset.dramaticDeathStarted) {
                        delete sprite.dataset.dramaticDeathStarted;
                    }
                    
                    // Hidden enemy cryptids show "?" to opponent
                    if (cryptid.isHidden && owner === 'enemy') {
                        if (needsContentUpdate) {
                            sprite.innerHTML = `
                                <span class="sprite hidden-sprite">❓</span>
                                <div class="combat-stats">
                                    <div class="hp-bar-vertical">
                                        <div class="hp-fill" style="height: 100%"></div>
                                    </div>
                                    <div class="stat-badges-column">
                                        <div class="stat-badge atk-badge">
                                            <span class="stat-icon">⚔</span>
                                            <span class="stat-value">?</span>
                                        </div>
                                        <div class="stat-badge hp-badge">
                                            <span class="stat-icon">♥</span>
                                            <span class="stat-value">?</span>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }
                        sprite.style.left = pos.x + 'px';
                        sprite.style.top = pos.y + 'px';
                        sprite.style.transform = 'translate(-50%, -50%)';
                        // Row-based z-index for depth (hidden sprites too)
                        sprite.style.zIndex = (row + 1) * 10;
                        if (isNewSprite) spriteLayer.appendChild(sprite);
                        continue;
                    }
                    
                    let displayAtk = cryptid.currentAtk - (cryptid.atkDebuff || 0) - (cryptid.curseTokens || 0) - (cryptid.gremlinAtkDebuff || 0) - (cryptid.decayRatAtkDebuff || 0);
                    let displayHp = cryptid.currentHp;
                    let displayMaxHp = cryptid.maxHp || cryptid.hp;
                    if (col === combatCol) {
                        const support = game.getFieldCryptid(owner, supportCol, row);
                        if (support) {
                            displayAtk += support.currentAtk - (support.atkDebuff || 0) - (support.curseTokens || 0);
                            displayHp += support.currentHp;
                            displayMaxHp += support.maxHp || support.hp;
                        }
                    }
                    
                    // Calculate HP percentage (includes support HP for combatants)
                    const hpPercent = Math.max(0, Math.min(100, (displayHp / displayMaxHp) * 100));
                    
                    // HP fill height for vertical bar (fills from bottom)
                    const hpFillHeight = hpPercent;
                    
                    // Build evolution pips
                    let evoPipsHtml = '';
                    if (cryptid.evolutionChain?.length > 1) {
                        evoPipsHtml = '<div class="evo-pips">';
                        for (let i = 1; i < cryptid.evolutionChain.length; i++) {
                            evoPipsHtml += '<span class="evo-pip"></span>';
                        }
                        evoPipsHtml += '</div>';
                    }
                    
                    const statusIcons = game.getStatusIcons(cryptid);
                    
                    // Generate signature for comparing icon sets (just categories, not counts)
                    const iconSignature = statusIcons.map(s => s.category).join('|');
                    
                    // Build status icons HTML for inline display with styled containers
                    const statusIconsHtml = statusIcons.length > 0 
                        ? `<div class="status-icons-scroll-wrapper">${statusIcons.map(s => `<span class="status-icon-item ${s.category}" data-tooltip="${s.tooltip.replace(/"/g, '&quot;')}" data-category="${s.category}"><span class="status-icon-emoji">${s.icon}</span>${s.count ? `<span class="status-icon-count">${s.count}</span>` : ''}</span>`).join('')}</div>`
                        : '';
                    
                    // For existing sprites with image-based cryptids, update stats without replacing the image
                    // This prevents flickering caused by image reload
                    // Also skip full updates during pending evolution - the animation controls when the image changes
                    if (!needsContentUpdate || isEvolutionPending) {
                        // During evolution, skip ALL updates - stats will update when animation reveals new form
                        if (!isEvolutionPending) {
                            // Just update the dynamic parts: stats and status icons
                            const atkValue = sprite.querySelector('.atk-badge .stat-value');
                            const hpValue = sprite.querySelector('.hp-badge .stat-value');
                            const statusDiv = sprite.querySelector('.status-icons');
                            
                            if (atkValue) atkValue.textContent = Math.max(0, displayAtk);
                            if (hpValue) hpValue.textContent = Math.max(0, displayHp);
                            
                            // Update HP fill bar
                            const hpFill = sprite.querySelector('.hp-fill');
                            if (hpFill) {
                                hpFill.style.height = `${hpFillHeight}%`;
                                hpFill.className = 'hp-fill' + (hpPercent <= 25 ? ' hp-low' : hpPercent <= 50 ? ' hp-medium' : '');
                            }
                            
                            // Smart status icon updates - only rebuild if icons added/removed
                            const iconsColumn = sprite.querySelector('.stat-icons-column');
                            if (iconsColumn) {
                                const currentSignature = iconsColumn.dataset.iconSignature || '';
                                
                                if (statusIcons.length === 0) {
                                    // No icons - hide column
                                    if (currentSignature !== '') {
                                        iconsColumn.innerHTML = '';
                                        iconsColumn.style.display = 'none';
                                        iconsColumn.dataset.iconSignature = '';
                                        iconsColumn.classList.remove('has-overflow');
                                    }
                                } else if (iconSignature !== currentSignature) {
                                    // Icons changed (added/removed) - full rebuild
                                    iconsColumn.innerHTML = statusIconsHtml;
                                    iconsColumn.style.display = 'flex';
                                    iconsColumn.dataset.iconSignature = iconSignature;
                                    // Check for overflow and setup scrolling
                                    checkStatusIconOverflow(iconsColumn);
                                } else {
                                    // Same icons, just update counts and tooltips
                                    statusIcons.forEach(s => {
                                        const iconEl = iconsColumn.querySelector(`.status-icon-item[data-category="${s.category}"]`);
                                        if (iconEl) {
                                            // Update tooltip
                                            iconEl.dataset.tooltip = s.tooltip;
                                            // Update count
                                            const countEl = iconEl.querySelector('.status-icon-count');
                                            if (s.count) {
                                                if (countEl) {
                                                    countEl.textContent = s.count;
                                                } else {
                                                    // Add count element if didn't exist
                                                    const newCount = document.createElement('span');
                                                    newCount.className = 'status-icon-count';
                                                    newCount.textContent = s.count;
                                                    iconEl.appendChild(newCount);
                                                }
                                            } else if (countEl) {
                                                // Remove count if no longer needed
                                                countEl.remove();
                                            }
                                        }
                                    });
                                }
                            }
                            
                            // Remove old external status-icons div if it exists
                            if (statusDiv) {
                                statusDiv.remove();
                            }
                        }
                    } else {
                        // Full rebuild for new sprites or changed cryptids
                        let html = `<span class="sprite">${renderSprite(cryptid.sprite, true, cryptid.spriteScale, null, cryptid.spriteFlip)}</span>`;
                        // Show hidden indicator for own hidden cryptids
                        if (cryptid.isHidden && owner === 'player') {
                            html = `<span class="sprite hidden-own">${renderSprite(cryptid.sprite, true, cryptid.spriteScale, null, cryptid.spriteFlip)}<span class="hidden-badge">👁️</span></span>`;
                        }
                        
                        html += `
                            <div class="combat-stats">
                                <div class="hp-bar-vertical">
                                    <div class="hp-fill${hpPercent <= 25 ? ' hp-low' : hpPercent <= 50 ? ' hp-medium' : ''}" style="height: ${hpFillHeight}%"></div>
                                </div>
                                <div class="stat-icons-column" data-icon-signature="${iconSignature}" style="${statusIcons.length > 0 ? '' : 'display: none;'}">
                                    ${statusIconsHtml}
                                </div>
                                <div class="stat-badges-column">
                                    <div class="stat-badge atk-badge">
                                        <span class="stat-icon">⚔</span>
                                        <span class="stat-value">${Math.max(0, displayAtk)}</span>
                                    </div>
                                    <div class="stat-badge hp-badge">
                                        <span class="stat-icon">♥</span>
                                        <span class="stat-value">${Math.max(0, displayHp)}</span>
                                    </div>
                                    ${evoPipsHtml}
                                </div>
                            </div>
                        `;
                        
                        sprite.innerHTML = html;
                        
                        // Check for overflow on newly built icons column
                        if (statusIcons.length > 0) {
                            const iconsColumn = sprite.querySelector('.stat-icons-column');
                            checkStatusIconOverflow(iconsColumn);
                        }
                    }
                    // Skip position updates for sprites in active promotion animation
                    // (the sprite stays at support position until animateSupportPromotion moves it)
                    const promotionKey = `${owner}-${row}`;
                    const isPromoting = window.activePromotions?.has(promotionKey);
                    if (!isPromoting) {
                        sprite.style.left = pos.x + 'px';
                        sprite.style.top = pos.y + 'px';
                    }
                    // If promoting and reusing old sprite, it's already at support position - don't move it
                    sprite.style.transform = 'translate(-50%, -50%)';
                    // Row-based z-index for depth: top row (0) = back, bottom row (2) = front
                    sprite.style.zIndex = (row + 1) * 10;
                    if (isNewSprite) {
                        // SUMMON FLASH FIX: Hide sprite initially if it's a new summon
                        // The playSummonAnimation will reveal it with proper animation
                        if (wasJustSummoned && window.CombatEffects?.playSummonAnimation) {
                            sprite.style.opacity = '0';
                            sprite.style.visibility = 'hidden';
                        }
                        
                        spriteLayer.appendChild(sprite);
                        
                        // Trigger enhanced summon animation for new sprites
                        if (wasJustSummoned && window.CombatEffects?.playSummonAnimation) {
                            // Use requestAnimationFrame to ensure DOM is ready before animation
                            requestAnimationFrame(() => {
                                // Remove hiding styles - animation CSS will take over
                                sprite.style.opacity = '';
                                sprite.style.visibility = '';
                                window.CombatEffects.playSummonAnimation(
                                    sprite, 
                                    cryptid.element || 'steel', 
                                    cryptid.rarity || 'common'
                                );
                            });
                        }
                    }
                }
            }
        }
        
        const traps = owner === 'player' ? game.playerTraps : game.enemyTraps;
        for (let row = 0; row < 2; row++) {
            const trap = traps[row];
            const trapKey = `${owner}-trap-${row}`;
            
            // Skip animating traps entirely
            if (animatingTrapKeys.has(trapKey)) {
                renderedKeys.add(trapKey);
                continue;
            }
            
            if (trap) {
                const key = trapKey;
                const pos = tilePositions[key];
                if (!pos) continue;
                
                renderedKeys.add(key);
                
                let classes = 'trap-sprite';
                // Enemy traps are hidden until triggered
                const isHidden = trap.faceDown && owner === 'enemy';
                if (isHidden) classes += ' face-down';
                
                // Add spawning animation for newly placed traps
                if (window.newlySpawnedTrap && 
                    window.newlySpawnedTrap.owner === owner && 
                    window.newlySpawnedTrap.row === row) {
                    classes += ' spawning';
                }
                
                // Try to find existing sprite to update in place (prevents flickering)
                let sprite = spriteLayer.querySelector(`.trap-sprite[data-owner="${owner}"][data-row="${row}"]`);
                const isNewSprite = !sprite;
                
                if (isNewSprite) {
                    sprite = document.createElement('div');
                    sprite.dataset.owner = owner;
                    sprite.dataset.col = 'trap';
                    sprite.dataset.row = row;
                }
                
                sprite.className = classes;
                
                let html;
                // Enemy traps are hidden until triggered
                if (trap.faceDown && owner === 'enemy') {
                    html = `<span class="sprite">🎴</span><span class="trap-indicator">?</span>`;
                } else {
                    html = `<span class="sprite">${trap.sprite}</span><span class="trap-indicator">⚡</span>`;
                }
                
                sprite.innerHTML = html;
                sprite.style.left = pos.x + 'px';
                sprite.style.top = pos.y + 'px';
                sprite.style.transform = 'translate(-50%, -50%)';
                if (isNewSprite) spriteLayer.appendChild(sprite);
                
                const tile = document.querySelector(`.tile[data-owner="${owner}"][data-col="trap"][data-row="${row}"]`);
                if (tile) tile.classList.add('has-trap');
            }
        }
    }
    
    // Clean up stale sprites (cryptids/traps that no longer exist)
    Array.from(spriteLayer.children).forEach(child => {
        // Skip death effect sprites and dramatic death sprites (they clean themselves up)
        if (child.classList.contains('death-effect-sprite')) return;
        if (child.classList.contains('death-drama-sprite')) return;
        // Skip support link lines - they're managed separately by renderSupportLinks()
        if (child.classList.contains('support-link-line')) return;
        
        const owner = child.dataset.owner;
        const col = child.dataset.col;
        const row = child.dataset.row;
        
        // Build the key based on sprite type
        const key = col === 'trap' ? `${owner}-trap-${row}` : `${owner}-${col}-${row}`;
        
        // If this sprite wasn't rendered this pass, remove it
        if (!renderedKeys.has(key)) {
            child.remove();
        }
    });
    
    document.querySelectorAll('.tile.trap').forEach(tile => {
        const owner = tile.dataset.owner;
        const row = parseInt(tile.dataset.row);
        const traps = owner === 'player' ? game.playerTraps : game.enemyTraps;
        if (!traps[row]) tile.classList.remove('has-trap');
    });
    
    // Render support link lines during combat phase
    renderSupportLinks();
    
    // Setup status icon tooltip listeners
    setupStatusIconListeners();
}

// Track current support link configuration to avoid unnecessary re-renders
let currentSupportLinkConfig = '';

// Render visual links between combatants and their supports
// Only recreates links when the actual configuration changes (preserves animations)
function renderSupportLinks() {
    const spriteLayer = document.getElementById('sprite-layer');
    if (!spriteLayer) return;
    
    // Build a configuration string representing current support-combatant pairs
    let newConfig = '';
    
    for (const owner of ['player', 'enemy']) {
        const field = owner === 'player' ? game.playerField : game.enemyField;
        const combatCol = game.getCombatCol(owner);
        const supportCol = game.getSupportCol(owner);
        
        for (let row = 0; row < 3; row++) {
            const combatant = field[combatCol][row];
            const support = field[supportCol][row];
            
            if (combatant && support) {
                // Include IDs to detect if different creatures are in same positions
                newConfig += `${owner}-${row}-${combatant.id}-${support.id}|`;
            }
        }
    }
    
    // If configuration hasn't changed, don't rebuild (preserves animations)
    if (newConfig === currentSupportLinkConfig) {
        return;
    }
    
    // Configuration changed - rebuild links
    currentSupportLinkConfig = newConfig;
    
    // Remove existing support links
    document.querySelectorAll('.support-link-line').forEach(el => el.remove());
    
    for (const owner of ['player', 'enemy']) {
        const field = owner === 'player' ? game.playerField : game.enemyField;
        const combatCol = game.getCombatCol(owner);
        const supportCol = game.getSupportCol(owner);
        
        for (let row = 0; row < 3; row++) {
            const combatant = field[combatCol][row];
            const support = field[supportCol][row];
            
            // Only show link if both combatant and support exist
            if (combatant && support) {
                const combatKey = `${owner}-${combatCol}-${row}`;
                const supportKey = `${owner}-${supportCol}-${row}`;
                const combatPos = tilePositions[combatKey];
                const supportPos = tilePositions[supportKey];
                
                if (!combatPos || !supportPos) continue;
                
                // Create the link line
                const link = document.createElement('div');
                link.className = 'support-link-line';
                if (owner === 'enemy') link.classList.add('enemy');
                
                // Calculate line position and dimensions
                const x1 = Math.min(combatPos.x, supportPos.x);
                const x2 = Math.max(combatPos.x, supportPos.x);
                const y = (combatPos.y + supportPos.y) / 2;
                const width = x2 - x1;
                
                link.style.cssText = `
                    position: absolute;
                    left: ${x1}px;
                    top: ${y}px;
                    width: ${width}px;
                    height: 2px;
                    transform: translateY(-50%);
                    z-index: 5;
                    pointer-events: none;
                `;
                
                // Add pulsing orbs along the line
                for (let i = 0; i < 3; i++) {
                    const orb = document.createElement('div');
                    orb.className = 'support-link-orb';
                    orb.style.animationDelay = `${i * 0.33}s`;
                    link.appendChild(orb);
                }
                
                spriteLayer.appendChild(link);
            }
        }
    }
}

// Force refresh support links (call when positions might have changed due to resize)
function forceRefreshSupportLinks() {
    currentSupportLinkConfig = '';
    renderSupportLinks();
}

// Track which cards are currently in the hand to avoid unnecessary rebuilds
let currentHandCardIds = [];
let currentHandIsKindling = false;

// Force clear any stuck hover/touch states on hand cards
function clearHandHoverStates() {
    const container = document.getElementById('hand-container');
    if (!container) return;
    
    // Clear any inspecting states
    container.querySelectorAll('.card-wrapper.inspecting').forEach(w => w.classList.remove('inspecting'));
    
    // Force browser to recalculate hover by briefly toggling pointer-events
    // This clears stuck :hover pseudo-class on touch devices
    container.classList.add('resetting-hover');
    // Force a reflow to ensure the class is applied
    void container.offsetHeight;
    // Remove after a frame to restore normal behavior (with timeout fallback)
    requestAnimationFrame(() => {
        container.classList.remove('resetting-hover');
    });
    // Safety fallback - ensure class is always removed even if RAF doesn't fire
    setTimeout(() => {
        container.classList.remove('resetting-hover');
    }, 50);
}

// Update card states WITHOUT rebuilding - prevents wiggle
function updateHandCardStates() {
    const container = document.getElementById('hand-container');
    if (!container || !game) return;
    
    const cards = ui.showingKindling ? game.playerKindling : game.playerHand;
    const isKindling = ui.showingKindling;
    
    console.log('[updateHandCardStates] Called - turn:', game.currentTurn, 'phase:', game.phase, 'isKindling:', isKindling);
    
    // NOTE: Don't clear hover states here - it was blocking card inspection during enemy turn
    // Hover state clearing is only needed during turn transitions (handled in end-turn-btn handler)
    
    // Just update classes on existing cards - DON'T touch positions
    const wrappers = container.querySelectorAll('.card-wrapper');
    wrappers.forEach(wrapper => {
        const cardId = wrapper.dataset.cardId;
        const card = cards.find(c => c.id === cardId);
        if (!card) return;
        
        const cardEl = wrapper.querySelector('.battle-card');
        if (!cardEl) return;
        
        // Recalculate playability - MUST be player's turn AND in conjure phase
        let canPlay = false;
        const isPlayerTurn = game.currentTurn === 'player';
        const isConjurePhase = game.phase === 'conjure1' || game.phase === 'conjure2';
        
        if (!isPlayerTurn || !isConjurePhase) {
            canPlay = false; // Cards are never playable during opponent's turn or non-conjure phases
        } else if (isKindling) {
            canPlay = !game.playerKindlingPlayedThisTurn;
        } else if (card.type === 'trap') {
            const validSlots = game.getValidTrapSlots('player');
            const effectiveCost = game.getModifiedCost(card, 'player');
            canPlay = validSlots.length > 0 && game.playerPyre >= effectiveCost;
        } else if (card.type === 'aura') {
            const targets = game.getValidAuraTargets('player');
            const effectiveCost = game.getModifiedCost(card, 'player');
            canPlay = targets.length > 0 && game.playerPyre >= effectiveCost;
        } else if (card.type === 'pyre') {
            canPlay = game.canPlayPyreCard('player');
        } else if (card.evolvesFrom) {
            const hasEvolutionTargets = game.getValidEvolutionTargets(card, 'player').length > 0;
            const effectiveCost = game.getModifiedCost(card, 'player');
            canPlay = hasEvolutionTargets || game.playerPyre >= effectiveCost;
        } else {
            const effectiveCost = game.getModifiedCost(card, 'player');
            canPlay = game.playerPyre >= effectiveCost;
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

function renderHand(force = false) {
    const container = document.getElementById('hand-container');
    
    // Guard against uninitialized game
    if (!game) return;
    
    // During animation, don't clear/rebuild (unless forced for card draws)
    if (isAnimating && !force) {
        console.log('[renderHand] Skipping - isAnimating is true');
        return;
    }
    
    const allCards = ui.showingKindling ? game.playerKindling : game.playerHand;
    const isKindling = ui.showingKindling;
    
    // Filter to only show revealed cards during staggered draw sequences
    const cards = allCards.filter(c => !window.isCardRevealed || window.isCardRevealed(c.id));
    
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
        phase: game.phase,
        totalCards: allCards.length,
        revealedCards: cards.length
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
    
    const totalCards = cards.length;
    cards.forEach((card, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'card-wrapper';
        wrapper.dataset.cardId = card.id;
        wrapper.dataset.cardIndex = index;
        
        const cardEl = document.createElement('div');
        const rarityClass = card.rarity || 'common';
        // NO card-entering class - this is a non-animated render
        cardEl.className = 'game-card battle-card';
        
        // Custom card background support
        const artBgStyle = card.cardBg ? `style="--art-bg: url('${card.cardBg}')"` : '';
        
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
        
        // Check playability - MUST be player's turn AND in conjure phase
        let canPlay = false;
        const isPlayerTurn = game.currentTurn === 'player';
        const isConjurePhase = game.phase === 'conjure1' || game.phase === 'conjure2';
        
        if (!isPlayerTurn || !isConjurePhase) {
            canPlay = false;
        } else if (isKindling) {
            canPlay = !game.playerKindlingPlayedThisTurn;
        } else if (card.type === 'trap') {
            const validSlots = game.getValidTrapSlots('player');
            const effectiveCost = game.getModifiedCost(card, 'player');
            canPlay = validSlots.length > 0 && game.playerPyre >= effectiveCost;
        } else if (card.type === 'aura') {
            const targets = game.getValidAuraTargets('player');
            const effectiveCost = game.getModifiedCost(card, 'player');
            canPlay = targets.length > 0 && game.playerPyre >= effectiveCost;
        } else if (card.type === 'pyre') {
            canPlay = game.canPlayPyreCard('player');
        } else if (card.evolvesFrom) {
            const hasEvolutionTargets = game.getValidEvolutionTargets(card, 'player').length > 0;
            const effectiveCost = game.getModifiedCost(card, 'player');
            canPlay = hasEvolutionTargets || game.playerPyre >= effectiveCost;
            if (hasEvolutionTargets) cardEl.classList.add('evolution-card');
        } else {
            const effectiveCost = game.getModifiedCost(card, 'player');
            canPlay = game.playerPyre >= effectiveCost;
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
            <div class="gc-art" ${artBgStyle}>${renderSprite(card.sprite, false, null, card.cardSpriteScale, card.spriteFlip)}</div>
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
        onLayoutChange();
        scaleAllAbilityText();
        detectCardNameOverflow(container);
        // Update hand centering padding
        if (typeof updateHandPadding === 'function') {
            updateHandPadding();
        }
        // Ensure card positions are updated for hover effects
        updateCardPositions();
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
    
    const cards = ui.showingKindling ? game.playerKindling : game.playerHand;
    const isKindling = ui.showingKindling;
    
    // Update tracking variables so renderHand() knows the current state
    currentHandCardIds = cards.map(c => c.id);
    currentHandIsKindling = isKindling;
    console.log('[renderHandAnimated] Updated tracking - cardIds:', currentHandCardIds.length, 'isKindling:', currentHandIsKindling);
    
    const totalCards = cards.length;
    let delayIndex = 0;
    cards.forEach((card, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'card-wrapper';
        wrapper.dataset.cardId = card.id;
        wrapper.dataset.cardIndex = index;
        
        const rarityClass = card.rarity || 'common';
        const cardEl = document.createElement('div');
        cardEl.className = 'game-card battle-card card-entering';
        cardEl.style.animationDelay = `${delayIndex * 0.05}s`;
        delayIndex++;
        
        // Custom card background support
        const artBgStyle = card.cardBg ? `style="--art-bg: url('${card.cardBg}')"` : '';
        
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
        
        // Check playability - MUST be player's turn AND in conjure phase
        let canPlay = false;
        const isPlayerTurn = game.currentTurn === 'player';
        const isConjurePhase = game.phase === 'conjure1' || game.phase === 'conjure2';
        
        if (!isPlayerTurn || !isConjurePhase) {
            canPlay = false;
        } else if (isKindling) {
            canPlay = !game.playerKindlingPlayedThisTurn;
        } else if (card.type === 'trap') {
            const validSlots = game.getValidTrapSlots('player');
            const effectiveCost = game.getModifiedCost(card, 'player');
            canPlay = validSlots.length > 0 && game.playerPyre >= effectiveCost;
        } else if (card.type === 'aura') {
            const targets = game.getValidAuraTargets('player');
            const effectiveCost = game.getModifiedCost(card, 'player');
            canPlay = targets.length > 0 && game.playerPyre >= effectiveCost;
        } else if (card.type === 'pyre') {
            canPlay = game.canPlayPyreCard('player');
        } else if (card.evolvesFrom) {
            const hasEvolutionTargets = game.getValidEvolutionTargets(card, 'player').length > 0;
            const effectiveCost = game.getModifiedCost(card, 'player');
            canPlay = hasEvolutionTargets || game.playerPyre >= effectiveCost;
            if (hasEvolutionTargets) cardEl.classList.add('evolution-card');
        } else {
            const effectiveCost = game.getModifiedCost(card, 'player');
            canPlay = game.playerPyre >= effectiveCost;
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
            <div class="gc-art" ${artBgStyle}>${renderSprite(card.sprite, false, null, card.cardSpriteScale, card.spriteFlip)}</div>
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
        onLayoutChange();
        scaleAllAbilityText();
        detectCardNameOverflow(container);
        // Update hand centering padding
        if (typeof updateHandPadding === 'function') {
            updateHandPadding();
        }
        // Ensure card positions are updated for hover effects
        updateCardPositions();
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
            // During opponent's turn, show visual feedback that card was clicked but can't be played
            if (game.currentTurn !== 'player') {
                // Add shake animation to show input was received
                wrapper.classList.add('card-shake');
                setTimeout(() => wrapper.classList.remove('card-shake'), 400);
                // Show message on first click during opponent turn
                if (!window._opponentTurnMessageShown) {
                    showMessage("Wait for your turn...", 1000);
                    window._opponentTurnMessageShown = true;
                    // Reset flag when it becomes player's turn
                    const resetFlag = () => {
                        window._opponentTurnMessageShown = false;
                        GameEvents.off('onTurnStart', resetFlag);
                    };
                    GameEvents.on('onTurnStart', (data) => {
                        if (data.owner === 'player') resetFlag();
                    });
                }
                // Also show the card inspect for details
                inspectCard(e, e.clientX, e.clientY);
                setTimeout(endInspect, 2000);
            }
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
        
        // Quick tap on stationary finger
        if (!touchMoved && touchStartPos && !scrollDetected && !dragStarted && touchDuration < 350) {
            // Always show tooltip on quick tap (for any card)
            const touch = e.changedTouches[0];
            showCardTooltip(card, { clientX: touch?.clientX || 0, clientY: touch?.clientY || 0 });
            
            if (isCurrentlyPlayable()) {
                // Playable: select the card (tooltip already shown above)
                selectCard(card);
            } else if (game.currentTurn !== 'player') {
                // During opponent's turn: just shake feedback, NO detail view
                // (detail view / inspect is only for long-press)
                wrapper.classList.add('card-shake');
                setTimeout(() => wrapper.classList.remove('card-shake'), 400);
                if (navigator.vibrate) navigator.vibrate([20, 30, 20]); // Double buzz for "no"
                // Show message on first tap during opponent turn
                if (!window._opponentTurnMessageShown) {
                    showMessage("Wait for your turn...", 1000);
                    window._opponentTurnMessageShown = true;
                    const resetFlag = () => {
                        window._opponentTurnMessageShown = false;
                        GameEvents.off('onTurnStart', resetFlag);
                    };
                    GameEvents.on('onTurnStart', (data) => {
                        if (data.owner === 'player') resetFlag();
                    });
                }
                // Auto-hide tooltip after a moment (no inspect/detail view for quick tap)
                setTimeout(() => hideTooltip(), 2000);
            }
        }
        
        touchStartPos = null; dragStarted = false; scrollDetected = false;
    };
    
    // Simple hover for tooltips (card positioning handled by scroll-based system)
    wrapper.addEventListener('mouseenter', (e) => {
        showCardTooltip(card, e);
    }, { passive: true });
    
    wrapper.addEventListener('mouseleave', () => {
        if (!wrapper.classList.contains('inspecting')) hideTooltip();
    }, { passive: true });
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
    
    // Don't hide tooltip immediately - let it stay visible briefly so user can see card info
    // It will auto-hide after a moment or when they take another action
    setTimeout(() => hideTooltip(), 1500);
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
                
                // Force clear tracking again to ensure clean state
                currentHandCardIds = [];
                currentHandIsKindling = !ui.showingKindling;
                
                renderAll(); // Render again to ensure everything is in sync
                updateButtons();
                if (typeof updateMenuButtons === 'function') updateMenuButtons();
                console.log('[SummonKindling] After final render, showingKindling:', ui.showingKindling);
                
                // Check for pending Harbinger effect (Mothman entering combat)
                if (window.pendingHarbingerEffect) {
                    processHarbingerEffect(() => {
                        isAnimating = false;
                        renderAll();
                        updateButtons();
                    });
                } else {
                    isAnimating = false;
                }
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
                renderAll();
                updateButtons();
                
                // Check for pending Harbinger effect (Mothman entering combat)
                if (window.pendingHarbingerEffect) {
                    processHarbingerEffect(() => {
                        isAnimating = false;
                        renderAll();
                        updateButtons();
                    });
                } else {
                    isAnimating = false;
                }
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
    
    // IMPORTANT: Capture the OLD sprite BEFORE any game state changes
    const oldSprite = document.querySelector(`.cryptid-sprite[data-owner="${targetOwner}"][data-col="${targetCol}"][data-row="${targetRow}"]`);
    const oldSpriteImage = oldSprite?.querySelector('.sprite-image')?.src || null;
    
    // Mark this sprite as pending evolution BEFORE game state changes
    // This prevents renderSprites from updating the image prematurely
    if (oldSprite) {
        oldSprite.dataset.evolutionPending = 'true';
    }
    
    // Animate card removal from hand
    animateCardRemoval(card.id, 'playing');
    
    // Update game state (this changes the cryptid data but NOT the DOM yet)
    game.evolveCryptid(baseCryptid, card);
    
    ui.selectedCard = null;
    ui.targetingEvolution = null;
    document.getElementById('cancel-target').classList.remove('show');
    showMessage(`${baseCryptid.name} transforms into ${card.name}!`, TIMING.messageDisplay);
    
    // Remove card from hand array after card animation
    setTimeout(() => {
        const idx = game.playerHand.findIndex(c => c.id === card.id);
        if (idx > -1) game.playerHand.splice(idx, 1);
        // DON'T renderAll here - we'll do it during the evolution animation
    }, 300);
    
    // Start evolution animation with the OLD sprite still visible
    setTimeout(() => {
        const sprite = document.querySelector(`.cryptid-sprite[data-owner="${targetOwner}"][data-col="${targetCol}"][data-row="${targetRow}"]`);
        if (sprite) {
            // Use enhanced evolution animation if available
            if (window.CombatEffects?.playEvolutionAnimation) {
                const evolvedCryptid = game.getFieldCryptid(targetOwner, targetCol, targetRow);
                window.CombatEffects.playEvolutionAnimation(
                    sprite, 
                    evolvedCryptid?.element || card.element || 'steel',
                    evolvedCryptid?.rarity || card.rarity || 'uncommon',
                    // onSpriteChange callback - called when sprite should morph
                    () => {
                        renderAll(); // This updates the sprite to new form
                    },
                    // onComplete callback
                    () => {
                        isAnimating = false; 
                        renderAll(); 
                        updateButtons();
                    }
                );
            } else {
                // Fallback to basic animation
                sprite.classList.add('evolving');
                renderAll(); // Update sprite immediately for fallback
                setTimeout(() => { 
                    isAnimating = false; 
                    renderAll(); 
                    updateButtons(); 
                }, TIMING.evolveAnim);
            }
        }
    }, 350);
}

function executeBurst(targetOwner, targetCol, targetRow) {
    if (!ui.targetingBurst || isAnimating) return;
    isAnimating = true;
    const card = ui.targetingBurst;
    const targetCryptid = game.getFieldCryptid(targetOwner, targetCol, targetRow);
    const isTileTarget = card.targetType === 'tile' || card.targetType === 'enemyTile' || card.targetType === 'allyTile';
    
    if (targetCryptid || isTileTarget) {
        // 1. Animate card removal from hand immediately
        animateCardRemoval(card.id, 'playing');
        
        // 2. Show spell name message
        showMessage(`✧ ${card.name} ✧`, TIMING.messageDisplay);
        
        // 3. Get target position for projectile
        const battlefield = document.getElementById('battlefield-area');
        const targetSprite = targetCryptid ? document.querySelector(
            `.cryptid-sprite[data-owner="${targetOwner}"][data-col="${targetCol}"][data-row="${targetRow}"]`
        ) : null;
        const targetTile = document.querySelector(
            `.tile[data-owner="${targetOwner}"][data-col="${targetCol}"][data-row="${targetRow}"]`
        );
        
        // Calculate target position for spell projectile
        let targetX = 0, targetY = 0;
        if (battlefield) {
            const battlefieldRect = battlefield.getBoundingClientRect();
            const targetElement = targetSprite || targetTile;
            if (targetElement) {
                const targetRect = targetElement.getBoundingClientRect();
                targetX = targetRect.left + targetRect.width/2 - battlefieldRect.left;
                targetY = targetRect.top + targetRect.height/2 - battlefieldRect.top;
            }
            
            // Get start position from hand area
            const handArea = document.getElementById('hand-area');
            let startX = battlefieldRect.width / 2;
            let startY = battlefieldRect.height - 20;
            if (handArea) {
                const handRect = handArea.getBoundingClientRect();
                startX = handRect.left + handRect.width/2 - battlefieldRect.left;
                startY = handRect.top - battlefieldRect.top;
            }
            
            // Play spell projectile animation if available
            if (window.CombatEffects?.playSpellProjectile && targetX && targetY) {
                const element = card.element || 'void';
                window.CombatEffects.playSpellProjectile(startX, startY, targetX, targetY, element, 'burst');
            }
        }
        
        // 4. Play visual effect on target (after projectile lands)
        setTimeout(() => {
            if (targetSprite) {
                targetSprite.classList.add('spell-target');
                setTimeout(() => targetSprite.classList.remove('spell-target'), TIMING.spellEffect);
            }
            if (targetTile) {
                targetTile.classList.add('spell-target-tile');
                setTimeout(() => targetTile.classList.remove('spell-target-tile'), TIMING.spellEffect);
            }
        }, 250);
        
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
                    // Only handle death if cryptid is still in field (not already killed by the effect itself)
                    const stillInField = game.getFieldCryptid(targetOwner, targetCol, targetRow) === targetCryptid;
                    if (effectiveHpAfter <= 0 && stillInField) handleDeathAndPromotion(targetOwner, targetCol, targetRow, targetCryptid, 'player');
                    else checkAllCreaturesForDeath(() => { isAnimating = false; renderAll(); updateButtons(); });
                } else { 
                    checkAllCreaturesForDeath(() => { isAnimating = false; renderAll(); updateButtons(); });
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
                        // Only handle death if cryptid is still in field (not already killed by the effect itself)
                        const stillInField = game.getFieldCryptid(targetOwner, targetCol, targetRow) === targetCryptid;
                        if (effectiveHpAfter <= 0 && stillInField) handleDeathAndPromotion(targetOwner, targetCol, targetRow, targetCryptid, 'player');
                        else checkAllCreaturesForDeath(() => { isAnimating = false; renderAll(); updateButtons(); });
                    } else { 
                        checkAllCreaturesForDeath(() => { isAnimating = false; renderAll(); updateButtons(); });
                    }
                }, 300);
            });
        }, TIMING.spellEffect);
    } else { isAnimating = false; }
}

function executeTrapPlacement(row) {
    const card = ui.targetingTrap;
    const effectiveCost = game.getModifiedCost(card, 'player');
    if (!card || isAnimating || game.playerPyre < effectiveCost) return;
    
    const success = game.setTrap('player', row, card);
    if (success) {
        isAnimating = true;
        
        // Mark this trap as newly spawned for animation
        window.newlySpawnedTrap = { owner: 'player', row };
        
        // Animate card removal
        animateCardRemoval(card.id, 'playing');
        
        const oldPyre = game.playerPyre;
        game.playerPyre -= effectiveCost;
        GameEvents.emit('onPyreSpent', { owner: 'player', amount: effectiveCost, oldValue: oldPyre, newValue: game.playerPyre, source: 'trap', card });
        
        ui.targetingTrap = null; ui.selectedCard = null;
        document.getElementById('cancel-target').classList.remove('show');
        showMessage(`Trap set!`, 800);
        
        // Remove from array and render after animation
        setTimeout(() => {
            const idx = game.playerHand.findIndex(c => c.id === card.id);
            if (idx > -1) game.playerHand.splice(idx, 1);
            
            // Add to discard pile
            game.playerDiscardPile.push(card);
            
            isAnimating = false;
            renderAll(); updateButtons();
            
            // Clear spawn marker after render
            setTimeout(() => { window.newlySpawnedTrap = null; }, 500);
        }, 400);
    }
}

function executeTrapPlacementDirect(card, row) {
    const effectiveCost = game.getModifiedCost(card, 'player');
    if (!card || isAnimating || game.playerPyre < effectiveCost) return;
    const success = game.setTrap('player', row, card);
    if (success) {
        isAnimating = true;
        
        // Mark this trap as newly spawned for animation
        window.newlySpawnedTrap = { owner: 'player', row };
        
        // Animate card removal (drag ghost hidden by drag end)
        animateCardRemoval(card.id, 'playing');
        
        const oldPyre = game.playerPyre;
        game.playerPyre -= effectiveCost;
        GameEvents.emit('onPyreSpent', { owner: 'player', amount: effectiveCost, oldValue: oldPyre, newValue: game.playerPyre, source: 'trap', card });
        showMessage(`Trap set!`, 800);
        
        setTimeout(() => {
            const idx = game.playerHand.findIndex(c => c.id === card.id);
            if (idx > -1) game.playerHand.splice(idx, 1);
            
            // Add to discard pile
            game.playerDiscardPile.push(card);
            
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
    
    // 3. Get positions for enhanced aura animation
    const targetSprite = document.querySelector(
        `.cryptid-sprite[data-owner="player"][data-col="${col}"][data-row="${row}"]`
    );
    const battlefield = document.getElementById('battlefield-area');
    const handArea = document.getElementById('hand-area');
    
    // Calculate start position (from hand) and target position
    let startX = 0, startY = 0, targetX = 0, targetY = 0;
    if (battlefield && handArea) {
        const battlefieldRect = battlefield.getBoundingClientRect();
        const handRect = handArea.getBoundingClientRect();
        startX = handRect.left + handRect.width/2 - battlefieldRect.left;
        startY = handRect.top - battlefieldRect.top;
        
        if (targetSprite) {
            const targetRect = targetSprite.getBoundingClientRect();
            targetX = targetRect.left + targetRect.width/2 - battlefieldRect.left;
            targetY = targetRect.top + targetRect.height/2 - battlefieldRect.top;
        }
    }
    
    // 4. Play enhanced aura animation
    if (window.CombatEffects?.playAuraEffect && targetSprite) {
        window.CombatEffects.playAuraEffect(startX, startY, targetX, targetY, targetSprite);
    } else if (targetSprite) {
        // Fallback to basic animation
        targetSprite.classList.add('aura-target');
        setTimeout(() => targetSprite.classList.remove('aura-target'), TIMING.spellEffect);
    }
    
    // 5. Remove from array, add to discard, and clear state
    setTimeout(() => {
        const idx = game.playerHand.findIndex(c => c.id === card.id);
        if (idx > -1) {
            game.playerHand.splice(idx, 1);
            game.playerDiscardPile.push(card);
        }
        ui.targetingAura = null; ui.selectedCard = null;
        document.getElementById('cancel-target').classList.remove('show');
    }, 300);
    
    // 6. Apply aura after visual delay (longer for enhanced animation)
    setTimeout(() => {
        const oldPyre = game.playerPyre;
        game.playerPyre -= card.cost;
        GameEvents.emit('onPyreSpent', { owner: 'player', amount: card.cost, oldValue: oldPyre, newValue: game.playerPyre, source: 'aura', card });
        game.applyAura(targetCryptid, card);
        
        setTimeout(() => { 
            isAnimating = false; 
            renderAll(); 
            updateButtons(); 
        }, 400);
    }, 600); // Extended delay for enhanced animation
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
    
    // 3. Get positions for enhanced aura animation
    const targetSprite = document.querySelector(
        `.cryptid-sprite[data-owner="player"][data-col="${col}"][data-row="${row}"]`
    );
    const battlefield = document.getElementById('battlefield-area');
    const handArea = document.getElementById('hand-area');
    
    // Calculate start position (from hand) and target position
    let startX = 0, startY = 0, targetX = 0, targetY = 0;
    if (battlefield && handArea) {
        const battlefieldRect = battlefield.getBoundingClientRect();
        const handRect = handArea.getBoundingClientRect();
        startX = handRect.left + handRect.width/2 - battlefieldRect.left;
        startY = handRect.top - battlefieldRect.top;
        
        if (targetSprite) {
            const targetRect = targetSprite.getBoundingClientRect();
            targetX = targetRect.left + targetRect.width/2 - battlefieldRect.left;
            targetY = targetRect.top + targetRect.height/2 - battlefieldRect.top;
        }
    }
    
    // 4. Play enhanced aura animation
    if (window.CombatEffects?.playAuraEffect && targetSprite) {
        window.CombatEffects.playAuraEffect(startX, startY, targetX, targetY, targetSprite);
    } else if (targetSprite) {
        // Fallback to basic animation
        targetSprite.classList.add('aura-target');
        setTimeout(() => targetSprite.classList.remove('aura-target'), TIMING.spellEffect);
    }
    
    // 5. Remove from array after animation and add to discard
    setTimeout(() => {
        const idx = game.playerHand.findIndex(c => c.id === card.id);
        if (idx > -1) {
            game.playerHand.splice(idx, 1);
            game.playerDiscardPile.push(card);
        }
    }, 300);
    
    // 6. Apply aura after visual delay (longer for enhanced animation)
    setTimeout(() => {
        const oldPyre = game.playerPyre;
        game.playerPyre -= card.cost;
        GameEvents.emit('onPyreSpent', { owner: 'player', amount: card.cost, oldValue: oldPyre, newValue: game.playerPyre, source: 'aura', card });
        game.applyAura(targetCryptid, card);
        
        setTimeout(() => { 
            isAnimating = false; 
            renderAll(); 
            updateButtons(); 
        }, 400);
    }, 600); // Extended delay for enhanced animation
}

// Execute Decay Rat's support ability on a selected target
function executeDecayRatAbility(targetCol, targetRow) {
    const cryptid = ui.targetingDecayRat;
    // Support both data-driven (activatedAbilities) and legacy (activateDecayDebuff) formats
    const hasAbility = cryptid?.activatedAbilities?.find(a => a.id === 'decayDebuff') || cryptid?.activateDecayDebuff;
    if (!cryptid || !hasAbility) {
        cancelDecayRatTargeting();
        return;
    }
    
    const owner = cryptid.owner;
    const targetEnemy = game.enemyField[targetCol]?.[targetRow];
    if (!targetEnemy) {
        cancelDecayRatTargeting();
        return;
    }
    
    // Store HP before debuff to check for death
    const hpBefore = targetEnemy.currentHp || targetEnemy.hp;
    
    // Show activation message
    showMessage(`🦠 ${cryptid.name} spreads decay!`, 1000);
    
    // Get sprites for animation
    const targetSprite = document.querySelector(
        `.cryptid-sprite[data-owner="enemy"][data-col="${targetCol}"][data-row="${targetRow}"]`
    );
    const ratSprite = document.querySelector(
        `.cryptid-sprite[data-owner="${owner}"][data-col="${cryptid.col}"][data-row="${cryptid.row}"]`
    );
    
    // Visual feedback on Decay Rat
    if (ratSprite) {
        ratSprite.classList.add('ability-activate');
        setTimeout(() => ratSprite.classList.remove('ability-activate'), 500);
    }
    
    // Clean up targeting state first
    cancelDecayRatTargeting();
    document.getElementById('cancel-target').classList.remove('show');
    
    // Play debuff animation, then execute ability
    if (window.CombatEffects?.playDebuffEffect && targetSprite) {
        window.CombatEffects.playDebuffEffect(targetSprite, () => {
            // Execute the actual debuff after animation (data-driven or legacy)
            if (cryptid.activatedAbilities) {
                game.activateAbility(cryptid, 'decayDebuff', { col: targetCol, row: targetRow });
            } else if (cryptid.activateDecayDebuff) {
                cryptid.activateDecayDebuff(cryptid, game, targetCol, targetRow);
            }
            
            // Check if target died
            if (targetEnemy.currentHp <= 0 && targetSprite) {
                // Play death animation
                const rarity = targetSprite.className.match(/rarity-(\w+)/)?.[1] || 'common';
                if (window.CombatEffects?.playDramaticDeath) {
                    window.CombatEffects.playDramaticDeath(targetSprite, 'enemy', rarity, () => {
                        renderAll();
                    });
                } else {
                    targetSprite.classList.add('dying-right');
                    setTimeout(() => renderAll(), 700);
                }
            } else {
                setTimeout(() => renderAll(), 200);
            }
        });
    } else {
        // Fallback: basic animation
        if (targetSprite) {
            targetSprite.classList.add('debuff-applied');
            setTimeout(() => targetSprite.classList.remove('debuff-applied'), 500);
        }
        
        // Execute (data-driven or legacy)
        if (cryptid.activatedAbilities) {
            game.activateAbility(cryptid, 'decayDebuff', { col: targetCol, row: targetRow });
        } else if (cryptid.activateDecayDebuff) {
            cryptid.activateDecayDebuff(cryptid, game, targetCol, targetRow);
        }
        
        // Check if target died
        if (targetEnemy.currentHp <= 0 && targetSprite) {
            const rarity = targetSprite.className.match(/rarity-(\w+)/)?.[1] || 'common';
            if (window.CombatEffects?.playDramaticDeath) {
                window.CombatEffects.playDramaticDeath(targetSprite, 'enemy', rarity, () => {
                    renderAll();
                });
            } else {
                targetSprite.classList.add('dying-right');
                setTimeout(() => renderAll(), 700);
            }
        } else {
            setTimeout(() => renderAll(), 400);
        }
    }
}

function executePyreCard(card) {
    if (!game.canPlayPyreCard('player') || isAnimating) return;
    isAnimating = true;
    
    // Get card element for visual effect
    const cardWrapper = document.querySelector(`.card-wrapper[data-card-id="${card.id}"]`);
    const cardElement = cardWrapper?.querySelector('.game-card');
    
    // Animate card removal
    animateCardRemoval(card.id, 'playing');
    
    const result = game.playPyreCard('player', card);
    
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
    
    // Use enhanced pyre burn animation if available
    if (window.CombatEffects?.playPyreBurn) {
        window.CombatEffects.playPyreBurn(cardElement, result?.pyreGained || 1, () => {
            isAnimating = false;
            renderAll(); 
            updateButtons();
        });
    } else {
        // Fallback to basic effect
        let effectX = window.innerWidth / 2;
        let effectY = window.innerHeight / 2;
        if (cardWrapper) {
            const rect = cardWrapper.getBoundingClientRect();
            effectX = rect.left + rect.width / 2;
            effectY = rect.top;
        }
        const pyreEffect = document.createElement('div');
        pyreEffect.className = 'pyre-burst-effect';
        pyreEffect.innerHTML = `<span class="pyre-icon">${card.sprite}</span><span class="pyre-glow">🔥</span>`;
        pyreEffect.style.left = effectX + 'px';
        pyreEffect.style.top = effectY + 'px';
        document.body.appendChild(pyreEffect);
        requestAnimationFrame(() => pyreEffect.classList.add('active'));
        
        setTimeout(() => {
            pyreEffect.remove();
            isAnimating = false;
            renderAll(); 
            updateButtons();
        }, 600);
    }
}

function executePyreCardWithAnimation(card, dropX, dropY) {
    if (!game.canPlayPyreCard('player')) return;
    isAnimating = true;
    
    // Get card element before cleanup
    const cardWrapper = document.querySelector(`.card-wrapper[data-card-id="${card.id}"]`);
    const cardElement = cardWrapper?.querySelector('.game-card');
    
    // Clean up drag state
    ui.selectedCard = null; 
    ui.draggedCard = null;
    if (ui.dragGhost) { ui.dragGhost.remove(); ui.dragGhost = null; }
    
    // Animate card out of hand
    animateCardRemoval(card.id, 'playing');
    
    let result;
    try {
        result = game.playPyreCard('player', card);
    } catch (err) {
        console.error('[executePyreCardWithAnimation] Error playing pyre card:', err);
        isAnimating = false;
        renderAll();
        updateButtons();
        return;
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
    
    // Use enhanced pyre burn animation if available - with proper callback to render hand after cards drawn
    if (window.CombatEffects?.playPyreBurn) {
        window.CombatEffects.playPyreBurn(cardElement, result?.pyreGained || 1, () => {
            isAnimating = false;
            renderAll(); 
            updateButtons();
        });
    } else {
        // Fallback to basic effect
        const pyreEffect = document.createElement('div');
        pyreEffect.className = 'pyre-burst-effect';
        pyreEffect.innerHTML = `<span class="pyre-icon">${card.sprite}</span><span class="pyre-glow">🔥</span>`;
        pyreEffect.style.left = dropX + 'px';
        pyreEffect.style.top = dropY + 'px';
        document.body.appendChild(pyreEffect);
        requestAnimationFrame(() => pyreEffect.classList.add('active'));
        setTimeout(() => pyreEffect.remove(), 800);
        
        setTimeout(() => { 
            isAnimating = false; 
            renderAll(); 
            updateButtons(); 
        }, 900);
    }
}

function handleDeathAndPromotion(targetOwner, targetCol, targetRow, deadCryptid, killerOwner, onComplete) {
    const targetSprite = document.querySelector(`.cryptid-sprite[data-owner="${targetOwner}"][data-col="${targetCol}"][data-row="${targetRow}"]`);
    const rarity = deadCryptid?.rarity || 'common';
    
    // Use dramatic death animation scaled by rarity
    if (targetSprite && window.CombatEffects?.playDramaticDeath) {
        console.log('[handleDeathAndPromotion] Calling playDramaticDeath for', deadCryptid?.name);
        // Kill cryptid slightly into the animation
        setTimeout(() => game.killCryptid(deadCryptid, killerOwner), 100);
        
        window.CombatEffects.playDramaticDeath(targetSprite, targetOwner, rarity, () => {
            // Pre-mark pending promotions in activePromotions BEFORE renderAll
            // This prevents the support from appearing at combat position before animation
            if (window.pendingPromotions?.length > 0) {
                if (!window.activePromotions) window.activePromotions = new Set();
                window.pendingPromotions.forEach(p => {
                    window.activePromotions.add(`${p.owner}-${p.row}`);
                });
            }
            renderAll();
            processPendingPromotions(() => {
                checkCascadingDeaths(() => { 
                    onComplete?.();
                    isAnimating = false; 
                    renderAll(); 
                    updateButtons(); 
                });
            });
        });
    } else {
        // Fallback to basic death
        if (targetSprite) targetSprite.classList.add(targetOwner === 'enemy' ? 'dying-right' : 'dying-left');
        setTimeout(() => game.killCryptid(deadCryptid, killerOwner), 100);
        setTimeout(() => {
            // Pre-mark pending promotions in activePromotions BEFORE renderAll
            // This prevents the support from appearing at combat position before animation
            if (window.pendingPromotions?.length > 0) {
                if (!window.activePromotions) window.activePromotions = new Set();
                window.pendingPromotions.forEach(p => {
                    window.activePromotions.add(`${p.owner}-${p.row}`);
                });
            }
            renderAll();
            processPendingPromotions(() => {
                checkCascadingDeaths(() => { 
                    onComplete?.();
                    isAnimating = false; 
                    renderAll(); 
                    updateButtons(); 
                });
            });
        }, TIMING.deathAnim);
    }
}

function checkCascadingDeaths(onComplete) {
    const deathsToProcess = [];
    const nonLethalDamageToProcess = []; // For Destroyer damage that doesn't kill
    
    for (const owner of ['player', 'enemy']) {
        const field = owner === 'player' ? game.playerField : game.enemyField;
        for (let col = 0; col < 2; col++) {
            for (let row = 0; row < 3; row++) {
                const cryptid = field[col][row];
                if (!cryptid) continue;
                
                // Check for cascading death after support loss (HP pooling ended)
                if (cryptid.checkDeathAfterSupportLoss) {
                    delete cryptid.checkDeathAfterSupportLoss;
                    if (cryptid.currentHp <= 0) {
                        deathsToProcess.push({ owner, col, row, cryptid, reason: 'supportLoss' });
                        continue;
                    }
                }
                
                // Check for pending deaths from Destroyer/Cleave that need animation
                if (cryptid._pendingDeathFromAttack && cryptid.currentHp <= 0) {
                    delete cryptid._pendingDeathFromAttack;
                    deathsToProcess.push({ owner, col, row, cryptid, reason: cryptid.killedBy });
                }
                // Check for non-lethal Destroyer damage (support survived)
                else if (cryptid._pendingDestroyerDamage && cryptid.currentHp > 0) {
                    nonLethalDamageToProcess.push({ owner, col, row, cryptid });
                }
            }
        }
    }
    
    // Process non-lethal Destroyer damage animations first
    function processNonLethalDamage(index, callback) {
        if (index >= nonLethalDamageToProcess.length) {
            callback();
            return;
        }
        
        const { owner, col, row, cryptid } = nonLethalDamageToProcess[index];
        const sprite = document.querySelector(`.cryptid-sprite[data-owner="${owner}"][data-col="${col}"][data-row="${row}"]`);
        
        playDestroyerDamageAnimation(cryptid, sprite, () => {
            processNonLethalDamage(index + 1, callback);
        });
    }
    
    // If nothing to process, complete immediately
    if (deathsToProcess.length === 0 && nonLethalDamageToProcess.length === 0) { 
        onComplete?.(); 
        return; 
    }
    
    // Play Destroyer damage animation before death animation
    function playDestroyerDamageAnimation(cryptid, sprite, callback) {
        const pendingDamage = cryptid._pendingDestroyerDamage;
        if (!pendingDamage) {
            callback();
            return;
        }
        
        delete cryptid._pendingDestroyerDamage;
        
        // Show damage message
        if (pendingDamage.message) {
            showMessage(pendingDamage.message, 800);
        }
        
        // Play damage effects on the sprite
        if (sprite && window.CombatEffects) {
            const battlefield = document.getElementById('battlefield-area');
            if (battlefield) {
                const rect = sprite.getBoundingClientRect();
                const bRect = battlefield.getBoundingClientRect();
                const impactX = rect.left + rect.width/2 - bRect.left;
                const impactY = rect.top + rect.height/2 - bRect.top;
                
                // Cap displayed damage at target's EFFECTIVE HP before damage (no overkill display)
                // For combatants with supports, effective HP includes support's HP (HP pooling)
                const damage = pendingDamage.damage;
                const effectiveHpBefore = (game.getEffectiveHp?.(cryptid) || cryptid.currentHp || 0) + damage;
                const displayDamage = Math.min(damage, Math.max(0, effectiveHpBefore));
                
                // Visual effects (use actualDamage for intensity, displayDamage for number)
                const impactIntensity = pendingDamage.actualDamage || damage;
                CombatEffects.createImpactFlash(impactX, impactY, 70);
                CombatEffects.createSparks(impactX, impactY, 12);
                CombatEffects.heavyImpact(impactIntensity);
                CombatEffects.showDamageNumber(cryptid, displayDamage, displayDamage >= 5);
                
                // Hit recoil on sprite (use new smooth effect)
                if (window.playHitEffectOnSprite) {
                    window.playHitEffectOnSprite(sprite, cryptid, { intensity: 'heavy' });
                }
            }
        }
        
        // Brief pause for damage to register visually before death
        setTimeout(callback, 400);
    }
    
    function processNextDeath(index) {
        if (index >= deathsToProcess.length) { onComplete?.(); return; }
        const { owner, col, row, cryptid, reason } = deathsToProcess[index];
        const sprite = document.querySelector(`.cryptid-sprite[data-owner="${owner}"][data-col="${col}"][data-row="${row}"]`);
        const rarity = cryptid?.rarity || 'common';
        
        // First play Destroyer damage animation if pending, then death
        playDestroyerDamageAnimation(cryptid, sprite, () => {
            // Show appropriate message based on death reason
            if (reason === 'supportLoss') {
                showMessage("Soul bond severed!", TIMING.messageDisplay);
            } else if (cryptid.killedBy === 'destroyer') {
                showMessage(`💥 ${cryptid.name} destroyed!`, TIMING.messageDisplay);
            } else if (cryptid.killedBy === 'cleave') {
                showMessage(`⚔ ${cryptid.name} cleaved!`, TIMING.messageDisplay);
            }
            
            if (sprite && window.CombatEffects?.playDramaticDeath) {
                console.log('[checkCascadingDeaths] Calling playDramaticDeath for', cryptid?.name, 'killedBy:', cryptid?.killedBy);
                game.killCryptid(cryptid);
                window.CombatEffects.playDramaticDeath(sprite, owner, rarity, () => {
                    renderAll();
                    setTimeout(() => processNextDeath(index + 1), 200);
                });
            } else {
                if (sprite) sprite.classList.add(owner === 'enemy' ? 'dying-right' : 'dying-left');
                setTimeout(() => { game.killCryptid(cryptid); renderAll(); setTimeout(() => processNextDeath(index + 1), 200); }, TIMING.deathAnim);
            }
        });
    }
    
    // First process non-lethal Destroyer damage, then deaths
    processNonLethalDamage(0, () => {
        if (deathsToProcess.length === 0) {
            onComplete?.();
        } else {
            processNextDeath(0);
        }
    });
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
        const rarity = cryptid?.rarity || 'common';
        
        if (sprite && window.CombatEffects?.playDramaticDeath) {
            console.log('[checkAllCreaturesForDeath] Calling playDramaticDeath for', cryptid?.name);
            game.killCryptid(cryptid);
            window.CombatEffects.playDramaticDeath(sprite, owner, rarity, () => {
                renderAll();
                setTimeout(() => processNextDeath(index + 1), 200);
            });
        } else {
            if (sprite) sprite.classList.add(owner === 'enemy' ? 'dying-right' : 'dying-left');
            setTimeout(() => {
                game.killCryptid(cryptid);
                renderAll();
                setTimeout(() => processNextDeath(index + 1), 200);
            }, TIMING.deathAnim);
        }
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
            
            showMessage(`Forced Summoning!`, TIMING.messageDisplay);
            renderSprites();
            setTimeout(() => {
                renderSprites();
                setTimeout(() => {
                    const attackerSprite = document.querySelector(`.cryptid-sprite[data-owner="player"][data-col="${attacker.col}"][data-row="${attacker.row}"]`);
                    // Pass performAttackOnTarget as onImpact (4th arg) so it fires at the moment of hit
                    // Pass targetRow (6th arg) so the correct enemy animates the hit reaction
                    playAttackAnimation(attackerSprite, 'player', null, () => {
                        performAttackOnTarget(attacker, targetOwner, combatCol, targetRow);
                    }, 3, targetRow);
                }, 50);
            }, TIMING.summonAnim + 100);
        } else {
            const attackerSprite = document.querySelector(`.cryptid-sprite[data-owner="player"][data-col="${attacker.col}"][data-row="${attacker.row}"]`);
            // Pass performAttackOnTarget as onImpact (4th arg) so it fires at the moment of hit
            // Pass targetRow (6th arg) so the correct enemy animates the hit reaction
            playAttackAnimation(attackerSprite, 'player', null, () => {
                performAttackOnTarget(attacker, targetOwner, targetCol, targetRow);
            }, 3, targetRow);
        }
    });
}

// Enhanced attack animation with hitstop, squash/stretch, and afterimage trails
// onImpact is called at the MOMENT of impact (for effects), onComplete after animation ends
// Now supports passing damage for intensity scaling
// targetRow parameter allows targeting a specific row (for cross-row attacks)
function playAttackAnimation(attackerSprite, owner, onComplete, onImpact, damage = 3, targetRow = null) {
    if (!attackerSprite) {
        if (onImpact) onImpact();
        if (onComplete) onComplete();
        return;
    }
    
    // Try to find target sprite for enhanced effects
    let targetSprite = null;
    const isEnemy = owner === 'enemy';
    const targetOwner = isEnemy ? 'player' : 'enemy';
    
    // Use provided targetRow, or fall back to attacker's row (for same-row attacks)
    const row = targetRow !== null ? targetRow : attackerSprite.dataset.row;
    if (row !== undefined) {
        const combatCol = isEnemy ? 1 : 0; // Enemy targets player's col 1, player targets enemy's col 0
        targetSprite = document.querySelector(`.cryptid-sprite[data-owner="${targetOwner}"][data-col="${combatCol}"][data-row="${row}"]`);
    }
    
    // Use enhanced attack if CombatEffects is available
    if (window.CombatEffects?.playEnhancedAttack) {
        window.CombatEffects.playEnhancedAttack(attackerSprite, owner, targetSprite, damage, onImpact, onComplete);
    } else {
        // Fallback to basic animation
        attackerSprite.classList.add('attack-windup');
        
        setTimeout(() => {
            attackerSprite.classList.remove('attack-windup');
            attackerSprite.classList.add('attack-lunge');
            
            setTimeout(() => {
                if (onImpact) onImpact();
                attackerSprite.classList.remove('attack-lunge');
                attackerSprite.classList.add('attack-return');
                
                setTimeout(() => {
                    attackerSprite.classList.remove('attack-return');
                    if (onComplete) onComplete();
                }, 200);
            }, 180);
        }, 150);
    }
}
window.playAttackAnimation = playAttackAnimation;

function performAttackOnTarget(attacker, targetOwner, targetCol, targetRow) {
    // Safety reset: Clear any stale death zoom state that might prevent death animations
    // Reset counter to 0 for fresh start (handles cases where cleanup never ran)
    if ((window.CombatEffects?._dramaticDeathZoomCount || 0) > 0) {
        console.log('[performAttackOnTarget] Clearing stale death zoom counter:', window.CombatEffects._dramaticDeathZoomCount);
        window.CombatEffects._dramaticDeathZoomCount = 0;
        window.CombatEffects._dramaticDeathBaseTransform = '';
        const wrapper = document.getElementById('game-screen-wrapper');
        if (wrapper) {
            wrapper.style.transition = '';
            wrapper.style.transform = '';
            wrapper.style.transformOrigin = '';
        }
    }
    
    // Capture target info BEFORE attack for death tracking
    const targetBeforeAttack = game.getFieldCryptid(targetOwner, targetCol, targetRow);
    const targetKey = targetBeforeAttack?.key || null;
    const supportCol = game.getSupportCol(targetOwner);
    const supportBeforeAttack = game.getFieldCryptid(targetOwner, supportCol, targetRow);
    
    const result = game.attack(attacker, targetOwner, targetCol, targetRow);
    
    // Track deaths
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
    
    // Handle negated attacks (e.g., Hellpup Guard, Primal Wendigo counter-kill)
    if (result.negated) {
        console.log('[Protection] Negated attack - showing shield bubble animation');
        
        // Show elegant shield bubble effect on defender
        if (!result.attackerKilled && result.target) {
            if (window.CombatEffects?.playShieldBubble) {
                CombatEffects.playShieldBubble(result.target, '#88ccff');
            }
            
            // Show "BLOCKED" floating text
            if (window.CombatEffects) {
                CombatEffects.showDamageNumber(result.target, 0, false, true);
            }
        }
        
        // Show message about blocked attack
        if (!result.attackerKilled) {
            showMessage('🛡️ Attack blocked!', 800);
        }
        
        // Only show death animation if attacker was actually killed by a counter-attack
        if (result.attackerKilled) {
            const attackerRarity = attacker?.rarity || 'common';
            if (attackerSprite && window.CombatEffects?.playDramaticDeath) {
                window.CombatEffects.playDramaticDeath(attackerSprite, attacker.owner, attackerRarity);
            } else if (attackerSprite) {
                attackerSprite.classList.add(attacker.owner === 'player' ? 'dying-left' : 'dying-right');
            }
            // Screen shake for counter-kill (dramatic death includes this, but add extra for counter-kills)
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
                // Pre-mark pending promotions in activePromotions BEFORE renderAll
                if (window.pendingPromotions?.length > 0) {
                    if (!window.activePromotions) window.activePromotions = new Set();
                    window.pendingPromotions.forEach(p => {
                        window.activePromotions.add(`${p.owner}-${p.row}`);
                    });
                }
                renderAll();
                if (result.attackerKilled) {
                    processPendingPromotions(() => {
                        checkCascadingDeaths(() => { 
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
    
    // Track if we're using dramatic death (affects timing)
    let usingDramaticDeath = false;
    const targetRarity = result.target?.rarity || 'common';
    
    // IF KILLED: Start dramatic death IMMEDIATELY at moment of impact!
    // This MUST happen before health bar updates or any other visual changes
    if (result.killed && targetSprite) {
        // FIX: If sprite has leftover dramaticDeathStarted flag from a previous attack
        // (can happen with rapid cheat mode attacks), clear it so death animation can play
        if (targetSprite.dataset.dramaticDeathStarted) {
            console.log('[performAttackOnTarget] Clearing stale dramaticDeathStarted flag from previous death');
            delete targetSprite.dataset.dramaticDeathStarted;
            targetSprite.style.opacity = '';
        }
        
        if (window.CombatEffects?.playDramaticDeath) {
            usingDramaticDeath = true;
            console.log('[performAttackOnTarget] Starting dramatic death zoom at impact moment');
            window.CombatEffects.playDramaticDeath(targetSprite, targetOwner, targetRarity);
        } else {
            targetSprite.classList.add(targetOwner === 'enemy' ? 'dying-right' : 'dying-left');
        }
    }
    
    // Update health bar AFTER death zoom starts (so zoom begins on impact, not after HP drops)
    // For kills, we skip the health bar update since the sprite is being replaced by death animation
    if (result.target && !result.killed) {
        window.updateSpriteHealthBar(targetOwner, targetCol, targetRow);
    }
    
    // Combat effects for successful hit (plays in parallel with death zoom if killed)
    if (window.CombatEffects) {
        const damage = result.damage || 0;
        // Always cap displayed damage to target's effective HP (no overdamage display)
        const displayDamage = result.effectiveHpBefore !== undefined
            ? Math.min(damage, result.effectiveHpBefore)
            : damage;
        const isCrit = displayDamage >= 5;
        
        // Screen shake only if NOT using dramatic death (it has its own effects)
        if (!usingDramaticDeath) {
            CombatEffects.heavyImpact(Math.max(damage, 1)); // Use full damage for impact intensity
        }
        
        // Impact flash and particles (use full damage for visual intensity)
        CombatEffects.createImpactFlash(impactX, impactY, 80 + damage * 10);
        CombatEffects.createSparks(impactX, impactY, 10 + damage * 2);
        CombatEffects.createImpactParticles(impactX, impactY, result.killed ? '#ff2222' : '#ff6666', 8 + damage);
        
        // Show damage number (capped to actual HP absorbed for accurate math)
        if (result.target) {
            CombatEffects.showDamageNumber(result.target, displayDamage, isCrit);
        }
    }
    
    // Handle non-kill sprite reactions
    if (targetSprite && !result.killed) {
        if (result.protectionBlocked) {
            // Protection blocked the attack - show shield animation
            console.log('[Protection] Block detected, adding animation to sprite:', targetSprite);
            targetSprite.classList.add('protection-block');
            showMessage('🛡️ Protected!', 800);
            setTimeout(() => targetSprite.classList.remove('protection-block'), TIMING.protectionAnim);
            
            // Show blocked message with combat effects
            if (window.CombatEffects && result.target) {
                CombatEffects.showDamageNumber(result.target, 0, false, true);
            }
        } 
        // NOTE: Hit effect is handled by playEnhancedAttack's internal playHitReaction
        // No need for additional hit effect here - it causes double animation!
    }
    
    ui.attackingCryptid = null;
    document.getElementById('cancel-target').classList.remove('show');
    
    // Calculate wait time - dramatic deaths take longer based on rarity
    const getDramaticDeathTime = (rarity) => {
        const config = window.CombatEffects?.deathDramaConfig?.[rarity] || {};
        const zoomInDuration = config.zoomInDuration || 200;
        const holdDuration = config.holdDuration || 100;
        const deathAnimSpeed = config.deathAnimSpeed || 1.0;
        const actualDeathDuration = TIMING.deathAnim / deathAnimSpeed;
        const zoomOutDuration = config.zoomOutDuration || 350;
        // Total: zoomIn + hold + death + zoomOut + buffer
        return zoomInDuration + holdDuration + actualDeathDuration + zoomOutDuration + 100;
    };
    
    const waitTime = result.killed 
        ? (usingDramaticDeath ? getDramaticDeathTime(targetRarity) : TIMING.deathAnim + 100)
        : (result.protectionBlocked ? TIMING.protectionAnim : TIMING.postAttackDelay);
    
    // Wait for ability animations first, then proceed
    waitForAbilityAnimations(() => {
        setTimeout(() => {
            // Pre-mark pending promotions in activePromotions BEFORE renderAll
            if (window.pendingPromotions?.length > 0) {
                if (!window.activePromotions) window.activePromotions = new Set();
                window.pendingPromotions.forEach(p => {
                    window.activePromotions.add(`${p.owner}-${p.row}`);
                });
            }
            renderAll();
            processPendingPromotions(() => {
                checkCascadingDeaths(() => { 
                    // Process Kuchisake explosion AFTER kill completes (triggered by killing burning enemy)
                    processKuchisakeExplosion(result.kuchisakeExplosionInfo, () => {
                        // Process Moleman splash damage AFTER explosion completes (sequenced)
                        processMolemanSplash(result.molemanSplashInfo, () => {
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
                });
            });
        }, waitTime);
    });
}

// Process Kuchisake-Onna explosion damage sequentially to adjacent enemies
// Triggered when Kuchisake kills a burning enemy - victim explodes dealing half base HP
// Event order: Explosions → Deferred Promotion (if support survived) → Destroyer
function processKuchisakeExplosion(explosionInfo, onComplete) {
    if (!explosionInfo || !explosionInfo.targets || explosionInfo.targets.length === 0) {
        // No explosion targets - still need to handle deferred promotion and Destroyer
        processDeferredPromotionAndDestroyer(explosionInfo, onComplete);
        return;
    }
    
    // Defer trap processing until explosion chain is complete
    // This prevents Blood Covenant from killing Kuchisake mid-explosion
    window.deferTrapProcessing = true;
    
    const victimName = explosionInfo.victim?.name || 'enemy';
    
    let currentIndex = 0;
    
    // Called after ALL explosion targets processed
    // Order: Deferred Promotion (if support survived) → Destroyer
    function finishExplosions() {
        processDeferredPromotionAndDestroyer(explosionInfo, onComplete);
    }
    
    function processNextExplosion() {
        if (currentIndex >= explosionInfo.targets.length) {
            finishExplosions();
            return;
        }
        
        const result = game.applyKuchisakeExplosion(explosionInfo, currentIndex);
        currentIndex++;
        
        if (!result || result.skipped) {
            // Target no longer valid, move to next
            setTimeout(processNextExplosion, 100);
            return;
        }
        
        const { target, damage, killed, row, col, targetOwner } = result;
        const sprite = document.querySelector(`.cryptid-sprite[data-owner="${targetOwner}"][data-col="${col}"][data-row="${row}"]`);
        
        // Calculate impact position for visual effects
        const battlefield = document.getElementById('battlefield-area');
        let impactX = 0, impactY = 0;
        if (sprite && battlefield) {
            const targetRect = sprite.getBoundingClientRect();
            const battlefieldRect = battlefield.getBoundingClientRect();
            impactX = targetRect.left + targetRect.width/2 - battlefieldRect.left;
            impactY = targetRect.top + targetRect.height/2 - battlefieldRect.top;
        }
        
        // Show explosion message
        showMessage(`💥 ${victimName} explodes: ${damage} to ${target.name}!`, TIMING.messageDisplay);
        
        // Play full combat effects (damage number, particles, shake)
        if (window.CombatEffects) {
            // Cap displayed damage at target's EFFECTIVE HP before damage (no overkill display)
            // For combatants with supports, effective HP includes support's HP (HP pooling)
            const effectiveHpBefore = (game.getEffectiveHp?.(target) || target.currentHp || 0) + damage;
            const displayDamage = Math.min(damage, Math.max(0, effectiveHpBefore));
            const isCrit = displayDamage >= 5;
            
            // Medium screen shake for explosion
            CombatEffects.heavyImpact(Math.max(damage, 1) * 0.7);
            
            // Explosion-style effects (more intense, fiery colors)
            CombatEffects.createImpactFlash(impactX, impactY, 80 + damage * 10);
            CombatEffects.createSparks(impactX, impactY, 10 + damage * 2);
            CombatEffects.createImpactParticles(impactX, impactY, killed ? '#ff2222' : '#ff6622', 10 + damage);
            
            // Show damage number popup (capped to HP absorbed)
            CombatEffects.showDamageNumber(target, displayDamage, isCrit);
        }
        
        // Hit recoil animation on sprite (use new smooth effect)
        if (sprite && !killed && window.playHitEffectOnSprite) {
            window.playHitEffectOnSprite(sprite, target, { intensity: 'normal' });
        }
        
        // Update health bar
        window.updateSpriteHealthBar?.(targetOwner, col, row);
        
        if (killed) {
            // Play death animation, then continue
            const rarity = target.rarity || 'common';
            
            setTimeout(() => {
                if (sprite && window.CombatEffects?.playDramaticDeath) {
                    game.killCryptid(target, explosionInfo.attacker.owner);
                    window.CombatEffects.playDramaticDeath(sprite, targetOwner, rarity, () => {
                        renderAll();
                        // Check for any cascading deaths from this kill
                        checkCascadingDeaths(() => {
                            setTimeout(processNextExplosion, 300);
                        });
                    });
                } else {
                    if (sprite) sprite.classList.add(targetOwner === 'enemy' ? 'dying-right' : 'dying-left');
                    setTimeout(() => {
                        game.killCryptid(target, explosionInfo.attacker.owner);
                        renderAll();
                        checkCascadingDeaths(() => {
                            setTimeout(processNextExplosion, 300);
                        });
                    }, TIMING.deathAnim);
                }
            }, 200); // Brief pause before death
        } else {
            // No death, just move to next after brief delay
            setTimeout(processNextExplosion, 400);
        }
    }
    
    // Small delay before starting explosion sequence for visual clarity
    setTimeout(processNextExplosion, 300);
}

// Process deferred promotion and then Destroyer after Kuchisake explosion
// Order: Promotion (if support survived) → Destroyer (if support still alive)
function processDeferredPromotionAndDestroyer(explosionInfo, onComplete) {
    // Helper to finalize explosion chain and process deferred traps
    function finalizeExplosionChain(callback) {
        window.deferTrapProcessing = false;
        if (game?.startTrapProcessing) {
            game.startTrapProcessing();
        }
        callback?.();
    }
    
    if (!explosionInfo) {
        finalizeExplosionChain(onComplete);
        return;
    }
    
    const support = explosionInfo.pendingDeferredPromotion;
    const destroyerInfo = explosionInfo.pendingDestroyerInfo;
    
    // Step 1: Check if support survived explosion and trigger promotion
    if (support && !support._alreadyKilled && support.currentHp > 0) {
        // Support survived - trigger the deferred promotion
        const promoted = game.triggerDeferredPromotion(support);
        
        if (promoted) {
            // Animate the promotion, then process Destroyer
            setTimeout(() => {
                processPendingPromotions(() => {
                    // After promotion animation, apply Destroyer damage
                    setTimeout(() => {
                        processDeferredDestroyer(destroyerInfo, () => finalizeExplosionChain(onComplete));
                    }, 200);
                });
            }, 300);
            return;
        }
    } else if (support) {
        // Support died from explosion - Destroyer fizzles
        // Show visual effect of Destroyer energy dissipating
        if (destroyerInfo && destroyerInfo.overkillDamage > 0) {
            showMessage(`💨 Destroyer energy dissipates - no target!`, TIMING.messageDisplay);
            setTimeout(() => finalizeExplosionChain(onComplete), 400);
            return;
        }
    }
    
    // No deferred promotion needed, but might still have Destroyer (edge cases)
    if (destroyerInfo) {
        setTimeout(() => {
            processDeferredDestroyer(destroyerInfo, () => finalizeExplosionChain(onComplete));
        }, 200);
    } else {
        finalizeExplosionChain(onComplete);
    }
}

// Process deferred Destroyer damage (called after promotion completes)
function processDeferredDestroyer(destroyerInfo, onComplete) {
    if (!destroyerInfo) {
        onComplete?.();
        return;
    }
    
    const result = game.applyDeferredDestroyer(destroyerInfo);
    
    if (!result || result.skipped) {
        onComplete?.();
        return;
    }
    
    const { target, damage, killed, row, col, targetOwner } = result;
    const sprite = document.querySelector(`.cryptid-sprite[data-owner="${targetOwner}"][data-col="${col}"][data-row="${row}"]`);
    
    // Calculate impact position
    const battlefield = document.getElementById('battlefield-area');
    let impactX = 0, impactY = 0;
    if (sprite && battlefield) {
        const targetRect = sprite.getBoundingClientRect();
        const battlefieldRect = battlefield.getBoundingClientRect();
        impactX = targetRect.left + targetRect.width/2 - battlefieldRect.left;
        impactY = targetRect.top + targetRect.height/2 - battlefieldRect.top;
    }
    
    // Cap displayed damage at target's EFFECTIVE HP before damage (no overkill display)
    // For combatants with supports, effective HP includes support's HP (HP pooling)
    const effectiveHpBefore = (game.getEffectiveHp?.(target) || target.currentHp || 0) + damage;
    const displayDamage = Math.min(damage, Math.max(0, effectiveHpBefore));
    
    // Show Destroyer message (use actual damage dealt, not overkill)
    showMessage(`💥 Destroyer: ${displayDamage} damage pierces to ${target.name}!`, TIMING.messageDisplay);
    
    // Play Destroyer effects
    if (window.CombatEffects) {
        const isCrit = displayDamage >= 5;
        
        CombatEffects.heavyImpact(Math.max(damage, 1));
        CombatEffects.createImpactFlash(impactX, impactY, 100 + damage * 12);
        CombatEffects.createSparks(impactX, impactY, 12 + damage * 2);
        CombatEffects.createImpactParticles(impactX, impactY, killed ? '#ff0000' : '#ff4444', 12 + damage);
        CombatEffects.showDamageNumber(target, displayDamage, isCrit);
    }
    
    // Hit recoil (use new smooth effect)
    if (sprite && !killed && window.playHitEffectOnSprite) {
        window.playHitEffectOnSprite(sprite, target, { intensity: 'normal' });
    }
    
    // Update health bar
    window.updateSpriteHealthBar?.(targetOwner, col, row);
    
    if (killed) {
        const rarity = target.rarity || 'common';
        
        setTimeout(() => {
            if (sprite && window.CombatEffects?.playDramaticDeath) {
                game.killCryptid(target, destroyerInfo.attacker.owner);
                window.CombatEffects.playDramaticDeath(sprite, targetOwner, rarity, () => {
                    renderAll();
                    checkCascadingDeaths(() => {
                        onComplete?.();
                    });
                });
            } else {
                if (sprite) sprite.classList.add(targetOwner === 'enemy' ? 'dying-right' : 'dying-left');
                setTimeout(() => {
                    game.killCryptid(target, destroyerInfo.attacker.owner);
                    renderAll();
                    checkCascadingDeaths(() => {
                        onComplete?.();
                    });
                }, TIMING.deathAnim);
            }
        }, 200);
    } else {
        setTimeout(onComplete, 400);
    }
}

// ==================== UNIVERSAL MULTI-TARGET DAMAGE SYSTEM ====================
// Single source of truth for all multi-target damage processing
// Ensures consistent ordering: damage (simultaneous) → deaths (sequential) → promotions (sequential)
//
// Options:
//   source: Cryptid causing the damage (for killedBySource tracking)
//   sourceOwner: Owner of the source ('player' or 'enemy')
//   targets: Array of { cryptid, damage, col, row, owner }
//   message: Message to show at start (optional)
//   visualTheme: 'generic' | 'moth' | 'explosion' | 'earth' | 'fire' (optional, default: 'generic')
//   particleColor: Custom particle color (optional)
//   killedBy: What to mark deaths as (e.g., 'harbinger', 'explosion', 'splash')
//   damageEvent: Event name to emit for each damage (optional)
//   onComplete: Callback when all processing is done

function processMultiTargetDamage(options) {
    const {
        source,
        sourceOwner,
        targets = [],
        message,
        visualTheme = 'generic',
        particleColor,
        killedBy = 'ability',
        damageEvent,
        onComplete
    } = options;
    
    // Safety reset: Clear any stale death zoom state before processing
    // Reset counter to 0 for fresh start (handles cases where cleanup never ran)
    if ((window.CombatEffects?._dramaticDeathZoomCount || 0) > 0) {
        console.log('[processMultiTargetDamage] Clearing stale death zoom counter:', window.CombatEffects._dramaticDeathZoomCount);
        window.CombatEffects._dramaticDeathZoomCount = 0;
        window.CombatEffects._dramaticDeathBaseTransform = '';
        const wrapper = document.getElementById('game-screen-wrapper');
        if (wrapper) {
            wrapper.style.transition = '';
            wrapper.style.transform = '';
            wrapper.style.transformOrigin = '';
        }
    }
    
    // CRITICAL: Capture tile positions NOW, BEFORE any damage/death animations start
    // This ensures we have valid positions even if calculateTilePositions is blocked later
    calculateTilePositions();
    const capturedPositions = { ...window.tilePositions };
    console.log('[processMultiTargetDamage] Captured tile positions:', Object.keys(capturedPositions).length, 'tiles');
    
    // Helper to finalize chain and process deferred traps
    function finalizeChain(callback) {
        window.deferTrapProcessing = false;
        if (game?.startTrapProcessing) {
            game.startTrapProcessing();
        }
        callback?.();
    }
    
    if (!targets || targets.length === 0) {
        finalizeChain(onComplete);
        return;
    }
    
    console.log(`[MultiTargetDamage] Processing ${targets.length} targets, theme: ${visualTheme}, killedBy: ${killedBy}`);
    
    // Defer trap processing until the entire damage chain is complete
    window.deferTrapProcessing = true;
    
    // Sort targets in correct order: top to bottom, combat then support
    // Order: top combatant (row 0), top support (row 0), middle combatant (row 1), etc.
    const sortedTargets = [...targets].sort((a, b) => {
        // First sort by row (ascending: 0, 1, 2)
        if (a.row !== b.row) return a.row - b.row;
        // Then by column type: combatant before support
        // Combat column depends on owner
        const aCombatCol = game.getCombatCol(a.owner);
        const bCombatCol = game.getCombatCol(b.owner);
        const aIsCombatant = a.col === aCombatCol;
        const bIsCombatant = b.col === bCombatCol;
        if (aIsCombatant && !bIsCombatant) return -1;
        if (!aIsCombatant && bIsCombatant) return 1;
        return 0;
    });
    
    // Show initial message if provided
    if (message) {
        showMessage(message, TIMING.messageDisplay);
    }
    
    // Get visual effect settings based on theme
    const themeSettings = getMultiDamageTheme(visualTheme, particleColor);
    
    // PHASE 1: Apply damage to all targets simultaneously with visual effects
    const deathsToProcess = [];
    
    sortedTargets.forEach(targetInfo => {
        const { cryptid, damage, col, row, owner: targetOwner } = targetInfo;
        
        // Skip if already dead
        if (cryptid._alreadyKilled) return;
        
        // Apply damage
        cryptid.currentHp = (cryptid.currentHp || cryptid.hp) - damage;
        
        // Find sprite for visual effects
        const sprite = document.querySelector(`.cryptid-sprite[data-owner="${targetOwner}"][data-col="${col}"][data-row="${row}"]`);
        
        // Calculate impact position
        const battlefield = document.getElementById('battlefield-area');
        let impactX = 0, impactY = 0;
        if (sprite && battlefield) {
            const targetRect = sprite.getBoundingClientRect();
            const battlefieldRect = battlefield.getBoundingClientRect();
            impactX = targetRect.left + targetRect.width/2 - battlefieldRect.left;
            impactY = targetRect.top + targetRect.height/2 - battlefieldRect.top;
        }
        
        // Show damage visual effects
        if (window.CombatEffects) {
            // Cap displayed damage at target's EFFECTIVE HP before damage (no overkill display)
            // For combatants with supports, effective HP includes support's HP (HP pooling)
            // Since damage was already applied, reconstruct effective HP before: getEffectiveHp + damage
            const effectiveHpBefore = (game.getEffectiveHp?.(cryptid) || cryptid.currentHp || 0) + damage;
            const displayDamage = Math.min(damage, Math.max(0, effectiveHpBefore));
            const isCrit = displayDamage >= 5;
            
            CombatEffects.createImpactFlash(impactX, impactY, themeSettings.flashSize + damage * themeSettings.flashScale);
            CombatEffects.createSparks(impactX, impactY, themeSettings.sparks + damage);
            CombatEffects.createImpactParticles(impactX, impactY, themeSettings.color, themeSettings.particles + damage);
            CombatEffects.showDamageNumber(cryptid, displayDamage, isCrit);
        }
        
        // Hit recoil animation (use new smooth effect)
        if (sprite && window.playHitEffectOnSprite) {
            window.playHitEffectOnSprite(sprite, cryptid, { intensity: 'normal' });
        }
        
        // Update health bar
        window.updateSpriteHealthBar?.(targetOwner, col, row);
        
        // Track if this cryptid died
        if ((cryptid.currentHp || 0) <= 0) {
            const combatCol = game.getCombatCol(targetOwner);
            // Store captured position for death animation
            const posKey = `${targetOwner}-${col}-${row}`;
            deathsToProcess.push({ 
                cryptid, 
                col, 
                row, 
                owner: targetOwner,
                isCombatant: col === combatCol,
                rarity: cryptid.rarity || 'common',
                capturedPosition: capturedPositions[posKey] // Pre-captured position for death focus
            });
        }
        
        // Emit damage event if specified
        if (damageEvent) {
            GameEvents.emit(damageEvent, { source, target: cryptid, damage, owner: targetOwner });
        }
    });
    
    // Screen shake based on number of targets hit
    if (window.CombatEffects && sortedTargets.length > 0) {
        CombatEffects.heavyImpact(Math.min(sortedTargets.length * themeSettings.shakeMultiplier, 3));
    }
    
    // PHASE 2: Process deaths one at a time (after damage numbers show)
    setTimeout(() => {
        processMultiTargetDeaths(deathsToProcess, source, sourceOwner, killedBy, () => {
            // PHASE 3: Process promotions
            processMultiTargetPromotions(deathsToProcess, () => {
                finalizeChain(onComplete);
            });
        });
    }, 500); // Wait for damage numbers to display
}

// Get visual theme settings for multi-target damage
function getMultiDamageTheme(theme, customColor) {
    const themes = {
        generic: { color: '#ffaa44', flashSize: 50, flashScale: 8, sparks: 6, particles: 8, shakeMultiplier: 0.5 },
        moth: { color: '#8844aa', flashSize: 50, flashScale: 8, sparks: 6, particles: 8, shakeMultiplier: 0.5 },
        explosion: { color: '#ff6622', flashSize: 80, flashScale: 10, sparks: 10, particles: 10, shakeMultiplier: 0.7 },
        earth: { color: '#886644', flashSize: 60, flashScale: 8, sparks: 8, particles: 10, shakeMultiplier: 0.6 },
        fire: { color: '#ff4422', flashSize: 70, flashScale: 10, sparks: 8, particles: 10, shakeMultiplier: 0.6 },
        ice: { color: '#44aaff', flashSize: 50, flashScale: 8, sparks: 6, particles: 8, shakeMultiplier: 0.4 },
        lightning: { color: '#ffff44', flashSize: 90, flashScale: 12, sparks: 12, particles: 6, shakeMultiplier: 0.8 },
        poison: { color: '#44ff44', flashSize: 40, flashScale: 6, sparks: 4, particles: 10, shakeMultiplier: 0.3 }
    };
    
    const settings = themes[theme] || themes.generic;
    if (customColor) settings.color = customColor;
    return settings;
}

// Process deaths sequentially in correct order
function processMultiTargetDeaths(deathsToProcess, source, sourceOwner, killedBy, onComplete) {
    if (!deathsToProcess || deathsToProcess.length === 0) {
        onComplete?.();
        return;
    }
    
    // Deaths are already sorted from the main function
    let currentIndex = 0;
    
    function processNextDeath() {
        if (currentIndex >= deathsToProcess.length) {
            // All deaths processed
            setTimeout(onComplete, 300);
            return;
        }
        
        const death = deathsToProcess[currentIndex];
        currentIndex++;
        
        // Check if still needs death (might have been killed by cascading effect)
        if (death.cryptid._alreadyKilled || (death.cryptid.currentHp || 0) > 0) {
            setTimeout(processNextDeath, 100);
            return;
        }
        
        const sprite = document.querySelector(`.cryptid-sprite[data-owner="${death.owner}"][data-col="${death.col}"][data-row="${death.row}"]`);
        
        // Use captured position (pre-computed before any animations) to ensure correct death focus
        // This is critical because calculateTilePositions may be blocked during death zoom
        const capturedPos = death.capturedPosition;
        if (sprite && capturedPos) {
            // Always set position from captured data - this is the RELIABLE source
            sprite.style.left = capturedPos.x + 'px';
            sprite.style.top = capturedPos.y + 'px';
            console.log('[MultiTargetDeath] Using captured position for', death.cryptid.name, capturedPos);
        } else if (sprite && window.tilePositions) {
            // Fallback to current tilePositions if no captured position
            const posKey = `${death.owner}-${death.col}-${death.row}`;
            const pos = window.tilePositions[posKey];
            if (pos && (!sprite.style.left || sprite.style.left === '0px' || !sprite.style.top || sprite.style.top === '0px')) {
                console.log('[MultiTargetDeath] Fallback: fixing sprite position for', death.cryptid.name, 'at', posKey);
                sprite.style.left = pos.x + 'px';
                sprite.style.top = pos.y + 'px';
            }
        }
        
        showMessage(`💀 ${death.cryptid.name} falls!`, TIMING.messageDisplay);
        
        // Clear any previous death flag so animation plays
        if (sprite?.dataset.dramaticDeathStarted) {
            delete sprite.dataset.dramaticDeathStarted;
        }
        
        // Mark as killed by the specified source
        death.cryptid.killedBy = killedBy;
        death.cryptid.killedBySource = source;
        
        if (sprite && window.CombatEffects?.playDramaticDeath) {
            game.killCryptid(death.cryptid, sourceOwner, { skipPromotion: true });
            window.CombatEffects.playDramaticDeath(sprite, death.owner, death.rarity, () => {
                renderAll();
                setTimeout(processNextDeath, 200);
            });
        } else {
            if (sprite) sprite.classList.add(death.owner === 'enemy' ? 'dying-right' : 'dying-left');
            setTimeout(() => {
                game.killCryptid(death.cryptid, sourceOwner, { skipPromotion: true });
                renderAll();
                setTimeout(processNextDeath, 200);
            }, TIMING.deathAnim);
        }
    }
    
    processNextDeath();
}

// Process promotions sequentially after multi-target deaths
function processMultiTargetPromotions(deathsToProcess, onComplete) {
    if (!deathsToProcess || deathsToProcess.length === 0) {
        renderAll();
        onComplete?.();
        return;
    }
    
    // Find all unique owner/row combinations that might need promotions
    // Only combatant deaths can trigger promotions
    const promotionCandidates = [];
    const seen = new Set();
    
    deathsToProcess.forEach(death => {
        if (death.isCombatant) {
            const key = `${death.owner}-${death.row}`;
            if (!seen.has(key)) {
                seen.add(key);
                promotionCandidates.push({ owner: death.owner, row: death.row });
            }
        }
    });
    
    // Sort by row (top to bottom)
    promotionCandidates.sort((a, b) => a.row - b.row);
    
    if (promotionCandidates.length === 0) {
        renderAll();
        onComplete?.();
        return;
    }
    
    let currentIndex = 0;
    
    function processNextPromotion() {
        if (currentIndex >= promotionCandidates.length) {
            onComplete?.();
            return;
        }
        
        const { owner, row } = promotionCandidates[currentIndex];
        currentIndex++;
        
        const combatCol = game.getCombatCol(owner);
        const supportCol = game.getSupportCol(owner);
        const field = owner === 'player' ? game.playerField : game.enemyField;
        
        const combatant = field[combatCol]?.[row];
        const support = field[supportCol]?.[row];
        
        // Check if promotion is needed (combat empty, support exists)
        if (combatant || !support || support._alreadyKilled) {
            setTimeout(processNextPromotion, 100);
            return;
        }
        
        // Trigger the promotion
        game.promoteSupport(owner, row);
        
        // Manually queue the promotion animation since promoteSupport doesn't do it
        if (!window.pendingPromotions) window.pendingPromotions = [];
        window.pendingPromotions.push({ owner, row });
        
        // Animate the promotion (skip Harbinger check to prevent infinite loop)
        processPendingPromotions(() => {
            setTimeout(processNextPromotion, 200);
        }, true); // skipHarbingerCheck = true
    }
    
    // Start processing promotions
    setTimeout(processNextPromotion, 300);
}

// Make universal function available globally
window.processMultiTargetDamage = processMultiTargetDamage;

// ==================== END UNIVERSAL MULTI-TARGET DAMAGE SYSTEM ====================

// Process Mothman's Harbinger effect using universal multi-target damage system
function processHarbingerEffect(onComplete) {
    const harbinger = window.pendingHarbingerEffect;
    if (!harbinger || !harbinger.targets || harbinger.targets.length === 0) {
        window.pendingHarbingerEffect = null;
        onComplete?.();
        return;
    }
    
    const { mothman, mothmanOwner, targets } = harbinger;
    window.pendingHarbingerEffect = null; // Clear pending effect
    
    // Use universal multi-target damage system
    processMultiTargetDamage({
        source: mothman,
        sourceOwner: mothmanOwner,
        targets: targets,
        message: `🦋 Harbinger: Mothman deals damage based on ailment stacks!`,
        visualTheme: 'moth',
        killedBy: 'harbinger',
        damageEvent: 'onHarbingerDamage',
        onComplete: onComplete
    });
}

// Global function to check and process pending Harbinger effect
window.processHarbingerEffect = processHarbingerEffect;

// Process Moleman splash damage using universal multi-target damage system
// Splash hits targets above and below the primary target simultaneously
function processMolemanSplash(splashInfo, onComplete) {
    if (!splashInfo || !splashInfo.targets || splashInfo.targets.length === 0) {
        onComplete?.();
        return;
    }
    
    const { attacker, molemanSupport, splashDamage, targetOwner } = splashInfo;
    
    // Build targets array for universal system
    const targets = splashInfo.targets.map(targetEntry => ({
        cryptid: targetEntry.cryptid,
        damage: splashDamage,
        col: targetEntry.col,
        row: targetEntry.row,
        owner: targetOwner
    })).filter(t => t.cryptid && !t.cryptid._alreadyKilled);
    
    if (targets.length === 0) {
        onComplete?.();
        return;
    }
    
    // Use universal multi-target damage system
    processMultiTargetDamage({
        source: attacker,
        sourceOwner: attacker.owner,
        targets: targets,
        message: `🦡 Moleman splash: ${splashDamage} damage!`,
        visualTheme: 'earth',
        killedBy: 'molemanSplash',
        damageEvent: 'onMolemanSplash',
        onComplete: onComplete
    });
}

function animateSupportPromotion(owner, row) {
    const supportCol = game.getSupportCol(owner);
    const combatCol = game.getCombatCol(owner);
    const supportKey = `${owner}-${supportCol}-${row}`;
    const combatKey = `${owner}-${combatCol}-${row}`;
    
    // Recalculate positions to ensure they're fresh
    calculateTilePositions();
    const supportPos = tilePositions[supportKey];
    const combatPos = tilePositions[combatKey];
    
    if (!supportPos || !combatPos) { renderSprites(); return; }
    const distance = Math.abs(combatPos.x - supportPos.x);
    
    // Check if there's actually a cryptid to promote (might have already been rendered)
    const cryptid = game.getFieldCryptid(owner, combatCol, row);
    if (!cryptid) { renderSprites(); return; }
    
    // Mark as promotion in progress to prevent render glitches
    const promotionKey = `${owner}-${row}`;
    if (!window.activePromotions) window.activePromotions = new Set();
    window.activePromotions.add(promotionKey);
    
    // Render to create the sprite at combat position, then move it for animation
    renderSprites();
    
    const sprite = document.querySelector(`.cryptid-sprite[data-owner="${owner}"][data-col="${combatCol}"][data-row="${row}"]`);
    if (sprite) {
        // Move sprite to starting position (support slot) for animation
        // Keep it hidden (opacity:0) - playPromotionAnimation will reveal it
        sprite.style.left = supportPos.x + 'px';
        sprite.style.top = supportPos.y + 'px';
        sprite.style.transition = 'none'; // Disable transitions for instant position set
        
        // Force reflow to apply position before animation
        sprite.offsetHeight;
        
        // Use enhanced promotion animation if available
        if (window.CombatEffects?.playPromotionAnimation) {
            window.CombatEffects.playPromotionAnimation(sprite, owner, distance, () => {
                sprite.style.left = combatPos.x + 'px';
                window.activePromotions?.delete(promotionKey);
                
                // Check for Destroyer residue and trigger strike
                if (window.CombatEffects?.strikeDestroyerResidue) {
                    window.CombatEffects.strikeDestroyerResidue(owner, row, () => {
                        renderSprites();
                    });
                } else {
                    renderSprites();
                }
            });
        } else {
            // Fallback to basic animation
            sprite.style.transition = ''; // Re-enable transitions
            sprite.style.setProperty('--promote-distance', `${distance}px`);
            sprite.classList.add(owner === 'player' ? 'promoting-right' : 'promoting-left');
            setTimeout(() => { 
                sprite.classList.remove('promoting-right', 'promoting-left'); 
                sprite.style.left = combatPos.x + 'px'; 
                window.activePromotions?.delete(promotionKey);
                
                // Check for Destroyer residue and trigger strike
                if (window.CombatEffects?.strikeDestroyerResidue) {
                    window.CombatEffects.strikeDestroyerResidue(owner, row, () => {
                        renderSprites();
                    });
                } else {
                    renderSprites();
                }
            }, TIMING.promoteAnim);
        }
    } else {
        window.activePromotions?.delete(promotionKey);
        // Also clear any residue if there's no sprite (edge case)
        if (window.CombatEffects?.clearDestroyerResidue) {
            window.CombatEffects.clearDestroyerResidue(owner, row);
        }
    }
}

// Process any pending promotions that happened during ability effects
function processPendingPromotions(onComplete, skipHarbingerCheck = false) {
    if (!window.pendingPromotions || window.pendingPromotions.length === 0) {
        // Check for Harbinger effect even when no promotions (Mothman may have triggered)
        // Skip this check if called from within Harbinger processing to prevent infinite loop
        if (!skipHarbingerCheck && window.pendingHarbingerEffect) {
            processHarbingerEffect(() => {
                if (onComplete) onComplete();
            });
        } else {
            if (onComplete) onComplete();
        }
        return;
    }
    
    const promotions = [...window.pendingPromotions];
    window.pendingPromotions = [];
    
    let index = 0;
    function processNext() {
        if (index >= promotions.length) {
            // After all promotions, check for Harbinger effect (Mothman may have promoted)
            // Skip this check if called from within Harbinger processing to prevent infinite loop
            if (!skipHarbingerCheck && window.pendingHarbingerEffect) {
                processHarbingerEffect(() => {
                    if (onComplete) onComplete();
                });
            } else {
                if (onComplete) onComplete();
            }
            return;
        }
        
        const { owner, row } = promotions[index];
        animateSupportPromotion(owner, row);
        index++;
        
        setTimeout(processNext, TIMING.promoteAnim + 50);
    }
    
    // Small delay to let any death animations get started first
    // This prevents the promotion animation from visually conflicting with deaths
    setTimeout(processNext, 150);
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
    cancelDecayRatTargeting();
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
        
        // Play machine gun ember effect for multiple pyre gains
        if (deaths > 0 && window.CombatEffects?.playPyreBurn) {
            window.CombatEffects.playPyreBurn(null, deaths);
        }
    }, 300);
    setTimeout(() => { 
        overlay.classList.remove('active'); 
        text.classList.remove('active'); 
        container.classList.remove('shaking'); 
        isAnimating = false; 
        renderAll(); 
        updateButtons(); 
    }, TIMING.pyreBurnEffect);
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
    
    // Clear staggered card reveal queue when switching views
    if (window.clearCardRevealQueue) window.clearCardRevealQueue();
    
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

// Helper: Check if menu button is allowed in current tutorial step
function isMenuButtonAllowedInTutorial() {
    if (!window.TutorialManager?.isActive || window.TutorialManager?.freePlayMode) {
        return true; // Not in guided tutorial, allow everything
    }
    
    // Check if the current tutorial step allows the menu button
    // Access steps via TutorialManager.steps getter
    const currentStep = window.TutorialManager?.steps?.[window.TutorialManager?.currentStepIndex];
    if (!currentStep?.allowedElements) return false;
    
    return currentStep.allowedElements.some(selector => 
        selector === '#hand-menu-btn' || 
        selector === '#ritual-circle-overlay' ||
        selector === '#menu-kindling-btn' ||
        selector === '.orbital-sigil'
    );
}

// Helper: Check if current tutorial step requires clicking a sigil button (menu should stay open)
function isTutorialStepRequiringSigil() {
    if (!window.TutorialManager?.isActive || window.TutorialManager?.freePlayMode) {
        return false;
    }
    
    const currentStep = window.TutorialManager?.steps?.[window.TutorialManager?.currentStepIndex];
    if (!currentStep?.allowedElements) return false;
    
    // Check if this step requires clicking a sigil button (kindling, burn, end)
    return currentStep.allowedElements.some(selector => 
        selector === '#menu-kindling-btn' ||
        selector === '#menu-burn-btn' ||
        selector === '#menu-end-btn' ||
        selector === '.orbital-sigil'
    );
}

// Ritual Circle Menu toggle
document.getElementById('hand-menu-btn').onclick = () => {
    const overlay = document.getElementById('ritual-circle-overlay');
    const btn = document.getElementById('hand-menu-btn');
    const isOpen = overlay.classList.contains('open');
    
    // During guided tutorial, check if opening is allowed
    if (window.TutorialManager?.isActive && !window.TutorialManager?.freePlayMode) {
        if (isOpen) {
            // Don't allow closing if current step requires a sigil click
            if (isTutorialStepRequiringSigil()) {
                return; // Can't close - must click a sigil
            }
            overlay.classList.remove('open');
            overlay.classList.remove('tutorial-locked');
            btn.classList.remove('menu-open');
        } else if (isMenuButtonAllowedInTutorial()) {
            // Only allow opening if this step involves the menu
            overlay.classList.add('open');
            btn.classList.add('menu-open');
            
            // Lock the menu open if this step requires a sigil click
            if (isTutorialStepRequiringSigil()) {
                overlay.classList.add('tutorial-locked');
            }
        }
        // If not allowed and not open, do nothing
        return;
    }
    
    // Normal toggle behavior outside tutorial
    overlay.classList.toggle('open');
    btn.classList.toggle('menu-open');
};

// Close ritual circle when clicking on overlay background (not on sigils)
document.getElementById('ritual-circle-overlay')?.addEventListener('click', (e) => {
    // Only close if clicking directly on the overlay or container (not on buttons)
    if (e.target.classList.contains('ritual-circle-overlay') || 
        e.target.classList.contains('ritual-circle-container') ||
        e.target.closest('.central-sigil')) {
        
        // Don't allow closing if tutorial step requires a sigil click
        if (isTutorialStepRequiringSigil()) {
            return; // Must click a sigil during this tutorial step
        }
        
        const overlay = document.getElementById('ritual-circle-overlay');
        const btn = document.getElementById('hand-menu-btn');
        overlay.classList.remove('open');
        overlay.classList.remove('tutorial-locked');
        btn.classList.remove('menu-open');
    }
});

// Keyboard shortcut: Escape to close ritual circle
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const overlay = document.getElementById('ritual-circle-overlay');
        const btn = document.getElementById('hand-menu-btn');
        
        if (overlay?.classList.contains('open')) {
            // Don't allow Escape to close if tutorial step requires a sigil click
            if (isTutorialStepRequiringSigil()) {
                return; // Must click a sigil during this tutorial step
            }
            overlay.classList.remove('open');
            overlay.classList.remove('tutorial-locked');
            btn?.classList.remove('menu-open');
        }
    }
});

// Helper function to close the ritual circle menu
function closeRitualCircle() {
    const overlay = document.getElementById('ritual-circle-overlay');
    overlay?.classList.remove('open');
    overlay?.classList.remove('tutorial-locked');
    document.getElementById('hand-menu-btn')?.classList.remove('menu-open');
}

// Wire up ritual circle sigil buttons to same handlers
document.getElementById('menu-kindling-btn').onclick = (e) => {
    e.stopPropagation(); // Prevent overlay close from triggering
    document.getElementById('kindling-toggle-btn').click();
    // Always close menu after clicking kindling (removes tutorial-locked too)
    closeRitualCircle();
};

document.getElementById('menu-burn-btn').onclick = (e) => {
    e.stopPropagation(); // Prevent overlay close from triggering
    // Don't allow during guided tutorial unless it's the expected action
    if (window.TutorialManager?.isActive && !window.TutorialManager?.freePlayMode) {
        return;
    }
    document.getElementById('pyre-burn-btn').click();
    closeRitualCircle();
};

document.getElementById('menu-end-btn').onclick = (e) => {
    e.stopPropagation(); // Prevent overlay close from triggering
    // Don't allow during guided tutorial unless it's the expected action
    if (window.TutorialManager?.isActive && !window.TutorialManager?.freePlayMode) {
        return;
    }
    document.getElementById('end-turn-btn').click();
    closeRitualCircle();
};

// Update ritual circle sigil button states
function updateMenuButtons() {
    const menuKindlingBtn = document.getElementById('menu-kindling-btn');
    const menuBurnBtn = document.getElementById('menu-burn-btn');
    const menuEndBtn = document.getElementById('menu-end-btn');
    
    if (!game) return;
    
    const isPlayer = game.currentTurn === 'player';
    const isConjure = game.phase === 'conjure1' || game.phase === 'conjure2';
    
    // Kindling sigil state - toggle active class which switches the sprite via CSS
    if (menuKindlingBtn) {
        const labelEl = menuKindlingBtn.querySelector('.sigil-label');
        
        if (ui.showingKindling) {
            menuKindlingBtn.classList.add('active');
            if (labelEl) labelEl.textContent = 'Grimoire';
        } else {
            menuKindlingBtn.classList.remove('active');
            if (labelEl) labelEl.textContent = 'Kindling';
        }
        menuKindlingBtn.disabled = (game.playerKindling.length === 0 && !ui.showingKindling);
    }
    
    // Burn sigil state - match main button logic
    if (menuBurnBtn) {
        menuBurnBtn.disabled = !isPlayer || !isConjure || game.playerPyreBurnUsed || game.playerDeaths === 0;
    }
    
    // End Turn sigil state  
    if (menuEndBtn) {
        menuEndBtn.disabled = !isPlayer;
    }
}

document.getElementById('end-turn-btn').onclick = () => {
    // Basic checks
    if (game.currentTurn !== 'player' || isAnimating) return;
    
    isAnimating = true;
    hideTooltip();
    ui.selectedCard = null; ui.attackingCryptid = null; ui.targetingBurst = null; ui.targetingEvolution = null; ui.showingKindling = false;
    document.getElementById('cancel-target').classList.remove('show');
    
    // Clear any stuck hover states on hand cards before turn transition
    clearHandHoverStates();
    
    checkAllCreaturesForDeath(() => {
        // Animate turn-end effects (healing from radiance/regen)
        animateTurnEndEffects(() => {
            game.endTurn();
            
            if (game.currentTurn === 'enemy' && !game.gameOver) {
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
                    const rarity = effect.cryptid?.rarity || 'common';
                    if (sprite && window.CombatEffects?.playDramaticDeath) {
                        window.CombatEffects.playDramaticDeath(sprite, effect.owner, rarity, () => {
                            // Pre-mark pending promotions in activePromotions BEFORE renderAll
                            if (window.pendingPromotions?.length > 0) {
                                if (!window.activePromotions) window.activePromotions = new Set();
                                window.pendingPromotions.forEach(p => {
                                    window.activePromotions.add(`${p.owner}-${p.row}`);
                                });
                            }
                            renderAll();
                            processPendingPromotions(() => {
                                setTimeout(() => { currentIndex++; processNextEffect(); }, 100);
                            });
                        });
                    } else {
                        if (sprite) sprite.classList.add(effect.owner === 'enemy' ? 'dying-right' : 'dying-left');
                        setTimeout(() => {
                            // Pre-mark pending promotions in activePromotions BEFORE renderAll
                            if (window.pendingPromotions?.length > 0) {
                                if (!window.activePromotions) window.activePromotions = new Set();
                                window.pendingPromotions.forEach(p => {
                                    window.activePromotions.add(`${p.owner}-${p.row}`);
                                });
                            }
                            renderAll();
                            processPendingPromotions(() => {
                                setTimeout(() => { currentIndex++; processNextEffect(); }, 100);
                            });
                        }, TIMING.deathAnim);
                    }
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
                    const rarity = effect.cryptid?.rarity || 'common';
                    if (sprite && window.CombatEffects?.playDramaticDeath) {
                        window.CombatEffects.playDramaticDeath(sprite, effect.owner, rarity, () => {
                            // Pre-mark pending promotions in activePromotions BEFORE renderAll
                            if (window.pendingPromotions?.length > 0) {
                                if (!window.activePromotions) window.activePromotions = new Set();
                                window.pendingPromotions.forEach(p => {
                                    window.activePromotions.add(`${p.owner}-${p.row}`);
                                });
                            }
                            renderAll();
                            processPendingPromotions(() => {
                                setTimeout(() => { currentIndex++; processNextEffect(); }, 100);
                            });
                        });
                    } else {
                        if (sprite) sprite.classList.add(effect.owner === 'enemy' ? 'dying-right' : 'dying-left');
                        setTimeout(() => {
                            // Pre-mark pending promotions in activePromotions BEFORE renderAll
                            if (window.pendingPromotions?.length > 0) {
                                if (!window.activePromotions) window.activePromotions = new Set();
                                window.pendingPromotions.forEach(p => {
                                    window.activePromotions.add(`${p.owner}-${p.row}`);
                                });
                            }
                            renderAll();
                            processPendingPromotions(() => {
                                setTimeout(() => { currentIndex++; processNextEffect(); }, 100);
                            });
                        }, TIMING.deathAnim);
                    }
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

// Status effect tooltip - shows at top center of battlefield
function showStatusTooltip(tooltipText) {
    const tooltip = document.getElementById('status-tooltip');
    if (!tooltip || !tooltipText) return;
    
    // Parse tooltip text to extract title and description
    const colonIndex = tooltipText.indexOf(':');
    if (colonIndex > -1) {
        const title = tooltipText.substring(0, colonIndex).trim();
        const desc = tooltipText.substring(colonIndex + 1).trim();
        tooltip.innerHTML = `<div class="status-tooltip-title">${title}</div><div class="status-tooltip-desc">${desc}</div>`;
    } else {
        tooltip.innerHTML = `<div class="status-tooltip-desc">${tooltipText}</div>`;
    }
    
    tooltip.classList.add('show');
}

function hideStatusTooltip() {
    const tooltip = document.getElementById('status-tooltip');
    if (tooltip) tooltip.classList.remove('show');
}

// Setup status icon tooltip listeners (called after rendering)
function setupStatusIconListeners() {
    document.querySelectorAll('.status-icon-item[data-tooltip]').forEach(icon => {
        // Only add listeners if not already added
        if (!icon.dataset.tooltipListenerAdded) {
            icon.addEventListener('mouseenter', (e) => {
                showStatusTooltip(e.currentTarget.dataset.tooltip);
            });
            icon.addEventListener('mouseleave', hideStatusTooltip);
            icon.dataset.tooltipListenerAdded = 'true';
        }
    });
}

// Check if status icons overflow and setup auto-scroll
function checkStatusIconOverflow(iconsColumn) {
    if (!iconsColumn) return;
    
    requestAnimationFrame(() => {
        const wrapper = iconsColumn.querySelector('.status-icons-scroll-wrapper');
        if (!wrapper) return;
        
        const columnHeight = iconsColumn.clientHeight;
        const wrapperHeight = wrapper.scrollHeight;
        
        if (wrapperHeight > columnHeight + 2) { // +2 for small tolerance
            iconsColumn.classList.add('has-overflow');
            // Calculate scroll distance to show all icons (with padding for last icon)
            const scrollDist = wrapperHeight - columnHeight + 8;
            iconsColumn.style.setProperty('--scroll-distance', `-${scrollDist}px`);
            // Adjust scroll duration based on how much content needs to scroll
            const duration = Math.max(3, Math.min(6, scrollDist / 15));
            iconsColumn.style.setProperty('--scroll-duration', `${duration}s`);
        } else {
            iconsColumn.classList.remove('has-overflow');
        }
    });
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
    const decayRatBtn = document.getElementById('tooltip-decayrat-btn');
    if (sacrificeBtn) sacrificeBtn.style.display = 'none';
    if (bloodPactBtn) bloodPactBtn.style.display = 'none';
    if (thermalBtn) thermalBtn.style.display = 'none';
    if (rageHealBtn) rageHealBtn.style.display = 'none';
    if (bloodFrenzyBtn) bloodFrenzyBtn.style.display = 'none';
    if (decayRatBtn) {
        decayRatBtn.style.display = 'none';
        decayRatBtn.disabled = false;
        decayRatBtn.style.opacity = '1';
        decayRatBtn.style.cursor = 'pointer';
    }
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
        cancelDecayRatTargeting();
        document.getElementById('cancel-target').classList.remove('show');
        renderAll();
    }
};

// Cancel Decay Rat targeting mode and clean up highlights
function cancelDecayRatTargeting() {
    if (ui.targetingDecayRat) {
        ui.targetingDecayRat = null;
        ui.decayRatAilmentedEnemies = null;
        // Remove highlights from all tiles
        document.querySelectorAll('.valid-decay-target').forEach(el => el.classList.remove('valid-decay-target'));
    }
}

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
    
    // Handle Decay Rat targeting - select any ailmented enemy
    if (cryptid && owner === 'enemy' && ui.targetingDecayRat) {
        const validTargets = ui.decayRatAilmentedEnemies || [];
        if (validTargets.some(t => t.col === colNum && t.row === row)) {
            executeDecayRatAbility(colNum, row);
            return;
        }
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
    let displayAtk = cryptid.currentAtk - (cryptid.atkDebuff || 0) - (cryptid.curseTokens || 0) - (cryptid.gremlinAtkDebuff || 0) - (cryptid.decayRatAtkDebuff || 0);
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
    document.getElementById('tooltip-desc').textContent = `HP: ${Math.max(0, displayHp)}/${displayMaxHp} | ATK: ${Math.max(0, displayAtk)}${elementDisplay}`;
    document.getElementById('tooltip-combat').textContent = `⚔ ${cryptid.combatAbility || 'None'}`;
    
    // Use dynamic getSupportAbility if available (for cards with spendable abilities like Rooftop Gargoyle)
    const supportAbilityText = cryptid.getSupportAbility 
        ? cryptid.getSupportAbility(cryptid) 
        : (cryptid.supportAbility || 'None');
    document.getElementById('tooltip-support').textContent = `✧ ${supportAbilityText}`;
    
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
    
    // Handle sacrifice button - supports both data-driven and legacy formats
    const sacrificeBtn = document.getElementById('tooltip-sacrifice-btn');
    const hasSacrificeAbility = cryptid.activatedAbilities?.find(a => a.id === 'sacrifice') || cryptid.hasSacrificeAbility;
    const sacrificeAvailable = cryptid.sacrificeAvailable !== false && cryptid.sacrificeAbilityAvailable !== false;
    const canSacrifice = hasSacrificeAbility && 
                         sacrificeAvailable && 
                         cryptid.col === supportCol &&
                         owner === 'player' && 
                         game.currentTurn === 'player' &&
                         game.getCombatant(cryptid);
    
    if (canSacrifice) {
        sacrificeBtn.style.display = 'block';
        sacrificeBtn.onclick = (e) => {
            e.stopPropagation();
            const combatant = game.getCombatant(cryptid);
            const combatCol = game.getCombatCol(owner);
            const combatantRow = cryptid.row;
            
            // Get sprite for death animation BEFORE activating sacrifice
            const combatantSprite = document.querySelector(
                `.cryptid-sprite[data-owner="${owner}"][data-col="${combatCol}"][data-row="${combatantRow}"]`
            );
            const rarity = combatant?.rarity || 'common';
            
            hideTooltip();
            isAnimating = true;
            
            // Pre-mark the promotion in activePromotions BEFORE activating sacrifice
            // This prevents renderSprites from showing the support at combat position prematurely
            if (!window.activePromotions) window.activePromotions = new Set();
            window.activePromotions.add(`${owner}-${combatantRow}`);
            
            // Function to execute the sacrifice
            const executeSacrifice = () => {
                if (cryptid.activatedAbilities) {
                    game.activateAbility(cryptid, 'sacrifice');
                } else if (cryptid.activateSacrifice) {
                    cryptid.activateSacrifice(cryptid, game);
                }
            };
            
            // Play death animation for the sacrificed combatant
            if (combatantSprite && window.CombatEffects?.playDramaticDeath) {
                // Activate sacrifice after a small delay (so animation starts first)
                setTimeout(executeSacrifice, 100);
                
                window.CombatEffects.playDramaticDeath(combatantSprite, owner, rarity, () => {
                    // After death animation, process pending promotions with animation
                    renderAll();
                    processPendingPromotions(() => {
                        isAnimating = false;
                        renderAll();
                        updateButtons();
                    });
                });
            } else {
                // Fallback - no animation available
                executeSacrifice();
                setTimeout(() => {
                    renderAll();
                    processPendingPromotions(() => {
                        isAnimating = false;
                        renderAll();
                        updateButtons();
                    });
                }, TIMING.deathAnim);
            }
        };
        tooltip.classList.add('has-sacrifice');
    } else {
        sacrificeBtn.style.display = 'none';
        tooltip.classList.remove('has-sacrifice');
    }
    
    // Handle Blood Pact button (Vampire Initiate) - supports both data-driven and legacy formats
    const bloodPactBtn = document.getElementById('tooltip-bloodpact-btn');
    const hasBloodPactAbility = cryptid.activatedAbilities?.find(a => a.id === 'bloodPact') || cryptid.hasBloodPactAbility;
    const bloodPactAvailable = cryptid.bloodPactAvailable !== false;
    const canBloodPact = hasBloodPactAbility && 
                         bloodPactAvailable && 
                         cryptid.col === supportCol &&
                         owner === 'player' && 
                         game.currentTurn === 'player' &&
                         game.getCombatant(cryptid);
    
    if (canBloodPact) {
        bloodPactBtn.style.display = 'block';
        bloodPactBtn.onclick = (e) => {
            e.stopPropagation();
            const combatant = game.getCombatant(cryptid);
            // Use effective HP (combatant + support) to determine if this will kill
            const effectiveHp = combatant ? game.getEffectiveHp(combatant) : 0;
            const willKill = effectiveHp <= 1;
            
            // Show activation message
            showMessage(`🩸 ${cryptid.name} uses Blood Pact!`, 1000);
            
            // Add damage animation to combatant
            const combatCol = game.getCombatCol(owner);
            const combatantSprite = document.querySelector(`.cryptid-sprite[data-owner="${owner}"][data-col="${combatCol}"][data-row="${cryptid.row}"]`);
            if (combatantSprite) {
                // Use new smooth hit effect
                if (window.playHitEffectOnSprite && combatant) {
                    window.playHitEffectOnSprite(combatantSprite, combatant, { intensity: 'light' });
                }
                
                // Show floating damage on combatant
                if (window.CombatEffects && combatant) {
                    CombatEffects.showDamageNumber(combatant, 1, false);
                }
            }
            
            // Add blood effect on vampire
            const vampireSprite = document.querySelector(`.cryptid-sprite[data-owner="${owner}"][data-col="${cryptid.col}"][data-row="${cryptid.row}"]`);
            if (vampireSprite) {
                vampireSprite.classList.add('ability-activate');
                setTimeout(() => vampireSprite.classList.remove('ability-activate'), 500);
            }
            
            // Execute ability (data-driven or legacy)
            if (cryptid.activatedAbilities) {
                game.activateAbility(cryptid, 'bloodPact');
            } else if (cryptid.activateBloodPact) {
                cryptid.activateBloodPact(cryptid, game);
            }
            hideTooltip();
            
            if (willKill) {
                // Combatant will die - delay for death + promotion
                setTimeout(() => renderAll(), TIMING.deathAnim + TIMING.promoteAnim + 200);
            } else {
                setTimeout(() => renderAll(), 400);
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
    
    // Handle Decay Rat button - supports both data-driven and legacy formats
    const decayRatBtn = document.getElementById('tooltip-decayrat-btn');
    if (decayRatBtn) {
        // Check if this is Decay Rat in support position with ability available
        const hasDecayAbility = cryptid.activatedAbilities?.find(a => a.id === 'decayDebuff') || cryptid.hasDecayRatAbility;
        const isDecayRatSupport = hasDecayAbility && 
                                  cryptid.col === supportCol &&
                                  owner === 'player' && 
                                  game.currentTurn === 'player';
        
        // Check if there's ANY valid target (any ailmented enemy on the field)
        let hasValidTarget = false;
        let ailmentedEnemies = [];
        if (isDecayRatSupport) {
            // Check all enemy positions for ailmented cryptids
            for (let col = 0; col < 2; col++) {
                for (let row = 0; row < 3; row++) {
                    const enemy = game.enemyField[col]?.[row];
                    if (enemy && game.hasStatusAilment(enemy)) {
                        hasValidTarget = true;
                        ailmentedEnemies.push({ col, row, enemy });
                    }
                }
            }
        }
        
        // Check availability - data-driven uses decayDebuffAvailable, legacy uses decayRatDebuffAvailable
        const abilityAvailable = cryptid.decayDebuffAvailable !== false && cryptid.decayRatDebuffAvailable !== false;
        
        if (isDecayRatSupport) {
            decayRatBtn.style.display = 'block';
            
            // Gray out if no valid targets or ability already used
            if (!hasValidTarget || !abilityAvailable) {
                decayRatBtn.disabled = true;
                decayRatBtn.style.opacity = '0.5';
                decayRatBtn.style.cursor = 'not-allowed';
                decayRatBtn.title = !abilityAvailable ? 'Already used this turn' : 'No ailmented enemies';
                decayRatBtn.onclick = null;
            } else {
                decayRatBtn.disabled = false;
                decayRatBtn.style.opacity = '1';
                decayRatBtn.style.cursor = 'pointer';
                decayRatBtn.title = '';
                decayRatBtn.onclick = (e) => {
                    e.stopPropagation();
                    hideTooltip();
                    
                    // Enter targeting mode for Decay Rat ability
                    ui.targetingDecayRat = cryptid;
                    ui.decayRatAilmentedEnemies = ailmentedEnemies;
                    
                    // Highlight valid targets
                    ailmentedEnemies.forEach(({ col, row }) => {
                        const tile = document.querySelector(`.tile.enemy[data-col="${col}"][data-row="${row}"]`);
                        if (tile) tile.classList.add('valid-decay-target');
                    });
                    
                    showMessage('🦠 Choose an ailmented enemy to decay', 2000);
                    document.getElementById('cancel-target').classList.add('show');
                };
            }
            tooltip.classList.add('has-sacrifice');
        } else {
            decayRatBtn.style.display = 'none';
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
    // Update hand centering padding for new viewport
    if (typeof updateHandPadding === 'function') {
        updateHandPadding();
    }
}, 50));

// Also handle orientation change explicitly
window.addEventListener('orientationchange', () => {
    // Delay to allow browser to complete orientation change
    setTimeout(() => {
        calculateTilePositions();
        updateSpritePositions();
        lastBattlefieldHeight = document.getElementById('battlefield-area').offsetHeight;
        if (typeof updateHandPadding === 'function') {
            updateHandPadding();
        }
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
            if (typeof updateHandPadding === 'function') {
                updateHandPadding();
            }
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
window.setAnimating = setAnimating;
window.initGame = initGame;

// Shared event listeners for special card abilities
function setupGameEventListeners() {
    console.log('[Setup] setupGameEventListeners called, clearing old listeners first');
    
    // Setup new hand area controls
    setupAdvancePhaseButton();
    // Force restart hand animation loop when entering battle
    if (typeof startHandAnimation === 'function') {
        startHandAnimation(true);
    }
    
    // Clear ALL previous game event listeners to avoid duplicates
    // This is important when starting a new game after a previous one
    GameEvents.off();
    
    // Re-register trap listeners (they were cleared by GameEvents.off())
    if (game && game.setupTrapListeners) {
        game.setupTrapListeners();
    }
    
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
        
        // Play turn transition animation (skip on first turn)
        if (data.turnNumber > 1 && window.CombatEffects?.playTurnTransition) {
            window.CombatEffects.playTurnTransition(data.owner);
        }
    });
    
    // Card draw - staggered rapid-fire reveal queue for satisfying multi-draw
    let cardRevealQueue = [];
    let pendingRevealCardIds = new Set(); // Cards waiting to be revealed (hidden until processed)
    let revealTimer = null;
    let queueStartTimer = null; // Delay before starting to process queue (lets multiple cards accumulate)
    let isRevealingCards = false; // Track if we're in the middle of a staggered reveal
    const CARD_REVEAL_STAGGER = 140; // ms between each card reveal (matches ember timing feel)
    const QUEUE_START_DELAY = 50; // Small delay to let synchronous draws accumulate
    
    function queueCardReveal(card) {
        // Mark this card as pending (will be hidden until revealed)
        pendingRevealCardIds.add(card.id);
        cardRevealQueue.push(card);
        isRevealingCards = true;
        
        // Delay starting the queue processing to let multiple synchronous draws accumulate
        if (!revealTimer && !queueStartTimer) {
            queueStartTimer = setTimeout(() => {
                queueStartTimer = null;
                processCardRevealQueue();
            }, QUEUE_START_DELAY);
        }
    }
    
    function processCardRevealQueue() {
        if (cardRevealQueue.length === 0) {
            revealTimer = null;
            isRevealingCards = false;
            pendingRevealCardIds.clear();
            return;
        }
        
        const card = cardRevealQueue.shift();
        
        // Remove from pending (now it should be shown)
        pendingRevealCardIds.delete(card.id);
        
        // Play flying card animation
        if (window.CombatEffects?.playCardDrawAnimation) {
            window.CombatEffects.playCardDrawAnimation(1, 'player');
        }
        
        // Re-render hand to show the newly revealed card (force=true to bypass animation lock)
        renderHand(true);
        
        // Add rapid-enter animation to the new card
        requestAnimationFrame(() => {
            const cardWrapper = document.querySelector(`.card-wrapper[data-card-id="${card.id}"]`);
            if (cardWrapper) {
                const cardEl = cardWrapper.querySelector('.game-card');
                if (cardEl) {
                    cardEl.classList.add('card-rapid-enter');
                    setTimeout(() => cardEl.classList.remove('card-rapid-enter'), 400);
                }
            }
        });
        
        // Schedule next reveal
        if (cardRevealQueue.length > 0) {
            revealTimer = setTimeout(processCardRevealQueue, CARD_REVEAL_STAGGER);
        } else {
            revealTimer = null;
            isRevealingCards = false;
            pendingRevealCardIds.clear();
        }
    }
    
    // Helper to check if a card should be shown (for staggered reveals)
    // Returns FALSE for cards that are still pending reveal
    window.isCardRevealed = (cardId) => {
        // If not currently revealing, show all cards
        if (!isRevealingCards) return true;
        // During reveal, hide cards that are still pending
        return !pendingRevealCardIds.has(cardId);
    };
    
    // Clear reveal tracking when appropriate (turn start, etc.)
    window.clearCardRevealQueue = () => {
        cardRevealQueue = [];
        pendingRevealCardIds.clear();
        isRevealingCards = false;
        if (revealTimer) {
            clearTimeout(revealTimer);
            revealTimer = null;
        }
        if (queueStartTimer) {
            clearTimeout(queueStartTimer);
            queueStartTimer = null;
        }
    };
    
    GameEvents.on('onCardDrawn', (data) => {
        if (data.owner === 'player') {
            if (game.turnNumber > 0) {
                // Queue for staggered rapid-fire reveal during gameplay
                queueCardReveal(data.card);
            } else {
                // Initial hand setup - just render immediately, no animation
                renderHand(true);
            }
        }
    });
    
    // Turn start UI reset (don't clear reveal queue here - it clears itself after processing)
    GameEvents.on('onTurnStart', (data) => {
        if (data.owner === 'player') {
            // Reset UI state
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
    
    // Clear reveal queue at turn END (before new turn starts) to ensure clean state
    GameEvents.on('onTurnEnd', (data) => {
        window.clearCardRevealQueue();
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
    
    // Destroyer Residue - create visual danger zone when Destroyer overkill will hit support
    GameEvents.on('onDestroyerResidue', (data) => {
        if (window.CombatEffects?.createDestroyerResidue) {
            window.CombatEffects.createDestroyerResidue(data.owner, data.col, data.row, data.damage);
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
                
                // Emit pyre events
                if (pyreOwner === 'player') {
                    GameEvents.emit('onPyreSpent', { owner: 'player', amount: pyreGained, oldValue: oldPlayerPyre, newValue: game.playerPyre, source: 'huntTrap' });
                }
                if (trapOwner === 'player') {
                    GameEvents.emit('onPyreGained', { owner: 'player', amount: pyreGained, oldValue: oldPlayerPyre, newValue: game.playerPyre, source: 'huntTrap' });
                }
                
                GameEvents.emit('onHuntSteal', { trap, stolenPyre: pyreGained, from: pyreOwner, to: trapOwner });
                GameEvents.emit('onTrapTriggered', { trap, owner: trapOwner, row: i });
                
                // Play enhanced trap animation if available (trapSprite already declared above)
                if (window.CombatEffects?.playTrapTrigger && trapSprite) {
                    window.CombatEffects.playTrapTrigger(trapSprite, null, trap.element || 'void');
                }
                
                // Consume trap
                traps[i] = null;
                
                // Re-render to show pyre changes and trap removal
                setTimeout(() => {
                    if (typeof renderAll === 'function') renderAll();
                }, 700);
                
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
        
        // Trigger ember animation for pyre gains (skip sources handled elsewhere)
        const amount = data.amount || 1;
        if (data.owner === 'player' && amount > 0 && window.CombatEffects?.playPyreBurn) {
            // Skip sources that are handled elsewhere (have their own animations)
            // - pyreBurn: handled by pyre burn button with its own animation
            // - pyreCard: handled by executePyreCard with its own animation
            // - Sources with manual playPyreBurn calls in their card definitions:
            const skipSources = [
                'pyreBurn', 'Pyre card',
                // Pyre cards that animate via executePyreCard
                'Fresh Kill', 'Rat King', 'Nightfall', 'Burial Ground', 'Cursed Woods', 'Animal Pelts', 'Gris-Gris Bag', 'Swamp Gas',
                // Cards that manually animate (putrid-swamp.js)
                'Swamp Rat support', 'Plague Rat support', 'Mama Brigitte',
                // Cards that manually animate (city-of-flesh.js)
                'The Flayer', 'Vampire Initiate', 'Vampire Initiate Siphon', 'Blood Pact', 'Vampire Lord'
            ];
            if (!skipSources.includes(data.source)) {
                // Find source cryptid sprite if available for start position
                const sourceCryptid = data.sourceCryptid;
                let sourceElement = null;
                if (sourceCryptid) {
                    sourceElement = document.querySelector(
                        `.cryptid-sprite[data-owner="${sourceCryptid.owner}"][data-col="${sourceCryptid.col}"][data-row="${sourceCryptid.row}"]`
                    );
                }
                window.CombatEffects.playPyreBurn(sourceElement, amount);
            }
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
    
    // ==================== BURN APPLICATION ANIMATION ====================
    // Beautiful fire effect when a monster gets burned for the first time
    GameEvents.on('onStatusApplied', (data) => {
        if (data.status === 'burn' && !data.refreshed && data.cryptid && window.CombatEffects?.playBurnApplication) {
            window.CombatEffects.playBurnApplication(data.cryptid);
        }
    });
    
    // ==================== LIFESTEAL ANIMATION ====================
    // Elegant sapping effect showing health flowing from victim to lifestealer
    GameEvents.on('onLifesteal', (data) => {
        if (data.cryptid && data.target && data.amount > 0 && window.CombatEffects?.playLifesteal) {
            window.CombatEffects.playLifesteal(data.cryptid, data.target, data.amount);
        }
    });
    
    // ==================== GARGOYLE SAVE ANIMATION ====================
    // Stone guardian protection when Rooftop Gargoyle prevents lethal damage
    GameEvents.on('onGargoyleSave', (data) => {
        if (data.support && data.combatant && window.CombatEffects?.playGargoyleSave) {
            window.CombatEffects.playGargoyleSave(data.support, data.combatant, data.fullHeal);
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
window.tilePositions = tilePositions;
window.performAttackOnTarget = performAttackOnTarget;
window.playAttackAnimation = playAttackAnimation;
window.processMolemanSplash = processMolemanSplash;
window.processKuchisakeExplosion = processKuchisakeExplosion;

// Update a single sprite's health bar immediately (for instant feedback at impact)
window.updateSpriteHealthBar = function(owner, col, row) {
    const cryptid = game.getFieldCryptid(owner, col, row);
    if (!cryptid) return;
    
    const sprite = document.querySelector(`.cryptid-sprite[data-owner="${owner}"][data-col="${col}"][data-row="${row}"]`);
    if (!sprite) return;
    
    const combatCol = game.getCombatCol(owner);
    const supportCol = game.getSupportCol(owner);
    
    let displayAtk = cryptid.currentAtk - (cryptid.atkDebuff || 0) - (cryptid.curseTokens || 0) - (cryptid.gremlinAtkDebuff || 0) - (cryptid.decayRatAtkDebuff || 0);
    let displayHp = cryptid.currentHp;
    let displayMaxHp = cryptid.maxHp || cryptid.hp;
    
    if (col === combatCol) {
        const support = game.getFieldCryptid(owner, supportCol, row);
        if (support) {
            displayAtk += support.currentAtk - (support.atkDebuff || 0) - (support.curseTokens || 0) - (support.gremlinAtkDebuff || 0) - (support.decayRatAtkDebuff || 0);
            displayHp += support.currentHp;
            displayMaxHp += support.maxHp || support.hp;
        }
    }
    
    const hpPercent = Math.max(0, Math.min(100, (displayHp / displayMaxHp) * 100));
    
    const atkValue = sprite.querySelector('.atk-badge .stat-value');
    const hpValue = sprite.querySelector('.hp-badge .stat-value');
    const hpFill = sprite.querySelector('.hp-fill');
    
    if (atkValue) atkValue.textContent = Math.max(0, displayAtk);
    if (hpValue) hpValue.textContent = Math.max(0, displayHp);
    if (hpFill) {
        hpFill.style.height = `${hpPercent}%`;
        hpFill.className = 'hp-fill' + (hpPercent <= 25 ? ' hp-low' : hpPercent <= 50 ? ' hp-medium' : '');
    }
};

// Debug commands for EffectStack
window.debugEffectStack = () => {
    console.log('=== EffectStack Debug ===');
    console.log('State:', EffectStack.getState());
    console.log('Recent History:', EffectStack.history.slice(-10));
    return EffectStack.getState();
};

window.setEffectStackDebug = (enabled) => {
    EffectStack.setDebug(enabled);
};

// Game initialization is handled by HomeScreen or MainMenu - no auto-init here

console.log('Game System loaded (with EffectStack v1.0)');