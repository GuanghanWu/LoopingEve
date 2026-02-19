"""
游戏模块基类
定义模块的标准接口和行动类型
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from enum import Enum


class ActionType(Enum):
    ATTACK = "attack"
    DEFEND = "defend"
    USE_SKILL = "use_skill"
    USE_ITEM = "use_item"
    EXPLORE = "explore"
    NEXT_FLOOR = "next_floor"
    FORGE = "forge"


@dataclass
class Action:
    type: ActionType
    params: Dict[str, Any] = field(default_factory=dict)
    
    def __init__(self, action_type: ActionType, params: Dict[str, Any] = None):
        self.type = action_type
        self.params = params or {}


@dataclass
class ActionResult:
    success: bool
    action_type: ActionType
    data: Dict[str, Any] = field(default_factory=dict)
    events: List[str] = field(default_factory=list)
    message: str = ""


class GameContext:
    def __init__(self, engine: 'ModularGameEngine' = None):
        self.engine = engine
        self._shared_data: Dict[str, Any] = {}
    
    def get_module(self, module_id: str) -> Optional['GameModule']:
        if self.engine:
            return self.engine.get_module(module_id)
        return None
    
    def set_shared(self, key: str, value: Any):
        self._shared_data[key] = value
    
    def get_shared(self, key: str, default: Any = None) -> Any:
        return self._shared_data.get(key, default)
    
    def clear_shared(self):
        self._shared_data.clear()


class GameModule(ABC):
    @property
    @abstractmethod
    def module_id(self) -> str:
        pass
    
    @property
    @abstractmethod
    def dependencies(self) -> List[str]:
        pass
    
    @abstractmethod
    def get_state(self) -> Dict[str, Any]:
        pass
    
    @abstractmethod
    def set_state(self, state: Dict[str, Any]) -> None:
        pass
    
    @abstractmethod
    def process_action(self, action: Action, context: GameContext) -> ActionResult:
        pass
    
    def on_tick(self, tick: int, context: GameContext) -> None:
        pass
    
    def reset(self) -> None:
        pass


class ModularGameEngine:
    def __init__(self, config: Any = None, seed: int = None):
        import random
        self.config = config
        self.rng = random.Random(seed)
        self._modules: Dict[str, GameModule] = {}
        self._context = GameContext(self)
        self._tick = 0
    
    def register_module(self, module: GameModule) -> None:
        self._modules[module.module_id] = module
    
    def get_module(self, module_id: str) -> Optional[GameModule]:
        return self._modules.get(module_id)
    
    def process_action(self, action: Action) -> ActionResult:
        module_id = self._get_module_for_action(action.type)
        module = self._modules.get(module_id)
        
        if module:
            return module.process_action(action, self._context)
        
        return ActionResult(
            success=False,
            action_type=action.type,
            message=f"No module found for action type: {action.type}"
        )
    
    def tick(self) -> None:
        self._tick += 1
        for module in self._modules.values():
            module.on_tick(self._tick, self._context)
    
    def get_state(self) -> Dict[str, Any]:
        return {
            module_id: module.get_state()
            for module_id, module in self._modules.items()
        }
    
    def set_state(self, state: Dict[str, Any]) -> None:
        for module_id, module_state in state.items():
            if module_id in self._modules:
                self._modules[module_id].set_state(module_state)
    
    def reset(self) -> None:
        self._tick = 0
        for module in self._modules.values():
            module.reset()
        self._context.clear_shared()
    
    def _get_module_for_action(self, action_type: ActionType) -> str:
        mapping = {
            ActionType.ATTACK: 'combat',
            ActionType.DEFEND: 'combat',
            ActionType.USE_SKILL: 'combat',
            ActionType.USE_ITEM: 'inventory',
            ActionType.EXPLORE: 'world',
            ActionType.NEXT_FLOOR: 'world',
            ActionType.FORGE: 'inventory',
        }
        return mapping.get(action_type, '')
