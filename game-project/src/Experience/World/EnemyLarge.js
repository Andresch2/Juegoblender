import * as CANNON from 'cannon-es'
import * as THREE from 'three'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import FinalPrizeParticles from '../Utils/FinalPrizeParticles.js'
import Sound from './Sound.js'

export default class EnemyLarge {
    constructor({ scene, physicsWorld, playerRef, model, position, experience, patrolPoints = [] }) {
        this.experience = experience
        this.scene = scene
        this.physicsWorld = physicsWorld
        this.playerRef = playerRef
        this.modelResource = model
        this.patrolPoints = patrolPoints
        this.currentPatrolIndex = 0

        this.baseSpeed = 0.75
        this.chaseSpeed = 2.6
        this.detectionRadius = 14
        this.releaseRadius = 19
        this.attackDistance = 2.0
        this.isChasing = false
        this.delayActivation = 0
        this.visualYOffset = -1.15

        this.proximitySound = new Sound('/sounds/alert.ogg', {
            loop: true,
            volume: 0
        })
        this.proximitySound.play()

        this.model = new THREE.Group()
        this.model.name = 'EnemyLarge'
        this.model.position.copy(position)

        this.visual = this._cloneModel(model)
        this.visual.scale.setScalar(0.42)
        this.visual.position.y = this.visualYOffset
        this.model.add(this.visual)

        this.model.traverse((child) => {
            if (child.isMesh) {
                child.visible = true
                child.castShadow = true
                child.frustumCulled = false
                if (child.material) {
                    child.material.transparent = false
                    child.material.opacity = 1
                    child.material.visible = true
                    child.material.needsUpdate = true
                }
            }
        })

        this.scene.add(this.model)
        this.setAnimation()

        const shape = new CANNON.Sphere(0.75)
        this.body = new CANNON.Body({
            mass: 0,
            type: CANNON.Body.KINEMATIC,
            shape,
            position: new CANNON.Vec3(position.x, position.y, position.z),
            angularDamping: 1
        })

        if (this.playerRef?.body) {
            this.body.position.y = this.playerRef.body.position.y
            this.model.position.y = this.body.position.y
        }

        this.hoverY = this.body.position.y
        this.body.fixedRotation = true
        this.body.sleepSpeedLimit = 0
        this.body.wakeUp()
        this.body.updateMassProperties()
        this.physicsWorld.addBody(this.body)
        this.model.userData.physicsBody = this.body

        this._onCollide = (event) => {
            if (event.body === this.playerRef?.body) {
                this.killPlayer()
            }
        }
        this.body.addEventListener('collide', this._onCollide)
    }

    _cloneModel(source) {
        const sourceScene = source?.scene || source
        const clone = cloneSkeleton(sourceScene)

        clone.traverse((child) => {
            const srcChild = sourceScene.getObjectByName(child.name)
            if (child.isMesh && child.material) {
                child.material = Array.isArray(child.material)
                    ? child.material.map((mat) => mat.clone())
                    : child.material.clone()
            }

            if (child.isMesh && srcChild && srcChild.material) {
                const srcMat = srcChild.material
                const dstMat = child.material
                if (!Array.isArray(srcMat) && !Array.isArray(dstMat)) {
                    if (srcMat.map && !dstMat.map) dstMat.map = srcMat.map
                    if (srcMat.normalMap && !dstMat.normalMap) dstMat.normalMap = srcMat.normalMap
                    if (srcMat.roughnessMap && !dstMat.roughnessMap) dstMat.roughnessMap = srcMat.roughnessMap
                    if (srcMat.metalnessMap && !dstMat.metalnessMap) dstMat.metalnessMap = srcMat.metalnessMap
                }
            }
        })

        return clone
    }

    setAnimation() {
        const animations = this.modelResource?.animations || []
        this.animation = {
            mixer: null,
            actions: {},
            current: null
        }

        if (!animations.length) {
            console.warn('Enemy Large no trae animaciones.')
            return
        }

        this.animation.mixer = new THREE.AnimationMixer(this.visual)
        animations.forEach((clip) => {
            this.animation.actions[clip.name] = this.animation.mixer.clipAction(clip)
        })

        this.animation.idleAction = this.animation.actions['CharacterArmature|Idle'] || this.animation.actions[animations[0].name]
        this.animation.walkAction = this.animation.actions['CharacterArmature|Walk'] || this.animation.idleAction
        this.animation.runAction = this.animation.actions['CharacterArmature|Run'] || this.animation.walkAction
        this.animation.attackAction = this.animation.actions['CharacterArmature|Punch'] || this.animation.idleAction

        this.animation.current = this.animation.idleAction
        this.animation.current?.reset().fadeIn(0.2).play()
    }

