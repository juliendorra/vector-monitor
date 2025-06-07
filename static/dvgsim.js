var canvasElement = document.getElementById("phosphor");
var DVG = canvasElement.getContext("2d");
var webGLCanvasElement = document.getElementById("webglCanvas");
var gl = null;

var useWebGLRenderer = false;
var webGLSupported = false;

var globalLineTexInternalFormat = null; // To store determined format for lineTexture
var globalLineTexType = null;         // To store determined type for lineTexture

// --- BEGIN DIMENSION AND SCALING CONSTANTS ---
const PHYSICAL_CANVAS_WIDTH = 2048;
const PHYSICAL_CANVAS_HEIGHT = 2048;
// LOGICAL_DVG_WIDTH/HEIGHT represent the span of the DVG coordinate system, e.g., -512 to 511 is 1024 units.
const LOGICAL_DVG_WIDTH = 1024;
const LOGICAL_DVG_HEIGHT = 1024;
const DVG_COORDINATE_SCALE_X = PHYSICAL_CANVAS_WIDTH / LOGICAL_DVG_WIDTH; // Should be 2
const DVG_COORDINATE_SCALE_Y = PHYSICAL_CANVAS_HEIGHT / LOGICAL_DVG_HEIGHT; // Should be 2
const PHYSICAL_CENTER_X = PHYSICAL_CANVAS_WIDTH / 2; // Should be 1024
const PHYSICAL_CENTER_Y = PHYSICAL_CANVAS_HEIGHT / 2; // Should be 1024
// --- END DIMENSION AND SCALING CONSTANTS ---

// --- WebGL Helper Functions ---
function createTextureHelper(glContext, width, height, internalFormat, format, type) {
	const texture = glContext.createTexture();
	glContext.bindTexture(glContext.TEXTURE_2D, texture);
	glContext.texImage2D(glContext.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, null);
	glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_MIN_FILTER, glContext.LINEAR);
	glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_MAG_FILTER, glContext.LINEAR);
	glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_WRAP_S, glContext.CLAMP_TO_EDGE);
	glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_WRAP_T, glContext.CLAMP_TO_EDGE);
	return texture;
}

function createFBOHelper(glContext, texture) {
	const fbo = glContext.createFramebuffer();
	glContext.bindFramebuffer(glContext.FRAMEBUFFER, fbo);
	glContext.framebufferTexture2D(glContext.FRAMEBUFFER, glContext.COLOR_ATTACHMENT0, glContext.TEXTURE_2D, texture, 0);

	const status = glContext.checkFramebufferStatus(glContext.FRAMEBUFFER);
	if (status !== glContext.FRAMEBUFFER_COMPLETE) {
		console.error("Framebuffer incomplete: " + status.toString() + " (Texture associated: " + texture + ")");
		glContext.bindFramebuffer(glContext.FRAMEBUFFER, null); // Unbind before deleting
		glContext.deleteFramebuffer(fbo);
		return null;
	}
	glContext.bindFramebuffer(glContext.FRAMEBUFFER, null); // Unbind FBO
	return fbo;
}

function recreateWebGLResources(width, height) {
	if (!gl) {
		console.error("recreateWebGLResources called but gl context is null.");
		return false;
	}
	if (globalLineTexInternalFormat === null || globalLineTexType === null) {
		console.error("recreateWebGLResources called before line texture formats are determined.");
		return false;
	}

	// Delete old textures and FBOs if they exist
	if (lineTexture) gl.deleteTexture(lineTexture);
	if (lineFBO) gl.deleteFramebuffer(lineFBO);
	if (stateTextures[0]) gl.deleteTexture(stateTextures[0]);
	if (stateFBOs[0]) gl.deleteFramebuffer(stateFBOs[0]);
	if (stateTextures[1]) gl.deleteTexture(stateTextures[1]);
	if (stateFBOs[1]) gl.deleteFramebuffer(stateFBOs[1]);

	// Recreate line texture and FBO
	lineTexture = createTextureHelper(gl, width, height, globalLineTexInternalFormat, gl.RGBA, globalLineTexType);
	if (!lineTexture) { console.error("Failed to recreate lineTexture."); return false; }
	lineFBO = createFBOHelper(gl, lineTexture);
	if (!lineFBO) { console.error("Failed to recreate lineFBO."); return false; }

	// Recreate state textures and FBOs (using standard RGBA/UNSIGNED_BYTE)
	stateTextures[0] = createTextureHelper(gl, width, height, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE);
	if (!stateTextures[0]) { console.error("Failed to recreate stateTextures[0]."); return false; }
	stateFBOs[0] = createFBOHelper(gl, stateTextures[0]);
	if (!stateFBOs[0]) { console.error("Failed to recreate stateFBOs[0]."); return false; }

	stateTextures[1] = createTextureHelper(gl, width, height, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE);
	if (!stateTextures[1]) { console.error("Failed to recreate stateTextures[1]."); return false; }
	stateFBOs[1] = createFBOHelper(gl, stateTextures[1]);
	if (!stateFBOs[1]) { console.error("Failed to recreate stateFBOs[1]."); return false; }

	// Initialize one of the state textures to black
	gl.bindFramebuffer(gl.FRAMEBUFFER, stateFBOs[0]);
	gl.clearColor(0.0, 0.0, 0.0, 1.0);
	gl.clear(gl.COLOR_BUFFER_BIT);
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);

	currentStateIndex = 0; // Reset ping-pong state

	console.log(`WebGL resources recreated for ${width}x${height}.`);
	return true;
}

// WebGL Shader Programs and Locations
var vectorShaderProgram = null;
var combineDecayShaderProgram = null; // Renamed from decayShaderProgram
var compositeShaderProgram = null;

// Vector Shader (for quads)
var vsP0Location, vsP1Location, vsColorIntensityLocation, vsThicknessLocation, vsCornerOffsetLocation;
var vsStartTimeLocation, vsDrawDurationLocation; // New attributes for timing
var vsResolutionLocation, vsGlowMultiplierLocation, vsCurrentTimeLocation, vsIntraVectorDecayRateLocation, vsAntialiasPixelWidthLocation, vsQuadExpansionMarginLocation, vsEndpointDwellTimeLocation; // Uniforms

// CombineDecay Shader
var cdsPosLocation, cdsPreviousStateTexLocation, cdsCurrentLinesTexLocation, cdsGlobalDecayLocation, cdsDifferentialDecayRatesLocation;
// Composite Shader
var csPosLocation, csCompositeTextureLocation;

// WebGL Buffers
var lineVertexBuffer = null;
var fullscreenQuadBuffer = null; // Renamed from decayQuadBuffer

// WebGL FBOs and Textures for multi-pass rendering
var lineFBO = null, lineTexture = null;
var stateFBOs = [], stateTextures = [];
var currentStateIndex = 0; // Used to ping-pong between state textures

