var $ = id => document.getElementById(id);

class UIManager {
    constructor(game) {
        this.game = game;
    }

    log(msg) {
        const log = $('battleLog');
        const p = document.createElement('p');
        p.innerHTML = msg;
        log.appendChild(p);
        log.scrollTop = log.scrollHeight;
        if (log.children.length > 15) log.removeChild(log.firstChild);
    }

    flash(sel) {
        const el = document.querySelector(sel);
        el.classList.add('shake');
        setTimeout(() => el.classList.remove('shake'), 300);
    }

    showDamagePopup(value, isHeal, isDodge = false, isCritical = false) {
        const popup = document.createElement('div');
        let className = 'damage-popup';
        if (isHeal) className += ' heal-popup';
        if (isDodge) className += ' dodge-popup';
        if (isCritical) className += ' critical-popup';
        popup.className = className;
        
        if (isDodge) {
            popup.textContent = 'MISS';
        } else {
            popup.textContent = (isHeal ? '+' : '-') + value + (isCritical ? '!' : '');
        }
        
        const monsterCard = document.querySelector('.monster-card');
        if (monsterCard) {
            const rect = monsterCard.getBoundingClientRect();
            popup.style.left = (rect.left + rect.width / 2 - 20 + Math.random() * 40) + 'px';
            popup.style.top = (rect.top + rect.height / 3) + 'px';
        }
        document.body.appendChild(popup);
        setTimeout(() => popup.remove(), 800);
    }

    render() {
        const p = this.game.player;
        $('playerLevel').textContent = p.level;
        $('playerHP').textContent = p.hp;
        $('playerMaxHP').textContent = p.maxHP;
        $('playerATK').textContent = this.game.playerManager.getTotalAtk();
        $('playerDEF').textContent = this.game.playerManager.getTotalDef();
        $('playerEXP').textContent = p.exp;
        $('playerMaxEXP').textContent = p.maxEXP;
        $('playerGold').textContent = this.game.player.gold;
        $('currentFloor').textContent = this.game.floor;

        const hpPercent = Math.max(0, (p.hp / p.maxHP) * 100);
        const expPercent = Math.max(0, (p.exp / p.maxEXP) * 100);
        $('hpFill').style.width = `${hpPercent}%`;
        $('expBar').style.width = `${expPercent}%`;

        this.renderKillProgress();
        this.renderEquipment();
    }

    renderKillProgress() {
        const target = this.game.getMonstersToAdvance();
        const displayKilled = Math.min(this.game.killed, target);
        const progressEl = $('killProgress');
        progressEl.textContent = `${displayKilled}/${target}`;
        if (this.game.killed >= target) {
            progressEl.classList.add('complete');
        } else {
            progressEl.classList.remove('complete');
        }
    }

    renderEquipment() {
        const weaponEl = $('playerWeapon');
        const armorEl = $('playerArmor');
        if (this.game.player.weapon) {
            const w = CONFIG.equipment.weapons.find(we => we.id === this.game.player.weapon);
            weaponEl.textContent = w ? w.name : '无';
        } else {
            weaponEl.textContent = '无';
        }
        if (this.game.player.armor) {
            const a = CONFIG.equipment.armors.find(ar => ar.id === this.game.player.armor);
            armorEl.textContent = a ? a.name : '无';
        } else {
            armorEl.textContent = '无';
        }
    }

    renderMonster() {
        if (!this.game.monster) return;
        $('monsterAvatar').textContent = this.game.monster.avatar;
        $('monsterName').textContent = this.game.monster.name;
        $('monsterHP').textContent = Math.max(0, this.game.monster.hp);
        $('monsterMaxHP').textContent = this.game.monster.maxHP;
        $('monsterHPFill').style.width = `${Math.max(0, (this.game.monster.hp / this.game.monster.maxHP) * 100)}%`;
    }

