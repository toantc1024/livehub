"""
LiveHub Uploader - Build EXE Script

This script builds the uploader into a standalone Windows executable.
Run: python build_exe.py
"""

import subprocess
import sys
import os
from pathlib import Path

def install_pyinstaller():
    """Install PyInstaller if not present."""
    try:
        import PyInstaller
        print("✓ PyInstaller đã được cài đặt")
    except ImportError:
        print("Đang cài đặt PyInstaller...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])
        print("✓ Đã cài đặt PyInstaller")

def build():
    """Build the executable."""
    print("\n" + "=" * 50)
    print("LiveHub Uploader - Build EXE")
    print("=" * 50 + "\n")
    
    # Install PyInstaller
    install_pyinstaller()
    
    # Get the directory of this script
    script_dir = Path(__file__).parent.resolve()
    os.chdir(script_dir)
    
    print(f"Working directory: {script_dir}")
    
    # PyInstaller command
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--name=LiveHubUploader",
        "--onefile",                    # Single exe file
        "--windowed",                   # No console window
        "--clean",                      # Clean cache before build
        "--noconfirm",                  # Overwrite without asking
        # Hidden imports for customtkinter
        "--hidden-import=customtkinter",
        "--hidden-import=PIL",
        "--hidden-import=PIL._tkinter_finder",
        "--hidden-import=watchdog",
        "--hidden-import=watchdog.observers",
        "--hidden-import=watchdog.events",
        "--hidden-import=requests",
        "--hidden-import=google.auth",
        "--hidden-import=google_auth_oauthlib",
        # Collect all customtkinter data files
        "--collect-all=customtkinter",
        # Add data files
        f"--add-data={script_dir / 'config.py'};.",
        f"--add-data={script_dir / 'api_client.py'};.",
        f"--add-data={script_dir / 'oauth.py'};.",
        f"--add-data={script_dir / 'watcher.py'};.",
        f"--add-data={script_dir / 'image_processor.py'};.",
        f"--add-data={script_dir / 'storage.py'};.",
        # Icon (optional - uncomment if you have an icon)
        # "--icon=icon.ico",
        # Main script
        "uploader.py"
    ]
    
    print("\n📦 Bắt đầu build...")
    print(f"Command: {' '.join(cmd)}\n")
    
    try:
        subprocess.check_call(cmd)
        
        exe_path = script_dir / "dist" / "LiveHubUploader.exe"
        
        if exe_path.exists():
            print("\n" + "=" * 50)
            print("✅ BUILD THÀNH CÔNG!")
            print("=" * 50)
            print(f"\n📁 File exe: {exe_path}")
            print(f"📊 Kích thước: {exe_path.stat().st_size / (1024*1024):.2f} MB")
            print("\n💡 Bạn có thể chạy file exe này trên bất kỳ máy Windows nào!")
        else:
            print("❌ Không tìm thấy file exe sau khi build")
            
    except subprocess.CalledProcessError as e:
        print(f"\n❌ Build thất bại: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(build())
