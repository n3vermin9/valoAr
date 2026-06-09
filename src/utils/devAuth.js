import { APP_SLUG } from './helpers'

export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function generateRandomCredentials() {
  const rand = randomInt(100000, 999999)
  return {
    email: `${APP_SLUG}_${Date.now()}_${rand}@mailinator.com`,
    password: `Dev${rand}!`,
  }
}
