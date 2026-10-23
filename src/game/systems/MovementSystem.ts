import * as THREE from 'three';

/**
 * Shared horizontal movement solver. Both walking and dashes use the same
 * expanded collision boxes so characters cannot clip through build mode
 * structures depending on which movement path is active.
 */
export function moveWithCollisions(
  position: THREE.Vector3,
  delta: THREE.Vector3,
  structureBoxes: THREE.Box3[],
  radius: number
): boolean {
  const next = position.clone().add(delta);
  for (const box of structureBoxes) {
    const expanded = box.clone();
    expanded.min.subScalar(radius);
    expanded.max.addScalar(radius);
    if (expanded.containsPoint(next)) return false;
  }

  position.x = next.x;
  position.z = next.z;
  return true;
}

export function normalizeInputVector(x: number, y: number): { x: number; y: number; magnitude: number } {
  const length = Math.hypot(x, y);
  if (length <= 0.05) return { x: 0, y: 0, magnitude: 0 };
  return {
    x: x / length,
    y: y / length,
    magnitude: Math.min(1, length),
  };
}
