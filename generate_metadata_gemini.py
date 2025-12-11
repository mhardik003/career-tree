import os
import json
import time
from dotenv import load_dotenv
from google import genai
from pydantic import BaseModel, Field
from typing import List, Optional
import argparse

# --- CONFIGURATION ---
load_dotenv()
API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY: raise ValueError("GEMINI_API_KEY missing.")



TREE_FILE = "career_tree_data.json"
METADATA_FILE = "metadata.json"

class NodeMetadata(BaseModel):
    exams_to_give: Optional[List[str]] = Field(default=None, description="List of specific entrance exams (e.g. JEE, NEET, CAT, UPSC).")
    certifications: Optional[List[str]] = Field(default=None, description="Relevant certifications (e.g. CFA, AWS, Coursera).")
    qualifications_needed: Optional[List[str]] = Field(default=None, description="Academic degrees or prerequisites.")
    avg_cost_inr: Optional[str] = Field(default=None, description="Estimated cost range in INR (e.g. '2-5 Lakhs').")
    top_colleges_or_companies: Optional[List[str]] = Field(default=None, description="Top 3-5 institutions or employers in India.")
    tools_and_resources: Optional[List[str]] = Field(default=None, description="Software, books, or websites relevant to this stage.")
    duration_years: Optional[str] = Field(default=None, description="Duration of this step, e.g. '2 years'.")
    real_life_applications: Optional[List[str]] = Field(default=None, description="Typical real world applications while being in this position")
    

# --- HELPER ---
def get_clean_schema(pydantic_model):
    schema = pydantic_model.model_json_schema()
    def _recurse_clean(d):
        if isinstance(d, dict):
            if 'default' in d: del d['default']
            for k, v in d.items(): _recurse_clean(v)
        elif isinstance(d, list):
            for item in d: _recurse_clean(item)
    _recurse_clean(schema)
    return schema

def generate_metadata(node_title, description):
    client = genai.Client(api_key=API_KEY)


    prompt = f"""
    Context: Career Counseling in India.
    Node: "{node_title}"
    Description: "{description}"

    Task: Provide detailed metadata for this specific career stage/node.
    If a field is not applicable (e.g., no exams for a generic stream), leave the list empty.
    Keep cost estimates realistic for India.
    """

    try:
        response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config={
            "response_mime_type": "application/json",
            "response_json_schema": NodeMetadata.model_json_schema(),
        },
        )        
        
        return json.loads(response.text)
    except Exception as e:
        print(f"Error generating for {node_title}: {e}")
        return None


def generate_one_node_metadata(node_title, description):
    with open(METADATA_FILE, 'r') as f:
        metadata_store = json.load(f)

    print(f"Generating metadata for single node: {node_title}...")
    data = generate_metadata(node_title, description)
    if data:
        print("Adding metadata to the file")
        print(json.dumps(data, indent=2))
        #update metadata_store and save
        metadata_store[node_title] = data
        with open(METADATA_FILE, 'w') as f:
            json.dump(metadata_store, f, indent=2)



# --- MAIN LOOP ---
def main():
    # 1. Load Tree
    with open(TREE_FILE, 'r') as f:
        tree_data = json.load(f)

    # 2. Load or Init Metadata
    if os.path.exists(METADATA_FILE):
        with open(METADATA_FILE, 'r') as f:
            metadata_store = json.load(f)
    else:
        metadata_store = {}

    print(f"Found {len(tree_data)} nodes. Metadata has {len(metadata_store)} entries.")
    
    # 3. Process Missing Nodes
    for path, node in tree_data.items():
        if path in metadata_store:
            continue # Skip if already exists

        print(f"Generating metadata for: {node['node_title']}...")
        
        data = generate_metadata(node['node_title'], node['description'])
        
        if data:
            metadata_store[path] = data
            
            # Save immediately
            with open(METADATA_FILE, 'w') as f:
                json.dump(metadata_store, f, indent=2)
            
            time.sleep(1) # Rate limit

    print("Metadata generation complete!")

if __name__ == "__main__":
    main()