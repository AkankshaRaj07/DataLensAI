import requests

response = requests.post(
    "http://localhost:8001/chat",
    json={"message": "Hello", "table_schemas": []}
)
print(response.status_code)
print(response.json())
