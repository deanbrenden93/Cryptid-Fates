/**
 * Cryptid Fates - Tutorial System
 * Comprehensive tutorial with satisfying payoff moments
 */

// ==================== TUTORIAL CONFIG ====================
const TutorialConfig = {
  FADE_DURATION: 400,

  // Player hand: pyre, trap, aura, burst (no regular cryptid - use kindling for both slots)
  PLAYER_STARTING_HAND: ["pyre", "terrify", "dauntingPresence", "rockSlide"],

  // 3 kindling for summoning
  PLAYER_STARTING_KINDLING: ["stormhawk", "stormhawk", "stormhawk"],

  // Enemy starts with a weak cryptid already on field (ready to attack)
  ENEMY_STARTING_CRYPTID: {
    card: "stormhawk", // Kindling stats: 1 ATK, 2 HP (no Lone Hunter bonus since not first summon for player)
    position: { col: "combat", row: 1 },
  },

  // Enemy turn 1: Attack player's combatant (trap triggers!)
  ENEMY_TURN_1: [
    { action: "attack", targetRow: 0 },
  ],

  // Enemy turn 2: Summon new cryptid, attack exposed support
  ENEMY_TURN_2: [
    { action: "summon", card: "stormhawk", position: { col: "combat", row: 0 } },
    { action: "attack", targetRow: 0, targetSupport: true },
  ],
};

// ==================== TUTORIAL STEPS ====================
const TutorialSteps = [
  // ========== PHASE 1: INTRODUCTION (Steps 1-3) ==========
  {
    id: "intro_1",
    text: "Welcome to Cryptid Fates! You are a conjurer who summons nightmarish monsters to battle.",
    type: "narrative",
    advance: "tap",
  },
  {
    id: "intro_2",
    text: "Your goal: Kill 10 enemy cryptids to win. Look - the enemy already has a cryptid on the field, ready to attack you!",
    type: "highlight",
    glowTargets: [".tile[data-owner='enemy'][data-col='0']"],
    advance: "tap",
    position: "top",
  },
  {
    id: "intro_3",
    text: "The battlefield has Combat columns (center of battlefield) for attacking cryptids, Support columns (back) for helpers, and Trap slots for hidden surprises.",
    type: "highlight",
    glowTargets: [
      ".tile[data-owner='player'][data-col='1']",
      ".tile[data-owner='player'][data-col='0']",
      ".tile[data-owner='player'][data-col='trap']",
    ],
    advance: "tap",
    position: "top",
  },

  // ========== PHASE 2: PYRES & PYRE CARDS (Steps 4-5) ==========
  {
    id: "pyre_1",
    text: "Pyres are your energy. At the start of each turn, you gain 1 pyre and draw 1 card automatically. PYRE CARDS give bonus pyres! Play your Basic Pyre now.",
    type: "action",
    highlights: ["#hand-container"],
    dragHighlights: ["#battlefield-area"],
    allowedElements: ["#hand-area", "#battlefield-area"],
    allowedCardType: "pyre",
    requiredAction: { type: "playPyre" },
    advance: "action",
    position: "top",
  },
  {
    id: "pyre_2",
    text: "You now have 2 pyres! Pyre cards are free to play (1 per turn) and give you more energy for powerful cards.",
    type: "highlight",
    highlights: ["#player-pyre"],
    advance: "tap",
    position: "top",
  },

  // ========== PHASE 3: KINDLING & COMBATANTS (Steps 6-9) ==========
  {
    id: "kindling_1",
    text: "KINDLING are free cryptids (0 cost). You can summon 1 per turn. Open the menu and click Kindling.",
    type: "action",
    highlights: ["#hand-menu-btn"],
    allowedElements: ["#hand-menu-btn"],
    requiredAction: { type: "openMenu" },
    advance: "action",
  },
  {
    id: "kindling_2",
    text: "Click the Kindling button to see your kindling cryptids.",
    type: "action",
    highlights: ["#menu-kindling-btn"],
    allowedElements: ["#menu-kindling-btn", "#hand-menu-panel", ".menu-action-btn", "#kindling-toggle-btn"],
    requiredAction: { type: "switchKindling" },
    advance: "action",
  },
  {
    id: "kindling_3",
    text: "Summon a Stormhawk to your COMBAT column. Cryptids in Combat are called COMBATANTS - they can attack!",
    type: "action",
    highlights: ["#hand-container"],
    dragGlowTargets: [".tile[data-owner='player'][data-col='1']"],
    allowedElements: ["#hand-area", "#player-combat-col", ".game-card", ".tile"],
    allowedCardType: "kindling",
    requiredAction: { type: "summon", position: "combat" },
    advance: "action",
    position: "top",
    onShow: () => {
      setTimeout(() => {
        if (TutorialOverlay.currentAllowedCardType === "kindling") {
          TutorialOverlay.applyCardBlocking();
        }
      }, 100);
    },
  },
  {
    id: "kindling_4",
    text: "Your combatant is ready! The red number is ATK (damage dealt), the green number is HP (health).",
    type: "highlight",
    glowTargets: [".stat-badge.atk-badge", ".stat-badge.hp-badge"],
    advance: "tap",
    position: "top",
    delay: 500,
    onShow: () => {
      // Force grimoire hand
      const forceGrimoire = () => {
        if (window.ui) {
          ui.showingKindling = false;
          if (typeof renderHand === "function") renderHand();
          if (typeof updateButtons === "function") updateButtons();
        }
      };
      forceGrimoire();
      setTimeout(forceGrimoire, 200);
    },
  },

  // ========== PHASE 4: TRAPS (Steps 10-11) ==========
  {
    id: "trap_1",
    text: "The enemy will attack soon! Set a TRAP to defend yourself. Drag Terrify to a trap slot - it's hidden from the enemy!",
    type: "action",
    highlights: ["#hand-container"],
    dragGlowTargets: [".tile[data-owner='player'][data-col='trap']"],
    allowedElements: ["#hand-area", "#player-trap-col", ".tile"],
    allowedCardType: "trap",
    requiredAction: { type: "playTrap" },
    advance: "action",
    position: "top",
  },
  {
    id: "trap_2",
    text: "Trap set! When the enemy attacks, Terrify will reduce their ATK to 0. Let's end your turn and see it work!",
    type: "highlight",
    glowTargets: [".tile[data-owner='player'][data-col='trap']"],
    advance: "tap",
    position: "top",
  },

  // ========== PHASE 5: END TURN 1 & TRAP TRIGGERS (Steps 12-15) ==========
  {
    id: "end_turn_1",
    text: "Skip to Combat Phase, then end your turn. (First turn cryptids can't attack.)",
    type: "action",
    highlights: ["#advance-phase-btn"],
    allowedElements: ["#advance-phase-btn"],
    requiredAction: { type: "advancePhase" },
    advance: "action",
  },
  {
    id: "skip_combat",
    text: "Since it's your first turn, skip Combat. Click again to go to Conjuring Phase II.",
    type: "action",
    highlights: ["#advance-phase-btn"],
    allowedElements: ["#advance-phase-btn"],
    requiredAction: { type: "advancePhase" },
    advance: "action",
  },
  {
    id: "end_turn_1b",
    text: "End your turn to let the enemy act.",
    type: "action",
    highlights: ["#advance-phase-btn"],
    allowedElements: ["#advance-phase-btn"],
    requiredAction: { type: "endTurn" },
    advance: "action",
    position: "bottom", // Keep dialogue at bottom so battlefield is visible for upcoming enemy attack
  },
  {
    id: "trap_payoff",
    text: "Excellent! Your TRAP saved you - Terrify reduced the enemy's ATK to 0, so you took no damage. Traps are powerful defensive tools!",
    type: "highlight",
    glowTargets: [".tile[data-owner='player'][data-col='1']"],
    advance: "tap",
    position: "top",
    delay: 5000, // Wait for enemy turn sequence (targeting + trap + attack)
    onShow: () => {
      // Block advancing during enemy turn
      TutorialManager.blockAdvance = true;
      
      // Enemy turn sequence starts immediately
      TutorialBattle.executeEnemyTurn1();
      
      // Unblock when the sequence is complete (matches delay)
      setTimeout(() => {
        TutorialManager.blockAdvance = false;
      }, 4800);
    },
  },

  // ========== PHASE 6: TURN 2 - SUPPORTS & AURAS (Steps 16-20) ==========
  {
    id: "turn2_start",
    text: "Your turn! You gained pyres from your Pyre card. Now let's learn about SUPPORTS.",
    type: "narrative",
    advance: "tap",
    onShow: () => {
      // Start player turn 2
      setTimeout(() => {
        TutorialBattle.startPlayerTurn2();
      }, 300);
    },
  },
  {
    id: "support_1",
    text: "Open your kindling again. This turn, summon to the SUPPORT column (back row).",
    type: "action",
    highlights: ["#hand-menu-btn"],
    allowedElements: ["#hand-menu-btn"],
    requiredAction: { type: "openMenu" },
    advance: "action",
  },
  {
    id: "support_2",
    text: "Click Kindling to see your kindling hand.",
    type: "action",
    highlights: ["#menu-kindling-btn"],
    allowedElements: ["#menu-kindling-btn", "#hand-menu-panel", ".menu-action-btn", "#kindling-toggle-btn"],
    requiredAction: { type: "switchKindling" },
    advance: "action",
  },
  {
    id: "support_3",
    text: "Summon a kindling to your SUPPORT column (back row). Supports grant their ATK and HP to the combatant in front of them!",
    type: "action",
    highlights: ["#hand-container"],
    dragGlowTargets: [".tile[data-owner='player'][data-col='0']"],
    allowedElements: ["#hand-area", "#player-support-col", ".game-card", ".tile[data-owner='player'][data-col='0']"],
    allowedCardType: "kindling",
    requiredAction: { type: "summon", position: "support" },
    advance: "action",
    position: "top",
    onShow: () => {
      // Restrict summons to support column only
      TutorialManager.restrictSummonToSupport = true;
    },
  },
  {
    id: "support_4",
    text: "Excellent! Your support's stats (1 ATK, 2 HP) are now added to your combatant. The combatant attacks with combined power and has combined health!",
    type: "highlight",
    glowTargets: [".tile[data-owner='player'][data-col='1']", ".tile[data-owner='player'][data-col='0']"],
    advance: "tap",
    position: "top",
    delay: 500,
    onShow: () => {
      // Remove summon restriction
      TutorialManager.restrictSummonToSupport = false;
      
      // Force grimoire hand
      const forceGrimoire = () => {
        if (window.ui) {
          ui.showingKindling = false;
          if (typeof renderHand === "function") renderHand();
          if (typeof updateButtons === "function") updateButtons();
        }
      };
      forceGrimoire();
      setTimeout(forceGrimoire, 200);
    },
  },

  // ========== PHASE 7: AURAS (Steps 21-22) ==========
  {
    id: "aura_1",
    text: "AURAS are permanent buffs! Drag Daunting Presence onto your COMBATANT (not the support) to give it +1 ATK and +1 HP forever.",
    type: "action",
    highlights: ["#hand-container"],
    dragGlowTargets: [".tile[data-owner='player'][data-col='1']"],
    allowedElements: ["#hand-area", "#player-combat-col", ".tile[data-owner='player'][data-col='1']", ".cryptid-sprite[data-owner='player'][data-col='1']"],
    allowedCardType: "aura",
    requiredAction: { type: "playAura", targetCol: "combat" },
    advance: "action",
    position: "top",
    onShow: () => {
      // Restrict aura targets to combat column only
      TutorialManager.restrictAuraToCombat = true;
    },
  },
  {
    id: "aura_2",
    text: "Your combatant is permanently buffed! Auras stay attached until the cryptid dies. Now you're ready to fight!",
    type: "highlight",
    glowTargets: [".tile[data-owner='player'][data-col='1']"],
    advance: "tap",
    position: "top",
    onShow: () => {
      // Remove aura restriction
      TutorialManager.restrictAuraToCombat = false;
    },
  },

  // ========== PHASE 8: BURSTS & COMBAT - KILL PAYOFF (Steps 23-27) ==========
  {
    id: "burst_1",
    text: "BURSTS are instant spells. Play Rock Slide on the enemy to deal 1 damage - softening them up!",
    type: "action",
    highlights: ["#hand-container"],
    dragGlowTargets: [".tile[data-owner='enemy'][data-col='0']"],
    allowedElements: ["#hand-area", "#enemy-combat-col", ".tile", ".cryptid-sprite"],
    allowedCardType: "burst",
    requiredAction: { type: "playBurst" },
    advance: "action",
    position: "top",
  },
  {
    id: "burst_2",
    text: "The enemy is weakened! Now advance to Combat Phase to finish them off.",
    type: "action",
    highlights: ["#advance-phase-btn"],
    allowedElements: ["#advance-phase-btn"],
    requiredAction: { type: "advancePhase" },
    advance: "action",
  },
  {
    id: "attack_1",
    text: "Click your combatant to select it, then click the enemy to attack!",
    type: "action",
    glowTargets: [".tile[data-owner='player'][data-col='1']"],
    dragGlowTargets: [".tile[data-owner='enemy'][data-col='0']"],
    allowedElements: ["#player-combat-col", "#enemy-combat-col", ".tile", ".cryptid-sprite"],
    requiredAction: { type: "attack" },
    advance: "action",
    position: "top",
  },
  {
    id: "kill_payoff",
    text: "KILL! You destroyed the enemy cryptid! Your combatant is now RESTED (dimmed) - it can't attack again until next turn.",
    type: "highlight",
    glowTargets: [".tile[data-owner='player'][data-col='1']"],
    advance: "tap",
    position: "top",
    delay: 1500,
  },

  // ========== PHASE 9: REST VULNERABILITY (Steps 28-31) ==========
  {
    id: "rest_warning",
    text: "IMPORTANT: When your combatant is rested, your SUPPORT becomes vulnerable! Enemies can attack it directly. End your turn to see.",
    type: "narrative",
    advance: "tap",
  },
  {
    id: "end_turn_2",
    text: "Skip Conjuring Phase II and end your turn.",
    type: "action",
    highlights: ["#advance-phase-btn"],
    allowedElements: ["#advance-phase-btn"],
    requiredAction: { type: "endTurn" },
    advance: "action",
    position: "bottom", // Keep dialogue at bottom so battlefield is visible for upcoming enemy attack
  },
  {
    id: "support_attacked",
    text: "The enemy summoned reinforcements and attacked your exposed SUPPORT! When combatants rest, supports become vulnerable. Protect them!",
    type: "highlight",
    glowTargets: [".tile[data-owner='player'][data-col='0']"],
    advance: "tap",
    position: "top",
    delay: 6500, // Wait for sequence: summon (2s) + targeting (1.5s) + attack (1.5s) + death (1s)
    onShow: () => {
      // Block advancing during enemy turn
      TutorialManager.blockAdvance = true;
      
      // Enemy turn sequence starts immediately
      TutorialBattle.executeEnemyTurn2();
      
      // Unblock when the sequence is complete (matches delay)
      setTimeout(() => {
        TutorialManager.blockAdvance = false;
      }, 6300);
    },
  },

  // ========== PHASE 10: CONCLUSION (Step 32) ==========
  {
    id: "conclusion",
    text: "Tutorial complete! You learned: PYRES (energy), KINDLING (free cryptids), COMBATANTS (attackers), SUPPORTS (add ATK & HP to combatant), AURAS (permanent buffs), TRAPS (hidden defense), BURSTS (instant spells), and REST VULNERABILITY. Good luck, Conjurer!",
    type: "narrative",
    advance: "tap",
    onShow: () => {
      setTimeout(() => {
        if (window.game) game.startTurn("player");
        if (typeof renderAll === "function") renderAll();
      }, 300);
    },
  },
];

