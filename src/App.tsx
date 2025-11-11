
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import L, { type Map as LeafletMap, LatLngBounds } from 'leaflet';
import type { 
    Carpark, 
    AttractionFeature, 
    ViewingPointFeature, 
    EVChargerFeature,
    TurnRestrictionFeature, 
    PermitFeature,
    ProhibitionFeature,
    RoadNetworkFeature,
    TrafficSpeedInfo,
    Language,
    VisibleLayers,
    OilStation,
    ToiletFeature,
    OilPriceData
} from './types';
import { 
    fetchCarparkData, 
    fetchAttractionsData, 
    fetchViewingPointsData, 
    fetchEVChargerData,
    fetchInitialParkingMeterStatus,
    fetchTurnRestrictionsData,
    fetchPermitData,
    fetchProhibitionData,
    fetchRoadNetworkData,
    fetchTrafficSpeedData,
    fetchOilStationsData,
    fetchOilPriceData,
} from './services/dataService';

import { MapComponent } from './components/MapComponent';
import { Header } from './components/Header';
import { LayerControl } from './components/LayerControl';
import { InfoModal } from './components/InfoModal';
import { LoadingSpinner } from './components/LoadingSpinner';
import { Legend } from './components/Legend';
import { OilPricePanel } from './components/OilPricePanel';
import { i18n } from './constants';

const TILE_FETCH_THRESHOLD = 0.1; // degrees. If bounds are larger, subdivide.

const subdivideBounds = (bounds: LatLngBounds): LatLngBounds[] => {
    const north = bounds.getNorth();
    const south = bounds.getSouth();
    const east = bounds.getEast();
    const west = bounds.getWest();

    const midLat = (north + south) / 2;
    const midLng = (east + west) / 2;

    // NW, NE, SW, SE
    return [
        L.latLngBounds(L.latLng(midLat, west), L.latLng(north, midLng)),
        L.latLngBounds(L.latLng(midLat, midLng), L.latLng(north, east)),
        L.latLngBounds(L.latLng(south, west), L.latLng(midLat, midLng)),
        L.latLngBounds(L.latLng(south, midLng), L.latLng(midLat, east)),
    ];
};


