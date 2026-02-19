/**
 * EnemyAI.ts
 * 敌人AI系统 - 简单行为树
 * 
 * 核心行为：Root→Selector→[AttackPlayer, Wander]
 * 坐忘道特殊AI：伪装→侦测→背刺
 * 
 * DEBT-B05-001: AI用简单状态机（非完整Behavior Tree库）
 * DEBT-B05-002: 寻路用直线追踪（无NavMesh）
 */

import { Vector2, Vec2 } from '../physics/AABB';

export enum AIState {
    IDLE = 'idle',
    CHASE = 'chase',
    ATTACK = 'attack',
    WANDER = 'wander',
    RETURN = 'return',
    DEAD = 'dead',
    
    // 坐忘道特殊状态
    DISGUISED = 'disguised',
    REVEALING = 'revealing',
    BACKSTAB = 'backstab',
}

export interface EnemyConfig {
    id: string;
    name: string;
    category: 'normal' | 'elite' | 'boss';
    hp: number;
    speed: number;
    damage: number;
    attackRange: number;
    attackCooldown: number;
    detectionRange: number;
    special?: string;
    specialParams?: Record<string, any>;
}

export interface AIContext {
    position: Vector2;
    velocity: Vector2;
    targetPosition: Vector2 | null;
    state: AIState;
    stateTimer: number;
    attackTimer: number;
    hp: number;
    maxHp: number;
    isDead: boolean;
    
    // 特殊状态
    isDisguised: boolean;
    hasRevealed: boolean;
    backstabReady: boolean;
    isInvincible: boolean;
    invincibleTimer: number;
    
    // 召唤相关
    summonTimer: number;
}

export class EnemyAI {
    private config: EnemyConfig;
    private context: AIContext;
    private spawnPosition: Vector2;
    private maxChaseDistance: number = 500;
    
    // 游荡参数
    private wanderTarget: Vector2 | null = null;
    private wanderTimer: number = 0;
    private readonly wanderInterval = 3;
    private readonly wanderRadius = 150;

    constructor(config: EnemyConfig, spawnPosition: Vector2) {
        this.config = config;
        this.spawnPosition = { ...spawnPosition };
        this.context = this.createInitialContext(spawnPosition);
    }

    private createInitialContext(position: Vector2): AIContext {
        return {
            position: { ...position },
            velocity: { x: 0, y: 0 },
            targetPosition: null,
            state: AIState.IDLE,
            stateTimer: 0,
            attackTimer: 0,
            hp: this.config.hp,
            maxHp: this.config.hp,
            isDead: false,
            isDisguised: false,
            hasRevealed: false,
            backstabReady: false,
            isInvincible: false,
            invincibleTimer: 0,
            summonTimer: 0,
        };
    }

    /**
     * 更新AI
     */
    public update(deltaTime: number, playerPosition: Vector2): void {
        if (this.context.isDead) return;

        // 更新计时器
        this.updateTimers(deltaTime);
        
        // 特殊能力更新
        this.updateSpecialAbilities(deltaTime);
        
        // 状态机更新
        this.updateStateMachine(deltaTime, playerPosition);
        
        // 执行当前状态
        this.executeState(deltaTime, playerPosition);
        
        // 应用速度
        this.applyVelocity(deltaTime);
    }

    /**
     * 更新计时器
     */
    private updateTimers(deltaTime: number): void {
        this.context.stateTimer += deltaTime;
        
        if (this.context.attackTimer > 0) {
            this.context.attackTimer -= deltaTime;
        }
        
        if (this.context.invincibleTimer > 0) {
            this.context.invincibleTimer -= deltaTime;
            if (this.context.invincibleTimer <= 0) {
                this.context.isInvincible = false;
            }
        }
    }

    /**
     * 更新特殊能力
     */
    private updateSpecialAbilities(deltaTime: number): void {
        switch (this.config.special) {
            case 'periodic_invincible':
                this.updatePeriodicInvincible(deltaTime);
                break;
            case 'summon_gu_man':
                this.updateSummon(deltaTime);
                break;
        }
    }

