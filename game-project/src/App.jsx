import { useEffect, useRef, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Protected } from './routes/Protected'
import LoginView from './views/LoginView'
import ProfileView from './views/ProfileView'
import NivelesView from './views/NivelesView'
import NivelDetalleView from './views/NivelDetalleView'
import Experience from './Experience/Experience'
import MisPartidasView from './views/MisPartidasView'
import { isFrontendOnly } from './services/session'

import './styles/loader.css'

function GameView() {
    const canvasRef = useRef()
    const [progress, setProgress] = useState(0)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const onProgress = (e) => setProgress(e.detail)
        const onComplete = () => setLoading(false)
        window.addEventListener('resource-progress', onProgress)
        window.addEventListener('resource-complete', onComplete)
        new Experience(canvasRef.current)

        return () => {
            window.removeEventListener('resource-progress', onProgress)
            window.removeEventListener('resource-complete', onComplete)
        }
    }, [])

    return (
        <>
            {loading && (
                <div id="loader-overlay">
                    <div id="loader-bar" style={{ width: `${progress}%` }}></div>
                    <div id="loader-text">Cargando... {progress}%</div>
                </div>
            )}
            <canvas ref={canvasRef} className="webgl" />
        </>
    )
}

export default function App() {
    const fallbackRoute = isFrontendOnly() ? '/game' : '/login'

    return (
        <BrowserRouter>
            <Routes>
                
                <Route path="/login" element={<LoginView />} />
                <Route path="/perfil" element={
                    <Protected>
                        <ProfileView />
                    </Protected>
                } />
                <Route path="/mis-partidas" element={
                    <Protected>
                        <MisPartidasView />
                    </Protected>
                } />
                <Route path="/niveles" element={
                    <Protected>
                        <NivelesView />
                    </Protected>
                } />
                <Route path="/niveles/:id" element={
                    <Protected>
                        <NivelDetalleView />
                    </Protected>
                } />
                <Route path="/game" element={
                    <Protected>
                        <GameView />
                    </Protected>
                } />
                <Route path="*" element={<Navigate to={fallbackRoute} replace />} />
            </Routes>
        </BrowserRouter>
    )
}
