/**
 * TargetingSystem.ts
 * Sistema compartilhado de aquisição de alvo e assistência de mira.
 * Seleciona o alvo mais alinhado ao centro da tela dentro de um cone angular e
 * de uma distância máxima, replicando a heurística usada pela GameScene.
 */

import * as THREE from 'three';
import { TargetDummy } from '../TargetDummy';

export interface TargetingConfig {
  /** Ângulo máximo (radianos) entre a direção da câmera e o alvo. */
  maxAngle?: number;
  /** Distância máxima do alvo em relação ao jogador. */
  maxDistance?: number;
}

export interface AimSnapshot {
  pos: THREE.Vector3;
  target: TargetDummy | null;
}

export class TargetingSystem {
  public static readonly DEFAULT_MAX_ANGLE = 0.28;
  public static readonly DEFAULT_MAX_DISTANCE = 30;

  /**
   * Escolhe o alvo mais alinhado à direção da câmera.
   * Retorna null quando a assistência está desligada ou nenhum alvo é válido.
   */
  public static selectTarget(
    camera: THREE.Camera,
    dummies: TargetDummy[],
    playerPos: THREE.Vector3,
    aimAssistEnabled: boolean,
    config: TargetingConfig = {}
  ): TargetDummy | null {
    if (!aimAssistEnabled) return null;

    const maxAngle = config.maxAngle ?? this.DEFAULT_MAX_ANGLE;
    const maxDistance = config.maxDistance ?? this.DEFAULT_MAX_DISTANCE;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const ray = raycaster.ray;

    let bestTarget: TargetDummy | null = null;
    let minAngle = maxAngle;

    for (const dummy of dummies) {
      if (dummy.isDead) continue;
      const center = dummy.getCenter();
      if (center.distanceTo(playerPos) > maxDistance) continue;

      const toDummy = center.clone().sub(ray.origin).normalize();
      const angle = Math.acos(THREE.MathUtils.clamp(ray.direction.dot(toDummy), -1, 1));
      if (angle < minAngle) {
        minAngle = angle;
        bestTarget = dummy;
      }
    }

    return bestTarget;
  }

  /**
   * Resolve o ponto de mira efetivo: centro do alvo travado ou o ponto livre.
   */
  public static resolveAim(
    activeTarget: TargetDummy | null,
    aimAssistEnabled: boolean,
    freeAimPoint: THREE.Vector3
  ): AimSnapshot {
    if (aimAssistEnabled && activeTarget && !activeTarget.isDead) {
      return { pos: activeTarget.getCenter(), target: activeTarget };
    }
    return { pos: freeAimPoint.clone(), target: null };
  }
}
