"""
评估器
汇总所有 Agent 的评分，计算整体评估
"""

from typing import Dict, List, Any, Optional
from dataclasses import dataclass


@dataclass
class DimensionStats:
    avg: float
    min: float
    max: float
    variance: float


class Evaluator:
    def __init__(self, evaluation_config: Dict[str, Any], target_audience: Dict[str, Any] = None):
        self.config = evaluation_config
        self.weights = evaluation_config.get('agentWeights', {})
        self.thresholds = evaluation_config.get('thresholds', {})
        self.dimension_names = evaluation_config.get('dimensionNames', {})
        self.agent_type_names = evaluation_config.get('agentTypeNames', {})
        self.target_audience = target_audience

    def evaluate(self, agent_reports: List[Dict[str, Any]]) -> Dict[str, Any]:
        by_agent = self._aggregate_by_agent(agent_reports)
        by_dimension = self._aggregate_by_dimension(agent_reports)
        overall_avg = self._calculate_overall_average(by_agent)
        target_score = self._calculate_target_score(by_agent)
        issues = self._identify_issues(agent_reports)
        
        return {
            'by_agent': by_agent,
            'by_dimension': by_dimension,
            'overall_avg': overall_avg,
            'target_score': target_score,
            'issues': issues,
        }

    def _aggregate_by_agent(self, reports: List[Dict[str, Any]]) -> Dict[str, Dict[str, float]]:
        by_agent = {}
        for report in reports:
            agent_type = report.get('type', 'unknown')
            scores = report.get('dimension_scores', {})
            by_agent[agent_type] = {k: round(v, 2) for k, v in scores.items()}
        return by_agent

    def _aggregate_by_dimension(self, reports: List[Dict[str, Any]]) -> Dict[str, DimensionStats]:
        dimensions = ['excitement', 'growth', 'pacing', 'playability', 'retention', 'immersion']
        by_dimension = {}
        
        for dim in dimensions:
            values = [r.get('dimension_scores', {}).get(dim, 0) for r in reports]
            if values:
                avg = sum(values) / len(values)
                min_val = min(values)
                max_val = max(values)
                variance = sum((v - avg) ** 2 for v in values) / len(values) if len(values) > 1 else 0
                
                by_dimension[dim] = {
                    'avg': round(avg, 2),
                    'min': round(min_val, 2),
                    'max': round(max_val, 2),
                    'variance': round(variance, 2),
                }
        
        return by_dimension

    def _calculate_overall_average(self, by_agent: Dict[str, Dict[str, float]]) -> float:
        total = 0.0
        count = 0
        
        for agent_scores in by_agent.values():
            for score in agent_scores.values():
                total += score
                count += 1
        
        return round(total / count, 2) if count > 0 else 0.0

    def _calculate_target_score(self, by_agent: Dict[str, Dict[str, float]]) -> Optional[Dict[str, Any]]:
        if not self.target_audience or not self.target_audience.get('primary'):
            return None
        
        primary_types = self.target_audience.get('primary', [])
        weights = self.target_audience.get('weights', {})
        thresholds = self.target_audience.get('scoreThresholds', {
            'excellent': 8.0, 'good': 6.0, 'acceptable': 4.5, 'poor': 3.0
        })
        
        total_weight = 0.0
        weighted_score = 0.0
        target_details = []
        
        for agent_type in primary_types:
            if agent_type in by_agent:
                type_weight = weights.get(agent_type, 1.0 / len(primary_types))
                scores = by_agent[agent_type]
                type_avg = sum(scores.values()) / len(scores) if scores else 0
                
                weighted_score += type_avg * type_weight
                total_weight += type_weight
                
                status = self._get_status(type_avg, thresholds)
                
                target_details.append({
                    'type': agent_type,
                    'type_name': self.agent_type_names.get(agent_type, agent_type),
                    'weight': type_weight,
                    'avg_score': round(type_avg, 2),
                    'dimension_scores': scores,
                    'status': status,
                    'is_primary': True,
                })
        
        final_score = round(weighted_score / total_weight, 2) if total_weight > 0 else 0
        achievement_rate = round((final_score / 10) * 100, 1)
        
        return {
            'score': final_score,
            'achievement_rate': achievement_rate,
            'thresholds': thresholds,
            'target_details': target_details,
            'summary': self._generate_target_summary(final_score, target_details, thresholds),
        }

    def _get_status(self, score: float, thresholds: Dict[str, float]) -> str:
        if score >= thresholds.get('excellent', 8.0):
            return 'excellent'
        elif score >= thresholds.get('good', 6.0):
            return 'good'
        elif score >= thresholds.get('acceptable', 4.5):
            return 'acceptable'
        elif score >= thresholds.get('poor', 3.0):
            return 'poor'
        return 'critical'

    def _generate_target_summary(self, score: float, details: List[Dict], thresholds: Dict[str, float]) -> Dict[str, Any]:
        if score >= thresholds.get('excellent', 8.0):
            return {
                'level': 'excellent',
                'message': '目标玩家群体体验卓越，游戏设计完美匹配目标用户需求',
            }
        elif score >= thresholds.get('good', 6.0):
            return {
                'level': 'good',
                'message': '目标玩家群体体验良好，部分维度仍有优化空间',
            }
        elif score >= thresholds.get('acceptable', 4.5):
            return {
                'level': 'acceptable',
                'message': '目标玩家群体体验一般，需要针对性优化',
            }
        else:
            return {
                'level': 'poor',
                'message': '目标玩家群体体验较差，急需改进核心体验',
            }

    def _identify_issues(self, reports: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        issues = []
        
        for report in reports:
            for dim, score in report.get('dimension_scores', {}).items():
                if score < 1.0:
                    issues.append({
                        'agent': report.get('name', 'Unknown'),
                        'agent_type': report.get('type', 'unknown'),
                        'dimension': dim,
                        'dimension_name': self.dimension_names.get(dim, dim),
                        'score': score,
                        'severity': 'critical' if score < 0.5 else 'high',
                    })
                elif score < 2.0:
                    issues.append({
                        'agent': report.get('name', 'Unknown'),
                        'agent_type': report.get('type', 'unknown'),
                        'dimension': dim,
                        'dimension_name': self.dimension_names.get(dim, dim),
                        'score': score,
                        'severity': 'medium',
                    })
        
        return sorted(issues, key=lambda x: x['score'])

    def get_radar_chart_data(self, reports: List[Dict[str, Any]]) -> Dict[str, Any]:
        labels = ['刺激度', '成长感', '节奏感', '可玩性', '留存预估', '代入感']
        dimensions = ['excitement', 'growth', 'pacing', 'playability', 'retention', 'immersion']
        
        datasets = []
        for report in reports:
            scores = report.get('dimension_scores', {})
            datasets.append({
                'label': report.get('name', 'Unknown'),
                'data': [scores.get(dim, 0) for dim in dimensions],
                'agent_type': report.get('type', 'unknown'),
            })
        
        return {'labels': labels, 'datasets': datasets}

    def get_heatmap_data(self, by_agent: Dict[str, Dict[str, float]]) -> Dict[str, Any]:
        dimensions = ['excitement', 'growth', 'pacing', 'playability', 'retention', 'immersion']
        
        rows = []
        for agent_type, scores in by_agent.items():
            rows.append({
                'type': agent_type,
                'type_name': self.agent_type_names.get(agent_type, agent_type),
                'values': [scores.get(dim, 0) for dim in dimensions],
            })
        
        columns = [{'id': dim, 'name': self.dimension_names.get(dim, dim)} for dim in dimensions]
        
        return {'rows': rows, 'columns': columns}
