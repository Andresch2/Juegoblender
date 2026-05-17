import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import EventEmitter from './EventEmitter.js'

export default class Resources extends EventEmitter {
    constructor(sources) {
        super()

        this.sources = sources
        // En produccion no conviene precargar todos los GLB de los 5 niveles.
        // Solo se cargan los recursos base; los modelos de cada nivel se piden
        // bajo demanda desde ToyCarLoader cuando se entra al nivel.
        const initialResourceNames = new Set([
            'environmentMapTexture',
            'grassColorTexture',
            'grassNormalTexture',
            'foxModel',
            'playerModel',
            'ghostskull',
            'enemyLarge',
            'zombieModel'
        ])
        this.preloadSources = this.sources.filter(source => initialResourceNames.has(source.name))
        this.items = {}
        this.errors = []
        this.toLoad = this.preloadSources.length
        this.loaded = 0
        this.queue = [...this.preloadSources]
        this.activeLoads = 0
        this.maxConcurrentLoads = 12

        this.setLoaders()
        this.startLoading()
    }

    setLoaders() {
        this.loaders = {}
        this.loaders.gltfLoader = new GLTFLoader()
        this.loaders.textureLoader = new THREE.TextureLoader()
        this.loaders.cubeTextureLoader = new THREE.CubeTextureLoader()
    }

    startLoading() {
        if (this.toLoad === 0) {
            window.dispatchEvent(new CustomEvent('resource-complete'))
            this.trigger('ready')
            return
        }

        this.loadNextBatch()
    }

    loadNextBatch() {
        while (this.activeLoads < this.maxConcurrentLoads && this.queue.length > 0) {
            const source = this.queue.shift()
            this.activeLoads++
            this.loadSource(source)
        }
    }

    loadSource(source) {
        const onLoad = (file) => this.sourceLoaded(source, file)
        const onError = (error) => this.sourceFailed(source, error)

        if (source.type === 'gltfModel') {
            this.loaders.gltfLoader.load(source.path, onLoad, undefined, onError)
        } else if (source.type === 'texture') {
            this.loaders.textureLoader.load(source.path, onLoad, undefined, onError)
        } else if (source.type === 'cubeTexture') {
            this.loaders.cubeTextureLoader.load(source.path, onLoad, undefined, onError)
        } else {
            onError(new Error(`Tipo de recurso no soportado: ${source.type}`))
        }
    }

    sourceLoaded(source, file) {
        this.items[source.name] = file
        this.finishSource()
    }

    sourceFailed(source, error) {
        this.errors.push({ source, error })
        console.error(`Error al cargar recurso ${source.name} desde ${source.path}`, error)
        window.dispatchEvent(new CustomEvent('resource-error', { detail: { source, error } }))
        this.finishSource()
    }

    finishSource() {
        this.loaded++
        this.activeLoads = Math.max(0, this.activeLoads - 1)

        const percent = Math.floor((this.loaded / this.toLoad) * 100)
        window.dispatchEvent(new CustomEvent('resource-progress', { detail: percent }))

        if (this.loaded === this.toLoad) {
            if (this.errors.length > 0) {
                console.warn(`Recursos cargados con ${this.errors.length} error(es). El juego continuara sin esos assets.`)
            }

            window.dispatchEvent(new CustomEvent('resource-complete'))
            this.trigger('ready')
        } else {
            this.loadNextBatch()
        }
    }
}
