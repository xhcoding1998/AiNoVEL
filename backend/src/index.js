import { Hono } from 'hono'
import { cors } from 'hono/cors'
import auth from './routes/auth.js'
import project from './routes/project.js'
import novel from './routes/novel.js'
import ai from './routes/ai.js'

const app = new Hono()

app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}))

app.route('/api/auth', auth)
app.route('/api/projects', project)
app.route('/api/projects', novel)
app.route('/api/projects', ai)

app.get('/api/health', (c) => c.json({ status: 'ok', time: new Date().toISOString() }))

const port = process.env.PORT || 3000
console.log(`Server running on http://localhost:${port}`)

export default {
  port,
  fetch: app.fetch
}
