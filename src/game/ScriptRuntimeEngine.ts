/**
 * Script Runtime Engine
 * Compiles, validates, integrates and tracks in-browser TypeScript/TSX modules.
 *
 * Key guarantees:
 * - Draft, validated, applied, last-working and actually-running code are distinct.
 * - A failed compilation never erases an applied version or a draft.
 * - Startup rehydration never writes drafts or overwrites newer edits.
 * - Dependencies resolve to compiled modules before the original static imports.
 * - Only modules with a real live-integration path are reported as applied.
 */

import * as THREE from 'three';
import React from 'react';
import * as LucideIcons from 'lucide-react';
import { transform } from 'sucrase';
import { PROJECT_SCRIPTS, ProjectScriptInfo, ScriptCategory } from './RealProjectScripts';
import {
  scriptPersistence,
  ScriptErrorKind,
  ScriptRecord,
  WorkingBackup,
} from './ScriptPersistence';
import { liveConfigManager } from './LiveConfigManager';
import { audioSystem } from './AudioSystem';
import { settingsManager, DEFAULT_SETTINGS } from './SettingsManager';
import { TargetDummy } from './TargetDummy';
import { createStickmanRig } from './StickmanRig';
import { AnimationController } from './AnimationController';
import { ProjectileSystem } from './ProjectileSystem';
import { AgathaAbilities } from './AgathaAbilities';
import { IronManAbilities } from './IronManAbilities';
import { gameplayRestrictions } from './GameplayRestrictions';
import {
  activeAgathaConfig,
  updateAgathaConfig,
  DEFAULT_AGATHA_CONFIG,
} from './abilities/agatha/AgathaConfig';
import { AgathaArcaneBlast } from './abilities/agatha/AgathaArcaneBlast';
import { AgathaDarkDrain } from './abilities/agatha/AgathaDarkDrain';
import { AgathaChaosOrb } from './abilities/agatha/AgathaChaosOrb';
import { AgathaRunicWard } from './abilities/agatha/AgathaRunicWard';
import { AgathaTelekineticChoke } from './abilities/agatha/AgathaTelekineticChoke';
import { AgathaShadowStep } from './abilities/agatha/AgathaShadowStep';
import {
  activeIronManConfig,
  updateIronManConfig,
  DEFAULT_IRONMAN_CONFIG,
} from './abilities/ironman/IronManConfig';
import { IronManRepulsor } from './abilities/ironman/IronManRepulsor';
import { IronManMicroMissiles } from './abilities/ironman/IronManMicroMissiles';
import { IronManUnibeam } from './abilities/ironman/IronManUnibeam';

import { CombatButtons } from '../components/CombatButtons';
import { VirtualJoystick } from '../components/VirtualJoystick';
import { AimReticle } from '../components/AimReticle';
import { BeamClashBanner } from '../components/BeamClashBanner';
import { PowerSelectModal } from '../components/PowerSelectModal';
import { SettingsModal } from '../components/SettingsModal';

export type { WorkingBackup } from './ScriptPersistence';
export type ScriptStatus = 'applied' | 'pending' | 'error';
export type ScriptPhase = 'original' | 'draft' | 'validated' | 'applied' | 'running' | 'error';

export interface UserScriptDef extends ProjectScriptInfo {
  isUserCreated?: boolean;
  isDeleted?: boolean;
}

export interface CompileResult {
  success: boolean;
  message: string;
  error?: string;
  line?: number;
  column?: number;
  kind?: ScriptErrorKind;
  applied?: boolean;
  requiresReload?: boolean;
  revision?: number;
}

export interface ScriptRuntimeState {
  id: string;
  phase: ScriptPhase;
  status: ScriptStatus;
  isDirty: boolean;
  isRunning: boolean;
  hasApplied: boolean;
  hasDraft: boolean;
  hasValidated: boolean;
  hasLastWorking: boolean;
  supportsLiveApply: boolean;
  requiresReload: boolean;
  revision: number;
  appliedAt: number;
  draftUpdatedAt: number;
  validatedAt: number;
  lastWorkingAt: number;
  lastError: string | null;
  lastErrorKind: ScriptErrorKind | null;
  runtimeError: string | null;
  line: number | null;
  column: number | null;
  backupCount: number;
}

interface CompileDiagnostic {
  message: string;
  kind: ScriptErrorKind;
  line?: number;
  column?: number;
}

type SceneLike = Record<string, any>;

const CUSTOM_SCRIPTS_KEY = 'stickman_custom_user_scripts_v3';
const DELETED_SCRIPTS_KEY = 'stickman_deleted_scripts_v3';

const NO_LIVE_APPLY = new Set([
  'game-scene',
  'audio-system',
  'gameplay-restrictions',
  'settings-manager',
  'live-config-manager',
]);

const APPLY_ORDER = [
  'gameplay-restrictions',
  'agatha-config',
  'ironman-config',
  'agatha-arcane-blast',
  'agatha-dark-drain',
  'agatha-chaos-orb',
  'agatha-runic-ward',
  'agatha-choke',
  'agatha-shadow-step',
  'ironman-repulsor',
  'ironman-micro-missiles',
  'ironman-unibeam',
  'agatha-abilities',
  'ironman-abilities',
  'animation-controller',
  'projectile-system',
  'target-dummy',
  'stickman-rig',
  'combat-buttons',
  'virtual-joystick',
  'aim-reticle',
  'beam-clash-banner',
  'power-select-modal',
  'settings-modal',
  'game-scene',
  'audio-system',
];

