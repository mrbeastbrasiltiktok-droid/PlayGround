/**
 * Live Game Configuration Manager
 * Allows runtime tuning of game mechanics, speeds, damage, and environment
 * without requiring complete source code recompilation.
 */

export interface LiveGameConfig {
  // Camera
  cameraFov: number; // 35 to 90 (default 50)
  cameraDistance: number; // 2 to 12 (default 4.8)
  cameraHeight: number; // 0.8 to 4.0 (default 1.85)
  cameraShoulder: number; // -2.5 to 2.5 (default 0.9)
  cameraSmoothing: number; // 1 to 30 (default 10)
  cameraShakeMultiplier: number; // 0 to 2 (default 1)

  // Player locomotion
  groundMaxSpeed: number; // 2 to 20 (default 6.4)
  flightMaxSpeed: number; // 2 to 25 (default 8.8)
  dashSpeed: number; // 10 to 40 (default 19.5)
  dashCooldown: number; // 0.2 to 10 (default 2.2)
  dashDuration: number; // 0.1 to 1.0 (default 0.22)

  // Animation & feedback
  animationSpeed: number; // 0.25 to 2.0 (default 1)
  flightAltitude: number; // 1.0 to 12.0 (default 3.6)
  playerCollisionRadius: number; // 0.15 to 1.5 (default 0.45)
  particleIntensity: number; // 0 to 2.0 (default 1)
  damageNumberDuration: number; // 0.3 to 3.0 (default 0.95)

  // Environment & World
  skyColor: string; // Hex color (default #a1c3e6)
  baseplateColor: string; // Hex color (default #768291)
  sunLightIntensity: number; // 0.1 to 3.0 (default 1.25)
  fogNear: number; // 5 to 100 (default 40)
  fogFar: number; // 50 to 500 (default 200)

  // Interactive objects
  jumpPadBounceMultiplier: number; // 0.5 to 3.0 (default 1.0)
}

export const DEFAULT_LIVE_CONFIG: LiveGameConfig = {
  cameraFov: 50,
  cameraDistance: 4.8,
  cameraHeight: 1.85,
  cameraShoulder: 0.9,
  cameraSmoothing: 10,
  cameraShakeMultiplier: 1,

  groundMaxSpeed: 6.4,
  flightMaxSpeed: 8.8,
  dashSpeed: 19.5,
  dashCooldown: 2.2,
  dashDuration: 0.22,

  skyColor: '#a1c3e6',
  baseplateColor: '#768291',
  sunLightIntensity: 1.25,
  animationSpeed: 1,
  flightAltitude: 3.6,
  playerCollisionRadius: 0.45,
  particleIntensity: 1,
  damageNumberDuration: 0.95,

  fogNear: 40,
  fogFar: 200,

  jumpPadBounceMultiplier: 1.0,
};

const STORAGE_KEY = 'stickman_live_game_config';

class LiveConfigManager {
  private config: LiveGameConfig;
  private listeners: Set<(config: LiveGameConfig) => void> = new Set();

