import sql from '../db/index.js'

const ROLE_COLORS = ['#0070f3', '#8b5cf6', '#00a86b', '#ee4444', '#f5a623', '#06b6d4', '#ec4899', '#84cc16']

function pickColor(index) {
  return ROLE_COLORS[index % ROLE_COLORS.length]
}

function extractJson(text) {
  let cleaned = text.trim()
  // Strip markdown code fences if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
  }
  return JSON.parse(cleaned)
}

export async function parseAndSaveAll(projectId, aiRawResult) {
  const data = extractJson(aiRawResult)

  if (data.basic_info) {
    await saveBasicInfo(projectId, data.basic_info)
  }
  if (data.world_building) {
    await saveWorldBuilding(projectId, data.world_building)
  }

  let characterIdMap = {}
  if (data.characters && data.characters.length) {
    characterIdMap = await saveCharacters(projectId, data.characters)
  }

  if (data.relations && data.relations.length) {
    await saveRelations(projectId, data.relations, characterIdMap)
  }

  if (data.plot_control) {
    await savePlotControl(projectId, data.plot_control)
  }
  if (data.volumes && data.volumes.length) {
    await saveVolumes(projectId, data.volumes)
  }
  if (data.writing_style) {
    await saveWritingStyle(projectId, data.writing_style)
  }

  // Update project name from basic_info if available
  if (data.basic_info?.book_name) {
    await sql`UPDATE projects SET name = ${data.basic_info.book_name}, updated_at = NOW() WHERE id = ${projectId}`
  }
}

export async function parseAndSaveSection(projectId, section, aiRawResult) {
  const data = extractJson(aiRawResult)
  const sectionData = data[section] ?? data

  switch (section) {
    case 'basic_info':
      await saveBasicInfo(projectId, sectionData)
      if (sectionData.book_name) {
        await sql`UPDATE projects SET name = ${sectionData.book_name}, updated_at = NOW() WHERE id = ${projectId}`
      }
      break
    case 'world_building':
      await saveWorldBuilding(projectId, sectionData)
      break
    case 'characters': {
      const chars = Array.isArray(sectionData) ? sectionData : (sectionData.characters || [])
      await saveCharacters(projectId, chars)
      break
    }
    case 'relations': {
      const rels = Array.isArray(sectionData) ? sectionData : (sectionData.relations || [])
      const chars = await sql`SELECT id, name FROM characters WHERE project_id = ${projectId}`
      const nameMap = {}
      chars.forEach(c => { nameMap[c.name] = c.id })
      await saveRelations(projectId, rels, nameMap)
      break
    }
    case 'plot_control':
      await savePlotControl(projectId, sectionData)
      break
    case 'volumes': {
      const vols = Array.isArray(sectionData) ? sectionData : (sectionData.volumes || [])
      await saveVolumes(projectId, vols)
      break
    }
    case 'writing_style':
      await saveWritingStyle(projectId, sectionData)
      break
  }
}

async function saveBasicInfo(projectId, d) {
  const exists = await sql`SELECT id FROM basic_info WHERE project_id = ${projectId}`
  if (exists.length) {
    await sql`UPDATE basic_info SET
      book_name = ${d.book_name || ''}, genre = ${d.genre || ''},
      style = ${d.style || ''}, core_selling_point = ${d.core_selling_point || ''},
      one_line_summary = ${d.one_line_summary || ''}, target_readers = ${d.target_readers || ''},
      updated_at = NOW()
    WHERE project_id = ${projectId}`
  } else {
    await sql`INSERT INTO basic_info (project_id, book_name, genre, style, core_selling_point, one_line_summary, target_readers)
    VALUES (${projectId}, ${d.book_name || ''}, ${d.genre || ''}, ${d.style || ''},
      ${d.core_selling_point || ''}, ${d.one_line_summary || ''}, ${d.target_readers || ''})`
  }
}

