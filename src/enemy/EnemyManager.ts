/**
 * EnemyManager.ts
 * 敌人管理器 - 对象池+生成器
 * 
 * 核心要求：
 * - 对象池：预分配50个敌人节点
 * - 分帧生成：每帧最多生成5个
 * 
 * DEBT-B05-001: AI用简单状态机（非完整Behavior Tree库）
 * DEBT-B05-002: 寻路用直线追踪（无NavMesh）
 */

import { EventBus, GameEvents } from '../core/EventBus';
import { poolManager, Poolable } from '../core/PoolManager';
import { Vector2 } from '../physics/AABB';
import { EnemyAI, EnemyConfig, AIState } from './EnemyAI';

export interface Enemy extends Poolable {
    ai: EnemyAI | null;
    spawnTime: number;
}

export interface SpawnWave {
    enemyId: string;
    count: number;
    interval: number;
}

export interface EnemyManagerConfig {
    maxEnemiesPerFrame: number;
    spawnInterval: number;
    eliteSpawnChance: number;
    poolSize: number;
}

export const DEFAULT_ENEMY_MANAGER_CONFIG: EnemyManagerConfig = {
    maxEnemiesPerFrame: 5,
    spawnInterval: 2.0,
    eliteSpawnChance: 0.1,
    poolSize: 50,
};

export class EnemyManager {
    private static instance: EnemyManager;
    private eventBus: EventBus;
    
    // 配置
    private config: EnemyManagerConfig = DEFAULT_ENEMY_MANAGER_CONFIG;
    private enemyConfigs: Map<string, EnemyConfig> = new Map();
    
    // 对象池
    private enemyPool: Enemy[] = [];
    private activeEnemies: Set<Enemy> = new Set();
    
    // 生成队列
    private spawnQueue: { config: EnemyConfig; position: Vector2 }[] = [];
    private spawnTimer: number = 0;
    
    // 分帧生成
    private spawnCounter: number = 0;
    
    // 玩家位置引用
    private playerPosition: Vector2 = { x: 0, y: 0 };
    
    // 统计
    private totalSpawned: number = 0;
    private totalKilled: number = 0;

    private constructor() {
        this.eventBus = EventBus.getInstance();
    }

    public static getInstance(): EnemyManager {
        if (!EnemyManager.instance) {
            EnemyManager.instance = new EnemyManager();
        }
        return EnemyManager.instance;
    }

    /**
     * 加载敌人配置
     */
    public loadConfigs(configs: EnemyConfig[]): void {
        this.enemyConfigs.clear();
        for (const config of configs) {
            this.enemyConfigs.set(config.id, config);
        }
        console.log(`[EnemyManager] Loaded ${configs.length} enemy configs`);
    }

    /**
     * 从JSON加载配置
     */
    public async loadConfigsFromJson(jsonPath: string): Promise<void> {
        try {
            const response = await fetch(jsonPath);
            const data = await response.json();
            this.loadConfigs(data.enemies);
            if (data.spawnRules) {
                this.config = { ...this.config, ...data.spawnRules };
            }
        } catch (error) {
            console.error('[EnemyManager] Failed to load configs:', error);
        }
    }

    /**
     * 初始化对象池
     */
    public initialize(): void {
        // 创建对象池
        this.enemyPool = [];
        this.activeEnemies.clear();
        this.spawnQueue = [];
        this.spawnTimer = 0;
        this.spawnCounter = 0;
        this.totalSpawned = 0;
        this.totalKilled = 0;
        
        // 预分配敌人对象
        for (let i = 0; i < this.config.poolSize; i++) {
            const enemy: Enemy = {
                id: `enemy_${i}`,
                active: false,
                ai: null,
                spawnTime: 0,
                reset: () => {
                    enemy.ai = null;
                    enemy.spawnTime = 0;
                },
            };
            this.enemyPool.push(enemy);
        }
        
        console.log(`[EnemyManager] Initialized pool with ${this.config.poolSize} enemies`);
    }

    /**
     * 更新敌人管理器
     */
    public update(deltaTime: number, playerPosition: Vector2): void {
        this.playerPosition = playerPosition;
        
        // 更新生成计时器
        this.spawnTimer += deltaTime;
        
        // 处理生成队列
        this.processSpawnQueue();
        
        // 更新活跃敌人
        this.updateEnemies(deltaTime);
        
        // 清理死亡敌人
        this.cleanupDeadEnemies();
    }

    /**
     * 处理生成队列（分帧生成）
     */
    private processSpawnQueue(): void {
        if (this.spawnQueue.length === 0) return;
        
        let spawnedThisFrame = 0;
        
        while (this.spawnQueue.length > 0 && spawnedThisFrame < this.config.maxEnemiesPerFrame) {
            const spawnData = this.spawnQueue.shift()!;
            this.spawnEnemyInternal(spawnData.config, spawnData.position);
            spawnedThisFrame++;
        }
    }

    /**
     * 更新活跃敌人
     */
    private updateEnemies(deltaTime: number): void {
        for (const enemy of this.activeEnemies) {
            if (enemy.ai && !enemy.ai.isDead()) {
                enemy.ai.update(deltaTime, this.playerPosition);
            }
        }
    }

    /**
     * 清理死亡敌人
     */
    private cleanupDeadEnemies(): void {
        for (const enemy of this.activeEnemies) {
            if (enemy.ai?.isDead()) {
                this.despawnEnemy(enemy);
            }
        }
    }

