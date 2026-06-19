import fs from 'fs'
import path from 'path'

const LOG_DIR = path.join(process.cwd(), 'logs')
const LOG_FILE = path.join(LOG_DIR, 'jobs.log')

export function logEvent(event: Record<string, any>) {
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true })
    const line = JSON.stringify({ ts: new Date().toISOString(), ...event }) + '\n'
    fs.appendFileSync(LOG_FILE, line)
  } catch (e) {
    // never crash the process due to logging failure
    console.error('Failed to write log event', e)
  }
}
