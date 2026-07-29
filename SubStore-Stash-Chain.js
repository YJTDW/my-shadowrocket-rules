/**
 * Sub-Store File Script Operator
 *
 * 读取机场完整 Clash/Stash YAML，保留真实节点，并统一生成：
 * 1. 节点选择
 * 2. 链式前置自动选择
 * 3. 洛杉矶链式出口
 * 4. 🚀节点选择（三合一兼容入口）
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

const manualGroup = {
  name: "节点选择",
  type: "select",
  proxies: [...chainNames, ...airportNodes]
};

if (providers.length) manualGroup.use = providers;

const chainGroups = [];

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

  chainGroups.push({
    name: item.groupName,
    type: "select",
    proxies: [item.nodeName]
  });
}

// 统一策略组页面。机场原有的分组不再展示，但真实节点和远程代理集保留。
cfg["proxy-groups"] = [
  manualGroup,
  upstreamGroup,
  ...chainGroups,
  {
    name: "🚀节点选择",
    type: "select",
    proxies: ["节点选择"]
  }
];

// 保证未启用三合一时配置也有效；启用三合一后会由其完整规则覆盖。
cfg.rules = ["MATCH,🚀节点选择"];

$content = ProxyUtils.yaml.dump(cfg);
