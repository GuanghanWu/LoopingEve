"""
休闲玩家 Agent
特征：时间少、求放松、怕挫败
"""

from typing import Dict, Any, List

from agents.base import AgentBase
from state import GameState
from modules.base import Action, ActionType


class CasualAgent(AgentBase):
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self._survival_priority = 0.8
        self._risk_tolerance = 0.2
        self._resource_conservation = 0.75

    def decide(self, state: GameState) -> Action:
        hp_ratio = state.player.hp / state.player.max_hp
        
        if hp_ratio < 0.3:
            if self.engine and self.engine.has_healing_item():
                healing_item = self._get_healing_item()
                if healing_item:
                    return Action(ActionType.USE_ITEM, {'item_id': healing_item})
        
        if state.world.can_advance:
            return Action(ActionType.NEXT_FLOOR)
        
        if not state.world.in_battle:
            return Action(ActionType.EXPLORE)
        
        available_skills = self._get_available_skills(state)
        if available_skills and hp_ratio > 0.5:
            import random
            if random.random() < 0.3:
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
