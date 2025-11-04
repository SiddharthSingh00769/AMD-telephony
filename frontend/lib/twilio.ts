import twilio from "twilio";

/**
 * Twilio Client Singleton
 * Configured with credentials from environment variables
 */
export function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    throw new Error(
      "Missing Twilio credentials. Please set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env"
    );
  }

  return twilio(accountSid, authToken);
}

/**
 * Get configured Twilio phone number
 */
export function getTwilioPhoneNumber(): string {
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!phoneNumber) {
    throw new Error(
      "Missing TWILIO_PHONE_NUMBER in environment variables"
    );
  }

  return phoneNumber;
}

/**
 * Validate phone number format
 */
export function isValidPhoneNumber(phoneNumber: string): boolean {
  const formatted = formatPhoneNumber(phoneNumber);
  
  // US numbers: +1 followed by 10 digits
  const isUS = /^\+1\d{10}$/.test(formatted);
  
  // International numbers: + followed by 1-15 digits
  const isInternational = /^\+\d{1,15}$/.test(formatted);
  
  return isUS || isInternational;
}

/**
 * Format phone number to E.164 format
 * @param phoneNumber - Phone number in various formats
 * @returns E.164 formatted phone number (+CCXXXXXXXXXX)
 */
export function formatPhoneNumber(phoneNumber: string): string {
  // Remove all non-digit characters
  const digits = phoneNumber.replace(/\D/g, "");

  // If already starts with +, return as is if valid length
  if (phoneNumber.startsWith("+") && digits.length >= 10 && digits.length <= 15) {
    return phoneNumber.replace(/\D/g, "").replace(/^/, "+");
  }

  // If it's 10 digits, assume US and add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // If it's 11 digits starting with 1, add +
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  // If it's 12 digits starting with 91 (India), add +
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+${digits}`;
  }

  // Default: add + if not present
  if (phoneNumber.startsWith("+")) {
    return phoneNumber;
  }
  
  return `+${digits}`;
}