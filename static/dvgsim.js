var canvasElement = document.getElementById("phosphor");
var DVG = canvasElement.getContext("2d");

canvasElement.width = window.innerWidth;
canvasElement.height = window.innerHeight;
tailsX = Array(0, 0, 0);
tailsY = Array(0, 0, 0);
bufferWidth = canvasElement.width * 4;
bufferDepth = bufferWidth * canvasElement.height;
var maxOps = 40; // Ensure maxOps is globally defined
var pDecay = 0.07;
lastPoint = new Object();
lastPoint.x = 0;
lastPoint.y = 0;
var vps = document.getElementById("vps"); // Ensure vps span is globally accessible if updated in conn.on('data')
var decay = document.getElementById("decay");

var pc = 0;                
var stack = new Array();   
var program = new Array(); 
var HALT_FLAG = 0;         
var SCALE_FACTOR = 0;      
var COLOR = 0;
var lastIntensity = 8;

var intWidths1 = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.7, 2];
var intWidths2 = [3, 3, 3, 3, 3, 3, 3, 3, 3, 3.1, 3.2, 3.3, 3.4, 3.6, 3.8, 4];
var intWidths3 = [6, 6, 6, 6, 6, 6, 6, 6, 6, 6.1, 6.3, 6.5, 6.8, 7.2, 7.6, 8];
var intBright1 = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.81, 0.82, 0.83, 0.84, 0.85, 0.86, 0.87];
var intBright2 = [0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.3, 0.3, 0.31, 0.32, 0.33, 0.34, 0.36, 0.38, 0.4];
var intBright3 = [0.0, 0.01, 0.02, 0.03, 0.05, 0.06, 0.07, 0.08, 0.1, 0.11, 0.12, 0.13, 0.14, 0.15, 0.16, 0.17];
var divisors = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512];
var scalers = [0, 2, 4, 8, 16, 32, 64, 128, 0.00390625, 0.0078125, 0.15625, 0.3125, 0.0625, 0.125, 0.25, 0.5];
var colors = [[255, 255, 255], [0, 255, 255], [255, 0, 255], [255, 0, 0], [255, 0, 0], [0, 255, 0], [0, 0, 255]];

program.push(new vecOp("LABS"));
program.push(new vecOp("VCTR", 0, 30));
program.push(new vecOp("JMPL", 0));

function vecOp(opcode, a1, a2, a3, a4) {
	this.opcode = opcode || "HALT";
	if (this.opcode == "VCTR") {
		this.x = parseInt(a1) || 0; this.y = parseInt(a2) || 0;
		this.divisor = parseInt(a3) || 1; this.intensity = parseInt(a4) || 0;
	} else if (this.opcode == "SVEC") {
		this.x = parseInt(a1) || 0; this.y = parseInt(a2) || 0;
		this.scale = parseInt(a3) || 0; this.intensity = parseInt(a4) || 0;
	} else if (this.opcode == "LABS") {
		this.x = parseInt(a1) || 0; this.y = parseInt(a2) || 0;
		this.scale = parseInt(a3) || 1;
	} else if (this.opcode == "SCALE") { this.scale = parseInt(a1) || 0;
	} else if (this.opcode == "CENTER") {
		this.x = canvasElement.width / 2; this.y = canvasElement.height / 2;
	} else if (this.opcode == "COLOR") { this.color = parseInt(a1) || 0;
	} else if ((this.opcode == "JSRL") || (this.opcode == "JMPL")) { this.target = parseInt(a1); }
}

let peer;
let peerIdDisplay; 

function initializePeer() {
  peerIdDisplay = document.getElementById('monitorPeerIdDisplay'); 
  const requestedId = window.monitorPeerIdToUse || 'peerjs-nqijkptdzzrf-vector';
  if (typeof Peer === "undefined") {
    if (peerIdDisplay) peerIdDisplay.textContent = 'Error: PeerJS library not found!';
    return;
  }
  peer = new Peer(requestedId, { debug: 2 });
  peer.on('open', id => { if (peerIdDisplay) peerIdDisplay.textContent = 'Monitor PeerJS ID: ' + id; });
  peer.on('error', err => { if (peerIdDisplay) peerIdDisplay.textContent = 'PeerJS Error: ' + err.type; });
  setupConnectionHandler();
}

