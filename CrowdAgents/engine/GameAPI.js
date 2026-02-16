const EventEmitter = require('events');
const CONFIG = require('../../config.json');

class GameAPI extends EventEmitter {
    constructor() {
        super();
        this.floor = 1;
        this.killed = 0;
        this.monster = null;
        this.inBattle = false;
        this.slowEffect = 0;
        this.canAdvanceFloor = false;
        this.battleTurns = 0;

        this.player = null;
        this.inventory = null;

        this.seenLore = new Set();
        this.seenNPCs = new Set();

        this.initPlayer();
        this.initInventory();
    }

    initPlayer() {
        this.player = {
            ...CONFIG.player.initial,
            weapon: null,
            armor: null,
            learnedSkills: ['powerStrike'],
            equippedSkills: ['powerStrike'],
            selectedSkill: 'powerStrike',
            skillCooldowns: {},
            critRate: CONFIG.player.initial.critRate || 0.10,
            dodgeRate: CONFIG.player.initial.dodgeRate || 0.05
        };
    }

    initInventory() {
        this.inventory = {
            slots: CONFIG.inventory.initialSlots,
            items: []
        };
    }

    getState() {
        return {
            player: { ...this.player },
            floor: this.floor,
            monster: this.monster ? { ...this.monster } : null,
            inBattle: this.inBattle,
            inventory: { ...this.inventory, items: [...this.inventory.items] },
            canAdvanceFloor: this.canAdvanceFloor,
            killed: this.killed
        };
    }

