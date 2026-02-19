import type { Game } from '../Game';
import type { MonsterInstance, Skill } from '../types';

export class BattleManager {
  private game: Game;

  constructor(game: Game) {
    this.game = game;
  }

  createMonster(): MonsterInstance {
    const cfg = this.game.config.floor;
    const monsters = this.game.config.monsters.filter(m => m.minFloor <= this.game.floor);
    const idx = Math.floor(Math.random() * monsters.length);
    const m = monsters[idx];
    const mult = 1 + (this.game.floor - 1) * cfg.difficultyMultiplier;
    return {
      id: m.id,
      name: m.name,
      avatar: m.avatar,
      hp: Math.floor(m.hp * mult),
      maxHP: Math.floor(m.hp * mult),
      atk: Math.floor(m.atk * mult),
      def: Math.floor(m.def * mult),
      exp: Math.floor(m.exp * mult),
      gold: Math.floor(m.gold * mult),
      critRate: m.critRate ?? 0.10,
      dodgeRate: m.dodgeRate ?? 0.05
    };
  }

  explore(): void {
    if (this.game.inBattle) return;
    this.game.monster = this.createMonster();
    this.game.inBattle = true;
    this.game.slowEffect = 0;
    this.game.ui.log(`遭遇了 ${this.game.monster.avatar} ${this.game.monster.name}！`);
    this.game.ui.setButtons({ attack: false, skill: false, item: false, inventory: false, next: true });
    this.game.ui.renderMonster();
  }

  calcDamage(atk: number, def: number, rand: number): number {
    return Math.max(1, Math.floor(atk - def + Math.random() * rand));
  }

  attack(): void {
    if (!this.game.inBattle) return;
    const dmg = this.calcDamage(
      this.game.playerManager.getTotalAtk(),
      this.game.monster!.def,
      this.game.config.battle.normalAttackRand
    );
    this.dealDamage(dmg, `对 ${this.game.monster!.name} 造成 `);
  }

  useSkill(skillId: string): void {
    if (!this.game.inBattle) return;
    const skill = this.game.config.skills.find((s: Skill) => s.id === skillId);
    if (!skill) return;
    if (this.game.player.skillCooldowns[skillId] > 0) {
      this.game.ui.log(`⏳ ${skill.name} 冷却中！`);
      return;
    }
    this.game.player.skillCooldowns[skillId] = skill.cd;
    this.game.ui.updateSkillName();
    if (skill.type === 'attack') {
      const dmg = this.calcDamage(
        this.game.playerManager.getTotalAtk() * (skill.damageMultiplier ?? 1),
        this.game.monster!.def,
        skill.damageRand ?? 0
      );
      const msg = `${skill.icon} ${skill.name}！对 ${this.game.monster!.name} 造成 `;
      this.dealDamage(dmg, msg, skill);
    } else if (skill.type === 'heal') {
      const healAmt = Math.floor(this.game.player.maxHP * (skill.healPercent ?? 0));
      this.game.player.hp = Math.min(this.game.player.hp + healAmt, this.game.player.maxHP);
      this.game.ui.log(`${skill.icon} ${skill.name}！恢复 <span class="heal">${healAmt}</span> HP`);
      this.game.ui.showDamagePopup(healAmt, true);
      this.game.ui.render();
      this.enemyAttack();
    }
  }

  useSelectedSkill(): void {
    const skillId = this.game.player.selectedSkill || this.game.player.learnedSkills[0];
    if (!skillId) {
      this.game.ui.log('❌ 没有学会技能！');
      return;
    }
    const cd = this.game.player.skillCooldowns[skillId] || 0;
    if (cd > 0) {
      const skill = this.game.config.skills.find((s: Skill) => s.id === skillId);
      this.game.ui.log(`⏳ ${skill!.name} 冷却中 (${cd}回合)！`);
      return;
    }
    this.useSkill(skillId);
  }

