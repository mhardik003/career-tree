import os
import re
import json
import time
import argparse
from collections import deque
from typing import List, Optional
# import google.generativeai as genai
from google import genai
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# --- CONFIGURATION ---
load_dotenv()
API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY: raise ValueError("GEMINI_API_KEY missing.")

# File to save progress (so you can stop/start script without losing data).
# This is the file the app actually reads — anchored to this script's directory
# so it resolves correctly from any cwd.
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "career-tree", "data")
OUTPUT_FILE = os.path.join(DATA_DIR, "career_tree_data.json")

# --- PYDANTIC SCHEMAS (STRUCTURED OUTPUT) ---

class CareerNodeOutput(BaseModel):
    """The structure Gemini MUST return."""
    node_title: str = Field(..., description="The name of this specific stage (e.g., 'PCM', 'JEE Mains', 'Computer Science')")
    is_terminal: bool = Field(..., description="True if this is a specific job/end career (e.g., 'Neurosurgeon'). False if it is a study stage or stream (e.g., 'MBBS').")
    description: str = Field(..., description="A 2-sentence summary of what this stage entails.")
    
    # Metadata for your future webpage
    avg_duration_years: Optional[str] = Field(None, description="Time to complete this specific node (e.g., '4 years').")
    difficulty_rating: int = Field(..., description="1-10 rating of difficulty/competition in India.")
    search_keywords: List[str] = Field(..., description="5 best keywords to search YouTube/Reddit for this specific niche.")
    
    # The Recursion Logic
    children: List[str] = Field(..., description="List of immediate next options. If is_terminal is True, this should be empty.")

# --- SANITIZATION ---

def slugify(text):
    """
    Mirror of career-tree/lib/slugify.ts:
    text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
    Used to predict URL collisions between sibling names.
    """
    text = text.lower()
    text = re.sub(r'[^a-z0-9]+', '-', text)
    return re.sub(r'(^-|-$)+', '', text)

def sanitize_children(parent_path, children):
    """
    Clean a freshly-generated children list before it is stored/queued:
    - '/' is the path separator, so it would corrupt the key. Swap for '|'.
    - Drop names that are empty after stripping.
    - Drop any child whose slug collides with an earlier sibling
      (the app's URL lookup takes the FIRST matching sibling, so
      later duplicates would be unreachable anyway).
    """
    cleaned = []
    seen_slugs = {}
    for child in children:
        name = child.replace("/", "|").strip()
        if not name:
            continue
        slug = slugify(name)
        if slug in seen_slugs:
            print(f"Warning: under '{parent_path}', dropping child '{name}' — slug collides with sibling '{seen_slugs[slug]}'")
            continue
        seen_slugs[slug] = name
        cleaned.append(name)
    return cleaned

# --- THE PROMPT ---

def generate_node_data(current_path_string):
    """
    Sends the path to Gemini and requests children nodes.
    """
    
    client = genai.Client(api_key=API_KEY)

    prompt = f"""
    You are an expert Career Counselor for the Indian Education System.
    
    We are building a career tree. 
    Current Position/Path: "{current_path_string}"
    
    Task:
    1. Analyze the 'Current Position'.
    2. Identify the IMMEDIATE next available options (Branches).
    3. Do NOT skip steps. (e.g., Don't go 10th -> Software Engineer. Go 10th -> PCM -> B.Tech -> Software Engineer).
    4. Context is INDIA (Use terms like JEE, NEET, CA, UPSC, etc., where applicable).
    5. The node_title and the children names should not contain slashes (/). Use '|' instead. (e.g., 'AI | ML' instead of 'AI/ML').
    
    If the current path is a broad stream (like 'Science'), break it down into streams or degrees.
    If the current path is a specific degree, break it down into specializations or entry-level roles.
    If the current path is a specific Job Role, set 'is_terminal' to true and leave children empty.

    Return the data in JSON format tailored for a node-based website.
    """

    try:
        response = client.models.generate_content(
        model="gemini-2.5-pro",
        contents=prompt,
        config={
            "response_mime_type": "application/json",
            "response_json_schema": CareerNodeOutput.model_json_schema(),
        },
        )



        # response = model.generate_content(prompt)
        # Parse the JSON response specifically using the Pydantic model
        return CareerNodeOutput.model_validate_json(response.text)
    except Exception as e:
        print(f"Error generating for {current_path_string}: {e}")
        return None

