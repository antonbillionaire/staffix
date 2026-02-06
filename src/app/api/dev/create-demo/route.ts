// API endpoint to create demo user for PayPro review
// Only works in development or with secret key

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const DEMO_SECRET = process.env.DEMO_SECRET || "paypro-demo-2025";

export async function POST(request: NextRequest) {
  try {
    // Check secret
    const { secret } = await request.json();

    if (secret !== DEMO_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = "demo@staffix.io";
    const password = "PayProDemo2025!";
    const name = "PayPro Demo";
    const businessName = "Demo Beauty Salon";

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
      include: { businesses: true },
    });

    if (existingUser) {
      // Update password and return existing
      await prisma.user.update({
        where: { email },
        data: {
          password: await bcrypt.hash(password, 10),
          emailVerified: true,
        },
      });

      return NextResponse.json({
        message: "Demo user already exists, password updated",
        credentials: {
          url: "https://staffix.io/login",
          email,
          password,
        },
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user with business and Pro subscription
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        emailVerified: true,
        verificationToken: null,
        businesses: {
          create: {
            name: businessName,
            businessType: "salon",
            language: "en",
            staffCount: 5,
            phone: "+1 555 123 4567",
            address: "123 Demo Street, Demo City",
            welcomeMessage: "Welcome to Demo Beauty Salon! How can I help you today?",
            onboardingCompleted: true,
            aiTone: "friendly",
            subscription: {
              create: {
                plan: "pro",
                messagesLimit: 1000,
                messagesUsed: 47,
                expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                status: "active",
              },
            },
            services: {
              create: [
                { name: "Haircut", price: 25, duration: 30 },
                { name: "Hair Coloring", price: 80, duration: 90 },
                { name: "Manicure", price: 30, duration: 45 },
                { name: "Pedicure", price: 40, duration: 60 },
                { name: "Facial Treatment", price: 60, duration: 60 },
              ],
            },
            staff: {
              create: [
                { name: "Anna", role: "Senior Stylist" },
                { name: "Maria", role: "Nail Technician" },
                { name: "John", role: "Colorist" },
              ],
            },
            faqs: {
              create: [
                {
                  question: "What are your working hours?",
                  answer: "We are open Monday-Saturday 9:00 AM - 8:00 PM, Sunday 10:00 AM - 6:00 PM.",
                },
                {
                  question: "Do you accept walk-ins?",
                  answer: "Yes, we accept walk-ins but recommend booking in advance to ensure availability.",
                },
                {
                  question: "What payment methods do you accept?",
                  answer: "We accept cash, credit/debit cards, and mobile payments.",
                },
              ],
            },
          },
        },
      },
    });

    return NextResponse.json({
      message: "Demo user created successfully!",
      credentials: {
        url: "https://staffix.io/login",
        email,
        password,
      },
      userId: user.id,
    });
  } catch (error) {
    console.error("Error creating demo user:", error);
    return NextResponse.json(
      { error: "Failed to create demo user" },
      { status: 500 }
    );
  }
}
