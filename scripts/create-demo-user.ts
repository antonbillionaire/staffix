// Script to create demo user for PayPro review
// Run with: npx ts-node scripts/create-demo-user.ts

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createDemoUser() {
  const email = 'demo@staffix.io';
  const password = 'PayProDemo2025!';
  const name = 'PayPro Demo';
  const businessName = 'Demo Beauty Salon';

  try {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      console.log('Demo user already exists. Updating...');

      // Update existing user
      await prisma.user.update({
        where: { email },
        data: {
          password: await bcrypt.hash(password, 10),
          emailVerified: true,
          verificationToken: null,
        },
      });

      console.log('Demo user updated!');
      console.log(`Email: ${email}`);
      console.log(`Password: ${password}`);
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user with business and Pro subscription
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        emailVerified: true, // Pre-verified for demo
        verificationToken: null,
        businesses: {
          create: {
            name: businessName,
            businessType: 'salon',
            language: 'en',
            staffCount: 5,
            phone: '+1 555 123 4567',
            address: '123 Demo Street, Demo City',
            welcomeMessage: 'Welcome to Demo Beauty Salon! How can I help you today?',
            onboardingCompleted: true,
            aiTone: 'friendly',
            subscription: {
              create: {
                plan: 'pro',
                messagesLimit: 1000,
                messagesUsed: 47, // Some demo usage
                expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
                status: 'active',
              },
            },
            // Add some demo services
            services: {
              create: [
                { name: 'Haircut', price: 25, duration: 30 },
                { name: 'Hair Coloring', price: 80, duration: 90 },
                { name: 'Manicure', price: 30, duration: 45 },
                { name: 'Pedicure', price: 40, duration: 60 },
                { name: 'Facial Treatment', price: 60, duration: 60 },
              ],
            },
            // Add demo staff
            staff: {
              create: [
                { name: 'Anna', role: 'Senior Stylist' },
                { name: 'Maria', role: 'Nail Technician' },
                { name: 'John', role: 'Colorist' },
              ],
            },
            // Add demo FAQ
            faqs: {
              create: [
                {
                  question: 'What are your working hours?',
                  answer: 'We are open Monday-Saturday 9:00 AM - 8:00 PM, Sunday 10:00 AM - 6:00 PM.'
                },
                {
                  question: 'Do you accept walk-ins?',
                  answer: 'Yes, we accept walk-ins but recommend booking in advance to ensure availability.'
                },
                {
                  question: 'What payment methods do you accept?',
                  answer: 'We accept cash, credit/debit cards, and mobile payments.'
                },
              ],
            },
          },
        },
      },
      include: {
        businesses: {
          include: {
            services: true,
            staff: true,
            faqs: true,
            subscription: true,
          },
        },
      },
    });

    console.log('✅ Demo user created successfully!');
    console.log('');
    console.log('=== DEMO CREDENTIALS ===');
    console.log(`URL: https://staffix.io/login`);
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log('');
    console.log('Business:', user.businesses[0].name);
    console.log('Services:', user.businesses[0].services.length);
    console.log('Staff:', user.businesses[0].staff.length);
    console.log('FAQs:', user.businesses[0].faqs.length);
    console.log('Plan:', user.businesses[0].subscription?.plan);
  } catch (error) {
    console.error('Error creating demo user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createDemoUser();
