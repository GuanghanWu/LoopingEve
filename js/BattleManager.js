class BattleManager {
    constructor(game) {
        this.game = game;
    }

    createMonster() {
        const cfg = CONFIG.floor;
        const monsters = CONFIG.monsters.filter(m => m.minFloor <= this.game.floor);
        const idx = Math.floor(Math.random() * monsters.length);
        const m = monsters[idx];
        const mult = 1 + (this.game.floor - 1) * cfg.difficultyMultiplier;
        return {
            id: m.id, name: m.name, avatar: m.avatar,
            hp: Math.floor(m.hp * mult), maxHP: Math.floor(m.hp * mult),
            atk: Math.floor(m.atk * mult), def: Math.floor(m.def * mult),
            exp: Math.floor(m.exp * mult), gold: Math.floor(m.gold * mult)
        };
    }

    explore() {
        if (this.game.inBattle) return;
        this.game.monster = this.createMonster();
        this.game.inBattle = true;
        this.game.slowEffect = 0;
        this.game.ui.log(`遭遇了 ${this.game.monster.avatar} ${this.game.monster.name}！`);
        this.game.ui.setButtons({ attack: false, skill: false, item: false, inventory: false, next: true });
        this.game.ui.renderMonster();
    }

    calcDamage(atk, def, rand) {
        return Math.max(1, Math.floor(atk - def + Math.random() * rand));
    }

    attack() {
        if (!this.game.inBattle) return;
        const dmg = this.calcDamage(this.game.playerManager.getTotalAtk(), this.game.monster.def, CONFIG.battle.normalAttackRand);
        this.dealDamage(dmg, `对 ${this.game.monster.name} 造成 `);
    }

    useSkill(skillId) {
        if (!this.game.inBattle) return;
        const skill = CONFIG.skills.find(s => s.id === skillId);
        if (!skill) return;
        if (this.game.player.skillCooldowns[skillId] > 0) {
            this.game.ui.log(`⏳ ${skill.name} 冷却中！`);
            return;
        }
        this.game.player.skillCooldowns[skillId] = skill.cd;
        this.game.ui.updateSkillName();
        if (skill.type === 'attack') {
            const dmg = this.calcDamage(
                this.game.playerManager.getTotalAtk() * skill.damageMultiplier,
                this.game.monster.def,
                skill.damageRand
            );
            let msg = `${skill.icon} ${skill.name}！对 ${this.game.monster.name} 造成 `;
            this.dealDamage(dmg, msg, skill);
        } else if (skill.type === 'heal') {
            const healAmt = Math.floor(this.game.player.maxHP * skill.healPercent);
            this.game.player.hp = Math.min(this.game.player.hp + healAmt, this.game.player.maxHP);
            this.game.ui.log(`${skill.icon} ${skill.name}！恢复 <span class="heal">${healAmt}</span> HP`);
            this.game.ui.showDamagePopup(healAmt, true);
            this.game.ui.render();
            this.enemyAttack();
        }
    }

    useSelectedSkill() {
        const skillId = this.game.player.selectedSkill || this.game.player.learnedSkills[0];
        if (!skillId) {
            this.game.ui.log('❌ 没有学会技能！');
            return;
        }
        const cd = this.game.player.skillCooldowns[skillId] || 0;
        if (cd > 0) {
            const skill = CONFIG.skills.find(s => s.id === skillId);
            this.game.ui.log(`⏳ ${skill.name} 冷却中 (${cd}回合)！`);
            return;
        }
        this.useSkill(skillId);
    }

    dealDamage(dmg, msg, skill = null) {
        this.game.monster.hp -= dmg;
        this.game.ui.log(`${msg}<span class="damage">${dmg}</span> 伤害！`);
        this.game.ui.showDamagePopup(dmg, false);
        this.game.ui.flash('.monster-card');
        if (skill && skill.slow) {
            this.game.slowEffect = skill.slow;
            this.game.ui.log(`❄️ 怪物被减速！`);
        }
        if (skill && skill.lifesteal) {
            const healAmt = Math.floor(dmg * skill.lifesteal);
            this.game.player.hp = Math.min(this.game.player.hp + healAmt, this.game.player.maxHP);
            this.game.ui.log(`🩸 吸血恢复 <span class="heal">${healAmt}</span> HP`);
            this.game.ui.showDamagePopup(healAmt, true);
        }
        this.game.ui.renderMonster();
        this.game.monster.hp <= 0 ? this.defeat() : this.enemyAttack();
        this.game.ui.render();
    }

    enemyAttack() {
        let atk = this.game.monster.atk;
        if (this.game.slowEffect > 0) {
            atk = Math.floor(atk * (1 - this.game.slowEffect));
            this.game.slowEffect = Math.max(0, this.game.slowEffect - 0.1);
        }
        const dmg = this.calcDamage(atk, this.game.playerManager.getTotalDef(), CONFIG.battle.enemyAttackRand);
        this.game.player.hp -= dmg;
        this.game.ui.log(`${this.game.monster.avatar} ${this.game.monster.name} 对你造成 <span class="damage">${dmg}</span> 伤害！`);
        this.game.ui.flash('.status-bar');
        if (this.game.player.hp <= 0) this.game.gameOver();
    }

    defeat() {
        this.game.inBattle = false;
        this.game.killed++;
        this.game.player.exp += this.game.monster.exp;
        this.game.player.gold += this.game.monster.gold;
        this.game.ui.log(`🎉 击败 ${this.game.monster.name}！+<span class="exp">${this.game.monster.exp}</span> 经验 +<span class="gold">${this.game.monster.gold}</span> 金币`);
        this.game.inventoryManager.grantLoot(this.game.monster.id);
        this.game.playerManager.reduceCooldowns();
        this.game.playerManager.checkSkillUnlock();
        this.game.playerManager.levelUp();
        this.game.save();
        this.game.ui.updatePostBattleUI();
        this.game.handleAutoNext();
    }
}