// WebGL specific settings
var webGLGlowMultiplier = 1.0;
var webGLGlowDisplay = null;
var webGLGlowMultiplierSlider = null; // Added for the slider element
var webGLLineWidthMultiplier = 1.0;
var webGLLineWidthDisplay = null;
var webGLLineWidthMultiplierSlider = null;
var maxGlLineWidthRange = [1, 1]; // Stores min/max supported line width

var webGLDifferentialDecayRates = { r: 0.5, g: 1.0, b: 2.5 };
var webGLRedDecayRateSlider = null, webGLGreenDecayRateSlider = null, webGLBlueDecayRateSlider = null;
var webGLRedDecayValueDisplay = null, webGLGreenDecayValueDisplay = null, webGLBlueDecayValueDisplay = null;

// New parameters for enhanced vector rendering
var webGLBeamSpeed = 1000.0; // pixels per second
var webGLIntraVectorDecayRate = 5.0; // decay rate for intra-vector fading
var webGLAntialiasPixelWidth = 1.5; // pixel width for SDF anti-aliasing
const QUAD_EXPANSION_MARGIN = 3.0; // pixels to expand quad for SDF rendering

var webGLBeamSpeedSlider = null, webGLBeamSpeedDisplay = null;
var webGLIntraVectorDecayRateSlider = null, webGLIntraVectorDecayRateDisplay = null;
var webGLAntialiasPixelWidthSlider = null, webGLAntialiasPixelWidthDisplay = null;
var webGLEndpointDwellTime = 0.03; // Default dwell time in seconds
var webGLEndpointDwellTimeSlider = null, webGLEndpointDwellTimeDisplay = null;

// Toolbox visibility control
var monitorControlsContainerElement = null;
var isToolboxPermanentlyHidden = false;


canvasElement.width = PHYSICAL_CANVAS_WIDTH;
canvasElement.height = PHYSICAL_CANVAS_HEIGHT;
webGLCanvasElement.width = PHYSICAL_CANVAS_WIDTH;
webGLCanvasElement.height = PHYSICAL_CANVAS_HEIGHT;

tailsX = Array(0, 0, 0);
tailsY = Array(0, 0, 0);
// bufferWidth = canvasElement.width * 4; // Not used directly in WebGL like this
// bufferDepth = bufferWidth * canvasElement.height; // Not used
var maxOps = 40;
var pDecay = 0.15; // Alpha for black overlay, meaning (1-pDecay) of previous frame remains. Lowered from 0.22.
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
		this.x = PHYSICAL_CENTER_X;
		this.y = PHYSICAL_CENTER_Y;
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
	gl = webGLCanvasElement.getContext("webgl", { preserveDrawingBuffer: false }); // preserveDrawingBuffer might be useful for debugging but generally false for performance
	if (!gl) {
		console.error("WebGL not supported, falling back to 2D canvas.");
		return false;
	}

	// Load shaders
	vectorShaderProgram = await initShaderProgram(gl, 'vector_shader.vert', 'vector_shader.frag');
	combineDecayShaderProgram = await initShaderProgram(gl, 'fullscreen_quad.vert', 'combine_decay_shader.frag'); // Uses new fullscreen_quad.vert
	compositeShaderProgram = await initShaderProgram(gl, 'composite_shader.vert', 'composite_shader.frag');

	if (!vectorShaderProgram || !combineDecayShaderProgram || !compositeShaderProgram) {
		console.error("Failed to initialize one or more shader programs.");
		return false;
	}

	// Vector Shader Locations (for quads)
	vsP0Location = gl.getAttribLocation(vectorShaderProgram, 'aP0');
	vsP1Location = gl.getAttribLocation(vectorShaderProgram, 'aP1');
	vsColorIntensityLocation = gl.getAttribLocation(vectorShaderProgram, 'aColorIntensity');
	vsThicknessLocation = gl.getAttribLocation(vectorShaderProgram, 'aThickness');
	vsCornerOffsetLocation = gl.getAttribLocation(vectorShaderProgram, 'aCornerOffset');
	vsStartTimeLocation = gl.getAttribLocation(vectorShaderProgram, 'aScheduledDrawTime'); // Renamed attribute
	vsDrawDurationLocation = gl.getAttribLocation(vectorShaderProgram, 'aDrawDuration');

	vsResolutionLocation = gl.getUniformLocation(vectorShaderProgram, 'uResolution');
	vsGlowMultiplierLocation = gl.getUniformLocation(vectorShaderProgram, 'uGlowMultiplier');
	vsCurrentTimeLocation = gl.getUniformLocation(vectorShaderProgram, 'uPassEvaluationTime'); // Renamed uniform
	vsIntraVectorDecayRateLocation = gl.getUniformLocation(vectorShaderProgram, 'uIntraVectorDecayRate');
	vsAntialiasPixelWidthLocation = gl.getUniformLocation(vectorShaderProgram, 'uAntialiasPixelWidth');
	vsQuadExpansionMarginLocation = gl.getUniformLocation(vectorShaderProgram, 'uQuadExpansionMargin');
	vsEndpointDwellTimeLocation = gl.getUniformLocation(vectorShaderProgram, 'uEndpointDwellTime');

	if (vsGlowMultiplierLocation === null || vsGlowMultiplierLocation === -1) {
		console.error("Failed to get uniform location for uGlowMultiplier.");
	}
	if (vsP0Location === -1 || vsP1Location === -1 || vsColorIntensityLocation === -1 || vsThicknessLocation === -1 || vsCornerOffsetLocation === -1 || vsStartTimeLocation === -1 || vsDrawDurationLocation === -1) {
		console.error("Failed to get one or more attribute locations for vectorShaderProgram (quads).");
	}
	if (vsResolutionLocation === -1 || vsCurrentTimeLocation === -1 || vsIntraVectorDecayRateLocation === -1 || vsAntialiasPixelWidthLocation === -1 || vsQuadExpansionMarginLocation === -1 || vsEndpointDwellTimeLocation === -1) {
		console.error("Failed to get one or more uniform locations for new vector shader parameters (including uEndpointDwellTime).");
	}


	// CombineDecay Shader Locations
	cdsPosLocation = gl.getAttribLocation(combineDecayShaderProgram, 'aPosition');
	cdsPreviousStateTexLocation = gl.getUniformLocation(combineDecayShaderProgram, 'uPreviousStateTex');
	cdsCurrentLinesTexLocation = gl.getUniformLocation(combineDecayShaderProgram, 'uCurrentLinesTex');
	cdsGlobalDecayLocation = gl.getUniformLocation(combineDecayShaderProgram, 'uGlobalDecay');
	cdsDifferentialDecayRatesLocation = gl.getUniformLocation(combineDecayShaderProgram, 'uDifferentialDecayRates');

	// Composite Shader Locations
	csPosLocation = gl.getAttribLocation(compositeShaderProgram, 'aPosition');
	csCompositeTextureLocation = gl.getUniformLocation(compositeShaderProgram, 'uCompositeTexture');

	// Buffers
	lineVertexBuffer = gl.createBuffer();
	const quadVertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]); // For a strip: -1,-1, 1,-1, -1,1, 1,1
	fullscreenQuadBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, fullscreenQuadBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);

	// Determine texture formats for lineTexture (once)
	globalLineTexInternalFormat = gl.RGBA; // Default
	globalLineTexType = gl.UNSIGNED_BYTE; // Default

	if (gl instanceof WebGL2RenderingContext) {
		const gl2 = gl;
		// Try to use RGBA16F, check if it's a renderable format
		const tempTex_WebGL2 = gl2.createTexture(); // Use a unique name for temp texture
		gl2.bindTexture(gl2.TEXTURE_2D, tempTex_WebGL2);
		try {
			gl2.texImage2D(gl2.TEXTURE_2D, 0, gl2.RGBA16F, 1, 1, 0, gl2.RGBA, gl2.FLOAT, null);
			const tempFBO_WebGL2 = gl2.createFramebuffer(); // Unique name for temp FBO
			gl2.bindFramebuffer(gl2.FRAMEBUFFER, tempFBO_WebGL2);
			gl2.framebufferTexture2D(gl2.FRAMEBUFFER, gl2.COLOR_ATTACHMENT0, gl2.TEXTURE_2D, tempTex_WebGL2, 0);
			if (gl2.checkFramebufferStatus(gl2.FRAMEBUFFER) === gl2.FRAMEBUFFER_COMPLETE) {
				globalLineTexInternalFormat = gl2.RGBA16F;
				globalLineTexType = gl2.FLOAT;
				console.log("Using WebGL2 float texture for lines (RGBA16F).");
			} else {
				console.log("WebGL2 context, but RGBA16F is not renderable as FBO attachment. Falling back.");
			}
			gl2.bindFramebuffer(gl2.FRAMEBUFFER, null);
			gl2.deleteFramebuffer(tempFBO_WebGL2);
		} catch (e) {
			console.log("WebGL2 context, but texImage2D with RGBA16F/FLOAT failed. Falling back.", e);
		}
		gl2.deleteTexture(tempTex_WebGL2);
	}

	if (globalLineTexType !== gl.FLOAT) { // If not set to FLOAT by WebGL2 logic, try WebGL1 float extensions
		const floatTextureExt = gl.getExtension('OES_texture_float');
		const floatTextureLinearExt = gl.getExtension('OES_texture_float_linear');
		if (floatTextureExt && floatTextureLinearExt) {
			globalLineTexInternalFormat = gl.RGBA;
			globalLineTexType = gl.FLOAT;
			console.log("Using WebGL1 OES_texture_float (with linear filtering) for lines.");
		} else {
			console.log("Float textures (with linear filtering) not supported for lines, using UNSIGNED_BYTE.");
			// Defaults (gl.RGBA, gl.UNSIGNED_BYTE) are already set for globalLineTexInternalFormat/Type
		}
	}

	// Framebuffers and Textures will be created by recreateWebGLResources
	const canvasWidth = gl.canvas.width;
	const canvasHeight = gl.canvas.height;
	if (!recreateWebGLResources(canvasWidth, canvasHeight)) {
		console.error("Failed to create initial WebGL resources.");
		// Potentially set webGLSupported to false or handle error more gracefully
		webGLSupported = false;
		useWebGLRenderer = false;
		updateRendererToggleButton();
		return false;
	}

	maxGlLineWidthRange = gl.getParameter(gl.ALIASED_LINE_WIDTH_RANGE);
	console.log("Supported line width range: ", maxGlLineWidthRange[0], "to", maxGlLineWidthRange[1]);

	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
	webGLSupported = true;
	useWebGLRenderer = true; // Default to WebGL if supported
	updateRendererToggleButton();
	return true;
}

