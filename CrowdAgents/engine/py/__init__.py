"""
CrowdAgents Python 模拟引擎
基于状态快照模式的 AI Agent 游戏测试模拟系统
"""

__version__ = "2.0.0"

from .state import (
    GameState, StateDiff, SnapshotType,
    PlayerState, MonsterState, InventoryState, WorldState,
    CharacterState, UIState, QuestState, EconomyState, EventState,
)
from .snapshot import (
    SnapshotManager, SnapshotStore, SnapshotStrategy,
    SnapshotMetadata, SnapshotReplayer,
)
from .config import ConfigLoader, GameConfig, SimulationConfig
from .engine import GameEngine
from .modules.base import (
    GameModule, Action, ActionResult, ActionType, GameContext,
    ModularGameEngine,
)
from .agents.base import AgentBase
from .agents import (
    CasualAgent, HardcoreAgent, ExplorerAgent, SocialAgent, PayingAgent,
)
from .evaluator import Evaluator
from .analyzer import Analyzer
from .advisor import Advisor
from .simulator import Simulator, run_simulation
from .expression import ExpressionEvaluator, EvaluationContext
from .event_inference import EventInferenceEngine, EventRuleLoader, InferredEvent

__all__ = [
    'GameState', 'StateDiff', 'SnapshotType',
    'PlayerState', 'MonsterState', 'InventoryState', 'WorldState',
    'CharacterState', 'UIState', 'QuestState', 'EconomyState', 'EventState',
    'SnapshotManager', 'SnapshotStore', 'SnapshotStrategy',
    'SnapshotMetadata', 'SnapshotReplayer',
    'ConfigLoader', 'GameConfig', 'SimulationConfig',
    'GameEngine',
    'GameModule', 'Action', 'ActionResult', 'ActionType', 'GameContext',
    'ModularGameEngine',
    'AgentBase',
    'CasualAgent', 'HardcoreAgent', 'ExplorerAgent', 'SocialAgent', 'PayingAgent',
    'Evaluator', 'Analyzer', 'Advisor',
    'Simulator', 'run_simulation',
    'ExpressionEvaluator', 'EvaluationContext',
    'EventInferenceEngine', 'EventRuleLoader', 'InferredEvent',
]
