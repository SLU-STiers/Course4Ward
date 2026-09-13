import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { AuthModule } from '../auth/auth.module';
import { AdminPasswordResetController } from './admin-password-reset.controller';

// Admin capabilities are implemented as two focused modules mounted under
// /admin/* : UsersModule (account management) and AuditLogModule
// (transaction logs + analytics). This module just groups them so
// AppModule has a single "admin" import, mirroring the functional
// requirement grouping.
@Module({
  imports: [UsersModule, AuditLogModule, AuthModule],
  controllers: [AdminPasswordResetController],
})
export class AdminModule {}
