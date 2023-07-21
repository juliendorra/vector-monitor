var canvasElement = document.getElementById("phosphor");
var DVG = canvasElement.getContext("2d");
canvasElement.width = 960; //window.innerWidth;
canvasElement.height = 720; //window.innerHeight;
tailsX = Array(0, 0, 0);
tailsY = Array(0, 0, 0);
bufferWidth = canvasElement.width * 4;
bufferDepth = bufferWidth * canvasElement.height;
maxOps = 40;
pDecay = 0.25;
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
]

// Default (empty) program
program.push(new vecOp("LABS"));
program.push(new vecOp("VCTR", 0, 30));
program.push(new vecOp("JMPL", 0));

function vecOp(opcode, a1, a2, a3, a4) {
	// VCTR, LABS, HALT, JSRL, RTSL, JMPL, SVEC
	// SCALE, CENTER, COLOR
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
		this.x = parseInt(a1) || 511;
		this.y = parseInt(a2) || 511;
		this.scale = parseInt(a3) || 1;
	} else if (this.opcode == "SCALE") {
		this.scale = parseInt(a1) || 0;
	} else if (this.opcode == "CENTER") {
		this.x = 512;
		this.y = 512;
	} else if (this.opcode == "COLOR") {
		this.color = parseInt(a1) || 0;
	} else if ((this.opcode == "JSRL") || (this.opcode == "JMPL")) {
		this.target = parseInt(a1);
	}
}

