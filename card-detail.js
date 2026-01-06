/**
 * Card Detail View - Long-press to view full card details during battle
 * Works on both desktop (click-hold) and mobile (touch-hold)
 */

window.CardDetail = {
    isOpen: false,
    holdThreshold: 450, // ms to trigger detail view
    holdTimer: null,
    holdStartTime: null,
    progressElement: null,
    currentTarget: null,
    currentTargetType: null,
    eventsBound: false,
    startX: 0,
    startY: 0,
    dragThreshold: 15, // pixels of movement before canceling hold
    
    // ==================== INITIALIZATION ====================
    
    init() {
        this.createProgressIndicator();
        this.createDetailModal();
        this.bindGlobalEvents();
        console.log('[CardDetail] System initialized');
    },
    
    // ==================== PROGRESS INDICATOR ====================
    
    createProgressIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'card-hold-indicator';
        indicator.innerHTML = `
            <svg viewBox="0 0 36 36" class="hold-progress-ring">
                <circle class="hold-progress-bg" cx="18" cy="18" r="15.5"></circle>
                <circle class="hold-progress-bar" cx="18" cy="18" r="15.5"></circle>
            </svg>
            <span class="hold-icon">🔍</span>
        `;
        document.body.appendChild(indicator);
        this.progressElement = indicator;
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            #card-hold-indicator {
                position: fixed;
                width: 64px;
                height: 64px;
                pointer-events: none;
                z-index: 999999;
                opacity: 0;
                transform: translate(-50%, -50%) scale(0.5);
                transition: opacity 0.15s, transform 0.15s;
                background: rgba(0, 0, 0, 0.85);
                border-radius: 50%;
                padding: 8px;
                box-sizing: border-box;
                box-shadow: 0 4px 20px rgba(0,0,0,0.5), 0 0 0 2px rgba(255,215,0,0.3);
            }
            #card-hold-indicator.active {
                opacity: 1;
                transform: translate(-50%, -50%) scale(1);
            }
            #card-hold-indicator.complete {
                transform: translate(-50%, -50%) scale(1.15);
                box-shadow: 0 4px 20px rgba(0,0,0,0.5), 0 0 0 3px rgba(74,222,128,0.5);
            }
            .hold-progress-ring {
                width: 100%;
                height: 100%;
                transform: rotate(-90deg);
            }
            .hold-progress-bg {
                fill: none;
                stroke: rgba(255,255,255,0.2);
                stroke-width: 4;
            }
            .hold-progress-bar {
                fill: none;
                stroke: #ffd700;
                stroke-width: 4;
                stroke-linecap: round;
                stroke-dasharray: 97.4;
                stroke-dashoffset: 97.4;
                transition: stroke-dashoffset 0.05s linear;
                filter: drop-shadow(0 0 4px rgba(255,215,0,0.5));
            }
            #card-hold-indicator.complete .hold-progress-bar {
                stroke: #4ade80;
                filter: drop-shadow(0 0 6px rgba(74,222,128,0.7));
            }
            .hold-icon {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-size: 22px;
                filter: drop-shadow(0 2px 4px rgba(0,0,0,0.8));
            }
        `;
        document.head.appendChild(style);
    },
    
    showProgress(x, y) {
        this.progressElement.style.left = x + 'px';
        this.progressElement.style.top = y + 'px';
        this.progressElement.classList.add('active');
        this.progressElement.classList.remove('complete');
    },
    
    updateProgress(progress) {
        const bar = this.progressElement.querySelector('.hold-progress-bar');
        const circumference = 97.4; // 2 * PI * 15.5
        const offset = circumference * (1 - progress);
        bar.style.strokeDashoffset = offset;
        
        if (progress >= 1) {
            this.progressElement.classList.add('complete');
        }
    },
    
    hideProgress() {
        this.progressElement.classList.remove('active', 'complete');
        this.updateProgress(0);
    },
    
    // ==================== DETAIL MODAL ====================
    
    createDetailModal() {
        const modal = document.createElement('div');
        modal.id = 'battle-card-detail-modal';
        modal.className = 'battle-card-detail-modal';
        modal.innerHTML = `
            <div class="battle-detail-backdrop"></div>
            <div class="battle-detail-content" id="battle-detail-content"></div>
        `;
        document.body.appendChild(modal);
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .battle-card-detail-modal {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 9999;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.2s ease;
            }
            .battle-card-detail-modal.open {
                opacity: 1;
                pointer-events: auto;
            }
            .battle-detail-backdrop {
                position: absolute;
                inset: 0;
                background: rgba(0,0,0,0.85);
                backdrop-filter: blur(4px);
            }
            .battle-detail-content {
                position: relative;
                max-width: 640px;
                width: 92%;
                max-height: 85vh;
                overflow-y: auto;
                animation: detailSlideIn 0.25s ease;
                margin: 16px;
            }
            @keyframes detailSlideIn {
                from {
                    opacity: 0;
                    transform: scale(0.9) translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: scale(1) translateY(0);
                }
            }
            
            /* Detail Layout - reuse collection styles */
            .battle-detail-content .detail-view-layout {
                display: flex;
                align-items: center; /* Vertically center the card */
                gap: 32px;
                padding: 24px 28px;
                background: linear-gradient(145deg, #1a1a2e, #16213e);
                border-radius: 12px;
                border: 1px solid rgba(255,255,255,0.1);
                box-shadow: 0 20px 60px rgba(0,0,0,0.5);
            }
            
            /* Portrait mobile - stack vertically */
            @media (max-width: 600px) and (orientation: portrait) {
                .battle-detail-content .detail-view-layout {
                    flex-direction: column;
                    align-items: center;
                    gap: 20px;
                    padding: 16px;
                }
                .battle-detail-content .detail-card-wrapper .game-card {
                    transform: scale(1.0);
                }
            }
            
            /* Landscape mobile - side by side but smaller card */
            @media (max-height: 500px) and (orientation: landscape) {
                .battle-detail-content {
                    max-width: 90%;
                    max-height: 95vh;
                }
                .battle-detail-content .detail-view-layout {
                    gap: 20px;
                    padding: 12px 16px;
                }
                .battle-detail-content .detail-card-wrapper .game-card {
                    transform: scale(0.75);
                }
                .battle-detail-content .detail-card-name {
                    font-size: 1.2rem;
                }
                .battle-detail-content .detail-ability {
                    padding: 8px;
                    margin-bottom: 6px;
                }
                .battle-detail-content .detail-ability-name {
                    font-size: 0.85rem;
                }
                .battle-detail-content .detail-ability-desc {
                    font-size: 0.8rem;
                }
                .battle-detail-content .detail-section {
                    padding: 8px;
                }
            }
            
            .battle-detail-content .detail-card-wrapper {
                flex-shrink: 0;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 8px;
                padding: 4px;
            }
            .battle-detail-content .detail-card-wrapper .game-card {
                transform: scale(1.1);
                transform-origin: center center;
            }
            
            .battle-detail-content .detail-info-panel {
                flex: 1;
                min-width: 0;
                display: flex;
                flex-direction: column;
                gap: 12px;
                overflow: hidden;
            }
            
            .battle-detail-content .detail-title-bar {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }
            .battle-detail-content .detail-card-name {
                margin: 0;
                font-size: 1.5rem;
                font-weight: bold;
                color: #fff;
                word-wrap: break-word;
                overflow-wrap: break-word;
            }
            .battle-detail-content .detail-card-meta {
                display: flex;
                gap: 8px;
                font-size: 0.85rem;
                color: #aaa;
            }
            .battle-detail-content .detail-element {
                padding: 2px 8px;
                border-radius: 4px;
                font-weight: 500;
            }
            .battle-detail-content .detail-element.void { background: #6b21a8; color: #e9d5ff; }
            .battle-detail-content .detail-element.blood { background: #991b1b; color: #fecaca; }
            .battle-detail-content .detail-element.nature { background: #166534; color: #bbf7d0; }
            .battle-detail-content .detail-element.water { background: #1e40af; color: #bfdbfe; }
            .battle-detail-content .detail-element.steel { background: #3f3f46; color: #d4d4d8; }
            
            .battle-detail-content .detail-section {
                background: rgba(0,0,0,0.2);
                border-radius: 8px;
                padding: 12px;
            }
            .battle-detail-content .detail-section-title {
                font-size: 0.75rem;
                text-transform: uppercase;
                letter-spacing: 1px;
                color: #888;
                margin-bottom: 8px;
            }
            
            .battle-detail-content .detail-ability {
                background: rgba(255,255,255,0.05);
                border-radius: 6px;
                padding: 10px;
                margin-bottom: 8px;
            }
            .battle-detail-content .detail-ability:last-child {
                margin-bottom: 0;
            }
            .battle-detail-content .detail-ability-header {
                display: flex;
                align-items: center;
                gap: 6px;
                margin-bottom: 4px;
            }
            .battle-detail-content .detail-ability-icon {
                font-size: 1rem;
            }
            .battle-detail-content .detail-ability-type {
                font-size: 0.7rem;
                text-transform: uppercase;
                letter-spacing: 1px;
                color: #888;
            }
            .battle-detail-content .detail-ability-name {
                font-weight: 600;
                color: #ffd700;
                margin-bottom: 4px;
            }
            .battle-detail-content .detail-ability-desc {
                font-size: 0.9rem;
                color: #ccc;
                line-height: 1.4;
            }
            .battle-detail-content .detail-ability.evolution {
                border-left: 3px solid #a855f7;
            }
            .battle-detail-content .detail-ability.effect {
                border-left: 3px solid #3b82f6;
            }
            
            /* Battle-specific: Current stats */
            .battle-detail-content .detail-stats-current {
                display: flex;
                gap: 16px;
                margin-top: 8px;
            }
            .battle-detail-content .detail-stat {
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: 8px 16px;
                background: rgba(0,0,0,0.3);
                border-radius: 6px;
            }
            .battle-detail-content .detail-stat-label {
                font-size: 0.7rem;
                text-transform: uppercase;
                color: #888;
            }
            .battle-detail-content .detail-stat-value {
                font-size: 1.5rem;
                font-weight: bold;
            }
            .battle-detail-content .detail-stat-value.atk { color: #f87171; }
            .battle-detail-content .detail-stat-value.hp { color: #4ade80; }
            .battle-detail-content .detail-stat-base {
                font-size: 0.75rem;
                color: #666;
            }
            .battle-detail-content .detail-stat-value.buffed { color: #fbbf24; }
            .battle-detail-content .detail-stat-value.debuffed { color: #f87171; }
            
            /* Close button */
            .battle-detail-content .detail-close-btn {
                margin-top: 12px;
                padding: 10px 24px;
                background: linear-gradient(145deg, #374151, #1f2937);
                border: 1px solid #4b5563;
                border-radius: 6px;
                color: #fff;
                font-size: 0.9rem;
                cursor: pointer;
                transition: all 0.15s;
                width: 100%;
            }
            .battle-detail-content .detail-close-btn:hover {
                background: linear-gradient(145deg, #4b5563, #374151);
                border-color: #6b7280;
            }
            
            /* Status effects display */
            .battle-detail-content .detail-statuses {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                margin-top: 8px;
            }
            .battle-detail-content .detail-status {
                display: flex;
                align-items: center;
                gap: 4px;
                padding: 4px 8px;
                background: rgba(255,255,255,0.1);
                border-radius: 4px;
                font-size: 0.8rem;
            }
        `;
        document.head.appendChild(style);
        
        // Bind close handlers
        modal.querySelector('.battle-detail-backdrop').onclick = () => this.close();
        modal.onclick = (e) => {
            if (e.target === modal) this.close();
        };
    },
    
    // ==================== SHOW DETAIL ====================
    
    show(cardData, cryptidInstance = null) {
        if (!cardData) return;
        
        const card = cardData;
        const isCryptid = card.type === 'cryptid';
        const elementClass = card.element ? `element-${card.element}` : '';
        const rarityClass = card.rarity || 'common';
        const cardTypeClass = isCryptid ? 'cryptid-card' : 'spell-card';
        const typeClass = isCryptid ? '' : card.type;
        const isHolo = card.isHolo || false;
        const foilClass = isHolo ? 'foil' : '';
        
        // Card type label
        let cardTypeLabel;
        if (isCryptid) {
            cardTypeLabel = card.isKindling ? 'Kindling' : 'Cryptid';
        } else {
            const spellTypeLabels = { trap: 'Trap', aura: 'Aura', pyre: 'Pyre', burst: 'Burst' };
            cardTypeLabel = spellTypeLabels[card.type] || 'Spell';
        }
        
        // Stats HTML
        let statsHTML = '';
        if (isCryptid) {
            statsHTML = `<span class="gc-stat atk">${card.atk}</span><span class="gc-stat hp">${card.hp}</span>`;
        } else {
            const typeLabels = { trap: 'Trap', aura: 'Aura', pyre: 'Pyre', burst: 'Burst' };
            statsHTML = `<span class="gc-stat-type">${typeLabels[card.type] || 'Spell'}</span>`;
        }
        
        // Rarity gems
        const rarityGems = `<span class="gc-rarity ${rarityClass}"></span>`;
        
        // Element info
        const elementNames = { void: 'Void', blood: 'Blood', water: 'Water', steel: 'Steel', nature: 'Nature' };
        
        // Build abilities section
        let abilitiesHTML = '';
        if (card.combatAbility) {
            const [abilityName, ...descParts] = card.combatAbility.split(':');
            abilitiesHTML += `
                <div class="detail-ability">
                    <div class="detail-ability-header">
                        <span class="detail-ability-icon">⚔</span>
                        <span class="detail-ability-type">Combat</span>
                    </div>
                    <div class="detail-ability-name">${abilityName.trim()}</div>
                    ${descParts.length ? `<div class="detail-ability-desc">${descParts.join(':').trim()}</div>` : ''}
                </div>`;
        }
        if (card.supportAbility) {
            const [abilityName, ...descParts] = card.supportAbility.split(':');
            abilitiesHTML += `
                <div class="detail-ability">
                    <div class="detail-ability-header">
                        <span class="detail-ability-icon">✦</span>
                        <span class="detail-ability-type">Support</span>
                    </div>
                    <div class="detail-ability-name">${abilityName.trim()}</div>
                    ${descParts.length ? `<div class="detail-ability-desc">${descParts.join(':').trim()}</div>` : ''}
                </div>`;
        }
        if (card.evolvesFrom) {
            const evolveFromName = this.getCardName(card.evolvesFrom);
            abilitiesHTML += `
                <div class="detail-ability evolution">
                    <div class="detail-ability-header">
                        <span class="detail-ability-icon">◈</span>
                        <span class="detail-ability-type">Evolution</span>
                    </div>
                    <div class="detail-ability-desc">Evolves from <strong>${evolveFromName}</strong></div>
                </div>`;
        }
        if (card.evolvesInto) {
            const evolveIntoName = this.getCardName(card.evolvesInto);
            abilitiesHTML += `
                <div class="detail-ability evolution">
                    <div class="detail-ability-header">
                        <span class="detail-ability-icon">◈</span>
                        <span class="detail-ability-type">Evolution</span>
                    </div>
                    <div class="detail-ability-desc">Evolves into <strong>${evolveIntoName}</strong></div>
                </div>`;
        }
        if (card.otherAbility) {
            abilitiesHTML += `
                <div class="detail-ability effect">
                    <div class="detail-ability-header">
                        <span class="detail-ability-icon">✧</span>
                        <span class="detail-ability-type">Passive</span>
                    </div>
                    <div class="detail-ability-desc">${card.otherAbility}</div>
                </div>`;
        }
        if (card.description) {
            abilitiesHTML += `
                <div class="detail-ability effect">
                    <div class="detail-ability-header">
                        <span class="detail-ability-icon">✧</span>
                        <span class="detail-ability-type">Effect</span>
                    </div>
                    <div class="detail-ability-desc">${card.description}</div>
                </div>`;
        }
        if (card.pyreEffect) {
            abilitiesHTML += `
                <div class="detail-ability effect">
                    <div class="detail-ability-header">
                        <span class="detail-ability-icon">🔥</span>
                        <span class="detail-ability-type">Pyre Effect</span>
                    </div>
                    <div class="detail-ability-desc">${card.pyreEffect}</div>
                </div>`;
        }
        
        // Current stats section (for field cryptids)
        let currentStatsHTML = '';
        if (cryptidInstance && isCryptid) {
            const currentAtk = cryptidInstance.currentAtk ?? card.atk;
            const currentHp = cryptidInstance.currentHp ?? card.hp;
            const baseAtk = card.atk;
            const baseHp = card.hp;
            
            const atkClass = currentAtk > baseAtk ? 'buffed' : (currentAtk < baseAtk ? 'debuffed' : '');
            const hpClass = currentHp > baseHp ? 'buffed' : (currentHp < baseHp ? 'debuffed' : '');
            
            currentStatsHTML = `
                <div class="detail-section">
                    <div class="detail-section-title">Current Stats</div>
                    <div class="detail-stats-current">
                        <div class="detail-stat">
                            <span class="detail-stat-label">Attack</span>
                            <span class="detail-stat-value atk ${atkClass}">${currentAtk}</span>
                            <span class="detail-stat-base">Base: ${baseAtk}</span>
                        </div>
                        <div class="detail-stat">
                            <span class="detail-stat-label">Health</span>
                            <span class="detail-stat-value hp ${hpClass}">${currentHp}</span>
                            <span class="detail-stat-base">Base: ${baseHp}</span>
                        </div>
                    </div>
                    ${this.buildStatusesHTML(cryptidInstance)}
                </div>
            `;
        }
        
        // Render sprite
        const spriteHTML = this.renderSprite(card.sprite, card.cardSpriteScale || card.spriteScale);
        
        const content = document.getElementById('battle-detail-content');
        content.innerHTML = `
            <div class="detail-view-layout">
                <div class="detail-card-wrapper">
                    <div class="game-card detail-card ${cardTypeClass} ${elementClass} ${typeClass} ${rarityClass} ${foilClass}">
                        <span class="gc-cost">${card.cost}</span>
                        <div class="gc-header"><span class="gc-name">${card.name}</span></div>
                        <div class="gc-art">${spriteHTML}</div>
                        <div class="gc-stats">${statsHTML}</div>
                        <div class="gc-card-type">${cardTypeLabel}</div>
                        ${rarityGems}
                    </div>
                </div>
                
                <div class="detail-info-panel">
                    <div class="detail-title-bar">
                        <h2 class="detail-card-name">${card.name}</h2>
                        <span class="detail-card-meta">
                            ${card.element ? `<span class="detail-element ${card.element}">${elementNames[card.element] || card.element}</span>` : ''}
                            <span class="detail-type-label">${cardTypeLabel}</span>
                        </span>
                    </div>
                    
                    ${currentStatsHTML}
                    
                    ${abilitiesHTML ? `
                        <div class="detail-section abilities-section">
                            <div class="detail-section-title">Abilities</div>
                            <div class="detail-abilities-list">${abilitiesHTML}</div>
                        </div>
                    ` : ''}
                    
                    <button class="detail-close-btn" onclick="CardDetail.close()">Close</button>
                </div>
            </div>
        `;
        
        document.getElementById('battle-card-detail-modal').classList.add('open');
        this.isOpen = true;
    },
    
    buildStatusesHTML(cryptid) {
        if (!cryptid) return '';
        
        const statuses = [];
        if (cryptid.burnTurns > 0) statuses.push({ icon: '🔥', name: 'Burn', value: cryptid.burnTurns });
        if (cryptid.paralyzed) statuses.push({ icon: '⚡', name: 'Paralyzed' });
        if (cryptid.bleedTurns > 0) statuses.push({ icon: '🩸', name: 'Bleed', value: cryptid.bleedTurns });
        if (cryptid.calamityCounters > 0) statuses.push({ icon: '💀', name: 'Calamity', value: cryptid.calamityCounters });
        if (cryptid.protectionCharges > 0) statuses.push({ icon: '🛡️', name: 'Protected', value: cryptid.protectionCharges });
        if (cryptid.tapped) statuses.push({ icon: '💤', name: 'Tapped' });
        if (cryptid.hasFocus) statuses.push({ icon: '🎯', name: 'Focus' });
        if (cryptid.hasFlight) statuses.push({ icon: '🦅', name: 'Flight' });
        
        if (statuses.length === 0) return '';
        
        return `
            <div class="detail-statuses">
                ${statuses.map(s => `
                    <span class="detail-status">
                        <span>${s.icon}</span>
                        <span>${s.name}${s.value ? ` (${s.value})` : ''}</span>
                    </span>
                `).join('')}
            </div>
        `;
    },
    
    close() {
        document.getElementById('battle-card-detail-modal').classList.remove('open');
        this.isOpen = false;
    },
    
    // ==================== HELPERS ====================
    
    renderSprite(sprite, scale = 1) {
        if (!sprite) return '❓';
        if (sprite.startsWith('http') || sprite.startsWith('data:')) {
            return `<img src="${sprite}" style="transform: scale(${scale || 1})" alt="card art">`;
        }
        return `<span style="font-size: ${(scale || 1) * 100}%">${sprite}</span>`;
    },
    
    getCardName(cardKey) {
        if (!cardKey) return cardKey;
        const card = CardRegistry?.getCryptid(cardKey) || 
                     CardRegistry?.getKindling(cardKey) ||
                     CardRegistry?.getBurst(cardKey) ||
                     CardRegistry?.getTrap(cardKey) ||
                     CardRegistry?.getAura(cardKey) ||
                     CardRegistry?.getPyre(cardKey);
        return card?.name || cardKey;
    },
    
    // ==================== LONG-PRESS DETECTION ====================
    
    bindGlobalEvents() {
        if (this.eventsBound) return;
        
        // Use event delegation on the game container
        const gameContainer = document.getElementById('game-container');
        if (!gameContainer) {
            // Retry after DOM loads
            console.log('[CardDetail] Game container not found, retrying...');
            setTimeout(() => this.bindGlobalEvents(), 500);
            return;
        }
        
        console.log('[CardDetail] Binding events to game container');
        
        // Bind to hand cards, field sprites, and traps
        gameContainer.addEventListener('mousedown', (e) => this.handlePressStart(e), { passive: false });
        gameContainer.addEventListener('mouseup', (e) => this.handlePressEnd(e));
        gameContainer.addEventListener('mouseleave', (e) => this.handlePressEnd(e));
        gameContainer.addEventListener('mousemove', (e) => this.handleMove(e), { passive: true });
        
        gameContainer.addEventListener('touchstart', (e) => this.handlePressStart(e), { passive: false });
        gameContainer.addEventListener('touchend', (e) => this.handlePressEnd(e));
        gameContainer.addEventListener('touchcancel', (e) => this.handlePressEnd(e));
        gameContainer.addEventListener('touchmove', (e) => this.handleMove(e), { passive: true });
        
        // Also bind to document for broader coverage (and as fallback)
        document.addEventListener('mouseup', (e) => this.handlePressEnd(e));
        document.addEventListener('touchend', (e) => this.handlePressEnd(e));
        document.addEventListener('mousemove', (e) => this.handleMove(e), { passive: true });
        document.addEventListener('touchmove', (e) => this.handleMove(e), { passive: true });
        
        // Fallback: Also bind start events to document in case game container events are being stopped
        document.addEventListener('mousedown', (e) => {
            // Only handle if target is in game container
            if (e.target.closest('#game-container')) {
                this.handlePressStart(e);
            }
        }, { passive: false, capture: true });
        
        document.addEventListener('touchstart', (e) => {
            if (e.target.closest('#game-container')) {
                this.handlePressStart(e);
            }
        }, { passive: false, capture: true });
        
        // ESC to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
        
        this.eventsBound = true;
        console.log('[CardDetail] Events bound successfully');
    },
    
    handlePressStart(e) {
        // Don't interfere with drag operations already in progress
        if (window.ui?.draggedCard) return;
        
        // Find valid target:
        // 1. Card in hand (.card-wrapper or .game-card inside it)
        // 2. Tile on battlefield (tiles have pointer-events, sprites don't)
        // 3. Player's trap sprite
        const cardTarget = e.target.closest('.card-wrapper, .game-card');
        const tileTarget = e.target.closest('.tile');
        const trapTarget = e.target.closest('.trap-sprite');
        
        let actualTarget = null;
        let targetType = null;
        
        if (cardTarget) {
            // Card in hand
            actualTarget = cardTarget.classList.contains('game-card') 
                ? cardTarget.closest('.card-wrapper') || cardTarget 
                : cardTarget;
            targetType = 'hand';
            console.log('[CardDetail] Found hand card target');
        } else if (tileTarget) {
            // Tile on battlefield - check if it has a cryptid or trap
            const owner = tileTarget.dataset.owner;
            const col = tileTarget.dataset.col;
            const row = parseInt(tileTarget.dataset.row);
            
            console.log('[CardDetail] Tile press:', { owner, col, row, tile: tileTarget.className });
            
            if (col === 'trap') {
                // Trap tile - only show player's traps
                const trap = window.game?.playerTraps?.[row];
                console.log('[CardDetail] Trap tile check - owner:', owner, 'trap:', trap?.name || 'none');
                if (owner === 'player' && trap) {
                    actualTarget = tileTarget;
                    targetType = 'trap';
                    console.log('[CardDetail] Found player trap target:', trap.name);
                }
            } else if (col !== undefined && col !== 'trap' && !isNaN(parseInt(col))) {
                // Cryptid tile - check if there's a cryptid
                const colNum = parseInt(col);
                const cryptid = window.game?.getFieldCryptid?.(owner, colNum, row);
                console.log('[CardDetail] Cryptid tile check - owner:', owner, 'col:', colNum, 'row:', row, 'cryptid:', cryptid?.name || 'none', 'isKindling:', cryptid?.isKindling);
                if (cryptid) {
                    actualTarget = tileTarget;
                    targetType = 'cryptid';
                    console.log('[CardDetail] Found cryptid target:', cryptid.name, '(kindling:', cryptid.isKindling, ')');
                }
            } else {
                console.log('[CardDetail] Tile not recognized as trap or cryptid tile');
            }
        } else if (trapTarget) {
            // Direct trap sprite click (if pointer-events enabled)
            const owner = trapTarget.dataset.owner;
            if (owner === 'player') {
                actualTarget = trapTarget;
                targetType = 'trap';
            }
        }
        
        if (!actualTarget) {
            console.log('[CardDetail] No valid target found');
            return;
        }
        
        // Get position for progress indicator
        let x, y;
        if (e.type === 'touchstart') {
            x = e.touches[0].clientX;
            y = e.touches[0].clientY;
        } else {
            x = e.clientX;
            y = e.clientY;
        }
        
        // Store start position for drag detection
        this.startX = x;
        this.startY = y;
        
        this.currentTarget = actualTarget;
        this.currentTargetType = targetType;
        this.holdStartTime = Date.now();
        
        // Start progress animation
        this.showProgress(x, y);
        
        // Animate progress
        const animate = () => {
            if (!this.holdStartTime) return;
            
            const elapsed = Date.now() - this.holdStartTime;
            const progress = Math.min(elapsed / this.holdThreshold, 1);
            this.updateProgress(progress);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Threshold reached!
                this.triggerDetail(actualTarget);
            }
        };
        requestAnimationFrame(animate);
    },
    
    handlePressEnd(e) {
        this.holdStartTime = null;
        this.hideProgress();
        this.currentTarget = null;
        this.currentTargetType = null;
    },
    
    handleMove(e) {
        // If no hold in progress, nothing to do
        if (!this.holdStartTime) return;
        
        // Get current position
        let x, y;
        if (e.type === 'touchmove') {
            x = e.touches[0].clientX;
            y = e.touches[0].clientY;
        } else {
            x = e.clientX;
            y = e.clientY;
        }
        
        // Calculate distance from start
        const dx = x - this.startX;
        const dy = y - this.startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // If moved beyond threshold, cancel the hold (user is dragging)
        if (distance > this.dragThreshold) {
            this.holdStartTime = null;
            this.hideProgress();
            this.currentTarget = null;
            this.currentTargetType = null;
        }
    },
    
    triggerDetail(target) {
        this.holdStartTime = null;
        this.hideProgress();
        
        // Mark that we triggered detail - prevents tap action
        this.detailTriggered = true;
        setTimeout(() => { this.detailTriggered = false; }, 100);
        
        // Haptic feedback on mobile
        if (navigator.vibrate) {
            navigator.vibrate(30);
        }
        
        // Determine card data based on target type
        let cardData = null;
        let cryptidInstance = null;
        const targetType = this.currentTargetType;
        
        if (targetType === 'hand' || target.classList.contains('card-wrapper')) {
            // Hand card - get from data attribute or find in hand
            const cardId = target.dataset.cardId;
            const cards = window.ui?.showingKindling ? game.playerKindling : game.playerHand;
            console.log('[CardDetail] Looking for card ID:', cardId, 'in', window.ui?.showingKindling ? 'kindling' : 'hand', 'cards:', cards?.map(c => ({ id: c.id, name: c.name })));
            // Try both string and number comparison since IDs might be stored differently
            const card = cards?.find(c => c.id == cardId || String(c.id) === String(cardId));
            if (card) {
                cardData = card;
                console.log('[CardDetail] Found card:', card.name);
            } else {
                console.log('[CardDetail] Card not found in list');
            }
        } else if (targetType === 'cryptid' || target.classList.contains('tile')) {
            // Field cryptid - get from tile data
            const owner = target.dataset.owner;
            const col = parseInt(target.dataset.col);
            const row = parseInt(target.dataset.row);
            
            if (window.game && !isNaN(col)) {
                cryptidInstance = game.getFieldCryptid(owner, col, row);
                if (cryptidInstance) {
                    cardData = cryptidInstance;
                }
            }
        } else if (targetType === 'trap') {
            // Player trap on field - get from tile or sprite
            const owner = target.dataset.owner;
            const row = parseInt(target.dataset.row);
            
            if ((owner === 'player' || target.dataset.col === 'trap') && window.game) {
                const trap = game.playerTraps?.[row];
                if (trap) {
                    cardData = trap;
                }
            }
        }
        
        if (cardData) {
            this.show(cardData, cryptidInstance);
        }
    },
    
    // Check if detail was just triggered (to prevent tap action)
    wasJustTriggered() {
        return this.detailTriggered === true;
    },
    
    // Manual test function - call from console: CardDetail.test()
    test() {
        console.log('[CardDetail] Testing...');
        console.log('[CardDetail] Events bound:', this.eventsBound);
        console.log('[CardDetail] Progress element:', !!this.progressElement);
        console.log('[CardDetail] Modal exists:', !!document.getElementById('battle-card-detail-modal'));
        
        // Show a test card detail
        const testCard = {
            name: 'Test Card',
            type: 'cryptid',
            cost: 3,
            atk: 2,
            hp: 4,
            element: 'void',
            rarity: 'common',
            sprite: '👻',
            combatAbility: 'Test Ability: This is a test description',
            supportAbility: 'Support Test: Another test description'
        };
        this.show(testCard);
        console.log('[CardDetail] Test complete - modal should be visible');
    }
};

// Initialize when DOM is ready - but events bind later when game starts
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => CardDetail.init());
} else {
    CardDetail.init();
}

// Also listen for game start to ensure bindings work
window.addEventListener('load', () => {
    // Re-bind after a delay to catch game container being shown
    setTimeout(() => {
        if (!CardDetail.eventsBound) {
            CardDetail.bindGlobalEvents();
        }
    }, 1000);
});

