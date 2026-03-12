CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  ai_api_url TEXT DEFAULT '',
  ai_api_key TEXT DEFAULT '',
  ai_model VARCHAR(100) DEFAULT '',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL DEFAULT '未命名项目',
  status VARCHAR(20) DEFAULT 'draft',
  initial_prompt TEXT DEFAULT '',
  generation_status VARCHAR(20) DEFAULT 'idle',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS basic_info (
  id SERIAL PRIMARY KEY,
  project_id INTEGER UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  book_name VARCHAR(255) DEFAULT '',
  genre VARCHAR(100) DEFAULT '',
  style VARCHAR(100) DEFAULT '',
  core_selling_point TEXT DEFAULT '',
  one_line_summary TEXT DEFAULT '',
  target_readers TEXT DEFAULT '',
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS world_building (
  id SERIAL PRIMARY KEY,
  project_id INTEGER UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  era_setting TEXT DEFAULT '',
  power_structure TEXT DEFAULT '',
  rules TEXT DEFAULT '',
  social_atmosphere TEXT DEFAULT '',
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS characters (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  role_type VARCHAR(50) DEFAULT 'supporting',
  description TEXT DEFAULT '',
  core_desire TEXT DEFAULT '',
  weakness TEXT DEFAULT '',
  secret TEXT DEFAULT '',
  avatar_color VARCHAR(7) DEFAULT '#0070f3',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS character_relations (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  from_character_id INTEGER REFERENCES characters(id) ON DELETE CASCADE,
  to_character_id INTEGER REFERENCES characters(id) ON DELETE CASCADE,
  relation_type VARCHAR(50) DEFAULT '',
  faction VARCHAR(100) DEFAULT '',
  interest_link TEXT DEFAULT '',
  emotion_link TEXT DEFAULT '',
  description TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plot_control (
  id SERIAL PRIMARY KEY,
  project_id INTEGER UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  main_storyline TEXT DEFAULT '',
  outline_summary TEXT DEFAULT '',
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS volumes (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  volume_number INTEGER DEFAULT 1,
  title VARCHAR(255) DEFAULT '',
  goal TEXT DEFAULT '',
  summary TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chapters (
  id SERIAL PRIMARY KEY,
  volume_id INTEGER REFERENCES volumes(id) ON DELETE CASCADE,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  chapter_number INTEGER DEFAULT 1,
  title VARCHAR(255) DEFAULT '',
  content TEXT DEFAULT '',
  status VARCHAR(20) DEFAULT 'draft',
  word_count INTEGER DEFAULT 0,
  highlight_scenes JSONB DEFAULT '[]',
  key_dialogues JSONB DEFAULT '[]',
  thrill_points JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plot_devices (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  device_type VARCHAR(20) DEFAULT 'foreshadowing',
  description TEXT DEFAULT '',
  setup_chapter INTEGER,
  payoff_chapter INTEGER,
  status VARCHAR(20) DEFAULT 'planted',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS writing_style (
  id SERIAL PRIMARY KEY,
  project_id INTEGER UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  writing_style TEXT DEFAULT '',
  character_voice JSONB DEFAULT '{}',
  rhythm_requirement TEXT DEFAULT '',
  romance_ratio TEXT DEFAULT '',
  taboos TEXT DEFAULT '',
  red_lines TEXT DEFAULT '',
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS materials (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  content JSONB NOT NULL DEFAULT '{}',
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_tasks (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  task_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  prompt TEXT DEFAULT '',
  result TEXT DEFAULT '',
  material_version INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);
