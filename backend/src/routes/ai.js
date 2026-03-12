import { Hono } from 'hono'
import sql from '../db/index.js'
import { authMiddleware, verifyToken } from '../middleware/auth.js'
import { compileMaterial } from '../services/material.js'
import { callAI, buildStepPrompt, buildChapterOutlinesPrompt, buildChapterContentPrompt, GENERATION_STEPS, STEP_LABELS } from '../services/ai.js'
import { parseAndSaveSection } from '../services/parser.js'

const ai = new Hono()
ai.use('*', authMiddleware)

async function verifyProjectOwner(c) {
  const userId = c.get('userId')
  const pid = c.req.param('id')
  const [p] = await sql`SELECT id FROM projects WHERE id = ${pid} AND user_id = ${userId}`
  return p ? pid : null
}

async function getUserAIConfig(userId) {
  const [user] = await sql`SELECT ai_api_url, ai_api_key, ai_model FROM users WHERE id = ${userId}`
  return user
}

// Get generation status with step info
ai.get('/:id/generation-status', async (c) => {
  const pid = await verifyProjectOwner(c)
  if (!pid) return c.json({ error: '项目不存在' }, 404)

  const [proj] = await sql`SELECT generation_status, generation_step FROM projects WHERE id = ${pid}`
  const tasks = await sql`
    SELECT id, task_type, status, prompt, result, created_at, completed_at
    FROM ai_tasks WHERE project_id = ${pid} ORDER BY created_at DESC LIMIT 10
  `

  const completedSteps = []
  if (proj.generation_status === 'generating' && proj.generation_step) {
    const currentIdx = GENERATION_STEPS.indexOf(proj.generation_step)
    for (let i = 0; i < currentIdx; i++) {
      completedSteps.push(GENERATION_STEPS[i])
    }
  } else if (proj.generation_status === 'completed') {
    completedSteps.push(...GENERATION_STEPS)
  } else if (proj.generation_status === 'failed' && proj.generation_step) {
    const failIdx = GENERATION_STEPS.indexOf(proj.generation_step)
    for (let i = 0; i < failIdx; i++) {
      completedSteps.push(GENERATION_STEPS[i])
    }
  }

  return c.json({
    status: proj.generation_status,
    currentStep: proj.generation_step,
    completedSteps,
    steps: GENERATION_STEPS,
    stepLabels: STEP_LABELS,
    tasks
  })
})

// Full generation: step-by-step with progress
ai.post('/:id/generate-all', async (c) => {
  const pid = await verifyProjectOwner(c)
  if (!pid) return c.json({ error: '项目不存在' }, 404)

  const { prompt } = await c.req.json()
  const userId = c.get('userId')
  const userConfig = await getUserAIConfig(userId)

  await sql`UPDATE projects SET generation_status = 'generating', generation_step = ${GENERATION_STEPS[0]}, initial_prompt = ${prompt || ''}, updated_at = NOW() WHERE id = ${pid}`

  const [task] = await sql`
    INSERT INTO ai_tasks (project_id, task_type, status, prompt)
    VALUES (${pid}, 'full_generation', 'running', ${prompt || ''})
    RETURNING *
  `

  processStepByStep(task.id, pid, prompt, userConfig, 0).catch(console.error)

  return c.json({ data: task })
})

// Continue generation from failed step
ai.post('/:id/continue-generation', async (c) => {
  const pid = await verifyProjectOwner(c)
  if (!pid) return c.json({ error: '项目不存在' }, 404)

  const [proj] = await sql`SELECT generation_status, generation_step, initial_prompt FROM projects WHERE id = ${pid}`

  if (proj.generation_status !== 'failed' || !proj.generation_step) {
    return c.json({ error: '当前不需要继续生成' }, 400)
  }

  const startIdx = GENERATION_STEPS.indexOf(proj.generation_step)
  if (startIdx === -1) return c.json({ error: '无效的生成步骤' }, 400)

  const userId = c.get('userId')
  const userConfig = await getUserAIConfig(userId)

  await sql`UPDATE projects SET generation_status = 'generating', updated_at = NOW() WHERE id = ${pid}`

  const [task] = await sql`
    INSERT INTO ai_tasks (project_id, task_type, status, prompt)
    VALUES (${pid}, 'continue_generation', 'running', ${proj.initial_prompt || ''})
    RETURNING *
  `

  processStepByStep(task.id, pid, proj.initial_prompt, userConfig, startIdx).catch(console.error)

  return c.json({ data: task })
})

