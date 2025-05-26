var canvasElement = document.getElementById("phosphor");
var DVG = canvasElement.getContext("2d");

// --- WebSocket logic removed ---

canvasElement.width = window.innerWidth;
canvasElement.height = window.innerHeight;
tailsX = Array(0, 0, 0);
tailsY = Array(0, 0, 0);
bufferWidth = canvasElement.width * 4;
bufferDepth = bufferWidth * canvasElement.height;
maxOps = 40;
pDecay = 0.07;
lastPoint = new Object();
lastPoint.x = 0;
lastPoint.y = 0;
vps = document.getElementById("vps");
decay = document.getElementById("decay");
// =============================================
var pc = 0;                // Program Counter
var stack = new Array();   // Stack
var program = new Array(); // Program memory
var HALT_FLAG = 0;         // 
var SCALE_FACTOR = 0;      //
var COLOR = 0;
var lastIntensity = 8;
//==============================================
// ... (DVG constants like intWidths, intBright, divisors, scalers, colors remain unchanged) ...
var intWidths1 = [1, 1, 1, 1, 1, 1, 1, 1,
	1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.7, 2];
var intWidths2 = [3, 3, 3, 3, 3, 3, 3, 3,
	3, 3.1, 3.2, 3.3, 3.4, 3.6, 3.8, 4];
var intWidths3 = [6, 6, 6, 6, 6, 6, 6, 6,
	6, 6.1, 6.3, 6.5, 6.8, 7.2, 7.6, 8];
var intBright1 = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7,
	0.8, 0.81, 0.82, 0.83, 0.84, 0.85, 0.86, 0.87];
var intBright2 = [0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.3,
	0.3, 0.31, 0.32, 0.33, 0.34, 0.36, 0.38, 0.4];
var intBright3 = [0.0, 0.01, 0.02, 0.03, 0.05, 0.06, 0.07, 0.08,
	0.1, 0.11, 0.12, 0.13, 0.14, 0.15, 0.16, 0.17];
var divisors = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512];
var scalers = [0, 2, 4, 8, 16, 32, 64, 128,
	0.00390625, 0.0078125, 0.15625, 0.3125,
	0.0625, 0.125, 0.25, 0.5];
var colors = [
	[255, 255, 255],
	[0, 255, 255],
	[255, 0, 255],
	[255, 0, 0],
	[255, 0, 0],
	[0, 255, 0],
	[0, 0, 255]
];

// Default (empty) program
program.push(new vecOp("LABS"));
program.push(new vecOp("VCTR", 0, 30));
program.push(new vecOp("JMPL", 0));

function vecOp(opcode, a1, a2, a3, a4) {
	this.opcode = opcode || "HALT";
	if (this.opcode == "VCTR") {
		this.x = parseInt(a1) || 0;
		this.y = parseInt(a2) || 0;
		this.divisor = parseInt(a3) || 1;
		this.intensity = parseInt(a4) || 0;
	} else if (this.opcode == "SVEC") {
		this.x = parseInt(a1) || 0;
		this.y = parseInt(a2) || 0;
		this.scale = parseInt(a3) || 0;
		this.intensity = parseInt(a4) || 0;
	} else if (this.opcode == "LABS") {
		this.x = parseInt(a1) || 0; // Coordinates will be absolute as sent by controller
		this.y = parseInt(a2) || 0;
		this.scale = parseInt(a3) || 1;
	} else if (this.opcode == "SCALE") {
		this.scale = parseInt(a1) || 0;
	} else if (this.opcode == "CENTER") {
		this.x = canvasElement.width / 2; // Center based on actual canvas
		this.y = canvasElement.height / 2;
	} else if (this.opcode == "COLOR") {
		this.color = parseInt(a1) || 0;
	} else if ((this.opcode == "JSRL") || (this.opcode == "JMPL")) {
		this.target = parseInt(a1);
	}
}

// --- PeerJS Integration ---
let peer;
let peerIdDisplay; // Will be assigned in initializePeer after DOM is ready

