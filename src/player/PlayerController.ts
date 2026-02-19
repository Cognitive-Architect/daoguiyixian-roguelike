/**
 * PlayerController.ts
 * 玩家控制器 - 输入+移动+动画
 * 
 * 核心要求：
 * - 刚体移动：速度插值（0.2秒加速到300px/s），阻尼停止（0.1秒归零）
 * - 动画状态机：IDLE(0)/WALK(1)/ATTACK(2)/HURT(3)/DEAD(4)
 * 
 * DEBT-B02-002: 动画用Tween而非骨骼动画
 */

import { Vec2, Vector2 } from '../physics/AABB';
import { InputManager, InputAction, inputManager } from '../input/InputManager';
import { EventBus, GameEvents } from '../core/EventBus';
import { gameManager } from '../core/GameManager';

export enum PlayerState {
    IDLE = 0,
    WALK = 1,
    ATTACK = 2,
    HURT = 3,
    DEAD = 4,
}

export interface PlayerStats {
    maxHp: number;
    hp: number;
    maxSan: number;
    san: number;
    moveSpeed: number;
    attackSpeed: number;
    damage: number;
    critRate: number;
    critDamage: number;
    defense: number;
}

export const DEFAULT_PLAYER_STATS: PlayerStats = {
    maxHp: 100,
    hp: 100,
    maxSan: 100,
    san: 100,
    moveSpeed: 300, // px/s
    attackSpeed: 1.0,
    damage: 10,
    critRate: 0.05,
    critDamage: 1.5,
    defense: 0,
};

export class PlayerController {
    // 系统引用
    private inputManager: InputManager;
    private eventBus: EventBus;
    
    // 状态
    private currentState: PlayerState = PlayerState.IDLE;
    private facingDirection: Vector2 = { x: 1, y: 0 };
    
    // 位置与移动
    private position: Vector2 = { x: 0, y: 0 };
    private velocity: Vector2 = { x: 0, y: 0 };
    
    // 移动参数
    private readonly accelerationTime = 0.2; // 加速到全速时间
    private readonly decelerationTime = 0.1; // 减速到停止时间
    private acceleration: number;
    private deceleration: number;
    
    // 属性
    private baseStats: PlayerStats = { ...DEFAULT_PLAYER_STATS };
    private currentStats: PlayerStats = { ...DEFAULT_PLAYER_STATS };
    
    // 攻击
    private attackCooldown: number = 0;
    private attackTimer: number = 0;
    
    // 受伤
    private hurtTimer: number = 0;
    private invincibleTimer: number = 0;
    private readonly hurtDuration = 0.3;
    private readonly invincibleDuration = 1.0;
    
    // 动画
    private animationTimer: number = 0;
    private animationFrame: number = 0;

    constructor() {
        this.inputManager = InputManager.getInstance();
        this.eventBus = EventBus.getInstance();
        
        // 计算加速度/减速度
        this.acceleration = this.currentStats.moveSpeed / this.accelerationTime;
        this.deceleration = this.currentStats.moveSpeed / this.decelerationTime;
        
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        this.eventBus.on(GameEvents.GAME_START, () => {
            this.reset();
        });
    }

    /**
     * 重置玩家状态
     */
    public reset(): void {
        this.position = { x: 0, y: 0 };
        this.velocity = { x: 0, y: 0 };
        this.currentState = PlayerState.IDLE;
        this.currentStats = { ...this.baseStats };
        this.attackTimer = 0;
        this.hurtTimer = 0;
        this.invincibleTimer = 0;
        
        this.eventBus.emit(GameEvents.PLAYER_SPAWN, { position: this.position });
    }

    /**
     * 更新玩家
     */
    public update(deltaTime: number): void {
        if (this.currentState === PlayerState.DEAD) {
            return;
        }

        // 更新计时器
        this.updateTimers(deltaTime);
        
        // 处理输入
        this.handleInput(deltaTime);
        
        // 更新移动
        this.updateMovement(deltaTime);
        
        // 更新动画
        this.updateAnimation(deltaTime);
        
        // 发送移动事件
        if (this.velocity.x !== 0 || this.velocity.y !== 0) {
            this.eventBus.emit(GameEvents.PLAYER_MOVE, {
                position: this.position,
                velocity: this.velocity,
            });
        }
    }

    /**
     * 更新计时器
     */
    private updateTimers(deltaTime: number): void {
        if (this.attackTimer > 0) {
            this.attackTimer -= deltaTime;
        }
        
        if (this.hurtTimer > 0) {
            this.hurtTimer -= deltaTime;
            if (this.hurtTimer <= 0 && this.currentState === PlayerState.HURT) {
                this.changeState(PlayerState.IDLE);
            }
        }
        
        if (this.invincibleTimer > 0) {
            this.invincibleTimer -= deltaTime;
        }
    }

