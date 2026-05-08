import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse JSON bodies from HTTP requests
  app.use(express.json());

  // ==========================================
  // WHATSAPP WEBHOOK SETUP
  // ==========================================
  // Replace this with a strong, random string. You will also put this token in the "Verify token" field in the Meta Dashboard.
  const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'my_super_secret_verify_token_123';

  // 1. GET request for Webhook Verification (Meta will call this when you click "Verify and save")
  app.get('/api/whatsapp/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
      if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
        console.log('WEBHOOK_VERIFIED');
        // IMPORTANT: Must send strictly the integer challenge as a response
        res.status(200).send(challenge);
      } else {
        // Responds with '403 Forbidden' if verify tokens do not match
        res.sendStatus(403);
      }
    } else {
      res.status(400).send('Bad Request');
    }
  });

  // 2. POST request for handling incoming messages/events from WhatsApp
  app.post('/api/whatsapp/webhook', (req, res) => {
    const body = req.body;

    console.log('Incoming WhatsApp Webhook:', JSON.stringify(body, null, 2));

    // Return a '200 OK' response to all requests to acknowledge receipt
    res.status(200).send('EVENT_RECEIVED');
  });

  // Add an endpoint to trigger WhatsApp messages
  app.post('/api/whatsapp/send', async (req, res) => {
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
      res.status(200).json(data);
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
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
