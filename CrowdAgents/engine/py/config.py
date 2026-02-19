"""
配置加载器
加载游戏配置和模拟参数
"""

from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field

import orjson


@dataclass
class SimulationConfig:
    tick_interval_ms: int = 100
    max_ticks: int = 1200
    snapshot_interval: int = 100
    random_seed: Optional[int] = None
    log_level: str = "INFO"
    agents: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class GameConfig:
    player: Dict[str, Any] = field(default_factory=dict)
    monsters: List[Dict[str, Any]] = field(default_factory=list)
    skills: List[Dict[str, Any]] = field(default_factory=list)
    items: Dict[str, Any] = field(default_factory=dict)
    equipment: Dict[str, Any] = field(default_factory=dict)
    floor: Dict[str, Any] = field(default_factory=dict)
    battle: Dict[str, Any] = field(default_factory=dict)
    loot_table: Dict[str, List[Dict[str, Any]]] = field(default_factory=dict)
    inventory: Dict[str, Any] = field(default_factory=dict)
    world_lore: List[Dict[str, Any]] = field(default_factory=list)
    npcs: List[Dict[str, Any]] = field(default_factory=list)
    random_events: List[Dict[str, Any]] = field(default_factory=list)


class ConfigLoader:
    def __init__(self, config_dir: str = None):
        if config_dir:
            self.config_dir = Path(config_dir)
        else:
            self.config_dir = Path(__file__).parent.parent.parent / "config"
        self._game_config: Optional[GameConfig] = None
        self._simulation_config: Optional[SimulationConfig] = None
        self._evaluation_config: Optional[Dict[str, Any]] = None
        self._agents_config: Optional[Dict[str, Any]] = None
        
        self._project_root = Path(__file__).parent.parent.parent.parent

    def load_game_config(self, path: str = None) -> GameConfig:
        if self._game_config and not path:
            return self._game_config
        
        if path:
            config_path = Path(path)
        else:
            config_path = self._project_root / "config.json"
        
        data = orjson.loads(config_path.read_bytes())
        
        self._game_config = GameConfig(
            player=data.get('player', {}),
            monsters=data.get('monsters', []),
            skills=data.get('skills', []),
            items=data.get('items', {}),
            equipment=data.get('equipment', {}),
            floor=data.get('floor', {}),
            battle=data.get('battle', {}),
            loot_table=data.get('lootTable', {}),
            inventory=data.get('inventory', {}),
            world_lore=data.get('worldLore', []),
            npcs=data.get('npcs', []),
            random_events=data.get('randomEvents', []),
        )
        
        return self._game_config

    def load_simulation_config(self, path: str = None) -> SimulationConfig:
        if self._simulation_config and not path:
            return self._simulation_config
        
        if path:
            config_path = Path(path)
        else:
            config_path = self.config_dir / "agents.json"
        
        data = orjson.loads(config_path.read_bytes())
        
        simulation = data.get('simulation', {})
        
        self._simulation_config = SimulationConfig(
            tick_interval_ms=simulation.get('tickInterval', 100),
            max_ticks=simulation.get('duration', 600000) // simulation.get('tickInterval', 100),
            snapshot_interval=100,
            random_seed=None,
            log_level="INFO",
            agents=data.get('agents', []),
        )
        
        self._agents_config = data
        
        return self._simulation_config

    def load_evaluation_config(self, path: str = None) -> Dict[str, Any]:
        if self._evaluation_config and not path:
            return self._evaluation_config
        
        if path:
            config_path = Path(path)
        else:
            config_path = self.config_dir / "evaluation.json"
        
        self._evaluation_config = orjson.loads(config_path.read_bytes())
        
        return self._evaluation_config

    def load_agents_config(self, path: str = None) -> Dict[str, Any]:
        if self._agents_config and not path:
            return self._agents_config
        
        if path:
            config_path = Path(path)
        else:
            config_path = self.config_dir / "agents.json"
        
        self._agents_config = orjson.loads(config_path.read_bytes())
        
        return self._agents_config

    def get_target_audience(self) -> Optional[Dict[str, Any]]:
        agents_config = self.load_agents_config()
        return agents_config.get('targetAudience')

    def clear_cache(self):
        self._game_config = None
        self._simulation_config = None
        self._evaluation_config = None
        self._agents_config = None
