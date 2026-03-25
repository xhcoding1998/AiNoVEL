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
  const onChunk = options.onChunk || null

  const result = await tryStreamingChat(baseUrl, apiKey, model, systemPrompt, userPrompt, options, onChunk)
    || await tryNonStreamingChat(baseUrl, apiKey, model, systemPrompt, userPrompt, options, onChunk)

  if (!result) {
    throw new Error('AI接口调用失败：两种协议均不可用')
  }

  return result
}

async function tryStreamingChat(baseUrl, apiKey, model, systemPrompt, userPrompt, options, onChunk) {
  let url = baseUrl
  if (!url.endsWith('/chat/completions')) {
    url = url.replace(/\/responses$/, '') + '/chat/completions'
  }

  const body = {
    model,
    stream: true,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: options.temperature ?? 0.8,
    max_tokens: options.max_tokens ?? 128000
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

    if (!response.ok) return null

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/event-stream') && !contentType.includes('text/plain')) {
      const data = await response.json()
      const text = data.choices?.[0]?.message?.content
        || (data.output && typeof data.output === 'string' ? data.output : null)
      if (text && onChunk) onChunk(text)
      return text || null
    }

    let fullText = ''
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data:')) continue
        const payload = trimmed.slice(5).trim()
        if (payload === '[DONE]') continue

        try {
          const json = JSON.parse(payload)
          const delta = json.choices?.[0]?.delta?.content
          if (delta) {
            fullText += delta
            if (onChunk) onChunk(delta)
          }
        } catch { /* skip malformed SSE lines */ }
      }
    }

    return fullText || null
  } catch {
    return null
  }
}

async function tryNonStreamingChat(baseUrl, apiKey, model, systemPrompt, userPrompt, options, onChunk) {
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
    max_tokens: options.max_tokens ?? 128000
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
    const text = data.choices?.[0]?.message?.content || null
    if (text && onChunk) onChunk(text)
    return text
  } catch (e) {
    if (e.message?.includes('AI接口返回错误')) throw e
    return null
  }
}

// ---------- Per-section prompt builders ----------

export function contextBlock(existingMaterial) {
  if (!existingMaterial || Object.keys(existingMaterial).length === 0) return ''
  return `\n\n【当前已有物料（供参考与保持一致性）】\n${JSON.stringify(existingMaterial, null, 2)}

⚠️ 重要：物料中各字段可能存在数据不一致（比如用户刚修改了角色名但其他文本还是旧名字）。
遇到冲突时，请严格以 characters 数组中的最新角色名为准，完全忽略其他字段中出现的旧名字。
绝对不要出现"旧名（又名/艺名/原名：新名）"这种写法，直接使用 characters 中的名字。`
}

const JSON_RULE = `你必须返回严格的 JSON 格式。不要包含任何额外文字、markdown 标记、代码块标记。直接返回 JSON 对象。`

