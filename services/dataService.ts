import type { 
    Carpark, 
    AttractionFeature, 
    ViewingPointFeature, 
    ParkingMeterFeature, 
    TurnRestrictionFeature,
    TrafficFeature,
    PermitFeature,
    ProhibitionFeature,
    RoadNetworkFeature,
    TrafficSpeedData,
    Language 
} from '../types';
import { 
    API_INFO_BASE_URL, 
    API_VACANCY_BASE_URL, 
    API_ATTRACTIONS_URL, 
    API_VIEWING_POINTS_URL, 
    API_PARKING_METERS_BASE_URL,
    API_PARKING_METERS_STATUS_URL,
    API_TURN_RESTRICTIONS_URL,
    API_TRAFFIC_FEATURES_BASE_URL,
    API_PERMIT_URL,
    API_PROHIBITION_PC_URL,
    API_PROHIBITION_ALL_URL,
    API_ROAD_NETWORK_URL,
    API_TRAFFIC_SPEED_URL,
    CORS_PROXIES
} from '../constants';
import type { GeoJSON } from 'leaflet';
// FIX: Import Leaflet type definitions for L namespace.
import type L from 'leaflet';

// --- Resilient Fetching for CORS-protected resources ---
async function fetchWithProxyFallback(resourceUrl: string): Promise<Response> {
    let lastError: Error | null = null;
    for (const proxy of CORS_PROXIES) {
        try {
            const proxiedUrl = proxy + resourceUrl;
            const response = await fetch(proxiedUrl);
            if (response.ok) {
                return response;
            }
            lastError = new Error(`Proxy ${proxy} failed with status ${response.status}`);
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            console.warn(`Proxy ${proxy} failed to fetch ${resourceUrl}. Trying next...`, lastError);
        }
    }
    throw new Error(`All proxies failed to fetch ${resourceUrl}. Last error: ${lastError?.message}`);
}


// --- KML Parsers ---

/**
 * Parses KML text where properties are simple <name> and <description> tags.
 * Used for Turn Restrictions and Road Network data.
 */
function parseKMLWithSimpleProperties(kmlText: string, type: 'Point' | 'LineString'): any {
    const parser = new DOMParser();
    const kmlDoc = parser.parseFromString(kmlText, 'text/xml');
    const placemarks = kmlDoc.querySelectorAll('Placemark');
    const features: any[] = [];

    placemarks.forEach(placemark => {
        const name = placemark.querySelector('name')?.textContent || '';
        const description = placemark.querySelector('description')?.textContent || '';
        const coordinatesNode = placemark.querySelector('coordinates');
        
        if (!coordinatesNode) return;
        const coordinatesStr = coordinatesNode.textContent?.trim();
        if (!coordinatesStr) return;

        let geometry: any = null;

        if (type === 'Point') {
            const coords = coordinatesStr.split(',').map(c => parseFloat(c));
            if (coords.length >= 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
                geometry = { type: 'Point', coordinates: [coords[0], coords[1]] };
            }
        } else if (type === 'LineString') {
            const coords = coordinatesStr
                .split(/\s+/)
                .map(coordPair => {
                    const pair = coordPair.split(',').map(c => parseFloat(c));
                    if (pair.length >= 2 && !isNaN(pair[0]) && !isNaN(pair[1])) {
                        return pair.slice(0, 2);
                    }
                    return null;
                })
                .filter((p): p is number[] => p !== null);

             if (coords.length > 1) {
                geometry = { type: 'LineString', coordinates: coords };
            }
        }
        
        if (geometry) {
             features.push({
                type: 'Feature',
                geometry,
                properties: { name, description }
            });
        }
    });

    return { type: 'FeatureCollection', features };
}

/**
 * Parses KML text where properties are stored in an HTML table within the <description> tag.
 * Used for most CSDI portal point-based data.
 */
