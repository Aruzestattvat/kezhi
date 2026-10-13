# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['../internal-release-source/server.py'],
    pathex=[],
    binaries=[],
    datas=[('work/internal-release-source/index.html', '.'), ('work/internal-release-source/app.js', '.'), ('work/internal-release-source/parser.js', '.'), ('work/internal-release-source/styles.css', '.')],
    hiddenimports=[],
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
    name='课值内测版',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
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
    name='课值内测版',
)
