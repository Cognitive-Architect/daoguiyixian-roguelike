/**
 * UpgradeManager.ts
 * Roguelike升级系统 - 核心成长循环
 * 
 * 核心要求：
 * - 加权随机：普通60%/稀有30%/史诗10%
 * - 避免连续同类型（上次攻击下次攻击权重降至20%）
 * - 效果应用：直接修改PlayerData属性
 * 
 * DEBT-B04-001: UI动画用FadeIn（无Card Fly-in）
 * DEBT-B04-002: 暂时单机（无联机同步）
 */

import { EventBus, GameEvents } from '../core/EventBus';
import { Random, globalRandom } from '../core/Random';
import { gameManager } from '../core/GameManager';

export type UpgradeRarity = 'common' | 'rare' | 'epic';

export interface UpgradeEffect {
    type: string;
    value?: number;
    operation?: 'add' | 'multiply';
    [key: string]: any;
}

export interface UpgradeData {
    id: string;
    name: string;
    description: string;
    rarity: UpgradeRarity;
    effect: UpgradeEffect;
    maxStacks: number;
    unlockCondition?: string;
    requirement?: string;
    restriction?: string;
}

export interface PlayerUpgrade {
    upgradeId: string;
    stacks: number;
}

export interface UpgradeConfig {
    upgrades: UpgradeData[];
    rarityWeights: Record<UpgradeRarity, number>;
    selectionCount: number;
    avoidDuplicateRarity: boolean;
    duplicateRarityPenalty: number;
}

export class UpgradeManager {
    private static instance: UpgradeManager;
    private eventBus: EventBus;
    private random: Random;
    
    // 配置
    private config: UpgradeConfig | null = null;
    private upgradeMap: Map<string, UpgradeData> = new Map();
    
    // 玩家升级记录
    private playerUpgrades: Map<string, PlayerUpgrade> = new Map();
    
    // 上次选择的稀有度（用于避免重复）
    private lastSelectedRarity: UpgradeRarity | null = null;
    
    // 经验系统
    private currentExp: number = 0;
    private expToNextLevel: number = 100;
    private level: number = 1;
    private expCurve: number = 1.2;

    private constructor() {
        this.eventBus = EventBus.getInstance();
        this.random = globalRandom;
    }

    public static getInstance(): UpgradeManager {
        if (!UpgradeManager.instance) {
            UpgradeManager.instance = new UpgradeManager();
        }
        return UpgradeManager.instance;
    }

    /**
     * 加载配置
     */
    public loadConfig(config: UpgradeConfig): void {
        this.config = config;
        this.upgradeMap.clear();
        
        for (const upgrade of config.upgrades) {
            this.upgradeMap.set(upgrade.id, upgrade);
        }
        
        console.log(`[UpgradeManager] Loaded ${config.upgrades.length} upgrades`);
    }

    /**
     * 从JSON加载配置
     */
    public async loadConfigFromJson(jsonPath: string): Promise<void> {
        try {
            const response = await fetch(jsonPath);
            const config = await response.json();
            this.loadConfig(config);
        } catch (error) {
            console.error('[UpgradeManager] Failed to load config:', error);
        }
    }

    /**
     * 初始化
     */
    public initialize(): void {
        this.currentExp = 0;
        this.level = 1;
        this.expToNextLevel = 100;
        this.playerUpgrades.clear();
        this.lastSelectedRarity = null;
    }

    /**
     * 更新经验
     */
    public addExp(amount: number): void {
        this.currentExp += amount;
        
        // 检查升级
        while (this.currentExp >= this.expToNextLevel) {
            this.currentExp -= this.expToNextLevel;
            this.levelUp();
        }
        
        this.eventBus.emit('exp:change', {
            current: this.currentExp,
            required: this.expToNextLevel,
            level: this.level,
        });
    }

    /**
     * 升级
     */
    private levelUp(): void {
        this.level++;
        this.expToNextLevel = Math.floor(this.expToNextLevel * this.expCurve);
        
        console.log(`[UpgradeManager] Level up! Now level ${this.level}`);
        
        this.eventBus.emit(GameEvents.LEVEL_UP, { level: this.level });
        
        // 显示升级选择
        this.showUpgradeSelection();
    }

    /**
     * 显示升级选择
     */
    private showUpgradeSelection(): void {
        const options = this.generateUpgradeOptions();
        
        // 暂停游戏
        gameManager.pause();
        
        // 发送UI事件
        this.eventBus.emit(GameEvents.UI_SHOW_UPGRADE, { options });
    }

    /**
     * 生成升级选项
     */
    public generateUpgradeOptions(): UpgradeData[] {
        if (!this.config) return [];
        
        const options: UpgradeData[] = [];
        const usedRarities = new Set<UpgradeRarity>();
        
        // 获取可用升级
        const availableUpgrades = this.getAvailableUpgrades();
        
        while (options.length < this.config.selectionCount && availableUpgrades.length > 0) {
            // 计算权重
            const weights = availableUpgrades.map(u => this.calculateWeight(u, usedRarities));
            
            // 加权随机选择
            const selected = this.random.weightedChoice(availableUpgrades, weights);
            
            if (selected) {
                options.push(selected);
                usedRarities.add(selected.rarity);
                
                // 从可用列表中移除
                const index = availableUpgrades.indexOf(selected);
                availableUpgrades.splice(index, 1);
            } else {
                break;
            }
        }
        
        return options;
    }

