/**
 * StrangePortalStep.ts
 * Dash Module for Doctor Strange: Mystic Portal Step.
 * Opens two glowing orange sling-ring portals aligned with the dash direction.
 * Strange visibly walks into the first portal, traverses, and exits through the
 * second with correct repositioning and orientation. Destination is validated
 * against structure collision boxes; blocked destinations are shortened or the
 * dash is safely canceled. Invulnerability is applied only during the traverse
 * window and removed immediately after.
 */

import * as THREE from 'three';
import { audioSystem } from '../../AudioSystem';
import { gameplayRestrictions } from '../../GameplayRestrictions';
import { StrangeFx } from './StrangeFx';
import { activeStrangeConfig } from './DoctorStrangeConfig';

const PORTAL_SOURCE = 'strange-portal-step';

interface PortalModel {
  group: THREE.Group;
  runeRing: THREE.Mesh;
  runeMat: THREE.MeshBasicMaterial;
  discMat: THREE.MeshBasicMaterial;
  rimMat: THREE.MeshBasicMaterial;
  light: THREE.PointLight;
  baseScale: number;
}

export interface PortalStepApi {
  setPlayerPos: (x: number, z: number) => void;
  setPlayerRotationY: (ry: number) => void;
  setPlayerVisible: (visible: boolean) => void;
}

type PortalPhase = 'idle' | 'entry' | 'traverse' | 'exit' | 'closing';

export class StrangePortalStep {
  private scene: THREE.Scene;
  private fx: StrangeFx;
  private onShake: (amount: number) => void;

  public isActive: boolean = false;
  public cooldownRemaining: number = 0;

  private phase: PortalPhase = 'idle';
  private phaseTime: number = 0;
  private elapsed: number = 0;
  private totalDuration: number = 0.8;
  private entryTime: number = 0.3;
  private traverseTime: number = 0.2;

  private startPost: THREE.Vector3 = new THREE.Vector3();
  private portalPost: THREE.Vector3 = new THREE.Vector3();
  private exitPost: THREE.Vector3 = new THREE.Vector3();
  private finalPost: THREE.Vector3 = new THREE.Vector3();
  private dirVec: THREE.Vector3 = new THREE.Vector3(0, 0, -1);

  private portalA: PortalModel | null = null;
  private portalB: PortalModel | null = null;
  private api: PortalStepApi | null = null;
  private invulnApplied: boolean = false;

  constructor(scene: THREE.Scene, onShake: (amount: number) => void, fx: StrangeFx) {
    this.scene = scene;
    this.onShake = onShake;
    this.fx = fx;
  }

  public getPortalAnimSpeed(): number {
    return this.phase === 'entry' || this.phase === 'exit' ? 0.9 : 0;
  }

  public execute(
    playerPos: THREE.Vector3,
    inputDir: THREE.Vector3,
    structureBoxes: THREE.Box3[],
    api: PortalStepApi
  ): boolean {
    const cfg = activeStrangeConfig.portalStep;
    if (this.isActive || this.cooldownRemaining > 0) return false;

    const dir = inputDir.clone();
    dir.y = 0;
    if (dir.lengthSq() < 0.001) {
      dir.set(0, 0, -1);
    }
    dir.normalize();

    const playerRadius = 0.55;
    const targetDist = cfg.distance;
    let validDist = targetDist;
    const stepSize = 0.4;
    const steps = Math.ceil(targetDist / stepSize);

    for (let s = 1; s <= steps; s++) {
      const checkDist = Math.min(targetDist, s * stepSize);
      const testPos = playerPos.clone().addScaledVector(dir, checkDist);

      for (const box of structureBoxes) {
        const expanded = box.clone();
        expanded.min.subScalar(playerRadius);
        expanded.max.addScalar(playerRadius);
        if (testPos.y >= expanded.min.y && testPos.y <= expanded.max.y) {
          if (expanded.containsPoint(testPos)) {
            validDist = Math.max(0, (s - 1) * stepSize - 0.3);
            break;
          }
        }
      }
      if (validDist < targetDist) break;
    }

    const finalPos = playerPos.clone().addScaledVector(dir, validDist);
    for (const box of structureBoxes) {
      const expanded = box.clone();
      expanded.min.subScalar(playerRadius);
      expanded.max.addScalar(playerRadius);
      if (finalPos.y >= expanded.min.y && finalPos.y <= expanded.max.y && expanded.containsPoint(finalPos)) {
        return false;
      }
    }

    if (validDist < 3.0) {
      return false;
    }

    // Phase anchors
    this.startPost.copy(playerPos);
    this.finalPost.copy(finalPos);
    this.portalPost.copy(playerPos).addScaledVector(dir, Math.min(1.4, validDist * 0.2));
    this.exitPost.copy(finalPos).addScaledVector(dir, -0.8);
    this.dirVec.copy(dir);

    // Portal visuals
    this.portalA = this.createPortal(this.portalPost, dir, 1);
    this.portalB = this.createPortal(this.exitPost, dir, 2.2);

    // Restrictions (temporary, own source)
    this.totalDuration = cfg.duration;
    this.entryTime = cfg.duration * cfg.entryFraction;
    this.traverseTime = cfg.duration * cfg.traverseFraction;
    const safety = this.totalDuration + cfg.closeTime + 1.0;
    gameplayRestrictions.applyRestriction('NoPowers', PORTAL_SOURCE, safety);
    gameplayRestrictions.applyRestriction('NoBasicAttack', PORTAL_SOURCE, safety);
    gameplayRestrictions.applyRestriction('NoMovement', PORTAL_SOURCE, safety);

    this.phase = 'entry';
    this.phaseTime = 0;
    this.elapsed = 0;
    this.isActive = true;
    this.api = api;
    this.invulnApplied = false;
    this.cooldownRemaining = cfg.cooldown;

    // Face toward the first portal immediately
    api.setPlayerRotationY(Math.atan2(-dir.x, -dir.z));

    audioSystem.playShadowStep?.();
    this.onShake(0.05);

    return true;
  }

