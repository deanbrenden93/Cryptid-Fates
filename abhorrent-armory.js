/**
 * Cryptid Fates - Abhorrent Armory Series
 * Card and Monster Definitions
 * 
 * THEME: Combat tools, weapons, and tactical spells.
 */

// ==================== ABHORRENT ARMORY - BURSTS ====================

// Rock Slide - Common, 1 Pyre
CardRegistry.registerBurst('rockSlide', {
    name: "Rock Slide",
    sprite: "🪨",
    cost: 1,
    rarity: "common",
    description: "Deal 1 damage to target enemy cryptid. If target is a support whose combatant is resting, deal 3 damage instead.",
    targetType: 'enemyCryptid',
    
    effect: (game, owner, target) => {
        if (!target) return false;
        
        const targetOwner = target.owner;
        const supportCol = game.getSupportCol(targetOwner);
        const combatCol = game.getCombatCol(targetOwner);
        const field = targetOwner === 'player' ? game.playerField : game.enemyField;
        
        let damage = 1;
        
        // Check if target is a support and combatant in front is resting
        if (target.col === supportCol) {
            const combatant = field[combatCol][target.row];
            if (combatant && combatant.tapped) {
                damage = 3;
            }
        }
        
        // Deal damage
        target.currentHp = (target.currentHp || target.hp) - damage;
        
        GameEvents.emit('onRockSlide', { 
            source: owner, 
            target, 
            damage,
            owner 
        });
        
        // Queue animation
        if (typeof queueAbilityAnimation !== 'undefined') {
            queueAbilityAnimation({
                type: 'abilityDamage',
                target: target,
                damage: damage,
                message: `🪨 Rock Slide deals ${damage} damage!`
            });
        }
        
        // Check if target died
        if (target.currentHp <= 0) {
            target.killedBy = 'rockSlide';
            game.killCryptid(target, owner);
        }
        
        return true;
    }
});

console.log("Abhorrent Armory cards loaded:", 
    Object.keys(CardRegistry.bursts || {}).filter(k => 
        ['rockSlide'].includes(k)
    ).length, "bursts"
);