function updateRendererToggleButton() {
	if (rendererTogglerButton) {
		rendererTogglerButton.textContent = `Toggle Renderer (Current: ${useWebGLRenderer ? 'WebGL' : '2D'})`;
	}

	var webGLSettingsElement = document.getElementById("webglSettings");

	if (useWebGLRenderer && webGLSupported) {
		webGLCanvasElement.style.display = 'block';
		canvasElement.style.display = 'none';
		if (webGLSettingsElement) webGLSettingsElement.style.display = 'block';
		if (webGLGlowDisplay) webGLGlowDisplay.innerHTML = webGLGlowMultiplier.toFixed(2);
		if (webGLGlowMultiplierSlider) webGLGlowMultiplierSlider.value = webGLGlowMultiplier.toFixed(2);
		if (webGLLineWidthDisplay) webGLLineWidthDisplay.innerHTML = webGLLineWidthMultiplier.toFixed(2);
		if (webGLLineWidthMultiplierSlider) webGLLineWidthMultiplierSlider.value = webGLLineWidthMultiplier.toFixed(2);

		// Update new UI elements
		if (webGLBeamSpeedDisplay) webGLBeamSpeedDisplay.textContent = webGLBeamSpeed.toFixed(0);
		if (webGLBeamSpeedSlider) webGLBeamSpeedSlider.value = webGLBeamSpeed.toFixed(0);
		if (webGLIntraVectorDecayRateDisplay) webGLIntraVectorDecayRateDisplay.textContent = webGLIntraVectorDecayRate.toFixed(2);
		if (webGLIntraVectorDecayRateSlider) webGLIntraVectorDecayRateSlider.value = webGLIntraVectorDecayRate.toFixed(2);
		if (webGLAntialiasPixelWidthDisplay) webGLAntialiasPixelWidthDisplay.textContent = webGLAntialiasPixelWidth.toFixed(2);
		if (webGLAntialiasPixelWidthSlider) webGLAntialiasPixelWidthSlider.value = webGLAntialiasPixelWidth.toFixed(2);
		if (webGLEndpointDwellTimeDisplay) webGLEndpointDwellTimeDisplay.textContent = webGLEndpointDwellTime.toFixed(3);
		if (webGLEndpointDwellTimeSlider) webGLEndpointDwellTimeSlider.value = webGLEndpointDwellTime.toFixed(3);


	} else {
		webGLCanvasElement.style.display = 'none';
		canvasElement.style.display = 'block';
		if (webGLSettingsElement) webGLSettingsElement.style.display = 'none';
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
	lastPoint.x = PHYSICAL_CENTER_X;
	lastPoint.y = PHYSICAL_CENTER_Y;
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

			// Handle toolbox visibility metadata first
			if (receivedMetadata && receivedMetadata.hasOwnProperty('hideMonitorToolboxPermanently')) {
				isToolboxPermanentlyHidden = !!receivedMetadata.hideMonitorToolboxPermanently;
			} else {
				isToolboxPermanentlyHidden = false; // Default if not specified
			}

			if (monitorControlsContainerElement) {
				if (isToolboxPermanentlyHidden) {
					monitorControlsContainerElement.style.display = 'none';
				} else {
					// If not permanently hidden, it should be hidden by default,
					// and then shown by hover/click.
					monitorControlsContainerElement.style.display = 'none';
				}
			}

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

			// Process WebGL shader parameters from metadata
			if (useWebGLRenderer && webGLSupported) {
				if (receivedMetadata.hasOwnProperty('webGLGlowMultiplier') && typeof receivedMetadata.webGLGlowMultiplier === 'number') {
					webGLGlowMultiplier = Math.max(0.0, Math.min(5.0, receivedMetadata.webGLGlowMultiplier));
					if (webGLGlowMultiplierSlider) webGLGlowMultiplierSlider.value = webGLGlowMultiplier.toFixed(2);
					if (webGLGlowDisplay) webGLGlowDisplay.textContent = webGLGlowMultiplier.toFixed(2);
				}
				if (receivedMetadata.hasOwnProperty('webGLLineWidthMultiplier') && typeof receivedMetadata.webGLLineWidthMultiplier === 'number') {
					webGLLineWidthMultiplier = Math.max(0.1, Math.min(10.0, receivedMetadata.webGLLineWidthMultiplier));
					if (webGLLineWidthMultiplierSlider) webGLLineWidthMultiplierSlider.value = webGLLineWidthMultiplier.toFixed(2);
					if (webGLLineWidthDisplay) webGLLineWidthDisplay.textContent = webGLLineWidthMultiplier.toFixed(2);
				}
				if (receivedMetadata.hasOwnProperty('webGLDifferentialDecayRates') && typeof receivedMetadata.webGLDifferentialDecayRates === 'object') {
					const rates = receivedMetadata.webGLDifferentialDecayRates;
					if (rates.hasOwnProperty('r') && typeof rates.r === 'number') {
						webGLDifferentialDecayRates.r = Math.max(0.1, Math.min(5.0, rates.r));
					}
					if (rates.hasOwnProperty('g') && typeof rates.g === 'number') {
						webGLDifferentialDecayRates.g = Math.max(0.1, Math.min(5.0, rates.g));
					}
					if (rates.hasOwnProperty('b') && typeof rates.b === 'number') {
						webGLDifferentialDecayRates.b = Math.max(0.1, Math.min(5.0, rates.b));
					}
					updateDifferentialDecayUI();
				}
				if (receivedMetadata.hasOwnProperty('webGLBeamSpeed') && typeof receivedMetadata.webGLBeamSpeed === 'number') {
					webGLBeamSpeed = Math.max(100, Math.min(10000, receivedMetadata.webGLBeamSpeed));
					if (webGLBeamSpeedSlider) webGLBeamSpeedSlider.value = webGLBeamSpeed.toFixed(0);
					if (webGLBeamSpeedDisplay) webGLBeamSpeedDisplay.textContent = webGLBeamSpeed.toFixed(0);
				}
				if (receivedMetadata.hasOwnProperty('webGLIntraVectorDecayRate') && typeof receivedMetadata.webGLIntraVectorDecayRate === 'number') {
					webGLIntraVectorDecayRate = Math.max(0.0, Math.min(50.0, receivedMetadata.webGLIntraVectorDecayRate));
					if (webGLIntraVectorDecayRateSlider) webGLIntraVectorDecayRateSlider.value = webGLIntraVectorDecayRate.toFixed(2);
					if (webGLIntraVectorDecayRateDisplay) webGLIntraVectorDecayRateDisplay.textContent = webGLIntraVectorDecayRate.toFixed(2);
				}
				if (receivedMetadata.hasOwnProperty('webGLAntialiasPixelWidth') && typeof receivedMetadata.webGLAntialiasPixelWidth === 'number') {
					webGLAntialiasPixelWidth = Math.max(0.1, Math.min(5.0, receivedMetadata.webGLAntialiasPixelWidth));
					if (webGLAntialiasPixelWidthSlider) webGLAntialiasPixelWidthSlider.value = webGLAntialiasPixelWidth.toFixed(2);
					if (webGLAntialiasPixelWidthDisplay) webGLAntialiasPixelWidthDisplay.textContent = webGLAntialiasPixelWidth.toFixed(2);
				}
				if (receivedMetadata.hasOwnProperty('webGLEndpointDwellTime') && typeof receivedMetadata.webGLEndpointDwellTime === 'number') {
					webGLEndpointDwellTime = Math.max(0.0, Math.min(0.5, receivedMetadata.webGLEndpointDwellTime)); // Max 0.5s dwell
					if (webGLEndpointDwellTimeSlider) webGLEndpointDwellTimeSlider.value = webGLEndpointDwellTime.toFixed(3);
					if (webGLEndpointDwellTimeDisplay) webGLEndpointDwellTimeDisplay.textContent = webGLEndpointDwellTime.toFixed(3);
				}
			}

			pc = 0;
			HALT_FLAG = 0;
			lastIntensity = 8;
			lastPoint.x = PHYSICAL_CENTER_X;
			lastPoint.y = PHYSICAL_CENTER_Y;
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
			var relX = parseInt(thisOp.x * scalers[SCALE_FACTOR] / divisors[thisOp.divisor]) * DVG_COORDINATE_SCALE_X;
			var relY = parseInt(thisOp.y * scalers[SCALE_FACTOR] / divisors[thisOp.divisor]) * DVG_COORDINATE_SCALE_Y;
			if (thisOp.intensity != lastIntensity) {
				glowStroke2D(); lastIntensity = thisOp.intensity;
				DVG.beginPath(); DVG.moveTo(lastPoint.x, lastPoint.y);
			}
			lastPoint.x += relX; lastPoint.y += relY; DVG.lineTo(lastPoint.x, lastPoint.y);
		}
		else if (thisOp.opcode == "SVEC") {
			var relX = (thisOp.x << (4 + thisOp.scale)) * DVG_COORDINATE_SCALE_X;
			var relY = (thisOp.y << (4 + thisOp.scale)) * DVG_COORDINATE_SCALE_Y;
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
		for (let i = 1; i < tailsX.length; i++) DVG.lineTo(tailsX[i], tailsY[i]);
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
	if (!gl || !webGLSupported) return; // HALT_FLAG check is inside the simulation part now

	const sourceStateIndex = currentStateIndex;
	const targetStateIndex = (currentStateIndex + 1) % 2;

	// --- 1. Line Drawing Pass (to lineFBO / lineTexture) ---
	gl.bindFramebuffer(gl.FRAMEBUFFER, lineFBO);
	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
	gl.clearColor(0.0, 0.0, 0.0, 0.0); // Clear to transparent black
	gl.clear(gl.COLOR_BUFFER_BIT);

	gl.useProgram(vectorShaderProgram);
	gl.enable(gl.BLEND);
	gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // Additive blending for lines
	// Note: gl.lineWidth(1.0) is the default. We'll set it per pass.

	let vertices = [];
	// let currentProgram = [...program]; // Operate on a copy for this frame if pc can change
	let currentPC = pc;
	let currentLastPoint = { ...lastPoint };
	let currentSCALE_FACTOR = SCALE_FACTOR;
	let currentCOLOR = COLOR;
	let currentLastIntensity = lastIntensity;

	// Store original lastPoint to restore after simulation step for this frame
	const originalFrameLastPoint = { ...lastPoint };
	const originalFramePC = pc;
	const originalFrameSCALE_FACTOR = SCALE_FACTOR;
	const originalFrameCOLOR = COLOR;
	const originalFrameLastIntensity = lastIntensity; // Save this for consistent state reset

	const frameStartTime = performance.now() / 1000.0; // Time at the start of this frame's rendering logic

	const glowPasses = [
		{ brightArray: intBright3, widthArray: intWidths3 },
		{ brightArray: intBright2, widthArray: intWidths2 },
		{ brightArray: intBright1, widthArray: intWidths1 }
	];

	for (const pass of glowPasses) {
		vertices = [];
		let accumulatedDurationWithinPass = 0.0; // Seconds, reset for each pass's vertex generation
		// Reset simulation state for this pass's data generation
		pc = originalFramePC;
		lastPoint = { ...originalFrameLastPoint };
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
				var relX = parseInt(thisOp.x * scalers[SCALE_FACTOR] / divisors[thisOp.divisor]) * DVG_COORDINATE_SCALE_X;
				var relY = parseInt(thisOp.y * scalers[SCALE_FACTOR] / divisors[thisOp.divisor]) * DVG_COORDINATE_SCALE_Y;

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

				let currentThickness = pass.widthArray[lastIntensity] * webGLLineWidthMultiplier;
				// Ensure minimum thickness for visibility, especially for zero-intensity lines if they are to be subtly visible
				currentThickness = Math.max(0.5, currentThickness); // Minimum 0.5 pixel thickness

				// Triangle 1: (P0, sideA), (P1, sideA), (P0, sideB)
				const vectorLengthPixelsVCTR = Math.sqrt(relX * relX + relY * relY);
				const vectorDrawDuration = (webGLBeamSpeed > 0.001) ? (vectorLengthPixelsVCTR / webGLBeamSpeed) : 0.0;
				// vectorOffsetInPass is `accumulatedDurationWithinPass` *before* this vector's duration is added
				const vectorScheduledDrawTime = frameStartTime + accumulatedDurationWithinPass;

				vertices.push(x0, y0, x1, y1, opColor[0] / 255, opColor[1] / 255, opColor[2] / 255, opIntensity, currentThickness, -1.0, -1.0, vectorScheduledDrawTime, vectorDrawDuration);
				vertices.push(x0, y0, x1, y1, opColor[0] / 255, opColor[1] / 255, opColor[2] / 255, opIntensity, currentThickness, 1.0, -1.0, vectorScheduledDrawTime, vectorDrawDuration);
				vertices.push(x0, y0, x1, y1, opColor[0] / 255, opColor[1] / 255, opColor[2] / 255, opIntensity, currentThickness, -1.0, 1.0, vectorScheduledDrawTime, vectorDrawDuration);
				// Triangle 2: (P1, sideA), (P1, sideB), (P0, sideB)
				vertices.push(x0, y0, x1, y1, opColor[0] / 255, opColor[1] / 255, opColor[2] / 255, opIntensity, currentThickness, 1.0, -1.0, vectorScheduledDrawTime, vectorDrawDuration);
				vertices.push(x0, y0, x1, y1, opColor[0] / 255, opColor[1] / 255, opColor[2] / 255, opIntensity, currentThickness, 1.0, 1.0, vectorScheduledDrawTime, vectorDrawDuration);
				vertices.push(x0, y0, x1, y1, opColor[0] / 255, opColor[1] / 255, opColor[2] / 255, opIntensity, currentThickness, -1.0, 1.0, vectorScheduledDrawTime, vectorDrawDuration);
				accumulatedDurationWithinPass += vectorDrawDuration;
			}
			else if (thisOp.opcode == "SVEC") {
				var relX = (thisOp.x << (4 + thisOp.scale)) * DVG_COORDINATE_SCALE_X;
				var relY = (thisOp.y << (4 + thisOp.scale)) * DVG_COORDINATE_SCALE_Y;
				if (thisOp.intensity != lastIntensity) {
					lastIntensity = thisOp.intensity;
				}
				opIntensity = pass.brightArray[lastIntensity];
				let currentThickness = pass.widthArray[lastIntensity] * webGLLineWidthMultiplier;
				currentThickness = Math.max(0.5, currentThickness);

				let x0 = lastPoint.x;
				let y0 = lastPoint.y;
				lastPoint.x += relX;
				lastPoint.y += relY;
				let x1 = lastPoint.x;
				let y1 = lastPoint.y;

				const vectorLengthPixelsSVEC = Math.sqrt(relX * relX + relY * relY);
				const vectorDrawDuration = (webGLBeamSpeed > 0.001) ? (vectorLengthPixelsSVEC / webGLBeamSpeed) : 0.0;
				const vectorScheduledDrawTime = frameStartTime + accumulatedDurationWithinPass;

				vertices.push(x0, y0, x1, y1, opColor[0] / 255, opColor[1] / 255, opColor[2] / 255, opIntensity, currentThickness, -1.0, -1.0, vectorScheduledDrawTime, vectorDrawDuration);
				vertices.push(x0, y0, x1, y1, opColor[0] / 255, opColor[1] / 255, opColor[2] / 255, opIntensity, currentThickness, 1.0, -1.0, vectorScheduledDrawTime, vectorDrawDuration);
				vertices.push(x0, y0, x1, y1, opColor[0] / 255, opColor[1] / 255, opColor[2] / 255, opIntensity, currentThickness, -1.0, 1.0, vectorScheduledDrawTime, vectorDrawDuration);
				// Triangle 2
				vertices.push(x0, y0, x1, y1, opColor[0] / 255, opColor[1] / 255, opColor[2] / 255, opIntensity, currentThickness, 1.0, -1.0, vectorScheduledDrawTime, vectorDrawDuration);
				vertices.push(x0, y0, x1, y1, opColor[0] / 255, opColor[1] / 255, opColor[2] / 255, opIntensity, currentThickness, 1.0, 1.0, vectorScheduledDrawTime, vectorDrawDuration);
				vertices.push(x0, y0, x1, y1, opColor[0] / 255, opColor[1] / 255, opColor[2] / 255, opIntensity, currentThickness, -1.0, 1.0, vectorScheduledDrawTime, vectorDrawDuration);
				accumulatedDurationWithinPass += vectorDrawDuration;
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

			const stride = 13 * Float32Array.BYTES_PER_ELEMENT; // p0(2), p1(2), colorIntensity(4), thickness(1), corner(2), startTime(1), drawDuration(1) = 13 floats
			// aP0
			gl.vertexAttribPointer(vsP0Location, 2, gl.FLOAT, false, stride, 0);
			gl.enableVertexAttribArray(vsP0Location);
			// aP1
			gl.vertexAttribPointer(vsP1Location, 2, gl.FLOAT, false, stride, 2 * Float32Array.BYTES_PER_ELEMENT);
			gl.enableVertexAttribArray(vsP1Location);
			// aColorIntensity
			gl.vertexAttribPointer(vsColorIntensityLocation, 4, gl.FLOAT, false, stride, 4 * Float32Array.BYTES_PER_ELEMENT);
			gl.enableVertexAttribArray(vsColorIntensityLocation);
			// aThickness
			gl.vertexAttribPointer(vsThicknessLocation, 1, gl.FLOAT, false, stride, 8 * Float32Array.BYTES_PER_ELEMENT);
			gl.enableVertexAttribArray(vsThicknessLocation);
			// aCornerOffset
			gl.vertexAttribPointer(vsCornerOffsetLocation, 2, gl.FLOAT, false, stride, 9 * Float32Array.BYTES_PER_ELEMENT);
			gl.enableVertexAttribArray(vsCornerOffsetLocation);
			// aStartTime
			gl.vertexAttribPointer(vsStartTimeLocation, 1, gl.FLOAT, false, stride, 11 * Float32Array.BYTES_PER_ELEMENT);
			gl.enableVertexAttribArray(vsStartTimeLocation);
			// aDrawDuration
			gl.vertexAttribPointer(vsDrawDurationLocation, 1, gl.FLOAT, false, stride, 12 * Float32Array.BYTES_PER_ELEMENT);
			gl.enableVertexAttribArray(vsDrawDurationLocation);

			// Set uniforms for the vector shader
			// accumulatedDurationWithinPass now holds the total duration of all vectors in this pass
			const passEvaluationTime = frameStartTime + accumulatedDurationWithinPass;

			gl.uniform2f(vsResolutionLocation, gl.canvas.width, gl.canvas.height);
			gl.uniform1f(vsGlowMultiplierLocation, webGLGlowMultiplier);
			gl.uniform1f(vsCurrentTimeLocation, passEvaluationTime); // Set uPassEvaluationTime
			gl.uniform1f(vsIntraVectorDecayRateLocation, webGLIntraVectorDecayRate);
			gl.uniform1f(vsAntialiasPixelWidthLocation, webGLAntialiasPixelWidth);
			gl.uniform1f(vsQuadExpansionMarginLocation, QUAD_EXPANSION_MARGIN);
			gl.uniform1f(vsEndpointDwellTimeLocation, webGLEndpointDwellTime);

			gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 13); // 13 components per vertex
		}
	}
	gl.disable(gl.BLEND);
	// --- End Line Drawing Pass ---

	// --- 2. Combine & Decay Pass (Read stateTextures[sourceStateIndex] and lineTexture, Write to stateFBOs[targetStateIndex]) ---
	gl.bindFramebuffer(gl.FRAMEBUFFER, stateFBOs[targetStateIndex]);
	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
	// No need to clear, we are overwriting the entire target FBO.

	gl.useProgram(combineDecayShaderProgram);

	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, stateTextures[sourceStateIndex]);
	gl.uniform1i(cdsPreviousStateTexLocation, 0);

	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, lineTexture);
	gl.uniform1i(cdsCurrentLinesTexLocation, 1);

	gl.uniform1f(cdsGlobalDecayLocation, pDecay);
	gl.uniform3f(cdsDifferentialDecayRatesLocation, webGLDifferentialDecayRates.r, webGLDifferentialDecayRates.g, webGLDifferentialDecayRates.b);

	gl.bindBuffer(gl.ARRAY_BUFFER, fullscreenQuadBuffer);
	gl.vertexAttribPointer(cdsPosLocation, 2, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(cdsPosLocation);
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
	// --- End Combine & Decay Pass ---

	// --- 3. Composite to Screen (Read stateTextures[targetStateIndex], Write to canvas) ---
	gl.bindFramebuffer(gl.FRAMEBUFFER, null); // Bind default framebuffer (the screen)
	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
	gl.clearColor(0.0, 0.0, 0.0, 1.0); // Clear screen to black
	gl.clear(gl.COLOR_BUFFER_BIT);

	gl.useProgram(compositeShaderProgram);
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, stateTextures[targetStateIndex]);
	gl.uniform1i(csCompositeTextureLocation, 0);

	gl.bindBuffer(gl.ARRAY_BUFFER, fullscreenQuadBuffer);
	gl.vertexAttribPointer(csPosLocation, 2, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(csPosLocation);
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
	// --- End Composite to Screen Pass ---

	// --- 4. Swap state textures for next frame ---
	currentStateIndex = targetStateIndex;


	// Restore simulation state for the next actual frame update (from original line drawing pass)
	pc = originalFramePC;
	lastPoint = { ...originalFrameLastPoint };
	SCALE_FACTOR = originalFrameSCALE_FACTOR;
	COLOR = originalFrameCOLOR;
	lastIntensity = originalFrameLastIntensity; // Restore for the main simulation advancement
	HALT_FLAG = 0; // Reset for the main simulation logic that advances pc

	// Advance the main simulation pc, lastPoint etc. after generating all draw data for this frame
	if (HALT_FLAG == 0) { // Only advance if not halted from line drawing sim
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
				var relX = parseInt(thisOp.x * scalers[SCALE_FACTOR] / divisors[thisOp.divisor]) * DVG_COORDINATE_SCALE_X;
				var relY = parseInt(thisOp.y * scalers[SCALE_FACTOR] / divisors[thisOp.divisor]) * DVG_COORDINATE_SCALE_Y;
				if (thisOp.intensity != lastIntensity) { lastIntensity = thisOp.intensity; }
				lastPoint.x += relX; lastPoint.y += relY;
			}
			else if (thisOp.opcode == "SVEC") {
				var relX = (thisOp.x << (4 + thisOp.scale)) * DVG_COORDINATE_SCALE_X;
				var relY = (thisOp.y << (4 + thisOp.scale)) * DVG_COORDINATE_SCALE_Y;
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
			} else if (thisOp.opcode == "HALT") { HALT_FLAG = 1; break; } // Break from opsCount loop
			pc++;
			if (pc >= program.length) { HALT_FLAG = 1; break; } // Break from opsCount loop
		}
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
		// const currentCanvas = useWebGLRenderer ? webGLCanvasElement : canvasElement; // No longer needed for LABS


		switch (command) {
			case "VCTR": newOp = new vecOp("VCTR", splitLine[1], splitLine[2], splitLine[3], splitLine[4]); break;
			case "LABS": newOp = new vecOp("LABS", PHYSICAL_CENTER_X + parseInt(splitLine[1]) * DVG_COORDINATE_SCALE_X, PHYSICAL_CENTER_Y + parseInt(splitLine[2]) * DVG_COORDINATE_SCALE_Y, splitLine[3]); break;
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
		else if (evt.which == 33) { // PageUp
			evt.preventDefault();
			if (useWebGLRenderer && webGLSupported) {
				webGLGlowMultiplier += 0.1;
				if (webGLGlowMultiplier > 5.0) webGLGlowMultiplier = 5.0;
				if (webGLGlowDisplay) webGLGlowDisplay.innerHTML = webGLGlowMultiplier.toFixed(2);
				if (webGLGlowMultiplierSlider) webGLGlowMultiplierSlider.value = webGLGlowMultiplier.toFixed(2);
			}
		} else if (evt.which == 34) { // PageDown
			evt.preventDefault();
			if (useWebGLRenderer && webGLSupported) {
				webGLGlowMultiplier -= 0.1;
				if (webGLGlowMultiplier < 0.0) webGLGlowMultiplier = 0.0;
				if (webGLGlowDisplay) webGLGlowDisplay.innerHTML = webGLGlowMultiplier.toFixed(2);
				if (webGLGlowMultiplierSlider) webGLGlowMultiplierSlider.value = webGLGlowMultiplier.toFixed(2);
			}
		} else if (evt.altKey && evt.ctrlKey && evt.which == 33) { // Ctrl + Alt + PageUp for Line Width
			evt.preventDefault();
			if (useWebGLRenderer && webGLSupported) {
				webGLLineWidthMultiplier = Math.min(10.0, webGLLineWidthMultiplier + 0.1);
				if (webGLLineWidthDisplay) webGLLineWidthDisplay.innerHTML = webGLLineWidthMultiplier.toFixed(2);
				if (webGLLineWidthMultiplierSlider) webGLLineWidthMultiplierSlider.value = webGLLineWidthMultiplier.toFixed(2);
			}
		} else if (evt.altKey && evt.ctrlKey && evt.which == 34) { // Ctrl + Alt + PageDown for Line Width
			evt.preventDefault();
			if (useWebGLRenderer && webGLSupported) {
				webGLLineWidthMultiplier = Math.max(0.1, webGLLineWidthMultiplier - 0.1);
				if (webGLLineWidthDisplay) webGLLineWidthDisplay.innerHTML = webGLLineWidthMultiplier.toFixed(2);
				if (webGLLineWidthMultiplierSlider) webGLLineWidthMultiplierSlider.value = webGLLineWidthMultiplier.toFixed(2);
			}
		} else if (evt.shiftKey && useWebGLRenderer && webGLSupported) { // Ctrl + Shift + Key for decay rates
			evt.preventDefault();
			let updated = false;
			switch (evt.key.toUpperCase()) {
				case 'R': webGLDifferentialDecayRates.r = Math.max(0.1, webGLDifferentialDecayRates.r - 0.1); updated = true; break;
				case 'F': webGLDifferentialDecayRates.r = Math.min(5.0, webGLDifferentialDecayRates.r + 0.1); updated = true; break;
				case 'G': webGLDifferentialDecayRates.g = Math.max(0.1, webGLDifferentialDecayRates.g - 0.1); updated = true; break;
				case 'H': webGLDifferentialDecayRates.g = Math.min(5.0, webGLDifferentialDecayRates.g + 0.1); updated = true; break;
				case 'B': webGLDifferentialDecayRates.b = Math.max(0.1, webGLDifferentialDecayRates.b - 0.1); updated = true; break;
				case 'N': webGLDifferentialDecayRates.b = Math.min(5.0, webGLDifferentialDecayRates.b + 0.1); updated = true; break;
			}
			if (updated) updateDifferentialDecayUI();
		}
	}
}

