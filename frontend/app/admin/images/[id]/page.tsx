"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import {
  ArrowLeft,
  RotateCw,
  User,
  X,
  Search,
  Trash2,
  UserPlus,
  Tag,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { LoadingSpinner } from "@/components/ui/loading";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import Link from "next/link";
import { motion } from "framer-motion";
import { toast } from "sonner";

interface Face {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number; // Face detection confidence
  similarity?: number; // Similarity to matched user
  userId?: string;
  user?: {
    id: string;
    name?: string;
    email: string;
  };
}

interface ImageDetail {
  id: string;
  filename: string;
  originalUrl: string;
  status: string;
  width?: number;
  height?: number;
  faces: Face[];
}

interface UserItem {
  id: string;
  name?: string;
  email: string;
  avatarUrl?: string;
}

export default function AdminImageDetailPage() {
  const { isLoading, isAuthenticated, isAdmin } = useAuth();
  const router = useRouter();
  const params = useParams();
  const imageId = params.id as string;

  // Image state
  const [image, setImage] = useState<ImageDetail | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [isLoadingImage, setIsLoadingImage] = useState(true);

  // Modal states
  const [faceModalOpen, setFaceModalOpen] = useState(false);
  const [selectedFace, setSelectedFace] = useState<Face | null>(null);

  // User search state
  const [users, setUsers] = useState<UserItem[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fetchImage = useCallback(async () => {
    setIsLoadingImage(true);
    try {
      const res = await api.adminGetImage(imageId);
      setImage(res);
    } catch (error) {
      console.error("Failed to fetch image:", error);
      toast.error("Không thể tải ảnh");
    } finally {
      setIsLoadingImage(false);
    }
  }, [imageId]);

  const searchUsers = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setUsers([]);
      return;
    }

    setIsSearching(true);
    try {
      const res = await api.adminListUsers(1, 20, query);
      setUsers(res.items || []);
    } catch (error) {
      console.error("Failed to search users:", error);
      setUsers([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      fetchImage();
    }
  }, [isAuthenticated, isAdmin, fetchImage]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      searchUsers(userSearch);
    }, 300);
    return () => clearTimeout(timeout);
  }, [userSearch, searchUsers]);

  // Open face modal
  const handleFaceClick = (face: Face) => {
    setSelectedFace(face);
    setFaceModalOpen(true);
    setUserSearch("");
    setUsers([]);
  };

  // Assign face to user
  const handleAssignFace = async (userId: string) => {
    if (!selectedFace) return;

    setIsSaving(true);
    try {
      await api.adminUpdateFace(selectedFace.id, userId);
      toast.success("Đã gán khuôn mặt cho người dùng");
      setFaceModalOpen(false);
      setSelectedFace(null);
      setUserSearch("");
      setUsers([]);
      fetchImage();
    } catch (error) {
      toast.error("Không thể gán khuôn mặt");
    } finally {
      setIsSaving(false);
    }
  };

  // Unassign face
  const handleUnassignFace = async () => {
    if (!selectedFace) return;

    setIsSaving(true);
    try {
      await api.adminUpdateFace(selectedFace.id, null);
      toast.success("Đã bỏ gán khuôn mặt");
      setFaceModalOpen(false);
      setSelectedFace(null);
      fetchImage();
    } catch (error) {
      toast.error("Không thể bỏ gán khuôn mặt");
    } finally {
      setIsSaving(false);
    }
  };

  // Delete face completely
  const handleDeleteFace = async () => {
    if (!selectedFace) return;

    if (
      !confirm(
        "Bạn có chắc muốn xóa khuôn mặt này? Embedding sẽ bị xóa khỏi Qdrant."
      )
    ) {
      return;
    }

    setIsSaving(true);
    try {
      await api.adminDeleteFace(selectedFace.id);
      toast.success("Đã xóa khuôn mặt");
      setFaceModalOpen(false);
      setSelectedFace(null);
      fetchImage();
    } catch (error) {
      toast.error("Không thể xóa khuôn mặt");
    } finally {
      setIsSaving(false);
    }
  };

  // Close modal
  const closeFaceModal = () => {
    setFaceModalOpen(false);
    setSelectedFace(null);
    setUserSearch("");
    setUsers([]);
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen text="Đang tải..." />;
  }

  if (!isAuthenticated || !isAdmin) {
    router.replace("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <Navbar />

      <main className="container pt-24 pb-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4 mb-4">
            <Link href="/admin/images">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex-1">
              <h1 className="text-3xl font-bold">Chi tiết ảnh</h1>
              <p className="text-muted-foreground">{image?.filename}</p>
            </div>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={fetchImage}
              disabled={isLoadingImage}
            >
              {isLoadingImage ? (
                <Spinner className="h-4 w-4 mr-2" />
              ) : (
                <RotateCw className="h-4 w-4 mr-2" />
              )}
              Làm mới
            </Button>
          </div>
        </motion.div>

        {isLoadingImage ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner size="lg" text="Đang tải ảnh..." />
          </div>
        ) : image ? (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Image with face boxes */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="lg:col-span-3"
            >
              <div className="relative rounded-3xl overflow-hidden bg-muted">
                <img
                  src={image.originalUrl}
                  alt={image.filename}
                  className="w-full h-auto"
                  onLoad={(e) => {
                    const img = e.target as HTMLImageElement;
                    setImageDimensions({
                      width: img.naturalWidth,
                      height: img.naturalHeight,
                    });
                  }}
                />

                {/* Face bounding boxes */}
                {imageDimensions &&
                  image.faces.map((face) => {
                    const leftPct = (face.x / imageDimensions.width) * 100;
                    const topPct = (face.y / imageDimensions.height) * 100;
                    const widthPct = (face.width / imageDimensions.width) * 100;
                    const heightPct =
                      (face.height / imageDimensions.height) * 100;

                    return (
                      <div
                        key={face.id}
                        className={`absolute border-2 cursor-pointer transition-all hover:border-4 hover:border-primary
                          ${
                            face.userId
                              ? "border-green-500"
                              : "border-orange-500"
                          }`}
                        style={{
                          left: `${leftPct}%`,
                          top: `${topPct}%`,
                          width: `${widthPct}%`,
                          height: `${heightPct}%`,
                        }}
                        onClick={() => handleFaceClick(face)}
                        title={
                          face.userId
                            ? `Đã gán: ${
                                face.user?.name ||
                                face.user?.email ||
                                face.userId
                              }`
                            : "Chưa gán - Click để gán"
                        }
                      >
                        {/* Face label */}
                        <div
                          className={`absolute -top-6 left-0 px-2 py-0.5 text-xs font-medium text-white rounded whitespace-nowrap
                            ${face.userId ? "bg-green-500" : "bg-orange-500"}`}
                        >
                          {face.userId
                            ? `${
                                face.user?.name ||
                                face.user?.email?.split("@")[0] ||
                                "Đã gán"
                              } (${Math.round((face.similarity || 0) * 100)}%)`
                            : `Nhận diện: ${Math.round(
                                face.confidence * 100
                              )}%`}
                        </div>
                      </div>
                    );
                  })}
              </div>

              <p className="text-sm text-muted-foreground mt-4 text-center">
                Click vào khuôn mặt để gán hoặc chỉnh sửa
              </p>
            </motion.div>

            {/* Summary panel */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <div className="bg-card border rounded-3xl p-6 sticky top-24">
                <h2 className="text-xl font-semibold mb-4">Tổng quan</h2>

                {/* Stats */}
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">
                      Tổng khuôn mặt:
                    </span>
                    <span className="font-semibold">{image.faces.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Đã gán:</span>
                    <span className="text-green-600 font-semibold">
                      {image.faces.filter((f) => f.userId).length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Chưa gán:</span>
                    <span className="text-orange-600 font-semibold">
                      {image.faces.filter((f) => !f.userId).length}
                    </span>
                  </div>
                </div>

                {/* Face list */}
                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium mb-3">
                    Danh sách khuôn mặt
                  </h3>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {image.faces.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Không có khuôn mặt nào được phát hiện
                      </p>
                    ) : (
                      image.faces.map((face, index) => (
                        <button
                          key={face.id}
                          onClick={() => handleFaceClick(face)}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left
                            ${
                              face.userId
                                ? "bg-green-500/10 hover:bg-green-500/20"
                                : "bg-orange-500/10 hover:bg-orange-500/20"
                            }`}
                        >
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium
                              ${
                                face.userId ? "bg-green-500" : "bg-orange-500"
                              }`}
                          >
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            {face.userId ? (
                              <>
                                <p className="font-medium truncate text-green-700 dark:text-green-400">
                                  {face.user?.name || "Chưa có tên"}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  Tương đồng:{" "}
                                  {Math.round((face.similarity || 0) * 100)}%
                                </p>
                              </>
                            ) : (
                              <>
                                <p className="font-medium text-orange-700 dark:text-orange-400">
                                  Chưa gán
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Nhận diện: {Math.round(face.confidence * 100)}
                                  %
                                </p>
                              </>
                            )}
                          </div>
                          <Tag className="h-4 w-4 text-muted-foreground" />
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-muted-foreground">Không tìm thấy ảnh</p>
          </div>
        )}
      </main>

      {/* Face Assignment Modal */}
      <Dialog open={faceModalOpen} onOpenChange={setFaceModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              {selectedFace?.userId
                ? "Chỉnh sửa gán khuôn mặt"
                : "Gán khuôn mặt"}
            </DialogTitle>
            <DialogDescription>
              {selectedFace?.userId
                ? "Thay đổi người dùng được gán hoặc bỏ gán"
                : "Tìm và chọn người dùng để gán cho khuôn mặt này"}
            </DialogDescription>
          </DialogHeader>

          {/* Current assignment info */}
          {selectedFace?.userId && (
            <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
              <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">
                Đang gán cho:
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                  <User className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-medium">
                    {selectedFace.user?.name || "Chưa có tên"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedFace.user?.email}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Face info */}
          <div className="p-3 bg-muted rounded-xl space-y-1">
            <p className="text-sm text-muted-foreground">
              Nhận diện khuôn mặt:{" "}
              <span className="font-medium">
                {Math.round((selectedFace?.confidence || 0) * 100)}%
              </span>
            </p>
            {selectedFace?.similarity && (
              <p className="text-sm text-muted-foreground">
                Độ tương đồng:{" "}
                <span className="font-medium text-green-600">
                  {Math.round(selectedFace.similarity * 100)}%
                </span>
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              ID: {selectedFace?.id.slice(0, 12)}...
            </p>
          </div>

          {/* User search */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm người dùng theo tên hoặc email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Search results */}
            {isSearching ? (
              <div className="flex items-center justify-center py-4">
                <Spinner className="h-5 w-5" />
              </div>
            ) : users.length > 0 ? (
              <div className="max-h-48 overflow-y-auto space-y-1 border rounded-xl p-2">
                {users.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleAssignFace(user.id)}
                    disabled={isSaving}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-primary/10 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt={user.name || user.email}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-sm">
                        {user.name || "Chưa có tên"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {user.email}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ) : userSearch.length >= 2 && !isSearching ? (
              <p className="text-sm text-muted-foreground text-center py-3">
                Không tìm thấy người dùng với "{userSearch}"
              </p>
            ) : userSearch.length > 0 && userSearch.length < 2 ? (
              <p className="text-sm text-muted-foreground text-center py-3">
                Nhập ít nhất 2 ký tự để tìm kiếm
              </p>
            ) : null}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {selectedFace?.userId && (
              <Button
                variant="outline"
                onClick={handleUnassignFace}
                disabled={isSaving}
                className="w-full sm:w-auto"
              >
                {isSaving ? (
                  <Spinner className="h-4 w-4 mr-2" />
                ) : (
                  <X className="h-4 w-4 mr-2" />
                )}
                Bỏ gán
              </Button>
            )}
            <Button
              variant="destructive"
              onClick={handleDeleteFace}
              disabled={isSaving}
              className="w-full sm:w-auto"
            >
              {isSaving ? (
                <Spinner className="h-4 w-4 mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Xóa khuôn mặt
            </Button>
            <Button
              variant="ghost"
              onClick={closeFaceModal}
              disabled={isSaving}
              className="w-full sm:w-auto"
            >
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
