/**
 * Cryptid Fates - Combat Effects System
 * Satisfying, weighty combat feedback with screen shake, particles, and dynamic stat bars
 * 
 * === INSTANT KILL EFFECTS ===
 * For any card ability that says "instantly kill" (not "deal damage"), use:
 * 
 *   // BEFORE calling game.killCryptid:
 *   const deathData = CombatEffects.prepareInstantKillDeath(owner, col, row);
 *   game.killCryptid(cryptid, killer);
 *   
 *   // AFTER any preceding effects (lightning, animations, etc):
 *   CombatEffects.playPreparedDeath(deathData);
 * 
 * This ensures the death animation plays correctly even after the sprite
 * is removed from the game state and DOM.
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
        
        // If we're in a dramatic death zoom, use JS-based shake that preserves the transform
        if (this._dramaticDeathZoomActive) {
            this._screenShakeJS(intensity, duration);
            return;
        }
        
        // Normal CSS-based shake
        const baseIntensity = 6 * intensity * this.config.screenShakeIntensity;
        battlefield.classList.add('screen-shaking');
        battlefield.style.setProperty('--shake-intensity', baseIntensity + 'px');
        
        setTimeout(() => {
            battlefield.classList.remove('screen-shaking');
            battlefield.style.removeProperty('--shake-intensity');
        }, duration);
    },
    
    // JavaScript-based screen shake that preserves existing transform (for use during zoom)
    _screenShakeJS(intensity = 1, duration = 300) {
        const battlefield = document.getElementById('battlefield-area');
        if (!battlefield) return;
        
        const baseIntensity = 6 * intensity * this.config.screenShakeIntensity;
        const startTime = performance.now();
        const baseTransform = this._dramaticDeathBaseTransform || '';
        
        console.log(`[ScreenShakeJS] Starting: intensity=${baseIntensity}, duration=${duration}, baseTransform=${baseTransform}`);
        
        // Use very fast transition instead of none - this prevents interrupting the zoom
        // but still makes shake movements quick enough to feel sharp
        const savedTransition = battlefield.style.transition;
        battlefield.style.transition = 'transform 16ms linear';
        
        const shake = (currentTime) => {
            const elapsed = currentTime - startTime;
            if (elapsed >= duration) {
                // Restore base transform with smooth transition back
                battlefield.style.transition = 'transform 100ms ease-out';
                battlefield.style.transform = baseTransform;
                // Restore original transition after settling
                setTimeout(() => {
                    battlefield.style.transition = savedTransition;
                }, 100);
                return;
            }
            
            // Decay intensity over time
            const progress = elapsed / duration;
            const decay = 1 - Math.pow(progress, 0.5); // Square root for nice falloff
            const currentIntensity = baseIntensity * decay;
            
            // Random offset
            const offsetX = (Math.random() - 0.5) * 2 * currentIntensity;
            const offsetY = (Math.random() - 0.5) * 2 * currentIntensity;
            
            // Combine with base transform (zoom)
            battlefield.style.transform = `${baseTransform} translate(${offsetX}px, ${offsetY}px)`;
            
            requestAnimationFrame(shake);
        };
        
        requestAnimationFrame(shake);
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
    
    // ==================== LIGHTNING STRIKE EFFECT ====================
    
    createLightningStrike(targetX, targetY, onComplete) {
        const battlefield = document.getElementById('battlefield-area');
        if (!battlefield) {
            if (onComplete) onComplete();
            return;
        }
        
        const battlefieldRect = battlefield.getBoundingClientRect();
        
        // Pre-flash - entire screen flashes white/blue
        const skyFlash = document.createElement('div');
        skyFlash.className = 'lightning-sky-flash';
        battlefield.appendChild(skyFlash);
        
        // Create the lightning bolt container - starts from top of battlefield
        const container = document.createElement('div');
        container.className = 'lightning-container';
        container.style.left = targetX + 'px';
        container.style.top = '0px';
        battlefield.appendChild(container);
        
        // Generate multiple lightning segments (CSS-based for reliability)
        // Lightning goes from top of battlefield down to target
        const boltHeight = targetY;
        const numSegments = 8 + Math.floor(Math.random() * 4);
        const segmentHeight = Math.max(boltHeight / numSegments, 15);
        
        console.log('[Lightning] Creating bolt from (0,0) to', targetX, targetY, 'height:', boltHeight, 'segments:', numSegments);
        
        // Use a single SVG path for guaranteed connectivity
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'lightning-svg');
        svg.style.position = 'absolute';
        svg.style.left = '-100px';
        svg.style.top = '0';
        svg.style.width = '200px';
        svg.style.height = (boltHeight + 50) + 'px';
        svg.style.overflow = 'visible';
        svg.style.pointerEvents = 'none';
        
        // Build the lightning path as connected points
        // Start at center top, end exactly at center (where target is)
        const centerX = 100; // Center of SVG
        const points = [{x: centerX, y: 0}];
        
        for (let i = 0; i < numSegments; i++) {
            const prev = points[points.length - 1];
            const isLastSegment = (i === numSegments - 1);
            
            if (isLastSegment) {
                // Final point lands exactly on target center
                points.push({
                    x: centerX,
                    y: boltHeight
                });
            } else {
                // Intermediate points have random jag, but gradually pull toward center
                const progress = i / numSegments;
                const maxJag = 70 * (1 - progress * 0.5); // Less jag as we approach target
                const jag = (Math.random() - 0.5) * maxJag;
                // Bias toward center as we get closer
                const pullToCenter = (prev.x - centerX) * 0.2;
                points.push({
                    x: prev.x + jag - pullToCenter,
                    y: prev.y + segmentHeight
                });
            }
        }
        
        // Create SVG path string
        let pathD = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
            pathD += ` L ${points[i].x} ${points[i].y}`;
        }
        
        // Main glow bolt (thick, blurred)
        const glowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        glowPath.setAttribute('d', pathD);
        glowPath.setAttribute('stroke', 'rgba(150, 180, 255, 0.8)');
        glowPath.setAttribute('stroke-width', '8');
        glowPath.setAttribute('fill', 'none');
        glowPath.setAttribute('stroke-linecap', 'round');
        glowPath.setAttribute('stroke-linejoin', 'round');
        glowPath.setAttribute('filter', 'blur(4px)');
        glowPath.setAttribute('class', 'lightning-glow-path');
        
        // Outer glow
        const outerGlow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        outerGlow.setAttribute('d', pathD);
        outerGlow.setAttribute('stroke', 'rgba(100, 150, 255, 0.5)');
        outerGlow.setAttribute('stroke-width', '16');
        outerGlow.setAttribute('fill', 'none');
        outerGlow.setAttribute('stroke-linecap', 'round');
        outerGlow.setAttribute('stroke-linejoin', 'round');
        outerGlow.setAttribute('filter', 'blur(8px)');
        outerGlow.setAttribute('class', 'lightning-outer-path');
        
        // Core bright bolt (thin, sharp)
        const corePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        corePath.setAttribute('d', pathD);
        corePath.setAttribute('stroke', '#ffffff');
        corePath.setAttribute('stroke-width', '2');
        corePath.setAttribute('fill', 'none');
        corePath.setAttribute('stroke-linecap', 'round');
        corePath.setAttribute('stroke-linejoin', 'round');
        corePath.setAttribute('class', 'lightning-core-path');
        
        // Add branches
        for (let i = 2; i < points.length - 2; i++) {
            if (Math.random() > 0.5) {
                const start = points[i];
                const branchDir = Math.random() > 0.5 ? 1 : -1;
                const branchEndX = start.x + branchDir * (20 + Math.random() * 30);
                const branchEndY = start.y + (15 + Math.random() * 25);
                
                const branchPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                branchPath.setAttribute('d', `M ${start.x} ${start.y} L ${branchEndX} ${branchEndY}`);
                branchPath.setAttribute('stroke', 'rgba(200, 220, 255, 0.7)');
                branchPath.setAttribute('stroke-width', '1.5');
                branchPath.setAttribute('fill', 'none');
                branchPath.setAttribute('stroke-linecap', 'round');
                branchPath.setAttribute('filter', 'blur(1px)');
                branchPath.setAttribute('class', 'lightning-branch-path');
                svg.appendChild(branchPath);
            }
        }
        
        svg.appendChild(outerGlow);
        svg.appendChild(glowPath);
        svg.appendChild(corePath);
        container.appendChild(svg);
        
        console.log('[Lightning] Created SVG bolt with', points.length, 'points');
        
        // Impact effects at target
        setTimeout(() => {
            // Big impact flash
            const impactFlash = document.createElement('div');
            impactFlash.className = 'lightning-impact';
            impactFlash.style.left = targetX + 'px';
            impactFlash.style.top = targetY + 'px';
            battlefield.appendChild(impactFlash);
            
            // Sparks flying everywhere
            this.createSparks(targetX, targetY, 25);
            this.createImpactParticles(targetX, targetY, '#88ccff', 18);
            this.createImpactParticles(targetX, targetY, '#ffffff', 10);
            
            // Heavy screen shake
            this.heavyImpact(10);
            
            setTimeout(() => impactFlash.remove(), 500);
        }, 60);
        
        // Second flash for drama
        setTimeout(() => {
            const secondFlash = document.createElement('div');
            secondFlash.className = 'lightning-sky-flash secondary';
            battlefield.appendChild(secondFlash);
            setTimeout(() => secondFlash.remove(), 200);
        }, 120);
        
        // Thunder rumble (third flash)
        setTimeout(() => {
            const thirdFlash = document.createElement('div');
            thirdFlash.className = 'lightning-sky-flash tertiary';
            battlefield.appendChild(thirdFlash);
            setTimeout(() => thirdFlash.remove(), 100);
        }, 250);
        
        // Cleanup
        setTimeout(() => {
            skyFlash.remove();
            container.remove();
            if (onComplete) onComplete();
        }, 600);
    },
    
    // Lightning strike on a specific cryptid
    strikeCryptid(target, onComplete) {
        console.log('[Lightning] strikeCryptid called with target:', target);
        if (!target) {
            console.log('[Lightning] No target, skipping');
            if (onComplete) onComplete();
            return;
        }
        
        const key = `${target.owner}-${target.col}-${target.row}`;
        const pos = window.tilePositions?.[key];
        console.log('[Lightning] Position key:', key, 'pos:', pos);
        if (!pos) {
            console.log('[Lightning] No position found, skipping');
            if (onComplete) onComplete();
            return;
        }
        
        console.log('[Lightning] Striking at', pos.x, pos.y);
        this.createLightningStrike(pos.x, pos.y, onComplete);
    },
    
    // ==================== INSTANT KILL DEATH ANIMATION ====================
    // Universal death animation for instant-kill effects (not damage-based)
    // Use this for Blood Covenant, sacrifice effects, or any "instantly kill" ability
    //
    // IMPORTANT: Call prepareInstantKillDeath BEFORE removing the cryptid from game state,
    // then call playPreparedDeath AFTER any effects (like lightning) complete.
    
    // Step 1: Capture sprite before kill (call this BEFORE killCryptid)
    prepareInstantKillDeath(cryptidOwner, cryptidCol, cryptidRow) {
        const spriteSelector = `.cryptid-sprite[data-owner="${cryptidOwner}"][data-col="${cryptidCol}"][data-row="${cryptidRow}"]`;
        const originalSprite = document.querySelector(spriteSelector);
        
        if (!originalSprite) {
            console.log('[InstantKill] No sprite found for', cryptidOwner, cryptidCol, cryptidRow);
            return null;
        }
        
        // Create a clean death sprite with just the visual
        const deathSprite = document.createElement('div');
        deathSprite.className = 'cryptid-sprite death-effect-sprite';
        
        // Copy only the visual sprite element
        const spriteEl = originalSprite.querySelector('.sprite');
        if (spriteEl) {
            const clonedSprite = spriteEl.cloneNode(true);
            // Preserve the correct horizontal orientation
            // Enemy sprites face left (scaleX(1)), player sprites are flipped (scaleX(-1))
            if (cryptidOwner === 'enemy') {
                clonedSprite.style.transform = 'scaleX(1)';
            } else {
                clonedSprite.style.transform = 'scaleX(-1)';
            }
            deathSprite.appendChild(clonedSprite);
        }
        
        // Position exactly where the original was
        deathSprite.style.left = originalSprite.style.left;
        deathSprite.style.top = originalSprite.style.top;
        deathSprite.style.transform = 'translate(-50%, -50%)';
        deathSprite.style.zIndex = '1500';
        deathSprite.style.pointerEvents = 'none';
        
        return {
            deathSprite,
            owner: cryptidOwner
        };
    },
    
    // Step 2: Play the prepared death animation (call this AFTER effects complete)
    playPreparedDeath(preparedData, onComplete) {
        if (!preparedData || !preparedData.deathSprite) {
            if (onComplete) onComplete();
            return;
        }
        
        const spriteLayer = document.getElementById('sprite-layer');
        if (!spriteLayer) {
            if (onComplete) onComplete();
            return;
        }
        
        const { deathSprite, owner } = preparedData;
        
        // Add to sprite layer and trigger death animation
        spriteLayer.appendChild(deathSprite);
        
        // Use appropriate death direction based on owner
        const deathClass = owner === 'enemy' ? 'dying-right' : 'dying-left';
        deathSprite.classList.add(deathClass);
        
        // Remove after animation
        const TIMING = window.TIMING || { deathAnim: 700 };
        setTimeout(() => {
            if (deathSprite.isConnected) {
                deathSprite.remove();
            }
            if (onComplete) onComplete();
        }, TIMING.deathAnim);
        
        return deathSprite;
    },
    
    // Convenience: One-step version if sprite is still in DOM (call BEFORE killCryptid)
    playInstantKillDeath(cryptidOwner, cryptidCol, cryptidRow, onComplete) {
        const preparedData = this.prepareInstantKillDeath(cryptidOwner, cryptidCol, cryptidRow);
        return this.playPreparedDeath(preparedData, onComplete);
    },
    
    // ==================== DRAMATIC DEATH ANIMATION ====================
    // Climactic death animation that scales with rarity
    // common -> uncommon -> rare -> ULTIMATE (most dramatic)
    
    // Rarity configuration for death drama - Hollywood-style cinematic deaths
    deathDramaConfig: {
        common: {
            zoomScale: 1.08,
            zoomInDuration: 200,    // Fast zoom in
            holdDuration: 100,      // Brief pause at zoom
            zoomOutDuration: 300,   // Slower zoom out
            shakeIntensity: 0.5,
            particleCount: 6,
            deathAnimSpeed: 1.0,    // Normal speed
            vignette: false,
            desaturate: false,
            flashColor: 'rgba(255, 80, 80, 0.4)'
        },
        uncommon: {
            zoomScale: 1.12,
            zoomInDuration: 250,
            holdDuration: 200,
            zoomOutDuration: 400,
            shakeIntensity: 0.8,
            particleCount: 12,
            deathAnimSpeed: 0.85,   // Slightly slower
            vignette: true,
            vignetteOpacity: 0.35,
            desaturate: false,
            flashColor: 'rgba(80, 180, 255, 0.5)'
        },
        rare: {
            zoomScale: 1.18,
            zoomInDuration: 300,
            holdDuration: 350,      // Longer dramatic pause
            zoomOutDuration: 500,
            shakeIntensity: 1.2,
            particleCount: 20,
            deathAnimSpeed: 0.65,   // Slow motion
            vignette: true,
            vignetteOpacity: 0.5,
            desaturate: true,       // Desaturate for drama
            flashColor: 'rgba(180, 120, 255, 0.6)'
        },
        ultimate: {
            zoomScale: 1.28,
            zoomInDuration: 400,
            holdDuration: 550,      // Maximum drama
            zoomOutDuration: 700,
            shakeIntensity: 2.0,
            particleCount: 35,
            deathAnimSpeed: 0.5,    // Half speed for max drama
            vignette: true,
            vignetteOpacity: 0.7,
            desaturate: true,
            screenFlash: true,
            radialBurst: true,
            flashColor: 'rgba(255, 200, 50, 0.7)'
        }
    },
    
    // Main dramatic death function - Hollywood-style cinematic death sequence
    playDramaticDeath(sprite, owner, rarity = 'common', onComplete) {
        if (!sprite) {
            if (onComplete) onComplete();
            return;
        }
        
        const config = this.deathDramaConfig[rarity] || this.deathDramaConfig.common;
        const battlefield = document.getElementById('battlefield-area');
        const spriteLayer = document.getElementById('sprite-layer');
        const gameScreen = document.getElementById('game-screen');
        
        if (!battlefield || !spriteLayer) {
            // Fallback to basic death
            sprite.classList.add(owner === 'enemy' ? 'dying-right' : 'dying-left');
            const TIMING = window.TIMING || { deathAnim: 700 };
            setTimeout(() => onComplete?.(), TIMING.deathAnim);
            return;
        }
        
        console.log(`[DramaticDeath] Starting ${rarity} death for ${owner}`);
        
        // Guard against multiple calls for the same sprite
        if (sprite.dataset.dramaticDeathStarted) {
            console.log('[DramaticDeath] Already started for this sprite, skipping');
            if (onComplete) onComplete();
            return;
        }
        sprite.dataset.dramaticDeathStarted = 'true';
        
        // ==================== IMMEDIATE: START ZOOM ON IMPACT ====================
        // Calculate focus point from ORIGINAL sprite position FIRST
        const spriteRect = sprite.getBoundingClientRect();
        const battlefieldRect = battlefield.getBoundingClientRect();
        const focusX = spriteRect.left + spriteRect.width/2 - battlefieldRect.left;
        const focusY = spriteRect.top + spriteRect.height/2 - battlefieldRect.top;
        const focusXPct = (focusX / battlefieldRect.width) * 100;
        const focusYPct = (focusY / battlefieldRect.height) * 100;
        
        // START ZOOM IMMEDIATELY - this is the first thing that happens on impact!
        battlefield.style.transformOrigin = `${focusXPct}% ${focusYPct}%`;
        battlefield.style.transition = `transform ${config.zoomInDuration}ms cubic-bezier(0.2, 0, 0.3, 1)`;
        void battlefield.offsetWidth; // Force reflow
        
        const zoomTransform = `scale(${config.zoomScale})`;
        battlefield.style.transform = zoomTransform;
        
        // Track that we're in a zoomed state (for screenShake compatibility)
        this._dramaticDeathZoomActive = true;
        this._dramaticDeathBaseTransform = zoomTransform;
        
        // IMPACT SHAKE - happens shortly after impact
        setTimeout(() => {
            this.screenShake(config.shakeIntensity * 2.5, 250);
        }, 80); // Small delay for zoom to establish
        
        // ==================== SETUP (happens in parallel with zoom) ====================
        // Clone sprite for death animation
        const deathClone = sprite.cloneNode(true);
        deathClone.className = 'cryptid-sprite death-drama-sprite';
        deathClone.dataset.dramaticDeathStarted = 'true'; // Prevent re-animation of clone
        if (owner === 'enemy') deathClone.classList.add('enemy');
        
        // Position clone exactly where original was
        deathClone.style.cssText = `
            position: absolute;
            left: ${sprite.style.left};
            top: ${sprite.style.top};
            transform: translate(-50%, -50%);
            z-index: 1500;
            pointer-events: none;
        `;
        
        // Fix sprite orientation
        const spriteImg = deathClone.querySelector('.sprite');
        if (spriteImg) {
            spriteImg.style.transform = owner === 'enemy' ? 'scaleX(1)' : 'scaleX(-1)';
        }
        
        // Remove combat stats and status icons
        const combatStats = deathClone.querySelector('.combat-stats');
        if (combatStats) combatStats.remove();
        const statusIcons = deathClone.querySelector('.status-icons');
        if (statusIcons) statusIcons.remove();
        
        // Remove data attributes
        ['data-owner', 'data-col', 'data-row', 'data-cryptid-key'].forEach(attr => {
            deathClone.removeAttribute(attr);
        });
        
        spriteLayer.appendChild(deathClone);
        
        // Hide original sprite
        sprite.style.opacity = '0';
        sprite.style.pointerEvents = 'none';
        
        // Create overlay for effects
        const overlay = document.createElement('div');
        overlay.className = 'death-drama-overlay';
        overlay.style.cssText = `
            position: absolute;
            inset: 0;
            pointer-events: none;
            z-index: 1400;
            overflow: hidden;
        `;
        battlefield.appendChild(overlay);
        
        // Calculate timeline
        const TIMING = window.TIMING || { deathAnim: 700 };
        const baseDeathDuration = TIMING.deathAnim;
        const actualDeathDuration = baseDeathDuration / config.deathAnimSpeed;
        
        const zoomInEnd = config.zoomInDuration;
        const holdEnd = zoomInEnd + config.holdDuration;
        const deathStart = holdEnd;
        const deathEnd = deathStart + actualDeathDuration;
        const zoomOutStart = deathEnd - 200;
        const totalDuration = deathEnd + 100;
        
        console.log(`[DramaticDeath] Timeline: zoomIn=${zoomInEnd}ms, hold=${holdEnd}ms, death=${deathEnd}ms, total=${totalDuration}ms`);
        
        // ==================== PHASE 1: IMPACT EFFECTS (parallel with zoom) ====================
        
        // Edge-only impact flash (epilepsy-safe)
        const impactFlash = document.createElement('div');
        impactFlash.style.cssText = `
            position: absolute;
            inset: 0;
            background: radial-gradient(circle at ${focusXPct}% ${focusYPct}%, 
                transparent 20%, 
                ${config.flashColor.replace(/[\d.]+\)$/, '0.3)')} 50%, 
                ${config.flashColor} 100%);
            opacity: 0;
            animation: dramaticDeathFlash ${config.zoomInDuration}ms ease-out forwards;
        `;
        overlay.appendChild(impactFlash);
        
        // Vignette effect
        if (config.vignette) {
            const vignette = document.createElement('div');
            vignette.style.cssText = `
                position: absolute;
                inset: 0;
                background: radial-gradient(circle at ${focusXPct}% ${focusYPct}%, 
                    transparent 15%, 
                    rgba(0,0,0,${config.vignetteOpacity * 0.4}) 40%, 
                    rgba(0,0,0,${config.vignetteOpacity}) 80%);
                opacity: 0;
                animation: vignetteIn ${config.zoomInDuration}ms ease-out forwards;
            `;
            overlay.appendChild(vignette);
        }
        
        // Desaturation (rare+)
        if (config.desaturate && gameScreen) {
            gameScreen.style.transition = `filter ${config.zoomInDuration}ms ease-out`;
            gameScreen.style.filter = 'saturate(0.4) contrast(1.1)';
        }
        
        // IMPACT HIT ANIMATION on sprite - knockback recoil
        const impactAnim = owner === 'enemy' ? 'deathImpactHitRight' : 'deathImpactHitLeft';
        deathClone.style.transition = 'none';
        deathClone.style.animation = `${impactAnim} 180ms ease-out forwards`;
        
        // ==================== PHASE 2: DRAMATIC HOLD ====================
        setTimeout(() => {
            console.log('[DramaticDeath] Hold phase started');
            
            // Add subtle pulse during hold
            if (rarity === 'rare' || rarity === 'ultimate') {
                deathClone.style.animation = `deathPulse ${config.holdDuration}ms ease-in-out`;
            }
        }, zoomInEnd);
        
        // ==================== PHASE 3: DEATH ANIMATION ====================
        setTimeout(() => {
            console.log('[DramaticDeath] Death animation started');
            
            // Particles burst
            this.createImpactParticles(focusX, focusY, config.flashColor.replace(/[\d.]+\)$/, '1)'), config.particleCount);
            
            // Apply death animation with custom speed
            const deathClass = owner === 'enemy' ? 'dying-right' : 'dying-left';
            deathClone.style.animation = ''; // Clear any previous animation
            deathClone.style.animationDuration = `${actualDeathDuration}ms`;
            deathClone.style.animationTimingFunction = 'ease-out';
            deathClone.style.animationFillMode = 'forwards';
            deathClone.classList.add(deathClass);
            
            // Extra particles during death for higher rarities
            if (rarity === 'rare' || rarity === 'ultimate') {
                const burstInterval = setInterval(() => {
                    this.createSparks(
                        focusX + (Math.random() - 0.5) * 50, 
                        focusY + (Math.random() - 0.5) * 50, 
                        4
                    );
                }, 80);
                setTimeout(() => clearInterval(burstInterval), actualDeathDuration);
            }
            
            // Radial burst for ultimate
            if (config.radialBurst) {
                for (let i = 0; i < 16; i++) {
                    const ray = document.createElement('div');
                    const angle = (i / 16) * 360;
                    ray.style.cssText = `
                        position: absolute;
                        left: ${focusX}px;
                        top: ${focusY}px;
                        width: 3px;
                        height: 0;
                        background: linear-gradient(to bottom, 
                            rgba(255, 220, 100, 0.95), 
                            rgba(255, 100, 50, 0.7), 
                            transparent);
                        transform-origin: center top;
                        transform: translate(-50%, 0) rotate(${angle}deg);
                        animation: deathRayBurst ${actualDeathDuration * 0.6}ms ease-out forwards;
                        animation-delay: ${i * 15}ms;
                    `;
                    overlay.appendChild(ray);
                }
            }
        }, deathStart);
        
        // ==================== PHASE 4: ZOOM OUT ====================
        setTimeout(() => {
            console.log('[DramaticDeath] Zoom out started');
            
            // Update base transform for any ongoing shakes
            this._dramaticDeathBaseTransform = 'scale(1)';
            
            // Restore saturation
            if (config.desaturate && gameScreen) {
                gameScreen.style.transition = `filter ${config.zoomOutDuration}ms ease-out`;
                gameScreen.style.filter = '';
            }
            
            // Smooth zoom out
            battlefield.style.transition = `transform ${config.zoomOutDuration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
            battlefield.style.transform = 'scale(1)';
        }, zoomOutStart);
        
        // ==================== CLEANUP ====================
        setTimeout(() => {
            console.log('[DramaticDeath] Cleanup');
            
            // Clear zoom tracking
            this._dramaticDeathZoomActive = false;
            this._dramaticDeathBaseTransform = '';
            
            // Reset all styles
            battlefield.style.transition = '';
            battlefield.style.transform = '';
            battlefield.style.transformOrigin = '';
            
            if (gameScreen) {
                gameScreen.style.transition = '';
                gameScreen.style.filter = '';
            }
            
            // Remove overlay and clone
            overlay.remove();
            if (deathClone.isConnected) {
                deathClone.remove();
            }
            
            if (onComplete) onComplete();
        }, totalDuration);
    },
    
    // Helper to get rarity color for particles
    getRarityColor(rarity) {
        const colors = {
            common: '#888888',
            uncommon: '#4da6ff',
            rare: '#b366ff',
            ultimate: '#ffd700'
        };
        return colors[rarity] || colors.common;
    },
    
    // ==================== ENHANCED ATTACK ANIMATION SYSTEM ====================
    // Features: Squash/stretch, hitstop, afterimage trails, damage-scaled intensity
    
    /**
     * Play the full enhanced attack animation sequence
     * @param {HTMLElement} attackerSprite - The attacking cryptid's sprite element
     * @param {string} owner - 'player' or 'enemy'
     * @param {HTMLElement} targetSprite - The target cryptid's sprite element (optional)
     * @param {number} damage - Damage dealt (affects intensity)
     * @param {Function} onImpact - Callback at moment of impact
     * @param {Function} onComplete - Callback when animation completes
     */
    playEnhancedAttack(attackerSprite, owner, targetSprite, damage = 1, onImpact, onComplete) {
        if (!attackerSprite) {
            if (onImpact) onImpact();
            if (onComplete) onComplete();
            return;
        }
        
        const battlefield = document.getElementById('battlefield-area');
        const isEnemy = owner === 'enemy';
        
        // Scale intensity based on damage (1-2 = light, 3-4 = medium, 5+ = heavy)
        const intensity = Math.min(1 + (damage * 0.15), 2);
        const hitstopDuration = Math.min(40 + (damage * 8), 100); // 40-100ms hitstop
        
        // Get positions for effects
        let impactX = 0, impactY = 0;
        if (targetSprite && battlefield) {
            const targetRect = targetSprite.getBoundingClientRect();
            const battlefieldRect = battlefield.getBoundingClientRect();
            impactX = targetRect.left + targetRect.width/2 - battlefieldRect.left;
            impactY = targetRect.top + targetRect.height/2 - battlefieldRect.top;
        }
        
        // Create afterimage trail container
        const trailContainer = document.createElement('div');
        trailContainer.className = 'attack-trail-container';
        trailContainer.style.cssText = `position: absolute; inset: 0; pointer-events: none; z-index: 15;`;
        if (battlefield) battlefield.appendChild(trailContainer);
        
        // Phase 1: ANTICIPATION (squash + pull back)
        attackerSprite.classList.add('attack-anticipation');
        attackerSprite.style.setProperty('--attack-intensity', intensity);
        
        setTimeout(() => {
            // Phase 2: LUNGE (stretch + forward motion + afterimage)
            attackerSprite.classList.remove('attack-anticipation');
            attackerSprite.classList.add('attack-lunge-enhanced');
            
            // Create afterimage trail
            this._createAfterimageTrail(attackerSprite, trailContainer, isEnemy, 3);
            
            setTimeout(() => {
                // Phase 3: IMPACT + HITSTOP
                attackerSprite.classList.remove('attack-lunge-enhanced');
                attackerSprite.classList.add('attack-impact-freeze');
                
                // Visual impact effects
                if (targetSprite) {
                    this.createImpactFlash(impactX, impactY, 80 + damage * 15);
                    this.createSparks(impactX, impactY, 10 + damage * 3);
                    
                    // Element-colored impact particles
                    const element = attackerSprite.className.match(/element-(\w+)/)?.[1];
                    const particleColor = this._getElementColor(element) || '#ff6b6b';
                    this.createImpactParticles(impactX, impactY, particleColor, 8 + damage * 2);
                }
                
                // Screen shake scaled to damage
                this.heavyImpact(damage);
                
                // Fire impact callback (damage application happens here)
                if (onImpact) onImpact();
                
                // HITSTOP - freeze both attacker and target briefly
                if (targetSprite) {
                    targetSprite.classList.add('hitstop-freeze');
                }
                
                // After hitstop, play hit reaction on target
                setTimeout(() => {
                    attackerSprite.classList.remove('attack-impact-freeze');
                    if (targetSprite) {
                        targetSprite.classList.remove('hitstop-freeze');
                        // Trigger enhanced hit reaction
                        this.playHitReaction(targetSprite, damage, isEnemy ? 'left' : 'right');
                    }
                    
                    // Phase 4: RECOVERY (return with slight overshoot)
                    attackerSprite.classList.add('attack-recovery');
                    
                    setTimeout(() => {
                        attackerSprite.classList.remove('attack-recovery');
                        attackerSprite.style.removeProperty('--attack-intensity');
                        trailContainer.remove();
                        if (onComplete) onComplete();
                    }, 220);
                }, hitstopDuration);
            }, 160);
        }, 140);
    },
    
    /**
     * Create afterimage trail during lunge
     */
    _createAfterimageTrail(sprite, container, isEnemy, count = 3) {
        const spriteRect = sprite.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        for (let i = 0; i < count; i++) {
            setTimeout(() => {
                const ghost = document.createElement('div');
                ghost.className = 'attack-afterimage';
                
                // Clone the sprite visual
                const spriteImg = sprite.querySelector('.sprite');
                if (spriteImg) {
                    ghost.innerHTML = spriteImg.innerHTML;
                }
                
                const currentRect = sprite.getBoundingClientRect();
                ghost.style.cssText = `
                    position: absolute;
                    left: ${currentRect.left - containerRect.left + currentRect.width/2}px;
                    top: ${currentRect.top - containerRect.top + currentRect.height/2}px;
                    transform: translate(-50%, -50%) ${isEnemy ? '' : 'scaleX(-1)'};
                    opacity: ${0.6 - i * 0.15};
                    filter: blur(${1 + i}px) brightness(1.5);
                    pointer-events: none;
                    font-size: var(--sprite-size);
                `;
                
                container.appendChild(ghost);
                
                // Fade out
                setTimeout(() => {
                    ghost.style.transition = 'opacity 0.15s ease-out';
                    ghost.style.opacity = '0';
                    setTimeout(() => ghost.remove(), 150);
                }, 50);
            }, i * 30);
        }
    },
    
    /**
     * Get element color for particles
     */
    _getElementColor(element) {
        const colors = {
            void: '#9b59b6',
            blaze: '#e74c3c',
            blood: '#c0392b',
            water: '#3498db',
            steel: '#95a5a6',
            nature: '#27ae60'
        };
        return colors[element] || null;
    },
    
    // ==================== ENHANCED HIT REACTION ====================
    // Features: Knockback arc, rim highlight, damage-scaled intensity, sprite distortion
    
    /**
     * Play enhanced hit reaction with knockback arc
     * @param {HTMLElement} sprite - Target sprite element
     * @param {number} damage - Damage taken (affects intensity)
     * @param {string} direction - 'left' or 'right' (direction of knockback)
     */
    playHitReaction(sprite, damage = 1, direction = 'right') {
        if (!sprite) return;
        
        // Calculate intensity (1-2 = flinch, 3-4 = recoil, 5+ = heavy knockback)
        const intensity = Math.min(damage / 3, 2);
        const reactionClass = damage >= 5 ? 'hit-knockback-heavy' : 
                             damage >= 3 ? 'hit-knockback-medium' : 'hit-knockback-light';
        
        sprite.style.setProperty('--hit-direction', direction === 'left' ? '-1' : '1');
        sprite.style.setProperty('--hit-intensity', intensity);
        sprite.classList.add(reactionClass);
        sprite.classList.add('hit-rim-flash');
        
        // Flash the stat bar
        const statBar = sprite.querySelector('.combat-stats');
        if (statBar) {
            statBar.classList.add('damage-flash-enhanced');
            setTimeout(() => statBar.classList.remove('damage-flash-enhanced'), 400);
        }
        
        // Clean up
        const duration = 300 + (damage * 30);
        setTimeout(() => {
            sprite.classList.remove(reactionClass);
            sprite.classList.remove('hit-rim-flash');
            sprite.style.removeProperty('--hit-direction');
            sprite.style.removeProperty('--hit-intensity');
        }, duration);
    },
    
    // ==================== ENHANCED SUMMON ANIMATION ====================
    // Features: Element particles, summoning circle, ground impact, staggered reveal
    
    /**
     * Play enhanced summon animation
     * @param {HTMLElement} sprite - The summoned cryptid's sprite element
     * @param {string} element - Element type (void, blaze, water, steel, nature)
     * @param {string} rarity - Rarity (common, uncommon, rare, ultimate)
     * @param {Function} onComplete - Callback when animation completes
     */
    playSummonAnimation(sprite, element = 'steel', rarity = 'common', onComplete) {
        if (!sprite) {
            if (onComplete) onComplete();
            return;
        }
        
        const battlefield = document.getElementById('battlefield-area');
        if (!battlefield) {
            if (onComplete) onComplete();
            return;
        }
        
        const rect = sprite.getBoundingClientRect();
        const battlefieldRect = battlefield.getBoundingClientRect();
        const x = rect.left + rect.width/2 - battlefieldRect.left;
        const y = rect.top + rect.height/2 - battlefieldRect.top;
        
        // Get element color
        const elementColor = this._getElementColor(element) || '#888888';
        const rarityConfig = {
            common: { circleSize: 60, particleCount: 8, duration: 500 },
            uncommon: { circleSize: 75, particleCount: 12, duration: 600 },
            rare: { circleSize: 90, particleCount: 18, duration: 700 },
            ultimate: { circleSize: 110, particleCount: 25, duration: 850 }
        };
        const config = rarityConfig[rarity] || rarityConfig.common;
        
        // Create summon effects container
        const effectsContainer = document.createElement('div');
        effectsContainer.className = 'summon-effects-container';
        effectsContainer.style.cssText = `
            position: absolute;
            left: ${x}px;
            top: ${y}px;
            transform: translate(-50%, -50%);
            pointer-events: none;
            z-index: 500;
        `;
        battlefield.appendChild(effectsContainer);
        
        // Phase 1: Summoning circle appears with runes
        const circle = document.createElement('div');
        circle.className = 'summon-circle';
        circle.style.cssText = `
            width: ${config.circleSize}px;
            height: ${config.circleSize}px;
            --element-color: ${elementColor};
        `;
        effectsContainer.appendChild(circle);
        
        // Add inner rotating ring
        const innerRing = document.createElement('div');
        innerRing.className = 'summon-inner-ring';
        innerRing.style.cssText = `
            width: ${config.circleSize * 0.7}px;
            height: ${config.circleSize * 0.7}px;
            --element-color: ${elementColor};
        `;
        effectsContainer.appendChild(innerRing);
        
        // Phase 2: Particles converge inward
        setTimeout(() => {
            this._createConvergingParticles(effectsContainer, elementColor, config.particleCount);
        }, 80);
        
        // Phase 3: Energy pillar rises (layered effect)
        setTimeout(() => {
            this._createEnergyPillar(effectsContainer, elementColor, config.circleSize);
        }, 200);
        
        // Phase 4: Sprite materializes with flash
        sprite.classList.add('summon-materialize');
        sprite.style.setProperty('--element-color', elementColor);
        
        // Ground impact at materialization
        setTimeout(() => {
            this.lightImpact();
            this._createGroundImpact(effectsContainer, elementColor);
            
            // Dispersing energy motes
            this._createSummonMotes(effectsContainer, elementColor, 12);
        }, 320);
        
        // Cleanup with fade
        setTimeout(() => {
            effectsContainer.style.transition = 'opacity 0.2s ease-out';
            effectsContainer.style.opacity = '0';
        }, config.duration - 200);
        
        setTimeout(() => {
            sprite.classList.remove('summon-materialize');
            sprite.style.removeProperty('--element-color');
            effectsContainer.remove();
            if (onComplete) onComplete();
        }, config.duration);
    },
    
    /**
     * Create layered energy pillar effect
     */
    _createEnergyPillar(container, color, baseSize) {
        // Outer glow pillar
        const outerPillar = document.createElement('div');
        outerPillar.className = 'summon-pillar-outer';
        outerPillar.style.setProperty('--element-color', color);
        container.appendChild(outerPillar);
        
        // Core bright pillar
        const corePillar = document.createElement('div');
        corePillar.className = 'summon-pillar-core';
        corePillar.style.setProperty('--element-color', color);
        container.appendChild(corePillar);
        
        // Rising energy particles within pillar
        for (let i = 0; i < 8; i++) {
            const particle = document.createElement('div');
            particle.className = 'summon-pillar-particle';
            particle.style.cssText = `
                --element-color: ${color};
                --offset-x: ${(Math.random() - 0.5) * 30}px;
                --delay: ${i * 30}ms;
            `;
            container.appendChild(particle);
        }
    },
    
    /**
     * Create particles that converge toward center
     */
    _createConvergingParticles(container, color, count) {
        for (let i = 0; i < count; i++) {
            const particle = document.createElement('div');
            particle.className = 'summon-particle-converge';
            
            const angle = (Math.PI * 2 / count) * i;
            const distance = 50 + Math.random() * 35;
            const startX = Math.cos(angle) * distance;
            const startY = Math.sin(angle) * distance;
            
            particle.style.cssText = `
                --start-x: ${startX}px;
                --start-y: ${startY}px;
                --particle-color: ${color};
                animation-delay: ${i * 15}ms;
            `;
            
            container.appendChild(particle);
        }
    },
    
    /**
     * Create ground impact ripple effect
     */
    _createGroundImpact(container, color) {
        for (let i = 0; i < 2; i++) {
            const ring = document.createElement('div');
            ring.className = 'summon-ground-ring';
            ring.style.cssText = `
                --element-color: ${color};
                animation-delay: ${i * 60}ms;
            `;
            container.appendChild(ring);
        }
    },
    
    /**
     * Create dispersing energy motes after summon
     */
    _createSummonMotes(container, color, count) {
        for (let i = 0; i < count; i++) {
            const mote = document.createElement('div');
            mote.className = 'summon-mote';
            
            const angle = (Math.PI * 2 / count) * i;
            const distance = 40 + Math.random() * 30;
            
            mote.style.cssText = `
                --end-x: ${Math.cos(angle) * distance}px;
                --end-y: ${Math.sin(angle) * distance - 20}px;
                --particle-color: ${color};
                animation-delay: ${Math.random() * 50}ms;
            `;
            container.appendChild(mote);
        }
    },
    
    // ==================== CARD FLIGHT ANIMATION ====================
    // Features: Arc path, rotation, particle trail, burst on arrival
    
    /**
     * Play card flight animation from hand to battlefield
     * @param {HTMLElement} cardElement - The card element in hand
     * @param {number} targetX - Target X position (battlefield-relative)
     * @param {number} targetY - Target Y position (battlefield-relative)
     * @param {string} element - Element type for particles
     * @param {Function} onArrive - Callback when card arrives at destination
     */
    playCardFlight(cardElement, targetX, targetY, element = 'steel', onArrive) {
        if (!cardElement) {
            if (onArrive) onArrive();
            return;
        }
        
        const battlefield = document.getElementById('battlefield-area');
        if (!battlefield) {
            if (onArrive) onArrive();
            return;
        }
        
        // Get starting position
        const cardRect = cardElement.getBoundingClientRect();
        const battlefieldRect = battlefield.getBoundingClientRect();
        const startX = cardRect.left + cardRect.width/2 - battlefieldRect.left;
        const startY = cardRect.top + cardRect.height/2 - battlefieldRect.top;
        
        // Create flying card ghost
        const flyingCard = document.createElement('div');
        flyingCard.className = 'card-flight';
        flyingCard.innerHTML = cardElement.innerHTML;
        flyingCard.style.cssText = `
            position: absolute;
            left: ${startX}px;
            top: ${startY}px;
            width: ${cardRect.width}px;
            height: ${cardRect.height}px;
            transform: translate(-50%, -50%);
            pointer-events: none;
            z-index: 1000;
        `;
        battlefield.appendChild(flyingCard);
        
        // Calculate arc control point (higher in the middle for nice curve)
        const midX = (startX + targetX) / 2;
        const midY = Math.min(startY, targetY) - 100;
        
        // Get element color
        const elementColor = this._getElementColor(element) || '#888888';
        
        // Animate along bezier curve using CSS custom properties
        flyingCard.style.setProperty('--start-x', `${startX}px`);
        flyingCard.style.setProperty('--start-y', `${startY}px`);
        flyingCard.style.setProperty('--mid-x', `${midX}px`);
        flyingCard.style.setProperty('--mid-y', `${midY}px`);
        flyingCard.style.setProperty('--end-x', `${targetX}px`);
        flyingCard.style.setProperty('--end-y', `${targetY}px`);
        flyingCard.style.setProperty('--element-color', elementColor);
        
        // Hide original card
        cardElement.style.opacity = '0';
        
        // Start flight animation
        requestAnimationFrame(() => {
            flyingCard.classList.add('card-flying');
            
            // Create particle trail during flight
            const trailInterval = setInterval(() => {
                const currentStyle = getComputedStyle(flyingCard);
                const currentX = parseFloat(flyingCard.style.left);
                const currentY = parseFloat(flyingCard.style.top);
                this._createFlightTrailParticle(battlefield, currentX, currentY, elementColor);
            }, 40);
            
            // On arrival
            setTimeout(() => {
                clearInterval(trailInterval);
                
                // Burst effect at destination
                this._createCardBurst(battlefield, targetX, targetY, elementColor);
                this.lightImpact();
                
                flyingCard.remove();
                if (onArrive) onArrive();
            }, 400);
        });
    },
    
    /**
     * Create trail particle during card flight
     */
    _createFlightTrailParticle(container, x, y, color) {
        const particle = document.createElement('div');
        particle.className = 'card-trail-particle';
        particle.style.cssText = `
            position: absolute;
            left: ${x}px;
            top: ${y}px;
            --particle-color: ${color};
        `;
        container.appendChild(particle);
        setTimeout(() => particle.remove(), 300);
    },
    
    /**
     * Create burst effect when card arrives
     */
    _createCardBurst(container, x, y, color) {
        // Create multiple burst particles
        for (let i = 0; i < 12; i++) {
            const particle = document.createElement('div');
            particle.className = 'card-burst-particle';
            
            const angle = (Math.PI * 2 / 12) * i;
            const distance = 30 + Math.random() * 30;
            const tx = Math.cos(angle) * distance;
            const ty = Math.sin(angle) * distance - 15;
            
            particle.style.cssText = `
                position: absolute;
                left: ${x}px;
                top: ${y}px;
                --tx: ${tx}px;
                --ty: ${ty}px;
                --particle-color: ${color};
                animation-delay: ${Math.random() * 50}ms;
            `;
            container.appendChild(particle);
            setTimeout(() => particle.remove(), 500);
        }
        
        // Central flash
        const flash = document.createElement('div');
        flash.className = 'card-arrival-flash';
        flash.style.cssText = `
            position: absolute;
            left: ${x}px;
            top: ${y}px;
            --element-color: ${color};
        `;
        container.appendChild(flash);
        setTimeout(() => flash.remove(), 300);
    },
    
    // ==================== ENHANCED EVOLUTION ANIMATION ====================
    // Features: Distant particles converging, smooth sprite transition, energy cocoon
    
    /**
     * Play enhanced evolution animation
     * @param {HTMLElement} sprite - The evolving cryptid's sprite element
     * @param {string} element - Element type
     * @param {string} newRarity - New rarity after evolution
     * @param {Function} onComplete - Callback when animation completes
     */
    playEvolutionAnimation(sprite, element = 'steel', newRarity = 'common', onComplete) {
        if (!sprite) {
            if (onComplete) onComplete();
            return;
        }
        
        const battlefield = document.getElementById('battlefield-area');
        const gameContainer = document.getElementById('game-container');
        if (!battlefield || !gameContainer) {
            if (onComplete) onComplete();
            return;
        }
        
        const rect = sprite.getBoundingClientRect();
        const battlefieldRect = battlefield.getBoundingClientRect();
        const gameRect = gameContainer.getBoundingClientRect();
        const x = rect.left + rect.width/2 - battlefieldRect.left;
        const y = rect.top + rect.height/2 - battlefieldRect.top;
        
        // Screen-relative position for distant particles
        const screenX = rect.left + rect.width/2 - gameRect.left;
        const screenY = rect.top + rect.height/2 - gameRect.top;
        
        const elementColor = this._getElementColor(element) || '#9b59b6';
        
        // Create screen-level container for distant particles
        const screenEffects = document.createElement('div');
        screenEffects.className = 'evolution-screen-effects';
        screenEffects.style.cssText = `
            position: absolute;
            inset: 0;
            pointer-events: none;
            z-index: 700;
            overflow: hidden;
        `;
        gameContainer.appendChild(screenEffects);
        
        // Create battlefield-level container for local effects
        const localEffects = document.createElement('div');
        localEffects.className = 'evolution-local-effects';
        localEffects.style.cssText = `
            position: absolute;
            left: ${x}px;
            top: ${y}px;
            transform: translate(-50%, -50%);
            pointer-events: none;
            z-index: 600;
        `;
        battlefield.appendChild(localEffects);
        
        // Phase 1: Distant particles fly in from screen edges
        sprite.classList.add('evolution-gathering-phase');
        this._createDistantEvolutionParticles(screenEffects, screenX, screenY, elementColor);
        
        // Add ambient glow around sprite
        const ambientGlow = document.createElement('div');
        ambientGlow.className = 'evolution-ambient-glow';
        ambientGlow.style.setProperty('--element-color', elementColor);
        localEffects.appendChild(ambientGlow);
        
        setTimeout(() => {
            // Phase 2: Energy cocoon forms around sprite
            sprite.classList.remove('evolution-gathering-phase');
            sprite.classList.add('evolution-cocoon-phase');
            
            // Create swirling energy cocoon
            const cocoon = document.createElement('div');
            cocoon.className = 'evolution-energy-cocoon';
            cocoon.style.setProperty('--element-color', elementColor);
            localEffects.appendChild(cocoon);
            
            // Inner glow intensifies
            const innerGlow = document.createElement('div');
            innerGlow.className = 'evolution-inner-glow';
            innerGlow.style.setProperty('--element-color', elementColor);
            localEffects.appendChild(innerGlow);
            
            this.screenShake(0.5, 150);
        }, 450);
        
        setTimeout(() => {
            // Phase 3: Bright flash - sprite becomes hidden
            sprite.classList.remove('evolution-cocoon-phase');
            sprite.classList.add('evolution-flash-phase');
            
            // Blinding flash
            const flash = document.createElement('div');
            flash.className = 'evolution-bright-flash';
            flash.style.setProperty('--element-color', elementColor);
            localEffects.appendChild(flash);
            
            this.screenShake(1.0, 250);
        }, 750);
        
        setTimeout(() => {
            // Phase 4: Reveal new form with energy burst
            sprite.classList.remove('evolution-flash-phase');
            sprite.classList.add('evolution-reveal-phase');
            
            // Expanding energy rings
            this._createEvolutionRings(localEffects, elementColor);
            
            // Burst particles outward
            this.createImpactParticles(x, y, elementColor, 16);
            this.createSparks(x, y, 20);
            
            this.screenShake(0.8, 200);
        }, 950);
        
        setTimeout(() => {
            // Phase 5: Settling with power aura
            sprite.classList.remove('evolution-reveal-phase');
            sprite.classList.add('evolution-settle-phase');
            
            // Stat badges pop
            const statBadges = sprite.querySelectorAll('.stat-badge');
            statBadges.forEach((badge, i) => {
                setTimeout(() => {
                    badge.classList.add('stat-pop');
                    setTimeout(() => badge.classList.remove('stat-pop'), 400);
                }, i * 80);
            });
        }, 1150);
        
        // Cleanup with fade
        setTimeout(() => {
            localEffects.style.transition = 'opacity 0.3s ease-out';
            localEffects.style.opacity = '0';
            screenEffects.style.transition = 'opacity 0.3s ease-out';
            screenEffects.style.opacity = '0';
        }, 1350);
        
        setTimeout(() => {
            sprite.classList.remove('evolution-settle-phase');
            localEffects.remove();
            screenEffects.remove();
            if (onComplete) onComplete();
        }, 1650);
    },
    
    /**
     * Create distant particles that fly in from screen edges
     */
    _createDistantEvolutionParticles(container, targetX, targetY, color) {
        const particleCount = 20;
        const containerRect = container.getBoundingClientRect();
        
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'evolution-distant-particle';
            
            // Random starting position from screen edges
            const edge = Math.floor(Math.random() * 4);
            let startX, startY;
            
            switch(edge) {
                case 0: // Top
                    startX = Math.random() * containerRect.width;
                    startY = -20;
                    break;
                case 1: // Right
                    startX = containerRect.width + 20;
                    startY = Math.random() * containerRect.height;
                    break;
                case 2: // Bottom
                    startX = Math.random() * containerRect.width;
                    startY = containerRect.height + 20;
                    break;
                default: // Left
                    startX = -20;
                    startY = Math.random() * containerRect.height;
            }
            
            particle.style.cssText = `
                left: ${startX}px;
                top: ${startY}px;
                --target-x: ${targetX - startX}px;
                --target-y: ${targetY - startY}px;
                --particle-color: ${color};
                --delay: ${i * 20}ms;
                --duration: ${300 + Math.random() * 200}ms;
            `;
            
            container.appendChild(particle);
            
            // Remove after animation
            setTimeout(() => particle.remove(), 600);
        }
    },
    
    /**
     * Create expanding energy rings for evolution reveal
     */
    _createEvolutionRings(container, color) {
        for (let i = 0; i < 3; i++) {
            const ring = document.createElement('div');
            ring.className = 'evolution-energy-ring';
            ring.style.cssText = `
                --element-color: ${color};
                --delay: ${i * 100}ms;
            `;
            container.appendChild(ring);
        }
    },
    
    // ==================== SPELL PROJECTILE ANIMATION ====================
    // Features: Projectile travel, element trails, impact burst
    
    /**
     * Play spell projectile animation
     * @param {number} startX - Starting X position
     * @param {number} startY - Starting Y position  
     * @param {number} targetX - Target X position
     * @param {number} targetY - Target Y position
     * @param {string} element - Element type for visuals
     * @param {string} spellType - 'burst', 'trap', 'aura' (affects visual style)
     * @param {Function} onImpact - Callback when projectile hits target
     */
    playSpellProjectile(startX, startY, targetX, targetY, element = 'void', spellType = 'burst', onImpact) {
        const battlefield = document.getElementById('battlefield-area');
        if (!battlefield) {
            if (onImpact) onImpact();
            return;
        }
        
        const elementColor = this._getElementColor(element) || '#9b59b6';
        
        // Create projectile
        const projectile = document.createElement('div');
        projectile.className = `spell-projectile spell-${spellType}`;
        projectile.style.cssText = `
            position: absolute;
            left: ${startX}px;
            top: ${startY}px;
            --element-color: ${elementColor};
            --target-x: ${targetX - startX}px;
            --target-y: ${targetY - startY}px;
        `;
        battlefield.appendChild(projectile);
        
        // Create trail particles during flight
        const trailInterval = setInterval(() => {
            const rect = projectile.getBoundingClientRect();
            const battlefieldRect = battlefield.getBoundingClientRect();
            const currentX = rect.left + rect.width/2 - battlefieldRect.left;
            const currentY = rect.top + rect.height/2 - battlefieldRect.top;
            
            const trail = document.createElement('div');
            trail.className = 'spell-trail-particle';
            trail.style.cssText = `
                position: absolute;
                left: ${currentX}px;
                top: ${currentY}px;
                --element-color: ${elementColor};
            `;
            battlefield.appendChild(trail);
            setTimeout(() => trail.remove(), 200);
        }, 30);
        
        // Animate projectile
        requestAnimationFrame(() => {
            projectile.classList.add('spell-flying');
        });
        
        // On impact
        setTimeout(() => {
            clearInterval(trailInterval);
            projectile.remove();
            
            // Impact effects
            this.createImpactFlash(targetX, targetY, 70);
            this._createSpellImpact(battlefield, targetX, targetY, elementColor, spellType);
            this.lightImpact();
            
            if (onImpact) onImpact();
        }, 300);
    },
    
    /**
     * Create spell impact effect
     */
    _createSpellImpact(container, x, y, color, spellType) {
        // Expanding ring
        const ring = document.createElement('div');
        ring.className = 'spell-impact-ring';
        ring.style.cssText = `
            position: absolute;
            left: ${x}px;
            top: ${y}px;
            --element-color: ${color};
        `;
        container.appendChild(ring);
        setTimeout(() => ring.remove(), 400);
        
        // Particles
        this.createImpactParticles(x, y, color, 10);
    },
    
    // ==================== TURN TRANSITION ANIMATION ====================
    // Features: Banner sweep, battlefield pulse, ready stance
    
    /**
     * Play turn transition animation
     * @param {string} newTurn - 'player' or 'enemy'
     * @param {Function} onComplete - Callback when animation completes
     */
    playTurnTransition(newTurn, onComplete) {
        const gameContainer = document.getElementById('game-container');
        const battlefield = document.getElementById('battlefield-area');
        
        if (!gameContainer || !battlefield) {
            if (onComplete) onComplete();
            return;
        }
        
        const isPlayerTurn = newTurn === 'player';
        const bannerColor = isPlayerTurn ? '#4ade80' : '#f87171';
        const bannerText = isPlayerTurn ? 'YOUR TURN' : 'ENEMY TURN';
        
        // Create banner
        const banner = document.createElement('div');
        banner.className = 'turn-banner';
        banner.innerHTML = `<span class="turn-banner-text">${bannerText}</span>`;
        banner.style.setProperty('--banner-color', bannerColor);
        gameContainer.appendChild(banner);
        
        // Animate banner sweep
        requestAnimationFrame(() => {
            banner.classList.add('turn-banner-active');
        });
        
        // Battlefield pulse wave
        setTimeout(() => {
            const pulse = document.createElement('div');
            pulse.className = `turn-pulse ${isPlayerTurn ? 'turn-pulse-player' : 'turn-pulse-enemy'}`;
            battlefield.appendChild(pulse);
            setTimeout(() => pulse.remove(), 600);
        }, 200);
        
        // Ready stance bounce for active player's cryptids
        setTimeout(() => {
            const ownerClass = isPlayerTurn ? 'player' : 'enemy';
            const sprites = document.querySelectorAll(`.cryptid-sprite[data-owner="${ownerClass}"]`);
            sprites.forEach((sprite, i) => {
                setTimeout(() => {
                    sprite.classList.add('ready-stance');
                    setTimeout(() => sprite.classList.remove('ready-stance'), 300);
                }, i * 80);
            });
        }, 350);
        
        // Cleanup
        setTimeout(() => {
            banner.classList.add('turn-banner-exit');
            setTimeout(() => {
                banner.remove();
                if (onComplete) onComplete();
            }, 300);
        }, 800);
    },
    
    // ==================== ENHANCED PROMOTION ANIMATION ====================
    // Features: Dust kick, determined stride, landing thump
    
    /**
     * Play enhanced promotion animation
     * @param {HTMLElement} sprite - The promoting cryptid's sprite element
     * @param {string} owner - 'player' or 'enemy'
     * @param {number} distance - Distance to move (in pixels)
     * @param {Function} onComplete - Callback when animation completes
     */
    playPromotionAnimation(sprite, owner, distance, onComplete) {
        if (!sprite) {
            if (onComplete) onComplete();
            return;
        }
        
        const battlefield = document.getElementById('battlefield-area');
        if (!battlefield) {
            if (onComplete) onComplete();
            return;
        }
        
        const rect = sprite.getBoundingClientRect();
        const battlefieldRect = battlefield.getBoundingClientRect();
        const startX = rect.left + rect.width/2 - battlefieldRect.left;
        const startY = rect.top + rect.height/2 - battlefieldRect.top;
        
        // Phase 1: Anticipation + dust kick at start
        sprite.classList.add('promotion-anticipation');
        this._createDustCloud(battlefield, startX, startY + 20, 6);
        
        setTimeout(() => {
            // Phase 2: Determined stride forward
            sprite.classList.remove('promotion-anticipation');
            sprite.classList.add('promotion-stride');
            sprite.style.setProperty('--promote-distance', `${distance}px`);
        }, 150);
        
        setTimeout(() => {
            // Phase 3: Landing impact
            sprite.classList.remove('promotion-stride');
            sprite.classList.add('promotion-land');
            
            const direction = owner === 'player' ? 1 : -1;
            const landX = startX + (distance * direction);
            
            this._createDustCloud(battlefield, landX, startY + 20, 8);
            this.lightImpact();
        }, 400);
        
        setTimeout(() => {
            // Phase 4: Power-up glow
            sprite.classList.remove('promotion-land');
            sprite.classList.add('promotion-powerup');
        }, 500);
        
        // Cleanup
        setTimeout(() => {
            sprite.classList.remove('promotion-powerup');
            sprite.style.removeProperty('--promote-distance');
            if (onComplete) onComplete();
        }, 700);
    },
    
    /**
     * Create dust cloud particles
     */
    _createDustCloud(container, x, y, count) {
        for (let i = 0; i < count; i++) {
            const dust = document.createElement('div');
            dust.className = 'dust-particle';
            
            const offsetX = (Math.random() - 0.5) * 40;
            const offsetY = Math.random() * -20;
            
            dust.style.cssText = `
                position: absolute;
                left: ${x + offsetX}px;
                top: ${y}px;
                --offset-y: ${offsetY}px;
                animation-delay: ${Math.random() * 50}ms;
            `;
            container.appendChild(dust);
            setTimeout(() => dust.remove(), 500);
        }
    },
    
    // ==================== ENHANCED TRAP TRIGGER ANIMATION ====================
    // Features: Spring mechanic, chain whip, victim freeze
    
    /**
     * Play enhanced trap trigger animation
     * @param {HTMLElement} trapSprite - The trap sprite element
     * @param {HTMLElement} victimSprite - The victim cryptid sprite
     * @param {string} trapElement - Element type of trap
     * @param {Function} onTrigger - Callback at moment of trigger
     * @param {Function} onComplete - Callback when animation completes
     */
    playTrapTrigger(trapSprite, victimSprite, trapElement = 'void', onTrigger, onComplete) {
        const battlefield = document.getElementById('battlefield-area');
        if (!battlefield) {
            if (onTrigger) onTrigger();
            if (onComplete) onComplete();
            return;
        }
        
        const elementColor = this._getElementColor(trapElement) || '#9b59b6';
        
        let trapX = 0, trapY = 0;
        if (trapSprite) {
            const rect = trapSprite.getBoundingClientRect();
            const battlefieldRect = battlefield.getBoundingClientRect();
            trapX = rect.left + rect.width/2 - battlefieldRect.left;
            trapY = rect.top + rect.height/2 - battlefieldRect.top;
        }
        
        // Phase 1: Trap spring (compress then violently release)
        if (trapSprite) {
            trapSprite.classList.add('trap-spring-compress');
        }
        
        // Victim freeze (sees trap about to trigger)
        if (victimSprite) {
            victimSprite.classList.add('trap-victim-freeze');
        }
        
        setTimeout(() => {
            // Phase 2: Trap releases
            if (trapSprite) {
                trapSprite.classList.remove('trap-spring-compress');
                trapSprite.classList.add('trap-spring-release');
            }
            
            // Chain/energy whip effect toward victim
            if (victimSprite && trapSprite) {
                this._createTrapChain(battlefield, trapX, trapY, victimSprite, elementColor);
            }
            
            this.screenShake(0.8, 200);
        }, 200);
        
        setTimeout(() => {
            // Phase 3: Effect hits victim
            if (onTrigger) onTrigger();
            
            if (victimSprite) {
                victimSprite.classList.remove('trap-victim-freeze');
                victimSprite.classList.add('trap-victim-hit');
                
                const victimRect = victimSprite.getBoundingClientRect();
                const battlefieldRect = battlefield.getBoundingClientRect();
                const victimX = victimRect.left + victimRect.width/2 - battlefieldRect.left;
                const victimY = victimRect.top + victimRect.height/2 - battlefieldRect.top;
                
                this.createImpactParticles(victimX, victimY, elementColor, 12);
                this.createImpactFlash(victimX, victimY, 80);
            }
            
            // Trap sprite bursts
            if (trapSprite) {
                trapSprite.classList.remove('trap-spring-release');
                trapSprite.classList.add('trap-burst');
                this.createSparks(trapX, trapY, 15);
            }
        }, 350);
        
        // Cleanup
        setTimeout(() => {
            if (victimSprite) {
                victimSprite.classList.remove('trap-victim-hit');
            }
            if (onComplete) onComplete();
        }, 700);
    },
    
    /**
     * Create chain/energy whip effect from trap to victim
     */
    _createTrapChain(container, startX, startY, victimSprite, color) {
        const victimRect = victimSprite.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const endX = victimRect.left + victimRect.width/2 - containerRect.left;
        const endY = victimRect.top + victimRect.height/2 - containerRect.top;
        
        const chain = document.createElement('div');
        chain.className = 'trap-chain';
        
        const angle = Math.atan2(endY - startY, endX - startX);
        const length = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
        
        chain.style.cssText = `
            position: absolute;
            left: ${startX}px;
            top: ${startY}px;
            width: ${length}px;
            transform: rotate(${angle}rad);
            transform-origin: left center;
            --element-color: ${color};
        `;
        container.appendChild(chain);
        setTimeout(() => chain.remove(), 300);
    },
    
    // ==================== PYRE BURN ANIMATION ====================
    // Features: Ember icon souls, machine-gun effect for multi-pyre, flame absorption
    
    /**
     * Play enhanced pyre burn animation with machine-gun effect for multiple pyres
     * @param {HTMLElement} cardElement - The card being burned
     * @param {number} pyreGain - Amount of pyre gained
     * @param {Function} onComplete - Callback when animation completes
     */
    playPyreBurn(cardElement, pyreGain = 1, onComplete) {
        const gameContainer = document.getElementById('game-container');
        const pyreCounter = document.querySelector('.pyre-display');
        
        if (!gameContainer) {
            if (onComplete) onComplete();
            return;
        }
        
        // Ensure at least 1 pyre
        pyreGain = Math.max(1, pyreGain);
        
        // Get positions
        let startX = window.innerWidth / 2;
        let startY = window.innerHeight - 150;
        
        if (cardElement) {
            const cardRect = cardElement.getBoundingClientRect();
            startX = cardRect.left + cardRect.width/2;
            startY = cardRect.top + cardRect.height/2;
        }
        
        let endX = window.innerWidth / 2;
        let endY = 30;
        
        if (pyreCounter) {
            const counterRect = pyreCounter.getBoundingClientRect();
            endX = counterRect.left + counterRect.width/2;
            endY = counterRect.top + counterRect.height/2;
        }
        
        // Create effects container
        const effectsContainer = document.createElement('div');
        effectsContainer.className = 'pyre-burn-effects';
        effectsContainer.style.cssText = `
            position: fixed;
            inset: 0;
            pointer-events: none;
            z-index: 9999;
        `;
        gameContainer.appendChild(effectsContainer);
        
        // Phase 1: Card desaturates and embers rise
        if (cardElement) {
            cardElement.classList.add('pyre-burning');
        }
        
        // Create rising ambient embers around the card
        for (let i = 0; i < 8; i++) {
            const ember = document.createElement('div');
            ember.className = 'pyre-ember';
            ember.style.cssText = `
                left: ${startX + (Math.random() - 0.5) * 60}px;
                top: ${startY}px;
                animation-delay: ${i * 40}ms;
            `;
            effectsContainer.appendChild(ember);
        }
        
        // Phase 2: Machine-gun ember souls - rapid fire based on pyre gain
        const emberDelay = Math.max(40, 100 - (pyreGain * 8)); // Faster spacing with more pyres
        const flightDuration = 280;
        
        for (let i = 0; i < pyreGain; i++) {
            setTimeout(() => {
                this._createFlyingEmber(effectsContainer, startX, startY, endX, endY, i, pyreGain);
            }, 150 + (i * emberDelay));
        }
        
        // Phase 3: Final impact on pyre counter after all embers arrive
        const totalFlightTime = 150 + ((pyreGain - 1) * emberDelay) + flightDuration + 50;
        
        setTimeout(() => {
            if (pyreCounter) {
                // Big final pulse for finishing
                pyreCounter.classList.add('pyre-absorb-final');
                
                // Flame flare burst
                const flare = document.createElement('div');
                flare.className = 'pyre-flare-burst';
                const intensity = Math.min(2, 0.8 + pyreGain * 0.15);
                flare.style.cssText = `
                    position: absolute;
                    left: ${endX}px;
                    top: ${endY}px;
                    --intensity: ${intensity};
                `;
                effectsContainer.appendChild(flare);
                
                setTimeout(() => {
                    pyreCounter.classList.remove('pyre-absorb-final');
                }, 400);
            }
            
            this.lightImpact();
        }, totalFlightTime);
        
        // Cleanup
        const cleanupTime = totalFlightTime + 400;
        setTimeout(() => {
            if (cardElement) {
                cardElement.classList.remove('pyre-burning');
            }
            effectsContainer.remove();
            if (onComplete) onComplete();
        }, cleanupTime);
    },
    
    /**
     * Create a single flying ember for pyre gain (uses ember icon)
     */
    _createFlyingEmber(container, startX, startY, endX, endY, index, total) {
        const pyreCounter = document.querySelector('.pyre-display');
        
        // Add slight randomization to start position for spread effect
        const offsetX = (Math.random() - 0.5) * 40;
        const offsetY = (Math.random() - 0.5) * 25;
        
        // Create ember soul with actual icon image
        const soul = document.createElement('div');
        soul.className = 'pyre-soul-ember';
        soul.innerHTML = `<img src="sprites/embers icon.png" alt="" class="ember-icon">`;
        soul.style.cssText = `
            position: absolute;
            left: ${startX + offsetX}px;
            top: ${startY + offsetY}px;
            --end-x: ${endX}px;
            --end-y: ${endY}px;
            --arc-height: ${-30 - Math.random() * 40}px;
        `;
        container.appendChild(soul);
        
        // Start flying immediately
        requestAnimationFrame(() => {
            soul.classList.add('pyre-soul-flying');
        });
        
        // Individual hit effect when this ember arrives
        setTimeout(() => {
            if (pyreCounter) {
                // Quick pulse on each hit
                pyreCounter.classList.add('pyre-absorb-hit');
                setTimeout(() => pyreCounter.classList.remove('pyre-absorb-hit'), 80);
            }
            
            // Small spark burst at impact
            this._createPyreImpactSparks(container, endX, endY);
            
            // Remove this soul
            soul.remove();
        }, 280);
    },
    
    /**
     * Create small spark burst when ember hits pyre counter
     */
    _createPyreImpactSparks(container, x, y) {
        for (let i = 0; i < 5; i++) {
            const spark = document.createElement('div');
            spark.className = 'pyre-impact-spark';
            const angle = (Math.PI * 2 / 5) * i + Math.random() * 0.5;
            const distance = 12 + Math.random() * 12;
            
            spark.style.cssText = `
                position: absolute;
                left: ${x}px;
                top: ${y}px;
                --tx: ${Math.cos(angle) * distance}px;
                --ty: ${Math.sin(angle) * distance}px;
            `;
            container.appendChild(spark);
            setTimeout(() => spark.remove(), 200);
        }
    },
    
    // ==================== LEGACY SUPPORT ====================
    
    playAttackSequence(attackerSprite, targetSprite, damage, onComplete) {
        // Redirect to enhanced version
        const owner = attackerSprite?.classList.contains('enemy') ? 'enemy' : 'player';
        this.playEnhancedAttack(attackerSprite, owner, targetSprite, damage, null, onComplete);
    },
    
    // ==================== STAT BAR ANIMATIONS ====================
    
    animateHPChange(cryptid, oldHP, newHP) {
        const sprite = document.querySelector(`.cryptid-sprite[data-owner="${cryptid.owner}"][data-col="${cryptid.col}"][data-row="${cryptid.row}"]`);
        if (!sprite) return;
        
        const hpArc = sprite.querySelector('.hp-arc');
        const hpValue = sprite.querySelector('.hp-badge .stat-value');
        if (!hpValue) return;
        
        // Calculate max HP including support if this is a combatant
        let maxHP = cryptid.maxHp || cryptid.hp;
        let displayHP = newHP;
        let displayOldHP = oldHP;
        
        if (window.game) {
            const combatCol = game.getCombatCol(cryptid.owner);
            const supportCol = game.getSupportCol(cryptid.owner);
            
            if (cryptid.col === combatCol) {
                const support = game.getFieldCryptid(cryptid.owner, supportCol, cryptid.row);
                if (support) {
                    maxHP += support.maxHp || support.hp;
                    displayHP += support.currentHp;
                    displayOldHP += support.currentHp;
                }
            }
        }
        
        const percent = Math.max(0, (displayHP / maxHP) * 100);
        
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
        const diff = displayHP - displayOldHP;
        if (diff < 0) {
            hpValue.classList.add('decreased');
            setTimeout(() => hpValue.classList.remove('decreased'), 400);
        } else if (diff > 0) {
            hpValue.classList.add('increased');
            setTimeout(() => hpValue.classList.remove('increased'), 400);
        }
        
        hpValue.textContent = displayHP;
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
        
        /* ==================== LIGHTNING STRIKE ==================== */
        .lightning-container {
            position: absolute;
            z-index: 2000;
            pointer-events: none;
        }
        
        .lightning-svg {
            animation: lightningFlicker 0.5s ease-out forwards;
        }
        
        .lightning-core-path {
            animation: coreFlash 0.5s ease-out forwards;
        }
        
        .lightning-glow-path {
            animation: glowFlash 0.5s ease-out forwards;
        }
        
        .lightning-outer-path {
            animation: outerFlash 0.5s ease-out forwards;
        }
        
        .lightning-branch-path {
            animation: branchFlash 0.4s ease-out forwards;
        }
        
        @keyframes lightningFlicker {
            0% { opacity: 0; }
            5% { opacity: 1; }
            8% { opacity: 0.3; }
            12% { opacity: 1; }
            20% { opacity: 0.5; }
            25% { opacity: 1; }
            40% { opacity: 0.8; }
            60% { opacity: 0.6; }
            100% { opacity: 0; }
        }
        
        @keyframes coreFlash {
            0% { stroke-width: 2; opacity: 1; }
            10% { stroke-width: 3; }
            20% { stroke-width: 2; }
            30% { stroke-width: 4; }
            40% { stroke-width: 2; }
            100% { stroke-width: 2; opacity: 1; }
        }
        
        @keyframes glowFlash {
            0% { stroke-width: 8; }
            15% { stroke-width: 12; }
            30% { stroke-width: 6; }
            45% { stroke-width: 10; }
            100% { stroke-width: 8; }
        }
        
        @keyframes outerFlash {
            0% { stroke-width: 16; opacity: 0.5; }
            20% { stroke-width: 24; opacity: 0.7; }
            40% { stroke-width: 12; opacity: 0.4; }
            100% { stroke-width: 16; opacity: 0.5; }
        }
        
        @keyframes branchFlash {
            0% { opacity: 0; }
            15% { opacity: 0.8; }
            30% { opacity: 0.3; }
            45% { opacity: 0.7; }
            100% { opacity: 0; }
        }
        
        .lightning-sky-flash {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: radial-gradient(ellipse at 50% 20%, 
                rgba(200, 220, 255, 0.6) 0%, 
                rgba(150, 180, 255, 0.3) 30%,
                transparent 70%);
            pointer-events: none;
            z-index: 1999;
            animation: skyFlash 0.35s ease-out forwards;
        }
        
        .lightning-sky-flash.secondary {
            animation: skyFlashSecond 0.2s ease-out forwards;
            background: radial-gradient(ellipse at 50% 30%, 
                rgba(255, 255, 255, 0.5) 0%, 
                rgba(180, 200, 255, 0.25) 40%,
                transparent 70%);
        }
        
        .lightning-sky-flash.tertiary {
            animation: skyFlashSecond 0.15s ease-out forwards;
            background: radial-gradient(ellipse at 50% 40%, 
                rgba(180, 200, 255, 0.3) 0%, 
                transparent 60%);
        }
        
        @keyframes skyFlash {
            0% { opacity: 0; }
            10% { opacity: 1; }
            30% { opacity: 0.5; }
            50% { opacity: 0.8; }
            100% { opacity: 0; }
        }
        
        @keyframes skyFlashSecond {
            0% { opacity: 0; }
            20% { opacity: 1; }
            100% { opacity: 0; }
        }
        
        .lightning-impact {
            position: absolute;
            width: 250px;
            height: 250px;
            transform: translate(-50%, -50%);
            background: radial-gradient(circle, 
                rgba(255, 255, 255, 1) 0%, 
                rgba(180, 200, 255, 0.9) 15%, 
                rgba(100, 150, 255, 0.6) 35%, 
                rgba(80, 120, 255, 0.3) 55%,
                transparent 75%);
            border-radius: 50%;
            pointer-events: none;
            z-index: 2001;
            animation: lightningImpact 0.5s ease-out forwards;
        }
        
        @keyframes lightningImpact {
            0% { 
                transform: translate(-50%, -50%) scale(0.2);
                opacity: 1;
                filter: brightness(2);
            }
            20% {
                transform: translate(-50%, -50%) scale(1.2);
                opacity: 1;
                filter: brightness(1.5);
            }
            50% {
                transform: translate(-50%, -50%) scale(1.5);
                opacity: 0.8;
            }
            100% { 
                transform: translate(-50%, -50%) scale(2);
                opacity: 0;
            }
        }
        
        /* Dramatic Death Animations */
        @keyframes vignetteIn {
            0% { opacity: 0; }
            100% { opacity: 1; }
        }
        
        @keyframes dramaticDeathFlash {
            0% { opacity: 0; }
            20% { opacity: 1; }
            60% { opacity: 0.5; }
            100% { opacity: 0; }
        }
        
        @keyframes deathFlash {
            0% { opacity: 0; }
            15% { opacity: 1; }
            40% { opacity: 0.6; }
            100% { opacity: 0; }
        }
        
        @keyframes deathPulse {
            0% { 
                transform: translate(-50%, -50%) scale(1);
                filter: brightness(1);
            }
            50% { 
                transform: translate(-50%, -50%) scale(1.08);
                filter: brightness(1.3) drop-shadow(0 0 15px rgba(255,255,255,0.8));
            }
            100% { 
                transform: translate(-50%, -50%) scale(1);
                filter: brightness(1);
            }
        }
        
        /* Impact hit animation - knockback recoil for enemies (hit from left) */
        @keyframes deathImpactHitRight {
            0% { 
                transform: translate(-50%, -50%) scale(1) rotate(0deg);
                filter: brightness(1);
            }
            15% { 
                transform: translate(calc(-50% + 12px), calc(-50% - 4px)) scale(1.05) rotate(8deg);
                filter: brightness(2.5) saturate(0);
            }
            30% { 
                transform: translate(calc(-50% + 8px), calc(-50% - 2px)) scale(0.98) rotate(5deg);
                filter: brightness(1.8) saturate(0.3);
            }
            50% { 
                transform: translate(calc(-50% + 4px), -50%) scale(1.02) rotate(2deg);
                filter: brightness(1.4) saturate(0.6);
            }
            100% { 
                transform: translate(-50%, -50%) scale(1) rotate(0deg);
                filter: brightness(1.1);
            }
        }
        
        /* Impact hit animation - knockback recoil for player (hit from right) */
        @keyframes deathImpactHitLeft {
            0% { 
                transform: translate(-50%, -50%) scale(1) rotate(0deg);
                filter: brightness(1);
            }
            15% { 
                transform: translate(calc(-50% - 12px), calc(-50% - 4px)) scale(1.05) rotate(-8deg);
                filter: brightness(2.5) saturate(0);
            }
            30% { 
                transform: translate(calc(-50% - 8px), calc(-50% - 2px)) scale(0.98) rotate(-5deg);
                filter: brightness(1.8) saturate(0.3);
            }
            50% { 
                transform: translate(calc(-50% - 4px), -50%) scale(1.02) rotate(-2deg);
                filter: brightness(1.4) saturate(0.6);
            }
            100% { 
                transform: translate(-50%, -50%) scale(1) rotate(0deg);
                filter: brightness(1.1);
            }
        }
        
        @keyframes deathRayBurst {
            0% { 
                height: 0;
                opacity: 1;
            }
            30% {
                height: 300px;
                opacity: 1;
            }
            100% { 
                height: 500px;
                opacity: 0;
            }
        }
        
        /* Death drama sprite styling */
        .death-drama-sprite {
            will-change: transform, opacity;
        }
        
        /* ==================== ENHANCED ATTACK ANIMATIONS ==================== */
        
        /* Anticipation phase - squash and pull back */
        .cryptid-sprite.attack-anticipation {
            animation: attackAnticipation 140ms ease-out forwards !important;
        }
        
        @keyframes attackAnticipation {
            0% { 
                transform: translate(-50%, -50%) scale(1, 1);
            }
            60% { 
                transform: translate(calc(-50% - 8px * var(--attack-intensity, 1)), -50%) scale(0.85, 1.1);
            }
            100% { 
                transform: translate(calc(-50% - 12px * var(--attack-intensity, 1)), -50%) scale(0.8, 1.15);
            }
        }
        
        .cryptid-sprite.enemy.attack-anticipation {
            animation: attackAnticipationEnemy 140ms ease-out forwards !important;
        }
        
        @keyframes attackAnticipationEnemy {
            0% { 
                transform: translate(-50%, -50%) scale(1, 1);
            }
            60% { 
                transform: translate(calc(-50% + 8px * var(--attack-intensity, 1)), -50%) scale(0.85, 1.1);
            }
            100% { 
                transform: translate(calc(-50% + 12px * var(--attack-intensity, 1)), -50%) scale(0.8, 1.15);
            }
        }
        
        /* Lunge phase - stretch and charge forward */
        .cryptid-sprite.attack-lunge-enhanced {
            animation: attackLungeEnhanced 160ms cubic-bezier(0.2, 0, 0.8, 1) forwards !important;
        }
        
        @keyframes attackLungeEnhanced {
            0% { 
                transform: translate(calc(-50% - 12px * var(--attack-intensity, 1)), -50%) scale(0.8, 1.15);
            }
            40% {
                transform: translate(calc(-50% + 40px * var(--attack-intensity, 1)), -50%) scale(1.25, 0.85);
            }
            100% { 
                transform: translate(calc(-50% + 55px * var(--attack-intensity, 1)), -50%) scale(1.15, 0.9);
            }
        }
        
        .cryptid-sprite.enemy.attack-lunge-enhanced {
            animation: attackLungeEnhancedEnemy 160ms cubic-bezier(0.2, 0, 0.8, 1) forwards !important;
        }
        
        @keyframes attackLungeEnhancedEnemy {
            0% { 
                transform: translate(calc(-50% + 12px * var(--attack-intensity, 1)), -50%) scale(0.8, 1.15);
            }
            40% {
                transform: translate(calc(-50% - 40px * var(--attack-intensity, 1)), -50%) scale(1.25, 0.85);
            }
            100% { 
                transform: translate(calc(-50% - 55px * var(--attack-intensity, 1)), -50%) scale(1.15, 0.9);
            }
        }
        
        /* Impact freeze (hitstop) */
        .cryptid-sprite.attack-impact-freeze {
            transform: translate(calc(-50% + 55px * var(--attack-intensity, 1)), -50%) scale(1.15, 0.9) !important;
            filter: brightness(1.3) !important;
        }
        
        .cryptid-sprite.enemy.attack-impact-freeze {
            transform: translate(calc(-50% - 55px * var(--attack-intensity, 1)), -50%) scale(1.15, 0.9) !important;
        }
        
        .cryptid-sprite.hitstop-freeze {
            filter: brightness(2) saturate(0.3) !important;
            transform: translate(-50%, -50%) scale(1.05) !important;
        }
        
        /* Recovery phase */
        .cryptid-sprite.attack-recovery {
            animation: attackRecovery 220ms cubic-bezier(0.4, 0, 0.2, 1) forwards !important;
        }
        
        @keyframes attackRecovery {
            0% { 
                transform: translate(calc(-50% + 55px * var(--attack-intensity, 1)), -50%) scale(1.15, 0.9);
            }
            40% { 
                transform: translate(calc(-50% - 8px), -50%) scale(0.95, 1.05);
            }
            70% {
                transform: translate(calc(-50% + 3px), -50%) scale(1.02, 0.98);
            }
            100% { 
                transform: translate(-50%, -50%) scale(1, 1);
            }
        }
        
        .cryptid-sprite.enemy.attack-recovery {
            animation: attackRecoveryEnemy 220ms cubic-bezier(0.4, 0, 0.2, 1) forwards !important;
        }
        
        @keyframes attackRecoveryEnemy {
            0% { 
                transform: translate(calc(-50% - 55px * var(--attack-intensity, 1)), -50%) scale(1.15, 0.9);
            }
            40% { 
                transform: translate(calc(-50% + 8px), -50%) scale(0.95, 1.05);
            }
            70% {
                transform: translate(calc(-50% - 3px), -50%) scale(1.02, 0.98);
            }
            100% { 
                transform: translate(-50%, -50%) scale(1, 1);
            }
        }
        
        /* Afterimage trail */
        .attack-afterimage {
            position: absolute;
            pointer-events: none;
        }
        
        .attack-afterimage img,
        .attack-afterimage .sprite-img,
        .attack-afterimage .field-sprite-img {
            width: var(--sprite-size);
            height: var(--sprite-size);
            object-fit: contain;
        }
        
        /* ==================== ENHANCED HIT REACTION ==================== */
        
        /* Light knockback (1-2 damage) */
        .cryptid-sprite.hit-knockback-light {
            animation: hitKnockbackLight 250ms ease-out forwards !important;
        }
        
        @keyframes hitKnockbackLight {
            0% { 
                transform: translate(-50%, -50%);
                filter: brightness(2.5) saturate(0);
            }
            20% { 
                transform: translate(calc(-50% + 8px * var(--hit-direction, 1)), calc(-50% - 3px)) scale(0.95);
                filter: brightness(1.8) saturate(0.4);
            }
            60% {
                transform: translate(calc(-50% + 4px * var(--hit-direction, 1)), -50%) scale(1.02);
                filter: brightness(1.2);
            }
            100% { 
                transform: translate(-50%, -50%) scale(1);
                filter: brightness(1);
            }
        }
        
        /* Medium knockback (3-4 damage) */
        .cryptid-sprite.hit-knockback-medium {
            animation: hitKnockbackMedium 320ms ease-out forwards !important;
        }
        
        @keyframes hitKnockbackMedium {
            0% { 
                transform: translate(-50%, -50%);
                filter: brightness(3) saturate(0);
            }
            15% { 
                transform: translate(calc(-50% + 18px * var(--hit-direction, 1)), calc(-50% - 8px)) scale(0.9) rotate(calc(5deg * var(--hit-direction, 1)));
                filter: brightness(2) saturate(0.3);
            }
            40% {
                transform: translate(calc(-50% + 12px * var(--hit-direction, 1)), calc(-50% + 2px)) scale(0.95);
                filter: brightness(1.4);
            }
            70% {
                transform: translate(calc(-50% + 4px * var(--hit-direction, 1)), -50%) scale(1.02);
            }
            100% { 
                transform: translate(-50%, -50%) scale(1);
                filter: brightness(1);
            }
        }
        
        /* Heavy knockback (5+ damage) */
        .cryptid-sprite.hit-knockback-heavy {
            animation: hitKnockbackHeavy 400ms ease-out forwards !important;
        }
        
        @keyframes hitKnockbackHeavy {
            0% { 
                transform: translate(-50%, -50%);
                filter: brightness(4) saturate(0);
            }
            10% { 
                transform: translate(calc(-50% + 30px * var(--hit-direction, 1)), calc(-50% - 15px)) scale(0.85) rotate(calc(10deg * var(--hit-direction, 1)));
                filter: brightness(2.5) saturate(0.2);
            }
            30% {
                transform: translate(calc(-50% + 22px * var(--hit-direction, 1)), calc(-50% + 5px)) scale(0.9) rotate(calc(5deg * var(--hit-direction, 1)));
                filter: brightness(1.6);
            }
            55% {
                transform: translate(calc(-50% + 10px * var(--hit-direction, 1)), -50%) scale(1.03);
                filter: brightness(1.2);
            }
            80% {
                transform: translate(calc(-50% + 3px * var(--hit-direction, 1)), -50%) scale(0.98);
            }
            100% { 
                transform: translate(-50%, -50%) scale(1);
                filter: brightness(1);
            }
        }
        
        /* Rim flash highlight on hit */
        .cryptid-sprite.hit-rim-flash .sprite {
            filter: drop-shadow(0 0 8px rgba(255, 100, 100, 0.9)) drop-shadow(0 0 15px rgba(255, 50, 50, 0.6)) !important;
        }
        
        /* Enhanced damage flash on stat bar */
        .combat-stats.damage-flash-enhanced {
            animation: damageFlashEnhanced 400ms ease-out !important;
        }
        
        @keyframes damageFlashEnhanced {
            0% { filter: brightness(1); }
            15% { filter: brightness(2.5) drop-shadow(0 0 10px rgba(255, 0, 0, 0.8)); transform: scale(1.1); }
            40% { filter: brightness(1.5); transform: scale(1.05); }
            100% { filter: brightness(1); transform: scale(1); }
        }
        
        /* ==================== ENHANCED SUMMON ANIMATION ==================== */
        
        /* Summoning circle - outer magical ring */
        .summon-circle {
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            border-radius: 50%;
            border: 2px solid var(--element-color, #888);
            background: 
                radial-gradient(circle, transparent 60%, rgba(255,255,255,0.1) 70%, transparent 75%),
                radial-gradient(circle, transparent 40%, var(--element-color, #888) 45%, transparent 50%);
            opacity: 0;
            animation: summonCircleAppear 450ms ease-out forwards;
            box-shadow: 
                0 0 15px var(--element-color, #888),
                inset 0 0 20px rgba(255,255,255,0.15);
        }
        
        /* Inner rotating ring */
        .summon-inner-ring {
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            border-radius: 50%;
            border: 1.5px dashed var(--element-color, #888);
            opacity: 0;
            animation: summonInnerRing 400ms ease-out forwards;
        }
        
        @keyframes summonCircleAppear {
            0% { 
                transform: translate(-50%, -50%) scale(0.2) rotate(0deg);
                opacity: 0;
            }
            30% {
                opacity: 0.9;
            }
            100% { 
                transform: translate(-50%, -50%) scale(1) rotate(120deg);
                opacity: 0;
            }
        }
        
        @keyframes summonInnerRing {
            0% { 
                transform: translate(-50%, -50%) scale(0.3) rotate(0deg);
                opacity: 0;
            }
            30% {
                opacity: 0.7;
            }
            100% { 
                transform: translate(-50%, -50%) scale(1) rotate(-90deg);
                opacity: 0;
            }
        }
        
        /* Converging particles - soft glowing orbs */
        .summon-particle-converge {
            position: absolute;
            left: 50%;
            top: 50%;
            width: 5px;
            height: 5px;
            background: radial-gradient(circle, rgba(255,255,255,0.9) 0%, var(--particle-color, #888) 50%, transparent 100%);
            border-radius: 50%;
            box-shadow: 0 0 6px var(--particle-color, #888), 0 0 12px var(--particle-color, #888);
            animation: particleConverge 280ms ease-in forwards;
        }
        
        @keyframes particleConverge {
            0% {
                transform: translate(var(--start-x), var(--start-y)) scale(1);
                opacity: 0.8;
            }
            80% {
                opacity: 1;
            }
            100% {
                transform: translate(-50%, -50%) scale(0.3);
                opacity: 0;
            }
        }
        
        /* Energy pillar - outer glow layer */
        .summon-pillar-outer {
            position: absolute;
            left: 50%;
            bottom: 50%;
            width: 50px;
            height: 0;
            background: linear-gradient(
                to top,
                var(--element-color, #888) 0%,
                transparent 100%
            );
            transform: translateX(-50%);
            animation: pillarOuterRise 300ms ease-out forwards;
            border-radius: 50% 50% 20% 20% / 10% 10% 5% 5%;
            filter: blur(8px);
            opacity: 0.6;
        }
        
        /* Energy pillar - bright core */
        .summon-pillar-core {
            position: absolute;
            left: 50%;
            bottom: 50%;
            width: 20px;
            height: 0;
            background: linear-gradient(
                to top,
                rgba(255,255,255,0.95) 0%,
                var(--element-color, #888) 40%,
                transparent 100%
            );
            transform: translateX(-50%);
            animation: pillarCoreRise 280ms ease-out forwards;
            border-radius: 40% 40% 20% 20% / 8% 8% 3% 3%;
            box-shadow: 
                0 0 20px var(--element-color, #888),
                0 0 40px rgba(255,255,255,0.3);
        }
        
        /* Rising particles within pillar */
        .summon-pillar-particle {
            position: absolute;
            left: calc(50% + var(--offset-x, 0px));
            bottom: 50%;
            width: 4px;
            height: 4px;
            background: rgba(255,255,255,0.9);
            border-radius: 50%;
            animation: pillarParticleRise 350ms ease-out forwards;
            animation-delay: var(--delay, 0ms);
            box-shadow: 0 0 4px rgba(255,255,255,0.8);
        }
        
        @keyframes pillarOuterRise {
            0% {
                height: 0;
                opacity: 0;
            }
            30% {
                opacity: 0.6;
            }
            60% {
                height: 140px;
                opacity: 0.5;
            }
            100% {
                height: 180px;
                opacity: 0;
            }
        }
        
        @keyframes pillarCoreRise {
            0% {
                height: 0;
                opacity: 0;
            }
            20% {
                opacity: 1;
            }
            50% {
                height: 130px;
                opacity: 0.9;
            }
            100% {
                height: 160px;
                opacity: 0;
            }
        }
        
        @keyframes pillarParticleRise {
            0% {
                transform: translateY(0);
                opacity: 0;
            }
            20% {
                opacity: 1;
            }
            100% {
                transform: translateY(-120px);
                opacity: 0;
            }
        }
        
        /* Ground impact rings */
        .summon-ground-ring {
            position: absolute;
            left: 50%;
            top: 50%;
            width: 20px;
            height: 8px;
            border: 2px solid var(--element-color, #888);
            border-radius: 50%;
            transform: translate(-50%, -50%) rotateX(70deg);
            animation: groundRingExpand 350ms ease-out forwards;
            box-shadow: 0 0 8px var(--element-color, #888);
        }
        
        @keyframes groundRingExpand {
            0% {
                width: 20px;
                height: 8px;
                opacity: 0.9;
            }
            100% {
                width: 100px;
                height: 40px;
                opacity: 0;
            }
        }
        
        /* Dispersing motes after summon */
        .summon-mote {
            position: absolute;
            left: 50%;
            top: 50%;
            width: 4px;
            height: 4px;
            background: radial-gradient(circle, rgba(255,255,255,0.9), var(--particle-color, #888));
            border-radius: 50%;
            animation: moteDisperse 400ms ease-out forwards;
            box-shadow: 0 0 6px var(--particle-color, #888);
        }
        
        @keyframes moteDisperse {
            0% {
                transform: translate(-50%, -50%) scale(1);
                opacity: 1;
            }
            100% {
                transform: translate(
                    calc(-50% + var(--end-x, 0px)), 
                    calc(-50% + var(--end-y, 0px))
                ) scale(0.5);
                opacity: 0;
            }
        }
        
        /* Sprite materialize effect */
        .cryptid-sprite.summon-materialize {
            animation: spriteMaterialize 480ms ease-out forwards !important;
        }
        
        @keyframes spriteMaterialize {
            0% {
                opacity: 0;
                transform: translate(-50%, -50%) scale(0.4) translateY(10px);
                filter: brightness(3) blur(6px);
            }
            25% {
                opacity: 0.7;
                transform: translate(-50%, -50%) scale(1.15) translateY(-5px);
                filter: brightness(2.5) blur(2px);
            }
            50% {
                opacity: 1;
                transform: translate(-50%, -50%) scale(0.95) translateY(2px);
                filter: brightness(1.8) blur(0);
            }
            75% {
                transform: translate(-50%, -50%) scale(1.03) translateY(-1px);
                filter: brightness(1.3);
            }
            100% {
                opacity: 1;
                transform: translate(-50%, -50%) scale(1) translateY(0);
                filter: brightness(1);
            }
        }
        
        /* ==================== CARD FLIGHT ANIMATION ==================== */
        
        .card-flight {
            transition: none;
            will-change: transform, left, top;
        }
        
        .card-flight.card-flying {
            animation: cardFlyArc 400ms cubic-bezier(0.2, 0, 0.4, 1) forwards;
        }
        
        @keyframes cardFlyArc {
            0% {
                transform: translate(-50%, -50%) rotate(0deg) scale(1);
                left: var(--start-x);
                top: var(--start-y);
            }
            30% {
                transform: translate(-50%, -50%) rotate(-15deg) scale(0.9);
                left: var(--mid-x);
                top: var(--mid-y);
            }
            70% {
                transform: translate(-50%, -50%) rotate(10deg) scale(0.8);
            }
            100% {
                transform: translate(-50%, -50%) rotate(0deg) scale(0.6);
                left: var(--end-x);
                top: var(--end-y);
                opacity: 0;
            }
        }
        
        /* Card trail particle */
        .card-trail-particle {
            width: 8px;
            height: 8px;
            background: var(--particle-color, #888);
            border-radius: 50%;
            transform: translate(-50%, -50%);
            animation: trailFade 300ms ease-out forwards;
            box-shadow: 0 0 10px var(--particle-color, #888);
        }
        
        @keyframes trailFade {
            0% { opacity: 0.8; transform: translate(-50%, -50%) scale(1); }
            100% { opacity: 0; transform: translate(-50%, -50%) scale(0.3); }
        }
        
        /* Card burst particle */
        .card-burst-particle {
            width: 10px;
            height: 10px;
            background: var(--particle-color, #888);
            border-radius: 50%;
            transform: translate(-50%, -50%);
            animation: cardBurstExpand 400ms ease-out forwards;
            box-shadow: 0 0 12px var(--particle-color, #888);
        }
        
        @keyframes cardBurstExpand {
            0% { 
                transform: translate(-50%, -50%) scale(1.5);
                opacity: 1;
            }
            100% { 
                transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(0);
                opacity: 0;
            }
        }
        
        /* Card arrival flash */
        .card-arrival-flash {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(255,255,255,0.9) 0%, var(--element-color, #888) 40%, transparent 70%);
            transform: translate(-50%, -50%);
            animation: arrivalFlash 300ms ease-out forwards;
        }
        
        @keyframes arrivalFlash {
            0% { transform: translate(-50%, -50%) scale(0.3); opacity: 1; }
            50% { transform: translate(-50%, -50%) scale(1.2); opacity: 0.8; }
            100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
        }
        
        /* ==================== EVOLUTION ANIMATION ==================== */
        
        /* Screen-level effects container */
        .evolution-screen-effects {
            will-change: opacity;
        }
        
        /* Distant particles flying in from screen edges */
        .evolution-distant-particle {
            position: absolute;
            width: 6px;
            height: 6px;
            background: radial-gradient(circle, rgba(255,255,255,0.95) 0%, var(--particle-color, #9b59b6) 50%, transparent 100%);
            border-radius: 50%;
            box-shadow: 
                0 0 8px var(--particle-color, #9b59b6),
                0 0 16px var(--particle-color, #9b59b6);
            animation: distantParticleFly var(--duration, 400ms) ease-in forwards;
            animation-delay: var(--delay, 0ms);
            opacity: 0;
        }
        
        .evolution-distant-particle::after {
            content: '';
            position: absolute;
            width: 20px;
            height: 2px;
            background: linear-gradient(to left, var(--particle-color, #9b59b6), transparent);
            top: 50%;
            right: 100%;
            transform: translateY(-50%);
            opacity: 0.6;
        }
        
        @keyframes distantParticleFly {
            0% {
                transform: translate(0, 0) scale(0.5);
                opacity: 0;
            }
            15% {
                opacity: 1;
            }
            85% {
                opacity: 0.9;
            }
            100% {
                transform: translate(var(--target-x), var(--target-y)) scale(0.2);
                opacity: 0;
            }
        }
        
        /* Ambient glow around sprite during gathering */
        .evolution-ambient-glow {
            position: absolute;
            left: 50%;
            top: 50%;
            width: 80px;
            height: 80px;
            border-radius: 50%;
            background: radial-gradient(circle, transparent 30%, var(--element-color, #9b59b6) 70%, transparent 100%);
            transform: translate(-50%, -50%);
            animation: ambientGlowPulse 600ms ease-in-out infinite;
            opacity: 0.4;
            filter: blur(10px);
        }
        
        @keyframes ambientGlowPulse {
            0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.3; }
            50% { transform: translate(-50%, -50%) scale(1.15); opacity: 0.5; }
        }
        
        /* Gathering phase - sprite pulses gently */
        .cryptid-sprite.evolution-gathering-phase {
            animation: evolutionGathering 500ms ease-in-out forwards !important;
        }
        
        @keyframes evolutionGathering {
            0% { 
                transform: translate(-50%, -50%) scale(1);
                filter: brightness(1);
            }
            50% {
                filter: brightness(1.3);
            }
            100% { 
                transform: translate(-50%, -50%) scale(1);
                filter: brightness(1.4) saturate(1.2);
            }
        }
        
        /* Cocoon phase - sprite shrinks into energy cocoon */
        .cryptid-sprite.evolution-cocoon-phase {
            animation: evolutionCocoonPhase 300ms ease-in-out forwards !important;
        }
        
        @keyframes evolutionCocoonPhase {
            0% { 
                transform: translate(-50%, -50%) scale(1);
                filter: brightness(1.4) saturate(1.2);
            }
            100% { 
                transform: translate(-50%, -50%) scale(0.85);
                filter: brightness(2) saturate(1.5);
            }
        }
        
        /* Swirling energy cocoon */
        .evolution-energy-cocoon {
            position: absolute;
            left: 50%;
            top: 50%;
            width: 70px;
            height: 70px;
            border-radius: 50%;
            background: 
                radial-gradient(circle, transparent 40%, rgba(255,255,255,0.2) 50%, transparent 60%),
                conic-gradient(from 0deg, transparent, var(--element-color, #9b59b6), transparent, var(--element-color, #9b59b6), transparent);
            transform: translate(-50%, -50%);
            animation: cocoonSwirl 400ms linear forwards;
            opacity: 0.8;
            filter: blur(2px);
        }
        
        @keyframes cocoonSwirl {
            0% { 
                transform: translate(-50%, -50%) scale(0.5) rotate(0deg);
                opacity: 0;
            }
            30% {
                opacity: 0.9;
            }
            100% { 
                transform: translate(-50%, -50%) scale(1.2) rotate(180deg);
                opacity: 0;
            }
        }
        
        /* Inner glow during cocoon */
        .evolution-inner-glow {
            position: absolute;
            left: 50%;
            top: 50%;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(255,255,255,0.8) 0%, var(--element-color, #9b59b6) 40%, transparent 70%);
            transform: translate(-50%, -50%);
            animation: innerGlowIntensify 300ms ease-in forwards;
            box-shadow: 0 0 30px var(--element-color, #9b59b6);
        }
        
        @keyframes innerGlowIntensify {
            0% { 
                transform: translate(-50%, -50%) scale(0.3);
                opacity: 0.5;
            }
            100% { 
                transform: translate(-50%, -50%) scale(1);
                opacity: 1;
            }
        }
        
        /* Flash phase - sprite hidden momentarily */
        .cryptid-sprite.evolution-flash-phase {
            animation: evolutionFlashPhase 200ms ease-out forwards !important;
        }
        
        @keyframes evolutionFlashPhase {
            0% { 
                transform: translate(-50%, -50%) scale(0.85);
                filter: brightness(2);
                opacity: 1;
            }
            50% {
                filter: brightness(5);
                opacity: 0;
            }
            100% { 
                transform: translate(-50%, -50%) scale(0.9);
                filter: brightness(3);
                opacity: 0;
            }
        }
        
        /* Bright flash effect */
        .evolution-bright-flash {
            position: absolute;
            left: 50%;
            top: 50%;
            width: 140px;
            height: 140px;
            border-radius: 50%;
            background: radial-gradient(circle, 
                rgba(255,255,255,1) 0%, 
                rgba(255,255,255,0.8) 20%,
                var(--element-color, #9b59b6) 40%, 
                transparent 70%
            );
            transform: translate(-50%, -50%);
            animation: brightFlashBurst 250ms ease-out forwards;
        }
        
        @keyframes brightFlashBurst {
            0% { 
                transform: translate(-50%, -50%) scale(0.3);
                opacity: 1;
            }
            40% {
                opacity: 1;
            }
            100% { 
                transform: translate(-50%, -50%) scale(2.5);
                opacity: 0;
            }
        }
        
        /* Reveal phase - new form emerges */
        .cryptid-sprite.evolution-reveal-phase {
            animation: evolutionRevealPhase 200ms ease-out forwards !important;
        }
        
        @keyframes evolutionRevealPhase {
            0% { 
                transform: translate(-50%, -50%) scale(0.9);
                filter: brightness(3);
                opacity: 0;
            }
            30% {
                opacity: 1;
            }
            100% { 
                transform: translate(-50%, -50%) scale(1.1);
                filter: brightness(1.8);
                opacity: 1;
            }
        }
        
        /* Expanding energy rings on reveal */
        .evolution-energy-ring {
            position: absolute;
            left: 50%;
            top: 50%;
            width: 30px;
            height: 30px;
            border: 2px solid var(--element-color, #9b59b6);
            border-radius: 50%;
            transform: translate(-50%, -50%);
            animation: energyRingExpand 450ms ease-out forwards;
            animation-delay: var(--delay, 0ms);
            box-shadow: 
                0 0 10px var(--element-color, #9b59b6),
                inset 0 0 5px var(--element-color, #9b59b6);
        }
        
        @keyframes energyRingExpand {
            0% { 
                width: 30px;
                height: 30px;
                opacity: 0.9;
                border-width: 2px;
            }
            100% { 
                width: 160px;
                height: 160px;
                opacity: 0;
                border-width: 1px;
            }
        }
        
        /* Settle phase - new form settles with glow */
        .cryptid-sprite.evolution-settle-phase {
            animation: evolutionSettlePhase 300ms ease-out forwards !important;
        }
        
        @keyframes evolutionSettlePhase {
            0% { 
                transform: translate(-50%, -50%) scale(1.1);
                filter: brightness(1.8);
            }
            50% {
                transform: translate(-50%, -50%) scale(0.98);
                filter: brightness(1.3);
            }
            100% { 
                transform: translate(-50%, -50%) scale(1);
                filter: brightness(1) drop-shadow(0 0 12px var(--element-color, #9b59b6));
            }
        }
        
        /* Stat badge pop */
        .stat-badge.stat-pop {
            animation: statBadgePop 350ms ease-out !important;
        }
        
        @keyframes statBadgePop {
            0% { transform: scale(1); }
            35% { transform: scale(1.35); filter: brightness(1.4); }
            65% { transform: scale(0.92); }
            100% { transform: scale(1); filter: brightness(1); }
        }
        
        /* ==================== SPELL PROJECTILE ANIMATION ==================== */
        
        .spell-projectile {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(255,255,255,0.9), var(--element-color, #9b59b6));
            box-shadow: 0 0 20px var(--element-color, #9b59b6), 0 0 40px var(--element-color, #9b59b6);
            transform: translate(-50%, -50%);
        }
        
        .spell-projectile.spell-flying {
            animation: spellFly 300ms cubic-bezier(0.2, 0, 0.6, 1) forwards;
        }
        
        @keyframes spellFly {
            0% {
                transform: translate(-50%, -50%) scale(1);
            }
            50% {
                transform: translate(calc(-50% + var(--target-x) * 0.5), calc(-50% + var(--target-y) * 0.5)) scale(1.3);
            }
            100% {
                transform: translate(calc(-50% + var(--target-x)), calc(-50% + var(--target-y))) scale(0.8);
            }
        }
        
        /* Spell trail particle */
        .spell-trail-particle {
            width: 10px;
            height: 10px;
            background: var(--element-color, #9b59b6);
            border-radius: 50%;
            transform: translate(-50%, -50%);
            animation: spellTrailFade 200ms ease-out forwards;
            box-shadow: 0 0 8px var(--element-color, #9b59b6);
        }
        
        @keyframes spellTrailFade {
            0% { opacity: 0.7; transform: translate(-50%, -50%) scale(1); }
            100% { opacity: 0; transform: translate(-50%, -50%) scale(0.2); }
        }
        
        /* Spell impact ring */
        .spell-impact-ring {
            width: 20px;
            height: 20px;
            border: 3px solid var(--element-color, #9b59b6);
            border-radius: 50%;
            transform: translate(-50%, -50%);
            animation: spellImpactExpand 400ms ease-out forwards;
            box-shadow: 0 0 15px var(--element-color, #9b59b6);
        }
        
        @keyframes spellImpactExpand {
            0% { 
                width: 20px;
                height: 20px;
                opacity: 1;
            }
            100% { 
                width: 100px;
                height: 100px;
                opacity: 0;
            }
        }
        
        /* ==================== TURN TRANSITION ANIMATION ==================== */
        
        .turn-banner {
            position: fixed;
            left: -100%;
            top: 50%;
            transform: translateY(-50%);
            width: 100%;
            padding: 20px 0;
            background: linear-gradient(90deg, 
                transparent 0%, 
                rgba(0,0,0,0.9) 20%, 
                rgba(0,0,0,0.95) 50%, 
                rgba(0,0,0,0.9) 80%, 
                transparent 100%);
            z-index: 10000;
            text-align: center;
            border-top: 2px solid var(--banner-color, #4ade80);
            border-bottom: 2px solid var(--banner-color, #4ade80);
            box-shadow: 0 0 50px var(--banner-color, #4ade80);
        }
        
        .turn-banner-text {
            font-family: 'Cinzel', serif;
            font-size: clamp(24px, 6vw, 42px);
            font-weight: 700;
            color: var(--banner-color, #4ade80);
            text-shadow: 0 0 20px var(--banner-color, #4ade80);
            letter-spacing: 8px;
            text-transform: uppercase;
        }
        
        .turn-banner.turn-banner-active {
            animation: bannerSweep 600ms cubic-bezier(0.2, 0, 0.3, 1) forwards;
        }
        
        @keyframes bannerSweep {
            0% { left: -100%; }
            30% { left: 0; }
            70% { left: 0; }
            100% { left: 0; }
        }
        
        .turn-banner.turn-banner-exit {
            animation: bannerExit 300ms ease-in forwards;
        }
        
        @keyframes bannerExit {
            0% { left: 0; opacity: 1; }
            100% { left: 100%; opacity: 0; }
        }
        
        /* Turn pulse wave */
        .turn-pulse {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            animation: turnPulseWave 600ms ease-out forwards;
        }
        
        .turn-pulse-player {
            background: linear-gradient(90deg, rgba(74, 222, 128, 0.3) 0%, transparent 100%);
        }
        
        .turn-pulse-enemy {
            background: linear-gradient(-90deg, rgba(248, 113, 113, 0.3) 0%, transparent 100%);
        }
        
        @keyframes turnPulseWave {
            0% { opacity: 1; transform: scaleX(0); transform-origin: left; }
            50% { opacity: 0.8; transform: scaleX(1); }
            100% { opacity: 0; transform: scaleX(1); }
        }
        
        .turn-pulse-enemy {
            transform-origin: right;
        }
        
        /* Ready stance bounce */
        .cryptid-sprite.ready-stance {
            animation: readyStance 300ms ease-out !important;
        }
        
        @keyframes readyStance {
            0% { transform: translate(-50%, -50%); }
            30% { transform: translate(-50%, calc(-50% - 8px)) scale(1.05); }
            60% { transform: translate(-50%, calc(-50% + 2px)) scale(0.98); }
            100% { transform: translate(-50%, -50%) scale(1); }
        }
        
        /* ==================== PROMOTION ANIMATION ==================== */
        
        /* Anticipation before promotion */
        .cryptid-sprite.promotion-anticipation {
            animation: promotionAnticipation 150ms ease-out forwards !important;
        }
        
        @keyframes promotionAnticipation {
            0% { transform: translate(-50%, -50%); }
            100% { transform: translate(-50%, -50%) scale(1.1); }
        }
        
        /* Determined stride forward */
        .cryptid-sprite.promotion-stride {
            animation: promotionStridePlayer 250ms ease-in-out forwards !important;
        }
        
        @keyframes promotionStridePlayer {
            0% { 
                transform: translate(-50%, -50%) scale(1.1);
            }
            30% {
                transform: translate(calc(-50% + var(--promote-distance) * 0.4), calc(-50% - 5px)) scale(1.05);
            }
            100% { 
                transform: translate(calc(-50% + var(--promote-distance)), -50%) scale(1);
            }
        }
        
        .cryptid-sprite.enemy.promotion-stride {
            animation: promotionStrideEnemy 250ms ease-in-out forwards !important;
        }
        
        @keyframes promotionStrideEnemy {
            0% { 
                transform: translate(-50%, -50%) scale(1.1);
            }
            30% {
                transform: translate(calc(-50% - var(--promote-distance) * 0.4), calc(-50% - 5px)) scale(1.05);
            }
            100% { 
                transform: translate(calc(-50% - var(--promote-distance)), -50%) scale(1);
            }
        }
        
        /* Landing impact */
        .cryptid-sprite.promotion-land {
            animation: promotionLand 100ms ease-out forwards !important;
        }
        
        @keyframes promotionLand {
            0% { transform: translate(-50%, -50%) scale(1); }
            50% { transform: translate(-50%, calc(-50% + 3px)) scale(1.05, 0.95); }
            100% { transform: translate(-50%, -50%) scale(1); }
        }
        
        /* Power-up glow */
        .cryptid-sprite.promotion-powerup {
            animation: promotionPowerup 200ms ease-out forwards !important;
        }
        
        @keyframes promotionPowerup {
            0% { filter: brightness(1); }
            50% { filter: brightness(1.5) drop-shadow(0 0 15px rgba(100, 180, 130, 0.8)); }
            100% { filter: brightness(1); }
        }
        
        /* Dust particles */
        .dust-particle {
            width: 8px;
            height: 8px;
            background: rgba(180, 160, 140, 0.8);
            border-radius: 50%;
            animation: dustRise 500ms ease-out forwards;
        }
        
        @keyframes dustRise {
            0% { 
                transform: translateY(0) scale(1);
                opacity: 0.8;
            }
            100% { 
                transform: translateY(var(--offset-y, -20px)) scale(0.3);
                opacity: 0;
            }
        }
        
        /* ==================== TRAP TRIGGER ANIMATION ==================== */
        
        /* Trap compress (about to spring) */
        .trap-sprite.trap-spring-compress {
            animation: trapCompress 200ms ease-in forwards !important;
        }
        
        @keyframes trapCompress {
            0% { transform: translate(-50%, -50%) scale(1); }
            100% { transform: translate(-50%, -50%) scale(0.7, 1.3); }
        }
        
        /* Trap release (springs open) */
        .trap-sprite.trap-spring-release {
            animation: trapRelease 150ms ease-out forwards !important;
        }
        
        @keyframes trapRelease {
            0% { transform: translate(-50%, -50%) scale(0.7, 1.3); filter: brightness(1); }
            50% { transform: translate(-50%, -50%) scale(1.4, 0.8); filter: brightness(2); }
            100% { transform: translate(-50%, -50%) scale(1.2); filter: brightness(1.5); }
        }
        
        /* Trap burst */
        .trap-sprite.trap-burst {
            animation: trapBurst 350ms ease-out forwards !important;
        }
        
        @keyframes trapBurst {
            0% { 
                transform: translate(-50%, -50%) scale(1.2);
                opacity: 1;
                filter: brightness(1.5);
            }
            30% {
                transform: translate(-50%, -50%) scale(1.5);
                filter: brightness(2.5);
            }
            100% { 
                transform: translate(-50%, -50%) scale(0.3);
                opacity: 0;
                filter: blur(5px);
            }
        }
        
        /* Victim freeze (sees trap trigger) */
        .cryptid-sprite.trap-victim-freeze {
            filter: brightness(0.8) !important;
            transition: filter 100ms ease-out;
        }
        
        /* Victim hit */
        .cryptid-sprite.trap-victim-hit {
            animation: trapVictimHit 350ms ease-out forwards !important;
        }
        
        @keyframes trapVictimHit {
            0% { 
                filter: brightness(2.5) saturate(0);
            }
            30% {
                transform: translate(-50%, -50%) scale(0.9);
                filter: brightness(1.8);
            }
            100% { 
                transform: translate(-50%, -50%) scale(1);
                filter: brightness(1);
            }
        }
        
        /* Trap chain effect */
        .trap-chain {
            height: 4px;
            background: linear-gradient(90deg, var(--element-color, #9b59b6), rgba(255,255,255,0.9), var(--element-color, #9b59b6));
            animation: chainStrike 150ms ease-out forwards;
            box-shadow: 0 0 10px var(--element-color, #9b59b6);
            border-radius: 2px;
        }
        
        @keyframes chainStrike {
            0% { 
                opacity: 0;
                clip-path: inset(0 100% 0 0);
            }
            30% {
                opacity: 1;
                clip-path: inset(0 0 0 0);
            }
            100% { 
                opacity: 0;
            }
        }
        
        /* ==================== PYRE BURN ANIMATION ==================== */
        
        /* Card burning effect */
        .pyre-burning {
            animation: pyreBurning 400ms ease-out forwards !important;
        }
        
        @keyframes pyreBurning {
            0% { 
                filter: brightness(1) saturate(1);
            }
            50% {
                filter: brightness(0.5) saturate(0.3) sepia(1);
            }
            100% { 
                filter: brightness(0.3) saturate(0) sepia(1);
                opacity: 0.5;
            }
        }
        
        /* Rising ember particles */
        .pyre-ember {
            position: absolute;
            width: 6px;
            height: 6px;
            background: radial-gradient(circle, #ffd700, #ff6600);
            border-radius: 50%;
            animation: emberRise 600ms ease-out forwards;
            box-shadow: 0 0 8px #ff6600;
        }
        
        @keyframes emberRise {
            0% { 
                transform: translateY(0) scale(1);
                opacity: 1;
            }
            100% { 
                transform: translateY(-80px) scale(0.3);
                opacity: 0;
            }
        }
        
        /* Flying ember soul with icon */
        .pyre-soul-ember {
            width: 28px;
            height: 28px;
            transform: translate(-50%, -50%);
            filter: drop-shadow(0 0 8px #ff6600) drop-shadow(0 0 15px #ff8800);
            z-index: 10000;
        }
        
        .pyre-soul-ember .ember-icon {
            width: 100%;
            height: 100%;
            object-fit: contain;
            filter: brightness(1.3) saturate(1.2);
        }
        
        .pyre-soul-ember.pyre-soul-flying {
            animation: emberSoulFly 280ms cubic-bezier(0.2, 0, 0.6, 1) forwards;
        }
        
        @keyframes emberSoulFly {
            0% {
                transform: translate(-50%, -50%) scale(1) rotate(0deg);
                opacity: 1;
            }
            40% {
                transform: translate(
                    calc(-50% + (var(--end-x) - 50vw) * 0.4), 
                    calc(-50% + var(--arc-height, -40px))
                ) scale(1.2) rotate(-15deg);
                opacity: 1;
            }
            100% {
                left: var(--end-x);
                top: var(--end-y);
                transform: translate(-50%, -50%) scale(0.4) rotate(10deg);
                opacity: 0;
            }
        }
        
        /* Individual hit pulse - quick and snappy */
        .pyre-display.pyre-absorb-hit {
            animation: pyreAbsorbHit 80ms ease-out;
        }
        
        @keyframes pyreAbsorbHit {
            0% { transform: scale(1); }
            50% { transform: scale(1.15); filter: brightness(1.4); }
            100% { transform: scale(1); }
        }
        
        /* Final absorb pulse after all embers */
        .pyre-display.pyre-absorb-final {
            animation: pyreAbsorbFinal 400ms ease-out;
        }
        
        @keyframes pyreAbsorbFinal {
            0% { transform: scale(1); }
            25% { transform: scale(1.35); filter: brightness(1.6) drop-shadow(0 0 20px #ff8800); }
            50% { transform: scale(0.92); }
            100% { transform: scale(1); filter: brightness(1); }
        }
        
        /* Impact sparks when ember hits counter */
        .pyre-impact-spark {
            width: 4px;
            height: 4px;
            background: radial-gradient(circle, #ffd700, #ff6600);
            border-radius: 50%;
            transform: translate(-50%, -50%);
            animation: pyreSparkBurst 200ms ease-out forwards;
            box-shadow: 0 0 6px #ff8800;
        }
        
        @keyframes pyreSparkBurst {
            0% {
                transform: translate(-50%, -50%) scale(1);
                opacity: 1;
            }
            100% {
                transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(0.3);
                opacity: 0;
            }
        }
        
        /* Flame flare burst - scales with intensity */
        .pyre-flare-burst {
            width: calc(50px * var(--intensity, 1));
            height: calc(50px * var(--intensity, 1));
            background: radial-gradient(circle, rgba(255,220,100,0.95), rgba(255,120,20,0.7), transparent);
            border-radius: 50%;
            transform: translate(-50%, -50%);
            animation: pyreFlare 350ms ease-out forwards;
        }
        
        @keyframes pyreFlare {
            0% { 
                transform: translate(-50%, -50%) scale(0.5);
                opacity: 1;
            }
            50% {
                transform: translate(-50%, -50%) scale(1.5);
            }
            100% { 
                transform: translate(-50%, -50%) scale(2);
                opacity: 0;
            }
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