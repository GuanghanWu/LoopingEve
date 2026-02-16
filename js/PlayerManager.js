class PlayerManager {
    constructor(game) {
        this.game = game;
    }

    init() {
        this.game.player = {
            ...CONFIG.player.initial,
            weapon: null,
            armor: null,
            learnedSkills: ['powerStrike'],
            equippedSkills: ['powerStrike'],
            selectedSkill: 'powerStrike',
            skillCooldowns: {}
        };
    }

    getTotalAtk() {
        let atk = this.game.player.atk;
        if (this.game.player.weapon) {
            const weapon = CONFIG.equipment.weapons.find(w => w.id === this.game.player.weapon);
            if (weapon) atk += weapon.atk;
        }
        return atk;
    }

    getTotalDef() {
        let def = this.game.player.def;
        if (this.game.player.armor) {
            const armor = CONFIG.equipment.armors.find(a => a.id === this.game.player.armor);
            if (armor) def += armor.def;
        }
        return def;
    }

    getUnlockedSkillSlots() {
        const level = this.game.player.level;
        return CONFIG.player.skillSlots.filter(lvl => level >= lvl).length;
    }

    levelUp() {
        const cfg = CONFIG.player.levelUp;
        while (this.game.player.exp >= this.game.player.maxEXP) {
            const oldLevel = this.game.player.level;
            this.game.player.exp -= this.game.player.maxEXP;
            this.game.player.level++;
            this.game.player.maxHP += cfg.hp;
            this.game.player.hp = Math.min(this.game.player.hp + cfg.hp, this.game.player.maxHP);
            this.game.player.atk += cfg.atk;
            this.game.player.def += cfg.def;
            this.game.player.maxEXP = Math.floor(this.game.player.maxEXP * cfg.expMultiplier);
            this.game.ui.showLevelUp(this.game.player.level, cfg);
            this.game.emit?.('levelUp', {
                newLevel: this.game.player.level,
                oldLevel: oldLevel,
                statsGained: {
                    attack: cfg.atk,
                    defense: cfg.def,
                    hp: cfg.hp
                }
            });
        }
    }

    equipSkill(skillId) {
        const equipped = this.game.player.equippedSkills;
        if (equipped.includes(skillId)) return null;
        const unlocked = this.getUnlockedSkillSlots();
        let replacedSkill = null;
        if (equipped.length >= unlocked) {
            if (equipped[0]) {
                const oldSkill = CONFIG.skills.find(s => s.id === equipped[0]);
                replacedSkill = oldSkill ? oldSkill.name : equipped[0];
                equipped.shift();
            }
        }
        equipped.push(skillId);
        return replacedSkill;
    }

    unequipSkill(index) {
        if (index < 0 || index >= this.game.player.equippedSkills.length) return false;
        this.game.player.equippedSkills.splice(index, 1);
        return true;
    }

    checkSkillUnlock() {
        const level = this.game.player.level;
        CONFIG.skills.forEach(skill => {
            if (this.game.player.learnedSkills.includes(skill.id)) return;
            if (skill.unlock === 'default' || skill.unlock === 'scroll') return;
            const levelMatch = skill.unlock.match(/^level(\d+)$/);
            if (levelMatch && level >= parseInt(levelMatch[1])) {
                this.game.player.learnedSkills.push(skill.id);
                this.game.ui.log(`✨ 学会新技能：${skill.icon} ${skill.name}！`);
                if (!this.game.player.equippedSkills.includes(skill.id)) {
                    const slots = this.getUnlockedSkillSlots();
                    if (this.game.player.equippedSkills.length < slots) {
                        this.game.player.equippedSkills.push(skill.id);
                    }
                }
            }
        });
    }

    reduceCooldowns() {
        Object.keys(this.game.player.skillCooldowns).forEach(key => {
            if (this.game.player.skillCooldowns[key] > 0) {
                this.game.player.skillCooldowns[key]--;
            }
        });
        this.game.ui.updateSkillName();
    }

    migrateOldData() {
        if (!this.game.player.learnedSkills) {
            this.game.player.learnedSkills = ['powerStrike'];
            this.game.player.equippedSkills = ['powerStrike'];
            this.game.player.skillCooldowns = {};
        }
        if (!this.game.player.selectedSkill) {
            this.game.player.selectedSkill = this.game.player.learnedSkills[0] || 'powerStrike';
        }
        if (!this.game.player.weapon) this.game.player.weapon = null;
        if (!this.game.player.armor) this.game.player.armor = null;
    }

    unequipItem(category) {
        if (category === 'weapons') {
            this.game.player.weapon = null;
        } else {
            this.game.player.armor = null;
        }
    }
}
