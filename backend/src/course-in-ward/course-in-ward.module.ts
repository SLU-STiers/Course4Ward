import { Module } from '@nestjs/common';
import { CourseInWardService } from './course-in-ward.service';
import { CourseInWardController } from './course-in-ward.controller';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [AuditLogModule, OrdersModule],
  controllers: [CourseInWardController],
  providers: [CourseInWardService],
  exports: [CourseInWardService],
})
export class CourseInWardModule {}