// FIX: Made function generic to handle different property types.
function parseKMLWithTableProperties<P>(kmlText: string): GeoJSON.FeatureCollection<GeoJSON.Point, P> {
    const parser = new DOMParser();
    const kmlDoc = parser.parseFromString(kmlText, 'text/xml');
    const placemarks = kmlDoc.querySelectorAll('Placemark');
    const features: GeoJSON.Feature<GeoJSON.Point, P>[] = [];

    placemarks.forEach(placemark => {
        const coordinatesNode = placemark.querySelector('coordinates');
        const descriptionNode = placemark.querySelector('description');
        if (!coordinatesNode?.textContent) return;

        const properties: { [key: string]: any } = {
            name: placemark.querySelector('name')?.textContent || ''
        };

        if (descriptionNode?.textContent) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = descriptionNode.textContent;
            const rows = tempDiv.querySelectorAll('tr');
            rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length === 2) {
                    const key = cells[0].textContent?.trim();
                    const value = cells[1].textContent?.trim() ?? '';
                    if (key) {
                        const numValue = Number(value);
                        properties[key] = !isNaN(numValue) && value !== '' ? numValue : value;
                    }
                }
            });
        }

        const coords = coordinatesNode.textContent.trim().split(',').map(c => parseFloat(c));
        if (coords.length >= 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
            features.push({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [coords[0], coords[1]] },
                properties: properties as P,
            });
        }
    });
    return { type: 'FeatureCollection', features };
}


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
    const kmlText = await response.text();
    // FIX: Explicitly set the properties type to match AttractionFeature.
    const data = parseKMLWithTableProperties<AttractionFeature['properties']>(kmlText);
    return data.features || [];
}

// --- Viewing Points ---
export async function fetchViewingPointsData(): Promise<ViewingPointFeature[]> {
    const response = await fetch(API_VIEWING_POINTS_URL);
    if (!response.ok) throw new Error('Failed to fetch viewing points data.');
    const kmlText = await response.text();
    // FIX: Explicitly set the properties type to match ViewingPointFeature.
    const data = parseKMLWithTableProperties<ViewingPointFeature['properties']>(kmlText);
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
    const kmlText = await response.text();
    // FIX: Explicitly set the properties type to match ParkingMeterFeature.
    const data = parseKMLWithTableProperties<ParkingMeterFeature['properties']>(kmlText);
    return data.features || [];
}

// --- Turn Restrictions ---
export async function fetchTurnRestrictionsData(): Promise<TurnRestrictionFeature[]> {
    try {
        const response = await fetchWithProxyFallback(API_TURN_RESTRICTIONS_URL);

        const kmzBlob = await response.blob();
        // @ts-ignore JSZip is loaded from CDN
        const zip = await JSZip.loadAsync(kmzBlob);
        
        const kmlFile = Object.keys(zip.files).find(fileName => fileName.endsWith('.kml'));
        if (!kmlFile) throw new Error('No KML file found in KMZ.');

        const kmlText = await zip.files[kmlFile].async('text');
        const geojsonData = parseKMLWithSimpleProperties(kmlText, 'Point');
        return geojsonData.features;
    } catch(error) {
        console.error("Error fetching turn restrictions:", error);
        return [];
    }
}


// --- Traffic Features ---
export async function fetchTrafficFeaturesNearby(latlng: L.LatLng): Promise<TrafficFeature[]> {
    try {
        const buffer = 0.035; // Approx 3.5km in degrees
        const lowerCorner = `${latlng.lat - buffer} ${latlng.lng - buffer}`;
        const upperCorner = `${latlng.lat + buffer} ${latlng.lng + buffer}`;
        const filter = `<Filter><Intersects><PropertyName>SHAPE</PropertyName><gml:Envelope srsName='EPSG:4326'><gml:lowerCorner>${lowerCorner}</gml:lowerCorner><gml:upperCorner>${upperCorner}</gml:upperCorner></gml:Envelope></Intersects></Filter>`;
        
        const url = `${API_TRAFFIC_FEATURES_BASE_URL}&filter=${encodeURIComponent(filter)}`;

        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch traffic features data.');
        const kmlText = await response.text();
        // FIX: Explicitly set the properties type to match TrafficFeature.
        const data = parseKMLWithTableProperties<TrafficFeature['properties']>(kmlText);
        return data.features || [];
    } catch (error) {
        console.error("Error fetching traffic features data:", error);
        return [];
    }
}

