#!/usr/bin/env bash
# Isolated command mocks: never contacts Git remotes, Docker, or the live site.
set -Eeuo pipefail
SOURCE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)/redeploy.sh"
TEMP="$(mktemp -d)"
trap 'rm -rf -- "$TEMP"' EXIT
export MOCK_ROOT="$TEMP/repo" MOCK_LOG="$TEMP/commands.log"
mkdir -p "$MOCK_ROOT/scripts" "$MOCK_ROOT/.git" "$TEMP/bin"
touch "$MOCK_ROOT/.env.demo"
cat > "$TEMP/mock" <<'EOF'
#!/usr/bin/env bash
set -eu
name="${0##*/}"
case "$name" in
  uname) echo Linux ;;
  flock) [[ "${MOCK_LOCK_BUSY:-0}" != 1 ]] ;;
  curl) echo curl >> "$MOCK_LOG"; [[ "${MOCK_HTTPS_FAIL:-0}" != 1 ]] ;;
  git)
    echo "git $*" >> "$MOCK_LOG"
    case "$*" in
      "rev-parse --show-toplevel") echo "$MOCK_ROOT" ;;
      "rev-parse --git-common-dir") echo .git ;;
      "status --porcelain") [[ "${MOCK_DIRTY:-0}" != 1 ]] || echo " M local-change" ;;
      "symbolic-ref --quiet --short HEAD") [[ "${MOCK_DETACHED:-0}" != 1 ]] || exit 1; echo main ;;
      "rev-parse --abbrev-ref --symbolic-full-name @{upstream}") echo origin/main ;;
      "config --get branch.main.remote") echo origin ;;
      "rev-parse HEAD") echo commit123 ;;
      "fetch --no-tags origin") [[ "${MOCK_FETCH_FAIL:-0}" != 1 ]] ;;
      "merge-base --is-ancestor HEAD origin/main") [[ "${MOCK_DIVERGED:-0}" != 1 ]] ;;
      "merge --ff-only origin/main") ;;
      *) echo "Unexpected Git call: $*" >&2; exit 1 ;;
    esac ;;
  docker)
    if [[ "$1" == compose ]]; then
      shift
      while [[ $# -gt 0 ]]; do
        case "$1" in --project-directory|--env-file|-f) shift 2 ;; *) break ;; esac
      done
      echo "compose $*" >> "$MOCK_LOG"
      case "$1" in
        version|config) ;;
        ps) [[ "${MOCK_APP_STOPPED:-0}" != 1 ]] || exit 0; echo container123 ;;
        build) [[ "${MOCK_BUILD_FAIL:-0}" != 1 ]] ;;
        run)
          if [[ "$*" == *--input-type=module* && "${MOCK_BACKUP_FAIL:-0}" == 1 ]]; then exit 1; fi ;;
        stop) ;;
        up) [[ "${MOCK_START_FAIL:-0}" != 1 ]] ;;
        exec) echo https://preview.example ;;
        *) echo "Unexpected Compose call: $*" >&2; exit 1 ;;
      esac
    else
      echo "docker $*" >> "$MOCK_LOG"
      case "$1" in
        info) ;;
        inspect) echo sha256:previous ;;
        image) ;;
        *) echo "Unexpected Docker call: $*" >&2; exit 1 ;;
      esac
    fi ;;
  *) echo "Unexpected command: $name" >&2; exit 1 ;;
esac
EOF
for command in uname flock curl git docker; do
  cp "$TEMP/mock" "$TEMP/bin/$command"
  chmod +x "$TEMP/bin/$command"
done
export PATH="$TEMP/bin:$PATH"
run() {
  cp "$SOURCE" "$MOCK_ROOT/scripts/redeploy.sh"
  : > "$MOCK_LOG"
  if env "$@" bash "$MOCK_ROOT/scripts/redeploy.sh" --demo --yes > "$TEMP/output" 2>&1; then
    RESULT=0
  else
    RESULT=$?
  fi
}
contains() { grep -q -- "$1" "$2" || { cat "$TEMP/output"; echo "Missing: $1" >&2; exit 1; }; }
absent() { if grep -q -- "$1" "$2"; then echo "Unexpected: $1" >&2; exit 1; fi; }
fails() { [[ "$RESULT" != 0 ]] || { echo "Expected failure." >&2; exit 1; }; }
before() {
  local a b
  a="$(grep -n -m1 -- "$1" "$MOCK_LOG" | cut -d: -f1)"
  b="$(grep -n -m1 -- "$2" "$MOCK_LOG" | cut -d: -f1)"
  [[ "$a" -lt "$b" ]] || { echo "Wrong order: $1 / $2" >&2; exit 1; }
}

run
[[ "$RESULT" == 0 ]] || { cat "$TEMP/output"; exit 1; }
contains "Redeploy complete" "$TEMP/output"
before "git fetch" "git merge --ff-only"
before "git merge --ff-only" "compose build app"
before "docker image tag" "compose build app"
before "compose build app" "compose stop app"
before "caddy validate" "compose stop app"
before "compose stop app" "node --input-type=module"
before "node --input-type=module" "compose up"
before "compose up" "^curl"
contains "up -d --no-build --pull never --force-recreate --wait" "$MOCK_LOG"
absent "reset\|down\|prune\|--volumes" "$MOCK_LOG"
echo "PASS: successful demo deployment preserves data and orders build/backup/restart/checks."

for flag in MOCK_DIRTY MOCK_DETACHED MOCK_LOCK_BUSY MOCK_APP_STOPPED; do
  run "$flag=1"; fails
  absent "git fetch" "$MOCK_LOG"
  absent "compose stop" "$MOCK_LOG"
done
echo "PASS: preflight refuses dirty/detached/busy/uninitialized deployments."

for flag in MOCK_FETCH_FAIL MOCK_DIVERGED MOCK_BUILD_FAIL; do
  run "$flag=1"; fails
  absent "compose stop" "$MOCK_LOG"
  absent "compose up" "$MOCK_LOG"
done
echo "PASS: Git and build failures leave existing containers running."

run MOCK_BACKUP_FAIL=1; fails
contains "compose stop app" "$MOCK_LOG"
absent "compose up" "$MOCK_LOG"
contains "Previous image retained" "$TEMP/output"
echo "PASS: failed backups prevent migration/startup and print recovery context."

for flag in MOCK_START_FAIL MOCK_HTTPS_FAIL; do
  run "$flag=1"; fails
  absent "Redeploy complete" "$TEMP/output"
  contains "Do not blindly roll back" "$TEMP/output"
done
echo "PASS: startup/HTTPS failures never report success or automatically roll back."

if bash "$SOURCE" --demo --production > "$TEMP/output" 2>&1; then exit 1; fi
contains "exactly one deployment mode" "$TEMP/output"
if bash "$SOURCE" --env-file > "$TEMP/output" 2>&1; then exit 1; fi
contains "needs a path" "$TEMP/output"
echo "PASS: invalid options are rejected."

: > "$MOCK_LOG"
if bash "$MOCK_ROOT/scripts/redeploy.sh" --demo </dev/null > "$TEMP/output" 2>&1; then exit 1; fi
contains "interactive confirmation is required" "$TEMP/output"
absent "git fetch" "$MOCK_LOG"
echo "PASS: noninteractive use requires explicit --yes before network/deployment changes."
