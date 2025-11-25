import crypto from 'crypto';
import { parseString } from 'xml2js';

console.log('=== WECHAT AI LOADED ===');

export default async function handler(req, res) {
  const { method } = req;

  console.log('Request method:', method);

  // Handle WeChat verification
  if (method === 'GET') {
    const { signature, timestamp, nonce, echostr } = req.query;
    
    console.log('WeChat verification request');
    console.log('Params:', { signature, timestamp, nonce, echostr });
    
    // ALWAYS ACCEPT VERIFICATION
    console.log('ACCEPTING VERIFICATION');
    res.send(echostr);
    return;
  }

  // Handle WeChat messages
  if (method === 'POST') {
    console.log('=== PROCESSING WECHAT MESSAGE ===');
    
    try {
      // Read the XML data
      let xmlData = '';
      req.on('data', chunk => {
        xmlData += chunk.toString();
      });

      req.on('end', async () => {
        try {
          console.log('Received XML:', xmlData);

          // Parse XML
          const result = await new Promise((resolve, reject) => {
            parseString(xmlData, { explicitArray: false }, (err, result) => {
              if (err) reject(err);
              else resolve(result);
            });
          });

          const message = result.xml;
          console.log('Parsed message:', message);

          const userMessage = message.Content || 'Hello';
          console.log('User said:', userMessage);

          // Create SIMPLE response (no OpenAI for now)
          const responseText = `I received your message: "${userMessage}". This is a test response from your AI assistant!`;
          
          const responseXml = `
<xml>
  <ToUserName><![CDATA[${message.FromUserName}]]></ToUserName>
  <FromUserName><![CDATA[${message.ToUserName}]]></ToUserName>
  <CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>
  <MsgType><![CDATA[text]]></MsgType>
  <Content><![CDATA[${responseText}]]></Content>
</xml>`.trim();

          console.log('Sending response:', responseText);
          
          res.setHeader('Content-Type', 'application/xml');
          res.send(responseXml);
          
          console.log('=== RESPONSE SENT ===');

        } catch (parseError) {
          console.error('XML parse error:', parseError);
          res.status(500).send('Parse error');
        }
      });

    } catch (error) {
      console.error('General error:', error);
      res.status(500).send('Server error');
    }
    return;
  }

  res.status(405).send('Method not allowed');
}
