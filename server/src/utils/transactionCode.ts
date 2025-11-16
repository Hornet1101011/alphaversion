// Utility to generate transaction codes in the format: YYYY-XXX-XXXX-XXX
import mongoose from 'mongoose';

function randomSegment(len: number) {
  // produce uppercase alphanumeric characters
  let out = '';
  while (out.length < len) {
    out += Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(2);
  }
  return out.slice(0, len);
}

export function generateTransactionCode(): string {
  const year = new Date().getFullYear();
  const a = randomSegment(3);
  const b = randomSegment(4);
  const c = randomSegment(3);
  return `${year}-${a}-${b}-${c}`;
}

// Try to generate a unique transaction code against the provided Mongoose model
// model should be a Mongoose model that contains a `transactionCode` field
export async function generateUniqueTransactionCode(model: any, field = 'transactionCode', attempts = 6): Promise<string> {
  for (let i = 0; i < attempts; i++) {
    const code = generateTransactionCode();
    try {
      const exists = await model.exists({ [field]: code });
      if (!exists) return code;
    } catch (err) {
      // If the exists check errors, break and fall back to returning the generated code
      console.error('Error checking transactionCode uniqueness:', err);
      break;
    }
  }
  // Fallback: append timestamp to reduce collision chance
  return `${generateTransactionCode()}-${Date.now().toString().slice(-5)}`;
}
