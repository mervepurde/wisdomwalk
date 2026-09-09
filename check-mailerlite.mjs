// Diagnostic: verifies the MailerLite API key and every group ID the site uses.
// Run locally (NOT deployed), pasting your key in place of YOUR_KEY:
//   MAILERLITE_API_KEY=YOUR_KEY node check-mailerlite.mjs
// Your key lives in MailerLite → Integrations → API. This file stores nothing.

const KEY = process.env.MAILERLITE_API_KEY;

// The IDs currently hardcoded in api/submit.js:
const USED = {
  'la_familia': '187627532466521921',
  'application_submitted': '187797301812528868',
  'Peru': '187627862113649676',
  'Mexico (Oaxaca/Interest)': '187627878071928632',
  'Auroville': '193322867805389963',
};

if (!KEY) {
  console.error('\n❌ No MAILERLITE_API_KEY provided. Run:\n   MAILERLITE_API_KEY=your_key node check-mailerlite.mjs\n');
  process.exit(1);
}

const res = await fetch('https://connect.mailerlite.com/api/groups?limit=200', {
  headers: { Authorization: `Bearer ${KEY}`, Accept: 'application/json' },
});

if (res.status === 401) {
  console.error('\n❌ 401 Unauthorized — the API key is wrong or expired. That alone would block every subscribe.\n');
  process.exit(1);
}
if (!res.ok) {
  console.error(`\n❌ MailerLite returned ${res.status}:`, await res.text(), '\n');
  process.exit(1);
}

const { data } = await res.json();
const realIds = new Set(data.map(g => g.id));

console.log('\n✅ API key works. Your real MailerLite groups:\n');
for (const g of data) console.log(`   ${g.id}  —  ${g.name}`);

console.log('\n— Checking the IDs the site uses —\n');
let bad = 0;
for (const [label, id] of Object.entries(USED)) {
  if (realIds.has(id)) {
    const match = data.find(g => g.id === id);
    console.log(`   ✅ ${label}: ${id}  (= "${match.name}")`);
  } else {
    bad++;
    console.log(`   ❌ ${label}: ${id}  — NOT FOUND in your account. This poisons any submit that uses it (422).`);
  }
}

console.log(bad === 0
  ? '\nAll group IDs are valid. If subscribers still fail, check double opt-in in MailerLite → Settings.\n'
  : `\n${bad} invalid group ID(s) above — fix these in api/submit.js and redeploy.\n`);