# --- MAIN CRAWLER LOGIC ---

def _check_freeze():
    """v2 migration freeze: the v1 tree JSON is the snapshot all migration artifacts
    derive from — writing to it mid-migration corrupts the migration. See migration/FREEZE.md."""
    marker = os.path.join(os.path.dirname(os.path.abspath(__file__)), "migration", "FREEZE.md")
    if os.path.exists(marker):
        raise SystemExit(
            "REFUSING TO RUN: v1 data is frozen for the v2 migration (see migration/FREEZE.md\n"
            "and 'All Career Tree/DATA_ARCHITECTURE_V2.md'). The crawler returns in Stage 5,\n"
            "rewritten to expand roles instead of paths."
        )

def build_career_tree(new_node=None):
    _check_freeze()
  # 1. Load Existing Data
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, 'r') as f:
                tree_store = json.load(f)
            print(f"Loaded {len(tree_store)} existing nodes from file.")
        except json.JSONDecodeError:
            print("File corrupt. Starting fresh.")
            tree_store = {}
    else:
        tree_store = {}

    # 2. Reconstruct Queue
    queue = deque()
    if new_node:
        queue.append(new_node) 
    
    # Track what is already in the queue to avoid duplicates
    queued_items = set() 
    if new_node:
        queued_items.add(new_node)
    
    # Everything currently in tree_store is 'visited'
    visited_paths = set(tree_store.keys())

    # START FRESH if empty
    if not tree_store and len(queue)==0:
        start_node = "10th Class"
        queue.append(start_node)
        queued_items.add(start_node)
    else:
        # INTELLIGENT RESUME:
        # Look at every node we have. If it lists a child, and that child 
        # is NOT in the tree_store (as a key), we need to visit it.
        print("Calculating remaining paths...")
        for parent_path, data in tree_store.items():
            # If it's a dead end, ignore
            if data.get('is_terminal', False):
                continue

            children = data.get('children', [])
            for child in children:
                # Reconstruct the full path
                child_full_path = f"{parent_path}/{child}"
                
                # If we haven't visited this child yet...
                if child_full_path not in visited_paths:
                    # ...and it's not already waiting in the queue
                    if child_full_path not in queued_items:
                        queue.append(child_full_path)
                        queued_items.add(child_full_path)

    print(f"Resuming with {len(queue)} nodes in queue.")

    print("Starting Career Tree Crawler...")

    while queue:
        current_path = queue.popleft()
        
        if current_path in visited_paths:
            continue

        print(f"Processing: {current_path}")
        
        # 1. Ask Gemini for data
        node_data = generate_node_data(current_path)
        
        if not node_data:
            print("Skipping due to error, retrying later or ignoring...")
            continue

        # 2. Sanitize the fresh data
        # The prompt asks Gemini to avoid '/', but enforce it here so a stray
        # slash never corrupts the path keys, and slug-colliding siblings never
        # shadow each other in the app's URL lookup.
        node_data.node_title = node_data.node_title.replace("/", "|").strip()
        if node_data.children:
            node_data.children = sanitize_children(current_path, node_data.children)

        # 3. Store the data structure
        # We use the path as the key
        tree_store[current_path] = node_data.model_dump()

        # 4. Add children to queue
        if not node_data.is_terminal and node_data.children:
            for child in node_data.children:
                # Create the new path string
                new_path = f"{current_path}/{child}"

                # Check duplication
                if new_path not in visited_paths:
                    queue.append(new_path)

        visited_paths.add(current_path)

        # 5. Save frequently
        with open(OUTPUT_FILE, 'w') as f:
            json.dump(tree_store, f, indent=4)

        # 6. Rate Limiting (Important for free tier)
        time.sleep(1)

    print("Tree generation complete!")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Career Tree Crawler")
    parser.add_argument("--node", type=str, help="Specific node path to add to the queue immediately.")
    args = parser.parse_args()
    rootnode = args.node
    build_career_tree(rootnode) if rootnode else build_career_tree()