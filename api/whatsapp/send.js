export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const { phone, templateName, variables } = req.body;
  
  // To send messages, you need the Page Access Token and Phone Number ID from Meta
  const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
  const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) {
    return res.status(500).json({ error: 'WhatsApp API credentials not configured on the server.' });
  }

  try {
    const response = await fetch(`https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: {
          body: `Hello! This is an automated notification.` // Typically you'd use a template here instead
        }
      }),
    });

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return res.status(500).json({ error: 'Failed to send message' });
  }
}
