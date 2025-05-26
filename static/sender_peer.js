import { nanoid, customAlphabet } from 'https://cdn.jsdelivr.net/npm/nanoid@4.0.2/+esm'

// DVG Syntax Highlighting Mode for CodeMirror
if (window.CodeMirror) {
    CodeMirror.defineMode("dvg", function () {
        const keywords = /^(VCTR|LABS|COLOR|SCALE|CENTER|JMPL|JSRL|RTSL|HALT|SVEC|LABEL)\b/i;
        const labelRegex = /^[a-zA-Z_][a-zA-Z0-9_]*/;
        return {
            startState: function () { return { lastOpcode: null }; },
            token: function (stream, state) {
                if (stream.eatSpace()) return null;
                if (stream.peek() === ';') { stream.skipToEnd(); return "comment"; }
                if (stream.match(/^-?[0-9]+\b/)) return "number";
                let match = stream.match(keywords);
                if (match) { state.lastOpcode = match[0].toUpperCase(); return "keyword"; }
                if (state.lastOpcode === "LABEL" || state.lastOpcode === "JMPL" || state.lastOpcode === "JSRL") {
                    if (stream.match(labelRegex)) { state.lastOpcode = null; return "variable-2"; }
                }
                stream.next(); return null;
            }
        };
    });
}

