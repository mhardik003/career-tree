import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 1. Validate
    if (!body.nodeKey || !body.newData) {
        return NextResponse.json({ success: false, message: "Missing data" }, { status: 400 });
    }

    // 2. Define Paths
    const dataDir = path.join(process.cwd(), 'data');
    const filePath = path.join(dataDir, 'edits.json');
    
    // 3. CRITICAL: Check if Directory exists
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // 4. Read existing data or start empty
    let edits = [];
    if (fs.existsSync(filePath)) {
        try {
            edits = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (e) { 
            edits = []; 
        }
    }

    // 5. Add new entry
    const newEdit = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      target_node_key: body.nodeKey,
      original_data: body.originalData,
      proposed_data: body.newData,
      status: 'pending_review'
    };

    edits.push(newEdit);

    // 6. Write back to file
    fs.writeFileSync(filePath, JSON.stringify(edits, null, 2));

    return NextResponse.json({ success: true, message: "Edit request saved!" });

  } catch (error) {
    console.error("Edit API Error:", error);
    return NextResponse.json({ success: false, message: "Server Error" }, { status: 500 });
  }
}