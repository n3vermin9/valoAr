import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { getLocalIp } from './getLocalIp.mjs'

const IOS_CONFIG = 'ios/App/App/capacitor.config.json'
const ROOT_CONFIG = 'capacitor.config.json'

function resolveDevHost() {
  const env = process.env.CAP_DEV_HOST?.trim()
  if (!env) return 'localhost'
  const raw = env.toLowerCase()
  if (raw === 'lan' || raw === 'auto' || raw === 'ip') return getLocalIp()
  return env
}

export function buildCapacitorConfig({ production = false, devHost, devPort = '5173' } = {}) {
  const host = devHost || resolveDevHost()
  const port = process.env.CAP_DEV_PORT || devPort
  const devUrl = `http://${host}:${port}`
  // CapacitorHttp uses URLSession — broken for many HTTPS hosts on iOS 18.4+ Simulator
  // (QUIC / "cannot parse response"). Keep it off for live reload; optional for device builds.
  const enableNativeHttp = process.env.CAP_HTTP === '1'

  if (production) {
    return {
      config: {
        appId: 'com.arvolio.valoar',
        appName: 'valoAr',
        webDir: 'dist',
        server: {
          androidScheme: 'https',
          iosScheme: 'https',
          hostname: 'localhost',
        },
        plugins: {
          CapacitorHttp: { enabled: enableNativeHttp },
          // none: keep WKWebView full-height; chat lifts via --app-keyboard-inset.
          // native shrinks the webview but fixed composers often stay under the keyboard.
          Keyboard: { resize: 'none', style: 'dark' },
        },
      },
      devUrl: null,
    }
  }

  return {
    config: {
      appId: 'com.arvolio.valoar',
      appName: 'valoAr',
      webDir: 'dist',
      server: {
        androidScheme: 'https',
        url: devUrl,
        cleartext: true,
      },
      plugins: {
        CapacitorHttp: { enabled: false },
        // none: keep WKWebView full-height; chat lifts via --app-keyboard-inset.
        Keyboard: { resize: 'none', style: 'dark' },
      },
    },
    devUrl,
  }
}

export function writeCapacitorConfigFiles({ production = false, devHost, devPort } = {}) {
  const { config, devUrl } = buildCapacitorConfig({ production, devHost, devPort })
  writeFileSync(ROOT_CONFIG, `${JSON.stringify(config, null, 2)}\n`)

  if (existsSync(dirname(IOS_CONFIG)) || existsSync(IOS_CONFIG)) {
    let packageClassList = ['KeyboardPlugin']
    try {
      if (existsSync(IOS_CONFIG)) {
        const prev = JSON.parse(readFileSync(IOS_CONFIG, 'utf8'))
        if (Array.isArray(prev.packageClassList)) packageClassList = prev.packageClassList
      }
    } catch {
      /* ignore */
    }
    mkdirSync(dirname(IOS_CONFIG), { recursive: true })
    writeFileSync(
      IOS_CONFIG,
      `${JSON.stringify({ ...config, packageClassList }, null, '\t')}\n`
    )
  }

  return { config, devUrl }
}

/** Vite plugin: point the iOS app at this dev server and keep HMR working in Simulator. */
export function capacitorLiveReload() {
  let configuredUrl = null

  return {
    name: 'valo-capacitor-live-reload',
    apply: 'serve',
    configureServer(server) {
      const syncNative = () => {
        const address = server.httpServer?.address()
        const port =
          typeof address === 'object' && address ? String(address.port) : process.env.CAP_DEV_PORT || '5173'
        const host = resolveDevHost()
        const { devUrl } = writeCapacitorConfigFiles({ production: false, devHost: host, devPort: port })
        configuredUrl = devUrl
        console.log(`\n  [capacitor] Live reload → ${devUrl}`)
        console.log('  [capacitor] CapacitorHttp off (avoids iOS Simulator HTTP/3 / -1017 errors).')
        console.log('  [capacitor] Simulator: rebuild once in Xcode (⌘R), then edits hot-reload like the browser.')
        console.log('  [capacitor] Physical device: CAP_DEV_HOST=lan npm run dev\n')
      }

      server.httpServer?.once('listening', syncNative)
      // If already listening when plugin attaches
      if (server.httpServer?.listening) syncNative()
    },
    buildStart() {
      // Ensure root config exists before first listen on cold starts
      if (!configuredUrl) {
        writeCapacitorConfigFiles({ production: false })
      }
    },
  }
}
