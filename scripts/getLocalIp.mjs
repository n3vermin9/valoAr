import os from 'node:os'

const PREFERRED_INTERFACES = ['en0', 'en1', 'wlan0', 'eth0']

function isUsableIpv4(net) {
  if (!net || net.internal) return false
  const family = net.family
  if (family !== 'IPv4' && family !== 4) return false
  if (net.address.startsWith('169.254.')) return false
  return true
}

/** Pick the machine's LAN IPv4 for Capacitor live reload (phone on same Wi‑Fi). */
export function getLocalIp() {
  let nets
  try {
    nets = os.networkInterfaces()
  } catch {
    return '127.0.0.1'
  }

  for (const name of PREFERRED_INTERFACES) {
    const hit = nets[name]?.find(isUsableIpv4)
    if (hit) return hit.address
  }

  for (const interfaces of Object.values(nets)) {
    const hit = interfaces?.find(isUsableIpv4)
    if (hit) return hit.address
  }

  return '127.0.0.1'
}
