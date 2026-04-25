// Node.js script -- Sincroniza bloques y monedas por nivel
// Uso: node scripts/sync_blocks.js <nivel>
// Ejemplo: node scripts/sync_blocks.js 1

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const fs = require('fs');

// Patch para usar fetch en CommonJS con node-fetch
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// Recibir nivel como argumento
const level = process.argv[2];

if (!level) {
    console.error('Uso: node scripts/sync_blocks.js <nivel>');
    console.error('  Ejemplo: node scripts/sync_blocks.js 1');
    process.exit(1);
}

// Leer URL desde .env
const API_URL = process.env.API_URL;

if (!API_URL) {
    console.error('ERROR: No se encontro API_URL en .env');
    process.exit(1);
}

// Archivos a sincronizar (dinamicos por nivel)
const possibleFiles = [
    `toy_car_blocks${level}.json`,
    `coin${level}.json`
];

// Funcion para enviar datos
async function sendJSON(fileName) {
    const jsonPath = path.join(__dirname, '../data', fileName);

    // Verificar que el archivo existe antes de enviarlo
    if (!fs.existsSync(jsonPath)) {
        console.warn(`Archivo no encontrado, ignorado: ${fileName}`);
        return;
    }

    const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(jsonData),
        });

        const data = await res.json();
        console.log(`${fileName} sincronizado correctamente:`, data);
    } catch (err) {
        console.error(`Error al sincronizar ${fileName}:`, err.message);
    }
}

// Enviar cada archivo que exista
(async () => {
    for (const file of possibleFiles) {
        await sendJSON(file);
    }
})();
