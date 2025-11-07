
import React from 'react';
import { Language } from '../types';

interface HeaderProps {
    language: Language;
    onLanguageChange: (lang: Language) => void;
    onLocateUser: () => void;
}

const LanguageButton: React.FC<{
    lang: Language;
    currentLang: Language;
    onClick: (lang: Language) => void;
    children: React.ReactNode;
}> = ({ lang, currentLang, onClick, children }) => {
    const isActive = lang === currentLang;
    const activeClasses = 'bg-blue-600 text-white';
    const inactiveClasses = 'bg-white text-gray-700 hover:bg-gray-100';
    return (
        <button
            onClick={() => onClick(lang)}
            className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${isActive ? activeClasses : inactiveClasses}`}
        >
            {children}
        </button>
    );
};

export const Header: React.FC<HeaderProps> = ({ language, onLanguageChange, onLocateUser }) => {
    return (
        <div className="absolute top-4 right-4 z-[1000] flex items-center space-x-2">
            <div className="bg-white rounded-lg shadow-md p-1 flex space-x-1">
                <LanguageButton lang="en_US" currentLang={language} onClick={onLanguageChange}>EN</LanguageButton>
                <LanguageButton lang="zh_TW" currentLang={language} onClick={onLanguageChange}>繁</LanguageButton>
                <LanguageButton lang="zh_CN" currentLang={language} onClick={onLanguageChange}>简</LanguageButton>
            </div>
            <button
                onClick={onLocateUser}
                className="bg-white rounded-lg shadow-md p-2 flex items-center justify-center cursor-pointer hover:bg-gray-100"
                title="Find my location"
            >
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12a3 3 0 116 0 3 3 0 01-6 0z"></path>
                </svg>
            </button>
        </div>
    );
};
