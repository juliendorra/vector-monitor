// static/input.js

const keyStates = {
    ArrowLeft: false,
    ArrowRight: false,
    Space: false, // For spacebar
    KeyR: false, // For restart
};

const allowedKeys = Object.keys(keyStates);

function handleKeyDown(event) {
    if (allowedKeys.includes(event.code)) {
        keyStates[event.code] = true;
        // Prevent default for arrow keys and space to avoid page scrolling
        if (['ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
            event.preventDefault();
        }
        // console.log(`${event.code} pressed`);
    } else if (event.key === ' ') { // Handle spacebar by event.key as event.code can be "Space"
        keyStates['Space'] = true;
        event.preventDefault(); // Prevent page scrolling
        // console.log('Space pressed');
    }
}

function handleKeyUp(event) {
    if (allowedKeys.includes(event.code)) {
        keyStates[event.code] = false;
        // Prevent default for arrow keys and space
        if (['ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
            event.preventDefault();
        }
        // console.log(`${event.code} released`);
    } else if (event.key === ' ') { // Handle spacebar by event.key
        keyStates['Space'] = false;
        event.preventDefault();
        // console.log('Space released');
    }
}

export function initializeInput() {
    // Use capture phase to ensure we get events even if iframe tries to capture them
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('keyup', handleKeyUp, true);
    
    // Also add listeners to window as backup
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    console.log('Input module initialized.');
}

export function getKeyState(keyName) {
    return keyStates[keyName] || false;
}

// For convenience, specific getter functions
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

// Optional: A function to get all key states
export function getAllKeyStates() {
    return { ...keyStates };
}