import * as CANNON from 'cannon-es'
import * as THREE from 'three'
import Sound from './Sound.js'

export default class Robot {
    constructor(experience) {
        this.experience = experience
        this.scene = this.experience.scene
        this.resources = this.experience.resources
        this.time = this.experience.time
        this.physics = this.experience.physics
        this.keyboard = this.experience.keyboard
        this.debug = this.experience.debug
        this.points = 0

        this.setModel()
        this.setSounds()
        this.setPhysics()
        this.setAnimation()
    }

    setModel() {
        this.model = this.resources.items.robotModel.scene
        this.model.scale.set(0.3, 0.3, 0.3)
        this.model.position.set(0, -0.1, 0) // Centrar respecto al cuerpo fisico

        this.group = new THREE.Group()
        this.group.add(this.model)
        this.scene.add(this.group)

        this.model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.castShadow = true
            }
        })
    }

    setPhysics() {
        // Box shape en lugar de Sphere: Box vs Box es estable en cannon-es,
        // no genera empujon lateral al tocar bordes de plataformas
        const shape = new CANNON.Box(new CANNON.Vec3(0.3, 0.4, 0.3))

        this.body = new CANNON.Body({
            mass: 2,
            shape: shape,
            position: new CANNON.Vec3(0, 2, 0),
            linearDamping: 0.4,
            angularDamping: 0.95
        })

        this.body.angularFactor.set(0, 1, 0)

        // Estabilizacion inicial
        this.body.velocity.setZero()
        this.body.angularVelocity.setZero()
        this.body.sleep()
        this.body.material = this.physics.robotMaterial

        this.physics.world.addBody(this.body)

        // Proteccion anti-lanzamiento: despues de cada substep de fisica,
        // si la colision con una plataforma genero un pico de velocidad,
        // lo cortamos ANTES de que mueva al robot
        this.physics.world.addEventListener('postStep', () => {
            if (!this.body) return;
            // Clamp horizontal
            const hv = Math.sqrt(this.body.velocity.x ** 2 + this.body.velocity.z ** 2);
            if (hv > 12) {
                this.body.velocity.x *= 12 / hv;
                this.body.velocity.z *= 12 / hv;
            }
            // Prevenir lanzamiento vertical
            if (this.body.velocity.y > 8) {
                this.body.velocity.y = 8;
            }
        });

        // Activar cuerpo despues de que el mundo haya dado al menos un paso de simulacion
        setTimeout(() => {
            this.body.wakeUp()
        }, 100)
    }


    setSounds() {
        this.walkSound = new Sound('/sounds/robot/walking.mp3', { loop: true, volume: 0.5 })
        this.jumpSound = new Sound('/sounds/robot/jump.mp3', { volume: 0.8 })
    }

    setAnimation() {
        this.animation = {}
        this.animation.mixer = new THREE.AnimationMixer(this.model)

        this.animation.actions = {}
        this.animation.actions.dance = this.animation.mixer.clipAction(this.resources.items.robotModel.animations[0])
        this.animation.actions.death = this.animation.mixer.clipAction(this.resources.items.robotModel.animations[1])
        this.animation.actions.idle = this.animation.mixer.clipAction(this.resources.items.robotModel.animations[2])
        this.animation.actions.jump = this.animation.mixer.clipAction(this.resources.items.robotModel.animations[3])
        this.animation.actions.walking = this.animation.mixer.clipAction(this.resources.items.robotModel.animations[10])

        this.animation.actions.current = this.animation.actions.idle
        this.animation.actions.current.play()

        this.animation.actions.jump.setLoop(THREE.LoopOnce)
        this.animation.actions.jump.clampWhenFinished = true
        this.animation.actions.jump.onFinished = () => {
            this.animation.play('idle')
        }

        this.animation.play = (name) => {
            const newAction = this.animation.actions[name]
            const oldAction = this.animation.actions.current

            newAction.reset()
            newAction.play()
            newAction.crossFadeFrom(oldAction, 0.3)
            this.animation.actions.current = newAction

            if (name === 'walking') {
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
        if (!this.body) return false;

        const start = this.body.position;
        // Box halfHeight es 0.4, rayo desde centro hasta 0.15 debajo de la base
        const end = new CANNON.Vec3(start.x, start.y - 0.55, start.z);

        const raycastResult = new CANNON.RaycastResult();
        const rayOptions = {
            skipBackfaces: true,
            collisionFilterMask: ~0
        };

        this.physics.world.raycastClosest(start, end, rayOptions, raycastResult);

        return raycastResult.hasHit;
    }

    respawn() {
        if (this.experience.world && this.experience.world.resetRobotPosition) {
            this.experience.world.resetRobotPosition();
        }
    }

    update() {
        if (this.animation.actions.current === this.animation.actions.death) return
        const delta = this.time.delta * 0.001
        this.animation.mixer.update(delta)

        const keys = this.keyboard.getState()

        // Shift para correr: detectar si Shift esta presionado
        const isShiftDown = keys.shift || false
        const walkForce = 70
        const runForce = 120
        const moveForce = isShiftDown ? runForce : walkForce

        const walkMaxSpeed = 10
        const runMaxSpeed = 16
        const maxSpeed = isShiftDown ? runMaxSpeed : walkMaxSpeed

        const turnSpeed = 2.5
        let isMoving = false

        // Limitar velocidad horizontal
        const hSpeed = Math.sqrt(this.body.velocity.x ** 2 + this.body.velocity.z ** 2)
        if (hSpeed > maxSpeed) {
            const scale = maxSpeed / hSpeed
            this.body.velocity.x *= scale
            this.body.velocity.z *= scale
        }

        // Limitar velocidad vertical para evitar salir volando al tocar bordes
        if (this.body.velocity.y > 8) {
            this.body.velocity.y = 8
        }

        // Direccion hacia adelante
        const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.group.quaternion)

        // Salto -- impulso puramente vertical
        const grounded = this.isGrounded();
        console.log("[GROUND] grounded:", grounded);
        if (keys.space && grounded) {
            this.body.applyImpulse(new CANNON.Vec3(0, 5, 0))
            this.animation.play('jump')
            return
        }

        // Reaparicion manual con tecla R
        if (keys.r) {
            this.respawn();
            return;
        }

        // No permitir que el robot salga del escenario
        if (this.body.position.y > 25 || this.body.position.y < -10) {
            console.warn('Robot fuera del escenario. Reubicando al spawn del nivel...')
            this.respawn();
        }

        // Movimiento hacia adelante
        if (keys.up) {
            const fwd = new THREE.Vector3(0, 0, 1)
            fwd.applyQuaternion(this.group.quaternion)
            this.body.applyForce(
                new CANNON.Vec3(fwd.x * moveForce, 0, fwd.z * moveForce),
                this.body.position
            )
            isMoving = true
        }

        // Movimiento hacia atras
        if (keys.down) {
            const backward = new THREE.Vector3(0, 0, -1)
            backward.applyQuaternion(this.group.quaternion)
            this.body.applyForce(
                new CANNON.Vec3(backward.x * moveForce, 0, backward.z * moveForce),
                this.body.position
            )
            isMoving = true
        }

        // Rotacion
        if (keys.left) {
            this.group.rotation.y += turnSpeed * delta
            this.body.quaternion.setFromEuler(0, this.group.rotation.y, 0)
        }
        if (keys.right) {
            this.group.rotation.y -= turnSpeed * delta
            this.body.quaternion.setFromEuler(0, this.group.rotation.y, 0)
        }


        // Animaciones segun movimiento
        if (isMoving) {
            if (this.animation.actions.current !== this.animation.actions.walking) {
                this.animation.play('walking')
            }
        } else {
            if (this.animation.actions.current !== this.animation.actions.idle) {
                this.animation.play('idle')
            }
        }

        // Sincronizacion fisica -> visual
        this.group.position.copy(this.body.position)

    }

    // Metodo para mover el robot desde el exterior VR
    moveInDirection(dir, speed) {
        if (!window.userInteracted || !this.experience.renderer.instance.xr.isPresenting) {
            return
        }

        // Si hay controles moviles activos
        const mobile = window.experience?.mobileControls
        if (mobile?.intensity > 0) {
            const dir2D = mobile.directionVector
            const dir3D = new THREE.Vector3(dir2D.x, 0, dir2D.y).normalize()

            const adjustedSpeed = 250 * mobile.intensity
            const force = new CANNON.Vec3(dir3D.x * adjustedSpeed, 0, dir3D.z * adjustedSpeed)

            this.body.applyForce(force, this.body.position)

            if (this.animation.actions.current !== this.animation.actions.walking) {
                this.animation.play('walking')
            }

            // Rotar suavemente en direccion de avance
            const angle = Math.atan2(dir3D.x, dir3D.z)
            this.group.rotation.y = angle
            this.body.quaternion.setFromEuler(0, this.group.rotation.y, 0)
        }
    }
    die() {
        if (this.animation.actions.current !== this.animation.actions.death) {
            this.animation.actions.current.fadeOut(0.2)
            this.animation.actions.death.reset().fadeIn(0.2).play()
            this.animation.actions.current = this.animation.actions.death

            this.walkSound.stop()

            if (this.physics.world.bodies.includes(this.body)) {
                this.physics.world.removeBody(this.body)
            }
            this.body = null

            this.group.position.y -= 0.5
            this.group.rotation.x = -Math.PI / 2

            console.log(' Robot ha muerto')
        }
    }



}
