import { Hono } from 'hono'
import sql from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'
import { compileMaterial } from '../services/material.js'
import { callAI, buildStepPrompt, buildChapterOutlinesPrompt, buildChapterContentPrompt, buildStoryboardPrompt, contextBlock, GENERATION_STEPS, STEP_LABELS } from '../services/ai.js'
import { parseAndSaveSection } from '../services/parser.js'

const ai = new Hono()
ai.use('*', authMiddleware)

const JSON_RULE = '你必须返回严格的 JSON 格式。不要包含任何额外文字、markdown 标记、代码块标记。直接返回 JSON 对象。'

async function verifyProjectOwner(c) {
  const userId = c.get('userId')
  const pid = c.req.param('id')
  const [p] = await sql`SELECT id FROM projects WHERE id = ${pid} AND user_id = ${userId}`
  return p ? pid : null
}

async function getUserAIConfig(userId) {
  const [user] = await sql`SELECT ai_api_url, ai_api_key, ai_model, ai_max_tokens FROM users WHERE id = ${userId}`
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

  await sql`DELETE FROM generation_logs WHERE project_id = ${pid}`
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

// Stop generation
ai.post('/:id/stop-generation', async (c) => {
  const pid = await verifyProjectOwner(c)
  if (!pid) return c.json({ error: '项目不存在' }, 404)

  const [proj] = await sql`SELECT generation_status, generation_step FROM projects WHERE id = ${pid}`
  if (proj.generation_status !== 'generating') {
    return c.json({ error: '当前没有正在进行的生成任务' }, 400)
  }

  await sql`UPDATE ai_tasks SET status = 'failed', result = '用户手动停止', completed_at = NOW() WHERE project_id = ${pid} AND status = 'running'`
  await sql`UPDATE projects SET generation_status = 'failed', updated_at = NOW() WHERE id = ${pid}`

  return c.json({ message: '已停止生成' })
})

// Cascade regeneration: regenerate all steps AFTER the given step
ai.post('/:id/regenerate-from', async (c) => {
  const pid = await verifyProjectOwner(c)
  if (!pid) return c.json({ error: '项目不存在' }, 404)

  const { after_step } = await c.req.json()
  const stepIdx = GENERATION_STEPS.indexOf(after_step)
  if (stepIdx === -1) return c.json({ error: '无效的步骤' }, 400)

  const startIdx = stepIdx + 1
  if (startIdx >= GENERATION_STEPS.length) {
    return c.json({ error: '该步骤之后没有需要生成的内容' }, 400)
  }

  const [proj] = await sql`SELECT generation_status, initial_prompt FROM projects WHERE id = ${pid}`
  if (proj.generation_status === 'generating') {
    return c.json({ error: '当前有正在进行的生成任务' }, 400)
  }

  const userId = c.get('userId')
  const userConfig = await getUserAIConfig(userId)

  await compileMaterial(pid)
  await sql`DELETE FROM generation_logs WHERE project_id = ${pid}`
  await sql`UPDATE projects SET generation_status = 'generating', updated_at = NOW() WHERE id = ${pid}`

  const stepsToRegen = GENERATION_STEPS.slice(startIdx).map(s => STEP_LABELS[s] || s).join('、')
  const [task] = await sql`
    INSERT INTO ai_tasks (project_id, task_type, status, prompt)
    VALUES (${pid}, ${`cascade_from_${after_step}`}, 'running', ${`用户修改了「${STEP_LABELS[after_step] || after_step}」，级联重新生成：${stepsToRegen}`})
    RETURNING *
  `

  processStepByStep(task.id, pid, proj.initial_prompt, userConfig, startIdx).catch(console.error)

  return c.json({ data: task, steps: GENERATION_STEPS.slice(startIdx) })
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

  await sql`DELETE FROM generation_logs WHERE project_id = ${pid}`
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

  const { item_type, context, user_data } = await c.req.json()
  const validTypes = ['character', 'relation', 'volume', 'plot_device', 'chapter']
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

  const prompt = buildSingleItemPrompt(item_type, existingMaterial, context, user_data)
  try {
    const result = await callAI(userConfig, prompt, context || '请生成一条新内容', { json_mode: true, max_tokens: userConfig.ai_max_tokens || 4096 })
    const parsed = JSON.parse(result.trim().replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, ''))
    return c.json({ data: parsed })
  } catch (err) {
    return c.json({ error: err.message || 'AI 生成失败' }, 500)
  }
})

