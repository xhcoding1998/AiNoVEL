import { Hono } from 'hono'
import sql from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'
import { compileMaterial } from '../services/material.js'
import { callAI, buildFullGenerationPrompt, buildSectionGenerationPrompt } from '../services/ai.js'
import { parseAndSaveAll, parseAndSaveSection } from '../services/parser.js'

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

// Get generation status
ai.get('/:id/generation-status', async (c) => {
  const pid = await verifyProjectOwner(c)
  if (!pid) return c.json({ error: '项目不存在' }, 404)
  const [proj] = await sql`SELECT generation_status FROM projects WHERE id = ${pid}`
  const tasks = await sql`SELECT id, task_type, status, created_at, completed_at FROM ai_tasks WHERE project_id = ${pid} ORDER BY created_at DESC LIMIT 10`
  return c.json({ status: proj.generation_status, tasks })
})

// Full generation: AI generates all 7 categories at once
ai.post('/:id/generate-all', async (c) => {
  const pid = await verifyProjectOwner(c)
  if (!pid) return c.json({ error: '项目不存在' }, 404)

  const { prompt } = await c.req.json()
  const userId = c.get('userId')
  const userConfig = await getUserAIConfig(userId)

  // Mark as generating
  await sql`UPDATE projects SET generation_status = 'generating', initial_prompt = ${prompt || ''}, updated_at = NOW() WHERE id = ${pid}`

  // Create task record
  const [task] = await sql`
    INSERT INTO ai_tasks (project_id, task_type, status, prompt)
    VALUES (${pid}, 'full_generation', 'running', ${prompt || ''})
    RETURNING *
  `

  // Run in background
  processFullGeneration(task.id, pid, prompt, userConfig).catch(console.error)

  return c.json({ data: task })
})

// Section regeneration: AI regenerates one specific category
ai.post('/:id/generate-section', async (c) => {
  const pid = await verifyProjectOwner(c)
  if (!pid) return c.json({ error: '项目不存在' }, 404)

  const { section, prompt } = await c.req.json()
  const validSections = ['basic_info', 'world_building', 'characters', 'relations', 'plot_control', 'volumes', 'writing_style']
  if (!validSections.includes(section)) {
    return c.json({ error: '无效的物料类别' }, 400)
  }

  const userId = c.get('userId')
  const userConfig = await getUserAIConfig(userId)

  await sql`UPDATE projects SET generation_status = 'generating', updated_at = NOW() WHERE id = ${pid}`

  const [task] = await sql`
    INSERT INTO ai_tasks (project_id, task_type, status, prompt)
    VALUES (${pid}, ${`regen_${section}`}, 'running', ${prompt || ''})
    RETURNING *
  `

  processSectionGeneration(task.id, pid, section, prompt, userConfig).catch(console.error)

  return c.json({ data: task })
})

// Get all AI tasks for a project
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

async function processFullGeneration(taskId, projectId, prompt, userConfig) {
  try {
    // Get existing material for context (may be empty for new projects)
    let existingMaterial = {}
    try {
      const [latest] = await sql`SELECT content FROM materials WHERE project_id = ${projectId} ORDER BY version DESC LIMIT 1`
      if (latest) existingMaterial = latest.content
    } catch { /* ignore */ }

    const systemPrompt = buildFullGenerationPrompt(existingMaterial)
    const result = await callAI(userConfig, systemPrompt, prompt || '请根据项目设定生成完整的小说策划物料', { json_mode: true, max_tokens: 8192 })

    // Parse and save to all 7 tables
    await parseAndSaveAll(projectId, result)

    // Compile material snapshot
    await compileMaterial(projectId)

    await sql`UPDATE ai_tasks SET status = 'completed', result = ${result}, completed_at = NOW() WHERE id = ${taskId}`
    await sql`UPDATE projects SET generation_status = 'completed', updated_at = NOW() WHERE id = ${projectId}`
  } catch (err) {
    console.error('Full generation failed:', err)
    await sql`UPDATE ai_tasks SET status = 'failed', result = ${err.message || '未知错误'} WHERE id = ${taskId}`
    const [proj] = await sql`SELECT name FROM projects WHERE id = ${projectId}`
    if (proj?.name === '生成中...') {
      await sql`UPDATE projects SET name = '未命名项目', generation_status = 'failed', updated_at = NOW() WHERE id = ${projectId}`
    } else {
      await sql`UPDATE projects SET generation_status = 'failed', updated_at = NOW() WHERE id = ${projectId}`
    }
  }
}

async function processSectionGeneration(taskId, projectId, section, prompt, userConfig) {
  try {
    const material = await compileMaterial(projectId)
    const systemPrompt = buildSectionGenerationPrompt(section, material.content)
    const userPrompt = prompt || `请重新生成该部分内容，保持与其他部分的一致性`
    const result = await callAI(userConfig, systemPrompt, userPrompt, { json_mode: true, max_tokens: 4096 })

    await parseAndSaveSection(projectId, section, result)
    await compileMaterial(projectId)

    await sql`UPDATE ai_tasks SET status = 'completed', result = ${result}, completed_at = NOW() WHERE id = ${taskId}`
    await sql`UPDATE projects SET generation_status = 'completed', updated_at = NOW() WHERE id = ${projectId}`
  } catch (err) {
    console.error('Section generation failed:', err)
    await sql`UPDATE ai_tasks SET status = 'failed', result = ${err.message || '未知错误'} WHERE id = ${taskId}`
    await sql`UPDATE projects SET generation_status = 'failed', updated_at = NOW() WHERE id = ${projectId}`
  }
}

export default ai
