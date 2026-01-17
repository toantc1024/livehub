#!/bin/bash
# LiveHub Production Deployment Script
# Usage: ./deploy.sh [command]
#
# Commands:
#   up       - Start all services (default)
#   down     - Stop all services
#   restart  - Restart all services
#   rebuild  - Rebuild and restart (use after code changes)
#   logs     - View logs (all services)
#   logs-api - View API logs
#   logs-worker - View worker logs
#   status   - Show status of all services
#   pull     - Pull latest code from git and rebuild

set -e

COMPOSE_FILE="docker-compose.prod.yml"

cd /root/livehub

case "${1:-up}" in
    up)
        echo "🚀 Starting LiveHub..."
        docker compose -f $COMPOSE_FILE up -d
        echo "✅ LiveHub started!"
        docker compose -f $COMPOSE_FILE ps
        ;;
    down)
        echo "⏹️ Stopping LiveHub..."
        docker compose -f $COMPOSE_FILE down
        echo "✅ LiveHub stopped!"
        ;;
    restart)
        echo "🔄 Restarting LiveHub..."
        docker compose -f $COMPOSE_FILE restart
        echo "✅ LiveHub restarted!"
        docker compose -f $COMPOSE_FILE ps
        ;;
    rebuild)
        echo "🔨 Rebuilding and restarting LiveHub..."
        docker compose -f $COMPOSE_FILE down
        docker compose -f $COMPOSE_FILE build --no-cache
        docker compose -f $COMPOSE_FILE up -d
        echo "✅ LiveHub rebuilt and started!"
        docker compose -f $COMPOSE_FILE ps
        ;;
    logs)
        docker compose -f $COMPOSE_FILE logs -f
        ;;
    logs-api)
        docker logs -f livehub-api
        ;;
    logs-worker)
        docker logs -f livehub-worker
        ;;
    status)
        docker compose -f $COMPOSE_FILE ps -a
        ;;
    pull)
        echo "📥 Pulling latest code..."
        git pull
        echo "🔨 Rebuilding..."
        docker compose -f $COMPOSE_FILE down
        docker compose -f $COMPOSE_FILE build --no-cache
        docker compose -f $COMPOSE_FILE up -d
        echo "✅ LiveHub updated and started!"
        docker compose -f $COMPOSE_FILE ps
        ;;
    *)
        echo "Usage: ./deploy.sh [up|down|restart|rebuild|logs|logs-api|logs-worker|status|pull]"
        exit 1
        ;;
esac
