/**
 * Verify package script
 * 
 * This script verifies that the package is correctly configured:
 * 1. Checks package.json for required fields
 * 2. Verifies that all required files exist
 * 3. Checks that the package can be packed correctly
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

// Configuration
const ROOT_DIR = path.resolve(__dirname, '..');
const PACKAGE_JSON = path.join(ROOT_DIR, 'package.json');

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

/**
 * Run a command and return its output
 */
function runCommand(command, options = {}) {
  try {
    return execSync(command, { 
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options
    });
  } catch (error) {
    if (options.ignoreError) {
      return error.stdout || '';
    }
    console.error(`${colors.red}Command failed: ${command}${colors.reset}`);
    console.error(error.stdout || error.message);
    process.exit(1);
  }
}

/**
 * Verify package.json
 */
function verifyPackageJson() {
  console.log(`${colors.blue}Verifying package.json...${colors.reset}`);
  
  try {
    const packageData = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
    
    // Check required fields
    const requiredFields = [
      'name', 'version', 'description', 'keywords', 'author', 
      'license', 'repository', 'node-red'
    ];
    
    for (const field of requiredFields) {
      if (!packageData[field]) {
        console.error(`${colors.red}Missing required field in package.json: ${field}${colors.reset}`);
        return false;
      }
    }
    
    // Check node-red section
    if (!packageData['node-red'].nodes || Object.keys(packageData['node-red'].nodes).length === 0) {
      console.error(`${colors.red}No nodes defined in package.json node-red.nodes section${colors.reset}`);
      return false;
    }
    
    // Check if all node files exist
    for (const [nodeName, nodeFile] of Object.entries(packageData['node-red'].nodes)) {
      const filePath = path.join(ROOT_DIR, nodeFile);
      if (!fs.existsSync(filePath)) {
        console.error(`${colors.red}Node file not found: ${nodeFile}${colors.reset}`);
        return false;
      }
      
      // Check if corresponding HTML file exists
      const htmlFile = nodeFile.replace(/\.js$/, '.html');
      const htmlPath = path.join(ROOT_DIR, htmlFile);
      if (!fs.existsSync(htmlPath)) {
        console.error(`${colors.red}HTML file not found for node: ${htmlFile}${colors.reset}`);
        return false;
      }
    }
    
    // Check version format
    const versionRegex = /^\d+\.\d+\.\d+$/;
    if (!versionRegex.test(packageData.version)) {
      console.error(`${colors.red}Invalid version format: ${packageData.version}${colors.reset}`);
      return false;
    }
    
    // Check engines field
    if (!packageData.engines || !packageData.engines.node) {
      console.warn(`${colors.yellow}Missing or incomplete engines field in package.json${colors.reset}`);
    }
    
    // Check keywords
    if (!packageData.keywords || packageData.keywords.length === 0) {
      console.warn(`${colors.yellow}No keywords defined in package.json${colors.reset}`);
    } else {
      const hasNodeRed = packageData.keywords.some(keyword => 
        keyword.toLowerCase().includes('node-red') || keyword.toLowerCase() === 'nodered'
      );
      
      if (!hasNodeRed) {
        console.warn(`${colors.yellow}Keywords should include 'node-red' for better discoverability${colors.reset}`);
      }
    }
    
    console.log(`${colors.green}package.json verification passed${colors.reset}`);
    return true;
  } catch (error) {
    console.error(`${colors.red}Error verifying package.json: ${error.message}${colors.reset}`);
    return false;
  }
}

/**
 * Verify required files exist
 */
function verifyRequiredFiles() {
  console.log(`${colors.blue}Verifying required files...${colors.reset}`);
  
  try {
    const requiredFiles = [
      'README.md',
      'LICENSE'
    ];
    
    for (const file of requiredFiles) {
      const filePath = path.join(ROOT_DIR, file);
      if (!fs.existsSync(filePath)) {
        console.error(`${colors.red}Required file not found: ${file}${colors.reset}`);
        return false;
      }
    }
    
    // Check if README.md has content
    const readmePath = path.join(ROOT_DIR, 'README.md');
    const readmeContent = fs.readFileSync(readmePath, 'utf8');
    if (readmeContent.trim().length < 100) {
      console.warn(`${colors.yellow}README.md seems too short. Consider adding more documentation.${colors.reset}`);
    }
    
    console.log(`${colors.green}Required files verification passed${colors.reset}`);
    return true;
  } catch (error) {
    console.error(`${colors.red}Error verifying required files: ${error.message}${colors.reset}`);
    return false;
  }
}

/**
 * Verify the package can be packed correctly
 */
function verifyPackaging() {
  console.log(`${colors.blue}Verifying package can be packed correctly...${colors.reset}`);
  
  try {
    // Create a temporary directory
    const tempDir = path.join(ROOT_DIR, 'temp-pack-test');
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir);
    
    // Pack the package
    const packOutput = runCommand('npm pack --json', { silent: true });
    const packResult = JSON.parse(packOutput);
    const tarballPath = path.join(ROOT_DIR, packResult[0].filename);
    
    // Move the tarball to the temp directory
    fs.renameSync(tarballPath, path.join(tempDir, packResult[0].filename));
    
    // Extract the tarball
    runCommand(`cd ${tempDir} && tar -xzf ${packResult[0].filename}`, { silent: true });
    
    // Check if all required files are present
    const packageData = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
    const extractedDir = path.join(tempDir, 'package');
    
    // Check node files
    for (const nodeFile of Object.values(packageData['node-red'].nodes)) {
      const extractedNodePath = path.join(extractedDir, nodeFile);
      if (!fs.existsSync(extractedNodePath)) {
        console.error(`${colors.red}Node file missing from packed package: ${nodeFile}${colors.reset}`);
        return false;
      }
      
      // Check HTML files
      const htmlFile = nodeFile.replace(/\.js$/, '.html');
      const extractedHtmlPath = path.join(extractedDir, htmlFile);
      if (!fs.existsSync(extractedHtmlPath)) {
        console.error(`${colors.red}HTML file missing from packed package: ${htmlFile}${colors.reset}`);
        return false;
      }
    }
    
    // Check if README.md and LICENSE are included
    const requiredFiles = ['README.md', 'LICENSE'];
    for (const file of requiredFiles) {
      const extractedPath = path.join(extractedDir, file);
      if (!fs.existsSync(extractedPath)) {
        console.error(`${colors.red}Required file missing from packed package: ${file}${colors.reset}`);
        return false;
      }
    }
    
    // Clean up
    fs.rmSync(tempDir, { recursive: true, force: true });
    
    console.log(`${colors.green}Package verification passed${colors.reset}`);
    return true;
  } catch (error) {
    console.error(`${colors.red}Package verification failed: ${error.message}${colors.reset}`);
    return false;
  }
}

/**
 * Main function
 */
function main() {
  console.log(`${colors.magenta}Verifying package for node-red-contrib-epi-aws-s3${colors.reset}`);
  
  let success = true;
  
  // Run all verification checks
  success = verifyPackageJson() && success;
  success = verifyRequiredFiles() && success;
  success = verifyPackaging() && success;
  
  if (success) {
    console.log(`${colors.green}All package verification checks passed!${colors.reset}`);
    process.exit(0);
  } else {
    console.error(`${colors.red}Package verification failed. Please address the issues before publishing.${colors.reset}`);
    process.exit(1);
  }
}

// Run the main function if this script is executed directly
if (require.main === module) {
  main();
}

module.exports = {
  verifyPackageJson,
  verifyRequiredFiles,
  verifyPackaging
}; 