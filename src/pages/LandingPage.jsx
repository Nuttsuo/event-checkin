import React, { useState, useEffect, useRef } from 'react';
import galaLogo from '../assets/GalaDinner.png';
import io from 'socket.io-client';
import { Toast } from 'primereact/toast';

function LandingPage() {
    const vantaRef = useRef(null);
    const effectRef = useRef(null);
    const toast = useRef(null);
    const [toastStack, setToastStack] = useState([]); // เก็บ stack ของ toasts
    const MAX_STACK = 4; // จำนวน popup สูงสุดที่จะแสดง
    const POPUP_DURATION = 3000; // ระยะเวลาแสดง popup (5 วินาที)

    const showGuestToast = (guest) => {
        const newToast = {
            id: Date.now(),
            guest,
            timestamp: Date.now()
        };

        setToastStack(currentStack => {
            // ถ้าจำนวน toasts เกิน MAX_STACK ให้ clear ทั้งหมด
            if (currentStack.length >= MAX_STACK) {
                return [newToast];
            }
            return [...currentStack, newToast];
        });

        toast.current.show({
            // className: 'bg-transparent border-none shadow-none',
            // sticky: true, // ทำให้ toast ค้างอยู่
            life: POPUP_DURATION, // หรือใช้ sticky แทนถ้าต้องการ
            content: (
                <div className="transform transition-all duration-300 scale-100">
                    <div className="bg-gradient-to-b from-white/65 to-black/10 rounded-2xl p-12 shadow-2xl border border-white/20 ">
                        <div className="text-center space-y-6">
                            <div className="text-white space-y-2">
                                <p className="text-2xl font-light">Welcome</p>
                                <h2 className="text-5xl font-bold tracking-wide">
                                    {guest.Name || guest.name}
                                </h2>
                            </div>
                            <div className="text-white/90 space-y-2">
                                <p className="text-xl">from</p>
                                <p className="text-2xl font-semibold">
                                    {guest.Company || guest.company}
                                </p>
                            </div>
                            <div className="pt-4">
                                <p className="text-2xl text-white font-light">
                                    Enjoy the celebration!
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            ),
            onClose: () => {
                setToastStack(currentStack => 
                    currentStack.filter(t => t.id !== newToast.id)
                );
            }
        });
    };

    // เพิ่ม effect สำหรับทดสอบ popup
    useEffect(() => {
        // สร้าง socket connection
        const socket = io('http://localhost:3001');

        socket.on('guest-checkin', (guest) => {
            const newGuest = { ...guest, id: Date.now() };
            showGuestToast(newGuest);
        });

        // Cleanup function
        return () => socket.disconnect();
    }, []);

        // background effect
    useEffect(() => {
        const loadVanta = async () => {
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js');
            await loadScript('https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.waves.min.js');

            if (window.VANTA?.WAVES && !effectRef.current) {
                effectRef.current = window.VANTA.WAVES({
                    el: vantaRef.current,
                    mouseControls: false,
                    touchControls: false,
                    gyroControls: false,
                    minHeight: 200,
                    minWidth: 200,
                    scale: 0.7,
                    scaleMobile: 1.0,
                    color: 0x0b2134,
                    shininess: 60,
                    waveHeight: 12,
                    waveSpeed: 1.3,
                    zoom: 0.65,
                });
            }
        };

        loadVanta();

        return () => {
            if (effectRef.current) effectRef.current.destroy();
        };
    }, []);

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.body.appendChild(script);
        });
    }

    // ฟังก์ชันสำหรับทดสอบ popup
    const testPopup = () => {
        const testGuest = {
            Name: "Atthaphong Limphanaruk",
            Company: "Toagosei (Thailand) Co., Ltd.",
            id: Date.now()
        };
        
        showGuestToast(testGuest);
    };

   useEffect(() => {
        const handleKeyPress = (event) => {
            if (event.key === 't' || event.key === 'T') {
                testPopup();
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, []);

    return (
        <>
            {/* Test Button */}
            <button
                onClick={testPopup}
                className="fixed top-4 right-4 bg-black/10 hover:bg-black/20 text-white/50 px-3 py-1 rounded text-sm "
                style={{ zIndex: 80 }}
            >
                Test Popup
            </button>

            <div
                ref={vantaRef}
                style={{
                    position: 'absolute',
                    width: '100vw',
                    height: '100vh',
                    top: 0,
                    left: 0,
                    zIndex: -1,
                }}
            />
            <div className="min-h-screen flex flex-col items-center justify-center p-4">
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 shadow-2xl w-full max-w-4xl">
                    <div className="flex flex-col items-center space-y-8">
                        <div className="w-full max-w-2xl">
                            <img 
                                src={galaLogo} 
                                className="w-full" 
                                style={{filter: 'drop-shadow(0 0 20px rgba(81, 66, 7, 1))'}} 
                                alt="Gala Logo" 
                            />
                        </div>
                        
                        <div className="text-center text-white">
                            <h1 className="text-5xl font-bold mb-4">GALA DINNER 2025</h1>
                            <h2 className="text-3xl font-light mb-6">50th Anniversary Celebration</h2>
                            <div className="text-xl">
                                <p className="mb-2">Grand Ballroom 2 & 3, Holliday Inn & Suites Rayong City Centre</p>
                                <p>5.00 PM - 10.00 PM</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Toast Container */}
            <Toast 
                
                ref={toast} 
                position="center"
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.1rem'
                }}
            />
            
            {/* Custom Toast Styles */}
            <style>
                {`
                    .p-toast {
                        opacity: 1 !important;
                    }
                    .p-toast .p-toast-message {
                        margin: 0;
                        padding: 0;
                        border: none;
                        background: transparent;
                        box-shadow: none;
                        border-radius: 0;
                    }
                    .p-toast .p-toast-message-content {
                        padding: 0;
                        background: transparent;
                    }
                    .p-toast .p-toast-message-custom {
                        background: transparent;
                    }
                    .p-toast .p-toast-icon-close {
                        display: none;
                    }
                `}
            </style>
        </>
    );
}

export default LandingPage;