function updateDifferentialDecayUI() {
	if (webGLRedDecayRateSlider) webGLRedDecayRateSlider.value = webGLDifferentialDecayRates.r.toFixed(1);
	if (webGLRedDecayValueDisplay) webGLRedDecayValueDisplay.textContent = webGLDifferentialDecayRates.r.toFixed(1);
	if (webGLGreenDecayRateSlider) webGLGreenDecayRateSlider.value = webGLDifferentialDecayRates.g.toFixed(1);
	if (webGLGreenDecayValueDisplay) webGLGreenDecayValueDisplay.textContent = webGLDifferentialDecayRates.g.toFixed(1);
	if (webGLBlueDecayRateSlider) webGLBlueDecayRateSlider.value = webGLDifferentialDecayRates.b.toFixed(1);
	if (webGLBlueDecayValueDisplay) webGLBlueDecayValueDisplay.textContent = webGLDifferentialDecayRates.b.toFixed(1);
}


window.addEventListener("mousemove", mouseHandle, true);
window.addEventListener("keydown", keyHandle, true);

window.addEventListener("resize", () => {
	// canvasElement.width = window.innerWidth; // Remove
	// canvasElement.height = window.innerHeight; // Remove
	// webGLCanvasElement.width = window.innerWidth; // Remove
	// webGLCanvasElement.height = window.innerHeight; // Remove

	if (gl && useWebGLRenderer && webGLSupported) { // Ensure WebGL is initialized and active
		gl.viewport(0, 0, gl.canvas.width, gl.canvas.height); // Will use 2048x2048
		if (!recreateWebGLResources(gl.canvas.width, gl.canvas.height)) { // Will use 2048x2048
			console.error("Failed to resize WebGL resources. Display might be corrupted.");
			// Optionally, could disable WebGL renderer or show an error to the user
			// For now, just log and continue; the renderer might become unstable.
			// To be safer, one might set webGLSupported = false and toggle to 2D.
		}
	}
	// Reset lastPoint to center on resize
	lastPoint.x = PHYSICAL_CENTER_X;
	lastPoint.y = PHYSICAL_CENTER_Y;
});


