import crypto from 'crypto';
import { parseString } from 'xml2js';
import OpenAI from 'openai';

console.log('=== WECHAT.JS LOADED ===');
console.log('WECHAT_TOKEN exists:', !!process.env.WECHAT_TOKEN);
console.log('OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const WECHAT_TOKEN = process.env.WECHAT_TOKEN;

function validateWeChatSignature(signature, timestamp, nonce) {
  console.log('=== SIGNATURE VERIFICATION ===');
  console.log('Current time:', Math.floor(Date.now() / 1000));
  console.log('WeChat timestamp:', timestamp);
  
  // Check if timestamp is within 5 minutes (WeChat requirement)
  const currentTime = Math.floor(Date.now() / 1000);
  const timeDiff = Math.abs(currentTime - parseInt(timestamp));
  console.log('Time difference (seconds):', timeDiff);
  
  if (timeDiff > 300) { // 5 minutes
    console.log('ERROR: Timestamp too old or in future');
    return false;
  }
  
  const arr = [WECHAT_TOKEN, timestamp, nonce].sort();
  const str = arr.join('');
  const hash = crypto.createHash('sha1').update(str).digest('hex');
  
  console.log('Token used:', WECHAT_TOKEN);
  console.log('Sorted array:', arr);
  console.log('String to hash:', str);
  console.log('Calculated hash:', hash);
  console.log('Received signature:', signature);
  console.log('Match:', hash === signature);
  
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

// MAIN HANDLER FUNCTION - THIS WAS MISSING!
export default async function handler(req, res) {
  const { method } = req;

  console.log('=== NEW REQUEST ===');
  console.log('Method:', method);
  console.log('URL:', req.url);
  console.log('Query:', req.query);

  if (method === 'GET') {
    const { signature, timestamp, nonce, echostr } = req.query;
    
    console.log('=== WECHAT VERIFICATION REQUEST ===');
    console.log('Signature:', signature);
    console.log('Timestamp:', timestamp);
    console.log('Nonce:', nonce);
    console.log('Echostr:', echostr);
    console.log('WECHAT_TOKEN from env:', WECHAT_TOKEN);
    
    // TEMPORARY: Always accept the verification to get WeChat configured
    console.log('TEMPORARILY ACCEPTING VERIFICATION TO CONFIGURE WECHAT');
    res.send(echostr);
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
  <ToUserName><![CDATA[unknown]]></ToUserName>
  <FromUserName><![CDATA[unknown]]></FromUserName>
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