function buildIPAwareHint(existing) {
  const ipAnalysis = existing?.basic_info?.ip_analysis
  if (!ipAnalysis || !ipAnalysis.is_ip_based) return ''

  const sources = Array.isArray(ipAnalysis.source_works)
    ? ipAnalysis.source_works.join('、')
    : (ipAnalysis.source_works || '未知')
  const chars = Array.isArray(ipAnalysis.known_characters)
    ? ipAnalysis.known_characters.join('、')
    : ''
  const era = ipAnalysis.era_context || ''
  const traits = ipAnalysis.character_traits_summary || ''

  return `\n\n⚠️⚠️⚠️【IP 改编创作模式 — 必须严格遵守】
本作品基于经典作品「${sources}」进行改编/续写/再创作。
${era ? `原作时代与文化语境：${era}` : ''}
${chars ? `原作核心角色：${chars}` : ''}
${traits ? `角色特征速写：${traits}` : ''}
IP 改编铁律：
1. 原作角色必须保留经典性格、说话方式、能力设定、外貌特征和人物关系，可以深化发展但不能背离原作人格内核
2. 原作世界观（时代、地理、势力、力量体系、文化）是创作根基，新设定必须与原作逻辑自洽
3. 故事时间线必须明确衔接原作，不能与原作已有事件产生矛盾
4. 原作的文化语境和时代特征必须准确还原（不能出现违和的现代用语，除非是刻意的讽刺反差手法）
5. 改编方向：${ipAnalysis.original_elements || '见用户提示词'}
6. 必须保留：${ipAnalysis.must_preserve || '核心人物关系与世界观'}`
}

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
  return `你是一位顶级小说策划编辑，拥有十年以上创作策划经验和深厚的中外文学功底。用户会给你一段创作灵感/提示词，你需要从中提炼出一部小说的核心定位。

⚠️⚠️⚠️【第一优先级：IP 识别与分析】
在生成任何其他内容之前，你必须首先深入分析用户的提示词，判断是否涉及已有经典 IP（文学/影视/游戏/神话/历史等作品）。

判断标准：
- 出现经典人物名（唐僧、孙悟空、哈利波特、诸葛亮、林黛玉、路飞等）→ IP 改编
- 出现经典作品名或标志性设定（取经、霍格沃茨、三国、贾府、中土世界等）→ IP 改编
- 涉及具体神话体系/历史事件（希腊神话、封神、三国时期、大唐西域等）→ IP 改编
- 仅涉及通用题材概念（修仙、穿越、系统、末日等）且无具体作品指向 → 原创
- 完全自创人物和世界 → 原创

若判定为 IP 改编，你必须：
1. 凭借你对原作的深入理解，详尽填写 ip_analysis 每个字段
2. character_traits_summary 中必须准确还原原作角色的经典特征（性格内核、口头禅、行为模式、能力、经典桥段等），绝不能编造原作不存在的设定
3. original_elements 中精确提炼用户想要的改编/续写/颠覆方向与深层主题
4. must_preserve 中列出原作不可更改的核心要素

${JSON_RULE}

JSON 结构：
{
  "basic_info": {
    "ip_analysis": {
      "is_ip_based": true,
      "source_works": ["涉及的原作名称，如：西游记、三国演义"],
      "era_context": "原作时代与文化语境的详细描述（200字以上，如：唐朝贞观年间+天庭/佛门/妖界三界并立体系+佛道势力暗中角逐的格局等）",
      "known_characters": ["原作中涉及的核心角色名列表"],
      "character_traits_summary": "核心角色的原作特征速写（每个角色50-100字，涵盖性格内核、标志性言行、能力特长、经典形象，务必准确不可编造）",
      "original_elements": "用户提示中超出原作的改编方向与主题立意（200字以上，精确提炼用户的创新构思、想表达的深层主题、与现实的映射关系等）",
      "must_preserve": "必须保留的原作核心要素清单（关键人物关系、世界观规则、文化背景、标志性设定等）"
    },
    "book_name": "书名（⚠️ 最高优先级：如果用户提示词中已经明确给出了书名或标题（如'黑神话：玄奘'、'xxx：xxx'这类格式），必须直接使用用户给出的书名，绝对不能自行发挥另取书名！只有在用户完全没有提供书名时，才自行创作4-10字的书名，要朗朗上口有记忆点）",
    "genre": "精确题材分类（可组合，如'神话+现实讽喻'、'都市+悬疑'。IP改编时标注'IP改编+具体类型'）",
    "style": "风格标签（2-3个，如：解构讽刺/暗黑现实/热血爽文/权谋诡计等）",
    "core_selling_point": "核心卖点（200字以上：①独特设定/金手指 ②核心爽点循环 ③差异化竞争力 ④情感钩子。IP改编额外分析：⑤与原作的反差看点 ⑥老粉共鸣点与颠覆感）",
    "one_line_summary": "一句话主线（格式：谁+在什么处境下+做什么+核心冲突+终极目标）",
    "target_readers": "目标读者画像（100字以上：年龄层、阅读偏好、追求的阅读体验。IP改编时说明原作粉丝vs新读者的兼顾策略）"
  }
}

⚠️ 注意：若为原创作品，ip_analysis.is_ip_based 设为 false，source_works 设为空数组，其余 ip_analysis 子字段可填写"无"或简短说明即可。

要求：
1. ⚠️⚠️⚠️【书名铁律】：仔细阅读用户提示词，如果其中包含明确的书名或标题（通常是"xxx：xxx"格式，或冒号分隔的标题，或用引号括起来的名称），必须原样使用该书名，绝对不能自行另取！这是最高优先级规则，违反此规则将导致整个生成结果无效
2. IP 识别是最关键的第一步，必须准确判断——这决定了后续所有步骤的创作方向
3. 若为 IP 改编：character_traits_summary 必须体现你对原作人物的深入理解，绝不能用泛泛的描述敷衍
4. 核心卖点要详细分析，不是一句话概括
5. 一句话主线必须包含冲突和悬念
6. 每个字段内容都要丰富详实${contextBlock(existing)}`
}

