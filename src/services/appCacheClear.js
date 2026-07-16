import { clearCache as clearUserCache } from './userCache'
import { clearChatsListSnapshot } from './chatsListCache'
import { clearChatRoomSnapshot } from './chatRoomCache'
import { clearInboxPageSnapshot } from './inboxPageCache'
import { clearStoriesFeedSnapshot } from './storiesFeedCache'
import { clearDiscoverCardsSnapshot } from './discoverCardsCache'
import { clearProfileSnapshots } from './profileSnapshotCache'

/** Wipe all offline UI snapshots on logout / account switch. */
export function clearAllAppCaches() {
  clearUserCache()
  clearChatsListSnapshot()
  clearChatRoomSnapshot()
  clearInboxPageSnapshot()
  clearStoriesFeedSnapshot()
  clearDiscoverCardsSnapshot()
  clearProfileSnapshots()
}
