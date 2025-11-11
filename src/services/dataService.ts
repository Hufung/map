import L from 'leaflet';
import JSZip from 'jszip';
import type { 
    Carpark, 
    AttractionFeature, 
    ViewingPointFeature, 
    EVChargerFeature,
    ParkingMeterFeature, 
    TurnRestrictionFeature,
    TrafficFeature,
    PermitFeature,
    ProhibitionFeature,
    RoadNetworkFeature,
    TrafficSpeedInfo,
    Language,
    OilStation,
    ToiletFeature,
    OilPriceData
} from '../types';
import { 
    API_INFO_BASE_URL, 
    API_VACANCY_BASE_URL, 
    API_ATTRACTIONS_URL, 
    API_VIEWING_POINTS_URL, 
    API_EV_CHARGERS_URL,
    API_PARKING_METERS_BASE_URL,
    API_PARKING_METERS_STATUS_URL,
    API_TURN_RESTRICTIONS_URL,
    API_TRAFFIC_FEATURES_BASE_URL,
    API_PERMIT_URL,
    API_PROHIBITION_PC_URL,
    API_PROHIBITION_ALL_URL,
    API_ROAD_NETWORK_URL,
    API_TRAFFIC_SPEED_URL,
    API_OIL_STATIONS_URL,
    API_OIL_PRICES_URL,
    API_TOILETS_FEHD_URL,
    API_TOILETS_AFCD_URL,
    i18n
} from '../constants';

// --- Car Parks ---
export async function fetchCarparkData(lang: Language): Promise<Carpark[]> {
    const langParam = `&lang=${lang}`;
    const infoUrl = API_INFO_BASE_URL + langParam;
    const infoResponse = await fetch(infoUrl);
    if (!infoResponse.ok) throw new Error('Failed to fetch car park info.');
    const infoData = await infoResponse.json();
    const infoList = infoData.results || [];

    if (infoList.length === 0) return [];

    const parkIds = infoList.map((park: Carpark) => park.park_Id).join(',');
    const vacancyUrl = `${API_VACANCY_BASE_URL}&carparkIds=${parkIds}${langParam}`;
    const vacancyResponse = await fetch(vacancyUrl);
    let vacancyList = [];
    if (vacancyResponse.ok) {
        const vacancyData = await vacancyResponse.json();
        vacancyList = vacancyData.results || [];
    } else {
        console.error('Failed to fetch car park vacancy data.');
    }

    const vacancyMap = new Map();
    for (const vacancy of vacancyList) {
        vacancyMap.set(vacancy.park_Id, vacancy);
    }
    return infoList.map((info: Carpark) => ({
        ...info,
        vacancyData: vacancyMap.get(info.park_Id) || null
    }));
}

// --- Attractions ---
export async function fetchAttractionsData(): Promise<AttractionFeature[]> {
    const response = await fetch(API_ATTRACTIONS_URL);
    if (!response.ok) throw new Error('Failed to fetch attractions data.');
    const data = await response.json();
    return data.features || [];
}

// --- Viewing Points ---
export async function fetchViewingPointsData(): Promise<ViewingPointFeature[]> {
    const response = await fetch(API_VIEWING_POINTS_URL);
    if (!response.ok) throw new Error('Failed to fetch viewing points data.');
    const data = await response.json();
    return data.features || [];
}

// --- EV Chargers ---
export async function fetchEVChargerData(): Promise<EVChargerFeature[]> {
    const response = await fetch(API_EV_CHARGERS_URL);
    if (!response.ok) throw new Error('Failed to fetch EV charger data.');
    const data = await response.json();
    return data.features || [];
}

// --- Parking Meters ---
let parkingMeterStatusCache: Map<string, string> | null = null;

function parseCSVToMap(csvText: string): Map<string, string> {
    const statusMap = new Map<string, string>();
    const rows = csvText.split('\n');
    for (let i = 1; i < rows.length; i++) {
        const columns = rows[i].split(',');
        if (columns.length >= 3) {
            const parkingSpaceId = columns[0];
            const occupancyStatus = columns[2];
            if (parkingSpaceId && parkingSpaceId.trim() !== "") {
                statusMap.set(parkingSpaceId.trim(), occupancyStatus.trim());
            }
        }
    }
    return statusMap;
}

