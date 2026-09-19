import React, { useEffect, useRef, useState } from 'react'

export default function IntroAnimation({ onComplete }) {
  const canvasRef = useRef(null)
  const [stage, setStage] = useState(0)
  const [fadingOut, setFadingOut] = useState(false)

  useEffect(() => {
    // Check session storage to avoid repeating during internal navigation
    if (sessionStorage.getItem('vertex_intro_seen')) {
      onComplete()
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animationFrameId
    let startTime = performance.now()

    const width = (canvas.width = window.innerWidth)
    const height = (canvas.height = window.innerHeight)
    const cx = width / 2
    const cy = height / 2 - 30

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

      // Timeline sequence
      if (elapsed < 0.3) {
        setStage(0) // Black background
      } else if (elapsed < 0.7) {
        setStage(1) // Nodes appear
      } else if (elapsed < 1.2) {
        setStage(2) // Lines connect
      } else if (elapsed < 1.8) {
        setStage(3) // Converge & Title
      } else if (elapsed < 2.8) {
        setStage(4) // Subtitle & Morphing start
      } else if (elapsed < 3.2) {
        setFadingOut(true)
      } else {
        sessionStorage.setItem('vertex_intro_seen', 'true')
        onComplete()
        return
      }

      // Draw Connections (Stage 2+)
      if (elapsed >= 0.7) {
        ctx.lineWidth = 0.8
        for (let i = 0; i < numNodes; i++) {
          for (let j = i + 1; j < numNodes; j++) {
            const dx = nodes[i].x - nodes[j].x
            const dy = nodes[i].y - nodes[j].y
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist < 130) {
              const lineAlpha = (1 - dist / 130) * Math.min(1, (elapsed - 0.7) * 2) * 0.45
              ctx.strokeStyle = i % 3 === 0 ? `rgba(32, 201, 151, ${lineAlpha})` : `rgba(146, 156, 163, ${lineAlpha})`
              ctx.beginPath()
              ctx.moveTo(nodes[i].x, nodes[i].y)
              ctx.lineTo(nodes[j].x, nodes[j].y)
              ctx.stroke()
            }
          }
        }
      }

      // Draw Nodes (Stage 1+)
      if (elapsed >= 0.3) {
        nodes.forEach((node, i) => {
          node.alpha = Math.min(1, (elapsed - 0.3) * 2)

          // Convergence physics (Stage 3+)
          if (elapsed >= 1.2) {
            node.x += (node.targetX - node.x) * 0.05
            node.y += (node.targetY - node.y) * 0.05
          }

          ctx.fillStyle = i % 4 === 0 ? `rgba(32, 201, 151, ${node.alpha})` : `rgba(233, 238, 241, ${node.alpha})`
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
        transition: 'opacity 0.5s ease-out',
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
          transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 46,
            fontWeight: 700,
            letterSpacing: '0.22em',
            color: 'var(--text-primary)',
            marginBottom: 6,
            textShadow: '0 0 35px rgba(32, 201, 151, 0.35)',
          }}
        >
          VERTEX
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: '0.14em',
            color: 'var(--accent-emerald)',
            textTransform: 'uppercase',
            marginBottom: 20,
          }}
        >
          GRAPH CREDIT INTELLIGENCE
        </p>
        <p
          style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            letterSpacing: '0.06em',
            opacity: stage >= 4 ? 1 : 0,
            transition: 'opacity 0.5s ease',
          }}
        >
          Privacy-Preserving AI for DeFi Credit Risk
        </p>
      </div>
    </div>
  )
}
