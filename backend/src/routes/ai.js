import { Hono } from 'hono'
import sql from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'
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

// ---------- Background processors ----------

const STEP_MAX_TOKENS = {
  basic_info: 4096,
  world_building: 8192,
  characters: 8192,
  relations: 8192,
  plot_control: 8192,
  volumes: 8192,
  writing_style: 4096
}

async function processStepByStep(taskId, projectId, prompt, userConfig, startIdx) {
  for (let i = startIdx; i < GENERATION_STEPS.length; i++) {
    const step = GENERATION_STEPS[i]

    try {
      await sql`UPDATE projects SET generation_step = ${step}, updated_at = NOW() WHERE id = ${projectId}`

      let existingMaterial = {}
      try {
        const [latest] = await sql`SELECT content FROM materials WHERE project_id = ${projectId} ORDER BY version DESC LIMIT 1`
        if (latest) existingMaterial = latest.content
      } catch { /* first run, no material yet */ }

      const systemPrompt = buildStepPrompt(step, prompt, existingMaterial)
      const userPrompt = prompt || '请根据已有物料生成本部分内容'
      const maxTokens = STEP_MAX_TOKENS[step] || 128000
      const result = await callAI(userConfig, systemPrompt, userPrompt, { json_mode: true, max_tokens: maxTokens })

      await parseAndSaveSection(projectId, step, result)
      await compileMaterial(projectId)

    } catch (err) {
      console.error(`Step ${step} failed:`, err)
      await sql`UPDATE ai_tasks SET status = 'failed', result = ${err.message || '未知错误'}, completed_at = NOW() WHERE id = ${taskId}`

      const [proj] = await sql`SELECT name FROM projects WHERE id = ${projectId}`
      const newName = proj?.name === '生成中...' ? '未命名项目' : proj?.name
      await sql`UPDATE projects SET name = ${newName}, generation_status = 'failed', generation_step = ${step}, updated_at = NOW() WHERE id = ${projectId}`
      return
    }
  }

  await sql`UPDATE ai_tasks SET status = 'completed', completed_at = NOW() WHERE id = ${taskId}`
  await sql`UPDATE projects SET generation_status = 'completed', generation_step = NULL, updated_at = NOW() WHERE id = ${projectId}`
}

async function processSingleSection(taskId, projectId, section, prompt, userConfig) {
  try {
    let existingMaterial = {}
    try {
      const material = await compileMaterial(projectId)
      existingMaterial = material.content
    } catch { /* ignore */ }

    const systemPrompt = buildStepPrompt(section, prompt, existingMaterial)
    const userPrompt = prompt || `请重新生成该部分内容，保持与其他部分的一致性`
    const maxTokens = STEP_MAX_TOKENS[section] || 128000
    const result = await callAI(userConfig, systemPrompt, userPrompt, { json_mode: true, max_tokens: maxTokens })

    await parseAndSaveSection(projectId, section, result)
    await compileMaterial(projectId)

    await sql`UPDATE ai_tasks SET status = 'completed', result = ${result}, completed_at = NOW() WHERE id = ${taskId}`
    await sql`UPDATE projects SET generation_status = 'completed', generation_step = NULL, updated_at = NOW() WHERE id = ${projectId}`
  } catch (err) {
    console.error('Section generation failed:', err)
    await sql`UPDATE ai_tasks SET status = 'failed', result = ${err.message || '未知错误'}, completed_at = NOW() WHERE id = ${taskId}`
    await sql`UPDATE projects SET generation_status = 'failed', generation_step = ${section}, updated_at = NOW() WHERE id = ${projectId}`
  }
}

async function processChapterOutlines(taskId, projectId, volume, prompt, userConfig) {
  try {
    let material = {}
    try {
      const [latest] = await sql`SELECT content FROM materials WHERE project_id = ${projectId} ORDER BY version DESC LIMIT 1`
      if (latest) material = latest.content
    } catch { /* ignore */ }

    const systemPrompt = buildChapterOutlinesPrompt(volume, material)
    const userPrompt = prompt || `请为第${volume.volume_number}卷生成章节大纲`
    const result = await callAI(userConfig, systemPrompt, userPrompt, { json_mode: true, max_tokens: 8192 })

    const data = JSON.parse(result.trim().replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, ''))
    const chapters = data.chapters || data

    // Delete existing chapters for this volume
    await sql`DELETE FROM chapters WHERE volume_id = ${volume.id} AND project_id = ${projectId}`

    for (const ch of chapters) {
      const outline = [ch.outline || '', ch.key_scenes ? `【关键场景】${ch.key_scenes}` : ''].filter(Boolean).join('\n')
      await sql`INSERT INTO chapters (project_id, volume_id, chapter_number, title, content, status, word_count)
        VALUES (${projectId}, ${volume.id}, ${ch.chapter_number || 1}, ${ch.title || ''},
          ${outline}, 'draft', ${ch.word_target || 3000})`
    }

    await sql`UPDATE ai_tasks SET status = 'completed', result = ${result}, completed_at = NOW() WHERE id = ${taskId}`
  } catch (err) {
    console.error('Chapter outline generation failed:', err)
    await sql`UPDATE ai_tasks SET status = 'failed', result = ${err.message || '未知错误'}, completed_at = NOW() WHERE id = ${taskId}`
  }
}

async function processChapterContent(taskId, projectId, chapter, volume, userConfig) {
  try {
    let material = {}
    try {
      const [latest] = await sql`SELECT content FROM materials WHERE project_id = ${projectId} ORDER BY version DESC LIMIT 1`
      if (latest) material = latest.content
    } catch { /* ignore */ }

    const systemPrompt = buildChapterContentPrompt(chapter, volume, material)
    const userPrompt = `请写出第${volume.volume_number}卷第${chapter.chapter_number}章「${chapter.title}」的完整正文`
    const result = await callAI(userConfig, systemPrompt, userPrompt, { json_mode: true, max_tokens: 16384 })

    const data = JSON.parse(result.trim().replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, ''))
    const content = data.content || ''
    const title = data.title || chapter.title
    const wordCount = content.length

    await sql`UPDATE chapters SET title = ${title}, content = ${content}, word_count = ${wordCount}, status = 'completed', updated_at = NOW() WHERE id = ${chapter.id}`
    await sql`UPDATE ai_tasks SET status = 'completed', result = ${`已生成 ${wordCount} 字`}, completed_at = NOW() WHERE id = ${taskId}`
  } catch (err) {
    console.error('Chapter content generation failed:', err)
    await sql`UPDATE ai_tasks SET status = 'failed', result = ${err.message || '未知错误'}, completed_at = NOW() WHERE id = ${taskId}`
  }
}

export default ai
