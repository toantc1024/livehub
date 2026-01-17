# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_all

datas = [('D:\\LiveHub\\uploader\\config.py', '.'), ('D:\\LiveHub\\uploader\\api_client.py', '.'), ('D:\\LiveHub\\uploader\\oauth.py', '.'), ('D:\\LiveHub\\uploader\\watcher.py', '.'), ('D:\\LiveHub\\uploader\\image_processor.py', '.'), ('D:\\LiveHub\\uploader\\storage.py', '.')]
binaries = []
hiddenimports = ['customtkinter', 'PIL', 'PIL._tkinter_finder', 'watchdog', 'watchdog.observers', 'watchdog.events', 'requests', 'google.auth', 'google_auth_oauthlib']
tmp_ret = collect_all('customtkinter')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]


a = Analysis(
    ['uploader.py'],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
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
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
