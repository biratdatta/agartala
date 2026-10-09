/** Distances for the hometown story. */
export const AGARTALA = { lat: 23.8315, lon: 91.2868 };

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371, r = Math.PI / 180; const dLat = (lat2 - lat1) * r, dLon = (lon2 - lon1) * r;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Cities people commonly come home to Agartala from, for picking a hometown by hand. */
export const CITIES: [string, number, number][] = [
  ['Bengaluru', 12.97, 77.59], ['Kolkata', 22.57, 88.36], ['Delhi', 28.61, 77.21], ['Mumbai', 19.08, 72.88], ['Chennai', 13.08, 80.27],
  ['Hyderabad', 17.39, 78.49], ['Pune', 18.52, 73.86], ['Guwahati', 26.14, 91.74], ['Shillong', 25.58, 91.89], ['Dhaka', 23.81, 90.41],
  ['Noida', 28.54, 77.39], ['Gurugram', 28.46, 77.03], ['Ahmedabad', 23.02, 72.57], ['Kochi', 9.93, 76.27], ['Bhubaneswar', 20.3, 85.82],
  ['Silchar', 24.83, 92.78], ['Imphal', 24.82, 93.94], ['Udaipur (Tripura)', 23.53, 91.48], ['Dharmanagar', 24.37, 92.17], ['Dubai', 25.2, 55.27],
  ['Singapore', 1.35, 103.82], ['London', 51.51, -0.13], ['New York', 40.71, -74.01], ['Toronto', 43.65, -79.38], ['Sydney', -33.87, 151.21],
];
export function kmFromCity(name: string): number {
  const c = CITIES.find(([n]) => n.toLowerCase() === name.trim().toLowerCase());
  return c ? Math.round(haversineKm(c[1], c[2], AGARTALA.lat, AGARTALA.lon)) : 0;
}
