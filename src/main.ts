/**
 * main.ts
 * 游戏入口文件
 */

import { gameManager } from './core/GameManager';
import { inputManager } from './input/InputManager';
import { playerController } from './player/PlayerController';
import { sanitySystem } from './sanity/SanitySystem';
import { sanityFilter } from './postprocess/SanityFilter';
import { upgradeManager } from './upgrade/UpgradeManager';
import { enemyManager } from './enemy/EnemyManager';
import { weaponSystem } from './weapon/WeaponSystem';
import { levelManager } from './level/LevelManager';
import { extractionZone } from './extraction/ExtractionZone';
import { hud } from './ui/HUD';
import { joystickUI } from './ui/JoystickUI';
import { skillPanel } from './ui/SkillPanel';
import { EventBus, GameEvents } from './core/EventBus';

// 游戏配置
const GAME_CONFIG = {
    targetFPS: 60,
    fixedTimeStep: 1 / 60,
    maxEntities: 100,
    enableDebug: false,
};

// 画布
let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;

// 游戏循环
let lastTime = 0;
let accumulator = 0;

/**
 * 初始化游戏
 */
async function init(): Promise<void> {
    console.log('[Main] Initializing game...');
    
    // 初始化画布
    initCanvas();
    
    // 初始化系统
    initSystems();
    
    // 加载配置
    await loadConfigs();
    
    // 初始化UI
    initUI();
    
    // 加载第一关
    levelManager.loadLevel(0);
    
    // 开始游戏
    gameManager.startGame();
    
    // 隐藏加载界面
    const loading = document.getElementById('loading');
    if (loading) {
        loading.classList.add('hidden');
    }
    
    // 启动游戏循环
    requestAnimationFrame(gameLoop);
    
    console.log('[Main] Game initialized');
}

/**
 * 初始化画布
 */
function initCanvas(): void {
    canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    ctx = canvas.getContext('2d')!;
    
    // 设置画布尺寸
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
}

/**
 * 调整画布尺寸
 */
function resizeCanvas(): void {
    const container = document.getElementById('game-container')!;
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    canvas.width = width;
    canvas.height = height;
    
    // 更新UI系统
    hud.initialize(width, height);
    joystickUI.initialize(width, height);
    skillPanel.initialize(width, height);
}

/**
 * 初始化系统
 */
function initSystems(): void {
    // 游戏管理器
    gameManager.initialize(GAME_CONFIG);
    
    // 输入管理器
    inputManager.initialize();
    
    // 玩家控制器
    playerController.reset();
    
    // SAN系统
    sanitySystem.initialize(100);
    sanityFilter.initialize();
    
    // 升级系统
    upgradeManager.initialize();
    
    // 敌人管理器
    enemyManager.initialize();
    
    // 武器系统
    // 武器配置在loadConfigs中加载
    
    // 关卡管理器
    levelManager.initialize();
}

/**
 * 加载配置
 */
async function loadConfigs(): Promise<void> {
    try {
        // 加载升级配置
        await upgradeManager.loadConfigsFromJson('/assets/configs/upgrades.json');
        
        // 加载敌人配置
        await enemyManager.loadConfigsFromJson('/assets/configs/enemies.json');
        
        // 加载武器配置
        await weaponSystem.loadConfigsFromJson('/assets/configs/weapons.json');
        
        console.log('[Main] All configs loaded');
    } catch (error) {
        console.error('[Main] Failed to load configs:', error);
    }
}

/**
 * 初始化UI
 */
function initUI(): void {
    // 装备初始武器
    weaponSystem.equipWeapon('copper_sword', 0);
}

/**
 * 游戏循环
 */
function gameLoop(timestamp: number): void {
    // 计算时间差
    if (lastTime === 0) {
        lastTime = timestamp;
    }
    const deltaTime = Math.min((timestamp - lastTime) / 1000, 0.1); // 限制最大时间步长
    lastTime = timestamp;
    
    // 更新
    update(deltaTime);
    
    // 渲染
    render();
    
    // 下一帧
    requestAnimationFrame(gameLoop);
}

/**
 * 更新
 */
