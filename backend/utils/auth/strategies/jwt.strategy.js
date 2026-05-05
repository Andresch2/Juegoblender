const { Strategy, ExtractJwt } = require('passport-jwt')
const User = require('../../../models/User')

const JWT_SECRET = process.env.JWT_SECRET || 'juego_secret_2024'

const JwtStrategy = new Strategy(
    {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: JWT_SECRET
    },
    async (payload, done) => {
        try {
            const user = await User.findById(payload.sub).select('-password')
            if (!user) return done(null, false)
            return done(null, user)
        } catch (err) {
            return done(err)
        }
    }
)

module.exports = JwtStrategy