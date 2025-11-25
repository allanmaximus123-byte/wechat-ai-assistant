import crypto from 'crypto';
import { parseString } from 'xml2js';
import OpenAI from 'openai';

console.log('=== WECHAT AI ASSISTANT STARTED ===');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const WECHAT_TOKEN = process.env.WECHAT_TOKEN;

// Main function that handles all requests
export default async function handler(req, res) {
  const { method } = req;

  console.log('=== NEW REQUEST ===');
  console.log('Method:', method);

  // Handle WeChat verification (GET requests)
  if (method === 'GET') {
    const { signature, timestamp, nonce, echostr } = req.query;
    
    console.log('WeChat verification request received');
    
    // Always accept verification for now
    console.log('ACCEPTING VERIFICATION');
    res.send(echostr);
    return;
  }

  // Handle WeChat messages (POST requests)
  if (method === 'POST') {
    try {
      console.log('=== WECHAT MESSAGE RECEIVED ===');
      
      // Step 1: Read the XML data from WeChat
      let xmlData = '';
      req.on('data', chunk => {
        xmlData += chunk;
      });
      
      req.on('end', async () => {
        try {
          console.log('Raw XML received:', xmlData);
          
          // Step 2: Parse the XML
          const result = await new Promise((resolve, reject) => {
            parseString(xmlData, { explicitArray: false }, (err, result) => {
              if (err) reject(err);
              else resolve(result);
            });
          });
          
          console.log('Parsed message:', JSON.stringify(result, null, 2));
          
          const message = result.xml;
          const userMessage = message.Content;
          console.log('User message text:', userMessage);
          
          // Step 3: If no message content, send error
          if (!userMessage) {
            console.log('No text message content found');
            const responseXml = `
<xml>
  <ToUserName><![CDATA[${message.FromUserName}]]></ToUserName>
  <FromUserName><![CDATA[${message.ToUserName}]]></FromUserName>
  <CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>
  <MsgType><![CDATA[text]]></MsgType>
  <Content><![CDATA[I only support text messages. Please send text only.]]></Content>
</xml>`.trim();
            res.setHeader('Content-Type', 'application/xml');
            res.send(responseXml);
            return;
          }
          
          // Step 4: SIMPLE TEST - Use hardcoded response first
          console.log('=== USING HARDCODED RESPONSE FOR TESTING ===');
          const aiResponse = "Hello! I received your message: '" + userMessage + "'. How can I help you today?";
          
          // Step 5: Create response XML
          const responseXml = `
<xml>
  <ToUserName><![CDATA[${message.FromUserName}]]></ToUserName>
  <FromUserName><![CDATA[${message.ToUserName}]]></FromUserName>
  <CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>
  <MsgType><![CDATA[text]]></MsgType>
  <Content><![CDATA[${aiResponse}]]></Content>
</xml>`.trim();
          
          console.log('Sending response:', aiResponse);
          
          // Step 6: Send response back to WeChat
          res.setHeader('Content-Type', 'application/xml');
          res.send(responseXml);
          
          console.log('=== RESPONSE SENT SUCCESSFULLY ===');
          
        } catch (error) {
          console.error('Error processing message:', error);
          // Send error response
          const errorResponse = `
<xml>
  <ToUserName><![CDATA[unknown]]></ToUserName>
  <FromUserName><![CDATA[unknown]]></FromUserName>
  <CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>
  <MsgType><![CDATA[text]]></MsgType>
  <Content><![CDATA[Sorry, I encountered an error. Please try again.]]></Content>
</xml>`.trim();
          res.setHeader('Content-Type', 'application/xml');
          res.send(errorResponse);
        }
      });
      
    } catch (error) {
      console.error('Error in POST handler:', error);
      res.status(500).send('Server error');
    }
    return;
  }

  // If not GET or POST
  res.status(405).send('Method not allowed');
}
