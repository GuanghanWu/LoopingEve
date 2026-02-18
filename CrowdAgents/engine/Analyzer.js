const evaluationConfig = require('../config/evaluation.json');

class Analyzer {
    constructor(targetAudience = null) {
        this.thresholds = evaluationConfig.thresholds;
        this.dimensionNames = evaluationConfig.dimensionNames;
        this.targetAudience = targetAudience;
    }

    setTargetAudience(targetAudience) {
        this.targetAudience = targetAudience;
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
            criticalCount: issues.filter(i => i.severity === 'critical' || i.severity === 'high').length,
            targetAnalysis: this.analyzeTargetAudience(matrix)
        };
    }

    analyzeTargetAudience(matrix) {
        if (!this.targetAudience || !this.targetAudience.primary || this.targetAudience.primary.length === 0) {
            return null;
        }

        const primaryTypes = this.targetAudience.primary;
        const secondaryTypes = this.targetAudience.secondary || [];
        const weights = this.targetAudience.weights || {};
        const thresholds = this.targetAudience.scoreThresholds || { excellent: 8.0, good: 6.0, acceptable: 4.5, poor: 3.0 };

        const primaryAnalysis = primaryTypes.map(type => {
            const scores = matrix.byAgent[type];
            if (!scores) return null;

            const avgScore = Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length;
            const lowestDim = this.findLowestDimension(scores);
            const highestDim = this.findHighestDimension(scores);
            const gaps = this.calculateExpectationGaps(type, scores);

            return {
                type,
                typeName: this.dimensionNames[type] || evaluationConfig.agentTypeNames[type] || type,
                weight: weights[type] || (1 / primaryTypes.length),
                avgScore: parseFloat(avgScore.toFixed(2)),
                status: this.getStatus(avgScore, thresholds),
                lowestDimension: {
                    name: this.dimensionNames[lowestDim.name] || lowestDim.name,
                    score: lowestDim.score
                },
                highestDimension: {
                    name: this.dimensionNames[highestDim.name] || highestDim.name,
                    score: highestDim.score
                },
                expectationGaps: gaps,
                dimensionScores: scores
            };
        }).filter(Boolean);

        const secondaryAnalysis = secondaryTypes.map(type => {
            const scores = matrix.byAgent[type];
            if (!scores) return null;

            const avgScore = Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length;

            return {
                type,
                typeName: evaluationConfig.agentTypeNames[type] || type,
                avgScore: parseFloat(avgScore.toFixed(2)),
                status: this.getStatus(avgScore, thresholds),
                dimensionScores: scores
            };
        }).filter(Boolean);

        const overallTargetScore = matrix.targetScore;

        return {
            primary: primaryAnalysis,
            secondary: secondaryAnalysis,
            overallScore: overallTargetScore,
            recommendations: this.generateTargetRecommendations(primaryAnalysis, thresholds)
        };
    }

    calculateExpectationGaps(type, scores) {
        const expectations = {
            casual: { excitement: 0.4, growth: 0.5, pacing: 0.3, playability: 0.4, retention: 0.6, immersion: 0.3 },
            hardcore: { excitement: 0.9, growth: 0.7, pacing: 0.6, playability: 0.9, retention: 0.4, immersion: 0.2 },
            explorer: { excitement: 0.5, growth: 0.5, pacing: 0.4, playability: 0.7, retention: 0.6, immersion: 0.95 },
            social: { excitement: 0.5, growth: 0.5, pacing: 0.5, playability: 0.5, retention: 0.5, immersion: 0.4 },
            paying: { excitement: 0.6, growth: 0.8, pacing: 0.5, playability: 0.6, retention: 0.6, immersion: 0.3 }
        };

        const typeExpectations = expectations[type] || {};
        const gaps = [];

        Object.entries(scores).forEach(([dim, score]) => {
            const expectation = typeExpectations[dim] || 0.5;
            const expectedScore = expectation * 10;
            const gap = expectedScore - score;

            if (gap > 1) {
                gaps.push({
                    dimension: dim,
                    dimensionName: this.dimensionNames[dim] || dim,
                    actualScore: score,
                    expectedScore: parseFloat(expectedScore.toFixed(1)),
                    gap: parseFloat(gap.toFixed(1)),
                    severity: gap > 3 ? 'high' : (gap > 2 ? 'medium' : 'low')
                });
            }
        });

        return gaps.sort((a, b) => b.gap - a.gap);
    }

    generateTargetRecommendations(primaryAnalysis, thresholds) {
        const recommendations = [];

        primaryAnalysis.forEach(analysis => {
            if (analysis.status === 'critical' || analysis.status === 'poor') {
                recommendations.push({
                    target: analysis.typeName,
                    priority: 'critical',
                    message: `${analysis.typeName}体验严重不足，需要紧急优化`,
                    focusDimensions: [analysis.lowestDimension.name]
                });
            } else if (analysis.status === 'acceptable') {
                recommendations.push({
                    target: analysis.typeName,
                    priority: 'high',
                    message: `${analysis.typeName}体验有待提升，重点关注${analysis.lowestDimension.name}`,
                    focusDimensions: [analysis.lowestDimension.name]
                });
            }

            if (analysis.expectationGaps && analysis.expectationGaps.length > 0) {
                const criticalGaps = analysis.expectationGaps.filter(g => g.severity === 'high');
                if (criticalGaps.length > 0) {
                    recommendations.push({
                        target: analysis.typeName,
                        priority: 'high',
                        message: `${analysis.typeName}在${criticalGaps.map(g => g.dimensionName).join('、')}方面未达预期`,
                        focusDimensions: criticalGaps.map(g => g.dimension)
                    });
                }
            }
        });

        return recommendations;
    }

    getStatus(score, thresholds) {
        if (score >= thresholds.excellent) return 'excellent';
        if (score >= thresholds.good) return 'good';
        if (score >= thresholds.acceptable) return 'acceptable';
        if (score >= thresholds.poor) return 'poor';
        return 'critical';
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
            targetScore: matrix.targetScore?.score || null,
            avgBattlesPerAgent: Math.round(totalBattles / agents.length),
            avgDeathsPerAgent: (totalDeaths / agents.length).toFixed(1)
        };
    }

    identifyIssues(agents, matrix) {
        const issues = [];
        const dimensions = Object.keys(matrix.byDimension);
        const targetTypes = this.targetAudience ? 
            [...(this.targetAudience.primary || []), ...(this.targetAudience.secondary || [])] : null;

        dimensions.forEach(dim => {
            const dimData = matrix.byDimension[dim];
            const dimName = this.dimensionNames[dim] || dim;

            if (targetTypes && targetTypes.length > 0) {
                const targetScores = targetTypes
                    .filter(type => matrix.byAgent[type])
                    .map(type => matrix.byAgent[type][dim]);

                if (targetScores.length > 0) {
                    const targetAvg = targetScores.reduce((a, b) => a + b, 0) / targetScores.length;
                    
                    if (targetAvg < this.thresholds.critical) {
                        issues.push({
                            dimension: dim,
                            dimensionName: dimName,
                            issue: `目标玩家${dimName}严重偏低`,
                            avgScore: parseFloat(targetAvg.toFixed(2)),
                            severity: 'critical',
                            affectedAgents: targetTypes,
                            isTargetIssue: true,
                            suggestion: this.getSuggestion(dim, 'critical')
                        });
                    } else if (targetAvg < this.thresholds.warning) {
                        issues.push({
                            dimension: dim,
                            dimensionName: dimName,
                            issue: `目标玩家${dimName}偏低`,
                            avgScore: parseFloat(targetAvg.toFixed(2)),
                            severity: 'high',
                            affectedAgents: targetTypes,
                            isTargetIssue: true,
                            suggestion: this.getSuggestion(dim, 'high')
                        });
                    }
                }
            } else {
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
            }
        });

        const agentIssues = this.identifyAgentSpecificIssues(agents);
        issues.push(...agentIssues);

        return issues.sort((a, b) => {
            const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
            if (a.isTargetIssue && !b.isTargetIssue) return -1;
            if (!a.isTargetIssue && b.isTargetIssue) return 1;
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
        const targetTypes = this.targetAudience?.primary || [];

        agents.forEach(agent => {
            const report = agent.getReport();
            const breakdown = report.breakdown || [];
            const isTarget = targetTypes.includes(agent.type);

            breakdown.forEach(b => {
                if (b.severity === 'high') {
                    issues.push({
                        dimension: b.dimension,
                        dimensionName: this.dimensionNames[b.dimension] || b.dimension,
                        issue: b.issue,
                        severity: isTarget ? 'high' : 'medium',
                        affectedAgent: agent.type,
                        affectedAgentName: agent.name,
                        count: b.count,
                        isTargetIssue: isTarget
                    });
                }
            });
        });

        return issues;
    }

    generateInsights(agents, matrix) {
        const insights = [];
        const targetTypes = this.targetAudience?.primary || [];

        if (targetTypes.length > 0 && matrix.targetScore) {
            insights.push({
                type: 'target',
                message: `目标玩家群体综合得分 ${matrix.targetScore.score}/10，达成率 ${matrix.targetScore.achievementRate}%`,
                score: matrix.targetScore.score
            });

            const targetDetails = matrix.targetScore.targetDetails || [];
            targetDetails.forEach(detail => {
                if (detail.status === 'excellent' || detail.status === 'good') {
                    insights.push({
                        type: 'strength',
                        message: `${detail.typeName}体验良好 (${detail.avgScore}/10)`,
                        agentType: detail.type
                    });
                } else if (detail.status === 'poor' || detail.status === 'critical') {
                    insights.push({
                        type: 'weakness',
                        message: `${detail.typeName}体验不足 (${detail.avgScore}/10)`,
                        agentType: detail.type
                    });
                }
            });
        }

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
            score: a.getReport().overallScore,
            isTarget: targetTypes.includes(a.type)
        }));

        agentScores.sort((a, b) => b.score - a.score);

        if (agentScores.length > 0) {
            const best = agentScores[0];
            insights.push({
                type: 'agent',
                message: `${best.name}体验最好，评分 ${best.score}${best.isTarget ? ' (目标玩家)' : ''}`,
                agentType: best.type,
                isTarget: best.isTarget
            });

            if (agentScores.length > 1) {
                const lowest = agentScores[agentScores.length - 1];
                insights.push({
                    type: 'agent',
                    message: `${lowest.name}体验最差，评分 ${lowest.score}${lowest.isTarget ? ' (目标玩家)' : ''}`,
                    agentType: lowest.type,
                    isTarget: lowest.isTarget
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

    findLowestDimension(scores) {
        let lowest = { name: null, score: 10 };
        Object.entries(scores).forEach(([dim, score]) => {
            if (score < lowest.score) {
                lowest = { name: dim, score };
            }
        });
        return lowest;
    }

    findHighestDimension(scores) {
        let highest = { name: null, score: 0 };
        Object.entries(scores).forEach(([dim, score]) => {
            if (score > highest.score) {
                highest = { name: dim, score };
            }
        });
        return highest;
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

        const targetTypes = this.targetAudience?.primary || [];

        Object.entries(typeGroups).forEach(([type, group]) => {
            const avgDeaths = group.reduce((sum, a) => sum + (a.stats?.deaths || 0), 0) / group.length;
            const avgWins = group.reduce((sum, a) => sum + (a.stats?.wins || 0), 0) / group.length;
            const isTarget = targetTypes.includes(type);

            if (avgDeaths > 3) {
                patterns.push({
                    type: 'death',
                    agentType: type,
                    message: `${type} 类型玩家平均死亡 ${avgDeaths.toFixed(1)} 次${isTarget ? ' (目标玩家)' : ''}`,
                    value: avgDeaths,
                    isTarget
                });
            }

            if (avgWins > 20) {
                patterns.push({
                    type: 'win',
                    agentType: type,
                    message: `${type} 类型玩家平均胜利 ${avgWins.toFixed(1)} 次${isTarget ? ' (目标玩家)' : ''}`,
                    value: avgWins,
                    isTarget
                });
            }
        });

        return patterns.sort((a, b) => {
            if (a.isTarget && !b.isTarget) return -1;
            if (!a.isTarget && b.isTarget) return 1;
            return 0;
        });
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
