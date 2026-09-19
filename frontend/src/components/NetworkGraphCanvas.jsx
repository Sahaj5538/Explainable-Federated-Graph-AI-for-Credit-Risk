import React, { useEffect, useRef, useState } from 'react'
import { ZoomIn, ZoomOut, RotateCcw, Filter, Eye, ShieldAlert, BrainCircuit } from 'lucide-react'
import { api, shortenAddress, pct } from '../api.js'

export default function NetworkGraphCanvas({
  onSelectAccount,
  onNavigateTab,
  height = 540,
  interactive = true,
  riskFilter = 'all',
}) {
  const canvasRef = useRef(null)
  const [nodes, setNodes] = useState([])
  const [edges, setEdges] = useState([])
  const [selectedNode, setSelectedNode] = useState(null)
  const [hoveredNode, setHoveredNode] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Load real account data from backend
  useEffect(() => {
    setLoading(true)
    api.accounts({ page: 1, page_size: 120 })
      .then((data) => {
        const rawAccounts = data.accounts || []

        // Fixed protocols
        const protocolNodes = [
          { id: 'proto-1', name: 'AaveLike (Lending)', type: 'protocol', x: 0, y: 0, risk: 'LOW' },
          { id: 'proto-2', name: 'CompoundLike (Lending)', type: 'protocol', x: 0, y: 0, risk: 'LOW' },
          { id: 'proto-3', name: 'UniswapLike (DEX)', type: 'protocol', x: 0, y: 0, risk: 'LOW' },
          { id: 'proto-4', name: 'MakerLike (Lending)', type: 'protocol', x: 0, y: 0, risk: 'LOW' },
        ]

        // Position nodes in radial force layout
        const total = rawAccounts.length
        const processedNodes = rawAccounts.map((acc, index) => {
          const angle = (index / total) * Math.PI * 2
          const dist = 140 + (index % 5) * 45 + Math.random() * 30
          return {
            ...acc,
            id: acc.account_id,
            type: 'account',
            x: Math.cos(angle) * dist,
            y: Math.sin(angle) * dist,
            radius: acc.prediction === 'HIGH RISK' ? 7 : 5.5,
          }
        })

        // Position protocols near center
        protocolNodes[0].x = -90
        protocolNodes[0].y = -90
        protocolNodes[1].x = 90
        protocolNodes[1].y = -90
        protocolNodes[2].x = -90
        protocolNodes[2].y = 90
        protocolNodes[3].x = 90
        protocolNodes[3].y = 90

        const allNodes = [...protocolNodes, ...processedNodes]

        // Create transaction edges between counterparties and protocols
        const generatedEdges = []
        processedNodes.forEach((node, i) => {
          // Protocol connection
          const protoIndex = i % 4
          generatedEdges.push({
            source: node.id,
            target: protocolNodes[protoIndex].id,
            type: 'protocol',
          })

          // Neighbor connection
          if (i > 0 && i % 3 === 0) {
            generatedEdges.push({
              source: node.id,
              target: processedNodes[i - 1].id,
              type: 'account',
            })
          }
        })

        setNodes(allNodes)
        setEdges(generatedEdges)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  // Canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animationId

    const width = (canvas.width = canvas.parentElement.clientWidth || 800)
    const heightVal = (canvas.height = height)
    const cx = width / 2 + pan.x
    const cy = heightVal / 2 + pan.y

    const draw = () => {
      ctx.clearRect(0, 0, width, heightVal)

      // Background grid
      ctx.strokeStyle = '#12161A'
      ctx.lineWidth = 1
      const gridSize = 40 * zoom
      for (let x = (pan.x % gridSize); x < width; x += gridSize) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, heightVal)
        ctx.stroke()
      }
      for (let y = (pan.y % gridSize); y < heightVal; y += gridSize) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      }

      // Filter nodes by risk filter setting
      const filteredNodeIds = new Set(
        nodes
          .filter((n) => {
            if (riskFilter === 'all') return true
            if (riskFilter === 'high') return n.prediction === 'HIGH RISK'
            if (riskFilter === 'low') return n.prediction === 'LOW RISK'
            if (riskFilter === 'protocol') return n.type === 'protocol'
            return true
          })
          .map((n) => n.id)
      )

      // Draw Edges
      edges.forEach((edge) => {
        if (!filteredNodeIds.has(edge.source) || !filteredNodeIds.has(edge.target)) return
        const sourceNode = nodes.find((n) => n.id === edge.source)
        const targetNode = nodes.find((n) => n.id === edge.target)
        if (!sourceNode || !targetNode) return

        const isSelected = selectedNode && (selectedNode.id === sourceNode.id || selectedNode.id === targetNode.id)
        const sx = cx + sourceNode.x * zoom
        const sy = cy + sourceNode.y * zoom
        const tx = cx + targetNode.x * zoom
        const ty = cy + targetNode.y * zoom

        ctx.beginPath()
        ctx.moveTo(sx, sy)
        ctx.lineTo(tx, ty)
        if (isSelected) {
          ctx.strokeStyle = '#20C997'
          ctx.lineWidth = 2 * zoom
        } else {
          ctx.strokeStyle = selectedNode ? 'rgba(41, 49, 56, 0.2)' : 'rgba(41, 49, 56, 0.6)'
          ctx.lineWidth = 0.8 * zoom
        }
        ctx.stroke()
      })

      // Draw Nodes
      nodes.forEach((node) => {
        if (!filteredNodeIds.has(node.id)) return
        const nx = cx + node.x * zoom
        const ny = cy + node.y * zoom
        const isSelected = selectedNode?.id === node.id
        const isHovered = hoveredNode?.id === node.id
        const isNeighbor =
          selectedNode &&
          edges.some(
            (e) =>
              (e.source === selectedNode.id && e.target === node.id) ||
              (e.target === selectedNode.id && e.source === node.id)
          )

        const r = (node.radius || 6) * zoom * (isHovered || isSelected ? 1.4 : 1)

        // Dim non-relatives when node selected
        const isDimmed = selectedNode && !isSelected && !isNeighbor

        ctx.save()
        ctx.globalAlpha = isDimmed ? 0.2 : 1.0

        ctx.beginPath()
        ctx.arc(nx, ny, r, 0, Math.PI * 2)

        if (node.type === 'protocol') {
          ctx.fillStyle = '#9277D8'
          ctx.shadowColor = '#9277D8'
          ctx.shadowBlur = 10
        } else if (node.prediction === 'HIGH RISK') {
          ctx.fillStyle = '#E05A5A'
          ctx.shadowColor = '#E05A5A'
          ctx.shadowBlur = isSelected ? 20 : 8
        } else {
          ctx.fillStyle = '#20C997'
          ctx.shadowColor = '#20C997'
          ctx.shadowBlur = isSelected ? 20 : 5
        }

        ctx.fill()

        if (isSelected || isHovered) {
          ctx.lineWidth = 2.5
          ctx.strokeStyle = '#E9EEF1'
          ctx.stroke()
        }

        ctx.restore()
      })

      animationId = requestAnimationFrame(draw)
    }

    animationId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animationId)
  }, [nodes, edges, selectedNode, hoveredNode, zoom, pan, height, riskFilter])

  // Click & hover mouse interaction
  const handleMouseDown = (e) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
      return
    }

    if (!interactive) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const cx = canvas.width / 2 + pan.x
    const cy = height / 2 + pan.y

    const found = nodes.find((node) => {
      const nx = cx + node.x * zoom
      const ny = cy + node.y * zoom
      const dist = Math.sqrt((mx - nx) ** 2 + (my - ny) ** 2)
      return dist <= (node.radius || 6) * zoom * 1.8
    })

    setHoveredNode(found || null)
  }

  const handleMouseUp = () => setIsDragging(false)

  const handleClick = (e) => {
    if (!interactive) return
    if (hoveredNode) {
      setSelectedNode(hoveredNode)
    } else {
      setSelectedNode(null)
    }
  }

  if (loading) return <div className="loading-state"><div className="spinner-ring" /><span>Loading Graph Topology…</span></div>
  if (error) return <div className="error">Graph load failed: {error}</div>

  return (
    <div style={{ position: 'relative', width: '100%', height, overflow: 'hidden', borderRadius: 'var(--radius-lg)' }}>
      {/* Controls Bar */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 20,
          display: 'flex',
          gap: 8,
          backgroundColor: 'rgba(23, 28, 33, 0.85)',
          backdropFilter: 'blur(8px)',
          padding: 6,
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-main)',
        }}
      >
        <button className="btn btn-ghost btn-sm" onClick={() => setZoom((z) => Math.min(z * 1.25, 3))} title="Zoom In">
          <ZoomIn size={16} />
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => setZoom((z) => Math.max(z / 1.25, 0.4))} title="Zoom Out">
          <ZoomOut size={16} />
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); setSelectedNode(null) }} title="Reset View">
          <RotateCcw size={16} />
        </button>
      </div>

      {/* Legend Overlay */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          zIndex: 20,
          display: 'flex',
          gap: 16,
          backgroundColor: 'rgba(23, 28, 33, 0.85)',
          backdropFilter: 'blur(8px)',
          padding: '8px 16px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-main)',
          fontSize: 12,
          color: 'var(--text-secondary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#20C997', display: 'inline-block' }} />
          <span>Low Risk Wallet</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#E05A5A', display: 'inline-block' }} />
          <span>High Risk Wallet</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#9277D8', display: 'inline-block' }} />
          <span>DeFi Protocol</span>
        </div>
      </div>

      {/* Selected Node Details Panel */}
      {selectedNode && selectedNode.type === 'account' && (
        <div
          style={{
            position: 'absolute',
            top: 16,
            left: 16,
            width: 310,
            zIndex: 30,
            backgroundColor: 'var(--titanium-card)',
            border: '1px solid var(--border-bright)',
            borderRadius: 'var(--radius-lg)',
            padding: 20,
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
              Selected Wallet Node
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedNode(null)}>✕</button>
          </div>

          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
            Account #{selectedNode.account_id}
          </div>
          <div className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14 }}>
            {shortenAddress(selectedNode.wallet)}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', backgroundColor: 'var(--obsidian-deep)', borderRadius: 'var(--radius-md)', marginBottom: 14 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Risk Score</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: selectedNode.prediction === 'HIGH RISK' ? 'var(--risk-high)' : 'var(--risk-low)' }}>
              {pct(selectedNode.high_risk_probability)}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
            <button
              className="btn btn-primary btn-sm"
              style={{ width: '100%' }}
              onClick={() => onSelectAccount && onSelectAccount(selectedNode.account_id)}
            >
              <Eye size={14} /> View Full Inspection
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-sm"
                style={{ flex: 1 }}
                onClick={() => onNavigateTab && onNavigateTab('risk')}
              >
                <ShieldAlert size={14} /> Predict
              </button>
              <button
                className="btn btn-sm"
                style={{ flex: 1 }}
                onClick={() => onNavigateTab && onNavigateTab('explainability')}
              >
                <BrainCircuit size={14} /> Explain
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Canvas Element */}
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', cursor: isDragging ? 'grabbing' : 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
      />
    </div>
  )
}
