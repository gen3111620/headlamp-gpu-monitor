# 本機檢視 GPU Monitor

這是獨立的 Headlamp 插件專案。第一版使用 NVIDIA DCGM Exporter 與 Prometheus，提供 GPU 即時資料、歷史曲線、Node／Pod 頁面整合及每個叢集各自的連線設定。

## 本機預覽

需要 Node.js 22.12 以上。

```sh
npm ci
npm run preview
```

預覽監聽 `0.0.0.0:5178`。本機開啟 http://127.0.0.1:5178，其他機器則開啟 `http://<主機 IP>:5178`。預覽有清楚標示的測試資料，可切換明暗主題、載入中、沒有資料、權限不足及舊資料狀態。這些資料不會被打包到正式插件。

## 建置與驗證

```sh
npm run validate
npm run test:browser
npm run package
npm run checksums
```

安裝包在 `artifacts/headlamp-gpu-monitor-0.1.0.tar.gz`，校驗碼在 `artifacts/SHA256SUMS`。同版本的安裝包若已存在，SDK 會拒絕覆寫；先移走舊檔再重建。

## 接上實際叢集

將安裝包解壓縮到 Headlamp 的插件目錄，重新整理頁面，在側邊欄開啟 GPU Monitor，填入 Prometheus 的 namespace、Service 名稱及 port。若為多叢集共用的 Prometheus，還需填入 cluster label 與對應值。

第一版顯示的是最近有指標的 GPU，並非完整的硬體清單或排程分配統計。MIG 會獨立列出，缺少的指標顯示 `—`。Pod 關聯取決於 exporter 提供的標籤，不代表共享 GPU 的獨占用量。

## 發布狀態

GitHub repo、push、Release 和 Artifact Hub 上架都尚未執行。之後確認本機成果，再使用你的個人 GitHub 帳號處理。公開帳號、維護者姓名與 email 尚未填入，以免放入錯誤身分資料。
