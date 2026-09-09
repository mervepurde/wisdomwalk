import nodemailer from 'nodemailer';

const MAILERLITE_API_KEY = process.env.MAILERLITE_API_KEY;
const MAILERLITE_API_URL = 'https://connect.mailerlite.com/api';
const GMAIL_USER = 'hello@wisdomwalk.earth';
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

const GROUP_IDS = {
  la_familia: '187627532466521921',
  application_submitted: '187797301812528868',
  'Journey — Sacred Valley & Amazonia, Peru': '187627862113649676',
  'Journey — Peru, Amazonia': '187627862113649676',
  'Journey — Oaxaca & Caribbean, Mexico': '187627878071928632',
  'Journey — Mexico, Mesoamerican Path': '187627878071928632',
  'Journey — Auroville, India': '193322867805389963',
  // Mexico "Download Details" formundan gelenler buraya.
  'Mexico Interest': process.env.MAILERLITE_MEXICO_INTEREST_GROUP_ID || '187627878071928632',
  "I'm open — tell me more": '187627532466521921',
};

function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD,
    },
  });
}

async function addToMailerlite(email, firstName, lastName, groupIds) {
  if (!MAILERLITE_API_KEY) {
    console.error('[mailerlite] MAILERLITE_API_KEY is missing — subscriber NOT added:', email);
    return false;
  }
  const cleanGroups = groupIds.filter(Boolean);
  const res = await fetch(`${MAILERLITE_API_URL}/subscribers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MAILERLITE_API_KEY}`,
    },
    body: JSON.stringify({
      email,
      fields: { name: firstName, last_name: lastName },
      groups: cleanGroups,
    }),
  });
  if (!res.ok) {
    // Log the exact reason (401 = bad/missing key, 422 = invalid group ID or email, etc.)
    let detail = '';
    try { detail = await res.text(); } catch {}
    console.error(`[mailerlite] add failed (${res.status}) for ${email} — groups [${cleanGroups.join(', ')}]: ${detail}`);
  }
  return res.ok;
}

async function sendNotificationToMerve({ first_name, last_name, email, journey_interest, message }) {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"Wisdom Walk" <${GMAIL_USER}>`,
    to: GMAIL_USER,
    subject: `New application — ${first_name} ${last_name}`,
    text: [
      `Name: ${first_name} ${last_name}`,
      `Email: ${email}`,
      `Journey: ${journey_interest}`,
      ``,
      `Message:`,
      message,
    ].join('\n'),
  });
}

async function sendDownloadNotificationToMerve({ first_name, last_name, email }) {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"Wisdom Walk" <${GMAIL_USER}>`,
    to: GMAIL_USER,
    subject: `New PDF download — Mexico${first_name ? ` — ${first_name} ${last_name || ''}`.trimEnd() : ''}`,
    text: [
      `Someone downloaded the Mexico details PDF.`,
      ``,
      `Name: ${first_name || ''} ${last_name || ''}`.trimEnd(),
      `Email: ${email}`,
    ].join('\n'),
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { type, interest, email, first_name, last_name, journey_interest, message, la_familia } = req.body;

  if (!email) return res.status(400).json({ error: 'Email required' });

  try {
    // Newsletter subscription
    if (type === 'newsletter') {
      const ok = await addToMailerlite(email, first_name || '', '', [GROUP_IDS.la_familia]);
      return res.status(ok ? 200 : 500).json({ success: ok });
    }

    // Mexico "Download Details" PDF — hepsi bir arada:
    //   1) Mexico Interest grubuna ekle
    //   2) Application Submitted grubuna ekle (application-received otomasyonunu tetikler)
    //   3) Merve'ye bildirim maili gönder
    if (type === 'download') {
      await sendDownloadNotificationToMerve({ first_name, last_name, email });
      const groupIds = [GROUP_IDS['Mexico Interest'], GROUP_IDS.application_submitted];
      // "Also keep me close to La Familia letters" kutucuğu işaretliyse newsletter grubuna da ekle
      if (la_familia) groupIds.push(GROUP_IDS.la_familia);
      const ok = await addToMailerlite(
        email, first_name || '', last_name || '',
        groupIds
      );
      return res.status(ok ? 200 : 500).json({ success: ok });
    }

    // Application form
    if (type === 'application') {
      // 1. Merve'ye bildirim maili
      await sendNotificationToMerve({ first_name, last_name, email, journey_interest, message });

      // 2. Mailerlite'a ekle: Application Submitted (otomasyon trigger) + journey group + La Familia checkbox
      const groupIds = [GROUP_IDS.application_submitted];
      if (journey_interest && GROUP_IDS[journey_interest]) {
        groupIds.push(GROUP_IDS[journey_interest]);
      }
      if (la_familia) {
        groupIds.push(GROUP_IDS.la_familia);
      }
      const mlOk = await addToMailerlite(email, first_name || '', last_name || '', groupIds);

      // Still return 200 so the applicant sees success (Merve already got the
      // notification email, so the conversation can start) — but surface the
      // MailerLite result so a failed subscribe is no longer invisible.
      return res.status(200).json({ success: true, mailerlite: mlOk });
    }

    return res.status(400).json({ error: 'Invalid type' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
}
