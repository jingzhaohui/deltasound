#!/usr/bin/env python3
"""手动组装 Windows 便携版：只做创建/复制，不做删除或重命名（兼容受限沙箱）。
产物: dist-portable/DeltaSound/DeltaSound.exe 及同目录运行文件。
"""
import os
import shutil
import json

BASE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(BASE, 'vendor', 'electron-win')
DST = os.path.join(BASE, 'dist-portable', 'DeltaSound')
APP = os.path.join(DST, 'resources', 'app')


def copy_tree_renaming_exe():
    count = 0
    for root, _dirs, files in os.walk(SRC):
        rel = os.path.relpath(root, SRC)
        out = DST if rel == '.' else os.path.join(DST, rel)
        os.makedirs(out, exist_ok=True)
        for name in files:
            target = 'DeltaSound.exe' if name == 'electron.exe' and rel == '.' else name
            shutil.copy2(os.path.join(root, name), os.path.join(out, target))
            count += 1
    return count


def main():
    assert os.path.isfile(os.path.join(SRC, 'electron.exe')), '先解压 vendor/electron-win.zip'
    os.makedirs(os.path.join(APP, 'renderer'), exist_ok=True)
    os.makedirs(os.path.join(APP, 'build'), exist_ok=True)
    n = copy_tree_renaming_exe()

    for src, dst in [
        ('main.js', 'main.js'),
        ('preload.js', 'preload.js'),
        ('renderer/index.html', 'renderer/index.html'),
        ('build/icon.ico', 'build/icon.ico'),
        ('build/icon.png', 'build/icon.png'),
        ('build/default-config.txt', 'build/default-config.txt'),
    ]:
        shutil.copy2(os.path.join(BASE, src), os.path.join(APP, dst))

    with open(os.path.join(APP, 'package.json'), 'w', encoding='utf-8') as f:
        json.dump({
            'name': 'deltasound',
            'productName': 'DeltaSound',
            'version': '1.0.0',
            'description': 'Game audio EQ: suppress wind, lift footsteps, tame gunshots',
            'main': 'main.js',
            'author': 'DeltaSound',
            'license': 'MIT'
        }, f, ensure_ascii=False, indent=2)

    shutil.copy2(os.path.join(BASE, 'README.md'), os.path.join(DST, '安装说明.md'))
    size = sum(os.path.getsize(os.path.join(r, f))
               for r, _d, fs in os.walk(DST) for f in fs)
    print('files copied:', n)
    print('exe:', os.path.join(DST, 'DeltaSound.exe'),
          os.path.getsize(os.path.join(DST, 'DeltaSound.exe')))
    print('total: %.1f MB' % (size / 1048576))


if __name__ == '__main__':
    main()
