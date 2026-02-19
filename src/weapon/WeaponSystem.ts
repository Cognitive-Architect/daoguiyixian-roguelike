/**
 * WeaponSystem.ts
 * 武器系统（B-02）
 * - 数据驱动武器配置
 * - 监听PLAYER_ATTACK事件并自动触发武器攻击
 * - 三槽位切换（无CD无惩罚）
 *
 * DEBT-WEAPON-001: 暂不支持武器换弹/耐久度（无限弹药，割草爽游）
 */

import { EventBus, GameEvents } from '../core/EventBus';
import { Vector2 } from '../physics/AABB';
import { Weapon, WeaponConfig, EnemyTarget, WeaponFireResult } from './Weapon';

export interface WeaponSystemConfig {
    weapons: WeaponConfig[];
}

interface PlayerAttackPayload {
    position: Vector2;
    direction: Vector2;
}

interface SanityChangePayload {
    san?: number;
    currentSan?: number;
    maxSan?: number;
}

export class WeaponSystem {
    private static instance: WeaponSystem;
    private readonly eventBus: EventBus;

    private weaponConfigs: Map<string, WeaponConfig> = new Map();
    private weaponSlots: Array<Weapon | null> = [null, null, null];
    private currentSlot = 0;
    private enemyTargets: EnemyTarget[] = [];
    private sanityPercent = 100;

    private readonly weaponIdAlias: Record<string, string> = {
        copper_sword: 'jian',
        yin_yang_talisman: 'fu',
        peach_sword: 'ling',
    };

    private constructor() {
        this.eventBus = EventBus.getInstance();
        this.setupEventListeners();
    }

    public static getInstance(): WeaponSystem {
        if (!WeaponSystem.instance) {
            WeaponSystem.instance = new WeaponSystem();
        }
        return WeaponSystem.instance;
    }

    private setupEventListeners(): void {
        this.eventBus.on(GameEvents.PLAYER_ATTACK, (payload?: PlayerAttackPayload) => {
            if (!payload) return;
            this.fireFromPlayerAttack(payload);
        });

        this.eventBus.on(GameEvents.SANITY_CHANGE, (payload?: SanityChangePayload) => {
            if (!payload) return;
            const maxSan = payload.maxSan ?? 100;
            const currentSan = payload.currentSan ?? payload.san ?? 100;
            this.setSanityPercent((currentSan / maxSan) * 100);
        });

        this.eventBus.on('ui:weapon:switch:prev', () => this.switchPrev());
        this.eventBus.on('ui:weapon:switch:next', () => this.switchNext());
    }

    public async loadConfigsFromJson(jsonPath: string): Promise<void> {
        const response = await fetch(jsonPath);
        const data = (await response.json()) as WeaponSystemConfig;
        this.loadConfigs(data.weapons);
    }

    public loadConfigs(configs: WeaponConfig[]): void {
        this.weaponConfigs.clear();
        for (const config of configs) {
            this.weaponConfigs.set(config.id, { ...config });
        }
    }

    public initializeDefaultSlots(ids: string[] = ['jian', 'fu', 'ling']): void {
        for (let i = 0; i < 3; i++) {
            const id = ids[i];
            if (!id) {
                this.weaponSlots[i] = null;
                continue;
            }
            this.weaponSlots[i] = this.createWeapon(id);
        }
        this.currentSlot = 0;
    }

    public setEnemyTargets(targets: EnemyTarget[]): void {
        this.enemyTargets = [...targets];
    }

    public setSanityPercent(percent: number): void {
        this.sanityPercent = Math.max(0, Math.min(100, percent));
    }

    public update(deltaTime: number): void {
        for (const weapon of this.weaponSlots) {
            weapon?.update(deltaTime);
        }
    }

    public handleSlotSwitchInput(input: 'Q' | 'E'): void {
        if (input === 'Q') {
            this.switchPrev();
            return;
        }
        this.switchNext();
    }

