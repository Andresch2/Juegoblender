import * as CANNON from 'cannon-es'

export default class Physics {
    constructor() {
        this.world = new CANNON.World()
        this.world.gravity.set(0, -9.82, 0)
        this.world.broadphase = new CANNON.SAPBroadphase(this.world)
        this.world.allowSleep = true

        // Más iteraciones = colisiones más precisas, menos atravesar objetos
        this.world.solver.iterations = 20
        this.world.solver.tolerance = 0.0001

        // Material base para todo lo que no tenga material propio
        this.defaultMaterial = new CANNON.Material('default')
        const defaultContact = new CANNON.ContactMaterial(
            this.defaultMaterial,
            this.defaultMaterial,
            {
                friction: 0.5,
                restitution: 0.0   // sin rebote
            }
        )
        this.world.defaultContactMaterial = defaultContact
        this.world.addContactMaterial(defaultContact)

        // Material del jugador
        this.robotMaterial = new CANNON.Material('robot')

        // Material de obstáculos/plataformas
        this.obstacleMaterial = new CANNON.Material('obstacle')

        // Material de paredes
        this.wallMaterial = new CANNON.Material('wall')

        // Robot vs Obstáculo — sin rebote, fricción media
        const robotObstacleContact = new CANNON.ContactMaterial(
            this.robotMaterial,
            this.obstacleMaterial,
            {
                friction: 0.5,
                restitution: 0.0,               // SIN rebote
                contactEquationStiffness: 1e6,  // Bajado de 1e8 → evita el lanzamiento
                contactEquationRelaxation: 5,   // Subido → absorbe el impacto
                frictionEquationStiffness: 1e6,
                frictionEquationRelaxation: 5
            }
        )
        this.world.addContactMaterial(robotObstacleContact)

        // Robot vs Pared — sin rebote, mucho agarre
        const robotWallContact = new CANNON.ContactMaterial(
            this.robotMaterial,
            this.wallMaterial,
            {
                friction: 0.7,
                restitution: 0.0,               // SIN rebote
                contactEquationStiffness: 1e6,
                contactEquationRelaxation: 5,
                frictionEquationStiffness: 1e6,
                frictionEquationRelaxation: 5
            }
        )
        this.world.addContactMaterial(robotWallContact)
    }

    update(delta) {
        // Limpiar cuerpos corruptos
        this.world.bodies = this.world.bodies.filter(body => {
            if (!body || !Array.isArray(body.shapes) || body.shapes.length === 0) return false
            for (const shape of body.shapes) {
                if (!shape || !shape.body || shape.body !== body) return false
            }
            return true
        })

        // Paso fijo con máximo 3 substeps — evita explosión física en frames lentos
        try {
            this.world.step(1 / 60, delta, 3)
        } catch (err) {
            if (err?.message?.includes('wakeUpAfterNarrowphase')) {
                console.warn('⚠️ Cannon shape corrupto ignorado.')
            } else {
                console.error('🚫 Cannon step error:', err)
            }
        }
    }
}