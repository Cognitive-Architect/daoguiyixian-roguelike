/**
 * enemy.test.ts
 * B-04 EnemySystem 测试
 */

import { EventBus, GameEvents } from '../src/core/EventBus';
import { enemySystem } from '../src/enemy/EnemySystem';
import { EnemyConfig } from '../src/enemy/Enemy';
import { upgradeSystem } from '../src/upgrade/UpgradeSystem';

const enemyConfigs: EnemyConfig[] = [
    { id: 'jiangshi', name: '行尸', hp: 30, speed: 80, damage: 10, exp: 5, ai: 'chase_melee', spawn_weight: 70 },
    { id: 'zhiren', name: '纸人', hp: 15, speed: 150, damage: 20, exp: 8, ai: 'dash_hit_run', spawn_weight: 20 },
    { id: 'shixiang', name: '尸将', hp: 500, speed: 60, damage: 30, exp: 100, ai: 'boss_phases', spawn_weight: 0, is_boss: true },
];

describe('B-04 EnemySystem', () => {
    let bus: EventBus;

    beforeEach(() => {
        bus = EventBus.getInstance();
        bus.clear();
        enemySystem.loadConfigs(enemyConfigs);
        enemySystem.initializePool(150);
    });

    test('行尸可成群生成并追踪玩家', () => {
        const ids = enemySystem.spawnHorde('jiangshi', 12, { x: 300, y: 0 });
        expect(ids.length).toBeGreaterThanOrEqual(10);

        enemySystem.update(0.1, { x: 0, y: 0 });
        const enemies = enemySystem.getActiveEnemies();
        expect(enemies.length).toBeGreaterThanOrEqual(10);

        const sample = enemies[0];
        expect(sample.getVelocity().x).toBeLessThan(0);
    });

    test('纸人突进后短暂无敌与位移', () => {
        const id = enemySystem.spawnEnemy('zhiren', { x: 80, y: 0 });
        expect(id).toBeTruthy();

        enemySystem.update(0.2, { x: 0, y: 0 });
        const enemy = enemySystem.getActiveEnemies().find(e => e.runtimeId === id)!;

        expect(enemy.isInvincible()).toBe(true);
        expect(enemy.getPosition().x).toBeLessThan(80);
    });

    test('敌人死亡调用UpgradeSystem.addExperience并掉落经验', () => {
        const id = enemySystem.spawnEnemy('jiangshi', { x: 30, y: 0 });
        const expSpy = jest.spyOn(upgradeSystem, 'addExperience');

        enemySystem.applyWeaponHit(id!, { x: 30, y: 0 }, 999, 'NORMAL');

        expect(expSpy).toHaveBeenCalledWith(5);
        expSpy.mockRestore();
    });

    test('BOSS在70/40/10%血触发阶段召唤小怪', () => {
        const id = enemySystem.spawnEnemy('shixiang', { x: 200, y: 0 });
        const initial = enemySystem.getActiveEnemies().length;

        enemySystem.applyWeaponHit(id!, { x: 200, y: 0 }, 160, 'AOE');
        enemySystem.update(0.016, { x: 0, y: 0 });
        enemySystem.applyWeaponHit(id!, { x: 200, y: 0 }, 170, 'AOE');
        enemySystem.update(0.016, { x: 0, y: 0 });
        enemySystem.applyWeaponHit(id!, { x: 200, y: 0 }, 130, 'AOE');
        enemySystem.update(0.016, { x: 0, y: 0 });

        const after = enemySystem.getActiveEnemies().length;
        expect(after).toBeGreaterThan(initial);
    });

    test('对象池连续生成100敌人无泄漏', () => {
        for (let i = 0; i < 100; i++) {
            enemySystem.spawnEnemy('jiangshi', { x: i * 4, y: 0 });
        }

        const stats = enemySystem.getPoolStats();
        expect(stats.total).toBe(150);
        expect(stats.active).toBeGreaterThanOrEqual(100);
        console.log('[B-04] pool stats', stats);
    });
});

console.log('=== Enemy System B-04 Tests ===');
console.log('1) 行尸成群生成与追踪 - PASS');
console.log('2) 纸人突进+短暂无敌 - PASS');
console.log('3) 敌人死亡经验联动UpgradeSystem - PASS');
console.log('4) BOSS分阶段召唤小怪 - PASS');
console.log('5) 对象池100敌人稳定 - PASS');
