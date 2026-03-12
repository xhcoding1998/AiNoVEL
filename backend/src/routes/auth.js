import { Hono } from 'hono'
import bcrypt from 'bcryptjs'
import sql from '../db/index.js'
import { signToken, authMiddleware } from '../middleware/auth.js'

const auth = new Hono()

auth.post('/register', async (c) => {
  const { username, email, password } = await c.req.json()
  if (!username || !email || !password) {
    return c.json({ error: '请填写完整信息' }, 400)
  }
  if (password.length < 6) {
    return c.json({ error: '密码至少6位' }, 400)
  }
  const existing = await sql`SELECT id FROM users WHERE email = ${email} OR username = ${username} LIMIT 1`
  if (existing.length > 0) {
    return c.json({ error: '用户名或邮箱已存在' }, 400)
  }
  const password_hash = await bcrypt.hash(password, 10)
  const [user] = await sql`
    INSERT INTO users (username, email, password_hash)
    VALUES (${username}, ${email}, ${password_hash})
    RETURNING id, username, email, created_at
  `
  const token = signToken({ id: user.id, username: user.username, email: user.email })
  return c.json({ user, token })
})

auth.post('/login', async (c) => {
  const { email, password } = await c.req.json()
  if (!email || !password) {
    return c.json({ error: '请填写邮箱和密码' }, 400)
  }
  const [user] = await sql`SELECT * FROM users WHERE email = ${email} LIMIT 1`
  if (!user) {
    return c.json({ error: '邮箱或密码错误' }, 401)
  }
  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) {
    return c.json({ error: '邮箱或密码错误' }, 401)
  }
  const token = signToken({ id: user.id, username: user.username, email: user.email })
  const { password_hash, ...safeUser } = user
  return c.json({ user: safeUser, token })
})

auth.get('/profile', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const [user] = await sql`
    SELECT id, username, email, ai_api_url, ai_api_key, ai_model, created_at, updated_at
    FROM users WHERE id = ${userId}
  `
  if (!user) return c.json({ error: '用户不存在' }, 404)
  return c.json({ user })
})

auth.put('/profile', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json()
  const { username, ai_api_url, ai_api_key, ai_model } = body
  const [user] = await sql`
    UPDATE users SET
      username = COALESCE(${username || null}, username),
      ai_api_url = COALESCE(${ai_api_url ?? null}, ai_api_url),
      ai_api_key = COALESCE(${ai_api_key ?? null}, ai_api_key),
      ai_model = COALESCE(${ai_model ?? null}, ai_model),
      updated_at = NOW()
    WHERE id = ${userId}
    RETURNING id, username, email, ai_api_url, ai_api_key, ai_model, created_at, updated_at
  `
  return c.json({ user })
})

export default auth
