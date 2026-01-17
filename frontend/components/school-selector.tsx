"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, School, MapPin, Check, X, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SchoolOption {
  name: string;
  province: string;
}

// Danh sách trường học đầy đủ
const SCHOOLS: SchoolOption[] = [
  { name: "THPT MAI THANH THẾ", province: "TP. CẦN THƠ" },
  { name: "THPT TRẤN BIÊN", province: "TỈNH ĐỒNG NAI" },
  { name: "THPT NGUYỄN TRÃI", province: "TỈNH ĐỒNG NAI" },
  { name: "THPT LÊ QUÝ ĐÔN", province: "TỈNH ĐỒNG NAI" },
  { name: "THPT TRỊ AN", province: "TỈNH ĐỒNG NAI" },
  { name: "THPT TAM HIỆP", province: "TỈNH ĐỒNG NAI" },
  { name: "THPT HÙNG VƯƠNG", province: "TỈNH ĐỒNG NAI" },
  { name: "THPT CHUYÊN BÌNH LONG", province: "TỈNH ĐỒNG NAI" },
  { name: "THPT NGÔ QUYỀN", province: "TỈNH ĐỒNG NAI" },
  { name: "THPT XUÂN LỘC", province: "TỈNH ĐỒNG NAI" },
  { name: "THPT CHUYÊN LƯƠNG THẾ VINH", province: "TỈNH ĐỒNG NAI" },
  { name: "THPT BÌNH LONG", province: "TỈNH ĐỒNG NAI" },
  { name: "THCS & THPT LƯƠNG THẾ VINH", province: "TỈNH ĐỒNG NAI" },
  { name: "THPT TÔN ĐỨC THẮNG", province: "TỈNH ĐỒNG NAI" },
  { name: "THPT NAM HÀ", province: "TỈNH ĐỒNG NAI" },
  { name: "THPT TÂN PHÚ", province: "TỈNH ĐỒNG NAI" },
  { name: "THPT ĐIỂU CẢI", province: "TỈNH ĐỒNG NAI" },
  { name: "THPT PHƯỚC THIỀN", province: "TỈNH ĐỒNG NAI" },
  { name: "THPT SÔNG RAY", province: "TỈNH ĐỒNG NAI" },
  { name: "TH-THCS-THPT TRẦN ĐẠI NGHĨA", province: "TỈNH ĐỒNG NAI" },
  { name: "THPT LONG THÀNH", province: "TỈNH ĐỒNG NAI" },
  { name: "THPT NGUYỄN HỮU CẢNH", province: "TỈNH ĐỒNG NAI" },
  { name: "THPT VÕ TOẢN", province: "TỈNH ĐỒNG NAI" },
  { name: "THPT THỐNG NHẤT A", province: "TỈNH ĐỒNG NAI" },
  { name: "THPT NGUYỄN HUỆ A", province: "TỈNH ĐỒNG NAI" },
  { name: "THPT CHƠN THÀNH", province: "TỈNH ĐỒNG NAI" },
  { name: "THPT BÌNH SƠN", province: "TỈNH ĐỒNG NAI" },
  { name: "THPT ĐỒNG PHÚ", province: "TỈNH ĐỒNG NAI" },
  { name: "THPT NHƠN TRẠCH", province: "TỈNH ĐỒNG NAI" },
  { name: "THPT TAM PHƯỚC", province: "TỈNH ĐỒNG NAI" },
  { name: "THPT LÊ QUÝ ĐÔN - LONG BÌNH TÂN", province: "TỈNH ĐỒNG NAI" },
  { name: "THPT CHUYÊN NGUYỄN ĐÌNH CHIỂU", province: "TỈNH ĐỒNG THÁP" },
  { name: "THPT TAM NÔNG", province: "TỈNH ĐỒNG THÁP" },
  { name: "THPT CAO LÃNH 2", province: "TỈNH ĐỒNG THÁP" },
  { name: "THPT NGUYỄN VĂN CÔN", province: "TỈNH ĐỒNG THÁP" },
  { name: "THPT GÒ CÔNG ĐÔNG", province: "TỈNH ĐỒNG THÁP" },
  { name: "THCS VÀ THPT GIỒNG THỊ ĐAM", province: "TỈNH ĐỒNG THÁP" },
  { name: "THPT BÌNH ĐÔNG", province: "TỈNH ĐỒNG THÁP" },
  { name: "THPT TÂN HỒNG", province: "TỈNH ĐỒNG THÁP" },
  { name: "THPT VĨNH BÌNH", province: "TỈNH ĐỒNG THÁP" },
  { name: "THPT LAI VUNG 2", province: "TỈNH ĐỒNG THÁP" },
  { name: "THPT CAO LÃNH 1", province: "TỈNH ĐỒNG THÁP" },
  { name: "THPT CHỢ GẠO", province: "TỈNH ĐỒNG THÁP" },
  { name: "THPT LAI VUNG 3", province: "TỈNH ĐỒNG THÁP" },
  { name: "THPT ĐỐC BINH KIỀU", province: "TỈNH ĐỒNG THÁP" },
  { name: "THPT NGUYỄN ĐÌNH CHIỂU", province: "TỈNH ĐỒNG THÁP" },
  { name: "THPT BÌNH PHỤC NHỨT", province: "TỈNH ĐỒNG THÁP" },
  { name: "THCS VÀ THPT PHÚ THÀNH A", province: "TỈNH ĐỒNG THÁP" },
  { name: "THPT NGUYỄN VĂN TIẾP", province: "TỈNH ĐỒNG THÁP" },
  { name: "THPT CAO LÃNH", province: "TỈNH ĐỒNG THÁP" },
  { name: "THPT THỦ KHOA HUÂN", province: "TỈNH ĐỒNG THÁP" },
  { name: "THPT TRẦN HƯNG ĐẠO", province: "TỈNH ĐỒNG THÁP" },
  { name: "THPT TRƯƠNG ĐỊNH", province: "TỈNH ĐỒNG THÁP" },
  { name: "THPT ĐỨC LINH", province: "TỈNH ĐỒNG THÁP" },
  { name: "THPT HÙNG VƯƠNG", province: "TỈNH LÂM ĐỒNG" },
  { name: "THPT BẮC BÌNH", province: "TỈNH LÂM ĐỒNG" },
  { name: "THPT TÁNH LINH", province: "TỈNH LÂM ĐỒNG" },
  { name: "THPT TRẦN PHÚ", province: "TỈNH LÂM ĐỒNG" },
  { name: "THPT LỘC THANH", province: "TỈNH LÂM ĐỒNG" },
  { name: "THPT QUANG TRUNG", province: "TỈNH LÂM ĐỒNG" },
  { name: "THPT ĐẠM RI", province: "TỈNH LÂM ĐỒNG" },
  { name: "THPT NGUYỄN VĂN TRỖI", province: "TỈNH LÂM ĐỒNG" },
  { name: "THPT LỘC THÀNH", province: "TỈNH LÂM ĐỒNG" },
  { name: "THPT CHUYÊN TRẦN HƯNG ĐẠO", province: "TỈNH LÂM ĐỒNG" },
  { name: "THPT PHAN BỘI CHÂU - PHAN THIẾT", province: "TỈNH LÂM ĐỒNG" },
  { name: "THPT KON TUM", province: "TỈNH QUẢNG NGÃI" },
  { name: "THCS&THPT LƯƠNG HÒA", province: "TỈNH TÂY NINH" },
  { name: "THPT THIÊN HỘ DƯƠNG", province: "TỈNH TÂY NINH" },
  { name: "THPT RẠCH KIẾN", province: "TỈNH TÂY NINH" },
  { name: "THPT CHUYÊN HOÀNG LÊ KHA", province: "TỈNH TÂY NINH" },
  { name: "THPT TÂN TRỤ", province: "TỈNH TÂY NINH" },
  { name: "THPT NGUYỄN TRÃI", province: "TỈNH TÂY NINH" },
  { name: "THPT LÊ QUÝ ĐÔN", province: "TỈNH TÂY NINH" },
  { name: "THPT TÂN CHÂU", province: "TỈNH TÂY NINH" },
  { name: "THPT PHAN LIÊM", province: "TỈNH VĨNH LONG" },
  { name: "THPT ĐOÀN THỊ ĐIỂM", province: "TỈNH VĨNH LONG" },
  { name: "THPT CHÊ GHÊ-VA-RA", province: "TỈNH VĨNH LONG" },
  { name: "THPT NGÔ VĂN CẤN", province: "TỈNH VĨNH LONG" },
  { name: "THPT NGUYỄN ĐÌNH CHIỂU", province: "TỈNH VĨNH LONG" },
  { name: "THPT PHAN THANH GIẢN", province: "TỈNH VĨNH LONG" },
  { name: "THPT DIỆP MINH CHÂU", province: "TỈNH VĨNH LONG" },
  { name: "THPT LẠC LONG QUÂN", province: "TỈNH VĨNH LONG" },
  { name: "THPT SƯƠNG NGUYỆT ANH", province: "TỈNH VĨNH LONG" },
  { name: "THPT NGUYỄN TRÃI", province: "TỈNH VĨNH LONG" },
  { name: "THPT NGUYỄN NGỌC THĂNG", province: "TỈNH VĨNH LONG" },
  { name: "THPT LÊ QUÍ ĐÔN", province: "TỈNH VĨNH LONG" },
  { name: "THPT NGUYỄN HUỆ", province: "TP. HỒ CHÍ MINH" },
  { name: "THPT TRẦN VĂN QUAN", province: "TP. HỒ CHÍ MINH" },
  { name: "THPT LONG HẢI - PHƯỚC TỈNH", province: "TP. HỒ CHÍ MINH" },
  { name: "THPT BẾN CÁT", province: "TP. HỒ CHÍ MINH" },
  { name: "THPT MINH ĐẠM", province: "TP. HỒ CHÍ MINH" },
  { name: "THPT VÕ THỊ SÁU", province: "TP. HỒ CHÍ MINH" },
  { name: "THPT VŨNG TÀU", province: "TP. HỒ CHÍ MINH" },
  { name: "THPT HÒA BÌNH", province: "TP. HỒ CHÍ MINH" },
  { name: "THPT PHÚ MỸ", province: "TP. HỒ CHÍ MINH" },
  { name: "THPT TRẦN HƯNG ĐẠO", province: "TP. HỒ CHÍ MINH" },
  { name: "THPT XUYÊN MỘC", province: "TP. HỒ CHÍ MINH" },
  { name: "THPT CHÂU THÀNH", province: "TP. HỒ CHÍ MINH" },
  { name: "THPT NGÔ QUYỀN", province: "TP. HỒ CHÍ MINH" },
  { name: "THPT NGUYỄN THỊ MINH KHAI", province: "TP. HỒ CHÍ MINH" },
  { name: "THPT CHUYÊN HÙNG VƯƠNG", province: "TP. HỒ CHÍ MINH" },
  { name: "THPT NGUYỄN AN NINH", province: "TP. HỒ CHÍ MINH" },
  { name: "THPT VÕ MINH ĐỨC", province: "TP. HỒ CHÍ MINH" },
  { name: "THPT BÀU BÀNG", province: "TP. HỒ CHÍ MINH" },
  { name: "THPT TRỊNH HOÀI ĐỨC", province: "TP. HỒ CHÍ MINH" },
  { name: "THPT DƯƠNG VĂN THÌ", province: "TP. HỒ CHÍ MINH" },
  { name: "THPT GIỒNG ÔNG TỐ", province: "TP. HỒ CHÍ MINH" },
  { name: "THPT AN DƯƠNG VƯƠNG", province: "TP. HỒ CHÍ MINH" },
  { name: "THPT PHƯỚC LONG", province: "TP. HỒ CHÍ MINH" },
  { name: "TTGDTX VŨNG TÀU", province: "TP. HỒ CHÍ MINH" },
  { name: "TTGDTX THUẬN AN", province: "TP. HỒ CHÍ MINH" },
  { name: "TTGDTX QUẬN 12", province: "TP. HỒ CHÍ MINH" },
  { name: "THPT TRƯƠNG VĨNH KÝ", province: "TP. HỒ CHÍ MINH" },
  { name: "THPT CẦN THẠNH", province: "TP. HỒ CHÍ MINH" },
  { name: "TTGDTX QUẬN 8", province: "TP. HỒ CHÍ MINH" },
  { name: "TTGDTX GÒ VẤP", province: "TP. HỒ CHÍ MINH" },
  { name: "TTGDTX THỦ ĐỨC (CƠ SỞ CHÍNH)", province: "TP. HỒ CHÍ MINH" },
  { name: "TTGDTX THỦ ĐỨC (CƠ SỞ 1)", province: "TP. HỒ CHÍ MINH" },
  { name: "TTGDTX THỦ ĐỨC (CƠ SỞ 2)", province: "TP. HỒ CHÍ MINH" },
  { name: "THPT PHẠM PHÚ THỨ", province: "TP. HỒ CHÍ MINH" },
  { name: "TTGDTX HÓC MÔN", province: "TP. HỒ CHÍ MINH" },
  { name: "THPT MẠC ĐỈNH CHI", province: "TP. HỒ CHÍ MINH" },
  { name: "THPT LƯƠNG VĂN CAN", province: "TP. HỒ CHÍ MINH" },
  { name: "THPT VÕ TRƯỜNG TOẢN", province: "TP. HỒ CHÍ MINH" },
  { name: "THPT VĨNH KIM", province: "TỈNH ĐỒNG THÁP" },
  { name: "THPT THỦ ĐỨC", province: "TP. HỒ CHÍ MINH" },
  { name: "THPT LÝ THƯỜNG KIỆT", province: "TP. HỒ CHÍ MINH" },
  { name: "THPT BÌNH HƯNG HÒA", province: "TP. HỒ CHÍ MINH" },
  { name: "THPT PHẠM VĂN SÁNG", province: "TP. HỒ CHÍ MINH" },
  { name: "THPT NGUYỄN HỮU HUÂN", province: "TP. HỒ CHÍ MINH" },
  { name: "THPT TRẦN KHAI NGUYÊN", province: "TP. HỒ CHÍ MINH" },
  { name: "THPT NGUYỄN THÁI BÌNH", province: "TP. HỒ CHÍ MINH" },
  { name: "THPT TRẦN PHÚ", province: "TP. HỒ CHÍ MINH" },
  { name: "THPT HIỆP BÌNH", province: "TP. HỒ CHÍ MINH" },
  { name: "THPT TÂY THẠNH", province: "TP. HỒ CHÍ MINH" },
  { name: "THPT TAM PHÚ", province: "TP. HỒ CHÍ MINH" },
  { name: "THPT BÌNH CHIỂU", province: "TP. HỒ CHÍ MINH" },
  { name: "THPT BÀ ĐIỂM", province: "TP. HỒ CHÍ MINH" },
  { name: "THPT BÌNH KHÁNH", province: "TP. HỒ CHÍ MINH" },
  { name: "THPT TRUNG LẬP", province: "TP. HỒ CHÍ MINH" },
  // Thêm trường "Khác" cho các trường không có trong danh sách
  { name: "Khác", province: "KHÁC" },
];