const normalizeKey = (key: string): string => key.toLowerCase().replace(/[^a-z0-9]/g, '');

const ORDER_INDEX = new Map(APPLY_ORDER.map((id, index) => [id, index]));

class ScriptRuntimeEngine {
  private customScripts: UserScriptDef[] = [];
  private deletedScriptIds: Set<string> = new Set();

  private runtimeStatus: Map<
    string,
    { error: string; line: number | null; column: number | null }
  > = new Map();

  private runningModules: Map<string, Record<string, unknown>> = new Map();
  private activeModuleIds: Set<string> = new Set();
  private compiledModules: Map<string, Record<string, unknown>> = new Map();
  private uiComponentRegistry: Map<string, React.ComponentType<any>> = new Map();

  private listeners: Set<() => void> = new Set();
  private uiListeners: Set<() => void> = new Set();

  private activeGameScene: unknown = null;
  private rehydratedScene: unknown = null;
  private rehydration: Promise<void> | null = null;

  public onPowerSetRequested?: (powerSet: 'classic' | 'ironman' | 'agatha') => void;

  constructor() {
    this.loadPersistedCustomScripts();
    scriptPersistence.registerOriginals(
      [...PROJECT_SCRIPTS, ...this.customScripts].map((s) => ({
        id: s.id,
        originalSource: s.originalSource,
      }))
    );
    scriptPersistence.subscribe(() => this.notify());
  }

  public setGameScene(scene: unknown): void {
    if (this.activeGameScene !== scene) {
      this.runningModules.clear();
      this.compiledModules.clear();
      this.activeModuleIds.clear();
      this.uiComponentRegistry.clear();
      this.rehydratedScene = null;
      this.rehydration = null;
    }
    this.activeGameScene = scene;
  }

  public getGameScene(): unknown {
    return this.activeGameScene;
  }

  public requestPowerSet(powerSet: 'classic' | 'ironman' | 'agatha'): void {
    this.onPowerSetRequested?.(powerSet);
  }

  private loadPersistedCustomScripts(): void {
    try {
      const deletedRaw = localStorage.getItem(DELETED_SCRIPTS_KEY);
      if (deletedRaw) this.deletedScriptIds = new Set(JSON.parse(deletedRaw));
      const customRaw = localStorage.getItem(CUSTOM_SCRIPTS_KEY);
      if (customRaw) this.customScripts = JSON.parse(customRaw);
    } catch {
      // Corrupted legacy data must not prevent the engine from starting.
    }
  }

  public getScripts(category?: ScriptCategory): ProjectScriptInfo[] {
    const all = [...PROJECT_SCRIPTS, ...this.customScripts].filter(
      (s) => !this.deletedScriptIds.has(s.id)
    );
    if (!category) return all;
    return all.filter((s) => s.category === category);
  }

  public getScriptById(id: string): ProjectScriptInfo | undefined {
    return this.getScripts().find((s) => s.id === id);
  }

  public supportsLiveApply(id: string): boolean {
    const script = this.getScriptById(id);
    if (!script) return true; // user-created modules may expose onApply/onUpdate
    if (typeof script.supportsLiveApply === 'boolean') return script.supportsLiveApply;
    return !NO_LIVE_APPLY.has(id);
  }

  public getDraft(id: string): string {
    const script = this.getScriptById(id);
    return script ? scriptPersistence.getDraft(id, script.originalSource) : '';
  }

  public saveDraft(id: string, code: string): void {
    const script = this.getScriptById(id);
    if (!script) return;
    scriptPersistence.setDraft(id, code, script.originalSource);
  }

  public getBackups(id: string): WorkingBackup[] {
    const script = this.getScriptById(id);
    return script ? scriptPersistence.listBackups(id, script.originalSource) : [];
  }

  public getComponent(id: string): React.ComponentType<any> | undefined {
    return this.uiComponentRegistry.get(id);
  }

  public getRecord(id: string): ScriptRecord | null {
    const script = this.getScriptById(id);
    return script ? scriptPersistence.get(id, script.originalSource) : null;
  }

  public getScriptState(id: string): ScriptRuntimeState {
    const script = this.getScriptById(id);
    const original = script?.originalSource || '';
    const record = scriptPersistence.get(id, original);
    const runtime = this.runtimeStatus.get(id);
    const runtimeError = runtime?.error || null;
    const isRunning = this.activeModuleIds.has(id);
    const supports = this.supportsLiveApply(id);
    const dirty = record.draft !== null && record.draft !== record.applied;
    const hasError = !!record.lastError || !!runtimeError;

    let phase: ScriptPhase = 'original';
    let status: ScriptStatus = 'pending';
    if (hasError) {
      phase = 'error';
      status = 'error';
    } else if (record.applied && isRunning) {
      phase = 'running';
      status = 'applied';
    } else if (record.applied) {
      phase = 'applied';
      status = 'pending';
    } else if (dirty || record.draft) {
      phase = 'draft';
      status = 'pending';
    } else if (record.validated) {
      phase = 'validated';
      status = 'pending';
    }

    return {
      id,
      phase,
      status,
      isDirty: dirty,
      isRunning,
      hasApplied: !!record.applied,
      hasDraft: !!record.draft,
      hasValidated: !!record.validated,
      hasLastWorking: !!record.lastWorking,
      supportsLiveApply: supports,
      requiresReload: !supports,
      revision: record.revision,
      appliedAt: record.appliedAt,
      draftUpdatedAt: record.draftUpdatedAt,
      validatedAt: record.validatedAt,
      lastWorkingAt: record.lastWorkingAt,
      lastError: record.lastError,
      lastErrorKind: record.lastErrorKind,
      runtimeError,
      line: runtime?.line ?? null,
      column: runtime?.column ?? null,
      backupCount: record.backups.length,
    };
  }

