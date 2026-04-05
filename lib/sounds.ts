'use client'

// Ambient sound design using Web Audio API
// Generates subtle UI sounds without requiring audio files

class SoundEngine {
  private ctx: AudioContext | null = null
  private enabled = true

  private getContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext()
    }
    return this.ctx
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
  }

  isEnabled() {
    return this.enabled
  }

  // Subtle click sound for UI interactions
  click() {
    if (!this.enabled) return
    try {
      const ctx = this.getContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      
      osc.connect(gain)
      gain.connect(ctx.destination)
      
      osc.frequency.setValueAtTime(800, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.05)
      
      gain.gain.setValueAtTime(0.03, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05)
      
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.05)
    } catch {}
  }

  // Success chime
  success() {
    if (!this.enabled) return
    try {
      const ctx = this.getContext()
      const notes = [523.25, 659.25, 783.99] // C5, E5, G5

      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        
        osc.type = 'sine'
        osc.connect(gain)
        gain.connect(ctx.destination)
        
        const time = ctx.currentTime + i * 0.12
        osc.frequency.setValueAtTime(freq, time)
        
        gain.gain.setValueAtTime(0, time)
        gain.gain.linearRampToValueAtTime(0.04, time + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3)
        
        osc.start(time)
        osc.stop(time + 0.3)
      })
    } catch {}
  }

  // Soft processing hum
  processingStart() {
    if (!this.enabled) return
    try {
      const ctx = this.getContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      
      osc.type = 'sine'
      osc.connect(gain)
      gain.connect(ctx.destination)
      
      osc.frequency.setValueAtTime(220, ctx.currentTime)
      osc.frequency.linearRampToValueAtTime(330, ctx.currentTime + 0.3)
      
      gain.gain.setValueAtTime(0, ctx.currentTime)
      gain.gain.linearRampToValueAtTime(0.02, ctx.currentTime + 0.1)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
      
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.5)
    } catch {}
  }

  // Step complete notification
  stepComplete() {
    if (!this.enabled) return
    try {
      const ctx = this.getContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      
      osc.type = 'sine'
      osc.connect(gain)
      gain.connect(ctx.destination)
      
      osc.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
      
      gain.gain.setValueAtTime(0, ctx.currentTime)
      gain.gain.linearRampToValueAtTime(0.03, ctx.currentTime + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
      
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.15)
    } catch {}
  }

  // Voice activation sound
  voiceActivate() {
    if (!this.enabled) return
    try {
      const ctx = this.getContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      
      osc.type = 'sine'
      osc.connect(gain)
      gain.connect(ctx.destination)
      
      osc.frequency.setValueAtTime(440, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15)
      
      gain.gain.setValueAtTime(0, ctx.currentTime)
      gain.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 0.05)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2)
      
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.2)
    } catch {}
  }

  // Alert/warning sound
  alert() {
    if (!this.enabled) return
    try {
      const ctx = this.getContext()
      
      for (let i = 0; i < 2; i++) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        
        osc.type = 'sine'
        osc.connect(gain)
        gain.connect(ctx.destination)
        
        const time = ctx.currentTime + i * 0.15
        osc.frequency.setValueAtTime(440, time)
        
        gain.gain.setValueAtTime(0, time)
        gain.gain.linearRampToValueAtTime(0.03, time + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1)
        
        osc.start(time)
        osc.stop(time + 0.1)
      }
    } catch {}
  }
}

// Singleton instance
export const soundEngine = typeof window !== 'undefined' ? new SoundEngine() : null
