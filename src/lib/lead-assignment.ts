/**
 * Auto-assign new clients to a staff member based on the business's
 * leadAssignmentMode. Returns the staff id to set on Client.assignedStaffId,
 * or null if no auto-assignment applies.
 *
 * Modes:
 *   manual       — return null, owner / referral links handle assignment
 *   round_robin  — pick the next acceptsLeads staff after lastAssignedStaffId
 *   by_load      — pick the staff with the fewest open tasks + active deals
 *   ai_smart     — return null, AI назначит позже через route_to_specialist tool
 *                  когда поймёт специализацию из контекста разговора. Если
 *                  назначить заранее — AI не сможет переназначить (continuity).
 */

import { prisma } from "./prisma";

export async function pickStaffForNewLead(businessId: string): Promise<string | null> {
  try {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { leadAssignmentMode: true, lastAssignedStaffId: true },
    });
    if (!business || business.leadAssignmentMode === "manual") return null;
    // AI smart режим — оставляем клиента без назначения, AI сам направит
    // через route_to_specialist tool когда поймёт контекст.
    if (business.leadAssignmentMode === "ai_smart") return null;

    // Fetch eligible staff in stable order so round-robin is deterministic.
    const eligible = await prisma.staff.findMany({
      where: { businessId, acceptsLeads: true },
      select: { id: true },
      orderBy: { id: "asc" },
    });
    if (eligible.length === 0) return null;

    if (business.leadAssignmentMode === "round_robin") {
      // Find the index AFTER the last-assigned id, wrapping around.
      const lastIdx = business.lastAssignedStaffId
        ? eligible.findIndex((s) => s.id === business.lastAssignedStaffId)
        : -1;
      const nextIdx = (lastIdx + 1) % eligible.length;
      const chosen = eligible[nextIdx].id;
      await prisma.business.update({
        where: { id: businessId },
        data: { lastAssignedStaffId: chosen },
      });
      return chosen;
    }

    if (business.leadAssignmentMode === "by_load") {
      // Compute load for each eligible staff: pending tasks + active-stage clients.
      // "Active stage" = lead | consultation_booked | consultation_done.
      // We do this in two grouped queries instead of N round-trips.
      const [taskLoad, clientLoad] = await Promise.all([
        prisma.task.groupBy({
          by: ["assignedStaffId"],
          where: {
            businessId,
            status: "pending",
            assignedStaffId: { in: eligible.map((s) => s.id) },
          },
          _count: { _all: true },
        }),
        prisma.client.groupBy({
          by: ["assignedStaffId"],
          where: {
            businessId,
            dealStage: { in: ["lead", "consultation_booked", "consultation_done"] },
            assignedStaffId: { in: eligible.map((s) => s.id) },
          },
          _count: { _all: true },
        }),
      ]);

      const loadMap = new Map<string, number>();
      for (const s of eligible) loadMap.set(s.id, 0);
      for (const t of taskLoad) {
        if (t.assignedStaffId) loadMap.set(t.assignedStaffId, (loadMap.get(t.assignedStaffId) ?? 0) + t._count._all);
      }
      for (const c of clientLoad) {
        if (c.assignedStaffId) loadMap.set(c.assignedStaffId, (loadMap.get(c.assignedStaffId) ?? 0) + c._count._all);
      }

      // Pick min-load. Ties resolved by staff id (deterministic) so the
      // distribution stays predictable.
      let chosen = eligible[0].id;
      let minLoad = loadMap.get(chosen) ?? 0;
      for (const s of eligible) {
        const load = loadMap.get(s.id) ?? 0;
        if (load < minLoad) {
          chosen = s.id;
          minLoad = load;
        }
      }
      await prisma.business.update({
        where: { id: businessId },
        data: { lastAssignedStaffId: chosen },
      });
      return chosen;
    }

    return null;
  } catch (error) {
    console.warn(`pickStaffForNewLead(${businessId}) failed:`, error);
    return null;
  }
}
