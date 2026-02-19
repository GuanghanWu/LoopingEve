# AI游戏测试模拟系统设计方案

## 1. 系统概述

### 1.1 目标
构建基于 Python 状态快照模式的 AI Agent 游戏测试模拟系统，通过多个具备特定用户画像的 Agent 模拟不同类型玩家，生成符合该类型玩家特征的反馈，为游戏迭代提供数据驱动的指导建议。

### 1.2 核心价值
- 替代/补充传统社区公开测试
- 快速获取多类型玩家视角的反馈
- 自动生成迭代优先级建议
- 可视化展示测试结果
- **状态快照支持回放与调试**

### 1.3 架构演进

| 对比项 | 旧架构（JS事件钩子） | 新架构（Python状态快照） |
|--------|---------------------|------------------------|
| 事件耦合 | 紧耦合，需手动维护 emit | 松耦合，从状态差异推断事件 |
| 扩展性 | 新功能需修改多处代码 | 模块化设计，新增模块即可 |
| 动态参数 | 需预先定义事件数据结构 | 状态自动包含所有参数 |
| 代码复用 | 浏览器/Node.js 双份维护 | 独立 Python 引擎，单一维护 |
| 测试能力 | 仅模拟，无法回放 | 完整快照支持回放/调试 |

---

## 2. 系统架构

### 2.1 核心设计原则

**多实例并行模拟**：每个 Agent 绑定独立的 GameEngine 实例，模拟独立玩家的游戏体验。

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Python 模拟系统架构                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐                                                        │
│  │   Config    │                                                        │
│  │  (配置层)    │                                                        │
│  └──────┬──────┘                                                        │
│         │                                                               │
│         ▼                                                               │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                        Simulator                                 │   │
│  │  ┌─────────────────────────────────────────────────────────┐    │   │
│  │  │              Agent-Engine 绑定实例                        │    │   │
│  │  │                                                          │    │   │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │    │   │
│  │  │  │  Agent 1    │  │  Agent 2    │  │  Agent N    │      │    │   │
│  │  │  │  (休闲玩家)  │  │  (硬核玩家)  │  │  (付费玩家)  │      │    │   │
│  │  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘      │    │   │
│  │  │         │                │                │              │    │   │
│  │  │         ▼                ▼                ▼              │    │   │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │    │   │
│  │  │  │ GameEngine 1│  │ GameEngine 2│  │ GameEngine N│      │    │   │
│  │  │  │ (独立状态)   │  │ (独立状态)   │  │ (独立状态)   │      │    │   │
│  │  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘      │    │   │
│  │  │         │                │                │              │    │   │
│  │  │         ▼                ▼                ▼              │    │   │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │    │   │
│  │  │  │ SnapshotMgr1│  │ SnapshotMgr2│  │ SnapshotMgrN│      │    │   │
│  │  │  └─────────────┘  └─────────────┘  └─────────────┘      │    │   │
│  │  │                                                          │    │   │
│  │  └──────────────────────────────────────────────────────────┘    │   │
│  │                              │                                   │   │
│  │                              ▼                                   │   │
│  │                    ┌─────────────────┐                          │   │
│  │                    │    Evaluator    │                          │   │
│  │                    │  (汇总评估)      │                          │   │
│  │                    └────────┬────────┘                          │   │
│  │                             │                                   │   │
│  └─────────────────────────────┼───────────────────────────────────┘   │
│                                │                                        │
│                                ▼                                        │
│                    ┌─────────────────┐                                  │
│                    │    Reporter     │                                  │
│                    │  (报告生成)      │                                  │
│                    └─────────────────┘                                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 各组件职责

| 组件 | 职责 | 关键接口 |
|------|------|----------|
| **Config** | 加载游戏配置（怪物、技能、物品等） | `load(path)` → `GameConfig` |
| **Simulator** | 创建 Agent-Engine 绑定实例，调度并行模拟 | `run(duration)`, `create_instance(agent_config)` |
| **GameEngine** | 纯状态机，执行游戏逻辑（每个 Agent 独立实例） | `get_state()`, `execute(action)` |
| **SnapshotManager** | 快照创建、增量对比、回滚（每个 Agent 独立） | `create()`, `diff(prev, curr)` |
| **Agent** | 基于 State 差异做决策和评估 | `decide(state)`, `analyze_diff(diff)` |
| **Evaluator** | 汇总所有 Agent 的评分，计算整体评估 | `evaluate(agent_reports)` |
| **Reporter** | 生成可视化报告 | `generate_json()`, `generate_html()` |

### 2.3 技术选型

| 组件 | 技术 | 说明 |
|------|------|------|
| 模拟引擎 | Python 3.10+ | 类型安全、丰富的数据分析生态 |
| 状态验证 | Pydantic | 数据模型验证，自动类型转换 |
| 序列化 | orjson/msgpack | 高性能序列化 |
| 数据分析 | pandas/numpy | 报告分析与统计 |
| 可视化 | HTML + Chart.js | 纯静态，任意设备打开 |
| 输出格式 | JSON | 测试结果数据 |

---

## 3. 目录结构

