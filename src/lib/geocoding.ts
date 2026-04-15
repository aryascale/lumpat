// Geocoding utility using Nominatim API (OpenStreetMap)
// Free service with rate limiting: 1 request per second

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  displayName: string;
}

/**
 * Geocode a location string to coordinates using Nominatim API
 * @param location - Location name (e.g., "Jakarta", "Bali, Indonesia")
 * @returns Coordinates or null if geocoding fails
 */
export async function geocodeLocation(location: string): Promise<GeocodeResult | null> {
  if (!location || location.trim().length === 0) {
    return null;
  }

  const baseUrl = 'https://nominatim.openstreetmap.org/search';
  const params = new URLSearchParams({
    q: `${location.trim()}, Indonesia`, // Bias towards Indonesia
    format: 'json',
    limit: '1',
    addressdetails: '1',
  });

  try {
    const response = await fetch(`${baseUrl}?${params}`, {
      headers: {
        'User-Agent': 'BCR-Race-App', // Required by Nominatim policy
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Geocoding failed:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      console.warn('No results found for location:', location);
      return null;
    }

    const result = data[0];

    // Validate coordinates are within valid ranges
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);

    if (isNaN(lat) || isNaN(lon)) {
      console.error('Invalid coordinates returned:', result.lat, result.lon);
      return null;
    }

    // Basic sanity check for Indonesia bounds (approximate)
    // Indonesia: lat -10 to 5, lon 95 to 141
    if (lat < -10 || lat > 5 || lon < 95 || lon > 141) {
      console.warn('Coordinates outside Indonesia bounds:', lat, lon);
      // Don't return null - let the caller decide
    }

    return {
      latitude: lat,
      longitude: lon,
      displayName: result.display_name,
    };
  } catch (error) {
    console.error('Geocoding error for location:', location, error);
    return null;
  }
}

/**
 * Batch geocode multiple events with rate limiting
 * IMPORTANT: Nominatim requires 1 second between requests
 * @param events - Array of events with location field
 * @returns Map of location string to coordinates
 */
export async function batchGeocodeEvents(
  events: Array<{ id: string; location?: string | null }>
): Promise<Map<string, GeocodeResult | null>> {
  const results = new Map<string, GeocodeResult | null>();
  const uniqueLocations = new Set<string>();

  // Collect unique locations
  for (const event of events) {
    if (event.location && event.location.trim().length > 0) {
      uniqueLocations.add(event.location.trim());
    }
  }

  // Geocode each unique location with rate limiting
  for (const location of uniqueLocations) {
    const coords = await geocodeLocation(location);
    results.set(location, coords);

    // Rate limiting: wait 1.1 seconds between requests
    // Nominatim allows 1 request per second
    if (uniqueLocations.size > 1) {
      await new Promise(resolve => setTimeout(resolve, 1100));
    }
  }

  return results;
}
