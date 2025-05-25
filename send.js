export { sendVecOps };

async function sendVecOps(monitorId, ops) {
  const url = `http://localhost:8000/send/${monitorId}`; // Updated port to 8000
  console.log(`Attempting to send ${ops.length} DVG ops to ${url}`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ops: ops }), // Ensure the body is { ops: [...] }
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`HTTP error! status: ${response.status}, body: ${errorBody}`);
      return null;
    }

    const responseData = await response.json();
    console.log('Success:', responseData);
    return responseData;
  } catch (error) {
    console.error('Error sending DVG ops:', error);
    return null;
  }
}

// Example usage:
// 1. Ensure the DVG server (main.ts) is running.
// 2. Open a monitor display in your browser, e.g., http://localhost:8000/?id=monitor1
// 3. Uncomment the Deno code block below.
// 4. Adjust `exampleMonitorId` if you used a different ID in the URL.
// 5. Run this script using Deno: `deno run -A send.js`
/*
if (typeof Deno !== 'undefined') { // Basic check if running in Deno
  const exampleMonitorId = 'monitor1'; // Change this if your monitor ID is different

  // Example DVG operations to draw a square
  const screenWidth = 800; // Assuming a typical browser window width for the DVG display
  const screenHeight = 600; // Assuming a typical browser window height for the DVG display
  const centerX = screenWidth / 2;
  const centerY = screenHeight / 2;
  const sideLength = 100; // Length of the square's side

  const exampleOps = [
    { opcode: 'COLOR', color: 2 }, // Magenta color
    // Position beam at the top-left corner of the square
    { opcode: 'LABS', x: centerX - sideLength / 2, y: centerY - sideLength / 2, scale: 1 },
    // Draw the square
    { opcode: 'VCTR', x: sideLength, y: 0, divisor: 1, intensity: 15 },          // Right
    { opcode: 'VCTR', x: 0, y: sideLength, divisor: 1, intensity: 15 },          // Down
    { opcode: 'VCTR', x: -sideLength, y: 0, divisor: 1, intensity: 15 },         // Left
    { opcode: 'VCTR', x: 0, y: -sideLength, divisor: 1, intensity: 15 }          // Up (back to start)
    // To make it loop, you could add:
    // { opcode: 'JMPL', target: 1 } // Jumps to the LABS instruction (index 1 of this array)
    // Note: For JMPL, the target is an index in the 'program' array.
    // The client-side dvgsim.js receives this array of ops and stores it.
    // A JMPL to target: 1 would re-execute from the LABS instruction.
  ];

  console.log(`Sending example DVG commands to monitor: ${exampleMonitorId}`);
  sendVecOps(exampleMonitorId, exampleOps)
    .then(result => {
      if (result) {
        console.log('sendVecOps example call completed successfully.');
      } else {
        console.log('sendVecOps example call failed. Check server logs and ensure the monitor is connected.');
      }
    })
    .catch(e => {
        console.error('An unexpected error occurred during the example call:', e);
    });
} else {
    console.log("This script contains an example for sending DVG commands using Deno.");
    console.log("To run the example, ensure Deno is installed, then uncomment the code block");
    console.log("starting with 'if (typeof Deno !== \\'undefined\\')' and run: deno run -A send.js");
}
*/
