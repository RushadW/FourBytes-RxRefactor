'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Network, ZoomIn, ZoomOut, RotateCcw, Info, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api'

interface GraphNode {
  id: string
  label: string
  type: 'drug' | 'payer' | 'criteria'
  x: number
  y: number
  vx: number
  vy: number
  radius: number
}

interface GraphEdge {
  source: string
  target: string
  type: 'covers' | 'requires' | 'not-covered'
  label?: string
  color: string
}

const typeColors: Record<string, string> = {
  drug: '#3b82f6',
  payer: '#22c55e',
  criteria: '#f59e0b',
}

const typeLabels: Record<string, string> = {
  drug: 'Drugs',
  payer: 'Payers',
  criteria: 'Requirements',
}

export function KnowledgeGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const nodesRef = useRef<GraphNode[]>([])
  const edgesRef = useRef<GraphEdge[]>([])
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 })
  const [loading, setLoading] = useState(true)
  const animFrameRef = useRef<number>(0)
  const mouseRef = useRef({ x: 0, y: 0, isDragging: false, dragNode: null as GraphNode | null })

  // Fetch real data from matrix API and build graph
  useEffect(() => {
    fetch(`${API_BASE}/matrix`)
      .then(r => r.json())
      .then(data => {
        const nodes: Omit<GraphNode, 'x' | 'y' | 'vx' | 'vy'>[] = []
        const edges: GraphEdge[] = []

        // Criteria nodes
        nodes.push({ id: 'pa', label: 'Prior Auth', type: 'criteria', radius: 22 })
        nodes.push({ id: 'step', label: 'Step Therapy', type: 'criteria', radius: 22 })

        // Payer nodes
        const shortNames: Record<string, string> = {
          'Blue Cross Blue Shield': 'BCBS',
          'UnitedHealthcare': 'UHC',
          'Priority Health': 'Priority',
          'UPMC Health Plan': 'UPMC',
        }
        for (const p of data.payers || []) {
          nodes.push({
            id: p.payer_id,
            label: shortNames[p.payer_name] || p.payer_name,
            type: 'payer',
            radius: 26,
          })
        }

        // Drug nodes
        for (const d of data.drugs || []) {
          // Use short brand name
          const brand = d.drug_name.match(/\(([^)]+)\)/)?.[1] || d.drug_name.split(' ')[0]
          nodes.push({
            id: d.drug_id,
            label: brand,
            type: 'drug',
            radius: 24,
          })
        }

        // Build edges from matrix rows
        const drugPaSet = new Set<string>()
        const drugStSet = new Set<string>()
        for (const row of data.rows || []) {
          const drugId = row.drug?.drug_id
          if (!drugId) continue
          for (const [payerId, cell] of Object.entries(row.cells || {})) {
            const pol = (cell as any)?.policy
            if (!pol) continue
            const covered = pol.covered
            const pa = pol.prior_auth
            const st = pol.step_therapy

            if (covered) {
              const parts: string[] = []
              if (pa) parts.push('PA')
              if (st) parts.push('ST')
              edges.push({
                source: payerId,
                target: drugId,
                type: 'covers',
                label: parts.length ? parts.join('+') : 'No restrictions',
                color: '#22c55e',
              })
            } else {
              edges.push({
                source: payerId,
                target: drugId,
                type: 'not-covered',
                label: 'Not covered',
                color: '#ef4444',
              })
            }

            // Drug → criteria edges (deduplicated)
            if (pa && !drugPaSet.has(drugId)) {
              drugPaSet.add(drugId)
              edges.push({ source: drugId, target: 'pa', type: 'requires', color: '#f59e0b' })
            }
            if (st && !drugStSet.has(drugId)) {
              drugStSet.add(drugId)
              edges.push({ source: drugId, target: 'step', type: 'requires', color: '#f59e0b' })
            }
          }
        }

        // Position nodes
        const cx = dimensions.width / 2
        const cy = dimensions.height / 2
        nodesRef.current = nodes.map((n, i) => {
          const angle = (i / nodes.length) * Math.PI * 2
          const r = n.type === 'drug' ? 160 : n.type === 'payer' ? 280 : 100
          return {
            ...n,
            x: cx + Math.cos(angle) * r + (Math.random() - 0.5) * 60,
            y: cy + Math.sin(angle) * r + (Math.random() - 0.5) * 60,
            vx: 0,
            vy: 0,
          }
        })
        edgesRef.current = edges
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [dimensions])

  // Resize observer
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setDimensions({ width, height: Math.max(height, 400) })
    })
    ro.observe(container)
    return () => ro.disconnect()
  }, [])

  // Force simulation + rendering
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = dimensions.width * dpr
    canvas.height = dimensions.height * dpr
    ctx.scale(dpr, dpr)

    const tick = () => {
      const nodes = nodesRef.current
      const cx = dimensions.width / 2
      const cy = dimensions.height / 2

      // Force simulation
      for (const node of nodes) {
        // Center gravity
        node.vx += (cx - node.x) * 0.001
        node.vy += (cy - node.y) * 0.001

        // Repulsion between nodes
        for (const other of nodes) {
          if (node.id === other.id) continue
          const dx = node.x - other.x
          const dy = node.y - other.y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          const force = 2400 / (dist * dist)
          node.vx += (dx / dist) * force
          node.vy += (dy / dist) * force
        }

        // Edge attraction
        for (const edge of edgesRef.current) {
          if (edge.source === node.id || edge.target === node.id) {
            const otherId = edge.source === node.id ? edge.target : edge.source
            const other = nodes.find(n => n.id === otherId)
            if (!other) continue
            const dx = other.x - node.x
            const dy = other.y - node.y
            const dist = Math.sqrt(dx * dx + dy * dy) || 1
            node.vx += (dx / dist) * 0.3
            node.vy += (dy / dist) * 0.3
          }
        }

        // Damping
        node.vx *= 0.9
        node.vy *= 0.9

        // Skip position update for dragged node
        if (mouseRef.current.dragNode?.id !== node.id) {
          node.x += node.vx
          node.y += node.vy
        }

        // Bounds
        node.x = Math.max(node.radius, Math.min(dimensions.width - node.radius, node.x))
        node.y = Math.max(node.radius, Math.min(dimensions.height - node.radius, node.y))
      }

      // Clear
      ctx.clearRect(0, 0, dimensions.width, dimensions.height)
      ctx.save()

      // Draw edges
      for (const edge of edgesRef.current) {
        const source = nodes.find(n => n.id === edge.source)
        const target = nodes.find(n => n.id === edge.target)
        if (!source || !target) continue

        const isHighlighted = hoveredNode === edge.source || hoveredNode === edge.target
        const isConnectedToSelected = selectedNode && (edge.source === selectedNode.id || edge.target === selectedNode.id)

        const dx = target.x - source.x
        const dy = target.y - source.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const ux = dx / dist
        const uy = dy / dist

        // Shorten line to stop at node edge
        const startX = source.x + ux * source.radius
        const startY = source.y + uy * source.radius
        const endX = target.x - ux * target.radius
        const endY = target.y - uy * target.radius

        const lineColor = isHighlighted || isConnectedToSelected
          ? edge.color
          : hoveredNode || selectedNode ? 'rgba(15, 23, 42, 0.06)' : 'rgba(15, 23, 42, 0.12)'
        const lineWidth = isHighlighted || isConnectedToSelected ? 2 : 1

        // Draw line
        ctx.beginPath()
        ctx.moveTo(startX, startY)
        ctx.lineTo(endX, endY)
        ctx.strokeStyle = lineColor
        ctx.lineWidth = lineWidth
        ctx.stroke()

        // Draw arrowhead
        const arrowSize = isHighlighted || isConnectedToSelected ? 10 : 7
        const angle = Math.atan2(endY - startY, endX - startX)
        ctx.beginPath()
        ctx.moveTo(endX, endY)
        ctx.lineTo(
          endX - arrowSize * Math.cos(angle - Math.PI / 7),
          endY - arrowSize * Math.sin(angle - Math.PI / 7)
        )
        ctx.lineTo(
          endX - arrowSize * Math.cos(angle + Math.PI / 7),
          endY - arrowSize * Math.sin(angle + Math.PI / 7)
        )
        ctx.closePath()
        ctx.fillStyle = lineColor
        ctx.fill()

        // Edge label
        if ((isHighlighted || isConnectedToSelected) && edge.label) {
          const mx = (source.x + target.x) / 2
          const my = (source.y + target.y) / 2
          ctx.font = '10px Geist, sans-serif'
          ctx.fillStyle = 'rgba(15, 23, 42, 0.55)'
          ctx.textAlign = 'center'
          ctx.fillText(edge.label, mx, my - 5)
        }
      }

      // Draw nodes
      for (const node of nodes) {
        const isHovered = hoveredNode === node.id
        const isSelected = selectedNode?.id === node.id
        const isConnected = hoveredNode
          ? edgesRef.current.some(e => (e.source === hoveredNode && e.target === node.id) || (e.target === hoveredNode && e.source === node.id))
          : selectedNode
          ? edgesRef.current.some(e => (e.source === selectedNode.id && e.target === node.id) || (e.target === selectedNode.id && e.source === node.id))
          : false
        const isDimmed = (hoveredNode || selectedNode) && !isHovered && !isSelected && !isConnected

        const color = typeColors[node.type]
        const r = node.radius * (isHovered ? 1.2 : 1)

        // Glow
        if (isHovered || isSelected) {
          const gradient = ctx.createRadialGradient(node.x, node.y, r, node.x, node.y, r * 2.5)
          gradient.addColorStop(0, color + '30')
          gradient.addColorStop(1, 'transparent')
          ctx.fillStyle = gradient
          ctx.beginPath()
          ctx.arc(node.x, node.y, r * 2.5, 0, Math.PI * 2)
          ctx.fill()
        }

        // Node circle
        ctx.beginPath()
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2)
        ctx.fillStyle = isDimmed ? color + '15' : color + '30'
        ctx.fill()
        ctx.strokeStyle = isDimmed ? color + '20' : color + '80'
        ctx.lineWidth = isHovered || isSelected ? 2.5 : 1.5
        ctx.stroke()

        // Label
        ctx.font = `${isHovered ? 'bold ' : ''}11px Geist, sans-serif`
        ctx.fillStyle = isDimmed ? 'rgba(100, 116, 139, 0.45)' : 'rgba(15, 23, 42, 0.92)'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(node.label, node.x, node.y)
      }

      ctx.restore()
      animFrameRef.current = requestAnimationFrame(tick)
    }

    tick()
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [dimensions, hoveredNode, selectedNode, loading])

  // Mouse handlers
  const getNodeAtPosition = useCallback((px: number, py: number): GraphNode | null => {
    for (const node of nodesRef.current) {
      const dx = px - node.x
      const dy = py - node.y
      if (dx * dx + dy * dy < node.radius * node.radius * 1.5) {
        return node
      }
    }
    return null
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    mouseRef.current.x = x
    mouseRef.current.y = y

    if (mouseRef.current.dragNode) {
      mouseRef.current.dragNode.x = x
      mouseRef.current.dragNode.y = y
      return
    }

    const node = getNodeAtPosition(x, y)
    setHoveredNode(node?.id || null)
  }, [getNodeAtPosition])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const node = getNodeAtPosition(x, y)
    if (node) {
      mouseRef.current.dragNode = node
      mouseRef.current.isDragging = true
    }
  }, [getNodeAtPosition])

  const handleMouseUp = useCallback(() => {
    if (mouseRef.current.dragNode && !mouseRef.current.isDragging) {
      setSelectedNode(prev => prev?.id === mouseRef.current.dragNode?.id ? null : mouseRef.current.dragNode)
    }
    mouseRef.current.dragNode = null
    mouseRef.current.isDragging = false
  }, [])

  const handleClick = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const node = getNodeAtPosition(x, y)
    setSelectedNode(prev => prev?.id === node?.id ? null : node || null)
  }, [getNodeAtPosition])

  const connectedEdges = selectedNode
    ? edgesRef.current.filter(e => e.source === selectedNode.id || e.target === selectedNode.id)
    : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500/12 to-primary/10 ring-1 ring-border flex items-center justify-center">
            <Network className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Knowledge Graph</h2>
            <p className="text-sm text-muted-foreground">Interactive policy relationship map</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setSelectedNode(null); setHoveredNode(null) }}
        >
          <RotateCcw className="w-3 h-3 mr-2" /> Reset
        </Button>
      </div>

      {/* Legend */}
      <div className="flex gap-4 flex-wrap">
        {Object.entries(typeLabels).map(([type, label]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: typeColors[type] + '80' }}
            />
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="glass-card rounded-xl overflow-hidden relative" style={{ height: 550 }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-background/50">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}
        <canvas
          ref={canvasRef}
          style={{ width: dimensions.width, height: dimensions.height, cursor: hoveredNode ? 'pointer' : 'default' }}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onClick={handleClick}
          onMouseLeave={() => { setHoveredNode(null); mouseRef.current.dragNode = null }}
        />

        {/* Node info panel */}
        <AnimatePresence>
          {selectedNode && (
            <motion.div
              className="absolute top-4 right-4 w-64 glass-card rounded-xl p-4 border border-border/50"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center"
                  style={{ backgroundColor: typeColors[selectedNode.type] + '30' }}
                >
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: typeColors[selectedNode.type] }} />
                </div>
                <div>
                  <p className="text-sm font-semibold">{selectedNode.label}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">{selectedNode.type}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {connectedEdges.length} connection{connectedEdges.length !== 1 ? 's' : ''}
                </p>
                {connectedEdges.map((edge, i) => {
                  const otherId = edge.source === selectedNode.id ? edge.target : edge.source
                  const other = nodesRef.current.find(n => n.id === otherId)
                  return (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: edge.color }} />
                      <span className="text-muted-foreground">{edge.type}:</span>
                      <span className="text-foreground">{other?.label}</span>
                      {edge.label && (
                        <span className="text-[10px] text-muted-foreground/60">({edge.label})</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="absolute bottom-3 left-3 text-[10px] text-muted-foreground/40">
          Click nodes to inspect • Drag to rearrange
        </p>
      </div>
    </div>
  )
}
