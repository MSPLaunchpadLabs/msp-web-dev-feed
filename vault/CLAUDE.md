# CLAUDE.md

> **MSP Launchpad Labs** — Milena's workspace. LaunchFlow auto-tracker is active for this folder.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Pipeline

```bash
./process.sh
```

This processes all files in `raw/` and writes results to `outputs/` with a `.out.txt` extension appended to the original filename.

## Architecture

This is a minimal Bash file processing pipeline:

- `raw/` — input text files
- `process.sh` — iterates over `raw/`, wraps each file's content with metadata (source filename, status marker), and writes output
- `outputs/` — processed results; filenames match input with `.out.txt` appended
- `wiki/` — empty, likely reserved for documentation
- `claude.md/` — empty directory (distinct from this file)

The script uses `set -e` so any processing error aborts the run immediately.
