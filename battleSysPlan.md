# LoopingEve 战斗系统重构计划

> 创建日期：2026-02-19
> 状态：待实施

---
## 需求：
请写个计划以实现我的以下需求：
对游戏系统进行全面重构，重点优化战斗系统，具体实施要求如下：

1. 战斗流程与难度曲线重构：
   - 实现主角自动持续战斗的放置机制，建立完整的关卡推进系统
   - 设计BOSS关卡机制：每5个常规关卡设置1个BOSS关卡，BOSS关卡难度需呈现明显递增趋势
   - 区域过渡平衡：BOSS关卡后进入新区域的第一层基础怪物，其难度（包括生命值、攻击力等核心属性）不得低于刚刚击败的BOSS难度的80%，确保玩家体验连贯且具有挑战性
   - 建立基于上述规则的可持续玩法循环系统，确保玩家有明确的目标感和进度感

2. 战斗规则优化：
   - 实现无惩罚死亡机制：玩家角色死亡后自动回退至当前关卡的上一层重新开始挑战，并自动取消“自动闯关”
   - 设计战斗恢复机制：每成功击败一只怪物后，自动将角色生命值恢复至满值状态
   - 确保战斗节奏流畅，死亡回退和生命恢复机制不破坏游戏体验的连贯性

3. 战斗属性系统扩展：
   - 扩展玩家角色战斗属性体系，新增以下核心次要战斗属性，但玩家这些属性初始都是0，只能通过装备和天赋获得：
     - 连击：实现连续攻击机制，设计连击触发条件及伤害加成规则
     - 反击：设计受到攻击后的反击概率及伤害计算方式
     - 格挡：添加格挡机制，包括格挡概率、伤害减免比例等参数
     - 护盾：实现护盾吸收伤害系统，设计护盾值生成及消耗规则
   - 怪物属性配置：怪物暂时仅保留暴击和闪避两种次要属性，确保AI行为逻辑与属性系统匹配

4. 系统集成与测试要求：
   - 确保新战斗系统与现有游戏框架无缝集成
   - 进行全面的平衡性测试，调整各项属性参数以保证游戏难度曲线平滑
   - 测试不同场景下的战斗表现，包括常规关卡、BOSS关卡及区域过渡阶段
   - 验证死亡回退和生命恢复机制的稳定性和玩家体验


## 一、当前系统分析

### 现有架构

| 文件 | 职责 |
|------|------|
| `MainGame/src/Game.ts` | 游戏主循环、状态管理、存档 |
| `MainGame/src/managers/BattleManager.ts` | 战斗逻辑、伤害计算 |
| `MainGame/src/managers/PlayerManager.ts` | 玩家属性、升级、装备 |
| `MainGame/src/managers/InventoryManager.ts` | 背包管理、物品使用 |
| `MainGame/src/managers/StoryManager.ts` | 剧情管理、NPC交互 |
| `MainGame/src/managers/UIManager.ts` | UI渲染、事件绑定 |
| `MainGame/src/types/index.ts` | TypeScript 类型定义 |
| `MainGame/src/utils/dom.ts` | DOM 工具函数 |
| `MainGame/public/Configs/config.json` | 游戏配置（数值、怪物、装备等） |

### 需要改造的核心点

1. **战斗模式**：从手动点击 → 放置自动战斗
2. **关卡结构**：从简单的击杀计数 → BOSS关卡 + 区域系统
3. **死亡机制**：从清除存档 → 回退一层继续
4. **属性扩展**：新增连击/反击/格挡/护盾系统
5. **类型定义**：在 `types/index.ts` 中扩展新属性接口

---

## 二、重构计划（共4大阶段，12个子任务）

### 阶段一：战斗流程与关卡系统重构

#### 任务 1.1：放置战斗机制
**文件**：`src/managers/BattleManager.ts`、`src/Game.ts`、`public/Configs/config.json`

