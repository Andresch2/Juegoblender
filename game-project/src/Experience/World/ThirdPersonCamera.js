import * as THREE from 'three'
import isMobileDevice from '../Utils/Device.js'

export default class ThirdPersonCamera {
    constructor(experience, target) {
        this.experience = experience
        this.camera = experience.camera.instance
        this.target = target

        const isMobile = isMobileDevice()

        // Distancia normal (nivel 1 - espacio abierto)
        this.distanciaLejos = isMobile ? -7 : -5
        this.alturaLejos    = isMobile ? 3.5 : 2.5

        // Distancia cercana (nivel 2 - laberinto angosto)
        this.distanciaCerca = -2.5
        this.alturaCerca    = 1.8

        // Cuál usar actualmente
        this.distanciaActual = this.distanciaLejos
        this.alturaActual    = this.alturaLejos
    }

    setModo(modo) {
        // modo: 'lejos' para nivel abierto, 'cerca' para laberinto
        if (modo === 'cerca') {
            this.distanciaActual = this.distanciaCerca
            this.alturaActual    = this.alturaCerca
        } else {
            this.distanciaActual = this.distanciaLejos
            this.alturaActual    = this.alturaLejos
        }
    }

    update() {
        if (!this.target) return

        const base = this.target.position.clone()

        const dir = new THREE.Vector3(0, 0, 1)
            .applyEuler(this.target.rotation)
            .normalize()

        const camPos = new THREE.Vector3(
            base.x + dir.x * this.distanciaActual,
            this.alturaActual,
            base.z + dir.z * this.distanciaActual
        )

        this.camera.position.lerp(camPos, 0.18)

        const lookAt = base.clone().add(new THREE.Vector3(0, 1.0, 0))
        this.camera.lookAt(lookAt)
    }
}