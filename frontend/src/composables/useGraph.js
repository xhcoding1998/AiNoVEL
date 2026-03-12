import { ref, computed, unref } from 'vue'

const CHAR_WIDTH = 8
const MIN_NODE_WIDTH = 90
const MAX_NODE_WIDTH = 180
const NODE_HEIGHT = 48
const PADDING_H = 32
const MAX_LABEL_LEN = 12

function measureNodeWidth(name) {
  const display = name.length > MAX_LABEL_LEN ? name.slice(0, MAX_LABEL_LEN) + '…' : name
  const estimated = display.length * CHAR_WIDTH + PADDING_H
  return Math.max(MIN_NODE_WIDTH, Math.min(MAX_NODE_WIDTH, estimated))
}

function truncateLabel(name) {
  return name.length > MAX_LABEL_LEN ? name.slice(0, MAX_LABEL_LEN) + '…' : name
}

const ROLE_RANK = {
  male_lead: 0,
  female_lead: 0,
  supporting: 1,
  antagonist: 2
}

export function useGraph(charactersFn, relationsFn) {
  const graphData = ref({ nodes: [], edges: [] })

  function layout() {
    const chars = (typeof charactersFn === 'function' ? charactersFn() : unref(charactersFn)) || []
    const rels = (typeof relationsFn === 'function' ? relationsFn() : unref(relationsFn)) || []

    if (!chars.length) {
      graphData.value = { nodes: [], edges: [] }
      return
    }

    // -- Step 1: group characters into layers by role_type --
    const layers = {}
    for (const c of chars) {
      const rank = ROLE_RANK[c.role_type] ?? 1
      ;(layers[rank] ??= []).push(c)
    }
    const sortedRanks = Object.keys(layers).map(Number).sort((a, b) => a - b)

    // -- Step 2: compute node positions with forced layering --
    const LAYER_GAP = 120
    const NODE_GAP = 100
    const MARGIN_X = 60
    const MARGIN_Y = 50

    const maxLayerWidth = Math.max(...sortedRanks.map(r => {
      const group = layers[r]
      return group.reduce((sum, c) => sum + measureNodeWidth(c.name) + NODE_GAP, -NODE_GAP)
    }))
    const canvasWidth = Math.max(maxLayerWidth + MARGIN_X * 2, 500)

    const nodeMap = {}
    let currentY = MARGIN_Y

    for (const rank of sortedRanks) {
      const group = layers[rank]
      const totalWidth = group.reduce((sum, c) => sum + measureNodeWidth(c.name) + NODE_GAP, -NODE_GAP)
      let startX = (canvasWidth - totalWidth) / 2
      const y = currentY + NODE_HEIGHT / 2

      for (const c of group) {
        const w = measureNodeWidth(c.name)
        const x = startX + w / 2
        nodeMap[String(c.id)] = {
          id: String(c.id),
          x,
          y,
          width: w,
          height: NODE_HEIGHT,
          label: c.name,
          displayLabel: truncateLabel(c.name),
          data: c
        }
        startX += w + NODE_GAP
      }
      currentY += NODE_HEIGHT + LAYER_GAP
    }

    // -- Step 3: build edges with proper curve control points --
    const edgeList = []
    const edgeSet = new Set()

    for (const r of rels) {
      const fromId = String(r.from_character_id)
      const toId = String(r.to_character_id)
      if (!nodeMap[fromId] || !nodeMap[toId]) continue

      const key = `${fromId}-${toId}`
      if (edgeSet.has(key)) continue
      edgeSet.add(key)

      const fromNode = nodeMap[fromId]
      const toNode = nodeMap[toId]

      const points = computeEdgePoints(fromNode, toNode)

      edgeList.push({
        from: fromId,
        to: toId,
        points,
        label: r.relation_type || '',
        data: r
      })
    }

    graphData.value = {
      nodes: Object.values(nodeMap),
      edges: edgeList
    }
  }

  function computeEdgePoints(fromNode, toNode) {
    const fx = fromNode.x
    const fy = fromNode.y
    const tx = toNode.x
    const ty = toNode.y

    const startY = fy + fromNode.height / 2
    const endY = ty - toNode.height / 2

    const sameLayer = Math.abs(fy - ty) < 10
    if (sameLayer) {
      const midY = fy - 60
      return [
        { x: fx, y: fy - fromNode.height / 2 },
        { x: (fx + tx) / 2, y: midY },
        { x: tx, y: ty - toNode.height / 2 }
      ]
    }

    const goingDown = fy < ty
    if (goingDown) {
      const midY = (startY + endY) / 2
      return [
        { x: fx, y: startY },
        { x: fx, y: midY },
        { x: tx, y: midY },
        { x: tx, y: endY }
      ]
    }

    // reverse edge (going up) — route around
    const detourX = Math.max(fx, tx) + 80
    return [
      { x: fx, y: startY },
      { x: detourX, y: startY },
      { x: detourX, y: endY },
      { x: tx, y: endY }
    ]
  }

  const viewBox = computed(() => {
    const { nodes, edges } = graphData.value
    if (!nodes.length) return '0 0 600 400'
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    nodes.forEach(n => {
      minX = Math.min(minX, n.x - n.width / 2)
      minY = Math.min(minY, n.y - n.height / 2)
      maxX = Math.max(maxX, n.x + n.width / 2)
      maxY = Math.max(maxY, n.y + n.height / 2)
    })
    edges.forEach(e => {
      if (e.points) {
        e.points.forEach(p => {
          minX = Math.min(minX, p.x - 40)
          minY = Math.min(minY, p.y - 25)
          maxX = Math.max(maxX, p.x + 40)
          maxY = Math.max(maxY, p.y + 25)
        })
      }
    })
    const pad = 50
    return `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`
  })

  return { graphData, layout, viewBox }
}
