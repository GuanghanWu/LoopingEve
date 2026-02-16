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
        const baseExpectations = {
            casual: { excitement: 0.4, growth: 0.5, pacing: 0.3, playability: 0.4, retention: 0.6, immersion: 0.3 },
            hardcore: { excitement: 0.9, growth: 0.7, pacing: 0.6, playability: 0.9, retention: 0.4, immersion: 0.2 },
            explorer: { excitement: 0.5, growth: 0.5, pacing: 0.4, playability: 0.7, retention: 0.6, immersion: 0.95 },
            social: { excitement: 0.5, growth: 0.5, pacing: 0.5, playability: 0.5, retention: 0.5, immersion: 0.4 },
            paying: { excitement: 0.6, growth: 0.8, pacing: 0.5, playability: 0.6, retention: 0.6, immersion: 0.3 }
        };
        return baseExpectations[this.type] || baseExpectations.casual;
    }

    initSensitivity() {
        const baseSensitivity = {
            casual: { positive: 0.5, negative: 1.5 },
            hardcore: { positive: 0.8, negative: 0.5 },
            explorer: { positive: 0.7, negative: 1.2 },
            social: { positive: 0.6, negative: 0.8 },
            paying: { positive: 0.6, negative: 0.9 }
        };
        return baseSensitivity[this.type] || baseSensitivity.casual;
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
            
            const expectation = this.expectations.playability;
            let baseDelta = 0.15;
            
            if (expectation > 0.6) {
                baseDelta = 0.08;
            } else if (expectation < 0.5) {
                baseDelta = 0.2;
            }
            
            this.adjustScore('playability', baseDelta, 'newMonster');
            this.addBreakdown('playability', `首次遭遇 ${data.monsterName}`, 'low');
            
            if (this.hasStoryContent || this.hasWorldLore) {
                this.adjustScore('immersion', 0.12 * this.sensitivity.positive, 'loreDiscovery');
            }
        }

        if (data.floor >= 8) {
            this.adjustScore('excitement', 0.15 * this.sensitivity.positive, 'highFloor');
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
                this.adjustScore('retention', -0.12 * this.sensitivity.negative, 'floorStuck');
                this.addBreakdown('retention', '卡关：当前楼层击杀过多', 'medium');
            }

            const baseGrowth = 0.03;
            const adjustedGrowth = baseGrowth * this.sensitivity.positive;
            this.adjustScore('growth', adjustedGrowth, 'battleVictory');

            if (data.monsterId) {
                this.monsterKillCount[data.monsterId] = (this.monsterKillCount[data.monsterId] || 0) + 1;
                if (this.monsterKillCount[data.monsterId] > 10) {
                    const grindPenalty = 0.1 * this.sensitivity.negative;
                    this.adjustScore('playability', -grindPenalty, 'repetitiveMonster');
                    this.addBreakdown('playability', '重复刷同一怪物', 'medium');
                }
            }

            const hpRatio = data.playerHPLeft / 100;
            
            if (hpRatio < 0.2) {
                const coefficient = this.evaluationConfig.battleCoefficients.lowHPVictory;
                const excitementGain = 0.25 * coefficient * this.sensitivity.positive * (1 + this.expectations.excitement);
                this.adjustScore('excitement', excitementGain, 'closeVictory');
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
                this.adjustScore('excitement', 0.30 * this.sensitivity.positive, 'comeback');
                this.addBreakdown('excitement', '逆转局势', 'medium');
            }

            if (data.turns && data.turns === 1) {
                this.adjustScore('excitement', 0.18 * this.sensitivity.positive, 'oneHitKill');
            }

            if (this.winStreak > 3) {
                this.adjustScore('retention', 0.10 * this.sensitivity.positive, 'winStreak');
                this.adjustScore('pacing', 0.06 * this.sensitivity.positive, 'winStreak');
            }

            if (this.skillsUsedInBattle.length >= 3) {
                this.adjustScore('excitement', 0.20 * this.sensitivity.positive, 'skillCombo');
                this.adjustScore('playability', 0.12 * this.sensitivity.positive, 'diversePlaystyle');
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
                this.adjustScore('retention', -0.08 * this.sensitivity.negative, 'noLootStreak');
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
            this.adjustScore('excitement', 0.15 * this.sensitivity.positive, 'lowHPBattle');
        }

        if (data.isCritical) {
            this.consecutiveCritsReceived++;
            
            const hpRatio = data.currentHP / data.maxHP;
            const damageRatio = data.damage / data.maxHP;
            
            if (damageRatio >= 0.15 || hpRatio < 0.3) {
                const severityMultiplier = Math.min(1.5, damageRatio / 0.1);
                const frustrationImpact = 0.15 * this.sensitivity.negative * severityMultiplier;
                
                if (this.personality.frustrationTolerance < 0.5) {
                    this.adjustScore('retention', -frustrationImpact, 'criticalHitReceived');
                    this.addBreakdown('retention', '被暴击导致挫败', 'medium');
                }
            }
            
            if (this.consecutiveCritsReceived > 2 && damageRatio >= 0.1) {
                this.adjustScore('excitement', -0.12 * this.sensitivity.negative, 'criticalFrustration');
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
            this.adjustScore('excitement', 0.08 * this.sensitivity.positive, 'criticalHit');
        }

        if (data.damage > 0 && data.monsterMaxHP && data.damage > data.monsterMaxHP * 0.3) {
            this.adjustScore('excitement', 0.12 * this.sensitivity.positive, 'highDamage');
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
                const skillBonus = 0.15 * coefficient * (1 + this.expectations.playability * 0.3);
                this.adjustScore('playability', skillBonus, 'newSkill');
            }
        }

        this.logEvent('monsterDamage', data);
    }

    onLevelUp(data) {
        const oldLevel = this.stats.level;
        this.stats.level = data.newLevel;
        this.lastUpgradeTime = Date.now();
        this.battlesAtSameLevel = 0;

        const levelBonus = 0.2 * this.sensitivity.positive * (1 + this.expectations.growth * 0.3);
        this.adjustScore('growth', levelBonus, 'levelUp');

        this.adjustScore('growth', 0.10 * this.sensitivity.positive, 'statGain');

        if (this.hasStoryContent) {
            this.adjustScore('immersion', 0.15 * this.sensitivity.positive, 'characterGrowth');
        }

        const now = Date.now();
        if (now - this.lastLevelUpTime < 300000) {
            this.adjustScore('growth', 0.15 * this.sensitivity.positive, 'quickLevelUp');
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
            const discoveryBonus = 0.1 * (1 + this.expectations.playability * 0.2);
            this.adjustScore('playability', discoveryBonus, 'newItem');
            if (this.hasWorldLore) {
                this.adjustScore('immersion', 0.08 * this.sensitivity.positive, 'loreDiscovery');
            }
        }

        const rarityCoefficients = this.evaluationConfig.rarityCoefficients;
        const rarity = data.rarity || 'common';
        const coefficient = rarityCoefficients[rarity] || 1.0;
        const factorName = rarity === 'legendary' ? 'legendaryItem' : (rarity === 'rare' ? 'rareItem' : 'commonItem');
        const baseGrowth = 0.02 * coefficient * this.sensitivity.positive;
        this.adjustScore('growth', baseGrowth, factorName);

        if (rarity === 'legendary') {
            this.adjustScore('retention', 0.20 * this.sensitivity.positive, 'surpriseReward');
            this.addBreakdown('growth', `获得传说物品 ${data.itemName || data.itemId}`, 'high');
        } else if (rarity === 'rare') {
            this.adjustScore('retention', 0.10 * this.sensitivity.positive, 'surpriseReward');
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

        const retentionBonus = 0.15 * this.sensitivity.positive * (1 + this.expectations.retention * 0.2);
        this.adjustScore('retention', retentionBonus, 'newFloor');

        if (this.hasStoryContent || this.hasWorldLore) {
            this.adjustScore('immersion', 0.15 * this.sensitivity.positive, 'newArea');
        }

        if (timeSpent < 180000) {
            this.adjustScore('pacing', 0.10 * this.sensitivity.positive, 'fastFloorProgress');
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

        const deathSensitivity = this.sensitivity.negative * (1 + this.expectations.retention * 0.5);
        const deathPenalty = 0.5 * deathSensitivity;
        this.adjustScore('retention', -deathPenalty, 'death');

        this.adjustScore('growth', -0.20 * this.sensitivity.negative, 'progressLoss');
        this.adjustScore('pacing', -0.15 * this.sensitivity.negative, 'deathInterrupt');

        this.adjustScore('retention', -0.35 * this.sensitivity.negative, 'progressLoss');

        this.lastDeathTime = Date.now();
        this.logEvent('death', data);
    }

    onForgeSuccess(data) {
        this.stats.forgeCount++;
        this.lastUpgradeTime = Date.now();

        this.adjustScore('playability', 0.2 * this.sensitivity.positive, 'forgeSuccess');
        this.adjustScore('growth', 0.15 * this.sensitivity.positive, 'forgeSuccess');
        this.adjustScore('retention', 0.10 * this.sensitivity.positive, 'forgeSuccess');

        this.logEvent('forgeSuccess', data);
        this.addBreakdown('playability', `锻造 ${data.itemName}`, 'medium');
    }

    onLoreDiscovery(data) {
        this.hasWorldLore = true;
        this.hasStoryContent = true;

        const loreBonus = 0.15 * this.sensitivity.positive * (1 + this.expectations.immersion * 0.3);
        this.adjustScore('immersion', loreBonus, 'loreDiscovery');
        this.addBreakdown('immersion', `发现 ${data.areaName}`, 'low');

        this.logEvent('loreDiscovery', data);
    }

    onNPCInteraction(data) {
        this.hasNPCInteraction = true;

        const npcBonus = 0.12 * this.sensitivity.positive * (1 + this.expectations.immersion * 0.3);
        this.adjustScore('immersion', npcBonus, 'npcInteraction');
        this.addBreakdown('immersion', `遇见 ${data.npcName}`, 'low');

        this.logEvent('npcInteraction', data);
    }

    onStoryEvent(data) {
        this.hasStoryContent = true;

        const eventBonus = 0.10 * this.sensitivity.positive * (1 + this.expectations.immersion * 0.2);
        this.adjustScore('immersion', eventBonus, 'storyEvent');
        this.addBreakdown('immersion', `事件: ${data.eventName}`, 'low');

        this.logEvent('storyEvent', data);
    }

    checkUnmetExpectations() {
        const now = Date.now();
        const timeSinceDiscovery = now - this.lastDiscoveryTime;

        if (timeSinceDiscovery > 20000 && this.expectations.playability > 0.6) {
            const unmetPenalty = 0.08 * this.expectations.playability * this.sensitivity.negative;
            this.adjustScore('playability', -unmetPenalty, 'noDiscovery');
        }

        if (this.totalMonsters > 15 && this.seenMonsters.size < 5 && this.expectations.playability > 0.5) {
            const varietyPenalty = 0.15 * this.expectations.playability * this.sensitivity.negative;
            this.adjustScore('playability', -varietyPenalty, 'monsterVarietyLow');
            this.addBreakdown('playability', '怪物种类太少', 'medium');
        }

        if (this.type === 'explorer') {
            const contentRatio = this.seenMonsters.size / Math.max(1, this.totalMonsters);
            if (this.totalMonsters > 30 && contentRatio < 0.05) {
                const grindPenalty = 0.2 * this.sensitivity.negative;
                this.adjustScore('playability', -grindPenalty, 'contentDepleted');
                this.addBreakdown('playability', '内容匮乏，反复刷相同怪物', 'medium');
            }
        }

        if (!this.hasStoryContent) {
            const basePenalty = 0.08;
            const expectationMultiplier = 0.5 + this.expectations.immersion;
            const storyPenalty = basePenalty * expectationMultiplier * this.sensitivity.negative;
            this.adjustScore('immersion', -storyPenalty, 'noStoryContent');
            if (this.expectations.immersion > 0.7 && this.dimensionScores.immersion > 2) {
                this.addBreakdown('immersion', '缺乏剧情和故事背景', 'high');
            }
        }

        if (!this.hasWorldLore) {
            const basePenalty = 0.06;
            const expectationMultiplier = 0.5 + this.expectations.immersion;
            const lorePenalty = basePenalty * expectationMultiplier * this.sensitivity.negative;
            this.adjustScore('immersion', -lorePenalty, 'noWorldLore');
        }

        if (!this.hasNPCInteraction) {
            const basePenalty = 0.05;
            const expectationMultiplier = 0.5 + this.expectations.immersion;
            const npcPenalty = basePenalty * expectationMultiplier * this.sensitivity.negative;
            this.adjustScore('immersion', -npcPenalty, 'noNPCInteraction');
        }

        if (this.expectations.excitement > 0.8) {
            const recentExcitement = this.dimensionScores.excitement;
            if (recentExcitement < 7) {
                const gapPenalty = 0.05 * (this.expectations.excitement - recentExcitement / 10);
                this.adjustScore('excitement', -gapPenalty, 'unmetExpectation');
            }
        }

        if (now - this.lastUpgradeTime > 300000) {
            this.adjustScore('growth', -0.10 * this.sensitivity.negative, 'noUpgrade');
        }

        if (now - this.lastItemTime > 120000) {
            this.adjustScore('growth', -0.08 * this.sensitivity.negative, 'lowDropRate');
        }

        if (this.battlesAtSameLevel > 10) {
            this.adjustScore('growth', -0.12 * this.sensitivity.negative, 'levelStagnation');
            this.addBreakdown('growth', '升级停滞', 'medium');
        }

        if (this.consecutiveEasyWins > 5) {
            this.adjustScore('excitement', -0.08 * this.sensitivity.negative, 'battleTooEasy');
            this.addBreakdown('excitement', '战斗过于简单', 'low');
        }

        if (this.noLowHPBattles > 10) {
            this.adjustScore('excitement', -0.10 * this.sensitivity.negative, 'noThrill');
        }

        if (this.failStreak > 2) {
            this.adjustScore('pacing', -0.12 * this.sensitivity.negative, 'failStreak');
            this.adjustScore('retention', -0.25 * this.sensitivity.negative, 'negativeFeedback');
        }

        if (now - this.floorStartTime > 300000) {
            this.adjustScore('pacing', -0.10 * this.sensitivity.negative, 'progressStall');
        }

        if (this.usedSkills.size > 3) {
            this.adjustScore('playability', 0.12 * this.sensitivity.positive, 'diversePlaystyle');
        }

        if (this.seenMonsters.size > 10) {
            this.adjustScore('playability', 0.10 * this.sensitivity.positive, 'richContent');
        }

        if (this.playTime > 300000 && this.dimensionScores.excitement > 5 && this.hasStoryContent) {
            this.adjustScore('immersion', 0.10 * this.sensitivity.positive, 'immersivePlay');
        }
    }

    adjustScore(dimension, delta, factorName = null) {
        if (!this.dimensionScores.hasOwnProperty(dimension)) return;

        const config = this.evaluationConfig;
        const regularization = config.regularization;

        if (regularization && regularization.enabled && factorName) {
            const isPositive = delta > 0;
            const factors = config.factors[dimension];
            if (factors) {
                const factorConfig = isPositive 
                    ? factors.positive[factorName] 
                    : factors.negative[factorName];
                
                if (factorConfig) {
                    const freqMultiplier = config.frequencyMultipliers[factorConfig.frequency].baseMultiplier;
                    delta = delta * freqMultiplier;
                    
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
                }
            }
        }

        const before = this.dimensionScores[dimension];
        const newScore = Math.max(0, Math.min(10, before + delta));
        this.dimensionScores[dimension] = Math.round(newScore * 100) / 100;
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

        const lossPenalty = 0.15 * this.sensitivity.negative;
        if (this.personality.frustrationTolerance < 0.5) {
            this.adjustScore('retention', -lossPenalty, 'battleFail');
            this.addBreakdown('retention', '战斗失败导致挫败', 'medium');
        }

        this.adjustScore('growth', -0.05 * this.sensitivity.negative, 'battleFail');
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
