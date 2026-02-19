/**
 * UpgradeOption.ts
 * B-03 升级选项定义与随机选择
 */

export type UpgradeEffectType = 'weapon_effect' | 'weapon_stat' | 'player_stat' | 'sanity_boost';

export interface UpgradeConfigItem {
    id: string;
    name: string;
    type: UpgradeEffectType;
    target: string;
    effect?: string;
    value: number;
    san_requirement?: number;
    vfx?: string;
}

export interface UpgradeOption extends UpgradeConfigItem {
    borderColor: 'normal' | 'purple';
    isMadnessExclusive: boolean;
    appliedValue: number;
}

export class UpgradeOptionFactory {
    public static buildOptions(pool: UpgradeConfigItem[], sanityPercent: number, count: number = 3): UpgradeOption[] {
        const uniquePool = [...pool];
        const picked: UpgradeOption[] = [];

        while (picked.length < count && uniquePool.length > 0) {
            const index = Math.floor(Math.random() * uniquePool.length);
            const base = uniquePool.splice(index, 1)[0];
            picked.push(this.toOption(base, sanityPercent));
        }

        if (sanityPercent < 30 && !picked.some(option => option.isMadnessExclusive)) {
            const madness = pool.find(item => (item.san_requirement ?? 0) >= 30);
            if (madness) {
                const replaceIndex = picked.length > 0 ? 0 : -1;
                const madnessOption = this.toOption(madness, sanityPercent);
                if (replaceIndex >= 0) {
                    picked[replaceIndex] = madnessOption;
                } else {
                    picked.push(madnessOption);
                }
            }
        }

        return picked.slice(0, count);
    }

    public static toOption(config: UpgradeConfigItem, sanityPercent: number): UpgradeOption {
        const isMadnessExclusive = sanityPercent < 30 && (config.san_requirement ?? 0) >= 30;
        const valueMultiplier = isMadnessExclusive ? 1.5 : 1;

        return {
            ...config,
            borderColor: isMadnessExclusive ? 'purple' : 'normal',
            isMadnessExclusive,
            appliedValue: Number((config.value * valueMultiplier).toFixed(3)),
        };
    }
}
