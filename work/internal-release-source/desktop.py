"""课值 Windows 桌面启动器：后台本地服务 + 系统默认浏览器。"""

from urllib.request import urlopen
import json
import os
import threading
import time
import webbrowser

import server as backend


APP_NAME = "课值"
APP_VERSION = "1.0.0-rc1"


def existing_service(url):
    try:
        with urlopen(f"{url}/api/health", timeout=1.2) as response:
            return json.loads(response.read().decode("utf-8")).get("service") == APP_NAME
    except Exception:
        return False


def controller(url, owned_server=None):
    import tkinter as tk
    from tkinter import messagebox

    root = tk.Tk()
    root.title(f"{APP_NAME} {APP_VERSION}")
    root.geometry("450x235")
    root.resizable(False, False)
    root.configure(bg="#f4f1e8")

    try:
        icon = tk.PhotoImage(file=str(backend.ROOT / "app-logo.png"))
        root.iconphoto(True, icon)
        root._tutor_value_icon = icon
    except Exception:
        pass

    tk.Label(root, text="课值正在运行", font=("Microsoft YaHei UI", 20, "bold"), bg="#f4f1e8", fg="#173a30").pack(pady=(30, 8))
    message = "页面已使用系统默认浏览器打开。\n推荐使用 Chrome 或 Edge；关闭本窗口可停止本地服务。" if owned_server else "检测到课值服务已经运行。\n页面已使用系统默认浏览器打开，推荐 Chrome 或 Edge。"
    tk.Label(root, text=message, font=("Microsoft YaHei UI", 10), bg="#f4f1e8", fg="#708078", justify="center").pack()

    def close():
        prompt = "确定停止课值本地服务吗？" if owned_server else "确定关闭此控制窗口吗？"
        if messagebox.askokcancel("退出课值", prompt):
            root.destroy()

    actions = tk.Frame(root, bg="#f4f1e8")
    actions.pack(pady=22)
    open_page = lambda: webbrowser.open(url, new=1) if os.environ.get("TV_NO_BROWSER") != "1" else None
    tk.Button(actions, text="打开课值", command=open_page, width=13, bg="#1e5a45", fg="white", relief="flat").pack(side="left", padx=8)
    tk.Button(actions, text="退出", command=close, width=10, relief="flat").pack(side="left", padx=8)

    root.protocol("WM_DELETE_WINDOW", close)
    open_page()
    auto_close = os.environ.get("TV_AUTOCLOSE_SECONDS")
    if auto_close:
        root.after(max(100, int(float(auto_close) * 1000)), root.destroy)
    root.mainloop()
    if owned_server:
        owned_server.shutdown()


def main():
    url = f"http://{backend.HOST}:{backend.PORT}"
    server = None
    try:
        server = backend.ThreadingHTTPServer((backend.HOST, backend.PORT), backend.Handler)
    except OSError:
        if not existing_service(url):
            from tkinter import messagebox
            messagebox.showerror("课值无法启动", f"本机端口 {backend.PORT} 已被其他程序占用，请关闭占用程序后重试。")
            return 1

    if server:
        thread = threading.Thread(target=server.serve_forever, name="TutorValueServer", daemon=True)
        thread.start()
        deadline = time.monotonic() + 4
        while time.monotonic() < deadline and not existing_service(url):
            time.sleep(0.05)

    if os.environ.get("TV_HEADLESS") == "1":
        time.sleep(max(0.2, float(os.environ.get("TV_AUTOCLOSE_SECONDS", "2"))))
        if server:
            server.shutdown()
            server.server_close()
        return 0

    controller(url, server)
    if server:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
