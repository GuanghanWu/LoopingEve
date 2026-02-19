"""
事件推断引擎
根据状态变化和配置规则推断游戏事件
"""

from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from pathlib import Path
import logging

import orjson

from state import GameState, StateDiff
from expression import ExpressionEvaluator, EvaluationContext


@dataclass
class EventRule:
    event_id: str
    condition: str
    description: str
    priority: int
    category: str
    data_extract: List[str] = field(default_factory=list)


@dataclass
class InferredEvent:
    event_id: str
    description: str
    category: str
    priority: int
    data: Dict[str, Any] = field(default_factory=dict)


class EventRuleLoader:
    """事件规则加载器"""
    
    def __init__(self, config_dir: str = None):
        if config_dir:
            self.config_dir = Path(config_dir)
        else:
            self.config_dir = Path(__file__).parent.parent.parent / "config"
        
        self._rules: Dict[str, List[EventRule]] = {}
        self._computed_value_defs: Dict[str, str] = {}
    
    def load(self, path: str = None) -> Dict[str, List[EventRule]]:
        if path:
            config_path = Path(path)
        else:
            config_path = self.config_dir / "event_rules.json"
        
        if not config_path.exists():
            logging.warning(f"Event rules file not found: {config_path}")
            return {}
        
        data = orjson.loads(config_path.read_bytes())
        
        self._rules = {}
        state_events = data.get('state_change_events', {})
        
        for category, events in state_events.items():
            if category.startswith('_'):
                continue
            
            self._rules[category] = []
            for event_id, event_def in events.items():
                if event_id.startswith('_'):
                    continue
                
                rule = EventRule(
                    event_id=event_id,
                    condition=event_def.get('condition', ''),
                    description=event_def.get('description', ''),
                    priority=event_def.get('priority', 10),
                    category=category,
                    data_extract=event_def.get('data_extract', []),
                )
                self._rules[category].append(rule)
        
        computed_values = data.get('computed_values', {})
        for name, defn in computed_values.items():
            if isinstance(defn, dict):
                self._computed_value_defs[name] = defn.get('expression', '')
            else:
                self._computed_value_defs[name] = defn
        
        return self._rules
    
    def get_rules(self) -> Dict[str, List[EventRule]]:
        if not self._rules:
            self.load()
        return self._rules
    
    def get_all_rules(self) -> List[EventRule]:
        rules = []
        for category_rules in self.get_rules().values():
            rules.extend(category_rules)
        return sorted(rules, key=lambda r: r.priority)
    
    def get_computed_value_defs(self) -> Dict[str, str]:
        return self._computed_value_defs


