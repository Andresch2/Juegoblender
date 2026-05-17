import * as CANNON from 'cannon-es'

export default class Physics {
    constructor() {
        this.world = new CANNON.World()
        this.world.gravity.set(0, -9.82, 0)
        this.world.broadphase = new CANNON.SAPBroadphase(this.world)
        this.world.allowSleep = true

        this.world.solver.iterations = 20
        this.world.solver.tolerance = 0.0001

        this.defaultMaterial = new CANNON.Material('default')
        const defaultContact = new CANNON.ContactMaterial(
            this.defaultMaterial,
            this.defaultMaterial,
            {
                friction: 0.45,
                restitution: 0
            }
        )
        this.world.defaultContactMaterial = defaultContact
        this.world.addContactMaterial(defaultContact)

        this.robotMaterial = new CANNON.Material('robot')
        this.obstacleMaterial = new CANNON.Material('obstacle')
        this.wallMaterial = new CANNON.Material('wall')

        const robotObstacleContact = new CANNON.ContactMaterial(
            this.robotMaterial,
            this.obstacleMaterial,
            {
                friction: 0.12,
                restitution: 0,
                contactEquationStiffness: 8e4,
                contactEquationRelaxation: 14,
                frictionEquationStiffness: 8e4,
                frictionEquationRelaxation: 14
            }
        )
        this.world.addContactMaterial(robotObstacleContact)

        const robotWallContact = new CANNON.ContactMaterial(
            this.robotMaterial,
            this.wallMaterial,
            {
                friction: 0.18,
                restitution: 0,
                contactEquationStiffness: 8e4,
                contactEquationRelaxation: 14,
                frictionEquationStiffness: 8e4,
                frictionEquationRelaxation: 14
            }
        )
        this.world.addContactMaterial(robotWallContact)
    }

    update(delta) {
        this.world.bodies = this.world.bodies.filter(body => {
            if (!body || !Array.isArray(body.shapes) || body.shapes.length === 0) return false
            for (const shape of body.shapes) {
                if (!shape || !shape.body || shape.body !== body) return false
            }
            return true
        })

        try {
            this.world.step(1 / 60, delta, 3)
        } catch (err) {
            if (err?.message?.includes('wakeUpAfterNarrowphase')) {
                console.warn('Cannon shape corrupto ignorado.')
            } else {
                console.error('Cannon step error:', err)
            }
        }
    }
}
