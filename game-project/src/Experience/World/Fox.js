import * as THREE from 'three'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'

export default class Fox {
    constructor(experience, target = null) {
        this.experience = experience
        this.scene = this.experience.scene
        this.resources = this.experience.resources
        this.time = this.experience.time
        this.debug = this.experience.debug
        this.target = target
        this.followSpeed = 2.8
        this.stopDistance = 1.0
        this.runDistance = 5.2
        this.followBackOffset = 2.2
        this.followSideOffset = 0

        // Debug
        if (this.debug.active) {
            this.debugFolder = this.debug.ui.addFolder('fox')
        }

        // Resource
        this.resource = this.resources.items.foxModel

        this.setModel()
        this.setAnimation()
    }

    setModel() {
        this.model = SkeletonUtils.clone(this.resource.scene)
        this.model.scale.setScalar(0.014)
        this.model.position.set(3, 0.05, -3)
        this.scene.add(this.model)
        //Activando la sobra de fox
        this.model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.castShadow = true
            }
        })
    }
    //Manejo GUI
    setAnimation() {
        this.animation = {}

        // Mixer
        this.animation.mixer = new THREE.AnimationMixer(this.model)

        // Actions
        this.animation.actions = {}

        this.animation.actions.idle = this.animation.mixer.clipAction(this.resource.animations[0])
        this.animation.actions.walking = this.animation.mixer.clipAction(this.resource.animations[1])
        this.animation.actions.running = this.animation.mixer.clipAction(this.resource.animations[2])

        this.animation.actions.current = this.animation.actions.idle
        this.animation.actions.current.play()

        // Play the action
        this.animation.play = (name) => {
            const newAction = this.animation.actions[name]
            const oldAction = this.animation.actions.current
            if (!newAction || newAction === oldAction) return

            newAction.reset()
            newAction.play()
            newAction.crossFadeFrom(oldAction, 0.35)

            this.animation.actions.current = newAction
        }

        // Debug
        if (this.debug.active) {
            const debugObject = {
                playIdle: () => { this.animation.play('idle') },
                playWalking: () => { this.animation.play('walking') },
                playRunning: () => { this.animation.play('running') }
            }
            this.debugFolder.add(debugObject, 'playIdle')
            this.debugFolder.add(debugObject, 'playWalking')
            this.debugFolder.add(debugObject, 'playRunning')
        }
    }

    setTarget(target) {
        this.target = target
    }

    resetNear(position) {
        if (!position || !this.model) return
        this.model.position.set(position.x - this.followSideOffset, 0.05, position.z - this.followBackOffset)
        this.animation?.play?.('idle')
    }

    getTargetPosition() {
        const targetGroup = this.target?.group

        if (this.target?.body?.position) {
            const basePosition = new THREE.Vector3(
                this.target.body.position.x,
                this.target.body.position.y,
                this.target.body.position.z
            )

            if (targetGroup) {
                const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(targetGroup.quaternion)
                return basePosition
                    .addScaledVector(forward, -this.followBackOffset)
            }

            return basePosition
        }

        if (targetGroup?.position) {
            const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(targetGroup.quaternion)
            return targetGroup.position.clone()
                .addScaledVector(forward, -this.followBackOffset)
        }

        return null
    }

    isTargetMoving() {
        const velocity = this.target?.body?.velocity
        if (!velocity) return false
        return Math.sqrt(velocity.x ** 2 + velocity.z ** 2) > 0.35
    }

    update(delta = this.time.delta * 0.001) {
        this.animation.mixer.update(delta)

        const targetPosition = this.getTargetPosition()
        if (!targetPosition) {
            this.animation.play('idle')
            return
        }

        const foxPosition = this.model.position
        const direction = new THREE.Vector3(
            targetPosition.x - foxPosition.x,
            0,
            targetPosition.z - foxPosition.z
        )
        const distance = direction.length()
        const targetMoving = this.isTargetMoving()

        if (!targetMoving && distance < this.runDistance) {
            this.animation.play('idle')
            return
        }

        if (distance > this.stopDistance) {
            direction.normalize()

            const speed = distance > this.runDistance ? this.followSpeed * 1.35 : this.followSpeed
            const step = Math.min(speed * delta, distance - this.stopDistance)
            foxPosition.x += direction.x * step
            foxPosition.z += direction.z * step

            const targetRotation = Math.atan2(direction.x, direction.z)
            const rotationDelta = Math.atan2(
                Math.sin(targetRotation - this.model.rotation.y),
                Math.cos(targetRotation - this.model.rotation.y)
            )
            this.model.rotation.y += rotationDelta * 0.18

            this.animation.play(targetMoving && distance > this.runDistance ? 'running' : 'walking')
        } else {
            this.animation.play('idle')
        }
    }
}
