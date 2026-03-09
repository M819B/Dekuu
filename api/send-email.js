export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { to, type, link, name, subject: customSubject, body: customBody } = req.body;
  if (!to || !type) return res.status(400).json({ error: 'Missing fields' });

  // Custom email from admin panel
  if (type === 'custom') {
    if (!customSubject || !customBody) return res.status(400).json({ error: 'Missing subject or body' });
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Dekuu <noreply@m819dekuu.live>',
          to,
          subject: customSubject,
          html: `<!DOCTYPE html><html><body style="margin:0;padding:40px 16px;background:#060912;font-family:ui-sans-serif,system-ui,Arial;color:#e6e8ee;">
            <div style="max-width:560px;margin:0 auto;background:#0b1020;border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:40px 36px;">
              <div style="text-align:center;margin-bottom:24px;">
                <span style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#22d3ee);border-radius:14px;width:44px;height:44px;line-height:44px;text-align:center;font-weight:800;color:white;font-size:16px;">DK</span>
                <span style="display:inline-block;margin-left:12px;font-weight:800;font-size:18px;vertical-align:middle;">Dekuu</span>
              </div>
              <div style="color:#e6e8ee;font-size:.95rem;line-height:1.7;white-space:pre-wrap;">${customBody}</div>
              <div style="margin-top:32px;padding-top:20px;border-top:1px solid rgba(255,255,255,.08);text-align:center;color:#99a3b2;font-size:.82rem;">© 2025 Dekuu. All rights reserved.</div>
            </div>
          </body></html>`
        })
      });
      const data = await response.json();
      if (!response.ok) return res.status(500).json({ error: data });
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // Template emails
  if (!link) return res.status(400).json({ error: 'Missing link/code' });

  const templates = {
    googleWelcome: {
      subject: 'Welcome to Dekuu!',
      html: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#060912;font-family:ui-sans-serif,system-ui,Arial;color:#e6e8ee;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#060912;padding:40px 16px;"><tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;"><tr><td align="center" style="padding-bottom:32px;"><table cellpadding="0" cellspacing="0"><tr><td style="background:linear-gradient(135deg,#7c3aed,#22d3ee);border-radius:14px;width:44px;height:44px;text-align:center;vertical-align:middle;font-size:16px;font-weight:800;color:white;" width="44" height="44">DK</td><td style="padding-left:12px;font-weight:800;font-size:18px;color:#e6e8ee;">Dekuu</td></tr></table></td></tr><tr><td style="background:#0b1020;border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:40px 36px;"><h1 style="margin:0 0 12px;font-size:24px;font-weight:800;color:#e6e8ee;text-align:center;">Welcome to Dekuu! 🎉</h1><p style="margin:0 0 24px;color:#99a3b2;text-align:center;font-size:.95rem;line-height:1.6;">Hi ${name || 'there'}, your account has been created with Google. You're all set!</p><table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><td align="center"><a href="${link}" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#7c3aed,#22d3ee);color:white;font-weight:700;font-size:.95rem;text-decoration:none;border-radius:14px;">Go to your profile →</a></td></tr></table></td></tr><tr><td align="center" style="padding-top:24px;"><p style="margin:0;color:#99a3b2;font-size:.82rem;">© 2025 Dekuu. All rights reserved.</p></td></tr></table></td></tr></table></body></html>`
    },
    verify: {
      subject: 'Verify your Dekuu account',
      html: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#060912;font-family:ui-sans-serif,system-ui,Arial;color:#e6e8ee;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#060912;padding:40px 16px;"><tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;"><tr><td align="center" style="padding-bottom:32px;"><table cellpadding="0" cellspacing="0"><tr><td style="background:linear-gradient(135deg,#7c3aed,#22d3ee);border-radius:14px;width:44px;height:44px;text-align:center;vertical-align:middle;font-size:16px;font-weight:800;color:white;" width="44" height="44">DK</td><td style="padding-left:12px;font-weight:800;font-size:18px;color:#e6e8ee;">Dekuu</td></tr></table></td></tr><tr><td style="background:#0b1020;border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:40px 36px;"><h1 style="margin:0 0 12px;font-size:24px;font-weight:800;color:#e6e8ee;text-align:center;">Verify your email</h1><p style="margin:0 0 28px;color:#99a3b2;text-align:center;font-size:.95rem;line-height:1.6;">Hi ${name || 'there'}, enter this code to activate your account.</p><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding-bottom:28px;"><div style="display:inline-block;padding:18px 40px;background:linear-gradient(135deg,rgba(124,58,237,.15),rgba(34,211,238,.15));border:1px solid rgba(124,58,237,.35);border-radius:16px;font-size:2.2rem;font-weight:900;letter-spacing:10px;color:#e6e8ee;">${link}</div></td></tr></table></td></tr></table></td></tr></table></body></html>`
    },
    otp: {
      subject: 'Your Dekuu login code',
      html: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#060912;font-family:ui-sans-serif,system-ui,Arial;color:#e6e8ee;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#060912;padding:40px 16px;"><tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;"><tr><td align="center" style="padding-bottom:32px;"><table cellpadding="0" cellspacing="0"><tr><td style="background:linear-gradient(135deg,#7c3aed,#22d3ee);border-radius:14px;width:44px;height:44px;text-align:center;vertical-align:middle;font-size:16px;font-weight:800;color:white;" width="44" height="44">DK</td><td style="padding-left:12px;font-weight:800;font-size:18px;color:#e6e8ee;">Dekuu</td></tr></table></td></tr><tr><td style="background:#0b1020;border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:40px 36px;"><h1 style="margin:0 0 12px;font-size:24px;font-weight:800;color:#e6e8ee;text-align:center;">Your login code</h1><p style="margin:0 0 28px;color:#99a3b2;text-align:center;font-size:.95rem;line-height:1.6;">Hi ${name || 'there'}, use this code to complete your login.</p><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><div style="display:inline-block;padding:18px 40px;background:linear-gradient(135deg,rgba(124,58,237,.15),rgba(34,211,238,.15));border:1px solid rgba(124,58,237,.35);border-radius:16px;font-size:2.2rem;font-weight:900;letter-spacing:10px;color:#e6e8ee;">${link}</div></td></tr></table></td></tr></table></td></tr></table></body></html>`
    },
    emailChange: {
      subject: 'Your Dekuu email address has been changed',
      html: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#060912;font-family:ui-sans-serif,system-ui,Arial;color:#e6e8ee;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#060912;padding:40px 16px;"><tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;"><tr><td style="background:#0b1020;border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:40px 36px;"><h1 style="margin:0 0 12px;font-size:24px;font-weight:800;color:#e6e8ee;text-align:center;">Email address changed</h1><p style="margin:0 0 24px;color:#99a3b2;text-align:center;font-size:.95rem;line-height:1.6;">Your Dekuu account email has been updated. If you didn't do this, click below.</p><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><a href="${link}" style="display:inline-block;padding:11px 28px;background:linear-gradient(135deg,#7c3aed,#22d3ee);color:white;font-weight:700;font-size:.95rem;text-decoration:none;border-radius:14px;">Undo Email Change</a></td></tr></table></td></tr></table></td></tr></table></body></html>`
    }
  };

  const template = templates[type];
  if (!template) return res.status(400).json({ error: 'Invalid type' });

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Dekuu <noreply@m819dekuu.live>',
        to,
        subject: template.subject,
        html: template.html
      })
    });
    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data });
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
