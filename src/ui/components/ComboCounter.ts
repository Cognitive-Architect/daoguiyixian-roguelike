/**
 * ComboCounter.ts
 * 连击计数器（>10 金纹闪烁，5秒断连重置）
 */

export class ComboCounter {
    private combo = 0;
    private timeout = 0;
    private readonly resetWindow = 5;

    public hit(): void {
        this.combo += 1;
        this.timeout = this.resetWindow;
    }

    public update(deltaTime: number): void {
        if (this.timeout > 0) {
            this.timeout = Math.max(0, this.timeout - deltaTime);
            if (this.timeout === 0) {
                this.combo = 0;
            }
        }
    }

    public getCombo(): number {
        return this.combo;
    }

    public isGoldenFlash(): boolean {
        return this.combo > 10;
    }
}
