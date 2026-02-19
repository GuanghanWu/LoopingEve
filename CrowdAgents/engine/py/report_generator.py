"""
HTML 报告模板生成器
生成一个简洁的 HTML 模板，从 report.json 动态加载数据
"""

import json
from pathlib import Path
from typing import Dict, Any


HTML_TEMPLATE = '''<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CrowdAgents 测试报告</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            color: #eaeaea;
            min-height: 100vh;
            padding: 20px;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        .header {
            text-align: center;
            padding: 30px 0;
            border-bottom: 1px solid #3a3a5a;
            margin-bottom: 30px;
        }
        .header h1 {
            font-size: 2.5em;
            background: linear-gradient(90deg, #4CAF50, #2196F3);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 10px;
        }
        .header .subtitle { color: #888; font-size: 1.1em; }
        .summary-cards {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .card {
            background: rgba(255,255,255,0.05);
            border-radius: 12px;
            padding: 20px;
            text-align: center;
            border: 1px solid rgba(255,255,255,0.1);
        }
        .card .value { font-size: 2.5em; font-weight: bold; color: #4CAF50; }
        .card .label { color: #888; margin-top: 5px; }
        .section {
            background: rgba(255,255,255,0.03);
            border-radius: 12px;
            padding: 25px;
            margin-bottom: 25px;
            border: 1px solid rgba(255,255,255,0.08);
        }
        .section h2 { font-size: 1.5em; margin-bottom: 20px; color: #fff; }
        .agent-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
        }
        .agent-card {
            background: rgba(255,255,255,0.05);
            border-radius: 12px;
            padding: 20px;
            border: 1px solid rgba(255,255,255,0.1);
        }
        .agent-header { display: flex; align-items: center; gap: 15px; margin-bottom: 15px; }
        .agent-avatar { font-size: 2.5em; }
        .agent-name { font-size: 1.2em; font-weight: bold; }
        .agent-type { color: #888; font-size: 0.9em; }
        .agent-score { font-size: 2em; font-weight: bold; text-align: center; margin: 15px 0; }
        .score-good { color: #4CAF50; }
        .score-medium { color: #FFC107; }
        .score-low { color: #F44336; }
        .agent-stats { display: flex; justify-content: space-around; color: #888; font-size: 0.9em; }
        .dimension-bars { display: grid; gap: 15px; }
        .dimension-bar { display: grid; grid-template-columns: 100px 1fr 60px; align-items: center; gap: 15px; }
        .dimension-bar .label { color: #aaa; }
        .bar-container { background: rgba(255,255,255,0.1); border-radius: 10px; height: 24px; overflow: hidden; }
        .bar { height: 100%; border-radius: 10px; }
        .dimension-bar .value { text-align: right; font-weight: bold; }
        .charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; }
        @media (max-width: 900px) { .charts-row { grid-template-columns: 1fr; } }
        .chart-container { position: relative; height: 350px; }
        .footer { text-align: center; padding: 30px; color: #666; margin-top: 30px; }
        .svg-chart { width: 100%; height: 100%; }
        .suggestions-list { display: grid; gap: 12px; }
        .suggestion-item {
            background: rgba(255,255,255,0.03);
            border-radius: 8px;
            padding: 15px 20px;
            border-left: 4px solid;
            display: flex;
            align-items: center;
            gap: 15px;
        }
        .suggestion-critical { border-color: #F44336; }
        .suggestion-high { border-color: #FF9800; }
        .suggestion-medium { border-color: #FFC107; }
        .suggestion-low { border-color: #4CAF50; }
        .suggestion-priority {
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 0.85em;
            font-weight: bold;
            white-space: nowrap;
        }
        .priority-critical { background: #F44336; }
        .priority-high { background: #FF9800; }
        .priority-medium { background: #FFC107; color: #333; }
        .priority-low { background: #4CAF50; }
        .suggestion-content { flex: 1; }
        .suggestion-action { font-weight: 500; margin-bottom: 4px; }
        .suggestion-target { color: #888; font-size: 0.9em; }
        .legend { display: flex; flex-wrap: wrap; gap: 15px; justify-content: center; margin-top: 20px; }
        .legend-item { display: flex; align-items: center; gap: 8px; font-size: 0.9em; }
        .legend-color { width: 16px; height: 16px; border-radius: 3px; }
        .loading { text-align: center; padding: 50px; color: #888; }
        .error { text-align: center; padding: 50px; color: #F44336; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎮 CrowdAgents 测试报告</h1>
            <div class="subtitle">基于状态快照模式的 AI Agent 游戏测试模拟系统 (Python v2.0)</div>
        </div>
        
        <div id="content">
            <div class="loading">正在加载报告数据...</div>
        </div>
        
        <div class="footer">
            <p>Generated by CrowdAgents Python Engine v2.0</p>
            <p id="timestamp"></p>
        </div>
    </div>
    
    <script>
        const DIMENSION_NAMES = {
            excitement: '刺激度',
            growth: '成长感',
            pacing: '节奏感',
            playability: '可玩性',
            retention: '留存预估',
            immersion: '代入感'
        };
        
        const AGENT_TYPE_NAMES = {
            casual: '休闲玩家',
            hardcore: '硬核玩家',
            explorer: '探索玩家',
            social: '社交玩家',
            paying: '付费玩家'
        };
        
        const AGENT_COLORS = {
            casual: '#4CAF50',
            hardcore: '#F44336',
            explorer: '#2196F3',
            social: '#FF9800',
            paying: '#9C27B0'
        };
        
        const SUGGESTION_TEMPLATES = {
            excitement: '调整战斗节奏，增加暴击和闪避机制',
            growth: '加快升级节奏，增加装备获取途径',
            pacing: '优化楼层推进难度，减少无意义等待',
            playability: '增加怪物种类和技能多样性',
            retention: '优化死亡惩罚机制，增加保护措施',
            immersion: '增加世界观内容和剧情元素，提升代入感'
        };
        
        function getScoreClass(score) {
            if (score >= 7) return 'score-good';
            if (score >= 5) return 'score-medium';
            return 'score-low';
        }
        
        function getBarColor(score) {
            if (score >= 7) return '#4CAF50';
            if (score >= 6) return '#8BC34A';
            if (score >= 5) return '#FFC107';
            if (score >= 4) return '#FF9800';
            return '#F44336';
        }
        
        function renderSummaryCards(data) {
            const meta = data.meta || {};
            const matrix = data.matrix || {};
            const metrics = data.metrics || {};
            const overall = matrix.overallAvg || 0;
            
            return `
                <div class="summary-cards">
                    <div class="card">
                        <div class="value ${getScoreClass(overall)}">${overall.toFixed(2)}</div>
                        <div class="label">📊 总体评分</div>
                    </div>
                    <div class="card">
                        <div class="value">${meta.agentCount || 0}</div>
                        <div class="label">👥 Agent 数量</div>
                    </div>
                    <div class="card">
                        <div class="value">${metrics.totalBattles || 0}</div>
                        <div class="label">⚔️ 总战斗次数</div>
                    </div>
                    <div class="card">
                        <div class="value">${metrics.totalDeaths || 0}</div>
                        <div class="label">💀 总死亡次数</div>
                    </div>
                    <div class="card">
                        <div class="value">${((meta.totalDuration || 0) / 1000).toFixed(0)}s</div>
                        <div class="label">⏱️ 测试时长</div>
                    </div>
                </div>
            `;
        }
        
        function renderAgents(agents) {
            if (!agents || !agents.length) return '';
            
            const cards = agents
                .sort((a, b) => (b.overallScore || b.overall_score || 0) - (a.overallScore || a.overall_score || 0))
                .map(agent => {
                    const score = agent.overallScore || agent.overall_score || 0;
                    const stats = agent.stats || {};
                    return `
                        <div class="agent-card">
                            <div class="agent-header">
                                <span class="agent-avatar">${agent.avatar || '🎮'}</span>
                                <div>
                                    <div class="agent-name">${agent.name || 'Unknown'}</div>
                                    <div class="agent-type">${AGENT_TYPE_NAMES[agent.type] || agent.type}</div>
                                </div>
                            </div>
                            <div class="agent-score ${getScoreClass(score)}">${score.toFixed(2)}/10</div>
                            <div class="agent-stats">
                                <span>⚔️ ${stats.wins || 0} 胜</span>
                                <span>💀 ${stats.deaths || 0} 死</span>
                                <span>📍 ${stats.maxFloor || stats.max_floor || 1} 层</span>
                            </div>
                        </div>
                    `;
                }).join('');
            
            return `
                <div class="section">
                    <h2>👥 Agent 评分</h2>
                    <div class="agent-grid">${cards}</div>
                </div>
            `;
        }
        
        function renderDimensions(byDimension) {
            if (!byDimension) return '';
            
            const bars = Object.entries(byDimension).map(([dim, data]) => {
                const avg = data.avg || 0;
                return `
                    <div class="dimension-bar">
                        <span class="label">${DIMENSION_NAMES[dim] || dim}</span>
                        <div class="bar-container">
                            <div class="bar" style="width: ${avg * 10}%; background: ${getBarColor(avg)};"></div>
                        </div>
                        <span class="value">${avg.toFixed(2)}</span>
                    </div>
                `;
            }).join('');
            
            return `
                <div class="section">
                    <h2>📊 维度评分</h2>
                    <div class="dimension-bars">${bars}</div>
                </div>
            `;
        }
        
        function renderSuggestions(byDimension) {
            if (!byDimension) return '';
            
            const suggestions = Object.entries(byDimension)
                .map(([dim, data]) => ({
                    dimension: dim,
                    avg: data.avg || 0,
                    name: DIMENSION_NAMES[dim] || dim,
                    action: SUGGESTION_TEMPLATES[dim] || '需要优化'
                }))
                .sort((a, b) => a.avg - b.avg)
                .slice(0, 6)
                .map(s => {
                    let priority = 'low';
                    let priorityLabel = '低优先级';
                    if (s.avg < 2) { priority = 'critical'; priorityLabel = '紧急'; }
                    else if (s.avg < 4) { priority = 'high'; priorityLabel = '高优先级'; }
                    else if (s.avg < 6) { priority = 'medium'; priorityLabel = '中优先级'; }
                    
                    return `
                        <div class="suggestion-item suggestion-${priority}">
                            <span class="suggestion-priority priority-${priority}">${priorityLabel}</span>
                            <div class="suggestion-content">
                                <div class="suggestion-action">${s.action}</div>
                                <div class="suggestion-target">目标维度: ${s.name} | 当前评分: ${s.avg.toFixed(2)}</div>
                            </div>
                        </div>
                    `;
                }).join('');
            
            return `
                <div class="section">
                    <h2>💡 优化建议</h2>
                    <div class="suggestions-list">${suggestions}</div>
                </div>
            `;
        }
        
        function renderCharts(agents, byDimension) {
            return `
                <div class="section">
                    <h2>📈 可视化分析</h2>
                    <div class="charts-row">
                        <div>
                            <h3 style="margin-bottom: 15px; color: #aaa;">雷达图 - Agent 维度对比</h3>
                            <div class="chart-container">
                                <svg class="svg-chart" viewBox="0 0 400 400" id="radarChart"></svg>
                            </div>
                            <div class="legend" id="radarLegend"></div>
                        </div>
                        <div>
                            <h3 style="margin-bottom: 15px; color: #aaa;">柱状图 - 维度平均分</h3>
                            <div class="chart-container">
                                <svg class="svg-chart" viewBox="0 0 400 350" id="barChart"></svg>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        function drawRadarChart(agents) {
            const svg = document.getElementById('radarChart');
            const legend = document.getElementById('radarLegend');
            if (!svg || !agents || !agents.length) return;
            
            const cx = 200, cy = 200, maxR = 150;
            const dimensionKeys = ['excitement', 'growth', 'pacing', 'playability', 'retention', 'immersion'];
            const labels = dimensionKeys.map(k => DIMENSION_NAMES[k] || k);
            const n = labels.length;
            
            for (let r = 1; r <= 5; r++) {
                const radius = (r / 5) * maxR;
                let path = '';
                for (let i = 0; i <= n; i++) {
                    const angle = (Math.PI * 2 * i / n) - Math.PI / 2;
                    const x = cx + radius * Math.cos(angle);
                    const y = cy + radius * Math.sin(angle);
                    path += (i === 0 ? 'M' : 'L') + x + ',' + y;
                }
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                circle.setAttribute('d', path);
                circle.setAttribute('fill', 'none');
                circle.setAttribute('stroke', '#333');
                circle.setAttribute('stroke-width', '1');
                svg.appendChild(circle);
            }
            
            for (let i = 0; i < n; i++) {
                const angle = (Math.PI * 2 * i / n) - Math.PI / 2;
                const x2 = cx + maxR * Math.cos(angle);
                const y2 = cy + maxR * Math.sin(angle);
                
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', cx);
                line.setAttribute('y1', cy);
                line.setAttribute('x2', x2);
                line.setAttribute('y2', y2);
                line.setAttribute('stroke', '#444');
                line.setAttribute('stroke-width', '1');
                svg.appendChild(line);
                
                const lx = cx + (maxR + 25) * Math.cos(angle);
                const ly = cy + (maxR + 25) * Math.sin(angle);
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('x', lx);
                text.setAttribute('y', ly + 4);
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('fill', '#aaa');
                text.setAttribute('font-size', '12');
                text.textContent = labels[i];
                svg.appendChild(text);
            }
            
            agents.forEach(agent => {
                const scores = agent.dimensionScores || agent.dimension_scores || {};
                const data = dimensionKeys.map(k => scores[k] || 0);
                const color = AGENT_COLORS[agent.type] || '#888';
                
                let path = '';
                for (let i = 0; i <= n; i++) {
                    const idx = i % n;
                    const angle = (Math.PI * 2 * idx / n) - Math.PI / 2;
                    const r = (data[idx] / 10) * maxR;
                    const x = cx + r * Math.cos(angle);
                    const y = cy + r * Math.sin(angle);
                    path += (i === 0 ? 'M' : 'L') + x + ',' + y;
                }
                path += 'Z';
                
                const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                polygon.setAttribute('d', path);
                polygon.setAttribute('fill', color + '33');
                polygon.setAttribute('stroke', color);
                polygon.setAttribute('stroke-width', '2');
                svg.appendChild(polygon);
                
                legend.innerHTML += `<div class="legend-item"><div class="legend-color" style="background:${color}"></div><span>${agent.name}</span></div>`;
            });
        }
        
        function drawBarChart(byDimension) {
            const svg = document.getElementById('barChart');
            if (!svg || !byDimension) return;
            
            const dimensionKeys = ['excitement', 'growth', 'pacing', 'playability', 'retention', 'immersion'];
            const labels = dimensionKeys.map(k => DIMENSION_NAMES[k] || k);
            const values = dimensionKeys.map(k => (byDimension[k] || {}).avg || 0);
            const colors = values.map(v => getBarColor(v));
            
            const barWidth = 40;
            const gap = 25;
            const startX = 50;
            const maxH = 280;
            const baseY = 310;
            
            const yLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            yLine.setAttribute('x1', startX - 10);
            yLine.setAttribute('y1', 30);
            yLine.setAttribute('x2', startX - 10);
            yLine.setAttribute('y2', baseY);
            yLine.setAttribute('stroke', '#444');
            yLine.setAttribute('stroke-width', '1');
            svg.appendChild(yLine);
            
            const xLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            xLine.setAttribute('x1', startX - 10);
            xLine.setAttribute('y1', baseY);
            xLine.setAttribute('x2', 380);
            xLine.setAttribute('y2', baseY);
            xLine.setAttribute('stroke', '#444');
            xLine.setAttribute('stroke-width', '1');
            svg.appendChild(xLine);
            
            for (let i = 0; i <= 10; i += 2) {
                const y = baseY - (i / 10) * maxH;
                const tick = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                tick.setAttribute('x', startX - 15);
                tick.setAttribute('y', y + 4);
                tick.setAttribute('text-anchor', 'end');
                tick.setAttribute('fill', '#888');
                tick.setAttribute('font-size', '10');
                tick.textContent = i;
                svg.appendChild(tick);
            }
            
            labels.forEach((label, i) => {
                const x = startX + i * (barWidth + gap);
                const h = (values[i] / 10) * maxH;
                const y = baseY - h;
                
                const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.setAttribute('x', x);
                rect.setAttribute('y', y);
                rect.setAttribute('width', barWidth);
                rect.setAttribute('height', h);
                rect.setAttribute('fill', colors[i]);
                rect.setAttribute('rx', '4');
                svg.appendChild(rect);
                
                const valText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                valText.setAttribute('x', x + barWidth / 2);
                valText.setAttribute('y', y - 8);
                valText.setAttribute('text-anchor', 'middle');
                valText.setAttribute('fill', '#fff');
                valText.setAttribute('font-size', '11');
                valText.setAttribute('font-weight', 'bold');
                valText.textContent = values[i].toFixed(2);
                svg.appendChild(valText);
                
                const labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                labelText.setAttribute('x', x + barWidth / 2);
                labelText.setAttribute('y', baseY + 20);
                labelText.setAttribute('text-anchor', 'middle');
                labelText.setAttribute('fill', '#aaa');
                labelText.setAttribute('font-size', '11');
                labelText.textContent = label;
                svg.appendChild(labelText);
            });
        }
        
        async function loadReport() {
            try {
                const response = await fetch('report.json');
                if (!response.ok) throw new Error('无法加载 report.json');
                
                const data = await response.json();
                
                const agents = data.agents || [];
                const matrix = data.matrix || {};
                const byDimension = matrix.byDimension || {};
                
                document.getElementById('content').innerHTML = `
                    ${renderSummaryCards(data)}
                    ${renderAgents(agents)}
                    ${renderCharts(agents, byDimension)}
                    ${renderDimensions(byDimension)}
                    ${renderSuggestions(byDimension)}
                `;
                
                document.getElementById('timestamp').textContent = 
                    data.meta?.generatedAt || new Date().toISOString();
                
                setTimeout(() => {
                    drawRadarChart(agents);
                    drawBarChart(byDimension);
                }, 100);
                
            } catch (error) {
                document.getElementById('content').innerHTML = `
                    <div class="error">
                        <h2>❌ 加载失败</h2>
                        <p>${error.message}</p>
                        <p>请确保 report.json 文件存在于此目录</p>
                    </div>
                `;
            }
        }
        
        loadReport();
    </script>
</body>
</html>
'''


def generate_html_report(output_path: str) -> None:
    """生成 HTML 报告模板（数据从 report.json 动态加载）"""
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(HTML_TEMPLATE)
    
    print(f"[CrowdAgents] HTML 报告模板已生成: {path}")
