"""
建议生成器
基于评估结果生成迭代建议
"""

from typing import Dict, List, Any, Optional


class Advisor:
    def __init__(self, evaluation_config: Dict[str, Any], target_audience: Dict[str, Any] = None):
        self.config = evaluation_config
        self.dimension_names = evaluation_config.get('dimensionNames', {})
        self.agent_type_names = evaluation_config.get('agentTypeNames', {})
        self.target_audience = target_audience
        
        self._improvement_suggestions = {
            'excitement': '增加战斗变数，如暴击、闪避、特殊技能；调整怪物难度曲线',
            'growth': '加快升级节奏，增加装备获取途径；优化奖励反馈机制',
            'pacing': '优化战斗节奏，减少无意义等待；调整楼层推进难度',
            'playability': '增加技能多样性，丰富战斗策略；扩展怪物种类',
            'retention': '降低死亡惩罚，增加保护机制；优化新手引导',
            'immersion': '丰富怪物种类，增加探索奖励；扩展世界观内容',
        }

    def generate(self, evaluation: Dict[str, Any], agent_reports: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        suggestions = []
        
        by_dimension = evaluation.get('by_dimension', {})
        for dim, stats in by_dimension.items():
            if stats['avg'] < 3.0:
                affected_agents = self._get_affected_agents(agent_reports, dim, threshold=3.0)
                suggestions.append({
                    'priority': 'high',
                    'priority_label': '高优先级',
                    'dimension': dim,
                    'dimension_name': self.dimension_names.get(dim, dim),
                    'suggestion': self._improvement_suggestions.get(dim, '需要进一步分析'),
                    'affected_agents': affected_agents,
                    'current_score': stats['avg'],
                    'is_target_recommendation': self._is_target_dimension(dim),
                })
            elif stats['avg'] < 5.0:
                affected_agents = self._get_affected_agents(agent_reports, dim, threshold=5.0)
                suggestions.append({
                    'priority': 'medium',
                    'priority_label': '中优先级',
                    'dimension': dim,
                    'dimension_name': self.dimension_names.get(dim, dim),
                    'suggestion': self._improvement_suggestions.get(dim, '需要进一步分析'),
                    'affected_agents': affected_agents,
                    'current_score': stats['avg'],
                    'is_target_recommendation': self._is_target_dimension(dim),
                })
        
        issues = evaluation.get('issues', [])
        for issue in issues[:5]:
            if issue['severity'] in ['critical', 'high']:
                suggestions.append({
                    'priority': 'critical' if issue['severity'] == 'critical' else 'high',
                    'priority_label': '紧急' if issue['severity'] == 'critical' else '高优先级',
                    'dimension': issue['dimension'],
                    'dimension_name': issue['dimension_name'],
                    'suggestion': f"针对 {issue['agent']} 的 {issue['dimension_name']} 问题需要重点关注",
                    'affected_agents': [issue['agent']],
                    'current_score': issue['score'],
                    'is_target_recommendation': self._is_target_agent_type(issue['agent_type']),
                })
        
        return sorted(suggestions, key=lambda x: {'critical': 0, 'high': 1, 'medium': 2, 'low': 3}.get(x['priority'], 4))

    def _get_affected_agents(self, reports: List[Dict[str, Any]], dimension: str, threshold: float) -> List[str]:
        affected = []
        for report in reports:
            score = report.get('dimension_scores', {}).get(dimension, 0)
            if score < threshold:
                affected.append(report.get('name', 'Unknown'))
        return affected

    def _is_target_dimension(self, dimension: str) -> bool:
        return True

    def _is_target_agent_type(self, agent_type: str) -> bool:
        if not self.target_audience:
            return True
        primary = self.target_audience.get('primary', [])
        secondary = self.target_audience.get('secondary', [])
        return agent_type in primary or agent_type in secondary

    def get_summary(self, suggestions: List[Dict[str, Any]]) -> str:
        if not suggestions:
            return '暂无紧急优化建议'
        
        high_priority = [s for s in suggestions if s['priority'] in ['critical', 'high']]
        if high_priority:
            dims = [s['dimension_name'] for s in high_priority[:3]]
            return f"建议优先优化: {', '.join(dims)}"
        
        return f"共有 {len(suggestions)} 项优化建议"
