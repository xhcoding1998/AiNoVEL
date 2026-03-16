import { Hono } from 'hono'
import sql from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'

const novel = new Hono()
novel.use('*', authMiddleware)

async function verifyProjectOwner(c) {
  const userId = c.get('userId')
  const pid = c.req.param('id')
  const [p] = await sql`SELECT id FROM projects WHERE id = ${pid} AND user_id = ${userId}`
  return p ? pid : null
}

// --- Basic Info ---
novel.get('/:id/basic-info', async (c) => {
  const pid = await verifyProjectOwner(c)
  if (!pid) return c.json({ error: '项目不存在' }, 404)
  const [data] = await sql`SELECT * FROM basic_info WHERE project_id = ${pid}`
  return c.json({ data: data || {} })
})

novel.put('/:id/basic-info', async (c) => {
  const pid = await verifyProjectOwner(c)
  if (!pid) return c.json({ error: '项目不存在' }, 404)
  const body = await c.req.json()
  const [data] = await sql`
    UPDATE basic_info SET
      book_name = ${body.book_name || ''}, genre = ${body.genre || ''},
      style = ${body.style || ''}, core_selling_point = ${body.core_selling_point || ''},
      one_line_summary = ${body.one_line_summary || ''}, target_readers = ${body.target_readers || ''},
      updated_at = NOW()
    WHERE project_id = ${pid} RETURNING *
  `
  if (body.book_name != null && body.book_name !== '') {
    await sql`UPDATE projects SET name = ${body.book_name}, updated_at = NOW() WHERE id = ${pid}`
  }
  return c.json({ data })
})

// --- World Building ---
novel.get('/:id/world-building', async (c) => {
  const pid = await verifyProjectOwner(c)
  if (!pid) return c.json({ error: '项目不存在' }, 404)
  const [data] = await sql`SELECT * FROM world_building WHERE project_id = ${pid}`
  return c.json({ data: data || {} })
})

novel.put('/:id/world-building', async (c) => {
  const pid = await verifyProjectOwner(c)
  if (!pid) return c.json({ error: '项目不存在' }, 404)
  const body = await c.req.json()
  const [data] = await sql`
    UPDATE world_building SET
      era_setting = ${body.era_setting || ''}, power_structure = ${body.power_structure || ''},
      rules = ${body.rules || ''}, social_atmosphere = ${body.social_atmosphere || ''},
      updated_at = NOW()
    WHERE project_id = ${pid} RETURNING *
  `
  return c.json({ data })
})

// --- Characters ---
novel.get('/:id/characters', async (c) => {
  const pid = await verifyProjectOwner(c)
  if (!pid) return c.json({ error: '项目不存在' }, 404)
  const data = await sql`SELECT * FROM characters WHERE project_id = ${pid} ORDER BY created_at`
  return c.json({ data })
})

novel.post('/:id/characters', async (c) => {
  const pid = await verifyProjectOwner(c)
  if (!pid) return c.json({ error: '项目不存在' }, 404)
  const body = await c.req.json()
  const [data] = await sql`
    INSERT INTO characters (project_id, name, role_type, description, core_desire, weakness, secret, avatar_color)
    VALUES (${pid}, ${body.name || '未命名'}, ${body.role_type || 'supporting'},
      ${body.description || ''}, ${body.core_desire || ''}, ${body.weakness || ''},
      ${body.secret || ''}, ${body.avatar_color || '#0070f3'})
    RETURNING *
  `
  return c.json({ data })
})

novel.put('/:id/characters/:cid', async (c) => {
  const pid = await verifyProjectOwner(c)
  if (!pid) return c.json({ error: '项目不存在' }, 404)
  const cid = c.req.param('cid')
  const body = await c.req.json()
  const [data] = await sql`
    UPDATE characters SET
      name = ${body.name || '未命名'}, role_type = ${body.role_type || 'supporting'},
      description = ${body.description || ''}, core_desire = ${body.core_desire || ''},
      weakness = ${body.weakness || ''}, secret = ${body.secret || ''},
      avatar_color = ${body.avatar_color || '#0070f3'}, updated_at = NOW()
    WHERE id = ${cid} AND project_id = ${pid} RETURNING *
  `
  if (!data) return c.json({ error: '角色不存在' }, 404)
  return c.json({ data })
})

novel.delete('/:id/characters/:cid', async (c) => {
  const pid = await verifyProjectOwner(c)
  if (!pid) return c.json({ error: '项目不存在' }, 404)
  await sql`DELETE FROM characters WHERE id = ${c.req.param('cid')} AND project_id = ${pid}`
  return c.json({ success: true })
})

// --- Relations ---
novel.get('/:id/relations', async (c) => {
  const pid = await verifyProjectOwner(c)
  if (!pid) return c.json({ error: '项目不存在' }, 404)
  const data = await sql`SELECT * FROM character_relations WHERE project_id = ${pid}`
  return c.json({ data })
})

