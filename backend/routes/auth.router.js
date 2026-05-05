const express = require('express')
const passport = require('passport')
const router = express.Router()
const AuthService = require('../services/auth.service')

const service = new AuthService()

// POST /auth/register
router.post('/register', async (req, res, next) => {
    try {
        const { email, password, role } = req.body
        const data = await service.register(email, password, role)
        res.status(201).json(data)
    } catch (err) {
        next(err)
    }
})

// POST /auth/login → igual al profe: passport.authenticate('local') → signToken()
router.post('/login',
    passport.authenticate('local', { session: false }),
    async (req, res, next) => {
        try {
            const user = req.user
            console.log('[LOGIN] user:', user._id, user.email)
            const data = service.signToken(user)
            return res.json(data)
        } catch (error) {
            console.error('[LOGIN][ERROR]:', error)
            return next(error)
        }
    }
)

// GET /auth/profile/my-user → protegido con JWT
router.get('/profile/my-user',
    passport.authenticate('jwt', { session: false }),
    (req, res) => {
        res.json({ id: req.user._id, email: req.user.email, role: req.user.role })
    }
)

module.exports = router