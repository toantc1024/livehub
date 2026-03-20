"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLoading } from "@/components/ui/loading";
import { SchoolSelector } from "@/components/school-selector";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import {
  Camera,
  ArrowRight,
  ArrowLeft,
  Check,
  Upload,
  User,
  Phone,
  School,
  Sparkles,
  RefreshCw,
  X,
  Home,
  FlipHorizontal,
  SwitchCamera,
  Edit3,
  ScanFace,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import Link from "next/link";
import Webcam from "react-webcam";

interface ProfileData {
  fullName: string;
  school: string;
  phoneNumber: string;
}

// Extracted as stable component to prevent focus loss on re-render
interface ProfileFormProps {
  profileData: ProfileData;
  onProfileChange: (data: ProfileData) => void;
}

function ProfileFormComponent({ profileData, onProfileChange }: ProfileFormProps) {
  return (
    <div className="space-y-6">
      {/* Full Name */}
      <div className="space-y-2">
        <Label htmlFor="fullName" className="flex items-center gap-2">
          <User className="h-4 w-4" />
          Họ và tên <span className="text-destructive">*</span>
        </Label>
        <Input
          id="fullName"
          placeholder="Nguyễn Văn A"
          value={profileData.fullName}
          onChange={(e) =>
            onProfileChange({ ...profileData, fullName: e.target.value })
          }
          className="rounded-xl h-11"
        />
      </div>

      {/* Phone */}
      <div className="space-y-2">
        <Label htmlFor="phone" className="flex items-center gap-2">
          <Phone className="h-4 w-4" />
          Số điện thoại <span className="text-destructive">*</span>
        </Label>
        <Input
          id="phone"
          type="tel"
          placeholder="0901234567"
          value={profileData.phoneNumber}
          onChange={(e) =>
            onProfileChange({
              ...profileData,
              phoneNumber: e.target.value.replace(/[^0-9]/g, ""),
            })
          }
          className="rounded-xl h-11"
        />
      </div>
    </div>
  );
}

export default function RegisterFacePage() {
  const { user, isLoading, isAuthenticated, refreshUser, needsProfileSetup } = useAuth();
  const router = useRouter();

  // Mode: 'register' for new users, 'update' for existing users
  const [mode, setMode] = useState<"register" | "update" | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);

  // Steps management (for register mode only)
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Face processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingTaskId, setProcessingTaskId] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<"uploading" | "processing" | "completed" | "failed">("uploading");
  const [processingProgress, setProcessingProgress] = useState(0);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Profile data
  const [profileData, setProfileData] = useState<ProfileData>({
    fullName: "",
    school: "",
    phoneNumber: "",
  });

  // Face registration
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [isMirrored, setIsMirrored] = useState(true);
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [faceQuality, setFaceQuality] = useState<'none' | 'poor' | 'good'>('none');
  const [hasFaceDetector, setHasFaceDetector] = useState(false);
  const [croppedFaceUrl, setCroppedFaceUrl] = useState<string | null>(null);
  const [qualityScore, setQualityScore] = useState(0); // 0-100
  const lastBboxRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  // Poll task status function
  const startPolling = useCallback((taskId: string) => {
    setIsProcessing(true);
    setProcessingTaskId(taskId);
    setProcessingStatus("processing");
    setProcessingProgress(20);

    // Animate progress gradually
    let progress = 20;
    const progressInterval = setInterval(() => {
      progress = Math.min(progress + Math.random() * 8, 85);
      setProcessingProgress(progress);
    }, 2000);

    const poll = async () => {
      try {
        const result = await api.getFaceTaskStatus(taskId);
        
        if (result.status === "completed") {
          clearInterval(progressInterval);
          setProcessingProgress(100);
          setProcessingStatus("completed");
          toast.success("Đăng ký khuôn mặt thành công!");
          // Wait a moment to show the success state, then redirect
          setTimeout(() => {
            router.push("/gallery");
          }, 2000);
          return; // stop polling
        } else if (result.status === "failed") {
          clearInterval(progressInterval);
          setProcessingStatus("failed");
          setProcessingProgress(0);
          toast.error(result.error || "Đăng ký khuôn mặt thất bại. Vui lòng thử lại.");
          // Allow user to retry after a moment
          setTimeout(() => {
            setIsProcessing(false);
            setProcessingTaskId(null);
          }, 3000);
          return; // stop polling
        }
        
        // Still pending/processing - continue polling
        pollingRef.current = setTimeout(poll, 2000);
      } catch (error) {
        console.error("Polling error:", error);
        // Continue polling on network errors
        pollingRef.current = setTimeout(poll, 3000);
      }
    };

    pollingRef.current = setTimeout(poll, 2000);

    // Cleanup on unmount
    return () => {
      clearInterval(progressInterval);
      if (pollingRef.current) clearTimeout(pollingRef.current);
    };
  }, [router]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearTimeout(pollingRef.current);
    };
  }, []);

  // Check face status on mount
  useEffect(() => {
    async function checkFaceStatus() {
      if (!isAuthenticated) return;
      
      try {
        const status = await api.getFaceStatus();
        
        if (needsProfileSetup) {
          // New user: show 2-step registration flow
          setMode("register");
        } else if (status.hasRegisteredFace) {
          // Existing user with face: show update form
          setMode("update");
        } else if (status.isPending && status.taskId) {
          // Face registration is in progress — show processing state
          setMode("register");
          setCurrentStep(2);
          startPolling(status.taskId);
        } else {
          // Existing user without face: show face step only
          setMode("register");
          setCurrentStep(2);
        }
      } catch (error) {
        console.error("Failed to check face status:", error);
        // Fallback to register mode
        setMode(needsProfileSetup ? "register" : "update");
      } finally {
        setIsCheckingStatus(false);
      }
    }
    
    if (!isLoading && isAuthenticated) {
      checkFaceStatus();
    }
  }, [isLoading, isAuthenticated, needsProfileSetup, startPolling]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/");
    }
  }, [isLoading, isAuthenticated, router]);

  // Pre-fill from user data
  useEffect(() => {
    if (user) {
      setProfileData({
        fullName: user.name || "",
        school: user.profileData?.school || "",
        phoneNumber: user.profileData?.phone_number || "",
      });
    }
  }, [user]);

  // Auto-open camera in update mode
  useEffect(() => {
    if (mode === "update" && !isCapturing && !previewUrl && !selectedFile) {
      startCamera();
    }
  }, [mode]);

  // Lightweight face detection using browser FaceDetector API (no heavy libs)
  useEffect(() => {
    if (!isCapturing) {
      setFaceQuality('none');
      setQualityScore(0);
      return;
    }

    let active = true;
    let detector: any = null;

    // Only use browser FaceDetector if available (Chrome/Edge)
    if (typeof window !== 'undefined' && 'FaceDetector' in window) {
      try {
        detector = new (window as any).FaceDetector({ fastMode: true, maxDetectedFaces: 5 });
        setHasFaceDetector(true);
      } catch {
        setHasFaceDetector(false);
      }
    }

    const runDetection = async () => {
      if (!active) return;

      const video = webcamRef.current?.video;
      const canvas = canvasRef.current;

      if (!video || !canvas || video.readyState < 2) {
        if (active) setTimeout(runDetection, 300);
        return;
      }

      if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
      if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) { if (active) setTimeout(runDetection, 300); return; }
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (detector) {
        try {
          const faces = await detector.detect(video);
          const boxes = faces.map((f: any) => {
            const bb = f.boundingBox;
            return { x: bb.x, y: bb.y, width: bb.width, height: bb.height };
          });

          if (boxes.length === 1) {
            const bb = boxes[0];
            const faceRatio = (bb.width * bb.height) / (canvas.width * canvas.height);
            const cx = bb.x + bb.width / 2;
            const cy = bb.y + bb.height / 2;
            const isCentered =
              Math.abs(cx - canvas.width / 2) < canvas.width * 0.3 &&
              Math.abs(cy - canvas.height / 2) < canvas.height * 0.3;
            const isGoodSize = faceRatio > 0.03 && faceRatio < 0.8;
            const quality = isCentered && isGoodSize ? 'good' : 'poor';

            const centerScore = Math.max(0, 1 - Math.max(
              Math.abs(cx - canvas.width / 2) / (canvas.width * 0.3),
              Math.abs(cy - canvas.height / 2) / (canvas.height * 0.3)
            ));
            const sizeScore = faceRatio > 0.03 ? Math.min(1, faceRatio / 0.15) : 0;
            const score = Math.round((centerScore * 0.5 + sizeScore * 0.5) * 100);
            setQualityScore(score);

            lastBboxRef.current = { x: bb.x, y: bb.y, w: bb.width, h: bb.height };

            // Draw bounding box
            ctx.strokeStyle = quality === 'good' ? '#22c55e' : '#eab308';
            ctx.lineWidth = Math.max(2, canvas.width * 0.005);
            ctx.beginPath();
            const r = Math.min(bb.width, bb.height) * 0.08;
            ctx.roundRect(bb.x, bb.y, bb.width, bb.height, r);
            ctx.stroke();

            // Corner markers
            const cornerLen = Math.min(bb.width, bb.height) * 0.15;
            ctx.lineWidth = Math.max(3, canvas.width * 0.007);
            const drawCorner = (cx: number, cy: number, dx: number, dy: number) => {
              ctx.beginPath();
              ctx.moveTo(cx + dx * cornerLen, cy);
              ctx.lineTo(cx, cy);
              ctx.lineTo(cx, cy + dy * cornerLen);
              ctx.stroke();
            };
            drawCorner(bb.x, bb.y, 1, 1);
            drawCorner(bb.x + bb.width, bb.y, -1, 1);
            drawCorner(bb.x, bb.y + bb.height, 1, -1);
            drawCorner(bb.x + bb.width, bb.y + bb.height, -1, -1);

            setFaceQuality(quality);
          } else {
            setFaceQuality(boxes.length > 1 ? 'poor' : 'none');
            setQualityScore(0);
            lastBboxRef.current = null;
            if (boxes.length > 1) {
              boxes.forEach((bb: any) => {
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 2;
                ctx.strokeRect(bb.x, bb.y, bb.width, bb.height);
              });
            }
          }
        } catch {
          // Detection failed silently
        }
      }

      if (active) setTimeout(runDetection, 500); // ~2 FPS - lightweight
    };

    runDetection();

    return () => { active = false; };
  }, [isCapturing]);

  // Compress image to max dimension for faster upload
  const compressImage = useCallback((file: File, maxSize = 1024): Promise<File> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width <= maxSize && height <= maxSize) {
          URL.revokeObjectURL(img.src);
          resolve(file);
          return;
        }
        const ratio = Math.min(maxSize / width, maxSize / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
        const c = document.createElement('canvas');
        c.width = width;
        c.height = height;
        const ctx = c.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          c.toBlob((blob) => {
            URL.revokeObjectURL(img.src);
            resolve(blob ? new File([blob], file.name, { type: 'image/jpeg' }) : file);
          }, 'image/jpeg', 0.85);
        } else {
          URL.revokeObjectURL(img.src);
          resolve(file);
        }
      };
      img.onerror = () => { URL.revokeObjectURL(img.src); resolve(file); };
      img.src = URL.createObjectURL(file);
    });
  }, []);

  const videoConstraints = {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    facingMode: facingMode,
  };

  const capturePhoto = useCallback(() => {
    if (!webcamRef.current) return;

    const imageSrc = webcamRef.current.getScreenshot();
    if (imageSrc) {
      // Convert base64 to File
      fetch(imageSrc)
        .then((res) => res.blob())
        .then((blob) => {
          const file = new File([blob], "selfie.jpg", { type: "image/jpeg" });
          setSelectedFile(file);
          setPreviewUrl(imageSrc);
          setIsCapturing(false);
        });
    }
  }, []);

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  const toggleMirror = () => {
    setIsMirrored((prev) => !prev);
  };

  const startCamera = () => {
    setIsCapturing(true);
  };

  const stopCamera = () => {
    setIsCapturing(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast.error("Vui lòng chọn file hình ảnh");
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setCroppedFaceUrl(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  const validateProfile = () => {
    if (!profileData.fullName.trim()) {
      toast.error("Vui lòng nhập họ và tên");
      return false;
    }
    if (!profileData.phoneNumber.trim()) {
      toast.error("Vui lòng nhập số điện thoại");
      return false;
    }
    if (!/^[0-9]{10,11}$/.test(profileData.phoneNumber.replace(/\s/g, ""))) {
      toast.error("Số điện thoại không hợp lệ (cần 10-11 số)");
      return false;
    }
    return true;
  };

  const handleStep1Submit = async () => {
    if (!validateProfile()) return;

    setIsSubmitting(true);
    try {
      await api.updateProfile({
        name: profileData.fullName,
        profileData: {
          school: profileData.school,
          phone_number: profileData.phoneNumber,
        },
      });

      await refreshUser();
      toast.success("Đã lưu thông tin cá nhân");
      setCurrentStep(2);
    } catch (error: any) {
      console.error("Profile update error:", error);
      toast.error(error.message || "Có lỗi xảy ra. Vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFaceSubmit = async () => {
    if (!selectedFile) {
      toast.error("Vui lòng chọn hoặc chụp ảnh khuôn mặt");
      return;
    }

    setIsSubmitting(true);
    setProcessingStatus("uploading");
    setProcessingProgress(0);
    setIsProcessing(true);
    try {
      const compressed = await compressImage(selectedFile);
      setProcessingProgress(10);
      const result = await api.registerFace(compressed);
      setProcessingProgress(15);
      
      // Start polling for task completion
      if (result.qdrant_id) {
        startPolling(result.qdrant_id);
      } else {
        // Fallback: check face-status for task id
        const status = await api.getFaceStatus();
        if (status.isPending && status.taskId) {
          startPolling(status.taskId);
        } else {
          // No task found, just redirect
          setProcessingStatus("completed");
          setProcessingProgress(100);
          setTimeout(() => router.push("/gallery"), 2000);
        }
      }
    } catch (error: any) {
      setIsProcessing(false);
      setProcessingProgress(0);
      toast.error(error.message || "Có lỗi xảy ra. Vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProfileUpdate = async () => {
    if (!validateProfile()) return;

    setIsSubmitting(true);
    try {
      await api.updateProfile({
        name: profileData.fullName,
        profileData: {
          school: profileData.school,
          phone_number: profileData.phoneNumber,
        },
      });

      await refreshUser();
      toast.success("Cập nhật thông tin thành công!");
    } catch (error: any) {
      console.error("Update error:", error);
      toast.error(error.message || "Có lỗi xảy ra. Vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFaceUpdate = async () => {
    if (!selectedFile) {
      toast.error("Vui lòng chọn hoặc chụp ảnh khuôn mặt mới");
      return;
    }

    setIsSubmitting(true);
    setProcessingStatus("uploading");
    setProcessingProgress(0);
    setIsProcessing(true);
    try {
      const compressed = await compressImage(selectedFile);
      setProcessingProgress(10);
      const result = await api.registerFace(compressed);
      setProcessingProgress(15);
      clearFile();
      
      // Start polling for task completion
      if (result.qdrant_id) {
        startPolling(result.qdrant_id);
      } else {
        const status = await api.getFaceStatus();
        if (status.isPending && status.taskId) {
          startPolling(status.taskId);
        } else {
          setProcessingStatus("completed");
          setProcessingProgress(100);
          setTimeout(() => router.push("/gallery"), 2000);
        }
      }
    } catch (error: any) {
      setIsProcessing(false);
      setProcessingProgress(0);
      toast.error(error.message || "Có lỗi xảy ra. Vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkipFaceRegistration = () => {
    router.push("/gallery");
  };

  const handleBackToHome = () => {
    router.push("/");
  };

  // Camera component (reusable)
  const CameraSection = ({ showCurrentFaceMessage = false }: { showCurrentFaceMessage?: boolean }) => (
    <div className="space-y-4">
      {/* Camera/Preview Area */}
      <div className="aspect-square relative rounded-2xl overflow-hidden bg-black">
        {isCapturing ? (
          <>
            <Webcam
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              screenshotQuality={1}
              videoConstraints={videoConstraints}
              mirrored={isMirrored}
              className="w-full h-full object-cover"
              onUserMediaError={(error) => {
                console.error("Camera error:", error);
                toast.error("Không thể truy cập camera.");
                setIsCapturing(false);
              }}
            />
            {/* Face detection bounding box canvas */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ transform: isMirrored ? 'scaleX(-1)' : undefined }}
            />
            {/* Quality score + status */}
            <div className="absolute bottom-0 inset-x-0 p-3 space-y-2">
              {hasFaceDetector && faceQuality !== 'none' && (
                <div className="px-3">
                  <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${qualityScore >= 70 ? 'bg-green-400' : qualityScore >= 40 ? 'bg-yellow-400' : 'bg-red-400'}`}
                      initial={false}
                      animate={{ width: `${qualityScore}%` }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                    />
                  </div>
                  <p className="text-[10px] text-white/60 text-center mt-1">
                    Chất lượng: {qualityScore}%
                  </p>
                </div>
              )}
              <motion.div
                layout
                className={`rounded-full px-4 py-2 text-xs font-medium text-center backdrop-blur-sm ${
                  faceQuality === 'good'
                    ? 'bg-green-500/80 text-white'
                    : faceQuality === 'poor'
                      ? 'bg-yellow-500/80 text-white'
                      : 'bg-black/50 text-white/80'
                }`}
              >
                {hasFaceDetector ? (
                  faceQuality === 'good'
                    ? '✓ Khuôn mặt rõ ràng — nhấn Chụp ngay'
                    : faceQuality === 'poor'
                      ? 'Căn chỉnh khuôn mặt vào giữa khung hình'
                      : 'Đang tìm khuôn mặt...'
                ) : (
                  'Hướng mặt vào camera và nhấn Chụp ngay'
                )}
              </motion.div>
            </div>
            {/* Camera controls */}
            <div className="absolute top-3 right-3 flex gap-2">
              <button
                onClick={toggleMirror}
                className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
              >
                <FlipHorizontal className="h-5 w-5" />
              </button>
              <button
                onClick={toggleCamera}
                className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
              >
                <SwitchCamera className="h-5 w-5" />
              </button>
            </div>
            {/* Face detection indicator */}
            {hasFaceDetector && (
              <div className="absolute top-3 left-3">
                <motion.div
                  layout
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm ${
                    faceQuality === 'good' ? 'bg-green-500/80 text-white' :
                    faceQuality === 'poor' ? 'bg-yellow-500/80 text-white' :
                    'bg-black/50 text-white/70'
                  }`}
                >
                  <ScanFace className="h-3.5 w-3.5" />
                  <span>{faceQuality === 'good' ? 'Phát hiện' : faceQuality === 'poor' ? 'Không rõ' : 'Tìm...'}</span>
                </motion.div>
              </div>
            )}
          </>
        ) : previewUrl ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="w-full h-full relative"
          >
            <img
              src={previewUrl}
              alt="Preview"
              className="w-full h-full object-cover"
            />
            <button
              onClick={clearFile}
              className="absolute top-3 right-3 p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
            >
              <X className="h-5 w-5" />
            </button>
            {/* Cropped face preview */}
            {croppedFaceUrl && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: "spring", damping: 15, stiffness: 200, delay: 0.15 }}
                className="absolute bottom-14 left-1/2 -translate-x-1/2"
              >
                <div className="relative">
                  <img
                    src={croppedFaceUrl}
                    alt="Khuôn mặt phát hiện"
                    className="w-20 h-20 rounded-full object-cover border-3 border-green-400 shadow-lg"
                  />
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.4, type: "spring" }}
                    className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center"
                  >
                    <Check className="h-3.5 w-3.5 text-white" />
                  </motion.div>
                </div>
              </motion.div>
            )}
            {/* Confirmation message */}
            <div className="absolute bottom-0 inset-x-0 p-3">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-full px-4 py-2 text-xs font-medium text-center bg-green-500/80 text-white backdrop-blur-sm"
              >
                ✓ Khuôn mặt đã được nhận diện — xác nhận hoặc chụp lại
              </motion.div>
            </div>
          </motion.div>
        ) : (
          <div
            className="w-full h-full flex flex-col items-center justify-center text-muted-foreground p-4 bg-muted cursor-pointer hover:bg-muted/80 transition-colors"
            onClick={() => { clearFile(); startCamera(); }}
          >
            <Camera className="h-16 w-16 mb-4 opacity-50" />
            {showCurrentFaceMessage ? (
              <p className="text-sm text-center">Chạm để mở camera và cập nhật khuôn mặt</p>
            ) : (
              <p className="text-sm">Chạm để mở camera hoặc tải ảnh lên</p>
            )}
          </div>
        )}
      </div>

      {/* Camera buttons */}
      <div className="flex gap-3">
        {isCapturing ? (
          <>
            <Button
              variant="outline"
              className="flex-1 rounded-full"
              onClick={stopCamera}
            >
              Hủy
            </Button>
            <Button className="flex-1 rounded-full" onClick={capturePhoto}>
              <Camera className="h-4 w-4 mr-2" />
              Chụp ngay
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              className="flex-1 rounded-full"
              onClick={() => {
                clearFile();
                startCamera();
              }}
            >
              <Camera className="h-4 w-4 mr-2" />
              {previewUrl ? "Chụp lại" : "Mở camera"}
            </Button>
            <label className="flex-1">
              <Button
                variant="outline"
                className="w-full rounded-full"
                asChild
              >
                <span>
                  <Upload className="h-4 w-4 mr-2" />
                  Tải ảnh lên
                </span>
              </Button>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />
            </label>
          </>
        )}
      </div>

      {/* Tips */}
      <div className="bg-primary/5 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-primary mt-0.5" />
          <div className="text-sm">
            <p className="font-medium mb-1">Lưu ý để ảnh tốt nhất:</p>
            <ul className="text-muted-foreground space-y-1">
              <li>• Ánh sáng đầy đủ, không ngược sáng</li>
              <li>• Nhìn thẳng vào camera</li>
              <li>• Không đeo kính râm hoặc che mặt</li>
              <li>• Khuôn mặt chiếm phần lớn khung hình</li>
              {hasFaceDetector && <li>• Hệ thống sẽ hiển thị điểm chất lượng, bạn nhấn <strong>Chụp ngay</strong> khi sẵn sàng</li>}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  if (isLoading || isCheckingStatus) {
    return <PageLoading text="Đang tải..." />;
  }

  if (!isAuthenticated) {
    return null;
  }

  // ====== PROCESSING OVERLAY ======
  if (isProcessing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <Navbar />
        <main className="container pt-24 pb-12 flex items-center justify-center min-h-[80vh]">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full mx-auto text-center"
          >
            <div className="bg-card border rounded-3xl p-8 shadow-lg space-y-8">
              {/* Animated icon */}
              <div className="relative mx-auto w-28 h-28">
                {processingStatus === "completed" ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", damping: 10, stiffness: 200 }}
                    className="w-28 h-28 rounded-full bg-green-500/10 flex items-center justify-center"
                  >
                    <CheckCircle2 className="h-14 w-14 text-green-500" />
                  </motion.div>
                ) : processingStatus === "failed" ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", damping: 10, stiffness: 200 }}
                    className="w-28 h-28 rounded-full bg-red-500/10 flex items-center justify-center"
                  >
                    <XCircle className="h-14 w-14 text-red-500" />
                  </motion.div>
                ) : (
                  <>
                    {/* Spinning ring */}
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                      className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary border-r-primary/30"
                    />
                    {/* Pulsing inner circle */}
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                      className="absolute inset-3 rounded-full bg-primary/10 flex items-center justify-center"
                    >
                      <ScanFace className="h-10 w-10 text-primary" />
                    </motion.div>
                  </>
                )}
              </div>

              {/* Status text */}
              <div className="space-y-2">
                <h2 className="text-xl font-bold">
                  {processingStatus === "uploading" && "Đang tải ảnh lên..."}
                  {processingStatus === "processing" && "Đang xử lý khuôn mặt..."}
                  {processingStatus === "completed" && "Hoàn tất!"}
                  {processingStatus === "failed" && "Xử lý thất bại"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {processingStatus === "uploading" && "Vui lòng chờ trong giây lát..."}
                  {processingStatus === "processing" && "Hệ thống đang phân tích và lưu trữ khuôn mặt của bạn. Quá trình này có thể mất vài giây."}
                  {processingStatus === "completed" && "Khuôn mặt đã được đăng ký thành công! Đang chuyển hướng..."}
                  {processingStatus === "failed" && "Đã xảy ra lỗi khi xử lý khuôn mặt. Bạn có thể thử lại."}
                </p>
              </div>

              {/* Progress bar */}
              {processingStatus !== "failed" && (
                <div className="space-y-2">
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${
                        processingStatus === "completed"
                          ? "bg-green-500"
                          : "bg-primary"
                      }`}
                      initial={{ width: "0%" }}
                      animate={{ width: `${processingProgress}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {Math.round(processingProgress)}%
                  </p>
                </div>
              )}

              {/* Processing steps indicator */}
              {(processingStatus === "processing" || processingStatus === "uploading") && (
                <div className="space-y-3 text-left">
                  {[
                    { label: "Tải ảnh lên server", done: processingProgress > 10 },
                    { label: "Phát hiện khuôn mặt", done: processingProgress > 35 },
                    { label: "Tạo vector nhận diện", done: processingProgress > 60 },
                    { label: "Lưu trữ và đối chiếu", done: processingProgress > 85 },
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      {step.done ? (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0"
                        >
                          <Check className="h-3 w-3 text-white" />
                        </motion.div>
                      ) : processingProgress > (i * 25) ? (
                        <Loader2 className="h-5 w-5 text-primary animate-spin flex-shrink-0" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-muted flex-shrink-0" />
                      )}
                      <span className={step.done ? "text-foreground" : "text-muted-foreground"}>
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Action button for failed state */}
              {processingStatus === "failed" && (
                <Button
                  className="w-full rounded-full h-12"
                  onClick={() => {
                    setIsProcessing(false);
                    setProcessingTaskId(null);
                    setProcessingProgress(0);
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Thử lại
                </Button>
              )}
            </div>
          </motion.div>
        </main>
      </div>
    );
  }

  // ====== UPDATE MODE UI with TABS ======
  if (mode === "update") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <Navbar />

        <main className="container pt-24 pb-12">
          {/* Back button */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="mb-6"
          >
            <Link href="/gallery">
              <Button variant="ghost" className="rounded-full">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Quay lại Gallery
              </Button>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-lg mx-auto"
          >
            <div className="bg-card border rounded-3xl p-8 shadow-lg">
              <div className="text-center mb-6">
                {/* User avatar with edit option */}
                <div
                  className="relative w-20 h-20 mx-auto mb-4 cursor-pointer group"
                  onClick={() => {
                    const tabTrigger = document.querySelector('[data-state="inactive"][value="face"]') as HTMLElement;
                    if (tabTrigger) tabTrigger.click();
                    clearFile();
                    startCamera();
                  }}
                >
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt="Avatar" className="w-20 h-20 rounded-full object-cover border-2 border-muted" />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-10 w-10 text-primary" />
                    </div>
                  )}
                  <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera className="h-6 w-6 text-white" />
                  </div>
                </div>
                <h1 className="text-2xl font-bold mb-2">Cập nhật thông tin</h1>
                <p className="text-muted-foreground">
                  Chỉnh sửa thông tin cá nhân và khuôn mặt của bạn
                </p>
              </div>

              <Tabs defaultValue="face" className="w-full">
                <TabsList className="grid w-full grid-cols-2 rounded-full h-12 mb-6">
                  <TabsTrigger value="face" className="rounded-full data-[state=active]:rounded-full">
                    <Camera className="h-4 w-4 mr-2" />
                    Khuôn mặt
                  </TabsTrigger>
                  <TabsTrigger value="info" className="rounded-full data-[state=active]:rounded-full">
                    <User className="h-4 w-4 mr-2" />
                    Thông tin
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="face" className="space-y-4">
                  <CameraSection showCurrentFaceMessage={true} />
                  
                  <Button
                    className="w-full rounded-full h-12"
                    onClick={handleFaceUpdate}
                    disabled={!selectedFile || isSubmitting}
                  >
                    {isSubmitting ? (
                      <RefreshCw className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        Cập nhật khuôn mặt
                        <Check className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </Button>
                </TabsContent>

                <TabsContent value="info" className="space-y-4">
                  <ProfileFormComponent profileData={profileData} onProfileChange={setProfileData} />
                  
                  <Button
                    className="w-full rounded-full h-12"
                    onClick={handleProfileUpdate}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <RefreshCw className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        Lưu thông tin
                        <Check className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </Button>
                </TabsContent>
              </Tabs>
            </div>
          </motion.div>
        </main>
      </div>
    );
  }

  // ====== REGISTER MODE UI (2-step) ======
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <Navbar />

      <main className="container pt-24 pb-12">
        {/* Back button - only show if not forced to complete profile */}
        {!needsProfileSetup && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="mb-6"
          >
            <Link href="/gallery">
              <Button variant="ghost" className="rounded-full">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Quay lại Gallery
              </Button>
            </Link>
          </motion.div>
        )}

        {/* Header message for forced profile setup */}
        {needsProfileSetup && currentStep === 1 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-lg mx-auto mb-6 p-4 rounded-2xl bg-primary/10 border border-primary/20 text-center"
          >
            <p className="text-sm text-primary">
              Chào mừng bạn đến với LiveHub! Vui lòng hoàn thành thông tin để tiếp tục sử dụng.
            </p>
          </motion.div>
        )}

        {/* Progress Steps */}
        <div className="max-w-xl mx-auto mb-12">
          <div className="flex items-center justify-center gap-4">
            {[1, 2].map((step) => (
              <div key={step} className="flex items-center gap-2">
                <motion.div
                  initial={false}
                  animate={{
                    scale: currentStep === step ? 1.1 : 1,
                    backgroundColor:
                      currentStep >= step
                        ? "hsl(var(--primary))"
                        : "hsl(var(--muted))",
                  }}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold"
                  style={{
                    color:
                      currentStep >= step
                        ? "hsl(var(--primary-foreground))"
                        : "hsl(var(--muted-foreground))",
                  }}
                >
                  {currentStep > step ? <Check className="h-5 w-5" /> : step}
                </motion.div>
                <span
                  className={`text-sm font-medium ${
                    currentStep >= step
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {step === 1 ? "Thông tin cá nhân" : "Đăng ký khuôn mặt"}
                </span>
                {step < 2 && (
                  <div className="w-12 h-1 rounded-full bg-muted mx-2">
                    <motion.div
                      initial={false}
                      animate={{
                        width: currentStep > step ? "100%" : "0%",
                      }}
                      className="h-full rounded-full bg-primary"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          {currentStep === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="max-w-lg mx-auto"
            >
              <div className="bg-card border rounded-3xl p-8 shadow-lg">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <User className="h-8 w-8 text-primary" />
                  </div>
                  <h1 className="text-2xl font-bold mb-2">Thông tin cá nhân</h1>
                  <p className="text-muted-foreground">
                    Điền thông tin để chúng tôi có thể liên hệ với bạn
                  </p>
                </div>

                <ProfileFormComponent profileData={profileData} onProfileChange={setProfileData} />

                {/* Action buttons */}
                <div className="flex gap-3 pt-6">
                  {!needsProfileSetup && (
                    <Button
                      variant="outline"
                      className="rounded-full"
                      onClick={handleBackToHome}
                    >
                      <Home className="h-4 w-4 mr-2" />
                      Trang chủ
                    </Button>
                  )}
                  
                  <Button
                    className="flex-1 rounded-full h-12 text-base"
                    onClick={handleStep1Submit}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <RefreshCw className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        Tiếp tục
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {currentStep === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-lg mx-auto"
            >
              <div className="bg-card border rounded-3xl p-8 shadow-lg">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Camera className="h-8 w-8 text-primary" />
                  </div>
                  <h1 className="text-2xl font-bold mb-2">Đăng ký khuôn mặt</h1>
                  <p className="text-muted-foreground">
                    Chụp hoặc tải lên ảnh selfie để hệ thống nhận diện bạn
                  </p>
                </div>

                <CameraSection />

                {/* Navigation */}
                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={() => setCurrentStep(1)}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Quay lại
                  </Button>
                  <Button
                    className="flex-1 rounded-full h-12"
                    onClick={handleFaceSubmit}
                    disabled={!selectedFile || isSubmitting}
                  >
                    {isSubmitting ? (
                      <RefreshCw className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        Hoàn tất
                        <Check className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </Button>
                </div>

                {/* Skip button */}
                <div className="text-center pt-4">
                  <button
                    onClick={handleSkipFaceRegistration}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Bỏ qua, đăng ký sau →
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
