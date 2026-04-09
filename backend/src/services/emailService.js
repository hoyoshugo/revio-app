/**
 * Servicio de envío de email vía Resend (https://resend.com).
 * Si RESEND_API_KEY no está configurada, hace log en lugar de enviar.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const DEFAULT_FROM = process.env.EMAIL_FROM || 'Revio <hello@revio.co>';

/**
 * Envía un email via Resend API.
 * @param {object} opts - { to, subject, html, text, from }
 * @returns {Promise<{success, id?, error?}>}
 */
export async function sendEmail({ to, subject, html, text, from = DEFAULT_FROM }) {
  if (!to || !subject) return { success: false, error: 'to y subject son requeridos' };

  if (!RESEND_API_KEY) {
    console.log(JSON.stringify({
      level: 'info', event: 'email_stub_no_api_key', to, subject,
    }));
    return { success: false, error: 'no_api_key', stub: true };
  }

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(to) ? to : [to],
        subject,
        html: html || `<p>${text}</p>`,
        text: text || undefined,
      }),
    });

    const data = await r.json();
    if (!r.ok) {
      return { success: false, error: data.message || `HTTP ${r.status}` };
    }
    return { success: true, id: data.id };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Plantilla HTML básica de Revio para emails transaccionales.
 */
export function wrapEmailTemplate(title, bodyHtml, ctaButton = null) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${title}</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f7;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;">
        <tr><td style="background:#0A0F1A;padding:24px 32px;">
          <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:600;">${title}</h1>
        </td></tr>
        <tr><td style="padding:32px;color:#1a1a1a;font-size:15px;line-height:1.6;">
          ${bodyHtml}
          ${ctaButton ? `
          <table cellpadding="0" cellspacing="0" style="margin-top:32px;"><tr>
            <td style="background:#0ea5e9;border-radius:10px;">
              <a href="${ctaButton.href}" style="display:inline-block;padding:14px 28px;color:#ffffff;text-decoration:none;font-weight:600;">${ctaButton.label}</a>
            </td>
          </tr></table>` : ''}
        </td></tr>
        <tr><td style="background:#f5f5f7;padding:20px 32px;color:#8a8a8a;font-size:12px;">
          Powered by <strong>Revio</strong> · revio.co
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
