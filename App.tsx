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
    TrafficSpeedInfo,
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
    fetchRoadNetworkData,
    fetchTrafficSpeedData,
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
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [carparkData, setCarparkData] = useState<Carpark[]>([]);
    const [attractionsData, setAttractionsData] = useState<AttractionFeature[]>([]);
    const [viewingPointsData, setViewingPointsData] = useState<ViewingPointFeature[]>([]);
    const [turnRestrictionsData, setTurnRestrictionsData] = useState<TurnRestrictionFeature[]>([]);
    const [permitData, setPermitData] = useState<PermitFeature[]>([]);
    const [prohibitionData, setProhibitionData] = useState<ProhibitionFeature[]>([]);
    const [roadNetworkData, setRoadNetworkData] = useState<RoadNetworkFeature[]>([]);
    const [trafficSpeedData, setTrafficSpeedData] = useState<TrafficSpeedInfo>({});
    const [navigationTarget, setNavigationTarget] = useState<{lat: number, lon: number} | null>(null);

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
        setIsLoading(true);
        try {
            const [
                carparks,
                attractions, 
                viewingPoints,
                turnRestrictions,
                permits,
                prohibitions,
                roadNetwork,
                trafficSpeeds
            ] = await Promise.all([
                fetchCarparkData(language),
                fetchAttractionsData(),
                fetchViewingPointsData(),
                fetchTurnRestrictionsData(),
                fetchPermitData(),
                fetchProhibitionData(),
                fetchRoadNetworkData(),
                fetchTrafficSpeedData(),
                fetchInitialParkingMeterStatus() // Fetches and caches status
            ]);

            setCarparkData(carparks);
            setAttractionsData(attractions);
            setViewingPointsData(viewingPoints);
            setTurnRestrictionsData(turnRestrictions);
            setPermitData(permits);
            setProhibitionData(prohibitions);
            setRoadNetworkData(roadNetwork);
            setTrafficSpeedData(trafficSpeeds);
            
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
                onVisibilityChange={setVisibleLayers}
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
                roadNetworkData={roadNetworkData}
                trafficSpeedData={trafficSpeedData}
                onMarkerClick={handleMarkerClick}
                navigationTarget={navigationTarget}
                onNavigationStarted={handleNavigationStarted}
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