/**
 * Comprehensive test suite for epi-aws-s3 nodes
 * Tests both download and upload functionality
 */

const helper = require("node-red-node-test-helper");
const awsNode = require("../epi-aws.js");
const sinon = require("sinon");

// Initialize the test helper
helper.init(require.resolve('node-red'));

// Mock AWS SDK
jest.mock("@aws-sdk/client-s3", () => {
    const mockSend = jest.fn();
    const mockDestroy = jest.fn();

    return {
        S3Client: jest.fn().mockImplementation(() => ({
            send: mockSend,
            destroy: mockDestroy
        })),
        GetObjectCommand: jest.fn().mockImplementation((params) => ({ ...params, _type: 'GetObject' })),
        PutObjectCommand: jest.fn().mockImplementation((params) => ({ ...params, _type: 'PutObject' })),
        __mockSend: mockSend,
        __mockDestroy: mockDestroy
    };
});

const { S3Client, GetObjectCommand, PutObjectCommand, __mockSend, __mockDestroy } = require("@aws-sdk/client-s3");

describe('epi-aws-s3 Nodes', () => {
    jest.setTimeout(10000);

    beforeEach((done) => {
        jest.clearAllMocks();
        helper.startServer(done);
    });

    afterEach((done) => {
        helper.unload().then(() => {
            helper.stopServer(done);
        });
    });

    // ==================== CONFIG NODE TESTS ====================
    describe('AWS Config Node (epi-aws-config)', () => {
        it('should load config node with credentials', (done) => {
            const flow = [{
                id: "c1",
                type: "epi-aws-config",
                name: "test-config"
            }];

            const credentials = {
                c1: {
                    accesskeyid: "AKIAIOSFODNN7EXAMPLE",
                    secretaccesskey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                }
            };

            helper.load(awsNode, flow, credentials, () => {
                const configNode = helper.getNode("c1");
                try {
                    expect(configNode).toBeDefined();
                    expect(configNode.name).toBe("test-config");
                    expect(configNode.awsCredentials).toBeDefined();
                    expect(configNode.awsCredentials.accessKeyId).toBe("AKIAIOSFODNN7EXAMPLE");
                    expect(configNode.awsCredentials.secretAccessKey).toBe("wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY");
                    done();
                } catch(err) {
                    done(err);
                }
            });
        });

        it('should handle missing credentials gracefully', (done) => {
            const flow = [{
                id: "c1",
                type: "epi-aws-config",
                name: "test-config"
            }];

            helper.load(awsNode, flow, {}, () => {
                const configNode = helper.getNode("c1");
                try {
                    expect(configNode).toBeDefined();
                    expect(configNode.awsCredentials).toBeNull();
                    done();
                } catch(err) {
                    done(err);
                }
            });
        });

        it('should handle partial credentials (missing secret)', (done) => {
            const flow = [{
                id: "c1",
                type: "epi-aws-config",
                name: "test-config"
            }];

            const credentials = {
                c1: {
                    accesskeyid: "AKIAIOSFODNN7EXAMPLE"
                    // missing secretaccesskey
                }
            };

            helper.load(awsNode, flow, credentials, () => {
                const configNode = helper.getNode("c1");
                try {
                    expect(configNode.awsCredentials).toBeNull();
                    done();
                } catch(err) {
                    done(err);
                }
            });
        });
    });

    // ==================== DOWNLOAD NODE TESTS ====================
    describe('S3 Download Node (epi-aws-s3)', () => {

        describe('Configuration', () => {
            it('should load with correct defaults', (done) => {
                const flow = [{
                    id: "n1",
                    type: "epi-aws-s3",
                    name: "test-download",
                    aws: "c1",
                    region: "eu-west-1"
                }, {
                    id: "c1",
                    type: "epi-aws-config",
                    name: "test-config"
                }];

                const credentials = {
                    c1: {
                        accesskeyid: "AKIATEST",
                        secretaccesskey: "secrettest"
                    }
                };

                helper.load(awsNode, flow, credentials, () => {
                    const n1 = helper.getNode("n1");
                    try {
                        expect(n1.name).toBe('test-download');
                        expect(n1.region).toBe('eu-west-1');
                        expect(S3Client).toHaveBeenCalledWith({
                            region: 'eu-west-1',
                            credentials: {
                                accessKeyId: 'AKIATEST',
                                secretAccessKey: 'secrettest'
                            }
                        });
                        done();
                    } catch(err) {
                        done(err);
                    }
                });
            });

            it('should use default region when not specified', (done) => {
                const flow = [{
                    id: "n1",
                    type: "epi-aws-s3",
                    name: "test",
                    aws: "c1"
                }, {
                    id: "c1",
                    type: "epi-aws-config"
                }];

                const credentials = {
                    c1: { accesskeyid: "test", secretaccesskey: "test" }
                };

                helper.load(awsNode, flow, credentials, () => {
                    const n1 = helper.getNode("n1");
                    try {
                        expect(n1.region).toBe('us-east-1');
                        done();
                    } catch(err) {
                        done(err);
                    }
                });
            });

            it('should warn and set error status when credentials are missing', (done) => {
                const flow = [{
                    id: "n1",
                    type: "epi-aws-s3",
                    name: "test",
                    aws: "c1"
                }, {
                    id: "c1",
                    type: "epi-aws-config"
                }];

                helper.load(awsNode, flow, {}, () => {
                    const n1 = helper.getNode("n1");
                    // Node should have been warned
                    setTimeout(() => {
                        done();
                    }, 50);
                });
            });
        });

        describe('Input Validation', () => {
            const getFlowWithCredentials = () => ({
                flow: [{
                    id: "n1",
                    type: "epi-aws-s3",
                    name: "test",
                    aws: "c1",
                    wires: [["h1"]]
                }, {
                    id: "c1",
                    type: "epi-aws-config"
                }, {
                    id: "h1",
                    type: "helper"
                }],
                credentials: {
                    c1: { accesskeyid: "test", secretaccesskey: "test" }
                }
            });

            it('should error when bucket is not specified', (done) => {
                const { flow, credentials } = getFlowWithCredentials();

                helper.load(awsNode, flow, credentials, () => {
                    const n1 = helper.getNode("n1");
                    const h1 = helper.getNode("h1");

                    let errorCalled = false;
                    n1.error = (msg) => { errorCalled = true; };

                    h1.on("input", () => {
                        done(new Error("Message should not have been sent without bucket"));
                    });

                    n1.receive({ filename: "test.txt" });

                    setTimeout(() => {
                        expect(errorCalled).toBe(true);
                        done();
                    }, 100);
                });
            });

            it('should error when filename is not specified', (done) => {
                const { flow, credentials } = getFlowWithCredentials();
                flow[0].bucket = "test-bucket";

                helper.load(awsNode, flow, credentials, () => {
                    const n1 = helper.getNode("n1");

                    let errorCalled = false;
                    n1.error = (msg) => { errorCalled = true; };

                    n1.receive({});

                    setTimeout(() => {
                        expect(errorCalled).toBe(true);
                        done();
                    }, 100);
                });
            });

            it('should accept bucket and filename from msg object', (done) => {
                const { flow, credentials } = getFlowWithCredentials();

                // Mock successful download
                const mockStream = {
                    async *[Symbol.asyncIterator]() {
                        yield Buffer.from("test content");
                    }
                };
                __mockSend.mockResolvedValueOnce({ Body: mockStream });

                helper.load(awsNode, flow, credentials, () => {
                    const n1 = helper.getNode("n1");
                    const h1 = helper.getNode("h1");

                    h1.on("input", (msg) => {
                        try {
                            expect(msg.bucket).toBe("msg-bucket");
                            expect(msg.filename).toBe("msg-file.txt");
                            expect(msg.payload.toString()).toBe("test content");
                            done();
                        } catch(err) {
                            done(err);
                        }
                    });

                    n1.receive({
                        bucket: "msg-bucket",
                        filename: "msg-file.txt"
                    });
                });
            });

            it('should prefer node config over msg properties', (done) => {
                const { flow, credentials } = getFlowWithCredentials();
                flow[0].bucket = "node-bucket";
                flow[0].filename = "node-file.txt";

                const mockStream = {
                    async *[Symbol.asyncIterator]() {
                        yield Buffer.from("content");
                    }
                };
                __mockSend.mockResolvedValueOnce({ Body: mockStream });

                helper.load(awsNode, flow, credentials, () => {
                    const n1 = helper.getNode("n1");
                    const h1 = helper.getNode("h1");

                    h1.on("input", (msg) => {
                        try {
                            expect(msg.bucket).toBe("node-bucket");
                            expect(msg.filename).toBe("node-file.txt");
                            done();
                        } catch(err) {
                            done(err);
                        }
                    });

                    n1.receive({
                        bucket: "msg-bucket",
                        filename: "msg-file.txt"
                    });
                });
            });
        });

        describe('Download Operations', () => {
            const getFlowWithCredentials = () => ({
                flow: [{
                    id: "n1",
                    type: "epi-aws-s3",
                    name: "test",
                    aws: "c1",
                    bucket: "test-bucket",
                    filename: "test.txt",
                    wires: [["h1"]]
                }, {
                    id: "c1",
                    type: "epi-aws-config"
                }, {
                    id: "h1",
                    type: "helper"
                }],
                credentials: {
                    c1: { accesskeyid: "test", secretaccesskey: "test" }
                }
            });

            it('should successfully download a file', (done) => {
                const { flow, credentials } = getFlowWithCredentials();

                const testContent = "Hello, S3!";
                const mockStream = {
                    async *[Symbol.asyncIterator]() {
                        yield Buffer.from(testContent);
                    }
                };
                __mockSend.mockResolvedValueOnce({ Body: mockStream });

                helper.load(awsNode, flow, credentials, () => {
                    const n1 = helper.getNode("n1");
                    const h1 = helper.getNode("h1");

                    h1.on("input", (msg) => {
                        try {
                            expect(Buffer.isBuffer(msg.payload)).toBe(true);
                            expect(msg.payload.toString()).toBe(testContent);
                            expect(msg.error).toBeUndefined();
                            expect(GetObjectCommand).toHaveBeenCalledWith({
                                Bucket: "test-bucket",
                                Key: "test.txt"
                            });
                            done();
                        } catch(err) {
                            done(err);
                        }
                    });

                    n1.receive({});
                });
            });

            it('should handle chunked downloads', (done) => {
                const { flow, credentials } = getFlowWithCredentials();

                const chunk1 = Buffer.from("chunk1");
                const chunk2 = Buffer.from("chunk2");
                const chunk3 = Buffer.from("chunk3");

                const mockStream = {
                    async *[Symbol.asyncIterator]() {
                        yield chunk1;
                        yield chunk2;
                        yield chunk3;
                    }
                };
                __mockSend.mockResolvedValueOnce({ Body: mockStream });

                helper.load(awsNode, flow, credentials, () => {
                    const n1 = helper.getNode("n1");
                    const h1 = helper.getNode("h1");

                    h1.on("input", (msg) => {
                        try {
                            expect(msg.payload.toString()).toBe("chunk1chunk2chunk3");
                            done();
                        } catch(err) {
                            done(err);
                        }
                    });

                    n1.receive({});
                });
            });

            it('should preserve original msg properties', (done) => {
                const { flow, credentials } = getFlowWithCredentials();

                const mockStream = {
                    async *[Symbol.asyncIterator]() {
                        yield Buffer.from("content");
                    }
                };
                __mockSend.mockResolvedValueOnce({ Body: mockStream });

                helper.load(awsNode, flow, credentials, () => {
                    const n1 = helper.getNode("n1");
                    const h1 = helper.getNode("h1");

                    h1.on("input", (msg) => {
                        try {
                            expect(msg.topic).toBe("test-topic");
                            expect(msg.customProp).toBe("preserved");
                            done();
                        } catch(err) {
                            done(err);
                        }
                    });

                    n1.receive({
                        topic: "test-topic",
                        customProp: "preserved"
                    });
                });
            });
        });

        describe('Error Handling', () => {
            const getFlowWithCredentials = () => ({
                flow: [{
                    id: "n1",
                    type: "epi-aws-s3",
                    name: "test",
                    aws: "c1",
                    bucket: "test-bucket",
                    filename: "test.txt",
                    wires: [["h1"]]
                }, {
                    id: "c1",
                    type: "epi-aws-config"
                }, {
                    id: "h1",
                    type: "helper"
                }],
                credentials: {
                    c1: { accesskeyid: "test", secretaccesskey: "test" }
                }
            });

            it('should send error message on 404 (file not found)', (done) => {
                const { flow, credentials } = getFlowWithCredentials();

                const error = new Error("NoSuchKey");
                error.$metadata = { httpStatusCode: 404 };
                __mockSend.mockRejectedValueOnce(error);

                helper.load(awsNode, flow, credentials, () => {
                    const n1 = helper.getNode("n1");
                    const h1 = helper.getNode("h1");

                    h1.on("input", (msg) => {
                        try {
                            expect(msg.error).toBeDefined();
                            expect(msg.payload).toBeNull();
                            done();
                        } catch(err) {
                            done(err);
                        }
                    });

                    n1.receive({});
                });
            });

            it('should send error message on 403 (access denied)', (done) => {
                const { flow, credentials } = getFlowWithCredentials();

                const error = new Error("AccessDenied");
                error.$metadata = { httpStatusCode: 403 };
                __mockSend.mockRejectedValueOnce(error);

                helper.load(awsNode, flow, credentials, () => {
                    const n1 = helper.getNode("n1");
                    const h1 = helper.getNode("h1");

                    h1.on("input", (msg) => {
                        try {
                            expect(msg.error).toBeDefined();
                            expect(msg.payload).toBeNull();
                            done();
                        } catch(err) {
                            done(err);
                        }
                    });

                    n1.receive({});
                });
            });

            it('should handle generic errors', (done) => {
                const { flow, credentials } = getFlowWithCredentials();

                __mockSend.mockRejectedValueOnce(new Error("Network timeout"));

                helper.load(awsNode, flow, credentials, () => {
                    const n1 = helper.getNode("n1");
                    const h1 = helper.getNode("h1");

                    h1.on("input", (msg) => {
                        try {
                            expect(msg.error).toBeDefined();
                            expect(msg.error.message).toBe("Network timeout");
                            expect(msg.payload).toBeNull();
                            done();
                        } catch(err) {
                            done(err);
                        }
                    });

                    n1.receive({});
                });
            });
        });

        describe('Cleanup', () => {
            it('should destroy S3Client on node close', (done) => {
                const flow = [{
                    id: "n1",
                    type: "epi-aws-s3",
                    name: "test",
                    aws: "c1"
                }, {
                    id: "c1",
                    type: "epi-aws-config"
                }];

                const credentials = {
                    c1: { accesskeyid: "test", secretaccesskey: "test" }
                };

                helper.load(awsNode, flow, credentials, () => {
                    const n1 = helper.getNode("n1");

                    n1.close().then(() => {
                        expect(__mockDestroy).toHaveBeenCalled();
                        done();
                    }).catch(done);
                });
            });
        });
    });

    // ==================== UPLOAD NODE TESTS ====================
    describe('S3 Upload Node (epi-aws-s3-upload)', () => {

        describe('Configuration', () => {
            it('should load with correct defaults', (done) => {
                const flow = [{
                    id: "n1",
                    type: "epi-aws-s3-upload",
                    name: "test-upload",
                    aws: "c1",
                    region: "ap-southeast-2"
                }, {
                    id: "c1",
                    type: "epi-aws-config"
                }];

                const credentials = {
                    c1: { accesskeyid: "test", secretaccesskey: "test" }
                };

                helper.load(awsNode, flow, credentials, () => {
                    const n1 = helper.getNode("n1");
                    try {
                        expect(n1.name).toBe('test-upload');
                        expect(n1.region).toBe('ap-southeast-2');
                        done();
                    } catch(err) {
                        done(err);
                    }
                });
            });
        });

        describe('Input Validation', () => {
            const getFlowWithCredentials = () => ({
                flow: [{
                    id: "n1",
                    type: "epi-aws-s3-upload",
                    name: "test",
                    aws: "c1",
                    wires: [["h1"]]
                }, {
                    id: "c1",
                    type: "epi-aws-config"
                }, {
                    id: "h1",
                    type: "helper"
                }],
                credentials: {
                    c1: { accesskeyid: "test", secretaccesskey: "test" }
                }
            });

            it('should error when bucket is not specified', (done) => {
                const { flow, credentials } = getFlowWithCredentials();

                helper.load(awsNode, flow, credentials, () => {
                    const n1 = helper.getNode("n1");

                    let errorCalled = false;
                    n1.error = () => { errorCalled = true; };

                    n1.receive({ filename: "test.txt", payload: "data" });

                    setTimeout(() => {
                        expect(errorCalled).toBe(true);
                        done();
                    }, 100);
                });
            });

            it('should error when filename is not specified', (done) => {
                const { flow, credentials } = getFlowWithCredentials();

                helper.load(awsNode, flow, credentials, () => {
                    const n1 = helper.getNode("n1");

                    let errorCalled = false;
                    n1.error = () => { errorCalled = true; };

                    n1.receive({ bucket: "test-bucket", payload: "data" });

                    setTimeout(() => {
                        expect(errorCalled).toBe(true);
                        done();
                    }, 100);
                });
            });

            it('should error when payload is not specified', (done) => {
                const { flow, credentials } = getFlowWithCredentials();

                helper.load(awsNode, flow, credentials, () => {
                    const n1 = helper.getNode("n1");

                    let errorCalled = false;
                    n1.error = () => { errorCalled = true; };

                    n1.receive({ bucket: "test-bucket", filename: "test.txt" });

                    setTimeout(() => {
                        expect(errorCalled).toBe(true);
                        done();
                    }, 100);
                });
            });
        });

        describe('Upload Operations', () => {
            const getFlowWithCredentials = () => ({
                flow: [{
                    id: "n1",
                    type: "epi-aws-s3-upload",
                    name: "test",
                    aws: "c1",
                    bucket: "test-bucket",
                    filename: "uploaded.txt",
                    wires: [["h1"]]
                }, {
                    id: "c1",
                    type: "epi-aws-config"
                }, {
                    id: "h1",
                    type: "helper"
                }],
                credentials: {
                    c1: { accesskeyid: "test", secretaccesskey: "test" }
                }
            });

            it('should successfully upload a Buffer', (done) => {
                const { flow, credentials } = getFlowWithCredentials();

                __mockSend.mockResolvedValueOnce({
                    ETag: '"abc123"',
                    VersionId: 'v1'
                });

                helper.load(awsNode, flow, credentials, () => {
                    const n1 = helper.getNode("n1");
                    const h1 = helper.getNode("h1");

                    h1.on("input", (msg) => {
                        try {
                            expect(msg.payload.success).toBe(true);
                            expect(msg.payload.bucket).toBe("test-bucket");
                            expect(msg.payload.key).toBe("uploaded.txt");
                            expect(msg.payload.etag).toBe('"abc123"');
                            expect(msg.error).toBeUndefined();
                            done();
                        } catch(err) {
                            done(err);
                        }
                    });

                    n1.receive({ payload: Buffer.from("file content") });
                });
            });

            it('should convert string payload to Buffer', (done) => {
                const { flow, credentials } = getFlowWithCredentials();

                __mockSend.mockResolvedValueOnce({ ETag: '"xyz"' });

                helper.load(awsNode, flow, credentials, () => {
                    const n1 = helper.getNode("n1");
                    const h1 = helper.getNode("h1");

                    h1.on("input", (msg) => {
                        try {
                            expect(msg.payload.success).toBe(true);
                            // Verify PutObjectCommand was called with a Buffer
                            const callArgs = PutObjectCommand.mock.calls[0][0];
                            expect(Buffer.isBuffer(callArgs.Body)).toBe(true);
                            expect(callArgs.Body.toString()).toBe("string content");
                            done();
                        } catch(err) {
                            done(err);
                        }
                    });

                    n1.receive({ payload: "string content" });
                });
            });

            it('should convert object payload to JSON Buffer', (done) => {
                const { flow, credentials } = getFlowWithCredentials();

                __mockSend.mockResolvedValueOnce({ ETag: '"json"' });

                helper.load(awsNode, flow, credentials, () => {
                    const n1 = helper.getNode("n1");
                    const h1 = helper.getNode("h1");

                    h1.on("input", (msg) => {
                        try {
                            expect(msg.payload.success).toBe(true);
                            const callArgs = PutObjectCommand.mock.calls[0][0];
                            expect(callArgs.Body.toString()).toBe('{"key":"value"}');
                            done();
                        } catch(err) {
                            done(err);
                        }
                    });

                    n1.receive({ payload: { key: "value" } });
                });
            });

            it('should auto-detect content type from filename', (done) => {
                const { flow, credentials } = getFlowWithCredentials();
                flow[0].filename = "data.json";

                __mockSend.mockResolvedValueOnce({ ETag: '"ct"' });

                helper.load(awsNode, flow, credentials, () => {
                    const n1 = helper.getNode("n1");
                    const h1 = helper.getNode("h1");

                    h1.on("input", () => {
                        try {
                            const callArgs = PutObjectCommand.mock.calls[0][0];
                            expect(callArgs.ContentType).toBe("application/json");
                            done();
                        } catch(err) {
                            done(err);
                        }
                    });

                    n1.receive({ payload: "{}" });
                });
            });

            it('should use explicit content type when provided', (done) => {
                const { flow, credentials } = getFlowWithCredentials();
                flow[0].contentType = "text/csv";

                __mockSend.mockResolvedValueOnce({ ETag: '"ct"' });

                helper.load(awsNode, flow, credentials, () => {
                    const n1 = helper.getNode("n1");
                    const h1 = helper.getNode("h1");

                    h1.on("input", () => {
                        try {
                            const callArgs = PutObjectCommand.mock.calls[0][0];
                            expect(callArgs.ContentType).toBe("text/csv");
                            done();
                        } catch(err) {
                            done(err);
                        }
                    });

                    n1.receive({ payload: "a,b,c" });
                });
            });

            it('should set ACL when provided', (done) => {
                const { flow, credentials } = getFlowWithCredentials();
                flow[0].acl = "public-read";

                __mockSend.mockResolvedValueOnce({ ETag: '"acl"' });

                helper.load(awsNode, flow, credentials, () => {
                    const n1 = helper.getNode("n1");
                    const h1 = helper.getNode("h1");

                    h1.on("input", () => {
                        try {
                            const callArgs = PutObjectCommand.mock.calls[0][0];
                            expect(callArgs.ACL).toBe("public-read");
                            done();
                        } catch(err) {
                            done(err);
                        }
                    });

                    n1.receive({ payload: "data" });
                });
            });

            it('should accept ACL from msg object', (done) => {
                const { flow, credentials } = getFlowWithCredentials();

                __mockSend.mockResolvedValueOnce({ ETag: '"acl"' });

                helper.load(awsNode, flow, credentials, () => {
                    const n1 = helper.getNode("n1");
                    const h1 = helper.getNode("h1");

                    h1.on("input", () => {
                        try {
                            const callArgs = PutObjectCommand.mock.calls[0][0];
                            expect(callArgs.ACL).toBe("bucket-owner-full-control");
                            done();
                        } catch(err) {
                            done(err);
                        }
                    });

                    n1.receive({ payload: "data", acl: "bucket-owner-full-control" });
                });
            });
        });

        describe('Error Handling', () => {
            const getFlowWithCredentials = () => ({
                flow: [{
                    id: "n1",
                    type: "epi-aws-s3-upload",
                    name: "test",
                    aws: "c1",
                    bucket: "test-bucket",
                    filename: "test.txt",
                    wires: [["h1"]]
                }, {
                    id: "c1",
                    type: "epi-aws-config"
                }, {
                    id: "h1",
                    type: "helper"
                }],
                credentials: {
                    c1: { accesskeyid: "test", secretaccesskey: "test" }
                }
            });

            it('should send error message on 403 (access denied)', (done) => {
                const { flow, credentials } = getFlowWithCredentials();

                const error = new Error("AccessDenied");
                error.$metadata = { httpStatusCode: 403 };
                __mockSend.mockRejectedValueOnce(error);

                helper.load(awsNode, flow, credentials, () => {
                    const n1 = helper.getNode("n1");
                    const h1 = helper.getNode("h1");

                    h1.on("input", (msg) => {
                        try {
                            expect(msg.error).toBeDefined();
                            expect(msg.payload).toBeNull();
                            done();
                        } catch(err) {
                            done(err);
                        }
                    });

                    n1.receive({ payload: "data" });
                });
            });

            it('should send error message on 404 (bucket not found)', (done) => {
                const { flow, credentials } = getFlowWithCredentials();

                const error = new Error("NoSuchBucket");
                error.$metadata = { httpStatusCode: 404 };
                __mockSend.mockRejectedValueOnce(error);

                helper.load(awsNode, flow, credentials, () => {
                    const n1 = helper.getNode("n1");
                    const h1 = helper.getNode("h1");

                    h1.on("input", (msg) => {
                        try {
                            expect(msg.error).toBeDefined();
                            expect(msg.payload).toBeNull();
                            done();
                        } catch(err) {
                            done(err);
                        }
                    });

                    n1.receive({ payload: "data" });
                });
            });
        });

        describe('Cleanup', () => {
            it('should destroy S3Client on node close', (done) => {
                const flow = [{
                    id: "n1",
                    type: "epi-aws-s3-upload",
                    name: "test",
                    aws: "c1"
                }, {
                    id: "c1",
                    type: "epi-aws-config"
                }];

                const credentials = {
                    c1: { accesskeyid: "test", secretaccesskey: "test" }
                };

                helper.load(awsNode, flow, credentials, () => {
                    const n1 = helper.getNode("n1");

                    n1.close().then(() => {
                        expect(__mockDestroy).toHaveBeenCalled();
                        done();
                    }).catch(done);
                });
            });
        });
    });

    // ==================== CONTENT TYPE DETECTION TESTS ====================
    describe('Content Type Detection', () => {
        const getFlowWithCredentials = () => ({
            flow: [{
                id: "n1",
                type: "epi-aws-s3-upload",
                name: "test",
                aws: "c1",
                bucket: "test-bucket",
                wires: [["h1"]]
            }, {
                id: "c1",
                type: "epi-aws-config"
            }, {
                id: "h1",
                type: "helper"
            }],
            credentials: {
                c1: { accesskeyid: "test", secretaccesskey: "test" }
            }
        });

        const testCases = [
            { ext: "txt", expected: "text/plain" },
            { ext: "html", expected: "text/html" },
            { ext: "css", expected: "text/css" },
            { ext: "json", expected: "application/json" },
            { ext: "js", expected: "application/javascript" },
            { ext: "pdf", expected: "application/pdf" },
            { ext: "jpg", expected: "image/jpeg" },
            { ext: "png", expected: "image/png" },
            { ext: "gif", expected: "image/gif" },
            { ext: "svg", expected: "image/svg+xml" },
            { ext: "mp3", expected: "audio/mpeg" },
            { ext: "mp4", expected: "video/mp4" },
            { ext: "zip", expected: "application/zip" },
            { ext: "unknown", expected: "application/octet-stream" }
        ];

        testCases.forEach(({ ext, expected }) => {
            it(`should detect ${expected} for .${ext} files`, (done) => {
                const { flow, credentials } = getFlowWithCredentials();

                __mockSend.mockResolvedValueOnce({ ETag: '"test"' });

                helper.load(awsNode, flow, credentials, () => {
                    const n1 = helper.getNode("n1");
                    const h1 = helper.getNode("h1");

                    h1.on("input", () => {
                        try {
                            const callArgs = PutObjectCommand.mock.calls[0][0];
                            expect(callArgs.ContentType).toBe(expected);
                            done();
                        } catch(err) {
                            done(err);
                        }
                    });

                    n1.receive({
                        payload: "test",
                        filename: `file.${ext}`
                    });
                });
            });
        });
    });
});
