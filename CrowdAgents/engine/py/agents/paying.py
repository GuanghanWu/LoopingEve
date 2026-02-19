"""
付费玩家 Agent
特征：愿付费、求效率、重价值感
"""

from typing import Dict, Any, List
import random

from agents.base import AgentBase
from state import GameState
from modules.base import Action, ActionType


class PayingAgent(AgentBase):
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self._efficiency_priority = 0.7
        self._resource_conservation = 0.15

    def decide(self, state: GameState) -> Action:
        hp_ratio = state.player.hp / state.player.max_hp
        
        if hp_ratio < 0.5:
            if self.engine and self.engine.has_healing_item():
                healing_item = self._get_healing_item()
                if healing_item:
                    return Action(ActionType.USE_ITEM, {'item_id': healing_item})
        
        if state.world.can_advance:
            return Action(ActionType.NEXT_FLOOR)
        
        if not state.world.in_battle:
            return Action(ActionType.EXPLORE)
        
        available_skills = self._get_available_skills(state)
        if available_skills:
            best_skill = self._select_best_skill(state, available_skills)
            if best_skill:
                return Action(ActionType.USE_SKILL, {'skill_id': best_skill})
        
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

    def _select_best_skill(self, state: GameState, available_skills: List[str]) -> str:
        if not available_skills:
            return None
        
        if not self.engine or not self.engine.config:
            return random.choice(available_skills) if random.random() < 0.5 else None
        
        skills_config = self.engine.config.skills
        skill_map = {s['id']: s for s in skills_config}
        
        attack_skills = [s for s in available_skills if skill_map.get(s, {}).get('type') == 'attack']
        
        if attack_skills:
            return random.choice(attack_skills)
        
        return random.choice(available_skills) if random.random() < 0.4 else None
