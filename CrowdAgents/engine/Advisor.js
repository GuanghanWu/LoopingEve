const evaluationConfig = require('../config/evaluation.json');

class Advisor {
    constructor() {
        this.thresholds = evaluationConfig.thresholds;
        this.dimensionNames = evaluationConfig.dimensionNames;
        this.agentTypeNames = evaluationConfig.agentTypeNames;
    }

    generate(analysis, agents = []) {
        const recommendations = [];

        const criticalIssues = analysis.issues.filter(i => i.severity === 'critical');
        const highIssues = analysis.issues.filter(i => i.severity === 'high');
        const mediumIssues = analysis.issues.filter(i => i.severity === 'medium');

        criticalIssues.forEach(issue => {
            recommendations.push({
                priority: 'critical',
                priorityLabel: 'P0',
                action: this.generateAction(issue, agents),
                targetDimensions: [issue.dimension],
                affectedAgents: issue.affectedAgents || [],
                reason: issue.issue,
                impact: 'high'
            });
        });

        highIssues.forEach(issue => {
            recommendations.push({
                priority: 'high',
                priorityLabel: 'P1',
                action: this.generateAction(issue, agents),
                targetDimensions: [issue.dimension],
                affectedAgents: issue.affectedAgents || [],
                reason: issue.issue,
                impact: 'medium'
            });
        });

        mediumIssues.slice(0, 5).forEach(issue => {
            recommendations.push({
                priority: 'medium',
                priorityLabel: 'P2',
                action: this.generateAction(issue, agents),
                targetDimensions: [issue.dimension],
                affectedAgents: issue.affectedAgents || [],
                reason: issue.issue,
                impact: 'low'
            });
        });

        this.addProactiveRecommendations(analysis, recommendations);

        return this.prioritizeRecommendations(recommendations);
    }

    generateAction(issue, agents = []) {
        const dimension = issue.dimension;
        const dimensionName = issue.dimensionName || this.dimensionNames[dimension] || dimension;

        const triggeredFactors = this.analyzeTriggeredFactors(agents, dimension);

        const actions = {
            excitement: {
                low: `增加战斗中的随机事件和刺激元素`,
                critical: this.getExcitementAction(triggeredFactors),
                variance: `平衡不同玩家类型的刺激体验`
            },
            growth: {
                low: `增加升级奖励和装备获取途径`,
                critical: `紧急：优化成长曲线，增加玩家变强的反馈`,
                variance: `确保各类型玩家都能获得适当的成长体验`
            },
            pacing: {
                low: `优化游戏节奏，减少冗余操作`,
                critical: `紧急：调整战斗频率和进度推进速度`,
                variance: `平衡不同玩家类型的节奏偏好`
            },
            playability: {
                low: `增加技能多样性和策略深度`,
                critical: `紧急：优化技能平衡，提升可玩性`,
                variance: `确保休闲玩家也能享受核心玩法`
            },
            retention: {
                low: `降低挫败感，增加留存激励`,
                critical: `紧急：增加保护机制，降低连续失败的惩罚`,
                variance: `针对易流失玩家类型进行优化`
            },
            immersion: {
                low: `增加世界观内容和探索元素`,
                critical: `紧急：丰富游戏内容，增加发现乐趣`,
                variance: `平衡探索型和战斗型玩家的体验`
            }
        };

        if (issue.variance !== undefined) {
            return actions[dimension]?.variance || `平衡${dimensionName}体验`;
        }

        if (issue.severity === 'critical') {
            return actions[dimension]?.critical || `紧急优化${dimensionName}`;
        }

        return actions[dimension]?.low || `优化${dimensionName}`;
    }

    analyzeTriggeredFactors(agents, dimension) {
        const factors = {
            criticalHit: false,
            dodge: false,
            combo: false,
            lowHPBattle: false,
            closeVictory: false,
            comeback: false
        };

        if (!agents || agents.length === 0) return factors;

        agents.forEach(agent => {
            const report = agent.getReport();
            if (report.breakdown) {
                report.breakdown.forEach(b => {
                    if (b.dimension === dimension) {
                        if (b.issue.includes('暴击')) factors.criticalHit = true;
                        if (b.issue.includes('闪避')) factors.dodge = true;
                        if (b.issue.includes('连击')) factors.combo = true;
                        if (b.issue.includes('低血量') || b.issue.includes('残血')) factors.lowHPBattle = true;
                        if (b.issue.includes('险胜') || b.issue.includes('残血胜利')) factors.closeVictory = true;
                        if (b.issue.includes('逆转') || b.issue.includes('翻盘')) factors.comeback = true;
                    }
                });
            }
        });

        return factors;
    }

    getExcitementAction(factors) {
        const missing = [];
        if (!factors.criticalHit) missing.push('暴击');
        if (!factors.dodge) missing.push('闪避');
        if (!factors.combo) missing.push('连击');
        if (!factors.lowHPBattle) missing.push('低血量战斗');
        if (!factors.closeVictory) missing.push('险胜');
        if (!factors.comeback) missing.push('翻盘');

        if (missing.length === 0) {
            return `刺激度评分偏低，建议提高刺激事件的触发频率或增加分数奖励`;
        }

        return `刺激度偏低，缺少以下刺激事件的有效触发：${missing.join('、')}。建议检查这些机制的触发条件或提高触发概率`;
    }

    addProactiveRecommendations(analysis, recommendations) {
        const matrix = analysis.summary;

        if (analysis.patterns && analysis.patterns.length > 0) {
            const highDeathPatterns = analysis.patterns.filter(p => p.type === 'death' && p.value > 3);
            highDeathPatterns.forEach(pattern => {
                recommendations.push({
                    priority: 'medium',
                    priorityLabel: 'P2',
                    action: `针对 ${this.agentTypeNames[pattern.agentType] || pattern.agentType} 类型玩家优化难度`,
                    targetDimensions: ['retention', 'pacing'],
                    affectedAgents: [pattern.agentType],
                    reason: pattern.message,
                    impact: 'medium'
                });
            });
        }

        if (analysis.insights) {
            const weaknessInsights = analysis.insights.filter(i => i.type === 'weakness');
            weaknessInsights.forEach(insight => {
                if (!recommendations.some(r => r.targetDimensions.includes(insight.dimension))) {
                    recommendations.push({
                        priority: 'low',
                        priorityLabel: 'P3',
                        action: `持续优化${this.dimensionNames[insight.dimension] || insight.dimension}`,
                        targetDimensions: [insight.dimension],
                        affectedAgents: [],
                        reason: insight.message,
                        impact: 'low'
                    });
                }
            });
        }
    }

    prioritizeRecommendations(recommendations) {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

        return recommendations.sort((a, b) => {
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });
    }

    formatForDisplay(recommendations) {
        const grouped = {
            critical: [],
            high: [],
            medium: [],
            low: []
        };

        recommendations.forEach(rec => {
            if (grouped[rec.priority]) {
                grouped[rec.priority].push(rec);
            }
        });

        return grouped;
    }

    generateActionPlan(recommendations) {
        const plan = {
            immediate: [],
            shortTerm: [],
            longTerm: []
        };

        recommendations.forEach(rec => {
            const item = {
                action: rec.action,
                target: rec.targetDimensions.map(d => this.dimensionNames[d] || d).join('、'),
                reason: rec.reason
            };

            if (rec.priority === 'critical') {
                plan.immediate.push(item);
            } else if (rec.priority === 'high') {
                plan.shortTerm.push(item);
            } else {
                plan.longTerm.push(item);
            }
        });

        return plan;
    }
}

module.exports = Advisor;
