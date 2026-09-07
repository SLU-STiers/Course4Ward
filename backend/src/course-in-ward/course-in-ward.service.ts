import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { SummaryStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { OrdersService } from '../orders/orders.service';

@Injectable()
export class CourseInWardService {
  private readonly aiServiceUrl: string;

  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
    private ordersService: OrdersService,
    private config: ConfigService,
  ) {
    this.aiServiceUrl = this.config.get<string>('AI_SERVICE_URL') ?? 'http://localhost:8000';
  }

  // Calls the Python/FastAPI + Ollama microservice. This service is the ONLY
  // caller of ai-service -- the frontend never talks to it directly.
  private async callAiSummarizer(orders: any[], patientName: string): Promise<string> {
    try {
      const { data } = await axios.post(
        `${this.aiServiceUrl}/summarize/course-in-ward`,
        {
          patient_name: patientName,
          orders: orders.map((o) => ({
            order_content: o.orderContent,
            order_date: o.dateCreated,
          })),
        },
        { timeout: 30000 },
      );
      return data.summary;
    } catch (err) {
      throw new BadRequestException(
        'AI summarization service is unavailable. Try again or write the summary manually.',
      );
    }
  }

  // "Summarized Physician's Orders" -- generate today's Course in the Ward
  async generateSummary(patientId: string, requestedById: string) {
    const [patient, todaysOrders] = await Promise.all([
      this.prisma.patient.findUnique({ where: { id: patientId } }),
      this.ordersService.findTodaysOrders(patientId),
    ]);
    if (!patient) throw new NotFoundException('Patient not found');
    if (todaysOrders.length === 0) {
      throw new BadRequestException('No orders recorded for this patient today');
    }

    const aiText = await this.callAiSummarizer(
      todaysOrders,
      `${patient.firstName} ${patient.lastName}`,
    );

    const summary = await this.prisma.courseInWard.create({
      data: {
        patientId,
        summaryContent: aiText,
        status: SummaryStatus.DRAFT_AI,
      },
    });

    await this.auditLog.record({
      userId: requestedById,
      action: 'SUMMARY_GENERATED_AI',
    });

    return summary;
  }

  // "Resummarized Physician's Orders" -- option 1: physician manually edits
  async editSummary(id: string, editedText: string, physicianId: string) {
    const existing = await this.findOne(id);
    const updated = await this.prisma.courseInWard.update({
      where: { id },
      data: {
        summaryContent: editedText,
        status: SummaryStatus.DRAFT_EDITED,
      },
    });

    await this.auditLog.record({
      userId: physicianId,
      action: 'SUMMARY_EDITED_MANUAL',
    });

    return updated;
  }

  // "Resummarized Physician's Orders" -- option 2: regenerate via AI
  async regenerateSummary(id: string, physicianId: string) {
    const existing = await this.findOne(id);
    const todaysOrders = await this.ordersService.findTodaysOrders(existing.patientId);
    const patient = await this.prisma.patient.findUnique({ where: { id: existing.patientId } });

    const aiText = await this.callAiSummarizer(
      todaysOrders,
      `${patient!.firstName} ${patient!.lastName}`,
    );

    const updated = await this.prisma.courseInWard.update({
      where: { id },
      data: {
        summaryContent: aiText,
        status: SummaryStatus.DRAFT_AI,
      },
    });

    await this.auditLog.record({
      userId: physicianId,
      action: 'SUMMARY_REGENERATED_AI',
    });

    return updated;
  }

  // Physician approves the summary they deem accurate
  async approve(id: string, physicianId: string) {
    await this.findOne(id);
    const approved = await this.prisma.courseInWard.update({
      where: { id },
      data: {
        status: SummaryStatus.APPROVED,
        approvedStatus: true,
        validatorId: physicianId,
        validatedAt: new Date(),
      },
    });

    await this.auditLog.record({
      userId: physicianId,
      action: 'SUMMARY_APPROVED',
    });

    return approved;
  }

  async findOne(id: string) {
    const summary = await this.prisma.courseInWard.findUnique({ where: { id } });
    if (!summary) throw new NotFoundException('Course in the Ward summary not found');
    return summary;
  }

  findForPatient(patientId: string) {
    return this.prisma.courseInWard.findMany({
      where: { patientId },
      orderBy: { summaryDate: 'desc' },
    });
  }
}
