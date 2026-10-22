/**
 * CharacterFlightConfig.ts
 * Per-character flight tuning. One stable object is read by the shared
 * FlightSystem every frame, so edits applied here affect the live game.
 */

export type FlightCharacterId = 'ironman' | 'agatha' | 'classic';
export type FlightStyle = 'repulsor' | 'arcane';

export interface CharacterFlightProfile {
  displayName: string;
  enabled: boolean;
  style: FlightStyle;
  hoverAltitude: number;
  maxAltitude: number;
  maxSpeed: number;
  acceleration: number;
  deceleration: number;
  verticalSpeed: number;
  inertia: number;
  stability: number;
  turnResponse: number;
  gravity: number;
  maxDuration: number;
  canAscend: boolean;
  canDescend: boolean;
}

export interface FlightConfig {
  characters: Record<FlightCharacterId, CharacterFlightProfile>;
}

export const DEFAULT_FLIGHT_CONFIG: FlightConfig = {
  characters: {
    ironman: {
      displayName: 'Homem de Ferro',
      enabled: true,
      style: 'repulsor',
      hoverAltitude: 3.6,
      maxAltitude: 16,
      maxSpeed: 8.8,
      acceleration: 28,
      deceleration: 30,
      verticalSpeed: 5.0,
      inertia: 6.0,
      stability: 12.0,
      turnResponse: 26.0,
      gravity: 18.0,
      maxDuration: 0,
      canAscend: true,
      canDescend: true,
    },
    agatha: {
      displayName: 'Agatha Harkness',
      enabled: true,
      style: 'arcane',
      hoverAltitude: 3.6,
      maxAltitude: 16,
      maxSpeed: 8.8,
      acceleration: 28,
      deceleration: 30,
      verticalSpeed: 5.0,
      inertia: 6.0,
      stability: 12.0,
      turnResponse: 26.0,
      gravity: 18.0,
      maxDuration: 0,
      canAscend: true,
      canDescend: true,
    },
    classic: {
      displayName: 'Lutador Clássico',
      enabled: true,
      style: 'repulsor',
      hoverAltitude: 3.6,
      maxAltitude: 16,
      maxSpeed: 8.8,
      acceleration: 28,
      deceleration: 30,
      verticalSpeed: 5.0,
      inertia: 6.0,
      stability: 12.0,
      turnResponse: 26.0,
      gravity: 18.0,
      maxDuration: 0,
      canAscend: true,
      canDescend: true,
    },
  },
};

const FLIGHT_CONFIG_STORAGE_KEY = 'stickman_flight_config_v1';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function mergeFlightConfig(
  target: FlightConfig,
  partial: Partial<FlightConfig> | Record<string, unknown>
): FlightConfig {
  const source = partial as Record<string, unknown>;
  const sourceCharacters = source.characters;
  if (!isPlainObject(sourceCharacters)) return target;

  for (const [id, profileValue] of Object.entries(sourceCharacters)) {
    if (!(id in target.characters) || !isPlainObject(profileValue)) continue;
    const targetProfile = target.characters[id as FlightCharacterId] as unknown as Record<string, unknown>;
    for (const [key, value] of Object.entries(profileValue)) {
      if (!(key in targetProfile)) continue;
      const current = targetProfile[key];
      if (typeof current === 'number') {
        if (typeof value === 'number' && Number.isFinite(value)) {
          targetProfile[key] = value;
        }
      } else if (typeof current === typeof value) {
        targetProfile[key] = value;
      }
    }
  }
  return target;
}

function loadPersistedConfig(): Partial<FlightConfig> {
  try {
    const raw = localStorage.getItem(FLIGHT_CONFIG_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return isPlainObject(parsed) ? (parsed as Partial<FlightConfig>) : {};
  } catch {
    return {};
  }
}

// Stable object identity: modules and the render loop keep a live reference.
export const activeFlightConfig: FlightConfig = mergeFlightConfig(
  structuredClone(DEFAULT_FLIGHT_CONFIG),
  loadPersistedConfig()
);

export function getFlightProfile(id: FlightCharacterId): CharacterFlightProfile {
  return activeFlightConfig.characters[id] || activeFlightConfig.characters.classic;
}

export function updateFlightConfig(partial: Partial<FlightConfig>): void {
  mergeFlightConfig(activeFlightConfig, partial);
  try {
    localStorage.setItem(FLIGHT_CONFIG_STORAGE_KEY, JSON.stringify(activeFlightConfig));
  } catch {
    // Storage may be unavailable; runtime values are still updated.
  }
}

export function resetFlightConfig(): void {
  mergeFlightConfig(activeFlightConfig, structuredClone(DEFAULT_FLIGHT_CONFIG));
  try {
    localStorage.removeItem(FLIGHT_CONFIG_STORAGE_KEY);
  } catch {
    // Ignore.
  }
}
