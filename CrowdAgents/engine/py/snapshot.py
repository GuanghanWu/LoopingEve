"""
快照管理器
负责游戏状态的捕获、存储、差异计算和回放
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from pathlib import Path
import time
import hashlib
import logging

import orjson

from state import (
    GameState, StateDiff, SnapshotType, PlayerState, MonsterState,
    InventoryState, WorldState, CharacterState, UIState
)
from event_inference import EventInferenceEngine


@dataclass
class SnapshotMetadata:
    snapshot_id: str
    tick: int
    timestamp: float
    snapshot_type: SnapshotType
    parent_id: Optional[str] = None
    file_path: Optional[str] = None


class SnapshotStrategy:
    def __init__(self):
        self.full_snapshot_interval = 100
        self.checkpoint_triggers = {'level_up', 'floor_advance', 'player_death'}
        self.max_incremental_chain = 20

    def should_create_snapshot(self, tick: int, events: List[str], 
                                last_full_tick: int, incremental_count: int) -> SnapshotType:
        if tick - last_full_tick >= self.full_snapshot_interval:
            return SnapshotType.FULL
        
        if incremental_count >= self.max_incremental_chain:
            return SnapshotType.FULL
        
        for event in events:
            if event in self.checkpoint_triggers:
                return SnapshotType.CHECKPOINT
        
        return SnapshotType.INCREMENTAL


class SnapshotStore:
    def __init__(self, snapshot_dir: str = None):
        self.snapshot_dir = Path(snapshot_dir) if snapshot_dir else None
        self._snapshots: Dict[str, GameState] = {}
        self._metadata: Dict[str, SnapshotMetadata] = {}
        
        if self.snapshot_dir:
            self.snapshot_dir.mkdir(parents=True, exist_ok=True)

    def save(self, state: GameState) -> str:
        snapshot_id = self._generate_id(state)
        self._snapshots[snapshot_id] = state
        self._metadata[snapshot_id] = SnapshotMetadata(
            snapshot_id=snapshot_id,
            tick=state.tick,
            timestamp=state.timestamp,
            snapshot_type=state.snapshot_type,
            parent_id=state.parent_id,
        )
        
        if self.snapshot_dir:
            file_path = self.snapshot_dir / f"{snapshot_id}.json"
            file_path.write_bytes(orjson.dumps(state.to_dict(), option=orjson.OPT_INDENT_2))
            self._metadata[snapshot_id].file_path = str(file_path)
        
        return snapshot_id

    def restore_to(self, snapshot_id: str) -> Optional[GameState]:
        if snapshot_id in self._snapshots:
            return self._snapshots[snapshot_id]
        
        if self.snapshot_dir:
            file_path = self.snapshot_dir / f"{snapshot_id}.json"
            if file_path.exists():
                data = orjson.loads(file_path.read_bytes())
                state = GameState.from_dict(data)
                self._snapshots[snapshot_id] = state
                return state
        
        return None

    def get_metadata(self, snapshot_id: str) -> Optional[SnapshotMetadata]:
        return self._metadata.get(snapshot_id)

    def list_snapshots(self) -> List[SnapshotMetadata]:
        return sorted(self._metadata.values(), key=lambda m: m.tick)

    def clear(self):
        self._snapshots.clear()
        self._metadata.clear()

    def _generate_id(self, state: GameState) -> str:
        data = f"{state.tick}_{state.timestamp}_{id(state)}"
        return hashlib.md5(data.encode()).hexdigest()[:12]


class SnapshotManager:
    def __init__(self, store: SnapshotStore = None, event_engine: EventInferenceEngine = None):
        self.store = store or SnapshotStore()
        self.strategy = SnapshotStrategy()
        self.event_engine = event_engine or EventInferenceEngine()
        self._snapshots: List[SnapshotMetadata] = []
        self._last_full_tick = 0
        self._incremental_count = 0
        self._use_legacy_diff = False

    def create_snapshot(self, tick: int, state: GameState, 
                        events: List[str] = None) -> str:
        events = events or []
        snapshot_type = self.strategy.should_create_snapshot(
            tick, events, self._last_full_tick, self._incremental_count
        )
        
        state.snapshot_type = snapshot_type
        
        if snapshot_type == SnapshotType.FULL:
            self._last_full_tick = tick
            self._incremental_count = 0
        else:
            self._incremental_count += 1
            if self._snapshots:
                state.parent_id = self._snapshots[-1].snapshot_id
        
        snapshot_id = self.store.save(state)
        
        metadata = self.store.get_metadata(snapshot_id)
        if metadata:
            self._snapshots.append(metadata)
        
        return snapshot_id

    def compute_diff(self, prev: GameState, curr: GameState) -> StateDiff:
        if self._use_legacy_diff:
            return self._compute_diff_legacy(prev, curr)
        
        try:
            events, extracted = self.event_engine.infer(prev, curr)
            computed = self.event_engine._compute_values(prev, curr)
            return self.event_engine.build_state_diff(prev, curr, events, computed)
        except Exception as e:
            logging.warning(f"Event inference failed, falling back to legacy: {e}")
            return self._compute_diff_legacy(prev, curr)

    def _compute_diff_legacy(self, prev: GameState, curr: GameState) -> StateDiff:
        changes = {}
        events_inferred = []
        
        hp_delta = curr.player.hp - prev.player.hp
        if hp_delta != 0:
            changes['hp_delta'] = hp_delta
        
        gold_delta = curr.player.gold - prev.player.gold
        if gold_delta != 0:
            changes['gold_delta'] = gold_delta
        
        exp_delta = curr.player.exp - prev.player.exp
        if exp_delta != 0:
            changes['exp_delta'] = exp_delta
        
        floor_changed = curr.world.floor != prev.world.floor
        if floor_changed:
            changes['floor_changed'] = True
            events_inferred.append('floor_advance')
        
        battle_started = curr.world.in_battle and not prev.world.in_battle
        if battle_started:
            events_inferred.append('battle_start')
        
        battle_ended = not curr.world.in_battle and prev.world.in_battle
        if battle_ended:
            events_inferred.append('battle_end')
        
        monster_killed = None
        if prev.monster and not curr.monster and battle_ended:
            monster_killed = prev.monster.id
            events_inferred.append('monster_killed')
        
        player_died = curr.player.hp <= 0 and prev.player.hp > 0
        if player_died:
            events_inferred.append('player_death')
        
        level_up = curr.player.level > prev.player.level
        if level_up:
            events_inferred.append('level_up')
        
        if hp_delta < 0:
            events_inferred.append('player_damaged')
        elif hp_delta > 0 and not level_up:
            events_inferred.append('player_healed')
        
        item_obtained = []
        item_used = []
        prev_items = {item['id']: item.get('count', 1) for item in prev.inventory.items}
        curr_items = {item['id']: item.get('count', 1) for item in curr.inventory.items}
        
        for item_id, count in curr_items.items():
            if item_id not in prev_items:
                item_obtained.append(item_id)
                events_inferred.append('item_obtain')
            elif count > prev_items[item_id]:
                item_obtained.append(item_id)
                events_inferred.append('item_obtain')
        
        for item_id, count in prev_items.items():
            if item_id not in curr_items:
                item_used.append(item_id)
                events_inferred.append('item_use')
            elif count > curr_items.get(item_id, 0):
                item_used.append(item_id)
                events_inferred.append('item_use')
        
        scene_changed = curr.ui.current_scene != prev.ui.current_scene
        scene_from = prev.ui.current_scene if scene_changed else None
        scene_to = curr.ui.current_scene if scene_changed else None
        if scene_changed:
            events_inferred.append('scene_change')
        
        dialog_opened = curr.ui.active_dialog and not prev.ui.active_dialog
        if dialog_opened:
            events_inferred.append('dialog_open')
        
        dialog_closed = prev.ui.active_dialog and not curr.ui.active_dialog
        if dialog_closed:
            events_inferred.append('dialog_close')
        
        tutorial_advanced = (curr.ui.tutorial_step is not None and 
                            prev.ui.tutorial_step is not None and
                            curr.ui.tutorial_step > prev.ui.tutorial_step)
        if tutorial_advanced:
            events_inferred.append('tutorial_advance')
        
        achievement_unlocked = [a for a in curr.character.achievements 
                               if a not in prev.character.achievements]
        if achievement_unlocked:
            events_inferred.append('achievement_unlock')
        
        feature_unlocked = [f for f in curr.character.unlocked_features 
                           if f not in prev.character.unlocked_features]
        if feature_unlocked:
            events_inferred.append('feature_unlock')
        
        story_progress_updated = (curr.character.story_progress != prev.character.story_progress)
        if story_progress_updated:
            events_inferred.append('story_progress')
        
        playtime_delta_ms = curr.character.playtime_ms - prev.character.playtime_ms
        
        return StateDiff(
            tick_from=prev.tick,
            tick_to=curr.tick,
            changes=changes,
            events_inferred=list(set(events_inferred)),
            hp_delta=hp_delta,
            gold_delta=gold_delta,
            exp_delta=exp_delta,
            floor_changed=floor_changed,
            battle_started=battle_started,
            battle_ended=battle_ended,
            level_up=level_up,
            item_obtained=item_obtained,
            item_used=item_used,
            monster_killed=monster_killed,
            player_died=player_died,
            scene_changed=scene_changed,
            scene_from=scene_from,
            scene_to=scene_to,
            dialog_opened=dialog_opened,
            dialog_closed=dialog_closed,
            tutorial_advanced=tutorial_advanced,
            achievement_unlocked=achievement_unlocked,
            feature_unlocked=feature_unlocked,
            story_progress_updated=story_progress_updated,
            playtime_delta_ms=playtime_delta_ms,
        )

    def get_snapshot_at_tick(self, tick: int) -> Optional[GameState]:
        for metadata in reversed(self._snapshots):
            if metadata.tick <= tick:
                return self.store.restore_to(metadata.snapshot_id)
        return None

    def get_recent_snapshots(self, count: int = 10) -> List[GameState]:
        recent_metadata = self._snapshots[-count:]
        snapshots = []
        for metadata in recent_metadata:
            state = self.store.restore_to(metadata.snapshot_id)
            if state:
                snapshots.append(state)
        return snapshots

    def clear(self):
        self.store.clear()
        self._snapshots.clear()
        self._last_full_tick = 0
        self._incremental_count = 0


class SnapshotReplayer:
    def __init__(self, snapshot_dir: str):
        self.snapshot_dir = Path(snapshot_dir)
        self.store = SnapshotStore(snapshot_dir)

    def replay(self, snapshot_id: str) -> Optional[GameState]:
        state = self.store.restore_to(snapshot_id)
        if state:
            print(f"=== Snapshot: {snapshot_id} ===")
            print(f"Tick: {state.tick}")
            print(f"Player HP: {state.player.hp}/{state.player.max_hp}")
            print(f"Floor: {state.world.floor}")
            print(f"In Battle: {state.world.in_battle}")
        return state

    def replay_range(self, from_tick: int, to_tick: int) -> List[GameState]:
        snapshots = self.store.list_snapshots()
        states = []
        for metadata in snapshots:
            if from_tick <= metadata.tick <= to_tick:
                state = self.store.restore_to(metadata.snapshot_id)
                if state:
                    states.append(state)
        return states

    def diff_range(self, from_tick: int, to_tick: int) -> List[StateDiff]:
        states = self.replay_range(from_tick, to_tick)
        diffs = []
        manager = SnapshotManager()
        
        for i in range(1, len(states)):
            diff = manager.compute_diff(states[i-1], states[i])
            diffs.append(diff)
        
        return diffs
