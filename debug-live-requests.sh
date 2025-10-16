#!/bin/bash
# Debug live Temporal UI requests

echo "=== Following live backend logs (Ctrl+C to stop) ==="
echo "Try accessing Temporal UI now..."
echo ""

docker-compose -f docker-compose.production.yml logs -f --tail=0 backend