  public getScriptStatus(
    id: string
  ): { status: ScriptStatus; error: string | null; line: number | null; column: number | null } {
    const state = this.getScriptState(id);
    return {
      status: state.status,
      error: state.lastError || state.runtimeError,
      line: state.line,
      column: state.column,
    };
  }

  private getOrder(id: string): number {
    return ORDER_INDEX.get(id) ?? 1000;
  }

  private sortedScripts(scripts: ProjectScriptInfo[]): ProjectScriptInfo[] {
    return [...scripts].sort((a, b) => this.getOrder(a.id) - this.getOrder(b.id));
  }

  private resolveCompiledDependency(norm: string): Record<string, unknown> | undefined {
    const exact = this.compiledModules.get(norm);
    if (exact) return exact;
    let bestKey = '';
    let bestValue: Record<string, unknown> | undefined;
    for (const [key, value] of this.compiledModules.entries()) {
      if (key.length < 5) continue;
      if (norm.includes(key) && key.length > bestKey.length) {
        bestKey = key;
        bestValue = value;
      }
    }
    return bestValue;
  }

  private resolveDependency(modName: string): unknown {
    const norm = normalizeKey(modName);

    if (modName === 'three' || modName.startsWith('three/')) {
      return { default: THREE, ...THREE };
    }
    if (modName === 'react' || modName === 'react/jsx-runtime') {
      return { default: React, ...React };
    }
    if (modName === 'lucide-react') {
      return { default: LucideIcons, ...LucideIcons };
    }
    if (modName === 'sucrase') {
      return { transform };
    }

    // Config modules use live getters so a later config application is visible
    // to modules that were compiled earlier.
    if (norm.includes('agathaconfig')) {
      return {
        get activeAgathaConfig() {
          return activeAgathaConfig;
        },
        updateAgathaConfig,
        DEFAULT_AGATHA_CONFIG,
        get default() {
          return activeAgathaConfig;
        },
      };
    }
    if (norm.includes('ironmanconfig')) {
      return {
        get activeIronManConfig() {
          return activeIronManConfig;
        },
        updateIronManConfig,
        DEFAULT_IRONMAN_CONFIG,
        get default() {
          return activeIronManConfig;
        },
      };
    }

    // Live singletons must always be the exact instance used by the game.
    if (norm.includes('audiosystem')) return { audioSystem, default: audioSystem };
    if (norm.includes('settingsmanager')) {
      return { settingsManager, DEFAULT_SETTINGS, default: settingsManager };
    }
    if (norm.includes('liveconfigmanager')) {
      return { liveConfigManager, default: liveConfigManager };
    }
    if (norm.includes('gameplayrestrictions')) {
      return { gameplayRestrictions, default: gameplayRestrictions };
    }
    if (norm.includes('scriptruntimeengine')) {
      return { scriptRuntimeEngine: this, default: this };
    }

    // Compiled modules take precedence over static imports. This is what makes
    // a saved child ability visible to a controller compiled later.
    const compiled = this.resolveCompiledDependency(norm);
    if (compiled) return compiled;

    if (norm.includes('agathaarcaneblast')) return { AgathaArcaneBlast, default: AgathaArcaneBlast };
    if (norm.includes('agathadarkdrain')) return { AgathaDarkDrain, default: AgathaDarkDrain };
    if (norm.includes('agathachaosorb')) return { AgathaChaosOrb, default: AgathaChaosOrb };
    if (norm.includes('agatharunicward')) return { AgathaRunicWard, default: AgathaRunicWard };
    if (norm.includes('agathatelekineticchoke') || norm.includes('agathachoke')) {
      return { AgathaTelekineticChoke, default: AgathaTelekineticChoke };
    }
    if (norm.includes('agathashadowstep')) return { AgathaShadowStep, default: AgathaShadowStep };
    if (norm.includes('ironmanrepulsor')) return { IronManRepulsor, default: IronManRepulsor };
    if (norm.includes('ironmanmicromissiles')) {
      return { IronManMicroMissiles, default: IronManMicroMissiles };
    }
    if (norm.includes('ironmanunibeam')) return { IronManUnibeam, default: IronManUnibeam };
    if (norm.includes('targetdummy')) return { TargetDummy, default: TargetDummy };
    if (norm.includes('stickmanrig')) {
      return { createStickmanRig, default: createStickmanRig };
    }
    if (norm.includes('animationcontroller')) {
      return { AnimationController, default: AnimationController };
    }
    if (norm.includes('projectilesystem')) {
      return { ProjectileSystem, default: ProjectileSystem };
    }
    if (norm.includes('agathaabilities')) return { AgathaAbilities, default: AgathaAbilities };
    if (norm.includes('ironmanabilities')) return { IronManAbilities, default: IronManAbilities };
    if (norm.includes('combatbuttons')) return { CombatButtons, default: CombatButtons };
    if (norm.includes('virtualjoystick')) return { VirtualJoystick, default: VirtualJoystick };
    if (norm.includes('aimreticle')) return { AimReticle, default: AimReticle };
    if (norm.includes('beamclashbanner')) return { BeamClashBanner, default: BeamClashBanner };
    if (norm.includes('powerselectmodal')) return { PowerSelectModal, default: PowerSelectModal };
    if (norm.includes('settingsmodal')) return { SettingsModal, default: SettingsModal };

    return {};
  }

