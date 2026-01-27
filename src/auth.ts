import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        try {
          // Check if user exists
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email! },
            include: { businesses: true },
          });

          if (!existingUser) {
            // Create new user with empty business (onboarding not completed)
            await prisma.user.create({
              data: {
                email: user.email!,
                name: user.name || "User",
                password: "", // Empty password for OAuth users
                businesses: {
                  create: {
                    name: "Мой бизнес", // Temporary name, will be updated in onboarding
                    onboardingCompleted: false,
                    subscription: {
                      create: {
                        plan: "trial",
                        messagesLimit: 100,
                        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
                      },
                    },
                  },
                },
              },
            });
          }
          return true;
        } catch (error) {
          console.error("Error in signIn callback:", error);
          // Still allow sign in even if user creation fails
          return true;
        }
      }
      return true;
    },
    async session({ session }) {
      if (session.user?.email) {
        const user = await prisma.user.findUnique({
          where: { email: session.user.email },
          include: { businesses: true },
        });
        if (user) {
          session.user.id = user.id;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