```
crowdagents/
├── engine/                    # Python模拟引擎
│   ├── __init__.py
│   ├── main.py                # 入口文件
│   ├── config.py              # 配置加载
│   ├── state.py               # 状态数据结构定义
│   ├── snapshot.py            # 快照管理
│   ├── engine.py              # 模块化游戏引擎
│   ├── modules/               # 游戏逻辑模块
│   │   ├── __init__.py
│   │   ├── base.py            # 模块基类
│   │   ├── player.py          # 玩家模块
│   │   ├── combat.py          # 战斗模块
│   │   ├── world.py           # 世界模块
│   │   └── inventory.py       # 背包模块
│   ├── agents/                # Agent实现
│   │   ├── __init__.py
│   │   ├── base.py            # Agent基类
│   │   ├── casual.py          # 休闲玩家
│   │   ├── hardcore.py        # 硬核玩家
│   │   ├── explorer.py        # 探索玩家
│   │   ├── social.py          # 社交玩家
│   │   └── paying.py          # 付费玩家
│   ├── evaluator.py           # 多维评价计算
│   ├── analyzer.py            # 反馈分析模块
│   ├── advisor.py             # 迭代建议生成器
│   └── simulator.py           # 模拟器核心
├── config/                    # 配置文件
│   ├── agents.json            # Agent画像配置
│   ├── evaluation.json        # 评价标准配置
│   └── simulation.json        # 模拟参数配置
├── dashboard/                 # 可视化仪表盘
│   ├── index.html             # 仪表盘入口
│   ├── styles.css             # 样式
│   └── app.js                 # 图表渲染
├── output/                    # 输出目录
│   └── report.json            # 测试结果
├── snapshots/                 # 快照存储目录
└── DESIGN.md                  # 本文档
```

---

## 4. 状态快照模式

### 4.1 快照数据结构定义

```python
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from enum import Enum

class SnapshotType(Enum):
    FULL = "full"           # 完整快照
    INCREMENTAL = "incr"    # 增量快照
    CHECKPOINT = "ckpt"     # 检查点（关键节点）

@dataclass
class PlayerState:
    hp: int
    max_hp: int
    mp: int
    max_mp: int
    level: int
    exp: int
    max_exp: int
    atk: int
    defense: int
    gold: int
    crit_rate: float
    dodge_rate: float
    weapon: Optional[str] = None
    armor: Optional[str] = None
    learned_skills: List[str] = field(default_factory=list)
    equipped_skills: List[str] = field(default_factory=list)
    skill_cooldowns: Dict[str, int] = field(default_factory=dict)

@dataclass
class MonsterState:
    id: str
    name: str
    hp: int
    max_hp: int
    atk: int
    defense: int
    crit_rate: float
    dodge_rate: float
    is_boss: bool = False

@dataclass
class InventoryState:
    slots: int
    items: List[Dict[str, Any]] = field(default_factory=list)

@dataclass
class WorldState:
    floor: int
    killed_on_floor: int
    monsters_to_advance: int
    can_advance: bool
    in_battle: bool

@dataclass
class GameState:
    tick: int                              # 模拟时钟
    timestamp: float                       # 真实时间戳
    player: PlayerState
    monster: Optional[MonsterState]
    inventory: InventoryState
    world: WorldState
    snapshot_type: SnapshotType = SnapshotType.FULL
    parent_id: Optional[str] = None        # 父快照ID（用于增量）
```

### 4.2 状态差异记录

```python
@dataclass
class StateDiff:
    tick_from: int
    tick_to: int
    changes: Dict[str, Any]
    events_inferred: List[str]
    
    hp_delta: int = 0
    gold_delta: int = 0
    exp_delta: int = 0
    floor_changed: bool = False
    battle_started: bool = False
    battle_ended: bool = False
    level_up: bool = False
    item_obtained: List[str] = field(default_factory=list)
    item_used: List[str] = field(default_factory=list)
    monster_killed: Optional[str] = None
    player_died: bool = False
```

### 4.3 快照生成策略

| 快照类型 | 触发条件 | 存储大小 | 恢复速度 |
|----------|----------|----------|----------|
| **完整快照** | 每100tick / 关键事件 | 大 | 快 |
| **增量快照** | 普通tick | 小 | 需重建 |
| **检查点** | 升级/楼层推进/死亡 | 中 | 快 |

```python
class SnapshotStrategy:
    def __init__(self):
        self.full_snapshot_interval = 100
        self.checkpoint_triggers = {'level_up', 'floor_advance', 'player_death'}
        self.max_incremental_chain = 20
```

### 4.4 从状态差异推断事件

Agent 不再依赖显式事件，而是通过状态差异推断：

| 状态变化 | 推断事件 |
|----------|----------|
| `hp_delta < 0` | `player_damaged` |
| `hp_delta > 0` 且非升级 | `player_healed` |
| `level` 增加 | `level_up` |
| `floor` 增加 | `floor_advance` |
| `in_battle: False → True` | `battle_start` |
| `in_battle: True → False` | `battle_end` |
| `monster: 有 → 无` | `monster_killed` |
| `hp <= 0` | `player_death` |
| 物品数量增加 | `item_obtain` |
| 物品数量减少 | `item_use` |

---

## 5. Agent模型设计

### 5.1 五种玩家画像

| Agent类型 | 中文名 | 核心特征 | 关注维度 |
|-----------|--------|----------|----------|
| CasualPlayer | 轻度休闲玩家 | 时间少、求放松、怕挫败 | 易上手性、节奏、奖励频率 |
| HardcoreGamer | 硬核竞技玩家 | 追求挑战、深究机制、比拼排名 | 深度、难度、平衡性 |
| StoryExplorer | 剧情探索型玩家 | 重体验、爱收集、关注世界观 | 内容丰富度、探索自由度 |
| SocialPlayer | 社交互动型玩家 | 重交流、爱分享、组队偏好 | 社交功能、合作玩法 |
| PayingUser | 付费习惯型玩家 | 愿付费、求效率、重价值感 | 付费体验、性价比 |

### 5.2 画像参数体系

