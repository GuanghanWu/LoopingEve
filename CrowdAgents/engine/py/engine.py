"""
模块化游戏引擎
整合所有游戏模块，提供统一的状态接口
"""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass
import time

from state import GameState, PlayerState, MonsterState, InventoryState, WorldState, CharacterState, UIState
from modules.base import ModularGameEngine, Action, ActionResult, ActionType
from modules.player import PlayerModule
from modules.combat import CombatModule
from modules.world import WorldModule
from modules.inventory import InventoryModule
from config import GameConfig


class GameEngine:
    def __init__(self, config: GameConfig, seed: int = None):
        self.config = config
        self._engine = ModularGameEngine(config, seed)
        self._tick = 0
        
        self._player_module = PlayerModule(config.player)
        self._combat_module = CombatModule(
            config.player,
            config.monsters,
            config.skills,
            config.battle
        )
        self._world_module = WorldModule(
            config.player,
            config.monsters,
            config.floor
        )
        self._inventory_module = InventoryModule(
            config.inventory,
            config.items,
            config.equipment,
            config.loot_table
        )
        
        self._engine.register_module(self._player_module)
        self._engine.register_module(self._combat_module)
        self._engine.register_module(self._world_module)
        self._engine.register_module(self._inventory_module)
        
        self._last_events: List[str] = []
        self._last_action_result: Optional[ActionResult] = None
        
        self._character = CharacterState()
        self._ui = UIState(scene_enter_time=time.time(), last_action_time=time.time())

    def get_state(self) -> GameState:
        player_state = self._player_module.get_state()
        monster_data = self._combat_module.get_state().get('current_monster')
        inventory_state = self._inventory_module.get_state()
        world_state = self._world_module.get_state()
        
        monster_state = None
        if monster_data:
            monster_state = MonsterState(
                id=monster_data['id'],
                name=monster_data['name'],
                hp=monster_data['hp'],
                max_hp=monster_data['max_hp'],
                atk=monster_data['atk'],
                defense=monster_data.get('defense', 0),
                crit_rate=monster_data.get('crit_rate', 0.1),
                dodge_rate=monster_data.get('dodge_rate', 0.05),
                is_boss=monster_data.get('is_boss', False),
            )
        
        return GameState(
            tick=self._tick,
            timestamp=time.time(),
            player=PlayerState(
                hp=player_state['hp'],
                max_hp=player_state['max_hp'],
                mp=player_state['mp'],
                max_mp=player_state['max_mp'],
                level=player_state['level'],
                exp=player_state['exp'],
                max_exp=player_state['max_exp'],
                atk=player_state['atk'],
                defense=player_state['defense'],
                gold=player_state['gold'],
                crit_rate=player_state['crit_rate'],
                dodge_rate=player_state['dodge_rate'],
                weapon=player_state['weapon'],
                armor=player_state['armor'],
                learned_skills=player_state['learned_skills'],
                equipped_skills=player_state['equipped_skills'],
                skill_cooldowns=player_state['skill_cooldowns'],
            ),
            monster=monster_state,
            inventory=InventoryState(
                slots=inventory_state['slots'],
                items=inventory_state['items'],
            ),
            world=WorldState(
                floor=world_state['floor'],
                killed_on_floor=world_state['killed_on_floor'],
                monsters_to_advance=world_state['monsters_to_advance'],
                can_advance=world_state['can_advance'],
                in_battle=world_state['in_battle'],
            ),
            character=self._character,
            ui=self._ui,
        )

    def execute(self, action: Action) -> ActionResult:
        self._last_events.clear()
        self._update_ui_before_action(action)
        
        if action.type == ActionType.EXPLORE:
            result = self._engine.process_action(action)
            if result.success:
                self._last_events.extend(result.events)
        
        elif action.type == ActionType.ATTACK:
            result = self._engine.process_action(action)
            if result.success:
                self._last_events.extend(result.events)
                self._handle_battle_result(result)
        
        elif action.type == ActionType.USE_SKILL:
            result = self._engine.process_action(action)
            if result.success:
                self._last_events.extend(result.events)
                self._handle_battle_result(result)
        
        elif action.type == ActionType.USE_ITEM:
            result = self._engine.process_action(action)
            if result.success:
                self._last_events.extend(result.events)
        
        elif action.type == ActionType.NEXT_FLOOR:
            result = self._engine.process_action(action)
            if result.success:
                self._last_events.extend(result.events)
        
        elif action.type == ActionType.FORGE:
            result = self._engine.process_action(action)
            if result.success:
                self._last_events.extend(result.events)
        
        elif action.type == ActionType.DEFEND:
            result = self._engine.process_action(action)
            if result.success:
                self._last_events.extend(result.events)
        
        else:
            result = ActionResult(
                success=False,
                action_type=action.type,
                message=f"Unknown action type: {action.type}"
            )
        
        self._last_action_result = result
        self._tick += 1
        
        self._player_module.reduce_cooldowns()
        
        self._update_ui_after_action(action, result)
        self._update_character_state(result)
        
        return result

    def _handle_battle_result(self, result: ActionResult) -> None:
        if 'battle_end' in result.events or 'monster_killed' in result.events:
            self._world_module.on_battle_end(
                victory=result.data.get('victory', False),
                context=self._engine._context
            )
            
            if result.data.get('rewards'):
                rewards = result.data['rewards']
                if rewards.get('monster_id'):
                    loot = self._inventory_module.grant_loot(
                        rewards['monster_id'],
                        self._engine.rng
                    )
                    if loot:
                        result.data['loot'] = loot
                        self._last_events.append('item_obtain')
        
        if result.data.get('enemy_attack', {}).get('player_died'):
            self._world_module.on_player_death(self._engine._context)
            self._last_events.append('player_death')

    def get_events(self) -> List[str]:
        events = self._last_events.copy()
        self._last_events.clear()
        return events

    def get_last_result(self) -> Optional[ActionResult]:
        return self._last_action_result

    def tick(self) -> None:
        self._tick += 1
        self._engine.tick()

    def reset(self) -> None:
        self._tick = 0
        self._engine.reset()
        self._last_events.clear()
        self._last_action_result = None

    @property
    def rng(self):
        return self._engine.rng

    def is_in_battle(self) -> bool:
        return self._world_module.in_battle

    def can_advance_floor(self) -> bool:
        return self._world_module.can_advance

    def get_floor(self) -> int:
        return self._world_module.floor

    def get_player_hp_ratio(self) -> float:
        return self._player_module.hp / self._player_module.max_hp if self._player_module.max_hp > 0 else 0

    def has_healing_item(self) -> bool:
        return self._inventory_module.has_healing_item()

    def get_available_skills(self) -> List[str]:
        return [
            skill_id for skill_id in self._player_module.equipped_skills
            if self._player_module.skill_cooldowns.get(skill_id, 0) == 0
        ]

    def _update_ui_before_action(self, action: Action) -> None:
        self._ui.last_action_time = time.time()

    def _update_ui_after_action(self, action: Action, result: ActionResult) -> None:
        world_state = self._world_module.get_state()
        new_scene = self._ui.current_scene
        
        if world_state['in_battle'] and self._ui.current_scene != 'battle':
            new_scene = 'battle'
        elif not world_state['in_battle'] and self._ui.current_scene == 'battle':
            new_scene = 'explore'
        
        if action.type == ActionType.FORGE:
            new_scene = 'forge'
        elif action.type == ActionType.NEXT_FLOOR:
            new_scene = 'explore'
        
        if new_scene != self._ui.current_scene:
            self._ui.current_scene = new_scene
            self._ui.scene_enter_time = time.time()
        
        if 'player_death' in self._last_events:
            self._ui.current_scene = 'death'
            self._ui.active_dialog = 'death_screen'
        
        if result.data.get('level_up'):
            self._ui.notifications.append({
                'type': 'level_up',
                'level': self._player_module.level,
                'time': time.time()
            })

    def _update_character_state(self, result: ActionResult) -> None:
        self._character.playtime_ms += 100
        
        if 'battle_start' in self._last_events:
            self._character.total_battles += 1
        
        if 'monster_killed' in self._last_events:
            self._character.total_kills += 1
        
        if 'player_death' in self._last_events:
            self._character.deaths += 1
        
        current_floor = self._world_module.floor
        if current_floor > self._character.highest_floor:
            self._character.highest_floor = current_floor
