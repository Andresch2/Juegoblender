import * as THREE from 'three'
import MobileControls from '../../controls/MobileControls.js'
import ToyCarLoader from '../../loaders/ToyCarLoader.js'
import FinalPrizeParticles from '../Utils/FinalPrizeParticles.js'
import AmbientSound from './AmbientSound.js'
import BlockPrefab from './BlockPrefab.js'
import Enemy from './Enemy.js'
import EnemyLarge from './EnemyLarge.js'
import Environment from './Environment.js'
import Floor from './Floor.js'
import Fox from './Fox.js'
import LevelManager from './LevelManager.js'
import Robot from './Robot.js'
import Sound from './Sound.js'
import ThirdPersonCamera from './ThirdPersonCamera.js'

// Nivel mínimo para que aparezcan enemigos
const ENEMY_MIN_LEVEL = 3


export default class World {
    constructor(experience) {
        this.experience = experience
        this.scene = this.experience.scene
        this.blockPrefab = new BlockPrefab(this.experience)
        this.resources = this.experience.resources
        this.levelManager = new LevelManager(this.experience);
        this.finalPrizeActivated = false
        this.gameStarted = false
        this.enemies = []
        this.totalDefaultCoins = 0
        this.finalPrizeParticles = []

        this.coinSound = new Sound('/sounds/coin.ogg')
        this.ambientSound = new AmbientSound('/sounds/ambiente.mp3')
        this.winner = new Sound('/sounds/winner.mp3')
        this.portalSound = new Sound('/sounds/portal.mp3')
        this.loseSound = new Sound('/sounds/lose.ogg')


        this.allowPrizePickup = false
        this.hasMoved = false

        setTimeout(() => {
            this.allowPrizePickup = true
        }, 2000)

        this.resources.on('ready', async () => {
            this.floor = new Floor(this.experience)
            this.environment = new Environment(this.experience)

            this.loader = new ToyCarLoader(this.experience)
            await this.loader.loadFromAPI()
            this.refreshLevelProgress(1)

            this.robot = new Robot(this.experience)
            this.fox = new Fox(this.experience, this.robot)

            // Buscar spawn en los bloques cargados inicialmente
            if (this.loader.loadedBlocks && this.loader.loadedBlocks.length > 0) {
                const spawnPoint = this.getSpawnForLevel(1, this.loader.loadedBlocks);
                this.resetRobotPosition(spawnPoint);
            }

            // Seleccionar modelo del enemigo según el nivel
            this._updateEnemyTemplate(this.levelManager.currentLevel)

            // Solo crear enemigos si el nivel actual lo permite
            if (this.levelManager.currentLevel >= ENEMY_MIN_LEVEL) {
                await this._loadEnemyRouteData(this.levelManager.currentLevel)
                this.spawnEnemies(1)
            }

            this.experience.vr.bindCharacter(this.robot)
            this.thirdPersonCamera = new ThirdPersonCamera(this.experience, this.robot.group)

            this.mobileControls = new MobileControls({
                onUp: (pressed) => { this.experience.keyboard.keys.up = pressed },
                onDown: (pressed) => { this.experience.keyboard.keys.down = pressed },
                onLeft: (pressed) => { this.experience.keyboard.keys.left = pressed },
                onRight: (pressed) => { this.experience.keyboard.keys.right = pressed }
            })

            if (!this.experience.physics || !this.experience.physics.world) {
                console.error("Sistema de fisicas no esta inicializado al cargar el mundo.");
                return;
            }

            // Si se esta en modo VR, ocultar el robot
            this._checkVRMode()

            this.experience.renderer.instance.xr.addEventListener('sessionstart', () => {
                this._checkVRMode()
            })


        })
    }

    // Crear enemigos
    spawnEnemies(count = 1) {
        if (!this.robot?.body?.position) return

        // Limpia anteriores si existen
        if (this.enemies?.length) {
            this.enemies.forEach(e => e?.destroy?.())
            this.enemies = []
        }

        const patrolPoints = this.enemyPatrol || [];
        const chasePoints = this.ghostChasePoints || [];
        const spawnPoints = this.enemySpawn || [];

        let spawnPosition = new THREE.Vector3(0, 1.5, 0);

        if (spawnPoints.length > 0) {
            const sp = spawnPoints[0];
            spawnPosition.set(sp.x, sp.y + 1.0, sp.z);
        } else {
            // Fallback random
            const minRadius = 25
            const maxRadius = 40
            const angle = Math.random() * Math.PI * 2
            const radius = minRadius + Math.random() * (maxRadius - minRadius)
            spawnPosition.set(
                this.robot.body.position.x + Math.cos(angle) * radius,
                1.5,
                this.robot.body.position.z + Math.sin(angle) * radius
            );
        }

        const enemy = new Enemy({
            scene: this.scene,
            physicsWorld: this.experience.physics.world,
            playerRef: this.robot,
            model: this.enemyTemplate,
            position: spawnPosition,
            experience: this.experience,
            patrolPoints: patrolPoints,
            chasePoints: chasePoints
        })

        // Activar de inmediato
        enemy.delayActivation = 0
        this.enemies.push(enemy)
    }

