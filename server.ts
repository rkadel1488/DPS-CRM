import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse JSON bodies from HTTP requests
  app.use(express.json());

  // ==========================================
  // SMS SEND SETUP (Twilio)
  // ==========================================
  app.post('/api/sms/send', async (req, res) => {
    const { phone, variables, customApi } = req.body;
    
    // Mapping from Settings View:
    // customApi.endpoint -> Twilio Account SID (AC...) OR Custom URL (http...)
    // customApi.apiKey -> Twilio Auth Token OR Custom API Key
    // customApi.senderId -> Twilio Phone Number OR Custom Sender ID

    const isCustomUrl = customApi?.endpoint && customApi.endpoint.startsWith('http');
    
    const twilioSid = (!isCustomUrl ? customApi?.endpoint : null) || process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = customApi?.apiKey || process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = customApi?.senderId || process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_SENDER_ID || '+1234567890';

    if (!isCustomUrl && !twilioSid && !twilioToken) {
      return res.status(500).json({ error: 'SMS Provider credentials not configured on the server or in settings.' });
    }

    try {
      const messageBody = variables 
        ? `Dear Parents, ${variables.studentName} has been Picked up By ${variables.tickedPerson} on ${variables.date}.`
        : `Hello! This is an automated notification.`;

      if (isCustomUrl && !customApi.endpoint.includes('twilio.com')) {
        // Very generic SMS API integration
        const headers = { 'Content-Type': 'application/json' };
        if (customApi.apiKey) headers['Authorization'] = `Bearer ${customApi.apiKey}`;
        
        const response = await fetch(customApi.endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            to: phone,
            from: customApi.senderId,
            text: messageBody,
            msg: messageBody
          })
        });
        const data = await response.text();
        try {
          return res.status(response.status).json(JSON.parse(data));
        } catch (e) {
          return res.status(response.status).send(data);
        }
      }

      // Default to Twilio
      const authHeaders = {
        'Authorization': 'Basic ' + Buffer.from(twilioSid + ':' + twilioToken).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      };

      const formData = new URLSearchParams();
      formData.append('To', phone);
      formData.append('From', fromNumber);
      formData.append('Body', messageBody);

      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;

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

      res.status(200).json(data);
    } catch (error) {
      console.error('Error sending SMS message:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  });
  // ==========================================

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
