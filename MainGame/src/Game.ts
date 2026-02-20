import { $ } from './utils/dom';
import type { GameConfig, Player, Inventory, MonsterInstance, SaveData, NPC } from './types';
import { PlayerManager } from './managers/PlayerManager';
import { InventoryManager } from './managers/InventoryManager';
import { StoryManager } from './managers/StoryManager';
import { BattleManager } from './managers/BattleManager';
import { UIManager } from './managers/UIManager';

export class Game {
  config: GameConfig;
  floor: number = 1;
  killed: number = 0;
  maxFloorReached: number = 1;
  monster: MonsterInstance | null = null;
  inBattle: boolean = false;
  slowEffect: number = 0;
  canAdvanceFloor: boolean = false;
  autoBattleEnabled: boolean = true;
  autoAdvanceEnabled: boolean = false;
  autoBattleTimer: ReturnType<typeof setInterval> | null = null;
  potionStrategy: 'manual' | 'auto30' | 'auto50' | 'battleStart' = 'auto30';
  gameSpeed: number = 1;
  player!: Player;
  inventory!: Inventory;

  ui: UIManager;
  battle: BattleManager;
  playerManager: PlayerManager;
  inventoryManager: InventoryManager;
  storyManager: StoryManager;

  constructor(config: GameConfig) {
    this.config = config;
    this.ui = new UIManager(this);
    this.battle = new BattleManager(this);
    this.playerManager = new PlayerManager(this);
    this.inventoryManager = new InventoryManager(this);
    this.storyManager = new StoryManager(this);
  }

  init(): void {
    this.load();
    this.bindEvents();
    this.ui.updateSkillName();
    this.ui.render();
    this.startAutoBattle();
    setTimeout(() => this.explore(), 300);
  }

  save(): void {
    const data: SaveData = {
      player: this.player,
      floor: this.floor,
      killed: this.killed,
      maxFloorReached: this.maxFloorReached,
      gameSpeed: this.gameSpeed,
      inventory: this.inventory,
      story: this.storyManager.save()
    };
    localStorage.setItem('loopingEveSave', JSON.stringify(data));
  }

  load(): void {
    const saved = localStorage.getItem('loopingEveSave');
    if (saved) {
      const data: SaveData = JSON.parse(saved);
      this.player = data.player;
      this.floor = data.floor;
      this.killed = data.killed;
      this.maxFloorReached = data.maxFloorReached || this.floor;
      this.gameSpeed = data.gameSpeed || 1;
      this.inventory = data.inventory || { slots: this.config.inventory.initialSlots, items: [] };
      this.playerManager.migrateOldData();
      this.storyManager.load(data.story);
      this.canAdvanceFloor = this.killed >= this.getMonstersToAdvance();
    } else {
      this.playerManager.init();
      this.inventoryManager.init();
    }
  }

  bindEvents(): void {
    const btnAttack = $('btnAttack');
    const btnSkill = $('btnSkill');
    const btnItem = $('btnItem');
    const btnNextFloor = $('btnNextFloor');
    const btnSettings = $('btnSettings');
    const btnClear2 = $('btnClear2');
    const potionStrategySelect = $('potionStrategy') as HTMLSelectElement;
    const floorSelectBtn = $('floorSelectBtn');
    const speedBtn = $('speedBtn');

    if (btnAttack) btnAttack.onclick = () => this.battle.attack();
    if (btnSkill) btnSkill.onclick = () => this.battle.useSelectedSkill();
    if (btnItem) btnItem.onclick = () => this.inventoryManager.smartUseItem();
    if (btnNextFloor) btnNextFloor.onclick = () => this.nextFloor();
    if (btnSettings) btnSettings.onclick = () => this.ui.openSettings();
    
    if (floorSelectBtn) {
      floorSelectBtn.onclick = () => this.ui.openFloorSelect();
    }
    
    if (speedBtn) {
      speedBtn.onclick = () => this.cycleSpeed();
    }
    
    if (potionStrategySelect) {
      potionStrategySelect.value = this.potionStrategy;
      potionStrategySelect.onchange = () => {
        this.potionStrategy = potionStrategySelect.value as typeof this.potionStrategy;
      };
    }
    
    if (btnClear2)
      btnClear2.onclick = () => {
        const settingsModal = $('settingsModal');
        if (settingsModal) settingsModal.classList.remove('show');
        this.ui.showConfirm('确定要重置游戏吗？所有进度将丢失！', () => this.clearSave());
      };
  }

