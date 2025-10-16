#!/bin/bash
# Temporal UI debugging script

echo "=== Docker Container Status ==="
docker-compose -f docker-compose.production.yml ps

echo -e "\n=== Temporal UI Container Logs (last 30 lines) ==="
docker-compose -f docker-compose.production.yml logs --tail=30 temporal-ui

echo -e "\n=== Backend Logs (Temporal UI related) ==="
docker-compose -f docker-compose.production.yml logs backend | grep -i "temporal" | tail -30

echo -e "\n=== Backend Environment Variables ==="
docker-compose -f docker-compose.production.yml exec backend env | grep -E "TEMPORAL_UI_URL|NODE_ENV"

echo -e "\n=== Test Network Connectivity ==="
echo "Testing if backend can reach temporal-ui:8080..."
docker-compose -f docker-compose.production.yml exec backend sh -c "nc -zv temporal-ui 8080 || curl -v http://temporal-ui:8080 || echo 'Connection failed'"

echo -e "\n=== Check if Temporal UI is actually running on 8080 ==="
docker-compose -f docker-compose.production.yml exec temporal-ui sh -c "netstat -tlnp | grep 8080 || ss -tlnp | grep 8080 || echo 'Port check failed'"
