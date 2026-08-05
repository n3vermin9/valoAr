export const DEFAULT_CHAT_BACKGROUND_ID = 'ink'

/**
 * Chat wallpapers — dark, low-contrast textures that sit behind bubbles without fighting them.
 * Kept as pure CSS so previews and the live room share one paint path.
 */
export const CHAT_BACKGROUNDS = [
  {
    id: 'ink',
    label: 'Ink',
    style: {
      backgroundColor: '#0a0a0a',
    },
  },
  {
    id: 'slate',
    label: 'Slate',
    style: {
      backgroundColor: '#101418',
      backgroundImage: 'linear-gradient(180deg, #151a20 0%, #0c1014 100%)',
    },
  },
  {
    id: 'dusk',
    label: 'Dusk',
    style: {
      backgroundColor: '#0c1018',
      backgroundImage:
        'radial-gradient(ellipse 90% 55% at 50% -10%, rgba(70, 100, 180, 0.28) 0%, transparent 58%), linear-gradient(180deg, #121826 0%, #080a10 100%)',
    },
  },
  {
    id: 'ember',
    label: 'Ember',
    style: {
      backgroundColor: '#120c0a',
      backgroundImage:
        'radial-gradient(ellipse 80% 50% at 80% 0%, rgba(180, 70, 40, 0.2) 0%, transparent 55%), linear-gradient(165deg, #1a100e 0%, #0a0808 100%)',
    },
  },
  {
    id: 'moss',
    label: 'Moss',
    style: {
      backgroundColor: '#0a120e',
      backgroundImage:
        'radial-gradient(ellipse 70% 45% at 15% 0%, rgba(60, 140, 90, 0.18) 0%, transparent 50%), linear-gradient(180deg, #101816 0%, #070c0a 100%)',
    },
  },
  {
    id: 'plum',
    label: 'Plum',
    style: {
      backgroundColor: '#100c14',
      backgroundImage:
        'radial-gradient(ellipse 75% 50% at 100% 0%, rgba(120, 60, 160, 0.22) 0%, transparent 52%), linear-gradient(180deg, #16101c 0%, #0a080e 100%)',
    },
  },
  {
    id: 'mist',
    label: 'Mist',
    style: {
      backgroundColor: '#0e1216',
      backgroundImage:
        'radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.055) 1px, transparent 0)',
      backgroundSize: '18px 18px',
    },
  },
  {
    id: 'graph',
    label: 'Graph',
    style: {
      backgroundColor: '#0c0e12',
      backgroundImage:
        'linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px)',
      backgroundSize: '32px 32px',
    },
  },
  {
    id: 'ripple',
    label: 'Ripple',
    style: {
      backgroundColor: '#0a0e14',
      backgroundImage:
        'repeating-radial-gradient(circle at 50% 120%, transparent 0, transparent 18px, rgba(120, 160, 255, 0.04) 19px, transparent 20px)',
    },
  },
  {
    id: 'haze',
    label: 'Haze',
    style: {
      backgroundColor: '#0c0e14',
      backgroundImage:
        'radial-gradient(ellipse 100% 70% at 0% 100%, rgba(90, 130, 220, 0.12) 0%, transparent 50%), radial-gradient(ellipse 80% 60% at 100% 0%, rgba(180, 100, 200, 0.1) 0%, transparent 48%), linear-gradient(180deg, #10141c 0%, #080a10 100%)',
    },
  },
  {
    id: 'sand',
    label: 'Sand',
    style: {
      backgroundColor: '#12100e',
      backgroundImage:
        'linear-gradient(180deg, #1a1612 0%, #0e0c0a 100%), repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255, 220, 180, 0.02) 3px, rgba(255, 220, 180, 0.02) 4px)',
    },
  },
  {
    id: 'void',
    label: 'Void',
    style: {
      backgroundColor: '#050508',
      backgroundImage:
        'radial-gradient(1.2px 1.2px at 18% 28%, rgba(255, 255, 255, 0.28) 0, transparent 100%), radial-gradient(1px 1px at 72% 62%, rgba(255, 255, 255, 0.2) 0, transparent 100%), radial-gradient(1px 1px at 42% 78%, rgba(255, 255, 255, 0.16) 0, transparent 100%), radial-gradient(1.4px 1.4px at 88% 22%, rgba(255, 255, 255, 0.22) 0, transparent 100%), radial-gradient(1px 1px at 55% 35%, rgba(255, 255, 255, 0.14) 0, transparent 100%)',
    },
  },
]

const backgroundById = new Map(CHAT_BACKGROUNDS.map((item) => [item.id, item]))

