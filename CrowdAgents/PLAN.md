# CrowdAgents 参数系统重构计划

## 一、问题分析

### 1.1 当前架构问题

| 组件 | 问题 |
|------|------|
| **agents.json** | 大部分参数未被使用，只是"装饰" |
| **AgentBase.js** | `initExpectations()` 和 `initSensitivity()` 硬编码 |
| **evaluation.json** | 因子规则正常，但与agents.json参数脱节 |

### 1.2 参数使用现状

| 参数类别 | 参数名 | 是否使用 | 使用位置 |
|---------|--------|---------|---------|
| personality | frustrationTolerance | ✅ | AgentBase.js:285, 815 |
| personality | 其他 | ❌ | - |
| preferences | 全部 | ❌ | - |
| behaviorPatterns | quitThreshold | ✅ | 各子类 |
| specialTraits | valueSensitivity | ✅ | PayingUser.js:8 |
| specialTraits | 其他 | ❌ | - |

---

## 二、设计目标

### 2.1 核心目标
1. **让 agents.json 参数真正生效** - 所有参数都有实际作用
2. **保持 evaluation.json 兼容** - 因子规则继续正常工作
3. **保持向后兼容** - 缺失参数时使用默认值

### 2.2 参数影响机制设计

```
agents.json 参数
       ↓
┌──────────────────────────────────────────────────────────┐
│  初始化阶段                                               │
│  ├── expectations ← 从 preferences 读取                  │
│  ├── sensitivity ← 从 personality 读取                   │
│  └── 特殊参数 ← 从 specialTraits 读取                    │
└──────────────────────────────────────────────────────────┘
       ↓
┌──────────────────────────────────────────────────────────┐
│  评分计算阶段                                             │
│  ├── adjustScore() 使用 sensitivity 调整分数             │
│  ├── checkUnmetExpectations() 使用 expectations          │
│  └── 特殊行为使用 specialTraits                          │
└──────────────────────────────────────────────────────────┘
```

---

## 三、具体实现方案

### 3.1 修改 AgentBase.js - initExpectations()

**当前代码**（硬编码）：
```javascript
initExpectations() {
    const baseExpectations = {
        casual: { excitement: 0.4, growth: 0.5, ... },
        hardcore: { excitement: 0.9, growth: 0.7, ... },
        // ...
    };
    return baseExpectations[this.type];
}
```

**修改后**（从config读取）：
```javascript
initExpectations() {
    const defaults = {
        casual: { excitement: 0.4, growth: 0.5, pacing: 0.3, playability: 0.4, retention: 0.6, immersion: 0.3 },
        hardcore: { excitement: 0.9, growth: 0.7, pacing: 0.6, playability: 0.9, retention: 0.4, immersion: 0.2 },
        explorer: { excitement: 0.5, growth: 0.5, pacing: 0.4, playability: 0.7, retention: 0.6, immersion: 0.95 },
        social: { excitement: 0.5, growth: 0.5, pacing: 0.5, playability: 0.5, retention: 0.5, immersion: 0.4 },
        paying: { excitement: 0.6, growth: 0.8, pacing: 0.5, playability: 0.6, retention: 0.6, immersion: 0.3 }
    };
    
    const base = defaults[this.type] || defaults.casual;
    
    return {
        excitement: this.preferences?.excitementExpectation ?? base.excitement,
        growth: this.preferences?.growthExpectation ?? base.growth,
        pacing: this.preferences?.pacingExpectation ?? base.pacing,
        playability: this.preferences?.playabilityExpectation ?? base.playability,
        retention: this.preferences?.retentionExpectation ?? base.retention,
        immersion: this.preferences?.immersionExpectation ?? base.immersion
    };
}
```

### 3.2 修改 AgentBase.js - initSensitivity()

**当前代码**（硬编码）：
```javascript
initSensitivity() {
    const baseSensitivity = {
        casual: { positive: 0.5, negative: 1.5 },
        // ...
    };
    return baseSensitivity[this.type];
}
```

**修改后**（从config读取）：
```javascript
initSensitivity() {
    const defaults = {
        casual: { positive: 0.5, negative: 1.5 },
        hardcore: { positive: 0.8, negative: 0.5 },
        explorer: { positive: 0.7, negative: 1.2 },
        social: { positive: 0.6, negative: 0.8 },
        paying: { positive: 0.6, negative: 0.9 }
    };
    
    const base = defaults[this.type] || defaults.casual;
    
    return {
        positive: this.personality?.positiveSensitivity ?? base.positive,
        negative: this.personality?.negativeSensitivity ?? base.negative
    };
}
```

