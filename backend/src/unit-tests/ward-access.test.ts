import { ForbiddenException } from "@nestjs/common";
import { Role } from "@prisma/client";
import { WardAccessService, inNurseWard } from "../wards/ward-access.service";

const medical = { id: "ward-micu", name: "Medical ICU" };
const surgical = { id: "ward-surgery", name: "Surgery" };

/** Builds the service over a nurse assigned to `rows`, whose patient's latest room is `latestRoom`. */
function serviceFor(rows: { wardId: string; holdsUnroomed: boolean }[], latestRoom: unknown = null) {
  const prisma = {
    nurseWard: {
      findMany: jest.fn().mockResolvedValue(
        rows.map((r) => ({ wardId: r.wardId, ward: { holdsUnroomed: r.holdsUnroomed } })),
      ),
    },
    ward: { findFirst: jest.fn().mockResolvedValue({ name: "Emergency" }) },
    patientAdmission: {
      findFirst: jest.fn().mockResolvedValue({ room: latestRoom }),
    },
  };
  return new WardAccessService(prisma as any);
}

const nurse = { id: "nurse-1", role: Role.NURSE };
const physician = { id: "doc-1", role: Role.PHYSICIAN };

describe("inNurseWard", () => {
  const wards = { wardIds: new Set([medical.id]), unroomed: false };

  it("matches a room in one of the nurse's wards", () => {
    expect(inNurseWard(wards, { ward: medical })).toBe(true);
    expect(inNurseWard(wards, { ward: surgical })).toBe(false);
  });

  it("treats a room with no ward as outside every ward", () => {
    expect(inNurseWard(wards, { ward: null })).toBe(false);
  });

  it("puts patients without a room in Emergency", () => {
    expect(inNurseWard(wards, null)).toBe(false);
    expect(inNurseWard({ ...wards, unroomed: true }, null)).toBe(true);
  });
});

describe("WardAccessService", () => {
  const patient = (id: string, room: any) => ({
    id,
    firstName: "Juan",
    lastName: id,
    contactNumber: "0917",
    admissions: [{ id: `adm-${id}`, room }],
  });

  it("keeps only the name of patients outside the nurse's wards", async () => {
    const service = serviceFor([{ wardId: medical.id, holdsUnroomed: false }]);
    const [own, other, unroomed] = (await service.redactPatients(nurse, [
      patient("a", { number: "101", ward: medical }),
      patient("b", { number: "201", ward: surgical }),
      patient("c", null),
    ])) as any[];

    expect(own).toMatchObject({ restricted: false, contactNumber: "0917" });
    expect(other).toEqual({
      id: "b",
      firstName: "Juan",
      lastName: "b",
      restricted: true,
      wardName: "Surgery",
      roomNumber: "201",
      admissions: [],
    });
    expect(unroomed).toMatchObject({ restricted: true, wardName: "Emergency", roomNumber: null });
  });

  it("does not limit other roles", async () => {
    const service = serviceFor([]);
    const list = [patient("b", { number: "201", ward: surgical })];
    await expect(service.redactPatients(physician, list)).resolves.toBe(list);
    await expect(service.assertPatient(physician, "b")).resolves.toBeUndefined();
  });

  it("forbids a nurse from opening a patient in another ward", async () => {
    const service = serviceFor([{ wardId: medical.id, holdsUnroomed: false }], { ward: surgical });
    await expect(service.assertPatient(nurse, "b")).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("lets a nurse open a patient in their ward", async () => {
    const service = serviceFor([{ wardId: medical.id, holdsUnroomed: false }], { ward: medical });
    await expect(service.assertPatient(nurse, "a")).resolves.toBeUndefined();
  });
});
