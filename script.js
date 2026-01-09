// --- APPLICATION SCRIPT ---

// Fix for default Leaflet icon path issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// -------------------------------------------------
// 1. STATE & CONSTANTS
// -------------------------------------------------

const appState = {
    map: null,
    language: 'en_US',
    isLoading: true,
    carparkData: [],
    attractionsData: [],
    viewingPointsData: [],
    evChargerData: [],
    turnRestrictionsData: [],
    permitData: [],
    prohibitionData: [],
    roadNetworkData: [],
    trafficSpeedData: {},
    oilStationData: [],
    oilPriceData: new Map(),
    genuineRetailersData: [],
    retailerCategories: new Set(),
    selectedRetailerCategories: new Set(),
    retailerData: [],
    dloBoundaryData: [],

    searchQuery: '',
    visibleLayers: {
        carparks: true, attractions: false, viewingPoints: false,
        evChargers: false, parkingMeters: false, oilStations: true,
        permits: true, prohibitions: true, trafficSpeed: false,
        turnRestrictions: false, trafficFeatures: false, toilets: false,
        genuineRetailers: false, placeNames: true, dloBoundary: true,
    },
    layers: {},
    roadLayers: new Map(),
    routingControl: null,
    positionWatchId: null,
    warnedFeatures: new Set(),
    isFetchingRoads: false,
    userLocationMarker: null,
    apiStatus: {
        carparks: 'unknown',
        attractions: 'unknown',
        viewingPoints: 'unknown',
        evChargers: 'unknown',
        oilStations: 'unknown',
        oilPrices: 'unknown'
    }
};

const TILE_FETCH_THRESHOLD = 0.1;

// Multiple CORS proxy options for fallback
const CORS_PROXIES = [
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?',
    'https://cors-anywhere.herokuapp.com/'
];

// API endpoints
const API_INFO_BASE_URL = 'https://api.data.gov.hk/v1/carpark-info-vacancy?data=info';
const API_VACANCY_BASE_URL = 'https://api.data.gov.hk/v1/carpark-info-vacancy?data=vacancy';
const API_ATTRACTIONS_URL = 'https://portal.csdi.gov.hk/server/services/common/afcd_rcd_1728896853370_57183/MapServer/WFSServer?service=wfs&request=GetFeature&typenames=Attractions_in_Country_Parks&outputFormat=geojson';
const API_VIEWING_POINTS_URL = 'https://portal.csdi.gov.hk/server/services/common/afcd_rcd_1635142967951_6079/MapServer/WFSServer?service=wfs&request=GetFeature&typenames=Viewing_Point&outputFormat=geojson&maxFeatures=100';
const API_EV_CHARGERS_URL = 'https://portal.csdi.gov.hk/server/services/common/epd_rcd_1631080339740_69941/MapServer/WFSServer?service=wfs&request=GetFeature&typenames=geotagging&outputFormat=geojson';
const API_PARKING_METERS_BASE_URL = 'https://portal.csdi.gov.hk/server/services/common/td_rcd_1638930345315_81787/MapServer/WFSServer?service=wfs&request=GetFeature&typenames=parkingspaces&outputFormat=geojson&srsName=EPSG:4326';
const API_PARKING_METERS_STATUS_URL = 'https://resource.data.one.gov.hk/td/psiparkingspaces/occupancystatus/occupancystatus.csv';
const API_TURN_RESTRICTIONS_URL = 'https://static.data.gov.hk/td/road-network-v2/TURN.kmz';
const API_TRAFFIC_FEATURES_BASE_URL = 'https://portal.csdi.gov.hk/server/services/common/td_rcd_1638949160594_2844/MapServer/WFSServer?service=wfs&request=GetFeature&typenames=TRAFFIC_FEATURES&outputFormat=geojson&maxFeatures=1000&srsName=EPSG:4326';
const API_PERMIT_URL = 'https://portal.csdi.gov.hk/server/services/common/td_rcd_1638949160594_2844/MapServer/WFSServer?service=wfs&request=GetFeature&typenames=PERMIT&outputFormat=geojson';
const API_PROHIBITION_PC_URL = 'https://portal.csdi.gov.hk/server/services/common/td_rcd_1638949160594_2844/MapServer/WFSServer?service=wfs&request=GetFeature&typenames=PROHIBITION&outputFormat=geojson&filter=<Filter><PropertyIsEqualTo><PropertyName>EXC_VEH_TYPE</PropertyName><Literal>PC</Literal></PropertyIsEqualTo></Filter>';
const API_PROHIBITION_ALL_URL = 'https://portal.csdi.gov.hk/server/services/common/td_rcd_1638949160594_2844/MapServer/WFSServer?service=wfs&request=GetFeature&typenames=PROHIBITION&outputFormat=geojson&filter=<Filter><PropertyIsEqualTo><PropertyName>EXC_VEH_TYPE</PropertyName><Literal>ALL</Literal></PropertyIsEqualTo></Filter>';
const API_ROAD_NETWORK_URL = 'https://portal.csdi.gov.hk/server/services/common/td_rcd_1638949160594_2844/MapServer/WFSServer?service=wfs&request=GetFeature&typenames=CENTERLINE&outputFormat=geojson';
const API_TRAFFIC_SPEED_URL = 'https://resource.data.one.gov.hk/td/traffic-detectors/irnAvgSpeed-all.xml';
const API_OIL_STATIONS_URL = 'https://hufung.github.io/data/stations.csv';
const API_OIL_PRICES_URL = 'https://www.consumer.org.hk/pricewatch/oilwatch/opendata/oilprice.json';
const API_TOILETS_FEHD_URL = 'https://portal.csdi.gov.hk/server/services/common/fehd_rcd_1629969687926_30590/MapServer/WFSServer?service=wfs&request=GetFeature&typenames=FEHD_FACI&outputFormat=geojson';
const API_TOILETS_AFCD_URL = 'https://portal.csdi.gov.hk/server/services/common/afcd_rcd_1635136427551_29173/MapServer/WFSServer?service=wfs&request=GetFeature&typenames=Toilets&outputFormat=geojson';
const API_DLO_BOUNDARY_URL = 'https://portal.csdi.gov.hk/server/services/common/landsd_rcd_1631604711900_51558/MapServer/WFSServer?service=wfs&request=GetFeature&outputFormat=GEOJSON&typename=DLOBoundary';
const API_GENUINE_RETAILERS_URL = 'https://portal.csdi.gov.hk/server/services/common/ipd_rcd_1728898210576_79568/MapServer/WFSServer?service=wfs&request=GetFeature&typenames=geotagging&outputFormat=geojson&srsName=EPSG:4326';