export async function fetchInitialParkingMeterStatus(): Promise<Map<string, string>> {
    if (parkingMeterStatusCache) return parkingMeterStatusCache;
    try {
        const response = await fetch(API_PARKING_METERS_STATUS_URL);
        if (!response.ok) throw new Error('Failed to fetch parking meter status data.');
        const statusText = await response.text();
        parkingMeterStatusCache = parseCSVToMap(statusText);
        return parkingMeterStatusCache;
    } catch (error) {
        console.error("Error fetching parking meter status:", error);
        return new Map();
    }
}

export function getCachedParkingMeterStatus(): Map<string, string> {
    return parkingMeterStatusCache || new Map();
}

export async function fetchParkingMetersInBounds(bounds: L.LatLngBounds): Promise<ParkingMeterFeature[]> {
    const lowerCorner = `${bounds.getSouth()} ${bounds.getWest()}`;
    const upperCorner = `${bounds.getNorth()} ${bounds.getEast()}`;
    const filter = `<Filter><Intersects><PropertyName>SHAPE</PropertyName><gml:Envelope srsName='EPSG:4326'><gml:lowerCorner>${lowerCorner}</gml:lowerCorner><gml:upperCorner>${upperCorner}</gml:upperCorner></gml:Envelope></Intersects></Filter>`;
    const maxFeatures = 500;
    const locationUrl = `${API_PARKING_METERS_BASE_URL}&maxFeatures=${maxFeatures}&filter=${encodeURIComponent(filter)}`;

    const response = await fetch(locationUrl);
    if (!response.ok) throw new Error('Failed to fetch parking meter location data.');
    const data = await response.json();
    return data.features || [];
}

// --- Oil Stations ---

// Helper to parse a single CSV line, handling quoted fields.
const parseCsvLine = (line: string): string[] => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            // If we see a quote, check if it's an escaped quote ("")
            if (inQuotes && i < line.length - 1 && line[i + 1] === '"') {
                current += '"';
                i++; // Skip the second quote
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current.trim());
    return values;
};

function parseOilStationCSV(csvText: string, language: Language): OilStation[] {
    // Remove BOM if present at the start of the file
    let cleanCsvText = csvText.startsWith('\uFEFF') ? csvText.substring(1) : csvText;
    
    const lines = cleanCsvText.trim().split('\n');
    const stations: OilStation[] = [];
    const headerLine = lines.shift();
    if (!headerLine) return [];

    // Columns are in a fixed order as per the sample:
    // Station_EN,Station_TC,Station_SC,Brand_EN,Brand_TC,Brand_SC,All_Oil_Types_EN,All_Oil_Types_TC,All_Oil_Types_SC,Latitude,Longitude
    const langMap = {
        'en_US': { name: 0, brand: 3, types: 6 },
        'zh_TW': { name: 1, brand: 4, types: 7 },
        'zh_CN': { name: 2, brand: 5, types: 8 },
    };
    const latIndex = 9;
    const lonIndex = 10;

    const currentLangIndices = langMap[language];
    const fallbackLangIndices = langMap['en_US'];

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        const values = parseCsvLine(trimmedLine);
        
        if (values.length < 11) {
            console.warn("Skipping malformed oil station line, not enough columns:", trimmedLine);
            continue;
        }

        try {
            const name = values[currentLangIndices.name] || values[fallbackLangIndices.name] || '';
            const company = values[currentLangIndices.brand] || values[fallbackLangIndices.brand] || '';
            const oilTypesString = values[currentLangIndices.types] || values[fallbackLangIndices.types] || '';
            const latitude = parseFloat(values[latIndex]);
            const longitude = parseFloat(values[lonIndex]);

            if (isNaN(latitude) || isNaN(longitude)) {
                 console.warn("Could not parse oil station line, invalid coordinates:", trimmedLine);
                continue;
            }

            // Split by " / " as seen in the sample data. If not found, assume it's a single type.
            const fuels = oilTypesString ? oilTypesString.split(' / ').map(f => f.trim().replace(/Auto LPG/g, 'LPG')).filter(f => f) : [];

            const station: OilStation = {
                name,
                address: name, // No separate address in this CSV format
                company,
                latitude,
                longitude,
                fuels,
            };

            stations.push(station);
        } catch (e) {
            console.error("Error processing oil station line:", trimmedLine, e);
        }
    }

    return stations;
}

export async function fetchOilStationsData(language: Language): Promise<OilStation[]> {
    try {
        const response = await fetch(API_OIL_STATIONS_URL);
        if (!response.ok) throw new Error('Failed to fetch oil station data.');
        const csvText = await response.text();
        return parseOilStationCSV(csvText, language);
    } catch (error) {
        console.error("Error fetching oil station data:", error);
        return [];
    }
}

