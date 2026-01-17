"""
LiveHub Uploader - OAuth Handler
"""

import threading
import time
import webbrowser
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from typing import Optional, Callable

from config import LOCAL_CALLBACK_PORT


class OAuthCallbackHandler(BaseHTTPRequestHandler):
    """HTTP handler for OAuth callback."""
    
    token: Optional[str] = None
    
    def log_message(self, format, *args):
        pass  # Suppress logs
    
    def do_GET(self):
        parsed = urlparse(self.path)
        
        if parsed.path == "/callback":
            params = parse_qs(parsed.query)
            token = params.get("token", [None])[0]
            
            if token:
                OAuthCallbackHandler.token = token
                self._send_success_page()
            else:
                self._send_error_page()
        else:
            self.send_response(404)
            self.end_headers()
    
    def _send_success_page(self):
        self.send_response(200)
        self.send_header("Content-type", "text/html; charset=utf-8")
        self.end_headers()
        html = """
        <!DOCTYPE html>
        <html>
        <head>
            <title>LiveHub - Đăng nhập thành công</title>
            <style>
                body { font-family: -apple-system, sans-serif; display: flex; 
                       justify-content: center; align-items: center; height: 100vh;
                       margin: 0; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); }
                .card { background: #0f0f23; padding: 40px; border-radius: 20px; 
                        text-align: center; color: white; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
                h1 { color: #4ade80; margin-bottom: 20px; }
                p { color: #9ca3af; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>✓ Đăng nhập thành công!</h1>
                <p>Bạn có thể đóng tab này và quay lại ứng dụng.</p>
            </div>
        </body>
        </html>
        """
        self.wfile.write(html.encode())
    
    def _send_error_page(self):
        self.send_response(400)
        self.send_header("Content-type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(b"<h1>Loi: Khong tim thay token</h1>")


class OAuthManager:
    """Manages OAuth flow for desktop app."""
    
    def __init__(self):
        self.server: Optional[HTTPServer] = None
        self._token_received = threading.Event()
        self._received_token: Optional[str] = None
    
    def start_callback_server(self):
        """Start local server to receive OAuth callback."""
        OAuthCallbackHandler.token = None
        self._token_received.clear()
        self._received_token = None
        
        try:
            self.server = HTTPServer(("127.0.0.1", LOCAL_CALLBACK_PORT), OAuthCallbackHandler)
            self.server.timeout = 1
        except OSError as e:
            print(f"Failed to start callback server: {e}")
            return False
        
        def serve():
            while not self._token_received.is_set():
                try:
                    self.server.handle_request()
                    # Check if token was received
                    if OAuthCallbackHandler.token:
                        self._received_token = OAuthCallbackHandler.token
                        self._token_received.set()
                except:
                    pass
        
        threading.Thread(target=serve, daemon=True).start()
        return True
    
    def stop_callback_server(self):
        """Stop the callback server."""
        self._token_received.set()
        if self.server:
            try:
                self.server.socket.close()
            except:
                pass
            self.server = None
    
    def open_login(self, login_url: str):
        """Open browser with login URL."""
        webbrowser.open(login_url)
    
    def wait_for_token(self, timeout: int = 120) -> Optional[str]:
        """Wait for token from callback."""
        if self._token_received.wait(timeout=timeout):
            return self._received_token
        return None
    
    def login(self, login_url: str, on_success: Callable[[str], None], 
              on_error: Callable[[str], None], timeout: int = 120):
        """
        Perform OAuth login in background.
        """
        if not self.start_callback_server():
            on_error("Không thể khởi động server callback")
            return
        
        self.open_login(login_url)
        
        def wait():
            token = self.wait_for_token(timeout)
            self.stop_callback_server()
            
            if token:
                on_success(token)
            else:
                on_error("Đăng nhập hết thời gian. Vui lòng thử lại.")
        
        threading.Thread(target=wait, daemon=True).start()


# Global instance
oauth = OAuthManager()
