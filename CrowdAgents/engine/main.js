const fs = require('fs');
const path = require('path');

const GameAPI = require('./GameAPI');
const AgentBase = require('./AgentBase');
const CasualPlayer = require('./agents/CasualPlayer');
const HardcoreGamer = require('./agents/HardcoreGamer');
const StoryExplorer = require('./agents/StoryExplorer');
const SocialPlayer = require('./agents/SocialPlayer');
const PayingUser = require('./agents/PayingUser');
const BehaviorEngine = require('./BehaviorEngine');
const MetricsCollector = require('./MetricsCollector');
const Evaluator = require('./Evaluator');
const Analyzer = require('./Analyzer');
const Advisor = require('./Advisor');

const agentClasses = {
    casual: CasualPlayer,
    hardcore: HardcoreGamer,
    explorer: StoryExplorer,
    social: SocialPlayer,
    paying: PayingUser
};

function loadConfig(configPath) {
    const fullPath = path.resolve(__dirname, configPath);
    const content = fs.readFileSync(fullPath, 'utf-8');
    return JSON.parse(content);
}

function createAgent(config) {
    const AgentClass = agentClasses[config.type];
    if (!AgentClass) {
        console.warn(`Unknown agent type: ${config.type}, using base class`);
        return new AgentBase(config);
    }
    return new AgentClass(config);
}

function setupEventHandlers(gameAPI, agent, metricsCollector) {
    gameAPI.on('battleStart', (data) => {
        agent.onBattleStart(data);
        metricsCollector.recordBattleStart(agent.id, data);
    });

    gameAPI.on('battleEnd', (data) => {
        agent.onBattleEnd(data);
        metricsCollector.recordBattleEnd(agent.id, data);
    });

    gameAPI.on('playerDamage', (data) => {
        agent.onPlayerDamage(data);
    });

    gameAPI.on('monsterDamage', (data) => {
        agent.onMonsterDamage(data);
    });

    gameAPI.on('levelUp', (data) => {
        agent.onLevelUp(data);
        metricsCollector.recordLevelUp(agent.id, data);
    });

    gameAPI.on('itemObtain', (data) => {
        agent.onItemObtain(data);
    });

    gameAPI.on('itemUse', (data) => {
        agent.onItemUse(data);
    });

    gameAPI.on('skillUse', (data) => {
        agent.onSkillUse(data);
    });

    gameAPI.on('floorAdvance', (data) => {
        agent.onFloorAdvance(data);
        metricsCollector.recordFloorAdvance(agent.id, data);
    });

    gameAPI.on('playerDeath', (data) => {
        agent.onPlayerDeath(data);
        metricsCollector.recordDeath(agent.id, data);
    });

    gameAPI.on('forgeSuccess', (data) => {
        agent.onForgeSuccess(data);
    });

    gameAPI.on('loreDiscovery', (data) => {
        agent.onLoreDiscovery(data);
    });

    gameAPI.on('npcInteraction', (data) => {
        agent.onNPCInteraction(data);
    });

    gameAPI.on('storyEvent', (data) => {
        agent.onStoryEvent(data);
    });
}

async function runSimulation(agent, gameAPI, duration, tickInterval) {
    const startTime = Date.now();
    const endTime = startTime + duration;

    while (Date.now() < endTime && !agent.shouldQuit) {
        agent.playTime = Date.now() - startTime;

        const gameState = gameAPI.getState();

        if (!gameState.inBattle && !gameState.canAdvanceFloor) {
            gameAPI.explore();
        } else if (!gameState.inBattle && gameState.canAdvanceFloor) {
            const action = agent.decide(gameState);
            if (action === 'nextFloor') {
                gameAPI.nextFloor();
            } else {
                gameAPI.explore();
            }
        } else if (gameState.inBattle) {
            const action = agent.decide(gameState);
            await executeAction(action, gameAPI, gameState);
        }

        await sleep(tickInterval);
    }

    return agent.getReport();
}