  private compileSource(id: string, code: string): { code?: string; diagnostic?: CompileDiagnostic } {
    try {
      const result = transform(code, {
        transforms: ['typescript', 'jsx', 'imports'],
        jsxPragma: 'React.createElement',
        jsxFragmentPragma: 'React.Fragment',
        filePath: `${id}.tsx`,
      });
      return { code: result.code };
    } catch (e: unknown) {
      const err = e as { message?: string; loc?: { line: number; column: number } };
      const line = err.loc?.line || 1;
      const column = err.loc?.column || 1;
      const cleanMsg = err.message
        ? err.message.replace(/^[a-zA-Z0-9_\-./\\]+:\s*/, '')
        : 'Erro de sintaxe';
      return {
        diagnostic: {
          message: `Erro de Sintaxe (Linha ${line}, Coluna ${column}): ${cleanMsg}`,
          kind: 'syntax',
          line,
          column,
        },
      };
    }
  }

  private evaluateModule(
    id: string,
    code: string
  ): { exports?: Record<string, unknown>; diagnostic?: CompileDiagnostic } {
    const compiled = this.compileSource(id, code);
    if (compiled.diagnostic) return { diagnostic: compiled.diagnostic };

    const moduleExports: Record<string, unknown> = {};
    const moduleObj = { exports: moduleExports };
    try {
      const factory = new Function(
        'exports',
        'module',
        'require',
        'THREE',
        'React',
        'audioSystem',
        'liveConfigManager',
        'settingsManager',
        'gameplayRestrictions',
        compiled.code || ''
      );
      factory(
        moduleObj.exports,
        moduleObj,
        (name: string) => this.resolveDependency(name),
        THREE,
        React,
        audioSystem,
        liveConfigManager,
        settingsManager,
        gameplayRestrictions
      );
    } catch (e: unknown) {
      const err = e as Error;
      return {
        diagnostic: {
          message: `Erro de Dependência/Execução do Módulo: ${err.message}`,
          kind: 'dependency',
        },
      };
    }
    return { exports: moduleObj.exports };
  }

  private getExport(exports: Record<string, unknown>, names: string[]): any {
    for (const name of names) {
      const value = exports[name];
      if (value !== undefined) return value;
    }
    return exports.default;
  }

  private assertExport(
    exports: Record<string, unknown>,
    names: string[]
  ): CompileDiagnostic | null {
    const value = this.getExport(exports, names);
    if (value === undefined || value === null) {
      return {
        message: `Contrato de módulo inválido: exporte ${names.join(' ou ')}. O código compilou, mas não pode ser integrado ao jogo.`,
        kind: 'integration',
      };
    }
    return null;
  }

  private markRuntimeError(id: string, message: string): void {
    const script = this.getScriptById(id);
    if (script) {
      scriptPersistence.markError(id, message, 'runtime', script.originalSource);
    }
    this.runtimeStatus.set(id, { error: message, line: null, column: null });
    this.notify();
  }

  private getCallbacks(scene: SceneLike) {
    const getAim = () => {
      if (scene.settings?.aimAssist && scene.activeTarget && !scene.activeTarget.isDead) {
        return { pos: scene.activeTarget.getCenter(), target: scene.activeTarget };
      }
      return { pos: scene.currentAimPoint.clone(), target: null };
    };
    const onDamage = (dummy: any, dmg: number, hitPos: any, kb?: any) => {
      const res = dummy.takeDamage(dmg, hitPos, kb);
      if (res.actualDamage > 0) scene.triggerHitConfirm?.();
      if (scene.projectileSystem) {
        scene.projectileSystem.damageNumbers.push({
          id: (scene.projectileSystem as any).nextDamageId++,
          value: res.actualDamage,
          worldPos: hitPos.clone().add(new THREE.Vector3(0, 0.4, 0)),
          age: 0,
          maxAge: liveConfigManager.get().damageNumberDuration,
        });
      }
    };
    const onShake = (amount: number) => {
      if (scene.settings?.cameraShake) scene.addCameraShake?.(amount);
    };
    return { getAim, onDamage, onShake };
  }

  private disposeModuleExports(exports: Record<string, unknown> | undefined): void {
    if (!exports) return;
    const onDispose = exports.onDispose;
    if (typeof onDispose === 'function') {
      try {
        (onDispose as () => void)();
      } catch (err) {
        console.warn('[ScriptRuntimeEngine] onDispose error:', err);
      }
    }
  }

