/**
 * CollisionManager.ts
 * 碰撞管理器 - 管理所有碰撞体和碰撞检测
 * 
 * DEBT-B01-002: 物理用AABB碰撞（非Box2D）
 */

import { AABB, Vector2, AABBPhysics } from './AABB';

export enum CollisionLayer {
    NONE = 0,
    PLAYER = 1 << 0,
    ENEMY = 1 << 1,
    PROJECTILE = 1 << 2,
    WALL = 1 << 3,
    ITEM = 1 << 4,
    TRIGGER = 1 << 5,
}

export interface Collider {
    id: string;
    aabb: AABB;
    layer: CollisionLayer;
    mask: number;  // 可以碰撞的层
    isTrigger: boolean;
    owner: any;
    enabled: boolean;
}

export interface CollisionInfo {
    colliderA: Collider;
    colliderB: Collider;
    penetration: Vector2;
}

export type CollisionCallback = (info: CollisionInfo) => void;

export class CollisionManager {
    private static instance: CollisionManager;
    private colliders: Map<string, Collider> = new Map();
    private collisionCallbacks: Map<string, CollisionCallback[]> = new Map();
    private nextId: number = 0;

    private constructor() {}

    public static getInstance(): CollisionManager {
        if (!CollisionManager.instance) {
            CollisionManager.instance = new CollisionManager();
        }
        return CollisionManager.instance;
    }

    /**
     * 创建碰撞体
     */
    public createCollider(
        aabb: AABB,
        layer: CollisionLayer,
        mask: number,
        owner: any,
        isTrigger: boolean = false
    ): Collider {
        const id = `collider_${++this.nextId}`;
        const collider: Collider = {
            id,
            aabb,
            layer,
            mask,
            isTrigger,
            owner,
            enabled: true
        };
        this.colliders.set(id, collider);
        return collider;
    }

    /**
     * 移除碰撞体
     */
    public removeCollider(id: string): void {
        this.colliders.delete(id);
        this.collisionCallbacks.delete(id);
    }

    /**
     * 更新碰撞体位置
     */
    public updateColliderPosition(id: string, position: Vector2): void {
        const collider = this.colliders.get(id);
        if (collider) {
            const size = {
                x: collider.aabb.max.x - collider.aabb.min.x,
                y: collider.aabb.max.y - collider.aabb.min.y
            };
            collider.aabb.min.x = position.x;
            collider.aabb.min.y = position.y;
            collider.aabb.max.x = position.x + size.x;
            collider.aabb.max.y = position.y + size.y;
        }
    }

    /**
     * 注册碰撞回调
     */
    public onCollision(colliderId: string, callback: CollisionCallback): void {
        if (!this.collisionCallbacks.has(colliderId)) {
            this.collisionCallbacks.set(colliderId, []);
        }
        this.collisionCallbacks.get(colliderId)!.push(callback);
    }

