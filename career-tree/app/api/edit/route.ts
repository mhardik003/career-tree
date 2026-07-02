import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { checkRateLimit } from '@/lib/rateLimit';
import { EditSubmissionSchema } from '@/lib/schemas';
import { getNodeByKey } from '@/lib/treeUtils';


export async function POST(request: Request) {
  try {

    const allowed = checkRateLimit(request);
    if (!allowed) {
      return NextResponse.json(
        { success: false, message: "Too many requests. Slow down." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Request body must be valid JSON." },
        { status: 400 }
      );
    }

    const validation = EditSubmissionSchema.safeParse(body);

    if (!validation.success) {
      // Return specific validation errors so the frontend knows what's wrong
      return NextResponse.json(
        { success: false, message: "Invalid data format", errors: validation.error.format() },
        { status: 400 } // 400 Bad Request
      );
    }

    // Data is clean, proceed to DB
    const { nodeKey, originalData, newData } = validation.data;

    if (!getNodeByKey(nodeKey)) {
      return NextResponse.json(
        { success: false, message: "Unknown node key — this node doesn't exist in the tree." },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    const { error } = await supabase.from('edits').insert({
      target_node_key: nodeKey,
      original_data: originalData,
      proposed_data: newData,
      status: 'pending_review'
    });

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, message: "Edit request saved to Database!" });

  } catch (error) {
    console.error("Edit API Error:", error);
    return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
  }
}
