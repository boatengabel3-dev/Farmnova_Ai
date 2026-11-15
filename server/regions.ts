export interface GlobalLocationEntry {
  community: string;
  district: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
  agroZone: string;
}

export const GLOBAL_LOCATIONS: GlobalLocationEntry[] = [
  // Ghana & West Africa
  { community: 'Ejura', district: 'Ejura-Sekyedumase', region: 'Ashanti', country: 'Ghana', latitude: 7.3825, longitude: -1.3602, agroZone: 'Tropical Forest-Savanna Transition' },
  { community: 'Tamale', district: 'Tamale Metropolitan', region: 'Northern', country: 'Ghana', latitude: 9.4034, longitude: -0.8424, agroZone: 'Guinea Savanna' },
  { community: 'Techiman', district: 'Techiman Municipal', region: 'Bono East', country: 'Ghana', latitude: 7.5897, longitude: -1.9344, agroZone: 'Tropical Forest-Savanna Transition' },
  { community: 'Kumasi (Kwadaso)', district: 'Kwadaso Municipal', region: 'Ashanti', country: 'Ghana', latitude: 6.6785, longitude: -1.6462, agroZone: 'Tropical Semi-Deciduous Forest' },
  { community: 'Bolgatanga', district: 'Bolgatanga Municipal', region: 'Upper East', country: 'Ghana', latitude: 10.7856, longitude: -0.8514, agroZone: 'Sudan Savanna' },
  { community: 'Wa', district: 'Wa Municipal', region: 'Upper West', country: 'Ghana', latitude: 10.0601, longitude: -2.5099, agroZone: 'Guinea Savanna' },
  { community: 'Ho', district: 'Ho Municipal', region: 'Volta', country: 'Ghana', latitude: 6.6101, longitude: 0.4713, agroZone: 'Tropical Forest-Savanna Transition' },
  { community: 'Kintampo', district: 'Kintampo North', region: 'Bono East', country: 'Ghana', latitude: 8.0563, longitude: -1.7306, agroZone: 'Tropical Forest-Savanna Transition' },
  { community: 'Kano (Kadawa)', district: 'Kura', region: 'Kano State', country: 'Nigeria', latitude: 11.6460, longitude: 8.4310, agroZone: 'Sudan Savanna Dryland' },
  { community: 'Ibadan', district: 'Akinyele', region: 'Oyo State', country: 'Nigeria', latitude: 7.5020, longitude: 3.9110, agroZone: 'Tropical Humid Forest Belt' },
  { community: 'Sikasso', district: 'Sikasso Cercle', region: 'Sikasso', country: 'Mali', latitude: 11.3176, longitude: -5.6665, agroZone: 'Sudan Savanna' },
  { community: 'Bouake', district: 'Gbeke', region: 'Vallee du Bandama', country: 'Cote d\'Ivoire', latitude: 7.6906, longitude: -5.0303, agroZone: 'Tropical Forest-Savanna Transition' },

  // East & Southern Africa
  { community: 'Nakuru', district: 'Nakuru County', region: 'Rift Valley', country: 'Kenya', latitude: -0.3031, longitude: 36.0800, agroZone: 'Tropical Highland Sub-Humid' },
  { community: 'Eldoret', district: 'Uasin Gishu', region: 'Rift Valley', country: 'Kenya', latitude: 0.5143, longitude: 35.2698, agroZone: 'Tropical Highland Sub-Humid' },
  { community: 'Bahir Dar', district: 'West Gojjam', region: 'Amhara', country: 'Ethiopia', latitude: 11.5742, longitude: 37.3614, agroZone: 'Tropical Highland' },
  { community: 'Morogoro', district: 'Morogoro Rural', region: 'Morogoro', country: 'Tanzania', latitude: -6.8278, longitude: 37.6591, agroZone: 'Sub-Humid Tropical Savanna' },
  { community: 'Lira', district: 'Lira District', region: 'Northern', country: 'Uganda', latitude: 2.2499, longitude: 32.8998, agroZone: 'Equatorial Sub-Humid' },
  { community: 'Lilongwe', district: 'Lilongwe District', region: 'Central Region', country: 'Malawi', latitude: -13.9626, longitude: 33.7741, agroZone: 'Subtropical Savanna Plateau' },
  { community: 'Polokwane', district: 'Capricorn', region: 'Limpopo', country: 'South Africa', latitude: -23.9045, longitude: 29.4689, agroZone: 'Subtropical Semi-Arid' },

  // Global Agricultural Regions
  { community: 'Pune (Baramati)', district: 'Pune District', region: 'Maharashtra', country: 'India', latitude: 18.1506, longitude: 74.5772, agroZone: 'Tropical Semi-Arid Monsoon' },
  { community: 'Ludhiana', district: 'Ludhiana District', region: 'Punjab', country: 'India', latitude: 30.9010, longitude: 75.8573, agroZone: 'Subtropical Alluvial Plain' },
  { community: 'Mekong Delta (Can Tho)', district: 'Can Tho', region: 'Mekong Delta', country: 'Vietnam', latitude: 10.0452, longitude: 105.7469, agroZone: 'Tropical Humid Delta' },
  { community: 'Sorriso', district: 'Mato Grosso', region: 'Center-West', country: 'Brazil', latitude: -12.5425, longitude: -55.7211, agroZone: 'Tropical Cerrado Savanna' },
  { community: 'Ames (Story County)', district: 'Iowa', region: 'Midwest', country: 'United States', latitude: 42.0308, longitude: -93.6319, agroZone: 'Temperate Continental Cropland' },
  { community: 'Fresno (San Joaquin)', district: 'Fresno County', region: 'California', country: 'United States', latitude: 36.7378, longitude: -119.7871, agroZone: 'Mediterranean Semi-Arid' },
  { community: 'Toowoomba', district: 'Darling Downs', region: 'Queensland', country: 'Australia', latitude: -27.5598, longitude: 151.9507, agroZone: 'Subtropical Cropping Belt' },
];

export function inferAgroZone(latitude: number, longitude = 0): string {
  const absLat = Math.abs(latitude);
  // Regional Ghana refinement preserved where applicable
  if (latitude >= 4.5 && latitude <= 11.5 && longitude >= -3.5 && longitude <= 1.5) {
    if (latitude >= 10.2) return 'Sudan Savanna (West Africa)';
    if (latitude >= 8.2) return 'Guinea Savanna (West Africa)';
    if (latitude >= 7.0) return 'Forest-Savanna Transition (West Africa)';
    if (latitude >= 5.6) return 'Tropical Semi-Deciduous Forest';
    return 'Coastal Savanna';
  }
  if (absLat < 7) return 'Equatorial / Tropical Humid Belt';
  if (absLat < 16) return 'Tropical Savanna / Monsoon Belt';
  if (absLat < 24) return 'Tropical Semi-Arid / Subtropical Belt';
  if (absLat < 35) return 'Subtropical / Mediterranean Belt';
  if (absLat < 55) return 'Temperate Agricultural Belt';
  return 'Boreal / Cool High-Latitude Belt';
}

export function findNearestLocation(lat: number, lon: number): GlobalLocationEntry | null {
  let best: GlobalLocationEntry | null = null;
  let bestDist = Infinity;
  for (const loc of GLOBAL_LOCATIONS) {
    const d = Math.hypot(loc.latitude - lat, loc.longitude - lon);
    if (d < bestDist) {
      bestDist = d;
      best = loc;
    }
  }
  return bestDist < 1.5 ? best : null;
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return Number((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1));
}
