"""课值本地服务器：静态页面 + 百度/高德地图 Web API 安全代理。"""

from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
import json
import os
import sys
import threading
import time
import webbrowser

ROOT = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
HOST = "127.0.0.1"
PORT = int(os.environ.get("TV_PORT", "8765"))
APP_VERSION = "1.0.0-rc1"
MAX_BODY = 64 * 1024
BAIDU_GEOCODE = "https://api.map.baidu.com/geocoding/v3/"
BAIDU_DRIVING = "https://api.map.baidu.com/direction/v2/driving"
AMAP_GEOCODE = "https://restapi.amap.com/v3/geocode/geo"
AMAP_DRIVING = "https://restapi.amap.com/v5/direction/driving"
AMAP_TRANSIT = "https://restapi.amap.com/v5/direction/transit/integrated"
AMAP_BICYCLING = "https://restapi.amap.com/v5/direction/bicycling"
AMAP_ELECTROBIKE = "https://restapi.amap.com/v5/direction/electrobike"
REQUEST_INTERVAL_SECONDS = 0.36
REQUEST_LOCK = threading.Lock()
GEOCODE_LOCK = threading.Lock()
GEOCODE_CACHE = {}
LAST_REQUEST_AT = 0.0


class ApiError(Exception):
    pass


def fetch_json(url: str, params: dict, service_name: str = "地图服务") -> dict:
    global LAST_REQUEST_AT
    request = Request(
        f"{url}?{urlencode(params)}",
        headers={"User-Agent": "TutorValue/1.0 local-app"},
    )
    try:
        with REQUEST_LOCK:
            remaining = REQUEST_INTERVAL_SECONDS - (time.monotonic() - LAST_REQUEST_AT)
            if remaining > 0:
                time.sleep(remaining)
            with urlopen(request, timeout=18) as response:
                payload = json.loads(response.read().decode("utf-8"))
            LAST_REQUEST_AT = time.monotonic()
            return payload
    except HTTPError as exc:
        raise ApiError(f"{service_name}请求失败（HTTP {exc.code}）") from exc
    except URLError as exc:
        reason = str(getattr(exc, "reason", "网络连接失败"))
        if len(reason) > 120:
            reason = reason[:117] + "..."
        raise ApiError(f"无法连接{service_name}：{reason}。请检查网络、代理或防火墙后重试") from exc
    except json.JSONDecodeError as exc:
        raise ApiError(f"{service_name}返回了无法识别的数据") from exc


def baidu_error(payload: dict, fallback: str) -> None:
    if payload.get("status") not in (0, "0"):
        message = payload.get("message") or payload.get("msg") or fallback
        raise ApiError(f"{message}（状态码 {payload.get('status', '未知')}）")


def baidu_geocode(address: str, city: str, ak: str) -> dict:
    query_address = address if city in address else f"{city}{address}"
    payload = fetch_json(
        BAIDU_GEOCODE,
        {
            "address": query_address,
            "city": city,
            "output": "json",
            "ret_coordtype": "bd09ll",
            "extension_analys_level": "1",
            "ak": ak,
        },
        "百度地图",
    )
    baidu_error(payload, "地址解析失败")
    result = payload.get("result") or {}
    location = result.get("location") or {}
    if not isinstance(location.get("lat"), (int, float)) or not isinstance(location.get("lng"), (int, float)):
        raise ApiError(f"无法定位地址：{address}")
    return {
        "lat": location["lat"],
        "lng": location["lng"],
        "confidence": result.get("confidence"),
        "comprehension": result.get("comprehension"),
        "level": result.get("level") or result.get("analys_level") or "未知",
    }


def baidu_driving(origin: dict, destination: dict, ak: str, require_taxi: bool = True) -> dict:
    payload = fetch_json(
        BAIDU_DRIVING,
        {
            "origin": f"{origin['lat']:.6f},{origin['lng']:.6f}",
            "destination": f"{destination['lat']:.6f},{destination['lng']:.6f}",
            "coord_type": "bd09ll",
            "ret_coordtype": "bd09ll",
            "tactics": "0",
            "alternatives": "0",
            "ak": ak,
        },
        "百度地图",
    )
    baidu_error(payload, "驾车路线计算失败")
    routes = (payload.get("result") or {}).get("routes") or []
    if not routes:
        raise ApiError("百度地图没有返回可用的驾车路线")
    route = routes[0]
    taxi_fee = route.get("taxi_fee")
    if require_taxi and (taxi_fee in (None, "") or float(taxi_fee) <= 0):
        raise ApiError("路线已返回，但百度地图没有提供有效打车费（返回值为空或为 0）")
    return {
        "distanceMeters": int(float(route.get("distance") or 0)),
        "durationSeconds": int(float(route.get("duration") or 0)),
        "taxiFee": float(taxi_fee or 0),
        "toll": float(route.get("toll") or 0),
        "tag": route.get("tag") or "百度推荐",
    }


