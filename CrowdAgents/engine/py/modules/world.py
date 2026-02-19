"""
世界模块
管理楼层、探索、进度
"""

from typing import Dict, List, Optional, Any
from modules.base import GameModule, Action, ActionResult, ActionType, GameContext
from modules.combat import Monster


class WorldModule(GameModule):
    def __init__(self, config: Dict[str, Any], monsters: List[Dict[str, Any]], 
                 floor_config: Dict[str, Any]):
        self._config = config
        self._monsters = monsters
        self._floor_config = floor_config
        
        self.floor: int = 1
        self.killed_on_floor: int = 0
        self.in_battle: bool = False
        self.can_advance: bool = False
        
        self._seen_lore: set = set()
        self._seen_npcs: set = set()

    @property
    def module_id(self) -> str:
        return 'world'

    @property
    def dependencies(self) -> List[str]:
        return ['player']

    def get_state(self) -> Dict[str, Any]:
        return {
            'floor': self.floor,
            'killed_on_floor': self.killed_on_floor,
            'in_battle': self.in_battle,
            'can_advance': self.can_advance,
            'monsters_to_advance': self.get_monsters_to_advance(),
        }

    def set_state(self, state: Dict[str, Any]) -> None:
        self.floor = state.get('floor', 1)
        self.killed_on_floor = state.get('killed_on_floor', state.get('killed', 0))
        self.in_battle = state.get('in_battle', False)
        self.can_advance = state.get('can_advance', state.get('canAdvanceFloor', False))

    def process_action(self, action: Action, context: GameContext) -> ActionResult:
        if action.type == ActionType.EXPLORE:
            return self._process_explore(context)
        elif action.type == ActionType.NEXT_FLOOR:
            return self._process_next_floor(context)
        
        return ActionResult(success=False, action_type=action.type, message="Unknown action")

    def _process_explore(self, context: GameContext) -> ActionResult:
        if self.in_battle:
            return ActionResult(success=False, action_type=ActionType.EXPLORE, message="Already in battle")
        
        combat_module = context.get_module('combat')
        if not combat_module:
            return ActionResult(success=False, action_type=ActionType.EXPLORE, message="No combat module")
        
        rng = context.engine.rng if context.engine else None
        monster = self._create_monster(rng)
        
        if monster:
            combat_module.current_monster = monster
            combat_module.battle_turns = 0
            combat_module.slow_effect = 0
            self.in_battle = True
            
            return ActionResult(
                success=True,
                action_type=ActionType.EXPLORE,
                data={
                    'monster': combat_module._monster_to_dict(monster) if hasattr(combat_module, '_monster_to_dict') else None,
                    'floor': self.floor,
                },
                events=['battle_start', 'explore']
            )
        
        return ActionResult(success=False, action_type=ActionType.EXPLORE, message="No monsters available")

    def _process_next_floor(self, context: GameContext) -> ActionResult:
        if not self.can_advance:
            return ActionResult(success=False, action_type=ActionType.NEXT_FLOOR, message="Cannot advance")
        
        old_floor = self.floor
        self.floor += 1
        self.killed_on_floor = 0
        self.can_advance = False
        
        events = ['floor_advance']
        data = {
            'old_floor': old_floor,
            'new_floor': self.floor,
        }
        
        return ActionResult(
            success=True,
            action_type=ActionType.NEXT_FLOOR,
            data=data,
            events=events
        )

    def _create_monster(self, rng) -> Optional[Monster]:
        import random
        
        available_monsters = [
            m for m in self._monsters
            if m.get('minFloor', 1) <= self.floor
        ]
        
        if not available_monsters:
            available_monsters = self._monsters[:1] if self._monsters else []
        
        if not available_monsters:
            return None
        
        random_func = rng.choice if rng else random.choice
        monster_def = random_func(available_monsters)
        
        mult = 1 + (self.floor - 1) * self._floor_config.get('difficultyMultiplier', 0.1)
        
        return Monster(
            id=monster_def['id'],
            name=monster_def.get('name', monster_def['id']),
            hp=int(monster_def.get('hp', 50) * mult),
            max_hp=int(monster_def.get('hp', 50) * mult),
            atk=int(monster_def.get('atk', 5) * mult),
            defense=int(monster_def.get('def', 2) * mult),
            crit_rate=monster_def.get('critRate', 0.1),
            dodge_rate=monster_def.get('dodgeRate', 0.05),
            exp=int(monster_def.get('exp', 10) * mult),
            gold=int(monster_def.get('gold', 5) * mult),
            is_boss=monster_def.get('isBoss', False),
        )

    def on_battle_end(self, victory: bool, context: GameContext) -> None:
        if victory:
            self.killed_on_floor += 1
            self.can_advance = self.killed_on_floor >= self.get_monsters_to_advance()
        
        self.in_battle = False

    def on_player_death(self, context: GameContext) -> None:
        self.floor = 1
        self.killed_on_floor = 0
        self.in_battle = False
        self.can_advance = False

    def get_monsters_to_advance(self) -> int:
        base = self._floor_config.get('monstersToAdvance', 3)
        max_monsters = self._floor_config.get('maxMonsters', 10)
        
        if self.floor <= 5:
            return base
        elif self.floor <= 10:
            return min(base + 1, max_monsters)
        elif self.floor <= 20:
            return min(base + 2, max_monsters)
        else:
            return min(base + 3, max_monsters)

    def on_tick(self, tick: int, context: GameContext) -> None:
        pass

    def reset(self) -> None:
        self.floor = 1
        self.killed_on_floor = 0
        self.in_battle = False
        self.can_advance = False
        self._seen_lore.clear()
        self._seen_npcs.clear()
