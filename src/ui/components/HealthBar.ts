/**
 * HealthBar.ts
 * 玩家血量/SAN/经验条数据组件（大字号、安全区）
 *
 * DEBT-UI-001: 动态中文字体加载暂未接入（使用系统字体）
 */

export interface GaugeState {
    current: number;
    max: number;
    ratio: number;
}

export class HealthBar {
    private hp: GaugeState = { current: 100, max: 100, ratio: 1 };
    private san: GaugeState = { current: 100, max: 100, ratio: 1 };
    private exp: GaugeState = { current: 0, max: 100, ratio: 0 };

    public setHealth(current: number, max: number): void {
        this.hp = this.makeGauge(current, max);
    }

    public setSanity(current: number, max: number): void {
        this.san = this.makeGauge(current, max);
    }

    public setExperience(current: number, max: number): void {
        this.exp = this.makeGauge(current, max);
    }

    public getHealth(): GaugeState {
        return { ...this.hp };
    }

    public getSanity(): GaugeState {
        return { ...this.san };
    }

    public getExperience(): GaugeState {
        return { ...this.exp };
    }

    private makeGauge(current: number, max: number): GaugeState {
        const safeMax = Math.max(1, max);
        const safeCurrent = Math.max(0, Math.min(current, safeMax));
        return {
            current: safeCurrent,
            max: safeMax,
            ratio: safeCurrent / safeMax,
        };
    }
}