  clearSave(): void {
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
    const battleLog = $('battleLog');
    if (battleLog) battleLog.innerHTML = '<p>存档已清除，点击「探索」开始！</p>';
    this.ui.setButtons({ attack: true, skill: true, item: true, inventory: false, next: true });
    this.ui.updateBattleBackground(1);
    this.ui.render();
    this.ui.closeAllModals();
  }

  nextFloor(skipLore: boolean = false): void {
    const oldFloor = this.floor;
    this.floor++;
    this.killed = 0;
    this.maxFloorReached = Math.max(this.maxFloorReached, this.floor);
    this.ui.log(`📍 进入第 ${this.floor} 层！`);
    const btnNextFloor = $<HTMLButtonElement>('btnNextFloor');
    if (btnNextFloor) btnNextFloor.disabled = true;

    this.ui.updateBattleBackground(this.floor);

    if (!skipLore) {
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
    }

    this.save();
    this.ui.render();
  }

  getMonstersToAdvance(): number {
    const base = this.config.floor.monstersToAdvance;
    const max = this.config.floor.maxMonsters || 10;
    const floor = this.floor;
    if (floor <= 5) return base;
    if (floor <= 10) return Math.min(base + 1, max);
    if (floor <= 20) return Math.min(base + 2, max);
    return Math.min(base + 3, max);
  }

  handleAutoNext(): void {
    const autoNextEl = $('autoNext') as HTMLInputElement;
    const autoNext = autoNextEl?.checked ?? false;
    setTimeout(() => {
      if (this.canAdvanceFloor && autoNext) {
        this.nextFloor(true);
        setTimeout(() => this.battle.explore(), 300);
      } else {
        this.battle.explore();
      }
    }, 500);
  }

  gameOver(): void {
    this.stopAutoBattle();
    this.stopAutoAdvance();
    
    this.floor = Math.max(1, this.floor - 1);
    this.killed = 0;
    this.player.hp = this.player.maxHP;
    this.player.shield = 0;
    
    this.ui.log(`💀 你被击败了！回退到第 ${this.floor} 层...`);
    this.ui.updateBattleBackground(this.floor);
    
    this.canAdvanceFloor = false;
    this.inBattle = false;
    this.monster = null;
    
    this.save();
    this.ui.render();
    
    setTimeout(() => {
      this.startAutoBattle();
      this.battle.explore();
    }, 1000);
  }

  restart(): void {
    this.playerManager.init();
    this.inventoryManager.init();
    this.storyManager.reset();
    this.floor = 1;
    this.killed = 0;
    this.monster = null;
    this.inBattle = false;
    this.slowEffect = 0;
    localStorage.removeItem('loopingEveSave');
    const gameOverModal = $('gameOverModal');
    const battleLog = $('battleLog');
    if (gameOverModal) gameOverModal.classList.remove('show');
    if (battleLog) battleLog.innerHTML = '<p>游戏开始！</p>';
    this.ui.setButtons({ attack: true, skill: true, item: true, inventory: false, next: true });
    this.ui.updateBattleBackground(1);
    this.ui.render();
    setTimeout(() => this.explore(), 500);
  }

  explore(): void {
    this.battle.explore();
  }
  attack(): void {
    this.battle.attack();
  }

  startAutoBattle(): void {
    if (this.autoBattleTimer) return;
    this.autoBattleEnabled = true;
    this.runAutoBattleLoop();
  }

  stopAutoBattle(): void {
    this.autoBattleEnabled = false;
    if (this.autoBattleTimer) {
      clearTimeout(this.autoBattleTimer);
      this.autoBattleTimer = null;
    }
  }

  stopAutoAdvance(): void {
    this.autoAdvanceEnabled = false;
    const autoAdvanceEl = document.getElementById('autoAdvance') as HTMLInputElement;
    if (autoAdvanceEl) autoAdvanceEl.checked = false;
  }

  private runAutoBattleLoop(): void {
    if (!this.autoBattleEnabled) return;

    const baseInterval = this.config.battle.autoBattleInterval || 1000;
    const interval = baseInterval / this.gameSpeed;

    this.autoBattleTimer = setTimeout(() => {
      if (!this.autoBattleEnabled) return;

      try {
        if (this.inBattle && this.monster && this.player) {
          const skillId = this.player.selectedSkill || 'powerStrike';
          const skillCD = this.player.skillCooldowns[skillId] ?? 0;
          
          if (this.shouldAutoUsePotion()) {
            this.inventoryManager.smartUseItem();
            this.ui.flashSlot('item');
          } else if (skillCD === 0) {
            this.battle.useSelectedSkill();
          } else {
            this.battle.attack();
          }
        } else if (!this.inBattle) {
          this.battle.explore();
        }
      } catch (e) {
        console.warn('Auto battle error:', e);
      }

      this.runAutoBattleLoop();
    }, interval);
  }

