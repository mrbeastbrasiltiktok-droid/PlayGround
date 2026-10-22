/**
 * Generated defaults for exported builds.
 *
 * The in-game project exporter replaces this file with the latest live
 * configuration when a ZIP is downloaded. The checked-in version is a no-op.
 */

import { liveConfigManager } from '../LiveConfigManager';
import { settingsManager } from '../SettingsManager';
import { updateAgathaConfig } from '../abilities/agatha/AgathaConfig';
import { updateIronManConfig } from '../abilities/ironman/IronManConfig';

export interface BuildScriptOverridesData {
  exportedAt?: string;
  liveConfig?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  agatha?: Record<string, unknown>;
  ironman?: Record<string, unknown>;
}

export const BUILD_SCRIPT_OVERRIDES: BuildScriptOverridesData = {};

export function applyBuildScriptOverrides(): void {
  const overrides = BUILD_SCRIPT_OVERRIDES;
  if (!overrides || Object.keys(overrides).length === 0) return;

  try {
    if (overrides.liveConfig && !localStorage.getItem('stickman_live_game_config')) {
      liveConfigManager.update(overrides.liveConfig as never);
    }
    if (overrides.settings && !localStorage.getItem('stickman_settings_v2')) {
      settingsManager.update(overrides.settings as never);
    }
    if (overrides.agatha && !localStorage.getItem('stickman_agatha_config_v2')) {
      updateAgathaConfig(overrides.agatha as never);
    }
    if (overrides.ironman && !localStorage.getItem('stickman_ironman_config_v2')) {
      updateIronManConfig(overrides.ironman as never);
    }
  } catch (error) {
    console.warn('[BuildScriptOverrides] Failed to apply exported defaults:', error);
  }
}
