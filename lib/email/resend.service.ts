import { Resend } from 'resend';

let _resend: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

export interface AlertEmailPayload {
  toEmail: string;
  countryName: string;
  countryCode: string;
  newScore: number;
  oldScore: number;
  changeType: 'security_improved' | 'cheap_flights' | 'currency' | 'jackpot' | 'general';
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'IDÉALE ✅';
  if (score >= 60) return 'RECOMMANDÉE 🟡';
  if (score >= 40) return 'POSSIBLE 🟠';
  return 'DÉCONSEILLÉE 🔴';
}

export async function sendAlertEmail(payload: AlertEmailPayload): Promise<boolean> {
  const resend = getResend();
  if (!resend) {
    console.log('[Resend] API key manquante — simulation email:', payload);
    return false;
  }

  const { toEmail, countryName, countryCode, newScore, oldScore } = payload;
  const delta = newScore - oldScore;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://crisis-travel.app';

  try {
    await resend.emails.send({
      from: 'Crisis Travel <alertes@crisis-travel.app>',
      to: toEmail,
      subject: `⚡ ${countryName} — CrisisScore amélioré : ${newScore}/100`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="background:#07070c;color:#f0f0f5;font-family:'Courier New',monospace;margin:0;padding:20px;">
  <div style="max-width:520px;margin:0 auto;">

    <div style="border-bottom:1px solid #1f1f30;padding-bottom:16px;margin-bottom:20px;">
      <div style="color:#ff3b2f;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:6px;">
        ⚡ CRISIS TRAVEL · ALERTE DESTINATION
      </div>
      <div style="font-size:22px;font-weight:700;color:#f0f0f5;">${countryName}</div>
      <div style="font-size:11px;color:#6b6b85;margin-top:3px;">CODE: ${countryCode} · ${new Date().toLocaleDateString('fr-FR')}</div>
    </div>

    <div style="background:#11111c;border:1px solid #2e2e45;border-radius:10px;padding:18px;margin-bottom:20px;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
        <div style="text-align:center;">
          <div style="font-size:9px;color:#6b6b85;letter-spacing:0.14em;margin-bottom:4px;">ANCIEN SCORE</div>
          <div style="font-size:28px;font-weight:700;color:#9898b0;">${oldScore}</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:9px;color:#6b6b85;letter-spacing:0.14em;margin-bottom:4px;">NOUVEAU SCORE</div>
          <div style="font-size:28px;font-weight:700;color:#3ddc97;">${newScore}</div>
        </div>
      </div>
      <div style="text-align:center;font-size:13px;color:#3ddc97;font-weight:700;">
        +${delta} points · ${scoreLabel(newScore)}
      </div>
    </div>

    <a href="${appUrl}/destination/${countryCode.toLowerCase()}"
       style="display:block;padding:12px;background:#ff3b2f;color:#fff;text-decoration:none;text-align:center;border-radius:8px;font-size:11px;letter-spacing:0.12em;font-weight:700;margin-bottom:20px;">
      VOIR LA FICHE COMPLÈTE →
    </a>

    <div style="font-size:10px;color:#3f3f5a;text-align:center;border-top:1px solid #1f1f30;padding-top:14px;">
      Vous recevez cet email car vous avez créé une alerte pour ${countryName}.<br/>
      <a href="${appUrl}" style="color:#6b6b85;">Gérer mes alertes</a>
    </div>
  </div>
</body>
</html>
      `.trim(),
    });
    return true;
  } catch (error) {
    console.error('[Resend] Erreur envoi email:', error);
    return false;
  }
}