    /**
     * 周期性无敌
     */
    private updatePeriodicInvincible(deltaTime: number): void {
        const interval = this.config.specialParams?.interval || 5;
        const duration = this.config.specialParams?.duration || 2;
        
        const cycleTime = this.context.stateTimer % (interval + duration);
        this.context.isInvincible = cycleTime >= interval;
    }

    /**
     * 召唤更新
     */
    private updateSummon(deltaTime: number): void {
        this.context.summonTimer += deltaTime;
    }

    /**
     * 更新状态机
     */
    private updateStateMachine(deltaTime: number, playerPosition: Vector2): void {
        const distanceToPlayer = this.getDistanceTo(playerPosition);
        const canSeePlayer = distanceToPlayer < this.config.detectionRange;
        
        // 坐忘道特殊逻辑
        if (this.config.special === 'disguise_backstab') {
            this.updateZuoWangAI(deltaTime, playerPosition, distanceToPlayer);
            return;
        }
        
        // 标准AI状态机
        switch (this.context.state) {
            case AIState.IDLE:
                if (canSeePlayer) {
                    this.changeState(AIState.CHASE);
                } else if (this.context.stateTimer > 1) {
                    this.changeState(AIState.WANDER);
                }
                break;
                
            case AIState.WANDER:
                if (canSeePlayer) {
                    this.changeState(AIState.CHASE);
                } else if (this.context.stateTimer > this.wanderInterval) {
                    this.changeState(AIState.IDLE);
                }
                break;
                
            case AIState.CHASE:
                if (!canSeePlayer) {
                    this.changeState(AIState.RETURN);
                } else if (distanceToPlayer < this.config.attackRange) {
                    this.changeState(AIState.ATTACK);
                }
                break;
                
            case AIState.ATTACK:
                if (distanceToPlayer > this.config.attackRange * 1.5) {
                    this.changeState(AIState.CHASE);
                }
                break;
                
            case AIState.RETURN:
                const distanceToSpawn = this.getDistanceTo(this.spawnPosition);
                if (canSeePlayer) {
                    this.changeState(AIState.CHASE);
                } else if (distanceToSpawn < 10) {
                    this.changeState(AIState.IDLE);
                }
                break;
        }
    }

    /**
     * 坐忘道AI
     */
    private updateZuoWangAI(deltaTime: number, playerPosition: Vector2, distance: number): void {
        const disguiseRange = this.config.specialParams?.disguiseRange || 180;
        
        switch (this.context.state) {
            case AIState.DISGUISED:
                if (distance < disguiseRange) {
                    this.changeState(AIState.REVEALING);
                }
                break;
                
            case AIState.REVEALING:
                if (this.context.stateTimer > 0.5) {
                    this.changeState(AIState.BACKSTAB);
                }
                break;
                
            case AIState.BACKSTAB:
                if (distance > this.config.attackRange) {
                    this.changeState(AIState.CHASE);
                }
                break;
                
            case AIState.IDLE:
            case AIState.CHASE:
            case AIState.ATTACK:
                if (!this.context.hasRevealed) {
                    this.changeState(AIState.DISGUISED);
                    this.context.isDisguised = true;
                }
                break;
        }
    }

    /**
     * 执行当前状态
     */
    private executeState(deltaTime: number, playerPosition: Vector2): void {
        switch (this.context.state) {
            case AIState.IDLE:
                this.executeIdle();
                break;
            case AIState.WANDER:
                this.executeWander(deltaTime);
                break;
            case AIState.CHASE:
                this.executeChase(deltaTime, playerPosition);
                break;
            case AIState.ATTACK:
                this.executeAttack(playerPosition);
                break;
            case AIState.RETURN:
                this.executeReturn(deltaTime);
                break;
            case AIState.BACKSTAB:
                this.executeBackstab(playerPosition);
                break;
        }
    }

    /**
     * 待执行
     */
    private executeIdle(): void {
        this.context.velocity = { x: 0, y: 0 };
    }

