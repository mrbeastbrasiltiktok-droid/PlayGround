/**
 * DoctorStrangeConfig.ts
 * Tunable parameters and typed configurations for Doctor Strange (Mystic Arts).
 */

export interface DoctorStrangeAbilitySettings {
  // Orange Mystic Disc (Basic Attack)
  mysticDisc: {
    damage: number;
    speed: number;
    maxRange: number;
    cooldown: number;
    maxLifetime: number;
    discRadius: number;
    tilt: number;
    impactFxScale: number;
    shakeAmount: number;
    coreColor: number;
    discColor: number;
    rimColor: number;
    glowColor: number;
  };

  // Orange Mystic Beam (Ability 1)
  mysticBeam: {
    damagePerTick: number;
    tickInterval: number;
    range: number;
    maxDuration: number;
    cooldown: number;
    fadeOut: number;
    circleCount: number;
    circleSpin: number;
    coreColor: number;
    glowColor: number;
    outerColor: number;
    circleColor: number;
  };

  // Mystic Shield (Ability 2)
  mysticShield: {
    duration: number;
    shieldHealth: number;
    cooldown: number;
    radius: number;
    frontalOffset: number;
    heightOffset: number;
    blockRadius: number;
    blockAngleDeg: number;
    contactDrainPerSecond: number;
    rivalBeamDrainPerSecond: number;
    butterflyCount: number;
    butterflyDuration: number;
    discColor: number;
    rimColor: number;
    runeColor: number;
  };

  // Green Mystic Explosion (Ability 3)
  greenExplosion: {
    damage: number;
    radius: number;
    castRange: number;
    visualDuration: number;
    windup: number;
    cooldown: number;
    orbSpeed: number;
    particleCount: number;
    coreColor: number;
    glowColor: number;
    deepColor: number;
  };

  // Mystic Flight (Cape of Levitation)
  mysticFlight: {
    speed: number;
    accelerationDamp: number;
    landingCooldown: number;
    fadeTime: number;
    capeColor: number;
    capeTrimColor: number;
  };

  // Mystic Portal Step (Dash)
  portalStep: {
    distance: number;
    duration: number;
    cooldown: number;
    portalRadius: number;
    entryFraction: number;
    traverseFraction: number;
    closeTime: number;
    portalColor: number;
    portalGlowColor: number;
  };
}

export const DEFAULT_STRANGE_CONFIG: DoctorStrangeAbilitySettings = {
  mysticDisc: {
    damage: 20,
    speed: 65.0,
    maxRange: 55.0,
    cooldown: 0.45,
    maxLifetime: 2.0,
    discRadius: 0.32,
    tilt: 0.22,
    impactFxScale: 1.0,
    shakeAmount: 0.03,
    coreColor: 0xfff3e0,
    discColor: 0xff8c1a,
    rimColor: 0xffb347,
    glowColor: 0xff7a00,
  },
  mysticBeam: {
    damagePerTick: 8,
    tickInterval: 0.25,
    range: 45.0,
    maxDuration: 3.0,
    cooldown: 7.0,
    fadeOut: 0.3,
    circleCount: 5,
    circleSpin: 2.4,
    coreColor: 0xffe8c8,
    glowColor: 0xff8c1a,
    outerColor: 0xff6a00,
    circleColor: 0xffa040,
  },
  mysticShield: {
    duration: 4.0,
    shieldHealth: 120,
    cooldown: 10.0,
    radius: 1.9,
    frontalOffset: 1.2,
    heightOffset: 1.25,
    blockRadius: 3.4,
    blockAngleDeg: 75,
    contactDrainPerSecond: 26.0,
    rivalBeamDrainPerSecond: 34.0,
    butterflyCount: 10,
    butterflyDuration: 2.2,
    discColor: 0xff9a3c,
    rimColor: 0xffd9a0,
    runeColor: 0xffb347,
  },
  greenExplosion: {
    damage: 45,
    radius: 10.0,
    castRange: 40.0,
    visualDuration: 1.2,
    windup: 0.6,
    cooldown: 12.0,
    orbSpeed: 55.0,
    particleCount: 40,
    coreColor: 0xbaffc9,
    glowColor: 0x39ff6a,
    deepColor: 0x0a8f3c,
  },
  mysticFlight: {
    speed: 22.0,
    accelerationDamp: 6.0,
    landingCooldown: 2.0,
    fadeTime: 0.45,
    capeColor: 0x8a1c12,
    capeTrimColor: 0xff9a3c,
  },
  portalStep: {
    distance: 14.0,
    duration: 0.8,
    cooldown: 5.0,
    portalRadius: 1.15,
    entryFraction: 0.375,
    traverseFraction: 0.25,
    closeTime: 0.3,
    portalColor: 0xff8c1a,
    portalGlowColor: 0xffd9a0,
  },
};

const STRANGE_CONFIG_STORAGE_KEY = 'stickman_strange_config_v1';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function mergeStrangeConfig(
  target: DoctorStrangeAbilitySettings,
  partial: Partial<DoctorStrangeAbilitySettings> | Record<string, unknown>
): DoctorStrangeAbilitySettings {
  const source = partial as Record<string, unknown>;
  for (const [sectionKey, sectionValue] of Object.entries(source)) {
    if (!(sectionKey in target) || !isPlainObject(sectionValue)) continue;
    const targetSection = (target as unknown as Record<string, Record<string, unknown>>)[sectionKey];
    for (const [key, value] of Object.entries(sectionValue)) {
      if (!(key in targetSection)) continue;
      if (typeof targetSection[key] === 'number') {
        if (typeof value === 'number' && Number.isFinite(value)) {
          targetSection[key] = value;
        }
      } else if (typeof targetSection[key] === typeof value) {
        targetSection[key] = value;
      }
    }
  }
  return target;
}

function loadPersistedConfig(): Partial<DoctorStrangeAbilitySettings> {
  try {
    const raw = localStorage.getItem(STRANGE_CONFIG_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return isPlainObject(parsed) ? (parsed as Partial<DoctorStrangeAbilitySettings>) : {};
  } catch {
    return {};
  }
}

// Stable object identity (never reassigned).
export const activeStrangeConfig: DoctorStrangeAbilitySettings = mergeStrangeConfig(
  structuredClone(DEFAULT_STRANGE_CONFIG),
  loadPersistedConfig()
);

export function updateStrangeConfig(partial: Partial<DoctorStrangeAbilitySettings>): void {
  mergeStrangeConfig(activeStrangeConfig, partial);
  try {
    localStorage.setItem(STRANGE_CONFIG_STORAGE_KEY, JSON.stringify(activeStrangeConfig));
  } catch {
    // Storage may be unavailable; runtime values are still updated.
  }
}

export function resetStrangeConfig(): void {
  mergeStrangeConfig(activeStrangeConfig, structuredClone(DEFAULT_STRANGE_CONFIG));
  try {
    localStorage.removeItem(STRANGE_CONFIG_STORAGE_KEY);
  } catch {
    // Ignore.
  }
}
