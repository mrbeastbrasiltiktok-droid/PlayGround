/**
 * StrangeMysticBeam.ts
 * Ability 1 Module for Doctor Strange: Orange Mystic Beam.
 * A sustained energy beam channeled from the real right-hand position, tracking the
 * aim reticle, decorated with spinning mystic circles along its length, dealing
 * interval-based tick damage. Applies NoPowers + NoBasicAttack while active.
 */

import * as THREE from 'three';
import { TargetDummy } from '../../TargetDummy';
import { StickmanNodes } from '../../StickmanRig';
import { audioSystem } from '../../AudioSystem';
import { gameplayRestrictions } from '../../GameplayRestrictions';
import { StrangeFx } from './StrangeFx';
import { activeStrangeConfig } from './DoctorStrangeConfig';

const BEAM_SOURCE = 'strange-mystic-beam';
const UP = new THREE.Vector3(0, 1, 0);
const CIRCLE_NORMAL = new THREE.Vector3(0, 0, 1);

export class StrangeMysticBeam {
  private scene: THREE.Scene;
  private stickman: StickmanNodes;
  private getAimDestination: () => { pos: THREE.Vector3; target: TargetDummy | null };
  private onDamageDealt: (dummy: TargetDummy, dmg: number, hitPos: THREE.Vector3, knockback?: THREE.Vector3) => void;
  private onShake: (amount: number) => void;
  private fx: StrangeFx;

  public isActive: boolean = false;

  private activeTime: number = 0;
  private damageTimer: number = 0;
  private fading: boolean = false;
  private fadeTimer: number = 0;

