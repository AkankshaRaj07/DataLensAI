import pandas as pd
import numpy as np
import random
from datetime import datetime, timedelta

# Set random seed for reproducibility
np.random.seed(42)
random.seed(42)

# Configuration
NUM_ROWS = 2500

# Sample Data Pools
countries = ["United States", "United Kingdom", "Germany", "France", "Japan", "Australia", "Canada"]
regions_map = {
    "United States": ["North America"],
    "Canada": ["North America"],
    "United Kingdom": ["Europe"],
    "Germany": ["Europe"],
    "France": ["Europe"],
    "Japan": ["Asia"],
    "Australia": ["Oceania"]
}

categories = {
    "Electronics": ["Smartphone", "Laptop", "Headphones", "Tablet", "Smartwatch"],
    "Furniture": ["Office Chair", "Desk", "Bookshelf", "Sofa", "Dining Table"],
    "Clothing": ["T-Shirt", "Jeans", "Jacket", "Sneakers", "Sweater"],
    "Software": ["Antivirus", "Office Suite", "Cloud Storage", "Design Tool", "Video Editor"]
}

# Generate Data
data = []
start_date = datetime(2023, 1, 1)

for i in range(NUM_ROWS):
    order_id = f"ORD-{10000 + i}"
    country = random.choice(countries)
    region = regions_map[country][0]
    
    # Random date within a year
    date_offset = random.randint(0, 364)
    order_date = (start_date + timedelta(days=date_offset)).strftime("%Y-%m-%d")
    
    # Customer name logic
    first_names = ["John", "Sarah", "Michael", "Emma", "David", "Jessica", "James", "Emily", "Robert", "Olivia"]
    last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez"]
    customer = f"{random.choice(first_names)} {random.choice(last_names)}"
    
    # Product logic
    category = random.choice(list(categories.keys()))
    product = random.choice(categories[category])
    
    # Financial logic
    quantity = random.randint(1, 15)
    
    if category == "Electronics":
        base_price = random.uniform(150.0, 1200.0)
        profit_margin = random.uniform(0.1, 0.25)
    elif category == "Furniture":
        base_price = random.uniform(100.0, 800.0)
        profit_margin = random.uniform(0.15, 0.35)
    elif category == "Clothing":
        base_price = random.uniform(20.0, 150.0)
        profit_margin = random.uniform(0.3, 0.6)
    else:
        base_price = random.uniform(50.0, 300.0)
        profit_margin = random.uniform(0.5, 0.9)
        
    sales = round(base_price * quantity, 2)
    profit = round(sales * profit_margin, 2)
    
    # Inject a few intentional anomalies for the AI to detect!
    if random.random() < 0.01:  # 1% chance of anomaly
        if random.random() < 0.5:
            quantity = random.randint(100, 500) # Massive quantity
            sales = round(base_price * quantity, 2)
            profit = round(sales * profit_margin, 2)
        else:
            profit = -abs(round(sales * 0.8, 2)) # Massive loss
            
    data.append([
        order_id, order_date, customer, country, region, 
        category, product, quantity, sales, profit
    ])

# Create DataFrame
df = pd.DataFrame(data, columns=[
    "Order ID", "Order Date", "Customer Name", "Country", "Region", 
    "Category", "Product Name", "Quantity", "Sales ($)", "Profit ($)"
])

# Save to CSV
df.to_csv("ecommerce_sales_dataset.csv", index=False)
print("Successfully generated ecommerce_sales_dataset.csv with", NUM_ROWS, "rows!")
