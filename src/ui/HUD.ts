/**
 * HUD.ts
 * 游戏HUD - 血条/SAN条/铜钱
 * 
 * 核心要求：
 * - 血条（头顶World Space）
 * - SAN条（顶部居中）
 * - 铜钱（右上角）
 * - 技能栏（底部）
 * 
 * DEBT-B08-001: 刘海硬编码偏移（非动态SafeArea）
 * DEBT-B08-002: 伤害数字用Label（无飞行动画）
 */

import { EventBus, GameEvents } from '../core/EventBus';
import { sanitySystem, SanityTier } from '../sanity/SanitySystem';
import { sanityFilter } from '../postprocess/SanityFilter';

export interface HUDConfig {
    safeAreaTop: number;
    safeAreaBottom: number;
    hpBarWidth: number;
    sanBarWidth: number;
    coinIconSize: number;
}

export const DEFAULT_HUD_CONFIG: HUDConfig = {
    safeAreaTop: 44,    // iPhone刘海
    safeAreaBottom: 34, // iPhone底部
    hpBarWidth: 32,
    sanBarWidth: 200,
    coinIconSize: 16,
};

export class HUD {
    private static instance: HUD;
    private eventBus: EventBus;
    
    // 配置
    private config: HUDConfig = DEFAULT_HUD_CONFIG;
    
    // 屏幕尺寸
    private screenWidth: number = 375;
    private screenHeight: number = 667;
    
    // 玩家数据
    private playerHp: number = 100;
    private playerMaxHp: number = 100;
    private playerSan: number = 100;
    private playerMaxSan: number = 100;
    private coins: number = 0;
    
    // 显示值（用于平滑动画）
    private displayHp: number = 100;
    private displaySan: number = 100;
    private displayCoins: number = 0;
    
    // 动画速度
    private readonly lerpSpeed = 10;
    
    // 伤害数字
    private damageNumbers: {
        value: number;
        x: number;
        y: number;
        time: number;
        isCrit: boolean;
    }[] = [];

    private constructor() {
        this.eventBus = EventBus.getInstance();
        this.setupEventListeners();
    }

    public static getInstance(): HUD {
        if (!HUD.instance) {
            HUD.instance = new HUD();
        }
        return HUD.instance;
    }

    private setupEventListeners(): void {
        // HP变化
        this.eventBus.on(GameEvents.PLAYER_DAMAGE, (data: { amount: number; hp: number; maxHp: number }) => {
            this.playerHp = data.hp;
            this.playerMaxHp = data.maxHp;
        });
        
        this.eventBus.on(GameEvents.PLAYER_HEAL, (data: { amount: number; hp: number; maxHp: number }) => {
            this.playerHp = data.hp;
            this.playerMaxHp = data.maxHp;
        });
        
        // SAN变化
        this.eventBus.on(GameEvents.SANITY_CHANGE, (data: { newValue: number; maxSan: number }) => {
            this.playerSan = data.newValue;
            this.playerMaxSan = data.maxSan;
        });
        
        // 铜钱变化
        this.eventBus.on(GameEvents.COIN_GET, (data: { amount: number }) => {
            this.coins += data.amount;
        });
        
        this.eventBus.on(GameEvents.COIN_SPEND, (data: { amount: number }) => {
            this.coins -= data.amount;
        });
        
        // 伤害数字
        this.eventBus.on(GameEvents.DAMAGE_DEALT, (data: { amount: number; x: number; y: number; isCrit?: boolean }) => {
            this.addDamageNumber(data.amount, data.x, data.y, data.isCrit || false);
        });
    }

    /**
     * 初始化
     */
    public initialize(screenWidth: number, screenHeight: number): void {
        this.screenWidth = screenWidth;
        this.screenHeight = screenHeight;
        
        // 根据屏幕尺寸调整配置
        if (screenWidth < 400) {
            this.config.sanBarWidth = 150;
        }
    }

    /**
     * 更新
     */
    public update(deltaTime: number): void {
        // 平滑数值
        this.displayHp = this.lerp(this.displayHp, this.playerHp, this.lerpSpeed * deltaTime);
        this.displaySan = this.lerp(this.displaySan, this.playerSan, this.lerpSpeed * deltaTime);
        this.displayCoins = this.lerp(this.displayCoins, this.coins, this.lerpSpeed * deltaTime);
        
        // 更新伤害数字
        this.updateDamageNumbers(deltaTime);
    }

    /**
     * 线性插值
     */
    private lerp(a: number, b: number, t: number): number {
        return a + (b - a) * Math.min(t, 1);
    }

    /**
     * 添加伤害数字
     */
    private addDamageNumber(value: number, x: number, y: number, isCrit: boolean): void {
        this.damageNumbers.push({
            value,
            x,
            y,
            time: 0,
            isCrit,
        });
    }

