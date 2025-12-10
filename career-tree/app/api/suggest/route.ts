import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 1. Validate
    if (!body.title || !body.description) {
        return NextResponse.json({ success: false, message: "Title and Description are required." }, { status: 400 });
    }

    // 2. Define Paths (Using src/data to match your project structure)
    const dataDir = path.join(process.cwd(), 'data');
    const filePath = path.join(dataDir, 'suggestions.json');

    // 3. CRITICAL: Check if Directory exists, if not, create it
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    // 4. Read existing data or start empty
    let suggestions = [];
    if (fs.existsSync(filePath)) {
        try {
            const fileData = fs.readFileSync(filePath, 'utf8');
            suggestions = JSON.parse(fileData);
        } catch (error) {
            console.error("JSON Parse error, resetting suggestions file.");
            suggestions = [];
        }
    }

    // 5. Add new entry
    const newEntry = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        parent_path: body.parentPath,
        suggested_name: body.title,
        suggested_description: body.description,
        status: 'pending'
    };

    suggestions.push(newEntry);

    // 6. Write back to file
    fs.writeFileSync(filePath, JSON.stringify(suggestions, null, 2));

    return NextResponse.json({ success: true, message: "Suggestion saved!" });

  } catch (error) {
    console.error("Suggestion API Error:", error);
    return NextResponse.json({ success: false, message: "Server Error" }, { status: 500 });
  }
}