  dealDamage(dmg: number, msg: string, skill: Skill | null = null): void {
    const playerCritRate = this.game.player.critRate ?? this.game.config.player.initial.critRate;
    const monsterDodgeRate = this.game.monster!.dodgeRate ?? 0.05;

    if (Math.random() < monsterDodgeRate) {
      this.game.ui.log(`${this.game.monster!.avatar} ${this.game.monster!.name} 闪避了攻击！`);
      this.game.ui.showDamagePopup(0, false, true);
      this.enemyAttack();
      this.game.ui.render();
      return;
    }

    const isCritical = Math.random() < playerCritRate;
    let finalDmg = dmg;
    if (isCritical) {
      finalDmg = Math.floor(dmg * 1.5);
    }

    this.game.monster!.hp -= finalDmg;
    const critText = isCritical ? '💥 暴击！' : '';
    this.game.ui.log(`${msg}<span class="damage">${finalDmg}</span> 伤害！${critText}`);
    this.game.ui.showDamagePopup(finalDmg, false, false, isCritical);
    this.game.ui.flash('.monster-card');
    if (skill && skill.slow) {
      this.game.slowEffect = skill.slow;
      this.game.ui.log(`❄️ 怪物被减速！`);
    }
    if (skill && skill.lifesteal) {
      const healAmt = Math.floor(finalDmg * skill.lifesteal);
      this.game.player.hp = Math.min(this.game.player.hp + healAmt, this.game.player.maxHP);
      this.game.ui.log(`🩸 吸血恢复 <span class="heal">${healAmt}</span> HP`);
      this.game.ui.showDamagePopup(healAmt, true);
    }
    this.game.ui.renderMonster();
    if (this.game.monster!.hp <= 0) {
      this.defeat();
    } else {
      this.enemyAttack();
    }
    this.game.ui.render();
  }

  enemyAttack(): void {
    let atk = this.game.monster!.atk;
    if (this.game.slowEffect > 0) {
      atk = Math.floor(atk * (1 - this.game.slowEffect));
      this.game.slowEffect = Math.max(0, this.game.slowEffect - 0.1);
    }

    const playerDodgeRate = this.game.player.dodgeRate ?? this.game.config.player.initial.dodgeRate;
    if (Math.random() < playerDodgeRate) {
      this.game.ui.log(`💫 你闪避了 ${this.game.monster!.name} 的攻击！`);
      return;
    }

    const monsterCritRate = this.game.monster!.critRate ?? 0.10;
    const isCritical = Math.random() < monsterCritRate;

    let dmg = this.calcDamage(
      atk,
      this.game.playerManager.getTotalDef(),
      this.game.config.battle.enemyAttackRand
    );
    if (isCritical) {
      dmg = Math.floor(dmg * 1.5);
    }

    this.game.player.hp -= dmg;
    const critText = isCritical ? '💥 暴击！' : '';
    this.game.ui.log(
      `${this.game.monster!.avatar} ${this.game.monster!.name} 对你造成 <span class="damage">${dmg}</span> 伤害！${critText}`
    );
    this.game.ui.flash('.status-bar');
    if (this.game.player.hp <= 0) this.game.gameOver();
  }

  defeat(): void {
    this.game.inBattle = false;
    this.game.killed++;
    this.game.player.exp += this.game.monster!.exp;
    this.game.player.gold += this.game.monster!.gold;
    this.game.ui.log(
      `🎉 击败 ${this.game.monster!.name}！+<span class="exp">${this.game.monster!.exp}</span> 经验 +<span class="gold">${this.game.monster!.gold}</span> 金币`
    );
    this.game.inventoryManager.grantLoot(this.game.monster!.id);
    this.game.playerManager.reduceCooldowns();
    this.game.playerManager.checkSkillUnlock();
    this.game.playerManager.levelUp();

    const randomEvent = this.game.storyManager.checkRandomEvent(this.game.floor);
    if (randomEvent) {
      const result = this.game.storyManager.processEventReward(randomEvent.data);
      this.game.storyManager.applyReward(result);
      setTimeout(() => {
        this.game.ui.showEventModal(randomEvent.data, result);
      }, 500);
    }

    this.game.save();
    this.game.ui.updatePostBattleUI();
    this.game.handleAutoNext();
  }
}