**改造内容**：
- 实现自动战斗循环（autoBattleLoop）
- 添加战斗速度配置（可调节间隔）
- 区分「自动战斗」和「自动闯关」两种状态

**新增配置**：
```json
"battle": {
    "autoBattleInterval": 1000,
    "autoExploreDelay": 500
}
```

---

#### 任务 1.2：BOSS关卡系统
**文件**：`src/managers/BattleManager.ts`、`src/types/index.ts`、`public/Configs/config.json`

**改造内容**：
- 实现BOSS关卡规则：每5层设置1个BOSS（5, 10, 15, 20...）
- 创建BOSS怪物配置（独立于普通怪物）
- 设计BOSS难度递增曲线

**新增配置**：
```json
"bossFloors": [5, 10, 15, 20, 25, 30, 35, 40, 45, 50],
"bosses": [
    { "id": "floor5Boss", "name": "守门石像", "floor": 5, ... },
    { "id": "floor10Boss", "name": "暗影领主", "floor": 10, ... }
]
```

---

#### 任务 1.3：区域过渡与难度平衡
**文件**：`src/managers/BattleManager.ts`、`public/Configs/config.json`

**改造内容**：
- 定义区域划分（基于现有worldLore）
- 实现难度衔接规则：新区域第1层基础怪物 ≥ 前区域BOSS难度的80%
- 调整怪物生成逻辑，考虑区域和BOSS难度

**新增逻辑**：
```javascript
// 伪代码
if (isNewAreaFirstFloor(floor)) {
    const prevBoss = getPreviousBoss(floor);
    monsterStats = prevBoss.stats * 0.8 * difficultyMultiplier;
}
```

---

### 阶段二：战斗规则优化

#### 任务 2.1：无惩罚死亡机制
**文件**：`src/Game.ts`、`src/managers/BattleManager.ts`

**改造内容**：
- 修改 `gameOver()` → `onPlayerDeath()`
- 死亡后回退到上一层（floor = max(1, floor - 1)）
- 自动关闭「自动闯关」选项
- 保留玩家经验和装备（不清除存档）

**新增状态**：
```typescript
autoAdvanceEnabled: boolean = false; // 自动闯关开关
```

---

#### 任务 2.2：战斗恢复机制
**文件**：`src/managers/BattleManager.ts`

**改造内容**：
- 在 `defeat()` 方法中添加满血恢复
- 确保恢复逻辑不影响护盾系统

```typescript
defeat(): void {
    // ... 现有逻辑
    this.game.player.hp = this.game.player.maxHP; // 新增：满血恢复
}
```

---

#### 任务 2.3：战斗节奏优化
**文件**：`src/managers/UIManager.ts`、`src/style.css`

**改造内容**：
- 优化战斗日志显示（自动滚动、精简信息）
- 添加战斗动画效果（连击/暴击/格挡视觉反馈）
- 确保死亡回退动画流畅

---

### 阶段三：战斗属性系统扩展

#### 任务 3.1：玩家次要属性扩展
**文件**：`src/managers/PlayerManager.ts`、`src/types/index.ts`、`public/Configs/config.json`

**新增属性**：

| 属性 | 说明 | 默认值 |
|------|------|--------|
| `comboRate` | 连击触发概率 | 0 |
| `comboDamage` | 连击额外伤害倍率 | 0.5 |
| `counterRate` | 反击触发概率 | 0 |
| `counterDamage` | 反击伤害倍率 | 0.5 |
| `blockRate` | 格挡概率 | 0 |
| `blockReduction` | 格挡减伤比例 | 0.3 |
| `shield` | 当前护盾值 | 0 |
| `maxShield` | 最大护盾值 | 0 |

**类型定义更新**（`src/types/index.ts`）：
```typescript
export interface PlayerInitial {
  // ... 现有属性
  comboRate: number;
  comboDamage: number;
  counterRate: number;
  counterDamage: number;
  blockRate: number;
  blockReduction: number;
  shield: number;
  maxShield: number;
}

export interface Player {
  // ... 现有属性
  comboRate: number;
  comboDamage: number;
  counterRate: number;
  counterDamage: number;
  blockRate: number;
  blockReduction: number;
  shield: number;
  maxShield: number;
}
```