```
personality (性格特征)     影响情感反应
├─ patience              耐心度      0-1
├─ frustrationTolerance  挫败容忍    0-1
├─ explorationDesire     探索欲望    0-1
├─ competitionDrive      竞争驱动    0-1
├─ riskAppetite          冒险倾向    0-1
└─ persistence           坚持度      0-1

preferences (游戏偏好)     影响决策权重
├─ sessionLength         单局时长偏好  short/medium/long
├─ difficultyPreference  难度偏好      easy/normal/hard
├─ combatVsExplore       战斗vs探索   0-1 (0=纯战斗)
├─ grindTolerance        刷怪容忍度  0-1
├─ rewardSensitivity     奖励敏感度  0-1
└─ immersionNeed         沉浸需求    0-1

behaviorPatterns (行为模式) 影响具体行动
├─ playFrequency         游玩频率
├─ avgSessionMinutes     平均单局时长
├─ quitThreshold         退出阈值条件
├─ decisionSpeed         决策速度    0-1 (高=快速决策)
└─ resourceConservation  资源节约倾向 0-1

skillProfile (能力画像)    影响操作效果
├─ gameSense             游戏理解    0-1
├─ reactionSpeed         反应速度    0-1
├─ strategicThinking     策略思维    0-1
└─ adaptability          适应能力    0-1
```

### 5.3 Agent行为差异

| 决策因素 | 休闲 | 硬核 | 探索 | 社交 | 付费 |
|----------|------|------|------|------|------|
| 生存优先 | 高 | 低 | 中 | 中 | 中 |
| 效率优先 | 低 | 高 | 低 | 中 | 高 |
| 探索优先 | 中 | 中 | 高 | 低 | 低 |
| 风险偏好 | 低 | 高 | 中 | 中 | 中 |
| 资源节约 | 高 | 低 | 中 | 中 | 低 |

### 5.4 画像示例（休闲玩家）

```json
{
    "id": "casual_01",
    "name": "休闲小明",
    "type": "casual",
    "avatar": "🎮",
    "personality": {
        "patience": 0.35,
        "frustrationTolerance": 0.25,
        "explorationDesire": 0.4,
        "competitionDrive": 0.15,
        "riskAppetite": 0.25,
        "persistence": 0.3
    },
    "preferences": {
        "sessionLength": "short",
        "difficultyPreference": "easy",
        "combatVsExplore": 0.45,
        "grindTolerance": 0.25,
        "rewardSensitivity": 0.85,
        "immersionNeed": 0.4
    },
    "behaviorPatterns": {
        "playFrequency": "偶尔",
        "avgSessionMinutes": 15,
        "quitThreshold": { "consecutiveFails": 2 },
        "decisionSpeed": 0.5,
        "resourceConservation": 0.75
    },
    "skillProfile": {
        "gameSense": 0.35,
        "reactionSpeed": 0.4,
        "strategicThinking": 0.25,
        "adaptability": 0.35
    }
}
```

**关键参数说明**：
- `frustrationTolerance` 低(0.25)：容易挫败，需要保护机制
- `quitThreshold` 2次：连续失败2次可能退出
- `rewardSensitivity` 高(0.85)：对奖励敏感，需要频繁反馈

---

## 6. 多维评价矩阵体系

### 6.1 评价矩阵结构

```
              刺激度  成长感  节奏感  可玩性  留存预估  代入感
休闲玩家      1.03    1.49    0.30    0.25    1.51     0.00
硬核玩家      1.88    1.66    0.42    0.00    0.00     0.00
探索玩家      1.94    1.24    0.05    0.35    0.45     0.00
社交玩家      1.84    1.26    0.00    0.09    0.55     0.00
付费玩家      1.93    1.23    0.00    0.50    0.63     0.00
──────────────────────────────────────────────────────────
均值         1.57    1.15    0.14    0.44    0.29     0.00
```

### 6.2 评价维度定义

| 维度ID | 名称 | 定义 | 测量指标 |
|--------|------|------|----------|
| excitement | 刺激度 | 战斗的紧张感和刺激程度 | HP危险次数、暴击/闪避等 |
| growth | 成长感 | 升级和变强的满足感 | 升级频率、装备获取 |
| pacing | 节奏感 | 游戏进程的流畅度 | 战斗间隔、推进速度 |
| playability | 可玩性 | 游戏机制的趣味程度 | 技能使用多样性 |
| retention | 留存预估 | 玩家继续游玩的意愿 | 死亡次数、弃游倾向 |
| immersion | 代入感 | 与游戏世界建立情感连接 | 世界观呈现、探索深度 |

### 6.3 Agent个性化权重

不同Agent类型对各维度的敏感度不同：

| 维度 | 休闲 | 硬核 | 探索 | 社交 | 付费 |
|------|------|------|------|------|------|
| excitement | 0.6 | 1.5 | 0.7 | 0.8 | 1.0 |
| growth | 1.2 | 0.8 | 1.0 | 0.9 | 1.5 |
| pacing | 1.5 | 0.6 | 0.8 | 1.0 | 1.2 |
| playability | 0.8 | 1.5 | 1.2 | 0.7 | 0.8 |
| retention | 1.0 | 0.8 | 1.3 | 0.6 | 1.0 |
| immersion | 0.7 | 0.5 | 1.5 | 1.0 | 0.6 |

### 6.4 评分计算流程

```
状态差异 → 推断事件 → 匹配因素规则 → 应用频率乘数 → 正则化检查 → 累加维度分数
```

### 6.5 正则化规则（能量守恒）

评分系统采用**正则化设计**，确保评分公平可控：

| 规则 | 值 | 说明 |
|------|-----|------|
| 基准分 | 0 | 所有维度从0开始 |
| 正面累积上限 | +10 | 每个维度正面因素最多加10分 |
| 负面累积上限 | -10 | 每个维度负面因素最多减10分 |
| 最终分数范围 | 0~10 | `max(0, min(10, 0 + 正面累积 - 负面累积))` |

**单因素累积上限**：每个因素有独立的累积上限，防止单一因素过度影响评分：

```python
# 示例：战斗胜利（高频事件）
{
    "baseScore": 0.1,       # 基础分
    "frequency": "high",    # 高频 → 实际 0.1 × 0.3 = 0.03
    "maxAccumulated": 0.5   # 最多累积0.5分（需触发约17次）
}

# 示例：升级（低频事件）
{
    "baseScore": 0.5,       # 基础分
    "frequency": "low",     # 低频 → 实际 0.5 × 1.0 = 0.5
    "maxAccumulated": 2.0   # 最多累积2.0分（需触发4次）
}
```

