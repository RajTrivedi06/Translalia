# Translalia Repository Migration Guide

This guide will help you migrate the Translalia repository from `OxfordCompetencyCenters/Translalia` to your own GitHub account (`RajTrivedi06`).

## Prerequisites

- ✅ Repository cloned to `/tmp/translalia-migration`
- ✅ Old remote removed
- ⏳ New GitHub repository needs to be created

## Step 1: Create New Repository on GitHub

1. Go to https://github.com/new
2. **Repository name**: `Translalia` (or any name you prefer)
3. **Owner**: Select `RajTrivedi06`
4. **Description**: (Optional) "AI-assisted creative poetry translation workspace"
5. **Visibility**: Choose Public or Private
6. **DO NOT** initialize with README, .gitignore, or license (we already have these)
7. Click **"Create repository"**

## Step 2: Add New Remote and Push

After creating the repository, run these commands:

```bash
cd /tmp/translalia-migration

# Add your new repository as remote
git remote add origin git@github.com:RajTrivedi06/Translalia.git

# Push all branches and tags to your new repository
git push -u origin main

# If you have other branches, push them too:
# git push -u origin --all
# git push -u origin --tags
```

## Alternative: Use the Migration Script

You can also use the provided script:

```bash
cd /tmp/translalia-migration
./migrate-to-new-repo.sh Translalia
```

Then follow the instructions it provides.

## Step 3: Verify Migration

1. Visit your new repository: `https://github.com/RajTrivedi06/Translalia`
2. Verify all files are present
3. Check that commit history is preserved

## Step 4: Update Local Development Setup (Optional)

If you want to work with the new repository in your development environment:

```bash
# Navigate to your workspace
cd /Users/raaj/Documents/CS/metamorphs

# If you want to replace the current translalia-web with the migrated version:
# (Backup first if needed)
# Then clone your new repo:
git clone git@github.com:RajTrivedi06/Translalia.git translalia-new
```

## Step 5: Deploy to Vercel

Once the repository is migrated:

1. Go to https://vercel.com
2. Click **"Add New Project"**
3. Import your repository: `RajTrivedi06/Translalia`
4. Configure build settings:
   - **Root Directory**: `translalia-web` (if the app is in that folder)
   - **Framework Preset**: Next.js
   - **Build Command**: `cd translalia-web && npm run build` (or `pnpm build`)
   - **Output Directory**: `translalia-web/.next`
5. Add environment variables (from your `.env` file)
6. Deploy!

## Important Notes

- ✅ All commit history will be preserved
- ✅ All branches will be migrated
- ⚠️ Make sure to update any CI/CD configurations that reference the old repository
- ⚠️ Update any documentation that references the old repository URL
- ⚠️ If you have collaborators, they'll need to update their remotes

## Troubleshooting

### If you get "repository not found" error:

- Make sure the repository exists on GitHub
- Verify your SSH key is set up: `ssh -T git@github.com`
- Check that you have access to the `RajTrivedi06` account

### If you want to change the repository name later:

```bash
git remote set-url origin git@github.com:RajTrivedi06/NewName.git
```

### To check current remote:

```bash
git remote -v
```