function setupConnectionHandler() {
  if (!peer) return;
  peer.on('connection', (conn) => {
    conn.on('open', () => conn.send('Hello from monitor! Connection established.'));
    conn.on('data', (payload) => {
      console.log('Received payload from ' + conn.peer + ':', payload);
      if (!payload || typeof payload !== 'object') { 
        console.error('Invalid payload structure, expected an object.'); return; 
      }

      const receivedDvgText = payload.dvgProgramText;
      const receivedMetadata = payload.metadata || {};

      if (typeof receivedDvgText !== 'string') {
          console.error('Received DVG program text is not a string:', receivedDvgText);
          return; 
      }
      
      const progEditor = document.getElementById('progEditor');
      if (progEditor) {
          progEditor.value = receivedDvgText; 
      }

      parseProgram(); // This function reads from progEditor and updates global 'program'

      // Dynamic maxOps Calculation (after parseProgram)
      const MAX_POSSIBLE_MAX_OPS = 200; 
      const MIN_MAX_OPS = 1;            

      let maxOpsForProgram = MIN_MAX_OPS;
      if (program && program.length > 0) { // Use the global 'program' array
          maxOpsForProgram = Math.max(MIN_MAX_OPS, Math.round(program.length * 0.8));
      }
      
      let currentOverallMaxOpsSetting = MAX_POSSIBLE_MAX_OPS; 

      if (receivedMetadata.vps && typeof receivedMetadata.vps === 'number' && receivedMetadata.vps > 0) {
          // Assuming mainLoop runs roughly 50 times per second (setInterval(mainLoop, 20ms))
          const vpsFromMetadata = Math.max(MIN_MAX_OPS, Math.round(receivedMetadata.vps / 50));
          currentOverallMaxOpsSetting = Math.min(vpsFromMetadata, MAX_POSSIBLE_MAX_OPS);
      }

      maxOps = Math.max(MIN_MAX_OPS, Math.min(maxOpsForProgram, currentOverallMaxOpsSetting));
      
      console.log(`Adjusted maxOps to: ${maxOps} (Program length: ${program ? program.length : 0}, Metadata VPS: ${receivedMetadata.vps || 'N/A'})`);
      const vpsDisplaySpan = document.getElementById('vps'); // Re-fetch or ensure vps is global
      if (vpsDisplaySpan) {
          vpsDisplaySpan.innerHTML = maxOps * 50; 
      }

      // Reset Simulation State
      pc = 0;
      HALT_FLAG = 0;
      lastIntensity = 8; 
      if (canvasElement) {
          lastPoint.x = canvasElement.width / 2;
          lastPoint.y = canvasElement.height / 2;
          if (DVG) {
              DVG.moveTo(lastPoint.x, lastPoint.y);
              DVG.beginPath(); 
          }
      }
      console.log("Program updated and simulation reset. New program length:", program ? program.length : 0);
    });
    conn.on('close', () => console.log('Data connection closed with ' + conn.peer));
    conn.on('error', (err) => console.error('Data connection error with ' + conn.peer + ':', err));
  });
}