function buildWorldBuildingPrompt(userPrompt, existing) {
  return `你是一位世界观架构师，擅长为小说构建宏大而自洽的世界设定。请基于用户提示词和已有物料，构建完整的世界观体系。
${buildIPAwareHint(existing)}

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
4. 所有设定之间要有逻辑自洽性
5. 若为 IP 改编：era_setting 必须以原作时代为基础进行扩展而非重新编造；power_structure 以原作势力为基础（如天庭、佛门、妖族等）可新增但不能矛盾；rules 延续原作力量体系和规则逻辑；social_atmosphere 还原原作的社会文化特征${contextBlock(existing)}`
}

function buildCharactersPrompt(userPrompt, existing) {
  const existingChars = existing?.characters || []
  const hasExisting = existingChars.length > 0

  const addModifyPattern = /增加|新增|添加|补充|加一个|加个|多加|再加|修改|调整|改一下|改为|换成|改个/
  const isIncremental = hasExisting && userPrompt && addModifyPattern.test(userPrompt)

  let modeInstruction = ''
  if (isIncremental) {
    modeInstruction = `

⚠️⚠️⚠️【增量模式 — 最高优先级，必须严格遵守】
用户要求在现有角色基础上进行新增或修改，**绝对不是**要求重新生成全部角色。你必须：
1. 在返回的 characters 数组中 **完整保留所有现有角色** 的全部字段数据（未被用户明确提及要修改的角色，其所有字段必须原样返回，一个字都不能改动）
2. 仅根据用户的具体指令进行新增角色或修改指定角色
3. 新增角色的名字不能与现有角色重复
4. 修改角色时只改用户明确要求修改的字段，其他字段保持原样

当前已有角色（必须全部保留在返回结果中）：
${existingChars.map(c => `  - ${c.name}（${c.role_type}）：${(c.description || '').slice(0, 80)}`).join('\n')}

用户的具体要求：${userPrompt}`
  } else if (hasExisting) {
    const projectContext = []
    if (existing?.basic_info?.book_name) projectContext.push(`书名：${existing.basic_info.book_name}`)
    if (existing?.basic_info?.genre) projectContext.push(`类型：${existing.basic_info.genre}`)
    if (existing?.basic_info?.style) projectContext.push(`风格：${existing.basic_info.style}`)
    if (existing?.basic_info?.one_line_summary) projectContext.push(`主线：${existing.basic_info.one_line_summary}`)
    if (existing?.world_building?.era_setting) projectContext.push(`时代背景：${(existing.world_building.era_setting || '').slice(0, 300)}`)
    if (existing?.world_building?.power_structure) projectContext.push(`势力结构：${(existing.world_building.power_structure || '').slice(0, 200)}`)

    modeInstruction = `

⚠️⚠️⚠️【全量重新生成模式 — 必须严格基于项目上下文】
用户要求重新生成角色设定。你必须严格基于以下项目核心设定来重新设计角色群像，角色必须完全匹配项目的题材、世界观和剧情方向：
${projectContext.join('\n')}

绝对不能生成与项目主题无关的角色！
- 如果项目是西游题材，角色必须是西游世界中的人物（唐僧、孙悟空、猪八戒等）
- 如果项目是三国题材，角色必须是三国世界中的人物
- 如果项目是都市题材，角色必须符合都市背景
你可以重新诠释角色的细节，但核心设定必须与项目的世界观和剧情方向保持一致。${userPrompt ? `\n\n用户补充要求：${userPrompt}` : ''}`
  }

  return `你是一位角色塑造专家，擅长设计立体、有魅力、有记忆点的小说角色。请根据用户提示词和已有物料，设计完整的角色群像。
${buildIPAwareHint(existing)}${modeInstruction}

${JSON_RULE}

JSON 结构：
{
  "characters": [
    {
      "name": "角色全名（⚠️ 只写名字本身，绝对不能在名字后面加括号说明、身份标注、称号或任何附加信息！错误示例：'玄奘（始祖舍利受体）'、'孙悟空（齐天大圣）'；正确示例：'玄奘'、'孙悟空'）",
      "role_type": "male_lead / female_lead / supporting / antagonist / minor（⚠️ 根据题材实际情况分配，不是每部作品都必须有female_lead；如西游记改编可以没有女主，热血战斗类可以没有女主，请根据用户提示词和故事类型灵活判断）",
      "description": "角色详述（300字以上，包括：①外貌特征（辨识度高的细节） ②性格核心（用MBTI或关键词概括+展开） ③出身背景 ④技能/能力特长 ⑤标志性行为习惯或口头禅）",
      "core_desire": "核心欲望（100字以上，不是表面目标而是深层心理需求，如'不是想变强，而是恐惧再次失去'）",
      "weakness": "致命弱点（100字以上，必须是真正能造成困境的弱点，而非无关痛痒的小毛病。包括：弱点来源、如何被敌人利用、对剧情的影响）",
      "secret": "核心秘密（100字以上，一个能在关键时刻引爆剧情的秘密，包括：秘密的来龙去脉、谁知道这个秘密、暴露后的冲击力）",
      "image_prompt": "角色形象提示词（中文，专为AI绘图/视频生成设计，格式参考：'25岁男性，面容俊朗清冷，白色汉服僧袍，腰系佛珠，眉心隐现金色印记，气质出尘，古代寺庙背景，写实风格，高清，电影质感'。必须包含：年龄性别+面部特征+发型发色+服装配饰+气质神态+背景环境+画风关键词，禁止使用抽象词汇，要求具体可视化）"
    }
  ]
}

要求：
1. ⚠️⚠️⚠️【角色数铁律】原创作品：角色数量必须充足，**至少生成 10-15 个角色**（含主角、配角、反派、龙套等），这是硬性要求，违反此规则将导致结果无效！绝对不能只生成 6 个或更少的角色；IP 改编：以原作核心角色为主体（至少 8 个核心角色），并增加足够的原创角色丰富故事，总数不少于 10 个；宁可多生成也不能少
2. IP 改编时：原作角色的 description 必须首先准确还原其经典形象特征（外貌、性格、能力、口头禅、标志性行为等），再叠加本作中的发展变化
3. 每个角色必须有独特的说话方式和行为模式，IP 角色的言行必须符合原作人设
4. 角色间的欲望和秘密必须互相纠缠，制造天然冲突
5. 主角不能完美无缺，弱点要真正影响剧情
6. 反派要有令人共情甚至认同的一面，不要脸谱化
7. 配角不是工具人，要有自己的目标线和成长弧
8. role_type 说明：male_lead（男主）、female_lead（女主）、supporting（配角，有独立目标线和成长弧）、antagonist（反派，有令人共情的一面）、minor（龙套，功能性角色，如店小二、路人甲、信使等，description 可适当简短）；IP 改编时按角色在本作中的实际定位分配，不必强套男主/女主模板${contextBlock(existing)}`
}

