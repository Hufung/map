import type { GeoJSON } from 'leaflet';

// General Types
export type Language = 'en_US' | 'zh_TW' | 'zh_CN';

export interface VisibleLayers {
    carparks: boolean;
    attractions: boolean;
    viewingPoints: boolean;

    parkingMeters: boolean;
    permits: boolean;
    prohibitions: boolean;
    trafficSpeed: boolean;
}

// Car Park Types
export interface Carpark {
    park_Id: string;
    name: string;
    displayAddress: string;
    latitude: number;
    longitude: number;
    privateCar?: {
        hourlyCharges?: Array<{
            price: number;
            remark: string;
            weekdays: string[];
            periodStart: string;
            periodEnd: string;
        }>;
    };
    heightLimits?: Array<{
        height: number;
        remark: string;
    }>;
    opening_status: string;
    vacancyData: CarparkVacancy | null;
}

export interface CarparkVacancy {
    park_Id: string;
    privateCar?: Array<{ vacancy: number | string }>;
    motorCycle?: Array<{ vacancy: number | string }>;
    LGV?: Array<{ vacancy: number | string }>;
    HGV?: Array<{ vacancy: number | string }>;
    coach?: Array<{ vacancy: number | string }>;
}

// Attraction Types
export interface AttractionProperties {
    NAME_EN: string;
    NAME_CH: string;
    LOCATION_EN: string;
    LOCATION_CH: string;
    WEBSITE: string;
}
export type AttractionFeature = GeoJSON.Feature<GeoJSON.Point, AttractionProperties>;


// Viewing Point Types
export interface ViewingPointProperties {
    Name_Eng: string;
    Name_Chi: string;
    Address_En: string;
    Address_Chi: string;
    CP_Eng: string;
    CP_Chi: string;
}
export type ViewingPointFeature = GeoJSON.Feature<GeoJSON.Point, ViewingPointProperties>;


// Parking Meter Types
export interface ParkingMeterProperties {
    Street: string;
    Street_tc: string;
    Street_sc: string;
    SectionOfStreet: string;
    SectionOfStreet_tc: string;
    SectionOfStreet_sc: string;
    ParkingSpaceId: string;
    VehicleType: string;
    OperatingPeriod: string;
}
export type ParkingMeterFeature = GeoJSON.Feature<GeoJSON.Point, ParkingMeterProperties>;

export interface ParkingMeterStatus {
    [key: string]: string; // parkingSpaceId: 'V' | 'O'
}

export interface GroupedParkingMeter {
    latLng: [number, number];
    street: string;
    section: string;
    totalCount: number;
    availableCount: number;
    occupiedCount: number;
    vehicleTypes: Set<string>;
    opPeriods: Set<string>;
}


// Turn Restriction Types
export interface TurnRestrictionProperties {
    name: string;
    description: string;
}
export type TurnRestrictionFeature = GeoJSON.Feature<GeoJSON.Point, TurnRestrictionProperties>;


// Traffic Feature Types
export interface TrafficFeatureProperties {
    GmlID: string;
    OBJECTID: number;
    FEATURE_TYPE: 1 | 2 | 3 | 4; // 1=斑馬線, 2=黃色盒子, 3=收費, 4=盡頭路
    FEATURE_ID: number;
}
export type TrafficFeature = GeoJSON.Feature<GeoJSON.Point, TrafficFeatureProperties>;

// Permit Types
export interface PermitProperties {
    GmlID: string;
    OBJECTID: number;
    PERMIT_ID: number;
    REMARKS: string;
}
export type PermitFeature = GeoJSON.Feature<GeoJSON.Point, PermitProperties>;

// Prohibition Types
export interface ProhibitionProperties {
    GmlID: string;
    OBJECTID: number;
    PROHIBITION_ID: number;
    EXC_VEH_TYPE: 'PC' | 'ALL' | string;
    REMARKS: string;
}
export type ProhibitionFeature = GeoJSON.Feature<GeoJSON.Point, ProhibitionProperties>;

// Road Network and Traffic Speed Types
export interface RoadNetworkProperties {
    ROUTE_ID: string;
    ROAD_NAME_CHI: string;
    ROAD_NAME_ENG: string;
}
export type RoadNetworkFeature = GeoJSON.Feature<GeoJSON.LineString | GeoJSON.MultiLineString, RoadNetworkProperties>;

export interface TrafficSpeedInfo {
    [routeId: string]: {
        speed: number;
        reliability: number; // 1: smooth, 2: slow, 3: congested
    };
}