**频率乘数**：
| 频率 | 乘数 | 说明 | 典型因素 |
|------|------|------|----------|
| high | 0.3 | 高频触发（每场战斗） | 战斗胜利、使用技能 |
| medium | 0.6 | 中频触发（每几分钟） | 长时间无升级 |
| low | 1.0 | 低频触发（稀有事件） | 升级、获得传说物品 |

> **详细因素定义**：所有维度的正面/负面因素、触发条件、累积上限详见 [EvaluationDimension.md](./engine/EvaluationDimension.md)

### 6.6 维度评分因素示例

| 维度 | 正面因素 | 负面因素 |
|------|----------|----------|
| excitement | 险胜(+0.8)、暴击(+0.15) | 战斗太简单(-0.25) |
| growth | 升级(+1.0)、稀有掉落(+1.5) | 长时间无提升(-0.3) |
| pacing | 快速战斗(+0.3) | 进度停滞(-0.5) |
| playability | 使用新技能(+0.6)、锻造(+0.8) | 重复操作(-0.5) |
| retention | 到达新楼层(+0.7) | 死亡(-1.0)、连续死亡(-0.5) |
| immersion | 首次遇到怪物(+0.8) | 重复刷怪(-0.3) |

---

## 7. 模块化游戏引擎

### 7.1 模块基类

```python
from abc import ABC, abstractmethod

class GameModule(ABC):
    @property
    @abstractmethod
    def module_id(self) -> str:
        pass
    
    @property
    @abstractmethod
    def dependencies(self) -> List[str]:
        pass
    
    @abstractmethod
    def get_state(self) -> Dict[str, Any]:
        pass
    
    @abstractmethod
    def set_state(self, state: Dict[str, Any]) -> None:
        pass
    
    @abstractmethod
    def process_action(self, action: Action, context: GameContext) -> ActionResult:
        pass
```

### 7.2 核心模块

| 模块 | ID | 依赖 | 职责 |
|------|-----|------|------|
| PlayerModule | player | 无 | 玩家属性、技能、装备 |
| WorldModule | world | player | 楼层、进度、探索 |
| CombatModule | combat | player, world | 战斗逻辑、伤害计算 |
| InventoryModule | inventory | player | 物品、背包、锻造 |

### 7.3 行动类型

```python
class ActionType(Enum):
    ATTACK = "attack"
    DEFEND = "defend"
    USE_SKILL = "use_skill"
    USE_ITEM = "use_item"
    EXPLORE = "explore"
    NEXT_FLOOR = "next_floor"
    FORGE = "forge"
```

### 7.4 模块间通信

```python
class GameContext:
    def __init__(self, engine: ModularGameEngine):
        self.engine = engine
        self._shared_data: Dict[str, Any] = {}
    
    def get_module(self, module_id: str) -> Optional[GameModule]:
        return self.engine.get_module(module_id)
    
    def set_shared(self, key: str, value: Any):
        self._shared_data[key] = value
    
    def get_shared(self, key: str, default: Any = None) -> Any:
        return self._shared_data.get(key, default)
```

---

## 8. 功能模块开发

### 8.1 状态捕获与存储

```python
class StateCapture(Protocol):
    def capture_state(self) -> Dict[str, Any]:
        ...
    
    def restore_state(self, state: Dict[str, Any]) -> None:
        ...

class StateManager:
    def __init__(self):
        self._entities: Dict[str, StateCapture] = {}
    
    def register(self, name: str, entity: StateCapture):
        self._entities[name] = entity
    
    def capture_all(self, tick: int) -> GameState:
        states = {}
        for name, entity in self._entities.items():
            states[name] = entity.capture_state()
        return GameState(tick=tick, timestamp=time.time(), **states)
```

### 8.2 快照管理器

```python
class SnapshotManager:
    def __init__(self, store: SnapshotStore):
        self.store = store
        self.strategy = SnapshotStrategy()
        self._snapshots: List[SnapshotMetadata] = []
        self._rollback_points: Dict[RollbackPoint, str] = {}
    
    def create_snapshot(self, tick: int, state: GameState, events: List[str] = None) -> str:
        snapshot_type = self.strategy.should_create_snapshot(tick, ...)
        state.snapshot_type = snapshot_type
        return self.store.save(state)
    
    def rollback(self, point: RollbackPoint) -> Optional[GameState]:
        snapshot_id = self._rollback_points[point]
        return self.store.restore_to(snapshot_id)
    
    def _compute_diff(self, prev: GameState, curr: GameState) -> StateDiff:
        # 计算状态差异并推断事件
        ...
```

### 8.3 模拟器核心

模拟器通过 **多实例并行模拟** 驱动整个模拟过程：

#### 8.3.1 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                      Tick 循环流程                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Simulator                                                  │
│  ├── AgentInstance 1 (休闲玩家)                             │
│  │   ┌──────────┐    ┌──────────┐    ┌──────────┐         │
│  │   │ 1.快照   │───>│ 2.Agent  │───>│ 3.执行   │         │
│  │   │ 当前状态  │    │   决策    │    │   行动    │         │
│  │   └──────────┘    └──────────┘    └──────────┘         │
│  │        ▲                                 │               │
│  │        │                                 ▼               │
│  │   ┌──────────┐    ┌──────────┐    ┌──────────┐         │
│  │   │ 6.下一   │<───│ 5.Agent  │<───│ 4.快照   │         │
│  │   │   tick   │    │ 分析差异  │    │   新状态  │         │
│  │   └──────────┘    └──────────┘    └──────────┘         │
│  │                                                         │
│  ├── AgentInstance 2 (硬核玩家)  ← 独立状态，独立循环       │
│  │                                                         │
│  └── AgentInstance N (付费玩家)  ← 独立状态，独立循环       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 8.3.2 核心实现

