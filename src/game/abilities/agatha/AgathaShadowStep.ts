/**
 * AgathaShadowStep.ts
 * Dash/Mobility Ability Module for Agatha Harkness: Passo das Sombras (Shadow Step).
 * Instantly dissolves Agatha into occult violet smoke and teleports in movement direction,
 * respecting obstacle collision boxes and projecting a landing runic sigil.
 */

import * as THREE from 'three';
import { audioSystem } from '../../AudioSystem';
import { activeAgathaConfig } from './AgathaConfig';
import { CollisionSystem } from '../../systems/CollisionSystem';

export class AgathaShadowStep {
  private scene: THREE.Scene;
  private onShake: (amount: number) => void;

  constructor(scene: THREE.Scene, onShake: (amount: number) => void) {
    this.scene = scene;
    this.onShake = onShake;
  }

  public execute(
    currentPos: THREE.Vector3,
    inputDir: THREE.Vector3,
    structureBoxes: THREE.Box3[],
    onTeleport: (dest: THREE.Vector3) => void
  ): boolean {
    const cfg = activeAgathaConfig.shadowStep;
    const teleportDistance = cfg.distance;
    const playerRadius = 0.55;

    const dir = inputDir.lengthSq() > 0.05 ? inputDir.clone().normalize() : new THREE.Vector3(0, 0, -1);
    dir.y = 0;

    const validDist = CollisionSystem.freeDistance(
      currentPos,
      dir,
      teleportDistance,
      structureBoxes,
      playerRadius
    );

    const destPos = currentPos.clone().addScaledVector(dir, validDist);

    // Teleport player
    onTeleport(destPos);

    // Audio and tactile feedback
    audioSystem.playShadowStep?.();
    this.onShake(0.04);

    return true;
  }

  public dispose(): void {
    // Clean up any remaining meshes if needed
  }
}
