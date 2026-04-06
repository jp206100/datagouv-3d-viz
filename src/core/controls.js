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
    this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._raycaster = new THREE.Raycaster();
    this._zoomNdc = new THREE.Vector2();
    const offset = camera.position.clone().sub(this.target);
    this.spherical.setFromVector3(offset);
    this._bindEvents();
  }
  _bindEvents() {
    this._activeTouches = new Map();
    this._lastPinchDist = 0;

    this.domElement.addEventListener('pointerdown', (e) => {
      this._activeTouches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this._activeTouches.size === 1) {
        this._isDragging = true;
        this._previousMouse.set(e.clientX, e.clientY);
      }
    });
    this.domElement.addEventListener('pointermove', (e) => {
      this._activeTouches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      // Pinch-to-zoom with two fingers
      if (this._activeTouches.size === 2) {
        var pts = Array.from(this._activeTouches.values());
        var dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (this._lastPinchDist > 0) {
          var factor = this._lastPinchDist / dist;
          var zoomIn = factor < 1;
          var midX = (pts[0].x + pts[1].x) / 2;
          var midY = (pts[0].y + pts[1].y) / 2;
          this._zoomTowardCursor(midX, midY, factor, zoomIn);
        }
        this._lastPinchDist = dist;
        this._isDragging = false;
        return;
      }
      if (!this._isDragging) return;
      this.sphericalDelta.theta -= (e.clientX - this._previousMouse.x) * 0.005;
      this.sphericalDelta.phi -= (e.clientY - this._previousMouse.y) * 0.005;
      this._previousMouse.set(e.clientX, e.clientY);
    });
    this.domElement.addEventListener('pointerup', (e) => {
      this._activeTouches.delete(e.pointerId);
      if (this._activeTouches.size < 2) this._lastPinchDist = 0;
      if (this._activeTouches.size === 0) this._isDragging = false;
    });
    this.domElement.addEventListener('pointercancel', (e) => {
      this._activeTouches.delete(e.pointerId);
      if (this._activeTouches.size < 2) this._lastPinchDist = 0;
      if (this._activeTouches.size === 0) this._isDragging = false;
    });
    this.domElement.addEventListener('wheel', (e) => {
      e.preventDefault();
      var zoomIn = e.deltaY < 0;
      var factor = zoomIn ? 0.9 : 1.1;
      this._zoomTowardCursor(e.clientX, e.clientY, factor, zoomIn);
    }, { passive: false });
    // Prevent default touch behavior (scrolling/pinch-zoom on the page)
    this.domElement.style.touchAction = 'none';
  }
  _zoomTowardCursor(clientX, clientY, factor, zoomIn) {
    var newRadius = this.spherical.radius * factor;
    newRadius = Math.max(10, Math.min(100, newRadius));
    var actualFactor = newRadius / this.spherical.radius;
    if (zoomIn) {
      // Shift the orbit target toward the ground point under the cursor.
      // The lerp amount matches the zoom ratio so the cursor point stays
      // visually fixed on screen (same principle as Google Maps).
      var rect = this.domElement.getBoundingClientRect();
      this._zoomNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      this._zoomNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      this._raycaster.setFromCamera(this._zoomNdc, this.camera);
      var hitPoint = new THREE.Vector3();
      if (this._raycaster.ray.intersectPlane(this._groundPlane, hitPoint)) {
        var t = 1 - actualFactor; // e.g. 0.1 when factor is 0.9
        this.target.lerp(hitPoint, t);
      }
    } else {
      // When zooming out, gradually pull the target back toward the initial
      // center so the user returns to the full-map overview.
      var t = 1 - (1 / actualFactor);
      this.target.lerp(this._initialTarget, t);
    }
    // Only update radius — leave theta/phi unchanged so the camera
    // dollies straight in/out without pivoting.
    this.spherical.radius = newRadius;
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
