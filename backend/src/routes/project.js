import { Hono } from 'hono'
import sql from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'
import { callAI, buildFullGenerationPrompt } from '../services/ai.js'
import { parseAndSaveAll } from '../services/parser.js'
import { compileMaterial } from '../services/material.js'

async function triggerFullGeneration(projectId, prompt, userConfig) {
  try {
    const [task] = await sql`
      INSERT INTO ai_tasks (project_id, task_type, status, prompt)
      VALUES (${projectId}, 'full_generation', 'running', ${prompt})
      RETURNING *
    `
    const systemPrompt = buildFullGenerationPrompt({})
    const result = await callAI(userConfig, systemPrompt, prompt, { json_mode: true, max_tokens: 8192 })

    await parseAndSaveAll(projectId, result)
    await compileMaterial(projectId)

    await sql`UPDATE ai_tasks SET status = 'completed', result = ${result}, completed_at = NOW() WHERE id = ${task.id}`
    await sql`UPDATE projects SET generation_status = 'completed', updated_at = NOW() WHERE id = ${projectId}`
  } catch (err) {
    console.error('Auto generation failed:', err)
    // Revert name from "生成中..." if no book_name was generated
    const [proj] = await sql`SELECT name FROM projects WHERE id = ${projectId}`
    if (proj?.name === '生成中...') {
      await sql`UPDATE projects SET name = '未命名项目', generation_status = 'failed', updated_at = NOW() WHERE id = ${projectId}`
    } else {
      await sql`UPDATE projects SET generation_status = 'failed', updated_at = NOW() WHERE id = ${projectId}`
    }
  }
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
    INSERT INTO projects (user_id, name, initial_prompt, generation_status)
    VALUES (${userId}, ${projectName}, ${prompt || ''}, ${prompt ? 'generating' : 'idle'})
    RETURNING *
  `
  await sql`INSERT INTO basic_info (project_id) VALUES (${proj.id})`
  await sql`INSERT INTO world_building (project_id) VALUES (${proj.id})`
  await sql`INSERT INTO plot_control (project_id) VALUES (${proj.id})`
  await sql`INSERT INTO writing_style (project_id) VALUES (${proj.id})`

  // If prompt is provided, trigger AI generation in background
  if (prompt) {
    const [user] = await sql`SELECT ai_api_url, ai_api_key, ai_model FROM users WHERE id = ${userId}`
    triggerFullGeneration(proj.id, prompt, user).catch(console.error)
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
