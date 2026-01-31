/**
 * Cryptid Fates - ABYSS Mode
 * Top-down roguelite exploration with lantern-based fog of war
 */

// ==================== CONFIGURATION ====================

window.AbyssConfig = {
    MAP_WIDTH: 4800,
    MAP_HEIGHT: 4800,
    TILE_SIZE: 48,
    PLAYER_SIZE: 40,
    PLAYER_SPEED: 220,
    INITIAL_TIME: 120,
    MIN_LANTERN_RADIUS: 80,
    MAX_LANTERN_RADIUS: 280, // Reduced by 20% from 350
    POI_HITBOX_RADIUS: 30, // Collision radius for POIs
    TIMER_REFRESH_RATES: [0.7, 0.5, 0],
    POI_COUNT_MIN: 15,
    POI_COUNT_MAX: 22,
    POI_MIN_DISTANCE: 300,
    POI_GLOW_RADIUS: 40,
    SHROUD_RESOLUTION: 8,
    SHROUD_ERASE_MULTIPLIER: 1.0,
    CAMERA_SMOOTHING: 0.12,
    DARKNESS_COLOR: 'rgba(5, 5, 15, 0.98)',
    BATTLES_PER_FLOOR: 3,
    FLOORS_TOTAL: 3
};

// ==================== PRESET ENCOUNTERS ====================

window.AbyssPresets = {
    // Encounter definitions: { difficulty, weight, name, field, trap }
    // field: array of { row, position ('combat'|'support'), cardKey }
    // Higher weight = more common
    
    encounters: [
        // === EASY (weight: 50) ===
        {
            id: 'burning_pack',
            name: 'The Burning Pack',
            difficulty: 'easy',
            weight: 50,
            field: [
                { row: 0, position: 'combat', cardKey: 'hellhound' },
                { row: 1, position: 'combat', cardKey: 'hellpup' }, // Kindling
                { row: 1, position: 'support', cardKey: 'hellpup' }  // Kindling
            ],
            trap: null
        },
        
        // === MEDIUM (weight: 35) ===
        {
            id: 'stone_sentinels',
            name: 'Stone Sentinels',
            difficulty: 'medium',
            weight: 35,
            field: [
                { row: 0, position: 'combat', cardKey: 'libraryGargoyle' },
                { row: 0, position: 'support', cardKey: 'rooftopGargoyle' },
                { row: 1, position: 'combat', cardKey: 'rooftopGargoyle' },
                { row: 2, position: 'combat', cardKey: 'decayRat' }
            ],
            trap: 'turnToStone'
        },
        
        // === HARD (weight: 15) ===
        {
            id: 'blood_feast',
            name: 'Blood Feast',
            difficulty: 'hard',
            weight: 15,
            field: [
                { row: 0, position: 'combat', cardKey: 'vampireLord' },
                { row: 0, position: 'support', cardKey: 'hellhound' },
                { row: 1, position: 'combat', cardKey: 'redcap' },
                { row: 1, position: 'support', cardKey: 'vampireInitiate' },
                { row: 2, position: 'combat', cardKey: 'sewerAlligator' }
            ],
            trap: 'bloodCovenant'
        }
    ],
    
    // Get a random preset weighted by difficulty
    getRandomPreset() {
        const totalWeight = this.encounters.reduce((sum, e) => sum + e.weight, 0);
        let roll = Math.random() * totalWeight;
        
        for (const encounter of this.encounters) {
            roll -= encounter.weight;
            if (roll <= 0) return encounter;
        }
        return this.encounters[0]; // Fallback
    },
    
    // Get preset by ID
    getPreset(id) {
        return this.encounters.find(e => e.id === id);
    }
};

// ==================== BATTLE TRANSITION ====================

window.AbyssBattleTransition = {
    overlay: null,
    
    init() {
        // Create transition overlay
        this.overlay = document.createElement('div');
        this.overlay.id = 'abyss-battle-transition';
        this.overlay.innerHTML = `
            <div class="transition-flash"></div>
            <div class="transition-slices">
                ${Array(8).fill('<div class="slice"></div>').join('')}
            </div>
            <div class="transition-text">
                <div class="encounter-name"></div>
                <div class="encounter-warning">BATTLE!</div>
            </div>
        `;
        document.body.appendChild(this.overlay);
        
        // Add styles
        if (!document.getElementById('abyss-transition-styles')) {
            const style = document.createElement('style');
            style.id = 'abyss-transition-styles';
            style.textContent = `
                #abyss-battle-transition {
                    position: fixed;
                    inset: 0;
                    z-index: 50000;
                    pointer-events: none;
                    opacity: 0;
                }
                #abyss-battle-transition.active {
                    pointer-events: all;
                    opacity: 1;
                }
                
                .transition-flash {
                    position: absolute;
                    inset: 0;
                    background: white;
                    opacity: 0;
                }
                #abyss-battle-transition.active .transition-flash {
                    animation: battleFlash 0.3s ease-out;
                }
                @keyframes battleFlash {
                    0% { opacity: 0; }
                    20% { opacity: 1; }
                    100% { opacity: 0; }
                }
                
                .transition-slices {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    flex-direction: column;
                }
                .transition-slices .slice {
                    flex: 1;
                    background: linear-gradient(90deg, #1a0a0a, #2a1010, #1a0a0a);
                    transform: scaleX(0);
                    transform-origin: left;
                }
                .transition-slices .slice:nth-child(even) {
                    transform-origin: right;
                }
                #abyss-battle-transition.active .slice {
                    animation: sliceIn 0.4s ease-out forwards;
                }
                .slice:nth-child(1) { animation-delay: 0.05s; }
                .slice:nth-child(2) { animation-delay: 0.08s; }
                .slice:nth-child(3) { animation-delay: 0.03s; }
                .slice:nth-child(4) { animation-delay: 0.10s; }
                .slice:nth-child(5) { animation-delay: 0.02s; }
                .slice:nth-child(6) { animation-delay: 0.07s; }
                .slice:nth-child(7) { animation-delay: 0.04s; }
                .slice:nth-child(8) { animation-delay: 0.09s; }
                @keyframes sliceIn {
                    0% { transform: scaleX(0); }
                    100% { transform: scaleX(1); }
                }
                
                .transition-text {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    opacity: 0;
                    transform: scale(0.8);
                }
                #abyss-battle-transition.active .transition-text {
                    animation: textReveal 0.5s ease-out 0.3s forwards;
                }
                @keyframes textReveal {
                    0% { opacity: 0; transform: scale(0.8); }
                    50% { opacity: 1; transform: scale(1.1); }
                    100% { opacity: 1; transform: scale(1); }
                }
                
                .encounter-name {
                    font-family: 'Cinzel', serif;
                    font-size: 24px;
                    color: #c4a35a;
                    letter-spacing: 4px;
                    text-transform: uppercase;
                    text-shadow: 0 0 20px rgba(196, 163, 90, 0.5);
                    margin-bottom: 12px;
                }
                .encounter-warning {
                    font-family: 'Cinzel', serif;
                    font-size: 64px;
                    font-weight: bold;
                    color: #e85a5a;
                    letter-spacing: 12px;
                    text-shadow: 
                        0 0 30px rgba(232, 90, 90, 0.8),
                        0 0 60px rgba(232, 90, 90, 0.4);
                    animation: battlePulse 0.5s ease-in-out infinite alternate;
                }
                @keyframes battlePulse {
                    0% { transform: scale(1); text-shadow: 0 0 30px rgba(232, 90, 90, 0.8); }
                    100% { transform: scale(1.05); text-shadow: 0 0 50px rgba(232, 90, 90, 1); }
                }
                
                /* Exit animation */
                #abyss-battle-transition.exit .slice {
                    animation: sliceOut 0.3s ease-in forwards;
                }
                @keyframes sliceOut {
                    0% { transform: scaleX(1); }
                    100% { transform: scaleX(0); }
                }
                #abyss-battle-transition.exit .transition-text {
                    animation: textExit 0.2s ease-in forwards;
                }
                @keyframes textExit {
                    0% { opacity: 1; transform: scale(1); }
                    100% { opacity: 0; transform: scale(1.2); }
                }
            `;
            document.head.appendChild(style);
        }
    },
    
    // Play JRPG-style battle transition
    play(encounterName) {
        return new Promise(resolve => {
            if (!this.overlay) this.init();
            
            // Set encounter name
            this.overlay.querySelector('.encounter-name').textContent = encounterName;
            
            // Reset classes
            this.overlay.classList.remove('exit');
            this.overlay.classList.add('active');
            
            // Play sound effect if available
            if (window.SoundManager?.play) {
                SoundManager.play('battleStart');
            }
            
            // Resolve after animation
            setTimeout(resolve, 1200);
        });
    },
    
    // Exit transition
    exit() {
        return new Promise(resolve => {
            if (!this.overlay) {
                resolve();
                return;
            }
            
            this.overlay.classList.add('exit');
            
            setTimeout(() => {
                this.overlay.classList.remove('active', 'exit');
                resolve();
            }, 400);
        });
    }
};

// ==================== ABYSS BATTLE SYSTEM ====================

