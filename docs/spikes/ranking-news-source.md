# Ranking news source spike: RSS vs GDELT

Date: 2026-10-24 16:32 America/Santo_Domingo  
Measured window: 2026-10-17 16:32 through 2026-10-24 16:32 (seven days)  
Decision: **use first-party outlet RSS feeds for v1**.

## Method

`pnpm spike:ranking -- --rss-only` fetched the configured feeds, followed paginated
WordPress feeds back to the start of the window, normalized title and description
text, and looked for the exact accent-insensitive name of 20 prominent current and
former office-holders. The sample intentionally spans parties and current/former
roles. It is a source-coverage test, not a claim that all 20 people should have news
in every week.

The same script can query the GDELT DOC 2.0 `ArtList` endpoint one person at a time,
with `sourcecountry:DR`, `sourcelang:spanish`, exact dates, and a 5.2-second delay
between calls. GDELT's official DOC API description is at
<https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/>.

## Results

RSS fetched **1,410 distinct URLs from 13/13 working feeds**, with no feed warnings,
and found at least one mention for **15/20 people (75%)**.

| Person                  | RSS URLs |
| ----------------------- | -------: |
| Luis Abinader           |       45 |
| Raquel Peña             |        8 |
| Leonel Fernández        |        4 |
| Danilo Medina           |        2 |
| Hipólito Mejía          |        2 |
| Carolina Mejía          |       10 |
| David Collado           |       13 |
| Faride Raful            |        1 |
| Roberto Ángel Salcedo   |        2 |
| José Ignacio Paliza     |        8 |
| Guido Gómez Mazara      |        0 |
| Eduardo Estrella        |        4 |
| Ricardo de los Santos   |        6 |
| Alfredo Pacheco         |        6 |
| Omar Fernández          |        5 |
| Guillermo Moreno        |        0 |
| Abel Martínez           |        0 |
| Margarita Cedeño        |        1 |
| Gonzalo Castillo        |        0 |
| Miguel Vargas Maldonado |        0 |

GDELT did not yield a usable comparison set. Requests paced at the documented limit
returned HTTP 429 or timed out; a separate request with a 30-second timeout and a
six-second retry also returned 429 both times. Therefore GDELT coverage is **not
measurable in this run** (it must not be reported as zero matches). This availability
failure is itself disqualifying for the unattended weekly v1 job.

## False-positive review

The spike printed up to five matched headlines per covered person (56 samples). Every
match contained the person's full name in the feed title or description, and manual
review found **0 obvious wrong-person matches out of 56 (0%)**. This is only a small
sample: common names still require each profile's admin-editable `news_query`, with
office/province terms and exclusions. The query engine deliberately uses whole-word,
accent-insensitive matching and supports AND, OR, grouping, and negative terms.

Several URLs carried near-duplicate coverage of the same event. The v1 definition is
distinct published URLs, so these count as separate outlet articles. Exact duplicate
URLs are removed before scoring. If syndication materially distorts rankings, a later
iteration can add normalized-title clustering without changing the stored raw inputs.

## Operational decision

- Ingest the seven configured outlets directly by RSS. The exact feed list and outlet
  weights live in `src/lib/popularity/settings.ts` and can be overridden through the
  `ranking` site setting.
- Treat a failed individual feed as a warning, but fail the run when every feed is
  unavailable so a zero-data week cannot overwrite a good ranking.
- Keep GDELT out of the production path. Revisit it only if it provides a dependable
  quota/service contract; it remains useful as an occasional manual comparison.
- Preserve per-profile disambiguation queries and review surprising matches rather
  than assuming that a full-name match is always the right person.

The spike command is intentionally retained so the comparison can be rerun when the
outlet list or GDELT availability changes.
