import L from 'leaflet';
import ReactDOMServer from 'react-dom/server';
import React from 'react';

const createIcon = (className: string, innerHtml: React.ReactElement, size: [number, number] = [32, 32]) => {
    const html = ReactDOMServer.renderToString(innerHtml);
    const anchor = size[0] / 2;
    return L.divIcon({
        className,
        html,
        iconSize: size,
        iconAnchor: [anchor, size[1]], // Anchor at bottom-center
        popupAnchor: [0, -size[1]]
    });
};

export const CarparkSVG = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white">
        <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11C5.84 5 5.28 5.42 5.08 6.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
    </svg>
);
export const createCarparkIcon = () => createIcon('flex items-center justify-center bg-blue-600 rounded-full border-2 border-white shadow-lg p-1', <CarparkSVG />);

export const AttractionSVG = () => (
    <svg viewBox="0 0 20 20" className="w-5 h-5 fill-white"><path d="M10 1.25l-7.5 15h15l-7.5-15zm-2.19 10l-1.81 3.62h7.79l-1.81-3.62-1.09 2.18-1.09-2.18z"/></svg>
);
export const createAttractionIcon = () => createIcon('flex items-center justify-center bg-green-500 rounded-full border-2 border-white shadow-lg', <AttractionSVG />, [28,28]);

export const ViewingPointSVG = () => (
    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zm0 13c-3.31 0-6-2.69-6-6s2.69-6 6-6s6 2.69 6 6s-2.69 6-6 6zm0-10c-2.21 0-4 1.79-4 4s1.79 4 4 4s4-1.79 4-4s-1.79-4-4-4z"/></svg>
);
export const createViewingPointIcon = () => createIcon('flex items-center justify-center bg-amber-500 rounded-full border-2 border-white shadow-lg', <ViewingPointSVG />, [28,28]);

export const ParkingMeterSVG = () => (
    <svg viewBox="0 0 20 20" className="w-5 h-5 fill-white"><path d="M18.9 6.2c-.4-.5-1-.8-1.7-.8H2.8c-.7 0-1.3.3-1.7.8c-.4.5-.6 1.1-.6 1.7v6.2c0 .6.2 1.2.6 1.7c.4.5 1 .8 1.7.8h.6c.4 0 .7.3.7.7v.7c0 .4.3.7.7.7h1.4c.4 0 .7-.3.7-.7v-.7c0-.4.3-.7.7-.7h7.2c.4 0 .7.3.7.7v.7c0 .4.3.7.7.7h1.4c.4 0 .7-.3.7-.7v-.7c0-.4.3-.7.7-.7h.6c.7 0 1.3-.3 1.7-.8c.4-.5.6-1.1.6-1.7V7.9c0-.6-.2-1.2-.6-1.7zM3.9 13.1c-.8 0-1.4-.6-1.4-1.4s.6-1.4 1.4-1.4s1.4.6 1.4 1.4s-.6 1.4-1.4 1.4zm12.2 0c-.8 0-1.4-.6-1.4-1.4s.6-1.4 1.4-1.4s1.4.6 1.4 1.4s-.6 1.4-1.4 1.4zM18 9H2V7.9c0-.1 0-.2.1-.3l.1-.1h15.6c.1 0 .2 0 .3.1l.1.3V9z"/></svg>
);
export const createParkingMeterIcon = () => createIcon('flex items-center justify-center bg-purple-500 rounded-full border-2 border-white shadow-lg', <ParkingMeterSVG />, [28,28]);

export const PermitSVG = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
        <path d="M9 9H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7a1 1 0 10-2 0v2z" />
        <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fontSize="12" fill="white" dy=".3em">P</text>
    </svg>
);
export const createPermitIcon = () => createIcon('flex items-center justify-center bg-orange-500 rounded-full border-2 border-white shadow-lg', <PermitSVG />, [28, 28]);


export const ProhibitionSVG = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-white">
       <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
   </svg>
);
export const createProhibitionIcon = () => createIcon('flex items-center justify-center bg-red-600 rounded-full border-2 border-white shadow-lg', <ProhibitionSVG />, [28,28]);


export const createTurnRestrictionIcon = () => L.divIcon({
    className: 'flex items-center justify-center bg-red-500 text-white font-bold rounded-full border-2 border-white shadow-lg text-lg',
    html: '<span>&#8635;</span>', // Unicode for ↺
    iconSize: [24, 24],
    iconAnchor: [12, 12]
});

export const createTrafficFeatureIcon = (featureType: 1 | 2 | 3 | 4) => {
    let bgColor = 'bg-gray-400';
    let content = '?';
    switch (featureType) {
        case 1: bgColor = 'bg-slate-600'; content = 'Z'; break; // Zebra
        case 2: bgColor = 'bg-yellow-500 text-black'; content = 'Y'; break; // Yellow Box
        case 3: bgColor = 'bg-cyan-500'; content = '$'; break; // Toll
        case 4: bgColor = 'bg-red-700'; content = 'C'; break; // Cul-de-sac
    }
    return L.divIcon({
        className: `flex items-center justify-center ${bgColor} font-bold rounded-full border-2 border-white shadow-md text-xs`,
        html: `<span>${content}</span>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });
};