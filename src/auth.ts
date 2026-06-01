import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { notifyNewRegistration } from "@/lib/admin-notify";
import { sendPartnerNewReferralEmail } from "@/lib/email";
import { normalizeEmail } from "@/lib/partner-helpers";

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Session: JWT with 14-day persistence (survives browser close)
  session: {
    strategy: "jwt",
    maxAge: 14 * 24 * 60 * 60, // 14 days
  },
  cookies: {
    sessionToken: {
      name: `__Secure-authjs.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax", // "lax" required for OAuth redirects (Google callback is cross-site)
        path: "/",
        secure: true,
        maxAge: 14 * 24 * 60 * 60, // 14 days — persistent cookie, survives browser close
      },
    },
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: { params: { prompt: "select_account" } },
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

        const emailLower = (credentials.email as string).toLowerCase().trim();
        const user = await prisma.user.findUnique({
          where: { email: emailLower },
        });

        // Also try original case if lowercase not found
        const finalUser = user || await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!finalUser || !finalUser.password) {
          throw new Error("Неверный email или пароль");
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          finalUser.password
        );

        if (!isPasswordValid) {
          throw new Error("Неверный email или пароль");
        }

        // Block check before email-verification check — blocked user must not
        // get any signal about state of their account beyond "access denied".
        if (finalUser.isBlocked) {
          throw new Error("Аккаунт заблокирован. Свяжитесь с support@staffix.io");
        }

        // Check email verification
        if (!finalUser.emailVerified) {
          throw new Error("Пожалуйста, подтвердите email");
        }

        // Track last login
        prisma.user.update({
          where: { id: finalUser.id },
          data: { lastLoginAt: new Date() },
        }).catch(() => {});

        return {
          id: finalUser.id,
          email: finalUser.email,
          name: finalUser.name,
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

          if (existingUser) {
            // Block check — refuse Google sign-in for blocked accounts the
            // same way Credentials does. Returning false aborts the flow.
            if (existingUser.isBlocked) {
              console.warn(`[auth] Blocked user attempted Google sign-in: ${existingUser.email}`);
              return false;
            }
            // Track last login
            prisma.user.update({
              where: { id: existingUser.id },
              data: { lastLoginAt: new Date() },
            }).catch(() => {});
          }

          if (!existingUser) {
            // Партнёрская атрибуция: читаем cookie ДО создания user, чтобы знать
            // привязывать ли реферала. Cookie установлен middleware при ?ref=CODE.
            const cookieStore = await cookies();
            const referralCode = cookieStore.get("staffix_ref")?.value || null;

            // Create new user with empty business (onboarding not completed)
            // Google users are automatically email verified
            const newUser = await prisma.user.create({
              data: {
                email: user.email!,
                name: user.name || "User",
                password: "", // Empty password for OAuth users
                emailVerified: true, // Google already verified email
                referredByCode: referralCode,
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

            // Notify admin about new Google registration
            notifyNewRegistration(user.name || "User", user.email!, "Google OAuth (онбординг не завершён)").catch(() => {});

            // Партнёрский referral — non-blocking, повторяет логику /api/auth/register.
            // Self-referral блок по email + только approved партнёры засчитывают.
            if (referralCode) {
              prisma.partner.findUnique({
                where: { referralCode },
                select: { id: true, status: true, email: true, name: true, accessToken: true },
              }).then(async (partner) => {
                if (!partner) return;
                if (partner.status !== "approved") return;
                if (normalizeEmail(partner.email) === normalizeEmail(user.email!)) {
                  console.warn(`[partner-referral] BLOCKED self-referral by email (Google OAuth, partner ${partner.id})`);
                  return;
                }

                const referral = await prisma.partnerReferral.create({
                  data: {
                    userId: newUser.id,
                    userEmail: user.email!,
                    referralCode,
                    partnerId: partner.id,
                  },
                });

                if (partner.accessToken) {
                  sendPartnerNewReferralEmail({
                    email: partner.email,
                    name: partner.name,
                    accessToken: partner.accessToken,
                    referralEmail: user.email!,
                    signedUpAt: referral.signedUpAt,
                  }).catch((e) => console.error("[partner-referral] new-referral email failed:", e));
                }
              }).catch(console.error);
            }
          }
          return true;
        } catch (error) {
          console.error("Error in signIn callback:", error);
          return false;
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