    /**
     * 取消碰撞回调
     */
    public offCollision(colliderId: string, callback: CollisionCallback): void {
        const callbacks = this.collisionCallbacks.get(colliderId);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    /**
     * 检测两个层是否可以碰撞
     */
    private canCollide(layerA: CollisionLayer, maskA: number, layerB: CollisionLayer, maskB: number): boolean {
        return (maskA & layerB) !== 0 && (maskB & layerA) !== 0;
    }

    /**
     * 执行碰撞检测
     */
    public detectCollisions(): CollisionInfo[] {
        const collisions: CollisionInfo[] = [];
        const colliders = Array.from(this.colliders.values()).filter(c => c.enabled);

        for (let i = 0; i < colliders.length; i++) {
            for (let j = i + 1; j < colliders.length; j++) {
                const a = colliders[i];
                const b = colliders[j];

                // 检查层掩码
                if (!this.canCollide(a.layer, a.mask, b.layer, b.mask)) {
                    continue;
                }

                // 检测碰撞
                const intersection = AABBPhysics.getIntersection(a.aabb, b.aabb);
                if (intersection) {
                    const info: CollisionInfo = {
                        colliderA: a,
                        colliderB: b,
                        penetration: intersection.penetration
                    };
                    collisions.push(info);

                    // 触发回调
                    this.triggerCallbacks(a.id, info);
                    this.triggerCallbacks(b.id, info);
                }
            }
        }

        return collisions;
    }

    /**
     * 触发碰撞回调
     */
    private triggerCallbacks(colliderId: string, info: CollisionInfo): void {
        const callbacks = this.collisionCallbacks.get(colliderId);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(info);
                } catch (error) {
                    console.error(`[CollisionManager] Error in collision callback:`, error);
                }
            });
        }
    }

    /**
     * 射线检测
     */
    public raycast(origin: Vector2, direction: Vector2, maxDistance: number, mask: number = 0xFFFFFFFF): Collider | null {
        const normalized = {
            x: direction.x / Math.sqrt(direction.x * direction.x + direction.y * direction.y),
            y: direction.y / Math.sqrt(direction.x * direction.x + direction.y * direction.y)
        };

        let closestCollider: Collider | null = null;
        let closestDistance = maxDistance;

        for (const collider of this.colliders.values()) {
            if (!collider.enabled || (collider.layer & mask) === 0) {
                continue;
            }

            // 简化的射线-AABB检测
            const hit = this.raycastAABB(origin, normalized, collider.aabb);
            if (hit !== null && hit < closestDistance) {
                closestDistance = hit;
                closestCollider = collider;
            }
        }

        return closestCollider;
    }

    /**
     * 简化的射线-AABB相交检测
     */
    private raycastAABB(origin: Vector2, direction: Vector2, aabb: AABB): number | null {
        let tmin = -Infinity;
        let tmax = Infinity;

        // X轴
        if (direction.x !== 0) {
            const tx1 = (aabb.min.x - origin.x) / direction.x;
            const tx2 = (aabb.max.x - origin.x) / direction.x;
            tmin = Math.max(tmin, Math.min(tx1, tx2));
            tmax = Math.min(tmax, Math.max(tx1, tx2));
        } else if (origin.x < aabb.min.x || origin.x > aabb.max.x) {
            return null;
        }

        // Y轴
        if (direction.y !== 0) {
            const ty1 = (aabb.min.y - origin.y) / direction.y;
            const ty2 = (aabb.max.y - origin.y) / direction.y;
            tmin = Math.max(tmin, Math.min(ty1, ty2));
            tmax = Math.min(tmax, Math.max(ty1, ty2));
        } else if (origin.y < aabb.min.y || origin.y > aabb.max.y) {
            return null;
        }

        if (tmax >= tmin && tmax >= 0) {
            return tmin >= 0 ? tmin : 0;
        }

        return null;
    }

    /**
     * 获取范围内的所有碰撞体
     */
    public getCollidersInRange(center: Vector2, radius: number, mask: number = 0xFFFFFFFF): Collider[] {
        const result: Collider[] = [];
        const radiusSq = radius * radius;

        for (const collider of this.colliders.values()) {
            if (!collider.enabled || (collider.layer & mask) === 0) {
                continue;
            }

            const colliderCenter = {
                x: (collider.aabb.min.x + collider.aabb.max.x) / 2,
                y: (collider.aabb.min.y + collider.aabb.max.y) / 2
            };

            const dx = colliderCenter.x - center.x;
            const dy = colliderCenter.y - center.y;
            const distanceSq = dx * dx + dy * dy;

            if (distanceSq <= radiusSq) {
                result.push(collider);
            }
        }

        return result;
    }

    /**
     * 清空所有碰撞体
     */
    public clear(): void {
        this.colliders.clear();
        this.collisionCallbacks.clear();
        this.nextId = 0;
    }

    /**
     * 获取碰撞体数量
     */
    public getColliderCount(): number {
        return this.colliders.size;
    }
}

// 便捷导出单例
export const collisionManager = CollisionManager.getInstance();
