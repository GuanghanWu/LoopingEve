"""
模拟器核心
管理 Agent-Engine 绑定实例，驱动模拟过程
"""

from typing import Dict, List, Any, Optional
from dataclasses import dataclass
import time
import logging

from state import GameState, StateDiff
from snapshot import SnapshotManager, SnapshotStore
from engine import GameEngine
from modules.base import Action, ActionResult
from agents.base import AgentBase
from config import GameConfig, SimulationConfig, ConfigLoader
from evaluator import Evaluator
from analyzer import Analyzer
from advisor import Advisor


@dataclass
class AgentInstance:
    agent: AgentBase
    engine: GameEngine
    snapshot_manager: SnapshotManager


class SimulationLogger:
    def __init__(self, log_level: str = "INFO"):
        self.logger = logging.getLogger("CrowdAgents")
        self.logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))
        
        if not self.logger.handlers:
            handler = logging.StreamHandler()
            handler.setFormatter(logging.Formatter(
                '%(asctime)s [%(levelname)s] %(message)s'
            ))
            self.logger.addHandler(handler)

    def log_tick(self, tick: int, agent_id: str, action: Action):
        self.logger.debug(f"Tick {tick}: Agent {agent_id} -> {action.type.value}")

    def log_event(self, agent_id: str, event: str, data: Dict):
        self.logger.info(f"Agent {agent_id}: {event}")

    def log_error(self, agent_id: str, error: Exception):
        self.logger.error(f"Agent {agent_id} error: {error}")


