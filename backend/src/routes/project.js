import { Hono } from 'hono'
import sql from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'
import { callAI, buildStepPrompt, GENERATION_STEPS, STEP_LABELS } from '../services/ai.js'
import { parseAndSaveSection } from '../services/parser.js'
import { compileMaterial } from '../services/material.js'

const STEP_MAX_TOKENS = {
  basic_info: 4096, world_building: 128000, characters: 128000,
  relations: 128000, plot_control: 128000, volumes: 128000, writing_style: 128000
}

async function writeLog(projectId, taskId, level, message) {
  try {
    await sql`INSERT INTO generation_logs (project_id, task_id, level, message) VALUES (${projectId}, ${taskId}, ${level}, ${message})`
  } catch { /* ignore */ }
}

function createChunkLogger(projectId, taskId) {
  let buffer = ''
  return {
    push(text) {
      buffer += text
      if (buffer.length >= 80) {
        const chunk = buffer; buffer = ''
        writeLog(projectId, taskId, 'chunk', chunk)
      }
    },
    async flush() {
      if (buffer) { await writeLog(projectId, taskId, 'chunk', buffer); buffer = '' }
    }
  }
}

async function triggerStepByStep(projectId, prompt, userConfig) {
  // 清空旧日志，开始新一轮生成
  await sql`DELETE FROM generation_logs WHERE project_id = ${projectId}`

  const [task] = await sql`
    INSERT INTO ai_tasks (project_id, task_type, status, prompt)
    VALUES (${projectId}, 'full_generation', 'running', ${prompt})
    RETURNING *
  `

  await writeLog(projectId, task.id, 'info', '开始生成小说物料...')

  for (let i = 0; i < GENERATION_STEPS.length; i++) {
    const step = GENERATION_STEPS[i]
    const label = STEP_LABELS[step] || step

    try {
      await sql`UPDATE projects SET generation_step = ${step}, updated_at = NOW() WHERE id = ${projectId}`
      await writeLog(projectId, task.id, 'info', `开始生成「${label}」...`)

      let existingMaterial = {}
      try {
        const [latest] = await sql`SELECT content FROM materials WHERE project_id = ${projectId} ORDER BY version DESC LIMIT 1`
        if (latest) existingMaterial = latest.content
      } catch { /* first run */ }

      const systemPrompt = buildStepPrompt(step, prompt, existingMaterial)
      const maxTokens = (userConfig.ai_max_tokens) || STEP_MAX_TOKENS[step] || 128000
      const chunker = createChunkLogger(projectId, task.id)
      const result = await callAI(userConfig, systemPrompt, prompt, {
        json_mode: true, max_tokens: maxTokens,
        onChunk: (t) => chunker.push(t)
      })
      await chunker.flush()

      await parseAndSaveSection(projectId, step, result)
      await compileMaterial(projectId)
      await writeLog(projectId, task.id, 'success', `「${label}」生成完成`)

    } catch (err) {
      console.error(`Step ${step} failed:`, err)
      await writeLog(projectId, task.id, 'error', `「${label}」生成失败: ${err.message || '未知错误'}`)
      await sql`UPDATE ai_tasks SET status = 'failed', result = ${err.message || '未知错误'}, completed_at = NOW() WHERE id = ${task.id}`
      const [proj] = await sql`SELECT name FROM projects WHERE id = ${projectId}`
      const newName = proj?.name === '生成中...' ? '未命名项目' : proj?.name
      await sql`UPDATE projects SET name = ${newName}, generation_status = 'failed', generation_step = ${step}, updated_at = NOW() WHERE id = ${projectId}`
      return
    }
  }

  await sql`UPDATE ai_tasks SET status = 'completed', completed_at = NOW() WHERE id = ${task.id}`
  await sql`UPDATE projects SET generation_status = 'completed', generation_step = NULL, updated_at = NOW() WHERE id = ${projectId}`
  await writeLog(projectId, task.id, 'success', '所有物料生成完成！')
}

const project = new Hono()
project.use('*', authMiddleware)

project.get('/', async (c) => {
  const userId = c.get('userId')
  const projects = await sql`
    SELECT * FROM projects WHERE user_id = ${userId} ORDER BY updated_at DESC
  `
  return c.json({ projects })
})

project.get('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')
  const [proj] = await sql`SELECT * FROM projects WHERE id = ${id} AND user_id = ${userId}`
  if (!proj) return c.json({ error: '项目不存在' }, 404)
  return c.json({ project: proj })
})

project.post('/', async (c) => {
  const userId = c.get('userId')
  const { name, prompt } = await c.req.json()
  if (!prompt && !name) return c.json({ error: '请输入创作提示词' }, 400)

  const projectName = name || '生成中...'
  const [proj] = await sql`
    INSERT INTO projects (user_id, name, initial_prompt, generation_status, generation_step)
    VALUES (${userId}, ${projectName}, ${prompt || ''}, ${prompt ? 'generating' : 'idle'}, ${prompt ? 'basic_info' : null})
    RETURNING *
  `
  await sql`INSERT INTO basic_info (project_id) VALUES (${proj.id})`
  await sql`INSERT INTO world_building (project_id) VALUES (${proj.id})`
  await sql`INSERT INTO plot_control (project_id) VALUES (${proj.id})`
  await sql`INSERT INTO writing_style (project_id) VALUES (${proj.id})`

  if (prompt) {
    const [user] = await sql`SELECT ai_api_url, ai_api_key, ai_model FROM users WHERE id = ${userId}`
    triggerStepByStep(proj.id, prompt, user).catch(console.error)
  }

  return c.json({ project: proj })
})

project.put('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')
  const { name, status } = await c.req.json()
  const [proj] = await sql`
    UPDATE projects SET
      name = COALESCE(${name || null}, name),
      status = COALESCE(${status || null}, status),
      updated_at = NOW()
    WHERE id = ${id} AND user_id = ${userId}
    RETURNING *
  `
  if (!proj) return c.json({ error: '项目不存在' }, 404)
  return c.json({ project: proj })
})

project.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')
  await sql`DELETE FROM projects WHERE id = ${id} AND user_id = ${userId}`
  return c.json({ success: true })
})

export default project
