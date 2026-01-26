/**
 * Server-Side Card Registry
 * Pure game logic - no DOM, no window, no setTimeout
 * All abilities defined as server-executable functions
 */

// ==================== UTILITY FUNCTIONS ====================

function getAilmentStacks(target) {
    if (!target) return 0;
    let stacks = 0;
    if (target.paralyzed) stacks += 1;
    if (target.burnStacks > 0) stacks += target.burnStacks;
    if (target.bleedStacks > 0) stacks += target.bleedStacks;
    if (target.calamityCounters > 0) stacks += target.calamityCounters;
    if (target.curseTokens > 0) stacks += target.curseTokens;
    return stacks;
}

// ==================== CARD DEFINITIONS ====================

const ServerCardRegistry = {
    cryptids: {},
    bursts: {},
    kindling: {},
    traps: {},
    auras: {},
    pyres: {},
    
    // ==================== CITY OF FLESH ====================
    
    // KINDLING
    
    hellpup: {
        key: 'hellpup',
        name: 'Hellpup',
        type: 'cryptid',
        element: 'blood',
        cost: 0,
        hp: 1,
        atk: 1,
        rarity: 'common',
        isKindling: true,
        evolvesInto: 'hellhound',
        
        // Guard: Negate first attack each turn, burn attacker
        onCombat: (cryptid, game) => {
            cryptid.guardAvailable = true;
        },
        onTurnStart: (cryptid, game) => {
            if (cryptid.col === game.getCombatCol(cryptid.owner)) {
                cryptid.guardAvailable = true;
            }
        },
        onBeforeDefend: (cryptid, attacker, game) => {
            if (cryptid.guardAvailable) {
                cryptid.guardAvailable = false;
                game.applyBurn(attacker, 1);
                cryptid.negateIncomingAttack = true;
                game.emit('guardUsed', { cryptid, attacker, owner: cryptid.owner });
                return { blocked: true, burnApplied: 1 };
            }
            return null;
        },
        // Support: Combatant attacks apply burn
        onSupport: (cryptid, game) => {
            const combatant = game.getCombatant(cryptid);
            if (combatant) {
                combatant.attacksApplyBurn = true;
                combatant.hellpupSupport = cryptid;
            }
        },
        // Evolve to Hellhound if killed by burn
        onDeath: (cryptid, game) => {
            if (cryptid.killedBy === 'burn') {
                const hellhound = game.findEvolutionCard(cryptid.owner, 'hellhound');
                if (hellhound) {
                    cryptid.preventDeath = true;
                    game.evolveInPlace(cryptid, hellhound);
                    game.removeCard(hellhound);
                    return { evolved: 'hellhound' };
                }
            }
            return null;
        }
    },
    
    myling: {
        key: 'myling',
        name: 'Myling',
        type: 'cryptid',
        element: 'blood',
        cost: 0,
        hp: 3,
        atk: 0,
        rarity: 'common',
        isKindling: true,
        
        // Combat: +1 damage to burning enemies
        bonusVsBurning: 1,
        
        // Support: When combatant takes damage from enemy, burn attacker
        onSupport: (cryptid, game) => {
            cryptid.burnOnCombatantDamage = true;
        },
        
        // Death: Burn all enemies in row across
        onDeath: (cryptid, game) => {
            const enemyOwner = cryptid.owner === 'player' ? 'enemy' : 'player';
            const row = cryptid.row;
            const targets = [];
            
            for (let col = 0; col < 2; col++) {
                const target = game.getFieldCryptid(enemyOwner, col, row);
                if (target) {
                    game.applyBurn(target, 1);
                    targets.push({ cryptid: target, burn: 1 });
                }
            }
            
            if (targets.length > 0) {
                game.emit('deathBurn', { source: cryptid, targets });
            }
            return { burnTargets: targets };
        }
    },
    
    decayRat: {
        key: 'decayRat',
        name: 'Decay Rat',
        type: 'cryptid',
        element: 'blood',
        cost: 0,
        hp: 2,
        atk: 1,
        rarity: 'common',
        isKindling: true,
        evolvesInto: 'plagueBearer',
        
        // Combat: Swap position (once per turn ability)
        activateSwap: (cryptid, targetRow, game) => {
            if (!cryptid.swapAvailable) return false;
            
            const field = game.getField(cryptid.owner);
            const combatCol = game.getCombatCol(cryptid.owner);
            const targetCryptid = field[combatCol][targetRow];
            
            if (!targetCryptid) return false;
            
            // Swap positions
            field[combatCol][cryptid.row] = targetCryptid;
            field[combatCol][targetRow] = cryptid;
            
            const oldRow = cryptid.row;
            cryptid.row = targetRow;
            targetCryptid.row = oldRow;
            
            cryptid.swapAvailable = false;
            game.emit('positionSwap', { cryptid, target: targetCryptid });
            return true;
        },
        
        onCombat: (cryptid, game) => {
            cryptid.swapAvailable = true;
        },
        
        // Support: Grant +1 ATK on debuff (once per turn)
        onSupport: (cryptid, game) => {
            cryptid.debuffAvailable = true;
        },
        
        onAllyDebuffed: (cryptid, target, game) => {
            if (cryptid.debuffAvailable && game.getCombatant(cryptid) === target) {
                target.currentAtk = (target.currentAtk || target.atk) + 1;
                cryptid.debuffAvailable = false;
                game.emit('debuffBonus', { source: cryptid, target, bonus: 1 });
                return { atkBonus: 1 };
            }
            return null;
        }
    },
    
    // REGULAR CRYPTIDS
    
    hellhound: {
        key: 'hellhound',
        name: 'Hellhound',
        type: 'cryptid',
        element: 'blood',
        cost: 2,
        hp: 3,
        atk: 2,
        rarity: 'uncommon',
        evolvesFrom: 'hellpup',
        evolvesInto: 'cerberus',
        
        // Combat: On kill, spread 1 burn to adjacent
        onKill: (cryptid, target, game) => {
            const adjacentRows = [target.row - 1, target.row + 1].filter(r => r >= 0 && r < 3);
            const targetField = game.getField(target.owner);
            const combatCol = game.getCombatCol(target.owner);
            const burnTargets = [];
            
            for (const row of adjacentRows) {
                const adjacent = targetField[combatCol][row];
                if (adjacent) {
                    game.applyBurn(adjacent, 1);
                    burnTargets.push({ cryptid: adjacent, burn: 1 });
                }
            }
            
            if (burnTargets.length > 0) {
                game.emit('killBurnSpread', { source: cryptid, targets: burnTargets });
            }
            return { burnTargets };
        },
        
        // Support: Combatant has +2 damage vs burning
        onSupport: (cryptid, game) => {
            const combatant = game.getCombatant(cryptid);
            if (combatant) {
                combatant.bonusVsBurning = (combatant.bonusVsBurning || 0) + 2;
                combatant.hellhoundSupport = cryptid;
            }
        }
    },
    
    kuchisake: {
        key: 'kuchisake',
        name: 'Kuchisake-onna',
        type: 'cryptid',
        element: 'blood',
        cost: 3,
        hp: 3,
        atk: 3,
        rarity: 'rare',
        
        // Combat: Destroyer - Kill enemy support across on enter combat
        onEnterCombat: (cryptid, game) => {
            const enemyOwner = cryptid.owner === 'player' ? 'enemy' : 'player';
            const supportCol = game.getSupportCol(enemyOwner);
            const target = game.getFieldCryptid(enemyOwner, supportCol, cryptid.row);
            
            if (target) {
                target.killedBy = 'destroyer';
                target.killedBySource = cryptid;
                game.killCryptid(target);
                game.emit('destroyerKill', { source: cryptid, target });
                return { killed: target };
            }
            return null;
        },
        
        // Support: Can sacrifice self to kill enemy combatant across
        canActivateSacrifice: (cryptid, game) => {
            const enemyOwner = cryptid.owner === 'player' ? 'enemy' : 'player';
            const combatCol = game.getCombatCol(enemyOwner);
            const target = game.getFieldCryptid(enemyOwner, combatCol, cryptid.row);
            return target !== null;
        },
        
        activateSacrifice: (cryptid, game) => {
            const enemyOwner = cryptid.owner === 'player' ? 'enemy' : 'player';
            const combatCol = game.getCombatCol(enemyOwner);
            const target = game.getFieldCryptid(enemyOwner, combatCol, cryptid.row);
            
            if (!target) return false;
            
            // Kill both
            cryptid.killedBy = 'sacrifice';
            target.killedBy = 'sacrifice';
            
            game.killCryptid(cryptid);
            game.killCryptid(target);
            
            game.emit('sacrificeKill', { source: cryptid, target });
            return { selfDied: true, targetDied: true };
        },
        
        // On combat attack: 50% chance to explode, dealing 3 damage to both
        onCombatAttack: (cryptid, target, game) => {
            if (game.rng.float() < 0.5) {
                const selfDamage = 3;
                const targetDamage = 3;
                
                game.dealDamage(cryptid, selfDamage, cryptid, 'explosion');
                game.dealDamage(target, targetDamage, cryptid, 'explosion');
                
                game.emit('explosion', { source: cryptid, target, damage: 3 });
                return { exploded: true, damage: 3 };
            }
            return { exploded: false };
        }
    },
    
    mothman: {
        key: 'mothman',
        name: 'Mothman',
        type: 'cryptid',
        element: 'steel',
        cost: 5,
        hp: 9,
        atk: 6,
        rarity: 'ultimate',
        mythical: true,
        canTargetAny: true, // Flight
        
        // Combat: Harbinger - deal 1 damage per ailment stack to all enemies
        onEnterCombat: (cryptid, game) => {
            const enemyOwner = cryptid.owner === 'player' ? 'enemy' : 'player';
            const targets = [];
            const deaths = [];
            
            // Get all enemies with ailments
            for (let col = 0; col < 2; col++) {
                for (let row = 0; row < 3; row++) {
                    const enemy = game.getFieldCryptid(enemyOwner, col, row);
                    if (enemy) {
                        const stacks = getAilmentStacks(enemy);
                        if (stacks > 0) {
                            targets.push({
                                cryptid: enemy,
                                damage: stacks,
                                col,
                                row,
                                owner: enemyOwner,
                                isCombatant: col === game.getCombatCol(enemyOwner)
                            });
                        }
                    }
                }
            }
            
            if (targets.length === 0) return null;
            
            // Apply all damage
            for (const target of targets) {
                game.dealDamage(target.cryptid, target.damage, cryptid, 'harbinger');
                if (target.cryptid.currentHp <= 0) {
                    target.cryptid.killedBy = 'harbinger';
                    target.cryptid.killedBySource = cryptid;
                    deaths.push(target);
                }
            }
            
            // Process deaths
            for (const death of deaths) {
                game.killCryptid(death.cryptid, { skipPromotion: true });
            }
            
            // Queue promotions
            for (const death of deaths) {
                if (death.isCombatant) {
                    game.queuePromotion(death.owner, death.row);
                }
            }
            
            game.emit('harbinger', { source: cryptid, targets, deaths });
            
            return { targets, deaths };
        },
        
        // Support: Cleanse friendly combatants, grant +1/+1 per stack, immunity to ailments
        onSupport: (cryptid, game) => {
            const field = game.getField(cryptid.owner);
            const combatCol = game.getCombatCol(cryptid.owner);
            let totalStacksCleansed = 0;
            
            for (let row = 0; row < 3; row++) {
                const combatant = field[combatCol][row];
                if (combatant) {
                    const stacks = getAilmentStacks(combatant);
                    
                    if (stacks > 0) {
                        // Cleanse
                        combatant.paralyzed = false;
                        combatant.burnStacks = 0;
                        combatant.bleedStacks = 0;
                        combatant.calamityCounters = 0;
                        combatant.curseTokens = 0;
                        
                        // Grant +1/+1 per stack
                        combatant.currentAtk = (combatant.currentAtk || combatant.atk) + stacks;
                        combatant.currentHp = (combatant.currentHp || combatant.hp) + stacks;
                        combatant.maxHp = (combatant.maxHp || combatant.hp) + stacks;
                        
                        totalStacksCleansed += stacks;
                    }
                    
                    combatant.hasMothmanImmunity = true;
                }
            }
            
            if (totalStacksCleansed > 0) {
                game.emit('extinctionCleanse', { source: cryptid, stacks: totalStacksCleansed });
            }
            
            return { stacksCleansed: totalStacksCleansed };
        },
        
        // Other: When ailmented enemy dies, gain +1/+1
        onAnyDeath: (cryptid, deadCryptid, game) => {
            if (deadCryptid.owner !== cryptid.owner) {
                const hadAilments = getAilmentStacks(deadCryptid) > 0 ||
                    deadCryptid.killedBy === 'burn' ||
                    deadCryptid.killedBy === 'harbinger';
                
                if (hadAilments) {
                    cryptid.currentAtk = (cryptid.currentAtk || cryptid.atk) + 1;
                    cryptid.currentHp = (cryptid.currentHp || cryptid.hp) + 1;
                    cryptid.maxHp = (cryptid.maxHp || cryptid.hp) + 1;
                    
                    game.emit('mothmanGrowth', { cryptid, bonus: 1 });
                    return { atkBonus: 1, hpBonus: 1 };
                }
            }
            return null;
        }
    },
    
    cerberus: {
        key: 'cerberus',
        name: 'Cerberus',
        type: 'cryptid',
        element: 'blood',
        cost: 4,
        hp: 6,
        atk: 5,
        rarity: 'rare',
        evolvesFrom: 'hellhound',
        
        // Combat: Attack all enemy combatants
        attacksAllCombatants: true,
        
        // On kill: Spread 2 burn to adjacent
        onKill: (cryptid, target, game) => {
            const adjacentRows = [target.row - 1, target.row + 1].filter(r => r >= 0 && r < 3);
            const targetField = game.getField(target.owner);
            const combatCol = game.getCombatCol(target.owner);
            const burnTargets = [];
            
            for (const row of adjacentRows) {
                const adjacent = targetField[combatCol][row];
                if (adjacent) {
                    game.applyBurn(adjacent, 2);
                    burnTargets.push({ cryptid: adjacent, burn: 2 });
                }
            }
            
            if (burnTargets.length > 0) {
                game.emit('cerberusKillBurn', { source: cryptid, targets: burnTargets });
            }
            return { burnTargets };
        },
        
        // Support: All friendly combatants have +2 vs burning
        onSupport: (cryptid, game) => {
            const field = game.getField(cryptid.owner);
            const combatCol = game.getCombatCol(cryptid.owner);
            
            for (let row = 0; row < 3; row++) {
                const combatant = field[combatCol][row];
                if (combatant) {
                    combatant.bonusVsBurning = (combatant.bonusVsBurning || 0) + 2;
                    combatant.cerberusSupport = cryptid;
                }
            }
        }
    },
    
    skeletonKing: {
        key: 'skeletonKing',
        name: 'Skeleton King',
        type: 'cryptid',
        element: 'blood',
        cost: 4,
        hp: 5,
        atk: 4,
        rarity: 'rare',
        
        // Combat: Adjacent allies have +1/+1
        onCombat: (cryptid, game) => {
            const field = game.getField(cryptid.owner);
            const combatCol = game.getCombatCol(cryptid.owner);
            const adjacentRows = [cryptid.row - 1, cryptid.row + 1].filter(r => r >= 0 && r < 3);
            
            for (const row of adjacentRows) {
                const ally = field[combatCol][row];
                if (ally) {
                    ally.currentAtk = (ally.currentAtk || ally.atk) + 1;
                    ally.currentHp = (ally.currentHp || ally.hp) + 1;
                    ally.maxHp = (ally.maxHp || ally.hp) + 1;
                    ally.skeletonKingBuff = true;
                }
            }
            
            game.emit('skeletonKingBuff', { source: cryptid });
        },
        
        // Death: Summon 2 bone minions in adjacent empty slots
        onDeath: (cryptid, game) => {
            const field = game.getField(cryptid.owner);
            const combatCol = game.getCombatCol(cryptid.owner);
            const summoned = [];
            
            // Find adjacent empty slots
            const adjacentRows = [cryptid.row - 1, cryptid.row + 1].filter(r => r >= 0 && r < 3);
            
            for (const row of adjacentRows) {
                if (!field[combatCol][row] && summoned.length < 2) {
                    const minion = game.createToken('boneMinion', cryptid.owner, combatCol, row);
                    field[combatCol][row] = minion;
                    summoned.push(minion);
                }
            }
            
            if (summoned.length > 0) {
                game.emit('boneArmySummon', { source: cryptid, minions: summoned });
            }
            
            return { summoned };
        }
    },
    
    // Token
    boneMinion: {
        key: 'boneMinion',
        name: 'Bone Minion',
        type: 'token',
        element: 'blood',
        cost: 0,
        hp: 1,
        atk: 1,
        rarity: 'common',
        isToken: true
    },
    
    // ==================== FORESTS OF FEAR ====================
    
    newbornWendigo: {
        key: 'newbornWendigo',
        name: 'Newborn Wendigo',
        type: 'cryptid',
        element: 'nature',
        cost: 1,
        hp: 2,
        atk: 1,
        rarity: 'uncommon',
        isKindling: true,
        evolvesInto: 'matureWendigo',
        
        // Combat: Intimidate - enemy combatant across has -1 ATK
        onCombat: (cryptid, game) => {
            const enemy = game.getEnemyCombatantAcross(cryptid);
            if (enemy && !enemy.wendigoIntimidateApplied) {
                enemy.atkDebuff = (enemy.atkDebuff || 0) + 1;
                enemy.wendigoIntimidateApplied = true;
                game.emit('intimidate', { source: cryptid, target: enemy });
            }
        },
        
        // Support: Combatant gains +1/+1
        onSupport: (cryptid, game) => {
            const combatant = game.getCombatant(cryptid);
            if (combatant && !cryptid._buffedCombatant) {
                combatant.currentAtk = (combatant.currentAtk || combatant.atk) + 1;
                combatant.currentHp = (combatant.currentHp || combatant.hp) + 1;
                combatant.maxHp = (combatant.maxHp || combatant.hp) + 1;
                cryptid._buffedCombatant = combatant.id;
                game.emit('nurtureBuff', { source: cryptid, target: combatant });
            }
        }
    },
    
    stormhawk: {
        key: 'stormhawk',
        name: 'Stormhawk',
        type: 'cryptid',
        element: 'nature',
        cost: 1,
        hp: 2,
        atk: 1,
        rarity: 'common',
        isKindling: true,
        evolvesInto: 'thunderbird',
        hasFlight: true,
        canTargetAny: true,
        
        // Combat: +1 ATK if only combatant on summon
        onSummon: (cryptid, game) => {
            if (cryptid.col === game.getCombatCol(cryptid.owner)) {
                const field = game.getField(cryptid.owner);
                const combatCol = game.getCombatCol(cryptid.owner);
                let count = 0;
                
                for (let row = 0; row < 3; row++) {
                    if (field[combatCol][row]) count++;
                }
                
                if (count === 1) {
                    cryptid.currentAtk = (cryptid.currentAtk || cryptid.atk) + 1;
                    game.emit('loneHunterBonus', { cryptid });
                }
            }
        },
        
        // Support: Thermal swap (activated ability)
        onSupport: (cryptid, game) => {
            cryptid.thermalAvailable = true;
        },
        
        activateThermal: (cryptid, targetRow, game) => {
            if (!cryptid.thermalAvailable) return false;
            
            const field = game.getField(cryptid.owner);
            const supportCol = game.getSupportCol(cryptid.owner);
            const target = field[supportCol][targetRow];
            
            if (!target || Math.abs(targetRow - cryptid.row) !== 1) return false;
            
            // Swap positions
            field[supportCol][cryptid.row] = target;
            field[supportCol][targetRow] = cryptid;
            
            const oldRow = cryptid.row;
            cryptid.row = targetRow;
            target.row = oldRow;
            
            // Heal both by 2
            cryptid.currentHp = Math.min(cryptid.maxHp, (cryptid.currentHp || cryptid.hp) + 2);
            target.currentHp = Math.min(target.maxHp, (target.currentHp || target.hp) + 2);
            
            cryptid.thermalAvailable = false;
            game.emit('thermalSwap', { cryptid, target, healAmount: 2 });
            return true;
        }
    },
    
    sasquatch: {
        key: 'sasquatch',
        name: 'Sasquatch',
        type: 'cryptid',
        element: 'nature',
        cost: 0,
        hp: 3,
        atk: 1,
        rarity: 'common',
        isKindling: true,
        evolvesInto: 'bigfoot',
        
        // Combat: Gain +1 ATK when attacked (Growth)
        onDamageTaken: (cryptid, damage, source, game) => {
            if (source && source.owner !== cryptid.owner) {
                cryptid.currentAtk = (cryptid.currentAtk || cryptid.atk) + 1;
                game.emit('growth', { cryptid, bonus: 1 });
            }
        },
        
        // Support: Combatant gains +1 HP each turn
        onSupport: (cryptid, game) => {
            cryptid.grantsSupportHealing = true;
        },
        
        onTurnStartSupport: (cryptid, game) => {
            const combatant = game.getCombatant(cryptid);
            if (combatant) {
                combatant.currentHp = Math.min(combatant.maxHp, (combatant.currentHp || combatant.hp) + 1);
                game.emit('supportHeal', { source: cryptid, target: combatant, amount: 1 });
            }
        }
    },
    
    bigfoot: {
        key: 'bigfoot',
        name: 'Bigfoot',
        type: 'cryptid',
        element: 'nature',
        cost: 3,
        hp: 5,
        atk: 3,
        rarity: 'rare',
        evolvesFrom: 'sasquatch',
        
        // Combat: Gain +1/+1 when attacked
        onDamageTaken: (cryptid, damage, source, game) => {
            if (source && source.owner !== cryptid.owner) {
                cryptid.currentAtk = (cryptid.currentAtk || cryptid.atk) + 1;
                cryptid.currentHp = (cryptid.currentHp || cryptid.hp) + 1;
                cryptid.maxHp = (cryptid.maxHp || cryptid.hp) + 1;
                game.emit('bigfootGrowth', { cryptid, bonus: 1 });
            }
        },
        
        // Support: On ally death in this row, gain their ATK
        onAllyDeath: (cryptid, deadAlly, game) => {
            if (deadAlly.row === cryptid.row && deadAlly !== cryptid) {
                const atkGain = deadAlly.currentAtk || deadAlly.atk;
                cryptid.currentAtk = (cryptid.currentAtk || cryptid.atk) + atkGain;
                game.emit('absorbStrength', { cryptid, source: deadAlly, atkGain });
            }
        }
    },
    
    // ==================== PUTRID SWAMP ====================
    
    feuFollet: {
        key: 'feuFollet',
        name: 'Feu Follet',
        type: 'cryptid',
        element: 'nature',
        cost: 1,
        hp: 2,
        atk: 0,
        rarity: 'common',
        isKindling: true,
        evolvesInto: 'ignisFatuus',
        
        // Combat: Enemies who damage this gain 2 curse
        onDamageTaken: (cryptid, damage, source, game) => {
            if (source && source.owner !== cryptid.owner && damage > 0) {
                game.applyCurse(source, 2);
                game.emit('curseRetaliation', { source: cryptid, target: source, tokens: 2 });
            }
        },
        
        // Support: Combatant attacks apply 1 curse
        onSupport: (cryptid, game) => {
            const combatant = game.getCombatant(cryptid);
            if (combatant) {
                combatant.attacksApplyCurse = 1;
            }
        }
    },
    
    swampRat: {
        key: 'swampRat',
        name: 'Swamp Rat',
        type: 'cryptid',
        element: 'nature',
        cost: 1,
        hp: 1,
        atk: 1,
        rarity: 'common',
        isKindling: true,
        evolvesInto: 'plagueRat',
        
        // Combat: On hit, steal 1 pyre
        onCombatHit: (cryptid, target, game) => {
            const enemyOwner = target.owner;
            const enemyPyre = game.getPyre(enemyOwner);
            
            if (enemyPyre > 0) {
                game.modifyPyre(enemyOwner, -1);
                game.modifyPyre(cryptid.owner, 1);
                game.emit('pyreStolen', { thief: cryptid, victim: target, amount: 1 });
                return { stolen: 1 };
            }
            return null;
        },
        
        // Support: +1 pyre at turn start if combatant is cursed
        onTurnStartSupport: (cryptid, game) => {
            const combatant = game.getCombatant(cryptid);
            if (combatant && combatant.curseTokens > 0) {
                game.modifyPyre(cryptid.owner, 1);
                game.emit('cursePyre', { source: cryptid, combatant });
            }
        }
    },
    
    voodooDoll: {
        key: 'voodooDoll',
        name: 'Voodoo Doll',
        type: 'cryptid',
        element: 'void',
        cost: 1,
        hp: 1,
        atk: 0,
        rarity: 'common',
        isKindling: true,
        evolvesInto: 'loa',
        
        // Combat: Mirror damage to enemy across (50% of damage taken)
        onDamageTaken: (cryptid, damage, source, game) => {
            const enemy = game.getEnemyCombatantAcross(cryptid);
            if (enemy && damage > 0) {
                const mirrorDamage = Math.ceil(damage / 2);
                game.dealDamage(enemy, mirrorDamage, cryptid, 'mirror');
                game.emit('mirrorDamage', { source: cryptid, target: enemy, damage: mirrorDamage });
            }
        },
        
        // Support: Enemy combatant across takes 1 damage when any ally is damaged
        onSupport: (cryptid, game) => {
            cryptid.hasMirrorSupport = true;
        },
        
        onAllyDamaged: (cryptid, ally, damage, game) => {
            if (cryptid.hasMirrorSupport) {
                const enemy = game.getEnemyCombatantAcross(cryptid);
                if (enemy) {
                    game.dealDamage(enemy, 1, cryptid, 'sympathetic');
                    game.emit('sympatheticDamage', { source: cryptid, target: enemy });
                }
            }
        }
    },
    
    rougarou: {
        key: 'rougarou',
        name: 'Rougarou',
        type: 'cryptid',
        element: 'nature',
        cost: 4,
        hp: 4,
        atk: 5,
        rarity: 'rare',
        
        // Combat: On kill, heal to full HP
        onKill: (cryptid, target, game) => {
            const healAmount = cryptid.maxHp - cryptid.currentHp;
            cryptid.currentHp = cryptid.maxHp;
            game.emit('feedingFrenzy', { cryptid, healed: healAmount });
            return { healed: healAmount };
        },
        
        // On death: 50% chance to resurrect with 1 HP (once per game)
        onDeath: (cryptid, game) => {
            if (!cryptid.hasResurrected && game.rng.float() < 0.5) {
                cryptid.preventDeath = true;
                cryptid.currentHp = 1;
                cryptid.hasResurrected = true;
                game.emit('rougarouResurrect', { cryptid });
                return { resurrected: true };
            }
            return null;
        }
    },
    
    // ==================== BURSTS ====================
    
    inferno: {
        key: 'inferno',
        name: 'Inferno',
        type: 'burst',
        element: 'blood',
        cost: 2,
        rarity: 'common',
        
        // Deal 2 damage and apply 2 burn to target
        effect: (game, targetOwner, targetCol, targetRow) => {
            const target = game.getFieldCryptid(targetOwner, targetCol, targetRow);
            if (!target) return { valid: false, error: 'No target' };
            
            game.dealDamage(target, 2, null, 'burst');
            game.applyBurn(target, 2);
            
            game.emit('infernoCast', { target, damage: 2, burn: 2 });
            return { valid: true, damage: 2, burn: 2 };
        }
    },
    
    cleanse: {
        key: 'cleanse',
        name: 'Cleanse',
        type: 'burst',
        element: 'nature',
        cost: 1,
        rarity: 'common',
        
        // Remove all ailments from target and heal 2
        effect: (game, targetOwner, targetCol, targetRow) => {
            const target = game.getFieldCryptid(targetOwner, targetCol, targetRow);
            if (!target) return { valid: false, error: 'No target' };
            
            const stacksCleansed = getAilmentStacks(target);
            target.burnStacks = 0;
            target.bleedStacks = 0;
            target.curseTokens = 0;
            target.paralyzed = false;
            
            target.currentHp = Math.min(target.maxHp, (target.currentHp || target.hp) + 2);
            
            game.emit('cleanseCast', { target, stacksCleansed, healed: 2 });
            return { valid: true, cleansed: stacksCleansed, healed: 2 };
        }
    },
    
    pyroblast: {
        key: 'pyroblast',
        name: 'Pyroblast',
        type: 'burst',
        element: 'blood',
        cost: 4,
        rarity: 'rare',
        
        // Deal 3 damage to all enemies
        effect: (game, casterOwner) => {
            const enemyOwner = casterOwner === 'player' ? 'enemy' : 'player';
            const targets = [];
            
            for (let col = 0; col < 2; col++) {
                for (let row = 0; row < 3; row++) {
                    const enemy = game.getFieldCryptid(enemyOwner, col, row);
                    if (enemy) {
                        game.dealDamage(enemy, 3, null, 'burst');
                        targets.push(enemy);
                    }
                }
            }
            
            game.emit('pyroblastCast', { targets, damage: 3 });
            return { valid: true, targets: targets.length };
        }
    },
    
    // ==================== TRAPS ====================
    
    spikeTrap: {
        key: 'spikeTrap',
        name: 'Spike Trap',
        type: 'trap',
        element: 'steel',
        cost: 1,
        rarity: 'common',
        
        // When enemy attacks in this row, deal 2 damage to attacker
        onEnemyAttackInRow: (trap, attacker, game) => {
            game.dealDamage(attacker, 2, null, 'trap');
            game.emit('spikeTrapTriggered', { attacker, damage: 2 });
            return { triggered: true, damage: 2 };
        }
    },
    
    snare: {
        key: 'snare',
        name: 'Snare',
        type: 'trap',
        element: 'nature',
        cost: 2,
        rarity: 'uncommon',
        
        // When enemy summons in this row, paralyze for 1 turn
        onEnemySummonInRow: (trap, summoned, game) => {
            summoned.paralyzed = true;
            summoned.paralyzedTurns = 1;
            game.emit('snareTriggered', { target: summoned });
            return { triggered: true };
        }
    },
    
    // ==================== AURAS ====================
    
    bloodlust: {
        key: 'bloodlust',
        name: 'Bloodlust',
        type: 'aura',
        element: 'blood',
        cost: 2,
        rarity: 'uncommon',
        
        // Attached cryptid has +2 ATK
        onAttach: (aura, target, game) => {
            target.currentAtk = (target.currentAtk || target.atk) + 2;
            target.bloodlustAura = true;
            game.emit('bloodlustAttached', { target, bonus: 2 });
        },
        
        onDetach: (aura, target, game) => {
            target.currentAtk = Math.max(0, (target.currentAtk || target.atk) - 2);
            target.bloodlustAura = false;
        }
    },
    
    ironHide: {
        key: 'ironHide',
        name: 'Iron Hide',
        type: 'aura',
        element: 'steel',
        cost: 2,
        rarity: 'uncommon',
        
        // Attached cryptid takes 1 less damage from attacks (min 1)
        onAttach: (aura, target, game) => {
            target.damageReduction = (target.damageReduction || 0) + 1;
            target.ironHideAura = true;
            game.emit('ironHideAttached', { target });
        },
        
        onDetach: (aura, target, game) => {
            target.damageReduction = Math.max(0, (target.damageReduction || 0) - 1);
            target.ironHideAura = false;
        }
    },
    
    // ==================== PYRE CARDS ====================
    
    ember: {
        key: 'ember',
        name: 'Ember',
        type: 'pyre',
        element: 'blood',
        cost: 0,
        rarity: 'common',
        
        // Basic pyre card - gives 1 pyre when played
        pyreValue: 1
    },
    
    kindlingFlame: {
        key: 'kindlingFlame',
        name: 'Kindling Flame',
        type: 'pyre',
        element: 'blood',
        cost: 0,
        rarity: 'uncommon',
        
        // Gives 1 pyre and applies 1 burn to random enemy
        pyreValue: 1,
        
        onPlay: (card, owner, game) => {
            const enemyOwner = owner === 'player' ? 'enemy' : 'player';
            const enemies = game.getAllCryptids(enemyOwner);
            
            if (enemies.length > 0) {
                const target = enemies[game.rng.int(0, enemies.length - 1)];
                game.applyBurn(target, 1);
                game.emit('kindlingFlameBurn', { target });
            }
        }
    }
};

