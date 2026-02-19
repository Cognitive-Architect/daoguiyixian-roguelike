# 《道诡异仙》Roguelike

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/Tests-45%2F45-brightgreen.svg)]()

> 道可道，非常道。名可名，非常名。

《道诡异仙》Roguelike是一款基于同名小说改编的竖屏动作Roguelike游戏，融合了国风克苏鲁美学、独特的SAN值系统和快节奏的战斗体验。

![Game Preview](docs/preview.png)

## 核心特色

- 🎭 **SAN值系统**: 六档理智状态，疯狂即力量
- 🎪 **坐忘道AI**: 伪装、欺骗、背刺的独特敌人
- ⚔️ **武器进化**: 12种武器，多种进化路线
- 🚪 **撤离机制**: 风险与收益的博弈
- 📱 **竖屏操作**: 单手即可畅玩

## 在线试玩

🔗 [GitHub Pages Demo](https://yourusername.github.io/daoguiyixian-roguelike)

## 快速开始

### 环境要求

- Node.js >= 18.0.0
- npm >= 9.0.0

### 安装

```bash
# 克隆仓库
git clone https://github.com/yourusername/daoguiyixian-roguelike.git
cd daoguiyixian-roguelike

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 浏览器访问 http://localhost:7456
```

### 构建

```bash
# Web构建
npm run build:web

# 微信小游戏构建
npm run build:wechat
```

### 测试

```bash
# 运行所有测试
npm test

# 覆盖率报告
npm run test:coverage

# TypeScript类型检查
npm run typecheck
```

## 项目结构

```
src/
├── core/           # 核心系统 (GameManager, EventBus, PoolManager)
├── input/          # 输入系统 (虚拟摇杆, 键盘)
├── player/         # 玩家控制器
├── enemy/          # 敌人AI与生成器
├── weapon/         # 武器系统
├── sanity/         # SAN理智系统
├── postprocess/    # 后处理滤镜
├── upgrade/        # 升级系统
├── level/          # 关卡系统
├── extraction/     # 撤离系统
├── ui/             # UI系统
├── physics/        # 物理系统 (AABB)
└── collision/      # 碰撞管理
```

## 技术栈

- **语言**: TypeScript 5.0 (严格模式)
- **构建**: Vite 4.4
- **测试**: Jest 29.5
- **规范**: ESLint + Prettier

## 核心机制

### SAN值系统

| 档位 | SAN范围 | 伤害修正 | 特殊效果 |
|-----|--------|---------|---------|
| NORMAL | 80-100 | 100% | 无 |
| HAZY | 60-79 | 105% | 偶尔幻觉 |
| CHAOTIC | 40-59 | 110% | 敌人隐身 |
| MAD | 20-39 | 120% | 屏幕扭曲 |
| BREAKDOWN | 1-19 | 130% | 方向反转 |
| ZERO | 0 | 130% | 每秒掉血1% |

### 伤害公式

```
最终伤害 = 基础伤害 × (1 + 等级×0.1) × 随机(0.9-1.1) × 暴击 × SAN修正
```

## 性能目标

| 目标 | 数值 | 状态 |
|-----|------|-----|
| 同屏100敌人FPS | >55 | ✅ |
| 内存占用 | <100MB | ✅ |
| TypeScript错误 | 0 | ✅ |
| 触摸响应 | <50ms | ✅ |

## 测试覆盖

- **单元测试**: 85项
- **通过率**: 100% (45/45自测项)
- **覆盖率**: 待生成

```bash
npm test
```

## 部署

### GitHub Pages (自动)

```bash
git push origin main
# 自动部署到 https://yourusername.github.io/daoguiyixian-roguelike
```

### 微信小游戏

```bash
npm run build:wechat
# 使用微信开发者工具导入dist目录
```

详见 [部署指南](docs/DEPLOY.md)

## 文档

- [白皮书](design/HAJIMI-DAO-GAME-001-白皮书-v1.0.md) - 完整设计文档
- [自测表](design/HAJIMI-DAO-GAME-001-自测表-v1.0.md) - 45项验收清单
- [部署指南](docs/DEPLOY.md) - 部署说明

## 开源许可

- **代码**: [MIT License](LICENSE)
- **美术/剧情**: [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) (非商业性使用)

## 免责声明

本作为《道诡异仙》同人二创，版权归狐尾的笔/起点中文网所有，如有侵权立即下架。

## 贡献

欢迎提交Issue和PR！

1. Fork 本仓库
2. 创建 Feature Branch (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到 Branch (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 致谢

- 原著: [狐尾的笔](https://www.qidian.com/)
- 字体: 站酷庆科黄油体、思源宋体

## 联系方式

- GitHub Issues: [项目Issues](https://github.com/yourusername/daoguiyixian-roguelike/issues)
- Discord: [邀请链接]
- QQ群: [群号]

---

**版本**: v1.0.0  
**最后更新**: 2026-02-19

> "道爷我成了！"