// ==================== TUTORIAL OVERLAY ====================
const TutorialOverlay = {
  dialogueElement: null,
  highlightElements: [],
  stylesInjected: false,
  currentAllowedCardType: null,
  handObserver: null,
  currentStep: null, // Track current step for repositioning
  resizeHandler: null,

  init() {
    this.injectStyles();
    this.createDialogue();
    this.setupHandObserver();
    this.setupResizeHandler();
  },
  
  setupResizeHandler() {
    // Debounced resize handler to reposition highlights
    let resizeTimeout;
    this.resizeHandler = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        this.repositionHighlights();
      }, 100);
    };
    
    window.addEventListener('resize', this.resizeHandler);
    window.addEventListener('orientationchange', this.resizeHandler);
  },
  
  repositionHighlights() {
    if (!this.currentStep) return;
    
    // Clear existing highlights and reapply based on current step
    const step = this.currentStep;
    
    // Remove highlight elements (but not glow classes)
    this.highlightElements.forEach((el) => {
      try { el.remove(); } catch(e) {}
    });
    this.highlightElements = [];
    
    // Reapply highlights
    if (step.highlights) {
      step.highlights.forEach((sel) => this.addHighlight(sel));
    }
    
    // Reapply glow targets (remove and re-add classes)
    if (step.glowTargets) {
      document.querySelectorAll(".tutorial-glow").forEach((el) => el.classList.remove("tutorial-glow"));
      step.glowTargets.forEach((sel) => this.addGlow(sel));
    }
    
    if (step.dragGlowTargets) {
      document.querySelectorAll(".tutorial-drag-glow").forEach((el) => el.classList.remove("tutorial-drag-glow"));
      step.dragGlowTargets.forEach((sel) => this.addDragGlow(sel));
    }
  },

  setupHandObserver() {
    const handContainer = document.getElementById("hand-container");
    if (!handContainer) return;

    this.handObserver = new MutationObserver((mutations) => {
      if (this.currentAllowedCardType) {
        const hasStructuralChange = mutations.some(
          (m) => m.type === "childList" && (m.addedNodes.length > 0 || m.removedNodes.length > 0)
        );
        if (hasStructuralChange) {
          clearTimeout(this.blockingDebounce);
          this.blockingDebounce = setTimeout(() => this.applyCardBlocking(), 50);
        }
      }
    });

    this.handObserver.observe(handContainer, { childList: true, subtree: true });
  },

  injectStyles() {
    if (this.stylesInjected) return;
    this.stylesInjected = true;

    const style = document.createElement("style");
    style.id = "tutorial-styles";
    style.textContent = `
      .tutorial-highlight {
        position: absolute;
        border: 4px solid rgba(232, 169, 62, 0.9);
        border-radius: 12px;
        pointer-events: none;
        z-index: 10000;
        animation: tutorialHighlight 2s ease-in-out infinite;
        box-shadow: 0 0 30px 10px rgba(232, 169, 62, 0.4), inset 0 0 20px rgba(232, 169, 62, 0.1);
      }
      @keyframes tutorialHighlight {
        0%, 100% { border-color: rgba(232, 169, 62, 0.9); box-shadow: 0 0 30px 10px rgba(232, 169, 62, 0.4), inset 0 0 20px rgba(232, 169, 62, 0.1); }
        50% { border-color: rgba(232, 169, 62, 1); box-shadow: 0 0 50px 20px rgba(232, 169, 62, 0.6), inset 0 0 30px rgba(232, 169, 62, 0.2); }
      }
      .tutorial-drag-highlight {
        position: absolute;
        border: 3px dashed rgba(100, 200, 100, 0.9);
        border-radius: 12px;
        background: rgba(100, 200, 100, 0.1);
        pointer-events: none;
        z-index: 10000;
        animation: dragHighlight 1.5s ease-in-out infinite;
      }
      @keyframes dragHighlight {
        0%, 100% { border-color: rgba(100, 200, 100, 0.9); box-shadow: 0 0 20px 5px rgba(100, 200, 100, 0.3); }
        50% { border-color: rgba(100, 200, 100, 1); box-shadow: 0 0 40px 10px rgba(100, 200, 100, 0.5); }
      }
      .tutorial-dialogue {
        position: fixed;
        left: 50%;
        transform: translateX(-50%);
        max-width: min(650px, 92vw);
        width: 90%;
        padding: clamp(14px, 3vw, 28px) clamp(16px, 4vw, 36px);
        background: linear-gradient(180deg, rgba(20, 18, 25, 0.98) 0%, rgba(12, 10, 15, 0.98) 100%);
        border: 2px solid rgba(232, 169, 62, 0.6);
        border-radius: clamp(8px, 2vw, 12px);
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6), 0 0 60px rgba(232, 169, 62, 0.1);
        z-index: 10001;
        opacity: 0;
        transition: opacity 0.4s ease;
      }
      .tutorial-dialogue.visible { opacity: 1; }
      .tutorial-dialogue.top { top: clamp(40px, 8vh, 60px); }
      .tutorial-dialogue.center { top: 50%; transform: translate(-50%, -50%); }
      .tutorial-dialogue.bottom { bottom: clamp(120px, 22vh, 200px); }
      .dialogue-text {
        color: #e8dcc8;
        font-family: 'EB Garamond', Georgia, serif;
        font-size: clamp(14px, 3.5vw, 19px);
        line-height: 1.6;
        text-align: center;
        margin-bottom: clamp(10px, 2vw, 20px);
      }
      .dialogue-prompt {
        color: rgba(232, 169, 62, 0.8);
        font-family: 'Cinzel', serif;
        font-size: clamp(9px, 2vw, 11px);
        text-transform: uppercase;
        letter-spacing: clamp(1px, 0.5vw, 3px);
        text-align: center;
      }
      .tutorial-skip-btn {
        position: fixed;
        top: clamp(10px, 2vh, 20px);
        right: clamp(10px, 2vw, 20px);
        background: rgba(30, 25, 35, 0.95);
        border: 1px solid rgba(232, 169, 62, 0.3);
        color: rgba(232, 169, 62, 0.8);
        padding: clamp(8px, 1.5vw, 12px) clamp(12px, 2.5vw, 24px);
        border-radius: 6px;
        font-family: 'Cinzel', serif;
        font-size: clamp(9px, 2vw, 11px);
        letter-spacing: clamp(1px, 0.3vw, 2px);
        text-transform: uppercase;
        cursor: pointer;
        z-index: 10002;
        transition: all 0.3s;
      }
      .tutorial-skip-btn:hover {
        background: rgba(232, 169, 62, 0.15);
        border-color: rgba(232, 169, 62, 0.6);
        color: rgba(232, 169, 62, 1);
      }
      
      /* Mobile-specific adjustments */
      @media (max-width: 600px) {
        .tutorial-dialogue {
          width: 94%;
          max-width: none;
        }
        .tutorial-dialogue.bottom {
          bottom: 100px;
        }
      }
      
      @media (max-height: 500px) {
        .tutorial-dialogue {
          padding: 10px 14px;
        }
        .dialogue-text {
          margin-bottom: 8px;
        }
        .tutorial-dialogue.top {
          top: 30px;
        }
        .tutorial-dialogue.bottom {
          bottom: 80px;
        }
      }
      .tutorial-card-blocked {
        opacity: 0.35 !important;
        pointer-events: none !important;
        filter: grayscale(60%) !important;
        transform: scale(0.95) !important;
        transition: all 0.3s ease !important;
      }
      .tutorial-card-allowed {
        box-shadow: 0 0 20px rgba(232, 169, 62, 0.6) !important;
        border-color: rgba(232, 169, 62, 0.8) !important;
        animation: tutorialCardPulse 2s ease-in-out infinite !important;
      }
      @keyframes tutorialCardPulse {
        0%, 100% { box-shadow: 0 0 20px rgba(232, 169, 62, 0.6); }
        50% { box-shadow: 0 0 30px rgba(232, 169, 62, 0.8); }
      }
      .tutorial-glow {
        animation: tutorialGlow 2s ease-in-out infinite !important;
        box-shadow: 0 0 15px 3px rgba(232, 169, 62, 0.5), inset 0 0 10px rgba(232, 169, 62, 0.15) !important;
        border-color: rgba(232, 169, 62, 0.8) !important;
      }
      @keyframes tutorialGlow {
        0%, 100% { 
          box-shadow: 0 0 15px 3px rgba(232, 169, 62, 0.5), inset 0 0 10px rgba(232, 169, 62, 0.15);
          border-color: rgba(232, 169, 62, 0.8);
        }
        50% { 
          box-shadow: 0 0 25px 6px rgba(232, 169, 62, 0.7), inset 0 0 15px rgba(232, 169, 62, 0.25);
          border-color: rgba(232, 169, 62, 1);
        }
      }
      .tutorial-drag-glow {
        animation: tutorialDragGlow 1.5s ease-in-out infinite !important;
        box-shadow: 0 0 12px 2px rgba(100, 200, 100, 0.4), inset 0 0 8px rgba(100, 200, 100, 0.1) !important;
        border-color: rgba(100, 200, 100, 0.7) !important;
      }
      @keyframes tutorialDragGlow {
        0%, 100% { 
          box-shadow: 0 0 12px 2px rgba(100, 200, 100, 0.4), inset 0 0 8px rgba(100, 200, 100, 0.1);
          border-color: rgba(100, 200, 100, 0.7);
        }
        50% { 
          box-shadow: 0 0 20px 4px rgba(100, 200, 100, 0.6), inset 0 0 12px rgba(100, 200, 100, 0.2);
          border-color: rgba(100, 200, 100, 1);
        }
      }
      /* Ensure tooltips don't block clicks during tutorial */
      body.tutorial-active #tooltip {
        pointer-events: none !important;
      }
    `;
    document.head.appendChild(style);
  },

  createDialogue() {
    if (this.dialogueElement) return;

    const dialogue = document.createElement("div");
    dialogue.className = "tutorial-dialogue center";
    dialogue.innerHTML = `
      <div class="dialogue-text"></div>
      <div class="dialogue-prompt">Tap to continue</div>
    `;
    document.body.appendChild(dialogue);
    this.dialogueElement = dialogue;

    const skipBtn = document.createElement("button");
    skipBtn.className = "tutorial-skip-btn";
    skipBtn.textContent = "Skip Tutorial";
    skipBtn.onclick = (e) => {
      e.stopPropagation();
      TutorialManager.showSkipConfirmation();
    };
    document.body.appendChild(skipBtn);
    this.skipBtn = skipBtn;
  },

  showDialogue(text, position = "center", prompt = "Tap to continue") {
    const dialogue = this.dialogueElement;
    dialogue.className = "tutorial-dialogue " + position;
    dialogue.querySelector(".dialogue-text").textContent = text;
    dialogue.querySelector(".dialogue-prompt").textContent = prompt;
    dialogue.classList.add("visible");
  },

  hideDialogue() {
    this.dialogueElement?.classList.remove("visible");
  },

  addHighlight(selector) {
    const target = document.querySelector(selector);
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const padding = 8;

    const highlight = document.createElement("div");
    highlight.className = "tutorial-highlight";
    highlight.style.left = rect.left - padding + "px";
    highlight.style.top = rect.top - padding + "px";
    highlight.style.width = rect.width + padding * 2 + "px";
    highlight.style.height = rect.height + padding * 2 + "px";

    document.body.appendChild(highlight);
    this.highlightElements.push(highlight);
  },

  addDragHighlight(selector) {
    const target = document.querySelector(selector);
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const padding = 8;

    const highlight = document.createElement("div");
    highlight.className = "tutorial-drag-highlight";
    highlight.style.left = rect.left - padding + "px";
    highlight.style.top = rect.top - padding + "px";
    highlight.style.width = rect.width + padding * 2 + "px";
    highlight.style.height = rect.height + padding * 2 + "px";

    document.body.appendChild(highlight);
    this.highlightElements.push(highlight);
  },

  clearHighlights() {
    // First, remove all tracked highlight elements
    this.highlightElements.forEach((el) => {
      try { el.remove(); } catch(e) {}
    });
    this.highlightElements = [];
    
    // Then aggressively find and remove ANY tutorial highlight elements in the DOM
    // This catches orphaned elements from race conditions
    document.querySelectorAll(".tutorial-highlight").forEach((el) => {
      try { el.remove(); } catch(e) {}
    });
    document.querySelectorAll(".tutorial-drag-highlight").forEach((el) => {
      try { el.remove(); } catch(e) {}
    });
    
    // Also remove glow classes from any elements
    document.querySelectorAll(".tutorial-glow").forEach((el) => el.classList.remove("tutorial-glow"));
    document.querySelectorAll(".tutorial-drag-glow").forEach((el) => el.classList.remove("tutorial-drag-glow"));
  },
  
  // Clear ALL tutorial state - used when transitioning between steps
  clearAllState() {
    // Cancel any pending delayed content
    if (TutorialManager.pendingStepTimeout) {
      clearTimeout(TutorialManager.pendingStepTimeout);
      TutorialManager.pendingStepTimeout = null;
    }
    
    this.clearHighlights();
    this.clearDragGlow();
    
    // Clear card blocking
    this.currentAllowedCardType = null;
    document.querySelectorAll(".tutorial-card-blocked").forEach((el) => {
      el.classList.remove("tutorial-card-blocked");
    });
  },

  addGlow(selector) {
    const targets = document.querySelectorAll(selector);
    targets.forEach((target) => {
      target.classList.add("tutorial-glow");
    });
  },

  addDragGlow(selector) {
    const targets = document.querySelectorAll(selector);
    targets.forEach((target) => {
      target.classList.add("tutorial-drag-glow");
    });
  },

  clearDragGlow() {
    document.querySelectorAll(".tutorial-drag-glow").forEach((el) => el.classList.remove("tutorial-drag-glow"));
  },

  blockAllCards() {
    this.currentAllowedCardType = "__NONE__";
    requestAnimationFrame(() => this.applyCardBlocking());
  },

  blockWrongCards(allowedType) {
    if (!allowedType) {
      this.blockAllCards();
      return;
    }
    this.currentAllowedCardType = allowedType;
    requestAnimationFrame(() => this.applyCardBlocking());
  },

  applyCardBlocking() {
    const allowedType = this.currentAllowedCardType;
    if (!allowedType) return;

    const cardWrappers = document.querySelectorAll("#hand-container .card-wrapper");
    let allowedCount = 0, blockedCount = 0;

    cardWrappers.forEach((wrapper) => {
      const cardEl = wrapper.querySelector(".game-card");
      if (!cardEl) return;

      if (allowedType === "__NONE__") {
        wrapper.classList.add("tutorial-card-blocked");
        cardEl.classList.add("tutorial-card-blocked");
        blockedCount++;
        return;
      }

      let cardType = null;
      if (cardEl.classList.contains("pyre-card")) cardType = "pyre";
      else if (cardEl.classList.contains("aura-card")) cardType = "aura";
      else if (cardEl.classList.contains("trap-card")) cardType = "trap";
      else if (cardEl.classList.contains("burst-card")) cardType = "burst";
      else if (cardEl.classList.contains("kindling-card")) cardType = "kindling";
      else if (cardEl.classList.contains("cryptid-card")) cardType = "cryptid";

      let isAllowed = false;
      if (allowedType === cardType) isAllowed = true;
      else if (allowedType === "cryptid" && (cardType === "kindling" || cardType === "cryptid")) isAllowed = true;
      else if (allowedType === "kindling" && (cardType === "kindling" || cardType === "cryptid")) isAllowed = true;

      if (!isAllowed && cardType !== null) {
        wrapper.classList.add("tutorial-card-blocked");
        cardEl.classList.add("tutorial-card-blocked");
        cardEl.classList.remove("tutorial-card-allowed");
        blockedCount++;
      } else {
        wrapper.classList.remove("tutorial-card-blocked");
        cardEl.classList.remove("tutorial-card-blocked");
        cardEl.classList.remove("unplayable");
        cardEl.classList.add("tutorial-card-allowed");
        allowedCount++;
      }
    });
  },

  unblockAllCards() {
    document.querySelectorAll(".tutorial-card-blocked").forEach((el) => el.classList.remove("tutorial-card-blocked"));
    document.querySelectorAll(".tutorial-card-allowed").forEach((el) => el.classList.remove("tutorial-card-allowed"));
    this.currentAllowedCardType = null;
  },

  destroy() {
    this.clearHighlights();
    this.unblockAllCards();
    if (this.handObserver) {
      this.handObserver.disconnect();
      this.handObserver = null;
    }
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      window.removeEventListener('orientationchange', this.resizeHandler);
      this.resizeHandler = null;
    }
    clearTimeout(this.blockingDebounce);
    this.dialogueElement?.remove();
    this.skipBtn?.remove();
    document.getElementById("tutorial-styles")?.remove();
    this.dialogueElement = null;
    this.stylesInjected = false;
    this.currentAllowedCardType = null;
    this.currentStep = null;
  },
};

