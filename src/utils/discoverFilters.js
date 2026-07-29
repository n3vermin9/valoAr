import { normalizeCity, normalizeHobbies } from './profileOptions'

const DISCOVER_FILTERS_KEY = 'arvoli-discover-filters-v1'

export function normalizeDiscoverFilters(filters = {}) {
  return {
    city: filters.city ? normalizeCity(filters.city) : '',
    hobbies: normalizeHobbies(filters.hobbies || []),
  }
}

export function loadDiscoverFilters() {
  try {
    return normalizeDiscoverFilters(JSON.parse(localStorage.getItem(DISCOVER_FILTERS_KEY) || '{}'))
  } catch {
    return normalizeDiscoverFilters()
  }
}

export function saveDiscoverFilters(filters) {
  try {
    localStorage.setItem(DISCOVER_FILTERS_KEY, JSON.stringify(normalizeDiscoverFilters(filters)))
  } catch {
    // ignore
  }
}

export function hasActiveDiscoverFilters(filters = {}) {
  return Boolean(filters.city || filters.hobbies?.length)
}
