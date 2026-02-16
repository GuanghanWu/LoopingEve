let reportData = null;
let radarChart = null;
let dimensionChart = null;

const dimensionNames = {
    excitement: '刺激度',
    growth: '成长感',
    pacing: '节奏感',
    playability: '可玩性',
    retention: '留存预估',
    immersion: '代入感'
};

const agentTypeNames = {
    casual: '轻度休闲',
    hardcore: '硬核竞技',
    explorer: '剧情探索',
    social: '社交互动',
    paying: '付费习惯'
};

const agentColors = {
    casual: '#4CAF50',
    hardcore: '#F44336',
    explorer: '#2196F3',
    social: '#FF9800',
    paying: '#9C27B0'
};

async function loadReport() {
    try {
        const response = await fetch('../output/report.json?t=' + Date.now());
        if (!response.ok) {
            throw new Error('无法加载报告文件');
        }
        reportData = await response.json();
        return true;
    } catch (error) {
        console.error('加载报告失败:', error);
        showError('无法加载报告文件，请先运行 node engine/main.js 生成报告');
        return false;
    }
}

function showError(message) {
    document.body.innerHTML = `
        <div class="dashboard">
            <div class="error">
                <h2>⚠️ 错误</h2>
                <p>${message}</p>
                <p>请确保已运行模拟并生成了报告文件。</p>
            </div>
        </div>
    `;
}

function updateSummary() {
    if (!reportData) return;

    document.getElementById('overallScore').textContent = reportData.matrix.overallAvg || '--';
    document.getElementById('agentCount').textContent = reportData.meta.agentCount || '--';
    document.getElementById('totalBattles').textContent = reportData.metrics?.totalBattles || '--';
    document.getElementById('totalDeaths').textContent = reportData.metrics?.totalDeaths || '--';
    document.getElementById('generatedTime').textContent = new Date(reportData.meta.generatedAt).toLocaleString('zh-CN');
    document.getElementById('testDuration').textContent = (reportData.meta.totalDuration / 1000 / 60).toFixed(1) + ' 分钟';
}

function renderAgentCards() {
    if (!reportData || !reportData.agents) return;

    const grid = document.getElementById('agentGrid');
    grid.innerHTML = '';

    reportData.agents.forEach(agent => {
        const card = document.createElement('div');
        card.className = 'agent-card';
        card.onclick = () => highlightAgent(agent.type);

        const scoreClass = agent.overallScore >= 7 ? 'good' : agent.overallScore >= 5 ? 'medium' : 'low';

        card.innerHTML = `
            <div class="agent-header">
                <span class="agent-avatar">${agent.avatar}</span>
                <div>
                    <div class="agent-name">${agent.name}</div>
                    <div class="agent-type">${agentTypeNames[agent.type] || agent.type}</div>
                </div>
            </div>
            <div class="agent-score">${agent.overallScore}/10</div>
            <div class="agent-stats">
                <span>⚔️ ${agent.stats?.wins || 0} 胜</span>
                <span>💀 ${agent.stats?.deaths || 0} 死</span>
                <span>📍 ${agent.stats?.maxFloor || 1} 层</span>
            </div>
        `;

        grid.appendChild(card);
    });
}

function renderRadarChart() {
    if (!reportData || !reportData.chartData?.radarChart) return;

    const ctx = document.getElementById('radarChart').getContext('2d');

    if (radarChart) {
        radarChart.destroy();
    }

    const datasets = reportData.chartData.radarChart.datasets.map(ds => ({
        label: ds.label,
        data: ds.data,
        borderColor: agentColors[ds.agentType] || '#888',
        backgroundColor: (agentColors[ds.agentType] || '#888') + '33',
        borderWidth: 2
    }));

    radarChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: reportData.chartData.radarChart.labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    beginAtZero: true,
                    max: 10,
                    ticks: {
                        stepSize: 2,
                        color: '#a0a0a0'
                    },
                    grid: {
                        color: '#2a2a4a'
                    },
                    angleLines: {
                        color: '#2a2a4a'
                    },
                    pointLabels: {
                        color: '#eaeaea',
                        font: {
                            size: 12
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#eaeaea',
                        padding: 15
                    }
                }
            }
        }
    });
}