  private hotSwapModule(
    id: string,
    exports: Record<string, unknown>,
    scene: SceneLike | null
  ): { ok: true; note: string } | { ok: false; diagnostic: CompileDiagnostic } {
    const previous = this.runningModules.get(id);
    const { getAim, onDamage, onShake } = scene ? this.getCallbacks(scene) : ({} as any);

    const finish = (
      note: string
    ): { ok: true; note: string } | { ok: false; diagnostic: CompileDiagnostic } => {
      this.disposeModuleExports(previous);
      this.runningModules.set(id, exports);
      this.activeModuleIds.add(id);
      if (typeof exports.onApply === 'function') {
        try {
          (exports.onApply as (s: unknown) => void)(scene);
        } catch (e: unknown) {
          return {
            ok: false,
            diagnostic: {
              message: `Falha em onApply: ${(e as Error).message}`,
              kind: 'integration',
            },
          };
        }
      }
      return { ok: true, note };
    };

    // User-created modules can mount through the documented lifecycle contract.
    if (!PROJECT_SCRIPTS.some((s) => s.id === id)) {
      return finish('Módulo personalizado aplicado ao runtime.');
    }

    if (NO_LIVE_APPLY.has(id)) {
      return {
        ok: false,
        diagnostic: {
          message:
            'Este módulo é carregado pelo bootstrap do jogo e não possui integração a quente segura. O código foi validado e salvo como rascunho, mas não foi aplicado ao runtime.',
          kind: 'integration',
        },
      };
    }

    if (id === 'agatha-config') {
      const config = this.getExport(exports, ['activeAgathaConfig', 'DEFAULT_AGATHA_CONFIG']);
      if (!config || typeof config !== 'object') {
        return {
          ok: false,
          diagnostic: { message: 'Configuração da Agatha inválida.', kind: 'integration' },
        };
      }
      updateAgathaConfig(config as any);
      return finish('Parâmetros de configuração da Agatha aplicados.');
    }

    if (id === 'ironman-config') {
      const config = this.getExport(exports, ['activeIronManConfig', 'DEFAULT_IRONMAN_CONFIG']);
      if (!config || typeof config !== 'object') {
        return {
          ok: false,
          diagnostic: { message: 'Configuração do Homem de Ferro inválida.', kind: 'integration' },
        };
      }
      updateIronManConfig(config as any);
      return finish('Configuração do Homem de Ferro aplicada.');
    }

    if (!scene) {
      return {
        ok: false,
        diagnostic: {
          message: 'A cena do jogo ainda não está pronta. Aplique novamente após carregar o Play Test.',
          kind: 'integration',
        },
      };
    }

    const agatha = scene.agathaAbilities as AgathaAbilities | undefined;
    const ironman = scene.ironManAbilities as IronManAbilities | undefined;

    if (id.startsWith('agatha-') && id !== 'agatha-abilities') {
      const specs: Record<string, { names: string[]; create: (C: any) => any; field: string }> = {
        'agatha-arcane-blast': {
          names: ['AgathaArcaneBlast'],
          field: 'arcaneBlastModule',
          create: (C) => new C(scene.scene, scene.stickman, getAim, onDamage, onShake),
        },
        'agatha-dark-drain': {
          names: ['AgathaDarkDrain'],
          field: 'darkDrainModule',
          create: (C) => new C(scene.scene, scene.stickman, onDamage, onShake),
        },
        'agatha-chaos-orb': {
          names: ['AgathaChaosOrb'],
          field: 'chaosOrbModule',
          create: (C) => new C(scene.scene, scene.stickman, getAim, onDamage, onShake),
        },
        'agatha-runic-ward': {
          names: ['AgathaRunicWard'],
          field: 'runicWardModule',
          create: (C) => new C(scene.scene, scene.stickman, onShake),
        },
        'agatha-choke': {
          names: ['AgathaTelekineticChoke'],
          field: 'chokeModule',
          create: (C) => new C(scene.scene, scene.stickman, getAim, onDamage, onShake),
        },
        'agatha-shadow-step': {
          names: ['AgathaShadowStep'],
          field: 'shadowStepModule',
          create: (C) => new C(scene.scene, onShake),
        },
      };
      const spec = specs[id];
      if (!spec) {
        return {
          ok: false,
          diagnostic: { message: `Módulo Agatha desconhecido: ${id}`, kind: 'integration' },
        };
      }
      const diag = this.assertExport(exports, spec.names);
      if (diag) return { ok: false, diagnostic: diag };
      if (!agatha) {
        return {
          ok: false,
          diagnostic: {
            message: 'O controlador da Agatha não está instanciado na cena.',
            kind: 'integration',
          },
        };
      }
      try {
        const ClassRef = this.getExport(exports, spec.names);
        const instance = spec.create(ClassRef);
        const old = (agatha as any)[spec.field];
        (agatha as any)[spec.field] = instance;
        if (id === 'agatha-arcane-blast') {
          instance.onArcaneCast = agatha.onArcaneCast;
        }
        old?.dispose?.();
      } catch (e: unknown) {
        return {
          ok: false,
          diagnostic: {
            message: `Falha ao instanciar ${spec.names[0]}: ${(e as Error).message}`,
            kind: 'integration',
          },
        };
      }
      scene.setPowerSet?.('agatha');
      this.requestPowerSet('agatha');
      return finish(`${spec.names[0]} integrado à instância viva da Agatha.`);
    }

    if (id === 'agatha-abilities') {
      const diag = this.assertExport(exports, ['AgathaAbilities']);
      if (diag) return { ok: false, diagnostic: diag };
      try {
        const ClassRef = this.getExport(exports, ['AgathaAbilities']);
        const next = new ClassRef(scene.scene, scene.stickman, getAim, onDamage, onShake);
        next.onArcaneCast = (hand: 'left' | 'right', aimPitch: number) =>
          scene.animController.triggerRepulsor(hand, aimPitch);
        const old = scene.agathaAbilities as AgathaAbilities | undefined;
        scene.agathaAbilities = next;
        old?.dispose?.();
      } catch (e: unknown) {
        return {
          ok: false,
          diagnostic: {
            message: `Falha ao instanciar AgathaAbilities: ${(e as Error).message}`,
            kind: 'integration',
          },
        };
      }
      scene.currentPowerSet = 'agatha';
      scene.animController.isAgatha = true;
      this.requestPowerSet('agatha');
      return finish('Controlador completo da Agatha substituído no jogo.');
    }

    if (id.startsWith('ironman-') && id !== 'ironman-abilities') {
      if (!ironman) {
        return {
          ok: false,
          diagnostic: {
            message: 'O controlador do Homem de Ferro não está instanciado na cena.',
            kind: 'integration',
          },
        };
      }
      try {
        if (id === 'ironman-repulsor') {
          const diag = this.assertExport(exports, ['IronManRepulsor']);
          if (diag) return { ok: false, diagnostic: diag };
          const C = this.getExport(exports, ['IronManRepulsor']);
          ironman.setScriptModule?.('repulsor', new C(scene.scene, scene.stickman, getAim, onDamage, onShake));
        } else if (id === 'ironman-micro-missiles') {
          const diag = this.assertExport(exports, ['IronManMicroMissiles']);
          if (diag) return { ok: false, diagnostic: diag };
          const C = this.getExport(exports, ['IronManMicroMissiles']);
          ironman.setScriptModule?.('missiles', new C(scene.scene, scene.stickman, onDamage, onShake));
        } else if (id === 'ironman-unibeam') {
          const diag = this.assertExport(exports, ['IronManUnibeam']);
          if (diag) return { ok: false, diagnostic: diag };
          const C = this.getExport(exports, ['IronManUnibeam']);
          ironman.setScriptModule?.('unibeam', new C(scene.scene, scene.stickman, onDamage, onShake));
        } else {
          return {
            ok: false,
            diagnostic: { message: `Módulo Iron Man desconhecido: ${id}`, kind: 'integration' },
          };
        }
      } catch (e: unknown) {
        return {
          ok: false,
          diagnostic: {
            message: `Falha ao integrar módulo Iron Man: ${(e as Error).message}`,
            kind: 'integration',
          },
        };
      }
      scene.setPowerSet?.('ironman');
      this.requestPowerSet('ironman');
      return finish('Módulo do Homem de Ferro substituído na instância viva.');
    }

    if (id === 'ironman-abilities') {
      const diag = this.assertExport(exports, ['IronManAbilities']);
      if (diag) return { ok: false, diagnostic: diag };
      try {
        const ClassRef = this.getExport(exports, ['IronManAbilities']);
        const next = new ClassRef(scene.scene, scene.stickman, getAim, onDamage, onShake);
        next.onRepulsorFired = (hand: 'left' | 'right', aimPitch: number) =>
          scene.animController.triggerRepulsor(hand, aimPitch);
        const old = scene.ironManAbilities as IronManAbilities | undefined;
        scene.ironManAbilities = next;
        old?.dispose?.();
      } catch (e: unknown) {
        return {
          ok: false,
          diagnostic: {
            message: `Falha ao instanciar IronManAbilities: ${(e as Error).message}`,
            kind: 'integration',
          },
        };
      }
      this.requestPowerSet('ironman');
      return finish('Controlador completo do Homem de Ferro substituído no jogo.');
    }

    if (id === 'animation-controller') {
      const diag = this.assertExport(exports, ['AnimationController']);
      if (diag) return { ok: false, diagnostic: diag };
      try {
        scene.updateAnimationController(this.getExport(exports, ['AnimationController']));
      } catch (e: unknown) {
        return {
          ok: false,
          diagnostic: {
            message: `Falha ao integrar AnimationController: ${(e as Error).message}`,
            kind: 'integration',
          },
        };
      }
      return finish('Controlador de animações substituído e validado em execução.');
    }

    if (id === 'projectile-system') {
      const diag = this.assertExport(exports, ['ProjectileSystem']);
      if (diag) return { ok: false, diagnostic: diag };
      try {
        scene.updateProjectileSystem(this.getExport(exports, ['ProjectileSystem']));
      } catch (e: unknown) {
        return {
          ok: false,
          diagnostic: {
            message: `Falha ao integrar ProjectileSystem: ${(e as Error).message}`,
            kind: 'integration',
          },
        };
      }
      return finish('Sistema de projéteis substituído no loop ativo.');
    }

    if (id === 'target-dummy') {
      const diag = this.assertExport(exports, ['TargetDummy']);
      if (diag) return { ok: false, diagnostic: diag };
      try {
        scene.updateTargetDummyClass(this.getExport(exports, ['TargetDummy']));
      } catch (e: unknown) {
        return {
          ok: false,
          diagnostic: {
            message: `Falha ao integrar TargetDummy: ${(e as Error).message}`,
            kind: 'integration',
          },
        };
      }
      return finish('Classe de alvos substituída na cena.');
    }

    if (id === 'stickman-rig') {
      const factory = this.getExport(exports, ['createStickmanRig']);
      if (typeof factory !== 'function') {
        return {
          ok: false,
          diagnostic: {
            message: 'Contrato inválido: exporte createStickmanRig como função.',
            kind: 'integration',
          },
        };
      }
      try {
        scene.updateStickmanRig(() => factory());
      } catch (e: unknown) {
        return {
          ok: false,
          diagnostic: {
            message: `Falha ao integrar StickmanRig: ${(e as Error).message}`,
            kind: 'integration',
          },
        };
      }
      return finish('Rig do personagem substituído na cena.');
    }

    const componentMap: Record<string, { name: string; key: string }> = {
      'combat-buttons': { name: 'CombatButtons', key: 'combat-buttons' },
      'virtual-joystick': { name: 'VirtualJoystick', key: 'virtual-joystick' },
      'aim-reticle': { name: 'AimReticle', key: 'aim-reticle' },
      'beam-clash-banner': { name: 'BeamClashBanner', key: 'beam-clash-banner' },
      'power-select-modal': { name: 'PowerSelectModal', key: 'power-select-modal' },
      'settings-modal': { name: 'SettingsModal', key: 'settings-modal' },
    };
    const uiSpec = componentMap[id];
    if (uiSpec) {
      const diag = this.assertExport(exports, [uiSpec.name]);
      if (diag) return { ok: false, diagnostic: diag };
      this.uiComponentRegistry.set(uiSpec.key, this.getExport(exports, [uiSpec.name]));
      this.notifyUi();
      return finish('Componente React atualizado no HUD.');
    }

    return finish('Módulo executado no runtime.');
  }

