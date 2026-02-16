var CONFIG = null;

async function loadConfig() {
    const res = await fetch('config.json?t=' + Date.now());
    if (!res.ok) throw new Error('配置加载失败');
    CONFIG = await res.json();
}

class Game {
    constructor() {
        this._eventListeners = {};
        this.floor = 1;
        this.killed = 0;
        this.monster = null;
        this.inBattle = false;
        this.slowEffect = 0;
        this.canAdvanceFloor = false;
        this.player = null;
        this.inventory = null;
        this.story = null;
        this.ui = new UIManager(this);
        this.battle = new BattleManager(this);
        this.playerManager = new PlayerManager(this);
        this.inventoryManager = new InventoryManager(this);
        this.storyManager = new StoryManager(this);
    }

    on(event, listener) {
        if (!this._eventListeners[event]) {
            this._eventListeners[event] = [];
        }
        this._eventListeners[event].push(listener);
    }

    off(event, listener) {
        if (!this._eventListeners[event]) return;
        this._eventListeners[event] = this._eventListeners[event].filter(l => l !== listener);
    }

    emit(event, data) {
        if (!this._eventListeners[event]) return;
        this._eventListeners[event].forEach(listener => {
            try {
                listener(data);
            } catch (e) {
                console.warn(`[Event] Error in listener for ${event}:`, e);
            }
        });
    }

    init() {
        this.load();
        this.bindEvents();
        this.ui.updateSkillName();
        this.ui.render();
        setTimeout(() => this.explore(), 300);
    }

    save() {
        const data = {
            player: this.player,
            floor: this.floor,
            killed: this.killed,
            inventory: this.inventory,
            story: this.storyManager.save()
        };
        localStorage.setItem('loopingEveSave', JSON.stringify(data));
    }

    load() {
        const saved = localStorage.getItem('loopingEveSave');
        if (saved) {
            const data = JSON.parse(saved);
            this.player = data.player;
            this.floor = data.floor;
            this.killed = data.killed;
            this.inventory = data.inventory || { slots: CONFIG.inventory.initialSlots, items: [] };
            this.playerManager.migrateOldData();
            this.storyManager.load(data.story);
            this.canAdvanceFloor = this.killed >= this.getMonstersToAdvance();
        } else {
            this.playerManager.init();
            this.inventoryManager.init();
        }
    }

    bindEvents() {
        $('btnAttack').onclick = () => this.battle.attack();
        $('btnSkill').onclick = () => this.battle.useSelectedSkill();
        $('btnItem').onclick = () => this.inventoryManager.smartUseItem();
        $('btnInventory').onclick = () => this.ui.openInventory();
        $('btnSkillList').onclick = () => this.ui.openSkillMenu();
        $('btnNextFloor').onclick = () => this.nextFloor();
        $('btnForge').onclick = () => this.ui.openForge();
        $('btnSettings').onclick = () => this.ui.openSettings();
        $('btnClear2').onclick = () => {
            $('settingsModal').classList.remove('show');
            this.ui.showConfirm('确定要重置游戏吗？所有进度将丢失！', () => this.clearSave());
        };
    }

    clearSave() {
        localStorage.removeItem('loopingEveSave');
        this.playerManager.init();
        this.inventoryManager.init();
        this.storyManager.reset();
        this.floor = 1;
        this.killed = 0;
        this.monster = null;
        this.inBattle = false;
        this.slowEffect = 0;
        this.canAdvanceFloor = false;
        $('battleLog').innerHTML = '<p>存档已清除，点击「探索」开始！</p>';
        this.ui.setButtons({ attack: true, skill: true, item: true, inventory: false, next: true });
        this.ui.updateBattleBackground(1);
        this.ui.render();
        this.ui.closeAllModals();
    }

