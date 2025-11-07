import React, { useEffect, useState } from 'react';

interface NotificationProps {
    message: string;
    onDismiss: () => void;
}

export const NavigationNotification: React.FC<NotificationProps> = ({ message, onDismiss }) => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (message) {
            setVisible(true);
            const timer = setTimeout(() => {
                setVisible(false);
                // Allow time for fade out animation before calling dismiss
                setTimeout(onDismiss, 300);
            }, 5000); // Display for 5 seconds

            return () => clearTimeout(timer);
        }
    }, [message, onDismiss]);

    return (
        <div
            className={`fixed bottom-5 right-5 z-[2000] bg-gray-800 text-white font-semibold py-3 px-5 rounded-lg shadow-lg transition-all duration-300 ${
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
            }`}
        >
            {message}
        </div>
    );
};
