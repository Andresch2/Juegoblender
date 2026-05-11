// src/services/sessions.js
import { request } from './http'

export const getMySessions = () =>
    request('/auth/profile/my-sessions', { auth: true })

export const saveSession = (nivel, puntos, tiempo) =>
    request('/auth/sessions', {
        method: 'POST',
        auth: true,
        body: { nivel, puntos, tiempo }
    })