export const DEFAULT_CHAT_BACKGROUND_ID = 'midnight'

export const CHAT_BACKGROUNDS = [
  {
    id: 'midnight',
    label: 'Midnight',
    style: {
      backgroundColor: '#000000',
    },
  },
  {
    id: 'charcoal',
    label: 'Charcoal',
    style: {
      backgroundColor: '#141414',
    },
  },
  {
    id: 'navy',
    label: 'Navy',
    style: {
      backgroundColor: '#0a1628',
      backgroundImage: 'linear-gradient(180deg, #0d1f3c 0%, #060d18 100%)',
    },
  },
  {
    id: 'forest',
    label: 'Forest',
    style: {
      backgroundColor: '#0a1410',
      backgroundImage: 'linear-gradient(160deg, #0f2218 0%, #07100c 55%, #050a08 100%)',
    },
  },
  {
    id: 'wine',
    label: 'Wine',
    style: {
      backgroundColor: '#140a10',
      backgroundImage: 'linear-gradient(145deg, #2a1020 0%, #10060c 100%)',
    },
  },
  {
    id: 'aurora',
    label: 'Aurora',
    style: {
      backgroundColor: '#0a0e18',
      backgroundImage:
        'radial-gradient(ellipse 80% 60% at 20% 10%, rgba(56, 120, 255, 0.22) 0%, transparent 55%), radial-gradient(ellipse 70% 50% at 85% 75%, rgba(140, 70, 220, 0.18) 0%, transparent 50%), linear-gradient(180deg, #0c1220 0%, #050810 100%)',
    },
  },
  {
    id: 'dots',
    label: 'Dots',
    style: {
      backgroundColor: '#0c0f14',
      backgroundImage:
        'radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.07) 1px, transparent 0)',
      backgroundSize: '22px 22px',
    },
  },
  {
    id: 'grid',
    label: 'Grid',
    style: {
      backgroundColor: '#0a0c10',
      backgroundImage:
        'linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px)',
      backgroundSize: '28px 28px',
    },
  },
  {
    id: 'diagonal',
    label: 'Diagonal',
    style: {
      backgroundColor: '#0e1016',
      backgroundImage:
        'repeating-linear-gradient(-45deg, rgba(255, 255, 255, 0.03) 0, rgba(255, 255, 255, 0.03) 1px, transparent 1px, transparent 14px)',
    },
  },
  {
    id: 'carbon',
    label: 'Carbon',
    style: {
      backgroundColor: '#101214',
      backgroundImage:
        'linear-gradient(45deg, rgba(255, 255, 255, 0.025) 25%, transparent 25%, transparent 75%, rgba(255, 255, 255, 0.025) 75%), linear-gradient(45deg, rgba(255, 255, 255, 0.025) 25%, transparent 25%, transparent 75%, rgba(255, 255, 255, 0.025) 75%)',
      backgroundSize: '16px 16px',
      backgroundPosition: '0 0, 8px 8px',
    },
  },
  {
    id: 'waves',
    label: 'Waves',
    style: {
      backgroundColor: '#0b1018',
      backgroundImage:
        'radial-gradient(ellipse 120% 80% at 50% -20%, rgba(80, 140, 255, 0.12) 0%, transparent 50%), radial-gradient(ellipse 90% 60% at 10% 100%, rgba(60, 100, 200, 0.08) 0%, transparent 45%)',
    },
  },
  {
    id: 'stars',
    label: 'Stars',
    style: {
      backgroundColor: '#060810',
      backgroundImage:
        'radial-gradient(1px 1px at 20% 30%, rgba(255, 255, 255, 0.35) 0, transparent 100%), radial-gradient(1px 1px at 60% 70%, rgba(255, 255, 255, 0.25) 0, transparent 100%), radial-gradient(1px 1px at 80% 20%, rgba(255, 255, 255, 0.2) 0, transparent 100%), radial-gradient(1px 1px at 35% 85%, rgba(255, 255, 255, 0.18) 0, transparent 100%), radial-gradient(1px 1px at 90% 55%, rgba(255, 255, 255, 0.22) 0, transparent 100%)',
    },
  },
]

const backgroundById = new Map(CHAT_BACKGROUNDS.map((item) => [item.id, item]))

export function getChatBackground(id) {
  return backgroundById.get(id) || backgroundById.get(DEFAULT_CHAT_BACKGROUND_ID)
}

export function resolveChatBackgroundId(profile) {
  const id = profile?.chatBackgroundId
  if (id && backgroundById.has(id)) return id
  return DEFAULT_CHAT_BACKGROUND_ID
}
