#!/bin/bash

# Migration script for Translalia repository
# This script will help you migrate the repo to your own GitHub account

set -e

echo "🚀 Translalia Repository Migration Script"
echo "=========================================="
echo ""

# Check if repository name is provided
if [ -z "$1" ]; then
    echo "Usage: ./migrate-to-new-repo.sh <repository-name>"
    echo "Example: ./migrate-to-new-repo.sh Translalia"
    echo ""
    echo "⚠️  Make sure you have:"
    echo "   1. Created a new repository on GitHub under RajTrivedi06"
    echo "   2. The repository name you want to use"
    exit 1
fi

REPO_NAME=$1
GITHUB_USER="RajTrivedi06"

echo "📋 Repository Details:"
echo "   GitHub User: $GITHUB_USER"
echo "   Repository Name: $REPO_NAME"
echo ""

# Check if remote already exists
if git remote | grep -q "^origin$"; then
    echo "⚠️  Remote 'origin' already exists. Removing it..."
    git remote remove origin
fi

# Add new remote
echo "🔗 Adding new remote repository..."
git remote add origin "git@github.com:${GITHUB_USER}/${REPO_NAME}.git"

echo ""
echo "✅ Remote added successfully!"
echo ""
echo "📤 Next steps:"
echo "   1. Make sure you've created the repository on GitHub:"
echo "      https://github.com/new"
echo "      Repository name: $REPO_NAME"
echo "      Owner: $GITHUB_USER"
echo "      (You can make it private or public)"
echo ""
echo "   2. Once the repository is created, run:"
echo "      git push -u origin main"
echo ""
echo "   3. If your default branch is 'master' instead of 'main', run:"
echo "      git push -u origin master"
echo ""

# Check current branch
CURRENT_BRANCH=$(git branch --show-current)
echo "📍 Current branch: $CURRENT_BRANCH"
echo ""
echo "To push now, run:"
echo "   git push -u origin $CURRENT_BRANCH"