  private applyInternal(
    id: string,
    code: string,
    scene: SceneLike | null,
    persist: boolean
  ): CompileResult {
    const script = this.getScriptById(id);
    const original = script?.originalSource || '';

    if (!script) {
      return { success: false, message: 'Script não encontrado.', kind: 'integration' };
    }
    if (!this.supportsLiveApply(id)) {
      const evaluated = this.evaluateModule(id, code);
      if (evaluated.diagnostic) {
        scriptPersistence.markError(id, evaluated.diagnostic.message, evaluated.diagnostic.kind, original);
        this.notify();
        return {
          success: false,
          message: evaluated.diagnostic.message,
          error: evaluated.diagnostic.message,
          kind: evaluated.diagnostic.kind,
          line: evaluated.diagnostic.line,
          column: evaluated.diagnostic.column,
          requiresReload: true,
        };
      }
      scriptPersistence.markValidated(id, code, original);
      this.notify();
      return {
        success: false,
        message:
          'Código válido, porém este módulo não pode ser aplicado a quente sem recriar o bootstrap. Nenhuma alteração foi marcada como executando.',
        error:
          'Módulo de bootstrap: não existe caminho seguro de substituição em tempo de execução.',
        kind: 'integration',
        requiresReload: true,
      };
    }

    const evaluated = this.evaluateModule(id, code);
    if (evaluated.diagnostic || !evaluated.exports) {
      const diag = evaluated.diagnostic!;
      scriptPersistence.markError(id, diag.message, diag.kind, original);
      this.notify();
      return {
        success: false,
        message: diag.message,
        error: diag.message,
        kind: diag.kind,
        line: diag.line,
        column: diag.column,
      };
    }

    if (!scene) {
      const diag: CompileDiagnostic = {
        message: 'Cena do jogo indisponível para integração.',
        kind: 'integration',
      };
      scriptPersistence.markError(id, diag.message, diag.kind, original);
      this.notify();
      return { success: false, message: diag.message, error: diag.message, kind: diag.kind };
    }

    const integrated = this.hotSwapModule(id, evaluated.exports, scene);
    if (!integrated.ok) {
      const diag = integrated.diagnostic;
      scriptPersistence.markError(id, diag.message, diag.kind, original);
      this.notify();
      return {
        success: false,
        message: diag.message,
        error: diag.message,
        kind: diag.kind,
        requiresReload: this.supportsLiveApply(id) === false,
      };
    }

    const alias = normalizeKey(id);
    this.compiledModules.set(id, evaluated.exports);
    this.compiledModules.set(alias, evaluated.exports);
    this.runningModules.set(id, evaluated.exports);
    this.activeModuleIds.add(id);
    this.runtimeStatus.delete(id);

    let revision: number | undefined;
    if (persist) {
      const record = scriptPersistence.commitApplied(id, code, original);
      revision = record.revision;
    }

    this.notify();
    return {
      success: true,
      message: `Compilado, integrado e em execução. ${integrated.note}`,
      applied: true,
      requiresReload: false,
      revision,
    };
  }