    public switchToSlot(slot: number): boolean {
        if (slot < 0 || slot >= this.weaponSlots.length) {
            return false;
        }
        if (!this.weaponSlots[slot]) {
            return false;
        }
        this.currentSlot = slot;
        this.eventBus.emit('weapon:switch', { slot, weaponId: this.weaponSlots[slot]?.getConfig().id });
        return true;
    }

    public switchNext(): boolean {
        for (let i = 1; i <= this.weaponSlots.length; i++) {
            const slot = (this.currentSlot + i) % this.weaponSlots.length;
            if (this.weaponSlots[slot]) {
                return this.switchToSlot(slot);
            }
        }
        return false;
    }

    public switchPrev(): boolean {
        for (let i = 1; i <= this.weaponSlots.length; i++) {
            const slot = (this.currentSlot - i + this.weaponSlots.length) % this.weaponSlots.length;
            if (this.weaponSlots[slot]) {
                return this.switchToSlot(slot);
            }
        }
        return false;
    }

    public fireFromPlayerAttack(payload: PlayerAttackPayload): WeaponFireResult | null {
        const weapon = this.weaponSlots[this.currentSlot];
        if (!weapon) {
            return null;
        }

        const result = weapon.tryFire(payload.position, payload.direction, this.enemyTargets, this.sanityPercent);
        if (!result) {
            return null;
        }

        this.eventBus.emit(GameEvents.WEAPON_FIRE, {
            weaponId: result.weaponId,
            weaponName: result.weaponName,
            position: payload.position,
            direction: result.direction,
            target: result.target,
            damage: result.damage,
            range: result.range,
            effectType: result.effectType,
            baseEffect: result.baseEffect,
        });

        return result;
    }

    public applyUpgrade(upgradeId: string): void {
        // 供B-03调用：这里只做基础映射，可继续扩展为配置表驱动
        switch (upgradeId) {
            case 'upgrade_damage_10':
                this.applyToAllWeapons(1.1, 1, 1);
                break;
            case 'upgrade_range_15':
                this.applyToAllWeapons(1, 1.15, 1);
                break;
            case 'upgrade_attack_speed_20':
                this.applyToAllWeapons(1, 1, 0.8);
                break;
            default:
                break;
        }
    }

    private applyToAllWeapons(damageMultiplier: number, rangeMultiplier: number, cooldownMultiplier: number): void {
        for (const weapon of this.weaponSlots) {
            weapon?.applyMultiplier(damageMultiplier, rangeMultiplier, cooldownMultiplier);
        }
    }

    private createWeapon(weaponId: string): Weapon | null {
        const resolvedId = this.weaponIdAlias[weaponId] || weaponId;
        const config = this.weaponConfigs.get(resolvedId);
        if (!config) {
            return null;
        }
        return new Weapon(config);
    }

    public getCurrentSlot(): number {
        return this.currentSlot;
    }

    public getCurrentWeapon(): Weapon | null {
        return this.weaponSlots[this.currentSlot];
    }

    public getWeaponSlots(): Array<string | null> {
        return this.weaponSlots.map(weapon => (weapon ? weapon.getConfig().id : null));
    }

    public getWeapon(id: string): Weapon | null {
        const resolved = this.weaponIdAlias[id] || id;
        for (const weapon of this.weaponSlots) {
            if (weapon?.getConfig().id === resolved) {
                return weapon;
            }
        }
        return null;
    }

    public equipWeapon(weaponId: string, slot: number = this.currentSlot): boolean {
        if (slot < 0 || slot >= this.weaponSlots.length) {
            return false;
        }

        const weapon = this.createWeapon(weaponId);
        if (!weapon) {
            return false;
        }

        this.weaponSlots[slot] = weapon;
        this.currentSlot = slot;
        this.eventBus.emit('weapon:equip', { slot, weaponId: weapon.getConfig().id });
        return true;
    }

    public getSanityPercent(): number {
        return this.sanityPercent;
    }
}

export const weaponSystem = WeaponSystem.getInstance();
