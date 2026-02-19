/**
 * DungeonGenerator.ts
 * 地下城生成器 - 15x15网格
 * 
 * 核心算法：
 * - 9房间（3x3）
 * - A*验证连通性
 * - 随机打通墙壁
 * 
 * DEBT-B07-002: 地图用预设模板（非真随机）
 */

import { Vector2 } from '../physics/AABB';
import { Random, globalRandom } from '../core/Random';

export enum CellType {
    EMPTY = 0,
    WALL = 1,
    FLOOR = 2,
    DOOR = 3,
    START = 4,
    EXIT = 5,
    BOSS = 6,
    ELITE = 7,
    SHOP = 8,
    SECRET = 9,
}

export interface Room {
    id: number;
    x: number;
    y: number;
    width: number;
    height: number;
    center: Vector2;
    type: 'normal' | 'elite' | 'boss' | 'shop' | 'secret';
    connections: number[];
    cleared: boolean;
}

export interface DungeonMap {
    width: number;
    height: number;
    grid: CellType[][];
    rooms: Room[];
    startRoom: number;
    bossRoom: number;
    exitPosition: Vector2;
}

export class DungeonGenerator {
    private random: Random;
    
    // 配置
    private readonly gridWidth = 15;
    private readonly gridHeight = 15;
    private readonly roomMinSize = 5;
    private readonly roomMaxSize = 7;
    private readonly roomCount = 9;

    constructor(seed?: number) {
        this.random = seed !== undefined ? new Random(seed) : globalRandom;
    }

    /**
     * 生成地下城
     */
    public generate(levelTheme: string = 'qing_feng_guan'): DungeonMap {
        // 初始化网格
        const grid: CellType[][] = Array(this.gridHeight)
            .fill(null)
            .map(() => Array(this.gridWidth).fill(CellType.WALL));

        // 生成房间布局（3x3）
        const rooms = this.generateRooms();

        // 放置房间到网格
        for (const room of rooms) {
            this.carveRoom(grid, room);
        }

        // 连接房间
        this.connectRooms(grid, rooms);

        // 设置特殊房间
        const startRoom = 0;
        const bossRoom = rooms.length - 1;
        rooms[startRoom].type = 'normal';
        rooms[bossRoom].type = 'boss';

        // 标记起始点和出口
        const startCenter = rooms[startRoom].center;
        grid[Math.floor(startCenter.y)][Math.floor(startCenter.x)] = CellType.START;

        const exitCenter = rooms[bossRoom].center;
        grid[Math.floor(exitCenter.y)][Math.floor(exitCenter.x)] = CellType.EXIT;

        // 随机选择精英房间
        const eliteRoomIndex = this.random.rangeInt(1, rooms.length - 1);
        rooms[eliteRoomIndex].type = 'elite';

        // 验证连通性
        const isConnected = this.validateConnectivity(grid, rooms[startRoom], rooms[bossRoom]);
        if (!isConnected) {
            console.warn('[DungeonGenerator] Map not fully connected, regenerating...');
            return this.generate(levelTheme);
        }

        return {
            width: this.gridWidth,
            height: this.gridHeight,
            grid,
            rooms,
            startRoom,
            bossRoom,
            exitPosition: exitCenter,
        };
    }

