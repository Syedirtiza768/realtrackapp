/**
 * One-off: PutObject → GetObject → DeleteObject using the same env vars as StorageService.
 * Run from repo root: node --env-file=.env backend/scripts/s3-smoke-test.mjs
 * Or from backend:   node --env-file=../.env scripts/s3-smoke-test.mjs
 */
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

function normalizePrefix(p) {
  if (!p) return '';
  const t = p.replace(/^\/+/, '').replace(/\/+$/, '');
  return t ? `${t}/` : '';
}

const bucket =
  process.env.AWS_S3_BUCKET?.trim() || process.env.S3_BUCKET?.trim() || '';
const region =
  process.env.AWS_S3_REGION?.trim() ||
  process.env.S3_REGION?.trim() ||
  process.env.AWS_REGION?.trim() ||
  'us-east-1';
const keyPrefix = normalizePrefix(
  process.env.AWS_S3_PREFIX || process.env.S3_PREFIX || '',
);
const accessKeyId =
  process.env.AWS_ACCESS_KEY_ID?.trim() ||
  process.env.WS_ACCESS_KEY_ID?.trim() ||
  '';
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim() || '';

if (!bucket) {
  console.error('Missing AWS_S3_BUCKET (or S3_BUCKET)');
  process.exit(1);
}

const client = new S3Client({
  region,
  ...(accessKeyId && secretAccessKey
    ? { credentials: { accessKeyId, secretAccessKey } }
    : {}),
});

const testKey = `${keyPrefix}__smoke_test__/${Date.now()}.txt`;
const body = `realtrackapp s3 smoke ${new Date().toISOString()}`;

async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

try {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: testKey,
      Body: body,
      ContentType: 'text/plain',
    }),
  );
  console.log('PUT ok:', testKey);

  const get = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: testKey }),
  );
  const got = await streamToString(get.Body);
  if (got !== body) {
    console.error('GET mismatch:', { expected: body, got });
    process.exit(1);
  }
  console.log('GET ok: content matches');

  await client.send(
    new DeleteObjectCommand({ Bucket: bucket, Key: testKey }),
  );
  console.log('DELETE ok: cleaned up test object');
  console.log('S3 round-trip succeeded for bucket', bucket, 'region', region);
} catch (e) {
  console.error('S3 smoke test failed:', e.name, e.message);
  if (e.$metadata) console.error('metadata:', e.$metadata);
  process.exit(1);
}
