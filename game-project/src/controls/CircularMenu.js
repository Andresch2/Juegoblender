import gsap from 'gsap'

export default class CircularMenu {
  constructor({ container, vrIntegration, onAudioToggle, onWalkMode, onFullscreen, onCancelGame }) {
    this.container = container
    this.vrIntegration = vrIntegration
    this.isOpen = false
    this.actionButtons = []

    // Estilo base de los botones
    const baseStyle = `
      position: fixed;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: rgba(0, 255, 247, 0.12);
      color: #00fff7;
      font-size: 20px;
      border: 1px solid rgba(0, 255, 247, 0.3);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 10px #00fff7;
      backdrop-filter: blur(4px);
      z-index: 9999;
      transition: all 0.3s ease;
    `

    const hoverStyle = `
      background: rgba(0, 255, 247, 0.25);
      box-shadow: 0 0 15px #00fff7, 0 0 30px #00fff7;
      transform: scale(1.1);
    `

    // Botón flotante principal ⚙️
    this.toggleButton = document.createElement('button')
    this.toggleButton.innerText = '⚙️'
    this.toggleButton.title = 'Mostrar menú'
    this.toggleButton.setAttribute('aria-label', 'Mostrar menú')
    this.toggleButton.style.cssText = baseStyle + 'top: 80px; right: 20px;'
    container.appendChild(this.toggleButton)
    // Ocultar inicialmente
    this.toggleButton.style.display = 'none'
    this.toggleButton.addEventListener('click', () => this.toggleMenu())

    // Lista de botones de acción
    const actions = [
      { icon: '🔊', title: 'Audio', onClick: onAudioToggle },
      { icon: '🚶', title: 'Modo Caminata', onClick: onWalkMode },
      { icon: '🖥️', title: 'Pantalla Completa', onClick: onFullscreen },
      { icon: '🥽', title: 'Modo VR', onClick: () => this.vrIntegration.toggleVR() },
      { icon: '👨‍💻', title: 'Acerca de', onClick: () => this.showAboutModal() },
      { icon: '🏅', title: 'Mis Partidas', onClick: () => { window.location.href = '/mis-partidas' } },
      { icon: '👤', title: 'Mi Perfil', onClick: () => { window.location.href = '/perfil' } },
      { icon: '📋', title: 'Catálogo de Niveles', onClick: () => { window.location.href = '/niveles' } },
      { icon: '❌', title: 'Cancelar Juego', onClick: onCancelGame }
    ]

    actions.forEach((action, index) => {
      const btn = document.createElement('button')
      btn.innerText = action.icon
      btn.title = action.title
      btn.setAttribute('aria-label', action.title)

      Object.assign(btn.style, {
        position: 'fixed',
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        background: 'rgba(0, 255, 247, 0.12)',
        color: '#00fff7',
        fontSize: '20px',
        border: '1px solid rgba(0, 255, 247, 0.3)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 0 10px #00fff7',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        top: `${140 + index * 60}px`,
        right: '20px',
        opacity: '0',
        pointerEvents: 'none'
      })

      btn.addEventListener('click', () => {
        action.onClick()
        this.toggleMenu()
      })

      btn.addEventListener('mouseenter', () => btn.style.cssText += hoverStyle)
      btn.addEventListener('mouseleave', () => btn.style.cssText = btn.style.cssText.replace(hoverStyle, ''))

      this.container.appendChild(btn)
      this.actionButtons.push(btn)
    })

    // HUD: Tiempo
    this.timer = document.createElement('div')
    this.timer.id = 'hud-timer'
    this.timer.innerText = '⏱ 0s'
    Object.assign(this.timer.style, {
      position: 'fixed',
      top: '16px',
      left: '70px',
      fontSize: '16px',
      fontWeight: 'bold',
      background: 'rgba(0,0,0,0.6)',
      color: 'white',
      padding: '6px 12px',
      borderRadius: '8px',
      zIndex: 9999,
      fontFamily: 'monospace',
      pointerEvents: 'none'
    })
    document.body.appendChild(this.timer)

    // HUD: Puntos
    this.status = document.createElement('div')
    this.status.id = 'hud-points'
    this.status.innerText = '🎖️ Puntos: 0'
    Object.assign(this.status.style, {
      position: 'fixed',
      top: '16px',
      right: '20px',
      fontSize: '16px',
      fontWeight: 'bold',
      background: 'rgba(0,0,0,0.6)',
      color: 'white',
      padding: '6px 12px',
      borderRadius: '8px',
      zIndex: 9999,
      fontFamily: 'monospace',
      pointerEvents: 'none'
    })
    document.body.appendChild(this.status)

    // HUD: Nivel actual y progreso de monedas
    this.levelLabel = document.createElement('div')
    this.levelLabel.id = 'hud-level'
    this.levelLabel.innerText = 'Nivel: 1'
    Object.assign(this.levelLabel.style, {
      position: 'fixed',
      top: '54px',
      right: '20px',
      fontSize: '16px',
      fontWeight: 'bold',
      background: 'rgba(0,0,0,0.72)',
      color: '#ffffff',
      padding: '6px 12px',
      borderRadius: '8px',
      zIndex: 9999,
      fontFamily: 'monospace',
      pointerEvents: 'none',
      border: '1px solid rgba(255,255,255,0.35)'
    })
    document.body.appendChild(this.levelLabel)

    // HUD: Vida del jugador
    this.healthContainer = document.createElement('div')
    this.healthContainer.id = 'hud-health'
    Object.assign(this.healthContainer.style, {
      position: 'fixed',
      top: '54px',
      left: '70px',
      minWidth: '190px',
      background: 'rgba(0,0,0,0.68)',
      color: '#ffffff',
      padding: '7px 10px',
      borderRadius: '8px',
      zIndex: 9999,
      fontFamily: 'monospace',
      pointerEvents: 'none',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      border: '1px solid rgba(255,255,255,0.22)'
    })

    this.healthText = document.createElement('span')
    this.healthText.innerText = 'Vida'
    Object.assign(this.healthText.style, {
      fontSize: '14px',
      fontWeight: 'bold',
      whiteSpace: 'nowrap'
    })

    this.healthTrack = document.createElement('div')
    Object.assign(this.healthTrack.style, {
      flex: '1',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      minWidth: '120px'
    })

    this.healthHearts = []
    for (let i = 0; i < 5; i += 1) {
      const heart = document.createElement('span')
      const clipId = `health-heart-clip-${i}`
      heart.innerHTML = `
        <svg viewBox="0 0 24 22" width="22" height="20" aria-hidden="true">
          <defs>
            <clipPath id="${clipId}">
              <rect class="heart-fill-clip" x="0" y="0" width="24" height="22"></rect>
            </clipPath>
          </defs>
          <path class="heart-base" d="M12 20.4C5.4 14.6 2 11.4 2 7.2C2 4.2 4.3 2 7.2 2C8.9 2 10.6 2.8 12 4.3C13.4 2.8 15.1 2 16.8 2C19.7 2 22 4.2 22 7.2C22 11.4 18.6 14.6 12 20.4Z" fill="rgba(255,255,255,0.16)" stroke="rgba(255,255,255,0.35)" stroke-width="1.4"/>
          <path class="heart-fill" clip-path="url(#${clipId})" d="M12 20.4C5.4 14.6 2 11.4 2 7.2C2 4.2 4.3 2 7.2 2C8.9 2 10.6 2.8 12 4.3C13.4 2.8 15.1 2 16.8 2C19.7 2 22 4.2 22 7.2C22 11.4 18.6 14.6 12 20.4Z" fill="#ef4444" stroke="#fecaca" stroke-width="1.4"/>
        </svg>
      `
      Object.assign(heart.style, {
        width: '22px',
        height: '20px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'transform 0.18s ease, opacity 0.18s ease, filter 0.18s ease'
      })
      this.healthTrack.appendChild(heart)
      this.healthHearts.push(heart)
    }

    this.healthValue = document.createElement('span')
    this.healthValue.innerText = '5/5'
    Object.assign(this.healthValue.style, {
      width: '34px',
      textAlign: 'right',
      fontSize: '13px',
      fontWeight: 'bold'
    })

    this.healthContainer.appendChild(this.healthText)
    this.healthContainer.appendChild(this.healthTrack)
    this.healthContainer.appendChild(this.healthValue)
    document.body.appendChild(this.healthContainer)

    // HUD: Jugadores

    this.playersLabel = document.createElement('div')
    this.playersLabel.id = 'hud-players'
    this.playersLabel.innerText = '👥 Jugadores: 1'
    Object.assign(this.playersLabel.style, {
      position: 'fixed',
      top: '16px',
      left: '140px',
      fontSize: '16px',
      fontWeight: 'bold',
      background: 'rgba(0,0,0,0.6)',
      color: 'white',
      padding: '6px 12px',
      borderRadius: '8px',
      zIndex: 9999,
      fontFamily: 'monospace',
      pointerEvents: 'none'
    })
    document.body.appendChild(this.playersLabel)

  }

