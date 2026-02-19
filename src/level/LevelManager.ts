/**
 * LevelManager.ts
 * 关卡管理器 - 核心循环
 * 
 * 核心功能：
 * - 关卡生成
 * - 房间切换
 * - 摄像机平滑
 * 
 * DEBT-B07-001: 暂时2个关卡（非6个）
 */

import { EventBus, GameEvents } from '../core/EventBus';
import { Vector2 } from '../physics/AABB';
import { DungeonGenerator, DungeonMap, Room, CellType } from './DungeonGenerator';
import { extractionZone, ExtractionType } from '../extraction/ExtractionZone';
import { gameManager } from '../core/GameManager';

export interface LevelTheme {
    id: string;
    name: string;
    description: string;
    bossId: string;
    backgroundColor: string;
    wallColor: string;
    floorColor: string;
}

export const LEVEL_THEMES: LevelTheme[] = [
    {
        id: 'qing_feng_guan',
        name: '清风观',
        description: '道心初蒙',
        bossId: 'dan_yang_human',
        backgroundColor: '#1a1a2e',
        wallColor: '#4a4a6a',
        floorColor: '#2a2a4a',
    },
    {
        id: 'bai_jia_da_yuan',
        name: '白家大院',
        description: '喜丧迷局',
        bossId: 'xi_shen',
        backgroundColor: '#2e1a1a',
        wallColor: '#6a4a4a',
        floorColor: '#4a2a2a',
    },
    {
        id: 'an_ci_an',
        name: '安慈庵',
        description: '迷雾救赎',
        bossId: 'jing_xin_nun',
        backgroundColor: '#1a2e1a',
        wallColor: '#4a6a4a',
        floorColor: '#2a4a2a',
    },
    {
        id: 'ao_jing_jiao',
        name: '袄景教',
        description: '痛苦圣殿',
        bossId: 'ba_hui_projection',
        backgroundColor: '#2e1a2e',
        wallColor: '#6a4a6a',
        floorColor: '#4a2a4a',
    },
    {
        id: 'da_liang_huang_cheng',
        name: '大梁皇城',
        description: '龙脉权谋',
        bossId: 'emperor_dragon_qi',
        backgroundColor: '#2e2e1a',
        wallColor: '#6a6a4a',
        floorColor: '#4a4a2a',
    },
    {
        id: 'bai_yu_jing',
        name: '白玉京',
        description: '不可名状',
        bossId: 'ji_zai_projection',
        backgroundColor: '#0a0a0a',
        wallColor: '#3a3a3a',
        floorColor: '#1a1a1a',
    },
];

export enum LevelState {
    NONE = 'none',
    LOADING = 'loading',
    PLAYING = 'playing',
    PAUSED = 'paused',
    COMPLETED = 'completed',
    FAILED = 'failed',
}

export class LevelManager {
    private static instance: LevelManager;
    private eventBus: EventBus;
    private dungeonGenerator: DungeonGenerator;
    
    // 当前关卡
    private currentLevel: number = 0;
    private currentTheme: LevelTheme | null = null;
    private currentDungeon: DungeonMap | null = null;
    private currentRoom: number = 0;
    
    // 状态
    private state: LevelState = LevelState.NONE;
    
    // 玩家位置
    private playerPosition: Vector2 = { x: 0, y: 0 };
    
    // 摄像机
    private cameraPosition: Vector2 = { x: 0, y: 0 };
    private cameraSmoothSpeed: number = 5;

    private constructor() {
        this.eventBus = EventBus.getInstance();
        this.dungeonGenerator = new DungeonGenerator();
    }

    public static getInstance(): LevelManager {
        if (!LevelManager.instance) {
            LevelManager.instance = new LevelManager();
        }
        return LevelManager.instance;
    }

    /**
     * 初始化
     */
    public initialize(): void {
        this.currentLevel = 0;
        this.currentTheme = null;
        this.currentDungeon = null;
        this.currentRoom = 0;
        this.state = LevelState.NONE;
    }

    /**
     * 加载关卡
     */
    public loadLevel(levelIndex: number): boolean {
        if (levelIndex < 0 || levelIndex >= LEVEL_THEMES.length) {
            console.error(`[LevelManager] Invalid level index: ${levelIndex}`);
            return false;
        }

        this.state = LevelState.LOADING;
        this.currentLevel = levelIndex;
        this.currentTheme = LEVEL_THEMES[levelIndex];
        
        // 生成地下城
        this.currentDungeon = this.dungeonGenerator.generate(this.currentTheme.id);
        this.currentRoom = this.currentDungeon.startRoom;
        
        // 设置玩家起始位置
        const startRoom = this.currentDungeon.rooms[this.currentDungeon.startRoom];
        this.playerPosition = { ...startRoom.center };
        this.cameraPosition = { ...startRoom.center };
        
        // 初始化撤离系统
        extractionZone.initialize();
        
        this.state = LevelState.PLAYING;
        
        console.log(`[LevelManager] Loaded level ${levelIndex}: ${this.currentTheme.name}`);
        
        this.eventBus.emit(GameEvents.LEVEL_START, {
            level: levelIndex,
            theme: this.currentTheme,
            dungeon: this.currentDungeon,
        });

        return true;
    }

