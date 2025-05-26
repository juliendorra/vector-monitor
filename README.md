# Web DVG CRT Vector Monitor

Try it here: https://vector-monitor.deno.dev/sender_peer.html 

This project implements a web-based "fantasy" CRT vector monitor that receives drawing commands in real-time using PeerJS for peer-to-peer communication. It simulates the visual characteristics of a vector display, allowing other web applications to use it as an output peripheral.

The commands are based on the ones in the Atari's Digital Vector Generator, used in Asteroids and Tempest. 

It's important to understand that this monitor emulates a *programmable display*. Rather than just rendering static images, applications send a sequence of commands—a program—that the monitor's vector generator interprets. This program can include control flow instructions like jumps and subroutine calls, enabling dynamic and persistent visuals.

It's based on the [Atari Digital Vector Generator Simulator](https://laemeur.sdf.org/dvgsim/) by Adam Moore, with COLOR, CENTER and SCALE commands added.

## Architecture

The system consists of two main parts:

1.  **The DVG Monitor (`static/monitor_display.html`):** This is the client-side application that emulates the vector display. It initializes a PeerJS client, obtains a unique PeerJS ID (typically provided via URL parameter), and listens for incoming data connections. When it receives DVG (Digital Vector Generator) commands (a program), it renders them on an HTML canvas.
2.  **The Sender Application (example: `static/sender_peer.html`):** This is an example web application that also uses PeerJS. It allows users to write or load DVG assembly programs, connect to a specified DVG Monitor's PeerJS ID, and send the programs for execution. It includes features like PeerJS ID generation for monitors, local storage for target IDs, a CodeMirror editor with DVG syntax highlighting, and example scripts.

The server component (`main.ts`) is a simple Deno static file server responsible only for serving the HTML, JavaScript, and CSS files. All real-time communication is handled directly between the sender and the monitor clients via PeerJS, using the public PeerJS server for signaling by default.

## Features

*   Real-time vector drawing on an HTML canvas.
*   PeerJS integration for P2P communication.
*   Sender UI with:
    *   NanoID generation for unique monitor PeerJS IDs.
    *   Button to directly open a configured monitor window.
    *   Local browser storage for remembering the last used Target Monitor Peer ID.
    *   CodeMirror editor for DVG assembly input with custom syntax highlighting.
    *   Cmd/Ctrl+Enter shortcut to send programs from the editor.
    *   A selector for loading example DVG scripts.
    *   Option to suggest a "Desired Display VPS" (Vectors Per Second) to the monitor.
*   Monitor displays received DVG program code in its own UI.
*   Monitor dynamically adjusts drawing speed (`maxOps`) based on program length and received VPS metadata to improve CRT effect for varying program sizes.
*   Simulated phosphor glow and decay effects.
*   Support for programmatic DVG commands including loops and subroutines for persistent/dynamic displays.

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

