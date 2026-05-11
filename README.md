# Vocab Learner

A Chrome extension for learning English vocabulary while browsing — AI-powered definitions, one-click saving, and GitHub Gist sync.

## Features

- **Highlight saved words** — learning words are underlined on every page you visit
- **Click to look up** — click any underlined word to see its definition and example sentence
- **Select to translate** — select any English text to get an AI translation with key phrase breakdown
- **One-click save** — add words or phrases to your vocabulary list from any popup
- **Spaced review** — review due words with “forgot / unsure / remembered” scheduling
- **Vocabulary page** — review all saved words with definitions, example sentences, and source URLs
- **GitHub Gist sync** — your word list is automatically synced to a private GitHub Gist

---

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked** and select the project folder
5. The extension icon will appear in your toolbar

---

## Configuration

Click the extension icon → **⚙️ 设置** to open the settings page.

### DeepSeek API Key

The extension uses [DeepSeek](https://platform.deepseek.com/) for AI definitions and translations.

1. Go to [https://platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys)
2. Create a new API key
3. Paste it into the **DeepSeek API Key** field in the settings page
4. Click **保存**

### GitHub Gist Sync (Optional)

Syncing your vocabulary to a private GitHub Gist lets you back it up and share it across devices.

#### Step 1 — Create a GitHub Personal Access Token

1. Go to [https://github.com/settings/tokens](https://github.com/settings/tokens)
2. Click **Generate new token (classic)**
3. Give it a name, e.g. `vocab-learner`
4. Under **Scopes**, check **`gist`** only
5. Click **Generate token** and copy the token (you won't see it again)

#### Step 2 — Save the token in the extension

1. Open the extension settings page
2. Paste the token into the **GitHub Token** field
3. Click **保存**

The extension will automatically create a private Gist named `vocab-learner.json` on the next word save, and sync changes every 5 seconds after activity.

#### Step 3 — Sync across devices (optional)

To use the same vocabulary on another device:

1. Find your Gist ID — go to [https://gist.github.com](https://gist.github.com), open the `vocab-learner.json` gist, and copy the ID from the URL (the long string after your username)
2. On the second device, open extension settings, fill in both the GitHub Token and the **Gist ID** field
3. Click **从 Gist 拉取** to import the existing vocabulary

---

## Usage

| Action | How |
|---|---|
| Look up a saved word | Click the underlined word on any page |
| Look up any word | Select the word → click the **Aa** icon |
| Translate a sentence | Select the text → click the **译** icon |
| Save a word | Click **📌 生词本** in any popup |
| Mark as mastered | Click **✓ 已掌握** in any popup |
| Review due words | Click the extension icon → **🧠 开始复习** |
| Review vocabulary | Click the extension icon → **📚 生词本** |

---

## Spaced Repetition Algorithm

The review system uses an interval-based spaced repetition algorithm. When reviewing a word, you choose one of three responses:

| Response | Meaning | Next Review | Effect |
|----------|---------|-------------|--------|
| **忘了** (Forgot) | Don't remember at all | 10 minutes later | Interval resets to 0, miss count +1 |
| **模糊** (Fuzzy) | Recalled with difficulty | Tomorrow | Interval set to 1 day |
| **记得** (Remembered) | Recalled easily | Progressive interval | Interval grows, correct count +1 |

### "Remembered" interval progression

Each consecutive "remembered" response increases the interval following this schedule:

`1 → 3 → 7 → 14 → 30 → 60 → 120 days`

### Other actions

| Action | Effect |
|--------|--------|
| **跳过** (Skip) | Postpone 4 hours, no stats change |
| **已掌握** (Mastered) | Remove from review queue permanently |

---

## Tech Stack

- Chrome Extension Manifest V3
- Vanilla JS (no framework)
- [DeepSeek API](https://platform.deepseek.com/) for AI features
- GitHub Gist API for cloud sync

---

## License

MIT
