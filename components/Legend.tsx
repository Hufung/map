import React, { useState } from 'react';
import { Language } from '../types';
import { i18n } from '../constants';
import { CarparkSVG, AttractionSVG, ViewingPointSVG, ParkingMeterSVG, PermitSVG, ProhibitionSVG } from './MapIcons';

interface LegendProps {
    language: Language;
}

const LegendRow: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
    <div className="flex items-center space-x-2">
        <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">{icon}</div>
        <span className="text-xs text-gray-700">{label}</span>
    </div>
);

export const Legend: React.FC<LegendProps> = ({ language }) => {
    const t = i18n[language];
    const [isOpen, setIsOpen] = useState(true);

    if (!isOpen) {
        return (
            <div className="absolute top-20 right-4 z-[1000]">
                <button
                    onClick={() => setIsOpen(true)}
                    className="bg-white p-2 rounded-lg shadow-lg hover:bg-gray-100 transition-colors"
                    title={t.legendTitle}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M5 3a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2H5zM13 13H7v-1h6v1zm0-3H7V9h6v1zm0-3H7V6h6v1z" />
                    </svg>
                </button>
            </div>
        );
    }
    
    return (
        <div className="absolute top-20 right-4 z-[1000] bg-white bg-opacity-90 p-2 rounded-lg shadow-lg w-48">
            <div className="flex justify-between items-center mb-1">
                <h4 className="font-bold text-sm text-gray-800">{t.legendTitle}</h4>
                <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-gray-800 text-xl font-bold">&times;</button>
            </div>
            <div className="space-y-1.5">
                <LegendRow icon={<div className="w-full h-full flex items-center justify-center bg-blue-600 rounded-full p-0.5"><CarparkSVG/></div>} label={t.legendCarPark} />
                <LegendRow icon={<div className="w-full h-full flex items-center justify-center bg-green-500 rounded-full"><AttractionSVG/></div>} label={t.legendAttraction} />
                <LegendRow icon={<div className="w-full h-full flex items-center justify-center bg-amber-500 rounded-full p-0.5"><ViewingPointSVG/></div>} label={t.legendViewingPoint} />
                <LegendRow icon={<div className="w-full h-full flex items-center justify-center bg-purple-500 rounded-full p-0.5"><ParkingMeterSVG/></div>} label={t.legendParkingMeter} />
                <LegendRow icon={<div className="w-full h-full flex items-center justify-center bg-orange-500 rounded-full p-0.5"><PermitSVG/></div>} label={t.legendPermit} />
                <LegendRow icon={<div className="w-full h-full flex items-center justify-center bg-red-600 rounded-full p-0.5"><ProhibitionSVG/></div>} label={t.legendProhibition} />
                <LegendRow icon={<div className="w-full h-full flex items-center justify-center bg-red-500 text-white font-bold rounded-full text-sm">&#8635;</div>} label={t.legendTurnRestriction} />
                <LegendRow icon={<div className="w-full h-full flex items-center justify-center bg-slate-600 text-white font-bold rounded-full text-xs">Z</div>} label={t.legendZebraCrossing} />
                <LegendRow icon={<div className="w-full h-full flex items-center justify-center bg-yellow-500 text-black font-bold rounded-full text-xs">Y</div>} label={t.legendYellowBox} />
                <LegendRow icon={<div className="w-full h-full flex items-center justify-center bg-cyan-500 text-white font-bold rounded-full text-xs">$</div>} label={t.legendTollPlaza} />
                <LegendRow icon={<div className="w-full h-full flex items-center justify-center bg-red-700 text-white font-bold rounded-full text-xs">C</div>} label={t.legendCulDeSac} />
                <hr/>
                <LegendRow icon={<div className="w-4 h-1.5 bg-[#28a745] my-2"></div>} label={t.legendTrafficSmooth} />
                <LegendRow icon={<div className="w-4 h-1.5 bg-[#ffc107] my-2"></div>} label={t.legendTrafficSlow} />
                <LegendRow icon={<div className="w-4 h-1.5 bg-[#dc3545] my-2"></div>} label={t.legendTrafficCongested} />
            </div>
        </div>
    );
};
