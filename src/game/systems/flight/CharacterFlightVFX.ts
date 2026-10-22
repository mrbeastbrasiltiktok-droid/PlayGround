/**
 * CharacterFlightVFX.ts
 * Flight visuals: Iron Man repulsor thrusters and Agatha's arcane aura.
 * Physics and activation stay in FlightSystem / CharacterFlightAbility.
 */

import * as THREE from 'three';
import type { StickmanNodes } from '../../StickmanRig';
import type { ParticleEmitter } from '../VFXSystem';
import { VFXSystem, VFX_COLORS } from '../VFXSystem';
import type { FlightStyle } from './CharacterFlightConfig';

export interface FlightVfxParams {
  style: FlightStyle;
  active: boolean;
  landing: boolean;
  dashing: boolean;
  speedRatio: number;
  customColor: string | null;
}

export class CharacterFlightVFX {
  private auraTimer = 0;

  public update(
    dt: number,
    nodes: StickmanNodes,
    emitter: ParticleEmitter,
    params: FlightVfxParams
  ): void {
    const airborne = params.active || params.landing;

    if (params.style === 'arcane') {
      nodes.thrusters.leftFoot.setIntensity(0);
      nodes.thrusters.rightFoot.setIntensity(0);
      nodes.thrusters.leftHand.setIntensity(0);
      nodes.thrusters.rightHand.setIntensity(0);

      if (!airborne) {
        this.auraTimer = 0;
        return;
      }

      this.auraTimer -= dt;
      if (this.auraTimer <= 0) {
        this.auraTimer = 0.07;
        const auraPos = new THREE.Vector3();
        nodes.pelvis.getWorldPosition(auraPos);
        auraPos.y -= 0.15;
        VFXSystem.playImpact(emitter, auraPos, 3, VFX_COLORS.agatha);
      }
      return;
    }

    const footIntensity = params.dashing
      ? 2.2
      : airborne
        ? 1.0 + params.speedRatio * 0.6
        : 0;
    const handIntensity = params.dashing ? 1.5 : airborne ? 0.6 : 0;

    nodes.thrusters.leftFoot.setIntensity(footIntensity, params.customColor);
    nodes.thrusters.rightFoot.setIntensity(footIntensity, params.customColor);
    nodes.thrusters.leftHand.setIntensity(handIntensity, params.customColor);
    nodes.thrusters.rightHand.setIntensity(handIntensity, params.customColor);
  }

  public reset(): void {
    this.auraTimer = 0;
  }
}