  //Mostrar modal acerca de
  showAboutModal() {
    if (this.aboutContainer) return // evita duplicados

    this.aboutContainer = document.createElement('div')
    Object.assign(this.aboutContainer.style, {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      background: 'rgba(0, 0, 0, 0.95)',
      padding: '20px',
      borderRadius: '12px',
      color: '#fff',
      zIndex: 10000,
      textAlign: 'center',
      fontFamily: 'sans-serif',
      maxWidth: '300px',
      boxShadow: '0 0 20px #00fff7'
    })

    this.aboutContainer.innerHTML = `
          <h2 style="margin-bottom: 10px;">👨‍💻 Desarrollador</h2>
          <p style="margin: 0;">Gustavo Sánchez Rodríguez</p>
          <p style="margin: 0; font-size: 14px;">Universidad Cooperativa de Colombia</p>
          <p style="margin: 10px 0 0; font-size: 13px;">Proyecto interactivo educativo con Three.js</p>
          <p style="margin: 10px 0 0; font-size: 13px;">guswillsan@gmail.com</p>
          <button style="
            margin-top: 12px;
            padding: 6px 14px;
            font-size: 14px;
            background: #00fff7;
            color: black;
            border: none;
            border-radius: 6px;
            cursor: pointer;
          ">Cerrar</button>
        `

    const closeBtn = this.aboutContainer.querySelector('button')
    closeBtn.onclick = () => {
      this.aboutContainer.remove()
      this.aboutContainer = null
    }

    document.body.appendChild(this.aboutContainer)
  }




