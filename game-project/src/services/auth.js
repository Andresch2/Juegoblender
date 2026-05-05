// src/services/auth.js
import { request } from './http'

export const login = (email, password) =>
    request('/auth/login', { method: 'POST', body: { email, password } })

export const register = (email, password) =>
    request('/auth/register', { method: 'POST', body: { email, password } })

export const getProfile = () =>
    request('/auth/profile/my-user', { auth: true })