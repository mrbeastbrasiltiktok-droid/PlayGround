/**
 * CollisionSystem.ts
 * Sistema compartilhado de colisão com as estruturas do cenário.
 * Centraliza a expansão das caixas de colisão pelo raio do personagem e os
 * testes de bloqueio usados por movimento, dash e Passo das Sombras.
 */

import * as THREE from 'three';

export class CollisionSystem {
  /** Expande uma caixa de colisão por um raio (margem do corpo do personagem). */
  public static expand(box: THREE.Box3, radius: number, out?: THREE.Box3): THREE.Box3 {
    const target = out ?? box.clone();
    if (out) target.copy(box);
    target.min.subScalar(radius);
    target.max.addScalar(radius);
    return target;
  }

  /** Verdadeiro se a posição cair dentro de alguma caixa expandida. */
  public static isCircleBlocked(
    position: THREE.Vector3,
    boxes: THREE.Box3[],
    radius: number
  ): boolean {
    const scratch = new THREE.Box3();
    for (const box of boxes) {
      const expanded = this.expand(box, radius, scratch);
      if (expanded.containsPoint(position)) return true;
    }
    return false;
  }

  /**
   * Verdadeiro se a posição estiver bloqueada dentro de uma faixa vertical,
   * exigindo que a altura esteja contida nos limites expandidos da caixa.
   */
  public static isCircleBlockedAtHeight(
    position: THREE.Vector3,
    boxes: THREE.Box3[],
    radius: number
  ): boolean {
    const scratch = new THREE.Box3();
    for (const box of boxes) {
      const expanded = this.expand(box, radius, scratch);
      if (position.y >= expanded.min.y && position.y <= expanded.max.y) {
        if (expanded.containsPoint(position)) return true;
      }
    }
    return false;
  }

  /**
   * Distância máxima livre ao longo de uma direção horizontal, parando antes
   * da primeira caixa de colisão. Usada por teleportes e avanços contínuos.
   */
  public static freeDistance(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance: number,
    boxes: THREE.Box3[],
    radius: number,
    stepSize = 0.4
  ): number {
    const dir = direction.clone();
    dir.y = 0;
    if (dir.lengthSq() <= 1e-6) return maxDistance;
    dir.normalize();

    const steps = Math.max(1, Math.ceil(maxDistance / stepSize));
    const testPoint = origin.clone();
    for (let s = 1; s <= steps; s++) {
      const distance = Math.min(maxDistance, s * stepSize);
      testPoint.copy(origin).addScaledVector(dir, distance);
      if (this.isCircleBlockedAtHeight(testPoint, boxes, radius)) {
        return Math.max(0, (s - 1) * stepSize - 0.2);
      }
    }
    return maxDistance;
  }
}
