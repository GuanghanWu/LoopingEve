# 项目规则

## 代码风格

- 清晰的模块划分，函数/类单一职责（建议100行以内）
- 使用有意义的命名，删除未使用的代码
- 复杂逻辑添加注释，简单代码无需注释

## 游戏配置

- 所有玩法数值必须走配置文件（CONFIG），禁止代码写死

## 事件钩子（CrowdAgents集成）

游戏核心逻辑需触发事件钩子供Agent系统采集数据。

### 触发方式
```javascript
this.emit?.('eventName', data);
```

### 必须触发的事件
- `battleStart` / `battleEnd` - 战斗生命周期
- `playerDamage` / `monsterDamage` - 伤害事件
- `levelUp` - 升级
- `itemObtain` / `itemUse` - 物品获取/使用
- `skillUse` - 技能使用
- `floorAdvance` - 楼层推进
- `playerDeath` - 死亡
- `forgeSuccess` - 锻造成功

### 开发检查
新增/修改功能时检查：
1. 是否需要新增事件钩子？
2. 现有钩子数据结构是否需要更新？
3. 触发时机是否正确（状态变更后触发）

详细事件数据结构见 `CrowdAgents/DESIGN.md`
