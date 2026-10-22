/**
 * IronManConfig.ts
 * Tunable parameters and typed configurations for Iron Man armor systems.
 */

export interface IronManAbilitySettings {
  repulsor: {
    damage: number;
    speed: number;
    maxRange: number;
    homingStrength: number;
    cooldown: number;
    beamColor: number;
    glowColor: number;
  };
  microMissiles: {
    volleyCount: number;
    damagePerMissile: number;
    speed: number;
    arcHeight: number;
    cooldown: number;
  };
  dualBeams: {
    dps: number;
    maxDuration: number;
    range: number;
    cooldown: number;
  };
  unibeam: {
    damage: number;
    chargeTime: number;
    range: number;
    cooldown: number;
  };
  spinningLasers: {
    damage: number;
    radius: number;
    duration: number;
    cooldown: number;
  };
}

/**
 * Defaults mirror the live values hard-coded in IronManAbilities so that
 * exposing them to the editor changes nothing until the player tunes them.
 */
export const DEFAULT_IRONMAN_CONFIG: IronManAbilitySettings = {
  repulsor: {
    damage: 8,
    speed: 42.0,
    maxRange: 42.0,
    homingStrength: 8.0,
    cooldown: 0.22,
    beamColor: 0xff1122,
    glowColor: 0xff1a2a,
  },
  microMissiles: {
    volleyCount: 6,
    damagePerMissile: 12,
    speed: 38.0,
    arcHeight: 5.5,
    cooldown: 4.5,
  },
  dualBeams: {
    dps: 20.0,
    maxDuration: 4.0,
    range: 22.0,
    cooldown: 10.0,
  },
  unibeam: {
    damage: 55,
    chargeTime: 0.30,
    range: 60.0,
    cooldown: 8.0,
  },
  spinningLasers: {
    damage: 18,
    radius: 7.5,
    duration: 1.5,
    cooldown: 7.0,
  },
};

const IRONMAN_CONFIG_STORAGE_KEY = 'stickman_ironman_config_v1';

function cloneConfig<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepMerge<T extends Record<string, any>>(base: T, partial: Partial<T>): T {
  const next = cloneConfig(base);
  for (const [key, value] of Object.entries(partial || {})) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const current = (next as Record<string, any>)[key];
      if (current && typeof current === 'object' && !Array.isArray(current)) {
        (next as Record<string, any>)[key] = deepMerge(current, value as Record<string, any>);
        continue;
      }
    }
    if (value !== undefined) {
      (next as Record<string, any>)[key] = value;
    }
  }
  return next;
}

function loadPersistedConfig(): IronManAbilitySettings {
  try {
    if (typeof localStorage === 'undefined') return cloneConfig(DEFAULT_IRONMAN_CONFIG);
    const raw = localStorage.getItem(IRONMAN_CONFIG_STORAGE_KEY);
    if (!raw) return cloneConfig(DEFAULT_IRONMAN_CONFIG);
    return deepMerge(DEFAULT_IRONMAN_CONFIG, JSON.parse(raw));
  } catch {
    return cloneConfig(DEFAULT_IRONMAN_CONFIG);
  }
}

export let activeIronManConfig: IronManAbilitySettings = loadPersistedConfig();

function persistIronManConfig(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(IRONMAN_CONFIG_STORAGE_KEY, JSON.stringify(activeIronManConfig));
    }
  } catch {
    // Persistence failure must not break combat.
  }
}

export function updateIronManConfig(partial: Partial<IronManAbilitySettings>): void {
  activeIronManConfig = deepMerge(activeIronManConfig, partial);
  persistIronManConfig();
}

export function resetIronManConfig(): void {
  activeIronManConfig = cloneConfig(DEFAULT_IRONMAN_CONFIG);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(IRONMAN_CONFIG_STORAGE_KEY);
    }
  } catch {
    // Ignore storage restrictions.
  }
}
