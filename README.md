# Vocab Learner（生词学习）

一个跨平台的英语生词学习项目：浏览器扩展负责在网页上收词、查词、翻译，移动端（iOS / Android）负责复习。所有数据通过 GitHub Gist 在多端之间同步。

## 仓库结构

| 目录 | 平台 | 职责 |
|---|---|---|
| [`extension/`](extension/) | Chrome 扩展（Manifest V3） | 网页收词、查词、翻译、保存、复习 |
| [`android/`](android/) | Android（Jetpack Compose） | 复习端 |
| [`ios/`](ios/) | iOS（Swift / UIKit） | 复习端 |

各端共享同一份 GitHub Gist 数据，数据格式与同步规则见 [`vocab-data-format.md`](vocab-data-format.md)。

---

## 功能

- **高亮生词** —— 在你访问的每个网页上为生词加下划线
- **点击查词** —— 点击带下划线的单词，查看释义和例句
- **划词翻译** —— 选中任意英文文本，获取 AI 翻译及关键短语拆解
- **一键保存** —— 在任意弹窗中把单词或短语加入生词本
- **间隔复习** —— 以「忘了 / 模糊 / 记得」对到期生词进行复习调度
- **生词本页面** —— 查看所有保存的单词，含释义、例句和来源网址
- **GitHub Gist 同步** —— 生词列表自动同步到私有 GitHub Gist，可在多设备间共享

---

## 安装与构建

### 浏览器扩展

1. 下载或克隆本仓库
2. 打开 Chrome，访问 `chrome://extensions/`
3. 打开右上角的 **开发者模式**
4. 点击 **加载已解压的扩展程序**，选择 `extension` 文件夹
5. 扩展图标会出现在工具栏中

### Android

1. 用 Android Studio 打开 `android/` 目录（或直接用命令行）
2. 构建 Debug 包：
   ```bash
   cd android && ./gradlew assembleDebug
   ```
3. 通过 adb 安装到设备：
   ```bash
   adb install app/build/outputs/apk/debug/app-debug.apk
   ```
> 构建 Release（签名）包需要在 `android/keystore.properties` 中配置签名信息（该文件不提交到 git）。

### iOS

iOS 端使用 CocoaPods 管理依赖：

1. 安装依赖：
   ```bash
   cd ios && pod install
   ```
2. 用 Xcode 打开 **`ios/VocabReview.xcworkspace`**（注意是 `.xcworkspace`，不是 `.xcodeproj`）
3. 选择目标设备，运行

---

## 配置

点击扩展图标 → **⚙️ 设置** 打开设置页。

### DeepSeek API Key

扩展使用 [DeepSeek](https://platform.deepseek.com/) 提供 AI 释义和翻译。

1. 访问 [https://platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys)
2. 创建一个新的 API Key
3. 粘贴到设置页的 **DeepSeek API Key** 字段
4. 点击 **保存**

### GitHub Gist 同步（可选）

把生词同步到私有 GitHub Gist，可用于备份并在多设备间共享。

#### 第一步 —— 创建 GitHub Personal Access Token

1. 访问 [https://github.com/settings/tokens](https://github.com/settings/tokens)
2. 点击 **Generate new token (classic)**
3. 取个名字，例如 `vocab-learner`
4. 在 **Scopes** 中只勾选 **`gist`**
5. 点击 **Generate token** 并复制（只会显示一次）

#### 第二步 —— 在扩展中保存 Token

1. 打开扩展设置页
2. 把 Token 粘贴到 **GitHub Token** 字段
3. 点击 **保存**

扩展会在下次保存单词时自动创建一个名为 `vocab-learner.json` 的私有 Gist，并在每次操作后 5 秒同步一次。

#### 第三步 —— 多设备同步（可选）

要在另一台设备上使用同一份生词：

1. 找到你的 Gist ID —— 访问 [https://gist.github.com](https://gist.github.com)，打开 `vocab-learner.json` 对应的 gist，从 URL 中复制 ID（用户名后面那串长字符）
2. 在第二台设备的扩展设置中，同时填入 GitHub Token 和 **Gist ID** 字段
3. 点击 **从 Gist 拉取** 导入已有生词

---

## 使用方法

| 操作 | 方式 |
|---|---|
| 查看已保存的生词 | 点击网页上带下划线的单词 |
| 查询任意单词 | 选中单词 → 点击 **Aa** 图标 |
| 翻译一句话 | 选中文本 → 点击 **译** 图标 |
| 保存单词 | 在任意弹窗中点击 **📌 生词本** |
| 标记为已掌握 | 在任意弹窗中点击 **✓ 已掌握** |
| 复习到期生词 | 点击扩展图标 → **🧠 开始复习** |
| 查看生词本 | 点击扩展图标 → **📚 生词本** |

---

## 间隔重复算法

复习系统采用基于间隔的间隔重复算法。复习一个单词时，从三种反馈中选择一个：

| 反馈 | 含义 | 下次复习 | 效果 |
|------|------|----------|------|
| **忘了** | 完全不记得 | 10 分钟后 | 间隔重置为 0，忘记次数 +1 |
| **模糊** | 费力才想起来 | 明天 | 间隔设为 1 天 |
| **记得** | 轻松想起来 | 渐进间隔 | 间隔增长，记得次数 +1 |

### 「记得」间隔递增

每连续点击一次「记得」，间隔按以下规则递增：

`1 → 3 → 7 → 14 → 30 → 60 → 120 天`

### 其他操作

| 操作 | 效果 |
|------|------|
| **跳过** | 推迟 4 小时，不改变统计 |
| **已掌握** | 永久移出复习队列 |

---

## 技术栈

- **浏览器扩展**：Chrome Extension Manifest V3、原生 JS（无框架）
- **Android**：Kotlin、Jetpack Compose
- **iOS**：Swift、UIKit、CocoaPods
- **AI 能力**：[DeepSeek API](https://platform.deepseek.com/)
- **云同步**：GitHub Gist API

---

## 许可证

MIT
