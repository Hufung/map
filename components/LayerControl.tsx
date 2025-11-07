import React from 'react';
import { Language, VisibleLayers } from '../types';
import { i18n } from '../constants';

interface LayerControlProps {
    language: Language;
    visibleLayers: VisibleLayers;
    onVisibilityChange: (layers: VisibleLayers) => void;
    trafficLayerError?: boolean;
    onRetryLoadRoadNetwork?: () => void;
    isTrafficLoading?: boolean;
}

const Checkbox: React.FC<{
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
}> = ({ label, checked, onChange, disabled = false }) => (
    <label className={`flex items-center space-x-2 text-sm text-gray-800 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
        <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
            disabled={disabled}
        />
        <span>{label}</span>
    </label>
);

export const LayerControl: React.FC<LayerControlProps> = ({ 
    language, 
    visibleLayers, 
    onVisibilityChange, 
    trafficLayerError = false, 
    onRetryLoadRoadNetwork,
    isTrafficLoading = false
}) => {
    const t = i18n[language];

    const handleChange = (layer: keyof VisibleLayers, isVisible: boolean) => {
        onVisibilityChange({
            ...visibleLayers,
            [layer]: isVisible,
        });
    };

    return (
        <div className="absolute top-4 left-4 z-[1000] bg-white p-3 rounded-lg shadow-md space-y-2">
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
                label={t.toggleParkingMeters}
                checked={visibleLayers.parkingMeters}
                onChange={(c) => handleChange('parkingMeters', c)}
            />
            <div className="flex items-center space-x-2">
                <Checkbox
                    label={t.toggleTrafficSpeed}
                    checked={!trafficLayerError && visibleLayers.trafficSpeed}
                    onChange={(c) => handleChange('trafficSpeed', c)}
                    disabled={trafficLayerError || isTrafficLoading}
                />
                {isTrafficLoading && (
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500"></div>
                )}
                {trafficLayerError && !isTrafficLoading && (
                    <button 
                        onClick={onRetryLoadRoadNetwork}
                        className="text-xs bg-blue-500 hover:bg-blue-600 text-white font-bold py-1 px-2 rounded"
                        title="Failed to load traffic map data, please retry."
                    >
                        {t.retry}
                    </button>
                )}
            </div>
        </div>
    );
};