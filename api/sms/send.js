export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const { phone, variables } = req.body;
  
  const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
  const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
  const FROM_NUMBER = process.env.TWILIO_PHONE_NUMBER;

  if (!ACCOUNT_SID || !AUTH_TOKEN || !FROM_NUMBER) {
    return res.status(500).json({ error: 'Twilio API credentials not configured on the server.' });
  }

  try {
    const messageBody = variables 
      ? `Dear Parents, ${variables.studentName} has been Picked up By ${variables.tickedPerson} on ${variables.date}.`
      : `Hello! This is an automated notification.`;

    // Twilio Basic Auth
    const authHeaders = {
      'Authorization': 'Basic ' + Buffer.from(ACCOUNT_SID + ':' + AUTH_TOKEN).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    const formData = new URLSearchParams();
    formData.append('To', phone);
    formData.append('From', FROM_NUMBER);
    formData.append('Body', messageBody);

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`;

    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: authHeaders,
      body: formData.toString()
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Twilio API Error Response:', data);
      return res.status(response.status).json({ 
        error: 'Twilio API Error', 
        details: data 
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Error sending SMS message:', error);
    return res.status(500).json({ error: 'Failed to send message' });
  }
}
