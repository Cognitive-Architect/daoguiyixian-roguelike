/**
 * WeaponSlots.ts
 * 三槽位武器UI数据 + 0.2s切换放大动画
 */

export interface WeaponSlotView {
    id: string | null;
    highlighted: boolean;
    scale: number;
}

export class WeaponSlots {
    private slots: Array<string | null> = [null, null, null];
    private currentSlot = 0;
    private animTimer = 0;
    private readonly animDuration = 0.2;

    public setSlots(ids: Array<string | null>): void {
        this.slots = [ids[0] ?? null, ids[1] ?? null, ids[2] ?? null];
    }

    public switchTo(slot: number): boolean {
        if (slot < 0 || slot >= this.slots.length || !this.slots[slot]) {
            return false;
        }
        this.currentSlot = slot;
        this.animTimer = this.animDuration;
        return true;
    }

    public update(deltaTime: number): void {
        if (this.animTimer > 0) {
            this.animTimer = Math.max(0, this.animTimer - deltaTime);
        }
    }

    public getViews(): WeaponSlotView[] {
        return this.slots.map((id, index) => {
            const highlighted = index === this.currentSlot;
            const scale = highlighted ? this.getHighlightScale() : 1;
            return { id, highlighted, scale };
        });
    }

    public getCurrentSlot(): number {
        return this.currentSlot;
    }

    private getHighlightScale(): number {
        if (this.animTimer <= 0) return 1;
        const t = this.animTimer / this.animDuration;
        return 1 + 0.2 * t;
    }
}
