"""
分析器
分析测试结果，识别问题模式
"""

from typing import Dict, List, Any, Optional


class Analyzer:
    def __init__(self, evaluation_config: Dict[str, Any], target_audience: Dict[str, Any] = None):
        self.config = evaluation_config
        self.dimension_names = evaluation_config.get('dimensionNames', {})
        self.agent_type_names = evaluation_config.get('agentTypeNames', {})
        self.target_audience = target_audience

    def analyze(self, agent_reports: List[Dict[str, Any]], evaluation: Dict[str, Any]) -> Dict[str, Any]:
        target_analysis = self._analyze_target_agents(agent_reports, evaluation)
        dimension_analysis = self._analyze_dimensions(evaluation)
        agent_analysis = self._analyze_agents(agent_reports)
        
        return {
            'target_analysis': target_analysis,
            'dimension_analysis': dimension_analysis,
            'agent_analysis': agent_analysis,
        }

    def _analyze_target_agents(self, reports: List[Dict[str, Any]], evaluation: Dict[str, Any]) -> Dict[str, Any]:
        if not self.target_audience:
            return {'enabled': False}
        
        primary_types = set(self.target_audience.get('primary', []))
        secondary_types = set(self.target_audience.get('secondary', []))
        
        target_reports = [r for r in reports if r.get('type') in primary_types or r.get('type') in secondary_types]
        
        if not target_reports:
            return {'enabled': True, 'target_count': 0}
        
        avg_scores = {}
        for dim in ['excitement', 'growth', 'pacing', 'playability', 'retention', 'immersion']:
            scores = [r.get('dimension_scores', {}).get(dim, 0) for r in target_reports]
            avg_scores[dim] = sum(scores) / len(scores) if scores else 0
        
        weak_dimensions = [
            {'dimension': dim, 'score': score, 'name': self.dimension_names.get(dim, dim)}
            for dim, score in avg_scores.items()
            if score < 3.0
        ]
        
        return {
            'enabled': True,
            'target_count': len(target_reports),
            'avg_scores': avg_scores,
            'weak_dimensions': sorted(weak_dimensions, key=lambda x: x['score']),
        }

    def _analyze_dimensions(self, evaluation: Dict[str, Any]) -> Dict[str, Any]:
        by_dimension = evaluation.get('by_dimension', {})
        analysis = {}
        
        for dim, stats in by_dimension.items():
            issues = []
            
            if stats['avg'] < 2.0:
                issues.append({
                    'type': 'low_average',
                    'severity': 'high',
                    'message': f"{self.dimension_names.get(dim, dim)}平均分过低({stats['avg']})",
                })
            
            if stats['variance'] > 4.0:
                issues.append({
                    'type': 'high_variance',
                    'severity': 'medium',
                    'message': f"{self.dimension_names.get(dim, dim)}评分差异过大",
                })
            
            if stats['max'] - stats['min'] > 5.0:
                issues.append({
                    'type': 'large_gap',
                    'severity': 'medium',
                    'message': f"{self.dimension_names.get(dim, dim)}最高最低分差距过大",
                })
            
            analysis[dim] = {
                'stats': stats,
                'issues': issues,
            }
        
        return analysis

    def _analyze_agents(self, reports: List[Dict[str, Any]]) -> Dict[str, Any]:
        analysis = {}
        
        for report in reports:
            agent_type = report.get('type', 'unknown')
            scores = report.get('dimension_scores', {})
            
            sorted_dims = sorted(scores.items(), key=lambda x: x[1])
            lowest = sorted_dims[0] if sorted_dims else (None, 0)
            highest = sorted_dims[-1] if sorted_dims else (None, 0)
            
            avg_score = sum(scores.values()) / len(scores) if scores else 0
            
            issues = []
            for dim, score in scores.items():
                if score < 2.0:
                    issues.append({
                        'dimension': dim,
                        'dimension_name': self.dimension_names.get(dim, dim),
                        'score': score,
                        'severity': 'high' if score < 1.0 else 'medium',
                    })
            
            analysis[agent_type] = {
                'name': report.get('name', 'Unknown'),
                'avg_score': round(avg_score, 2),
                'lowest_dimension': {'name': lowest[0], 'score': lowest[1]},
                'highest_dimension': {'name': highest[0], 'score': highest[1]},
                'issues': issues,
            }
        
        return analysis

    def get_summary(self, analysis: Dict[str, Any]) -> str:
        lines = []
        
        target = analysis.get('target_analysis', {})
        if target.get('enabled') and target.get('target_count', 0) > 0:
            weak = target.get('weak_dimensions', [])
            if weak:
                lines.append(f"目标玩家群体在 {len(weak)} 个维度表现较弱")
        
        dim_analysis = analysis.get('dimension_analysis', {})
        problem_dims = [d for d, a in dim_analysis.items() if a.get('issues')]
        if problem_dims:
            lines.append(f"发现 {len(problem_dims)} 个维度存在问题")
        
        return '。'.join(lines) if lines else '整体表现正常'
