import * as CANNON from 'cannon-es'
import * as THREE from 'three'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import FinalPrizeParticles from '../Utils/FinalPrizeParticles.js'
import Sound from './Sound.js'

export default class Enemy {
    constructor({ scene, physicsWorld, playerRef, model, position, experience, patrolPoints = [], chasePoints = [] }) {
        this.experience = experience
        this.scene = scene
        this.physicsWorld = physicsWorld
        this.playerRef = playerRef
        this.modelResource = model

        this.baseSpeed = 1.45
        this.chaseSpeed = 4.4
        this.speed = this.baseSpeed
        this.delayActivation = 0

        this.patrolPoints = patrolPoints || []
        this.chasePoints = chasePoints || []
        this.currentPatrolIndex = 0
        this.currentChaseIndex = 0
        this.detectionRadius = 24
        this.releaseRadius = 32
        this.attackDistance = 3.0
        this.visualYOffset = -2.1
        this.isChasing = false

        this.proximitySound = new Sound('/sounds/alert.ogg', {
            loop: true,
            volume: 0
        })
        this.proximitySound.play()

        this.model = new THREE.Group()
        this.model.name = 'EnemyGhostSkull'
        this.model.position.copy(position)

        this.visual = this._deepClone(model)
        this.visual.name = 'EnemyGhostSkullVisual'
        this.visual.scale.setScalar(1)
        this.visual.position.y = this.visualYOffset
        this.model.add(this.visual)

        this.model.visible = true
        this.model.traverse((child) => {
            if (child.isMesh) {
                child.visible = true
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

        const enemyMaterial = new CANNON.Material('enemyMaterial')
        enemyMaterial.friction = 0

        const shape = new CANNON.Sphere(0.5)
        this.body = new CANNON.Body({
            mass: 0,
            type: CANNON.Body.KINEMATIC,
            shape,
            material: enemyMaterial,
            position: new CANNON.Vec3(position.x, position.y, position.z),
            linearDamping: 0.01,
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
                if (typeof this.playerRef.takeDamage === 'function') {
                    this.playerRef.takeDamage(1)
                }

                if (!this.playerRef?.body && this.model.parent) {
                    this.proximitySound?.stop()
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

        console.log(`Enemigo creado en (${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)}) con ${this.patrolPoints.length} puntos de patrulla`)
    }

    _deepClone(source) {
        const sourceScene = source?.scene || source
        const clone = cloneSkeleton(sourceScene)

        clone.traverse((child) => {
            const srcChild = sourceScene.getObjectByName(child.name)

            if (child.isMesh && child.material) {
                if (Array.isArray(child.material)) {
                    child.material = child.material.map((mat) => mat.clone())
                } else {
                    child.material = child.material.clone()
                }
            }

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

    setAnimation() {
        const animations = this.modelResource?.animations || []

        this.animation = {
            mixer: null,
            actions: {},
            current: null
        }

        if (!animations.length) {
            console.warn('El modelo del enemigo no trae animaciones. Revisa /models/Enemy/GhostSkull.glb')
            return
        }

        this.animation.mixer = new THREE.AnimationMixer(this.visual)

        animations.forEach((clip) => {
            this.animation.actions[clip.name] = this.animation.mixer.clipAction(clip)
        })

        this.animation.idleAction =
            this.animation.actions['CharacterArmature|Flying_Idle'] ||
            this.animation.actions['Flying_Idle'] ||
            this.animation.actions[animations[0].name]

        this.animation.flyAction =
            this.animation.actions['CharacterArmature|Fast_Flying'] ||
            this.animation.actions['Fast_Flying'] ||
            this.animation.idleAction

        this.animation.attackAction =
            this.animation.actions['CharacterArmature|Headbutt'] ||
            this.animation.actions['CharacterArmature|Punch'] ||
            this.animation.idleAction

        if (this.animation.idleAction) {
            this.animation.current = this.animation.idleAction
            this.animation.current.reset().fadeIn(0.2).play()
        }
    }

    playAnimation(action, fade = 0.25) {
        if (!action || action === this.animation?.current) return

        const previous = this.animation.current
        action.reset().fadeIn(fade).play()

        if (previous) {
            previous.fadeOut(fade)
        }

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

        const playerInRouteZone = this.isPlayerNearRoute(playerPos)
        if (this.isChasing) {
            this.isChasing = distanceToPlayer < this.releaseRadius || playerInRouteZone
        } else {
            this.isChasing = distanceToPlayer < this.detectionRadius || playerInRouteZone
        }

        let targetPos

        if (this.isChasing) {
            targetPos = playerPos
            this.speed = this.chaseSpeed
        } else if (this.patrolPoints.length > 0) {
            const currentPoint = this.patrolPoints[this.currentPatrolIndex]
            targetPos = new CANNON.Vec3(currentPoint.x, this.hoverY, currentPoint.z)

            const dxToPoint = targetPos.x - enemyPos.x
            const dzToPoint = targetPos.z - enemyPos.z
            const distanceToPoint = Math.sqrt(dxToPoint * dxToPoint + dzToPoint * dzToPoint)

            if (distanceToPoint < 1.8) {
                this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.patrolPoints.length
            }

            this.speed = this.baseSpeed
        } else {
            this.stopMoving()
            return
        }

        const maxDistance = 10
        const clampedDistance = Math.min(distanceToPlayer, maxDistance)
        const proximityVolume = 1 - (clampedDistance / maxDistance)
        this.proximitySound?.setVolume(proximityVolume * 0.8)

        const direction = new CANNON.Vec3(
            targetPos.x - enemyPos.x,
            0,
            targetPos.z - enemyPos.z
        )

        if (direction.length() > 0.35) {
            direction.normalize()
            direction.scale(this.speed, direction)
            this.body.velocity.x = direction.x
            this.body.velocity.y = 0
            this.body.velocity.z = direction.z
            this.body.position.y = this.hoverY
            this.playAnimation(this.animation?.flyAction)
        } else {
            this.stopMoving(
                distanceToPlayer < this.attackDistance
                    ? this.animation?.attackAction || this.animation?.idleAction
                    : this.animation?.idleAction
            )
        }

        this.model.position.copy(this.body.position)
        this.model.visible = true

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

    isPlayerNearRoute(playerPos) {
        if (!this.chasePoints.length) return false

        return this.chasePoints.some(point => {
            const dx = playerPos.x - point.x
            const dz = playerPos.z - point.z
            return Math.sqrt(dx * dx + dz * dz) < 10
        })
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
    }

    destroy() {
        if (this.model) {
            this.scene.remove(this.model)
        }

        this.proximitySound?.stop()
        this.animation?.mixer?.stopAllAction()

        if (this.body) {
            this.body.removeEventListener('collide', this._onCollide)

            if (this.physicsWorld.bodies.includes(this.body)) {
                this.physicsWorld.removeBody(this.body)
            }

            this.body = null
        }
    }
}
