---
name: cloudinary-transformations
description: turn natural-language image and video transformation requirements into valid cloudinary delivery urls and transformation strings. use when building or debugging cloudinary transformation syntax.
---

# Cloudinary Transformations

## Purpose

Use this skill when you need to convert a transformation request into a valid Cloudinary URL or transformation string.

## Core workflow

1. Identify the asset type and delivery goal.
2. Translate the request into transformation components in a valid order.
3. Validate crop and resize behavior, quality and format settings, effects, overlays, and video-specific parameters against official docs.
4. Check the final URL for syntax, ordering, and escaping issues.

## Rules

- Use Cloudinary transformation syntax exactly.
- Prefer documented parameters over ad hoc URL fragments.
- When a request is ambiguous, ask for the asset type, target dimensions, or intended effect behavior.
- For framework-specific wrappers, follow the wrapper docs and only fall back to raw URLs when appropriate.

## Common tasks

- Resize and crop
- Format and quality optimization
- Effects and AI transformations
- Overlays and text overlays
- Video trimming and transcoding
- Debugging invalid URLs
