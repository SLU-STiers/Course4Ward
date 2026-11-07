import { Module } from '@nestjs/common';
import { CourseInWardService } from './course-in-ward.service';
import { CourseInWardController } from './course-in-ward.controller';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { OrdersModule } from '../orders/orders.module';
import { WardsModule } from '../wards/wards.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuditLogModule, OrdersModule, WardsModule, NotificationsModule],
  controllers: [CourseInWardController],
  providers: [CourseInWardService],
  exports: [CourseInWardService],
})
export class CourseInWardModule {}
