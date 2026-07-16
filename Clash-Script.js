function main(config, profileName) {
  const groups = Array.isArray(config["proxy-groups"])
    ? config["proxy-groups"]
    : [];

  const preferredGroups = [
    "🚀节点选择",
    "宝可梦",
    "🐟漏网之鱼",
    "PROXY",
    "Proxy"
  ];

  const groupNames = new Set(groups.map((group) => group.name));
  const fallbackGroup = groups.find((group) =>
    ["select", "url-test", "fallback", "load-balance"].includes(group.type)
  );
  const proxyGroup =
    preferredGroups.find((name) => groupNames.has(name)) || fallbackGroup?.name;

  if (!proxyGroup) {
    throw new Error(`No usable proxy group found for ${profileName || "profile"}`);
  }

  // A chained SOCKS5 proxy must explicitly allow UDP in Mihomo. If its
  // upstream server does not implement UDP ASSOCIATE, the UDP guard in the
  // rules below rejects the traffic instead of silently leaking via DIRECT.
  const proxies = Array.isArray(config.proxies) ? config.proxies : [];
  for (const proxy of proxies) {
    if (proxy.type === "socks5" && proxy["dialer-proxy"]) {
      proxy.udp = true;
    }
  }

  const domesticDns = [
    "https://dns.alidns.com/dns-query",
    "https://doh.pub/dns-query"
  ];
  const foreignDns = [
    `https://1.1.1.1/dns-query#${proxyGroup}`,
    `https://8.8.8.8/dns-query#${proxyGroup}`
  ];

  config.ipv6 = false;
  config["tcp-concurrent"] = true;
  config["unified-delay"] = true;

  config.dns = {
    ...(config.dns || {}),
    enable: true,
    listen: "127.0.0.1:1053",
    ipv6: false,
    "cache-algorithm": "arc",
    "enhanced-mode": "fake-ip",
    "fake-ip-range": "198.18.0.1/16",
    "fake-ip-filter-mode": "blacklist",
    "fake-ip-filter": [
      "*.lan",
      "+.local",
      "+.localhost",
      "+.home.arpa",
      "time.*.com",
      "time.*.gov",
      "time.*.edu.cn",
      "time.*.apple.com",
      "time1.*.com",
      "time2.*.com",
      "time3.*.com",
      "time4.*.com",
      "time5.*.com",
      "time6.*.com",
      "time7.*.com",
      "ntp.*.com",
      "ntp1.*.com",
      "ntp2.*.com",
      "ntp3.*.com",
      "ntp4.*.com",
      "ntp5.*.com",
      "ntp6.*.com",
      "ntp7.*.com",
      "+.msftconnecttest.com",
      "+.msftncsi.com"
    ],
    "use-hosts": true,
    "use-system-hosts": false,
    "respect-rules": true,
    "default-nameserver": ["223.5.5.5", "119.29.29.29"],
    "proxy-server-nameserver": ["223.5.5.5", "119.29.29.29"],
    "direct-nameserver": domesticDns,
    nameserver: domesticDns,
    "nameserver-policy": {
      "geosite:cn": domesticDns,
      "geosite:geolocation-!cn": foreignDns
    }
  };
  delete config.dns.fallback;
  delete config.dns["fallback-filter"];
  delete config.dns["follow-rule"];

  config.tun = {
    ...(config.tun || {}),
    enable: true,
    stack: "gvisor",
    "auto-route": true,
    "auto-detect-interface": true,
    "dns-hijack": ["any:53", "tcp://any:53"],
    "strict-route": true,
    mtu: 1500
  };

  config.rules = [
    "DOMAIN-SUFFIX,local,DIRECT",
    "DOMAIN-SUFFIX,localhost,DIRECT",
    "DOMAIN-SUFFIX,lan,DIRECT",
    "DOMAIN-SUFFIX,home.arpa,DIRECT",
    "IP-CIDR,0.0.0.0/8,DIRECT,no-resolve",
    "IP-CIDR,10.0.0.0/8,DIRECT,no-resolve",
    "IP-CIDR,100.64.0.0/10,DIRECT,no-resolve",
    "IP-CIDR,127.0.0.0/8,DIRECT,no-resolve",
    "IP-CIDR,169.254.0.0/16,DIRECT,no-resolve",
    "IP-CIDR,172.16.0.0/12,DIRECT,no-resolve",
    "IP-CIDR,192.168.0.0/16,DIRECT,no-resolve",
    "IP-CIDR,224.0.0.0/4,DIRECT,no-resolve",
    // === OpenAI / ChatGPT / Sora / Codex 核心与周边服务 ===
    `DOMAIN-SUFFIX,chatgpt.com,${proxyGroup}`,
    `DOMAIN-SUFFIX,openai.com,${proxyGroup}`,
    `DOMAIN-SUFFIX,chat.com,${proxyGroup}`,
    `DOMAIN-SUFFIX,sora.com,${proxyGroup}`,
    `DOMAIN-SUFFIX,oaistatic.com,${proxyGroup}`,
    `DOMAIN-SUFFIX,oaiusercontent.com,${proxyGroup}`,
    `DOMAIN-SUFFIX,crixet.com,${proxyGroup}`,
    `DOMAIN-SUFFIX,client-api.arkoselabs.com,${proxyGroup}`,
    `DOMAIN,openai-api.arkoselabs.com,${proxyGroup}`,
    `DOMAIN-SUFFIX,chatgpt.livekit.cloud,${proxyGroup}`,
    `DOMAIN-SUFFIX,host.livekit.cloud,${proxyGroup}`,
    `DOMAIN-SUFFIX,turn.livekit.cloud,${proxyGroup}`,
    `DOMAIN-SUFFIX,o33249.ingest.sentry.io,${proxyGroup}`,
    `DOMAIN-SUFFIX,browser-intake-datadoghq.com,${proxyGroup}`,
    // The current chained SOCKS5 exit has no working UDP transport. Reject
    // QUIC immediately so browsers switch to chained TCP without a timeout.
    "AND,((NETWORK,udp),(DST-PORT,443)),REJECT",
    // All public UDP (including WebRTC/STUN) must use the selected chain.
    // If the selected proxy cannot carry UDP, Mihomo continues to the next
    // matching rule and rejects it; it must never fall back to DIRECT.
    `NETWORK,udp,${proxyGroup}`,
    "NETWORK,udp,REJECT",
    "GEOSITE,category-ads-all,REJECT",
    "DOMAIN-SUFFIX,cn,DIRECT",
    "GEOSITE,cn,DIRECT",
    `GEOSITE,geolocation-!cn,${proxyGroup}`,
    "GEOIP,CN,DIRECT,no-resolve",
    `MATCH,${proxyGroup}`
  ];

  return config;
}