async function executeAction(action, gameAPI, gameState) {
    if (typeof action === 'string') {
        switch (action) {
            case 'attack':
                gameAPI.attack();
                break;
            case 'usePotion':
                gameAPI.usePotion();
                break;
            case 'defend':
                gameAPI.defend();
                break;
            default:
                gameAPI.attack();
        }
    } else if (typeof action === 'object') {
        switch (action.action) {
            case 'useSkill':
                gameAPI.useSkill(action.skillId);
                break;
            case 'useItem':
                gameAPI.useItem(action.itemId);
                break;
        }
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function generateReport(agents, matrix, analysis, recommendations, metrics, duration) {
    const evaluationConfig = loadConfig('../config/evaluation.json');

    return {
        meta: {
            version: '1.0',
            generatedAt: new Date().toISOString(),
            totalDuration: duration,
            agentCount: agents.length
        },

        agents: agents.map(a => a.getReport()),

        matrix: {
            byAgent: matrix.byAgent,
            byDimension: matrix.byDimension,
            overallAvg: matrix.overallAvg
        },

        issues: analysis.issues.map(issue => ({
            dimension: issue.dimension,
            dimensionName: issue.dimensionName,
            issue: issue.issue,
            affectedAgents: issue.affectedAgents || [],
            avgScore: issue.avgScore,
            severity: issue.severity
        })),

        recommendations: recommendations.map(rec => ({
            priority: rec.priority,
            priorityLabel: rec.priorityLabel,
            action: rec.action,
            targetDimensions: rec.targetDimensions,
            affectedAgents: rec.affectedAgents || []
        })),

        metrics: metrics.generateSummary(),

        chartData: {
            radarChart: new Evaluator().getRadarChartData(agents),
            heatmap: new Evaluator().getHeatmapData(matrix),
            comparison: new Evaluator().compareAgents(agents)
        },

        dimensionNames: evaluationConfig.dimensionNames,
        agentTypeNames: evaluationConfig.agentTypeNames
    };
}

function saveReport(report, outputPath) {
    const fullPath = path.resolve(__dirname, outputPath);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`[CrowdAgents] 报告已生成: ${fullPath}`);
}

function printSummary(report) {
    console.log('\n========================================');
    console.log('       CrowdAgents 测试报告摘要');
    console.log('========================================\n');

    console.log(`📊 总体评分: ${report.matrix.overallAvg}/10`);
    console.log(`👥 Agent数量: ${report.meta.agentCount}`);
    console.log(`⏱️  测试时长: ${(report.meta.totalDuration / 1000 / 60).toFixed(1)} 分钟\n`);

    console.log('--- Agent 评分 ---');
    report.agents.forEach(agent => {
        console.log(`  ${agent.avatar} ${agent.name}: ${agent.overallScore}/10`);
    });
    console.log('');

    console.log('--- 维度评分 ---');
    Object.entries(report.matrix.byDimension).forEach(([dim, data]) => {
        const dimName = report.dimensionNames[dim] || dim;
        console.log(`  ${dimName}: ${data.avg}/10 (方差: ${data.variance})`);
    });
    console.log('');

    if (report.issues.length > 0) {
        console.log('--- 主要问题 ---');
        report.issues.slice(0, 5).forEach(issue => {
            const severityIcon = {
                critical: '🔴',
                high: '🟠',
                medium: '🟡',
                low: '🟢'
            }[issue.severity] || '⚪';
            console.log(`  ${severityIcon} ${issue.issue}`);
        });
        console.log('');
    }

    if (report.recommendations.length > 0) {
        console.log('--- 迭代建议 ---');
        report.recommendations.slice(0, 5).forEach(rec => {
            const priorityIcon = {
                critical: '🔴',
                high: '🟠',
                medium: '🟡',
                low: '🟢'
            }[rec.priority] || '⚪';
            console.log(`  ${priorityIcon} [${rec.priorityLabel}] ${rec.action}`);
        });
    }

    console.log('\n========================================\n');
}

async function main() {
    const args = process.argv.slice(2);
    let configPath = '../config/agents.json';
    let duration = 60000;
    let tickInterval = 50;
    let enableDashboard = false;

    args.forEach(arg => {
        if (arg.startsWith('--config=')) {
            configPath = arg.split('=')[1];
        } else if (arg.startsWith('--duration=')) {
            duration = parseInt(arg.split('=')[1], 10);
        } else if (arg.startsWith('--tick=')) {
            tickInterval = parseInt(arg.split('=')[1], 10);
        } else if (arg === '--dashboard') {
            enableDashboard = true;
        }
    });

    console.log('[CrowdAgents] 系统启动...');
    console.log(`[CrowdAgents] 配置: ${configPath}`);
    console.log(`[CrowdAgents] 模拟时长: ${duration / 1000} 秒`);
    console.log(`[CrowdAgents] 模拟间隔: ${tickInterval} ms\n`);

    const config = loadConfig(configPath);
    const metricsCollector = new MetricsCollector();
    const behaviorEngine = new BehaviorEngine();

    console.log('[CrowdAgents] 创建 Agent 实例...');
    const agents = config.agents.map(agentConfig => {
        const agent = createAgent(agentConfig);
        const gameAPI = new GameAPI();

        agent.setGameAPI(gameAPI);
        setupEventHandlers(gameAPI, agent, metricsCollector);

        console.log(`  - ${agent.avatar} ${agent.name} (${agent.type})`);
        return agent;
    });

    console.log('\n[CrowdAgents] 开始模拟...\n');

    const simulationPromises = agents.map(async (agent) => {
        try {
            return await runSimulation(agent, agent.gameAPI, duration, tickInterval);
        } catch (error) {
            console.error(`[CrowdAgents] Agent ${agent.name} 模拟出错:`, error.message);
            return agent.getReport();
        }
    });

    await Promise.all(simulationPromises);

    console.log('[CrowdAgents] 模拟完成，生成评价...\n');

    const evaluator = new Evaluator();
    const matrix = evaluator.calculateAll(agents);

    const analyzer = new Analyzer();
    const analysis = analyzer.analyze(agents, matrix);

    const advisor = new Advisor();
    const recommendations = advisor.generate(analysis, agents);

    const report = generateReport(
        agents,
        matrix,
        analysis,
        recommendations,
        metricsCollector,
        duration
    );

    saveReport(report, '../output/report.json');

    printSummary(report);

    if (enableDashboard) {
        console.log('[CrowdAgents] 启动仪表盘服务器...');
        console.log('[CrowdAgents] 请打开 dashboard/index.html 查看可视化报告');
    }

    console.log('[CrowdAgents] 完成！');

    return report;
}

main().catch(error => {
    console.error('[CrowdAgents] 错误:', error);
    process.exit(1);
});
