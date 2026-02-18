const evaluationConfig = require('../config/evaluation.json');

class Evaluator {
    constructor(targetAudience = null) {
        this.weights = evaluationConfig.agentWeights;
        this.dimensionRules = evaluationConfig.dimensionRules;
        this.thresholds = evaluationConfig.thresholds;
        this.dimensionNames = evaluationConfig.dimensionNames;
        this.agentTypeNames = evaluationConfig.agentTypeNames;
        this.targetAudience = targetAudience;
    }

    setTargetAudience(targetAudience) {
        this.targetAudience = targetAudience;
    }

    calculateAll(agents) {
        const byAgent = {};
        const byDimension = {};
        const dimensions = ['excitement', 'growth', 'pacing', 'playability', 'retention', 'immersion'];

        dimensions.forEach(dim => {
            byDimension[dim] = { values: [], sum: 0, count: 0 };
        });

        agents.forEach(agent => {
            const report = agent.getReport();
            const type = agent.type;
            const scores = report.dimensionScores;

            byAgent[type] = {};
            dimensions.forEach(dim => {
                byAgent[type][dim] = parseFloat((scores[dim] ?? 0).toFixed(2));
            });

            dimensions.forEach(dim => {
                if (scores[dim] !== undefined) {
                    byDimension[dim].values.push(scores[dim]);
                    byDimension[dim].sum += scores[dim];
                    byDimension[dim].count++;
                }
            });
        });

        const processedByDimension = {};
        dimensions.forEach(dim => {
            const data = byDimension[dim];
            if (data.count > 0) {
                const avg = data.sum / data.count;
                const min = Math.min(...data.values);
                const max = Math.max(...data.values);
                const variance = this.calculateVariance(data.values, avg);

                processedByDimension[dim] = {
                    avg: parseFloat(avg.toFixed(2)),
                    min: parseFloat(min.toFixed(2)),
                    max: parseFloat(max.toFixed(2)),
                    variance: parseFloat(variance.toFixed(2))
                };
            }
        });

        const overallAvg = this.calculateOverallAverage(byAgent);

        const targetScore = this.calculateTargetScore(byAgent);

        return {
            byAgent,
            byDimension: processedByDimension,
            overallAvg,
            targetScore,
            targetAudience: this.targetAudience,
            dimensionNames: this.dimensionNames,
            agentTypeNames: this.agentTypeNames
        };
    }

    calculateTargetScore(byAgent) {
        if (!this.targetAudience || !this.targetAudience.primary || this.targetAudience.primary.length === 0) {
            return null;
        }

        const primaryTypes = this.targetAudience.primary;
        const weights = this.targetAudience.weights || {};
        const thresholds = this.targetAudience.scoreThresholds || { excellent: 8.0, good: 6.0, acceptable: 4.5, poor: 3.0 };

        let totalWeight = 0;
        let weightedScore = 0;
        const targetDetails = [];

        primaryTypes.forEach(type => {
            if (byAgent[type]) {
                const typeWeight = weights[type] || (1 / primaryTypes.length);
                const scores = byAgent[type];
                const typeAvg = Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length;
                
                weightedScore += typeAvg * typeWeight;
                totalWeight += typeWeight;

                const status = this.getStatus(typeAvg, thresholds);

                targetDetails.push({
                    type,
                    typeName: this.agentTypeNames[type] || type,
                    weight: typeWeight,
                    avgScore: parseFloat(typeAvg.toFixed(2)),
                    dimensionScores: scores,
                    status,
                    isPrimary: true
                });
            }
        });

        const secondaryTypes = this.targetAudience.secondary || [];
        secondaryTypes.forEach(type => {
            if (byAgent[type]) {
                const scores = byAgent[type];
                const typeAvg = Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length;
                const status = this.getStatus(typeAvg, thresholds);

                targetDetails.push({
                    type,
                    typeName: this.agentTypeNames[type] || type,
                    weight: 0,
                    avgScore: parseFloat(typeAvg.toFixed(2)),
                    dimensionScores: scores,
                    status,
                    isPrimary: false
                });
            }
        });

        const nonTargetDetails = [];
        const allTypes = Object.keys(byAgent);
        const targetTypes = [...primaryTypes, ...secondaryTypes];
        allTypes.forEach(type => {
            if (!targetTypes.includes(type)) {
                const scores = byAgent[type];
                const typeAvg = Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length;
                const status = this.getStatus(typeAvg, thresholds);

                nonTargetDetails.push({
                    type,
                    typeName: this.agentTypeNames[type] || type,
                    avgScore: parseFloat(typeAvg.toFixed(2)),
                    dimensionScores: scores,
                    status,
                    isTarget: false
                });
            }
        });

        const finalScore = totalWeight > 0 ? parseFloat((weightedScore / totalWeight).toFixed(2)) : 0;
        const achievementRate = parseFloat(((finalScore / 10) * 100).toFixed(1));

        return {
            score: finalScore,
            achievementRate,
            thresholds,
            targetDetails,
            nonTargetDetails,
            summary: this.generateTargetSummary(finalScore, targetDetails, thresholds)
        };
    }

