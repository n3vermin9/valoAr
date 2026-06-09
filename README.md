# valoAr

A modern dating app built with React, Vite, Tailwind CSS, and Firebase.

## Features

- Email/password authentication
- Profile setup with username validation, age slider, and photo URLs
- Swipe-based discovery with Framer Motion gestures
- Real-time chat with read receipts, typing indicators, and online status
- Liked You section with accept/decline and desktop notifications
- Block/unmatch, mute chats, delete messages, and account deletion

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

## Tech Stack

- React 18+ / Vite
- Tailwind CSS 4
- Firebase (Auth, Firestore, Realtime Database, Storage)
- Framer Motion
- Tabler Icons
- React Hot Toast
- emoji-picker-react

## Firebase Structure

- `users/{userId}` — profiles, matches, swipes, blocked list
- `users/{userId}/likesReceived/{fromUserId}` — incoming likes
- `usernames/{username}` — username → userId mapping
- `chats/{matchId}` — chat metadata
- `chats/{matchId}/messages/{messageId}` — messages
- RTDB `presence/{userId}` — online status
- RTDB `typing/{matchId}/{userId}` — typing indicators
- Storage `chat-images/{matchId}/{fileName}` — chat photo uploads

## Image Upload

Chat photos upload to **Firebase Storage** using `VITE_FIREBASE_STORAGE_BUCKET`.

**Setup (required once):**
1. Firebase Console → **Storage** → **Get started** (creates the default bucket)
2. Copy the bucket name exactly (often `your-project-id.firebasestorage.app`) into `.env`
3. Deploy rules: `firebase deploy --only storage`
4. If uploads still fail with CORS/404, apply CORS to the bucket:
   `gsutil cors set storage.cors.json gs://YOUR_BUCKET_NAME`

Profile photos still use direct URLs.
