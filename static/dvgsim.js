var canvasElement = document.getElementById("phosphor");
var DVG = canvasElement.getContext("2d");
var webGLCanvasElement = document.getElementById("webglCanvas");
var gl = null;

var useWebGLRenderer = false;
var webGLSupported = false;

// WebGL Shader Programs and Locations
var vectorShaderProgram = null;
var decayShaderProgram = null;
var vsPosLocation, vsColorLocation, vsResolutionLocation; // Vector Shader
var dsPosLocation, dsDecayAmountLocation; // Decay Shader

// WebGL Buffers
var lineVertexBuffer = null;
var decayQuadBuffer = null;


canvasElement.width = window.innerWidth;
canvasElement.height = window.innerHeight;
webGLCanvasElement.width = window.innerWidth;
webGLCanvasElement.height = window.innerHeight;

tailsX = Array(0, 0, 0);
tailsY = Array(0, 0, 0);
// bufferWidth = canvasElement.width * 4; // Not used directly in WebGL like this
// bufferDepth = bufferWidth * canvasElement.height; // Not used
var maxOps = 40;
var pDecay = 0.22; // Alpha for black overlay, meaning (1-pDecay) of previous frame remains
lastPoint = new Object();
lastPoint.x = 0;
lastPoint.y = 0;
var vps = document.getElementById("vps");
var decay = document.getElementById("decay");
var rendererTogglerButton = document.getElementById("rendererToggler");

var pc = 0;
var stack = new Array();
var program = new Array();
var HALT_FLAG = 0;
var SCALE_FACTOR = 0;
var COLOR = 0;
var lastIntensity = 8; // Default intensity index

var intWidths1 = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.7, 2];
var intWidths2 = [3, 3, 3, 3, 3, 3, 3, 3, 3, 3.1, 3.2, 3.3, 3.4, 3.6, 3.8, 4];
var intWidths3 = [6, 6, 6, 6, 6, 6, 6, 6, 6, 6.1, 6.3, 6.5, 6.8, 7.2, 7.6, 8];
var intBright1 = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.81, 0.82, 0.83, 0.84, 0.85, 0.86, 0.87];
var intBright2 = [0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.3, 0.3, 0.31, 0.32, 0.33, 0.34, 0.36, 0.38, 0.4];
var intBright3 = [0.0, 0.01, 0.02, 0.03, 0.05, 0.06, 0.07, 0.08, 0.1, 0.11, 0.12, 0.13, 0.14, 0.15, 0.16, 0.17];

var divisors = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512];
var scalers = [0, 2, 4, 8, 16, 32, 64, 128, 0.00390625, 0.0078125, 0.15625, 0.3125, 0.0625, 0.125, 0.25, 0.5];
var colors = [[255, 255, 255], [0, 255, 255], [255, 0, 255], [255, 255, 0], [255, 0, 0], [0, 255, 0], [0, 0, 255]];

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
	} else if (this.opcode == "SCALE") {
		this.scale = parseInt(a1) || 0;
	} else if (this.opcode == "CENTER") {
		// For WebGL, coordinates are relative to canvas size.
		// We'll handle centering in the drawing logic if needed, or shaders.
		// For now, this op might need reinterpretation for WebGL's coordinate system.
		// Let's assume it sets lastPoint to center.
		this.x = (useWebGLRenderer ? webGLCanvasElement.width : canvasElement.width) / 2;
		this.y = (useWebGLRenderer ? webGLCanvasElement.height : canvasElement.height) / 2;
	} else if (this.opcode == "COLOR") {
		this.color = parseInt(a1) || 0;
	} else if ((this.opcode == "JSRL") || (this.opcode == "JMPL")) { this.target = parseInt(a1); }
}