function mainLoop() {

	// phosphor fade-out
	DVG.globalCompositeOperation = "source-over";
	DVG.fillStyle = "rgba(0,0,0," + pDecay + ")";
	DVG.fillRect(0, 0, canvasElement.width, canvasElement.height);

	if (HALT_FLAG == 1) return;

	// Prepare the context for drawing
	DVG.lineJoin = "round";
	DVG.lineCap = "round";
	DVG.globalCompositeOperation = "lighter";

	// Now we'll start to run the program, but only perform the number
	// of operations in maxOps.
	DVG.beginPath();

	// Move the beam to the last-known X,Y coordinates. This is for
	// picking-up where we left-off when maxOps is less than the
	// length of the program.
	DVG.moveTo(lastPoint.x, lastPoint.y);
	for (ops = 0; ops < maxOps; ops++) {
		thisOp = program[pc];

		if (thisOp.opcode == "SCALE") { // [L]oad [ABS]olute
			SCALE_FACTOR = thisOp.scale;
		}

		else if (thisOp.opcode == "CENTER") { // Recenter the beam
			// Deflect the beam to the center
			// drawing nothing; set the global scale factor.
			DVG.moveTo(thisOp.x, thisOp.y);
			// Save our deflection in case we have to resume the
			// program on another iteration of main_loop();
			lastPoint.x = thisOp.x;
			lastPoint.y = thisOp.y;
		}

		else if (thisOp.opcode == "COLOR") { // [L]oad [ABS]olute

			glowStroke();  // Draw whatever's on the path right now

			COLOR = thisOp.color;

			DVG.beginPath();  // Begin a new path at last
			// deflection...
			DVG.moveTo(lastPoint.x, lastPoint.y);


		}
		else if (thisOp.opcode == "LABS") { // [L]oad [ABS]olute
			// Deflect the beam to a specific coordinate on the
			// screen, drawing nothing; set the global scale factor.
			DVG.moveTo(thisOp.x, thisOp.y);
			SCALE_FACTOR = thisOp.scale;
			// Save our deflection in case we have to resume the
			// program on another iteration of main_loop();
			lastPoint.x = thisOp.x;
			lastPoint.y = thisOp.y;
		}

		else if (thisOp.opcode == "VCTR") {// Draw long [V]e[CT]o[R]
			// Draw a vector at the specified intensity. Coordinates
			// are relative to the current deflection, and are divided
			// by 2^divisor, then multiplied according to the global
			// scale factor.
			var relX = parseInt(thisOp.x * scalers[SCALE_FACTOR] / divisors[thisOp.divisor]);
			var relY = parseInt(thisOp.y * scalers[SCALE_FACTOR] / divisors[thisOp.divisor]);

			if (thisOp.intensity != lastIntensity) {
				glowStroke();  // Draw whatever's on the path right now,
				// because we'll be setting the intensity specifically
				// for this long vector.
				lastIntensity = thisOp.intensity;
				DVG.beginPath();  // Begin a new path at last
				// deflection...
				DVG.moveTo(lastPoint.x, lastPoint.y);
			}
			lastPoint.x += relX; // Save where our deflection will
			lastPoint.y += relY; // be at the end of this vector.
			DVG.lineTo(lastPoint.x, lastPoint.y);

		}

		else if (thisOp.opcode == "SVEC") {// [S]hort [VEC]tor
			// Similar to VCTR, but with a less-precise way of
			// specifying length.  

			// Valid values for x and y are 0 - 3, or 00b - 11b. The
			// scale factor (also ranging from 0 to 3) determines
			// whether to shift this value left by 4, 5, 6, or 7 bits.
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
		} else if (thisOp.opcode == "JMPL") {// [J]u[MP]...[L]arry?
			// Nothing special here. Change program counter to the
			// target and exit the loop without incrementing it.
			pc = thisOp.target;
			continue;
		} else if (thisOp.opcode == "JSRL") {// [J]ump to [S]ub[R]outine, [L]
			pc++;
			stack.push(pc);
			pc = thisOp.target;
			continue;
		} else if (thisOp.opcode == "RTSL") {// [R]e[T]urn from [S]ubroutine,[L]
			pc = stack.pop();
			continue;
		} else if (thisOp.opcode == "HALT") {
			HALT_FLAG = 1;
			return;
		}
		pc++;
		if (pc > program.length) {
			pc = 0;
			HALT_FLAG = 1;
			return;
		}
	}
	glowStroke();

	// Put a tail on the mouse (for testing)
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
	// Draw the vector three times, to build-up a glow-like effect.

	let color = colors[COLOR % colors.length].join(",") // rolling over the color array

	// 127,228,255

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

	// Run through once and get all the label addresses
	for (var lineNum in codeLines) {
		codeLines[lineNum].trim();
		var splitLine = codeLines[lineNum].split(/\s+/);
		if (splitLine[0] == "LABEL") {
			codeLabels[splitLine[1]] = opNum;
			continue;
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

	// Run through again, actually generating the vecOp and pushing it
	// onto a new program this time.
	opNum = 0;
	for (var lineNum in codeLines) {
		codeLines[lineNum].trim();
		var splitLine = codeLines[lineNum].split(/\s+/);
		if (splitLine[0] == "VCTR") {
			var newOp = new vecOp("VCTR", splitLine[1], splitLine[2], splitLine[3], splitLine[4]);
		} else if (splitLine[0] == "LABS") {
			var newOp = new vecOp("LABS",
				512 + parseInt(splitLine[1]),
				512 + parseInt(splitLine[2]),
				splitLine[3]);
		} else if (splitLine[0] == "HALT") {
			var newOp = new vecOp("HALT");
		} else if (splitLine[0] == "JSRL") {
			var newOp = new vecOp("JSRL", codeLabels[splitLine[1]]);
		} else if (splitLine[0] == "RTSL") {
			var newOp = new vecOp("RTSL");
		} else if (splitLine[0] == "JMPL") {
			var newOp = new vecOp("JMPL",
				codeLabels[splitLine[1]]);
		} else if (splitLine[0] == "SVEC") {
			var newOp = new vecOp("SVEC",
				splitLine[1],
				splitLine[2],
				splitLine[3],
				splitLine[4]);
		}
		else if (splitLine[0] == "COLOR") {
			var newOp = new vecOp("COLOR",
				splitLine[1]);
		}
		else if (splitLine[0] == "CENTER") {
			var newOp = new vecOp("CENTER");
		}
		else {
			// If there's no opcode at the start of the line, treat it like a 
			// comment and ignore it.
			continue;
		}
		opNum++;
		newProg.push(newOp);
	}
	//var codeString = "";
	//for (var progLine in newProg){
	//  var opOp = newProg[progLine];
	//  opProps = Object.keys(opOp);
	//  for (var opProp in opProps){
	//    codeString += opOp[opProps[opProp]];
	//    codeString += " ";
	//  }
	//  codeString += "\n";
	//} 
	//editor.innerHTML = codeString;
	if (errs == 0) {
		program = newProg;
		//alert("Program changed to: \n",JSON.stringify(newProg));
		pc = 0;
	}

}

function mouseHandle(evt) {
	tailsX.push(evt.clientX);
	tailsY.push(evt.clientY);
}

function keyHandle(evt) {
	// Catch some keypresses, do some stuff.
	if (evt.ctrlKey) {
		if (evt.which == 80) { // [Control + P] to Pause
			evt.preventDefault();
			if (HALT_FLAG == 0) {
				HALT_FLAG = 1;
			} else {
				HALT_FLAG = 0;
			}
		} else if (evt.which == 13) { // [Control + Enter]
			// to compile and run
			parseProgram();
		} else if (evt.which == 190) { // ">" 
			maxOps++;
			vps.innerHTML = 5 * maxOps;
		} else if (evt.which == 188) {  // "<"
			maxOps--;
			vps.innerHTML = 5 * maxOps;
		} else if (evt.which == 219) { // "["
			pDecay -= 0.05;
			decay.innerHTML = "-" + (Math.ceil((pDecay / 5) * 1000) / 10) + '%/ms';
		} else if (evt.which == 221) { // "]"
			pDecay += 0.05;
			decay.innerHTML = "-" + (Math.ceil((pDecay / 5) * 1000) / 10) + '%/ms';
		}
	}
}

window.addEventListener("mousemove", mouseHandle, true);
window.addEventListener("keydown", keyHandle, true);
window.addEventListener("load", parseProgram, true);
setInterval(mainLoop, 20);