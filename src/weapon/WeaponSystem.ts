/**
 * WeaponSystem.ts
 * 武器系统 - 管理所有武器
 * 
 * 核心功能：
 * - 12种武器管理
 * - 伤害公式计算
 * - 武器切换
 * 
 * DEBT-B06-001: 暂时只做6种武器（非12种）
 */

import { EventBus, GameEvents } from '../core/EventBus';
import { Vector2 } from '../physics/AABB';
import { 
    WeaponBase, 
    WeaponConfig, 
    MeleeWeapon, 
    RangedWeapon,
    DamageResult 
} from './WeaponBase';

// 具体武器实现
class CopperSword extends MeleeWeapon {
    constructor(config: WeaponConfig) {
        super(config);
    }

    public attack(position: Vector2, direction: Vector2): void {
        if (!this.canAttack()) return;

        const damage = this.getDamage();
        this.resetCooldown();
        this.recordDamage(damage.finalDamage);

        // 发送近战攻击事件
        this.eventBus.emit(GameEvents.WEAPON_FIRE, {
            weaponId: this.config.id,
            type: 'melee',
            position,
            direction,
            range: this.config.attackRange,
            angle: this.attackAngle,
            damage: damage.finalDamage,
            isCrit: damage.isCrit,
        });
    }
}

class DaQianLu extends RangedWeapon {
    constructor(config: WeaponConfig) {
        super(config);
    }

    public attack(position: Vector2, direction: Vector2): void {
        if (!this.canAttack()) return;

        const damage = this.getDamage();
        this.resetCooldown();
        this.recordDamage(damage.finalDamage);

        // 发射抛物线投射物
        this.fireProjectile(position, direction, damage.finalDamage);

        // 溅射效果在命中时处理
    }
}

class XinSuBlackFire extends RangedWeapon {
    constructor(config: WeaponConfig) {
        super(config);
    }

    public attack(position: Vector2, direction: Vector2): void {
        if (!this.canAttack()) return;

        const damage = this.getDamage();
        
        // 低SAN伤害加成
        if (this.config.sanityInteraction === 'low_sanity_bonus') {
            const threshold = this.config.sanityParams?.threshold || 30;
            // 实际加成在getDamage中通过sanitySystem处理
        }

        this.resetCooldown();
        this.recordDamage(damage.finalDamage);

        // 发射追踪投射物
        this.fireProjectile(position, direction, damage.finalDamage);
    }
}

class PeachSword extends MeleeWeapon {
    constructor(config: WeaponConfig) {
        super(config);
    }

    public attack(position: Vector2, direction: Vector2): void {
        if (!this.canAttack()) return;

        const damage = this.getDamage();
        this.resetCooldown();
        this.recordDamage(damage.finalDamage);

        // 眩晕效果在命中时处理
        this.eventBus.emit(GameEvents.WEAPON_FIRE, {
            weaponId: this.config.id,
            type: 'melee',
            position,
            direction,
            range: this.config.attackRange,
            angle: this.attackAngle,
            damage: damage.finalDamage,
            isCrit: damage.isCrit,
            effect: 'stun',
            effectChance: this.config.specialParams?.chance || 0.15,
            effectDuration: this.config.specialParams?.duration || 1.5,
        });
    }
}

class SpineSword extends MeleeWeapon {
    constructor(config: WeaponConfig) {
        super(config);
    }

    public attack(position: Vector2, direction: Vector2): void {
        if (!this.canAttack()) return;

        const damage = this.getDamage();
        this.resetCooldown();
        this.recordDamage(damage.finalDamage);

        // 吸血效果在命中时处理
        this.eventBus.emit(GameEvents.WEAPON_FIRE, {
            weaponId: this.config.id,
            type: 'melee',
            position,
            direction,
            range: this.config.attackRange,
            angle: this.attackAngle,
            damage: damage.finalDamage,
            isCrit: damage.isCrit,
            effect: 'life_steal',
            lifeStealPercent: this.config.specialParams?.lifeStealPercent || 0.15,
        });
    }
}

class YinYangTalisman extends RangedWeapon {
    constructor(config: WeaponConfig) {
        super(config);
    }

    public attack(position: Vector2, direction: Vector2): void {
        if (!this.canAttack()) return;

        const damage = this.getDamage();
        this.resetCooldown();
        this.recordDamage(damage.finalDamage);

        // 发射直线投射物
        this.fireProjectile(position, direction, damage.finalDamage);
    }
}

export class WeaponSystem {
    private static instance: WeaponSystem;
    private eventBus: EventBus;
    
    // 武器配置
    private weaponConfigs: Map<string, WeaponConfig> = new Map();
    
    // 武器实例
    private weapons: Map<string, WeaponBase> = new Map();
    
    // 当前装备
    private equippedWeaponId: string | null = null;
    
    // 武器槽位
    private weaponSlots: (string | null)[] = [null, null, null, null];
    private currentSlot: number = 0;

    private constructor() {
        this.eventBus = EventBus.getInstance();
    }

    public static getInstance(): WeaponSystem {
        if (!WeaponSystem.instance) {
            WeaponSystem.instance = new WeaponSystem();
        }
        return WeaponSystem.instance;
    }

