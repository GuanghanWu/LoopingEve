"""
硬核玩家 Agent
特征：追求挑战、深究机制、比拼排名
"""

from typing import Dict, Any, List

from agents.base import AgentBase
from state import GameState
from modules.base import Action, ActionType


class HardcoreAgent(AgentBase):
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self._survival_priority = 0.3
        self._risk_tolerance = 0.8
        self._efficiency_priority = 0.9

    def decide(self, state: GameState) -> Action:
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

    def _get_available_skills(self, state: GameState) -> List[str]:
        return [
            skill_id for skill_id in state.player.equipped_skills
            if state.player.skill_cooldowns.get(skill_id, 0) == 0
        ]

    def _select_best_skill(self, state: GameState, available_skills: List[str]) -> str:
        if not available_skills:
            return None
        
        if not self.engine or not self.engine.config:
            return available_skills[0]
        
        skills_config = self.engine.config.skills
        skill_map = {s['id']: s for s in skills_config}
        
        attack_skills = [s for s in available_skills if skill_map.get(s, {}).get('type') == 'attack']
        
        if attack_skills:
            best = max(attack_skills, key=lambda s: skill_map.get(s, {}).get('damageMultiplier', 1.0))
            return best
        
        return available_skills[0]
