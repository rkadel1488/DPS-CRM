import express from 'express';
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
  app.post('/api/sms/send', async (req, res) => {
    const { phone, variables } = req.body;
    const { studentName, date, tickedPerson, admin } = variables || {};

    const message =
      `DPS School Alert: ${studentName} checked out at ${date}. ` +
      `Picked up by: ${tickedPerson}. Authorized by: ${admin}. ` +
      `If unauthorized, contact school immediately.`;

    try {
      const response = await fetch(`${process.env.NGROK_URL}/send-sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SMS-Secret': process.env.SMS_SECRET || '',
        },
        body: JSON.stringify({ to: phone, message }),
      });

      const data = await response.json();
      if (!response.ok) {
        return res.status(500).json({ error: 'SMS failed', details: data });
      }
      res.status(200).json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: 'Gateway unreachable', details: { message: error.message } });
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
