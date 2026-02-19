# 《道诡异仙》Roguelike 游戏白皮书 v1.0

**项目代号**: HAJIMI-DAO-GAME-001  
**版本**: v1.0.0  
**日期**: 2026-02-19  
**状态**: 完整版

---

## 1. 项目概述

### 1.1 项目简介

《道诡异仙》Roguelike是一款基于同名小说改编的竖屏动作Roguelike游戏，融合了国风克苏鲁美学、独特的SAN值系统和快节奏的战斗体验。

### 1.2 核心特色

- **SAN值系统**: 六档理智状态，疯狂即力量
- **坐忘道AI**: 伪装、欺骗、背刺的独特敌人
- **武器进化**: 12种武器，多种进化路线
- **撤离机制**: 风险与收益的博弈
- **竖屏操作**: 单手即可畅玩

### 1.3 技术栈

- **引擎**: 原生TypeScript + Canvas API
- **构建**: Vite
- **测试**: Jest
- **部署**: GitHub Pages / 微信小游戏

---

## 2. 系统架构

### 2.1 核心系统

```
src/
├── core/           # 游戏核心
│   ├── GameManager.ts      # 游戏状态机
│   ├── EventBus.ts         # 事件总线 (Pub-Sub)
│   ├── PoolManager.ts      # 对象池
│   └── Random.ts           # 确定性随机
├── input/          # 输入系统
│   └── InputManager.ts     # 虚拟摇杆 + 键盘
├── player/         # 玩家系统
│   └── PlayerController.ts # 移动 + 动画状态机
├── enemy/          # 敌人系统
│   ├── EnemyAI.ts          # 行为树
│   └── EnemyManager.ts     # 生成器 + 对象池
├── weapon/         # 武器系统
│   ├── WeaponBase.ts       # 武器基类
│   └── WeaponSystem.ts     # 武器管理
├── sanity/         # SAN系统
│   └── SanitySystem.ts     # 六档状态机
├── postprocess/    # 后处理
│   └── SanityFilter.ts     # 视觉滤镜
├── upgrade/        # 升级系统
│   └── UpgradeManager.ts   # 三选一 + 加权随机
├── level/          # 关卡系统
│   ├── LevelManager.ts     # 关卡管理
│   └── DungeonGenerator.ts # 地下城生成
├── extraction/     # 撤离系统
│   └── ExtractionZone.ts   # 撤离机制
└── ui/             # UI系统
    ├── HUD.ts              # 血条/SAN条/铜钱
    ├── JoystickUI.ts       # 虚拟摇杆
    └── SkillPanel.ts       # 技能栏
```

### 2.2 设计模式

| 模式 | 应用 | 说明 |
|-----|------|-----|
| 单例模式 | GameManager, EventBus | 全局唯一实例 |
| 对象池模式 | PoolManager, EnemyManager | 避免GC卡顿 |
| 发布-订阅 | EventBus | 模块解耦 |
| 状态机 | PlayerController, SanitySystem | 状态管理 |
| 策略模式 | WeaponBase | 不同武器算法 |

---

## 3. 核心机制

### 3.1 SAN值系统

| 档位 | SAN范围 | 伤害修正 | 移速修正 | 特殊效果 |
|-----|--------|---------|---------|---------|
| NORMAL | 80-100 | 100% | 100% | 无 |
| HAZY | 60-79 | 105% | 95% | 偶尔幻觉 |
| CHAOTIC | 40-59 | 110% | 90% | 敌人隐身 |
| MAD | 20-39 | 120% | 80% | 屏幕扭曲 |
| BREAKDOWN | 1-19 | 130% | 70% | 方向反转 |
| ZERO | 0 | 130% | 70% | 每秒掉血1% |

### 3.2 伤害公式

```
最终伤害 = 基础伤害 × (1 + 等级×0.1) × 随机(0.9-1.1) × 暴击 × SAN修正
```

### 3.3 撤离机制

| 类型 | 触发时间 | 铜钱保留 | 经验加成 |
|-----|---------|---------|---------|
| 提前撤离 | 5分钟 | 80% | 0% |
| 正常撤离 | 10分钟 | 100% | 20% |
| 完美撤离 | 15分钟 | 100% | 50% |

