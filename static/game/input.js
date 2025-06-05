// static/game/input.js
// ES5 compatibility refactor

var keyStates = {
    ArrowLeft: false,
    ArrowRight: false,
    Space: false, // For spacebar
    KeyR: false, // For restart
};

var allowedKeys = Object.keys(keyStates);

// Touch state variables
var SWIPE_THRESHOLD_X = 30; // Min pixels to be considered a swipe
var TAP_MAX_DURATION = 200; // Max ms to be considered a tap
var TAP_MAX_MOVEMENT = 20; // Max pixels moved to be considered a tap

var touchStartData = {}; // Stores data for active touches { id: { x, y, time, type: 'swipe'/'tap' } }
var activeSwipes = { left: false, right: false }; // Tracks active swipe states
var shootTapRegistered = false;

// Reference to the game area element for touch coordinate calculations
var gameAreaElement = null;
var anyTapRegisteredForRestart = false; // For game over restart

// --- Keyboard Event Handlers ---
function handleKeyDown(event) {
    // ES5: Replaced .includes with .indexOf
    if (allowedKeys.indexOf(event.code) !== -1) {
        keyStates[event.code] = true;
        // ES5: Replaced .includes with .indexOf
        if (['ArrowLeft', 'ArrowRight', 'Space'].indexOf(event.code) !== -1) {
            event.preventDefault();
        }
        // console.log('Key down: ' + event.code); // ES5: Replaced template literal
    } else if (event.key === ' ') {
        keyStates['Space'] = true;
        event.preventDefault();
        // console.log('Key down: Space');
    }
}

function handleKeyUp(event) {
    // ES5: Replaced .includes with .indexOf
    if (allowedKeys.indexOf(event.code) !== -1) {
        keyStates[event.code] = false;
        // ES5: Replaced .includes with .indexOf
        if (['ArrowLeft', 'ArrowRight', 'Space'].indexOf(event.code) !== -1) {
            event.preventDefault();
        }
        // console.log('Key up: ' + event.code); // ES5: Replaced template literal
    } else if (event.key === ' ') {
        keyStates['Space'] = false;
        event.preventDefault();
        // console.log('Key up: Space');
    }
}

// --- Touch Event Handlers ---
function handleTouchStart(event) {
    event.preventDefault(); // Prevent default touch behaviors like scrolling

    if (!gameAreaElement) {
        console.error("Input module: gameAreaElement is not set. Cannot process touch start.");
        return;
    }
    var rect = gameAreaElement.getBoundingClientRect();

    // ES5: Replaced Array.from().forEach() with a standard for loop
    for (var i = 0; i < event.changedTouches.length; i++) {
        var touch = event.changedTouches[i];
        var touchClientY = touch.clientY; // Y coordinate relative to the viewport
        var touchId = touch.identifier;

        // Calculate touch Y relative to the game area
        var touchRelativeY = touchClientY - rect.top;

        // Ensure the touch is within the vertical bounds of the game area
        if (touchClientY < rect.top || touchClientY > rect.bottom) {
            // console.log('Touch ID ' + touchId + ' is outside game area vertical bounds.');
            continue; // Skip this touch
        }

        // Determine zone based on touchRelativeY and rect.height
        if (touchRelativeY > rect.height / 2) { // Bottom half of game area for swipes
            touchStartData[touchId] = {
                x: touch.clientX, // clientX is fine for delta calculations later
                y: touch.clientY, // Store original clientY for consistency if needed, though relativeY is key for zone
                time: event.timeStamp,
                type: 'swipe'
            };
            // console.log('Touch start (swipe zone): ID ' + touchId + ' at (' + touch.clientX + ', ' + touchClientY + ') relativeY: ' + touchRelativeY.toFixed(2));
        } else { // Top half of game area for taps (touchRelativeY <= rect.height / 2)
            touchStartData[touchId] = {
                x: touch.clientX,
                y: touch.clientY, // Store original clientY
                time: event.timeStamp,
                type: 'tap'
            };
            // console.log('Touch start (tap zone): ID ' + touchId + ' at (' + touch.clientX + ', ' + touchClientY + ') relativeY: ' + touchRelativeY.toFixed(2));
        }
    }
}

