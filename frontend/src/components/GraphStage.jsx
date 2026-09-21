import React, { useEffect, useRef, useState } from 'react'
import ForceGraph3D from '3d-force-graph'
import * as THREE from 'three'
import { api } from '../api.js'

// ---------------------------------------------------------------------------
// GRAPH STAGE - the hero of VERTEX.
//
// One persistent 3D force-directed graph for the whole app:
//   * dashboard  -> "hero" mode: interactive, full opacity, drag to rotate,
//                   scroll to zoom, click an account node to inspect it
//   * other view -> "background" mode: translucent, slowly auto-rotating,
//                   pointer-events off, the page content floats above it
//
// Node shapes (titanium monochrome):
//   * accounts  -> circles (spheres), shaded by predicted risk
//                  LOW  = dark titanium   #39424D
//                  HIGH = bright platinum #F2F6F9 (with glow)
//   * protocols -> diamonds (octahedrons), bright silver
//
// The layout is force-directed (d3-force-3d), so the graph grows into a
// natural organic shape - never a fixed geometric pattern.
// ---------------------------------------------------------------------------

// module-level cache: fetch the network once per session
let networkPromise = null
function fetchNetwork() {
  if (!networkPromise) networkPromise = api.network()
  return networkPromise
}

const RISK_LOW_COLOR = '#39424D'
const RISK_HIGH_COLOR = '#F2F6F9'
const PROTOCOL_COLOR = '#C9D2D9'

export default function GraphStage({ mode = 'hero', filter = 'all', onSelectAccount }) {
  const containerRef = useRef(null)
  const graphRef = useRef(null)
  const meshesRef = useRef(new Map())
  const selectRef = useRef(onSelectAccount)
  selectRef.current = onSelectAccount

  const [ready, setReady] = useState(false)

  // ---- build the graph once -------------------------------------------
  useEffect(() => {
    let graph = null
    let cancelled = false

    fetchNetwork().then((net) => {
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
        nodes.push({
          id: `p${i}`,
          type: 'protocol',
          name,
        })
      })

      net.account_links.forEach(([s, t]) => {
        links.push({ source: `a${net.accounts[s].id}`, target: `a${net.accounts[t].id}`, kind: 'aa' })
      })

      net.protocol_links.forEach(([s, t]) => {
        links.push({ source: `a${net.accounts[s].id}`, target: `p${t}`, kind: 'ap' })
      })

      const accountMaterial = (risk) =>
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(risk === 'HIGH' ? RISK_HIGH_COLOR : RISK_LOW_COLOR),
          emissive: new THREE.Color(risk === 'HIGH' ? RISK_HIGH_COLOR : '#000000'),
          emissiveIntensity: risk === 'HIGH' ? 0.55 : 0.0,
          roughness: 0.35,
          metalness: 0.85,
        })

      const sphereGeo = new THREE.SphereGeometry(1.7, 12, 12)
      const diamondGeo = new THREE.OctahedronGeometry(6.5, 0)
      const diamondMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(PROTOCOL_COLOR),
        emissive: new THREE.Color(PROTOCOL_COLOR),
        emissiveIntensity: 0.28,
        roughness: 0.25,
        metalness: 0.9,
        transparent: true,
        opacity: 0.96,
      })

      graph = new ForceGraph3D(containerRef.current)
        .graphData({ nodes, links })
        .backgroundColor('rgba(0,0,0,0)')
        .showNavInfo(false)
        .nodeLabel((node) =>
          node.type === 'protocol'
            ? `${node.name} (protocol)`
            : `Account #${node.accountId} · ${node.risk} RISK · P=${(node.probability * 100).toFixed(1)}% · ${node.client}`
        )
        .nodeThreeObject((node) => {
          let mesh
          if (node.type === 'protocol') {
            mesh = new THREE.Mesh(diamondGeo, diamondMat)
          } else {
            mesh = new THREE.Mesh(sphereGeo, accountMaterial(node.risk))
          }
          meshesRef.current.set(node.id, mesh)
          return mesh
        })
        .linkColor(() => 'rgba(146, 156, 163, 1)')
        .linkOpacity(0.07)
        .linkWidth(0)
        .onNodeClick((node) => {
          if (node.type === 'account' && selectRef.current) {
            selectRef.current(node.accountId)
          }
        })
        .onEngineStop(() => {})
        .cameraPosition({ z: 480 })

      // gentle auto-rotation until the user grabs the hero graph
      const controls = graph.controls()
      controls.autoRotate = true
      controls.autoRotateSpeed = 0.5
      controls.addEventListener('start', () => {
        controls.autoRotate = false
      })

      graphRef.current = graph
      setReady(true)
    })

    return () => {
      cancelled = true
      if (graphRef.current) {
        graphRef.current._destructor ? graphRef.current._destructor() : null
        graphRef.current = null
      }
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
      controls.autoRotateSpeed = 0.35
    }
    // hero keeps whatever the user last did (rotation stops on first drag)
  }, [mode, ready])

  // ---- risk filter (dim non-matching nodes) ----------------------------
  useEffect(() => {
    meshesRef.current.forEach((mesh, id) => {
      if (!mesh.material) return
      if (id.startsWith('p')) {
        mesh.visible = filter === 'all' || filter === 'protocols'
      } else {
        // account node - visible only when its risk matches (or all)
        mesh.visible = filter === 'all' || filter === 'protocols'
      }
    })
    // account visibility needs the node objects: iterate graph data instead
    const graph = graphRef.current
    if (!graph || !ready) return
    const data = graph.graphData()
    data.nodes.forEach((node) => {
      const mesh = meshesRef.current.get(node.id)
      if (!mesh) return
      if (node.type === 'protocol') {
        mesh.visible = filter === 'all' || filter === 'protocols'
      } else if (filter === 'high') {
        mesh.visible = node.risk === 'HIGH'
      } else if (filter === 'low') {
        mesh.visible = node.risk === 'LOW'
      } else {
        mesh.visible = true
      }
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