// Section regeneration
ai.post('/:id/generate-section', async (c) => {
  const pid = await verifyProjectOwner(c)
  if (!pid) return c.json({ error: '项目不存在' }, 404)

  const { section, prompt } = await c.req.json()
  if (!GENERATION_STEPS.includes(section)) {
    return c.json({ error: '无效的物料类别' }, 400)
  }

  const userId = c.get('userId')
  const userConfig = await getUserAIConfig(userId)

  await sql`UPDATE projects SET generation_status = 'generating', generation_step = ${section}, updated_at = NOW() WHERE id = ${pid}`

  const [task] = await sql`
    INSERT INTO ai_tasks (project_id, task_type, status, prompt)
    VALUES (${pid}, ${`regen_${section}`}, 'running', ${prompt || ''})
    RETURNING *
  `

  processSingleSection(task.id, pid, section, prompt, userConfig).catch(console.error)

  return c.json({ data: task })
})

// AI-generate a single item (character, relation, volume) based on existing material
ai.post('/:id/generate-single-item', async (c) => {
  const pid = await verifyProjectOwner(c)
  if (!pid) return c.json({ error: '项目不存在' }, 404)

  const { item_type, context } = await c.req.json()
  const validTypes = ['character', 'relation', 'volume']
  if (!validTypes.includes(item_type)) {
    return c.json({ error: '无效的生成类型' }, 400)
  }

  const userId = c.get('userId')
  const userConfig = await getUserAIConfig(userId)

  let existingMaterial = {}
  try {
    const [latest] = await sql`SELECT content FROM materials WHERE project_id = ${pid} ORDER BY version DESC LIMIT 1`
    if (latest) existingMaterial = latest.content
  } catch { /* ignore */ }

  const prompt = buildSingleItemPrompt(item_type, existingMaterial, context)
  try {
    const result = await callAI(userConfig, prompt, context || '请生成一条新内容', { json_mode: true, max_tokens: 4096 })
    const parsed = JSON.parse(result.trim().replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, ''))
    return c.json({ data: parsed })
  } catch (err) {
    return c.json({ error: err.message || 'AI 生成失败' }, 500)
  }
})

// Get all AI tasks
ai.get('/:id/ai-tasks', async (c) => {
  const pid = await verifyProjectOwner(c)
  if (!pid) return c.json({ error: '项目不存在' }, 404)
  const data = await sql`SELECT * FROM ai_tasks WHERE project_id = ${pid} ORDER BY created_at DESC`
  return c.json({ data })
})

// Get single task
ai.get('/:id/ai-tasks/:tid', async (c) => {
  const pid = await verifyProjectOwner(c)
  if (!pid) return c.json({ error: '项目不存在' }, 404)
  const [data] = await sql`SELECT * FROM ai_tasks WHERE id = ${c.req.param('tid')} AND project_id = ${pid}`
  if (!data) return c.json({ error: '任务不存在' }, 404)
  return c.json({ data })
})

// Compile material
ai.post('/:id/material/compile', async (c) => {
  const pid = await verifyProjectOwner(c)
  if (!pid) return c.json({ error: '项目不存在' }, 404)
  const material = await compileMaterial(pid)
  return c.json({ data: material })
})

// Get latest material
ai.get('/:id/material', async (c) => {
  const pid = await verifyProjectOwner(c)
  if (!pid) return c.json({ error: '项目不存在' }, 404)
  const [material] = await sql`
    SELECT * FROM materials WHERE project_id = ${pid} ORDER BY version DESC LIMIT 1
  `
  return c.json({ data: material || null })
})

// Generate chapter outlines for a volume
ai.post('/:id/generate-volume-chapters', async (c) => {
  const pid = await verifyProjectOwner(c)
  if (!pid) return c.json({ error: '项目不存在' }, 404)

  const { volume_id, prompt } = await c.req.json()
  if (!volume_id) return c.json({ error: '请指定卷' }, 400)

  const [volume] = await sql`SELECT * FROM volumes WHERE id = ${volume_id} AND project_id = ${pid}`
  if (!volume) return c.json({ error: '卷不存在' }, 404)

  const userId = c.get('userId')
  const userConfig = await getUserAIConfig(userId)

  const [task] = await sql`
    INSERT INTO ai_tasks (project_id, task_type, status, prompt)
    VALUES (${pid}, 'generate_chapters', 'running', ${prompt || `为第${volume.volume_number}卷生成章节大纲`})
    RETURNING *
  `

  processChapterOutlines(task.id, pid, volume, prompt, userConfig).catch(console.error)
  return c.json({ data: task })
})