const i18n = { 
    'en_US': { 
        modalTitle: 'Car Park Details', address: 'Address', parkId: 'Park ID', status: 'Status', 
        vacancy: 'Vacancy', vac_car: 'Vacancy (Car)', vac_moto: 'Vacancy (Motorcycle)', 
        vac_lgv: 'Vacancy (LGV)', vac_hgv: 'Vacancy (HGV)', vac_coach: 'Vacancy (Coach)', 
        price_car: 'Hourly Price (Car)', heightLimit: 'Height Limit', remarks: 'Remarks', 
        notAvailable: 'N/A', noVacancyData: 'No vacancy data available', errorTitle: 'Error', 
        errorBody: 'Could not load car park data. Please try again later.', 
        toggleCarParks: 'Car Parks', toggleAttractions: 'Park Attractions', 
        toggleViewingPoints: 'Viewing Points', toggleEVChargers: 'EV Chargers', 
        toggleParkingMeters: 'Parking Meters', toggleOilStations: 'Oil Stations', 
        togglePermits: 'Permits', toggleProhibitions: 'Prohibitions', 
        toggleTrafficSpeed: 'Traffic Speed', toggleTurnRestrictions: 'Turn Restrictions', 
        toggleTrafficFeatures: 'Traffic Features', toggleToilets: 'Toilets', 
        website: 'Website', countryPark: 'Country Park', street: 'Street', 
        sectionOfStreet: 'Section', vehicleType: 'Vehicle Type', 
        operatingPeriod: 'Operating Period', totalMeters: 'Total Meters', 
        availableMeters: 'Available', occupiedMeters: 'Occupied', 
        userLocationPopup: 'You are within {accuracy} meters of this point.', 
        navigate: 'Navigate', stopNavigation: 'Stop Navigation', 
        navigationError: 'Could not calculate route.', locationError: 'Could not find your location.', 
        zebraCrossing: 'Zebra Crossing Ahead', yellowBox: 'Yellow Box Junction Ahead', 
        tollPlaza: 'Toll Plaza Ahead', culDeSac: 'Cul-de-sac (No Through Road) Ahead', 
        turnRestrictionWarning: 'Warning: Turn restriction ahead', arrived: 'You have arrived at your destination.', 
        legendTitle: 'Legend', legendCarPark: 'Car Park', legendAttraction: 'Park Attraction', 
        legendViewingPoint: 'Viewing Point', legendEVCharger: 'EV Charger', 
        legendParkingMeter: 'Parking Meter', legendOilStation: 'Oil Station', 
        legendTurnRestriction: 'Turn Restriction', legendZebraCrossing: 'Zebra Crossing', 
        legendYellowBox: 'Yellow Box', legendTollPlaza: 'Toll Plaza', legendCulDeSac: 'Cul-de-sac', 
        legendPermit: 'Permit', legendProhibition: 'Prohibition Zone', legendToilet: 'Toilet', 
        legendTrafficSmooth: 'Smooth Traffic', legendTrafficSlow: 'Slow Traffic', 
        legendTrafficCongested: 'Congested Traffic', charger_types: 'Charger Types', 
        diesel: 'Diesel', super: 'Super', premium: 'Premium', lpg: 'LPG', 
        fuelsAvailable: 'Fuels Available', fuelPricesTitle: 'Fuel Prices', company: 'Company', 
        retailers: 'Retailers', telephone: 'Tel', locateBtn: 'Locate', 
        layersTitle: 'Layers', legendTitle: 'Legend', 
        retailerCategoriesTitle: 'Retailer Categories', routeTitle: 'Route', 
        vehicle_A: 'Any Vehicles (other than Medium and Heavy Goods Vehicles, Buses, Motor Cycles and Pedal Cycles)', 
        vehicle_C: 'Coaches', vehicle_G: 'Goods Vehicles', 
        op_F: '08.00 am - 09.00 pm daily', op_N: '07.00 pm - Midnight daily', 
        op_P: '08.00 am - 08.00 pm daily on Mondays to Saturdays (no parking on Sundays)', 
        op_D: '08.00 am - Midnight on Mondays to Saturdays; 10.00 am - 10.00 pm on Sundays and public holidays', 
        op_S: 'No parking on 08.00 am - 05.00 pm daily on Mondays to Fridays; 05.00 pm - Midnight daily on Mondays to Fridays; 08.00 am - Midnight daily on Saturdays; 10.00 am - 10.00 pm daily on Sundays and public holidays', 
        op_H: '08:00 am - 08:00 pm daily', op_E: '07:00 am - 08:00 pm daily', 
        op_Q: '08:00 am - 08:00 pm daily on Mondays to Saturdays; 10:00 am - 10:00 pm daily on Sundays and public holidays', 
        op_J: '08:00 am - Midnight daily', op_A: '08:00 am - Midnight on Mondays to Saturdays (except Sundays and public holidays)', 
        op_B: '08:00 am - 08:00 pm daily on Mondays to Saturdays (except Sundays and public holidays)', 
        unknown: 'Unknown', avgSpeed: 'Avg Speed', routeId: 'Route ID', 
        initialLoadMessage: 'First time loading may take a moment, please wait...', 
        searchPlaceholder: 'Search car parks by name/address...', 
        noResults: 'No car parks found matching your search.',
        apiStatusChecking: 'Checking APIs...',
        apiStatusOnline: 'APIs Online',
        apiStatusOffline: 'Some APIs Offline',
        apiStatusError: 'API Error'
    }, 
    'zh_TW': { 
        modalTitle: '停車場詳情', address: '地址', parkId: '停車場ID', status: '狀態', 
        vacancy: '空位', vac_car: '空位 (私家車)', vac_moto: '空位 (電單車)', 
        vac_lgv: '空位 (輕型貨車)', vac_hgv: '空位 (重型貨車)', vac_coach: '空位 (巴士)', 
        price_car: '每小時收費 (私家車)', heightLimit: '高度限制', remarks: '備註', 
        notAvailable: '沒有資料', noVacancyData: '沒有空位資料', errorTitle: '錯誤', 
        errorBody: '無法加載停車場資料，請稍後再試。', toggleCarParks: '停車場', 
        retailers: '零售商', telephone: '電話', locateBtn: '定位', 
        layersTitle: '圖層', fuelPricesTitle: '燃油價格', legendTitle: '圖例', 
        retailerCategoriesTitle: '零售商類別', routeTitle: '路線', 
        toggleAttractions: '郊野公園景點', toggleViewingPoints: '觀景台', 
        toggleEVChargers: '電動車充電站', toggleParkingMeters: '咪錶泊車位', 
        toggleOilStations: '油站', togglePermits: '許可證', toggleProhibitions: '禁區', 
        toggleTrafficSpeed: '交通速度', toggleTurnRestrictions: '轉向限制', 
        toggleTrafficFeatures: '交通設施', toggleToilets: '洗手間', website: '網站', 
        countryPark: '郊野公園', street: '街道', sectionOfStreet: '路段', 
        vehicleType: '車輛類別', operatingPeriod: '運作時段', totalMeters: '總車位數', 
        availableMeters: '空置', occupiedMeters: '已佔用', 
        userLocationPopup: '您在此地點 {accuracy} 米範圍內。', navigate: '導航', 
        stopNavigation: '停止導航', navigationError: '無法計算路線。', 
        locationError: '無法找到您的位置。', zebraCrossing: '前方斑馬線', 
        yellowBox: '前方黃色方格路口', tollPlaza: '前方收費廣場', culDeSac: '前方盡頭路', 
        turnRestrictionWarning: '警告：前方有轉向限制', arrived: '您已到達目的地。', 
        legendTitle: '圖例', legendCarPark: '停車場', legendAttraction: '郊野公園景點', 
        legendViewingPoint: '觀景台', legendEVCharger: '電動車充電站', 
        legendParkingMeter: '咪錶泊車位', legendOilStation: '油站', 
        legendTurnRestriction: '轉向限制', legendZebraCrossing: '斑馬線', 
        legendYellowBox: '黃色方格路口', legendTollPlaza: '收費廣場', legendCulDeSac: '盡頭路', 
        legendPermit: '許可證', legendProhibition: '禁區', legendToilet: '洗手間', 
        legendTrafficSmooth: '交通暢順', legendTrafficSlow: '交通緩慢', 
        legendTrafficCongested: '交通擠塞', charger_types: '充電器類型', 
        diesel: '柴油', super: '超級汽油', premium: '特級汽油', lpg: '石油氣', 
        fuelsAvailable: '提供燃料', fuelPricesTitle: '燃油價格', company: '公司', 
        vehicle_A: '任何車輛 (中型及重型貨車、巴士、電單車及機動三輪車除外)', 
        vehicle_C: '長途汽車', vehicle_G: '貨車', op_F: '每天上午 8 點至晚上 9 點', 
        op_N: '每天 07:00 - 午夜', op_P: '週一至週六每天上午 8:00 至晚上 8:00（週日禁止停車）', 
        op_D: '週一至週六上午 08:00 至午夜； 週日和公眾假期上午 10 點至晚上 10 點', 
        op_S: '週一至週五每天上午 8 點至下午 5 點禁止停車； 下午 05:00 - 週一至週五每天午夜； 週六每天上午 8 點至午夜； 週日和公眾假期每天上午 10 點至晚上 10 點', 
        op_H: '每天上午8時至晚上8時', op_E: '每天上午7時至晚上8時', 
        op_Q: '逢星期一至六上午8時至晚上8時；星期日及公眾假期上午10時至晚上10時', 
        op_J: '每天上午8時至午夜', op_A: '逢星期一至六上午8時至午夜 (星期日及公眾假期除外)', 
        op_B: '逢星期一至六上午8時至晚上8時 (星期日及公眾假期除外)', unknown: '不詳', 
        avgSpeed: '平均速度', routeId: '路線ID', 
        initialLoadMessage: '首次加載可能需要一些時間，請稍候...', 
        searchPlaceholder: '按名稱/地址搜尋停車場...', 
        noResults: '找不到符合您搜尋的停車場。',
        apiStatusChecking: '檢查API中...',
        apiStatusOnline: 'API在線',
        apiStatusOffline: '部分API離線',
        apiStatusError: 'API錯誤'
    }, 
    'zh_CN': { 
        modalTitle: '停车场详情', address: '地址', parkId: '停车场ID', status: '状态', 
        vacancy: '空位', vac_car: '空位 (私家车)', vac_moto: '空位 (摩托车)', 
        vac_lgv: '空位 (轻型货车)', vac_hgv: '空位 (重型货车)', vac_coach: '空位 (巴士)', 
        price_car: '每小时收费 (私家车)', heightLimit: '高度限制', remarks: '备注', 
        notAvailable: '没有资料', noVacancyData: '没有空位资料', errorTitle: '错误', 
        errorBody: '无法加载停车场资料，请稍后再试。', toggleCarParks: '停车场', 
        retailers: '零售商', telephone: '电话', locateBtn: '定位', 
        layersTitle: '图层', fuelPricesTitle: '燃油价格', legendTitle: '图例', 
        retailerCategoriesTitle: '零售商类别', routeTitle: '路线', 
        toggleAttractions: '郊野公园景点', toggleViewingPoints: '观景台', 
        toggleEVChargers: '电动车充电站', toggleParkingMeters: '咪表泊车位', 
        toggleOilStations: '油站', togglePermits: '许可证', toggleProhibitions: '禁区', 
        toggleTrafficSpeed: '交通速度', toggleTurnRestrictions: '转向限制', 
        toggleTrafficFeatures: '交通设施', toggleToilets: '洗手间', website: '网站', 
        countryPark: '郊野公园', street: '街道', sectionOfStreet: '路段', 
        vehicleType: '车辆类别', operatingPeriod: '运作时段', totalMeters: '总车位数', 
        availableMeters: '空置', occupiedMeters: '已占用', 
        userLocationPopup: '您在此地点 {accuracy} 米范围内。', navigate: '导航', 
        stopNavigation: '停止导航', navigationError: '无法计算路线。', 
        locationError: '无法找到您的位置。', zebraCrossing: '前方斑马线', 
        yellowBox: '前方黄色方格路口', tollPlaza: '前方收费广场', culDeSac: '前方尽头路', 
        turnRestrictionWarning: '警告：前方有转向限制', arrived: '您已到达目的地。', 
        legendTitle: '图例', legendCarPark: '停车场', legendAttraction: '郊野公园景点', 
        legendViewingPoint: '观景台', legendEVCharger: '电动车充电站', 
        legendParkingMeter: '咪表泊车位', legendOilStation: '油站', 
        legendTurnRestriction: '转向限制', legendZebraCrossing: '斑马线', 
        legendYellowBox: '黄色方格路口', legendTollPlaza: '收费广场', legendCulDeSac: '尽头路', 
        legendPermit: '许可证', legendProhibition: '禁区', legendToilet: '洗手间', 
        legendTrafficSmooth: '交通畅顺', legendTrafficSlow: '交通缓慢', 
        legendTrafficCongested: '交通挤塞', charger_types: '充电器类型', 
        diesel: '柴油', super: '超级汽油', premium: '特级汽油', lpg: '石油气', 
        fuelsAvailable: '提供燃料', fuelPricesTitle: '燃油价格', company: '公司', 
        vehicle_A: '任何车辆 (中型及重型货车、巴士、摩托车及机动三轮车除外)', 
        vehicle_C: '长途汽车', vehicle_G: '货车', op_F: '每天上午 8 点至晚上 9 点', 
        op_N: '每天 07:00 - 午夜', op_P: '周一至周六每天上午 8:00 至晚上 8:00（周日禁止停车）', 
        op_D: '周一至周六上午 08:00 至午夜； 周日和公众假期上午 10 点至晚上 10 点', 
        op_S: '周一至周五每天上午 8 点至下午 5 点禁止停车； 下午 05:00 - 周一至周五每天午夜； 周六每天上午 8 点至午夜； 周日和公众假期每天上午 10 点至晚上 10 点', 
        op_H: '每天上午8时至晚上8时', op_E: '每天上午7时至晚上8时', 
        op_Q: '逢星期一至六上午8时至晚上8时；星期日及公眾假期上午10时至晚上10时', 
        op_J: '每天上午8时至午夜', op_A: '逢星期一至六上午8时至午夜 (星期日及公众假期除外)', 
        op_B: '逢星期一至六上午8时至晚上8时 (星期日及公众假期除外)', unknown: '不详', 
        avgSpeed: '平均速度', routeId: '路线ID', 
        initialLoadMessage: '首次加载可能需要一些时间，请稍候...', 
        searchPlaceholder: '按名称/地址搜索停车场...', 
        noResults: '找不到符合您搜索的停车场。',
        apiStatusChecking: '检查API中...',
        apiStatusOnline: 'API在线',
        apiStatusOffline: '部分API离线',
        apiStatusError: 'API错误'
    }, 
};

// -------------------------------------------------
// 2. DOM ELEMENT REFERENCES
// -------------------------------------------------

const appLogo = document.getElementById('app-logo');
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const clearSearchBtnContainer = document.getElementById('clear-search-btn-container');
const clearSearchBtn = document.getElementById('clear-search-btn');
const langSwitcher = document.getElementById('lang-switcher');
const locateUserBtn = document.getElementById('locate-user-btn');
const layerControlContainer = document.getElementById('layer-control');
const legendContainer = document.getElementById('legend-container');
const oilPriceContainer = document.getElementById('oil-price-container');
const mapContainer = document.getElementById('map');
const loadingSpinner = document.getElementById('loading-spinner');
const loadingMessage = document.getElementById('loading-message');
const apiProgressBar = document.getElementById('api-progress-bar');
const apiStatusDetail = document.getElementById('api-status-detail');
const infoModal = document.getElementById('info-modal');
const infoModalContent = document.getElementById('info-modal-content');
const routePanelContainer = document.getElementById('route-panel-container');
const notificationContainer = document.getElementById('notification-container');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const sidebar = document.getElementById('sidebar');
const sidebarToggleOpen = document.getElementById('sidebar-toggle-open');
const sidebarToggleClose = document.getElementById('sidebar-toggle-close');

// -------------------------------------------------
// 3. HELPER & UTILITY FUNCTIONS
// -------------------------------------------------

// Point-in-polygon algorithm
function isPointInPolygon(point, polygon) {
    const [x, y] = point;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [xi, yi] = polygon[i];
        const [xj, yj] = polygon[j];
        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }
    return inside;
}

// Improved CORS handling with fallback
async function fetchWithCorsFallback(url, options = {}) {
    let lastError;
    
    // Try direct fetch first
    try {
        const response = await fetch(url, options);
        if (response.ok) return response;
        lastError = new Error(`HTTP ${response.status}`);
    } catch (e) {
        lastError = e;
        // console.log('Direct fetch failed, trying proxies...');
    }
    
    // Try through proxies
    for (const proxy of CORS_PROXIES) {
        try {
            const proxyUrl = proxy + encodeURIComponent(url);
            console.log('Trying proxy:', proxy);
            const response = await fetch(proxyUrl, options);
            if (response.ok) {
                console.log('Proxy succeeded:', proxy);
                return response;
            }
        } catch (e) {
            console.log('Proxy failed:', proxy, e.message);
            lastError = e;
            continue;
        }
    }
    
    console.warn('All fetch attempts failed for:', url);
    throw lastError || new Error('All fetch attempts failed');
}

// Retry mechanism for critical APIs
async function fetchWithRetry(url, retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetchWithCorsFallback(url);
            if (response.ok) return response;
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
        }
    }
    throw new Error(`All ${retries} retry attempts failed`);
}

const speak = (text) => {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = appState.language === 'en_US' ? 'en-US' : (appState.language === 'zh_TW' ? 'zh-TW' : 'zh-CN');
        window.speechSynthesis.speak(utterance);
    }
};

const showNotification = (message, shouldSpeak = true) => {
    notificationContainer.innerHTML = ''; // Clear previous
    const notification = document.createElement('div');
    notification.className = 'fixed bottom-5 right-5 z-[2000] bg-gray-800 text-white font-semibold py-3 px-5 rounded-lg shadow-lg transition-all duration-300 opacity-0 translate-y-5';
    notification.textContent = message;
    notificationContainer.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.remove('opacity-0', 'translate-y-5');
        notification.classList.add('opacity-100', 'translate-y-0');
    }, 10);

    if (shouldSpeak) speak(message);

    setTimeout(() => {
        notification.classList.remove('opacity-100', 'translate-y-0');
        notification.classList.add('opacity-0', 'translate-y-5');
        setTimeout(() => notification.remove(), 300);
    }, 5000);
};

const decodeCode = (prefix, code) => {
    const t = i18n[appState.language];
    if (!code) return t.unknown;
    const shortCode = code.length > 1 ? code[code.length - 1] : code;
    const key = `${prefix}_${shortCode}`;
    return t[key] || code;
};

const subdivideBounds = (bounds) => {
    const north = bounds.getNorth();
    const south = bounds.getSouth();
    const east = bounds.getEast();
    const west = bounds.getWest();
    const midLat = (north + south) / 2;
    const midLng = (east + west) / 2;
    return [
        L.latLngBounds(L.latLng(midLat, west), L.latLng(north, midLng)),
        L.latLngBounds(L.latLng(midLat, midLng), L.latLng(north, east)),
        L.latLngBounds(L.latLng(south, west), L.latLng(midLat, midLng)),
        L.latLngBounds(L.latLng(south, midLng), L.latLng(midLat, east)),
    ];
};

