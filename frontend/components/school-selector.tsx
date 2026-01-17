"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface SchoolOption {
  value: string;
  label: string;
}

// Danh sách trường học
const SCHOOLS: SchoolOption[] = [
  { value: "Đại học Sư phạm Kỹ thuật TP.HCM", label: "Đại học Sư phạm Kỹ thuật TP.HCM (HCMUTE)" },
  { value: "Đại học Bách Khoa TP.HCM", label: "Đại học Bách Khoa TP.HCM" },
  { value: "Đại học Công nghệ Thông tin - ĐHQG", label: "Đại học Công nghệ Thông tin - ĐHQG TP.HCM" },
  { value: "Đại học Khoa học Tự nhiên - ĐHQG", label: "Đại học Khoa học Tự nhiên - ĐHQG TP.HCM" },
  { value: "Đại học Kinh tế TP.HCM", label: "Đại học Kinh tế TP.HCM (UEH)" },
  { value: "Đại học Ngoại thương", label: "Đại học Ngoại thương (Cơ sở 2)" },
  { value: "Đại học FPT", label: "Đại học FPT TP.HCM" },
  { value: "Đại học RMIT", label: "Đại học RMIT Việt Nam" },
  { value: "Đại học Tôn Đức Thắng", label: "Đại học Tôn Đức Thắng" },
  { value: "Đại học Văn Lang", label: "Đại học Văn Lang" },
  { value: "Đại học Hoa Sen", label: "Đại học Hoa Sen" },
  { value: "Đại học Hutech", label: "Đại học Công nghệ TP.HCM (HUTECH)" },
  { value: "Đại học Nguyễn Tất Thành", label: "Đại học Nguyễn Tất Thành" },
  { value: "Trường THPT Chuyên Lê Hồng Phong", label: "Trường THPT Chuyên Lê Hồng Phong" },
  { value: "Trường THPT Chuyên Trần Đại Nghĩa", label: "Trường THPT Chuyên Trần Đại Nghĩa" },
  { value: "Trường THPT Nguyễn Thị Minh Khai", label: "Trường THPT Nguyễn Thị Minh Khai" },
  { value: "Trường THPT Gia Định", label: "Trường THPT Gia Định" },
  { value: "Trường THPT Bùi Thị Xuân", label: "Trường THPT Bùi Thị Xuân" },
  { value: "Khác", label: "Khác" },
];

interface SchoolSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SchoolSelector({
  value,
  onValueChange,
  placeholder = "Chọn trường học...",
  className,
}: SchoolSelectorProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  
  const filteredSchools = React.useMemo(() => {
    if (!searchQuery.trim()) return SCHOOLS;
    const query = searchQuery.toLowerCase();
    return SCHOOLS.filter(
      (school) =>
        school.label.toLowerCase().includes(query) ||
        school.value.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={cn("rounded-xl h-11", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {/* Search input inside dropdown */}
        <div className="px-2 py-2 sticky top-0 bg-popover border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 rounded-lg"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
        </div>
        
        <div className="max-h-60 overflow-auto">
          {filteredSchools.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Không tìm thấy trường học
            </div>
          ) : (
            filteredSchools.map((school) => (
              <SelectItem key={school.value} value={school.value}>
                {school.label}
              </SelectItem>
            ))
          )}
        </div>
      </SelectContent>
    </Select>
  );
}

export { SCHOOLS };
