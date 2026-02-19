/**
 * SanitySystem.ts
 * SAN理智系统 - 核心差异化机制
 * 
 * 六档状态机：NORMAL(100-80)/HAZY(60-79)/CHAOTIC(40-59)/MAD(20-39)/BREAKDOWN(1-19)/ZERO(0)
 * 
 * DEBT-B03-001: Shader用Cocos内置ColorGrading（无自定义GLSL）
 */

import { EventBus, GameEvents } from '../core/EventBus';

export enum SanityTier {
    NORMAL = 'normal',       // 100-80
    HAZY = 'hazy',           // 60-79
    CHAOTIC = 'chaotic',     // 40-59
    MAD = 'mad',             // 20-39
    BREAKDOWN = 'breakdown', // 1-19
    ZERO = 'zero',           // 0
}

export interface SanityTierData {
    tier: SanityTier;
    minSan: number;
    maxSan: number;
    damageModifier: number;    // 伤害修正
    moveSpeedModifier: number; // 移速修正
    critModifier: number;      // 暴击修正
    specialEffect: string;     // 特殊效果描述
}

// SAN档位配置
export const SANITY_TIERS: SanityTierData[] = [
    {
        tier: SanityTier.NORMAL,
        minSan: 80,
        maxSan: 100,
        damageModifier: 1.0,
        moveSpeedModifier: 1.0,
        critModifier: 0,
        specialEffect: '无',
    },
    {
        tier: SanityTier.HAZY,
        minSan: 60,
        maxSan: 79,
        damageModifier: 1.05,
        moveSpeedModifier: 0.95,
        critModifier: 0.05,
        specialEffect: '偶尔幻觉（假敌人）',
    },
    {
        tier: SanityTier.CHAOTIC,
        minSan: 40,
        maxSan: 59,
        damageModifier: 1.10,
        moveSpeedModifier: 0.90,
        critModifier: 0.10,
        specialEffect: '敌人偶尔隐身1秒',
    },
    {
        tier: SanityTier.MAD,
        minSan: 20,
        maxSan: 39,
        damageModifier: 1.20,
        moveSpeedModifier: 0.80,
        critModifier: 0.15,
        specialEffect: '屏幕扭曲，敌我不分标记',
    },
    {
        tier: SanityTier.BREAKDOWN,
        minSan: 1,
        maxSan: 19,
        damageModifier: 1.30,
        moveSpeedModifier: 0.70,
        critModifier: 0.20,
        specialEffect: '严重幻觉，随机方向键反转',
    },
    {
        tier: SanityTier.ZERO,
        minSan: 0,
        maxSan: 0,
        damageModifier: 1.30,
        moveSpeedModifier: 0.70,
        critModifier: 0.20,
        specialEffect: '每秒掉血1%（疯狂代价）',
    },
];

export interface SanityEffect {
    hallucinationChance: number;      // 幻觉概率
    enemyInvisibleChance: number;     // 敌人隐身概率
    directionReverseChance: number;   // 方向反转概率
    friendlyFireChance: number;       // 友伤概率
    healthDrainPerSecond: number;     // 每秒掉血百分比
}

export class SanitySystem {
    private static instance: SanitySystem;
    private eventBus: EventBus;
    
    // SAN值
    private currentSan: number = 100;
    private maxSan: number = 100;
    private minSan: number = 0;
    
    // 当前档位
    private currentTier: SanityTier = SanityTier.NORMAL;
    
    // 视觉参数
    private visualIntensity: number = 0; // 0-1，用于渐变
    private readonly visualLerpSpeed = 2.0; // 0.5秒完成渐变
    
    // ZERO档掉血
    private healthDrainAccumulator: number = 0;
    
    // 幻觉系统
    private hallucinationTimer: number = 0;
    private nextHallucinationTime: number = 0;
    
    // 方向反转
    private directionReversed: boolean = false;
    private directionReverseTimer: number = 0;

    private constructor() {
        this.eventBus = EventBus.getInstance();
    }

    public static getInstance(): SanitySystem {
        if (!SanitySystem.instance) {
            SanitySystem.instance = new SanitySystem();
        }
        return SanitySystem.instance;
    }