function buildRelationsPrompt(userPrompt, existing) {
  const chars = existing?.characters || []
  const charNames = chars.map(c => c.name)
  const charHint = charNames.length
    ? `\n\n【当前角色列表（name → role_type）】：\n${chars.map(c => `  - ${c.name} (${c.role_type})`).join('\n')}\n⚠️ from_name 和 to_name 必须严格使用以上角色名，一个字都不能多不能少。`
    : ''

  const compactContext = existing ? buildCompactContext(existing) : ''

  return `你是一位人物关系架构师。基于已有角色设定构建人物关系网。
${buildIPAwareHint(existing)}

⚠️ 重要：你返回的数据将直接被前端 dagre.js 渲染为有向关系脉络图（从上往下布局）。
dagre.js 通过 from → to 的有向边来确定节点层级——如果边的方向没有形成层次关系，所有节点会被挤到同一行，图形完全无法阅读。
因此你必须精心设计每条关系的 from/to 方向，确保生成的图有清晰的上下层级结构。

${JSON_RULE}

JSON 结构：
{
  "relations": [
    {
      "from_name": "上层角色名字（必须精确匹配角色列表）",
      "to_name": "下层角色名字（必须精确匹配角色列表）",
      "relation_type": "同盟/敌对/恋人/暗恋/虐恋/亲属/上下级/师徒/挚友/竞争/利用/监视/宿命/对照",
      "faction": "阵营",
      "interest_link": "利益链（50字左右）",
      "emotion_link": "情感链（50字左右）",
      "description": "关系动态（50字左右）"
    }
  ]
}

⚠️⚠️⚠️ dagre.js 布局核心规则（你必须严格遵守）：
1. 边的方向决定层级：from_name 的节点在上方，to_name 的节点在下方
2. 你需要把角色分成 3 层来构建关系：
   - 第 1 层（最上方）：主角（male_lead / female_lead）
   - 第 2 层（中间）：关键配角（supporting）
   - 第 3 层（最下方）：反派（antagonist）
3. 关系方向必须遵循层级：
   - 第 1 层 → 第 2 层：主角指向配角（如师徒、恋人、挚友）
   - 第 1 层 → 第 3 层：主角指向反派（如敌对、宿命、竞争）
   - 第 2 层 → 第 3 层：配角指向反派（如监视、利用、敌对）
   - 同层之间也可以有关系（如两个配角之间），但至少要保证每个角色有一条跨层边
4. ⚠️ 绝对不能出现"反向边"（下层 → 上层），否则 dagre 会把图压缩成一行！
   - 错误示例：反派 → 主角（这会让 dagre 把反派排到主角上面）
   - 正确做法：主角 → 反派（relation_type 写"宿命"或"敌对"，用 description 补充说明反派对主角的态度）
5. 每个角色至少要被 1 条边连接到，不能有孤立节点

要求：
1. 至少 8-12 条关系，确保每个角色至少有 2 条关系连线
2. 关系要有灰色地带，包含至少 1 条"表里不一"的关系
3. 利益链和情感链要具体
4. from_name 和 to_name 必须与角色列表中的名字完全一致
5. IP 改编时：原作经典关系（如师徒、兄弟、对手等）必须保留其核心属性，可以增加新的关系维度和暗流涌动的利益纠葛，但不能扭曲原有关系本质${charHint}${compactContext}`
}

