import os
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()
genai.configure(api_key=os.environ.get("GEMINI_API_KEY", ""))

try:
    model = genai.GenerativeModel('gemini-1.5-flash-latest')
    response = model.generate_content("Hello")
    print("latest:", response.text)
except Exception as e:
    print("latest error:", e)

try:
    model = genai.GenerativeModel('gemini-pro')
    response = model.generate_content("Hello")
    print("pro:", response.text)
except Exception as e:
    print("pro error:", e)
