# 项目规则

## 项目结构

| 目录 | 说明 |
|------|------|
| `MainGame/` | 游戏本体（前端），包含 HTML/CSS/JS |
| `crowdagents/` | CrowdAgents 模拟器 |
| `Researches/` | 游戏设计研究报告 |

当用户提到"游戏"、"战斗系统"、"背包"、"技能"等游戏相关功能时，指的是 `MainGame/` 目录下的代码。

## 版本控制

- 所有代码提交都必须通过Trae CI/CD流程
- 每个版本都必须有详细的修改日志（CHANGELOG.md）

## 代码风格

- 清晰的模块划分，函数/类单一职责（建议100行以内）
- 使用有意义的命名，删除未使用的代码
- 复杂逻辑添加注释，简单代码无需注释

## 游戏配置

- 所有玩法数值必须走配置文件（CONFIG），禁止代码写死

## CrowdAgents

CrowdAgents 是游戏玩家行为模拟系统，用于模拟不同类型玩家（休闲、硬核、探索、付费、社交）的游戏行为，评估游戏设计合理性。

**是什么：**
- 模拟器代码：`crowdagents/engine/py/`
- 玩家类型配置：`crowdagents/config/agents.json`
- Python 实现的后端模拟引擎，独立于前端游戏运行

**不是什么：**
- 不是游戏本体（游戏本体在 `MainGame/` 目录）
- 不是前端代码，与 `MainGame/js/` 无关
- 不是实际玩家，是虚拟 Agent 模拟玩家行为

详细规则见 [crowdagents_rules.md](./crowdagents_rules.md)
