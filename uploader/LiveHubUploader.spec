# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec file for LiveHub Uploader

This is the detailed configuration for building the executable.
You can customize build options here.

Usage: pyinstaller LiveHubUploader.spec
"""

import sys
from pathlib import Path

# Get customtkinter path for including assets
import customtkinter
ctk_path = Path(customtkinter.__file__).parent

a = Analysis(
    ['uploader.py'],
    pathex=[],
    binaries=[],
    datas=[
        # Include all customtkinter themes and assets
        (str(ctk_path), 'customtkinter'),
    ],
    hiddenimports=[
        'customtkinter',
        'PIL',
        'PIL._tkinter_finder',
        'PIL.Image',
        'PIL.ImageEnhance',
        'PIL.ImageFilter',
        'watchdog',
        'watchdog.observers',
        'watchdog.observers.polling',
        'watchdog.events',
        'requests',
        'urllib3',
        'charset_normalizer',
        'certifi',
        'google.auth',
        'google.auth.transport',
        'google.auth.transport.requests',
        'google_auth_oauthlib',
        'google_auth_oauthlib.flow',
        'tkinter',
        'tkinter.filedialog',
        'tkinter.messagebox',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'matplotlib',
        'numpy',
        'pandas',
        'scipy',
        'PyQt5',
        'PyQt6',
        'PySide2',
        'PySide6',
        'wx',
    ],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='LiveHubUploader',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,              # Use UPX compression if available
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,         # No console window (GUI app)
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    # Uncomment and add icon path if you have one
    # icon='icon.ico',
)
