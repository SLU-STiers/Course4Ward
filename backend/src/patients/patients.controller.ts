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
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PatientsService } from './patients.service';
import {
  AddConsultingPhysicianDto,
  AssignRoomDto,
  CreatePatientDto,
  UpdatePatientDto,
} from './dto/patient.dto';

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

  @Get('physicians')
  @Roles(Role.NURSE)
  listPhysicians() {
    return this.patientsService.listPhysicians();
  }

  @Get('rooms')
  @Roles(Role.NURSE)
  listRooms() {
    return this.patientsService.listRooms();
  }

  @Get()
  @Roles(Role.PHYSICIAN, Role.NURSE, Role.CLAIMS_PROCESSOR)
  findAll(@CurrentUser() user: any) {
    return this.patientsService.findAssignedTo(user.id, user.role);
  }

  @Get('assigned-to-me')
  @Roles(Role.PHYSICIAN, Role.NURSE)
  findAssignedToMe(@CurrentUser() user: any) {
    return this.patientsService.findAssignedTo(user.id, user.role);
  }

  @Get('nurse-assigned')
  @Roles(Role.NURSE)
  findForNurse() {
    return this.patientsService.findAllForNurse();
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

  @Patch('admissions/:id/discharge')
  @Roles(Role.NURSE)
  discharge(@Param('id') id: string, @CurrentUser() user: any) {
    return this.patientsService.dischargeAdmission(id, user.id);
  }

  @Patch('admissions/:id/admit')
  @Roles(Role.NURSE)
  admit(@Param('id') id: string, @CurrentUser() user: any) {
    return this.patientsService.admitAdmission(id, user.id);
  }

  @Patch('admissions/:id/observe')
  @Roles(Role.NURSE)
  observe(@Param('id') id: string, @CurrentUser() user: any) {
    return this.patientsService.observeAdmission(id, user.id);
  }

  @Patch('admissions/:id/room')
  @Roles(Role.NURSE)
  assignRoom(@Param('id') id: string, @Body() dto: AssignRoomDto, @CurrentUser() user: any) {
    return this.patientsService.assignRoom(id, dto.roomNumber, user.id);
  }

  @Post('admissions/:id/consulting-physicians')
  @Roles(Role.NURSE)
  addConsultingPhysician(
    @Param('id') id: string,
    @Body() dto: AddConsultingPhysicianDto,
    @CurrentUser() user: any,
  ) {
    return this.patientsService.addConsultingPhysician(id, dto.physicianId, user.id);
  }
}