// --- Permits ---
export async function fetchPermitData(): Promise<PermitFeature[]> {
    try {
        const response = await fetch(API_PERMIT_URL);
        if (!response.ok) throw new Error('Failed to fetch permit data.');
        const kmlText = await response.text();
        // FIX: Explicitly set the properties type to match PermitFeature.
        const data = parseKMLWithTableProperties<PermitFeature['properties']>(kmlText);
        return data.features || [];
    } catch (error) {
        console.error("Error fetching permit data:", error);
        return [];
    }
}

// --- Prohibitions ---
export async function fetchProhibitionData(): Promise<ProhibitionFeature[]> {
    try {
        const [pcResponse, allResponse] = await Promise.all([
            fetch(API_PROHIBITION_PC_URL),
            fetch(API_PROHIBITION_ALL_URL)
        ]);

        if (!pcResponse.ok || !allResponse.ok) {
            console.error('Failed to fetch one or more prohibition datasets.');
            return [];
        }

        const pcKml = await pcResponse.text();
        const allKml = await allResponse.text();

        // FIX: Explicitly set the properties type to match ProhibitionFeature.
        const pcData = parseKMLWithTableProperties<ProhibitionFeature['properties']>(pcKml);
        const allData = parseKMLWithTableProperties<ProhibitionFeature['properties']>(allKml);

        const combinedFeatures = [
            ...(pcData.features || []),
            ...(allData.features || [])
        ];
        
        return combinedFeatures;

    } catch (error) {
        console.error("Error fetching prohibition data:", error);
        return [];
    }
}

// --- Road Network and Traffic Speed ---

// --- IndexedDB Caching for Road Network ---
const DB_NAME = 'HKMapCache';
const DB_VERSION = 1;
const ROAD_NETWORK_STORE = 'roadNetwork';
const CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CacheEntry<T> {
    timestamp: number;
    data: T;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
    if (dbPromise) {
        return dbPromise;
    }
    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(ROAD_NETWORK_STORE)) {
                db.createObjectStore(ROAD_NETWORK_STORE);
            }
        };
    });
    return dbPromise;
}

async function getCachedRoadNetwork(): Promise<RoadNetworkFeature[] | null> {
    try {
        const db = await getDb();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(ROAD_NETWORK_STORE, 'readonly');
            const store = transaction.objectStore(ROAD_NETWORK_STORE);
            const request = store.get('geometry');

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const result = request.result as CacheEntry<RoadNetworkFeature[]> | undefined;
                if (result && (Date.now() - result.timestamp < CACHE_EXPIRY_MS)) {
                    console.log("Loaded road network from cache.");
                    resolve(result.data);
                } else {
                    if (result) console.log("Road network cache is stale.");
                    else console.log("Road network not found in cache.");
                    resolve(null);
                }
            };
        });
    } catch (error) {
        console.error("Error accessing IndexedDB:", error);
        return null;
    }
}

