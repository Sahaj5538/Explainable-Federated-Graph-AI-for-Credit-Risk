import React, { useEffect, useRef, useState } from 'react'
import ForceGraph3D from '3d-force-graph'
import * as THREE from 'three'
import { getNetwork } from '../api.js'
import { pct } from '../api.js'
import { riskBand } from '../labels.js'

// ---------------------------------------------------------------------------
// GRAPH STAGE - the hero of VERTEX.
//
// One persistent 3D force-directed graph for the whole app:
//   * dashboard  -> "hero" mode: fully interactive. Drag to rotate, scroll to
//                   zoom (both damped = smooth), click an account to inspect.
//   * other view -> "background" mode: translucent, slowly auto-rotating,
//                   pointer-events off, the page content floats above it.
//
// STATIC LAYOUT, INTERACTIVE CAMERA
//   The force simulation runs once and settles (cooldown), then node positions
//   freeze - the graph becomes a calm, static 3D object. Node dragging is off
//   so it never re-heats. All interaction happens through the camera.
//
// NODE LOOK
//   * accounts  -> spheres, coloured continuously by risk probability
//                  (dark titanium = safe ... bright platinum = risky)
//   * protocols -> LARGE bright diamonds with a wireframe shell and an
//                  always-visible name label - impossible to miss or confuse
//                  with accounts.
//
// INTERACTION <-> LABELS
//   While the user is actively rotating / zooming / clicking, onUserInteraction
//   (true) fires; ~1.6 s after the last gesture it fires (false) so the
//   dashboard overlay can fade out and back in smoothly.
// ---------------------------------------------------------------------------

const RISK_LOW_COLOR = new THREE.Color('#39424D')
const RISK_HIGH_COLOR = new THREE.Color('#F2F6F9')

function protocolLabelSprite(name) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  ctx.font = '600 30px "Space Grotesk", "Segoe UI", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(8, 10, 12, 0.9)'
  ctx.shadowBlur = 8
  ctx.fillStyle = '#F2F6F9'
  ctx.fillText(name.toUpperCase(), 128, 34)
  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearFilter
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false })
  )
  sprite.scale.set(42, 10.5, 1)
  return sprite
}

