window.addEventListener('load', () => {
    const targetPeerIdInput = document.getElementById('targetPeerId');
    const desiredVpsInput = document.getElementById('desiredVps');
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

    // parseDvgAssembly function is removed.

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

        const dvgProgramText = dvgCommandsJsonTextarea.value; // Directly get the text
        
        if (!dvgProgramText.trim()) {
            senderStatusDiv.textContent = 'Status: DVG Program Text cannot be empty.';
            alert('Please enter a DVG program.');
            return;
        }

        const desiredVpsValue = desiredVpsInput.value ? parseInt(desiredVpsInput.value) : null;
        
        const payload = {
            dvgProgramText: dvgProgramText, // Send the raw text
            metadata: {}
        };

        if (desiredVpsValue && typeof desiredVpsValue === 'number' && desiredVpsValue > 0) {
            payload.metadata.vps = desiredVpsValue;
        }

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
