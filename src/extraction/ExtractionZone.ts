/**
 * ExtractionZone.ts
 * 撤离区域 - 核心循环机制
 * 
 * 核心要求：
 * - 5/10/15分钟出现撤离点
 * - 保留资源比例不同（80%/100%/无）
 * - 撤离计时3秒（受击打断）
 */

import { Vector2 } from '../physics/AABB';
import { EventBus, GameEvents } from '../core/EventBus';

export enum ExtractionType {
    EARLY = 'early',      // 5分钟，保留80%
    NORMAL = 'normal',    // 10分钟，保留100%
    LATE = 'late',        // 15分钟，无奖励
}

export interface ExtractionConfig {
    type: ExtractionType;
    triggerTime: number;      // 触发时间（秒）
    coinRetention: number;    // 铜钱保留比例
    expBonus: number;         // 经验加成
    extractionTime: number;   // 撤离所需时间
}

export const EXTRACTION_CONFIGS: Record<ExtractionType, ExtractionConfig> = {
    [ExtractionType.EARLY]: {
        type: ExtractionType.EARLY,
        triggerTime: 5 * 60,    // 5分钟
        coinRetention: 0.8,     // 保留80%
        expBonus: 0,            // 无经验加成
        extractionTime: 3,      // 3秒撤离
    },
    [ExtractionType.NORMAL]: {
        type: ExtractionType.NORMAL,
        triggerTime: 10 * 60,   // 10分钟
        coinRetention: 1.0,     // 保留100%
        expBonus: 0.2,          // 20%经验加成
        extractionTime: 3,      // 3秒撤离
    },
    [ExtractionType.LATE]: {
        type: ExtractionType.LATE,
        triggerTime: 15 * 60,   // 15分钟
        coinRetention: 1.0,     // 保留100%
        expBonus: 0.5,          // 50%经验加成
        extractionTime: 3,      // 3秒撤离
    },
};

export enum ExtractionState {
    INACTIVE = 'inactive',
    AVAILABLE = 'available',
    EXTRACTING = 'extracting',
    COMPLETED = 'completed',
    INTERRUPTED = 'interrupted',
}

export class ExtractionZone {
    private static instance: ExtractionZone;
    private eventBus: EventBus;
    
    // 配置
    private config: ExtractionConfig | null = null;
    
    // 状态
    private state: ExtractionState = ExtractionState.INACTIVE;
    private position: Vector2 = { x: 0, y: 0 };
    
    // 撤离计时
    private extractionTimer: number = 0;
    private extractionProgress: number = 0;
    
    // 受击标记
    private wasHit: boolean = false;
    
    // 结果
    private result: {
        success: boolean;
        coinsRetained: number;
        expGained: number;
    } | null = null;

    private constructor() {
        this.eventBus = EventBus.getInstance();
        this.setupEventListeners();
    }

    public static getInstance(): ExtractionZone {
        if (!ExtractionZone.instance) {
            ExtractionZone.instance = new ExtractionZone();
        }
        return ExtractionZone.instance;
    }

    private setupEventListeners(): void {
        // 监听玩家受伤事件
        this.eventBus.on(GameEvents.PLAYER_DAMAGE, () => {
            if (this.state === ExtractionState.EXTRACTING) {
                this.interruptExtraction();
            }
        });
    }

    /**
     * 初始化
     */
    public initialize(): void {
        this.state = ExtractionState.INACTIVE;
        this.config = null;
        this.extractionTimer = 0;
        this.extractionProgress = 0;
        this.wasHit = false;
        this.result = null;
    }

    /**
     * 更新
     */
    public update(deltaTime: number, gameTime: number): void {
        // 检查是否应该激活撤离点
        if (this.state === ExtractionState.INACTIVE) {
            this.checkActivation(gameTime);
        }

        // 更新撤离计时
        if (this.state === ExtractionState.EXTRACTING) {
            this.updateExtraction(deltaTime);
        }
    }

    /**
     * 检查激活
     */
    private checkActivation(gameTime: number): void {
        for (const config of Object.values(EXTRACTION_CONFIGS)) {
            if (gameTime >= config.triggerTime && !this.config) {
                this.activate(config);
                break;
            }
        }
    }