    nextFloor() {
        const oldFloor = this.floor;
        this.floor++;
        this.killed = 0;
        this.ui.log(`📍 进入第 ${this.floor} 层！`);
        $('btnNextFloor').disabled = true;
        
        this.ui.updateBattleBackground(this.floor);
        
        const loreEvent = this.storyManager.onFloorAdvance(this.floor, oldFloor);
        if (loreEvent) {
            this.ui.showLoreModal(loreEvent.data, this.floor);
        }
        
        const npcEvent = this.storyManager.checkNPC(this.floor);
        if (npcEvent) {
            setTimeout(() => {
                this.ui.showNPCModal(npcEvent.data);
            }, loreEvent ? 2000 : 500);
        }
        
        this.emit('floorAdvance', {
            newFloor: this.floor,
            oldFloor: oldFloor,
            timeSpent: 0
        });
        this.save();
        this.ui.render();
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

    handleAutoNext() {
        const autoNext = $('autoNext').checked;
        setTimeout(() => {
            if (this.canAdvanceFloor && autoNext) {
                this.nextFloor();
                setTimeout(() => this.battle.explore(), 300);
            } else {
                this.battle.explore();
            }
        }, 500);
    }

    gameOver() {
        this.emit('playerDeath', {
            floor: this.floor,
            totalPlayTime: 0,
            kills: this.killed,
            deathCause: this.monster ? this.monster.id : 'unknown'
        });
        localStorage.removeItem('loopingEveSave');
        $('finalFloor').textContent = this.floor;
        $('finalLevel').textContent = this.player.level;
        $('finalGold').textContent = this.player.gold;
        $('gameOverModal').classList.add('show');
    }

    restart() {
        this.playerManager.init();
        this.inventoryManager.init();
        this.storyManager.reset();
        this.floor = 1;
        this.killed = 0;
        this.monster = null;
        this.inBattle = false;
        this.slowEffect = 0;
        localStorage.removeItem('loopingEveSave');
        $('gameOverModal').classList.remove('show');
        $('battleLog').innerHTML = '<p>游戏开始！</p>';
        this.ui.setButtons({ attack: true, skill: true, item: true, inventory: false, next: true });
        this.ui.updateBattleBackground(1);
        this.ui.render();
        setTimeout(() => this.explore(), 500);
    }

    explore() { this.battle.explore(); }
    attack() { this.battle.attack(); }
    useSkill(id) { this.battle.useSkill(id); }
    useFirstSkill() { this.battle.useFirstSkill(); }
    useItem(idx) { this.inventoryManager.useItem(idx); }
    useItemInBattle(id) { this.inventoryManager.useItemInBattle(id); }
    smartUseItem() { this.inventoryManager.smartUseItem(); }
    learnScroll(idx) { this.inventoryManager.learnScroll(idx); }
    unlockSlot() { this.inventoryManager.unlockSlot(); }
    openInventory() { this.ui.openInventory(); }
    openItemMenu() { this.ui.openItemMenu(); }
    openSkillMenu() { this.ui.openSkillMenu(); }
    openSkillManage() { this.ui.openSkillManage(); }
    openForge() { this.ui.openForge(); }
    showForgeCategory(cat) { this.ui.showForgeCategory(cat); }
    forgeItem(cat, id) { this.inventoryManager.forgeItem(cat, id); }
    unequipItem(cat) { this.playerManager.unequipItem(cat); this.save(); this.ui.render(); this.ui.showForgeCategory(cat); this.ui.log('📤 已卸下装备'); }
    equipSkill(id) {
        const replaced = this.playerManager.equipSkill(id);
        const skill = CONFIG.skills.find(s => s.id === id);
        if (replaced) this.ui.log(`⚠️ ${replaced} 已被替换为 ${skill.name}`);
        this.save();
        this.ui.updateSkillName();
        this.ui.openSkillManage();
    }
    unequipSkill(idx) { this.playerManager.unequipSkill(idx); this.save(); this.ui.updateSkillName(); this.ui.openSkillManage(); }
    selectSkill(id) {
        this.player.selectedSkill = id;
        this.save();
        this.ui.updateSkillName();
        this.ui.openSkillMenu();
    }
    closeLevelUpModal() { this.ui.closeLevelUpModal(); }
    closeStoryModal() { this.ui.closeStoryModal(); }
    closeNPCModal() { this.ui.closeNPCModal(); }
    closeEventModal() { this.ui.closeEventModal(); }
    buyNPCItem(npcId, itemId) {
        const npc = CONFIG.npcs.find(n => n.id === npcId);
        if (!npc) return;
        const shopItem = npc.shop.find(s => s.itemId === itemId);
        if (!shopItem) return;
        if (this.player.gold < shopItem.price) {
            this.ui.log('💰 金币不足！');
            return;
        }
        this.player.gold -= shopItem.price;
        this.inventoryManager.addItem(itemId, 1);
        this.ui.log(`💰 购买了物品！`);
        this.save();
        this.ui.render();
    }
    acceptNPCReward(npcId) {
        const npc = CONFIG.npcs.find(n => n.id === npcId);
        if (!npc) return;
        const result = this.storyManager.processNPCReward(npc);
        this.storyManager.applyReward(result);
        this.ui.closeNPCModal();
        if (result.gold > 0) this.ui.log(`💰 获得 ${result.gold} 金币`);
        if (result.exp > 0) this.ui.log(`⭐ 获得 ${result.exp} 经验`);
        if (result.items.length > 0) this.ui.log(`🎁 获得物品`);
        this.save();
        this.ui.render();
    }
    showConfirm(msg, cb) { this.ui.showConfirm(msg, cb); }
    closeConfirm() { this.ui.closeConfirm(); }
    showItemDetail(idx) { this.ui.showItemDetail(idx); }
}

let game = null;
loadConfig()
    .then(() => {
        game = new Game();
        game.init();
        setupModals();
    })
    .catch(e => {
        alert('配置加载失败：' + e.message);
    });

function setupModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                if (modal.id === 'gameOverModal') {
                    game.restart();
                } else {
                    modal.classList.remove('show');
                }
            }
        });
    });
}
