// Run inside the deployed worker to check its actual runtime credentials.
// No actor runs, dataset writes, queue consumption, or credential output.
const token = process.env.APIFY_TOKEN?.trim();
if (!token) {
  console.error('FAIL: APIFY_TOKEN is missing from the worker runtime.');
  process.exitCode = 1;
} else {
  try {
    const response = await fetch('https://api.apify.com/v2/users/me', {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    });
    if (response.ok) console.log('PASS: worker Apify token is accepted.');
    else {
      console.error(`FAIL: worker Apify authentication returned HTTP ${response.status}. ${response.status === 401 ? 'Replace the invalid or revoked token in the worker runtime, then redeploy.' : 'Check provider availability and account access.'}`);
      process.exitCode = 1;
    }
    await response.body?.cancel();
  } catch {
    console.error('FAIL: could not reach Apify within the authentication-check timeout.');
    process.exitCode = 1;
  }
}
