
# <img src="./icon.png" width="40" height="40" alt="Logo" style="vertical-align:middle;" /> Career Tree

**Democratizing Career Counseling through Open Source Data Visualization.**

> *Don't just follow a path. Understand it.*

Career Tree is an interactive, node-based map of career opportunities. Unlike traditional lists or aptitude tests, it visualizes career paths as a branching tree, allowing users to explore prerequisites, identify dead ends, and discover non-linear pathways from any stage of life.

Currently mapped for the **Indian Education System** (scaling globally soon).

## TODO
* Option to delete the nodes
* Bottom up paths as well
* Add github actions tests (in the gemini chat)

## 🚀 Features

*   **Interactive Graph:** A zoomable, pannable global view of all career connections using `React Flow`.
*   **Focus Mode:** A clean, hierarchical view (Parent → Current Node → Children) to prevent information overload.
*   **Crowdsourced Data:** Built-in "Suggest a Path" and "Edit Node" features allow the community to refine data.
*   **AI-Powered Crawler:** A Python script utilizing **Google Gemini** to recursively generate and map career paths.
*   **Rich Metadata:** Nodes contain difficulty ratings, duration, descriptions, and curated search keywords.

## 🛠️ Tech Stack

**Frontend (Web App)**
*   **Framework:** [Next.js 15](https://nextjs.org/) (App Router)
*   **Styling:** Tailwind CSS
*   **Animation:** Framer Motion
*   **Visualization:** React Flow & Dagre (Graph Layout)
*   **Icons:** Lucide React

**Data Pipeline**
*   **Language:** Python 3.11+
*   **LLM:** Google Gemini 1.5 Flash
*   **Validation:** Pydantic (Structured Output)

---

## 🏁 Getting Started

### Prerequisites
*   Node.js 18+
*   Python 3.10+
*   A Google Gemini API Key (for the data crawler)

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/career-tree.git
cd career-tree
```

### 2. Run the Web Application
This runs the frontend interface.

```bash
# Install dependencies
npm install

# Run the development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. (Optional) Add data from the Data Crawler
If you want to expand the tree data yourself using AI:

1.  Navigate to the scripts folder (or wherever you placed the python script).
2.  Create a `.env` file and add your key:
    ```env
    GEMINI_API_KEY=your_actual_api_key_here
    ```
3.  Install Python requirements:
    ```bash
    pip install google-genai pydantic python-dotenv networkx
    ```
4. 
5.  Run the crawler:
    ```bash
    python generate_tree_gemini.py --node <new node path you want to add>
    ```
    *This will update `src/data/career_tree_data.json`, and you can make a pull request with this new file.*

---

## 📂 Project Structure

```
career-tree/
├── public/
├── src/
│   ├── app/
│   │   ├── api/            # Serverless functions for Forms
│   │   ├── explore/        # Dynamic Route [slug] for the Focus View
│   │   ├── map/            # The Global Graph View
│   │   └── page.tsx        # Landing Page
│   ├── components/         # Reusable UI (NodeCard, Modals)
│   ├── data/
│   │   ├── career_tree_data.json  # The Main Database (Read Only)
│   │   ├── suggestions.json       # User submissions (Write)
│   │   └── edits.json             # User edit requests (Write)
│   └── lib/
│       └── treeUtils.ts    # Graph logic & Slug helpers
└── generate_tree_gemini.py # The AI Crawler Script
```

---

## 🤝 Contributing

We believe career data should be a public good, not a trade secret.

**How to contribute:**
1.  **Code:** Fork the repo, make feature updates (e.g., migrating JSON storage to a Database), and submit a PR.
2.  **Data:** Use the website's "Suggest" feature to add missing niches, or edit `src/data/career_tree_data.json` directly and submit a PR.



## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

Made with ❤️ by Hardik