class Simulator:
    def __init__(self, simulation_config: SimulationConfig, game_config: GameConfig,
                 evaluation_config: Dict[str, Any], target_audience: Dict[str, Any] = None):
        self.simulation_config = simulation_config
        self.game_config = game_config
        self.evaluation_config = evaluation_config
        self.target_audience = target_audience
        
        self.instances: List[AgentInstance] = []
        self.tick = 0
        self.logger = SimulationLogger(simulation_config.log_level)
        
        self._create_instances()

    def _create_instances(self) -> None:
        for agent_config in self.simulation_config.agents:
            instance = self._create_instance(agent_config)
            self.instances.append(instance)

    def _create_instance(self, agent_config: Dict[str, Any]) -> AgentInstance:
        seed = self.simulation_config.random_seed
        if seed is not None:
            import random
            seed = seed + hash(agent_config.get('id', ''))
        
        engine = GameEngine(self.game_config, seed)
        agent = AgentBase.create(agent_config)
        
        agent.set_engine(engine)
        agent.set_evaluation_config(self.evaluation_config)
        
        snapshot_manager = SnapshotManager()
        
        return AgentInstance(
            agent=agent,
            engine=engine,
            snapshot_manager=snapshot_manager,
        )

    def run(self, duration_ms: int = None) -> Dict[str, Any]:
        if duration_ms is None:
            duration_ms = self.simulation_config.max_ticks * self.simulation_config.tick_interval_ms
        
        end_tick = duration_ms // self.simulation_config.tick_interval_ms
        
        print(f"[CrowdAgents] 开始模拟，共 {end_tick} ticks，{len(self.instances)} 个 Agent")
        start_time = time.time()
        
        while self.tick < end_tick:
            self.tick += 1
            self._run_tick()
            
            if self.tick % 100 == 0:
                elapsed = time.time() - start_time
                tps = self.tick / elapsed if elapsed > 0 else 0
                print(f"[CrowdAgents] Tick {self.tick}/{end_tick} ({tps:.1f} ticks/s)")
        
        elapsed = time.time() - start_time
        print(f"[CrowdAgents] 模拟完成，耗时 {elapsed:.2f}s")
        
        return self._generate_result()

    def _run_tick(self) -> None:
        for instance in self.instances:
            if not instance.agent.should_quit():
                self._run_instance_tick(instance)

    def _run_instance_tick(self, instance: AgentInstance) -> None:
        engine = instance.engine
        agent = instance.agent
        snapshot_mgr = instance.snapshot_manager
        
        prev_state = engine.get_state()
        
        action = agent.decide(prev_state)
        result = engine.execute(action)
        
        curr_state = engine.get_state()
        
        events = engine.get_events()
        snapshot_mgr.create_snapshot(self.tick, curr_state, events)
        
        diff = snapshot_mgr.compute_diff(prev_state, curr_state)
        agent.analyze_state_change(prev_state, curr_state, diff)
        
        agent.check_unmet_expectations()
        
        if self.tick % 50 == 0:
            agent.check_unmet_expectations()

    def _generate_result(self) -> Dict[str, Any]:
        agent_reports = [inst.agent.get_report() for inst in self.instances]
        
        evaluator = Evaluator(self.evaluation_config, self.target_audience)
        evaluation = evaluator.evaluate(agent_reports)
        
        analyzer = Analyzer(self.evaluation_config, self.target_audience)
        analysis = analyzer.analyze(agent_reports, evaluation)
        
        advisor = Advisor(self.evaluation_config, self.target_audience)
        suggestions = advisor.generate(evaluation, agent_reports)
        
        total_battles = sum(r['stats']['battles'] for r in agent_reports)
        total_deaths = sum(r['stats']['deaths'] for r in agent_reports)
        total_wins = sum(r['stats']['wins'] for r in agent_reports)
        
        dimension_names = {
            'excitement': '刺激度',
            'growth': '成长感',
            'pacing': '节奏感',
            'playability': '可玩性',
            'retention': '留存预估',
            'immersion': '代入感'
        }
        
        issues = []
        for agent_report in agent_reports:
            for dim, score in agent_report['dimension_scores'].items():
                if score < 3.0:
                    issues.append({
                        'issue': f"{agent_report['name']} 的 {dimension_names.get(dim, dim)} 评分过低",
                        'dimension': dim,
                        'dimensionName': dimension_names.get(dim, dim),
                        'severity': 'critical' if score < 1.0 else 'high',
                        'avgScore': score,
                        'affectedAgents': [agent_report['type']]
                    })
        issues.sort(key=lambda x: x['avgScore'])
        
        recommendations = []
        for s in suggestions[:10]:
            recommendations.append({
                'priority': s['priority'],
                'priorityLabel': s['priority_label'],
                'action': s['suggestion'],
                'targetDimensions': [s['dimension_name']]
            })
        
        return {
            'meta': {
                'version': '2.0',
                'generatedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                'totalDuration': self.simulation_config.max_ticks * self.simulation_config.tick_interval_ms,
                'totalTicks': self.tick,
                'agentCount': len(self.instances),
            },
            'target_audience': self.target_audience,
            'matrix': {
                'overallAvg': evaluation['overall_avg'],
                'byAgent': evaluation['by_agent'],
                'byDimension': evaluation['by_dimension'],
            },
            'metrics': {
                'totalBattles': total_battles,
                'totalDeaths': total_deaths,
                'totalWins': total_wins,
            },
            'evaluation': evaluation,
            'analysis': analysis,
            'issues': issues,
            'recommendations': recommendations,
            'suggestions': suggestions,
            'agents': agent_reports,
            'chart_data': {
                'radar_chart': evaluator.get_radar_chart_data(agent_reports),
                'heatmap': evaluator.get_heatmap_data(evaluation['by_agent']),
            },
            'chartData': {
                'radarChart': evaluator.get_radar_chart_data(agent_reports),
                'heatmap': evaluator.get_heatmap_data(evaluation['by_agent']),
            },
            'dimension_names': dimension_names,
            'agent_type_names': self.evaluation_config.get('agentTypeNames', {}),
        }


def run_simulation(config_dir: str = None, duration_ms: int = None, 
                   seed: int = None, log_level: str = "INFO") -> Dict[str, Any]:
    loader = ConfigLoader(config_dir)
    
    game_config = loader.load_game_config()
    simulation_config = loader.load_simulation_config()
    evaluation_config = loader.load_evaluation_config()
    target_audience = loader.get_target_audience()
    
    if seed is not None:
        simulation_config.random_seed = seed
    simulation_config.log_level = log_level
    
    if duration_ms is not None:
        simulation_config.max_ticks = duration_ms // simulation_config.tick_interval_ms
    
    simulator = Simulator(simulation_config, game_config, evaluation_config, target_audience)
    return simulator.run(duration_ms)
