import os
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()
genai.configure(api_key=os.environ.get("GEMINI_API_KEY", ""))

try:
    model = genai.GenerativeModel('gemini-3.8-flash')
    response = model.generate_content("Hello")
    print("3.8-flash:", response.text)
except Exception as e:
    print("3.8-flash error:", e)
