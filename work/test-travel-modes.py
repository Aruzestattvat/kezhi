import importlib.util
from pathlib import Path


SERVER_PATH = Path(__file__).resolve().parent / "internal-release-source" / "server.py"
spec = importlib.util.spec_from_file_location("tutor_value_server", SERVER_PATH)
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)


assert server.shared_ebike_round_trip_cost(10 * 60) == 4
assert server.shared_ebike_round_trip_cost(10 * 60 + 1) == 7
assert server.shared_ebike_round_trip_cost(20 * 60) == 7
assert server.shared_ebike_round_trip_cost(20 * 60 + 1) == 10

assert server.bicycle_round_trip_cost(4_900) == 10
assert server.bicycle_round_trip_cost(5_100) == 20
assert server.bicycle_round_trip_cost(10_000) == 40


def fake_fetch_json(url, params, service_name="地图服务"):
    assert url == server.AMAP_TRANSIT
    assert params["city1"] == "0573" and params["city2"] == "0573"
    return {
        "status": "1",
        "route": {
            "transits": [{
                "distance": "8000",
                "cost": {"duration": "2400"},
                "segments": [
                    {
                        "walking": {"distance": "300"},
                        "bus": {"buslines": [{
                            "name": "1路(甲--乙)",
                            "departure_stop": {"name": "甲站"},
                            "arrival_stop": {"name": "乙站"},
                        }]},
                    },
                    {
                        "walking": {"distance": "120"},
                        "bus": {"buslines": [{
                            "name": "2路(乙--丙)",
                            "departure_stop": {"name": "乙站"},
                            "arrival_stop": {"name": "丙站"},
                        }]},
                    },
                ],
            }],
        },
    }


server.fetch_json = fake_fetch_json
route = server.amap_transit(
    {"lng": 120.7, "lat": 30.7, "citycode": "0573"},
    {"lng": 120.8, "lat": 30.8, "citycode": "0573"},
    "test-key-123456",
)
assert route["boardings"] == 2
assert route["transfers"] == 1
assert route["walkingMeters"] == 420
assert route["durationSeconds"] == 2400
assert route["transitLegs"][0]["departureStop"] == "甲站"
assert route["transitLegs"][1]["arrivalStop"] == "丙站"

print("TRAVEL_MODE_SERVER_RULES_OK")