**配置更新**：
```json
"player": {
    "initial": {
        "comboRate": 0, "comboDamage": 0.5,
        "counterRate": 0, "counterDamage": 0.5,
        "blockRate": 0, "blockReduction": 0.3,
        "shield": 0, "maxShield": 0
    }
}
```

---

#### 任务 3.2：连击系统实现
**文件**：`src/managers/BattleManager.ts`

**机制设计**：
- 每次攻击有 `comboRate` 概率触发连击
- 连击造成额外攻击，伤害为原伤害的 `comboDamage` 倍
- 连击可连续触发（上限3次）

```typescript
performCombo(baseDamage: number): number {
    let comboCount = 0;
    let totalDamage = 0;
    while (Math.random() < this.comboRate && comboCount < 3) {
        comboCount++;
        totalDamage += baseDamage * this.comboDamage;
    }
    return totalDamage;
}
```

---

#### 任务 3.3：反击系统实现
**文件**：`src/managers/BattleManager.ts`

**机制设计**：
- 受到攻击后有 `counterRate` 概率触发反击
- 反击伤害 = 攻击力 × `counterDamage`
- 反击不计入连击

---

#### 任务 3.4：格挡与护盾系统
**文件**：`src/managers/BattleManager.ts`

**格挡机制**：
- 受到攻击时有 `blockRate` 概率触发格挡
- 格挡时伤害减少 `blockReduction` 比例

**护盾机制**：
- 护盾优先于HP吸收伤害
- 护盾耗尽后伤害溢出到HP
- 护盾值可通过装备/技能获得

---

#### 任务 3.5：怪物属性精简
**文件**：`public/Configs/config.json`

**改造内容**：
- 保留怪物 `critRate` 和 `dodgeRate`
- 移除其他次要属性（如果有）

---

#### 任务 3.6：装备属性扩展
**文件**：`src/types/index.ts`、`public/Configs/config.json`

**类型定义更新**：
```typescript
export interface Weapon {
  id: string;
  name: string;
  icon: string;
  atk: number;
  materials: Record<string, number>;
  comboRate?: number;
  comboDamage?: number;
  counterRate?: number;
  counterDamage?: number;
  blockRate?: number;
  blockReduction?: number;
  shield?: number;
  maxShield?: number;
}

export interface Armor {
  id: string;
  name: string;
  icon: string;
  def: number;
  materials: Record<string, number>;
  comboRate?: number;
  comboDamage?: number;
  counterRate?: number;
  counterDamage?: number;
  blockRate?: number;
  blockReduction?: number;
  shield?: number;
  maxShield?: number;
}
```

**配置示例**：
```json
{
    "id": "flameBlade",
    "name": "炎之刃",
    "atk": 30,
    "comboRate": 0.1,
    "comboDamage": 0.2,
    "materials": { ... }
}
```

---

### 阶段四：系统集成与测试

#### 任务 4.1：UI更新
**文件**：`src/managers/UIManager.ts`、`index.html`、`src/style.css`

**改造内容**：
- 添加护盾条显示
- 添加次要属性面板（连击/反击/格挡/护盾）
- 更新BOSS关卡UI（特殊标识）
- 优化放置战斗的UI反馈

---

#### 任务 4.2：存档迁移
**文件**：`src/managers/PlayerManager.ts`、`src/Game.ts`

**改造内容**：
- 确保旧存档兼容新属性
- 添加数据迁移函数 `migrateToNewVersion()`

---

#### 任务 4.3：平衡性测试
**测试清单**：
- [ ] BOSS关卡难度递增曲线
- [ ] 区域过渡难度衔接
- [ ] 死亡回退体验
- [ ] 新属性数值平衡
- [ ] 放置战斗节奏