    /**
     * 更新伤害数字
     */
    private updateDamageNumbers(deltaTime: number): void {
        for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
            const num = this.damageNumbers[i];
            num.time += deltaTime;
            num.y -= 50 * deltaTime; // 向上飘动
            
            if (num.time > 1) {
                this.damageNumbers.splice(i, 1);
            }
        }
    }

    /**
     * 渲染HUD（Canvas API）
     */
    public render(ctx: CanvasRenderingContext2D): void {
        // 渲染SAN条
        this.renderSanityBar(ctx);
        
        // 渲染铜钱
        this.renderCoins(ctx);
        
        // 渲染伤害数字
        this.renderDamageNumbers(ctx);
    }

    /**
     * 渲染SAN条
     */
    private renderSanityBar(ctx: CanvasRenderingContext2D): void {
        const x = (this.screenWidth - this.config.sanBarWidth) / 2;
        const y = this.config.safeAreaTop;
        const width = this.config.sanBarWidth;
        const height = 12;
        
        // 背景
        ctx.fillStyle = '#333333';
        ctx.fillRect(x, y, width, height);
        
        // 获取SAN颜色
        const color = sanityFilter.getSanityBarColor();
        const colorStr = `rgb(${color.r}, ${color.g}, ${color.b})`;
        
        // 填充
        const percentage = this.displaySan / this.playerMaxSan;
        ctx.fillStyle = colorStr;
        ctx.fillRect(x, y, width * percentage, height);
        
        // 边框
        ctx.strokeStyle = '#666666';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, width, height);
        
        // 文字
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
            `${Math.floor(this.displaySan)}/${this.playerMaxSan}`,
            x + width / 2,
            y + height - 1
        );
        
        // 档位指示
        const tier = sanitySystem.getCurrentTier();
        if (tier !== SanityTier.NORMAL) {
            ctx.fillStyle = colorStr;
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(
                this.getTierDisplayName(tier),
                x + width / 2,
                y - 4
            );
        }
    }

    /**
     * 获取档位显示名称
     */
    private getTierDisplayName(tier: SanityTier): string {
        switch (tier) {
            case SanityTier.HAZY: return '恍惚';
            case SanityTier.CHAOTIC: return '混乱';
            case SanityTier.MAD: return '疯狂';
            case SanityTier.BREAKDOWN: return '崩溃';
            case SanityTier.ZERO: return '归零';
            default: return '';
        }
    }

    /**
     * 渲染铜钱
     */
    private renderCoins(ctx: CanvasRenderingContext2D): void {
        const x = this.screenWidth - 80;
        const y = this.config.safeAreaTop + 20;
        
        // 图标（简化为圆形）
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(x, y + 8, 8, 0, Math.PI * 2);
        ctx.fill();
        
        // 文字
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(Math.floor(this.displayCoins).toString(), x + 15, y + 12);
    }

    /**
     * 渲染伤害数字
     */
    private renderDamageNumbers(ctx: CanvasRenderingContext2D): void {
        for (const num of this.damageNumbers) {
            const alpha = 1 - num.time;
            
            if (num.isCrit) {
                ctx.fillStyle = `rgba(255, 0, 0, ${alpha})`;
                ctx.font = 'bold 20px sans-serif';
            } else {
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                ctx.font = '14px sans-serif';
            }
            
            ctx.textAlign = 'center';
            ctx.fillText(num.value.toString(), num.x, num.y);
        }
    }

    /**
     * 渲染玩家血条（World Space）
     */
    public renderPlayerHealthBar(
        ctx: CanvasRenderingContext2D,
        screenX: number,
        screenY: number,
        hp: number,
        maxHp: number
    ): void {
        const width = this.config.hpBarWidth;
        const height = 4;
        const x = screenX - width / 2;
        const y = screenY - 20;
        
        // 背景
        ctx.fillStyle = '#333333';
        ctx.fillRect(x, y, width, height);
        
        // 填充
        const percentage = hp / maxHp;
        ctx.fillStyle = percentage > 0.3 ? '#00ff00' : '#ff0000';
        ctx.fillRect(x, y, width * percentage, height);
        
        // 低血闪烁
        if (percentage < 0.3 && Math.floor(Date.now() / 200) % 2 === 0) {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
            ctx.fillRect(x - 2, y - 2, width + 4, height + 4);
        }
    }

    // ============ Getters ============

    public getSafeArea(): { top: number; bottom: number } {
        return {
            top: this.config.safeAreaTop,
            bottom: this.config.safeAreaBottom,
        };
    }

    public getScreenSize(): { width: number; height: number } {
        return {
            width: this.screenWidth,
            height: this.screenHeight,
        };
    }
}

// 便捷导出单例
export const hud = HUD.getInstance();