function initializePeer() {
  peerIdDisplay = document.getElementById('monitorPeerIdDisplay'); // Get the display element
  const requestedId = window.monitorPeerIdToUse || 'peerjs-nqijkptdzzrf-vector';
  console.log('Attempting to initialize PeerJS with ID:', requestedId);
  
  if (typeof Peer === "undefined") {
    console.error("PeerJS library is not loaded!");
    if (peerIdDisplay) {
        peerIdDisplay.textContent = 'Error: PeerJS library not found!';
    }
    return;
  }
  peer = new Peer(requestedId, { debug: 2 });

  peer.on('open', (id) => {
    console.log('PeerJS connection opened. My PeerJS ID is:', id);
    if (peerIdDisplay) {
      peerIdDisplay.textContent = 'Monitor PeerJS ID: ' + id;
    }
  });

  peer.on('error', (err) => {
    console.error('PeerJS error:', err);
    if (peerIdDisplay) {
      peerIdDisplay.textContent = 'PeerJS Error: ' + err.type;
    }
  });

  setupConnectionHandler();
}

function setupConnectionHandler() {
  if (!peer) {
    console.error("Peer object not initialized before calling setupConnectionHandler.");
    return;
  }
  peer.on('connection', (conn) => {
    console.log('Incoming PeerJS connection from:', conn.peer);

    conn.on('open', () => {
      console.log('Data connection opened with ' + conn.peer);
      conn.send('Hello from monitor! Connection established.');
    });

    conn.on('data', (data) => {
      console.log('Received data from ' + conn.peer + ':', data);
      
      const newOpsData = data; 

      if (Array.isArray(newOpsData)) {
        program = []; 
        let programText = ""; 

        newOpsData.forEach(opData => {
          let currentOpText = opData.opcode;
          let newOp;

          switch(opData.opcode) {
            case 'VCTR':
              newOp = new vecOp(opData.opcode, opData.x, opData.y, opData.divisor, opData.intensity);
              currentOpText += ` ${opData.x} ${opData.y} ${opData.divisor} ${opData.intensity}`;
              break;
            case 'SVEC':
              newOp = new vecOp(opData.opcode, opData.x, opData.y, opData.scale, opData.intensity);
              currentOpText += ` ${opData.x} ${opData.y} ${opData.scale} ${opData.intensity}`;
              break;
            case 'LABS':
              // Assuming opData.x and opData.y are absolute coordinates for the DVG display
              newOp = new vecOp(opData.opcode, opData.x, opData.y, opData.scale); // Uses direct values for constructor
              currentOpText += ` ${opData.x} ${opData.y} ${opData.scale}`; // Uses direct values for text display in editor
              break;
            case 'SCALE':
              newOp = new vecOp(opData.opcode, opData.scale);
              currentOpText += ` ${opData.scale}`;
              break;
            case 'COLOR':
              newOp = new vecOp(opData.opcode, opData.color);
              currentOpText += ` ${opData.color}`;
              break;
            case 'CENTER':
              newOp = new vecOp(opData.opcode);
              break;
            case 'JMPL':
            case 'JSRL':
              newOp = new vecOp(opData.opcode, opData.target);
              currentOpText += ` ${opData.target}`; // Target is an index, not a label string here
              break;
            case 'HALT':
            case 'RTSL':
              newOp = new vecOp(opData.opcode);
              break;
            default:
              console.warn('Unknown opcode received via PeerJS:', opData.opcode);
              return; 
          }
          if (newOp) {
            program.push(newOp);
          }
          programText += currentOpText + '\n';
        });

        const progEditor = document.getElementById('progEditor');
        if (progEditor) {
          progEditor.value = programText.trim();
        }

        pc = 0;
        HALT_FLAG = 0;
        lastIntensity = 8; // Reset lastIntensity for the new program
        if (canvasElement) {
            lastPoint.x = canvasElement.width / 2;
            lastPoint.y = canvasElement.height / 2;
            if (DVG) { 
                DVG.moveTo(lastPoint.x, lastPoint.y);
                DVG.beginPath();
            }
        }
        console.log("Program updated from PeerJS. New program length:", program.length);
      } else {
        console.warn('Received data via PeerJS is not an array:', newOpsData);
      }
    });

    conn.on('close', () => {
      console.log('Data connection closed with ' + conn.peer);
    });

    conn.on('error', (err) => {
      console.error('Data connection error with ' + conn.peer + ':', err);
    });
  });
}
// --- End PeerJS Integration ---