window.addEventListener('load', () => {
    const targetPeerIdInput = document.getElementById('targetPeerId');
    const desiredVpsInput = document.getElementById('desiredVps');
    const dvgCommandsEditorTextarea = document.getElementById('dvgCommandsEditor');
    const connectAndSendButton = document.getElementById('connectAndSendButton');
    const senderStatusDiv = document.getElementById('senderStatus');
    const myPeerIdDisplayDiv = document.getElementById('myPeerIdDisplay');
    const createNewMonitorButton = document.getElementById('createNewMonitorButton');
    const openMonitorButton = document.getElementById('openMonitorButton');
    const dvgExamplesSelect = document.getElementById('dvgExamples'); // Get the select element

    let peer = null;
    let currentConnection = null;
    let editor = null;

    const exampleScripts = [
        {
            name: "Looping Square (Default)",
            code: `
LABEL START
COLOR 3 ; Red
LABS 350 250 1
VCTR 100 0 1 15
VCTR 0 100 1 15
VCTR -100 0 1 15
VCTR 0 -100 1 15
JMPL START ; Loop back to the beginning
            `.trim()
        },
        {
            name: "Five looping Squares",
            code: `
LABEL START
COLOR 5 

LABS -350 -250 1
VCTR 100 0 1 15
VCTR 0 100 1 15
VCTR -100 0 1 15
VCTR 0 -100 1 15

LABS 350 -250 1
VCTR 100 0 1 15
VCTR 0 100 1 15
VCTR -100 0 1 15
VCTR 0 -100 1 15

LABS 350 250 1
VCTR 100 0 1 15
VCTR 0 100 1 15
VCTR -100 0 1 15
VCTR 0 -100 1 15

LABS -350 250 1
VCTR 100 0 1 15
VCTR 0 100 1 15
VCTR -100 0 1 15
VCTR 0 -100 1 15

LABS 0 0 1
VCTR 100 0 1 15
VCTR 0 100 1 15
VCTR -100 0 1 15
VCTR 0 -100 1 15

JMPL START ; Loop back to the beginning
            `.trim()
        },
        {
            name: "Simple Line Test",
            code: `
; This will only display a transient line
; you would need to send this repeatedly, 
; altering the value in your program
COLOR 1 ; Cyan
LABS 100 100 1
VCTR 200 50 1 8
HALT ; halt is needed to tell the DVG to render
            `.trim()
        },
        {
            name: "Subroutine Example (Two Boxes)",
            code: `
LABEL MAIN
JSRL DRAWSMALLBOX
LABS 200 200 1 ; Move a bit
JSRL DRAWSMALLBOX
JMPL MAIN

LABEL DRAWSMALLBOX
COLOR 2 ; Magenta
VCTR 40 0 1 10
VCTR 0 40 1 10
VCTR -40 0 1 10
VCTR 0 -40 1 10
RTSL
            `.trim()
        },
        {
            name: "Monitor Default (Asteroids & Hatches)",
            code: `
LABEL START ; This is the beginning of the program

LABS -511 0 2 
VCTR 512 0 1 4
LABS -511 55 2
VCTR 512 0 1 4
LABS -511 125 2
VCTR 512 0 1 4
LABS -254 0 0
COLOR 1
VCTR -159 220 1 4
LABS -127 0 0
COLOR 2
VCTR -63 220 1 4
LABS 128 0 1
COLOR 3
VCTR 64 220 1 4
LABS 255 0 1
COLOR 5
VCTR 160 220 1 4
LABS 0 0 1
VCTR 0 512 1 4

; Draw some hatches, showing intensity levels
LABS -127 -450 1
JSRL VHATCH
LABS -127 155 1
JSRL VHATCH

; Draw some asteroids, demonstrating scaling
LABS -255 -100 4
JSRL ROID01
LABS -255 -200 3
JSRL ROID01
LABS -255 -270 2
JSRL ROID01
JMPL START ; return to the beginning

; The hatch-lines subroutine
LABEL VHATCH
SVEC 0 1 0 1
SVEC 1 -1 0 0
SVEC 0 1 0 2
SVEC 1 -1 0 0
SVEC 0 1 0 3
SVEC 1 -1 0 0
SVEC 0 1 0 4
SVEC 1 -1 0 0
SVEC 0 1 0 5
SVEC 1 -1 0 0
SVEC 0 1 0 6
SVEC 1 -1 0 0
SVEC 0 1 0 7
SVEC 1 -1 0 0
SVEC 0 1 0 8
SVEC 1 -1 0 0
SVEC 0 1 0 9
SVEC 1 -1 0 0
SVEC 0 1 0 10
SVEC 1 -1 0 0
SVEC 0 1 0 11
SVEC 1 -1 0 0
SVEC 0 1 0 12
SVEC 1 -1 0 0
SVEC 0 1 0 13
SVEC 1 -1 0 0
SVEC 0 1 0 14
SVEC 1 -1 0 0
SVEC 0 1 0 15
RTSL

; The asteroid subroutine
LABEL ROID01
COLOR 4
VCTR 0 2 1 0
VCTR 2 2 1 8
VCTR 2 -2 1 8
VCTR -1 -2 1 8
COLOR 3
VCTR 1 -2 1 8
VCTR -3 -2 1 8
VCTR -3 0 1 8
COLOR 2
VCTR -2 2 1 8
VCTR 0 4 1 8
VCTR 2 2 1 8
VCTR 2 -2 1 8
COLOR 0
RTSL
            `.trim()
        },
        {
            name: "Intensity Test Pattern",
            code: `
LABEL START
LABS -400 0 1
COLOR 1
VCTR 100 0 1 0
LABS -400 50 1
VCTR 100 0 1 4
LABS -400 100 1
VCTR 100 0 1 8
LABS -400 150 1
VCTR 100 0 1 12
LABS -400 200 1
VCTR 100 0 1 15

LABS -200 0 1
COLOR 2
VCTR 0 200 1 8 ; Vertical line

LABS 0 -100 1
COLOR 5
SVEC 1 1 3 15 ; Short vector test
JMPL START
            `.trim()
        }
    ];

    let generatePeerId;
    if (nanoid && customAlphabet) {
        const alphabet = "123456789bcdfghjkmnpqrstvwxyz";
        generatePeerId = customAlphabet(alphabet, 12);
    } else {
        console.warn('NanoID library not found. "Generate New ID" button will be disabled.');
        if (createNewMonitorButton) { createNewMonitorButton.disabled = true; createNewMonitorButton.title = "NanoID library failed to load."; }
    }

    if (targetPeerIdInput) {
        const savedPeerId = localStorage.getItem('targetPeerId');
        if (savedPeerId) targetPeerIdInput.value = savedPeerId;
        targetPeerIdInput.addEventListener('input', () => localStorage.setItem('targetPeerId', targetPeerIdInput.value.trim()));
    }

    if (dvgCommandsEditorTextarea && window.CodeMirror) {
        editor = CodeMirror.fromTextArea(dvgCommandsEditorTextarea, {
            lineNumbers: true, theme: "material", mode: "dvg"
        });

        // Populate dropdown and set default editor content
        if (dvgExamplesSelect && exampleScripts.length > 0) {
            exampleScripts.forEach((example, index) => {
                const option = document.createElement('option');
                option.value = index;
                option.textContent = example.name;
                dvgExamplesSelect.appendChild(option);
            });

            dvgExamplesSelect.addEventListener('change', (event) => {
                const selectedIndex = event.target.value;
                if (selectedIndex !== "" && exampleScripts[selectedIndex] && editor) {
                    editor.setValue(exampleScripts[selectedIndex].code);
                } else if (selectedIndex === "" && editor) {
                    editor.setValue(exampleScripts[0].code); // Default to first if "-- Select --" is chosen
                }
            });

            editor.setValue(exampleScripts[0].code); // Set initial content to the first example
            dvgExamplesSelect.value = "0"; // Set dropdown to match
        } else if (exampleScripts.length > 0 && editor) { // Fallback if select isn't found, but editor is
            editor.setValue(exampleScripts[0].code);
        }


        editor.setOption("extraKeys", {
            "Cmd-Enter": function (cm) { connectAndSendButton.click(); },
            "Ctrl-Enter": function (cm) { connectAndSendButton.click(); }
        });
    } else if (dvgCommandsEditorTextarea) { // Fallback if CodeMirror didn't load
        console.error("CodeMirror library not loaded or editor textarea not found. DVG editor will be a plain textarea.");
        if (exampleScripts.length > 0) {
            dvgCommandsEditorTextarea.value = exampleScripts[0].code; // Set value for plain textarea
        }
    }


    function initializeSenderPeer() { /* ... existing peer init logic ... */
        peer = new Peer();
        peer.on('open', id => { myPeerIdDisplayDiv.textContent = 'My PeerJS ID: ' + id; senderStatusDiv.textContent = 'Status: Ready. My PeerID is ' + id; console.log('Sender PeerJS ID:', id); });
        peer.on('error', err => { console.error('Sender PeerJS error:', err); senderStatusDiv.textContent = 'Status: PeerJS Error - ' + err.type; myPeerIdDisplayDiv.textContent = 'My PeerJS ID: Error'; });
        peer.on('disconnected', () => { senderStatusDiv.textContent = 'Status: Disconnected. Attempting reconnect...'; if (peer && !peer.destroyed) peer.reconnect(); });
        peer.on('close', () => { senderStatusDiv.textContent = 'Status: Peer connection closed. Please refresh.'; console.log('Peer connection closed.'); });
    }

    if (createNewMonitorButton) { /* ... existing button logic ... */
        if (generatePeerId) {
            createNewMonitorButton.addEventListener('click', () => {
                const newId = generatePeerId();
                targetPeerIdInput.value = newId;
                localStorage.setItem('targetPeerId', newId);
                const monitorPagePath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/static/')) + '/static/monitor_display.html';
                const newMonitorUrl = `${window.location.origin}${monitorPagePath}?peerId=${newId}`;
                console.log(`New Monitor URL: ${newMonitorUrl}`);
                senderStatusDiv.innerHTML = `Status: Generated Monitor ID: <b>${newId}</b>. URL: <a href="${newMonitorUrl}" target="_blank">${newMonitorUrl}</a>`;
            });
        } else { createNewMonitorButton.disabled = true; createNewMonitorButton.title = "NanoID library failed to load."; }
    }

    if (openMonitorButton) { /* ... existing button logic ... */
        openMonitorButton.addEventListener('click', () => {
            const targetId = targetPeerIdInput.value.trim();
            if (targetId) {
                const monitorPagePath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/static/')) + '/static/monitor_display.html';
                const monitorUrl = `${window.location.origin}${monitorPagePath}?peerId=${targetId}`;
                window.open(monitorUrl, '_blank');
                senderStatusDiv.textContent = `Status: Attempting to open monitor with ID: ${targetId}`;
            } else { alert('Target Monitor Peer ID field is empty.'); senderStatusDiv.textContent = 'Status: Cannot open monitor, Target ID is empty.'; }
        });
    }

    connectAndSendButton.addEventListener('click', () => { /* ... existing click logic ... */
        let dvgProgramText;
        if (editor) { dvgProgramText = editor.getValue(); }
        else if (dvgCommandsEditorTextarea) { dvgProgramText = dvgCommandsEditorTextarea.value; }
        else { alert("Code editor element not found!"); senderStatusDiv.textContent = 'Status: Code editor element not found.'; return; }

        if (!peer || peer.destroyed) { senderStatusDiv.textContent = 'Status: PeerJS not initialized. Please refresh.'; return; }
        const targetPeerId = targetPeerIdInput.value.trim();
        if (!targetPeerId) { senderStatusDiv.textContent = 'Status: Target Monitor Peer ID is required.'; alert('Please enter Target ID.'); return; }
        if (!dvgProgramText.trim()) { senderStatusDiv.textContent = 'Status: DVG Program Text cannot be empty.'; alert('Please enter a DVG program.'); return; }

        const desiredVpsValue = desiredVpsInput.value ? parseInt(desiredVpsInput.value) : null;
        const payload = { dvgProgramText: dvgProgramText, metadata: {} };
        if (desiredVpsValue && typeof desiredVpsValue === 'number' && desiredVpsValue > 0) { payload.metadata.vps = desiredVpsValue; }

        senderStatusDiv.textContent = `Status: Attempting to connect to ${targetPeerId}...`;
        if (currentConnection) currentConnection.close();
        currentConnection = peer.connect(targetPeerId, { reliable: true });

        currentConnection.on('open', () => {
            senderStatusDiv.textContent = `Status: Connected to ${targetPeerId}. Sending DVG program text...`;
            currentConnection.send(payload);
            senderStatusDiv.textContent = `Status: DVG program text sent to ${targetPeerId}.`;
            console.log('Payload (raw DVG text) sent:', payload);
        });
        currentConnection.on('data', data => { console.log('Received data from monitor:', data); senderStatusDiv.textContent = `Status: Received from ${targetPeerId}: ${data}`; });
        currentConnection.on('error', err => { senderStatusDiv.textContent = `Status: Error with ${targetPeerId}: ${err}`; console.error('Connection error:', err); });
        currentConnection.on('close', () => { senderStatusDiv.textContent = `Status: Connection with ${targetPeerId} closed.`; if (currentConnection && currentConnection.peer === targetPeerId) currentConnection = null; });
    });

    initializeSenderPeer();
});
