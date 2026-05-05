// src/services/session.js
export const setToken  = (t) => localStorage.setItem('token', t)
export const getToken  = ()  => localStorage.getItem('token')
export const clearToken = () => localStorage.removeItem('token')