// API status monitoring
function updateApiStatus(apiName, status) {
    appState.apiStatus[apiName] = status;
    
    // Calculate overall status
    const statuses = Object.values(appState.apiStatus);
    const onlineCount = statuses.filter(s => s === 'online').length;
    const totalCount = statuses.filter(s => s !== 'unknown').length;
    
    if (totalCount === 0) {
        statusDot.className = 'status-indicator status-warning';
        statusText.textContent = i18n[appState.language].apiStatusChecking;
    } else if (onlineCount === totalCount) {
        statusDot.className = 'status-indicator status-online';
        statusText.textContent = i18n[appState.language].apiStatusOnline;
    } else if (onlineCount > 0) {
        statusDot.className = 'status-indicator status-warning';
        statusText.textContent = i18n[appState.language].apiStatusOffline;
    } else {
        statusDot.className = 'status-indicator status-offline';
        statusText.textContent = i18n[appState.language].apiStatusError;
    }
}

function updateApiProgress(progress, message) {
    apiProgressBar.style.width = `${progress}%`;
    apiStatusDetail.textContent = message;
}

// --- NEW FUNCTION for Sidebar/Accordion ---
function setupUIControls() {
    // Sidebar Toggles
    sidebarToggleClose.addEventListener('click', () => {
        sidebar.classList.add('-translate-x-full');
        sidebarToggleOpen.classList.remove('hidden');
    });
    
    sidebarToggleOpen.addEventListener('click', () => {
        sidebar.classList.remove('-translate-x-full');
        sidebarToggleOpen.classList.add('hidden');
    });

    // Accordion Logic
    const accordionHeaders = document.querySelectorAll('.accordion-header');
    accordionHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const content = header.nextElementSibling;
            
            // Toggle active class on header
            header.classList.toggle('active');

            // Toggle content visibility
            if (content.classList.contains('open')) {
                content.classList.remove('open');
            } else {
                // Optional: Close other open accordions
                // document.querySelectorAll('.accordion-content.open').forEach(c => {
                //     c.classList.remove('open');
                //     c.previousElementSibling.classList.remove('active');
                // });
                content.classList.add('open');
            }
        });
    });

    // Open Layers accordion by default
    const layerHeader = layerControlContainer.parentElement.previousElementSibling;
    if (layerHeader) {
        layerHeader.click();
    }
}

// -------------------------------------------------
// 4. ICON CREATION - APPLE MAPS STYLE
// -------------------------------------------------

// --- Base SVGs for icons ---
const CarparkSVG = `<svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M13 3H6v18h4v-6h3c3.31 0 6-2.69 6-6s-2.69-6-6-6zm.2 8H10V7h3.2c1.1 0 2 .9 2 2s-.9 2-2 2z"/></svg>`;
const AttractionSVG = `<svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M14 6l-3.75 5 2.85 3.8-1.6 1.2C9.81 13.75 7 10 7 10l-6 8h22L14 6z"/></svg>`;
const ViewingPointSVG = `<svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>`;
const EVSVG = `<svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>`;
const ParkingMeterSVG = `<svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>`;
const OilStationSVG = `<svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M19.77 7.23l.01-.01-3.72-3.72L15 4.56l2.11 2.11c-.94.36-1.61 1.26-1.61 2.33 0 1.38 1.12 2.5 2.5 2.5.36 0 .69-.08 1-.21v7.21c0 .55-.45 1-1 1s-1-.45-1-1V14c0-1.1-.9-2-2-2h-1V5c0-1.1-.9-2-2-2H6c-1.1 0-2 .9-2 2v16h10v-7.5h1.5v5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V9c0-.69-.28-1.32-.73-1.77zM12 10H6V5h6v5z"/></svg>`;
const PermitSVG = `<svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>`;
const ProhibitionSVG = `<svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9C4.63 15.55 4 13.85 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1C19.37 8.45 20 10.15 20 12c0 4.42-3.58 8-8 8z"/></svg>`;

// --- Apple Maps Style Pin Generator ---
const createAppleMapPin = (colorClass, iconSvg) => {
    const html = `
        <div class="apple-map-pin ${colorClass}">
            <div class="pin-body"></div>
            <div class="pin-icon">${iconSvg}</div>
        </div>
    `;
    return L.divIcon({
        html: html,
        className: 'leaflet-custom-icon-wrapper',
        iconSize: [34, 44],
        iconAnchor: [17, 44],
        popupAnchor: [0, -44]
    });
};

// --- Apple Maps Style Badge Generator (circular) ---
const createAppleMapBadge = (colorClass, content) => {
    const html = `<div class="apple-map-badge ${colorClass}">${content}</div>`;
    return L.divIcon({
        html: html,
        className: 'leaflet-custom-icon-wrapper',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16]
    });
};

// --- Apple Maps Style Indicator Generator (small circular) ---
const createAppleMapIndicator = (colorClass, iconSvg) => {
    const html = `<div class="apple-map-indicator ${colorClass}">${iconSvg}</div>`;
    return L.divIcon({
        html: html,
        className: 'leaflet-custom-icon-wrapper',
        iconSize: [26, 26],
        iconAnchor: [13, 13],
        popupAnchor: [0, -13]
    });
};

// --- Icon Factory Functions ---
const createCarparkIcon = () => createAppleMapPin('pin-blue', CarparkSVG);
const createAttractionIcon = () => createAppleMapPin('pin-green', AttractionSVG);
const createViewingPointIcon = () => createAppleMapPin('pin-orange', ViewingPointSVG);
const createEVChargerIcon = () => createAppleMapPin('pin-teal', EVSVG);
const createParkingMeterIcon = () => createAppleMapPin('pin-purple', ParkingMeterSVG);
const createOilStationIcon = () => createAppleMapPin('pin-gray', OilStationSVG);
const createPermitIcon = () => createAppleMapIndicator('indicator-orange', PermitSVG);
const createProhibitionIcon = () => createAppleMapIndicator('indicator-red', ProhibitionSVG);

// Genuine Retailers - pin with shopping bag icon
const RetailerSVG = `<svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M7 4V3h10v1h3.008c.548 0 .992.445.992.993v3.014c0 .548-.381 1.005-.862 1.005H4.862C4.381 8.012 4 7.555 4 7.007V4.993C4 4.445 4.381 4 4.862 4H7zm0 2h10V5H7v1z"/><path d="M5.5 9l1.393 11.084C1.786 20.412 3.217 21 4.862 21h14.276c1.645 0 3.076-.588 1.469-1.916L18.5 9h-13z"/></svg>`;
const createRetailerIcon = () => createAppleMapPin('pin-red', RetailerSVG);

// Toilet - circular badge with WC text
const createToiletIcon = () => createAppleMapBadge('badge-sky', '<span style="font-size: 11px; font-weight: 700;">WC</span>');

// Turn Restriction - circular badge with rotation symbol
const createTurnRestrictionIcon = () => createAppleMapBadge('badge-red', '<span style="font-size: 16px;">⟳</span>');

// Traffic Feature Icons
const createTrafficFeatureIcon = (featureType) => {
    switch(featureType) {
        case 'ZC': // Zebra Crossing
            return createAppleMapBadge('badge-slate', '<span style="font-size: 12px; font-weight: 700;">Z</span>');
        case 'YB': // Yellow Box
            return createAppleMapBadge('badge-yellow', '<span style="font-size: 12px; font-weight: 700;">Y</span>');
        case 'TP': // Toll Plaza
            return createAppleMapBadge('badge-cyan', '<span style="font-size: 12px; font-weight: 700;">$</span>');
        case 'CS': // Cul-de-sac
            return createAppleMapBadge('badge-rose', '<span style="font-size: 12px; font-weight: 700;">C</span>');
        default:
            return createAppleMapBadge('badge-slate', '<span style="font-size: 12px; font-weight: 700;">?</span>');
    }
};

// -------------------------------------------------
// 5. DATA FETCHING
// -------------------------------------------------

async function fetchCarparkData(lang) {
    try {
        updateApiProgress(10, 'Loading car park data...');
        
        const langParam = `&lang=${lang}`;
        const infoUrl = API_INFO_BASE_URL + langParam;
        const infoResponse = await fetchWithRetry(infoUrl);
        if (!infoResponse.ok) throw new Error('Failed to fetch car park info.');
        const infoData = await infoResponse.json();
        const infoList = infoData.results || [];

        if (infoList.length === 0) return [];

        updateApiProgress(30, 'Loading vacancy data...');

        const parkIds = infoList.map((park) => park.park_Id).join(',');
        const vacancyUrl = `${API_VACANCY_BASE_URL}&carparkIds=${parkIds}${langParam}`;
        
        let vacancyList = [];
        try {
            const vacancyResponse = await fetchWithRetry(vacancyUrl);
            if (vacancyResponse.ok) {
                const vacancyData = await vacancyResponse.json();
                vacancyList = vacancyData.results || [];
            }
        } catch (error) {
            console.warn('Failed to fetch car park vacancy data:', error);
        }

        const vacancyMap = new Map();
        for (const vacancy of vacancyList) {
            vacancyMap.set(vacancy.park_Id, vacancy);
        }
        
        updateApiStatus('carparks', 'online');
        return infoList.map((info) => ({
            ...info,
            vacancyData: vacancyMap.get(info.park_Id) || null
        }));
        
    } catch (error) {
        console.error('Error in fetchCarparkData:', error);
        updateApiStatus('carparks', 'offline');
        return [];
    }
}

async function fetchGeoJSONData(url, apiName) {
    try {
        const response = await fetchWithCorsFallback(url);
        if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
        const data = await response.json();
        if (apiName) updateApiStatus(apiName, 'online');
        return data.features || [];
    } catch (error) {
        console.error(`Failed to fetch GeoJSON from ${url}:`, error);
        if (apiName) updateApiStatus(apiName, 'offline');
        return [];
    }
}