def amap_error(payload: dict, fallback: str) -> None:
    if str(payload.get("status")) != "1":
        message = payload.get("info") or fallback
        code = payload.get("infocode") or "未知"
        raise ApiError(f"{message}（高德状态码 {code}）")


def amap_geocode(address: str, city: str, key: str) -> dict:
    query_address = address if city in address else f"{city}{address}"
    payload = fetch_json(
        AMAP_GEOCODE,
        {"address": query_address, "city": city, "output": "JSON", "key": key},
        "高德地图",
    )
    amap_error(payload, "地址解析失败")
    geocodes = payload.get("geocodes") or []
    if not geocodes:
        raise ApiError(f"高德地图无法定位地址：{address}")
    result = geocodes[0]
    try:
        lng_text, lat_text = str(result.get("location") or "").split(",", 1)
        lng, lat = float(lng_text), float(lat_text)
    except (ValueError, TypeError) as exc:
        raise ApiError(f"高德地图无法定位地址：{address}") from exc
    return {
        "lat": lat,
        "lng": lng,
        "confidence": None,
        "comprehension": None,
        "level": result.get("level") or "未知",
        "formattedAddress": result.get("formatted_address") or query_address,
        "citycode": result.get("citycode") or "",
        "adcode": result.get("adcode") or "",
    }


def amap_driving(origin: dict, destination: dict, key: str, require_taxi: bool = True) -> dict:
    payload = fetch_json(
        AMAP_DRIVING,
        {
            "origin": f"{origin['lng']:.6f},{origin['lat']:.6f}",
            "destination": f"{destination['lng']:.6f},{destination['lat']:.6f}",
            "show_fields": "cost",
            "key": key,
        },
        "高德地图",
    )
    amap_error(payload, "驾车路线计算失败")
    route = payload.get("route") or {}
    paths = route.get("paths") or []
    if not paths:
        raise ApiError("高德地图没有返回可用的驾车路线")
    path = paths[0]
    cost = path.get("cost") or {}
    taxi_fee = route.get("taxi_cost")
    if require_taxi and (taxi_fee in (None, "") or float(taxi_fee) <= 0):
        raise ApiError("路线已返回，但高德地图没有提供有效打车费（返回值为空或为 0）")
    return {
        "distanceMeters": int(float(path.get("distance") or 0)),
        "durationSeconds": int(float(cost.get("duration") or path.get("duration") or 0)),
        "taxiFee": float(taxi_fee or 0),
        "toll": float(cost.get("tolls") or path.get("tolls") or 0),
        "tag": "高德推荐",
    }


def amap_cycling(origin: dict, destination: dict, key: str, electric: bool = False) -> dict:
    endpoint = AMAP_ELECTROBIKE if electric else AMAP_BICYCLING
    mode_name = "电单车" if electric else "自行车"
    payload = fetch_json(
        endpoint,
        {
            "origin": f"{origin['lng']:.6f},{origin['lat']:.6f}",
            "destination": f"{destination['lng']:.6f},{destination['lat']:.6f}",
            "show_fields": "cost",
            "alternative_route": "1",
            "key": key,
        },
        "高德地图",
    )
    amap_error(payload, f"{mode_name}路线计算失败")
    paths = (payload.get("route") or {}).get("paths") or []
    if not paths:
        raise ApiError(f"高德地图没有返回可用的{mode_name}路线")
    path = paths[0]
    cost = path.get("cost") or {}
    duration = cost.get("duration") or path.get("duration") or 0
    distance = path.get("distance") or 0
    if float(duration or 0) <= 0 or float(distance or 0) <= 0:
        raise ApiError(f"高德地图返回的{mode_name}距离或时长无效")
    return {
        "distanceMeters": int(float(distance)),
        "durationSeconds": int(float(duration)),
        "taxiFee": 0.0,
        "toll": 0.0,
        "tag": f"高德{mode_name}推荐",
    }


def _as_list(value):
    if isinstance(value, list):
        return value
    if isinstance(value, dict):
        return [value]
    return []


def _citycode(value) -> str:
    if isinstance(value, list):
        return str(value[0]) if value else ""
    return str(value or "")


