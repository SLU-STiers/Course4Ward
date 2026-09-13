import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@ApiTags('admin-password-resets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/password-reset-requests')
export class AdminPasswordResetController {
  constructor(private authService: AuthService) {}

  @Get()
  findAll() {
    return this.authService.findPasswordResetRequests();
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() admin: any) {
    return this.authService.approvePasswordReset(id, admin.id);
  }
}