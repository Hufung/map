import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet-routing-machine';
import type { Map as LeafletMap, LatLng, LayerGroup, LatLngBounds } from 'leaflet';

import {
    Carpark, AttractionFeature, ViewingPointFeature, 
    TurnRestrictionFeature, TrafficFeature, PermitFeature, ProhibitionFeature, 
    RoadNetworkFeature, TrafficSpeedInfo,
    Language, VisibleLayers, GroupedParkingMeter
} from '../types';
import { i18n } from '../constants';
import { fetchParkingMetersInBounds, getCachedParkingMeterStatus, fetchTrafficFeaturesNearby } from '../services/dataService';
import { createCarparkIcon, createAttractionIcon, createViewingPointIcon, createParkingMeterIcon, createTurnRestrictionIcon, createTrafficFeatureIcon, createPermitIcon, createProhibitionIcon } from './MapIcons';
import { RoutePanel } from './RoutePanel';
import { NavigationNotification } from './NavigationNotification';

// Fix: Add leaflet-routing-machine type declarations
// FIX: Use `declare global` to correctly augment the leaflet 'L' object and resolve module resolution issues.
declare global {
    namespace L {
        namespace Routing {
            interface IRoute {
                summary: {
                    totalDistance: number;
                    totalTime: number;
                };
                // Fix: Namespace 'global.L' has no exported member 'LatLng'. Use `import('leaflet').LatLng` to refer to the type from the leaflet module.
                coordinates: import('leaflet').LatLng[];
                instructions: { text: string }[];
            }

            interface RoutingErrorEvent {
                error: {
                    message: string;
                };
            }

            interface RoutesFoundEvent {
                routes: IRoute[];
            }

            // Fix: Property 'Control' does not exist on type 'typeof L'. Extend from `import('leaflet').Control` to correctly reference the base Control class.
            class Control extends import('leaflet').Control {
                on(type: 'routesfound', fn: (e: RoutesFoundEvent) => void, context?: any): this;
                on(type: 'routingerror', fn: (e: RoutingErrorEvent) => void, context?: any): this;
                // Fix: Namespace 'global.L' has no exported member 'LeafletEventHandlerFn'. Use `import('leaflet').LeafletEventHandlerFn` for the event handler type.
                on(type: string, fn: import('leaflet').LeafletEventHandlerFn, context?: any): this;
            }

            function control(options: any): Control;
        }
    }
}

// Fix for default Leaflet icon path issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Helper to decode API codes using the i18n object
const decodeCode = (prefix: 'vehicle' | 'op', code: string, translations: typeof i18n['en_US'] ) => {
    if (!code) return translations.unknown;
    const shortCode = code.length > 1 ? code[code.length - 1] : code;
    const key = `${prefix}_${shortCode}` as keyof typeof translations;
    return translations[key] || code;
};

interface MapComponentProps {
    setMap: (map: LeafletMap) => void;
    language: Language;
    visibleLayers: VisibleLayers;
    carparkData: Carpark[];
    attractionsData: AttractionFeature[];
    viewingPointsData: ViewingPointFeature[];
    turnRestrictionsData: TurnRestrictionFeature[];
    permitData: PermitFeature[];
    prohibitionData: ProhibitionFeature[];
    roadNetworkData: RoadNetworkFeature[];
    trafficSpeedData: TrafficSpeedInfo;
    onMarkerClick: (carpark: Carpark) => void;
    navigationTarget: { lat: number, lon: number } | null;
    onNavigationStarted: () => void;
    onMapViewChange: (bounds: LatLngBounds) => void;
}