    spawnLevel4Enemies() {
        if (!this.robot?.body?.position || !this.enemyLargeTemplate) return

        if (this.enemies?.length) {
            this.enemies.forEach(e => e?.destroy?.())
            this.enemies = []
        }

        const enemyConfigs = [
            { x: -4, z: 14, patrol: [{ x: -10, z: 12 }, { x: 0, z: 7 }, { x: 6, z: 16 }] },
            { x: 13, z: 4, patrol: [{ x: 9, z: -4 }, { x: 19, z: 0 }, { x: 17, z: 11 }] },
            { x: -13, z: -8, patrol: [{ x: -18, z: -14 }, { x: -7, z: -18 }, { x: -4, z: -5 }] }
        ]

        enemyConfigs.forEach((config, index) => {
            const position = new THREE.Vector3(config.x, 1.5, config.z)
            const patrolPoints = config.patrol.map(point => ({
                x: point.x,
                y: 1.5,
                z: point.z
            }))

            const enemy = new EnemyLarge({
                scene: this.scene,
                physicsWorld: this.experience.physics.world,
                playerRef: this.robot,
                model: this.enemyLargeTemplate,
                position,
                experience: this.experience,
                patrolPoints
            })

            enemy.delayActivation = index * 0.4
            this.enemies.push(enemy)
        })

        console.log(`Nivel 4: ${this.enemies.length} enemigos grandes creados`)
    }
    spawnLevel5Zombie() {
        if (!this.robot?.body?.position || !this.zombieTemplate) return

        if (this.enemies?.length) {
            this.enemies.forEach(e => e?.destroy?.())
            this.enemies = []
        }

        // Posición inicial del zombie en nivel 5.
        // Después puedes ajustar x y z según dónde quieras que aparezca.
        const position = new THREE.Vector3(0, 1.5, -12)

        // Ruta simple de patrulla para el zombie.
        // Estos puntos se pueden ajustar al mapa del nivel 5.
        const patrolPoints = [
            { x: -8, y: 1.5, z: -12 },
            { x: 8, y: 1.5, z: -12 },
            { x: 8, y: 1.5, z: 4 },
            { x: -8, y: 1.5, z: 4 }
        ]

        const zombie = new EnemyLarge({
            scene: this.scene,
            physicsWorld: this.experience.physics.world,
            playerRef: this.robot,
            model: this.zombieTemplate,
            position,
            experience: this.experience,
            patrolPoints
        })

        zombie.delayActivation = 0
        this.enemies.push(zombie)

        console.log('Nivel 5: zombie creado')
    }

    toggleAudio() {
        this.ambientSound.toggle()
    }

    triggerDefeat() {
        if (this.defeatTriggered) return;
        this.defeatTriggered = true;

        if (window.userInteracted && this.loseSound) {
            this.loseSound.play();
        }

        this.experience.modal.show({
            icon: '💀',
            message: '¡El enemigo te atrapó!\n¿Quieres intentarlo otra vez?',
            buttons: [
                {
                    text: '🔁 Reintentar',
                    onClick: () => this.experience.resetGameToFirstLevel()
                },
                {
                    text: '❌ Salir',
                    onClick: () => this.experience.resetGame()
                }
            ]
        });
    }

    checkHazards() {
        if (!this.robot?.body || !this.loader?.hazards?.length) return

        const playerPos = this.robot.body.position

        for (const hazard of this.loader.hazards) {
            if (!hazard?.parent) continue

            const bbox = new THREE.Box3().setFromObject(hazard)
            const closestX = Math.max(bbox.min.x, Math.min(playerPos.x, bbox.max.x))
            const closestZ = Math.max(bbox.min.z, Math.min(playerPos.z, bbox.max.z))
            const dx = playerPos.x - closestX
            const dz = playerPos.z - closestZ
            const horizontalDistance = Math.sqrt(dx * dx + dz * dz)
            const nearHeight = playerPos.y > bbox.min.y - 0.5 && playerPos.y < bbox.max.y + 1.6

            if (horizontalDistance < 0.65 && nearHeight) {
                console.log(`Jugador toco peligro: ${hazard.userData.hazardName || hazard.name}`)
                if (hazard.userData.hazardMode === 'damage' && typeof this.robot.takeDamage === 'function') {
                    this.robot.takeDamage(hazard.userData.hazardDamage || 1)
                } else {
                    this.robot.die()
                }
                return
            }
        }
    }