    /**
     * 处理输入
     */
    private handleInput(deltaTime: number): void {
        // 受伤状态下不能操作
        if (this.currentState === PlayerState.HURT) {
            return;
        }

        // 攻击
        if (this.inputManager.isActionPressed(InputAction.ATTACK)) {
            this.tryAttack();
        }

        // 技能
        if (this.inputManager.isActionJustPressed(InputAction.SKILL_1)) {
            this.useSkill(0);
        }
        if (this.inputManager.isActionJustPressed(InputAction.SKILL_2)) {
            this.useSkill(1);
        }
        if (this.inputManager.isActionJustPressed(InputAction.SKILL_3)) {
            this.useSkill(2);
        }
        if (this.inputManager.isActionJustPressed(InputAction.SKILL_4)) {
            this.useSkill(3);
        }
    }

    /**
     * 尝试攻击
     */
    private tryAttack(): void {
        if (this.attackTimer > 0) return;
        if (this.currentState === PlayerState.ATTACK) return;
        
        this.changeState(PlayerState.ATTACK);
        this.attackTimer = 0.5 / this.currentStats.attackSpeed; // 攻击冷却
        
        this.eventBus.emit(GameEvents.PLAYER_ATTACK, {
            position: this.position,
            direction: this.facingDirection,
            damage: this.currentStats.damage,
        });
        
        // 攻击动画结束后返回IDLE
        setTimeout(() => {
            if (this.currentState === PlayerState.ATTACK) {
                this.changeState(PlayerState.IDLE);
            }
        }, 300);
    }

    /**
     * 使用技能
     */
    private useSkill(slot: number): void {
        this.eventBus.emit('player:skill', { slot, position: this.position });
    }

    /**
     * 更新移动
     */
    private updateMovement(deltaTime: number): void {
        if (this.currentState === PlayerState.HURT || this.currentState === PlayerState.ATTACK) {
            // 受伤/攻击时减速
            this.applyDeceleration(deltaTime);
            this.applyVelocity(deltaTime);
            return;
        }

        const inputDir = this.inputManager.getMoveDirection();
        const inputMag = this.inputManager.getMoveMagnitude();
        
        if (inputMag > 0) {
            // 更新朝向
            this.facingDirection = { ...inputDir };
            
            // 加速
            const targetVelocity = {
                x: inputDir.x * this.currentStats.moveSpeed,
                y: inputDir.y * this.currentStats.moveSpeed,
            };
            
            this.velocity.x = this.moveTowards(this.velocity.x, targetVelocity.x, this.acceleration * deltaTime);
            this.velocity.y = this.moveTowards(this.velocity.y, targetVelocity.y, this.acceleration * deltaTime);
            
            // 更新状态
            if (this.currentState === PlayerState.IDLE) {
                this.changeState(PlayerState.WALK);
            }
        } else {
            // 减速
            this.applyDeceleration(deltaTime);
            
            // 更新状态
            if (this.currentState === PlayerState.WALK && this.getSpeed() < 10) {
                this.changeState(PlayerState.IDLE);
            }
        }
        
        // 应用速度
        this.applyVelocity(deltaTime);
    }

    /**
     * 应用减速
     */
    private applyDeceleration(deltaTime: number): void {
        this.velocity.x = this.moveTowards(this.velocity.x, 0, this.deceleration * deltaTime);
        this.velocity.y = this.moveTowards(this.velocity.y, 0, this.deceleration * deltaTime);
    }

    /**
     * 应用速度到位置
     */
    private applyVelocity(deltaTime: number): void {
        this.position.x += this.velocity.x * deltaTime;
        this.position.y += this.velocity.y * deltaTime;
    }

    /**
     * 平滑移动辅助函数
     */
    private moveTowards(current: number, target: number, maxDelta: number): number {
        if (Math.abs(target - current) <= maxDelta) {
            return target;
        }
        return current + Math.sign(target - current) * maxDelta;
    }

