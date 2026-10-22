/**
 * VFXSystem.ts
 * Sistema compartilhado de efeitos visuais de alto nível.
 * Orquestra a composição de impactos, destruições e teleportes sobre qualquer
 * emissor de partículas (ProjectileSystem) sem acoplamento direto a ele.
 */

import * as THREE from 'three';

export interface ParticleEmitter {
  emitImpactParticles(pos: THREE.Vector3, count: number, baseColor?: number): void;
  emitDestructionParticles(pos: THREE.Vector3): void;
}

export const VFX_COLORS = {
  agatha: 0xa855f7,
  ironman: 0x00f0ff,
  classic: 0x48cae4,
  destructionPrimary: 0xff9f1c,
  destructionSecondary: 0xe63946,
} as const;

export class VFXSystem {
  /** Faísca de impacto simples. */
  public static playImpact(
    emitter: ParticleEmitter,
    pos: THREE.Vector3,
    count: number,
    color: number = VFX_COLORS.classic
  ): void {
    emitter.emitImpactParticles(pos, count, color);
  }

  /** Explosão completa de destruição de alvo. */
  public static playDestruction(emitter: ParticleEmitter, pos: THREE.Vector3): void {
    emitter.emitDestructionParticles(pos);
  }

  /** Explosão de teleporte/respawn colorida pelo conjunto de poderes. */
  public static playTeleport(
    emitter: ParticleEmitter,
    pos: THREE.Vector3,
    powerSet: 'classic' | 'ironman' | 'agatha'
  ): void {
    const color =
      powerSet === 'agatha'
        ? VFX_COLORS.agatha
        : powerSet === 'ironman'
          ? VFX_COLORS.ironman
          : VFX_COLORS.classic;
    emitter.emitImpactParticles(pos, 25, color);
  }
}
