const AgentBase = require('../AgentBase');

class SocialPlayer extends AgentBase {
    constructor(config) {
        super(config);
        this.friendsOnline = false;
        this.shareableMoments = [];
        this.socialFrustration = 0;
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

        if (hpRatio < 0.2) {
            this.shareableMoments.push({
                type: 'closeCall',
                time: Date.now(),
                hp: gameState.player.hp
            });
        }

        const skills = this.getAvailableSkills(gameState);
        if (skills.length > 0 && Math.random() < 0.3) {
            const skillId = skills[Math.floor(Math.random() * skills.length)];
            return { action: 'useSkill', skillId };
        }

        return 'attack';
    }

    onBattleEnd(data) {
        super.onBattleEnd(data);

        if (data.victory) {
            if (data.turns && data.turns < 5) {
                this.shareableMoments.push({
                    type: 'quickVictory',
                    time: Date.now(),
                    turns: data.turns
                });
            }

            if (data.playerHPLeft && data.playerHPLeft < 20) {
                this.shareableMoments.push({
                    type: 'dramaticWin',
                    time: Date.now()
                });
            }
        }

        if (this.shareableMoments.length > 5) {
            this.socialFrustration += 0.1;
            this.addBreakdown('immersion', '缺少社交分享功能', 'medium');
            this.adjustScore('immersion', -0.2, 'noShareFeature');
        }
    }

    onLevelUp(data) {
        super.onLevelUp(data);

        this.shareableMoments.push({
            type: 'levelUp',
            time: Date.now(),
            level: data.newLevel
        });
    }

    onFloorAdvance(data) {
        super.onFloorAdvance(data);

        this.shareableMoments.push({
            type: 'newFloor',
            time: Date.now(),
            floor: data.newFloor
        });
    }

    getReport() {
        const report = super.getReport();
        report.socialMetrics = {
            shareableMoments: this.shareableMoments.length,
            socialFrustration: this.socialFrustration.toFixed(2),
            topMoments: this.shareableMoments.slice(-5)
        };
        return report;
    }
}

module.exports = SocialPlayer;