// --- Web Worker for fetching and parsing Road Network ---
const roadNetworkWorkerCode = `
    const DB_NAME = 'HKMapCache';
    const DB_VERSION = 1;
    const ROAD_NETWORK_STORE = 'roadNetwork';

    function openDb() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
    }

    async function setCachedRoadNetwork(features) {
        try {
            const db = await openDb();
            const transaction = db.transaction(ROAD_NETWORK_STORE, 'readwrite');
            const store = transaction.objectStore(ROAD_NETWORK_STORE);
            store.put({ timestamp: Date.now(), data: features }, 'geometry');
        } catch (e) {
            console.error("Worker failed to cache road network:", e);
        }
    }

    function parseGMLtoGeoJSON(gmlText) {
        const parser = new DOMParser();
        const gmlDoc = parser.parseFromString(gmlText, 'application/xml');
        const parserError = gmlDoc.querySelector('parsererror');
        if (parserError) {
            console.error("XML parsing error in worker:", parserError.textContent);
            throw new Error("Failed to parse GML file in worker.");
        }
        const features = [];
        const featureMembers = gmlDoc.getElementsByTagNameNS('http://www.opengis.net/gml/3.2', 'featureMember');
        for (const member of Array.from(featureMembers)) {
            const centerline = member.getElementsByTagNameNS('*', 'CENTERLINE')[0];
            if (!centerline) continue;
            const irnNode = centerline.getElementsByTagNameNS('*', 'IRN')[0];
            const nameNode = centerline.getElementsByTagNameNS('*', 'ST_NAME_EN')[0];
            const posListNode = centerline.getElementsByTagNameNS('http://www.opengis.net/gml/3.2', 'posList')[0];
            const segmentId = irnNode?.textContent;
            if (!segmentId || !posListNode?.textContent) continue;
            const name = nameNode?.textContent || 'Unnamed Road';
            const coordsStr = posListNode.textContent.trim().split(/\\s+/);
            const coordinates = [];
            for (let i = 0; i < coordsStr.length; i += 2) {
                const lat = parseFloat(coordsStr[i]);
                const lon = parseFloat(coordsStr[i + 1]);
                if (!isNaN(lat) && !isNaN(lon)) {
                    coordinates.push([lon, lat]);
                }
            }
            if (coordinates.length < 2) continue;
            features.push({
                type: 'Feature',
                geometry: { type: 'LineString', coordinates },
                properties: { name, description: \`Road Segment ID: \${segmentId}\`, segment_id: segmentId },
            });
        }
        return features;
    }
    
    self.onmessage = async (event) => {
        const { url } = event.data;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(\`Failed to fetch local GML with status \${response.status}\`);
            }
            const gmlText = await response.text();
            if (!gmlText) throw new Error('Empty GML data received in worker.');
            
            const allFeatures = parseGMLtoGeoJSON(gmlText);
            
            if (allFeatures.length > 0) {
                await setCachedRoadNetwork(allFeatures);
            }
            
            const chunkSize = 500;
            for (let i = 0; i < allFeatures.length; i += chunkSize) {
                const chunk = allFeatures.slice(i, i + chunkSize);
                self.postMessage({ type: 'chunk', features: chunk });
            }
            self.postMessage({ type: 'done' });
            
        } catch (error) {
            self.postMessage({ type: 'error', error: error.message });
        }
    };
`;

let roadNetworkWorker: Worker | null = null;
function getRoadNetworkWorker(): Worker {
    if (!roadNetworkWorker) {
        const blob = new Blob([roadNetworkWorkerCode], { type: 'application/javascript' });
        roadNetworkWorker = new Worker(URL.createObjectURL(blob));
    }
    return roadNetworkWorker;
}

function fetchRoadNetworkFromWorker(onChunk: (chunk: RoadNetworkFeature[]) => void): Promise<void> {
    return new Promise((resolve, reject) => {
        const worker = getRoadNetworkWorker();
        
        worker.onmessage = (event) => {
            const { type, features, error } = event.data;
            if (type === 'chunk') {
                onChunk(features);
            } else if (type === 'done') {
                resolve();
            } else if (type === 'error') {
                reject(new Error(error));
            }
        };

        worker.onerror = (error) => reject(error);
        
        // FIX: Construct an absolute URL for the worker. Workers created from blobs
        // have a null origin and cannot resolve relative paths like "/CENTERLINE.gml".
        const absoluteUrl = new URL(API_ROAD_NETWORK_URL, window.location.origin).href;
        worker.postMessage({ url: absoluteUrl });
    });
}

/**
 * Parses a GML string into a GeoJSON FeatureCollection format that the app can use.
 * This is specific to the CENTERLINE.gml structure.
 */
