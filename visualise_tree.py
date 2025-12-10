import json
from pyvis.network import Network
import os
import webbrowser

INPUT_FILE = "career_tree_data.json"
OUTPUT_HTML = "career_map.html"

def visualize_interactive():
    # 1. Load Data
    if not os.path.exists(INPUT_FILE):
        print("JSON file not found!")
        return

    try:
        with open(INPUT_FILE, 'r') as f:
            data = json.load(f)
    except json.JSONDecodeError:
        print("Error: JSON file is corrupt or empty.")
        return

    # 2. Setup Network
    net = Network(height="90vh", width="100%", bgcolor="#222222", font_color="white", select_menu=True)
    
    # Set layout options (Hierarchical Left-to-Right)
    options = {
        "layout": {
            "hierarchical": {
                "enabled": True,
                "direction": "LR",
                "sortMethod": "directed",
                "nodeSpacing": 150,
                "levelSeparation": 300
            }
        },
        "physics": {
            "hierarchicalRepulsion": {
                "nodeDistance": 150,
                "avoidOverlap": 1
            }
        }
    }
    net.set_options(json.dumps(options))

    print(f"Loaded {len(data)} nodes. Building graph...")

    # --- PASS 1: ADD ALL KNOWN NODES ---
    # We do this first so all valid nodes exist before we try to link them
    for path, info in data.items():
        node_id = path
        label = info.get('node_title', path.split('/')[-1])
        
        # Color Logic
        if info.get('is_terminal'):
            color = "#00ff00" # Green (Job/End Goal)
        elif info.get('difficulty_rating', 0) >= 8:
            color = "#ff6666" # Red (Hard)
        else:
            color = "#97c2fc" # Blue (Study/Path)

        # Tooltip
        tooltip = (
            f"<b>{label}</b><br>"
            f"<i>Duration: {info.get('avg_duration_years', 'N/A')}</i><br>"
            f"Difficulty: {info.get('difficulty_rating', 'N/A')}/10<br><br>"
            f"{info.get('description', '')}"
        )

        net.add_node(node_id, label=label, title=tooltip, color=color, shape="dot")

    # --- PASS 2: ADD EDGES (AND HANDLE MISSING CHILDREN) ---
    missing_nodes_count = 0
    
    for path, info in data.items():
        children = info.get('children', [])
        
        for child in children:
            child_full_path = f"{path}/{child}"
            
            # Check if this child actually exists in our network (added in Pass 1)
            # The get_nodes() method returns a list of IDs
            existing_nodes = net.get_nodes()
            
            if child_full_path in existing_nodes:
                # Normal connection
                net.add_edge(path, child_full_path)
            else:
                # ERROR HANDLING: The child is listed in 'children' but has no data entry
                # We create a "Ghost Node" so the tree doesn't break, but color it Grey.
                print(f"⚠️ Warning: Missing data for node: '{child}' (Parent: {info.get('node_title')})")
                
                net.add_node(
                    child_full_path, 
                    label=f"{child} (Pending)", 
                    color="#808080", # Grey
                    shape="box",
                    title="Data not yet generated for this node."
                )
                net.add_edge(path, child_full_path)
                missing_nodes_count += 1

    print(f"\nGraph generated successfully!")
    print(f"Nodes with missing data (Grey): {missing_nodes_count}")
    print(f"Opening {OUTPUT_HTML}...")
    
    net.save_graph(OUTPUT_HTML)
    webbrowser.open(OUTPUT_HTML)

if __name__ == "__main__":
    visualize_interactive()