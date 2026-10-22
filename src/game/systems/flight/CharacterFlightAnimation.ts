/**
 * CharacterFlightAnimation.ts
 * Flight pose layer. AnimationController computes the base locomotion pose,
 * then delegates the flight overlay to this module so each flight style can
 * have its own silhouette without duplicating physics.
 */

import * as THREE from 'three';
import type { StickmanNodes } from '../../StickmanRig';
import type { FlightStyle } from './CharacterFlightConfig';

export interface FlightPoseTargets {
  waistRotX: number;
  waistRotZ: number;
  headRotX: number;
  leftShoulderRotX: number;
  leftShoulderRotZ: number;
  leftElbowRotX: number;
  leftWristRotX: number;
  rightShoulderRotX: number;
  rightShoulderRotZ: number;
  rightElbowRotX: number;
  rightWristRotX: number;
  pelvisRoll: number;
}

export interface FlightAnimationParams {
  style: FlightStyle;
  blend: number;
  roll: number;
  speed: number;
  dashing: boolean;
  lockArms: boolean;
}

export class CharacterFlightAnimation {
  public static apply(
    nodes: StickmanNodes,
    targets: FlightPoseTargets,
    params: FlightAnimationParams
  ): void {
    const blend = params.blend;
    if (blend <= 0.001) return;

    const arcane = params.style === 'arcane';

    const legPitch = arcane
      ? -0.16 - (params.dashing ? 0.30 : params.speed * 0.15)
      : -0.32 - (params.dashing ? 0.45 : params.speed * 0.28);
    const kneePitch = arcane ? -0.32 : -0.15;
    const anklePitch = arcane ? 0.22 : 0.45;

    nodes.leftHip.rotation.x = THREE.MathUtils.lerp(nodes.leftHip.rotation.x, legPitch, blend);
    nodes.rightHip.rotation.x = THREE.MathUtils.lerp(nodes.rightHip.rotation.x, legPitch, blend);
    nodes.leftKnee.rotation.x = THREE.MathUtils.lerp(nodes.leftKnee.rotation.x, kneePitch, blend);
    nodes.rightKnee.rotation.x = THREE.MathUtils.lerp(nodes.rightKnee.rotation.x, kneePitch, blend);
    nodes.leftAnkle.rotation.x = THREE.MathUtils.lerp(nodes.leftAnkle.rotation.x, anklePitch, blend);
    nodes.rightAnkle.rotation.x = THREE.MathUtils.lerp(nodes.rightAnkle.rotation.x, anklePitch, blend);

    if (!params.lockArms) {
      if (arcane) {
        const armFlightX = -0.18 - (params.dashing ? 0.35 : params.speed * 0.18);
        targets.leftShoulderRotX = THREE.MathUtils.lerp(targets.leftShoulderRotX, armFlightX, blend);
        targets.leftShoulderRotZ = THREE.MathUtils.lerp(targets.leftShoulderRotZ, -0.55, blend);
        targets.leftElbowRotX = THREE.MathUtils.lerp(targets.leftElbowRotX, 0.32, blend);
        targets.leftWristRotX = THREE.MathUtils.lerp(targets.leftWristRotX, -0.08, blend);

        targets.rightShoulderRotX = THREE.MathUtils.lerp(targets.rightShoulderRotX, armFlightX, blend);
        targets.rightShoulderRotZ = THREE.MathUtils.lerp(targets.rightShoulderRotZ, 0.55, blend);
        targets.rightElbowRotX = THREE.MathUtils.lerp(targets.rightElbowRotX, 0.32, blend);
        targets.rightWristRotX = THREE.MathUtils.lerp(targets.rightWristRotX, -0.08, blend);
      } else {
        const armFlightX = -0.36 - (params.dashing ? 0.55 : params.speed * 0.32);
        targets.leftShoulderRotX = THREE.MathUtils.lerp(targets.leftShoulderRotX, armFlightX, blend);
        targets.leftShoulderRotZ = THREE.MathUtils.lerp(targets.leftShoulderRotZ, -0.24, blend);
        targets.leftElbowRotX = THREE.MathUtils.lerp(targets.leftElbowRotX, 0.18, blend);
        targets.leftWristRotX = THREE.MathUtils.lerp(targets.leftWristRotX, -0.24, blend);

        targets.rightShoulderRotX = THREE.MathUtils.lerp(targets.rightShoulderRotX, armFlightX, blend);
        targets.rightShoulderRotZ = THREE.MathUtils.lerp(targets.rightShoulderRotZ, 0.24, blend);
        targets.rightElbowRotX = THREE.MathUtils.lerp(targets.rightElbowRotX, 0.18, blend);
        targets.rightWristRotX = THREE.MathUtils.lerp(targets.rightWristRotX, -0.24, blend);
      }
    }

    const forwardLean = arcane
      ? -0.20 * (params.dashing ? 1.4 : Math.max(0.15, params.speed))
      : -0.36 * (params.dashing ? 1.6 : Math.max(0.22, params.speed));
    targets.waistRotX = THREE.MathUtils.lerp(targets.waistRotX, forwardLean, blend);
    targets.headRotX = THREE.MathUtils.lerp(targets.headRotX, -forwardLean * 0.8, blend);

    targets.pelvisRoll += params.roll * blend;
    targets.waistRotZ += params.roll * (arcane ? 0.35 : 0.48) * blend;
  }
}
