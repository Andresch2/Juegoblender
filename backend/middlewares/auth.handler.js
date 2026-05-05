const checkRoles = (...roles) => (req, res, next) => {
    const user = req.user
    if (!user || !roles.includes(user.role)) {
        return res.status(403).json({ message: 'No tienes permiso para esta acción' })
    }
    next()
}

module.exports = { checkRoles }