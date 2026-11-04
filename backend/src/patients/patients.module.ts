import { Module } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { PatientsController } from './patients.controller';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { WardsModule } from '../wards/wards.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuditLogModule, WardsModule, NotificationsModule],
  controllers: [PatientsController],
  providers: [PatientsService],
  exports: [PatientsService],
})
export class PatientsModule {}
