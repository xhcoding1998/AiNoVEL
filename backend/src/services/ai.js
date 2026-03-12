export async function callAI(userConfig, systemPrompt, userPrompt, options = {}) {
  const apiUrl = userConfig.ai_api_url
  const apiKey = userConfig.ai_api_key
  const model = userConfig.ai_model || 'gpt-4'

  if (!apiUrl || !apiKey) {
    throw new Error('请先在设置中配置AI接口地址和密钥')
  }

  const baseUrl = apiUrl.replace(/\/+$/, '')

  // Try Responses API first (/v1/responses), fall back to Chat Completions (/v1/chat/completions)
  const result = await tryResponsesAPI(baseUrl, apiKey, model, systemPrompt, userPrompt, options)
    || await tryChatCompletionsAPI(baseUrl, apiKey, model, systemPrompt, userPrompt, options)

  if (!result) {
    throw new Error('AI接口调用失败：两种协议均不可用')
  }

  return result
}

async function tryResponsesAPI(baseUrl, apiKey, model, systemPrompt, userPrompt, options) {
  // OpenAI Responses API format: POST /v1/responses with { model, input: [...] }
  const url = baseUrl.endsWith('/responses') ? baseUrl : `${baseUrl}/responses`

  const body = {
    model,
    input: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]
  }

  if (options.temperature != null) body.temperature = options.temperature
  if (options.max_tokens) body.max_output_tokens = options.max_tokens

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) return null

    const data = await response.json()

    // Responses API returns output array with message items
    if (data.output) {
      for (const item of data.output) {
        if (item.type === 'message' && item.content) {
          for (const block of item.content) {
            if (block.type === 'output_text' || block.type === 'text') {
              return block.text
            }
          }
        }
      }
      // Fallback: try direct text field
      if (typeof data.output === 'string') return data.output
    }

    // Some proxies return choices format even on /responses
    if (data.choices?.[0]?.message?.content) {
      return data.choices[0].message.content
    }

    return null
  } catch {
    return null
  }
}

async function tryChatCompletionsAPI(baseUrl, apiKey, model, systemPrompt, userPrompt, options) {
  // Standard OpenAI Chat Completions: POST /v1/chat/completions with { model, messages: [...] }
  let url = baseUrl
  if (!url.endsWith('/chat/completions')) {
    url = url.replace(/\/responses$/, '') + '/chat/completions'
  }

  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: options.temperature ?? 0.8,
    max_tokens: options.max_tokens ?? 8192
  }

  if (options.json_mode) {
    body.response_format = { type: 'json_object' }
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`AI接口返回错误: ${response.status} ${err}`)
    }

    const data = await response.json()
    return data.choices?.[0]?.message?.content || null
  } catch (e) {
    if (e.message?.includes('AI接口返回错误')) throw e
    return null
  }
}

const NOVEL_JSON_SCHEMA = `{
  "basic_info": {
    "book_name": "书名",
    "genre": "题材(都市/玄幻/仙侠/科幻/悬疑/言情/历史等)",
    "style": "风格(轻松搞笑/热血爽文/细腻文艺/暗黑压抑/悬疑烧脑等)",
    "core_selling_point": "核心卖点描述",
    "one_line_summary": "一句话主线",
    "target_readers": "目标读者画像"
  },
  "world_building": {
    "era_setting": "时代/城市/行业背景",
    "power_structure": "势力结构",
    "rules": "规则设定(修炼体系/科技体系等)",
    "social_atmosphere": "社会氛围"
  },
  "characters": [
    {
      "name": "角色名",
      "role_type": "male_lead/female_lead/supporting/antagonist",
      "description": "外貌性格背景",
      "core_desire": "核心欲望",
      "weakness": "弱点",
      "secret": "秘密"
    }
  ],
  "relations": [
    {
      "from_name": "角色A名字",
      "to_name": "角色B名字",
      "relation_type": "同盟/敌对/恋人/亲属/上下级/师徒/挚友/竞争/利用",
      "faction": "阵营",
      "interest_link": "利益链描述",
      "emotion_link": "情感链描述",
      "description": "关系补充描述"
    }
  ],
  "plot_control": {
    "main_storyline": "故事主线详细描述",
    "outline_summary": "大纲摘要"
  },
  "volumes": [
    {
      "volume_number": 1,
      "title": "卷标题",
      "goal": "本卷目标",
      "summary": "内容概要"
    }
  ],
  "writing_style": {
    "writing_style": "文风要求",
    "rhythm_requirement": "节奏要求",
    "romance_ratio": "感情线比例",
    "taboos": "禁忌项",
    "red_lines": "红线控制"
  }
}`

