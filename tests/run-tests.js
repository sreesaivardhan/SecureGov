#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class TestRunner {
    constructor() {
        this.testResults = {
            unit: { passed: 0, failed: 0, total: 0 },
            integration: { passed: 0, failed: 0, total: 0 },
            coverage: { statements: 0, branches: 0, functions: 0, lines: 0 }
        };
    }

    async runCommand(command, args, options = {}) {
        return new Promise((resolve, reject) => {
            console.log(`\n🚀 Running: ${command} ${args.join(' ')}`);
            
            const child = spawn(command, args, {
                stdio: 'pipe',
                shell: true,
                ...options
            });

            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (data) => {
                const output = data.toString();
                stdout += output;
                process.stdout.write(output);
            });

            child.stderr.on('data', (data) => {
                const output = data.toString();
                stderr += output;
                process.stderr.write(output);
            });

            child.on('close', (code) => {
                if (code === 0) {
                    resolve({ stdout, stderr, code });
                } else {
                    reject({ stdout, stderr, code });
                }
            });

            child.on('error', (error) => {
                reject({ error, stdout, stderr });
            });
        });
    }

    parseTestResults(output) {
        const lines = output.split('\n');
        let passed = 0;
        let failed = 0;
        let total = 0;

        lines.forEach(line => {
            if (line.includes('passing')) {
                const match = line.match(/(\d+) passing/);
                if (match) passed = parseInt(match[1]);
            }
            if (line.includes('failing')) {
                const match = line.match(/(\d+) failing/);
                if (match) failed = parseInt(match[1]);
            }
        });

        total = passed + failed;
        return { passed, failed, total };
    }

    parseCoverageResults(output) {
        const coverage = { statements: 0, branches: 0, functions: 0, lines: 0 };
        
        const lines = output.split('\n');
        lines.forEach(line => {
            if (line.includes('Statements')) {
                const match = line.match(/(\d+\.?\d*)%/);
                if (match) coverage.statements = parseFloat(match[1]);
            }
            if (line.includes('Branches')) {
                const match = line.match(/(\d+\.?\d*)%/);
                if (match) coverage.branches = parseFloat(match[1]);
            }
            if (line.includes('Functions')) {
                const match = line.match(/(\d+\.?\d*)%/);
                if (match) coverage.functions = parseFloat(match[1]);
            }
            if (line.includes('Lines')) {
                const match = line.match(/(\d+\.?\d*)%/);
                if (match) coverage.lines = parseFloat(match[1]);
            }
        });

        return coverage;
    }

    async runUnitTests() {
        console.log('\n📋 Running Unit Tests...');
        console.log('=' .repeat(50));
        
        try {
            const result = await this.runCommand('npm', ['run', 'test']);
            this.testResults.unit = this.parseTestResults(result.stdout);
            console.log(`✅ Unit tests completed: ${this.testResults.unit.passed}/${this.testResults.unit.total} passed`);
            return true;
        } catch (error) {
            this.testResults.unit = this.parseTestResults(error.stdout || '');
            console.log(`❌ Unit tests failed: ${this.testResults.unit.passed}/${this.testResults.unit.total} passed`);
            return false;
        }
    }

    async runCoverageTests() {
        console.log('\n📊 Running Coverage Tests...');
        console.log('=' .repeat(50));
        
        try {
            const result = await this.runCommand('npm', ['run', 'test:coverage']);
            this.testResults.coverage = this.parseCoverageResults(result.stdout);
            console.log(`✅ Coverage analysis completed`);
            return true;
        } catch (error) {
            console.log(`❌ Coverage analysis failed`);
            return false;
        }
    }

    async runIntegrationTests() {
        console.log('\n🔗 Running Integration Tests...');
        console.log('=' .repeat(50));
        
        // Check if servers are running
        const serversRunning = await this.checkServers();
        if (!serversRunning) {
            console.log('⚠️  Servers not running. Starting servers...');
            await this.startServers();
        }

        try {
            const result = await this.runCommand('npm', ['run', 'test:integration']);
            this.testResults.integration = this.parseTestResults(result.stdout);
            console.log(`✅ Integration tests completed: ${this.testResults.integration.passed}/${this.testResults.integration.total} passed`);
            return true;
        } catch (error) {
            this.testResults.integration = this.parseTestResults(error.stdout || '');
            console.log(`❌ Integration tests failed: ${this.testResults.integration.passed}/${this.testResults.integration.total} passed`);
            return false;
        }
    }

    async checkServers() {
        try {
            const http = require('http');
            
            // Check backend server
            const backendCheck = new Promise((resolve) => {
                const req = http.get('http://localhost:5000/test', (res) => {
                    resolve(true);
                });
                req.on('error', () => resolve(false));
                req.setTimeout(2000, () => {
                    req.destroy();
                    resolve(false);
                });
            });

            // Check frontend server
            const frontendCheck = new Promise((resolve) => {
                const req = http.get('http://localhost:5500', (res) => {
                    resolve(true);
                });
                req.on('error', () => resolve(false));
                req.setTimeout(2000, () => {
                    req.destroy();
                    resolve(false);
                });
            });

            const [backendRunning, frontendRunning] = await Promise.all([backendCheck, frontendCheck]);
            return backendRunning && frontendRunning;
        } catch (error) {
            return false;
        }
    }

    async startServers() {
        console.log('🚀 Starting development servers...');
        
        // Start backend server
        console.log('Starting backend server...');
        const backendProcess = spawn('node', ['server/server-clean.js'], {
            stdio: 'pipe',
            detached: true,
            cwd: process.cwd()
        });

        // Start frontend server
        console.log('Starting frontend server...');
        const frontendProcess = spawn('npx', ['live-server', '--port=5500', '--no-browser'], {
            stdio: 'pipe',
            detached: true,
            cwd: process.cwd()
        });

        // Wait for servers to start
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        console.log('✅ Servers started');
        return { backendProcess, frontendProcess };
    }

    generateReport() {
        console.log('\n📊 Test Results Summary');
        console.log('=' .repeat(50));
        
        const { unit, integration, coverage } = this.testResults;
        
        console.log('\n📋 Unit Tests:');
        console.log(`   Passed: ${unit.passed}`);
        console.log(`   Failed: ${unit.failed}`);
        console.log(`   Total:  ${unit.total}`);
        console.log(`   Success Rate: ${unit.total > 0 ? ((unit.passed / unit.total) * 100).toFixed(1) : 0}%`);
        
        console.log('\n🔗 Integration Tests:');
        console.log(`   Passed: ${integration.passed}`);
        console.log(`   Failed: ${integration.failed}`);
        console.log(`   Total:  ${integration.total}`);
        console.log(`   Success Rate: ${integration.total > 0 ? ((integration.passed / integration.total) * 100).toFixed(1) : 0}%`);
        
        console.log('\n📊 Code Coverage:');
        console.log(`   Statements: ${coverage.statements}%`);
        console.log(`   Branches:   ${coverage.branches}%`);
        console.log(`   Functions:  ${coverage.functions}%`);
        console.log(`   Lines:      ${coverage.lines}%`);
        
        const totalPassed = unit.passed + integration.passed;
        const totalTests = unit.total + integration.total;
        const overallSuccess = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : 0;
        
        console.log('\n🎯 Overall Results:');
        console.log(`   Total Tests: ${totalTests}`);
        console.log(`   Total Passed: ${totalPassed}`);
        console.log(`   Overall Success Rate: ${overallSuccess}%`);
        
        // Generate JSON report
        const report = {
            timestamp: new Date().toISOString(),
            results: this.testResults,
            summary: {
                totalTests,
                totalPassed,
                overallSuccessRate: parseFloat(overallSuccess)
            }
        };
        
        fs.writeFileSync('test-results.json', JSON.stringify(report, null, 2));
        console.log('\n📄 Detailed report saved to test-results.json');
        
        return overallSuccess >= 80; // Consider 80% as passing threshold
    }

    async run() {
        console.log('🧪 SecureGov Test Suite');
        console.log('=' .repeat(50));
        console.log(`Started at: ${new Date().toISOString()}`);
        
        const startTime = Date.now();
        
        // Run all test suites
        const unitSuccess = await this.runUnitTests();
        const coverageSuccess = await this.runCoverageTests();
        const integrationSuccess = await this.runIntegrationTests();
        
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        
        console.log(`\n⏱️  Total execution time: ${duration}s`);
        
        // Generate final report
        const overallSuccess = this.generateReport();
        
        if (overallSuccess) {
            console.log('\n🎉 All tests completed successfully!');
            process.exit(0);
        } else {
            console.log('\n❌ Some tests failed. Please review the results above.');
            process.exit(1);
        }
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    const runner = new TestRunner();
    runner.run().catch(error => {
        console.error('Test runner failed:', error);
        process.exit(1);
    });
}

module.exports = TestRunner;
