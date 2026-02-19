/**
 * PoolManager.ts
 * 对象池系统 - 预分配对象，避免运行时GC
 * 
 * 核心要求：
 * - 预分配100个Entity
 * - active/deactive切换
 * - 禁止运行时instantiate
 * 
 * DEBT-B01-003: 使用对象池而非ECS（架构简单优先）
 */

export interface Poolable {
    id: string;
    active: boolean;
    reset(): void;
}

export type PoolableFactory<T> = () => T;

export class ObjectPool<T extends Poolable> {
    private pool: T[] = [];
    private factory: PoolableFactory<T>;
    private maxSize: number;
    private name: string;

    constructor(name: string, factory: PoolableFactory<T>, initialSize: number, maxSize: number) {
        this.name = name;
        this.factory = factory;
        this.maxSize = maxSize;
        
        // 预分配对象
        for (let i = 0; i < initialSize; i++) {
            const obj = this.factory();
            obj.active = false;
            this.pool.push(obj);
        }
        
        console.log(`[PoolManager] Created pool '${name}' with ${initialSize} objects (max: ${maxSize})`);
    }

    /**
     * 从对象池获取一个对象
     */
    public acquire(): T | null {
        // 查找非活跃对象
        let obj = this.pool.find(item => !item.active);
        
        if (obj) {
            obj.active = true;
            obj.reset();
            return obj;
        }
        
        // 池已满，尝试扩展（不超过maxSize）
        if (this.pool.length < this.maxSize) {
            obj = this.factory();
            obj.active = true;
            obj.reset();
            this.pool.push(obj);
            console.warn(`[PoolManager] Pool '${this.name}' expanded to ${this.pool.length}`);
            return obj;
        }
        
        console.error(`[PoolManager] Pool '${this.name}' exhausted! Max size: ${this.maxSize}`);
        return null;
    }

    /**
     * 释放对象回对象池
     */
    public release(obj: T): void {
        if (this.pool.includes(obj)) {
            obj.active = false;
        }
    }

    /**
     * 释放所有对象
     */
    public releaseAll(): void {
        this.pool.forEach(obj => {
            obj.active = false;
        });
    }

    /**
     * 获取当前活跃对象数量
     */
    public getActiveCount(): number {
        return this.pool.filter(obj => obj.active).length;
    }

    /**
     * 获取当前池大小
     */
    public getSize(): number {
        return this.pool.length;
    }

    /**
     * 获取最大容量
     */
    public getMaxSize(): number {
        return this.maxSize;
    }

    /**
     * 获取可用对象数量
     */
    public getAvailableCount(): number {
        return this.pool.filter(obj => !obj.active).length;
    }

    /**
     * 清空对象池
     */
    public clear(): void {
        this.pool = [];
    }
}

export class PoolManager {
    private static instance: PoolManager;
    private pools: Map<string, ObjectPool<any>> = new Map();

    private constructor() {}

    public static getInstance(): PoolManager {
        if (!PoolManager.instance) {
            PoolManager.instance = new PoolManager();
        }
        return PoolManager.instance;
    }

    /**
     * 创建对象池
     */
    public createPool<T extends Poolable>(
        name: string,
        factory: PoolableFactory<T>,
        initialSize: number,
        maxSize: number
    ): ObjectPool<T> {
        if (this.pools.has(name)) {
            console.warn(`[PoolManager] Pool '${name}' already exists, returning existing pool`);
            return this.pools.get(name)!;
        }
        
        const pool = new ObjectPool<T>(name, factory, initialSize, maxSize);
        this.pools.set(name, pool);
        return pool;
    }

    /**
     * 获取对象池
     */
    public getPool<T extends Poolable>(name: string): ObjectPool<T> | undefined {
        return this.pools.get(name);
    }

    /**
     * 从指定池获取对象
     */
    public acquire<T extends Poolable>(name: string): T | null {
        const pool = this.pools.get(name);
        if (pool) {
            return pool.acquire();
        }
        console.error(`[PoolManager] Pool '${name}' not found`);
        return null;
    }

    /**
     * 释放对象回指定池
     */
    public release<T extends Poolable>(name: string, obj: T): void {
        const pool = this.pools.get(name);
        if (pool) {
            pool.release(obj);
        }
    }

    /**
     * 释放所有池中的所有对象
     */
    public releaseAll(): void {
        this.pools.forEach(pool => pool.releaseAll());
    }

    /**
     * 获取所有池的统计信息
     */
    public getStats(): Record<string, { size: number; active: number; available: number; max: number }> {
        const stats: Record<string, { size: number; active: number; available: number; max: number }> = {};
        this.pools.forEach((pool, name) => {
            stats[name] = {
                size: pool.getSize(),
                active: pool.getActiveCount(),
                available: pool.getAvailableCount(),
                max: pool.getMaxSize()
            };
        });
        return stats;
    }

    /**
     * 打印所有池的状态
     */
    public printStats(): void {
        console.log('[PoolManager] === Pool Statistics ===');
        this.pools.forEach((pool, name) => {
            console.log(`  ${name}: ${pool.getActiveCount()}/${pool.getSize()} active (max: ${pool.getMaxSize()})`);
        });
    }

    /**
     * 清空所有对象池
     */
    public clear(): void {
        this.pools.forEach(pool => pool.clear());
        this.pools.clear();
    }
}

// 便捷导出单例
export const poolManager = PoolManager.getInstance();