export async function fetchOilPriceData(): Promise<OilPriceData> {
    const priceMap: OilPriceData = new Map();
    try {
        const response = await fetch(API_OIL_PRICES_URL);
        if (!response.ok) {
            throw new Error('Failed to fetch oil price data.');
        }
        const data = await response.json();
        
        if (Array.isArray(data)) {
            data.forEach(fuelData => {
                const fuelTypeEn = fuelData.type?.en;
                if (fuelTypeEn && Array.isArray(fuelData.prices)) {
                    fuelData.prices.forEach((vendorPrice: any) => {
                        const vendorEn = vendorPrice.vendor?.en;
                        const priceStr = vendorPrice.price;
                        
                        if (vendorEn && typeof priceStr === 'string') {
                            const price = parseFloat(priceStr);
                            if (!isNaN(price)) {
                                if (!priceMap.has(vendorEn)) {
                                    priceMap.set(vendorEn, new Map());
                                }
                                priceMap.get(vendorEn)!.set(fuelTypeEn, price);
                            }
                        }
                    });
                }
            });
        }
    } catch (error) {
        console.error("Error fetching oil price data:", error);
    }
    return priceMap;
}


// --- Turn Restrictions ---
function parseKMLToGeoJSON(kmlText: string): { type: 'FeatureCollection'; features: TurnRestrictionFeature[] } {
    const parser = new DOMParser();
    const kmlDoc = parser.parseFromString(kmlText, 'text/xml');
    const placemarks = kmlDoc.querySelectorAll('Placemark');
    const features: TurnRestrictionFeature[] = [];

    placemarks.forEach(placemark => {
        const name = placemark.querySelector('name')?.textContent || '';
        const description = placemark.querySelector('description')?.textContent || '';
        const coordinates = placemark.querySelector('coordinates')?.textContent;

        if (coordinates) {
            const coords = coordinates.trim().split(',').map(c => parseFloat(c));
            if (coords.length >= 2) {
                features.push({
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [coords[0], coords[1]] // lon, lat
                    },
                    properties: { name, description }
                });
            }
        }
    });

    return { type: 'FeatureCollection', features };
}

export async function fetchTurnRestrictionsData(): Promise<TurnRestrictionFeature[]> {
    try {
        const response = await fetch(API_TURN_RESTRICTIONS_URL);
        if (!response.ok) throw new Error('Failed to fetch turn restrictions KMZ data.');

        const kmzBlob = await response.blob();
        const zip = await JSZip.loadAsync(kmzBlob);
        
        const kmlFile = Object.keys(zip.files).find(fileName => fileName.endsWith('.kml'));
        if (!kmlFile) throw new Error('No KML file found in KMZ.');

        const kmlText = await zip.files[kmlFile].async('text');
        const geojsonData = parseKMLToGeoJSON(kmlText);
        return geojsonData.features || [];
    } catch (error) {
        console.error("Error fetching turn restrictions:", error);
        return [];
    }
}

// --- Traffic Features ---
export async function fetchTrafficFeaturesInBounds(bounds: L.LatLngBounds): Promise<TrafficFeature[]> {
    const lowerCorner = `${bounds.getSouth()} ${bounds.getWest()}`;
    const upperCorner = `${bounds.getNorth()} ${bounds.getEast()}`;
    const filter = `<Filter><BBOX><PropertyName>SHAPE</PropertyName><gml:Envelope srsName='EPSG:4326'><gml:lowerCorner>${lowerCorner}</gml:lowerCorner><gml:upperCorner>${upperCorner}</gml:upperCorner></gml:Envelope></BBOX></Filter>`;
    
    const url = `${API_TRAFFIC_FEATURES_BASE_URL}&filter=${encodeURIComponent(filter)}`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch traffic features.');
        const data = await response.json();
        return data.features || [];
    } catch (error) {
        console.error("Error fetching traffic features:", error);
        return [];
    }
}

// --- Permits ---
export async function fetchPermitData(): Promise<PermitFeature[]> {
    const response = await fetch(API_PERMIT_URL);
    if (!response.ok) throw new Error('Failed to fetch permit data.');
    const data = await response.json();
    return data.features || [];
}

