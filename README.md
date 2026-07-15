# Apple WLOC 定位修改 (Shadowrocket 模块)

本仓库提供了一个用于 **Shadowrocket（小火箭）** 修改 **Apple WLOC（无线局域网定位）** 的专属模块配置。

通过使用此模块，你可以安全、自主地修改苹果设备的网络定位，同时**摆脱对第三方远程仓库的依赖，防止上游作者“炸库”导致模块失效**。

---

## 📂 项目文件说明

本目录中已为你准备好所有相关文件，你可以直接将它们上传到你的 GitHub 仓库（建议仓库名为：`my-shadowrocket-rules`）：

1. **`apple-wloc.module`**：专属云端配置文件（已配置为你专属的用户名 `YJTDW`）。
2. **`apple-wloc-local.module`**：纯本地版配置文件（不请求任何网络，完全在手机本地运行）。
3. **`wloc.js`**：Apple WLOC 定位修改核心逻辑脚本。
4. **`wloc-settings.js`**：保存快捷指令与选点网页设置的接口处理脚本。

---

## 🚀 方案一：专属 GitHub 云端订阅版（推荐）

通过在你自己的 GitHub 账户中托管脚本，你可以实现**多设备同步更新**，且拥有**绝对控制权**。

### 1. 托管到 GitHub 步骤
1. 在 GitHub 上新建一个**公开（Public）**仓库，命名为：`my-shadowrocket-rules`。
2. 将本文件夹中的所有文件（`apple-wloc.module`、`wloc.js`、`wloc-settings.js`）上传/推送到该仓库中。
3. 确认你的文件结构和链接如下：
   - 模块地址：`https://raw.githubusercontent.com/YJTDW/my-shadowrocket-rules/main/apple-wloc.module`
   - 核心脚本：`https://raw.githubusercontent.com/YJTDW/my-shadowrocket-rules/main/wloc.js`
   - 设置脚本：`https://raw.githubusercontent.com/YJTDW/my-shadowrocket-rules/main/wloc-settings.js`

### 2. 小火箭配置方法
1. 打开小火箭 -> **配置** -> 右上角 **`+`** 号。
2. 粘贴你的专属云端模块链接：
   ```text
   https://raw.githubusercontent.com/YJTDW/my-shadowrocket-rules/main/apple-wloc.module
   ```
3. 下载后，在模块列表中勾选启用，并确保开启小火箭的 **HTTPS 解析 (MITM)** 并信任证书。

---

## 🔒 方案二：100% 纯本地运行版（完全防失效）

如果你不想使用 GitHub 仓库，或者希望在无网环境下也能稳定运行，可以使用纯本地版本。

### 1. 移动脚本到手机本地
1. 在电脑上，通过各种方式（如微信、AirDrop 等）将本文件夹中的 `wloc.js` 和 `wloc-settings.js` 发送到你的 iPhone。
2. 在 iPhone 上打开 **“文件” (Files) App**。
3. 进入 **“我的 iPhone” -> “Shadowrocket”** 文件夹。
4. 将 `wloc.js` 和 `wloc-settings.js` 复制/移动到该目录下。

### 2. 小火箭配置方法
1. 打开小火箭 -> **配置** -> **模块** -> 点击右上角 **`+`**。
2. 新建一个本地模块，将项目中的 `apple-wloc-local.module` 里面的文本内容完全复制并粘贴进去。
3. 保存并在模块列表中勾选启用。
4. 小火箭会自动读取本地 `Shadowrocket` 目录下的 `wloc.js` 和 `wloc-settings.js` 进行执行，实现 100% 本地化闭环。

---

## 🛠️ 配套辅助工具

无论使用云端版还是本地版，你都可以配合以下工具方便地调整虚拟定位：

* **快捷指令 (推荐)**
  - 📍 [设置虚拟位置](https://www.icloud.com/shortcuts/a82717d8fdad4e6280866fcf911173f7)：快速在手机中输入新坐标进行设置。
  - 🔄 [恢复真实位置](https://www.icloud.com/shortcuts/f42632d406504f24a2cd163af4fe012f)：一键清理缓存，还原为真实 GPS 定位。
* **网页可视化选点**
  - 🌐 [选点地图页面](https://wloc-pages.pages.dev/)：在地图上搜索或任意点击位置生成对应指令。