```python
@dataclass
class AgentInstance:
    agent: AgentBase
    engine: GameEngine
    snapshot_manager: SnapshotManager

class Simulator:
    def __init__(self, config: SimulationConfig, game_config: GameConfig):
        self.config = config
        self.game_config = game_config
        self.instances: List[AgentInstance] = []
        self.tick = 0
    
    def create_instance(self, agent_config: Dict[str, Any]) -> AgentInstance:
        agent = AgentBase.create(agent_config)
        engine = GameEngine(self.game_config)
        snapshot_manager = SnapshotManager()
        
        agent.set_engine(engine)
        
        instance = AgentInstance(
            agent=agent,
            engine=engine,
            snapshot_manager=snapshot_manager
        )
        self.instances.append(instance)
        return instance
    
    def run(self, duration_ms: int) -> Dict[str, Any]:
        end_tick = duration_ms // self.config.tick_interval_ms
        
        while self.tick < end_tick:
            self.tick += 1
            self._run_tick()
        
        return self._generate_result()
    
    def _run_tick(self):
        for instance in self.instances:
            self._run_instance_tick(instance)
    
    def _run_instance_tick(self, instance: AgentInstance):
        engine = instance.engine
        agent = instance.agent
        snapshot_mgr = instance.snapshot_manager
        
        prev_state = engine.get_state()
        
        action = agent.decide(prev_state)
        engine.execute(action)
        
        curr_state = engine.get_state()
        snapshot_mgr.create_snapshot(self.tick, curr_state)
        
        diff = snapshot_mgr._compute_diff(prev_state, curr_state)
        agent.analyze_state_change(prev_state, curr_state, diff)
    
    def _generate_result(self) -> Dict[str, Any]:
        agent_reports = [inst.agent.get_report() for inst in self.instances]
        
        evaluator = Evaluator()
        evaluation = evaluator.evaluate(agent_reports)
        
        reporter = Reporter()
        return reporter.generate(evaluation)
```

#### 8.3.3 关键设计点

| 设计点 | 说明 |
|--------|------|
| **独立实例** | 每个 Agent 绑定独立的 GameEngine，状态完全隔离 |
| **并行模拟** | 多个 Agent 同时模拟，互不干扰 |
| **状态驱动** | Agent 决策完全基于当前状态，不依赖显式事件 |
| **差异推断** | 状态差异自动推断事件类型（见第4.4节） |
| **评分独立** | 每个 Agent 维护独立的维度评分 |

#### 8.3.4 并行优化（可选）

对于大规模模拟，可使用多进程并行：

```python
from multiprocessing import Pool

class ParallelSimulator(Simulator):
    def run(self, duration_ms: int) -> Dict[str, Any]:
        end_tick = duration_ms // self.config.tick_interval_ms
        
        with Pool(processes=len(self.instances)) as pool:
            results = pool.map(
                self._run_instance_simulation,
                [(inst, end_tick) for inst in self.instances]
            )
        
        return self._aggregate_results(results)
```

### 8.4 Agent基类

Agent 基类负责决策和评分，每个 Agent 实例绑定独立的 GameEngine：

```python
class AgentBase:
    @classmethod
    def create(cls, config: Dict[str, Any]) -> 'AgentBase':
        agent_classes = {
            'casual': CasualAgent,
            'hardcore': HardcoreAgent,
            'explorer': ExplorerAgent,
            'social': SocialAgent,
            'paying': PayingAgent,
        }
        agent_class = agent_classes.get(config.get('type'), cls)
        return agent_class(config)
    
    def __init__(self, config: Dict[str, Any]):
        self.id = config['id']
        self.name = config['name']
        self.type = config['type']
        self.personality = config.get('personality', {})
        self.preferences = config.get('preferences', {})
        self.behavior_patterns = config.get('behaviorPatterns', {})
        
        self.engine: Optional[GameEngine] = None
        self._prev_state: Optional[GameState] = None
        self._consecutive_fails = 0
        
        self.dimension_scores = {
            'excitement': 0.0,
            'growth': 0.0,
            'pacing': 0.0,
            'playability': 0.0,
            'retention': 0.0,
            'immersion': 0.0
        }
    
    def set_engine(self, engine: GameEngine):
        self.engine = engine
    
    def decide(self, state: GameState) -> Action:
        return Action(ActionType.ATTACK)
    
    def analyze_state_change(self, prev: GameState, curr: GameState, diff: StateDiff):
        for event in diff.events_inferred:
            self._process_event(event, diff)
    
    def _process_event(self, event: str, diff: StateDiff):
        handlers = {
            'player_damaged': self._on_damage,
            'level_up': self._on_level_up,
            'floor_advance': self._on_floor_advance,
            'battle_start': self._on_battle_start,
            'battle_end': self._on_battle_end,
            'item_obtain': self._on_item_obtain,
            'player_death': self._on_death,
        }
        handler = handlers.get(event)
        if handler:
            handler(diff)
    
    def _adjust_score(self, dimension: str, delta: float):
        if dimension in self.dimension_scores:
            self.dimension_scores[dimension] = max(0, min(10, 
                self.dimension_scores[dimension] + delta))
    
    def get_quit_threshold(self) -> int:
        return self.behavior_patterns.get('quitThreshold', {}).get('consecutiveFails', 999)
    
    def get_report(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'name': self.name,
            'type': self.type,
            'dimension_scores': self.dimension_scores,
        }
```

### 8.5 Agent 决策逻辑

不同类型 Agent 根据人格参数做出不同决策：

