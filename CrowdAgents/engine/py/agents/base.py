"""
Agent 基类
定义 Agent 的核心接口和评分逻辑
"""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
import time

from state import GameState, StateDiff
from modules.base import Action, ActionType
from engine import GameEngine


@dataclass
class AgentStats:
    battles: int = 0
    wins: int = 0
    deaths: int = 0
    max_floor: int = 1
    level: int = 1
    kills: int = 0
    total_damage_dealt: int = 0
    total_damage_taken: int = 0
    skills_used: int = 0
    items_used: int = 0
    forge_count: int = 0


class AgentBase:
    @classmethod
    def create(cls, config: Dict[str, Any]) -> 'AgentBase':
        agent_classes = {
            'casual': CasualAgent,
            'hardcore': HardcoreAgent,
            'explorer': ExplorerAgent,
            'social': SocialAgent,
            'paying': PayingAgent,
        }
        agent_class = agent_classes.get(config.get('type'), cls)
        return agent_class(config)

    def __init__(self, config: Dict[str, Any]):
        self.id = config.get('id', 'unknown')
        self.name = config.get('name', 'Unknown Agent')
        self.type = config.get('type', 'base')
        self.avatar = config.get('avatar', '🎮')
        
        self.personality = config.get('personality', {})
        self.preferences = config.get('preferences', {})
        self.behavior_patterns = config.get('behaviorPatterns', {})
        self.skill_profile = config.get('skillProfile', {})
        self.special_traits = config.get('specialTraits', {})
        
        self.engine: Optional[GameEngine] = None
        self._prev_state: Optional[GameState] = None
        self._consecutive_fails = 0
        
        self.dimension_scores = {
            'excitement': 0.0,
            'growth': 0.0,
            'pacing': 0.0,
            'playability': 0.0,
            'retention': 0.0,
            'immersion': 0.0,
        }
        
        self.stats = AgentStats()
        self._event_log: List[Dict[str, Any]] = []
        self._breakdown: List[Dict[str, Any]] = []
        
        self._seen_monsters: set = set()
        self._used_skills: set = set()
        self._discovered_items: set = set()
        self._monster_kill_count: Dict[str, int] = {}
        
        self._last_upgrade_time = time.time()
        self._last_item_time = time.time()
        self._last_discovery_time = time.time()
        self._floor_start_time = time.time()
        self._battle_start_time: Optional[float] = None
        self._last_level_up_time = time.time()
        
        self._win_streak = 0
        self._fail_streak = 0
        self._consecutive_easy_wins = 0
        self._no_low_hp_battles = 0
        self._consecutive_crits_received = 0
        self._hit_combo = 0
        self._skills_used_in_battle: List[str] = []
        self._battle_turns = 0
        self._was_low_hp = False
        self._battles_at_same_level = 0
        self._battles_without_loot = 0
        self._kills_on_current_floor = 0
        self._total_monsters = 0
        
        self._has_story_content = False
        self._has_world_lore = False
        self._has_npc_interaction = False
        
        self._accumulated_scores: Dict[str, Dict[str, float]] = {}
        dimensions = ['excitement', 'growth', 'pacing', 'playability', 'retention', 'immersion']
        for dim in dimensions:
            self._accumulated_scores[dim] = {'positive': 0.0, 'negative': 0.0}
        
        self._factor_trigger_counts: Dict[str, int] = {}
        self._evaluation_config: Optional[Dict[str, Any]] = None
        self._expectations = self._init_expectations()
        self._sensitivity = self._init_sensitivity()

    def _init_expectations(self) -> Dict[str, float]:
        defaults = {
            'casual': {'excitement': 0.4, 'growth': 0.5, 'pacing': 0.3, 'playability': 0.4, 'retention': 0.6, 'immersion': 0.3},
            'hardcore': {'excitement': 0.9, 'growth': 0.7, 'pacing': 0.6, 'playability': 0.9, 'retention': 0.4, 'immersion': 0.2},
            'explorer': {'excitement': 0.5, 'growth': 0.5, 'pacing': 0.4, 'playability': 0.7, 'retention': 0.6, 'immersion': 0.95},
            'social': {'excitement': 0.5, 'growth': 0.5, 'pacing': 0.5, 'playability': 0.5, 'retention': 0.5, 'immersion': 0.4},
            'paying': {'excitement': 0.6, 'growth': 0.8, 'pacing': 0.5, 'playability': 0.6, 'retention': 0.6, 'immersion': 0.3},
        }
        base = defaults.get(self.type, defaults['casual'])
        return {
            'excitement': self.preferences.get('excitementExpectation', base['excitement']),
            'growth': self.preferences.get('growthExpectation', base['growth']),
            'pacing': self.preferences.get('pacingExpectation', base['pacing']),
            'playability': self.preferences.get('playabilityExpectation', base['playability']),
            'retention': self.preferences.get('retentionExpectation', base['retention']),
            'immersion': self.preferences.get('immersionExpectation', base['immersion']),
        }

    def _init_sensitivity(self) -> Dict[str, float]:
        defaults = {
            'casual': {'positive': 0.5, 'negative': 1.5},
            'hardcore': {'positive': 0.8, 'negative': 0.5},
            'explorer': {'positive': 0.7, 'negative': 1.2},
            'social': {'positive': 0.6, 'negative': 0.8},
            'paying': {'positive': 0.6, 'negative': 0.9},
        }
        base = defaults.get(self.type, defaults['casual'])
        return {
            'positive': self.personality.get('positiveSensitivity', base['positive']),
            'negative': self.personality.get('negativeSensitivity', base['negative']),
        }

    def set_engine(self, engine: GameEngine) -> None:
        self.engine = engine

    def set_evaluation_config(self, config: Dict[str, Any]) -> None:
        self._evaluation_config = config

    def decide(self, state: GameState) -> Action:
        return Action(ActionType.ATTACK)

    def analyze_state_change(self, prev: GameState, curr: GameState, diff: StateDiff) -> None:
        for event in diff.events_inferred:
            self._process_event(event, diff, prev, curr)

    def _process_event(self, event: str, diff: StateDiff, prev: GameState, curr: GameState) -> None:
        handlers = {
            'battle_start': self._on_battle_start,
            'battle_end': self._on_battle_end,
            'player_damaged': self._on_player_damaged,
            'player_healed': self._on_player_healed,
            'level_up': self._on_level_up,
            'floor_advance': self._on_floor_advance,
            'item_obtain': self._on_item_obtain,
            'item_use': self._on_item_use,
            'player_death': self._on_player_death,
            'monster_killed': self._on_monster_killed,
        }
        handler = handlers.get(event)
        if handler:
            handler(diff, prev, curr)

    def _on_battle_start(self, diff: StateDiff, prev: GameState, curr: GameState) -> None:
        self.stats.battles += 1
        self._battle_start_time = time.time()
        self._skills_used_in_battle.clear()
        self._battle_turns = 0
        self._was_low_hp = False
        self._hit_combo = 0
        
        if curr.monster:
            monster_id = curr.monster.id
            if monster_id not in self._seen_monsters:
                self._seen_monsters.add(monster_id)
                self._last_discovery_time = time.time()
                self._adjust_score('playability', 0.15, 'newMonster')
                self._adjust_score('excitement', 0.2, 'firstBlood')
            
            if curr.monster.is_boss:
                self._adjust_score('excitement', 0.3, 'bossFight')
            
            if curr.world.floor >= 8:
                self._adjust_score('excitement', 0.15, 'highFloor')

    def _on_battle_end(self, diff: StateDiff, prev: GameState, curr: GameState) -> None:
        battle_time = (time.time() - self._battle_start_time) * 1000 if self._battle_start_time else 0
        
        if prev.monster:
            self.stats.wins += 1
            self.stats.kills += 1
            self._total_monsters += 1
            self._win_streak += 1
            self._fail_streak = 0
            self._battles_at_same_level += 1
            self._kills_on_current_floor += 1
            
            self._adjust_score('growth', 0.03, 'battleVictory')
            
            hp_ratio = curr.player.hp / curr.player.max_hp
            
            if hp_ratio < 0.2:
                self._adjust_score('excitement', 0.25, 'closeVictory')
            elif hp_ratio > 0.9:
                self._consecutive_easy_wins += 1
            else:
                self._consecutive_easy_wins = 0
            
            if hp_ratio < 0.3:
                self._no_low_hp_battles = 0
            else:
                self._no_low_hp_battles += 1
            
            if self._was_low_hp and hp_ratio > 0:
                self._adjust_score('excitement', 0.30, 'comeback')
            
            if self._win_streak > 3:
                self._adjust_score('retention', 0.10, 'winStreak')
                self._adjust_score('pacing', 0.06, 'winStreak')
            
            if len(self._skills_used_in_battle) >= 3:
                self._adjust_score('excitement', 0.20, 'skillCombo')
                self._adjust_score('playability', 0.12, 'diversePlaystyle')
            
            if battle_time < 10000:
                self._adjust_score('pacing', 0.03, 'quickBattle')
            elif battle_time > 30000:
                self._adjust_score('pacing', -0.08, 'battleTooLong')
                self._adjust_score('excitement', -0.08, 'battleDrag')
            
            self._consecutive_fails = 0
            
            if prev.monster:
                monster_id = prev.monster.id
                self._monster_kill_count[monster_id] = self._monster_kill_count.get(monster_id, 0) + 1
                if self._monster_kill_count[monster_id] > 10:
                    self._adjust_score('playability', -0.1, 'repetitiveMonster')
        
        self._log_event('battleEnd', {'battle_time': battle_time, 'victory': prev.monster is not None})

    def _on_player_damaged(self, diff: StateDiff, prev: GameState, curr: GameState) -> None:
        self.stats.total_damage_taken += abs(diff.hp_delta)
        hp_ratio = curr.player.hp / curr.player.max_hp
        
        if hp_ratio < 0.3:
            self._adjust_score('excitement', 0.1, 'lowHPBattle')
            self._was_low_hp = True
        
        if hp_ratio < 0.15:
            self._adjust_score('excitement', 0.15, 'lowHPBattle')

    def _on_player_healed(self, diff: StateDiff, prev: GameState, curr: GameState) -> None:
        pass

    def _on_level_up(self, diff: StateDiff, prev: GameState, curr: GameState) -> None:
        old_level = self.stats.level
        self.stats.level = curr.player.level
        self._last_upgrade_time = time.time()
        self._battles_at_same_level = 0
        
        self._adjust_score('growth', 0.2, 'levelUp')
        self._adjust_score('growth', 0.10, 'statGain')
        
        now = time.time()
        if now - self._last_level_up_time < 300:
            self._adjust_score('growth', 0.15, 'quickLevelUp')
        self._last_level_up_time = now
        
        self._log_event('levelUp', {'new_level': curr.player.level, 'old_level': old_level})

    def _on_floor_advance(self, diff: StateDiff, prev: GameState, curr: GameState) -> None:
        time_spent = (time.time() - self._floor_start_time) * 1000
        self.stats.max_floor = max(self.stats.max_floor, curr.world.floor)
        self._win_streak = 0
        self._kills_on_current_floor = 0
        
        self._adjust_score('retention', 0.15, 'newFloor')
        
        if time_spent < 180000:
            self._adjust_score('pacing', 0.10, 'fastFloorProgress')
        elif time_spent > 300000:
            self._adjust_score('pacing', -0.10, 'floorTooSlow')
        
        self._adjust_score('pacing', 0.05, 'progressVisible')
        
        self._floor_start_time = time.time()
        self._log_event('floorAdvance', {'new_floor': curr.world.floor, 'time_spent': time_spent})

    def _on_item_obtain(self, diff: StateDiff, prev: GameState, curr: GameState) -> None:
        self._last_item_time = time.time()
        self._battles_without_loot = 0
        
        for item_id in diff.item_obtained:
            if item_id not in self._discovered_items:
                self._discovered_items.add(item_id)
                self._last_discovery_time = time.time()
                self._adjust_score('playability', 0.1, 'newItem')
        
        self._adjust_score('growth', 0.02, 'commonItem')

    def _on_item_use(self, diff: StateDiff, prev: GameState, curr: GameState) -> None:
        self.stats.items_used += 1

    def _on_player_death(self, diff: StateDiff, prev: GameState, curr: GameState) -> None:
        self.stats.deaths += 1
        self._win_streak = 0
        self._fail_streak += 1
        
        self._adjust_score('retention', -0.5, 'death')
        self._adjust_score('growth', -0.20, 'progressLoss')
        self._adjust_score('pacing', -0.15, 'deathInterrupt')
        
        self._log_event('playerDeath', {'floor': prev.world.floor})

    def _on_monster_killed(self, diff: StateDiff, prev: GameState, curr: GameState) -> None:
        if prev.monster:
            self._battles_without_loot += 1
            if self._battles_without_loot >= 5:
                self._adjust_score('retention', -0.08, 'noLootStreak')

    def _adjust_score(self, dimension: str, delta: float, factor_name: str = None) -> None:
        if dimension not in self.dimension_scores:
            return
        
        if self._evaluation_config and factor_name:
            delta = self._calculate_adjusted_delta(dimension, delta, factor_name)
        
        new_score = max(0, min(10, self.dimension_scores[dimension] + delta))
        self.dimension_scores[dimension] = round(new_score, 2)

    def _calculate_adjusted_delta(self, dimension: str, delta: float, factor_name: str) -> float:
        config = self._evaluation_config
        if not config:
            return delta
        
        regularization = config.get('regularization', {})
        if not regularization.get('enabled', True):
            return delta
        
        factors = config.get('factors', {}).get(dimension, {})
        is_positive = delta > 0
        factor_config = factors.get('positive' if is_positive else 'negative', {}).get(factor_name)
        
        if not factor_config:
            return delta
        
        base_score = factor_config.get('baseScore', abs(delta))
        freq = factor_config.get('frequency', 'medium')
        freq_multiplier = config.get('frequencyMultipliers', {}).get(freq, {}).get('baseMultiplier', 1.0)
        
        sensitivity_mod = self._calculate_sensitivity_modifier(is_positive)
        expectation_mod = self._calculate_expectation_modifier(dimension)
        
        adjusted = base_score * freq_multiplier * sensitivity_mod * expectation_mod
        
        accumulated_key = 'positive' if is_positive else 'negative'
        current_accumulated = self._accumulated_scores[dimension][accumulated_key]
        max_accumulated = factor_config.get('maxAccumulated', 10.0)
        
        if current_accumulated + abs(adjusted) > max_accumulated:
            remaining = max_accumulated - current_accumulated
            if remaining <= 0:
                return 0
            adjusted = remaining if is_positive else -remaining
        
        self._accumulated_scores[dimension][accumulated_key] += abs(adjusted)
        
        return adjusted if is_positive else -adjusted

    def _calculate_sensitivity_modifier(self, is_positive: bool) -> float:
        sensitivity = self._sensitivity['positive'] if is_positive else self._sensitivity['negative']
        return max(0.5, min(1.5, sensitivity))

    def _calculate_expectation_modifier(self, dimension: str) -> float:
        expectation = self._expectations.get(dimension, 0.5)
        return max(0.5, min(1.5, expectation))

    def get_quit_threshold(self) -> int:
        return self.behavior_patterns.get('quitThreshold', {}).get('consecutiveFails', 999)

    def should_quit(self) -> bool:
        return self._consecutive_fails >= self.get_quit_threshold()

    def get_report(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'name': self.name,
            'type': self.type,
            'avatar': self.avatar,
            'dimension_scores': {k: round(v, 2) for k, v in self.dimension_scores.items()},
            'overall_score': self._calculate_overall_score(),
            'stats': {
                'battles': self.stats.battles,
                'wins': self.stats.wins,
                'deaths': self.stats.deaths,
                'max_floor': self.stats.max_floor,
                'level': self.stats.level,
                'kills': self.stats.kills,
            },
            'breakdown': self._breakdown[-10:],
        }

    def _calculate_overall_score(self) -> float:
        if not self._evaluation_config:
            weights = {}
        else:
            weights = self._evaluation_config.get('agentWeights', {}).get(self.type, {})
        
        total = 0.0
        weight_sum = 0.0
        
        for dim, score in self.dimension_scores.items():
            w = weights.get(dim, 1.0)
            total += score * w
            weight_sum += w
        
        return round(total / weight_sum, 2) if weight_sum > 0 else 0.0

    def _log_event(self, event_type: str, data: Dict[str, Any]) -> None:
        self._event_log.append({
            'type': event_type,
            'data': data,
            'time': time.time(),
        })
        
        if len(self._event_log) > 100:
            self._event_log = self._event_log[-100:]

    def _add_breakdown(self, dimension: str, issue: str, severity: str) -> None:
        existing = next((b for b in self._breakdown if b['dimension'] == dimension and b['issue'] == issue), None)
        if existing:
            existing['count'] = existing.get('count', 1) + 1
        else:
            self._breakdown.append({
                'dimension': dimension,
                'issue': issue,
                'severity': severity,
                'count': 1,
            })

    def check_unmet_expectations(self) -> None:
        now = time.time()
        
        if now - self._last_discovery_time > 20000:
            self._adjust_score('playability', -0.08, 'noDiscovery')
        
        if self._total_monsters > 15 and len(self._seen_monsters) < 5:
            self._adjust_score('playability', -0.15, 'monsterVarietyLow')
        
        if not self._has_story_content:
            self._adjust_score('immersion', -0.08, 'noStoryContent')
        
        if now - self._last_upgrade_time > 300000:
            self._adjust_score('growth', -0.10, 'noUpgrade')
        
        if now - self._last_item_time > 120000:
            self._adjust_score('growth', -0.08, 'lowDropRate')
        
        if self._battles_at_same_level > 10:
            self._adjust_score('growth', -0.12, 'levelStagnation')
        
        if self._consecutive_easy_wins > 5:
            self._adjust_score('excitement', -0.08, 'battleTooEasy')
        
        if self._no_low_hp_battles > 10:
            self._adjust_score('excitement', -0.10, 'noThrill')
        
        if self._fail_streak > 2:
            self._adjust_score('pacing', -0.12, 'failStreak')
            self._adjust_score('retention', -0.25, 'negativeFeedback')
        
        if now - self._floor_start_time > 300000:
            self._adjust_score('pacing', -0.10, 'progressStall')


from agents.casual import CasualAgent
from agents.hardcore import HardcoreAgent
from agents.explorer import ExplorerAgent
from agents.social import SocialAgent
from agents.paying import PayingAgent
