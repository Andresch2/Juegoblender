import * as CANNON from 'cannon-es'
import FinalPrizeParticles from '../Utils/FinalPrizeParticles.js'
import Sound from './Sound.js'

export default class Enemy {
    constructor({ scene, physicsWorld, playerRef, model, position, experience, patrolPoints = [], chasePoints = [] }) {
        this.experience = experience
        this.scene = scene
        this.physicsWorld = physicsWorld
        this.playerRef = playerRef
        this.baseSpeed = 1.0  //Control velocidad del enemigo
        this.speed = this.baseSpeed
        this.delayActivation = 0 // activo de inmediato en modo escritorio

        // Patrulla por puntos
        this.patrolPoints = patrolPoints || []
        this.chasePoints = chasePoints || []
        this.currentPatrolIndex = 0
        this.currentChaseIndex = 0
        this.detectionRadius = 15 // distancia para detectar jugador
        this.isChasing = false



        // Sonido de proximidad en loop
        this.proximitySound = new Sound('/sounds/alert.ogg', {
            loop: true,
            volume: 0
        })
        this._soundCooldown = 0
        this.proximitySound.play()

        // Modelo visual - clonar profundamente con materiales
        this.model = this._deepClone(model)
        this.model.scale.set(1, 1, 1) // Escala 1:1 
        this.model.position.copy(position)

        // Asegurar que todos los materiales y meshes son visibles
        this.model.visible = true
        this.model.traverse((child) => {
            if (child.isMesh) {
                child.visible = true
                child.frustumCulled = false
                if (child.material) {
                    child.material.transparent = false
                    child.material.opacity = 1.0
                    child.material.visible = true
                    child.material.needsUpdate = true
                }
            }
        })

        this.scene.add(this.model)

        //  Material físico del enemigo
        const enemyMaterial = new CANNON.Material('enemyMaterial')
        enemyMaterial.friction = 0.0

        // Cuerpo físico
        const shape = new CANNON.Sphere(0.5)
        this.body = new CANNON.Body({
            mass: 5,
            shape,
            material: enemyMaterial,
            position: new CANNON.Vec3(position.x, position.y, position.z),
            linearDamping: 0.01
        })

        // Alinear altura con el robot en modo escritorio (evita que nunca colisionen por Y)
        if (this.playerRef?.body) {
            this.body.position.y = this.playerRef.body.position.y
            this.model.position.y = this.body.position.y
        }

        this.body.sleepSpeedLimit = 0.0
        this.body.wakeUp()
        this.physicsWorld.addBody(this.body)

        // Asocia el cuerpo al modelo
        this.model.userData.physicsBody = this.body

        // Colisión con robot
        this._onCollide = (event) => {
            if (event.body === this.playerRef.body) {
                if (typeof this.playerRef.die === 'function') {
                    this.playerRef.die()
                }

                if (this.proximitySound) {
                    this.proximitySound.stop()
                }

                if (this.model.parent) {
                    new FinalPrizeParticles({
                        scene: this.scene,
                        targetPosition: this.body.position,
                        sourcePosition: this.body.position,
                        experience: this.experience
                    })

                    this.destroy()
                }
            }
        }

        this.body.addEventListener('collide', this._onCollide)

        console.log(`👻 Enemigo creado en (${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)}) con ${this.patrolPoints.length} puntos de patrulla y ${this.chasePoints.length} puntos de persecución`)
    }

    /**
     * Clona profundamente un Object3D incluyendo materiales y geometrías
     * para evitar que el clon sea invisible por compartir materiales.
     */
    _deepClone(source) {
        const clone = source.clone()

        clone.traverse((child) => {
            const srcChild = source.getObjectByName(child.name)

            if (child.isMesh && child.material) {
                // Clonar material para evitar referencias compartidas
                if (Array.isArray(child.material)) {
                    child.material = child.material.map(m => m.clone())
                } else {
                    child.material = child.material.clone()
                }
            }

            // Copiar maps/texturas del original si se perdieron
            if (child.isMesh && srcChild && srcChild.material) {
                const srcMat = srcChild.material
                const dstMat = child.material

                if (!Array.isArray(srcMat) && !Array.isArray(dstMat)) {
                    if (srcMat.map && !dstMat.map) dstMat.map = srcMat.map
                    if (srcMat.normalMap && !dstMat.normalMap) dstMat.normalMap = srcMat.normalMap
                    if (srcMat.roughnessMap && !dstMat.roughnessMap) dstMat.roughnessMap = srcMat.roughnessMap
                    if (srcMat.metalnessMap && !dstMat.metalnessMap) dstMat.metalnessMap = srcMat.metalnessMap
                    if (srcMat.emissiveMap && !dstMat.emissiveMap) dstMat.emissiveMap = srcMat.emissiveMap
                }
            }
        })

        return clone
    }

