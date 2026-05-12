// Mismo validatorHandler del profe — sin boom, adaptado
function validatorHandler(schema, property) {
    return (req, res, next) => {
        const data = req[property]
        const { error } = schema.validate(data, { abortEarly: false })
        if (error) {
            return res.status(400).json({
                statusCode: 400,
                error: 'Bad Request',
                message: error.details.map(d => d.message).join(', ')
            })
        }
        next()
    }
}

module.exports = validatorHandler