// Register all cards
ServerCardRegistry.register = function(key, data) {
    const type = data.type || (data.isKindling ? 'kindling' : 'cryptid');
    
    switch (type) {
        case 'kindling':
            this.kindling[key] = { ...data, key };
            break;
        case 'cryptid':
            this.cryptids[key] = { ...data, key };
            break;
        case 'burst':
            this.bursts[key] = { ...data, key };
            break;
        case 'trap':
            this.traps[key] = { ...data, key };
            break;
        case 'aura':
            this.auras[key] = { ...data, key };
            break;
        case 'pyre':
            this.pyres[key] = { ...data, key };
            break;
        case 'token':
            this.cryptids[key] = { ...data, key };
            break;
    }
};

ServerCardRegistry.get = function(key) {
    return this.cryptids[key] || 
           this.kindling[key] || 
           this.bursts[key] || 
           this.traps[key] || 
           this.auras[key] || 
           this.pyres[key] ||
           null;
};

// Initialize all cards from the definitions above
Object.keys(ServerCardRegistry).forEach(key => {
    if (typeof ServerCardRegistry[key] === 'object' && 
        !['cryptids', 'bursts', 'kindling', 'traps', 'auras', 'pyres'].includes(key) &&
        ServerCardRegistry[key].key) {
        ServerCardRegistry.register(key, ServerCardRegistry[key]);
    }
});

export { ServerCardRegistry, getAilmentStacks };

