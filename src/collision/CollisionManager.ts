/**
 * CollisionManager.ts
 * 碰撞管理器 - 武器与敌人碰撞检测
 * 
 * 核心功能：AABB碰撞检测，Group掩码
 * 
 * DEBT-B06-002: 碰撞体用矩形（非精确多边形）
 */

import { AABB, AABBPhysics, Vector2 } from '../physics/AABB';
import { EventBus, GameEvents } from '../core/EventBus';

export enum CollisionGroup {
    NONE = 0,
    PLAYER = 1 << 0,
    ENEMY = 1 << 1,
    PROJECTILE = 1 << 2,
    WALL = 1 << 3,
    ITEM = 1 << 4,
    TRIGGER = 1 << 5,
}

export interface CollisionBody {
    id: string;
    aabb: AABB;
    group: CollisionGroup;
    mask: number;
    owner: any;
    isTrigger: boolean;
    enabled: boolean;
}

export interface CollisionResult {
    bodyA: CollisionBody;
    bodyB: CollisionBody;
    penetration: Vector2;
}

export class WeaponCollisionManager {
    private static instance: WeaponCollisionManager;
    private eventBus: EventBus;
    
    // 碰撞体
    private bodies: Map<string, CollisionBody> = new Map();
    private nextId: number = 0;
    
    // 碰撞回调
    private collisionCallbacks: Map<string, ((result: CollisionResult) => void)[]> = new Map();

    private constructor() {
        this.eventBus = EventBus.getInstance();
    }

    public static getInstance(): WeaponCollisionManager {
        if (!WeaponCollisionManager.instance) {
            WeaponCollisionManager.instance = new WeaponCollisionManager();
        }
        return WeaponCollisionManager.instance;
    }

    /**
     * 创建碰撞体
     */
    public createBody(
        aabb: AABB,
        group: CollisionGroup,
        mask: number,
        owner: any,
        isTrigger: boolean = false
    ): CollisionBody {
        const id = `body_${++this.nextId}`;
        const body: CollisionBody = {
            id,
            aabb: { ...aabb },
            group,
            mask,
            owner,
            isTrigger,
            enabled: true,
        };
        this.bodies.set(id, body);
        return body;
    }

    /**
     * 移除碰撞体
     */
    public removeBody(id: string): void {
        this.bodies.delete(id);
        this.collisionCallbacks.delete(id);
    }

    /**
     * 更新碰撞体位置
     */
    public updateBodyPosition(id: string, position: Vector2): void {
        const body = this.bodies.get(id);
        if (!body) return;

        const width = body.aabb.max.x - body.aabb.min.x;
        const height = body.aabb.max.y - body.aabb.min.y;
        
        body.aabb.min.x = position.x - width / 2;
        body.aabb.min.y = position.y - height / 2;
        body.aabb.max.x = position.x + width / 2;
        body.aabb.max.y = position.y + height / 2;
    }

    /**
     * 注册碰撞回调
     */
    public onCollision(bodyId: string, callback: (result: CollisionResult) => void): void {
        if (!this.collisionCallbacks.has(bodyId)) {
            this.collisionCallbacks.set(bodyId, []);
        }
        this.collisionCallbacks.get(bodyId)!.push(callback);
    }

    /**
     * 检测碰撞
     */
    public detectCollisions(): CollisionResult[] {
        const results: CollisionResult[] = [];
        const bodies = Array.from(this.bodies.values()).filter(b => b.enabled);

        for (let i = 0; i < bodies.length; i++) {
            for (let j = i + 1; j < bodies.length; j++) {
                const a = bodies[i];
                const b = bodies[j];

                // 检查掩码
                if ((a.mask & b.group) === 0 && (b.mask & a.group) === 0) {
                    continue;
                }

                // 检测碰撞
                const intersection = AABBPhysics.getIntersection(a.aabb, b.aabb);
                if (intersection) {
                    const result: CollisionResult = {
                        bodyA: a,
                        bodyB: b,
                        penetration: intersection.penetration,
                    };
                    results.push(result);

                    // 触发回调
                    this.triggerCallbacks(a.id, result);
                    this.triggerCallbacks(b.id, result);
                }
            }
        }

        return results;
    }

    /**
     * 触发回调
     */
    private triggerCallbacks(bodyId: string, result: CollisionResult): void {
        const callbacks = this.collisionCallbacks.get(bodyId);
        if (!callbacks) return;

        for (const callback of callbacks) {
            try {
                callback(result);
            } catch (error) {
                console.error(`[WeaponCollisionManager] Error in collision callback:`, error);
            }
        }
    }

    /**
     * 检测投射物与敌人碰撞
     */
    public checkProjectileEnemyCollision(projectileAABB: AABB): CollisionBody | null {
        for (const body of this.bodies.values()) {
            if (!body.enabled || body.group !== CollisionGroup.ENEMY) continue;
            
            if (AABBPhysics.intersects(projectileAABB, body.aabb)) {
                return body;
            }
        }
        return null;
    }

    /**
     * 检测近战攻击范围内的敌人
     */
    public getEnemiesInMeleeRange(
        center: Vector2,
        range: number,
        direction: Vector2,
        angle: number
    ): CollisionBody[] {
        const results: CollisionBody[] = [];
        const angleRad = (angle * Math.PI) / 180;
        const halfAngle = angleRad / 2;
        const baseAngle = Math.atan2(direction.y, direction.x);

        for (const body of this.bodies.values()) {
            if (!body.enabled || body.group !== CollisionGroup.ENEMY) continue;

            const bodyCenter = {
                x: (body.aabb.min.x + body.aabb.max.x) / 2,
                y: (body.aabb.min.y + body.aabb.max.y) / 2,
            };

            const dx = bodyCenter.x - center.x;
            const dy = bodyCenter.y - center.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > range) continue;

            // 角度检查
            const targetAngle = Math.atan2(dy, dx);
            const angleDiff = Math.abs(targetAngle - baseAngle);
            const normalizedDiff = Math.min(angleDiff, 2 * Math.PI - angleDiff);

            if (normalizedDiff <= halfAngle) {
                results.push(body);
            }
        }

        return results;
    }

    /**
     * 清空所有碰撞体
     */
    public clear(): void {
        this.bodies.clear();
        this.collisionCallbacks.clear();
        this.nextId = 0;
    }

    /**
     * 获取统计
     */
    public getStats(): { bodyCount: number } {
        return {
            bodyCount: this.bodies.size,
        };
    }
}

// 便捷导出单例
export const weaponCollisionManager = WeaponCollisionManager.getInstance();