// Generate content for a single chapter
ai.post('/:id/generate-chapter-content', async (c) => {
  const pid = await verifyProjectOwner(c)
  if (!pid) return c.json({ error: '项目不存在' }, 404)

  const { chapter_id } = await c.req.json()
  if (!chapter_id) return c.json({ error: '请指定章节' }, 400)

  const [chapter] = await sql`SELECT * FROM chapters WHERE id = ${chapter_id} AND project_id = ${pid}`
  if (!chapter) return c.json({ error: '章节不存在' }, 404)

  const [volume] = await sql`SELECT * FROM volumes WHERE id = ${chapter.volume_id}`
  if (!volume) return c.json({ error: '卷不存在' }, 404)

  const userId = c.get('userId')
  const userConfig = await getUserAIConfig(userId)

  const [task] = await sql`
    INSERT INTO ai_tasks (project_id, task_type, status, prompt)
    VALUES (${pid}, 'generate_chapter_content', 'running', ${`生成第${volume.volume_number}卷第${chapter.chapter_number}章正文`})
    RETURNING *
  `

  processChapterContent(task.id, pid, chapter, volume, userConfig).catch(console.error)
  return c.json({ data: task })
})

// Preview: get all volumes with chapters
ai.get('/:id/preview', async (c) => {
  const pid = await verifyProjectOwner(c)
  if (!pid) return c.json({ error: '项目不存在' }, 404)

  const [basicInfo] = await sql`SELECT * FROM basic_info WHERE project_id = ${pid}`
  const volumes = await sql`SELECT * FROM volumes WHERE project_id = ${pid} ORDER BY volume_number`
  const chapters = await sql`SELECT * FROM chapters WHERE project_id = ${pid} ORDER BY volume_id, chapter_number`

  const volumesWithChapters = volumes.map(v => ({
    ...v,
    chapters: chapters.filter(ch => ch.volume_id === v.id)
  }))

  return c.json({
    data: {
      basicInfo: basicInfo || {},
      volumes: volumesWithChapters
    }
  })
})

// ---------- Logging helper ----------

async function writeLog(projectId, taskId, level, message) {
  try {
    await sql`INSERT INTO generation_logs (project_id, task_id, level, message) VALUES (${projectId}, ${taskId}, ${level}, ${message})`
  } catch { /* best-effort logging */ }
}

function createChunkLogger(projectId, taskId) {
  let buffer = ''
  const FLUSH_SIZE = 80
  return {
    push(text) {
      buffer += text
      if (buffer.length >= FLUSH_SIZE) {
        const chunk = buffer
        buffer = ''
        writeLog(projectId, taskId, 'chunk', chunk)
      }
    },
    async flush() {
      if (buffer) {
        await writeLog(projectId, taskId, 'chunk', buffer)
        buffer = ''
      }
    }
  }
}

// ---------- Background processors ----------

const STEP_MAX_TOKENS = {
  basic_info: 4096,
  world_building: 128000,
  characters: 128000,
  relations: 128000,
  plot_control: 128000,
  volumes: 128000,
  writing_style: 128000
}

