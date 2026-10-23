/**
 * StrangeMysticFlight.ts
 * Mobility Module for Doctor Strange: Mystic Flight with the Cloak of Levitation.
 * The cape manifests behind the rig during flight (fading in/out smoothly) and
 * displays organic cloth motion based on real movement speed and banking.
 * Drives the existing GameScene flight controller with its own max speed, and
 * enforces the landing cooldown through a temporary NoFlight restriction.
 */

import * as THREE from 'three';
import { StickmanNodes } from '../../StickmanRig';
import { audioSystem } from '../../AudioSystem';
import { gameplayRestrictions } from '../../GameplayRestrictions';
import { activeStrangeConfig } from './DoctorStrangeConfig';

const FLIGHT_SOURCE = 'strange-mystic-flight';

interface CapeSegment {
  group: THREE.Group;
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  length: number;
}

export class StrangeMysticFlight {
  private scene: THREE.Scene;
  private stickman: StickmanNodes;
  private capeRoot: THREE.Group | null = null;
  private segments: CapeSegment[] = [];
  private sharedMaterials: THREE.Material[] = [];

  public isCapeVisible: boolean = false;
  private targetOpacity: number = 0;
  private currentOpacity: number = 0;
  private wasFlying: boolean = false;
  private lastPlayerPos: THREE.Vector3 = new THREE.Vector3();
  private smoothedSpeed: number = 0;
  private lastRotationY: number = 0;
  private smoothedBank: number = 0;

  constructor(scene: THREE.Scene, stickman: StickmanNodes) {
    this.scene = scene;
    this.stickman = stickman;
  }

  public getFlightSpeed(): number {
    return activeStrangeConfig.mysticFlight.speed;
  }

  public getFlightAccelerationDamp(): number {
    return activeStrangeConfig.mysticFlight.accelerationDamp;
  }

  public syncFlightState(isFlying: boolean): void {
    const cfg = activeStrangeConfig.mysticFlight;

    if (isFlying && !this.wasFlying) {
      this.takeOff();
    } else if (!isFlying && this.wasFlying) {
      this.land(cfg.landingCooldown);
    }
    this.wasFlying = isFlying;
  }

  private takeOff(): void {
    const cfg = activeStrangeConfig.mysticFlight;
    this.targetOpacity = 1;

    // The NoFlight landing cooldown from a previous landing must never block a takeoff
    gameplayRestrictions.removeRestriction('NoFlight', FLIGHT_SOURCE);

    if (!this.capeRoot) {
      this.buildCape(cfg.capeColor, cfg.capeTrimColor);
    }
    this.capeRoot!.visible = true;
    this.isCapeVisible = true;

    audioSystem.playArcaneFlight?.(true);
  }

  private land(cooldown: number): void {
    const cfg = activeStrangeConfig.mysticFlight;
    this.targetOpacity = 0;
    this.isCapeVisible = false;

    // Landing cooldown enforced by a temporary, self-expiring NoFlight restriction
    if (cooldown > 0) {
      gameplayRestrictions.applyRestriction('NoFlight', FLIGHT_SOURCE, cooldown);
    }

    audioSystem.playArcaneFlight?.(false);
  }

  public forceLand(): void {
    const cfg = activeStrangeConfig.mysticFlight;
    if (this.targetOpacity !== 0 || this.currentOpacity > 0.02) {
      this.land(cfg.landingCooldown);
      this.targetOpacity = 0;
      this.currentOpacity = 0;
      this.removeCape();
    }
    this.wasFlying = false;
    gameplayRestrictions.clearRestrictionsBySource(FLIGHT_SOURCE);
  }

  private buildCape(capeColor: number, trimColor: number): void {
    const cfg = activeStrangeConfig.mysticFlight;
    const capeRoot = new THREE.Group();
    capeRoot.position.set(0, 0.3, 0.13);

    const segmentCount = 4;
    const segLength = 0.27;
    let parent: THREE.Group = capeRoot;

    for (let i = 0; i < segmentCount; i++) {
      const width = 0.46 + i * 0.055;
      const material = new THREE.MeshStandardMaterial({
        color: capeColor,
        roughness: 0.72,
        metalness: 0.05,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0,
        emissive: 0x2a0300,
        emissiveIntensity: 0.35,
      });
      this.sharedMaterials.push(material);

      const trimMaterial = new THREE.MeshStandardMaterial({
        color: trimColor,
        roughness: 0.4,
        metalness: 0.1,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0,
        emissive: trimColor,
        emissiveIntensity: 0.55,
      });
      this.sharedMaterials.push(trimMaterial);

      const group = new THREE.Group();
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, segLength, 1, 2), material);
      mesh.position.y = -segLength / 2;
      mesh.castShadow = true;
      group.add(mesh);

