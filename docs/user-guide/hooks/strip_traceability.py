"""mkdocs build hook: strip traceability footers from the rendered site.

The traceability block (delimited by the `<!-- traceability -->` /
`<!-- /traceability -->` markers) is load-bearing METADATA in the Markdown source —
the generate-user-guides skill parses the per-requirement hashes from it. Readers of
the published guide don't need to see it, so we remove the whole block (markers and
the blockquote/hash table between them) before mkdocs renders each page.

The source .md files are left untouched; this only affects the built HTML.
"""

import re

_TRACEABILITY = re.compile(
    r"\n*<!-- traceability -->.*?<!-- /traceability -->\n*",
    re.DOTALL,
)


def on_page_markdown(markdown, **kwargs):
    return _TRACEABILITY.sub("\n", markdown).rstrip() + "\n"
