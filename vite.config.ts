import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
    const isWechat = mode === 'wechat';
    
    return {
        root: '.',
        base: isWechat ? './' : '/daoguiyixian-roguelike/',
        
        build: {
            outDir: 'dist',
            emptyOutDir: true,
            target: 'es2020',
            minify: 'terser',
            terserOptions: {
                compress: {
                    drop_console: true,
                    drop_debugger: true,
                },
            },
            rollupOptions: {
                input: {
                    main: resolve(__dirname, 'index.html'),
                },
                output: {
                    manualChunks: {
                        'core': ['./src/core/GameManager', './src/core/EventBus', './src/core/PoolManager'],
                        'physics': ['./src/physics/AABB', './src/physics/CollisionManager'],
                        'gameplay': ['./src/player/PlayerController', './src/enemy/EnemyAI', './src/weapon/WeaponSystem'],
                        'ui': ['./src/ui/HUD', './src/ui/JoystickUI', './src/ui/SkillPanel'],
                    },
                },
            },
            // 微信小游戏限制
            chunkSizeWarningLimit: isWechat ? 2048 : 500,
        },
        
        resolve: {
            alias: {
                '@': resolve(__dirname, 'src'),
                '@core': resolve(__dirname, 'src/core'),
                '@player': resolve(__dirname, 'src/player'),
                '@enemy': resolve(__dirname, 'src/enemy'),
                '@weapon': resolve(__dirname, 'src/weapon'),
                '@ui': resolve(__dirname, 'src/ui'),
                '@utils': resolve(__dirname, 'src/utils'),
            },
        },
        
        server: {
            port: 7456,
            open: true,
            host: true,
        },
        
        preview: {
            port: 4173,
        },
        
        // 优化
        optimizeDeps: {
            include: [],
        },
        
        // 性能
        esbuild: {
            target: 'es2020',
        },
    };
});