---

## 4. 技术债务

### 4.1 P0债务（架构级）

| ID | 描述 | 影响 | 偿还计划 |
|----|------|------|---------|
| DEBT-B01-001 | 无帧同步 | 仅限单机 | 多人模式时引入 |
| DEBT-B01-002 | AABB碰撞 | 精度受限 | 需要时引入Box2D |
| DEBT-B01-003 | 对象池非ECS | 扩展性受限 | 大规模时迁移 |

### 4.2 P1债务（功能级）

| ID | 描述 | 影响 |
|----|------|------|
| DEBT-B02-001 | 无手柄支持 | 部分玩家体验 |
| DEBT-B02-002 | Tween动画 | 动画复杂度受限 |
| DEBT-B03-001 | 内置Shader | 视觉效果上限 |
| DEBT-B03-002 | 无独立渲染层 | 幻觉效果受限 |
| DEBT-B04-001 | FadeIn动画 | UI体验 |
| DEBT-B04-002 | 无联机同步 | 仅单机 |

### 4.3 P2债务（优化级）

| ID | 描述 | 影响 |
|----|------|------|
| DEBT-B05-001 | 简单状态机 | AI复杂度 |
| DEBT-B05-002 | 直线寻路 | 移动智能 |
| DEBT-B06-001 | 6种武器 | 内容量 |
| DEBT-B06-002 | 矩形碰撞体 | 碰撞精度 |
| DEBT-B07-001 | 2个关卡 | 内容量 |
| DEBT-B07-002 | 预设模板 | 地图多样性 |
| DEBT-B08-001 | 硬编码刘海 | 适配性 |
| DEBT-B08-002 | 无飞行动画 | 视觉反馈 |
| DEBT-B09-001 | LocalStorage模拟 | 云存档 |
| DEBT-B09-002 | 无好友排行榜 | 社交功能 |

---

## 5. 性能目标

| 目标 | 数值 | 验证方法 |
|-----|------|---------|
| ARC-001 | 同屏100敌人FPS>55 | 性能测试 |
| ARC-002 | 内存无泄漏 | Heap Snapshot |
| ARC-003 | TypeScript 0 errors | tsc --noEmit |
| ARC-004 | 触摸响应<50ms | 真机测试 |

---

## 6. 测试覆盖

### 6.1 单元测试

- `tests/core.test.ts` - 核心系统 (15项)
- `tests/player.test.ts` - 玩家系统 (10项)
- `tests/sanity.test.ts` - SAN系统 (10项)
- `tests/upgrade.test.ts` - 升级系统 (10项)
- `tests/enemy.test.ts` - 敌人系统 (10项)
- `tests/weapon.test.ts` - 武器系统 (10项)
- `tests/level.test.ts` - 关卡系统 (10项)
- `tests/ui.test.ts` - UI系统 (10项)

**总计**: 85项测试

### 6.2 测试命令

```bash
npm test              # 运行所有测试
npm run test:coverage # 覆盖率报告
npm run typecheck     # 类型检查
npm run lint          # 代码规范
```

---

## 7. 部署方案

### 7.1 Web版

- **平台**: GitHub Pages
- **URL**: `https://yourusername.github.io/daoguiyixian-roguelike`
- **构建**: `npm run build:web`

### 7.2 微信小游戏

- **平台**: 微信公众平台
- **构建**: `npm run build:wechat`
- **限制**: 首包<4MB

---

## 8. 开源合规

### 8.1 许可证

- **代码**: MIT License
- **美术/剧情**: CC BY-NC 4.0 (非商业性使用)

### 8.2 免责声明

本作为《道诡异仙》同人二创，版权归狐尾的笔/起点中文网所有，如有侵权立即下架。

---

## 9. 版本历史

| 版本 | 日期 | 说明 |
|-----|------|-----|
| v1.0.0 | 2026-02-19 | 完整版发布 |

---

## 10. 团队

- **Architect**: 黄瓜睦
- **Engineer**: 唐音
- **PM**: Soyorin
- **QA**: 咕咕嘎嘎
- **Debug Doctor**: 奶龙娘
- **Orchestrator**: 客服小祥
- **Audit**: 压力怪

---

**文档结束**
