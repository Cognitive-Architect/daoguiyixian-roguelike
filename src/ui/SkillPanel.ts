/**
 * SkillPanel.ts
 * 技能面板 - 技能按钮和冷却显示
 * 
 * 核心要求：
 * - 小屏（<400px宽）技能按钮3个，大屏4个
 * - 按钮72-88px自适应
 * - 技能CD径向遮罩（Radial Wipe）
 */

import { Vector2 } from '../physics/AABB';
import { EventBus, GameEvents } from '../core/EventBus';
import { weaponSystem } from '../weapon/WeaponSystem';

export interface SkillButton {
    id: string;
    name: string;
    icon: string;
    cooldown: number;
    currentCooldown: number;
    isReady: boolean;
}

export class SkillPanel {
    private static instance: SkillPanel;
    private eventBus: EventBus;
    
    // 屏幕尺寸
    private screenWidth: number = 375;
    private screenHeight: number = 667;
    
    // 按钮配置
    private buttonSize: number = 72;
    private buttonGap: number = 16;
    private maxButtons: number = 4;
    
    // 按钮状态
    private buttons: SkillButton[] = [];
    private hoveredButton: number = -1;
    private pressedButton: number = -1;
    
    // 动画
    private buttonScale: number[] = [];
    private readonly pressScale = 0.9;
    private readonly lerpSpeed = 15;

    private constructor() {
        this.eventBus = EventBus.getInstance();
        this.setupEventListeners();
    }

    public static getInstance(): SkillPanel {
        if (!SkillPanel.instance) {
            SkillPanel.instance = new SkillPanel();
        }
        return SkillPanel.instance;
    }

    private setupEventListeners(): void {
        // 监听武器切换
        this.eventBus.on('weapon:switch', () => {
            this.updateButtons();
        });
    }

    /**
     * 初始化
     */
    public initialize(screenWidth: number, screenHeight: number): void {
        this.screenWidth = screenWidth;
        this.screenHeight = screenHeight;
        
        // 根据屏幕尺寸调整
        if (screenWidth < 400) {
            this.maxButtons = 3;
            this.buttonSize = 72;
        } else {
            this.maxButtons = 4;
            this.buttonSize = 88;
        }
        
        this.updateButtons();
    }

    /**
     * 更新按钮
     */
    private updateButtons(): void {
        this.buttons = [];
        this.buttonScale = [];
        
        const slots = weaponSystem.getWeaponSlots();
        
        for (let i = 0; i < Math.min(slots.length, this.maxButtons); i++) {
            const weaponId = slots[i];
            
            if (weaponId) {
                const weapon = weaponSystem.getWeapon(weaponId);
                const config = weapon?.getConfig();
                
                if (config) {
                    this.buttons.push({
                        id: weaponId,
                        name: config.name,
                        icon: config.id,
                        cooldown: config.attackCooldown,
                        currentCooldown: 0,
                        isReady: true,
                    });
                    this.buttonScale.push(1);
                }
            }
        }
    }

    /**
     * 更新
     */
    public update(deltaTime: number): void {
        // 更新按钮动画
        for (let i = 0; i < this.buttonScale.length; i++) {
            const targetScale = i === this.pressedButton ? this.pressScale : 1;
            this.buttonScale[i] = this.lerp(this.buttonScale[i], targetScale, this.lerpSpeed * deltaTime);
        }
        
        // 更新武器冷却
        for (let i = 0; i < this.buttons.length; i++) {
            const button = this.buttons[i];
            const weapon = weaponSystem.getWeapon(button.id);
            
            if (weapon) {
                button.isReady = weapon.canAttack();
            }
        }
    }

    /**
     * 线性插值
     */
    private lerp(a: number, b: number, t: number): number {
        return a + (b - a) * Math.min(t, 1);
    }

    /**
     * 渲染技能面板
     */
    public render(ctx: CanvasRenderingContext2D): void {
        const positions = this.getButtonPositions();
        
        for (let i = 0; i < this.buttons.length; i++) {
            this.renderButton(ctx, this.buttons[i], positions[i], this.buttonScale[i]);
        }
    }

    /**
     * 渲染单个按钮
     */
    private renderButton(
        ctx: CanvasRenderingContext2D,
        button: SkillButton,
        position: Vector2,
        scale: number
    ): void {
        const size = this.buttonSize * scale;
        const x = position.x - size / 2;
        const y = position.y - size / 2;
        
        // 背景
        ctx.fillStyle = button.isReady ? '#4a4a6a' : '#2a2a3a';
        ctx.fillRect(x, y, size, size);
        
        // 边框
        ctx.strokeStyle = button.isReady ? '#6a6a8a' : '#3a3a5a';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, size, size);
        
        // 武器名称
        ctx.fillStyle = button.isReady ? '#ffffff' : '#888888';
        ctx.font = `${size * 0.2}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(button.name, position.x, position.y + size * 0.3);
        
        // 冷却遮罩
        if (!button.isReady) {
            const weapon = weaponSystem.getWeapon(button.id);
            if (weapon) {
                const cooldownProgress = weapon.getCooldownProgress();
                this.renderCooldownMask(ctx, position.x, position.y, size, cooldownProgress);
            }
        }
        
        // 高亮
        if (button.isReady) {
            ctx.strokeStyle = '#ffff00';
            ctx.lineWidth = 2;
            ctx.strokeRect(x - 2, y - 2, size + 4, size + 4);
        }
    }

    /**
     * 渲染冷却遮罩（径向）
     */
    private renderCooldownMask(
        ctx: CanvasRenderingContext2D,
        centerX: number,
        centerY: number,
        size: number,
        progress: number
    ): void {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        
        // 从顶部开始，顺时针
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + (1 - progress) * Math.PI * 2;
        
        ctx.arc(centerX, centerY, size / 2 + 5, startAngle, endAngle);
        ctx.closePath();
        ctx.fill();
        
        // 显示剩余时间
        if (progress < 1) {
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${size * 0.3}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(
                (progress * 100).toFixed(0) + '%',
                centerX,
                centerY
            );
        }
    }

    /**
     * 获取按钮位置
     */
    private getButtonPositions(): Vector2[] {
        const positions: Vector2[] = [];
        const totalWidth = this.buttons.length * this.buttonSize + (this.buttons.length - 1) * this.buttonGap;
        const startX = (this.screenWidth - totalWidth) / 2 + this.buttonSize / 2;
        const y = this.screenHeight - 100;
        
        for (let i = 0; i < this.buttons.length; i++) {
            positions.push({
                x: startX + i * (this.buttonSize + this.buttonGap),
                y,
            });
        }
        
        return positions;
    }

    /**
     * 处理触摸/点击
     */
    public handleInput(x: number, y: number, isPressed: boolean): number {
        const positions = this.getButtonPositions();
        
        for (let i = 0; i < positions.length; i++) {
            const pos = positions[i];
            const halfSize = this.buttonSize / 2;
            
            if (
                x >= pos.x - halfSize &&
                x <= pos.x + halfSize &&
                y >= pos.y - halfSize &&
                y <= pos.y + halfSize
            ) {
                if (isPressed) {
                    this.pressedButton = i;
                    return i;
                } else {
                    this.pressedButton = -1;
                }
                return i;
            }
        }
        
        if (!isPressed) {
            this.pressedButton = -1;
        }
        
        return -1;
    }

    // ============ Getters ============

    public getButtonCount(): number {
        return this.buttons.length;
    }

    public getButtonSize(): number {
        return this.buttonSize;
    }
}

// 便捷导出单例
export const skillPanel = SkillPanel.getInstance();
