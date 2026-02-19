/**
 * UISystem.ts
 * B-05 UI总管：聚合B-01~B-04状态并提供爽游反馈数据
 *
 * DEBT-UI-001: 动态字体加载暂未接入（系统字体）
 * DEBT-UI-002: Spine复杂动画待v0.5.0（当前为数值动画）
 */

import { EventBus, GameEvents } from '../core/EventBus';
import { HealthBar } from './components/HealthBar';
import { WeaponSlots } from './components/WeaponSlots';
import { UpgradeSelection } from './components/UpgradeSelection';
import { DamageNumber } from './components/DamageNumber';
import { ComboCounter } from './components/ComboCounter';
import { UpgradeOption } from '../upgrade/UpgradeOption';

export interface UISnapshot {
    lowSanityOverlay: boolean;
    sanityIcon: 'normal' | 'purple_flame';
    weaponViews: ReturnType<WeaponSlots['getViews']>;
    combo: number;
    comboGolden: boolean;
    upgradeShowing: boolean;
    timeScale: number;
}

export class UISystem {
    private static instance: UISystem;
    private readonly eventBus: EventBus;

    private readonly healthBar = new HealthBar();
    private readonly weaponSlots = new WeaponSlots();
    private readonly upgradeSelection = new UpgradeSelection();
    private readonly damageNumber = new DamageNumber();
    private readonly comboCounter = new ComboCounter();

    private sanityPercent = 100;
    private timeScale = 1;

    private constructor() {
        this.eventBus = EventBus.getInstance();
        this.setupEventListeners();
    }

    public static getInstance(): UISystem {
        if (!UISystem.instance) {
            UISystem.instance = new UISystem();
        }
        return UISystem.instance;
    }

    private setupEventListeners(): void {
        this.eventBus.on(GameEvents.PLAYER_DAMAGE, (payload?: { hp: number; maxHp: number }) => {
            if (!payload) return;
            this.healthBar.setHealth(payload.hp, payload.maxHp);
        });

        this.eventBus.on(GameEvents.PLAYER_HEAL, (payload?: { hp: number; maxHp: number }) => {
            if (!payload) return;
            this.healthBar.setHealth(payload.hp, payload.maxHp);
        });

        this.eventBus.on(GameEvents.SANITY_CHANGE, (payload?: { currentSan?: number; san?: number; maxSan?: number }) => {
            if (!payload) return;
            const maxSan = payload.maxSan ?? 100;
            const san = payload.currentSan ?? payload.san ?? maxSan;
            this.sanityPercent = Math.max(0, Math.min(100, (san / Math.max(1, maxSan)) * 100));
            this.healthBar.setSanity(san, maxSan);
        });

        this.eventBus.on('upgrade:exp_change', (payload?: { currentExp: number; expToLevel: number }) => {
            if (!payload) return;
            this.healthBar.setExperience(payload.currentExp, payload.expToLevel);
        });

        this.eventBus.on('weapon:switch', (payload?: { slot: number }) => {
            if (!payload) return;
            this.weaponSlots.switchTo(payload.slot);
        });

        this.eventBus.on('weapon:equip', () => {
            // 由外部调用 setWeaponSlots 更新展示数据
        });

        this.eventBus.on(GameEvents.UI_SHOW_UPGRADE, (payload?: { options?: UpgradeOption[] }) => {
            const options = payload?.options ?? [];
            this.upgradeSelection.show(options);
            this.timeScale = 0;
        });

        this.eventBus.on(GameEvents.GAME_RESUME, () => {
            this.timeScale = 1;
            this.upgradeSelection.hide();
        });

        this.eventBus.on(GameEvents.DAMAGE_DEALT, (payload?: { amount: number; x: number; y: number; isCrit?: boolean }) => {
            if (!payload) return;
            const lowSanity = this.sanityPercent < 30;
            this.damageNumber.push(payload.amount, { x: payload.x, y: payload.y }, payload.isCrit === true, lowSanity);
            this.comboCounter.hit();
        });
    }


    public resetStateForTest(): void {
        this.sanityPercent = 100;
        this.timeScale = 1;
        this.healthBar.setHealth(100, 100);
        this.healthBar.setSanity(100, 100);
        this.healthBar.setExperience(0, 100);
        this.weaponSlots.setSlots([null, null, null]);
        this.weaponSlots.switchTo(0);
        this.upgradeSelection.hide();
    }

    public update(deltaTime: number): void {
        this.weaponSlots.update(deltaTime);
        this.damageNumber.update(deltaTime);
        this.comboCounter.update(deltaTime);
    }

    public setWeaponSlots(ids: Array<string | null>): void {
        this.weaponSlots.setSlots(ids);
    }

    public getHealthBar(): HealthBar {
        return this.healthBar;
    }

    public getWeaponSlots(): WeaponSlots {
        return this.weaponSlots;
    }

    public getUpgradeSelection(): UpgradeSelection {
        return this.upgradeSelection;
    }

    public getDamageNumber(): DamageNumber {
        return this.damageNumber;
    }

    public getComboCounter(): ComboCounter {
        return this.comboCounter;
    }

    public getSnapshot(): UISnapshot {
        return {
            lowSanityOverlay: this.sanityPercent < 30,
            sanityIcon: this.sanityPercent < 30 ? 'purple_flame' : 'normal',
            weaponViews: this.weaponSlots.getViews(),
            combo: this.comboCounter.getCombo(),
            comboGolden: this.comboCounter.isGoldenFlash(),
            upgradeShowing: this.upgradeSelection.isShowing(),
            timeScale: this.timeScale,
        };
    }
}

export const uiSystem = UISystem.getInstance();
