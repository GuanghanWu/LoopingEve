const evaluationConfig = require('../config/evaluation.json');

class Analyzer {
    constructor() {
        this.thresholds = evaluationConfig.thresholds;
        this.dimensionNames = evaluationConfig.dimensionNames;
    }

    analyze(agents, matrix) {
        const issues = this.identifyIssues(agents, matrix);
        const insights = this.generateInsights(agents, matrix);
        const patterns = this.identifyPatterns(agents);

        return {
            summary: this.generateSummary(agents, matrix),
            issues,
            insights,
            patterns,
            criticalCount: issues.filter(i => i.severity === 'critical' || i.severity === 'high').length
        };
    }

    generateSummary(agents, matrix) {
        const totalPlayTime = agents.reduce((sum, a) => sum + (a.playTime || 0), 0);
        const totalBattles = agents.reduce((sum, a) => sum + (a.stats?.battles || 0), 0);
        const totalDeaths = agents.reduce((sum, a) => sum + (a.stats?.deaths || 0), 0);

        return {
            totalAgents: agents.length,
            totalPlayTime,
            totalBattles,
            totalDeaths,
            avgScore: matrix.overallAvg,
            avgBattlesPerAgent: Math.round(totalBattles / agents.length),
            avgDeathsPerAgent: (totalDeaths / agents.length).toFixed(1)
        };
    }

    identifyIssues(agents, matrix) {
        const issues = [];
        const dimensions = Object.keys(matrix.byDimension);

        dimensions.forEach(dim => {
            const dimData = matrix.byDimension[dim];
            const dimName = this.dimensionNames[dim] || dim;

            if (dimData.avg < this.thresholds.critical) {
                issues.push({
                    dimension: dim,
                    dimensionName: dimName,
                    issue: `${dimName}严重偏低`,
                    avgScore: dimData.avg,
                    severity: 'critical',
                    affectedAgents: this.findAffectedAgents(agents, dim, this.thresholds.critical),
                    suggestion: this.getSuggestion(dim, 'critical')
                });
            } else if (dimData.avg < this.thresholds.warning) {
                issues.push({
                    dimension: dim,
                    dimensionName: dimName,
                    issue: `${dimName}偏低`,
                    avgScore: dimData.avg,
                    severity: 'high',
                    affectedAgents: this.findAffectedAgents(agents, dim, this.thresholds.warning),
                    suggestion: this.getSuggestion(dim, 'high')
                });
            }

            if (dimData.variance > 3) {
                issues.push({
                    dimension: dim,
                    dimensionName: dimName,
                    issue: `${dimName}分化严重`,
                    variance: dimData.variance,
                    severity: 'medium',
                    suggestion: `不同玩家类型对${dimName}的体验差异较大，需要平衡`
                });
            }
        });

        const agentIssues = this.identifyAgentSpecificIssues(agents);
        issues.push(...agentIssues);

        return issues.sort((a, b) => {
            const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
            return severityOrder[a.severity] - severityOrder[b.severity];
        });
    }

    findAffectedAgents(agents, dimension, threshold) {
        return agents
            .filter(a => {
                const report = a.getReport();
                return report.dimensionScores[dimension] < threshold;
            })
            .map(a => a.type);
    }

    identifyAgentSpecificIssues(agents) {
        const issues = [];

        agents.forEach(agent => {
            const report = agent.getReport();
            const breakdown = report.breakdown || [];

            breakdown.forEach(b => {
                if (b.severity === 'high') {
                    issues.push({
                        dimension: b.dimension,
                        dimensionName: this.dimensionNames[b.dimension] || b.dimension,
                        issue: b.issue,
                        severity: 'medium',
                        affectedAgent: agent.type,
                        affectedAgentName: agent.name,
                        count: b.count
                    });
                }
            });
        });

        return issues;
    }

