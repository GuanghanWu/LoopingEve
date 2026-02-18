const AgentBase = require('../AgentBase');

class StoryExplorer extends AgentBase {
    constructor(config) {
        super(config);
        this.discoveredMonsters = new Set();
        this.discoveredItems = new Set();
        this.visitedFloors = new Set();
        this.floorKillCount = {};
        this.lastFloorExplored = 0;
        this.completionism = this.specialTraits?.completionism ?? 0.5;
        this.toleranceForRandomness = this.specialTraits?.toleranceForRandomness ?? 0.5;
    }

    decide(gameState) {
        if (!gameState) return 'explore';

        if (!gameState.inBattle) {
            const currentFloor = gameState.floor;
            this.visitedFloors.add(currentFloor);

            if (gameState.canAdvanceFloor) {
                const killCount = this.floorKillCount[currentFloor] || 0;
                if (killCount > 10 || this.hasExploredEnough(currentFloor)) {
                    return 'nextFloor';
                }
            }
            return 'explore';
        }

        const monster = gameState.monster;
        if (monster && !this.discoveredMonsters.has(monster.id)) {
            const unusedSkill = this.findUnusedSkill(gameState);
            if (unusedSkill) {
                return { action: 'useSkill', skillId: unusedSkill.id };
            }
        }

        const skills = this.getAvailableSkills(gameState);
        if (skills.length > 0 && Math.random() < 0.4) {
            const untriedSkill = this.findUnusedSkill(gameState);
            if (untriedSkill) {
                return { action: 'useSkill', skillId: untriedSkill.id };
            }
        }

        return 'attack';
    }

    hasExploredEnough(floor) {
        const killCount = this.floorKillCount[floor] || 0;
        const requiredKills = Math.floor(5 + this.completionism * 10);
        return killCount >= requiredKills;
    }

    findUnusedSkill(gameState) {
        const skills = this.getAvailableSkills(gameState);
        for (const skillId of skills) {
            if (!this.usedSkills.has(skillId)) {
                const CONFIG = require('../../../config.json');
                const skill = CONFIG.skills.find(s => s.id === skillId);
                if (skill) return skill;
            }
        }
        return null;
    }

    onBattleStart(data) {
        super.onBattleStart(data);

        if (!this.discoveredMonsters.has(data.monsterId)) {
            this.discoveredMonsters.add(data.monsterId);
        }

        this.visitedFloors.add(data.floor);
    }

    onBattleEnd(data) {
        super.onBattleEnd(data);

        if (data.victory) {
            const floor = this.gameAPI ? this.gameAPI.getState().floor : 1;
            this.floorKillCount[floor] = (this.floorKillCount[floor] || 0) + 1;
        }
    }

    onItemObtain(data) {
        super.onItemObtain(data);

        if (!this.discoveredItems.has(data.itemId)) {
            this.discoveredItems.add(data.itemId);
        }
    }

    onFloorAdvance(data) {
        super.onFloorAdvance(data);
        this.visitedFloors.add(data.newFloor);
    }
}

module.exports = StoryExplorer;
