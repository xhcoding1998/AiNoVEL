import sql from './index.js'
import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function migrate() {
  console.log('Running migrations...')
  const migrationsDir = join(__dirname, 'migrations')
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    console.log(`  -> ${file}`)
    const migration = readFileSync(join(migrationsDir, file), 'utf-8')
    await sql.unsafe(migration)
  }

  console.log('Migrations completed successfully.')
  await sql.end()
}

migrate().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
