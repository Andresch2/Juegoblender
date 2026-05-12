// Igual al user.dto.js del profe adaptado al juego
const Joi = require('joi')

const email    = Joi.string().email()
const password = Joi.string().min(6)
const role     = Joi.string().valid('admin', 'player')

// DTO para registro
const registerDto = Joi.object({
    email:    email.required(),
    password: password.required(),
    role:     role
})

// DTO para login
const loginDto = Joi.object({
    email:    email.required(),
    password: password.required()
})

module.exports = { registerDto, loginDto }