  constructor() {
    this.config = { ...DEFAULT_LIVE_CONFIG };
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.config = this.validateAndMerge(parsed);
      }
    } catch {
      this.config = { ...DEFAULT_LIVE_CONFIG };
    }
  }

  public validateAndMerge(data: Partial<LiveGameConfig>): LiveGameConfig {
    const valid = { ...DEFAULT_LIVE_CONFIG };

    const clampNum = (val: unknown, min: number, max: number, fallback: number): number => {
      const n = typeof val === 'number' && !isNaN(val) ? val : fallback;
      return Math.max(min, Math.min(max, n));
    };

    valid.cameraFov = clampNum(data.cameraFov, 35, 90, DEFAULT_LIVE_CONFIG.cameraFov);
    valid.cameraDistance = clampNum(data.cameraDistance, 2, 12, DEFAULT_LIVE_CONFIG.cameraDistance);
    valid.cameraHeight = clampNum(data.cameraHeight, 0.8, 4, DEFAULT_LIVE_CONFIG.cameraHeight);
    valid.cameraShoulder = clampNum(data.cameraShoulder, -2.5, 2.5, DEFAULT_LIVE_CONFIG.cameraShoulder);
    valid.cameraSmoothing = clampNum(data.cameraSmoothing, 1, 30, DEFAULT_LIVE_CONFIG.cameraSmoothing);
    valid.cameraShakeMultiplier = clampNum(data.cameraShakeMultiplier, 0, 2, DEFAULT_LIVE_CONFIG.cameraShakeMultiplier);

    valid.groundMaxSpeed = clampNum(data.groundMaxSpeed, 2, 25, DEFAULT_LIVE_CONFIG.groundMaxSpeed);
    valid.flightMaxSpeed = clampNum(data.flightMaxSpeed, 2, 30, DEFAULT_LIVE_CONFIG.flightMaxSpeed);
    valid.dashSpeed = clampNum(data.dashSpeed, 10, 45, DEFAULT_LIVE_CONFIG.dashSpeed);
    valid.dashCooldown = clampNum(data.dashCooldown, 0.2, 10, DEFAULT_LIVE_CONFIG.dashCooldown);
    valid.dashDuration = clampNum(data.dashDuration, 0.1, 1.0, DEFAULT_LIVE_CONFIG.dashDuration);

    const validHex = (val: unknown, fallback: string): string => {
      if (typeof val === 'string' && /^#[0-9a-fA-F]{6}$/.test(val)) {
        return val;
      }
      return fallback;
    };

    valid.skyColor = validHex(data.skyColor, DEFAULT_LIVE_CONFIG.skyColor);
    valid.baseplateColor = validHex(data.baseplateColor, DEFAULT_LIVE_CONFIG.baseplateColor);
    valid.sunLightIntensity = clampNum(data.sunLightIntensity, 0.1, 3.0, DEFAULT_LIVE_CONFIG.sunLightIntensity);
    valid.fogNear = clampNum(data.fogNear, 5, 100, DEFAULT_LIVE_CONFIG.fogNear);
    valid.fogFar = clampNum(data.fogFar, 50, 500, DEFAULT_LIVE_CONFIG.fogFar);

    valid.animationSpeed = clampNum(data.animationSpeed, 0.25, 2.0, DEFAULT_LIVE_CONFIG.animationSpeed);
    valid.flightAltitude = clampNum(data.flightAltitude, 1.0, 12.0, DEFAULT_LIVE_CONFIG.flightAltitude);
    valid.playerCollisionRadius = clampNum(data.playerCollisionRadius, 0.15, 1.5, DEFAULT_LIVE_CONFIG.playerCollisionRadius);
    valid.particleIntensity = clampNum(data.particleIntensity, 0, 2.0, DEFAULT_LIVE_CONFIG.particleIntensity);
    valid.damageNumberDuration = clampNum(data.damageNumberDuration, 0.3, 3.0, DEFAULT_LIVE_CONFIG.damageNumberDuration);

    valid.jumpPadBounceMultiplier = clampNum(data.jumpPadBounceMultiplier, 0.5, 3.0, DEFAULT_LIVE_CONFIG.jumpPadBounceMultiplier);

    return valid;
  }

  public get(): LiveGameConfig {
    return { ...this.config };
  }

  public update(partial: Partial<LiveGameConfig>): void {
    this.config = this.validateAndMerge({ ...this.config, ...partial });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    } catch {
      // Ignore
    }
    this.notify();
  }

  public reset(): void {
    this.config = { ...DEFAULT_LIVE_CONFIG };
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
    this.notify();
  }

  public subscribe(listener: (config: LiveGameConfig) => void): () => void {
    this.listeners.add(listener);
    listener(this.config);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener(this.config));
  }
}

export const liveConfigManager = new LiveConfigManager();
