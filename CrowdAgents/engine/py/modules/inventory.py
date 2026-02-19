"""
背包模块
管理物品、锻造、消耗品使用
"""

from typing import Dict, List, Optional, Any
from modules.base import GameModule, Action, ActionResult, ActionType, GameContext


class InventoryModule(GameModule):
    def __init__(self, config: Dict[str, Any], items_config: Dict[str, Any], 
                 equipment_config: Dict[str, Any], loot_table: Dict[str, List[Dict[str, Any]]]):
        self._config = config
        self._items_config = items_config
        self._equipment_config = equipment_config
        self._loot_table = loot_table
        
        self.slots: int = config.get('initialSlots', 20)
        self.items: List[Dict[str, Any]] = []

    @property
    def module_id(self) -> str:
        return 'inventory'

    @property
    def dependencies(self) -> List[str]:
        return ['player']

    def get_state(self) -> Dict[str, Any]:
        return {
            'slots': self.slots,
            'items': list(self.items),
        }

    def set_state(self, state: Dict[str, Any]) -> None:
        self.slots = state.get('slots', self.slots)
        self.items = state.get('items', [])

    def process_action(self, action: Action, context: GameContext) -> ActionResult:
        if action.type == ActionType.USE_ITEM:
            return self._process_use_item(action.params.get('item_id'), context)
        elif action.type == ActionType.FORGE:
            return self._process_forge(
                action.params.get('category'),
                action.params.get('item_id'),
                context
            )
        
        return ActionResult(success=False, action_type=action.type, message="Unknown action")

    def _process_use_item(self, item_id: str, context: GameContext) -> ActionResult:
        player_module = context.get_module('player')
        if not player_module:
            return ActionResult(success=False, action_type=ActionType.USE_ITEM, message="No player module")
        
        item = self._find_item(item_id)
        if not item:
            return ActionResult(success=False, action_type=ActionType.USE_ITEM, message="Item not found")
        
        consumables = self._items_config.get('consumables', [])
        item_def = next((c for c in consumables if c['id'] == item_id), None)
        
        if not item_def or not item_def.get('heal'):
            return ActionResult(success=False, action_type=ActionType.USE_ITEM, message="Item not consumable")
        
        heal_amount = min(item_def['heal'], player_module.max_hp - player_module.hp)
        player_module.heal(heal_amount)
        
        self._remove_item(item_id, 1)
        
        return ActionResult(
            success=True,
            action_type=ActionType.USE_ITEM,
            data={
                'item_id': item_id,
                'item_name': item_def.get('name', item_id),
                'heal': heal_amount,
            },
            events=['item_use']
        )

    def _process_forge(self, category: str, item_id: str, context: GameContext) -> ActionResult:
        player_module = context.get_module('player')
        if not player_module:
            return ActionResult(success=False, action_type=ActionType.FORGE, message="No player module")
        
        equipment_list = self._equipment_config.get(category, [])
        item_def = next((e for e in equipment_list if e['id'] == item_id), None)
        
        if not item_def:
            return ActionResult(success=False, action_type=ActionType.FORGE, message="Equipment not found")
        
        if not self._can_forge(item_def):
            return ActionResult(success=False, action_type=ActionType.FORGE, message="Not enough materials")
        
        for mat_id, count in item_def.get('materials', {}).items():
            self._remove_item(mat_id, count)
        
        if category == 'weapons':
            player_module.weapon = item_id
        else:
            player_module.armor = item_id
        
        return ActionResult(
            success=True,
            action_type=ActionType.FORGE,
            data={
                'item_id': item_id,
                'item_name': item_def.get('name', item_id),
                'category': category,
            },
            events=['forge_success']
        )

    def add_item(self, item_id: str, count: int = 1) -> bool:
        all_items = (
            self._items_config.get('consumables', []) +
            self._items_config.get('materials', []) +
            self._items_config.get('scrolls', [])
        )
        item_def = next((i for i in all_items if i['id'] == item_id), None)
        
        if not item_def:
            return False
        
        stack_max = item_def.get('stackMax', 99)
        
        existing = next((i for i in self.items if i['id'] == item_id), None)
        if existing:
            existing['count'] = min(existing['count'] + count, stack_max)
        else:
            if len(self.items) < self.slots:
                self.items.append({'id': item_id, 'count': min(count, stack_max)})
            else:
                return False
        
        return True

    def remove_item(self, item_id: str, count: int = 1) -> bool:
        return self._remove_item(item_id, count)

    def _remove_item(self, item_id: str, count: int = 1) -> bool:
        item = self._find_item(item_id)
        if not item:
            return False
        
        item['count'] -= count
        if item['count'] <= 0:
            self.items.remove(item)
        
        return True

    def get_item_count(self, item_id: str) -> int:
        item = self._find_item(item_id)
        return item['count'] if item else 0

    def _find_item(self, item_id: str) -> Optional[Dict[str, Any]]:
        return next((i for i in self.items if i['id'] == item_id), None)

    def _can_forge(self, item_def: Dict[str, Any]) -> bool:
        materials = item_def.get('materials', {})
        for mat_id, count in materials.items():
            if self.get_item_count(mat_id) < count:
                return False
        return True

    def grant_loot(self, monster_id: str, rng=None) -> List[Dict[str, Any]]:
        import random
        
        loot_table = self._loot_table.get(monster_id, [])
        obtained = []
        
        for loot in loot_table:
            random_func = rng.random if rng else random.random
            if random_func() < loot.get('rate', 0):
                count = random.randint(
                    loot.get('minCount', 1),
                    loot.get('maxCount', 1)
                ) if not rng else rng.randint(loot.get('minCount', 1), loot.get('maxCount', 1))
                
                if self.add_item(loot['itemId'], count):
                    all_items = (
                        self._items_config.get('consumables', []) +
                        self._items_config.get('materials', []) +
                        self._items_config.get('scrolls', [])
                    )
                    item_def = next((i for i in all_items if i['id'] == loot['itemId']), None)
                    
                    rarity = 'common'
                    if loot.get('rate', 1) < 0.1:
                        rarity = 'legendary'
                    elif loot.get('rate', 1) < 0.2:
                        rarity = 'rare'
                    
                    obtained.append({
                        'id': loot['itemId'],
                        'name': item_def.get('name', loot['itemId']) if item_def else loot['itemId'],
                        'count': count,
                        'rarity': rarity,
                    })
        
        return obtained

    def has_healing_item(self) -> bool:
        consumables = self._items_config.get('consumables', [])
        healing_items = {c['id'] for c in consumables if c.get('heal')}
        return any(item['id'] in healing_items for item in self.items)

    def get_healing_item(self) -> Optional[str]:
        consumables = self._items_config.get('consumables', [])
        healing_items = {c['id'] for c in consumables if c.get('heal')}
        
        for item in self.items:
            if item['id'] in healing_items:
                return item['id']
        return None

    def on_tick(self, tick: int, context: GameContext) -> None:
        pass

    def reset(self) -> None:
        self.slots = self._config.get('initialSlots', 20)
        self.items.clear()
