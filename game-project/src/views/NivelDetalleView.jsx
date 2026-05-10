// src/views/NivelDetalleView.jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { request } from '../services/http'

export default function NivelDetalleView() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [bloques, setBloques] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        request(`/api/blocks?level=${id}`, { auth: true })
            .then(data => { setBloques(data); setLoading(false) })
            .catch(() => { setError('No se pudo cargar el nivel'); setLoading(false) })
    }, [id])

    const coins = bloques.filter(b => b.name?.startsWith('coin_') && !b.name?.includes('coin_structure'))
    const portal = bloques.filter(b => b.role === 'finalPrize')
    const objetos = bloques.filter(b => !b.name?.startsWith('coin_') && b.role !== 'finalPrize')

    return (
        <div style={styles.container}>
            <div style={styles.wrapper}>
                <button onClick={() => navigate('/niveles')} style={styles.back}>← Volver</button>
                <h1 style={styles.title}>Nivel {id}</h1>

                {loading && <p style={styles.info}>Cargando objetos...</p>}
                {error && <p role="alert" style={styles.error}>{error}</p>}

                {!loading && !error && (
                    <>
                        {/* Resumen */}
                        <div style={styles.resumen}>
                            <div style={styles.stat}><span>📦</span><strong>{bloques.length}</strong><small>Total objetos</small></div>
                            <div style={styles.stat}><span>🪙</span><strong>{coins.length}</strong><small>Coins</small></div>
                            <div style={styles.stat}><span>🌀</span><strong>{portal.length}</strong><small>Portal</small></div>
                            <div style={styles.stat}><span>🧱</span><strong>{objetos.length}</strong><small>Bloques</small></div>
                        </div>

                        {/* Coins */}
                        {coins.length > 0 && (
                            <>
                                <h3 style={styles.seccion}>🪙 Coins del nivel</h3>
                                <div style={styles.tabla}>
                                    <div style={styles.thead}>
                                        <span>Nombre</span><span>X</span><span>Y</span><span>Z</span><span>Rol</span>
                                    </div>
                                    {coins.map((b, i) => (
                                        <div key={i} style={{ ...styles.fila, background: i%2===0?'rgba(255,255,255,0.04)':'transparent' }}>
                                            <span style={styles.nombre}>{b.name}</span>
                                            <span>{b.x?.toFixed(1)}</span>
                                            <span>{b.y?.toFixed(1)}</span>
                                            <span>{b.z?.toFixed(1)}</span>
                                            <span style={styles.badge}>{b.role}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {/* Objetos */}
                        {objetos.length > 0 && (
                            <>
                                <h3 style={styles.seccion}>🧱 Objetos del nivel</h3>
                                <div style={styles.tabla}>
                                    <div style={styles.thead}>
                                        <span>Nombre</span><span>X</span><span>Y</span><span>Z</span><span>Rol</span>
                                    </div>
                                    {objetos.slice(0, 20).map((b, i) => (
                                        <div key={i} style={{ ...styles.fila, background: i%2===0?'rgba(255,255,255,0.04)':'transparent' }}>
                                            <span style={styles.nombre}>{b.name}</span>
                                            <span>{b.x?.toFixed(1)}</span>
                                            <span>{b.y?.toFixed(1)}</span>
                                            <span>{b.z?.toFixed(1)}</span>
                                            <span style={styles.badge}>{b.role}</span>
                                        </div>
                                    ))}
                                    {objetos.length > 20 && (
                                        <p style={styles.info}>... y {objetos.length - 20} objetos más</p>
                                    )}
                                </div>
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}

const styles = {
    container: { minHeight:'100vh', background:'linear-gradient(135deg,#0f0c29,#302b63,#24243e)', fontFamily:'sans-serif', padding:'32px 16px' },
    wrapper: { maxWidth:760, margin:'0 auto' },
    back: { background:'none', border:'1px solid rgba(255,255,255,0.2)', color:'#a5b4fc', borderRadius:8, padding:'8px 16px', cursor:'pointer', fontSize:14, marginBottom:20 },
    title: { color:'#fff', fontSize:28, margin:'0 0 20px' },
    info: { color:'#94a3b8', textAlign:'center' },
    error: { color:'#f87171' },
    resumen: { display:'flex', gap:12, marginBottom:28, flexWrap:'wrap' },
    stat: { flex:1, minWidth:100, background:'rgba(255,255,255,0.07)', borderRadius:10, padding:'14px', textAlign:'center', display:'flex', flexDirection:'column', gap:4, color:'#fff', fontSize:22 },
    seccion: { color:'#a5b4fc', fontSize:16, margin:'0 0 10px', borderBottom:'1px solid rgba(255,255,255,0.1)', paddingBottom:8 },
    tabla: { background:'rgba(255,255,255,0.04)', borderRadius:10, overflow:'hidden', marginBottom:24 },
    thead: { display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr', padding:'8px 12px', background:'rgba(99,102,241,0.3)', color:'#a5b4fc', fontSize:12, fontWeight:700, gap:8 },
    fila: { display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr', padding:'8px 12px', color:'#e2e8f0', fontSize:12, gap:8, alignItems:'center' },
    nombre: { overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:11 },
    badge: { background:'rgba(99,102,241,0.3)', borderRadius:4, padding:'2px 6px', fontSize:10, color:'#818cf8' }
}