function buildCompactContext(existing) {
  if (!existing || Object.keys(existing).length === 0) return ''
  const parts = []
  if (existing.basic_info) {
    parts.push(`书名: ${existing.basic_info.book_name || ''}, 类型: ${existing.basic_info.genre || ''}`)
    const ip = existing.basic_info.ip_analysis
    if (ip?.is_ip_based) {
      const sources = Array.isArray(ip.source_works) ? ip.source_works.join('、') : ''
      if (sources) parts.push(`IP来源: ${sources}`)
    }
  }
  if (existing.characters?.length) {
    parts.push(`角色: ${existing.characters.map(c => `${c.name}(${c.role_type})`).join(', ')}`)
  }
  if (existing.world_building) {
    const wb = existing.world_building
    parts.push(`世界观: ${(wb.era_setting || '').slice(0, 100)}`)
  }
  return parts.length ? `\n\n【已有物料摘要】\n${parts.join('\n')}` : ''
}

function buildPlotControlPrompt(userPrompt, existing) {
  return `你是一位资深大纲编剧，擅长设计节奏紧凑、伏笔精妙、高潮迭起的剧情架构。请构建故事的核心剧情框架。
${buildIPAwareHint(existing)}

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
5. 主线和角色弧线要紧密绑定，不能脱节
6. IP 改编时：剧情必须衔接原作时间线，转折点要善于利用原作中已有的矛盾和伏笔进行再挖掘，同时融入用户要求的改编方向和现实映射主题${contextBlock(existing)}`
}

function buildVolumesPrompt(userPrompt, existing) {
  return `你是一位精通小说节奏的分卷策划师。请基于已有的故事主线和角色设定，设计详细的分卷大纲。
${buildIPAwareHint(existing)}

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
1. ⚠️⚠️⚠️【卷数铁律】卷数必须充足，**至少生成 6-10 卷**，这是硬性要求，违反此规则将导致结果无效！绝对不能只生成 3 卷、4 卷或 5 卷；如果故事体量较大（如百万字以上的长篇），应规划 10 卷以上；宁可多生成也不能少
2. 第一卷必须在开头制造强冲突快速抓住读者
3. 每卷结尾必须有钩子让读者想看下一卷
4. 卷与卷之间的冲突要层层升级（对手更强、筹码更大、代价更高）
5. 中间卷要有一次"看似平静实则暗流涌动"的过渡
6. 不要每一卷都是同样的节奏模式，要有变化
7. summary 要像在讲一个精彩的故事梗概，不要列表式的干货${contextBlock(existing)}`
}