export function buildFullGenerationPrompt(existingMaterial) {
  let base = `你是一位专业的小说创作策划大师。用户会给你一段创作提示词，你需要基于提示词生成完整的小说策划物料。

你必须返回严格的 JSON 格式，不要包含任何额外文字、markdown标记或代码块。直接返回 JSON 对象。

JSON 结构如下:
${NOVEL_JSON_SCHEMA}

要求：
1. characters 数组至少包含 4 个角色（男主、女主、主要配角、主要反派各一个）
2. relations 数组描述角色之间的主要关系，from_name 和 to_name 必须对应 characters 中的角色名
3. volumes 数组至少包含 3 卷的大纲规划
4. 所有文本字段都要详细、有创意、有深度，不要空字段
5. 风格要统一，角色设定要互相关联，剧情要环环相扣`

  if (existingMaterial && Object.keys(existingMaterial).length > 0) {
    base += `\n\n以下是当前项目已有的物料（用户可能已手动修改过），请在此基础上优化和补充：\n${JSON.stringify(existingMaterial, null, 2)}`
  }

  return base
}

export function buildSectionGenerationPrompt(section, existingMaterial) {
  const sectionNames = {
    basic_info: '基础信息',
    world_building: '世界观与背景',
    characters: '角色设定',
    relations: '人物关系',
    plot_control: '剧情总控',
    volumes: '分卷大纲',
    writing_style: '风格控制'
  }

  const sectionSchemas = {
    basic_info: `{ "basic_info": { "book_name": "", "genre": "", "style": "", "core_selling_point": "", "one_line_summary": "", "target_readers": "" } }`,
    world_building: `{ "world_building": { "era_setting": "", "power_structure": "", "rules": "", "social_atmosphere": "" } }`,
    characters: `{ "characters": [{ "name": "", "role_type": "male_lead/female_lead/supporting/antagonist", "description": "", "core_desire": "", "weakness": "", "secret": "" }] }`,
    relations: `{ "relations": [{ "from_name": "角色A", "to_name": "角色B", "relation_type": "", "faction": "", "interest_link": "", "emotion_link": "", "description": "" }] }`,
    plot_control: `{ "plot_control": { "main_storyline": "", "outline_summary": "" } }`,
    volumes: `{ "volumes": [{ "volume_number": 1, "title": "", "goal": "", "summary": "" }] }`,
    writing_style: `{ "writing_style": { "writing_style": "", "rhythm_requirement": "", "romance_ratio": "", "taboos": "", "red_lines": "" } }`
  }

  return `你是一位专业的小说创作策划大师。请基于以下项目物料，重新生成【${sectionNames[section]}】部分。

当前项目完整物料：
${JSON.stringify(existingMaterial, null, 2)}

你必须返回严格的 JSON 格式，不要包含任何额外文字、markdown标记或代码块。只返回以下结构：
${sectionSchemas[section] || NOVEL_JSON_SCHEMA}

要求：
1. 保持与其他部分（角色、世界观、剧情等）的一致性
2. 内容要详细、有创意、有深度
3. 如果用户提供了额外指令，优先满足用户要求`
}
