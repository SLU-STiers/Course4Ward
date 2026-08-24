import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';

import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PatientsModule } from './patients/patients.module';
import { OrdersModule } from './orders/orders.module';
import { NotesModule } from './notes/notes.module';
import { CourseInWardModule } from './course-in-ward/course-in-ward.module';
import { ClaimsModule } from './claims/claims.module';
import { AdminModule } from './admin/admin.module';
import { AuditLogModule } from './audit-log/audit-log.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    DatabaseModule,
    AuthModule,
    UsersModule,
    PatientsModule,
    OrdersModule,
    NotesModule,
    CourseInWardModule,
    ClaimsModule,
    AdminModule,
    AuditLogModule,
  ],
})
export class AppModule {}
