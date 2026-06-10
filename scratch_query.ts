import fs from 'fs'
import path from 'path'

try {
  const envPath = path.resolve('.env.local')
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n')
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
      if (match) {
        const key = match[1]
        let val = match[2] || ''
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1)
        process.env[key] = val
      }
    }
  }
} catch (e) {
  console.warn('Failed to load .env.local manually', e)
}

import { supabaseAdmin } from './lib/supabase'

async function run() {
  try {
    const { data, error } = await supabaseAdmin
      .from('cases')
      .select('case_number, full_name, status, emirates_id, case_study')
      .or('case_number.eq.MSZHP_43605,case_number.like.MSZHP_43605%')
    if (error) throw error
    console.log('Faisal Cases:', JSON.stringify(data, null, 2))
  } catch (err) {
    console.error('Error querying cases:', err)
  }
}

run()