  /**
   * Validates syntax, dependencies and module contract without touching the game.
   */
  public async validateScript(id: string, code: string): Promise<CompileResult> {
    const script = this.getScriptById(id);
    if (!script) return { success: false, message: 'Script não encontrado.', kind: 'integration' };

    const evaluated = this.evaluateModule(id, code);
    if (evaluated.diagnostic || !evaluated.exports) {
      const diag = evaluated.diagnostic!;
      scriptPersistence.markError(id, diag.message, diag.kind, script.originalSource);
      this.notify();
      return {
        success: false,
        message: diag.message,
        error: diag.message,
        kind: diag.kind,
        line: diag.line,
        column: diag.column,
      };
    }

    scriptPersistence.markValidated(id, code, script.originalSource);
    this.notify();
    return {
      success: true,
      message: 'Código válido: sintaxe, imports e contrato de módulo verificados. O jogo não foi alterado.',
      applied: false,
    };
  }

  /**
   * Compiles, integrates and only then persists the applied version.
   */
  public async compileAndApply(
    id: string,
    code: string,
    gameScene?: unknown,
    isStartupRehydration: boolean = false
  ): Promise<CompileResult> {
    const scene = (gameScene || this.activeGameScene) as SceneLike | null;
    const result = this.applyInternal(id, code, scene, !isStartupRehydration);
    if (result.success && !isStartupRehydration) {
      // Keep the draft in sync with what the user explicitly applied.
      const script = this.getScriptById(id);
      if (script) scriptPersistence.setDraft(id, code, script.originalSource);
    }
    return result;
  }

  public async applyBackup(
    id: string,
    backupId: string,
    gameScene?: unknown
  ): Promise<CompileResult> {
    const script = this.getScriptById(id);
    if (!script) return { success: false, message: 'Script não encontrado.' };
    const backup = scriptPersistence.getBackup(id, backupId, script.originalSource);
    if (!backup) return { success: false, message: 'Backup não encontrado.' };
    return this.compileAndApply(id, backup.code, gameScene, false);
  }