/** Soft paper / tinted variants so light UI doesn’t sit on a black void. */
const LIGHT_CHAT_STYLES = {
  ink: { backgroundColor: '#f2f2f7' },
  slate: {
    backgroundColor: '#eef1f4',
    backgroundImage: 'linear-gradient(180deg, #f4f6f8 0%, #e8ecf0 100%)',
  },
  dusk: {
    backgroundColor: '#e8eef8',
    backgroundImage:
      'radial-gradient(ellipse 90% 55% at 50% -10%, rgba(70, 100, 180, 0.16) 0%, transparent 58%), linear-gradient(180deg, #eef2fa 0%, #e4eaf4 100%)',
  },
  ember: {
    backgroundColor: '#f4ece8',
    backgroundImage:
      'radial-gradient(ellipse 80% 50% at 80% 0%, rgba(180, 70, 40, 0.12) 0%, transparent 55%), linear-gradient(165deg, #f7f0ec 0%, #efe6e0 100%)',
  },
  moss: {
    backgroundColor: '#e8f0ea',
    backgroundImage:
      'radial-gradient(ellipse 70% 45% at 15% 0%, rgba(60, 140, 90, 0.12) 0%, transparent 50%), linear-gradient(180deg, #eef5f0 0%, #e2ebe4 100%)',
  },
  plum: {
    backgroundColor: '#efe8f2',
    backgroundImage:
      'radial-gradient(ellipse 75% 50% at 100% 0%, rgba(120, 60, 160, 0.12) 0%, transparent 52%), linear-gradient(180deg, #f4eef6 0%, #eae4ee 100%)',
  },
  mist: {
    backgroundColor: '#eef1f4',
    backgroundImage:
      'radial-gradient(circle at 1px 1px, rgba(60, 60, 67, 0.08) 1px, transparent 0)',
    backgroundSize: '18px 18px',
  },
  graph: {
    backgroundColor: '#eef0f3',
    backgroundImage:
      'linear-gradient(rgba(60, 60, 67, 0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(60, 60, 67, 0.06) 1px, transparent 1px)',
    backgroundSize: '32px 32px',
  },
  ripple: {
    backgroundColor: '#eaf0f6',
    backgroundImage:
      'repeating-radial-gradient(circle at 50% 120%, transparent 0, transparent 18px, rgba(70, 110, 200, 0.07) 19px, transparent 20px)',
  },
  haze: {
    backgroundColor: '#eceef4',
    backgroundImage:
      'radial-gradient(ellipse 100% 70% at 0% 100%, rgba(90, 130, 220, 0.1) 0%, transparent 50%), radial-gradient(ellipse 80% 60% at 100% 0%, rgba(180, 100, 200, 0.08) 0%, transparent 48%), linear-gradient(180deg, #f2f3f8 0%, #e6e8f0 100%)',
  },
  sand: {
    backgroundColor: '#f3eee8',
    backgroundImage:
      'linear-gradient(180deg, #f7f2ec 0%, #ebe4dc 100%), repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(140, 100, 60, 0.03) 3px, rgba(140, 100, 60, 0.03) 4px)',
  },
  void: {
    backgroundColor: '#e8eaf0',
    backgroundImage:
      'radial-gradient(1.2px 1.2px at 18% 28%, rgba(60, 60, 67, 0.22) 0, transparent 100%), radial-gradient(1px 1px at 72% 62%, rgba(60, 60, 67, 0.16) 0, transparent 100%), radial-gradient(1px 1px at 42% 78%, rgba(60, 60, 67, 0.12) 0, transparent 100%), radial-gradient(1.4px 1.4px at 88% 22%, rgba(60, 60, 67, 0.18) 0, transparent 100%), radial-gradient(1px 1px at 55% 35%, rgba(60, 60, 67, 0.1) 0, transparent 100%)',
  },
}

/** Older palette ids still stored on profiles map onto the closest new wallpaper. */
const LEGACY_BACKGROUND_IDS = {
  midnight: 'ink',
  charcoal: 'slate',
  navy: 'dusk',
  forest: 'moss',
  wine: 'plum',
  aurora: 'haze',
  dots: 'mist',
  grid: 'graph',
  diagonal: 'graph',
  carbon: 'slate',
  waves: 'ripple',
  stars: 'void',
}

export function getChatBackground(id, appearance = 'dark') {
  const resolved = LEGACY_BACKGROUND_IDS[id] || id
  const base = backgroundById.get(resolved) || backgroundById.get(DEFAULT_CHAT_BACKGROUND_ID)
  if (appearance !== 'light') return base
  const lightStyle = LIGHT_CHAT_STYLES[base.id]
  if (!lightStyle) return base
  return { ...base, style: lightStyle }
}

export function resolveChatBackgroundId(profile) {
  const id = profile?.chatBackgroundId
  if (!id) return DEFAULT_CHAT_BACKGROUND_ID
  if (backgroundById.has(id)) return id
  const mapped = LEGACY_BACKGROUND_IDS[id]
  if (mapped && backgroundById.has(mapped)) return mapped
  return DEFAULT_CHAT_BACKGROUND_ID
}