    /**
     * 更新
     */
    public update(deltaTime: number): void {
        if (this.state !== LevelState.PLAYING) return;

        // 更新摄像机
        this.updateCamera(deltaTime);
        
        // 更新撤离系统
        const gameTime = gameManager.getGameTime();
        extractionZone.update(deltaTime, gameTime);
        
        // 检查房间切换
        this.checkRoomTransition();
    }

    /**
     * 更新摄像机
     */
    private updateCamera(deltaTime: number): void {
        // 平滑跟随玩家
        const dx = this.playerPosition.x - this.cameraPosition.x;
        const dy = this.playerPosition.y - this.cameraPosition.y;
        
        this.cameraPosition.x += dx * this.cameraSmoothSpeed * deltaTime;
        this.cameraPosition.y += dy * this.cameraSmoothSpeed * deltaTime;
    }

    /**
     * 检查房间切换
     */
    private checkRoomTransition(): void {
        if (!this.currentDungeon) return;

        // 找到玩家当前所在的房间
        for (let i = 0; i < this.currentDungeon.rooms.length; i++) {
            const room = this.currentDungeon.rooms[i];
            
            if (
                this.playerPosition.x >= room.x &&
                this.playerPosition.x < room.x + room.width &&
                this.playerPosition.y >= room.y &&
                this.playerPosition.y < room.y + room.height
            ) {
                if (this.currentRoom !== i) {
                    this.currentRoom = i;
                    this.onRoomEnter(i);
                }
                break;
            }
        }
    }

    /**
     * 进入房间
     */
    private onRoomEnter(roomIndex: number): void {
        if (!this.currentDungeon) return;

        const room = this.currentDungeon.rooms[roomIndex];
        console.log(`[LevelManager] Entered room ${roomIndex} (${room.type})`);
        
        this.eventBus.emit('level:room_enter', {
            roomIndex,
            room,
        });

        // 根据房间类型触发事件
        switch (room.type) {
            case 'boss':
                this.eventBus.emit('level:boss_room');
                break;
            case 'elite':
                this.eventBus.emit('level:elite_room');
                break;
            case 'shop':
                this.eventBus.emit('level:shop_room');
                break;
        }
    }

    /**
     * 设置玩家位置
     */
    public setPlayerPosition(position: Vector2): void {
        this.playerPosition = { ...position };
    }

    /**
     * 完成关卡
     */
    public completeLevel(): void {
        this.state = LevelState.COMPLETED;
        
        this.eventBus.emit(GameEvents.LEVEL_COMPLETE, {
            level: this.currentLevel,
        });

        // 加载下一关
        if (this.currentLevel < LEVEL_THEMES.length - 1) {
            setTimeout(() => {
                this.loadLevel(this.currentLevel + 1);
            }, 2000);
        } else {
            // 游戏通关
            gameManager.gameOver(true);
        }
    }

    /**
     * 关卡失败
     */
    public failLevel(): void {
        this.state = LevelState.FAILED;
        
        this.eventBus.emit('level:failed', {
            level: this.currentLevel,
        });
    }

    /**
     * 获取当前房间
     */
    public getCurrentRoom(): Room | null {
        if (!this.currentDungeon) return null;
        return this.currentDungeon.rooms[this.currentRoom];
    }

    /**
     * 获取房间世界坐标
     */
    public getRoomWorldPosition(roomIndex: number): Vector2 | null {
        if (!this.currentDungeon) return null;
        const room = this.currentDungeon.rooms[roomIndex];
        return { x: room.x * 32, y: room.y * 32 };
    }

    /**
     * 检查坐标是否在地图内
     */
    public isInBounds(x: number, y: number): boolean {
        if (!this.currentDungeon) return false;
        
        const gridX = Math.floor(x / 32);
        const gridY = Math.floor(y / 32);
        
        if (
            gridY < 0 ||
            gridY >= this.currentDungeon.height ||
            gridX < 0 ||
            gridX >= this.currentDungeon.width
        ) {
            return false;
        }
        
        return this.currentDungeon.grid[gridY][gridX] !== CellType.WALL;
    }

    // ============ Getters ============

    public getCurrentLevel(): number {
        return this.currentLevel;
    }

    public getCurrentTheme(): LevelTheme | null {
        return this.currentTheme;
    }

    public getCurrentDungeon(): DungeonMap | null {
        return this.currentDungeon;
    }

    public getState(): LevelState {
        return this.state;
    }

    public getPlayerPosition(): Vector2 {
        return { ...this.playerPosition };
    }

    public getCameraPosition(): Vector2 {
        return { ...this.cameraPosition };
    }

    public isPlaying(): boolean {
        return this.state === LevelState.PLAYING;
    }

    /**
     * 获取关卡总数
     */
    public static getLevelCount(): number {
        return LEVEL_THEMES.length;
    }

    /**
     * 获取关卡主题
     */
    public static getTheme(levelIndex: number): LevelTheme | null {
        if (levelIndex < 0 || levelIndex >= LEVEL_THEMES.length) {
            return null;
        }
        return LEVEL_THEMES[levelIndex];
    }
}

// 便捷导出单例
export const levelManager = LevelManager.getInstance();
