import nodemailer from 'nodemailer';

const MAILERLITE_API_KEY = process.env.MAILERLITE_API_KEY;
const MAILERLITE_API_URL = 'https://connect.mailerlite.com/api';
const GMAIL_USER = 'hello@wisdomwalk.earth';
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

const GROUP_IDS = {
  la_familia: '187627532466521921',
  'Walk — Amazonia, Peru': '187627862113649676',
  'Walk — Peru, Amazonia': '187627862113649676',
  'Walk — Oaxaca & the Ancient South, Mexico': '187627878071928632',
  'Walk — Mexico, Mesoamerican Path': '187627878071928632',
  'Harvest — Lavender, Ida Mountains, Turkey': '187627903441176482',
  'Harvest — Olive, Ayvalık, Turkey': '187627903441176482',
  'Harvest — Lavender, Ida Mountains': '187627903441176482',
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

async function sendConfirmationToApplicant({ first_name, email }) {
  const transporter = createTransporter();
  const safeName = (first_name || 'friend').replace(/[<>]/g, '');

  const text = [
    `Dear ${safeName},`,
    ``,
    `Thank you for reaching out. Your application has arrived, and it will be read with care.`,
    ``,
    `We'll come back to you within 2 to 3 days. If anything moves you in the meantime, you can reply directly to this email.`,
    ``,
    `With care,`,
    `Wisdom Walk`,
    `wisdomwalk.earth`,
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Your application has arrived</title>
  </head>
  <body style="margin:0;padding:0;background:#f7f3ea;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7f3ea;">
      <tr>
        <td align="center" style="padding:56px 24px;">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
            <tr>
              <td align="center" style="padding-bottom:40px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:10px;letter-spacing:6px;text-transform:uppercase;color:#7a6830;">
                Wisdom&nbsp;Walk
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-bottom:32px;">
                <div style="width:32px;height:1px;background:#c4a55a;opacity:0.6;line-height:1px;font-size:1px;">&nbsp;</div>
              </td>
            </tr>
            <tr>
              <td style="font-family:'Cormorant Garamond',Georgia,'Times New Roman',serif;font-size:19px;line-height:1.75;color:#2a2822;font-weight:300;">
                <p style="margin:0 0 24px 0;">Dear ${safeName},</p>
                <p style="margin:0 0 24px 0;">Thank you for reaching out. Your application has arrived, and it will be read with care.</p>
                <p style="margin:0 0 24px 0;">We&rsquo;ll come back to you within 2 to 3 days. If anything moves you in the meantime, you can reply directly to this email.</p>
                <p style="margin:0 0 8px 0;">With care,</p>
                <p style="margin:0;font-style:italic;color:#a8853f;font-size:21px;">Wisdom Walk</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-top:56px;">
                <div style="width:32px;height:1px;background:#c4a55a;opacity:0.4;line-height:1px;font-size:1px;">&nbsp;</div>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-top:24px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:10px;letter-spacing:4px;text-transform:uppercase;color:#7a6830;">
                <a href="https://wisdomwalk.earth" style="color:#7a6830;text-decoration:none;">wisdomwalk.earth</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  await transporter.sendMail({
    from: `"Wisdom Walk" <${GMAIL_USER}>`,
    to: email,
    subject: `Your application has arrived`,
    text,
    html,
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

    // Application form
    if (type === 'application') {
      // 1. Merve'ye bildirim maili
      await sendNotificationToMerve({ first_name, last_name, email, journey_interest, message });

      // 2. Başvurucuya otomatik onay maili
      await sendConfirmationToApplicant({ first_name, email });

      // 3. Mailerlite'a ekle (journey group + La Familia checkbox)
      const groupIds = [];
      if (journey_interest && GROUP_IDS[journey_interest]) {
        groupIds.push(GROUP_IDS[journey_interest]);
      }
      if (la_familia) {
        groupIds.push(GROUP_IDS.la_familia);
      }
      if (groupIds.length > 0) {
        await addToMailerlite(email, first_name || '', last_name || '', groupIds);
      }

      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Invalid type' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
}
