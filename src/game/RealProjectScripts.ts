/**
 * RealProjectScripts.ts
 * Authentic Project Scripts Catalog & Code Hierarchy.
 * Uses Vite ?raw imports to load authentic, un-truncated source files directly.
 */

// Individual Agatha Abilities & Config
import agathaConfigSource from './abilities/agatha/AgathaConfig.ts?raw';
import agathaFlightSource from './abilities/agatha/AgathaFlight.ts?raw';
import agathaArcaneBlastSource from './abilities/agatha/AgathaArcaneBlast.ts?raw';
import agathaDarkDrainSource from './abilities/agatha/AgathaDarkDrain.ts?raw';
import agathaChaosOrbSource from './abilities/agatha/AgathaChaosOrb.ts?raw';
import agathaRunicWardSource from './abilities/agatha/AgathaRunicWard.ts?raw';
import agathaTelekineticChokeSource from './abilities/agatha/AgathaTelekineticChoke.ts?raw';
import agathaShadowStepSource from './abilities/agatha/AgathaShadowStep.ts?raw';
import agathaAbilitiesSource from './AgathaAbilities.ts?raw';

// Individual Iron Man Abilities & Config
import ironManConfigSource from './abilities/ironman/IronManConfig.ts?raw';
import ironManRepulsorSource from './abilities/ironman/IronManRepulsor.ts?raw';
import ironManMicroMissilesSource from './abilities/ironman/IronManMicroMissiles.ts?raw';
import ironManUnibeamSource from './abilities/ironman/IronManUnibeam.ts?raw';
import ironManDualBeamSource from './abilities/ironman/IronManDualBeam.ts?raw';
import ironManBeamClashSource from './abilities/ironman/IronManBeamClash.ts?raw';
import ironManSpinningLasersSource from './abilities/ironman/IronManSpinningLasers.ts?raw';
import ironManFlightSource from './abilities/ironman/IronManFlight.ts?raw';
import ironManAbilitiesSource from './IronManAbilities.ts?raw';

// Shared flight architecture (physics, activation, animation, VFX, config)
import flightSystemSource from './systems/flight/FlightSystem.ts?raw';
import flightConfigSource from './systems/flight/CharacterFlightConfig.ts?raw';
import flightAbilitySource from './systems/flight/CharacterFlightAbility.ts?raw';
import flightAnimationSource from './systems/flight/CharacterFlightAnimation.ts?raw';
import flightVfxSource from './systems/flight/CharacterFlightVFX.ts?raw';

// Centralized Restrictions & Core Game Systems
import gameplayRestrictionsSource from './GameplayRestrictions.ts?raw';
import targetDummySource from './TargetDummy.ts?raw';
import projectileSource from './ProjectileSystem.ts?raw';
import stickmanRigSource from './StickmanRig.ts?raw';
import animControllerSource from './AnimationController.ts?raw';
import gameSceneSource from './GameScene.ts?raw';
import audioSystemSource from './AudioSystem.ts?raw';

// HUD & Interface Components
import combatButtonsSource from '../components/CombatButtons.tsx?raw';
import virtualJoystickSource from '../components/VirtualJoystick.tsx?raw';
import aimReticleSource from '../components/AimReticle.tsx?raw';
import beamClashBannerSource from '../components/BeamClashBanner.tsx?raw';
import powerSelectModalSource from '../components/PowerSelectModal.tsx?raw';
import settingsModalSource from '../components/SettingsModal.tsx?raw';
import orientationGuardSource from '../components/OrientationGuard.tsx?raw';

// Shared singletons (inspectable; rebuild required for changes)
import settingsManagerSource from './SettingsManager.ts?raw';
import liveConfigManagerSource from './LiveConfigManager.ts?raw';
import buildModeManagerSource from './BuildModeManager.ts?raw';

// Shared runtime systems (structural; imported directly by the game)
import damageSystemSource from './systems/DamageSystem.ts?raw';
import healthSystemSource from './systems/HealthSystem.ts?raw';
import collisionSystemSource from './systems/CollisionSystem.ts?raw';
import targetingSystemSource from './systems/TargetingSystem.ts?raw';
import cameraSystemSource from './systems/CameraSystem.ts?raw';
import cooldownSystemSource from './systems/CooldownSystem.ts?raw';
import vfxSystemSource from './systems/VFXSystem.ts?raw';

// Editor, HUD shell and application entry
import appSource from '../App.tsx?raw';
import buildTypesSource from './BuildTypes.ts?raw';
import buildModeContainerSource from '../components/BuildMode/BuildModeContainer.tsx?raw';
import configPanelSource from '../components/BuildMode/ConfigPanel.tsx?raw';
import buildToastSource from '../components/BuildMode/BuildToast.tsx?raw';

// Internal tooling (inspectable only; never hot-swapped)
import scriptRuntimeEngineSource from './ScriptRuntimeEngine.ts?raw';
import scriptPersistenceSource from './ScriptPersistence.ts?raw';
import appliedScriptStoreSource from './AppliedScriptStore.ts?raw';
import scriptSearchSource from './ScriptSearch.ts?raw';
import projectExporterSource from './ProjectExporter.ts?raw';
import buildModeDefaultsSource from './generated/BuildModeDefaults.ts?raw';
import buildScriptOverridesSource from './generated/BuildScriptOverrides.ts?raw';

export type ScriptCategory =
  | 'Configurações'
  | 'Habilidades'
  | 'Voo'
  | 'Controladores'
  | 'Restrições'
  | 'Combate'
  | 'Interface & HUD'
  | 'Sistemas'
  | 'Editor & Ferramentas';

export type RuntimeIntegration = 'hot-swap' | 'restart-required' | 'read-only';