    /**
     * 获取可用升级
     */
    private getAvailableUpgrades(): UpgradeData[] {
        if (!this.config) return [];
        
        return this.config.upgrades.filter(upgrade => {
            // 检查是否达到最大层数
            const playerUpgrade = this.playerUpgrades.get(upgrade.id);
            if (playerUpgrade && playerUpgrade.stacks >= upgrade.maxStacks) {
                return false;
            }
            
            // 检查解锁条件
            if (upgrade.unlockCondition && !this.checkUnlockCondition(upgrade.unlockCondition)) {
                return false;
            }
            
            // 检查前置要求
            if (upgrade.requirement && !this.checkRequirement(upgrade.requirement)) {
                return false;
            }
            
            // 检查互斥
            if (upgrade.restriction && !this.checkRestriction(upgrade.restriction)) {
                return false;
            }
            
            return true;
        });
    }

    /**
     * 计算升级权重
     */
    private calculateWeight(upgrade: UpgradeData, usedRarities: Set<UpgradeRarity>): number {
        if (!this.config) return 0;
        
        let weight = this.config.rarityWeights[upgrade.rarity];
        
        // 避免重复稀有度
        if (this.config.avoidDuplicateRarity && usedRarities.has(upgrade.rarity)) {
            weight *= this.config.duplicateRarityPenalty;
        }
        
        // 上次选择的稀有度惩罚
        if (upgrade.rarity === this.lastSelectedRarity) {
            weight *= 0.5;
        }
        
        return weight;
    }

    /**
     * 检查解锁条件
     */
    private checkUnlockCondition(condition: string): boolean {
        // TODO: 实现解锁条件检查
        return true;
    }

    /**
     * 检查前置要求
     */
    private checkRequirement(requirement: string): boolean {
        // 检查是否拥有前置升级
        const upgrade = this.playerUpgrades.get(requirement);
        return upgrade !== undefined && upgrade.stacks > 0;
    }

    /**
     * 检查互斥
     */
    private checkRestriction(restriction: string): boolean {
        // 检查是否拥有互斥升级
        const parts = restriction.split(':');
        if (parts[0] === 'cannot_with') {
            const upgrade = this.playerUpgrades.get(parts[1]);
            return upgrade === undefined || upgrade.stacks === 0;
        }
        return true;
    }

    /**
     * 选择升级
     */
    public selectUpgrade(upgradeId: string): boolean {
        const upgrade = this.upgradeMap.get(upgradeId);
        if (!upgrade) {
            console.error(`[UpgradeManager] Upgrade not found: ${upgradeId}`);
            return false;
        }
        
        // 记录上次选择的稀有度
        this.lastSelectedRarity = upgrade.rarity;
        
        // 增加层数
        let playerUpgrade = this.playerUpgrades.get(upgradeId);
        if (!playerUpgrade) {
            playerUpgrade = { upgradeId, stacks: 0 };
            this.playerUpgrades.set(upgradeId, playerUpgrade);
        }
        playerUpgrade.stacks++;
        
        console.log(`[UpgradeManager] Selected upgrade: ${upgrade.name} (${playerUpgrade.stacks}/${upgrade.maxStacks})`);
        
        // 应用效果
        this.applyUpgradeEffect(upgrade);
        
        // 发送事件
        this.eventBus.emit(GameEvents.UPGRADE_SELECT, {
            upgrade,
            stacks: playerUpgrade.stacks,
        });
        
        // 恢复游戏
        gameManager.resume();
        
        return true;
    }

    /**
     * 应用升级效果
     */
    private applyUpgradeEffect(upgrade: UpgradeData): void {
        const effect = upgrade.effect;
        
        // 发送效果应用事件
        this.eventBus.emit('upgrade:apply', {
            upgradeId: upgrade.id,
            effect,
        });
        
        // TODO: 根据效果类型直接修改玩家属性
    }

    /**
     * 获取升级效果汇总
     */
    public getTotalEffects(): Record<string, number> {
        const effects: Record<string, number> = {};
        
        for (const [upgradeId, playerUpgrade] of this.playerUpgrades) {
            const upgrade = this.upgradeMap.get(upgradeId);
            if (!upgrade) continue;
            
            const effectType = upgrade.effect.type;
            const effectValue = upgrade.effect.value || 0;
            
            if (upgrade.effect.operation === 'multiply') {
                // 乘法叠加
                effects[effectType] = (effects[effectType] || 1) * Math.pow(1 + effectValue, playerUpgrade.stacks);
            } else {
                // 加法叠加
                effects[effectType] = (effects[effectType] || 0) + effectValue * playerUpgrade.stacks;
            }
        }
        
        return effects;
    }

    // ============ Getters ============

    public getCurrentExp(): number {
        return this.currentExp;
    }

    public getExpToNextLevel(): number {
        return this.expToNextLevel;
    }

    public getExpPercentage(): number {
        return this.currentExp / this.expToNextLevel;
    }

    public getLevel(): number {
        return this.level;
    }

    public getPlayerUpgrades(): Map<string, PlayerUpgrade> {
        return new Map(this.playerUpgrades);
    }

    public getUpgradeStacks(upgradeId: string): number {
        return this.playerUpgrades.get(upgradeId)?.stacks || 0;
    }

    public getUpgradeData(upgradeId: string): UpgradeData | undefined {
        return this.upgradeMap.get(upgradeId);
    }
}

// 便捷导出单例
export const upgradeManager = UpgradeManager.getInstance();
