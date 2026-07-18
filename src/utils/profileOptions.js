/** Available cities for profiles. Expand as the app grows. */
export const CITIES = [
  { id: 'grozny', label: 'Grozny' },
]

export const DEFAULT_CITY_ID = 'grozny'

export const MAX_HOBBIES = 4

/**
 * Curated hobby tags users can pick on their profile.
 * Ids are stable slug keys; labels are what we show in the UI.
 */
export const HOBBIES = [
  { id: 'football', label: 'Football' },
  { id: 'basketball', label: 'Basketball' },
  { id: 'volleyball', label: 'Volleyball' },
  { id: 'tennis', label: 'Tennis' },
  { id: 'table-tennis', label: 'Table tennis' },
  { id: 'badminton', label: 'Badminton' },
  { id: 'running', label: 'Running' },
  { id: 'jogging', label: 'Jogging' },
  { id: 'hiking', label: 'Hiking' },
  { id: 'cycling', label: 'Cycling' },
  { id: 'swimming', label: 'Swimming' },
  { id: 'gym', label: 'Gym' },
  { id: 'weightlifting', label: 'Weightlifting' },
  { id: 'crossfit', label: 'CrossFit' },
  { id: 'yoga', label: 'Yoga' },
  { id: 'pilates', label: 'Pilates' },
  { id: 'martial-arts', label: 'Martial arts' },
  { id: 'boxing', label: 'Boxing' },
  { id: 'wrestling', label: 'Wrestling' },
  { id: 'mma', label: 'MMA' },
  { id: 'skateboarding', label: 'Skateboarding' },
  { id: 'snowboarding', label: 'Snowboarding' },
  { id: 'skiing', label: 'Skiing' },
  { id: 'climbing', label: 'Climbing' },
  { id: 'parkour', label: 'Parkour' },
  { id: 'dance', label: 'Dance' },
  { id: 'ballet', label: 'Ballet' },
  { id: 'hip-hop-dance', label: 'Hip-hop dance' },
  { id: 'photography', label: 'Photography' },
  { id: 'videography', label: 'Videography' },
  { id: 'drawing', label: 'Drawing' },
  { id: 'painting', label: 'Painting' },
  { id: 'digital-art', label: 'Digital art' },
  { id: 'calligraphy', label: 'Calligraphy' },
  { id: 'graphic-design', label: 'Graphic design' },
  { id: 'fashion', label: 'Fashion' },
  { id: 'sewing', label: 'Sewing' },
  { id: 'knitting', label: 'Knitting' },
  { id: 'diy', label: 'DIY' },
  { id: 'woodworking', label: 'Woodworking' },
  { id: 'cooking', label: 'Cooking' },
  { id: 'baking', label: 'Baking' },
  { id: 'coffee', label: 'Coffee' },
  { id: 'tea', label: 'Tea' },
  { id: 'foodie', label: 'Foodie' },
  { id: 'restaurants', label: 'Restaurants' },
  { id: 'travel', label: 'Travel' },
  { id: 'road-trips', label: 'Road trips' },
  { id: 'camping', label: 'Camping' },
  { id: 'nature', label: 'Nature' },
  { id: 'birds', label: 'Birdwatching' },
  { id: 'gardening', label: 'Gardening' },
  { id: 'plants', label: 'Houseplants' },
  { id: 'animals', label: 'Animals' },
  { id: 'dogs', label: 'Dogs' },
  { id: 'cats', label: 'Cats' },
  { id: 'music', label: 'Music' },
  { id: 'singing', label: 'Singing' },
  { id: 'guitar', label: 'Guitar' },
  { id: 'piano', label: 'Piano' },
  { id: 'drums', label: 'Drums' },
  { id: 'producing', label: 'Music producing' },
  { id: 'concerts', label: 'Concerts' },
  { id: 'festivals', label: 'Festivals' },
  { id: 'djing', label: 'DJing' },
  { id: 'movies', label: 'Movies' },
  { id: 'series', label: 'TV series' },
  { id: 'anime', label: 'Anime' },
  { id: 'manga', label: 'Manga' },
  { id: 'comics', label: 'Comics' },
  { id: 'reading', label: 'Reading' },
  { id: 'poetry', label: 'Poetry' },
  { id: 'writing', label: 'Writing' },
  { id: 'blogging', label: 'Blogging' },
  { id: 'languages', label: 'Languages' },
  { id: 'history', label: 'History' },
  { id: 'science', label: 'Science' },
  { id: 'space', label: 'Space' },
  { id: 'tech', label: 'Tech' },
  { id: 'coding', label: 'Coding' },
  { id: 'ai', label: 'AI' },
  { id: 'startups', label: 'Startups' },
  { id: 'entrepreneurship', label: 'Entrepreneurship' },
  { id: 'investing', label: 'Investing' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'cars', label: 'Cars' },
  { id: 'motorbikes', label: 'Motorbikes' },
  { id: 'gaming', label: 'Gaming' },
  { id: 'pc-gaming', label: 'PC gaming' },
  { id: 'console-gaming', label: 'Console gaming' },
  { id: 'mobile-gaming', label: 'Mobile gaming' },
  { id: 'esports', label: 'Esports' },
  { id: 'board-games', label: 'Board games' },
  { id: 'chess', label: 'Chess' },
  { id: 'puzzles', label: 'Puzzles' },
  { id: 'trivia', label: 'Trivia' },
  { id: 'stand-up', label: 'Stand-up' },
  { id: 'theater', label: 'Theater' },
  { id: 'museums', label: 'Museums' },
  { id: 'art-galleries', label: 'Art galleries' },
  { id: 'photography-walks', label: 'Photo walks' },
  { id: 'street-photography', label: 'Street photography' },
  { id: 'vlogging', label: 'Vlogging' },
  { id: 'content-creation', label: 'Content creation' },
  { id: 'social-media', label: 'Social media' },
  { id: 'volunteering', label: 'Volunteering' },
  { id: 'charity', label: 'Charity' },
  { id: 'religion', label: 'Religion' },
  { id: 'meditation', label: 'Meditation' },
  { id: 'self-improvement', label: 'Self-improvement' },
  { id: 'psychology', label: 'Psychology' },
  { id: 'philosophy', label: 'Philosophy' },
  { id: 'politics', label: 'Politics' },
  { id: 'news', label: 'News' },
  { id: 'podcasts', label: 'Podcasts' },
  { id: 'audiobooks', label: 'Audiobooks' },
  { id: 'fashion-design', label: 'Fashion design' },
  { id: 'makeup', label: 'Makeup' },
  { id: 'skincare', label: 'Skincare' },
  { id: 'hairstyling', label: 'Hairstyling' },
  { id: 'shopping', label: 'Shopping' },
  { id: 'thrifting', label: 'Thrifting' },
  { id: 'collecting', label: 'Collecting' },
  { id: 'vinyl', label: 'Vinyl' },
  { id: 'sneakers', label: 'Sneakers' },
  { id: 'watches', label: 'Watches' },
  { id: 'fishing', label: 'Fishing' },
  { id: 'hunting', label: 'Hunting' },
  { id: 'archery', label: 'Archery' },
  { id: 'horse-riding', label: 'Horse riding' },
  { id: 'surfing', label: 'Surfing' },
  { id: 'diving', label: 'Diving' },
  { id: 'kayaking', label: 'Kayaking' },
  { id: 'sailing', label: 'Sailing' },
  { id: 'fitness', label: 'Fitness' },
  { id: 'calisthenics', label: 'Calisthenics' },
  { id: 'stretching', label: 'Stretching' },
  { id: 'walking', label: 'Walking' },
  { id: 'city-exploring', label: 'City exploring' },
  { id: 'cafes', label: 'Cafés' },
  { id: 'nightlife', label: 'Nightlife' },
  { id: 'karaoke', label: 'Karaoke' },
  { id: 'parties', label: 'Parties' },
  { id: 'hanging-out', label: 'Hanging out' },
  { id: 'deep-talks', label: 'Deep talks' },
  { id: 'networking', label: 'Networking' },
  { id: 'mentoring', label: 'Mentoring' },
  { id: 'teaching', label: 'Teaching' },
  { id: 'studying', label: 'Studying' },
  { id: 'university', label: 'University' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'interior-design', label: 'Interior design' },
  { id: 'astrology', label: 'Astrology' },
  { id: 'tarot', label: 'Tarot' },
  { id: 'spirituality', label: 'Spirituality' },
  { id: 'minimalism', label: 'Minimalism' },
  { id: 'sustainability', label: 'Sustainability' },
  { id: 'zero-waste', label: 'Zero waste' },
  { id: 'formula-1', label: 'Formula 1' },
  { id: 'ufc', label: 'UFC' },
  { id: 'nba', label: 'NBA' },
  { id: 'football-watching', label: 'Watching football' },
  { id: 'memes', label: 'Memes' },
  { id: 'comedy', label: 'Comedy' },
  { id: 'magic', label: 'Magic tricks' },
  { id: 'cosplay', label: 'Cosplay' },
  { id: 'roleplay', label: 'Tabletop RPG' },
  { id: 'lego', label: 'LEGO' },
  { id: 'model-building', label: 'Model building' },
  { id: '3d-printing', label: '3D printing' },
  { id: 'electronics', label: 'Electronics' },
  { id: 'robotics', label: 'Robotics' },
  { id: 'astronomy', label: 'Astronomy' },
  { id: 'stargazing', label: 'Stargazing' },
]

