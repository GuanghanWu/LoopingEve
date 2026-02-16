const evaluationConfig = require('../config/evaluation.json');

class Evaluator {
    constructor() {
        this.weights = evaluationConfig.agentWeights;
        this.dimensionRules = evaluationConfig.dimensionRules;
        this.thresholds = evaluationConfig.thresholds;
        this.dimensionNames = evaluationConfig.dimensionNames;
        this.agentTypeNames = evaluationConfig.agentTypeNames;
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

        return {
            byAgent,
            byDimension: processedByDimension,
            overallAvg,
            dimensionNames: this.dimensionNames,
            agentTypeNames: this.agentTypeNames
        };
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
                highestDimension: this.findHighestDimension(report.dimensionScores)
            };
        });

        comparison.sort((a, b) => b.overallScore - a.overallScore);

        return comparison;
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
                agentType: agent.type
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
                values: dimensions.map(dim => matrix.byAgent[type][dim] || 0)
            })),
            columns: dimensions.map(dim => ({
                id: dim,
                name: this.dimensionNames[dim] || dim
            }))
        };
    }
}

module.exports = Evaluator;
