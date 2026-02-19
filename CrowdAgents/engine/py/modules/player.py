"""
玩家模块
管理玩家属性、技能、装备
"""

from typing import Dict, List, Optional, Any
from modules.base import GameModule, Action, ActionResult, ActionType, GameContext


class PlayerModule(GameModule):
    def __init__(self, config: Dict[str, Any]):
        self._config = config
        self._init_state()

    @property
    def module_id(self) -> str:
        return 'player'

    @property
    def dependencies(self) -> List[str]:
        return []

    def _init_state(self):
        initial = self._config.get('initial', {})
        self.hp = initial.get('hp', 100)
        self.max_hp = initial.get('maxHP', 100)
        self.mp = initial.get('mp', 50)
        self.max_mp = initial.get('maxMP', 50)
        self.level = initial.get('level', 1)
        self.exp = initial.get('exp', 0)
        self.max_exp = initial.get('maxEXP', 100)
        self.atk = initial.get('atk', 10)
        self.defense = initial.get('def', 5)
        self.gold = initial.get('gold', 0)
        self.crit_rate = initial.get('critRate', 0.1)
        self.dodge_rate = initial.get('dodgeRate', 0.05)
        
        self.weapon: Optional[str] = None
        self.armor: Optional[str] = None
        self.learned_skills: List[str] = ['powerStrike']
        self.equipped_skills: List[str] = ['powerStrike']
        self.skill_cooldowns: Dict[str, int] = {}

    def get_state(self) -> Dict[str, Any]:
        return {
            'hp': self.hp,
            'max_hp': self.max_hp,
            'mp': self.mp,
            'max_mp': self.max_mp,
            'level': self.level,
            'exp': self.exp,
            'max_exp': self.max_exp,
            'atk': self.atk,
            'defense': self.defense,
            'gold': self.gold,
            'crit_rate': self.crit_rate,
            'dodge_rate': self.dodge_rate,
            'weapon': self.weapon,
            'armor': self.armor,
            'learned_skills': self.learned_skills,
            'equipped_skills': self.equipped_skills,
            'skill_cooldowns': dict(self.skill_cooldowns),
        }

    def set_state(self, state: Dict[str, Any]) -> None:
        self.hp = state.get('hp', self.hp)
        self.max_hp = state.get('max_hp', self.max_hp)
        self.mp = state.get('mp', self.mp)
        self.max_mp = state.get('max_mp', self.max_mp)
        self.level = state.get('level', self.level)
        self.exp = state.get('exp', self.exp)
        self.max_exp = state.get('max_exp', self.max_exp)
        self.atk = state.get('atk', self.atk)
        self.defense = state.get('defense', state.get('def', self.defense))
        self.gold = state.get('gold', self.gold)
        self.crit_rate = state.get('crit_rate', self.crit_rate)
        self.dodge_rate = state.get('dodge_rate', self.dodge_rate)
        self.weapon = state.get('weapon')
        self.armor = state.get('armor')
        self.learned_skills = state.get('learned_skills', self.learned_skills)
        self.equipped_skills = state.get('equipped_skills', self.equipped_skills)
        self.skill_cooldowns = state.get('skill_cooldowns', {})

    def process_action(self, action: Action, context: GameContext) -> ActionResult:
        return ActionResult(
            success=False,
            action_type=action.type,
            message="PlayerModule does not process actions directly"
        )

    def on_tick(self, tick: int, context: GameContext) -> None:
        pass

    def reset(self) -> None:
        self._init_state()

    def add_exp(self, amount: int) -> bool:
        self.exp += amount
        leveled_up = False
        
        while self.exp >= self.max_exp:
            self.exp -= self.max_exp
            self.level_up()
            leveled_up = True
        
        return leveled_up

    def level_up(self) -> Dict[str, int]:
        level_up_config = self._config.get('levelUp', {})
        hp_gain = level_up_config.get('hp', 10)
        atk_gain = level_up_config.get('atk', 2)
        def_gain = level_up_config.get('def', 1)
        exp_multiplier = level_up_config.get('expMultiplier', 1.5)
        
        self.level += 1
        self.max_hp += hp_gain
        self.hp = min(self.hp + hp_gain, self.max_hp)
        self.atk += atk_gain
        self.defense += def_gain
        self.max_exp = int(self.max_exp * exp_multiplier)
        
        return {
            'hp': hp_gain,
            'atk': atk_gain,
            'defense': def_gain,
        }

    def take_damage(self, damage: int) -> int:
        self.hp = max(0, self.hp - damage)
        return self.hp

    def heal(self, amount: int) -> int:
        self.hp = min(self.max_hp, self.hp + amount)
        return self.hp

    def add_gold(self, amount: int) -> int:
        self.gold += amount
        return self.gold

    def reduce_cooldowns(self) -> None:
        for skill_id in list(self.skill_cooldowns.keys()):
            if self.skill_cooldowns[skill_id] > 0:
                self.skill_cooldowns[skill_id] -= 1

    def get_total_atk(self, equipment_config: Dict[str, Any] = None) -> int:
        total = self.atk
        if self.weapon and equipment_config:
            weapons = equipment_config.get('weapons', [])
            for w in weapons:
                if w['id'] == self.weapon:
                    total += w.get('atk', 0)
                    break
        return total

    def get_total_def(self, equipment_config: Dict[str, Any] = None) -> int:
        total = self.defense
        if self.armor and equipment_config:
            armors = equipment_config.get('armors', [])
            for a in armors:
                if a['id'] == self.armor:
                    total += a.get('def', 0)
                    break
        return total