function renderHeatmap() {
    if (!reportData || !reportData.chartData?.heatmap) return;

    const container = document.getElementById('heatmapContainer');
    const heatmap = reportData.chartData.heatmap;

    let html = '<table class="heatmap-table"><thead><tr><th></th>';
    heatmap.columns.forEach(col => {
        html += `<th>${col.name}</th>`;
    });
    html += '</tr></thead><tbody>';

    heatmap.rows.forEach(row => {
        html += `<tr><th>${row.typeName}</th>`;
        row.values.forEach(value => {
            const color = getHeatmapColor(value);
            html += `<td><div class="heatmap-cell" style="background: ${color}">${value}</div></td>`;
        });
        html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

function getHeatmapColor(value) {
    if (value >= 8) return '#4CAF50';
    if (value >= 7) return '#8BC34A';
    if (value >= 6) return '#FFC107';
    if (value >= 5) return '#FF9800';
    if (value >= 4) return '#F44336';
    return '#B71C1C';
}

function renderDimensionChart() {
    if (!reportData || !reportData.matrix?.byDimension) return;

    const ctx = document.getElementById('dimensionChart').getContext('2d');

    if (dimensionChart) {
        dimensionChart.destroy();
    }

    const dimensions = Object.keys(reportData.matrix.byDimension);
    const labels = dimensions.map(d => dimensionNames[d] || d);
    const values = dimensions.map(d => reportData.matrix.byDimension[d].avg);

    dimensionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '平均评分',
                data: values,
                backgroundColor: values.map(v => getHeatmapColor(v)),
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 10,
                    ticks: {
                        color: '#a0a0a0'
                    },
                    grid: {
                        color: '#2a2a4a'
                    }
                },
                x: {
                    ticks: {
                        color: '#eaeaea'
                    },
                    grid: {
                        display: false
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

function renderIssues() {
    if (!reportData || !reportData.issues) return;

    const list = document.getElementById('issuesList');
    list.innerHTML = '';

    if (reportData.issues.length === 0) {
        list.innerHTML = '<p class="no-issues">🎉 没有发现严重问题！</p>';
        return;
    }

    reportData.issues.forEach(issue => {
        const item = document.createElement('div');
        item.className = `issue-item ${issue.severity}`;

        item.innerHTML = `
            <div class="issue-title">
                ${issue.issue}
                <span class="severity-badge severity-${issue.severity}">${getSeverityLabel(issue.severity)}</span>
            </div>
            <div class="issue-detail">
                维度: ${issue.dimensionName || dimensionNames[issue.dimension]} | 
                评分: ${issue.avgScore || '--'} |
                影响玩家: ${(issue.affectedAgents || []).map(a => agentTypeNames[a] || a).join(', ') || '全部'}
            </div>
        `;

        list.appendChild(item);
    });
}

function renderRecommendations() {
    if (!reportData || !reportData.recommendations) return;

    const list = document.getElementById('recommendationsList');
    list.innerHTML = '';

    if (reportData.recommendations.length === 0) {
        list.innerHTML = '<p class="no-recs">暂无迭代建议</p>';
        return;
    }

    reportData.recommendations.forEach(rec => {
        const item = document.createElement('div');
        item.className = 'rec-item';

        item.innerHTML = `
            <div class="rec-title">
                <span class="priority-badge priority-${rec.priority}">${rec.priorityLabel || rec.priority.toUpperCase()}</span>
                ${rec.action}
            </div>
            <div class="rec-detail">
                目标维度: ${rec.targetDimensions.map(d => dimensionNames[d] || d).join(', ')}
            </div>
        `;

        list.appendChild(item);
    });
}

function getSeverityLabel(severity) {
    const labels = {
        critical: '严重',
        high: '高',
        medium: '中',
        low: '低'
    };
    return labels[severity] || severity;
}

function highlightAgent(agentType) {
    if (radarChart) {
        radarChart.data.datasets.forEach((ds, index) => {
            if (ds.agentType === agentType) {
                radarChart.setDatasetVisibility(index, true);
            }
        });
        radarChart.update();
    }
}

function exportReport() {
    if (!reportData) return;

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crowdagents-report-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

async function refresh() {
    const success = await loadReport();
    if (success) {
        updateSummary();
        renderAgentCards();
        renderRadarChart();
        renderHeatmap();
        renderDimensionChart();
        renderIssues();
        renderRecommendations();
    }
}

document.getElementById('btnRefresh').addEventListener('click', refresh);
document.getElementById('btnExport').addEventListener('click', exportReport);

document.addEventListener('DOMContentLoaded', refresh);
