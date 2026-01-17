"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { 
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { 
  Users, 
  Image as ImageIcon, 
  Shield, 
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell } from "recharts";

const adminCards = [
  {
    title: "Quản lý ảnh",
    description: "Upload, xem và quản lý tất cả ảnh sự kiện",
    icon: ImageIcon,
    href: "/admin/images",
    color: "from-green-500 to-green-600",
  },
  {
    title: "Người dùng",
    description: "Quản lý người dùng hệ thống",
    icon: Users,
    href: "/admin/users",
    color: "from-purple-500 to-purple-600",
  },
];

interface Stats {
  images: { total: number; processing: number; ready: number; error: number };
  faces: { total: number; assigned: number; unassigned: number };
  users: { total: number };
}

const chartConfig = {
  processing: {
    label: "Đang xử lý",
    color: "hsl(45, 93%, 47%)",
  },
  ready: {
    label: "Sẵn sàng",
    color: "hsl(142, 76%, 36%)",
  },
  error: {
    label: "Lỗi",
    color: "hsl(0, 84%, 60%)",
  },
  assigned: {
    label: "Đã gán",
    color: "hsl(142, 76%, 36%)",
  },
  unassigned: {
    label: "Chưa gán",
    color: "hsl(221, 83%, 53%)",
  },
};

export default function AdminPage() {
  const { user, isLoading, isAuthenticated, isAdmin } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !isAdmin)) {
      router.replace("/");
    }
  }, [isLoading, isAuthenticated, isAdmin, router]);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await api.adminGetStats();
        setStats(res);
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      } finally {
        setIsLoadingStats(false);
      }
    }
    
    if (isAuthenticated && isAdmin) {
      fetchStats();
    }
  }, [isAuthenticated, isAdmin]);

  const refreshStats = async () => {
    setIsLoadingStats(true);
    try {
      const res = await api.adminGetStats();
      setStats(res);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  // Chart data
  const imageStatusData = stats ? [
    { name: "Đang xử lý", value: stats.images.processing, fill: chartConfig.processing.color },
    { name: "Sẵn sàng", value: stats.images.ready, fill: chartConfig.ready.color },
    { name: "Lỗi", value: stats.images.error, fill: chartConfig.error.color },
  ] : [];

  const faceStatusData = stats ? [
    { name: "Đã gán", value: stats.faces.assigned, fill: chartConfig.assigned.color },
    { name: "Chưa gán", value: stats.faces.unassigned, fill: chartConfig.unassigned.color },
  ] : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <Navbar />
      
      <main className="container pt-24 pb-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-primary/10">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-3xl font-bold">Trang quản trị</h1>
          </div>
          <p className="text-muted-foreground">
            Xin chào, <span className="font-medium text-foreground">{user?.name || user?.email}</span>
          </p>
        </motion.div>

        {/* Admin Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {adminCards.map((card, index) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
            >
              <Link href={card.href}>
                <div className="group relative p-6 rounded-3xl bg-card border border-border hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 overflow-hidden">
                  {/* Background gradient */}
                  <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${card.color} opacity-10 rounded-full blur-2xl transform translate-x-8 -translate-y-8 group-hover:opacity-20 transition-opacity`} />
                  
                  {/* Icon */}
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${card.color} flex items-center justify-center mb-4 shadow-lg`}>
                    <card.icon className="h-7 w-7 text-white" />
                  </div>
                  
                  {/* Content */}
                  <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {card.description}
                  </p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Stats Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold">Thống kê hệ thống</h2>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={refreshStats}
              disabled={isLoadingStats}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingStats ? "animate-spin" : ""}`} />
              Làm mới
            </Button>
          </div>

          {isLoadingStats ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : stats ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Quick stats cards */}
              <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Tổng ảnh", value: stats.images.total, icon: ImageIcon, color: "text-blue-500" },
                  { label: "Khuôn mặt", value: stats.faces.total, icon: Users, color: "text-purple-500" },
                  { label: "Đã gán", value: stats.faces.assigned, icon: Shield, color: "text-green-500" },
                  { label: "Người dùng", value: stats.users.total, icon: Users, color: "text-orange-500" },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="p-4 rounded-2xl bg-card border border-border"
                  >
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <stat.icon className={`h-4 w-4 ${stat.color}`} />
                      <span className="text-sm">{stat.label}</span>
                    </div>
                    <p className="text-2xl font-bold">{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* Image Status Chart */}
              <div className="bg-card border rounded-3xl p-6">
                <h3 className="text-lg font-semibold mb-4">Trạng thái ảnh</h3>
                <ChartContainer config={chartConfig} className="h-[200px]">
                  <BarChart data={imageStatusData} layout="vertical">
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={80} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ChartContainer>
              </div>

              {/* Face Assignment Chart */}
              <div className="bg-card border rounded-3xl p-6">
                <h3 className="text-lg font-semibold mb-4">Gán khuôn mặt</h3>
                <ChartContainer config={chartConfig} className="h-[200px]">
                  <PieChart>
                    <Pie
                      data={faceStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {faceStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ChartContainer>
              </div>

              {/* Summary */}
              <div className="bg-card border rounded-3xl p-6">
                <h3 className="text-lg font-semibold mb-4">Tổng quan</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Ảnh đang xử lý</span>
                    <span className="font-semibold text-yellow-500">{stats.images.processing}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Ảnh sẵn sàng</span>
                    <span className="font-semibold text-green-500">{stats.images.ready}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Ảnh lỗi</span>
                    <span className="font-semibold text-red-500">{stats.images.error}</span>
                  </div>
                  <div className="border-t pt-4 mt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Tỷ lệ gán khuôn mặt</span>
                      <span className="font-semibold">
                        {stats.faces.total > 0
                          ? Math.round((stats.faces.assigned / stats.faces.total) * 100)
                          : 0}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              Không thể tải thống kê
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
