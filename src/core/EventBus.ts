/**
 * EventBus.ts
 * 全局事件总线 - Pub-Sub模式
 * 解耦所有模块间的通信
 * 
 * DEBT-B01-001: 暂时无帧同步（单机版）
 */

export type EventCallback = (data?: any) => void;

export class EventBus {
    private static instance: EventBus;
    private listeners: Map<string, EventCallback[]> = new Map();

    private constructor() {}

    public static getInstance(): EventBus {
        if (!EventBus.instance) {
            EventBus.instance = new EventBus();
        }
        return EventBus.instance;
    }

    /**
     * 订阅事件
     * @param event 事件名称
     * @param callback 回调函数
     */
    public on(event: string, callback: EventCallback): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)!.push(callback);
    }

    /**
     * 取消订阅
     * @param event 事件名称
     * @param callback 回调函数
     */
    public off(event: string, callback: EventCallback): void {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    /**
     * 发布事件
     * @param event 事件名称
     * @param data 事件数据
     */
    public emit(event: string, data?: any): void {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`[EventBus] Error in event ${event}:`, error);
                }
            });
        }
    }

    /**
     * 订阅一次性事件
     * @param event 事件名称
     * @param callback 回调函数
     */
    public once(event: string, callback: EventCallback): void {
        const onceCallback: EventCallback = (data?: any) => {
            this.off(event, onceCallback);
            callback(data);
        };
        this.on(event, onceCallback);
    }

    /**
     * 清除所有监听器
     */
    public clear(): void {
        this.listeners.clear();
    }

    /**
     * 获取事件监听器数量
     * @param event 事件名称
     */
    public listenerCount(event: string): number {
        return this.listeners.get(event)?.length || 0;
    }
}

// 全局事件名称常量
export const GameEvents = {
    // 游戏状态
    GAME_START: 'game:start',
    GAME_PAUSE: 'game:pause',
    GAME_RESUME: 'game:resume',
    GAME_OVER: 'game:over',
    LEVEL_START: 'level:start',
    LEVEL_COMPLETE: 'level:complete',
    
    // 玩家相关
    PLAYER_SPAWN: 'player:spawn',
    PLAYER_MOVE: 'player:move',
    PLAYER_ATTACK: 'player:attack',
    PLAYER_DAMAGE: 'player:damage',
    PLAYER_HEAL: 'player:heal',
    PLAYER_DEATH: 'player:death',
    
    // SAN值系统
    SANITY_CHANGE: 'sanity:change',
    SANITY_TIER_CHANGE: 'sanity:tier:change',
    SANITY_ZERO: 'sanity:zero',
    
    // 敌人相关
    ENEMY_SPAWN: 'enemy:spawn',
    ENEMY_DAMAGE: 'enemy:damage',
    ENEMY_DEATH: 'enemy:death',
    
    // 战斗系统
    WEAPON_FIRE: 'weapon:fire',
    PROJECTILE_HIT: 'projectile:hit',
    DAMAGE_DEALT: 'damage:dealt',
    
    // 升级系统
    LEVEL_UP: 'level:up',
    UPGRADE_SELECT: 'upgrade:select',
    
    // 经济系统
    COIN_GET: 'coin:get',
    COIN_SPEND: 'coin:spend',
    
    // UI相关
    UI_SHOW_UPGRADE: 'ui:show:upgrade',
    UI_SHOW_SHOP: 'ui:show:shop',
    UI_UPDATE_HUD: 'ui:update:hud',
} as const;

// 便捷导出单例
export const eventBus = EventBus.getInstance();
