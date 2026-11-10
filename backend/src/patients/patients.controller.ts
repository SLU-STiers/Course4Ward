import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PatientsService } from './patients.service';
import { WardAccessService } from '../wards/ward-access.service';
import {
  AddConsultingPhysicianDto,
  AssignRoomDto,
  ChangeAttendingDto,
  CreatePatientDto,
  ReadmitPatientDto,
  UpdatePatientDto,
} from './dto/patient.dto';

@ApiTags('patients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('patients')
export class PatientsController {
  constructor(
    private patientsService: PatientsService,
    private wardAccess: WardAccessService,
  ) {}

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
  @Roles(Role.NURSE, Role.PHYSICIAN)
  listRooms(@CurrentUser() user: any, @Query('forTransfer') forTransfer?: string) {
    // A nurse places patients only in their own wards; a transfer order (the
    // physician's decision, or a nurse entering it for them) may go to any ward.
    const anyWard = user.role === Role.PHYSICIAN || forTransfer === 'true';
    return this.patientsService.listRooms(anyWard ? undefined : user.id);
  }

  // Not ward-checked on the patient: a returning patient's last stay may have
  // been in another ward. The new stay's room must be in the nurse's ward.
  @Post(':id/admissions')
  @Roles(Role.NURSE)
  readmit(@Param('id') id: string, @Body() dto: ReadmitPatientDto, @CurrentUser() user: any) {
    return this.patientsService.readmit(id, dto, user.id);
  }

  @Get()
  @Roles(Role.PHYSICIAN, Role.NURSE, Role.CLAIMS_PROCESSOR)
  async findAll(@CurrentUser() user: any) {
    return this.wardAccess.redactPatients(user, await this.patientsService.findAssignedTo(user.id, user.role));
  }

  @Get('assigned-to-me')
  @Roles(Role.PHYSICIAN, Role.NURSE)
  async findAssignedToMe(@CurrentUser() user: any) {
    return this.wardAccess.redactPatients(user, await this.patientsService.findAssignedTo(user.id, user.role));
  }

  @Get('nurse-assigned')
  @Roles(Role.NURSE)
  async findForNurse(@CurrentUser() user: any) {
    return this.wardAccess.redactPatients(user, await this.patientsService.findAllForNurse());
  }

  @Get(':id')
  @Roles(Role.PHYSICIAN, Role.NURSE, Role.CLAIMS_PROCESSOR)
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    await this.wardAccess.assertPatient(user, id);
    return this.patientsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.NURSE, Role.PHYSICIAN)
  async update(@Param('id') id: string, @Body() dto: UpdatePatientDto, @CurrentUser() user: any) {
    await this.wardAccess.assertPatient(user, id);
    return this.patientsService.update(id, dto, user.id);
  }

  @Patch('admissions/:id/discharge')
  @Roles(Role.NURSE)
  async discharge(@Param('id') id: string, @CurrentUser() user: any) {
    await this.wardAccess.assertAdmission(user, id);
    return this.patientsService.dischargeAdmission(id, user.id);
  }

  @Patch('admissions/:id/admit')
  @Roles(Role.NURSE)
  async admit(@Param('id') id: string, @CurrentUser() user: any) {
    await this.wardAccess.assertAdmission(user, id);
    return this.patientsService.admitAdmission(id, user.id);
  }

  @Patch('admissions/:id/observe')
  @Roles(Role.NURSE)
  async observe(@Param('id') id: string, @CurrentUser() user: any) {
    await this.wardAccess.assertAdmission(user, id);
    return this.patientsService.observeAdmission(id, user.id);
  }

  @Patch('admissions/:id/room')
  @Roles(Role.NURSE)
  async assignRoom(@Param('id') id: string, @Body() dto: AssignRoomDto, @CurrentUser() user: any) {
    await this.wardAccess.assertAdmission(user, id);
    return this.patientsService.assignRoom(id, dto.roomNumber, user.id);
  }

  @Patch('admissions/:id/attending')
  @Roles(Role.NURSE)
  async changeAttending(
    @Param('id') id: string,
    @Body() dto: ChangeAttendingDto,
    @CurrentUser() user: any,
  ) {
    await this.wardAccess.assertAdmission(user, id);
    return this.patientsService.changeAttending(id, dto.physicianId, user.id);
  }

  @Post('admissions/:id/consulting-physicians')
  @Roles(Role.NURSE)
  async addConsultingPhysician(
    @Param('id') id: string,
    @Body() dto: AddConsultingPhysicianDto,
    @CurrentUser() user: any,
  ) {
    await this.wardAccess.assertAdmission(user, id);
    return this.patientsService.addConsultingPhysician(id, dto.physicianId, user.id);
  }
}
