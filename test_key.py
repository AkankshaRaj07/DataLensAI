import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
api_key = os.environ.get("GEMINI_API_KEY", "")
print("Using Key:", api_key[:10] + "...")
genai.configure(api_key=api_key)

try:
    model = genai.GenerativeModel("gemini-3.8-flash")
    print(model.generate_content("hello").text)
except Exception as e:
    print("Error:", e)