    /**
     * 初始化
     */
    public initialize(maxSan: number = 100): void {
        this.maxSan = maxSan;
        this.currentSan = maxSan;
        this.currentTier = this.getTierFromValue(maxSan);
        this.visualIntensity = 0;
        
        console.log(`[SanitySystem] Initialized with max SAN: ${maxSan}`);
    }

    /**
     * 更新SAN系统
     */
    public update(deltaTime: number): void {
        // 更新视觉强度渐变
        const targetIntensity = this.getTargetVisualIntensity();
        this.visualIntensity = this.lerp(this.visualIntensity, targetIntensity, this.visualLerpSpeed * deltaTime);
        
        // ZERO档掉血
        if (this.currentTier === SanityTier.ZERO) {
            this.healthDrainAccumulator += deltaTime;
            if (this.healthDrainAccumulator >= 1.0) {
                this.healthDrainAccumulator -= 1.0;
                this.eventBus.emit('sanity:health_drain', { amount: 0.01 }); // 1%
            }
        }
        
        // 更新幻觉
        this.updateHallucinations(deltaTime);
        
        // 更新方向反转
        this.updateDirectionReverse(deltaTime);
    }

    /**
     * 修改SAN值
     */
    public modify(delta: number): void {
        const oldSan = this.currentSan;
        const oldTier = this.currentTier;
        
        this.currentSan = Math.max(this.minSan, Math.min(this.maxSan, this.currentSan + delta));
        
        // 检查档位变化
        this.currentTier = this.getTierFromValue(this.currentSan);
        
        // 发送事件
        this.eventBus.emit(GameEvents.SANITY_CHANGE, {
            oldValue: oldSan,
            newValue: this.currentSan,
            delta: delta,
            maxSan: this.maxSan,
        });
        
        // 档位变化事件
        if (oldTier !== this.currentTier) {
            this.eventBus.emit(GameEvents.SANITY_TIER_CHANGE, {
                oldTier: oldTier,
                newTier: this.currentTier,
            });
            console.log(`[SanitySystem] Tier change: ${oldTier} -> ${this.currentTier}`);
        }
        
        // 归零事件
        if (this.currentSan === 0 && oldSan > 0) {
            this.eventBus.emit(GameEvents.SANITY_ZERO);
        }
    }

    /**
     * 设置SAN值
     */
    public setSan(value: number): void {
        this.modify(value - this.currentSan);
    }

    /**
     * 获取当前档位
     */
    private getTierFromValue(san: number): SanityTier {
        for (const tier of SANITY_TIERS) {
            if (san >= tier.minSan && san <= tier.maxSan) {
                return tier.tier;
            }
        }
        return SanityTier.ZERO;
    }

    /**
     * 获取当前档位数据
     */
    public getCurrentTierData(): SanityTierData {
        return SANITY_TIERS.find(t => t.tier === this.currentTier) || SANITY_TIERS[0];
    }

    /**
     * 获取目标视觉强度
     */
    private getTargetVisualIntensity(): number {
        switch (this.currentTier) {
            case SanityTier.NORMAL: return 0;
            case SanityTier.HAZY: return 0.2;
            case SanityTier.CHAOTIC: return 0.4;
            case SanityTier.MAD: return 0.6;
            case SanityTier.BREAKDOWN: return 0.8;
            case SanityTier.ZERO: return 1.0;
            default: return 0;
        }
    }

    /**
     * 线性插值
     */
    private lerp(a: number, b: number, t: number): number {
        return a + (b - a) * Math.min(t, 1);
    }

    /**
     * 更新幻觉
     */
    private updateHallucinations(deltaTime: number): void {
        if (this.currentTier === SanityTier.NORMAL) return;
        
        this.hallucinationTimer += deltaTime;
        
        if (this.hallucinationTimer >= this.nextHallucinationTime) {
            this.hallucinationTimer = 0;
            
            // 根据档位设置幻觉概率
            const chance = this.getHallucinationChance();
            
            if (Math.random() < chance) {
                this.spawnHallucination();
            }
            
            // 设置下一次幻觉时间
            this.nextHallucinationTime = this.getRandomHallucinationInterval();
        }
    }

