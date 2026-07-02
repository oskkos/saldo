# Saldo user guide

A task-oriented end-user guide, generated from the OpenSpec specs by the
`/generate-user-guides` Claude Code skill (see `.claude/skills/generate-user-guides/`).

## Layout

```
docs/user-guide/
  mkdocs.yml            # site config; nav is the one hand-blessed artifact
  requirements.txt      # docs toolchain (mkdocs-material)
  content/              # docs_dir — generated pages + screenshots
    index.md            # hand-maintained landing page
    <task>.md           # generated task pages (with traceability footers)
    screenshots/        # generated screenshots
  site/                 # built output (gitignored)
```

## Build / serve locally

This phase builds locally only — there is no hosted deploy. The toolchain is
Python (mkdocs-material), kept separate from the app's Node dependencies.

```bash
cd docs/user-guide
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
mkdocs serve            # http://127.0.0.1:8000
# or a one-off build into ./site
mkdocs build
```

## Regenerating content

Don't hand-edit generated pages. Run the skill instead:

```
/generate-user-guides                 # stateful: regenerate only what changed
/generate-user-guides worklog         # scope to a capability/page/requirement
/generate-user-guides --check         # staleness report, writes nothing
```