    playAnimation(action, fade = 0.22) {
        if (!action || action === this.animation?.current) return

        const previous = this.animation.current
        action.reset().fadeIn(fade).play()
        previous?.fadeOut(fade)
        this.animation.current = action
    }

    update(delta) {
        this.animation?.mixer?.update(delta)

        if (this.delayActivation > 0) {
            this.delayActivation -= delta
            return
        }

        if (!this.body || !this.playerRef?.body) return

        const playerPos = this.playerRef.body.position
        const enemyPos = this.body.position
        const dxToPlayer = playerPos.x - enemyPos.x
        const dzToPlayer = playerPos.z - enemyPos.z
        const distanceToPlayer = Math.sqrt(dxToPlayer * dxToPlayer + dzToPlayer * dzToPlayer)

        if (distanceToPlayer < this.attackDistance) {
            this.stopMoving(this.animation?.attackAction || this.animation?.idleAction)
            this.killPlayer()
            return
        }

        this.isChasing = this.isChasing
            ? distanceToPlayer < this.releaseRadius
            : distanceToPlayer < this.detectionRadius

        let targetPos
        let speed = this.baseSpeed
        let action = this.animation?.walkAction

        if (this.isChasing) {
            targetPos = playerPos
            speed = this.chaseSpeed
            action = this.animation?.runAction
        } else if (this.patrolPoints.length > 0) {
            const currentPoint = this.patrolPoints[this.currentPatrolIndex]
            targetPos = new CANNON.Vec3(currentPoint.x, this.hoverY, currentPoint.z)

            const dxToPoint = targetPos.x - enemyPos.x
            const dzToPoint = targetPos.z - enemyPos.z
            const distanceToPoint = Math.sqrt(dxToPoint * dxToPoint + dzToPoint * dzToPoint)
            if (distanceToPoint < 1.8) {
                this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.patrolPoints.length
            }
        } else {
            this.stopMoving()
            return
        }

        const maxDistance = 12
        const clampedDistance = Math.min(distanceToPlayer, maxDistance)
        this.proximitySound?.setVolume((1 - clampedDistance / maxDistance) * 0.75)

        const direction = new CANNON.Vec3(
            targetPos.x - enemyPos.x,
            0,
            targetPos.z - enemyPos.z
        )

        if (direction.length() > 0.35) {
            direction.normalize()
            direction.scale(speed, direction)
            this.body.velocity.x = direction.x
            this.body.velocity.y = 0
            this.body.velocity.z = direction.z
            this.body.position.y = this.hoverY
            this.playAnimation(action)
        } else {
            this.stopMoving()
        }

        this.model.position.copy(this.body.position)

        if (Math.abs(direction.x) > 0.01 || Math.abs(direction.z) > 0.01) {
            this.model.rotation.y = Math.atan2(direction.x, direction.z)
        }
    }

    stopMoving(action = this.animation?.idleAction) {
        if (!this.body) return

        this.body.velocity.set(0, 0, 0)
        this.body.position.y = this.hoverY
        this.model.position.copy(this.body.position)
        this.playAnimation(action)
    }

    killPlayer() {
        if (typeof this.playerRef?.takeDamage === 'function') {
            this.playerRef.takeDamage(1)
        } else if (typeof this.playerRef?.die === 'function') {
            this.playerRef.die()
        }

        if (!this.playerRef?.body) {
            this.experience?.world?.triggerDefeat?.()
        }

        if (!this.playerRef?.body && this.model.parent) {
            new FinalPrizeParticles({
                scene: this.scene,
                targetPosition: this.body.position,
                sourcePosition: this.body.position,
                experience: this.experience
            })
        }
    }

    destroy() {
        this.proximitySound?.stop()
        this.animation?.mixer?.stopAllAction()

        if (this.model) {
            this.scene.remove(this.model)
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