novel.post('/:id/relations', async (c) => {
  const pid = await verifyProjectOwner(c)
  if (!pid) return c.json({ error: '项目不存在' }, 404)
  const body = await c.req.json()
  const [data] = await sql`
    INSERT INTO character_relations (project_id, from_character_id, to_character_id, relation_type, faction, interest_link, emotion_link, description)
    VALUES (${pid}, ${body.from_character_id}, ${body.to_character_id},
      ${body.relation_type || ''}, ${body.faction || ''},
      ${body.interest_link || ''}, ${body.emotion_link || ''}, ${body.description || ''})
    RETURNING *
  `
  return c.json({ data })
})

novel.put('/:id/relations/:rid', async (c) => {
  const pid = await verifyProjectOwner(c)
  if (!pid) return c.json({ error: '项目不存在' }, 404)
  const rid = c.req.param('rid')
  const body = await c.req.json()
  const [data] = await sql`
    UPDATE character_relations SET
      relation_type = ${body.relation_type || ''}, faction = ${body.faction || ''},
      interest_link = ${body.interest_link || ''}, emotion_link = ${body.emotion_link || ''},
      description = ${body.description || ''}
    WHERE id = ${rid} AND project_id = ${pid} RETURNING *
  `
  if (!data) return c.json({ error: '关系不存在' }, 404)
  return c.json({ data })
})

novel.delete('/:id/relations/:rid', async (c) => {
  const pid = await verifyProjectOwner(c)
  if (!pid) return c.json({ error: '项目不存在' }, 404)
  await sql`DELETE FROM character_relations WHERE id = ${c.req.param('rid')} AND project_id = ${pid}`
  return c.json({ success: true })
})

// --- Plot Control ---
novel.get('/:id/plot-control', async (c) => {
  const pid = await verifyProjectOwner(c)
  if (!pid) return c.json({ error: '项目不存在' }, 404)
  const [data] = await sql`SELECT * FROM plot_control WHERE project_id = ${pid}`
  return c.json({ data: data || {} })
})

novel.put('/:id/plot-control', async (c) => {
  const pid = await verifyProjectOwner(c)
  if (!pid) return c.json({ error: '项目不存在' }, 404)
  const body = await c.req.json()
  const [data] = await sql`
    UPDATE plot_control SET
      main_storyline = ${body.main_storyline || ''}, outline_summary = ${body.outline_summary || ''},
      updated_at = NOW()
    WHERE project_id = ${pid} RETURNING *
  `
  return c.json({ data })
})

// --- Volumes ---
novel.get('/:id/volumes', async (c) => {
  const pid = await verifyProjectOwner(c)
  if (!pid) return c.json({ error: '项目不存在' }, 404)
  const data = await sql`SELECT * FROM volumes WHERE project_id = ${pid} ORDER BY volume_number`
  return c.json({ data })
})

novel.post('/:id/volumes', async (c) => {
  const pid = await verifyProjectOwner(c)
  if (!pid) return c.json({ error: '项目不存在' }, 404)
  const body = await c.req.json()
  const [data] = await sql`
    INSERT INTO volumes (project_id, volume_number, title, goal, summary)
    VALUES (${pid}, ${body.volume_number || 1}, ${body.title || ''}, ${body.goal || ''}, ${body.summary || ''})
    RETURNING *
  `
  return c.json({ data })
})

novel.put('/:id/volumes/:vid', async (c) => {
  const pid = await verifyProjectOwner(c)
  if (!pid) return c.json({ error: '项目不存在' }, 404)
  const vid = c.req.param('vid')
  const body = await c.req.json()
  const [data] = await sql`
    UPDATE volumes SET title = ${body.title || ''}, goal = ${body.goal || ''}, summary = ${body.summary || ''}
    WHERE id = ${vid} AND project_id = ${pid} RETURNING *
  `
  if (!data) return c.json({ error: '卷不存在' }, 404)
  return c.json({ data })
})

novel.delete('/:id/volumes/:vid', async (c) => {
  const pid = await verifyProjectOwner(c)
  if (!pid) return c.json({ error: '项目不存在' }, 404)
  const vid = c.req.param('vid')
  const [data] = await sql`DELETE FROM volumes WHERE id = ${vid} AND project_id = ${pid} RETURNING *`
  if (!data) return c.json({ error: '卷不存在' }, 404)
  return c.json({ data })
})

// --- Chapters ---
novel.get('/:id/volumes/:vid/chapters', async (c) => {
  const pid = await verifyProjectOwner(c)
  if (!pid) return c.json({ error: '项目不存在' }, 404)
  const vid = c.req.param('vid')
  const data = await sql`SELECT * FROM chapters WHERE project_id = ${pid} AND volume_id = ${vid} ORDER BY chapter_number`
  return c.json({ data })
})

