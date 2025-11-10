import React from 'react';
import L from 'leaflet';
import { Language } from '../types';
import { i18n } from '../constants';

// Fix: Removed leaflet module augmentation. The types from leaflet-routing-machine are available globally
// and the augmentation was causing redeclaration errors.

interface RoutePanelProps {
    // Fix: Use L.Routing.IRoute as the correct type for a route object.
    route: L.Routing.IRoute;
    onStop: () => void;
    language: Language;
}

export const RoutePanel: React.FC<RoutePanelProps> = ({ route, onStop, language }) => {
    const t = i18n[language];
    const { summary, instructions } = route;
    const distance = (summary.totalDistance / 1000).toFixed(2);
    const time = Math.round(summary.totalTime / 60);

    return (
        <div className="absolute top-28 right-4 z-[1000] bg-white p-3 rounded-lg shadow-lg w-80 max-h-[calc(100vh-8rem)] flex flex-col">
            <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-lg text-black">{t.navigate}</h3>
            </div>
            <div className="text-sm mb-2 text-black">
                <p><strong>Distance:</strong> {distance} km</p>
                <p><strong>Time:</strong> {time} minutes</p>
            </div>
            <div className="flex-grow overflow-y-auto border-t pt-2">
                <ol className="list-decimal list-inside space-y-2 text-sm text-black">
                    {instructions.map((inst, index) => (
                        <li key={index}>{inst.text}</li>
                    ))}
                </ol>
            </div>
            <button
                onClick={onStop}
                className="mt-3 w-full bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 transition-colors"
            >
                {t.stopNavigation}
            </button>
        </div>
    );
};