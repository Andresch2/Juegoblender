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

                blocks = await res.json();
                console.log('Datos cargados desde la API:', blocks.length);
                //console.log('🧩 Lista de bloques:', blocks.map(b => b.name))
            } catch (apiError) {
                console.warn('No se pudo conectar con la API. Cargando desde archivo local...');
                const localRes = await fetch('/data/toy_car_blocks.json');
                const allBlocks = await localRes.json();

                // 🔍 Filtrar solo nivel 1
                blocks = allBlocks.filter(b => b.level === 1);
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

            const blocks = await res.json();
            console.log(`📦 Bloques cargados (${blocks.length}) desde ${apiUrl}`);

            this.loadedBlocks = blocks;
            this._processBlocks(blocks, precisePhysicsModels);
        } catch (err) {
            console.error('Error al cargar bloques desde URL:', err);
        }
    }

    _processBlocks(blocks, precisePhysicsModels) {
        // Patrones que SI deben tener colision fisica (superficies caminables)
        const PHYSICS_PATTERNS = [
            'plat', 'platform', 'plataforma', 'puente', 'bridge',
            'plane', 'track', 'floor', 'ramp', 'stair', 'step'
        ];

        // Patrones FORZADOS a tener física (obstáculos intencionales)
        const OBSTACLE_PATTERNS = [
            'obstacle_', 'collider_', 'wall_'
        ];

        // Patrones de objetos INVISIBLES (no agregar a escena ni física)
        const INVISIBLE_PATTERNS = [
            'helper', 'trigger', 'spawn', 'respawn', 
            'patrol', 'debug', 'target', 'spawn_circle_lev1'
        ];

        blocks.forEach(block => {
            if (!block.name) {
                console.warn('Bloque sin nombre:', block);
                return;
            }

            const resourceKey = block.name;
            const glb = this.resources.items[resourceKey];

            if (!glb) {
                console.warn(`Modelo no encontrado: ${resourceKey}`);
                return;
            }

            const model = glb.scene.clone();
            const nameLower = block.name.toLowerCase();

            //  MARCAR modelo como perteneciente al nivel
            model.userData.levelObject = true;

            // Eliminar cámaras y luces embebidas
            model.traverse((child) => {
                if (child.isCamera || child.isLight) {
                    child.parent.remove(child);
                }
            });

            // Objetos invisibles: NO agregar a la escena
            const isInvisible = INVISIBLE_PATTERNS.some(p => nameLower.includes(p));
            if (isInvisible) {
                console.log(`Objeto invisible (no agregado a escena): ${block.name}`);
                return;
            }

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
            if (block.name.startsWith('coin')) {
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
            const hasPhysicsPattern = PHYSICS_PATTERNS.some(p => nameLower.includes(p));
            const isObstacleForced = OBSTACLE_PATTERNS.some(p => nameLower.startsWith(p));
            const shouldHavePhysics = hasPhysicsPattern || isObstacleForced;

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
            const halfX = Math.max(size.x / 2, 0.01);
            const halfY = Math.max(size.y / 2, 0.01);
            const halfZ = Math.max(size.z / 2, 0.01);

            const shape = new CANNON.Box(new CANNON.Vec3(halfX, halfY, halfZ));

            const body = new CANNON.Body({
                mass: 0,
                type: CANNON.Body.STATIC,
                shape: shape,
                position: new CANNON.Vec3(center.x, center.y, center.z),
                material: this.physics.obstacleMaterial
            });

            body.velocity.setZero();
            body.angularVelocity.setZero();
            body.fixedRotation = true;

            // Marcar cuerpo fisico
            body.userData = { levelObject: true };
            model.userData.physicsBody = body;
            body.userData.linkedModel = model;
            this.physics.world.addBody(body);
        });
    }

}
