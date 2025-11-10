import React from 'react';
import { Language, VisibleLayers } from '../types';
import { i18n } from '../constants';

interface LayerControlProps {
    language: Language;
    visibleLayers: VisibleLayers;
    onVisibilityChange: (layers: VisibleLayers) => void;
}

const Checkbox: React.FC<{
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}> = ({ label, checked, onChange }) => (
    <label className="flex items-center space-x-2 cursor-pointer text-sm text-gray-800">
        <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span>{label}</span>
    </label>
);

export const LayerControl: React.FC<LayerControlProps> = ({ language, visibleLayers, onVisibilityChange }) => {
    const t = i18n[language];

    const handleChange = (layer: keyof VisibleLayers, isVisible: boolean) => {
        onVisibilityChange({
            ...visibleLayers,
            [layer]: isVisible,
        });
    };

    return (
        <div className="absolute top-20 left-4 z-[1000] bg-white p-3 rounded-lg shadow-md space-y-2">
            <Checkbox
                label={t.toggleCarParks}
                checked={visibleLayers.carparks}
                onChange={(c) => handleChange('carparks', c)}
            />
            <Checkbox
                label={t.toggleAttractions}
                checked={visibleLayers.attractions}
                onChange={(c) => handleChange('attractions', c)}
            />
            <Checkbox
                label={t.toggleViewingPoints}
                checked={visibleLayers.viewingPoints}
                onChange={(c) => handleChange('viewingPoints', c)}
            />
            <Checkbox
                label={t.toggleEVChargers}
                checked={visibleLayers.evChargers}
                onChange={(c) => handleChange('evChargers', c)}
            />
            <Checkbox
                label={t.toggleParkingMeters}
                checked={visibleLayers.parkingMeters}
                onChange={(c) => handleChange('parkingMeters', c)}
            />
             <Checkbox
                label={t.toggleOilStations}
                checked={visibleLayers.oilStations}
                onChange={(c) => handleChange('oilStations', c)}
            />
             <Checkbox
                label={t.togglePermits}
                checked={visibleLayers.permits}
                onChange={(c) => handleChange('permits', c)}
            />
            <Checkbox
                label={t.toggleProhibitions}
                checked={visibleLayers.prohibitions}
                onChange={(c) => handleChange('prohibitions', c)}
            />
            <Checkbox
                label={t.toggleTurnRestrictions}
                checked={visibleLayers.turnRestrictions}
                onChange={(c) => handleChange('turnRestrictions', c)}
            />
            <Checkbox
                label={t.toggleTrafficFeatures}
                checked={visibleLayers.trafficFeatures}
                onChange={(c) => handleChange('trafficFeatures', c)}
            />
            <Checkbox
                label={t.toggleTrafficSpeed}
                checked={visibleLayers.trafficSpeed}
                onChange={(c) => handleChange('trafficSpeed', c)}
            />
        </div>
    );
};