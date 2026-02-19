/**
 * SanityFilter.ts
 * SAN后处理滤镜 - 视觉表现
 * 
 * 核心效果：
 * - 边缘渗血（Shader，透明度随SAN值动态变化）
 * - 色相偏移（低SAN时红移）
 * 
 * DEBT-B03-001: Shader用Cocos内置ColorGrading（无自定义GLSL）
 * DEBT-B03-002: 幻觉敌人用Sprite透明度变化（无独立渲染层）
 */

import { SanitySystem, SanityTier, sanitySystem } from '../sanity/SanitySystem';

export interface FilterEffect {
    name: string;
    intensity: number;
    params: Record<string, number>;
}

export class SanityFilter {
    private static instance: SanityFilter;
    private sanitySystem: SanitySystem;
    
    // 滤镜参数
    private currentEffects: FilterEffect[] = [];
    private targetEffects: FilterEffect[] = [];
    
    // 渲染参数
    private renderParams = {
        saturation: 1.0,
        redShift: 0.0,
        edgeBleed: 0.0,
        distortion: 0.0,
        vignette: 0.0,
        noise: 0.0,
        chromaticAberration: 0.0,
    };
    
    // 渐变速度
    private readonly lerpSpeed = 3.0;
    
    // 特效计时器
    private effectTimers: Map<string, number> = new Map();
    
    // 屏幕抖动
    private shakeIntensity: number = 0;
    private shakeDuration: number = 0;

    private constructor() {
        this.sanitySystem = SanitySystem.getInstance();
    }

    public static getInstance(): SanityFilter {
        if (!SanityFilter.instance) {
            SanityFilter.instance = new SanityFilter();
        }
        return SanityFilter.instance;
    }

    /**
     * 初始化滤镜
     */
    public initialize(): void {
        console.log('[SanityFilter] Initialized');
    }

    /**
     * 更新滤镜
     */
    public update(deltaTime: number): void {
        // 获取SAN系统视觉参数
        const sanParams = this.sanitySystem.getVisualParams();
        
        // 平滑过渡到目标参数
        this.renderParams.saturation = this.lerp(
            this.renderParams.saturation,
            sanParams.saturation,
            this.lerpSpeed * deltaTime
        );
        this.renderParams.redShift = this.lerp(
            this.renderParams.redShift,
            sanParams.redShift,
            this.lerpSpeed * deltaTime
        );
        this.renderParams.edgeBleed = this.lerp(
            this.renderParams.edgeBleed,
            sanParams.edgeBleedIntensity,
            this.lerpSpeed * deltaTime
        );
        this.renderParams.distortion = this.lerp(
            this.renderParams.distortion,
            sanParams.distortionAmount,
            this.lerpSpeed * deltaTime
        );
        this.renderParams.vignette = this.lerp(
            this.renderParams.vignette,
            sanParams.vignetteIntensity,
            this.lerpSpeed * deltaTime
        );
        
        // 更新噪声（ZERO档时增加）
        const targetNoise = this.sanitySystem.getCurrentTier() === SanityTier.ZERO ? 0.3 : 0;
        this.renderParams.noise = this.lerp(
            this.renderParams.noise,
            targetNoise,
            this.lerpSpeed * deltaTime
        );
        
        // 更新色差
        const targetChromatic = this.sanitySystem.getVisualIntensity() * 0.5;
        this.renderParams.chromaticAberration = this.lerp(
            this.renderParams.chromaticAberration,
            targetChromatic,
            this.lerpSpeed * deltaTime
        );
        
        // 更新屏幕抖动
        if (this.shakeDuration > 0) {
            this.shakeDuration -= deltaTime;
            if (this.shakeDuration <= 0) {
                this.shakeIntensity = 0;
            }
        }
        
        // 更新特效计时器
        this.updateEffectTimers(deltaTime);
    }

    /**
     * 线性插值
     */
    private lerp(a: number, b: number, t: number): number {
        return a + (b - a) * Math.min(t, 1);
    }

    /**
     * 更新特效计时器
     */
    private updateEffectTimers(deltaTime: number): void {
        for (const [name, timer] of this.effectTimers) {
            const newTimer = timer - deltaTime;
            if (newTimer <= 0) {
                this.effectTimers.delete(name);
                this.removeEffect(name);
            } else {
                this.effectTimers.set(name, newTimer);
            }
        }
    }

    /**
     * 添加临时特效
     */
    public addEffect(name: string, intensity: number, duration: number, params: Record<string, number> = {}): void {
        const existingEffect = this.currentEffects.find(e => e.name === name);
        
        if (existingEffect) {
            existingEffect.intensity = intensity;
            existingEffect.params = params;
        } else {
            this.currentEffects.push({ name, intensity, params });
        }
        
        if (duration > 0) {
            this.effectTimers.set(name, duration);
        }
    }

