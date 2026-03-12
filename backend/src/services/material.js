import sql from '../db/index.js'

export async function compileMaterial(projectId) {
  const [basicInfo] = await sql`SELECT * FROM basic_info WHERE project_id = ${projectId}`
  const [worldBuilding] = await sql`SELECT * FROM world_building WHERE project_id = ${projectId}`
  const characters = await sql`SELECT * FROM characters WHERE project_id = ${projectId}`
  const relations = await sql`SELECT * FROM character_relations WHERE project_id = ${projectId}`
  const [plotControl] = await sql`SELECT * FROM plot_control WHERE project_id = ${projectId}`
  const volumes = await sql`SELECT * FROM volumes WHERE project_id = ${projectId} ORDER BY volume_number`
  const chapters = await sql`
    SELECT id, volume_id, chapter_number, title, status, word_count,
      LEFT(content, 200) as content_preview
    FROM chapters WHERE project_id = ${projectId} ORDER BY chapter_number
  `
  const plotDevices = await sql`SELECT * FROM plot_devices WHERE project_id = ${projectId}`
  const [writingStyle] = await sql`SELECT * FROM writing_style WHERE project_id = ${projectId}`

  const content = {
    basic_info: basicInfo ? {
      book_name: basicInfo.book_name,
      genre: basicInfo.genre,
      style: basicInfo.style,
      core_selling_point: basicInfo.core_selling_point,
      one_line_summary: basicInfo.one_line_summary,
      target_readers: basicInfo.target_readers
    } : {},
    world_building: worldBuilding ? {
      era_setting: worldBuilding.era_setting,
      power_structure: worldBuilding.power_structure,
      rules: worldBuilding.rules,
      social_atmosphere: worldBuilding.social_atmosphere
    } : {},
    characters: characters.map(c => ({
      id: c.id, name: c.name, role_type: c.role_type,
      description: c.description, core_desire: c.core_desire,
      weakness: c.weakness, secret: c.secret
    })),
    relations: relations.map(r => ({
      from: r.from_character_id, to: r.to_character_id,
      type: r.relation_type, faction: r.faction,
      interest: r.interest_link, emotion: r.emotion_link, desc: r.description
    })),
    plot: plotControl ? {
      main_storyline: plotControl.main_storyline,
      outline_summary: plotControl.outline_summary
    } : {},
    volumes: volumes.map(v => ({
      number: v.volume_number, title: v.title, goal: v.goal, summary: v.summary
    })),
    chapters_summary: chapters.map(ch => ({
      number: ch.chapter_number, title: ch.title, status: ch.status,
      word_count: ch.word_count, preview: ch.content_preview
    })),
    plot_devices: plotDevices.map(d => ({
      type: d.device_type, description: d.description,
      setup: d.setup_chapter, payoff: d.payoff_chapter, status: d.status
    })),
    writing_style: writingStyle ? {
      style: writingStyle.writing_style,
      character_voice: writingStyle.character_voice,
      rhythm: writingStyle.rhythm_requirement,
      romance_ratio: writingStyle.romance_ratio,
      taboos: writingStyle.taboos,
      red_lines: writingStyle.red_lines
    } : {}
  }

  // Get latest version number
  const [latest] = await sql`
    SELECT version FROM materials WHERE project_id = ${projectId} ORDER BY version DESC LIMIT 1
  `
  const version = (latest?.version || 0) + 1

  const [material] = await sql`
    INSERT INTO materials (project_id, content, version)
    VALUES (${projectId}, ${JSON.stringify(content)}, ${version})
    RETURNING *
  `

  return material
}
