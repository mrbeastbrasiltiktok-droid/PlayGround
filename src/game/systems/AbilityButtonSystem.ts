export type PowerSet = 'classic' | 'ironman' | 'agatha';

export type AbilityIcon =
  | 'flame'
  | 'shield'
  | 'zap'
  | 'sparkles'
  | 'sword'
  | 'rocket'
  | 'crosshair'
  | 'orbit'
  | 'wind';

export interface AbilityButtonDefinition {
  id: number;
  name: string;
  icon: AbilityIcon;
  cooldownTotal: number;
}

const ABILITY_BUTTONS: Record<PowerSet, AbilityButtonDefinition[]> = {
  agatha: [
    { id: 1, name: 'Drenagem Sombria', icon: 'zap', cooldownTotal: 7.0 },
    { id: 2, name: 'Orbe do Caos', icon: 'orbit', cooldownTotal: 5.0 },
    { id: 3, name: 'Barreira Rúnica', icon: 'shield', cooldownTotal: 8.0 },
    { id: 4, name: 'Estrangulamento Arcano', icon: 'crosshair', cooldownTotal: 9.0 },
  ],
  ironman: [
    { id: 1, name: 'Missile Volley', icon: 'rocket', cooldownTotal: 6.0 },
    { id: 2, name: 'Dual Beam & Clash', icon: 'flame', cooldownTotal: 10.0 },
    { id: 3, name: 'Unibeam Blast', icon: 'crosshair', cooldownTotal: 8.0 },
    { id: 4, name: 'Spinning Lasers', icon: 'orbit', cooldownTotal: 12.0 },
  ],
  classic: [
    { id: 1, name: 'Flame Burst', icon: 'flame', cooldownTotal: 4.0 },
    { id: 2, name: 'Shield Ward', icon: 'shield', cooldownTotal: 6.0 },
    { id: 3, name: 'Thunder Shock', icon: 'zap', cooldownTotal: 3.5 },
    { id: 4, name: 'Arcane Nova', icon: 'sparkles', cooldownTotal: 5.0 },
  ],
};

export const DASH_COOLDOWN = 2.2;

export function getAbilityButtons(powerSet: PowerSet): AbilityButtonDefinition[] {
  return ABILITY_BUTTONS[powerSet];
}

export function getAttackCooldown(powerSet: PowerSet): number {
  if (powerSet === 'agatha') return 0.22;
  if (powerSet === 'ironman') return 0.2;
  return 0.42;
}

export function supportsFlight(powerSet: PowerSet): boolean {
  return powerSet === 'ironman' || powerSet === 'agatha';
}
