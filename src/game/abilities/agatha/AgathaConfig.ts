/**
 * AgathaConfig.ts
 * Tunable parameters and typed configurations for Agatha Harkness abilities.
 */

export interface AgathaAbilitySettings {
  // Arcane Blast (Basic Attack)
  arcaneBlast: {
    damage: number;
    speed: number;
    maxRange: number;
    homingStrength: number;
    cooldown: number;
    coreColor: number;
    glowColor: number;
    ringColor: number;
    lightColor: number;
    shakeAmount: number;
  };

  // Dark Drain (Ability 1)
  darkDrain: {
    duration: number;
    dps: number;
    healRate: number;
    range: number;
    tickInterval: number;
    tendrilColor: number;
    coreColor: number;
  };

  // Chaos Orb (Ability 2)
  chaosOrb: {
    directDamage: number;
    splashDamage: number;
    splashRadius: number;
    speed: number;
    maxRange: number;
    homingStrength: number;
    cooldown: number;
    shakeAmount: number;
  };

  // Runic Ward (Ability 3 - Shield)
  runicWard: {
    duration: number;
    shieldHealth: number;
    knockbackRadius: number;
    knockbackForce: number;
    damageReduction: number;
    cooldown: number;
  };

  // Arcane Choke (Ability 4 - Binding)
  arcaneChoke: {
    duration: number;
    tickDamage: number;
    tickInterval: number;
    maxRange: number;
    liftHeight: number;
    cooldown: number;
  };

  // Shadow Step (Dash)
  shadowStep: {
    distance: number;
    cooldown: number;
    smokeCount: number;
  };
}

export const DEFAULT_AGATHA_CONFIG: AgathaAbilitySettings = {
  arcaneBlast: {
    damage: 38,
    speed: 46.0,
    maxRange: 50.0,
    homingStrength: 8.5,
    cooldown: 0.28,
    coreColor: 0xf5d0fe,
    glowColor: 0x9333ea,
    ringColor: 0x3b0764,
    lightColor: 0xa855f7,
    shakeAmount: 0.025,
  },
  darkDrain: {
    duration: 3.0,
    dps: 30.0,
    healRate: 20.0,
    range: 22.0,
    tickInterval: 0.2,
    tendrilColor: 0xa855f7,
    coreColor: 0x581c87,
  },
  chaosOrb: {
    directDamage: 85,
    splashDamage: 65,
    splashRadius: 7.5,
    speed: 22.0,
    maxRange: 45.0,
    homingStrength: 4.5,
    cooldown: 5.0,
    shakeAmount: 0.07,
  },
  runicWard: {
    duration: 5.5,
    shieldHealth: 160,
    knockbackRadius: 6.0,
    knockbackForce: 8.0,
    damageReduction: 0.65,
    cooldown: 8.0,
  },
  arcaneChoke: {
    duration: 3.0,
    tickDamage: 22,
    tickInterval: 0.3,
    maxRange: 26.0,
    liftHeight: 3.2,
    cooldown: 7.0,
  },
  shadowStep: {
    distance: 14.0,
    cooldown: 3.0,
    smokeCount: 24,
  },
};

const AGATHA_CONFIG_STORAGE_KEY = 'stickman_agatha_config_v1';

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

function loadPersistedConfig(): AgathaAbilitySettings {
  try {
    if (typeof localStorage === 'undefined') return cloneConfig(DEFAULT_AGATHA_CONFIG);
    const raw = localStorage.getItem(AGATHA_CONFIG_STORAGE_KEY);
    if (!raw) return cloneConfig(DEFAULT_AGATHA_CONFIG);
    return deepMerge(DEFAULT_AGATHA_CONFIG, JSON.parse(raw));
  } catch {
    return cloneConfig(DEFAULT_AGATHA_CONFIG);
  }
}

export let activeAgathaConfig: AgathaAbilitySettings = loadPersistedConfig();

function persistAgathaConfig(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(AGATHA_CONFIG_STORAGE_KEY, JSON.stringify(activeAgathaConfig));
    }
  } catch {
    // Persistence failure must not break combat.
  }
}

export function updateAgathaConfig(partial: Partial<AgathaAbilitySettings>): void {
  activeAgathaConfig = deepMerge(activeAgathaConfig, partial);
  persistAgathaConfig();
}

export function resetAgathaConfig(): void {
  activeAgathaConfig = cloneConfig(DEFAULT_AGATHA_CONFIG);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(AGATHA_CONFIG_STORAGE_KEY);
    }
  } catch {
    // Ignore storage restrictions.
  }
}
