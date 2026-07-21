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
  'Journey — Auroville, India': '187627862113649676',
  'Harvest — Tea, Karadeniz, Turkey': '187627903441176482',
  'Harvest — Olive, Ayvalık, Turkey': '187627903441176482',
  'Harvest — Olive, Ayvalık': '187627903441176482',
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
  const res = await fetch(`${MAILERLITE_API_URL}/subscribers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MAILERLITE_API_KEY}`,
    },
    body: JSON.stringify({
      email,
      fields: { name: firstName, last_name: lastName },
      groups: groupIds.filter(Boolean),
    }),
  });
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { type, email, first_name, last_name, journey_interest, message, la_familia } = req.body;

  if (!email) return res.status(400).json({ error: 'Email required' });

  try {
    // Newsletter subscription
    if (type === 'newsletter') {
      const ok = await addToMailerlite(email, first_name || '', '', [GROUP_IDS.la_familia]);
      return res.status(ok ? 200 : 500).json({ success: ok });
    }

    // PDF download — capture email into the Mexico interest group
    if (type === 'download') {
      const ok = await addToMailerlite(
        email, first_name || '', last_name || '',
        [GROUP_IDS['Journey — Oaxaca & Caribbean, Mexico']]
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
      await addToMailerlite(email, first_name || '', last_name || '', groupIds);

      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Invalid type' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
}
