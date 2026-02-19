/**
 * JoystickUI.ts
 * 虚拟摇杆UI
 * 
 * 核心要求：
 * - 左下固定（x: 120, y: screenHeight-200）
 * - 死区0.15
 * - 响应<16ms
 */

import { Vector2 } from '../physics/AABB';
import { inputManager } from '../input/InputManager';

export class JoystickUI {
    private static instance: JoystickUI;
    
    // 配置
    private position: Vector2 = { x: 120, y: 500 };
    private radius: number = 80;
    private deadZone: number = 0.15;
    
    // 屏幕尺寸
    private screenHeight: number = 667;
    
    // 可视化
    private isActive: boolean = false;
    private stickPosition: Vector2 = { x: 0, y: 0 };

    private constructor() {}

    public static getInstance(): JoystickUI {
        if (!JoystickUI.instance) {
            JoystickUI.instance = new JoystickUI();
        }
        return JoystickUI.instance;
    }

    /**
     * 初始化
     */
    public initialize(screenWidth: number, screenHeight: number): void {
        this.screenHeight = screenHeight;
        
        // 设置位置（左下）
        this.position = {
            x: 120,
            y: screenHeight - 200,
        };
    }

    /**
     * 更新
     */
    public update(): void {
        // 获取输入管理器的摇杆数据
        const visual = inputManager.getJoystickVisual();
        
        if (visual) {
            this.isActive = true;
            
            // 计算摇杆偏移
            const dx = visual.current.x - visual.origin.x;
            const dy = visual.current.y - visual.origin.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // 限制在半径内
            const maxDistance = Math.min(distance, this.radius);
            const angle = Math.atan2(dy, dx);
            
            this.stickPosition = {
                x: Math.cos(angle) * maxDistance,
                y: Math.sin(angle) * maxDistance,
            };
        } else {
            this.isActive = false;
            this.stickPosition = { x: 0, y: 0 };
        }
    }

    /**
     * 渲染摇杆
     */
    public render(ctx: CanvasRenderingContext2D): void {
        // 底座
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // 死区圆
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.arc(
            this.position.x,
            this.position.y,
            this.radius * this.deadZone,
            0,
            Math.PI * 2
        );
        ctx.fill();
        
        // 摇杆
        const stickX = this.position.x + this.stickPosition.x;
        const stickY = this.position.y + this.stickPosition.y;
        
        ctx.fillStyle = this.isActive ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.arc(stickX, stickY, 25, 0, Math.PI * 2);
        ctx.fill();
        
        // 方向指示
        if (this.isActive) {
            const magnitude = Math.sqrt(
                this.stickPosition.x * this.stickPosition.x +
                this.stickPosition.y * this.stickPosition.y
            );
            const normalizedMagnitude = magnitude / this.radius;
            
            ctx.fillStyle = `rgba(255, 255, 255, ${normalizedMagnitude * 0.5})`;
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(
                `${Math.floor(normalizedMagnitude * 100)}%`,
                this.position.x,
                this.position.y + this.radius + 15
            );
        }
    }

    /**
     * 检查点是否在摇杆区域内
     */
    public isPointInside(x: number, y: number): boolean {
        const dx = x - this.position.x;
        const dy = y - this.position.y;
        return Math.sqrt(dx * dx + dy * dy) <= this.radius;
    }

    // ============ Getters ============

    public getPosition(): Vector2 {
        return { ...this.position };
    }

    public getRadius(): number {
        return this.radius;
    }

    public getDeadZone(): number {
        return this.deadZone;
    }

    public isJoystickActive(): boolean {
        return this.isActive;
    }
}

// 便捷导出单例
export const joystickUI = JoystickUI.getInstance();
