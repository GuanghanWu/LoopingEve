"""
游戏模块包
包含玩家、战斗、世界、背包等核心模块
"""

from .base import GameModule, Action, ActionResult, ActionType, GameContext
from .player import PlayerModule
from .combat import CombatModule
from .world import WorldModule
from .inventory import InventoryModule

__all__ = [
    'GameModule', 'Action', 'ActionResult', 'ActionType', 'GameContext',
    'PlayerModule', 'CombatModule', 'WorldModule', 'InventoryModule',
]
