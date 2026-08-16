#!/usr/bin/env bash

set -e

echo "Checking health..."

curl --fail \
  http://localhost:3000/health

echo

echo "Checking state..."

curl --fail \
  http://localhost:3000/state

echo

echo "HTTP smoke test passed."