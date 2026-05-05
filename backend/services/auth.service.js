const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
const User = require('../models/User')

const JWT_SECRET = process.env.JWT_SECRET || 'juego_secret_2024'

class AuthService {

    async register(email, password, role = 'player') {
        const existe = await User.findOne({ email })
        if (existe) throw { status: 409, message: 'El usuario ya existe' }

        const hash = await bcrypt.hash(password, 10)
        const user = new User({ email, password: hash, role })
        await user.save()
        return { message: 'Usuario creado', email: user.email }
    }

    signToken(user) {
        const payload = {
            sub: user._id,
            role: user.role
        }
        console.log('[JWT] payload to sign:', payload)
        const access_token = jwt.sign(payload, JWT_SECRET, { expiresIn: '2h' })
        console.log('[JWT] token prefix:', access_token.slice(0, 20))
        return {
            user: { id: user._id, email: user.email, role: user.role },
            access_token
        }
    }
}

module.exports = AuthService