    /**
     * 移除特效
     */
    public removeEffect(name: string): void {
        const index = this.currentEffects.findIndex(e => e.name === name);
        if (index > -1) {
            this.currentEffects.splice(index, 1);
        }
        this.effectTimers.delete(name);
    }

    /**
     * 触发屏幕抖动
     */
    public shake(intensity: number, duration: number): void {
        this.shakeIntensity = intensity;
        this.shakeDuration = duration;
    }

    /**
     * 触发受伤红屏
     */
    public flashRed(intensity: number = 0.5, duration: number = 0.2): void {
        this.addEffect('damage_flash', intensity, duration, { color: 0xFF0000 });
    }

    /**
     * 触发升级金光
     */
    public flashGold(intensity: number = 0.3, duration: number = 0.5): void {
        this.addEffect('levelup_flash', intensity, duration, { color: 0xFFD700 });
    }

    // ============ 渲染参数获取 ============

    /**
     * 获取完整渲染参数
     */
    public getRenderParams(): typeof this.renderParams {
        return { ...this.renderParams };
    }

    /**
     * 获取屏幕抖动偏移
     */
    public getShakeOffset(): { x: number; y: number } {
        if (this.shakeIntensity <= 0 || this.shakeDuration <= 0) {
            return { x: 0, y: 0 };
        }
        
        return {
            x: (Math.random() - 0.5) * this.shakeIntensity,
            y: (Math.random() - 0.5) * this.shakeIntensity,
        };
    }

    /**
     * 获取颜色矩阵（用于ColorGrading）
     */
    public getColorMatrix(): number[] {
        const { saturation, redShift } = this.renderParams;
        
        // 简化的颜色矩阵
        // [ R, 0, 0, 0, 0 ]
        // [ 0, G, 0, 0, 0 ]
        // [ 0, 0, B, 0, 0 ]
        // [ 0, 0, 0, A, 0 ]
        
        const s = saturation;
        const rs = 1 + redShift;
        
        return [
            rs * s, 0, 0, 0, 0,
            0, s, 0, 0, 0,
            0, 0, s * (1 - redShift * 0.5), 0, 0,
            0, 0, 0, 1, 0,
        ];
    }

    /**
     * 获取暗角强度
     */
    public getVignetteIntensity(): number {
        return this.renderParams.vignette;
    }

    /**
     * 获取边缘渗血强度
     */
    public getEdgeBleedIntensity(): number {
        return this.renderParams.edgeBleed;
    }

    /**
     * 获取扭曲强度
     */
    public getDistortionAmount(): number {
        return this.renderParams.distortion;
    }

    /**
     * 获取噪声强度
     */
    public getNoiseIntensity(): number {
        return this.renderParams.noise;
    }

    /**
     * 获取色差强度
     */
    public getChromaticAberration(): number {
        return this.renderParams.chromaticAberration;
    }

    /**
     * 获取当前特效列表
     */
    public getCurrentEffects(): FilterEffect[] {
        return [...this.currentEffects];
    }

    /**
     * 获取特定档位颜色
     */
    public static getTierColor(tier: SanityTier): { r: number; g: number; b: number } {
        switch (tier) {
            case SanityTier.NORMAL:
                return { r: 128, g: 0, b: 128 }; // 紫色
            case SanityTier.HAZY:
                return { r: 160, g: 32, b: 128 };
            case SanityTier.CHAOTIC:
                return { r: 192, g: 64, b: 96 };
            case SanityTier.MAD:
                return { r: 224, g: 96, b: 64 };
            case SanityTier.BREAKDOWN:
                return { r: 255, g: 128, b: 32 };
            case SanityTier.ZERO:
                return { r: 255, g: 0, b: 0 }; // 红色
            default:
                return { r: 128, g: 0, b: 128 };
        }
    }

    /**
     * 获取SAN条颜色
     */
    public getSanityBarColor(): { r: number; g: number; b: number } {
        return SanityFilter.getTierColor(this.sanitySystem.getCurrentTier());
    }

    /**
     * 重置滤镜
     */
    public reset(): void {
        this.renderParams = {
            saturation: 1.0,
            redShift: 0.0,
            edgeBleed: 0.0,
            distortion: 0.0,
            vignette: 0.0,
            noise: 0.0,
            chromaticAberration: 0.0,
        };
        this.currentEffects = [];
        this.effectTimers.clear();
        this.shakeIntensity = 0;
        this.shakeDuration = 0;
    }
}

// 便捷导出单例
export const sanityFilter = SanityFilter.getInstance();
