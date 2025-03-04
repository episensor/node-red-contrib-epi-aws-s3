# node-red-contrib-epi-aws-s3

An EpiSensor [Node-RED](http://nodered.org) node to download files from an Amazon S3 bucket.

## Install

Run the following command in your Node-RED user directory (typically `~/.node-red`):

```bash
npm install node-red-contrib-epi-aws-s3
```

## Features

- Download files from Amazon S3 buckets
- Progress tracking for large downloads
- Automatic file size limit enforcement
- Detailed error reporting
- Support for all major AWS regions
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
                "s3:GetObject"
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

## Usage

### Basic Example

```javascript
msg.bucket = "my-bucket";
msg.filename = "path/to/file.txt";
return msg;
```

### Input

- `msg.bucket` (string): Override the configured bucket name
- `msg.filename` (string): Override the configured file path

### Output

- `msg.payload` (Buffer): The downloaded file content
- `msg.error` (Error, optional): Error details if download fails

### Status Indicators

- Gray dot: Not configured
- Blue dot: Downloading (with progress for large files)
- Green dot: Ready/Completed
- Red dot: Error

## Limitations

- Maximum file size: 100MB
- Single file downloads only (no batch operations)
- Download-only (no upload capability)

## Error Handling

The node provides detailed error messages for common issues:

- Missing credentials
- Invalid bucket names
- File not found
- Access denied
- Network errors
- Size limit exceeded

## Testing

This package includes a comprehensive test suite to ensure reliability:

```bash
# Run unit tests with Jest
npm test

# Run tests with coverage report
npm run test:coverage

# Run tests in watch mode during development
npm run test:watch

# Run the original Mocha tests
npm run test:mocha

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

For issues and feature requests, please use the [GitHub issue tracker](https://github.com/episensor/node-red-contrib-epi-aws-s3/issues).

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) for details.

## Version History

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