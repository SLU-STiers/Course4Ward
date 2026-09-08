import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ClaimsService } from './claims.service';

class CreateClaimDto {
  @IsUUID()
  courseInWardId: string;
}

@ApiTags('claims')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('claims')
export class ClaimsController {
  constructor(private claimsService: ClaimsService) {}

  @Post()
  @Roles(Role.CLAIMS_PROCESSOR)
  create(@Body() dto: CreateClaimDto, @CurrentUser() user: any) {
    return this.claimsService.createFromSummary(dto.courseInWardId, user.id);
  }

  @Get()
  @Roles(Role.CLAIMS_PROCESSOR)
  findAll() {
    return this.claimsService.findAll();
  }

  @Get('physician-requests')
  @Roles(Role.PHYSICIAN)
  findForPhysician(@CurrentUser() user: any) {
    return this.claimsService.findForPhysician(user.id);
  }

  @Patch(':id/approve')
  @Roles(Role.PHYSICIAN)
  approve(@Param('id') id: string, @CurrentUser() user: any) {
    return this.claimsService.approveForPhysician(id, user.id);
  }

  @Post(':id/notify-physician')
  @Roles(Role.CLAIMS_PROCESSOR)
  notifyPhysician(@Param('id') id: string, @CurrentUser() user: any) {
    return this.claimsService.notifyPhysician(id, user.id);
  }

  @Post(':id/generate-cf4')
  @Roles(Role.CLAIMS_PROCESSOR)
  generateCf4(@Param('id') id: string, @CurrentUser() user: any) {
    return this.claimsService.generateCf4(id, user.id);
  }
}
