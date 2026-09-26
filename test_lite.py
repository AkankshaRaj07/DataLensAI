import os
import time
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()
genai.configure(api_key=os.environ.get("GEMINI_API_KEY", ""))

try:
    model = genai.GenerativeModel('gemini-flash-lite-latest')
    response = model.generate_content("Hello")
    print("lite:", response.text)
except Exception as e:
    print("error:", e)
