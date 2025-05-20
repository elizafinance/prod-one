import csv
import json
import os

# Define input and output paths relative to the project root
# The script is expected to be run from the project root directory
CSV_FILE_PATH = os.path.join('src', 'MAY20DeFAIHOLDERS.csv')
OUTPUT_DIR = os.path.join('src', 'app', 'data')
JSON_OUTPUT_PATH = os.path.join(OUTPUT_DIR, 'defai_holders.json')

def process_csv_to_json():
    """
    Reads the DeFAI holders CSV, processes it, and writes it as a JSON file
    into the src/app/data directory.
    """
    holders_data = []

    try:
        with open(CSV_FILE_PATH, mode='r', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                try:
                    # Clean and convert data types as needed
                    processed_row = {
                        'account': row.get('Account', '').strip(),
                        'tokenAccount': row.get('Token Account', '').strip(),
                        'quantity': float(row.get('Quantity', 0.0)),
                        'percentage': float(row.get('Percentage', 0.0))
                    }
                    holders_data.append(processed_row)
                except ValueError as ve:
                    print(f"Skipping row due to data conversion error: {row} - {ve}")
                except Exception as e:
                    print(f"An unexpected error occurred processing row: {row} - {e}")
    
    except FileNotFoundError:
        print(f"Error: The file {CSV_FILE_PATH} was not found. Make sure the path is correct and the file exists.")
        return
    except Exception as e:
        print(f"An error occurred while reading the CSV file: {e}")
        return

    if not holders_data:
        print("No data processed from CSV. Output JSON will be empty or not created.")
        # Optionally, you might still want to create an empty JSON file or handle as an error
        # For now, we'll just not write an empty file if no data.

    # Create the output directory if it doesn't exist
    try:
        os.makedirs(OUTPUT_DIR, exist_ok=True)
    except OSError as e:
        print(f"Error creating directory {OUTPUT_DIR}: {e}")
        return

    # Write the processed data to a JSON file
    try:
        with open(JSON_OUTPUT_PATH, mode='w', encoding='utf-8') as jsonfile:
            json.dump(holders_data, jsonfile, indent=4)
        print(f"Successfully processed CSV and saved data to {JSON_OUTPUT_PATH}")
    except IOError as e:
        print(f"Error writing JSON to file {JSON_OUTPUT_PATH}: {e}")
    except Exception as e:
        print(f"An unexpected error occurred while writing the JSON file: {e}")

if __name__ == '__main__':
    print(f"Current working directory: {os.getcwd()}")
    print(f"Attempting to read CSV from: {os.path.abspath(CSV_FILE_PATH)}")
    print(f"Attempting to write JSON to: {os.path.abspath(JSON_OUTPUT_PATH)}")
    process_csv_to_json() 