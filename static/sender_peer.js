window.addEventListener('load', () => {
    const targetPeerIdInput = document.getElementById('targetPeerId');
    const dvgCommandsJsonTextarea = document.getElementById('dvgCommandsJson');
    const connectAndSendButton = document.getElementById('connectAndSendButton');
    const senderStatusDiv = document.getElementById('senderStatus');
    const myPeerIdDisplayDiv = document.getElementById('myPeerIdDisplay');

    let peer = null;
    let currentConnection = null;

    // --- Default DVG commands for testing ---
    const defaultCommands = [
        { opcode: 'COLOR', color: 3 }, // Red
        { opcode: 'LABS', x: 350, y: 250, scale: 1 },
        { opcode: 'VCTR', x: 100, y: 0, divisor: 1, intensity: 15 },
        { opcode: 'VCTR', x: 0, y: 100, divisor: 1, intensity: 15 },
        { opcode: 'VCTR', x: -100, y: 0, divisor: 1, intensity: 15 },
        { opcode: 'VCTR', x: 0, y: -100, divisor: 1, intensity: 15 }
    ];
    dvgCommandsJsonTextarea.value = JSON.stringify(defaultCommands, null, 2);
    // --- End Default DVG commands ---

    function initializeSenderPeer() {
        peer = new Peer(); // Let PeerJS server assign an ID

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

        // Reconnect logic for PeerJS if disconnected from signaling server
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

        let ops;
        try {
            ops = JSON.parse(dvgCommandsJsonTextarea.value);
        } catch (e) {
            senderStatusDiv.textContent = 'Status: Invalid JSON in DVG Commands.';
            alert('Error parsing DVG Commands JSON: ' + e.message);
            return;
        }

        if (!Array.isArray(ops)) {
            senderStatusDiv.textContent = 'Status: DVG Commands must be a JSON array.';
            alert('DVG Commands must be a JSON array.');
            return;
        }

        senderStatusDiv.textContent = `Status: Attempting to connect to ${targetPeerId}...`;

        // Close any existing connection before creating a new one
        if (currentConnection) {
            console.log('Closing existing connection before creating a new one.');
            currentConnection.close();
        }

        currentConnection = peer.connect(targetPeerId, { reliable: true });

        currentConnection.on('open', () => {
            senderStatusDiv.textContent = `Status: Connected to ${targetPeerId}. Sending commands...`;
            console.log(`Connection established with ${targetPeerId}.`);
            currentConnection.send(ops);
            senderStatusDiv.textContent = `Status: Commands sent to ${targetPeerId}.`;
            console.log('Commands sent.');
            // Optionally, you might want to close the connection after sending,
            // or keep it open for more commands. For now, it stays open.
            // currentConnection.close(); 
        });

        currentConnection.on('data', (data) => {
            // Sender typically doesn't expect data back in this simple model, but log if received
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
            if (currentConnection === currentConnection) { // Check if it's the same object, not a new one
                 currentConnection = null; // Clear currentConnection if this one closed
            }
        });
    });

    initializeSenderPeer();
});