function mainLoop() {
    DVG.globalCompositeOperation = "source-over"; 
	DVG.fillStyle = "rgba(0,0,0," + pDecay + ")";
	DVG.fillRect(0, 0, canvasElement.width, canvasElement.height);
	if (HALT_FLAG == 1) return;

	DVG.lineJoin = "round"; DVG.lineCap = "round";
	DVG.beginPath(); DVG.moveTo(lastPoint.x, lastPoint.y);

	for (let opsCount = 0; opsCount < maxOps; opsCount++) { // Renamed loop var to avoid conflict
		if (pc >= program.length || pc < 0) { HALT_FLAG = 1; break; }
        const thisOp = program[pc]; 
        if (!thisOp) { HALT_FLAG = 1; break; }

		if (thisOp.opcode == "SCALE") { SCALE_FACTOR = thisOp.scale; }
		else if (thisOp.opcode == "CENTER") { 
			DVG.moveTo(thisOp.x, thisOp.y); lastPoint.x = thisOp.x; lastPoint.y = thisOp.y;
		}
		else if (thisOp.opcode == "COLOR") { 
			glowStroke(); COLOR = thisOp.color; DVG.beginPath(); DVG.moveTo(lastPoint.x, lastPoint.y);
		}
		else if (thisOp.opcode == "LABS") { 
			DVG.moveTo(thisOp.x, thisOp.y); SCALE_FACTOR = thisOp.scale;
			lastPoint.x = thisOp.x; lastPoint.y = thisOp.y;
		}
		else if (thisOp.opcode == "VCTR") {
			var relX = parseInt(thisOp.x * scalers[SCALE_FACTOR] / divisors[thisOp.divisor]);
			var relY = parseInt(thisOp.y * scalers[SCALE_FACTOR] / divisors[thisOp.divisor]);
			if (thisOp.intensity != lastIntensity) {
				glowStroke(); lastIntensity = thisOp.intensity;
				DVG.beginPath(); DVG.moveTo(lastPoint.x, lastPoint.y);
			}
			lastPoint.x += relX; lastPoint.y += relY; DVG.lineTo(lastPoint.x, lastPoint.y);
		}
		else if (thisOp.opcode == "SVEC") {
			var relX = thisOp.x << (4 + thisOp.scale); var relY = thisOp.y << (4 + thisOp.scale);
			if (thisOp.intensity != lastIntensity) {
				glowStroke(); lastIntensity = thisOp.intensity;
				DVG.beginPath(); DVG.moveTo(lastPoint.x, lastPoint.y);
			}
			lastPoint.x += relX; lastPoint.y += relY; DVG.lineTo(lastPoint.x, lastPoint.y);
		} else if (thisOp.opcode == "JMPL") {
			if (typeof thisOp.target!=='number' || thisOp.target<0 || thisOp.target>=program.length) { HALT_FLAG=1; break; }
			pc = thisOp.target; continue;
		} else if (thisOp.opcode == "JSRL") {
            if (typeof thisOp.target!=='number' || thisOp.target<0 || thisOp.target>=program.length) { HALT_FLAG=1; break; }
			pc++; stack.push(pc); pc = thisOp.target; continue;
		} else if (thisOp.opcode == "RTSL") {
			if (stack.length > 0) { pc = stack.pop(); } else { HALT_FLAG = 1; break; }
			continue;
		} else if (thisOp.opcode == "HALT") { HALT_FLAG = 1; return; }
		pc++;
		if (pc >= program.length) { HALT_FLAG = 1; return; }
	}
	glowStroke();

	DVG.lineWidth = 5; DVG.strokeStyle = "rgba(128,0,128,0.5)";
	DVG.beginPath();
	if (tailsX.length > 1) {
		DVG.moveTo(tailsX, tailsY);
		while (tailsX.length > 1) { tailsX.pop(); tailsY.pop(); DVG.lineTo(tailsX, tailsY); }
	}
	glowStroke();
}

function glowStroke() {
	let color = colors[COLOR % colors.length].join(",");
	DVG.lineWidth = intWidths3[lastIntensity] + (Math.random() * 2);
	DVG.strokeStyle = "rgba(" + color + "," + intBright3[lastIntensity] + ")"; DVG.stroke();
	DVG.lineWidth = intWidths2[lastIntensity] + Math.random();
	DVG.strokeStyle = "rgba(" + color + "," + intBright2[lastIntensity] + ")"; DVG.stroke();
	DVG.lineWidth = intWidths1[lastIntensity];
	DVG.strokeStyle = "rgba(" + color + "," + intBright1[lastIntensity] + ")"; DVG.stroke();
}