    /**
     * 激活撤离点
     */
    public activate(config: ExtractionConfig, position?: Vector2): void {
        this.config = config;
        this.state = ExtractionState.AVAILABLE;
        
        if (position) {
            this.position = position;
        }

        console.log(`[ExtractionZone] Activated: ${config.type} at ${config.triggerTime}s`);
        
        this.eventBus.emit('extraction:available', {
            type: config.type,
            position: this.position,
            retention: config.coinRetention,
        });
    }

    /**
     * 开始撤离
     */
    public startExtraction(): boolean {
        if (this.state !== ExtractionState.AVAILABLE) {
            return false;
        }

        this.state = ExtractionState.EXTRACTING;
        this.extractionTimer = 0;
        this.extractionProgress = 0;
        this.wasHit = false;

        console.log('[ExtractionZone] Extraction started');
        
        this.eventBus.emit('extraction:started', {
            duration: this.config!.extractionTime,
        });

        return true;
    }

    /**
     * 更新撤离计时
     */
    private updateExtraction(deltaTime: number): void {
        if (!this.config) return;

        this.extractionTimer += deltaTime;
        this.extractionProgress = this.extractionTimer / this.config.extractionTime;

        // 发送进度更新
        this.eventBus.emit('extraction:progress', {
            progress: this.extractionProgress,
            timeRemaining: this.config.extractionTime - this.extractionTimer,
        });

        // 撤离完成
        if (this.extractionTimer >= this.config.extractionTime) {
            this.completeExtraction();
        }
    }

    /**
     * 打断撤离
     */
    private interruptExtraction(): void {
        this.state = ExtractionState.INTERRUPTED;
        this.wasHit = true;

        console.log('[ExtractionZone] Extraction interrupted!');
        
        this.eventBus.emit('extraction:interrupted');

        // 可以重新开始
        setTimeout(() => {
            if (this.state === ExtractionState.INTERRUPTED) {
                this.state = ExtractionState.AVAILABLE;
            }
        }, 1000);
    }

    /**
     * 完成撤离
     */
    private completeExtraction(): void {
        this.state = ExtractionState.COMPLETED;

        // 计算结果
        this.result = {
            success: true,
            coinsRetained: this.config!.coinRetention,
            expGained: this.config!.expBonus,
        };

        console.log('[ExtractionZone] Extraction completed!');
        
        this.eventBus.emit('extraction:completed', {
            result: this.result,
        });
    }

    /**
     * 取消撤离
     */
    public cancelExtraction(): void {
        if (this.state === ExtractionState.EXTRACTING) {
            this.state = ExtractionState.AVAILABLE;
            this.extractionTimer = 0;
            this.extractionProgress = 0;

            this.eventBus.emit('extraction:cancelled');
        }
    }

    // ============ Getters ============

    public getState(): ExtractionState {
        return this.state;
    }

    public getPosition(): Vector2 {
        return { ...this.position };
    }

    public getConfig(): ExtractionConfig | null {
        return this.config;
    }

    public getProgress(): number {
        return this.extractionProgress;
    }

    public getResult(): typeof this.result {
        return this.result;
    }

    public isAvailable(): boolean {
        return this.state === ExtractionState.AVAILABLE;
    }

    public isExtracting(): boolean {
        return this.state === ExtractionState.EXTRACTING;
    }

    public isCompleted(): boolean {
        return this.state === ExtractionState.COMPLETED;
    }

    /**
     * 获取撤离类型显示名称
     */
    public static getTypeDisplayName(type: ExtractionType): string {
        switch (type) {
            case ExtractionType.EARLY: return '提前撤离';
            case ExtractionType.NORMAL: return '正常撤离';
            case ExtractionType.LATE: return '完美撤离';
            default: return '未知';
        }
    }

    /**
     * 获取撤离类型描述
     */
    public static getTypeDescription(type: ExtractionType): string {
        const config = EXTRACTION_CONFIGS[type];
        return `保留${Math.floor(config.coinRetention * 100)}%铜钱${config.expBonus > 0 ? `，经验+${Math.floor(config.expBonus * 100)}%` : ''}`;
    }
}

// 便捷导出单例
export const extractionZone = ExtractionZone.getInstance();
