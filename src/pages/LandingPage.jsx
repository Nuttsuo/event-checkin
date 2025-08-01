import React, { useState, useEffect, useRef } from 'react';
import galaLogo from '../assets/GalaDinner.png';
import centum50 from '../assets/centum50th.png';
import io from 'socket.io-client';
import { Toast } from 'primereact/toast';

function LandingPage() {
    const vantaRef = useRef(null);
    const effectRef = useRef(null);
    const toast = useRef(null);
    const [toastStack, setToastStack] = useState([]); // เก็บ stack ของ toasts
    const MAX_STACK = 4; // จำนวน popup สูงสุดที่จะแสดง
    const POPUP_DURATION = 5000; // ระยะเวลาแสดง popup (5 วินาที)


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
            //  sticky: true, // ทำให้ toast ค้างอยู่
            life: POPUP_DURATION, // หรือใช้ sticky แทนถ้าต้องการ
            content: (
                <div className="transform transition-all duration-300 scale-100">
                    <div className="bg-gradient-to-r from-slate-700/70 via-slate-900/50 to-slate-950/30 rounded-2xl px-16 py-10 shadow-2xl border border-white/30 backdrop-blur-sm w-[600px] max-w-[90vw]">
                        <div className="text-center space-y-5">
                            <div className="text-white space-y-3">
                                <p className="text-2xl font-light">Welcome !</p>
                                <div className="w-full">
                                    <h2 className="text-4xl font-bold tracking-wide break-words leading-tight">
                                        {(guest.Name || guest.name)}
                                    </h2>
                                </div>
                                <p className="text-lg text-white/90">from</p>
                                <div className="w-full">
                                    <p className="text-xl font-semibold text-white/90 break-words leading-relaxed">
                                        {(guest.Company || guest.company)}
                                    </p>
                                </div>
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

    // Comment Vanta.js ไว้ชั่วคราว เพราะกิน resources เยอะเมื่อต่อจอใหญ่
    
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
                    waveSpeed: 0.9,
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
            {/* <button
                onClick={testPopup}
                className="fixed top-4 right-4 bg-black/10 hover:bg-black/20 text-white/50 px-3 py-1 rounded text-sm "
                style={{ zIndex: 80 }}
            >
                Test Popup
            </button> */}

            {/* Static Background - แทน Vanta.js ชั่วคราว */}
            {/* <div
                style={{
                    position: 'absolute',
                    width: '100vw',
                    height: '100vh',
                    top: 0,
                    left: 0,
                    zIndex: -1,
                    background: 'linear-gradient(135deg, #0b2134 0%, #1a365d 25%, #2d4a5c 50%, #1a365d 75%, #0b2134 100%)',
                }}
            /> */}
            
            {/* Comment Vanta.js div ไว้ชั่วคราว */}
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
            {/* Main Logo */}
            <div className="min-h-screen flex flex-col items-center justify-between p-4 zindex-10">

                <div className="mb-[5rem] flex flex-col items-center space-y-8">
                        <div className="w-full max-w-[65%]">
                            <img 
                                src={galaLogo} 
                                className="w-full" 
                                style={{filter: 'drop-shadow(0 0 20px rgba(81, 66, 7, 1))'}} 
                                alt="Gala Logo" 
                            />
                        </div>
                        
                        <div className="text-center text-white">
                            {/* <h1 className="text-5xl font-bold mb-4">GALA DINNER 2025</h1> */}
                            <h2 className="text-5xl font-bold mb-4">50th Anniversary Celebration</h2>
                            <div className="text-2xl font-bold">
                                <p className="mb-2">Grand Ballroom 2 & 3, Holliday Inn & Suites Rayong City Centre</p>
                                <p>21 August 2025 5.00 PM - 10.00 PM</p>
                            </div>
                        </div>
                </div>
                <div className="mt-5 w-full max-w-[80%]">
                    <img 
                        src={centum50} 
                        className="w-full" 
                        style={{filter: 'drop-shadow(0 0 20px rgba(81, 66, 7, 1))'}} 
                        alt="Centum 50th Logo" 
                    />
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
                    
                    @keyframes slideInLeft {
                    from {
                        transform: translateX(-100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(-20%);
                        opacity: 1;
                    }
                    }

                    @keyframes slideOutLeft {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(-100%);
                        opacity: 0;
                    }
                    }

                    /* Override Toast animation */
                    .p-toast-message {
                    animation: slideInLeft 0.3s ease-out forwards;
                    }

                    .p-toast-message-leave {
                    animation: slideOutLeft 0.3s ease-in forwards !important;
                    }
                `}
            </style>
        </>
    );
}

export default LandingPage;
