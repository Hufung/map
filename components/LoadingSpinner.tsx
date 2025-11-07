import React from 'react';
import { Language } from '../types';
import { i18n } from '../constants';

interface LoadingSpinnerProps {
    language: Language;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ language }) => {
    const t = i18n[language];

    return (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex flex-col items-center justify-center z-[5000] space-y-4">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div>
            <p className="text-gray-700 font-semibold">{t.initialLoadMessage}</p>
        </div>
    );
};