import React, { useState } from 'react';
import { Language } from '../types';
import { i18n } from '../constants';

interface HeaderProps {
    language: Language;
    onLanguageChange: (lang: Language) => void;
    onLocateUser: () => void;
    onSearch: (query: string) => void;
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

export const Header: React.FC<HeaderProps> = ({ language, onLanguageChange, onLocateUser, onSearch }) => {
    const t = i18n[language];
    const [query, setQuery] = useState('');

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSearch(query);
    };

    const handleClearSearch = () => {
        setQuery('');
        onSearch('');
    };

    return (
        <div className="absolute top-0 left-0 right-0 z-[1000] p-4 flex justify-between items-center pointer-events-none">
            <div className="flex-1 max-w-md pointer-events-auto">
                <form onSubmit={handleSearchSubmit} className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                         <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"></path>
                        </svg>
                    </div>
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={t.searchPlaceholder}
                        className="block w-full bg-white border border-gray-300 rounded-lg py-2 pl-10 pr-10 leading-5 text-gray-900 placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm shadow-md"
                    />
                    {query && (
                         <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                            <button
                                type="button"
                                onClick={handleClearSearch}
                                className="text-gray-400 hover:text-gray-600"
                                aria-label="Clear search"
                            >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"></path>
                                </svg>
                            </button>
                        </div>
                    )}
                </form>
            </div>
            <div className="flex items-center space-x-2 pointer-events-auto">
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
        </div>
    );
};