import express from 'express';
import rateLimit from 'express-rate-limit';
import { createServer as createViteServer } from 'vite';
import path from 'path';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse JSON bodies from HTTP requests
  app.use(express.json());

  // ==========================================
  // SMS SEND SETUP
  // ==========================================
  const smsRateLimit = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    message: { error: 'Too many SMS requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.post('/api/sms/send', smsRateLimit, async (req, res) => {
    const { phone, variables, customApi } = req.body;

    // Input validation
    if (typeof phone !== 'string' || !/^\+?[0-9]{7,15}$/.test(phone.trim())) {
      return res.status(400).json({ error: 'Invalid phone number format.' });
    }
    if (variables !== undefined && (typeof variables !== 'object' || Array.isArray(variables))) {
      return res.status(400).json({ error: 'Invalid variables format.' });
    }
    
    // Mapping from Settings View:
    const smsKey = customApi?.apiKey;
    const smsCampaign = customApi?.endpoint;
    const smsRouteId = customApi?.routeId;
    const smsSenderId = customApi?.senderId;

    if (!smsKey || !smsCampaign || !smsRouteId || !smsSenderId) {
      return res.status(500).json({ error: 'SMS Provider credentials not configured properly in settings.' });
    }

    try {
      const messageBody = variables 
        ? `Dear Parents, ${variables.studentName} has been Picked up By ${variables.tickedPerson} on ${variables.date}.`
        : `Hello! This is an automated notification.`;

      const formData = new URLSearchParams();
      formData.append('key', smsKey);
      formData.append('campaign', smsCampaign);
      formData.append('routeid', smsRouteId);
      formData.append('type', 'text');
      formData.append('contacts', phone); // e.g. 984XXXXXXX
      formData.append('senderid', smsSenderId);
      formData.append('msg', messageBody);

      const response = await fetch('https://sms.smspasal.com/smsapi/index.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString()
      });

      const data = await response.text();
      let parsedData = data;
      try {
        if (data.trim().startsWith('{') || data.trim().startsWith('[')) {
          parsedData = JSON.parse(data);
        }
      } catch(e) {}
      
      if (!response.ok) {
        console.error('SMS Pasal API Error Response:', parsedData);
        return res.status(response.status).json({ 
          error: 'SMS Pasal API Error', 
          details: parsedData 
        });
      }

      res.status(200).json({ success: true, response: parsedData });
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
