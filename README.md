# @episensor/epi-aws-s3

EpiSensor [Node-RED](http://nodered.org) nodes for Amazon S3 - download and upload files from/to S3 buckets.

## Install

Run the following command in your Node-RED user directory (typically `~/.node-red`):

```bash
npm install @episensor/epi-aws-s3
```

## Features

- **Download files** from Amazon S3 buckets
- **Upload files** to Amazon S3 buckets (NEW in v0.3.0)
- Progress tracking for large downloads
- Automatic content type detection for uploads
- ACL support for upload permissions
- Automatic file size limit enforcement
- Detailed error reporting with error forwarding to output
- Support for all AWS regions
- Uses AWS SDK v3 for improved performance and security

## Prerequisites

- Node.js 14 or later
- Node-RED 3.0 or later
- AWS account with appropriate S3 permissions

## Configuration

### AWS Credentials

1. Sign up for [Amazon Web Services](http://aws.amazon.com/) if you haven't already
2. Obtain your credentials using one of these methods:
   - Go to your account name → Security Credentials → Access Keys
   - Create an IAM user: IAM Console → Users → Add user → Attach S3 permissions

The IAM user needs at least the following permissions:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject"
            ],
            "Resource": [
                "arn:aws:s3:::your-bucket-name/*"
            ]
        }
    ]
}
```

### Node Configuration

1. Add your AWS credentials in the configuration node
2. Set the bucket name (or provide it in `msg.bucket`)
3. Set the file path (or provide it in `msg.filename`)
4. Select your AWS region
5. Deploy and test

## Nodes

### S3 Download (`epi-aws-s3`)

Downloads files from an S3 bucket.

#### Input

- `msg.bucket` (string): Override the configured bucket name
- `msg.filename` (string): Override the configured file path

#### Output

- `msg.payload` (Buffer): The downloaded file content (null on error)
- `msg.bucket` (string): The bucket name used
- `msg.filename` (string): The filename/key used
- `msg.error` (Error, optional): Error details if download fails

#### Example

```javascript
msg.bucket = "my-bucket";
msg.filename = "path/to/file.txt";
return msg;
```

### S3 Upload (`epi-aws-s3-upload`)

Uploads files to an S3 bucket.

#### Input

- `msg.payload` (Buffer | string | object): The content to upload
  - Buffers are uploaded directly
  - Strings are converted to UTF-8
  - Objects are JSON-stringified
- `msg.bucket` (string): Override the configured bucket name
- `msg.filename` (string): Override the configured destination path
- `msg.contentType` (string, optional): Override the content type (auto-detected from filename)
- `msg.acl` (string, optional): Set the access control list (e.g., "private", "public-read")

#### Output

- `msg.payload` (object): Upload result containing:
  - `success` (boolean): True if upload succeeded
  - `bucket` (string): The bucket name
  - `key` (string): The uploaded file key
  - `etag` (string): The ETag of the uploaded object
  - `versionId` (string, optional): Version ID if bucket versioning is enabled
- `msg.bucket` (string): The bucket name used
- `msg.filename` (string): The filename/key used
- `msg.error` (Error, optional): Error details if upload fails

#### Supported Content Types

Content type is automatically detected from the filename extension:

| Extension | Content Type |
|-----------|--------------|
| .txt | text/plain |
| .html, .htm | text/html |
| .css | text/css |
| .json | application/json |
| .js | application/javascript |
| .pdf | application/pdf |
| .jpg, .jpeg | image/jpeg |
| .png | image/png |
| .gif | image/gif |
| .svg | image/svg+xml |
| .mp3 | audio/mpeg |
| .mp4 | video/mp4 |
| .zip | application/zip |
| (unknown) | application/octet-stream |

#### Example

```javascript
// Upload a string
msg.bucket = "my-bucket";
msg.filename = "data/output.txt";
msg.payload = "Hello, S3!";
return msg;

// Upload JSON
msg.bucket = "my-bucket";
msg.filename = "data/config.json";
msg.payload = { key: "value", count: 42 };
return msg;

// Upload with public access
msg.bucket = "my-bucket";
msg.filename = "public/image.png";
msg.payload = imageBuffer;
msg.acl = "public-read";
return msg;
```

## Status Indicators

- **Blue dot**: Download/upload in progress (with MB count for large files)
- **Red dot**: Error occurred
- **Red ring**: Missing credentials or initialization error
- **No status**: Ready/completed successfully

## Limitations

- Maximum download file size: 100MB
- Maximum upload file size: 5GB (S3 single PUT limit)
- Single file operations only (no batch operations)
- For uploads larger than 5GB, consider using multipart upload (not yet supported)

## Error Handling

Both nodes send error messages to their output, allowing downstream nodes to handle errors:

- `msg.error` contains the error object
- `msg.payload` is set to `null` on error
- Errors are also logged via `node.error()`

Common error scenarios:

- Missing credentials
- Invalid bucket names
- File not found (download)
- Bucket not found (upload)
- Access denied
- Network errors
- Size limit exceeded

## Testing

This package includes a comprehensive test suite:

```bash
# Run unit tests with Jest
npm test

# Run tests with coverage report
npm run test:coverage

# Run tests in watch mode during development
npm run test:watch

# Test Node-RED compatibility
npm run test:node-red

# Check for security issues
npm run security-check

# Verify package configuration
npm run verify-package

# Run all pre-publish checks
npm run pre-publish
```

## Development

### Prerequisites

- Node.js 14 or later
- Node-RED 3.0 or later for testing

### Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Run tests: `npm test`

### Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/my-new-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin feature/my-new-feature`
5. Submit a pull request

## Support

For issues and feature requests, please use the [GitHub issue tracker](https://github.com/episensor/epi-aws-s3/issues).

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) for details.

## Version History

- 0.3.0 (2024-12)
  - Added S3 upload node (`epi-aws-s3-upload`)
  - Automatic content type detection for uploads
  - ACL support for upload permissions
  - Fixed bug where errors were not sent to node output
  - Fixed progress indicator not updating during downloads
  - Fixed localization key mismatches
  - Improved credentials security (access key now masked)
  - Removed unused dependencies (minimatch)
  - Added all missing AWS regions
  - Made node name field optional
  - Consolidated to Jest test framework with improved coverage
  - Updated AWS SDK to latest version
  - Updated documentation with correct status indicators

- 0.2.1 (2024-03)
  - Removed GitHub workflow files
  - Streamlined package structure

- 0.2.0 (2024-03)
  - Added comprehensive test suite
  - Added pre-publish checks
  - Added security scanning
  - Added Node-RED compatibility testing
  - Updated dependencies

- 0.1.0 (2024-01)
  - Added progress tracking
  - Added file size limits
  - Improved error handling
  - Updated to AWS SDK v3.511.0
  - Added status indicators
  - Improved documentation

- 0.0.3
  - Initial release with AWS SDK v3 support
