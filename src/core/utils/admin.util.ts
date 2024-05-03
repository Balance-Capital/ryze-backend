import * as bcrypt from 'bcrypt';
import { loadEnvVariable } from './base.util';

export const checkAdminPassword = async (password_encrypted: string) => {
  try {
    const admin_password = loadEnvVariable('ADMIN_PASSWORD');
    const match = await bcrypt.compare(admin_password, password_encrypted);
    return match;
  } catch {
    return false;
  }
};