// --- Prohibitions ---
export async function fetchProhibitionData(): Promise<ProhibitionFeature[]> {
    try {
        const [pcResponse, allResponse] = await Promise.all([
            fetch(API_PROHIBITION_PC_URL),
            fetch(API_PROHIBITION_ALL_URL)
        ]);
        if (!pcResponse.ok || !allResponse.ok) throw new Error('Failed to fetch prohibition data.');
        
        const pcData = await pcResponse.json();
        const allData = await allResponse.json();

        const pcFeatures = pcData.features || [];
        const allFeatures = allData.features || [];

        return [...pcFeatures, ...allFeatures];
    } catch (error) {
        console.error("Error fetching prohibition data:", error);
        return [];
    }
}

// --- Road Network ---
export async function fetchRoadNetworkData(bounds: L.LatLngBounds): Promise<RoadNetworkFeature[]> {
    const baseUrl = API_ROAD_NETWORK_URL;
    const allFeatures: RoadNetworkFeature[] = [];
    const pageSize = 1000;
    const maxRetries = 3;
    const initialDelay = 1000;

    const lowerCorner = `${bounds.getSouth()} ${bounds.getWest()}`;
    const upperCorner = `${bounds.getNorth()} ${bounds.getEast()}`;
    const boundsFilter = `<Filter><Intersects><PropertyName>SHAPE</PropertyName><gml:Envelope srsName='EPSG:4326'><gml:lowerCorner>${lowerCorner}</gml:lowerCorner><gml:upperCorner>${upperCorner}</gml:upperCorner></gml:Envelope></Intersects></Filter>`;

    let hasMore = true;
    let startIndex = 0;

    while (hasMore) {
        const url = `${baseUrl}&resultOffset=${startIndex}&resultRecordCount=${pageSize}&filter=${encodeURIComponent(boundsFilter)}`;
        
        let success = false;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    // Retry on general server errors (5xx)
                    if (response.status >= 500 && attempt < maxRetries) {
                        const delay = initialDelay * Math.pow(2, attempt - 1);
                        console.warn(`Attempt ${attempt} failed with status ${response.status}. Retrying in ${delay}ms...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    }
                    console.error(`Failed to fetch road network data for bounds ${bounds.toBBoxString()}. Status: ${response.status}`);
                    throw new Error(`Failed to fetch road network data. Status: ${response.status}`);
                }
                
                const data = await response.json();
                const features = data.features || [];

                if (features.length > 0) {
                     features.forEach((feature: RoadNetworkFeature) => {
                        if (feature.properties && feature.properties.ROUTE_ID) {
                            feature.properties.ROUTE_ID = String(feature.properties.ROUTE_ID).trim();
                            allFeatures.push(feature);
                        }
                    });
                    
                    startIndex += features.length;
                    if (features.length < pageSize) {
                        hasMore = false;
                    }
                } else {
                    hasMore = false;
                }
                success = true;
                break; // Exit retry loop on success
            } catch (error) {
                // Retry on network errors
                if (error instanceof TypeError && attempt < maxRetries) {
                    const delay = initialDelay * Math.pow(2, attempt - 1);
                    console.warn(`Attempt ${attempt} failed with network error. Retrying in ${delay}ms...`, error);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }

                if (attempt >= maxRetries) {
                     console.error(`All attempts failed for fetching road network data for bounds ${bounds.toBBoxString()}:`, error);
                     throw error; // Re-throw after all retries are exhausted
                }
            }
        }

        if (!success) {
            hasMore = false; // Stop if all retries failed
        }
    }
    
    return allFeatures;
}


// --- Traffic Speed ---
export async function fetchTrafficSpeedData(): Promise<TrafficSpeedInfo> {
    try {
        const response = await fetch(API_TRAFFIC_SPEED_URL);
        if (!response.ok) {
            console.error(`Traffic speed fetch failed with status: ${response.status}`);
            throw new Error(`Traffic speed fetch failed: ${response.statusText}`);
        }
        const xmlText = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "application/xml");

        const parserError = xmlDoc.getElementsByTagName("parsererror");
        if (parserError.length) {
            console.error("Error parsing traffic speed XML:", parserError[0].textContent);
            return {};
        }

        const result: TrafficSpeedInfo = {};
        
        // Primary parsing strategy based on user-provided XML format.
        const segments = xmlDoc.getElementsByTagName('segment');
        if (segments.length > 0) {
            for (let i = 0; i < segments.length; i++) {
                const item = segments[i];
                
                const segmentIdNode = item.getElementsByTagName('segment_id')[0];
                const speedNode = item.getElementsByTagName('speed')[0];
                const validNode = item.getElementsByTagName('valid')[0];

                if (segmentIdNode && speedNode && validNode) {
                    const segmentId = segmentIdNode.textContent?.trim();
                    const speedText = speedNode.textContent?.trim();
                    const isValid = validNode.textContent?.trim().toUpperCase() === 'Y';

                    if (segmentId && speedText && isValid) {
                        const speedValue = parseFloat(speedText);
                        
                        if (!isNaN(speedValue)) {
                            let reliability: 1 | 2 | 3;
                            if (speedValue > 40) reliability = 1; // smooth
                            else if (speedValue > 20) reliability = 2; // slow
                            else reliability = 3; // congested
                            
                            result[segmentId] = {
                                speed: Math.round(speedValue),
                                reliability: reliability
                            };
                        }
                    }
                }
            }
        }
        
        // Fallback parsing strategy for the other known XML format.
        if (Object.keys(result).length === 0) {
            const speedItems = xmlDoc.getElementsByTagName('jtis_speed');
            if (speedItems.length > 0) {
                 for (let i = 0; i < speedItems.length; i++) {
                    const item = speedItems[i];
                    const segmentIdNode = item.getElementsByTagName('segment_id')[0];
                    const speedNode = item.getElementsByTagName('traffic_speed')[0];
                    const saturationNode = item.getElementsByTagName('road_saturation_level')[0];

                    if (segmentIdNode && speedNode && saturationNode) {
                        const segmentId = segmentIdNode.textContent?.trim();
                        const speed = speedNode.textContent?.trim();
                        const saturation = saturationNode.textContent?.trim();
                        if (segmentId && speed && saturation) {
                            const speedValue = parseInt(speed, 10);
                            if (!isNaN(speedValue)) {
                                let reliability: 1 | 2 | 3 | 0 = 0;
                                switch (saturation.toUpperCase()) {
                                    case 'TRAFFIC SMOOTH': reliability = 1; break;
                                    case 'TRAFFIC SLOW': reliability = 2; break;
                                    case 'TRAFFIC CONGESTED': reliability = 3; break;
                                }
                                if (reliability !== 0) {
                                    result[segmentId] = { speed: speedValue, reliability: reliability };
                                }
                            }
                        }
                    }
                }
            }
        }
        
        return result;
    } catch (error) {
        console.error("An exception occurred in fetchTrafficSpeedData:", error);
        return {};
    }
}

// --- Toilets ---
export async function fetchToiletsInBounds(bounds: L.LatLngBounds): Promise<ToiletFeature[]> {
    const lowerCorner = `${bounds.getSouth()} ${bounds.getWest()}`;
    const upperCorner = `${bounds.getNorth()} ${bounds.getEast()}`;
    const bboxFilter = `<BBOX><PropertyName>SHAPE</PropertyName><gml:Envelope srsName='EPSG:4326'><gml:lowerCorner>${lowerCorner}</gml:lowerCorner><gml:upperCorner>${upperCorner}</gml:upperCorner></gml:Envelope></BBOX>`;

    // FEHD URL construction
    const fehdBaseFilter = `<PropertyIsEqualTo><PropertyName>SEARCH02_TC</PropertyName><Literal>'公廁'</Literal></PropertyIsEqualTo>`;
    const fehdCombinedFilter = `<Filter><And>${fehdBaseFilter}${bboxFilter}</And></Filter>`;
    const fehdUrl = `${API_TOILETS_FEHD_URL}&filter=${encodeURIComponent(fehdCombinedFilter)}`;
    
    // AFCD URL construction
    const afcdFilter = `<Filter>${bboxFilter}</Filter>`;
    const afcdUrl = `${API_TOILETS_AFCD_URL}&filter=${encodeURIComponent(afcdFilter)}`;

    try {
        const [fehdResponse, afcdResponse] = await Promise.all([
            fetch(fehdUrl),
            fetch(afcdUrl)
        ]);

        const fehdData = fehdResponse.ok ? await fehdResponse.json() : { features: [] };
        const afcdData = afcdResponse.ok ? await afcdResponse.json() : { features: [] };
        
        const allFeatures: ToiletFeature[] = [
            ...(fehdData.features || []),
            ...(afcdData.features || [])
        ];
        
        return allFeatures;
    } catch (error) {
        console.error("Error fetching toilet data:", error);
        return [];
    }
}