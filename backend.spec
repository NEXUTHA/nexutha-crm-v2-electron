# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['backend/app.py'],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

# onedir 構成:
#   onefile は起動のたびに全体を一時フォルダへ再展開していた（約19秒の主因）。
#   onedir にすると EXE と依存(_internal/*.so, *.dylib 等)が展開済みで同梱され、
#   2回目以降はほぼ即起動になる。
#   ※ upx=False: UPXで圧縮した .dylib/.so は macOS(arm64) で署名・公証・読み込みに
#     問題を起こすことがある。展開済みバイナリは electron-builder が個別に
#     Developer ID＋hardened runtime で署名するため、圧縮しないのが安全。
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
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
    upx=False,
    upx_exclude=[],
    name='backend',
)
