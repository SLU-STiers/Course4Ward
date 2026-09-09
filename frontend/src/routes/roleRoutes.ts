import type { Role } from '../types';

export const ROLE_PATH: Record<Role, string> = {
  PHYSICIAN: '/physician',
  NURSE: '/nurse',
  CLAIMS_PROCESSOR: '/claims',
  ADMIN: '/admin',
};