export interface ProjectScriptInfo {
  id: string;
  name: string;
  filePath: string;
  category: ScriptCategory;
  summary: string;
  originalSource: string;
  fileExtension: 'ts' | 'tsx';
  dependencies: string[];
  character?: 'agatha' | 'ironman' | 'shared';
  isUserCreated?: boolean;
  runtimeIntegration?: RuntimeIntegration;
  keywords?: string[];
}

/**
 * Returns the source that was genuinely applied to the runtime.
 * Drafts are intentionally ignored here: showing a draft as "effective" is
 * what made the old editor report edits that the game never executed.
 */
export function getEffectiveScriptSource(scriptId: string, defaultSource: string): string {
  try {
    const saved =
      localStorage.getItem(`script_applied_${scriptId}`) ||
      localStorage.getItem(`script_source_${scriptId}`);
    if (saved) return saved;
  } catch {
    // ignore
  }
  return defaultSource;
}

export const SCRIPT_TABS: { id: ScriptCategory; label: string }[] = [
  { id: 'Habilidades', label: 'Habilidades' },
  { id: 'Voo', label: 'Voo & Física Aérea' },
  { id: 'Configurações', label: 'Configurações' },
  { id: 'Controladores', label: 'Controladores' },
  { id: 'Restrições', label: 'Restrições & Status' },
  { id: 'Combate', label: 'Combate & Física' },
  { id: 'Interface & HUD', label: 'Interface & HUD' },
  { id: 'Sistemas', label: 'Sistemas Globais' },
  { id: 'Editor & Ferramentas', label: 'Editor & Ferramentas' },
];