    async update(delta) {
        this.robot?.update()
        this.fox?.update(delta)
        this.blockPrefab?.update()
        this.checkHazards()

        // 🧟‍♂️ Solo actualizar enemigos si el juego ya comenzó Y el nivel lo permite
        if (this.gameStarted && this.levelManager.currentLevel >= ENEMY_MIN_LEVEL) {
            this.enemies?.forEach(e => e.update(delta))
        }

        if (this.thirdPersonCamera && this.experience.isThirdPerson && !this.experience.renderer.instance.xr.isPresenting) {
            this.thirdPersonCamera.update()
        }

        this.loader?.prizes?.forEach(p => p.update(delta))

        if (!this.allowPrizePickup || !this.loader || !this.robot || !this.robot.body) return


        let pos = null

        if (this.experience.renderer.instance.xr.isPresenting) {
            pos = this.experience.camera.instance.position
        } else if (this.robot?.body?.position) {
            pos = this.robot.body.position
        } else {
            return // No hay posición válida, salimos del update
        }


        const speed = this.robot?.body?.velocity?.length?.() || 0
        const moved = speed > 0.5
        const pointsTarget = this.getCurrentPointsTarget()

        // 1. Recolección de monedas normales
        this.loader.prizes.forEach((prize) => {
            if (!prize.pivot || prize.role === "finalPrize") return // Ignorar finalPrize del array aquí

            const dist = prize.pivot.position.distanceTo(pos)
            if (dist < 3.5 && moved && !prize.collected) {
                prize.collect()
                prize.collected = true

                this.points = (this.points || 0) + 1
                this.robot.points = this.points

                console.log(`🎯 Monedas recolectadas: ${this.points} / ${pointsTarget}`)
                console.log(`[PORTAL] Monedas: ${this.points} / ${pointsTarget}`)

                if (this.experience.raycaster?.removeRandomObstacles) {
                    const reduction = 0.2 + Math.random() * 0.1
                    this.experience.raycaster.removeRandomObstacles(reduction)
                }

                if (window.userInteracted && this.coinSound) {
                    this.coinSound.play()
                }

                this.experience.menu?.setPoints?.(this.points, pointsTarget)
            }
        });

        // 2. Activar portal si recogió todo y no está activado aún
        if (!this.finalPrizeActivated && this.points >= pointsTarget) {
            const portalPos = this.getPortalForLevel(this.levelManager.currentLevel, this.loader.loadedBlocks);
            if (!portalPos) return

            if (portalPos) {
                this.finalPrizeActivated = true;

                // Mover finalCoin visualmente a la posición del portal
                const finalCoin = this.loader.prizes.find(p => p.role === "finalPrize");
                if (finalCoin && finalCoin.pivot) {
                    finalCoin.pivot.position.copy(portalPos);
                    finalCoin.pivot.visible = true;
                    if (finalCoin.model) finalCoin.model.visible = true;
                }

                if (this.levelManager.currentLevel !== 1) {
                    const finalPrizeEffect = new FinalPrizeParticles({
                        scene: this.scene,
                        targetPosition: portalPos,
                        sourcePosition: this.experience.vrDolly?.position ?? this.experience.camera.instance.position,
                        experience: this.experience
                    })
                    this.finalPrizeParticles.push(finalPrizeEffect)
                }

                this.createPortalVortex(portalPos)

                if (window.userInteracted && this.portalSound) {
                    this.portalSound.play()
                }

                console.log("🪙 Portal final activado correctamente en:", portalPos)
            } else {
                console.warn("No se encontro un bloque de portal valido.");
            }
        }

        // 3. Chequear si el jugador entró al portal activado
        if (this.finalPrizeActivated && this.points >= pointsTarget) {
            const portalPos = this.getPortalForLevel(this.levelManager.currentLevel, this.loader.loadedBlocks);

            // Distancia horizontal (ignorar Y porque el efecto está elevado)
            if (!portalPos) return

            const dx = portalPos.x - pos.x;
            const dz = portalPos.z - pos.z;
            const horizontalDist = Math.sqrt(dx * dx + dz * dz);

            const portalRadius = this.levelManager.currentLevel === 4 ? 5.0 : 2.5;
            if (horizontalDist < portalRadius) {
                this.points = -999 // hack para evitar triggers repetidos

                const finalCoin = this.loader.prizes.find(p => p.role === "finalPrize")
                if (finalCoin && !finalCoin.collected) {
                    finalCoin.collect()
                    finalCoin.collected = true
                    if (window.userInteracted && this.winner) {
                        this.winner.play()
                    }
                }

                // ── Actividad 4: Guardar partida (equivalente a POST /orders del profe) ──
                const nivelCompletado = this.levelManager.currentLevel
                const puntosObtenidos = Math.abs(this.robot?.points || 0)
                const tiempoTranscurrido = Math.floor(Date.now() / 1000 - (this.experience.tracker?.startTimestamp || Date.now() / 1000))

                if (import.meta.env.VITE_FRONTEND_ONLY !== 'true') {
                    fetch(
                        (import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/auth/sessions',
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': 'Bearer ' + localStorage.getItem('token')
                            },
                            body: JSON.stringify({
                                nivel: nivelCompletado,
                                puntos: puntosObtenidos,
                                tiempo: tiempoTranscurrido
                            })
                        }
                    )
                        .then((res) => {
                            if (!res.ok) throw new Error(`HTTP ${res.status}`)
                            console.log('✅ Partida guardada: nivel', nivelCompletado)
                        })
                        .catch(() => console.warn('⚠️ No se pudo guardar la partida'))
                }
                // ── Fin guardar partida ──

                if (this.levelManager.currentLevel < this.levelManager.totalLevels) {
                    this.clearFinalPrizeParticles()
                    this.clearPortalVortex()
                    const changedLevel = await this.levelManager.nextLevel()
                    if (!changedLevel) {
                        this.experience.modal.show({
                            icon: '🚀',
                            message: 'Nivel 5 pendiente por exportar.\nLa nave ya esta lista para llevarte alli.',
                            buttons: [{ text: 'Continuar', onClick: () => { } }]
                        })
                        this.points = nivelCompletado
                        this.robot.points = nivelCompletado
                        return
                    }

                    // ── Guardar nivel actual para "Continuar partida" ──
                    localStorage.setItem('savedLevel', this.levelManager.currentLevel)
                    // ── Fin guardar nivel ──

                    this.points = 0
                    this.robot.points = 0
                } else {
                    // ── Limpiar nivel guardado al terminar el juego completo ──
                    localStorage.removeItem('savedLevel')
                    // ── Fin limpiar ──

                    const elapsed = this.experience.tracker.stop()
                    this.experience.tracker.saveTime(elapsed)
                    this.experience.tracker.showEndGameModal(elapsed)

                    this.experience.obstacleWavesDisabled = true
                    clearTimeout(this.experience.obstacleWaveTimeout)
                    this.experience.raycaster?.removeAllObstacles()
                }
            }
        }


