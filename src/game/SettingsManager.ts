export type GraphicsQuality = 'low' | 'medium' | 'high';
export type ReticleStyle = 'dot' | 'crosshair';
export type ReticlePosition = 'center';

export interface GameSettings {
  volume: number; // 0 to 100
  graphics: GraphicsQuality;
  aimAssist: boolean;
  reticleStyle: ReticleStyle;
  reticlePosition?: ReticlePosition;
  cameraSensitivity: number; // 0.5 to 2.0 (default 1.0)
  cameraShake: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = {
  volume: 75,
  graphics: 'high',
  aimAssist: true,
  reticleStyle: 'dot',
  reticlePosition: 'center',
  cameraSensitivity: 1.0,
  cameraShake: true,
};

const SETTINGS_STORAGE_KEY = 'stickman_settings_v2';
const LEGACY_SETTINGS_KEY = 'stickman_settings';

function validateSettings(raw: Partial<GameSettings>): GameSettings {
  const next = { ...DEFAULT_SETTINGS, ...raw };
  next.volume = Math.max(0, Math.min(100, Number(next.volume) || 0));
  next.cameraSensitivity = Math.max(0.25, Math.min(3, Number(next.cameraSensitivity) || 1));
  next.graphics = ['low', 'medium', 'high'].includes(next.graphics) ? next.graphics : 'high';
  next.reticleStyle = next.reticleStyle === 'crosshair' ? 'crosshair' : 'dot';
  next.reticlePosition = 'center';
  next.aimAssist = Boolean(next.aimAssist);
  next.cameraShake = Boolean(next.cameraShake);
  return next;
}

class SettingsManager {
  private settings: GameSettings;
  private listeners: Set<(settings: GameSettings) => void> = new Set();

  constructor() {
    this.settings = { ...DEFAULT_SETTINGS };
    try {
      const saved =
        localStorage.getItem(SETTINGS_STORAGE_KEY) ||
        sessionStorage.getItem(LEGACY_SETTINGS_KEY);
      if (saved) {
        this.settings = validateSettings(JSON.parse(saved));
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.settings));
      }
    } catch {
      // Fallback to defaults
    }
  }

  public get(): GameSettings {
    return { ...this.settings };
  }

  public update(partial: Partial<GameSettings>): void {
    this.settings = validateSettings({ ...this.settings, ...partial });
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // Ignore
    }
    this.listeners.forEach((listener) => listener(this.settings));
  }

  public reset(): void {
    this.settings = { ...DEFAULT_SETTINGS };
    try {
      localStorage.removeItem(SETTINGS_STORAGE_KEY);
    } catch {
      // Ignore
    }
    this.listeners.forEach((listener) => listener(this.settings));
  }

  public subscribe(listener: (settings: GameSettings) => void): () => void {
    this.listeners.add(listener);
    listener(this.settings);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const settingsManager = new SettingsManager();
