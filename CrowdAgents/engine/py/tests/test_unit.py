"""
单元测试
测试核心组件的功能
"""

import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from state import GameState, PlayerState, MonsterState, InventoryState, WorldState, StateDiff, SnapshotType
from snapshot import SnapshotManager, SnapshotStore
from modules.base import Action, ActionType
from engine import GameEngine
from agents.base import AgentBase
from config import GameConfig


class TestPlayerState:
    def test_to_dict(self):
        player = PlayerState(
            hp=100, max_hp=100, mp=50, max_mp=50,
            level=1, exp=0, max_exp=100,
            atk=10, defense=5, gold=0,
            crit_rate=0.1, dodge_rate=0.05,
        )
        data = player.to_dict()
        
        assert data['hp'] == 100
        assert data['level'] == 1
        assert data['crit_rate'] == 0.1
    
    def test_from_dict(self):
        data = {
            'hp': 80, 'max_hp': 100, 'mp': 30, 'max_mp': 50,
            'level': 2, 'exp': 50, 'max_exp': 150,
            'atk': 12, 'defense': 6, 'gold': 100,
            'crit_rate': 0.15, 'dodge_rate': 0.08,
            'learned_skills': ['skill1'],
        }
        player = PlayerState.from_dict(data)
        
        assert player.hp == 80
        assert player.level == 2
        assert player.learned_skills == ['skill1']


class TestSnapshotManager:
    def test_create_snapshot(self):
        store = SnapshotStore()
        manager = SnapshotManager(store)
        
        player = PlayerState(
            hp=100, max_hp=100, mp=50, max_mp=50,
            level=1, exp=0, max_exp=100,
            atk=10, defense=5, gold=0,
            crit_rate=0.1, dodge_rate=0.05,
        )
        world = WorldState(
            floor=1, killed_on_floor=0, monsters_to_advance=3,
            can_advance=False, in_battle=False,
        )
        inventory = InventoryState(slots=20)
        
        state = GameState(
            tick=1, timestamp=1000.0,
            player=player, monster=None,
            inventory=inventory, world=world,
        )
        
        snapshot_id = manager.create_snapshot(1, state)
        
        assert snapshot_id is not None
        assert len(manager._snapshots) == 1
    
    def test_compute_diff(self):
        manager = SnapshotManager()
        
        player1 = PlayerState(
            hp=100, max_hp=100, mp=50, max_mp=50,
            level=1, exp=0, max_exp=100,
            atk=10, defense=5, gold=0,
            crit_rate=0.1, dodge_rate=0.05,
        )
        world1 = WorldState(
            floor=1, killed_on_floor=0, monsters_to_advance=3,
            can_advance=False, in_battle=False,
        )
        inventory1 = InventoryState(slots=20)
        
        prev_state = GameState(
            tick=1, timestamp=1000.0,
            player=player1, monster=None,
            inventory=inventory1, world=world1,
        )
        
        player2 = PlayerState(
            hp=80, max_hp=100, mp=50, max_mp=50,
            level=1, exp=50, max_exp=100,
            atk=10, defense=5, gold=10,
            crit_rate=0.1, dodge_rate=0.05,
        )
        world2 = WorldState(
            floor=1, killed_on_floor=0, monsters_to_advance=3,
            can_advance=False, in_battle=True,
        )
        inventory2 = InventoryState(slots=20)
        
        curr_state = GameState(
            tick=2, timestamp=1100.0,
            player=player2, monster=None,
            inventory=inventory2, world=world2,
        )
        
        diff = manager.compute_diff(prev_state, curr_state)
        
        assert diff.hp_delta == -20
        assert diff.gold_delta == 10
        assert diff.battle_started == True
        assert 'player_damaged' in diff.events_inferred


class TestAction:
    def test_action_creation(self):
        action = Action(ActionType.ATTACK)
        assert action.type == ActionType.ATTACK
        assert action.params == {}
    
    def test_action_with_params(self):
        action = Action(ActionType.USE_SKILL, {'skill_id': 'fireball'})
        assert action.type == ActionType.USE_SKILL
        assert action.params['skill_id'] == 'fireball'


class TestAgentBase:
    def test_agent_creation(self):
        config = {
            'id': 'test_01',
            'name': 'Test Agent',
            'type': 'casual',
        }
        agent = AgentBase.create(config)
        
        assert agent.id == 'test_01'
        assert agent.name == 'Test Agent'
        assert agent.type == 'casual'
    
    def test_dimension_scores_range(self):
        config = {
            'id': 'test_01',
            'name': 'Test Agent',
            'type': 'casual',
        }
        agent = AgentBase(config)
        
        agent._adjust_score('excitement', 15)
        assert agent.dimension_scores['excitement'] <= 10
        
        agent._adjust_score('excitement', -15)
        assert agent.dimension_scores['excitement'] >= 0
    
    def test_get_report(self):
        config = {
            'id': 'test_01',
            'name': 'Test Agent',
            'type': 'casual',
        }
        agent = AgentBase(config)
        
        report = agent.get_report()
        
        assert report['id'] == 'test_01'
        assert 'dimension_scores' in report
        assert 'overall_score' in report


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