async function saveWorldBuilding(projectId, d) {
  const exists = await sql`SELECT id FROM world_building WHERE project_id = ${projectId}`
  if (exists.length) {
    await sql`UPDATE world_building SET
      era_setting = ${d.era_setting || ''}, power_structure = ${d.power_structure || ''},
      rules = ${d.rules || ''}, social_atmosphere = ${d.social_atmosphere || ''},
      updated_at = NOW()
    WHERE project_id = ${projectId}`
  } else {
    await sql`INSERT INTO world_building (project_id, era_setting, power_structure, rules, social_atmosphere)
    VALUES (${projectId}, ${d.era_setting || ''}, ${d.power_structure || ''}, ${d.rules || ''}, ${d.social_atmosphere || ''})`
  }
}

async function saveCharacters(projectId, characters) {
  // Clear existing characters (and cascade deletes relations)
  await sql`DELETE FROM character_relations WHERE project_id = ${projectId}`
  await sql`DELETE FROM characters WHERE project_id = ${projectId}`

  const nameToId = {}
  for (let i = 0; i < characters.length; i++) {
    const c = characters[i]
    const [row] = await sql`INSERT INTO characters
      (project_id, name, role_type, description, core_desire, weakness, secret, avatar_color)
      VALUES (${projectId}, ${c.name || '未命名'}, ${c.role_type || 'supporting'},
        ${c.description || ''}, ${c.core_desire || ''}, ${c.weakness || ''},
        ${c.secret || ''}, ${pickColor(i)})
      RETURNING id`
    nameToId[c.name] = row.id
  }
  return nameToId
}

async function saveRelations(projectId, relations, nameToId) {
  await sql`DELETE FROM character_relations WHERE project_id = ${projectId}`

  for (const r of relations) {
    const fromId = nameToId[r.from_name]
    const toId = nameToId[r.to_name]
    if (!fromId || !toId) continue

    await sql`INSERT INTO character_relations
      (project_id, from_character_id, to_character_id, relation_type, faction, interest_link, emotion_link, description)
      VALUES (${projectId}, ${fromId}, ${toId},
        ${r.relation_type || ''}, ${r.faction || ''},
        ${r.interest_link || ''}, ${r.emotion_link || ''}, ${r.description || ''})`
  }
}

async function savePlotControl(projectId, d) {
  const exists = await sql`SELECT id FROM plot_control WHERE project_id = ${projectId}`
  if (exists.length) {
    await sql`UPDATE plot_control SET
      main_storyline = ${d.main_storyline || ''}, outline_summary = ${d.outline_summary || ''},
      updated_at = NOW()
    WHERE project_id = ${projectId}`
  } else {
    await sql`INSERT INTO plot_control (project_id, main_storyline, outline_summary)
    VALUES (${projectId}, ${d.main_storyline || ''}, ${d.outline_summary || ''})`
  }
}

async function saveVolumes(projectId, volumes) {
  // Delete existing chapters first (FK constraint), then volumes
  await sql`DELETE FROM chapters WHERE project_id = ${projectId}`
  await sql`DELETE FROM volumes WHERE project_id = ${projectId}`

  for (const v of volumes) {
    await sql`INSERT INTO volumes (project_id, volume_number, title, goal, summary)
    VALUES (${projectId}, ${v.volume_number || 1}, ${v.title || ''}, ${v.goal || ''}, ${v.summary || ''})`
  }
}

async function saveWritingStyle(projectId, d) {
  const exists = await sql`SELECT id FROM writing_style WHERE project_id = ${projectId}`
  if (exists.length) {
    await sql`UPDATE writing_style SET
      writing_style = ${d.writing_style || ''},
      character_voice = ${JSON.stringify(d.character_voice || {})},
      rhythm_requirement = ${d.rhythm_requirement || ''},
      romance_ratio = ${d.romance_ratio || ''},
      taboos = ${d.taboos || ''}, red_lines = ${d.red_lines || ''},
      updated_at = NOW()
    WHERE project_id = ${projectId}`
  } else {
    await sql`INSERT INTO writing_style (project_id, writing_style, character_voice, rhythm_requirement, romance_ratio, taboos, red_lines)
    VALUES (${projectId}, ${d.writing_style || ''}, ${JSON.stringify(d.character_voice || {})},
      ${d.rhythm_requirement || ''}, ${d.romance_ratio || ''}, ${d.taboos || ''}, ${d.red_lines || ''})`
  }
}
