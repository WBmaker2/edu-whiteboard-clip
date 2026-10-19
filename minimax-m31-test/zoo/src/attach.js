import * as THREE from "three";

export function directionOf(x, y, z) {
  return new THREE.Vector3(x, y, z);
}

function scaledExtent(unit, radius, scale) {
  return radius * Math.hypot(unit.x * scale.x, unit.y * scale.y, unit.z * scale.z);
}

export function surfaceOffset(hostRadius, direction, radius, scale, protrusion = 0.02) {
  const unit = direction.clone().normalize();
  const extent = scaledExtent(unit, radius, scale);
  const distance = Math.max(0, hostRadius + protrusion - extent);
  return unit.multiplyScalar(distance);
}

export function surfaceReach(hostRadius, direction, radius, scale, protrusion = 0.02) {
  const unit = direction.clone().normalize();
  const extent = scaledExtent(unit, radius, scale);
  const distance = Math.max(0, hostRadius + protrusion - extent);
  return distance + extent;
}

export function studOffset(hostRadius, direction, radius) {
  const unit = direction.clone().normalize();
  return unit.multiplyScalar(Math.max(0, hostRadius - radius * 0.25));
}

export function studReach(hostRadius, direction, radius) {
  const unit = direction.clone().normalize();
  return Math.max(0, hostRadius - radius * 0.25) + radius;
}

export function attachmentOffset(hostRadius, direction, embedRatio = 0.86) {
  return direction.clone().normalize().multiplyScalar(hostRadius * embedRatio);
}
