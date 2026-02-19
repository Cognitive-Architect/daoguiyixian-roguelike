/**
 * UpgradeSelection.ts
 * 三选一升级面板数据容器（中央60%）
 */

import { UpgradeOption } from '../../upgrade/UpgradeOption';

export class UpgradeSelection {
    private showing = false;
    private options: UpgradeOption[] = [];

    public show(options: UpgradeOption[]): void {
        this.options = options.slice(0, 3);
        this.showing = true;
    }

    public hide(): void {
        this.showing = false;
        this.options = [];
    }

    public isShowing(): boolean {
        return this.showing;
    }

    public getOptions(): UpgradeOption[] {
        return [...this.options];
    }

    public getPanelRect(screenWidth: number, screenHeight: number): { x: number; y: number; width: number; height: number } {
        const width = screenWidth * 0.6;
        const height = screenHeight * 0.6;
        return {
            x: (screenWidth - width) / 2,
            y: (screenHeight - height) / 2,
            width,
            height,
        };
    }
}
