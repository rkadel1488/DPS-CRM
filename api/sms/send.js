export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const { phone, variables, customApi } = req.body;
  
  // customApi.apiKey = key
  // customApi.endpoint = campaign
  // customApi.routeId = routeid
  // customApi.senderId = senderid
  
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

    return res.status(200).json({ success: true, response: parsedData });
  } catch (error) {
    console.error('Error sending SMS message:', error);
    return res.status(500).json({ error: 'Failed to send message' });
  }
}