window.AbyssBattle = {
    config: null,
    active: false,
    
    // Start a preset battle
    start(battleConfig) {
        console.log('[AbyssBattle] Starting preset battle');
        this.config = battleConfig;
        this.active = true;
        
        // Set battle mode flags
        window.isAbyssBattle = true;
        window.abyssBattleConfig = battleConfig;
        
        // Set up deck BEFORE initGame so it's used for drawing
        if (battleConfig.playerDeck && battleConfig.playerDeck.length > 0) {
            // Use Abyss player's deck
            window.abyssPlayerDeck = battleConfig.playerDeck.map(card => ({
                ...card,
                id: 'abyss_' + (card.key || card.name) + '_' + Math.random().toString(36).substr(2, 9)
            }));
            console.log('[AbyssBattle] Player deck set:', window.abyssPlayerDeck.length, 'cards');
        }
        
        // Initialize the game
        if (typeof window.initGame === 'function') {
            window.initGame();
        } else {
            console.error('[AbyssBattle] initGame not found!');
            return;
        }
        
        const game = window.game;
        if (!game) {
            console.error('[AbyssBattle] Game not initialized!');
            return;
        }
        
        // Clear enemy hand and deck - presets don't use cards
        game.enemyHand = [];
        game.enemyDeck = [];
        game.enemyKindling = [];
        
        // Clean up temp deck reference
        window.abyssPlayerDeck = null;
        
        // Set up the preset enemy field
        this.setupPresetField(battleConfig.encounter);
        
        // Set up trap if present
        if (battleConfig.encounter.trap) {
            this.setupPresetTrap(battleConfig.encounter.trap);
        }
        
        // Hook into death events for tracking
        this.setupDeathTracking(battleConfig);
        
        // Player always goes first in presets
        game.currentTurn = 'player';
        game.phase = 'conjure1';
        
        // Show the game container (battle screen)
        const gameContainer = document.getElementById('game-container');
        if (gameContainer) {
            gameContainer.style.display = 'flex';
        }
        
        // Apply battlefield backgrounds
        if (typeof window.applyBattlefieldBackgrounds === 'function') {
            window.applyBattlefieldBackgrounds();
        }
        
        // Render initial state
        if (window.renderAll) window.renderAll();
        if (window.updateButtons) window.updateButtons();
        
        // Exit the transition overlay now that battle is ready
        AbyssBattleTransition.exit();
        
        // Note: Battle start animations (BATTLE banner, turn transition) are handled by initGame()
        // No need to duplicate them here
    },
    
    // Set up preset enemies on the field
    setupPresetField(encounter) {
        const game = window.game;
        const combatCol = game.getCombatCol('enemy');
        const supportCol = game.getSupportCol('enemy');
        
        for (const placement of encounter.field) {
            const col = placement.position === 'combat' ? combatCol : supportCol;
            const row = placement.row;
            
            // Get cryptid from CardRegistry
            let cardData = window.CardRegistry?.getCryptid(placement.cardKey);
            if (!cardData) {
                cardData = window.CardRegistry?.getKindling(placement.cardKey);
            }
            
            if (!cardData) {
                console.warn('[AbyssBattle] Card not found:', placement.cardKey);
                continue;
            }
            
            // Create a copy of the card for battle
            const cryptid = {
                ...cardData,
                id: 'preset_' + placement.cardKey + '_' + col + '_' + row + '_' + Date.now(),
                owner: 'enemy',
                col,
                row,
                currentHp: cardData.hp,
                maxHp: cardData.hp,
                currentAtk: cardData.atk,
                baseAtk: cardData.atk,
                baseHp: cardData.hp,
                tapped: false,
                canAttack: true,
                attackedThisTurn: false,
                justSummoned: false, // Presets start ready to attack
                burnTurns: 0,
                bleedTurns: 0,
                paralyzed: false,
                paralyzeTurns: 0,
                curseTokens: 0,
                protectionCharges: 0,
                extraTapTurns: 0,
                evolutionChain: [cardData.key],
                auras: [],
                latchedTo: null,
                latchedBy: null,
                restedThisTurn: false
            };
            
            // Initialize ability flags (like Guard's guardAvailable)
            if (cryptid.hasGuard) {
                cryptid.guardAvailable = true;
            }
            
            game.enemyField[col][row] = cryptid;
            
            // Register with EffectEngine for declarative effects to work
            if (cryptid.effects && typeof window.EffectEngine !== 'undefined') {
                window.EffectEngine.registerCryptid(cryptid, 'enemy', game);
            }
            
            // Initialize activated abilities if any
            if (game.initializeActivatedAbilities) {
                game.initializeActivatedAbilities(cryptid);
            }
            
            console.log(`[AbyssBattle] Placed ${cryptid.name} at col:${col} row:${row} (${placement.position})`);
        }
    },
    
    // Set up preset trap
    setupPresetTrap(trapKey) {
        const game = window.game;
        const trapData = window.CardRegistry?.getTrap(trapKey);
        
        if (!trapData) {
            console.warn('[AbyssBattle] Trap not found:', trapKey);
            return;
        }
        
        // Place trap in first available slot
        for (let r = 0; r < 2; r++) {
            if (!game.enemyTraps[r]) {
                game.enemyTraps[r] = {
                    ...trapData,
                    id: 'preset_trap_' + trapKey,
                    owner: 'enemy',
                    row: r
                };
                console.log(`[AbyssBattle] Set trap ${trapData.name} at row ${r}`);
                break;
            }
        }
    },
    
    // Track deaths for Abyss mode
    setupDeathTracking(config) {
        // Listen for death events
        const deathHandler = (data) => {
            if (data.owner === 'player' && config.onCryptidDeath) {
                config.onCryptidDeath('player');
            }
        };
        
        // Store handler for cleanup
        this.deathUnsubscribe = window.GameEvents?.on('onDeath', deathHandler);
    },
    
    // Run preset enemy AI (combat only - no card playing)
    runPresetAI() {
        const game = window.game;
        if (!game || game.gameOver) return;
        
        console.log('[AbyssBattle] Running preset AI');
        
        // Skip conjure phases - go straight to combat
        game.phase = 'combat';
        if (window.renderAll) window.renderAll();
        
        // Execute attacks
        setTimeout(() => {
            this.executePresetCombat(() => {
                // After combat, end turn
                game.phase = 'conjure2'; // Brief phase for effects
                
                setTimeout(() => {
                    if (game.gameOver) return;
                    
                    // Process end of turn effects
                    if (window.animateTurnEndEffects) {
                        window.animateTurnEndEffects(() => {
                            game.endTurn();
                            this.startPlayerTurn();
                        });
                    } else {
                        game.endTurn();
                        this.startPlayerTurn();
                    }
                }, 300);
            });
        }, 500);
    },
    
    // Execute preset enemy attacks with full animations
    executePresetCombat(onComplete) {
        const game = window.game;
        const TIMING = window.TIMING || { aiAttackDelay: 700, postAttackDelay: 700, deathAnim: 500 };
        
        const attackers = [];
        const combatCol = game.getCombatCol('enemy');
        
        // Gather all enemies that can attack
        for (let r = 0; r < 3; r++) {
            const attacker = game.enemyField[combatCol][r];
            if (attacker && !attacker.tapped && attacker.canAttack) {
                const targets = game.getValidAttackTargets(attacker);
                if (targets.length > 0) {
                    // AI target selection - prefer low HP, killable targets
                    targets.sort((a, b) => {
                        if (a.isEmptyTarget && !b.isEmptyTarget) return 1;
                        if (!a.isEmptyTarget && b.isEmptyTarget) return -1;
                        if (a.cryptid && b.cryptid) {
                            const damage = game.calculateAttackDamage(attacker);
                            const aKill = game.getEffectiveHp(a.cryptid) <= damage;
                            const bKill = game.getEffectiveHp(b.cryptid) <= damage;
                            if (aKill && !bKill) return -1;
                            if (bKill && !aKill) return 1;
                            return game.getEffectiveHp(a.cryptid) - game.getEffectiveHp(b.cryptid);
                        }
                        return 0;
                    });
                    attackers.push({ attacker, row: r, target: targets[0] });
                }
            }
        }
        
        // Process attacks sequentially with animations
        const processAttack = (index) => {
            if (index >= attackers.length || game.gameOver) {
                onComplete?.();
                return;
            }
            
            const { attacker, target } = attackers[index];
            
            // Verify attacker can still attack
            if (!attacker || attacker.tapped || !attacker.canAttack) {
                processAttack(index + 1);
                return;
            }
            
            // Check if target position changed
            const playerCombatCol = game.getCombatCol('player');
            const currentTarget = game.getFieldCryptid('player', playerCombatCol, target.row);
            
            if (currentTarget) {
                // Show attack message
                if (window.showMessage) {
                    window.showMessage(`${attacker.name} attacks ${currentTarget.name}!`, 800);
                }
                
                // Get attacker sprite for animation
                const attackerSprite = document.querySelector(
                    `.cryptid-sprite[data-owner="enemy"][data-col="${combatCol}"][data-row="${attacker.row}"]`
                );
                
                // Play attack animation, then perform attack on impact
                if (typeof window.playAttackAnimation === 'function' && attackerSprite) {
                    window.playAttackAnimation(attackerSprite, 'enemy', null, () => {
                        this.performAttackWithEffects(attacker, currentTarget, index, processAttack);
                    }, 3, target.row);
                } else {
                    // Fallback: animate with CSS class
                    if (attackerSprite) {
                        attackerSprite.classList.add('attacking-left');
                        setTimeout(() => attackerSprite.classList.remove('attacking-left'), 300);
                    }
                    setTimeout(() => {
                        this.performAttackWithEffects(attacker, currentTarget, index, processAttack);
                    }, TIMING.aiAttackDelay);
                }
            } else if (target.isEmptyTarget) {
                // Attack empty row (direct damage) - skip if player has cryptids elsewhere
                if (!game.isFieldEmpty('player')) {
                    processAttack(index + 1);
                    return;
                }
                
                if (window.showMessage) {
                    window.showMessage(`${attacker.name} strikes!`, 800);
                }
                
                const attackerSprite = document.querySelector(
                    `.cryptid-sprite[data-owner="enemy"][data-col="${combatCol}"][data-row="${attacker.row}"]`
                );
                
                if (typeof window.playAttackAnimation === 'function' && attackerSprite) {
                    window.playAttackAnimation(attackerSprite, 'enemy', null, () => {
                        game.attack(attacker, 'player', playerCombatCol, target.row);
                        if (window.renderAll) window.renderAll();
                        setTimeout(() => processAttack(index + 1), TIMING.postAttackDelay);
                    }, 3, target.row);
                } else {
                    setTimeout(() => {
                        game.attack(attacker, 'player', playerCombatCol, target.row);
                        if (window.renderAll) window.renderAll();
                        setTimeout(() => processAttack(index + 1), TIMING.postAttackDelay);
                    }, TIMING.aiAttackDelay);
                }
            } else {
                processAttack(index + 1);
            }
        };
        
        if (attackers.length > 0) {
            processAttack(0);
        } else {
            onComplete?.();
        }
    },
    
    // Perform attack with full combat effects (damage numbers, particles, death animations)
    performAttackWithEffects(attacker, target, index, nextCallback) {
        const game = window.game;
        const TIMING = window.TIMING || { postAttackDelay: 700, deathAnim: 500 };
        
        // Perform the attack
        const result = game.attack(attacker, 'player', target.col, target.row);
        
        // Get sprites for visual effects
        const targetSprite = document.querySelector(
            `.cryptid-sprite[data-owner="player"][data-col="${target.col}"][data-row="${target.row}"]`
        );
        const attackerSprite = document.querySelector(
            `.cryptid-sprite[data-owner="enemy"][data-col="${attacker.col}"][data-row="${attacker.row}"]`
        );
        
        // Get impact position for combat effects
        const battlefield = document.getElementById('battlefield-area');
        let impactX = 0, impactY = 0;
        if (targetSprite && battlefield) {
            const targetRect = targetSprite.getBoundingClientRect();
            const battlefieldRect = battlefield.getBoundingClientRect();
            impactX = targetRect.left + targetRect.width/2 - battlefieldRect.left;
            impactY = targetRect.top + targetRect.height/2 - battlefieldRect.top;
        }
        
        // Handle negated attacks (Guard, counter-kill, etc.)
        if (result.negated) {
            console.log('[AbyssBattle] Attack negated');
            
            if (!result.attackerKilled && result.target) {
                // Show shield bubble effect
                if (window.CombatEffects?.playShieldBubble) {
                    window.CombatEffects.playShieldBubble(result.target, '#88ccff');
                }
                if (window.CombatEffects) {
                    window.CombatEffects.showDamageNumber(result.target, 0, false, true);
                }
                window.showMessage?.('🛡️ Attack blocked!', 800);
            }
            
            // Handle attacker killed by counter
            if (result.attackerKilled && attackerSprite) {
                const attackerRarity = attacker?.rarity || 'common';
                if (window.CombatEffects?.playDramaticDeath) {
                    window.CombatEffects.playDramaticDeath(attackerSprite, 'enemy', attackerRarity);
                }
            }
            
            setTimeout(() => {
                window.renderAll?.();
                nextCallback(index + 1);
            }, 900);
            return;
        }
        
        // Track dramatic death state
        let usingDramaticDeath = false;
        const targetRarity = result.target?.rarity || 'common';
        
        // Start dramatic death immediately on kill
        if (result.killed && targetSprite && !result.protectionBlocked) {
            if (window.CombatEffects?.playDramaticDeath) {
                usingDramaticDeath = true;
                window.CombatEffects.playDramaticDeath(targetSprite, 'player', targetRarity);
            } else if (targetSprite) {
                targetSprite.classList.add('dying-left');
            }
        }
        
        // Update health bar (skip for kills)
        if (result.target && !result.killed && window.updateSpriteHealthBar) {
            window.updateSpriteHealthBar('player', target.col, target.row);
        }
        
        // Apply combat effects for successful hit
        if (!result.negated && !result.protectionBlocked && window.CombatEffects) {
            const damage = result.damage || 0;
            const displayDamage = result.effectiveHpBefore !== undefined
                ? Math.min(damage, result.effectiveHpBefore)
                : damage;
            const isCrit = displayDamage >= 5;
            
            // Screen shake (skip if using dramatic death)
            if (!usingDramaticDeath) {
                window.CombatEffects.heavyImpact(Math.max(damage, 1));
            }
            
            // Impact flash and particles
            window.CombatEffects.createImpactFlash(impactX, impactY, 80 + damage * 10);
            window.CombatEffects.createSparks(impactX, impactY, 10 + damage * 2);
            window.CombatEffects.createImpactParticles(impactX, impactY, result.killed ? '#ff2222' : '#ff6666', 8 + damage);
            
            // Show damage number (skip for dramatic deaths)
            if (result.target && !usingDramaticDeath) {
                window.CombatEffects.showDamageNumber(result.target, displayDamage, isCrit);
            }
        }
        
        // Hit recoil animation (only if not killed)
        if (!result.negated && !result.protectionBlocked && !result.killed && targetSprite) {
            if (window.playHitEffectOnSprite && result.target) {
                window.playHitEffectOnSprite(targetSprite, result.target, { intensity: 'normal' });
            }
        }
        
        // Wait for animations then continue
        const waitTime = result.killed ? (usingDramaticDeath ? 1200 : TIMING.deathAnim) : TIMING.postAttackDelay;
        
        setTimeout(() => {
            // Handle support promotion if target was killed
            if (result.killed && result.target) {
                const targetRow = result.target.row;
                const promoted = game.promoteSupport('player', targetRow);
                
                if (promoted && window.animateSupportPromotion) {
                    // Animate the promotion, then continue
                    window.animateSupportPromotion('player', targetRow, () => {
                        window.renderAll?.();
                        this.continueAfterAttack(nextCallback, index);
                    });
                    return;
                }
            }
            
            window.renderAll?.();
            this.continueAfterAttack(nextCallback, index);
        }, waitTime);
    },
    
    // Helper to continue attack sequence after promotion/death
    continueAfterAttack(nextCallback, index) {
        // Check for cascading deaths
        if (window.checkCascadingDeaths) {
            window.checkCascadingDeaths(() => {
                window.renderAll?.();
                nextCallback(index + 1);
            });
        } else {
            nextCallback(index + 1);
        }
    },
    
    // Start player's turn
    startPlayerTurn() {
        const game = window.game;
        if (game.gameOver) return;
        
        if (window.animateTurnStartEffects) {
            window.animateTurnStartEffects('player', () => {
                if (window.setAnimating) window.setAnimating(false);
                if (window.showMessage) window.showMessage("Your turn!", 1200);
                if (window.renderAll) window.renderAll();
                if (window.updateButtons) window.updateButtons();
            });
        } else {
            if (window.setAnimating) window.setAnimating(false);
            if (window.showMessage) window.showMessage("Your turn!", 1200);
            if (window.renderAll) window.renderAll();
            if (window.updateButtons) window.updateButtons();
        }
    },
    
    // Check for battle end conditions
    checkBattleEnd() {
        const game = window.game;
        if (!game || !this.active) return false;
        
        // Check if all enemies are dead
        const enemyAlive = game.enemyField.some(col => col.some(c => c !== null));
        if (!enemyAlive) {
            this.endBattle(true);
            return true;
        }
        
        // Check if player lost (handled by normal game over)
        return false;
    },
    
    // End the battle
    endBattle(victory) {
        console.log('[AbyssBattle] Battle ended:', victory ? 'VICTORY' : 'DEFEAT');
        this.active = false;
        window.isAbyssBattle = false;
        
        // Clean up death tracking
        if (this.deathUnsubscribe) {
            this.deathUnsubscribe();
            this.deathUnsubscribe = null;
        }
        
        // Hide game container (battle screen)
        const gameContainer = document.getElementById('game-container');
        if (gameContainer) {
            gameContainer.style.display = 'none';
        }
        
        // Call appropriate callback
        if (victory && this.config?.onWin) {
            this.config.onWin();
        } else if (!victory && this.config?.onLose) {
            this.config.onLose();
        }
        
        this.config = null;
    },
    
    // Clean up
    cleanup() {
        this.active = false;
        window.isAbyssBattle = false;
        if (this.deathUnsubscribe) {
            this.deathUnsubscribe();
            this.deathUnsubscribe = null;
        }
        this.config = null;
    }
};

