class MetricsCollector {
    constructor() {
        this.metrics = {
            totalBattles: 0,
            totalWins: 0,
            totalDeaths: 0,
            totalPlayTime: 0,
            battlesPerAgent: {},
            eventsByType: {},
            timeline: []
        };
    }

    recordEvent(eventType, agentId, data) {
        if (!this.metrics.eventsByType[eventType]) {
            this.metrics.eventsByType[eventType] = [];
        }

        this.metrics.eventsByType[eventType].push({
            agentId,
            timestamp: Date.now(),
            data
        });

        this.metrics.timeline.push({
            eventType,
            agentId,
            timestamp: Date.now()
        });

        if (this.metrics.timeline.length > 1000) {
            this.metrics.timeline = this.metrics.timeline.slice(-1000);
        }
    }

    recordBattleStart(agentId, data) {
        this.metrics.totalBattles++;
        this.incrementAgentMetric(agentId, 'battles');
        this.recordEvent('battleStart', agentId, data);
    }

    recordBattleEnd(agentId, data) {
        if (data.victory) {
            this.metrics.totalWins++;
            this.incrementAgentMetric(agentId, 'wins');
        }
        this.recordEvent('battleEnd', agentId, data);
    }

    recordDeath(agentId, data) {
        this.metrics.totalDeaths++;
        this.incrementAgentMetric(agentId, 'deaths');
        this.recordEvent('death', agentId, data);
    }

    recordLevelUp(agentId, data) {
        this.incrementAgentMetric(agentId, 'levelUps');
        this.recordEvent('levelUp', agentId, data);
    }

    recordFloorAdvance(agentId, data) {
        this.incrementAgentMetric(agentId, 'floorsAdvanced');
        this.recordEvent('floorAdvance', agentId, data);
    }

    incrementAgentMetric(agentId, metric) {
        if (!this.metrics.battlesPerAgent[agentId]) {
            this.metrics.battlesPerAgent[agentId] = {
                battles: 0,
                wins: 0,
                deaths: 0,
                levelUps: 0,
                floorsAdvanced: 0
            };
        }
        this.metrics.battlesPerAgent[agentId][metric]++;
    }

    getMetrics() {
        return {
            ...this.metrics,
            winRate: this.metrics.totalBattles > 0
                ? (this.metrics.totalWins / this.metrics.totalBattles * 100).toFixed(1)
                : 0,
            averageDeathsPerAgent: this.getAverageDeathsPerAgent()
        };
    }

    getAverageDeathsPerAgent() {
        const agentIds = Object.keys(this.metrics.battlesPerAgent);
        if (agentIds.length === 0) return 0;

        const totalDeaths = agentIds.reduce((sum, id) => {
            return sum + (this.metrics.battlesPerAgent[id].deaths || 0);
        }, 0);

        return (totalDeaths / agentIds.length).toFixed(1);
    }

    getEventsByType(eventType) {
        return this.metrics.eventsByType[eventType] || [];
    }

    getAgentMetrics(agentId) {
        return this.metrics.battlesPerAgent[agentId] || {
            battles: 0,
            wins: 0,
            deaths: 0,
            levelUps: 0,
            floorsAdvanced: 0
        };
    }

    getTimeline(slice = 100) {
        return this.metrics.timeline.slice(-slice);
    }

    reset() {
        this.metrics = {
            totalBattles: 0,
            totalWins: 0,
            totalDeaths: 0,
            totalPlayTime: 0,
            battlesPerAgent: {},
            eventsByType: {},
            timeline: []
        };
    }

    generateSummary() {
        return {
            totalBattles: this.metrics.totalBattles,
            totalWins: this.metrics.totalWins,
            totalDeaths: this.metrics.totalDeaths,
            winRate: this.metrics.totalBattles > 0
                ? `${(this.metrics.totalWins / this.metrics.totalBattles * 100).toFixed(1)}%`
                : '0%',
            eventCounts: Object.fromEntries(
                Object.entries(this.metrics.eventsByType).map(([type, events]) => [type, events.length])
            ),
            agentSummaries: Object.fromEntries(
                Object.entries(this.metrics.battlesPerAgent).map(([id, data]) => [
                    id,
                    {
                        ...data,
                        winRate: data.battles > 0
                            ? `${(data.wins / data.battles * 100).toFixed(1)}%`
                            : '0%'
                    }
                ])
            )
        };
    }
}

module.exports = MetricsCollector;
