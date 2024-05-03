import { BadRequestException } from '@nestjs/common';
import * as CryptoJS from 'crypto-js';
import { TaskTier } from './entities/task-tier.entity';
import { TaskProgress } from './entities/task-progress.entity';
import { POINT_PASSWORD_KEY } from 'src/core/constants/config.constant';

export const getSignature = (msg: string, key: string): string => {
  if (!key) throw new BadRequestException('Empty sign key');
  return CryptoJS.AES.encrypt(msg, key).toString();
};

export const decryptSignature = (signature: string, key: string): string => {
  if (!key) throw new BadRequestException('Empty sign key');
  return CryptoJS.AES.decrypt(signature, key).toString(CryptoJS.enc.Utf8);
};

export const checkTaskTierSignature = (task_tiers: TaskTier[]): boolean => {
  if (!task_tiers) return false;

  for (let i = 0; i < task_tiers.length; i++) {
    const tier = task_tiers[i];
    const decryptedMsg = decryptSignature(tier.signature, POINT_PASSWORD_KEY);

    if (decryptedMsg != tier.toSignatureMessage()) {
      return false;
    }
  }

  return true;
};

export const checkTaskProgressSignature = (
  task_progress: TaskProgress,
): boolean => {
  if (!task_progress) return true;

  const decryptedMsg = decryptSignature(
    task_progress.signature,
    POINT_PASSWORD_KEY,
  );
  return decryptedMsg === task_progress.toSignatureMessage();
};
