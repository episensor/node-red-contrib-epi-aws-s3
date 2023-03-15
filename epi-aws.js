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
    var fs = require('fs');
    var minimatch = require("minimatch");

    function EpiAWSNode(n) {
        RED.nodes.createNode(this,n);
        this.name = n.name;
        if (this.credentials &&
            this.credentials.accesskeyid && this.credentials.secretaccesskey) {
            this.AWS = require("aws-sdk");
            this.AWS.config.update({
                accessKeyId: this.credentials.accesskeyid,
                secretAccessKey: this.credentials.secretaccesskey,
            });
        }
    }

    RED.nodes.registerType("epi-aws-config",EpiAWSNode,{
        credentials: {
            accesskeyid: { type:"text" },
            secretaccesskey: { type: "password" }
        }
    });

    function EpiAmazonS3DownloadNode(n) {
        RED.nodes.createNode(this,n);
        this.awsConfig = RED.nodes.getNode(n.aws);
        this.region = n.region || "eu-west-1";
        this.bucket = n.bucket;
        this.name = n.name;
        this.filename = n.filename || "";
        var node = this;
        var AWS = this.awsConfig ? this.awsConfig.AWS : null;

        if (!AWS) {
            node.warn(RED._("aws.warn.missing-credentials"));
            return;
        }
        var s3 = new AWS.S3({"region": node.region});
        node.on("input", function(msg) {
            var bucket = node.bucket || msg.bucket;
            if (bucket === "") {
                node.error(RED._("aws.error.no-bucket-specified"),msg);
                node.status({fill:"red",shape:"dot",text:"aws.status.error"});
                return;
            }
            var filename = node.filename || msg.filename;
            if (filename === "") {
                node.error(RED._("aws.error.no-filename-specified"),msg);
                node.status({fill:"red",shape:"dot",text:"aws.status.error"});
                return;
            }
            msg.bucket = bucket;
            msg.filename = filename;
            node.status({fill:"blue",shape:"dot",text:"aws.status.downloading"});
            s3.getObject({
                Bucket: bucket,
                Key: filename,
            }, function(err, data) {
                if (err) {
                    node.error(RED._("aws.error.download-failed",{err:err.toString()}),msg);
                    node.status({fill:"red",shape:"dot",text:"aws.status.error"});
                    return;
                } else {
                    msg.payload = data.Body;
                }
                node.status({});
                node.send(msg);
            });
        });
    }
    RED.nodes.registerType("epi-aws-s3", EpiAmazonS3DownloadNode);
};
