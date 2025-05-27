// static/game/peer-setup.js

import { initializeInput } from './input.js';
import { startGame } from './main.js';

let peer = null;
let gameConnection = null;
const monitorPeerId = 'vectorGameMonitorInstance1'; // Ensure this matches the monitor's PeerJS ID
const gamePeerId = 'vectorGameSenderInstance1'; // Unique ID for the game page

function initializeGamePeer() {
    peer = new Peer(gamePeerId, { debug: 2 });

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

    console.log(`Attempting to connect to monitor with PeerJS ID: ${monitorPeerId}`);
    gameConnection = peer.connect(monitorPeerId, { reliable: true });

    gameConnection.on('open', () => {
        console.log(`Successfully connected to monitor: ${monitorPeerId}`);
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
            }
        };
        gameConnection.send(payload);
    } else {
        console.warn('Cannot send DVG commands: Not connected to monitor.');
        // connectToMonitor(); // Attempt to reconnect if not connected
    }
}
// Expose sendDVGCommands to be used by main.js (or other modules)
window.sendDVGCommandsFromGameHTML = sendDVGCommands;

document.addEventListener('DOMContentLoaded', () => {
    const monitorFrame = document.getElementById('monitorFrame');
    // Monitor is served from root, game.html is at /game.
    // So, path to monitor_display.html is relative to root.
    const monitorSrc = `/monitor_display.html?peerId=${monitorPeerId}`;
    monitorFrame.src = monitorSrc;
    console.log(`Set monitor iframe src to: ${monitorSrc}`);

    initializeInput(); // Initialize input listeners
    initializeGamePeer(); // Initialize PeerJS connection for the game
});

console.log('static/game/peer-setup.js loaded.');