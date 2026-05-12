const express = require('express')
const passport = require('passport')
const router = express.Router()
const jwt = require('jsonwebtoken')
const AuthService = require('../services/auth.service')
const GameSession = require('../models/GameSession')
const { checkRoles } = require('../middlewares/auth.handler')
const validatorHandler = require('../middlewares/validator.handler')
const { registerDto, loginDto } = require('../dtos/user.dto')

const service = new AuthService()
const JWT_SECRET = process.env.JWT_SECRET || 'juego_secret_2024'

// POST /auth/register — con validación Joi (Act. 12)
router.post('/register',
    validatorHandler(registerDto, 'body'),
    async (req, res, next) => {
        try {
            const { email, password, role } = req.body
            const data = await service.register(email, password, role)
            res.status(201).json(data)
        } catch (err) {
            next(err)
        }
    }
)

// POST /auth/login — con validación Joi (Act. 12)
router.post('/login',
    validatorHandler(loginDto, 'body'),
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

// GET /auth/profile/my-user — protegido con JWT (Act. 1)
router.get('/profile/my-user',
    passport.authenticate('jwt', { session: false }),
    (req, res) => {
        res.json({ id: req.user._id, email: req.user.email, role: req.user.role })
    }
)

// POST /auth/sessions — guardar partida (Act. 4)
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

// GET /auth/profile/my-sessions — mis partidas con populate (Act. 4 + 11)
router.get('/profile/my-sessions',
    passport.authenticate('jwt', { session: false }),
    async (req, res) => {
        try {
            const sesiones = await GameSession
                .find({ userId: req.user._id })
                .populate('userId', 'email role')
                .sort({ fecha: -1 })
            res.json(sesiones)
        } catch (err) {
            res.status(500).json({ message: 'Error al obtener partidas' })
        }
    }
)

// GET /auth/admin/users — solo admin (Act. 3)
router.get('/admin/users',
    passport.authenticate('jwt', { session: false }),
    checkRoles('admin'),
    async (req, res) => {
        const User = require('../models/User')
        const users = await User.find().select('-password')
        res.json(users)
    }
)

// POST /auth/refresh-token — renovar token (Act. 10)
router.post('/refresh-token', (req, res) => {
    const { token } = req.body
    if (!token) return res.status(401).json({ message: 'Token requerido' })
    try {
        const payload = jwt.verify(token, JWT_SECRET)
        const newToken = jwt.sign(
            { sub: payload.sub, role: payload.role },
            JWT_SECRET,
            { expiresIn: '2h' }
        )
        res.json({ access_token: newToken })
    } catch (err) {
        res.status(403).json({ message: 'Token inválido o expirado' })
    }
})

module.exports = router