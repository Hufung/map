
import React, { useState, useEffect, useCallback } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import type { 
    Carpark, 
    AttractionFeature, 
    ViewingPointFeature, 
    TurnRestrictionFeature, 
    PermitFeature,
    ProhibitionFeature,
    RoadNetworkFeature,
    Language,
    VisibleLayers
} from './types';
import { 
    fetchCarparkData, 
    fetchAttractionsData, 
    fetchViewingPointsData, 
    fetchInitialParkingMeterStatus,
    fetchTurnRestrictionsData,
    fetchPermitData,
    fetchProhibitionData,
    fetchRoadNetworkGeometry,
    fetchTrafficSpeedData
} from './services/dataService';

import { MapComponent } from './components/MapComponent';
import { Header } from './components/Header';
import { LayerControl } from './components/LayerControl';
import { InfoModal } from './components/InfoModal';
import { LoadingSpinner } from './components/LoadingSpinner';
import { Legend } from './components/Legend';

const App: React.FC = () => {
    const [map, setMap] = useState<LeafletMap | null>(null);
    const [language, setLanguage] = useState<Language>('en_US');
    const [isLoading, setIsLoading] = useState<boolean>(false); // Changed: Prioritize map load, no initial spinner.
    const [carparkData, setCarparkData] = useState<Carpark[]>([]);
    const [attractionsData, setAttractionsData] = useState<AttractionFeature[]>([]);
    const [viewingPointsData, setViewingPointsData] = useState<ViewingPointFeature[]>([]);
    const [turnRestrictionsData, setTurnRestrictionsData] = useState<TurnRestrictionFeature[]>([]);
    const [permitData, setPermitData] = useState<PermitFeature[]>([]);
    const [prohibitionData, setProhibitionData] = useState<ProhibitionFeature[]>([]);
    const [roadNetworkGeometry, setRoadNetworkGeometry] = useState<RoadNetworkFeature[]>([]);
    const [trafficSpeedData, setTrafficSpeedData] = useState<Map<string, number>>(new Map());
    const [navigationTarget, setNavigationTarget] = useState<{lat: number, lon: number} | null>(null);
    const [dataCache, setDataCache] = useState({ attractions: false, viewingPoints: false });
    const [trafficLayerError, setTrafficLayerError] = useState<boolean>(false);
    const [isTrafficLayerLoading, setIsTrafficLayerLoading] = useState<boolean>(false);


    const [visibleLayers, setVisibleLayers] = useState<VisibleLayers>({
        carparks: true,
        attractions: false,
        viewingPoints: false,
        parkingMeters: false,
        permits: true,
        prohibitions: true,
        trafficSpeed: false,
    });
    
    const [selectedCarpark, setSelectedCarpark] = useState<Carpark | null>(null);

    const handleLanguageChange = (lang: Language) => {
        setIsLoading(true);
        setLanguage(lang);
    };

    const loadInitialData = useCallback(async () => {
        // Load essential data in the background without a full-screen spinner on first load.
        // The spinner will still be used for language changes.
        try {
            const [
                carparks,
                permits,
                prohibitions,
                trafficSpeed
            ] = await Promise.all([
                fetchCarparkData(language),
                fetchPermitData(),
                fetchProhibitionData(),
                fetchTrafficSpeedData(),
                fetchInitialParkingMeterStatus()
            ]);

            setCarparkData(carparks);
            setPermitData(permits);
            setProhibitionData(prohibitions);
            setTrafficSpeedData(trafficSpeed);
            
        } catch (error) {
            console.error("Failed to load essential initial data:", error);
        }

        // Load fallible data (KMZ via CORS) separately
        try {
            const turnRestrictions = await fetchTurnRestrictionsData();
            setTurnRestrictionsData(turnRestrictions);
        } catch (error) {
            console.error("Could not load Turn Restrictions, layer will be empty.", error);
        }
        
        setIsLoading(false); // Stops spinner after a language change. No-op on initial load.
    }, [language]);


    const loadRoadNetwork = useCallback(async () => {
        // Prevent re-fetching if already loaded or currently loading
        if (roadNetworkGeometry.length > 0 || isTrafficLayerLoading) return;
    
        setIsTrafficLayerLoading(true);
        setTrafficLayerError(false);
        setRoadNetworkGeometry([]); // Clear previous data on retry
    
        try {
            // fetchRoadNetworkGeometry now accepts a callback to stream chunks of data
            await fetchRoadNetworkGeometry((chunk) => {
                setRoadNetworkGeometry(prev => [...prev, ...chunk]);
            });
        } catch (error) {
            console.error("Failed to load road network geometry:", error);
            setTrafficLayerError(true);
            setRoadNetworkGeometry([]); // Clear any partial data on error
        } finally {
            setIsTrafficLayerLoading(false);
        }
    }, [roadNetworkGeometry.length, isTrafficLayerLoading]);
    
    const retryLoadRoadNetwork = useCallback(() => {
        loadRoadNetwork();
    }, [loadRoadNetwork]);


    useEffect(() => {
        loadInitialData();
    }, [loadInitialData]);

    // Fetch traffic speed data every minute
    useEffect(() => {
        const intervalId = setInterval(async () => {
            try {
                const speedData = await fetchTrafficSpeedData();
                setTrafficSpeedData(speedData);
            } catch (error) {
                console.error("Failed to refresh traffic speed data:", error);
            }
        }, 60000); // 60 seconds

        return () => clearInterval(intervalId);
    }, []);

    const handleVisibilityChange = async (newVisibility: VisibleLayers) => {
        setVisibleLayers(newVisibility);
    
        if (newVisibility.trafficSpeed) {
            loadRoadNetwork();
        }
        
        // Lazy load attractions
        if (newVisibility.attractions && !dataCache.attractions) {
            setIsLoading(true);
            try {
                const attractions = await fetchAttractionsData();
                setAttractionsData(attractions);
                setDataCache(prev => ({ ...prev, attractions: true }));
            } catch (error) {
                console.error("Failed to lazy load attractions data:", error);
                setVisibleLayers(prev => ({ ...prev, attractions: false })); // Revert on error
            } finally {
                setIsLoading(false);
            }
        }
    
        // Lazy load viewing points
        if (newVisibility.viewingPoints && !dataCache.viewingPoints) {
            setIsLoading(true);
            try {
                const viewingPoints = await fetchViewingPointsData();
                setViewingPointsData(viewingPoints);
                setDataCache(prev => ({ ...prev, viewingPoints: true }));
            } catch (error) {
                console.error("Failed to lazy load viewing points data:", error);
                setVisibleLayers(prev => ({ ...prev, viewingPoints: false })); // Revert on error
            } finally {
                setIsLoading(false);
            }
        }
    };


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
            />
            <LayerControl
                language={language}
                visibleLayers={visibleLayers}
                onVisibilityChange={handleVisibilityChange}
                trafficLayerError={trafficLayerError}
                onRetryLoadRoadNetwork={retryLoadRoadNetwork}
                isTrafficLoading={isTrafficLayerLoading}
            />
            <Legend language={language} />
            
            <MapComponent
                setMap={setMap}
                language={language}
                visibleLayers={visibleLayers}
                carparkData={carparkData}
                attractionsData={attractionsData}
                viewingPointsData={viewingPointsData}
                turnRestrictionsData={turnRestrictionsData}
                permitData={permitData}
                prohibitionData={prohibitionData}
                roadNetworkGeometry={roadNetworkGeometry}
                trafficSpeedData={trafficSpeedData}
                onMarkerClick={handleMarkerClick}
                navigationTarget={navigationTarget}
                onNavigationStarted={handleNavigationStarted}
            />
            
            {isLoading && <LoadingSpinner />}
            
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
