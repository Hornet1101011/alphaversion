import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
const authToken = process.env.TWILIO_AUTH_TOKEN || '';
const fromNumber = process.env.TWILIO_FROM_NUMBER || '';

const client = twilio(accountSid, authToken);

export async function sendUrgentSms(to: string, message: string) {
  if (!to || !message) throw new Error('Missing recipient or message');
  await client.messages.create({
    body: message,
    from: fromNumber,
    to,
  });
}
