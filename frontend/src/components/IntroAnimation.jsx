import React, { useEffect, useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// VERTEX intro - slowed down (~7 s) and fully titanium/silver.
// Nodes condense into a natural graph, the wordmark settles in, then the
// overlay fades and hands over to the live 3D graph.
// ---------------------------------------------------------------------------

export default function IntroAnimation({ onComplete }) {
  const canvasRef = useRef(null)
  const [stage, setStage] = useState(0)
  const [fadingOut, setFadingOut] = useState(false)

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

    const width = (canvas.width = window.innerWidth)
    const height = (canvas.height = window.innerHeight)
    const cx = width / 2
    const cy = height / 2 - 30

    // slower timeline (seconds):
    // 0.0-0.9 black -> 0.9-2.0 nodes appear -> 2.0-3.4 links ->
    // 3.4-4.6 converge + title -> 4.6-6.4 subtitle -> 6.4-7.0 fade
    const T_NODES = 0.9
    const T_LINKS = 2.0
    const T_CONVERGE = 3.4
    const T_SUBTITLE = 4.6
    const T_FADE = 6.4

    const numNodes = 40
    const nodes = []
    for (let i = 0; i < numNodes; i++) {
      const angle = (i / numNodes) * Math.PI * 2
      const radius = 120 + Math.random() * 220
      nodes.push({
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        targetX: cx + Math.cos(angle) * (100 + (i % 4) * 35),
        targetY: cy + Math.sin(angle) * (100 + (i % 4) * 35),
        size: i % 5 === 0 ? 4 : 2.5,
        alpha: 0,
      })
    }

    const render = (time) => {
      const elapsed = (time - startTime) / 1000

      ctx.fillStyle = '#080A0C'
      ctx.fillRect(0, 0, width, height)

      if (elapsed < T_NODES) {
        setStage(0)
      } else if (elapsed < T_LINKS) {
        setStage(1)
      } else if (elapsed < T_CONVERGE) {
        setStage(2)
      } else if (elapsed < T_SUBTITLE) {
        setStage(3)
      } else if (elapsed < T_FADE) {
        setStage(4)
      } else if (elapsed < T_FADE + 0.6) {
        setFadingOut(true)
      } else {
        sessionStorage.setItem('vertex_intro_seen', 'true')
        onComplete()
        return
      }

      // links - all silver/titanium
      if (elapsed >= T_LINKS) {
        ctx.lineWidth = 0.8
        for (let i = 0; i < numNodes; i++) {
          for (let j = i + 1; j < numNodes; j++) {
            const dx = nodes[i].x - nodes[j].x
            const dy = nodes[i].y - nodes[j].y
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist < 130) {
              const lineAlpha =
                (1 - dist / 130) *
                Math.min(1, (elapsed - T_LINKS) * 1.4) *
                0.45
              ctx.strokeStyle =
                i % 3 === 0
                  ? `rgba(201, 210, 217, ${lineAlpha})`
                  : `rgba(146, 156, 163, ${lineAlpha})`
              ctx.beginPath()
              ctx.moveTo(nodes[i].x, nodes[i].y)
              ctx.lineTo(nodes[j].x, nodes[j].y)
              ctx.stroke()
            }
          }
        }
      }

      // nodes - silver, with a few bright platinum hubs
      if (elapsed >= T_NODES) {
        nodes.forEach((node, i) => {
          node.alpha = Math.min(1, (elapsed - T_NODES) * 1.4)

          if (elapsed >= T_CONVERGE) {
            node.x += (node.targetX - node.x) * 0.045
            node.y += (node.targetY - node.y) * 0.045
          }

          ctx.fillStyle =
            i % 4 === 0
              ? `rgba(242, 246, 249, ${node.alpha})`
              : `rgba(201, 210, 217, ${node.alpha})`
          ctx.beginPath()
          ctx.arc(node.x, node.y, node.size, 0, Math.PI * 2)
          ctx.fill()
        })
      }

      animationFrameId = requestAnimationFrame(render)
    }

    animationFrameId = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animationFrameId)
  }, [onComplete])

  return (
    <div
      className="intro-overlay"
      style={{
        opacity: fadingOut ? 0 : 1,
        transition: 'opacity 0.6s ease-out',
        pointerEvents: fadingOut ? 'none' : 'auto',
      }}
    >
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0 }} />

      <div
        style={{
          position: 'relative',
          zIndex: 10,
          textAlign: 'center',
          marginTop: 180,
          opacity: stage >= 3 ? 1 : 0,
          transform: stage >= 3 ? 'translateY(0)' : 'translateY(10px)',
          transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 52,
            fontWeight: 700,
            letterSpacing: '0.24em',
            color: 'var(--text-primary)',
            marginBottom: 8,
            textShadow: '0 0 38px rgba(201, 210, 217, 0.35)',
          }}
        >
          VERTEX
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: '0.16em',
            color: 'var(--text-silver)',
            textTransform: 'uppercase',
            marginBottom: 20,
          }}
        >
          Graph Credit Intelligence
        </p>
        <p
          style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            letterSpacing: '0.06em',
            opacity: stage >= 4 ? 1 : 0,
            transition: 'opacity 0.6s ease',
          }}
        >
          Privacy-Preserving AI for DeFi Credit Risk
        </p>
      </div>
    </div>
  )
}