def amap_transit(origin: dict, destination: dict, key: str) -> dict:
    city1, city2 = _citycode(origin.get("citycode")), _citycode(destination.get("citycode"))
    if not city1 or not city2:
        raise ApiError("高德地理编码没有返回公交查询所需的城市代码，请补充更具体的同城地址")
    payload = fetch_json(
        AMAP_TRANSIT,
        {
            "origin": f"{origin['lng']:.6f},{origin['lat']:.6f}",
            "destination": f"{destination['lng']:.6f},{destination['lat']:.6f}",
            "city1": city1,
            "city2": city2,
            "strategy": "0",
            "AlternativeRoute": "1",
            "show_fields": "cost",
            "key": key,
        },
        "高德地图",
    )
    amap_error(payload, "公交路线计算失败")
    transits = (payload.get("route") or {}).get("transits") or []
    if not transits:
        raise ApiError("高德地图没有返回可用的公交路线")
    transit = transits[0]
    legs, walking_meters = [], 0
    for segment in _as_list(transit.get("segments")):
        walking = segment.get("walking") or {}
        walking_meters += int(float(walking.get("distance") or 0))
        bus = segment.get("bus") or {}
        buslines = _as_list(bus.get("buslines") or bus.get("busline"))
        if buslines:
            line = buslines[0]
            legs.append({
                "line": str(line.get("name") or "公交线路"),
                "departureStop": str((line.get("departure_stop") or {}).get("name") or "上车站待确认"),
                "arrivalStop": str((line.get("arrival_stop") or {}).get("name") or "下车站待确认"),
            })
        railway = segment.get("railway") or {}
        if railway and railway.get("name"):
            legs.append({
                "line": str(railway.get("name") or "轨道交通"),
                "departureStop": str((railway.get("departure_stop") or {}).get("name") or "上车站待确认"),
                "arrivalStop": str((railway.get("arrival_stop") or {}).get("name") or "下车站待确认"),
            })
    if not legs:
        raise ApiError("公交方案中没有可识别的乘车线路或站台")
    cost = transit.get("cost") or {}
    duration = cost.get("duration") or transit.get("duration") or 0
    distance = transit.get("distance") or 0
    if float(duration or 0) <= 0 or float(distance or 0) <= 0:
        raise ApiError("高德地图返回的公交距离或时长无效")
    return {
        "distanceMeters": int(float(distance)),
        "durationSeconds": int(float(duration)),
        "taxiFee": 0.0,
        "toll": 0.0,
        "tag": "高德公交推荐",
        "boardings": len(legs),
        "transfers": max(0, len(legs) - 1),
        "walkingMeters": walking_meters,
        "transitLegs": legs,
    }


