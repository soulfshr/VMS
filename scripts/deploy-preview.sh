#!/bin/bash
# Deploy to Vercel preview and alias to dev-siembra.ripple-vms.com

set -e

echo "🚀 Deploying to Vercel preview..."
DEPLOY_OUTPUT=$(vercel --no-clipboard 2>&1)
DEPLOY_URL=$(echo "$DEPLOY_OUTPUT" | grep -oE 'https://vms-[a-z0-9]+-josh-cottrells-projects\.vercel\.app' | head -1)

if [ -z "$DEPLOY_URL" ]; then
  echo "❌ Failed to get deployment URL"
  echo "$DEPLOY_OUTPUT"
  exit 1
fi

echo "✅ Deployed to: $DEPLOY_URL"
echo ""
echo "⏳ Waiting for build to complete..."
sleep 45

echo "🔗 Aliasing to dev-siembra.ripple-vms.com..."
vercel alias "$DEPLOY_URL" dev-siembra.ripple-vms.com

echo ""
echo "✅ Preview available at: https://dev-siembra.ripple-vms.com"
