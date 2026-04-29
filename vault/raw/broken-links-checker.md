# Broken Links Checker

Date: 2026-04-22

## Goal
Create a script that scans a website and finds broken links.

## Why
- Easier to check while post live QA
- Avoid bad URLs
❌ leftover staging domains like msplaunchpaddemo10.com
❌ demo links in buttons, nav, CMS fields
❌ broken internal links
❌ incorrect redirects

## Input
- Website URL (example: homepage)

## Output
- List of broken links (404, demo domain.)

## Questions
- How to scan all pages?
- How to check links automatically?
- Should output go to file or Google Sheets?

## Notes
- Could be used for multiple clients
- Maybe run weekly
- Run before and after site going live