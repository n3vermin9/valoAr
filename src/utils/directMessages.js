export function isOpenToDirectMessages(profile) {
  return profile?.allowDirectMessages === true
}

export function areFriends(myProfile, otherId) {
  return Boolean(otherId && myProfile?.matches?.includes(otherId))
}

export function canDirectMessage({ myProfile, otherProfile, otherId }) {
  if (!otherId) return true
  if (areFriends(myProfile, otherId)) return true
  return isOpenToDirectMessages(myProfile) && isOpenToDirectMessages(otherProfile)
}

export function getDirectMessageBlockReason({
  myProfile,
  otherProfile,
  otherId,
  otherUsername = 'this user',
}) {
  if (canDirectMessage({ myProfile, otherProfile, otherId: otherId || otherProfile?.id })) return null

  const iOpen = isOpenToDirectMessages(myProfile)
  const theyOpen = isOpenToDirectMessages(otherProfile)
  const name = otherUsername.startsWith('@') ? otherUsername : `@${otherUsername}`

  if (iOpen && !theyOpen) {
    return {
      type: 'they_closed',
      message: `${name} isn't open to messages from people they aren't friends with.`,
      showSettingsLink: false,
    }
  }

  if (!iOpen && theyOpen) {
    return {
      type: 'i_closed',
      message: `Turn on Open to messages in Settings to chat with ${name}.`,
      showSettingsLink: true,
    }
  }

  return {
    type: 'both_closed',
    message: `If you want to message ${name}, turn on Open to messages in Settings so non-friends can reach you too.`,
    showSettingsLink: true,
  }
}
