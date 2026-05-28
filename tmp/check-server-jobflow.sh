#!/bin/bash
# Run this from YOUR laptop to check server-side jobflow state.
# Output → paste back to Claude.

echo "━━━ SERVER jobflow check ━━━"
ssh -o ConnectTimeout=10 root@72.60.196.21 'bash -s' << 'REMOTE'
  echo
  for d in /root/projects/jobflow /root/projects/jobflow_ai /root/projects/jobflow.ai /opt/jobflow /var/www/jobflow; do
    if [ -d "$d" ]; then
      echo "━━━ Found: $d ━━━"
      cd "$d" || continue
      echo "Latest commit:"
      git log -1 --format="  %h | %ad | %s" --date=iso 2>/dev/null || echo "  (not git repo)"
      echo
      echo "Modified/untracked files (top 10):"
      git status -sb 2>/dev/null | head -12
      echo
      echo "Top-level last-modified files:"
      ls -lt 2>/dev/null | head -6 | awk '{print "  ",$6,$7,$8,$9}'
    fi
  done

  echo
  echo "━━━ Docker containers ━━━"
  docker ps --format '  {{.Names}} | {{.Status}} | {{.Image}}' 2>/dev/null | grep -iE 'jobflow|career'

  echo
  echo "━━━ Nginx sites ━━━"
  ls -la /etc/nginx/sites-enabled/ 2>/dev/null | grep -iE 'jobflow|career'

  echo
  echo "━━━ Live URL test ━━━"
  curl -sI --max-time 5 https://jobflow.aureonforge.com/ 2>&1 | head -3
REMOTE