    /**
     * 生成敌人（加入队列）
     */
    public spawnEnemy(enemyId: string, position: Vector2): boolean {
        const config = this.enemyConfigs.get(enemyId);
        if (!config) {
            console.error(`[EnemyManager] Enemy config not found: ${enemyId}`);
            return false;
        }
        
        this.spawnQueue.push({ config, position });
        return true;
    }

    /**
     * 立即生成敌人（内部使用）
     */
    private spawnEnemyInternal(config: EnemyConfig, position: Vector2): Enemy | null {
        // 从对象池获取
        const enemy = this.acquireFromPool();
        if (!enemy) {
            console.warn('[EnemyManager] Pool exhausted, cannot spawn enemy');
            return null;
        }
        
        // 初始化AI
        enemy.ai = new EnemyAI(config, position);
        enemy.active = true;
        enemy.spawnTime = Date.now();
        
        this.activeEnemies.add(enemy);
        this.totalSpawned++;
        
        // 发送事件
        this.eventBus.emit(GameEvents.ENEMY_SPAWN, {
            enemyId: config.id,
            position,
        });
        
        return enemy;
    }

    /**
     * 从对象池获取
     */
    private acquireFromPool(): Enemy | null {
        // 查找非活跃敌人
        const enemy = this.enemyPool.find(e => !e.active);
        if (enemy) {
            enemy.reset();
            return enemy;
        }
        return null;
    }

    /**
     * 回收敌人
     */
    private despawnEnemy(enemy: Enemy): void {
        if (!this.activeEnemies.has(enemy)) return;
        
        enemy.active = false;
        enemy.ai = null;
        this.activeEnemies.delete(enemy);
        this.totalKilled++;
        
        // 发送事件
        this.eventBus.emit(GameEvents.ENEMY_DEATH, {
            enemyId: enemy.id,
        });
    }

    /**
     * 批量生成敌人
     */
    public spawnWave(wave: SpawnWave, centerPosition: Vector2, radius: number = 200): void {
        for (let i = 0; i < wave.count; i++) {
            const angle = (Math.PI * 2 * i) / wave.count + Math.random() * 0.5;
            const distance = radius + Math.random() * 100;
            const position = {
                x: centerPosition.x + Math.cos(angle) * distance,
                y: centerPosition.y + Math.sin(angle) * distance,
            };
            
            setTimeout(() => {
                this.spawnEnemy(wave.enemyId, position);
            }, i * wave.interval * 1000);
        }
    }

    /**
     * 随机生成敌人
     */
    public spawnRandomEnemies(count: number, centerPosition: Vector2, radius: number = 300): void {
        const enemyIds = Array.from(this.enemyConfigs.keys());
        if (enemyIds.length === 0) return;
        
        for (let i = 0; i < count; i++) {
            const enemyId = enemyIds[Math.floor(Math.random() * enemyIds.length)];
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * radius;
            const position = {
                x: centerPosition.x + Math.cos(angle) * distance,
                y: centerPosition.y + Math.sin(angle) * distance,
            };
            
            this.spawnEnemy(enemyId, position);
        }
    }

    /**
     * 获取范围内的敌人
     */
    public getEnemiesInRange(center: Vector2, radius: number): Enemy[] {
        const result: Enemy[] = [];
        const radiusSq = radius * radius;
        
        for (const enemy of this.activeEnemies) {
            if (!enemy.ai || enemy.ai.isDead()) continue;
            
            const pos = enemy.ai.getPosition();
            const dx = pos.x - center.x;
            const dy = pos.y - center.y;
            
            if (dx * dx + dy * dy <= radiusSq) {
                result.push(enemy);
            }
        }
        
        return result;
    }

    /**
     * 获取最近的敌人
     */
    public getNearestEnemy(center: Vector2): Enemy | null {
        let nearest: Enemy | null = null;
        let nearestDistSq = Infinity;
        
        for (const enemy of this.activeEnemies) {
            if (!enemy.ai || enemy.ai.isDead()) continue;
            
            const pos = enemy.ai.getPosition();
            const dx = pos.x - center.x;
            const dy = pos.y - center.y;
            const distSq = dx * dx + dy * dy;
            
            if (distSq < nearestDistSq) {
                nearestDistSq = distSq;
                nearest = enemy;
            }
        }
        
        return nearest;
    }

    /**
     * 清除所有敌人
     */
    public clearAllEnemies(): void {
        for (const enemy of this.activeEnemies) {
            enemy.active = false;
            enemy.ai = null;
        }
        this.activeEnemies.clear();
    }

    // ============ Getters ============

    public getActiveEnemyCount(): number {
        return this.activeEnemies.size;
    }

    public getPoolSize(): number {
        return this.enemyPool.length;
    }

    public getSpawnQueueLength(): number {
        return this.spawnQueue.length;
    }

    public getTotalSpawned(): number {
        return this.totalSpawned;
    }

    public getTotalKilled(): number {
        return this.totalKilled;
    }

    public getActiveEnemies(): Enemy[] {
        return Array.from(this.activeEnemies);
    }

    public getEnemyConfig(enemyId: string): EnemyConfig | undefined {
        return this.enemyConfigs.get(enemyId);
    }

    public getStats(): object {
        return {
            active: this.getActiveEnemyCount(),
            poolSize: this.getPoolSize(),
            queueLength: this.getSpawnQueueLength(),
            totalSpawned: this.totalSpawned,
            totalKilled: this.totalKilled,
        };
    }
}

// 便捷导出单例
export const enemyManager = EnemyManager.getInstance();
