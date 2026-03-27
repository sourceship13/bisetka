/**
 * Map of US state abbreviations to full names
 */
const US_STATE_MAP: Record<string, string> = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
  DC: 'District of Columbia',
};

/**
 * Normalize state/province name
 * - Converts US abbreviations to full names
 * - Trims whitespace
 * - Returns consistent format
 */
export const normalizeStateName = (state: string | undefined, country: string): string => {
  if (!state) return '';
  
  const trimmed = state.trim();
  
  // For US, check if it's an abbreviation and convert to full name
  if (country === 'US') {
    const upperState = trimmed.toUpperCase();
    if (US_STATE_MAP[upperState]) {
      return US_STATE_MAP[upperState];
    }
  }
  
  // Return as-is for other countries or already full names
  return trimmed;
};

/**
 * Get unique normalized states from location list
 */
export const getUniqueNormalizedStates = (
  locations: Array<{ state?: string; country: string }>
): string[] => {
  const stateSet = new Set<string>();
  
  locations.forEach(loc => {
    if (loc.state) {
      const normalized = normalizeStateName(loc.state, loc.country);
      if (normalized) {
        stateSet.add(normalized);
      }
    }
  });
  
  return Array.from(stateSet).sort();
};
