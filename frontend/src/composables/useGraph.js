import { ref, computed, unref } from 'vue'
import dagre from '@dagrejs/dagre'

export function useGraph(charactersFn, relationsFn) {
  const graphData = ref({ nodes: [], edges: [] })

  function layout() {
    const g = new dagre.graphlib.Graph()
    g.setGraph({ rankdir: 'TB', nodesep: 80, ranksep: 100, marginx: 40, marginy: 40 })
    g.setDefaultEdgeLabel(() => ({}))

    const chars = (typeof charactersFn === 'function' ? charactersFn() : unref(charactersFn)) || []
    const rels = (typeof relationsFn === 'function' ? relationsFn() : unref(relationsFn)) || []

    chars.forEach(c => {
      g.setNode(String(c.id), {
        label: c.name,
        width: 140,
        height: 60,
        data: c
      })
    })

    rels.forEach(r => {
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
    const { nodes } = graphData.value
    if (!nodes.length) return '0 0 600 400'
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    nodes.forEach(n => {
      minX = Math.min(minX, n.x - n.width / 2)
      minY = Math.min(minY, n.y - n.height / 2)
      maxX = Math.max(maxX, n.x + n.width / 2)
      maxY = Math.max(maxY, n.y + n.height / 2)
    })
    const pad = 40
    return `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`
  })

  return { graphData, layout, viewBox }
}
