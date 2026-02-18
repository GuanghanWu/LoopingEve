const AgentBase = require('../AgentBase');

class HardcoreGamer extends AgentBase {
    constructor(config) {
        super(config);
        this.skillCombo = [];
        this.comboIndex = 0;
        this.completionism = this.specialTraits?.completionism ?? 0.7;
        this.efficiencyWeight = this.specialTraits?.efficiencyWeight ?? 0.5;
    }

    decide(gameState) {
        if (!gameState) return 'explore';

        if (!gameState.inBattle) {
            if (gameState.canAdvanceFloor) {
                return 'nextFloor';
            }
            return 'explore';
        }

        const skills = this.getAvailableSkills(gameState);
        const monster = gameState.monster;

        if (skills.length > 0 && monster) {
            const bestSkill = this.selectOptimalSkill(skills, monster, gameState);
            if (bestSkill) {
                return { action: 'useSkill', skillId: bestSkill.id };
            }
        }

        return 'attack';
    }

    selectOptimalSkill(skills, monster, gameState) {
        const CONFIG = require('../../../config.json');
        const playerAtk = this.calculateTotalAtk(gameState);

        let bestSkill = null;
        let bestExpectedDamage = 0;

        for (const skillId of skills) {
            const skill = CONFIG.skills.find(s => s.id === skillId);
            if (!skill) continue;

            if (skill.type === 'heal') {
                const hpRatio = gameState.player.hp / gameState.player.maxHP;
                if (hpRatio < 0.4) {
                    const healValue = gameState.player.maxHP * (skill.healPercent || 0.35);
                    if (healValue > bestExpectedDamage) {
                        bestExpectedDamage = healValue;
                        bestSkill = skill;
                    }
                }
                continue;
            }

            if (skill.type === 'attack') {
                const baseDamage = playerAtk * (skill.damageMultiplier || 1);
                const expectedDamage = this.calculateExpectedDamage(baseDamage, monster, skill);
                if (expectedDamage > bestExpectedDamage) {
                    bestExpectedDamage = expectedDamage;
                    bestSkill = skill;
                }
            }
        }

        return bestSkill;
    }

    calculateExpectedDamage(baseDamage, monster, skill) {
        const defense = monster.def || 0;
        const randomFactor = (skill.damageRand || 4) / 2;
        const expectedRaw = baseDamage - defense + randomFactor;
        const critChance = this.skillProfile.gameSense * 0.2;
        return Math.max(1, expectedRaw) * (1 + critChance);
    }

    calculateTotalAtk(gameState) {
        const CONFIG = require('../../../config.json');
        let atk = gameState.player.atk;

        if (gameState.player.weapon) {
            const weapon = CONFIG.equipment.weapons.find(w => w.id === gameState.player.weapon);
            if (weapon) atk += weapon.atk;
        }

        return atk;
    }

    onBattleEnd(data) {
        super.onBattleEnd(data);
        this.skillCombo = [];
    }
}

module.exports = HardcoreGamer;
