// Experience/Utils/KeyboardControls.js
import EventEmitter from './EventEmitter.js'

export default class KeyboardControls extends EventEmitter {
    constructor() {
        super()

        this.keys = {
            up: false,
            down: false,
            left: false,
            right: false,
            space: false,
            r: false,
            shift: false
        }

        this.setListeners()
    }

    setListeners() {
        window.addEventListener('keydown', (event) => {
            if (event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W') this.keys.up = true
            if (event.key === 'ArrowDown' || event.key === 's' || event.key === 'S') this.keys.down = true
            if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') this.keys.left = true
            if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') this.keys.right = true
            if (event.code === 'Space') this.keys.space = true
            if (event.key.toLowerCase() === 'r') this.keys.r = true
            if (event.key === 'Shift') this.keys.shift = true
            this.trigger('change', this.keys)
        })

        window.addEventListener('keyup', (event) => {
            if (event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W') this.keys.up = false
            if (event.key === 'ArrowDown' || event.key === 's' || event.key === 'S') this.keys.down = false
            if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') this.keys.left = false
            if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') this.keys.right = false
            if (event.code === 'Space') this.keys.space = false
            if (event.key.toLowerCase() === 'r') this.keys.r = false
            if (event.key === 'Shift') this.keys.shift = false
            this.trigger('change', this.keys)
        })
    }

    getState() {
        return this.keys
    }
}