        // Faro rotación
        if (this.portalVortexGroup) {
            this.portalVortexGroup.rotation.y += delta * 0.9
            this.portalVortexGroup.children.forEach((child, index) => {
                if (child.userData?.spin) {
                    child.rotation.z += delta * child.userData.spin
                    child.scale.setScalar(1 + Math.sin(Date.now() * 0.003 + index) * 0.04)
                }
                if (child.userData?.spinY) {
                    child.rotation.y += delta * child.userData.spinY
                    child.scale.setScalar(1 + Math.sin(Date.now() * 0.003 + index) * 0.035)
                }
                if (child.material?.uniforms?.uTime) {
                    child.material.uniforms.uTime.value += delta
                }
                if (child.userData?.isParticles) {
                    const positions = child.geometry.attributes.position.array
                    const velocities = child.userData.velocities
                    for (let i = 0; i < velocities.length; i++) {
                        const i3 = i * 3
                        positions[i3 + 1] += velocities[i].y * delta

                        // Rotación en el vórtice
                        const x = positions[i3 + 0]
                        const z = positions[i3 + 2]
                        positions[i3 + 0] = x * Math.cos(velocities[i].spin * delta) - z * Math.sin(velocities[i].spin * delta)
                        positions[i3 + 2] = x * Math.sin(velocities[i].spin * delta) + z * Math.cos(velocities[i].spin * delta)

                        const currentLevel = this.levelManager?.currentLevel
                        const isLargePortal = currentLevel === 3 || currentLevel === 4
                        if (positions[i3 + 1] > (isLargePortal ? 7 : 5)) {
                            positions[i3 + 1] = 0
                            positions[i3 + 0] = (Math.random() - 0.5) * (isLargePortal ? 7 : 4)
                            positions[i3 + 2] = (Math.random() - 0.5) * (isLargePortal ? 7 : 4)
                        }
                    }
                    child.geometry.attributes.position.needsUpdate = true
                }
            })
        }

        // Optimización física por distancia
        const playerPos = this.experience.renderer.instance.xr.isPresenting
            ? this.experience.camera.instance.position
            : this.robot?.body?.position

