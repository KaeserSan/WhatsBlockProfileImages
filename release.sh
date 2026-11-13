#!/usr/bin/env bash
# Release helper for WhatsBlock Profile Images.
#
#   ./release.sh pack
#       Builds dist/whatsblock-profile-images.xpi (unsigned) to upload to
#       addons.mozilla.org ("On your own" / unlisted) for signing.
#
#   ./release.sh publish <signed.xpi>
#       Checks the AMO-signed .xpi (signature, id and version match
#       manifest.json), tags vX.Y.Z on the current commit, pushes the tag and
#       creates the GitHub Release with the .xpi attached. The "Update
#       updates.json" workflow then updates updates.json on main.
#
# Requires: git, zip/unzip, jq, gh (logged in: gh auth login).
set -euo pipefail

cd "$(dirname "$0")"

NAME="whatsblock-profile-images"
FILES=(manifest.json background.js content.js content.css avatar.svg icons)

die() { echo "Error: $*" >&2; exit 1; }

manifest_field() { jq -r "$1" manifest.json; }

pack() {
  local version out
  version=$(manifest_field .version)
  out="dist/$NAME.xpi"
  mkdir -p dist
  rm -f "$out"
  zip -r -q "$out" "${FILES[@]}"
  echo "Built $out (version $version)."
  echo "Upload it at https://addons.mozilla.org/developers/addons → Upload New Version → \"On your own\"."
}

publish() {
  local xpi="${1:-}"
  [ -n "$xpi" ] || die "usage: ./release.sh publish <signed.xpi>"
  [ -f "$xpi" ] || die "file not found: $xpi"
  command -v gh >/dev/null || die "gh is not installed (brew install gh)"
  gh auth status >/dev/null 2>&1 || die "gh is not logged in (gh auth login)"

  local version id tag xpi_version xpi_id asset
  version=$(manifest_field .version)
  id=$(manifest_field .browser_specific_settings.gecko.id)
  tag="v$version"

  # The signed .xpi must be the version described by manifest.json.
  unzip -l "$xpi" | grep -qE 'META-INF/(mozilla\.rsa|cose\.sig)' \
    || die "$xpi is not signed by Mozilla"
  xpi_version=$(unzip -p "$xpi" manifest.json | jq -r .version)
  xpi_id=$(unzip -p "$xpi" manifest.json | jq -r .browser_specific_settings.gecko.id)
  [ "$xpi_version" = "$version" ] || die ".xpi version $xpi_version != manifest.json version $version"
  [ "$xpi_id" = "$id" ] || die ".xpi id $xpi_id != manifest.json id $id"

  # The tagged commit must be clean and already on origin/main.
  [ -z "$(git status --porcelain --untracked-files=no)" ] \
    || die "uncommitted changes; commit them first"
  git fetch -q origin
  git merge-base --is-ancestor HEAD origin/main \
    || die "current commit is not on origin/main; push it first"

  if gh release view "$tag" >/dev/null 2>&1; then
    die "release $tag already exists; bump \"version\" in manifest.json"
  fi

  # Tag the current commit (reuse the tag if it already points here).
  if git rev-parse -q --verify "refs/tags/$tag" >/dev/null; then
    [ "$(git rev-parse "$tag^{commit}")" = "$(git rev-parse HEAD)" ] \
      || die "tag $tag exists on another commit"
  else
    git tag "$tag"
  fi
  git push -q origin "$tag"

  # Attach with a stable, readable name (the URL ends up in updates.json).
  asset="dist_signed/$NAME-$version.xpi"
  mkdir -p dist_signed
  [ "$xpi" -ef "$asset" ] || cp "$xpi" "$asset"

  gh release create "$tag" "$asset" --title "$tag" --generate-notes
  echo "Released $tag. The \"Update updates.json\" workflow will now update updates.json on main;"
  echo "run 'git pull' afterwards."
}

case "${1:-}" in
  pack) pack ;;
  publish) shift; publish "$@" ;;
  *)
    echo "usage: ./release.sh pack | ./release.sh publish <signed.xpi>" >&2
    exit 1
    ;;
esac
