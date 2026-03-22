/**
 * Instagram Comments API — moderation (hide/unhide/delete)
 * Uses Graph API: POST /{comment-id} (hide) or DELETE /{comment-id} (delete)
 * Requires: instagram_manage_comments (Advanced Access)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const META_API = "https://graph.facebook.com/v21.0";

async function getBusinessForUser(): Promise<{
  id: string;
  fbPageAccessToken: string;
  igBusinessAccountId: string | null;
} | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const business = await prisma.business.findFirst({
    where: { userId: session.user.id },
    select: { id: true, fbPageAccessToken: true, igBusinessAccountId: true },
  });

  if (!business?.fbPageAccessToken) return null;
  return { id: business.id, fbPageAccessToken: business.fbPageAccessToken, igBusinessAccountId: business.igBusinessAccountId };
}

// GET /api/instagram/comments — list recent comments on business posts
export async function GET(request: NextRequest) {
  try {
    const business = await getBusinessForUser();
    if (!business) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const igAccountId = business.igBusinessAccountId;
    if (!igAccountId) {
      return NextResponse.json({ error: "Instagram not connected" }, { status: 400 });
    }

    const token = business.fbPageAccessToken;

    // Get recent media
    const mediaRes = await fetch(
      `${META_API}/${igAccountId}/media?fields=id,caption,timestamp,media_type,permalink&limit=10&access_token=${token}`
    );
    if (!mediaRes.ok) {
      const err = await mediaRes.json().catch(() => ({}));
      console.error("[IG Comments] Media fetch error:", err);
      return NextResponse.json({ error: "Failed to fetch media" }, { status: 500 });
    }
    const mediaData = await mediaRes.json();

    // For each media, get comments
    const postsWithComments = [];
    for (const media of mediaData.data || []) {
      const commentsRes = await fetch(
        `${META_API}/${media.id}/comments?fields=id,text,username,timestamp,hidden&limit=50&access_token=${token}`
      );
      if (commentsRes.ok) {
        const commentsData = await commentsRes.json();
        if (commentsData.data?.length > 0) {
          postsWithComments.push({
            mediaId: media.id,
            caption: media.caption?.substring(0, 100) || "",
            permalink: media.permalink,
            timestamp: media.timestamp,
            mediaType: media.media_type,
            comments: commentsData.data,
          });
        }
      }
    }

    return NextResponse.json({ posts: postsWithComments });
  } catch (error) {
    console.error("[IG Comments] GET error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PATCH /api/instagram/comments — hide/unhide a comment
export async function PATCH(request: NextRequest) {
  try {
    const business = await getBusinessForUser();
    if (!business) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { commentId, hide } = await request.json();
    if (!commentId || typeof hide !== "boolean") {
      return NextResponse.json({ error: "commentId and hide (boolean) required" }, { status: 400 });
    }

    const token = business.fbPageAccessToken;

    const res = await fetch(`${META_API}/${commentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hide,
        access_token: token,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[IG Comments] Hide error:", err);
      return NextResponse.json({ error: "Failed to update comment", details: err }, { status: 500 });
    }

    return NextResponse.json({ success: true, hidden: hide });
  } catch (error) {
    console.error("[IG Comments] PATCH error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE /api/instagram/comments — delete a comment
export async function DELETE(request: NextRequest) {
  try {
    const business = await getBusinessForUser();
    if (!business) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { commentId } = await request.json();
    if (!commentId) {
      return NextResponse.json({ error: "commentId required" }, { status: 400 });
    }

    const token = business.fbPageAccessToken;

    const res = await fetch(`${META_API}/${commentId}?access_token=${token}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[IG Comments] Delete error:", err);
      return NextResponse.json({ error: "Failed to delete comment", details: err }, { status: 500 });
    }

    return NextResponse.json({ success: true, deleted: true });
  } catch (error) {
    console.error("[IG Comments] DELETE error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
