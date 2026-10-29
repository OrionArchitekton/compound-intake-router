#!/bin/bash
# Compatibility entrypoint for the explicitly invoked live demo.
DIR="$(cd "$(dirname "$0")" && pwd)"
exec node "$DIR/../scripts/live-demo.js"
