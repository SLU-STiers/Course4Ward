import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNoteDto } from './dto/create-note.dto';

@Injectable()
export class NotesService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateNoteDto, physicianId: string) {
    return this.prisma.physicianNote.create({
      data: {
        patientId: dto.patientId,
        physicianId,
        notesArray: dto.content,
        reminderAt: dto.reminderAt ? new Date(dto.reminderAt) : undefined,
      },
    });
  }

  findForPatient(patientId: string) {
    return this.prisma.physicianNote.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // For a physician's personal reminder feed across all their patients
  findUpcomingReminders(physicianId: string) {
    return this.prisma.physicianNote.findMany({
      where: { physicianId, reminderAt: { gte: new Date() } },
      orderBy: { reminderAt: 'asc' },
      include: { patient: { select: { firstName: true, lastName: true } } },
    });
  }
}
