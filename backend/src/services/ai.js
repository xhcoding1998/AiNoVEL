export const GENERATION_STEPS = [
  'basic_info', 'world_building', 'characters', 'relations',
  'plot_control', 'volumes', 'writing_style'
]

export const STEP_LABELS = {
  basic_info: '基础信息',
  world_building: '世界观与背景',
  characters: '角色设定',
  relations: '人物关系',
  plot_control: '剧情总控',
  volumes: '分卷大纲',
  writing_style: '风格控制'
}

export async function callAI(userConfig, systemPrompt, userPrompt, options = {}) {
  const apiUrl = userConfig.ai_api_url
  const apiKey = userConfig.ai_api_key
  const model = userConfig.ai_model || 'gpt-4'

  if (!apiUrl || !apiKey) {
    throw new Error('请先在设置中配置AI接口地址和密钥')
  }

  const baseUrl = apiUrl.replace(/\/+$/, '')

  const result = await tryResponsesAPI(baseUrl, apiKey, model, systemPrompt, userPrompt, options)
    || await tryChatCompletionsAPI(baseUrl, apiKey, model, systemPrompt, userPrompt, options)

  if (!result) {
    throw new Error('AI接口调用失败：两种协议均不可用')
  }

  return result
}

async function tryResponsesAPI(baseUrl, apiKey, model, systemPrompt, userPrompt, options) {
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
      if (typeof data.output === 'string') return data.output
    }

    if (data.choices?.[0]?.message?.content) {
      return data.choices[0].message.content
    }

    return null
  } catch {
    return null
  }
}

