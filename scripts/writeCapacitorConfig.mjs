import { writeCapacitorConfigFiles } from './capacitorDev.mjs'

const production = process.env.CAP_PRODUCTION === '1'
const { devUrl } = writeCapacitorConfigFiles({ production })

if (production) {
  console.log('[capacitor] Production config (bundled dist, https://localhost)')
} else {
  console.log(`[capacitor] Dev server → ${devUrl}`)
  const host = process.env.CAP_DEV_HOST || 'localhost'
  if (host !== 'localhost' && host !== '127.0.0.1' && host !== 'lan' && host !== 'auto') {
    console.log(
      '[capacitor] Tip: Firebase Auth blocks LAN IPs on some setups. Simulator: omit CAP_DEV_HOST (uses localhost).'
    )
  }
}
