/**
 * DamageNumber.ts
 * 伤害数字跳屏与颜色策略（普通/暴击/SAN紫火）
 */

import { Vector2 } from '../../physics/AABB';

export interface DamageNumberItem {
    value: number;
    position: Vector2;
    isCrit: boolean;
    color: 'white' | 'gold' | 'purple';
    life: number;
    scale: number;
}

export class DamageNumber {
    private items: DamageNumberItem[] = [];

    public push(value: number, position: Vector2, isCrit: boolean, lowSanity: boolean): void {
        const color: DamageNumberItem['color'] = lowSanity ? 'purple' : isCrit ? 'gold' : 'white';
        const scale = isCrit ? 1.8 : 1.2;
        this.items.push({ value, position: { ...position }, isCrit, color, life: 1, scale });
    }

    public update(deltaTime: number): void {
        for (const item of this.items) {
            item.life -= deltaTime;
            item.position.y -= 60 * deltaTime;
        }
        this.items = this.items.filter(item => item.life > 0);
    }

    public getItems(): DamageNumberItem[] {
        return this.items.map(item => ({ ...item, position: { ...item.position } }));
    }
}