        this.scene.traverse((obj) => {
            if (obj.userData?.levelObject && obj.userData.physicsBody) {
                const dist = obj.position.distanceTo(playerPos)
                const shouldEnable = dist < 40 && obj.visible

                const body = obj.userData.physicsBody
                if (shouldEnable && !body.enabled) {
                    body.enabled = true
                } else if (!shouldEnable && body.enabled) {
                    body.enabled = false
                }
            }
        })
    }

    getCurrentPointsTarget() {
        return this.totalDefaultCoins || this.levelManager.getCurrentLevelTargetPoints()
    }

    refreshLevelProgress(level) {
        this.totalDefaultCoins = this.loader?.prizes?.filter(p => p.role === "default").length || 0
        this.experience.menu?.setLevel?.(level)
        this.experience.menu?.setPoints?.(this.points || 0, this.getCurrentPointsTarget())
        console.log(`Meta dinamica nivel ${level}: ${this.totalDefaultCoins} monedas default`)
    }

    createPortalVortex(position) {
        if (this.portalVortexGroup) {
            this.clearPortalVortex()
        }

        const group = new THREE.Group()
        group.position.copy(position)

        const isLevel1 = this.levelManager?.currentLevel === 1
        const isLevel3 = this.levelManager?.currentLevel === 3
        const isLevel4 = this.levelManager?.currentLevel === 4
        const isLargePortal = isLevel3 || isLevel4

        // Colores base del portal: Tonalidad fantasma para nivel 3, cyan/amarillo para nivel 1
        const ringColors = isLevel4
            ? [0xff7a18, 0x2dd4ff, 0xffffff]
            : isLevel3
                ? [0x9d4edd, 0xff0055, 0x480ca8] // Morado, fucsia, azul oscuro
                : [0x27f5d2, 0xffd166, 0xffffff] // Cyan, amarillo, blanco

        const mainColor = isLevel4 ? 0xff7a18 : (isLevel3 ? 0x9d4edd : 0x27f5d2)
        const radiusScale = isLevel4 ? 1.65 : (isLevel3 ? 1.55 : 1)

        if (isLevel1) {
            this.createLevelOneShaderVortex(group)
            this.portalVortexGroup = group
            this.scene.add(group)
            return
        }

        for (let i = 0; i < 3; i++) {
            const geometry = new THREE.TorusGeometry((1.1 + i * 0.35) * radiusScale, 0.035 * radiusScale, 8, 80)
            const material = new THREE.MeshBasicMaterial({
                color: ringColors[i],
                transparent: true,
                opacity: 0.78 - i * 0.13,
                side: THREE.DoubleSide
            })
            const ring = new THREE.Mesh(geometry, material)
            ring.rotation.x = Math.PI / 2
            ring.rotation.z = i * 0.75
            ring.position.y = (isLargePortal ? 1.5 : 1.05) + i * 0.35
            ring.userData.spin = i % 2 === 0 ? 1.4 : -1.1
            group.add(ring)
        }

        const spiralMaterial = new THREE.MeshBasicMaterial({
            color: mainColor,
            transparent: true,
            opacity: 0.34,
            side: THREE.DoubleSide,
            depthWrite: false
        })

        for (let i = 0; i < 5; i++) {
            const geometry = new THREE.ConeGeometry(0.08 * radiusScale, 3.2 * radiusScale, 5, 1, true)
            const beam = new THREE.Mesh(geometry, spiralMaterial.clone())
            beam.position.y = isLargePortal ? 2.5 : 1.9
            beam.rotation.x = Math.PI / 2
            beam.rotation.z = (i * Math.PI * 2) / 5
            beam.userData.spin = 0.9 + i * 0.12
            group.add(beam)
        }

        const pointLight = new THREE.PointLight(mainColor, isLargePortal ? 4.5 : 4, isLargePortal ? 12 : 9)
        pointLight.position.set(0, isLargePortal ? 3.0 : 2.2, 0)
        group.add(pointLight)

        // --- Partículas del portal ---
        const particleCount = isLargePortal ? 260 : 150
        const particlesGeometry = new THREE.BufferGeometry()
        const particlesPosition = new Float32Array(particleCount * 3)
        const particlesVelocity = []

        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3
            particlesPosition[i3 + 0] = (Math.random() - 0.5) * (isLargePortal ? 7 : 4)
            particlesPosition[i3 + 1] = Math.random() * (isLargePortal ? 7 : 5)
            particlesPosition[i3 + 2] = (Math.random() - 0.5) * (isLargePortal ? 7 : 4)
            particlesVelocity.push({
                y: 0.5 + Math.random() * 1.5,
                spin: (Math.random() - 0.5) * 2
            })
        }

        particlesGeometry.setAttribute('position', new THREE.BufferAttribute(particlesPosition, 3))
        const particlesMaterial = new THREE.PointsMaterial({
            color: mainColor,
            size: isLargePortal ? 0.16 : 0.1,
            transparent: true,
            opacity: isLevel3 ? 0.65 : 0.8,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        })

        const particles = new THREE.Points(particlesGeometry, particlesMaterial)
        particles.userData.velocities = particlesVelocity
        particles.userData.isParticles = true
        particles.userData.portalEffect = true
        group.add(particles)

        this.portalVortexGroup = group
        this.scene.add(group)
    }

    createLevelOneShaderVortex(group) {
        const vortexY = 0.35

        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uColorA: { value: new THREE.Color(0x27f5d2) },
                uColorB: { value: new THREE.Color(0xffd166) }
            },
            vertexShader: `
                varying vec2 vUv;

                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float uTime;
                uniform vec3 uColorA;
                uniform vec3 uColorB;
                varying vec2 vUv;

                void main() {
                    vec2 p = vUv - 0.5;
                    float radius = length(p) * 2.0;
                    float angle = atan(p.y, p.x);

                    float spiral = sin(angle * 7.0 - radius * 12.0 + uTime * 3.2);
                    float ripple = sin(radius * 20.0 - uTime * 4.0);
                    float glow = 1.0 - smoothstep(0.0, 1.0, radius);
                    float edge = 1.0 - smoothstep(0.78, 1.0, radius);

                    float strength = (0.36 + spiral * 0.28 + ripple * 0.12) * edge;
                    strength += glow * 0.45;

                    vec3 color = mix(uColorA, uColorB, spiral * 0.5 + 0.5);
                    gl_FragColor = vec4(color, clamp(strength, 0.0, 0.92));
                }
            `,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        })

        const geometry = new THREE.CircleGeometry(1.75, 96)
        const frontVortex = new THREE.Mesh(geometry, material)
        frontVortex.position.y = vortexY
        frontVortex.userData.spinY = 0.55
        group.add(frontVortex)

        const crossedVortex = new THREE.Mesh(geometry.clone(), material.clone())
        crossedVortex.position.y = vortexY
        crossedVortex.rotation.y = Math.PI / 2
        crossedVortex.userData.spinY = -0.45
        group.add(crossedVortex)

        const halo = new THREE.Mesh(
            new THREE.RingGeometry(1.55, 1.72, 96),
            new THREE.MeshBasicMaterial({
                color: 0xffd166,
                transparent: true,
                opacity: 0.72,
                side: THREE.DoubleSide,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            })
        )
        halo.position.y = vortexY
        halo.userData.spinY = 0.25
        group.add(halo)

        const pointLight = new THREE.PointLight(0x27f5d2, 4, 9)
        pointLight.position.set(0, vortexY + 0.1, 0)
        group.add(pointLight)
    }

    clearPortalVortex() {
        if (!this.portalVortexGroup) return

        this.portalVortexGroup.traverse((obj) => {
            if (obj.geometry) obj.geometry.dispose()
            if (obj.material) {
                if (Array.isArray(obj.material)) {
                    obj.material.forEach(mat => mat.dispose())
                } else {
                    obj.material.dispose()
                }
            }
        })
        this.scene.remove(this.portalVortexGroup)
        this.portalVortexGroup = null
    }

    clearFinalPrizeParticles() {
        this.finalPrizeParticles?.forEach(effect => effect?.dispose?.())
        this.finalPrizeParticles = []
    }


    async loadLevel(level) {
        try {
            const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
            const apiUrl = `${backendUrl}/api/blocks?level=${level}`;

            const publicPath = (p) => {
                const base = import.meta.env.BASE_URL || '/';
                return `${base.replace(/\/$/, '')}/${p.replace(/^\//, '')}`;
            };

            let data;
            try {
                const res = await fetch(apiUrl);
                if (!res.ok) throw new Error('Error desde API');
                // Asegurar que la respuesta sea JSON
                const ct = res.headers.get('content-type') || '';
                if (!ct.includes('application/json')) {
                    const preview = (await res.text()).slice(0, 120);
                    throw new Error(`Respuesta no-JSON desde API (${apiUrl}): ${preview}`);
                }
                data = await res.json();
                if (Array.isArray(data)) {
                    data = {
                        blocks: data,
                        spawnPoint: this.levelManager.getSpawnPoint(level)
                    };
                }
                console.log(`📦 Datos del nivel ${level} cargados desde API`);
            } catch (error) {
                console.warn(`⚠️ No se pudo conectar con el backend. Usando datos locales para nivel ${level}...`);


                const combinedLocalUrl = publicPath('data/toy_car_blocks.json');
                const levelLocalUrl = publicPath(`data/toy_car_blocks${level}.json`);
                let localUrl = combinedLocalUrl;
                let localRes = await fetch(localUrl);

                if (!localRes.ok) {
                    localUrl = levelLocalUrl;
                    localRes = await fetch(localUrl);
                }

                if (!localRes.ok) {
                    const preview = (await localRes.text()).slice(0, 120);
                    throw new Error(`No se pudo cargar ${localUrl} (HTTP ${localRes.status}). Vista previa: ${preview}`);
                }
                const localCt = localRes.headers.get('content-type') || '';
                if (!localCt.includes('application/json')) {
                    const preview = (await localRes.text()).slice(0, 120);
                    throw new Error(`Contenido no JSON en ${localUrl}. Vista previa: ${preview}`);
                }
                const allBlocks = await localRes.json();

                const filteredBlocks = allBlocks.filter(b => b.level === level);

                if (filteredBlocks.length === 0) {
                    throw new Error(`No hay bloques locales para el nivel ${level}.`);
                }

                data = {
                    blocks: filteredBlocks,
                    spawnPoint: this.levelManager.getSpawnPoint(level)
                };
            }

            let blocksArray = data.blocks ? data.blocks : (Array.isArray(data) ? data : []);
            if (blocksArray.length === 0) {
                throw new Error(`No hay bloques para el nivel ${level}. Revisa backend, Mongo o los JSON locales.`);
            }
            let spawnPoint = this.getSpawnForLevel(level, blocksArray);

            // Guardar datos del nivel (incluye empties como rutas)
            this.currentLevelData = data;
            this.loader.loadedBlocks = blocksArray;

            this.points = 0;
            this.robot.points = 0;
            this.robot.restoreHealth?.();
            this.finalPrizeActivated = false;
            this.experience.menu?.setLevel?.(level);
            this.experience.menu?.setPoints?.(this.points, this.getCurrentPointsTarget());

            if (blocksArray.length > 0) {
                // Intentar cargar configuración de física precisa (Trimesh)
                let preciseModels = [];
                try {
                    const preciseLevelUrl = publicPath(`config/precisePhysicsModels${level}.json`);
                    const resLevel = await fetch(preciseLevelUrl);

                    if (resLevel.ok) {
                        preciseModels = await resLevel.json();
                        console.log(`Usando modelos fisicos precisos especificos del nivel ${level}`);
                    } else {
                        // Fallback al archivo general
                        const preciseUrl = publicPath('config/precisePhysicsModels.json');
                        const resGeneral = await fetch(preciseUrl);
                        if (resGeneral.ok) {
                            preciseModels = await resGeneral.json();
                            console.log(`Usando modelos fisicos precisos generales (fallback)`);
                        } else {
                            console.warn(`No se encontro configuracion de fisica precisa en ${preciseUrl}`);
                        }
                    }
                } catch (e) {
                    console.error('Error al cargar configuracion de fisica precisa:', e);
                }

                // Procesar bloques con la configuración obtenida
                await this.loader._processBlocks(blocksArray, preciseModels);
            } else {
                await this.loader.loadFromURL(apiUrl);
            }


            this.loader.prizes.forEach(p => {
                if (p.model) p.model.visible = (p.role !== 'finalPrize');
                p.collected = false;
            });

            this.refreshLevelProgress(level);
            console.log(`🎯 Total de monedas default para el nivel ${level}: ${this.totalDefaultCoins}`);

            this.resetRobotPosition(spawnPoint);
            this.setupEnemiesForLevel(level);
            console.log(`✅ Nivel ${level} cargado con spawn en`, spawnPoint);
        } catch (error) {
            console.error('❌ Error cargando nivel:', error);
        }
        if (this.thirdPersonCamera) {
            this.thirdPersonCamera.setModo(level === 2 ? 'cerca' : 'lejos')
        }

    }

    async setupEnemiesForLevel(level) {
        if (level === ENEMY_MIN_LEVEL) { // Solo en nivel 3
            // Actualizar el modelo del enemigo para el nivel correcto
            this._updateEnemyTemplate(level)

            // Cargar puntos de patrulla/persecución/spawn
            await this._loadEnemyRouteData(level)

            this.spawnEnemies(1);
            return;
        }

        if (level === 4) {
            this._updateEnemyTemplate(level)
            this.spawnLevel4Enemies()
            return
        }
        if (level === 5) {
            this._updateEnemyTemplate(level)
            this.spawnLevel5Zombie()
            return
        }

        if (this.enemies?.length) {
            this.enemies.forEach(enemy => enemy?.destroy?.());
            this.enemies = [];
        }
    }

    /**
     * Seleccionar el modelo 3D del enemigo según el nivel
     */
    _updateEnemyTemplate(level) {
        let enemyModel = null
        this.enemyLargeTemplate = null
        this.zombieTemplate = null

        if (level === 3) {
            enemyModel = this.resources.items.ghostskull
            if (enemyModel) {
                console.log('Usando modelo ghost skull del nivel 3')
            }
        }

        if (level === 4) {
            this.enemyLargeTemplate = this.resources.items.enemyLarge
            if (this.enemyLargeTemplate) {
                console.log('Usando Enemy Large para el nivel 4')
            }
        }
        if (level === 5) {
            this.zombieTemplate = this.resources.items.zombieModel
            if (this.zombieTemplate) {
                console.log('Usando Zombie para el nivel 5')
            } else {
                console.warn('No se encontró zombieModel. Revisa sources.js y /models/Enemy/Zombie.glb')
            }
        }

        if (!enemyModel) {
            enemyModel = this.resources.items.ghostskull
            if (enemyModel) {
                console.log('Usando modelo ghostskull genérico')
            }
        }

        this.enemyTemplate = enemyModel || new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshStandardMaterial({ color: 0xff0000 })
        )
    }

    /**
     * Cargar puntos de patrulla, persecución y spawn del JSON del nivel
     */
    async _loadEnemyRouteData(level) {
        // Limpiar datos previos
        this.enemyPatrol = []
        this.ghostChasePoints = []
        this.enemySpawn = []

        if (level !== 3) return

        try {
            const publicPath = (p) => {
                const base = import.meta.env.BASE_URL || '/';
                return `${base.replace(/\/$/, '')}/${p.replace(/^\//, '')}`;
            };

            const res = await fetch(publicPath('/models/toycar3/toy_car_blocks3.json'));
            const data = await res.json();

            if (data.enemyPatrol && Array.isArray(data.enemyPatrol)) {
                this.enemyPatrol = data.enemyPatrol.sort((a, b) => a.order - b.order);
                console.log(`Cargados ${this.enemyPatrol.length} puntos de patrulla del ghost`);
            }
            if (data.ghostChasePoints && Array.isArray(data.ghostChasePoints)) {
                this.ghostChasePoints = data.ghostChasePoints.sort((a, b) => a.order - b.order);
                console.log(`Cargados ${this.ghostChasePoints.length} puntos de persecución del ghost`);
            }
            if (data.enemySpawn && Array.isArray(data.enemySpawn)) {
                this.enemySpawn = data.enemySpawn;
                console.log(`Cargado spawn point del ghost en (${this.enemySpawn[0]?.x?.toFixed(1)}, ${this.enemySpawn[0]?.y?.toFixed(1)}, ${this.enemySpawn[0]?.z?.toFixed(1)})`);
            }
        } catch (err) {
            console.warn('Error cargando datos de ruta del enemigo:', err);
        }
    }

    clearCurrentScene() {
        if (!this.experience || !this.scene || !this.experience.physics || !this.experience.physics.world) {
            console.warn('⚠️ No se puede limpiar: sistema de físicas no disponible.');
            return;
        }

        let visualObjectsRemoved = 0;
        let physicsBodiesRemoved = 0;

        const childrenToRemove = [];

        this.scene.children.forEach((child) => {
            if (child.userData && child.userData.levelObject) {
                childrenToRemove.push(child);
            }
        });

        childrenToRemove.forEach((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => mat.dispose());
                } else {
                    child.material.dispose();
                }
            }

            this.scene.remove(child);

            if (child.userData.physicsBody) {
                this.experience.physics.world.removeBody(child.userData.physicsBody);
            }

            visualObjectsRemoved++;
        });

        let physicsBodiesRemaining = -1;

        if (this.experience.physics && this.experience.physics.world && Array.isArray(this.experience.physics.bodies)) {
            const survivingBodies = [];
            let bodiesBefore = this.experience.physics.bodies.length;

            this.experience.physics.bodies.forEach((body) => {
                if (body.userData && body.userData.levelObject) {
                    this.experience.physics.world.removeBody(body);
                    physicsBodiesRemoved++;
                } else {
                    survivingBodies.push(body);
                }
            });

            this.experience.physics.bodies = survivingBodies;

            console.log(`🧹 Physics Cleanup Report:`);
            console.log(`✅ Cuerpos físicos eliminados: ${physicsBodiesRemoved}`);
            console.log(`🎯 Cuerpos físicos sobrevivientes: ${survivingBodies.length}`);
            console.log(`📦 Estado inicial: ${bodiesBefore} cuerpos → Estado final: ${survivingBodies.length} cuerpos`);
        } else {
            console.warn('⚠️ Physics system no disponible o sin cuerpos activos, omitiendo limpieza física.');
        }

        console.log(`🧹 Escena limpiada antes de cargar el nuevo nivel.`);
        console.log(`✅ Objetos 3D eliminados: ${visualObjectsRemoved}`);
        console.log(`✅ Cuerpos físicos eliminados: ${physicsBodiesRemoved}`);
        console.log(`🎯 Objetos 3D actuales en escena: ${this.scene.children.length}`);

        if (physicsBodiesRemaining !== -1) {
            console.log(`🎯 Cuerpos físicos actuales en Physics World: ${physicsBodiesRemaining}`);
        }

        if (this.loader && this.loader.prizes.length > 0) {
            this.loader.prizes.forEach(prize => prize?.destroy?.());
            this.loader.prizes = [];
            console.log('🎯 Premios del nivel anterior eliminados correctamente.');
        }

        this.finalPrizeActivated = false
        this.loader?.prizes?.forEach(p => {
            if (p.role === "finalPrize" && p.pivot) {
                p.pivot.visible = false;
                if (p.model) p.model.visible = false;
                p.collected = false;
            }
        })

        this.clearFinalPrizeParticles()
        this.clearPortalVortex()


        /** Esto es de faro para limpienza */
        if (this.discoRaysGroup) {
            this.discoRaysGroup.children.forEach(obj => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) obj.material.dispose();
            });
            this.scene.remove(this.discoRaysGroup);
            this.discoRaysGroup = null;
        }

        /** Fin faro para limpianza */
    }

    getSpawnForLevel(level, blocksArray) {
        let spawnPosition = this.levelManager ? this.levelManager.getSpawnPoint(level) : { x: 0, y: 2, z: 0 };

        console.log("[SPAWN] Nivel:", level);

        if (!blocksArray || blocksArray.length === 0) {
            console.log("[SPAWN] Bloques disponibles: 0");
            console.log("[SPAWN] Coordenadas usadas:", spawnPosition);
            return spawnPosition;
        }

        console.log("[SPAWN] Bloques disponibles:", blocksArray.length);

        const spawnBlock = blocksArray.find(b => {
            if (!b.name) return false;
            const name = b.name.toLowerCase();
            return name.includes('player_spawn') || name.includes('spawn_circle');
        });

        if (spawnBlock) {
            console.log("[SPAWN] Bloque encontrado:", spawnBlock.name);
            spawnPosition = { x: spawnBlock.x, y: spawnBlock.y + 1.5, z: spawnBlock.z };
        } else {
            console.log("[SPAWN] Bloque no encontrado, usando fallback.");
        }

        console.log("[SPAWN] Coordenadas usadas:", spawnPosition);

        // Guardar en LevelManager para uso posterior
        if (this.levelManager) {
            this.levelManager.setSpawnPoint(level, spawnPosition);
        }

        return spawnPosition;
    }

    getPortalForLevel(level, blocksArray) {
        if (!blocksArray || blocksArray.length === 0) return null;

        if (level === 4) {
            const shipBlock = blocksArray.find(b => b.name === 'd_sh_spaceship_raetheredp_lev4');
            if (shipBlock) {
                const pos = new THREE.Vector3(shipBlock.x, shipBlock.y + 2.2, shipBlock.z);
                console.log("[PORTAL] Nave usada:", shipBlock.name);
                console.log("[PORTAL] Posicion final:", pos);
                return pos;
            }
        }

        // Prioridad 1: Buscar el aro real (portal_final)
        let portalBlock = blocksArray.find(b => b.name && b.name.toLowerCase().includes('portal_final'));

        // Prioridad 2: Cualquier portal
        if (!portalBlock) {
            portalBlock = blocksArray.find(b => b.name && b.name.toLowerCase().includes('portal'));
        }

        // Prioridad 3: Otros nombres de meta
        if (!portalBlock) {
            portalBlock = blocksArray.find(b => {
                if (!b.name) return false;
                const name = b.name.toLowerCase();
                return name.includes('meta') || name.includes('finish') || name.includes('victory');
            });
        }

        if (portalBlock) {
            console.log("[PORTAL] Bloque usado:", portalBlock.name);
            // El JSON ya tiene Y=2.2 para portal_final, no sumamos offset extra.
            // Si el bloque tiene Y cerca de 0 (como un cartel), sumamos 2 para elevar el efecto.
            const yOffset = portalBlock.y < 1.0 ? 2.0 : 0.0;
            const pos = new THREE.Vector3(portalBlock.x, portalBlock.y + yOffset, portalBlock.z);
            console.log("[PORTAL] Posicion final:", pos);
            return pos;
        }

        return null;
    }

    forceActivatePortal() {
        const target = this.getCurrentPointsTarget()
        this.points = target
        if (this.robot) this.robot.points = target
        this.experience.menu?.setPoints?.(target, target)
        this.finalPrizeActivated = false
        console.log('[PORTAL] Activacion forzada. Espera el siguiente frame.')
    }

    resetRobotPosition(spawn) {
        if (!spawn) {
            spawn = this.levelManager ? this.levelManager.getSpawnPoint(this.levelManager.currentLevel) : { x: 0, y: 2, z: 0 };
        }
        if (!this.robot?.body || !this.robot?.group) return

        this.robot.body.position.set(spawn.x, spawn.y, spawn.z)
        this.robot.body.velocity.set(0, 0, 0)
        this.robot.body.angularVelocity.set(0, 0, 0)
        this.robot.body.quaternion.setFromEuler(0, 0, 0)

        this.robot.group.position.set(spawn.x, spawn.y, spawn.z)
        this.robot.group.rotation.set(0, 0, 0)

        this.fox?.resetNear?.(spawn)
    }

    async _processLocalBlocks(blocks) {
        const preciseRes = await fetch('/config/precisePhysicsModels.json');
        const preciseModels = await preciseRes.json();
        await this.loader._processBlocks(blocks, preciseModels);

        this.loader.prizes.forEach(p => {
            if (p.model) p.model.visible = (p.role !== 'finalPrize');
            p.collected = false;
        });

        this.refreshLevelProgress(this.levelManager.currentLevel);
        console.log(`🎯 Total de monedas default para el nivel local: ${this.totalDefaultCoins}`);
    }

    _checkVRMode() {
        const isVR = this.experience.renderer.instance.xr.isPresenting

        if (isVR) {
            if (this.robot?.group) {
                this.robot.group.visible = false
            }

            // 🔁 Delay de 3s para que no ataque de inmediato en VR
            if (this.enemy) {
                this.enemy.delayActivation = 10.0
            }

            // 🧠 Posicionar cámara correctamente
            this.experience.camera.instance.position.set(5, 1.6, 5)
            this.experience.camera.instance.lookAt(new THREE.Vector3(5, 1.6, 4))
        } else {
            if (this.robot?.group) {
                this.robot.group.visible = true
            }
        }
    }


}
