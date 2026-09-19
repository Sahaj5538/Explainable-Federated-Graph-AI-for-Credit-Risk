import React, { useEffect, useRef, useState } from 'react'

export default function IntroAnimation({ onComplete }) {
  const canvasRef = useRef(null)
  const [stage, setStage] = useState(0) // 0: Nodes, 1: Connections, 2: V formation, 3: Text fade, 4: Done

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animationFrameId
    let startTime = performance.now()

    const width = (canvas.width = window.innerWidth)
    const height = (canvas.height = window.innerHeight)
    const cx = width / 2
    const cy = height / 2 - 40

    // Node set
    const numNodes = 45
    const nodes = []
    for (let i = 0; i < numNodes; i++) {
      const angle = Math.random() * Math.PI * 2
      const radius = 100 + Math.random() * 250
      nodes.push({
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        targetX: cx + (Math.random() - 0.5) * 180,
        targetY: cy + (Math.random() - 0.5) * 180,
        // Stylized V shape targets
        vX: i % 2 === 0 ? cx - 80 + (i / numNodes) * 80 : cx + (i / numNodes) * 80,
        vY: cy - 60 + (i / numNodes) * 120,
        size: Math.random() * 2.5 + 2,
        alpha: 0,
      })
    }

    const render = (time) => {
      const elapsed = (time - startTime) / 1000

      ctx.fillStyle = '#080A0C'
      ctx.fillRect(0, 0, width, height)

      // Stage progression
      if (elapsed < 1.0) {
        setStage(0) // Node birth
      } else if (elapsed < 2.2) {
        setStage(1) // Connections
      } else if (elapsed < 3.8) {
        setStage(2) // Converge into V
      } else if (elapsed < 4.8) {
        setStage(3) // Text display
      } else {
        setStage(4)
        onComplete()
        return
      }

      // Draw Connections
      if (stage >= 1) {
        ctx.lineWidth = 0.8
        for (let i = 0; i < numNodes; i++) {
          for (let j = i + 1; j < numNodes; j++) {
            const dx = nodes[i].x - nodes[j].x
            const dy = nodes[i].y - nodes[j].y
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist < 110) {
              const alpha = (1 - dist / 110) * (stage >= 2 ? 0.2 : 0.4)
              ctx.strokeStyle = i % 3 === 0 ? `rgba(32, 201, 151, ${alpha})` : `rgba(41, 49, 56, ${alpha})`
              ctx.beginPath()
              ctx.moveTo(nodes[i].x, nodes[i].y)
              ctx.lineTo(nodes[j].x, nodes[j].y)
              ctx.stroke()
            }
          }
        }
      }

      // Draw Nodes
      nodes.forEach((node, i) => {
        if (stage === 0) {
          node.alpha = Math.min(1, elapsed * 1.5)
        } else if (stage === 2) {
          // Move towards V target
          node.x += (node.vX - node.x) * 0.08
          node.y += (node.vY - node.y) * 0.08
        }

        ctx.fillStyle = i % 4 === 0 ? `rgba(32, 201, 151, ${node.alpha})` : `rgba(233, 238, 241, ${node.alpha})`
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.size, 0, Math.PI * 2)
        ctx.fill()
      })

      animationFrameId = requestAnimationFrame(render)
    }

    animationFrameId = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animationFrameId)
  }, [onComplete, stage])

  return (
    <div className="intro-overlay">
      <button className="btn btn-ghost btn-sm intro-skip-btn" onClick={onComplete}>
        Skip Intro →
      </button>

      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0 }} />

      <div
        style={{
          position: 'relative',
          zIndex: 10,
          textAlign: 'center',
          marginTop: 180,
          opacity: stage >= 2 ? 1 : 0,
          transition: 'opacity 0.8s ease',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 48,
            fontWeight: 700,
            letterSpacing: '0.25em',
            color: 'var(--text-primary)',
            marginBottom: 8,
            textShadow: '0 0 30px rgba(32, 201, 151, 0.4)',
          }}
        >
          VERTEX
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: '0.15em',
            color: 'var(--accent-emerald)',
            textTransform: 'uppercase',
            marginBottom: 24,
          }}
        >
          GRAPH CREDIT INTELLIGENCE
        </p>
        <p
          style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            letterSpacing: '0.08em',
          }}
        >
          Privacy • Explainability • Federation • DeFi
        </p>
      </div>
    </div>
  )
}
