#!/bin/bash
# Quick setup for Sales Engine
set -e

echo "=== Sales Engine Setup ==="

# 1. Node dependencies
echo "[1/4] Installing Node.js dependencies..."
npm install

# 2. Python venv + packages
echo "[2/4] Setting up Python virtual environment..."
python3 -m venv scripts/venv
source scripts/venv/bin/activate
pip install -r scripts/requirements.txt
deactivate

# 3. Env file
if [ ! -f .env.local ]; then
  echo "[3/4] Creating .env.local from template..."
  cp .env.example .env.local 2>/dev/null || cat > .env.local << 'EOF'
# Database
DATABASE_URL=file:./prisma/dev.db

# Auth
AUTH_PASSWORD=snowyai2026
JWT_SECRET=snowy-ai-sales-engine-jwt-secret-change-in-prod

# External APIs
GITHUB_TOKEN=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=

# GitHub repo to monitor
GITHUB_REPO_OWNER=openclaw
GITHUB_REPO_NAME=openclaw

# Reddit subreddits to monitor (comma-separated)
MONITORED_SUBREDDITS=openclaw,selfhosted,LocalLLaMA

# Twitter/X query IDs
TWITTER_QUERY_ID_CREATE_TWEET=a1p9RWpkYKBjWv_I3WzS-A
TWITTER_QUERY_ID_SEARCH_TIMELINE=MJpyQGqgklrVl_0X9gNy3A

# Tavily
TAVILY_API_KEY=

# LinkedIn
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_ACCESS_TOKEN=
LINKEDIN_PERSON_URN=
LINKEDIN_LI_AT=

# Reddit Session Cookie
REDDIT_SESSION_COOKIE=
EOF
  echo "    -> Fill in your API keys in .env.local"
else
  echo "[3/4] .env.local already exists, skipping."
fi

# 4. Prisma DB
echo "[4/4] Setting up database..."
npx prisma generate
npx prisma db push

echo ""
echo "=== Done! Run 'npm run dev' to start. ==="
