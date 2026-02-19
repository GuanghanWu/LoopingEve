"""
战斗模块
管理战斗逻辑、伤害计算
"""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from modules.base import GameModule, Action, ActionResult, ActionType, GameContext


@dataclass
class Monster:
    id: str
    name: str
    hp: int
    max_hp: int
    atk: int
    defense: int
    crit_rate: float
    dodge_rate: float
    exp: int
    gold: int
    is_boss: bool = False


class CombatModule(GameModule):
    def __init__(self, config: Dict[str, Any], monsters: List[Dict[str, Any]], 
                 skills: List[Dict[str, Any]], battle_config: Dict[str, Any]):
        self._config = config
        self._monsters = monsters
        self._skills = {s['id']: s for s in skills}
        self._battle_config = battle_config
        
        self.current_monster: Optional[Monster] = None
        self.slow_effect: float = 0
        self.battle_turns: int = 0
        self._events: List[str] = []

    @property
    def module_id(self) -> str:
        return 'combat'

    @property
    def dependencies(self) -> List[str]:
        return ['player', 'world']

    def get_state(self) -> Dict[str, Any]:
        return {
            'current_monster': self._monster_to_dict(self.current_monster) if self.current_monster else None,
            'slow_effect': self.slow_effect,
            'battle_turns': self.battle_turns,
        }

    def set_state(self, state: Dict[str, Any]) -> None:
        monster_data = state.get('current_monster')
        if monster_data:
            self.current_monster = Monster(
                id=monster_data['id'],
                name=monster_data['name'],
                hp=monster_data['hp'],
                max_hp=monster_data['max_hp'],
                atk=monster_data['atk'],
                defense=monster_data.get('defense', monster_data.get('def', 0)),
                crit_rate=monster_data.get('crit_rate', 0.1),
                dodge_rate=monster_data.get('dodge_rate', 0.05),
                exp=monster_data.get('exp', 0),
                gold=monster_data.get('gold', 0),
                is_boss=monster_data.get('is_boss', False),
            )
        else:
            self.current_monster = None
        self.slow_effect = state.get('slow_effect', 0)
        self.battle_turns = state.get('battle_turns', 0)

    def _monster_to_dict(self, monster: Monster) -> Dict[str, Any]:
        return {
            'id': monster.id,
            'name': monster.name,
            'hp': monster.hp,
            'max_hp': monster.max_hp,
            'atk': monster.atk,
            'defense': monster.defense,
            'crit_rate': monster.crit_rate,
            'dodge_rate': monster.dodge_rate,
            'exp': monster.exp,
            'gold': monster.gold,
            'is_boss': monster.is_boss,
        }

    def process_action(self, action: Action, context: GameContext) -> ActionResult:
        if action.type == ActionType.ATTACK:
            return self._process_attack(context)
        elif action.type == ActionType.DEFEND:
            return self._process_defend(context)
        elif action.type == ActionType.USE_SKILL:
            return self._process_skill(action.params.get('skill_id'), context)
        
        return ActionResult(success=False, action_type=action.type, message="Unknown action")

    def _process_attack(self, context: GameContext) -> ActionResult:
        player_module = context.get_module('player')
        if not player_module or not self.current_monster:
            return ActionResult(success=False, action_type=ActionType.ATTACK, message="No monster")
        
        self.battle_turns += 1
        rng = context.engine.rng if context.engine else None
        
        damage = self._calc_damage(
            player_module.get_total_atk(context.engine.config.equipment if context.engine else None),
            self.current_monster.defense,
            self._battle_config.get('normalAttackRand', 5),
            rng
        )
        
        if rng and rng.random() < self.current_monster.dodge_rate:
            return ActionResult(
                success=True,
                action_type=ActionType.ATTACK,
                data={'dodged': True, 'damage': 0},
                events=['monster_dodged']
            )
        
        is_critical = rng.random() < player_module.crit_rate if rng else False
        if is_critical:
            damage = int(damage * 1.5)
        
        self.current_monster.hp -= damage
        
        events = ['player_attack', 'monster_damage']
        if is_critical:
            events.append('critical_hit')
        
        result_data = {
            'damage': damage,
            'is_critical': is_critical,
            'monster_hp': max(0, self.current_monster.hp),
            'monster_max_hp': self.current_monster.max_hp,
        }
        
        if self.current_monster.hp <= 0:
            events.append('monster_killed')
            events.append('battle_end')
            result_data['victory'] = True
            result_data['rewards'] = self._get_rewards(context)
            self._apply_rewards(result_data['rewards'], context)
            self.current_monster = None
        else:
            enemy_result = self._enemy_attack(context)
            result_data['enemy_attack'] = enemy_result
            if enemy_result.get('player_died'):
                events.append('player_death')
        
        return ActionResult(success=True, action_type=ActionType.ATTACK, data=result_data, events=events)

    def _process_defend(self, context: GameContext) -> ActionResult:
        if not self.current_monster:
            return ActionResult(success=False, action_type=ActionType.DEFEND, message="No monster")
        
        self.battle_turns += 1
        enemy_result = self._enemy_attack(context)
        
        return ActionResult(
            success=True,
            action_type=ActionType.DEFEND,
            data={'enemy_attack': enemy_result},
            events=['defend', 'enemy_attack']
        )

    def _process_skill(self, skill_id: str, context: GameContext) -> ActionResult:
        player_module = context.get_module('player')
        if not player_module or not self.current_monster:
            return ActionResult(success=False, action_type=ActionType.USE_SKILL, message="No monster")
        
        skill = self._skills.get(skill_id)
        if not skill:
            return ActionResult(success=False, action_type=ActionType.USE_SKILL, message="Unknown skill")
        
        if player_module.skill_cooldowns.get(skill_id, 0) > 0:
            return ActionResult(success=False, action_type=ActionType.USE_SKILL, message="Skill on cooldown")
        
        player_module.skill_cooldowns[skill_id] = skill.get('cd', 0)
        self.battle_turns += 1
        rng = context.engine.rng if context.engine else None
        
        events = ['skill_use']
        result_data = {'skill_id': skill_id, 'skill_name': skill.get('name', skill_id)}
        
        if skill.get('type') == 'attack':
            damage = self._calc_damage(
                player_module.get_total_atk(context.engine.config.equipment if context.engine else None) * skill.get('damageMultiplier', 1.0),
                self.current_monster.defense,
                skill.get('damageRand', 5),
                rng
            )
            
            is_critical = rng.random() < player_module.crit_rate if rng else False
            if is_critical:
                damage = int(damage * 1.5)
            
            self.current_monster.hp -= damage
            result_data['damage'] = damage
            result_data['is_critical'] = is_critical
            
            if skill.get('slow'):
                self.slow_effect = skill['slow']
            
            if skill.get('lifesteal'):
                heal = int(damage * skill['lifesteal'])
                player_module.heal(heal)
                result_data['lifesteal'] = heal
            
            if self.current_monster.hp <= 0:
                events.append('monster_killed')
                events.append('battle_end')
                result_data['victory'] = True
                result_data['rewards'] = self._get_rewards(context)
                self._apply_rewards(result_data['rewards'], context)
                self.current_monster = None
            else:
                enemy_result = self._enemy_attack(context)
                result_data['enemy_attack'] = enemy_result
        
        elif skill.get('type') == 'heal':
            heal_amount = int(player_module.max_hp * skill.get('healPercent', 0.2))
            player_module.heal(heal_amount)
            result_data['heal'] = heal_amount
            enemy_result = self._enemy_attack(context)
            result_data['enemy_attack'] = enemy_result
        
        return ActionResult(success=True, action_type=ActionType.USE_SKILL, data=result_data, events=events)

    def _enemy_attack(self, context: GameContext) -> Dict[str, Any]:
        player_module = context.get_module('player')
        if not self.current_monster or not player_module:
            return {'damage': 0}
        
        rng = context.engine.rng if context.engine else None
        
        atk = self.current_monster.atk
        if self.slow_effect > 0:
            atk = int(atk * (1 - self.slow_effect))
            self.slow_effect = max(0, self.slow_effect - 0.1)
        
        player_dodge_rate = player_module.dodge_rate
        if rng and rng.random() < player_dodge_rate:
            return {'damage': 0, 'dodged': True}
        
        is_critical = rng.random() < self.current_monster.crit_rate if rng else False
        
        damage = self._calc_damage(
            atk,
            player_module.get_total_def(context.engine.config.equipment if context.engine else None),
            self._battle_config.get('enemyAttackRand', 3),
            rng
        )
        
        if is_critical:
            damage = int(damage * 1.5)
        
        player_module.take_damage(damage)
        
        result = {
            'damage': damage,
            'is_critical': is_critical,
            'player_hp': player_module.hp,
            'player_max_hp': player_module.max_hp,
        }
        
        if player_module.hp <= 0:
            result['player_died'] = True
        
        return result

    def _calc_damage(self, atk: int, defense: int, rand: int, rng) -> int:
        import random
        random_func = rng.random if rng else random.random
        return max(1, int(atk - defense + random_func() * rand))

    def _get_rewards(self, context: GameContext) -> Dict[str, Any]:
        if not self.current_monster:
            return {}
        
        return {
            'exp': self.current_monster.exp,
            'gold': self.current_monster.gold,
            'monster_id': self.current_monster.id,
        }

    def _apply_rewards(self, rewards: Dict[str, Any], context: GameContext) -> None:
        player_module = context.get_module('player')
        if not player_module:
            return
        
        if rewards.get('exp'):
            player_module.add_exp(rewards['exp'])
        if rewards.get('gold'):
            player_module.add_gold(rewards['gold'])

    def on_tick(self, tick: int, context: GameContext) -> None:
        pass

    def reset(self) -> None:
        self.current_monster = None
        self.slow_effect = 0
        self.battle_turns = 0
        self._events.clear()

    def get_events(self) -> List[str]:
        events = self._events.copy()
        self._events.clear()
        return events
