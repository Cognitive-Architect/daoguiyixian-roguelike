/**
 * CollisionLayers.ts
 * B-06 碰撞层定义（数据驱动配置使用）
 */

export enum CollisionLayer {
    NONE = 0,
    PLAYER = 1 << 0,
    ENEMY = 1 << 1,
    WEAPON = 1 << 2,
    OBSTACLE = 1 << 3,
    ITEM = 1 << 4,
}

export const CollisionMasks = {
    PLAYER: CollisionLayer.ENEMY | CollisionLayer.OBSTACLE | CollisionLayer.ITEM,
    ENEMY: CollisionLayer.PLAYER | CollisionLayer.WEAPON | CollisionLayer.ENEMY | CollisionLayer.OBSTACLE,
    WEAPON: CollisionLayer.ENEMY | CollisionLayer.OBSTACLE,
    OBSTACLE: CollisionLayer.PLAYER | CollisionLayer.ENEMY | CollisionLayer.WEAPON,
    ITEM: CollisionLayer.PLAYER,
};
