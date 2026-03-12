CREATE TABLE IF NOT EXISTS generation_logs (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  task_id INTEGER REFERENCES ai_tasks(id) ON DELETE CASCADE,
  level VARCHAR(10) DEFAULT 'info',
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