function parseGMLtoGeoJSON(gmlText: string): RoadNetworkFeature[] {
    const parser = new DOMParser();
    const gmlDoc = parser.parseFromString(gmlText, 'application/xml');
    
    const parserError = gmlDoc.querySelector('parsererror');
    if (parserError) {
        console.error("XML parsing error:", parserError.textContent);
        throw new Error("Failed to parse GML file.");
    }
    
    const features: RoadNetworkFeature[] = [];
    // Use `getElementsByTagNameNS` for robust namespace handling.
    const featureMembers = gmlDoc.getElementsByTagNameNS('http://www.opengis.net/gml/3.2', 'featureMember');

    for (const member of Array.from(featureMembers)) {
        // Use a wildcard namespace ('*') for the app-specific elements like CENTERLINE, IRN, etc.
        const centerline = member.getElementsByTagNameNS('*', 'CENTERLINE')[0];
        if (!centerline) continue;

        const irnNode = centerline.getElementsByTagNameNS('*', 'IRN')[0];
        const nameNode = centerline.getElementsByTagNameNS('*', 'ST_NAME_EN')[0];
        const posListNode = centerline.getElementsByTagNameNS('http://www.opengis.net/gml/3.2', 'posList')[0];

        const segmentId = irnNode?.textContent;
        if (!segmentId || !posListNode?.textContent) continue;
        
        const name = nameNode?.textContent || 'Unnamed Road';
        
        // posList is a string of space-separated numbers: "lat1 lon1 lat2 lon2 ..."
        const coordsStr = posListNode.textContent.trim().split(/\s+/);
        const coordinates: number[][] = [];
        
        for (let i = 0; i < coordsStr.length; i += 2) {
            const lat = parseFloat(coordsStr[i]);
            const lon = parseFloat(coordsStr[i + 1]);
            if (!isNaN(lat) && !isNaN(lon)) {
                coordinates.push([lon, lat]); // GeoJSON format requires [longitude, latitude]
            }
        }
        
        if (coordinates.length < 2) continue; // A LineString needs at least two points.

        const feature: RoadNetworkFeature = {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: coordinates,
            },
            properties: {
                name: name,
                description: `Road Segment ID: ${segmentId}`,
                segment_id: segmentId,
            },
        };
        features.push(feature);
    }
    return features;
}

export async function fetchRoadNetworkGeometry(onChunk: (chunk: RoadNetworkFeature[]) => void): Promise<void> {
    try {
        const cachedData = await getCachedRoadNetwork();
        if (cachedData) {
            // Stream cached data in chunks to maintain a consistent UI experience
            const chunkSize = 1000;
            for (let i = 0; i < cachedData.length; i += chunkSize) {
                const chunk = cachedData.slice(i, i + chunkSize);
                // Yield to the main thread to allow UI updates between chunks
                await new Promise(resolve => setTimeout(() => {
                    onChunk(chunk);
                    resolve(true);
                }, 0));
            }
            return;
        }

        if (window.Worker) {
            console.log("Fetching road network via worker to avoid blocking UI...");
            await fetchRoadNetworkFromWorker(onChunk);
            return;
        } 
        
        // Fallback for environments without Web Worker support
        console.warn("Web Workers not supported. Fetching and parsing on main thread.");
        const response = await fetch(API_ROAD_NETWORK_URL);
        if (!response.ok) throw new Error(`Failed to fetch local GML with status ${response.status}`);
        const gmlText = await response.text();
        if (!gmlText) throw new Error('Empty GML data received for road network.');
        
        const features = parseGMLtoGeoJSON(gmlText);
        
        if (features.length > 0 && window.indexedDB) {
            const db = await getDb();
            const transaction = db.transaction(ROAD_NETWORK_STORE, 'readwrite');
            const store = transaction.objectStore(ROAD_NETWORK_STORE);
            store.put({ timestamp: Date.now(), data: features }, 'geometry');
        }

        // Stream data in chunks in the fallback path as well
        const chunkSize = 1000;
        for (let i = 0; i < features.length; i += chunkSize) {
            const chunk = features.slice(i, i + chunkSize);
             await new Promise(resolve => setTimeout(() => {
                onChunk(chunk);
                resolve(true);
            }, 0));
        }

    } catch (error) {
        if (error instanceof Error) {
             console.error("An error occurred during road network geometry processing:", error.message);
        } else {
             console.error("An unknown error occurred while fetching road network geometry:", error);
        }
        throw error; // Re-throw so the caller can handle it
    }
}

export async function fetchTrafficSpeedData(): Promise<TrafficSpeedData> {
    const speedMap: TrafficSpeedData = new Map();
    try {
        const response = await fetch(API_TRAFFIC_SPEED_URL);
        if (!response.ok) throw new Error('Failed to fetch traffic speed XML.');
        const xmlText = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
        const segments = xmlDoc.querySelectorAll('segment');
        segments.forEach(segment => {
            const id = segment.getAttribute('segment_id');
            const speedNode = segment.querySelector('speed');
            const speed = speedNode ? parseFloat(speedNode.textContent || '0') : 0;
            if (id) {
                speedMap.set(id, speed);
            }
        });
        return speedMap;
    } catch (error) {
        console.error("Error fetching traffic speed data:", error);
        return speedMap; // Return empty map on error
    }
}