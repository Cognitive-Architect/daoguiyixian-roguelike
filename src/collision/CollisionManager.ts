/**
 * CollisionManager.ts
 * B-06 碰撞系统（层管理 + AABB检测 + 敌人弹性分离）
 */

import { AABB, AABBPhysics, Vector2, Vec2 } from '../physics/AABB';
import { CollisionLayer, CollisionMasks } from './CollisionLayers';

export { CollisionLayer as CollisionGroup }; // 兼容旧命名

export interface CollisionBody {
    id: string;
    aabb: AABB;
    group: CollisionLayer;
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

export class CollisionManager {
    private static instance: CollisionManager;
    private bodies: Map<string, CollisionBody> = new Map();
    private nextId = 0;
    private callbacks: Map<string, Array<(result: CollisionResult) => void>> = new Map();

    public static getInstance(): CollisionManager {
        if (!CollisionManager.instance) {
            CollisionManager.instance = new CollisionManager();
        }
        return CollisionManager.instance;
    }

    public createBody(
        aabb: AABB,
        group: CollisionLayer,
        mask: number = CollisionMasks.ENEMY,
        owner: any = null,
        isTrigger: boolean = false,
    ): CollisionBody {
        const id = `body_${++this.nextId}`;
        const body: CollisionBody = { id, aabb: { ...aabb }, group, mask, owner, isTrigger, enabled: true };
        this.bodies.set(id, body);
        return body;
    }

    public removeBody(id: string): void {
        this.bodies.delete(id);
    }

    public updateBodyPosition(id: string, position: Vector2): void {
        const body = this.bodies.get(id);
        if (!body) return;

        const width = body.aabb.max.x - body.aabb.min.x;
        const height = body.aabb.max.y - body.aabb.min.y;
        body.aabb.min = { x: position.x - width / 2, y: position.y - height / 2 };
        body.aabb.max = { x: position.x + width / 2, y: position.y + height / 2 };
    }


    public onCollision(bodyId: string, callback: (result: CollisionResult) => void): void {
        if (!this.callbacks.has(bodyId)) {
            this.callbacks.set(bodyId, []);
        }
        this.callbacks.get(bodyId)!.push(callback);
    }

    public detectCollisions(): CollisionResult[] {
        const results: CollisionResult[] = [];
        const list = Array.from(this.bodies.values()).filter(b => b.enabled);

        for (let i = 0; i < list.length; i++) {
            for (let j = i + 1; j < list.length; j++) {
                const a = list[i];
                const b = list[j];
                if ((a.mask & b.group) === 0 && (b.mask & a.group) === 0) continue;

                const intersection = AABBPhysics.getIntersection(a.aabb, b.aabb);
                if (intersection) {
                    const result = { bodyA: a, bodyB: b, penetration: intersection.penetration };
                    results.push(result);
                    this.triggerCallbacks(a.id, result);
                    this.triggerCallbacks(b.id, result);
                }
            }
        }

        return results;
    }


    private triggerCallbacks(bodyId: string, result: CollisionResult): void {
        const list = this.callbacks.get(bodyId);
        if (!list) return;
        for (const callback of list) {
            callback(result);
        }
    }

    public resolveEnemySeparation(minDistance: number = 50, elasticity: number = 0.8): void {
        const enemies = Array.from(this.bodies.values()).filter(b => b.enabled && b.group === CollisionLayer.ENEMY);

        for (let i = 0; i < enemies.length; i++) {
            for (let j = i + 1; j < enemies.length; j++) {
                const a = enemies[i];
                const b = enemies[j];
                const ac = this.getCenter(a.aabb);
                const bc = this.getCenter(b.aabb);
                const dx = bc.x - ac.x;
                const dy = bc.y - ac.y;
                const dist = Math.hypot(dx, dy) || 0.0001;

                if (dist < minDistance) {
                    const push = ((minDistance - dist) / 2) * elasticity;
                    const nx = dx / dist;
                    const ny = dy / dist;

                    this.updateBodyPosition(a.id, { x: ac.x - nx * push, y: ac.y - ny * push });
                    this.updateBodyPosition(b.id, { x: bc.x + nx * push, y: bc.y + ny * push });
                }
            }
        }
    }

    public computePlayerPushVelocity(playerVelocity: Vector2): Vector2 {
        return Vec2.mul(playerVelocity, 0.8); // 可挤过敌人，减速20%
    }

    public checkProjectileEnemyCollision(projectileAABB: AABB): CollisionBody | null {
        for (const body of this.bodies.values()) {
            if (!body.enabled || body.group !== CollisionLayer.ENEMY) continue;
            if (AABBPhysics.intersects(projectileAABB, body.aabb)) {
                return body;
            }
        }
        return null;
    }

    public getEnemiesInMeleeRange(center: Vector2, range: number, direction: Vector2, angle: number): CollisionBody[] {
        const result: CollisionBody[] = [];
        const half = ((angle * Math.PI) / 180) / 2;
        const base = Math.atan2(direction.y, direction.x);

        for (const body of this.bodies.values()) {
            if (!body.enabled || body.group !== CollisionLayer.ENEMY) continue;
            const c = this.getCenter(body.aabb);
            const dx = c.x - center.x;
            const dy = c.y - center.y;
            const d = Math.hypot(dx, dy);
            if (d > range) continue;

            const ta = Math.atan2(dy, dx);
            const diff = Math.min(Math.abs(ta - base), Math.PI * 2 - Math.abs(ta - base));
            if (diff <= half) result.push(body);
        }

        return result;
    }

    public clear(): void {
        this.bodies.clear();
        this.callbacks.clear();
        this.nextId = 0;
    }

    public getStats(): { bodyCount: number } {
        return { bodyCount: this.bodies.size };
    }

    private getCenter(aabb: AABB): Vector2 {
        return {
            x: (aabb.min.x + aabb.max.x) / 2,
            y: (aabb.min.y + aabb.max.y) / 2,
        };
    }
}

// 兼容旧导出名
export const weaponCollisionManager = CollisionManager.getInstance();
export const collisionManager = CollisionManager.getInstance();
export class WeaponCollisionManager extends CollisionManager {}