---

## 三、文件修改清单

| 文件 | 修改类型 | 改动量 |
|------|----------|--------|
| `public/Configs/config.json` | 扩展配置 | 大 |
| `src/managers/BattleManager.ts` | 核心重构 | 大 |
| `src/types/index.ts` | 类型扩展 | 中 |
| `src/managers/PlayerManager.ts` | 属性扩展 | 中 |
| `src/Game.ts` | 流程改造 | 中 |
| `src/managers/UIManager.ts` | UI更新 | 中 |
| `index.html` | UI结构 | 小 |
| `src/style.css` | 样式更新 | 小 |

---

## 四、部署流程

每次修改代码或配置后，需执行以下命令：

```bash
cd MainGame
npm run build   # TypeScript 编译 + Vite 打包
npm run deploy  # 复制 index.html 到根目录
```

---

## 五、实施顺序建议

```
Week 1: 阶段一（战斗流程）
├── 1.1 放置战斗机制
├── 1.2 BOSS关卡系统
└── 1.3 区域过渡平衡

Week 2: 阶段二（规则优化）+ 阶段三（属性扩展）
├── 2.1 无惩罚死亡
├── 2.2 战斗恢复
├── 3.1-3.4 属性系统实现
└── 3.5-3.6 装备扩展

Week 3: 阶段四（集成测试）
├── 4.1 UI更新
├── 4.2 存档迁移
└── 4.3 平衡性测试
```

---

## 六、风险与注意事项

1. **存档兼容性**：需要确保旧玩家存档能平滑迁移
2. **数值平衡**：新属性可能影响游戏平衡，需要多次迭代测试
3. **性能考虑**：放置战斗的自动循环需要优化，避免内存泄漏
4. **用户体验**：死亡回退不能让玩家感到挫败，需要设计合适的反馈

---

## 七、详细需求参考

### 1. 战斗流程与难度曲线重构

- 实现主角自动持续战斗的放置机制，建立完整的关卡推进系统
- 设计BOSS关卡机制：每5个常规关卡设置1个BOSS关卡，BOSS关卡难度需呈现明显递增趋势
- 区域过渡平衡：BOSS关卡后进入新区域的第一层基础怪物，其难度（包括生命值、攻击力等核心属性）不得低于刚刚击败的BOSS难度的80%，确保玩家体验连贯且具有挑战性
- 建立基于上述规则的可持续玩法循环系统，确保玩家有明确的目标感和进度感

### 2. 战斗规则优化

- 实现无惩罚死亡机制：玩家角色死亡后自动回退至当前关卡的上一层重新开始挑战，并自动取消"自动闯关"
- 设计战斗恢复机制：每成功击败一只怪物后，自动将角色生命值恢复至满值状态
- 确保战斗节奏流畅，死亡回退和生命恢复机制不破坏游戏体验的连贯性

### 3. 战斗属性系统扩展

- 扩展玩家角色战斗属性体系，新增以下核心次要战斗属性，但玩家这些属性初始都是0，只能通过装备和天赋获得：
  - 连击：实现连续攻击机制，设计连击触发条件及伤害加成规则
  - 反击：设计受到攻击后的反击概率及伤害计算方式
  - 格挡：添加格挡机制，包括格挡概率、伤害减免比例等参数
  - 护盾：实现护盾吸收伤害系统，设计护盾值生成及消耗规则
- 怪物属性配置：怪物暂时仅保留暴击和闪避两种次要属性，确保AI行为逻辑与属性系统匹配

### 4. 系统集成与测试要求

- 确保新战斗系统与现有游戏框架无缝集成
- 进行全面的平衡性测试，调整各项属性参数以保证游戏难度曲线平滑
- 测试不同场景下的战斗表现，包括常规关卡、BOSS关卡及区域过渡阶段
- 验证死亡回退和生命恢复机制的稳定性和玩家体验
