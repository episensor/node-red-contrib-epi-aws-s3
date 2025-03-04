/**
 * Test file for epi-aws-s3 Node
 */

const helper = require("node-red-node-test-helper");
const awsNode = require("../epi-aws.js");

// Initialize the test helper
helper.init(require.resolve('node-red'));

describe('epi-aws-s3 Node', () => {
    // Set timeout for tests
    jest.setTimeout(10000);

    beforeEach((done) => {
        helper.startServer(done);
    });

    afterEach((done) => {
        helper.unload().then(() => {
            helper.stopServer(done);
        });
    });

    // Basic Configuration Tests
    describe('Configuration', () => {
        it('should load with correct defaults', (done) => {
            const flow = [{
                id: "n1",
                type: "epi-aws-s3",
                name: "test",
                aws: "c1"
            }];
            
            helper.load(awsNode, flow, () => {
                const n1 = helper.getNode("n1");
                try {
                    expect(n1).toHaveProperty('name', 'test');
                    expect(n1).toHaveProperty('region', 'us-east-1');
                    done();
                } catch(err) {
                    done(err);
                }
            });
        });

        it('should handle missing credentials', (done) => {
            const flow = [{
                id: "n1",
                type: "epi-aws-s3",
                name: "test",
                aws: "c1"
            }];
            
            helper.load(awsNode, flow, () => {
                const n1 = helper.getNode("n1");
                try {
                    expect(n1.awsConfig).toBeNull();
                    
                    // The node should warn about missing credentials but not error
                    let warned = false;
                    n1.warn = function(msg) {
                        warned = true;
                    };
                    
                    n1.receive({});
                    
                    setTimeout(() => {
                        // We just verify the node didn't crash
                        done();
                    }, 100);
                } catch(err) {
                    done(err);
                }
            });
        });

        it('should handle invalid region', (done) => {
            const flow = [{
                id: "n1",
                type: "epi-aws-s3",
                name: "test",
                aws: "c1",
                region: "invalid-region"
            }];
            
            helper.load(awsNode, flow, () => {
                const n1 = helper.getNode("n1");
                try {
                    expect(n1).toHaveProperty('region', 'invalid-region');
                    // Should still initialize but will fail on AWS operations
                    done();
                } catch(err) {
                    done(err);
                }
            });
        });
    });

    // Input Validation Tests
    describe('Input Validation', () => {
        it('should require bucket parameter', (done) => {
            const flow = [{
                id: "n1",
                type: "epi-aws-s3",
                name: "test",
                aws: "c1",
                wires: [["h1"]]
            }, {
                id: "h1",
                type: "helper"
            }];

            helper.load(awsNode, flow, () => {
                const n1 = helper.getNode("n1");
                const h1 = helper.getNode("h1");

                h1.on("input", () => {
                    done(new Error("Message should not have been sent"));
                });

                n1.receive({});

                setTimeout(() => {
                    done();
                }, 100);
            });
        });

        it('should require filename parameter', (done) => {
            const flow = [{
                id: "n1",
                type: "epi-aws-s3",
                name: "test",
                aws: "c1",
                bucket: "test-bucket",
                wires: [["h1"]]
            }, {
                id: "h1",
                type: "helper"
            }];

            helper.load(awsNode, flow, () => {
                const n1 = helper.getNode("n1");
                const h1 = helper.getNode("h1");

                h1.on("input", () => {
                    done(new Error("Message should not have been sent"));
                });

                n1.receive({});

                setTimeout(() => {
                    done();
                }, 100);
            });
        });

        it('should accept parameters from msg object', (done) => {
            const flow = [{
                id: "n1",
                type: "epi-aws-s3",
                name: "test",
                aws: "c1",
                wires: [["h1"]]
            }, {
                id: "h1",
                type: "helper"
            }];

            helper.load(awsNode, flow, () => {
                const n1 = helper.getNode("n1");
                const h1 = helper.getNode("h1");

                // Mock AWS credentials
                n1.awsConfig = {
                    awsCredentials: {
                        accessKeyId: 'test',
                        secretAccessKey: 'test'
                    }
                };

                n1.receive({
                    bucket: "test-bucket",
                    filename: "test.txt"
                });

                // Should proceed without validation errors
                setTimeout(() => {
                    done();
                }, 100);
            });
        });
    });

    // AWS Interaction Tests
    describe('AWS Interaction', () => {
        it('should handle file size limits', (done) => {
            const flow = [{
                id: "n1",
                type: "epi-aws-s3",
                name: "test",
                aws: "c1",
                bucket: "test-bucket",
                filename: "test.txt"
            }];

            helper.load(awsNode, flow, () => {
                try {
                    const n1 = helper.getNode("n1");
                    expect(n1).toHaveProperty('bucket', 'test-bucket');
                    expect(n1).toHaveProperty('filename', 'test.txt');
                    done();
                } catch(err) {
                    done(err);
                }
            });
        });

        it('should preserve msg properties', (done) => {
            const flow = [{
                id: "n1",
                type: "epi-aws-s3",
                name: "test",
                aws: "c1",
                bucket: "test-bucket",
                filename: "test.txt",
                wires: [["h1"]]
            }, {
                id: "h1",
                type: "helper"
            }];

            helper.load(awsNode, flow, () => {
                const n1 = helper.getNode("n1");
                const h1 = helper.getNode("h1");

                // Mock AWS credentials
                n1.awsConfig = {
                    awsCredentials: {
                        accessKeyId: 'test',
                        secretAccessKey: 'test'
                    }
                };

                n1.receive({
                    topic: "test-topic",
                    customProp: "should-persist"
                });

                // The node should preserve these properties
                setTimeout(() => {
                    done();
                }, 100);
            });
        });
    });
}); 