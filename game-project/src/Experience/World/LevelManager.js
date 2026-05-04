// Spawn configurable por nivel (provisional, ajustar coordenadas según mapa)
const LEVEL_SPAWNS = {
    1: { x: 0, y: 2, z: 0 },
    2: { x: -59.408, y: 59.24, z: 0.957543 },
    3: { x: 0, y: 2, z: 0 },
    4: { x: 0, y: 2, z: 0 },
    5: { x: 0, y: 2, z: 0 }
};

const DEFAULT_SPAWN = { x: 0, y: 2, z: 0 };

export default class LevelManager {
    constructor(experience) {
        this.experience = experience;
        this.currentLevel = 1;  // Inicias en el nivel 1
        this.totalLevels = 5;   // Total de niveles (5 según guía)

        this.dynamicSpawns = {}; // Guarda spawns leídos desde JSON

        // Puntos necesarios para completar cada nivel (dinámico desde BD si existe)
        this.pointsToComplete = {
            1: 2,
            2: 2,
            3: 3,
            4: 3,
            5: 5
        };
    }

    /**
     * Retorna la posición de spawn para un nivel dado.
     * Si el JSON trae player_spawn, se usará ese; si no, se usa LEVEL_SPAWNS.
     */
    getSpawnPoint(level) {
        return this.dynamicSpawns[level] || LEVEL_SPAWNS[level] || DEFAULT_SPAWN;
    }

    /**
     * Establece el spawn dinámico leído del nivel.
     */
    setSpawnPoint(level, spawn) {
        this.dynamicSpawns[level] = spawn;
    }

    nextLevel() {
        if (this.currentLevel < this.totalLevels) {
            this.currentLevel++;

            this.experience.world.clearCurrentScene();
            this.experience.world.loadLevel(this.currentLevel);

            // Espera breve para que el nivel se cargue y luego reubicar al robot
            setTimeout(() => {
                const spawn = this.getSpawnPoint(this.currentLevel);
                this.experience.world.resetRobotPosition(spawn);
            }, 1000)
        }
    }

    resetLevel() {
        this.currentLevel = 1;
        this.experience.world.loadLevel(this.currentLevel);
    }


    getCurrentLevelTargetPoints() {
        return this.pointsToComplete?.[this.currentLevel] || 2;
    }

}