### 3.3 更新 agents.json - 添加期望值参数

在 `preferences` 中添加期望值参数：

```json
{
    "preferences": {
        "excitementExpectation": 0.4,
        "growthExpectation": 0.5,
        "pacingExpectation": 0.3,
        "playabilityExpectation": 0.4,
        "retentionExpectation": 0.6,
        "immersionExpectation": 0.3
    }
}
```

### 3.4 更新 agents.json - 添加敏感度参数

在 `personality` 中添加敏感度参数：

```json
{
    "personality": {
        "positiveSensitivity": 0.5,
        "negativeSensitivity": 1.5
    }
}
```

### 3.5 实现 specialTraits 使用

在各子类中使用 specialTraits：

**SocialPlayer.js**：
```javascript
// 使用 friendDependency
getFriendDependency() {
    return this.specialTraits?.friendDependency ?? 0.3;
}

// 使用 shareFrequency
getShareFrequency() {
    return this.specialTraits?.shareFrequency ?? 0.5;
}

// 使用 socialNeed
getSocialNeed() {
    return this.specialTraits?.socialNeed ?? 0.5;
}
```

**StoryExplorer.js**：
```javascript
// 使用 completionism
getCompletionism() {
    return this.specialTraits?.completionism ?? 0.5;
}
```

**PayingUser.js**：
```javascript
// 使用 timeValueMultiplier
getTimeValueMultiplier() {
    return this.specialTraits?.timeValueMultiplier ?? 1.0;
}

// 使用 efficiencyWeight
getEfficiencyWeight() {
    return this.specialTraits?.efficiencyWeight ?? 0.32;
}
```

---

## 四、确保 evaluation.json 兼容

### 4.1 验证点

| 验证项 | 说明 |
|-------|------|
| factorRules | 因子规则继续通过 adjustScore() 使用 |
| agentWeights | 继续在 calculateOverallScore() 中使用 |
| frequencyMultipliers | 继续在 adjustScore() 中使用 |
| thresholds | 继续在报告生成中使用 |

### 4.2 不变的部分

- evaluation.json 结构不变
- adjustScore() 逻辑不变
- 因子触发机制不变

---

## 五、实施步骤

### Step 1: 更新 agents.json
- [ ] 为所有5个Agent添加期望值参数
- [ ] 为所有5个Agent添加敏感度参数
- [ ] 验证参数值符合学术研究

### Step 2: 修改 AgentBase.js
- [ ] 修改 initExpectations() 从 config 读取
- [ ] 修改 initSensitivity() 从 config 读取
- [ ] 添加默认值回退机制

### Step 3: 修改子类 Agent
- [ ] SocialPlayer.js 使用 specialTraits
- [ ] StoryExplorer.js 使用 specialTraits
- [ ] PayingUser.js 使用 specialTraits
- [ ] CasualPlayer.js 使用 specialTraits
- [ ] HardcorePlayer.js 使用 specialTraits

### Step 4: 验证测试
- [ ] 运行模拟确保无报错
- [ ] 检查评分结果是否合理
- [ ] 验证 evaluation.json 因子正常触发

---

## 六、预期结果

### 6.1 参数生效验证

| 参数 | 生效方式 |
|------|---------|
| excitementExpectation | 影响 excitement 维度评分计算 |
| growthExpectation | 影响 growth 维度评分计算 |
| positiveSensitivity | 放大正面事件影响 |
| negativeSensitivity | 放大负面事件影响 |
| friendDependency | 影响社交玩家行为决策 |
| timeValueMultiplier | 影响付费玩家效率决策 |
| completionism | 影响探索玩家收集行为 |

### 6.2 向后兼容

- 缺失参数时使用默认值
- 现有 evaluation.json 规则继续工作
- 不影响现有模拟流程

---

## 七、风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 参数缺失导致报错 | 高 | 使用 `??` 运算符提供默认值 |
| 评分结果变化大 | 中 | 保持默认值与原硬编码一致 |
| evaluation.json 不兼容 | 低 | 不修改 evaluation.json 结构 |

---

**计划制定完成，等待用户确认后执行。**