    /**
     * 获取幻觉概率
     */
    private getHallucinationChance(): number {
        switch (this.currentTier) {
            case SanityTier.HAZY: return 0.1;
            case SanityTier.CHAOTIC: return 0.2;
            case SanityTier.MAD: return 0.3;
            case SanityTier.BREAKDOWN: return 0.5;
            case SanityTier.ZERO: return 0.7;
            default: return 0;
        }
    }

    /**
     * 获取随机幻觉间隔
     */
    private getRandomHallucinationInterval(): number {
        return 3 + Math.random() * 5; // 3-8秒
    }

    /**
     * 生成幻觉
     */
    private spawnHallucination(): void {
        this.eventBus.emit('sanity:hallucination', {
            type: this.getRandomHallucinationType(),
            duration: 1 + Math.random() * 2,
        });
    }

    /**
     * 获取随机幻觉类型
     */
    private getRandomHallucinationType(): string {
        const types = ['fake_enemy', 'fake_damage_number', 'screen_flash', 'whisper'];
        return types[Math.floor(Math.random() * types.length)];
    }

    /**
     * 更新方向反转
     */
    private updateDirectionReverse(deltaTime: number): void {
        if (this.currentTier !== SanityTier.BREAKDOWN && this.currentTier !== SanityTier.ZERO) {
            this.directionReversed = false;
            return;
        }
        
        if (this.directionReversed) {
            this.directionReverseTimer -= deltaTime;
            if (this.directionReverseTimer <= 0) {
                this.directionReversed = false;
            }
        } else {
            // 随机触发方向反转
            if (Math.random() < 0.01) { // 每秒约1%概率
                this.directionReversed = true;
                this.directionReverseTimer = 2 + Math.random() * 3; // 2-5秒
                this.eventBus.emit('sanity:direction_reverse', { reversed: true });
            }
        }
    }

    // ============ 效果获取 ============

    /**
     * 获取当前效果
     */
    public getCurrentEffect(): SanityEffect {
        const tier = this.getCurrentTierData();
        
        return {
            hallucinationChance: this.getHallucinationChance(),
            enemyInvisibleChance: this.currentTier >= SanityTier.CHAOTIC ? 0.1 : 0,
            directionReverseChance: this.currentTier >= SanityTier.BREAKDOWN ? 0.2 : 0,
            friendlyFireChance: this.currentTier === SanityTier.ZERO ? 0.2 : 0,
            healthDrainPerSecond: this.currentTier === SanityTier.ZERO ? 0.01 : 0,
        };
    }

    /**
     * 应用伤害修正
     */
    public applyDamageModifier(baseDamage: number): number {
        const tier = this.getCurrentTierData();
        return baseDamage * tier.damageModifier;
    }

    /**
     * 应用移速修正
     */
    public applyMoveSpeedModifier(baseSpeed: number): number {
        const tier = this.getCurrentTierData();
        return baseSpeed * tier.moveSpeedModifier;
    }

    /**
     * 应用暴击修正
     */
    public applyCritModifier(baseCritRate: number): number {
        const tier = this.getCurrentTierData();
        return baseCritRate + tier.critModifier;
    }

    /**
     * 是否需要反转方向
     */
    public isDirectionReversed(): boolean {
        return this.directionReversed;
    }

    // ============ Getters ============

    public getCurrentSan(): number {
        return this.currentSan;
    }

    public getMaxSan(): number {
        return this.maxSan;
    }

    public getSanPercentage(): number {
        return this.currentSan / this.maxSan;
    }

    public getCurrentTier(): SanityTier {
        return this.currentTier;
    }

    public getVisualIntensity(): number {
        return this.visualIntensity;
    }

    /**
     * 获取视觉参数（用于后处理）
     */
    public getVisualParams(): {
        saturation: number;
        redShift: number;
        edgeBleedIntensity: number;
        distortionAmount: number;
        vignetteIntensity: number;
    } {
        const intensity = this.visualIntensity;
        
        return {
            saturation: 1 - intensity * 0.4, // 饱和度降低
            redShift: intensity * 0.5, // 红移
            edgeBleedIntensity: intensity * 0.8, // 边缘渗血
            distortionAmount: intensity * 0.3, // 扭曲
            vignetteIntensity: intensity * 0.6, // 暗角
        };
    }
}

// 便捷导出单例
export const sanitySystem = SanitySystem.getInstance();
