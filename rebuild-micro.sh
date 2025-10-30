#!/bin/bash

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
cd "$SCRIPT_DIR"

TAG="${1:-latest}"
WEB_REPO="${WEB_REPO:-smartlib-web}"
WORKER_REPO="${WORKER_REPO:-smartlib-worker}"
ACR_LOGIN_SERVER="${ACR_LOGIN_SERVER:-}"
PUSH="${PUSH:-false}"
INSTALL_WEB_EXTRAS="${INSTALL_WEB_EXTRAS:-false}"

WEB_IMAGE_LOCAL="${WEB_REPO}:${TAG}"
WORKER_IMAGE_LOCAL="${WORKER_REPO}:${TAG}"

if [[ -n "$ACR_LOGIN_SERVER" ]]; then
  REMOTE_WEB_IMAGE="${ACR_LOGIN_SERVER}/${WEB_REPO}:${TAG}"
  REMOTE_WORKER_IMAGE="${ACR_LOGIN_SERVER}/${WORKER_REPO}:${TAG}"
else
  REMOTE_WEB_IMAGE=""
  REMOTE_WORKER_IMAGE=""
fi

cat <<EOF
╔══════════════════════════════════════════════════════════╗
║            Building SmartLib split Docker images         ║
╚══════════════════════════════════════════════════════════╝

Tag:            ${TAG}
Web image:      ${WEB_IMAGE_LOCAL}
Worker image:   ${WORKER_IMAGE_LOCAL}
ACR registry:   ${ACR_LOGIN_SERVER:-<not set>}
Push after build: ${PUSH}
EOF

if [[ "$INSTALL_WEB_EXTRAS" != "false" ]]; then
  echo "Installing optional web extras via requirements-web-extras.txt"
fi

echo
echo "🧹 Cleaning up dangling build cache (safe to ignore errors)..."
docker builder prune -f >/dev/null || true

echo
echo "🏗️  Building web image (${WEB_IMAGE_LOCAL})"
DOCKER_BUILDKIT=1 docker build \
  -f Dockerfile.web \
  --build-arg INSTALL_WEB_EXTRAS="${INSTALL_WEB_EXTRAS}" \
  -t "${WEB_IMAGE_LOCAL}" \
  .

echo
echo "🏗️  Building worker image (${WORKER_IMAGE_LOCAL})"
DOCKER_BUILDKIT=1 docker build \
  -f Dockerfile.worker \
  -t "${WORKER_IMAGE_LOCAL}" \
  .

echo
if [[ -n "$REMOTE_WEB_IMAGE" ]]; then
  echo "🔖 Tagging images for registry ${ACR_LOGIN_SERVER}"
  docker tag "${WEB_IMAGE_LOCAL}" "${REMOTE_WEB_IMAGE}"
  docker tag "${WORKER_IMAGE_LOCAL}" "${REMOTE_WORKER_IMAGE}"

  if [[ "$PUSH" == "true" ]]; then
    echo
    echo "🚀 Pushing ${REMOTE_WEB_IMAGE}"
    docker push "${REMOTE_WEB_IMAGE}"
    echo "🚀 Pushing ${REMOTE_WORKER_IMAGE}"
    docker push "${REMOTE_WORKER_IMAGE}"
  else
    cat <<EON

ℹ️  Push skipped. To push automatically, rerun with:
  PUSH=true ACR_LOGIN_SERVER=${ACR_LOGIN_SERVER} ./rebuild-micro.sh ${TAG}
EON
  fi
else
  echo "🔖 Skipping registry tagging because ACR_LOGIN_SERVER is not set."
fi

echo
cat <<'EOT'
✅ Build complete!

Next steps:
  • docker images | grep smartlib-
  • docker compose up --build       # local validation
  • az acr login --name <registry>
  • docker push <registry>/smartlib-web:${TAG}
  • docker push <registry>/smartlib-worker:${TAG}

Use the following parameters in ARM deployments:
  webDockerImageName:    smartlib-web:${TAG}
  workerDockerImageName: smartlib-worker:${TAG}
EOT
