/**
 * EnemyAI.ts
 * B-04 简化行为树（追踪/突进/BOSS阶段召唤）
 *
 * DEBT-ENEMY-001: 高级躲避与团队协作AI待v0.5.0
 */

import { Vector2 } from '../physics/AABB';
import { Enemy } from './Enemy';

export interface EnemyAIUpdateContext {
    deltaTime: number;
    playerPosition: Vector2;
    spawnMinion: (count: number, around: Vector2) => void;
}

export class EnemyAI {
    private readonly enemy: Enemy;

    private dashCooldown = 0;
    private phaseTriggered = new Set<number>();

    constructor(enemy: Enemy) {
        this.enemy = enemy;
    }

    public update(context: EnemyAIUpdateContext): void {
        const { deltaTime, playerPosition, spawnMinion } = context;
        const config = this.enemy.getConfig();
        const position = this.enemy.getPosition();

        const dx = playerPosition.x - position.x;
        const dy = playerPosition.y - position.y;
        const distance = Math.hypot(dx, dy);
        const dir = distance > 0 ? { x: dx / distance, y: dy / distance } : { x: 0, y: 0 };

        if (config.ai === 'chase_melee') {
            this.enemy.setVelocity({ x: dir.x * config.speed, y: dir.y * config.speed });
            return;
        }

        if (config.ai === 'dash_hit_run') {
            this.dashCooldown = Math.max(0, this.dashCooldown - deltaTime);
            if (this.dashCooldown <= 0 && distance < 260) {
                this.enemy.setVelocity({ x: dir.x * config.speed * 2.4, y: dir.y * config.speed * 2.4 });
                this.enemy.applyDashInvincible(0.25);
                const backStep = { x: position.x - dir.x * 60, y: position.y - dir.y * 60 };
                this.enemy.setPosition(backStep);
                this.dashCooldown = 1.2;
            } else {
                this.enemy.setVelocity({ x: dir.x * config.speed, y: dir.y * config.speed });
            }
            return;
        }

        if (config.ai === 'boss_phases') {
            this.enemy.setVelocity({ x: dir.x * config.speed, y: dir.y * config.speed });

            const hpRatio = this.enemy.getHpRatio();
            const phaseThresholds: Array<{ threshold: number; summon: number }> = [
                { threshold: 0.7, summon: 5 },
                { threshold: 0.4, summon: 8 },
                { threshold: 0.1, summon: 12 },
            ];

            for (let i = 0; i < phaseThresholds.length; i++) {
                const phaseIndex = i + 1;
                const phase = phaseThresholds[i];
                if (hpRatio <= phase.threshold && !this.phaseTriggered.has(phaseIndex)) {
                    this.phaseTriggered.add(phaseIndex);
                    spawnMinion(phase.summon, position);
                }
            }
        }
    }

    public getTriggeredPhaseCount(): number {
        return this.phaseTriggered.size;
    }
}