// ==================== STATE ====================

window.AbyssState = {
    isActive: false,
    isPaused: false,
    currentFloor: 1,
    battlesCompleted: 0,
    timeRemaining: 0,
    maxTime: 0,
    timerPaused: false,
    playerX: 0,
    playerY: 0,
    savedPlayerX: 0,
    savedPlayerY: 0,
    shroudMap: null,
    mapSeed: null,
    pois: [],
    collectedPOIs: [],
    selectedDeck: null,
    deckArchetype: null,
    starterCards: [],
    discoveredCards: [],
    relics: [],
    embers: 0,
    totalPOIsCollected: 0,
    deadCryptidCount: 0,
    maxDeadCryptids: 10,
    
    reset() {
        this.isActive = false;
        this.isPaused = false;
        this.currentFloor = 1;
        this.battlesCompleted = 0;
        this.timeRemaining = AbyssConfig.INITIAL_TIME;
        this.maxTime = AbyssConfig.INITIAL_TIME;
        this.timerPaused = false;
        this.playerX = AbyssConfig.MAP_WIDTH / 2;
        this.playerY = AbyssConfig.MAP_HEIGHT / 2;
        this.shroudMap = null;
        this.pois = [];
        this.collectedPOIs = [];
        this.relics = [];
        this.embers = 0;
        this.totalPOIsCollected = 0;
        this.deadCryptidCount = 0;
        this.currentEncounter = null;
    },
    
    getLanternRadius() {
        const pct = this.timeRemaining / this.maxTime;
        const range = AbyssConfig.MAX_LANTERN_RADIUS - AbyssConfig.MIN_LANTERN_RADIUS;
        return AbyssConfig.MIN_LANTERN_RADIUS + (range * pct);
    },
    
    getTimerRefresh() {
        const i = Math.min(this.battlesCompleted, AbyssConfig.TIMER_REFRESH_RATES.length - 1);
        return AbyssConfig.TIMER_REFRESH_RATES[i];
    },
    
    isBossFight() {
        return this.battlesCompleted >= AbyssConfig.BATTLES_PER_FLOOR - 1;
    },
    
    getBattleDeck() {
        return [...this.starterCards, ...this.discoveredCards];
    },
    
    getMaxDeaths() {
        let max = this.maxDeadCryptids;
        for (const relic of this.relics) {
            if (relic.effect?.maxDeathBonus) max += relic.effect.maxDeathBonus;
        }
        return max;
    },
    
    isDefeated() {
        return this.deadCryptidCount >= this.getMaxDeaths();
    }
};

// ==================== SHROUD SYSTEM ====================

