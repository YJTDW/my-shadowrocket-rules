#!/usr/bin/env python3
"""Generate an opt-in Stash smart-exit override from the current airport config."""

from __future__ import annotations

import argparse
import re
from pathlib import Path

import requests
import yaml


DEFAULT_SUBSCRIPTION_URL = (
    "https://dash.pqjc.site/api/v1/pq/92528fda166b6184854b1bceb8739374"
)
MAIN_GROUP = "🚀节点选择"
SMART_GROUP = "🚀智能出口"
FRONT_GROUP = "🎛智能链前置"
AUTO_GROUP = "⚡智能链低延迟"
EXIT_PROXY = "🏁智能链固定落地"
SCRIPT_NAME = "智能出口综合测速"
STATUS_PATTERN = re.compile(
    r"(剩余|剩餘|流量|到期|过期|過期|官网|官網|网址|網址|套餐|"
    r"重置|公告|通知|客服|订阅|訂閱|Traffic|Expire|Website)",
    re.IGNORECASE,
)


class StashDumper(yaml.SafeDumper):
    """Keep Unicode readable and avoid YAML aliases."""

    def ignore_aliases(self, data):  # type: ignore[override]
        return True


def fetch_config(url: str) -> dict:
    response = requests.get(
        url,
        headers={
            "User-Agent": "Stash/3.4.0",
            "Accept": "application/yaml,text/yaml,text/plain,*/*",
        },
        timeout=30,
    )
    response.raise_for_status()
    data = yaml.safe_load(response.text)
    if not isinstance(data, dict):
        raise ValueError("Subscription did not return a YAML mapping")
    return data


def real_proxy_names(config: dict) -> list[str]:
    names: list[str] = []
    seen: set[str] = set()
    for proxy in config.get("proxies", []):
        if not isinstance(proxy, dict):
            continue
        name = proxy.get("name")
        if not isinstance(name, str) or not name or STATUS_PATTERN.search(name):
            continue
        if name not in seen:
            seen.add(name)
            names.append(name)
    if not names:
        raise ValueError("No usable airport proxies were found")
    return names


def original_groups(config: dict) -> list[dict]:
    groups = config.get("proxy-groups", [])
    if not isinstance(groups, list):
        raise ValueError("proxy-groups is not a list")

    output: list[dict] = []
    found_main = False
    reserved = {SMART_GROUP, FRONT_GROUP, AUTO_GROUP}
    for raw_group in groups:
        if not isinstance(raw_group, dict):
            continue
        group = dict(raw_group)
        name = group.get("name")
        if name in reserved:
            continue
        members = [
            item
            for item in group.get("proxies", [])
            if isinstance(item, str) and not STATUS_PATTERN.search(item)
        ]
        if "proxies" in group:
            group["proxies"] = members
        if name == MAIN_GROUP:
            found_main = True
            members = [item for item in members if item != SMART_GROUP]
            group["proxies"] = [SMART_GROUP, *members]
        output.append(group)

    if not found_main:
        raise ValueError(f'Airport config has no "{MAIN_GROUP}" group')
    return output


def build_override(config: dict) -> dict:
    nodes = real_proxy_names(config)
    groups = original_groups(config)
    groups.extend(
        [
            {
                "name": SMART_GROUP,
                "type": "select",
                "proxies": [EXIT_PROXY],
            },
            {
                "name": FRONT_GROUP,
                "type": "select",
                "proxies": [AUTO_GROUP, *nodes],
            },
            {
                "name": AUTO_GROUP,
                "type": "url-test",
                "url": "http://www.apple.com/library/test/success.html",
                "interval": 300,
                "tolerance": 50,
                "lazy": False,
                "proxies": nodes,
            },
        ]
    )

    script_argument = (
        '{"frontGroup":"'
        + FRONT_GROUP
        + '","autoGroup":"'
        + AUTO_GROUP
        + '","exitProxy":"'
        + EXIT_PROXY
        + '","triggerGroup":"'
        + MAIN_GROUP
        + '","triggerValue":"'
        + SMART_GROUP
        + '"}'
    )

    return {
        "name": "智能出口（仅在节点选择中启用）",
        "desc": (
            "保留机场原有策略；仅当“🚀节点选择”选中“🚀智能出口”时，"
            "才启用优选前置与洛杉矶固定出口。"
        ),
        "author": "YJTDW",
        "homepage": "https://github.com/YJTDW/my-shadowrocket-rules",
        "date": "2026-07-28",
        "version": "2.0.0",
        "external-controller": "127.0.0.1:9090",
        "proxies": [
            {
                "name": EXIT_PROXY,
                "type": "socks5",
                "server": "207.97.139.109",
                "port": 443,
                "username": "fXaEWJpRKeAp",
                "password": "eTzA9SVbZ1",
                "udp": True,
                "dialer-proxy": FRONT_GROUP,
                "benchmark-url": (
                    "http://www.apple.com/library/test/success.html"
                ),
                "benchmark-timeout": 5,
            }
        ],
        "proxy-groups": groups,
        "script-providers": {
            SCRIPT_NAME: {
                "url": (
                    "https://raw.githubusercontent.com/YJTDW/"
                    "my-shadowrocket-rules/main/Stash-Chain-Auto-Speed.js"
                ),
                "interval": 86400,
                "headers": {
                    "Accept": "application/javascript,text/plain,*/*"
                },
            }
        },
        "tiles": [
            {
                "name": SCRIPT_NAME,
                "interval": 21600,
                "argument": script_argument,
                "title": "智能出口等待启用",
                "content": "先在节点选择中选中智能出口",
                "icon": "gauge.with.dots.needle.67percent",
                "backgroundColor": "#2563EB",
            }
        ],
        "cron": {
            "script": [
                {
                    "name": SCRIPT_NAME,
                    "cron": "5 */6 * * *",
                    "argument": script_argument,
                    "timeout": 180,
                }
            ]
        },
    }


def render(data: dict) -> str:
    body = yaml.dump(
        data,
        Dumper=StashDumper,
        allow_unicode=True,
        sort_keys=False,
        default_flow_style=False,
        width=1000,
    )
    body = body.replace("proxy-groups:\n", "proxy-groups: #!replace\n", 1)
    header = (
        "# Generated opt-in Stash smart-exit override.\n"
        "# Do not edit the generated proxy-groups by hand.\n"
        "# The outer node-selection group is never switched by this override.\n\n"
    )
    return header + body


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--subscription-url",
        default=DEFAULT_SUBSCRIPTION_URL,
    )
    parser.add_argument(
        "--output",
        default="Stash-Universal-Speed-Chain.stoverride",
    )
    args = parser.parse_args()

    config = fetch_config(args.subscription_url)
    output = Path(args.output)
    output.write_text(render(build_override(config)), encoding="utf-8")


if __name__ == "__main__":
    main()
