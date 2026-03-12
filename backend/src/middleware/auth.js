import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'ainovel-dev-secret-key-2026'

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET)
}

export async function authMiddleware(c, next) {
  const header = c.req.header('Authorization')
  if (!header || !header.startsWith('Bearer ')) {
    return c.json({ error: '未登录' }, 401)
  }
  try {
    const token = header.slice(7)
    const payload = verifyToken(token)
    c.set('userId', payload.id)
    c.set('user', payload)
    await next()
  } catch {
    return c.json({ error: '登录已过期' }, 401)
  }
}
