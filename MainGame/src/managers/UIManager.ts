import { $ } from '../utils/dom';
import type { Game } from '../Game';
import type {
  WorldLore,
  NPC,
  RandomEvent,
  Skill,
  ConsumableItem,
  ScrollItem,
  Weapon,
  Armor
} from '../types';

interface RewardResult {
  gold: number;
  exp: number;
  items: { itemId: string; count: number }[];
  heal: number;
  lore: string | null;
}

interface ButtonState {
  attack: boolean;
  skill: boolean;
  item: boolean;
  inventory: boolean;
  next: boolean;
}

export class UIManager {
  private game: Game;

  constructor(game: Game) {
    this.game = game;
  }

  log(msg: string): void {
    const log = $('battleLog');
    if (!log) return;
    const p = document.createElement('p');
    p.innerHTML = msg;
    log.appendChild(p);
    log.scrollTop = log.scrollHeight;
    const firstChild = log.firstChild;
    if (log.children.length > 15 && firstChild) {
      log.removeChild(firstChild);
    }
  }

  flash(sel: string): void {
    const el = document.querySelector(sel);
    if (!el) return;
    el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 300);
  }

  flashSlot(slotType: 'attack' | 'skill' | 'item'): void {
    const slotMap = {
      attack: 'attackSlot',
      skill: 'skillSlot',
      item: 'itemSlot'
    };
    const slotEl = $(slotMap[slotType]);
    if (!slotEl) return;
    slotEl.classList.add('active');
    setTimeout(() => slotEl.classList.remove('active'), 200);
  }

  updateSpeedDisplay(): void {
    const speedText = $('speedText');
    if (speedText) speedText.textContent = `${this.game.gameSpeed}X`;
  }

  updateFloorSelectText(): void {
    const floorSelectText = $('floorSelectText');
    if (floorSelectText) floorSelectText.textContent = `第${this.game.floor}层`;
  }

  openFloorSelect(): void {
    const floorList = $('floorList');
    const modal = $('floorSelectModal');
    if (!floorList || !modal) return;
    
    let html = '';
    for (let f = 1; f <= this.game.maxFloorReached; f++) {
      const isBoss = this.game.battle.isBossFloor(f);
      const isCurrent = f === this.game.floor;
      const classes = ['floor-item'];
      if (isBoss) classes.push('boss');
      if (isCurrent) classes.push('current');
      
      html += `<div class="${classes.join(' ')}" data-floor="${f}">
        <span class="num">${f}</span>
        <span class="icon">${isBoss ? '👑' : ''}</span>
      </div>`;
    }
    
    floorList.innerHTML = html;
    
    floorList.querySelectorAll('.floor-item').forEach(el => {
      el.addEventListener('click', () => {
        const floor = parseInt(el.getAttribute('data-floor') || '1');
        this.game.goToFloor(floor);
        modal.classList.remove('show');
      });
    });
    
    modal.classList.add('show');
  }

  showSkillEffect(skill: Skill): void {
    const overlay = $('skillEffectOverlay');
    if (!overlay) return;
    
    overlay.setAttribute('data-icon', skill.icon);
    overlay.className = 'skill-effect-overlay';
    
    const effectMap: Record<string, string> = {
      'powerStrike': 'effect-power',
      'fireball': 'effect-fire',
      'frostArrow': 'effect-frost',
      'thunderStrike': 'effect-thunder',
      'lifeSteal': 'effect-power',
      'heal': 'effect-heal'
    };
    
    const effectClass = effectMap[skill.id] || 'effect-power';
    void overlay.offsetWidth;
    overlay.classList.add('active', effectClass);
    
    setTimeout(() => {
      overlay.classList.remove('active', effectClass);
    }, 600);
  }

  updateSlotStates(): void {
    const skillSlot = $('skillSlot');
    const itemSlot = $('itemSlot');
    const itemSlotCount = $('itemSlotCount');
    const skillCdOverlay = $('skillCdOverlay');
    const skillCdProgress = $('skillCdProgress');
    const skillCdText = $('skillCdText');

    const selectedSkill = this.game.player.selectedSkill || 'powerStrike';
    const skillCD = this.game.player.skillCooldowns[selectedSkill] ?? 0;
    const skillDef = this.game.config.skills.find((s: Skill) => s.id === selectedSkill);
    const maxCD = skillDef?.cd || 3;
    
    if (skillSlot) {
      if (skillCD > 0) {
        if (skillCdOverlay) {
          skillCdOverlay.classList.add('visible');
          if (skillCdProgress) {
            const remaining = skillCD / maxCD;
            const circumference = 100.53;
            skillCdProgress.style.strokeDashoffset = String(circumference * remaining);
          }
          if (skillCdText) {
            skillCdText.textContent = String(skillCD);
          }
        }
      } else {
        if (skillCdOverlay) skillCdOverlay.classList.remove('visible');
      }
    }

    const potionCount = this.game.inventory.items.filter(
      (i: { id: string }) => i.id === 'healthPotion'
    ).length;
    if (itemSlotCount) {
      itemSlotCount.textContent = String(potionCount);
    }
    if (itemSlot) {
      if (potionCount === 0) {
        itemSlot.classList.add('disabled');
      } else {
        itemSlot.classList.remove('disabled');
      }
    }
  }

  showDamagePopup(
    value: number,
    isHeal: boolean,
    isDodge: boolean = false,
    isCritical: boolean = false,
    isCombo: boolean = false,
    isBlock: boolean = false
  ): void {
    const popup = document.createElement('div');
    let className = 'damage-popup';
    if (isHeal) className += ' heal-popup';
    if (isDodge) className += ' dodge-popup';
    if (isCritical) className += ' critical-popup';
    if (isCombo) className += ' combo-popup';
    if (isBlock) className += ' block-popup';
    popup.className = className;

    if (isDodge) {
      popup.textContent = 'MISS';
    } else if (isBlock) {
      popup.textContent = '🛡️';
    } else {
      let prefix = isHeal ? '+' : '-';
      let suffix = '';
      if (isCritical) suffix = '!';
      if (isCombo) suffix += '⚡';
      popup.textContent = prefix + value + suffix;
    }

    const monsterCard = document.querySelector('.monster-card');
    if (monsterCard) {
      const rect = monsterCard.getBoundingClientRect();
      popup.style.left = rect.left + rect.width / 2 - 20 + Math.random() * 40 + 'px';
      popup.style.top = rect.top + rect.height / 3 + 'px';
    }
    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 800);
  }

  showPlayerDamagePopup(value: number, isBlock: boolean = false): void {
    const popup = document.createElement('div');
    let className = 'damage-popup player-damage';
    if (isBlock) className += ' block-popup';
    popup.className = className;

    if (isBlock) {
      popup.textContent = `-${value}🛡️`;
    } else {
      popup.textContent = `-${value}`;
    }

    const statusBar = document.querySelector('.status-bar');
    if (statusBar) {
      const rect = statusBar.getBoundingClientRect();
      popup.style.left = rect.left + 20 + Math.random() * 30 + 'px';
      popup.style.top = rect.top + rect.height / 2 + 'px';
    }
    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 800);
  }

  render(): void {
    const p = this.game.player;
    const playerLevel = $('playerLevel');
    const playerHP = $('playerHP');
    const playerMaxHP = $('playerMaxHP');
    const playerATK = $('playerATK');
    const playerDEF = $('playerDEF');
    const playerEXP = $('playerEXP');
    const playerMaxEXP = $('playerMaxEXP');
    const playerGold = $('playerGold');
    const currentFloor = $('currentFloor');
    const hpFill = $('hpFill');
    const expBar = $('expBar');
    const shieldFill = $('shieldFill');
    const playerShield = $('playerShield');

    if (playerLevel) playerLevel.textContent = String(p.level);
    if (playerHP) playerHP.textContent = String(p.hp);
    if (playerMaxHP) playerMaxHP.textContent = String(p.maxHP);
    if (playerATK) playerATK.textContent = String(this.game.playerManager.getTotalAtk());
    if (playerDEF) playerDEF.textContent = String(this.game.playerManager.getTotalDef());
    if (playerEXP) playerEXP.textContent = String(p.exp);
    if (playerMaxEXP) playerMaxEXP.textContent = String(p.maxEXP);
    if (playerGold) playerGold.textContent = String(this.game.player.gold);
    if (currentFloor) currentFloor.textContent = String(this.game.floor);

    const bossIcon = $('bossIcon');
    const isBoss = this.game.battle.isBossFloor(this.game.floor);
    if (bossIcon) {
      bossIcon.style.display = isBoss ? 'inline' : 'none';
    }
    
    this.updateFloorSelectText();
    this.updateSpeedDisplay();

    const hpPercent = Math.max(0, (p.hp / p.maxHP) * 100);
    const expPercent = Math.max(0, (p.exp / p.maxEXP) * 100);
    if (hpFill) (hpFill as HTMLElement).style.width = `${hpPercent}%`;
    if (expBar) (expBar as HTMLElement).style.width = `${expPercent}%`;

    const maxShield = this.game.playerManager.getTotalMaxShield();
    if (shieldFill && maxShield > 0) {
      const shieldPercent = Math.max(0, (p.shield / maxShield) * 100);
      (shieldFill as HTMLElement).style.width = `${shieldPercent}%`;
      (shieldFill as HTMLElement).parentElement!.style.display = 'block';
    } else if (shieldFill) {
      (shieldFill as HTMLElement).parentElement!.style.display = 'none';
    }
    if (playerShield) {
      playerShield.textContent = maxShield > 0 ? `${p.shield}/${maxShield}` : '';
    }

    this.renderSecondaryStats();
    this.updateSlotStates();
    this.renderKillProgress();
    this.renderEquipment();
  }

  renderSecondaryStats(): void {
    const comboRate = $('comboRate');
    const counterRate = $('counterRate');
    const blockRate = $('blockRate');
    const secondaryStats = $('secondaryStats');

    const totalCombo = this.game.playerManager.getTotalComboRate();
    const totalCounter = this.game.playerManager.getTotalCounterRate();
    const totalBlock = this.game.playerManager.getTotalBlockRate();

    if (comboRate) comboRate.textContent = `${Math.round(totalCombo * 100)}%`;
    if (counterRate) counterRate.textContent = `${Math.round(totalCounter * 100)}%`;
    if (blockRate) blockRate.textContent = `${Math.round(totalBlock * 100)}%`;

    const hasSecondaryStats = totalCombo > 0 || totalCounter > 0 || totalBlock > 0;
    if (secondaryStats) {
      (secondaryStats as HTMLElement).style.display = hasSecondaryStats ? 'flex' : 'none';
    }
  }

  renderKillProgress(): void {
    const target = this.game.getMonstersToAdvance();
    const displayKilled = Math.min(this.game.killed, target);
    const progressEl = $('killProgress');
    if (!progressEl) return;
    
    const isBoss = this.game.battle.isBossFloor(this.game.floor);
    if (isBoss) {
      progressEl.textContent = '';
      progressEl.classList.remove('complete');
    } else {
      progressEl.textContent = `${displayKilled}/${target}`;
      if (this.game.killed >= target) {
        progressEl.classList.add('complete');
      } else {
        progressEl.classList.remove('complete');
      }
    }
  }

  renderEquipment(): void {
    const weaponEl = $('playerWeapon');
    const armorEl = $('playerArmor');
    if (this.game.player.weapon) {
      const w = this.game.config.equipment.weapons.find((we: Weapon) => we.id === this.game.player.weapon);
      if (weaponEl) weaponEl.textContent = w ? w.name : '无';
    } else {
      if (weaponEl) weaponEl.textContent = '无';
    }
    if (this.game.player.armor) {
      const a = this.game.config.equipment.armors.find((ar: Armor) => ar.id === this.game.player.armor);
      if (armorEl) armorEl.textContent = a ? a.name : '无';
    } else {
      if (armorEl) armorEl.textContent = '无';
    }
  }

  renderMonster(): void {
    if (!this.game.monster) return;
    const monsterAvatar = $('monsterAvatar');
    const monsterName = $('monsterName');
    const monsterHP = $('monsterHP');
    const monsterMaxHP = $('monsterMaxHP');
    const monsterHPFill = $('monsterHPFill');
    const monsterCard = document.querySelector('.monster-card');

    const isBoss = this.game.battle.isBossFloor(this.game.floor);
    
    if (monsterCard) {
      if (isBoss) {
        monsterCard.classList.add('boss-monster');
      } else {
        monsterCard.classList.remove('boss-monster');
      }
    }

    if (monsterAvatar) monsterAvatar.textContent = this.game.monster.avatar;
    if (monsterName) {
      monsterName.textContent = isBoss ? `👑 ${this.game.monster.name}` : this.game.monster.name;
      if (isBoss) {
        monsterName.classList.add('boss-name');
      } else {
        monsterName.classList.remove('boss-name');
      }
    }
    if (monsterHP) monsterHP.textContent = String(Math.max(0, this.game.monster.hp));
    if (monsterMaxHP) monsterMaxHP.textContent = String(this.game.monster.maxHP);
    if (monsterHPFill) {
      (monsterHPFill as HTMLElement).style.width = `${Math.max(0, (this.game.monster.hp / this.game.monster.maxHP) * 100)}%`;
      if (isBoss) {
        monsterHPFill.classList.add('boss-hp');
      } else {
        monsterHPFill.classList.remove('boss-hp');
      }
    }
  }

  setButtons({ attack, skill, item, next }: ButtonState): void {
    const btnAttack = $<HTMLButtonElement>('btnAttack');
    const btnSkill = $<HTMLButtonElement>('btnSkill');
    const btnItem = $<HTMLButtonElement>('btnItem');
    const btnNextFloor = $<HTMLButtonElement>('btnNextFloor');

    if (btnAttack) btnAttack.disabled = attack;
    if (btnSkill) btnSkill.disabled = skill;
    if (btnItem) btnItem.disabled = item;
    if (btnNextFloor) {
      const shouldDisableNext = next && !this.game.canAdvanceFloor;
      btnNextFloor.disabled = shouldDisableNext;
      if (this.game.canAdvanceFloor && !next) {
        btnNextFloor.classList.add('can-advance');
      } else {
        btnNextFloor.classList.remove('can-advance');
      }
    }
  }

  updatePostBattleUI(): void {
    this.game.canAdvanceFloor = this.game.killed >= this.game.getMonstersToAdvance();
    this.setButtons({
      attack: true,
      skill: true,
      item: true,
      inventory: false,
      next: !this.game.canAdvanceFloor
    });
  }

  updateSkillName(): void {
    const skillId = this.game.player.selectedSkill || this.game.player.learnedSkills[0];
    const btn = $<HTMLButtonElement>('btnSkill');
    const currentSkillName = $('currentSkillName');
    const skillSlotLabel = $('skillSlotLabel');
    const skillSlotIcon = $('skillSlotIcon');

    if (skillId) {
      const skill = this.game.config.skills.find((s: Skill) => s.id === skillId);
      if (skill) {
        if (skillSlotLabel) skillSlotLabel.textContent = skill.name;
        if (skillSlotIcon) skillSlotIcon.textContent = skill.icon;
        
        const cd = this.game.player.skillCooldowns[skillId] || 0;
        if (btn && currentSkillName) {
          if (cd > 0) {
            currentSkillName.textContent = `${skill.name} (CD:${cd})`;
            btn.classList.add('on-cooldown');
          } else {
            currentSkillName.textContent = skill.name;
            btn.classList.remove('on-cooldown');
          }
        }
        return;
      }
    }
    if (skillSlotLabel) skillSlotLabel.textContent = '无技能';
    if (skillSlotIcon) skillSlotIcon.textContent = '✨';
    if (btn && currentSkillName) {
      currentSkillName.textContent = '无技能';
      btn.classList.remove('on-cooldown');
    }
  }

  showLevelUp(level: number, cfg: { hp: number; atk: number; def: number }): void {
    const newLevel = $('newLevel');
    const levelUpHP = $('levelUpHP');
    const levelUpATK = $('levelUpATK');
    const levelUpDEF = $('levelUpDEF');
    const levelUpModal = $('levelUpModal');

    if (newLevel) newLevel.textContent = String(level);
    if (levelUpHP) levelUpHP.textContent = `+${cfg.hp}`;
    if (levelUpATK) levelUpATK.textContent = `+${cfg.atk}`;
    if (levelUpDEF) levelUpDEF.textContent = `+${cfg.def}`;
    if (levelUpModal) levelUpModal.classList.add('show');
  }

  closeLevelUpModal(): void {
    const levelUpModal = $('levelUpModal');
    if (levelUpModal) levelUpModal.classList.remove('show');
  }

  openInventory(): void {
    this.renderInventoryPanel();
    const inventoryModal = $('inventoryModal');
    if (inventoryModal) inventoryModal.classList.add('show');
  }

  renderInventoryPanel(): void {
    const allItems = [
      ...this.game.config.items.consumables,
      ...this.game.config.items.materials,
      ...this.game.config.items.scrolls
    ];
    let html = `<div class="inventory-header">
      <span>🎒 背包 (${this.game.inventory.items.length}/${this.game.inventory.slots})</span>`;
    if (this.game.inventory.slots < this.game.config.inventory.maxSlots) {
      const cost = this.game.inventoryManager.getUnlockCost();
      html += `<button class="btn-unlock" onclick="game.unlockSlot()">🔓 扩充 (${cost}💰)</button>`;
    }
    html += '</div><div class="inventory-grid">';
    this.game.inventory.items.forEach((item, idx) => {
      const def = allItems.find(d => d.id === item.id);
      if (!def) return;
      html += `<div class="inv-item" onclick="game.showItemDetail(${idx})">
        <span class="inv-icon">${def.icon}</span>
        <span class="inv-name">${def.name}</span>
        <span class="inv-count">x${item.count}</span>
      </div>`;
    });
    if (this.game.inventory.items.length === 0) {
      html += '<p class="empty-inv">背包空空如也</p>';
    }
    html += '</div>';
    const inventoryContent = $('inventoryContent');
    if (inventoryContent) inventoryContent.innerHTML = html;
  }

  showItemDetail(index: number): void {
    const item = this.game.inventory.items[index];
    if (!item) return;
    const allItems = [
      ...this.game.config.items.consumables,
      ...this.game.config.items.materials,
      ...this.game.config.items.scrolls
    ];
    const def = allItems.find(d => d.id === item.id);
    if (!def) return;
    let html = `<div class="item-detail">
      <h3>${def.icon} ${def.name} x${item.count}</h3>`;
    const consumableDef = def as ConsumableItem;
    const scrollDef = def as ScrollItem;
    if (consumableDef.heal) {
      html += `<p>恢复 ${consumableDef.heal} HP</p>`;
      if (!this.game.inBattle && this.game.player.hp < this.game.player.maxHP) {
        html += `<button class="btn btn-use" onclick="game.useItem(${index})">使用</button>`;
      } else if (this.game.inBattle) {
        html += `<p class="hint">战斗中无法使用</p>`;
      } else {
        html += `<p class="hint">生命已满</p>`;
      }
    } else if (scrollDef.skill) {
      const skill = this.game.config.skills.find((s: Skill) => s.id === scrollDef.skill);
      if (skill && this.game.player.learnedSkills.includes(scrollDef.skill)) {
        html += `<p class="hint">已学会 ${skill.name}</p>`;
      } else if (skill) {
        html += `<p>学习技能：${skill.icon} ${skill.name}</p>`;
        html += `<button class="btn btn-use" onclick="game.learnScroll(${index})">学习</button>`;
      }
    } else {
      html += `<p class="hint">锻造材料</p>`;
    }
    html += '</div>';
    const inventoryContent = $('inventoryContent');
    if (inventoryContent) inventoryContent.innerHTML = html;
  }

  openItemMenu(): void {
    if (!this.game.inBattle) return;
    const consumables = this.game.inventory.items.filter(i => {
      const def = this.game.config.items.consumables.find((d: ConsumableItem) => d.id === i.id);
      return def && def.heal;
    });
    let html = '';
    if (consumables.length === 0) {
      html = '<p class="no-items">没有可使用的道具</p>';
    } else {
      html = '<div class="item-options">';
      consumables.forEach(item => {
        const def = this.game.config.items.consumables.find((d: ConsumableItem) => d.id === item.id);
        if (def) {
          html += `<div class="item-option" onclick="game.useItemInBattle('${item.id}')">
            <span class="item-icon">${def.icon}</span>
            <span class="item-name">${def.name}</span>
            <span class="item-count">x${item.count}</span>
            <span class="item-effect">+${def.heal} HP</span>
          </div>`;
        }
      });
      html += '</div>';
    }
    const itemList = $('itemList');
    const itemModal = $('itemModal');
    if (itemList) itemList.innerHTML = html;
    if (itemModal) itemModal.classList.add('show');
  }

  openSkillMenu(): void {
    const learned = this.game.player.learnedSkills;
    const selectedSkillId = this.game.player.selectedSkill || learned[0];
    let html = '<div class="skill-select-list">';
    learned.forEach(skillId => {
      const skill = this.game.config.skills.find((s: Skill) => s.id === skillId);
      if (!skill) return;
      const cd = this.game.player.skillCooldowns[skillId] || 0;
      const isSelected = skillId === selectedSkillId;
      html += `<div class="skill-select-item ${isSelected ? 'selected' : ''}">
        <span class="skill-info">${skill.icon} ${skill.name}${cd > 0 ? ` (${cd})` : ''}</span>
        <button class="btn-small ${isSelected ? 'btn-selected' : ''}" onclick="game.selectSkill('${skillId}')">${isSelected ? '已选' : '选择'}</button>
      </div>`;
    });
    html += '</div>';
    if (learned.length === 0) {
      html = '<p style="color:#a0a0a0;text-align:center;">还没有学会技能</p>';
    }
    const skillMenuContent = $('skillMenuContent');
    const skillModal = $('skillModal');
    if (skillMenuContent) skillMenuContent.innerHTML = html;
    if (skillModal) skillModal.classList.add('show');
  }

  openSkillManage(): void {
    const skillModal = $('skillModal');
    if (skillModal) skillModal.classList.remove('show');
    const learned = this.game.player.learnedSkills;
    const equipped = this.game.player.equippedSkills;
    const unlocked = this.game.playerManager.getUnlockedSkillSlots();
    let html = `<p class="slot-info">已解锁 ${unlocked} 个技能槽</p>`;
    html += '<div class="skill-manage-grid">';
    for (let i = 0; i < 4; i++) {
      const isUnlocked = i < unlocked;
      const equippedId = equipped[i];
      const skill = equippedId ? this.game.config.skills.find((s: Skill) => s.id === equippedId) : null;
      html += `<div class="skill-slot ${isUnlocked ? '' : 'locked'}">`;
      if (isUnlocked) {
        if (skill) {
          html += `<span>${skill.icon} ${skill.name}</span>`;
          html += `<button class="btn-small" onclick="game.unequipSkill(${i})">卸下</button>`;
        } else {
          html += `<span class="empty">空槽位</span>`;
        }
      } else {
        const unlockLevel = this.game.config.player.skillSlots[i];
        html += `<span class="locked">🔒 Lv${unlockLevel}解锁</span>`;
      }
      html += '</div>';
    }
    html += '</div>';
    html += '<h4 style="margin: 12px 0 8px; color: var(--accent);">已学技能</h4><div class="learned-skills">';
    learned.forEach(skillId => {
      if (equipped.includes(skillId)) return;
      const skill = this.game.config.skills.find((s: Skill) => s.id === skillId);
      if (!skill) return;
      html += `<div class="skill-item">
        <span>${skill.icon} ${skill.name}</span>
        <button class="btn-small" onclick="game.equipSkill('${skillId}')">装备</button>
      </div>`;
    });
    html += '</div>';
    const skillManageContent = $('skillManageContent');
    const skillManageModal = $('skillManageModal');
    if (skillManageContent) skillManageContent.innerHTML = html;
    if (skillManageModal) skillManageModal.classList.add('show');
  }

  openForge(): void {
    this.renderForgePanel();
    const forgeModal = $('forgeModal');
    if (forgeModal) forgeModal.classList.add('show');
  }

  renderForgePanel(): void {
    let html = '<div class="forge-tabs">';
    html += '<button class="tab-btn active" onclick="game.showForgeCategory(\'weapons\')">⚔️ 武器</button>';
    html += '<button class="tab-btn" onclick="game.showForgeCategory(\'armors\')">🛡️ 甲胄</button>';
    html += '</div>';
    html += '<div id="forgeList"></div>';
    const forgeContent = $('forgeContent');
    if (forgeContent) forgeContent.innerHTML = html;
    this.showForgeCategory('weapons');
  }

  showForgeCategory(category: 'weapons' | 'armors'): void {
    document.querySelectorAll('.forge-tabs .tab-btn').forEach((btn, idx) => {
      btn.classList.toggle('active', (category === 'weapons' && idx === 0) || (category === 'armors' && idx === 1));
    });
    const items = this.game.config.equipment[category];
    const currentEquip = category === 'weapons' ? this.game.player.weapon : this.game.player.armor;
    let html = '<div class="forge-list">';
    items.forEach((item: Weapon | Armor) => {
      const isEquipped = currentEquip === item.id;
      const canForge = this.game.inventoryManager.canForge(item);
      html += `<div class="forge-item ${isEquipped ? 'equipped' : ''}">`;
      html += `<div class="forge-info">
        <span class="forge-icon">${item.icon}</span>
        <span class="forge-name">${item.name}</span>
        <span class="forge-stat">${category === 'weapons' ? `ATK+${(item as Weapon).atk}` : `DEF+${(item as Armor).def}`}</span>
        ${isEquipped ? '<span class="equipped-badge">已装备</span>' : ''}
      </div>`;
      html += '<div class="forge-mats">';
      Object.entries(item.materials).forEach(([matId, count]) => {
        const mat = this.game.config.items.materials.find(m => m.id === matId);
        const have = this.game.inventoryManager.getItemCount(matId);
        const enough = have >= count;
        html += `<span class="mat ${enough ? '' : 'lack'}">${mat ? mat.icon : '?'} ${have}/${count}</span>`;
      });
      html += '</div>';
      if (isEquipped) {
        html += `<button class="btn btn-unequip" onclick="game.unequipItem('${category}')">卸下</button>`;
      } else if (canForge) {
        html += `<button class="btn btn-forge" onclick="game.forgeItem('${category}', '${item.id}')">锻造</button>`;
      } else {
        html += `<button class="btn btn-forge disabled" disabled>材料不足</button>`;
      }
      html += '</div>';
    });
    html += '</div>';
    const forgeList = $('forgeList');
    if (forgeList) forgeList.innerHTML = html;
  }

  showConfirm(message: string, onConfirm: () => void): void {
    const confirmMessage = $('confirmMessage');
    const confirmBtn = $<HTMLButtonElement>('confirmBtn');
    const confirmModal = $('confirmModal');
    if (confirmMessage) confirmMessage.textContent = message;
    if (confirmBtn) {
      confirmBtn.onclick = () => {
        this.closeConfirm();
        onConfirm();
      };
    }
    if (confirmModal) confirmModal.classList.add('show');
  }

  closeConfirm(): void {
    const confirmModal = $('confirmModal');
    if (confirmModal) confirmModal.classList.remove('show');
  }

  openSettings(): void {
    const settingsModal = $('settingsModal');
    if (settingsModal) settingsModal.classList.add('show');
  }

  closeAllModals(): void {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('show'));
  }

  updateBattleBackground(floor: number): void {
    const lore = this.game.storyManager.getWorldLore(floor);
    const battleArea = document.querySelector('.battle-area');
    if (battleArea && lore) {
      (battleArea as HTMLElement).className = `battle-area ${lore.bgClass}`;
    }
  }

  private modalAutoCloseTimer: ReturnType<typeof setTimeout> | null = null;

  private startModalAutoClose(modalId: string, delay: number = 10000): void {
    this.clearModalAutoClose();
    this.modalAutoCloseTimer = setTimeout(() => {
      const modal = $(modalId);
      if (modal) modal.classList.remove('show');
    }, delay);
  }

  private clearModalAutoClose(): void {
    if (this.modalAutoCloseTimer) {
      clearTimeout(this.modalAutoCloseTimer);
      this.modalAutoCloseTimer = null;
    }
  }

  showLoreModal(lore: WorldLore, floor: number): void {
    const loreIcon = $('loreIcon');
    const loreTitle = $('loreTitle');
    const loreDescription = $('loreDescription');
    const loreContent = $('loreContent');
    const storyModal = $('storyModal');

    if (loreIcon) loreIcon.textContent = lore.icon;
    if (loreTitle) loreTitle.textContent = `${lore.name} - 第${floor}层`;
    if (loreDescription) loreDescription.textContent = lore.description;
    if (loreContent) loreContent.textContent = lore.lore;
    if (storyModal) storyModal.classList.add('show');
    this.startModalAutoClose('storyModal');
  }

  closeStoryModal(): void {
    this.clearModalAutoClose();
    const storyModal = $('storyModal');
    if (storyModal) storyModal.classList.remove('show');
  }

  showNPCModal(npc: NPC): void {
    const npcAvatar = $('npcAvatar');
    const npcName = $('npcName');
    const npcGreeting = $('npcGreeting');
    const npcDialogue = $('npcDialogue');
    const npcActions = $('npcActions');
    const npcModal = $('npcModal');

    if (npcAvatar) npcAvatar.textContent = npc.avatar;
    if (npcName) npcName.textContent = npc.name;
    if (npcGreeting) npcGreeting.textContent = npc.greeting;

    const dialogue = this.game.storyManager.getNPCDialogue(npc);
    if (npcDialogue) npcDialogue.textContent = dialogue;

    let actionsHtml = '';
    if (npc.shop && npc.shop.length > 0) {
      actionsHtml = '<div class="npc-shop">';
      npc.shop.forEach(item => {
        const itemDef =
          this.game.config.items.consumables.find((i: ConsumableItem) => i.id === item.itemId) ||
          this.game.config.items.scrolls.find((i: ScrollItem) => i.id === item.itemId);
        if (itemDef) {
          const canBuy = this.game.player.gold >= item.price;
          actionsHtml += `<div class="shop-item ${canBuy ? '' : 'disabled'}" onclick="${canBuy ? `game.buyNPCItem('${npc.id}', '${item.itemId}')` : ''}">
            <span>${itemDef.icon} ${itemDef.name}</span>
            <span>${item.price}💰</span>
          </div>`;
        }
      });
      actionsHtml += '</div>';
    }

    if (npc.reward) {
      actionsHtml += `<button class="btn btn-primary" onclick="game.acceptNPCReward('${npc.id}')">接受帮助</button>`;
    }

    actionsHtml += `<button class="btn btn-secondary" onclick="game.closeNPCModal()">离开</button>`;
    if (npcActions) npcActions.innerHTML = actionsHtml;
    if (npcModal) npcModal.classList.add('show');
    this.startModalAutoClose('npcModal');
  }

  closeNPCModal(): void {
    this.clearModalAutoClose();
    const npcModal = $('npcModal');
    if (npcModal) npcModal.classList.remove('show');
  }

  showEventModal(event: RandomEvent, result: RewardResult): void {
    const eventIcon = $('eventIcon');
    const eventName = $('eventName');
    const eventDescription = $('eventDescription');
    const eventResult = $('eventResult');
    const eventModal = $('eventModal');

    if (eventIcon) eventIcon.textContent = event.icon;
    if (eventName) eventName.textContent = event.name;
    if (eventDescription) eventDescription.textContent = event.description;

    let resultHtml = '';
    if (result.lore) {
      resultHtml += `<p class="event-lore">${result.lore}</p>`;
    }
    if (result.gold > 0) {
      resultHtml += `<p>💰 获得 ${result.gold} 金币</p>`;
    }
    if (result.exp > 0) {
      resultHtml += `<p>⭐ 获得 ${result.exp} 经验</p>`;
    }
    if (result.heal > 0) {
      resultHtml += `<p>💚 恢复 ${result.heal} 生命</p>`;
    }
    if (result.items && result.items.length > 0) {
      result.items.forEach(item => {
        const itemDef =
          this.game.config.items.consumables.find((i: ConsumableItem) => i.id === item.itemId) ||
          this.game.config.items.scrolls.find((i: ScrollItem) => i.id === item.itemId);
        if (itemDef) {
          resultHtml += `<p>🎁 获得 ${itemDef.icon} ${itemDef.name}</p>`;
        }
      });
    }
    if (eventResult) eventResult.innerHTML = resultHtml;
    if (eventModal) eventModal.classList.add('show');
    this.startModalAutoClose('eventModal');
  }

  closeEventModal(): void {
    this.clearModalAutoClose();
    const eventModal = $('eventModal');
    if (eventModal) eventModal.classList.remove('show');
  }
}
