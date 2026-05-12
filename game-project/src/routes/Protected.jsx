// src/routes/Protected.jsx
import { Navigate } from 'react-router-dom'
import { getToken, isFrontendOnly } from '../services/session'

export const Protected = ({ children }) => {
    if (isFrontendOnly()) return <>{children}</>

    const token = getToken()
    if (!token) return <Navigate to="/login" replace />
    return <>{children}</>
}
