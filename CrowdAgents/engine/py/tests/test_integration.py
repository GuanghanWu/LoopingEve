"""
集成测试
测试完整模拟流程
"""

import pytest
import sys
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from config import ConfigLoader
from simulator import Simulator, run_simulation


class TestIntegration:
    def test_config_loader(self):
        loader = ConfigLoader()
        
        game_config = loader.load_game_config()
        assert game_config is not None
        assert hasattr(game_config, 'player')
        
        simulation_config = loader.load_simulation_config()
        assert simulation_config is not None
        
        evaluation_config = loader.load_evaluation_config()
        assert evaluation_config is not None
    
    def test_short_simulation(self):
        loader = ConfigLoader()
        
        game_config = loader.load_game_config()
        simulation_config = loader.load_simulation_config()
        evaluation_config = loader.load_evaluation_config()
        target_audience = loader.get_target_audience()
        
        simulation_config.max_ticks = 100
        
        simulator = Simulator(
            simulation_config, game_config, 
            evaluation_config, target_audience
        )
        
        report = simulator.run()
        
        assert 'meta' in report
        assert 'agents' in report
        assert 'evaluation' in report
        assert len(report['agents']) > 0
    
    def test_agent_reports(self):
        loader = ConfigLoader()
        
        game_config = loader.load_game_config()
        simulation_config = loader.load_simulation_config()
        evaluation_config = loader.load_evaluation_config()
        
        simulation_config.max_ticks = 50
        
        simulator = Simulator(
            simulation_config, game_config, 
            evaluation_config, None
        )
        
        report = simulator.run()
        
        for agent_report in report['agents']:
            assert 'id' in agent_report
            assert 'name' in agent_report
            assert 'dimension_scores' in agent_report
            assert 'overall_score' in agent_report
            
            scores = agent_report['dimension_scores']
            for dim in ['excitement', 'growth', 'pacing', 'playability', 'retention', 'immersion']:
                assert dim in scores
                assert 0 <= scores[dim] <= 10
    
    def test_evaluation_structure(self):
        loader = ConfigLoader()
        
        game_config = loader.load_game_config()
        simulation_config = loader.load_simulation_config()
        evaluation_config = loader.load_evaluation_config()
        
        simulation_config.max_ticks = 50
        
        simulator = Simulator(
            simulation_config, game_config, 
            evaluation_config, None
        )
        
        report = simulator.run()
        
        evaluation = report['evaluation']
        
        assert 'by_agent' in evaluation
        assert 'by_dimension' in evaluation
        assert 'overall_avg' in evaluation
        
        by_dimension = evaluation['by_dimension']
        for dim in ['excitement', 'growth', 'pacing', 'playability', 'retention', 'immersion']:
            assert dim in by_dimension
            assert 'avg' in by_dimension[dim]
            assert 'variance' in by_dimension[dim]
    
    def test_run_simulation_function(self):
        report = run_simulation(duration_ms=5000, seed=42)
        
        assert report is not None
        assert 'meta' in report
        assert 'agents' in report


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