export const MapComponent: React.FC<MapComponentProps> = ({
    setMap, language, visibleLayers, carparkData, attractionsData,
    viewingPointsData, turnRestrictionsData, permitData, prohibitionData,
    roadNetworkData, trafficSpeedData,
    onMarkerClick, navigationTarget, onNavigationStarted, onMapViewChange
}) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<LeafletMap | null>(null);
    const layersRef = useRef<{ [key: string]: LayerGroup }>({});
    const roadLayersRef = useRef<Map<string, L.Polyline>>(new Map());
    const userLocationMarkerRef = useRef<L.Marker | null>(null);
    const routingControlRef = useRef<L.Routing.Control | null>(null);
    const positionWatchIdRef = useRef<number | null>(null);
    const warnedFeaturesRef = useRef<Set<string>>(new Set());
    const userLatLngRef = useRef<LatLng | null>(null);
    
    const [currentRoute, setCurrentRoute] = useState<L.Routing.IRoute | null>(null);
    const [notification, setNotification] = useState<string>('');
    const [localTrafficFeatures, setLocalTrafficFeatures] = useState<TrafficFeature[]>([]);

    const t = i18n[language];
    
    const speak = (text: string) => {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = language === 'en_US' ? 'en-US' : (language === 'zh_TW' ? 'zh-TW' : 'zh-CN');
            window.speechSynthesis.speak(utterance);
        }
    };

    const showNotification = useCallback((message: string, shouldSpeak: boolean = true) => {
        setNotification(message);
        if (shouldSpeak) {
            speak(message);
        }
    }, [language]);

    const stopNavigation = useCallback(() => {
        const map = mapRef.current;
        if (map && routingControlRef.current) {
            map.removeControl(routingControlRef.current);
            routingControlRef.current = null;
        }
        setCurrentRoute(null);
        if(layersRef.current.routeTurnRestrictions) layersRef.current.routeTurnRestrictions.clearLayers();
        if (positionWatchIdRef.current !== null) {
            navigator.geolocation.clearWatch(positionWatchIdRef.current);
            positionWatchIdRef.current = null;
        }
    }, []);

    const plotTurnRestrictionsAlongRoute = useCallback((route: L.Routing.IRoute) => {
        const layer = layersRef.current.routeTurnRestrictions;
        if (!layer || !mapRef.current) return;
        layer.clearLayers();

        if (!mapRef.current.hasLayer(layer)) {
            mapRef.current.addLayer(layer);
        }

        const routeCoords = route.coordinates.map(c => L.latLng(c.lat, c.lng));
        
        turnRestrictionsData.forEach(feature => {
            const [lon, lat] = feature.geometry.coordinates;
            const point = L.latLng(lat, lon);
            
            // A simple proximity check since L.GeometryUtil might not be available
            for (const routePoint of routeCoords) {
                if (point.distanceTo(routePoint) < 50) { // 50m buffer
                    const icon = createTurnRestrictionIcon();
                    L.marker(point, { icon }).addTo(layer).bindPopup(`<strong>${t.turnRestrictionWarning}</strong><br>${feature.properties.name}`);
                    break; // Add only once
                }
            }
        });
    }, [turnRestrictionsData, t.turnRestrictionWarning]);

    // Proximity alerts during navigation
    const checkProximityAlerts = useCallback((userLatLng: LatLng) => {
        const combinedFeatures: (TrafficFeature | TurnRestrictionFeature)[] = [
            ...localTrafficFeatures, 
            ...turnRestrictionsData
        ];

        combinedFeatures.forEach(feature => {
            const id = 'GmlID' in feature.properties ? feature.properties.GmlID : feature.properties.name;
            if (warnedFeaturesRef.current.has(id)) return;

            const [lon, lat] = feature.geometry.coordinates;
            const featureLatLng = L.latLng(lat, lon);

            if (userLatLng.distanceTo(featureLatLng) < 10) { // 10m proximity
                let message = '';
                if('FEATURE_TYPE' in feature.properties) {
                    switch (feature.properties.FEATURE_TYPE) {
                        case 1: message = t.zebraCrossing; break;
                        case 2: message = t.yellowBox; break;
                        case 3: message = t.tollPlaza; break;
                        case 4: message = t.culDeSac; break;
                    }
                } else if ('name' in feature.properties) {
                    message = `${t.turnRestrictionWarning}: ${feature.properties.name}`;
                }

                if (message) {
                    showNotification(message);
                    warnedFeaturesRef.current.add(id);
                }
            }
        });
    }, [localTrafficFeatures, turnRestrictionsData, t, showNotification]);

    const handleNavigation = useCallback((lat: number, lon: number) => {
        const map = mapRef.current;
        if (!map) return;

        map.closePopup();
        stopNavigation(); // Clear any previous route
        
        navigator.geolocation.getCurrentPosition(position => {
            const start = L.latLng(position.coords.latitude, position.coords.longitude);
            const end = L.latLng(lat, lon);
            
            const control = L.Routing.control({
                waypoints: [start, end],
                routeWhileDragging: false,
                show: false,
                addWaypoints: false,
                fitSelectedRoutes: true,
                // @ts-ignore - Type definitions for leaflet-routing-machine may be incorrect
                lineOptions: { styles: [{ color: '#007BFF', opacity: 0.8, weight: 6 }] }
            }).addTo(map);

            control.on('routesfound', e => {
                const route = e.routes[0];
                setCurrentRoute(route);
                warnedFeaturesRef.current.clear();
                plotTurnRestrictionsAlongRoute(route);
            });

            control.on('routingerror', (e: L.Routing.RoutingErrorEvent) => {
                let errorMessage = t.navigationError; // Default message
                if (e.error && typeof e.error.message === 'string' && e.error.message) {
                    errorMessage = e.error.message;
                }
                
                console.error("Routing error details:", e.error); // Log the object for inspection
                showNotification(errorMessage, false);
            });
            
            routingControlRef.current = control;
        }, () => showNotification(t.locationError, true));
    }, [stopNavigation, plotTurnRestrictionsAlongRoute, t.locationError, t.navigationError, showNotification]);

    // Initialize Map
    useEffect(() => {
        if (mapRef.current || !mapContainerRef.current) return;

        const map = L.map(mapContainerRef.current).setView([22.3193, 114.1694], 12);
        L.tileLayer('https://mapapi.geodata.gov.hk/gs/api/v1.0.0/xyz/basemap/wgs84/{z}/{x}/{y}.png', {
            attribution: '<a href="https://api.portal.hkmapservice.gov.hk/disclaimer" target="_blank">&copy; Map info from Lands Dept.</a>',
            maxZoom: 20, minZoom: 3
        }).addTo(map);

        layersRef.current = {
            carparks: L.layerGroup().addTo(map),
            attractions: L.layerGroup(),
            viewingPoints: L.layerGroup(),
            parkingMeters: L.layerGroup(),
            permits: L.layerGroup(),
            prohibitions: L.layerGroup(),
            trafficFeatures: L.layerGroup().addTo(map),
            routeTurnRestrictions: L.layerGroup(),
            trafficSpeed: L.layerGroup(),
        };

        mapRef.current = map;
        setMap(map);
        
        map.on('locationfound', async (e) => {
            userLatLngRef.current = e.latlng;
            if (userLocationMarkerRef.current) {
                userLocationMarkerRef.current.setLatLng(e.latlng);
            } else {
                userLocationMarkerRef.current = L.marker(e.latlng).addTo(map)
                    .bindPopup(t.userLocationPopup.replace('{accuracy}', e.accuracy.toFixed(0)));
            }
            const features = await fetchTrafficFeaturesNearby(e.latlng);
            setLocalTrafficFeatures(features);
        });
        
        map.on('popupopen', (e) => {
            // FIX: Replace querySelector generic with a type assertion to fix "Untyped function calls may not accept type arguments" error.
            const navBtn = e.popup.getElement()?.querySelector('.navigate-btn') as HTMLButtonElement | null;
            if(navBtn?.dataset.lat && navBtn?.dataset.lon) {
                navBtn.onclick = () => handleNavigation(parseFloat(navBtn.dataset.lat!), parseFloat(navBtn.dataset.lon!));
            }
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    
    // Effect to plot traffic features when they are fetched
    useEffect(() => {
        const layer = layersRef.current.trafficFeatures;
        if (!layer || !mapRef.current) return;
    
        layer.clearLayers();
    
        localTrafficFeatures.forEach(feature => {
            const [lon, lat] = feature.geometry.coordinates;
            const icon = createTrafficFeatureIcon(feature.properties.FEATURE_TYPE);
            L.marker(L.latLng(lat, lon), { icon }).addTo(layer);
        });
    }, [localTrafficFeatures]);

    // Trigger navigation from parent
    useEffect(() => {
        if (navigationTarget) {
            handleNavigation(navigationTarget.lat, navigationTarget.lon);
            onNavigationStarted();
        }
    }, [navigationTarget, handleNavigation, onNavigationStarted]);

    // Plot Car parks
    useEffect(() => {
        const layer = layersRef.current.carparks;
        layer.clearLayers();
        const icon = createCarparkIcon();
        carparkData.forEach(carpark => {
            if (carpark.latitude && carpark.longitude) {
                L.marker([carpark.latitude, carpark.longitude], { icon })
                    .addTo(layer)
                    .on('click', () => onMarkerClick(carpark));
            }
        });
    }, [carparkData, onMarkerClick]);

    // Plot Permits
    useEffect(() => {
        const layer = layersRef.current.permits;
        if (!layer) return;
        layer.clearLayers();
        const icon = createPermitIcon();
        permitData.forEach(feature => {
            const [lon, lat] = feature.geometry.coordinates;
            const p = feature.properties;
            const pop = `<strong>Permit ID: ${p.PERMIT_ID}</strong><br>${p.REMARKS || 'No remarks'}`;
            L.marker([lat, lon], { icon }).addTo(layer).bindPopup(pop);
        });
    }, [permitData]);
    
    // Plot Prohibitions
    useEffect(() => {
        const layer = layersRef.current.prohibitions;
        if (!layer) return;
        layer.clearLayers();
        const icon = createProhibitionIcon();
        prohibitionData.forEach(feature => {
            const [lon, lat] = feature.geometry.coordinates;
            const p = feature.properties;
            const pop = `<strong>Prohibition</strong><br>Type: ${p.EXC_VEH_TYPE}<br>${p.REMARKS || 'No remarks'}`;
            L.marker([lat, lon], { icon }).addTo(layer).bindPopup(pop);
        });
    }, [prohibitionData]);

    // --- Efficient Road Network & Traffic Speed Rendering ---
    
    const getTrafficStyle = useCallback((routeId: string): { color: string; weight: number } => {
        const speedInfo = trafficSpeedData[routeId];
        // Roads with no data, or unknown status, are thinner and grey
        if (!speedInfo || speedInfo.reliability === 0) {
            return { color: '#888888', weight: 3 };
        }
        switch (speedInfo.reliability) {
            case 1: return { color: '#28a745', weight: 4 }; // Green for Smooth
            case 2: return { color: '#ffc107', weight: 5 }; // Yellow, thicker for Slow
            case 3: return { color: '#dc3545', weight: 6 }; // Red, thickest for Congested
            default: return { color: '#888888', weight: 3 };
        }
    }, [trafficSpeedData]);

    // Effect to ADD new roads to the map
    useEffect(() => {
        const layer = layersRef.current.trafficSpeed;
        if (!layer || !mapRef.current) return;

        const newFeatures = roadNetworkData.filter(feature =>
            feature.properties?.ROUTE_ID && !roadLayersRef.current.has(String(feature.properties.ROUTE_ID))
        );

        if (newFeatures.length === 0) return;

        newFeatures.forEach(feature => {
            const routeId = String(feature.properties.ROUTE_ID);
            const { color, weight } = getTrafficStyle(routeId);
            const geometry = feature.geometry;

            let latLngs: L.LatLngExpression[] | L.LatLngExpression[][] = [];

            if (geometry.type === 'LineString') {
                latLngs = geometry.coordinates.map(coord => L.latLng(coord[1], coord[0]));
            } else if (geometry.type === 'MultiLineString') {
                latLngs = geometry.coordinates.map(line => line.map(coord => L.latLng(coord[1], coord[0])));
            } else {
                return;
            }

            if (latLngs.length === 0) return;

            const line = L.polyline(latLngs, { color, weight, opacity: 0.85 });

            const roadName = language === 'en_US' ? feature.properties.ROAD_NAME_ENG : feature.properties.ROAD_NAME_CHI;
            let popupContent = `<strong>${roadName}</strong><br>${t.routeId}: ${routeId}`;
            const speedInfo = trafficSpeedData[routeId];
            if (speedInfo) {
                popupContent += `<br>${t.avgSpeed}: ${speedInfo.speed} km/h`;
            }
            line.bindPopup(popupContent);

            roadLayersRef.current.set(routeId, line);

            // Add to map only if layer is visible
            if (mapRef.current.hasLayer(layer)) {
                line.addTo(layer);
            }
        });
    }, [roadNetworkData, language, t.routeId, t.avgSpeed, getTrafficStyle, trafficSpeedData]);
    
    // Effect to UPDATE road styles when speed data changes
    useEffect(() => {
        roadLayersRef.current.forEach((line, routeId) => {
            const { color, weight } = getTrafficStyle(routeId);
            line.setStyle({ color, weight });
        });
    }, [trafficSpeedData, getTrafficStyle]);


    // Plot other features
    useEffect(() => {
        const plotters: { [key: string]: (layer: LayerGroup) => void } = {
            attractions: (layer) => {
                const nameKey = language === 'en_US' ? 'NAME_EN' : 'NAME_CH';
                const locationKey = language === 'en_US' ? 'LOCATION_EN' : 'LOCATION_CH';
                attractionsData.forEach(f => {
                    const [lon, lat] = f.geometry.coordinates;
                    const p = f.properties;
                    const pop = `<strong>${p[nameKey]}</strong><br>${p[locationKey]}<br><button class="navigate-btn w-full mt-1" data-lat="${lat}" data-lon="${lon}">${t.navigate}</button>`;
                    L.marker([lat, lon], { icon: createAttractionIcon() }).addTo(layer).bindPopup(pop);
                });
            },
            viewingPoints: (layer) => {
                 const nameKey = language === 'en_US' ? 'Name_Eng' : 'Name_Chi';
                 viewingPointsData.forEach(f => {
                    const [lon, lat] = f.geometry.coordinates;
                    const p = f.properties;
                    const pop = `<strong>${p[nameKey]}</strong><br><button class="navigate-btn w-full mt-1" data-lat="${lat}" data-lon="${lon}">${t.navigate}</button>`;
                    L.marker([lat, lon], { icon: createViewingPointIcon() }).addTo(layer).bindPopup(pop);
                });
            }
        };

        Object.entries(plotters).forEach(([key, plot]) => {
            const layer = layersRef.current[key];
            if (layer) {
                layer.clearLayers();
                plot(layer);
            }
        });
    }, [language, attractionsData, viewingPointsData, t.navigate]);

    const plotParkingMeters = useCallback(async () => {
        const map = mapRef.current;
        if (!map) return;
        const layer = layersRef.current.parkingMeters;
        layer.clearLayers();
        
        const metersInView = await fetchParkingMetersInBounds(map.getBounds());
        const statusMap = getCachedParkingMeterStatus();
        
        const groupedMeters = new Map<string, GroupedParkingMeter>();
        const streetKey = language === 'en_US' ? 'Street' : (language === 'zh_TW' ? 'Street_tc' : 'Street_sc');
        const sectionKey = language === 'en_US' ? 'SectionOfStreet' : (language === 'zh_TW' ? 'SectionOfStreet_tc' : 'SectionOfStreet_sc');

        metersInView.forEach(f => {
            const p = f.properties;
            const [lon, lat] = f.geometry.coordinates;
            const street = p[streetKey] || t.unknown;
            const section = p[sectionKey] || t.unknown;
            const groupingKey = `${street} | ${section}`;

            if (!groupedMeters.has(groupingKey)) {
                groupedMeters.set(groupingKey, {
                    latLng: [lat, lon],
                    street: street,
                    section: section,
                    totalCount: 0,
                    availableCount: 0,
                    occupiedCount: 0,
                    vehicleTypes: new Set(),
                    opPeriods: new Set()
                });
            }

            const group = groupedMeters.get(groupingKey)!;
            group.totalCount++;
            const status = statusMap.get(p.ParkingSpaceId);
            if (status === 'V') group.availableCount++;
            else if (status === 'O') group.occupiedCount++;

            if (p.VehicleType) group.vehicleTypes.add(p.VehicleType);
            if (p.OperatingPeriod) group.opPeriods.add(p.OperatingPeriod);
        });
        
        groupedMeters.forEach(g => {
            const vehicleTypesHtml = [...g.vehicleTypes].map(code => `<li class="ml-4 list-disc">${decodeCode('vehicle', code, t)}</li>`).join('');
            const opPeriodsHtml = [...g.opPeriods].map(code => `<li class="ml-4 list-disc">${decodeCode('op', code, t)}</li>`).join('');

            const pop = `
                <div class="text-sm w-64">
                    <div class="font-bold text-base mb-1">${g.street}</div>
                    <div class="mb-2"><span class="font-semibold">${t.sectionOfStreet}:</span> ${g.section}</div>
                    <hr class="my-1">
                    <div class="grid grid-cols-3 gap-x-2 text-center my-2">
                        <div>
                            <div class="font-bold text-lg">${g.totalCount}</div>
                            <div class="text-xs text-gray-500">${t.totalMeters}</div>
                        </div>
                        <div>
                            <div class="font-bold text-lg text-green-600">${g.availableCount}</div>
                            <div class="text-xs text-gray-500">${t.availableMeters}</div>
                        </div>
                        <div>
                            <div class="font-bold text-lg text-red-600">${g.occupiedCount}</div>
                            <div class="text-xs text-gray-500">${t.occupiedMeters}</div>
                        </div>
                    </div>
                    <hr class="my-1">
                    ${vehicleTypesHtml ? `<div><span class="font-semibold">${t.vehicleType}:</span><ul class="list-none pl-0 mt-1">${vehicleTypesHtml}</ul></div>` : ''}
                    ${opPeriodsHtml ? `<div class="mt-2"><span class="font-semibold">${t.operatingPeriod}:</span><ul class="list-none pl-0 mt-1">${opPeriodsHtml}</ul></div>` : ''}
                    <button class="navigate-btn w-full mt-2 bg-blue-600 text-white font-bold py-1 px-2 rounded hover:bg-blue-700" data-lat="${g.latLng[0]}" data-lon="${g.latLng[1]}">${t.navigate}</button>
                </div>
            `;
            L.marker(g.latLng, { icon: createParkingMeterIcon() }).addTo(layer).bindPopup(pop, { maxWidth: 300 });
        });
    }, [language, t]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        
        let moveEndTimer: ReturnType<typeof window.setTimeout>;
        const onMoveEnd = () => {
            clearTimeout(moveEndTimer);
            moveEndTimer = window.setTimeout(() => {
                if(visibleLayers.parkingMeters) plotParkingMeters();
                if(visibleLayers.trafficSpeed) onMapViewChange(map.getBounds());
            }, 500);
        };
        map.on('moveend', onMoveEnd);
        return () => { map.off('moveend', onMoveEnd); clearTimeout(moveEndTimer); }
    }, [visibleLayers.parkingMeters, visibleLayers.trafficSpeed, plotParkingMeters, onMapViewChange]);

    // Manage Layer Visibility
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        Object.entries(visibleLayers).forEach(([key, isVisible]) => {
            const layer = layersRef.current[key];
            if (layer) {
                if (isVisible && !map.hasLayer(layer)) {
                    map.addLayer(layer);
                     // If traffic layer is added and no data has been fetched, fetch it.
                    if (key === 'trafficSpeed' && roadNetworkData.length === 0) {
                        onMapViewChange(map.getBounds());
                    }
                }
                else if (!isVisible && map.hasLayer(layer)) map.removeLayer(layer);
            }
        });
        if(visibleLayers.parkingMeters) plotParkingMeters();
    }, [visibleLayers, plotParkingMeters, onMapViewChange, roadNetworkData.length]);

    // Navigation mode effect
    useEffect(() => {
        if (currentRoute) {
            positionWatchIdRef.current = navigator.geolocation.watchPosition(
                position => {
                    const userLatLng = L.latLng(position.coords.latitude, position.coords.longitude);
                     if (userLocationMarkerRef.current) userLocationMarkerRef.current.setLatLng(userLatLng);
                    checkProximityAlerts(userLatLng);
                    
                    // Fix: The IRoute.waypoints property has inconsistent type definitions.
                    // Using the last coordinate from IRoute.coordinates is a more reliable way to get the destination LatLng.
                    const destination = currentRoute.coordinates[currentRoute.coordinates.length - 1];
                    if(destination && userLatLng.distanceTo(destination) < 50) {
                        showNotification(t.arrived, true);
                        stopNavigation();
                    }
                },
                console.error,
                { enableHighAccuracy: true }
            );
        }
        return () => {
            if (positionWatchIdRef.current !== null) navigator.geolocation.clearWatch(positionWatchIdRef.current);
        };
    }, [currentRoute, stopNavigation, checkProximityAlerts, t.arrived, showNotification]);

    return (
        <>
            <div ref={mapContainerRef} className="h-full w-full z-0" />
            {currentRoute && <RoutePanel route={currentRoute} onStop={stopNavigation} language={language} />}
            {notification && <NavigationNotification message={notification} onDismiss={() => setNotification('')} />}
        </>
    );
};