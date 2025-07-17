import reactLogo from './assets/react.svg'
import galaLogo from './assets/GalaDinner.png'
import './App.css'
import React, { useState, useEffect, useRef } from 'react';


function App() {
  const [count, setCount] = useState(0)
  const [isTrue,setIsTrue] = useState(false);
const vantaRef = useRef(null);
    const effectRef = useRef(null);
    useEffect(() => {
        const loadVanta = async () => {
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js');
            await loadScript('https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.waves.min.js');

            if (window.VANTA?.WAVES && !effectRef.current) {
                effectRef.current = window.VANTA.WAVES({
                    el: vantaRef.current,
                    mouseControls: false,
                    touchControls: true,
                    gyroControls: false,
                    minHeight: 200,
                    minWidth: 200,
                    scale: 0.65,
                    scaleMobile: 1.0,
                    color: 0x0b2134,
                    shininess: 60,
                    waveHeight: 6.5,
                    waveSpeed: 1.0,
                    zoom: 0.7,
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
  return (
    <>
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
              <img src={galaLogo} className="w-full" alt="Gala Logo" />
            </div>
            
            <div className="text-center text-white">
              <h1 className="text-5xl font-bold mb-4">GALA DINNER 2025</h1>
              <h2 className="text-3xl font-light mb-6">50th Anniversary Celebration</h2>
              <div className="text-xl">
                <p className="mb-2">Welcome to the Celebration</p>
                <p>5.00 PM - 10.00 PM</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default App
