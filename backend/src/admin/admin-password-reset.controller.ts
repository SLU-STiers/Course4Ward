import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PasswordResetQueryDto } from './dto/password-reset-query.dto';

@ApiTags('admin-password-resets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/password-reset-requests')
export class AdminPasswordResetController {
  constructor(private authService: AuthService) {}

  @Get()
  findAll(@Query() query: PasswordResetQueryDto) {
    return this.authService.findPasswordResetRequests(query);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() admin: any) {
    return this.authService.approvePasswordReset(id, admin.id);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @CurrentUser() admin: any) {
    return this.authService.rejectPasswordReset(id, admin.id);
  }
}