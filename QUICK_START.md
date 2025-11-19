# Quick Start - Migrate to Your Repository

## Option 1: Manual Steps (Recommended)

### 1. Create Repository on GitHub

Visit: https://github.com/new

- Repository name: `Translalia`
- Owner: `RajTrivedi06`
- **Don't** initialize with README/gitignore/license

### 2. Run These Commands

```bash
cd /tmp/translalia-migration

# Add your new repository
git remote add origin git@github.com:RajTrivedi06/Translalia.git

# Push to your new repository
git push -u origin main
```

Done! 🎉

## Option 2: Using the Script

```bash
cd /tmp/translalia-migration
./migrate-to-new-repo.sh Translalia
```

Then follow the on-screen instructions.

## After Migration

1. Verify: https://github.com/RajTrivedi06/Translalia
2. Deploy to Vercel: Import the repository and configure build settings
3. Update any CI/CD or documentation references

## Need Help?

See `MIGRATION_GUIDE.md` for detailed instructions.
