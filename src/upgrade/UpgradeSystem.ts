/**
 * UpgradeSystem.ts
 * B-03 升级系统：经验循环、三选一、与武器系统联动
 *
 * DEBT-UPG-001: 局内重置仅预留接口（v0.5.0实现资源消耗与返还）
 * DEBT-UPG-002: 金纹爆发/时间缓停依赖B-05 UI（当前仅console.log）
 */

import { EventBus, GameEvents } from '../core/EventBus';
import { Vector2 } from '../physics/AABB';
import { gameManager } from '../core/GameManager';
import { weaponSystem } from '../weapon/WeaponSystem';
import { UpgradeConfigItem, UpgradeOption, UpgradeOptionFactory } from './UpgradeOption';

interface UpgradeConfigFile {
    upgrades: UpgradeConfigItem[];
}

interface ExpOrb {
    id: string;
    position: Vector2;
    value: number;
}

const BASE_EXP_TO_LEVEL = 100;
const EXP_GROWTH = 1.25;
const ORB_ABSORB_SPEED = 600;

export class UpgradeSystem {
    private static instance: UpgradeSystem;
    private readonly eventBus: EventBus;

    private upgradePool: UpgradeConfigItem[] = [];
    private selectedUpgradeIds: string[] = [];

    private expOrbs: ExpOrb[] = [];
    private currentExp = 0;
    private expToLevel = BASE_EXP_TO_LEVEL;
    private level = 1;

    private pendingOptions: UpgradeOption[] = [];
    private sanityPercent = 100;

    private constructor() {
        this.eventBus = EventBus.getInstance();
        this.setupEventListeners();
    }

    public static getInstance(): UpgradeSystem {
        if (!UpgradeSystem.instance) {
            UpgradeSystem.instance = new UpgradeSystem();
        }
        return UpgradeSystem.instance;
    }

    private setupEventListeners(): void {
        this.eventBus.on(GameEvents.ENEMY_DEATH, (payload?: { position?: Vector2; exp?: number }) => {
            if (!payload?.position) return;
            this.spawnExpOrb(payload.position, payload.exp ?? 20);
        });

        this.eventBus.on(GameEvents.SANITY_CHANGE, (payload?: { san?: number; currentSan?: number; maxSan?: number }) => {
            if (!payload) return;
            const maxSan = payload.maxSan ?? 100;
            const currentSan = payload.currentSan ?? payload.san ?? 100;
            this.setSanityPercent((currentSan / maxSan) * 100);
        });
    }

    public async loadConfigFromJson(path: string): Promise<void> {
        const response = await fetch(path);
        const data = (await response.json()) as UpgradeConfigFile;
        this.loadConfig(data.upgrades);
    }

    public loadConfig(upgrades: UpgradeConfigItem[]): void {
        this.upgradePool = [...upgrades];
    }

    public spawnExpOrb(position: Vector2, value: number = 20): void {
        this.expOrbs.push({
            id: `orb_${Date.now()}_${Math.random().toString(16).slice(2)}`,
            position: { ...position },
            value,
        });
        this.eventBus.emit('upgrade:exp_orb_spawn', { position, value });
    }

    public update(deltaTime: number, playerPosition: Vector2): void {
        this.absorbExpOrbs(deltaTime, playerPosition);
    }

    private absorbExpOrbs(deltaTime: number, playerPosition: Vector2): void {
        const remained: ExpOrb[] = [];

        for (const orb of this.expOrbs) {
            const dx = playerPosition.x - orb.position.x;
            const dy = playerPosition.y - orb.position.y;
            const distance = Math.hypot(dx, dy);

            if (distance < 10) {
                this.addExp(orb.value);
                continue;
            }

            const step = ORB_ABSORB_SPEED * deltaTime;
            const t = distance > 0 ? Math.min(1, step / distance) : 1;
            orb.position.x += dx * t;
            orb.position.y += dy * t;
            remained.push(orb);
        }

        this.expOrbs = remained;
    }


    public addExperience(amount: number): void {
        this.addExp(amount);
    }
    public addExp(amount: number): void {
        this.currentExp += amount;

        if (this.currentExp >= this.expToLevel) {
            this.currentExp -= this.expToLevel;
            this.level += 1;
            this.expToLevel = Math.floor(this.expToLevel * EXP_GROWTH);
            this.triggerUpgradeSelection();
        }

        this.eventBus.emit('upgrade:exp_change', {
            currentExp: this.currentExp,
            expToLevel: this.expToLevel,
            level: this.level,
        });
    }

    private triggerUpgradeSelection(): void {
        this.pendingOptions = this.getUpgradeOptions();

        gameManager.pause();
        this.eventBus.emit(GameEvents.UI_SHOW_UPGRADE, { options: this.pendingOptions });

        // 爽游化仪式感（B-05接入实际表现）
        console.log('[UpgradeSystem] Golden burst + time stop trigger');
    }

    public getUpgradeOptions(): UpgradeOption[] {
        const available = this.upgradePool.filter(item => !this.selectedUpgradeIds.includes(item.id));
        return UpgradeOptionFactory.buildOptions(available, this.sanityPercent, 3);
    }

    public selectUpgrade(upgradeId: string): boolean {
        let option = this.pendingOptions.find(item => item.id === upgradeId);
        if (!option) {
            const config = this.upgradePool.find(item => item.id === upgradeId);
            if (!config) {
                return false;
            }
            option = UpgradeOptionFactory.toOption(config, this.sanityPercent);
        }

        this.selectedUpgradeIds.push(option.id);
        this.applyUpgrade(option);
        this.pendingOptions = [];
        gameManager.resume();
        this.eventBus.emit(GameEvents.UPGRADE_SELECT, option);
        return true;
    }

    public applyUpgrade(optionOrId: UpgradeOption | string): void {
        let option: UpgradeOption | undefined;
        if (typeof optionOrId === 'string') {
            const config = this.upgradePool.find(item => item.id === optionOrId);
            if (!config) return;
            option = UpgradeOptionFactory.toOption(config, this.sanityPercent);
        } else {
            option = optionOrId;
        }

        if (option.type === 'weapon_effect' || option.type === 'weapon_stat') {
            weaponSystem.applyUpgrade(option.id);
        }

        this.eventBus.emit('upgrade:applied', option);
    }

    public resetUpgrades(): boolean {
        this.selectedUpgradeIds = [];
        this.pendingOptions = [];
        return true;
    }

    public setSanityPercent(percent: number): void {
        this.sanityPercent = Math.max(0, Math.min(100, percent));
    }

    public getSanityPercent(): number {
        return this.sanityPercent;
    }

    public getExpOrbs(): ExpOrb[] {
        return this.expOrbs.map(orb => ({ ...orb, position: { ...orb.position } }));
    }

    public getPendingOptions(): UpgradeOption[] {
        return [...this.pendingOptions];
    }
}

export const upgradeSystem = UpgradeSystem.getInstance();
