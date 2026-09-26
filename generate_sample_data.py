import pandas as pd
import numpy as np
import os

os.makedirs("sample_data", exist_ok=True)

# Generate Clean CSV (5000+ rows)
np.random.seed(42)
n_rows = 5000
clean_df = pd.DataFrame({
    'id': range(1, n_rows + 1),
    'date': pd.date_range(start='2023-01-01', periods=n_rows),
    'category': np.random.choice(['Electronics', 'Clothing', 'Home', 'Toys'], n_rows),
    'price': np.round(np.random.uniform(10.0, 500.0, n_rows), 2),
    'quantity': np.random.randint(1, 10, n_rows)
})
clean_df['total_sales'] = clean_df['price'] * clean_df['quantity']
clean_df.to_csv("sample_data/clean_sales_data.csv", index=False)

# Generate Messy CSV (with anomalies and nulls)
n_messy = 500
messy_df = pd.DataFrame({
    'id': range(1, n_messy + 1),
    'date': pd.date_range(start='2023-01-01', periods=n_messy),
    'category': np.random.choice(['Electronics', 'Clothing', 'Home', 'Toys', None], n_messy),
    'price': np.round(np.random.uniform(10.0, 500.0, n_messy), 2),
    'quantity': np.random.randint(1, 10, n_messy)
})
# Inject anomalies
messy_df.loc[10:15, 'price'] = 9999.99
# Inject nulls
messy_df.loc[20:25, 'quantity'] = None
messy_df.to_csv("sample_data/messy_sales_data.csv", index=False)
