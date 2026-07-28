/*
 * Stash dynamic two-stage chain selector.
 *
 * Required local persistent data:
 *   stash_chain_api_key     Stash API key from More Settings
 *
 * Optional local persistent data:
 *   stash_chain_controller  Defaults to http://127.0.0.1:9090
 *
 * The API key is intentionally never stored in the public YAML/GitHub files.
 */

const SETTINGS = {
  controller:
    $persistentStore.read("stash_chain_controller") ||
    "http://127.0.0.1:9090",
  apiKey: $persistentStore.read("stash_chain_api_key") || "",
  frontGroup: "🎛链式前置选择",
  autoGroup: "⚡前置延迟自动",
  exitProxy: "🏁洛杉矶固定出口",
  delayUrl: "http://www.apple.com/library/test/success.html",
  speedUrl: "https://speed.cloudflare.com/__down",
  latencyConcurrency: 12,
  finalistCount: 5,
  warmupBytes: 32768,
  sampleBytes: 393216,
  switchDelayMs: 350,
  switchThreshold: 1.12,
};

const RESULT_KEY = "stash_chain_speedtest_result";
const LOCK_KEY = "stash_chain_speedtest_lock";
const RUN_ID = `${Date.now()}-${Math.random()}`;

function acquireLock() {
  try {
    const lock = JSON.parse($persistentStore.read(LOCK_KEY) || "{}");
    if (
      lock.id &&
      Number.isFinite(Number(lock.time)) &&
      Date.now() - Number(lock.time) < 180000
    ) {
      return false;
    }
  } catch (_) {
    // An invalid or expired lock is safe to replace.
  }
  return $persistentStore.write(
    JSON.stringify({ id: RUN_ID, time: Date.now() }),
    LOCK_KEY
  );
}

function releaseLock() {
  try {
    const lock = JSON.parse($persistentStore.read(LOCK_KEY) || "{}");
    if (lock.id === RUN_ID) {
      $persistentStore.write("", LOCK_KEY);
    }
  } catch (_) {
    $persistentStore.write("", LOCK_KEY);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function responseStatus(response) {
  return Number(
    (response && (response.status || response.statusCode)) || 0
  );
}

function dataBytes(data) {
  if (data === null || data === undefined) return 0;
  if (typeof data.byteLength === "number") return data.byteLength;
  if (typeof data.length === "number") return data.length;
  if (typeof data === "string") return data.length;
  return 0;
}

function request(method, options) {
  return new Promise((resolve, reject) => {
    const callback = (error, response, data) => {
      const status = responseStatus(response);
      if (error) {
        reject(new Error(String(error)));
        return;
      }
      if (status >= 400) {
        reject(new Error(`HTTP ${status}`));
        return;
      }
      resolve({ response, data });
    };

    const fn = $httpClient[method];
    if (typeof fn !== "function") {
      reject(new Error(`Unsupported HTTP method: ${method}`));
      return;
    }
    fn(options, callback);
  });
}

function apiHeaders() {
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (SETTINGS.apiKey) {
    headers.Authorization = `Bearer ${SETTINGS.apiKey}`;
  }
  return headers;
}

async function api(method, path, body, timeout) {
  const options = {
    url: `${SETTINGS.controller}${path}`,
    headers: apiHeaders(),
    timeout: timeout || 5,
    "auto-redirect": true,
  };
  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }
  const result = await request(method, options);
  if (!result.data) return {};
  if (typeof result.data === "object") return result.data;
  try {
    return JSON.parse(result.data);
  } catch (_) {
    return {};
  }
}

function isRealCandidate(name) {
  if (!name || typeof name !== "string") return false;
  if (
    [
      SETTINGS.autoGroup,
      SETTINGS.frontGroup,
      SETTINGS.exitProxy,
      "DIRECT",
      "REJECT",
      "REJECT-DROP",
      "PASS",
      "GLOBAL",
    ].includes(name)
  ) {
    return false;
  }
  return !/(剩余|剩餘|流量|到期|过期|過期|官网|官網|网址|網址|套餐|重置|公告|通知|客服|订阅|訂閱|Traffic|Expire|Website)/i.test(
    name
  );
}

async function getFrontGroup() {
  const path = `/proxies/${encodeURIComponent(SETTINGS.frontGroup)}`;
  const group = await api("get", path);
  const all = Array.isArray(group.all) ? group.all : [];
  return {
    current: typeof group.now === "string" ? group.now : "",
    candidates: all.filter(isRealCandidate),
  };
}

async function selectFront(name) {
  const path = `/proxies/${encodeURIComponent(SETTINGS.frontGroup)}`;
  await api("put", path, { name });
}

async function testDelay(name) {
  const path =
    `/proxies/${encodeURIComponent(name)}/delay` +
    `?url=${encodeURIComponent(SETTINGS.delayUrl)}&timeout=5000`;
  const started = Date.now();
  try {
    const payload = await api("get", path, undefined, 5);
    const delay = Number(payload.delay);
    return {
      name,
      delay:
        Number.isFinite(delay) && delay > 0
          ? delay
          : Math.max(1, Date.now() - started),
    };
  } catch (_) {
    return { name, delay: Infinity };
  }
}

async function mapLimit(items, limit, worker) {
  const output = new Array(items.length);
  let cursor = 0;

  async function run() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      output[index] = await worker(items[index], index);
    }
  }

  const workers = [];
  const count = Math.min(limit, items.length);
  for (let i = 0; i < count; i += 1) {
    workers.push(run());
  }
  await Promise.all(workers);
  return output;
}

