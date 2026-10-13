# -*- mode: python ; coding: utf-8 -*-

from pathlib import Path

root = Path(SPECPATH).parent / "internal-release-source"

a = Analysis(
    [str(root / "desktop.py")],
    pathex=[str(root)],
    binaries=[],
    datas=[
        (str(root / "index.html"), "."),
        (str(root / "app.js"), "."),
        (str(root / "parser.js"), "."),
        (str(root / "styles.css"), "."),
        (str(root / "app-logo.png"), "."),
        (str(root / "桌面版说明.md"), "."),
        (str(root / "使用说明.md"), "."),
        (str(root / "问题反馈模板.txt"), "."),
    ],
    hiddenimports=["tkinter"],
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
    [],
    exclude_binaries=True,
    name="课值",
    icon=str(root / "app-logo.ico"),
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="课值桌面版-v1.0.0-rc1-20260829",
)