// Batch regenerate plot devices
ai.post('/:id/regenerate-plot-devices', async (c) => {
  const pid = await verifyProjectOwner(c)
  if (!pid) return c.json({ error: '项目不存在' }, 404)

  const userId = c.get('userId')
  const userConfig = await getUserAIConfig(userId)

  let existingMaterial = {}
  try {
    const compiled = await compileMaterial(pid)
    existingMaterial = compiled.content || {}
  } catch { /* ignore */ }

  const ctx = contextBlock(existingMaterial)
  const prompt = `你是一位精通叙事设计的编剧顾问。请基于已有物料，为这部小说生成 3-5 个叙事装置（伏笔、反转、信息差混合搭配）。
${JSON_RULE}
返回格式：{ "devices": [ { "device_type": "foreshadowing" | "reversal" | "info_gap", "description": "描述", "setup_chapter": 数字（埋设章节）, "payoff_chapter": 数字（揭示/兑现章节）, "status": "planted" } ] }
要求：
- device_type 只能是 foreshadowing（伏笔）、reversal（反转）、info_gap（信息差）之一
- 每个装置要与现有剧情和角色紧密关联
- 叙事装置之间应有层次感，不要重复同一模式
- setup_chapter < payoff_chapter
- 如果已有 plot_devices，可以在其基础上补充完善，也可以全新设计
${ctx}`

  try {
    const result = await callAI(userConfig, prompt, '请生成叙事装置', { json_mode: true, max_tokens: userConfig.ai_max_tokens || 8192 })
    const parsed = JSON.parse(result.trim().replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, ''))

    const devices = parsed.devices || parsed.plot_devices || []
    if (devices.length) {
      await sql`DELETE FROM plot_devices WHERE project_id = ${pid}`
      for (const d of devices) {
        await sql`INSERT INTO plot_devices (project_id, device_type, description, setup_chapter, payoff_chapter, status)
          VALUES (${pid}, ${d.device_type || 'foreshadowing'}, ${d.description || ''}, ${d.setup_chapter || null}, ${d.payoff_chapter || null}, ${d.status || 'planted'})`
      }
      await compileMaterial(pid)
    }

    return c.json({ data: devices })
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

// Generate storyboards for a chapter
ai.post('/:id/generate-storyboards', async (c) => {
  const pid = await verifyProjectOwner(c)
  if (!pid) return c.json({ error: '项目不存在' }, 404)

  const { chapter_id } = await c.req.json()
  if (!chapter_id) return c.json({ error: '请指定章节' }, 400)

  const [chapter] = await sql`SELECT * FROM chapters WHERE id = ${chapter_id} AND project_id = ${pid}`
  if (!chapter) return c.json({ error: '章节不存在' }, 404)

  const [volume] = await sql`SELECT * FROM volumes WHERE id = ${chapter.volume_id}`

  const userId = c.get('userId')
  const [user] = await sql`SELECT ai_api_url, ai_api_key, ai_model, ai_max_tokens,
    storyboard_api_url, storyboard_api_key, storyboard_model FROM users WHERE id = ${userId}`

  // 优先用分镜接口，没配置则降级到文本接口
  const storyboardConfig = {
    ai_api_url: user.storyboard_api_url || user.ai_api_url,
    ai_api_key: user.storyboard_api_key || user.ai_api_key,
    ai_model: user.storyboard_model || user.ai_model,
    ai_max_tokens: user.ai_max_tokens
  }

  let material = {}
  try {
    const [latest] = await sql`SELECT content FROM materials WHERE project_id = ${pid} ORDER BY version DESC LIMIT 1`
    if (latest) material = latest.content
  } catch { /* ignore */ }

  const systemPrompt = buildStoryboardPrompt(chapter, volume, material)
  const userPrompt = `请为第${volume?.volume_number || ''}卷第${chapter.chapter_number}章「${chapter.title}」生成分镜脚本`

  try {
    const text = await callAI(storyboardConfig, systemPrompt, userPrompt, {
      max_tokens: storyboardConfig.ai_max_tokens || 4096
    })
    const storyboardText = text.trim()

    await sql`UPDATE chapters SET storyboard_text = ${storyboardText}, updated_at = NOW() WHERE id = ${chapter_id}`
    return c.json({ data: storyboardText })
  } catch (err) {
    return c.json({ error: err.message || '分镜生成失败' }, 500)
  }
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

let logTableReady = false
async function ensureLogTable() {
  if (logTableReady) return
  try {
    await sql`CREATE TABLE IF NOT EXISTS generation_logs (
      id SERIAL PRIMARY KEY,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      task_id INTEGER REFERENCES ai_tasks(id) ON DELETE CASCADE,
      level VARCHAR(10) DEFAULT 'info',
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )`
    logTableReady = true
  } catch (e) {
    console.error('[writeLog] ensureLogTable failed:', e.message)
  }
}

async function writeLog(projectId, taskId, level, message) {
  try {
    await ensureLogTable()
    await sql`INSERT INTO generation_logs (project_id, task_id, level, message) VALUES (${projectId}, ${taskId}, ${level}, ${message})`
  } catch (e) {
    console.error('[writeLog] failed:', e.message)
  }
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

async function isTaskStopped(taskId) {
  const [task] = await sql`SELECT status FROM ai_tasks WHERE id = ${taskId}`
  return !task || task.status === 'failed'
}

const STEP_MATERIAL_KEYS = {
  basic_info: ['basic_info'],
  world_building: ['world_building'],
  characters: ['characters'],
  relations: ['relations'],
  plot_control: ['plot', 'plot_devices'],
  volumes: ['volumes', 'chapters_summary'],
  writing_style: ['writing_style']
}

async function processStepByStep(taskId, projectId, prompt, userConfig, startIdx) {
  for (let i = startIdx; i < GENERATION_STEPS.length; i++) {
    if (await isTaskStopped(taskId)) {
      await writeLog(projectId, taskId, 'info', '生成已被用户停止')
      return
    }

    const step = GENERATION_STEPS[i]
    const label = STEP_LABELS[step] || step

    try {
      await sql`UPDATE projects SET generation_step = ${step}, updated_at = NOW() WHERE id = ${projectId}`
      await writeLog(projectId, taskId, 'info', `开始生成「${label}」...`)

      let existingMaterial = {}
      try {
        const compiled = await compileMaterial(projectId)
        existingMaterial = compiled.content || {}
      } catch { /* first run, no material yet */ }

      if (startIdx > 0) {
        const keysToRemove = new Set()
        for (let j = i; j < GENERATION_STEPS.length; j++) {
          const keys = STEP_MATERIAL_KEYS[GENERATION_STEPS[j]] || []
          keys.forEach(k => keysToRemove.add(k))
        }
        for (const k of keysToRemove) {
          delete existingMaterial[k]
        }
      }

      const systemPrompt = buildStepPrompt(step, prompt, existingMaterial)
      const userPrompt = prompt || '请根据已有物料生成本部分内容'
      const maxTokens = userConfig.ai_max_tokens || STEP_MAX_TOKENS[step] || 128000
      const chunker = createChunkLogger(projectId, taskId)
      const result = await callAI(userConfig, systemPrompt, userPrompt, {
        json_mode: true, max_tokens: maxTokens,
        onChunk: (t) => chunker.push(t)
      })
      await chunker.flush()

      if (await isTaskStopped(taskId)) {
        await writeLog(projectId, taskId, 'info', '生成已被用户停止')
        return
      }

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

    const [proj] = await sql`SELECT initial_prompt FROM projects WHERE id = ${projectId}`
    const initialPrompt = proj?.initial_prompt || ''

    const systemPrompt = buildStepPrompt(section, prompt, existingMaterial)
    let userPrompt = ''
    if (initialPrompt) {
      userPrompt += `【项目原始创作提示词（必须严格遵守此创作方向）】\n${initialPrompt}\n\n`
    }
    if (prompt) {
      userPrompt += `【用户本次补充要求】\n${prompt}`
    } else {
      userPrompt += '请基于项目原始创作方向和已有物料，重新生成该部分内容，确保与项目整体设定高度一致'
    }
    const maxTokens = userConfig.ai_max_tokens || STEP_MAX_TOKENS[section] || 128000
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

    let existingChapters = []
    try {
      existingChapters = await sql`
        SELECT c.chapter_number, c.title, c.content AS outline, v.volume_number
        FROM chapters c
        JOIN volumes v ON v.id = c.volume_id
        WHERE c.project_id = ${projectId}
        ORDER BY v.volume_number, c.chapter_number
      `
    } catch { /* ignore */ }

    const systemPrompt = buildChapterOutlinesPrompt(volume, material, existingChapters)
    const userPrompt = prompt || `请为第${volume.volume_number}卷生成章节大纲`
    const chunker = createChunkLogger(projectId, taskId)
    const result = await callAI(userConfig, systemPrompt, userPrompt, {
      json_mode: true, max_tokens: userConfig.ai_max_tokens || 32768,
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
          ${outline}, 'draft', 0)`
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
      json_mode: true, max_tokens: userConfig.ai_max_tokens || 16384,
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
  const pid = await verifyProjectOwner(c)
  if (!pid) return c.json({ error: '项目不存在' }, 404)

  let lastId = parseInt(c.req.query('after_id')) || 0
  let closed = false

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()
      const send = (data) => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)) } catch { /* closed */ }
      }
      const heartbeat = () => {
        try { controller.enqueue(encoder.encode(`: heartbeat\n\n`)) } catch { /* closed */ }
      }

      // Send initial heartbeat immediately so the connection is established
      heartbeat()

      const poll = setInterval(async () => {
        if (closed) { clearInterval(poll); return }
        try {
          const rows = await sql`SELECT id, level, message, created_at FROM generation_logs WHERE project_id = ${pid} AND id > ${lastId} ORDER BY id ASC LIMIT 50`
          if (rows.length) {
            for (const row of rows) {
              send(row)
              lastId = row.id
            }
          } else {
            heartbeat()
          }
        } catch { heartbeat() }
      }, 1500)

      const cleanup = () => {
        closed = true
        clearInterval(poll)
        try { controller.close() } catch { /* already closed */ }
      }

      c.req.raw.signal?.addEventListener('abort', cleanup)
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  })
})

function buildSingleItemPrompt(itemType, existingMaterial, userContext, userData) {
  const ctx = existingMaterial && Object.keys(existingMaterial).length
    ? `\n\n【当前已有物料（请保持一致性）】\n${JSON.stringify(existingMaterial, null, 2)}`
    : ''

  if (itemType === 'character') {
    const existingChars = existingMaterial?.characters || []
    const charNameList = existingChars.map(c => c.name).filter(Boolean)
    const charForbid = charNameList.length
      ? `\n\n⚠️⚠️⚠️ 【禁止重复】以下角色名已存在，新角色的名字绝对不能与它们相同或相似：\n${charNameList.map(n => `- ${n}`).join('\n')}\n请确保生成一个全新的、独一无二的角色名！`
      : ''
    const charSummary = existingChars.length
      ? `\n\n【已有角色概览】\n${existingChars.map(c => `- ${c.name}（${c.role_type}）：${(c.description || '').slice(0, 60)}`).join('\n')}`
      : ''

    const hasUserData = userData && Object.values(userData).some(v => v && String(v).trim())
    const filledFields = []
    const emptyFields = []
    if (hasUserData) {
      const fieldLabels = { name: '角色名', role_type: '角色类型', description: '角色描述', core_desire: '核心欲望', weakness: '弱点', secret: '秘密', image_prompt: '形象提示词' }
      for (const [key, label] of Object.entries(fieldLabels)) {
        const val = userData[key]
        if (val && String(val).trim() && key !== 'id' && key !== 'avatar_color') {
          filledFields.push({ key, label, value: String(val).trim() })
        } else {
          emptyFields.push({ key, label })
        }
      }
    }

    let fillInstruction = ''
    if (hasUserData && filledFields.length > 0) {
      fillInstruction = `

⚠️⚠️⚠️【智能填充模式 — 最高优先级】
用户已经填写了部分角色信息，你的任务是 **基于用户已填内容进行补充和优化**，而不是生成全新内容。

用户已填写的内容（必须保留并作为创作基础）：
${filledFields.map(f => `  - ${f.label}：${f.value}`).join('\n')}

需要你填充/生成的字段：
${emptyFields.map(f => `  - ${f.label}`).join('\n')}

核心规则：
1. 用户已填写的字段（如名字、描述等），你可以在此基础上润色扩展，但**不能改变核心含义和方向**
2. 如果用户填了名字，返回的 name 必须与用户填写的完全一致
3. 如果用户填了描述，你的 description 必须包含用户的描述内容，可以在此基础上丰富拓展
4. 空白字段则根据已有信息和项目物料进行合理创作`
    }

    return `你是一位角色塑造专家。请基于已有物料和用户要求，设计一个新的角色。
${fillInstruction}
${JSON_RULE}

JSON 结构：
{
  "name": "角色全名",
  "role_type": "male_lead / female_lead / supporting / antagonist / minor",
  "description": "角色详述（150字以上，包括外貌、性格、出身、技能）",
  "core_desire": "核心欲望（50字以上）",
  "weakness": "致命弱点（50字以上）",
  "secret": "核心秘密（50字以上）",
  "image_prompt": "角色形象提示词（中文，200字以上，专为AI绘图/视频生成。按维度逐一描写：①年龄性别体型 ②面部五官细节（眼型眼色、鼻梁、嘴唇、肤色、标志印记或疤痕） ③发型发色质感 ④服装材质款式层次 ⑤配饰道具 ⑥气质神态眼神姿态 ⑦背景环境氛围 ⑧画风关键词（写实/电影质感/8K超清）。禁止笼统抽象，每项必须有具体细节，可直接用于AI绘图/视频生成）"
}

要求：
1. 与已有角色形成互补或对立，不要重复已有角色的名字和类型
2. 角色要有独特的辨识度，名字必须是全新的
3. 秘密和弱点要能融入已有剧情体系
4. 新角色应与已有角色产生有趣的互动关系${charForbid}${charSummary}${ctx}`
  }

  if (itemType === 'chapter') {
    const chapters = existingMaterial?.chapters || []
    const chapterTitles = chapters.map(c => c.title).filter(Boolean)
    const volSummaries = existingMaterial?.volumes || []

    const chapterList = chapters.length
      ? `\n\n【已有章节（部分）】\n${chapters.slice(0, 30).map(
          c => `- 第${c.chapter_number}章「${c.title || '无标题'}」：${(c.outline || c.content || '').slice(0, 60)}`
        ).join('\n')}`
      : ''

    const forbidBlock = chapterTitles.length
      ? `\n\n⚠️⚠️⚠️ 【标题禁止重复】以下章节标题已经存在，新生成章节标题绝对不能与它们相同：\n${chapterTitles.map(t => `- ${t}`).join('\n')}`
      : ''

    const volBlock = volSummaries.length
      ? `\n\n【分卷信息】\n${volSummaries.map(
          v => `- 第${v.volume_number}卷「${v.title || ''}」：${(v.summary || '').slice(0, 80)}`
        ).join('\n')}`
      : ''

    const userHint = userContext ? `\n\n【用户补充要求】\n${userContext}` : ''

    return `你是一位精通网文结构的章节策划师。请基于已有物料和用户要求，设计一个新的章节大纲（单章）。

${JSON_RULE}
${volBlock}${chapterList}${forbidBlock}${userHint}${ctx}

JSON 结构：
{
  "chapter_number": 1,
  "title": "章节标题（要有悬念感，暗示本章核心冲突）",
  "outline": "章节大纲（80-150字，包括：本章核心事件、出场角色、情感起伏、章末钩子）",
  "key_scenes": "关键场景（简述1-2个本章的高光场面）",
  "word_target": 3000
}

要求：
1. 严格承接已有章节的剧情发展，不要出现时间线或设定冲突
2. 新章节标题必须是全新的，不得与已有标题重复
3. 重点突出本章的核心冲突和情绪起伏
4. 大纲要写清楚出场主要角色及其行为动机
5. 章末必须有一个强钩子推动读者继续阅读`
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

  if (itemType === 'plot_device') {
    return `你是一位精通伏笔设计的编剧顾问。请基于已有物料和用户要求，生成一个新的叙事装置（伏笔/反转/信息差）。

${JSON_RULE}

JSON 结构：
{
  "device_type": "foreshadowing / reversal / info_gap",
  "description": "详细描述（100字以上，包括：①具体内容是什么 ②涉及哪些角色 ③如何埋设 ④预期的读者反应 ⑤回收时的效果）",
  "setup_chapter": null,
  "payoff_chapter": null,
  "status": "planted"
}

device_type 说明：
- foreshadowing（伏笔）：提前埋下线索，后续揭示时让读者恍然大悟
- reversal（反转）：打破读者预期的剧情转折
- info_gap（信息差）：角色之间或角色与读者之间的信息不对等

要求：
1. 必须与已有的角色和剧情紧密结合，不能凭空编造
2. 描述要具体到可以直接写入章节
3. 伏笔要有前后呼应的具体细节
4. 反转要有合理的逻辑支撑，不能太突兀
5. 信息差要说明谁知道、谁不知道、以及何时揭露${ctx}`
  }

  if (itemType === 'volume') {
    const existingVols = existingMaterial?.volumes || []
    const volCount = existingVols.length
    const volTitles = existingVols.map(v => v.title).filter(Boolean)

    const volList = existingVols.length
      ? `\n\n【已有分卷（必须衔接）】\n${existingVols.map(
          v => `- 第${v.volume_number}卷「${v.title || '无标题'}」：${(v.summary || '').slice(0, 80)}`
        ).join('\n')}`
      : ''

    const forbidBlock = volTitles.length
      ? `\n\n⚠️⚠️⚠️ 【标题禁止重复】以下卷标题已存在，新卷标题绝对不能与它们相同：\n${volTitles.map(t => `- ${t}`).join('\n')}`
      : ''

    const userHint = userContext ? `\n\n【用户补充要求】\n${userContext}` : ''

    return `你是一位分卷策划师。请基于已有物料，生成一个新的卷大纲。

${JSON_RULE}
${volList}${forbidBlock}${userHint}${ctx}

JSON 结构：
{
  "volume_number": ${volCount + 1},
  "title": "卷标题（格式：第X卷：主标题）",
  "goal": "本卷核心目标（150字以上）",
  "summary": "详细内容概要（300字以上）"
}

要求：
1. 严格承接已有分卷的剧情发展，冲突层层升级，不能出现设定矛盾
2. 新卷标题必须是全新的，不得与已有卷标题重复
3. 有明确的起承转合
4. 结尾有钩子引导读者继续
5. 本卷核心目标要与前面卷的发展形成递进关系`
  }

  return ''
}

export default ai
