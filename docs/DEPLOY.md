# 《道诡异仙》Roguelike 部署指南

## 快速开始

### 环境要求

- Node.js >= 18.0.0
- npm >= 9.0.0

### 本地开发

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

# 输出目录: dist/
```

### 测试

```bash
# 运行所有测试
npm test

# 覆盖率报告
npm run test:coverage

# TypeScript类型检查
npm run typecheck

# ESLint检查
npm run lint
```

## GitHub Pages 部署

### 自动部署

项目已配置GitHub Actions工作流，推送到main分支会自动部署：

```bash
# 推送代码
git add .
git commit -m "Your commit message"
git push origin main

# 等待GitHub Actions完成
# 访问 https://yourusername.github.io/daoguiyixian-roguelike
```

### 手动部署

```bash
# 构建
npm run build:web

# 部署到gh-pages分支
npx gh-pages -d dist
```

## 微信小游戏部署

### 准备工作

1. 注册[微信公众平台](https://mp.weixin.qq.com/)账号
2. 申请小游戏资质
3. 下载[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)

### 构建

```bash
npm run build:wechat
```

### 上传

1. 打开微信开发者工具
2. 选择"小游戏"项目
3. 导入`dist`目录
4. 点击"上传"

### 审核适配

根据微信审核要求，需要进行以下适配：

- 血变墨（#000000）
- 鬼变"暗影"（黑色轮廓+红色眼睛）
- 添加12+适龄提示

## 项目结构

```
HAJIMI-DAO-GAME-001/
├── src/
│   ├── core/           # 核心系统
│   ├── input/          # 输入系统
│   ├── player/         # 玩家控制器
│   ├── enemy/          # 敌人AI
│   ├── weapon/         # 武器系统
│   ├── sanity/         # SAN系统
│   ├── postprocess/    # 后处理
│   ├── upgrade/        # 升级系统
│   ├── level/          # 关卡系统
│   ├── extraction/     # 撤离系统
│   ├── ui/             # UI系统
│   ├── physics/        # 物理系统
│   ├── collision/      # 碰撞系统
│   └── main.ts         # 入口文件
├── tests/              # 测试套件
├── assets/
│   └── configs/        # JSON配置
├── build/              # 构建脚本
├── .github/
│   └── workflows/      # CI/CD配置
├── docs/               # 文档
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 配置说明

### 游戏配置

编辑`src/main.ts`中的`GAME_CONFIG`：

```typescript
const GAME_CONFIG = {
    targetFPS: 60,        // 目标帧率
    maxEntities: 100,     // 最大实体数
    enableDebug: false,   // 调试模式
};
```

### 关卡配置

编辑`assets/configs/`下的JSON文件：

- `upgrades.json` - 升级选项
- `enemies.json` - 敌人数据
- `weapons.json` - 武器数据

## 性能优化

### 构建优化

- 代码分割（Code Splitting）
- Tree Shaking
- Terser压缩
- 资源CDN

### 运行时优化

- 对象池复用
- 分帧生成
- AABB碰撞检测
- 确定性随机

## 常见问题

### 构建失败

```bash
# 清理缓存
npm run clean
npm install
npm run build
```

### 类型错误

```bash
npm run typecheck
```

### 测试失败

```bash
npm test -- --verbose
```

## 许可证

代码: MIT License
美术/剧情: CC BY-NC 4.0 (非商业性使用)

## 免责声明

本作为《道诡异仙》同人二创，版权归狐尾的笔/起点中文网所有，如有侵权立即下架。

## 联系方式

- GitHub Issues: [项目Issues页面](https://github.com/yourusername/daoguiyixian-roguelike/issues)
- Discord: [邀请链接]
- QQ群: [群号]

---

**版本**: v1.0.0  
**最后更新**: 2026-02-19
