#!/bin/bash
# Launch Jekyll dev server locally with live reload

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Add user-installed Ruby gems bin path dynamically
USER_GEM_DIR="$(ruby -e 'require "rubygems"; print Gem.user_dir' 2>/dev/null)"
if [ -n "$USER_GEM_DIR" ]; then
    export PATH="$USER_GEM_DIR/bin:$PATH"
fi

RUBY_API_VER="$(ruby -e 'print RbConfig::CONFIG["ruby_version"]' 2>/dev/null)"
if [ -n "$RUBY_API_VER" ]; then
    FALLBACK_GEM_BIN="$HOME/.local/share/gem/ruby/$RUBY_API_VER/bin"
    export PATH="$FALLBACK_GEM_BIN:$PATH"
fi

# Check Jekyll is available and executable
if ! command -v jekyll &> /dev/null || ! jekyll --version &> /dev/null; then
    echo "Jekyll not found. Installing..."
    gem install --user-install jekyll bundler
    hash -r
fi

# Ensure SEO plugins needed by this site are available locally
if ! gem list -i jekyll-seo-tag > /dev/null 2>&1; then
    echo "Installing jekyll-seo-tag..."
    gem install --user-install jekyll-seo-tag
fi

if ! gem list -i jekyll-sitemap > /dev/null 2>&1; then
    echo "Installing jekyll-sitemap..."
    gem install --user-install jekyll-sitemap
fi

# Convert BibTeX to YAML before serving
echo "Converting publications.bib -> publications.yml..."
python3 "$SCRIPT_DIR/_scripts/bib_to_yaml.py"

JEKYLL_PORT="${JEKYLL_PORT:-4000}"
if ! ruby -rsocket -e 'port = ARGV[0].to_i; begin; s = TCPServer.new("127.0.0.1", port); s.close; rescue Errno::EADDRINUSE; exit 1; end' "$JEKYLL_PORT"; then
    echo "Port $JEKYLL_PORT is busy. Searching for a free port..."
    for candidate in $(seq $((JEKYLL_PORT + 1)) $((JEKYLL_PORT + 20))); do
        if ruby -rsocket -e 'port = ARGV[0].to_i; begin; s = TCPServer.new("127.0.0.1", port); s.close; rescue Errno::EADDRINUSE; exit 1; end' "$candidate"; then
            JEKYLL_PORT="$candidate"
            break
        fi
    done
fi

echo "Starting Jekyll server at http://localhost:$JEKYLL_PORT"
echo "Press Ctrl+C to stop"
LIVERELOAD_PORT="${JEKYLL_LIVERELOAD_PORT:-35729}"
if ruby -rsocket -e 'port = ARGV[0].to_i; begin; s = TCPServer.new("127.0.0.1", port); s.close; rescue Errno::EADDRINUSE; exit 1; end' "$LIVERELOAD_PORT"; then
    jekyll serve --livereload --livereload_port "$LIVERELOAD_PORT" --baseurl '' --port "$JEKYLL_PORT"
else
    echo "LiveReload port $LIVERELOAD_PORT is busy. Starting without live reload..."
    jekyll serve --baseurl '' --port "$JEKYLL_PORT"
fi