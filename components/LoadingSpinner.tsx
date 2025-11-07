
import React from 'react';

export const LoadingSpinner: React.FC = () => (
    <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-[5000]">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div>
    </div>
);
