/**
 * Random.ts
 * 确定性随机数生成器 - Mulberry32算法
 * 支持帧同步回滚（即使现在单机，架构预留）
 * 
 * DEBT-B01-001: 暂时无帧同步（单机版）
 */

export class Random {
    private seed: number;
    private initialSeed: number;

    constructor(seed: number = Date.now()) {
        this.initialSeed = seed;
        this.seed = seed;
    }

    /**
     * Mulberry32算法 - 确定性随机数
     * 返回0-1之间的浮点数
     */
    public next(): number {
        let t = this.seed += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    /**
     * 生成指定范围内的整数 [min, max)
     */
    public rangeInt(min: number, max: number): number {
        return Math.floor(this.next() * (max - min)) + min;
    }

    /**
     * 生成指定范围内的浮点数 [min, max)
     */
    public rangeFloat(min: number, max: number): number {
        return this.next() * (max - min) + min;
    }

    /**
     * 从数组中随机选择一个元素
     */
    public choice<T>(array: T[]): T | undefined {
        if (array.length === 0) return undefined;
        return array[this.rangeInt(0, array.length)];
    }

    /**
     * 加权随机选择
     * @param items 项目数组
     * @param weights 权重数组
     */
    public weightedChoice<T>(items: T[], weights: number[]): T | undefined {
        if (items.length === 0 || items.length !== weights.length) {
            return undefined;
        }
        
        const totalWeight = weights.reduce((sum, w) => sum + w, 0);
        let random = this.next() * totalWeight;
        
        for (let i = 0; i < items.length; i++) {
            random -= weights[i];
            if (random <= 0) {
                return items[i];
            }
        }
        
        return items[items.length - 1];
    }

    /**
     * 洗牌算法 - Fisher-Yates
     */
    public shuffle<T>(array: T[]): T[] {
        const result = [...array];
        for (let i = result.length - 1; i > 0; i--) {
            const j = this.rangeInt(0, i + 1);
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }

    /**
     * 伯努利试验 - 返回true的概率为probability
     */
    public bool(probability: number = 0.5): boolean {
        return this.next() < probability;
    }

    /**
     * 重置随机数生成器到初始状态
     * 用于帧同步回滚
     */
    public reset(): void {
        this.seed = this.initialSeed;
    }

    /**
     * 设置新的种子
     */
    public setSeed(seed: number): void {
        this.initialSeed = seed;
        this.seed = seed;
    }

    /**
     * 获取当前种子
     */
    public getSeed(): number {
        return this.initialSeed;
    }

    /**
     * 保存当前状态（用于回滚）
     */
    public saveState(): number {
        return this.seed;
    }

    /**
     * 恢复状态（用于回滚）
     */
    public loadState(state: number): void {
        this.seed = state;
    }
}

// 全局随机数生成器实例
export const globalRandom = new Random();
