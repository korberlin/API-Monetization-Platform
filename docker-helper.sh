#!/bin/bash

# Docker Helper Script for API Monetization Platform

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        echo -e "${RED}Docker is not running. Please start Docker first.${NC}"
        exit 1
    fi
}

# Function to build all services
build_all() {
    echo -e "${GREEN}Building all services...${NC}"
    docker-compose build
}

# Function to start all services
start_all() {
    echo -e "${GREEN}Starting all services...${NC}"
    docker-compose up -d
    echo -e "${GREEN}Waiting for services to be healthy...${NC}"
    sleep 10
    docker-compose ps
}

# Function to stop all services
stop_all() {
    echo -e "${YELLOW}Stopping all services...${NC}"
    docker-compose down
}

# Function to view logs
view_logs() {
    if [ -z "$1" ]; then
        docker-compose logs -f
    else
        docker-compose logs -f $1
    fi
}

# Function to run database migrations
run_migrations() {
    echo -e "${GREEN}Running database migrations...${NC}"
    docker-compose run --rm migration
}

# Function to seed database
seed_database() {
    echo -e "${GREEN}Seeding database...${NC}"
    docker-compose exec gateway npx prisma db seed
}

# Function to reset everything
reset_all() {
    echo -e "${RED}This will delete all data and volumes. Are you sure? (y/N)${NC}"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        docker-compose down -v
        echo -e "${GREEN}All data has been reset.${NC}"
    else
        echo -e "${YELLOW}Reset cancelled.${NC}"
    fi
}

# Function to show service status
show_status() {
    echo -e "${GREEN}Service Status:${NC}"
    docker-compose ps
    echo -e "\n${GREEN}Service Health:${NC}"
    for service in gateway analytics billing postgres redis; do
        health=$(docker inspect --format='{{.State.Health.Status}}' $(docker-compose ps -q $service) 2>/dev/null || echo "not running")
        echo "$service: $health"
    done
}

# Main menu
case "$1" in
    build)
        check_docker
        build_all
        ;;
    start)
        check_docker
        start_all
        ;;
    stop)
        check_docker
        stop_all
        ;;
    restart)
        check_docker
        stop_all
        build_all
        start_all
        ;;
    logs)
        check_docker
        view_logs $2
        ;;
    migrate)
        check_docker
        run_migrations
        ;;
    seed)
        check_docker
        seed_database
        ;;
    reset)
        check_docker
        reset_all
        ;;
    status)
        check_docker
        show_status
        ;;
    *)
        echo "Usage: $0 {build|start|stop|restart|logs|migrate|seed|reset|status}"
        echo ""
        echo "Commands:"
        echo "  build    - Build all Docker images"
        echo "  start    - Start all services"
        echo "  stop     - Stop all services"
        echo "  restart  - Rebuild and restart all services"
        echo "  logs     - View logs (optionally specify service name)"
        echo "  migrate  - Run database migrations"
        echo "  seed     - Seed the database with test data"
        echo "  reset    - Reset everything (WARNING: deletes all data)"
        echo "  status   - Show service status and health"
        exit 1
        ;;
esac