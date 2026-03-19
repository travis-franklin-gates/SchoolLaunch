/** WA State regionalization factors by county/area.
 *  Sourced from LEAP Document C3 (District-Wide Regionalization Base).
 *  These are approximate county-level factors; actual factors are per school district.
 */
export const REGIONALIZATION_FACTORS: Record<string, { factor: number; label: string }> = {
  // Puget Sound / Metro
  'king_county': { factor: 1.220, label: 'King County (Seattle, Bellevue, Kent)' },
  'snohomish_county': { factor: 1.180, label: 'Snohomish County (Everett, Edmonds)' },
  'pierce_county': { factor: 1.140, label: 'Pierce County (Tacoma, Puyallup)' },
  'kitsap_county': { factor: 1.180, label: 'Kitsap County (Bremerton, Silverdale)' },
  'thurston_county': { factor: 1.100, label: 'Thurston County (Olympia, Tumwater)' },
  'island_county': { factor: 1.100, label: 'Island County (Oak Harbor)' },

  // Southwest
  'clark_county': { factor: 1.080, label: 'Clark County (Vancouver)' },
  'cowlitz_county': { factor: 1.020, label: 'Cowlitz County (Longview, Kelso)' },

  // Central
  'yakima_county': { factor: 1.000, label: 'Yakima County (Yakima)' },
  'kittitas_county': { factor: 1.020, label: 'Kittitas County (Ellensburg)' },
  'benton_county': { factor: 1.020, label: 'Benton County (Kennewick, Richland)' },
  'franklin_county': { factor: 1.000, label: 'Franklin County (Pasco)' },
  'grant_county': { factor: 1.000, label: 'Grant County (Moses Lake)' },
  'chelan_county': { factor: 1.020, label: 'Chelan County (Wenatchee)' },

  // Eastern
  'spokane_county': { factor: 1.030, label: 'Spokane County (Spokane)' },
  'whitman_county': { factor: 1.000, label: 'Whitman County (Pullman)' },

  // Northwest
  'whatcom_county': { factor: 1.060, label: 'Whatcom County (Bellingham)' },
  'skagit_county': { factor: 1.060, label: 'Skagit County (Mt. Vernon)' },

  // Other (default for any not listed)
  'other': { factor: 1.000, label: 'Other / Not Listed' },
}

/** Get the regionalization factor for a given county key. Returns 1.0 if not found. */
export function getRegionalizationFactor(countyKey: string): number {
  return REGIONALIZATION_FACTORS[countyKey]?.factor ?? 1.0
}

/** Get county key from a region label (for migrating old region values). */
export function migrateRegionToCounty(oldRegion: string): string {
  const lower = oldRegion.toLowerCase()
  if (lower.includes('king')) return 'king_county'
  if (lower.includes('pierce')) return 'pierce_county'
  if (lower.includes('snohomish')) return 'snohomish_county'
  if (lower.includes('spokane')) return 'spokane_county'
  if (lower.includes('clark')) return 'clark_county'
  if (lower.includes('puget')) return 'king_county' // Old "Puget Sound" → default to King County
  if (lower.includes('eastern')) return 'spokane_county' // Old "Eastern WA" → default to Spokane
  if (lower.includes('southwest')) return 'clark_county' // Old "Southwest WA" → Clark
  if (lower.includes('olympic')) return 'kitsap_county' // Old "Olympic Peninsula" → Kitsap
  if (lower.includes('central')) return 'yakima_county' // Old "Central WA" → Yakima
  return 'other'
}