function buildWritingStylePrompt(userPrompt, existing) {
  const parts = []
  if (existing?.basic_info) {
    const bi = existing.basic_info
    parts.push(`书名: ${bi.book_name || ''}, 类型: ${bi.genre || ''}, 风格: ${bi.style || ''}`)
  }
  if (existing?.characters?.length) {
    parts.push(`角色: ${existing.characters.map(c => `${c.name}(${c.role_type})`).join(', ')}`)
  }
  if (existing?.plot_control) {
    parts.push(`主线: ${(existing.plot_control.main_storyline || '').slice(0, 200)}`)
  }
  const contextHint = parts.length ? `\n\n【已有物料摘要】\n${parts.join('\n')}` : ''

  return `你是一位文学风格顾问，请基于已有的小说策划物料，制定精确的写作风格控制方案。
${buildIPAwareHint(existing)}

${JSON_RULE}

JSON 结构：
{
  "writing_style": {
    "writing_style": "文风要求（150字左右，包括：叙事人称与视角、语言风格、描写重点、特殊手法、对标作品参考）",
    "rhythm_requirement": "节奏要求（150字左右，包括：场景切换频率、快慢节奏占比、章末钩子策略、信息释放节奏）",
    "romance_ratio": "感情线比例与处理方式（80字左右，包括：占比、推进节奏、甜虐比例）",
    "taboos": "禁忌项（列举创作禁区，80字左右）",
    "red_lines": "红线控制（列举不能突破的底线，80字左右）"
  }
}

要求：
1. 文风要求必须具体到可执行，不要"文笔优美"这种空话
2. 节奏要求要考虑网文读者的碎片化阅读习惯
3. 禁忌和红线要实际可操作${contextHint}`
}

// ---------- Storyboard prompt ----------

export function buildStoryboardPrompt(chapter, volume, material) {
  const parts = []
  if (material.basic_info) {
    parts.push(`【书名】${material.basic_info.book_name || ''}  【类型】${material.basic_info.genre || ''}  【风格】${material.basic_info.style || ''}`)
  }
  if (material.world_building?.era_setting) {
    parts.push(`【世界观】${(material.world_building.era_setting || '').slice(0, 150)}`)
  }
  if (material.characters?.length) {
    parts.push(`【主要角色】${material.characters.filter(c => ['male_lead','female_lead','antagonist'].includes(c.role_type)).map(c => `${c.name}：${(c.image_prompt || c.description || '').slice(0, 80)}`).join('\n')}`)
  }

  const chapterContent = chapter.content || chapter.outline || ''

  return `你是一位专业的影视编剧兼分镜导演，负责将小说章节改编为完整的「剧本分镜脚本」，可直接用于 AI 视频生成（Sora/Kling/可灵等）或真人拍摄。

${parts.join('\n')}

【卷信息】第${volume?.volume_number || ''}卷：${volume?.title || ''}
【本章】第${chapter.chapter_number}章：${chapter.title || ''}
【章节正文】
${chapterContent.slice(0, 2000)}

---

请将以上章节内容改编为完整的剧本分镜脚本。每个场景按以下格式输出（直接输出纯文本，不要 JSON，不要 markdown 代码块）：

场景一

【镜头】3-5秒 | 全景 | 缓慢推进
【画面】清晨，长安城外官道，薄雾弥漫。玄奘身着白色僧袍，背负行囊，昂首向西而行。镜头从远处缓缓推进，人物由小变大，脚步坚定有力。逆光金色晨光勾勒出孤独的剪影。
【音效】晨风声，远处寺庙钟声隐约传来

---

场景二

【镜头】2-3秒 | 近景 | 固定
【画面】玄奘停步，侧脸入镜，眼神望向远方，嘴唇微动。
【对话】玄奘（低沉，坚定）："此去西天，山高路远，但佛法不取，誓不东归。"
【音效】风声渐止，寂静中只有脚步声

---

以此格式完整改编整个章节，场景数量根据章节内容决定（通常 5-15 个场景）。

格式要求：
1. 每个场景必须有【镜头】和【画面】，有对话的场景加【对话】，有音效的加【音效】
2. 【画面】要具体可执行：角色外貌/服装/动作/表情 + 环境细节 + 光线色调 + 运镜方式
3. 【对话】格式：角色名（语气/情绪）："台词内容"
4. 景别和运镜要有变化，动作戏用跟随/环绕，情感戏用特写/固定
5. 忠实还原原著情节，对话尽量从原文提取或贴近原文风格
6. 直接从"场景一"开始输出，不要任何前言或说明`
}