    /**
     * 更新动画
     */
    private updateAnimation(deltaTime: number): void {
        this.animationTimer += deltaTime;
        
        // 根据状态更新动画帧
        switch (this.currentState) {
            case PlayerState.IDLE:
                // 待机动画循环
                if (this.animationTimer > 0.5) {
                    this.animationTimer = 0;
                    this.animationFrame = (this.animationFrame + 1) % 4;
                }
                break;
                
            case PlayerState.WALK:
                // 行走动画循环
                if (this.animationTimer > 0.15) {
                    this.animationTimer = 0;
                    this.animationFrame = (this.animationFrame + 1) % 4;
                }
                break;
                
            case PlayerState.ATTACK:
                // 攻击动画
                if (this.animationTimer > 0.1) {
                    this.animationTimer = 0;
                    this.animationFrame++;
                    if (this.animationFrame >= 2) {
                        this.animationFrame = 0;
                    }
                }
                break;
                
            case PlayerState.HURT:
                // 受伤动画
                this.animationFrame = 0;
                break;
        }
    }

    /**
     * 改变状态
     */
    private changeState(newState: PlayerState): void {
        if (this.currentState !== newState) {
            console.log(`[PlayerController] State: ${PlayerState[this.currentState]} -> ${PlayerState[newState]}`);
            this.currentState = newState;
            this.animationTimer = 0;
            this.animationFrame = 0;
        }
    }

    /**
     * 受到伤害
     */
    public takeDamage(amount: number, source?: any): void {
        if (this.currentState === PlayerState.DEAD) return;
        if (this.invincibleTimer > 0) return;
        
        // 计算实际伤害
        const actualDamage = Math.max(1, amount - this.currentStats.defense);
        this.currentStats.hp -= actualDamage;
        
        // 触发受伤状态
        this.hurtTimer = this.hurtDuration;
        this.invincibleTimer = this.invincibleDuration;
        this.changeState(PlayerState.HURT);
        
        // 击退效果
        if (source && source.position) {
            const knockbackDir = {
                x: this.position.x - source.position.x,
                y: this.position.y - source.position.y,
            };
            const len = Math.sqrt(knockbackDir.x * knockbackDir.x + knockbackDir.y * knockbackDir.y);
            if (len > 0) {
                this.velocity.x = (knockbackDir.x / len) * 200;
                this.velocity.y = (knockbackDir.y / len) * 200;
            }
        }
        
        // 发送事件
        this.eventBus.emit(GameEvents.PLAYER_DAMAGE, {
            amount: actualDamage,
            hp: this.currentStats.hp,
            maxHp: this.currentStats.maxHp,
        });
        
        // 检查死亡
        if (this.currentStats.hp <= 0) {
            this.die();
        }
    }

    /**
     * 治疗
     */
    public heal(amount: number): void {
        this.currentStats.hp = Math.min(this.currentStats.hp + amount, this.currentStats.maxHp);
        this.eventBus.emit(GameEvents.PLAYER_HEAL, {
            amount,
            hp: this.currentStats.hp,
            maxHp: this.currentStats.maxHp,
        });
    }

    /**
     * 死亡
     */
    private die(): void {
        this.currentStats.hp = 0;
        this.changeState(PlayerState.DEAD);
        this.eventBus.emit(GameEvents.PLAYER_DEATH, { position: this.position });
        gameManager.gameOver(false);
    }

    // ============ 属性修改 ============

    /**
     * 修改基础属性
     */
    public modifyStats(modifier: Partial<PlayerStats>): void {
        Object.assign(this.baseStats, modifier);
        Object.assign(this.currentStats, modifier);
    }

    /**
     * 应用临时属性修改（如升级）
     */
    public applyModifier(modifier: Partial<PlayerStats>): void {
        for (const [key, value] of Object.entries(modifier)) {
            const k = key as keyof PlayerStats;
            if (typeof value === 'number') {
                (this.currentStats[k] as number) += value;
            }
        }
        
        // 重新计算加速度
        this.acceleration = this.currentStats.moveSpeed / this.accelerationTime;
        this.deceleration = this.currentStats.moveSpeed / this.decelerationTime;
    }

    // ============ Getters ============

    public getPosition(): Vector2 {
        return { ...this.position };
    }

    public setPosition(x: number, y: number): void {
        this.position.x = x;
        this.position.y = y;
    }

    public getVelocity(): Vector2 {
        return { ...this.velocity };
    }

    public getSpeed(): number {
        return Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y);
    }

    public getState(): PlayerState {
        return this.currentState;
    }

    public getFacingDirection(): Vector2 {
        return { ...this.facingDirection };
    }

    public getStats(): PlayerStats {
        return { ...this.currentStats };
    }

    public getBaseStats(): PlayerStats {
        return { ...this.baseStats };
    }

    public getAnimationFrame(): number {
        return this.animationFrame;
    }

    public isInvincible(): boolean {
        return this.invincibleTimer > 0;
    }

    public isDead(): boolean {
        return this.currentState === PlayerState.DEAD;
    }
}

// 便捷导出
export const playerController = new PlayerController();
