/**
 * Security check script
 * 
 * This script performs security checks on the package:
 * 1. Runs npm audit to check for vulnerable dependencies
 * 2. Checks for outdated dependencies
 * 3. Performs basic code security checks
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
 * Check for vulnerable dependencies
 */
function checkVulnerableDependencies() {
  console.log(`${colors.blue}Checking for vulnerable dependencies...${colors.reset}`);
  
  try {
    const npmAudit = runCommand('npm audit --json', { silent: true, ignoreError: true });
    const auditResult = JSON.parse(npmAudit);
    
    if (auditResult.metadata && auditResult.metadata.vulnerabilities) {
      const vulns = auditResult.metadata.vulnerabilities;
      const totalVulns = vulns.critical + vulns.high + vulns.moderate + vulns.low;
      
      if (totalVulns > 0) {
        console.warn(`${colors.yellow}Security vulnerabilities found:${colors.reset}`);
        console.warn(`  Critical: ${vulns.critical}`);
        console.warn(`  High: ${vulns.high}`);
        console.warn(`  Moderate: ${vulns.moderate}`);
        console.warn(`  Low: ${vulns.low}`);
        
        if (vulns.critical > 0 || vulns.high > 0) {
          console.error(`${colors.red}Critical or high severity vulnerabilities found.${colors.reset}`);
          console.error(`${colors.red}Run 'npm audit fix' to try to automatically fix these issues.${colors.reset}`);
          return false;
        }
      } else {
        console.log(`${colors.green}No security vulnerabilities found${colors.reset}`);
      }
    }
    
    return true;
  } catch (error) {
    console.error(`${colors.red}Error checking for vulnerable dependencies: ${error.message}${colors.reset}`);
    return false;
  }
}

/**
 * Check for outdated dependencies
 */
function checkOutdatedDependencies() {
  console.log(`${colors.blue}Checking for outdated dependencies...${colors.reset}`);
  
  try {
    const outdated = runCommand('npm outdated --json', { silent: true, ignoreError: true });
    
    try {
      const outdatedDeps = JSON.parse(outdated);
      const numOutdated = Object.keys(outdatedDeps).length;
      
      if (numOutdated > 0) {
        console.warn(`${colors.yellow}${numOutdated} outdated dependencies found:${colors.reset}`);
        
        for (const [pkg, info] of Object.entries(outdatedDeps)) {
          console.warn(`  ${pkg}: ${info.current} -> ${info.latest}`);
        }
        
        console.warn(`${colors.yellow}Consider updating dependencies with 'npm update'.${colors.reset}`);
      } else {
        console.log(`${colors.green}All dependencies are up to date${colors.reset}`);
      }
    } catch (e) {
      // No outdated dependencies
      console.log(`${colors.green}All dependencies are up to date${colors.reset}`);
    }
    
    return true;
  } catch (error) {
    console.error(`${colors.red}Error checking for outdated dependencies: ${error.message}${colors.reset}`);
    return false;
  }
}

/**
 * Perform basic code security checks
 */
function performCodeSecurityChecks() {
  console.log(`${colors.blue}Performing basic code security checks...${colors.reset}`);
  
  try {
    const packageData = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
    const nodeFiles = Object.values(packageData['node-red'].nodes);
    let hasIssues = false;
    
    // Check for common security issues in each node file
    for (const nodeFile of nodeFiles) {
      const filePath = path.join(ROOT_DIR, nodeFile);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Check for potentially dangerous patterns
      const patterns = [
        { pattern: /eval\s*\(/, description: 'Use of eval()' },
        { pattern: /new\s+Function\s*\(/, description: 'Use of new Function()' },
        { pattern: /child_process\.exec\s*\(/, description: 'Use of child_process.exec()' },
        { pattern: /process\.env\.AWS_SECRET_ACCESS_KEY/, description: 'Hardcoded AWS credentials' },
        { pattern: /process\.env\.AWS_ACCESS_KEY_ID/, description: 'Hardcoded AWS credentials' },
        { pattern: /console\.log\s*\(.*password/i, description: 'Logging passwords' },
        { pattern: /console\.log\s*\(.*secret/i, description: 'Logging secrets' },
        { pattern: /console\.log\s*\(.*key/i, description: 'Logging keys' },
        { pattern: /console\.log\s*\(.*token/i, description: 'Logging tokens' },
        { pattern: /require\s*\(\s*['"]crypto['"]/, description: 'Use of crypto module (not necessarily an issue, but worth reviewing)' }
      ];
      
      for (const { pattern, description } of patterns) {
        if (pattern.test(content)) {
          console.warn(`${colors.yellow}Potential security issue in ${nodeFile}: ${description}${colors.reset}`);
          hasIssues = true;
        }
      }
    }
    
    if (!hasIssues) {
      console.log(`${colors.green}No obvious security issues found in code${colors.reset}`);
    } else {
      console.warn(`${colors.yellow}Potential security issues found. Please review the code.${colors.reset}`);
    }
    
    return !hasIssues;
  } catch (error) {
    console.error(`${colors.red}Error performing code security checks: ${error.message}${colors.reset}`);
    return false;
  }
}

/**
 * Main function
 */
function main() {
  console.log(`${colors.magenta}Running security checks for @episensor/epi-aws-s3${colors.reset}`);
  
  let success = true;
  
  // Run all security checks
  success = checkVulnerableDependencies() && success;
  success = checkOutdatedDependencies() && success;
  success = performCodeSecurityChecks() && success;
  
  if (success) {
    console.log(`${colors.green}All security checks passed!${colors.reset}`);
    process.exit(0);
  } else {
    console.error(`${colors.red}Security checks failed. Please address the issues before publishing.${colors.reset}`);
    process.exit(1);
  }
}

// Run the main function if this script is executed directly
if (require.main === module) {
  main();
}

module.exports = {
  checkVulnerableDependencies,
  checkOutdatedDependencies,
  performCodeSecurityChecks
}; 