async function processStepByStep(taskId, projectId, prompt, userConfig, startIdx) {
  for (let i = startIdx; i < GENERATION_STEPS.length; i++) {
    const step = GENERATION_STEPS[i]
    const label = STEP_LABELS[step] || step

    try {
      await sql`UPDATE projects SET generation_step = ${step}, updated_at = NOW() WHERE id = ${projectId}`
      await writeLog(projectId, taskId, 'info', `开始生成「${label}」...`)

      let existingMaterial = {}
      try {
        const [latest] = await sql`SELECT content FROM materials WHERE project_id = ${projectId} ORDER BY version DESC LIMIT 1`
        if (latest) existingMaterial = latest.content
      } catch { /* first run, no material yet */ }

      const systemPrompt = buildStepPrompt(step, prompt, existingMaterial)
      const userPrompt = prompt || '请根据已有物料生成本部分内容'
      const maxTokens = STEP_MAX_TOKENS[step] || 128000
      const chunker = createChunkLogger(projectId, taskId)
      const result = await callAI(userConfig, systemPrompt, userPrompt, {
        json_mode: true, max_tokens: maxTokens,
        onChunk: (t) => chunker.push(t)
      })
      await chunker.flush()

      await parseAndSaveSection(projectId, step, result)
      await compileMaterial(projectId)
      await writeLog(projectId, taskId, 'success', `「${label}」生成完成`)

    } catch (err) {
      console.error(`Step ${step} failed:`, err)
      await writeLog(projectId, taskId, 'error', `「${label}」生成失败: ${err.message || '未知错误'}`)
      await sql`UPDATE ai_tasks SET status = 'failed', result = ${err.message || '未知错误'}, completed_at = NOW() WHERE id = ${taskId}`

      const [proj] = await sql`SELECT name FROM projects WHERE id = ${projectId}`
      const newName = proj?.name === '生成中...' ? '未命名项目' : proj?.name
      await sql`UPDATE projects SET name = ${newName}, generation_status = 'failed', generation_step = ${step}, updated_at = NOW() WHERE id = ${projectId}`
      return
    }
  }

  await writeLog(projectId, taskId, 'success', '全部物料生成完成')
  await sql`UPDATE ai_tasks SET status = 'completed', completed_at = NOW() WHERE id = ${taskId}`
  await sql`UPDATE projects SET generation_status = 'completed', generation_step = NULL, updated_at = NOW() WHERE id = ${projectId}`
}

async function processSingleSection(taskId, projectId, section, prompt, userConfig) {
  const label = STEP_LABELS[section] || section
  try {
    await writeLog(projectId, taskId, 'info', `开始重新生成「${label}」...`)

    let existingMaterial = {}
    try {
      const material = await compileMaterial(projectId)
      existingMaterial = material.content
    } catch { /* ignore */ }

    const systemPrompt = buildStepPrompt(section, prompt, existingMaterial)
    const userPrompt = prompt || `请重新生成该部分内容，保持与其他部分的一致性`
    const maxTokens = STEP_MAX_TOKENS[section] || 128000
    const chunker = createChunkLogger(projectId, taskId)
    const result = await callAI(userConfig, systemPrompt, userPrompt, {
      json_mode: true, max_tokens: maxTokens,
      onChunk: (t) => chunker.push(t)
    })
    await chunker.flush()

    await parseAndSaveSection(projectId, section, result)
    await compileMaterial(projectId)

    await writeLog(projectId, taskId, 'success', `「${label}」重新生成完成`)
    await sql`UPDATE ai_tasks SET status = 'completed', result = ${result}, completed_at = NOW() WHERE id = ${taskId}`
    await sql`UPDATE projects SET generation_status = 'completed', generation_step = NULL, updated_at = NOW() WHERE id = ${projectId}`
  } catch (err) {
    console.error('Section generation failed:', err)
    await writeLog(projectId, taskId, 'error', `「${label}」生成失败: ${err.message || '未知错误'}`)
    await sql`UPDATE ai_tasks SET status = 'failed', result = ${err.message || '未知错误'}, completed_at = NOW() WHERE id = ${taskId}`
    await sql`UPDATE projects SET generation_status = 'failed', generation_step = ${section}, updated_at = NOW() WHERE id = ${projectId}`
  }
}

