// Spawn configurable por nivel. Si el JSON trae spawn, se usa ese valor.
const LEVEL_SPAWNS = {
    1: { x: 0, y: 2, z: 0 },
    2: { x: -59.408, y: 59.24, z: 0.957543 },
    3: { x: -90.98, y: 2, z: 34.34 },
    4: { x: -18, y: 2, z: 28 },
    5: { x: -72, y: 2, z: 0 }
};

const DEFAULT_SPAWN = { x: 0, y: 2, z: 0 };

export default class LevelManager {
    constructor(experience) {
        this.experience = experience;
        this.currentLevel = 1;
        this.totalLevels = 5;
        this.dynamicSpawns = {};

        this.pointsToComplete = {
            1: 2,
            2: 2,
            3: 3,
            4: 5,
            5: 5
        };
    }

    getSpawnPoint(level) {
        return this.dynamicSpawns[level] || LEVEL_SPAWNS[level] || DEFAULT_SPAWN;
    }

    setSpawnPoint(level, spawn) {
        this.dynamicSpawns[level] = spawn;
    }

    async goToLevel(level) {
        const targetLevel = Number(level);

        if (!Number.isInteger(targetLevel)) {
            console.warn('[LEVEL] Usa un numero entero. Ejemplo: goToLevel(2)');
            return false;
        }

        if (targetLevel < 1 || targetLevel > this.totalLevels) {
            console.warn(`[LEVEL] Nivel invalido: ${targetLevel}. Usa un nivel entre 1 y ${this.totalLevels}.`);
            return false;
        }

        if (!this.experience.world?.loader || !this.experience.world?.robot) {
            console.warn('[LEVEL] El mundo aun no termina de cargar. Intenta de nuevo cuando desaparezca el loader.');
            return false;
        }

        if (this.isChangingLevel) {
            console.warn('[LEVEL] Ya hay un cambio de nivel en curso.');
            return false;
        }

        const hasLevelData = await this.hasLevelData(targetLevel);
        if (!hasLevelData) {
            console.warn(`[LEVEL] El nivel ${targetLevel} aun no tiene datos exportados.`);
            return false;
        }

        this.isChangingLevel = true;

        try {
            console.log(`[LEVEL] Cambiando al nivel ${targetLevel}...`);
            this.currentLevel = targetLevel;
            this.experience.world.clearCurrentScene();
            await this.experience.world.loadLevel(targetLevel);

            const spawn = this.getSpawnPoint(targetLevel);
            this.experience.world.resetRobotPosition(spawn);
            console.log(`[LEVEL] Nivel ${targetLevel} listo.`, spawn);
            return true;
        } catch (error) {
            console.error(`[LEVEL] Error cambiando al nivel ${targetLevel}:`, error);
            return false;
        } finally {
            this.isChangingLevel = false;
        }
    }

    nextLevel() {
        if (this.currentLevel < this.totalLevels) {
            return this.goToLevel(this.currentLevel + 1);
        }

        console.warn('[LEVEL] Ya estas en el ultimo nivel.');
        return false;
    }

    resetLevel() {
        return this.goToLevel(1);
    }

    async hasLevelData(level) {
        if (level <= 4) return true;

        try {
            const res = await fetch(`/data/toy_car_blocks${level}.json`, { method: 'HEAD' });
            return res.ok;
        } catch (error) {
            return false;
        }
    }

    getCurrentLevelTargetPoints() {
        return this.pointsToComplete?.[this.currentLevel] || 2;
    }
}
