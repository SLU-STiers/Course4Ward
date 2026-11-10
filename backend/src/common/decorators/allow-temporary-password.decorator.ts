import { SetMetadata } from '@nestjs/common';

export const ALLOW_TEMPORARY_PASSWORD_KEY = 'allowTemporaryPassword';

/**
 * Lets a user still on an admin-issued temporary password call this route.
 * Every other authenticated route refuses them until they choose their own.
 */
export const AllowTemporaryPassword = () => SetMetadata(ALLOW_TEMPORARY_PASSWORD_KEY, true);
