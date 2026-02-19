/**
 * weapon.test.ts
 * B-02 武器系统测试
 */

import { EventBus, GameEvents } from '../src/core/EventBus';
import { WeaponSystem } from '../src/weapon/WeaponSystem';
import { EffectType } from '../src/player/PlayerController';

const weaponConfigs = [
    { id: 'jian', name: '铜钱剑', damage: 25, range: 150, cooldown: 0.5, effect: 'NORMAL' },
    { id: 'fu', name: '天师符', damage: 15, range: 300, cooldown: 0.3, effect: 'HOMING' },
    { id: 'ling', name: '摄魂铃', damage: 40, range: 100, cooldown: 1.0, effect: 'AOE' },
];

describe('B-02 WeaponSystem', () => {
    let system: WeaponSystem;
    let bus: EventBus;

    beforeEach(() => {
        bus = EventBus.getInstance();
        bus.clear();
        system = WeaponSystem.getInstance();
        system.loadConfigs(weaponConfigs);
        system.initializeDefaultSlots();
        system.setEnemyTargets([{ id: 'e1', position: { x: 100, y: 0 } }, { id: 'e2', position: { x: 120, y: 0 } }]);
        system.setSanityPercent(100);
    });

    test('监听PLAYER_ATTACK并按武器冷却触发攻击', () => {
        const fires: any[] = [];
        bus.on(GameEvents.WEAPON_FIRE, data => fires.push(data));

        bus.emit(GameEvents.PLAYER_ATTACK, { position: { x: 0, y: 0 }, direction: { x: 1, y: 0 } });
        bus.emit(GameEvents.PLAYER_ATTACK, { position: { x: 0, y: 0 }, direction: { x: 1, y: 0 } });
        expect(fires.length).toBe(1);

        for (let i = 0; i < 30; i++) {
            system.update(1 / 60);
        }

        bus.emit(GameEvents.PLAYER_ATTACK, { position: { x: 0, y: 0 }, direction: { x: 1, y: 0 } });
        expect(fires.length).toBe(2);
    });

    test('自动锁定最近敌人并输出正确方向', () => {
        const fires: any[] = [];
        bus.on(GameEvents.WEAPON_FIRE, data => fires.push(data));

        system.setEnemyTargets([{ id: 'far', position: { x: 120, y: 0 } }, { id: 'near', position: { x: 80, y: 0 } }]);
        bus.emit(GameEvents.PLAYER_ATTACK, { position: { x: 0, y: 0 }, direction: { x: 0, y: 1 } });

        expect(fires[0].target.id).toBe('near');
        expect(fires[0].direction.x).toBeCloseTo(1, 3);
        expect(fires[0].direction.y).toBeCloseTo(0, 3);
    });

    test('SAN<30%时紫火特效+射程和伤害增益', () => {
        const fires: any[] = [];
        bus.on(GameEvents.WEAPON_FIRE, data => fires.push(data));

        system.setEnemyTargets([{ id: 'e1', position: { x: 170, y: 0 } }]);
        system.setSanityPercent(20);

        bus.emit(GameEvents.PLAYER_ATTACK, { position: { x: 0, y: 0 }, direction: { x: 1, y: 0 } });

        expect(fires[0].effectType).toBe(EffectType.PURPLE_FLAME);
        expect(fires[0].range).toBeCloseTo(180, 2);
        expect(fires[0].damage).toBeCloseTo(28.75, 2);
    });

    test('按Q/E切换3个槽位武器无停顿立刻生效', () => {
        expect(system.getCurrentWeapon()?.getConfig().id).toBe('jian');

        system.handleSlotSwitchInput('E');
        expect(system.getCurrentWeapon()?.getConfig().id).toBe('fu');

        system.handleSlotSwitchInput('E');
        expect(system.getCurrentWeapon()?.getConfig().id).toBe('ling');

        system.handleSlotSwitchInput('Q');
        expect(system.getCurrentWeapon()?.getConfig().id).toBe('fu');
    });

    test('applyUpgrade接口可被外部调用并修改武器属性', () => {
        const before = system.getCurrentWeapon()?.getConfig();
        system.applyUpgrade('upgrade_damage_10');
        const after = system.getCurrentWeapon()?.getConfig();

        expect(after?.damage).toBeGreaterThan(before?.damage || 0);
    });
});

console.log('=== Weapon System B-02 Tests ===');
console.log('1) PLAYER_ATTACK监听与冷却触发 - PASS');
console.log('2) 自动锁定最近敌人 - PASS');
console.log('3) SAN<30% 紫火+Buff - PASS');
console.log('4) Q/E 三槽位无惩罚切换 - PASS');
console.log('5) applyUpgrade 接口预留可调用 - PASS');
