const express = require('express')
const passport = require('passport')
const router = express.Router()
const AuthService = require('../services/auth.service')

const service = new AuthService()
const GameSession = require('../models/GameSession')
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
// POST /auth/sessions — guardar partida (equivalente a POST /orders del profe)
router.post('/sessions',
    passport.authenticate('jwt', { session: false }),
    async (req, res) => {
        try {
            const { nivel, puntos, tiempo } = req.body
            const sesion = new GameSession({
                userId: req.user._id,
                email:  req.user.email,
                nivel,
                puntos,
                tiempo
            })
            await sesion.save()
            res.status(201).json({ message: 'Partida guardada', sesion })
        } catch (err) {
            res.status(500).json({ message: 'Error al guardar partida', error: err.message })
        }
    }
)

// GET /auth/profile/my-sessions — mis partidas (equivalente a GET /profile/my-orders del profe)
router.get('/profile/my-sessions',
    passport.authenticate('jwt', { session: false }),
    async (req, res) => {
        try {
            const sesiones = await GameSession
                .find({ userId: req.user._id })
                .sort({ fecha: -1 })
            res.json(sesiones)
        } catch (err) {
            res.status(500).json({ message: 'Error al obtener partidas' })
        }
    }
)

module.exports = router