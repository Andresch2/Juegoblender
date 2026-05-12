// src/services/http.js
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export async function request(path, options) {
    const token = localStorage.getItem('token')
    const headers = {
        'Content-Type': 'application/json',
        ...(options?.headers || {})
    }
    if (options?.auth && token) headers.Authorization = `Bearer ${token}`

    const res = await fetch(`${BASE_URL}${path}`, {
        method: options?.method || 'GET',
        headers,
        body: options?.body ? JSON.stringify(options.body) : undefined
    })

    // Actividad 10: interceptar 401 e intentar renovar token
    if (res.status === 401 && token) {
        const refreshRes = await fetch(`${BASE_URL}/auth/refresh-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        })
        if (refreshRes.ok) {
            const { access_token } = await refreshRes.json()
            localStorage.setItem('token', access_token)
            headers.Authorization = `Bearer ${access_token}`
            res = await fetch(`${BASE_URL}${path}`, {
                method: options?.method || 'GET',
                headers,
                body: options?.body ? JSON.stringify(options.body) : undefined
            })
        } else {
            localStorage.removeItem('token')
            window.location.href = '/login'
            return
        }
    }


    const data = await res.json().catch(() => null)
    if (!res.ok) throw { status: res.status, data }
    return data
}