  private group: THREE.Group;
  private coreMesh: THREE.Mesh;
  private glowMesh: THREE.Mesh;
  private outerMesh: THREE.Mesh;
  private muzzleFlash: THREE.Mesh;
  private endGlow: THREE.Mesh;
  private beamLight: THREE.PointLight;
  private circles: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; t: number; radius: number; spin: number; bob: number }[] = [];
  private fadeMaterials: { mat: THREE.MeshBasicMaterial; baseOpacity: number }[] = [];

  constructor(
    scene: THREE.Scene,
    stickman: StickmanNodes,
    getAimDestination: () => { pos: THREE.Vector3; target: TargetDummy | null },
    onDamageDealt: (dummy: TargetDummy, dmg: number, hitPos: THREE.Vector3, knockback?: THREE.Vector3) => void,
    onShake: (amount: number) => void,
    fx: StrangeFx
  ) {
    this.scene = scene;
    this.stickman = stickman;
    this.getAimDestination = getAimDestination;
    this.onDamageDealt = onDamageDealt;
    this.onShake = onShake;
    this.fx = fx;

    const cfg = activeStrangeConfig.mysticBeam;

    this.group = new THREE.Group();
    this.group.visible = false;
    this.scene.add(this.group);

    const coreGeo = new THREE.CylinderGeometry(0.055, 0.055, 1, 10, 1, true);
    const coreMat = new THREE.MeshBasicMaterial({
      color: cfg.coreColor,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.coreMesh = new THREE.Mesh(coreGeo, coreMat);
    this.group.add(this.coreMesh);
    this.fadeMaterials.push({ mat: coreMat, baseOpacity: 1.0 });

    const glowGeo = new THREE.CylinderGeometry(0.14, 0.14, 1, 12, 1, true);
    const glowMat = new THREE.MeshBasicMaterial({
      color: cfg.glowColor,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.glowMesh = new THREE.Mesh(glowGeo, glowMat);
    this.group.add(this.glowMesh);
    this.fadeMaterials.push({ mat: glowMat, baseOpacity: 0.75 });

    const outerGeo = new THREE.CylinderGeometry(0.26, 0.26, 1, 14, 1, true);
    const outerMat = new THREE.MeshBasicMaterial({
      color: cfg.outerColor,
      transparent: true,
      opacity: 0.34,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.outerMesh = new THREE.Mesh(outerGeo, outerMat);
    this.group.add(this.outerMesh);
    this.fadeMaterials.push({ mat: outerMat, baseOpacity: 0.34 });

    // Mystic circles integrated along the beam
    const circleTex = this.fx.getRuneTexture('#ffa040', 10);
    for (let i = 0; i < Math.max(1, Math.round(cfg.circleCount)); i++) {
      const radius = 0.5 + (i % 3) * 0.28 + Math.random() * 0.15;
      const circleGeo = new THREE.CircleGeometry(radius, 32);
      const circleMat = new THREE.MeshBasicMaterial({
        map: circleTex,
        color: cfg.circleColor,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(circleGeo, circleMat);
      this.group.add(mesh);
      this.circles.push({
        mesh,
        mat: circleMat,
        t: 0.22 + (i / Math.max(1, Math.round(cfg.circleCount) - 1 || 1)) * 0.68,
        radius,
        spin: (i % 2 === 0 ? 1 : -1) * cfg.circleSpin * (0.7 + Math.random() * 0.6),
        bob: Math.random() * Math.PI * 2,
      });
      this.fadeMaterials.push({ mat: circleMat, baseOpacity: 0.85 });
    }

    this.muzzleFlash = new THREE.Mesh(
      new THREE.CircleGeometry(0.34, 24),
      new THREE.MeshBasicMaterial({
        color: cfg.coreColor,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.group.add(this.muzzleFlash);
    this.fadeMaterials.push({ mat: this.muzzleFlash.material as THREE.MeshBasicMaterial, baseOpacity: 0.9 });

    this.endGlow = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 16, 16),
      new THREE.MeshBasicMaterial({
        color: cfg.coreColor,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.endGlow.visible = false;
    this.group.add(this.endGlow);
    this.fadeMaterials.push({ mat: this.endGlow.material as THREE.MeshBasicMaterial, baseOpacity: 0.9 });

    this.beamLight = new THREE.PointLight(cfg.glowColor, 0, 9);
    this.group.add(this.beamLight);
  }

  public start(): boolean {
    const cfg = activeStrangeConfig.mysticBeam;
    if (this.isActive || this.fading) return false;

    this.isActive = true;
    this.activeTime = 0;
    this.damageTimer = 0;
    this.fading = false;
    this.group.visible = true;
    this.beamLight.intensity = 4.0;

    const safety = cfg.maxDuration + cfg.fadeOut + 1.0;
    gameplayRestrictions.applyRestriction('NoPowers', BEAM_SOURCE, safety);
    gameplayRestrictions.applyRestriction('NoBasicAttack', BEAM_SOURCE, safety);

    audioSystem.playBeamBurst();
    this.onShake(0.05);

    return true;
  }

  public stop(): void {
    if (!this.isActive) return;
    this.isActive = false;
    this.fading = true;
    this.fadeTimer = 0;

    gameplayRestrictions.clearRestrictionsBySource(BEAM_SOURCE);
  }

  /** Immediate, reusable reset (no disposal): used on respawn / cancellation. */
  public reset(): void {
    this.isActive = false;
    this.fading = false;
    this.fadeTimer = 0;
    this.damageTimer = 0;
    gameplayRestrictions.clearRestrictionsBySource(BEAM_SOURCE);
    this.finishFade();
  }

  private finishFade(): void {
    this.fading = false;
    this.group.visible = false;
    this.endGlow.visible = false;
    for (const entry of this.fadeMaterials) {
      entry.mat.opacity = entry.baseOpacity;
    }
  }

  public update(dt: number, dummies: TargetDummy[]): void {
    const cfg = activeStrangeConfig.mysticBeam;

    if (this.fading) {
      this.fadeTimer += dt;
      const k = Math.min(1, this.fadeTimer / cfg.fadeOut);
      const kInv = 1 - k;
      for (const entry of this.fadeMaterials) {
        entry.mat.opacity = entry.baseOpacity * kInv;
      }
      this.beamLight.intensity = 4.0 * kInv;
      for (const c of this.circles) {
        c.mesh.scale.setScalar(Math.max(0.01, kInv));
      }
      if (k >= 1) {
        this.finishFade();
      }
      return;
    }

    if (!this.isActive) return;

    this.activeTime += dt;
    if (this.activeTime >= cfg.maxDuration) {
      this.stop();
      return;
    }

    const handPos = new THREE.Vector3();
    this.stickman.rightHand.getWorldPosition(handPos);

    const aim = this.getAimDestination();
    const end = aim.pos.clone();
    if (handPos.distanceTo(end) > cfg.range) {
      const dir = end.clone().sub(handPos).normalize();
      end.copy(handPos).addScaledVector(dir, cfg.range);
    }

    const dirVec = end.clone().sub(handPos);
    const dist = Math.max(0.001, dirVec.length());
    dirVec.normalize();
    const mid = handPos.clone().add(end).multiplyScalar(0.5);

    this.orientCylinder(this.coreMesh, mid, dirVec, dist, 1.0 + Math.sin(performance.now() * 0.02) * 0.06);
    this.orientCylinder(this.glowMesh, mid, dirVec, dist, 1.0 + Math.sin(performance.now() * 0.017 + 1.3) * 0.1);
    this.orientCylinder(this.outerMesh, mid, dirVec, dist, 1.0 + Math.sin(performance.now() * 0.013 + 2.6) * 0.14);

    // Mystic circles riding the beam, each spinning around the beam axis
    const now = performance.now();
    for (const c of this.circles) {
      const t = THREE.MathUtils.clamp(c.t + Math.sin(now * 0.0012 + c.bob) * 0.04, 0.08, 0.96);
      c.mesh.position.copy(handPos).addScaledVector(dirVec, dist * t);
      c.mesh.quaternion.setFromUnitVectors(CIRCLE_NORMAL, dirVec);
      c.mesh.rotateZ(now * 0.001 * c.spin);
      c.mesh.visible = true;
    }

    this.muzzleFlash.position.copy(handPos).addScaledVector(dirVec, 0.1);
    this.muzzleFlash.quaternion.setFromUnitVectors(CIRCLE_NORMAL, dirVec);
    const muzzlePulse = 0.85 + Math.sin(now * 0.03) * 0.15;
    this.muzzleFlash.scale.setScalar(muzzlePulse);

    this.beamLight.position.copy(handPos).addScaledVector(dirVec, dist * 0.35);
    this.beamLight.intensity = 3.4 + Math.sin(now * 0.02) * 0.8;

    // Sustained tick damage: single application per interval
    this.damageTimer += dt;
    if (this.damageTimer >= cfg.tickInterval) {
      this.damageTimer -= cfg.tickInterval;

      let tickTarget: TargetDummy | null = null;
      if (aim.target && !aim.target.isDead) {
        const d = this.distPointToSegment(aim.target.getCenter(), handPos, end);
        if (d <= aim.target.radius + 0.6) {
          tickTarget = aim.target;
        }
      }
      if (!tickTarget) {
        let minDist = Infinity;
        for (const dummy of dummies) {
          if (dummy.isDead) continue;
          const d = this.distPointToSegment(dummy.getCenter(), handPos, end);
          if (d <= dummy.radius + 0.5 && d < minDist) {
            minDist = d;
            tickTarget = dummy;
          }
        }
      }

      if (tickTarget) {
        const hitPos = tickTarget.getCenter();
        this.onDamageDealt(tickTarget, cfg.damagePerTick, hitPos);
        this.fx.spawnBurst(hitPos, 4, cfg.glowColor, 1.2, 3.2, 0.1, 4.0);
        audioSystem.playImpact();
        this.onShake(0.012);
      }
    }

    // End glow follows impact point when the beam meets a live target
    const hittingTarget = (aim.target && !aim.target.isDead &&
      this.distPointToSegment(aim.target.getCenter(), handPos, end) <= aim.target.radius + 0.6);
    this.endGlow.visible = !!hittingTarget;
    if (hittingTarget) {
      this.endGlow.position.copy(aim.target!.getCenter());
      const pulse = 0.8 + Math.sin(now * 0.025) * 0.2;
      this.endGlow.scale.setScalar(pulse);
    }
  }

  private orientCylinder(mesh: THREE.Mesh, mid: THREE.Vector3, dir: THREE.Vector3, dist: number, pulse: number): void {
    mesh.position.copy(mid);
    mesh.quaternion.setFromUnitVectors(UP, dir);
    mesh.scale.set(pulse, dist, pulse);
  }

  private distPointToSegment(p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3): number {
    const ab = b.clone().sub(a);
    const ap = p.clone().sub(a);
    const t = THREE.MathUtils.clamp(ap.dot(ab) / Math.max(0.0001, ab.lengthSq()), 0, 1);
    return a.clone().addScaledVector(ab, t).distanceTo(p);
  }

  public dispose(): void {
    this.isActive = false;
    this.fading = false;
    gameplayRestrictions.clearRestrictionsBySource(BEAM_SOURCE);
    this.scene.remove(this.group);
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const mat = obj.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat.dispose();
      }
    });
    this.circles = [];
    this.fadeMaterials = [];
  }
}