```python
class CasualAgent(AgentBase):
    def decide(self, state: GameState) -> Action:
        if state.player.hp < state.player.max_hp * 0.3:
            if self._has_healing_item(state):
                return Action(ActionType.USE_ITEM, target=self._get_healing_item())
        
        if state.world.can_advance:
            return Action(ActionType.NEXT_FLOOR)
        
        if not state.world.in_battle:
            return Action(ActionType.EXPLORE)
        
        return Action(ActionType.ATTACK)

class HardcoreAgent(AgentBase):
    def decide(self, state: GameState) -> Action:
        if state.world.can_advance:
            return Action(ActionType.NEXT_FLOOR)
        
        if not state.world.in_battle:
            return Action(ActionType.EXPLORE)
        
        if self._has_skill_ready(state) and self._should_use_skill(state):
            return Action(ActionType.USE_SKILL, params={'skill_id': self._get_best_skill()})
        
        return Action(ActionType.ATTACK)
```

**决策差异**：

| Agent类型 | 低HP时 | 有技能时 | 可推进时 |
|-----------|--------|----------|----------|
| 休闲 | 优先使用物品 | 随机使用 | 立即推进 |
| 硬核 | 继续战斗 | 最优技能 | 立即推进 |
| 探索 | 优先使用物品 | 保留 | 继续探索 |
| 社交 | 优先使用物品 | 辅助技能 | 等待 |
| 付费 | 使用最佳物品 | 全力输出 | 立即推进 |

### 8.6 Evaluator 评估器

评估器汇总所有 Agent 的评分，计算整体评估：

```python
class Evaluator:
    def __init__(self, config: Dict[str, Any]):
        self.weights = config.get('dimension_weights', {})
    
    def evaluate(self, agent_reports: List[Dict]) -> Dict[str, Any]:
        dimension_scores = self._aggregate_dimensions(agent_reports)
        overall_score = self._calculate_overall(dimension_scores)
        issues = self._identify_issues(agent_reports)
        
        return {
            'dimension_scores': dimension_scores,
            'overall_score': overall_score,
            'issues': issues,
            'agent_count': len(agent_reports)
        }
    
    def _aggregate_dimensions(self, reports: List[Dict]) -> Dict[str, float]:
        dimensions = ['excitement', 'growth', 'pacing', 'playability', 'retention', 'immersion']
        result = {}
        
        for dim in dimensions:
            scores = [r['dimension_scores'].get(dim, 0) for r in reports]
            result[dim] = sum(scores) / len(scores) if scores else 0
        
        return result
    
    def _identify_issues(self, reports: List[Dict]) -> List[Dict]:
        issues = []
        
        for report in reports:
            for dim, score in report['dimension_scores'].items():
                if score < 1.0:
                    issues.append({
                        'agent': report['name'],
                        'dimension': dim,
                        'score': score,
                        'severity': 'low' if score < 0.5 else 'medium'
                    })
        
        return sorted(issues, key=lambda x: x['score'])
```

### 8.7 Advisor 建议生成器

基于评估结果生成迭代建议：

```python
class Advisor:
    def generate_suggestions(self, evaluation: Dict) -> List[Dict]:
        suggestions = []
        
        for dim, score in evaluation['dimension_scores'].items():
            if score < 2.0:
                suggestions.append({
                    'priority': 'high',
                    'dimension': dim,
                    'suggestion': self._get_improvement_suggestion(dim, score),
                    'affected_agents': self._get_affected_agents(evaluation, dim)
                })
        
        return sorted(suggestions, key=lambda x: x['priority'])
    
    def _get_improvement_suggestion(self, dimension: str, score: float) -> str:
        suggestions = {
            'excitement': '增加战斗变数，如暴击、闪避、特殊技能',
            'growth': '加快升级节奏，增加装备获取途径',
            'pacing': '优化战斗节奏，减少无意义等待',
            'playability': '增加技能多样性，丰富战斗策略',
            'retention': '降低死亡惩罚，增加保护机制',
            'immersion': '丰富怪物种类，增加探索奖励'
        }
        return suggestions.get(dimension, '需要进一步分析')
```

### 8.8 报告输出格式

```json
{
    "meta": {
        "timestamp": "2025-01-15T10:30:00Z",
        "duration_ms": 120000,
        "total_ticks": 1200,
        "agent_count": 5
    },
    "evaluation": {
        "overall_score": 3.45,
        "dimension_scores": {
            "excitement": 1.57,
            "growth": 1.15,
            "pacing": 0.14,
            "playability": 0.44,
            "retention": 0.29,
            "immersion": 0.00
        }
    },
    "agents": [
        {
            "id": "casual_01",
            "name": "休闲小明",
            "type": "casual",
            "dimension_scores": {
                "excitement": 1.03,
                "growth": 1.49,
                "pacing": 0.30,
                "playability": 0.25,
                "retention": 1.51,
                "immersion": 0.00
            },
            "stats": {
                "battles": 45,
                "kills": 42,
                "deaths": 1,
                "levels_gained": 3,
                "floors_reached": 5
            }
        }
    ],
    "issues": [
        {
            "dimension": "immersion",
            "severity": "high",
            "score": 0.00,
            "suggestion": "丰富怪物种类，增加探索奖励"
        }
    ],
    "suggestions": [
        {
            "priority": "high",
            "dimension": "immersion",
            "suggestion": "丰富怪物种类，增加探索奖励",
            "affected_agents": ["休闲小明", "硬核达人", "探索玩家"]
        }
    ]
}
```

### 8.9 游戏结束条件

| 条件 | 触发 | 说明 |
|------|------|------|
| 时间限制 | `tick >= max_ticks` | 默认2分钟 |
| 玩家死亡 | `hp <= 0` | 可配置是否继续 |
| 通关 | `floor >= max_floor` | 到达最终楼层 |
| 弃游 | 连续失败次数超阈值 | Agent 人格决定 |

