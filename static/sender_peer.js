window.addEventListener('load', () => {
    const targetPeerIdInput = document.getElementById('targetPeerId');
    const dvgCommandsJsonTextarea = document.getElementById('dvgCommandsJson');
    const connectAndSendButton = document.getElementById('connectAndSendButton');
    const senderStatusDiv = document.getElementById('senderStatus');
    const myPeerIdDisplayDiv = document.getElementById('myPeerIdDisplay');

    let peer = null;
    let currentConnection = null;

    // --- Default DVG commands for testing (now as raw assembly text) ---
    const defaultCommandsText = `
LABEL START
COLOR 3 ; Red
LABS 350 250 1
VCTR 100 0 1 15
VCTR 0 100 1 15
VCTR -100 0 1 15
VCTR 0 -100 1 15
JMPL START ; Loop back to the beginning
    `;
    dvgCommandsJsonTextarea.value = defaultCommandsText.trim();
    // --- End Default DVG commands ---

    function parseDvgAssembly(assemblyText) {
        const newProg = [];
        const codeLabels = {};
        const lines = assemblyText.split('\n');
        let opNum = 0; // Instruction counter for label resolution

        // First Pass: Collect all labels and their corresponding opNum
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith(';') || trimmedLine === '') {
                continue;
            }

            const parts = trimmedLine.split(/\s+/);
            const command = parts[0].toUpperCase();

            if (command === 'LABEL') {
                if (parts.length > 1) {
                    codeLabels[parts[1]] = opNum;
                } else {
                    console.warn('LABEL without a name:', trimmedLine);
                }
                // Labels themselves don't count as ops for indexing
            } else if (['VCTR', 'LABS', 'COLOR', 'SCALE', 'CENTER', 'JMPL', 'JSRL', 'RTSL', 'HALT', 'SVEC'].includes(command)) {
                opNum++;
            }
        }
        console.log("Collected labels:", codeLabels);


        // Second Pass: Generate op objects
        opNum = 0; // Reset for actual op construction
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith(';') || trimmedLine === '' || trimmedLine.toUpperCase().startsWith('LABEL')) {
                continue;
            }

            const parts = trimmedLine.split(/\s+/);
            const command = parts[0].toUpperCase();
            let op = null;

            try {
                switch (command) {
                    case 'VCTR': // VCTR x y divisor intensity
                        op = { opcode: 'VCTR', x: parseInt(parts[1]), y: parseInt(parts[2]), divisor: parseInt(parts[3]), intensity: parseInt(parts[4]) };
                        break;
                    case 'LABS': // LABS x y scale
                        op = { opcode: 'LABS', x: parseInt(parts[1]), y: parseInt(parts[2]), scale: parseInt(parts[3]) };
                        break;
                    case 'SVEC': // SVEC x y scale intensity
                        op = { opcode: 'SVEC', x: parseInt(parts[1]), y: parseInt(parts[2]), scale: parseInt(parts[3]), intensity: parseInt(parts[4]) };
                        break;
                    case 'COLOR': // COLOR color
                        op = { opcode: 'COLOR', color: parseInt(parts[1]) };
                        break;
                    case 'SCALE': // SCALE scale
                        op = { opcode: 'SCALE', scale: parseInt(parts[1]) };
                        break;
                    case 'CENTER':
                        op = { opcode: 'CENTER' };
                        break;
                    case 'JMPL': // JMPL labelName
                        if (codeLabels.hasOwnProperty(parts[1])) {
                            op = { opcode: 'JMPL', target: codeLabels[parts[1]] };
                        } else {
                            throw new Error(`Undefined label for JMPL: ${parts[1]}`);
                        }
                        break;
                    case 'JSRL': // JSRL labelName
                        if (codeLabels.hasOwnProperty(parts[1])) {
                            op = { opcode: 'JSRL', target: codeLabels[parts[1]] };
                        } else {
                            throw new Error(`Undefined label for JSRL: ${parts[1]}`);
                        }
                        break;
                    case 'RTSL':
                        op = { opcode: 'RTSL' };
                        break;
                    case 'HALT':
                        op = { opcode: 'HALT' };
                        break;
                    default:
                        console.warn('Unknown opcode in assembly:', command, 'at line:', trimmedLine);
                        // Optionally, throw an error or skip
                        throw new Error(`Unknown opcode: ${command}`);
                }

                if (op) {
                    // Validate op parameters (NaN checks for parseInt results)
                    for (const key in op) {
                        if (typeof op[key] === 'number' && isNaN(op[key])) {
                            throw new Error(`Invalid argument for ${op.opcode} at line: ${trimmedLine} - parameter ${key} is NaN.`);
                        }
                    }
                    newProg.push(op);
                    opNum++;
                }
            } catch (e) {
                console.error("Error parsing line:", trimmedLine, e.message);
                throw e; // Re-throw to be caught by the caller
            }
        }
        return newProg;
    }


    function initializeSenderPeer() {
        peer = new Peer(); 

        peer.on('open', (id) => {
            myPeerIdDisplayDiv.textContent = 'My PeerJS ID: ' + id;
            senderStatusDiv.textContent = 'Status: Ready. My PeerID is ' + id;
            console.log('Sender PeerJS ID:', id);
        });

        peer.on('error', (err) => {
            console.error('Sender PeerJS error:', err);
            senderStatusDiv.textContent = 'Status: PeerJS Error - ' + err.type;
            myPeerIdDisplayDiv.textContent = 'My PeerJS ID: Error';
        });

        peer.on('disconnected', () => {
            senderStatusDiv.textContent = 'Status: Disconnected from PeerJS server. Attempting to reconnect...';
            console.log('Disconnected from PeerJS server. Attempting to reconnect...');
            if (peer && !peer.destroyed) {
                peer.reconnect();
            }
        });
        
        peer.on('close', () => {
            senderStatusDiv.textContent = 'Status: Peer connection closed. Cannot auto-reconnect peer, please refresh.';
            console.log('Peer connection closed.');
        });
    }

    connectAndSendButton.addEventListener('click', () => {
        if (!peer || peer.destroyed) {
            senderStatusDiv.textContent = 'Status: PeerJS not initialized or destroyed. Please refresh.';
            console.error('PeerJS not initialized or destroyed.');
            return;
        }

        const targetPeerId = targetPeerIdInput.value.trim();
        if (!targetPeerId) {
            senderStatusDiv.textContent = 'Status: Target Monitor Peer ID is required.';
            alert('Please enter the Target Monitor Peer ID.');
            return;
        }

        const commandsInput = dvgCommandsJsonTextarea.value;
        let ops;
        const trimmedInput = commandsInput.trim();

        if (trimmedInput.startsWith('[') || trimmedInput.startsWith('{')) { // Assume JSON
            try {
                ops = JSON.parse(trimmedInput);
                senderStatusDiv.textContent = 'Status: Parsed DVG commands as JSON.';
            } catch (e) {
                senderStatusDiv.textContent = 'Status: Invalid JSON in DVG Commands.';
                alert('Error parsing DVG Commands JSON: ' + e.message);
                return;
            }
        } else { // Assume Raw DVG Assembly
            try {
                ops = parseDvgAssembly(trimmedInput); 
                if (!ops) { 
                     senderStatusDiv.textContent = 'Status: Error parsing DVG assembly. Parser returned no ops.';
                     alert('Could not parse DVG assembly text. Check console for details.');
                     return;
                }
                senderStatusDiv.textContent = 'Status: Parsed DVG commands from assembly text.';
            } catch (e) {
                senderStatusDiv.textContent = 'Status: Error parsing DVG assembly: ' + e.message;
                alert('Error parsing DVG assembly: ' + e.message);
                return;
            }
        }

        if (!Array.isArray(ops)) {
            senderStatusDiv.textContent = 'Status: DVG Commands must result in a JSON array.';
            alert('DVG Commands, whether from JSON or assembly, must produce an array of operations.');
            return;
        }
        
        if (ops.length === 0 && trimmedInput.length > 0) {
             senderStatusDiv.textContent = 'Status: Parsed DVG commands, but result is an empty array. Nothing to send.';
             alert('Parsing resulted in no operations. Please check your DVG commands.');
             return;
        }


        senderStatusDiv.textContent = `Status: Attempting to connect to ${targetPeerId}...`;

        if (currentConnection) {
            console.log('Closing existing connection before creating a new one.');
            currentConnection.close();
        }

        currentConnection = peer.connect(targetPeerId, { reliable: true });

        currentConnection.on('open', () => {
            senderStatusDiv.textContent = `Status: Connected to ${targetPeerId}. Sending ${ops.length} commands...`;
            console.log(`Connection established with ${targetPeerId}.`);
            currentConnection.send(ops);
            senderStatusDiv.textContent = `Status: ${ops.length} commands sent to ${targetPeerId}.`;
            console.log('Commands sent.');
        });

        currentConnection.on('data', (data) => {
            console.log('Received data from monitor:', data);
            senderStatusDiv.textContent = `Status: Received data from ${targetPeerId}: ${data}`;
        });
        
        currentConnection.on('error', (err) => {
            senderStatusDiv.textContent = `Status: Error connecting to or with ${targetPeerId}: ${err}`;
            console.error('Connection error with ' + targetPeerId + ':', err);
        });

        currentConnection.on('close', () => {
            senderStatusDiv.textContent = `Status: Connection with ${targetPeerId} closed.`;
            console.log('Connection closed with ' + targetPeerId);
            if (currentConnection && currentConnection.peer === targetPeerId) { 
                 currentConnection = null; 
            }
        });
    });

    initializeSenderPeer();
});
