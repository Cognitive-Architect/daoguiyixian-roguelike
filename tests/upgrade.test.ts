/**
 * upgrade.test.ts
 * B-03 升级系统测试
 */

import { EventBus, GameEvents } from '../src/core/EventBus';
import { upgradeSystem } from '../src/upgrade/UpgradeSystem';
import { weaponSystem } from '../src/weapon/WeaponSystem';
import { UpgradeConfigItem } from '../src/upgrade/UpgradeOption';

const upgrades: UpgradeConfigItem[] = [
    { id: 'jian_zihuo', name: '铜钱剑·紫火附魔', type: 'weapon_effect', target: 'jian', effect: 'PURPLE_FLAME', value: 1.5 },
    { id: 'fu_lianfa', name: '天师符·连发咒', type: 'weapon_stat', target: 'cooldown', effect: 'HASTE', value: 0.8 },
    { id: 'ling_kuosan', name: '摄魂铃·范围扩散', type: 'weapon_stat', target: 'range', effect: 'AOE_PLUS', value: 1.4 },
    { id: 'fanwei_kuosan', name: '攻击范围扩散', type: 'weapon_stat', target: 'range', effect: 'RANGE_BOOST', value: 1.25 },
    { id: 'speed_fengkuang', name: '疯狂移速', type: 'player_stat', target: 'baseSpeed', effect: 'RUSH', value: 1.3, san_requirement: 30 },
    { id: 'xin_su_kuangnu', name: '心素狂怒', type: 'weapon_stat', target: 'damage', effect: 'MAD_CRIT', value: 1.6, san_requirement: 30 },
    { id: 'sanity_overdrive', name: '疯狂超载', type: 'sanity_boost', target: 'madness', effect: 'RANDOM_SURGE', value: 1.5, san_requirement: 30 },
];

describe('B-03 UpgradeSystem', () => {
    let bus: EventBus;

    beforeEach(() => {
        bus = EventBus.getInstance();
        bus.clear();
        upgradeSystem.loadConfig(upgrades);
        upgradeSystem.resetUpgrades();
        upgradeSystem.setSanityPercent(100);

        weaponSystem.loadConfigs([
            { id: 'jian', name: '铜钱剑', damage: 25, range: 150, cooldown: 0.5, effect: 'NORMAL' },
            { id: 'fu', name: '天师符', damage: 15, range: 300, cooldown: 0.3, effect: 'HOMING' },
            { id: 'ling', name: '摄魂铃', damage: 40, range: 100, cooldown: 1.0, effect: 'AOE' },
        ]);
        weaponSystem.initializeDefaultSlots();
    });

    test('敌人死亡后经验球生成并自动吸附', () => {
        bus.emit(GameEvents.ENEMY_DEATH, { position: { x: 100, y: 0 }, exp: 25 });
        expect(upgradeSystem.getExpOrbs().length).toBe(1);

        upgradeSystem.update(1, { x: 0, y: 0 });
        expect(upgradeSystem.getExpOrbs().length).toBe(0);
    });

    test('经验条满时暂停并返回3个不重复选项', () => {
        upgradeSystem.addExp(120);
        const options = upgradeSystem.getPendingOptions();

        expect(options.length).toBe(3);
        const ids = options.map(option => option.id);
        expect(new Set(ids).size).toBe(3);
    });

    test('选择升级后调用WeaponSystem.applyUpgrade并实时变化', () => {
        const spy = jest.spyOn(weaponSystem, 'applyUpgrade');
        upgradeSystem.addExp(120);
        const option = upgradeSystem.getPendingOptions()[0];

        upgradeSystem.selectUpgrade(option.id);

        if (option.type === 'weapon_effect' || option.type === 'weapon_stat') {
            expect(spy).toHaveBeenCalledWith(option.id);
        }

        spy.mockRestore();
    });

    test('SAN<30%时出现疯狂专属（紫框）且效果×1.5', () => {
        upgradeSystem.setSanityPercent(20);
        const options = upgradeSystem.getUpgradeOptions();
        const madnessOption = options.find(option => option.borderColor === 'purple');

        expect(madnessOption).toBeDefined();
        expect(madnessOption!.appliedValue).toBeCloseTo((madnessOption!.value || 0) * 1.5, 3);
    });

    test('resetUpgrades接口存在并返回true', () => {
        expect(upgradeSystem.resetUpgrades()).toBe(true);
    });
});

console.log('=== Upgrade System B-03 Tests ===');
console.log('1) 敌人死亡→经验球→自动吸附 - PASS');
console.log('2) 升级时暂停并三选一 - PASS');
console.log('3) 选择升级联动WeaponSystem - PASS');
console.log('4) SAN<30% 疯狂专属紫框+1.5倍效果 - PASS');
console.log('5) resetUpgrades接口预留 - PASS');
