import type { ProjectScriptInfo } from './RealProjectScripts';

export type ExplorerIcon =
  | 'root'
  | 'folder'
  | 'character'
  | 'ability'
  | 'controller'
  | 'system'
  | 'flight'
  | 'combat'
  | 'animation'
  | 'sound'
  | 'vfx'
  | 'movement'
  | 'cooldown'
  | 'restrictions'
  | 'world'
  | 'script'
  | 'config'
  | 'ui'
  | 'modal'
  | 'device';

export interface ExplorerNode {
  id: string;
  label: string;
  kind: 'folder' | 'script';
  icon: ExplorerIcon;
  scriptId?: string;
  children?: ExplorerNode[];
  defaultExpanded?: boolean;
  searchText: string;
}

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export function buildScriptExplorerTree(scripts: ProjectScriptInfo[]): ExplorerNode {
  const byId = new Map(scripts.map((script) => [script.id, script]));
  const used = new Set<string>();

  const scriptNode = (id: string, label?: string, icon: ExplorerIcon = 'script'): ExplorerNode | null => {
    const script = byId.get(id);
    if (!script) return null;
    used.add(id);
    const text = [label, script.name, script.filePath, script.summary, ...(script.keywords || [])].join(' ');
    return {
      id: `script:${id}`,
      label: label || script.filePath.split('/').pop() || script.name,
      kind: 'script',
      icon,
      scriptId: id,
      searchText: normalize(text),
    };
  };

  const folder = (
    id: string,
    label: string,
    icon: ExplorerIcon,
    children: Array<ExplorerNode | null>,
    defaultExpanded = false
  ): ExplorerNode => {
    const resolved = children.filter((child): child is ExplorerNode => child !== null);
    return {
      id: `folder:${id}`,
      label,
      kind: 'folder',
      icon,
      children: resolved,
      defaultExpanded,
      searchText: normalize(`${label} ${resolved.map((child) => child.searchText).join(' ')}`),
    };
  };

  const characters = folder(
    'characters',
    'Characters',
    'character',
    [
      folder(
        'agatha',
        'Agatha',
        'character',
        [
          scriptNode('agatha-config', 'AgathaConfig', 'config'),
          folder(
            'agatha-abilities-folder',
            'Habilidades',
            'ability',
            [
              scriptNode('agatha-arcane-blast', 'ArcaneBlast', 'ability'),
              scriptNode('agatha-dark-drain', 'DarkDrain', 'ability'),
              scriptNode('agatha-chaos-orb', 'ChaosOrb', 'ability'),
              scriptNode('agatha-runic-ward', 'RunicWard', 'ability'),
              scriptNode('agatha-choke', 'TelekineticChoke', 'ability'),
              scriptNode('agatha-shadow-step', 'ShadowStep', 'ability'),
            ],
            true
          ),
          scriptNode('agatha-abilities', 'AgathaAbilities', 'controller'),
        ],
        true
      ),
      folder(
        'ironman',
        'IronMan',
        'character',
        [
          scriptNode('ironman-config', 'IronManConfig', 'config'),
          folder(
            'ironman-abilities-folder',
            'Habilidades',
            'ability',
            [
              scriptNode('ironman-repulsor', 'Repulsor', 'ability'),
              scriptNode('ironman-micro-missiles', 'MicroMissiles', 'ability'),
              scriptNode('ironman-unibeam', 'Unibeam', 'ability'),
            ],
            true
          ),
          scriptNode('ironman-abilities', 'IronManAbilities', 'controller'),
        ],
        true
      ),
    ],
    true
  );

  const systems = folder(
    'systems',
    'Systems',
    'system',
    [
      folder(
        'flight-system-folder',
        'FlightSystem',
        'flight',
        [
          scriptNode('flight-system', 'FlightSystem', 'flight'),
          scriptNode('agatha-flight-profile', 'AgathaFlightProfile', 'config'),
          scriptNode('ironman-flight-profile', 'IronManFlightProfile', 'config'),
        ],
        true
      ),
      folder('combat-system', 'Combat', 'combat', [
        scriptNode('deal-damage', 'DealDamage', 'combat'),
        scriptNode('target-dummy', 'TargetDummy', 'combat'),
        scriptNode('projectile-system', 'ProjectileSystem', 'vfx'),
      ], true),
      folder('animation-system', 'AnimationSystem', 'animation', [
        scriptNode('animation-controller', 'AnimationController', 'animation'),
      ]),
      folder('sound-system', 'SoundSystem', 'sound', [
        scriptNode('audio-system', 'AudioSystem', 'sound'),
      ]),
      folder('vfx-system-folder', 'VFXSystem', 'vfx', [
        scriptNode('vfx-system', 'VFXSystem', 'vfx'),
      ]),
      folder('ability-buttons-system', 'AbilityButtonSystem', 'ui', [
        scriptNode('combat-buttons', 'CombatButtons', 'ui'),
      ]),
      folder('movement-system', 'MovementSystem', 'movement', [
        scriptNode('movement-system', 'MovementSystem', 'movement'),
      ]),
      folder('cooldown-system', 'CooldownSystem', 'cooldown', [
        scriptNode('cooldown-system', 'CooldownSystem', 'cooldown'),
      ]),
      folder('restrictions-system', 'GameplayRestrictionsSystem', 'restrictions', [
        scriptNode('gameplay-restrictions', 'GameplayRestrictions', 'restrictions'),
      ]),
      folder(
        'world-system',
        'WorldSystem',
        'world',
        [
          scriptNode('game-scene', 'GameScene', 'world'),
          scriptNode('stickman-rig', 'StickmanRig', 'world'),
        ],
        true
      ),
      folder('configuration', 'Configuration', 'config', [
        scriptNode('settings-manager', 'SettingsManager', 'config'),
        scriptNode('live-config-manager', 'LiveConfigManager', 'config'),
        scriptNode('build-mode-manager', 'BuildModeManager', 'config'),
      ]),
    ],
    true
  );

  const interfaceGroup = folder(
    'interface',
    'Interface',
    'ui',
    [
      folder('hud-input', 'HUD & Input', 'ui', [
        scriptNode('aim-reticle', 'AimReticle', 'ui'),
        scriptNode('virtual-joystick', 'VirtualJoystick', 'ui'),
        scriptNode('beam-clash-banner', 'BeamClashBanner', 'ui'),
      ], true),
      folder('modals', 'Modals', 'modal', [
        scriptNode('power-select-modal', 'PowerSelectModal', 'modal'),
        scriptNode('settings-modal', 'SettingsModal', 'modal'),
      ]),
      folder('device', 'Device', 'device', [
        scriptNode('orientation-guard', 'OrientationGuard', 'device'),
      ]),
    ],
    true
  );

  const ungrouped = scripts
    .filter((script) => !used.has(script.id))
    .map((script) => scriptNode(script.id))
    .filter((node): node is ExplorerNode => node !== null);

  const children = [characters, systems, interfaceGroup];
  if (ungrouped.length > 0) {
    children.push(folder('other', 'Outros', 'folder', ungrouped));
  }

  return {
    id: 'root:scripts',
    label: 'Scripts',
    kind: 'folder',
    icon: 'root',
    children,
    defaultExpanded: true,
    searchText: normalize(
      `scripts ${children.map((child) => child.searchText).join(' ')}`
    ),
  };
}

export function filterExplorerTree(
  node: ExplorerNode,
  query: string,
  group: string
): ExplorerNode | null {
  const q = normalize(query.trim());

  if (node.kind === 'script') {
    return !q || node.searchText.includes(q) ? node : null;
  }

  if (node.id === 'root:scripts' && group !== 'all') {
    const children = (node.children || [])
      .filter((child) => child.id === `folder:${group}`)
      .map((child) => filterExplorerTree(child, query, 'all'))
      .filter((child): child is ExplorerNode => child !== null);
    return { ...node, children };
  }

  if (q && node.searchText.includes(q) && node.kind === 'folder') {
    return node;
  }

  const children = (node.children || [])
    .map((child) => filterExplorerTree(child, query, 'all'))
    .filter((child): child is ExplorerNode => child !== null);

  if (q && children.length === 0) return null;
  return { ...node, children };
}

export function collectExpandedDefaults(node: ExplorerNode): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  const visit = (current: ExplorerNode) => {
    if (current.kind === 'folder' && current.defaultExpanded) {
      result[current.id] = true;
    }
    current.children?.forEach(visit);
  };
  visit(node);
  return result;
}
