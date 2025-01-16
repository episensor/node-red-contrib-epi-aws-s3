/**
  Modifications Copyright 2023 EpiSensor

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

    const fs = require('fs');
    const minimatch = require("minimatch");
    // AWS SDK for JavaScript v3:
    const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");

    // Constants
    const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
    const DEFAULT_REGION = "us-east-1";
    
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
            accesskeyid: { type:"text" },
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
            node.error("Failed to initialize S3 client: " + err.toString());
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

                for await (const chunk of response.Body) {
                    totalSize += chunk.length;
                    if (totalSize > MAX_FILE_SIZE) {
                        throw new Error(RED._("aws.error.file-too-large", {size: MAX_FILE_SIZE / 1024 / 1024}));
                    }
                    chunks.push(chunk);

                    // Update status every 1MB
                    if (totalSize % (1024 * 1024) === 0) {
                        node.status({
                            fill: "blue",
                            shape: "dot",
                            text: RED._("aws.status.downloading-progress", {size: Math.round(totalSize / 1024 / 1024)})
                        });
                    }
                }

                msg.payload = Buffer.concat(chunks);
                node.status({}); // Clear status on success
                node.send(msg);
            } catch (err) {
                msg.error = err;
                let errorMessage = err.message || err.toString();
                
                // Handle specific AWS errors while preserving original error object
                if (err.$metadata && err.$metadata.httpStatusCode) {
                    switch (err.$metadata.httpStatusCode) {
                        case 404:
                            errorMessage = RED._("aws.error.file-not-found", {filename: filename, bucket: bucket});
                            break;
                        case 403:
                            errorMessage = RED._("aws.error.access-denied");
                            break;
                        case 400:
                            errorMessage = RED._("aws.error.invalid-request");
                            break;
                    }
                }
                
                node.error(RED._("aws.error.download-failed", {err: errorMessage}), msg);
                node.status({ fill: "red", shape: "dot", text: "aws.status.error" });
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
};