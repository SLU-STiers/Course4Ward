import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNoteDto, UpdateNoteDto } from './dto/create-note.dto';

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

  async update(id: string, dto: UpdateNoteDto, physicianId: string) {
    const note = await this.prisma.physicianNote.findFirst({ where: { id, physicianId } });
    if (!note) throw new NotFoundException('Note not found');

    return this.prisma.physicianNote.update({
      where: { id },
      data: {
        ...(dto.content !== undefined ? { notesArray: dto.content } : {}),
        ...(dto.reminderAt !== undefined
          ? { reminderAt: dto.reminderAt ? new Date(dto.reminderAt) : null }
          : {}),
      },
    });
  }

  async remove(id: string, physicianId: string) {
    const note = await this.prisma.physicianNote.findFirst({ where: { id, physicianId } });
    if (!note) throw new NotFoundException('Note not found');
    return this.prisma.physicianNote.delete({ where: { id } });
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
