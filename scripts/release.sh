#!/bin/bash

# Script to create a new release locally: bump version, commit, tag, push, build deb, and publish to obision-packages

set -e  # Exit on error

# Get current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")

# Split version into parts
IFS='.' read -ra VERSION_PARTS <<< "$CURRENT_VERSION"
MAJOR="${VERSION_PARTS[0]}"
MINOR="${VERSION_PARTS[1]}"
PATCH="${VERSION_PARTS[2]}"

# Increment minor version and reset patch to 0
NEW_MINOR=$((MINOR + 1))
NEW_VERSION="${MAJOR}.${NEW_MINOR}.0"

echo "🚀 Creating new release (local build)"
echo "Current version: $CURRENT_VERSION"
echo "New version: $NEW_VERSION"
echo ""

# Update package.json
echo "📝 Updating package.json..."
npm version $NEW_VERSION --no-git-tag-version

# Update meson.build
echo "📝 Updating meson.build..."
sed -i "s/version: '$CURRENT_VERSION'/version: '$NEW_VERSION'/" meson.build

# Update debian/changelog (if it exists)
if [ -f "debian/changelog" ]; then
  echo "📝 Updating debian/changelog..."
  CURRENT_DATE=$(date -R)
  AUTHOR_NAME="Jose Francisco Gonzalez"
  AUTHOR_EMAIL="jfgs1609@gmail.com"

  cat > debian/changelog.tmp << EOF
obision-app-optional-soft ($NEW_VERSION) unstable; urgency=medium

  * Release version $NEW_VERSION

 -- $AUTHOR_NAME <$AUTHOR_EMAIL>  $CURRENT_DATE

EOF

  cat debian/changelog >> debian/changelog.tmp
  mv debian/changelog.tmp debian/changelog
  
  # Commit changes including debian/changelog
  echo "💾 Committing changes..."
  git add package.json meson.build debian/changelog package-lock.json
else
  echo "⚠️  Skipping debian/changelog (file not found)"
  # Commit changes without debian/changelog
  echo "💾 Committing changes..."
  git add package.json meson.build package-lock.json
fi
git commit -m "Release version $NEW_VERSION"

# Create tag
echo "🏷️  Creating tag v$NEW_VERSION..."
git tag -a "v$NEW_VERSION" -m "Release version $NEW_VERSION"

# Push to repository
echo "⬆️  Pushing to repository..."
git push origin master
git push origin "v$NEW_VERSION"

echo ""
echo "📦 Building .deb package..."
npm run deb-clean
npm run deb-build

echo ""
echo "📂 Copying to obision-packages repository..."
OBISION_PACKAGES_DIR="../obision-packages"
DEB_FILE="builddir/obision-app-optional-soft.deb"
ARCH="all"

# Check if obision-packages exists
if [ ! -d "$OBISION_PACKAGES_DIR" ]; then
  echo "❌ Error: obision-packages repository not found at $OBISION_PACKAGES_DIR"
  exit 1
fi

# Create debs directory if it doesn't exist
mkdir -p "$OBISION_PACKAGES_DIR/debs"

# Remove old versions of this package
rm -f "$OBISION_PACKAGES_DIR/debs/obision-app-optional-soft_"*"_all.deb"

# Copy the .deb file with version in the name
DEB_VERSIONED="obision-app-optional-soft_${NEW_VERSION}_${ARCH}.deb"
cp "$DEB_FILE" "$OBISION_PACKAGES_DIR/debs/$DEB_VERSIONED"

# Change to obision-packages directory
cd "$OBISION_PACKAGES_DIR"

echo "🔄 Regenerating Packages and Release files..."

# Remove old files if they exist
rm -f Packages Packages.gz Release Release.gpg InRelease

# Generate Packages file from debs directory
dpkg-scanpackages --arch all debs > Packages
gzip -k -f Packages

# Generate Release file
cat > Release << EOF
Origin: Obision
Label: Obision Packages
Suite: stable
Codename: stable
Version: 1.0
Architectures: all
Components: main
Description: Obision custom packages repository
Date: $(date -Ru)
EOF

# Add checksums to Release
echo "MD5Sum:" >> Release
for file in Packages Packages.gz; do
  if [ -f "$file" ]; then
    echo " $(md5sum $file | cut -d' ' -f1) $(stat -c%s $file) $file" >> Release
  fi
done

echo "SHA1:" >> Release
for file in Packages Packages.gz; do
  if [ -f "$file" ]; then
    echo " $(sha1sum $file | cut -d' ' -f1) $(stat -c%s $file) $file" >> Release
  fi
done

echo "SHA256:" >> Release
for file in Packages Packages.gz; do
  if [ -f "$file" ]; then
    echo " $(sha256sum $file | cut -d' ' -f1) $(stat -c%s $file) $file" >> Release
  fi
done

echo ""
echo "📤 Committing and pushing to obision-packages..."
git add .
git commit -m "Add obision-app-optional-soft version $NEW_VERSION"
git push origin master

# Return to original directory
cd -

echo ""
echo "✅ Release $NEW_VERSION completed successfully!"
echo ""
echo "Summary:"
echo "  ✓ Version bumped to $NEW_VERSION"
echo "  ✓ Tag v$NEW_VERSION created and pushed"
echo "  ✓ .deb package built"
echo "  ✓ Package uploaded to obision-packages"
echo "  ✓ Repository metadata regenerated"
echo ""