    setButtons({ attack, skill, item, inventory, next }) {
        const btnAttack = $('btnAttack');
        const btnSkill = $('btnSkill');
        const btnItem = $('btnItem');
        const btnNextFloor = $('btnNextFloor');
        
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

    updatePostBattleUI() {
        this.game.canAdvanceFloor = this.game.killed >= this.game.getMonstersToAdvance();
        this.setButtons({
            attack: true,
            skill: true,
            item: true,
            inventory: false,
            next: !this.game.canAdvanceFloor
        });
    }

    updateSkillName() {
        const skillId = this.game.player.selectedSkill || this.game.player.learnedSkills[0];
        const btn = $('btnSkill');
        const currentSkillName = $('currentSkillName');
        
        if (btn && currentSkillName) {
            if (skillId) {
                const skill = CONFIG.skills.find(s => s.id === skillId);
                if (skill) {
                    const cd = this.game.player.skillCooldowns[skillId] || 0;
                    if (cd > 0) {
                        currentSkillName.textContent = `${skill.name} (CD:${cd})`;
                        btn.classList.add('on-cooldown');
                    } else {
                        currentSkillName.textContent = skill.name;
                        btn.classList.remove('on-cooldown');
                    }
                    return;
                }
            }
            currentSkillName.textContent = '无技能';
            btn.classList.remove('on-cooldown');
        }
    }

    showLevelUp(level, cfg) {
        $('newLevel').textContent = level;
        $('levelUpHP').textContent = `+${cfg.hp}`;
        $('levelUpATK').textContent = `+${cfg.atk}`;
        $('levelUpDEF').textContent = `+${cfg.def}`;
        $('levelUpModal').classList.add('show');
    }

    closeLevelUpModal() {
        $('levelUpModal').classList.remove('show');
    }

    openInventory() {
        this.renderInventoryPanel();
        $('inventoryModal').classList.add('show');
    }

    renderInventoryPanel() {
        const allItems = [...CONFIG.items.consumables, ...CONFIG.items.materials, ...CONFIG.items.scrolls];
        let html = `<div class="inventory-header">
            <span>🎒 背包 (${this.game.inventory.items.length}/${this.game.inventory.slots})</span>`;
        if (this.game.inventory.slots < CONFIG.inventory.maxSlots) {
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
        $('inventoryContent').innerHTML = html;
    }

    showItemDetail(index) {
        const item = this.game.inventory.items[index];
        if (!item) return;
        const allItems = [...CONFIG.items.consumables, ...CONFIG.items.materials, ...CONFIG.items.scrolls];
        const def = allItems.find(d => d.id === item.id);
        if (!def) return;
        let html = `<div class="item-detail">
            <h3>${def.icon} ${def.name} x${item.count}</h3>`;
        if (def.heal) {
            html += `<p>恢复 ${def.heal} HP</p>`;
            if (!this.game.inBattle && this.game.player.hp < this.game.player.maxHP) {
                html += `<button class="btn btn-use" onclick="game.useItem(${index})">使用</button>`;
            } else if (this.game.inBattle) {
                html += `<p class="hint">战斗中无法使用</p>`;
            } else {
                html += `<p class="hint">生命已满</p>`;
            }
        } else if (def.skill) {
            const skill = CONFIG.skills.find(s => s.id === def.skill);
            if (this.game.player.learnedSkills.includes(def.skill)) {
                html += `<p class="hint">已学会 ${skill.name}</p>`;
            } else {
                html += `<p>学习技能：${skill.icon} ${skill.name}</p>`;
                html += `<button class="btn btn-use" onclick="game.learnScroll(${index})">学习</button>`;
            }
        } else {
            html += `<p class="hint">锻造材料</p>`;
        }
        html += '</div>';
        $('inventoryContent').innerHTML = html;
    }

    openItemMenu() {
        if (!this.game.inBattle) return;
        const consumables = this.game.inventory.items.filter(i => {
            const def = CONFIG.items.consumables.find(d => d.id === i.id);
            return def && def.heal;
        });
        let html = '';
        if (consumables.length === 0) {
            html = '<p class="no-items">没有可使用的道具</p>';
        } else {
            html = '<div class="item-options">';
            consumables.forEach(item => {
                const def = CONFIG.items.consumables.find(d => d.id === item.id);
                html += `<div class="item-option" onclick="game.useItemInBattle('${item.id}')">
                    <span class="item-icon">${def.icon}</span>
                    <span class="item-name">${def.name}</span>
                    <span class="item-count">x${item.count}</span>
                    <span class="item-effect">+${def.heal} HP</span>
                </div>`;
            });
            html += '</div>';
        }
        $('itemList').innerHTML = html;
        $('itemModal').classList.add('show');
    }

    openSkillMenu() {
        const learned = this.game.player.learnedSkills;
        const selectedSkillId = this.game.player.selectedSkill || learned[0];
        let html = '<div class="skill-select-list">';
        learned.forEach(skillId => {
            const skill = CONFIG.skills.find(s => s.id === skillId);
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
        $('skillMenuContent').innerHTML = html;
        $('skillModal').classList.add('show');
    }

    openSkillManage() {
        $('skillModal').classList.remove('show');
        const learned = this.game.player.learnedSkills;
        const equipped = this.game.player.equippedSkills;
        const unlocked = this.game.playerManager.getUnlockedSkillSlots();
        let html = `<p class="slot-info">已解锁 ${unlocked} 个技能槽</p>`;
        html += '<div class="skill-manage-grid">';
        for (let i = 0; i < 4; i++) {
            const isUnlocked = i < unlocked;
            const equippedId = equipped[i];
            const skill = equippedId ? CONFIG.skills.find(s => s.id === equippedId) : null;
            html += `<div class="skill-slot ${isUnlocked ? '' : 'locked'}">`;
            if (isUnlocked) {
                if (skill) {
                    html += `<span>${skill.icon} ${skill.name}</span>`;
                    html += `<button class="btn-small" onclick="game.unequipSkill(${i})">卸下</button>`;
                } else {
                    html += `<span class="empty">空槽位</span>`;
                }
            } else {
                const unlockLevel = CONFIG.player.skillSlots[i];
                html += `<span class="locked">🔒 Lv${unlockLevel}解锁</span>`;
            }
            html += '</div>';
        }
        html += '</div>';
        html += '<h4 style="margin: 12px 0 8px; color: var(--accent);">已学技能</h4><div class="learned-skills">';
        learned.forEach(skillId => {
            if (equipped.includes(skillId)) return;
            const skill = CONFIG.skills.find(s => s.id === skillId);
            if (!skill) return;
            html += `<div class="skill-item">
                <span>${skill.icon} ${skill.name}</span>
                <button class="btn-small" onclick="game.equipSkill('${skillId}')">装备</button>
            </div>`;
        });
        html += '</div>';
        $('skillManageContent').innerHTML = html;
        $('skillManageModal').classList.add('show');
    }

    openForge() {
        this.renderForgePanel();
        $('forgeModal').classList.add('show');
    }

    renderForgePanel() {
        let html = '<div class="forge-tabs">';
        html += '<button class="tab-btn active" onclick="game.showForgeCategory(\'weapons\')">⚔️ 武器</button>';
        html += '<button class="tab-btn" onclick="game.showForgeCategory(\'armors\')">🛡️ 甲胄</button>';
        html += '</div>';
        html += '<div id="forgeList"></div>';
        $('forgeContent').innerHTML = html;
        this.showForgeCategory('weapons');
    }

    showForgeCategory(category) {
        document.querySelectorAll('.forge-tabs .tab-btn').forEach((btn, idx) => {
            btn.classList.toggle('active', (category === 'weapons' && idx === 0) || (category === 'armors' && idx === 1));
        });
        const items = CONFIG.equipment[category];
        const currentEquip = category === 'weapons' ? this.game.player.weapon : this.game.player.armor;
        let html = '<div class="forge-list">';
        items.forEach(item => {
            const isEquipped = currentEquip === item.id;
            const canForge = this.game.inventoryManager.canForge(item);
            html += `<div class="forge-item ${isEquipped ? 'equipped' : ''}">`;
            html += `<div class="forge-info">
                <span class="forge-icon">${item.icon}</span>
                <span class="forge-name">${item.name}</span>
                <span class="forge-stat">${category === 'weapons' ? `ATK+${item.atk}` : `DEF+${item.def}`}</span>
                ${isEquipped ? '<span class="equipped-badge">已装备</span>' : ''}
            </div>`;
            html += '<div class="forge-mats">';
            Object.entries(item.materials).forEach(([matId, count]) => {
                const mat = CONFIG.items.materials.find(m => m.id === matId);
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
        $('forgeList').innerHTML = html;
    }

    showConfirm(message, onConfirm) {
        $('confirmMessage').textContent = message;
        $('confirmBtn').onclick = () => {
            this.closeConfirm();
            onConfirm();
        };
        $('confirmModal').classList.add('show');
    }

    closeConfirm() {
        $('confirmModal').classList.remove('show');
    }

    openSettings() {
        $('settingsModal').classList.add('show');
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('show'));
    }

    updateBattleBackground(floor) {
        const lore = this.game.storyManager.getWorldLore(floor);
        const battleArea = document.querySelector('.battle-area');
        if (battleArea && lore) {
            battleArea.className = `battle-area ${lore.bgClass}`;
        }
    }

    showLoreModal(lore, floor) {
        $('loreIcon').textContent = lore.icon;
        $('loreTitle').textContent = `${lore.name} - 第${floor}层`;
        $('loreDescription').textContent = lore.description;
        $('loreContent').textContent = lore.lore;
        $('storyModal').classList.add('show');
    }

    closeStoryModal() {
        $('storyModal').classList.remove('show');
    }

    showNPCModal(npc) {
        $('npcAvatar').textContent = npc.avatar;
        $('npcName').textContent = npc.name;
        $('npcGreeting').textContent = npc.greeting;
        
        const dialogue = this.game.storyManager.getNPCDialogue(npc);
        $('npcDialogue').textContent = dialogue;
        
        let actionsHtml = '';
        if (npc.shop && npc.shop.length > 0) {
            actionsHtml = '<div class="npc-shop">';
            npc.shop.forEach(item => {
                const itemDef = CONFIG.items.consumables.find(i => i.id === item.itemId) || 
                               CONFIG.items.scrolls.find(i => i.id === item.itemId);
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
        $('npcActions').innerHTML = actionsHtml;
        
        $('npcModal').classList.add('show');
    }

    closeNPCModal() {
        $('npcModal').classList.remove('show');
    }

    showEventModal(event, result) {
        $('eventIcon').textContent = event.icon;
        $('eventName').textContent = event.name;
        $('eventDescription').textContent = event.description;
        
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
                const itemDef = CONFIG.items.consumables.find(i => i.id === item.itemId) ||
                               CONFIG.items.scrolls.find(i => i.id === item.itemId);
                if (itemDef) {
                    resultHtml += `<p>🎁 获得 ${itemDef.icon} ${itemDef.name}</p>`;
                }
            });
        }
        $('eventResult').innerHTML = resultHtml;
        
        $('eventModal').classList.add('show');
    }

    closeEventModal() {
        $('eventModal').classList.remove('show');
    }
}