    getStatus(score, thresholds) {
        if (score >= thresholds.excellent) return 'excellent';
        if (score >= thresholds.good) return 'good';
        if (score >= thresholds.acceptable) return 'acceptable';
        if (score >= thresholds.poor) return 'poor';
        return 'critical';
    }

    generateTargetSummary(score, details, thresholds) {
        const excellentCount = details.filter(d => d.status === 'excellent').length;
        const goodCount = details.filter(d => d.status === 'good').length;
        const poorCount = details.filter(d => d.status === 'poor' || d.status === 'critical').length;

        if (score >= thresholds.excellent) {
            return {
                level: 'excellent',
                message: '目标玩家群体体验卓越，游戏设计完美匹配目标用户需求'
            };
        } else if (score >= thresholds.good) {
            return {
                level: 'good',
                message: '目标玩家群体体验良好，部分维度仍有优化空间'
            };
        } else if (score >= thresholds.acceptable) {
            return {
                level: 'acceptable',
                message: '目标玩家群体体验一般，需要针对性优化'
            };
        } else {
            return {
                level: 'poor',
                message: '目标玩家群体体验较差，急需改进核心体验'
            };
        }
    }

    calculateVariance(values, mean) {
        if (values.length <= 1) return 0;
        const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
        return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    }

    calculateOverallAverage(byAgent) {
        const types = Object.keys(byAgent);
        if (types.length === 0) return 0;

        let totalScore = 0;
        let dimensionCount = 0;

        types.forEach(type => {
            const scores = byAgent[type];
            Object.values(scores).forEach(score => {
                totalScore += score;
                dimensionCount++;
            });
        });

        return dimensionCount > 0 ? parseFloat((totalScore / dimensionCount).toFixed(2)) : 0;
    }

    getSeverity(score, dimension) {
        const threshold = this.thresholds;
        if (score < threshold.critical) return 'critical';
        if (score < threshold.warning) return 'high';
        if (score < threshold.good) return 'medium';
        if (score >= threshold.excellent) return 'excellent';
        return 'low';
    }

    getAgentWeightedScore(agentType, dimensionScores) {
        const weights = this.weights[agentType] || {};
        let weightedSum = 0;
        let weightSum = 0;

        Object.entries(dimensionScores).forEach(([dim, score]) => {
            const weight = weights[dim] || 1;
            weightedSum += score * weight;
            weightSum += weight;
        });

        return weightSum > 0 ? parseFloat((weightedSum / weightSum).toFixed(1)) : 5.0;
    }

    compareAgents(agents) {
        const comparison = agents.map(agent => {
            const report = agent.getReport();
            return {
                id: agent.id,
                name: agent.name,
                type: agent.type,
                avatar: agent.avatar,
                overallScore: report.overallScore,
                dimensionScores: report.dimensionScores,
                lowestDimension: this.findLowestDimension(report.dimensionScores),
                highestDimension: this.findHighestDimension(report.dimensionScores),
                isTarget: this.isTargetAgent(agent.type)
            };
        });

        comparison.sort((a, b) => b.overallScore - a.overallScore);

        return comparison;
    }

    isTargetAgent(type) {
        if (!this.targetAudience) return true;
        return this.targetAudience.primary.includes(type) || 
               (this.targetAudience.secondary && this.targetAudience.secondary.includes(type));
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

    getRadarChartData(agents) {
        const labels = ['刺激度', '成长感', '节奏感', '可玩性', '留存预估', '代入感'];
        const datasets = agents.map(agent => {
            const report = agent.getReport();
            return {
                label: agent.name,
                data: [
                    report.dimensionScores.excitement,
                    report.dimensionScores.growth,
                    report.dimensionScores.pacing,
                    report.dimensionScores.playability,
                    report.dimensionScores.retention,
                    report.dimensionScores.immersion
                ],
                agentType: agent.type,
                isTarget: this.isTargetAgent(agent.type)
            };
        });

        return { labels, datasets };
    }

    getHeatmapData(matrix) {
        const dimensions = ['excitement', 'growth', 'pacing', 'playability', 'retention', 'immersion'];
        const agentTypes = Object.keys(matrix.byAgent);

        return {
            rows: agentTypes.map(type => ({
                type,
                typeName: this.agentTypeNames[type] || type,
                values: dimensions.map(dim => matrix.byAgent[type][dim] || 0),
                isTarget: this.isTargetAgent(type)
            })),
            columns: dimensions.map(dim => ({
                id: dim,
                name: this.dimensionNames[dim] || dim
            }))
        };
    }
}

module.exports = Evaluator;
