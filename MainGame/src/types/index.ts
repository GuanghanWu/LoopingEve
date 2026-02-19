export interface PlayerInitial {
  level: number;
  hp: number;
  maxHP: number;
  atk: number;
  def: number;
  exp: number;
  maxEXP: number;
  gold: number;
  critRate: number;
  dodgeRate: number;
}

export interface LevelUpConfig {
  hp: number;
  atk: number;
  def: number;
  expMultiplier: number;
}

export interface PlayerConfig {
  initial: PlayerInitial;
  levelUp: LevelUpConfig;
  skillSlots: number[];
}

export interface BattleConfig {
  normalAttackRand: number;
  enemyAttackRand: number;
}

export interface FloorConfig {
  monstersToAdvance: number;
  maxMonsters: number;
  difficultyMultiplier: number;
}

export interface InventoryConfig {
  initialSlots: number;
  maxSlots: number;
  unlockCostBase: number;
  unlockCostMultiplier: number;
}

export interface ConsumableItem {
  id: string;
  name: string;
  icon: string;
  heal: number;
  stackMax: number;
}

export interface MaterialItem {
  id: string;
  name: string;
  icon: string;
  stackMax: number;
}

export interface ScrollItem {
  id: string;
  name: string;
  icon: string;
  skill: string;
  stackMax: number;
}

export interface ItemsConfig {
  consumables: ConsumableItem[];
  materials: MaterialItem[];
  scrolls: ScrollItem[];
}

export interface Skill {
  id: string;
  name: string;
  icon: string;
  type: 'attack' | 'heal';
  damageMultiplier?: number;
  damageRand?: number;
  cd: number;
  unlock: string;
  healPercent?: number;
  slow?: number;
  lifesteal?: number;
}

export interface Weapon {
  id: string;
  name: string;
  icon: string;
  atk: number;
  materials: Record<string, number>;
}

export interface Armor {
  id: string;
  name: string;
  icon: string;
  def: number;
  materials: Record<string, number>;
}

export interface EquipmentConfig {
  weapons: Weapon[];
  armors: Armor[];
}

export interface LootEntry {
  itemId: string;
  rate: number;
  minCount: number;
  maxCount: number;
}

export type LootTable = Record<string, LootEntry[]>;

export interface Monster {
  id: string;
  name: string;
  avatar: string;
  hp: number;
  atk: number;
  def: number;
  exp: number;
  gold: number;
  minFloor: number;
  critRate?: number;
  dodgeRate?: number;
}

export interface MonsterInstance {
  id: string;
  name: string;
  avatar: string;
  hp: number;
  maxHP: number;
  atk: number;
  def: number;
  exp: number;
  gold: number;
  critRate: number;
  dodgeRate: number;
}

export interface WorldLore {
  floorRange: [number, number];
  name: string;
  icon: string;
  bgClass: string;
  description: string;
  lore: string;
}

export interface ShopItem {
  itemId: string;
  price: number;
}

export interface NPC {
  id: string;
  name: string;
  avatar: string;
  minFloor: number;
  probability: number;
  greeting: string;
  dialogues: string[];
  shop?: ShopItem[];
  reward?: {
    gold?: number;
    exp?: number;
    itemId?: string;
  };
  blessing?: {
    type: string;
    duration: number;
  };
}

export interface EventOutcome {
  weight: number;
  gold?: number;
  itemId?: string;
}

export interface EventEffect {
  weight: number;
  type: 'heal' | 'gold' | 'exp';
  value: number;
}

export interface RandomEvent {
  id: string;
  name: string;
  icon: string;
  minFloor: number;
  probability: number;
  description: string;
  lore?: string | string[];
  reward?: {
    gold?: number;
    exp?: number;
    itemId?: string;
  };
  outcomes?: EventOutcome[];
  effect?: EventEffect[];
}

export interface GameConfig {
  player: PlayerConfig;
  battle: BattleConfig;
  floor: FloorConfig;
  inventory: InventoryConfig;
  items: ItemsConfig;
  skills: Skill[];
  equipment: EquipmentConfig;
  lootTable: LootTable;
  monsters: Monster[];
  worldLore: WorldLore[];
  npcs: NPC[];
  randomEvents: RandomEvent[];
}

export interface Player {
  level: number;
  hp: number;
  maxHP: number;
  atk: number;
  def: number;
  exp: number;
  maxEXP: number;
  gold: number;
  critRate: number;
  dodgeRate: number;
  weapon: string | null;
  armor: string | null;
  learnedSkills: string[];
  equippedSkills: string[];
  selectedSkill: string | null;
  skillCooldowns: Record<string, number>;
}

export interface InventoryItem {
  id: string;
  count: number;
}

export interface Inventory {
  slots: number;
  items: InventoryItem[];
}

export interface SaveData {
  player: Player;
  floor: number;
  killed: number;
  inventory: Inventory;
  story: StorySaveData;
}

export interface StorySaveData {
  seenLore: string[];
  seenNPCs: string[];
  triggeredEvents: string[];
}
