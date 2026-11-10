import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { BatchTestService } from './batch-test.service';
import { CourseInWardModule } from '../course-in-ward/course-in-ward.module';

/**
 * Read-only admin analytics. Lives beside AuditLogModule (which owns the
 * activity log itself) because the reporting section aggregates the audit log
 * together with the clinical tables. `PrismaModule` is global, so it is not
 * imported here.
 */
@Module({
  imports: [CourseInWardModule],
  controllers: [ReportsController],
  providers: [ReportsService, BatchTestService],
  exports: [ReportsService],
})
export class ReportsModule {}
