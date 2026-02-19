/**
 * AABB.ts
 * 轴对齐包围盒 (Axis-Aligned Bounding Box)
 * 简化确定性物理系统 - 无Box2D
 * 
 * DEBT-B01-002: 物理用AABB碰撞（非Box2D）
 */

export interface Vector2 {
    x: number;
    y: number;
}

export class Vec2 implements Vector2 {
    public x: number;
    public y: number;

    constructor(x: number = 0, y: number = 0) {
        this.x = x;
        this.y = y;
    }

    public set(x: number, y: number): Vec2 {
        this.x = x;
        this.y = y;
        return this;
    }

    public clone(): Vec2 {
        return new Vec2(this.x, this.y);
    }

    public add(v: Vector2): Vec2 {
        return new Vec2(this.x + v.x, this.y + v.y);
    }

    public sub(v: Vector2): Vec2 {
        return new Vec2(this.x - v.x, this.y - v.y);
    }

    public multiply(scalar: number): Vec2 {
        return new Vec2(this.x * scalar, this.y * scalar);
    }

    public length(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    public normalize(): Vec2 {
        const len = this.length();
        if (len === 0) return new Vec2(0, 0);
        return new Vec2(this.x / len, this.y / len);
    }

    public distance(v: Vector2): number {
        const dx = this.x - v.x;
        const dy = this.y - v.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    public static zero(): Vec2 {
        return new Vec2(0, 0);
    }

    public static one(): Vec2 {
        return new Vec2(1, 1);
    }

    public static up(): Vec2 {
        return new Vec2(0, 1);
    }

    public static right(): Vec2 {
        return new Vec2(1, 0);
    }
}

export interface AABB {
    min: Vector2;
    max: Vector2;
}

export class BoundingBox implements AABB {
    public min: Vector2;
    public max: Vector2;

    constructor(min: Vector2 = { x: 0, y: 0 }, max: Vector2 = { x: 0, y: 0 }) {
        this.min = { ...min };
        this.max = { ...max };
    }

    /**
     * 从中心点和尺寸创建包围盒
     */
    public static fromCenter(center: Vector2, width: number, height: number): BoundingBox {
        const halfW = width / 2;
        const halfH = height / 2;
        return new BoundingBox(
            { x: center.x - halfW, y: center.y - halfH },
            { x: center.x + halfW, y: center.y + halfH }
        );
    }

    /**
     * 获取中心点
     */
    public getCenter(): Vector2 {
        return {
            x: (this.min.x + this.max.x) / 2,
            y: (this.min.y + this.max.y) / 2
        };
    }

    /**
     * 获取尺寸
     */
    public getSize(): Vector2 {
        return {
            x: this.max.x - this.min.x,
            y: this.max.y - this.min.y
        };
    }

    /**
     * 获取宽度
     */
    public getWidth(): number {
        return this.max.x - this.min.x;
    }

    /**
     * 获取高度
     */
    public getHeight(): number {
        return this.max.y - this.min.y;
    }

    /**
     * 移动包围盒
     */
    public translate(delta: Vector2): void {
        this.min.x += delta.x;
        this.min.y += delta.y;
        this.max.x += delta.x;
        this.max.y += delta.y;
    }

    /**
     * 设置位置（保持尺寸）
     */
    public setPosition(position: Vector2): void {
        const size = this.getSize();
        this.min.x = position.x;
        this.min.y = position.y;
        this.max.x = position.x + size.x;
        this.max.y = position.y + size.y;
    }

    /**
     * 扩展包围盒
     */
    public expand(amount: number): void {
        this.min.x -= amount;
        this.min.y -= amount;
        this.max.x += amount;
        this.max.y += amount;
    }

    /**
     * 检查点是否在包围盒内
     */
    public contains(point: Vector2): boolean {
        return point.x >= this.min.x && point.x <= this.max.x &&
               point.y >= this.min.y && point.y <= this.max.y;
    }

    /**
     * 检查与另一个AABB是否相交
     */
    public intersects(other: AABB): boolean {
        return this.min.x < other.max.x && this.max.x > other.min.x &&
               this.min.y < other.max.y && this.max.y > other.min.y;
    }

    /**
     * 克隆
     */
    public clone(): BoundingBox {
        return new BoundingBox(
            { ...this.min },
            { ...this.max }
        );
    }
}

/**
 * AABB碰撞检测工具类
 */
export class AABBPhysics {
    /**
     * 检测两个AABB是否碰撞
     */
    public static intersects(a: AABB, b: AABB): boolean {
        return a.min.x < b.max.x && a.max.x > b.min.x &&
               a.min.y < b.max.y && a.max.y > b.min.y;
    }

    /**
     * 获取碰撞信息（如果有碰撞）
     */
    public static getIntersection(a: AABB, b: AABB): { intersects: boolean; penetration: Vector2 } | null {
        if (!this.intersects(a, b)) {
            return null;
        }

        // 计算穿透深度
        const overlapX = Math.min(a.max.x - b.min.x, b.max.x - a.min.x);
        const overlapY = Math.min(a.max.y - b.min.y, b.max.y - a.min.y);

        // 选择最小穿透轴
        let penetration: Vector2;
        if (overlapX < overlapY) {
            const sign = (a.min.x + a.max.x) / 2 < (b.min.x + b.max.x) / 2 ? -1 : 1;
            penetration = { x: overlapX * sign, y: 0 };
        } else {
            const sign = (a.min.y + a.max.y) / 2 < (b.min.y + b.max.y) / 2 ? -1 : 1;
            penetration = { x: 0, y: overlapY * sign };
        }

        return { intersects: true, penetration };
    }

    /**
     * 检测点是否在AABB内
     */
    public static contains(aabb: AABB, point: Vector2): boolean {
        return point.x >= aabb.min.x && point.x <= aabb.max.x &&
               point.y >= aabb.min.y && point.y <= aabb.max.y;
    }

    /**
     * 计算两个AABB中心点的距离
     */
    public static distance(a: AABB, b: AABB): number {
        const centerA = {
            x: (a.min.x + a.max.x) / 2,
            y: (a.min.y + a.max.y) / 2
        };
        const centerB = {
            x: (b.min.x + b.max.x) / 2,
            y: (b.min.y + b.max.y) / 2
        };
        const dx = centerA.x - centerB.x;
        const dy = centerA.y - centerB.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * 合并两个AABB
     */
    public static merge(a: AABB, b: AABB): AABB {
        return {
            min: {
                x: Math.min(a.min.x, b.min.x),
                y: Math.min(a.min.y, b.min.y)
            },
            max: {
                x: Math.max(a.max.x, b.max.x),
                y: Math.max(a.max.y, b.max.y)
            }
        };
    }
}