function handleTouchMove(event) {
    event.preventDefault();
    // ES5: Replaced Array.from().forEach() with a standard for loop
    for (var i = 0; i < event.changedTouches.length; i++) {
        var touch = event.changedTouches[i];
        var touchId = touch.identifier;
        if (!touchStartData[touchId] || touchStartData[touchId].type !== 'swipe') {
            // In a for loop, 'return' would exit the function. Use 'continue' to skip to the next iteration.
            continue;
        }

        var startX = touchStartData[touchId].x;
        var currentX = touch.clientX;
        var deltaX = currentX - startX;

        if (Math.abs(deltaX) > SWIPE_THRESHOLD_X) {
            if (deltaX < 0) {
                activeSwipes.left = true;
                activeSwipes.right = false; // Ensure only one direction
                // console.log('Swipe left detected: ID ' + touchId); // ES5: Template literal
            } else {
                activeSwipes.right = true;
                activeSwipes.left = false; // Ensure only one direction
                // console.log('Swipe right detected: ID ' + touchId); // ES5: Template literal
            }
            // Optional: update startX to currentX to allow continuous swiping or require new touch
            // For this implementation, a swipe is latched until touch end.
        }
    }
}

function handleTouchEndOrCancel(event) {
    event.preventDefault();
    // ES5: Replaced Array.from().forEach() with a standard for loop
    for (var i = 0; i < event.changedTouches.length; i++) {
        var touch = event.changedTouches[i];
        var touchId = touch.identifier;
        var startData = touchStartData[touchId];

        if (!startData) {
            // In a for loop, 'return' would exit the function. Use 'continue' to skip to the next iteration.
            continue;
        }

        // console.log('Touch end/cancel: ID ' + touchId + ', type: ' + startData.type); // ES5: Template literal

        if (startData.type === 'swipe') {
            // Reset active swipe states if this touch was causing them.
            // This is a simplification; if multiple touches can cause swipes,
            // we'd need to track which touch ID is causing which swipe.
            // For now, any swipe touch ending resets both.
            activeSwipes.left = false;
            activeSwipes.right = false;
            // console.log('Swipe ended for ID ' + touchId + '. Active swipes reset.'); // ES5: Template literal
        } else if (startData.type === 'tap') {
            var duration = event.timeStamp - startData.time;
            var deltaX = Math.abs(touch.clientX - startData.x);
            var deltaY = Math.abs(touch.clientY - startData.y);

            if (duration < TAP_MAX_DURATION && deltaX < TAP_MAX_MOVEMENT && deltaY < TAP_MAX_MOVEMENT) {
                // This is a valid tap.
                // If it's in the top half (shoot zone), it's a shoot tap.
                // Regardless of zone, any valid tap on the game area can be used for restart.
                shootTapRegistered = true; // This will only be effective if game is 'playing' and tap is in shoot zone.
                anyTapRegisteredForRestart = true; // Always register any valid tap for potential restart.
                // console.log('Tap registered: ID ' + touchId + '. Shoot: ' + shootTapRegistered + '. Restart: ' + anyTapRegisteredForRestart);
            } else {
                // console.log('Tap conditions not met: ID ' + touchId + ', duration: ' + duration + ', deltaX: ' + deltaX + ', deltaY: ' + deltaY);
            }
        }
        delete touchStartData[touchId]; // Clean up touch data
    }
}

// The 'export' keyword is ES6. If this code is not processed by a bundler/transpiler (like Babel or Webpack),
// these functions would not be directly usable as module exports in older browsers.
// For true ES5 environments without a build step, you would typically assign these to a global object,
// e.g., window.MyInputLib = { initializeInput: initializeInput, ... };
// However, the project structure seems to use ES6 modules, so we'll assume a build step handles this.
export function initializeInput(gameAreaElementId) { // Added gameAreaElementId parameter
    if (gameAreaElementId) {
        gameAreaElement = document.getElementById(gameAreaElementId);
        if (!gameAreaElement) {
            console.error("Input module: Game area element with ID '" + gameAreaElementId + "' not found. Touch zones may be inaccurate.");
            gameAreaElement = document.body; // Fallback
        } else {
            console.log("Input module: Using element '" + gameAreaElementId + "' for touch area calculations.");
        }
    } else {
        console.warn("Input module: No gameAreaElementId provided. Defaulting to document.body for touch zones, which might be inaccurate.");
        gameAreaElement = document.body; // Default if no ID is provided
    }

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
    
    console.log('Input module initialized with keyboard and touch support (ES5 compatible, game area aware).');
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
    // ES5: Replaced object spread with Object.assign
    return Object.assign({}, keyStates);
}

// Optional: A function to get all touch states (for debugging)
export function getTouchState() {
    // ES5: Replaced object spread with Object.assign
    return {
        touchStartData: JSON.parse(JSON.stringify(touchStartData)), // Deep copy for inspection
        activeSwipes: Object.assign({}, activeSwipes),
        shootTapRegistered: shootTapRegistered, // direct assignment
        anyTapRegisteredForRestart: anyTapRegisteredForRestart // For debugging
    };
}

export function wasAnyTapForRestart() {
    if (anyTapRegisteredForRestart) {
        anyTapRegisteredForRestart = false; // Reset after check
        // console.log('wasAnyTapForRestart: consumed restart tap.');
        return true;
    }
    return false;
}