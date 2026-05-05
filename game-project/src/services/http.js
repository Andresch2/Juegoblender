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

    const data = await res.json().catch(() => null)
    if (!res.ok) throw { status: res.status, data }
    return data
}