def shared_ebike_round_trip_cost(one_way_seconds: int) -> float:
    minutes = max(0.0, float(one_way_seconds) / 60)
    extra_blocks = max(0, int((minutes - 10 + 9.999999) // 10))
    return round((2 + extra_blocks * 1.5) * 2, 2)


def bicycle_round_trip_cost(one_way_meters: int) -> float:
    kilometers = max(0.0, float(one_way_meters) / 1000)
    water_units = max(1, int((kilometers + 4.999999) // 5))
    one_way_cost = water_units * 5 + (10 if kilometers >= 10 else 0)
    return round(one_way_cost * 2, 2)


def cached_geocode(provider: str, address: str, city: str, key: str) -> dict:
    cache_key = (provider, city.strip(), address.strip())
    with GEOCODE_LOCK:
        cached = GEOCODE_CACHE.get(cache_key)
    if cached:
        return dict(cached)
    result = amap_geocode(address, city, key) if provider == "amap" else baidu_geocode(address, city, key)
    with GEOCODE_LOCK:
        GEOCODE_CACHE[cache_key] = dict(result)
    return result


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        # 只记录访问路径；请求正文和地图密钥永不写入日志。
        print(f"[{self.log_date_time_string()}] {self.command} {self.path.split('?')[0]}")

    def send_json(self, status: int, payload: dict):
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/api/health":
            return self.send_json(200, {"ok": True, "service": "课值", "version": APP_VERSION, "providers": ["baidu", "amap"], "travelModes": ["taxi", "transit", "ebike", "bicycle", "free"]})
        return super().do_GET()

    def do_POST(self):
        if self.path != "/api/route":
            return self.send_json(404, {"ok": False, "error": "接口不存在"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_BODY:
                raise ApiError("请求内容为空或过大")
            body = json.loads(self.rfile.read(length).decode("utf-8"))
            travel_mode = str(body.get("travelMode") or "taxi").strip().lower()
            if travel_mode not in {"taxi", "transit", "ebike", "bicycle", "free"}:
                raise ApiError("不支持的出行方式")
            provider = str(body.get("provider") or "baidu").strip().lower()
            if provider not in {"baidu", "amap"}:
                raise ApiError("不支持的地图服务商")
            if travel_mode in {"transit", "ebike", "bicycle"} and provider != "amap":
                raise ApiError("公交、共享电单车和自行车路线需要使用高德地图 Web 服务 Key")
            key = str(body.get("key") or body.get("ak") or "").strip()
            origin_address = str(body.get("origin") or "").strip()
            destination_address = str(body.get("destination") or "").strip()
            city = str(body.get("city") or "嘉兴市").strip()
            provider_name = "高德地图" if provider == "amap" else "百度地图"
            if len(key) < 8:
                key_label = "Web 服务 Key" if provider == "amap" else "服务端 AK"
                raise ApiError(f"请先在设置中填写有效的{provider_name}{key_label}")
            if not origin_address or not destination_address:
                raise ApiError("出发点或目的地为空")
            if len(origin_address) > 128 or len(destination_address) > 128 or len(city) > 30:
                raise ApiError("地址内容过长")

            origin = cached_geocode(provider, origin_address, city, key)
            destination = cached_geocode(provider, destination_address, city, key)
            if travel_mode == "transit":
                outbound = amap_transit(origin, destination, key)
                inbound = {**outbound, "tag": "按去程折算返程", "estimated": True}
            elif travel_mode == "ebike":
                outbound = amap_cycling(origin, destination, key, electric=True)
                inbound = {**outbound, "tag": "按去程折算返程", "estimated": True}
            elif travel_mode == "bicycle":
                outbound = amap_cycling(origin, destination, key, electric=False)
                inbound = {**outbound, "tag": "按去程折算返程", "estimated": True}
            elif provider == "amap":
                # 个人低额度模式：高德只请求一次单程路线，往返按两倍折算。
                outbound = amap_driving(origin, destination, key, require_taxi=travel_mode == "taxi")
                inbound = {**outbound, "tag": "按去程折算返程", "estimated": True}
            else:
                outbound = baidu_driving(origin, destination, key, require_taxi=travel_mode == "taxi")
                inbound = baidu_driving(destination, origin, key, require_taxi=travel_mode == "taxi")
            if travel_mode == "taxi":
                travel_cost = round(outbound["taxiFee"] + inbound["taxiFee"], 2)
            elif travel_mode == "transit":
                travel_cost = float(outbound["boardings"] * 2 * 2)
            elif travel_mode == "ebike":
                travel_cost = shared_ebike_round_trip_cost(outbound["durationSeconds"])
            elif travel_mode == "bicycle":
                travel_cost = bicycle_round_trip_cost(outbound["distanceMeters"])
            else:
                travel_cost = 0.0
            estimated_round_trip = provider == "amap" or travel_mode in {"transit", "ebike", "bicycle"}
            self.send_json(
                200,
                {
                    "ok": True,
                    "provider": provider,
                    "providerName": provider_name,
                    "travelMode": travel_mode,
                    "roundTripEstimated": estimated_round_trip,
                    "origin": origin,
                    "destination": destination,
                    "outbound": outbound,
                    "inbound": inbound,
                    "roundTrip": {
                        "distanceMeters": outbound["distanceMeters"] + inbound["distanceMeters"],
                        "durationSeconds": outbound["durationSeconds"] + inbound["durationSeconds"],
                        "taxiFee": round(outbound["taxiFee"] + inbound["taxiFee"], 2),
                        "travelCost": travel_cost,
                        "toll": round(outbound["toll"] + inbound["toll"], 2),
                    },
                    "transit": {
                        "boardingsOneWay": outbound.get("boardings", 0),
                        "transfersOneWay": outbound.get("transfers", 0),
                        "walkingMetersOneWay": outbound.get("walkingMeters", 0),
                        "legs": outbound.get("transitLegs", []),
                    } if travel_mode == "transit" else None,
                },
            )
        except (ApiError, ValueError, json.JSONDecodeError) as exc:
            self.send_json(400, {"ok": False, "error": str(exc)})
        except Exception:
            self.send_json(500, {"ok": False, "error": "本地服务发生错误，请稍后重试"})


if __name__ == "__main__":
    os.chdir(ROOT)
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    url = f"http://{HOST}:{PORT}"
    print(f"课值已启动：{url}")
    print("群聊数据保存在浏览器本地；按 Ctrl+C 停止。")
    if "--no-browser" not in sys.argv and os.environ.get("TV_NO_BROWSER") != "1":
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n课值已停止。")
    finally:
        server.server_close()
