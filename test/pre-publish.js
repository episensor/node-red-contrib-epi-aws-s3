/**
 * Pre-publish test script
 * 
 * This script runs a series of checks before publishing the package:
 * 1. Verifies package.json
 * 2. Runs unit tests
 * 3. Performs security checks
 * 4. Verifies Node-RED compatibility
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

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
        process.exit(1);
      }
    }
    
    // Check node-red section
    if (!packageData['node-red'].nodes || Object.keys(packageData['node-red'].nodes).length === 0) {
      console.error(`${colors.red}No nodes defined in package.json node-red.nodes section${colors.reset}`);
      process.exit(1);
    }
    
    // Check if all node files exist
    for (const [nodeName, nodeFile] of Object.entries(packageData['node-red'].nodes)) {
      const filePath = path.join(ROOT_DIR, nodeFile);
      if (!fs.existsSync(filePath)) {
        console.error(`${colors.red}Node file not found: ${nodeFile}${colors.reset}`);
        process.exit(1);
      }
      
      // Check if corresponding HTML file exists
      const htmlFile = nodeFile.replace(/\.js$/, '.html');
      const htmlPath = path.join(ROOT_DIR, htmlFile);
      if (!fs.existsSync(htmlPath)) {
        console.error(`${colors.red}HTML file not found for node: ${htmlFile}${colors.reset}`);
        process.exit(1);
      }
    }
    
    // Check version format
    const versionRegex = /^\d+\.\d+\.\d+$/;
    if (!versionRegex.test(packageData.version)) {
      console.error(`${colors.red}Invalid version format: ${packageData.version}${colors.reset}`);
      process.exit(1);
    }
    
    console.log(`${colors.green}package.json verification passed${colors.reset}`);
    return packageData;
  } catch (error) {
    console.error(`${colors.red}Error verifying package.json: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

/**
 * Run unit tests
 */
function runUnitTests() {
  console.log(`${colors.blue}Running unit tests...${colors.reset}`);
  
  try {
    runCommand('npm test');
    console.log(`${colors.green}Unit tests passed${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}Unit tests failed${colors.reset}`);
    process.exit(1);
  }
}

/**
 * Run security checks
 */
function runSecurityChecks() {
  console.log(`${colors.blue}Running security checks...${colors.reset}`);

  try {
    // Check for vulnerable production dependencies only
    // Dev dependencies don't affect the published package
    const npmAudit = runCommand('npm audit --omit=dev --json', { silent: true, ignoreError: true });
    const auditResult = JSON.parse(npmAudit);

    if (auditResult.metadata && auditResult.metadata.vulnerabilities) {
      const vulns = auditResult.metadata.vulnerabilities;
      const totalVulns = vulns.critical + vulns.high + vulns.moderate + vulns.low;

      if (totalVulns > 0) {
        console.warn(`${colors.yellow}Production security vulnerabilities found:${colors.reset}`);
        console.warn(`  Critical: ${vulns.critical}`);
        console.warn(`  High: ${vulns.high}`);
        console.warn(`  Moderate: ${vulns.moderate}`);
        console.warn(`  Low: ${vulns.low}`);

        if (vulns.critical > 0 || vulns.high > 0) {
          console.error(`${colors.red}Critical or high severity vulnerabilities found in production dependencies. Please fix before publishing.${colors.reset}`);
          process.exit(1);
        }
      } else {
        console.log(`${colors.green}No security vulnerabilities found in production dependencies${colors.reset}`);
      }
    }

    // Report dev vulnerabilities as info (but don't fail)
    const devAudit = runCommand('npm audit --json', { silent: true, ignoreError: true });
    const devAuditResult = JSON.parse(devAudit);
    if (devAuditResult.metadata && devAuditResult.metadata.vulnerabilities) {
      const devVulns = devAuditResult.metadata.vulnerabilities;
      const totalDevVulns = devVulns.critical + devVulns.high + devVulns.moderate + devVulns.low;
      if (totalDevVulns > 0) {
        console.log(`${colors.cyan}Note: ${totalDevVulns} vulnerabilities in dev dependencies (not affecting published package)${colors.reset}`);
      }
    }
    
    // Check for outdated dependencies
    console.log(`${colors.blue}Checking for outdated dependencies...${colors.reset}`);
    const outdated = runCommand('npm outdated --json', { silent: true, ignoreError: true });
    
    try {
      const outdatedDeps = JSON.parse(outdated);
      const numOutdated = Object.keys(outdatedDeps).length;
      
      if (numOutdated > 0) {
        console.warn(`${colors.yellow}${numOutdated} outdated dependencies found.${colors.reset}`);
        console.warn(`Consider updating dependencies before publishing.`);
      } else {
        console.log(`${colors.green}All dependencies are up to date${colors.reset}`);
      }
    } catch (e) {
      // No outdated dependencies
      console.log(`${colors.green}All dependencies are up to date${colors.reset}`);
    }
    
    console.log(`${colors.green}Security checks passed${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}Security checks failed: ${error.message}${colors.reset}`);
    process.exit(1);
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
        process.exit(1);
      }
    }
    
    // Clean up
    fs.rmSync(tempDir, { recursive: true, force: true });
    
    console.log(`${colors.green}Package verification passed${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}Package verification failed: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

/**
 * Main function
 */
function main() {
  console.log(`${colors.magenta}Running pre-publish checks for @episensor/epi-aws-s3${colors.reset}`);
  
  // Run all checks
  const packageData = verifyPackageJson();
  runUnitTests();
  runSecurityChecks();
  verifyPackaging();
  
  console.log(`${colors.green}All pre-publish checks passed!${colors.reset}`);
  console.log(`${colors.green}Ready to publish version ${packageData.version}${colors.reset}`);
}

// Run the main function if this script is executed directly
if (require.main === module) {
  main();
}

module.exports = {
  verifyPackageJson,
  runUnitTests,
  runSecurityChecks,
  verifyPackaging
}; 