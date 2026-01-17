"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import {
  ArrowLeft,
  Users,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Shield,
  ShieldCheck,
  Trash2,
  MoreHorizontal,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface UserItem {
  id: string;
  name?: string;
  email: string;
  avatarUrl?: string;
  role?: string;
}

export default function AdminUsersPage() {
  const { isLoading, isAuthenticated, isAdmin } = useAuth();
  const router = useRouter();
  
  const [users, setUsers] = useState<UserItem[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);

  const fetchUsers = useCallback(async (pageNum: number, search?: string) => {
    setIsLoadingUsers(true);
    try {
      const res = await api.adminListUsers(pageNum, 20, search || undefined);
      setUsers(res.items);
      setTotalPages(res.pages);
      setTotal(res.total);
      setPage(res.page);
    } catch (error) {
      console.error("Failed to fetch users:", error);
      toast.error("Không thể tải danh sách người dùng");
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      fetchUsers(1);
    }
  }, [isAuthenticated, isAdmin, fetchUsers]);

  const handleSearch = () => {
    fetchUsers(1, searchQuery);
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await api.adminUpdateUserRole(userId, newRole);
      toast.success("Đã cập nhật vai trò");
      fetchUsers(page, searchQuery);
    } catch (error) {
      toast.error("Không thể cập nhật vai trò");
    }
  };

  const handleDelete = async () => {
    if (!deleteUserId) return;
    
    try {
      await api.adminDeleteUser(deleteUserId);
      toast.success("Đã xóa người dùng");
      setDeleteUserId(null);
      fetchUsers(page, searchQuery);
    } catch (error) {
      toast.error("Không thể xóa người dùng");
    }
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
              <h1 className="text-3xl font-bold">Quản lý người dùng</h1>
              <p className="text-muted-foreground">
                {total} người dùng trong hệ thống
              </p>
            </div>
          </div>
        </motion.div>

        {/* Search & Actions */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 flex gap-2">
            <Input
              placeholder="Tìm theo tên hoặc email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSearch()}
              className="max-w-md rounded-full"
            />
            <Button
              variant="outline"
              size="icon"
              className="rounded-full"
              onClick={handleSearch}
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => fetchUsers(page, searchQuery)}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Làm mới
          </Button>
        </div>

        {/* Users Table */}
        {isLoadingUsers ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-20">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Không tìm thấy người dùng</p>
          </div>
        ) : (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-card rounded-3xl overflow-hidden border"
            >
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-4 font-medium">Người dùng</th>
                    <th className="text-left p-4 font-medium">Email</th>
                    <th className="text-left p-4 font-medium">Vai trò</th>
                    <th className="text-right p-4 font-medium">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user, index) => (
                    <motion.tr
                      key={user.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="border-t hover:bg-muted/30"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {user.avatarUrl ? (
                            <Image
                              src={user.avatarUrl}
                              alt={user.name || "User"}
                              width={40}
                              height={40}
                              className="rounded-full"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                              <Users className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                          <span className="font-medium">
                            {user.name || "Chưa đặt tên"}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {user.email}
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium
                            ${user.role === "ADMIN" 
                              ? "bg-primary/20 text-primary" 
                              : "bg-muted text-muted-foreground"}`}
                        >
                          {user.role === "ADMIN" ? (
                            <ShieldCheck className="h-3 w-3" />
                          ) : (
                            <Shield className="h-3 w-3" />
                          )}
                          {user.role === "ADMIN" ? "Admin" : "User"}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="rounded-full">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {user.role !== "ADMIN" ? (
                              <DropdownMenuItem
                                onClick={() => handleRoleChange(user.id, "ADMIN")}
                              >
                                <ShieldCheck className="h-4 w-4 mr-2" />
                                Nâng lên Admin
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => handleRoleChange(user.id, "USER")}
                              >
                                <Shield className="h-4 w-4 mr-2" />
                                Hạ xuống User
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeleteUserId(user.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Xóa người dùng
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </motion.div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full"
                  onClick={() => fetchUsers(page - 1, searchQuery)}
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
                  onClick={() => fetchUsers(page + 1, searchQuery)}
                  disabled={page >= totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa người dùng này? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
