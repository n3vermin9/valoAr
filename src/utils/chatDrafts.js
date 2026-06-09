const STORAGE_KEY = 'valoar_chat_drafts'
const LEGACY_STORAGE_KEY = 'arvolio_chat_drafts'

function loadAll() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)

    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (legacy) {
      localStorage.setItem(STORAGE_KEY, legacy)
      localStorage.removeItem(LEGACY_STORAGE_KEY)
      return JSON.parse(legacy)
    }

    return {}
  } catch {
    return {}
  }
}

export function getChatDraft(chatId) {
  if (!chatId) return ''
  return loadAll()[chatId] || ''
}

export function setChatDraft(chatId, text) {
  if (!chatId) return
  const all = loadAll()
  if (!text) {
    delete all[chatId]
  } else {
    all[chatId] = text
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
}

export function clearChatDraft(chatId) {
  setChatDraft(chatId, '')
}
