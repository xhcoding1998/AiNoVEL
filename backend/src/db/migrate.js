import sql from './index.js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function migrate() {
  console.log('Running migrations...')
  const migrationFile = join(__dirname, 'migrations', '001_init.sql')
  const migration = readFileSync(migrationFile, 'utf-8')
  await sql.unsafe(migration)
  console.log('Migrations completed successfully.')
  await sql.end()
}

migrate().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
