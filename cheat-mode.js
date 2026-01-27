/**
 * Cryptid Fates - Cheat Battle Mode
 * Full dev testing mode with visual UI for controlling both players
 */

window.CheatMode = {
    isActive: false,
    aiEnabled: false,
    aiSummonEnabled: true,  // When AI is on, can it summon?
    aiCombatEnabled: true,  // When AI is on, can it attack?
    controllingPlayer: 'player', // Which side is currently being controlled
    
    // ==================== INITIALIZATION ====================
    
    start() {
        this.isActive = true;
        this.aiEnabled = false;
        this.aiSummonEnabled = true;  // Reset to match checkbox default
        this.aiCombatEnabled = true;  // Reset to match checkbox default
        window.cheatMode = true;
        
        // Inject cheat panel into game container
        this.createCheatPanel();
        
        // Override turn system to allow controlling both sides
        this.setupDualControl();
        
        // Start with generous resources
        if (window.game) {
            window.game.playerPyre = 15;
            window.game.enemyPyre = 15;
        }
        
        console.log('🎮 Cheat Mode Active');
    },
    
    stop() {
        this.isActive = false;
        window.cheatMode = false;
        this.removeCheatPanel();
    },
    
    // ==================== CHEAT PANEL UI ====================
    
    createCheatPanel() {
        // Remove existing if present
        this.removeCheatPanel();
        
        const panel = document.createElement('div');
        panel.id = 'cheat-panel';
        panel.innerHTML = `
            <div class="cheat-header">
                <span class="cheat-title">🔧 Dev Tools</span>
                <button class="cheat-minimize" id="cheat-minimize">−</button>
            </div>
            <div class="cheat-body" id="cheat-body">
                <!-- Control Toggle -->
                <div class="cheat-section">
                    <div class="cheat-section-title">Control</div>
                    <div class="cheat-row">
                        <button class="cheat-btn active" id="cheat-control-player" data-side="player">👤 Player</button>
                        <button class="cheat-btn" id="cheat-control-enemy" data-side="enemy">👹 Enemy</button>
                    </div>
                    <div class="cheat-row">
                        <label class="cheat-toggle">
                            <input type="checkbox" id="cheat-ai-toggle">
                            <span>AI Enabled</span>
                        </label>
                    </div>
                    <div class="cheat-row" id="cheat-ai-options" style="display: none;">
                        <label class="cheat-toggle">
                            <input type="checkbox" id="cheat-ai-summon-toggle" checked>
                            <span>AI Summons</span>
                        </label>
                        <label class="cheat-toggle">
                            <input type="checkbox" id="cheat-ai-combat-toggle" checked>
                            <span>AI Attacks</span>
                        </label>
                    </div>
                </div>
                
                <!-- Resources -->
                <div class="cheat-section">
                    <div class="cheat-section-title">Resources</div>
                    <div class="cheat-row">
                        <span>Player Pyre:</span>
                        <button class="cheat-btn-small" onclick="CheatMode.adjustPyre('player', -1)">−</button>
                        <span id="cheat-player-pyre">0</span>
                        <button class="cheat-btn-small" onclick="CheatMode.adjustPyre('player', 1)">+</button>
                        <button class="cheat-btn-small" onclick="CheatMode.setPyre('player', 20)">20</button>
                    </div>
                    <div class="cheat-row">
                        <span>Enemy Pyre:</span>
                        <button class="cheat-btn-small" onclick="CheatMode.adjustPyre('enemy', -1)">−</button>
                        <span id="cheat-enemy-pyre">0</span>
                        <button class="cheat-btn-small" onclick="CheatMode.adjustPyre('enemy', 1)">+</button>
                        <button class="cheat-btn-small" onclick="CheatMode.setPyre('enemy', 20)">20</button>
                    </div>
                </div>
                
                <!-- Deaths -->
                <div class="cheat-section">
                    <div class="cheat-section-title">Death Counters</div>
                    <div class="cheat-row">
                        <span>Player Deaths:</span>
                        <button class="cheat-btn-small" onclick="CheatMode.adjustDeaths('player', -1)">−</button>
                        <span id="cheat-player-deaths">0</span>
                        <button class="cheat-btn-small" onclick="CheatMode.adjustDeaths('player', 1)">+</button>
                    </div>
                    <div class="cheat-row">
                        <span>Enemy Deaths:</span>
                        <button class="cheat-btn-small" onclick="CheatMode.adjustDeaths('enemy', -1)">−</button>
                        <span id="cheat-enemy-deaths">0</span>
                        <button class="cheat-btn-small" onclick="CheatMode.adjustDeaths('enemy', 1)">+</button>
                    </div>
                </div>
                
                <!-- Card Browser -->
                <div class="cheat-section">
                    <div class="cheat-section-title">Add Card to Hand</div>
                    <div class="cheat-row">
                        <select id="cheat-card-series" onchange="CheatMode.updateCardList()">
                            <option value="all">All Cards</option>
                            <option value="city-of-flesh">City of Flesh</option>
                            <option value="forests-of-fear">Forests of Fear</option>
                            <option value="putrid-swamp">Putrid Swamp</option>
                            <option value="abhorrent-armory">Abhorrent Armory</option>
                        </select>
                    </div>
                    <div class="cheat-row">
                        <select id="cheat-card-type" onchange="CheatMode.updateCardList()">
                            <option value="all">All Types</option>
                            <option value="cryptid">Cryptids</option>
                            <option value="kindling">Kindling</option>
                            <option value="pyre">Pyres</option>
                            <option value="trap">Traps</option>
                            <option value="burst">Bursts</option>
                            <option value="aura">Auras</option>
                        </select>
                    </div>
                    <div class="cheat-row">
                        <select id="cheat-card-select" style="flex:1">
                            <option value="">Select card...</option>
                        </select>
                        <button class="cheat-btn" onclick="CheatMode.addSelectedCard()">Add</button>
                    </div>
                </div>
                
                <!-- Quick Actions -->
                <div class="cheat-section">
                    <div class="cheat-section-title">Quick Actions</div>
                    <div class="cheat-row">
                        <button class="cheat-btn" onclick="CheatMode.loadSeries()">Load Series</button>
                        <button class="cheat-btn" onclick="CheatMode.clearHand()">Clear Hand</button>
                    </div>
                    <div class="cheat-row">
                        <button class="cheat-btn" onclick="CheatMode.drawCard()">Draw Card</button>
                        <button class="cheat-btn" onclick="CheatMode.endTurn()">End Turn</button>
                    </div>
                    <div class="cheat-row">
                        <button class="cheat-btn" onclick="CheatMode.resetKindling()">Reset Kindling</button>
                        <button class="cheat-btn" onclick="CheatMode.killSelected()">Kill Selected</button>
                    </div>
                </div>
                
                <!-- Summon to Field -->
                <div class="cheat-section">
                    <div class="cheat-section-title">Summon to Field</div>
                    <div class="cheat-row">
                        <select id="cheat-summon-cryptid" style="flex:1">
                            <option value="">Select cryptid...</option>
                        </select>
                    </div>
                    <div class="cheat-row">
                        <select id="cheat-summon-owner" onchange="CheatMode.updateColLabels()">
                            <option value="player">Player</option>
                            <option value="enemy">Enemy</option>
                        </select>
                        <select id="cheat-summon-col">
                            <option value="0">Support</option>
                            <option value="1">Combat</option>
                        </select>
                        <select id="cheat-summon-row">
                            <option value="0">Row 0</option>
                            <option value="1">Row 1</option>
                            <option value="2">Row 2</option>
                        </select>
                    </div>
                    <div class="cheat-row">
                        <button class="cheat-btn" onclick="CheatMode.summonToField()">Summon</button>
                        <button class="cheat-btn" onclick="CheatMode.clearSlot()">Clear Slot</button>
                    </div>
                    <div class="cheat-row">
                        <button class="cheat-btn" onclick="CheatMode.summonToAllSlots()" style="flex:1; background: linear-gradient(135deg, #6a4a3f, #5a3a2f);">Summon to All Slots</button>
                    </div>
                    <div class="cheat-row">
                        <button class="cheat-btn" onclick="CheatMode.clearAllSlots()" style="flex:1; background: linear-gradient(135deg, #8b4513, #5a3a2f);">🗑️ Clear All Slots</button>
                    </div>
                </div>
                
                <!-- Field Manipulation -->
                <div class="cheat-section">
                    <div class="cheat-section-title">Selected Cryptid</div>
                    <div id="cheat-selected-info" class="cheat-selected-info">
                        Click a cryptid on field to select
                    </div>
                    <div class="cheat-row" id="cheat-cryptid-controls" style="display:none">
                        <button class="cheat-btn-small" onclick="CheatMode.adjustStat('hp', -1)">HP−</button>
                        <button class="cheat-btn-small" onclick="CheatMode.adjustStat('hp', 1)">HP+</button>
                        <button class="cheat-btn-small" onclick="CheatMode.adjustStat('atk', -1)">ATK−</button>
                        <button class="cheat-btn-small" onclick="CheatMode.adjustStat('atk', 1)">ATK+</button>
                    </div>
                    <div class="cheat-row" id="cheat-cryptid-actions" style="display:none">
                        <button class="cheat-btn-small" onclick="CheatMode.healFull()">Heal</button>
                        <button class="cheat-btn-small" onclick="CheatMode.killSelected()">Kill</button>
                        <button class="cheat-btn-small" onclick="CheatMode.toggleTap()">Tap/Untap</button>
                    </div>
                    <!-- Status Ailments -->
                    <div id="cheat-status-section" style="display:none">
                        <div class="cheat-row" style="flex-wrap: wrap;">
                            <button class="cheat-btn-small" onclick="CheatMode.applyStatus('burn')" title="Burn">🔥</button>
                            <button class="cheat-btn-small" onclick="CheatMode.applyStatus('bleed')" title="Bleed">🩸</button>
                            <button class="cheat-btn-small" onclick="CheatMode.applyStatus('paralyze')" title="Paralyze">⚡</button>
                            <button class="cheat-btn-small" onclick="CheatMode.applyStatus('calamity')" title="Calamity">💀</button>
                            <button class="cheat-btn-small" onclick="CheatMode.applyStatus('protect')" title="Protect">🛡️</button>
                            <button class="cheat-btn-small" onclick="CheatMode.applyStatus('focus')" title="Focus">🎯</button>
                            <button class="cheat-btn-small" onclick="CheatMode.applyStatus('flight')" title="Flight">🦅</button>
                            <button class="cheat-btn-small" onclick="CheatMode.applyStatus('hidden')" title="Hidden">👁️</button>
                        </div>
                        <div class="cheat-row">
                            <button class="cheat-btn-small" onclick="CheatMode.clearAllStatuses()">Clear All Status</button>
                        </div>
                    </div>
                    <!-- Apply Ailment to All on Selected Side -->
                    <div id="cheat-mass-ailment-section" style="display:none; margin-top: 8px; padding-top: 8px; border-top: 1px solid #333;">
                        <div style="font-size: 10px; color: #888; margin-bottom: 4px;">Apply to ALL on selected side:</div>
                        <div class="cheat-row" style="flex-wrap: wrap;">
                            <button class="cheat-btn-small" onclick="CheatMode.applyStatusToAll('burn')" title="Burn All">🔥 All</button>
                            <button class="cheat-btn-small" onclick="CheatMode.applyStatusToAll('bleed')" title="Bleed All">🩸 All</button>
                            <button class="cheat-btn-small" onclick="CheatMode.applyStatusToAll('paralyze')" title="Paralyze All">⚡ All</button>
                            <button class="cheat-btn-small" onclick="CheatMode.applyStatusToAll('calamity')" title="Calamity All">💀 All</button>
                        </div>
                        <div class="cheat-row">
                            <button class="cheat-btn-small" onclick="CheatMode.clearAllStatusesOnSide()" style="flex:1;">Clear All on Side</button>
                        </div>
                    </div>
                </div>
                
                <!-- Event Log Toggle -->
                <div class="cheat-section">
                    <div class="cheat-row">
                        <label class="cheat-toggle">
                            <input type="checkbox" id="cheat-log-toggle" onchange="CheatMode.toggleEventLog()">
                            <span>Event Logging</span>
                        </label>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(panel);
        
        // Add styles
        this.injectStyles();
        
        // Bind events
        this.bindEvents();
        
        // Populate card list
        this.updateCardList();
        
        // Populate summon dropdown
        this.populateSummonDropdown();
        
        // Update display
        this.updateDisplay();
    },
    
    removeCheatPanel() {
        document.getElementById('cheat-panel')?.remove();
        document.getElementById('cheat-mode-styles')?.remove();
    },
    
    injectStyles() {
        if (document.getElementById('cheat-mode-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'cheat-mode-styles';
        style.textContent = `
            #cheat-panel {
                position: fixed;
                top: 10px;
                right: 10px;
                width: 280px;
                background: rgba(20, 20, 30, 0.95);
                border: 2px solid #4a3f6a;
                border-radius: 8px;
                z-index: 10000;
                font-family: 'Source Sans Pro', sans-serif;
                font-size: 12px;
                color: #ddd;
                box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            }
            
            .cheat-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 12px;
                background: linear-gradient(135deg, #3a2f5a, #2a1f4a);
                border-bottom: 1px solid #4a3f6a;
                border-radius: 6px 6px 0 0;
                cursor: move;
            }
            
            .cheat-title {
                font-weight: bold;
                color: #ffd700;
            }
            
            .cheat-minimize {
                background: none;
                border: none;
                color: #aaa;
                font-size: 18px;
                cursor: pointer;
                padding: 0 5px;
            }
            .cheat-minimize:hover { color: #fff; }
            
            .cheat-body {
                padding: 8px;
                max-height: 70vh;
                overflow-y: auto;
            }
            
            .cheat-body.collapsed {
                display: none;
            }
            
            .cheat-section {
                margin-bottom: 10px;
                padding: 8px;
                background: rgba(255,255,255,0.05);
                border-radius: 4px;
            }
            
            .cheat-section-title {
                font-size: 11px;
                color: #888;
                text-transform: uppercase;
                margin-bottom: 6px;
                border-bottom: 1px solid #333;
                padding-bottom: 4px;
            }
            
            .cheat-row {
                display: flex;
                align-items: center;
                gap: 6px;
                margin-bottom: 6px;
            }
            
            .cheat-btn {
                padding: 5px 10px;
                background: linear-gradient(135deg, #4a3f6a, #3a2f5a);
                border: 1px solid #5a4f7a;
                border-radius: 4px;
                color: #ddd;
                cursor: pointer;
                font-size: 11px;
                transition: all 0.2s;
            }
            .cheat-btn:hover {
                background: linear-gradient(135deg, #5a4f7a, #4a3f6a);
                border-color: #7a6f9a;
            }
            .cheat-btn.active {
                background: linear-gradient(135deg, #6a5f8a, #5a4f7a);
                border-color: #ffd700;
                color: #ffd700;
            }
            
            .cheat-btn-small {
                padding: 3px 8px;
                background: #333;
                border: 1px solid #555;
                border-radius: 3px;
                color: #ddd;
                cursor: pointer;
                font-size: 11px;
            }
            .cheat-btn-small:hover {
                background: #444;
                border-color: #777;
            }
            
            .cheat-toggle {
                display: flex;
                align-items: center;
                gap: 8px;
                cursor: pointer;
            }
            .cheat-toggle input {
                width: 16px;
                height: 16px;
                cursor: pointer;
            }
            
            #cheat-panel select {
                padding: 4px;
                background: #2a2a3a;
                border: 1px solid #444;
                border-radius: 3px;
                color: #ddd;
                font-size: 11px;
            }
            
            .cheat-selected-info {
                padding: 6px;
                background: rgba(0,0,0,0.3);
                border-radius: 3px;
                font-size: 11px;
                color: #aaa;
                margin-bottom: 6px;
            }
            
            /* Highlight controlled side */
            .cheat-control-enemy .player-info.enemy {
                box-shadow: 0 0 10px #ffd700;
            }
            .cheat-control-player .player-info.player {
                box-shadow: 0 0 10px #ffd700;
            }
            
            /* Make enemy hand visible in cheat mode */
            .cheat-mode-active #enemy-hand-area {
                opacity: 1 !important;
                pointer-events: auto !important;
            }
            .cheat-mode-active .enemy-card {
                transform: rotateX(0deg) !important;
            }
            
            /* Selected cryptid highlight */
            .cryptid-sprite.cheat-selected {
                outline: 3px solid #ffd700 !important;
                outline-offset: 2px;
                animation: cheatSelectedPulse 1s ease-in-out infinite;
            }
            
            @keyframes cheatSelectedPulse {
                0%, 100% { outline-color: #ffd700; }
                50% { outline-color: #ff8800; }
            }
            
            /* Status button styling */
            #cheat-status-section .cheat-btn-small {
                min-width: 32px;
                font-size: 14px;
            }
        `;
        document.head.appendChild(style);
    },
    
    bindEvents() {
        // Minimize toggle
        document.getElementById('cheat-minimize')?.addEventListener('click', () => {
            const body = document.getElementById('cheat-body');
            body.classList.toggle('collapsed');
            document.getElementById('cheat-minimize').textContent = body.classList.contains('collapsed') ? '+' : '−';
        });
        
        // Control toggle
        document.getElementById('cheat-control-player')?.addEventListener('click', () => this.setControl('player'));
        document.getElementById('cheat-control-enemy')?.addEventListener('click', () => this.setControl('enemy'));
        
        // AI toggle
        document.getElementById('cheat-ai-toggle')?.addEventListener('change', (e) => {
            this.aiEnabled = e.target.checked;
            // Show/hide granular options
            const optionsRow = document.getElementById('cheat-ai-options');
            if (optionsRow) {
                optionsRow.style.display = this.aiEnabled ? 'flex' : 'none';
            }
            console.log('AI:', this.aiEnabled ? 'Enabled' : 'Disabled');
        });
        
        // AI summon toggle
        document.getElementById('cheat-ai-summon-toggle')?.addEventListener('change', (e) => {
            this.aiSummonEnabled = e.target.checked;
            console.log('AI Summons:', this.aiSummonEnabled ? 'Enabled' : 'Disabled');
        });
        
        // AI combat toggle
        document.getElementById('cheat-ai-combat-toggle')?.addEventListener('change', (e) => {
            this.aiCombatEnabled = e.target.checked;
            console.log('AI Combat:', this.aiCombatEnabled ? 'Enabled' : 'Disabled');
        });
        
        // Make panel draggable
        this.makeDraggable();
        
        // Click on field cryptids to select them
        this.setupFieldSelection();
    },
    
    makeDraggable() {
        const panel = document.getElementById('cheat-panel');
        const header = panel.querySelector('.cheat-header');
        let isDragging = false;
        let startX, startY, startLeft, startTop;
        
        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startLeft = panel.offsetLeft;
            startTop = panel.offsetTop;
            panel.style.transition = 'none';
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            panel.style.left = (startLeft + e.clientX - startX) + 'px';
            panel.style.top = (startTop + e.clientY - startY) + 'px';
            panel.style.right = 'auto';
        });
        
        document.addEventListener('mouseup', () => {
            isDragging = false;
            panel.style.transition = '';
        });
    },
    
    // ==================== CONTROL SYSTEM ====================
    
    setControl(side) {
        this.controllingPlayer = side;
        
        // Update button states
        document.getElementById('cheat-control-player').classList.toggle('active', side === 'player');
        document.getElementById('cheat-control-enemy').classList.toggle('active', side === 'enemy');
        
        // Update body class for visual feedback
        document.body.classList.toggle('cheat-control-player', side === 'player');
        document.body.classList.toggle('cheat-control-enemy', side === 'enemy');
        
        // Enable enemy hand interaction when controlling enemy
        document.body.classList.toggle('cheat-mode-active', side === 'enemy');
        
        console.log('Controlling:', side);
    },
    
    setupDualControl() {
        // Override AI behavior with granular control
        const originalAiPlayCards = window.aiPlayCards;
        window.aiPlayCards = (onComplete) => {
            if (this.isActive) {
                if (!this.aiEnabled) {
                    // AI fully disabled
                    console.log('[Cheat] AI skipped - manual control');
                    if (onComplete) onComplete();
                    return;
                }
                if (!this.aiSummonEnabled) {
                    // AI enabled but summoning disabled
                    console.log('[Cheat] AI summoning skipped');
                    if (onComplete) onComplete();
                    return;
                }
            }
            // AI enabled or not in cheat mode
            if (originalAiPlayCards) originalAiPlayCards(onComplete);
        };
        
        const originalAiCombat = window.aiCombat;
        window.aiCombat = (onComplete) => {
            if (this.isActive) {
                if (!this.aiEnabled) {
                    // AI fully disabled
                    console.log('[Cheat] AI combat skipped - manual control');
                    if (onComplete) onComplete();
                    return;
                }
                if (!this.aiCombatEnabled) {
                    // AI enabled but combat disabled
                    console.log('[Cheat] AI combat skipped - attacks disabled');
                    if (onComplete) onComplete();
                    return;
                }
            }
            if (originalAiCombat) originalAiCombat(onComplete);
        };
    },
    
    setupFieldSelection() {
        // Add click handlers to field tiles (sprites have pointer-events: none)
        document.addEventListener('click', (e) => {
            if (!this.isActive) return;
            
            // Debug: Log what element was clicked
            console.log('[CheatMode] Click target:', e.target.className, e.target);
            
            // First try direct sprite click (in case pointer-events is enabled)
            let sprite = e.target.closest('.cryptid-sprite');
            if (sprite) {
                const owner = sprite.dataset.owner;
                const col = parseInt(sprite.dataset.col);
                const row = parseInt(sprite.dataset.row);
                console.log('[CheatMode] Sprite click:', { owner, col, row });
                this.selectCryptid(owner, col, row);
                return;
            }
            
            // Otherwise check if we clicked a tile that has a cryptid
            const tile = e.target.closest('.tile');
            if (tile) {
                console.log('[CheatMode] Tile click:', tile.dataset);
                
                if (tile.dataset.col !== 'trap') {
                    const owner = tile.dataset.owner;
                    const col = parseInt(tile.dataset.col);
                    const row = parseInt(tile.dataset.row);
                    
                    console.log('[CheatMode] Parsed:', { owner, col, row });
                    
                    // Check if there's a cryptid in this position
                    if (window.game) {
                        const field = owner === 'player' ? window.game.playerField : window.game.enemyField;
                        console.log('[CheatMode] Field lookup:', field[col], 'cryptid at row:', field[col]?.[row]?.name);
                        if (field[col]?.[row]) {
                            this.selectCryptid(owner, col, row);
                        }
                    }
                }
            } else {
                console.log('[CheatMode] No tile found from click');
            }
        });
    },
    
    selectedCryptid: null,
    
    selectCryptid(owner, col, row) {
        if (!window.game) return;
        const field = owner === 'player' ? window.game.playerField : window.game.enemyField;
        const cryptid = field[col]?.[row];
        
        if (cryptid) {
            this.selectedCryptid = { cryptid, owner, col, row };
            
            // Build status string
            const statuses = [];
            if (cryptid.tapped) statuses.push('Tapped');
            if (cryptid.burnTurns > 0) statuses.push(`Burn(${cryptid.burnTurns})`);
            if (cryptid.bleedTurns > 0) statuses.push(`Bleed(${cryptid.bleedTurns})`);
            if (cryptid.paralyzed) statuses.push('Paralyzed');
            if (cryptid.calamityCounters > 0) statuses.push(`Calamity(${cryptid.calamityCounters})`);
            if (cryptid.protectionCharges > 0) statuses.push(`Protected(${cryptid.protectionCharges})`);
            if (cryptid.hasFocus) statuses.push('Focus');
            if (cryptid.hasFlight) statuses.push('Flight');
            if (cryptid.isHidden) statuses.push('Hidden');
            
            // Update info display (col depends on owner)
            // Player: col 0 = Support, col 1 = Combat
            // Enemy: col 0 = Combat, col 1 = Support
            const colName = owner === 'player' 
                ? (col === 0 ? 'Support' : 'Combat')
                : (col === 0 ? 'Combat' : 'Support');
            const info = document.getElementById('cheat-selected-info');
            info.innerHTML = `
                <strong>${cryptid.name}</strong> (${owner})<br>
                HP: ${cryptid.currentHp}/${cryptid.maxHp || cryptid.hp} | ATK: ${cryptid.currentAtk || cryptid.atk}<br>
                Pos: ${colName} col, Row ${row}<br>
                ${statuses.length ? `<span style="color:#f90">${statuses.join(', ')}</span>` : '<span style="color:#888">No statuses</span>'}
            `;
            
            // Show controls
            document.getElementById('cheat-cryptid-controls').style.display = 'flex';
            document.getElementById('cheat-cryptid-actions').style.display = 'flex';
            document.getElementById('cheat-status-section').style.display = 'block';
            document.getElementById('cheat-mass-ailment-section').style.display = 'block';
            
            // Highlight selected
            document.querySelectorAll('.cryptid-sprite').forEach(s => s.classList.remove('cheat-selected'));
            const sprite = document.querySelector(`.cryptid-sprite[data-owner="${owner}"][data-col="${col}"][data-row="${row}"]`);
            sprite?.classList.add('cheat-selected');
        }
    },
    
    // ==================== RESOURCE MANIPULATION ====================
    
    adjustPyre(owner, amount) {
        if (!window.game) return;
        if (owner === 'player') {
            window.game.playerPyre = Math.max(0, window.game.playerPyre + amount);
        } else {
            window.game.enemyPyre = Math.max(0, window.game.enemyPyre + amount);
        }
        this.updateDisplay();
        if (typeof renderAll === 'function') renderAll();
    },
    
    setPyre(owner, amount) {
        if (!window.game) return;
        if (owner === 'player') {
            window.game.playerPyre = amount;
        } else {
            window.game.enemyPyre = amount;
        }
        this.updateDisplay();
        if (typeof renderAll === 'function') renderAll();
    },
    
    adjustDeaths(owner, amount) {
        if (!window.game) return;
        if (owner === 'player') {
            window.game.playerDeaths = Math.max(0, Math.min(10, window.game.playerDeaths + amount));
        } else {
            window.game.enemyDeaths = Math.max(0, Math.min(10, window.game.enemyDeaths + amount));
        }
        this.updateDisplay();
        if (typeof renderAll === 'function') renderAll();
    },
    
    // ==================== CARD MANAGEMENT ====================
    
    // Card series mappings - use actual registered card keys
    cardSeries: {
        'city-of-flesh': {
            cryptids: ['rooftopGargoyle', 'libraryGargoyle', 'sewerAlligator', 'kuchisakeOnna', 
                       'hellhound', 'mothman', 'bogeyman', 'theFlayer', 'decayRat',
                       'vampireInitiate', 'vampireLord', 'moleman', 'redcap'],
            kindling: ['hellpup', 'myling', 'vampireBat', 'gremlin', 'boggart'],
            pyres: ['pyre', 'freshKill', 'ratKing', 'nightfall'],
            traps: ['crossroads', 'bloodCovenant', 'turnToStone'],
            bursts: ['wakingNightmare', 'faceOff'],
            auras: ['antiVampiricBlade']
        },
        'forests-of-fear': {
            cryptids: ['matureWendigo', 'primalWendigo', 'thunderbird', 'snipe', 'adultBigfoot', 
                       'werewolf', 'lycanthrope', 'rogueRazorback', 'notDeer', 'jerseyDevil', 
                       'babaYaga', 'skinwalker'],
            kindling: ['newbornWendigo', 'stormhawk', 'adolescentBigfoot', 'cursedHybrid', 'deerWoman'],
            pyres: ['burialGround', 'cursedWoods', 'animalPelts'],
            traps: ['terrify', 'hunt'],
            bursts: ['fullMoon'],
            auras: ['dauntingPresence', 'sproutWings', 'weaponizedTree', 'insatiableHunger']
        },
        'putrid-swamp': {
            cryptids: ['zombie', 'crawfishHorror', 'letiche', 'haint', 'ignisFatuus', 'plagueRat',
                       'swampHag', 'effigy', 'platEye', 'spiritFire', 'booHag', 'revenant',
                       'rougarou', 'swampStalker', 'mamaBrigitte', 'loupGarou', 'draugrLord', 
                       'baronSamedi', 'honeyIslandMonster'],
            kindling: ['feuFollet', 'swampRat', 'bayouSprite', 'voodooDoll', 'platEyePup'],
            pyres: ['grisGrisBag', 'swampGas'],
            traps: ['hungryGround'],
            bursts: ['hexCurse'],
            auras: ['curseVessel']
        },
        'abhorrent-armory': {
            cryptids: [],
            kindling: [],
            pyres: [],
            traps: [],
            bursts: ['rockSlide'],
            auras: []
        }
    },
    
    updateCardList() {
        const seriesSelect = document.getElementById('cheat-card-series');
        const typeSelect = document.getElementById('cheat-card-type');
        const cardSelect = document.getElementById('cheat-card-select');
        
        if (!seriesSelect || !typeSelect || !cardSelect) return;
        
        const series = seriesSelect.value;
        const type = typeSelect.value;
        
        let cards = [];
        
        // Helper to check if card matches series filter
        const matchesSeries = (card, cardKey) => {
            if (series === 'all') return true;
            // Check card's series property if it exists
            if (card.series) return card.series === series;
            // Fallback: check key prefix patterns or known lists
            const seriesData = this.cardSeries[series];
            if (!seriesData) return false;
            // Check all arrays in series data
            return (seriesData.cryptids?.includes(cardKey) ||
                    seriesData.kindling?.includes(cardKey) ||
                    seriesData.pyres?.includes(cardKey) ||
                    seriesData.traps?.includes(cardKey) ||
                    seriesData.bursts?.includes(cardKey) ||
                    seriesData.auras?.includes(cardKey));
        };
        
        // Always pull cards from registry (series filter is advisory)
        if (type === 'all' || type === 'cryptid') {
            CardRegistry.getAllCryptidKeys().forEach(key => {
                const card = CardRegistry.getCryptid(key);
                if (card && matchesSeries(card, key)) {
                    cards.push({ key, name: card.name, type: 'cryptid' });
                }
            });
        }
        if (type === 'all' || type === 'kindling') {
            CardRegistry.getAllKindlingKeys().forEach(key => {
                const card = CardRegistry.getKindling(key);
                if (card && matchesSeries(card, key)) {
                    cards.push({ key, name: card.name, type: 'kindling' });
                }
            });
        }
        if (type === 'all' || type === 'pyre') {
            CardRegistry.getAllPyreKeys().forEach(key => {
                const card = CardRegistry.getPyre(key);
                if (card && matchesSeries(card, key)) {
                    cards.push({ key, name: card.name, type: 'pyre' });
                }
            });
        }
        if (type === 'all' || type === 'trap') {
            CardRegistry.getAllTrapKeys().forEach(key => {
                const card = CardRegistry.getTrap(key);
                if (card && matchesSeries(card, key)) {
                    cards.push({ key, name: card.name, type: 'trap' });
                }
            });
        }
        if (type === 'all' || type === 'burst') {
            CardRegistry.getAllBurstKeys().forEach(key => {
                const card = CardRegistry.getBurst(key);
                if (card && matchesSeries(card, key)) {
                    cards.push({ key, name: card.name, type: 'burst' });
                }
            });
        }
        if (type === 'all' || type === 'aura') {
            CardRegistry.getAllAuraKeys().forEach(key => {
                const card = CardRegistry.getAura(key);
                if (card && matchesSeries(card, key)) {
                    cards.push({ key, name: card.name, type: 'aura' });
                }
            });
        }
        
        // Sort alphabetically
        cards.sort((a, b) => a.name.localeCompare(b.name));
        
        // Populate select
        cardSelect.innerHTML = '<option value="">Select card...</option>';
        cards.forEach(card => {
            const opt = document.createElement('option');
            opt.value = card.key + '|' + card.type;
            opt.textContent = `${card.name} (${card.type})`;
            cardSelect.appendChild(opt);
        });
    },
    
    addSelectedCard() {
        const select = document.getElementById('cheat-card-select');
        const value = select.value;
        if (!value) return;
        
        const [key, type] = value.split('|');
        this.addCard(key, type);
    },
    
    addCard(key, type) {
        if (!window.game) return;
        
        let card = null;
        switch (type) {
            case 'cryptid': card = CardRegistry.getCryptid(key); break;
            case 'kindling': card = CardRegistry.getKindling(key); break;
            case 'pyre': card = CardRegistry.getPyre(key); break;
            case 'trap': card = CardRegistry.getTrap(key); break;
            case 'burst': card = CardRegistry.getBurst(key); break;
            case 'aura': card = CardRegistry.getAura(key); break;
        }
        
        if (!card) {
            console.warn('Card not found:', key);
            return;
        }
        
        if (!window.game) return;
        const owner = this.controllingPlayer;
        const hand = owner === 'player' ? window.game.playerHand : window.game.enemyHand;
        // Generate unique ID for each card added to hand
        const cardCopy = {...card, id: Math.random().toString(36).substr(2, 9)};
        hand.push(cardCopy);
        
        if (typeof renderAll === 'function') renderAll();
        console.log(`Added ${card.name} to ${owner} hand`);
    },
    
    loadSeries() {
        const series = document.getElementById('cheat-card-series').value;
        if (series === 'all') {
            alert('Select a specific series first');
            return;
        }
        
        if (!window.game) {
            alert('Start a game first!');
            return;
        }
        
        const owner = this.controllingPlayer;
        const hand = owner === 'player' ? window.game.playerHand : window.game.enemyHand;
        
        // Clear hand
        hand.length = 0;
        
        // Add all cards from series
        const seriesData = this.cardSeries[series];
        if (!seriesData) return;
        
        const addCards = (keys, getter) => {
            keys?.forEach(key => {
                const card = getter(key);
                // Generate unique ID for each card added to hand
                if (card) hand.push({...card, id: Math.random().toString(36).substr(2, 9)});
            });
        };
        
        addCards(seriesData.cryptids, k => CardRegistry.getCryptid(k));
        addCards(seriesData.kindling, k => CardRegistry.getKindling(k));
        addCards(seriesData.pyres, k => CardRegistry.getPyre(k));
        addCards(seriesData.traps, k => CardRegistry.getTrap(k));
        addCards(seriesData.bursts, k => CardRegistry.getBurst(k));
        addCards(seriesData.auras, k => CardRegistry.getAura(k));
        
        // Give generous pyre
        if (owner === 'player') window.game.playerPyre = 20;
        else window.game.enemyPyre = 20;
        
        this.updateDisplay();
        if (typeof renderAll === 'function') renderAll();
        console.log(`Loaded ${series} for ${owner}`);
    },
    
    clearHand() {
        if (!window.game) return;
        const owner = this.controllingPlayer;
        const hand = owner === 'player' ? window.game.playerHand : window.game.enemyHand;
        hand.length = 0;
        if (typeof renderAll === 'function') renderAll();
    },
    
    drawCard() {
        if (!window.game) return;
        const owner = this.controllingPlayer;
        window.game.drawCard(owner);
        if (typeof renderAll === 'function') renderAll();
    },
    
    endTurn() {
        if (window.game) {
            window.game.endTurn();
            if (typeof renderAll === 'function') renderAll();
        }
    },
    
    resetKindling() {
        if (!window.game) return;
        
        // Rebuild kindling pools
        if (typeof DeckBuilder !== 'undefined' && DeckBuilder.buildKindlingPool) {
            window.game.playerKindling = DeckBuilder.buildKindlingPool();
            window.game.enemyKindling = DeckBuilder.buildKindlingPool();
            console.log('Kindling pools reset');
        }
    },
    
    // ==================== CRYPTID MANIPULATION ====================
    
    adjustStat(stat, amount) {
        if (!this.selectedCryptid) return;
        const { cryptid } = this.selectedCryptid;
        
        if (stat === 'hp') {
            cryptid.currentHp = Math.max(1, (cryptid.currentHp || cryptid.hp) + amount);
            if (amount > 0) {
                cryptid.maxHp = Math.max(cryptid.maxHp || cryptid.hp, cryptid.currentHp);
            }
        } else if (stat === 'atk') {
            cryptid.currentAtk = Math.max(0, (cryptid.currentAtk || cryptid.atk) + amount);
        }
        
        this.selectCryptid(this.selectedCryptid.owner, this.selectedCryptid.col, this.selectedCryptid.row);
        if (typeof renderAll === 'function') renderAll();
    },
    
    healFull() {
        if (!this.selectedCryptid) return;
        const { cryptid } = this.selectedCryptid;
        cryptid.currentHp = cryptid.maxHp || cryptid.hp;
        this.selectCryptid(this.selectedCryptid.owner, this.selectedCryptid.col, this.selectedCryptid.row);
        if (typeof renderAll === 'function') renderAll();
    },
    
    killSelected() {
        if (!this.selectedCryptid || !window.game) return;
        const { cryptid, owner } = this.selectedCryptid;
        window.game.killCryptid(cryptid, owner === 'player' ? 'enemy' : 'player');
        this.selectedCryptid = null;
        document.getElementById('cheat-selected-info').textContent = 'Click a cryptid on field to select';
        document.getElementById('cheat-cryptid-controls').style.display = 'none';
        document.getElementById('cheat-cryptid-actions').style.display = 'none';
        if (typeof renderAll === 'function') renderAll();
    },
    
    toggleTap() {
        if (!this.selectedCryptid) return;
        const { cryptid } = this.selectedCryptid;
        if (cryptid.tapped) {
            // Untap
            cryptid.tapped = false;
            cryptid.canAttack = true;
            cryptid.attackedThisTurn = false;
        } else {
            // Tap
            cryptid.tapped = true;
            cryptid.canAttack = false;
        }
        
        // Clear animation state to prevent issues with rapid cheat attacks
        // This ensures sprites are properly visible and promotions don't get stuck
        if (window.activePromotions) {
            window.activePromotions.clear();
        }
        if (window.pendingPromotions) {
            window.pendingPromotions = [];
        }
        
        this.selectCryptid(this.selectedCryptid.owner, this.selectedCryptid.col, this.selectedCryptid.row);
        if (typeof renderAll === 'function') renderAll();
    },
    
    // Keep old untap for compatibility
    untap() {
        if (!this.selectedCryptid) return;
        const { cryptid } = this.selectedCryptid;
        cryptid.tapped = false;
        cryptid.canAttack = true;
        cryptid.attackedThisTurn = false;
        
        // Clear animation state to prevent issues with rapid cheat attacks
        if (window.activePromotions) {
            window.activePromotions.clear();
        }
        if (window.pendingPromotions) {
            window.pendingPromotions = [];
        }
        
        this.selectCryptid(this.selectedCryptid.owner, this.selectedCryptid.col, this.selectedCryptid.row);
        if (typeof renderAll === 'function') renderAll();
    },
    
    // ==================== SUMMON TO FIELD ====================
    
    populateSummonDropdown() {
        const select = document.getElementById('cheat-summon-cryptid');
        if (!select) return;
        
        select.innerHTML = '<option value="">Select cryptid...</option>';
        
        // Get all cryptids
        const cryptids = [];
        CardRegistry.getAllCryptidKeys().forEach(key => {
            const card = CardRegistry.getCryptid(key);
            if (card) cryptids.push({ key, name: card.name });
        });
        // Also add kindling (they can be summoned too)
        CardRegistry.getAllKindlingKeys().forEach(key => {
            const card = CardRegistry.getKindling(key);
            if (card) cryptids.push({ key, name: card.name + ' (K)', isKindling: true });
        });
        
        cryptids.sort((a, b) => a.name.localeCompare(b.name));
        
        cryptids.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.key + (c.isKindling ? '|kindling' : '');
            opt.textContent = c.name;
            select.appendChild(opt);
        });
    },
    
    updateColLabels() {
        const ownerSelect = document.getElementById('cheat-summon-owner');
        const colSelect = document.getElementById('cheat-summon-col');
        if (!ownerSelect || !colSelect) return;
        
        const owner = ownerSelect.value;
        // Player: col 0 = Support, col 1 = Combat
        // Enemy: col 0 = Combat, col 1 = Support
        if (owner === 'player') {
            colSelect.options[0].textContent = 'Support';
            colSelect.options[1].textContent = 'Combat';
        } else {
            colSelect.options[0].textContent = 'Combat';
            colSelect.options[1].textContent = 'Support';
        }
    },
    
    summonToField() {
        if (!window.game) return;
        
        const cryptidSelect = document.getElementById('cheat-summon-cryptid');
        const ownerSelect = document.getElementById('cheat-summon-owner');
        const colSelect = document.getElementById('cheat-summon-col');
        const rowSelect = document.getElementById('cheat-summon-row');
        
        if (!cryptidSelect.value) {
            alert('Select a cryptid first');
            return;
        }
        
        const [key, type] = cryptidSelect.value.split('|');
        const owner = ownerSelect.value;
        const col = parseInt(colSelect.value);
        const row = parseInt(rowSelect.value);
        
        // Get card data
        let cardData = type === 'kindling' 
            ? CardRegistry.getKindling(key) 
            : CardRegistry.getCryptid(key);
        
        if (!cardData) {
            console.warn('Card not found:', key);
            return;
        }
        
        // Create cryptid instance
        const cryptid = {
            ...cardData,
            id: Math.random().toString(36).substr(2, 9),
            currentHp: cardData.hp,
            currentAtk: cardData.atk,
            maxHp: cardData.hp,
            tapped: false,
            canAttack: false, // Just summoned
            summonedThisTurn: true,
            attackedThisTurn: false,
            owner: owner,
            col: col,  // REQUIRED for killCryptid and other position-based logic
            row: row   // REQUIRED for killCryptid and other position-based logic
        };
        
        // Place on field
        if (!window.game) return;
        const field = owner === 'player' ? window.game.playerField : window.game.enemyField;
        if (!field[col]) field[col] = [];
        
        // If slot occupied, remove existing
        // Player: col 0 = Support, col 1 = Combat
        // Enemy: col 0 = Combat, col 1 = Support
        const colName = owner === 'player' 
            ? (col === 0 ? 'Support' : 'Combat')
            : (col === 0 ? 'Combat' : 'Support');
        if (field[col][row]) {
            console.log(`Replacing ${field[col][row].name} at ${owner} ${colName} row ${row}`);
        }
        
        field[col][row] = cryptid;
        
        // Call appropriate callbacks like normal summonCryptid does
        const supportCol = window.game.getSupportCol(owner);
        const combatCol = window.game.getCombatCol(owner);
        
        // onSummon callback
        if (cryptid.onSummon) {
            cryptid.onSummon(cryptid, owner, window.game);
        }
        
        // onSupport callback (when placed in support column)
        if (col === supportCol && cryptid.onSupport) {
            cryptid.onSupport(cryptid, owner, window.game);
        }
        
        // onCombat / onEnterCombat callbacks (when placed in combat column)
        if (col === combatCol) {
            if (cryptid.onCombat) {
                cryptid.onCombat(cryptid, owner, window.game);
            }
            if (cryptid.onEnterCombat) {
                cryptid.onEnterCombat(cryptid, owner, window.game);
            }
            
            // Re-apply support abilities from existing support in same row
            const existingSupport = window.game.getFieldCryptid(owner, supportCol, row);
            if (existingSupport?.onSupport && !window.game.isSupportNegated?.(existingSupport)) {
                existingSupport.onSupport(existingSupport, owner, window.game);
            }
        }
        
        console.log(`Summoned ${cryptid.name} to ${owner} ${colName} row ${row}`);
        if (typeof renderAll === 'function') renderAll();
        
        // Check for pending Harbinger effect (Mothman entering combat)
        if (window.pendingHarbingerEffect && typeof window.processHarbingerEffect === 'function') {
            window.processHarbingerEffect(() => {
                if (typeof renderAll === 'function') renderAll();
            });
        }
    },
    
    clearSlot() {
        const ownerSelect = document.getElementById('cheat-summon-owner');
        const colSelect = document.getElementById('cheat-summon-col');
        const rowSelect = document.getElementById('cheat-summon-row');
        
        const owner = ownerSelect.value;
        const col = parseInt(colSelect.value);
        const row = parseInt(rowSelect.value);
        
        if (!window.game) return;
        const field = owner === 'player' ? window.game.playerField : window.game.enemyField;
        const colName = owner === 'player' 
            ? (col === 0 ? 'Support' : 'Combat')
            : (col === 0 ? 'Combat' : 'Support');
        if (field[col] && field[col][row]) {
            console.log(`Removed ${field[col][row].name} from ${owner} ${colName} row ${row}`);
            field[col][row] = null;
        }
        
        if (typeof renderAll === 'function') renderAll();
    },
    
    clearAllSlots() {
        if (!window.game) return;
        
        let clearedCount = 0;
        
        // Clear all slots for both players
        for (const owner of ['player', 'enemy']) {
            const field = owner === 'player' ? window.game.playerField : window.game.enemyField;
            
            for (let col = 0; col < 2; col++) {
                for (let row = 0; row < 3; row++) {
                    if (field[col] && field[col][row]) {
                        console.log(`Cleared ${field[col][row].name} from ${owner} col ${col} row ${row}`);
                        field[col][row] = null;
                        clearedCount++;
                    }
                }
            }
        }
        
        console.log(`Cleared ${clearedCount} cryptids from all slots`);
        if (typeof renderAll === 'function') renderAll();
    },
    
    summonToAllSlots() {
        if (!window.game) return;
        
        const cryptidSelect = document.getElementById('cheat-summon-cryptid');
        const ownerSelect = document.getElementById('cheat-summon-owner');
        
        if (!cryptidSelect.value) {
            alert('Select a cryptid first');
            return;
        }
        
        const [key, type] = cryptidSelect.value.split('|');
        const owner = ownerSelect.value;
        
        // Get card data
        let cardData = type === 'kindling' 
            ? CardRegistry.getKindling(key) 
            : CardRegistry.getCryptid(key);
        
        if (!cardData) {
            console.warn('Card not found:', key);
            return;
        }
        
        const field = owner === 'player' ? window.game.playerField : window.game.enemyField;
        const supportCol = window.game.getSupportCol(owner);
        const combatCol = window.game.getCombatCol(owner);
        
        let summonCount = 0;
        
        // Summon to all slots (2 columns × 3 rows = 6 slots)
        for (let col = 0; col < 2; col++) {
            if (!field[col]) field[col] = [];
            
            for (let row = 0; row < 3; row++) {
                // Create unique cryptid instance for each slot
                const cryptid = {
                    ...cardData,
                    id: Math.random().toString(36).substr(2, 9),
                    currentHp: cardData.hp,
                    currentAtk: cardData.atk,
                    maxHp: cardData.hp,
                    tapped: false,
                    canAttack: false, // Just summoned
                    summonedThisTurn: true,
                    attackedThisTurn: false,
                    owner: owner,
                    col: col,
                    row: row
                };
                
                // If slot occupied, log replacement
                const colName = owner === 'player' 
                    ? (col === 0 ? 'Support' : 'Combat')
                    : (col === 0 ? 'Combat' : 'Support');
                if (field[col][row]) {
                    console.log(`Replacing ${field[col][row].name} at ${owner} ${colName} row ${row}`);
                }
                
                field[col][row] = cryptid;
                summonCount++;
                
                // Call appropriate callbacks
                if (cryptid.onSummon) {
                    cryptid.onSummon(cryptid, owner, window.game);
                }
                
                if (col === supportCol && cryptid.onSupport) {
                    cryptid.onSupport(cryptid, owner, window.game);
                }
                
                if (col === combatCol) {
                    if (cryptid.onCombat) {
                        cryptid.onCombat(cryptid, owner, window.game);
                    }
                    if (cryptid.onEnterCombat) {
                        cryptid.onEnterCombat(cryptid, owner, window.game);
                    }
                }
            }
        }
        
        // After all summoned, apply support abilities to combat cryptids
        for (let row = 0; row < 3; row++) {
            const supportCryptid = window.game.getFieldCryptid(owner, supportCol, row);
            const combatCryptid = window.game.getFieldCryptid(owner, combatCol, row);
            if (supportCryptid?.onSupport && combatCryptid && !window.game.isSupportNegated?.(supportCryptid)) {
                supportCryptid.onSupport(supportCryptid, owner, window.game);
            }
        }
        
        console.log(`Summoned ${cardData.name} to all ${summonCount} slots on ${owner} field`);
        if (typeof renderAll === 'function') renderAll();
    },
    
    // ==================== STATUS EFFECTS ====================
    
    applyStatus(status) {
        if (!this.selectedCryptid) return;
        const { cryptid } = this.selectedCryptid;
        
        switch (status) {
            case 'burn':
                cryptid.burnTurns = (cryptid.burnTurns || 0) + 2;
                console.log(`Applied burn to ${cryptid.name} (${cryptid.burnTurns} turns)`);
                break;
            case 'bleed':
                cryptid.bleedTurns = (cryptid.bleedTurns || 0) + 2;
                console.log(`Applied bleed to ${cryptid.name} (${cryptid.bleedTurns} turns)`);
                break;
            case 'paralyze':
                cryptid.paralyzed = !cryptid.paralyzed;
                console.log(`${cryptid.paralyzed ? 'Paralyzed' : 'Un-paralyzed'} ${cryptid.name}`);
                break;
            case 'calamity':
                cryptid.calamityCounters = (cryptid.calamityCounters || 0) + 1;
                console.log(`Applied calamity to ${cryptid.name} (${cryptid.calamityCounters} stacks)`);
                break;
            case 'protect':
                cryptid.protectionCharges = (cryptid.protectionCharges || 0) + 1;
                console.log(`Protected ${cryptid.name} (${cryptid.protectionCharges} charges)`);
                break;
            case 'focus':
                cryptid.hasFocus = !cryptid.hasFocus;
                console.log(`${cryptid.hasFocus ? 'Gave focus to' : 'Removed focus from'} ${cryptid.name}`);
                break;
            case 'flight':
                cryptid.hasFlight = !cryptid.hasFlight;
                console.log(`${cryptid.hasFlight ? 'Gave flight to' : 'Removed flight from'} ${cryptid.name}`);
                break;
            case 'hidden':
                cryptid.isHidden = !cryptid.isHidden;
                console.log(`${cryptid.isHidden ? 'Hid' : 'Revealed'} ${cryptid.name}`);
                break;
        }
        
        // Refresh display
        this.selectCryptid(this.selectedCryptid.owner, this.selectedCryptid.col, this.selectedCryptid.row);
        if (typeof renderAll === 'function') renderAll();
    },
    
    clearAllStatuses() {
        if (!this.selectedCryptid) return;
        const { cryptid } = this.selectedCryptid;
        
        cryptid.burnTurns = 0;
        cryptid.bleedTurns = 0;
        cryptid.paralyzed = false;
        cryptid.calamityCounters = 0;
        cryptid.protectionCharges = 0;
        cryptid.hasFocus = false;
        cryptid.hasFlight = false;
        cryptid.isHidden = false;
        cryptid.tapped = false;
        cryptid.canAttack = true;
        
        console.log(`Cleared all statuses from ${cryptid.name}`);
        this.selectCryptid(this.selectedCryptid.owner, this.selectedCryptid.col, this.selectedCryptid.row);
        if (typeof renderAll === 'function') renderAll();
    },
    
    // Apply ailment to ALL cryptids on the selected cryptid's side
    applyStatusToAll(status) {
        if (!this.selectedCryptid || !window.game) return;
        const { owner } = this.selectedCryptid;
        const field = owner === 'player' ? window.game.playerField : window.game.enemyField;
        
        let affectedCount = 0;
        
        // Iterate all slots: columns 0-1, rows 0-2
        for (let col = 0; col < 2; col++) {
            for (let row = 0; row < 3; row++) {
                const cryptid = field[col]?.[row];
                if (cryptid) {
                    switch (status) {
                        case 'burn':
                            cryptid.burnTurns = (cryptid.burnTurns || 0) + 3;
                            affectedCount++;
                            break;
                        case 'bleed':
                            cryptid.bleedTurns = (cryptid.bleedTurns || 0) + 3;
                            affectedCount++;
                            break;
                        case 'paralyze':
                            if (!cryptid.paralyzed) {
                                cryptid.paralyzed = true;
                                cryptid.paralyzeTurns = 1;
                                cryptid.tapped = true;
                                cryptid.canAttack = false;
                                affectedCount++;
                            }
                            break;
                        case 'calamity':
                            if (!cryptid.calamityCounters || cryptid.calamityCounters === 0) {
                                cryptid.calamityCounters = 3;
                                cryptid.hadCalamity = true;
                                affectedCount++;
                            }
                            break;
                    }
                }
            }
        }
        
        console.log(`Applied ${status} to ${affectedCount} cryptids on ${owner} side`);
        
        // Refresh the selected cryptid's display
        this.selectCryptid(this.selectedCryptid.owner, this.selectedCryptid.col, this.selectedCryptid.row);
        if (typeof renderAll === 'function') renderAll();
    },
    
    // Clear all ailments from ALL cryptids on the selected cryptid's side
    clearAllStatusesOnSide() {
        if (!this.selectedCryptid || !window.game) return;
        const { owner } = this.selectedCryptid;
        const field = owner === 'player' ? window.game.playerField : window.game.enemyField;
        
        let clearedCount = 0;
        
        // Iterate all slots: columns 0-1, rows 0-2
        for (let col = 0; col < 2; col++) {
            for (let row = 0; row < 3; row++) {
                const cryptid = field[col]?.[row];
                if (cryptid) {
                    cryptid.burnTurns = 0;
                    cryptid.bleedTurns = 0;
                    cryptid.paralyzed = false;
                    cryptid.paralyzeTurns = 0;
                    cryptid.calamityCounters = 0;
                    cryptid.curseTokens = 0;
                    cryptid.protectionCharges = 0;
                    cryptid.hasFocus = false;
                    cryptid.hasFlight = false;
                    cryptid.isHidden = false;
                    clearedCount++;
                }
            }
        }
        
        console.log(`Cleared statuses from ${clearedCount} cryptids on ${owner} side`);
        
        // Refresh the selected cryptid's display
        this.selectCryptid(this.selectedCryptid.owner, this.selectedCryptid.col, this.selectedCryptid.row);
        if (typeof renderAll === 'function') renderAll();
    },
    
    // ==================== DISPLAY ====================
    
    updateDisplay() {
        if (!window.game) return;
        
        const playerPyre = document.getElementById('cheat-player-pyre');
        const enemyPyre = document.getElementById('cheat-enemy-pyre');
        const playerDeaths = document.getElementById('cheat-player-deaths');
        const enemyDeaths = document.getElementById('cheat-enemy-deaths');
        
        if (playerPyre) playerPyre.textContent = window.game.playerPyre;
        if (enemyPyre) enemyPyre.textContent = window.game.enemyPyre;
        if (playerDeaths) playerDeaths.textContent = window.game.playerDeaths;
        if (enemyDeaths) enemyDeaths.textContent = window.game.enemyDeaths;
    },
    
    toggleEventLog() {
        window.DEBUG_MATCH_LOG = document.getElementById('cheat-log-toggle')?.checked || false;
        console.log('Event logging:', window.DEBUG_MATCH_LOG ? 'ON' : 'OFF');
    }
};

// Update display periodically
setInterval(() => {
    if (CheatMode.isActive) {
        CheatMode.updateDisplay();
    }
}, 500);

console.log('🔧 Cheat Mode module loaded');

