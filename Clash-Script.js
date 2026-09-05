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

  // OpenAI 官方 chatgpt-voice.json 当前公布的 UDP 3478 IPv4 地址 (Article 9247338)
  const chatGptVoiceIpv4 = [
    "102.37.57.54/32",
    "13.71.25.29/32",
    "135.220.40.201/32",
    "172.203.39.49/32",
    "172.207.173.200/32",
    "172.214.226.198/32",
    "191.233.251.27/32",
    "20.162.96.163/32",
    "20.168.48.117/32",
    "20.184.36.134/32",
    "20.203.144.245/32",
    "20.74.221.21/32",
    "4.151.200.38/32",
    "4.155.146.196/32",
    "4.197.172.116/32",
    "4.217.235.100/32",
    "4.245.198.13/32",
    "40.118.236.137/32",
    "51.4.112.173/32",
    "52.143.181.161/32",
    "68.155.152.41/32",
    "72.146.20.246/32",
    "74.248.148.7/32"
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
      "*.local",
      "*.arpa",
      "localhost",
      "+.home.arpa",
      "time.*",
      "ntp.*",
      "+.pool.ntp.org",
      "*.apple.com",
      "*.apple.co",
      "*.appstore.com",
      "*.icloud.com",
      "*.icloud-content.com",
      "*.cdn-apple.com",
      "*.mzstatic.com",
      "*.aaplimg.com",
      "*.swcdn.apple.com",
      "*.me.com",
      "*.apple-cloudkit.com",
      "*.apple-livephotoskit.com",
      "*.apple-mapkit.com",
      "captive.apple.com",
      "*.wechat.com",
      "*.weixin.com",
      "*.servicewechat.com",
      "*.qq.com",
      "*.qpic.cn",
      "*.qlogo.cn",
      "*.gtimg.com",
      "*.cn",
      "*.xn--fiqs8s",
      "*.xn--fiqz9s",
      "*.xn--55qx5d",
      "*.qihangjiaoyu.com",
      "*.polyv.net",
      "*.polyv.cn",
      "*.alicdn.com",
      "*.msftncsi.com",
      "*.msftconnecttest.com"
    ],
    "use-hosts": true,
    "use-system-hosts": false,
    "respect-rules": true,
    "default-nameserver": ["223.5.5.5", "119.29.29.29"],
    "proxy-server-nameserver": ["223.5.5.5", "119.29.29.29"],
    "direct-nameserver": domesticDns,
    nameserver: domesticDns,
    "nameserver-policy": {
      "geosite:apple": domesticDns,
      "+.apple.com": domesticDns,
      "+.apple.co": domesticDns,
      "+.appstore.com": domesticDns,
      "+.icloud.com": domesticDns,
      "+.icloud-content.com": domesticDns,
      "+.cdn-apple.com": domesticDns,
      "+.mzstatic.com": domesticDns,
      "+.aaplimg.com": domesticDns,
      "+.me.com": domesticDns,
      "geosite:cn": domesticDns,
      "+.cn": domesticDns,
      "+.qq.com": domesticDns,
      "+.weixin.com": domesticDns,
      "+.wechat.com": domesticDns,
      "+.servicewechat.com": domesticDns,
      "+.qpic.cn": domesticDns,
      "+.qlogo.cn": domesticDns,
      "+.gtimg.com": domesticDns,
      "+.qihangjiaoyu.com": domesticDns,
      "+.polyv.net": domesticDns,
      "+.polyv.cn": domesticDns,
      "+.alicdn.com": domesticDns,
      "geosite:geolocation-!cn": foreignDns,
      "geosite:gfw": foreignDns,
      "geosite:google": foreignDns,
      "geosite:openai": foreignDns,
      "+.google.com": foreignDns,
      "+.googleapis.com": foreignDns,
      "+.googleusercontent.com": foreignDns,
      "+.openai.com": foreignDns,
      "+.chatgpt.com": foreignDns,
      "+.oaistatic.com": foreignDns,
      "+.oaiusercontent.com": foreignDns,
      "+.livekit.cloud": foreignDns
    }
  };
  delete config.dns.fallback;
  delete config.dns["fallback-filter"];
  delete config.dns["follow-rule"];

  config.tun = {
    ...(config.tun || {}),
    enable: true,
    stack: "mixed",
    "auto-route": true,
    "auto-detect-interface": true,
    "dns-hijack": ["any:53", "tcp://any:53"],
    "strict-route": true,
    mtu: 1500
  };

  config.rules = [
    // 0. 严格阻断 IPv6 旁路，与 sing-box 及 Stash 规则保持一致
    "IP-CIDR6,::/0,REJECT,no-resolve",

    // 1. 局域网与内网 UDP/TCP 绝对直连
    "DOMAIN-SUFFIX,local,DIRECT",
    "DOMAIN-SUFFIX,localhost,DIRECT",
    "DOMAIN-SUFFIX,lan,DIRECT",
    "DOMAIN-SUFFIX,home.arpa,DIRECT",
    "DOMAIN,captive.apple.com,DIRECT",
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
    `DOMAIN-SUFFIX,livekit.cloud,${proxyGroup}`,
    `DOMAIN-SUFFIX,o33249.ingest.sentry.io,${proxyGroup}`,
    `DOMAIN-SUFFIX,browser-intake-datadoghq.com,${proxyGroup}`,

    // 2. ChatGPT 官方高级实时语音 UDP 3478 专线 (Article 9247338 官方网段放行)
    ...chatGptVoiceIpv4.map(
      (prefix) =>
        `AND,((NETWORK,UDP),(DST-PORT,3478),(IP-CIDR,${prefix},no-resolve)),${proxyGroup}`
    ),

    // 3. 彻底阻断外部 WebRTC STUN/TURN 探测，防止真实公网 IP 旁路泄露 (对齐 sing-box 与 Stash 架构)
    "DST-PORT,3478,REJECT",
    "DST-PORT,3479,REJECT",
    "DST-PORT,3480,REJECT",
    "DST-PORT,3481,REJECT",
    "DST-PORT,19302,REJECT",
    "DST-PORT,19305,REJECT",
    "DST-PORT,5349,REJECT",
    "DOMAIN-KEYWORD,stun,REJECT",
    "DOMAIN-KEYWORD,turn,REJECT",
    "DOMAIN-SUFFIX,stun.l.google.com,REJECT",
    "DOMAIN-SUFFIX,stun1.l.google.com,REJECT",
    "DOMAIN-SUFFIX,stun2.l.google.com,REJECT",
    "DOMAIN-SUFFIX,stun3.l.google.com,REJECT",
    "DOMAIN-SUFFIX,stun4.l.google.com,REJECT",
    "DOMAIN-SUFFIX,stun.cloudflare.com,REJECT",

    // 4. 拦截 QUIC (UDP 443)，解决 YouTube/Google 旁路限速，强制走高性能 TCP TLS 1.3
    "AND,((NETWORK,UDP),(DST-PORT,443)),REJECT",

    // 5. 广告拦截与国内直连
    "GEOSITE,category-ads-all,REJECT",
    "DOMAIN-SUFFIX,cn,DIRECT",
    "GEOSITE,cn,DIRECT",
    `GEOSITE,geolocation-!cn,${proxyGroup}`,
    "GEOIP,CN,DIRECT,no-resolve",
    `MATCH,${proxyGroup}`
  ];

  return config;
}
