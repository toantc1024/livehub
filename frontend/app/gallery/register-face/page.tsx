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

      {/* School */}
      <div className="space-y-2">
        <Label htmlFor="school" className="flex items-center gap-2">
          <School className="h-4 w-4" />
          Trường học <span className="text-destructive">*</span>
        </Label>
        <SchoolSelector
          value={profileData.school}
          onValueChange={(value) =>
            onProfileChange({ ...profileData, school: value })
          }
          placeholder="Tìm và chọn trường học..."
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
  }, [isLoading, isAuthenticated, needsProfileSetup]);

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

  const videoConstraints = {
    width: 480,
    height: 480,
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
    if (!profileData.school) {
      toast.error("Vui lòng chọn trường học");
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
    try {
      await api.registerFace(selectedFile);
      toast.success("Cập nhật khuôn mặt thành công!");
      router.push("/gallery");
    } catch (error: any) {
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
    try {
      await api.registerFace(selectedFile);
      toast.success("Cập nhật khuôn mặt thành công!");
      clearFile();
    } catch (error: any) {
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
      <div className="aspect-square relative rounded-2xl overflow-hidden bg-muted">
        {isCapturing ? (
          <>
            <Webcam
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              videoConstraints={videoConstraints}
              mirrored={isMirrored}
              className="w-full h-full object-cover"
              onUserMediaError={(error) => {
                console.error("Camera error:", error);
                toast.error("Không thể truy cập camera.");
                setIsCapturing(false);
              }}
            />
            <div className="absolute top-3 right-3 flex gap-2">
              <button
                onClick={toggleMirror}
                className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
              >
                <FlipHorizontal className="h-5 w-5" />
              </button>
              <button
                onClick={toggleCamera}
                className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
              >
                <SwitchCamera className="h-5 w-5" />
              </button>
            </div>
          </>
        ) : previewUrl ? (
          <>
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
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground p-4">
            <Camera className="h-16 w-16 mb-4 opacity-50" />
            {showCurrentFaceMessage ? (
              <p className="text-sm text-center">Đã đăng ký khuôn mặt. Chụp ảnh mới để cập nhật.</p>
            ) : (
              <p className="text-sm">Chụp ảnh hoặc tải lên</p>
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
              Chụp ảnh
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
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Edit3 className="h-8 w-8 text-primary" />
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