  private createPortal(at: THREE.Vector3, dir: THREE.Vector3, delayScale: number): PortalModel {
    const cfg = activeStrangeConfig.portalStep;
    const group = new THREE.Group();
    group.position.set(at.x, at.y + 1.05, at.z);
    group.lookAt(group.position.clone().add(dir));

    const rimMat = new THREE.MeshBasicMaterial({
      color: cfg.portalColor,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(cfg.portalRadius, 0.075, 12, 48), rimMat);
    group.add(rim);

    const innerRim = new THREE.Mesh(new THREE.TorusGeometry(cfg.portalRadius * 0.86, 0.03, 8, 40), rimMat);
    group.add(innerRim);

    const runeTex = this.fx.getRuneTexture('#ff8c1a', 12);
    const runeMat = new THREE.MeshBasicMaterial({
      map: runeTex,
      color: cfg.portalGlowColor,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const runeDisc = new THREE.Mesh(new THREE.CircleGeometry(cfg.portalRadius * 0.98, 40), runeMat);
    group.add(runeDisc);

    const discMat = new THREE.MeshBasicMaterial({
      color: cfg.portalColor,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(cfg.portalRadius * 0.95, 40), discMat);
    group.add(disc);

    const light = new THREE.PointLight(cfg.portalColor, 3.2, 8);
    group.add(light);

    group.scale.setScalar(0.01);
    this.scene.add(group);

    this.fx.spawnBurst(group.position.clone(), 10, cfg.portalColor, 1.0, 3.0, 0.1, 2.0);

    return { group, runeRing: runeDisc, runeMat, discMat, rimMat, light, baseScale: 1 - delayScale * 0.06 };
  }

  public update(dt: number): void {
    const cfg = activeStrangeConfig.portalStep;

    if (this.cooldownRemaining > 0) {
      this.cooldownRemaining = Math.max(0, this.cooldownRemaining - dt);
    }

    if (!this.isActive) return;

    this.elapsed += dt;
    this.phaseTime += dt;
    const now = performance.now();

    this.animatePortal(this.portalA, dt, now);
    this.animatePortal(this.portalB, dt, now);

    // Occasional embers around open portals
    if (Math.random() < 0.3) {
      const p = this.portalA || this.portalB;
      if (p) {
        this.fx.spawnBurst(p.group.position.clone(), 1, cfg.portalColor, 0.3, 1.6, 0.08, 1.5);
      }
    }

    if (this.phase === 'entry') {
      const k = THREE.MathUtils.clamp(this.phaseTime / this.entryTime, 0, 1);
      const smooth = k * k * (3 - 2 * k);
      const pos = this.startPost.clone().lerp(this.portalPost, smooth);
      this.api?.setPlayerPos(pos.x, pos.z);

      if (k >= 1) {
        this.phase = 'traverse';
        this.phaseTime = 0;
        gameplayRestrictions.applyRestriction('Invulnerable', PORTAL_SOURCE, this.traverseTime);
        this.invulnApplied = true;
        this.api?.setPlayerVisible(false);
        this.spawnTraversalStreak();
        audioSystem.playShadowStep?.();
      }
      return;
    }

    if (this.phase === 'traverse') {
      if (this.phaseTime >= this.traverseTime) {
        this.phase = 'exit';
        this.phaseTime = 0;
        if (this.invulnApplied) {
          gameplayRestrictions.removeRestriction('Invulnerable', PORTAL_SOURCE);
          this.invulnApplied = false;
        }
        this.api?.setPlayerVisible(true);
        this.api?.setPlayerPos(this.exitPost.x, this.exitPost.z);
        this.fx.spawnBurst(this.portalB?.group.position.clone() ?? this.exitPost, 14, cfg.portalGlowColor, 1.5, 4.0, 0.1, 2.5);
        this.onShake(0.04);
      }
      return;
    }

    if (this.phase === 'exit') {
      const k = THREE.MathUtils.clamp(this.phaseTime / (this.totalDuration - this.entryTime - this.traverseTime), 0, 1);
      const smooth = k * k * (3 - 2 * k);
      const pos = this.exitPost.clone().lerp(this.finalPost, smooth);
      this.api?.setPlayerPos(pos.x, pos.z);

      if (k >= 1) {
        this.phase = 'closing';
        this.phaseTime = 0;
        this.isActive = false;

        gameplayRestrictions.clearRestrictionsBySource(PORTAL_SOURCE);
        audioSystem.playShadowStep?.();
      }
      return;
    }

    if (this.phase === 'closing') {
      if (this.phaseTime >= cfg.closeTime) {
        this.cleanupPortals();
        this.phase = 'idle';
      }
      return;
    }
  }

  private spawnTraversalStreak(): void {
    if (!this.portalA || !this.portalB) return;
    const steps = 6;
    for (let i = 0; i <= steps; i++) {
      const p = this.portalA.group.position.clone().lerp(this.portalB.group.position, i / steps);
      p.y += Math.sin(i / steps * Math.PI) * 0.5;
      this.fx.spawnBurst(p, 3, activeStrangeConfig.portalStep.portalGlowColor, 0.4, 1.8, 0.12, 1.0);
    }
  }

  private animatePortal(portal: PortalModel | null, dt: number, now: number): void {
    if (!portal) return;
    const cfg = activeStrangeConfig.portalStep;

    const closing = this.phase === 'closing';
    const closeK = closing ? THREE.MathUtils.clamp(this.phaseTime / cfg.closeTime, 0, 1) : 0;
    const target = closing ? Math.max(0.001, (1 - closeK) * portal.baseScale) : portal.baseScale;
    portal.group.scale.setScalar(
      THREE.MathUtils.damp(portal.group.scale.x, target, closing ? 18 : 10, dt)
    );

    const fade = closing ? 1 - closeK : 1;
    portal.runeMat.opacity = 0.9 * fade;
    portal.discMat.opacity = (0.18 + Math.sin(now * 0.004) * 0.05) * fade;
    portal.rimMat.opacity = 0.95 * fade;
    portal.light.intensity = (3.0 + Math.sin(now * 0.006) * 0.9) * fade;

    portal.runeRing.rotation.z += dt * 1.6 * (closing ? 3 : 1);
  }

  private cleanupPortals(): void {
    for (const portal of [this.portalA, this.portalB]) {
      if (!portal) continue;
      this.scene.remove(portal.group);
      portal.group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const mat = obj.material as THREE.Material | THREE.Material[];
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat.dispose();
        }
      });
    }
    this.portalA = null;
    this.portalB = null;
  }

  public get totalCooldown(): number {
    return activeStrangeConfig.portalStep.cooldown;
  }

  public cancel(): void {
    if (this.invulnApplied) {
      gameplayRestrictions.removeRestriction('Invulnerable', PORTAL_SOURCE);
      this.invulnApplied = false;
    }
    if (this.phase !== 'idle') {
      this.cooldownRemaining = activeStrangeConfig.portalStep.cooldown;
    }
    gameplayRestrictions.clearRestrictionsBySource(PORTAL_SOURCE);
    this.api?.setPlayerVisible(true);
    this.api = null;
    this.phase = 'idle';
    this.isActive = false;
    this.cleanupPortals();
  }

  public dispose(): void {
    this.cancel();
  }
}