function mainLoop() {
    // Phosphor fade-out - CRITICAL: ensure source-over for decay
    DVG.globalCompositeOperation = "source-over"; 
	DVG.fillStyle = "rgba(0,0,0," + pDecay + ")";
	DVG.fillRect(0, 0, canvasElement.width, canvasElement.height);

	if (HALT_FLAG == 1) return;

	DVG.lineJoin = "round";
	DVG.lineCap = "round";
	DVG.beginPath();
	DVG.moveTo(lastPoint.x, lastPoint.y);

	for (let ops = 0; ops < maxOps; ops++) { // Declared ops with let
		if (pc >= program.length || pc < 0) { 
            HALT_FLAG = 1; 
            console.error("Program counter out of bounds. Halting. PC:", pc);
            break;
        }
        const thisOp = program[pc]; 
        if (!thisOp) { 
            HALT_FLAG = 1;
            console.error("Current operation is undefined. Halting. PC:", pc);
            break;
        }

		if (thisOp.opcode == "SCALE") { 
			SCALE_FACTOR = thisOp.scale;
		}
		else if (thisOp.opcode == "CENTER") { 
			DVG.moveTo(thisOp.x, thisOp.y);
			lastPoint.x = thisOp.x;
			lastPoint.y = thisOp.y;
		}
		else if (thisOp.opcode == "COLOR") { 
			glowStroke();  
			COLOR = thisOp.color;
			DVG.beginPath();  
			DVG.moveTo(lastPoint.x, lastPoint.y);
		}
		else if (thisOp.opcode == "LABS") { 
			DVG.moveTo(thisOp.x, thisOp.y);
			SCALE_FACTOR = thisOp.scale;
			lastPoint.x = thisOp.x;
			lastPoint.y = thisOp.y;
		}
		else if (thisOp.opcode == "VCTR") {
			var relX = parseInt(thisOp.x * scalers[SCALE_FACTOR] / divisors[thisOp.divisor]);
			var relY = parseInt(thisOp.y * scalers[SCALE_FACTOR] / divisors[thisOp.divisor]);
			if (thisOp.intensity != lastIntensity) {
				glowStroke();  
				lastIntensity = thisOp.intensity;
				DVG.beginPath();  
				DVG.moveTo(lastPoint.x, lastPoint.y);
			}
			lastPoint.x += relX; 
			lastPoint.y += relY; 
			DVG.lineTo(lastPoint.x, lastPoint.y);
		}
		else if (thisOp.opcode == "SVEC") {
			var relX = thisOp.x << (4 + thisOp.scale);
			var relY = thisOp.y << (4 + thisOp.scale);
			if (thisOp.intensity != lastIntensity) {
				glowStroke();
				lastIntensity = thisOp.intensity;
				DVG.beginPath();
				DVG.moveTo(lastPoint.x, lastPoint.y);
			}
			lastPoint.x += relX;
			lastPoint.y += relY;
			DVG.lineTo(lastPoint.x, lastPoint.y);
		} else if (thisOp.opcode == "JMPL") {
			if (typeof thisOp.target !== 'number' || thisOp.target < 0 || thisOp.target >= program.length) {
                console.error("Invalid JMPL target:", thisOp.target, "Program length:", program.length);
                HALT_FLAG = 1;
                break;
            }
			pc = thisOp.target;
			continue;
		} else if (thisOp.opcode == "JSRL") {
            if (typeof thisOp.target !== 'number' || thisOp.target < 0 || thisOp.target >= program.length) {
                console.error("Invalid JSRL target:", thisOp.target, "Program length:", program.length);
                HALT_FLAG = 1;
                break;
            }
			pc++;
			stack.push(pc);
			pc = thisOp.target;
			continue;
		} else if (thisOp.opcode == "RTSL") {
			if (stack.length > 0) {
                pc = stack.pop();
            } else {
                HALT_FLAG = 1; 
                console.error("Stack underflow on RTSL. Halting.");
                break; 
            }
			continue;
		} else if (thisOp.opcode == "HALT") {
			HALT_FLAG = 1;
			return;
		}
		pc++;
		if (pc >= program.length) { 
			HALT_FLAG = 1; 
			return;
		}
	}
	glowStroke();

	DVG.lineWidth = 5;
	DVG.strokeStyle = "rgba(128,0,128,0.5)";
	DVG.beginPath();
	if (tailsX.length > 1) {
		DVG.moveTo(tailsX, tailsY);
		while (tailsX.length > 1) {
			tailsX.pop();
			tailsY.pop();
			DVG.lineTo(tailsX, tailsY);
		}
	}
	glowStroke();
}

