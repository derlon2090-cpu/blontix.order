// Test-only transport: retain the real AWS SDK, signing and S3 commands.
if (process.env.NODE_ENV==='production' || process.env.RENDER==='true' || process.env.BLONTIX_ISOLATED_QA !== '1') throw new Error('Test transport forbidden in production; isolated QA required');
const sdk = require(process.env.QA_S3_SDK_ENTRY);
const { NodeHttpHandler } = require('@smithy/node-http-handler');
Object.assign(exports, sdk);
exports.HeadBucketCommand = sdk.HeadBucketCommand;
exports.HeadObjectCommand = sdk.HeadObjectCommand;
exports.GetObjectCommand = sdk.GetObjectCommand;
exports.PutObjectCommand = sdk.PutObjectCommand;
exports.DeleteObjectCommand = sdk.DeleteObjectCommand;
exports.S3Client = class S3Client extends sdk.S3Client {
  constructor(config) {
    const handler = new NodeHttpHandler({ connectionTimeout: 3000, requestTimeout: 10000 });
    super({ ...config, requestHandler: {
      handle(request, options) { return handler.handle({ ...request, hostname: '127.0.0.1', port: Number(process.env.QA_S3_PORT), protocol: 'http:' }, options); },
      destroy() { handler.destroy(); },
    } });
  }
};
