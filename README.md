# valoAr

A modern friend-finding and chat app built with React, Vite, Tailwind CSS, and Firebase. Discover people, send friend requests, and chat in real time — not a dating app.

## Features

### Profiles & discovery
- Email/password authentication with profile setup (username, photos, bio, age, gender, interests)
- Swipe-based discovery to find new friends
- Username search
- Public profiles with social links (Telegram, Instagram, TikTok)
- Share profile links, edit profile, block users

### Friends & requests
- Send and receive friend requests (with optional message)
- Accept or decline incoming requests
- Friends list and remove-friend options (keep chat history or delete chat)
- Direct messages when allowed by profile settings

### Chat
- Real-time messaging with read receipts and typing indicators
- Online / last-seen presence
- Photo and voice messages
- Replies, reactions, @mentions, and swipe-to-reply
- Pin chats, mute notifications, drafts, and Saved Messages
- Delete messages and remove chats

### App experience
- Bottom tab navigation (Discover, Chats, Requests, Profile)
- 24-hour time display by default
- Deleted accounts show username only with chat history preserved
- Debug tools for development (hidden route via double-tap Chats tab)

## Setup

1. Copy `.env.example` to `.env` and fill in your Firebase credentials:

```bash
cp .env.example .env
```

2. Install dependencies:

```bash
npm install
```

3. Deploy Firebase rules and indexes:

```bash
firebase deploy --only firestore:rules,firestore:indexes,database,storage
```

4. Start the dev server:

```bash
npm run dev
```

## Tech stack

- React 19 / Vite
- Tailwind CSS 4
- Firebase (Auth, Firestore, Realtime Database, Storage)
- Framer Motion
- Tabler Icons
- React Hot Toast
- emoji-picker-react

## Firebase structure

- `users/{userId}` — profiles, friends, swipes, blocked list, settings
- `users/{userId}/likesReceived/{fromUserId}` — incoming friend requests
- `usernames/{username}` — username → userId mapping
- `deletedUsers/{userId}` — tombstone for deleted accounts (username only)
- `chats/{matchId}` — chat metadata (`unfriended`, `opponentRemoved`, pins, mutes)
- `chats/{matchId}/messages/{messageId}` — messages
- RTDB `presence/{userId}` — online status
- RTDB `typing/{matchId}/{userId}` — typing indicators
- Storage `chat-images/{matchId}/{fileName}` — chat photo uploads
- Storage `chat-voice/{matchId}/{fileName}` — voice message uploads

## Media uploads

Chat photos and voice notes upload to **Firebase Storage** using `VITE_FIREBASE_STORAGE_BUCKET`.

**Setup (required once):**
1. Firebase Console → **Storage** → **Get started**
2. Copy the bucket name into `.env`
3. Deploy rules: `firebase deploy --only storage`
4. If uploads fail with CORS/404, apply CORS to the bucket:
   `gsutil cors set storage.cors.json gs://YOUR_BUCKET_NAME`

Profile photos use direct image URLs.

## Dev shortcuts

- **Login / Register** — tap the logo to create a random dev account and jump to profile setup
- **Debug tools** — double-tap the Chats tab in the bottom nav (or go to `/debug`)
