class StoryManager {
    constructor(game) {
        this.game = game;
        this.seenLore = new Set();
        this.seenNPCs = new Set();
        this.triggeredEvents = new Set();
    }

    getWorldLore(floor) {
        const loreList = CONFIG.worldLore;
        for (const lore of loreList) {
            if (floor >= lore.floorRange[0] && floor <= lore.floorRange[1]) {
                return lore;
            }
        }
        return loreList[0];
    }

    onFloorAdvance(newFloor, oldFloor) {
        const lore = this.getWorldLore(newFloor);
        const loreKey = `floor_${newFloor}`;
        const isFirstVisit = !this.seenLore.has(loreKey);
        
        if (isFirstVisit) {
            this.seenLore.add(loreKey);
            return { type: 'lore', data: lore, floor: newFloor };
        }
        return null;
    }

    checkNPC(floor) {
        const npcs = CONFIG.npcs;
        const availableNPCs = npcs.filter(npc => 
            floor >= npc.minFloor && 
            !this.seenNPCs.has(`${npc.id}_${floor}`)
        );
        
        for (const npc of availableNPCs) {
            if (Math.random() < npc.probability) {
                this.seenNPCs.add(`${npc.id}_${floor}`);
                return { type: 'npc', data: npc };
            }
        }
        return null;
    }

    checkRandomEvent(floor) {
        const events = CONFIG.randomEvents;
        const availableEvents = events.filter(event => 
            floor >= event.minFloor
        );
        
        for (const event of availableEvents) {
            const eventKey = `${event.id}_${Date.now()}`;
            if (Math.random() < event.probability) {
                this.triggeredEvents.add(eventKey);
                return { type: 'event', data: event };
            }
        }
        return null;
    }

    processEventReward(event) {
        const reward = event.reward;
        const outcomes = event.outcomes;
        const effects = event.effect;
        
        let result = { gold: 0, exp: 0, items: [], heal: 0, lore: null };
        
        if (reward) {
            if (reward.gold) result.gold = reward.gold;
            if (reward.exp) result.exp = reward.exp;
            if (reward.itemId) {
                result.items.push({ itemId: reward.itemId, count: 1 });
            }
        }
        
        if (outcomes && outcomes.length > 0) {
            const totalWeight = outcomes.reduce((sum, o) => sum + o.weight, 0);
            let random = Math.random() * totalWeight;
            for (const outcome of outcomes) {
                random -= outcome.weight;
                if (random <= 0) {
                    if (outcome.gold) result.gold = outcome.gold;
                    if (outcome.itemId) {
                        result.items.push({ itemId: outcome.itemId, count: 1 });
                    }
                    break;
                }
            }
        }
        
        if (effects && effects.length > 0) {
            const totalWeight = effects.reduce((sum, e) => sum + e.weight, 0);
            let random = Math.random() * totalWeight;
            for (const effect of effects) {
                random -= effect.weight;
                if (random <= 0) {
                    if (effect.type === 'heal') result.heal = effect.value;
                    if (effect.type === 'gold') result.gold = effect.value;
                    if (effect.type === 'exp') result.exp = effect.value;
                    break;
                }
            }
        }
        
        if (event.lore) {
            if (Array.isArray(event.lore)) {
                result.lore = event.lore[Math.floor(Math.random() * event.lore.length)];
            } else {
                result.lore = event.lore;
            }
        }
        
        return result;
    }

    processNPCReward(npc) {
        const reward = npc.reward;
        let result = { gold: 0, exp: 0, items: [] };
        
        if (reward) {
            if (reward.gold) result.gold = reward.gold;
            if (reward.exp) result.exp = reward.exp;
            if (reward.itemId) {
                result.items.push({ itemId: reward.itemId, count: 1 });
            }
        }
        
        return result;
    }

    applyReward(result) {
        if (result.gold && result.gold > 0) {
            this.game.player.gold += result.gold;
        }
        if (result.exp && result.exp > 0) {
            this.game.player.exp += result.exp;
            this.game.playerManager.levelUp();
        }
        if (result.items && result.items.length > 0) {
            result.items.forEach(item => {
                this.game.inventoryManager.addItem(item.itemId, item.count);
            });
        }
        if (result.heal && result.heal > 0) {
            const actualHeal = Math.min(result.heal, this.game.player.maxHP - this.game.player.hp);
            this.game.player.hp += actualHeal;
        }
    }

    getNPCDialogue(npc) {
        if (npc.dialogues && npc.dialogues.length > 0) {
            return npc.dialogues[Math.floor(Math.random() * npc.dialogues.length)];
        }
        return npc.greeting;
    }

    hasStoryContent() {
        return this.seenLore.size > 0;
    }

    hasWorldLore() {
        return true;
    }

    hasNPCInteraction() {
        return this.seenNPCs.size > 0;
    }

    reset() {
        this.seenLore.clear();
        this.seenNPCs.clear();
        this.triggeredEvents.clear();
    }

    save() {
        return {
            seenLore: Array.from(this.seenLore),
            seenNPCs: Array.from(this.seenNPCs)
        };
    }

    load(data) {
        if (data) {
            this.seenLore = new Set(data.seenLore || []);
            this.seenNPCs = new Set(data.seenNPCs || []);
        }
    }
}
