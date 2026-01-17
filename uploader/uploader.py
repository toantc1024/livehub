"""
LiveHub Uploader - Desktop App

Main entry point for the uploader application.
"""

import threading
from pathlib import Path
from datetime import datetime
from typing import Optional

import customtkinter as ctk

from config import SUPPORTED_EXTENSIONS
from api_client import api
from oauth import oauth
from watcher import FolderWatcher, get_file_hash
from storage import storage


class UploaderApp(ctk.CTk):
    """Main application window."""
    
    def __init__(self):
        super().__init__()
        
        # Load saved settings
        self._load_settings()
        
        # Initialize watcher
        self.watcher = FolderWatcher(self._on_new_file)
        if self.watch_folder:
            self.watcher.set_folder(self.watch_folder)
            self.watcher.uploaded_hashes = storage.get_uploaded_hashes()
        
        # UI state
        self.auto_upload = ctk.BooleanVar(value=storage.get_auto_upload())
        self.enhance_enabled = ctk.BooleanVar(value=storage.get_enhance_enabled())
        
        # Stats
        self.stats = {"pending": 0, "uploading": 0, "success": 0, "error": 0}
        
        # Setup window
        self.title("LiveHub Uploader")
        self.geometry("600x700")
        self.resizable(True, True)
        
        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("blue")
        
        self._create_ui()
        self._check_auth()
        
        # Initialize file list if folder is already set
        if self.watch_folder:
            self.after(100, self._initialize_on_startup)
    
    def _load_settings(self):
        """Load saved settings."""
        self.watch_folder = storage.get_watch_folder()
        
        saved_token = storage.get_token()
        if saved_token:
            api.set_token(saved_token)
    
    def _initialize_on_startup(self):
        """Initialize file list on startup if folder is already set."""
        if self.watch_folder and Path(self.watch_folder).exists():
            self._log(f"Thư mục: {self.watch_folder}")
            self._scan_folder()
            self._update_file_list()
    
    def _create_ui(self):
        """Create the UI."""
        container = ctk.CTkFrame(self)
        container.pack(fill="both", expand=True, padx=20, pady=20)
        
        # Title
        ctk.CTkLabel(
            container, 
            text="LiveHub Uploader",
            font=ctk.CTkFont(size=24, weight="bold")
        ).pack(pady=(0, 20))
        
        # Auth section
        self.auth_frame = ctk.CTkFrame(container)
        self.auth_frame.pack(fill="x", pady=10)
        
        self.auth_label = ctk.CTkLabel(self.auth_frame, text="Chưa đăng nhập")
        self.auth_label.pack(side="left", padx=10)
        
        self.login_btn = ctk.CTkButton(
            self.auth_frame,
            text="Đăng nhập với Google",
            command=self._login
        )
        self.login_btn.pack(side="right", padx=10)
        
        # Folder selection
        folder_frame = ctk.CTkFrame(container)
        folder_frame.pack(fill="x", pady=10)
        
        ctk.CTkLabel(folder_frame, text="Thư mục:").pack(side="left", padx=10)
        
        self.folder_label = ctk.CTkLabel(
            folder_frame, 
            text=self.watch_folder or "Chưa chọn",
            text_color="gray"
        )
        self.folder_label.pack(side="left", padx=10, expand=True, fill="x")
        
        ctk.CTkButton(
            folder_frame, text="Chọn", width=80,
            command=self._select_folder
        ).pack(side="right", padx=10)
        
        # Options
        options_frame = ctk.CTkFrame(container)
        options_frame.pack(fill="x", pady=10)
        
        auto_switch = ctk.CTkSwitch(
            options_frame, text="Tự động upload",
            variable=self.auto_upload,
            command=lambda: storage.set_auto_upload(self.auto_upload.get())
        )
        auto_switch.pack(side="left", padx=10)
        
        enhance_switch = ctk.CTkSwitch(
            options_frame, text="Làm đẹp ảnh",
            variable=self.enhance_enabled,
            command=lambda: storage.set_enhance_enabled(self.enhance_enabled.get())
        )
        enhance_switch.pack(side="left", padx=10)
        
        # Control buttons
        control_frame = ctk.CTkFrame(container)
        control_frame.pack(fill="x", pady=10)
        
        self.watch_btn = ctk.CTkButton(
            control_frame, text="Bắt đầu theo dõi",
            command=self._toggle_watch
        )
        self.watch_btn.pack(side="left", padx=5, expand=True, fill="x")
        
        self.upload_btn = ctk.CTkButton(
            control_frame, text="Upload ngay",
            command=self._upload_pending
        )
        self.upload_btn.pack(side="left", padx=5, expand=True, fill="x")
        
        self.reset_btn = ctk.CTkButton(
            control_frame, text="Reset",
            fg_color="transparent",
            border_width=1,
            text_color=("gray10", "gray90"),
            command=self._reset_storage
        )
        self.reset_btn.pack(side="right", padx=5)
        
        # Status
        status_frame = ctk.CTkFrame(container)
        status_frame.pack(fill="x", pady=10)
        
        self.status_label = ctk.CTkLabel(
            status_frame, text="Trạng thái: Sẵn sàng",
            font=ctk.CTkFont(size=14)
        )
        self.status_label.pack(pady=10)
        
        # Stats
        stats_frame = ctk.CTkFrame(container)
        stats_frame.pack(fill="x", pady=10)
        
        self.stats_labels = {}
        for stat, label in [("pending", "Chờ"), ("success", "Thành công"), ("error", "Lỗi")]:
            frame = ctk.CTkFrame(stats_frame, fg_color="transparent")
            frame.pack(side="left", expand=True, fill="x", padx=5)
            ctk.CTkLabel(frame, text=label, text_color="gray").pack()
            self.stats_labels[stat] = ctk.CTkLabel(
                frame, text="0", font=ctk.CTkFont(size=20, weight="bold")
            )
            self.stats_labels[stat].pack()
        
        # Content Tabs
        self.tab_view = ctk.CTkTabview(container)
        self.tab_view.pack(fill="both", expand=True, pady=10)
        
        # Tabs
        self.tab_log = self.tab_view.add("Nhật ký")
        self.tab_files = self.tab_view.add("Danh sách file")
        
        # Log content
        self.log_text = ctk.CTkTextbox(self.tab_log)
        self.log_text.pack(fill="both", expand=True, padx=5, pady=5)
        
        # Files content
        self.files_frame = ctk.CTkScrollableFrame(self.tab_files)
        self.files_frame.pack(fill="both", expand=True, padx=5, pady=5)
        
        self.file_rows = {}  # path -> (frame, status_label)

    def _log(self, message: str):
        """Add message to log."""
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.log_text.insert("end", f"[{timestamp}] {message}\n")
        self.log_text.see("end")
    
    def _update_file_list(self):
        """Update file list UI."""
        if not self.watch_folder:
            return
            
        # Clear existing
        for child in self.files_frame.winfo_children():
            child.destroy()
        self.file_rows.clear()
        
        files = self.watcher.scan_folder()
        # Also include already uploaded ones that are in the folder?
        # scan_folder only returns NON-uploaded files unless we change it.
        # But for "Show list of images in the folder", we want ALL images.
        
        # Let's manually scan folder for all images
        all_files = []
        try:
            for f in Path(self.watch_folder).rglob("*"):
                 if f.suffix.lower() in SUPPORTED_EXTENSIONS:
                     all_files.append(str(f))
        except:
            pass
            
        # Sort by name
        all_files.sort()
        
        for f in all_files:
            self._add_file_row(f)

    def _add_file_row(self, file_path: str):
        # Skip if file doesn't exist
        if not Path(file_path).exists():
            return
        
        row = ctk.CTkFrame(self.files_frame)
        row.pack(fill="x", pady=2)
        
        name = Path(file_path).name
        
        # Status - with error handling
        try:
            file_hash = get_file_hash(file_path)
            is_uploaded = file_hash in storage.get_uploaded_hashes()
        except Exception:
            is_uploaded = False
        
        status_text = "Đã upload" if is_uploaded else "Chờ upload"
        status_color = "green" if is_uploaded else "orange"
        
        ctk.CTkLabel(row, text=name, anchor="w").pack(side="left", padx=10, fill="x", expand=True)
        lbl = ctk.CTkLabel(row, text=status_text, text_color=status_color, width=100)
        lbl.pack(side="right", padx=10)
        
        self.file_rows[file_path] = (row, lbl)
    
    def _update_file_status(self, file_path: str, status: str, color: str):
        if file_path in self.file_rows:
            _, lbl = self.file_rows[file_path]
            lbl.configure(text=status, text_color=color)
        elif self.watch_folder and str(Path(self.watch_folder)) in str(Path(file_path)):
             # New file appeared
             self._add_file_row(file_path)
             if file_path in self.file_rows:
                _, lbl = self.file_rows[file_path]
                lbl.configure(text=status, text_color=color)

    def _update_stats(self):
        """Update stats display."""
        for key, label in self.stats_labels.items():
            label.configure(text=str(self.stats.get(key, 0)))
    
    def _check_auth(self):
        """Check authentication status."""
        if api.is_admin():
            user = api.get_user_info()
            if user:
                name = user.get("name") or user.get("email")
                self.auth_label.configure(text=f"✓ {name}")
                self.login_btn.configure(text="Đăng xuất", command=self._logout)
                return True
        
        api.clear_token()
        storage.clear_token()
        self.auth_label.configure(text="Chưa đăng nhập")
        self.login_btn.configure(text="Đăng nhập với Google", command=self._login)
        return False
    
    def _login(self):
        """Start OAuth login."""
        self._log("Đang mở trình duyệt...")
        self.login_btn.configure(state="disabled", text="Đang chờ...")
        
        login_url = api.get_login_url()
        if not login_url:
            self._log("Lỗi: Không thể kết nối server")
            self.login_btn.configure(state="normal", text="Đăng nhập với Google")
            return
        
        def on_success(token):
            api.set_token(token)
            if self._check_auth():
                storage.set_token(token)
                self.after(0, lambda: self._log("Đăng nhập thành công!"))
            else:
                self.after(0, lambda: self._log("Lỗi: Không phải Admin"))
            self.after(0, lambda: self.login_btn.configure(state="normal"))
        
        def on_error(msg):
            self.after(0, lambda: self._log(msg))
            self.after(0, lambda: self.login_btn.configure(
                state="normal", text="Đăng nhập với Google"
            ))
        
        oauth.login(login_url, on_success, on_error)
    
    def _logout(self):
        """Logout."""
        api.clear_token()
        storage.clear_token()
        self._check_auth()
        self._log("Đã đăng xuất")
    
    def _reset_storage(self):
        """Reset upload tracking storage."""
        from tkinter import messagebox
        
        if not messagebox.askyesno(
            "Xác nhận Reset",
            "Bạn có chắc muốn xóa lịch sử upload?\n\nĐiều này sẽ đánh dấu tất cả ảnh là chưa upload."
        ):
            return
        
        # Clear uploaded hashes
        storage.set("uploaded_hashes", [])
        self.watcher.uploaded_hashes.clear()
        
        # Reset stats
        self.stats = {"pending": 0, "uploading": 0, "success": 0, "error": 0}
        self._update_stats()
        
        # Rescan folder
        if self.watch_folder:
            self._scan_folder()
        
        self._log("Đã reset lịch sử upload")
    
    def _select_folder(self):
        """Select folder to watch."""
        from tkinter import filedialog
        folder = filedialog.askdirectory()
        if folder:
            self.watch_folder = folder
            self.folder_label.configure(text=folder)
            storage.set_watch_folder(folder)
            self.watcher.set_folder(folder)
            self._log(f"Đã chọn: {folder}")
            self._scan_folder()
            self._update_file_list()
    
    def _scan_folder(self):
        """Scan folder for existing images."""
        if not self.watch_folder:
            return
        
        self._log("Đang quét thư mục...")
        files = self.watcher.scan_folder()
        
        self.stats["pending"] = len(files)
        self._update_stats()
        self._log(f"Tìm thấy {len(files)} ảnh mới")
        self._update_file_list()
    
    def _on_new_file(self, file_path: str):
        """Handle new file detected."""
        # Run UI updates on main thread
        def update_ui():
            filename = Path(file_path).name
            self._log(f"Phát hiện: {filename}")
            
            self.stats["pending"] = self.stats.get("pending", 0) + 1
            self._update_stats()
            
            # Add file to list if not already there
            if file_path not in self.file_rows:
                self._add_file_row(file_path)
            
            self._update_file_status(file_path, "Chờ upload", "orange")
            
            if self.auto_upload.get():
                self._upload_file(file_path)
        
        # Schedule on main thread since watchdog runs in background thread
        self.after(0, update_ui)
    
    def _toggle_watch(self):
        """Toggle folder watching."""
        if self.watcher.is_watching:
            self.watcher.stop()
            self.watch_btn.configure(text="Bắt đầu theo dõi")
            self.status_label.configure(text="Trạng thái: Sẵn sàng")
            self._log("Dừng theo dõi")
        else:
            if not self.watch_folder:
                self._log("Vui lòng chọn thư mục")
                return
            if not api.token:
                self._log("Vui lòng đăng nhập")
                return
            
            self.watcher.start()
            self.watch_btn.configure(text="Dừng theo dõi")
            self.status_label.configure(text="Trạng thái: Đang theo dõi...")
            self._log("Bắt đầu theo dõi")
            self._update_file_list()
    
    def _upload_file(self, file_path: str):
        """Upload single file."""
        if not api.token:
            return
        
        filename = Path(file_path).name
        self._log(f"Uploading: {filename}")
        self._update_file_status(file_path, "Đang xử lý...", "blue")
        
        try:
            # Image optimization is now handled internally by api.upload_image
            result = api.upload_image(file_path)
            
            if result and result.get("id"):
                self.watcher.mark_uploaded(file_path)
                file_hash = get_file_hash(file_path)
                storage.add_uploaded_hash(file_hash)
                
                # Log optimization info if available
                metadata = result.get("_upload_metadata", {})
                if metadata:
                    compression = metadata.get("compression_ratio", 0)
                    quality = metadata.get("quality", 0)
                    size_mb = metadata.get("optimized_file_size", 0) / 1024 / 1024
                    self._log(f"  → Q{quality}% | {size_mb:.1f}MB | {compression:.1f}x nén")
                
                self.stats["pending"] = max(0, self.stats.get("pending", 1) - 1)
                self.stats["success"] = self.stats.get("success", 0) + 1
                self._log(f"  ✓ {filename}")
                self._update_file_status(file_path, "Thành công", "green")
            else:
                self.stats["pending"] = max(0, self.stats.get("pending", 1) - 1)
                self.stats["error"] = self.stats.get("error", 0) + 1
                self._log(f"  ✗ {filename}")
                self._update_file_status(file_path, "Lỗi", "red")
        except Exception as e:
            self.stats["error"] = self.stats.get("error", 0) + 1
            self._log(f"  ✗ Lỗi: {e}")
            self._update_file_status(file_path, "Lỗi", "red")
        
        self._update_stats()
    
    def _upload_pending(self):
        """Upload all pending files."""
        if not api.token:
            self._log("Vui lòng đăng nhập")
            return
        
        files = self.watcher.scan_folder()
        if not files:
            self._log("Không có ảnh mới")
            return
        
        self._log(f"Upload {len(files)} ảnh...")
        
        def upload_thread():
            for f in files:
                if Path(f).exists():
                    self._upload_file(f)
        
        threading.Thread(target=upload_thread, daemon=True).start()
    
    def on_closing(self):
        """Handle window close."""
        self.watcher.stop()
        oauth.stop_callback_server()
        self.destroy()


def main():
    print(f"Starting LiveHub Uploader...")
    print(f"API URL: {api.api_url}")
    app = UploaderApp()
    app.protocol("WM_DELETE_WINDOW", app.on_closing)
    app.mainloop()


if __name__ == "__main__":
    main()
