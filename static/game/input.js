// static/input.js

const keyStates = {
    ArrowLeft: false,
    ArrowRight: false,
    Space: false, // For spacebar
};

const allowedKeys = Object.keys(keyStates);

function handleKeyDown(event) {
    if (allowedKeys.includes(event.code)) {
        keyStates[event.code] = true;
        // console.log(`${event.code} pressed`);
    } else if (event.key === ' ') { // Handle spacebar by event.key as event.code can be "Space"
        keyStates['Space'] = true;
        // console.log('Space pressed');
    }
}

function handleKeyUp(event) {
    if (allowedKeys.includes(event.code)) {
        keyStates[event.code] = false;
        // console.log(`${event.code} released`);
    } else if (event.key === ' ') { // Handle spacebar by event.key
        keyStates['Space'] = false;
        // console.log('Space released');
    }
}

export function initializeInput() {
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

// Optional: A function to get all key states
export function getAllKeyStates() {
    return { ...keyStates };
}