// --- WebGL Initialization and Utilities ---
async function loadShaderSource(url) {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to load shader: ${url}`);
	}
	return response.text();
}

function compileShader(glContext, type, source) {
	const shader = glContext.createShader(type);
	glContext.shaderSource(shader, source);
	glContext.compileShader(shader);
	if (!glContext.getShaderParameter(shader, glContext.COMPILE_STATUS)) {
		console.error('An error occurred compiling the shaders: ' + glContext.getShaderInfoLog(shader));
		glContext.deleteShader(shader);
		return null;
	}
	return shader;
}

async function initShaderProgram(glContext, vsUrl, fsUrl) {
	const vsSource = await loadShaderSource(vsUrl);
	const fsSource = await loadShaderSource(fsUrl);

	const vertexShader = compileShader(glContext, glContext.VERTEX_SHADER, vsSource);
	const fragmentShader = compileShader(glContext, glContext.FRAGMENT_SHADER, fsSource);

	if (!vertexShader || !fragmentShader) return null;

	const shaderProgram = glContext.createProgram();
	glContext.attachShader(shaderProgram, vertexShader);
	glContext.attachShader(shaderProgram, fragmentShader);
	glContext.linkProgram(shaderProgram);

	if (!glContext.getProgramParameter(shaderProgram, glContext.LINK_STATUS)) {
		console.error('Unable to initialize the shader program: ' + glContext.getProgramInfoLog(shaderProgram));
		return null;
	}
	return shaderProgram;
}

async function initWebGL() {
	gl = webGLCanvasElement.getContext("webgl");
	if (!gl) {
		console.error("WebGL not supported, falling back to 2D canvas.");
		return false;
	}

	vectorShaderProgram = await initShaderProgram(gl, 'vector_shader.vert', 'vector_shader.frag');
	decayShaderProgram = await initShaderProgram(gl, 'decay_shader.vert', 'decay_shader.frag');

	if (!vectorShaderProgram || !decayShaderProgram) {
		console.error("Failed to initialize shader programs.");
		return false;
	}

	// Vector Shader Locations
	vsPosLocation = gl.getAttribLocation(vectorShaderProgram, 'aVertexPosition');
	vsColorLocation = gl.getAttribLocation(vectorShaderProgram, 'aVertexColor');
	vsResolutionLocation = gl.getUniformLocation(vectorShaderProgram, 'uResolution');

	// Decay Shader Locations
	dsPosLocation = gl.getAttribLocation(decayShaderProgram, 'aPosition');
	dsDecayAmountLocation = gl.getUniformLocation(decayShaderProgram, 'uDecayAmount');

	// Buffers
	lineVertexBuffer = gl.createBuffer();
	const quadVertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
	decayQuadBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, decayQuadBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);

	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
	webGLSupported = true;
	useWebGLRenderer = true;
	updateRendererToggleButton();
	return true;
}

function updateRendererToggleButton() {
	if (rendererTogglerButton) {
		rendererTogglerButton.textContent = `Toggle Renderer (Current: ${useWebGLRenderer ? 'WebGL' : '2D'})`;
	}
	if (useWebGLRenderer && webGLSupported) {
		webGLCanvasElement.style.display = 'block';
		canvasElement.style.display = 'none';
	} else {
		webGLCanvasElement.style.display = 'none';
		canvasElement.style.display = 'block';
		useWebGLRenderer = false; // Fallback if WebGL init failed or toggled off
	}
}

function toggleRenderer() {
	if (webGLSupported) {
		useWebGLRenderer = !useWebGLRenderer;
	} else {
		useWebGLRenderer = false; // Stay on 2D if WebGL not supported
		alert("WebGL is not supported or failed to initialize. Sticking to 2D renderer.");
	}
	updateRendererToggleButton();
	// Reset simulation state for the new renderer
	pc = 0;
	HALT_FLAG = 0;
	lastIntensity = 8;
	const currentCanvas = useWebGLRenderer ? webGLCanvasElement : canvasElement;
	lastPoint.x = currentCanvas.width / 2;
	lastPoint.y = currentCanvas.height / 2;
	if (!useWebGLRenderer && DVG) {
		DVG.moveTo(lastPoint.x, lastPoint.y);
		DVG.beginPath();
	}
}


// --- PeerJS and DVG Program Logic (mostly unchanged, adapted for canvas size) ---
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
			const indicativeFrameRate = 50;
			console.log('Received payload from ' + conn.peer + ':', payload);

			if (typeof payload === 'string') {
				console.log('Received string message (e.g., handshake):', payload);
				return;
			}

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

			parseProgram();

			const MAX_POSSIBLE_MAX_OPS = 500;
			const MIN_MAX_OPS = 20;

			let maxOpsForProgram = MIN_MAX_OPS;
			if (program && program.length > 0) {
				maxOpsForProgram = Math.max(MIN_MAX_OPS, Math.round(program.length * 1.2));
			}

			let currentOverallMaxOpsSetting = MAX_POSSIBLE_MAX_OPS;

			if (receivedMetadata.vps && typeof receivedMetadata.vps === 'number' && receivedMetadata.vps > 0) {
				const vpsFromMetadata = Math.max(MIN_MAX_OPS, Math.round(receivedMetadata.vps / indicativeFrameRate));
				currentOverallMaxOpsSetting = Math.min(vpsFromMetadata, MAX_POSSIBLE_MAX_OPS);
			}

			maxOps = Math.max(MIN_MAX_OPS, Math.min(maxOpsForProgram, currentOverallMaxOpsSetting));

			console.log(`Adjusted maxOps to: ${maxOps} (Program length: ${program ? program.length : 0}, Metadata VPS: ${receivedMetadata.vps || 'N/A'})`);
			const vpsDisplaySpan = document.getElementById('vps');
			if (vpsDisplaySpan) {
				vpsDisplaySpan.innerHTML = maxOps * indicativeFrameRate;
			}

			pc = 0;
			HALT_FLAG = 0;
			lastIntensity = 8;
			const currentCanvas = useWebGLRenderer ? webGLCanvasElement : canvasElement;
			lastPoint.x = currentCanvas.width / 2;
			lastPoint.y = currentCanvas.height / 2;
			if (!useWebGLRenderer && DVG) {
				DVG.moveTo(lastPoint.x, lastPoint.y);
				DVG.beginPath();
			}
			console.log("Program updated and simulation reset. New program length:", program ? program.length : 0);
		});
		conn.on('close', () => console.log('Data connection closed with ' + conn.peer));
		conn.on('error', (err) => console.error('Data connection error with ' + conn.peer + ':', err));
	});
}

// --- Rendering Loops ---
function render2DFrame() {
	DVG.globalCompositeOperation = "source-over";
	DVG.fillStyle = "rgba(0,0,0," + pDecay + ")";
	DVG.fillRect(0, 0, canvasElement.width, canvasElement.height);
	if (HALT_FLAG == 1) return;

	DVG.lineJoin = "round"; DVG.lineCap = "round";
	DVG.beginPath(); DVG.moveTo(lastPoint.x, lastPoint.y);

	for (let opsCount = 0; opsCount < maxOps; opsCount++) {
		if (pc >= program.length || pc < 0) { HALT_FLAG = 1; break; }
		const thisOp = program[pc];
		if (!thisOp) { HALT_FLAG = 1; break; }

		if (thisOp.opcode == "SCALE") { SCALE_FACTOR = thisOp.scale; }
		else if (thisOp.opcode == "CENTER") {
			DVG.moveTo(thisOp.x, thisOp.y); lastPoint.x = thisOp.x; lastPoint.y = thisOp.y;
		}
		else if (thisOp.opcode == "COLOR") {
			glowStroke2D(); COLOR = thisOp.color; DVG.beginPath(); DVG.moveTo(lastPoint.x, lastPoint.y);
		}
		else if (thisOp.opcode == "LABS") {
			DVG.moveTo(thisOp.x, thisOp.y); SCALE_FACTOR = thisOp.scale;
			lastPoint.x = thisOp.x; lastPoint.y = thisOp.y;
		}
		else if (thisOp.opcode == "VCTR") {
			var relX = parseInt(thisOp.x * scalers[SCALE_FACTOR] / divisors[thisOp.divisor]);
			var relY = parseInt(thisOp.y * scalers[SCALE_FACTOR] / divisors[thisOp.divisor]);
			if (thisOp.intensity != lastIntensity) {
				glowStroke2D(); lastIntensity = thisOp.intensity;
				DVG.beginPath(); DVG.moveTo(lastPoint.x, lastPoint.y);
			}
			lastPoint.x += relX; lastPoint.y += relY; DVG.lineTo(lastPoint.x, lastPoint.y);
		}
		else if (thisOp.opcode == "SVEC") {
			var relX = thisOp.x << (4 + thisOp.scale); var relY = thisOp.y << (4 + this.scale);
			if (thisOp.intensity != lastIntensity) {
				glowStroke2D(); lastIntensity = thisOp.intensity;
				DVG.beginPath(); DVG.moveTo(lastPoint.x, lastPoint.y);
			}
			lastPoint.x += relX; lastPoint.y += relY; DVG.lineTo(lastPoint.x, lastPoint.y);
		} else if (thisOp.opcode == "JMPL") {
			if (typeof thisOp.target !== 'number' || thisOp.target < 0 || thisOp.target >= program.length) { HALT_FLAG = 1; break; }
			pc = thisOp.target; continue;
		} else if (thisOp.opcode == "JSRL") {
			if (typeof thisOp.target !== 'number' || thisOp.target < 0 || thisOp.target >= program.length) { HALT_FLAG = 1; break; }
			pc++; stack.push(pc); pc = thisOp.target; continue;
		} else if (thisOp.opcode == "RTSL") {
			if (stack.length > 0) { pc = stack.pop(); } else { HALT_FLAG = 1; break; }
			continue;
		} else if (thisOp.opcode == "HALT") { HALT_FLAG = 1; return; }
		pc++;
		if (pc >= program.length) { HALT_FLAG = 1; return; }
	}
	glowStroke2D();

	// Mouse trails (kept for 2D mode for now)
	DVG.lineWidth = 5; DVG.strokeStyle = "rgba(128,0,128,0.5)";
	DVG.beginPath();
	if (tailsX.length > 1) {
		DVG.moveTo(tailsX[0], tailsY[0]); // Corrected to use tailsX[0], tailsY[0]
		for(let i = 1; i < tailsX.length; i++) DVG.lineTo(tailsX[i], tailsY[i]);
		while (tailsX.length > 1) { tailsX.shift(); tailsY.shift(); } // Use shift for FIFO
	}
	glowStroke2D();
}

function glowStroke2D() {
	if (!DVG) return;
	let color = colors[COLOR % colors.length].join(",");
	DVG.lineWidth = intWidths3[lastIntensity] + (Math.random() * 2);
	DVG.strokeStyle = "rgba(" + color + "," + intBright3[lastIntensity] + ")"; DVG.stroke();
	DVG.lineWidth = intWidths2[lastIntensity] + Math.random();
	DVG.strokeStyle = "rgba(" + color + "," + intBright2[lastIntensity] + ")"; DVG.stroke();
	DVG.lineWidth = intWidths1[lastIntensity];
	DVG.strokeStyle = "rgba(" + color + "," + intBright1[lastIntensity] + ")"; DVG.stroke();
}


function renderWebGLFrame() {
	if (!gl || HALT_FLAG == 1) return;

	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

	// 1. Decay Pass (draw semi-transparent black quad)
	gl.useProgram(decayShaderProgram);
	gl.bindBuffer(gl.ARRAY_BUFFER, decayQuadBuffer);
	gl.vertexAttribPointer(dsPosLocation, 2, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(dsPosLocation);
	gl.uniform1f(dsDecayAmountLocation, pDecay);
	gl.enable(gl.BLEND);
	gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); // Standard alpha blending for decay
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

	// 2. Line Pass (additive blending for glow)
	gl.useProgram(vectorShaderProgram);
	gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // Additive blending for lines

	let vertices = [];
	let currentProgram = [...program]; // Operate on a copy for this frame if pc can change
	let currentPC = pc;
	let currentLastPoint = {...lastPoint};
	let currentSCALE_FACTOR = SCALE_FACTOR;
	let currentCOLOR = COLOR;
	let currentLastIntensity = lastIntensity;

	// Store original lastPoint to restore after simulation step for this frame
	const originalFrameLastPoint = {...lastPoint};
	const originalFramePC = pc;
	const originalFrameSCALE_FACTOR = SCALE_FACTOR;
	const originalFrameCOLOR = COLOR;
	const originalFrameLastIntensity = lastIntensity;


	const glowPasses = [
		{ brightArray: intBright3, widthArray: intWidths3 },
		{ brightArray: intBright2, widthArray: intWidths2 },
		{ brightArray: intBright1, widthArray: intWidths1 }
	];

	for (const pass of glowPasses) {
		vertices = [];
		// Reset simulation state for this pass's data generation
		pc = originalFramePC;
		lastPoint = {...originalFrameLastPoint};
		SCALE_FACTOR = originalFrameSCALE_FACTOR;
		COLOR = originalFrameCOLOR;
		lastIntensity = originalFrameLastIntensity;
		HALT_FLAG = 0; // Reset HALT_FLAG for simulation part
		let tempStack = [...stack]; // Use a temporary stack for simulation part

		for (let opsCount = 0; opsCount < maxOps; opsCount++) {
			if (pc >= program.length || pc < 0) { HALT_FLAG = 1; break; }
			const thisOp = program[pc];
			if (!thisOp) { HALT_FLAG = 1; break; }

			let opColor = colors[COLOR % colors.length];
			let opIntensity = pass.brightArray[lastIntensity];
			// let opLineWidth = pass.widthArray[lastIntensity]; // For gl.lineWidth if used per segment

			if (thisOp.opcode == "SCALE") { SCALE_FACTOR = thisOp.scale; }
			else if (thisOp.opcode == "CENTER") {
				lastPoint.x = thisOp.x; lastPoint.y = thisOp.y;
			}
			else if (thisOp.opcode == "COLOR") {
					COLOR = thisOp.color;
			}
			else if (thisOp.opcode == "LABS") {
				lastPoint.x = thisOp.x; lastPoint.y = thisOp.y;
				SCALE_FACTOR = thisOp.scale;
			}
			else if (thisOp.opcode == "VCTR") {
				var relX = parseInt(thisOp.x * scalers[SCALE_FACTOR] / divisors[thisOp.divisor]);
				var relY = parseInt(thisOp.y * scalers[SCALE_FACTOR] / divisors[thisOp.divisor]);
				
				if (thisOp.intensity != lastIntensity) {
					lastIntensity = thisOp.intensity;
				}
				opIntensity = pass.brightArray[lastIntensity]; // Update intensity for current segment

				let x0 = lastPoint.x;
				let y0 = lastPoint.y;
				lastPoint.x += relX;
				lastPoint.y += relY;
				let x1 = lastPoint.x;
				let y1 = lastPoint.y;

				vertices.push(x0, y0, opColor[0]/255, opColor[1]/255, opColor[2]/255, opIntensity);
				vertices.push(x1, y1, opColor[0]/255, opColor[1]/255, opColor[2]/255, opIntensity);
			}
			else if (thisOp.opcode == "SVEC") {
				var relX = thisOp.x << (4 + thisOp.scale);
				var relY = thisOp.y << (4 + thisOp.scale);
				if (thisOp.intensity != lastIntensity) {
					lastIntensity = thisOp.intensity;
				}
				opIntensity = pass.brightArray[lastIntensity];

				let x0 = lastPoint.x;
				let y0 = lastPoint.y;
				lastPoint.x += relX;
				lastPoint.y += relY;
				let x1 = lastPoint.x;
				let y1 = lastPoint.y;
				vertices.push(x0, y0, opColor[0]/255, opColor[1]/255, opColor[2]/255, opIntensity);
				vertices.push(x1, y1, opColor[0]/255, opColor[1]/255, opColor[2]/255, opIntensity);
			} else if (thisOp.opcode == "JMPL") {
				if (typeof thisOp.target !== 'number' || thisOp.target < 0 || thisOp.target >= program.length) { HALT_FLAG = 1; break; }
				pc = thisOp.target; continue;
			} else if (thisOp.opcode == "JSRL") {
				if (typeof thisOp.target !== 'number' || thisOp.target < 0 || thisOp.target >= program.length) { HALT_FLAG = 1; break; }
				pc++; tempStack.push(pc); pc = thisOp.target; continue;
			} else if (thisOp.opcode == "RTSL") {
				if (tempStack.length > 0) { pc = tempStack.pop(); } else { HALT_FLAG = 1; break; }
				continue;
			} else if (thisOp.opcode == "HALT") { HALT_FLAG = 1; break; } // Use break for inner loop
			pc++;
			if (pc >= program.length) { HALT_FLAG = 1; break; } // Use break for inner loop
		}
		
		if (vertices.length > 0) {
			gl.bindBuffer(gl.ARRAY_BUFFER, lineVertexBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
			gl.vertexAttribPointer(vsPosLocation, 2, gl.FLOAT, false, 6 * Float32Array.BYTES_PER_ELEMENT, 0);
			gl.enableVertexAttribArray(vsPosLocation);
			gl.vertexAttribPointer(vsColorLocation, 4, gl.FLOAT, false, 6 * Float32Array.BYTES_PER_ELEMENT, 2 * Float32Array.BYTES_PER_ELEMENT);
			gl.enableVertexAttribArray(vsColorLocation);
			gl.uniform2f(vsResolutionLocation, gl.canvas.width, gl.canvas.height);
			// gl.lineWidth(avgLineWidthForPass); // If using gl.lineWidth
			gl.drawArrays(gl.LINES, 0, vertices.length / 6);
		}
	}
	// Restore simulation state for the next actual frame update
	pc = originalFramePC;
	lastPoint = {...originalFrameLastPoint};
	SCALE_FACTOR = originalFrameSCALE_FACTOR;
	COLOR = originalFrameCOLOR;
	lastIntensity = originalFrameLastIntensity;
	HALT_FLAG = 0; // Reset for the main simulation logic that advances pc

	// Advance the main simulation pc, lastPoint etc. after generating all draw data for this frame
	// This is the part that was in the original 2D loop's opsCount < maxOps
	for (let opsCount = 0; opsCount < maxOps; opsCount++) {
		if (pc >= program.length || pc < 0) { HALT_FLAG = 1; break; }
		const thisOp = program[pc];
		if (!thisOp) { HALT_FLAG = 1; break; }

		if (thisOp.opcode == "SCALE") { SCALE_FACTOR = thisOp.scale; }
		else if (thisOp.opcode == "CENTER") { lastPoint.x = thisOp.x; lastPoint.y = thisOp.y; }
		else if (thisOp.opcode == "COLOR") { COLOR = thisOp.color; }
		else if (thisOp.opcode == "LABS") {
			lastPoint.x = thisOp.x; lastPoint.y = thisOp.y; SCALE_FACTOR = thisOp.scale;
		}
		else if (thisOp.opcode == "VCTR") {
			var relX = parseInt(thisOp.x * scalers[SCALE_FACTOR] / divisors[thisOp.divisor]);
			var relY = parseInt(thisOp.y * scalers[SCALE_FACTOR] / divisors[thisOp.divisor]);
			if (thisOp.intensity != lastIntensity) { lastIntensity = thisOp.intensity; }
			lastPoint.x += relX; lastPoint.y += relY;
		}
		else if (thisOp.opcode == "SVEC") {
			var relX = thisOp.x << (4 + thisOp.scale); var relY = thisOp.y << (4 + thisOp.scale);
			if (thisOp.intensity != lastIntensity) { lastIntensity = thisOp.intensity; }
			lastPoint.x += relX; lastPoint.y += relY;
		} else if (thisOp.opcode == "JMPL") {
			if (typeof thisOp.target !== 'number' || thisOp.target < 0 || thisOp.target >= program.length) { HALT_FLAG = 1; break; }
			pc = thisOp.target; continue;
		} else if (thisOp.opcode == "JSRL") {
			if (typeof thisOp.target !== 'number' || thisOp.target < 0 || thisOp.target >= program.length) { HALT_FLAG = 1; break; }
			pc++; stack.push(pc); pc = thisOp.target; continue;
		} else if (thisOp.opcode == "RTSL") {
			if (stack.length > 0) { pc = stack.pop(); } else { HALT_FLAG = 1; break; }
			continue;
		} else if (thisOp.opcode == "HALT") { HALT_FLAG = 1; return; } // Return if HALT
		pc++;
		if (pc >= program.length) { HALT_FLAG = 1; return; } // Return if end of program
	}
}


function mainLoop() {
	if (useWebGLRenderer && webGLSupported) {
		renderWebGLFrame();
	} else {
		render2DFrame();
	}
}

function parseProgram() {
	var editor = document.getElementById("progEditor");
	var code = editor.value;
	var newProg = new Array();
	var codeLines = code.split(/\n/);
	var codeLabels = new Object();
	var opNum = 0; var errs = 0;

	for (var lineNum in codeLines) {
		let currentLine = codeLines[lineNum].trim();
		if (currentLine.startsWith(";") || currentLine === "") continue;
		var splitLine = currentLine.split(/\s+/);
		if (splitLine[0].toUpperCase() == "LABEL") {
			if (splitLine.length > 1) codeLabels[splitLine[1]] = opNum;
			else console.warn("LABEL without a name at line:", lineNum);
			continue;
		} else if (["VCTR", "LABS", "HALT", "JSRL", "RTSL", "JMPL", "SVEC", "SCALE", "COLOR", "CENTER"].includes(splitLine[0].toUpperCase())) {
			opNum++;
		}
	}

	opNum = 0;
	for (var lineNum in codeLines) {
		let currentLine = codeLines[lineNum].trim();
		const upperCaseCommand = currentLine.split(/\s+/)[0].toUpperCase();
		if (currentLine.startsWith(";") || currentLine === "" || upperCaseCommand === "LABEL") continue;

		var splitLine = currentLine.split(/\s+/);
		let newOp;
		const command = splitLine[0].toUpperCase();
		const currentCanvas = useWebGLRenderer ? webGLCanvasElement : canvasElement;


		switch (command) {
			case "VCTR": newOp = new vecOp("VCTR", splitLine[1], splitLine[2], splitLine[3], splitLine[4]); break;
			case "LABS": newOp = new vecOp("LABS", (currentCanvas.width / 2) + parseInt(splitLine[1]), (currentCanvas.height / 2) + parseInt(splitLine[2]), splitLine[3]); break;
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
			case "CENTER": newOp = new vecOp("CENTER"); break; // vecOp constructor handles width/height
			case "SCALE": newOp = new vecOp("SCALE", splitLine[1]); break;
			default: console.warn("Unknown opcode in editor:", command); continue;
		}
		if (newOp) { newProg.push(newOp); opNum++; }
	}

	if (errs == 0) {
		program = newProg;
		pc = 0; HALT_FLAG = 0;
		console.log("Program parsed by parseProgram. New length:", program.length);
	} else {
		console.error("Errors encountered during parseProgram. Program not loaded.");
	}
}

function mouseHandle(evt) { tailsX.push(evt.clientX); tailsY.push(evt.clientY); }
function keyHandle(evt) {
	if (evt.ctrlKey) {
		if (evt.which == 80) { evt.preventDefault(); HALT_FLAG = HALT_FLAG == 0 ? 1 : 0; }
		else if (evt.which == 13) { evt.preventDefault(); parseProgram(); }
		else if (evt.which == 190) { maxOps++; if (vps) vps.innerHTML = maxOps * 50; }
		else if (evt.which == 188) { maxOps--; if (maxOps < 1) maxOps = 1; if (vps) vps.innerHTML = maxOps * 50; }
		else if (evt.which == 219) { pDecay -= 0.05; if (pDecay < 0) pDecay = 0; if (decay) decay.innerHTML = "-" + (Math.round(pDecay * 100)) + '%/frame'; }
		else if (evt.which == 221) { pDecay += 0.05; if (pDecay > 1) pDecay = 1; if (decay) decay.innerHTML = "-" + (Math.round(pDecay * 100)) + '%/frame'; }
	}
}

window.addEventListener("mousemove", mouseHandle, true);
window.addEventListener("keydown", keyHandle, true);

window.addEventListener("resize", () => {
	canvasElement.width = window.innerWidth;
	canvasElement.height = window.innerHeight;
	webGLCanvasElement.width = window.innerWidth;
	webGLCanvasElement.height = window.innerHeight;
	if (gl) {
		gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
	}
	// Reset lastPoint to center on resize
	const currentCanvas = useWebGLRenderer ? webGLCanvasElement : canvasElement;
	lastPoint.x = currentCanvas.width / 2;
	lastPoint.y = currentCanvas.height / 2;
});


window.addEventListener("load", async () => {
	canvasElement = document.getElementById("phosphor");
	DVG = canvasElement.getContext("2d");
	webGLCanvasElement = document.getElementById("webglCanvas");
	rendererTogglerButton = document.getElementById("rendererToggler");


	if (canvasElement) {
		canvasElement.width = window.innerWidth;
		canvasElement.height = window.innerHeight;
	}
		if (webGLCanvasElement) {
		webGLCanvasElement.width = window.innerWidth;
		webGLCanvasElement.height = window.innerHeight;
	}

	vps = document.getElementById("vps");
	decay = document.getElementById("decay");

	await initWebGL(); // Try to init WebGL
	updateRendererToggleButton(); // Set initial visibility based on success

	parseProgram();
	initializePeer();
	// Set initial lastPoint based on the active renderer
	const currentCanvas = useWebGLRenderer && webGLSupported ? webGLCanvasElement : canvasElement;
	lastPoint.x = currentCanvas.width / 2;
	lastPoint.y = currentCanvas.height / 2;

	setInterval(mainLoop, 20);
});