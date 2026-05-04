import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { createBoxShapeFromModel, createTrimeshShapeFromModel } from '../Experience/Utils/PhysicsShapeFactory.js';
import Prize from '../Experience/World/Prize.js';

export default class ToyCarLoader {
    constructor(experience) {
        this.experience = experience;
        this.scene = this.experience.scene;
        this.resources = this.experience.resources;
        this.physics = this.experience.physics;
        this.prizes = [];
        this.loadedBlocks = [];
    }

    _applyTextureToMeshes(root, imagePath, matcher, options = {}) {
        // Pre-chequeo: buscar meshes objetivo antes de cargar la textura
        const matchedMeshes = [];
        root.traverse((child) => {
            if (child.isMesh && (!matcher || matcher(child))) {
                matchedMeshes.push(child);
            }
        });

        if (matchedMeshes.length === 0) {
            // Evitar ruido en consola si no hay objetivos en este modelo
            // console.debug(`Sin meshes objetivo para ${imagePath} en este modelo.`)
            return;
        }

        const textureLoader = new THREE.TextureLoader();
        textureLoader.load(
            imagePath,
            (texture) => {
                if ('colorSpace' in texture) {
                    texture.colorSpace = THREE.SRGBColorSpace;
                } else {
                    texture.encoding = THREE.sRGBEncoding;
                }
                texture.flipY = false;
                const wrapS = options.wrapS || THREE.ClampToEdgeWrapping;
                const wrapT = options.wrapT || THREE.ClampToEdgeWrapping;
                texture.wrapS = wrapS;
                texture.wrapT = wrapT;
                const maxAniso = this.experience?.renderer?.instance?.capabilities?.getMaxAnisotropy?.();
                if (typeof maxAniso === 'number' && maxAniso > 0) {
                    texture.anisotropy = maxAniso;
                }
                const center = options.center || { x: 0.5, y: 0.5 };
                texture.center.set(center.x, center.y);
                if (typeof options.rotation === 'number') {
                    texture.rotation = options.rotation;
                }
                if (options.repeat) {
                    texture.repeat.set(options.repeat.x || 1, options.repeat.y || 1);
                }
                // Espejado opcional
                if (options.mirrorX) {
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.repeat.x = -Math.abs(texture.repeat.x || 1);
                    texture.offset.x = 1;
                }
                if (options.mirrorY) {
                    texture.wrapT = THREE.RepeatWrapping;
                    texture.repeat.y = -Math.abs(texture.repeat.y || 1);
                    texture.offset.y = 1;
                }
                if (options.offset) {
                    texture.offset.set(
                        options.offset.x ?? texture.offset.x,
                        options.offset.y ?? texture.offset.y
                    );
                }
                texture.needsUpdate = true;

                let applied = 0;
                matchedMeshes.forEach((child) => {
                    if (Array.isArray(child.material)) {
                        child.material.forEach((mat) => {
                            mat.map = texture;
                            mat.needsUpdate = true;
                        });
                    } else if (child.material) {
                        child.material.map = texture;
                        child.material.needsUpdate = true;
                    } else {
                        child.material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
                    }
                    applied++;
                });

                if (applied === 0) {
                    // console.debug(`Sin meshes para aplicar textura: ${imagePath}`);
                } else {
                    console.log(`🖼️ Textura aplicada (${imagePath}) a ${applied} mesh(es)`);
                }
            },
            undefined,
            (err) => {
                console.error('❌ Error cargando textura', imagePath, err);
            }
        );
    }

    async loadFromAPI() {
        try {
            const listRes = await fetch('/config/precisePhysicsModels.json');
            const precisePhysicsModels = await listRes.json();

            let blocks = [];

            try {
                const apiUrl = import.meta.env.VITE_API_URL + '/api/blocks';
                const res = await fetch(apiUrl);

                if (!res.ok) throw new Error('Conexión fallida');

                const apiBlocks = await res.json();
                blocks = this._dedupeBlocks(apiBlocks.filter(b => b.level === 1));
                console.log('Datos cargados desde la API (nivel 1):', blocks.length);
                //console.log('🧩 Lista de bloques:', blocks.map(b => b.name))
            } catch (apiError) {
                console.warn('No se pudo conectar con la API. Cargando desde archivo local...');
                const localRes = await fetch('/data/toy_car_blocks.json');
                const allBlocks = await localRes.json();

                // 🔍 Filtrar solo nivel 1
                blocks = this._dedupeBlocks(allBlocks.filter(b => b.level === 1));
                console.log(`Datos cargados desde archivo local (nivel 1): ${blocks.length}`);

            }

            this.loadedBlocks = blocks;
            this._processBlocks(blocks, precisePhysicsModels);
        } catch (err) {
            console.error('Error al cargar bloques o lista Trimesh:', err);
        }
    }