let parkingMeterStatusCache = null;
function parseCSVToMap(csvText) {
    const statusMap = new Map();
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
async function fetchInitialParkingMeterStatus() {
    if (parkingMeterStatusCache) return parkingMeterStatusCache;
    try {
        const response = await fetchWithCorsFallback(API_PARKING_METERS_STATUS_URL);
        if (!response.ok) throw new Error('Failed to fetch parking meter status data.');
        const statusText = await response.text();
        parkingMeterStatusCache = parseCSVToMap(statusText);
        return parkingMeterStatusCache;
    } catch (error) {
        console.error("Error fetching parking meter status:", error);
        return new Map();
    }
}
function getCachedParkingMeterStatus() { return parkingMeterStatusCache || new Map(); }
async function fetchParkingMetersInBounds(bounds) {
    const lowerCorner = `${bounds.getSouth()} ${bounds.getWest()}`;
    const upperCorner = `${bounds.getNorth()} ${bounds.getEast()}`;
    const filter = `<Filter><Intersects><PropertyName>SHAPE</PropertyName><gml:Envelope srsName='EPSG:4326'><gml:lowerCorner>${lowerCorner}</gml:lowerCorner><gml:upperCorner>${upperCorner}</gml:upperCorner></gml:Envelope></Intersects></Filter>`;
    const url = `${API_PARKING_METERS_BASE_URL}&maxFeatures=500&filter=${encodeURIComponent(filter)}`;
    return fetchGeoJSONData(url);
}

async function fetchToiletsInBounds(bounds) {
    const lowerCorner = `${bounds.getSouth()} ${bounds.getWest()}`;
    const upperCorner = `${bounds.getNorth()} ${bounds.getEast()}`;
    const bboxFilter = `<BBOX><PropertyName>SHAPE</PropertyName><gml:Envelope srsName='EPSG:4326'><gml:lowerCorner>${lowerCorner}</gml:lowerCorner><gml:upperCorner>${upperCorner}</gml:upperCorner></gml:Envelope></BBOX>`;
    const fehdBaseFilter = `<PropertyIsEqualTo><PropertyName>SEARCH02_TC</PropertyName><Literal>公廁</Literal></PropertyIsEqualTo>`;
    const fehdCombinedFilter = `<Filter><And>${fehdBaseFilter}${bboxFilter}</And></Filter>`;
    const fehdUrl = `${API_TOILETS_FEHD_URL}&filter=${encodeURIComponent(fehdCombinedFilter)}`;
    const afcdFilter = `<Filter>${bboxFilter}</Filter>`;
    const afcdUrl = `${API_TOILETS_AFCD_URL}&filter=${encodeURIComponent(afcdFilter)}`;
    try {
        const [fehdResponse, afcdResponse] = await Promise.all([ 
            fetchWithCorsFallback(fehdUrl), 
            fetchWithCorsFallback(afcdUrl) 
        ]);
        const fehdData = fehdResponse.ok ? await fehdResponse.json() : { features: [] };
        const afcdData = afcdResponse.ok ? await afcdResponse.json() : { features: [] };
        return [...(fehdData.features || []), ...(afcdData.features || [])];
    } catch (error) {
        console.error("Error fetching toilet data:", error);
        return [];
    }
}

const parseCsvLine = (line) => {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && i < line.length - 1 && line[i + 1] === '"') {
                current += '"'; i++;
            } else { inQuotes = !inQuotes; }
        } else if (char === ',' && !inQuotes) {
            values.push(current.trim()); current = '';
        } else { current += char; }
    }
    values.push(current.trim());
    return values;
};
function parseOilStationCSV(csvText, language) {
    let cleanCsvText = csvText.startsWith('\uFEFF') ? csvText.substring(1) : csvText;
    const lines = cleanCsvText.trim().split('\n');
    const stations = [];
    lines.shift(); // remove header
    const langMap = { 'en_US': { name: 0, brand: 3, types: 6 }, 'zh_TW': { name: 1, brand: 4, types: 7 }, 'zh_CN': { name: 2, brand: 5, types: 8 }, };
    const currentLangIndices = langMap[language];
    for (const line of lines) {
        if (!line.trim()) continue;
        const values = parseCsvLine(line.trim());
        if (values.length < 11) continue;
        try {
            const latitude = parseFloat(values[9]);
            const longitude = parseFloat(values[10]);
            if (isNaN(latitude) || isNaN(longitude)) continue;
            const name = values[currentLangIndices.name] || values[langMap['en_US'].name] || '';
            const company = values[currentLangIndices.brand] || values[langMap['en_US'].brand] || '';
            const oilTypesString = values[currentLangIndices.types] || values[langMap['en_US'].types] || '';
            const fuels = oilTypesString ? oilTypesString.split(' / ').map(f => f.trim().replace(/Auto LPG/g, 'LPG')).filter(f => f) : [];
            stations.push({ name, address: name, company, latitude, longitude, fuels, });
        } catch (e) { console.error("Error processing oil station line:", line.trim(), e); }
    }
    return stations;
}
async function fetchOilStationsData(language) {
    try {
        updateApiProgress(60, 'Loading oil station data...');
        const response = await fetchWithRetry(API_OIL_STATIONS_URL);
        if (!response.ok) throw new Error('Failed to fetch oil station data.');
        const csvText = await response.text();
        updateApiStatus('oilStations', 'online');
        return parseOilStationCSV(csvText, language);
    } catch (error) {
        console.error("Error fetching oil station data:", error);
        updateApiStatus('oilStations', 'offline');
        return [];
    }
}
async function fetchOilPriceData() {
    try {
        updateApiProgress(70, 'Loading fuel prices...');
        
        // Try multiple proxy approaches for consumer.org.hk
        let response = null;
        let lastError = null;
        
        for (const proxy of CORS_PROXIES) {
            try {
                const proxyUrl = proxy + encodeURIComponent(API_OIL_PRICES_URL);
                console.log('Trying oil price proxy:', proxy);
                response = await fetch(proxyUrl, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    }
                });
                
                if (response.ok) {
                    console.log('Oil price proxy succeeded:', proxy);
                    break;
                }
            } catch (error) {
                console.log('Oil price proxy failed:', proxy, error.message);
                lastError = error;
                response = null;
                continue;
            }
        }
        
        if (!response || !response.ok) {
            throw lastError || new Error('All oil price proxy attempts failed');
        }
        
        const data = await response.json();
        const priceMap = new Map();
        
        if (Array.isArray(data)) {
            data.forEach(fuelData => {
                const fuelTypeEn = fuelData.type?.en;
                if (fuelTypeEn && Array.isArray(fuelData.prices)) {
                    fuelData.prices.forEach((vendorPrice) => {
                        const vendorEn = vendorPrice.vendor?.en;
                        const priceStr = vendorPrice.price;
                        if (vendorEn && typeof priceStr === 'string') {
                            const price = parseFloat(priceStr);
                            if (!isNaN(price)) {
                                if (!priceMap.has(vendorEn)) priceMap.set(vendorEn, new Map());
                                priceMap.get(vendorEn).set(fuelTypeEn, price);
                            }
                        }
                    });
                }
            });
        }
        
        updateApiStatus('oilPrices', 'online');
        console.log('Successfully loaded oil price data:', priceMap.size, 'companies');
        return priceMap;
        
    } catch (error) { 
        console.error("Error fetching oil price data:", error);
        updateApiStatus('oilPrices', 'offline');
        
        // Return empty map but don't break the app
        console.warn('Oil price data unavailable - continuing without fuel prices');
        return new Map(); 
    }
}