async function processChapterOutlines(taskId, projectId, volume, prompt, userConfig) {
  try {
    await writeLog(projectId, taskId, 'info', `开始生成第${volume.volume_number}卷章节大纲...`)

    let material = {}
    try {
      const [latest] = await sql`SELECT content FROM materials WHERE project_id = ${projectId} ORDER BY version DESC LIMIT 1`
      if (latest) material = latest.content
    } catch { /* ignore */ }

    const systemPrompt = buildChapterOutlinesPrompt(volume, material)
    const userPrompt = prompt || `请为第${volume.volume_number}卷生成章节大纲`
    const chunker = createChunkLogger(projectId, taskId)
    const result = await callAI(userConfig, systemPrompt, userPrompt, {
      json_mode: true, max_tokens: 8192,
      onChunk: (t) => chunker.push(t)
    })
    await chunker.flush()

    const data = JSON.parse(result.trim().replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, ''))
    const chapters = data.chapters || data

    await sql`DELETE FROM chapters WHERE volume_id = ${volume.id} AND project_id = ${projectId}`

    for (const ch of chapters) {
      const outline = [ch.outline || '', ch.key_scenes ? `【关键场景】${ch.key_scenes}` : ''].filter(Boolean).join('\n')
      await sql`INSERT INTO chapters (project_id, volume_id, chapter_number, title, content, status, word_count)
        VALUES (${projectId}, ${volume.id}, ${ch.chapter_number || 1}, ${ch.title || ''},
          ${outline}, 'draft', ${ch.word_target || 3000})`
    }

    await writeLog(projectId, taskId, 'success', `第${volume.volume_number}卷章节大纲生成完成，共 ${chapters.length} 章`)
    await sql`UPDATE ai_tasks SET status = 'completed', result = ${result}, completed_at = NOW() WHERE id = ${taskId}`
  } catch (err) {
    console.error('Chapter outline generation failed:', err)
    await writeLog(projectId, taskId, 'error', `章节大纲生成失败: ${err.message || '未知错误'}`)
    await sql`UPDATE ai_tasks SET status = 'failed', result = ${err.message || '未知错误'}, completed_at = NOW() WHERE id = ${taskId}`
  }
}

async function processChapterContent(taskId, projectId, chapter, volume, userConfig) {
  try {
    await writeLog(projectId, taskId, 'info', `开始生成第${volume.volume_number}卷第${chapter.chapter_number}章「${chapter.title}」正文...`)

    let material = {}
    try {
      const [latest] = await sql`SELECT content FROM materials WHERE project_id = ${projectId} ORDER BY version DESC LIMIT 1`
      if (latest) material = latest.content
    } catch { /* ignore */ }

    const systemPrompt = buildChapterContentPrompt(chapter, volume, material)
    const userPrompt = `请写出第${volume.volume_number}卷第${chapter.chapter_number}章「${chapter.title}」的完整正文`
    const chunker = createChunkLogger(projectId, taskId)
    const result = await callAI(userConfig, systemPrompt, userPrompt, {
      json_mode: true, max_tokens: 16384,
      onChunk: (t) => chunker.push(t)
    })
    await chunker.flush()

    const data = JSON.parse(result.trim().replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, ''))
    const content = data.content || ''
    const title = data.title || chapter.title
    const wordCount = content.length

    await sql`UPDATE chapters SET title = ${title}, content = ${content}, word_count = ${wordCount}, status = 'completed', updated_at = NOW() WHERE id = ${chapter.id}`
    await writeLog(projectId, taskId, 'success', `第${chapter.chapter_number}章正文生成完成，共 ${wordCount} 字`)
    await sql`UPDATE ai_tasks SET status = 'completed', result = ${`已生成 ${wordCount} 字`}, completed_at = NOW() WHERE id = ${taskId}`
  } catch (err) {
    console.error('Chapter content generation failed:', err)
    await writeLog(projectId, taskId, 'error', `正文生成失败: ${err.message || '未知错误'}`)
    await sql`UPDATE ai_tasks SET status = 'failed', result = ${err.message || '未知错误'}, completed_at = NOW() WHERE id = ${taskId}`
  }
}

// ---------- Log endpoints ----------

ai.get('/:id/generation-logs', async (c) => {
  const pid = await verifyProjectOwner(c)
  if (!pid) return c.json({ error: '项目不存在' }, 404)

  const taskId = c.req.query('task_id')
  const afterId = parseInt(c.req.query('after_id')) || 0
  const limit = Math.min(parseInt(c.req.query('limit')) || 200, 500)

  let rows
  if (taskId) {
    rows = await sql`SELECT id, level, message, created_at FROM generation_logs WHERE project_id = ${pid} AND task_id = ${taskId} AND id > ${afterId} ORDER BY id ASC LIMIT ${limit}`
  } else {
    rows = await sql`SELECT id, level, message, created_at FROM generation_logs WHERE project_id = ${pid} AND id > ${afterId} ORDER BY id ASC LIMIT ${limit}`
  }

  return c.json({ data: rows })
})

