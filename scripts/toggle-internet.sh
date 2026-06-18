#!/usr/bin/env bash
set -euo pipefail

# Toggle internet sharing from WAN (default: wlan0) to LAN (default: eth0).
# This is useful when KinQuest devices connect on eth0 and you want to
# temporarily allow internet access for tile downloading.

ACTION="${1:-status}"
LAN_IF="${2:-eth0}"
WAN_IF="${3:-wlan0}"

if [[ "$ACTION" != "on" && "$ACTION" != "off" && "$ACTION" != "status" ]]; then
  echo "Usage: $0 {on|off|status} [LAN_IF] [WAN_IF]"
  echo "Example: $0 on eth0 wlan0"
  exit 1
fi

if [[ "$EUID" -ne 0 ]]; then
  if command -v sudo >/dev/null 2>&1; then
    exec sudo "$0" "$@"
  fi
  echo "Please run as root (or install sudo)."
  exit 1
fi

if ! command -v iptables >/dev/null 2>&1; then
  echo "iptables is required but not installed."
  exit 1
fi

if ! ip link show "$LAN_IF" >/dev/null 2>&1; then
  echo "LAN interface '$LAN_IF' not found."
  exit 1
fi

if ! ip link show "$WAN_IF" >/dev/null 2>&1; then
  echo "WAN interface '$WAN_IF' not found."
  exit 1
fi

nat_rule_exists() {
  iptables -t nat -C POSTROUTING -o "$WAN_IF" -j MASQUERADE >/dev/null 2>&1
}

fwd_out_rule_exists() {
  iptables -C FORWARD -i "$LAN_IF" -o "$WAN_IF" -j ACCEPT >/dev/null 2>&1
}

fwd_return_rule_exists() {
  iptables -C FORWARD -i "$WAN_IF" -o "$LAN_IF" -m state --state RELATED,ESTABLISHED -j ACCEPT >/dev/null 2>&1
}

print_status() {
  local ipf
  ipf="$(cat /proc/sys/net/ipv4/ip_forward)"
  echo "ip_forward=$ipf"
  if nat_rule_exists; then
    echo "NAT: enabled ($LAN_IF -> $WAN_IF)"
  else
    echo "NAT: disabled ($LAN_IF -> $WAN_IF)"
  fi

  if fwd_out_rule_exists && fwd_return_rule_exists; then
    echo "Forwarding rules: enabled"
  else
    echo "Forwarding rules: disabled"
  fi
}

case "$ACTION" in
  on)
    sysctl -w net.ipv4.ip_forward=1 >/dev/null

    if ! nat_rule_exists; then
      iptables -t nat -A POSTROUTING -o "$WAN_IF" -j MASQUERADE
    fi

    if ! fwd_out_rule_exists; then
      iptables -A FORWARD -i "$LAN_IF" -o "$WAN_IF" -j ACCEPT
    fi

    if ! fwd_return_rule_exists; then
      iptables -A FORWARD -i "$WAN_IF" -o "$LAN_IF" -m state --state RELATED,ESTABLISHED -j ACCEPT
    fi

    echo "Internet sharing enabled: $LAN_IF -> $WAN_IF"
    print_status
    ;;
  off)
    while nat_rule_exists; do
      iptables -t nat -D POSTROUTING -o "$WAN_IF" -j MASQUERADE
    done

    while fwd_out_rule_exists; do
      iptables -D FORWARD -i "$LAN_IF" -o "$WAN_IF" -j ACCEPT
    done

    while fwd_return_rule_exists; do
      iptables -D FORWARD -i "$WAN_IF" -o "$LAN_IF" -m state --state RELATED,ESTABLISHED -j ACCEPT
    done

    sysctl -w net.ipv4.ip_forward=0 >/dev/null
    echo "Internet sharing disabled: $LAN_IF -> $WAN_IF"
    print_status
    ;;
  status)
    print_status
    ;;
esac
