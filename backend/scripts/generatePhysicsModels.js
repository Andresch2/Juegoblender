// Node.js script -- Genera precisePhysicsModels por nivel
// Uso: node scripts/generatePhysicsModels.js <nivel>
// Ejemplo: node scripts/generatePhysicsModels.js 1

const fs = require('fs')
const path = require('path')

// Recibir nivel como argumento
const level = process.argv[2]

if (!level) {
    console.error('Uso: node scripts/generatePhysicsModels.js <nivel>')
    console.error('  Ejemplo: node scripts/generatePhysicsModels.js 1')
    process.exit(1)
}

// Ruta de entrada y salida dinamicas
const inputPath = path.join(__dirname, `../data/toy_car_blocks${level}.json`)
const outputPath = path.join(__dirname, `../data/precisePhysicsModels${level}.json`)

// Validar que el archivo de entrada existe
if (!fs.existsSync(inputPath)) {
    console.error(`Archivo no encontrado: ${inputPath}`)
    process.exit(1)
}

// Leer archivo JSON original
fs.readFile(inputPath, 'utf8', (err, data) => {
    if (err) {
        console.error(`Error leyendo toy_car_blocks${level}.json:`, err)
        return
    }

    try {
        const blocks = JSON.parse(data)

        // Patrones que SÍ deben tener colisión física (superficies caminables)
        const PHYSICS_PATTERNS = [
            'plat', 'platform', 'plataforma', 'puente', 'bridge', 
            'plane', 'track', 'floor', 'ramp', 'stair', 'step'
        ];

        // Patrones FORZADOS a tener física (obstáculos intencionales)
        const OBSTACLE_PATTERNS = [
            'obstacle_', 'collider_', 'wall_'
        ];

        // Filtrar nombres de bloques
        const trackNames = blocks
            .filter(block => {
                if (!block.name) return false;
                const nameLower = block.name.toLowerCase();
                const hasPhysicsPattern = PHYSICS_PATTERNS.some(p => nameLower.includes(p));
                const isObstacleForced = OBSTACLE_PATTERNS.some(p => nameLower.startsWith(p));
                return hasPhysicsPattern || isObstacleForced;
            })
            .map(block => block.name)

        // Eliminar duplicados
        const uniqueTrackNames = [...new Set(trackNames)]

        // Guardar nuevo archivo
        fs.writeFile(
            outputPath,
            JSON.stringify(uniqueTrackNames, null, 4),
            'utf8',
            (err) => {
                if (err) {
                    console.error(`Error al escribir precisePhysicsModels${level}.json:`, err)
                    return
                }
                console.log(`precisePhysicsModels${level}.json creado con ${uniqueTrackNames.length} entradas.`)
            }
        )

    } catch (parseErr) {
        console.error(`Error al parsear toy_car_blocks${level}.json:`, parseErr)
    }
})
