require('dotenv').config()
const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')
const Block = require('./models/Block')

const DATA_FILES = [
    'toy_car_blocks1.json',
    'toy_car_blocks2.json',
    'toy_car_blocks3.json',
    'toy_car_blocks4.json',
    'toy_car_blocks5.json'
]

function readBlocks() {
    return DATA_FILES.flatMap((fileName) => {
        const filePath = path.join(__dirname, 'data', fileName)
        const blocks = JSON.parse(fs.readFileSync(filePath, 'utf8'))

        if (!Array.isArray(blocks)) {
            throw new Error(`${fileName} debe contener un arreglo de bloques`)
        }

        return blocks
    })
}

async function seedDatabase() {
    try {
        const blocks = readBlocks()

        await mongoose.connect(process.env.MONGO_URI)

        await Block.deleteMany({})
        await Block.insertMany(blocks)

        const counts = blocks.reduce((acc, block) => {
            acc[block.level] = (acc[block.level] || 0) + 1
            return acc
        }, {})

        console.log('Datos sincronizados en MongoDB:', counts)
        process.exit()
    } catch (err) {
        console.error('Error al sincronizar datos:', err)
        process.exit(1)
    }
}

seedDatabase()
