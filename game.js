class Game {
    constructor() {
        this.player = {
            name: '勇者',
            level: 1,
            hp: 100,
            maxHP: 100,
            atk: 10,
            def: 5,
            exp: 0,
            maxEXP: 100,
            gold: 0,
            skillCooldown: 0
        };
        
        this.currentFloor = 1;
        this.monstersDefeated = 0;
        this.currentMonster = null;
        this.inBattle = false;
        
        this.monsterTypes = [
            { name: '史莱姆', avatar: '🟢', baseHP: 50, baseATK: 5, baseDEF: 2, baseEXP: 20, baseGold: 10 },
            { name: '哥布林', avatar: '👺', baseHP: 80, baseATK: 10, baseDEF: 5, baseEXP: 35, baseGold: 20 },
            { name: '骷髅兵', avatar: '💀', baseHP: 100, baseATK: 15, baseDEF: 8, baseEXP: 50, baseGold: 30 },
            { name: '狼人', avatar: '🐺', baseHP: 150, baseATK: 20, baseDEF: 10, baseEXP: 70, baseGold: 45 },
            { name: '石像鬼', avatar: '🗿', baseHP: 200, baseATK: 25, baseDEF: 15, baseEXP: 90, baseGold: 60 },
            { name: '暗影魔', avatar: '👁️', baseHP: 250, baseATK: 30, baseDEF: 12, baseEXP: 110, baseGold: 75 },
            { name: '炎魔', avatar: '🔥', baseHP: 300, baseATK: 35, baseDEF: 18, baseEXP: 140, baseGold: 90 },
            { name: '冰霜巨人', avatar: '❄️', baseHP: 400, baseATK: 40, baseDEF: 25, baseEXP: 180, baseGold: 120 },
            { name: '龙人', avatar: '🐉', baseHP: 500, baseATK: 50, baseDEF: 30, baseEXP: 220, baseGold: 150 },
            { name: '恶魔领主', avatar: '👿', baseHP: 600, baseATK: 60, baseDEF: 35, baseEXP: 280, baseGold: 200 }
        ];
        
        this.shopItems = {
            weapon: { price: 50, atkBonus: 5 },
            armor: { price: 40, defBonus: 3 },
            potion: { price: 20, healAmount: 50 }
        };
        
        this.initUI();
        this.updateUI();
    }
    
    initUI() {
        document.getElementById('btnExplore').addEventListener('click', () => this.explore());
        document.getElementById('btnAttack').addEventListener('click', () => this.attack());
        document.getElementById('btnSkill').addEventListener('click', () => this.useSkill());
        document.getElementById('btnHeal').addEventListener('click', () => this.heal());
        document.getElementById('btnNextFloor').addEventListener('click', () => this.nextFloor());
    }
    
    explore() {
        if (this.inBattle) return;
        
        this.currentMonster = this.generateMonster();
        this.inBattle = true;
        
        this.updateMonsterUI();
        this.addLog(`遭遇了 ${this.currentMonster.name}！`);
        
        document.getElementById('btnExplore').disabled = true;
        document.getElementById('btnAttack').disabled = false;
        document.getElementById('btnSkill').disabled = this.player.skillCooldown > 0;
        document.getElementById('btnHeal').disabled = this.player.gold < 10;
        document.getElementById('btnNextFloor').disabled = true;
    }
    
    generateMonster() {
        const floorBonus = (this.currentFloor - 1) * 0.2;
        const monsterIndex = Math.min(
            Math.floor(Math.random() * Math.min(this.currentFloor + 2, this.monsterTypes.length)),
            this.monsterTypes.length - 1
        );
        
        const baseMonster = this.monsterTypes[monsterIndex];
        const levelMultiplier = 1 + floorBonus;
        
        return {
            name: baseMonster.name,
            avatar: baseMonster.avatar,
            hp: Math.floor(baseMonster.baseHP * levelMultiplier),
            maxHP: Math.floor(baseMonster.baseHP * levelMultiplier),
            atk: Math.floor(baseMonster.baseATK * levelMultiplier),
            def: Math.floor(baseMonster.baseDEF * levelMultiplier),
            exp: Math.floor(baseMonster.baseEXP * levelMultiplier),
            gold: Math.floor(baseMonster.baseGold * levelMultiplier)
        };
    }
    
    attack() {
        if (!this.inBattle || !this.currentMonster) return;
        
        const damage = Math.max(1, this.player.atk - this.currentMonster.def + Math.floor(Math.random() * 5));
        this.currentMonster.hp -= damage;
        
        this.addLog(`你对 ${this.currentMonster.name} 造成了 <span class="damage">${damage}</span> 点伤害！`, 'damage');
        this.flashMonster();
        
        if (this.currentMonster.hp <= 0) {
            this.defeatMonster();
        } else {
            this.monsterAttack();
        }
        
        this.updateMonsterUI();
        this.updateUI();
    }
    
    useSkill() {
        if (!this.inBattle || !this.currentMonster || this.player.skillCooldown > 0) return;
        
        const damage = Math.floor((this.player.atk * 2.5) - this.currentMonster.def + Math.floor(Math.random() * 10));
        this.currentMonster.hp -= damage;
        this.player.skillCooldown = 3;
        
        this.addLog(`💥 必杀技！对 ${this.currentMonster.name} 造成了 <span class="damage">${damage}</span> 点伤害！`, 'damage');
        this.flashMonster();
        
        if (this.currentMonster.hp <= 0) {
            this.defeatMonster();
        } else {
            this.monsterAttack();
        }
        
        document.getElementById('btnSkill').disabled = true;
        this.updateMonsterUI();
        this.updateUI();
    }
    
    monsterAttack() {
        const damage = Math.max(1, this.currentMonster.atk - this.player.def + Math.floor(Math.random() * 3));
        this.player.hp -= damage;
        
        this.addLog(`${this.currentMonster.name} 对你造成了 <span class="damage">${damage}</span> 点伤害！`, 'damage');
        this.shakePlayer();
        
        if (this.player.hp <= 0) {
            this.gameOver();
        }
    }
    
    defeatMonster() {
        this.inBattle = false;
        this.monstersDefeated++;
        
        const expGain = this.currentMonster.exp;
        const goldGain = this.currentMonster.gold;
        
        this.player.exp += expGain;
        this.player.gold += goldGain;
        
        this.addLog(`🎉 击败了 ${this.currentMonster.name}！获得 <span class="exp">${expGain}</span> 经验值和 <span class="gold">${goldGain}</span> 金币！`, 'gold');
        
        this.checkLevelUp();
        
        if (this.player.skillCooldown > 0) {
            this.player.skillCooldown--;
        }
        
        document.getElementById('btnExplore').disabled = false;
        document.getElementById('btnAttack').disabled = true;
        document.getElementById('btnSkill').disabled = true;
        document.getElementById('btnHeal').disabled = this.player.gold < 10;
        document.getElementById('btnNextFloor').disabled = this.monstersDefeated < 3;
    }
    
    checkLevelUp() {
        while (this.player.exp >= this.player.maxEXP) {
            this.player.exp -= this.player.maxEXP;
            this.player.level++;
            this.player.maxHP += 10;
            this.player.hp = Math.min(this.player.hp + 10, this.player.maxHP);
            this.player.atk += 2;
            this.player.def += 1;
            this.player.maxEXP = Math.floor(this.player.maxEXP * 1.5);
            
            this.showLevelUpModal();
        }
    }
    
    heal() {
        if (this.player.gold < 10) return;
        
        this.player.gold -= 10;
        const healAmount = Math.floor(this.player.maxHP * 0.3);
        this.player.hp = Math.min(this.player.hp + healAmount, this.player.maxHP);
        
        this.addLog(`💚 使用治疗，恢复了 <span class="heal">${healAmount}</span> 点生命值！`, 'heal');
        
        document.getElementById('btnHeal').disabled = this.player.gold < 10;
        this.updateUI();
    }
    
    nextFloor() {
        this.currentFloor++;
        this.monstersDefeated = 0;
        
        this.addLog(`📍 进入第 ${this.currentFloor} 层！怪物变得更强了...`);
        
        document.getElementById('btnNextFloor').disabled = true;
        this.updateUI();
    }
    
    buyItem(itemType) {
        const item = this.shopItems[itemType];
        if (this.player.gold < item.price) {
            this.addLog('❌ 金币不足！');
            return;
        }
        
        this.player.gold -= item.price;
        
        switch (itemType) {
            case 'weapon':
                this.player.atk += item.atkBonus;
                this.addLog(`⚔️ 购买了强化武器！攻击力 +${item.atkBonus}`);
                break;
            case 'armor':
                this.player.def += item.defBonus;
                this.addLog(`🛡️ 购买了强化护甲！防御力 +${item.defBonus}`);
                break;
            case 'potion':
                this.player.hp = Math.min(this.player.hp + item.healAmount, this.player.maxHP);
                this.addLog(`🧪 使用了生命药水！恢复 ${item.healAmount} HP`);
                break;
        }
        
        this.updateUI();
    }
    
    showLevelUpModal() {
        document.getElementById('newLevel').textContent = this.player.level;
        document.getElementById('levelUpModal').classList.add('show');
    }
    
    closeLevelUpModal() {
        document.getElementById('levelUpModal').classList.remove('show');
    }
    
    gameOver() {
        document.getElementById('finalFloor').textContent = this.currentFloor;
        document.getElementById('finalLevel').textContent = this.player.level;
        document.getElementById('finalGold').textContent = this.player.gold;
        document.getElementById('gameOverModal').classList.add('show');
    }
    
    restart() {
        this.player = {
            name: '勇者',
            level: 1,
            hp: 100,
            maxHP: 100,
            atk: 10,
            def: 5,
            exp: 0,
            maxEXP: 100,
            gold: 0,
            skillCooldown: 0
        };
        
        this.currentFloor = 1;
        this.monstersDefeated = 0;
        this.currentMonster = null;
        this.inBattle = false;
        
        document.getElementById('gameOverModal').classList.remove('show');
        document.getElementById('battleLog').innerHTML = '<p>欢迎来到循环冒险！点击"探索"开始你的冒险之旅！</p>';
        
        document.getElementById('btnExplore').disabled = false;
        document.getElementById('btnAttack').disabled = true;
        document.getElementById('btnSkill').disabled = true;
        document.getElementById('btnHeal').disabled = true;
        document.getElementById('btnNextFloor').disabled = true;
        
        this.updateUI();
    }
    
    addLog(message) {
        const log = document.getElementById('battleLog');
        const p = document.createElement('p');
        p.innerHTML = message;
        log.appendChild(p);
        log.scrollTop = log.scrollHeight;
        
        if (log.children.length > 20) {
            log.removeChild(log.firstChild);
        }
    }
    
    updateUI() {
        document.getElementById('playerLevel').textContent = this.player.level;
        document.getElementById('playerHP').textContent = this.player.hp;
        document.getElementById('playerMaxHP').textContent = this.player.maxHP;
        document.getElementById('playerATK').textContent = this.player.atk;
        document.getElementById('playerDEF').textContent = this.player.def;
        document.getElementById('playerEXP').textContent = this.player.exp;
        document.getElementById('playerMaxEXP').textContent = this.player.maxEXP;
        document.getElementById('playerGold').textContent = this.player.gold;
        document.getElementById('currentFloor').textContent = this.currentFloor;
        
        const expPercent = (this.player.exp / this.player.maxEXP) * 100;
        document.getElementById('expFill').style.width = `${expPercent}%`;
        
        if (this.player.skillCooldown > 0) {
            document.getElementById('btnSkill').textContent = `技能 (${this.player.skillCooldown}回合)`;
        } else {
            document.getElementById('btnSkill').textContent = '技能';
        }
    }
    
    updateMonsterUI() {
        if (this.currentMonster) {
            document.getElementById('monsterAvatar').textContent = this.currentMonster.avatar;
            document.getElementById('monsterName').textContent = this.currentMonster.name;
            document.getElementById('monsterHP').textContent = Math.max(0, this.currentMonster.hp);
            document.getElementById('monsterMaxHP').textContent = this.currentMonster.maxHP;
            
            const hpPercent = (this.currentMonster.hp / this.currentMonster.maxHP) * 100;
            document.getElementById('monsterHPFill').style.width = `${Math.max(0, hpPercent)}%`;
        }
    }
    
    flashMonster() {
        const monsterCard = document.querySelector('.monster-card');
        monsterCard.classList.add('flash-damage');
        setTimeout(() => monsterCard.classList.remove('flash-damage'), 300);
    }
    
    shakePlayer() {
        const playerPanel = document.querySelector('.player-panel');
        playerPanel.classList.add('shake');
        setTimeout(() => playerPanel.classList.remove('shake'), 300);
    }
}

const game = new Game();
