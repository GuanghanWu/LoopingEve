let CONFIG = null;
const $ = id => document.getElementById(id);

async function loadConfig() {
    const res = await fetch('config.json?t=' + Date.now());
    if (!res.ok) throw new Error('配置加载失败');
    CONFIG = await res.json();
}

class Game {
    constructor() {
        this.floor = 1;
        this.killed = 0;
        this.monster = null;
        this.inBattle = false;
        this.load();
    }

    init() {
        this.bindEvents();
        this.render();
    }

    initPlayer() {
        this.player = { ...CONFIG.player.initial };
    }

    save() {
        const data = { player: this.player, floor: this.floor, killed: this.killed };
        localStorage.setItem('loopingEveSave', JSON.stringify(data));
    }

    load() {
        const saved = localStorage.getItem('loopingEveSave');
        if (saved) {
            const data = JSON.parse(saved);
            this.player = data.player;
            this.floor = data.floor;
            this.killed = data.killed;
        } else {
            this.initPlayer();
        }
    }

    clearSave() {
        localStorage.removeItem('loopingEveSave');
        this.initPlayer();
        this.floor = 1;
        this.killed = 0;
        this.monster = null;
        this.inBattle = false;
        $('battleLog').innerHTML = '<p>存档已清除，点击"探索"开始！</p>';
        this.setButtons({ explore: false, attack: true, skill: true, heal: true, next: true });
        this.render();
    }

    bindEvents() {
        $('btnExplore').onclick = () => this.explore();
        $('btnAttack').onclick = () => this.attack();
        $('btnSkill').onclick = () => this.skill();
        $('btnHeal').onclick = () => this.heal();
        $('btnNextFloor').onclick = () => this.nextFloor();
        $('btnShop').onclick = () => $('shopModal').classList.add('show');
    }

    explore() {
        if (this.inBattle) return;
        this.monster = this.createMonster();
        this.inBattle = true;
        this.log(`遭遇了 ${this.monster.name}！`);
        this.setButtons({ explore: true, attack: false, skill: this.player.cd > 0, heal: this.player.gold < CONFIG.heal.cost, next: true });
        this.renderMonster();
    }

    createMonster() {
        const cfg = CONFIG.floor;
        const monsters = CONFIG.monsters.filter(m => m.minFloor <= this.floor);
        const idx = Math.floor(Math.random() * monsters.length);
        const m = monsters[idx];
        const mult = 1 + (this.floor - 1) * cfg.difficultyMultiplier;
        return {
            name: m.name, avatar: m.avatar,
            hp: Math.floor(m.hp * mult), maxHP: Math.floor(m.hp * mult),
            atk: Math.floor(m.atk * mult), def: Math.floor(m.def * mult),
            exp: Math.floor(m.exp * mult), gold: Math.floor(m.gold * mult)
        };
    }

    attack() {
        if (!this.inBattle) return;
        const dmg = this.calcDamage(this.player.atk, this.monster.def, CONFIG.battle.normalAttackRand);
        this.dealDamage(dmg, `对 ${this.monster.name} 造成 `);
    }

    skill() {
        if (!this.inBattle || this.player.cd > 0) return;
        const cfg = CONFIG.battle;
        const dmg = this.calcDamage(this.player.atk * cfg.skillAttackMultiplier, this.monster.def, cfg.skillAttackRand);
        this.player.cd = 3;
        this.dealDamage(dmg, `💥 必杀技！对 ${this.monster.name} 造成 `);
        $('btnSkill').disabled = true;
    }

    calcDamage(atk, def, rand) {
        return Math.max(1, Math.floor(atk - def + Math.random() * rand));
    }

    dealDamage(dmg, msg) {
        this.monster.hp -= dmg;
        this.log(`${msg}<span class="damage">${dmg}</span> 伤害！`);
        this.flash('.monster-card');
        this.renderMonster();
        this.monster.hp <= 0 ? this.defeat() : this.enemyAttack();
        this.render();
    }

    enemyAttack() {
        const dmg = this.calcDamage(this.monster.atk, this.player.def, CONFIG.battle.enemyAttackRand);
        this.player.hp -= dmg;
        this.log(`${this.monster.name} 对你造成 <span class="damage">${dmg}</span> 伤害！`);
        this.flash('.player-panel');
        if (this.player.hp <= 0) this.gameOver();
    }

    defeat() {
        this.inBattle = false;
        this.killed++;
        this.player.exp += this.monster.exp;
        this.player.gold += this.monster.gold;
        this.log(`🎉 击败 ${this.monster.name}！+<span class="exp">${this.monster.exp}</span> 经验 +<span class="gold">${this.monster.gold}</span> 金币`);
        if (this.player.cd > 0) this.player.cd--;
        this.levelUp();
        this.save();
        
        const canAdvance = this.killed >= CONFIG.floor.monstersToAdvance;
        const autoNext = $('autoNext').checked;
        this.setButtons({ explore: false, attack: true, skill: true, heal: this.player.gold < CONFIG.heal.cost, next: !canAdvance });
        
        setTimeout(() => {
            if (canAdvance && autoNext) {
                this.nextFloor();
                setTimeout(() => this.explore(), 300);
            } else {
                this.explore();
            }
        }, 500);
    }

