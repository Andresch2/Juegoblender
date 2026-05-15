import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { createTrimeshShapeFromModel } from '../Experience/Utils/PhysicsShapeFactory.js';
import Prize from '../Experience/World/Prize.js';

export default class ToyCarLoader {
    constructor(experience) {
        this.experience = experience;
        this.scene = this.experience.scene;
        this.resources = this.experience.resources;
        this.physics = this.experience.physics;
        this.prizes = [];
        this.hazards = [];
        this.loadedBlocks = [];
        this.missingModels = new Set();
    }

    getSignTexturePath(blockName) {
        const signTextures = {
            cartel_bosque_tabla_lev1: '/textures/signs/bosque.png',
            cartel_ghost_tabla_001_lev3: '/textures/signs/ruinas.png',
            cartel_ghost_tabla_lev3: '/textures/signs/ruinasghost.png',
            cartel_espacio_tabla_lev4: '/textures/signs/espacio.png',
            cartel_lava_tabla_lev4: '/textures/signs/espaciolava.png'
        };

        return signTextures[blockName] || null;
    }

    addSignImagePlane(model, imagePath) {
        const bbox = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        bbox.getSize(size);
        bbox.getCenter(center);

        const isSideFacingSign = size.z > size.x;
        const width = Math.max((isSideFacingSign ? size.z : size.x) * 0.92, 0.1);
        const height = Math.max(size.y * 0.92, 0.1);
        const texture = new THREE.TextureLoader().load(imagePath);

        if ('colorSpace' in texture) {
            texture.colorSpace = THREE.SRGBColorSpace;
        } else {
            texture.encoding = THREE.sRGBEncoding;
        }

        texture.flipY = true;

        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
        plane.name = 'sign_image_overlay';
        if (isSideFacingSign) {
            plane.rotation.y = -Math.PI / 2;
            plane.position.set(bbox.min.x - 0.03, center.y, center.z);
        } else {
            plane.position.set(center.x, center.y, bbox.max.z + 0.03);
        }
        plane.userData.levelObject = true;

        model.add(plane);
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

    _publicPath(path) {
        const base = import.meta.env.BASE_URL || '/';
        return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
    }

    async _fetchJson(url, label) {
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`${label} no disponible (HTTP ${res.status})`);
        }

        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            const preview = (await res.text()).slice(0, 120);
            throw new Error(`${label} no devolvio JSON: ${preview}`);
        }

        return res.json();
    }

    async _loadPrecisePhysicsModels(level = 1) {
        const levelUrl = this._publicPath(`config/precisePhysicsModels${level}.json`);
        const generalUrl = this._publicPath('config/precisePhysicsModels.json');

        try {
            return await this._fetchJson(levelUrl, `Fisicas precisas nivel ${level}`);
        } catch (levelError) {
            console.warn(`No se encontro fisica precisa del nivel ${level}. Usando lista general...`);
            return await this._fetchJson(generalUrl, 'Fisicas precisas generales');
        }
    }

    async _loadLocalBlocks(level = 1) {
        const levelUrl = this._publicPath(`data/toy_car_blocks${level}.json`);
        const combinedUrl = this._publicPath('data/toy_car_blocks.json');

        try {
            const allBlocks = await this._fetchJson(combinedUrl, 'Bloques locales combinados');
            return this._dedupeBlocks(allBlocks.filter(block => block.level === level));
        } catch (combinedError) {
            console.warn(`No se encontro data local combinada para nivel ${level}. Usando archivo separado...`);
            const levelBlocks = await this._fetchJson(levelUrl, `Bloques locales nivel ${level}`);
            return this._dedupeBlocks(levelBlocks.filter(block => block.level === level));
        }
    }

    async _loadApiBlocks(level = 1) {
        const backendUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
        const apiUrl = `${backendUrl}/api/blocks?level=${level}`;
        const apiData = await this._fetchJson(apiUrl, `API nivel ${level}`);
        const apiBlocks = Array.isArray(apiData) ? apiData : (apiData.blocks || []);
        return this._dedupeBlocks(apiBlocks.filter(block => block.level === level));
    }

    async loadFromAPI(level = 1) {
        try {
            const precisePhysicsModels = await this._loadPrecisePhysicsModels(level);

            let blocks = [];

            try {
                const backendUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
                const apiUrl = `${backendUrl}/api/blocks?level=${level}`;
                const res = await fetch(apiUrl);

                if (!res.ok) throw new Error('Conexión fallida');

                const apiData = await res.json();
                const apiBlocks = Array.isArray(apiData) ? apiData : (apiData.blocks || []);
                blocks = this._dedupeBlocks(apiBlocks.filter(b => b.level === level));
                if (blocks.length === 0) throw new Error(`API sin bloques para nivel ${level}`);
                console.log(`Datos cargados desde la API (nivel ${level}):`, blocks.length);
                //console.log('🧩 Lista de bloques:', blocks.map(b => b.name))
            } catch (apiError) {
                console.warn(`No se pudo conectar con la API. Cargando nivel ${level} desde public/data/toy_car_blocks.json...`);
                const allBlocks = await this._fetchJson(this._publicPath('data/toy_car_blocks.json'), 'Bloques locales combinados');

                // Filtrar el nivel solicitado desde el JSON combinado.
                blocks = this._dedupeBlocks(allBlocks.filter(b => b.level === level));
                if (blocks.length === 0) throw new Error(`Archivo local sin bloques para nivel ${level}`);
                console.log(`Datos cargados desde archivo local (nivel ${level}): ${blocks.length}`);

            }

            this.loadedBlocks = blocks;
            await this._processBlocks(blocks, precisePhysicsModels);
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
            await this._processBlocks(blocks, precisePhysicsModels);
        } catch (err) {
            console.error('Error al cargar bloques desde URL:', err);
        }
    }

    async _getResourceForBlock(block) {
        const resourceKey = block.name;
        let glb = this.resources.items[resourceKey];

        if (glb) return glb;

        const source = this.resources.sources?.find((item) => item.name === resourceKey);
        const fallbackPath = `/models/toycar${block.level}/${resourceKey}.glb`;
        const modelPath = source?.path || fallbackPath;

        try {
            glb = await this.resources.loaders.gltfLoader.loadAsync(modelPath);
            this.resources.items[resourceKey] = glb;
            console.info(`Modelo cargado bajo demanda: ${resourceKey}`);
            return glb;
        } catch (error) {
            if (!this.missingModels.has(resourceKey)) {
                this.missingModels.add(resourceKey);
                console.warn(`Modelo no encontrado: ${resourceKey}`, error);
            }
            return null;
        }
    }

    async _processBlocks(blocks, precisePhysicsModels) {
        blocks = this._dedupeBlocks(blocks);
        this.hazards = [];

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
            'chamber_', 'chase_', 'crypt_', 'final_', 'portal_',
            // Nivel 4 - Espacial
            'formation_rock', 'asteroids_mesh', 'connector', 'metalsupport',
            'spaceship', 'building', 'house_', 'lv1_', 'lv2_', 'lv3_', 'lv4_', 'crt_',
            // Nivel 5 - Ciudad final
            'road', 'street', 'sidewalk', 'platform', 'bridge', 'wall_', 'bar_', 'barrier',
            'fence', 'portal_base', 'portal_aro', 'tower', 'city', 'stairs', 'step'
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
            'danger_zone', 'ghost_danger', 'enemy_ghost',
            // Nivel 4 decoraciones
            'grass', 'pickup', 'antenna', 'radar', 'solarpanel',
            'wheel', 'rover', 'astronaut', 'tree_floating', 'tree_lava',
            // Nivel 5 decoraciones
            'lamp', 'sign', 'poster', 'trash', 'deco'
        ]

        for (const block of blocks) {
            if (!block.name) {
                console.warn('Bloque sin nombre:', block);
                continue;
            }

            const nameLower = block.name.toLowerCase();
            const isInvisible = INVISIBLE_PATTERNS.some(p => nameLower.includes(p));
            const isDamageHazard = /^lv\d+_b_lev4$/.test(nameLower);
            if (isInvisible) {
                console.log(`Objeto invisible (no agregado a escena): ${block.name}`);
                continue;
            }

            const glb = await this._getResourceForBlock(block);

            if (!glb) {
                continue;
            }

            const model = glb.scene.clone();

            //  MARCAR modelo como perteneciente al nivel
            model.userData.levelObject = true;

            const signTexturePath = this.getSignTexturePath(block.name);
            if (signTexturePath) {
                this.addSignImagePlane(model, signTexturePath);
            }

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
                continue;
            }

            // Agregar modelo visualmente a la escena
            this.scene.add(model);
            if (nameLower.includes('spikes') || isDamageHazard) {
                model.userData.hazard = true;
                model.userData.hazardMode = isDamageHazard ? 'damage' : 'death';
                model.userData.hazardDamage = isDamageHazard ? 0.5 : 999;
                model.userData.hazardName = block.name;
                this.hazards.push(model);
            }

            // Determinar si este objeto debe tener fisica
            const hasPhysicsPattern = PHYSICS_PATTERNS.some(p => nameLower.includes(p))
            const isObstacleForced = OBSTACLE_PATTERNS.some(p => nameLower.startsWith(p))
            const isDecoration = DECORATION_PATTERNS.some(p => nameLower.includes(p))
            const isPrecise = Array.isArray(precisePhysicsModels) && precisePhysicsModels.includes(block.name);
            const shouldHavePhysics = !isDamageHazard && (isPrecise || ((hasPhysicsPattern || isObstacleForced) && !isDecoration))
            const isWaterSurface = ['rio', 'river', 'water', 'agua', 'pond'].some(p => nameLower.includes(p));

            if (!shouldHavePhysics) {
                // Decoracion: solo visual, sin CANNON.Body
                continue;
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
        }
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
