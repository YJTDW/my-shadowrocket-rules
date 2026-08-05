/**
 * Sub-Store File Script Operator
 *
 * 读取机场完整 Clash/Stash YAML，先收集真实节点，再彻底删除机场原有
 * 策略组，最后统一生成：
 * 1. 🚀节点选择（三合一兼容入口）
 * 2. 节点选择
 * 3. ♻️自动选择（同时作为固定出口的链式前置）
 * 4. 一个或多个静态 SOCKS5 链式出口
 */

// ===== 静态出口列表 =====
// 每个出口使用一次 push；以后复制整个 push 块即可，不需要处理对象之间的逗号。
const staticExits = [];

staticExits.push({
  nodeName: "🇺🇸洛杉矶固定出口",
  groupName: "🔗洛杉矶链式出口",
  type: "socks5",
  server: "207.97.139.109",
  port: 443,
  username: "fXaEWJpRKeAp",
  password: "eTzA9SVbZ1",
  udp: true
});

staticExits.push({
  nodeName: "SOCKS5 70.39.254.81:443",
  groupName: "🔗SOCKS5 70.39.254.81:443 链式出口",
  type: "socks5",
  server: "70.39.254.81",
  port: 443,
  username: "UmZexcBEiCfQ",
  password: "2tErwHd2kn",
  udp: true
});

function validateStaticExits(exits) {
  const requiredStringFields = [
    "nodeName",
    "groupName",
    "type",
    "server",
    "username",
    "password"
  ];
  const reservedNames = new Set([
    "🚀节点选择",
    "节点选择",
    "♻️自动选择",
    "DIRECT",
    "REJECT"
  ]);
  const nodeNames = new Set();
  const groupNames = new Set();

  exits.forEach((item, index) => {
    const label = `静态出口 ${index + 1}`;

    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`${label} 不是有效对象`);
    }

    for (const field of requiredStringFields) {
      if (typeof item[field] !== "string" || !item[field].trim()) {
        throw new Error(`${label} 缺少有效的 ${field}`);
      }
    }

    if (item.type !== "socks5") {
      throw new Error(`${label} 的 type 必须是 socks5`);
    }

    if (!Number.isInteger(item.port) || item.port < 1 || item.port > 65535) {
      throw new Error(`${label} 的 port 必须是 1-65535 的整数`);
    }

    if (reservedNames.has(item.nodeName) || reservedNames.has(item.groupName)) {
      throw new Error(`${label} 使用了保留名称`);
    }

    if (item.nodeName === item.groupName) {
      throw new Error(`${label} 的 nodeName 和 groupName 不能相同`);
    }

    if (nodeNames.has(item.nodeName)) {
      throw new Error(`静态节点名称重复：${item.nodeName}`);
    }

    if (groupNames.has(item.groupName)) {
      throw new Error(`静态策略组名称重复：${item.groupName}`);
    }

    nodeNames.add(item.nodeName);
    groupNames.add(item.groupName);
  });
}

validateStaticExits(staticExits);

const raw =
  (typeof $content !== "undefined" && $content) ||
  (typeof $files !== "undefined" && $files && $files[0]);
if (!raw) {
  throw new Error(
    "没有读取到完整文件内容：请在文件（File）的 Script Operator 中使用本脚本"
  );
}

if (
  typeof ProxyUtils === "undefined" ||
  !ProxyUtils.yaml ||
  typeof ProxyUtils.yaml.safeLoad !== "function" ||
  typeof ProxyUtils.yaml.dump !== "function"
) {
  throw new Error("当前运行环境不支持 ProxyUtils.yaml，请使用 Sub-Store 文件脚本操作器");
}

let cfg;
try {
  cfg = ProxyUtils.yaml.safeLoad(raw);
} catch (error) {
  throw new Error(
    `输入不是有效的 Clash/Stash YAML：${error && error.message ? error.message : error}`
  );
}

if (!cfg || typeof cfg !== "object") {
  throw new Error(
    "输入不是完整 Clash/Stash YAML；不要使用 GitHub blob 页面或 URI/Base64 节点列表"
  );
}

cfg.proxies = Array.isArray(cfg.proxies) ? cfg.proxies : [];

// 有些机场会使用不同拼法保存策略组。先全部读取，后面统一删除。
const oldGroups = [
  ...(Array.isArray(cfg["proxy-groups"]) ? cfg["proxy-groups"] : []),
  ...(Array.isArray(cfg.proxy_groups) ? cfg.proxy_groups : []),
  ...(Array.isArray(cfg["policy-groups"]) ? cfg["policy-groups"] : []),
  ...(Array.isArray(cfg.policy_groups) ? cfg.policy_groups : [])
].filter((group) => group && typeof group === "object");

const upstreamName = "♻️自动选择";
const exitNames = staticExits.map((item) => item.nodeName);
const chainNames = staticExits.map((item) => item.groupName);

cfg.proxies = cfg.proxies.filter(
  (proxy) =>
    proxy &&
    typeof proxy === "object" &&
    !exitNames.includes(proxy.name)
);

const infoPattern = /剩余|流量|套餐|到期|重置|官网|客服/;
const realProxyNames = cfg.proxies
  .map((proxy) => proxy && proxy.name)
  .filter((name) => name && !infoPattern.test(name));
const realProxySet = new Set(realProxyNames);

// 先按机场原策略组中的顺序收集真实节点，再补齐没有出现在策略组里的节点。
// 策略组名、DIRECT/REJECT 等内建策略不会被误当成节点。
const referencedNodes = oldGroups.flatMap((group) =>
  Array.isArray(group.proxies) ? group.proxies : []
);
const airportNodes = [
  ...new Set([
    ...referencedNodes.filter((name) => realProxySet.has(name)),
    ...realProxyNames
  ])
];

const providers = Object.keys(cfg["proxy-providers"] || {});

if (!airportNodes.length && !providers.length) {
  throw new Error("没有找到可作为链式前置的机场节点");
}

const upstreamGroup = {
  name: upstreamName,
  type: "url-test",
  url: "http://www.gstatic.com/generate_204",
  interval: 900,
  lazy: true,
  tolerance: 100
};

if (airportNodes.length) upstreamGroup.proxies = airportNodes;
if (providers.length) upstreamGroup.use = providers;

const manualGroup = {
  name: "节点选择",
  type: "select",
  interval: -1
};

if (airportNodes.length) manualGroup.proxies = airportNodes;
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
    interval: -1,
    proxies: [item.nodeName]
  });
}

// 硬重建：彻底删除所有可能的旧策略组字段及不再使用的子规则，
// 避免策略组很多的机场把旧分组重新带回结果。
delete cfg["proxy-groups"];
delete cfg.proxy_groups;
delete cfg["policy-groups"];
delete cfg.policy_groups;
delete cfg["sub-rules"];

cfg["proxy-groups"] = [
  {
    name: "🚀节点选择",
    type: "select",
    interval: -1,
    proxies: ["节点选择", upstreamName, ...chainNames, "DIRECT"]
  },
  manualGroup,
  upstreamGroup,
  ...chainGroups
];

// 保证未启用三合一时配置也有效；启用三合一后会由其完整规则覆盖。
cfg.rules = ["MATCH,🚀节点选择"];

$content = ProxyUtils.yaml.dump(cfg);

$content = ProxyUtils.yaml.dump(cfg);