    /**
     * 加载武器配置
     */
    public loadConfigs(configs: WeaponConfig[]): void {
        this.weaponConfigs.clear();
        for (const config of configs) {
            this.weaponConfigs.set(config.id, config);
        }
        console.log(`[WeaponSystem] Loaded ${configs.length} weapon configs`);
    }

    /**
     * 从JSON加载配置
     */
    public async loadConfigsFromJson(jsonPath: string): Promise<void> {
        try {
            const response = await fetch(jsonPath);
            const data = await response.json();
            this.loadConfigs(data.weapons);
        } catch (error) {
            console.error('[WeaponSystem] Failed to load configs:', error);
        }
    }

    /**
     * 创建武器实例
     */
    public createWeapon(weaponId: string): WeaponBase | null {
        const config = this.weaponConfigs.get(weaponId);
        if (!config) {
            console.error(`[WeaponSystem] Weapon config not found: ${weaponId}`);
            return null;
        }

        // 根据类型创建实例
        let weapon: WeaponBase;
        switch (config.id) {
            case 'copper_sword':
                weapon = new CopperSword(config);
                break;
            case 'da_qian_lu':
                weapon = new DaQianLu(config);
                break;
            case 'xin_su_black_fire':
                weapon = new XinSuBlackFire(config);
                break;
            case 'peach_sword':
                weapon = new PeachSword(config);
                break;
            case 'spine_sword':
                weapon = new SpineSword(config);
                break;
            case 'yin_yang_talisman':
                weapon = new YinYangTalisman(config);
                break;
            default:
                // 默认使用近战武器
                weapon = new CopperSword(config);
        }

        this.weapons.set(weaponId, weapon);
        return weapon;
    }

    /**
     * 装备武器到槽位
     */
    public equipWeapon(weaponId: string, slot: number = -1): boolean {
        // 确保武器实例存在
        if (!this.weapons.has(weaponId)) {
            this.createWeapon(weaponId);
        }

        const weapon = this.weapons.get(weaponId);
        if (!weapon) return false;

        // 自动选择槽位
        if (slot < 0) {
            slot = this.weaponSlots.findIndex(s => s === null);
            if (slot < 0) slot = this.currentSlot;
        }

        // 装备
        this.weaponSlots[slot] = weaponId;
        this.currentSlot = slot;
        this.equippedWeaponId = weaponId;

        console.log(`[WeaponSystem] Equipped ${weapon.getName()} to slot ${slot}`);
        
        this.eventBus.emit('weapon:equip', { weaponId, slot });
        
        return true;
    }

    /**
     * 切换武器
     */
    public switchWeapon(slot: number): boolean {
        if (slot < 0 || slot >= this.weaponSlots.length) return false;
        
        const weaponId = this.weaponSlots[slot];
        if (!weaponId) return false;

        this.currentSlot = slot;
        this.equippedWeaponId = weaponId;

        console.log(`[WeaponSystem] Switched to slot ${slot}: ${weaponId}`);
        
        this.eventBus.emit('weapon:switch', { weaponId, slot });
        
        return true;
    }

    /**
     * 攻击
     */
    public attack(position: Vector2, direction: Vector2): boolean {
        const weapon = this.getEquippedWeapon();
        if (!weapon) return false;

        if (!weapon.canAttack()) return false;

        weapon.attack(position, direction);
        
        this.eventBus.emit(GameEvents.PLAYER_ATTACK, {
            weaponId: weapon.getId(),
            position,
            direction,
        });

        return true;
    }

    /**
     * 更新所有武器
     */
    public update(deltaTime: number): void {
        for (const weapon of this.weapons.values()) {
            weapon.update(deltaTime);
        }
    }

    /**
     * 升级武器
     */
    public upgradeWeapon(weaponId: string): boolean {
        const weapon = this.weapons.get(weaponId);
        if (!weapon) return false;

        return weapon.upgrade();
    }

    /**
     * 计算伤害
     */
    public calculateDamage(weaponId: string): DamageResult | null {
        const weapon = this.weapons.get(weaponId);
        if (!weapon) return null;

        return weapon.getDamage();
    }

    // ============ Getters ============

    public getEquippedWeapon(): WeaponBase | null {
        if (!this.equippedWeaponId) return null;
        return this.weapons.get(this.equippedWeaponId) || null;
    }

    public getWeapon(weaponId: string): WeaponBase | null {
        return this.weapons.get(weaponId) || null;
    }

    public getWeaponInSlot(slot: number): WeaponBase | null {
        const weaponId = this.weaponSlots[slot];
        if (!weaponId) return null;
        return this.weapons.get(weaponId) || null;
    }

    public getCurrentSlot(): number {
        return this.currentSlot;
    }

    public getWeaponSlots(): (string | null)[] {
        return [...this.weaponSlots];
    }

    public getAllWeapons(): WeaponBase[] {
        return Array.from(this.weapons.values());
    }

    public getWeaponConfig(weaponId: string): WeaponConfig | undefined {
        return this.weaponConfigs.get(weaponId);
    }

    public getEquippedWeaponCooldown(): number {
        const weapon = this.getEquippedWeapon();
        if (!weapon) return 0;
        return weapon.getCooldownProgress();
    }
}

// 便捷导出单例
export const weaponSystem = WeaponSystem.getInstance();
