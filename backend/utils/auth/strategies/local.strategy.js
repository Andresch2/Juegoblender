const { Strategy } = require('passport-local')
const bcrypt = require('bcrypt')
const User = require('../../../models/User')

const LocalStrategy = new Strategy(
    { usernameField: 'email', passwordField: 'password' },
    async (email, password, done) => {
        try {
            const user = await User.findOne({ email })
            if (!user) return done(null, false, { message: 'Usuario no encontrado' })

            const isMatch = await bcrypt.compare(password, user.password)
            if (!isMatch) return done(null, false, { message: 'Contraseña incorrecta' })

            return done(null, user)
        } catch (err) {
            return done(err)
        }
    }
)

module.exports = LocalStrategy