---
name: eli5
description: >-
  Explain any topic like the reader knows nothing: big pictures, few words,
  concrete metaphors, optional self-contained HTML artifact opened in the
  browser. Use when the user says ELI5, /eli5, "explain like I'm five",
  "like I know nothing", wants a visual explainer, or asks for big pictures
  and few words.
---

# ELI5

Teach one idea so a smart stranger with zero domain context gets it in one glance.

## Default output

**Prefer a single self-contained HTML file** opened in the browser (`open <path>` on macOS). Chat-only ELI5 is fine when the user asks for text, or the topic is one sentence.

### HTML rules

1. **One file.** Inline CSS + inline SVG. No external fonts, scripts, images, or network requests.
2. **Big pictures, few words.** Each slide = one metaphor picture (large SVG) + a short heading + ≤2 short sentences. No jargon unless the metaphor defines it.
3. **≤5 slides.** Cap at five. Rank must-know first; cut the rest.
4. **Assume zero knowledge.** No repo paths, issue numbers, or acronyms unless the slide teaches them.
5. **Open it.** Write under `/tmp/` (or a path the user names), then `open` the file. Tell them the path in one line.
6. **No quizzes, forms, or buttons.** Display-only.

### Slide recipe

```
1. What is the thing?     (concrete metaphor)
2. What already exists?   (if comparing to something shipped)
3. What is new / missing? (the ask)
4. One contrast picture   (before vs after / now vs later)
```

Drop steps that do not apply. Never pad.

### Visual style

- High contrast, thick strokes, large labels on the SVG itself
- System font stack only
- Avoid purple gradients, glow, emoji sticker clutter, and dense dashboards
- One job per slide — no card grids of stats

### Chat fallback (when HTML is skipped)

Lead with the metaphor in one line. Then at most three short bullets. No preamble. No recap.

## Voice

- Short words. Concrete nouns. Active verbs.
- Metaphors from daily life (recipe cards, boxes, janitors, editors) over product jargon.
- If a term must appear, define it in the same sentence: “Skills = recipe cards for the AI.”

## Do not

- Dump architecture, file trees, or acceptance criteria
- Use “as mentioned above” — restating is fine; memory is not assumed
- Soften into marketing copy or a status update
- Commit or publish the HTML unless the user asks