window.AbyssShroud = {
    width: 0,
    height: 0,
    data: null,
    canvas: null,
    ctx: null,
    dirty: true, // Only re-render when changed
    
    init() {
        const cfg = AbyssConfig;
        this.width = Math.ceil(cfg.MAP_WIDTH / cfg.SHROUD_RESOLUTION);
        this.height = Math.ceil(cfg.MAP_HEIGHT / cfg.SHROUD_RESOLUTION);
        this.data = [];
        for (let y = 0; y < this.height; y++) {
            this.data[y] = new Array(this.width).fill(false);
        }
        this.canvas = document.createElement('canvas');
        this.canvas.width = cfg.MAP_WIDTH;
        this.canvas.height = cfg.MAP_HEIGHT;
        this.ctx = this.canvas.getContext('2d');
        this.dirty = true;
        
        // Pre-fill with darkness
        this.ctx.fillStyle = cfg.DARKNESS_COLOR;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    },
    
    eraseAt(worldX, worldY, radius) {
        const res = AbyssConfig.SHROUD_RESOLUTION;
        const centerX = Math.floor(worldX / res);
        const centerY = Math.floor(worldY / res);
        const cellRadius = Math.ceil(radius / res);
        
        // Directly erase from canvas - much faster than re-rendering
        this.ctx.globalCompositeOperation = 'destination-out';
        
        // Soft circular erase
        const grad = this.ctx.createRadialGradient(worldX, worldY, 0, worldX, worldY, radius);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(0.7, 'rgba(255,255,255,0.8)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        this.ctx.fillStyle = grad;
        this.ctx.beginPath();
        this.ctx.arc(worldX, worldY, radius, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.globalCompositeOperation = 'source-over';
        
        // Update data for collision/visibility checks
        for (let dy = -cellRadius; dy <= cellRadius; dy++) {
            for (let dx = -cellRadius; dx <= cellRadius; dx++) {
                const sx = centerX + dx;
                const sy = centerY + dy;
                if (sx < 0 || sx >= this.width || sy < 0 || sy >= this.height) continue;
                const dist = Math.sqrt(dx * dx + dy * dy) * res;
                if (dist <= radius * 0.7) this.data[sy][sx] = true;
            }
        }
    },
    
    getCanvas() {
        return this.canvas;
    }
};

// ==================== MAP ====================

window.AbyssMap = {
    terrain: null,
    spawnPoint: null,
    TERRAIN: { FLOOR: 0, WALL: 1 },
    
    init(seed) {
        AbyssState.mapSeed = seed || Math.floor(Math.random() * 1000000);
        this.generateTerrain();
        this.spawnPoint = { x: AbyssConfig.MAP_WIDTH / 2, y: AbyssConfig.MAP_HEIGHT / 2 };
    },
    
    seededRandom(seed) {
        return (Math.sin(seed) * 10000) % 1;
    },
    
    generateTerrain() {
        const cfg = AbyssConfig;
        const tilesX = Math.ceil(cfg.MAP_WIDTH / cfg.TILE_SIZE);
        const tilesY = Math.ceil(cfg.MAP_HEIGHT / cfg.TILE_SIZE);
        let seed = AbyssState.mapSeed;
        
        this.terrain = [];
        for (let y = 0; y < tilesY; y++) {
            this.terrain[y] = [];
            for (let x = 0; x < tilesX; x++) {
                if (x === 0 || x === tilesX - 1 || y === 0 || y === tilesY - 1) {
                    this.terrain[y][x] = this.TERRAIN.WALL;
                } else {
                    seed++;
                    this.terrain[y][x] = Math.abs(this.seededRandom(seed)) < 0.1 ? this.TERRAIN.WALL : this.TERRAIN.FLOOR;
                }
            }
        }
        
        // Carve paths from center
        const cx = Math.floor(tilesX / 2);
        const cy = Math.floor(tilesY / 2);
        for (let x = 2; x < tilesX - 2; x++) {
            this.terrain[cy][x] = this.TERRAIN.FLOOR;
        }
        for (let y = 2; y < tilesY - 2; y++) {
            this.terrain[y][cx] = this.TERRAIN.FLOOR;
        }
    },
    
    isWalkable(worldX, worldY) {
        const cfg = AbyssConfig;
        const tx = Math.floor(worldX / cfg.TILE_SIZE);
        const ty = Math.floor(worldY / cfg.TILE_SIZE);
        if (ty < 0 || ty >= this.terrain.length || tx < 0 || tx >= this.terrain[0].length) return false;
        return this.terrain[ty][tx] === this.TERRAIN.FLOOR;
    },
    
    getTerrainColor(type, x, y) {
        if (type === this.TERRAIN.WALL) {
            // Walls with slight variation
            const v = ((x * 7 + y * 13) % 20) / 100;
            return `rgb(${10 + v * 10}, ${10 + v * 8}, ${20 + v * 10})`;
        } else {
            // Floor with more noticeable variation for texture
            const v = ((x * 11 + y * 17) % 30) / 100;
            const r = Math.floor(26 + v * 15);
            const g = Math.floor(26 + v * 12);
            const b = Math.floor(46 + v * 15);
            return `rgb(${r}, ${g}, ${b})`;
        }
    }
};

// ==================== POI SYSTEM ====================

window.AbyssPOI = {
    TYPES: {
        EMBER_CACHE: { name: 'Ember Cache', sprite: 'sprites/embers-icon.png', isImage: true, instant: true },
        TIME_CRYSTAL: { name: 'Time Crystal', sprite: '💎', instant: true },
        CARD_SHRINE: { name: 'Card Shrine', sprite: '🃏', instant: false },
        REST_SITE: { name: 'Rest Site', sprite: '🏕️', instant: false }
    },
    
    generate() {
        const cfg = AbyssConfig;
        const state = AbyssState;
        state.pois = [];
        let seed = state.mapSeed + 20000;
        const count = cfg.POI_COUNT_MIN + Math.floor(Math.random() * (cfg.POI_COUNT_MAX - cfg.POI_COUNT_MIN + 1));
        const typeKeys = Object.keys(this.TYPES);
        
        for (let i = 0; i < count; i++) {
            let x, y, valid = false, attempts = 0;
            while (!valid && attempts < 50) {
                seed++;
                x = 150 + Math.random() * (cfg.MAP_WIDTH - 300);
                y = 150 + Math.random() * (cfg.MAP_HEIGHT - 300);
                valid = true;
                
                // Check distance from other POIs
                for (const poi of state.pois) {
                    if (Math.hypot(poi.x - x, poi.y - y) < cfg.POI_MIN_DISTANCE) {
                        valid = false;
                        break;
                    }
                }
                
                // Check distance from spawn
                if (Math.hypot(x - cfg.MAP_WIDTH / 2, y - cfg.MAP_HEIGHT / 2) < 200) valid = false;
                if (!AbyssMap.isWalkable(x, y)) valid = false;
                attempts++;
            }
            
            if (valid) {
                const typeKey = typeKeys[i % typeKeys.length];
                const type = this.TYPES[typeKey];
                state.pois.push({
                    id: 'poi_' + i,
                    x, y,
                    typeKey,
                    name: type.name,
                    sprite: type.sprite,
                    instant: type.instant,
                    collected: false,
                    visible: false,
                    inRange: false,
                    revealProgress: 0 // 0 to 1 for smooth fade-in animation
                });
            }
        }
    },
    
    updateVisibility(px, py, radius, dt = 0.016) {
        for (const poi of AbyssState.pois) {
            if (poi.collected) continue;
            const dist = Math.hypot(poi.x - px, poi.y - py);
            poi.visible = dist < radius + AbyssConfig.POI_GLOW_RADIUS;
            poi.inRange = dist < radius;
            
            // Animate reveal progress
            const targetReveal = poi.inRange ? 1 : (poi.visible ? 0.3 : 0);
            const revealSpeed = 3.0; // Speed of fade animation
            if (poi.revealProgress < targetReveal) {
                poi.revealProgress = Math.min(targetReveal, poi.revealProgress + revealSpeed * dt);
            } else if (poi.revealProgress > targetReveal) {
                poi.revealProgress = Math.max(targetReveal, poi.revealProgress - revealSpeed * dt);
            }
        }
    },
    
    checkInteraction(px, py) {
        for (const poi of AbyssState.pois) {
            if (poi.collected) continue;
            if (Math.hypot(poi.x - px, poi.y - py) < 50) return poi;
        }
        return null;
    },
    
    // Check if a position collides with any POI hitbox
    checkCollision(px, py, excludeCollected = true) {
        const hitboxRadius = AbyssConfig.POI_HITBOX_RADIUS;
        for (const poi of AbyssState.pois) {
            if (excludeCollected && poi.collected) continue;
            if (Math.hypot(poi.x - px, poi.y - py) < hitboxRadius) return true;
        }
        return false;
    },
    
    collect(poi) {
        if (poi.collected) return null;
        poi.collected = true;
        AbyssState.totalPOIsCollected++;
        
        // Apply effect based on type
        let msg = 'Collected!';
        if (poi.typeKey === 'EMBER_CACHE') {
            const amt = 15 + Math.floor(Math.random() * 20);
            AbyssState.embers += amt;
            msg = '+' + amt + ' Embers!';
        } else if (poi.typeKey === 'TIME_CRYSTAL') {
            const time = 8 + Math.floor(Math.random() * 7);
            AbyssState.timeRemaining = Math.min(AbyssState.timeRemaining + time, AbyssState.maxTime);
            msg = '+' + time + ' seconds!';
        } else if (poi.typeKey === 'REST_SITE') {
            AbyssState.deadCryptidCount = Math.max(0, AbyssState.deadCryptidCount - 3);
            msg = 'Healed 3 deaths!';
            if (!poi.instant) AbyssState.timerPaused = true;
        } else if (poi.typeKey === 'CARD_SHRINE') {
            msg = 'Card selection coming soon!';
            if (!poi.instant) AbyssState.timerPaused = true;
        }
        
        return { message: msg };
    },
    
    resumeTimer() {
        AbyssState.timerPaused = false;
    }
};

// ==================== PLAYER ====================

window.AbyssPlayer = {
    keys: { up: false, down: false, left: false, right: false },
    touchActive: false,
    touchStartX: 0,
    touchStartY: 0,
    joystickX: 0,
    joystickY: 0,
    
    init() {
        this.handleKeyDown = (e) => {
            if (!AbyssState.isActive || AbyssState.isPaused) return;
            const key = e.key.toLowerCase();
            if (key === 'w' || key === 'arrowup') this.keys.up = true;
            if (key === 's' || key === 'arrowdown') this.keys.down = true;
            if (key === 'a' || key === 'arrowleft') this.keys.left = true;
            if (key === 'd' || key === 'arrowright') this.keys.right = true;
            if (key === 'e' || key === ' ') this.tryInteract();
            if (key === 'escape') AbyssUI.togglePause();
            // DEBUG: Press T to rapidly drain timer for testing battles
            if (key === 't') AbyssState.timeRemaining = Math.max(0, AbyssState.timeRemaining - 10);
        };
        
        this.handleKeyUp = (e) => {
            const key = e.key.toLowerCase();
            if (key === 'w' || key === 'arrowup') this.keys.up = false;
            if (key === 's' || key === 'arrowdown') this.keys.down = false;
            if (key === 'a' || key === 'arrowleft') this.keys.left = false;
            if (key === 'd' || key === 'arrowright') this.keys.right = false;
        };
        
        document.addEventListener('keydown', this.handleKeyDown);
        document.addEventListener('keyup', this.handleKeyUp);
        
        // Mobile touch controls
        this.initTouchControls();
    },
    
    initTouchControls() {
        // Only show on touch devices
        if (!('ontouchstart' in window)) return;
        
        // Create joystick
        this.joystickContainer = document.createElement('div');
        this.joystickContainer.id = 'abyss-joystick';
        this.joystickContainer.innerHTML = `
            <div class="joystick-base">
                <div class="joystick-thumb"></div>
            </div>
        `;
        
        // Create interact button
        this.interactBtn = document.createElement('div');
        this.interactBtn.id = 'abyss-interact-btn';
        this.interactBtn.innerHTML = '✋';
        
        // Create pause button
        this.pauseBtn = document.createElement('div');
        this.pauseBtn.id = 'abyss-pause-btn';
        this.pauseBtn.innerHTML = '⏸️';
        
        // Add styles
        const style = document.createElement('style');
        style.id = 'abyss-touch-styles';
        style.textContent = `
            #abyss-joystick {
                position: fixed;
                bottom: 30px;
                left: 30px;
                z-index: 16000;
                touch-action: none;
            }
            .joystick-base {
                width: 120px;
                height: 120px;
                background: rgba(232,169,62,0.2);
                border: 3px solid rgba(232,169,62,0.5);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .joystick-thumb {
                width: 50px;
                height: 50px;
                background: radial-gradient(circle, rgba(232,169,62,0.8), rgba(196,92,38,0.6));
                border-radius: 50%;
                transition: transform 0.05s;
                box-shadow: 0 0 15px rgba(232,169,62,0.5);
            }
            #abyss-interact-btn {
                position: fixed;
                bottom: 50px;
                right: 30px;
                width: 80px;
                height: 80px;
                background: rgba(232,169,62,0.3);
                border: 3px solid rgba(232,169,62,0.6);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 32px;
                z-index: 16000;
                touch-action: none;
                user-select: none;
            }
            #abyss-interact-btn:active {
                background: rgba(232,169,62,0.6);
                transform: scale(0.95);
            }
            #abyss-pause-btn {
                position: fixed;
                top: 20px;
                right: 20px;
                width: 50px;
                height: 50px;
                background: rgba(10,10,20,0.8);
                border: 2px solid rgba(232,169,62,0.5);
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
                z-index: 16000;
                touch-action: none;
            }
        `;
        document.head.appendChild(style);
        
        AbyssUI.container.appendChild(this.joystickContainer);
        AbyssUI.container.appendChild(this.interactBtn);
        AbyssUI.container.appendChild(this.pauseBtn);
        
        // Joystick touch handlers
        const joystickBase = this.joystickContainer.querySelector('.joystick-base');
        const joystickThumb = this.joystickContainer.querySelector('.joystick-thumb');
        
        joystickBase.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.touchActive = true;
            const touch = e.touches[0];
            const rect = joystickBase.getBoundingClientRect();
            this.touchStartX = rect.left + rect.width / 2;
            this.touchStartY = rect.top + rect.height / 2;
        });
        
        joystickBase.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (!this.touchActive) return;
            const touch = e.touches[0];
            const dx = touch.clientX - this.touchStartX;
            const dy = touch.clientY - this.touchStartY;
            const maxDist = 35;
            const dist = Math.min(Math.sqrt(dx*dx + dy*dy), maxDist);
            const angle = Math.atan2(dy, dx);
            
            this.joystickX = (dist / maxDist) * Math.cos(angle);
            this.joystickY = (dist / maxDist) * Math.sin(angle);
            
            joystickThumb.style.transform = `translate(${this.joystickX * maxDist}px, ${this.joystickY * maxDist}px)`;
        });
        
        const endTouch = () => {
            this.touchActive = false;
            this.joystickX = 0;
            this.joystickY = 0;
            joystickThumb.style.transform = 'translate(0, 0)';
        };
        
        joystickBase.addEventListener('touchend', endTouch);
        joystickBase.addEventListener('touchcancel', endTouch);
        
        // Interact button
        this.interactBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.tryInteract();
        });
        
        // Pause button
        this.pauseBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            AbyssUI.togglePause();
        });
    },
    
    update(dt) {
        if (!AbyssState.isActive || AbyssState.isPaused) return;
        
        let dx = 0, dy = 0;
        
        // Keyboard input
        if (this.keys.up) dy -= 1;
        if (this.keys.down) dy += 1;
        if (this.keys.left) dx -= 1;
        if (this.keys.right) dx += 1;
        
        // Touch joystick input (overrides keyboard if active)
        if (this.touchActive) {
            dx = this.joystickX;
            dy = this.joystickY;
        }
        
        if (dx !== 0 && dy !== 0 && !this.touchActive) {
            const len = Math.sqrt(2);
            dx /= len;
            dy /= len;
        }
        
        const speed = AbyssConfig.PLAYER_SPEED * dt;
        const newX = AbyssState.playerX + dx * speed;
        const newY = AbyssState.playerY + dy * speed;
        const half = AbyssConfig.PLAYER_SIZE / 2;
        
        // Check all four corners for X movement (walls)
        const wallClearX = AbyssMap.isWalkable(newX - half, AbyssState.playerY - half) &&
                           AbyssMap.isWalkable(newX + half, AbyssState.playerY - half) &&
                           AbyssMap.isWalkable(newX - half, AbyssState.playerY + half) &&
                           AbyssMap.isWalkable(newX + half, AbyssState.playerY + half);
        // Also check POI collision for X movement
        const poiClearX = !AbyssPOI.checkCollision(newX, AbyssState.playerY);
        if (wallClearX && poiClearX) {
            AbyssState.playerX = newX;
        }
        
        // Check all four corners for Y movement (walls, using updated X if it changed)
        const wallClearY = AbyssMap.isWalkable(AbyssState.playerX - half, newY - half) &&
                           AbyssMap.isWalkable(AbyssState.playerX + half, newY - half) &&
                           AbyssMap.isWalkable(AbyssState.playerX - half, newY + half) &&
                           AbyssMap.isWalkable(AbyssState.playerX + half, newY + half);
        // Also check POI collision for Y movement
        const poiClearY = !AbyssPOI.checkCollision(AbyssState.playerX, newY);
        if (wallClearY && poiClearY) {
            AbyssState.playerY = newY;
        }
        
        AbyssShroud.eraseAt(AbyssState.playerX, AbyssState.playerY, AbyssState.getLanternRadius());
        AbyssPOI.updateVisibility(AbyssState.playerX, AbyssState.playerY, AbyssState.getLanternRadius(), dt);
    },
    
    tryInteract() {
        const poi = AbyssPOI.checkInteraction(AbyssState.playerX, AbyssState.playerY);
        if (poi) {
            const result = AbyssPOI.collect(poi);
            if (result) {
                // Use emoji fallback for image POIs in messages
                const poiType = AbyssPOI.TYPES[poi.typeKey];
                const displayIcon = (poiType && poiType.isImage) ? '🔥' : poi.sprite;
                AbyssUI.showMessage(displayIcon + ' ' + poi.name, result.message);
            }
        }
    },
    
    cleanup() {
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);
        this.keys = { up: false, down: false, left: false, right: false };
        this.touchActive = false;
        this.joystickX = 0;
        this.joystickY = 0;
        
        // Remove touch controls
        if (this.joystickContainer) this.joystickContainer.remove();
        if (this.interactBtn) this.interactBtn.remove();
        if (this.pauseBtn) this.pauseBtn.remove();
    }
};