```python
class Simulator:
    def _check_end_conditions(self, instance: AgentInstance) -> bool:
        state = instance.engine.get_state()
        agent = instance.agent
        
        if state.player.hp <= 0:
            return True
        
        if state.world.floor >= self.game_config.max_floor:
            return True
        
        if agent._consecutive_fails >= agent.get_quit_threshold():
            return True
        
        return False
```

### 8.10 日志与错误处理

```python
import logging

class SimulationLogger:
    def __init__(self, log_level: str = "INFO"):
        self.logger = logging.getLogger("CrowdAgents")
        self.logger.setLevel(getattr(logging, log_level))
        
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter(
            '%(asctime)s [%(levelname)s] %(message)s'
        ))
        self.logger.addHandler(handler)
    
    def log_tick(self, tick: int, agent_id: str, action: Action):
        self.logger.debug(f"Tick {tick}: Agent {agent_id} -> {action.type}")
    
    def log_event(self, agent_id: str, event: str, data: Dict):
        self.logger.info(f"Agent {agent_id}: {event} - {data}")
    
    def log_error(self, agent_id: str, error: Exception):
        self.logger.error(f"Agent {agent_id} error: {error}")

class SafeAgentWrapper:
    def __init__(self, agent: AgentBase, logger: SimulationLogger):
        self.agent = agent
        self.logger = logger
    
    def decide(self, state: GameState) -> Action:
        try:
            return self.agent.decide(state)
        except Exception as e:
            self.logger.log_error(self.agent.id, e)
            return Action(ActionType.ATTACK)  # 默认行动
    
    def analyze_state_change(self, prev: GameState, curr: GameState, diff: StateDiff):
        try:
            self.agent.analyze_state_change(prev, curr, diff)
        except Exception as e:
            self.logger.log_error(self.agent.id, e)
```

### 8.11 快照回放调试

```python
class SnapshotReplayer:
    def __init__(self, snapshot_dir: str):
        self.snapshot_dir = Path(snapshot_dir)
        self.store = SnapshotStore(snapshot_dir)
    
    def replay(self, snapshot_id: str):
        state = self.store.restore_to(snapshot_id)
        print(f"=== Snapshot: {snapshot_id} ===")
        print(f"Tick: {state.tick}")
        print(f"Player HP: {state.player.hp}/{state.player.max_hp}")
        print(f"Floor: {state.world.floor}")
        print(f"In Battle: {state.world.in_battle}")
    
    def replay_range(self, from_tick: int, to_tick: int):
        for tick in range(from_tick, to_tick + 1):
            snapshot_id = f"snap_{tick}_*"
            matches = list(self.snapshot_dir.glob(snapshot_id))
            if matches:
                self.replay(matches[0].stem)
    
    def diff_range(self, from_tick: int, to_tick: int) -> List[StateDiff]:
        diffs = []
        prev_state = None
        
        for tick in range(from_tick, to_tick + 1):
            state = self._load_state_at_tick(tick)
            if state and prev_state:
                diff = self._compute_diff(prev_state, state)
                diffs.append(diff)
            prev_state = state
        
        return diffs
```

---

## 9. 风险评估

### 9.1 性能风险

| 风险项 | 影响程度 | 触发条件 | 缓解措施 |
|--------|----------|----------|----------|
| 快照操作延迟 | 高 | 每tick创建快照 | 增量快照 + 异步持久化 |
| 内存占用过高 | 高 | 大量历史快照缓存 | LRU缓存 + 定期清理 |
| 状态差异计算开销 | 中 | 复杂状态结构 | 字段级差异缓存 |
| 序列化瓶颈 | 中 | 大状态对象 | msgpack 替代 JSON |

**性能基准**：
- 目标 TPS：100 ticks/秒
- 单tick最大耗时：10ms
- 最大内存占用：256MB
- 单快照最大大小：50KB

### 9.2 数据一致性风险

| 风险项 | 场景 | 影响 | 解决方案 |
|--------|------|------|----------|
| 快照捕获不完整 | 状态变更中途捕获 | 恢复后状态错误 | 捕获时冻结状态 |
| 增量重建失败 | 父快照丢失 | 无法恢复完整状态 | 定期完整快照 |
| 并发写入冲突 | 多线程同时修改状态 | 状态损坏 | 写时复制 (COW) |
| 序列化丢失精度 | 浮点数序列化 | 数值偏差 | 使用 Decimal |

### 9.3 资源消耗风险

| 资源类型 | 消耗场景 | 风险等级 | 控制策略 |
|----------|----------|----------|----------|
| 磁盘空间 | 快照持久化 | 中 | 压缩存储 + 定期清理 |
| 内存 | 快照缓存 | 高 | LRU淘汰 + 内存限制 |
| CPU | 差异计算 | 中 | 增量计算 + 结果缓存 |
| 文件句柄 | 并发读写 | 低 | 连接池 + 自动关闭 |

---

## 10. 技术难点分析

### 10.1 状态数据的高效序列化

| 序列化器 | 速度 | 大小 | 特点 |
|----------|------|------|------|
| json | 1.0x | 1.0x | 标准、可读 |
| orjson | 5.2x | 0.95x | 快速JSON |
| msgpack | 4.8x | 0.7x | 二进制紧凑 |
| pickle | 3.5x | 0.85x | Python原生 |

推荐使用 **orjson** 或 **msgpack**。

### 10.2 处理循环引用

```python
class CircularReferenceHandler:
    def capture_with_circular_support(self, obj: Any, path: str = "$") -> Any:
        obj_id = id(obj)
        if obj_id in self._visited:
            return {"$ref": self._visited[obj_id]}
        self._visited[obj_id] = path
        # ... 递归处理
```

### 10.3 增量快照实现

