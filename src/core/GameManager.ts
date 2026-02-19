/**
 * GameManager.ts
 * 游戏状态管理器 - 单例模式
 * 管理游戏全局状态、生命周期和核心系统
 * 
 * DEBT-B01-001: 暂时无帧同步（单机版）
 */

import { EventBus, GameEvents } from './EventBus';
import { poolManager } from './PoolManager';

export enum GameState {
    NONE = 'none',
    LOADING = 'loading',
    MENU = 'menu',
    PLAYING = 'playing',
    PAUSED = 'paused',
    GAME_OVER = 'game_over',
    LEVEL_COMPLETE = 'level_complete',
}

export interface GameConfig {
    targetFPS: number;
    fixedTimeStep: number;
    maxEntities: number;
    enableDebug: boolean;
}

export const DEFAULT_CONFIG: GameConfig = {
    targetFPS: 60,
    fixedTimeStep: 1 / 60,
    maxEntities: 100,
    enableDebug: false,
};

export class GameManager {
    private static instance: GameManager;
    private eventBus: EventBus;
    
    // 游戏状态
    private currentState: GameState = GameState.NONE;
    private previousState: GameState = GameState.NONE;
    
    // 游戏配置
    private config: GameConfig = DEFAULT_CONFIG;
    
    // 游戏数据
    private gameTime: number = 0;
    private frameCount: number = 0;
    private isRunning: boolean = false;
    
    // 性能监控
    private fps: number = 0;
    private lastFrameTime: number = 0;
    private frameTimeHistory: number[] = [];
    private readonly FRAME_HISTORY_SIZE = 30;

    private constructor() {
        this.eventBus = EventBus.getInstance();
    }

    public static getInstance(): GameManager {
        if (!GameManager.instance) {
            GameManager.instance = new GameManager();
        }
        return GameManager.instance;
    }

    /**
     * 初始化游戏
     */
    public initialize(config?: Partial<GameConfig>): void {
        this.config = { ...DEFAULT_CONFIG, ...config };
        console.log('[GameManager] Initialized with config:', this.config);
        
        this.changeState(GameState.MENU);
    }

    /**
     * 开始游戏
     */
    public startGame(): void {
        this.gameTime = 0;
        this.frameCount = 0;
        this.isRunning = true;
        this.changeState(GameState.PLAYING);
        this.eventBus.emit(GameEvents.GAME_START);
        console.log('[GameManager] Game started');
    }

    /**
     * 暂停游戏
     */
    public pause(): void {
        if (this.currentState === GameState.PLAYING) {
            this.previousState = this.currentState;
            this.changeState(GameState.PAUSED);
            this.eventBus.emit(GameEvents.GAME_PAUSE);
            console.log('[GameManager] Game paused');
        }
    }

    /**
     * 恢复游戏
     */
    public resume(): void {
        if (this.currentState === GameState.PAUSED) {
            this.changeState(this.previousState);
            this.eventBus.emit(GameEvents.GAME_RESUME);
            console.log('[GameManager] Game resumed');
        }
    }

    /**
     * 结束游戏
     */
    public gameOver(isWin: boolean = false): void {
        this.isRunning = false;
        this.changeState(GameState.GAME_OVER);
        this.eventBus.emit(GameEvents.GAME_OVER, { isWin, gameTime: this.gameTime });
        console.log('[GameManager] Game over, win:', isWin);
    }

    /**
     * 关卡完成
     */
    public levelComplete(): void {
        this.changeState(GameState.LEVEL_COMPLETE);
        this.eventBus.emit(GameEvents.LEVEL_COMPLETE, { gameTime: this.gameTime });
        console.log('[GameManager] Level completed');
    }

    /**
     * 返回主菜单
     */
    public returnToMenu(): void {
        this.isRunning = false;
        this.changeState(GameState.MENU);
        console.log('[GameManager] Returned to menu');
    }

    /**
     * 更新游戏状态
     */
    public update(deltaTime: number): void {
        if (!this.isRunning || this.currentState !== GameState.PLAYING) {
            return;
        }

        // 更新游戏时间
        this.gameTime += deltaTime;
        this.frameCount++;

        // 计算FPS
        this.updateFPS(deltaTime);

        // 性能监控
        if (this.config.enableDebug && this.frameCount % 60 === 0) {
            this.logPerformance();
        }
    }

    /**
     * 改变游戏状态
     */
    private changeState(newState: GameState): void {
        if (this.currentState !== newState) {
            console.log(`[GameManager] State change: ${this.currentState} -> ${newState}`);
            this.previousState = this.currentState;
            this.currentState = newState;
        }
    }

    /**
     * 更新FPS计算
     */
    private updateFPS(deltaTime: number): void {
        this.frameTimeHistory.push(deltaTime);
        if (this.frameTimeHistory.length > this.FRAME_HISTORY_SIZE) {
            this.frameTimeHistory.shift();
        }
        
        const avgFrameTime = this.frameTimeHistory.reduce((a, b) => a + b, 0) / this.frameTimeHistory.length;
        this.fps = avgFrameTime > 0 ? Math.round(1 / avgFrameTime) : 0;
    }

    /**
     * 输出性能日志
     */
    private logPerformance(): void {
        const stats = poolManager.getStats();
        const totalActive = Object.values(stats).reduce((sum, s) => sum + s.active, 0);
        
        console.log(`[Performance] FPS: ${this.fps}, Time: ${this.gameTime.toFixed(1)}s, Entities: ${totalActive}`);
    }

    // ============ Getters ============

    public getCurrentState(): GameState {
        return this.currentState;
    }

    public getGameTime(): number {
        return this.gameTime;
    }

    public getFrameCount(): number {
        return this.frameCount;
    }

    public getFPS(): number {
        return this.fps;
    }

    public getConfig(): GameConfig {
        return this.config;
    }

    public isPaused(): boolean {
        return this.currentState === GameState.PAUSED;
    }

    public isPlaying(): boolean {
        return this.currentState === GameState.PLAYING;
    }

    public isGameOver(): boolean {
        return this.currentState === GameState.GAME_OVER;
    }

    // ============ Debug ============

    /**
     * 获取完整状态信息
     */
    public getStatus(): object {
        return {
            state: this.currentState,
            fps: this.fps,
            gameTime: this.gameTime,
            frameCount: this.frameCount,
            isRunning: this.isRunning,
            poolStats: poolManager.getStats()
        };
    }
}

// 便捷导出单例
export const gameManager = GameManager.getInstance();
