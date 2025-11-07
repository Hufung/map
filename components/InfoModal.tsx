import React from 'react';
import { Carpark, Language } from '../types';
import { i18n } from '../constants';

interface InfoModalProps {
    carpark: Carpark;
    language: Language;
    onClose: () => void;
    onNavigate: (lat: number, lon: number) => void;
}

const InfoRow: React.FC<{ label: string; value: React.ReactNode; isBold?: boolean; className?: string }> = ({ label, value, isBold, className = '' }) => (
    <div className={`py-2 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0 ${className}`}>
        <dt className="text-sm font-medium leading-6 text-gray-900">{label}</dt>
        <dd className={`mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0 ${isBold ? 'font-bold' : ''}`}>{value}</dd>
    </div>
);

export const InfoModal: React.FC<InfoModalProps> = ({ carpark, language, onClose, onNavigate }) => {
    const t = i18n[language];

    const handleNavigateClick = () => {
        onClose(); // Close modal first
        onNavigate(carpark.latitude, carpark.longitude);
    }

    // Vacancy Info
    const vacancyData = carpark.vacancyData;
    const vehicleTypeLabels = { privateCar: t.vac_car, motorCycle: t.vac_moto, LGV: t.vac_lgv, HGV: t.vac_hgv, coach: t.vac_coach };
    const vacancyRows = vacancyData ? Object.entries(vehicleTypeLabels)
        .map(([key, label]) => {
            const vacancyInfo = vacancyData[key as keyof typeof vehicleTypeLabels]?.[0];
            if (!vacancyInfo) return null;
            // Fix: Safely handle vacancy which can be number or string, and fix bug where 0 was treated as N/A.
            const vacancyValue = vacancyInfo.vacancy;
            const vacancyText = vacancyValue ?? t.notAvailable;
            const hasVacancy = typeof vacancyValue === 'number' && vacancyValue > 0;
            const colorClass = hasVacancy ? 'text-green-600' : 'text-red-600';
            return <InfoRow key={key} label={label} value={<span className={colorClass}>{String(vacancyText)}</span>} isBold/>;
        })
        .filter(Boolean) : [<InfoRow key="no-data" label={t.vacancy} value={t.noVacancyData} />];

    if (vacancyRows.length === 0) {
        vacancyRows.push(<InfoRow key="no-data" label={t.vacancy} value={t.noVacancyData} />);
    }

    // Price Info
    const hourlyCharges = carpark.privateCar?.hourlyCharges;
    const priceInfo = (hourlyCharges && hourlyCharges.length > 0) ? (
        <>
            {hourlyCharges.map((charge, index) => (
                <div key={index} className={index > 0 ? 'mt-2' : ''}>
                    <p className="font-semibold">{charge.price !== undefined ? `$${charge.price} / hour` : t.notAvailable}</p>
                    <p className="text-xs text-gray-500">{`${charge.weekdays?.join(', ') || 'All Days'} (${charge.periodStart || ''} - ${charge.periodEnd || ''})`}</p>
                    {charge.remark && <p className="text-xs text-gray-500 mt-1">({charge.remark})</p>}
                </div>
            ))}
        </>
    ) : t.notAvailable;

    // Remarks Info
    const remarkText = carpark.heightLimits?.[0]?.remark || t.notAvailable;


    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[4000] p-4 transition-opacity duration-300" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-bold text-gray-800">{carpark.name || t.modalTitle}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-3xl">&times;</button>
                </div>
                <div className="p-6">
                    <dl className="divide-y divide-gray-100">
                        <InfoRow label={t.address} value={carpark.displayAddress} />
                        <InfoRow label={t.parkId} value={carpark.park_Id} />
                        <InfoRow label={t.status} value={carpark.opening_status} isBold className={carpark.opening_status === 'OPEN' ? 'text-green-600' : 'text-red-600'} />
                        {vacancyRows}
                        <InfoRow label={t.price_car} value={priceInfo} />
                        <InfoRow label={t.heightLimit} value={carpark.heightLimits?.[0] ? `${carpark.heightLimits[0].height} m` : t.notAvailable} />
                        <InfoRow label={t.remarks} value={remarkText} />
                    </dl>
                    <button onClick={handleNavigateClick} className="w-full mt-4 bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors">
                        {t.navigate}
                    </button>
                </div>
            </div>
        </div>
    );
};