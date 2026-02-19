"""
CrowdAgents Python 模拟引擎入口
"""

import argparse
import json
import sys
from pathlib import Path
import time

sys.path.insert(0, str(Path(__file__).parent))

from config import ConfigLoader, SimulationConfig
from simulator import Simulator, run_simulation
from state import GameState, StateDiff, SnapshotType
from snapshot import SnapshotManager, SnapshotStore, SnapshotReplayer
from engine import GameEngine
from agents.base import AgentBase
from evaluator import Evaluator
from analyzer import Analyzer
from advisor import Advisor


def print_summary(report: dict) -> None:
    print('\n========================================')
    print('       CrowdAgents 测试报告摘要')
    print('========================================\n')
    
    if report.get('target_audience') and report.get('evaluation', {}).get('target_score'):
        ts = report['evaluation']['target_score']
        print('🎯 目标玩家群体评估')
        print('----------------------------------------')
        print(f"  综合得分: {ts['score']}/10")
        print(f"  达成率: {ts['achievement_rate']}%")
        if ts.get('summary'):
            print(f"  状态: {ts['summary']['message']}")
        print('')
    
    meta = report.get('meta', {})
    matrix = report.get('matrix', {})
    evaluation = report.get('evaluation', {})
    metrics = report.get('metrics', {})
    
    print(f"📊 总体评分: {matrix.get('overallAvg', 0)}/10")
    print(f"👥 Agent数量: {meta.get('agentCount', 0)}")
    print(f"⚔️  总战斗次数: {metrics.get('totalBattles', 0)}")
    print(f"💀 总死亡次数: {metrics.get('totalDeaths', 0)}")
    print(f"⏱️  测试时长: {meta.get('totalDuration', 0) / 1000:.1f} 秒\n")
    
    print('--- Agent 评分 ---')
    agents = report.get('agents', [])
    for agent in sorted(agents, key=lambda x: x.get('overall_score', 0), reverse=True):
        avatar = agent.get('avatar', '🎮')
        name = agent.get('name', 'Unknown')
        score = agent.get('overall_score', 0)
        print(f"  {avatar} {name}: {score}/10")
    print('')
    
    print('--- 维度评分 ---')
    by_dimension = matrix.get('byDimension', {})
    dimension_names = report.get('dimension_names', {})
    for dim, data in by_dimension.items():
        name = dimension_names.get(dim, dim)
        print(f"  {name}: {data['avg']}/10 (方差: {data['variance']})")
    print('')
    
    issues = report.get('issues', [])
    if issues:
        print('--- 问题列表 ---')
        for issue in issues[:5]:
            severity_icon = {'critical': '🔴', 'high': '🟠', 'medium': '🟡', 'low': '🟢'}.get(issue['severity'], '⚪')
            print(f"  {severity_icon} [{issue['severity']}] {issue['issue']}")
    
    print('\n========================================\n')


def save_report(report: dict, output_path: str) -> None:
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    
    print(f"[CrowdAgents] 报告已生成: {path}")


def main():
    parser = argparse.ArgumentParser(description='CrowdAgents Python 模拟引擎')
    parser.add_argument('--config', '-c', default=None, help='配置文件目录')
    parser.add_argument('--duration', '-d', type=int, default=120000, help='模拟时长(毫秒)')
    parser.add_argument('--seed', '-s', type=int, default=None, help='随机种子')
    parser.add_argument('--output', '-o', default='../output/report.json', help='输出文件路径')
    parser.add_argument('--log-level', '-l', default='INFO', help='日志级别')
    parser.add_argument('--dashboard', action='store_true', help='模拟完成后打开仪表盘')
    
    args = parser.parse_args()
    
    print('[CrowdAgents] 系统启动...')
    print(f"[CrowdAgents] 模拟时长: {args.duration / 1000} 秒")
    if args.seed:
        print(f"[CrowdAgents] 随机种子: {args.seed}")
    print('')
    
    report = run_simulation(
        config_dir=args.config,
        duration_ms=args.duration,
        seed=args.seed,
        log_level=args.log_level,
    )
    
    save_report(report, args.output)
    print_summary(report)
    
    if args.dashboard:
        print('[CrowdAgents] 请打开 dashboard/index.html 查看可视化报告')
    
    print('[CrowdAgents] 完成！')
    return 0


if __name__ == '__main__':
    sys.exit(main())