export default function GraphStage({
  mode = 'hero',
  filter = 'all',
  onSelectAccount,
  onUserInteraction,
}) {
  const containerRef = useRef(null)
  const graphRef = useRef(null)
  const meshesRef = useRef(new Map())
  const selectRef = useRef(onSelectAccount)
  const interactRef = useRef(onUserInteraction)
  selectRef.current = onSelectAccount
  interactRef.current = onUserInteraction

  const [ready, setReady] = useState(false)

  // ---- build the graph once -------------------------------------------
  useEffect(() => {
    let graph = null
    let cancelled = false
    let idleTimer = null

    getNetwork().then((net) => {
      if (cancelled || !containerRef.current) return

      const nodes = []
      const links = []

      net.accounts.forEach((a) => {
        nodes.push({
          id: `a${a.id}`,
          type: 'account',
          accountId: a.id,
          risk: a.risk,
          probability: a.probability,
          client: a.client,
        })
      })

      net.protocols.forEach((name, i) => {
        nodes.push({ id: `p${i}`, type: 'protocol', name })
      })

      net.account_links.forEach(([s, t]) => {
        links.push({ source: `a${net.accounts[s].id}`, target: `a${net.accounts[t].id}`, kind: 'aa' })
      })

      net.protocol_links.forEach(([s, t]) => {
        links.push({ source: `a${net.accounts[s].id}`, target: `p${t}`, kind: 'ap' })
      })

      const sphereGeo = new THREE.SphereGeometry(1.7, 12, 12)
      const diamondGeo = new THREE.OctahedronGeometry(7.5, 0)
      const shellGeo = new THREE.OctahedronGeometry(11.5, 0)
      const diamondMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color('#F2F6F9'),
        emissive: new THREE.Color('#C9D2D9'),
        emissiveIntensity: 0.5,
        roughness: 0.25,
        metalness: 0.9,
      })
      const shellMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color('#C9D2D9'),
        wireframe: true,
        transparent: true,
        opacity: 0.35,
      })

      graph = new ForceGraph3D(containerRef.current, { controlType: 'orbit' })
        .graphData({ nodes, links })
        .backgroundColor('rgba(0,0,0,0)')
        .showNavInfo(false)
        .nodeLabel((node) =>
          node.type === 'protocol'
            ? `${node.name} — lending protocol`
            : `Account #${node.accountId} · ${riskBand(node.probability).label} · risk ${pct(node.probability)} · ${node.client}`
        )
        .nodeThreeObject((node) => {
          if (node.type === 'protocol') {
            const group = new THREE.Group()
            group.add(new THREE.Mesh(diamondGeo, diamondMat))
            group.add(new THREE.Mesh(shellGeo, shellMat))
            const label = protocolLabelSprite(node.name)
            label.position.set(0, 15, 0)
            group.add(label)
            meshesRef.current.set(node.id, group)
            return group
          }
          const p = node.probability || 0
          const color = RISK_LOW_COLOR.clone().lerp(RISK_HIGH_COLOR, Math.pow(p, 0.75))
          const mesh = new THREE.Mesh(
            sphereGeo,
            new THREE.MeshStandardMaterial({
              color,
              emissive: color,
              emissiveIntensity: 0.05 + p * 0.55,
              roughness: 0.35,
              metalness: 0.85,
            })
          )
          meshesRef.current.set(node.id, mesh)
          return mesh
        })
        .linkColor(() => 'rgba(146, 156, 163, 1)')
        .linkOpacity(0.07)
        .linkWidth(0)
        .enableNodeDrag(false)
        .cooldownTime(7000)
        .d3VelocityDecay(0.35)
        .onNodeClick((node) => {
          if (node.type === 'account' && selectRef.current) {
            selectRef.current(node.accountId)
          }
        })
        .cameraPosition({ z: 520 })

      // ---- smooth damped camera (rotate + zoom) -----------------------
      const controls = graph.controls()
      controls.enableDamping = true
      controls.dampingFactor = 0.06
      controls.rotateSpeed = 0.55
      controls.zoomSpeed = 0.8
      controls.minDistance = 90
      controls.maxDistance = 1100
      controls.autoRotate = true
      controls.autoRotateSpeed = 0.45

      // ---- user interaction -> hide the dashboard labels --------------
      const canvas = graph.renderer().domElement
      const ping = () => {
        if (interactRef.current) interactRef.current(true)
        controls.autoRotate = false
        clearTimeout(idleTimer)
        idleTimer = setTimeout(() => {
          if (interactRef.current) interactRef.current(false)
        }, 1600)
      }
      canvas.addEventListener('pointerdown', ping)
      canvas.addEventListener('wheel', ping, { passive: true })

      graphRef.current = graph
      setReady(true)
    })

    return () => {
      cancelled = true
      clearTimeout(idleTimer)
      if (graphRef.current && graphRef.current._destructor) {
        graphRef.current._destructor()
      }
      graphRef.current = null
      meshesRef.current.clear()
    }
  }, [])

  // ---- react to hero/background mode -----------------------------------
  useEffect(() => {
    const graph = graphRef.current
    if (!graph || !ready) return
    const controls = graph.controls()
    if (mode === 'background') {
      controls.autoRotate = true
      controls.autoRotateSpeed = 0.3
    }
    // hero mode: auto-rotation stops the moment the user grabs the graph
  }, [mode, ready])

  // ---- risk filter (hide non-matching nodes) ---------------------------
  useEffect(() => {
    const graph = graphRef.current
    if (!graph || !ready) return
    const data = graph.graphData()
    const matches = (node) => {
      if (node.type === 'protocol') return filter === 'all' || filter === 'protocols'
      if (filter === 'high') return node.risk === 'HIGH'
      if (filter === 'low') return node.risk === 'LOW'
      if (filter === 'moderate') {
        const p = node.probability || 0
        return p >= 0.35 && p < 0.65
      }
      return true
    }
    data.nodes.forEach((node) => {
      const mesh = meshesRef.current.get(node.id)
      if (mesh) mesh.visible = matches(node)
    })
  }, [filter, ready])

  return (
    <div
      ref={containerRef}
      className={`graph-stage ${mode}`}
      style={{ opacity: ready ? undefined : 0 }}
    />
  )
}
