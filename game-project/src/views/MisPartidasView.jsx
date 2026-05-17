// src/views/MisPartidasView.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMySessions } from '../services/sessions'
import { clearToken } from '../services/session'

export default function MisPartidasView() {
    const navigate = useNavigate()
    const [sesiones, setSesiones] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        getMySessions()
            .then(data => { setSesiones(data); setLoading(false) })
            .catch(() => { setError('No se pudieron cargar las partidas'); setLoading(false) })
    }, [])

    const totalPuntos = sesiones.reduce((acc, s) => acc + s.puntos, 0)

    const formatTiempo = (seg) => {
        const m = Math.floor(seg / 60)
        const s = seg % 60
        return m > 0 ? `${m}m ${s}s` : `${s}s`
    }

    return (
        <div style={styles.container}>
            <div style={styles.wrapper}>
                <h1 style={styles.title}>Juego Blender</h1>
                <h2 style={styles.subtitle}>Mis Partidas</h2>

                {loading && <p style={styles.info}>Cargando partidas...</p>}
                {error && <p role="alert" style={styles.error}>{error}</p>}

                {!loading && !error && sesiones.length === 0 && (
                    <p style={styles.info}>Aun no tienes partidas registradas. Juega para ver tu historial.</p>
                )}

                {!loading && !error && sesiones.length > 0 && (
                    <>
                        <div style={styles.resumen}>
                            <div style={styles.stat}>
                                <span>Partidas</span>
                                <strong>{sesiones.length}</strong>
                                <small>Partidas</small>
                            </div>
                            <div style={styles.stat}>
                                <span>Puntos</span>
                                <strong>{totalPuntos}</strong>
                                <small>Puntos totales</small>
                            </div>
                            <div style={styles.stat}>
                                <span>Record</span>
                                <strong>{Math.max(...sesiones.map(s => s.puntos))}</strong>
                                <small>Mejor puntaje</small>
                            </div>
                        </div>

                        <div style={styles.tabla}>
                            <div style={styles.thead}>
                                <span>#</span>
                                <span>Nivel</span>
                                <span>Puntos</span>
                                <span>Tiempo</span>
                                <span>Fecha</span>
                            </div>
                            {sesiones.map((s, i) => (
                                <div key={s._id} style={{
                                    ...styles.fila,
                                    background: i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'transparent'
                                }}>
                                    <span style={styles.num}>{i + 1}</span>
                                    <span>
                                        <span style={styles.badge}>Nivel {s.nivel}</span>
                                    </span>
                                    <span style={styles.puntos}>{s.puntos}</span>
                                    <span style={styles.tiempo}>{formatTiempo(s.tiempo)}</span>
                                    <span style={styles.fecha}>
                                        {new Date(s.fecha).toLocaleDateString('es-CO')}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                <div style={styles.navBtns}>
                    <button
                        onClick={() => {
                            const nivelGuardado = localStorage.getItem('savedLevel')
                            if (nivelGuardado && parseInt(nivelGuardado) > 1) {
                                sessionStorage.setItem('continueFromLevel', nivelGuardado)
                            }
                            navigate('/game')
                        }}
                        style={styles.btnVolver}
                    >
                        {localStorage.getItem('savedLevel') > 1
                            ? `Continuar - Nivel ${localStorage.getItem('savedLevel')}`
                            : 'Volver al Juego'}
                    </button>
                    <button onClick={() => { clearToken(); navigate('/login') }} style={styles.btnLogout}>
                        Cerrar Sesion
                    </button>
                </div>
            </div>
        </div>
    )
}

const styles = {
    container: { position: 'fixed', inset: 0, width: '100vw', height: '100vh', overflowY: 'auto', background: 'linear-gradient(135deg,#0f0c29,#302b63,#24243e)', fontFamily: 'sans-serif', padding: '24px 16px', boxSizing: 'border-box' },
    wrapper: { maxWidth: 720, margin: '0 auto', paddingBottom: 80 },
    title: { color: '#fff', textAlign: 'center', margin: '0 0 4px', fontSize: 26 },
    subtitle: { color: '#a5b4fc', textAlign: 'center', margin: '0 0 24px', fontSize: 20, fontWeight: 400 },
    info: { color: '#94a3b8', textAlign: 'center', marginTop: 20 },
    error: { color: '#f87171', textAlign: 'center' },
    resumen: { display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' },
    stat: { flex: 1, minWidth: 100, background: 'rgba(255,255,255,0.07)', borderRadius: 10, padding: '14px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 4, color: '#fff', fontSize: 18 },
    tabla: { background: 'rgba(255,255,255,0.04)', borderRadius: 10, overflow: 'hidden', marginBottom: 24 },
    thead: { display: 'grid', gridTemplateColumns: '0.5fr 1fr 1fr 1fr 1.5fr', padding: '10px 16px', background: 'rgba(99,102,241,0.35)', color: '#a5b4fc', fontSize: 13, fontWeight: 700, gap: 8 },
    fila: { display: 'grid', gridTemplateColumns: '0.5fr 1fr 1fr 1fr 1.5fr', padding: '10px 16px', color: '#e2e8f0', fontSize: 13, gap: 8, alignItems: 'center' },
    num: { color: '#64748b' },
    badge: { background: 'rgba(99,102,241,0.3)', borderRadius: 4, padding: '2px 8px', fontSize: 12, color: '#818cf8' },
    puntos: { color: '#fbbf24', fontWeight: 700 },
    tiempo: { color: '#34d399' },
    fecha: { color: '#94a3b8', fontSize: 12 },
    navBtns: { display: 'flex', gap: 12, marginTop: 16 },
    btnVolver: { flex: 1, padding: 13, borderRadius: 8, background: 'linear-gradient(90deg,#6366f1,#8b5cf6)', color: '#fff', border: 'none', fontSize: 15, cursor: 'pointer', fontWeight: 600, minHeight: 44 },
    btnLogout: { flex: 1, padding: 13, borderRadius: 8, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171', fontSize: 15, cursor: 'pointer', fontWeight: 600, minHeight: 44 }
}