// ==================== RENDERER ====================

window.AbyssRenderer = {
    canvas: null,
    ctx: null,
    camera: { x: 0, y: 0 },
    zoom: 1,
    
    // Tilted layer: contains invisible position markers
    markerContainer: null,
    playerMarker: null,
    poiMarkers: {},
    
    // Flat layer: contains visible sprites (no transform)
    spriteOverlay: null,
    playerSprite: null,
    poiSprites: {},
    
    init(container) {
        this.container = container;
        
        // Calculate responsive zoom based on screen size
        this.updateZoom();
        
        // Create wrapper for perspective transform (terrain + position markers)
        this.wrapper = document.createElement('div');
        this.wrapper.id = 'abyss-wrapper';
        this.updateWrapperStyle();
        
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'abyss-canvas';
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.ctx = this.canvas.getContext('2d');
        
        this.wrapper.appendChild(this.canvas);
        
        // Create marker container inside tilted wrapper (invisible, just for position tracking)
        this.markerContainer = document.createElement('div');
        this.markerContainer.id = 'abyss-markers';
        this.markerContainer.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
        `;
        this.wrapper.appendChild(this.markerContainer);
        
        // Create player marker (invisible, tracks position in tilted space)
        this.createPlayerMarker();
        
        container.appendChild(this.wrapper);
        
        // Create FLAT sprite overlay (completely separate, NO transform)
        this.spriteOverlay = document.createElement('div');
        this.spriteOverlay.id = 'abyss-sprite-overlay';
        this.spriteOverlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 10;
        `;
        container.appendChild(this.spriteOverlay);
        
        // Create visible player sprite on flat overlay
        this.createPlayerSprite();
        
        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.updateZoom();
            this.updateWrapperStyle();
        });
    },
    
    // Invisible marker in tilted space (tracks where player appears after transform)
    createPlayerMarker() {
        this.playerMarker = document.createElement('div');
        this.playerMarker.id = 'abyss-player-marker';
        this.playerMarker.style.cssText = `
            position: absolute;
            width: 4px;
            height: 4px;
            pointer-events: none;
        `;
        this.markerContainer.appendChild(this.playerMarker);
    },
    
    // Visible sprite on flat overlay (positioned based on marker's screen position)
    createPlayerSprite() {
        this.playerSprite = document.createElement('div');
        this.playerSprite.id = 'abyss-player-sprite';
        this.playerSprite.style.cssText = `
            position: absolute;
            width: 64px;
            height: 64px;
            pointer-events: none;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        this.playerSprite.innerHTML = `
            <img src="sprites/vampire-initiate.png" style="
                width: 100%;
                height: 100%;
                object-fit: contain;
                filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
            " />
        `;
        this.spriteOverlay.appendChild(this.playerSprite);
    },
    
    // Create invisible POI marker in tilted space
    createPOIMarker(poi) {
        const marker = document.createElement('div');
        marker.className = 'abyss-poi-marker';
        marker.dataset.poiId = poi.id;
        marker.style.cssText = `
            position: absolute;
            width: 4px;
            height: 4px;
            pointer-events: none;
        `;
        this.markerContainer.appendChild(marker);
        this.poiMarkers[poi.id] = marker;
        return marker;
    },
    
    // Create visible POI sprite on flat overlay
    createPOISprite(poi) {
        const sprite = document.createElement('div');
        sprite.className = 'abyss-poi-sprite';
        sprite.dataset.poiId = poi.id;
        sprite.style.cssText = `
            position: absolute;
            pointer-events: none;
            text-align: center;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        
        // Check if sprite is an image path or emoji
        const poiType = AbyssPOI.TYPES[poi.typeKey];
        const isImage = poiType && poiType.isImage;
        
        const spriteContent = isImage 
            ? `<img src="${poi.sprite}" style="width: 40px; height: 40px; object-fit: contain; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));" />`
            : `<div style="font-size: 28px; line-height: 1;">${poi.sprite}</div>`;
        
        sprite.innerHTML = `
            ${spriteContent}
            <div style="
                font-family: Cinzel, serif;
                font-size: 12px;
                color: #e8a93e;
                margin-top: 4px;
                text-shadow: 0 1px 2px rgba(0,0,0,0.8);
                white-space: nowrap;
            ">${poi.name}</div>
        `;
        this.spriteOverlay.appendChild(sprite);
        this.poiSprites[poi.id] = sprite;
        return sprite;
    },
    
    updateZoom() {
        // Closer zoom on larger screens, comfortable on mobile
        const screenWidth = window.innerWidth;
        if (screenWidth > 1400) {
            this.zoom = 2.0; // Desktop - much closer
        } else if (screenWidth > 1000) {
            this.zoom = 1.7;
        } else if (screenWidth > 700) {
            this.zoom = 1.4; // Tablet
        } else {
            this.zoom = 1.2; // Mobile - already close
        }
    },
    
    updateWrapperStyle() {
        const baseScale = 1.15 * this.zoom;
        this.wrapper.style.cssText = `
            position: absolute;
            inset: 0;
            transform: perspective(1200px) rotateX(25deg) scale(${baseScale});
            transform-origin: center 60%;
            overflow: hidden;
        `;
    },
    
    render() {
        if (!AbyssState.isActive) return;
        
        const ctx = this.ctx;
        const cfg = AbyssConfig;
        const state = AbyssState;
        
        // Update camera
        const targetX = state.playerX - this.canvas.width / 2;
        const targetY = state.playerY - this.canvas.height / 2;
        this.camera.x += (targetX - this.camera.x) * cfg.CAMERA_SMOOTHING;
        this.camera.y += (targetY - this.camera.y) * cfg.CAMERA_SMOOTHING;
        this.camera.x = Math.max(0, Math.min(cfg.MAP_WIDTH - this.canvas.width, this.camera.x));
        this.camera.y = Math.max(0, Math.min(cfg.MAP_HEIGHT - this.canvas.height, this.camera.y));
        
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.save();
        ctx.translate(-this.camera.x, -this.camera.y);
        
        // Draw terrain
        const ts = cfg.TILE_SIZE;
        const startX = Math.max(0, Math.floor(this.camera.x / ts));
        const startY = Math.max(0, Math.floor(this.camera.y / ts));
        const endX = Math.min(AbyssMap.terrain[0].length, Math.ceil((this.camera.x + this.canvas.width) / ts) + 1);
        const endY = Math.min(AbyssMap.terrain.length, Math.ceil((this.camera.y + this.canvas.height) / ts) + 1);
        
        // Batch render floors first, then walls
        ctx.fillStyle = '#1a1a2e';
        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                if (AbyssMap.terrain[y][x] === AbyssMap.TERRAIN.FLOOR) {
                    ctx.fillRect(x * ts, y * ts, ts, ts);
                }
            }
        }
        
        // Walls with slight 3D effect
        ctx.fillStyle = '#0a0a14';
        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                if (AbyssMap.terrain[y][x] === AbyssMap.TERRAIN.WALL) {
                    ctx.fillRect(x * ts, y * ts, ts, ts);
                    // Wall "height" shadow
                    ctx.fillStyle = '#050508';
                    ctx.fillRect(x * ts, y * ts + ts - 4, ts, 4);
                    ctx.fillStyle = '#0a0a14';
                }
            }
        }
        
        // Draw POI glows on canvas (glows can be tilted, sprites will be DOM elements)
        for (const poi of state.pois) {
            if (poi.collected || poi.revealProgress <= 0) continue;
            
            ctx.save();
            ctx.globalAlpha = poi.revealProgress;
            
            // Glow effect on canvas
            const glowAlpha = 0.3 * poi.revealProgress;
            const grad = ctx.createRadialGradient(poi.x, poi.y, 0, poi.x, poi.y, 35);
            grad.addColorStop(0, `rgba(232,169,62,${glowAlpha})`);
            grad.addColorStop(1, 'rgba(232,169,62,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(poi.x, poi.y, 35, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.restore();
        }
        
        // Draw lantern glow (under player)
        const radius = state.getLanternRadius();
        
        // Outer ambient glow
        const outerGlow = ctx.createRadialGradient(state.playerX, state.playerY, 0, state.playerX, state.playerY, radius);
        outerGlow.addColorStop(0, 'rgba(255,180,80,0.25)');
        outerGlow.addColorStop(0.3, 'rgba(255,150,50,0.12)');
        outerGlow.addColorStop(0.7, 'rgba(255,100,30,0.05)');
        outerGlow.addColorStop(1, 'rgba(255,80,20,0)');
        ctx.fillStyle = outerGlow;
        ctx.beginPath();
        ctx.arc(state.playerX, state.playerY, radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner bright glow
        const innerGlow = ctx.createRadialGradient(state.playerX, state.playerY, 0, state.playerX, state.playerY, 60);
        innerGlow.addColorStop(0, 'rgba(255,230,180,0.3)');
        innerGlow.addColorStop(1, 'rgba(255,200,100,0)');
        ctx.fillStyle = innerGlow;
        ctx.beginPath();
        ctx.arc(state.playerX, state.playerY, 60, 0, Math.PI * 2);
        ctx.fill();
        
        // Player shadow on canvas
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.ellipse(state.playerX + 4, state.playerY + cfg.PLAYER_SIZE / 2 + 4, cfg.PLAYER_SIZE / 2, cfg.PLAYER_SIZE / 4, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw shroud on top
        ctx.drawImage(AbyssShroud.getCanvas(), 0, 0);
        
        ctx.restore();
        
        // === POST-PROCESSING EFFECTS (screen space) ===
        
        // Vignette effect for depth
        const vignette = ctx.createRadialGradient(
            this.canvas.width / 2, this.canvas.height / 2, this.canvas.height * 0.3,
            this.canvas.width / 2, this.canvas.height / 2, this.canvas.height * 0.8
        );
        vignette.addColorStop(0, 'rgba(0,0,0,0)');
        vignette.addColorStop(1, 'rgba(0,0,0,0.6)');
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Warm lantern glow overlay in center of screen
        const warmGlow = ctx.createRadialGradient(
            this.canvas.width / 2, this.canvas.height / 2, 0,
            this.canvas.width / 2, this.canvas.height / 2, 200
        );
        warmGlow.addColorStop(0, 'rgba(255,200,100,0.08)');
        warmGlow.addColorStop(1, 'rgba(255,150,50,0)');
        ctx.fillStyle = warmGlow;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Update DOM sprite positions (these are counter-rotated to appear flat)
        this.updateSprites();
    },
    
    updateSprites() {
        const state = AbyssState;
        const cfg = AbyssConfig;
        const containerRect = this.container.getBoundingClientRect();
        
        // Track all sprites with their Y positions for z-ordering
        const spriteDepths = [];
        
        // === UPDATE PLAYER ===
        if (this.playerMarker && this.playerSprite) {
            // Position marker in tilted canvas space
            const playerCanvasX = state.playerX - this.camera.x;
            const playerCanvasY = state.playerY - this.camera.y;
            this.playerMarker.style.left = playerCanvasX + 'px';
            this.playerMarker.style.top = playerCanvasY + 'px';
            
            // Get marker's actual screen position (after tilt transform)
            const markerRect = this.playerMarker.getBoundingClientRect();
            const screenX = markerRect.left - containerRect.left;
            const screenY = markerRect.top - containerRect.top;
            
            // Position sprite on flat overlay at that screen position
            this.playerSprite.style.left = (screenX - 32) + 'px';
            this.playerSprite.style.top = (screenY - 32) + 'px';
            
            // Track for z-ordering (use world Y for consistent depth)
            spriteDepths.push({ element: this.playerSprite, worldY: state.playerY });
        }
        
        // === UPDATE POIs ===
        for (const poi of state.pois) {
            // Create marker and sprite if they don't exist
            if (!this.poiMarkers[poi.id]) {
                this.createPOIMarker(poi);
            }
            if (!this.poiSprites[poi.id]) {
                this.createPOISprite(poi);
            }
            
            const marker = this.poiMarkers[poi.id];
            const sprite = this.poiSprites[poi.id];
            if (!marker || !sprite) continue;
            
            if (poi.collected) {
                sprite.style.display = 'none';
                marker.style.display = 'none';
                continue;
            }
            
            sprite.style.display = 'block';
            marker.style.display = 'block';
            
            // Position marker in tilted canvas space
            const poiCanvasX = poi.x - this.camera.x;
            const poiCanvasY = poi.y - this.camera.y;
            marker.style.left = poiCanvasX + 'px';
            marker.style.top = poiCanvasY + 'px';
            
            // Get marker's actual screen position (after tilt transform)
            const markerRect = marker.getBoundingClientRect();
            const screenX = markerRect.left - containerRect.left;
            const screenY = markerRect.top - containerRect.top;
            
            // Position sprite on flat overlay at that screen position
            sprite.style.left = screenX + 'px';
            sprite.style.top = screenY + 'px';
            sprite.style.transform = 'translate(-50%, -50%)';
            
            // Fade based on revealProgress
            sprite.style.opacity = poi.revealProgress;
            
            // Track for z-ordering (use world Y for consistent depth)
            spriteDepths.push({ element: sprite, worldY: poi.y });
        }
        
        // === APPLY Z-ORDERING ===
        // Objects with higher Y (lower on screen / "in front") get higher z-index
        spriteDepths.sort((a, b) => a.worldY - b.worldY);
        spriteDepths.forEach((item, index) => {
            item.element.style.zIndex = index + 1;
        });
    },
    
    cleanup() {
        if (this.wrapper && this.wrapper.parentNode) {
            this.wrapper.parentNode.removeChild(this.wrapper);
        }
        if (this.spriteOverlay && this.spriteOverlay.parentNode) {
            this.spriteOverlay.parentNode.removeChild(this.spriteOverlay);
        }
        this.poiSprites = {};
        this.poiMarkers = {};
        this.playerSprite = null;
        this.playerMarker = null;
        this.markerContainer = null;
        this.spriteOverlay = null;
    }
};

// ==================== UI ====================

window.AbyssUI = {
    container: null,
    messageTimeout: null,
    
    init() {
        // Inject styles
        if (!document.getElementById('abyss-styles')) {
            const style = document.createElement('style');
            style.id = 'abyss-styles';
            style.textContent = `
                #abyss-container { position:fixed; inset:0; z-index:15000; background:#000; }
                .abyss-hud { position:absolute; top:20px; left:20px; right:20px; display:flex; justify-content:space-between; pointer-events:none; z-index:100; }
                .abyss-timer-box { display:flex; align-items:center; gap:12px; background:rgba(10,10,20,0.9); padding:12px 20px; border-radius:8px; border:1px solid rgba(232,169,62,0.3); }
                .abyss-timer { font-family:Cinzel,serif; font-size:28px; font-weight:700; color:#e8a93e; }
                .abyss-timer.low { color:#e85a5a; animation:pulse 0.5s infinite; }
                @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
                .abyss-stats { display:flex; flex-direction:column; gap:6px; background:rgba(10,10,20,0.9); padding:12px 16px; border-radius:8px; border:1px solid rgba(232,169,62,0.3); }
                .abyss-stat { font-family:Cinzel,serif; font-size:14px; color:#c4a35a; }
                .abyss-floor { position:absolute; top:20px; left:50%; transform:translateX(-50%); font-family:Cinzel,serif; font-size:16px; color:#e8a93e; background:rgba(10,10,20,0.9); padding:8px 20px; border-radius:8px; border:1px solid rgba(232,169,62,0.3); z-index:100; }
                .abyss-controls { position:absolute; bottom:20px; left:50%; transform:translateX(-50%); font-family:Cinzel,serif; font-size:12px; color:rgba(196,163,90,0.6); background:rgba(10,10,20,0.7); padding:8px 16px; border-radius:4px; z-index:100; }
                .abyss-message { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); background:rgba(15,15,25,0.95); padding:24px 40px; border-radius:12px; border:2px solid #e8a93e; text-align:center; z-index:200; opacity:0; transition:opacity 0.3s; pointer-events:none; }
                .abyss-message.show { opacity:1; }
                .abyss-message-title { font-family:Cinzel,serif; font-size:20px; color:#e8a93e; margin-bottom:8px; }
                .abyss-message-text { font-family:Cinzel,serif; font-size:16px; color:#c4a35a; }
                .abyss-pause { position:absolute; inset:0; background:rgba(0,0,0,0.9); display:flex; flex-direction:column; justify-content:center; align-items:center; z-index:300; opacity:0; pointer-events:none; transition:opacity 0.3s; }
                .abyss-pause.show { opacity:1; pointer-events:auto; }
                .abyss-pause-title { font-family:Cinzel,serif; font-size:48px; color:#e8a93e; margin-bottom:40px; }
                .abyss-btn { font-family:Cinzel,serif; font-size:18px; padding:14px 40px; background:rgba(232,169,62,0.2); border:2px solid #e8a93e; border-radius:8px; color:#e8a93e; cursor:pointer; margin:8px; }
                .abyss-btn:hover { background:rgba(232,169,62,0.4); }
                .abyss-btn.danger { border-color:#e85a5a; color:#e85a5a; }
                .abyss-setup { position:fixed; inset:0; background:linear-gradient(180deg,#050510,#0a0a18); display:flex; flex-direction:column; justify-content:center; align-items:center; z-index:25000; }
                .abyss-setup-title { font-family:Cinzel,serif; font-size:56px; color:#e8a93e; letter-spacing:12px; margin-bottom:8px; }
                .abyss-setup-sub { font-family:Cinzel,serif; font-size:14px; color:#8b7355; letter-spacing:4px; margin-bottom:40px; }
                .abyss-decks { display:grid; grid-template-columns:repeat(2,1fr); gap:16px; margin-bottom:32px; max-width:500px; }
                .abyss-deck { background:rgba(20,20,35,0.8); border:2px solid rgba(232,169,62,0.3); border-radius:12px; padding:20px; cursor:pointer; transition:all 0.3s; }
                .abyss-deck:hover { border-color:rgba(232,169,62,0.6); transform:translateY(-4px); }
                .abyss-deck.selected { border-color:#e8a93e; background:rgba(232,169,62,0.15); }
                .abyss-deck-name { font-family:Cinzel,serif; font-size:16px; color:#e8a93e; margin-bottom:4px; }
                .abyss-deck-desc { font-size:12px; color:#8b7355; }
                .abyss-start { font-family:Cinzel,serif; font-size:20px; padding:16px 60px; background:linear-gradient(135deg,#e8a93e,#c45c26); border:none; border-radius:8px; color:#0a0a14; cursor:pointer; }
                .abyss-start:disabled { opacity:0.5; cursor:not-allowed; }
                .abyss-back { position:absolute; top:24px; left:24px; font-family:Cinzel,serif; font-size:14px; padding:10px 20px; background:transparent; border:1px solid rgba(232,169,62,0.5); border-radius:6px; color:#c4a35a; cursor:pointer; }
            `;
            document.head.appendChild(style);
        }
        
        // Create container
        this.container = document.createElement('div');
        this.container.id = 'abyss-container';
        this.container.style.display = 'none';
        this.container.innerHTML = `
            <div class="abyss-hud">
                <div class="abyss-timer-box">
                    <span style="font-size:28px">🏮</span>
                    <span class="abyss-timer" id="abyss-timer">90</span>
                </div>
                <div class="abyss-stats">
                    <div class="abyss-stat">🔥 <span id="abyss-embers">0</span> Embers</div>
                    <div class="abyss-stat">💀 <span id="abyss-deaths">0</span>/<span id="abyss-maxdeaths">10</span></div>
                    <div class="abyss-stat">📦 <span id="abyss-pois">0</span> POIs</div>
                </div>
            </div>
            <div class="abyss-floor" id="abyss-floor">Floor 1 - Battle 0/3</div>
            <div class="abyss-controls">WASD to move • E to interact • ESC to pause</div>
            <div class="abyss-message" id="abyss-message">
                <div class="abyss-message-title" id="abyss-msg-title"></div>
                <div class="abyss-message-text" id="abyss-msg-text"></div>
            </div>
            <div class="abyss-pause" id="abyss-pause">
                <div class="abyss-pause-title">PAUSED</div>
                <button class="abyss-btn" id="abyss-resume">Resume</button>
                <button class="abyss-btn danger" id="abyss-abandon">Abandon Run</button>
            </div>
        `;
        document.body.appendChild(this.container);
        
        document.getElementById('abyss-resume').onclick = () => this.togglePause();
        document.getElementById('abyss-abandon').onclick = () => AbyssEngine.abandonRun();
    },
    
    show() { this.container.style.display = 'block'; },
    hide() { this.container.style.display = 'none'; },
    
    update() {
        const s = AbyssState;
        const timer = document.getElementById('abyss-timer');
        timer.textContent = Math.ceil(s.timeRemaining);
        timer.className = 'abyss-timer' + (s.timeRemaining <= 15 ? ' low' : '');
        document.getElementById('abyss-embers').textContent = s.embers;
        document.getElementById('abyss-deaths').textContent = s.deadCryptidCount;
        document.getElementById('abyss-maxdeaths').textContent = s.getMaxDeaths();
        document.getElementById('abyss-pois').textContent = s.totalPOIsCollected;
        document.getElementById('abyss-floor').textContent = 'Floor ' + s.currentFloor + ' - Battle ' + s.battlesCompleted + '/' + AbyssConfig.BATTLES_PER_FLOOR;
    },
    
    togglePause() {
        const pause = document.getElementById('abyss-pause');
        const showing = pause.classList.toggle('show');
        AbyssState.isPaused = showing;
    },
    
    showMessage(title, text) {
        const msg = document.getElementById('abyss-message');
        document.getElementById('abyss-msg-title').textContent = title;
        document.getElementById('abyss-msg-text').textContent = text;
        msg.classList.add('show');
        clearTimeout(this.messageTimeout);
        this.messageTimeout = setTimeout(() => {
            msg.classList.remove('show');
            AbyssPOI.resumeTimer();
        }, 2000);
    },
    
    openSetup() {
        const setup = document.createElement('div');
        setup.className = 'abyss-setup';
        setup.id = 'abyss-setup';
        
        const decks = [
            { id: 'city-of-flesh', name: 'City of Flesh', desc: 'Blood magic and sacrifice' },
            { id: 'forests-of-fear', name: 'Forests of Fear', desc: 'Nature and growth' },
            { id: 'abhorrent-armory', name: 'Abhorrent Armory', desc: 'Steel and machinery' },
            { id: 'putrid-swamp', name: 'Putrid Swamp', desc: 'Poison and decay' }
        ];
        
        setup.innerHTML = `
            <button class="abyss-back" id="abyss-back">← Back</button>
            <div class="abyss-setup-title">ABYSS</div>
            <div class="abyss-setup-sub">DESCEND INTO DARKNESS</div>
            <div class="abyss-decks" id="abyss-decks">
                ${decks.map(d => `<div class="abyss-deck" data-deck="${d.id}"><div class="abyss-deck-name">${d.name}</div><div class="abyss-deck-desc">${d.desc}</div></div>`).join('')}
            </div>
            <button class="abyss-start" id="abyss-go" disabled>Begin Descent</button>
        `;
        document.body.appendChild(setup);
        
        let selected = null;
        document.getElementById('abyss-back').onclick = () => {
            setup.remove();
            if (typeof HomeScreen !== 'undefined') HomeScreen.show();
        };
        
        setup.querySelectorAll('.abyss-deck').forEach(el => {
            el.onclick = () => {
                setup.querySelectorAll('.abyss-deck').forEach(e => e.classList.remove('selected'));
                el.classList.add('selected');
                selected = el.dataset.deck;
                document.getElementById('abyss-go').disabled = false;
            };
        });
        
        document.getElementById('abyss-go').onclick = () => {
            if (selected) {
                setup.remove();
                AbyssEngine.startRun(selected);
            }
        };
    },
    
    cleanup() {
        if (this.container) this.container.remove();
    }
};

// ==================== ENGINE ====================

window.AbyssEngine = {
    animFrame: null,
    lastTime: 0,
    
    startRun(deck) {
        console.log('[ABYSS] Starting run with deck:', deck);
        
        AbyssState.reset();
        AbyssState.isActive = true;
        AbyssState.deckArchetype = deck;
        
        // Initialize starter deck based on chosen archetype
        this.initializeStarterDeck(deck);
        
        AbyssMap.init();
        AbyssShroud.init();
        AbyssPOI.generate();
        
        AbyssState.playerX = AbyssMap.spawnPoint.x;
        AbyssState.playerY = AbyssMap.spawnPoint.y;
        
        AbyssPlayer.init();
        AbyssRenderer.init(AbyssUI.container);
        AbyssUI.show();
        
        this.lastTime = performance.now();
        this.gameLoop();
    },
    
    // Initialize starter deck for a new run
    initializeStarterDeck(deckType) {
        const starterCards = [];
        
        // Define starter decks for each archetype
        const starterDecks = {
            'city-of-flesh': [
                'vampireInitiate', 'vampireInitiate',
                'rooftopGargoyle', 'rooftopGargoyle',
                'hellpup', 'hellpup', 'hellpup',
                'wakingNightmare', 'wakingNightmare',
                'faceOff'
            ],
            'forests-of-fear': [
                // Placeholder - add forest cryptids when available
                'rooftopGargoyle', 'rooftopGargoyle',
                'vampireInitiate', 'vampireInitiate',
                'hellpup', 'hellpup',
                'wakingNightmare', 'wakingNightmare'
            ],
            'abhorrent-armory': [
                // Placeholder - add armory cryptids when available
                'rooftopGargoyle', 'rooftopGargoyle',
                'vampireInitiate', 'vampireInitiate',
                'hellpup', 'hellpup',
                'wakingNightmare', 'wakingNightmare'
            ],
            'putrid-swamp': [
                // Placeholder - add swamp cryptids when available
                'rooftopGargoyle', 'rooftopGargoyle',
                'vampireInitiate', 'vampireInitiate',
                'hellpup', 'hellpup',
                'wakingNightmare', 'wakingNightmare'
            ]
        };
        
        const deckKeys = starterDecks[deckType] || starterDecks['city-of-flesh'];
        
        for (const key of deckKeys) {
            // Try to get card from different registries
            let card = window.CardRegistry?.getCryptid(key);
            if (!card) card = window.CardRegistry?.getKindling(key);
            if (!card) card = window.CardRegistry?.getBurst(key);
            if (!card) card = window.CardRegistry?.getInstant(key);
            if (!card) card = window.CardRegistry?.getTrap(key);
            if (!card) card = window.CardRegistry?.getAura(key);
            if (!card) card = window.CardRegistry?.getPyre(key);
            
            if (card) {
                starterCards.push({ ...card });
            } else {
                console.warn('[ABYSS] Starter card not found:', key);
            }
        }
        
        AbyssState.starterCards = starterCards;
        console.log('[ABYSS] Starter deck initialized:', starterCards.length, 'cards');
    },
    
    gameLoop() {
        if (!AbyssState.isActive) return;
        
        const now = performance.now();
        const dt = (now - this.lastTime) / 1000;
        this.lastTime = now;
        
        if (!AbyssState.isPaused && !AbyssState.timerPaused) {
            AbyssState.timeRemaining -= dt;
            if (AbyssState.timeRemaining <= 0) {
                AbyssState.timeRemaining = 0;
                this.triggerBattle();
                return;
            }
        }
        
        AbyssPlayer.update(dt);
        AbyssUI.update();
        AbyssRenderer.render();
        
        this.animFrame = requestAnimationFrame(() => this.gameLoop());
    },
    
    async triggerBattle() {
        console.log('[ABYSS] Battle triggered!');
        AbyssState.savedPlayerX = AbyssState.playerX;
        AbyssState.savedPlayerY = AbyssState.playerY;
        AbyssState.isPaused = true;
        cancelAnimationFrame(this.animFrame);
        
        // Get random preset encounter
        const preset = AbyssPresets.getRandomPreset();
        AbyssState.currentEncounter = preset;
        console.log('[ABYSS] Selected encounter:', preset.name, '(' + preset.difficulty + ')');
        
        // Play JRPG battle transition
        await AbyssBattleTransition.play(preset.name);
        
        // Hide abyss UI
        AbyssUI.hide();
        
        // Start the actual battle
        this.startPresetBattle(preset);
    },
    
    startPresetBattle(preset) {
        console.log('[ABYSS] Starting preset battle:', preset.id);
        
        // Configure battle settings for preset mode
        const battleConfig = {
            mode: 'preset',
            playerFirst: true, // Player always goes first in presets
            encounter: preset,
            playerDeck: AbyssState.getBattleDeck(),
            onWin: () => this.onBattleWin(),
            onLose: () => this.onBattleLose(),
            onCryptidDeath: (owner) => {
                if (owner === 'player') {
                    AbyssState.deadCryptidCount++;
                    console.log('[ABYSS] Player cryptid died. Deaths:', AbyssState.deadCryptidCount);
                    if (AbyssState.isDefeated()) {
                        console.log('[ABYSS] Max deaths reached!');
                    }
                }
            }
        };
        
        // Check if initGame is available
        if (typeof window.initGame === 'function') {
            AbyssBattle.start(battleConfig);
        } else {
            // Fallback: simulate battle for testing
            console.log('[ABYSS] Battle system not available. Simulating...');
            this.showBattleSimulation(preset);
        }
    },
    
    // Temporary battle simulation for testing
    showBattleSimulation(preset) {
        const simOverlay = document.createElement('div');
        simOverlay.id = 'abyss-battle-sim';
        simOverlay.style.cssText = `
            position: fixed; inset: 0; z-index: 60000;
            background: linear-gradient(180deg, #1a0a0a, #0a0505);
            display: flex; flex-direction: column; justify-content: center; align-items: center;
            font-family: Cinzel, serif; color: #c4a35a;
        `;
        
        const enemyList = preset.field.map(e => {
            const card = CardRegistry?.getCryptid(e.cardKey) || CardRegistry?.getKindling(e.cardKey);
            return card ? `${card.name} (${e.position})` : e.cardKey;
        }).join('<br>');
        
        simOverlay.innerHTML = `
            <div style="font-size: 32px; color: #e85a5a; margin-bottom: 20px;">${preset.name}</div>
            <div style="font-size: 14px; color: #888; margin-bottom: 30px;">Difficulty: ${preset.difficulty}</div>
            <div style="font-size: 16px; margin-bottom: 30px; text-align: center; line-height: 1.8;">
                <div style="color: #e85a5a; margin-bottom: 10px;">ENEMIES:</div>
                ${enemyList}
                ${preset.trap ? `<br><br><span style="color: #a060a0;">Trap: ${preset.trap}</span>` : ''}
            </div>
            <div style="display: flex; gap: 20px;">
                <button id="sim-win" style="padding: 12px 30px; font-family: Cinzel, serif; font-size: 16px; background: #2a4a2a; border: 2px solid #4a8a4a; color: #8aca8a; cursor: pointer; border-radius: 6px;">Simulate Win</button>
                <button id="sim-lose" style="padding: 12px 30px; font-family: Cinzel, serif; font-size: 16px; background: #4a2a2a; border: 2px solid #8a4a4a; color: #ca8a8a; cursor: pointer; border-radius: 6px;">Simulate Loss</button>
            </div>
        `;
        document.body.appendChild(simOverlay);
        
        document.getElementById('sim-win').onclick = () => {
            simOverlay.remove();
            this.onBattleWin();
        };
        document.getElementById('sim-lose').onclick = () => {
            simOverlay.remove();
            this.onBattleLose();
        };
    },
    
    async onBattleWin() {
        console.log('[ABYSS] Battle won!');
        AbyssState.battlesCompleted++;
        
        // Exit transition
        await AbyssBattleTransition.exit();
        
        if (AbyssState.battlesCompleted >= AbyssConfig.BATTLES_PER_FLOOR) {
            this.completeFloor();
            return;
        }
        
        const refresh = AbyssState.getTimerRefresh();
        AbyssState.timeRemaining = AbyssState.maxTime * refresh;
        console.log('[ABYSS] Timer refreshed to', Math.round(refresh * 100) + '%');
        
        this.returnToMap();
    },
    
    async onBattleLose() {
        console.log('[ABYSS] Battle lost!');
        
        // Exit transition
        await AbyssBattleTransition.exit();
        
        // Check if player has too many deaths
        if (AbyssState.isDefeated()) {
            this.endRun(false);
        } else {
            // Still have lives - return to map but timer continues from where it was
            AbyssState.battlesCompleted++;
            const refresh = AbyssState.getTimerRefresh();
            AbyssState.timeRemaining = AbyssState.maxTime * refresh * 0.5; // Penalty: only 50% timer on loss
            
            this.returnToMap();
        }
    },
    
    completeFloor() {
        console.log('[ABYSS] Floor complete!');
        if (AbyssState.currentFloor >= AbyssConfig.FLOORS_TOTAL) {
            this.endRun(true);
            return;
        }
        
        AbyssState.currentFloor++;
        AbyssState.battlesCompleted = 0;
        AbyssState.timeRemaining = AbyssConfig.INITIAL_TIME;
        AbyssState.maxTime = AbyssConfig.INITIAL_TIME;
        
        AbyssMap.init();
        AbyssShroud.init();
        AbyssPOI.generate();
        AbyssState.playerX = AbyssMap.spawnPoint.x;
        AbyssState.playerY = AbyssMap.spawnPoint.y;
        
        this.returnToMap();
    },
    
    returnToMap() {
        AbyssState.playerX = AbyssState.savedPlayerX;
        AbyssState.playerY = AbyssState.savedPlayerY;
        AbyssState.isPaused = false;
        AbyssState.isActive = true;
        AbyssUI.show();
        this.lastTime = performance.now();
        this.gameLoop();
    },
    
    endRun(victory) {
        console.log('[ABYSS] Run ended -', victory ? 'VICTORY' : 'DEFEAT');
        AbyssState.isActive = false;
        cancelAnimationFrame(this.animFrame);
        AbyssPlayer.cleanup();
        AbyssRenderer.cleanup();
        AbyssUI.hide();
        
        alert(victory ? 
            'VICTORY! Floors: ' + AbyssState.currentFloor + ', POIs: ' + AbyssState.totalPOIsCollected :
            'DEFEAT! Floors: ' + (AbyssState.currentFloor - 1) + ', POIs: ' + AbyssState.totalPOIsCollected
        );
        
        if (typeof HomeScreen !== 'undefined') HomeScreen.show();
    },
    
    abandonRun() {
        if (confirm('Abandon run?')) this.endRun(false);
    }
};

// ==================== INIT ====================

AbyssUI.init();
console.log('[ABYSS] Module loaded');
