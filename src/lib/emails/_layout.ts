// Minimal shared shell for transactional emails. Inline styles only —
// most email clients ignore <style> blocks; flexbox/grid are unreliable.

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

type LayoutInput = {
  preheader?: string;
  heading: string;
  body: string;
};

export function emailLayout({ preheader, heading, body }: LayoutInput): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>${escapeHtml(heading)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
    ${
      preheader
        ? `<div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0;">${escapeHtml(preheader)}</div>`
        : ''
    }
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f1f5f9;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;">
            <tr>
              <td style="padding:28px 32px 8px;border-bottom:1px solid #f1f5f9;">
                <div style="display:inline-flex;align-items:center;gap:8px;">
                  <span style="display:inline-block;width:28px;height:28px;background:#1f5af5;border-radius:8px;"></span>
                  <span style="font-size:16px;font-weight:600;color:#0f172a;">ShieldVPN</span>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 8px;">
                <h1 style="margin:0;font-size:22px;line-height:1.3;color:#0f172a;">${escapeHtml(heading)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 28px;font-size:15px;line-height:1.55;color:#334155;">
                ${body}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px 24px;border-top:1px solid #f1f5f9;font-size:12px;color:#94a3b8;">
                You're receiving this because you have a ShieldVPN account. Replies to this address aren't monitored.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function emailButton(label: string, href: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0">
    <tr>
      <td style="background:#1f5af5;border-radius:10px;">
        <a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 20px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`;
}

export { escapeHtml };
