/**
 * Enemy.ts
 * 单个敌人实体：属性、受击、死亡、状态
 *
 * DEBT-ENEMY-002: 动画系统待美术资源，当前使用状态与事件替代
 */

import { Vector2 } from '../physics/AABB';

export type EnemyAIType = 'chase_melee' | 'dash_hit_run' | 'boss_phases';

export interface EnemyConfig {
    id: string;
    name: string;
    hp: number;
    speed: number;
    damage: number;
    exp: number;
    ai: EnemyAIType;
    spawn_weight: number;
    is_boss?: boolean;
}

export interface EnemyHitResult {
    dead: boolean;
    hp: number;
}

export class Enemy {
    public runtimeId = '';
    public active = false;

    private config: EnemyConfig;
    private hp: number;
    private position: Vector2 = { x: 0, y: 0 };
    private velocity: Vector2 = { x: 0, y: 0 };
    private dashInvincible = 0;

    constructor(config: EnemyConfig) {
        this.config = { ...config };
        this.hp = config.hp;
    }

    public spawn(runtimeId: string, position: Vector2): void {
        this.runtimeId = runtimeId;
        this.position = { ...position };
        this.velocity = { x: 0, y: 0 };
        this.hp = this.config.hp;
        this.dashInvincible = 0;
        this.active = true;
    }

    public despawn(): void {
        this.active = false;
        this.velocity = { x: 0, y: 0 };
    }

    public update(deltaTime: number): void {
        this.position.x += this.velocity.x * deltaTime;
        this.position.y += this.velocity.y * deltaTime;

        if (this.dashInvincible > 0) {
            this.dashInvincible = Math.max(0, this.dashInvincible - deltaTime);
        }
    }

    public setVelocity(velocity: Vector2): void {
        this.velocity = { ...velocity };
    }

    public setPosition(position: Vector2): void {
        this.position = { ...position };
    }

    public applyDashInvincible(duration: number): void {
        this.dashInvincible = Math.max(this.dashInvincible, duration);
    }

    public takeDamage(amount: number): EnemyHitResult {
        if (!this.active || this.dashInvincible > 0) {
            return { dead: false, hp: this.hp };
        }

        this.hp = Math.max(0, this.hp - amount);
        return { dead: this.hp <= 0, hp: this.hp };
    }

    public getConfig(): EnemyConfig {
        return { ...this.config };
    }

    public getPosition(): Vector2 {
        return { ...this.position };
    }

    public getVelocity(): Vector2 {
        return { ...this.velocity };
    }

    public getHp(): number {
        return this.hp;
    }

    public getHpRatio(): number {
        return this.config.hp > 0 ? this.hp / this.config.hp : 0;
    }

    public getExpValue(): number {
        return this.config.exp;
    }

    public isBoss(): boolean {
        return this.config.is_boss === true;
    }

    public isInvincible(): boolean {
        return this.dashInvincible > 0;
    }
}
