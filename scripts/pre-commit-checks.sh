#!/bin/sh
set -eu

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

run_with_bun() {
    echo "pre-commit: typecheck"
    bun x tsc -p tsconfig.json --noEmit

    echo "pre-commit: tests"
    bun test tests/index.test.js tests/run.integration.test.js

    echo "pre-commit: build"
    bun run build
}

run_with_node() {
    if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
        return 1
    fi

    echo "pre-commit: typecheck"
    ./node_modules/.bin/tsc -p tsconfig.json --noEmit

    echo "pre-commit: tests"
    node --test tests/index.test.js tests/run.integration.test.js

    echo "pre-commit: build"
    npm run build
}

if command -v bun >/dev/null 2>&1; then
    run_with_bun
elif run_with_node; then
    :
else
    echo "pre-commit: requires Bun or a Node/npm install with local dependencies" >&2
    exit 1
fi

if ! git diff --quiet -- dist _init; then
    echo "pre-commit: build updated dist/ or _init/. Review and stage those files before committing." >&2
    exit 1
fi