function glowStroke() {
	let color = colors[COLOR % colors.length].join(",");
	DVG.lineWidth = intWidths3[lastIntensity] + (Math.random() * 2);
	DVG.strokeStyle = "rgba(" + color + "," + intBright3[lastIntensity] + ")";
	DVG.stroke();
	DVG.lineWidth = intWidths2[lastIntensity] + Math.random();
	DVG.strokeStyle = "rgba(" + color + "," + intBright2[lastIntensity] + ")";
	DVG.stroke();
	DVG.lineWidth = intWidths1[lastIntensity];
	DVG.strokeStyle = "rgba(" + color + "," + intBright1[lastIntensity] + ")";
	DVG.stroke();
}

function parseProgram() {
	var editor = document.getElementById("progEditor");
	var code = editor.value;
	var newProg = new Array();
	var codeLines = code.split(/\n/);
	var codeLabels = new Object();
	var opNum = 0;
	var errs = 0;

    // First pass: Collect all labels and their corresponding opNum
	for (var lineNum in codeLines) {
		let currentLine = codeLines[lineNum].trim();
        if (currentLine.startsWith(";") || currentLine === "") continue; // Skip comments and empty lines

		var splitLine = currentLine.split(/\s+/);
		if (splitLine[0] == "LABEL") {
            if (splitLine.length > 1) {
			    codeLabels[splitLine[1]] = opNum; // Label points to the next actual instruction
            } else {
                console.warn("LABEL without a name at line:", lineNum);
            }
			continue; // Don't increment opNum for LABEL itself
		} else if ((splitLine[0] == "VCTR") ||
			(splitLine[0] == "LABS") ||
			(splitLine[0] == "HALT") ||
			(splitLine[0] == "JSRL") ||
			(splitLine[0] == "RTSL") ||
			(splitLine[0] == "JMPL") ||
			(splitLine[0] == "SVEC") ||
			(splitLine[0] == "SCALE") ||
			(splitLine[0] == "COLOR") ||
			(splitLine[0] == "CENTER")) {
			opNum++;
		}
	}
    console.log("Collected labels:", codeLabels);

	// Second pass: Generate vecOp objects
    opNum = 0; // Reset for indexing into newProg
	for (var lineNum in codeLines) {
		let currentLine = codeLines[lineNum].trim();
        if (currentLine.startsWith(";") || currentLine === "" || currentLine.startsWith("LABEL")) {
            continue; // Skip comments, empty lines, and label definitions in second pass
        }
		var splitLine = currentLine.split(/\s+/);
        let newOp;

		if (splitLine[0] == "VCTR") {
			newOp = new vecOp("VCTR", splitLine[1], splitLine[2], splitLine[3], splitLine[4]);
		} else if (splitLine[0] == "LABS") {
			// LABS coordinates from editor are relative to center (0,0).
            // Convert to absolute for DVG screen space.
			newOp = new vecOp("LABS",
				(canvasElement.width / 2) + parseInt(splitLine[1]), 
				(canvasElement.height / 2) + parseInt(splitLine[2]), 
				splitLine[3]);
		} else if (splitLine[0] == "HALT") {
			newOp = new vecOp("HALT");
		} else if (splitLine[0] == "JSRL") {
            if (codeLabels.hasOwnProperty(splitLine[1])) {
			    newOp = new vecOp("JSRL", codeLabels[splitLine[1]]);
            } else {
                console.error("Undefined label for JSRL:", splitLine[1]); errs++;
            }
		} else if (splitLine[0] == "RTSL") {
			newOp = new vecOp("RTSL");
		} else if (splitLine[0] == "JMPL") {
			if (codeLabels.hasOwnProperty(splitLine[1])) {
			    newOp = new vecOp("JMPL", codeLabels[splitLine[1]]);
            } else {
                console.error("Undefined label for JMPL:", splitLine[1]); errs++;
            }
		} else if (splitLine[0] == "SVEC") {
			newOp = new vecOp("SVEC", splitLine[1], splitLine[2], splitLine[3], splitLine[4]);
		} else if (splitLine[0] == "COLOR") {
			newOp = new vecOp("COLOR", splitLine[1]);
		} else if (splitLine[0] == "CENTER") {
			newOp = new vecOp("CENTER");
        } else if (splitLine[0] == "SCALE") {
            newOp = new vecOp("SCALE", splitLine[1]);
		} else {
            console.warn("Unknown opcode in editor:", splitLine[0]);
			continue;
		}
        if (newOp) {
		    newProg.push(newOp);
            opNum++;
        }
	}

	if (errs == 0) {
		program = newProg;
		pc = 0;
        HALT_FLAG = 0; 
        console.log("Program parsed from editor. New program length:", program.length, "Program:", program);
	} else {
        console.error("Errors encountered during parsing. Program not loaded.");
    }
}

