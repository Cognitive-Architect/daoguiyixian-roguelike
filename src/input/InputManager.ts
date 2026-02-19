/**
 * InputManager.ts
 * 输入管理器 - 统一管理所有输入设备
 * 
 * 核心要求：
 * - 支持Touch/键盘/手柄，自动识别设备类型
 * - 响应<16ms
 * 
 * DEBT-B02-001: 暂时只有Touch和键盘（无手柄）
 */

import { Vec2, Vector2 } from '../physics/AABB';
import { EventBus, GameEvents } from '../core/EventBus';

export enum InputDevice {
    NONE = 'none',
    TOUCH = 'touch',
    KEYBOARD = 'keyboard',
    GAMEPAD = 'gamepad',
}

export enum InputAction {
    MOVE_UP = 'move_up',
    MOVE_DOWN = 'move_down',
    MOVE_LEFT = 'move_left',
    MOVE_RIGHT = 'move_right',
    ATTACK = 'attack',
    SKILL_1 = 'skill_1',
    SKILL_2 = 'skill_2',
    SKILL_3 = 'skill_3',
    SKILL_4 = 'skill_4',
    INTERACT = 'interact',
    PAUSE = 'pause',
}

export interface InputState {
    device: InputDevice;
    moveDirection: Vector2;
    actions: Map<InputAction, boolean>;
    actionPressed: Map<InputAction, boolean>; // 仅一帧
    actionReleased: Map<InputAction, boolean>; // 仅一帧
}

export class InputManager {
    private static instance: InputManager;
    private eventBus: EventBus;
    
    // 输入状态
    private currentState: InputState;
    private previousState: InputState;
    
    // 设备检测
    private currentDevice: InputDevice = InputDevice.NONE;
    
    // 键盘状态
    private keysPressed: Set<string> = new Set();
    private keysJustPressed: Set<string> = new Set();
    private keysJustReleased: Set<string> = new Set();
    
    // 触摸状态
    private touchStart: Vector2 | null = null;
    private touchCurrent: Vector2 | null = null;
    private touchId: number | null = null;
    
    // 虚拟摇杆配置
    private joystickConfig = {
        position: { x: 120, y: 500 }, // 左下固定位置
        radius: 80,
        deadZone: 0.15,
    };
    
    // 按键映射
    private keyMap: Map<string, InputAction> = new Map([
        ['KeyW', InputAction.MOVE_UP],
        ['KeyS', InputAction.MOVE_DOWN],
        ['KeyA', InputAction.MOVE_LEFT],
        ['KeyD', InputAction.MOVE_RIGHT],
        ['ArrowUp', InputAction.MOVE_UP],
        ['ArrowDown', InputAction.MOVE_DOWN],
        ['ArrowLeft', InputAction.MOVE_LEFT],
        ['ArrowRight', InputAction.MOVE_RIGHT],
        ['Space', InputAction.ATTACK],
        ['KeyJ', InputAction.SKILL_1],
        ['KeyK', InputAction.SKILL_2],
        ['KeyL', InputAction.SKILL_3],
        ['KeyI', InputAction.SKILL_4],
        ['KeyE', InputAction.INTERACT],
        ['Escape', InputAction.PAUSE],
    ]);

    private constructor() {
        this.eventBus = EventBus.getInstance();
        this.currentState = this.createEmptyState();
        this.previousState = this.createEmptyState();
    }

    public static getInstance(): InputManager {
        if (!InputManager.instance) {
            InputManager.instance = new InputManager();
        }
        return InputManager.instance;
    }

    /**
     * 初始化输入系统
     */
    public initialize(): void {
        this.setupKeyboardListeners();
        this.setupTouchListeners();
        
        // 检测设备类型
        this.detectDevice();
        
        console.log(`[InputManager] Initialized, device: ${this.currentDevice}`);
    }