async function tryChatCompletionsAPI(baseUrl, apiKey, model, systemPrompt, userPrompt, options) {
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

// ---------- Per-section prompt builders ----------

function contextBlock(existingMaterial) {
  if (!existingMaterial || Object.keys(existingMaterial).length === 0) return ''
  return `\n\n【当前已有物料（供参考与保持一致性）】\n${JSON.stringify(existingMaterial, null, 2)}`
}

const JSON_RULE = `你必须返回严格的 JSON 格式。不要包含任何额外文字、markdown 标记、代码块标记。直接返回 JSON 对象。`

export function buildStepPrompt(step, userPrompt, existingMaterial) {
  const builders = {
    basic_info: buildBasicInfoPrompt,
    world_building: buildWorldBuildingPrompt,
    characters: buildCharactersPrompt,
    relations: buildRelationsPrompt,
    plot_control: buildPlotControlPrompt,
    volumes: buildVolumesPrompt,
    writing_style: buildWritingStylePrompt
  }
  return (builders[step] || buildBasicInfoPrompt)(userPrompt, existingMaterial)
}

function buildBasicInfoPrompt(userPrompt, existing) {
  return `你是一位顶级网文策划编辑，拥有十年以上爆款小说策划经验。用户会给你一段创作灵感/提示词，你需要从中提炼出一部商业小说的核心定位。

${JSON_RULE}

JSON 结构：
{
  "basic_info": {
    "book_name": "书名（要求：朗朗上口、有记忆点、暗示核心冲突或卖点，提供3个备选用/分隔）",
    "genre": "精确题材分类（都市/玄幻/仙侠/科幻/悬疑/言情/历史/末日/游戏/无限流/系统文等，可以组合如'都市+悬疑'）",
    "style": "风格标签（如：热血爽文/暗黑烧脑/轻松搞笑/细腻文艺/硬核写实/甜宠日常/权谋诡计等，2-3个标签）",
    "core_selling_point": "核心卖点（200字以上，分析：①独特设定/金手指 ②核心爽点循环 ③差异化竞争力 ④情感钩子）",
    "one_line_summary": "一句话主线（格式：谁+在什么处境下+做什么+核心冲突是什么+终极目标是什么）",
    "target_readers": "目标读者画像（100字以上，包括：年龄层、性别偏好、阅读偏好、他们在其他作品中追的是什么感觉）"
  }
}

要求：
1. 书名要有网感和吸引力，不要太文艺晦涩
2. 核心卖点要详细分析，不是一句话概括
3. 一句话主线必须包含冲突和悬念
4. 每个字段内容都要丰富详实${contextBlock(existing)}`
}

function buildWorldBuildingPrompt(userPrompt, existing) {
  return `你是一位世界观架构师，擅长为网络小说构建宏大而自洽的世界设定。请基于用户提示词和已有物料，构建完整的世界观体系。

${JSON_RULE}

JSON 结构：
{
  "world_building": {
    "era_setting": "时代背景（300字以上，详细描述：①时间线/纪元 ②地理版图/核心城市/区域划分 ③科技或修炼发展阶段 ④经济与资源体系 ⑤日常生活场景）",
    "power_structure": "势力结构（300字以上，详细描述：①3-5个主要势力/组织/阵营 ②各势力实力对比与特色 ③势力间的合作/对抗/制衡关系 ④暗中的第三方力量 ⑤权力游戏的核心矛盾）",
    "rules": "规则设定（300字以上，详细描述：①核心力量体系/修炼等级/科技层级 ②力量获取方式与代价 ③独特机制（如系统/天道/因果律/血脉限制等） ④规则漏洞或灰色地带（主角可利用） ⑤禁忌与惩罚）",
    "social_atmosphere": "社会氛围（200字以上，描述：①主流价值观与禁忌 ②阶层固化或流动情况 ③信息传播方式 ④底层民众的真实生活 ⑤隐藏在繁荣下的暗流）"
  }
}

要求：
1. 世界观必须服务于故事冲突，不要为设定而设定
2. 势力结构要有明确的利益纠葛和灰色地带
3. 规则设定要有"可被利用的漏洞"为主角留空间
4. 所有设定之间要有逻辑自洽性${contextBlock(existing)}`
}

function buildCharactersPrompt(userPrompt, existing) {
  return `你是一位角色塑造专家，擅长设计立体、有魅力、有记忆点的小说角色。请根据用户提示词和已有物料，设计完整的角色群像。

${JSON_RULE}

JSON 结构：
{
  "characters": [
    {
      "name": "角色全名（要有记忆点和象征意味）",
      "role_type": "male_lead / female_lead / supporting / antagonist",
      "description": "角色详述（300字以上，包括：①外貌特征（辨识度高的细节） ②性格核心（用MBTI或关键词概括+展开） ③出身背景 ④技能/能力特长 ⑤标志性行为习惯或口头禅）",
      "core_desire": "核心欲望（100字以上，不是表面目标而是深层心理需求，如'不是想变强，而是恐惧再次失去'）",
      "weakness": "致命弱点（100字以上，必须是真正能造成困境的弱点，而非无关痛痒的小毛病。包括：弱点来源、如何被敌人利用、对剧情的影响）",
      "secret": "核心秘密（100字以上，一个能在关键时刻引爆剧情的秘密，包括：秘密的来龙去脉、谁知道这个秘密、暴露后的冲击力）"
    }
  ]
}

要求：
1. 至少 6 个角色：男主、女主、2个关键配角（亦友亦敌或双面人更好）、2个反派（不要脸谱化，给反派合理动机）
2. 每个角色必须有独特的说话方式和行为模式，读者一看就能区分
3. 角色间的欲望和秘密必须互相纠缠，制造天然冲突
4. 男主不能是完美无缺的，弱点要真正影响剧情
5. 反派要有令人共情甚至认同的一面
6. 配角不是工具人，要有自己的目标线和成长弧${contextBlock(existing)}`
}

function buildRelationsPrompt(userPrompt, existing) {
  const charNames = existing?.characters?.map(c => c.name) || []
  const charHint = charNames.length
    ? `\n\n【当前角色列表】：${charNames.join('、')}\nfrom_name 和 to_name 必须使用以上角色名。`
    : ''

  return `你是一位人物关系架构师，擅长设计复杂的人物关系网。请基于已有角色设定，构建一张有张力、有悬念的人物关系网。

${JSON_RULE}

JSON 结构：
{
  "relations": [
    {
      "from_name": "角色A名字",
      "to_name": "角色B名字",
      "relation_type": "关系类型（同盟/敌对/恋人/暗恋/虐恋/亲属/上下级/师徒/挚友/竞争/利用/监视/宿命/对照）",
      "faction": "所属阵营（同阵营/敌对阵营/表面同阵营实则对立/无阵营）",
      "interest_link": "利益链（100字以上，描述两人之间具体的利益纠葛：谁需要谁什么、交换条件是什么、利益冲突点在哪）",
      "emotion_link": "情感链（100字以上，描述两人情感关系的复杂性：表面关系vs真实关系、情感转折点、潜在的背叛或牺牲可能）",
      "description": "关系动态（100字以上，描述：①关系的发展轨迹 ②关键转折事件 ③读者期待的名场面）"
    }
  ]
}

要求：
1. 每对主要角色之间都要有关系定义，至少 8-12 条关系
2. 避免简单的好人/坏人二分法，关系要有灰色地带
3. 必须包含至少 2 条"表里不一"的关系（表面友好实则敌对，或表面敌对实则守护）
4. 必须有一条会在故事中发生反转的关系
5. 利益链和情感链要具体，不要空泛
6. 关系描述要暗示读者期待的高光名场面${charHint}${contextBlock(existing)}`
}

function buildPlotControlPrompt(userPrompt, existing) {
  return `你是一位资深网文大纲编剧，擅长设计节奏紧凑、伏笔精妙、高潮迭起的剧情架构。请构建故事的核心剧情框架。

${JSON_RULE}

JSON 结构：
{
  "plot_control": {
    "main_storyline": "故事主线（500字以上，完整描述：①起点困境与第一推动力 ②升级/成长的核心路径 ③3-5个关键转折点（每个100字） ④中期困境与信仰动摇 ⑤最终决战的设定 ⑥结局走向与余韵。要求情节逻辑自洽，前后呼应）",
    "outline_summary": "大纲摘要（300字以上，从更高的叙事层面概括：①核心命题/主题 ②全书的情感弧线 ③爽点节奏设计（开局怎么抓人→中期怎么维持→后期怎么爆发） ④对标作品及差异化 ⑤预计体量与更新节奏建议）"
  }
}

要求：
1. 主线必须有明确的 "短期目标 → 中期目标 → 终极目标" 三层结构
2. 每个转折点必须同时解决一个悬念又制造一个新悬念
3. 要有至少一次"看似胜利实则失败"和一次"看似绝境实则转机"
4. 剧情节奏必须考虑网文读者的阅读习惯：开局快节奏抓人、黄金三章、每30章一个小高潮
5. 主线和角色弧线要紧密绑定，不能脱节${contextBlock(existing)}`
}

function buildVolumesPrompt(userPrompt, existing) {
  return `你是一位精通网文节奏的分卷策划师。请基于已有的故事主线和角色设定，设计详细的分卷大纲。

${JSON_RULE}

JSON 结构：
{
  "volumes": [
    {
      "volume_number": 1,
      "title": "卷标题（格式：第X卷：主标题副标题，要有悬念感）",
      "goal": "本卷核心目标（200字以上，包括：①主角在本卷要达成什么 ②本卷的核心冲突与对手 ③本卷要揭示的设定或秘密 ④本卷的情感线推进 ⑤与下一卷的衔接钩子）",
      "summary": "详细内容概要（500字以上，包括：①卷首场景与氛围 ②3-5个关键章节/事件的具体描述 ③角色关系的变化 ④本卷高潮的具体场面 ⑤卷末悬念/钩子。要求叙述生动，不是干巴巴的流水账）"
    }
  ]
}

要求：
1. 至少 4 卷，每卷有明确的起承转合
2. 第一卷必须在开头制造强冲突快速抓住读者
3. 每卷结尾必须有钩子让读者想看下一卷
4. 卷与卷之间的冲突要层层升级（对手更强、筹码更大、代价更高）
5. 中间卷要有一次"看似平静实则暗流涌动"的过渡
6. 不要每一卷都是同样的节奏模式，要有变化
7. summary 要像在讲一个精彩的故事梗概，不要列表式的干货${contextBlock(existing)}`
}

function buildWritingStylePrompt(userPrompt, existing) {
  return `你是一位文学风格顾问，请基于已有的小说策划物料，制定精确的写作风格控制方案。

${JSON_RULE}

JSON 结构：
{
  "writing_style": {
    "writing_style": "文风要求（200字以上，包括：①叙事人称与视角策略 ②语言风格（简洁凌厉/华丽繁复/口语化/书面化） ③描写重点偏向（动作/心理/对话/环境） ④特殊手法（倒叙/多视角/意识流/蒙太奇等） ⑤对标作品的文风参考）",
    "rhythm_requirement": "节奏要求（200字以上，包括：①场景切换频率 ②快节奏战斗/慢节奏日常的占比 ③章末钩子的使用策略 ④信息释放节奏 ⑤每章推荐字数与信息密度）",
    "romance_ratio": "感情线比例与处理方式（100字以上，包括：占比、推进节奏、甜虐比例、是否有多角关系、感情线如何与主线交织）",
    "taboos": "禁忌项（列举具体的创作禁区：不写什么类型的情节、不用什么手法、避免什么价值观倾向、人物底线等）",
    "red_lines": "红线控制（列举绝对不能突破的底线：法律法规红线、平台规范、角色人设底线、剧情逻辑底线等）"
  }
}

要求：
1. 文风要求必须具体到可执行，不要"文笔优美"这种空话
2. 节奏要求要考虑网文读者的碎片化阅读习惯
3. 禁忌和红线要实际可操作${contextBlock(existing)}`
}

// Legacy: full generation prompt (still used for single-call regen)
export function buildFullGenerationPrompt(existingMaterial) {
  let base = `你是一位专业的小说创作策划大师。用户会给你一段创作提示词，你需要基于提示词生成完整的小说策划物料。

${JSON_RULE}

JSON 结构如下:
{
  "basic_info": { "book_name": "", "genre": "", "style": "", "core_selling_point": "", "one_line_summary": "", "target_readers": "" },
  "world_building": { "era_setting": "", "power_structure": "", "rules": "", "social_atmosphere": "" },
  "characters": [{ "name": "", "role_type": "male_lead/female_lead/supporting/antagonist", "description": "", "core_desire": "", "weakness": "", "secret": "" }],
  "relations": [{ "from_name": "", "to_name": "", "relation_type": "", "faction": "", "interest_link": "", "emotion_link": "", "description": "" }],
  "plot_control": { "main_storyline": "", "outline_summary": "" },
  "volumes": [{ "volume_number": 1, "title": "", "goal": "", "summary": "" }],
  "writing_style": { "writing_style": "", "rhythm_requirement": "", "romance_ratio": "", "taboos": "", "red_lines": "" }
}

要求：characters至少6个角色，relations至少8条关系，volumes至少4卷。所有字段内容详细丰富。`

  if (existingMaterial && Object.keys(existingMaterial).length > 0) {
    base += `\n\n以下是当前项目已有的物料：\n${JSON.stringify(existingMaterial, null, 2)}`
  }
  return base
}

export function buildSectionGenerationPrompt(section, existingMaterial) {
  return buildStepPrompt(section, '', existingMaterial)
}
