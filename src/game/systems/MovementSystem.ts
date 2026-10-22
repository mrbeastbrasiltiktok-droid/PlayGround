import * as THREE from 'three';

export interface MovementInput {
  x: number;
  y: number;
  active: boolean;
}

export interface KeyboardState {
  [code: string]: boolean;
}

export class MovementSystem {
  public static readInput(
    joystick: MovementInput,
    keys: KeyboardState
  ): { x: number; y: number } {
    if (joystick.active) return { x: joystick.x, y: joystick.y };
    let x = 0;
    let y = 0;
    if (keys['KeyW'] || keys['ArrowUp']) y -= 1;
    if (keys['KeyS'] || keys['ArrowDown']) y += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) x -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) x += 1;
    return { x, y };
  }

  public static cameraRelativeDirection(
    camera: THREE.Camera,
    x: number,
    y: number
  ): THREE.Vector3 {
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3()
      .crossVectors(forward, new THREE.Vector3(0, 1, 0))
      .normalize();
    return new THREE.Vector3()
      .addScaledVector(right, x)
      .addScaledVector(forward, -y)
      .normalize();
  }

  public static tryMove(
    position: THREE.Vector3,
    direction: THREE.Vector3,
    distance: number,
    structures: THREE.Box3[],
    radius: number
  ): boolean {
    const next = position.clone().addScaledVector(direction, distance);
    for (const box of structures) {
      const expanded = box.clone();
      expanded.min.subScalar(radius);
      expanded.max.addScalar(radius);
      if (expanded.containsPoint(next)) return false;
    }
    position.x = next.x;
    position.z = next.z;
    return true;
  }
}

export default MovementSystem;
