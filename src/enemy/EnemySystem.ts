/**
 * EnemySystem.ts
 * B-04 敌人管理系统：波次、对象池、死亡收益、武器受击联动
 */

import { EventBus, GameEvents } from '../core/EventBus';
import { Vector2 } from '../physics/AABB';
import { Enemy, EnemyConfig } from './Enemy';
import { EnemyAI } from './EnemyAI';
import { upgradeSystem } from '../upgrade/UpgradeSystem';

interface EnemyWithAI {
    enemy: Enemy;
    ai: EnemyAI;
}

interface EnemyConfigFile {
    enemies: EnemyConfig[];
}

interface WeaponFirePayload {
    target?: { id?: string; position: Vector2 };
    damage?: number;
    effectType?: string;
}

export class EnemySystem {
    private static instance: EnemySystem;
    private readonly eventBus: EventBus;

    private configs = new Map<string, EnemyConfig>();
    private pool: EnemyWithAI[] = [];
    private active: Map<string, EnemyWithAI> = new Map();
    private idCounter = 0;

    constructor() {
        this.eventBus = EventBus.getInstance();
        this.setupEventListeners();
    }

    public static getInstance(): EnemySystem {
        if (!EnemySystem.instance) {
            EnemySystem.instance = new EnemySystem();
        }
        return EnemySystem.instance;
    }

    private setupEventListeners(): void {
        this.eventBus.on(GameEvents.WEAPON_FIRE, (payload?: WeaponFirePayload) => {
            if (!payload?.target || !payload.damage) return;
            this.applyWeaponHit(payload.target.id, payload.target.position, payload.damage, payload.effectType ?? 'NORMAL');
        });
    }

    public async loadConfigsFromJson(path: string): Promise<void> {
        const response = await fetch(path);
        const data = (await response.json()) as EnemyConfigFile;
        this.loadConfigs(data.enemies);
    }

    public loadConfigs(configs: EnemyConfig[]): void {
        this.configs.clear();
        for (const config of configs) {
            this.configs.set(config.id, { ...config });
        }
    }

    public initializePool(size: number = 120): void {
        this.pool = [];
        this.active.clear();

        const defaultConfig = this.configs.get('jiangshi') ?? {
            id: 'jiangshi',
            name: '行尸',
            hp: 30,
            speed: 80,
            damage: 10,
            exp: 5,
            ai: 'chase_melee',
            spawn_weight: 70,
        };

        for (let i = 0; i < size; i++) {
            const enemy = new Enemy(defaultConfig);
            const ai = new EnemyAI(enemy);
            this.pool.push({ enemy, ai });
        }
    }

    public spawnEnemy(id: string, position: Vector2): string | null {
        const config = this.configs.get(id);
        if (!config) return null;

        const slot = this.pool.find(item => !item.enemy.active);
        if (!slot) return null;

        // 替换配置
        const runtimeEnemy = new Enemy(config);
        const runtimeAI = new EnemyAI(runtimeEnemy);

        const runtimeId = `${id}_${this.idCounter++}`;
        runtimeEnemy.spawn(runtimeId, position);

        slot.enemy = runtimeEnemy;
        slot.ai = runtimeAI;
        this.active.set(runtimeId, slot);

        this.eventBus.emit(GameEvents.ENEMY_SPAWN, { id, runtimeId, position });
        return runtimeId;
    }

    public spawnHorde(id: string, count: number, center: Vector2): string[] {
        const ids: string[] = [];
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / Math.max(1, count);
            const radius = 40 + (i % 4) * 18;
            const position = {
                x: center.x + Math.cos(angle) * radius,
                y: center.y + Math.sin(angle) * radius,
            };
            const spawned = this.spawnEnemy(id, position);
            if (spawned) ids.push(spawned);
        }
        return ids;
    }

    public update(deltaTime: number, playerPosition: Vector2): void {
        for (const { enemy, ai } of this.active.values()) {
            ai.update({
                deltaTime,
                playerPosition,
                spawnMinion: (count, around) => {
                    this.spawnHorde('jiangshi', count, around);
                },
            });
            enemy.update(deltaTime);
        }
    }

    public applyWeaponHit(runtimeId: string | undefined, position: Vector2, damage: number, effectType: string): boolean {
        let target = runtimeId ? this.active.get(runtimeId) : this.getNearest(position);
        if (!target) return false;

        const result = target.enemy.takeDamage(damage);
        this.eventBus.emit(GameEvents.ENEMY_DAMAGE, {
            runtimeId: target.enemy.runtimeId,
            hp: result.hp,
            effectType,
        });

        if (result.dead) {
            this.handleEnemyDeath(target.enemy);
            this.active.delete(target.enemy.runtimeId);
            target.enemy.despawn();
        }

        return true;
    }

    private handleEnemyDeath(enemy: Enemy): void {
        this.eventBus.emit(GameEvents.ENEMY_DEATH, {
            runtimeId: enemy.runtimeId,
            position: enemy.getPosition(),
            exp: enemy.getExpValue(),
            vfx: 'enemy_death_burst',
        });

        // 与B-03联动：升级经验收益
        upgradeSystem.addExperience(enemy.getExpValue());
    }

    private getNearest(position: Vector2): EnemyWithAI | null {
        let nearest: EnemyWithAI | null = null;
        let minDistance = Number.POSITIVE_INFINITY;
        for (const item of this.active.values()) {
            const enemyPos = item.enemy.getPosition();
            const d = Math.hypot(enemyPos.x - position.x, enemyPos.y - position.y);
            if (d < minDistance) {
                minDistance = d;
                nearest = item;
            }
        }
        return nearest;
    }

    public getActiveEnemies(): Enemy[] {
        return Array.from(this.active.values()).map(item => item.enemy);
    }

    public getPoolStats(): { total: number; active: number; inactive: number } {
        const total = this.pool.length;
        const active = this.active.size;
        return { total, active, inactive: Math.max(0, total - active) };
    }
}

export const enemySystem = EnemySystem.getInstance();