    /**
     * 检测设备类型
     */
    private detectDevice(): void {
        const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const hasKeyboard = 'onkeydown' in window;
        
        if (hasTouch) {
            this.currentDevice = InputDevice.TOUCH;
        } else if (hasKeyboard) {
            this.currentDevice = InputDevice.KEYBOARD;
        }
    }

    /**
     * 设置键盘监听器
     */
    private setupKeyboardListeners(): void {
        window.addEventListener('keydown', (e) => {
            if (!this.keysPressed.has(e.code)) {
                this.keysJustPressed.add(e.code);
                this.keysPressed.add(e.code);
            }
            this.currentDevice = InputDevice.KEYBOARD;
        });

        window.addEventListener('keyup', (e) => {
            this.keysJustReleased.add(e.code);
            this.keysPressed.delete(e.code);
        });
    }

    /**
     * 设置触摸监听器
     */
    private setupTouchListeners(): void {
        const handleTouchStart = (e: TouchEvent) => {
            e.preventDefault();
            this.currentDevice = InputDevice.TOUCH;
            
            const touch = e.touches[0];
            this.touchId = touch.identifier;
            this.touchStart = { x: touch.clientX, y: touch.clientY };
            this.touchCurrent = { x: touch.clientX, y: touch.clientY };
        };

        const handleTouchMove = (e: TouchEvent) => {
            e.preventDefault();
            
            if (this.touchId !== null) {
                for (let i = 0; i < e.touches.length; i++) {
                    if (e.touches[i].identifier === this.touchId) {
                        this.touchCurrent = { x: e.touches[i].clientX, y: e.touches[i].clientY };
                        break;
                    }
                }
            }
        };

        const handleTouchEnd = (e: TouchEvent) => {
            e.preventDefault();
            
            if (this.touchId !== null) {
                let found = false;
                for (let i = 0; i < e.touches.length; i++) {
                    if (e.touches[i].identifier === this.touchId) {
                        found = true;
                        break;
                    }
                }
                
                if (!found) {
                    this.touchId = null;
                    this.touchStart = null;
                    this.touchCurrent = null;
                }
            }
        };

        // 使用passive: false确保可以preventDefault
        window.addEventListener('touchstart', handleTouchStart, { passive: false });
        window.addEventListener('touchmove', handleTouchMove, { passive: false });
        window.addEventListener('touchend', handleTouchEnd, { passive: false });
        window.addEventListener('touchcancel', handleTouchEnd, { passive: false });
    }

    /**
     * 更新输入状态
     */
    public update(): void {
        // 保存上一帧状态
        this.previousState = { ...this.currentState };
        this.previousState.moveDirection = { ...this.currentState.moveDirection };
        this.previousState.actions = new Map(this.currentState.actions);
        
        // 清空一帧状态
        this.currentState.actionPressed.clear();
        this.currentState.actionReleased.clear();
        
        // 更新移动方向
        this.updateMoveDirection();
        
        // 更新动作状态
        this.updateActions();
        
        // 清空按键事件
        this.keysJustPressed.clear();
        this.keysJustReleased.clear();
    }

    /**
     * 更新移动方向
     */
    private updateMoveDirection(): void {
        let direction = Vec2.zero();
        
        if (this.currentDevice === InputDevice.TOUCH && this.touchStart && this.touchCurrent) {
            // 虚拟摇杆计算
            const dx = this.touchCurrent.x - this.touchStart.x;
            const dy = this.touchCurrent.y - this.touchStart.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > this.joystickConfig.deadZone * this.joystickConfig.radius) {
                const normalizedDistance = Math.min(distance, this.joystickConfig.radius) / this.joystickConfig.radius;
                direction.x = (dx / distance) * normalizedDistance;
                direction.y = -(dy / distance) * normalizedDistance; // Y轴翻转
            }
        } else if (this.currentDevice === InputDevice.KEYBOARD) {
            // 键盘输入
            if (this.keysPressed.has('KeyW') || this.keysPressed.has('ArrowUp')) {
                direction.y += 1;
            }
            if (this.keysPressed.has('KeyS') || this.keysPressed.has('ArrowDown')) {
                direction.y -= 1;
            }
            if (this.keysPressed.has('KeyA') || this.keysPressed.has('ArrowLeft')) {
                direction.x -= 1;
            }
            if (this.keysPressed.has('KeyD') || this.keysPressed.has('ArrowRight')) {
                direction.x += 1;
            }
            
            // 归一化
            if (direction.x !== 0 || direction.y !== 0) {
                const len = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
                direction.x /= len;
                direction.y /= len;
            }
        }
        
