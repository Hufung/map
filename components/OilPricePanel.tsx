import React, { useState, useMemo } from 'react';
import { Language, OilPriceData } from '../types';
import { i18n } from '../constants';

interface OilPricePanelProps {
    language: Language;
    oilPriceData: OilPriceData;
}

export const OilPricePanel: React.FC<OilPricePanelProps> = ({ language, oilPriceData }) => {
    const t = i18n[language];
    const [isOpen, setIsOpen] = useState(true);

    const { companies, fuelTypes, priceGrid } = useMemo(() => {
        if (!oilPriceData || oilPriceData.size === 0) {
            return { companies: [], fuelTypes: [], priceGrid: [] };
        }

        const companies = Array.from(oilPriceData.keys()).sort();
        const fuelTypesSet = new Set<string>();
        oilPriceData.forEach(fuelMap => {
            fuelMap.forEach((_, fuelType) => fuelTypesSet.add(fuelType));
        });
        const fuelTypes = Array.from(fuelTypesSet).sort();
        
        const priceGrid = fuelTypes.map(fuel => {
            return companies.map(company => {
                const price = oilPriceData.get(company)?.get(fuel);
                return price ? `$${price.toFixed(2)}` : '-';
            });
        });

        return { companies, fuelTypes, priceGrid };
    }, [oilPriceData]);

    if (!isOpen) {
        return (
            <div className="absolute bottom-4 left-4 z-[1000]">
                <button
                    onClick={() => setIsOpen(true)}
                    className="bg-white p-2 rounded-lg shadow-lg hover:bg-gray-100 transition-colors"
                    title={t.fuelPricesTitle}
                >
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M8.433 7.418c.158-.103.346-.196.567-.267v1.698a2.5 2.5 0 00-.567-.267C8.07 8.484 8 8.731 8 9c0 .269.07.516.433.582.221.07.409.164.567.267v1.698c-.221.07-.409.164-.567.267C8.07 11.516 8 11.731 8 12c0 .269.07.516.433.582.221.07.409.164.567.267v1.698a2.5 2.5 0 00.567-.267c.364-.238.433-.484.433-.582 0-.269-.07-.516-.433-.582a2.5 2.5 0 00-.567-.267V9.865c.221-.07.409-.164.567-.267.364-.238.433-.484.433-.582s-.07-.516-.433-.582z" />
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v1.095a3.5 3.5 0 00-1.838 2.377 1 1 0 101.74.922 1.5 1.5 0 011.098-1.584V8a1 1 0 102 0v.009a1.5 1.5 0 011.098 1.584 1 1 0 101.74-.922A3.5 3.5 0 0011 6.095V5a1 1 0 10-2 0v1zm-1 9a1 1 0 102 0v-1.095a3.5 3.5 0 001.838-2.377 1 1 0 10-1.74-.922A1.5 1.5 0 0111 11.416V12a1 1 0 10-2 0v-.009a1.5 1.5 0 01-1.098-1.584 1 1 0 10-1.74.922A3.5 3.5 0 009 13.905V15a1 1 0 102 0v-1z" clipRule="evenodd" />
                    </svg>
                </button>
            </div>
        );
    }
    
    if (companies.length === 0) {
        return null; // Don't show anything if there's no price data
    }

    return (
        <div className="absolute bottom-4 left-4 z-[1000] bg-white bg-opacity-95 p-2 rounded-lg shadow-lg w-auto max-w-sm md:max-w-md lg:max-w-lg max-h-[40vh] flex flex-col">
            <div className="flex justify-between items-center mb-1 pb-1 border-b">
                <h4 className="font-bold text-sm text-gray-800">{t.fuelPricesTitle}</h4>
                <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-gray-800 text-xl font-bold">&times;</button>
            </div>
            <div className="overflow-auto text-xs">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="p-1.5 text-left font-semibold text-gray-600 border border-gray-200 sticky top-0 bg-gray-100">Fuel Type</th>
                            {companies.map(company => (
                                <th key={company} className="p-1.5 text-center font-semibold text-gray-600 border border-gray-200 sticky top-0 bg-gray-100 whitespace-nowrap">{company}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {fuelTypes.map((fuel, rowIndex) => (
                            <tr key={fuel} className="even:bg-gray-50">
                                <td className="p-1.5 font-medium text-gray-700 border border-gray-200 whitespace-nowrap">{fuel}</td>
                                {priceGrid[rowIndex].map((price, colIndex) => (
                                    <td key={companies[colIndex]} className="p-1.5 text-center text-gray-800 border border-gray-200">{price}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
