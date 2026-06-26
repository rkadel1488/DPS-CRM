export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { phone, variables } = req.body;
  const { studentName, date, tickedPerson, admin } = variables || {};

  const message =
    `DPS School Alert: ${studentName} checked out at ${date}. ` +
    `Picked up by: ${tickedPerson}. Authorized by: ${admin}. ` +
    `If unauthorized, contact school immediately.`;

  try {
    const response = await fetch(`${process.env.NGROK_URL}/send-sms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-SMS-Secret": process.env.SMS_SECRET || "",
      },
      body: JSON.stringify({ to: phone, message }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(500).json({ error: "SMS failed", details: data });
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Gateway unreachable", details: { message: err.message } });
  }
}
