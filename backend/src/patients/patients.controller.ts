import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '../common/types/domain';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PatientsService } from './patients.service';
import { CreatePatientDto, UpdatePatientDto } from './dto/patient.dto';

@ApiTags('patients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('patients')
export class PatientsController {
  constructor(private patientsService: PatientsService) {}

  @Post()
  @Roles(Role.NURSE)
  create(@Body() dto: CreatePatientDto, @CurrentUser() user: any) {
    return this.patientsService.create(dto, user.id);
  }

  @Get('assigned-to-me')
  @Roles(Role.PHYSICIAN, Role.NURSE)
  findAssignedToMe(@CurrentUser() user: any) {
    return this.patientsService.findAssignedTo(user.id);
  }

  @Get(':id')
  @Roles(Role.PHYSICIAN, Role.NURSE, Role.CLAIMS_PROCESSOR)
  findOne(@Param('id') id: string) {
    return this.patientsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.NURSE, Role.PHYSICIAN)
  update(@Param('id') id: string, @Body() dto: UpdatePatientDto, @CurrentUser() user: any) {
    return this.patientsService.update(id, dto, user.id);
  }
}
