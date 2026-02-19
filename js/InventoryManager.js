class InventoryManager {
    constructor(game) {
        this.game = game;
    }

    init() {
        this.game.inventory = {
            slots: CONFIG.inventory.initialSlots,
            items: []
        };
    }

    addItem(itemId, count = 1) {
        const allItems = [...CONFIG.items.consumables, ...CONFIG.items.materials, ...CONFIG.items.scrolls];
        const itemDef = allItems.find(i => i.id === itemId);
        if (!itemDef) return;
        let existing = this.game.inventory.items.find(i => i.id === itemId);
        if (existing) {
            const newCount = Math.min(existing.count + count, itemDef.stackMax);
            const added = newCount - existing.count;
            existing.count = newCount;
            if (added > 0) {
                this.game.ui.log(`📦 ${itemDef.icon} ${itemDef.name} +${added}`);
            }
        } else {
            if (this.game.inventory.items.length >= this.game.inventory.slots) {
                this.game.ui.log(`⚠️ 背包已满，${itemDef.name} 丢失！`);
                return;
            }
            this.game.inventory.items.push({ id: itemId, count: Math.min(count, itemDef.stackMax) });
            this.game.ui.log(`📦 ${itemDef.icon} ${itemDef.name} +${count}`);
        }
    }

    removeItem(itemId, count = 1) {
        const idx = this.game.inventory.items.findIndex(i => i.id === itemId);
        if (idx === -1) return false;
        this.game.inventory.items[idx].count -= count;
        if (this.game.inventory.items[idx].count <= 0) {
            this.game.inventory.items.splice(idx, 1);
        }
        return true;
    }

    getItemCount(itemId) {
        const item = this.game.inventory.items.find(i => i.id === itemId);
        return item ? item.count : 0;
    }

    grantLoot(monsterId) {
        const lootTable = CONFIG.lootTable[monsterId];
        if (!lootTable) return;
        lootTable.forEach(loot => {
            if (Math.random() < loot.rate) {
                const count = Math.floor(Math.random() * (loot.maxCount - loot.minCount + 1)) + loot.minCount;
                this.addItem(loot.itemId, count);
            }
        });
    }

    useItem(index) {
        const item = this.game.inventory.items[index];
        if (!item) return;
        const def = CONFIG.items.consumables.find(d => d.id === item.id);
        if (!def || !def.heal) return;
        const healAmt = Math.min(def.heal, this.game.player.maxHP - this.game.player.hp);
        if (healAmt <= 0) return;
        this.game.player.hp += healAmt;
        this.removeItem(item.id, 1);
        this.game.ui.log(`💚 使用 ${def.name}，恢复 <span class="heal">${healAmt}</span> HP`);
        this.game.save();
        this.game.ui.render();
        this.game.ui.renderInventoryPanel();
    }

    useItemInBattle(itemId) {
        if (!this.game.inBattle) return;
        const def = CONFIG.items.consumables.find(d => d.id === itemId);
        if (!def || !def.heal) return;
        const healAmt = Math.min(def.heal, this.game.player.maxHP - this.game.player.hp);
        this.game.player.hp += healAmt;
        this.removeItem(itemId, 1);
        this.game.ui.log(`💚 使用 ${def.name}，恢复 <span class="heal">${healAmt}</span> HP`);
        this.game.ui.showDamagePopup(healAmt, true);
        document.getElementById('itemModal').classList.remove('show');
        this.game.save();
        this.game.ui.render();
        this.game.battle.enemyAttack();
    }

    smartUseItem() {
        if (!this.game.inBattle) {
            this.game.ui.log('❌ 非战斗状态！');
            return;
        }
        const missingHP = this.game.player.maxHP - this.game.player.hp;
        if (missingHP < 2) {
            this.game.ui.log('💚 无需恢复血量！');
            return;
        }
        const hpPercent = this.game.player.hp / this.game.player.maxHP;
        const consumables = this.game.inventory.items
            .filter(i => {
                const def = CONFIG.items.consumables.find(d => d.id === i.id);
                return def && def.heal;
            })
            .map(i => {
                const def = CONFIG.items.consumables.find(d => d.id === i.id);
                return { ...i, def, heal: def.heal };
            })
            .sort((a, b) => b.heal - a.heal);

        if (consumables.length === 0) {
            this.game.ui.log('❌ 没有可用的道具！');
            return;
        }

        let selectedItem = null;
        if (hpPercent < 0.3) {
            selectedItem = consumables[0];
        } else {
            for (const item of consumables) {
                if (item.heal >= missingHP * 0.5) {
                    selectedItem = item;
                    break;
                }
            }
            if (!selectedItem) {
                selectedItem = consumables[consumables.length - 1];
            }
        }

        this.useItemInBattle(selectedItem.id);
    }

    learnScroll(index) {
        const item = this.game.inventory.items[index];
        if (!item) return;
        const def = CONFIG.items.scrolls.find(d => d.id === item.id);
        if (!def || !def.skill) return;
        if (this.game.player.learnedSkills.includes(def.skill)) return;
        this.game.player.learnedSkills.push(def.skill);
        this.removeItem(item.id, 1);
        const skill = CONFIG.skills.find(s => s.id === def.skill);
        this.game.ui.log(`✨ 学会新技能：${skill.icon} ${skill.name}！`);
        this.game.save();
        this.game.ui.renderInventoryPanel();
    }

    getUnlockCost() {
        const unlocked = this.game.inventory.slots - CONFIG.inventory.initialSlots;
        return Math.floor(CONFIG.inventory.unlockCostBase * Math.pow(CONFIG.inventory.unlockCostMultiplier, unlocked));
    }

    unlockSlot() {
        if (this.game.inventory.slots >= CONFIG.inventory.maxSlots) return;
        const cost = this.getUnlockCost();
        if (this.game.player.gold < cost) {
            this.game.ui.log('❌ 金币不足！');
            return;
        }
        this.game.player.gold -= cost;
        this.game.inventory.slots++;
        this.game.ui.log(`🔓 背包扩充至 ${this.game.inventory.slots} 格！`);
        this.game.save();
        this.game.ui.render();
        this.game.ui.renderInventoryPanel();
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
        Object.entries(item.materials).forEach(([matId, count]) => {
            this.removeItem(matId, count);
        });
        if (category === 'weapons') {
            this.game.player.weapon = itemId;
        } else {
            this.game.player.armor = itemId;
        }
        this.game.ui.log(`🔨 锻造成功：${item.icon} ${item.name}！`);
        this.game.save();
        this.game.ui.render();
        this.game.ui.showForgeCategory(category);
    }
}
