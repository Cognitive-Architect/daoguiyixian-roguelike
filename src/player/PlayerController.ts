/**
 * PlayerController.ts
 * 玩家控制器 - 割草爽游单手操作（左手摇杆移动 + 自动攻击）
 *
 * DEBT-INPUT-001: 暂不支持手柄/键盘输入（v0.2.0追加）
 */

import { Vector2 } from '../physics/AABB';
import { InputManager, InputAction } from '../input/InputManager';
import { EventBus, GameEvents } from '../core/EventBus';
import { gameManager } from '../core/GameManager';
import defaultPlayerConfig from '../../assets/configs/player.json';

export enum PlayerState {
    IDLE = 0,
    WALK = 1,
    ATTACK = 2,
    HURT = 3,
    DEAD = 4,
}

export enum EffectType {
    NORMAL = 'normal',
    PURPLE_FLAME = 'purple_flame',
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
    attackRange: number;
}

export interface PlayerConfig {
    baseSpeed: number;
    maxHp: number;
    attackRange: number;
}

export interface EnemyTarget {
    id?: string;
    position: Vector2;
}

export const DEFAULT_PLAYER_STATS: PlayerStats = {
    maxHp: 100,
    hp: 100,
    maxSan: 100,
    san: 100,
    moveSpeed: 300,
    attackSpeed: 1.0,
    damage: 10,
    critRate: 0.05,
    critDamage: 1.5,
    defense: 0,
    attackRange: 120,
};

const LOW_SAN_THRESHOLD = 0.3;
const LOW_SAN_SPEED_MULTIPLIER = 1.2;
const AUTO_ATTACK_INTERVAL = 0.5;

export class PlayerController {
    private inputManager: InputManager;
    private eventBus: EventBus;

    private currentState: PlayerState = PlayerState.IDLE;
    private facingDirection: Vector2 = { x: 1, y: 0 };

    private position: Vector2 = { x: 0, y: 0 };
    private velocity: Vector2 = { x: 0, y: 0 };

    private readonly accelerationTime = 0.2;
    private readonly decelerationTime = 0.1;
    private acceleration: number;
    private deceleration: number;

    private baseStats: PlayerStats = { ...DEFAULT_PLAYER_STATS };
    private currentStats: PlayerStats = { ...DEFAULT_PLAYER_STATS };

    private attackTimer = 0;

    private hurtTimer = 0;
    private invincibleTimer = 0;
    private readonly hurtDuration = 0.3;
    private readonly invincibleDuration = 1.0;

    private animationTimer = 0;
    private animationFrame = 0;

    private enemyTargets: EnemyTarget[] = [];
    private attackEffectType: EffectType = EffectType.NORMAL;

    constructor() {
        this.inputManager = InputManager.getInstance();
        this.eventBus = EventBus.getInstance();
        this.acceleration = this.currentStats.moveSpeed / this.accelerationTime;
        this.deceleration = this.currentStats.moveSpeed / this.decelerationTime;
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        this.eventBus.on(GameEvents.GAME_START, () => this.reset());
    }

    public reset(): void {
        this.position = { x: 0, y: 0 };
        this.velocity = { x: 0, y: 0 };
        this.currentState = PlayerState.IDLE;
        this.currentStats = { ...this.baseStats, hp: this.baseStats.maxHp, san: this.baseStats.maxSan };
        this.enemyTargets = [];
        this.attackTimer = 0;
        this.hurtTimer = 0;
        this.invincibleTimer = 0;
        this.attackEffectType = EffectType.NORMAL;

        this.eventBus.emit(GameEvents.PLAYER_SPAWN, { position: this.position });
    }

    public update(deltaTime: number): void {
        if (this.currentState === PlayerState.DEAD) {
            return;
        }

        this.updateTimers(deltaTime);
        this.updateSanityBuffState();
        this.handleInput();
        this.updateMovement(deltaTime);
        this.tryAutoAttack();
        this.updateAnimation(deltaTime);

        if (this.velocity.x !== 0 || this.velocity.y !== 0) {
            this.eventBus.emit(GameEvents.PLAYER_MOVE, {
                position: this.position,
                velocity: this.velocity,
                direction: this.getMovementDirection(),
            });
        }
    }

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

