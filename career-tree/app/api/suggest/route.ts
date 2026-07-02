import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { checkRateLimit } from '@/lib/rateLimit';
import { SuggestionSchema } from '@/lib/schemas';
import { getNodeByKey } from '@/lib/treeUtils';
import { slugify } from '@/lib/slugify';


export async function POST(request: Request) {
  try {

    // Check rate limit
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

    // Validate
    const result = SuggestionSchema.safeParse(body);
    if (!result.success) {
      // Return exact error to help debugging (or just generic 400)
      return NextResponse.json({
        success: false,
        message: "Invalid input",
        errors: result.error.flatten()
      }, { status: 400 });
    }

    const cleanData = result.data; // Use the sanitized data

    const parent = getNodeByKey(cleanData.parentPath);
    if (!parent) {
      return NextResponse.json(
        { success: false, message: "Unknown parent path — this node doesn't exist in the tree." },
        { status: 400 }
      );
    }

    // Slug comparison, matching how URLs resolve: "AI ML" duplicates "AI | ML"
    const titleSlug = slugify(cleanData.title);
    if (parent.children.some((child) => slugify(child) === titleSlug)) {
      return NextResponse.json(
        { success: false, message: `"${cleanData.title}" already exists under this node.` },
        { status: 409 }
      );
    }

    // Create entry in Supabase
    const supabase = getSupabase();
    const { error } = await supabase.from('suggestions').insert({
      parent_path: cleanData.parentPath,
      suggested_name: cleanData.title,
      suggested_description: cleanData.description,
      status: 'pending_review'
    });

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, message: "Suggestion saved to Database!" });

  } catch (error) {
    console.error("Suggestion API Error:", error);
    return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
  }
}