function mouseHandle(evt) {
	tailsX.push(evt.clientX);
	tailsY.push(evt.clientY);
}

function keyHandle(evt) {
	if (evt.ctrlKey) {
		if (evt.which == 80) { 
			evt.preventDefault();
			if (HALT_FLAG == 0) {
				HALT_FLAG = 1;
			} else {
				HALT_FLAG = 0;
			}
		} else if (evt.which == 13) { 
			evt.preventDefault(); 
			parseProgram();
		} else if (evt.which == 190) { 
			maxOps++;
			vps.innerHTML = 5 * maxOps;
		} else if (evt.which == 188) {  
			maxOps--;
            if (maxOps < 1) maxOps = 1;
			vps.innerHTML = 5 * maxOps;
		} else if (evt.which == 219) { 
			pDecay -= 0.05;
            if (pDecay < 0) pDecay = 0; 
			decay.innerHTML = "-" + (Math.round(pDecay * 100)) + '%/frame'; // Simplified decay display
		} else if (evt.which == 221) { 
			pDecay += 0.05;
            if (pDecay > 1) pDecay = 1; 
			decay.innerHTML = "-" + (Math.round(pDecay * 100)) + '%/frame'; // Simplified decay display
		}
	}
}

window.addEventListener("mousemove", mouseHandle, true);
window.addEventListener("keydown", keyHandle, true);
window.addEventListener("load", () => {
    // Ensure canvasElement is available for width/height used in vecOp('CENTER') and parseProgram for LABS
    if (!canvasElement) { // Should not happen if script is at end of body or in load event
        canvasElement = document.getElementById("phosphor");
        DVG = canvasElement.getContext("2d");
    }
    if (canvasElement) { // Ensure canvas is set up before parsing
        canvasElement.width = window.innerWidth;
        canvasElement.height = window.innerHeight;
    }

    parseProgram(); // Parse initial program from editor on load
    initializePeer(); // Initialize PeerJS after DOM is ready and monitorPeerIdToUse is potentially set
});
setInterval(mainLoop, 20);