async function downloadSample(bytes) {
  const nonce = `${Date.now()}-${Math.random()}`;
  const started = Date.now();
  const result = await request("get", {
    url: `${SETTINGS.speedUrl}?bytes=${bytes}&nonce=${encodeURIComponent(
      nonce
    )}`,
    headers: {
      "X-Stash-Selected-Proxy": encodeURIComponent(SETTINGS.exitProxy),
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
    timeout: 5,
    "binary-mode": true,
    "auto-cookie": false,
    "auto-redirect": true,
  });
  const elapsedMs = Math.max(1, Date.now() - started);
  const received = dataBytes(result.data);
  if (received < Math.floor(bytes * 0.8)) {
    throw new Error(`short download: ${received}/${bytes}`);
  }
  return {
    elapsedMs,
    mbps: (received * 8) / (elapsedMs / 1000) / 1000000,
  };
}

async function testFullChain(candidate) {
  await selectFront(candidate.name);
  await sleep(SETTINGS.switchDelayMs);

  try {
    const warmup = await downloadSample(SETTINGS.warmupBytes);
    const first = await downloadSample(SETTINGS.sampleBytes);
    const second = await downloadSample(SETTINGS.sampleBytes);
    const speed = (first.mbps + second.mbps) / 2;
    const stability =
      Math.min(first.mbps, second.mbps) /
      Math.max(first.mbps, second.mbps);
    return {
      name: candidate.name,
      directDelay: candidate.delay,
      responseMs: warmup.elapsedMs,
      speed,
      stability: Number.isFinite(stability) ? stability : 0,
      ok: true,
    };
  } catch (error) {
    return {
      name: candidate.name,
      directDelay: candidate.delay,
      responseMs: Infinity,
      speed: 0,
      stability: 0,
      ok: false,
      error: String(error),
    };
  }
}

function scoreResults(results) {
  const successful = results.filter(
    (item) =>
      item.ok &&
      item.speed > 0 &&
      Number.isFinite(item.directDelay) &&
      Number.isFinite(item.responseMs)
  );
  if (!successful.length) return [];

  const maxSpeed = Math.max(...successful.map((item) => item.speed));
  const minLatency = Math.min(
    ...successful.map(
      (item) => item.directDelay * 0.7 + item.responseMs * 0.3
    )
  );

  return successful
    .map((item) => {
      const effectiveLatency =
        item.directDelay * 0.7 + item.responseMs * 0.3;
      const speedScore = (item.speed / maxSpeed) * 60;
      const latencyScore = (minLatency / effectiveLatency) * 25;
      const stabilityScore = item.stability * 15;
      return {
        ...item,
        effectiveLatency,
        score: speedScore + latencyScore + stabilityScore,
      };
    })
    .sort((a, b) => b.score - a.score);
}

function chooseWinner(ranked, current) {
  const best = ranked[0];
  const currentResult = ranked.find((item) => item.name === current);
  if (
    currentResult &&
    best.name !== current &&
    best.score < currentResult.score * SETTINGS.switchThreshold
  ) {
    return currentResult;
  }
  return best;
}

function finish(title, content, color, notify) {
  releaseLock();
  if (notify) {
    $notification.post(title, "", content);
  }
  $done({
    title,
    content,
    icon: "gauge.with.dots.needle.67percent",
    backgroundColor: color || "#2563EB",
  });
}

async function main() {
  if (!acquireLock()) {
    $done({
      title: "链式测速正在进行",
      content: "请等待当前测速完成，避免两次测速互相抢占带宽。",
      icon: "gauge.with.dots.needle.67percent",
      backgroundColor: "#D97706",
    });
    return;
  }

  let group;
  try {
    group = await getFrontGroup();
  } catch (error) {
    const authHint = SETTINGS.apiKey
      ? "请确认控制器地址和 API 密钥是否正确"
      : "请先在脚本持久化数据中填写 stash_chain_api_key";
    finish("链式测速未启动", `${authHint}\n${String(error)}`, "#DC2626", true);
    return;
  }

  if (!group.candidates.length) {
    finish(
      "没有可测速节点",
      "机场订阅尚未更新，或节点名称均被识别为状态文字。",
      "#DC2626",
      true
    );
    return;
  }

  const delays = await mapLimit(
    group.candidates,
    SETTINGS.latencyConcurrency,
    testDelay
  );
  const finalists = delays
    .filter((item) => Number.isFinite(item.delay))
    .sort((a, b) => a.delay - b.delay)
    .slice(0, SETTINGS.finalistCount);

  if (!finalists.length) {
    finish(
      "节点均不可用",
      `已检查 ${group.candidates.length} 个节点，没有通过延迟初筛。`,
      "#DC2626",
      true
    );
    return;
  }

  const fullChainResults = [];
  for (const candidate of finalists) {
    fullChainResults.push(await testFullChain(candidate));
  }

  const ranked = scoreResults(fullChainResults);
  if (!ranked.length) {
    await selectFront(SETTINGS.autoGroup);
    finish(
      "真实测速失败",
      "已恢复为延迟自动选择。请检查固定洛杉矶出口是否可用。",
      "#D97706",
      true
    );
    return;
  }

  const winner = chooseWinner(ranked, group.current);
  await selectFront(winner.name);

  const saved = {
    time: new Date().toISOString(),
    winner: winner.name,
    speedMbps: Number(winner.speed.toFixed(2)),
    directDelayMs: Math.round(winner.directDelay),
    responseMs: Math.round(winner.responseMs),
    score: Number(winner.score.toFixed(2)),
    tested: group.candidates.length,
    finalists: ranked.slice(0, 3).map((item) => ({
      name: item.name,
      speedMbps: Number(item.speed.toFixed(2)),
      directDelayMs: Math.round(item.directDelay),
      score: Number(item.score.toFixed(2)),
    })),
  };
  $persistentStore.write(JSON.stringify(saved), RESULT_KEY);

  finish(
    "链式测速完成",
    `${winner.name}\n${winner.speed.toFixed(1)} Mbps · ${
      Math.round(winner.directDelay)
    } ms\n${group.candidates.length} 个节点 → ${finalists.length} 个实测`,
    "#16A34A",
    true
  );
}

main().catch((error) => {
  finish("链式测速异常", String(error), "#DC2626", true);
});
