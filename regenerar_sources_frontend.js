const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = __dirname;

const modelsDir = path.join(
  PROJECT_ROOT,
  'game-project',
  'public',
  'models',
  'toycar'
);

const outputPath = path.join(
  PROJECT_ROOT,
  'game-project',
  'src',
  'Experience',
  'sources.js'
);

if (!fs.existsSync(modelsDir)) {
  console.error('No existe la carpeta de modelos:', modelsDir);
  process.exit(1);
}

const baseSources = [
  {
    name: 'environmentMapTexture',
    type: 'cubeTexture',
    path: [
      '/textures/environmentMap/px.jpg',
      '/textures/environmentMap/nx.jpg',
      '/textures/environmentMap/py.jpg',
      '/textures/environmentMap/ny.jpg',
      '/textures/environmentMap/pz.jpg',
      '/textures/environmentMap/nz.jpg'
    ]
  },
  {
    name: 'grassColorTexture',
    type: 'texture',
    path: '/textures/dirt/color.jpg'
  },
  {
    name: 'grassNormalTexture',
    type: 'texture',
    path: '/textures/dirt/normal.jpg'
  },
  {
    name: 'foxModel',
    type: 'gltfModel',
    path: '/models/Fox/glTF/Fox.gltf'
  },
  {
    name: 'robotModel',
    type: 'gltfModel',
    path: '/models/Robot/Robot.glb'
  }
];

const glbSources = fs
  .readdirSync(modelsDir)
  .filter(file => file.toLowerCase().endsWith('.glb'))
  .sort((a, b) => a.localeCompare(b))
  .map(file => ({
    name: path.basename(file, '.glb').toLowerCase(),
    type: 'gltfModel',
    path: `/models/toycar/${file}`
  }));

const finalSources = [...baseSources, ...glbSources];

const content = `export default ${JSON.stringify(finalSources, null, 4)};\n`;

fs.writeFileSync(outputPath, content, 'utf8');

console.log('sources.js regenerado correctamente');
console.log('Archivo generado en:', outputPath);
console.log('Modelos GLB encontrados:', glbSources.length);