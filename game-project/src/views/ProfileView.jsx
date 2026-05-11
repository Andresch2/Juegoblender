// src/views/ProfileView.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProfile } from '../services/auth'
import { clearToken } from '../services/session'

export default function ProfileView() {
    const navigate = useNavigate()
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        getProfile()
            .then(data => { setUser(data); setLoading(false) })
            .catch(() => { setError('No se pudo cargar el perfil'); setLoading(false) })
    }, [])

    const handleLogout = () => {
        clearToken()
        navigate('/login')
    }

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <h1 style={styles.title}>🎮 Juego Blender</h1>
                <h2 style={styles.subtitle}>Perfil del Jugador</h2>

                {loading && <p style={styles.info}>Cargando perfil...</p>}
                {error && <p role="alert" style={styles.error}>{error}</p>}

                {user && (
                    <div style={styles.data}>
                        <div style={styles.row}>
                            <span style={styles.label}>📧 Correo</span>
                            <span style={styles.value}>{user.email}</span>
                        </div>
                        <div style={styles.row}>
                            <span style={styles.label}>🎭 Rol</span>
                            <span style={{
                                ...styles.badge,
                                background: user.role === 'admin' ? '#7c3aed' : '#1d4ed8'
                            }}>{user.role}</span>
                        </div>
                    </div>
                )}

                <div style={styles.actions}>
                    <button
                        onClick={() => navigate('/game')}
                        style={styles.btnPlay}
                        aria-label="Volver al juego"
                    >
                        ▶ Volver al Juego
                    </button>
                    <button
                        onClick={handleLogout}
                        style={styles.btnLogout}
                        aria-label="Cerrar sesión"
                    >
                        🚪 Cerrar Sesión
                    </button>
                </div>
            </div>
        </div>
    )
}

const styles = {
    container: { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#0f0c29,#302b63,#24243e)', fontFamily:'sans-serif' },
    card: { background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:16, padding:'40px 36px', width:'100%', maxWidth:420, backdropFilter:'blur(12px)' },
    title: { color:'#fff', textAlign:'center', margin:'0 0 4px', fontSize:26 },
    subtitle: { color:'#a5b4fc', textAlign:'center', margin:'0 0 28px', fontSize:18, fontWeight:400 },
    info: { color:'#94a3b8', textAlign:'center' },
    error: { color:'#f87171', textAlign:'center' },
    data: { background:'rgba(255,255,255,0.05)', borderRadius:10, padding:'16px 20px', marginBottom:24 },
    row: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid rgba(255,255,255,0.08)' },
    label: { color:'#94a3b8', fontSize:14 },
    value: { color:'#fff', fontSize:14, fontWeight:600 },
    badge: { color:'#fff', fontSize:12, fontWeight:700, padding:'3px 10px', borderRadius:20 },
    actions: { display:'flex', flexDirection:'column', gap:12 },
    btnPlay: { padding:14, borderRadius:8, background:'linear-gradient(90deg,#6366f1,#8b5cf6)', color:'#fff', border:'none', fontSize:15, cursor:'pointer', fontWeight:600, minHeight:44 },
    btnLogout: { padding:14, borderRadius:8, background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.4)', color:'#f87171', fontSize:15, cursor:'pointer', fontWeight:600, minHeight:44 }
}