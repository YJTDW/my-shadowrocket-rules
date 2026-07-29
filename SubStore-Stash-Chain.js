/**
 * Sub-Store File Script Operator
 *
 * 读取机场完整 Clash/Stash YAML，建立自动前置与静态出口，
 * 并把链式出口加入机场原有的“节点选择”。
 */

// ===== 静态出口列表：以后新增出口只需要复制一个对象 =====
const staticExits = [
  {
    nodeName: "🇺🇸洛杉矶固定出口",
    groupName: "🔗洛杉矶链式出口",
    type: "socks5",
    server: "207.97.139.109",
    port: 443,
    username: "fXaEWJpRKeAp",
    password: "eTzA9SVbZ1",
    udp: true
  }

  // 新增 SOCKS5 静态出口示例：
  // ,
  // {
  //   nodeName: "🇺🇸静态出口02",
  //   groupName: "🔗静态出口02链式出口",
  //   type: "socks5",
  //   server: "服务器地址",
  //   port: 443,
  //   username: "用户名",
  //   password: "密码",
  //   udp: true
  // }
];

const raw = $content || ($files && $files[0]);
if (!raw) throw new Error("没有读取到机场配置");

const cfg = ProxyUtils.yaml.safeLoad(raw);
if (!cfg || typeof cfg !== "object") {
  throw new Error("机场返回的内容不是有效 YAML");
}

cfg.proxies = Array.isArray(cfg.proxies) ? cfg.proxies : [];
cfg["proxy-groups"] = Array.isArray(cfg["proxy-groups"])
  ? cfg["proxy-groups"]
  : [];

const upstreamName = "⚡链式前置自动选择";
const exitNames = staticExits.map((item) => item.nodeName);
const chainNames = staticExits.map((item) => item.groupName);

cfg.proxies = cfg.proxies.filter((proxy) => !exitNames.includes(proxy.name));
cfg["proxy-groups"] = cfg["proxy-groups"].filter(
  (group) =>
    group.name !== upstreamName && !chainNames.includes(group.name)
);

// 优先读取 MATCH/FINAL 实际指向的策略组，因此主策略组可以叫
// “Kitty Network”“Proxy”或机场自定义的其他名称。
const finalPolicyName = [...(Array.isArray(cfg.rules) ? cfg.rules : [])]
  .reverse()
  .map((rule) => {
    if (typeof rule !== "string") return null;
    const parts = rule.split(",").map((part) => part.trim());
    return /^(MATCH|FINAL)$/i.test(parts[0] || "") ? parts[1] : null;
  })
  .find(Boolean);

const selectGroups = cfg["proxy-groups"].filter(
  (group) => group && group.type === "select"
);

const mainGroup =
  cfg["proxy-groups"].find((group) => group.name === finalPolicyName) ||
  cfg["proxy-groups"].find((group) => group.name === "🚀节点选择") ||
  cfg["proxy-groups"].find((group) => group.name === "节点选择") ||
  selectGroups.find(
    (group) =>
      typeof group.name === "string" && /节点选择/.test(group.name)
  ) ||
  selectGroups[0];

if (!mainGroup) {
  throw new Error("没有找到机场原有的“节点选择”策略组");
}

const infoPattern = /剩余|流量|套餐|到期|重置|官网|客服/;
const airportNodes = cfg.proxies
  .map((proxy) => proxy.name)
  .filter((name) => name && !infoPattern.test(name));

const providers = Object.keys(cfg["proxy-providers"] || {});

if (!airportNodes.length && !providers.length) {
  throw new Error("没有找到可作为链式前置的机场节点");
}

const upstreamGroup = {
  name: upstreamName,
  type: "url-test",
  url: "http://www.gstatic.com/generate_204",
  interval: 300,
  tolerance: 100
};

if (airportNodes.length) upstreamGroup.proxies = airportNodes;
if (providers.length) upstreamGroup.use = providers;

cfg["proxy-groups"].push(upstreamGroup);

for (const item of staticExits) {
  cfg.proxies.push({
    name: item.nodeName,
    type: item.type,
    server: item.server,
    port: item.port,
    username: item.username,
    password: item.password,
    udp: item.udp,
    "dialer-proxy": upstreamName
  });

  cfg["proxy-groups"].push({
    name: item.groupName,
    type: "select",
    proxies: [item.nodeName]
  });
}

mainGroup.proxies = Array.isArray(mainGroup.proxies)
  ? mainGroup.proxies.filter((name) => !chainNames.includes(name))
  : [];

mainGroup.proxies.unshift(...chainNames);

// 三合一规则固定使用“🚀节点选择”。当机场的主策略组使用其他名称时，
// 自动建立兼容入口，避免更换机场后出现 policy not found。
if (
  mainGroup.name !== "🚀节点选择" &&
  !cfg["proxy-groups"].some((group) => group.name === "🚀节点选择")
) {
  cfg["proxy-groups"].push({
    name: "🚀节点选择",
    type: "select",
    proxies: [mainGroup.name]
  });
}

$content = ProxyUtils.yaml.dump(cfg);
