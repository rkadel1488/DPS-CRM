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

      res.status(200).json(data);
    } catch (error) {
      console.error('Error sending Twilio message:', error);
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
