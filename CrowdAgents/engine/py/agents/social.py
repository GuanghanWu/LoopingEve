"""
社交玩家 Agent
特征：重交流、爱分享、组队偏好
"""

from typing import Dict, Any, List
import random

from agents.base import AgentBase
from state import GameState
from modules.base import Action, ActionType


class SocialAgent(AgentBase):
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self._survival_priority = 0.5
        self._resource_conservation = 0.5

    def decide(self, state: GameState) -> Action:
        hp_ratio = state.player.hp / state.player.max_hp
        
        if hp_ratio < 0.3:
            if self.engine and self.engine.has_healing_item():
                healing_item = self._get_healing_item()
                if healing_item:
                    return Action(ActionType.USE_ITEM, {'item_id': healing_item})
        
        if state.world.can_advance:
            if random.random() < 0.6:
                return Action(ActionType.NEXT_FLOOR)
        
        if not state.world.in_battle:
            return Action(ActionType.EXPLORE)
        
        available_skills = self._get_available_skills(state)
        if available_skills and random.random() < 0.35:
            return Action(ActionType.USE_SKILL, {'skill_id': random.choice(available_skills)})
        
        return Action(ActionType.ATTACK)

    def _get_healing_item(self) -> str:
        if self.engine:
            return self.engine._inventory_module.get_healing_item()
        return None

    def _get_available_skills(self, state: GameState) -> List[str]:
        return [
            skill_id for skill_id in state.player.equipped_skills
            if state.player.skill_cooldowns.get(skill_id, 0) == 0
        ]