    createMonster() {
        const cfg = CONFIG.floor;
        const monsters = CONFIG.monsters.filter(m => m.minFloor <= this.floor);
        if (monsters.length === 0) {
            const fallback = CONFIG.monsters[0];
            monsters.push(fallback);
        }
        const idx = Math.floor(Math.random() * monsters.length);
        const m = monsters[idx];
        const mult = 1 + (this.floor - 1) * cfg.difficultyMultiplier;
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
            critRate: m.critRate || 0.10,
            dodgeRate: m.dodgeRate || 0.05
        };
    }

    explore() {
        if (this.inBattle) return;

        this.monster = this.createMonster();
        this.inBattle = true;
        this.slowEffect = 0;
        this.battleTurns = 0;

        this.emit('battleStart', {
            monsterId: this.monster.id,
            monsterName: this.monster.name,
            monsterHP: this.monster.maxHP,
            monsterLevel: this.floor,
            floor: this.floor
        });
    }

    calcDamage(atk, def, rand) {
        return Math.max(1, Math.floor(atk - def + Math.random() * rand));
    }

    getTotalAtk() {
        let atk = this.player.atk;
        if (this.player.weapon) {
            const weapon = CONFIG.equipment.weapons.find(w => w.id === this.player.weapon);
            if (weapon) atk += weapon.atk;
        }
        return atk;
    }

    getTotalDef() {
        let def = this.player.def;
        if (this.player.armor) {
            const armor = CONFIG.equipment.armors.find(a => a.id === this.player.armor);
            if (armor) def += armor.def;
        }
        return def;
    }

    attack() {
        if (!this.inBattle || !this.monster) return;

        this.battleTurns++;
        const dmg = this.calcDamage(this.getTotalAtk(), this.monster.def, CONFIG.battle.normalAttackRand);
        this.dealDamage(dmg, 'attack');
    }

    defend() {
        if (!this.inBattle || !this.monster) return;

        this.battleTurns++;
        this.enemyAttack();
    }

    useSkill(skillId) {
        if (!this.inBattle || !this.monster) return;

        const skill = CONFIG.skills.find(s => s.id === skillId);
        if (!skill) return;

        if (this.player.skillCooldowns[skillId] > 0) {
            return;
        }

        this.player.skillCooldowns[skillId] = skill.cd;
        this.battleTurns++;

        this.emit('skillUse', {
            skillId: skill.id,
            skillName: skill.name,
            targetType: skill.type === 'heal' ? 'self' : 'enemy',
            mpCost: 0
        });

        if (skill.type === 'attack') {
            const dmg = this.calcDamage(
                this.getTotalAtk() * skill.damageMultiplier,
                this.monster.def,
                skill.damageRand
            );
            this.dealDamage(dmg, skill.id, skill);
        } else if (skill.type === 'heal') {
            const healAmt = Math.floor(this.player.maxHP * skill.healPercent);
            this.player.hp = Math.min(this.player.hp + healAmt, this.player.maxHP);
            this.enemyAttack();
        }
    }

    dealDamage(dmg, skillUsed, skill = null) {
        const playerCritRate = this.player.critRate || 0.10;
        const monsterDodgeRate = this.monster.dodgeRate || 0.05;

        if (Math.random() < monsterDodgeRate) {
            this.enemyAttack();
            return;
        }

        const isCritical = Math.random() < playerCritRate;
        if (isCritical) {
            dmg = Math.floor(dmg * 1.5);
        }

        this.monster.hp -= dmg;

        this.emit('monsterDamage', {
            damage: dmg,
            monsterCurrentHP: Math.max(0, this.monster.hp),
            monsterMaxHP: this.monster.maxHP,
            skillUsed: skillUsed,
            isCritical: isCritical
        });

        if (skill && skill.slow) {
            this.slowEffect = skill.slow;
        }

        if (skill && skill.lifesteal) {
            const healAmt = Math.floor(dmg * skill.lifesteal);
            this.player.hp = Math.min(this.player.hp + healAmt, this.player.maxHP);
        }

        if (this.monster.hp <= 0) {
            this.defeat();
        } else {
            this.enemyAttack();
        }
    }

    enemyAttack() {
        if (!this.monster || this.player.hp <= 0) return;

        let atk = this.monster.atk;
        if (this.slowEffect > 0) {
            atk = Math.floor(atk * (1 - this.slowEffect));
            this.slowEffect = Math.max(0, this.slowEffect - 0.1);
        }

        const playerDodgeRate = this.player.dodgeRate || 0.05;
        if (Math.random() < playerDodgeRate) {
            return;
        }

        const monsterCritRate = this.monster.critRate || 0.10;
        const isCritical = Math.random() < monsterCritRate;

        let dmg = this.calcDamage(atk, this.getTotalDef(), CONFIG.battle.enemyAttackRand);
        if (isCritical) {
            dmg = Math.floor(dmg * 1.5);
        }

        this.player.hp -= dmg;

        this.emit('playerDamage', {
            damage: dmg,
            currentHP: Math.max(0, this.player.hp),
            maxHP: this.player.maxHP,
            source: this.monster.id,
            isCritical: isCritical
        });

        if (this.player.hp <= 0) {
            this.gameOver();
        }
    }

    defeat() {
        this.inBattle = false;
        this.killed++;

        const rewards = {
            exp: this.monster.exp,
            gold: this.monster.gold,
            items: []
        };

        this.player.exp += this.monster.exp;
        this.player.gold += this.monster.gold;

        const loots = this.grantLoot(this.monster.id);
        rewards.items = loots;

        this.reduceCooldowns();
        this.checkSkillUnlock();
        this.levelUp();

        this.canAdvanceFloor = this.killed >= this.getMonstersToAdvance();

        this.emit('battleEnd', {
            victory: true,
            duration: this.battleTurns * 500,
            turns: this.battleTurns,
            rewards: rewards,
            playerHPLeft: this.player.hp,
            monsterId: this.monster.id
        });

        this.checkRandomEvent(this.floor);

        this.monster = null;
    }

    grantLoot(monsterId) {
        const lootTable = CONFIG.lootTable[monsterId];
        if (!lootTable) return [];

        const obtained = [];
        lootTable.forEach(loot => {
            if (Math.random() < loot.rate) {
                const count = Math.floor(Math.random() * (loot.maxCount - loot.minCount + 1)) + loot.minCount;
                this.addItem(loot.itemId, count);

                const allItems = [...CONFIG.items.consumables, ...CONFIG.items.materials, ...CONFIG.items.scrolls];
                const itemDef = allItems.find(i => i.id === loot.itemId);
                if (itemDef) {
                    let rarity = 'common';
                    if (loot.rate < 0.1) rarity = 'legendary';
                    else if (loot.rate < 0.2) rarity = 'rare';

                    obtained.push({
                        id: loot.itemId,
                        name: itemDef.name,
                        rarity: rarity
                    });

                    this.emit('itemObtain', {
                        itemId: loot.itemId,
                        itemName: itemDef.name,
                        rarity: rarity,
                        source: 'battle'
                    });
                }
            }
        });

        return obtained;
    }

    addItem(itemId, count = 1) {
        const allItems = [...CONFIG.items.consumables, ...CONFIG.items.materials, ...CONFIG.items.scrolls];
        const itemDef = allItems.find(i => i.id === itemId);
        if (!itemDef) return;

        const existing = this.inventory.items.find(i => i.id === itemId);
        if (existing) {
            existing.count = Math.min(existing.count + count, itemDef.stackMax);
        } else {
            if (this.inventory.items.length < this.inventory.slots) {
                this.inventory.items.push({ id: itemId, count: Math.min(count, itemDef.stackMax) });
            }
        }
    }

    removeItem(itemId, count = 1) {
        const idx = this.inventory.items.findIndex(i => i.id === itemId);
        if (idx === -1) return false;

        this.inventory.items[idx].count -= count;
        if (this.inventory.items[idx].count <= 0) {
            this.inventory.items.splice(idx, 1);
        }
        return true;
    }

    getItemCount(itemId) {
        const item = this.inventory.items.find(i => i.id === itemId);
        return item ? item.count : 0;
    }

    levelUp() {
        const cfg = CONFIG.player.levelUp;
        while (this.player.exp >= this.player.maxEXP) {
            const oldLevel = this.player.level;
            this.player.exp -= this.player.maxEXP;
            this.player.level++;
            this.player.maxHP += cfg.hp;
            this.player.hp = Math.min(this.player.hp + cfg.hp, this.player.maxHP);
            this.player.atk += cfg.atk;
            this.player.def += cfg.def;
            this.player.maxEXP = Math.floor(this.player.maxEXP * cfg.expMultiplier);

            this.emit('levelUp', {
                newLevel: this.player.level,
                oldLevel: oldLevel,
                statsGained: {
                    attack: cfg.atk,
                    defense: cfg.def,
                    hp: cfg.hp
                }
            });
        }
    }

    checkSkillUnlock() {
        const level = this.player.level;
        CONFIG.skills.forEach(skill => {
            if (this.player.learnedSkills.includes(skill.id)) return;
            if (skill.unlock === 'default' || skill.unlock === 'scroll') return;

            const levelMatch = skill.unlock.match(/^level(\d+)$/);
            if (levelMatch && level >= parseInt(levelMatch[1])) {
                this.player.learnedSkills.push(skill.id);

                const slots = this.getUnlockedSkillSlots();
                if (this.player.equippedSkills.length < slots) {
                    this.player.equippedSkills.push(skill.id);
                }
            }
        });
    }

    getUnlockedSkillSlots() {
        const level = this.player.level;
        return CONFIG.player.skillSlots.filter(lvl => level >= lvl).length;
    }

    reduceCooldowns() {
        Object.keys(this.player.skillCooldowns).forEach(key => {
            if (this.player.skillCooldowns[key] > 0) {
                this.player.skillCooldowns[key]--;
            }
        });
    }

    getMonstersToAdvance() {
        const base = CONFIG.floor.monstersToAdvance;
        const max = CONFIG.floor.maxMonsters || 10;
        const floor = this.floor;
        if (floor <= 5) return base;
        if (floor <= 10) return Math.min(base + 1, max);
        if (floor <= 20) return Math.min(base + 2, max);
        return Math.min(base + 3, max);
    }

    nextFloor() {
        if (!this.canAdvanceFloor) return;

        const oldFloor = this.floor;
        const timeSpent = 0;

        this.floor++;
        this.killed = 0;
        this.canAdvanceFloor = false;

        this.emit('floorAdvance', {
            newFloor: this.floor,
            oldFloor: oldFloor,
            timeSpent: timeSpent
        });

        this.triggerLoreDiscovery(this.floor);
        this.checkNPC(this.floor);
    }

    getWorldLore(floor) {
        const loreList = CONFIG.worldLore;
        if (!loreList) return null;
        for (const lore of loreList) {
            if (floor >= lore.floorRange[0] && floor <= lore.floorRange[1]) {
                return lore;
            }
        }
        return loreList ? loreList[0] : null;
    }

    triggerLoreDiscovery(floor) {
        const loreKey = `floor_${floor}`;
        if (this.seenLore.has(loreKey)) return;

        const lore = this.getWorldLore(floor);
        if (lore) {
            this.seenLore.add(loreKey);
            this.emit('loreDiscovery', {
                floor: floor,
                areaName: lore.name,
                description: lore.description,
                lore: lore.lore,
                isFirstVisit: true
            });
        }
    }

    checkNPC(floor) {
        const npcs = CONFIG.npcs;
        if (!npcs) return;

        const availableNPCs = npcs.filter(npc => 
            floor >= npc.minFloor && 
            !this.seenNPCs.has(`${npc.id}_${floor}`)
        );

        for (const npc of availableNPCs) {
            if (Math.random() < npc.probability) {
                this.seenNPCs.add(`${npc.id}_${floor}`);
                this.emit('npcInteraction', {
                    npcId: npc.id,
                    npcName: npc.name,
                    floor: floor
                });
                break;
            }
        }
    }

    checkRandomEvent(floor) {
        const events = CONFIG.randomEvents;
        if (!events) return;

        const availableEvents = events.filter(event => floor >= event.minFloor);

        for (const event of availableEvents) {
            if (Math.random() < event.probability) {
                this.emit('storyEvent', {
                    eventId: event.id,
                    eventName: event.name,
                    floor: floor
                });

                if (event.reward) {
                    if (event.reward.gold) this.player.gold += event.reward.gold;
                    if (event.reward.exp) this.player.exp += event.reward.exp;
                }
                break;
            }
        }
    }

    gameOver() {
        this.inBattle = false;

        this.emit('playerDeath', {
            floor: this.floor,
            totalPlayTime: 0,
            kills: this.killed,
            deathCause: this.monster ? this.monster.id : 'unknown'
        });

        this.initPlayer();
        this.initInventory();
        this.floor = 1;
        this.killed = 0;
        this.monster = null;
        this.inBattle = false;
        this.canAdvanceFloor = false;
    }

    usePotion() {
        if (!this.inBattle) return;

        const consumables = this.inventory.items.filter(i => {
            const def = CONFIG.items.consumables.find(d => d.id === i.id);
            return def && def.heal;
        });

        if (consumables.length === 0) return;

        const item = consumables[0];
        const def = CONFIG.items.consumables.find(d => d.id === item.id);
        if (!def) return;

        const healAmt = Math.min(def.heal, this.player.maxHP - this.player.hp);
        this.player.hp += healAmt;
        this.removeItem(item.id, 1);

        this.emit('itemUse', {
            itemId: item.id,
            itemName: def.name,
            effect: `恢复 ${healAmt} HP`
        });

        this.enemyAttack();
    }

    useItem(itemId) {
        const item = this.inventory.items.find(i => i.id === itemId);
        if (!item) return;

        const def = CONFIG.items.consumables.find(d => d.id === itemId);
        if (!def || !def.heal) return;

        const healAmt = Math.min(def.heal, this.player.maxHP - this.player.hp);
        this.player.hp += healAmt;
        this.removeItem(itemId, 1);

        this.emit('itemUse', {
            itemId: itemId,
            itemName: def.name,
            effect: `恢复 ${healAmt} HP`
        });
    }

    canForge(item) {
        return Object.entries(item.materials).every(([matId, count]) => {
            return this.getItemCount(matId) >= count;
        });
    }

    forgeItem(category, itemId) {
        const item = CONFIG.equipment[category].find(i => i.id === itemId);
        if (!item) return;
        if (!this.canForge(item)) return;

        const materials = [];
        Object.entries(item.materials).forEach(([matId, count]) => {
            materials.push({ itemId: matId, count });
            this.removeItem(matId, count);
        });

        if (category === 'weapons') {
            this.player.weapon = itemId;
        } else {
            this.player.armor = itemId;
        }

        this.emit('forgeSuccess', {
            itemId: itemId,
            itemName: item.name,
            category: category,
            materials: materials
        });
    }

    reset() {
        this.initPlayer();
        this.initInventory();
        this.floor = 1;
        this.killed = 0;
        this.monster = null;
        this.inBattle = false;
        this.slowEffect = 0;
        this.canAdvanceFloor = false;
        this.battleTurns = 0;
    }
}

module.exports = GameAPI;