    generateInsights(agents, matrix) {
        const insights = [];

        const bestDimension = this.findBestDimension(matrix.byDimension);
        const worstDimension = this.findWorstDimension(matrix.byDimension);

        insights.push({
            type: 'strength',
            message: `${bestDimension.name}表现最好，平均分 ${bestDimension.score}`,
            dimension: bestDimension.id
        });

        insights.push({
            type: 'weakness',
            message: `${worstDimension.name}需要改进，平均分 ${worstDimension.score}`,
            dimension: worstDimension.id
        });

        const agentScores = agents.map(a => ({
            type: a.type,
            name: a.name,
            score: a.getReport().overallScore
        }));

        agentScores.sort((a, b) => b.score - a.score);

        if (agentScores.length > 0) {
            insights.push({
                type: 'agent',
                message: `${agentScores[0].name}体验最好，评分 ${agentScores[0].score}`,
                agentType: agentScores[0].type
            });

            if (agentScores.length > 1) {
                const lowest = agentScores[agentScores.length - 1];
                insights.push({
                    type: 'agent',
                    message: `${lowest.name}体验最差，评分 ${lowest.score}`,
                    agentType: lowest.type
                });
            }
        }

        return insights;
    }

    findBestDimension(byDimension) {
        let best = { id: null, name: null, score: 0 };
        Object.entries(byDimension).forEach(([id, data]) => {
            if (data.avg > best.score) {
                best = {
                    id,
                    name: this.dimensionNames[id] || id,
                    score: data.avg
                };
            }
        });
        return best;
    }

    findWorstDimension(byDimension) {
        let worst = { id: null, name: null, score: 10 };
        Object.entries(byDimension).forEach(([id, data]) => {
            if (data.avg < worst.score) {
                worst = {
                    id,
                    name: this.dimensionNames[id] || id,
                    score: data.avg
                };
            }
        });
        return worst;
    }

    identifyPatterns(agents) {
        const patterns = [];

        const typeGroups = {};
        agents.forEach(agent => {
            const type = agent.type;
            if (!typeGroups[type]) {
                typeGroups[type] = [];
            }
            typeGroups[type].push(agent);
        });

        Object.entries(typeGroups).forEach(([type, group]) => {
            const avgDeaths = group.reduce((sum, a) => sum + (a.stats?.deaths || 0), 0) / group.length;
            const avgWins = group.reduce((sum, a) => sum + (a.stats?.wins || 0), 0) / group.length;

            if (avgDeaths > 3) {
                patterns.push({
                    type: 'death',
                    agentType: type,
                    message: `${type} 类型玩家平均死亡 ${avgDeaths.toFixed(1)} 次`,
                    value: avgDeaths
                });
            }

            if (avgWins > 20) {
                patterns.push({
                    type: 'win',
                    agentType: type,
                    message: `${type} 类型玩家平均胜利 ${avgWins.toFixed(1)} 次`,
                    value: avgWins
                });
            }
        });

        return patterns;
    }

    getSuggestion(dimension, severity) {
        const suggestions = {
            excitement: {
                critical: '增加战斗中的随机事件和高光时刻，如暴击、闪避等',
                high: '调整战斗难度曲线，增加紧张刺激的战斗体验'
            },
            growth: {
                critical: '增加升级奖励和装备获取频率，提升成长反馈',
                high: '优化经验和掉落曲线，让玩家持续感受到变强'
            },
            pacing: {
                critical: '优化游戏节奏，减少无聊等待和重复操作',
                high: '调整战斗间隔和推进速度，保持适当的游戏节奏'
            },
            playability: {
                critical: '增加技能和策略的多样性，丰富战斗选择',
                high: '优化技能平衡，让更多技能有使用价值'
            },
            retention: {
                critical: '降低连续失败的挫败感，增加保护机制',
                high: '优化死亡惩罚，提供更好的进度保存机制'
            },
            immersion: {
                critical: '增加世界观内容和探索元素',
                high: '丰富怪物种类和掉落物品，增加发现乐趣'
            }
        };

        return suggestions[dimension]?.[severity] || '需要进一步分析';
    }
}

module.exports = Analyzer;
