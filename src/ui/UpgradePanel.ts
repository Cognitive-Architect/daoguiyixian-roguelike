/**
 * UpgradePanel.ts
 * 升级选择界面 - 竖屏三选一
 * 
 * 核心要求：
 * - 竖屏底部弹出，三卡片280x400px
 * - 小屏自动纵向排列
 * - 升级期间游戏暂停
 * 
 * DEBT-B04-001: UI动画用FadeIn（无Card Fly-in）
 */

import { EventBus, GameEvents } from '../core/EventBus';
import { UpgradeData, UpgradeRarity, upgradeManager } from '../upgrade/UpgradeManager';

export interface UpgradeCardData {
    upgrade: UpgradeData;
    index: number;
}

export class UpgradePanel {
    private static instance: UpgradePanel;
    private eventBus: EventBus;
    
    // UI状态
    private isVisible: boolean = false;
    private currentOptions: UpgradeData[] = [];
    private selectedIndex: number = -1;
    private onSelectCallback: ((upgradeId: string) => void) | null = null;
    
    // 样式配置
    private readonly cardWidth = 280;
    private readonly cardHeight = 400;
    private readonly cardGap = 20;
    private readonly colors = {
        common: { bg: '#3a3a3a', border: '#888888', text: '#ffffff' },
        rare: { bg: '#2a3a5a', border: '#4488ff', text: '#ffffff' },
        epic: { bg: '#4a2a4a', border: '#ff44ff', text: '#ffffff' },
    };

    private constructor() {
        this.eventBus = EventBus.getInstance();
        this.setupEventListeners();
    }

    public static getInstance(): UpgradePanel {
        if (!UpgradePanel.instance) {
            UpgradePanel.instance = new UpgradePanel();
        }
        return UpgradePanel.instance;
    }

    private setupEventListeners(): void {
        this.eventBus.on(GameEvents.UI_SHOW_UPGRADE, (data: { options: UpgradeData[] }) => {
            this.show(data.options);
        });
    }

    /**
     * 显示升级选择面板
     */
    public show(options: UpgradeData[]): void {
        if (this.isVisible) return;
        
        this.currentOptions = options;
        this.selectedIndex = -1;
        this.isVisible = true;
        
        console.log(`[UpgradePanel] Showing ${options.length} upgrade options`);
        
        // 发送显示事件
        this.eventBus.emit('ui:upgrade_panel:show', { options });
    }

    /**
     * 隐藏面板
     */
    public hide(): void {
        if (!this.isVisible) return;
        
        this.isVisible = false;
        this.currentOptions = [];
        this.selectedIndex = -1;
        
        this.eventBus.emit('ui:upgrade_panel:hide');
    }

    /**
     * 选择升级
     */
    public select(index: number): void {
        if (index < 0 || index >= this.currentOptions.length) return;
        if (this.selectedIndex !== -1) return; // 已选择
        
        this.selectedIndex = index;
        const upgrade = this.currentOptions[index];
        
        console.log(`[UpgradePanel] Selected upgrade: ${upgrade.name}`);
        
        // 应用升级
        upgradeManager.selectUpgrade(upgrade.id);
        
        // 延迟隐藏
        setTimeout(() => {
            this.hide();
        }, 300);
    }

    /**
     * 获取稀有度颜色
     */
    public getRarityColor(rarity: UpgradeRarity): typeof this.colors.common {
        return this.colors[rarity];
    }

    /**
     * 获取稀有度显示名称
     */
    public getRarityDisplayName(rarity: UpgradeRarity): string {
        switch (rarity) {
            case 'common': return '普通';
            case 'rare': return '稀有';
            case 'epic': return '史诗';
            default: return '普通';
        }
    }

