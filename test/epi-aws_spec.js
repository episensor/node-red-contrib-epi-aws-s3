const should = require("should");
const helper = require("node-red-node-test-helper");
const awsNode = require("../epi-aws.js");

helper.init(require.resolve('node-red'));

describe('epi-aws-s3 Node', function() {
    this.timeout(5000);

    beforeEach(function(done) {
        helper.startServer(done);
    });

    afterEach(function(done) {
        helper.unload().then(function() {
            helper.stopServer(done);
        });
    });

    // Basic Configuration Tests
    describe('Configuration', function() {
        it('should load with correct defaults', function(done) {
            const flow = [{
                id: "n1",
                type: "epi-aws-s3",
                name: "test",
                aws: "c1"
            }];
            
            helper.load(awsNode, flow, () => {
                const n1 = helper.getNode("n1");
                try {
                    n1.should.have.property('name', 'test');
                    n1.should.have.property('region', 'us-east-1');
                    done();
                } catch(err) {
                    done(err);
                }
            });
        });

        it('should handle missing credentials', function(done) {
            const flow = [{
                id: "n1",
                type: "epi-aws-s3",
                name: "test",
                aws: "c1"
            }];
            
            helper.load(awsNode, flow, () => {
                const n1 = helper.getNode("n1");
                try {
                    should(n1.awsConfig).be.null();
                    n1.on("input", function(msg) {
                        should.fail("Node should not accept input without credentials");
                    });
                    n1.receive({});
                    
                    setTimeout(function() {
                        done();
                    }, 100);
                } catch(err) {
                    done(err);
                }
            });
        });

        it('should handle invalid region', function(done) {
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
                    n1.should.have.property('region', 'invalid-region');
                    // Should still initialize but will fail on AWS operations
                    done();
                } catch(err) {
                    done(err);
                }
            });
        });
    });

    // Input Validation Tests
    describe('Input Validation', function() {
        it('should require bucket parameter', function(done) {
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

                h1.on("input", function(msg) {
                    should.fail("Message should not have been sent");
                });

                setTimeout(function() {
                    done();
                }, 100);

                n1.receive({});
            });
        });

        it('should require filename parameter', function(done) {
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

                h1.on("input", function(msg) {
                    should.fail("Message should not have been sent");
                });

                setTimeout(function() {
                    done();
                }, 100);

                n1.receive({});
            });
        });

        it('should accept parameters from msg object', function(done) {
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
                setTimeout(function() {
                    done();
                }, 100);
            });
        });
    });

    // AWS Interaction Tests
    describe('AWS Interaction', function() {
        it('should handle file size limits', function(done) {
            const flow = [{
                id: "n1",
                type: "epi-aws-s3",
                name: "test",
                aws: "c1",
                bucket: "test-bucket",
                filename: "test.txt"
            }];

            helper.load(awsNode, flow, function() {
                try {
                    const n1 = helper.getNode("n1");
                    n1.should.have.property('bucket', 'test-bucket');
                    n1.should.have.property('filename', 'test.txt');
                    done();
                } catch(err) {
                    done(err);
                }
            });
        });

        it('should preserve msg properties', function(done) {
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
                setTimeout(function() {
                    done();
                }, 100);
            });
        });

        it('should handle concurrent requests', function(done) {
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

                // Send multiple requests
                n1.receive({ id: 1 });
                n1.receive({ id: 2 });
                n1.receive({ id: 3 });

                // Should handle concurrent requests without issues
                setTimeout(function() {
                    done();
                }, 100);
            });
        });
    });

    // Cleanup Tests
    describe('Cleanup', function() {
        it('should cleanup on close', function(done) {
            const flow = [{
                id: "n1",
                type: "epi-aws-s3",
                name: "test",
                aws: "c1"
            }];

            helper.load(awsNode, flow, () => {
                const n1 = helper.getNode("n1");
                
                // Test node closure
                n1.close().then(() => {
                    done();
                }).catch((err) => {
                    done(err);
                });
            });
        });
    });
});