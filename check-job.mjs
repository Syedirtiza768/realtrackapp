import http from 'http';

const token = process.argv[2];
const jobId = process.argv[3];

function get(path) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost', port: 8050, path,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  // Get job details
  const jobRes = await get(`/api/ebay/listing-jobs/${jobId}`);
  const job = JSON.parse(jobRes.body);
  console.log('=== Job ===');
  console.log(`Status: ${job.status}`);
  console.log(`Created: ${job.createdAt}`);
  console.log(`Completed: ${job.completedAt}`);
  
  // Get targets
  const targetsRes = await get(`/api/ebay/listing-jobs/${jobId}/targets`);
  const targetsData = JSON.parse(targetsRes.body);
  const targets = targetsData.targets || targetsData.items || targetsData;
  
  console.log('\n=== Targets ===');
  for (const t of (Array.isArray(targets) ? targets : [])) {
    console.log(`\nMarketplace: ${t.marketplaceId}`);
    console.log(`  Status: ${t.status}`);
    console.log(`  Account: ${t.ebayAccountId}`);
    if (t.resultPayload) {
      console.log(`  Result: ${JSON.stringify(t.resultPayload, null, 4)}`);
    }
    if (t.errorPayload) {
      console.log(`  Error: ${JSON.stringify(t.errorPayload, null, 4)}`);
    }
  }
}

main().catch(e => console.error(e));
