"""
状态数据结构定义
定义游戏状态快照的核心数据结构
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from enum import Enum
import time


class SnapshotType(Enum):
    FULL = "full"
    INCREMENTAL = "incr"
    CHECKPOINT = "ckpt"


@dataclass
class PlayerState:
    hp: int
    max_hp: int
    mp: int
    max_mp: int
    level: int
    exp: int
    max_exp: int
    atk: int
    defense: int
    gold: int
    crit_rate: float
    dodge_rate: float
    weapon: Optional[str] = None
    armor: Optional[str] = None
    learned_skills: List[str] = field(default_factory=list)
    equipped_skills: List[str] = field(default_factory=list)
    skill_cooldowns: Dict[str, int] = field(default_factory=dict)
    stamina: int = 100
    max_stamina: int = 100
    buffs: List[Dict[str, Any]] = field(default_factory=list)
    debuffs: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
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
            'skill_cooldowns': self.skill_cooldowns,
            'stamina': self.stamina,
            'max_stamina': self.max_stamina,
            'buffs': self.buffs,
            'debuffs': self.debuffs,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'PlayerState':
        return cls(
            hp=data['hp'],
            max_hp=data['max_hp'],
            mp=data.get('mp', 0),
            max_mp=data.get('max_mp', 0),
            level=data['level'],
            exp=data['exp'],
            max_exp=data['max_exp'],
            atk=data['atk'],
            defense=data.get('defense', data.get('def', 0)),
            gold=data['gold'],
            crit_rate=data.get('crit_rate', 0.1),
            dodge_rate=data.get('dodge_rate', 0.05),
            weapon=data.get('weapon'),
            armor=data.get('armor'),
            learned_skills=data.get('learned_skills', []),
            equipped_skills=data.get('equipped_skills', []),
            skill_cooldowns=data.get('skill_cooldowns', {}),
            stamina=data.get('stamina', 100),
            max_stamina=data.get('max_stamina', 100),
            buffs=data.get('buffs', []),
            debuffs=data.get('debuffs', []),
        )


@dataclass
class MonsterState:
    id: str
    name: str
    hp: int
    max_hp: int
    atk: int
    defense: int
    crit_rate: float
    dodge_rate: float
    is_boss: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'name': self.name,
            'hp': self.hp,
            'max_hp': self.max_hp,
            'atk': self.atk,
            'defense': self.defense,
            'crit_rate': self.crit_rate,
            'dodge_rate': self.dodge_rate,
            'is_boss': self.is_boss,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'MonsterState':
        return cls(
            id=data['id'],
            name=data['name'],
            hp=data['hp'],
            max_hp=data.get('max_hp', data.get('maxHP', data['hp'])),
            atk=data['atk'],
            defense=data.get('defense', data.get('def', 0)),
            crit_rate=data.get('crit_rate', 0.1),
            dodge_rate=data.get('dodge_rate', 0.05),
            is_boss=data.get('is_boss', False),
        )


@dataclass
class CharacterState:
    skill_tree: Dict[str, int] = field(default_factory=dict)
    achievements: List[str] = field(default_factory=list)
    unlocked_features: List[str] = field(default_factory=list)
    story_progress: Dict[str, Any] = field(default_factory=dict)
    playtime_ms: int = 0
    total_battles: int = 0
    total_kills: int = 0
    highest_floor: int = 1
    deaths: int = 0
    login_streak: int = 0
    last_login_date: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            'skill_tree': self.skill_tree,
            'achievements': self.achievements,
            'unlocked_features': self.unlocked_features,
            'story_progress': self.story_progress,
            'playtime_ms': self.playtime_ms,
            'total_battles': self.total_battles,
            'total_kills': self.total_kills,
            'highest_floor': self.highest_floor,
            'deaths': self.deaths,
            'login_streak': self.login_streak,
            'last_login_date': self.last_login_date,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'CharacterState':
        return cls(
            skill_tree=data.get('skill_tree', {}),
            achievements=data.get('achievements', []),
            unlocked_features=data.get('unlocked_features', []),
            story_progress=data.get('story_progress', {}),
            playtime_ms=data.get('playtime_ms', 0),
            total_battles=data.get('total_battles', 0),
            total_kills=data.get('total_kills', 0),
            highest_floor=data.get('highest_floor', 1),
            deaths=data.get('deaths', 0),
            login_streak=data.get('login_streak', 0),
            last_login_date=data.get('last_login_date'),
        )


@dataclass
class UIState:
    current_scene: str = 'explore'
    active_dialog: Optional[str] = None
    dialog_options: List[str] = field(default_factory=list)
    selected_options: List[str] = field(default_factory=list)
    tutorial_step: Optional[int] = None
    notifications: List[Dict[str, Any]] = field(default_factory=list)
    hovered_element: Optional[str] = None
    focused_panel: Optional[str] = None
    scene_enter_time: float = 0.0
    last_action_time: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            'current_scene': self.current_scene,
            'active_dialog': self.active_dialog,
            'dialog_options': self.dialog_options,
            'selected_options': self.selected_options,
            'tutorial_step': self.tutorial_step,
            'notifications': self.notifications,
            'hovered_element': self.hovered_element,
            'focused_panel': self.focused_panel,
            'scene_enter_time': self.scene_enter_time,
            'last_action_time': self.last_action_time,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'UIState':
        return cls(
            current_scene=data.get('current_scene', 'explore'),
            active_dialog=data.get('active_dialog'),
            dialog_options=data.get('dialog_options', []),
            selected_options=data.get('selected_options', []),
            tutorial_step=data.get('tutorial_step'),
            notifications=data.get('notifications', []),
            hovered_element=data.get('hovered_element'),
            focused_panel=data.get('focused_panel'),
            scene_enter_time=data.get('scene_enter_time', 0.0),
            last_action_time=data.get('last_action_time', 0.0),
        )


@dataclass
class InventoryState:
    slots: int
    items: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'slots': self.slots,
            'items': self.items,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'InventoryState':
        return cls(
            slots=data['slots'],
            items=data.get('items', []),
        )


@dataclass
class WorldState:
    floor: int
    killed_on_floor: int
    monsters_to_advance: int
    can_advance: bool
    in_battle: bool
    area_id: str = 'default'
    area_name: str = '初始区域'
    game_day: int = 1
    time_period: str = 'day'
    week_number: int = 1
    month_number: int = 1
    active_events: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'floor': self.floor,
            'killed_on_floor': self.killed_on_floor,
            'monsters_to_advance': self.monsters_to_advance,
            'can_advance': self.can_advance,
            'in_battle': self.in_battle,
            'area_id': self.area_id,
            'area_name': self.area_name,
            'game_day': self.game_day,
            'time_period': self.time_period,
            'week_number': self.week_number,
            'month_number': self.month_number,
            'active_events': self.active_events,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'WorldState':
        return cls(
            floor=data['floor'],
            killed_on_floor=data.get('killed_on_floor', data.get('killed', 0)),
            monsters_to_advance=data.get('monsters_to_advance', 3),
            can_advance=data.get('can_advance', data.get('canAdvanceFloor', False)),
            in_battle=data['in_battle'],
            area_id=data.get('area_id', 'default'),
            area_name=data.get('area_name', '初始区域'),
            game_day=data.get('game_day', 1),
            time_period=data.get('time_period', 'day'),
            week_number=data.get('week_number', 1),
            month_number=data.get('month_number', 1),
            active_events=data.get('active_events', []),
        )


@dataclass
class QuestState:
    active_quests: List[Dict[str, Any]] = field(default_factory=list)
    completed_quests: List[str] = field(default_factory=list)
    daily_reset_count: int = 0
    unlocked_chains: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'active_quests': self.active_quests,
            'completed_quests': self.completed_quests,
            'daily_reset_count': self.daily_reset_count,
            'unlocked_chains': self.unlocked_chains,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'QuestState':
        return cls(
            active_quests=data.get('active_quests', []),
            completed_quests=data.get('completed_quests', []),
            daily_reset_count=data.get('daily_reset_count', 0),
            unlocked_chains=data.get('unlocked_chains', []),
        )


@dataclass
class EconomyState:
    premium_currency: int = 0
    vip_level: int = 0
    vip_exp: int = 0
    total_spent: int = 0
    shop_last_action: Optional[str] = None
    shop_last_item: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            'premium_currency': self.premium_currency,
            'vip_level': self.vip_level,
            'vip_exp': self.vip_exp,
            'total_spent': self.total_spent,
            'shop_last_action': self.shop_last_action,
            'shop_last_item': self.shop_last_item,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'EconomyState':
        return cls(
            premium_currency=data.get('premium_currency', 0),
            vip_level=data.get('vip_level', 0),
            vip_exp=data.get('vip_exp', 0),
            total_spent=data.get('total_spent', 0),
            shop_last_action=data.get('shop_last_action'),
            shop_last_item=data.get('shop_last_item'),
        )


@dataclass
class EventState:
    rewards_claimed: List[str] = field(default_factory=list)
    event_progress: Dict[str, int] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'rewards_claimed': self.rewards_claimed,
            'event_progress': self.event_progress,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'EventState':
        return cls(
            rewards_claimed=data.get('rewards_claimed', []),
            event_progress=data.get('event_progress', {}),
        )


@dataclass
class GameState:
    tick: int
    timestamp: float
    player: PlayerState
    monster: Optional[MonsterState]
    inventory: InventoryState
    world: WorldState
    character: CharacterState = field(default_factory=CharacterState)
    ui: UIState = field(default_factory=UIState)
    quest: QuestState = field(default_factory=QuestState)
    economy: EconomyState = field(default_factory=EconomyState)
    event: EventState = field(default_factory=EventState)
    snapshot_type: SnapshotType = SnapshotType.FULL
    parent_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            'tick': self.tick,
            'timestamp': self.timestamp,
            'player': self.player.to_dict(),
            'monster': self.monster.to_dict() if self.monster else None,
            'inventory': self.inventory.to_dict(),
            'world': self.world.to_dict(),
            'character': self.character.to_dict(),
            'ui': self.ui.to_dict(),
            'quest': self.quest.to_dict(),
            'economy': self.economy.to_dict(),
            'event': self.event.to_dict(),
            'snapshot_type': self.snapshot_type.value,
            'parent_id': self.parent_id,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'GameState':
        return cls(
            tick=data['tick'],
            timestamp=data['timestamp'],
            player=PlayerState.from_dict(data['player']),
            monster=MonsterState.from_dict(data['monster']) if data.get('monster') else None,
            inventory=InventoryState.from_dict(data['inventory']),
            world=WorldState.from_dict(data['world']),
            character=CharacterState.from_dict(data.get('character', {})),
            ui=UIState.from_dict(data.get('ui', {})),
            quest=QuestState.from_dict(data.get('quest', {})),
            economy=EconomyState.from_dict(data.get('economy', {})),
            event=EventState.from_dict(data.get('event', {})),
            snapshot_type=SnapshotType(data.get('snapshot_type', 'full')),
            parent_id=data.get('parent_id'),
        )


@dataclass
class StateDiff:
    tick_from: int
    tick_to: int
    changes: Dict[str, Any]
    events_inferred: List[str]

    hp_delta: int = 0
    gold_delta: int = 0
    exp_delta: int = 0
    floor_changed: bool = False
    battle_started: bool = False
    battle_ended: bool = False
    level_up: bool = False
    item_obtained: List[str] = field(default_factory=list)
    item_used: List[str] = field(default_factory=list)
    monster_killed: Optional[str] = None
    player_died: bool = False

    scene_changed: bool = False
    scene_from: Optional[str] = None
    scene_to: Optional[str] = None
    dialog_opened: bool = False
    dialog_closed: bool = False
    tutorial_advanced: bool = False
    achievement_unlocked: List[str] = field(default_factory=list)
    feature_unlocked: List[str] = field(default_factory=list)
    story_progress_updated: bool = False
    playtime_delta_ms: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            'tick_from': self.tick_from,
            'tick_to': self.tick_to,
            'changes': self.changes,
            'events_inferred': self.events_inferred,
            'hp_delta': self.hp_delta,
            'gold_delta': self.gold_delta,
            'exp_delta': self.exp_delta,
            'floor_changed': self.floor_changed,
            'battle_started': self.battle_started,
            'battle_ended': self.battle_ended,
            'level_up': self.level_up,
            'item_obtained': self.item_obtained,
            'item_used': self.item_used,
            'monster_killed': self.monster_killed,
            'player_died': self.player_died,
            'scene_changed': self.scene_changed,
            'scene_from': self.scene_from,
            'scene_to': self.scene_to,
            'dialog_opened': self.dialog_opened,
            'dialog_closed': self.dialog_closed,
            'tutorial_advanced': self.tutorial_advanced,
            'achievement_unlocked': self.achievement_unlocked,
            'feature_unlocked': self.feature_unlocked,
            'story_progress_updated': self.story_progress_updated,
            'playtime_delta_ms': self.playtime_delta_ms,
        }
