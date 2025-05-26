# Web DVG CRT Vector Monitor

This project implements a web-based "fantasy" CRT vector monitor that receives drawing commands in real-time using PeerJS for peer-to-peer communication. It simulates the visual characteristics of a vector display, allowing other web applications to use it as an output peripheral.

## Architecture

The system consists of two main parts:

1.  **The DVG Monitor (`static/monitor_display.html`):** This is the client-side application that emulates the vector display. It initializes a PeerJS client, obtains a unique PeerJS ID, and listens for incoming data connections. When it receives DVG (Digital Vector Generator) commands, it renders them on an HTML canvas.
2.  **The Sender Application (example: `static/sender_peer.html`):** This is an example web application that also uses PeerJS. It connects to a specified DVG Monitor's PeerJS ID and sends DVG commands to it.

The server component (`main.ts`) is a simple Deno static file server responsible only for serving the HTML, JavaScript, and CSS files. All real-time communication is handled directly between the sender and the monitor clients via PeerJS, using the public PeerJS server for signaling by default.

## Features

*   Real-time vector drawing on an HTML canvas.
*   PeerJS integration for P2P communication.
*   Configurable PeerJS ID for the monitor via URL parameters.
*   Example sender application to test command dispatch.
*   Displays received DVG program code in a text area on the monitor page.
*   Simulated phosphor glow and decay effects.

## Getting Started

### 1. Prerequisites

*   Deno runtime installed (for running the static file server).
*   A modern web browser that supports HTML5 Canvas and WebRTC (for PeerJS).

### 2. Running the Application

**A. Start the Static File Server:**

   Open your terminal, navigate to the project's root directory, and run:
   ```bash
   deno run -A main.ts
   ```
   This will start a local web server, typically at `http://localhost:8000`.

**B. Open the DVG Monitor Page:**

   In your web browser, navigate to the monitor page. You have a few options for the PeerJS ID:

   *   **Use a specific ID:**
       `http://localhost:8000/monitor_display.html?peerId=your-chosen-monitor-id`
       (Replace `your-chosen-monitor-id` with a unique string).
   *   **Use the default test ID:**
       `http://localhost:8000/monitor_display.html?peerId=peerjs-nqijkptdzzrf-vector`
   *   **Let PeerJS assign a random ID:**
       `http://localhost:8000/monitor_display.html`

   The monitor page will display its *actual* PeerJS ID (e.g., "Monitor PeerJS ID: your-chosen-monitor-id"). Note this ID down, as the sender will need it.

**C. Open the Sender Page:**

   In another browser tab or window, navigate to:
   ```
   http://localhost:8000/sender_peer.html
   ```
   This page will also initialize its own PeerJS client and display its ID.

### 3. Testing with the Sender UI

1.  On the **Sender Page (`sender_peer.html`):**
    *   In the "Target Monitor Peer ID" field, enter the full PeerJS ID that the DVG Monitor page is displaying.
    *   The "DVG Commands (JSON Array of Ops)" textarea will be pre-filled with an example JSON array of drawing commands. You can modify this or use your own. (See "DVG Command Reference" below).
    *   Click the "Connect & Send Commands" button.

2.  On the **DVG Monitor Page (`monitor_display.html`):**
    *   If the connection is successful, the DVG commands sent from the sender page should be rendered on the canvas.
    *   The text area under "Open Tools" > "Program" should display the received commands in an assembly-like format.

    Check the browser's Developer Console on both pages for status messages or errors.

## Integrating into Your Own Application

To send DVG commands from your own web application to the DVG Monitor:

1.  **Include PeerJS Library:** Add PeerJS to your application.
    ```html
    <script src="https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js"></script>
    ```

2.  **Initialize PeerJS in Your App:**
    ```javascript
    const peer = new Peer(); // Or new Peer('your-app-specific-id');
    peer.on('open', function(id) {
        console.log('My application PeerJS ID is: ' + id);
    });
    peer.on('error', function(err) {
        console.error('PeerJS error in application:', err);
    });
    ```

3.  **Connect to the DVG Monitor:**
    ```javascript
    // targetMonitorPeerId is the ID displayed by the DVG Monitor page
    const targetMonitorPeerId = '...'; // Get this from the monitor instance
    const conn = peer.connect(targetMonitorPeerId, { reliable: true });

    conn.on('open', () => {
        console.log('Connected to DVG Monitor: ' + targetMonitorPeerId);

        // Prepare your DVG commands (see DVG Command Reference)
        const dvgOps = [
            { opcode: 'COLOR', color: 1 },
            { opcode: 'LABS', x: 100, y: 100, scale: 1 },
            { opcode: 'VCTR', x: 50, y: 50, divisor: 1, intensity: 8 }
            // ... more commands
        ];

        conn.send(dvgOps); // Send the commands
        console.log('DVG commands sent.');

        // You can keep the connection open to send more commands or close it.
        // conn.close();
    });

    conn.on('data', (data) => {
        // Optional: Handle any acknowledgment or data sent back from the monitor
        console.log('Received from monitor:', data);
    });

    conn.on('error', (err) => {
        console.error('Connection error with monitor:', err);
    });
    ```
    Your application needs a way to know the `targetMonitorPeerId`. This could be entered by the user, configured, or discovered via another mechanism if you build one.

