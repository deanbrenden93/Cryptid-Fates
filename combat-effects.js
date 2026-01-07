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