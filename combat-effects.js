/**
 * Cryptid Fates - Combat Effects System
 * Satisfying, weighty combat feedback with screen shake, particles, and dynamic stat bars
 */

window.CombatEffects = {
    // Configuration
    config: {
        screenShakeIntensity: 1.0,
        particlesEnabled: true,
        impactFlashEnabled: true
    },
    
    // ==================== SCREEN SHAKE ====================
    
    screenShake(intensity = 1, duration = 300) {
        const battlefield = document.getElementById('battlefield-area');
        if (!battlefield) return;
        
        const baseIntensity = 6 * intensity * this.config.screenShakeIntensity;
        battlefield.classList.add('screen-shaking');
        battlefield.style.setProperty('--shake-intensity', baseIntensity + 'px');
        
        setTimeout(() => {
            battlefield.classList.remove('screen-shaking');
            battlefield.style.removeProperty('--shake-intensity');
        }, duration);
    },
    
    // Heavy impact shake for big hits
    heavyImpact(damage = 1) {
        const intensity = Math.min(0.5 + (damage * 0.15), 2);
        this.screenShake(intensity, 350);
    },
    
    // Light shake for regular hits
    lightImpact() {
        this.screenShake(0.4, 200);
    },
    
    // ==================== IMPACT PARTICLES ====================
    
    createImpactParticles(x, y, color = '#ff6b6b', count = 8) {
        if (!this.config.particlesEnabled) return;
        
        const battlefield = document.getElementById('battlefield-area');
        if (!battlefield) return;
        
        const container = document.createElement('div');
        container.className = 'impact-particles';
        container.style.left = x + 'px';
        container.style.top = y + 'px';
        
        for (let i = 0; i < count; i++) {
            const particle = document.createElement('div');
            particle.className = 'impact-particle';
            
            // Random direction and distance
            const angle = (Math.PI * 2 / count) * i + (Math.random() * 0.5 - 0.25);
            const distance = 30 + Math.random() * 40;
            const tx = Math.cos(angle) * distance;
            const ty = Math.sin(angle) * distance - 20; // Bias upward
            
            particle.style.setProperty('--tx', tx + 'px');
            particle.style.setProperty('--ty', ty + 'px');
            particle.style.setProperty('--particle-color', color);
            particle.style.animationDelay = (Math.random() * 50) + 'ms';
            
            container.appendChild(particle);
        }
        
        battlefield.appendChild(container);
        setTimeout(() => container.remove(), 600);
    },
    
    // Spark burst for metal/physical hits
    createSparks(x, y, count = 12) {
        if (!this.config.particlesEnabled) return;
        
        const battlefield = document.getElementById('battlefield-area');
        if (!battlefield) return;
        
        const container = document.createElement('div');
        container.className = 'spark-container';
        container.style.left = x + 'px';
        container.style.top = y + 'px';
        
        for (let i = 0; i < count; i++) {
            const spark = document.createElement('div');
            spark.className = 'spark';
            
            const angle = Math.random() * Math.PI * 2;
            const distance = 20 + Math.random() * 60;
            const tx = Math.cos(angle) * distance;
            const ty = Math.sin(angle) * distance - 15;
            
            spark.style.setProperty('--tx', tx + 'px');
            spark.style.setProperty('--ty', ty + 'px');
            spark.style.animationDelay = (Math.random() * 30) + 'ms';
            spark.style.animationDuration = (200 + Math.random() * 200) + 'ms';
            
            container.appendChild(spark);
        }
        
        battlefield.appendChild(container);
        setTimeout(() => container.remove(), 500);
    },
    
    // ==================== IMPACT FLASH ====================
    
    createImpactFlash(x, y, size = 80) {
        if (!this.config.impactFlashEnabled) return;
        
        const battlefield = document.getElementById('battlefield-area');
        if (!battlefield) return;
        
        const flash = document.createElement('div');
        flash.className = 'impact-flash';
        flash.style.left = x + 'px';
        flash.style.top = y + 'px';
        flash.style.width = size + 'px';
        flash.style.height = size + 'px';
        
        battlefield.appendChild(flash);
        setTimeout(() => flash.remove(), 200);
    },
    
    // ==================== DAMAGE NUMBERS ====================
    
    showDamageNumber(target, damage, isCrit = false, isBlocked = false) {
        if (!target) return;
        
        const key = `${target.owner}-${target.col}-${target.row}`;
        const pos = window.tilePositions?.[key];
        if (!pos) return;
        
        const battlefield = document.getElementById('battlefield-area');
        if (!battlefield) return;
        
        const container = document.createElement('div');
        container.className = 'damage-number-container';
        
        // Scale based on damage
        const scale = Math.min(1 + (damage * 0.08), 1.8);
        
        if (isBlocked) {
            container.classList.add('blocked');
            container.innerHTML = `<span class="damage-text">BLOCKED</span>`;
        } else {
            container.classList.add(isCrit ? 'critical' : 'normal');
            container.innerHTML = `
                <span class="damage-text" style="--damage-scale: ${scale}">-${damage}</span>
                ${isCrit ? '<span class="crit-label">CRIT!</span>' : ''}
            `;
        }
        
        // Randomize position slightly
        const offsetX = (Math.random() - 0.5) * 30;
        container.style.left = (pos.x + offsetX) + 'px';
        container.style.top = (pos.y - 40) + 'px';
        
        battlefield.appendChild(container);
        setTimeout(() => container.remove(), 1200);
    },
    
    showHealNumber(target, amount) {
        if (!target || !amount) return;
        
        const key = `${target.owner}-${target.col}-${target.row}`;
        const pos = window.tilePositions?.[key];
        if (!pos) return;
        
        const battlefield = document.getElementById('battlefield-area');
        if (!battlefield) return;
        
        const container = document.createElement('div');
        container.className = 'heal-number-container';
        container.innerHTML = `<span class="heal-text">+${amount}</span>`;
        
        const offsetX = (Math.random() - 0.5) * 20;
        container.style.left = (pos.x + offsetX) + 'px';
        container.style.top = (pos.y - 40) + 'px';
        
        battlefield.appendChild(container);
        setTimeout(() => container.remove(), 1000);
    },
    
    // ==================== COMBO ATTACK EFFECT ====================
    
    playAttackSequence(attackerSprite, targetSprite, damage, onComplete) {
        if (!attackerSprite || !targetSprite) {
            if (onComplete) onComplete();
            return;
        }
        
        const targetRect = targetSprite.getBoundingClientRect();
        const battlefieldRect = document.getElementById('battlefield-area').getBoundingClientRect();
        const impactX = targetRect.left + targetRect.width/2 - battlefieldRect.left;
        const impactY = targetRect.top + targetRect.height/2 - battlefieldRect.top;
        
        // Phase 1: Wind-up (anticipation)
        attackerSprite.classList.add('attack-windup');
        
        setTimeout(() => {
            // Phase 2: Lunge forward
            attackerSprite.classList.remove('attack-windup');
            attackerSprite.classList.add('attack-lunge');
            
            setTimeout(() => {
                // Phase 3: Impact!
                this.createImpactFlash(impactX, impactY, 100);
                this.createSparks(impactX, impactY, 15);
                this.createImpactParticles(impactX, impactY, '#ff4444', 10);
                this.heavyImpact(damage);
                
                // Target recoils
                targetSprite.classList.add('hit-recoil');
                
                // Flash the stat bar
                const statBar = targetSprite.querySelector('.combat-stats');
                if (statBar) {
                    statBar.classList.add('damage-flash');
                    setTimeout(() => statBar.classList.remove('damage-flash'), 300);
                }
                
                setTimeout(() => {
                    // Phase 4: Return
                    attackerSprite.classList.remove('attack-lunge');
                    attackerSprite.classList.add('attack-return');
                    targetSprite.classList.remove('hit-recoil');
                    
                    setTimeout(() => {
                        attackerSprite.classList.remove('attack-return');
                        if (onComplete) onComplete();
                    }, 200);
                }, 150);
            }, 180);
        }, 150);
    },
    
    // ==================== STAT BAR ANIMATIONS ====================
    
    animateHPChange(cryptid, oldHP, newHP) {
        const sprite = document.querySelector(`.cryptid-sprite[data-owner="${cryptid.owner}"][data-col="${cryptid.col}"][data-row="${cryptid.row}"]`);
        if (!sprite) return;
        
        const hpArc = sprite.querySelector('.hp-arc');
        const hpValue = sprite.querySelector('.hp-badge .stat-value');
        if (!hpValue) return;
        
        const maxHP = cryptid.maxHp || cryptid.hp;
        const percent = Math.max(0, (newHP / maxHP) * 100);
        
        // Update HP arc class based on percentage
        if (hpArc) {
            hpArc.classList.remove('hp-low', 'hp-medium');
            if (percent <= 25) {
                hpArc.classList.add('hp-low');
            } else if (percent <= 50) {
                hpArc.classList.add('hp-medium');
            }
            
            // Update clip-path to shrink arc toward center
            const arcInset = 5 + (45 * (1 - percent / 100));
            const isPlayer = cryptid.owner === 'player';
            const arcClipPath = isPlayer 
                ? `inset(${arcInset}% 50% ${arcInset}% 0)`
                : `inset(${arcInset}% 0 ${arcInset}% 50%)`;
            hpArc.style.clipPath = arcClipPath;
        }
        
        // Animate text change
        const diff = newHP - oldHP;
        if (diff < 0) {
            hpValue.classList.add('decreased');
            setTimeout(() => hpValue.classList.remove('decreased'), 400);
        } else if (diff > 0) {
            hpValue.classList.add('increased');
            setTimeout(() => hpValue.classList.remove('increased'), 400);
        }
        
        hpValue.textContent = newHP;
    },
    
    animateATKChange(cryptid, oldATK, newATK) {
        const sprite = document.querySelector(`.cryptid-sprite[data-owner="${cryptid.owner}"][data-col="${cryptid.col}"][data-row="${cryptid.row}"]`);
        if (!sprite) return;
        
        const atkValue = sprite.querySelector('.atk-badge .stat-value');
        if (!atkValue) return;
        
        const diff = newATK - oldATK;
        if (diff > 0) {
            atkValue.classList.add('increased');
            setTimeout(() => atkValue.classList.remove('increased'), 500);
        } else if (diff < 0) {
            atkValue.classList.add('decreased');
            setTimeout(() => atkValue.classList.remove('decreased'), 500);
        }
        
        atkValue.textContent = newATK;
    }
};