    /**
     * 获取卡片布局
     */
    public getCardLayout(screenWidth: number, screenHeight: number): {
        cards: { x: number; y: number; width: number; height: number }[];
        isVertical: boolean;
    } {
        const cards: { x: number; y: number; width: number; height: number }[] = [];
        
        // 判断是否需要纵向排列（小屏）
        const isVertical = screenWidth < 400;
        
        if (isVertical) {
            // 纵向排列
            const cardWidth = screenWidth - 40;
            const cardHeight = 120;
            const startY = screenHeight - (this.currentOptions.length * (cardHeight + 10) + 20);
            
            for (let i = 0; i < this.currentOptions.length; i++) {
                cards.push({
                    x: 20,
                    y: startY + i * (cardHeight + 10),
                    width: cardWidth,
                    height: cardHeight,
                });
            }
        } else {
            // 横向排列
            const totalWidth = this.currentOptions.length * this.cardWidth + 
                              (this.currentOptions.length - 1) * this.cardGap;
            const startX = (screenWidth - totalWidth) / 2;
            const startY = screenHeight - this.cardHeight - 100;
            
            for (let i = 0; i < this.currentOptions.length; i++) {
                cards.push({
                    x: startX + i * (this.cardWidth + this.cardGap),
                    y: startY,
                    width: this.cardWidth,
                    height: this.cardHeight,
                });
            }
        }
        
        return { cards, isVertical };
    }

    /**
     * 渲染卡片（用于Canvas渲染）
     */
    public renderCard(
        ctx: CanvasRenderingContext2D,
        upgrade: UpgradeData,
        x: number,
        y: number,
        width: number,
        height: number,
        isSelected: boolean = false,
        isHovered: boolean = false
    ): void {
        const colors = this.getRarityColor(upgrade.rarity);
        
        // 背景
        ctx.fillStyle = colors.bg;
        ctx.fillRect(x, y, width, height);
        
        // 边框
        ctx.strokeStyle = isSelected ? '#ffff00' : isHovered ? '#ffffff' : colors.border;
        ctx.lineWidth = isSelected ? 4 : 2;
        ctx.strokeRect(x, y, width, height);
        
        // 稀有度标签
        ctx.fillStyle = colors.border;
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(this.getRarityDisplayName(upgrade.rarity), x + 10, y + 20);
        
        // 名称
        ctx.fillStyle = colors.text;
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(upgrade.name, x + width / 2, y + 50);
        
        // 描述
        ctx.fillStyle = '#cccccc';
        ctx.font = '14px sans-serif';
        this.wrapText(ctx, upgrade.description, x + width / 2, y + 80, width - 20, 20);
        
        // 层数
        const stacks = upgradeManager.getUpgradeStacks(upgrade.id);
        if (stacks > 0) {
            ctx.fillStyle = '#ffff00';
            ctx.font = '12px sans-serif';
            ctx.fillText(`已拥有: ${stacks}/${upgrade.maxStacks}`, x + width / 2, y + height - 20);
        }
    }

    /**
     * 文本换行
     */
    private wrapText(
        ctx: CanvasRenderingContext2D,
        text: string,
        x: number,
        y: number,
        maxWidth: number,
        lineHeight: number
    ): void {
        const words = text.split('');
        let line = '';
        let currentY = y;
        
        for (let i = 0; i < words.length; i++) {
            const testLine = line + words[i];
            const metrics = ctx.measureText(testLine);
            
            if (metrics.width > maxWidth && i > 0) {
                ctx.fillText(line, x, currentY);
                line = words[i];
                currentY += lineHeight;
            } else {
                line = testLine;
            }
        }
        
        ctx.fillText(line, x, currentY);
    }

    // ============ Getters ============

    public isShowing(): boolean {
        return this.isVisible;
    }

    public getCurrentOptions(): UpgradeData[] {
        return [...this.currentOptions];
    }

    public getSelectedIndex(): number {
        return this.selectedIndex;
    }

    /**
     * 获取卡片尺寸
     */
    public getCardSize(): { width: number; height: number } {
        return { width: this.cardWidth, height: this.cardHeight };
    }
}

// 便捷导出单例
export const upgradePanel = UpgradePanel.getInstance();