```python
@dataclass
class FieldDiff:
    field_path: str
    old_value: Any
    new_value: Any
    change_type: str  # 'add', 'remove', 'modify'

class IncrementalSnapshotEngine:
    def compute_diff(self, old_state: Dict, new_state: Dict, prefix: str = "") -> List[FieldDiff]:
        # 递归计算字段级差异
        ...
    
    def apply_incremental(self, base_state: Dict, incremental: IncrementalSnapshot) -> Dict:
        # 应用增量到基础状态
        ...
```

### 10.4 多实例架构的并发

多实例架构天然隔离，无需复杂并发控制：

```python
class ParallelSimulator(Simulator):
    def run_parallel(self, duration_ms: int) -> Dict[str, Any]:
        from concurrent.futures import ProcessPoolExecutor
        
        with ProcessPoolExecutor(max_workers=len(self.instances)) as executor:
            futures = [
                executor.submit(self._run_single_instance, inst, duration_ms)
                for inst in self.instances
            ]
            results = [f.result() for f in futures]
        
        return self._aggregate_results(results)
    
    def _run_single_instance(self, instance: AgentInstance, duration_ms: int) -> Dict:
        end_tick = duration_ms // self.config.tick_interval_ms
        
        for tick in range(end_tick):
            self._run_instance_tick(instance, tick)
            
            if self._check_end_conditions(instance):
                break
        
        return instance.agent.get_report()
```

**优势**：
- 每个 Agent 独立进程，完全隔离
- 无锁竞争，无状态共享
- 可充分利用多核 CPU

---

## 11. 游戏逻辑拓展适配

### 11.1 模块化引擎架构

新增游戏逻辑只需：
1. 创建新的 `GameModule` 子类
2. 实现 `get_state()`, `set_state()`, `process_action()`
3. 注册到 `ModularGameEngine`

无需修改 Agent 或快照系统。

### 11.2 标准化状态接口

```python
class IStateProvider(Protocol[T]):
    def get_state(self) -> T: ...
    def get_state_at(self, tick: int) -> Optional[T]: ...

class IStateConsumer(Protocol[T]):
    def on_state_change(self, old_state: T, new_state: T) -> None: ...
```

### 11.3 配置驱动参数

所有配置集中在 `config/` 目录，通过 `SimulationConfig` 统一管理：

```python
@dataclass
class SimulationConfig:
    tick_interval_ms: int = 100
    max_ticks: int = 1200
    snapshot_interval: int = 100
    random_seed: Optional[int] = None  # None = 随机，指定值 = 可重复
    log_level: str = "INFO"
    agents: List[Dict[str, Any]] = field(default_factory=list)

class GameEngine:
    def __init__(self, config: GameConfig, seed: int = None):
        self.rng = random.Random(seed)
        # 所有随机操作使用 self.rng
```

**随机性控制**：
- 调试时使用固定种子，确保问题可复现
- 正式测试时使用随机种子，覆盖更多场景

### 11.4 依赖管理

**requirements.txt**：
```
pydantic>=2.0.0
orjson>=3.9.0
pandas>=2.0.0
numpy>=1.24.0
```

**Python 版本要求**：Python 3.10+（使用 dataclass、type hints、match 语句等特性）

### 11.5 测试策略

```python
import pytest

class TestGameEngine:
    def test_initial_state(self):
        engine = GameEngine(GameConfig())
        state = engine.get_state()
        assert state.player.hp > 0
        assert state.world.floor == 1
    
    def test_execute_attack(self):
        engine = GameEngine(GameConfig())
        engine.execute(Action(ActionType.EXPLORE))
        state = engine.get_state()
        assert state.world.in_battle

class TestSnapshotManager:
    def test_create_and_restore(self):
        manager = SnapshotManager(SnapshotStore())
        state = GameState(...)
        snapshot_id = manager.create_snapshot(1, state)
        restored = manager.store.restore_to(snapshot_id)
        assert restored.player.hp == state.player.hp

class TestAgentBase:
    def test_dimension_scores_range(self):
        agent = AgentBase({'id': 'test', 'name': 'Test', 'type': 'casual'})
        agent._adjust_score('excitement', 15)
        assert agent.dimension_scores['excitement'] <= 10
        agent._adjust_score('excitement', -15)
        assert agent.dimension_scores['excitement'] >= 0
```

### 11.6 性能优化接口

```python
class AutoOptimizer:
    def optimize(self, metrics: PerformanceMetrics) -> List[str]:
        if metrics.ticks_per_second < 10:
            self._adjust_snapshot_interval(increase=True)
        if metrics.memory_usage_mb > 500:
            self._clear_old_snapshots()
```

---

## 12. 实现步骤

| 阶段 | 状态 | 内容 |
|------|------|------|
| Phase 1 | 🔄 进行中 | GameState 数据结构定义、SnapshotManager 实现 |
| Phase 2 | 待开始 | 模块化 GameEngine 重构（Combat/Player/World/Inventory） |
| Phase 3 | 待开始 | AgentBase 状态差异分析、5种Agent迁移 |
| Phase 4 | 待开始 | Evaluator、Analyzer、Advisor 迁移 |
| Phase 5 | 待开始 | Dashboard 可视化（复用现有 HTML） |
| Phase 6 | 待开始 | 性能优化、并发安全验证 |

---

## 13. 运行方式

```bash
cd crowdagents/engine

# 基础运行（2分钟模拟）
python main.py

# 指定模拟时长
python main.py --duration 180000

# 指定配置文件
python main.py --config ../config/simulation.json

# 启用快照回放调试
python main.py --debug --snapshot-dir ../snapshots

# 生成报告并打开仪表盘
python main.py --dashboard
```

**依赖安装**：
```bash
pip install pydantic orjson pandas numpy
```

---

## 14. 相关文档

- **EvaluationDimension.md** - 评估维度详细文档，包含所有因素的完整定义
- **evaluation.json** - 评价配置文件，包含正则化设置和因素定义
- **agents.json** - Agent画像配置
- **simulation.json** - 模拟参数配置

---

**文档版本**：3.0  

