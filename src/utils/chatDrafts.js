const STORAGE_KEY = 'arvolio_chat_drafts'

function loadAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
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
