#!/bin/sh
cd -- "$(dirname -- "$0")" || exit 1
if ! command -v python3 >/dev/null 2>&1; then
  echo '请先安装 Python 3.10+：https://www.python.org/downloads/'
  exit 1
fi
python3 scripts/publish.py --repo hyyhf/imagination-atelier --login
status=$?
printf '\n按回车关闭窗口…'
read -r ignored
exit "$status"
