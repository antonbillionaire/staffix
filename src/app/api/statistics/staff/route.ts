/**
 * Staff Statistics API — per-master performance metrics.
 * GET /api/statistics/staff?period=week|month|all
 *
 * Returns per-staff: bookings count, revenue, avg rating, utilization %, cancellations.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get("period") || "month";

    const now = new Date();
    let startDate: Date;
    switch (period) {
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(0);
    }

    const business = await prisma.business.findFirst({
      where: { userId: session.user.id },
      select: { id: true, dashboardMode: true },
    });

    if (!business) {
      return NextResponse.json({ staff: [] });
    }

    // Get all staff with role "master" (or all for service businesses)
    const allStaff = await prisma.staff.findMany({
      where: { businessId: business.id },
      select: {
        id: true,
        name: true,
        role: true,
        photo: true,
      },
    });

    // Get all bookings in period with staff assignment
    const bookings = await prisma.booking.findMany({
      where: {
        businessId: business.id,
        createdAt: { gte: startDate },
        staffId: { not: null },
      },
      select: {
        staffId: true,
        status: true,
        date: true,
        service: { select: { price: true, duration: true } },
      },
    });

    // Get reviews linked to bookings with staff
    const reviews = await prisma.review.findMany({
      where: {
        businessId: business.id,
        createdAt: { gte: startDate },
        booking: { staffId: { not: null } },
      },
      select: {
        rating: true,
        booking: { select: { staffId: true } },
      },
    });

    // Get staff schedules for utilization calculation
    const schedules = await prisma.staffSchedule.findMany({
      where: {
        staff: { businessId: business.id },
      },
      select: {
        staffId: true,
        dayOfWeek: true,
        startTime: true,
        endTime: true,
        isWorkday: true,
      },
    });

    // Aggregate per staff
    const staffStats = allStaff.map((s) => {
      const staffBookings = bookings.filter((b) => b.staffId === s.id);
      const completed = staffBookings.filter((b) => b.status === "completed");
      const cancelled = staffBookings.filter((b) => b.status === "cancelled");
      const confirmed = staffBookings.filter((b) => b.status === "confirmed");
      const pending = staffBookings.filter((b) => b.status === "pending");

      // Revenue from completed bookings
      const revenue = completed.reduce((sum, b) => sum + (b.service?.price || 0), 0);

      // Average rating
      const staffReviews = reviews.filter((r) => r.booking?.staffId === s.id);
      const avgRating = staffReviews.length > 0
        ? Math.round((staffReviews.reduce((sum, r) => sum + r.rating, 0) / staffReviews.length) * 10) / 10
        : null;

      // Utilization: booked hours / available hours in period
      const staffSchedule = schedules.filter((sc) => sc.staffId === s.id);
      let availableMinutes = 0;
      let bookedMinutes = 0;

      if (staffSchedule.length > 0) {
        // Count working days in period
        const dayMs = 24 * 60 * 60 * 1000;
        const daysInPeriod = Math.ceil((now.getTime() - startDate.getTime()) / dayMs);

        for (let i = 0; i < daysInPeriod; i++) {
          const day = new Date(startDate.getTime() + i * dayMs);
          const dayOfWeek = day.getDay(); // 0=Sun ... 6=Sat
          const daySchedule = staffSchedule.find((sc) => sc.dayOfWeek === dayOfWeek && sc.isWorkday);
          if (daySchedule) {
            const [startH, startM] = daySchedule.startTime.split(":").map(Number);
            const [endH, endM] = daySchedule.endTime.split(":").map(Number);
            availableMinutes += (endH * 60 + endM) - (startH * 60 + startM);
          }
        }

        // Booked minutes from non-cancelled bookings
        const activeBookings = staffBookings.filter((b) => b.status !== "cancelled");
        bookedMinutes = activeBookings.reduce((sum, b) => sum + (b.service?.duration || 60), 0);
      }

      const utilization = availableMinutes > 0
        ? Math.min(100, Math.round((bookedMinutes / availableMinutes) * 100))
        : null;

      return {
        id: s.id,
        name: s.name,
        role: s.role,
        photo: s.photo,
        totalBookings: staffBookings.length,
        completed: completed.length,
        cancelled: cancelled.length,
        confirmed: confirmed.length,
        pending: pending.length,
        revenue,
        avgRating,
        reviewCount: staffReviews.length,
        utilization,
        bookedMinutes,
        availableMinutes,
      };
    });

    // Sort by revenue descending
    staffStats.sort((a, b) => b.revenue - a.revenue);

    // Summary totals
    const totals = {
      totalBookings: bookings.length,
      totalRevenue: staffStats.reduce((s, st) => s + st.revenue, 0),
      totalCompleted: staffStats.reduce((s, st) => s + st.completed, 0),
      totalCancelled: staffStats.reduce((s, st) => s + st.cancelled, 0),
      avgRating: reviews.length > 0
        ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
        : null,
    };

    return NextResponse.json({ staff: staffStats, totals });
  } catch (error) {
    console.error("Staff statistics error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
