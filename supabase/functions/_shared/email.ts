export async function sendAdminEmail(subject: string, html: string): Promise<void> {
  const apiKey = Deno.env.get("BREVO_API_KEY");
  const adminEmail = Deno.env.get("ADMIN_EMAIL") ?? "info@active.cruises";
  if (!apiKey) {
    console.warn("BREVO_API_KEY not set, skipping email");
    return;
  }

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "Charter Deposits", email: adminEmail },
        to: [{ email: adminEmail }],
        subject,
        htmlContent: html,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("Brevo error:", res.status, body);
    }
  } catch (e) {
    console.error("Email send failed:", e);
  }
}