// ==================== TUTORIAL BATTLE ====================
const TutorialBattle = {
  setPlayerKindling(cardKeys) {
    if (!window.game) return;
    const kindling = [];
    let id = 9000;
    cardKeys.forEach((key) => {
      const cardData = CardRegistry.getKindling(key);
      if (cardData) {
        kindling.push({ ...cardData, key, id: id++, owner: "player" });
      }
    });
    game.playerKindling = kindling;
    console.log("[TutorialBattle] Set kindling:", kindling.map((k) => k.name));
  },

  setPlayerHand(cardKeys) {
    if (!window.game) return;
    const hand = [];
    let id = 9100;
    cardKeys.forEach((key) => {
      const cardData =
        CardRegistry.getPyre?.(key) ||
        CardRegistry.getAura?.(key) ||
        CardRegistry.getTrap?.(key) ||
        CardRegistry.getBurst?.(key) ||
        CardRegistry.getCryptid?.(key) ||
        CardRegistry.getKindling?.(key);
      if (cardData) {
        hand.push({ ...cardData, key, id: id++, owner: "player" });
      }
    });
    game.playerHand = hand;
    console.log("[TutorialBattle] Set hand:", hand.map((c) => c.name));
    if (typeof renderHand === "function") renderHand();
  },

  // Place enemy cryptid at start of tutorial
  placeEnemyStartingCryptid() {
    if (!window.game) return;
    const config = TutorialConfig.ENEMY_STARTING_CRYPTID;
    const cardData = CardRegistry.getKindling(config.card) || CardRegistry.getCryptid(config.card);
    if (!cardData) {
      console.error("[TutorialBattle] Starting enemy card not found:", config.card);
      return;
    }

    const col = config.position.col === "combat" ? game.getCombatCol("enemy") : game.getSupportCol("enemy");
    const row = config.position.row;

    const cryptid = {
      ...cardData,
      key: config.card,
      id: config.card + "_enemy_start",
      owner: "enemy",
      col,
      row,
      currentHp: cardData.hp,
      currentAtk: cardData.atk,
      maxHp: cardData.hp,
      baseAtk: cardData.atk,
      baseHp: cardData.hp,
      atkDebuff: 0,
      isKindling: cardData.isKindling || false,
      tapped: false,
      canAttack: true, // Can attack immediately!
      savedAtk: null,
      terrified: false,
      evolvedThisTurn: false,
      justSummoned: false, // Not just summoned - ready to act
      burnTurns: 0,
      stunned: false,
      paralyzed: false,
      paralyzeTurns: 0,
      bleedTurns: 0,
      protectionCharges: 0,
      curseTokens: 0,
      latchedTo: null,
      latchedBy: null,
      auras: [],
      attackedThisTurn: false,
      restedThisTurn: false,
    };

    game.enemyField[col][row] = cryptid;
    console.log("[TutorialBattle] Placed enemy starting cryptid:", cryptid.name);

    if (typeof renderField === "function") renderField();
    if (typeof renderSprites === "function") renderSprites();
  },

  // Enemy turn 1: Attack player (trap triggers!)
  executeEnemyTurn1() {
    console.log("[TutorialBattle] Executing enemy turn 1 - attacking player");
    if (!window.game) return;

    const enemyCombatCol = game.getCombatCol("enemy");
    
    // Find the enemy cryptid - check all rows since placement might vary
    let attacker = null;
    let attackerRow = -1;
    for (let row = 0; row < 3; row++) {
      if (game.enemyField[enemyCombatCol][row]) {
        attacker = game.enemyField[enemyCombatCol][row];
        attackerRow = row;
        break;
      }
    }

    if (!attacker) {
      console.error("[TutorialBattle] No enemy attacker found in combat column", enemyCombatCol);
      console.log("[TutorialBattle] Enemy field state:", JSON.stringify(game.enemyField));
      return;
    }

    const playerCombatCol = game.getCombatCol("player");
    
    // Find the player's combatant - check all rows
    let target = null;
    let targetRow = -1;
    for (let row = 0; row < 3; row++) {
      if (game.playerField[playerCombatCol][row]) {
        target = game.playerField[playerCombatCol][row];
        targetRow = row;
        break;
      }
    }

    if (!target) {
      console.error("[TutorialBattle] No player target found in combat column", playerCombatCol);
      console.log("[TutorialBattle] Player field state:", JSON.stringify(game.playerField));
      return;
    }

    console.log("[TutorialBattle] Enemy", attacker.name, "at row", attackerRow, "attacking player", target.name, "at row", targetRow);

    // Ensure sprites are rendered
    if (typeof renderSprites === "function") renderSprites();

    // PHASE 1: Enemy targets your cryptid (1.5s)
    if (typeof showMessage === "function") {
      showMessage("🎯 Enemy targets your Stormhawk!", 1500);
    }
    
    // Highlight the target
    const targetTile = document.querySelector(`.tile[data-owner="player"][data-col="${playerCombatCol}"][data-row="${targetRow}"]`);
    if (targetTile) targetTile.classList.add("attack-target");

    // PHASE 2: Trap activates because your cryptid is being targeted (after 1.5s)
    setTimeout(() => {
      // Check for trap
      let trapTriggered = false;
      let trapRow = -1;
      const playerTraps = game.playerTraps;

      for (let i = 0; i < playerTraps.length; i++) {
        const trap = playerTraps[i];
        if (trap?.key === "terrify") {
          trapTriggered = true;
          trapRow = i;
          break;
        }
      }

      if (trapTriggered) {
        // Show trap activation message
        if (typeof showMessage === "function") {
          showMessage("⚡ TERRIFY activates! Enemy ATK reduced to 0!", 2000);
        }

        // Play trap visual effects
        const trapSprite = document.querySelector(`.trap-sprite[data-owner="player"][data-row="${trapRow}"]`);
        const trapTile = document.querySelector(`.tile.trap[data-owner="player"][data-row="${trapRow}"]`);

        if (trapSprite) trapSprite.classList.add("trap-triggering");
        if (trapTile) trapTile.classList.add("trap-activating");

        // Flash battlefield
        const battlefield = document.getElementById("battlefield-area");
        if (battlefield) {
          battlefield.classList.add("trap-flash");
          setTimeout(() => battlefield.classList.remove("trap-flash"), 400);
        }

        // Apply trap effect
        attacker.savedAtk = attacker.currentAtk;
        attacker.currentAtk = 0;
        attacker.terrified = true;
        
        GameEvents.emit("onTrapTriggered", { trap: playerTraps[trapRow], owner: "player", row: trapRow });
        playerTraps[trapRow] = null; // Consume trap
        
        // Update the visual display to show ATK is now 0 BEFORE the attack
        if (typeof renderSprites === "function") renderSprites();
        
        console.log("[TutorialBattle] Trap activated! ATK set to 0");

        // Remove trap sprite after animation
        setTimeout(() => {
          if (trapSprite) trapSprite.remove();
          if (trapTile) {
            trapTile.classList.remove("trap-activating", "has-trap");
          }
        }, 1000);
      }

      // PHASE 3: Enemy attacks (after trap animation - 2s later)
      setTimeout(() => {
        // Remove target highlight
        if (targetTile) targetTile.classList.remove("attack-target");
        
        if (typeof showMessage === "function") {
          showMessage("⚔️ Enemy attacks!", 1500);
        }

        // Get sprites for animation
        const attackerSprite = document.querySelector(
          `.cryptid-sprite[data-owner="enemy"][data-col="${enemyCombatCol}"][data-row="${attackerRow}"]`
        );
        const targetSprite = document.querySelector(
          `.cryptid-sprite[data-owner="player"][data-col="${playerCombatCol}"][data-row="${targetRow}"]`
        );
        
        console.log("[TutorialBattle] Attacker sprite found:", !!attackerSprite);
        console.log("[TutorialBattle] Target sprite found:", !!targetSprite);

        if (!attackerSprite || !targetSprite) {
          console.error("[TutorialBattle] Sprites not found - cannot animate attack");
          this.finishEnemyTurn1(attacker, target);
          return;
        }

        // Calculate damage (will be 0 due to trap)
        const damage = attacker.currentAtk;

        // Play the attack animation
        if (typeof CombatEffects !== "undefined" && CombatEffects.playAttackSequence) {
          CombatEffects.playAttackSequence(attackerSprite, targetSprite, damage, () => {
            console.log("[TutorialBattle] Attack animation complete, damage:", damage);
            
            // Apply damage after animation
            if (damage > 0) {
              target.currentHp -= damage;
            }

            // Mark attacker as having attacked
            attacker.tapped = true;
            attacker.canAttack = false;

            // PHASE 4: Quick cleanup
            if (typeof renderField === "function") renderField();
            if (typeof renderSprites === "function") renderSprites();
            console.log("[TutorialBattle] Enemy turn 1 complete");
          });
        } else {
          // Fallback without animation
          this.finishEnemyTurn1(attacker, target);
        }
      }, 2000); // Wait for trap animation
    }, 1500); // Wait for targeting message
  },
  
  // Helper to finish enemy turn 1 without animation
  finishEnemyTurn1(attacker, target) {
    const damage = attacker.currentAtk;
    if (damage > 0) {
      target.currentHp -= damage;
    }
    attacker.tapped = true;
    attacker.canAttack = false;
    
    setTimeout(() => {
      if (typeof renderField === "function") renderField();
      if (typeof renderSprites === "function") renderSprites();
    }, 500);
  },

  // Fallback function for applying trap and damage without animation
  applyTrapAndDamage(attacker, target, enemyCombatCol, attackerRow, playerCombatCol, targetRow) {
    let trapTriggered = false;
    let trapRow = -1;
    const playerTraps = game.playerTraps;

    for (let i = 0; i < playerTraps.length; i++) {
      const trap = playerTraps[i];
      if (trap?.key === "terrify") {
        trapTriggered = true;
        trapRow = i;
        break;
      }
    }

    if (trapTriggered) {
      attacker.savedAtk = attacker.currentAtk;
      attacker.currentAtk = 0;
      attacker.terrified = true;
      
      if (typeof showMessage === "function") {
        showMessage("⚡ TERRIFY activated! ⚡", 2000);
      }
      
      playerTraps[trapRow] = null;
    }

    const damage = attacker.currentAtk;
    if (damage > 0) {
      target.currentHp -= damage;
    }

    attacker.tapped = true;
    attacker.canAttack = false;

    console.log("[TutorialBattle] Attack dealt", damage, "damage (fallback)");

    if (typeof renderField === "function") renderField();
    if (typeof renderSprites === "function") renderSprites();
  },

  // Start player turn 2
  startPlayerTurn2() {
    console.log("[TutorialBattle] Starting player turn 2");
    if (!window.game) return;

    // Reset kindling played flag for new turn
    game.playerKindlingPlayedThisTurn = false;
    
    // Give player pyres (1 default + 1 from basic pyre card)
    game.playerPyre = 2;
    
    // Reset terrified enemy
    const enemyCombatCol = game.getCombatCol("enemy");
    const enemy = game.enemyField[enemyCombatCol][1];
    if (enemy && enemy.terrified) {
      enemy.currentAtk = enemy.savedAtk || enemy.baseAtk;
      enemy.terrified = false;
      enemy.savedAtk = null;
    }

    game.currentTurn = "player";
    game.phase = "conjure1";
    game.turnNumber = 2;

    if (typeof renderAll === "function") renderAll();
    if (typeof updateButtons === "function") updateButtons();
  },

  // Enemy turn 2: Summon new cryptid and attack exposed support
  executeEnemyTurn2() {
    console.log("[TutorialBattle] Executing enemy turn 2 - attacking support");
    if (!window.game) return;

    // PHASE 1: Enemy summons reinforcements (1.5s)
    if (typeof showMessage === "function") {
      showMessage("👹 Enemy summons reinforcements!", 1500);
    }

    // Summon a new enemy cryptid
    const cardData = CardRegistry.getKindling("stormhawk");
    if (cardData) {
      const col = game.getCombatCol("enemy");
      const row = 0;

      const cryptid = {
        ...cardData,
        key: "stormhawk",
        id: "stormhawk_enemy_turn2",
        owner: "enemy",
        col,
        row,
        currentHp: cardData.hp,
        currentAtk: cardData.atk,
        maxHp: cardData.hp,
        baseAtk: cardData.atk,
        baseHp: cardData.hp,
        atkDebuff: 0,
        isKindling: true,
        tapped: false,
        canAttack: true,
        savedAtk: null,
        terrified: false,
        evolvedThisTurn: false,
        justSummoned: true,
        burnTurns: 0,
        stunned: false,
        paralyzed: false,
        paralyzeTurns: 0,
        bleedTurns: 0,
        protectionCharges: 0,
        curseTokens: 0,
        latchedTo: null,
        latchedBy: null,
        auras: [],
        attackedThisTurn: false,
        restedThisTurn: false,
      };

      game.enemyField[col][row] = cryptid;
      console.log("[TutorialBattle] Enemy summoned:", cryptid.name);
    }

    if (typeof renderField === "function") renderField();
    if (typeof renderSprites === "function") renderSprites();

    // Add summon animation
    setTimeout(() => {
      const newSprite = document.querySelector(
        `.cryptid-sprite[data-owner="enemy"][data-col="${game.getCombatCol("enemy")}"][data-row="0"]`
      );
      if (newSprite) {
        // Use enhanced summon animation if available
        if (window.CombatEffects?.playSummonAnimation) {
          const element = newSprite.className.match(/element-(\w+)/)?.[1] || 'steel';
          const rarity = newSprite.className.match(/rarity-(\w+)/)?.[1] || 'common';
          window.CombatEffects.playSummonAnimation(newSprite, element, rarity);
        } else {
          newSprite.classList.add("summoning");
          setTimeout(() => newSprite.classList.remove("summoning"), 600);
        }
      }
    }, 100);

    // PHASE 2: Enemy targets your exposed support (after 2s)
    setTimeout(() => {
      const playerSupportCol = game.getSupportCol("player");
      
      // Find the support
      let support = null;
      let supportRow = -1;
      for (let row = 0; row < 3; row++) {
        if (game.playerField[playerSupportCol][row]) {
          support = game.playerField[playerSupportCol][row];
          supportRow = row;
          break;
        }
      }

      if (!support) {
        console.error("[TutorialBattle] No support found to attack");
        return;
      }

      if (typeof showMessage === "function") {
        showMessage("🎯 Your combatant is rested - support is exposed!", 1500);
      }
      
      // Highlight the exposed support
      const supportTile = document.querySelector(`.tile[data-owner="player"][data-col="${playerSupportCol}"][data-row="${supportRow}"]`);
      if (supportTile) supportTile.classList.add("attack-target");

      // PHASE 3: Enemy attacks the support (after 1.5s)
      setTimeout(() => {
        if (supportTile) supportTile.classList.remove("attack-target");
        
        if (typeof showMessage === "function") {
          showMessage("⚔️ Enemy attacks your support!", 1500);
        }

        const enemyCombatCol = game.getCombatCol("enemy");
        const attacker = game.enemyField[enemyCombatCol][0];

        if (!attacker) {
          console.error("[TutorialBattle] No attacker found");
          return;
        }

        const attackerSprite = document.querySelector(
          `.cryptid-sprite[data-owner="enemy"][data-col="${enemyCombatCol}"][data-row="0"]`
        );
        const targetSprite = document.querySelector(
          `.cryptid-sprite[data-owner="player"][data-col="${playerSupportCol}"][data-row="${supportRow}"]`
        );

        console.log("[TutorialBattle] Attack on support - attacker:", !!attackerSprite, "target:", !!targetSprite);

        const damage = attacker.currentAtk;

        if (attackerSprite && targetSprite && typeof CombatEffects !== "undefined" && CombatEffects.playAttackSequence) {
          CombatEffects.playAttackSequence(attackerSprite, targetSprite, damage, () => {
            console.log("[TutorialBattle] Support attack animation complete, damage:", damage);
            
            support.currentHp -= damage;
            attacker.tapped = true;
            attacker.canAttack = false;

            // Check for death
            if (support.currentHp <= 0) {
              const deathSprite = document.querySelector(
                `.cryptid-sprite[data-owner="player"][data-col="${playerSupportCol}"][data-row="${supportRow}"]`
              );
              if (deathSprite) {
                deathSprite.classList.add("dying-left");
              }

              setTimeout(() => {
                game.playerField[playerSupportCol][supportRow] = null;
                game.playerDeaths++;
                console.log("[TutorialBattle] Support killed!");

                // Quick cleanup
                if (typeof renderField === "function") renderField();
                if (typeof renderSprites === "function") renderSprites();
                if (typeof renderHUD === "function") renderHUD();
                console.log("[TutorialBattle] Enemy turn 2 complete");
              }, 600);
            } else {
              setTimeout(() => {
                if (typeof renderField === "function") renderField();
                if (typeof renderSprites === "function") renderSprites();
                if (typeof renderHUD === "function") renderHUD();
              }, 500);
            }
          });
        } else {
          // Fallback without animation
          support.currentHp -= damage;
          attacker.tapped = true;
          attacker.canAttack = false;
          if (support.currentHp <= 0) {
            game.playerField[playerSupportCol][supportRow] = null;
            game.playerDeaths++;
          }
          if (typeof renderField === "function") renderField();
          if (typeof renderSprites === "function") renderSprites();
          if (typeof renderHUD === "function") renderHUD();
        }
      }, 1500); // Wait for targeting message
    }, 2000); // Wait for summon animation
  },

  // Legacy function for compatibility
  executeEnemyTurn() {
    this.executeEnemyTurn1();
  },

  enemySummon(cardKey, position) {
    console.log("[TutorialBattle] Enemy summoning:", cardKey);
    if (!window.game) return;

    const cardData = CardRegistry.getKindling(cardKey) || CardRegistry.getCryptid(cardKey);
    if (!cardData) {
      console.error("[TutorialBattle] Card not found:", cardKey);
      return;
    }

    const col = position.col === "combat" ? game.getCombatCol("enemy") : game.getSupportCol("enemy");
    const row = position.row;

    const cryptid = {
      ...cardData,
      key: cardKey,
      id: cardKey + "_enemy_" + Date.now(),
      owner: "enemy",
      col,
      row,
      currentHp: cardData.hp,
      currentAtk: cardData.atk,
      maxHp: cardData.hp,
      baseAtk: cardData.atk,
      baseHp: cardData.hp,
      atkDebuff: 0,
      isKindling: cardData.isKindling || false,
      tapped: false,
      canAttack: true,
      savedAtk: null,
      terrified: false,
      evolvedThisTurn: false,
      justSummoned: true,
      burnTurns: 0,
      stunned: false,
      paralyzed: false,
      paralyzeTurns: 0,
      bleedTurns: 0,
      protectionCharges: 0,
      curseTokens: 0,
      latchedTo: null,
      latchedBy: null,
      auras: [],
      attackedThisTurn: false,
      restedThisTurn: false,
    };

    game.enemyField[col][row] = cryptid;

    if (typeof renderField === "function") renderField();
    if (typeof renderSprites === "function") renderSprites();
    if (cryptid.onSummon) cryptid.onSummon(cryptid, "enemy", game);

    GameEvents.emit("onSummon", { cryptid, owner: "enemy" });
    console.log("[TutorialBattle] Enemy summoned:", cryptid.name);
  },

  endEnemyTurn() {
    console.log("[TutorialBattle] Ending enemy turn");
    if (!window.game) return;
    game.startTurn("player");
    if (typeof renderAll === "function") renderAll();
    if (typeof updateButtons === "function") updateButtons();
  },
};