// Lấy danh sách provinces unique
const PROVINCES = Array.from(new Set(SCHOOLS.map(s => s.province))).sort((a, b) => {
  // Ưu tiên "TP. HỒ CHÍ MINH" lên đầu
  if (a === "TP. HỒ CHÍ MINH") return -1;
  if (b === "TP. HỒ CHÍ MINH") return 1;
  if (a === "KHÁC") return 1;
  if (b === "KHÁC") return -1;
  return a.localeCompare(b, 'vi');
});

interface SchoolSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SchoolSelector({
  value,
  onValueChange,
  placeholder = "Tìm và chọn trường học...",
  className,
}: SchoolSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedProvince, setSelectedProvince] = React.useState<string | null>(null);
  
  // Get display label for current value
  const selectedSchool = React.useMemo(() => {
    return SCHOOLS.find(s => s.name === value);
  }, [value]);
  
  // Filter schools based on search and province
  const filteredSchools = React.useMemo(() => {
    let filtered = SCHOOLS;
    
    // Filter by province
    if (selectedProvince) {
      filtered = filtered.filter(s => s.province === selectedProvince);
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s => 
        s.name.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [searchQuery, selectedProvince]);

  const handleSelect = (schoolName: string) => {
    onValueChange(schoolName);
    setOpen(false);
    setSearchQuery("");
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedProvince(null);
  };

  return (
    <>
      {/* Trigger Button */}
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className={cn(
          "w-full justify-between rounded-xl h-11 font-normal",
          !value && "text-muted-foreground",
          className
        )}
        onClick={() => setOpen(true)}
      >
        <span className="truncate">
          {selectedSchool ? selectedSchool.name : placeholder}
        </span>
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>

      {/* Full Screen Modal Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-full h-full max-w-full max-h-full sm:max-w-lg sm:max-h-[85vh] sm:h-auto flex flex-col p-0 gap-0 rounded-none sm:rounded-3xl">
          {/* Header - Fixed */}
          <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <School className="h-5 w-5 text-primary" />
              Chọn trường học
            </DialogTitle>
          </DialogHeader>

          {/* Search & Filters - Fixed */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 space-y-3 border-b bg-muted/30 flex-shrink-0">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm theo tên trường..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 rounded-xl text-base"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-full"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>

            {/* Province Filter - Horizontal Scroll */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  Khu vực
                </span>
                {selectedProvince && (
                  <button
                    onClick={() => setSelectedProvince(null)}
                    className="text-xs text-primary hover:underline"
                  >
                    Bỏ lọc
                  </button>
                )}
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:-mx-6 sm:px-6 scrollbar-none">
                {PROVINCES.map((province) => (
                  <Badge
                    key={province}
                    variant={selectedProvince === province ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer transition-all text-xs py-1.5 px-3 whitespace-nowrap flex-shrink-0",
                      selectedProvince === province 
                        ? "bg-primary text-primary-foreground" 
                        : "hover:bg-muted"
                    )}
                    onClick={() => setSelectedProvince(
                      selectedProvince === province ? null : province
                    )}
                  >
                    {province.replace("TỈNH ", "").replace("TP. ", "")}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* School List - Scrollable */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <div className="px-2 sm:px-4 py-2">
              {filteredSchools.length === 0 ? (
                <div className="py-12 text-center">
                  <School className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">Không tìm thấy trường học</p>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={clearFilters}
                    className="mt-2"
                  >
                    Xóa bộ lọc
                  </Button>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredSchools.map((school, index) => (
                    <button
                      key={`${school.name}-${school.province}-${index}`}
                      onClick={() => handleSelect(school.name)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 sm:px-4 py-3 rounded-xl text-left transition-colors active:bg-muted/80",
                        value === school.name 
                          ? "bg-primary/10 text-primary" 
                          : "hover:bg-muted"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "font-medium text-sm sm:text-base",
                          value === school.name && "text-primary"
                        )}>
                          {school.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {school.province}
                        </p>
                      </div>
                      {value === school.name && (
                        <Check className="h-5 w-5 text-primary shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer - Fixed */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-t bg-background flex-shrink-0 sm:rounded-b-3xl">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {filteredSchools.length} trường
              </span>
              <Button
                className="rounded-full px-6"
                onClick={() => setOpen(false)}
              >
                Xong
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Custom scrollbar hide for horizontal scroll */}
      <style jsx global>{`
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-none {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </>
  );
}

export { SCHOOLS };
