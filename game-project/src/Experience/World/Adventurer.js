import * as CANNON from 'cannon-es'
import * as THREE from 'three'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import Sound from './Sound.js'

export default class Adventurer {
    constructor(experience) {
        // Personaje jugable principal:
        // concentra movimiento, vida,
        // sonidos, fisica y animaciones del aventurero.
        this.experience = experience
        this.scene = this.experience.scene
        this.resources = this.experience.resources
        this.time = this.experience.time
        this.physics = this.experience.physics
        this.keyboard = this.experience.keyboard
        this.debug = this.experience.debug
        this.points = 0

        // VIDA
        this.health = 5
        this.maxHealth = 5
        this.lastDamageTime = 0
        this.damageCooldown = 800
        this.hitAnimationUntil = 0

        this.setModel()
        this.setSounds()
        this.setPhysics()
        this.setAnimation()
        this.updateHealthHud()
    }

    setModel() {
        // SkeletonUtils.clone para evitar conflictos si hay varios personajes
        this.model = SkeletonUtils.clone(this.resources.items.playerModel.scene)
        this.model.scale.set(1.0, 1.0, 1.0)
        this.model.position.set(0, -0.3, 0)  // bajar para que no flote

        this.group = new THREE.Group()
        this.group.add(this.model)
        this.scene.add(this.group)

        this.model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.castShadow = true

                // Clonar materiales para no dañar el material original del GLB
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material = child.material.map((mat) => {
                            const cloned = mat.clone()
                            cloned.userData.originalColor = cloned.color ? cloned.color.clone() : null
                            return cloned
                        })
                    } else {
                        child.material = child.material.clone()
                        child.material.userData.originalColor = child.material.color
                            ? child.material.color.clone()
                            : null
                    }
                }
            }
        })
    }

    setPhysics() {
        // Cannon-es usa una esfera para mover el personaje.
        // La rotacion se bloquea para que el modelo no ruede visualmente.
        const shape = new CANNON.Sphere(0.45)

        this.body = new CANNON.Body({
            mass: 2,
            shape: shape,
            position: new CANNON.Vec3(0, 2, 0),
            linearDamping: 0.4,
            angularDamping: 1.0
        })

        this.body.angularFactor.set(0, 0, 0)
        this.body.velocity.setZero()
        this.body.angularVelocity.setZero()
        this.body.sleep()
        this.body.material = this.physics.robotMaterial

        this.physics.world.addBody(this.body)

        this.physics.world.addEventListener('postStep', () => {
            if (!this.body) return
            // Limitar velocidad horizontal
            const hv = Math.sqrt(this.body.velocity.x ** 2 + this.body.velocity.z ** 2)
            if (hv > 12) {
                this.body.velocity.x *= 12 / hv
                this.body.velocity.z *= 12 / hv
            }
            if (this.body.velocity.y > 3) this.body.velocity.y = 3
        })

        setTimeout(() => { this.body.wakeUp() }, 100)
    }

    setSounds() {
        this.walkSound = new Sound('/sounds/Adventurer/walking.mp3', { loop: true, volume: 0.5 })
        this.jumpSound = new Sound('/sounds/Adventurer/jump.mp3', { volume: 0.8 })
    }

    setAnimation() {
        this.animation = {}
        this.animation.mixer = new THREE.AnimationMixer(this.model)

        const anims = this.resources.items.playerModel.animations
        console.log('Animaciones del personaje:', anims.map(clip => clip.name))

        // Mapa por nombre para no depender del índice
        const clipMap = {}
        anims.forEach(clip => { clipMap[clip.name] = clip })

        this.animation.actions = {}

        // [0] CharacterArmature|Death
        this.animation.actions.death = this.animation.mixer.clipAction(
            clipMap['CharacterArmature|Death']
        )
        // [4] CharacterArmature|Idle
        this.animation.actions.idle = this.animation.mixer.clipAction(
            clipMap['CharacterArmature|Idle']
        )
        // [15] CharacterArmature|Roll  → usamos como salto
        this.animation.actions.jump = this.animation.mixer.clipAction(
            clipMap['CharacterArmature|Roll']
        )
        // [22] CharacterArmature|Walk
        this.animation.actions.walking = this.animation.mixer.clipAction(
            clipMap['CharacterArmature|Walk']
        )
        // [16] CharacterArmature|Run  → para cuando presiona Shift
        this.animation.actions.running = this.animation.mixer.clipAction(
            clipMap['CharacterArmature|Run']
        )
        // [23] CharacterArmature|Wave → animación extra (victoria/dance)
        this.animation.actions.dance = this.animation.mixer.clipAction(
            clipMap['CharacterArmature|Wave']
        )
        // Animación opcional cuando recibe golpe.
        // Si el modelo no trae Hit/Hurt/Damage, usa Wave como respaldo.
        const hitClip =
            clipMap['CharacterArmature|Hit'] ||
            clipMap['CharacterArmature|Hurt'] ||
            clipMap['CharacterArmature|Damage'] ||
            clipMap['CharacterArmature|React'] ||
            clipMap['CharacterArmature|HitReact']

        if (hitClip) {
            this.animation.actions.hit = this.animation.mixer.clipAction(hitClip)
            this.animation.actions.hit.setLoop(THREE.LoopOnce)
            this.animation.actions.hit.clampWhenFinished = false
        }

        // Arrancar en idle
        this.animation.actions.current = this.animation.actions.idle
        this.animation.actions.current.play()

        // Salto: una sola vez
        this.animation.actions.jump.setLoop(THREE.LoopOnce)
        this.animation.actions.jump.clampWhenFinished = true

        // Función para cambiar animación con crossfade
        this.animation.play = (name) => {
            const newAction = this.animation.actions[name]
            const oldAction = this.animation.actions.current
            if (!newAction || newAction === oldAction) return

            newAction.reset()
            newAction.play()
            newAction.crossFadeFrom(oldAction, 0.25)
            this.animation.actions.current = newAction

            if (name === 'walking' || name === 'running') {
                this.walkSound.play()
            } else {
                this.walkSound.stop()
            }

            if (name === 'jump') {
                this.jumpSound.play()
            }
        }
    }

    isGrounded() {
        if (!this.body) return false
        const start = this.body.position
        const end = new CANNON.Vec3(start.x, start.y - 0.6, start.z)
        const result = new CANNON.RaycastResult()
        this.physics.world.raycastClosest(start, end, { skipBackfaces: true }, result)
        return result.hasHit
    }

    getGroundHitAt(x, z) {
        const start = new CANNON.Vec3(x, this.body.position.y + 0.35, z)
        const end = new CANNON.Vec3(x, this.body.position.y - 0.85, z)
        const result = new CANNON.RaycastResult()
        this.physics.world.raycastClosest(start, end, { skipBackfaces: true }, result)
        return result.hasHit ? result : null
    }

    smoothLevel4Contacts(moveDirection) {
        // Ajuste especifico del nivel 4:
        // suaviza choques con objetos espaciales y ayuda a subir bordes bajos
        // sin cambiar la velocidad normal del jugador.
        const currentLevel = this.experience.world?.levelManager?.currentLevel || 1
        if (currentLevel !== 4 || !this.body) return

        const hv = Math.sqrt(this.body.velocity.x ** 2 + this.body.velocity.z ** 2)
        if (hv > 5.2) {
            this.body.velocity.x *= 5.2 / hv
            this.body.velocity.z *= 5.2 / hv
        }

        if (Math.abs(this.body.velocity.y) > 1.2) {
            this.body.velocity.y = Math.sign(this.body.velocity.y) * 1.2
        }

        if (!moveDirection || !this.isGrounded()) return

        const currentHit = this.getGroundHitAt(this.body.position.x, this.body.position.z)
        const frontHit = this.getGroundHitAt(
            this.body.position.x + moveDirection.x * 0.65,
            this.body.position.z + moveDirection.z * 0.65
        )

        if (!currentHit || !frontHit) return

        const stepHeight = frontHit.hitPointWorld.y - currentHit.hitPointWorld.y
        if (stepHeight > 0.05 && stepHeight <= 0.55) {
            this.body.position.y += Math.min(stepHeight + 0.03, 0.16)
            if (this.body.velocity.y < 1.2) this.body.velocity.y = 1.2
        }
    }

    respawn() {
        if (this.experience.world?.resetRobotPosition) {
            this.experience.world.resetRobotPosition()
        }
    }

    takeDamage(amount) {
        // Sistema de vida:
        // enemigos y peligros llaman este metodo para restar corazones.
        const now = Date.now()

        if (now - this.lastDamageTime < this.damageCooldown) return
        this.lastDamageTime = now

        if (!this.body) return

        this.health = Math.max(0, this.health - amount)
        console.log('💥 Vida restante:', this.health)

        this.updateHealthHud()
        this.flashDamage()

        // No cambiar colores ni materiales.
        // Solo reproducir una animación si existe.
        if (
            this.animation?.actions?.hit &&
            this.animation.actions.current !== this.animation.actions.death
        ) {
            this.hitAnimationUntil = now + 420
            this.animation.play('hit')

            setTimeout(() => {
                if (
                    this.body &&
                    this.animation.actions.current === this.animation.actions.hit
                ) {
                    this.animation.play('idle')
                }
            }, 450)
        }

        if (this.health <= 0) {
            this.die()
        }
    }

    updateHealthHud() {
        this.experience.menu?.setHealth?.(this.health, this.maxHealth)
    }

    restoreHealth() {
        this.health = this.maxHealth
        this.lastDamageTime = 0
        this.updateHealthHud()
        this.resetDamageVisual()
    }
    resetDamageVisual() {
        if (this.damageTimeout) {
            clearTimeout(this.damageTimeout)
            this.damageTimeout = null
        }

        this.model.traverse((child) => {
            if (!child.isMesh || !child.material) return

            const restoreMaterial = (mat) => {
                if (mat?.color && mat.userData?.originalColor) {
                    mat.color.copy(mat.userData.originalColor)
                    mat.needsUpdate = true
                }
            }

            if (Array.isArray(child.material)) {
                child.material.forEach(restoreMaterial)
            } else {
                restoreMaterial(child.material)
            }
        })
    }

    flashDamage() {
        this.resetDamageVisual()

        this.model.traverse((child) => {
            if (!child.isMesh || !child.material) return

            const tintMaterial = (mat) => {
                if (mat?.color) {
                    mat.color.set('#ff3b3b')
                    mat.needsUpdate = true
                }
            }

            if (Array.isArray(child.material)) {
                child.material.forEach(tintMaterial)
            } else {
                tintMaterial(child.material)
            }
        })

        this.damageTimeout = setTimeout(() => this.resetDamageVisual(), 180)
    }

    update() {
        if (this.animation.actions.current === this.animation.actions.death) return
        if (!this.body) return

        const delta = this.time.delta * 0.001
        this.animation.mixer.update(delta)

        const keys = this.keyboard.getState()
        const isShift = keys.shift || false
        // Actividad 10:
        // Shift + W/flecha arriba usa la animacion y velocidad de correr.
        const moveForce = isShift ? 120 : 75
        const maxSpeed = isShift ? 10 : 6
        const turnSpeed = 2.5
        let isMoving = false
        let moveDirection = null


        if (keys.left) {
            this.group.rotation.y += turnSpeed * delta
            this.body.quaternion.setFromEuler(0, this.group.rotation.y, 0)
        }
        if (keys.right) {
            this.group.rotation.y -= turnSpeed * delta
            this.body.quaternion.setFromEuler(0, this.group.rotation.y, 0)
        }

        const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.group.quaternion)

        if (keys.up) {
            this.body.applyForce(
                new CANNON.Vec3(forward.x * moveForce, 0, forward.z * moveForce),
                this.body.position
            )
            isMoving = true
            moveDirection = forward
        }

        if (keys.down) {
            const backward = forward.clone().multiplyScalar(-1)
            this.body.applyForce(
                new CANNON.Vec3(backward.x * moveForce, 0, backward.z * moveForce),
                this.body.position
            )
            isMoving = true
            moveDirection = backward
        }

        // Limitar velocidad horizontal — CLAVE para no resbalar
        const vx = this.body.velocity.x
        const vz = this.body.velocity.z
        const hSpeed = Math.sqrt(vx * vx + vz * vz)
        if (hSpeed > maxSpeed) {
            const scale = maxSpeed / hSpeed
            this.body.velocity.x = vx * scale
            this.body.velocity.z = vz * scale
        }

        // Freno manual cuando no se presiona tecla — evita el deslizamiento
        if (!keys.up && !keys.down) {
            this.body.velocity.x *= 0.75
            this.body.velocity.z *= 0.75
        }

        // Salto
        if (keys.space && this.isGrounded()) {
            this.body.velocity.y = 6.5
            this.animation.play('jump')
            return
        }

        // Respawn con R
        if (keys.r) { this.respawn(); return }

        // Anti-caída
        if (this.body.position.y < -5) this.respawn()

        this.smoothLevel4Contacts(moveDirection)

        if (
            this.animation.actions.current === this.animation.actions.hit &&
            Date.now() < this.hitAnimationUntil
        ) {
            this.group.position.copy(this.body.position)
            return
        }

        // Animaciones
        if (isMoving) {
            const anim = isShift ? 'running' : 'walking'
            if (this.animation.actions.current !== this.animation.actions[anim]) {
                this.animation.play(anim)
            }
        } else {
            if (this.animation.actions.current !== this.animation.actions.idle &&
                this.animation.actions.current !== this.animation.actions.jump) {
                this.animation.play('idle')
            }
        }

        this.group.position.copy(this.body.position)
    }

    die() {
        if (this.isDead) return
        this.isDead = true

        if (this.animation.actions.current !== this.animation.actions.death) {
            this.animation.actions.current.fadeOut(0.2)
            this.animation.actions.death.reset().fadeIn(0.2).play()
            this.animation.actions.current = this.animation.actions.death
        }

        this.walkSound.stop()

        if (this.body && this.physics.world.bodies.includes(this.body)) {
            this.physics.world.removeBody(this.body)
        }

        this.body = null

        this.group.position.y -= 0.5
        this.group.rotation.x = -Math.PI / 2

        console.log('Adventurer ha muerto')

        if (this.experience.world?.triggerDefeat) {
            this.experience.world.triggerDefeat()
        }
    }

    revive() {
        this.isDead = false
        this.restoreHealth()

        if (!this.body) {
            this.setPhysics()
        }

        this.group.rotation.set(0, 0, 0)
        this.group.position.y = 0

        this.animation.actions.death.stop()
        this.animation.actions.idle.reset().play()
        this.animation.actions.current = this.animation.actions.idle
    }

    moveInDirection(dir, speed) {
        if (!window.userInteracted || !this.experience.renderer.instance.xr.isPresenting) return
        const mobile = window.experience?.mobileControls
        if (mobile?.intensity > 0) {
            const d = new THREE.Vector3(mobile.directionVector.x, 0, mobile.directionVector.y).normalize()
            this.body.applyForce(
                new CANNON.Vec3(d.x * 250 * mobile.intensity, 0, d.z * 250 * mobile.intensity),
                this.body.position
            )
            if (this.animation.actions.current !== this.animation.actions.walking) {
                this.animation.play('walking')
            }
            const angle = Math.atan2(d.x, d.z)
            this.group.rotation.y = angle
            this.body.quaternion.setFromEuler(0, this.group.rotation.y, 0)
        }
    }
}