// ==================== TUTORIAL MANAGER ====================
const TutorialManager = {
  isActive: false,
  freePlayMode: false,
  currentStepIndex: 0,
  clickBlocker: null,
  actionCleanup: null,
  dragHandler: null,
  
  // Tutorial restrictions
  restrictAuraToCombat: false,  // When true, auras can only target combat column
  restrictSummonToSupport: false, // When true, summons can only go to support column
  blockAdvance: false, // When true, clicking won't advance to the next step (for enemy turns)
  
  async start() {
    console.log("[TutorialManager] Starting tutorial...");

    this.isActive = true;
    this.freePlayMode = false;
    this.currentStepIndex = 0;
    this.lastAdvanceTime = 0;

    // Add class to body to enable tutorial-specific styles
    document.body.classList.add("tutorial-active");

    TutorialOverlay.init();

    await this.initGame();

    this.setupClickBlocker();
    this.setupDragHandler();
    this.installGameHooks();

    this.showStep(0);
  },
  
  // Install hooks to override game behavior during tutorial
  installGameHooks() {
    // Override getValidAuraTargets to respect tutorial restrictions
    if (window.game && !window.game._originalGetValidAuraTargets) {
      window.game._originalGetValidAuraTargets = window.game.getValidAuraTargets.bind(window.game);
      
      window.game.getValidAuraTargets = (owner) => {
        const targets = window.game._originalGetValidAuraTargets(owner);
        
        // If tutorial is active and restricting aura to combat, filter targets
        if (TutorialManager.isActive && TutorialManager.restrictAuraToCombat && owner === 'player') {
          const combatCol = window.game.getCombatCol('player');
          console.log("[Tutorial] Filtering aura targets to combat column only");
          return targets.filter(t => t.col === combatCol);
        }
        
        return targets;
      };
    }
    
    // Override getValidSummonSlots to respect tutorial restrictions
    if (window.game && !window.game._originalGetValidSummonSlots) {
      window.game._originalGetValidSummonSlots = window.game.getValidSummonSlots.bind(window.game);
      
      window.game.getValidSummonSlots = (owner) => {
        const slots = window.game._originalGetValidSummonSlots(owner);
        
        // If tutorial is active and restricting summon to support, filter slots
        if (TutorialManager.isActive && TutorialManager.restrictSummonToSupport && owner === 'player') {
          const supportCol = window.game.getSupportCol('player');
          console.log("[Tutorial] Filtering summon slots to support column only");
          return slots.filter(s => s.col === supportCol);
        }
        
        return slots;
      };
    }
  },
  
  // Remove hooks when tutorial ends
  removeGameHooks() {
    if (window.game?._originalGetValidAuraTargets) {
      window.game.getValidAuraTargets = window.game._originalGetValidAuraTargets;
      delete window.game._originalGetValidAuraTargets;
    }
    if (window.game?._originalGetValidSummonSlots) {
      window.game.getValidSummonSlots = window.game._originalGetValidSummonSlots;
      delete window.game._originalGetValidSummonSlots;
    }
  },

  async initGame() {
    console.log("[TutorialManager] Initializing game...");

    // Hide all other screens instantly (no CSS transitions)
    ["main-menu", "home-screen", "login-screen", "loading-screen", "fullscreen-prompt"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.style.transition = "none";
        el.style.display = "none";
        el.classList.add("hidden");
      }
    });

    // Show game container instantly
    const gameContainer = document.getElementById("game-container");
    if (gameContainer) {
      gameContainer.style.transition = "none";
      gameContainer.classList.remove("hidden");
      gameContainer.style.cssText = "display: flex !important; visibility: visible !important; opacity: 1 !important;";
    }

    window.playerGoesFirst = true;
    window.isTutorial = true;

    window.selectedPlayerDeck = {
      name: "Tutorial Deck",
      series: "forests-of-fear",
      cards: [
        { key: "pyre", count: 4 },
        { key: "terrify", count: 2 },
        { key: "dauntingPresence", count: 2 },
        { key: "rockSlide", count: 2 },
        { key: "stormhawk", count: 10 },
      ],
    };

    if (typeof window.initGame === "function") {
      window.initGame();
    }

    await new Promise((r) => setTimeout(r, 300));

    if (window.game) {
      TutorialBattle.setPlayerKindling(TutorialConfig.PLAYER_STARTING_KINDLING);
      TutorialBattle.setPlayerHand(TutorialConfig.PLAYER_STARTING_HAND);
      TutorialBattle.placeEnemyStartingCryptid();

      if (typeof renderHand === "function") renderHand();
      if (typeof renderAll === "function") renderAll();
    }

    console.log("[TutorialManager] Game initialized");
  },

  setupClickBlocker() {
    this.clickBlocker = (e) => {
      if (!this.isActive) return;

      const step = TutorialSteps[this.currentStepIndex];
      if (!step) return;

      // Skip button always allowed
      if (e.target.closest(".tutorial-skip-btn")) return;

      // Hide any tooltips when clicking during tutorial
      if (e.type === "click" || e.type === "touchend") {
        const tooltip = document.getElementById("tooltip");
        if (tooltip) tooltip.classList.remove("show");
      }
      
      // Always allow closing the card detail modal
      if (e.target.closest("#battle-card-detail-modal") || e.target.closest(".battle-detail-backdrop") || e.target.closest("#card-detail-close-btn")) {
        return; // Let card detail handle its own close events
      }
      
      // Block ALL card interactions during enemy turn
      if (window.game?.currentTurn === 'enemy') {
        const isCardInteraction = e.target.closest(".game-card") || e.target.closest(".card-wrapper") || e.target.closest("#hand-container");
        if (isCardInteraction) {
          console.log("[Tutorial] Blocking card interaction during enemy turn");
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }

      // For "tap" advance steps, allow clicking ANYWHERE (except skip button)
      // This is the most permissive - handle it first
      if (step.advance === "tap" && (e.type === "click" || e.type === "touchend")) {
        // Block advancing during enemy turns or when explicitly blocked
        if (this.blockAdvance) {
          console.log("[Tutorial] Advance blocked - enemy turn in progress");
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        
        // Debounce rapid clicks - increased to 400ms to prevent race conditions
        if (this.lastAdvanceTime && Date.now() - this.lastAdvanceTime < 400) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        this.lastAdvanceTime = Date.now();
        e.preventDefault();
        e.stopPropagation();
        
        // Clear any pending delayed content before advancing
        if (this.pendingStepTimeout) {
          clearTimeout(this.pendingStepTimeout);
          this.pendingStepTimeout = null;
        }
        
        // Also clear any lingering highlights before advancing
        TutorialOverlay.clearAllState();
        
        this.nextStep();
        return;
      }
      
      // For narrative steps, also allow tapping anywhere
      if (step.type === "narrative" && (e.type === "click" || e.type === "touchend")) {
        // Block advancing during enemy turns
        if (this.blockAdvance) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        
        if (this.lastAdvanceTime && Date.now() - this.lastAdvanceTime < 400) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        this.lastAdvanceTime = Date.now();
        e.preventDefault();
        e.stopPropagation();
        TutorialOverlay.clearAllState();
        this.nextStep();
        return;
      }

      // Block clicks on blocked cards
      const blockedCard = e.target.closest(".tutorial-card-blocked");
      if (blockedCard) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      
      // ALWAYS block the phase button unless explicitly allowed in this step
      const phaseButton = e.target.closest("#advance-phase-btn");
      if (phaseButton) {
        const isPhaseAllowed = step.allowedElements?.includes("#advance-phase-btn");
        if (!isPhaseAllowed) {
          console.log("[Tutorial] Blocking phase button - not allowed in this step");
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }

      // Show drag glow targets when starting to drag a card
      if ((e.type === "mousedown" || e.type === "touchstart") && step.dragGlowTargets) {
        const card = e.target.closest(".game-card");
        if (card && !card.classList.contains("tutorial-card-blocked")) {
          step.dragGlowTargets.forEach((sel) => TutorialOverlay.addDragGlow(sel));
        }
      }

      // For action steps, only allow clicks on specified elements
      // But only block if we're definitely on an action step (double-check)
      if (step.advance === "action" && step.allowedElements && step.requiredAction) {
        const isAllowed = step.allowedElements.some((selector) => e.target.closest(selector));
        if (!isAllowed) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    this.dragEndHandler = () => {
      document.querySelectorAll(".tutorial-drag-highlight").forEach((el) => el.remove());
    };

    document.addEventListener("mousedown", this.clickBlocker, true);
    document.addEventListener("touchstart", this.clickBlocker, true);
    document.addEventListener("click", this.clickBlocker, true);
    document.addEventListener("touchend", this.clickBlocker, true);
    document.addEventListener("mouseup", this.dragEndHandler, true);
    document.addEventListener("touchend", this.dragEndHandler, true);
  },

  setupDragHandler() {},

  showStep(index) {
    // Cancel any pending delayed content from previous step
    if (this.pendingStepTimeout) {
      clearTimeout(this.pendingStepTimeout);
      this.pendingStepTimeout = null;
    }
    
    if (this.actionCleanup) {
      this.actionCleanup();
      this.actionCleanup = null;
    }

    if (index >= TutorialSteps.length) {
      this.complete();
      return;
    }

    // Store the step index we're showing - used to validate delayed content
    const stepIndex = index;
    this.currentStepIndex = index;
    const step = TutorialSteps[index];

    console.log("[TutorialManager] Step", index + 1, ":", step.id);

    // Clear ALL state from previous step
    TutorialOverlay.clearAllState();

    if (step.onShow) step.onShow();

    // If there's a delay, hide the dialogue during the delay so animations are visible
    if (step.delay) {
      TutorialOverlay.hideDialogue();
    }

    const showStepContent = () => {
      // IMPORTANT: Check if we're still on the same step - user might have clicked fast
      if (this.currentStepIndex !== stepIndex) {
        console.log("[TutorialManager] Skipping delayed content for step", stepIndex, "- now on step", this.currentStepIndex);
        return;
      }
      
      // Track current step for resize repositioning
      TutorialOverlay.currentStep = step;
      
      if (step.highlights) {
        step.highlights.forEach((sel) => TutorialOverlay.addHighlight(sel));
      }

      if (step.glowTargets) {
        step.glowTargets.forEach((sel) => TutorialOverlay.addGlow(sel));
      }

      if (step.dragGlowTargets) {
        step.dragGlowTargets.forEach((sel) => TutorialOverlay.addDragGlow(sel));
      }

      if (step.allowedCardType) {
        TutorialOverlay.blockWrongCards(step.allowedCardType);
      } else {
        TutorialOverlay.blockAllCards();
      }

      const position = step.position || "center";
      const prompt = step.advance === "action" ? "Complete the action" : "Tap to continue";
      TutorialOverlay.showDialogue(step.text, position, prompt);

      if (step.advance === "action") {
        this.waitForAction(step);
      }
    };

    if (step.delay) {
      this.pendingStepTimeout = setTimeout(showStepContent, step.delay);
    } else {
      showStepContent();
    }
  },

  nextStep() {
    // Clear any lingering state before advancing
    TutorialOverlay.clearAllState();
    this.showStep(this.currentStepIndex + 1);
  },

  waitForAction(step) {
    const action = step.requiredAction;
    let handled = false;

    console.log("[TutorialManager] Waiting for:", action);

    if (action.type === "openMenu") {
      const btn = document.getElementById("hand-menu-btn");
      const handler = () => {
        if (handled) return;
        handled = true;
        btn?.removeEventListener("click", handler);
        setTimeout(() => this.nextStep(), 300);
      };
      btn?.addEventListener("click", handler);
      this.actionCleanup = () => btn?.removeEventListener("click", handler);
      return;
    }

    if (action.type === "switchKindling") {
      const btn = document.getElementById("menu-kindling-btn");
      const menuPanel = document.getElementById("hand-menu-panel");
      const menuBtn = document.getElementById("hand-menu-btn");
      const initialState = ui?.showingKindling || false;
      const targetState = !initialState;

      const handler = () => {
        if (handled) return;
        handled = true;
        menuPanel?.classList.remove("open");
        menuBtn?.classList.remove("menu-open");

        let attempts = 0;
        const checkState = () => {
          attempts++;
          if (ui?.showingKindling === targetState || attempts >= 20) {
            btn?.removeEventListener("click", handler);
            setTimeout(() => this.nextStep(), 100);
          } else {
            setTimeout(checkState, 50);
          }
        };
        setTimeout(checkState, 350);
      };

      btn?.addEventListener("click", handler);
      this.actionCleanup = () => btn?.removeEventListener("click", handler);
      return;
    }

    if (action.type === "advancePhase") {
      const btn = document.getElementById("advance-phase-btn");
      const handler = (e) => {
        if (handled) return;
        handled = true;
        
        // Stop propagation to prevent the main game handler from also firing
        // This prevents double phase advances
        e.stopImmediatePropagation();
        
        btn?.removeEventListener("click", handler, true);

        // Actually advance the game phase
        if (window.game) {
          const oldPhase = game.phase;
          if (game.phase === "conjure1") {
            game.phase = "combat";
          } else if (game.phase === "combat") {
            game.phase = "conjure2";
          }
          console.log("[Tutorial] Phase advanced:", oldPhase, "→", game.phase);
          
          // Emit event for listeners
          GameEvents.emit("onPhaseChange", { oldPhase, newPhase: game.phase });
          
          // Update all UI
          if (typeof updatePhaseTimeline === "function") updatePhaseTimeline(game.phase);
          if (typeof renderHUD === "function") renderHUD();
          if (typeof updateButtons === "function") updateButtons();
        }

        setTimeout(() => this.nextStep(), 400);
      };
      // Use capture phase to ensure we get the event first
      btn?.addEventListener("click", handler, true);
      this.actionCleanup = () => btn?.removeEventListener("click", handler, true);
      return;
    }

    if (action.type === "endTurn") {
      const btn = document.getElementById("advance-phase-btn");
      const handler = (e) => {
        if (handled) return;
        handled = true;
        
        // Stop propagation to prevent the main game handler from also firing
        e.stopImmediatePropagation();
        
        btn?.removeEventListener("click", handler, true);

        // Actually end the turn - transition to enemy turn, then back to player
        if (window.game) {
          console.log("[Tutorial] Ending player turn");
          // Set phase to end/enemy turn state
          game.phase = "conjure1";
          game.currentTurn = "enemy";
          
          // Emit events for listeners
          GameEvents.emit("onPhaseChange", { oldPhase: "conjure2", newPhase: "conjure1" });
          GameEvents.emit("onTurnEnd", { owner: "player" });
          
          // Update all UI
          if (typeof updatePhaseTimeline === "function") updatePhaseTimeline(game.phase);
          if (typeof renderHUD === "function") renderHUD();
          if (typeof updateButtons === "function") updateButtons();
        }

        setTimeout(() => this.nextStep(), 400);
      };
      // Use capture phase to ensure we get the event first
      btn?.addEventListener("click", handler, true);
      this.actionCleanup = () => btn?.removeEventListener("click", handler, true);
      return;
    }

    if (action.type === "attack") {
      const eventHandler = (data) => {
        if (handled) return;
        if (data.attackerOwner === "player") {
          handled = true;
          cleanup();
          setTimeout(() => this.nextStep(), 800);
        }
      };
      GameEvents.on("onAttackComplete", eventHandler);
      GameEvents.on("onCryptidKilled", eventHandler);
      const cleanup = () => {
        GameEvents.off("onAttackComplete", eventHandler);
        GameEvents.off("onCryptidKilled", eventHandler);
      };
      this.actionCleanup = cleanup;
      return;
    }

    // Event-based actions
    const eventHandler = (data) => {
      if (handled) return;
      let matched = false;

      if (action.type === "playPyre" && (data.card?.type === "pyre" || data.type === "pyre")) {
        matched = true;
      }
      if (action.type === "playAura" && (data.card?.type === "aura" || data.aura?.type === "aura" || data.aura)) {
        // Check if we require a specific target column
        if (action.targetCol && data.cryptid) {
          const targetCombatCol = game.getCombatCol(data.owner || "player");
          const targetSupportCol = game.getSupportCol(data.owner || "player");
          if (action.targetCol === "combat" && data.cryptid.col === targetCombatCol) {
            matched = true;
          } else if (action.targetCol === "support" && data.cryptid.col === targetSupportCol) {
            matched = true;
          }
          // If targetCol specified but doesn't match, don't count it
        } else {
          matched = true;
        }
      }
      if (action.type === "playTrap" && (data.card?.type === "trap" || data.trap?.type === "trap")) {
        matched = true;
      }
      if (action.type === "playBurst" && (data.card?.type === "burst" || data.burst?.type === "burst")) {
        matched = true;
      }
      if (action.type === "summon") {
        if (data.cryptid && data.owner === "player") {
          if (!action.position || 
              (action.position === "combat" && !data.isSupport) ||
              (action.position === "support" && data.isSupport)) {
            matched = true;
          }
        }
      }

      if (matched) {
        handled = true;
        console.log("[TutorialManager] Action completed:", action.type);
        cleanup();
        setTimeout(() => this.nextStep(), 400);
      }
    };

    GameEvents.on("onPyreCardPlayed", eventHandler);
    GameEvents.on("onSummon", eventHandler);
    GameEvents.on("onAuraApplied", eventHandler);
    GameEvents.on("onTrapSet", eventHandler);
    GameEvents.on("onBurstPlayed", eventHandler);

    const cleanup = () => {
      GameEvents.off("onPyreCardPlayed", eventHandler);
      GameEvents.off("onSummon", eventHandler);
      GameEvents.off("onAuraApplied", eventHandler);
      GameEvents.off("onTrapSet", eventHandler);
      GameEvents.off("onBurstPlayed", eventHandler);
    };

    this.actionCleanup = cleanup;
  },

  showSkipConfirmation() {
    const confirmed = confirm(
      "Are you sure you want to skip the tutorial?\n\n" +
      "The tutorial teaches you the basics of Cryptid Fates. " +
      "You can always replay it later from the main menu."
    );
    if (confirmed) this.skip();
  },

  skip() {
    this.complete();
  },

  complete() {
    console.log("[TutorialManager] Tutorial complete");
    this.isActive = false;

    // Remove tutorial-active class from body
    document.body.classList.remove("tutorial-active");
    
    // Remove game hooks
    this.removeGameHooks();
    
    // Reset any tutorial restrictions
    this.restrictAuraToCombat = false;
    this.restrictSummonToSupport = false;
    this.blockAdvance = false;

    if (this.clickBlocker) {
      document.removeEventListener("mousedown", this.clickBlocker, true);
      document.removeEventListener("touchstart", this.clickBlocker, true);
      document.removeEventListener("click", this.clickBlocker, true);
      document.removeEventListener("touchend", this.clickBlocker, true);
    }
    if (this.dragEndHandler) {
      document.removeEventListener("mouseup", this.dragEndHandler, true);
      document.removeEventListener("touchend", this.dragEndHandler, true);
    }
    if (this.actionCleanup) this.actionCleanup();

    TutorialOverlay.destroy();
    this.cleanupBattleScreen();

    // Check if this is the first tutorial completion (rewards not yet claimed)
    const rewardsClaimed = localStorage.getItem("cryptid_tutorial_rewards_claimed") === "true";
    
    if (!rewardsClaimed) {
      // First time - show rewards screen with starter deck selection
      TutorialRewards.show();
    } else {
      // Already claimed rewards - go directly to home screen
      localStorage.setItem("cryptid_tutorial_complete", "true");
      this.goToHomeScreen();
    }
  },
  
  goToHomeScreen() {
    TransitionEngine.fade(() => {
      if (typeof HomeScreen !== "undefined") {
        const homeScreenEl = document.getElementById("home-screen");
        if (!homeScreenEl) {
          console.log("[TutorialManager] Initializing HomeScreen for first time");
          HomeScreen.init();
        } else {
          HomeScreen.open();
        }
      } else if (typeof MainMenu !== "undefined" && MainMenu.show) {
        MainMenu.show();
      }
    });
  },

  cleanupBattleScreen() {
    console.log("[TutorialManager] Cleaning up battle screen");

    const gameContainer = document.getElementById("game-container");
    if (gameContainer) {
      gameContainer.style.display = "none";
      gameContainer.classList.add("hidden");
    }

    if (window.game) window.game = null;
    if (window.isAnimating) window.isAnimating = false;
    if (window.ui) {
      window.ui.selectedCard = null;
      window.ui.attackingCryptid = null;
      window.ui.draggedCard = null;
      window.ui.dragGhost = null;
      window.ui.showingKindling = false;
    }
  },

  isCompleted() {
    return localStorage.getItem("cryptid_tutorial_complete") === "true";
  },
};

// ==================== TUTORIAL REWARDS SCREEN ====================
const TutorialRewards = {
  screenElement: null,
  selectedDeck: null,
  
  show() {
    console.log("[TutorialRewards] Showing rewards screen");
    this.injectStyles();
    this.createScreen();
    this.animateIn();
  },
  
  injectStyles() {
    if (document.getElementById("tutorial-rewards-styles")) return;
    
    const style = document.createElement("style");
    style.id = "tutorial-rewards-styles";
    style.textContent = `
      .tutorial-rewards-screen {
        position: fixed;
        inset: 0;
        background: radial-gradient(ellipse at center, #1a1520 0%, #0d0a10 60%, #050308 100%);
        z-index: 20000;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: min(3vh, 20px) min(3vw, 20px);
        opacity: 0;
        transition: opacity 0.8s ease;
        overflow: hidden;
        box-sizing: border-box;
      }
      .tutorial-rewards-screen.visible { opacity: 1; }
      
      .rewards-content {
        width: 100%;
        max-width: min(1000px, 95vw);
        height: 100%;
        max-height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: min(2vh, 16px);
        box-sizing: border-box;
      }
      
      /* Celebration Header */
      .rewards-header {
        text-align: center;
        opacity: 0;
        transform: translateY(-20px);
        transition: all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
        flex-shrink: 0;
      }
      .rewards-header.show {
        opacity: 1;
        transform: translateY(0);
      }
      
      .rewards-title {
        font-family: 'Cinzel Decorative', serif;
        font-size: min(5vw, 32px);
        background: linear-gradient(135deg, #ffd700, #f0c040, #ffe066, #ffd700);
        background-size: 200% 200%;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        animation: goldShimmer 3s ease infinite;
        text-shadow: 0 0 30px rgba(255, 215, 0, 0.3);
        margin-bottom: min(1vh, 8px);
      }
      @keyframes goldShimmer {
        0%, 100% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
      }
      
      .rewards-subtitle {
        font-family: 'EB Garamond', Georgia, serif;
        font-size: min(2.5vw, 14px);
        color: rgba(220, 210, 190, 0.8);
        letter-spacing: 1px;
      }
      
      /* Rewards Display - Horizontal layout */
      .rewards-container {
        display: flex;
        gap: min(3vw, 20px);
        justify-content: center;
        flex-shrink: 0;
      }
      
      .reward-item {
        background: linear-gradient(145deg, rgba(50, 45, 60, 0.9), rgba(30, 25, 40, 0.95));
        border: 2px solid rgba(255, 215, 0, 0.3);
        border-radius: min(2vw, 12px);
        padding: min(2vh, 16px) min(3vw, 24px);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: min(1vh, 8px);
        opacity: 0;
        transform: scale(0.8) translateY(20px);
        transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
        position: relative;
        overflow: hidden;
      }
      .reward-item::before {
        content: '';
        position: absolute;
        inset: -50%;
        background: conic-gradient(from 0deg, transparent, rgba(255, 215, 0, 0.1), transparent);
        animation: rewardSpin 4s linear infinite;
      }
      @keyframes rewardSpin {
        to { transform: rotate(360deg); }
      }
      .reward-item.show {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
      
      .reward-icon {
        font-size: min(8vh, 48px);
        filter: drop-shadow(0 4px 12px rgba(255, 215, 0, 0.4));
        position: relative;
        z-index: 1;
        animation: iconBounce 2s ease-in-out infinite;
      }
      @keyframes iconBounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-3px); }
      }
      
      .reward-name {
        font-family: 'Cinzel', serif;
        font-size: min(2vw, 12px);
        color: #ffd700;
        text-transform: uppercase;
        letter-spacing: 1px;
        position: relative;
        z-index: 1;
      }
      
      .reward-value {
        font-family: 'EB Garamond', Georgia, serif;
        font-size: min(4vw, 24px);
        color: #fff;
        font-weight: bold;
        position: relative;
        z-index: 1;
      }
      
      /* Deck Selection */
      .deck-selection-header {
        font-family: 'Cinzel', serif;
        font-size: min(2.5vw, 16px);
        color: rgba(220, 210, 190, 0.9);
        text-transform: uppercase;
        letter-spacing: 2px;
        opacity: 0;
        transition: opacity 0.6s ease;
        flex-shrink: 0;
      }
      .deck-selection-header.show { opacity: 1; }
      
      .rewards-deck-selection {
        display: flex;
        gap: min(2vw, 16px);
        justify-content: center;
        width: 100%;
        max-width: min(900px, 95vw);
        flex: 1;
        min-height: 0;
        align-items: stretch;
      }
      
      .rewards-deck {
        flex: 1;
        max-width: min(280px, 30vw);
        min-width: min(140px, 25vw);
        background: linear-gradient(160deg, rgba(40, 35, 50, 0.95), rgba(20, 15, 30, 0.98));
        border: 2px solid rgba(140, 130, 160, 0.3);
        border-radius: min(2vw, 12px);
        padding: min(2vh, 16px) min(1.5vw, 16px);
        cursor: pointer;
        transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        opacity: 0;
        transform: translateY(30px) scale(0.9);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        position: relative;
        overflow: hidden;
        gap: min(1vh, 8px);
      }
      .rewards-deck::before {
        content: '';
        position: absolute;
        inset: 0;
        background: radial-gradient(ellipse at 50% 0%, rgba(200, 180, 220, 0.15), transparent 60%);
        opacity: 0;
        transition: opacity 0.3s ease;
      }
      .rewards-deck.show {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
      .rewards-deck:hover {
        transform: translateY(-5px) scale(1.02);
        border-color: rgba(200, 180, 220, 0.6);
        box-shadow: 0 15px 40px rgba(0, 0, 0, 0.5), 0 0 30px rgba(180, 160, 200, 0.2);
      }
      .rewards-deck:hover::before { opacity: 1; }
      
      .rewards-deck.selected {
        border-color: #ffd700;
        box-shadow: 0 0 40px rgba(255, 215, 0, 0.3), inset 0 0 20px rgba(255, 215, 0, 0.1);
        transform: translateY(-6px) scale(1.03);
      }
      .rewards-deck.selected::after {
        content: '✓';
        position: absolute;
        top: min(1.5vh, 10px);
        right: min(1.5vw, 10px);
        width: min(4vh, 28px);
        height: min(4vh, 28px);
        background: linear-gradient(135deg, #ffd700, #f0a000);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #1a1520;
        font-weight: bold;
        font-size: min(2vh, 14px);
      }
      
      .rewards-deck.disabled {
        opacity: 0.4;
        cursor: not-allowed;
        filter: grayscale(50%);
      }
      .rewards-deck.disabled:hover {
        transform: translateY(0) scale(1);
        border-color: rgba(140, 130, 160, 0.3);
        box-shadow: none;
      }
      
      .deck-icon {
        font-size: min(10vh, 56px);
        filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.5));
      }
      
      .deck-name {
        font-family: 'Cinzel Decorative', serif;
        font-size: min(2.5vw, 16px);
        color: #e0d8f0;
      }
      
      .deck-desc {
        font-family: 'EB Garamond', Georgia, serif;
        font-size: min(1.8vw, 12px);
        color: rgba(180, 170, 200, 0.8);
        line-height: 1.3;
      }
      
      .deck-theme {
        font-size: min(1.5vw, 10px);
        color: rgba(255, 215, 0, 0.7);
        text-transform: uppercase;
        letter-spacing: 1px;
        padding-top: min(1vh, 8px);
        border-top: 1px solid rgba(140, 130, 160, 0.2);
        width: 100%;
      }
      
      .deck-coming-soon {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Cinzel', serif;
        font-size: min(2vw, 12px);
        color: rgba(200, 190, 210, 0.8);
        text-transform: uppercase;
        letter-spacing: 2px;
      }
      
      /* Claim Button */
      .rewards-claim-btn {
        margin-top: min(2vh, 16px);
        padding: min(2vh, 14px) min(6vw, 48px);
        font-family: 'Cinzel', serif;
        font-size: min(2.5vw, 14px);
        text-transform: uppercase;
        letter-spacing: 2px;
        background: linear-gradient(135deg, #ffd700, #f0a000);
        color: #1a1520;
        border: none;
        border-radius: min(1.5vw, 10px);
        cursor: pointer;
        transition: all 0.3s ease;
        opacity: 0;
        transform: translateY(20px);
        box-shadow: 0 4px 20px rgba(255, 215, 0, 0.3);
        flex-shrink: 0;
      }
      .rewards-claim-btn.show {
        opacity: 1;
        transform: translateY(0);
      }
      .rewards-claim-btn:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 8px 30px rgba(255, 215, 0, 0.5);
      }
      .rewards-claim-btn:disabled {
        background: linear-gradient(135deg, #555, #444);
        color: #888;
        cursor: not-allowed;
        box-shadow: none;
      }
      
      /* Particle effects */
      .reward-particle {
        position: absolute;
        width: 6px;
        height: 6px;
        background: #ffd700;
        border-radius: 50%;
        pointer-events: none;
        animation: particleFly 2s ease-out forwards;
      }
      @keyframes particleFly {
        0% { transform: translate(0, 0) scale(1); opacity: 1; }
        100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
      }
      
      /* ==================== RESPONSIVE - CLEAN MOBILE LAYOUTS ==================== */
      
      /* LANDSCAPE MODE - Deck selection is the hero */
      @media (max-height: 500px) and (orientation: landscape) {
        .tutorial-rewards-screen {
          padding: 10px 20px;
        }
        
        .rewards-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          max-width: 100%;
          width: 100%;
          height: 100%;
        }
        
        /* Header */
        .rewards-header {
          text-align: center;
          flex-shrink: 0;
        }
        .rewards-title {
          font-size: clamp(16px, 3.5vh, 22px);
          margin-bottom: 2px;
        }
        .rewards-subtitle {
          display: none;
        }
        
        /* Rewards as small badges in top-right */
        .rewards-container {
          flex-direction: row;
          gap: 8px;
          position: absolute;
          top: 8px;
          right: 16px;
        }
        .reward-item {
          padding: 5px 10px;
          flex-direction: row;
          gap: 6px;
          min-width: auto;
          border-radius: 8px;
        }
        .reward-icon {
          font-size: clamp(16px, 3.5vh, 22px);
        }
        .reward-name {
          display: none;
        }
        .reward-value {
          font-size: clamp(11px, 2.2vh, 14px);
        }
        
        /* Deck selection header */
        .deck-selection-header {
          font-size: clamp(9px, 2vh, 11px);
          margin: 2px 0;
          flex-shrink: 0;
        }
        
        /* DECK CARDS - Content-sized, not stretched */
        .rewards-deck-selection {
          gap: clamp(10px, 2vw, 16px);
          flex-wrap: nowrap;
          align-items: stretch;
          flex-shrink: 0;
        }
        .rewards-deck {
          padding: clamp(10px, 2vh, 16px) clamp(12px, 2vw, 18px);
          gap: 4px;
          max-width: clamp(140px, 22vw, 200px);
          min-width: clamp(110px, 18vw, 160px);
          justify-content: center;
        }
        .deck-icon {
          font-size: clamp(28px, 6vh, 44px);
        }
        .deck-name {
          font-size: clamp(11px, 2.5vh, 15px);
        }
        .deck-desc {
          display: none;
        }
        .deck-theme {
          font-size: clamp(7px, 1.5vh, 9px);
          padding-top: 4px;
        }
        .rewards-deck.selected::after {
          width: clamp(18px, 4vh, 24px);
          height: clamp(18px, 4vh, 24px);
          font-size: clamp(10px, 2vh, 13px);
          top: 6px;
          right: 6px;
        }
        
        /* Claim button */
        .rewards-claim-btn {
          padding: clamp(8px, 1.8vh, 12px) clamp(28px, 6vw, 40px);
          font-size: clamp(10px, 2vh, 12px);
          margin-top: 4px;
          flex-shrink: 0;
        }
      }
      
      /* Very short landscape - ultra compact but keep all text */
      @media (max-height: 380px) and (orientation: landscape) {
        .tutorial-rewards-screen {
          padding: 6px 12px;
        }
        .rewards-content {
          gap: 4px;
        }
        .rewards-title {
          font-size: clamp(13px, 3.2vh, 18px);
        }
        .rewards-container {
          top: 5px;
          right: 12px;
          gap: 6px;
        }
        .reward-item {
          padding: 3px 7px;
        }
        .reward-icon {
          font-size: clamp(14px, 3vh, 18px);
        }
        .reward-value {
          font-size: clamp(9px, 2vh, 12px);
        }
        .deck-selection-header {
          font-size: clamp(8px, 1.8vh, 10px);
        }
        .rewards-deck {
          padding: clamp(8px, 1.8vh, 12px) clamp(10px, 1.8vw, 14px);
          gap: 3px;
        }
        .deck-icon {
          font-size: clamp(22px, 5vh, 36px);
        }
        .deck-name {
          font-size: clamp(10px, 2.2vh, 13px);
        }
        .deck-theme {
          font-size: clamp(6px, 1.3vh, 8px);
          padding-top: 3px;
        }
        .rewards-claim-btn {
          padding: clamp(6px, 1.5vh, 10px) clamp(20px, 5vw, 32px);
          font-size: clamp(9px, 1.8vh, 11px);
        }
      }
      
      /* PORTRAIT MODE - Clean vertical stack */
      @media (orientation: portrait) {
        .rewards-content {
          justify-content: center;
          gap: 16px;
        }
        
        .rewards-header {
          margin-bottom: 8px;
        }
        
        .rewards-container {
          gap: 12px;
        }
        .reward-item {
          padding: 12px 20px;
        }
        
        .rewards-deck-selection {
          flex-direction: column;
          gap: 10px;
          max-width: min(340px, 90vw);
          width: 100%;
        }
        .rewards-deck {
          max-width: 100%;
          min-width: 100%;
          flex-direction: row;
          padding: 12px 16px;
          gap: 12px;
          text-align: left;
        }
        .deck-icon {
          font-size: clamp(36px, 10vw, 48px);
          flex-shrink: 0;
        }
        .deck-name {
          font-size: clamp(14px, 4vw, 16px);
        }
        .deck-desc {
          font-size: clamp(10px, 2.5vw, 12px);
          text-align: left;
        }
        .deck-theme {
          font-size: clamp(9px, 2vw, 11px);
          border-top: none;
          padding-top: 0;
          text-align: left;
          width: auto;
        }
        .rewards-deck.selected::after {
          top: 50%;
          right: 12px;
          transform: translateY(-50%);
        }
      }
      
      /* Narrow portrait - hide descriptions */
      @media (max-width: 400px) and (orientation: portrait) {
        .rewards-title {
          font-size: clamp(20px, 6vw, 28px);
        }
        .reward-item {
          padding: 10px 16px;
        }
        .reward-icon {
          font-size: clamp(32px, 10vw, 44px);
        }
        .deck-desc {
          display: none;
        }
      }
    `;
    document.head.appendChild(style);
  },
  
  createScreen() {
    const screen = document.createElement("div");
    screen.className = "tutorial-rewards-screen";
    screen.innerHTML = `
      <div class="rewards-content">
        <div class="rewards-header">
          <h1 class="rewards-title">Tutorial Complete!</h1>
          <p class="rewards-subtitle">You've mastered the basics of Cryptid Fates</p>
        </div>
        
        <div class="rewards-container">
          <div class="reward-item" data-delay="200">
            <div class="reward-icon">🔥</div>
            <div class="reward-name">Embers</div>
            <div class="reward-value">+500</div>
          </div>
          <div class="reward-item" data-delay="400">
            <div class="reward-icon">📦</div>
            <div class="reward-name">Premium Booster</div>
            <div class="reward-value">×1</div>
          </div>
        </div>
        
        <div class="deck-selection-header">Choose Your Starter Deck</div>
        
        <div class="rewards-deck-selection">
          <div class="rewards-deck" data-deck="city-of-flesh" data-delay="600">
            <div class="deck-icon">🏚️</div>
            <div class="deck-name">City of Flesh</div>
            <div class="deck-desc">Vampires, gargoyles, and nightmares lurk in the urban shadows.</div>
            <div class="deck-theme">Blood & Steel • Status Effects</div>
          </div>
          <div class="rewards-deck" data-deck="forests-of-fear" data-delay="750">
            <div class="deck-icon">🌲</div>
            <div class="deck-name">Forests of Fear</div>
            <div class="deck-desc">Wendigos, werewolves, and ancient spirits hunger for prey.</div>
            <div class="deck-theme">Nature & Blood • Evolution</div>
          </div>
          <div class="rewards-deck disabled" data-deck="diabolical-desert" data-delay="900">
            <div class="deck-icon">🏜️</div>
            <div class="deck-name">Diabolical Desert</div>
            <div class="deck-desc">Ancient horrors rise from scorching sands and forgotten tombs.</div>
            <div class="deck-theme">Coming Soon</div>
            <div class="deck-coming-soon">Coming Soon</div>
          </div>
        </div>
        
        <button class="rewards-claim-btn" disabled>Select a Deck</button>
      </div>
    `;
    document.body.appendChild(screen);
    this.screenElement = screen;
    
    // Bind deck selection
    screen.querySelectorAll(".rewards-deck:not(.disabled)").forEach(deck => {
      deck.onclick = () => this.selectDeck(deck);
    });
    
    // Bind claim button
    screen.querySelector(".rewards-claim-btn").onclick = () => this.claimRewards();
  },
  
  animateIn() {
    // Make screen visible
    requestAnimationFrame(() => {
      this.screenElement.classList.add("visible");
    });
    
    // Animate header
    setTimeout(() => {
      this.screenElement.querySelector(".rewards-header").classList.add("show");
    }, 300);
    
    // Animate rewards
    this.screenElement.querySelectorAll(".reward-item").forEach(item => {
      const delay = parseInt(item.dataset.delay) || 0;
      setTimeout(() => {
        item.classList.add("show");
        this.createParticles(item);
      }, delay + 500);
    });
    
    // Animate deck selection header
    setTimeout(() => {
      this.screenElement.querySelector(".deck-selection-header").classList.add("show");
    }, 800);
    
    // Animate decks
    this.screenElement.querySelectorAll(".rewards-deck").forEach(deck => {
      const delay = parseInt(deck.dataset.delay) || 0;
      setTimeout(() => deck.classList.add("show"), delay + 500);
    });
    
    // Show claim button
    setTimeout(() => {
      this.screenElement.querySelector(".rewards-claim-btn").classList.add("show");
    }, 1400);
  },
  
  createParticles(container) {
    const rect = container.getBoundingClientRect();
    for (let i = 0; i < 12; i++) {
      const particle = document.createElement("div");
      particle.className = "reward-particle";
      particle.style.left = (rect.width / 2) + "px";
      particle.style.top = (rect.height / 2) + "px";
      particle.style.setProperty("--tx", (Math.random() - 0.5) * 150 + "px");
      particle.style.setProperty("--ty", (Math.random() - 0.5) * 150 + "px");
      particle.style.animationDelay = (i * 0.05) + "s";
      container.appendChild(particle);
      setTimeout(() => particle.remove(), 2000);
    }
  },
  
  selectDeck(deckElement) {
    // Remove previous selection
    this.screenElement.querySelectorAll(".rewards-deck").forEach(d => d.classList.remove("selected"));
    
    // Select new deck
    deckElement.classList.add("selected");
    this.selectedDeck = deckElement.dataset.deck;
    
    // Enable claim button
    const btn = this.screenElement.querySelector(".rewards-claim-btn");
    btn.disabled = false;
    btn.textContent = "Claim Rewards";
  },
  
  claimRewards() {
    if (!this.selectedDeck) return;
    
    const btn = this.screenElement.querySelector(".rewards-claim-btn");
    btn.disabled = true;
    btn.textContent = "Claiming...";
    
    // Grant rewards
    this.grantRewards();
    
    // Use TransitionEngine to go to home screen
    setTimeout(() => {
      TransitionEngine.fade(() => {
        // Remove rewards screen
        this.screenElement.remove();
        document.getElementById("tutorial-rewards-styles")?.remove();
        
        // Initialize and show home screen
        if (typeof HomeScreen !== "undefined") {
          const homeScreenEl = document.getElementById("home-screen");
          if (!homeScreenEl) {
            HomeScreen.init();
          } else {
            HomeScreen.open();
          }
          HomeScreen.updateDisplay?.();
          HomeScreen.isOpen = true;
        }
      });
    }, 300);
  },
  
  grantRewards() {
    console.log("[TutorialRewards] Granting rewards:", this.selectedDeck);
    
    // Grant 500 embers
    if (typeof PlayerData !== "undefined") {
      PlayerData.embers = (PlayerData.embers || 0) + 500;
      
      // Grant premium booster (add to inventory)
      PlayerData.boosters = PlayerData.boosters || {};
      PlayerData.boosters.premium = (PlayerData.boosters.premium || 0) + 1;
      
      // Mark that we've handled the welcome/starter deck flow
      PlayerData.showWelcome = false;
      
      // Grant starter deck using HomeScreen's method if available
      if (typeof HomeScreen !== "undefined" && HomeScreen.grantStarterDeck) {
        HomeScreen.grantStarterDeck(this.selectedDeck);
      } else {
        // Fallback: create deck directly
        PlayerData.starterDeck = this.selectedDeck;
        if (PlayerData.createStarterDeck) {
          PlayerData.createStarterDeck(this.selectedDeck);
        }
      }
      
      PlayerData.save();
    }
    
    // Mark rewards as claimed
    localStorage.setItem("cryptid_tutorial_rewards_claimed", "true");
    localStorage.setItem("cryptid_tutorial_complete", "true");
  }
};

// ==================== GLOBAL EXPORTS ====================
window.TutorialManager = TutorialManager;
window.TutorialBattle = TutorialBattle;
window.TutorialOverlay = TutorialOverlay;
window.TutorialRewards = TutorialRewards;

console.log("[Tutorial] Module loaded");


