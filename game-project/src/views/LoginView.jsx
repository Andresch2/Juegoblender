// src/views/LoginView.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login as loginRequest, register as registerRequest } from '../services/auth'
import { setToken } from '../services/session'

export default function LoginView() {
    const navigate = useNavigate()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [mode, setMode] = useState('login') // 'login' | 'register'

    const onSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            if (mode === 'register') {
                await registerRequest(email, password)
                setMode('login')
                setError('✅ Registro exitoso. Ahora inicia sesión.')
                return
            }

            const data = await loginRequest(email, password)
            setToken(data.access_token)
            navigate('/game')
        } catch (err) {
            setError(err?.status === 401 ? 'Credenciales inválidas' : 'Error de autenticación')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <h1 style={styles.title}>🎮 Juego Blender</h1>
                <h2 style={styles.subtitle}>
                    {mode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
                </h2>

                {error && (
                    <p role="alert" style={{
                        ...styles.msg,
                        color: error.startsWith('✅') ? '#4ade80' : '#f87171'
                    }}>{error}</p>
                )}

                <form onSubmit={onSubmit}>
                    <div style={styles.field}>
                        <label htmlFor="email" style={styles.label}>
                            Correo electrónico
                        </label>
                        <input
                            id="email" type="email"
                            value={email} onChange={e => setEmail(e.target.value)}
                            style={styles.input} required
                            placeholder="tu@correo.com"
                        />
                    </div>
                    <div style={styles.field}>
                        <label htmlFor="password" style={styles.label}>
                            Contraseña
                        </label>
                        <input
                            id="password" type="password"
                            value={password} onChange={e => setPassword(e.target.value)}
                            style={styles.input} required minLength={6}
                            placeholder="••••••••"
                        />
                    </div>

                    <button type="submit" disabled={loading} style={styles.btn} aria-busy={loading}>
                        {loading ? 'Procesando...' : mode === 'login' ? 'Entrar al juego' : 'Registrarse'}
                    </button>
                </form>

                <button
                    onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null) }}
                    style={styles.toggle}
                >
                    {mode === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
                </button>
            </div>
        </div>
    )
}

const styles = {
    container: { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#0f0c29,#302b63,#24243e)', fontFamily:'sans-serif' },
    card: { background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:16, padding:'40px 36px', width:'100%', maxWidth:400, backdropFilter:'blur(12px)' },
    title: { color:'#fff', textAlign:'center', margin:'0 0 4px', fontSize:28 },
    subtitle: { color:'#a5b4fc', textAlign:'center', margin:'0 0 24px', fontSize:18, fontWeight:400 },
    msg: { textAlign:'center', marginBottom:16, fontSize:14 },
    field: { marginBottom:20 },
    label: { display:'block', color:'#cbd5e1', marginBottom:6, fontSize:14 },
    input: { width:'100%', padding:'12px 14px', borderRadius:8, border:'1px solid rgba(255,255,255,0.2)', background:'rgba(255,255,255,0.08)', color:'#fff', fontSize:16, boxSizing:'border-box' },
    btn: { width:'100%', padding:14, borderRadius:8, background:'linear-gradient(90deg,#6366f1,#8b5cf6)', color:'#fff', border:'none', fontSize:16, cursor:'pointer', fontWeight:600, marginTop:8, minHeight:44 },
    toggle: { width:'100%', marginTop:16, background:'none', border:'none', color:'#94a3b8', cursor:'pointer', fontSize:14, textDecoration:'underline' }
}