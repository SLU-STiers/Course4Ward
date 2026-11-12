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
import { CourseInWardService } from './course-in-ward.service';
import { WardAccessService } from '../wards/ward-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { assertPatientCareTeam, assertSummaryCareTeam } from './summary-access';
import {
  GenerateSummaryDto,
  EditSummaryDto,
  NotifyAttendingDto,
  RegenerateSummaryDto,
} from './dto/course-in-ward.dto';

@ApiTags('course-in-ward')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('course-in-ward')
export class CourseInWardController {
  constructor(
    private courseInWardService: CourseInWardService,
    private wardAccess: WardAccessService,
    private prisma: PrismaService,
  ) {}

  // Physicians may only work on summaries of admissions they attend or consult
  // on; approving is checked in the service (attending only), so the claims
  // approval path is covered too. The nightly batch calls the service directly.

  @Post('generate')
  @Roles(Role.PHYSICIAN)
  async generate(@Body() dto: GenerateSummaryDto, @CurrentUser() user: any) {
    await assertPatientCareTeam(this.prisma, dto.patientId, user.id);
    // Returns one Course in the Ward per summarized order day (usually one).
    return this.courseInWardService.generateSummary(
      dto.patientId,
      user.id,
      dto.day,
      dto.model,
      dto.instructions,
    );
  }

  @Patch(':id/edit')
  @Roles(Role.PHYSICIAN)
  async edit(@Param('id') id: string, @Body() dto: EditSummaryDto, @CurrentUser() user: any) {
    await assertSummaryCareTeam(this.prisma, id, user.id);
    return this.courseInWardService.editSummary(id, dto.editedText, user.id);
  }

  @Post(':id/regenerate')
  @Roles(Role.PHYSICIAN)
  async regenerate(
    @Param('id') id: string,
    @Body() dto: RegenerateSummaryDto,
    @CurrentUser() user: any,
  ) {
    await assertSummaryCareTeam(this.prisma, id, user.id);
    return this.courseInWardService.regenerateSummary(id, user.id, dto.instructions, dto.model);
  }

  /**
   * Summaries of the physician's patients that still need approving, including
   * patients who have already been discharged.
   */
  @Get('pending')
  @Roles(Role.PHYSICIAN)
  pending(@CurrentUser() user: any) {
    return this.courseInWardService.findPendingForPhysician(user.id);
  }

  @Get(':id/versions')
  @Roles(Role.PHYSICIAN)
  async versions(@Param('id') id: string, @CurrentUser() user: any) {
    await assertSummaryCareTeam(this.prisma, id, user.id);
    return this.courseInWardService.listVersions(id);
  }

  @Post(':id/versions/:versionId/restore')
  @Roles(Role.PHYSICIAN)
  async restore(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
    @CurrentUser() user: any,
  ) {
    await assertSummaryCareTeam(this.prisma, id, user.id);
    return this.courseInWardService.restoreVersion(id, versionId, user.id);
  }

  @Patch(':id/approve')
  @Roles(Role.PHYSICIAN)
  approve(
    @Param('id') id: string,
    @Query('completeClaim') completeClaim: string | undefined,
    @CurrentUser() user: any,
  ) {
    // Per-day approve from Requests passes completeClaim=false so the claim
    // stays open until "Approve request".
    return this.courseInWardService.approve(
      id,
      user.id,
      completeClaim === undefined ? true : completeClaim !== 'false',
    );
  }

  /**
   * Consulting physician tells the attending they reviewed / endorse this day's
   * draft (once per Manila day, discharged stays only). Does not approve claims.
   */
  @Post(':id/notify-attending')
  @Roles(Role.PHYSICIAN)
  notifyAttending(
    @Param('id') id: string,
    @Body() dto: NotifyAttendingDto,
    @CurrentUser() user: any,
  ) {
    return this.courseInWardService.notifyAttending(id, user.id, dto.message);
  }

  @Get('patient/:patientId')
  @Roles(Role.PHYSICIAN, Role.NURSE, Role.CLAIMS_PROCESSOR)
  async findForPatient(@Param('patientId') patientId: string, @CurrentUser() user: any) {
    await this.wardAccess.assertPatient(user, patientId);
    return this.courseInWardService.findForPatient(
      patientId,
      user.role === Role.PHYSICIAN ? user.id : undefined,
    );
  }
}
