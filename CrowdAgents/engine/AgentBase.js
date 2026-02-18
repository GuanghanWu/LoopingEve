class AgentBase {
    constructor(config) {
        this.id = config.id;
        this.name = config.name;
        this.type = config.type;
        this.avatar = config.avatar;
        this.personality = config.personality;
        this.preferences = config.preferences;
        this.behaviorPatterns = config.behaviorPatterns;
        this.skillProfile = config.skillProfile;
        this.specialTraits = config.specialTraits || {};

        this.playTime = 0;
        this.startTime = null;
        this.shouldQuit = false;

        this.stats = {
            battles: 0,
            wins: 0,
            deaths: 0,
            maxFloor: 1,
            level: 1,
            kills: 0,
            totalDamageDealt: 0,
            totalDamageTaken: 0,
            skillsUsed: 0,
            itemsUsed: 0,
            forgeCount: 0
        };

        this.dimensionScores = {
            excitement: 0,
            growth: 0,
            pacing: 0,
            playability: 0,
            retention: 0,
            immersion: 0
        };

        this.expectations = this.initExpectations();
        this.sensitivity = this.initSensitivity();
        this.evaluationConfig = require('../config/evaluation.json');

        this.eventLog = [];
        this.breakdown = [];

        this.seenMonsters = new Set();
        this.usedSkills = new Set();
        this.consecutiveFails = 0;
        this.lastDeathTime = null;
        this.lastUpgradeTime = Date.now();
        this.floorStartTime = Date.now();
        this.battleStartTime = null;
        this.sameActionCount = 0;
        this.lastAction = null;
        this.deathTimes = [];
        this.discoveredItems = new Set();
        this.monsterKillCount = {};
        this.lastDiscoveryTime = Date.now();
        this.lastItemTime = Date.now();
        this.totalMonsters = 0;
        this.hasStoryContent = false;
        this.hasWorldLore = false;
        this.hasNPCInteraction = false;
        this.killsOnCurrentFloor = 0;
        this.battlesWithoutLoot = 0;

        this.winStreak = 0;
        this.failStreak = 0;
        this.consecutiveEasyWins = 0;
        this.noLowHPBattles = 0;
        this.consecutiveCritsReceived = 0;
        this.hitCombo = 0;
        this.skillsUsedInBattle = [];
        this.battleTurns = 0;
        this.wasLowHP = false;
        this.lastLevelUpTime = Date.now();
        this.battlesAtSameLevel = 0;
        this.processedItemIds = new Set();

        this.accumulatedScores = {};
        const dimensions = ['excitement', 'growth', 'pacing', 'playability', 'retention', 'immersion'];
        dimensions.forEach(dim => {
            this.accumulatedScores[dim] = { positive: 0, negative: 0 };
        });

        this.gameAPI = null;
    }

    initExpectations() {
        const defaults = {
            casual: { excitement: 0.4, growth: 0.5, pacing: 0.3, playability: 0.4, retention: 0.6, immersion: 0.3 },
            hardcore: { excitement: 0.9, growth: 0.7, pacing: 0.6, playability: 0.9, retention: 0.4, immersion: 0.2 },
            explorer: { excitement: 0.5, growth: 0.5, pacing: 0.4, playability: 0.7, retention: 0.6, immersion: 0.95 },
            social: { excitement: 0.5, growth: 0.5, pacing: 0.5, playability: 0.5, retention: 0.5, immersion: 0.4 },
            paying: { excitement: 0.6, growth: 0.8, pacing: 0.5, playability: 0.6, retention: 0.6, immersion: 0.3 }
        };
        const base = defaults[this.type] || defaults.casual;
        return {
            excitement: this.preferences?.excitementExpectation ?? base.excitement,
            growth: this.preferences?.growthExpectation ?? base.growth,
            pacing: this.preferences?.pacingExpectation ?? base.pacing,
            playability: this.preferences?.playabilityExpectation ?? base.playability,
            retention: this.preferences?.retentionExpectation ?? base.retention,
            immersion: this.preferences?.immersionExpectation ?? base.immersion
        };
    }

    initSensitivity() {
        const defaults = {
            casual: { positive: 0.5, negative: 1.5 },
            hardcore: { positive: 0.8, negative: 0.5 },
            explorer: { positive: 0.7, negative: 1.2 },
            social: { positive: 0.6, negative: 0.8 },
            paying: { positive: 0.6, negative: 0.9 }
        };
        const base = defaults[this.type] || defaults.casual;
        return {
            positive: this.personality?.positiveSensitivity ?? base.positive,
            negative: this.personality?.negativeSensitivity ?? base.negative
        };
    }

    setGameAPI(gameAPI) {
        this.gameAPI = gameAPI;
    }

    onBattleStart(data) {
        this.stats.battles++;
        this.battleStartTime = Date.now();
        this.skillsUsedInBattle = [];
        this.battleTurns = 0;
        this.wasLowHP = false;
        this.hitCombo = 0;
        this.logEvent('battleStart', data);

        if (!this.seenMonsters.has(data.monsterId)) {
            this.seenMonsters.add(data.monsterId);
            this.lastDiscoveryTime = Date.now();
            
            this.adjustScore('playability', 0.15, 'newMonster');
            this.addBreakdown('playability', `首次遭遇 ${data.monsterName}`, 'low');
            
            if (this.hasStoryContent || this.hasWorldLore) {
                this.adjustScore('immersion', 0.12, 'loreDiscovery');
            }
            
            this.adjustScore('excitement', 0.2, 'firstBlood');
        }

        if (data.floor >= 8) {
            this.adjustScore('excitement', 0.15, 'highFloor');
        }
        
        if (data.isBoss) {
            this.adjustScore('excitement', 0.3, 'bossFight');
            this.addBreakdown('excitement', '遭遇Boss战', 'high');
        }
    }

    onBattleEnd(data) {
        const battleTime = this.battleStartTime ? Date.now() - this.battleStartTime : 0;

        if (data.victory) {
            this.stats.wins++;
            this.stats.kills++;
            this.totalMonsters++;
            this.winStreak++;
            this.failStreak = 0;
            this.battlesAtSameLevel++;
            this.killsOnCurrentFloor++;

            const requiredKills = 3;
            if (this.killsOnCurrentFloor > requiredKills * 10) {
                this.adjustScore('retention', -0.12, 'floorStuck');
                this.addBreakdown('retention', '卡关：当前楼层击杀过多', 'medium');
            }

            this.adjustScore('growth', 0.03, 'battleVictory');

            if (data.monsterId) {
                this.monsterKillCount[data.monsterId] = (this.monsterKillCount[data.monsterId] || 0) + 1;
                if (this.monsterKillCount[data.monsterId] > 10) {
                    this.adjustScore('playability', -0.1, 'repetitiveMonster');
                    this.addBreakdown('playability', '重复刷同一怪物', 'medium');
                }
            }

            const hpRatio = data.playerHPLeft / 100;
            
            if (hpRatio < 0.2) {
                const coefficient = this.evaluationConfig.battleCoefficients.lowHPVictory;
                this.adjustScore('excitement', 0.25 * coefficient, 'closeVictory');
                this.addBreakdown('excitement', '残血胜利的刺激感', 'medium');
            } else if (hpRatio > 0.9) {
                this.consecutiveEasyWins++;
            } else {
                this.consecutiveEasyWins = 0;
            }

            if (hpRatio < 0.3) {
                this.noLowHPBattles = 0;
            } else {
                this.noLowHPBattles++;
            }

            if (this.wasLowHP && hpRatio > 0) {
                this.adjustScore('excitement', 0.30, 'comeback');
                this.addBreakdown('excitement', '逆转局势', 'medium');
            }

            if (data.turns && data.turns === 1) {
                this.adjustScore('excitement', 0.18, 'oneHitKill');
            }

            if (this.winStreak > 3) {
                this.adjustScore('retention', 0.10, 'winStreak');
                this.adjustScore('pacing', 0.06, 'winStreak');
            }

            if (this.skillsUsedInBattle.length >= 3) {
                this.adjustScore('excitement', 0.20, 'skillCombo');
                this.adjustScore('playability', 0.12, 'diversePlaystyle');
            }

            if (battleTime < 10000) {
                const coefficient = this.evaluationConfig.battleCoefficients.quickBattle;
                this.adjustScore('pacing', 0.03 * coefficient, 'quickBattle');
            } else if (battleTime > 30000) {
                this.adjustScore('pacing', -0.08, 'battleTooLong');
                this.adjustScore('excitement', -0.08, 'battleDrag');
            }

            if (battleTime >= 5000 && battleTime <= 15000) {
                this.adjustScore('pacing', 0.08, 'idealBattleTime');
            }

            this.consecutiveFails = 0;

            this.battlesWithoutLoot++;
            if (this.battlesWithoutLoot >= 5) {
                this.adjustScore('retention', -0.08, 'noLootStreak');
                this.addBreakdown('retention', '连续多场战斗无掉落', 'medium');
            }
        } else {
            this.handleLoss(data);
        }

        this.logEvent('battleEnd', { ...data, battleTime });
    }

    onPlayerDamage(data) {
        this.stats.totalDamageTaken += data.damage;
        const hpRatio = data.currentHP / data.maxHP;
        this.hitCombo = 0;

        if (hpRatio < 0.3) {
            this.adjustScore('excitement', 0.1, 'lowHPBattle');
            this.wasLowHP = true;
        }

        if (hpRatio < 0.15) {
            this.adjustScore('excitement', 0.15, 'lowHPBattle');
        }

        if (data.dodged) {
            this.adjustScore('excitement', 0.15, 'perfectDodge');
            this.addBreakdown('excitement', '完美闪避', 'low');
        }

        if (data.isCritical) {
            this.consecutiveCritsReceived++;
            
            const hpRatio = data.currentHP / data.maxHP;
            const damageRatio = data.damage / data.maxHP;
            
            if (damageRatio >= 0.15 || hpRatio < 0.3) {
                if (this.personality.frustrationTolerance < 0.5) {
                    this.adjustScore('retention', -0.15, 'criticalHitReceived');
                    this.addBreakdown('retention', '被暴击导致挫败', 'medium');
                }
            }
            
            if (this.consecutiveCritsReceived > 2 && damageRatio >= 0.1) {
                this.adjustScore('excitement', -0.12, 'criticalFrustration');
                this.addBreakdown('excitement', '连续被暴击', 'low');
            }
        } else {
            this.consecutiveCritsReceived = 0;
        }

        this.logEvent('playerDamage', data);
    }

    onMonsterDamage(data) {
        this.stats.totalDamageDealt += data.damage;
        this.hitCombo++;
        this.battleTurns++;

        if (data.isCritical) {
            this.adjustScore('excitement', 0.08, 'criticalHit');
        }

        if (data.damage > 0 && data.monsterMaxHP && data.damage > data.monsterMaxHP * 0.3) {
            this.adjustScore('excitement', 0.12, 'highDamage');
        }

        if (this.hitCombo > 3) {
            this.adjustScore('excitement', 0.05, 'combo');
        }

        if (data.skillUsed && data.skillUsed !== 'attack') {
            if (!this.skillsUsedInBattle.includes(data.skillUsed)) {
                this.skillsUsedInBattle.push(data.skillUsed);
            }
            if (!this.usedSkills.has(data.skillUsed)) {
                this.usedSkills.add(data.skillUsed);
                const coefficient = this.evaluationConfig.skillCoefficients.firstUse;
                this.adjustScore('playability', 0.15 * coefficient, 'newSkill');
            }
        }

        this.logEvent('monsterDamage', data);
    }

    onLevelUp(data) {
        const oldLevel = this.stats.level;
        this.stats.level = data.newLevel;
        this.lastUpgradeTime = Date.now();
        this.battlesAtSameLevel = 0;

        this.adjustScore('growth', 0.2, 'levelUp');

        this.adjustScore('growth', 0.10, 'statGain');

        if (this.hasStoryContent) {
            this.adjustScore('immersion', 0.15, 'characterGrowth');
        }

        const now = Date.now();
        if (now - this.lastLevelUpTime < 300000) {
            this.adjustScore('growth', 0.15, 'quickLevelUp');
            this.addBreakdown('growth', '连续升级', 'medium');
        }
        this.lastLevelUpTime = now;

        this.logEvent('levelUp', data);
        this.addBreakdown('growth', `升级到 ${data.newLevel} 级`, 'medium');
    }

    onItemObtain(data) {
        const itemKey = `${data.itemId}_${Date.now()}`;
        if (this.processedItemIds.has(data.itemId) && data.source === 'battle') {
            return;
        }

        this.lastItemTime = Date.now();
        this.battlesWithoutLoot = 0;

        if (!this.discoveredItems.has(data.itemId)) {
            this.discoveredItems.add(data.itemId);
            this.lastDiscoveryTime = Date.now();
            this.adjustScore('playability', 0.1, 'newItem');
            if (this.hasWorldLore) {
                this.adjustScore('immersion', 0.08, 'loreDiscovery');
            }
        }

        const rarityCoefficients = this.evaluationConfig.rarityCoefficients;
        const rarity = data.rarity || 'common';
        const coefficient = rarityCoefficients[rarity] || 1.0;
        const factorName = rarity === 'legendary' ? 'legendaryItem' : (rarity === 'rare' ? 'rareItem' : 'commonItem');
        this.adjustScore('growth', 0.02 * coefficient, factorName);

        if (rarity === 'legendary') {
            this.adjustScore('retention', 0.20, 'surpriseReward');
            this.addBreakdown('growth', `获得传说物品 ${data.itemName || data.itemId}`, 'high');
        } else if (rarity === 'rare') {
            this.adjustScore('retention', 0.10, 'surpriseReward');
        }

        this.processedItemIds.add(data.itemId);
        setTimeout(() => {
            this.processedItemIds.delete(data.itemId);
        }, 1000);

        this.logEvent('itemObtain', data);
    }

    onItemUse(data) {
        this.stats.itemsUsed++;
        this.logEvent('itemUse', data);
    }

    onSkillUse(data) {
        this.stats.skillsUsed++;

        if (this.lastAction === `skill_${data.skillId}`) {
            this.sameActionCount++;
            if (this.sameActionCount > 5) {
                this.adjustScore('playability', -0.08, 'skillMonotony');
                this.adjustScore('excitement', -0.05, 'repetitiveSkill');
            }
        } else {
            this.sameActionCount = 1;
            this.lastAction = `skill_${data.skillId}`;
        }

        const coefficient = this.usedSkills.has(data.skillId) 
            ? this.evaluationConfig.skillCoefficients.repeatUse 
            : this.evaluationConfig.skillCoefficients.firstUse;
        
        this.adjustScore('playability', 0.05 * coefficient, 'skillUse');

        this.logEvent('skillUse', data);
    }

    onFloorAdvance(data) {
        const timeSpent = this.floorStartTime ? Date.now() - this.floorStartTime : 0;
        this.stats.maxFloor = Math.max(this.stats.maxFloor, data.newFloor);
        this.winStreak = 0;
        this.killsOnCurrentFloor = 0;

        this.adjustScore('retention', 0.15, 'newFloor');

        if (this.hasStoryContent || this.hasWorldLore) {
            this.adjustScore('immersion', 0.15, 'newArea');
        }

        if (timeSpent < 180000) {
            this.adjustScore('pacing', 0.10, 'fastFloorProgress');
        } else if (timeSpent > 300000) {
            this.adjustScore('pacing', -0.10, 'floorTooSlow');
        }

        this.adjustScore('pacing', 0.05, 'progressVisible');

        this.floorStartTime = Date.now();
        this.logEvent('floorAdvance', { ...data, timeSpent });
        this.addBreakdown('retention', `推进到第 ${data.newFloor} 层`, 'medium');
    }

    onPlayerDeath(data) {
        this.stats.deaths++;
        this.winStreak = 0;
        this.failStreak++;

        this.adjustScore('retention', -0.5, 'death');

        this.adjustScore('growth', -0.20, 'progressLoss');
        this.adjustScore('pacing', -0.15, 'deathInterrupt');

        this.adjustScore('retention', -0.35, 'progressLoss');

        this.lastDeathTime = Date.now();
        this.logEvent('death', data);
    }

    onForgeSuccess(data) {
        this.stats.forgeCount++;
        this.lastUpgradeTime = Date.now();

        this.adjustScore('playability', 0.2, 'forgeSuccess');
        this.adjustScore('growth', 0.15, 'forgeSuccess');
        this.adjustScore('retention', 0.10, 'forgeSuccess');

        this.logEvent('forgeSuccess', data);
        this.addBreakdown('playability', `锻造 ${data.itemName}`, 'medium');
    }

    onLoreDiscovery(data) {
        this.hasWorldLore = true;
        this.hasStoryContent = true;

        this.adjustScore('immersion', 0.15, 'loreDiscovery');
        this.addBreakdown('immersion', `发现 ${data.areaName}`, 'low');

        this.logEvent('loreDiscovery', data);
    }

    onNPCInteraction(data) {
        this.hasNPCInteraction = true;

        this.adjustScore('immersion', 0.12, 'npcInteraction');
        this.addBreakdown('immersion', `遇见 ${data.npcName}`, 'low');

        this.logEvent('npcInteraction', data);
    }

    onStoryEvent(data) {
        this.hasStoryContent = true;

        this.adjustScore('immersion', 0.10, 'storyEvent');
        this.addBreakdown('immersion', `事件: ${data.eventName}`, 'low');

        this.logEvent('storyEvent', data);
    }

    checkUnmetExpectations() {
        const now = Date.now();
        const timeSinceDiscovery = now - this.lastDiscoveryTime;

        if (timeSinceDiscovery > 20000) {
            this.adjustScore('playability', -0.08, 'noDiscovery');
        }

        if (this.totalMonsters > 15 && this.seenMonsters.size < 5) {
            this.adjustScore('playability', -0.15, 'monsterVarietyLow');
            this.addBreakdown('playability', '怪物种类太少', 'medium');
        }

        if (this.type === 'explorer') {
            const contentRatio = this.seenMonsters.size / Math.max(1, this.totalMonsters);
            if (this.totalMonsters > 30 && contentRatio < 0.05) {
                this.adjustScore('playability', -0.2, 'contentDepleted');
                this.addBreakdown('playability', '内容匮乏，反复刷相同怪物', 'medium');
            }
        }

        if (!this.hasStoryContent) {
            this.adjustScore('immersion', -0.08, 'noStoryContent');
            if (this.expectations.immersion > 0.7 && this.dimensionScores.immersion > 2) {
                this.addBreakdown('immersion', '缺乏剧情和故事背景', 'high');
            }
        }

        if (!this.hasWorldLore) {
            this.adjustScore('immersion', -0.06, 'noWorldLore');
        }

        if (!this.hasNPCInteraction) {
            this.adjustScore('immersion', -0.05, 'noNPCInteraction');
        }

        if (this.expectations.excitement > 0.8) {
            const recentExcitement = this.dimensionScores.excitement;
            if (recentExcitement < 7) {
                const gapPenalty = 0.05 * (this.expectations.excitement - recentExcitement / 10);
                this.adjustScore('excitement', -gapPenalty, 'unmetExpectation');
            }
        }

        if (now - this.lastUpgradeTime > 300000) {
            this.adjustScore('growth', -0.10, 'noUpgrade');
        }

        if (now - this.lastItemTime > 120000) {
            this.adjustScore('growth', -0.08, 'lowDropRate');
        }

        if (this.battlesAtSameLevel > 10) {
            this.adjustScore('growth', -0.12, 'levelStagnation');
            this.addBreakdown('growth', '升级停滞', 'medium');
        }

        if (this.consecutiveEasyWins > 5) {
            this.adjustScore('excitement', -0.08, 'battleTooEasy');
            this.addBreakdown('excitement', '战斗过于简单', 'low');
        }

        if (this.noLowHPBattles > 10) {
            this.adjustScore('excitement', -0.10, 'noThrill');
        }

        if (this.failStreak > 2) {
            this.adjustScore('pacing', -0.12, 'failStreak');
            this.adjustScore('retention', -0.25, 'negativeFeedback');
        }

        if (now - this.floorStartTime > 300000) {
            this.adjustScore('pacing', -0.10, 'progressStall');
        }

        if (this.usedSkills.size > 3) {
            this.adjustScore('playability', 0.12, 'diversePlaystyle');
        }

        if (this.seenMonsters.size > 10) {
            this.adjustScore('playability', 0.10, 'richContent');
        }

        if (this.playTime > 300000 && this.dimensionScores.excitement > 5 && this.hasStoryContent) {
            this.adjustScore('immersion', 0.10, 'immersivePlay');
        }
    }

    adjustScore(dimension, delta, factorName = null, context = {}) {
        if (!this.dimensionScores.hasOwnProperty(dimension)) return;

        const config = this.evaluationConfig;
        const regularization = config.regularization;
        const factorRules = config.factorRules;

        if (regularization && regularization.enabled && factorName) {
            const isPositive = delta > 0;
            const factors = config.factors[dimension];
            if (factors) {
                const factorConfig = isPositive 
                    ? factors.positive[factorName] 
                    : factors.negative[factorName];
                
                if (factorConfig) {
                    let baseScore = factorConfig.baseScore;
                    if (factorRules && factorRules.baseScoreTiers) {
                        const tier = this.calculateScoreTier(context, factorName);
                        baseScore = factorRules.baseScoreTiers[tier] || baseScore;
                    }
                    
                    const freqMultiplier = config.frequencyMultipliers[factorConfig.frequency].baseMultiplier;
                    
                    let dynamicMultiplier = 1.0;
                    if (factorRules && factorRules.multiplierByFrequency) {
                        const triggerCount = this.getFactorTriggerCount(dimension, factorName, isPositive);
                        const multipliers = factorRules.multiplierByFrequency[factorConfig.frequency];
                        if (multipliers && multipliers.length > 0) {
                            const index = Math.min(triggerCount, multipliers.length - 1);
                            dynamicMultiplier = multipliers[index];
                        }
                    }
                    
                    const sensitivityMod = this.calculateSensitivityModifier(dimension, isPositive);
                    const expectationMod = this.calculateExpectationModifier(dimension);
                    
                    delta = baseScore * freqMultiplier * dynamicMultiplier * sensitivityMod * expectationMod * (isPositive ? 1 : -1);
                    
                    const accumulatedKey = isPositive ? 'positive' : 'negative';
                    const currentAccumulated = this.accumulatedScores[dimension][accumulatedKey];
                    const maxAccumulated = factorConfig.maxAccumulated;
                    
                    if (currentAccumulated + Math.abs(delta) > maxAccumulated) {
                        const remaining = maxAccumulated - currentAccumulated;
                        if (remaining <= 0) {
                            return;
                        }
                        delta = isPositive ? remaining : -remaining;
                    }
                    
                    this.accumulatedScores[dimension][accumulatedKey] += Math.abs(delta);
                    
                    this.recordFactorTrigger(dimension, factorName, isPositive);
                }
            }
        }

        const before = this.dimensionScores[dimension];
        const newScore = Math.max(0, Math.min(10, before + delta));
        this.dimensionScores[dimension] = Math.round(newScore * 100) / 100;
    }

    calculateSensitivityModifier(dimension, isPositive) {
        const sensitivity = isPositive ? this.sensitivity.positive : this.sensitivity.negative;
        const clampedSensitivity = Math.max(0.5, Math.min(1.5, sensitivity));
        return clampedSensitivity;
    }

    calculateExpectationModifier(dimension) {
        const expectation = this.expectations[dimension] || 0.5;
        const clampedExpectation = Math.max(0.5, Math.min(1.5, expectation));
        return clampedExpectation;
    }

    // 计算分数层级（S, A, B, C, D）
    calculateScoreTier(context, factorName) {
        // 优先使用传入的context，如果没有则从Agent状态中推断
        const ctx = context || this.inferContextFromState(factorName);
        const { damage, hpRatio, turns, isCritical, isBoss, floor, rarity, skillCount } = ctx;
        
        // 刺激度相关
        if (factorName.includes('Victory') || factorName.includes('Kill')) {
            if (hpRatio < 0.1) return 'S';
            if (hpRatio < 0.2) return 'A';
            if (hpRatio < 0.3) return 'B';
            if (hpRatio < 0.5) return 'C';
            return 'D';
        }
        
        // 伤害相关
        if (factorName.includes('Damage') || factorName.includes('Hit')) {
            if (damage > 50) return 'S';
            if (damage > 30) return 'A';
            if (damage > 20) return 'B';
            if (damage > 10) return 'C';
            return 'D';
        }
        
        // 战斗时长相关
        if (factorName.includes('Battle')) {
            if (turns && turns <= 1) return 'S';
            if (turns && turns <= 3) return 'A';
            if (turns && turns <= 5) return 'B';
            if (turns && turns <= 8) return 'C';
            return 'D';
        }
        
        // 物品稀有度
        if (factorName.includes('Item')) {
            if (rarity === 'legendary') return 'S';
            if (rarity === 'rare') return 'A';
            if (rarity === 'uncommon') return 'B';
            return 'C';
        }
        
        // 技能使用
        if (factorName.includes('Skill')) {
            if (skillCount >= 5) return 'S';
            if (skillCount >= 3) return 'A';
            if (skillCount >= 2) return 'B';
            return 'C';
        }
        
        // 楼层相关
        if (factorName.includes('Floor')) {
            if (floor >= 15) return 'S';
            if (floor >= 10) return 'A';
            if (floor >= 7) return 'B';
            if (floor >= 5) return 'C';
            return 'D';
        }
        
        // Boss相关
        if (factorName.includes('Boss')) {
            return isBoss ? 'S' : 'C';
        }
        
        // 默认返回B级
        return 'B';
    }
    
    // 从Agent状态中推断context
    inferContextFromState(factorName) {
        const ctx = {};
        
        // 推断楼层
        ctx.floor = this.stats.maxFloor;
        
        // 推断技能数量
        ctx.skillCount = this.skillsUsedInBattle.length;
        
        // 推断战斗回合数
        ctx.turns = this.battleTurns;
        
        // 推断是否低血量
        ctx.hpRatio = this.wasLowHP ? 0.2 : 0.8;
        
        return ctx;
    }

    // 获取因子触发次数
    getFactorTriggerCount(dimension, factorName, isPositive) {
        if (!this.factorTriggerCounts) {
            this.factorTriggerCounts = {};
        }
        const key = `${dimension}_${factorName}_${isPositive ? 'pos' : 'neg'}`;
        return this.factorTriggerCounts[key] || 0;
    }

    // 记录因子触发
    recordFactorTrigger(dimension, factorName, isPositive) {
        if (!this.factorTriggerCounts) {
            this.factorTriggerCounts = {};
        }
        const key = `${dimension}_${factorName}_${isPositive ? 'pos' : 'neg'}`;
        this.factorTriggerCounts[key] = (this.factorTriggerCounts[key] || 0) + 1;
    }

    logEvent(type, data) {
        this.eventLog.push({
            type,
            data,
            time: this.playTime,
            timestamp: Date.now()
        });

        if (this.eventLog.length > 100) {
            this.eventLog = this.eventLog.slice(-100);
        }
    }

    addBreakdown(dimension, issue, severity) {
        const existing = this.breakdown.find(b => b.dimension === dimension && b.issue === issue);
        if (existing) {
            existing.count++;
        } else {
            this.breakdown.push({ dimension, issue, severity, count: 1 });
        }
    }

    handleLoss(data) {
        this.consecutiveFails++;
        this.winStreak = 0;
        this.failStreak++;

        if (this.personality.frustrationTolerance < 0.5) {
            this.adjustScore('retention', -0.15, 'battleFail');
            this.addBreakdown('retention', '战斗失败导致挫败', 'medium');
        }

        this.adjustScore('growth', -0.05, 'battleFail');
    }

    decide(gameState) {
        return 'attack';
    }

    async simulatePlay(duration, tickInterval = 100) {
        this.startTime = Date.now();
        const endTime = this.startTime + duration;

        while (Date.now() < endTime && !this.shouldQuit) {
            this.playTime = Date.now() - this.startTime;

            if (Date.now() - this.lastUpgradeTime > 300000) {
                this.adjustScore('growth', -0.1, 'noUpgrade');
            }

            this.checkUnmetExpectations();

            await this.tick();
            await this.sleep(tickInterval);
        }

        return this.getReport();
    }

    async tick() {
        if (!this.gameAPI) return;

        const gameState = this.gameAPI.getState();
        if (!gameState) return;

        const action = this.decide(gameState);
        await this.executeAction(action, gameState);
    }

    async executeAction(action, gameState) {
        if (typeof action === 'string') {
            switch (action) {
                case 'attack':
                    this.gameAPI.attack();
                    break;
                case 'explore':
                    this.gameAPI.explore();
                    break;
                case 'usePotion':
                    this.gameAPI.usePotion();
                    break;
                case 'defend':
                    break;
                case 'nextFloor':
                    this.gameAPI.nextFloor();
                    break;
            }
        } else if (typeof action === 'object') {
            switch (action.action) {
                case 'useSkill':
                    this.gameAPI.useSkill(action.skillId);
                    break;
                case 'useItem':
                    this.gameAPI.useItem(action.itemId);
                    break;
            }
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getReport() {
        const formattedScores = {};
        Object.entries(this.dimensionScores).forEach(([dim, score]) => {
            formattedScores[dim] = parseFloat(score.toFixed(2));
        });

        return {
            id: this.id,
            name: this.name,
            type: this.type,
            avatar: this.avatar,
            playTime: this.playTime,
            stats: { ...this.stats },
            dimensionScores: formattedScores,
            overallScore: this.calculateOverallScore(),
            breakdown: this.breakdown,
            events: this.eventLog.slice(-20)
        };
    }

    calculateOverallScore() {
        const evaluationConfig = require('../config/evaluation.json');
        const weights = evaluationConfig.agentWeights[this.type] || {};
        let sum = 0;
        let weightSum = 0;

        for (const [dim, score] of Object.entries(this.dimensionScores)) {
            const w = weights[dim] || 1;
            sum += score * w;
            weightSum += w;
        }

        return weightSum > 0 ? parseFloat((sum / weightSum).toFixed(2)) : 5.0;
    }

    getGameState() {
        return this.gameAPI ? this.gameAPI.getState() : null;
    }

    hasPotion(gameState) {
        if (!gameState || !gameState.inventory) return false;
        return gameState.inventory.items.some(item => {
            const consumables = require('../../config.json').items.consumables;
            const def = consumables.find(c => c.id === item.id);
            return def && def.heal;
        });
    }

    getAvailableSkills(gameState) {
        if (!gameState || !gameState.player) return [];
        const skills = gameState.player.equippedSkills || [];
        const cooldowns = gameState.player.skillCooldowns || {};
        return skills.filter(skillId => !cooldowns[skillId] || cooldowns[skillId] === 0);
    }
}

module.exports = AgentBase;
