// static/game/peer-setup.js

import { initializeInput } from './input.js';
import { startGame } from './main.js';
import { restartGame } from './game.js';

let peer = null;
let gameConnection = null;

// Generate a unique suffix for PeerJS IDs
const uniqueSuffix = Date.now().toString(36) + Math.random().toString(36).substring(2, 7);

const dynamicMonitorPeerId = `vectorGameMonitorInstance-${uniqueSuffix}`;
const dynamicGamePeerId = `vectorGameSenderInstance-${uniqueSuffix}`;

console.log(`Using dynamicMonitorPeerId: ${dynamicMonitorPeerId}`);
console.log(`Using dynamicGamePeerId: ${dynamicGamePeerId}`);

function initializeGamePeer() {
    peer = new Peer(dynamicGamePeerId, { debug: 2 });

    peer.on('open', (id) => {
        console.log('Game PeerJS ID:', id);
        // Add a delay to give the monitor iframe time to initialize its PeerJS instance
        setTimeout(() => {
            connectToMonitor();
        }, 2000); // 2-second delay
    });

    peer.on('error', (err) => {
        console.error('Game PeerJS error:', err);
    });

    peer.on('disconnected', () => {
        console.log('Game PeerJS disconnected. Attempting to reconnect...');
        if (peer && !peer.destroyed) {
            peer.reconnect();
        }
    });

    peer.on('close', () => {
        console.log('Game PeerJS connection closed.');
    });
}

function connectToMonitor() {
    if (!peer) {
        console.error('Peer object not initialized.');
        return;
    }
    if (gameConnection && gameConnection.open) {
        console.log('Already connected to monitor.');
        return;
    }

    console.log(`Attempting to connect to monitor with PeerJS ID: ${dynamicMonitorPeerId}`);
    gameConnection = peer.connect(dynamicMonitorPeerId, { reliable: true });

    gameConnection.on('open', () => {
        console.log(`Successfully connected to monitor: ${dynamicMonitorPeerId}`);
        gameConnection.send('Hello from game page! Connection established.');
        startGame(sendDVGCommands); // Pass the sendDVGCommands function to startGame
    });

    gameConnection.on('data', (data) => {
        console.log('Received data from monitor:', data);
    });

    gameConnection.on('error', (err) => {
        console.error('Game connection to monitor error:', err);
    });

    gameConnection.on('close', () => {
        console.log('Connection to monitor closed.');
        gameConnection = null;
        // Optionally, try to reconnect
        // setTimeout(connectToMonitor, 5000);
    });
}

function sendDVGCommands(dvgString, vps = 200) {
    if (gameConnection && gameConnection.open) {
        const payload = {
            dvgProgramText: dvgString,
            metadata: {
                // vps: vps // let the monitor adjust the ops per seconds
                webGLGlowMultiplier: 1.3,
                webGLLineWidthMultiplier: 1.0,
                webGLDifferentialDecayRates: {
                    r: 2.6,
                    g: 2.7,
                    b: 3.7
                },
                webGLBeamSpeed: 10000,
                webGLIntraVectorDecayRate: 8.9,
                webGLAntialiasPixelWidth: 1.5
            }
        };
        gameConnection.send(payload);
    } else {
        console.warn('Cannot send DVG commands: Not connected to monitor.');
        // connectToMonitor(); // Attempt to reconnect if not connected
    }
}

// Setup global key capture for restart key only, while ensuring iframe doesn't steal focus
function setupGlobalKeyCapture() {
    // Prevent iframe from taking focus away from key events
    const monitorFrame = document.getElementById('monitorFrame');
    if (monitorFrame) {
        // Make iframe non-focusable initially
        monitorFrame.style.pointerEvents = 'none';
        
        // Re-enable pointer events after a short delay to allow monitor to load
        setTimeout(() => {
            monitorFrame.style.pointerEvents = 'auto';
            // But prevent the iframe from taking keyboard focus
            monitorFrame.setAttribute('tabindex', '-1');
        }, 3000);
    }

    // Only capture the restart key globally, let other keys be handled by input.js
    document.addEventListener('keydown', (event) => {
        // Only handle restart key globally
        if (event.code === 'KeyR' || event.key === 'r' || event.key === 'R') {
            event.preventDefault();
            event.stopPropagation();
            console.log('Restart key detected at document level');
            restartGame();
        }
        // Let all other keys pass through to input.js normally
    }, true); // Use capture phase for restart key

    // Ensure the main window maintains focus for keyboard events
    window.addEventListener('blur', () => {
        // When window loses focus, try to regain it after a short delay
        setTimeout(() => {
            window.focus();
        }, 100);
    });

    // Ensure the main window has focus initially
    window.focus();
    
    // Also ensure document body can receive focus
    document.body.setAttribute('tabindex', '0');
    document.body.focus();
}

// Expose sendDVGCommands to be used by main.js (or other modules)
window.sendDVGCommandsFromGameHTML = sendDVGCommands;

// Expose restart function globally for easy access
window.restartVectorGame = restartGame;

document.addEventListener('DOMContentLoaded', () => {
    const monitorFrame = document.getElementById('monitorFrame');
    // Monitor is served from root, game.html is at /game.
    // So, path to monitor_display.html is relative to root.
    const monitorSrc = `/monitor_display.html?peerId=${dynamicMonitorPeerId}`;
    monitorFrame.src = monitorSrc;
    console.log(`Set monitor iframe src to: ${monitorSrc}`);

    initializeInput(); // Initialize input listeners first
    setupGlobalKeyCapture(); // Setup global key capture for iframe focus issues
    initializeGamePeer(); // Initialize PeerJS connection for the game
});

console.log('static/game/peer-setup.js loaded.');