import React, { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

function ScannerPage() {
    const [scanResult, setScanResult] = useState(null);
    const [scanMessage, setScanMessage] = useState('');

    useEffect(() => {
        const scanner = new Html5QrcodeScanner('reader', {
            qrbox: {
                width: 250,
                height: 250,
            },
            fps: 5,
        });

        scanner.render(onScanSuccess, onScanError);

        function onScanSuccess(decodedText) {
            handleSuccessfulScan(decodedText);
        }

        function onScanError(error) {
            console.warn(error);
        }

        return () => {
            scanner.clear().catch(console.error);
        };
    }, []);

    const handleSuccessfulScan = async (uuid) => {
        try {
            const response = await fetch(`http://localhost:3001/api/checkin/${uuid}`, {
                method: 'POST',
            });
            
            const data = await response.json();
            
            if (response.ok) {
                setScanResult(data);
                setScanMessage(`Successfully checked in ${data.name}`);
                // Play success sound
                new Audio('/success.mp3').play().catch(console.error);
            } else {
                setScanMessage(data.message || 'Check-in failed');
                // Play error sound
                new Audio('/error.mp3').play().catch(console.error);
            }
            
            // Reset message after 3 seconds
            setTimeout(() => {
                setScanMessage('');
                setScanResult(null);
            }, 3000);
            
        } catch (error) {
            console.error('Error checking in guest:', error);
            setScanMessage('Error checking in guest');
        }
    };

    return (
        <div className="container mx-auto p-4">
            <div className="max-w-xl mx-auto">
                <h1 className="text-2xl font-bold mb-4 text-center">QR Code Scanner</h1>
                
                <div className="bg-white rounded-lg shadow-lg p-4 mb-4">
                    <div id="reader"></div>
                </div>

                {scanMessage && (
                    <div className={`p-4 rounded-lg text-center text-white ${
                        scanResult ? 'bg-green-500' : 'bg-red-500'
                    }`}>
                        {scanMessage}
                    </div>
                )}
            </div>
        </div>
    );
}

export default ScannerPage;