        this.currentState.moveDirection = direction;
    }

    /**
     * 更新动作状态
     */
    private updateActions(): void {
        // 键盘动作
        for (const [key, action] of this.keyMap) {
            const wasPressed = this.previousState.actions.get(action) || false;
            const isPressed = this.keysPressed.has(key);
            
            this.currentState.actions.set(action, isPressed);
            
            if (isPressed && !wasPressed) {
                this.currentState.actionPressed.set(action, true);
            }
            if (!isPressed && wasPressed) {
                this.currentState.actionReleased.set(action, true);
            }
        }
    }

    /**
     * 创建空输入状态
     */
    private createEmptyState(): InputState {
        return {
            device: InputDevice.NONE,
            moveDirection: Vec2.zero(),
            actions: new Map(),
            actionPressed: new Map(),
            actionReleased: new Map(),
        };
    }

    // ============ 公共API ============

    /**
     * 获取移动方向
     */
    public getMoveDirection(): Vector2 {
        return this.currentState.moveDirection;
    }

    /**
     * 获取移动向量长度（用于摇杆力度）
     */
    public getMoveMagnitude(): number {
        const dir = this.currentState.moveDirection;
        return Math.sqrt(dir.x * dir.x + dir.y * dir.y);
    }

    /**
     * 检查动作是否按下
     */
    public isActionPressed(action: InputAction): boolean {
        return this.currentState.actions.get(action) || false;
    }

    /**
     * 检查动作是否刚按下（仅一帧）
     */
    public isActionJustPressed(action: InputAction): boolean {
        return this.currentState.actionPressed.get(action) || false;
    }

    /**
     * 检查动作是否刚释放（仅一帧）
     */
    public isActionJustReleased(action: InputAction): boolean {
        return this.currentState.actionReleased.get(action) || false;
    }

    /**
     * 获取当前设备类型
     */
    public getCurrentDevice(): InputDevice {
        return this.currentDevice;
    }

    /**
     * 获取虚拟摇杆位置
     */
    public getJoystickPosition(): Vector2 {
        return { ...this.joystickConfig.position };
    }

    /**
     * 设置虚拟摇杆位置
     */
    public setJoystickPosition(x: number, y: number): void {
        this.joystickConfig.position.x = x;
        this.joystickConfig.position.y = y;
    }

    /**
     * 获取虚拟摇杆可视化数据
     */
    public getJoystickVisual(): { origin: Vector2; current: Vector2 | null; radius: number } | null {
        if (!this.touchStart || !this.touchCurrent) {
            return null;
        }
        
        return {
            origin: this.touchStart,
            current: this.touchCurrent,
            radius: this.joystickConfig.radius,
        };
    }

    /**
     * 是否有任何输入
     */
    public hasInput(): boolean {
        return this.getMoveMagnitude() > 0 || this.keysPressed.size > 0;
    }

    /**
     * 获取8方向输入（用于动画）
     */
    public get8Direction(): number {
        const dir = this.currentState.moveDirection;
        if (dir.x === 0 && dir.y === 0) return -1;
        
        const angle = Math.atan2(dir.y, dir.x);
        const degrees = (angle * 180 / Math.PI + 360) % 360;
        
        // 8方向: 0=右, 1=右上, 2=上, 3=左上, 4=左, 5=左下, 6=下, 7=右下
        return Math.round(degrees / 45) % 8;
    }
}

// 便捷导出单例
export const inputManager = InputManager.getInstance();