    private handleInput(): void {
        if (this.currentState === PlayerState.HURT) {
            return;
        }

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

    private tryAutoAttack(): void {
        if (this.attackTimer > 0 || this.currentState === PlayerState.HURT || this.currentState === PlayerState.DEAD) {
            return;
        }

        const nearestEnemy = this.findNearestEnemyInRange();
        if (!nearestEnemy) {
            return;
        }

        const direction = this.getDirectionTo(nearestEnemy.position);
        if (direction.x !== 0 || direction.y !== 0) {
            this.facingDirection = direction;
        }

        this.changeState(PlayerState.ATTACK);
        this.attackTimer = AUTO_ATTACK_INTERVAL / this.currentStats.attackSpeed;

        this.eventBus.emit(GameEvents.PLAYER_ATTACK, {
            position: this.position,
            direction: this.facingDirection,
            damage: this.currentStats.damage,
            effectType: this.attackEffectType,
        });

        setTimeout(() => {
            if (this.currentState === PlayerState.ATTACK) {
                this.changeState(PlayerState.IDLE);
            }
        }, 180);
    }

    private findNearestEnemyInRange(): EnemyTarget | null {
        let nearest: EnemyTarget | null = null;
        let minDistance = Number.POSITIVE_INFINITY;

        for (const enemy of this.enemyTargets) {
            const distance = this.distanceTo(enemy.position);
            if (distance <= this.currentStats.attackRange && distance < minDistance) {
                minDistance = distance;
                nearest = enemy;
            }
        }

        return nearest;
    }

    private useSkill(slot: number): void {
        this.eventBus.emit('player:skill', { slot, position: this.position });
    }

    private updateMovement(deltaTime: number): void {
        if (this.currentState === PlayerState.HURT || this.currentState === PlayerState.ATTACK) {
            this.applyDeceleration(deltaTime);
            this.applyVelocity(deltaTime);
            return;
        }

        const inputDir = this.getMovementDirection();
        const inputMag = this.inputManager.getMoveMagnitude();
        const moveSpeed = this.getCurrentMoveSpeed();

        if (inputMag > 0) {
            this.facingDirection = { ...inputDir };

            const targetVelocity = {
                x: inputDir.x * moveSpeed,
                y: inputDir.y * moveSpeed,
            };

            this.velocity.x = this.moveTowards(this.velocity.x, targetVelocity.x, this.acceleration * deltaTime);
            this.velocity.y = this.moveTowards(this.velocity.y, targetVelocity.y, this.acceleration * deltaTime);

            if (this.currentState === PlayerState.IDLE) {
                this.changeState(PlayerState.WALK);
            }
        } else {
            this.applyDeceleration(deltaTime);

            if (this.currentState === PlayerState.WALK && this.getSpeed() < 10) {
                this.changeState(PlayerState.IDLE);
            }
        }

        this.applyVelocity(deltaTime);
    }

    private applyDeceleration(deltaTime: number): void {
        this.velocity.x = this.moveTowards(this.velocity.x, 0, this.deceleration * deltaTime);
        this.velocity.y = this.moveTowards(this.velocity.y, 0, this.deceleration * deltaTime);
    }

    private applyVelocity(deltaTime: number): void {
        this.position.x += this.velocity.x * deltaTime;
        this.position.y += this.velocity.y * deltaTime;
    }

    private moveTowards(current: number, target: number, maxDelta: number): number {
        if (Math.abs(target - current) <= maxDelta) {
            return target;
        }
        return current + Math.sign(target - current) * maxDelta;
    }

    private updateAnimation(deltaTime: number): void {
        this.animationTimer += deltaTime;

        switch (this.currentState) {
            case PlayerState.IDLE:
                if (this.animationTimer > 0.5) {
                    this.animationTimer = 0;
                    this.animationFrame = (this.animationFrame + 1) % 4;
                }
                break;
            case PlayerState.WALK:
                if (this.animationTimer > 0.15) {
                    this.animationTimer = 0;
                    this.animationFrame = (this.animationFrame + 1) % 4;
                }
                break;
            case PlayerState.ATTACK:
                if (this.animationTimer > 0.1) {
                    this.animationTimer = 0;
                    this.animationFrame = (this.animationFrame + 1) % 2;
                }
                break;
            case PlayerState.HURT:
                this.animationFrame = 0;
                break;
        }
    }

    private changeState(newState: PlayerState): void {
        if (this.currentState !== newState) {
            this.currentState = newState;
            this.animationTimer = 0;
            this.animationFrame = 0;
        }
    }

    private updateSanityBuffState(): void {
        const isLowSanity = this.currentStats.san / this.currentStats.maxSan < LOW_SAN_THRESHOLD;
        this.attackEffectType = isLowSanity ? EffectType.PURPLE_FLAME : EffectType.NORMAL;
    }

    private getCurrentMoveSpeed(): number {
        if (this.currentStats.san / this.currentStats.maxSan < LOW_SAN_THRESHOLD) {
            return this.currentStats.moveSpeed * LOW_SAN_SPEED_MULTIPLIER;
        }
        return this.currentStats.moveSpeed;
    }

    private getMovementDirection(): Vector2 {
        const direction = this.inputManager.getMoveDirection();
        const length = Math.hypot(direction.x, direction.y);
        if (length === 0) {
            return { x: 0, y: 0 };
        }

        return {
            x: direction.x / length,
            y: direction.y / length,
        };
    }

    private getDirectionTo(target: Vector2): Vector2 {
        const dx = target.x - this.position.x;
        const dy = target.y - this.position.y;
        const length = Math.hypot(dx, dy);

        if (length === 0) {
            return { x: 0, y: 0 };
        }

        return { x: dx / length, y: dy / length };
    }

    private distanceTo(target: Vector2): number {
        const dx = target.x - this.position.x;
        const dy = target.y - this.position.y;
        return Math.hypot(dx, dy);
    }

    public takeDamage(amount: number, source?: { position?: Vector2 }): void {
        if (this.currentState === PlayerState.DEAD || this.invincibleTimer > 0) return;

        const actualDamage = Math.max(1, amount - this.currentStats.defense);
        this.currentStats.hp -= actualDamage;

        this.hurtTimer = this.hurtDuration;
        this.invincibleTimer = this.invincibleDuration;
        this.changeState(PlayerState.HURT);

        if (source?.position) {
            const knockbackDir = {
                x: this.position.x - source.position.x,
                y: this.position.y - source.position.y,
            };
            const len = Math.hypot(knockbackDir.x, knockbackDir.y);
            if (len > 0) {
                this.velocity.x = (knockbackDir.x / len) * 200;
                this.velocity.y = (knockbackDir.y / len) * 200;
            }
        }

        this.eventBus.emit(GameEvents.PLAYER_DAMAGE, {
            amount: actualDamage,
            hp: this.currentStats.hp,
            maxHp: this.currentStats.maxHp,
        });

        if (this.currentStats.hp <= 0) {
            this.die();
        }
    }

    public heal(amount: number): void {
        this.currentStats.hp = Math.min(this.currentStats.hp + amount, this.currentStats.maxHp);
        this.eventBus.emit(GameEvents.PLAYER_HEAL, {
            amount,
            hp: this.currentStats.hp,
            maxHp: this.currentStats.maxHp,
        });
    }

    private die(): void {
        this.currentStats.hp = 0;
        this.changeState(PlayerState.DEAD);
        this.eventBus.emit(GameEvents.PLAYER_DEATH, { position: this.position });
        gameManager.gameOver(false);
    }

    public modifyStats(modifier: Partial<PlayerStats>): void {
        Object.assign(this.baseStats, modifier);
        Object.assign(this.currentStats, modifier);
        this.recalculateMovementParams();
    }

    public applyModifier(modifier: Partial<PlayerStats>): void {
        for (const [key, value] of Object.entries(modifier)) {
            const statKey = key as keyof PlayerStats;
            if (typeof value === 'number') {
                (this.currentStats[statKey] as number) += value;
            }
        }
        this.recalculateMovementParams();
    }

    public async loadConfig(configPath: string = '/assets/configs/player.json'): Promise<void> {
        try {
            const response = await fetch(configPath);
            const data = (await response.json()) as PlayerConfig;
            this.applyConfig(data);
        } catch {
            this.applyConfig(defaultPlayerConfig as PlayerConfig);
        }
    }

    public applyConfig(config: PlayerConfig): void {
        this.baseStats.moveSpeed = config.baseSpeed;
        this.baseStats.maxHp = config.maxHp;
        this.baseStats.hp = config.maxHp;
        this.baseStats.attackRange = config.attackRange;

        this.currentStats = {
            ...this.currentStats,
            moveSpeed: config.baseSpeed,
            maxHp: config.maxHp,
            hp: Math.min(this.currentStats.hp, config.maxHp),
            attackRange: config.attackRange,
        };

        this.recalculateMovementParams();
    }

    private recalculateMovementParams(): void {
        this.acceleration = this.currentStats.moveSpeed / this.accelerationTime;
        this.deceleration = this.currentStats.moveSpeed / this.decelerationTime;
    }

    public setEnemyTargets(targets: EnemyTarget[]): void {
        this.enemyTargets = [...targets];
    }

    public setSanity(value: number): void {
        this.currentStats.san = Math.max(0, Math.min(value, this.currentStats.maxSan));
        this.updateSanityBuffState();
    }

    public getAttackEffectType(): EffectType {
        return this.attackEffectType;
    }

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
        return Math.hypot(this.velocity.x, this.velocity.y);
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

    public getNormalizedJoystickDirection(): Vector2 {
        return this.getMovementDirection();
    }
}

export const playerController = new PlayerController();
