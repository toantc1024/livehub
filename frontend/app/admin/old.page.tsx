"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  Image as ImageIcon, 
  Shield, 
  BarChart3,
  Settings,
  Upload,
  Search,
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

const adminCards = [
  {
    title: "Thống kê",
    description: "Xem tổng quan hệ thống",
    icon: BarChart3,
    href: "/admin/stats",
    color: "from-blue-500 to-blue-600",
  },
  {
    title: "Quản lý ảnh",
    description: "Xem và quản lý tất cả ảnh",
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
  {
    title: "Gán khuôn mặt",
    description: "Gán thủ công khuôn mặt cho người dùng",
    icon: Search,
    href: "/admin/faces",
    color: "from-orange-500 to-orange-600",
  },
  {
    title: "Upload ảnh",
    description: "Upload ảnh sự kiện mới",
    icon: Upload,
    href: "/admin/upload",
    color: "from-pink-500 to-pink-600",
  },
  {
    title: "Cài đặt",
    description: "Cấu hình hệ thống",
    icon: Settings,
    href: "/admin/settings",
    color: "from-gray-500 to-gray-600",
  },
];

export default function AdminPage() {
  const { user, isLoading, isAuthenticated, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !isAdmin)) {
      router.replace("/");
    }
  }, [isLoading, isAuthenticated, isAdmin, router]);

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

        {/* Quick Stats */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-12"
        >
          <h2 className="text-xl font-semibold mb-4">Thống kê nhanh</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Tổng ảnh", value: "---", icon: ImageIcon },
              { label: "Khuôn mặt", value: "---", icon: Users },
              { label: "Đã gán", value: "---", icon: Shield },
              { label: "Người dùng", value: "---", icon: Users },
            ].map((stat, index) => (
              <div
                key={stat.label}
                className="p-4 rounded-2xl bg-card border border-border"
              >
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <stat.icon className="h-4 w-4" />
                  <span className="text-sm">{stat.label}</span>
                </div>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