ai.get('/:id/generation-logs/stream', async (c) => {
  // SSE: EventSource can't send headers, accept token from query
  let pid
  const queryToken = c.req.query('token')
  if (queryToken) {
    try {
      const payload = verifyToken(queryToken)
      const projectId = c.req.param('id')
      const [p] = await sql`SELECT id FROM projects WHERE id = ${projectId} AND user_id = ${payload.id}`
      pid = p ? projectId : null
    } catch {
      return c.json({ error: '认证失败' }, 401)
    }
  } else {
    pid = await verifyProjectOwner(c)
  }
  if (!pid) return c.json({ error: '项目不存在' }, 404)

  let lastId = parseInt(c.req.query('after_id')) || 0
  let closed = false

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()
      const send = (data) => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)) } catch { /* closed */ }
      }

      const poll = setInterval(async () => {
        if (closed) { clearInterval(poll); return }
        try {
          const rows = await sql`SELECT id, level, message, created_at FROM generation_logs WHERE project_id = ${pid} AND id > ${lastId} ORDER BY id ASC LIMIT 50`
          for (const row of rows) {
            send(row)
            lastId = row.id
          }
        } catch { /* ignore db errors during poll */ }
      }, 1500)

      c.req.raw.signal?.addEventListener('abort', () => {
        closed = true
        clearInterval(poll)
        try { controller.close() } catch { /* already closed */ }
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  })
})

function buildSingleItemPrompt(itemType, existingMaterial, userContext) {
  const ctx = existingMaterial && Object.keys(existingMaterial).length
    ? `\n\n【当前已有物料（请保持一致性）】\n${JSON.stringify(existingMaterial, null, 2)}`
    : ''

  const JSON_RULE = '你必须返回严格的 JSON 格式。不要包含任何额外文字、markdown 标记、代码块标记。直接返回 JSON 对象。'

  if (itemType === 'character') {
    return `你是一位角色塑造专家。请基于已有物料和用户要求，设计一个新的角色。

${JSON_RULE}

JSON 结构：
{
  "name": "角色全名",
  "role_type": "male_lead / female_lead / supporting / antagonist",
  "description": "角色详述（150字以上，包括外貌、性格、出身、技能）",
  "core_desire": "核心欲望（50字以上）",
  "weakness": "致命弱点（50字以上）",
  "secret": "核心秘密（50字以上）"
}

要求：
1. 与已有角色形成互补或对立，不要重复已有角色类型
2. 角色要有独特的辨识度
3. 秘密和弱点要能融入已有剧情体系${ctx}`
  }

  if (itemType === 'relation') {
    const charNames = existingMaterial?.characters?.map(c => c.name) || []
    const charHint = charNames.length
      ? `\n\n【当前角色列表】：${charNames.join('、')}\n⚠️ from_name 和 to_name 必须严格使用以上角色名。`
      : ''

    return `你是一位人物关系架构师。请基于已有角色和物料，生成一条新的人物关系。

${JSON_RULE}

JSON 结构：
{
  "from_name": "角色A名字",
  "to_name": "角色B名字",
  "relation_type": "同盟/敌对/恋人/暗恋/虐恋/亲属/上下级/师徒/挚友/竞争/利用/监视/宿命/对照",
  "faction": "阵营",
  "interest_link": "利益链（50字左右）",
  "emotion_link": "情感链（50字左右）",
  "description": "关系动态（50字左右）"
}

要求：
1. 优先为缺少关系的角色建立联系
2. 关系要有灰色地带，不要太简单直白
3. from_name 和 to_name 必须与角色列表中的名字完全一致${charHint}${ctx}`
  }

  if (itemType === 'volume') {
    const volCount = existingMaterial?.volumes?.length || 0
    return `你是一位分卷策划师。请基于已有物料，生成一个新的卷大纲。

${JSON_RULE}

JSON 结构：
{
  "volume_number": ${volCount + 1},
  "title": "卷标题（格式：第X卷：主标题）",
  "goal": "本卷核心目标（150字以上）",
  "summary": "详细内容概要（300字以上）"
}

要求：
1. 与前面的卷情节衔接，冲突层层升级
2. 有明确的起承转合
3. 结尾有钩子引导读者继续${ctx}`
  }

  return ''
}

export default ai
