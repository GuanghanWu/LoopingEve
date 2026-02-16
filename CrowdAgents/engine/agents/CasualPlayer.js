const AgentBase = require('../AgentBase');

class CasualPlayer extends AgentBase {
    constructor(config) {
        super(config);
        this.consecutiveFails = 0;
    }

    decide(gameState) {
        if (!gameState) return 'explore';

        if (!gameState.inBattle) {
            if (gameState.canAdvanceFloor) {
                return 'nextFloor';
            }
            return 'explore';
        }

        const hpRatio = gameState.player.hp / gameState.player.maxHP;

        if (hpRatio < 0.3) {
            if (this.hasPotion(gameState)) {
                return 'usePotion';
            }
            return 'defend';
        }

        if (hpRatio < 0.5 && this.hasPotion(gameState)) {
            const dice = Math.random();
            if (dice < 0.3 * this.behaviorPatterns.resourceConservation) {
                return 'usePotion';
            }
        }

        return 'attack';
    }

    onBattleEnd(data) {
        super.onBattleEnd(data);

        if (!data.victory) {
            this.consecutiveFails++;
            if (this.consecutiveFails >= (this.behaviorPatterns.quitThreshold.consecutiveFails || 2)) {
                this.addBreakdown('retention', '连续失败导致放弃', 'high');
                this.shouldQuit = true;
            }
        } else {
            this.consecutiveFails = 0;
        }
    }

    hasPotion(gameState) {
        if (!gameState || !gameState.inventory) return false;
        return gameState.inventory.items.some(item => {
            const CONFIG = require('../../../config.json');
            const def = CONFIG.items.consumables.find(c => c.id === item.id);
            return def && def.heal && item.count > 0;
        });
    }
}

module.exports = CasualPlayer;
