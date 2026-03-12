import { ref, computed, unref } from 'vue'
import dagre from '@dagrejs/dagre'

const CHAR_WIDTH = 8
const MIN_NODE_WIDTH = 80
const MAX_NODE_WIDTH = 180
const NODE_HEIGHT = 48
const PADDING_H = 28
const MAX_LABEL_LEN = 12

function measureNodeWidth(name) {
  const display = name.length > MAX_LABEL_LEN ? name.slice(0, MAX_LABEL_LEN) + '…' : name
  const estimated = display.length * CHAR_WIDTH + PADDING_H
  return Math.max(MIN_NODE_WIDTH, Math.min(MAX_NODE_WIDTH, estimated))
}

function truncateLabel(name) {
  return name.length > MAX_LABEL_LEN ? name.slice(0, MAX_LABEL_LEN) + '…' : name
}

export function useGraph(charactersFn, relationsFn) {
  const graphData = ref({ nodes: [], edges: [] })

  function layout() {
    const g = new dagre.graphlib.Graph()
    g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 80, marginx: 40, marginy: 40 })
    g.setDefaultEdgeLabel(() => ({}))

    const chars = (typeof charactersFn === 'function' ? charactersFn() : unref(charactersFn)) || []
    const rels = (typeof relationsFn === 'function' ? relationsFn() : unref(relationsFn)) || []

    chars.forEach(c => {
      const w = measureNodeWidth(c.name)
      g.setNode(String(c.id), {
        label: c.name,
        displayLabel: truncateLabel(c.name),
        width: w,
        height: NODE_HEIGHT,
        data: c
      })
    })

    rels.forEach(r => {
      if (!g.hasNode(String(r.from_character_id)) || !g.hasNode(String(r.to_character_id))) return
      g.setEdge(String(r.from_character_id), String(r.to_character_id), {
        label: r.relation_type || '',
        data: r
      })
    })

    dagre.layout(g)

    const nodes = []
    g.nodes().forEach(id => {
      const node = g.node(id)
      if (node) {
        nodes.push({
          id,
          x: node.x,
          y: node.y,
          width: node.width,
          height: node.height,
          label: node.label,
          displayLabel: node.displayLabel,
          data: node.data
        })
      }
    })

    const edges = []
    g.edges().forEach(e => {
      const edge = g.edge(e)
      edges.push({
        from: e.v,
        to: e.w,
        points: edge.points,
        label: edge.label,
        data: edge.data
      })
    })

    graphData.value = { nodes, edges }
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
          minX = Math.min(minX, p.x - 30)
          minY = Math.min(minY, p.y - 15)
          maxX = Math.max(maxX, p.x + 30)
          maxY = Math.max(maxY, p.y + 15)
        })
      }
    })
    const pad = 50
    return `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`
  })

  return { graphData, layout, viewBox }
}
