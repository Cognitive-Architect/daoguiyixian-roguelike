/**
 * PhysicsSystem.ts
 * B-06 物理反馈系统：击退、无敌帧、子弹时间
 *
 * DEBT-PHY-001: 暂用AABB简化刚体（无旋转/质量/摩擦）
 * DEBT-PHY-002: 暂用O(N^2)检测（v0.5.0接入空间分割）
 */

import { Vector2 } from './AABB';
import { EventBus, GameEvents } from '../core/EventBus';
import { CollisionManager } from '../collision/CollisionManager';

export interface PhysicsConfig {
    collision: {
        playerEnemy: { damage: boolean; knockback: number; invincibleTime: number };
        weaponEnemy: { damage: boolean; knockback: number; hitstop: number };
        enemyEnemy: { elastic: number; minDistance: number };
        playerObstacle: { block: boolean; slide: boolean };
    };
    bulletTime: { triggerCombo: number; duration: number; timeScale: number };
}

const DEFAULT_CONFIG: PhysicsConfig = {
    collision: {
        playerEnemy: { damage: true, knockback: 0, invincibleTime: 1.5 },
        weaponEnemy: { damage: true, knockback: 3.0, hitstop: 0.1 },
        enemyEnemy: { elastic: 0.8, minDistance: 50 },
        playerObstacle: { block: true, slide: true },
    },
    bulletTime: { triggerCombo: 20, duration: 0.3, timeScale: 0.3 },
};

export class PhysicsSystem {
    private static instance: PhysicsSystem;
    private readonly eventBus: EventBus;
    private readonly collisionManager: CollisionManager;

    private config: PhysicsConfig = DEFAULT_CONFIG;
    private playerInvincibleTimer = 0;
    private playerInvincible = false;

    private globalTimeScale = 1;
    private bulletTimeLeft = 0;

    private constructor() {
        this.eventBus = EventBus.getInstance();
        this.collisionManager = CollisionManager.getInstance();
    }

    public static getInstance(): PhysicsSystem {
        if (!PhysicsSystem.instance) {
            PhysicsSystem.instance = new PhysicsSystem();
        }
        return PhysicsSystem.instance;
    }

    public async loadConfigFromJson(path: string): Promise<void> {
        const response = await fetch(path);
        const data = (await response.json()) as PhysicsConfig;
        this.config = data;
    }

    public loadConfig(config: PhysicsConfig): void {
        this.config = config;
    }

    public update(deltaTime: number): void {
        if (this.playerInvincibleTimer > 0) {
            this.playerInvincibleTimer = Math.max(0, this.playerInvincibleTimer - deltaTime);
            this.playerInvincible = this.playerInvincibleTimer > 0;
        }

        if (this.bulletTimeLeft > 0) {
            this.bulletTimeLeft = Math.max(0, this.bulletTimeLeft - deltaTime);
            this.globalTimeScale = this.bulletTimeLeft > 0 ? this.config.bulletTime.timeScale : 1;
        }

        this.collisionManager.resolveEnemySeparation(
            this.config.collision.enemyEnemy.minDistance,
            this.config.collision.enemyEnemy.elastic,
        );
    }

    public onPlayerDamagedAttempt(): boolean {
        if (this.playerInvincible) {
            return false;
        }

        this.playerInvincible = true;
        this.playerInvincibleTimer = this.config.collision.playerEnemy.invincibleTime;
        this.eventBus.emit('physics:player:invincible', {
            active: true,
            duration: this.playerInvincibleTimer,
            vfx: 'purple_flame_ring',
        });
        return true;
    }

    public applyWeaponKnockback(hitDirection: Vector2): Vector2 {
        const distancePx = this.config.collision.weaponEnemy.knockback * 100; // 3米≈300px
        return {
            x: hitDirection.x * distancePx,
            y: hitDirection.y * distancePx,
        };
    }

    public triggerBulletTime(combo: number): boolean {
        if (combo < this.config.bulletTime.triggerCombo) {
            return false;
        }

        this.bulletTimeLeft = this.config.bulletTime.duration;
        this.globalTimeScale = this.config.bulletTime.timeScale;
        this.eventBus.emit(GameEvents.GAME_PAUSE, {
            mode: 'bullet_time',
            duration: this.bulletTimeLeft,
            timeScale: this.globalTimeScale,
        });
        return true;
    }

    public getPlayerMoveVelocityAfterPush(originalVelocity: Vector2): Vector2 {
        return this.collisionManager.computePlayerPushVelocity(originalVelocity);
    }

    public isPlayerInvincible(): boolean {
        return this.playerInvincible;
    }

    public getTimeScale(): number {
        return this.globalTimeScale;
    }

    public getConfig(): PhysicsConfig {
        return this.config;
    }
}

export const physicsSystem = PhysicsSystem.getInstance();