  cycleSpeed(): void {
    const speeds = [1, 2, 3];
    const currentIndex = speeds.indexOf(this.gameSpeed);
    this.gameSpeed = speeds[(currentIndex + 1) % speeds.length];
    this.ui.updateSpeedDisplay();
  }

  goToFloor(targetFloor: number): void {
    if (targetFloor > this.maxFloorReached) return;
    if (targetFloor === this.floor) return;
    
    this.floor = targetFloor;
    this.killed = 0;
    this.monster = null;
    this.inBattle = false;
    this.canAdvanceFloor = false;
    this.save();
    this.ui.render();
    this.ui.updateFloorSelectText();
  }

  shouldAutoUsePotion(): boolean {
    if (this.potionStrategy === 'manual') return false;
    
    const hasPotion = this.inventory.items.some((i: { id: string }) => i.id === 'healthPotion');
    if (!hasPotion) return false;
    
    if (this.potionStrategy === 'auto30') {
      return this.player.hp < this.player.maxHP * 0.3;
    } else if (this.potionStrategy === 'auto50') {
      return this.player.hp < this.player.maxHP * 0.5;
    } else if (this.potionStrategy === 'battleStart') {
      return this.player.hp < this.player.maxHP * 0.9;
    }
    return false;
  }

  useSkill(id: string): void {
    this.battle.useSkill(id);
  }
  useFirstSkill(): void {
    this.battle.useSelectedSkill();
  }
  useItem(idx: number): void {
    this.inventoryManager.useItem(idx);
  }
  useItemInBattle(id: string): void {
    this.inventoryManager.useItemInBattle(id);
  }
  smartUseItem(): void {
    this.inventoryManager.smartUseItem();
  }
  learnScroll(idx: number): void {
    this.inventoryManager.learnScroll(idx);
  }
  unlockSlot(): void {
    this.inventoryManager.unlockSlot();
  }
  openInventory(): void {
    this.ui.openInventory();
  }
  openItemMenu(): void {
    this.ui.openItemMenu();
  }
  openSkillMenu(): void {
    this.ui.openSkillMenu();
  }
  openSkillManage(): void {
    this.ui.openSkillManage();
  }
  openForge(): void {
    this.ui.openForge();
  }
  showForgeCategory(cat: 'weapons' | 'armors'): void {
    this.ui.showForgeCategory(cat);
  }
  forgeItem(cat: 'weapons' | 'armors', id: string): void {
    this.inventoryManager.forgeItem(cat, id);
  }
  unequipItem(cat: 'weapons' | 'armors'): void {
    this.playerManager.unequipItem(cat);
    this.save();
    this.ui.render();
    this.ui.showForgeCategory(cat);
    this.ui.log('📤 已卸下装备');
  }
  equipSkill(id: string): void {
    const replaced = this.playerManager.equipSkill(id);
    const skill = this.config.skills.find(s => s.id === id);
    if (replaced && skill) this.ui.log(`⚠️ ${replaced} 已被替换为 ${skill.name}`);
    this.save();
    this.ui.updateSkillName();
    this.ui.openSkillManage();
  }
  unequipSkill(idx: number): void {
    this.playerManager.unequipSkill(idx);
    this.save();
    this.ui.updateSkillName();
    this.ui.openSkillManage();
  }
  selectSkill(id: string): void {
    this.player.selectedSkill = id;
    this.save();
    this.ui.updateSkillName();
    this.ui.openSkillMenu();
  }
  closeLevelUpModal(): void {
    this.ui.closeLevelUpModal();
  }
  closeStoryModal(): void {
    this.ui.closeStoryModal();
  }
  closeNPCModal(): void {
    this.ui.closeNPCModal();
  }
  closeEventModal(): void {
    this.ui.closeEventModal();
  }
  buyNPCItem(npcId: string, itemId: string): void {
    const npc = this.config.npcs.find((n: NPC) => n.id === npcId);
    if (!npc || !npc.shop) return;
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
  acceptNPCReward(npcId: string): void {
    const npc = this.config.npcs.find((n: NPC) => n.id === npcId);
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
  showConfirm(msg: string, cb: () => void): void {
    this.ui.showConfirm(msg, cb);
  }
  closeConfirm(): void {
    this.ui.closeConfirm();
  }
  showItemDetail(idx: number): void {
    this.ui.showItemDetail(idx);
  }
}

declare global {
  interface Window {
    game: Game;
  }
}
