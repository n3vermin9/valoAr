import { DEFAULT_CITY_ID } from './profileOptions'

const SEED_PASSWORD = 'SeedLogin123!'

const SEED_PHOTOS = [
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQnvhPPC8A8dZ7DhQiqL8_bvErdnIN1XbJkYx2o64onBg&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT2kaC5zyrWmhTzl6TPzIvI5USiu08kBMKCHw&s',
  'https://toc.h-cdn.co/assets/16/09/1600x1600/square-1456787230-gettyimages-168599144-1.jpg',
]

/** Fixed demo accounts for one-tap login on the Login page. */
export const SEED_ACCOUNTS = [
  {
    id: 'durov',
    label: 'Durov',
    detail: '18 · Boy · Girls',
    email: 'durov@arvolio.seed',
    password: SEED_PASSWORD,
    username: 'durov',
    age: 18,
    gender: 'male',
    interestedIn: 'women',
    city: DEFAULT_CITY_ID,
    hobbies: ['coding', 'football', 'travel'],
    bio: 'Building things and looking for real talks.',
    photos: [SEED_PHOTOS[0]],
  },
  {
    id: 'amina',
    label: 'Amina',
    detail: '18 · Girl · Both',
    email: 'amina@arvolio.seed',
    password: SEED_PASSWORD,
    username: 'amina',
    age: 18,
    gender: 'female',
    interestedIn: 'both',
    city: DEFAULT_CITY_ID,
    hobbies: ['music', 'coffee', 'photography'],
    bio: 'Coffee, music, and good company.',
    photos: [SEED_PHOTOS[1]],
  },
  {
    id: 'bale',
    label: 'Bale',
    detail: '18 · Boy · Both',
    email: 'bale@arvolio.seed',
    password: SEED_PASSWORD,
    username: 'bale',
    age: 18,
    gender: 'male',
    interestedIn: 'both',
    city: DEFAULT_CITY_ID,
    hobbies: ['football', 'gym', 'travel'],
    bio: 'Down for matches, gym, and new friends.',
    photos: [SEED_PHOTOS[2]],
  },
]

export function seedProfilePayload(seed) {
  return {
    email: seed.email,
    username: seed.username,
    age: seed.age,
    gender: seed.gender,
    interestedIn: seed.interestedIn,
    city: seed.city,
    hobbies: seed.hobbies,
    bio: seed.bio,
    photos: seed.photos,
  }
}
