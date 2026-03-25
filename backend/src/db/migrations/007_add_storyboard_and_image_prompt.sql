-- 分镜接口配置
ALTER TABLE users ADD COLUMN IF NOT EXISTS storyboard_api_url TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS storyboard_api_key TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS storyboard_model VARCHAR(100) DEFAULT '';

-- 角色形象提示词
ALTER TABLE characters ADD COLUMN IF NOT EXISTS image_prompt TEXT DEFAULT '';

-- 章节分镜（JSON 数组存储）
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS storyboards JSONB DEFAULT '[]'::jsonb;
