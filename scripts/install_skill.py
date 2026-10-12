#!/usr/bin/env python3
"""Copy this repository's skill to a supported local client; no network or grants."""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
from pathlib import Path
import shutil
import sys
import tempfile

NAME = 'imagination-developer'

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--client', choices=('codex', 'claude'), required=True)
    parser.add_argument('--project', type=Path, help='Existing project directory; otherwise use your home directory')
    parser.add_argument('--replace', action='store_true', help='Back up an existing skill before replacing it')
    parser.add_argument('--dry-run', action='store_true', help='Show the plan without writing anything')
    args = parser.parse_args()
    source = Path(__file__).resolve().parents[1] / 'skills' / NAME
    if not (source / 'SKILL.md').is_file():
        raise ValueError('The complete source skill was not found. Run this script from the unpacked release.')
    if any(path.is_symlink() for path in source.rglob('*')):
        raise ValueError('Source symlinks are not accepted; review the skill package first.')
    base = (args.project.expanduser() if args.project else Path.home()).resolve()
    if not base.is_dir():
        raise ValueError(f'Project/home directory does not exist: {base}')
    config = base / ('.agents' if args.client == 'codex' else '.claude')
    parent = config / 'skills'
    target = parent / NAME
    if config.is_symlink() or parent.is_symlink() or target.is_symlink():
        raise ValueError('Refusing to replace or install through a symlink. Use a reviewed manual copy instead.')
    print(f'Source: {source}\nTarget: {target}')
    if target.exists() and not args.replace:
        raise FileExistsError('Target already exists. Review it first; use --replace to keep a backup and replace.')
    if args.dry_run:
        print('Dry run: no files changed.')
        return 0
    parent.mkdir(parents=True, exist_ok=True)
    staging_root = Path(tempfile.mkdtemp(prefix='atelier-install-', dir=str(config)))
    backup = None
    try:
        staging = staging_root / NAME
        shutil.copytree(source, staging)
        if target.exists():
            backup_parent = config / 'imagination-atelier-backups'
            backup_parent.mkdir(parents=True, exist_ok=True)
            stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S.%fZ')
            backup = backup_parent / f'{NAME}-{stamp}'
            target.rename(backup)
        try:
            staging.rename(target)
        except Exception:
            if backup is not None and not target.exists():
                backup.rename(target)
            raise
    finally:
        shutil.rmtree(staging_root, ignore_errors=True)
    print(f'Installed: {target}')
    if backup: print(f'Previous version kept outside skill discovery: {backup}')
    print('This only copied local files. No network access, permission changes, or skill scripts were executed.')
    return 0

if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (OSError, ValueError) as exc:
        print(f'Installation stopped: {exc}', file=sys.stderr)
        raise SystemExit(1)