export const PROJECT_SCRIPTS: ProjectScriptInfo[] = [
  // ==========================================
  // 1. HABILIDADES INDIVIDUAIS (Agatha Harkness)
  // ==========================================
  {
    id: 'agatha-arcane-blast',
    name: 'Rajada Arcana (Ataque Básico)',
    filePath: '/src/game/abilities/agatha/AgathaArcaneBlast.ts',
    category: 'Habilidades',
    character: 'agatha',
    summary:
      'Disparo de projéteis arcanos alternados entre as mãos com trajetória de teleguiamento (homing), brilho violeta profundo e impacto sonoro.',
    originalSource: agathaArcaneBlastSource,
    fileExtension: 'ts',
    dependencies: ['AgathaConfig', 'TargetDummy', 'StickmanRig', 'AudioSystem'],
    keywords: ['agatha', 'arcano', 'rajada', 'ataque', 'basico', 'arcane', 'blast', 'projetil', 'homing'],
  },
  {
    id: 'agatha-dark-drain',
    name: 'Dreno Sombrio (Habilidade 1)',
    filePath: '/src/game/abilities/agatha/AgathaDarkDrain.ts',
    category: 'Habilidades',
    character: 'agatha',
    summary:
      'Canalização de tentáculos de sifão de vida com duração de 3 segundos. Aplica restrições autênticas Anchored e NoFlight e drena alvos próximos.',
    originalSource: agathaDarkDrainSource,
    fileExtension: 'ts',
    dependencies: ['AgathaConfig', 'TargetDummy', 'GameplayRestrictions', 'AudioSystem'],
    keywords: ['agatha', 'dreno', 'sombrio', 'drain', 'sifao', 'vida', 'dark'],
  },
  {
    id: 'agatha-chaos-orb',
    name: 'Orbe do Caos (Habilidade 2)',
    filePath: '/src/game/abilities/agatha/AgathaChaosOrb.ts',
    category: 'Habilidades',
    character: 'agatha',
    summary:
      'Esfera mágica lenta e massiva que detona em impacto ou alcance máximo, gerando uma onda de choque radial com dano em área (AoE).',
    originalSource: agathaChaosOrbSource,
    fileExtension: 'ts',
    dependencies: ['AgathaConfig', 'TargetDummy', 'AudioSystem'],
    keywords: ['agatha', 'orbe', 'caos', 'chaos', 'orb', 'aoe', 'explosao'],
  },
  {
    id: 'agatha-runic-ward',
    name: 'Escudo Rúnico (Habilidade 3)',
    filePath: '/src/game/abilities/agatha/AgathaRunicWard.ts',
    category: 'Habilidades',
    character: 'agatha',
    summary:
      'Barreira de proteção icosaédrica com anéis rúnicos que repele inimigos no lançamento e aplica a restrição genuína IsShield para mitigação de dano.',
    originalSource: agathaRunicWardSource,
    fileExtension: 'ts',
    dependencies: ['AgathaConfig', 'TargetDummy', 'GameplayRestrictions', 'AudioSystem'],
    keywords: ['agatha', 'escudo', 'runic', 'ward', 'shield', 'barreira'],
  },
  {
    id: 'agatha-choke',
    name: 'Estrangulamento Telecinético (Habilidade 4)',
    filePath: '/src/game/abilities/agatha/AgathaTelekineticChoke.ts',
    category: 'Habilidades',
    character: 'agatha',
    summary:
      'Prende o boneco alvo em suspensão telecinética com cordões de energia e anel cervical, aplicando Stunned, Anchored e NoMovement com dano contínuo.',
    originalSource: agathaTelekineticChokeSource,
    fileExtension: 'ts',
    dependencies: ['AgathaConfig', 'TargetDummy', 'GameplayRestrictions', 'AudioSystem'],
    keywords: ['agatha', 'estrangulamento', 'telecinetico', 'choke', 'stun', 'status'],
  },
  {
    id: 'agatha-shadow-step',
    name: 'Passo das Sombras (Esquiva / Dash)',
    filePath: '/src/game/abilities/agatha/AgathaShadowStep.ts',
    category: 'Habilidades',
    character: 'agatha',
    summary:
      'Teletransporte instantâneo através da dimensão sombria na direção do movimento, respeitando caixas de colisão de estruturas.',
    originalSource: agathaShadowStepSource,
    fileExtension: 'ts',
    dependencies: ['AgathaConfig', 'AudioSystem'],
    keywords: ['agatha', 'passo', 'sombra', 'shadow', 'dash', 'esquiva', 'teleporte'],
  },

  // ==========================================
  // HABILIDADES INDIVIDUAIS (Homem de Ferro)
  // ==========================================
  {
    id: 'ironman-repulsor',
    name: 'Disparo de Repulsor (Ataque Básico)',
    filePath: '/src/game/abilities/ironman/IronManRepulsor.ts',
    category: 'Habilidades',
    character: 'ironman',
    summary:
      'Tiros rápidos de plasma das palmas com recuo físico, teleguiamento dinâmico em alvos travados e faíscas de impacto.',
    originalSource: ironManRepulsorSource,
    fileExtension: 'ts',
    dependencies: ['IronManConfig', 'TargetDummy', 'AudioSystem'],
    keywords: ['ironman', 'homem de ferro', 'repulsor', 'ataque', 'basico', 'projetil'],
  },
  {
    id: 'ironman-micro-missiles',
    name: 'Salva de Micro-mísseis (Habilidade 1)',
    filePath: '/src/game/abilities/ironman/IronManMicroMissiles.ts',
    category: 'Habilidades',
    character: 'ironman',
    summary:
      'Disparo de micro-mísseis guiados que sobem em arco vertical antes de mergulhar em direção ao alvo inimigo.',
    originalSource: ironManMicroMissilesSource,
    fileExtension: 'ts',
    dependencies: ['IronManConfig', 'TargetDummy', 'AudioSystem'],
    keywords: ['ironman', 'missil', 'misseis', 'missile', 'volley', 'salva'],
  },
  {
    id: 'ironman-unibeam',
    name: 'Canhão Unibeam (Habilidade 3)',
    filePath: '/src/game/abilities/ironman/IronManUnibeam.ts',
    category: 'Habilidades',
    character: 'ironman',
    summary:
      'Raio concentrado de altíssima energia disparado a partir do Reator Arc do peito com grande impulso e impacto visual.',
    originalSource: ironManUnibeamSource,
    fileExtension: 'ts',
    dependencies: ['IronManConfig', 'TargetDummy', 'AudioSystem'],
    keywords: ['ironman', 'unibeam', 'raio', 'peito', 'beam', 'dano'],
  },
  {
    id: 'ironman-dual-beam',
    name: 'Feixes Duplos & Duelo de Feixes (Habilidade 2)',
    filePath: '/src/game/abilities/ironman/IronManDualBeam.ts',
    category: 'Habilidades',
    character: 'ironman',
    summary:
      'Dois feixes contínuos das palmas com dano por tick, rastreamento de alvo e minigame Beam Clash quando o alvo rival responde com um feixe oposto.',
    originalSource: ironManDualBeamSource,
    fileExtension: 'ts',
    dependencies: ['IronManConfig', 'IronManBeamClash', 'TargetDummy', 'AudioSystem'],
    runtimeIntegration: 'restart-required',
    keywords: ['ironman', 'feixe', 'beam', 'duplo', 'dual', 'clash', 'duelo'],
  },
  {
    id: 'ironman-beam-clash',
    name: 'Minigame Beam Clash (Duelo de Feixes)',
    filePath: '/src/game/abilities/ironman/IronManBeamClash.ts',
    category: 'Habilidades',
    character: 'ironman',
    summary:
      'Estado e efeitos visuais do duelo de feixes: progresso oscilante, toques para empurrar, temporizador de 6 segundos e resolução com dano, explosão e cooldown rival.',
    originalSource: ironManBeamClashSource,
    fileExtension: 'ts',
    dependencies: ['TargetDummy', 'AudioSystem'],
    runtimeIntegration: 'restart-required',
    keywords: ['ironman', 'beam', 'clash', 'duelo', 'feixes', 'minigame'],
  },
  {
    id: 'ironman-spinning-lasers',
    name: 'Lasers Giratórios (Habilidade 4)',
    filePath: '/src/game/abilities/ironman/IronManSpinningLasers.ts',
    category: 'Habilidades',
    character: 'ironman',
    summary:
      'Quatro lasers rotativos que giram 720° ao redor do personagem, atingindo cada alvo uma única vez por ativação com duração configurável.',
    originalSource: ironManSpinningLasersSource,
    fileExtension: 'ts',
    dependencies: ['IronManConfig', 'TargetDummy', 'AudioSystem'],
    runtimeIntegration: 'restart-required',
    keywords: ['ironman', 'laser', 'lasers', 'giratorio', 'spin', 'aoe'],
  },

  // ==========================================
  // 1b. VOO & FÍSICA AÉREA (Arquitetura Compartilhada)
  // ==========================================
  {
    id: 'flight-config',
    name: 'Configuração de Voo por Personagem',
    filePath: '/src/game/systems/flight/CharacterFlightConfig.ts',
    category: 'Voo',
    summary:
      'Perfis editáveis de voo (Homem de Ferro, Agatha e clássico): hover, altitude máxima, velocidade, aceleração, resposta de curva, gravidade, estilo visual e duração.',
    originalSource: flightConfigSource,
    fileExtension: 'ts',
    dependencies: [],
    runtimeIntegration: 'hot-swap',
    keywords: ['voo', 'flight', 'config', 'perfil', 'hover', 'altitude', 'velocidade'],
  },
  {
    id: 'flight-system',
    name: 'Sistema Central de Voo',
    filePath: '/src/game/systems/flight/FlightSystem.ts',
    category: 'Voo',
    summary:
      'Física única de voo: ativação, subida/descida, hover, aterrissagem suave, limites de altitude, colisão com tetos e duração máxima por perfil.',
    originalSource: flightSystemSource,
    fileExtension: 'ts',
    dependencies: ['CharacterFlightConfig', 'CollisionSystem'],
    runtimeIntegration: 'restart-required',
    keywords: ['voo', 'flight', 'sistema', 'fisica', 'altitude', 'aterrissagem'],
  },
  {
    id: 'flight-ability',
    name: 'Ativação de Voo & Restrições',
    filePath: '/src/game/systems/flight/CharacterFlightAbility.ts',
    category: 'Voo',
    summary:
      'Camada de ativação por personagem com bloqueios NoFlight/Stunned, interrupção, pulo de jump pads e eventos de início/fim de voo.',
    originalSource: flightAbilitySource,
    fileExtension: 'ts',
    dependencies: ['FlightSystem', 'CharacterFlightConfig', 'GameplayRestrictions'],
    runtimeIntegration: 'restart-required',
    keywords: ['voo', 'flight', 'ativacao', 'restricoes', 'stun', 'jump pad'],
  },
  {
    id: 'flight-animation',
    name: 'Animação de Voo',
    filePath: '/src/game/systems/flight/CharacterFlightAnimation.ts',
    category: 'Voo',
    summary:
      'Pose procedural de voo com estilo repulsor (Homem de Ferro) ou arcano (Agatha), incluindo inclinação, pernas, braços e resposta à velocidade.',
    originalSource: flightAnimationSource,
    fileExtension: 'ts',
    dependencies: ['StickmanRig', 'CharacterFlightConfig'],
    runtimeIntegration: 'restart-required',
    keywords: ['voo', 'flight', 'animacao', 'pose', 'repulsor', 'arcano'],
  },
  {
    id: 'flight-vfx',
    name: 'Efeitos Visuais de Voo',
    filePath: '/src/game/systems/flight/CharacterFlightVFX.ts',
    category: 'Voo',
    summary:
      'Propulsores das mãos/pés com intensidade dinâmica ou aura arcana de partículas, reagindo a dash, velocidade e cor personalizada.',
    originalSource: flightVfxSource,
    fileExtension: 'ts',
    dependencies: ['StickmanRig', 'VFXSystem', 'CharacterFlightConfig'],
    runtimeIntegration: 'restart-required',
    keywords: ['voo', 'flight', 'vfx', 'thruster', 'aura', 'particulas'],
  },
  {
    id: 'ironman-flight',
    name: 'Voo do Homem de Ferro',
    filePath: '/src/game/abilities/ironman/IronManFlight.ts',
    category: 'Voo',
    character: 'ironman',
    summary:
      'Identidade de voo repulsor do Homem de Ferro, conectando o FlightSystem compartilhado ao áudio de propulsores e ao estilo de animação.',
    originalSource: ironManFlightSource,
    fileExtension: 'ts',
    dependencies: ['FlightSystem', 'CharacterFlightAbility', 'AudioSystem'],
    runtimeIntegration: 'restart-required',
    keywords: ['ironman', 'voo', 'flight', 'repulsor', 'propulsor'],
  },
  {
    id: 'agatha-flight',
    name: 'Voo Arcano da Agatha',
    filePath: '/src/game/abilities/agatha/AgathaFlight.ts',
    category: 'Voo',
    character: 'agatha',
    summary:
      'Identidade de voo arcano da Agatha, usando o FlightSystem compartilhado com áudio mágico e sinalização de levitação para as habilidades.',
    originalSource: agathaFlightSource,
    fileExtension: 'ts',
    dependencies: ['FlightSystem', 'CharacterFlightAbility', 'AudioSystem'],
    runtimeIntegration: 'restart-required',
    keywords: ['agatha', 'voo', 'flight', 'arcano', 'levitacao'],
  },

  // ==========================================
  // 2. CONFIGURAÇÕES AJUSTÁVEIS (Parâmetros)
  // ==========================================
  {
    id: 'agatha-config',
    name: 'Configuração de Poderes da Agatha',
    filePath: '/src/game/abilities/agatha/AgathaConfig.ts',
    category: 'Configurações',
    character: 'agatha',
    summary:
      'Parâmetros numéricos editáveis: dano do Rajada Arcana, dps do Dreno Sombrio, raio de explosão do Orbe do Caos, vida do Escudo e cooldowns.',
    originalSource: agathaConfigSource,
    fileExtension: 'ts',
    dependencies: [],
    keywords: ['agatha', 'configuracao', 'config', 'dano', 'cooldown', 'parametros'],
  },
  {
    id: 'ironman-config',
    name: 'Configuração de Armas do Homem de Ferro',
    filePath: '/src/game/abilities/ironman/IronManConfig.ts',
    category: 'Configurações',
    character: 'ironman',
    summary:
      'Parâmetros numéricos editáveis: dano e velocidade do repulsor, contagem de mísseis, potência do Unibeam e duração dos feixes duplos.',
    originalSource: ironManConfigSource,
    fileExtension: 'ts',
    dependencies: [],
    keywords: ['ironman', 'configuracao', 'config', 'dano', 'cooldown', 'parametros'],
  },

  // ==========================================
  // 3. CONTROLADORES DE PERSONAGEM
  // ==========================================
  {
    id: 'agatha-abilities',
    name: 'Controlador de Agatha Harkness',
    filePath: '/src/game/AgathaAbilities.ts',
    category: 'Controladores',
    character: 'agatha',
    summary:
      'Coordenador principal que gerencia o ciclo de vida, instanciação e disparo de todas as habilidades mágicas da Agatha no jogo.',
    originalSource: agathaAbilitiesSource,
    fileExtension: 'ts',
    dependencies: ['StickmanRig', 'TargetDummy', 'AudioSystem', 'GameplayRestrictions'],
    keywords: ['agatha', 'controlador', 'controller', 'habilidades', 'poderes'],
  },
  {
    id: 'ironman-abilities',
    name: 'Controlador de Armadura Homem de Ferro',
    filePath: '/src/game/IronManAbilities.ts',
    category: 'Controladores',
    character: 'ironman',
    summary:
      'Coordenador de armas do Homem de Ferro: feixes contínuos, micro-mísseis, Unibeam, lasers giratórios e o minigame Beam Clash.',
    originalSource: ironManAbilitiesSource,
    fileExtension: 'ts',
    dependencies: [
      'IronManRepulsor',
      'IronManMicroMissiles',
      'IronManUnibeam',
      'IronManDualBeam',
      'IronManBeamClash',
      'IronManSpinningLasers',
      'IronManConfig',
      'TargetDummy',
      'AudioSystem',
    ],
    keywords: ['ironman', 'homem de ferro', 'controlador', 'controller', 'armas'],
  },
  {
    id: 'animation-controller',
    name: 'Controlador de Cinemática & Animações',
    filePath: '/src/game/AnimationController.ts',
    category: 'Controladores',
    summary:
      'Orquestra a locomoção procedural, respiração ociosa, poses de repulsor, levitação mágica da Agatha e inclinação aerodinâmica de voo.',
    originalSource: animControllerSource,
    fileExtension: 'ts',
    dependencies: ['StickmanRig'],
    keywords: ['animacao', 'animation', 'controlador', 'cinematica', 'voo', 'flight'],
  },

  // ==========================================
  // 4. RESTRIÇÕES & STATUS DE GAMEPLAY
  // ==========================================
  {
    id: 'gameplay-restrictions',
    name: 'Sistema de Restrições & Status',
    filePath: '/src/game/GameplayRestrictions.ts',
    category: 'Restrições',
    summary:
      'Sistema centralizado e tipado para aplicação de status: NoPowers, NoMovement, NoFlight, NoBasicAttack, IsShield, Anchored, Invulnerable, Stunned, Silenced.',
    originalSource: gameplayRestrictionsSource,
    fileExtension: 'ts',
    dependencies: [],
    keywords: ['restricoes', 'restrictions', 'status', 'stun', 'invulneravel', 'escudo'],
  },

  // ==========================================
  // 5. COMBATE & FÍSICA
  // ==========================================
  {
    id: 'target-dummy',
    name: 'Boneco de Treino & Alvos',
    filePath: '/src/game/TargetDummy.ts',
    category: 'Combate',
    summary:
      'Alvos de argila com física de mola para recuo, barras de vida billboarded, suporte a Beam Clash rival e aplicação de restrições de invulnerabilidade e escudo.',
    originalSource: targetDummySource,
    fileExtension: 'ts',
    dependencies: ['AudioSystem', 'GameplayRestrictions'],
    keywords: ['alvo', 'target', 'boneco', 'dummy', 'vida', 'dano', 'colisao'],
  },
  {
    id: 'projectile-system',
    name: 'Sistema de Projéteis & Colisões',
    filePath: '/src/game/ProjectileSystem.ts',
    category: 'Combate',
    summary:
      'Trajetórias balísticas clássicas, teleguiamento, projeção de números de dano 3D flutuantes e partículas InstancedMesh.',
    originalSource: projectileSource,
    fileExtension: 'ts',
    dependencies: ['TargetDummy', 'AudioSystem'],
    keywords: ['projetil', 'projectile', 'colisao', 'particulas', 'dano'],
  },

  // ==========================================
  // 6. INTERFACE & HUD
  // ==========================================
  {
    id: 'combat-buttons',
    name: 'HUD de Combate & Botões Touch',
    filePath: '/src/components/CombatButtons.tsx',
    category: 'Interface & HUD',
    summary:
      'Disposição semicircular ergonômica com botão de ataque primário central, 4 habilidades radiais, anéis dinâmicos de cooldown em SVG e esquiva.',
    originalSource: combatButtonsSource,
    fileExtension: 'tsx',
    dependencies: ['AudioSystem'],
    keywords: ['hud', 'botoes', 'combate', 'interface', 'cooldown', 'touch'],
  },
  {
    id: 'aim-reticle',
    name: 'Mira & Marcadores de Travamento',
    filePath: '/src/components/AimReticle.tsx',
    category: 'Interface & HUD',
    summary:
      'Retículo central com colchetes de assistência de mira sobre alvos válidos e confirmação de acerto em X estilo Marvel Rivals.',
    originalSource: aimReticleSource,
    fileExtension: 'tsx',
    dependencies: ['GameScene', 'SettingsManager'],
    keywords: ['mira', 'reticle', 'aim', 'assistencia', 'hud'],
  },
  {
    id: 'virtual-joystick',
    name: 'Joystick Analógico Virtual',
    filePath: '/src/components/VirtualJoystick.tsx',
    category: 'Interface & HUD',
    summary:
      'Controle analógico com base dinâmica na tela sensível ao toque, filtragem de zona morta e vetores normatizados.',
    originalSource: virtualJoystickSource,
    fileExtension: 'tsx',
    dependencies: [],
    keywords: ['joystick', 'controle', 'touch', 'movimento', 'mobile'],
  },
  {
    id: 'beam-clash-banner',
    name: 'Banner do Duelo Beam Clash',
    filePath: '/src/components/BeamClashBanner.tsx',
    category: 'Interface & HUD',
    summary:
      'Medidor cinemático de cabo de guerra com faíscas animadas e prompt de toques rápidos para vencer o confronto de raios.',
    originalSource: beamClashBannerSource,
    fileExtension: 'tsx',
    dependencies: [],
    keywords: ['beam', 'clash', 'banner', 'duelo', 'raio', 'hud'],
  },
  {
    id: 'power-select-modal',
    name: 'Modal de Seleção de Personagem',
    filePath: '/src/components/PowerSelectModal.tsx',
    category: 'Interface & HUD',
    summary:
      'Janela com troca instantânea entre Agatha Harkness, Homem de Ferro e Herói Clássico.',
    originalSource: powerSelectModalSource,
    fileExtension: 'tsx',
    dependencies: ['AudioSystem'],
    keywords: ['personagem', 'selecao', 'modal', 'power', 'agatha', 'ironman'],
  },
  {
    id: 'orientation-guard',
    name: 'Orientação & Tela Cheia (Mobile)',
    filePath: '/src/components/OrientationGuard.tsx',
    category: 'Interface & HUD',
    summary:
      'Aviso de orientação para dispositivos móveis e botão de tela cheia, com escuta de mudanças de orientação e visibilidade.',
    originalSource: orientationGuardSource,
    fileExtension: 'tsx',
    dependencies: [],
    keywords: ['orientacao', 'mobile', 'tela cheia', 'fullscreen', 'girar'],
  },
  {
    id: 'settings-modal',
    name: 'Modal de Configurações de Jogo',
    filePath: '/src/components/SettingsModal.tsx',
    category: 'Interface & HUD',
    summary:
      'Ajustes em tempo real de volume, sensibilidade de câmera, estilo de retículo, assistência de mira e gráficos.',
    originalSource: settingsModalSource,
    fileExtension: 'tsx',
    dependencies: ['SettingsManager', 'AudioSystem'],
    keywords: ['configuracoes', 'settings', 'modal', 'audio', 'camera'],
  },

  // ==========================================
  // 7. SISTEMAS GLOBAIS
  // ==========================================
  {
    id: 'settings-manager',
    name: 'Gerenciador de Configurações',
    filePath: '/src/game/SettingsManager.ts',
    category: 'Sistemas',
    summary:
      'Singleton de configurações persistidas (volume, câmera, gráficos e assistência). Alterações exigem rebuild por ser importado diretamente pela aplicação.',
    originalSource: settingsManagerSource,
    fileExtension: 'ts',
    dependencies: [],
    runtimeIntegration: 'read-only',
    keywords: ['settings', 'configuracoes', 'singleton', 'persistencia'],
  },
  {
    id: 'live-config-manager',
    name: 'Gerenciador de Configuração ao Vivo',
    filePath: '/src/game/LiveConfigManager.ts',
    category: 'Sistemas',
    summary:
      'Singleton de ajustes ao vivo de câmera, combate e sistema, com serialização para o build. Inspeção somente leitura.',
    originalSource: liveConfigManagerSource,
    fileExtension: 'ts',
    dependencies: [],
    runtimeIntegration: 'read-only',
    keywords: ['live config', 'ajustes', 'singleton', 'camera', 'combate'],
  },
  {
    id: 'build-mode-manager',
    name: 'Gerenciador do Modo Construção',
    filePath: '/src/game/BuildModeManager.ts',
    category: 'Sistemas',
    summary:
      'Estado do editor de cena, seleção, transformações, snapshots e exportação de cena. Inspeção somente leitura.',
    originalSource: buildModeManagerSource,
    fileExtension: 'ts',
    dependencies: [],
    runtimeIntegration: 'read-only',
    keywords: ['build mode', 'editor', 'cena', 'transformacao', 'snapshot'],
  },
  {
    id: 'game-scene',
    name: 'Cena Principal Three.js (GameScene)',
    filePath: '/src/game/GameScene.ts',
    category: 'Sistemas',
    summary:
      'Cena 3D completa com loop de renderização a 60 FPS, física, colisão de caixas, iluminação solar sombreada e integração com o motor de scripts.',
    originalSource: gameSceneSource,
    fileExtension: 'ts',
    dependencies: ['AudioSystem', 'SettingsManager', 'GameplayRestrictions'],
    runtimeIntegration: 'restart-required',
    keywords: ['cena', 'scene', 'threejs', 'render', 'fisica', 'camera', 'loop'],
  },
  {
    id: 'stickman-rig',
    name: 'Esqueleto Stickman Articulado R15',
    filePath: '/src/game/StickmanRig.ts',
    category: 'Sistemas',
    summary:
      'Modelo humanoide articulado em porcelana branca com juntas anatômicas e propulsores nas mãos e pés.',
    originalSource: stickmanRigSource,
    fileExtension: 'ts',
    dependencies: [],
    runtimeIntegration: 'restart-required',
    keywords: ['esqueleto', 'rig', 'stickman', 'modelo', 'personagem'],
  },
  {
    id: 'audio-system',
    name: 'Sistema de Áudio Sintético',
    filePath: '/src/game/AudioSystem.ts',
    category: 'Sistemas',
    summary:
      'Sintetizador Web Audio com osciladores e envelopes sem dependências de arquivos de áudio externos.',
    originalSource: audioSystemSource,
    fileExtension: 'ts',
    dependencies: [],
    runtimeIntegration: 'restart-required',
    keywords: ['audio', 'som', 'sons', 'volume', 'sintetizador', 'web audio'],
  },

  // ==========================================
  // 8. SISTEMAS COMPARTILHADOS (Ponte de runtime)
  // ==========================================
  {
    id: 'damage-system',
    name: 'Sistema de Dano Compartilhado',
    filePath: '/src/game/systems/DamageSystem.ts',
    category: 'Sistemas',
    summary:
      'Resolve o dano de todas as habilidades: imunidade (Invulnerable), mitigação de escudo (IsShield) e decisão de recuo (Anchored). Usado por TargetDummy e pelos callbacks de impacto.',
    originalSource: damageSystemSource,
    fileExtension: 'ts',
    dependencies: ['GameplayRestrictions'],
    runtimeIntegration: 'restart-required',
    keywords: ['dano', 'damage', 'escudo', 'shield', 'invulneravel', 'knockback', 'recuo'],
  },
  {
    id: 'health-system',
    name: 'Sistema de Vida & Morte',
    filePath: '/src/game/systems/HealthSystem.ts',
    category: 'Sistemas',
    summary:
      'Clamping de vida, aplicação de dano/cura, detecção de morte e razão de vida usada pelas barras de HUD.',
    originalSource: healthSystemSource,
    fileExtension: 'ts',
    dependencies: [],
    runtimeIntegration: 'restart-required',
    keywords: ['vida', 'health', 'morte', 'cura', 'heal', 'hp'],
  },
  {
    id: 'collision-system',
    name: 'Sistema de Colisão com Estruturas',
    filePath: '/src/game/systems/CollisionSystem.ts',
    category: 'Sistemas',
    summary:
      'Expansão de caixas de colisão e testes de bloqueio por raio/altura, além da distância livre por varredura. Usado por movimento, dash e Passo das Sombras.',
    originalSource: collisionSystemSource,
    fileExtension: 'ts',
    dependencies: [],
    runtimeIntegration: 'restart-required',
    keywords: ['colisao', 'collision', 'caixa', 'box', 'estrutura', 'teleporte'],
  },
  {
    id: 'targeting-system',
    name: 'Sistema de Alvos & Assistência de Mira',
    filePath: '/src/game/systems/TargetingSystem.ts',
    category: 'Sistemas',
    summary:
      'Seleciona o alvo mais alinhado à câmera dentro de um cone/distância e resolve o ponto de mira efetivo para as habilidades.',
    originalSource: targetingSystemSource,
    fileExtension: 'ts',
    dependencies: ['TargetDummy'],
    runtimeIntegration: 'restart-required',
    keywords: ['mira', 'alvo', 'target', 'aim assist', 'assistencia', 'travamento'],
  },
  {
    id: 'camera-system',
    name: 'Sistema de Câmera & Tremor',
    filePath: '/src/game/systems/CameraSystem.ts',
    category: 'Sistemas',
    summary:
      'Vetores de órbita da câmera (terceira pessoa e modo construção) e o cálculo do tremor de tela com decaimento.',
    originalSource: cameraSystemSource,
    fileExtension: 'ts',
    dependencies: [],
    runtimeIntegration: 'restart-required',
    keywords: ['camera', 'orbita', 'shake', 'tremor', 'build mode', 'terceira pessoa'],
  },
  {
    id: 'cooldown-system',
    name: 'Sistema de Recarga (Cooldown)',
    filePath: '/src/game/systems/CooldownSystem.ts',
    category: 'Sistemas',
    summary:
      'Registro nomeado de recargas com gate, progresso e decremento por frame. Usado pelo dash e disponível para habilidades.',
    originalSource: cooldownSystemSource,
    fileExtension: 'ts',
    dependencies: [],
    runtimeIntegration: 'restart-required',
    keywords: ['cooldown', 'recarga', 'dash', 'gate', 'progresso'],
  },
  {
    id: 'vfx-system',
    name: 'Sistema de Efeitos Visuais (VFX)',
    filePath: '/src/game/systems/VFXSystem.ts',
    category: 'Sistemas',
    summary:
      'Orquestra impactos, destruições e teleportes sobre o emissor de partículas com cores por conjunto de poderes.',
    originalSource: vfxSystemSource,
    fileExtension: 'ts',
    dependencies: [],
    runtimeIntegration: 'restart-required',
    keywords: ['vfx', 'efeitos', 'particulas', 'explosao', 'impacto', 'teleporte'],
  },

  // ==========================================
  // 9. INTERFACE, SHELL E EDITOR
  // ==========================================
  {
    id: 'app-shell',
    name: 'Shell da Aplicação & HUD (App)',
    filePath: '/src/App.tsx',
    category: 'Interface & HUD',
    summary:
      'Componente raiz: monta a cena 3D, joystick, botões de combate, mira, modais e roteia o Build Mode. Alterações exigem rebuild.',
    originalSource: appSource,
    fileExtension: 'tsx',
    dependencies: ['GameScene', 'ScriptRuntimeEngine', 'SettingsManager', 'AudioSystem'],
    runtimeIntegration: 'restart-required',
    keywords: ['app', 'shell', 'hud', 'raiz', 'montagem', 'roteamento'],
  },
  {
    id: 'build-mode-container',
    name: 'Interface do Modo Construção',
    filePath: '/src/components/BuildMode/BuildModeContainer.tsx',
    category: 'Interface & HUD',
    summary:
      'Editor de scripts de três painéis: catálogo, editor de código com destaque e painel de contexto (diagnóstico, restrições, histórico).',
    originalSource: buildModeContainerSource,
    fileExtension: 'tsx',
    dependencies: ['ScriptRuntimeEngine', 'RealProjectScripts', 'ScriptSearch', 'ConfigPanel', 'BuildToast'],
    runtimeIntegration: 'restart-required',
    keywords: ['build mode', 'editor', 'painel', 'script', 'catalogo', 'diagnostico'],
  },
  {
    id: 'config-panel',
    name: 'Painel de Ajustes ao Vivo',
    filePath: '/src/components/BuildMode/ConfigPanel.tsx',
    category: 'Interface & HUD',
    summary:
      'Controles em tempo real de câmera, combate, personagens e sistema ligados ao LiveConfigManager.',
    originalSource: configPanelSource,
    fileExtension: 'tsx',
    dependencies: ['LiveConfigManager', 'SettingsManager'],
    runtimeIntegration: 'restart-required',
    keywords: ['ajustes', 'config', 'live config', 'camera', 'combate', 'painel'],
  },
  {
    id: 'build-toast',
    name: 'Notificações do Editor (Toast)',
    filePath: '/src/components/BuildMode/BuildToast.tsx',
    category: 'Interface & HUD',
    summary: 'Componente de notificações temporárias do editor de scripts.',
    originalSource: buildToastSource,
    fileExtension: 'tsx',
    dependencies: [],
    runtimeIntegration: 'restart-required',
    keywords: ['toast', 'notificacao', 'editor', 'aviso'],
  },

  // ==========================================
  // 10. FERRAMENTAS INTERNAS (Somente leitura)
  // ==========================================
  {
    id: 'build-types',
    name: 'Tipos do Modo Construção',
    filePath: '/src/game/BuildTypes.ts',
    category: 'Editor & Ferramentas',
    summary:
      'Tipos serializáveis da cena de construção (entidades, transformações, defaults) compartilhados entre editor e exportação.',
    originalSource: buildTypesSource,
    fileExtension: 'ts',
    dependencies: [],
    runtimeIntegration: 'restart-required',
    keywords: ['tipos', 'types', 'build', 'serializado', 'entidade'],
  },
  {
    id: 'script-runtime-engine',
    name: 'Motor de Runtime de Scripts',
    filePath: '/src/game/ScriptRuntimeEngine.ts',
    category: 'Editor & Ferramentas',
    summary:
      'Pipeline de compilação, validação, integração, hot-swap, histórico e persistência dos scripts. Núcleo do editor.',
    originalSource: scriptRuntimeEngineSource,
    fileExtension: 'ts',
    dependencies: ['RealProjectScripts', 'ScriptPersistence', 'AppliedScriptStore'],
    runtimeIntegration: 'read-only',
    keywords: ['engine', 'runtime', 'hot-swap', 'compilacao', 'integracao', 'motor'],
  },
  {
    id: 'script-persistence',
    name: 'Persistência de Scripts',
    filePath: '/src/game/ScriptPersistence.ts',
    category: 'Editor & Ferramentas',
    summary:
      'Camada de persistência (IndexedDB + espelho local) das versões, rascunhos e histórico de cada script.',
    originalSource: scriptPersistenceSource,
    fileExtension: 'ts',
    dependencies: [],
    runtimeIntegration: 'read-only',
    keywords: ['persistencia', 'indexeddb', 'historico', 'versao', 'rascunho'],
  },
  {
    id: 'applied-script-store',
    name: 'Store de Scripts Aplicados',
    filePath: '/src/game/AppliedScriptStore.ts',
    category: 'Editor & Ferramentas',
    summary:
      'Estado autoritativo dos scripts aplicados (servidor/overlay Vite) com fallback ao bundle e sincronização entre abas.',
    originalSource: appliedScriptStoreSource,
    fileExtension: 'ts',
    dependencies: ['ScriptPersistence'],
    runtimeIntegration: 'read-only',
    keywords: ['applied', 'store', 'overlay', 'sincronizacao', 'servidor'],
  },
  {
    id: 'script-search',
    name: 'Busca & Realce de Código',
    filePath: '/src/game/ScriptSearch.ts',
    category: 'Editor & Ferramentas',
    summary:
      'Indexação por palavras-chave e destaque de sintaxe TypeScript usado pelo editor.',
    originalSource: scriptSearchSource,
    fileExtension: 'ts',
    dependencies: ['RealProjectScripts'],
    runtimeIntegration: 'read-only',
    keywords: ['busca', 'search', 'destaque', 'syntax', 'realce'],
  },
  {
    id: 'project-exporter',
    name: 'Exportador do Projeto (ZIP)',
    filePath: '/src/game/ProjectExporter.ts',
    category: 'Editor & Ferramentas',
    summary:
      'Monta o MeuJogo-Source.zip com o código real, manifesto (schema 3), versões aplicadas e validação do arquivo.',
    originalSource: projectExporterSource,
    fileExtension: 'ts',
    dependencies: ['ScriptRuntimeEngine', 'BuildTypes'],
    runtimeIntegration: 'read-only',
    keywords: ['export', 'zip', 'manifesto', 'projeto', 'download'],
  },
  {
    id: 'build-mode-defaults',
    name: 'Cena de Construção Padrão (Gerado)',
    filePath: '/src/game/generated/BuildModeDefaults.ts',
    category: 'Editor & Ferramentas',
    summary: 'Cena inicial gerada do Modo Construção. Arquivo gerado — somente leitura.',
    originalSource: buildModeDefaultsSource,
    fileExtension: 'ts',
    dependencies: ['BuildTypes'],
    runtimeIntegration: 'read-only',
    keywords: ['gerado', 'default', 'cena', 'build mode'],
  },
  {
    id: 'build-script-overrides',
    name: 'Overrides do Build (Gerado)',
    filePath: '/src/game/generated/BuildScriptOverrides.ts',
    category: 'Editor & Ferramentas',
    summary:
      'Aplica overrides de configuração exportados no build instalado. Arquivo gerado — somente leitura.',
    originalSource: buildScriptOverridesSource,
    fileExtension: 'ts',
    dependencies: ['LiveConfigManager', 'SettingsManager', 'AgathaConfig', 'IronManConfig'],
    runtimeIntegration: 'read-only',
    keywords: ['gerado', 'override', 'build', 'configuracao'],
  },
];