novel.post('/:id/chapters', async (c) => {
  const pid = await verifyProjectOwner(c)
  if (!pid) return c.json({ error: '项目不存在' }, 404)
  const body = await c.req.json()
  const [data] = await sql`
    INSERT INTO chapters (project_id, volume_id, chapter_number, title, content, status)
    VALUES (${pid}, ${body.volume_id}, ${body.chapter_number || 1}, ${body.title || ''}, ${body.content || ''}, ${body.status || 'draft'})
    RETURNING *
  `
  return c.json({ data })
})

novel.put('/:id/chapters/:chid', async (c) => {
  const pid = await verifyProjectOwner(c)
  if (!pid) return c.json({ error: '项目不存在' }, 404)
  const chid = c.req.param('chid')
  const body = await c.req.json()
  const wordCount = (body.content || '').length
  const [data] = await sql`
    UPDATE chapters SET
      title = ${body.title || ''}, content = ${body.content || ''},
      status = ${body.status || 'draft'}, word_count = ${wordCount},
      highlight_scenes = ${JSON.stringify(body.highlight_scenes || [])},
      key_dialogues = ${JSON.stringify(body.key_dialogues || [])},
      thrill_points = ${JSON.stringify(body.thrill_points || [])},
      updated_at = NOW()
    WHERE id = ${chid} AND project_id = ${pid} RETURNING *
  `
  if (!data) return c.json({ error: '章节不存在' }, 404)
  return c.json({ data })
})

novel.delete('/:id/chapters/:chid', async (c) => {
  const pid = await verifyProjectOwner(c)
  if (!pid) return c.json({ error: '项目不存在' }, 404)
  const chid = c.req.param('chid')
  const [data] = await sql`DELETE FROM chapters WHERE id = ${chid} AND project_id = ${pid} RETURNING *`
  if (!data) return c.json({ error: '章节不存在' }, 404)
  return c.json({ data })
})

// --- Plot Devices ---
novel.get('/:id/plot-devices', async (c) => {
  const pid = await verifyProjectOwner(c)
  if (!pid) return c.json({ error: '项目不存在' }, 404)
  const data = await sql`SELECT * FROM plot_devices WHERE project_id = ${pid} ORDER BY created_at`
  return c.json({ data })
})

novel.post('/:id/plot-devices', async (c) => {
  const pid = await verifyProjectOwner(c)
  if (!pid) return c.json({ error: '项目不存在' }, 404)
  const body = await c.req.json()
  const [data] = await sql`
    INSERT INTO plot_devices (project_id, device_type, description, setup_chapter, payoff_chapter, status)
    VALUES (${pid}, ${body.device_type || 'foreshadowing'}, ${body.description || ''},
      ${body.setup_chapter || null}, ${body.payoff_chapter || null}, ${body.status || 'planted'})
    RETURNING *
  `
  return c.json({ data })
})

novel.put('/:id/plot-devices/:did', async (c) => {
  const pid = await verifyProjectOwner(c)
  if (!pid) return c.json({ error: '项目不存在' }, 404)
  const did = c.req.param('did')
  const body = await c.req.json()
  const [data] = await sql`
    UPDATE plot_devices SET
      device_type = ${body.device_type || 'foreshadowing'}, description = ${body.description || ''},
      setup_chapter = ${body.setup_chapter || null}, payoff_chapter = ${body.payoff_chapter || null},
      status = ${body.status || 'planted'}
    WHERE id = ${did} AND project_id = ${pid} RETURNING *
  `
  if (!data) return c.json({ error: '不存在' }, 404)
  return c.json({ data })
})

// --- Writing Style ---
novel.get('/:id/writing-style', async (c) => {
  const pid = await verifyProjectOwner(c)
  if (!pid) return c.json({ error: '项目不存在' }, 404)
  const [data] = await sql`SELECT * FROM writing_style WHERE project_id = ${pid}`
  return c.json({ data: data || {} })
})

novel.put('/:id/writing-style', async (c) => {
  const pid = await verifyProjectOwner(c)
  if (!pid) return c.json({ error: '项目不存在' }, 404)
  const body = await c.req.json()
  const [data] = await sql`
    UPDATE writing_style SET
      writing_style = ${body.writing_style || ''},
      character_voice = ${JSON.stringify(body.character_voice || {})},
      rhythm_requirement = ${body.rhythm_requirement || ''},
      romance_ratio = ${body.romance_ratio || ''},
      taboos = ${body.taboos || ''}, red_lines = ${body.red_lines || ''},
      updated_at = NOW()
    WHERE project_id = ${pid} RETURNING *
  `
  return c.json({ data })
})

export default novel