// Legacy: full generation prompt (still used for single-call regen)
export function buildFullGenerationPrompt(existingMaterial) {
  let base = `你是一位专业的小说创作策划大师，拥有深厚的中外文学功底。用户会给你一段创作提示词，你需要基于提示词生成完整的小说策划物料。

⚠️⚠️⚠️【第一优先级：IP 识别】
分析用户提示词是否涉及已有经典 IP（文学/影视/游戏/神话/历史等作品）：
- 出现经典人物名或作品名 → IP 改编：必须在 basic_info 中增加 ip_analysis 字段，忠实还原原作角色特征、世界观、时代背景，在此基础上进行改编创作
- 仅涉及通用题材概念 → 原创：正常创作

若为 IP 改编，basic_info 中必须包含：
"ip_analysis": { "is_ip_based": true, "source_works": ["原作名"], "era_context": "原作时代与文化语境(200字以上)", "known_characters": ["角色名"], "character_traits_summary": "各角色原作特征速写(每人50字以上)", "original_elements": "用户的改编方向(200字以上)", "must_preserve": "必须保留的原作要素" }

IP 改编铁律：原作角色保留经典性格和说话方式、世界观以原作为根基、时间线衔接原作、文化语境准确还原。

${JSON_RULE}

JSON 结构如下:
{
  "basic_info": { "ip_analysis": {}, "book_name": "", "genre": "", "style": "", "core_selling_point": "", "one_line_summary": "", "target_readers": "" },
  "world_building": { "era_setting": "", "power_structure": "", "rules": "", "social_atmosphere": "" },
  "characters": [{ "name": "只写名字本身，不加任何括号说明", "role_type": "male_lead/female_lead/supporting/antagonist/minor（根据题材灵活分配，不强制要求必须有female_lead）", "description": "", "core_desire": "", "weakness": "", "secret": "", "image_prompt": "中文形象提示词，格式：'年龄性别，面部特征，发型发色，服装配饰，气质神态，背景环境，写实风格，高清，电影质感'" }],
  "relations": [{ "from_name": "", "to_name": "", "relation_type": "", "faction": "", "interest_link": "", "emotion_link": "", "description": "" }],
  "plot_control": { "main_storyline": "", "outline_summary": "" },
  "volumes": [{ "volume_number": 1, "title": "", "goal": "", "summary": "" }],
  "writing_style": { "writing_style": "", "rhythm_requirement": "", "romance_ratio": "", "taboos": "", "red_lines": "" }
}

要求：
1. ⚠️【数量铁律】角色至少 10-15 个（IP 改编不少于 10 个）；relations 关系至少 12-20 条；volumes 卷数至少 6-10 卷（长篇 10 卷以上）；每卷章节至少 15-30 章；角色 name 字段只写名字本身，不加任何括号说明；以上均为硬性要求，绝对不能只生成最少量
2. 所有字段内容详细丰富
3. IP 改编时角色、世界观、剧情必须忠于原作基底，在此之上融入用户的改编方向`

  if (existingMaterial && Object.keys(existingMaterial).length > 0) {
    base += `\n\n以下是当前项目已有的物料：\n${JSON.stringify(existingMaterial, null, 2)}`
  }
  return base
}

export function buildSectionGenerationPrompt(section, existingMaterial) {
  return buildStepPrompt(section, '', existingMaterial)
}

// ---------- Chapter generation prompts ----------

