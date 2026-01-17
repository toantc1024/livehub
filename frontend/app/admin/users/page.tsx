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
  Eye,
  FileSpreadsheet,
  Download
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface UserItem {
  id: string;
  name?: string;
  email: string;
  avatarUrl?: string;
  role?: string;
  profileData?: {
    school?: string;
    phone_number?: string;
    student_id?: string;
    class_name?: string;
    description?: string;
    [key: string]: any;
  };
  createdAt: string;
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
  const [viewUser, setViewUser] = useState<UserItem | null>(null);

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

  const handleExport = async () => {
    try {
        toast.promise(
            async () => {
                const res = await api.adminListUsers(1, 100, searchQuery || undefined);
                const exportUsers = res.items as UserItem[];
                
                const exportData = exportUsers.map(user => ({
                    "ID": user.id,
                    "Tên": user.name || "N/A",
                    "Email": user.email,
                    "Vai trò": user.role,
                    "Trường học": user.profileData?.school || "N/A",
                    "SĐT": user.profileData?.phone_number || "N/A",
                    "MSV": user.profileData?.student_id || "N/A",
                    "Lớp": user.profileData?.class_name || "N/A",
                    "Mô tả": user.profileData?.description || "N/A",
                    "Ngày tham gia": new Date(user.createdAt).toLocaleDateString('vi-VN')
                }));
                
                const worksheet = XLSX.utils.json_to_sheet(exportData);
                const maxWidth = exportData.reduce((w, r) => Math.max(w, r["Email"].length), 10);
                worksheet["!cols"] = [
                    { wch: 10 }, 
                    { wch: 20 }, 
                    { wch: maxWidth + 5 },
                    { wch: 10 },
                    { wch: 20 },
                    { wch: 15 },
                    { wch: 10 },
                    { wch: 10 },
                    { wch: 20 },
                    { wch: 15 },
                ];

                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, "Users");
                const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
                const data = new Blob([excelBuffer], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8'});
                
                saveAs(data, `users_export_${new Date().toISOString().split('T')[0]}.xlsx`);
            },
            {
                loading: 'Đang chuẩn bị dữ liệu xuất...',
                success: 'Đã xuất file Excel',
                error: 'Xuất file thất bại',
            }
        );
    } catch (e) {
        toast.error("Xuất file thất bại");
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
            
            <Button
                variant="outline"
                className="rounded-full gap-2"
                onClick={handleExport}
            >
                <FileSpreadsheet className="h-4 w-4" />
                Xuất Excel
            </Button>
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
                    <th className="text-left p-4 font-medium hidden md:table-cell">Trường học</th>
                    <th className="text-left p-4 font-medium hidden md:table-cell">SĐT</th>
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
                          <div>
                            <div className="font-medium">
                                {user.name || "Chưa đặt tên"}
                            </div>
                            <div className="text-xs text-muted-foreground">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-sm hidden md:table-cell max-w-[200px] truncate" title={user.profileData?.school}>
                        {user.profileData?.school || <span className="text-muted-foreground italic text-xs">N/A</span>}
                      </td>
                      <td className="p-4 text-sm hidden md:table-cell">
                        {user.profileData?.phone_number || <span className="text-muted-foreground italic text-xs">N/A</span>}
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
                        <div className="flex justify-end gap-2">
                             <Button 
                                variant="ghost" 
                                size="icon" 
                                className="rounded-full h-8 w-8 text-muted-foreground hover:text-primary"
                                onClick={() => setViewUser(user)}
                                title="Xem chi tiết"
                             >
                                <Eye className="h-4 w-4" />
                             </Button>
                             
                            <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
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
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => setDeleteUserId(user.id)}
                                >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Xóa người dùng
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
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
      
      {/* View User Detail Dialog */}
      <Dialog open={!!viewUser} onOpenChange={(open) => !open && setViewUser(null)}>
        <DialogContent className="max-w-md rounded-3xl">
            <DialogHeader>
                <DialogTitle>Thông tin người dùng</DialogTitle>
            </DialogHeader>
            
            {viewUser && (
                <div className="space-y-6">
                    <div className="flex items-center gap-4">
                        {viewUser.avatarUrl ? (
                            <Image
                                src={viewUser.avatarUrl}
                                alt={viewUser.name || "User"}
                                width={64}
                                height={64}
                                className="rounded-full border-2 border-primary/10"
                            />
                        ) : (
                            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                                <Users className="h-8 w-8 text-muted-foreground" />
                            </div>
                        )}
                        <div>
                            <h3 className="text-lg font-bold">{viewUser.name || "Chưa đặt tên"}</h3>
                            <p className="text-muted-foreground">{viewUser.email}</p>
                            <Badge variant={viewUser.role === "ADMIN" ? "default" : "secondary"} className="mt-1">
                                {viewUser.role}
                            </Badge>
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                             <div>
                                <p className="text-muted-foreground mb-1">Ngày tham gia</p>
                                <p className="font-medium">{new Date(viewUser.createdAt).toLocaleDateString('vi-VN')}</p>
                             </div>
                             <div>
                                <p className="text-muted-foreground mb-1">Trường học</p>
                                <p className="font-medium">{viewUser.profileData?.school || "Chưa cập nhật"}</p>
                             </div>
                             <div>
                                <p className="text-muted-foreground mb-1">Số điện thoại</p>
                                <p className="font-medium">{viewUser.profileData?.phone_number || "Chưa cập nhật"}</p>
                             </div>
                             {/* Add more fields if available in profileData */}
                             {Object.entries(viewUser.profileData || {}).map(([key, value]) => {
                                 if (['school', 'phone_number'].includes(key)) return null;
                                 return (
                                     <div key={key}>
                                        <p className="text-muted-foreground mb-1 capitalize">{key.replace('_', ' ')}</p>
                                        <p className="font-medium">{String(value)}</p>
                                     </div>
                                 );
                             })}
                        </div>
                    </div>
                </div>
            )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
