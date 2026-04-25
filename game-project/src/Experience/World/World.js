import * as THREE from 'three'
import MobileControls from '../../controls/MobileControls.js'
import ToyCarLoader from '../../loaders/ToyCarLoader.js'
import FinalPrizeParticles from '../Utils/FinalPrizeParticles.js'
import AmbientSound from './AmbientSound.js'
import BlockPrefab from './BlockPrefab.js'
import Enemy from './Enemy.js'
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

            this.fox = new Fox(this.experience)
            this.robot = new Robot(this.experience)

            // Buscar spawn en los bloques cargados inicialmente
            if (this.loader.loadedBlocks && this.loader.loadedBlocks.length > 0) {
                const spawnPoint = this.getSpawnForLevel(1, this.loader.loadedBlocks);
                this.resetRobotPosition(spawnPoint);
            }

            // Enemigos multiples: plantilla y spawn lejos del jugador
            this.enemyTemplate = new THREE.Mesh(
                new THREE.BoxGeometry(1, 1, 1),
                new THREE.MeshStandardMaterial({ color: 0xff0000 })
            )
            // Solo crear enemigos si el nivel actual lo permite
            if (this.levelManager.currentLevel >= ENEMY_MIN_LEVEL) {
                const enemiesCountEnv = parseInt(import.meta.env.VITE_ENEMIES_COUNT || '3', 10)
                const enemiesCount = Number.isFinite(enemiesCountEnv) && enemiesCountEnv > 0 ? enemiesCountEnv : 3
                this.spawnEnemies(enemiesCount)
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

    // Crear varios enemigos en posiciones alejadas del jugador para evitar atascos iniciales
    spawnEnemies(count = 3) {
        if (!this.robot?.body?.position) return
        const playerPos = this.robot.body.position
        const minRadius = 25
        const maxRadius = 40

        // Limpia anteriores si existen
        if (this.enemies?.length) {
            this.enemies.forEach(e => e?.destroy?.())
            this.enemies = []
        }

        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2
            const radius = minRadius + Math.random() * (maxRadius - minRadius)
            const x = playerPos.x + Math.cos(angle) * radius
            const z = playerPos.z + Math.sin(angle) * radius
            const y = 1.5

            const enemy = new Enemy({
                scene: this.scene,
                physicsWorld: this.experience.physics.world,
                playerRef: this.robot,
                model: this.enemyTemplate,
                position: new THREE.Vector3(x, y, z),
                experience: this.experience
            })

            // Pequeño delay para que no ataquen todos a la vez
            enemy.delayActivation = 1.0 + i * 0.5
            this.enemies.push(enemy)
        }
    }

    toggleAudio() {
        this.ambientSound.toggle()
    }

    update(delta) {
        this.fox?.update()
        this.robot?.update()
        this.blockPrefab?.update()

        // 🧟‍♂️ Solo actualizar enemigos si el juego ya comenzó Y el nivel lo permite
        if (this.gameStarted && this.levelManager.currentLevel >= ENEMY_MIN_LEVEL) {
            this.enemies?.forEach(e => e.update(delta))

            // 💀 Verificar si algún enemigo atrapó al jugador
            const distToClosest = this.enemies?.reduce((min, e) => {
                if (!e?.body?.position || !this.robot?.body?.position) return min
                const d = e.body.position.distanceTo(this.robot.body.position)
                return Math.min(min, d)
            }, Infinity) ?? Infinity

            if (distToClosest < 1.0 && !this.defeatTriggered) {
                this.defeatTriggered = true  // Previene múltiples disparos

                if (window.userInteracted && this.loseSound) {
                    this.loseSound.play()
                }

                const firstEnemy = this.enemies?.[0]
                const enemyMesh = firstEnemy?.model || firstEnemy?.group
                if (enemyMesh) {
                    enemyMesh.scale.set(1.3, 1.3, 1.3)
                    setTimeout(() => {
                        enemyMesh.scale.set(1, 1, 1)
                    }, 500)
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
                })

                return
            }
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
        const pointsTarget = this.levelManager.getCurrentLevelTargetPoints()

        // 1. Recolección de monedas normales
        this.loader.prizes.forEach((prize) => {
            if (!prize.pivot || prize.role === "finalPrize") return // Ignorar finalPrize del array aquí

            const dist = prize.pivot.position.distanceTo(pos)
            if (dist < 1.2 && moved && !prize.collected) {
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

                this.experience.menu?.setStatus?.(`Puntos: ${this.points}`)
            }
        });

        // 2. Activar portal si recogió todo y no está activado aún
        if (!this.finalPrizeActivated && this.points >= pointsTarget) {
            const portalPos = this.getPortalForLevel(this.levelManager.currentLevel, this.loader.loadedBlocks);

            if (portalPos) {
                this.finalPrizeActivated = true;

                // Mover finalCoin visualmente a la posición del portal
                const finalCoin = this.loader.prizes.find(p => p.role === "finalPrize");
                if (finalCoin && finalCoin.pivot) {
                    finalCoin.pivot.position.copy(portalPos);
                    finalCoin.pivot.visible = true;
                    if (finalCoin.model) finalCoin.model.visible = true;
                }

                new FinalPrizeParticles({
                    scene: this.scene,
                    targetPosition: portalPos,
                    sourcePosition: this.experience.vrDolly?.position ?? this.experience.camera.instance.position,
                    experience: this.experience
                })

                // Faro visual
                this.discoRaysGroup = new THREE.Group()
                this.scene.add(this.discoRaysGroup)

                const rayMaterial = new THREE.MeshBasicMaterial({
                    color: 0xaa00ff,
                    transparent: true,
                    opacity: 0.25,
                    side: THREE.DoubleSide
                })

                const rayCount = 4
                for (let i = 0; i < rayCount; i++) {
                    const cone = new THREE.ConeGeometry(0.2, 4, 6, 1, true)
                    const ray = new THREE.Mesh(cone, rayMaterial)

                    ray.position.set(0, 2, 0)
                    ray.rotation.x = Math.PI / 2
                    ray.rotation.z = (i * Math.PI * 2) / rayCount

                    const spot = new THREE.SpotLight(0xaa00ff, 2, 12, Math.PI / 7, 0.2, 0.5)
                    spot.castShadow = false
                    spot.shadow.mapSize.set(1, 1)
                    spot.position.copy(ray.position)
                    spot.target.position.set(
                        Math.cos(ray.rotation.z) * 10,
                        2,
                        Math.sin(ray.rotation.z) * 10
                    )

                    ray.userData.spot = spot
                    this.discoRaysGroup.add(ray)
                    this.discoRaysGroup.add(spot)
                    this.discoRaysGroup.add(spot.target)
                }

                this.discoRaysGroup.position.copy(portalPos)

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
            const dx = portalPos.x - pos.x;
            const dz = portalPos.z - pos.z;
            const horizontalDist = Math.sqrt(dx * dx + dz * dz);

            if (portalPos && horizontalDist < 2.5 && moved) {
                this.points = -999; // hack para evitar triggers repetidos

                const finalCoin = this.loader.prizes.find(p => p.role === "finalPrize");
                if (finalCoin && !finalCoin.collected) {
                    finalCoin.collect()
                    finalCoin.collected = true
                    if (window.userInteracted && this.winner) {
                        this.winner.play()
                    }
                }

                if (this.levelManager.currentLevel < this.levelManager.totalLevels) {
                    this.levelManager.nextLevel()
                    this.points = 0
                    this.robot.points = 0
                } else {
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
        if (this.discoRaysGroup) {
            this.discoRaysGroup.rotation.y += delta * 0.5
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
                console.log(`📦 Datos del nivel ${level} cargados desde API`);
            } catch (error) {
                console.warn(`⚠️ No se pudo conectar con el backend. Usando datos locales para nivel ${level}...`);


                const localUrl = publicPath('data/toy_car_blocks.json');
                const localRes = await fetch(localUrl);
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

                data = {
                    blocks: filteredBlocks,
                    spawnPoint: this.levelManager.getSpawnPoint(level)
                };
            }

            let blocksArray = data.blocks ? data.blocks : (Array.isArray(data) ? data : []);
            let spawnPoint = this.getSpawnForLevel(level, blocksArray);
            this.points = 0;
            this.robot.points = 0;
            this.finalPrizeActivated = false;
            this.experience.menu.setStatus?.(`🎖️ Puntos: ${this.points}`);

            if (data.blocks) {
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
                this.loader._processBlocks(data.blocks, preciseModels);
            } else {
                await this.loader.loadFromURL(apiUrl);
            }


            this.loader.prizes.forEach(p => {
                if (p.model) p.model.visible = (p.role !== 'finalPrize');
                p.collected = false;
            });

            this.totalDefaultCoins = this.loader.prizes.filter(p => p.role === "default").length;
            console.log(`🎯 Total de monedas default para el nivel ${level}: ${this.totalDefaultCoins}`);

            this.resetRobotPosition(spawnPoint);
            console.log(`✅ Nivel ${level} cargado con spawn en`, spawnPoint);
        } catch (error) {
            console.error('❌ Error cargando nivel:', error);
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
            this.loader.prizes.forEach(prize => {
                if (prize.model) {
                    this.scene.remove(prize.model);
                    if (prize.model.geometry) prize.model.geometry.dispose();
                    if (prize.model.material) {
                        if (Array.isArray(prize.model.material)) {
                            prize.model.material.forEach(mat => mat.dispose());
                        } else {
                            prize.model.material.dispose();
                        }
                    }
                }
            });
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
            return name.includes('spawn_circle') ||
                name.includes('player_spawn') ||
                name.includes('spawn') ||
                name.includes('respawn');
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
    }

    async _processLocalBlocks(blocks) {
        const preciseRes = await fetch('/config/precisePhysicsModels.json');
        const preciseModels = await preciseRes.json();
        this.loader._processBlocks(blocks, preciseModels);

        this.loader.prizes.forEach(p => {
            if (p.model) p.model.visible = (p.role !== 'finalPrize');
            p.collected = false;
        });

        this.totalDefaultCoins = this.loader.prizes.filter(p => p.role === "default").length;
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