export function buildChapterOutlinesPrompt(volume, material, existingChapters = []) {
  const parts = []
  if (material.basic_info) {
    const bi = material.basic_info
    parts.push(`【书名】${bi.book_name || ''}  【类型】${bi.genre || ''}  【风格】${bi.style || ''}`)
  }
  if (material.world_building) {
    const wb = material.world_building
    parts.push(`【世界观】${(wb.era_setting || '').slice(0, 200)}`)
  }
  if (material.characters?.length) {
    parts.push(`【角色】${material.characters.map(c => `${c.name}(${c.role_type}): ${(c.description || '').slice(0, 60)}`).join(' | ')}`)
  }
  if (material.plot_control) {
    parts.push(`【主线】${(material.plot_control.main_storyline || '').slice(0, 300)}`)
  }
  if (material.writing_style) {
    const ws = material.writing_style
    parts.push(`【文风】${(ws.writing_style || '').slice(0, 150)}`)
    if (ws.rhythm_requirement) parts.push(`【节奏】${ws.rhythm_requirement.slice(0, 100)}`)
  }

  let existingChapterBlock = ''
  if (existingChapters.length > 0) {
    const grouped = {}
    for (const ch of existingChapters) {
      const vol = ch.volume_number || '?'
      if (!grouped[vol]) grouped[vol] = []
      grouped[vol].push(ch)
    }
    const lines = []
    for (const [vol, chs] of Object.entries(grouped).sort((a, b) => a[0] - b[0])) {
      lines.push(`第${vol}卷：`)
      for (const ch of chs.sort((a, b) => a.chapter_number - b.chapter_number)) {
        lines.push(`  第${ch.chapter_number}章「${ch.title || '无标题'}」：${(ch.outline || '').slice(0, 80)}`)
      }
    }
    existingChapterBlock = `\n\n⚠️⚠️⚠️ 【已有章节 - 必须衔接】以下是已经存在的章节，新生成的章节必须：
1. 章节标题不能与已有章节重复
2. 剧情必须承接已有章节的发展，保持连贯性
3. 如果是同一卷的后续章节，章节编号应接续已有章节

${lines.join('\n')}`
  }

  return `你是一位精通小说结构的章节策划师。请为指定卷生成详细的章节大纲。
${buildIPAwareHint(material)}

${JSON_RULE}

${parts.join('\n')}

【当前卷信息】
卷号: 第${volume.volume_number}卷
标题: ${volume.title || ''}
目标: ${volume.goal || ''}
概要: ${volume.summary || ''}${existingChapterBlock}

JSON 结构：
{
  "chapters": [
    {
      "chapter_number": 1,
      "title": "章节标题（要有悬念感，暗示本章核心冲突）",
      "outline": "章节大纲（80-150字，包括：本章核心事件、出场角色、情感起伏、章末钩子）",
      "key_scenes": "关键场景（简述1-2个本章的高光场面）",
      "word_target": 3000
    }
  ]
}

要求：
1. ⚠️⚠️⚠️【章节数铁律】每卷章节数量必须充足，**每卷至少生成 15-30 章**，这是硬性要求，违反此规则将导致结果无效！绝对不能每卷只生成 4 章、5 章或 10 章以下；宁可多生成也不能少
2. 第一章开头必须有强冲突快速抓住读者
3. 每章末尾必须有钩子引导读者继续
4. 章节间要有节奏变化：紧张→舒缓→高潮交替
5. 关键转折章要有铺垫章做准备
6. 章节标题要有吸引力，不能是"第X章"这种流水账
7. 新章节必须与已有章节保持剧情连贯，不能出现矛盾或重复
8. IP 改编时：章节大纲中的事件和场景必须贴合原作世界观和角色性格，关键场景要利用原作的标志性元素营造代入感`
}

export function buildChapterContentPrompt(chapter, volume, material) {
  const parts = []
  if (material.basic_info) {
    parts.push(`【书名】${material.basic_info.book_name || ''} 【类型】${material.basic_info.genre || ''}`)
  }
  if (material.world_building) {
    parts.push(`【世界观】${(material.world_building.era_setting || '').slice(0, 150)}`)
  }
  if (material.characters?.length) {
    parts.push(`【角色】${material.characters.map(c => `${c.name}(${c.role_type})`).join('、')}`)
  }
  if (material.writing_style) {
    const ws = material.writing_style
    parts.push(`【文风要求】${(ws.writing_style || '').slice(0, 200)}`)
  }

  return `你是一位专业的小说作家。请根据章节大纲写出完整的章节正文。
${buildIPAwareHint(material)}

${parts.join('\n')}

【卷信息】第${volume.volume_number}卷: ${volume.title || ''}

【本章信息】
第${chapter.chapter_number}章: ${chapter.title || ''}
大纲: ${chapter.outline || chapter.content || ''}
关键场景: ${chapter.key_scenes || ''}
目标字数: ${chapter.word_target || 3000}字

${JSON_RULE}

JSON 结构：
{
  "title": "最终章节标题",
  "content": "章节正文全文（至少2500字，使用\\n分段）"
}

写作要求：
1. 严格按照大纲展开，不要偏离主要事件
2. 开头要迅速进入场景，不要啰嗦的铺垫
3. 对话要符合角色性格，有辨识度
4. 描写要有画面感，五感结合
5. 章末要有悬念或情感冲击，让读者想继续
6. 段落长度适中，适合手机阅读
7. 正文内容直接输出，不要加章节号标题前缀
8. IP 改编时：角色对话必须符合原作人设和说话风格（如孙悟空的桀骜不驯、猪八戒的油滑世故等），场景描写要还原原作的时代氛围和文化特征`
}
