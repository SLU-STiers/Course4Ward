import { Module } from '@nestjs/common';
import { ClaimsService } from './claims.service';
import { ClaimsController } from './claims.controller';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuditLogModule, NotificationsModule],
  controllers: [ClaimsController],
  providers: [ClaimsService],
})
export class ClaimsModule {}
