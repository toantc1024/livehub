"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import {
  ArrowLeft,
  Image as ImageIcon,
  Trash2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  Upload,
  Check,
  X,
  FolderOpen,
} from "lucide-react";
// import { ImageWithFallback } from "@/components/ui/image-with-fallback"; // Removed as per request
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useDropzone } from "react-dropzone";

// Blur placeholder - same as gallery
const BLUR_DATA_URL = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAUH/8QAIhAAAQMDBAMAAAAAAAAAAAAAAQIDBAAFEQYSITEHE0H/xAAVAQEBAAAAAAAAAAAAAAAAAAADBf/EABkRAAIDAQAAAAAAAAAAAAAAAAECAAMRIf/aAAwDAQACEQMRAD8AqeM9Y3e43q8RLncJE2LBWGo6HlFQYSpIUck9kk/KKUrDLJkyJUd//9k=";

interface ImageItem {
  id: string;
  filename: string;
  originalUrl: string;
  status: string;
  createdAt: string;
  imageData?: {
    blurDataURL?: string;
  };
}

interface UploadItem {
  file: File;
  status: "pending" | "uploading" | "success" | "error";
  id?: string;
  error?: string;
}

export default function AdminImagesPage() {
  const { isLoading, isAuthenticated, isAdmin } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("browse");

  // Browse state
  const [images, setImages] = useState<ImageItem[]>([]);
  const [isLoadingImages, setIsLoadingImages] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("");

  // Upload state
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchImages = useCallback(async (pageNum: number, status?: string) => {
    setIsLoadingImages(true);
    setSelectedIds(new Set()); // Clear selection on page change
    try {
      const res = await api.adminGetImages(pageNum, 20, status || undefined);
      setImages(res.items);
      setTotalPages(res.pages);
      setTotal(res.total);
      setPage(res.page);
    } catch (error) {
      console.error("Failed to fetch images:", error);
      toast.error("Không thể tải danh sách ảnh");
    } finally {
      setIsLoadingImages(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      fetchImages(1, statusFilter);
    }
  }, [isAuthenticated, isAdmin, statusFilter, fetchImages]);

  // Selection handlers
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === images.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(images.map((img) => img.id)));
    }
  };

  const handleDelete = async (imageId: string) => {
    if (!confirm("Bạn có chắc muốn xóa ảnh này?")) return;

    try {
      await api.adminDeleteImage(imageId);
      toast.success("Đã xóa ảnh");
      fetchImages(page, statusFilter);
    } catch (error) {
      toast.error("Không thể xóa ảnh");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) {
      toast.error("Vui lòng chọn ảnh để xóa");
      return;
    }

    if (!confirm(`Bạn có chắc muốn xóa ${selectedIds.size} ảnh đã chọn?`))
      return;

    setIsDeleting(true);
    let successCount = 0;
    let errorCount = 0;

    for (const id of selectedIds) {
      try {
        await api.adminDeleteImage(id);
        successCount++;
      } catch (error) {
        errorCount++;
      }
    }

    setIsDeleting(false);
    setSelectedIds(new Set());

    if (successCount > 0) {
      toast.success(`Đã xóa ${successCount} ảnh`);
    }
    if (errorCount > 0) {
      toast.error(`Không thể xóa ${errorCount} ảnh`);
    }

    fetchImages(page, statusFilter);
  };

  // Upload handlers
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newUploads = acceptedFiles.map((file) => ({
      file,
      status: "pending" as const,
    }));
    setUploads((prev) => [...prev, ...newUploads]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".jpg", ".jpeg", ".png", ".webp"],
    },
    multiple: true,
  });

  const removeUpload = (index: number) => {
    setUploads((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUploadAll = async () => {
    if (uploads.length === 0) {
      toast.error("Vui lòng chọn ảnh để upload");
      return;
    }

    setIsUploading(true);

    for (let i = 0; i < uploads.length; i++) {
      if (uploads[i].status !== "pending") continue;

      setUploads((prev) =>
        prev.map((u, idx) =>
          idx === i ? { ...u, status: "uploading" as const } : u
        )
      );

      try {
        const result = await api.adminUploadImage(uploads[i].file);
        setUploads((prev) =>
          prev.map((u, idx) =>
            idx === i ? { ...u, status: "success" as const, id: result.id } : u
          )
        );
      } catch (error: any) {
        setUploads((prev) =>
          prev.map((u, idx) =>
            idx === i
              ? { ...u, status: "error" as const, error: error.message }
              : u
          )
        );
      }
    }

    setIsUploading(false);
    toast.success("Upload hoàn tất!");

    // Refresh images list
    fetchImages(1, statusFilter);
  };

  const clearCompleted = () => {
    setUploads((prev) => prev.filter((u) => u.status === "pending"));
  };

  const clearAll = () => {
    setUploads([]);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
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
            <Link href="/admin">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex-1">
              <h1 className="text-3xl font-bold">Quản lý ảnh</h1>
              <p className="text-muted-foreground">
                {total} ảnh trong hệ thống
              </p>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-md grid-cols-2 rounded-full h-12 mb-8">
            <TabsTrigger value="browse" className="rounded-full">
              <FolderOpen className="h-4 w-4 mr-2" />
              Duyệt ảnh
            </TabsTrigger>
            <TabsTrigger value="upload" className="rounded-full">
              <Upload className="h-4 w-4 mr-2" />
              Upload ảnh
            </TabsTrigger>
          </TabsList>

          {/* Browse Tab */}
          <TabsContent value="browse">
            {/* Filters */}
            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
              <div className="flex gap-2">
                {["", "PROCESSING", "READY", "ERROR"].map((status) => (
                  <Button
                    key={status}
                    variant={statusFilter === status ? "default" : "outline"}
                    size="sm"
                    className="rounded-full"
                    onClick={() => {
                      setStatusFilter(status);
                      fetchImages(1, status);
                    }}
                  >
                    {status === "" && "Tất cả"}
                    {status === "PROCESSING" && "Đang xử lý"}
                    {status === "READY" && "Sẵn sàng"}
                    {status === "ERROR" && "Lỗi"}
                  </Button>
                ))}
              </div>
              <div className="flex gap-2">
                {images.length > 0 && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={selectAll}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      {selectedIds.size === images.length
                        ? "Bỏ chọn"
                        : "Chọn tất cả"}
                    </Button>
                    {selectedIds.size > 0 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="rounded-full"
                        onClick={handleBulkDelete}
                        disabled={isDeleting}
                      >
                        {isDeleting ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 mr-2" />
                        )}
                        Xóa ({selectedIds.size})
                      </Button>
                    )}
                  </>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => fetchImages(page, statusFilter)}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Làm mới
                </Button>
              </div>
            </div>

            {/* Images grid */}
            {isLoadingImages ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : images.length === 0 ? (
              <div className="text-center py-20">
                <ImageIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">Chưa có ảnh nào</p>
                <Button
                  className="rounded-full"
                  onClick={() => setActiveTab("upload")}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload ảnh
                </Button>
              </div>
            ) : (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4"
                >
                  {images.map((image, index) => (
                    <motion.div
                      key={image.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`group relative aspect-square rounded-2xl overflow-hidden bg-muted cursor-pointer
                        ${
                          selectedIds.has(image.id)
                            ? "ring-4 ring-primary ring-offset-2"
                            : ""
                        }`}
                      onClick={() => toggleSelect(image.id)}
                    >
                      <Image
                        src={image.originalUrl}
                        alt={image.filename}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 50vw, 20vw"
                        placeholder="blur"
                        blurDataURL={BLUR_DATA_URL}
                        unoptimized
                      />

                      {/* Selection checkbox */}
                      <div className="absolute top-2 right-2 z-10">
                        <div
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all
                            ${
                              selectedIds.has(image.id)
                                ? "bg-primary border-primary"
                                : "bg-white/80 border-gray-300 opacity-0 group-hover:opacity-100"
                            }`}
                        >
                          {selectedIds.has(image.id) && (
                            <Check className="h-4 w-4 text-white" />
                          )}
                        </div>
                      </div>

                      {/* Status badge */}
                      <div className="absolute top-2 left-2">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium
                          ${
                            image.status === "READY"
                              ? "bg-green-500 text-white"
                              : ""
                          }
                          ${
                            image.status === "PROCESSING"
                              ? "bg-yellow-500 text-white"
                              : ""
                          }
                          ${
                            image.status === "ERROR"
                              ? "bg-red-500 text-white"
                              : ""
                          }`}
                        >
                          {image.status === "READY" && "Sẵn sàng"}
                          {image.status === "PROCESSING" && "Đang xử lý"}
                          {image.status === "ERROR" && "Lỗi"}
                        </span>
                      </div>

                      {/* Hover overlay with actions */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                        <Link
                          href={`/admin/images/${image.id}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            size="icon"
                            className="rounded-full h-10 w-10"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          size="icon"
                          variant="destructive"
                          className="rounded-full h-10 w-10"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(image.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-8">
                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-full"
                      onClick={() => fetchImages(page - 1, statusFilter)}
                      disabled={page <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    <span className="px-4 py-2 text-sm">
                      Trang {page} / {totalPages}
                    </span>

                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-full"
                      onClick={() => fetchImages(page + 1, statusFilter)}
                      disabled={page >= totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* Upload Tab */}
          <TabsContent value="upload">
            {/* Dropzone */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8"
            >
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-3xl p-12 text-center cursor-pointer transition-all
                  ${
                    isDragActive
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50 hover:bg-primary/5"
                  }`}
              >
                <input {...getInputProps()} />
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                {isDragActive ? (
                  <p className="text-lg font-medium text-primary">
                    Thả ảnh vào đây...
                  </p>
                ) : (
                  <>
                    <p className="text-lg font-medium mb-2">
                      Kéo thả ảnh vào đây hoặc click để chọn
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Hỗ trợ: JPG, PNG, WebP
                    </p>
                  </>
                )}
              </div>
            </motion.div>

            {/* Upload list */}
            {uploads.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">
                    Danh sách ({uploads.length} ảnh)
                  </h2>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={clearCompleted}
                    >
                      Xóa đã xong
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={clearAll}
                    >
                      Xóa tất cả
                    </Button>
                    <Button
                      className="rounded-full"
                      onClick={handleUploadAll}
                      disabled={isUploading}
                    >
                      {isUploading ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      Upload tất cả
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {uploads.map((upload, index) => (
                    <div
                      key={index}
                      className="relative aspect-square rounded-2xl overflow-hidden bg-muted group"
                    >
                      <img
                        src={URL.createObjectURL(upload.file)}
                        alt={upload.file.name}
                        className="w-full h-full object-cover"
                      />

                      {/* Status overlay */}
                      <div
                        className={`absolute inset-0 flex items-center justify-center transition-all
                        ${
                          upload.status === "pending"
                            ? "bg-black/0 group-hover:bg-black/30"
                            : ""
                        }
                        ${upload.status === "uploading" ? "bg-black/50" : ""}
                        ${upload.status === "success" ? "bg-green-500/70" : ""}
                        ${upload.status === "error" ? "bg-red-500/70" : ""}`}
                      >
                        {upload.status === "pending" && (
                          <button
                            onClick={() => removeUpload(index)}
                            className="p-2 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                        {upload.status === "uploading" && (
                          <RefreshCw className="h-8 w-8 text-white animate-spin" />
                        )}
                        {upload.status === "success" && (
                          <Check className="h-8 w-8 text-white" />
                        )}
                        {upload.status === "error" && (
                          <X className="h-8 w-8 text-white" />
                        )}
                      </div>

                      {/* Filename */}
                      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                        <p className="text-xs text-white truncate">
                          {upload.file.name}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