const CITY_BY_ID = Object.fromEntries(CITIES.map((c) => [c.id, c]))
const HOBBY_BY_ID = Object.fromEntries(HOBBIES.map((h) => [h.id, h]))

export function getCityLabel(cityId) {
  if (!cityId) return null
  return CITY_BY_ID[cityId]?.label || null
}

export function getHobbyLabel(hobbyId) {
  if (!hobbyId) return null
  return HOBBY_BY_ID[hobbyId]?.label || null
}

export function isValidCityId(cityId) {
  return Boolean(CITY_BY_ID[cityId])
}

/** Keep only known hobby ids, unique, capped. */
export function normalizeHobbies(hobbies = []) {
  if (!Array.isArray(hobbies)) return []
  const seen = new Set()
  const next = []
  for (const id of hobbies) {
    if (!HOBBY_BY_ID[id] || seen.has(id)) continue
    seen.add(id)
    next.push(id)
    if (next.length >= MAX_HOBBIES) break
  }
  return next
}

export function normalizeCity(cityId) {
  if (isValidCityId(cityId)) return cityId
  return DEFAULT_CITY_ID
}

export function hobbiesEqual(a = [], b = []) {
  const left = normalizeHobbies(a)
  const right = normalizeHobbies(b)
  if (left.length !== right.length) return false
  return left.every((id, i) => id === right[i])
}