    levelUp() {
        const cfg = CONFIG.player.levelUp;
        while (this.player.exp >= this.player.maxEXP) {
            this.player.exp -= this.player.maxEXP;
            this.player.level++;
            this.player.maxHP += cfg.hp;
            this.player.hp = Math.min(this.player.hp + cfg.hp, this.player.maxHP);
            this.player.atk += cfg.atk;
            this.player.def += cfg.def;
            this.player.maxEXP = Math.floor(this.player.maxEXP * cfg.expMultiplier);
            $('newLevel').textContent = this.player.level;
            $('levelUpModal').classList.add('show');
        }
    }

    heal() {
        const cfg = CONFIG.heal;
        if (this.player.gold < cfg.cost) return;
        this.player.gold -= cfg.cost;
        const amt = Math.floor(this.player.maxHP * cfg.percent);
        this.player.hp = Math.min(this.player.hp + amt, this.player.maxHP);
        this.log(`💚 治疗 +<span class="heal">${amt}</span> HP`);
        $('btnHeal').disabled = this.player.gold < cfg.cost;
        this.render();
    }

    nextFloor() {
        this.floor++;
        this.killed = 0;
        this.log(`📍 进入第 ${this.floor} 层！`);
        $('btnNextFloor').disabled = true;
        this.save();
        this.render();
    }

    buyItem(type) {
        const item = CONFIG.shop[type];
        if (this.player.gold < item.price) return this.log('❌ 金币不足！');
        this.player.gold -= item.price;
        if (item.atk) this.player.atk += item.atk;
        if (item.def) this.player.def += item.def;
        if (item.heal) this.player.hp = Math.min(this.player.hp + item.heal, this.player.maxHP);
        this.log(`购买 ${item.label}！`);
        this.save();
        this.render();
    }

    closeShop() { $('shopModal').classList.remove('show'); }

    gameOver() {
        localStorage.removeItem('loopingEveSave');
        $('finalFloor').textContent = this.floor;
        $('finalLevel').textContent = this.player.level;
        $('finalGold').textContent = this.player.gold;
        $('gameOverModal').classList.add('show');
    }

    restart() {
        this.initPlayer();
        this.floor = 1;
        this.killed = 0;
        this.monster = null;
        this.inBattle = false;
        localStorage.removeItem('loopingEveSave');
        $('gameOverModal').classList.remove('show');
        $('battleLog').innerHTML = '<p>点击"探索"开始！</p>';
        this.setButtons({ explore: false, attack: true, skill: true, heal: true, next: true });
        this.render();
    }

    closeLevelUpModal() { $('levelUpModal').classList.remove('show'); }

    setButtons({ explore, attack, skill, heal, next }) {
        $('btnExplore').disabled = explore;
        $('btnAttack').disabled = attack;
        $('btnSkill').disabled = skill;
        $('btnHeal').disabled = heal;
        $('btnNextFloor').disabled = next;
    }

    log(msg) {
        const log = $('battleLog');
        const p = document.createElement('p');
        p.innerHTML = msg;
        log.appendChild(p);
        log.scrollTop = log.scrollHeight;
        if (log.children.length > 20) log.removeChild(log.firstChild);
    }

    flash(sel) {
        const el = document.querySelector(sel);
        el.classList.add('shake');
        setTimeout(() => el.classList.remove('shake'), 300);
    }

    render() {
        const p = this.player;
        $('playerLevel').textContent = p.level;
        $('playerHP').textContent = p.hp;
        $('playerMaxHP').textContent = p.maxHP;
        $('playerATK').textContent = p.atk;
        $('playerDEF').textContent = p.def;
        $('playerEXP').textContent = p.exp;
        $('playerMaxEXP').textContent = p.maxEXP;
        $('playerGold').textContent = p.gold;
        $('currentFloor').textContent = this.floor;
        $('expFill').style.width = `${(p.exp / p.maxEXP) * 100}%`;
        $('btnSkill').textContent = p.cd > 0 ? `技能 (${p.cd})` : '技能';
        this.renderMobile();
    }

    renderMobile() {
        const p = this.player;
        $('mHP').textContent = p.hp;
        $('mMaxHP').textContent = p.maxHP;
        $('mATK').textContent = p.atk;
        $('mDEF').textContent = p.def;
        $('mGold').textContent = p.gold;
        $('mLevel').textContent = p.level;
        $('mEXP').textContent = p.exp;
        $('mMaxEXP').textContent = p.maxEXP;
        $('mExpFill').style.width = `${(p.exp / p.maxEXP) * 100}%`;
    }

    renderMonster() {
        if (!this.monster) return;
        $('monsterAvatar').textContent = this.monster.avatar;
        $('monsterName').textContent = this.monster.name;
        $('monsterHP').textContent = Math.max(0, this.monster.hp);
        $('monsterMaxHP').textContent = this.monster.maxHP;
        $('monsterHPFill').style.width = `${Math.max(0, (this.monster.hp / this.monster.maxHP) * 100)}%`;
    }
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
        modal.onclick = (e) => {
            if (e.target === modal) {
                setTimeout(() => modal.classList.remove('show'), 200);
            }
        };
    });
}
