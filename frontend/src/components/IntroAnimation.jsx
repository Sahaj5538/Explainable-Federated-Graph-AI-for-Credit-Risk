import React, { useEffect, useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// VERTEX intro - FAST GRAPH + AUTO DASHBOARD
// 
// User feedback: "after name VERTEX came it should go to dashboard"
// Old timeline was 7.2s with Skip button visible after title - felt like
// you had to click Skip to continue.
// 
// New timeline ~3.8s total, auto goes to dashboard right after VERTEX:
// 0.0-0.3s nodes appear
// 0.3-0.8s links + converge
// 0.8-1.6s V blooms + letters (graph still animating behind)
// 1.6-2.4s subtitle
// 2.4-3.0s zoom out to dashboard
// No prominent Skip button - auto flows, but pressing Esc or clicking still skips
// ---------------------------------------------------------------------------

const LETTERS = ['E', 'R', 'T', 'E', 'X']

export default function IntroAnimation({ onComplete }) {
  const canvasRef = useRef(null)
  const [exit, setExit] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem('vertex_intro_seen')) {
      onComplete()
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animationFrameId
    const startTime = performance.now()

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width = window.innerWidth + 'px'
      canvas.style.height = window.innerHeight + 'px'
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.scale(dpr, dpr)
    }
    resize()
    window.addEventListener('resize', resize)

    const W = () => window.innerWidth
    const H = () => window.innerHeight
    const cx = () => W() / 2
    const cy = () => H() / 2 - 30

    // FAST timeline
    const T_NODES = 0.15
    const T_LINKS = 0.45
    const T_CONVERGE = 0.75
    const T_EXIT = 2.6
    const T_DONE = 3.6

    const numNodes = 42
    const nodes = []
    for (let i = 0; i < numNodes; i++) {
      const angle = (i / numNodes) * Math.PI * 2 + (Math.random() - 0.5) * 0.4
      const radius = 140 + Math.random() * 280
      const targetRadius = 60 + (i % 5) * 28 + Math.random() * 14
      const targetAngle = angle + (Math.random() - 0.5) * 0.5
      nodes.push({
        x: cx() + Math.cos(angle) * radius,
        y: cy() + Math.sin(angle) * radius,
        targetX: cx() + Math.cos(targetAngle) * targetRadius,
        targetY: cy() + Math.sin(targetAngle) * targetRadius,
        size: i % 6 === 0 ? 4 : i % 3 === 0 ? 3 : 2,
        alpha: 0,
        isHub: i % 6 === 0,
        vx: 0,
        vy: 0,
      })
    }

    const render = (time) => {
      const elapsed = (time - startTime) / 1000
      const w = W()
      const h = H()

      if (elapsed >= T_EXIT && !exit) setExit(true)
      if (elapsed >= T_DONE) {
        sessionStorage.setItem('vertex_intro_seen', 'true')
        onComplete()
        return
      }

      ctx.fillStyle = '#080A0C'
      ctx.fillRect(0, 0, w, h)

      const gradient = ctx.createRadialGradient(cx(), cy(), 0, cx(), cy(), 380)
      gradient.addColorStop(0, 'rgba(201,210,217,0.035)')
      gradient.addColorStop(1, 'transparent')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, w, h)

      // Links
      if (elapsed >= T_LINKS) {
        const prog = Math.min(1, (elapsed - T_LINKS) / 0.5)
        for (let i = 0; i < numNodes; i++) {
          for (let j = i + 1; j < numNodes; j++) {
            const dx = nodes[i].x - nodes[j].x
            const dy = nodes[i].y - nodes[j].y
            const dist = Math.sqrt(dx * dx + dy * dy)
            const maxD = nodes[i].isHub || nodes[j].isHub ? 150 : 110
            if (dist < maxD) {
              const a = (1 - dist / maxD) * prog * 0.35
              ctx.strokeStyle = nodes[i].isHub || nodes[j].isHub ? `rgba(242,246,249,${a * 1.1})` : `rgba(201,210,217,${a})`
              ctx.lineWidth = nodes[i].isHub || nodes[j].isHub ? 1 : 0.6
              ctx.beginPath()
              ctx.moveTo(nodes[i].x, nodes[i].y)
              ctx.lineTo(nodes[j].x, nodes[j].y)
              ctx.stroke()
            }
          }
        }
      }

      // Nodes
      if (elapsed >= T_NODES) {
        nodes.forEach((n) => {
          n.alpha = Math.min(1, (elapsed - T_NODES) * 2.2)
          if (elapsed >= T_CONVERGE) {
            const dx = n.targetX - n.x
            const dy = n.targetY - n.y
            n.vx = n.vx * 0.9 + dx * 0.055
            n.vy = n.vy * 0.9 + dy * 0.055
            n.x += n.vx
            n.y += n.vy
          } else {
            const dx = cx() - n.x
            const dy = cy() - n.y
            n.x += dx * 0.006
            n.y += dy * 0.006
          }
          if (n.isHub) {
            ctx.shadowColor = 'rgba(201,210,217,0.35)'
            ctx.shadowBlur = 10
          } else ctx.shadowBlur = 0
          ctx.fillStyle = n.isHub ? `rgba(242,246,249,${n.alpha})` : `rgba(201,210,217,${n.alpha * 0.85})`
          ctx.beginPath()
          ctx.arc(n.x, n.y, n.size, 0, Math.PI * 2)
          ctx.fill()
          ctx.shadowBlur = 0
        })
      }

      // Central core
      if (elapsed >= T_CONVERGE) {
        const pulse = Math.sin(elapsed * 3) * 0.12 + 0.88
        ctx.fillStyle = `rgba(242,246,249,${0.07 * pulse})`
        ctx.beginPath()
        ctx.arc(cx(), cy(), 20 * pulse, 0, Math.PI * 2)
        ctx.fill()
      }

      animationFrameId = requestAnimationFrame(render)
    }

    animationFrameId = requestAnimationFrame(render)

    const onKey = (e) => {
      if (e.key === 'Escape') {
        sessionStorage.setItem('vertex_intro_seen', 'true')
        onComplete()
      }
    }
    window.addEventListener('keydown', onKey)

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', resize)
      window.removeEventListener('keydown', onKey)
    }
  }, [onComplete, exit])

  // Click anywhere to skip (no visible button needed)
  const skip = () => {
    sessionStorage.setItem('vertex_intro_seen', 'true')
    onComplete()
  }

  return (
    <div className={`intro2 intro-graph intro-fast ${exit ? 'intro2-exit' : ''}`} aria-hidden="true" onClick={skip} style={{ cursor: 'pointer' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

      {/* Center lockup */}
      <div className="intro2-lockup" style={{ position: 'relative', zIndex: 10, pointerEvents: 'none' }}>
        <div className="intro2-word">
          <span className="intro2-v">V</span>
          {LETTERS.map((l, i) => (
            <span key={i} className="intro2-l" style={{ animationDelay: `${0.45 + i * 0.09}s` }}>
              {l}
            </span>
          ))}
          <span className="intro2-sweep" />
        </div>
        <div className="intro2-rule" />
        <div className="intro2-sub">Graph Credit Intelligence</div>
        <div className="intro2-tag">Privacy-Preserving AI for DeFi</div>
      </div>

      {/* Tiny hint - auto dismiss, not a button */}
      <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', fontSize: 10, color: '#2A3138', letterSpacing: '0.1em', zIndex: 10, pointerEvents: 'none', opacity: exit ? 0 : 0.5 }}>
        click or press Esc to skip • auto-enters dashboard
      </div>
    </div>
  )
}
