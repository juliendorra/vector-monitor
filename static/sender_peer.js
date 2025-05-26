window.addEventListener('load', () => {
    const targetPeerIdInput = document.getElementById('targetPeerId');
    const desiredVpsInput = document.getElementById('desiredVps'); // Added VPS input
    const dvgCommandsJsonTextarea = document.getElementById('dvgCommandsJson');
    const connectAndSendButton = document.getElementById('connectAndSendButton');
    const senderStatusDiv = document.getElementById('senderStatus');
    const myPeerIdDisplayDiv = document.getElementById('myPeerIdDisplay');

    let peer = null;
    let currentConnection = null;

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

    function parseDvgAssembly(assemblyText) {
        const newProg = [];
        const codeLabels = {};
        const lines = assemblyText.split('\n');
        let opNum = 0;

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith(';') || trimmedLine === '') continue;
            const parts = trimmedLine.split(/\s+/);
            const command = parts[0].toUpperCase();
            if (command === 'LABEL') {
                if (parts.length > 1) codeLabels[parts[1]] = opNum;
                else console.warn('LABEL without a name:', trimmedLine);
            } else if (['VCTR', 'LABS', 'COLOR', 'SCALE', 'CENTER', 'JMPL', 'JSRL', 'RTSL', 'HALT', 'SVEC'].includes(command)) {
                opNum++;
            }
        }
        console.log("Collected labels:", codeLabels);

        opNum = 0;
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith(';') || trimmedLine === '' || trimmedLine.toUpperCase().startsWith('LABEL')) continue;
            const parts = trimmedLine.split(/\s+/);
            const command = parts[0].toUpperCase();
            let op = null;
            try {
                switch (command) {
                    case 'VCTR': op = { opcode: 'VCTR', x: parseInt(parts[1]), y: parseInt(parts[2]), divisor: parseInt(parts[3]), intensity: parseInt(parts[4]) }; break;
                    case 'LABS': op = { opcode: 'LABS', x: parseInt(parts[1]), y: parseInt(parts[2]), scale: parseInt(parts[3]) }; break;
                    case 'SVEC': op = { opcode: 'SVEC', x: parseInt(parts[1]), y: parseInt(parts[2]), scale: parseInt(parts[3]), intensity: parseInt(parts[4]) }; break;
                    case 'COLOR': op = { opcode: 'COLOR', color: parseInt(parts[1]) }; break;
                    case 'SCALE': op = { opcode: 'SCALE', scale: parseInt(parts[1]) }; break;
                    case 'CENTER': op = { opcode: 'CENTER' }; break;
                    case 'JMPL':
                        if (codeLabels.hasOwnProperty(parts[1])) op = { opcode: 'JMPL', target: codeLabels[parts[1]] };
                        else throw new Error(`Undefined label for JMPL: ${parts[1]}`);
                        break;
                    case 'JSRL':
                        if (codeLabels.hasOwnProperty(parts[1])) op = { opcode: 'JSRL', target: codeLabels[parts[1]] };
                        else throw new Error(`Undefined label for JSRL: ${parts[1]}`);
                        break;
                    case 'RTSL': op = { opcode: 'RTSL' }; break;
                    case 'HALT': op = { opcode: 'HALT' }; break;
                    default: throw new Error(`Unknown opcode: ${command}`);
                }
                if (op) {
                    for (const key in op) if (typeof op[key] === 'number' && isNaN(op[key])) throw new Error(`Invalid argument for ${op.opcode} at line: ${trimmedLine} - parameter ${key} is NaN.`);
                    newProg.push(op);
                    opNum++;
                }
            } catch (e) { console.error("Error parsing line:", trimmedLine, e.message); throw e; }
        }
        return { ops: newProg, labels: codeLabels }; // Modified return value
    }

    function initializeSenderPeer() {
        peer = new Peer();
        peer.on('open', id => { myPeerIdDisplayDiv.textContent = 'My PeerJS ID: ' + id; senderStatusDiv.textContent = 'Status: Ready. My PeerID is ' + id; console.log('Sender PeerJS ID:', id); });
        peer.on('error', err => { console.error('Sender PeerJS error:', err); senderStatusDiv.textContent = 'Status: PeerJS Error - ' + err.type; myPeerIdDisplayDiv.textContent = 'My PeerJS ID: Error'; });
        peer.on('disconnected', () => { senderStatusDiv.textContent = 'Status: Disconnected. Attempting reconnect...'; if (peer && !peer.destroyed) peer.reconnect(); });
        peer.on('close', () => { senderStatusDiv.textContent = 'Status: Peer connection closed. Please refresh.'; console.log('Peer connection closed.'); });
    }

    connectAndSendButton.addEventListener('click', () => {
        if (!peer || peer.destroyed) { senderStatusDiv.textContent = 'Status: PeerJS not initialized. Please refresh.'; return; }
        const targetPeerId = targetPeerIdInput.value.trim();
        if (!targetPeerId) { senderStatusDiv.textContent = 'Status: Target Monitor Peer ID is required.'; alert('Please enter Target ID.'); return; }

        const commandsInput = dvgCommandsJsonTextarea.value;
        const trimmedInput = commandsInput.trim();
        let finalOps;
        let finalLabels = {};

        if (trimmedInput.startsWith('[') || trimmedInput.startsWith('{')) { // JSON Path
            try {
                finalOps = JSON.parse(trimmedInput);
                if (!Array.isArray(finalOps)) throw new Error("JSON input is not an array.");
                senderStatusDiv.textContent = 'Status: Parsed DVG commands as JSON.';
            } catch (e) { senderStatusDiv.textContent = 'Status: Invalid JSON: ' + e.message; alert('Invalid JSON: ' + e.message); return; }
        } else { // Raw DVG Assembly Path
            try {
                const parsedProgramData = parseDvgAssembly(trimmedInput);
                if (!parsedProgramData || !Array.isArray(parsedProgramData.ops)) {
                    senderStatusDiv.textContent = 'Status: Error parsing DVG assembly - no ops generated.';
                    alert('Could not parse DVG assembly text to valid ops.');
                    return;
                }
                finalOps = parsedProgramData.ops;
                finalLabels = parsedProgramData.labels;
                senderStatusDiv.textContent = 'Status: Parsed DVG commands from assembly text.';
            } catch (e) { senderStatusDiv.textContent = 'Status: Error parsing DVG assembly: ' + e.message; alert('Error parsing DVG assembly: ' + e.message); return; }
        }

        if (finalOps.length === 0 && trimmedInput.length > 0) {
             senderStatusDiv.textContent = 'Status: Parsed to empty array. Nothing to send.';
             alert('Parsing resulted in no operations.');
             return;
        }

        const desiredVpsValue = desiredVpsInput.value ? parseInt(desiredVpsInput.value) : null;
        const payload = {
            ops: finalOps,
            labels: finalLabels,
            metadata: {}
        };
        if (desiredVpsValue && typeof desiredVpsValue === 'number' && desiredVpsValue > 0) {
            payload.metadata.vps = desiredVpsValue;
        }

        senderStatusDiv.textContent = `Status: Attempting to connect to ${targetPeerId}...`;
        if (currentConnection) currentConnection.close();
        currentConnection = peer.connect(targetPeerId, { reliable: true });

        currentConnection.on('open', () => {
            senderStatusDiv.textContent = `Status: Connected to ${targetPeerId}. Sending payload...`;
            currentConnection.send(payload);
            senderStatusDiv.textContent = `Status: Payload sent to ${targetPeerId}. (${finalOps.length} ops)`;
            console.log('Payload sent:', payload);
        });
        currentConnection.on('data', data => { console.log('Received data from monitor:', data); senderStatusDiv.textContent = `Status: Received from ${targetPeerId}: ${data}`; });
        currentConnection.on('error', err => { senderStatusDiv.textContent = `Status: Error with ${targetPeerId}: ${err}`; console.error('Connection error:', err); });
        currentConnection.on('close', () => { senderStatusDiv.textContent = `Status: Connection with ${targetPeerId} closed.`; if (currentConnection && currentConnection.peer === targetPeerId) currentConnection = null; });
    });

    initializeSenderPeer();
});