## DVG Command Reference

DVG commands are sent as a JSON array of operation objects. Each object must have an `opcode` property and other properties depending on the command.

*   **`COLOR <color_index>`**
    *   Sets the drawing color. `color_index` is an integer referencing a predefined color palette in the monitor.
    *   JSON: `{"opcode": "COLOR", "color": <Number>}`
    *   Example: `{"opcode": "COLOR", "color": 1}` (Sets color to Cyan)

*   **`LABS <x> <y> <scale_factor_index>`**
    *   Load Absolute: Moves the beam to absolute screen coordinates `(x, y)` without drawing. Sets the global scale factor.
    *   `x, y`: Absolute screen coordinates (e.g., 0 to canvas width/height).
    *   `scale_factor_index`: An integer (0-15) that maps to a predefined scaling factor.
    *   JSON: `{"opcode": "LABS", "x": <Number>, "y": <Number>, "scale": <Number>}`
    *   Example: `{"opcode": "LABS", "x": 400, "y": 300, "scale": 1}`

*   **`VCTR <dx> <dy> <divisor_index> <intensity>`**
    *   Vector Relative: Draws a line (vector) from the current beam position to `(current_x + dx / divisor, current_y + dy / divisor)`.
    *   `dx, dy`: Relative change in coordinates.
    *   `divisor_index`: An integer (0-9) referencing a predefined divisor (e.g., 0 for /1, 1 for /2).
    *   `intensity`: Beam intensity (0-15), affecting brightness and thickness.
    *   JSON: `{"opcode": "VCTR", "x": <Number>, "y": <Number>, "divisor": <Number>, "intensity": <Number>}`
    *   Example: `{"opcode": "VCTR", "x": 100, "y": 50, "divisor": 1, "intensity": 8}`

*   **`SVEC <dx_s> <dy_s> <scale_s_index> <intensity>`**
    *   Short Vector Relative: Draws a short vector. `dx_s`, `dy_s` are small integers (0-3), scaled by `scale_s_index`.
    *   `dx_s, dy_s`: Short vector coordinates (0-3).
    *   `scale_s_index`: Scale factor for short vector (0-3).
    *   `intensity`: Beam intensity (0-15).
    *   JSON: `{"opcode": "SVEC", "x": <Number>, "y": <Number>, "scale": <Number>, "intensity": <Number>}`
    *   Example: `{"opcode": "SVEC", "x": 1, "y": 1, "scale": 0, "intensity": 10}`

*   **`SCALE <scale_factor_index>`**
    *   Sets the global scale factor, same as the third parameter of `LABS`.
    *   JSON: `{"opcode": "SCALE", "scale": <Number>}`
    *   Example: `{"opcode": "SCALE", "scale": 2}`

*   **`CENTER`**
    *   Moves the beam to the center of the display without drawing.
    *   JSON: `{"opcode": "CENTER"}`

*Internally, the monitor also supports `HALT`, `JMPL`, `JSRL`, `RTSL` for its own text-based programming via the UI, but these are typically not sent via the PeerJS connection for direct drawing.*

## Limitations of a (Virtual) Vector Display

*   **No Raster Graphics:** Vector displays draw lines, not filled shapes in the way raster displays do (though complex patterns of lines can simulate fills). They don't directly support pixels or bitmap images.
*   **Complexity vs. Speed:** The more vectors (lines) in a frame, the longer it takes to draw the entire image. Very complex images may cause flicker if the drawing rate can't keep up with the phosphor decay.
*   **Phosphor Simulation:** The "glow" and "decay" are simulations. The decay rate affects how long lines remain visible. If too slow, fast-moving objects create trails; if too fast, the image might flicker.
*   **Intensity Levels:** The number of distinct brightness/thickness levels is limited.
*   **Color Palette:** The color palette is predefined and limited.
*   **Transformations:** Complex transformations (rotation, arbitrary scaling beyond predefined factors) must be calculated by the application sending the commands before breaking them down into vectors. The monitor itself has limited built-in scaling.
*   **No Depth Buffering:** Lines are drawn in the order they are received. There's no Z-buffering to handle occlusion of 3D objects automatically.

## Development Notes

*   The project uses Deno for its simple static server.
*   PeerJS handles the WebRTC complexity for P2P data channels.
*   `dvgsim.js` contains the core vector rendering logic and DVG instruction processing.
