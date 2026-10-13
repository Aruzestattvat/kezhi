import importlib.util
from pathlib import Path

server_path = Path(__file__).resolve().parent / "internal-release-source" / "server.py"
spec = importlib.util.spec_from_file_location("tutor_server", server_path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def fake_fetch(url, params, service_name="地图服务"):
    if "geocode/geo" in url:
        assert params["key"] == "test-key-12345678"
        return {
            "status": "1",
            "infocode": "10000",
            "geocodes": [{
                "location": "120.750000,30.750000",
                "level": "兴趣点",
                "formatted_address": "浙江省嘉兴市测试地点",
            }],
        }
    if "direction/driving" in url:
        assert params["show_fields"] == "cost"
        return {
            "status": "1",
            "infocode": "10000",
            "route": {
                "taxi_cost": "22.5",
                "paths": [{"distance": "12345", "cost": {"duration": "1800", "tolls": "0"}}],
            },
        }
    raise AssertionError(url)


module.fetch_json = fake_fetch
key = "test-key-12345678"
origin = module.amap_geocode("嘉兴大学梁林校区", "嘉兴市", key)
destination = module.amap_geocode("嘉报广场", "嘉兴市", key)
route = module.amap_driving(origin, destination, key)

assert origin["lng"] == 120.75 and origin["lat"] == 30.75
assert route["taxiFee"] == 22.5
assert route["distanceMeters"] == 12345
assert route["durationSeconds"] == 1800
print("AMAP_GEOCODE_AND_ROUTE_OK")
