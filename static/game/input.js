// static/game/input.js

const keyStates = {
    ArrowLeft: false,
    ArrowRight: false,
    Space: false, // For spacebar
    KeyR: false, // For restart
};

const allowedKeys = Object.keys(keyStates);

// Touch state variables
const SWIPE_THRESHOLD_X = 30; // Min pixels to be considered a swipe
const TAP_MAX_DURATION = 200; // Max ms to be considered a tap
const TAP_MAX_MOVEMENT = 20; // Max pixels moved to be considered a tap

let touchStartData = {}; // Stores data for active touches { id: { x, y, time, type: 'swipe'/'tap' } }
let activeSwipes = { left: false, right: false }; // Tracks active swipe states
let shootTapRegistered = false;

// --- Keyboard Event Handlers ---
function handleKeyDown(event) {
    if (allowedKeys.includes(event.code)) {
        keyStates[event.code] = true;
        if (['ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
            event.preventDefault();
        }
        // console.log(`Key down: ${event.code}`);
    } else if (event.key === ' ') {
        keyStates['Space'] = true;
        event.preventDefault();
        // console.log('Key down: Space');
    }
}

function handleKeyUp(event) {
    if (allowedKeys.includes(event.code)) {
        keyStates[event.code] = false;
        if (['ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
            event.preventDefault();
        }
        // console.log(`Key up: ${event.code}`);
    } else if (event.key === ' ') {
        keyStates['Space'] = false;
        event.preventDefault();
        // console.log('Key up: Space');
    }
}

// --- Touch Event Handlers ---
function handleTouchStart(event) {
    event.preventDefault(); // Prevent default touch behaviors like scrolling
    const screenHeight = window.innerHeight;
    Array.from(event.changedTouches).forEach(touch => {
        const touchY = touch.clientY;
        const touchId = touch.identifier;

        if (touchY > screenHeight / 2) { // Bottom half for swipes
            touchStartData[touchId] = {
                x: touch.clientX,
                y: touch.clientY,
                time: event.timeStamp,
                type: 'swipe'
            };
            // console.log(`Touch start (swipe zone): ID ${touchId} at (${touch.clientX}, ${touch.clientY})`);
        } else { // Top half for taps
            touchStartData[touchId] = {
                x: touch.clientX,
                y: touch.clientY,
                time: event.timeStamp,
                type: 'tap'
            };
            // console.log(`Touch start (tap zone): ID ${touchId} at (${touch.clientX}, ${touch.clientY})`);
        }
    });
}

function handleTouchMove(event) {
    event.preventDefault();
    Array.from(event.changedTouches).forEach(touch => {
        const touchId = touch.identifier;
        if (!touchStartData[touchId] || touchStartData[touchId].type !== 'swipe') {
            return; // Not a swipe touch or touch data lost
        }

        const startX = touchStartData[touchId].x;
        const currentX = touch.clientX;
        const deltaX = currentX - startX;

        if (Math.abs(deltaX) > SWIPE_THRESHOLD_X) {
            if (deltaX < 0) {
                activeSwipes.left = true;
                activeSwipes.right = false; // Ensure only one direction
                // console.log(`Swipe left detected: ID ${touchId}`);
            } else {
                activeSwipes.right = true;
                activeSwipes.left = false; // Ensure only one direction
                // console.log(`Swipe right detected: ID ${touchId}`);
            }
            // Optional: update startX to currentX to allow continuous swiping or require new touch
            // For this implementation, a swipe is latched until touch end.
        }
    });
}

function handleTouchEndOrCancel(event) {
    event.preventDefault();
    Array.from(event.changedTouches).forEach(touch => {
        const touchId = touch.identifier;
        const startData = touchStartData[touchId];

        if (!startData) return;

        // console.log(`Touch end/cancel: ID ${touchId}, type: ${startData.type}`);

        if (startData.type === 'swipe') {
            // Reset active swipe states if this touch was causing them.
            // This is a simplification; if multiple touches can cause swipes,
            // we'd need to track which touch ID is causing which swipe.
            // For now, any swipe touch ending resets both.
            activeSwipes.left = false;
            activeSwipes.right = false;
            // console.log(`Swipe ended for ID ${touchId}. Active swipes reset.`);
        } else if (startData.type === 'tap') {
            const duration = event.timeStamp - startData.time;
            const deltaX = Math.abs(touch.clientX - startData.x);
            const deltaY = Math.abs(touch.clientY - startData.y);

            if (duration < TAP_MAX_DURATION && deltaX < TAP_MAX_MOVEMENT && deltaY < TAP_MAX_MOVEMENT) {
                shootTapRegistered = true;
                // console.log(`Tap registered: ID ${touchId}`);
            } else {
                // console.log(`Tap conditions not met: ID ${touchId}, duration: ${duration}, deltaX: ${deltaX}, deltaY: ${deltaY}`);
            }
        }
        delete touchStartData[touchId]; // Clean up touch data
    });
}


export function initializeInput() {
    document.addEventListener('keydown', handleKeyDown, { capture: true, passive: false });
    document.addEventListener('keyup', handleKeyUp, { capture: true, passive: false });
    
    // Also add listeners to window as backup (though capture on document should be enough)
    window.addEventListener('keydown', handleKeyDown, { passive: false });
    window.addEventListener('keyup', handleKeyUp, { passive: false });

    // Touch event listeners
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEndOrCancel, { passive: false });
    document.addEventListener('touchcancel', handleTouchEndOrCancel, { passive: false });
    
    console.log('Input module initialized with keyboard and touch support.');
}

export function getKeyState(keyName) {
    return keyStates[keyName] || false;
}

// --- Keyboard specific getters ---
export function isLeftArrowDown() {
    return keyStates.ArrowLeft;
}

export function isRightArrowDown() {
    return keyStates.ArrowRight;
}

export function isSpaceBarDown() {
    return keyStates.Space;
}

export function isRKeyDown() {
    return keyStates.KeyR;
}

// --- Touch specific getters ---
export function isSwipeLeftActive() {
    return activeSwipes.left;
}

export function isSwipeRightActive() {
    return activeSwipes.right;
}

export function wasShootTap() {
    if (shootTapRegistered) {
        shootTapRegistered = false; // Reset after check
        // console.log('wasShootTap: tap consumed.');
        return true;
    }
    return false;
}

// Optional: A function to get all key states (mostly for debugging keyboard)
export function getAllKeyStates() {
    return { ...keyStates };
}

// Optional: A function to get all touch states (for debugging)
export function getTouchState() {
    return {
        touchStartData: JSON.parse(JSON.stringify(touchStartData)), // Deep copy for inspection
        activeSwipes: { ...activeSwipes },
        shootTapRegistered
    };
}