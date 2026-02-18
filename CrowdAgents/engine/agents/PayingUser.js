const AgentBase = require('../AgentBase');

class PayingUser extends AgentBase {
    constructor(config) {
        super(config);
        this.purchaseHistory = [];
        this.valuePerceived = 0.5;
        this.spendWillingness = config.specialTraits?.valueSensitivity ? 1 - config.specialTraits.valueSensitivity : 0.65;
        this.timeValueMultiplier = this.specialTraits?.timeValueMultiplier ?? 1.0;
        this.efficiencyWeight = this.specialTraits?.efficiencyWeight ?? 0.32;
        this.grindTolerance = this.preferences?.grindTolerance ?? 0.35;
    }

    decide(gameState) {
        if (!gameState) return 'explore';

        if (!gameState.inBattle) {
            if (gameState.canAdvanceFloor) {
                const shouldAdvance = Math.random() < (0.5 + this.efficiencyWeight);
                if (shouldAdvance || this.grindTolerance < 0.4) {
                    return 'nextFloor';
                }
            }
            return 'explore';
        }

        const hpRatio = gameState.player.hp / gameState.player.maxHP;

        const potionThreshold = 0.5 + (1 - this.grindTolerance) * 0.2;
        if (hpRatio < potionThreshold && this.hasPotion(gameState)) {
            if (Math.random() < this.spendWillingness) {
                return 'usePotion';
            }
        }

        const skills = this.getAvailableSkills(gameState);
        if (skills.length > 0) {
            const expensiveSkill = this.getExpensiveSkill(skills, gameState);
            const skillChance = 0.5 * this.efficiencyWeight * 2;
            if (expensiveSkill && Math.random() < skillChance) {
                return { action: 'useSkill', skillId: expensiveSkill.id };
            }
        }

        return 'attack';
    }

    getExpensiveSkill(skills, gameState) {
        const CONFIG = require('../../../config.json');
        let best = null;
        let highestCost = 0;

        for (const skillId of skills) {
            const skill = CONFIG.skills.find(s => s.id === skillId);
            if (skill && skill.cd && skill.cd > highestCost) {
                highestCost = skill.cd;
                best = skill;
            }
        }

        return best;
    }

    hasPotion(gameState) {
        if (!gameState || !gameState.inventory) return false;
        const CONFIG = require('../../../config.json');
        return gameState.inventory.items.some(item => {
            const def = CONFIG.items.consumables.find(c => c.id === item.id);
            return def && def.heal && item.count > 0;
        });
    }

    onBattleEnd(data) {
        super.onBattleEnd(data);

        if (data.rewards && data.rewards.gold) {
            this.valuePerceived += data.rewards.gold * 0.0001;
        }
    }

    onItemObtain(data) {
        super.onItemObtain(data);

        if (data.rarity === 'legendary') {
            this.valuePerceived += 0.2;
        } else if (data.rarity === 'rare') {
            this.valuePerceived += 0.1;
        }
    }

    onForgeSuccess(data) {
        super.onForgeSuccess(data);

        this.valuePerceived += 0.15;
        this.addBreakdown('playability', `锻造获得价值感: ${data.itemName}`, 'medium');
    }

    getReport() {
        const report = super.getReport();
        report.payingMetrics = {
            valuePerceived: this.valuePerceived.toFixed(2),
            spendWillingness: this.spendWillingness.toFixed(2),
            forgeCount: this.stats.forgeCount
        };
        return report;
    }
}

module.exports = PayingUser;
