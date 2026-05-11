# Vocab Learner Shared Data Format

本文档约定浏览器扩展和 iOS 复习 App 共享的 GitHub Gist 数据协议。

## 文件位置

GitHub Gist 中固定使用一个文件：

```text
vocab-learner.json
```

文件内容是一个 JSON object，key 是单词或短语，value 是该词的学习信息。

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
    "definition": "n. 例子；实例",
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

## 字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `status` | string | `learning` 或 `mastered` |
| `firstSeen` | string | 首次加入时间，浏览器扩展写入，格式通常为 `yyyy-MM-dd HH:mm` |
| `lastSeen` | string | 最近更新或复习时间 |
| `contexts` | array | 保存该词出现过的上下文 |
| `contexts[].sentence` | string | 例句 |
| `contexts[].url` | string | 来源网页 |
| `definition` | string | 中文释义 |
| `phonetic` | string | 音标 |
| `reviewCount` | number | 已完成复习次数 |
| `correctCount` | number | 记得次数 |
| `missCount` | number | 忘记次数 |
| `intervalDays` | number | 当前复习间隔天数 |
| `dueAt` | string | 下次到期时间，ISO 8601 |
| `lastReviewed` | string | 最近复习时间，ISO 8601 |

## iOS App 写入范围

iOS App 只做复习，不收词。所有新增单词、释义、例句和来源都由 PC 浏览器扩展产生。

iOS App 允许更新以下字段：

- `status`
- `lastSeen`
- `reviewCount`
- `correctCount`
- `missCount`
- `intervalDays`
- `dueAt`
- `lastReviewed`

iOS App 不应该更新以下字段：

- `firstSeen`
- `contexts`
- `definition`
- `phonetic`

## 复习调度

iOS App 必须和浏览器扩展保持一致。

| 操作 | outcome | 调度 |
| --- | --- | --- |
| 忘了 | `miss` | 10 分钟后 |
| 模糊 | `hard` | 1 天后 |
| 记得 | `good` | 按 `1, 3, 7, 14, 30, 60, 120` 天递增 |
| 跳过 | `skip` | 4 小时后 |
| 已掌握 | `mastered` | `status = mastered` |

## 同步合并规则

iOS App 推送前必须先拉取远端 Gist，然后合并：

1. 远端词库是词条来源的主版本。
2. 远端新增词必须保留。
3. 远端新增 `contexts`、`definition`、`phonetic` 必须保留。
4. 对同一个词，iOS 只覆盖允许写入的复习字段。
5. iOS 本地存在但远端不存在的词，不主动新增到远端。

这样可以避免手机端复习进度覆盖 PC 浏览器刚收集的新词和例句。