  public async applyAllSavedScripts(gameScene: unknown): Promise<void> {
    const scene = (gameScene || this.activeGameScene) as SceneLike | null;
    if (!scene) return;
    if (this.rehydratedScene === scene && this.rehydration) return this.rehydration;

    this.rehydratedScene = scene;
    this.rehydration = (async () => {
      const scripts = this.sortedScripts(this.getScripts());
      for (const script of scripts) {
        if (!this.supportsLiveApply(script.id)) continue;
        const record = scriptPersistence.get(script.id, script.originalSource);
        if (!record.applied || !record.applied.trim()) continue;

        let res = this.applyInternal(script.id, record.applied, scene, false);
        if (res.success) continue;

        // Compilation/integration of the saved version failed. Keep the saved
        // code intact, then try to run the last known working version.
        if (record.lastWorking && record.lastWorking !== record.applied) {
          const fallback = this.applyInternal(script.id, record.lastWorking, scene, false);
          if (fallback.success) {
            scriptPersistence.markError(
              script.id,
              `A versão aplicada não pôde ser carregada (${res.error || res.message}). Executando a última versão funcional preservada.`,
              (res.kind as ScriptErrorKind) || 'integration',
              script.originalSource
            );
          }
        }
        console.warn(`[ScriptRuntimeEngine] Rehydration failed for ${script.id}:`, res.message);
      }
      this.notify();
    })();

    return this.rehydration;
  }

  public markScriptExecutionError(id: string, errorMsg: string): void {
    const script = this.getScriptById(id);
    if (script) {
      scriptPersistence.markError(id, errorMsg, 'runtime', script.originalSource);
    }
    this.runtimeStatus.set(id, { error: errorMsg, line: null, column: null });
    this.notify();
  }

  public async rollback(
    id: string,
    gameScene?: unknown
  ): Promise<{ success: boolean; message: string; restoredCode?: string }> {
    const script = this.getScriptById(id);
    if (!script) return { success: false, message: 'Script não encontrado.' };
    const record = scriptPersistence.get(id, script.originalSource);
    const backups = record.backups;
    const previous = backups.find(
      (b) => b.kind !== 'original' && b.code !== record.applied && b.code !== record.draft
    ) || backups.find((b) => b.kind === 'original' && b.code !== record.applied);

    if (!previous) {
      return { success: false, message: 'Nenhuma versão anterior disponível para reversão.' };
    }

    const res = await this.compileAndApply(id, previous.code, gameScene, false);
    if (res.success) {
      return {
        success: true,
        message: `Revertido com sucesso para: ${previous.label}`,
        restoredCode: previous.code,
      };
    }
    return { success: false, message: `Falha ao reverter: ${res.error || res.message}` };
  }

  public async restoreOriginalScript(
    id: string,
    gameScene?: unknown
  ): Promise<{ success: boolean; message: string; restoredCode?: string }> {
    const script = this.getScriptById(id);
    if (!script) return { success: false, message: 'Script não encontrado.' };

    const res = await this.compileAndApply(id, script.originalSource, gameScene, true);
    if (!res.success && !res.requiresReload) {
      return { success: false, message: `Erro ao restaurar: ${res.error || res.message}` };
    }

    scriptPersistence.resetToOriginal(id, script.originalSource);
    this.activeModuleIds.add(id);
    this.runtimeStatus.delete(id);
    this.notify();
    return {
      success: true,
      message: `Código original de ${script.name} restaurado e reaplicado. A versão personalizada continua nos backups.`,
      restoredCode: script.originalSource,
    };
  }

  public async restoreAllOriginalScripts(
    gameScene?: unknown
  ): Promise<{ success: boolean; message: string }> {
    const scene = (gameScene || this.activeGameScene) as SceneLike | null;
    const scripts = this.sortedScripts(this.getScripts());
    let failures = 0;
    for (const script of scripts) {
      if (!this.supportsLiveApply(script.id) || !scene) {
        scriptPersistence.resetToOriginal(script.id, script.originalSource);
        continue;
      }
      const res = await this.compileAndApply(script.id, script.originalSource, scene, true);
      if (res.success) {
        scriptPersistence.resetToOriginal(script.id, script.originalSource);
        this.runtimeStatus.delete(script.id);
      } else {
        failures += 1;
      }
    }
    this.notify();
    return {
      success: failures === 0,
      message:
        failures === 0
          ? 'Todos os scripts foram restaurados para os originais. Backups personalizados preservados.'
          : `${failures} script(s) não puderam ser reaplicados; seus backups foram preservados.`,
    };
  }

  public updateRunningScripts(scene: unknown, dt: number): void {
    for (const [id, mod] of this.runningModules.entries()) {
      if (typeof mod.onUpdate === 'function') {
        try {
          (mod.onUpdate as (s: unknown, dt: number) => void)(scene, dt);
        } catch (err) {
          if (!this.runtimeStatus.has(id)) {
            this.markRuntimeError(id, `Erro em onUpdate: ${(err as Error).message}`);
          }
        }
      }
    }
  }

  public exportBackup(): string {
    return scriptPersistence.exportSnapshot();
  }

  public importBackup(json: string): { success: boolean; message: string } {
    return scriptPersistence.importSnapshot(json);
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public subscribeUiComponents(listener: () => void): () => void {
    this.uiListeners.add(listener);
    return () => this.uiListeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch {
        // UI listener failures must not break the engine.
      }
    });
  }

  private notifyUi(): void {
    this.uiListeners.forEach((fn) => {
      try {
        fn();
      } catch {
        // UI listener failures must not break the engine.
      }
    });
  }
}

export const scriptRuntimeEngine = new ScriptRuntimeEngine();