      if (i === segmentCount - 1) {
        const trim = new THREE.Mesh(new THREE.BoxGeometry(width, 0.035, 0.01), trimMaterial);
        trim.position.y = -segLength + 0.018;
        group.add(trim);
      }

      parent.add(group);
      this.segments.push({
        group,
        mesh,
        material,
        length: segLength,
      });

      const next = new THREE.Group();
      next.position.y = -segLength;
      group.add(next);
      parent = next;
    }

    this.stickman.upperTorso.add(capeRoot);
    this.capeRoot = capeRoot;
  }

  public update(dt: number, playerPos: THREE.Vector3, playerRotationY: number): void {
    const cfg = activeStrangeConfig.mysticFlight;

    if (!this.capeRoot) {
      if (this.targetOpacity > 0) {
        this.takeOff();
      }
      return;
    }

    // Estimate real movement speed for cloth dynamics
    const delta = playerPos.distanceTo(this.lastPlayerPos);
    if (dt > 0.0001) {
      const instSpeed = delta / dt;
      this.smoothedSpeed = THREE.MathUtils.damp(this.smoothedSpeed, instSpeed, 8, dt);
    }
    this.lastPlayerPos.copy(playerPos);

    const bankDelta = playerRotationY - this.lastRotationY;
    let diff = bankDelta;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    this.lastRotationY = playerRotationY;
    this.smoothedBank = THREE.MathUtils.damp(this.smoothedBank, THREE.MathUtils.clamp(diff * 2.2, -0.5, 0.5), 7, dt);

    // Opacity fade in/out
    const fadeRate = cfg.fadeTime;
    const step = dt / Math.max(0.001, fadeRate);
    if (this.currentOpacity < this.targetOpacity) {
      this.currentOpacity = Math.min(this.targetOpacity, this.currentOpacity + step);
    } else if (this.currentOpacity > this.targetOpacity) {
      this.currentOpacity = Math.max(this.targetOpacity, this.currentOpacity - step);
    }
    for (const mat of this.sharedMaterials) {
      mat.opacity = this.currentOpacity;
    }

    if (this.targetOpacity === 0 && this.currentOpacity <= 0.005) {
      this.removeCape();
      return;
    }

    // Cloth motion: drape when grounded, stream behind when flying fast
    const now = performance.now();
    const speedK = THREE.MathUtils.clamp(this.smoothedSpeed / Math.max(1, cfg.speed), 0, 1);
    const streamBlend = this.targetOpacity > 0.5 ? THREE.MathUtils.clamp(speedK * 1.4, 0, 1) : 0;
    const flutter = Math.sin(now * 0.012) * (0.05 + speedK * 0.12);

    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      const baseDrape = 0.2 + i * 0.14;
      const streamed = 1.05 + i * 0.16 + speedK * 0.35;
      const targetX = THREE.MathUtils.lerp(baseDrape, streamed, streamBlend);
      seg.group.rotation.x = THREE.MathUtils.damp(
        seg.group.rotation.x,
        targetX + flutter * (0.4 + i * 0.3),
        9,
        dt
      );
      seg.group.rotation.z = THREE.MathUtils.damp(
        seg.group.rotation.z,
        this.smoothedBank * (0.35 + i * 0.18) + Math.sin(now * 0.008 + i) * 0.04,
        9,
        dt
      );
    }
  }

  private removeCape(): void {
    if (!this.capeRoot) return;
    this.capeRoot.parent?.remove(this.capeRoot);
    this.capeRoot.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
      }
    });
    for (const mat of this.sharedMaterials) {
      mat.dispose();
    }
    this.sharedMaterials = [];
    this.segments = [];
    this.capeRoot = null;
  }

  public cancel(): void {
    this.targetOpacity = 0;
    this.currentOpacity = 0;
    this.wasFlying = false;
    gameplayRestrictions.clearRestrictionsBySource(FLIGHT_SOURCE);
    this.removeCape();
  }

  public dispose(): void {
    this.cancel();
  }
}
