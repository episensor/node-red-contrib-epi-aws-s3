/**
 * Node-RED compatibility test script
 * 
 * This script verifies that the node can be loaded in Node-RED:
 * 1. Starts a Node-RED instance
 * 2. Loads the node
 * 3. Verifies that the node is registered correctly
 */

const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const RED = require('node-red');

// Configuration
const ROOT_DIR = path.resolve(__dirname, '..');
const PACKAGE_JSON = path.join(ROOT_DIR, 'package.json');
const PORT = 8081;
const SETTINGS_FILE = path.join(__dirname, 'node-red-test', 'settings.js');
const FLOWS_FILE = path.join(__dirname, 'node-red-test', 'flows.json');
const USER_DIR = path.join(__dirname, 'node-red-test', 'user-dir');

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Create user directory if it doesn't exist
if (!fs.existsSync(USER_DIR)) {
  fs.mkdirSync(USER_DIR, { recursive: true });
}

// Create settings file if it doesn't exist
if (!fs.existsSync(path.dirname(SETTINGS_FILE))) {
  fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
}

if (!fs.existsSync(SETTINGS_FILE)) {
  const settingsContent = `
module.exports = {
    flowFile: '${FLOWS_FILE.replace(/\\/g, '\\\\')}',
    userDir: '${USER_DIR.replace(/\\/g, '\\\\')}',
    functionGlobalContext: {},
    editorTheme: {
        projects: {
            enabled: false
        }
    },
    logging: {
        console: {
            level: "info",
            metrics: false,
            audit: false
        }
    },
    debugMaxLength: 1000,
    exportGlobalContextKeys: false,
    externalModules: {}
};`;

  fs.writeFileSync(SETTINGS_FILE, settingsContent);
}

// Create flows file if it doesn't exist
if (!fs.existsSync(FLOWS_FILE)) {
  const flowsContent = `[{"id":"f6f2187d.f17ca8","type":"tab","label":"Flow 1","disabled":false,"info":""}]`;
  fs.writeFileSync(FLOWS_FILE, flowsContent);
}

/**
 * Start Node-RED and test the node
 */
async function testNodeRed(options = {}) {
  const startServer = !options.noStart;
  
  console.log(`${colors.blue}Testing Node-RED compatibility...${colors.reset}`);
  
  try {
    const packageData = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
    const nodeTypes = Object.keys(packageData['node-red'].nodes);
    
    if (nodeTypes.length === 0) {
      console.error(`${colors.red}No nodes defined in package.json${colors.reset}`);
      process.exit(1);
    }
    
    if (startServer) {
      console.log(`${colors.blue}Starting Node-RED...${colors.reset}`);
      
      // Create an Express app
      const app = express();
      
      // Create a server
      const server = http.createServer(app);
      
      // Create the settings object
      const settings = require(SETTINGS_FILE);
      
      // Add the current module to the node path
      settings.nodesDir = [ROOT_DIR];
      
      // Initialize the runtime with settings
      RED.init(server, settings);
      
      // Serve the editor UI
      app.use(settings.httpAdminRoot || '/', RED.httpAdmin);
      
      // Serve the http nodes UI
      app.use(settings.httpNodeRoot || '/api', RED.httpNode);
      
      // Start the server
      server.listen(PORT);
      
      // Start the runtime
      await new Promise((resolve, reject) => {
        RED.start().then(() => {
          console.log(`${colors.green}Node-RED started on port ${PORT}${colors.reset}`);
          resolve();
        }).catch(err => {
          console.error(`${colors.red}Failed to start Node-RED: ${err}${colors.reset}`);
          reject(err);
        });
      });
      
      // Check if our nodes are registered
      let allNodesRegistered = true;
      for (const nodeType of nodeTypes) {
        const nodeConstructor = RED.nodes.getType(nodeType);
        if (!nodeConstructor) {
          console.error(`${colors.red}Node type '${nodeType}' not registered${colors.reset}`);
          allNodesRegistered = false;
        } else {
          console.log(`${colors.green}Node type '${nodeType}' registered successfully${colors.reset}`);
        }
      }
      
      // Stop the runtime
      await RED.stop();
      server.close();
      
      if (!allNodesRegistered) {
        console.error(`${colors.red}Some nodes failed to register${colors.reset}`);
        process.exit(1);
      }
      
      console.log(`${colors.green}Node-RED compatibility test passed${colors.reset}`);
    } else {
      console.log(`${colors.yellow}Skipping Node-RED server start (--no-start option)${colors.reset}`);
      console.log(`${colors.green}Node-RED compatibility check passed${colors.reset}`);
    }
  } catch (error) {
    console.error(`${colors.red}Node-RED compatibility test failed: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    noStart: false
  };
  
  for (const arg of args) {
    if (arg === '--no-start') {
      options.noStart = true;
    }
  }
  
  return options;
}

/**
 * Main function
 */
async function main() {
  console.log(`${colors.magenta}Running Node-RED compatibility test for node-red-contrib-epi-aws-s3${colors.reset}`);
  
  const options = parseArgs();
  await testNodeRed(options);
  
  console.log(`${colors.green}All Node-RED compatibility tests passed!${colors.reset}`);
  process.exit(0);
}

// Run the main function if this script is executed directly
if (require.main === module) {
  main().catch(err => {
    console.error(`${colors.red}Error: ${err.message}${colors.reset}`);
    process.exit(1);
  });
}

module.exports = {
  testNodeRed
}; 