    /**
     * 游荡执行
     */
    private executeWander(deltaTime: number): void {
        if (!this.wanderTarget || this.context.stateTimer > this.wanderInterval) {
            // 生成新的游荡目标
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * this.wanderRadius;
            this.wanderTarget = {
                x: this.spawnPosition.x + Math.cos(angle) * distance,
                y: this.spawnPosition.y + Math.sin(angle) * distance,
            };
        }
        
        this.moveTowards(this.wanderTarget, this.config.speed * 0.5);
    }

    /**
     * 追击执行
     */
    private executeChase(deltaTime: number, target: Vector2): void {
        this.moveTowards(target, this.config.speed);
    }

    /**
     * 攻击执行
     */
    private executeAttack(target: Vector2): void {
        this.context.velocity = { x: 0, y: 0 };
        
        if (this.context.attackTimer <= 0) {
            this.context.attackTimer = this.config.attackCooldown;
            // 触发攻击事件
        }
    }

    /**
     * 返回执行
     */
    private executeReturn(deltaTime: number): void {
        this.moveTowards(this.spawnPosition, this.config.speed * 0.8);
    }

    /**
     * 背刺执行
     */
    private executeBackstab(target: Vector2): void {
        this.context.hasRevealed = true;
        this.context.isDisguised = false;
        this.context.backstabReady = true;
        
        // 快速接近玩家
        this.moveTowards(target, this.config.speed * 1.5);
        
        // 在攻击范围内触发背刺
        const distance = this.getDistanceTo(target);
        if (distance < this.config.attackRange && this.context.attackTimer <= 0) {
            this.context.attackTimer = this.config.attackCooldown;
            this.context.backstabReady = false;
            // 触发背刺攻击（3倍伤害）
        }
    }

    /**
     * 向目标移动
     */
    private moveTowards(target: Vector2, speed: number): void {
        const dx = target.x - this.context.position.x;
        const dy = target.y - this.context.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 1) {
            this.context.velocity.x = (dx / distance) * speed;
            this.context.velocity.y = (dy / distance) * speed;
        } else {
            this.context.velocity = { x: 0, y: 0 };
        }
    }

    /**
     * 应用速度
     */
    private applyVelocity(deltaTime: number): void {
        this.context.position.x += this.context.velocity.x * deltaTime;
        this.context.position.y += this.context.velocity.y * deltaTime;
    }

    /**
     * 改变状态
     */
    private changeState(newState: AIState): void {
        if (this.context.state !== newState) {
            this.context.state = newState;
            this.context.stateTimer = 0;
        }
    }

    /**
     * 计算到目标的距离
     */
    private getDistanceTo(target: Vector2): number {
        const dx = this.context.position.x - target.x;
        const dy = this.context.position.y - target.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // ============ 公共API ============

    public getPosition(): Vector2 {
        return { ...this.context.position };
    }

    public getState(): AIState {
        return this.context.state;
    }

    public getContext(): AIContext {
        return this.context;
    }

    public getConfig(): EnemyConfig {
        return this.config;
    }

    public takeDamage(amount: number): void {
        if (this.context.isInvincible || this.context.isDead) return;
        
        this.context.hp -= amount;
        
        if (this.context.hp <= 0) {
            this.die();
        }
    }

    public die(): void {
        this.context.hp = 0;
        this.context.isDead = true;
        this.changeState(AIState.DEAD);
    }

    public isDead(): boolean {
        return this.context.isDead;
    }

    public canAttack(): boolean {
        return this.context.attackTimer <= 0 && !this.context.isDead;
    }

    public resetAttackTimer(): void {
        this.context.attackTimer = this.config.attackCooldown;
    }

    public getAttackDamage(): number {
        let damage = this.config.damage;
        
        // 背刺伤害加成
        if (this.context.backstabReady && this.config.special === 'disguise_backstab') {
            damage *= this.config.specialParams?.backstabMultiplier || 3;
        }
        
        return damage;
    }

    public shouldSummon(): boolean {
        if (this.config.special !== 'summon_gu_man') return false;
        
        const interval = this.config.specialParams?.interval || 10;
        if (this.context.summonTimer >= interval) {
            this.context.summonTimer = 0;
            return true;
        }
        return false;
    }
}
