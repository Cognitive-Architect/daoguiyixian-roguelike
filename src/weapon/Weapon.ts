/**
 * Weapon.ts
 * 单武器逻辑：冷却、自动瞄准、SAN增益、特效封装
 *
 * DEBT-WEAPON-002: 弹道碰撞检测复用B-06 PhysicsSystem（当前mock实现）
 */

import { Vector2 } from '../physics/AABB';
import { EffectType } from '../player/PlayerController';

export type WeaponEffect = 'NORMAL' | 'HOMING' | 'AOE' | string;

export interface WeaponConfig {
    id: string;
    name: string;
    damage: number;
    range: number;
    cooldown: number;
    attackCooldown?: number;
    effect: WeaponEffect;
}

export interface EnemyTarget {
    id?: string;
    position: Vector2;
}

export interface WeaponFireResult {
    weaponId: string;
    weaponName: string;
    damage: number;
    range: number;
    direction: Vector2;
    target: EnemyTarget;
    effectType: EffectType;
    baseEffect: WeaponEffect;
}

const LOW_SANITY_THRESHOLD = 30;
const LOW_SANITY_DAMAGE_MULTIPLIER = 1.15;
const LOW_SANITY_RANGE_MULTIPLIER = 1.2;

export class Weapon {
    private readonly config: WeaponConfig;
    private cooldownRemaining = 0;

    constructor(config: WeaponConfig) {
        this.config = { ...config };
    }

    public update(deltaTime: number): void {
        if (this.cooldownRemaining > 0) {
            this.cooldownRemaining = Math.max(0, this.cooldownRemaining - deltaTime);
        }
    }

    public canFire(): boolean {
        return this.cooldownRemaining <= 0;
    }

    public forceReady(): void {
        this.cooldownRemaining = 0;
    }

    public tryFire(
        origin: Vector2,
        explicitDirection: Vector2,
        enemyTargets: EnemyTarget[],
        sanityPercent: number,
    ): WeaponFireResult | null {
        if (!this.canFire()) {
            return null;
        }

        const target = this.findNearestInRange(origin, enemyTargets, sanityPercent);
        if (!target) {
            return null;
        }

        const direction = this.getDirection(origin, target.position, explicitDirection);
        const result: WeaponFireResult = {
            weaponId: this.config.id,
            weaponName: this.config.name,
            damage: this.getDamage(sanityPercent),
            range: this.getRange(sanityPercent),
            direction,
            target,
            effectType: this.getEffectType(sanityPercent),
            baseEffect: this.config.effect,
        };

        this.cooldownRemaining = this.getCooldownSeconds();
        return result;
    }

    private findNearestInRange(origin: Vector2, enemyTargets: EnemyTarget[], sanityPercent: number): EnemyTarget | null {
        const effectiveRange = this.getRange(sanityPercent);
        let nearest: EnemyTarget | null = null;
        let minDistance = Number.POSITIVE_INFINITY;

        for (const enemy of enemyTargets) {
            const dx = enemy.position.x - origin.x;
            const dy = enemy.position.y - origin.y;
            const distance = Math.hypot(dx, dy);
            if (distance <= effectiveRange && distance < minDistance) {
                minDistance = distance;
                nearest = enemy;
            }
        }

        return nearest;
    }

    private getDirection(origin: Vector2, target: Vector2, fallback: Vector2): Vector2 {
        const dx = target.x - origin.x;
        const dy = target.y - origin.y;
        const length = Math.hypot(dx, dy);
        if (length <= 0.00001) {
            return this.normalizeOrFallback(fallback);
        }

        return { x: dx / length, y: dy / length };
    }

    private normalizeOrFallback(direction: Vector2): Vector2 {
        const length = Math.hypot(direction.x, direction.y);
        if (length <= 0.00001) {
            return { x: 1, y: 0 };
        }

        return { x: direction.x / length, y: direction.y / length };
    }

    public getDamage(sanityPercent: number): number {
        const base = this.config.damage;
        if (sanityPercent < LOW_SANITY_THRESHOLD) {
            return Number((base * LOW_SANITY_DAMAGE_MULTIPLIER).toFixed(2));
        }
        return base;
    }

    public getRange(sanityPercent: number): number {
        const base = this.config.range;
        if (sanityPercent < LOW_SANITY_THRESHOLD) {
            return Number((base * LOW_SANITY_RANGE_MULTIPLIER).toFixed(2));
        }
        return base;
    }

    public getEffectType(sanityPercent: number): EffectType {
        return sanityPercent < LOW_SANITY_THRESHOLD ? EffectType.PURPLE_FLAME : EffectType.NORMAL;
    }

    public getConfig(): WeaponConfig {
        return { ...this.config, attackCooldown: this.getCooldownSeconds() };
    }

    public canAttack(): boolean {
        return this.canFire();
    }

    public getCooldownProgress(): number {
        const total = this.getCooldownSeconds();
        if (total <= 0) return 1;
        return Math.max(0, Math.min(1, 1 - this.cooldownRemaining / total));
    }

    public applyMultiplier(damageMultiplier: number, rangeMultiplier: number, cooldownMultiplier: number): void {
        this.config.damage = Number((this.config.damage * damageMultiplier).toFixed(2));
        this.config.range = Number((this.config.range * rangeMultiplier).toFixed(2));
        this.config.cooldown = Number((this.getCooldownSeconds() * cooldownMultiplier).toFixed(3));
        this.config.attackCooldown = this.config.cooldown;
    }

    private getCooldownSeconds(): number {
        return this.config.cooldown ?? this.config.attackCooldown ?? 0.5;
    }
}
