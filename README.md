node-red-contrib-epi-aws-s3
=================

An EpiSensor <a href="http://nodered.org" target="_new">Node-RED</a> node to watch, send
and receive files from an Amazon S3 bucket.

Install
-------

Run the following command in the root directory of your Node-RED install

        npm install node-red-contrib-epi-aws-s3

Usage
-----

### Amazon S3 input node

Downloads content from an Amazon S3 bucket. The bucket name can be specified in
the node **bucket** property or in the `msg.bucket` property.
The name of the file to download is taken from the node <b>filename</b> property
or the `msg.filename` property. The downloaded content is sent as `msg.payload`
property. If the download fails `msg.error` will contain an error object.