function update(deltaTime: number): void {
    // 游戏管理器
    gameManager.update(deltaTime);
    
    // 输入管理器
    inputManager.update();
    
    // 玩家控制器
    playerController.update(deltaTime);
    
    // SAN系统
    sanitySystem.update(deltaTime);
    sanityFilter.update(deltaTime);
    
    // 升级系统
    upgradeManager.update(deltaTime);
    
    // 敌人管理器
    enemyManager.update(deltaTime, playerController.getPosition());
    
    // 武器系统
    weaponSystem.update(deltaTime);
    
    // 关卡管理器
    levelManager.update(deltaTime);
    
    // 撤离区域
    extractionZone.update(deltaTime, gameManager.getGameTime());
    
    // UI
    hud.update(deltaTime);
    joystickUI.update();
    skillPanel.update(deltaTime);
    
    // 更新玩家位置到关卡管理器
    levelManager.setPlayerPosition(playerController.getPosition());
}

/**
 * 渲染
 */
function render(): void {
    // 清空画布
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 获取摄像机位置
    const cameraPos = levelManager.getCameraPosition();
    
    // 保存上下文
    ctx.save();
    
    // 应用摄像机变换
    ctx.translate(
        canvas.width / 2 - cameraPos.x,
        canvas.height / 2 - cameraPos.y
    );
    
    // 渲染地图
    renderMap();
    
    // 渲染敌人
    renderEnemies();
    
    // 渲染玩家
    renderPlayer();
    
    // 恢复上下文
    ctx.restore();
    
    // 渲染UI
    hud.render(ctx);
    joystickUI.render(ctx);
    skillPanel.render(ctx);
}

/**
 * 渲染地图
 */
function renderMap(): void {
    const dungeon = levelManager.getCurrentDungeon();
    if (!dungeon) return;
    
    const cellSize = 32;
    
    for (let y = 0; y < dungeon.height; y++) {
        for (let x = 0; x < dungeon.width; x++) {
            const cell = dungeon.grid[y][x];
            const px = x * cellSize;
            const py = y * cellSize;
            
            switch (cell) {
                case 1: // WALL
                    ctx.fillStyle = '#4a4a6a';
                    ctx.fillRect(px, py, cellSize, cellSize);
                    break;
                case 2: // FLOOR
                    ctx.fillStyle = '#2a2a4a';
                    ctx.fillRect(px, py, cellSize, cellSize);
                    break;
                case 4: // START
                    ctx.fillStyle = '#00ff00';
                    ctx.fillRect(px, py, cellSize, cellSize);
                    break;
                case 5: // EXIT
                    ctx.fillStyle = '#ff0000';
                    ctx.fillRect(px, py, cellSize, cellSize);
                    break;
            }
        }
    }
}

/**
 * 渲染敌人
 */
function renderEnemies(): void {
    const enemies = enemyManager.getActiveEnemies();
    
    for (const enemy of enemies) {
        if (!enemy.ai) continue;
        
        const pos = enemy.ai.getPosition();
        const config = enemy.ai.getConfig();
        
        // 渲染敌人
        ctx.fillStyle = config.category === 'boss' ? '#ff0000' : 
                        config.category === 'elite' ? '#ff8800' : '#ffaaaa';
        ctx.fillRect(pos.x - 16, pos.y - 16, 32, 32);
        
        // 渲染血条
        const context = enemy.ai.getContext();
        const hpPercent = context.hp / context.maxHp;
        ctx.fillStyle = '#333';
        ctx.fillRect(pos.x - 16, pos.y - 24, 32, 4);
        ctx.fillStyle = hpPercent > 0.5 ? '#0f0' : '#f00';
        ctx.fillRect(pos.x - 16, pos.y - 24, 32 * hpPercent, 4);
    }
}

/**
 * 渲染玩家
 */
function renderPlayer(): void {
    const pos = playerController.getPosition();
    const stats = playerController.getStats();
    
    // 渲染玩家
    ctx.fillStyle = '#00ffff';
    ctx.fillRect(pos.x - 16, pos.y - 16, 32, 32);
    
    // 渲染血条
    hud.renderPlayerHealthBar(ctx, pos.x, pos.y, stats.hp, stats.maxHp);
}

// 启动游戏
init().catch(console.error);
