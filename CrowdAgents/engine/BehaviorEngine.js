const CONFIG = require('../../config.json');

class BehaviorEngine {
    constructor() {
        this.decisionFactors = {
            casual: {
                survivalPriority: 0.8,
                efficiencyPriority: 0.3,
                explorationPriority: 0.4,
                riskTolerance: 0.2,
                resourceConservation: 0.75
            },
            hardcore: {
                survivalPriority: 0.3,
                efficiencyPriority: 0.9,
                explorationPriority: 0.5,
                riskTolerance: 0.8,
                resourceConservation: 0.2
            },
            explorer: {
                survivalPriority: 0.5,
                efficiencyPriority: 0.4,
                explorationPriority: 0.9,
                riskTolerance: 0.5,
                resourceConservation: 0.5
            },
            social: {
                survivalPriority: 0.5,
                efficiencyPriority: 0.5,
                explorationPriority: 0.5,
                riskTolerance: 0.5,
                resourceConservation: 0.5
            },
            paying: {
                survivalPriority: 0.5,
                efficiencyPriority: 0.7,
                explorationPriority: 0.4,
                riskTolerance: 0.6,
                resourceConservation: 0.15
            }
        };
    }

    analyzeGameState(gameState) {
        return {
            hpRatio: gameState.player.hp / gameState.player.maxHP,
            inBattle: gameState.inBattle,
            canAdvance: gameState.canAdvanceFloor,
            hasMonster: gameState.monster !== null,
            monsterStrength: this.assessMonsterStrength(gameState.monster),
            inventorySpace: gameState.inventory.slots - gameState.inventory.items.length,
            skillAvailability: this.assessSkillAvailability(gameState.player)
        };
    }

    assessMonsterStrength(monster) {
        if (!monster) return 0;
        const hpRatio = monster.hp / monster.maxHP;
        return {
            currentHPRatio: hpRatio,
            isLowHP: hpRatio < 0.3,
            isHighHP: hpRatio > 0.7
        };
    }

    assessSkillAvailability(player) {
        const equippedSkills = player.equippedSkills || [];
        const cooldowns = player.skillCooldowns || {};
        return equippedSkills.filter(skillId => !cooldowns[skillId] || cooldowns[skillId] === 0);
    }

    getDecisionFactors(agentType) {
        return this.decisionFactors[agentType] || this.decisionFactors.casual;
    }

    shouldUsePotion(gameState, agentType) {
        const factors = this.getDecisionFactors(agentType);
        const analysis = this.analyzeGameState(gameState);

        if (analysis.hpRatio < 0.3) {
            return factors.survivalPriority > 0.5;
        }

        if (analysis.hpRatio < 0.5 && factors.resourceConservation < 0.3) {
            return true;
        }

        return false;
    }

    shouldUseSkill(gameState, agentType) {
        const factors = this.getDecisionFactors(agentType);
        const analysis = this.analyzeGameState(gameState);

        if (analysis.skillAvailability.length === 0) return false;

        if (agentType === 'hardcore') {
            return analysis.skillAvailability.length > 0;
        }

        if (agentType === 'explorer') {
            return Math.random() < 0.4;
        }

        return Math.random() < 0.3;
    }

    shouldAdvanceFloor(gameState, agentType) {
        const factors = this.getDecisionFactors(agentType);

        if (!gameState.canAdvanceFloor) return false;

        if (agentType === 'explorer') {
            return true;
        }

        if (agentType === 'casual') {
            return Math.random() < 0.6;
        }

        return true;
    }

    calculateRisk(gameState, action) {
        const analysis = this.analyzeGameState(gameState);

        if (action === 'attack') {
            if (analysis.hpRatio < 0.3) return 'high';
            if (analysis.hpRatio < 0.5) return 'medium';
            return 'low';
        }

        if (action === 'useSkill') {
            return 'low';
        }

        return 'low';
    }
}

module.exports = BehaviorEngine;
