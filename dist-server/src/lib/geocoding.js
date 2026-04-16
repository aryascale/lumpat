export async function geocodeLocation(location) {
    if (!location || location.trim().length === 0)
        return null;
    const params = new URLSearchParams({
        q: `${location.trim()}, Indonesia`,
        format: 'json',
        limit: '1',
        addressdetails: '1',
    });
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
            headers: {
                'User-Agent': 'BCR-Race-App',
                'Accept': 'application/json',
            },
        });
        if (!response.ok)
            return null;
        const data = await response.json();
        if (!data || data.length === 0)
            return null;
        const result = data[0];
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);
        if (isNaN(lat) || isNaN(lon))
            return null;
        return {
            latitude: lat,
            longitude: lon,
            displayName: result.display_name,
        };
    }
    catch {
        return null;
    }
}
export async function batchGeocodeEvents(events) {
    const results = new Map();
    const uniqueLocations = new Set();
    for (const event of events) {
        if (event.location && event.location.trim().length > 0) {
            uniqueLocations.add(event.location.trim());
        }
    }
    for (const location of uniqueLocations) {
        const coords = await geocodeLocation(location);
        results.set(location, coords);
        if (uniqueLocations.size > 1) {
            await new Promise(resolve => setTimeout(resolve, 1100));
        }
    }
    return results;
}
