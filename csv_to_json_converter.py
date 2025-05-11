import csv
import json

def csv_to_json(csv_file_path, json_file_path):
    """
    Converts a CSV file to a JSON file.

    Args:
        csv_file_path (str): The path to the input CSV file.
        json_file_path (str): The path to the output JSON file.
    """
    data = []
    try:
        with open(csv_file_path, mode='r', encoding='utf-8') as csv_file:
            csv_reader = csv.DictReader(csv_file)
            for row in csv_reader:
                # Clean and convert Quantity
                quantity_str = row.get('Quantity', '0').replace('\"' , '').replace(',', '')
                try:
                    row['Quantity'] = float(quantity_str) if '.' in quantity_str else int(quantity_str)
                except ValueError:
                    print(f"Warning: Could not convert Quantity '{row.get('Quantity')}' to number for Account {row.get('Account')}. Setting to 0.")
                    row['Quantity'] = 0

                # Convert AIRDROP
                airdrop_str = row.get('AIRDROP', '0').replace('\"' , '').replace(',', '')
                try:
                    row['AIRDROP'] = float(airdrop_str) if '.' in airdrop_str else int(airdrop_str)
                except ValueError:
                    print(f"Warning: Could not convert AIRDROP '{row.get('AIRDROP')}' to number for Account {row.get('Account')}. Setting to 0.")
                    row['AIRDROP'] = 0
                
                data.append(row)
    except FileNotFoundError:
        print(f"Error: CSV file not found at {csv_file_path}")
        return
    except Exception as e:
        print(f"An error occurred during CSV processing: {e}")
        return

    try:
        with open(json_file_path, mode='w', encoding='utf-8') as json_file:
            json.dump(data, json_file, indent=2)
        print(f"Successfully converted {csv_file_path} to {json_file_path}")
    except IOError:
        print(f"Error: Could not write JSON file to {json_file_path}")
    except Exception as e:
        print(f"An error occurred during JSON writing: {e}")

if __name__ == '__main__':
    # Define the input CSV and output JSON file paths
    # Assumes the script is in the workspace root and the CSV is also there.
    csv_input_path = '10_1AIR - Sheet1.csv'
    # Output directly to the location the API route expects
    json_output_path = 'src/data/airdropData.json' 

    print(f"Starting conversion of {csv_input_path} to {json_output_path}...")
    csv_to_json(csv_input_path, json_output_path) 