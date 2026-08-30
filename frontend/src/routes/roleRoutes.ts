//Temporary route mapping (URL -> Role) for development purposes
import type { Role } from '../types';

export const ROLE_PATH: Record<Role, string> = {
  PHYSICIAN: '/physician',
  NURSE: '/nurse',
  CLAIMS_PROCESSOR: '/claims',
  ADMIN: '/admin',
};

export const PATH_ROLE: Record<string, Role> = {
  '/physician': 'PHYSICIAN',
  '/nurse': 'NURSE',
  '/claims': 'CLAIMS_PROCESSOR',
  '/admin': 'ADMIN',
};
