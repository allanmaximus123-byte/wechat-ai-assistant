import crypto from 'crypto';
import { parseString } from 'xml2js';
import OpenAI from 'openai';  // Fixed this line

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const WECHAT_TOKEN = process.env.WECHAT_TOKEN;

function validateWeChatSignature(signature, timestamp, nonce) {
  const arr = [WECHAT_TOKEN, timestamp, nonce].sort();
  const str = arr.join('');
  const hash = crypto.createHash('sha1').update(str).digest('hex');
  return hash === signature;
}

function parseWeChatMessage(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      parseString(data, { explicitArray: false }, (err, result) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(result.xml);
      });
    });
  });
}

function buildTextResponse(originalMessage, content) {
  return `
<xml>
  <ToUserName><![CDATA[${originalMessage.FromUserName}]]></ToUserName>
  <FromUserName><![CDATA[${originalMessage.ToUserName}]]></FromUserName>
  <CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>
  <MsgType><![CDATA[text]]></MsgType>
  <Content><![CDATA[${content}]]></Content>
</xml>
  `.trim();
}

async function getAIResponse(userMessage) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a helpful customer service assistant for a business on WeChat. Keep responses friendly and helpful.`
        },
        {
          role: "user",
          content: userMessage
        }
      ],
      max_tokens: 500,
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI API error:', error);
    return "I'm having trouble processing your request. Please try again later.";
  }
}

export default async function handler(req, res) {
  const { method } = req;

  if (method === 'GET') {
    const { signature, timestamp, nonce, echostr } = req.query;
    
    if (validateWeChatSignature(signature, timestamp, nonce)) {
      console.log('WeChat verification successful');
      res.send(echostr);
    } else {
      console.log('WeChat verification failed');
      res.status(403).send('Invalid signature');
    }
    return;
  }

  if (method === 'POST') {
    try {
      console.log('=== WECHAT MESSAGE RECEIVED ===');
      
      const message = await parseWeChatMessage(req);
      console.log('Customer message:', message.Content);
      
      const aiResponse = await getAIResponse(message.Content);
      console.log('AI Response:', aiResponse);
      
      const responseXml = buildTextResponse(message, aiResponse);
      
      res.setHeader('Content-Type', 'application/xml');
      res.send(responseXml);
      
      console.log('=== RESPONSE SENT ===');
    } catch (error) {
      console.error('Error handling message:', error);
      // Send a simple error response without trying to parse again
      const errorResponse = `
<xml>
  <ToUserName><![CDATA[${req.body?.FromUserName || 'user'}]]></ToUserName>
  <FromUserName><![CDATA[${req.body?.ToUserName || 'server'}]]></FromUserName>
  <CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>
  <MsgType><![CDATA[text]]></MsgType>
  <Content><![CDATA[Sorry, I'm having technical issues. Please try again later.]]></Content>
</xml>
      `.trim();
      res.setHeader('Content-Type', 'application/xml');
      res.send(errorResponse);
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
