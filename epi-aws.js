/**
  Modifications Copyright 2023, 2024 EpiSensor

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.

  Copyright 2014 IBM Corp.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
**/

  module.exports = function(RED) {
    "use strict";

    // AWS SDK for JavaScript v3:
    const { S3Client, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");

    // Constants
    const MAX_DOWNLOAD_SIZE = 100 * 1024 * 1024; // 100MB for downloads
    const MAX_UPLOAD_SIZE = 5 * 1024 * 1024 * 1024; // 5GB for uploads (S3 single PUT limit)
    const DEFAULT_REGION = "us-east-1";
    const PROGRESS_UPDATE_INTERVAL = 1024 * 1024; // Update progress every 1MB

    /**
     * EpiAWSNode is the config node that holds credentials.
     */
    function EpiAWSNode(n) {
        RED.nodes.createNode(this, n);
        this.name = n.name;

        // Save credentials in a plain object, so other nodes can create an S3Client with them.
        if (this.credentials &&
            this.credentials.accesskeyid &&
            this.credentials.secretaccesskey) {
            this.awsCredentials = {
                accessKeyId: this.credentials.accesskeyid,
                secretAccessKey: this.credentials.secretaccesskey
            };
        } else {
            this.awsCredentials = null;
        }
    }

    RED.nodes.registerType("epi-aws-config", EpiAWSNode, {
        credentials: {
            accesskeyid: { type: "password" },
            secretaccesskey: { type: "password" }
        }
    });

    /**
     * EpiAmazonS3DownloadNode
     * A Node-RED node that downloads an object from S3 on input.
     */
    function EpiAmazonS3DownloadNode(n) {
        RED.nodes.createNode(this, n);

        this.awsConfig = RED.nodes.getNode(n.aws);
        this.region = n.region || DEFAULT_REGION;
        this.bucket = n.bucket;
        this.name = n.name;
        this.filename = n.filename || "";

        const node = this;
        let s3Client = null;

        // If credentials are missing, warn and stop.
        if (!this.awsConfig || !this.awsConfig.awsCredentials) {
            node.warn(RED._("aws.warn.missing-credentials"));
            node.status({ fill: "red", shape: "ring", text: "aws.status.error" });
            return;
        }

        // Create an S3Client using AWS SDK v3
        try {
            s3Client = new S3Client({
                region: node.region,
                credentials: this.awsConfig.awsCredentials
            });
            node.status({}); // Clear status on successful initialization
        } catch (err) {
            node.error(RED._("aws.error.initialization-failed", { err: err.toString() }));
            node.status({ fill: "red", shape: "ring", text: "aws.status.error" });
            return;
        }

        node.on("input", async function(msg) {
            const bucket = node.bucket || msg.bucket;
            const filename = node.filename || msg.filename;

            if (!bucket) {
                node.error(RED._("aws.error.no-bucket-specified"), msg);
                node.status({ fill: "red", shape: "dot", text: "aws.status.error" });
                return;
            }
            if (!filename) {
                node.error(RED._("aws.error.no-filename-specified"), msg);
                node.status({ fill: "red", shape: "dot", text: "aws.status.error" });
                return;
            }

            msg.bucket = bucket;
            msg.filename = filename;
            node.status({ fill: "blue", shape: "dot", text: "aws.status.downloading" });

            try {
                // Using the v3 API with async/await
                const command = new GetObjectCommand({
                    Bucket: bucket,
                    Key: filename
                });

                const response = await s3Client.send(command);

                // Process the response stream with size limits
                const chunks = [];
                let totalSize = 0;
                let lastProgressUpdate = 0;

                for await (const chunk of response.Body) {
                    totalSize += chunk.length;
                    if (totalSize > MAX_DOWNLOAD_SIZE) {
                        throw new Error(RED._("aws.error.size-limit-exceeded", { size: MAX_DOWNLOAD_SIZE / 1024 / 1024 }));
                    }
                    chunks.push(chunk);

                    // Update status every 1MB of progress
                    const currentMB = Math.floor(totalSize / PROGRESS_UPDATE_INTERVAL);
                    if (currentMB > lastProgressUpdate) {
                        lastProgressUpdate = currentMB;
                        node.status({
                            fill: "blue",
                            shape: "dot",
                            text: RED._("aws.status.download-progress", { size: currentMB + "MB" })
                        });
                    }
                }

                msg.payload = Buffer.concat(chunks);
                node.status({}); // Clear status on success
                node.send(msg);
            } catch (err) {
                msg.error = err;
                msg.payload = null;
                let errorMessage = err.message || err.toString();

                // Handle specific AWS errors while preserving original error object
                if (err.$metadata && err.$metadata.httpStatusCode) {
                    switch (err.$metadata.httpStatusCode) {
                        case 404:
                            errorMessage = RED._("aws.error.file-not-found", { filename: filename, bucket: bucket });
                            break;
                        case 403:
                            errorMessage = RED._("aws.error.access-denied");
                            break;
                        case 400:
                            errorMessage = RED._("aws.error.invalid-request");
                            break;
                    }
                }

                node.error(RED._("aws.error.download-failed", { err: errorMessage }), msg);
                node.status({ fill: "red", shape: "dot", text: "aws.status.error" });
                node.send(msg); // Send msg with error so downstream can handle it
            }
        });

        node.on("close", function(done) {
            if (s3Client) {
                s3Client.destroy();
                s3Client = null;
            }
            node.status({});
            done();
        });
    }

    RED.nodes.registerType("epi-aws-s3", EpiAmazonS3DownloadNode);

    /**
     * EpiAmazonS3UploadNode
     * A Node-RED node that uploads an object to S3 on input.
     */
    function EpiAmazonS3UploadNode(n) {
        RED.nodes.createNode(this, n);

        this.awsConfig = RED.nodes.getNode(n.aws);
        this.region = n.region || DEFAULT_REGION;
        this.bucket = n.bucket;
        this.name = n.name;
        this.filename = n.filename || "";
        this.contentType = n.contentType || "";
        this.acl = n.acl || "";

        const node = this;
        let s3Client = null;

        // If credentials are missing, warn and stop.
        if (!this.awsConfig || !this.awsConfig.awsCredentials) {
            node.warn(RED._("aws.warn.missing-credentials"));
            node.status({ fill: "red", shape: "ring", text: "aws.status.error" });
            return;
        }

        // Create an S3Client using AWS SDK v3
        try {
            s3Client = new S3Client({
                region: node.region,
                credentials: this.awsConfig.awsCredentials
            });
            node.status({}); // Clear status on successful initialization
        } catch (err) {
            node.error(RED._("aws.error.initialization-failed", { err: err.toString() }));
            node.status({ fill: "red", shape: "ring", text: "aws.status.error" });
            return;
        }

        node.on("input", async function(msg) {
            const bucket = node.bucket || msg.bucket;
            const filename = node.filename || msg.filename;
            const contentType = node.contentType || msg.contentType || detectContentType(filename);
            const acl = node.acl || msg.acl;

            if (!bucket) {
                node.error(RED._("aws.error.no-bucket-specified"), msg);
                node.status({ fill: "red", shape: "dot", text: "aws.status.error" });
                return;
            }
            if (!filename) {
                node.error(RED._("aws.error.no-filename-specified"), msg);
                node.status({ fill: "red", shape: "dot", text: "aws.status.error" });
                return;
            }
            if (msg.payload === undefined || msg.payload === null) {
                node.error(RED._("aws.error.no-payload-specified"), msg);
                node.status({ fill: "red", shape: "dot", text: "aws.status.error" });
                return;
            }

            // Convert payload to Buffer if it's a string
            let body = msg.payload;
            if (typeof body === "string") {
                body = Buffer.from(body, "utf8");
            } else if (typeof body === "object" && !Buffer.isBuffer(body)) {
                // Convert objects to JSON
                body = Buffer.from(JSON.stringify(body), "utf8");
            }

            // Check size limit
            if (Buffer.isBuffer(body) && body.length > MAX_UPLOAD_SIZE) {
                node.error(RED._("aws.error.upload-size-limit-exceeded", { size: MAX_UPLOAD_SIZE / 1024 / 1024 / 1024 }), msg);
                node.status({ fill: "red", shape: "dot", text: "aws.status.error" });
                return;
            }

            msg.bucket = bucket;
            msg.filename = filename;
            node.status({ fill: "blue", shape: "dot", text: "aws.status.uploading" });

            try {
                const commandParams = {
                    Bucket: bucket,
                    Key: filename,
                    Body: body
                };

                if (contentType) {
                    commandParams.ContentType = contentType;
                }

                if (acl) {
                    commandParams.ACL = acl;
                }

                const command = new PutObjectCommand(commandParams);
                const response = await s3Client.send(command);

                msg.payload = {
                    success: true,
                    bucket: bucket,
                    key: filename,
                    etag: response.ETag,
                    versionId: response.VersionId
                };

                node.status({}); // Clear status on success
                node.send(msg);
            } catch (err) {
                msg.error = err;
                msg.payload = null;
                let errorMessage = err.message || err.toString();

                // Handle specific AWS errors
                if (err.$metadata && err.$metadata.httpStatusCode) {
                    switch (err.$metadata.httpStatusCode) {
                        case 403:
                            errorMessage = RED._("aws.error.access-denied");
                            break;
                        case 400:
                            errorMessage = RED._("aws.error.invalid-request");
                            break;
                        case 404:
                            errorMessage = RED._("aws.error.bucket-not-found", { bucket: bucket });
                            break;
                    }
                }

                node.error(RED._("aws.error.upload-failed", { err: errorMessage }), msg);
                node.status({ fill: "red", shape: "dot", text: "aws.status.error" });
                node.send(msg); // Send msg with error so downstream can handle it
            }
        });

        node.on("close", function(done) {
            if (s3Client) {
                s3Client.destroy();
                s3Client = null;
            }
            node.status({});
            done();
        });
    }

    /**
     * Detect content type based on file extension
     */
    function detectContentType(filename) {
        if (!filename) return "application/octet-stream";

        const ext = filename.toLowerCase().split(".").pop();
        const mimeTypes = {
            // Text
            "txt": "text/plain",
            "html": "text/html",
            "htm": "text/html",
            "css": "text/css",
            "csv": "text/csv",
            "xml": "text/xml",
            // Application
            "json": "application/json",
            "js": "application/javascript",
            "pdf": "application/pdf",
            "zip": "application/zip",
            "gz": "application/gzip",
            "tar": "application/x-tar",
            // Images
            "jpg": "image/jpeg",
            "jpeg": "image/jpeg",
            "png": "image/png",
            "gif": "image/gif",
            "svg": "image/svg+xml",
            "webp": "image/webp",
            "ico": "image/x-icon",
            // Audio
            "mp3": "audio/mpeg",
            "wav": "audio/wav",
            "ogg": "audio/ogg",
            // Video
            "mp4": "video/mp4",
            "webm": "video/webm",
            "avi": "video/x-msvideo"
        };

        return mimeTypes[ext] || "application/octet-stream";
    }

    RED.nodes.registerType("epi-aws-s3-upload", EpiAmazonS3UploadNode);
};