**B. Launching the Monitor via the Sender Page:**

   The recommended way to start is by using the Sender Page to generate a unique ID for your monitor instance and then launch it.

   1.  **Open the Sender Page:**
       In your web browser, navigate to:
       ```
       http://localhost:8000/sender_peer.html
       ```
       The Sender Page will initialize its own PeerJS connection and display its ID. It also provides controls to manage the target monitor. If you've used it before, it might remember your last Target Monitor Peer ID.

   2.  **Generate a Monitor ID (if needed):**
       *   On the Sender Page, click the "Generate ID" button next to the "Target Monitor Peer ID" field.
       *   This will populate the field with a new, unique ID (e.g., `your-generated-id`).
       *   The full URL for this new monitor (e.g., `http://localhost:8000/monitor_display.html?peerId=your-generated-id`) will also be logged to your browser's developer console. This ID is automatically saved locally in your browser for future sessions.

   3.  **Open the Monitor Window:**
       *   Ensure the "Target Monitor Peer ID" field on the Sender Page contains the ID you want to use.
       *   Click the "Open Monitor" button on the Sender Page.
       *   This will open the DVG Monitor (`monitor_display.html`) in a new browser tab or window, configured with the PeerJS ID from the input field.

   4.  **Verify Monitor Connection:**
       *   Switch to the newly opened DVG Monitor window.
       *   It should display "Monitor PeerJS ID: your-generated-id" (or whatever ID was generated/used). This confirms it's ready.
   
   You now have the Sender Page and the DVG Monitor Page open. The "Target Monitor Peer ID" on the sender page is set to the ID of the monitor window you just opened.

   *(Alternatively, you can still manually open `monitor_display.html` with a specific `?peerId=` or let it generate a random one, and then copy that ID into the sender's target field, but the above workflow is generally more convenient.)*

### 3. Testing with the Sender UI

1.  **Using the Sender Page (`sender_peer.html`):**
    *   Ensure the "Target Monitor Peer ID" field is populated with the ID of the DVG Monitor window you opened (this should be automatic if you used the "Generate ID" and "Open Monitor" buttons).
    *   The "DVG Assembly Program Text:" CodeMirror editor area will be pre-filled with an example DVG assembly program (a looping square). You can select other examples from the "Load Example Program:" dropdown, or write/paste your own DVG assembly. (See "DVG Command Reference" below).
    *   (Optional) You can specify a "Desired Display VPS" to influence the monitor's drawing speed.
    *   Click the "Connect & Send Commands" button (or use Cmd/Ctrl+Enter shortcut from the editor).

2.  **On the DVG Monitor Page (`monitor_display.html`):**
    *   If the connection is successful, the DVG program sent from the sender page should be executed and rendered on the canvas. If it's a looping program, the image will persist with CRT effects.
    *   The text area under "Open Tools" > "Program" should display the received DVG assembly text as it was sent.

    Check the browser's Developer Console on both pages for status messages or errors (e.g., the monitor page logs the "Adjusted maxOps" value).

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
    // ... error handling ...
    ```

3.  **Connect to the DVG Monitor & Send Program:**
    ```javascript
    const targetMonitorPeerId = '...'; // The ID of the target DVG Monitor instance
    const conn = peer.connect(targetMonitorPeerId, { reliable: true });

    conn.on('open', () => {
        const dvgProgramString = `
            LABEL START
            COLOR 1
            LABS 100 100 1
            VCTR 50 50 1 8
            JMPL START
        `;
        const desiredVPS = 1000; // Optional

        const payload = {
            dvgProgramText: dvgProgramString,
            metadata: {}
        };
        if (desiredVPS) {
            payload.metadata.vps = desiredVPS;
        }
        conn.send(payload);
    });
    // ... other connection event handlers (data, error, close) ...
    ```
    Your application needs a way to know the `targetMonitorPeerId`. 
    
    I suggest generating a random monitor ID for each player, and your app then putting the monitor in a iframe or offering to pop it up.

    The monitor ID could be entered by the user, pre-configured, or discovered if you implement a discovery mechanism.

## DVG Command Reference
DVG commands are sent as an assembly-like text program. The monitor parses this program for execution.

### Drawing Opcodes
*   **`COLOR <color_index>`**: Sets drawing color. Example: `COLOR 1`
*   **`LABS <x> <y> <scale_factor_index>`**: Moves beam to absolute `(x, y)`, sets scale. Example: `LABS 400 300 1`
*   **`VCTR <dx> <dy> <divisor_index> <intensity>`**: Draws vector relative to current point. Example: `VCTR 100 50 1 8`
*   **`SVEC <dx_s> <dy_s> <scale_s_index> <intensity>`**: Draws short scaled vector. Example: `SVEC 1 1 0 10`
*   **`SCALE <scale_factor_index>`**: Sets global scale. Example: `SCALE 2`
*   **`CENTER`**: Moves beam to center.

### Program Control Opcodes
*   **`LABEL <name>`**: Defines a named location for jumps. Example: `LABEL myLoopStart`
*   **`JMPL <label>`**: Jumps to specified label. Essential for loops and persistent images. Example: `JMPL myLoopStart`
*   **`JSRL <label>`**: Jumps to subroutine at label, stores return address. Example: `JSRL drawBoxRoutine`
*   **`RTSL`**: Returns from subroutine.
*   **`HALT`**: Halts program execution.

*(For direct JSON sending, which is no longer the primary method for the example sender but possible if an application constructs the payload directly, `JMPL` and `JSRL` targets would be numeric indices. `LABEL` is an assembly-time directive.)*

## Limitations of a (Virtual) Vector Display

*   **No Raster Graphics:** Vector displays draw lines, not filled shapes in the way raster displays do (though complex patterns of lines can simulate fills). They don't directly support pixels or bitmap images.
*   **Complexity vs. Speed:** The more vectors (lines) in a frame, the longer it takes to draw the entire image. Very complex images may cause flicker if the drawing rate can't keep up with the phosphor decay (i.e., the program loop is too long). By default, the web fantasy vector monitor scale up the vector lines per second automatically to ensure both the retro feel and no slowdown.
*   **Phosphor Simulation:** The "glow" and "decay" are simulations. The decay rate affects how long lines remain visible. If too slow, fast-moving objects create trails; if too fast, the image might flicker.
*   **Intensity Levels:** The number of distinct brightness/thickness levels is limited.
*   **Color Palette:** The color palette is predefined and limited.
*   **Transformations:** Complex transformations (rotation, arbitrary scaling beyond predefined factors) must be calculated by the application sending the commands before breaking them down into vectors. The monitor itself has limited built-in scaling.
*   **No Depth Buffering:** Lines are drawn in the order they are received. There's no Z-buffering to handle occlusion of 3D objects automatically.

## Development Notes
*   The project uses Deno for its simple static server.
*   PeerJS handles the WebRTC complexity for P2P data channels.
*   `dvgsim.js` contains the core vector rendering logic and DVG instruction processing, including parsing DVG assembly.
```