function parseKMLToGeoJSON(kmlText) {
    const parser = new DOMParser();
    const kmlDoc = parser.parseFromString(kmlText, 'text/xml');
    const placemarks = kmlDoc.querySelectorAll('Placemark');
    const features = [];
    placemarks.forEach(placemark => {
        const name = placemark.querySelector('name')?.textContent || '';
        const description = placemark.querySelector('description')?.textContent || '';
        const coordinates = placemark.querySelector('coordinates')?.textContent;
        if (coordinates) {
            const coords = coordinates.trim().split(',').map(c => parseFloat(c));
            if (coords.length >= 2) {
                features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [coords[0], coords[1]] }, properties: { name, description } });
            }
        }
    });
    return { type: 'FeatureCollection', features };
}
async function fetchTurnRestrictionsData() {
    try {
        const response = await fetchWithCorsFallback(API_TURN_RESTRICTIONS_URL);
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
async function fetchTrafficFeaturesInBounds(bounds) {
    const lowerCorner = `${bounds.getSouth()} ${bounds.getWest()}`;
    const upperCorner = `${bounds.getNorth()} ${bounds.getEast()}`;
    const filter = `<Filter><BBOX><PropertyName>SHAPE</PropertyName><gml:Envelope srsName='EPSG:4326'><gml:lowerCorner>${lowerCorner}</gml:lowerCorner><gml:upperCorner>${upperCorner}</gml:upperCorner></gml:Envelope></BBOX></Filter>`;
    const url = `${API_TRAFFIC_FEATURES_BASE_URL}&filter=${encodeURIComponent(filter)}`;
    return fetchGeoJSONData(url);
}
async function fetchProhibitionData() {
    try {
        const [pcResponse, allResponse] = await Promise.all([
            fetchWithCorsFallback(API_PROHIBITION_PC_URL),
            fetchWithCorsFallback(API_PROHIBITION_ALL_URL)
        ]);
        if (!pcResponse.ok || !allResponse.ok) throw new Error('Failed to fetch prohibition data.');
        const pcData = await pcResponse.json();
        const allData = await allResponse.json();
        return [...(pcData.features || []), ...(allData.features || [])];
    } catch (error) {
        console.error("Error fetching prohibition data:", error);
        return [];
    }
}
async function fetchRoadNetworkData(bounds) {
    const baseUrl = API_ROAD_NETWORK_URL;
    const allFeatures = [];
    const pageSize = 1000;
    const lowerCorner = `${bounds.getSouth()} ${bounds.getWest()}`;
    const upperCorner = `${bounds.getNorth()} ${bounds.getEast()}`;
    const boundsFilter = `<Filter><Intersects><PropertyName>SHAPE</PropertyName><gml:Envelope srsName='EPSG:4326'><gml:lowerCorner>${lowerCorner}</gml:lowerCorner><gml:upperCorner>${upperCorner}</gml:upperCorner></gml:Envelope></Intersects></Filter>`;
    let hasMore = true, startIndex = 0;
    while(hasMore) {
        const url = `${baseUrl}&resultOffset=${startIndex}&resultRecordCount=${pageSize}&filter=${encodeURIComponent(boundsFilter)}`;
        try {
            const response = await fetchWithCorsFallback(url);
            if (!response.ok) throw new Error(`Failed to fetch road network data. Status: ${response.status}`);
            const data = await response.json();
            const features = data.features || [];
            if (features.length > 0) {
                features.forEach((feature) => {
                    if (feature.properties && feature.properties.ROUTE_ID) {
                        feature.properties.ROUTE_ID = String(feature.properties.ROUTE_ID).trim();
                        allFeatures.push(feature);
                    }
                });
                startIndex += features.length;
                if (features.length < pageSize) hasMore = false;
            } else { hasMore = false; }
        } catch (error) {
            console.error("Failed to fetch a road network tile:", error);
            hasMore = false;
        }
    }
    return allFeatures;
}

async function fetchTrafficSpeedData() {
    try {
        const response = await fetchWithCorsFallback(API_TRAFFIC_SPEED_URL);
        if (!response.ok) throw new Error(`Traffic speed fetch failed: ${response.statusText}`);
        const xmlText = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "application/xml");
        if (xmlDoc.getElementsByTagName("parsererror").length) return {};
        const result = {};
        const segments = xmlDoc.getElementsByTagName('segment');
        for (let i = 0; i < segments.length; i++) {
            const item = segments[i];
            const segmentId = item.getElementsByTagName('segment_id')[0]?.textContent?.trim();
            const speedText = item.getElementsByTagName('speed')[0]?.textContent?.trim();
            const isValid = item.getElementsByTagName('valid')[0]?.textContent?.trim().toUpperCase() === 'Y';
            if (segmentId && speedText && isValid) {
                const speedValue = parseFloat(speedText);
                if (!isNaN(speedValue)) {
                    let reliability;
                    if (speedValue > 40) reliability = 1; // smooth
                    else if (speedValue > 20) reliability = 2; // slow
                    else reliability = 3; // congested
                    result[segmentId] = { speed: Math.round(speedValue), reliability };
                }
            }
        }
        return result;
    } catch (error) {
        console.error("An exception occurred in fetchTrafficSpeedData:", error);
        return {};
    }
}

async function fetchGenuineRetailersInBounds(bounds) {
    const lowerCorner = `${bounds.getSouth()} ${bounds.getWest()}`;
    const upperCorner = `${bounds.getNorth()} ${bounds.getEast()}`;
    const filter = `<Filter><Intersects><PropertyName>SHAPE</PropertyName><gml:Envelope srsName='EPSG:4326'><gml:lowerCorner>${lowerCorner}</gml:lowerCorner><gml:upperCorner>${upperCorner}</gml:upperCorner></gml:Envelope></Intersects></Filter>`;
    const url = `${API_GENUINE_RETAILERS_URL}&maxFeatures=500&filter=${encodeURIComponent(filter)}`;
    return fetchGeoJSONData(url);
}



// -------------------------------------------------
// 6. UI RENDERING FUNCTIONS
// -------------------------------------------------

function updateLoadingSpinner(show, message = '') {
    appState.isLoading = show;
    loadingMessage.textContent = message;
    loadingSpinner.classList.toggle('hidden', !show);
}

// function renderLogo() {
//     const icons = [
//         { svg: CarparkSVG, color: 'bg-blue-600' },
//         { svg: AttractionSVG, color: 'bg-green-500' },
//         { svg: ViewingPointSVG, color: 'bg-amber-500' },
//         { svg: OilStationSVG, color: 'bg-gray-700' },
//     ];
    
//     appLogo.innerHTML = icons.map(icon => `
//         <div class="w-6 h-6 flex items-center justify-center ${icon.color} rounded-md p-1">
//             ${icon.svg}
//         </div>
//     `).join('');
// }

function updateLanguageUI() {
    const t = i18n[appState.language];
    searchInput.placeholder = t.searchPlaceholder;
    
    // Update sidebar section titles
    document.querySelectorAll('.accordion-header span').forEach((span, index) => {
        const titles = [t.layersTitle, t.fuelPricesTitle, t.legendTitle, t.retailerCategoriesTitle, t.routeTitle];
        if (titles[index]) span.textContent = titles[index];
    });
    
    // Update locate button
    const locateBtn = document.querySelector('#locate-user-btn span');
    if (locateBtn) locateBtn.textContent = t.locateBtn;
    
    // Update place names layer language
    if (appState.layers.placeNames) {
        const lang = appState.language === 'en_US' ? 'en' : 'tc';
        console.log(appState.layers.placeNames);
        const wasVisible = appState.map.hasLayer(appState.layers.placeNames);
        if (wasVisible) appState.map.removeLayer(appState.layers.placeNames);
        appState.layers.placeNames = L.tileLayer(`https://mapapi.geodata.gov.hk/gs/api/v1.0.0/xyz/label/hk/${lang}/WGS84/{z}/{x}/{y}.png`, {
            maxZoom: 20,
            minZoom: 14,
            opacity: 1
        });
        if (wasVisible) appState.map.addLayer(appState.layers.placeNames);
        const v = appState.map.hasLayer(appState.layers.placeNames);
    }
    
    // Update Layer Control Labels & Legend
    renderLayerControl();
    renderLegend();
    renderOilPricePanel();
}

function renderLayerControl() {
    const t = i18n[appState.language];
    const layers = [
        { key: 'carparks', label: t.toggleCarParks },
        { key: 'attractions', label: t.toggleAttractions },
        { key: 'viewingPoints', label: t.toggleViewingPoints },
        { key: 'evChargers', label: t.toggleEVChargers },
        { key: 'parkingMeters', label: t.toggleParkingMeters },
        { key: 'oilStations', label: t.toggleOilStations },
        { key: 'toilets', label: t.toggleToilets },
        { key: 'genuineRetailers', label: 'Shops' },
        { key: 'placeNames', label: 'Place Names' },
        { key: 'permits', label: t.togglePermits },
        { key: 'prohibitions', label: t.toggleProhibitions },
        { key: 'turnRestrictions', label: t.toggleTurnRestrictions },
        { key: 'trafficFeatures', label: t.toggleTrafficFeatures },
        { key: 'trafficSpeed', label: t.toggleTrafficSpeed },
    ];
    
    layerControlContainer.innerHTML = layers.map(layer => `
        <label class="flex items-center space-x-2 cursor-pointer text-sm text-gray-800">
            <input type="checkbox" data-layer="${layer.key}" ${appState.visibleLayers[layer.key] ? 'checked' : ''}
                   class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"/>
            <span>${layer.label}</span>
        </label>
    `).join('');
}

function renderLegend() {
    const t = i18n[appState.language];
    
    // Mini pin style for legend
    const miniPin = (color) => `
        <div style="width: 16px; height: 22px; position: relative; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));">
            <div style="width: 16px; height: 16px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); background: linear-gradient(135deg, ${color.light} 0%, ${color.main} 50%, ${color.dark} 100%); border: 1.5px solid white;"></div>
            <div style="position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); width: 3px; height: 3px; background: ${color.dark}; border-radius: 50%;"></div>
        </div>
    `;
    
    // Mini badge style for legend
    const miniBadge = (bgColor, textColor, text) => `
        <div style="width: 18px; height: 18px; border-radius: 50%; background: ${bgColor}; border: 1.5px solid white; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(0,0,0,0.2);">
            <span style="color: ${textColor}; font-size: 9px; font-weight: 700;">${text}</span>
        </div>
    `;
    
    // Mini indicator style for legend
    const miniIndicator = (bgColor, svgIcon) => `
        <div style="width: 16px; height: 16px; border-radius: 50%; background: ${bgColor}; border: 1.5px solid white; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 2px rgba(0,0,0,0.2);">
            <svg fill="white" viewBox="0 0 24 24" style="width: 10px; height: 10px;">${svgIcon}</svg>
        </div>
    `;

    const colors = {
        blue: { light: '#4DA3FF', main: '#007AFF', dark: '#0056B3' },
        green: { light: '#5DD87A', main: '#34C759', dark: '#248A3D' },
        orange: { light: '#FFB340', main: '#FF9500', dark: '#CC7700' },
        teal: { light: '#8ADBFB', main: '#5AC8FA', dark: '#2BA3D6' },
        purple: { light: '#C77DEB', main: '#AF52DE', dark: '#8944B3' },
        gray: { light: '#8E8E93', main: '#636366', dark: '#48484A' },
    };
    
    const legendItems = `
        <div class="flex items-center space-x-2 py-0.5">${miniPin(colors.blue)}<span class="text-xs text-gray-700">${t.legendCarPark}</span></div>
        <div class="flex items-center space-x-2 py-0.5">${miniPin(colors.green)}<span class="text-xs text-gray-700">${t.legendAttraction}</span></div>
        <div class="flex items-center space-x-2 py-0.5">${miniPin(colors.orange)}<span class="text-xs text-gray-700">${t.legendViewingPoint}</span></div>
        <div class="flex items-center space-x-2 py-0.5">${miniPin(colors.teal)}<span class="text-xs text-gray-700">${t.legendEVCharger}</span></div>
        <div class="flex items-center space-x-2 py-0.5">${miniPin(colors.purple)}<span class="text-xs text-gray-700">${t.legendParkingMeter}</span></div>
        <div class="flex items-center space-x-2 py-0.5">${miniPin(colors.gray)}<span class="text-xs text-gray-700">${t.legendOilStation}</span></div>
        <div class="flex items-center space-x-2 py-0.5">${miniBadge('#30B0C7', 'white', 'WC')}<span class="text-xs text-gray-700">${t.legendToilet}</span></div>
        <div class="flex items-center space-x-2 py-0.5">${miniIndicator('#FF9500', '<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>')}<span class="text-xs text-gray-700">${t.legendPermit}</span></div>
        <div class="flex items-center space-x-2 py-0.5">${miniIndicator('#FF3B30', '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9C4.63 15.55 4 13.85 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1C19.37 8.45 20 10.15 20 12c0 4.42-3.58 8-8 8z"/>')}<span class="text-xs text-gray-700">${t.legendProhibition}</span></div>
        <div class="flex items-center space-x-2 py-0.5">${miniBadge('#FF3B30', 'white', '⟳')}<span class="text-xs text-gray-700">${t.legendTurnRestriction}</span></div>
        <div class="flex items-center space-x-2 py-0.5">${miniBadge('#64748B', 'white', 'Z')}<span class="text-xs text-gray-700">${t.legendZebraCrossing}</span></div>
        <div class="flex items-center space-x-2 py-0.5">${miniBadge('#F59E0B', '#1F2937', 'Y')}<span class="text-xs text-gray-700">${t.legendYellowBox}</span></div>
        <div class="flex items-center space-x-2 py-0.5">${miniBadge('#06B6D4', 'white', '$')}<span class="text-xs text-gray-700">${t.legendTollPlaza}</span></div>
        <div class="flex items-center space-x-2 py-0.5">${miniBadge('#E11D48', 'white', 'C')}<span class="text-xs text-gray-700">${t.legendCulDeSac}</span></div>
        <hr class="my-1.5 border-gray-200"/>
        <div class="flex items-center space-x-2 py-0.5"><div class="w-5 h-1 rounded-full bg-[#28a745]"></div><span class="text-xs text-gray-700">${t.legendTrafficSmooth}</span></div>
        <div class="flex items-center space-x-2 py-0.5"><div class="w-5 h-1 rounded-full bg-[#ffc107]"></div><span class="text-xs text-gray-700">${t.legendTrafficSlow}</span></div>
        <div class="flex items-center space-x-2 py-0.5"><div class="w-5 h-1 rounded-full bg-[#dc3545]"></div><span class="text-xs text-gray-700">${t.legendTrafficCongested}</span></div>
    `;
    legendContainer.innerHTML = `<div class="bg-white bg-opacity-95 p-3 rounded-xl shadow-lg w-52 backdrop-blur-sm"><div class="flex justify-between items-center mb-2 pb-1 border-b border-gray-100"><h4 class="font-bold text-sm text-gray-800">${t.legendTitle}</h4></div><div class="space-y-0.5">${legendItems}</div></div>`;
}

function renderOilPricePanel() {
    const t = i18n[appState.language];
    
    if (!appState.oilPriceData || appState.oilPriceData.size === 0) {
        oilPriceContainer.innerHTML = `
            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
                <div class="text-yellow-800 text-sm font-medium mb-1">Fuel Price Data Unavailable</div>
                <div class="text-yellow-600 text-xs">Unable to load current fuel prices from data source</div>
            </div>
        `;
        return;
    }

    const companies = Array.from(appState.oilPriceData.keys()).sort();
    const fuelTypesSet = new Set();
    appState.oilPriceData.forEach(fuelMap => {
        fuelMap.forEach((_, fuelType) => fuelTypesSet.add(fuelType));
    });
    const fuelTypes = Array.from(fuelTypesSet).sort();
    
    const cards = fuelTypes.map(fuel => {
        const prices = companies.map(company => ({
            company,
            price: appState.oilPriceData.get(company)?.get(fuel)
        })).filter(p => p.price);
        
        if (prices.length === 0) return '';
        
        const minPrice = Math.min(...prices.map(p => p.price));
        
        return `
            <div class="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
                <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">${fuel}</div>
                <div class="space-y-1.5">
                    ${prices.map(p => `
                        <div class="flex justify-between items-center">
                            <span class="text-sm text-gray-700">${p.company}</span>
                            <span class="text-sm font-semibold ${p.price === minPrice ? 'text-green-600' : 'text-gray-900'}">$${p.price.toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }).filter(Boolean).join('');

    if (cards) {
        oilPriceContainer.innerHTML = `
            <div class="space-y-2 max-h-[50vh] overflow-y-auto">
                ${cards}
            </div>`;
    } else {
        oilPriceContainer.innerHTML = `
            <div class="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                <div class="text-gray-600 text-sm">No fuel price data available</div>
            </div>
        `;
    }
}

function renderInfoModal(carpark) {
    const t = i18n[appState.language];
    const vacancyData = carpark.vacancyData;
    const vehicleTypeLabels = { privateCar: t.vac_car, motorCycle: t.vac_moto, LGV: t.vac_lgv, HGV: t.vac_hgv, coach: t.vac_coach };
    
    let vacancyRowsHtml = '';
    if (vacancyData) {
        const rows = Object.entries(vehicleTypeLabels).map(([key, label]) => {
            const vacancyInfo = vacancyData[key]?.[0];
            if (!vacancyInfo) return null;
            const vacancyValue = vacancyInfo.vacancy;
            const vacancyText = vacancyValue ?? t.notAvailable;
            const hasVacancy = typeof vacancyValue === 'number' && vacancyValue > 0;
            const colorClass = hasVacancy ? 'text-green-600' : 'text-red-600';
            return `<div class="py-2 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0"><dt class="text-sm font-medium leading-6 text-gray-900">${label}</dt><dd class="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0 font-bold"><span class="${colorClass}">${String(vacancyText)}</span></dd></div>`;
        }).filter(Boolean);
        vacancyRowsHtml = rows.length > 0 ? rows.join('') : `<div class="py-2 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0"><dt class="text-sm font-medium leading-6 text-gray-900">${t.vacancy}</dt><dd class="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">${t.noVacancyData}</dd></div>`;
    } else {
        vacancyRowsHtml = `<div class="py-2 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0"><dt class="text-sm font-medium leading-6 text-gray-900">${t.vacancy}</dt><dd class="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">${t.noVacancyData}</dd></div>`;
    }

    const hourlyCharges = carpark.privateCar?.hourlyCharges;
    const priceInfo = (hourlyCharges && hourlyCharges.length > 0) ? hourlyCharges.map((charge, index) => `
        <div class="${index > 0 ? 'mt-2' : ''}">
            <p class="font-semibold">${charge.price !== undefined ? `$${charge.price} / hour` : t.notAvailable}</p>
            <p class="text-xs text-gray-500">${`${charge.weekdays?.join(', ') || 'All Days'} (${charge.periodStart || ''} - ${charge.periodEnd || ''})`}</p>
            ${charge.remark ? `<p class="text-xs text-gray-500 mt-1">(${charge.remark})</p>` : ''}
        </div>`).join('') : t.notAvailable;

    const remarkText = carpark.heightLimits?.[0]?.remark || t.notAvailable;

    infoModalContent.innerHTML = `
        <div class="flex justify-between items-center p-4 border-b">
            <h2 class="text-xl font-bold text-gray-800">${carpark.name || t.modalTitle}</h2>
            <button id="close-modal-btn" class="text-gray-500 hover:text-gray-800 text-3xl">&times;</button>
        </div>
        <div class="p-6">
            <dl class="divide-y divide-gray-100">
                <div class="py-2 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0"><dt class="text-sm font-medium leading-6 text-gray-900">${t.address}</dt><dd class="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">${carpark.displayAddress}</dd></div>
                <div class="py-2 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0"><dt class="text-sm font-medium leading-6 text-gray-900">${t.parkId}</dt><dd class="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">${carpark.park_Id}</dd></div>
                <div class="py-2 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0"><dt class="text-sm font-medium leading-6 text-gray-900">${t.status}</dt><dd class="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0 font-bold ${carpark.opening_status === 'OPEN' ? 'text-green-600' : 'text-red-600'}">${carpark.opening_status}</dd></div>
                ${vacancyRowsHtml}
                <div class="py-2 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0"><dt class="text-sm font-medium leading-6 text-gray-900">${t.price_car}</dt><dd class="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">${priceInfo}</dd></div>
                <div class="py-2 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0"><dt class="text-sm font-medium leading-6 text-gray-900">${t.heightLimit}</dt><dd class="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">${carpark.heightLimits?.[0] ? `${carpark.heightLimits[0].height} m` : t.notAvailable}</dd></div>
                <div class="py-2 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0"><dt class="text-sm font-medium leading-6 text-gray-900">${t.remarks}</dt><dd class="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">${remarkText}</dd></div>
            </dl>
            <button id="modal-navigate-btn" data-lat="${carpark.latitude}" data-lon="${carpark.longitude}" class="w-full mt-4 bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors">${t.navigate}</button>
        </div>`;
    
    infoModal.classList.remove('hidden');
    infoModal.classList.add('flex');
    
    document.getElementById('close-modal-btn').addEventListener('click', () => infoModal.classList.add('hidden'));
    document.getElementById('modal-navigate-btn').addEventListener('click', (e) => {
        const lat = e.target.dataset.lat;
        const lon = e.target.dataset.lon;
        infoModal.classList.add('hidden');
        handleNavigation(parseFloat(lat), parseFloat(lon));
    });
}

// -------------------------------------------------
// 7. MAP PLOTTING & LOGIC
// -------------------------------------------------

function plotCarparks() {
    const layer = appState.layers.carparks;
    if (!layer || !appState.map) return;
    layer.clearLayers();
    const icon = createCarparkIcon();
    const bounds = appState.map.getBounds();
    const carparksToDisplay = appState.carparkData.filter(cp => {
        if (!cp.latitude || !cp.longitude) return false;
        if (!bounds.contains([cp.latitude, cp.longitude])) return false;
        if (appState.searchQuery) {
            return (cp.name && cp.name.toLowerCase().includes(appState.searchQuery.toLowerCase())) ||
                   (cp.displayAddress && cp.displayAddress.toLowerCase().includes(appState.searchQuery.toLowerCase()));
        }
        return true;
    });

    carparksToDisplay.forEach(carpark => {
        L.marker([carpark.latitude, carpark.longitude], { icon })
            .addTo(layer)
            .on('click', () => renderInfoModal(carpark));
    });
}

function plotStaticLayer(layerKey, data, iconCreator, popupContentFn) {
    const layer = appState.layers[layerKey];
    if (!layer) return;
    layer.clearLayers();
    const icon = iconCreator();
    data.forEach(item => {
        let lat, lon;
        // Check if it's a GeoJSON feature or a custom object with lat/lon
        if (item.geometry && item.geometry.coordinates) {
            [lon, lat] = item.geometry.coordinates;
        } else if (item.latitude && item.longitude) {
            lat = item.latitude;
            lon = item.longitude;
        }

        if (lat !== undefined && lon !== undefined) {
            const popupHtml = popupContentFn(item, lat, lon);
            L.marker([lat, lon], { icon }).addTo(layer).bindPopup(popupHtml, { maxWidth: 300 });
        }
    });
}

function getTrafficStyle(routeId) {
    const speedInfo = appState.trafficSpeedData[routeId];
    if (!speedInfo || speedInfo.reliability === 0) return { color: '#888888', weight: 3 };
    switch (speedInfo.reliability) {
        case 1: return { color: '#28a745', weight: 4 }; // Green
        case 2: return { color: '#ffc107', weight: 5 }; // Yellow
        case 3: return { color: '#dc3545', weight: 6 }; // Red
        default: return { color: '#888888', weight: 3 };
    }
}

function updateRoadStyles() {
    appState.roadLayers.forEach((line, routeId) => {
        const { color, weight } = getTrafficStyle(routeId);
        line.setStyle({ color, weight });
    });
}

function plotRoadNetwork() {
    const layer = appState.layers.trafficSpeed;
    if (!layer || !appState.map || !appState.visibleLayers.trafficSpeed) return;
    
    const newFeatures = appState.roadNetworkData.filter(feature =>
        feature.properties?.ROUTE_ID && !appState.roadLayers.has(String(feature.properties.ROUTE_ID))
    );

    if (newFeatures.length === 0) return;

    const t = i18n[appState.language];
    newFeatures.forEach(feature => {
        const routeId = String(feature.properties.ROUTE_ID);
        const { color, weight } = getTrafficStyle(routeId);
        const geometry = feature.geometry;
        let latLngs = [];

        if (geometry.type === 'LineString') {
            latLngs = geometry.coordinates.map(coord => L.latLng(coord[1], coord[0]));
        } else if (geometry.type === 'MultiLineString') {
            latLngs = geometry.coordinates.map(line => line.map(coord => L.latLng(coord[1], coord[0])));
        }
        
        if (latLngs.length === 0) return;

        const line = L.polyline(latLngs, { color, weight, opacity: 0.85 });
        const roadName = appState.language === 'en_US' ? feature.properties.ROAD_NAME_ENG : feature.properties.ROAD_NAME_CHI;
        let popupContent = `<strong>${roadName}</strong><br>${t.routeId}: ${routeId}`;
        const speedInfo = appState.trafficSpeedData[routeId];
        if (speedInfo) popupContent += `<br>${t.avgSpeed}: ${speedInfo.speed} km/h`;
        line.bindPopup(popupContent);

        appState.roadLayers.set(routeId, line);
        line.addTo(layer);
    });
}

function plotTurnRestrictionsAlongRoute(route) {
    const layer = appState.layers.routeTurnRestrictions;
    if (!layer || !appState.map) return;
    layer.clearLayers();
    if (!appState.map.hasLayer(layer)) appState.map.addLayer(layer);

    const t = i18n[appState.language];
    const routeCoords = route.coordinates.map(c => L.latLng(c.lat, c.lng));
    
    appState.turnRestrictionsData.forEach(feature => {
        if (!feature.geometry?.coordinates) return;
        const [lon, lat] = feature.geometry.coordinates;
        const point = L.latLng(lat, lon);
        for (const routePoint of routeCoords) {
            if (point.distanceTo(routePoint) < 50) { // 50m buffer
                L.marker(point, { icon: createTurnRestrictionIcon() })
                   .addTo(layer)
                   .bindPopup(`<strong>${t.turnRestrictionWarning}</strong><br>${feature.properties.name}`);
                break;
            }
        }
    });
}

async function plotDynamicLayer(layerKey, fetcherFn, processorFn) {
    const map = appState.map;
    if (!map || !appState.visibleLayers[layerKey]) return;
    const layer = appState.layers[layerKey];
    layer.clearLayers();
    
    try {
        const features = await fetcherFn(map.getBounds());
        processorFn(features);
    } catch (error) {
        console.error(`Failed to plot ${layerKey}:`, error);
    }
}

function updateAllMapLayers() {
    const { visibleLayers, layers, map } = appState;
    Object.keys(layers).forEach(key => {
        const layer = layers[key];
        const isVisible = visibleLayers[key];
        
        if (isVisible && !map.hasLayer(layer)) map.addLayer(layer);
        else if (!isVisible && map.hasLayer(layer)) map.removeLayer(layer);
    });
    // Initial plots for on-demand layers if they are visible
    if (visibleLayers.parkingMeters) plotDynamicLayer('parkingMeters', fetchParkingMetersInBounds, processParkingMeters);
    if (visibleLayers.trafficFeatures) plotDynamicLayer('trafficFeatures', fetchTrafficFeaturesInBounds, processTrafficFeatures);
    if (visibleLayers.toilets) plotDynamicLayer('toilets', fetchToiletsInBounds, processToilets);
    if (visibleLayers.genuineRetailers) plotDynamicLayer('genuineRetailers', fetchGenuineRetailersInBounds, processGenuineRetailers);
}

function processParkingMeters(metersInView) {
    const layer = appState.layers.parkingMeters;
    layer.clearLayers();
    const statusMap = getCachedParkingMeterStatus();
    const groupedMeters = new Map();
    const t = i18n[appState.language];
    const streetKey = appState.language === 'en_US' ? 'Street' : (appState.language === 'zh_TW' ? 'Street_tc' : 'Street_sc');
    const sectionKey = appState.language === 'en_US' ? 'SectionOfStreet' : (appState.language === 'zh_TW' ? 'SectionOfStreet_tc' : 'SectionOfStreet_sc');

    metersInView.forEach(f => {
        if (!f.geometry?.coordinates) return;
        const p = f.properties;
        const [lon, lat] = f.geometry.coordinates;
        const street = p[streetKey] || t.unknown;
        const section = p[sectionKey] || t.unknown;
        const groupingKey = `${street} | ${section}`;

        if (!groupedMeters.has(groupingKey)) {
            groupedMeters.set(groupingKey, {
                latLng: [lat, lon], street, section, totalCount: 0, availableCount: 0, occupiedCount: 0,
                vehicleTypes: new Set(), opPeriods: new Set()
            });
        }
        const group = groupedMeters.get(groupingKey);
        group.totalCount++;
        const status = statusMap.get(p.ParkingSpaceId);
        if (status === 'V') group.availableCount++;
        else if (status === 'O') group.occupiedCount++;
        if (p.VehicleType) group.vehicleTypes.add(p.VehicleType);
        if (p.OperatingPeriod) group.opPeriods.add(p.OperatingPeriod);
    });
    
    groupedMeters.forEach(g => {
        const vehicleTypesHtml = [...g.vehicleTypes].map(code => `<li class="ml-4 list-disc">${decodeCode('vehicle', code)}</li>`).join('');
        const opPeriodsHtml = [...g.opPeriods].map(code => `<li class="ml-4 list-disc">${decodeCode('op', code)}</li>`).join('');
        const pop = `<div class="text-sm w-64"><div class="font-bold text-base mb-1">${g.street}</div><div class="mb-2"><span class="font-semibold">${t.sectionOfStreet}:</span> ${g.section}</div><hr class="my-1"><div class="grid grid-cols-3 gap-x-2 text-center my-2"><div><div class="font-bold text-lg">${g.totalCount}</div><div class="text-xs text-gray-500">${t.totalMeters}</div></div><div><div class="font-bold text-lg text-green-600">${g.availableCount}</div><div class="text-xs text-gray-500">${t.availableMeters}</div></div><div><div class="font-bold text-lg text-red-600">${g.occupiedCount}</div><div class="text-xs text-gray-500">${t.occupiedMeters}</div></div></div><hr class="my-1">${vehicleTypesHtml ? `<div><span class="font-semibold">${t.vehicleType}:</span><ul class="list-none pl-0 mt-1">${vehicleTypesHtml}</ul></div>` : ''}${opPeriodsHtml ? `<div class="mt-2"><span class="font-semibold">${t.operatingPeriod}:</span><ul class="list-none pl-0 mt-1">${opPeriodsHtml}</ul></div>` : ''}<button class="navigate-btn w-full mt-2 bg-blue-600 text-white font-bold py-1 px-2 rounded hover:bg-blue-700" data-lat="${g.latLng[0]}" data-lon="${g.latLng[1]}">${t.navigate}</button></div>`;
        L.marker(g.latLng, { icon: createParkingMeterIcon() }).addTo(layer).bindPopup(pop, { maxWidth: 300 });
    });
}

function processTrafficFeatures(features) {
    const layer = appState.layers.trafficFeatures;
    layer.clearLayers();
    features.forEach(feature => {
        if (!feature.geometry?.coordinates) return;
        const [lon, lat] = feature.geometry.coordinates;
        const icon = createTrafficFeatureIcon(feature.properties.FEATURE_TYPE);
        L.marker(L.latLng(lat, lon), { icon }).addTo(layer);
    });
}

function processToilets(features) {
    const layer = appState.layers.toilets;
    layer.clearLayers();
    const t = i18n[appState.language];
    const nameKey = appState.language === 'en_US' ? 'Name_en' : (appState.language === 'zh_TW' ? 'Name_zh_Hant' : 'Name_zh_Hans');
    const addressKey = appState.language === 'en_US' ? 'Address_en' : (appState.language === 'zh_TW' ? 'Address_zh_Hant' : 'Address_zh_Hans');
    const afcdNameKey = appState.language === 'en_US' ? 'Name_Eng' : 'Name_Chi';

    features.forEach(feature => {
        if (!feature.geometry?.coordinates) return;
        const [lon, lat] = feature.geometry.coordinates;
        const p = feature.properties;
        const name = p[nameKey] || p[afcdNameKey] || t.legendToilet;
        const address = p[addressKey] || '';
        const pop = `<div class="text-sm w-64"><div class="font-bold text-base mb-1">${name}</div>${address ? `<div class="text-xs text-gray-600">${address}</div>` : ''}<button class="navigate-btn w-full mt-2 bg-blue-600 text-white font-bold py-1 px-2 rounded hover:bg-blue-700" data-lat="${lat}" data-lon="${lon}">${t.navigate}</button></div>`;
        L.marker([lat, lon], { icon: createToiletIcon() }).addTo(layer).bindPopup(pop);
    });
}

function extractRetailerCategories(retailers) {
    appState.retailerCategories.clear();
    retailers.forEach(retailer => {
        if (retailer.properties?.Category_of_Merchandise) {
            appState.retailerCategories.add(retailer.properties.Category_of_Merchandise);
        }
        if (retailer.properties?.Category_of_Merchandise_1) {
            appState.retailerCategories.add(retailer.properties.Category_of_Merchandise_1);
        }
    });
}

function getFilteredRetailers() {
    if (appState.selectedRetailerCategories.size === 0) {
        return appState.genuineRetailersData;
    }
    return appState.genuineRetailersData.filter(retailer => {
        const cat1 = retailer.properties?.Category_of_Merchandise;
        const cat2 = retailer.properties?.Category_of_Merchandise_1;
        return appState.selectedRetailerCategories.has(cat1) || appState.selectedRetailerCategories.has(cat2);
    });
}

function stopNavigation() {
    if (appState.routingControl) {
        appState.map.removeControl(appState.routingControl);
        appState.routingControl = null;
    }
    routePanelContainer.innerHTML = '';
    if(appState.layers.routeTurnRestrictions) appState.layers.routeTurnRestrictions.clearLayers();
    if (appState.positionWatchId !== null) {
        navigator.geolocation.clearWatch(appState.positionWatchId);
        appState.positionWatchId = null;
    }
}

function handleNavigation(lat, lon) {
    const { map } = appState;
    if (!map) return;
    map.closePopup();
    stopNavigation();
    const t = i18n[appState.language];
    
    navigator.geolocation.getCurrentPosition(position => {
        const start = L.latLng(position.coords.latitude, position.coords.longitude);
        const end = L.latLng(lat, lon);
        const control = L.Routing.control({
            waypoints: [start, end], routeWhileDragging: false, show: true, addWaypoints: false, fitSelectedRoutes: true,
            router: L.Routing.osrmv1({ profile: 'car' }),
            lineOptions: { styles: [{ color: '#007BFF', opacity: 0.8, weight: 6 }] }
        }).addTo(map);

        control.on('routesfound', e => {
            const route = e.routes[0];
            appState.warnedFeatures.clear();
            plotTurnRestrictionsAlongRoute(route);
            const distance = (route.summary.totalDistance / 1000).toFixed(2);
            const time = Math.round(route.summary.totalTime / 60);
            routePanelContainer.innerHTML = `<div class="bg-white p-3 rounded-lg shadow-lg w-80 max-h-[calc(100vh-8rem)] flex flex-col"><div class="flex justify-between items-center mb-2"><h3 class="font-bold text-lg text-black">${t.navigate}</h3></div><div class="text-sm mb-2 text-black"><p><strong>Distance:</strong> ${distance} km</p><p><strong>Time:</strong> ${time} minutes</p></div><div class="flex-grow overflow-y-auto border-t pt-2"><ol class="list-decimal list-inside space-y-2 text-sm text-black">${route.instructions.map(inst => `<li>${inst.text}</li>`).join('')}</ol></div><button id="stop-nav-btn" class="mt-3 w-full bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 transition-colors">${t.stopNavigation}</button></div>`;
            document.getElementById('stop-nav-btn').addEventListener('click', stopNavigation);
        });
        control.on('routingerror', (e) => showNotification(t.navigationError, false));
        appState.routingControl = control;
    }, () => showNotification(t.locationError, true));
}

// -------------------------------------------------
// 8. EVENT HANDLERS
// -------------------------------------------------

function handleSearch(e) {
    e.preventDefault();
    appState.searchQuery = searchInput.value;
    plotCarparks();
    const t = i18n[appState.language];
    const results = appState.carparkData.filter(cp =>
        (cp.name && cp.name.toLowerCase().includes(appState.searchQuery.toLowerCase())) ||
        (cp.displayAddress && cp.displayAddress.toLowerCase().includes(appState.searchQuery.toLowerCase()))
    );
    if (results.length > 0) {
        const bounds = L.latLngBounds(results.map(cp => [cp.latitude, cp.longitude]));
        if (bounds.isValid()) {
            appState.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
        }
    } else if (appState.searchQuery) {
        alert(t.noResults);
    }
}

function handleClearSearch() {
    searchInput.value = '';
    appState.searchQuery = '';
    clearSearchBtnContainer.classList.add('hidden');
    plotCarparks();
}

// Commented out
// function handleLanguageChange(e) {
//     const newLang = e.target.value;
//     if (newLang === appState.language) return;
    
//     appState.language = newLang;
//     updateLoadingSpinner(true, 'Loading...');
    
//     // Refetch language-dependent data
//     Promise.all([
//         fetchCarparkData(appState.language),
//         fetchOilStationsData(appState.language)
//     ]).then(([carparks, oilStations]) => {
//         appState.carparkData = carparks;
//         appState.oilStationData = oilStations;
        
//         // Re-render all UI and map layers
//         updateLanguageUI();
//         plotCarparks();
//         updateAllStaticLayers();
//         updateLoadingSpinner(false);
//     }).catch(error => {
//         console.error("Failed to reload data for new language:", error);
//         updateLoadingSpinner(false);
//     });
// }

function plotDLOBoundary() {
    const layer = appState.layers.dloBoundary;
    if (!layer || !appState.dloBoundaryData) return;
    layer.clearLayers();
    
    appState.dloBoundaryData.forEach(feature => {
        if (feature.geometry) {
            const geoJsonLayer = L.geoJSON(feature, {
                style: {
                    color: '#000000',
                    weight: 2,
                    opacity: 0.9,
                    fillColor: '#000000',
                    fillOpacity: 0.5
                }
            }).addTo(layer);
            
            // Store reference for opacity control
            feature.geoJsonLayer = geoJsonLayer;
        }
    });
    
    // Add landmark pin with Apple Maps style and star icon
    const starIconSVG = `<svg fill="white" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
    const landmarkIcon = L.divIcon({
        html: `
            <div class="apple-map-pin pin-red">
                <div class="pin-body"></div>
                <div class="pin-icon">${starIconSVG}</div>
            </div>
        `,
        className: 'leaflet-custom-icon-wrapper',
        iconSize: [34, 44],
        iconAnchor: [17, 44],
        popupAnchor: [0, -44]
    });
    
    L.marker([22.381600850401114, 114.2741535913527], { icon: landmarkIcon })
        .addTo(layer)
        .on('click', () => {
            const pinPoint = [114.2741535913527, 22.381600850401114]; // [lng, lat]
            
            // Find the boundary containing this point
            appState.dloBoundaryData.forEach(feature => {
                if (feature.geoJsonLayer && feature.geometry) {
                    const coords = feature.geometry.coordinates;
                    if (feature.geometry.type === 'Polygon' && isPointInPolygon(pinPoint, coords[0])) {
                        feature.geoJsonLayer.eachLayer(sublayer => {
                            sublayer.setStyle({ fillOpacity: 0 });
                        });
                    } else if (feature.geometry.type === 'MultiPolygon') {
                        coords.forEach(polygon => {
                            if (isPointInPolygon(pinPoint, polygon[0])) {
                                feature.geoJsonLayer.eachLayer(sublayer => {
                                    sublayer.setStyle({ fillOpacity: 0 });
                                });
                            }
                        });
                    }
                }
            });
        });
}

function plotPlaceNames() {
    const layer = appState.layers.placeNames;
    if (!layer || !appState.map) return;
    const zoom = appState.map.getZoom();
    if (zoom < 14) {
        if (appState.map.hasLayer(layer)) appState.map.removeLayer(layer);
        return;
    }
    if (!appState.map.hasLayer(layer)) appState.map.addLayer(layer);
}

function updateAllStaticLayers() {
    const t = i18n[appState.language];
    plotStaticLayer('attractions', appState.attractionsData, createAttractionIcon, (f, lat, lon) => `<strong>${f.properties[appState.language === 'en_US' ? 'NAME_EN' : 'NAME_CH']}</strong><br>${f.properties[appState.language === 'en_US' ? 'LOCATION_EN' : 'LOCATION_CH']}<br><button class="navigate-btn w-full mt-1" data-lat="${lat}" data-lon="${lon}">${t.navigate}</button>`);
    plotStaticLayer('viewingPoints', appState.viewingPointsData, createViewingPointIcon, (f, lat, lon) => `<strong>${f.properties[appState.language === 'en_US' ? 'Name_Eng' : 'Name_Chi']}</strong><br><button class="navigate-btn w-full mt-1" data-lat="${lat}" data-lon="${lon}">${t.navigate}</button>`);
    plotStaticLayer('evChargers', appState.evChargerData, createEVChargerIcon, (f, lat, lon) => {
        const p = f.properties;
        const chargerCounts = {'Standard (BS1363)': p.STANDARD_BS1363_no, 'Medium (IEC62196)': p.MEDIUM_IEC62196_no, 'Medium (SAEJ1772)': p.MEDIUM_SAEJ1772_no, 'Medium (Others)': p.MEDIUM_OTHERS_no, 'Quick (CHAdeMO)': p.QUICK_CHAdeMO_no, 'Quick (CCS DC Combo)': p.QUICK_CCS_DC_COMBO_no, 'Quick (IEC62196)': p.QUICK_IEC62196_no, 'Quick (GB/T)': p.QUICK_GB_T20234_3_DC__no, 'Quick (Others)': p.QUICK_OTHERS_no};
        const chargerList = Object.entries(chargerCounts).filter(([, count]) => count > 0).map(([type, count]) => `<li class="ml-4 list-disc">${type}: <strong>${count}</strong></li>`).join('');
        return `<div class="text-sm w-64"><div class="font-bold text-base mb-1">${p[appState.language === 'en_US' ? 'LOCATION_EN' : (appState.language === 'zh_TW' ? 'LOCATION_TC' : 'LOCATION_SC')]}</div><div class="mb-2 text-xs text-gray-600">${p[appState.language === 'en_US' ? 'ADDRESS_EN' : (appState.language === 'zh_TW' ? 'ADDRESS_TC' : 'ADDRESS_SC')]}</div><hr class="my-1">${chargerList ? `<div class="mt-2"><span class="font-semibold">${t.charger_types}:</span><ul class="list-none pl-0 mt-1">${chargerList}</ul></div>` : ''}<button class="navigate-btn w-full mt-2 bg-blue-600 text-white font-bold py-1 px-2 rounded hover:bg-blue-700" data-lat="${lat}" data-lon="${lon}">${t.navigate}</button></div>`;
    });
    plotStaticLayer('oilStations', appState.oilStationData, createOilStationIcon, (station, lat, lon) => {
        const fuelsList = station.fuels.map(fuel => { const price = appState.oilPriceData.get(station.company)?.get(fuel); return `<li class="ml-4 list-disc flex justify-between"><span>${fuel}</span>${price ? `<span class="font-bold text-green-700 ml-2">$${price.toFixed(2)}</span>` : ''}</li>`; }).join('');
        return `<div class="text-sm w-64"><div class="flex items-center mb-1"><div class="w-8 h-8 flex-shrink-0 mr-2 flex items-center justify-center">${OilStationSVG}</div><div class="flex-grow"><div class="font-bold text-base leading-tight">${station.name}</div><div class="text-xs text-gray-500 italic">${station.company}</div></div></div><div class="text-xs text-gray-600 mb-2">${station.address}</div><hr class="my-1">${fuelsList ? `<div class="mt-2"><span class="font-semibold">${t.fuelsAvailable}:</span><ul class="list-none pl-0 mt-1">${fuelsList}</ul></div>` : ''}<button class="navigate-btn w-full mt-2 bg-blue-600 text-white font-bold py-1 px-2 rounded hover:bg-blue-700" data-lat="${lat}" data-lon="${lon}">${t.navigate}</button></div>`;
    });
    plotStaticLayer('turnRestrictions', appState.turnRestrictionsData, createTurnRestrictionIcon, (f) => `<strong>${t.turnRestrictionWarning}</strong><br>${f.properties.name}`);
    plotStaticLayer('permits', appState.permitData, createPermitIcon, (f) => `<strong>Permit ID: ${f.properties.PERMIT_ID}</strong><br>${f.properties.REMARKS || 'No remarks'}`);
    plotStaticLayer('prohibitions', appState.prohibitionData, createProhibitionIcon, (f) => `<strong>Prohibition</strong><br>Type: ${f.properties.EXC_VEH_TYPE}<br>${f.properties.REMARKS || 'No remarks'}`);
    plotPlaceNames();
}

function handleLayerToggle(e) {
    if (e.target.type !== 'checkbox') return;
    const layerKey = e.target.dataset.layer;
    const isVisible = e.target.checked;
    appState.visibleLayers[layerKey] = isVisible;
    updateAllMapLayers();
}

async function handleMapViewChange() {
    if (appState.isFetchingRoads || !appState.visibleLayers.trafficSpeed) return;
    
    // Fetch genuine retailers if layer is visible
    if (appState.visibleLayers.genuineRetailers && appState.map) {
        try {
            const retailers = await fetchGenuineRetailersInBounds(appState.map.getBounds());
            if (retailers && retailers.length > 0) {
                processGenuineRetailers(retailers);
            }
        } catch (error) {
            console.error('Error fetching genuine retailers:', error);
        }
    }
    appState.isFetchingRoads = true;

    const bounds = appState.map.getBounds();
    
    // Fetch road network data
    const newFeatures = await fetchRoadNetworkData(bounds);
    if (newFeatures.length > 0) {
        appState.roadNetworkData = [...appState.roadNetworkData, ...newFeatures.filter(f => !appState.roadNetworkData.some(e => e.properties.ROUTE_ID === f.properties.ROUTE_ID))];
        plotRoadNetwork();
    }
    
    // Fetch and plot genuine retailers
    if (appState.visibleLayers.genuineRetailers) {
        try {
            const retailers = await fetchGenuineRetailersData(bounds);
            if (retailers && retailers.length > 0) {
                appState.genuineRetailersData = retailers;
                processGenuineRetailers(retailers);
            }
        } catch (error) {
            console.error('Error fetching genuine retailers:', error);
        }
    }
    
    appState.isFetchingRoads = false;
}

// --- GENUINE RETAILERS DATA FETCHING ---
async function fetchGenuineRetailersData(bounds) {
    const lowerCorner = `${bounds.getSouth()} ${bounds.getWest()}`;
    const upperCorner = `${bounds.getNorth()} ${bounds.getEast()}`;
    const filter = `<Filter><Intersects><PropertyName>SHAPE</PropertyName><gml:Envelope srsName='EPSG:4326'><gml:lowerCorner>${lowerCorner}</gml:lowerCorner><gml:upperCorner>${upperCorner}</gml:upperCorner></gml:Envelope></Intersects></Filter>`;
    const url = `${API_GENUINE_RETAILERS_URL}&maxFeatures=1000&filter=${encodeURIComponent(filter)}`;
    return fetchGeoJSONData(url);
}



// Process and plot genuine retailers - grouped by location like parking meters
function processGenuineRetailers(retailers) {
    if (!retailers || retailers.length === 0) return;
    extractRetailerCategories(retailers);
    appState.genuineRetailersData = retailers;
    renderRetailerCategoryFilter();
    const layer = appState.layers.genuineRetailers;
    layer.clearLayers();
    const t = i18n[appState.language];
    const filteredRetailers = getFilteredRetailers();

    // Group retailers by unique location (coordinates rounded to 5 decimals)
    const groupedRetailers = new Map();

    filteredRetailers.forEach(retailer => {
        if (!retailer.geometry?.coordinates) return;
        const [lon, lat] = retailer.geometry.coordinates;
        const props = retailer.properties;
        const address = props.Address || 'Unknown Location';
        const category = props.Category_of_Merchandise || 'Unknown';

        // Use rounded coordinates as unique key to prevent grouping shops at different locations
        const locationKey = `${lat.toFixed(5)},${lon.toFixed(5)}`;
        
        if (!groupedRetailers.has(locationKey)) {
            groupedRetailers.set(locationKey, {
                latLng: [lat, lon],
                address: address,
                retailers: [],
                categories: new Set()
            });
        }

        const group = groupedRetailers.get(locationKey);
        group.retailers.push({
            name: props.Retailer_Name || 'Unknown',
            category: category,
            telephone: props.Telephone || 'N/A'
        });
        group.categories.add(category);
    });
    
    // Plot grouped retailers
    groupedRetailers.forEach(group => {
        const maxDisplay = 5;
        const displayRetailers = group.retailers.slice(0, maxDisplay);
        const remaining = group.retailers.length - maxDisplay;
        
        const retailersHtml = displayRetailers.map(r => `
            <div class="mb-2 pb-2 border-b border-gray-200 last:border-0">
                <div class="font-bold text-sm">${r.name}</div>
                <div class="text-xs text-gray-600">${t.telephone}: ${r.telephone}</div>
                <div class="text-xs text-gray-500">${r.category}</div>
            </div>
        `).join('');

        const pop = `<div class="text-sm w-64">
            <div class="mb-2">
                <div class="font-semibold text-xs text-gray-700 mb-1">${t.retailers} (${group.retailers.length}):</div>
                <div class="max-h-60 overflow-y-auto">${retailersHtml}</div>
                ${remaining > 0 ? `<div class="text-xs text-gray-500 mt-2 italic">+${remaining} more...</div>` : ''}
            </div>
            <div class="mb-2">
                <span class="font-semibold text-xs text-gray-700">${t.address}:</span>
                <div class="text-xs mt-1">${group.address}</div>
            </div>
            <button class="navigate-btn w-full mt-2 bg-blue-600 text-white font-bold py-1 px-2 rounded hover:bg-blue-700" data-lat="${group.latLng[0]}" data-lon="${group.latLng[1]}">${t.navigate}</button>
        </div>`;

        L.marker(group.latLng, { icon: createRetailerIcon() }).addTo(layer).bindPopup(pop, { maxWidth: 300 });
    });
}

// Update retailer category filter UI
function renderRetailerCategoryFilter() {
    if (appState.retailerCategories.size === 0) return;
    const categories = Array.from(appState.retailerCategories).sort();
    const filterHtml = categories.map(cat => `
        <label class="flex items-center space-x-2 cursor-pointer text-sm text-gray-800">
            <input type="checkbox" data-category="${cat}" ${appState.selectedRetailerCategories.has(cat) ? 'checked' : ''} class="retailer-filter-checkbox h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"/>
            <span>${cat}</span>
        </label>
    `).join('');

    const filterContainer = document.getElementById('retailer-filter-container');
    if (filterContainer && filterHtml) {
        filterContainer.innerHTML = filterHtml;
        document.querySelectorAll('.retailer-filter-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const category = e.target.dataset.category;
                if (e.target.checked) {
                    appState.selectedRetailerCategories.add(category);
                } else {
                    appState.selectedRetailerCategories.delete(category);
                }
                const layer = appState.layers.genuineRetailers;
                if (layer) layer.clearLayers();
                processGenuineRetailers(appState.genuineRetailersData);
            });
        });
    }
}

// -------------------------------------------------
// 9. INITIALIZATION
// -------------------------------------------------
async function init() {
    const t = i18n[appState.language];
    updateLoadingSpinner(true, t.initialLoadMessage);
    updateLanguageUI();

    // Initialize map first
    appState.map = L.map(mapContainer, { zoomControl: false }).setView([22.3193, 114.1694], 12);
    L.control.zoom({ position: 'bottomright' }).addTo(appState.map);
    L.tileLayer('https://mapapi.geodata.gov.hk/gs/api/v1.0.0/xyz/basemap/wgs84/{z}/{x}/{y}.png', {
        attribution: '<a href="https://api.portal.hkmapservice.gov.hk/disclaimer" target="_blank">&copy; Map info from Lands Dept.</a>',
        maxZoom: 20, minZoom: 3
    }).addTo(appState.map);
    
    // Initialize layers
    Object.keys(appState.visibleLayers).forEach(key => {
        if (key === 'placeNames') {
            const lang = appState.language === 'en_US' ? 'en' : 'tc';
            appState.layers[key] = L.tileLayer(`https://mapapi.geodata.gov.hk/gs/api/v1.0.0/xyz/label/hk/${lang}/WGS84/{z}/{x}/{y}.png`, {
                maxZoom: 20,
                minZoom: 14,
                opacity: 1
            });
        } else {
            appState.layers[key] = L.layerGroup();
        }
    });
    appState.layers.routeTurnRestrictions = L.layerGroup();
    
    updateAllMapLayers(); // Add initially visible layers
    // Attach event listeners with null checks
    if (searchForm) {
        searchForm.addEventListener('submit', handleSearch);
    }
    
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            if (clearSearchBtnContainer) {
                clearSearchBtnContainer.classList.toggle('hidden', !e.target.value);
            }
        });
    }
    
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', handleClearSearch);
    }
    
    if (locateUserBtn) {
        locateUserBtn.addEventListener('click', () => appState.map.locate({ setView: true, maxZoom: 16 }));
    }
    
    // Fix language switcher - use change event for select element
    if (langSwitcher) {
        langSwitcher.addEventListener('change', function(e) {
            const newLang = e.target.value;
            if (newLang === appState.language) return;
            
            appState.language = newLang;
            updateLoadingSpinner(true, 'Loading...');
            
            // Refetch language-dependent data
            Promise.all([
                fetchCarparkData(appState.language),
                fetchOilStationsData(appState.language)
            ]).then(([carparks, oilStations]) => {
                appState.carparkData = carparks;
                appState.oilStationData = oilStations;
                
                // Re-render all UI and map layers
                updateLanguageUI();
                plotCarparks();
                updateAllStaticLayers();
                updateLoadingSpinner(false);
            }).catch(error => {
                console.error("Failed to reload data for new language:", error);
                updateLoadingSpinner(false);
            });
        });
    }
    
    if (layerControlContainer) {
        layerControlContainer.addEventListener('change', handleLayerToggle);
    }
    
    if (infoModal) {
        infoModal.addEventListener('click', () => { 
            infoModal.classList.add('hidden'); 
            infoModal.classList.remove('flex'); 
        });
    }
    
    if (infoModalContent) {
        infoModalContent.addEventListener('click', (e) => e.stopPropagation());
    }
    
    // Map event handlers
    appState.map.on('locationfound', (e) => {
        if (appState.userLocationMarker) {
            appState.userLocationMarker.setLatLng(e.latlng);
        } else {
            appState.userLocationMarker = L.marker(e.latlng).addTo(appState.map).bindPopup(t.userLocationPopup.replace('{accuracy}', e.accuracy.toFixed(0)));
        }
    });
    
    appState.map.on('popupopen', (e) => {
        const popupElement = e.popup.getElement();
        if (popupElement) {
            const navBtn = popupElement.querySelector('.navigate-btn');
            if(navBtn?.dataset.lat && navBtn?.dataset.lon) {
                navBtn.onclick = () => handleNavigation(parseFloat(navBtn.dataset.lat), parseFloat(navBtn.dataset.lon));
            }
        }
    });
    
    const handleMapEvents = () => {
        handleMapViewChange();
        if (appState.visibleLayers.carparks) plotCarparks();
        plotDynamicLayer('parkingMeters', fetchParkingMetersInBounds, processParkingMeters);
        plotDynamicLayer('trafficFeatures', fetchTrafficFeaturesInBounds, processTrafficFeatures);
        plotDynamicLayer('toilets', fetchToiletsInBounds, processToilets);
        plotPlaceNames();
    };
    
    appState.map.on('moveend', handleMapEvents);
    appState.map.on('zoomend', handleMapEvents);

    await loadInitialData();
    
    // Set up traffic speed refresh interval (30 seconds)
    setInterval(async () => {
        try {
            appState.trafficSpeedData = await fetchTrafficSpeedData();
            updateRoadStyles();
        } catch (error) { 
            console.error("Failed to refresh traffic speed data:", error); 
        }
    }, 30000);
}


