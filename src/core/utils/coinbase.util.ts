import * as crypto from 'crypto';

export function signMessage(str: string, secret: string) {
  return crypto.createHmac('sha256', secret).update(str).digest('hex');
}
