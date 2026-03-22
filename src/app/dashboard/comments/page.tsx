"use client";

import { useState, useEffect } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import {
  MessageSquare,
  Loader2,
  Trash2,
  EyeOff,
  Eye,
  ExternalLink,
  Instagram,
  RefreshCw,
} from "lucide-react";

interface Comment {
  id: string;
  text: string;
  username: string;
  timestamp: string;
  hidden: boolean;
}

interface Post {
  mediaId: string;
  caption: string;
  permalink: string;
  timestamp: string;
  mediaType: string;
  comments: Comment[];
}

export default function CommentsPage() {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const isDark = theme === "dark";
  const cardBg = isDark ? "bg-[#12122a]" : "bg-white";
  const borderColor = isDark ? "border-white/5" : "border-gray-200";
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const textSecondary = isDark ? "text-gray-400" : "text-gray-600";

  const fetchComments = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/instagram/comments");
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
      }
    } catch (e) {
      console.error("Error fetching comments:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, []);

  const hideComment = async (commentId: string, hide: boolean) => {
    setActionLoading(commentId);
    try {
      const res = await fetch("/api/instagram/comments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId, hide }),
      });
      if (res.ok) {
        setPosts((prev) =>
          prev.map((post) => ({
            ...post,
            comments: post.comments.map((c) =>
              c.id === commentId ? { ...c, hidden: hide } : c
            ),
          }))
        );
      }
    } catch (e) {
      console.error("Hide comment error:", e);
    } finally {
      setActionLoading(null);
    }
  };

  const deleteComment = async (commentId: string) => {
    if (!confirm("Удалить комментарий? Это действие нельзя отменить.")) return;
    setActionLoading(commentId);
    try {
      const res = await fetch("/api/instagram/comments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId }),
      });
      if (res.ok) {
        setPosts((prev) =>
          prev.map((post) => ({
            ...post,
            comments: post.comments.filter((c) => c.id !== commentId),
          }))
        );
      }
    } catch (e) {
      console.error("Delete comment error:", e);
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-bold ${textPrimary}`}>Instagram Comments</h1>
          <p className={textSecondary}>Модерация комментариев к постам</p>
        </div>
        <button
          onClick={fetchComments}
          className={`flex items-center gap-2 px-4 py-2 ${isDark ? "bg-white/5 hover:bg-white/10" : "bg-gray-100 hover:bg-gray-200"} rounded-xl ${textSecondary} transition-colors`}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Обновить
        </button>
      </div>

      {posts.length === 0 ? (
        <div className={`${cardBg} border ${borderColor} rounded-xl p-12 text-center`}>
          <Instagram className={`h-12 w-12 mx-auto mb-3 ${textSecondary} opacity-50`} />
          <p className={textSecondary}>Нет постов с комментариями</p>
          <p className={`text-sm ${textSecondary} mt-1`}>Комментарии появятся после того как клиенты начнут комментировать ваши посты</p>
        </div>
      ) : (
        posts.map((post) => (
          <div key={post.mediaId} className={`${cardBg} border ${borderColor} rounded-xl overflow-hidden`}>
            {/* Post header */}
            <div className={`flex items-center justify-between p-4 border-b ${borderColor}`}>
              <div className="flex items-center gap-3">
                <Instagram className="h-5 w-5 text-pink-500" />
                <div>
                  <p className={`text-sm font-medium ${textPrimary}`}>
                    {post.caption || "Пост без подписи"}
                  </p>
                  <p className={`text-xs ${textSecondary}`}>
                    {formatDate(post.timestamp)} · {post.mediaType}
                  </p>
                </div>
              </div>
              <a
                href={post.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className={`p-2 ${isDark ? "hover:bg-white/10" : "hover:bg-gray-100"} rounded-lg transition-colors`}
              >
                <ExternalLink className={`h-4 w-4 ${textSecondary}`} />
              </a>
            </div>

            {/* Comments */}
            <div className="divide-y divide-gray-200 dark:divide-white/5">
              {post.comments.map((comment) => (
                <div
                  key={comment.id}
                  className={`flex items-start justify-between p-4 ${
                    comment.hidden ? (isDark ? "bg-yellow-500/5" : "bg-yellow-50") : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${textPrimary}`}>
                        @{comment.username}
                      </span>
                      {comment.hidden && (
                        <span className="px-1.5 py-0.5 rounded text-xs bg-yellow-500/20 text-yellow-500">
                          Скрыт
                        </span>
                      )}
                      <span className={`text-xs ${textSecondary}`}>
                        {formatDate(comment.timestamp)}
                      </span>
                    </div>
                    <p className={`text-sm mt-1 ${textSecondary}`}>{comment.text}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                    <button
                      onClick={() => hideComment(comment.id, !comment.hidden)}
                      disabled={actionLoading === comment.id}
                      className={`p-2 rounded-lg transition-colors ${
                        isDark ? "hover:bg-white/10" : "hover:bg-gray-100"
                      } ${textSecondary} hover:text-yellow-500 disabled:opacity-50`}
                      title={comment.hidden ? "Показать" : "Скрыть"}
                    >
                      {actionLoading === comment.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : comment.hidden ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={() => deleteComment(comment.id)}
                      disabled={actionLoading === comment.id}
                      className={`p-2 rounded-lg transition-colors ${
                        isDark ? "hover:bg-white/10" : "hover:bg-gray-100"
                      } ${textSecondary} hover:text-red-500 disabled:opacity-50`}
                      title="Удалить"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