    async loadFromURL(apiUrl) {
        try {
            const listRes = await fetch('/config/precisePhysicsModels.json');
            const precisePhysicsModels = await listRes.json();

            const res = await fetch(apiUrl);
            if (!res.ok) throw new Error('Conexión fallida al cargar bloques de nivel.');

            const blocks = this._dedupeBlocks(await res.json());
            console.log(`📦 Bloques cargados (${blocks.length}) desde ${apiUrl}`);

            this.loadedBlocks = blocks;
            this._processBlocks(blocks, precisePhysicsModels);
        } catch (err) {
            console.error('Error al cargar bloques desde URL:', err);
        }
    }

    _processBlocks(blocks, precisePhysicsModels) {
        blocks = this._dedupeBlocks(blocks);

        // Patrones que SI deben tener colision fisica (superficies caminables)
        const PHYSICS_PATTERNS = [
            // Caminos lev1 (sin física - el floor los sostiene)
            // 'camino',  ← comentado intencionalmente
            // Puentes
            'puente',
            // Montañas y rocas
            'mountain', 'rock', 'bigrock', 'low_poly_cuboid_rock', 'portal_roca',
            // Árboles y troncos
            'tree', 'simple_tree', 'tronco', 'elmtree',
            // Pistas lev2
            'track', 'plane',
            // Edificios lev2
            'building', 'hangar', 'mansion', 'silo',
            // Bloques lev2
            'cube', 'coin_structure',
            // *** PAREDES DEL LABERINTO lev2 ***
            'pared_laberinto',
            'mesh1_model',
            'mesh2_model',
            'mesh3_model',
            // Agua
            'pond', 'rio', 'river', 'water',
            // Nivel 3 - Cripta/Mazmorra
            'entrada_', 'plaza_', 'corridor_', 'doors_', 'main_path', 'cartel_inicio_texto',
            'chamber_', 'chase_', 'crypt_', 'final_', 'portal_'
        ]

        // Patrones FORZADOS a tener física (obstáculos intencionales)
        const OBSTACLE_PATTERNS = [
            'obstacle_', 'collider_', 'wall_'
        ];

        // Patrones de objetos INVISIBLES (no agregar a escena ni física)
        const INVISIBLE_PATTERNS = [
            'spawn_circle', 'spawn_circle_lev1', 'helper', 'trigger',
            'spawn', 'respawn', 'patrol', 'enemy_path', 'debug', 'target'
        ]
        const DECORATION_PATTERNS = [
            'apple', 'flower', 'mushroom', 'fogata',
            'banco', 'cartel', 'chimney', 'cilinder',
            'cylinder', 'pipe', 'rocket', 'fox_inicio',
            'portal_final', 'portal_roca_0', 'portal_roca_3',
            'camino',
            'fox_mesh', 'elmtree',   // árboles decorativos del lev2
            'inicio_nivel2',
            // Nivel 3 decoraciones
            'barrel', 'crate', 'skull', 'cobweb', 'cart',
            'bricks', 'torch', 'horse', 'table', 'spikes',
            'safe_zone', 'arch', 'column', 'col_', 'bars',
            'danger_zone', 'ghost_danger', 'enemy_ghost'
        ]

        blocks.forEach(block => {
            if (!block.name) {
                console.warn('Bloque sin nombre:', block);
                return;
            }

            const nameLower = block.name.toLowerCase();
            const isInvisible = INVISIBLE_PATTERNS.some(p => nameLower.includes(p));
            if (isInvisible) {
                console.log(`Objeto invisible (no agregado a escena): ${block.name}`);
                return;
            }

            const resourceKey = block.name;
            const glb = this.resources.items[resourceKey];

            if (!glb) {
                console.warn(`Modelo no encontrado: ${resourceKey}`);
                return;
            }

            const model = glb.scene.clone();

            //  MARCAR modelo como perteneciente al nivel
            model.userData.levelObject = true;

            // Eliminar cámaras y luces embebidas
            model.traverse((child) => {
                if (child.isCamera || child.isLight) {
                    child.parent.remove(child);
                }
            });

            //  Manejo de carteles: aplicar textura a meshes
            this._applyTextureToMeshes(
                model,
                '/textures/ima1.jpg',
                (child) => child.name === 'Cylinder001' || (child.name && child.name.toLowerCase().includes('cylinder')),
                { rotation: -Math.PI / 2, center: { x: 0.5, y: 0.5 }, mirrorX: true }
            );

            //  Integración especial para modelos baked
            if (block.name.includes('baked')) {
                const bakedTexture = new THREE.TextureLoader().load('/textures/baked.jpg');
                bakedTexture.flipY = false;
                if ('colorSpace' in bakedTexture) {
                    bakedTexture.colorSpace = THREE.SRGBColorSpace;
                } else {
                    bakedTexture.encoding = THREE.sRGBEncoding;
                }

                model.traverse(child => {
                    if (child.isMesh) {
                        child.material = new THREE.MeshBasicMaterial({ map: bakedTexture });
                        child.material.needsUpdate = true;

                        if (child.name.toLowerCase().includes('portal')) {
                            this.experience.time.on('tick', () => {
                                child.rotation.y += 0.01;
                            });
                        }
                    }
                });
            }

            //  Si es un premio (coin)
            const isCollectibleCoin = nameLower.startsWith('coin_') && !nameLower.includes('coin_structure');
            if (isCollectibleCoin) {
                const prize = new Prize({
                    model,
                    position: new THREE.Vector3(block.x, block.y, block.z),
                    scene: this.scene,
                    role: block.role || "default"
                });

                // Marcar modelo del premio
                prize.model.userData.levelObject = true;

                this.prizes.push(prize);
                return;
            }

            // Agregar modelo visualmente a la escena
            this.scene.add(model);

            // Determinar si este objeto debe tener fisica
            const hasPhysicsPattern = PHYSICS_PATTERNS.some(p => nameLower.includes(p))
            const isObstacleForced = OBSTACLE_PATTERNS.some(p => nameLower.startsWith(p))
            const isDecoration = DECORATION_PATTERNS.some(p => nameLower.includes(p))
            const isPrecise = Array.isArray(precisePhysicsModels) && precisePhysicsModels.includes(block.name);
            const shouldHavePhysics = isPrecise || ((hasPhysicsPattern || isObstacleForced) && !isDecoration)
            const isWaterSurface = ['rio', 'river', 'water', 'agua', 'pond'].some(p => nameLower.includes(p));

            if (!shouldHavePhysics) {
                // Decoracion: solo visual, sin CANNON.Body
                return;
            }

            // Calcular bounding box real del modelo
            const bbox = new THREE.Box3().setFromObject(model);
            const center = new THREE.Vector3();
            const size = new THREE.Vector3();
            bbox.getCenter(center);
            bbox.getSize(size);

            // Box collider alineado al bounding box
            let halfX = Math.max(size.x / 2, 0.01);
            let halfY = Math.max(size.y / 2, 0.01);
            let halfZ = Math.max(size.z / 2, 0.01);
            const bodyCenter = center.clone();

            // Los arboles tienen copa muy ancha. Si usamos todo el bounding box,
            // el jugador queda flotando o choca con hojas invisibles.
            // Árbol — solo el tronco, ignorar copa
            if (nameLower.includes('tree') || nameLower.includes('arbol')) {
                halfX = Math.max(Math.min(size.x * 0.12, 0.7), 0.25)
                halfZ = Math.max(Math.min(size.z * 0.12, 0.7), 0.25)
                halfY = Math.max(Math.min(size.y * 0.35, 2.5), 0.8)
                bodyCenter.y = center.y - size.y * 0.22
            }

            // Camino — colisionador muy delgado para que la Sphere ruede encima sin trabarse
            if (nameLower.includes('camino') || nameLower.includes('main_path')) {
                halfY = 0.04                        // casi plano
                bodyCenter.y = block.y + 0.04      // al ras del suelo
            }

            // Tronco — altura completa para OBLIGAR a saltar
            if (nameLower.includes('tronco')) {
                halfX = Math.max(size.x / 2, 0.3)
                halfY = Math.max(size.y / 2, 0.25)
                halfZ = Math.max(size.z / 2, 0.3)
                bodyCenter.y = center.y
            }

            if (isWaterSurface) {
                halfY = 0.03;
                bodyCenter.y = block.y - 0.03;
            }

            let shape;
            let finalBodyPos = new CANNON.Vec3(bodyCenter.x, bodyCenter.y, bodyCenter.z);

            if (isPrecise) {
                shape = createTrimeshShapeFromModel(model);
                if (shape) {
                    // Los vértices del Trimesh ya están en coordenadas de mundo, 
                    // así que el cuerpo debe estar en el origen (0,0,0)
                    finalBodyPos = new CANNON.Vec3(0, 0, 0);
                }
            }

            if (!shape) {
                shape = new CANNON.Box(new CANNON.Vec3(halfX, halfY, halfZ));
            }

            const body = new CANNON.Body({
                mass: 0,
                type: CANNON.Body.STATIC,
                shape: shape,
                position: finalBodyPos,
                material: isWaterSurface ? this.physics.defaultMaterial : this.physics.obstacleMaterial,
                linearDamping: 0.9,
                angularDamping: 1.0
            });

            body.velocity.setZero();
            body.angularVelocity.setZero();
            body.fixedRotation = true;
            body.updateMassProperties()
            // Marcar cuerpo fisico
            body.userData = { levelObject: true };
            model.userData.physicsBody = body;
            body.userData.linkedModel = model;
            this.physics.world.addBody(body);
        });
    }

    _dedupeBlocks(blocks) {
        const byName = new Map();

        blocks.forEach((block) => {
            if (!block?.name) return;

            const key = `${block.level || 1}:${block.name.toLowerCase()}`;
            const current = byName.get(key);

            if (!current) {
                byName.set(key, block);
                return;
            }

            if (block.role === 'finalPrize' && current.role !== 'finalPrize') {
                byName.set(key, { ...current, ...block, role: 'finalPrize' });
            }
        });

        return Array.from(byName.values());
    }

}
