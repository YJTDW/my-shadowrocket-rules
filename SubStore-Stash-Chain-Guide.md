# Sub-Store Stash 通用链式配置

脚本直链：

`https://raw.githubusercontent.com/YJTDW/my-shadowrocket-rules/main/SubStore-Stash-Chain.js`

## 使用

1. 在 Stash 中打开 Sub-Store。
2. 新建 `File`，`Type` 选择 `File`。
3. `Source` 选择 `Remote`，粘贴机场完整 Clash/Stash YAML 订阅地址。
4. 添加 `Script Operator`，选择远程脚本并填入上面的脚本直链；也可以粘贴脚本全文。
5. 点击 `Preview`，确认策略组按顺序只有：
   - `节点选择`
   - `⚡链式前置自动选择`
   - `🔗洛杉矶链式出口`
   - `🚀节点选择`
6. 保存文件，复制生成的文件链接，作为完整配置导入 Stash。
7. 独立启用 `Stash-All-in-One.stoverride`，继续使用三合一防泄露与分流。

工作路线：

`设备 -> 自动选择的机场前置节点 -> 静态出口 -> Internet`

只有在第一个“节点选择”中选中链式出口时，才会启用链路。选择普通机场节点时不会经过静态出口。

## 新增静态出口

编辑脚本顶部的 `staticExits` 数组，复制已有对象并修改节点名称、策略组名称、类型、服务器、端口、用户名和密码。每个静态出口都会自动使用链式前置，并加入机场原有的“节点选择”。

脚本适用于包含标准 `proxies` 或 `proxy-providers` 的 Clash/Stash YAML，不再依赖机场原有策略组的名称。

处理时会先从机场全部旧策略组中识别真实节点，然后彻底删除
`proxy-groups`、`proxy_groups`、`policy-groups` 和 `policy_groups`
等旧策略组字段，再从零生成下面 4 个策略组。机场原有策略组不会保留。

无论机场原来叫 `Kitty Network`、`Proxy`、`节点选择` 或其他名称，策略组页面都会统一为：

1. `节点选择`
2. `⚡链式前置自动选择`
3. `🔗洛杉矶链式出口`
4. `🚀节点选择`

最后一个是三合一兼容入口，只指向第一个“节点选择”，平时不需要操作。
