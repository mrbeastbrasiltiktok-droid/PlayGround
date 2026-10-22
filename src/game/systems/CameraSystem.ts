/**
 * CameraSystem.ts
 * Sistema compartilhado de câmera. Centraliza os vetores de órbita (build mode
 * e terceira pessoa) e o cálculo do tremor de tela, antes espalhados pela
 * GameScene.
 */

import * as THREE from 'three';

export interface ShakeResult {
  offset: THREE.Vector3;
  intensity: number;
}

export class CameraSystem {
  /** Direção normalizada de órbita usada para posicionar a câmera do editor. */
  public static buildOrbitDirection(yaw: number, pitch: number): THREE.Vector3 {
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);
    return new THREE.Vector3(
      Math.sin(yaw) * cosP,
      sinP,
      Math.cos(yaw) * cosP
    ).normalize();
  }

  /** Offset de órbita (com distância) da câmera do editor. */
  public static buildCameraOffset(yaw: number, pitch: number, distance: number): THREE.Vector3 {
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);
    return new THREE.Vector3(
      -Math.sin(yaw) * cosP * distance,
      sinP * distance,
      -Math.cos(yaw) * cosP * distance
    );
  }

  /** Direção de visão normalizada da câmera em terceira pessoa. */
  public static thirdPersonViewDirection(yaw: number, pitch: number): THREE.Vector3 {
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);
    return new THREE.Vector3(
      -Math.sin(yaw) * cosP,
      sinP,
      -Math.cos(yaw) * cosP
    ).normalize();
  }

  /**
   * Calcula o deslocamento do tremor e a intensidade restante.
   * Quando desativado (ou já imperceptível) retorna offset zero sem decair.
   */
  public static computeShake(
    intensity: number,
    scale: number,
    decay: number,
    dt: number,
    enabled: boolean
  ): ShakeResult {
    if (!enabled || intensity <= 0.001) {
      return { offset: new THREE.Vector3(), intensity };
    }
    const shake = intensity * scale;
    const offset = new THREE.Vector3(
      (Math.random() - 0.5) * shake,
      (Math.random() - 0.5) * shake,
      (Math.random() - 0.5) * shake
    );
    return { offset, intensity: THREE.MathUtils.damp(intensity, 0, decay, dt) };
  }
}