window.addEventListener("load", async () => {
	canvasElement = document.getElementById("phosphor");
	DVG = canvasElement.getContext("2d");
	webGLCanvasElement = document.getElementById("webglCanvas");
	rendererTogglerButton = document.getElementById("rendererToggler");

	webGLGlowDisplay = document.getElementById("webGLGlowValue");
	webGLGlowMultiplierSlider = document.getElementById("webGLGlowMultiplierSlider");
	if (webGLGlowMultiplierSlider) {
		webGLGlowMultiplierSlider.value = webGLGlowMultiplier.toFixed(2);
		webGLGlowMultiplierSlider.addEventListener('input', (e) => {
			webGLGlowMultiplier = parseFloat(e.target.value);
			if (webGLGlowDisplay) webGLGlowDisplay.textContent = webGLGlowMultiplier.toFixed(2);
		});
	}

	webGLLineWidthDisplay = document.getElementById("webGLLineWidthValue");
	webGLLineWidthMultiplierSlider = document.getElementById("webGLLineWidthMultiplierSlider");
	if (webGLLineWidthMultiplierSlider) {
		webGLLineWidthMultiplierSlider.value = webGLLineWidthMultiplier.toFixed(2);
		webGLLineWidthMultiplierSlider.addEventListener('input', (e) => {
			webGLLineWidthMultiplier = parseFloat(e.target.value);
			if (webGLLineWidthDisplay) webGLLineWidthDisplay.textContent = webGLLineWidthMultiplier.toFixed(2);
		});
	}

	webGLRedDecayRateSlider = document.getElementById("redDecayRate");
	webGLGreenDecayRateSlider = document.getElementById("greenDecayRate");
	webGLBlueDecayRateSlider = document.getElementById("blueDecayRate");
	webGLRedDecayValueDisplay = document.getElementById("redDecayValue");
	webGLGreenDecayValueDisplay = document.getElementById("greenDecayValue");
	webGLBlueDecayValueDisplay = document.getElementById("blueDecayValue");

	if (webGLRedDecayRateSlider) webGLRedDecayRateSlider.addEventListener('input', (e) => { webGLDifferentialDecayRates.r = parseFloat(e.target.value); updateDifferentialDecayUI(); });
	if (webGLGreenDecayRateSlider) webGLGreenDecayRateSlider.addEventListener('input', (e) => { webGLDifferentialDecayRates.g = parseFloat(e.target.value); updateDifferentialDecayUI(); });
	if (webGLBlueDecayRateSlider) webGLBlueDecayRateSlider.addEventListener('input', (e) => { webGLDifferentialDecayRates.b = parseFloat(e.target.value); updateDifferentialDecayUI(); });

	// New UI elements for beam simulation
	webGLBeamSpeedSlider = document.getElementById("webGLBeamSpeedSlider");
	webGLBeamSpeedDisplay = document.getElementById("webGLBeamSpeedValue");
	if (webGLBeamSpeedSlider) {
		webGLBeamSpeedSlider.value = webGLBeamSpeed.toFixed(0);
		webGLBeamSpeedSlider.addEventListener('input', (e) => {
			webGLBeamSpeed = parseFloat(e.target.value);
			if (webGLBeamSpeedDisplay) webGLBeamSpeedDisplay.textContent = webGLBeamSpeed.toFixed(0);
		});
	}

	webGLIntraVectorDecayRateSlider = document.getElementById("webGLIntraVectorDecayRateSlider");
	webGLIntraVectorDecayRateDisplay = document.getElementById("webGLIntraVectorDecayRateValue");
	if (webGLIntraVectorDecayRateSlider) {
		webGLIntraVectorDecayRateSlider.value = webGLIntraVectorDecayRate.toFixed(2);
		webGLIntraVectorDecayRateSlider.addEventListener('input', (e) => {
			webGLIntraVectorDecayRate = parseFloat(e.target.value);
			if (webGLIntraVectorDecayRateDisplay) webGLIntraVectorDecayRateDisplay.textContent = webGLIntraVectorDecayRate.toFixed(2);
		});
	}

	webGLAntialiasPixelWidthSlider = document.getElementById("webGLAntialiasPixelWidthSlider");
	webGLAntialiasPixelWidthDisplay = document.getElementById("webGLAntialiasPixelWidthValue");
	if (webGLAntialiasPixelWidthSlider) {
		webGLAntialiasPixelWidthSlider.value = webGLAntialiasPixelWidth.toFixed(2);
		webGLAntialiasPixelWidthSlider.addEventListener('input', (e) => {
			webGLAntialiasPixelWidth = parseFloat(e.target.value);
			if (webGLAntialiasPixelWidthDisplay) webGLAntialiasPixelWidthDisplay.textContent = webGLAntialiasPixelWidth.toFixed(2);
		});
	}

	webGLEndpointDwellTimeSlider = document.getElementById("webGLEndpointDwellTimeSlider");
	webGLEndpointDwellTimeDisplay = document.getElementById("webGLEndpointDwellTimeValue");
	if (webGLEndpointDwellTimeSlider) {
		webGLEndpointDwellTimeSlider.value = webGLEndpointDwellTime.toFixed(3);
		webGLEndpointDwellTimeSlider.addEventListener('input', (e) => {
			webGLEndpointDwellTime = parseFloat(e.target.value);
			if (webGLEndpointDwellTimeDisplay) webGLEndpointDwellTimeDisplay.textContent = webGLEndpointDwellTime.toFixed(3);
		});
	}

	var webGLSettingsElement = document.getElementById("webglSettings");
	if (webGLSettingsElement) { // Initially hide WebGL specific settings
		webGLSettingsElement.style.display = 'none';
	}
	updateDifferentialDecayUI(); // Set initial values

	monitorControlsContainerElement = document.getElementById('controlBox');

	if (monitorControlsContainerElement) {
		monitorControlsContainerElement.style.display = 'none'; // Hidden by default

		const showControls = () => {
			if (!isToolboxPermanentlyHidden && monitorControlsContainerElement) {
				monitorControlsContainerElement.style.display = 'block';
			}
		};

		const hideControlsOnMouseLeaveCanvas = () => {
			if (!isToolboxPermanentlyHidden && monitorControlsContainerElement) {
				// If mouse leaves canvas and enters toolbox, don't hide.
				// The toolbox's own mouseleave will handle hiding later.
				if (monitorControlsContainerElement.matches(':hover')) {
					return;
				}
				monitorControlsContainerElement.style.display = 'none';
			}
		};

		const toggleControlsOnCanvasClick = () => {
			if (!isToolboxPermanentlyHidden && monitorControlsContainerElement) {
				if (monitorControlsContainerElement.style.display === 'none' || monitorControlsContainerElement.style.display === '') {
					monitorControlsContainerElement.style.display = 'block'; // Directly show
				} else {
					monitorControlsContainerElement.style.display = 'none'; // Directly hide
				}
			}
		};

		// Event listeners for canvas elements
		const setupCanvasEventListeners = (canvas) => {
			if (canvas) {
				canvas.addEventListener('mouseenter', showControls);
				canvas.addEventListener('click', toggleControlsOnCanvasClick);
				canvas.addEventListener('mouseleave', hideControlsOnMouseLeaveCanvas);
			}
		};

		setupCanvasEventListeners(canvasElement);
		setupCanvasEventListeners(webGLCanvasElement);

		// Event listener for hiding toolbox when mouse leaves the toolbox itself
		monitorControlsContainerElement.addEventListener('mouseleave', () => {
			if (!isToolboxPermanentlyHidden && monitorControlsContainerElement) {
				// If mouse leaves toolbox, hide it.
				// If it re-enters canvas immediately, canvas mouseenter would handle showing it again.
				monitorControlsContainerElement.style.display = 'none';
			}
		});
	}


	if (canvasElement) {
		canvasElement.width = PHYSICAL_CANVAS_WIDTH;
		canvasElement.height = PHYSICAL_CANVAS_HEIGHT;
	}
	if (webGLCanvasElement) {
		webGLCanvasElement.width = PHYSICAL_CANVAS_WIDTH;
		webGLCanvasElement.height = PHYSICAL_CANVAS_HEIGHT;
	}

	vps = document.getElementById("vps");
	decay = document.getElementById("decay");

	await initWebGL(); // Try to init WebGL
	updateRendererToggleButton(); // Set initial visibility based on success

	parseProgram();
	initializePeer();
	// Set initial lastPoint based on the active renderer
	lastPoint.x = PHYSICAL_CENTER_X;
	lastPoint.y = PHYSICAL_CENTER_Y;

	setInterval(mainLoop, 20);
});