const App: React.FC = () => {
    const [map, setMap] = useState<LeafletMap | null>(null);
    const [language, setLanguage] = useState<Language>('en_US');
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [carparkData, setCarparkData] = useState<Carpark[]>([]);
    const [attractionsData, setAttractionsData] = useState<AttractionFeature[]>([]);
    const [viewingPointsData, setViewingPointsData] = useState<ViewingPointFeature[]>([]);
    const [evChargerData, setEVChargerData] = useState<EVChargerFeature[]>([]);
    const [turnRestrictionsData, setTurnRestrictionsData] = useState<TurnRestrictionFeature[]>([]);
    const [permitData, setPermitData] = useState<PermitFeature[]>([]);
    const [prohibitionData, setProhibitionData] = useState<ProhibitionFeature[]>([]);
    const [roadNetworkData, setRoadNetworkData] = useState<RoadNetworkFeature[]>([]);
    const [trafficSpeedData, setTrafficSpeedData] = useState<TrafficSpeedInfo>({});
    const [oilStationData, setOilStationData] = useState<OilStation[]>([]);
    const [oilPriceData, setOilPriceData] = useState<OilPriceData>(new Map());
    const [navigationTarget, setNavigationTarget] = useState<{lat: number, lon: number} | null>(null);
    const fetchedRoadsRef = useRef(new Set<string>());
    const isFetchingRoadsRef = useRef(false);

    const [searchQuery, setSearchQuery] = useState<string>('');
    const [searchResultBounds, setSearchResultBounds] = useState<L.LatLngBounds | null>(null);

    const [visibleLayers, setVisibleLayers] = useState<VisibleLayers>({
        carparks: true,
        attractions: false,
        viewingPoints: false,
        evChargers: false,
        parkingMeters: false,
        oilStations: true,
        permits: true,
        prohibitions: true,
        trafficSpeed: false,
        turnRestrictions: false,
        trafficFeatures: false,
        toilets: false,
    });
    
    const [selectedCarpark, setSelectedCarpark] = useState<Carpark | null>(null);

    const handleLanguageChange = (lang: Language) => {
        setIsLoading(true);
        setLanguage(lang);
    };

    const loadInitialData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [
                carparks,
                attractions, 
                viewingPoints,
                evChargers,
                turnRestrictions,
                permits,
                prohibitions,
                trafficSpeeds,
                oilStations,
                oilPrices
            ] = await Promise.all([
                fetchCarparkData(language),
                fetchAttractionsData(),
                fetchViewingPointsData(),
                fetchEVChargerData(),
                fetchTurnRestrictionsData(),
                fetchPermitData(),
                fetchProhibitionData(),
                fetchTrafficSpeedData(),
                fetchOilStationsData(language),
                fetchOilPriceData(),
                fetchInitialParkingMeterStatus() // Fetches and caches status
            ]);

            setCarparkData(carparks);
            setAttractionsData(attractions);
            setViewingPointsData(viewingPoints);
            setEVChargerData(evChargers);
            setTurnRestrictionsData(turnRestrictions);
            setPermitData(permits);
            setProhibitionData(prohibitions);
            setTrafficSpeedData(trafficSpeeds);
            setOilStationData(oilStations);
            setOilPriceData(oilPrices);
            
        } catch (error) {
            console.error("Failed to load initial data:", error);
        } finally {
            setIsLoading(false);
        }
    }, [language]);

    useEffect(() => {
        loadInitialData();
    }, [loadInitialData]);
    
    useEffect(() => {
        const intervalId = setInterval(async () => {
            try {
                const speeds = await fetchTrafficSpeedData();
                setTrafficSpeedData(speeds);
            } catch (error) {
                console.error("Failed to refresh traffic speed data:", error);
            }
        }, 60000); // Refresh every 60 seconds

        return () => clearInterval(intervalId);
    }, []);

    const handleSearch = (query: string) => {
        setSearchQuery(query);
        if (!query) {
            setSearchResultBounds(null);
            return;
        }

        const results = carparkData.filter(cp =>
            (cp.name && cp.name.toLowerCase().includes(query.toLowerCase())) ||
            (cp.displayAddress && cp.displayAddress.toLowerCase().includes(query.toLowerCase()))
        );

        if (results.length > 0) {
            const bounds = L.latLngBounds(results.map(cp => [cp.latitude, cp.longitude]));
            setSearchResultBounds(bounds);
        } else {
            setSearchResultBounds(null);
            alert(i18n[language].noResults);
        }
    };

    const displayedCarparks = useMemo(() => {
        if (!searchQuery) {
            return carparkData;
        }
        return carparkData.filter(cp =>
            (cp.name && cp.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (cp.displayAddress && cp.displayAddress.toLowerCase().includes(searchQuery.toLowerCase()))
        );
    }, [searchQuery, carparkData]);


    const handleMapViewChange = useCallback(async (bounds: LatLngBounds) => {
        if (!bounds || isFetchingRoadsRef.current) return;
    
        isFetchingRoadsRef.current = true;
        try {
            const boundsToFetch: LatLngBounds[] = [];
            const width = bounds.getEast() - bounds.getWest();
            const height = bounds.getNorth() - bounds.getSouth();
    
            if (width > TILE_FETCH_THRESHOLD || height > TILE_FETCH_THRESHOLD) {
                boundsToFetch.push(...subdivideBounds(bounds));
            } else {
                boundsToFetch.push(bounds);
            }
    
            const fetchPromises = boundsToFetch.map(b => fetchRoadNetworkData(b));
            const results = await Promise.allSettled(fetchPromises);
            
            const allNewFeatures: RoadNetworkFeature[] = [];
            results.forEach(result => {
                if (result.status === 'fulfilled') {
                    allNewFeatures.push(...result.value);
                } else {
                    console.error("A road network tile failed to load:", result.reason);
                }
            });
    
            const uniqueNewFeatures = allNewFeatures.filter(feature => {
                if (feature.properties?.ROUTE_ID) {
                    const routeId = String(feature.properties.ROUTE_ID);
                     if (!fetchedRoadsRef.current.has(routeId)) {
                        fetchedRoadsRef.current.add(routeId);
                        return true;
                    }
                }
                return false;
            });
            
            if (uniqueNewFeatures.length > 0) {
                setRoadNetworkData(prevData => [...prevData, ...uniqueNewFeatures]);
            }
        } catch (error) {
            console.error("An unexpected error occurred in handleMapViewChange:", error);
        } finally {
            isFetchingRoadsRef.current = false;
        }
    }, []);

    const handleMarkerClick = useCallback((carpark: Carpark) => {
        setSelectedCarpark(carpark);
    }, []);

    const handleCloseModal = () => {
        setSelectedCarpark(null);
    };

    const handleStartNavigation = useCallback((lat: number, lon: number) => {
        setNavigationTarget({ lat, lon });
    }, []);

    const handleNavigationStarted = useCallback(() => {
        setNavigationTarget(null); // Reset trigger
    }, []);
    
    return (
        <div className="font-sans antialiased relative overflow-hidden w-screen h-screen">
            <Header
                language={language}
                onLanguageChange={handleLanguageChange}
                onLocateUser={() => map?.locate({ setView: true, maxZoom: 16 })}
                onSearch={handleSearch}
            />
            <LayerControl
                language={language}
                visibleLayers={visibleLayers}
                onVisibilityChange={setVisibleLayers}
            />
            <Legend language={language} />
            <OilPricePanel language={language} oilPriceData={oilPriceData} />
            
            <MapComponent
                setMap={setMap}
                language={language}
                visibleLayers={visibleLayers}
                carparkData={displayedCarparks}
                attractionsData={attractionsData}
                viewingPointsData={viewingPointsData}
                evChargerData={evChargerData}
                turnRestrictionsData={turnRestrictionsData}
                permitData={permitData}
                prohibitionData={prohibitionData}
                roadNetworkData={roadNetworkData}
                trafficSpeedData={trafficSpeedData}
                oilStationData={oilStationData}
                oilPriceData={oilPriceData}
                onMarkerClick={handleMarkerClick}
                navigationTarget={navigationTarget}
                onNavigationStarted={handleNavigationStarted}
                onMapViewChange={handleMapViewChange}
                searchResultBounds={searchResultBounds}
            />
            
            {isLoading && <LoadingSpinner language={language} />}
            
            {selectedCarpark && (
                <InfoModal
                    carpark={selectedCarpark}
                    language={language}
                    onClose={handleCloseModal}
                    onNavigate={handleStartNavigation}
                />
            )}
        </div>
    );
};

export default App;