function parseProgram() {
	var editor = document.getElementById("progEditor");
	var code = editor.value; // Reads from editor
	var newProg = new Array();
	var codeLines = code.split(/\n/);
	var codeLabels = new Object();
	var opNum = 0; var errs = 0;

	for (var lineNum in codeLines) { // First pass for labels
		let currentLine = codeLines[lineNum].trim();
        if (currentLine.startsWith(";") || currentLine === "") continue;
		var splitLine = currentLine.split(/\s+/);
		if (splitLine[0].toUpperCase() == "LABEL") { // Ensure LABEL check is case-insensitive
            if (splitLine.length > 1) codeLabels[splitLine[1]] = opNum;
            else console.warn("LABEL without a name at line:", lineNum);
			continue;
		} else if (["VCTR", "LABS", "HALT", "JSRL", "RTSL", "JMPL", "SVEC", "SCALE", "COLOR", "CENTER"].includes(splitLine[0].toUpperCase())) {
			opNum++;
		}
	}
    // console.log("Collected labels by parseProgram:", codeLabels); // Optional: for debugging

	opNum = 0; 
	for (var lineNum in codeLines) { // Second pass for op generation
		let currentLine = codeLines[lineNum].trim();
        const upperCaseCommand = currentLine.split(/\s+/)[0].toUpperCase();
        if (currentLine.startsWith(";") || currentLine === "" || upperCaseCommand === "LABEL") continue;
        
		var splitLine = currentLine.split(/\s+/);
        let newOp;
        const command = splitLine[0].toUpperCase(); // Use uppercase for switch

		switch (command) {
			case "VCTR": newOp = new vecOp("VCTR", splitLine[1], splitLine[2], splitLine[3], splitLine[4]); break;
			case "LABS": newOp = new vecOp("LABS", (canvasElement.width / 2) + parseInt(splitLine[1]), (canvasElement.height / 2) + parseInt(splitLine[2]), splitLine[3]); break;
			case "HALT": newOp = new vecOp("HALT"); break;
			case "JSRL": 
                if (codeLabels.hasOwnProperty(splitLine[1])) newOp = new vecOp("JSRL", codeLabels[splitLine[1]]);
                else { console.error("Undefined label for JSRL:", splitLine[1]); errs++; }
                break;
			case "RTSL": newOp = new vecOp("RTSL"); break;
			case "JMPL": 
                if (codeLabels.hasOwnProperty(splitLine[1])) newOp = new vecOp("JMPL", codeLabels[splitLine[1]]);
                else { console.error("Undefined label for JMPL:", splitLine[1]); errs++; }
                break;
			case "SVEC": newOp = new vecOp("SVEC", splitLine[1], splitLine[2], splitLine[3], splitLine[4]); break;
			case "COLOR": newOp = new vecOp("COLOR", splitLine[1]); break;
			case "CENTER": newOp = new vecOp("CENTER"); break;
            case "SCALE": newOp = new vecOp("SCALE", splitLine[1]); break;
			default: console.warn("Unknown opcode in editor:", command); continue;
		}
        if (newOp) { newProg.push(newOp); opNum++; }
	}

	if (errs == 0) {
		program = newProg; // Assigns to global 'program'
		pc = 0; HALT_FLAG = 0; 
        console.log("Program parsed by parseProgram. New length:", program.length);
	} else {
        console.error("Errors encountered during parseProgram. Program not loaded.");
    }
    // Note: parseProgram does not re-write progEditor.value by default.
    // The received text remains, which is fine as it's what parseProgram just parsed.
}

function mouseHandle(evt) { tailsX.push(evt.clientX); tailsY.push(evt.clientY); }
function keyHandle(evt) {
	if (evt.ctrlKey) {
		if (evt.which == 80) { evt.preventDefault(); HALT_FLAG = HALT_FLAG == 0 ? 1 : 0; }
        else if (evt.which == 13) { evt.preventDefault(); parseProgram(); }
        else if (evt.which == 190) { maxOps++; if(vps) vps.innerHTML = maxOps * 50; } 
        else if (evt.which == 188) { maxOps--; if (maxOps < 1) maxOps = 1; if(vps) vps.innerHTML = maxOps * 50; }
        else if (evt.which == 219) { pDecay -= 0.05; if (pDecay < 0) pDecay = 0; if(decay) decay.innerHTML = "-" + (Math.round(pDecay * 100)) + '%/frame'; }
        else if (evt.which == 221) { pDecay += 0.05; if (pDecay > 1) pDecay = 1; if(decay) decay.innerHTML = "-" + (Math.round(pDecay * 100)) + '%/frame'; }
	}
}

window.addEventListener("mousemove", mouseHandle, true);
window.addEventListener("keydown", keyHandle, true);
window.addEventListener("load", () => {
    if (!canvasElement) { canvasElement = document.getElementById("phosphor"); DVG = canvasElement.getContext("2d"); }
    if (canvasElement) { canvasElement.width = window.innerWidth; canvasElement.height = window.innerHeight; }
    vps = document.getElementById("vps"); // Ensure vps is assigned after DOM load
    decay = document.getElementById("decay"); // Ensure decay is assigned after DOM load
    parseProgram(); 
    initializePeer(); 
});
setInterval(mainLoop, 20);
