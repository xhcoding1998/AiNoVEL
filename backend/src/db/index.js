import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ainovel', {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10
})

export default sql
