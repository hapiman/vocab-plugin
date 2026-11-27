# Vocab Learner Shared Data Format

This document defines the shared GitHub Gist data protocol used by the browser extension and the review apps (iOS / Android).

## File Location

The GitHub Gist always contains a single file:

```text
vocab-learner.json
```

The file contains a JSON object whose keys are words or phrases and whose values hold the corresponding learning information.

```json
{
  "example": {
    "status": "learning",
    "firstSeen": "2026-04-17 10:30",
    "lastSeen": "2026-04-17 10:30",
    "contexts": [
      {
        "sentence": "This is an example sentence.",
        "url": "https://example.com/article"
      }
    ],
    "definition": "n. An instance; an illustration",
    "phonetic": "/ig'zampel/",
    "reviewCount": 0,
    "correctCount": 0,
    "missCount": 0,
    "intervalDays": 0,
    "dueAt": "2026-05-11T12:00:00.000Z",
    "lastReviewed": "2026-05-11T12:00:00.000Z"
  }
}
```

## Fields

| Field | Type | Description |
| --- | --- | --- |
| `status` | string | `learning` or `mastered` |
| `firstSeen` | string | First added time, written by the extension, typically `yyyy-MM-dd HH:mm` |
| `lastSeen` | string | Most recent update or review time |
| `contexts` | array | Saved contexts in which the word appeared |
| `contexts[].sentence` | string | Example sentence |
| `contexts[].url` | string | Source web page |
| `definition` | string | Chinese definition (English sample above for illustration) |
| `phonetic` | string | Phonetic transcription |
| `reviewCount` | number | Number of completed reviews |
| `correctCount` | number | Number of correct recalls |
| `missCount` | number | Number of missed recalls |
| `intervalDays` | number | Current review interval in days |
| `dueAt` | string | Next review due time, ISO 8601 |
| `lastReviewed` | string | Most recent review time, ISO 8601 |

## Review App Write Scope (iOS / Android)

The review apps are for review only, not vocabulary collection. All new words, definitions, example sentences, and source URLs are produced by the desktop browser extension.

The review apps may update the following fields:

- `status`
- `lastSeen`
- `reviewCount`
- `correctCount`
- `missCount`
- `intervalDays`
- `dueAt`
- `lastReviewed`

The review apps should not update the following fields:

- `firstSeen`
- `contexts`
- `definition`
- `phonetic`

## Review Scheduling

The review apps (iOS / Android) must use the same scheduling rules as the browser extension.

| Action | Outcome | Schedule |
| --- | --- | --- |
| Forgot | `miss` | In 10 minutes |
| Hard | `hard` | In 1 day |
| Got It | `good` | Increase the interval through `1, 3, 7, 14, 30, 60, 120` days |
| Later | `skip` | In 4 hours |
| Mastered | `mastered` | `status = mastered` |

## Sync Merge Rules

Before pushing changes, the review apps must pull the remote Gist and merge the data:

1. The remote vocabulary is the authoritative source for vocabulary entries.
2. New words from the remote must be retained.
3. New remote `contexts`, `definition`, and `phonetic` values must be retained.
4. For the same word, the review apps may overwrite only the allowed review fields.
5. Words that exist locally in a review app but not remotely must not be added to the remote by the review app.

These rules prevent mobile review progress from overwriting new words and example sentences recently collected by the desktop browser extension.
