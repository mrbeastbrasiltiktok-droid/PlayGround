/**
 * IronManDualBeam.ts
 * Ability 2 module for Iron Man: continuous dual-hand beams and Beam Clash.
 * The clash minigame itself lives in IronManBeamClash.ts.
 */

import * as THREE from 'three';
import { TargetDummy } from '../../TargetDummy';
import { StickmanNodes } from '../../StickmanRig';
import { audioSystem } from '../../AudioSystem';
import { activeIronManConfig } from './IronManConfig';
import { IronManBeamClash } from './IronManBeamClash';
import type { BeamClashState } from './IronManBeamClash';
import type { IronManExplosionCallback } from './IronManRepulsor';

export class IronManDualBeam {
  private scene: THREE.Scene;
  private stickman: StickmanNodes;
  private getAimDestination: () => { pos: THREE.Vector3; target: TargetDummy | null };
  private onDamageDealt: (dummy: TargetDummy, dmg: number, hitPos: THREE.Vector3, knockback?: THREE.Vector3) => void;
  private onShake: (amount: number) => void;
  private getCustomColor?: () => string | null;

  private active = false;
  private timer = 0;
  private damageTimer = 0;

  private leftBeamMesh: THREE.Line;
  private rightBeamMesh: THREE.Line;
  private leftBeamGlow: THREE.Mesh;
  private rightBeamGlow: THREE.Mesh;
  private clash: IronManBeamClash;

