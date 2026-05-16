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

        this.baseSpeed = 0.60
        this.chaseSpeed = 1.8
        this.detectionRadius = 14
        this.releaseRadius = 19
        this.attackDistance = 2.0
        this.isChasing = false
        this.delayActivation = 0
        this.visualYOffset = -1.15
        this.lastAttackTime = 0
        this.attackCooldown = 900
        // Movimiento del zombie
        this.movementMode = 'walk2'
        this.modeTimer = 0
        this.nextModeChange = 3 + Math.random() * 3

        this.proximitySound = new Sound('/sounds/alert.ogg', {
            loop: true,
            volume: 0
        })

        this.alertSoundPlaying = false
        this.hasTriggeredDefeat = false

        this.model = new THREE.Group()
        this.model.name = 'EnemyLarge'
        this.model.position.copy(position)

        this.visual = this._cloneModel(model)
        this.visual.scale.setScalar(0.42)
        this.visual.position.y = this.visualYOffset
        this.model.add(this.visual)

        this.model.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true
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
            console.warn('El zombie no trae animaciones.')
            return
        }

        console.log('Animaciones del zombie:', animations.map(clip => clip.name))

        this.animation.mixer = new THREE.AnimationMixer(this.visual)

        animations.forEach((clip) => {
            this.animation.actions[clip.name] = this.animation.mixer.clipAction(clip)
        })

        // Busca por nombre exacto O con prefijo Armature| (depende del GLB)
        const getClip = (name) => {
            return animations.find(clip =>
                clip.name === name ||
                clip.name === `Armature|${name}`
            )
        }

        const idleClip =
            getClip('Idle') ||
            animations[0]

        const walkSlowClip =
            getClip('Walk2') ||
            getClip('Walk') ||
            idleClip

        const walkClip =
            getClip('Walk') ||
            walkSlowClip

        const crawlRunClip =
            getClip('Running_Crawl') ||
            walkClip

        const attackClip =
            getClip('Attack') ||
            getClip('Bite_ground') ||
            getClip('Headbutt') ||
            idleClip

        this.animation.idleAction = this.animation.mixer.clipAction(idleClip)
        this.animation.walkSlowAction = this.animation.mixer.clipAction(walkSlowClip)
        this.animation.walkAction = this.animation.mixer.clipAction(walkClip)
        this.animation.crawlRunAction = this.animation.mixer.clipAction(crawlRunClip)
        this.animation.attackAction = this.animation.mixer.clipAction(attackClip)

        this.animation.attackAction.setLoop(THREE.LoopOnce)
        this.animation.attackAction.clampWhenFinished = false

        this.animation.current = this.animation.idleAction
        this.animation.current.reset().fadeIn(0.2).play()

        console.log('Animaciones usadas por el zombie:', {
            idle: idleClip.name,
            caminarLento: walkSlowClip.name,
            caminarNormal: walkClip.name,
            correr: crawlRunClip.name,
            atacar: attackClip.name
        })
    }

    playAnimation(action, fade = 0.4) {
        if (!action || action === this.animation?.current) return

        const previous = this.animation.current
        action.reset().fadeIn(fade).play()
        previous?.fadeOut(fade)
        this.animation.current = action
    }
    startAlertSound(volume = 0.5) {
        if (!window.userInteracted) return

        if (!this.alertSoundPlaying) {
            this.proximitySound?.play()
            this.alertSoundPlaying = true
        }

        this.proximitySound?.setVolume?.(volume)
    }

    stopAlertSound() {
        this.proximitySound?.setVolume?.(0)

        if (this.alertSoundPlaying) {
            this.proximitySound?.stop()
            this.alertSoundPlaying = false
        }
    }
    updateZombieMovementMode(delta, isChasing) {
        this.modeTimer += delta

        if (this.modeTimer < this.nextModeChange) return

        this.modeTimer = 0

        if (isChasing) {
            // Cuando persigue, tiene más probabilidad de ir rápido
            const useCrawl = Math.random() < 0.65

            if (useCrawl) {
                this.movementMode = 'crawl'
                this.nextModeChange = 1.5 + Math.random() * 1.5
            } else {
                this.movementMode = 'walk'
                this.nextModeChange = 2 + Math.random() * 2
            }

            return
        }

        // Cuando patrulla, normalmente camina lento,
        // a veces camina normal y pocas veces corre en crawl.
        const random = Math.random()

        if (random < 0.15) {
            this.movementMode = 'crawl'
            this.nextModeChange = 1.2 + Math.random() * 1.3
        } else if (random < 0.50) {
            this.movementMode = 'walk'
            this.nextModeChange = 2.5 + Math.random() * 2
        } else {
            this.movementMode = 'walk2'
            this.nextModeChange = 3 + Math.random() * 3
        }
    }

    update(delta) {
        this.animation?.mixer?.update(delta)

        if (this.delayActivation > 0) {
            this.delayActivation -= delta
            return
        }

        if (!this.body || !this.playerRef?.body || this.playerRef?.health <= 0) {
            this.stopAlertSound()
            return
        }

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
        let action = this.animation?.walkSlowAction || this.animation?.walkAction

        this.updateZombieMovementMode(delta, this.isChasing)

        if (this.isChasing) {
            targetPos = playerPos

            if (this.movementMode === 'crawl') {
                speed = this.chaseSpeed * 1.15
                action = this.animation?.crawlRunAction || this.animation?.walkAction
            } else {
                speed = this.chaseSpeed * 0.8
                action = this.animation?.walkAction || this.animation?.walkSlowAction
            }

        } else if (this.patrolPoints.length > 0) {
            const currentPoint = this.patrolPoints[this.currentPatrolIndex]
            targetPos = new CANNON.Vec3(currentPoint.x, this.hoverY, currentPoint.z)
            if (this.movementMode === 'crawl') {
                speed = this.baseSpeed * 2.4
                action = this.animation?.crawlRunAction || this.animation?.walkAction
            } else if (this.movementMode === 'walk') {
                speed = this.baseSpeed * 1.4
                action = this.animation?.walkAction || this.animation?.walkSlowAction
            } else {
                speed = this.baseSpeed
                action = this.animation?.walkSlowAction || this.animation?.walkAction
            }

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

        if (this.isChasing && distanceToPlayer < maxDistance) {
            const clampedDistance = Math.min(distanceToPlayer, maxDistance)
            const volume = (1 - clampedDistance / maxDistance) * 0.65
            this.startAlertSound(volume)
        } else {
            this.stopAlertSound()
        }
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
            if (action) action.timeScale = Math.max(0.5, speed / this.baseSpeed)
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
        if (this.hasTriggeredDefeat) return

        const now = Date.now()

        // Evita que quite vida 60 veces por segundo
        if (now - this.lastAttackTime < this.attackCooldown) return
        this.lastAttackTime = now

        if (typeof this.playerRef?.takeDamage === 'function') {
            this.playerRef.takeDamage(1)
        } else if (typeof this.playerRef?.die === 'function') {
            this.playerRef.die()
        }

        // Si el jugador murió, apagar sonido y mostrar derrota una sola vez
        if (!this.playerRef?.body || this.playerRef?.health <= 0) {
            this.hasTriggeredDefeat = true
            this.stopAlertSound()
            this.experience?.world?.triggerDefeat?.()
        }
    }

    destroy() {
        this.stopAlertSound()
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