class EventInferenceEngine:
    """事件推断引擎"""
    
    def __init__(self, rules_path: str = None):
        self.loader = EventRuleLoader()
        if rules_path:
            self.loader.load(rules_path)
        else:
            self.loader.load()
        
        self.evaluator = ExpressionEvaluator()
        self._computed_cache: Dict[str, Any] = {}
    
    def infer(self, prev: GameState, curr: GameState, 
              action_result: Dict[str, Any] = None) -> Tuple[List[InferredEvent], Dict[str, Any]]:
        """
        推断状态变化事件
        
        Args:
            prev: 前一状态
            curr: 当前状态
            action_result: 动作执行结果
            
        Returns:
            (推断的事件列表, 提取的数据)
        """
        computed = self._compute_values(prev, curr)
        
        context = EvaluationContext(
            prev=prev,
            curr=curr,
            computed=computed,
            events=[],
            action_result=action_result,
        )
        
        events = []
        extracted_data: Dict[str, Any] = {}
        
        rules = self.loader.get_all_rules()
        
        for rule in rules:
            try:
                if self.evaluator.evaluate(rule.condition, context):
                    event = InferredEvent(
                        event_id=rule.event_id,
                        description=rule.description,
                        category=rule.category,
                        priority=rule.priority,
                    )
                    
                    if rule.data_extract:
                        event.data = self._extract_data(rule.data_extract, context)
                        extracted_data[rule.event_id] = event.data
                    
                    events.append(event)
                    context.events.append(rule.event_id)
                    
            except Exception as e:
                logging.debug(f"Error evaluating rule {rule.event_id}: {e}")
        
        events.sort(key=lambda e: e.priority)
        
        return events, extracted_data
    
    def _compute_values(self, prev: GameState, curr: GameState) -> Dict[str, Any]:
        """计算派生值"""
        computed = {}
        
        computed['hp_delta'] = curr.player.hp - prev.player.hp
        computed['mp_delta'] = curr.player.mp - prev.player.mp
        computed['gold_delta'] = curr.player.gold - prev.player.gold
        computed['exp_delta'] = curr.player.exp - prev.player.exp
        
        if curr.player.max_hp > 0:
            computed['hp_ratio'] = curr.player.hp / curr.player.max_hp
        else:
            computed['hp_ratio'] = 0
        
        if curr.player.max_mp > 0:
            computed['mp_ratio'] = curr.player.mp / curr.player.max_mp
        else:
            computed['mp_ratio'] = 0
        
        prev_items = {item['id']: item.get('count', 1) for item in prev.inventory.items}
        curr_items = {item['id']: item.get('count', 1) for item in curr.inventory.items}
        
        obtained = []
        used = []
        for item_id, count in curr_items.items():
            if item_id not in prev_items:
                obtained.append(item_id)
            elif count > prev_items.get(item_id, 0):
                obtained.append(item_id)
        
        for item_id, count in prev_items.items():
            if item_id not in curr_items:
                used.append(item_id)
            elif count > curr_items.get(item_id, 0):
                used.append(item_id)
        
        computed['item_obtained'] = obtained
        computed['item_used'] = used
        computed['item_count_delta'] = len(curr_items) - len(prev_items)
        
        computed['floor_changed'] = curr.world.floor != prev.world.floor
        computed['battle_started'] = curr.world.in_battle and not prev.world.in_battle
        computed['battle_ended'] = not curr.world.in_battle and prev.world.in_battle
        computed['level_up'] = curr.player.level > prev.player.level
        computed['player_died'] = curr.player.hp <= 0 and prev.player.hp > 0
        
        computed['monster_killed'] = None
        if prev.monster and not curr.monster and computed['battle_ended']:
            computed['monster_killed'] = prev.monster.id
        
        computed['scene_changed'] = curr.ui.current_scene != prev.ui.current_scene
        computed['scene_from'] = prev.ui.current_scene if computed['scene_changed'] else None
        computed['scene_to'] = curr.ui.current_scene if computed['scene_changed'] else None
        
        computed['dialog_opened'] = curr.ui.active_dialog and not prev.ui.active_dialog
        computed['dialog_closed'] = prev.ui.active_dialog and not curr.ui.active_dialog
        
        computed['tutorial_advanced'] = (
            curr.ui.tutorial_step is not None and 
            prev.ui.tutorial_step is not None and
            curr.ui.tutorial_step > prev.ui.tutorial_step
        )
        
        new_achievements = [a for a in curr.character.achievements if a not in prev.character.achievements]
        computed['achievement_unlocked'] = new_achievements
        
        new_features = [f for f in curr.character.unlocked_features if f not in prev.character.unlocked_features]
        computed['feature_unlocked'] = new_features
        
        computed['story_progress_updated'] = curr.character.story_progress != prev.character.story_progress
        computed['playtime_delta_ms'] = curr.character.playtime_ms - prev.character.playtime_ms
        
        return computed
    
    def _extract_data(self, fields: List[str], context: EvaluationContext) -> Dict[str, Any]:
        """提取事件相关数据"""
        data = {}
        
        for field in fields:
            try:
                value = self.evaluator.evaluate(field, context)
                field_name = field.split('.')[-1].replace('(', '').replace(')', '')
                data[field_name] = value
            except Exception:
                pass
        
        return data
    
    def build_state_diff(self, prev: GameState, curr: GameState,
                         events: List[InferredEvent],
                         computed: Dict[str, Any]) -> StateDiff:
        """构建 StateDiff 对象"""
        event_ids = [e.event_id for e in events]
        
        return StateDiff(
            tick_from=prev.tick,
            tick_to=curr.tick,
            changes=computed,
            events_inferred=event_ids,
            hp_delta=computed.get('hp_delta', 0),
            gold_delta=computed.get('gold_delta', 0),
            exp_delta=computed.get('exp_delta', 0),
            floor_changed=computed.get('floor_changed', False),
            battle_started=computed.get('battle_started', False),
            battle_ended=computed.get('battle_ended', False),
            level_up=computed.get('level_up', False),
            item_obtained=computed.get('item_obtained', []),
            item_used=computed.get('item_used', []),
            monster_killed=computed.get('monster_killed'),
            player_died=computed.get('player_died', False),
            scene_changed=computed.get('scene_changed', False),
            scene_from=computed.get('scene_from'),
            scene_to=computed.get('scene_to'),
            dialog_opened=computed.get('dialog_opened', False),
            dialog_closed=computed.get('dialog_closed', False),
            tutorial_advanced=computed.get('tutorial_advanced', False),
            achievement_unlocked=computed.get('achievement_unlocked', []),
            feature_unlocked=computed.get('feature_unlocked', []),
            story_progress_updated=computed.get('story_progress_updated', False),
            playtime_delta_ms=computed.get('playtime_delta_ms', 0),
        )
