# Word Trail

這是一個以手機使用為優先的 PWA 背單字專案，目標是讓使用者可以依照遺忘曲線安排複習，並在手機上快速查看今天該複習的單字。

## 目前版本內容

- 不依賴 `Node.js`
- 使用原生 `HTML + CSS + JavaScript`
- 支援 PWA 基本設定與安裝
- 手機優先的首頁與複習介面
- 以簡化版遺忘曲線安排複習時間
- 可新增單字、查看待複習單字、進行記憶評分
- 可查詢單字後自動帶入詞義、英文例句與正體中文翻譯
- 在查詢結果與單字卡上顯示 `CEFR` 等級與 `Oxford 3000 / 5000` 標記
- 可要求瀏覽器通知權限，顯示到期複習提醒
- 可使用瀏覽器內建語音朗讀單字
- 資料先存於瀏覽器 `localStorage`

## 為什麼改用原生前端

由於目前電腦環境無法安裝 `Node.js`，因此這個專案改成純靜態前端版本。這種方式的好處是：

- 不需要 `npm install`
- 不需要前端建置工具
- 可以直接修改檔案後部署
- 很適合放到 GitHub Pages 或其他靜態網站空間

## 專案結構

- `index.html`
  主頁面

- `style.css`
  介面樣式

- `app.js`
  單字資料、複習邏輯、通知與互動

- `manifest.webmanifest`
  PWA 設定檔

- `service-worker.js`
  離線快取與基本 PWA 支援

- `icon-192.svg` / `icon-512.svg`
  App icon

- `.nojekyll`
  讓 GitHub Pages 以純靜態網站方式提供檔案

- `.gitignore`
  避免把本機暫存或編輯器雜項檔案一起推上 GitHub

## 目前的複習邏輯

目前採用簡化版遺忘曲線間隔：

1. 第 1 次複習：20 分鐘後
2. 第 2 次複習：1 天後
3. 第 3 次複習：3 天後
4. 第 4 次複習：7 天後
5. 第 5 次複習：14 天後
6. 第 6 次複習：30 天後

評分方式：

- `忘記了`
  回到第 1 階段

- `有點難`
  維持目前階段

- `記得`
  前進 1 個階段

- `很熟`
  前進 2 個階段

## 如何在本機使用

這個版本不需要安裝任何額外套件。你可以直接：

1. 用瀏覽器開啟 `index.html`
2. 或將整個資料夾部署到靜態網站空間

如果要完整測試 PWA 與 `service worker`，建議使用本機靜態伺服器或部署後再測試，因為某些瀏覽器功能在直接開啟本機檔案時可能受限制。

如果你的電腦已有 Python，可以直接在專案資料夾執行：

```powershell
py -3 -m http.server 8000
```

然後在瀏覽器開啟：

```text
http://localhost:8000
```

## 如何放到 GitHub 讓其他人使用

最簡單的做法是：

1. 建立一個新的 GitHub repository，例如 `word-trail`
2. 將目前 `vocab_pwa` 資料夾中的檔案上傳到 repository 根目錄
3. 啟用 GitHub Pages
4. 將 Pages 指向 `main` branch 的 `/ (root)`
5. 使用者就可以直接透過網址在手機上開啟

### 建議上傳到 GitHub 的檔案

- `index.html`
- `style.css`
- `app.js`
- `manifest.webmanifest`
- `service-worker.js`
- `icon-192.svg`
- `icon-512.svg`
- `.nojekyll`
- `.gitignore`
- `README.md`

### GitHub Pages 設定建議

若你是用 GitHub 網頁介面操作：

1. 進入 repository
2. 開啟 `Settings`
3. 點選 `Pages`
4. 在 `Build and deployment` 中設定：
   `Source = Deploy from a branch`
5. Branch 選：
   `main`
6. Folder 選：
   `/ (root)`

儲存後，GitHub 會提供一個公開網址。

### 為什麼這個版本適合 GitHub Pages

- 所有資源檔案都使用相對路徑
- 不需要建置工具
- 不需要伺服器端程式
- 可以直接從 repository 根目錄部署

## 手機提醒的限制

目前版本的提醒屬於前端第一版：

- 可請求通知權限
- 當 App 開啟時，若有到期單字可顯示瀏覽器通知

但如果你要的是「即使 App 沒開、手機也能穩定在指定時間跳通知」，通常還需要：

- Web Push
- 後端推播服務
- 或更完整的行動裝置通知機制

因此目前版本適合作為：

- 介面原型
- 背單字流程驗證
- PWA 基礎版本

## 單字查詢資料來源說明

目前查詢流程使用以下來源：

- 詞義、音標、英文例句：
  `dictionaryapi.dev`

- 例句與定義的正體中文翻譯：
  `MyMemory Translation API`

- `CEFR` 與 `Oxford 3000 / 5000` 標記：
  以公開整理的 Oxford 3000 / 5000 字表做比對

### 補充說明

- `Cambridge Dictionary API` 雖然很適合查 `CEFR`，但正式使用需要申請 API key，因此目前版本沒有直接接入。
- 若查詢到的單字不在 Oxford 3000 / 5000 裡，畫面會顯示 `Not in Oxford 5000` 或 `Unknown`。
- 翻譯與字級標記都依賴網路查詢，因此離線狀態下可能無法完整自動填入。

## 下一步建議

下一版可以再加入：

1. `IndexedDB`，取代 `localStorage`
2. 單字分類與標籤
3. 自動查詞義與例句
4. 每日複習統計
5. Web Push 通知
6. 匯入與匯出單字資料
