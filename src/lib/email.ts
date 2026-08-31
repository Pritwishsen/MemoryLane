import { Resend } from "resend";

let resend: Resend | undefined;

/** Lazily initialized + cached, same pattern as getAdminDb() — throws a
 *  clear error if the key is missing rather than failing deep inside the
 *  Resend SDK with a less obvious message. */
function getResend(): Resend {
  if (resend) return resend;
  if (!process.env.RESEND_API_KEY) {
    throw new Error("Missing RESEND_API_KEY — set it in .env.local to send invite emails");
  }
  resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

type SendInviteEmailParams = {
  to: string;
  hostName: string;
  albumTitle: string;
  summaryUrl: string;
  note: string;
};

/**
 * Without a verified sending domain on the Resend account, Resend only
 * delivers from onboarding@resend.dev, and only to the email address the
 * Resend account itself is registered under (their sandbox restriction) —
 * override RESEND_FROM_EMAIL once a real domain is verified.
 */
export async function sendInviteEmail({
  to,
  hostName,
  albumTitle,
  summaryUrl,
  note,
}: SendInviteEmailParams): Promise<void> {
  const from = process.env.RESEND_FROM_EMAIL || "MemoryLane <onboarding@resend.dev>";

  const html = `
    <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #22201b;">
      <p style="font-family: Arial, sans-serif; text-transform: uppercase; letter-spacing: 0.06em; font-size: 11px; color: #55524a; margin: 0 0 16px;">MemoryLane</p>
      <h1 style="font-size: 22px; margin: 0 0 16px;">${hostName} invited you to relive &ldquo;${albumTitle}&rdquo;</h1>
      ${note ? `<p style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; margin: 0 0 20px; white-space: pre-wrap;">${note}</p>` : ""}
      <p style="margin: 0 0 24px;">
        <a href="${summaryUrl}" style="display: inline-block; background: #1f4e4a; color: #f3ede4; text-decoration: none; padding: 12px 24px; border-radius: 999px; font-family: Arial, sans-serif; font-size: 14px; font-weight: bold;">
          Open the album
        </a>
      </p>
      <p style="font-family: Arial, sans-serif; font-size: 13px; line-height: 1.6; color: #a6402c; margin: 0;">
        Ask ${hostName} to share the album's Google Drive folders with <strong>${to}</strong> too —
        that's what actually lets you see the photos, not this invite.
      </p>
    </div>
  `;

  // The Resend SDK does NOT throw on a failed send — it resolves with
  // { data, error } either way, only logging the error to the console
  // itself. Without this check, a rejected send (e.g. the sandbox-domain
  // restriction) looked identical to a real success to every caller.
  const { error } = await getResend().emails.send({
    from,
    to,
    subject: `${hostName} invited you to relive "${albumTitle}"`,
    html,
  });

  if (error) {
    throw new Error(error.message);
  }
}
