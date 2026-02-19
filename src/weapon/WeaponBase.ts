/**
 * WeaponBase.ts
 * 武器基类 - 抽象类定义
 * 
 * 核心方法：attack()/upgrade()/getDamage()
 * 
 * DEBT-B06-001: 暂时只做6种武器（非12种）
 * DEBT-B06-002: 碰撞体用矩形（非精确多边形）
 */

import { Vector2 } from '../physics/AABB';
import { EventBus, GameEvents } from '../core/EventBus';
import { Random, globalRandom } from '../core/Random';
import { sanitySystem } from '../sanity/SanitySystem';

export type WeaponType = 'melee' | 'ranged' | 'summon' | 'passive';

export interface WeaponConfig {
    id: string;
    name: string;
    description: string;
    type: WeaponType;
    baseDamage: number;
    upgradeIncrement: number;
    maxLevel: number;
    attackRange: number;
    attackCooldown: number;
    attackAngle?: number;
    projectileSpeed?: number;
    specialEffect?: string;
    specialParams?: Record<string, any>;
    sanityInteraction?: string;
    sanityParams?: Record<string, any>;
}

export interface DamageResult {
    damage: number;
    isCrit: boolean;
    finalDamage: number;
}

export abstract class WeaponBase {
    protected config: WeaponConfig;
    protected eventBus: EventBus;
    protected random: Random;
    
    // 等级
    protected level: number = 1;
    
    // 冷却
    protected cooldownTimer: number = 0;
    
    // 统计
    protected totalDamageDealt: number = 0;
    protected hitCount: number = 0;

    constructor(config: WeaponConfig) {
        this.config = config;
        this.eventBus = EventBus.getInstance();
        this.random = globalRandom;
    }

    /**
     * 攻击 - 子类必须实现
     */
    public abstract attack(position: Vector2, direction: Vector2): void;

    /**
     * 更新
     */
    public update(deltaTime: number): void {
        if (this.cooldownTimer > 0) {
            this.cooldownTimer -= deltaTime;
        }
    }

    /**
     * 升级
     */
    public upgrade(): boolean {
        if (this.level >= this.config.maxLevel) {
            return false;
        }
        
        this.level++;
        console.log(`[WeaponBase] ${this.config.name} upgraded to level ${this.level}`);
        
        return true;
    }

    /**
     * 获取当前伤害
     */
    public getDamage(): DamageResult {
        // 基础伤害
        let baseDamage = this.config.baseDamage + (this.level - 1) * this.config.upgradeIncrement;
        
        // 等级加成
        baseDamage *= (1 + (this.level - 1) * 0.1);
        
        // 随机波动 (0.9 - 1.1)
        const randomFactor = this.random.rangeFloat(0.9, 1.1);
        baseDamage *= randomFactor;
        
        // 暴击判定
        const critRate = 0.05; // 基础5%
        const isCrit = this.random.bool(critRate);
        const critMultiplier = isCrit ? 1.5 : 1.0;
        
        // SAN修正
        const sanityMultiplier = sanitySystem.applyDamageModifier(1);
        
        // 最终伤害
        const finalDamage = Math.floor(baseDamage * critMultiplier * sanityMultiplier);
        
        return {
            damage: Math.floor(baseDamage),
            isCrit,
            finalDamage,
        };
    }

    /**
     * 获取攻击范围
     */
    public getAttackRange(): number {
        return this.config.attackRange;
    }

    /**
     * 检查是否可以攻击
     */
    public canAttack(): boolean {
        return this.cooldownTimer <= 0;
    }

    /**
     * 重置冷却
     */
    protected resetCooldown(): void {
        this.cooldownTimer = this.config.attackCooldown;
    }

    /**
     * 记录伤害
     */
    protected recordDamage(damage: number): void {
        this.totalDamageDealt += damage;
        this.hitCount++;
    }

    // ============ Getters ============

    public getId(): string {
        return this.config.id;
    }

    public getName(): string {
        return this.config.name;
    }

    public getLevel(): number {
        return this.level;
    }

    public getMaxLevel(): number {
        return this.config.maxLevel;
    }

    public getType(): WeaponType {
        return this.config.type;
    }

    public getConfig(): WeaponConfig {
        return this.config;
    }

    public getCooldownProgress(): number {
        if (this.cooldownTimer <= 0) return 1;
        return 1 - (this.cooldownTimer / this.config.attackCooldown);
    }

    public getStats(): { totalDamage: number; hitCount: number } {
        return {
            totalDamage: this.totalDamageDealt,
            hitCount: this.hitCount,
        };
    }
}

/**
 * 近战武器基类
 */
export abstract class MeleeWeapon extends WeaponBase {
    protected attackAngle: number;

    constructor(config: WeaponConfig) {
        super(config);
        this.attackAngle = config.attackAngle || 120;
    }

    /**
     * 获取扇形攻击范围内的敌人
     */
    protected getEnemiesInSector(
        position: Vector2,
        direction: Vector2,
        range: number,
        angle: number
    ): any[] {
        // 这里应该调用EnemyManager获取范围内的敌人
        // 简化实现
        return [];
    }
}

/**
 * 远程武器基类
 */
export abstract class RangedWeapon extends WeaponBase {
    protected projectileSpeed: number;

    constructor(config: WeaponConfig) {
        super(config);
        this.projectileSpeed = config.projectileSpeed || 400;
    }

    /**
     * 发射投射物
     */
    protected fireProjectile(
        position: Vector2,
        direction: Vector2,
        damage: number
    ): void {
        this.eventBus.emit(GameEvents.WEAPON_FIRE, {
            weaponId: this.config.id,
            position,
            direction,
            speed: this.projectileSpeed,
            damage,
            range: this.config.attackRange,
        });
    }
}

/**
 * 召唤武器基类
 */
export abstract class SummonWeapon extends WeaponBase {
    protected summonDuration: number = 10;

    constructor(config: WeaponConfig) {
        super(config);
    }
}

/**
 * 被动武器基类
 */
export abstract class PassiveWeapon extends WeaponBase {
    protected effectInterval: number = 3;
    protected effectTimer: number = 0;

    constructor(config: WeaponConfig) {
        super(config);
    }

    public override update(deltaTime: number): void {
        super.update(deltaTime);
        
        this.effectTimer += deltaTime;
        if (this.effectTimer >= this.effectInterval) {
            this.effectTimer = 0;
            this.applyPassiveEffect();
        }
    }

    protected abstract applyPassiveEffect(): void;
}