// ==================== CSS INJECTION ====================

(function injectCombatStyles() {
    if (document.getElementById('combat-effects-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'combat-effects-styles';
    style.textContent = `
        /* ==================== SCREEN SHAKE ==================== */
        @keyframes screenShake {
            0%, 100% { transform: translate(0, 0); }
            10% { transform: translate(calc(var(--shake-intensity, 6px) * -0.8), calc(var(--shake-intensity, 6px) * 0.4)); }
            20% { transform: translate(calc(var(--shake-intensity, 6px) * 0.6), calc(var(--shake-intensity, 6px) * -0.6)); }
            30% { transform: translate(calc(var(--shake-intensity, 6px) * -0.4), calc(var(--shake-intensity, 6px) * 0.8)); }
            40% { transform: translate(calc(var(--shake-intensity, 6px) * 0.8), calc(var(--shake-intensity, 6px) * 0.2)); }
            50% { transform: translate(calc(var(--shake-intensity, 6px) * -0.6), calc(var(--shake-intensity, 6px) * -0.4)); }
            60% { transform: translate(calc(var(--shake-intensity, 6px) * 0.3), calc(var(--shake-intensity, 6px) * 0.6)); }
            70% { transform: translate(calc(var(--shake-intensity, 6px) * -0.2), calc(var(--shake-intensity, 6px) * -0.3)); }
            80% { transform: translate(calc(var(--shake-intensity, 6px) * 0.1), calc(var(--shake-intensity, 6px) * 0.2)); }
            90% { transform: translate(calc(var(--shake-intensity, 6px) * -0.05), calc(var(--shake-intensity, 6px) * -0.1)); }
        }
        
        #battlefield-area.screen-shaking {
            animation: screenShake 0.35s ease-out;
        }
        
        /* ==================== IMPACT PARTICLES ==================== */
        .impact-particles {
            position: absolute;
            pointer-events: none;
            z-index: 1000;
        }
        
        .impact-particle {
            position: absolute;
            width: 8px;
            height: 8px;
            background: var(--particle-color, #ff6b6b);
            border-radius: 50%;
            box-shadow: 0 0 10px var(--particle-color, #ff6b6b), 0 0 20px var(--particle-color, #ff6b6b);
            animation: particleBurst 0.5s ease-out forwards;
        }
        
        @keyframes particleBurst {
            0% {
                transform: translate(0, 0) scale(1);
                opacity: 1;
            }
            100% {
                transform: translate(var(--tx), var(--ty)) scale(0);
                opacity: 0;
            }
        }
        
        /* ==================== SPARKS ==================== */
        .spark-container {
            position: absolute;
            pointer-events: none;
            z-index: 1001;
        }
        
        .spark {
            position: absolute;
            width: 4px;
            height: 4px;
            background: #fff;
            border-radius: 50%;
            box-shadow: 0 0 6px #fff, 0 0 12px #ffdd44, 0 0 18px #ff8800;
            animation: sparkFly 0.3s ease-out forwards;
        }
        
        @keyframes sparkFly {
            0% {
                transform: translate(0, 0) scale(1.5);
                opacity: 1;
            }
            100% {
                transform: translate(var(--tx), var(--ty)) scale(0);
                opacity: 0;
            }
        }
        
        /* ==================== IMPACT FLASH ==================== */
        .impact-flash {
            position: absolute;
            transform: translate(-50%, -50%);
            border-radius: 50%;
            background: radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(255,200,100,0.6) 40%, transparent 70%);
            pointer-events: none;
            z-index: 999;
            animation: flashPulse 0.2s ease-out forwards;
        }
        
        @keyframes flashPulse {
            0% {
                transform: translate(-50%, -50%) scale(0.5);
                opacity: 1;
            }
            100% {
                transform: translate(-50%, -50%) scale(1.5);
                opacity: 0;
            }
        }
        
        /* ==================== DAMAGE NUMBERS ==================== */
        .damage-number-container {
            position: absolute;
            transform: translate(-50%, -50%);
            pointer-events: none;
            z-index: 1100;
            animation: damageFloat 1.2s ease-out forwards;
            text-align: center;
        }
        
        .damage-number-container .damage-text {
            font-family: 'Trebuchet MS', 'Impact', sans-serif;
            font-size: calc(24px * var(--damage-scale, 1));
            font-weight: 900;
            color: #fff;
            text-shadow: 
                0 0 4px #ff0000,
                0 2px 0 #880000,
                0 3px 0 #660000,
                0 4px 8px rgba(0,0,0,0.8),
                0 0 20px rgba(255,0,0,0.5);
            display: block;
            animation: damageImpact 0.3s ease-out;
        }
        
        .damage-number-container.critical .damage-text {
            font-size: calc(32px * var(--damage-scale, 1));
            color: #ffdd00;
            text-shadow: 
                0 0 8px #ff8800,
                0 2px 0 #cc6600,
                0 3px 0 #994400,
                0 4px 10px rgba(0,0,0,0.9),
                0 0 30px rgba(255,150,0,0.6);
            animation: critImpact 0.4s ease-out;
        }
        
        .damage-number-container .crit-label {
            font-family: 'Trebuchet MS', sans-serif;
            font-size: 14px;
            font-weight: 700;
            color: #ffaa00;
            text-shadow: 0 1px 3px rgba(0,0,0,0.8);
            animation: critLabelPop 0.5s ease-out;
        }
        
        .damage-number-container.blocked .damage-text {
            font-size: 18px;
            color: #88ccff;
            text-shadow: 
                0 0 6px #4488ff,
                0 2px 4px rgba(0,0,0,0.8);
        }
        
        @keyframes damageFloat {
            0% { opacity: 1; transform: translate(-50%, -50%); }
            20% { opacity: 1; transform: translate(-50%, calc(-50% - 20px)); }
            100% { opacity: 0; transform: translate(-50%, calc(-50% - 60px)); }
        }
        
        @keyframes damageImpact {
            0% { transform: scale(0.3); }
            50% { transform: scale(1.3); }
            100% { transform: scale(1); }
        }
        
        @keyframes critImpact {
            0% { transform: scale(0.2) rotate(-10deg); }
            30% { transform: scale(1.5) rotate(5deg); }
            50% { transform: scale(1.2) rotate(-3deg); }
            100% { transform: scale(1) rotate(0deg); }
        }
        
        @keyframes critLabelPop {
            0% { opacity: 0; transform: translateY(10px) scale(0.5); }
            50% { opacity: 1; transform: translateY(-5px) scale(1.2); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        
        /* ==================== HEAL NUMBERS ==================== */
        .heal-number-container {
            position: absolute;
            transform: translate(-50%, -50%);
            pointer-events: none;
            z-index: 1100;
            animation: healFloat 1s ease-out forwards;
        }
        
        .heal-number-container .heal-text {
            font-family: 'Trebuchet MS', sans-serif;
            font-size: 22px;
            font-weight: 900;
            color: #44ff88;
            text-shadow: 
                0 0 6px #22cc66,
                0 2px 0 #118844,
                0 3px 6px rgba(0,0,0,0.8),
                0 0 15px rgba(68,255,136,0.4);
            animation: healPop 0.3s ease-out;
        }
        
        @keyframes healFloat {
            0% { opacity: 1; transform: translate(-50%, -50%); }
            100% { opacity: 0; transform: translate(-50%, calc(-50% - 50px)); }
        }
        
        @keyframes healPop {
            0% { transform: scale(0.5); }
            60% { transform: scale(1.2); }
            100% { transform: scale(1); }
        }
        
        /* ==================== ATTACK ANIMATIONS ==================== */
        .cryptid-sprite.attack-windup {
            animation: attackWindup 0.15s ease-out forwards !important;
        }
        
        .cryptid-sprite.attack-lunge {
            animation: attackLunge 0.18s ease-out forwards !important;
        }
        
        .cryptid-sprite.attack-return {
            animation: attackReturn 0.2s ease-out forwards !important;
        }
        
        .cryptid-sprite.hit-recoil {
            animation: hitRecoil 0.25s ease-out !important;
        }
        
        /* Player attacks right */
        @keyframes attackWindup {
            0% { transform: translate(-50%, -50%); }
            100% { transform: translate(calc(-50% - 15px), calc(-50% - 8px)) scale(1.15); }
        }
        
        @keyframes attackLunge {
            0% { transform: translate(calc(-50% - 15px), calc(-50% - 8px)) scale(1.15); }
            100% { transform: translate(calc(-50% + 60px), -50%) scale(1.1); }
        }
        
        @keyframes attackReturn {
            0% { transform: translate(calc(-50% + 60px), -50%) scale(1.1); }
            40% { transform: translate(calc(-50% - 8px), -50%) scale(0.95); }
            100% { transform: translate(-50%, -50%) scale(1); }
        }
        
        @keyframes hitRecoil {
            0% { 
                transform: translate(-50%, -50%); 
                filter: brightness(3) saturate(0);
            }
            20% { 
                transform: translate(calc(-50% + 20px), calc(-50% - 5px)) scale(0.9); 
                filter: brightness(2) saturate(0.5);
            }
            50% { 
                transform: translate(calc(-50% + 10px), -50%) scale(0.95); 
                filter: brightness(0.6);
            }
            100% { 
                transform: translate(-50%, -50%) scale(1); 
                filter: brightness(1);
            }
        }
        
        /* Enemy attacks left - mirror the animations */
        .cryptid-sprite.enemy.attack-windup {
            animation: attackWindupLeft 0.15s ease-out forwards !important;
        }
        
        .cryptid-sprite.enemy.attack-lunge {
            animation: attackLungeLeft 0.18s ease-out forwards !important;
        }
        
        .cryptid-sprite.enemy.attack-return {
            animation: attackReturnLeft 0.2s ease-out forwards !important;
        }
        
        .cryptid-sprite.enemy.hit-recoil {
            animation: hitRecoilLeft 0.25s ease-out !important;
        }
        
        @keyframes attackWindupLeft {
            0% { transform: translate(-50%, -50%); }
            100% { transform: translate(calc(-50% + 15px), calc(-50% - 8px)) scale(1.15); }
        }
        
        @keyframes attackLungeLeft {
            0% { transform: translate(calc(-50% + 15px), calc(-50% - 8px)) scale(1.15); }
            100% { transform: translate(calc(-50% - 60px), -50%) scale(1.1); }
        }
        
        @keyframes attackReturnLeft {
            0% { transform: translate(calc(-50% - 60px), -50%) scale(1.1); }
            40% { transform: translate(calc(-50% + 8px), -50%) scale(0.95); }
            100% { transform: translate(-50%, -50%) scale(1); }
        }
        
        @keyframes hitRecoilLeft {
            0% { 
                transform: translate(-50%, -50%); 
                filter: brightness(3) saturate(0);
            }
            20% { 
                transform: translate(calc(-50% - 20px), calc(-50% - 5px)) scale(0.9); 
                filter: brightness(2) saturate(0.5);
            }
            50% { 
                transform: translate(calc(-50% - 10px), -50%) scale(0.95); 
                filter: brightness(0.6);
            }
            100% { 
                transform: translate(-50%, -50%) scale(1); 
                filter: brightness(1);
            }
        }
        
        /* ==================== CRESCENT MOON STAT BAR ==================== */
        .cryptid-sprite .combat-stats {
            position: absolute;
            top: 50%;
            transform: translateY(-50%);
            /* Scale with sprite size - base is ~40px sprite, stats are ~56px tall */
            width: calc(var(--sprite-size, 40px) * 0.7);
            height: calc(var(--sprite-size, 40px) * 1.4);
            z-index: 10;
            pointer-events: none;
        }
        
        /* Player monsters: stats on LEFT */
        .cryptid-sprite[data-owner="player"] .combat-stats {
            left: calc(var(--sprite-size, 40px) * -0.45);
            right: auto;
        }
        
        /* Enemy monsters: stats on RIGHT */
        .cryptid-sprite[data-owner="enemy"] .combat-stats {
            right: calc(var(--sprite-size, 40px) * -0.45);
            left: auto;
        }
        
        /* Crescent background arc */
        .combat-stats .crescent-bg {
            position: absolute;
            width: calc(var(--sprite-size, 40px) * 1.1);
            height: calc(var(--sprite-size, 40px) * 1.4);
            border: 2px solid rgba(50, 45, 40, 0.9);
            border-radius: 50%;
            background: linear-gradient(90deg, rgba(25, 22, 18, 0.85) 30%, transparent 70%);
            box-shadow: inset 0 0 10px rgba(0,0,0,0.5);
        }
        
        /* Player: arc curves to the right (clip left half visible) */
        .cryptid-sprite[data-owner="player"] .crescent-bg {
            right: 0;
            clip-path: inset(0 50% 0 0);
            border-right-color: transparent;
        }
        
        /* Enemy: arc curves to the left (clip right half visible) */
        .cryptid-sprite[data-owner="enemy"] .crescent-bg {
            left: 0;
            clip-path: inset(0 0 0 50%);
            border-left-color: transparent;
            background: linear-gradient(-90deg, rgba(25, 22, 18, 0.85) 30%, transparent 70%);
        }
        
        /* HP Arc - glowing indicator */
        .combat-stats .hp-arc {
            position: absolute;
            width: calc(var(--sprite-size, 40px) * 1.1);
            height: calc(var(--sprite-size, 40px) * 1.4);
            border: 2px solid transparent;
            border-radius: 50%;
            transition: clip-path 0.4s ease-out;
        }
        
        /* Player HP arc - clip-path set dynamically via inline style */
        .cryptid-sprite[data-owner="player"] .hp-arc {
            right: 0;
            border-left: 2px solid #44dd77;
            filter: drop-shadow(0 0 6px rgba(68, 221, 119, 0.6));
        }
        
        .cryptid-sprite[data-owner="player"] .hp-arc.hp-medium {
            border-left-color: #ddaa22;
            filter: drop-shadow(0 0 6px rgba(221, 170, 34, 0.6));
        }
        
        .cryptid-sprite[data-owner="player"] .hp-arc.hp-low {
            border-left-color: #dd4444;
            filter: drop-shadow(0 0 6px rgba(221, 68, 68, 0.6));
            animation: hpLowPulse 1s ease-in-out infinite;
        }
        
        /* Enemy HP arc */
        .cryptid-sprite[data-owner="enemy"] .hp-arc {
            left: 0;
            border-right: 2px solid #ff6666;
            filter: drop-shadow(0 0 6px rgba(255, 102, 102, 0.6));
        }
        
        .cryptid-sprite[data-owner="enemy"] .hp-arc.hp-medium {
            border-right-color: #ddaa22;
            filter: drop-shadow(0 0 6px rgba(221, 170, 34, 0.6));
        }
        
        .cryptid-sprite[data-owner="enemy"] .hp-arc.hp-low {
            border-right-color: #dd4444;
            filter: drop-shadow(0 0 6px rgba(221, 68, 68, 0.6));
            animation: hpLowPulse 1s ease-in-out infinite;
        }
        
        @keyframes hpLowPulse {
            0%, 100% { opacity: 1; filter: drop-shadow(0 0 6px rgba(221, 68, 68, 0.6)); }
            50% { opacity: 0.7; filter: drop-shadow(0 0 10px rgba(255, 50, 50, 0.9)); }
        }
        
        /* Stat badges */
        .combat-stats .stat-badge {
            position: absolute;
            background: rgba(15, 12, 10, 0.95);
            border: 1px solid rgba(120, 100, 70, 0.5);
            border-radius: 4px;
            padding: 1px 3px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0;
            box-shadow: 0 1px 4px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05);
            min-width: calc(var(--sprite-size, 40px) * 0.45);
        }
        
        /* Player badge positions (on left side) */
        .cryptid-sprite[data-owner="player"] .stat-badge.atk-badge {
            top: 2px;
            left: 0px;
        }
        
        .cryptid-sprite[data-owner="player"] .stat-badge.hp-badge {
            bottom: 2px;
            left: 0px;
        }
        
        /* Enemy badge positions (on right side) */
        .cryptid-sprite[data-owner="enemy"] .stat-badge.atk-badge {
            top: 2px;
            right: 0px;
        }
        
        .cryptid-sprite[data-owner="enemy"] .stat-badge.hp-badge {
            bottom: 2px;
            right: 0px;
        }
        
        .combat-stats .stat-icon {
            font-size: calc(var(--sprite-size, 40px) * 0.18);
            line-height: 1;
        }
        
        .combat-stats .atk-badge .stat-icon { color: #ff8888; }
        .combat-stats .hp-badge .stat-icon { color: #88ffaa; }
        
        .combat-stats .stat-value {
            font-family: 'Trebuchet MS', sans-serif;
            font-size: calc(var(--sprite-size, 40px) * 0.28);
            font-weight: 800;
            line-height: 1;
            text-shadow: 0 1px 2px rgba(0,0,0,0.8);
            transition: transform 0.2s, color 0.2s;
        }
        
        .combat-stats .atk-badge .stat-value {
            color: #ff9999;
        }
        
        .combat-stats .hp-badge .stat-value {
            color: #99ffbb;
        }
        
        /* Evolution pips - below HP badge */
        .combat-stats .evo-pips {
            position: absolute;
            bottom: -8px;
            display: flex;
            gap: 2px;
        }
        
        .cryptid-sprite[data-owner="player"] .evo-pips {
            left: 4px;
        }
        
        .cryptid-sprite[data-owner="enemy"] .evo-pips {
            right: 4px;
        }
        
        .combat-stats .evo-pip {
            width: calc(var(--sprite-size, 40px) * 0.1);
            height: calc(var(--sprite-size, 40px) * 0.1);
            background: linear-gradient(135deg, #88ddff, #44aaff);
            border-radius: 50%;
            box-shadow: 0 0 3px rgba(100, 180, 255, 0.6);
        }
        
        /* Stat change animations */
        .combat-stats .stat-value.decreased {
            animation: statDecrease 0.4s ease-out;
        }
        
        .combat-stats .stat-value.increased {
            animation: statIncrease 0.4s ease-out;
        }
        
        .combat-stats.damage-flash .hp-arc {
            animation: arcDamageFlash 0.3s ease-out;
        }
        
        .combat-stats.damage-flash .hp-badge {
            animation: badgeDamageFlash 0.3s ease-out;
        }
        
        @keyframes statDecrease {
            0% { transform: scale(1); }
            30% { transform: scale(1.5); color: #ff3333; }
            100% { transform: scale(1); }
        }
        
        @keyframes statIncrease {
            0% { transform: scale(1); }
            50% { transform: scale(1.4); color: #44ff88; }
            100% { transform: scale(1); }
        }
        
        @keyframes arcDamageFlash {
            0% { filter: drop-shadow(0 0 8px currentColor); }
            30% { filter: drop-shadow(0 0 20px #ff0000) brightness(2); }
            100% { filter: drop-shadow(0 0 8px currentColor); }
        }
        
        @keyframes badgeDamageFlash {
            0% { background: rgba(15, 12, 10, 0.95); }
            30% { background: rgba(80, 20, 20, 0.95); box-shadow: 0 0 15px rgba(255,0,0,0.5); }
            100% { background: rgba(15, 12, 10, 0.95); }
        }
        
        /* Hide old stat bar */
        .cryptid-sprite .stat-bar {
            display: none !important;
        }
    `;
    
    document.head.appendChild(style);
})();

// ==================== INTEGRATION HOOKS ====================

// Override the old floating damage function
window.showFloatingDamage = function(target, damage) {
    CombatEffects.showDamageNumber(target, damage, damage >= 5);
};

window.showFloatingHeal = function(target, amount) {
    CombatEffects.showHealNumber(target, amount);
};

console.log('[CombatEffects] System loaded');