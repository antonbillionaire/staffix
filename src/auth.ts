import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Session: JWT with 30-day persistence (survives browser close)
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  cookies: {
    sessionToken: {
      name: `__Secure-authjs.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: true,
        maxAge: 30 * 24 * 60 * 60, // 30 days — persistent cookie, survives browser close
      },
    },
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email и пароль обязательны");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.password) {
          throw new Error("Неверный email или пароль");
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isPasswordValid) {
          throw new Error("Неверный email или пароль");
        }

        // Check email verification
        if (!user.emailVerified) {
          throw new Error("Пожалуйста, подтвердите email");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
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
            // Google users are automatically email verified
            await prisma.user.create({
              data: {
                email: user.email!,
                name: user.name || "User",
                password: "", // Empty password for OAuth users
                emailVerified: true, // Google already verified email
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
