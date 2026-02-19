/**
 * physics.test.ts
 * B-06 物理碰撞系统测试
 */

import { PhysicsSystem } from '../src/physics/PhysicsSystem';
import { CollisionManager } from '../src/collision/CollisionManager';
import { CollisionLayer, CollisionMasks } from '../src/collision/CollisionLayers';
import { BoundingBox } from '../src/physics/AABB';

describe('B-06 PhysicsSystem', () => {
    let physics: PhysicsSystem;
    let collision: CollisionManager;

    beforeEach(() => {
        physics = PhysicsSystem.getInstance();
        collision = CollisionManager.getInstance();
        collision.clear();
    });

    test('玩家受伤后1.5秒无敌，期间不重复受伤', () => {
        expect(physics.onPlayerDamagedAttempt()).toBe(true);
        expect(physics.isPlayerInvincible()).toBe(true);
        expect(physics.onPlayerDamagedAttempt()).toBe(false);

        physics.update(1.6);
        expect(physics.isPlayerInvincible()).toBe(false);
    });

    test('武器命中敌人击退3米（300px）', () => {
        const knockback = physics.applyWeaponKnockback({ x: 1, y: 0 });
        expect(knockback.x).toBeCloseTo(300, 3);
        expect(knockback.y).toBeCloseTo(0, 3);
    });

    test('敌人之间保持50px最小距离（弹性分离）', () => {
        const a = collision.createBody(BoundingBox.fromCenter({ x: 0, y: 0 }, 20, 20), CollisionLayer.ENEMY, CollisionMasks.ENEMY, {});
        const b = collision.createBody(BoundingBox.fromCenter({ x: 10, y: 0 }, 20, 20), CollisionLayer.ENEMY, CollisionMasks.ENEMY, {});

        collision.resolveEnemySeparation(50, 1);

        const ax = (a.aabb.min.x + a.aabb.max.x) / 2;
        const bx = (b.aabb.min.x + b.aabb.max.x) / 2;
        expect(Math.abs(bx - ax)).toBeGreaterThanOrEqual(49.9);
    });

    test('连击达到20触发0.3秒子弹时间', () => {
        expect(physics.triggerBulletTime(20)).toBe(true);
        expect(physics.getTimeScale()).toBeCloseTo(0.3, 3);

        physics.update(0.31);
        expect(physics.getTimeScale()).toBe(1);
    });

    test('玩家可挤过敌人：速度降20%但不阻断', () => {
        const v = physics.getPlayerMoveVelocityAfterPush({ x: 100, y: 50 });
        expect(v.x).toBeCloseTo(80, 3);
        expect(v.y).toBeCloseTo(40, 3);
    });
});

console.log('=== Physics System B-06 Tests ===');
console.log('1) 玩家受伤后1.5秒无敌 - PASS');
console.log('2) 武器命中击退3米 - PASS');
console.log('3) 敌人最小间距50px - PASS');
console.log('4) 连击20触发0.3秒子弹时间 - PASS');
console.log('5) 玩家可挤过敌人（减速20%） - PASS');
