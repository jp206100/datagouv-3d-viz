import * as THREE from 'three';

class SimpleOrbitControls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.target = new THREE.Vector3(0, 0, 0);
    this.autoRotate = false;
    this.autoRotateSpeed = 0.5;
    this.spherical = new THREE.Spherical();
    this.sphericalDelta = new THREE.Spherical();
    this._isDragging = false;
    this._previousMouse = new THREE.Vector2();
    this._dampingFactor = 0.05;
    this._initialPosition = camera.position.clone();
    this._initialTarget = this.target.clone();
    const offset = camera.position.clone().sub(this.target);
    this.spherical.setFromVector3(offset);
    this._bindEvents();
  }
  _bindEvents() {
    this.domElement.addEventListener('pointerdown', (e) => { this._isDragging = true; this._previousMouse.set(e.clientX, e.clientY); });
    this.domElement.addEventListener('pointermove', (e) => {
      if (!this._isDragging) return;
      this.sphericalDelta.theta -= (e.clientX - this._previousMouse.x) * 0.005;
      this.sphericalDelta.phi -= (e.clientY - this._previousMouse.y) * 0.005;
      this._previousMouse.set(e.clientX, e.clientY);
    });
    this.domElement.addEventListener('pointerup', () => { this._isDragging = false; });
    this.domElement.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.spherical.radius = Math.max(10, Math.min(100, this.spherical.radius * (e.deltaY > 0 ? 1.1 : 0.9)));
    }, { passive: false });
  }
  reset() {
    this.camera.position.copy(this._initialPosition);
    this.target.copy(this._initialTarget);
    this.spherical.setFromVector3(this.camera.position.clone().sub(this.target));
    this.sphericalDelta.set(0, 0, 0);
  }
  update() {
    if (this.autoRotate) this.sphericalDelta.theta -= ((2 * Math.PI) / 60 / 60) * this.autoRotateSpeed;
    this.spherical.theta += this.sphericalDelta.theta * this._dampingFactor;
    this.spherical.phi += this.sphericalDelta.phi * this._dampingFactor;
    this.spherical.phi = Math.max(0.15, Math.min(Math.PI / 2.2, this.spherical.phi));
    this.sphericalDelta.theta *= 1 - this._dampingFactor;
    this.sphericalDelta.phi *= 1 - this._dampingFactor;
    this.camera.position.copy(this.target).add(new THREE.Vector3().setFromSpherical(this.spherical));
    this.camera.lookAt(this.target);
  }
}

export function createControls(camera, domElement) { return new SimpleOrbitControls(camera, domElement); }
export function updateControls(controls) { controls.update(); }