    /**
     * 生成房间（3x3布局）
     */
    private generateRooms(): Room[] {
        const rooms: Room[] = [];
        const cellWidth = Math.floor(this.gridWidth / 3);
        const cellHeight = Math.floor(this.gridHeight / 3);

        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                const roomWidth = this.random.rangeInt(this.roomMinSize, this.roomMaxSize + 1);
                const roomHeight = this.random.rangeInt(this.roomMinSize, this.roomMaxSize + 1);

                // 在单元格内随机位置
                const maxX = cellWidth - roomWidth;
                const maxY = cellHeight - roomHeight;
                const offsetX = maxX > 0 ? this.random.rangeInt(0, maxX) : 0;
                const offsetY = maxY > 0 ? this.random.rangeInt(0, maxY) : 0;

                const room: Room = {
                    id: rooms.length,
                    x: col * cellWidth + offsetX,
                    y: row * cellHeight + offsetY,
                    width: roomWidth,
                    height: roomHeight,
                    center: { x: 0, y: 0 },
                    type: 'normal',
                    connections: [],
                    cleared: false,
                };

                // 计算中心点
                room.center = {
                    x: room.x + room.width / 2,
                    y: room.y + room.height / 2,
                };

                rooms.push(room);
            }
        }

        return rooms;
    }

    /**
     * 雕刻房间
     */
    private carveRoom(grid: CellType[][], room: Room): void {
        for (let y = room.y; y < room.y + room.height; y++) {
            for (let x = room.x; x < room.x + room.width; x++) {
                if (y >= 0 && y < this.gridHeight && x >= 0 && x < this.gridWidth) {
                    grid[y][x] = CellType.FLOOR;
                }
            }
        }
    }

    /**
     * 连接房间
     */
    private connectRooms(grid: CellType[][], rooms: Room[]): void {
        // 连接相邻房间
        for (let i = 0; i < rooms.length; i++) {
            const room = rooms[i];

            // 检查右侧房间
            if (i % 3 < 2) {
                const rightRoom = rooms[i + 1];
                this.createCorridor(grid, room, rightRoom);
                room.connections.push(rightRoom.id);
                rightRoom.connections.push(room.id);
            }

            // 检查下方房间
            if (i < 6) {
                const bottomRoom = rooms[i + 3];
                this.createCorridor(grid, room, bottomRoom);
                room.connections.push(bottomRoom.id);
                bottomRoom.connections.push(room.id);
            }
        }

        // 随机打通额外墙壁
        this.createExtraConnections(grid, rooms);
    }

    /**
     * 创建走廊
     */
    private createCorridor(grid: CellType[][], roomA: Room, roomB: Room): void {
        const startX = Math.floor(roomA.center.x);
        const startY = Math.floor(roomA.center.y);
        const endX = Math.floor(roomB.center.x);
        const endY = Math.floor(roomB.center.y);

        // L形走廊
        if (this.random.bool()) {
            // 先水平后垂直
            this.carveHorizontalCorridor(grid, startX, endX, startY);
            this.carveVerticalCorridor(grid, startY, endY, endX);
        } else {
            // 先垂直后水平
            this.carveVerticalCorridor(grid, startY, endY, startX);
            this.carveHorizontalCorridor(grid, startX, endX, endY);
        }
    }

    /**
     * 雕刻水平走廊
     */
    private carveHorizontalCorridor(grid: CellType[][], x1: number, x2: number, y: number): void {
        const minX = Math.min(x1, x2);
        const maxX = Math.max(x1, x2);

        for (let x = minX; x <= maxX; x++) {
            if (y >= 0 && y < this.gridHeight && x >= 0 && x < this.gridWidth) {
                grid[y][x] = CellType.FLOOR;
            }
        }
    }

    /**
     * 雕刻垂直走廊
     */
    private carveVerticalCorridor(grid: CellType[][], y1: number, y2: number, x: number): void {
        const minY = Math.min(y1, y2);
        const maxY = Math.max(y1, y2);

        for (let y = minY; y <= maxY; y++) {
            if (y >= 0 && y < this.gridHeight && x >= 0 && x < this.gridWidth) {
                grid[y][x] = CellType.FLOOR;
            }
        }
    }

    /**
     * 创建额外连接
     */
    private createExtraConnections(grid: CellType[][], rooms: Room[]): void {
        // 随机打通一些墙壁
        const extraConnectionCount = this.random.rangeInt(2, 5);

        for (let i = 0; i < extraConnectionCount; i++) {
            const roomA = rooms[this.random.rangeInt(0, rooms.length)];
            const roomB = rooms[this.random.rangeInt(0, rooms.length)];

            if (roomA.id !== roomB.id && !roomA.connections.includes(roomB.id)) {
                this.createCorridor(grid, roomA, roomB);
                roomA.connections.push(roomB.id);
                roomB.connections.push(roomA.id);
            }
        }
    }

    /**
     * 验证连通性（简化版BFS）
     */
    private validateConnectivity(grid: CellType[][], start: Room, end: Room): boolean {
        const startX = Math.floor(start.center.x);
        const startY = Math.floor(start.center.y);
        const endX = Math.floor(end.center.x);
        const endY = Math.floor(end.center.y);

        const visited: boolean[][] = Array(this.gridHeight)
            .fill(null)
            .map(() => Array(this.gridWidth).fill(false));

        const queue: { x: number; y: number }[] = [{ x: startX, y: startY }];
        visited[startY][startX] = true;

        const directions = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }];

        while (queue.length > 0) {
            const current = queue.shift()!;

            if (current.x === endX && current.y === endY) {
                return true;
            }

            for (const dir of directions) {
                const nextX = current.x + dir.x;
                const nextY = current.y + dir.y;

                if (
                    nextX >= 0 &&
                    nextX < this.gridWidth &&
                    nextY >= 0 &&
                    nextY < this.gridHeight &&
                    !visited[nextY][nextX] &&
                    grid[nextY][nextX] !== CellType.WALL
                ) {
                    visited[nextY][nextX] = true;
                    queue.push({ x: nextX, y: nextY });
                }
            }
        }

        return false;
    }

    /**
     * 获取地图字符串表示
     */
    public getMapString(dungeon: DungeonMap): string {
        const chars: Record<CellType, string> = {
            [CellType.EMPTY]: ' ',
            [CellType.WALL]: '#',
            [CellType.FLOOR]: '.',
            [CellType.DOOR]: '+',
            [CellType.START]: 'S',
            [CellType.EXIT]: 'E',
            [CellType.BOSS]: 'B',
            [CellType.ELITE]: '!',
            [CellType.SHOP]: '$',
            [CellType.SECRET]: '?',
        };

        return dungeon.grid.map(row => row.map(cell => chars[cell]).join('')).join('\n');
    }
}

// 便捷导出
export const dungeonGenerator = new DungeonGenerator();
