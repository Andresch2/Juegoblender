const mongoose = require('mongoose')

const gameSessionSchema = new mongoose.Schema({
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    email:     { type: String, required: true },
    nivel:     { type: Number, required: true },
    puntos:    { type: Number, required: true },
    tiempo:    { type: Number, required: true },
    fecha:     { type: Date, default: Date.now }
})

module.exports = mongoose.model('GameSession', gameSessionSchema)