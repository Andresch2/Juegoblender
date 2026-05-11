// src/views/NivelesView.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { request } from '../services/http'
import { clearToken } from '../services/session'

const NIVELES = [
    { id: 1, nombre: 'Nivel 1 — Bosque Inicial', icono: '🌲' },
    { id: 2, nombre: 'Nivel 2 — Laberinto', icono: '🌀' },
    { id: 3, nombre: 'Nivel 3 — Ciudad', icono: '🏙️' },
    { id: 4, nombre: 'Nivel 4 — Industrial', icono: '🏭' },
    { id: 5, nombre: 'Nivel 5 — Final', icono: '🏆' },
]

export default function NivelesView() {
    const navigate = useNavigate()
    const [conteos, setConteos] = useState({})
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        const cargarConteos = async () => {
            try {
                const resultados = {}
                for (const nivel of NIVELES) {
                    const bloques = await request(`/api/blocks?level=${nivel.id}`, { auth: true })
                    const coins = bloques.filter(b => b.name?.startsWith('coin_') && !b.name?.includes('coin_structure'))
                    resultados[nivel.id] = {
                        total: bloques.length,
                        coins: coins.length,
                        portal: bloques.filter(b => b.role === 'finalPrize').length
                    }
                }
                setConteos(resultados)
            } catch (err) {
                setError('No se pudo conectar con el servidor')
            } finally {
                setLoading(false)
            }
        }
        cargarConteos()
    }, [])

    return (
        <div style={styles.container}>
            <div style={styles.wrapper}>
                <h1 style={styles.title}>🎮 Juego Blender</h1>
                <h2 style={styles.subtitle}>Catálogo de Niveles</h2>

                {loading && <p style={styles.info}>Cargando niveles...</p>}
                {error && <p role="alert" style={styles.error}>{error}</p>}

                {!loading && !error && (
                    <div style={styles.grid}>
                        {NIVELES.map(nivel => {
                            const info = conteos[nivel.id] || {}
                            return (
                                <button
                                    key={nivel.id}
                                    style={styles.card}
                                    onClick={() => navigate(`/niveles/${nivel.id}`)}
                                    aria-label={`Ver detalle de ${nivel.nombre}`}
                                >
                                    <span style={styles.icono}>{nivel.icono}</span>
                                    <span style={styles.nombreNivel}>{nivel.nombre}</span>
                                    <div style={styles.stats}>
                                        <span>📦 {info.total ?? '—'} objetos</span>
                                        <span>🪙 {info.coins ?? '—'} coins</span>
                                        <span>🌀 {info.portal ?? '—'} portal</span>
                                    </div>
                                    <span style={styles.ver}>Ver detalle →</span>
                                </button>
                            )
                        })}
                    </div>
                )}

                <div style={styles.navBtns}>
                    <button onClick={() => navigate('/game')} style={styles.btnVolver}>
                        ▶ Volver al Juego
                    </button>
                    <button onClick={() => { clearToken(); navigate('/login') }} style={styles.btnLogout}>
                        🚪 Cerrar Sesión
                    </button>
                </div>
            </div>
        </div>
    )
}

const styles = {
    container: { minHeight:'100vh', overflowY:'auto', background:'linear-gradient(135deg,#0f0c29,#302b63,#24243e)', fontFamily:'sans-serif', padding:'32px 16px' },
    wrapper: { maxWidth:700, margin:'0 auto' },
    title: { color:'#fff', textAlign:'center', margin:'0 0 4px', fontSize:26 },
    subtitle: { color:'#a5b4fc', textAlign:'center', margin:'0 0 28px', fontSize:20, fontWeight:400 },
    info: { color:'#94a3b8', textAlign:'center' },
    error: { color:'#f87171', textAlign:'center' },
    grid: { display:'flex', flexDirection:'column', gap:14 },
    card: { background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:12, padding:'18px 22px', cursor:'pointer', textAlign:'left', color:'#fff', display:'flex', flexDirection:'column', gap:8, transition:'background 0.2s' },
    icono: { fontSize:28 },
    nombreNivel: { fontSize:17, fontWeight:700, color:'#e2e8f0' },
    stats: { display:'flex', gap:16, fontSize:13, color:'#94a3b8' },
    ver: { fontSize:13, color:'#818cf8', marginTop:4 },
    navBtns: { display:'flex', gap:12, marginTop:28 },
    btnVolver: { flex:1, padding:13, borderRadius:8, background:'linear-gradient(90deg,#6366f1,#8b5cf6)', color:'#fff', border:'none', fontSize:15, cursor:'pointer', fontWeight:600, minHeight:44 },
    btnLogout: { flex:1, padding:13, borderRadius:8, background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.4)', color:'#f87171', fontSize:15, cursor:'pointer', fontWeight:600, minHeight:44 }
}