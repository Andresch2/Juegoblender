// src/routes/Protected.jsx
import { Navigate } from 'react-router-dom'
import { getToken } from '../services/session'

export const Protected = ({ children }) => {
    const token = getToken()
    if (!token) return <Navigate to="/login" replace />
    return <>{children}</>
}