  toggleMenu() {
    this.isOpen = !this.isOpen

    this.actionButtons.forEach((btn, index) => {
      const delay = index * 0.05
      if (this.isOpen) {
        gsap.to(btn, {
          opacity: 1,
          y: 0,
          pointerEvents: 'auto',
          delay,
          duration: 0.3,
          ease: 'power2.out'
        })
      } else {
        gsap.to(btn, {
          opacity: 0,
          y: -10,
          pointerEvents: 'none',
          delay,
          duration: 0.2,
          ease: 'power2.in'
        })
      }
    })
  }

  setStatus(text) {
    if (this.status) this.status.innerText = text
  }

  setPoints(points, target) {
    if (!this.status) return
    this.status.innerText = typeof target === 'number' && target > 0
      ? `Puntos: ${points} / ${target}`
      : `Puntos: ${points}`
  }

  setLevel(level) {
    if (this.levelLabel) this.levelLabel.innerText = `Nivel: ${level}`
  }

  setHealth(health, maxHealth) {
    if (!this.healthHearts || !this.healthValue) return

    const max = Math.max(Number(maxHealth) || 1, 1)
    const current = Math.max(0, Math.min(Number(health) || 0, max))
    this.healthValue.innerText = `${Number.isInteger(current) ? current : current.toFixed(1)}/${max}`

    this.healthHearts.forEach((heart, index) => {
      const fillAmount = Math.max(0, Math.min(current - index, 1))
      const clip = heart.querySelector('.heart-fill-clip')
      if (clip) clip.setAttribute('width', `${24 * fillAmount}`)

      heart.style.opacity = fillAmount > 0 ? '1' : '0.55'
      heart.style.transform = fillAmount > 0 ? 'scale(1)' : 'scale(0.9)'
      heart.style.filter = fillAmount > 0 ? 'drop-shadow(0 0 4px rgba(239,68,68,0.65))' : 'none'
    })
  }

  setTimer(seconds) {
    if (this.timer) this.timer.innerText = `⏱ ${seconds}s`
  }

  //Contador jugadores
  setPlayerCount(count) {
    if (this.playersLabel) {
      this.playersLabel.innerText = `👥 Jugadores: ${count}`
    }
  }


  destroy() {
    this.toggleButton?.remove()
    this.actionButtons?.forEach(btn => btn.remove())
    this.timer?.remove()
    this.status?.remove()
    this.levelLabel?.remove()
    this.healthContainer?.remove()
  }
}