async function loadInitialData() {
    updateApiProgress(0, 'Starting data load...');
    
    try {
        const promises = [
            fetchCarparkData(appState.language),
            fetchGeoJSONData(API_ATTRACTIONS_URL, 'attractions'),
            fetchGeoJSONData(API_VIEWING_POINTS_URL, 'viewingPoints'),
            fetchGeoJSONData(API_EV_CHARGERS_URL, 'evChargers'),
            fetchTurnRestrictionsData(),
            fetchGeoJSONData(API_PERMIT_URL),
            fetchProhibitionData(),
            fetchTrafficSpeedData(),
            fetchOilStationsData(appState.language),
            fetchOilPriceData(),
            fetchInitialParkingMeterStatus(),
            fetchGeoJSONData(API_DLO_BOUNDARY_URL),
        ];

        const results = await Promise.allSettled(promises);
        
        // Process results with error handling
        const [
            carparks, attractions, viewingPoints, evChargers,
            turnRestrictions, permits, prohibitions, trafficSpeeds,
            oilStations, oilPrices, placeNames, dloBoundary
        ] = results.map((result, index) => {
            if (result.status === 'fulfilled') {
                updateApiProgress(10 + (index * 8), `Loaded data source ${index + 1}/${promises.length}`);
                return result.value;
            } else {
                console.error(`Promise ${index} rejected:`, result.reason);
                return []; // Return empty array for failed requests
            }
        });

        // Assign data to state
        appState.carparkData = carparks || [];
        appState.attractionsData = attractions || [];
        appState.viewingPointsData = viewingPoints || [];
        appState.evChargerData = evChargers || [];
        appState.turnRestrictionsData = turnRestrictions || [];
        appState.permitData = permits || [];
        appState.prohibitionData = prohibitions || [];
        appState.trafficSpeedData = trafficSpeeds || {};
        appState.oilStationData = oilStations || [];
        appState.oilPriceData = oilPrices || new Map();
        appState.dloBoundaryData = dloBoundary || [];


        // Update UI
        plotCarparks();
        updateAllStaticLayers();
        plotDLOBoundary();
        renderOilPricePanel();

        // Show success message
        const loadedCount = [
            carparks, attractions, viewingPoints, evChargers,
            turnRestrictions, permits, prohibitions, oilStations
        ].filter(data => data && data.length > 0).length;
        
        console.log(`Successfully loaded ${loadedCount}/8 data sources`);
        updateApiProgress(100, 'Data loading complete!');

    } catch (error) {
        console.error("Critical error in loadInitialData:", error);
        showNotification('Some data failed to load. The app will continue with available data.', false);
        updateApiProgress(100, 'Data loading completed with errors');
    } finally {
        setTimeout(() => {
            updateLoadingSpinner(false);
        }, 1000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Initialize UI controls first
    setupUIControls(); 
    
    // Update UI and language
    updateLanguageUI();
    renderLegend();
    
    // Then initialize the app
    init();
});
