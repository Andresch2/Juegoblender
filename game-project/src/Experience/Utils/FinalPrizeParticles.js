// FinalPrizeParticles.js (versión optimizada con THREE.Points)
import * as THREE from 'three'

export default class FinalPrizeParticles {
  constructor({ scene, targetPosition, sourcePosition, experience }) {
    this.scene = scene
    this.experience = experience
    this.clock = new THREE.Clock()

    this.count = 140
    this.angles = new Float32Array(this.count)
    this.radii = new Float32Array(this.count)
    this.heights = new Float32Array(this.count)
    this.positions = new Float32Array(this.count * 3)

    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3
      const angle = Math.random() * Math.PI * 2
      const radius = 1.2 + Math.random() * 3.2
      const y = Math.random() * 4

      this.angles[i] = angle
      this.radii[i] = radius
      this.heights[i] = y

      this.positions[i3 + 0] = sourcePosition.x + Math.cos(angle) * radius
      this.positions[i3 + 1] = sourcePosition.y + y
      this.positions[i3 + 2] = sourcePosition.z + Math.sin(angle) * radius
    }

    this.geometry = new THREE.BufferGeometry()
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))

    const material = new THREE.PointsMaterial({
      size: 0.22,
      color: 0x27f5d2,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
      depthWrite: false
    })

    this.points = new THREE.Points(this.geometry, material)
    this.scene.add(this.points)

    this.target = targetPosition.clone()
    this.experience.time.on('tick', this.update)

    // Eliminar luego de unos segundos
    setTimeout(() => this.dispose(), 8000)
  }

  update = () => {
    const delta = this.clock.getDelta()

    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3

      this.angles[i] += 2.8 * delta
      this.radii[i] *= 0.992
      this.heights[i] += 1.3 * delta

      if (this.radii[i] < 0.35 || this.heights[i] > 4.8) {
        this.radii[i] = 1.4 + Math.random() * 3
        this.heights[i] = Math.random() * 0.5
      }

      this.positions[i3 + 0] = this.target.x + Math.cos(this.angles[i]) * this.radii[i]
      this.positions[i3 + 2] = this.target.z + Math.sin(this.angles[i]) * this.radii[i]
      this.positions[i3 + 1] = this.target.y + this.heights[i]
    }

    this.geometry.attributes.position.needsUpdate = true
  }

  dispose() {
    this.experience.time.off('tick', this.update)
    this.scene.remove(this.points)
    this.geometry.dispose()
    this.points.material.dispose()
  }
}
