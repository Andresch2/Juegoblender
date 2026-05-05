import { useEffect, useRef, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Protected } from './routes/Protected'
import LoginView from './views/LoginView'
import Experience from './Experience/Experience'
import './styles/loader.css'

function GameView() {
    const canvasRef = useRef()
    const [progress, setProgress] = useState(0)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const experience = new Experience(canvasRef.current)
        const onProgress = (e) => setProgress(e.detail)
        const onComplete = () => setLoading(false)
        window.addEventListener('resource-progress', onProgress)
        window.addEventListener('resource-complete', onComplete)
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
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<LoginView />} />
                <Route path="/game" element={
                    <Protected>
                        <GameView />
                    </Protected>
                } />
                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        </BrowserRouter>
    )
}