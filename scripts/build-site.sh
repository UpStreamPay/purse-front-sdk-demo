#!/bin/sh
# Builds the deployed showcase into dist/: root landing + demos.json at /,
# each app under its own base. Same layout as GitHub Pages (deploy.yml), so
# `npx serve dist` previews it locally, cross-app demo links included.
set -e
cd "$(dirname "$0")/.."

VITE_BASE_URL=/vanilla/ npm run build -w vanilla
VITE_BASE_URL=/react/ npm run build -w react

rm -rf dist
mkdir -p dist/vanilla dist/react
cp -r vanilla/dist/. dist/vanilla/
cp -r react/dist/. dist/react/
cp index.html demos.json dist/