    update(delta) {
        if (this.delayActivation > 0) {
            this.delayActivation -= delta
            return
        }

        if (!this.body || !this.playerRef?.body) return

        const playerPos = new CANNON.Vec3(
            this.playerRef.body.position.x,
            this.playerRef.body.position.y,
            this.playerRef.body.position.z
        )

        const enemyPos = this.body.position
        const distanceToPlayer = enemyPos.distanceTo(playerPos)

        // Detectar si ve al jugador
        this.isChasing = distanceToPlayer < this.detectionRadius

        let targetPos

        if (this.isChasing) {
            // Seguir la ruta de persecución si existe, si no ir directo al jugador
            if (this.chasePoints && this.chasePoints.length > 0) {
                const currentPoint = this.chasePoints[this.currentChaseIndex]
                targetPos = new CANNON.Vec3(currentPoint.x, currentPoint.y, currentPoint.z)

                const distanceToPoint = enemyPos.distanceTo(targetPos)
                if (distanceToPoint < 2) {
                    this.currentChaseIndex = Math.min(this.currentChaseIndex + 1, this.chasePoints.length - 1)
                }
            } else {
                targetPos = playerPos
            }
            this.speed = 2.5
        } else {
            // Seguir los puntos
            if (this.patrolPoints.length > 0) {
                const currentPoint = this.patrolPoints[this.currentPatrolIndex]
                targetPos = new CANNON.Vec3(currentPoint.x, currentPoint.y, currentPoint.z)

                // Si llego al punto, ir al siguiente
                const distanceToPoint = enemyPos.distanceTo(targetPos)
                if (distanceToPoint < 2) {
                    this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.patrolPoints.length
                }
            } else {
                // Sin puntos de patrulla: quedarse en lugar
                this.body.velocity.set(0, 0, 0)
                this.model.position.copy(this.body.position)
                return
            }
            this.speed = this.baseSpeed
        }

        // Volumen sonoro según cercanía
        const maxDistance = 10
        const clampedDistance = Math.min(distanceToPlayer, maxDistance)
        const proximityVolume = 1 - (clampedDistance / maxDistance)

        if (this.proximitySound) {
            this.proximitySound.setVolume(proximityVolume * 0.8)
        }

        // Movimiento hacia objetivo
        const direction = new CANNON.Vec3(
            targetPos.x - enemyPos.x,
            0, // No mover en Y: evitar que el enemigo vuele o se hunda
            targetPos.z - enemyPos.z
        )

        if (direction.length() > 0.5) {
            direction.normalize()
            direction.scale(this.speed, direction)
            this.body.velocity.x = direction.x
            this.body.velocity.z = direction.z
            // Mantener velocidad Y para que la gravedad funcione si hay desniveles
        }

        // Sincronizar modelo visual (siempre visible)
        this.model.position.copy(this.body.position)
        this.model.visible = true

        // Rotar el modelo hacia la dirección de movimiento
        if (Math.abs(direction.x) > 0.01 || Math.abs(direction.z) > 0.01) {
            const angle = Math.atan2(direction.x, direction.z)
            this.model.rotation.y = angle
        }
    }

    destroy() {
        if (this.model) {
            this.scene.remove(this.model)
        }

        if (this.proximitySound) {
            this.proximitySound.stop()
        }

        if (this.body) {
            this.body.removeEventListener('collide', this._onCollide)

            if (this.physicsWorld.bodies.includes(this.body)) {
                this.physicsWorld.removeBody(this.body)
            }

            this.body = null
        }
    }
}
