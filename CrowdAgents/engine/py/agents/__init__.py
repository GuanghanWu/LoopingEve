"""
Agent 包
包含 Agent 基类和 5 种玩家类型
"""

from .base import AgentBase
from .casual import CasualAgent
from .hardcore import HardcoreAgent
from .explorer import ExplorerAgent
from .social import SocialAgent
from .paying import PayingAgent

__all__ = [
    'AgentBase',
    'CasualAgent', 'HardcoreAgent', 'ExplorerAgent', 'SocialAgent', 'PayingAgent',
]