  constructor(
    scene: THREE.Scene,
    stickman: StickmanNodes,
    getAimDestination: () => { pos: THREE.Vector3; target: TargetDummy | null },
    onDamageDealt: (dummy: TargetDummy, dmg: number, hitPos: THREE.Vector3, knockback?: THREE.Vector3) => void,
    onShake: (amount: number) => void,
    getCustomColor?: () => string | null,
    onExplosion?: IronManExplosionCallback
  ) {
    this.scene = scene;
    this.stickman = stickman;
    this.getAimDestination = getAimDestination;
    this.onDamageDealt = onDamageDealt;
    this.onShake = onShake;
    this.getCustomColor = getCustomColor;

    const beamMat = new THREE.LineBasicMaterial({ color: 0xffea00, linewidth: 3 });
    const geomL = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const geomR = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    this.leftBeamMesh = new THREE.Line(geomL, beamMat);
    this.rightBeamMesh = new THREE.Line(geomR, beamMat);
    this.leftBeamMesh.visible = false;
    this.rightBeamMesh.visible = false;
    this.scene.add(this.leftBeamMesh);
    this.scene.add(this.rightBeamMesh);

    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xff2200,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });
    const glowGeo = new THREE.CylinderGeometry(0.12, 0.12, 1, 12, 1, true);
    this.leftBeamGlow = new THREE.Mesh(glowGeo, glowMat);
    this.rightBeamGlow = new THREE.Mesh(glowGeo, glowMat);
    this.leftBeamGlow.visible = false;
    this.rightBeamGlow.visible = false;
    this.scene.add(this.leftBeamGlow);
    this.scene.add(this.rightBeamGlow);

    this.clash = new IronManBeamClash(scene, onDamageDealt, onShake, onExplosion);
  }

  public get isActive(): boolean {
    return this.active;
  }

  public get clashState(): BeamClashState {
    return this.clash.clashState;
  }

  public toggle(): boolean {
    if (this.active) {
      this.stop();
      return false;
    }

    this.active = true;
    this.timer = 0;
    this.damageTimer = 0;
    audioSystem.playBeamBurst();
    return true;
  }

  public stop(): void {
    this.active = false;
    this.leftBeamMesh.visible = false;
    this.rightBeamMesh.visible = false;
    this.leftBeamGlow.visible = false;
    this.rightBeamGlow.visible = false;
    this.clash.stop();
  }

  public onClashTap(): void {
    this.clash.onTap();
  }

  public update(dt: number, dummies: TargetDummy[]): void {
    if (!this.active) return;

    const cfg = activeIronManConfig.dualBeams;
    const maxDuration = Math.max(0.1, cfg.maxDuration);
    this.timer += dt;
    if (this.timer >= maxDuration) {
      this.stop();
      return;
    }

    const custom = this.getCustomColor?.();
    if (custom) {
      const activeColor = new THREE.Color(custom);
      (this.leftBeamMesh.material as THREE.LineBasicMaterial).color.copy(activeColor);
      (this.rightBeamMesh.material as THREE.LineBasicMaterial).color.copy(activeColor);
      (this.leftBeamGlow.material as THREE.MeshBasicMaterial).color.copy(activeColor);
      (this.rightBeamGlow.material as THREE.MeshBasicMaterial).color.copy(activeColor);
    }

    const leftHandPos = new THREE.Vector3();
    const rightHandPos = new THREE.Vector3();
    this.stickman.leftHand.getWorldPosition(leftHandPos);
    this.stickman.rightHand.getWorldPosition(rightHandPos);

    const aim = this.getAimDestination();
    const maxRange = cfg.range;
    const midHand = leftHandPos.clone().add(rightHandPos).multiplyScalar(0.5);

    let endPoint = aim.pos.clone();
    if (midHand.distanceTo(endPoint) > maxRange) {
      const dir = endPoint.clone().sub(midHand).normalize();
      endPoint = midHand.clone().addScaledVector(dir, maxRange);
    }

    endPoint = this.clash.update(dt, midHand, endPoint, dummies, aim.target, maxRange);

    this.leftBeamMesh.visible = true;
    this.rightBeamMesh.visible = true;
    this.leftBeamGlow.visible = true;
    this.rightBeamGlow.visible = true;

    this.updateBeamMesh(this.leftBeamMesh, this.leftBeamGlow, leftHandPos, endPoint, 0.12);
    this.updateBeamMesh(this.rightBeamMesh, this.rightBeamGlow, rightHandPos, endPoint, 0.12);

    this.damageTimer += dt;
    if (this.damageTimer >= 0.25) {
      this.damageTimer = 0;

      let targetDummy: TargetDummy | null = null;
      if (aim.target && !aim.target.isDead) {
        const dist = this.distPointToSegment(aim.target.getCenter(), midHand, endPoint);
        if (dist <= aim.target.radius + 0.6) {
          targetDummy = aim.target;
        }
      }

      if (!targetDummy) {
        let minDist = Infinity;
        for (const dummy of dummies) {
          if (dummy.isDead) continue;
          const dist = this.distPointToSegment(dummy.getCenter(), midHand, endPoint);
          if (dist <= dummy.radius + 0.5 && dist < minDist) {
            minDist = dist;
            targetDummy = dummy;
          }
        }
      }

      if (targetDummy) {
        this.onDamageDealt(targetDummy, cfg.dps * 0.25, targetDummy.getCenter());
      }
    }
  }

  private updateBeamMesh(
    line: THREE.Line,
    glow: THREE.Mesh,
    start: THREE.Vector3,
    end: THREE.Vector3,
    thickness: number
  ): void {
    const geom = line.geometry as THREE.BufferGeometry;
    geom.setFromPoints([start, end]);

    const dist = start.distanceTo(end);
    const mid = start.clone().add(end).multiplyScalar(0.5);

    glow.position.copy(mid);
    glow.scale.set(thickness, dist, thickness);
    glow.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      end.clone().sub(start).normalize()
    );
  }

  private distPointToSegment(p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3): number {
    const ab = b.clone().sub(a);
    const ap = p.clone().sub(a);
    const t = THREE.MathUtils.clamp(ap.dot(ab) / ab.lengthSq(), 0, 1);
    const closest = a.clone().addScaledVector(ab, t);
    return closest.distanceTo(p);
  }

  public dispose(): void {
    this.active = false;
    this.scene.remove(this.leftBeamMesh);
    this.scene.remove(this.rightBeamMesh);
    this.scene.remove(this.leftBeamGlow);
    this.scene.remove(this.rightBeamGlow);
    this.clash.dispose();
  }
}
